#!/usr/bin/env node
/**
 * Carga concurrente contra la API: conexiones SockJS + STOMP como prueba.html.
 * Cada usuario virtual envía una consulta con sufijo único para no reutilizar el mismo product_ref
 * (createProductRef deriva el ref del texto de la query).
 *
 * Uso:
 *   npm install
 *   node ws-load.mjs --users 4 --base http://localhost:8081 --query "iphone 12" --duration 120
 *
 * Opciones:
 *   --users N       Usuarios concurrentes (default 4)
 *   --base URL      Base de la API (default http://localhost:8081)
 *   --query TEXT    Texto base de búsqueda (default iphone 12)
 *   --duration SEC  Segundos antes de cerrar conexiones (default 120)
 *   --ramp MS       Retardo entre arranque de cada usuario (default 500)
 *   --quiet         Menos log por mensaje recibido
 */

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    users: 4,
    base: "http://localhost:8081",
    query: "iphone 12",
    durationSec: 120,
    rampMs: 500,
    quiet: false,
  };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--users") o.users = Math.max(1, parseInt(a[++i], 10) || 4);
    else if (a[i] === "--base") o.base = a[++i] || o.base;
    else if (a[i] === "--query") o.query = a[++i] || o.query;
    else if (a[i] === "--duration") o.durationSec = Math.max(5, parseInt(a[++i], 10) || 120);
    else if (a[i] === "--ramp") o.rampMs = Math.max(0, parseInt(a[++i], 10) || 500);
    else if (a[i] === "--quiet") o.quiet = true;
  }
  return o;
}

function runUser(userIndex, opts) {
  const wsUrl = opts.base.replace(/\/+$/, "") + "/ws";
  const uniqueQuery = `${opts.query} ld${userIndex}`;
  const stats = {
    userIndex,
    query: uniqueQuery,
    connected: false,
    products: 0,
    errors: 0,
    firstProductMs: null,
    connectError: null,
    t0: Date.now(),
  };

  return new Promise((resolve) => {
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 0,
      onConnect: () => {
        stats.connected = true;
        client.subscribe("/user/queue/products", (msg) => {
          stats.products += 1;
          if (stats.firstProductMs == null) {
            stats.firstProductMs = Date.now() - stats.t0;
          }
          if (!opts.quiet && stats.products <= 3) {
            console.log(`[u${userIndex}] producto #${stats.products} (${msg.body.length} bytes)`);
          }
        });
        client.subscribe("/user/queue/errors", () => {
          stats.errors += 1;
        });
        client.publish({
          destination: "/app/search",
          body: JSON.stringify({ query: uniqueQuery }),
        });
        console.log(`[u${userIndex}] búsqueda enviada: ${JSON.stringify({ query: uniqueQuery })}`);
      },
      onStompError: (frame) => {
        stats.connectError = frame.headers?.message || String(frame);
      },
      onWebSocketError: (e) => {
        stats.connectError = e?.message || String(e);
      },
    });

    client.activate();

    const shutdown = () => {
      try {
        client.deactivate();
      } catch (_) {}
      resolve(stats);
    };

    setTimeout(shutdown, opts.durationSec * 1000);
  });
}

async function main() {
  const opts = parseArgs();
  console.log("=== PriceTracker WS load ===");
  console.log(JSON.stringify(opts, null, 2));
  console.log("Observa recursos con: docker stats   (en otra terminal)\n");

  const runners = [];
  for (let i = 0; i < opts.users; i++) {
    const delay = i * opts.rampMs;
    runners.push(
      new Promise((resolve) => {
        setTimeout(() => {
          runUser(i, opts).then(resolve);
        }, delay);
      })
    );
  }

  const results = await Promise.all(runners);

  console.log("\n=== Resumen ===");
  let totalProducts = 0;
  let totalErrors = 0;
  let connected = 0;
  const firstTimes = [];
  for (const s of results) {
    totalProducts += s.products;
    totalErrors += s.errors;
    if (s.connected) connected += 1;
    if (s.firstProductMs != null) firstTimes.push(s.firstProductMs);
    if (s.connectError) {
      console.log(`[u${s.userIndex}] ERROR conexión/STOMP: ${s.connectError}`);
    }
  }
  console.log(`Usuarios con conexión OK: ${connected}/${opts.users}`);
  console.log(`Mensajes en /user/queue/products (total): ${totalProducts}`);
  console.log(`Mensajes en /user/queue/errors (total): ${totalErrors}`);
  if (firstTimes.length) {
    const min = Math.min(...firstTimes);
    const max = Math.max(...firstTimes);
    const avg = firstTimes.reduce((a, b) => a + b, 0) / firstTimes.length;
    console.log(`Tiempo hasta 1er producto (ms): min=${min.toFixed(0)} max=${max.toFixed(0)} avg=${avg.toFixed(0)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
