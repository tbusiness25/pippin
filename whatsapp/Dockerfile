FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY sidecar.js ./
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "sidecar.js"]
