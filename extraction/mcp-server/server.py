"""
MCP Server - Extraction
Fornece tools para leitura de planilhas Excel e exportacao de resultados.
Protocolo: stdio (JSON-RPC via stdin/stdout)
"""

import json
import sys
import os
from pathlib import Path

try:
    import openpyxl
except ImportError:
    openpyxl = None


# === Funcoes de leitura ===

def ler_excel(caminho: str) -> str:
    """
    Le arquivo Excel e retorna conteudo como texto estruturado.
    Cada aba vira uma secao, cada linha vira texto com colunas separadas por pipe.
    """
    if openpyxl is None:
        return "ERRO: openpyxl nao instalado. Execute: pip install openpyxl"

    path = Path(caminho)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {caminho}")

    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    resultado = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        resultado.append(f"=== PLANILHA: {sheet_name} ===\n")

        for row in ws.iter_rows(values_only=False):
            celulas = []
            for cell in row:
                if cell.value is not None:
                    celulas.append(f"{cell.column_letter}{cell.row}={cell.value}")
            if celulas:
                resultado.append(" | ".join(celulas))

    wb.close()
    return "\n".join(resultado)


def exportar_markdown(conteudo: str, caminho: str) -> str:
    """Salva conteudo Markdown em arquivo."""
    path = Path(caminho)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(conteudo)
    return f"Arquivo salvo em: {path.absolute()}"


def exportar_excel(conteudo_md: str, caminho: str) -> str:
    """
    Converte historias do markdown para Excel formatado.
    Extrai tabelas de historias e gera planilha com cabecalho estilizado.
    """
    if openpyxl is None:
        return "ERRO: openpyxl nao instalado. Execute: pip install openpyxl"

    import re
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    # Extrair historias do markdown
    historias = []
    padrao_campo = re.compile(r"\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|")
    blocos = conteudo_md.split("### ")

    for bloco in blocos[1:]:
        linhas = bloco.strip().split("\n")
        if not linhas:
            continue

        primeira_linha = linhas[0].strip()
        match_id = re.match(r"(H[UT]\d+)\s*-\s*(.+)", primeira_linha)
        if not match_id:
            continue

        historia = {
            "ID": match_id.group(1),
            "Titulo": match_id.group(2).strip(),
        }

        for linha in linhas[1:]:
            match_campo = padrao_campo.match(linha)
            if match_campo:
                campo = match_campo.group(1).strip()
                valor = match_campo.group(2).strip()
                historia[campo] = valor

        historias.append(historia)

    if not historias:
        return "ERRO: Nenhuma historia encontrada no conteudo para exportar."

    wb = Workbook()
    ws = wb.active
    ws.title = "Historias de Usuario"

    colunas = ["ID", "Tipo", "Macro Etapa", "Produto", "Titulo",
               "Integracoes", "Integracoes Externas",
               "Pre-requisitos", "Sistema Substituido"]

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")

    for col, nome in enumerate(colunas, 1):
        cell = ws.cell(row=1, column=col, value=nome)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row_idx, historia in enumerate(historias, 2):
        # Fallback: aceita campo "Integracoes GFO", "Integracoes Internas" ou "Integracoes"
        integracoes = historia.get(
            "Integracoes GFO",
            historia.get("Integracoes Internas", historia.get("Integracoes", ""))
        )
        ws.cell(row=row_idx, column=1, value=historia.get("ID", ""))
        ws.cell(row=row_idx, column=2, value=historia.get("Tipo", ""))
        ws.cell(row=row_idx, column=3, value=historia.get("Macro Etapa", ""))
        ws.cell(row=row_idx, column=4, value=historia.get("Produto", ""))
        ws.cell(row=row_idx, column=5, value=historia.get("Titulo", ""))
        ws.cell(row=row_idx, column=6, value=integracoes)
        ws.cell(row=row_idx, column=7, value=historia.get("Integracoes Externas", ""))
        ws.cell(row=row_idx, column=8, value=historia.get("Pre-requisitos", ""))
        ws.cell(row=row_idx, column=9, value=historia.get("Sistema Substituido", ""))

    larguras = [8, 6, 18, 30, 45, 35, 30, 40, 25]
    for col, largura in enumerate(larguras, 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = largura

    path = Path(caminho)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(caminho)
    return f"Excel salvo em: {path.absolute()} ({len(historias)} historias)"


# === MCP Protocol Handler ===

TOOLS = [
    {
        "name": "ler_planilha",
        "description": "Le uma planilha Excel (.xlsx) e retorna seu conteudo como texto estruturado. Use esta tool para converter planilhas de visao geral em texto que pode ser analisado para extrair historias de usuario.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "caminho": {
                    "type": "string",
                    "description": "Caminho absoluto para o arquivo Excel (.xlsx)"
                }
            },
            "required": ["caminho"]
        }
    },
    {
        "name": "exportar_historias_markdown",
        "description": "Salva o conteudo de historias de usuario extraidas em um arquivo Markdown.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "conteudo": {
                    "type": "string",
                    "description": "Conteudo markdown das historias extraidas"
                },
                "caminho": {
                    "type": "string",
                    "description": "Caminho onde salvar o arquivo .md"
                }
            },
            "required": ["conteudo", "caminho"]
        }
    },
    {
        "name": "exportar_historias_excel",
        "description": "Converte historias de usuario em formato markdown para uma planilha Excel formatada com cabecalho estilizado.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "conteudo": {
                    "type": "string",
                    "description": "Conteudo markdown das historias extraidas"
                },
                "caminho": {
                    "type": "string",
                    "description": "Caminho onde salvar o arquivo .xlsx"
                }
            },
            "required": ["conteudo", "caminho"]
        }
    }
]


def handle_request(request: dict) -> dict:
    """Processa uma requisicao JSON-RPC do MCP."""
    method = request.get("method", "")
    req_id = request.get("id")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "extraction-mcp",
                    "version": "1.0.0"
                }
            }
        }

    elif method == "notifications/initialized":
        return None  # Notificacao, sem resposta

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        try:
            if tool_name == "ler_planilha":
                resultado = ler_excel(arguments["caminho"])
            elif tool_name == "exportar_historias_markdown":
                resultado = exportar_markdown(arguments["conteudo"], arguments["caminho"])
            elif tool_name == "exportar_historias_excel":
                resultado = exportar_excel(arguments["conteudo"], arguments["caminho"])
            else:
                resultado = f"Tool desconhecida: {tool_name}"

            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {"type": "text", "text": resultado}
                    ]
                }
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {"type": "text", "text": f"ERRO: {str(e)}"}
                    ],
                    "isError": True
                }
            }

    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {}
        }

    else:
        # Metodos desconhecidos - ignorar notificacoes, erro para requests
        if req_id is not None:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }
        return None


def main():
    """Loop principal - le JSON-RPC via stdin, responde via stdout."""
    # Desabilitar buffering no stdout
    sys.stdout.reconfigure(line_buffering=False)

    buffer = ""
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break

            buffer += line

            # Tentar parsear JSON completo
            try:
                request = json.loads(buffer.strip())
                buffer = ""
            except json.JSONDecodeError:
                continue

            response = handle_request(request)
            if response is not None:
                response_str = json.dumps(response)
                sys.stdout.write(response_str + "\n")
                sys.stdout.flush()

        except KeyboardInterrupt:
            break
        except Exception as e:
            sys.stderr.write(f"Erro no servidor: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    main()
