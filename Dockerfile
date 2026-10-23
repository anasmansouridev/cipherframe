# Builds the site and serves it with nginx. EasyPanel: App -> Build: Dockerfile, proxy port 80.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `npm run build` typechecks, builds into dist/ and enforces the size budgets.
RUN npm run build \
 && mkdir -p /out \
 && node scripts/headers-to-nginx.mjs dist/_headers /out/security-headers.conf \
 && rm dist/_headers

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
