#!/usr/bin/env bash
set -euo pipefail

OUTPUT_CERT_PATH="${1:-./caddy-local-root.crt}"
SOURCE_CERT_PATH="/data/caddy/pki/authorities/local/root.crt"

TARGET_CA_PATH=""
UPDATE_CA_CMD=""

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

detect_ca_config() {
  local id=""
  local id_like=""

  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    id="${ID:-}"
    id_like="${ID_LIKE:-}"
  fi

  case "$id" in
    ubuntu|debian|linuxmint|pop)
      TARGET_CA_PATH="/usr/local/share/ca-certificates/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-certificates"
      return
      ;;
    fedora|rhel|centos|rocky|almalinux)
      TARGET_CA_PATH="/etc/pki/ca-trust/source/anchors/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-trust"
      return
      ;;
    arch|manjaro)
      TARGET_CA_PATH="/etc/ca-certificates/trust-source/anchors/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-trust"
      return
      ;;
  esac

  case "$id_like" in
    *debian*)
      TARGET_CA_PATH="/usr/local/share/ca-certificates/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-certificates"
      return
      ;;
    *rhel*|*fedora*)
      TARGET_CA_PATH="/etc/pki/ca-trust/source/anchors/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-trust"
      return
      ;;
    *arch*)
      TARGET_CA_PATH="/etc/ca-certificates/trust-source/anchors/caddy-local-root.crt"
      UPDATE_CA_CMD="update-ca-trust"
      return
      ;;
  esac

  # Fallback por disponibilidad de comandos
  if command -v update-ca-certificates >/dev/null 2>&1; then
    TARGET_CA_PATH="/usr/local/share/ca-certificates/caddy-local-root.crt"
    UPDATE_CA_CMD="update-ca-certificates"
    return
  fi

  if command -v update-ca-trust >/dev/null 2>&1; then
    if [[ -d /etc/pki/ca-trust/source/anchors ]]; then
      TARGET_CA_PATH="/etc/pki/ca-trust/source/anchors/caddy-local-root.crt"
    else
      TARGET_CA_PATH="/etc/ca-certificates/trust-source/anchors/caddy-local-root.crt"
    fi
    UPDATE_CA_CMD="update-ca-trust"
    return
  fi

  echo "Error: no se detecto un mecanismo de CA compatible (update-ca-certificates o update-ca-trust)." >&2
  exit 1
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

detect_ca_config
require_cmd "$UPDATE_CA_CMD"

echo "Store de CA detectado: $TARGET_CA_PATH"
echo "Comando de actualizacion: $UPDATE_CA_CMD"

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
sudo mkdir -p "$(dirname "$TARGET_CA_PATH")"
sudo cp "$OUTPUT_CERT_PATH" "$TARGET_CA_PATH"

if [[ "$UPDATE_CA_CMD" == "update-ca-trust" ]]; then
  sudo update-ca-trust extract
else
  sudo update-ca-certificates
fi

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