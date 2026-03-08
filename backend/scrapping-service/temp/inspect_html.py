"""Inspects the real DOM of saved HTML files."""
import json
from bs4 import BeautifulSoup

# ── Amazon ────────────────────────────────────────────────────────────────────
print("=" * 60)
print("AMAZON")
print("=" * 60)
html = open("/tmp/dump_amazon.html").read()
soup = BeautifulSoup(html, "lxml")

results = soup.select("[data-component-type='s-search-result']")
print(f"Total [data-component-type='s-search-result']: {len(results)}")

for i, r in enumerate(results[:3]):
    asin = r.get("data-asin", "")
    classes = " ".join(r.get("class", []))
    print(f"\n  Result #{i}: asin={asin!r}, AdHolder={'AdHolder' in classes}")
    
    for sel in ["h2 a span", "h2 span", "[data-cy='title-recipe'] span", "h2 a"]:
        el = r.select_one(sel)
        val = el.get_text(strip=True)[:80] if el else None
        if val:
            print(f"    title[{sel!r}]: {val!r}")
            break
    
    for sel in [".a-price .a-offscreen", ".a-price-whole", "span.a-price"]:
        els = r.select(sel)
        if els:
            print(f"    price[{sel!r}]: {[e.get_text(strip=True) for e in els[:4]]}")

# ── MercadoLibre ──────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MERCADOLIBRE")
print("=" * 60)
html = open("/tmp/dump_mercadolibre.html").read()
soup = BeautifulSoup(html, "lxml")

for sel in [".ui-search-layout__item", ".poly-card", ".ui-search-result__wrapper", ".poly-component__title"]:
    els = soup.select(sel)
    print(f"  [{sel}]: {len(els)} elements")

# First card
card = soup.select_one(".ui-search-layout__item, .poly-card")
if card:
    print("\n  First card structure (tag, class, text):")
    for child in card.descendants:
        if hasattr(child, "get") and child.get_text(strip=True):
            txt = child.get_text(strip=True)[:50]
            cls = " ".join(child.get("class", []))[:40]
            if len(txt) > 3:
                print(f"    <{child.name} class={cls!r}>: {txt!r}")
            if len([x for x in card.descendants if hasattr(x, "get")]) > 50:
                break

# Wait selector check
for sel in ["h1.ui-pdp-title", "h1.poly-box", ".ui-search-layout__item", ".poly-card", ".poly-component__title", ".andes-card"]:
    els = soup.select(sel)
    print(f"  wait candidate [{sel}]: {len(els)}")

# ── Éxito ─────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("ÉXITO")
print("=" * 60)
html = open("/tmp/dump_exito.html").read()
soup = BeautifulSoup(html, "lxml")

# JSON-LD
scripts = soup.select('script[type="application/ld+json"]')
print(f"  JSON-LD scripts: {len(scripts)}")
for i, sc in enumerate(scripts):
    try:
        data = json.loads(sc.string or "")
        dtype = data.get("@type") if isinstance(data, dict) else type(data).__name__
        print(f"    [{i}] @type={dtype!r}, keys={list(data.keys())[:8] if isinstance(data, dict) else '?'}")
        if isinstance(data, dict) and data.get("@type") in ("Product", "ItemList"):
            print(f"         FULL: {json.dumps(data, ensure_ascii=False)[:500]}")
    except Exception as e:
        print(f"    [{i}] parse error: {e}")

# Structure for product cards
for sel in ["[class*='galleryItem']", "[class*='productCard']", "[class*='ProductCard']", "[class*='vtex-search-result']", "article"]:
    els = soup.select(sel)
    print(f"  [{sel}]: {len(els)}")

# h2 elements
for h2 in soup.select("h2")[:5]:
    cls = " ".join(h2.get("class", []))[:60]
    txt = h2.get_text(strip=True)[:80]
    print(f"  <h2 class={cls!r}>: {txt!r}")
