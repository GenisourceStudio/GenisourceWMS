# Build the SPA, then serve it from Nginx which also proxies the API.
FROM node:22-alpine AS build

# Registry can be overridden for mainland China (e.g. https://registry.npmmirror.com).
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
# Docker Desktop injects HTTP(S)_PROXY build args from ~/.docker/config.json into
# every RUN. Injected args win over Dockerfile ENV, so clear them per command:
# that LAN proxy is unreachable from the build network, while the npm registry
# is directly reachable (Maven already resolves dependencies directly).
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy \
        npm_config_proxy npm_config_https_proxy; \
    npm install -g pnpm@10.32.1 --registry=${NPM_REGISTRY}

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy \
        npm_config_proxy npm_config_https_proxy; \
    pnpm config set registry ${NPM_REGISTRY} && pnpm install --frozen-lockfile

COPY frontend/ ./
# `pnpm build` = `tsc --noEmit && vite build`; keep the repository's strict
# tsconfig (noUnusedLocals/noUnusedParameters) in force inside the image too.
RUN pnpm build

FROM nginx:stable-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
