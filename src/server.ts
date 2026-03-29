import http from 'node:http';
import { mcpServer } from './mastra/index.js';

const PORT = parseInt(process.env.PORT || process.env.MCP_PORT || '3001', 10);
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  console.error('ERROR: MCP_API_KEY no está configurada en .env');
  console.error('Generá una con: node -e "console.log(crypto.randomUUID())"');
  process.exit(1);
}

function authenticate(req: http.IncomingMessage): boolean {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  return token === API_KEY;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'UNKNOWN';
  const url = req.url || '/';
  console.log(`[${new Date().toISOString()}] ${method} ${url}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (sin auth)
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'olivia-mcp-server' }));
    return;
  }

  // Autenticación para rutas MCP
  if (!authenticate(req)) {
    console.log(`[${new Date().toISOString()}] 401 Unauthorized`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: API key inválida o faltante' }));
    return;
  }

  // Delegar al MCP server de Mastra
  try {
    const parsedUrl = new URL(url, `http://localhost:${PORT}`);
    console.log(`[${new Date().toISOString()}] Delegando a MCP server: ${method} ${parsedUrl.pathname}`);
    await mcpServer.startHTTP({
      url: parsedUrl,
      httpPath: '/mcp',
      req,
      res,
      options: { serverless: true },
    });
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error en MCP:`, error?.message || error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: error?.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`Olivia MCP Server corriendo en http://localhost:${PORT}/mcp`);
  console.log('Autenticación: Bearer token requerido');
  console.log('Health check: GET /health (sin auth)');
});
