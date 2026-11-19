FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
USER root
# A imagem base ainda não foi reconstruída com os patches mais recentes do Alpine (CVEs em
# brotli-libs, curl, libexpat, libxslt, musl, zlib); apk upgrade pega os pacotes já corrigidos.
RUN apk --no-cache upgrade
USER 101
LABEL org.opencontainers.image.source="https://github.com/suri-tecnologia/site-suri"
LABEL org.opencontainers.image.description="Site da SURI Tecnologia (HTML estático)"
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
