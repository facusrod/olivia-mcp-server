import http from 'node:http';
import { mcpServer } from './mastra/index.js';

const PORT = parseInt(process.env.MCP_PORT || '3001', 10);
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  console.error('ERROR: MCP_API_KEY no está configurada en .env');
  console.error('Generá una con: node -e "console.log(crypto.randomUUID())"');
  process.exit(1);
}

function authenticate(req: http.IncomingMessage): boolean {
  // Acepta el token en header Authorization: Bearer <key>
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  return token === API_KEY;
}

const server = http.createServer(async (req, res) => {
  // CORS para clientes remotos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (sin auth)
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'olivia-mcp-server' }));
    return;
  }

  // Autenticación para todas las rutas MCP
  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: API key inválida o faltante' }));
    return;
  }

  // Delegar al MCP server de Mastra
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  await mcpServer.startHTTP({
    url,
    httpPath: '/mcp',
    req,
    res,
    options: { serverless: false },
  });
});

server.listen(PORT, () => {
  console.log(`Olivia MCP Server corriendo en http://localhost:${PORT}/mcp`);
  console.log('Autenticación: Bearer token requerido');
  console.log('Health check: GET /health (sin auth)');
});
