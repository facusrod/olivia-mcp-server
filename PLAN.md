# Plan: MCP Server con Mastra para Importación de Productos a Odoo

## Contexto

Crear un servicio Mastra que exponga tools via MCP para parsear archivos Excel (.xlsx) con productos y crearlos en Odoo 18. Se consume directamente desde **Claude Desktop** (no se modifica Olivia). Es un proyecto de aprendizaje de Mastra + MCP para aplicar en otro proyecto laboral.

---

## Arquitectura

```
Claude Desktop ──MCP──▶ Mastra Service (MCP Server)
                          ├── Tool: parse_excel
                          └── Tool: create_products_odoo
                                    │
                                    ▼ XML-RPC
                                  Odoo 18
```

- **Claude Desktop** es el agente (no se necesita agente Gemini)
- **Mastra** define las tools y las expone como MCP server
- **No se modifica Olivia**

---

## Tech Stack

| Componente | Tecnología |
|-----------|-----------|
| Framework | Mastra (latest) |
| MCP | Mastra built-in MCP server |
| Excel parsing | `xlsx` (SheetJS) |
| Odoo connection | `xmlrpc` + `axios` |
| Runtime | Node.js + TypeScript |

---

## Estructura del Proyecto

```
olivia-mcp-server/
├── package.json
├── tsconfig.json
├── .env
└── src/
    ├── mastra/
    │   ├── index.ts            # Mastra instance + MCP server config
    │   └── tools/
    │       ├── parse-excel.ts      # Tool: parsear .xlsx
    │       └── create-products.ts  # Tool: crear productos en Odoo
    └── lib/
        ├── odoo-client.ts      # XML-RPC client (adaptado de olivia/lib/odoo.ts)
        └── xlsx-parser.ts      # Parsing deterministico de Excel
```

---

## Tools

### `parse_excel`
- **Input**: `fileBase64` (string) — contenido del .xlsx en base64
- **Output**: `{ products: ParsedProduct[], warnings: string[], total_rows, parsed_rows }`
- Parsing deterministico: columnas fijas (nombre, descripción, precio costo, precio venta)
- Solo lectura, no crea nada

### `create_products_odoo`
- **Input**: `products` (array de `{ name, description, cost_price, sale_price }`)
- **Output**: `{ results: [{ name, odoo_id, status, error? }] }`
- Crea productos via `product.template` en Odoo XML-RPC

---

## Configuración en Claude Desktop

Agregar al `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "olivia-products": {
      "command": "npx",
      "args": ["tsx", "/Users/facu/workplace/olivia-mcp-server/src/mastra/index.ts"]
    }
  }
}
```

O si se usa Streamable HTTP en vez de stdio:

```json
{
  "mcpServers": {
    "olivia-products": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

---

## Flujo de Uso

```
1. Usuario abre Claude Desktop
2. Adjunta archivo .xlsx y dice "Importame estos productos a Odoo"
3. Claude ve la tool parse_excel disponible, la ejecuta
4. Claude muestra tabla con productos parseados y pregunta si confirmar
5. Usuario confirma
6. Claude ejecuta create_products_odoo con los productos
7. Claude muestra resumen: X creados, Y errores
```

---

## Fases de Implementación

### Fase 1 — Setup del proyecto
1. Crear directorio `olivia-mcp-server/`
2. Inicializar con `package.json` (deps: `@mastra/core`, `xlsx`, `xmlrpc`, `axios`, `zod`)
3. Configurar `tsconfig.json`
4. Crear `.env` con variables de Odoo

### Fase 2 — Libs de soporte
5. Implementar `src/lib/xlsx-parser.ts` — parsing deterministico del Excel
6. Implementar `src/lib/odoo-client.ts` — adaptar de `olivia/lib/odoo.ts`

### Fase 3 — Tools de Mastra
7. Implementar `src/mastra/tools/parse-excel.ts`
8. Implementar `src/mastra/tools/create-products.ts`

### Fase 4 — MCP Server
9. Configurar Mastra instance + MCP server en `src/mastra/index.ts`
10. Testear con `mastra dev` (playground)

### Fase 5 — Conectar a Claude Desktop
11. Agregar config al `claude_desktop_config.json`
12. Testear end-to-end: upload Excel → preview → crear en Odoo

---

## Archivo de referencia

- `olivia/lib/odoo.ts` — Lógica XML-RPC a adaptar (métodos `callXmlRpc`, `authenticate`, `executeKw`, headers Cloudflare)

## Verificación

1. **Mastra Playground**: `mastra dev` para probar tools individualmente
2. **MCP Inspector**: `npx @modelcontextprotocol/inspector` para verificar exposición MCP
3. **Claude Desktop**: Testear flujo completo adjuntando un .xlsx de ejemplo
