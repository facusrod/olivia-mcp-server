#!/bin/bash
export PATH="/Users/facu/.nvm/versions/node/v22.22.0/bin:$PATH"
exec npx -y mcp-remote "$@"
