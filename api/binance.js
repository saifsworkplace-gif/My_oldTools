// api/binance.js (ESM with multi-host failover + dry-run)
const MAP = {
  klines: "api/v3/klines",
  ticker24hr: "api/v3/ticker/24hr",
  price: "api/v3/ticker/price",
};

// Multiple Binance hosts to dodge regional blocks / edge quirks
const HOSTS = [
  "https://api4.binance.com/",
  "https://api1.binance.com/",
  "https://api2.binance.com/",
  "https://api3.binance.com/",
  "https://api.binance.com/",
  "https://data-api.binance.vision/"
];

function okOrigin() { return "*"; }

export default async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", okOrigin());
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    // Parse query (with dry-run)
    const q = req.query || {};
    const endpoint = q.endpoint;
    const dry = q.dry === "1";
    const params = {};
    for (const k in q) {
      if (Object.prototype.hasOwnProperty.call(q, k) && k !== "endpoint" && k !== "dry") {
        params[k] = q[k];
      }
    }

    if (!endpoint || !MAP[endpoint]) {
      return res.status(400).json({
        error: "Invalid endpoint",
        allowed: Object.keys(MAP),
        example: "/api/binance?endpoint=klines&symbol=BTCUSDT&interval=1d&limit=500",
      });
    }

    const buildUrl = (host) => {
      const url = new URL(MAP[endpoint], host);
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
        else if (v !== undefined) url.searchParams.set(k, v);
      }
      return url.toString();
    };

    // Dry-run: return the composed URLs (no fetch)
    if (dry) {
      return res.status(200).json({ dry: true, urls: HOSTS.map(buildUrl) });
    }

    const headers = {};
    if (process.env.BINANCE_API_KEY) headers["X-MBX-APIKEY"] = process.env.BINANCE_API_KEY;

    // Try hosts in order until one succeeds
    let lastErr = null;
    for (const host of HOSTS) {
      try {
        const target = buildUrl(host);
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 12000);
        const r = await fetch(target, { headers, signal: ac.signal, redirect: "follow" });
        clearTimeout(t);

        if (!r.ok) {
          const body = await r.text();
          // Geo-blocks (451/403) → try next host
          if (r.status === 451 || r.status === 403) {
            lastErr = { status: r.status, host, body: body.slice(0, 400) };
            continue;
          }
          return res.status(r.status).json({
            error: "Upstream error",
            status: r.status,
            host,
            body: body.slice(0, 1000)
          });
        }

        const data = await r.json();
        return res.status(200).json(data);
      } catch (e) {
        // network/timeout → try next host
        lastErr = { host, details: String(e) };
        continue;
      }
    }

    // If all hosts failed
    return res.status(502).json({ error: "All Binance hosts failed", lastErr });
  } catch (e) {
    return res.status(500).json({ error: "Proxy failure", details: String(e) });
  }
}
