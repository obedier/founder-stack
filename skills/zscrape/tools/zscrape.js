#!/usr/bin/env node
/**
 * zscrape — cost-efficient Zyte API scraper.
 *
 * Zyte API automatically avoids bans (rotating/residential IPs, anti-bot
 * bypass) and can render JavaScript, but you pay per SUCCESSFUL response and
 * browser rendering costs multiples of a plain HTTP request. This CLI is built
 * around one rule: use the CHEAPEST mode that actually returns the content, and
 * only escalate when the cheap mode comes back empty.
 *
 * Cost ladder (cheapest → most expensive):
 *   1. httpResponseBody  — plain HTTP fetch through Zyte's proxy network
 *   2. browserHtml       — headless browser + JS execution (several × the cost)
 *   3. screenshot / automatic extraction — add-on cost on top of a browser req
 *
 * Only Zyte-successful responses are billed. Bans / 429s / target 4xx-5xx are
 * free, so retrying and escalating costs nothing until something actually works.
 *
 * Zero dependencies. Node 18+ (uses global fetch). Reads ZYTE_API_KEY from env
 * (or ZYTE_API_KEY_ALT with --key-alt).
 *
 * Usage:
 *   node zscrape.js <url> [options]
 *
 *   --mode=auto|http|browser   default: auto (http, escalate to browser if empty)
 *   --screenshot[=file.png]    capture screenshot (forces browser)
 *   --extract=product|article|productList|serp   Zyte automatic extraction (JSON)
 *   --geo=US                   geolocation country code (anti-ban / localized)
 *   --headers="K: V; K2: V2"   extra request headers (http mode)
 *   --actions='[{...}]'        browser actions JSON (forces browser)
 *   --out=file                 write primary output to file (default: stdout)
 *   --json                     print the full raw Zyte JSON response
 *   --key-alt                  use ZYTE_API_KEY_ALT instead of ZYTE_API_KEY
 *   --dry-run                  print the request that WOULD be sent, don't call
 *
 * Examples:
 *   node zscrape.js https://toscrape.com                 # cheap HTTP, auto-escalates
 *   node zscrape.js https://example.com --mode=http      # force cheapest, never escalate
 *   node zscrape.js https://shop.com/p/1 --extract=product
 *   node zscrape.js https://site.com --screenshot=shot.png --geo=US
 *   node zscrape.js https://site.com --dry-run           # inspect cost before spending
 */

const ENDPOINT = "https://api.zyte.com/v1/extract";
// If the cheap HTTP response yields fewer visible-text chars than this, the page
// is almost certainly JS-rendered (SPA shell / bot wall) and we escalate.
const JS_TEXT_THRESHOLD = 200;

function parseArgs(argv) {
  const opts = { mode: "auto" };
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [k, ...rest] = arg.slice(2).split("=");
      opts[k] = rest.length ? rest.join("=") : true;
    } else {
      positional.push(arg);
    }
  }
  opts.url = positional[0];
  return opts;
}

function die(msg) {
  console.error(`zscrape: ${msg}`);
  process.exit(1);
}

function parseHeaders(str) {
  // "Accept-Language: en; Referer: https://x.com" -> [{name,value},...]
  return str
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
    });
}

function visibleTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function buildPayload(opts, mode) {
  const payload = { url: opts.url };
  const wantScreenshot = opts.screenshot !== undefined;
  const wantExtract = typeof opts.extract === "string";
  const wantActions = typeof opts.actions === "string";
  const needsBrowser = mode === "browser" || wantScreenshot || wantActions;

  if (wantExtract) {
    // Automatic extraction returns structured JSON; it runs on top of Zyte's
    // own fetch, so we don't also request raw HTML (avoids double-paying).
    payload[opts.extract] = true;
  } else if (needsBrowser) {
    payload.browserHtml = true;
  } else {
    payload.httpResponseBody = true;
  }

  if (wantScreenshot) payload.screenshot = true;
  if (opts.geo) payload.geolocation = String(opts.geo).toUpperCase();
  if (wantActions) {
    try {
      payload.actions = JSON.parse(opts.actions);
    } catch (e) {
      die(`--actions is not valid JSON: ${e.message}`);
    }
  }
  if (opts.headers && !needsBrowser) {
    payload.customHttpRequestHeaders = parseHeaders(opts.headers);
  }
  return payload;
}

