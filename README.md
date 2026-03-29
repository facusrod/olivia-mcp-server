# @facusrod/olivia-mcp-server

MCP Server para conectar Claude Desktop con Odoo 18. Permite consultar productos, analizar ventas (POS + eCommerce), y crear/actualizar productos directamente desde el chat.

## Instalación

Requiere **Node.js >= 20**.

### Claude Desktop

Agregar a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "olivia-products": {
      "command": "npx",
      "args": ["-y", "@facusrod/olivia-mcp-server"],
      "env": {
        "ODOO_URL": "https://tu-odoo.com",
        "ODOO_DB": "tu-database",
        "ODOO_USERNAME": "tu-email",
        "ODOO_PASSWORD": "tu-password",
        "CF_ACCESS_CLIENT_ID": "",
        "CF_ACCESS_CLIENT_SECRET": ""
      }
    }
  }
}
```

Las variables `CF_ACCESS_*` son opcionales (solo si Odoo está detrás de Cloudflare Zero Trust).

## Tools disponibles

### Lectura

| Tool | Descripción |
|------|-------------|
| `odoo_search_products` | Buscar productos por nombre, código o barcode |
| `odoo_get_product_by_id` | Obtener un producto por ID |
| `odoo_get_low_stock` | Productos con stock bajo |
| `odoo_get_sales_ranking` | Top productos vendidos (POS + eCommerce) |
| `odoo_get_sales_history` | Historial de ventas con fecha/hora |

### Escritura (requieren confirmación)

| Tool | Descripción |
|------|-------------|
| `odoo_parse_excel` | Parsear Excel con lista de productos |
| `odoo_create_products` | Crear productos en Odoo |
| `odoo_update_product` | Actualizar un producto existente |

### Paginación

Las tools de listado soportan `offset` y devuelven `has_more` + `next_offset`.

## Ejemplos de uso

- "Buscame productos de aceite de coco"
- "Cuáles son los más vendidos del mes?"
- "Qué productos tienen stock bajo?"
- "Los sábados se vende más a la mañana o a la tarde?"
- "Importame estos productos del Excel" (adjuntar .xlsx)

## Desarrollo

```bash
git clone https://github.com/facusrod/olivia-mcp-server.git
cd olivia-mcp-server
npm install
npm run build
```
