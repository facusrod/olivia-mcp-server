FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/server.js"]
