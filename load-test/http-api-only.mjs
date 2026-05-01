/**
 * Solo estresa HTTP de la API (no dispara scraping vía WebSocket).
 * Útil para ver CPU/memoria del contenedor `api` sin cargar normalizer/scraper.
 *
 * Uso:
 *   node http-api-only.mjs --url http://localhost:8081/actuator/health --concurrency 20 --duration 30
 *
 * Requiere que el actuator esté expuesto (ruta puede variar: /actuator/health o /api/actuator/health).
 */

const DEFAULT_URL = "http://localhost:8081/actuator/health";

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { url: DEFAULT_URL, concurrency: 20, durationSec: 30 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--url") o.url = a[++i] || o.url;
    if (a[i] === "--concurrency") o.concurrency = Math.max(1, parseInt(a[++i], 10) || 20);
    if (a[i] === "--duration") o.durationSec = Math.max(1, parseInt(a[++i], 10) || 30);
  }
  return o;
}

async function main() {
  const opts = parseArgs();
  const end = Date.now() + opts.durationSec * 1000;
  let ok = 0;
  let fail = 0;

  async function worker() {
    while (Date.now() < end) {
      try {
        const r = await fetch(opts.url, { method: "GET" });
        if (r.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
  }

  console.log(`HTTP load: ${opts.url} | ${opts.concurrency} workers | ${opts.durationSec}s`);
  await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));
  console.log(`OK: ${ok}  FAIL: ${fail}`);
}

main().catch(console.error);
