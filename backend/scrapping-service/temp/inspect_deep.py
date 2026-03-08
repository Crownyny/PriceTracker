"""
Inspección profunda del DOM de cada fuente a partir de los HTML guardados por dump_html.py.
Ejecutar desde scrapping-service/:
    conda run -n SCRAPPING python temp/inspect_deep.py 2>/dev/null
"""
from bs4 import BeautifulSoup
import json


def section(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def txt(el, default="NONE"):
    return el.get_text(strip=True) if el else default


def src(el, attr="src", default="NONE"):
    return el.get(attr, default) if el else default


# ── AMAZON ────────────────────────────────────────────────────────────────────
section("AMAZON — primer resultado con precio")
soup = BeautifulSoup(open("/tmp/dump_amazon.html").read(), "lxml")
for r in soup.select("[data-component-type='s-search-result']"):
    asin = r.get("data-asin", "").strip()
    if not asin or "AdHolder" in " ".join(r.get("class", [])):
        continue
    price_el = r.select_one(".a-price .a-offscreen")
    if not price_el:
        continue
    print("asin:", asin)
    for sel in ["h2 span", "h2 a span", "h2 .a-text-normal"]:
        print("  title [" + sel + "]:", txt(r.select_one(sel))[:80])
    print("  price (.a-price .a-offscreen):", repr(txt(price_el)))
    symbol = r.select_one("span.a-price-symbol")
    print("  currency symbol:", repr(txt(symbol)))
    img = r.select_one("img.s-image")
    print("  image:", src(img)[:70])
    break

section("AMAZON — primeros 3 resultados (asin + title + precio)")
for r in soup.select("[data-component-type='s-search-result']")[:4]:
    asin = r.get("data-asin", "").strip()
    price_el = r.select_one(".a-price .a-offscreen")
    title_el = r.select_one("h2 span")
    price_txt = txt(price_el, "NO-PRICE")
    title_txt = txt(title_el, "NO-TITLE")[:60]
    print("  asin=" + asin + " | price=" + price_txt + " | title=" + title_txt)

# ── MERCADOLIBRE ──────────────────────────────────────────────────────────────
section("MERCADOLIBRE — primer card de producto")
soup = BeautifulSoup(open("/tmp/dump_mercadolibre.html").read(), "lxml")

card = soup.select_one(".ui-search-layout__item")
if card:
    for sel in [
        "a.poly-component__title",
        "h3.poly-component__title-wrapper a",
        ".poly-component__title",
    ]:
        print("  title [" + sel + "]:", txt(card.select_one(sel))[:80])

    for sel in [
        ".poly-price__current .andes-money-amount__fraction",
        ".poly-component__price .andes-money-amount__fraction",
        ".andes-money-amount__fraction",
    ]:
        print("  price [" + sel + "]:", txt(card.select_one(sel)))

    curr = card.select_one("span.andes-money-amount__currency-symbol")
    print("  currency:", txt(curr))

    for sel in [".poly-component__picture img", "img"]:
        img = card.select_one(sel)
        if img:
            print("  image [" + sel + "]:", src(img)[:80])
            break

# ── ÉXITO ─────────────────────────────────────────────────────────────────────
section("ÉXITO — JSON-LD scripts")
soup = BeautifulSoup(open("/tmp/dump_exito.html").read(), "lxml")
for i, sc in enumerate(soup.select('script[type="application/ld+json"]')):
    try:
        data = json.loads(sc.string or "")
        dtype = data.get("@type") if isinstance(data, dict) else "?"
        print("  [" + str(i) + "] @type=" + str(dtype))
        print("      ", json.dumps(data, ensure_ascii=False)[:300])
    except Exception as e:
        print("  [" + str(i) + "] error:", e)

section("ÉXITO — primer productCard (descendientes con texto)")
cards = soup.select("[class*='productCard']")
print("productCard count:", len(cards))
if cards:
    c = cards[0]
    print("Card outer classes:", " ".join(c.get("class", []))[:100])
    seen = set()
    count = 0
    for el in c.descendants:
        if not hasattr(el, "name") or not el.name:
            continue
        if el.name in {"script", "style", "noscript"}:
            continue
        t = el.get_text(strip=True)
        if not t or len(t) < 3 or t in seen:
            continue
        seen.add(t)
        cls = " ".join(el.get("class", []))[:70]
        print("  <" + el.name + " class='" + cls + "'>  ->  " + t[:80])
        count += 1
        if count > 30:
            break

section("ÉXITO — selectores candidatos para precio y titulo")
for sel in [
    "h3", "h2",
    "[class*='sellingPrice']",
    "[class*='price__selling']",
    "[class*='currencyContainer']",
    "[class*='Price']",
    "[class*='productName']",
    "[class*='ProductName']",
    "[class*='product-title']",
    "[class*='productTitle']",
    "[class*='name']",
]:
    in_card = soup.select("[class*='productCard'] " + sel)
    out = soup.select(sel)
    found = in_card if in_card else out
    if found:
        sample = found[0].get_text(strip=True)[:60]
        note = "(in card)" if in_card else "(global)"
        print("  " + note + " [" + sel + "] (" + str(len(found)) + "): " + repr(sample))
