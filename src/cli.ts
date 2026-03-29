#!/usr/bin/env node

// CRÍTICO: En modo stdio, NADA puede ir a stdout excepto JSON-RPC.
// Interceptar stdout.write ANTES de importar cualquier módulo.
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, ...args: any[]): boolean => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  // Solo dejar pasar JSON (mensajes MCP)
  if (str.trimStart().startsWith('{') || str.trimStart().startsWith('\n')) {
    return (originalWrite as any)(chunk, ...args);
  }
  // Redirigir todo lo demás a stderr
  process.stderr.write(chunk, ...args as any);
  return true;
};

const { mcpServer } = await import('./mastra/index.js');
await mcpServer.startStdio();

export {};
