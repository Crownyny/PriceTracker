"""Fuente: Mango Colombia (shop.mango.com/co/es).

Mango Colombia usa Next.js App Router (SSR) con Akamai Bot Manager.
Playwright headless recibe 403 directamente; el bypass se hace mediante
curl-cffi con impersonación Chrome120, que sí obtiene respuesta 200.

Estrategia (marzo 2026):
  - build_url retorna la URL canónica de búsqueda femenina con ?q=<query>.
    El sitio no tiene un buscador de género neutral; se consultan mujer y
    hombre en extract_all_results para obtener resultados amplios.
  - wait_for_selector: None  (Playwright navega pero el HTML que devuelve
    es un 403 de Akamai, ignorado completamente en extract_all_results).
  - extract_all_results:
      1. Consulta /co/es/search/mujer?q=<q> y /co/es/search/hombre?q=<q>
         con curl-cffi Session (impersonate="chrome120").
      2. Parsea el payload RSC (Next.js __next_f.push) extrayendo el array
         "catalogItemsData" → [{productId, colorGroup, price, onSale}, …].
      3. Llama a online-orchestrator.mango.com/v4/products para cada PID
         en paralelo con ThreadPoolExecutor (20 workers), obteniendo
         nombre, URL canónica e imagen de portada.

Campos resultantes:
  title, url, price (COP int string), on_sale (bool),
  image_url, source, query
"""
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlparse

from shared.model import ScrapingJob

from ..base import BaseSource
from ..registry import registry

logger = logging.getLogger(__name__)

_BASE = "https://shop.mango.com"
_ORCH = "https://online-orchestrator.mango.com"
_COUNTRY = "CO"
_LANG = "es"

_SITE_HEADERS = {
    "Accept-Language": f"{_LANG}-{_COUNTRY},{_LANG};q=0.9",
    "Accept": "text/html,*/*",
    "Referer": f"{_BASE}/co/es",
}
_ORCH_HEADERS = {
    "Accept": "application/json",
    "Origin": _BASE,
    "Referer": f"{_BASE}/co/es/search/mujer",
    "Accept-Language": f"{_LANG}-{_COUNTRY},{_LANG};q=0.9",
}

_ORCH_WORKERS = 20  # parallel requests al orquestador


def _get_cffi_session():
    """Importación diferida de curl-cffi para evitar fallos si no está instalado."""
    try:
        from curl_cffi.requests import Session
        return Session(impersonate="chrome120")
    except ImportError as e:
        raise RuntimeError("curl-cffi no está instalado") from e


def _parse_catalog(html: str) -> list[dict]:
    """Extrae catalogItemsData del payload RSC de Next.js.
    
    Returns: lista de {productId, colorGroup, price, onSale}
    """
    # Los chunks RSC llegan como: self.__next_f.push([1,"<escaped JSON string>"])
    chunks = re.findall(r'self\.__next_f\.push\(\[1,(".*?")\]\)', html, re.DOTALL)
    text = ""
    for chunk in chunks:
        try:
            text += json.loads(chunk) + "\n"
        except Exception:
            pass

    m = re.search(
        r'"catalogItemsData":\s*'
        r'(\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\])',
        text,
    )
    if not m:
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return []


def _fetch_detail(pid: str, color: str) -> dict | None:
    """Llama al orquestador y devuelve {id, name, url, image_url}."""
    try:
        with _get_cffi_session() as s:
            url = (
                f"{_ORCH}/v4/products"
                f"?channelId=shop&countryIso={_COUNTRY}&languageIso={_LANG}"
                f"&productId={pid}"
            )
            r = s.get(url, headers=_ORCH_HEADERS, timeout=10)
            if r.status_code != 200:
                return None
            data = r.json()

        # Imagen: buscar color coincidente (colorGroup) o usar el primero
        img = ""
        colors = data.get("colors", [])
        target = next((c for c in colors if c.get("id") == color), None)
        if not target and colors:
            target = colors[0]
        if target:
            looks = target.get("looks", {})
            look = looks.get("00") or (list(looks.values())[0] if looks else {})
            imgs = look.get("images", {})
            main = imgs.get("F") or imgs.get("B") or (list(imgs.values())[0] if imgs else {})
            if main:
                img = data.get("assetsDomain", _BASE) + main.get("img", "")

        return {
            "id": pid,
            "name": data.get("name", ""),
            "url": _BASE + data.get("url", ""),
            "image_url": img,
        }
    except Exception as exc:
        logger.debug("[mango] Error orquestador para %s: %s", pid, exc)
        return None


