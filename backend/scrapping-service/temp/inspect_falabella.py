"""Inspecciona la estructura DOM de un card de Falabella desde el HTML guardado.

Requiere haber ejecutado dump_html.py primero para tener /tmp/dump_falabella.html

    python temp/inspect_falabella.py
"""
from pathlib import Path
from bs4 import BeautifulSoup

HTML_FILE = Path("/tmp/dump_falabella.html")

if not HTML_FILE.exists():
    print(f"Archivo no encontrado: {HTML_FILE}")
    print("Ejecuta primero: python temp/dump_html.py")
    raise SystemExit(1)

soup = BeautifulSoup(HTML_FILE.read_text(encoding="utf-8"), "lxml")

# ── Contar cards ────────────────────────────────────────────────────────────
cards = soup.select("[data-pod]")
print(f"\nTotal cards [data-pod]: {len(cards)}")

if not cards:
    print("Sin cards. Posibles selectores alternativos:")
    for sel in ["[class*='pod']", "[class*='product']", "[class*='results']"]:
        found = soup.select(sel)
        print(f"  {sel!r}: {len(found)}")
    raise SystemExit(0)

# ── Inspeccionar el primer card ─────────────────────────────────────────────
card = cards[0]
print("\n── PRIMER CARD ──────────────────────────────────────────────────────")
print(f"Clases del card: {card.get('class')}")

# Link con atributo title
link = card.select_one("a[title]")
print(f"\na[title] → {link.get('title') if link else 'NO ENCONTRADO'}")

# Título marca
for sel in ["b.pod-title", "[class*='pod-title']"]:
    el = card.select_one(sel)
    print(f"{sel!r} → {el.get_text(strip=True) if el else 'NO ENCONTRADO'}")

# Subtítulo / modelo
for sel in ["b.pod-subTitle", "[class*='pod-subTitle']", "[class*='pod-subtitle']"]:
    el = card.select_one(sel)
    print(f"{sel!r} → {el.get_text(strip=True) if el else 'NO ENCONTRADO'}")

# Precio
for sel in ["li.prices-0 span.copy7", "li.prices-0", "[class*='prices-0']", "[class*='price']"]:
    el = card.select_one(sel)
    print(f"{sel!r} → {el.get_text(strip=True) if el else 'NO ENCONTRADO'}")

# Imagen
for sel in ["picture img", "img[src*='falabella']", "img[src*='sodimac']", "img"]:
    el = card.select_one(sel)
    src = (el.get("src") or el.get("data-src")) if el else None
    print(f"{sel!r} → {src if src else 'NO ENCONTRADO'}")

# Descripción / features
for sel in ["[class*='pod-features']", "[class*='pod-details']", "ul.pod-features"]:
    el = card.select_one(sel)
    print(f"{sel!r} → {el.get_text(' ', strip=True)[:120] if el else 'NO ENCONTRADO'}")

# ── Todos los textos del card (para descubrir selectores) ───────────────────
print("\n── TEXTOS DEL CARD (para descubrir selectores) ──────────────────────")
for tag in card.find_all(["b", "span", "p", "li", "a"]):
    t = tag.get_text(strip=True)
    cls = " ".join(tag.get("class", []))[:60]
    if t and len(t) > 2:
        print(f"  <{tag.name} class='{cls}'> → {t[:80]!r}")
