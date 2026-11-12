#!/usr/bin/env bash
# Sobe a imagem do site com as mesmas restrições de produção e confere rotas e redirecionamento.
# Uso: scripts/smoke-container.sh <imagem> <slug-do-app>
set -euo pipefail
IMAGEM="${1:?uso: smoke-container.sh <imagem> <slug-do-app>}"
SLUG="${2:?uso: smoke-container.sh <imagem> <slug-do-app>}"
NOME="smoke-site-suri-$$"
BASE="http://127.0.0.1:18080"

docker run -d --name "$NOME" --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --tmpfs /tmp --tmpfs /var/cache/nginx -p 127.0.0.1:18080:8080 "$IMAGEM" >/dev/null
trap 'docker logs "$NOME" >&2 || true; docker rm -f "$NOME" >/dev/null' EXIT

for _ in $(seq 1 30); do curl -fs "$BASE/healthz" >/dev/null && break; sleep 1; done

falhas=0
confere() { # <rota> <código esperado>
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$codigo" = "$2" ]; then echo "ok    $1 → $codigo"; else echo "FALHA $1 → $codigo (esperado $2)"; falhas=$((falhas + 1)); fi
}

confere / 200
confere "/apps/$SLUG/" 200
confere "/apps/$SLUG/privacidade/" 200
confere "/apps/$SLUG/privacidade/v1.0/" 200
confere "/apps/$SLUG/suporte/" 200
confere "/apps/$SLUG/excluir-dados/" 200
confere /privacidade/ 200
confere /lgpd/ 200
confere /favicon.svg 200
confere /nao-existe 404
confere "/apps/$SLUG/privacidade" 301

destino=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/apps/$SLUG/privacidade")
if [ "$destino" = "$BASE/apps/$SLUG/privacidade/" ]; then
  echo "ok    redirecionamento mantém host e porta → $destino"
else
  echo "FALHA redirecionamento foi para $destino (vazou porta ou host interno?)"; falhas=$((falhas + 1))
fi

[ "$falhas" -eq 0 ] || { echo "$falhas falha(s)"; exit 1; }
echo "smoke do container: ok"
