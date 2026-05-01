#!/usr/bin/env python3
"""
Pruebas automatizadas mínimas (humo + contrato) para PriceTracker.
No sustituyen pruebas unitarias ni E2E completas.

Requisito: desde la raíz del repo PriceTracker, con servicios arriba:
  docker compose up -d

Ejecución:
  python qa/smoke_tests.py

Variables de entorno opcionales:
  PRICETRACKER_API_BASE   (default http://127.0.0.1:8081)
  PRICETRACKER_MODEL_BASE (default http://127.0.0.1:8015)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class HttpResult:
    status: int
    body: str

    def json(self) -> Any | None:
        t = (self.body or "").strip()
        if not t:
            return None
        return json.loads(t)


def http_request(
    method: str,
    url: str,
    *,
    json_body: dict | None = None,
    timeout: float = 20.0,
) -> HttpResult:
    headers = {"Accept": "application/json"}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return HttpResult(status=resp.status, body=raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return HttpResult(status=e.code, body=raw)
    except Exception as e:
        return HttpResult(status=-1, body=str(e))


def main() -> int:
    api = os.environ.get("PRICETRACKER_API_BASE", "http://127.0.0.1:8081").rstrip("/")
    model = os.environ.get("PRICETRACKER_MODEL_BASE", "http://127.0.0.1:8015").rstrip("/")

    scraper_health = "http://127.0.0.1:8001/health"
    normalizer_health = "http://127.0.0.1:8002/health"

    failures: list[str] = []

    def run(name: str, ok: bool, detail: str = "") -> None:
        status = "OK" if ok else "FAIL"
        extra = f" — {detail}" if detail else ""
        print(f"[{status}] {name}{extra}")
        if not ok:
            failures.append(name)

    # --- HUMO-04 / API-MOD: modelo ---
    r = http_request("GET", f"{model}/")
    ok = r.status == 200 and isinstance(r.json(), dict) and r.json().get("status") == "ok"
    run("MODEL-GET / (HUMO-04)", ok, f"status={r.status}")

    r = http_request("POST", f"{model}/predict", json_body={"query": "comprar auriculares bluetooth"})
    j = r.json() if r.body else None
    ok = r.status == 200 and isinstance(j, dict) and "p_buy" in j and "label" in j
    run("MODEL-POST /predict (API-MOD-01)", ok, f"status={r.status}")

    # --- HUMO-02 / HUMO-03 ---
    r = http_request("GET", scraper_health)
    ok = r.status == 200
    run("SCRAPER GET /health (HUMO-02)", ok, f"status={r.status}")

    r = http_request("GET", normalizer_health)
    ok = r.status == 200
    run("NORMALIZER GET /health (HUMO-03)", ok, f"status={r.status}")

    # --- HUMO-01: actuator (Spring puede usar /actuator/health o prefijo /api) ---
    actuator_ok = False
    actuator_detail = ""
    for path in (f"{api}/actuator/health", f"{api}/api/actuator/health"):
        r = http_request("GET", path)
        if r.status != 200:
            actuator_detail = f"last status={r.status} url={path}"
            continue
        try:
            data = r.json()
        except json.JSONDecodeError:
            actuator_detail = f"non-json body from {path}"
            continue
        if isinstance(data, dict):
            st = data.get("status")
            if st == "UP" or (isinstance(st, dict) and st.get("status") == "UP"):
                actuator_ok = True
                actuator_detail = path
                break
        actuator_detail = f"unexpected json from {path}"
    run("API GET actuator/health (HUMO-01)", actuator_ok, actuator_detail)

    # --- API-J-01: intent vía API Java -> model-product ---
    r = http_request("POST", f"{api}/api/intent/intent", json_body={"query": "quiero comprar una laptop"})
    j = r.json() if r.body else None
    ok = r.status == 200 and isinstance(j, dict) and "label" in j and "input" in j
    run("API POST /api/intent/intent (API-J-01)", ok, f"status={r.status} body[:120]={r.body[:120]!r}")

    # --- API-J-05: búsqueda por product_ref (puede devolver lista vacía) ---
    r = http_request(
        "POST",
        f"{api}/api/products/search",
        json_body={"product_ref": "smoke-test-nonexistent-ref-xyz"},
    )
    ok = r.status == 200
    if ok and r.body.strip():
        try:
            parsed = r.json()
            ok = isinstance(parsed, list)
        except json.JSONDecodeError:
            ok = False
    run("API POST /api/products/search (API-J-05)", ok, f"status={r.status}")

    # --- API-J-08: endpoint de prueba WS ---
    r = http_request("GET", f"{api}/test-ws")
    ok = r.status == 200 and r.body.strip() == "ok"
    run("API GET /test-ws (API-J-08)", ok, f"status={r.status}")

    if failures:
        print(f"\nFallaron {len(failures)} prueba(s): {', '.join(failures)}")
        return 1
    print("\nTodas las pruebas de humo/contrato pasaron.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
