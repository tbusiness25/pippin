FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY public ./public
COPY library ./library
ARG SW_VERSION=dev
ENV SW_VERSION=${SW_VERSION}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 CMD curl -fs http://localhost:8080/api/health || exit 1
CMD ["node", "server.js"]
