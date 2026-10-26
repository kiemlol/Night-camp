# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --omit=dev; \
    else npm ci --omit=dev; fi
COPY server/src ./src
COPY server/public ./public
COPY server/data-catalog ./data-catalog
COPY dist /client
COPY dist-full /client-full
ENV HOST=0.0.0.0 PORT=7350 DATA_DIR=/app/data CLIENT_DIR=/client FULL_CLIENT_DIR=/client-full
EXPOSE 7350
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:7350/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