class MangoSource(BaseSource):
    """
    Fuente Mango Colombia usando curl-cffi (Chrome120) + orquestador REST.
    No usa el HTML entregado por Playwright; hace sus propias peticiones HTTP.
    """

    @property
    def source_name(self) -> str:
        return "mango"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Playwright llega a un 403 de Akamai; no esperamos nada del DOM.
        return None

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        """URL canónica — usada sólo como raw_url y para extraer la query."""
        return f"{_BASE}/co/es/search/mujer?q={quote(query, safe='')}"

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        """Ignora html_content; obtiene datos via curl-cffi + orquestador."""
        # ── Extraer query desde source_url ────────────────────────────────
        parsed = urlparse(job.source_url)
        query = parse_qs(parsed.query).get("q", [""])[0]
        if not query:
            logger.warning("[mango] No se pudo extraer query de %s", job.source_url)
            return []

        # ── Paso 1: obtener catalogItemsData de mujer + hombre ─────────────
        catalog_by_pid: dict[str, dict] = {}
        genders = [("mujer", "mujer"), ("hombre", "hombre")]
        for _, gender in genders:
            url = f"{_BASE}/co/es/search/{gender}?q={quote(query, safe='')}"
            try:
                with _get_cffi_session() as s:
                    resp = s.get(url, headers=_SITE_HEADERS, timeout=15)
                items = _parse_catalog(resp.text)
                for item in items:
                    pid = str(item.get("productId", ""))
                    if pid and pid not in catalog_by_pid:
                        catalog_by_pid[pid] = {
                            "price": item.get("price"),
                            "on_sale": item.get("onSale", False),
                            "color": item.get("colorGroup", ""),
                        }
            except Exception as exc:
                logger.warning("[mango] Error cargando %s: %s", gender, exc)

        if not catalog_by_pid:
            logger.warning("[mango] Sin resultados en catalogItemsData para '%s'", query)
            return []

        logger.debug("[mango] %d PIDs únicos para '%s'", len(catalog_by_pid), query)

        # ── Paso 2: detalles por PID via orquestador (paralelo) ────────────
        details: dict[str, dict] = {}
        with ThreadPoolExecutor(max_workers=_ORCH_WORKERS) as pool:
            future_to_pid = {
                pool.submit(_fetch_detail, pid, info["color"]): pid
                for pid, info in catalog_by_pid.items()
            }
            for future in as_completed(future_to_pid):
                pid = future_to_pid[future]
                try:
                    result = future.result()
                    if result:
                        details[pid] = result
                except Exception as exc:
                    logger.debug("[mango] Future error para %s: %s", pid, exc)

        # ── Combinar catálogo + detalles ────────────────────────────────────
        results: list[dict[str, Any]] = []
        for pid, info in catalog_by_pid.items():
            detail = details.get(pid)
            if not detail or not detail.get("name"):
                continue
            result: dict[str, Any] = {
                "title": detail["name"],
                "url": detail["url"],
                "price": str(info["price"]) if info.get("price") is not None else None,
                "on_sale": info["on_sale"],
                "source": self.source_name,
                "query": query,
            }
            if detail.get("image_url"):
                result["image_url"] = detail["image_url"]
            results.append(result)

        logger.info("[mango] %d productos extraídos para '%s'", len(results), query)
        return results


registry.register(MangoSource())
