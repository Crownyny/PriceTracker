"""
Descarga el HTML renderizado de cada fuente y lo guarda en /tmp/ para inspección.
No tiene dependencias de RabbitMQ.

    python dump_html.py "samsung galaxy s24"
"""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.async_api import async_playwright

URLS = {
    "amazon":       "https://www.amazon.com/s?k=samsung+galaxy+s24",
    "mercadolibre": "https://listado.mercadolibre.com.co/samsung+galaxy+s24",
    "exito":        "https://www.exito.com/s?q=samsung+galaxy+s24",
}
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

WAIT_SELECTORS = {
    "amazon":       "div.s-main-slot",
    "mercadolibre": ".ui-search-layout__item, .poly-card",
    "exito":        "[class*='galleryItem'], [class*='productCard']",
}

async def dump(name, url, wait_sel):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx = await browser.new_context(user_agent=UA, locale="es-CO", timezone_id="America/Bogota")
        page = await ctx.new_page()
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        try:
            await page.wait_for_selector(wait_sel, timeout=12_000)
        except Exception as e:
            print(f"[{name}] timeout waiting for selector: {e}")
        html = await page.content()
        await browser.close()
        out = Path(f"/tmp/dump_{name}.html")
        out.write_text(html, encoding="utf-8")
        print(f"[{name}] saved {len(html):,} bytes → {out}")

async def main():
    await asyncio.gather(*[dump(n, u, WAIT_SELECTORS[n]) for n, u in URLS.items()])

asyncio.run(main())
