FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY packed-assets ./packed-assets
COPY public ./public
COPY 资料 ./资料
RUN npm ci --omit=dev --ignore-scripts && node scripts/restore-assets.mjs
COPY server.mjs web-search.mjs ./
ENV HOST=0.0.0.0 PORT=4173
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
