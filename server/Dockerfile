FROM node:24.22.0-alpine AS web-build

WORKDIR /web

COPY wasm-page/package*.json ./
RUN npm install --global npm@12.2.0 && npm ci

COPY wasm-page ./
RUN npm run build:pages

FROM python:3.13-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/serve.py ./server/serve.py
COPY --from=web-build /web/dist/ppsspp-web ./wasm-page/dist/ppsspp-web

WORKDIR /app/server

EXPOSE 8081 27312

CMD ["python3", "serve.py", "--https", "--bind", "0.0.0.0", "--port", "8081", "--wasm-root", "/wasm", "--adhoc-ws"]
