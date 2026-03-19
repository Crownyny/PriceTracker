#!/usr/bin/env bash
set -euo pipefail

OUTPUT_CERT_PATH="${1:-./caddy-local-root.crt}"
TARGET_CA_PATH="/usr/local/share/ca-certificates/caddy-local-root.crt"
SOURCE_CERT_PATH="/data/caddy/pki/authorities/local/root.crt"

step() {
  echo
  echo "==> $1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: command not found: $1" >&2
    exit 1
  fi
}

resolve_caddy_container() {
  local exact_name="pricetracker-caddy"
  if docker ps --format '{{.Names}}' | grep -Fxq "$exact_name"; then
    echo "$exact_name"
    return
  fi

  local any_name
  any_name="$(docker ps --format '{{.Names}}' | grep 'caddy' | head -n1 || true)"
  if [[ -n "$any_name" ]]; then
    echo "$any_name"
    return
  fi

  echo ""
}

step "Verificando dependencias"
require_cmd docker
require_cmd sudo
require_cmd cp

if ! command -v curl >/dev/null 2>&1; then
  echo "Aviso: curl no esta instalado. Se omitira la validacion final por HTTPs."
fi

if ! command -v update-ca-certificates >/dev/null 2>&1; then
  echo "Error: update-ca-certificates no esta disponible. Este script soporta Debian/Ubuntu." >&2
  exit 1
fi

step "Buscando contenedor de Caddy"
CONTAINER_NAME="$(resolve_caddy_container)"

if [[ -z "$CONTAINER_NAME" ]]; then
  echo "No se encontro Caddy activo. Intentando levantarlo con docker compose..."
  docker compose up -d caddy
  sleep 2
  CONTAINER_NAME="$(resolve_caddy_container)"
fi

if [[ -z "$CONTAINER_NAME" ]]; then
  echo "Error: no fue posible detectar el contenedor de Caddy." >&2
  echo "Ejecuta: docker compose up -d caddy" >&2
  exit 1
fi

echo "Contenedor detectado: $CONTAINER_NAME"

step "Extrayendo certificado raiz desde el contenedor"
docker cp "${CONTAINER_NAME}:${SOURCE_CERT_PATH}" "$OUTPUT_CERT_PATH"

if [[ ! -f "$OUTPUT_CERT_PATH" ]]; then
  echo "Error: no se pudo extraer el certificado en $OUTPUT_CERT_PATH" >&2
  exit 1
fi

step "Instalando certificado en el store local del sistema"
sudo cp "$OUTPUT_CERT_PATH" "$TARGET_CA_PATH"
sudo update-ca-certificates

step "Validando endpoint HTTPS"
if command -v curl >/dev/null 2>&1; then
  STATUS_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://localhost:8443/ws/info || true)"
  if [[ "$STATUS_CODE" == "200" ]]; then
    echo "OK: https://localhost:8443/ws/info responde 200"
  else
    echo "Aviso: no fue posible validar /ws/info automaticamente (codigo: $STATUS_CODE)."
  fi
fi

echo
echo "Listo. Recarga la extension en Chrome y vuelve a probar."