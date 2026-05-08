#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
LIMIT="${2:-20}"

echo "[1/5] Scraping status"
curl -sS "${BASE_URL}/api/internal/test/scraping/status?limit=${LIMIT}" | cat

echo
echo "[2/5] Trigger scraping daemon"
curl -sS -X POST "${BASE_URL}/api/internal/test/scraping/trigger" | cat

echo
echo "[3/5] Trigger volatility recompute"
curl -sS -X POST "${BASE_URL}/api/internal/test/scraping/volatility-trigger" | cat

echo
echo "[4/5] Email alerts status"
curl -sS "${BASE_URL}/api/internal/test/email/alerts-status" | cat

echo
echo "[5/5] Trigger email daemon"
curl -sS -X POST "${BASE_URL}/api/internal/test/email/trigger" | cat

echo
echo "Completed. Base URL: ${BASE_URL}"