async function callZyte(apiKey, payload) {
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

function extractPrimary(body) {
  // Return { kind, data } for the main payload the user asked for.
  if (body.httpResponseBody) {
    return { kind: "html", data: Buffer.from(body.httpResponseBody, "base64").toString("utf8") };
  }
  if (body.browserHtml) return { kind: "html", data: body.browserHtml };
  return { kind: "json", data: JSON.stringify(body, null, 2) };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.url || opts.help) {
    console.error(
      "Usage: node zscrape.js <url> [--mode=auto|http|browser] [--screenshot[=f]] " +
        "[--extract=product|article|productList|serp] [--geo=US] [--headers=..] " +
        "[--actions=json] [--out=f] [--json] [--key-alt] [--dry-run]"
    );
    process.exit(opts.url ? 0 : 1);
  }

  const keyVar = opts["key-alt"] ? "ZYTE_API_KEY_ALT" : "ZYTE_API_KEY";
  const apiKey = process.env[keyVar];

  // Decide the starting (cheapest viable) mode.
  const forcedBrowser =
    opts.mode === "browser" || opts.screenshot !== undefined || typeof opts.actions === "string";
  let mode = forcedBrowser ? "browser" : "http"; // 'auto' starts at http too
  const canEscalate = opts.mode === "auto" && !forcedBrowser && typeof opts.extract !== "string";

  const payload = buildPayload(opts, mode);

  if (opts["dry-run"]) {
    console.error(`[dry-run] mode=${mode}  endpoint=${ENDPOINT}  key=${keyVar}${apiKey ? "" : " (NOT SET)"}`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!apiKey) die(`${keyVar} not set. Run: source ~/.keys.sh`);

  let { status, body } = await callZyte(apiKey, payload);
  if (status !== 200) {
    // Bans/429/target errors are free — surface Zyte's detail and stop.
    die(`Zyte returned HTTP ${status}: ${JSON.stringify(body).slice(0, 400)}`);
  }

  // Auto-escalate: cheap HTTP came back as a JS shell / near-empty body.
  if (canEscalate && body.httpResponseBody) {
    const html = Buffer.from(body.httpResponseBody, "base64").toString("utf8");
    if (visibleTextLength(html) < JS_TEXT_THRESHOLD) {
      console.error(
        `[escalate] HTTP body had <${JS_TEXT_THRESHOLD} chars of visible text — retrying with browser rendering (higher cost).`
      );
      mode = "browser";
      const browserPayload = buildPayload({ ...opts, mode: "browser" }, "browser");
      ({ status, body } = await callZyte(apiKey, browserPayload));
      if (status !== 200) die(`Zyte browser retry returned HTTP ${status}: ${JSON.stringify(body).slice(0, 400)}`);
    }
  }

  console.error(`[ok] mode=${mode}  url=${opts.url}`);

  // Side output: screenshot to file.
  if (opts.screenshot !== undefined && body.screenshot) {
    const shotPath = typeof opts.screenshot === "string" ? opts.screenshot : "screenshot.png";
    require("fs").writeFileSync(shotPath, Buffer.from(body.screenshot, "base64"));
    console.error(`[ok] screenshot -> ${shotPath}`);
  }

  if (opts.json) {
    const out = JSON.stringify(body, null, 2);
    writeOut(opts.out, out);
    return;
  }

  const primary = extractPrimary(body);
  writeOut(opts.out, primary.data);
}

function writeOut(outPath, data) {
  if (outPath && typeof outPath === "string") {
    require("fs").writeFileSync(outPath, data);
    console.error(`[ok] output -> ${outPath}`);
  } else {
    process.stdout.write(data.endsWith("\n") ? data : data + "\n");
  }
}

main().catch((e) => die(e.message));
