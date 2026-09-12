FROM node:24.14.1-bookworm-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24.14.1-bookworm-slim
WORKDIR /app
COPY server ./server
COPY --from=frontend /app/public/site-assets ./public/site-assets
COPY --from=frontend /app/dist ./dist
ENV NODE_ENV=production PORT=10000
RUN useradd --system --uid 10001 appuser
USER appuser
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
