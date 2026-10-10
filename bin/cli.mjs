#!/usr/bin/env node

/**
 * NetSpeed Probe CLI
 * High-Precision Network & Website Telemetry in your Terminal
 */

import dns from "dns/promises";
import net from "net";
import tls from "tls";
import { performance } from "perf_hooks";

const targetRaw = process.argv[2]?.trim();

if (!targetRaw || targetRaw === "-h" || targetRaw === "--help") {
  console.log(`
\x1b[1m\x1b[32mNetSpeed Probe CLI\x1b[0m v2.5
High-Precision Domain & Network Diagnostic Tool
By Sofwan Rosidi (https://github.com/sofwanrsd)

\x1b[1mPENGGUNAAN:\x1b[0m
  npx netspeed-probe <domain-atau-url>

\x1b[1mCONTOH:\x1b[0m
  npx netspeed-probe telkomuniversity.ac.id
  npx netspeed-probe https://cloudflare.com
  npx netspeed-probe google.com
`);
  process.exit(0);
}

let urlString = targetRaw;
if (!/^https?:\/\//i.test(urlString)) {
  urlString = `https://${urlString}`;
}

let parsedUrl;
try {
  parsedUrl = new URL(urlString);
} catch {
  console.error("\x1b[31m[ERROR] Format domain atau URL tidak valid.\x1b[0m");
  process.exit(1);
}

const hostname = parsedUrl.hostname;
const isHttps = parsedUrl.protocol === "https:";
const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80);
const requestPath = (parsedUrl.pathname || "/") + (parsedUrl.search || "");

console.log(`\n\x1b[1m\x1b[36m[*] Memulai diagnosa jaringan ke:\x1b[0m \x1b[1m${hostname}\x1b[0m (Port: ${port})...\n`);

async function runCliProbe() {
  try {
    // 1. DNS
    const t_dns_start = performance.now();
    const addresses = await dns.resolve4(hostname);
    const dnsDuration = performance.now() - t_dns_start;
    const ip = addresses[0];

    // 2. TCP
    const t_tcp_start = performance.now();
    const rawSocket = await new Promise((resolve, reject) => {
      const s = net.createConnection({ host: ip, port }, () => resolve(s));
      s.setTimeout(7000, () => { s.destroy(); reject(new Error("TCP connection timeout")); });
      s.on("error", reject);
    });
    const tcpDuration = performance.now() - t_tcp_start;

    // 3. TLS
    let tlsDuration = 0;
    let tlsVersion = "None";
    let cipherName = "None";
    let activeSocket = rawSocket;

    if (isHttps) {
      const t_tls_start = performance.now();
      const tlsSocket = await new Promise((resolve, reject) => {
        const ts = tls.connect({
          socket: rawSocket,
          servername: hostname,
          ALPNProtocols: ["http/1.1"],
          rejectUnauthorized: false
        }, () => resolve(ts));
        ts.setTimeout(8000, () => { ts.destroy(); reject(new Error("TLS handshake timeout")); });
        ts.on("error", reject);
      });
      tlsDuration = performance.now() - t_tls_start;
      activeSocket = tlsSocket;

      tlsVersion = tlsSocket.getProtocol() || "Unknown";
      cipherName = tlsSocket.getCipher()?.name || "Unknown";
    }

    // 4. HTTP Request & TTFB
    const httpStart = performance.now();
    const reqHeaders = [
      `GET ${requestPath} HTTP/1.1`,
      `Host: ${hostname}`,
      `User-Agent: NetSpeedProbe-CLI/2.5`,
      `Accept: */*`,
      `Connection: close`,
      ``,
      ``
    ].join("\r\n");

    activeSocket.write(reqHeaders);

    let ttfb = 0;
    let totalBytes = 0;
    const chunks = [];

    await new Promise((resolve, reject) => {
      activeSocket.on("data", (chunk) => {
        if (!ttfb) ttfb = performance.now() - httpStart;
        totalBytes += chunk.length;
        if (chunks.length < 50) chunks.push(chunk);
      });
      activeSocket.on("end", resolve);
      activeSocket.on("error", reject);
    });

    const downloadDuration = Math.max(0.1, performance.now() - (httpStart + ttfb));
    const totalDuration = dnsDuration + tcpDuration + tlsDuration + ttfb + downloadDuration;

    // Parse header
    const fullBuffer = Buffer.concat(chunks);
    const headerEndIndex = fullBuffer.indexOf("\r\n\r\n");
    let statusCode = 200;
    let statusText = "OK";
    let serverHeader = "Unknown";

    if (headerEndIndex !== -1) {
      const lines = fullBuffer.subarray(0, headerEndIndex).toString().split("\r\n");
      const match = lines[0].match(/HTTP\/\d\.\d\s+(\d+)\s*(.*)/i);
      if (match) {
        statusCode = parseInt(match[1], 10);
        statusText = match[2];
      }
      for (const line of lines) {
        if (line.toLowerCase().startsWith("server:")) {
          serverHeader = line.slice(7).trim();
        }
      }
    }

    try { activeSocket.destroy(); } catch {}

    // Throughput
    const speedKBps = (totalBytes / 1024) / (downloadDuration / 1000);
    const speedMbps = (speedKBps * 8) / 1024;

    // Print Rich Terminal Output
    console.log(`\x1b[1m\x1b[32m✔ DIAGNOSA SELESAI\x1b[0m [Status: ${statusCode} ${statusText}]`);
    console.log("━".repeat(60));
    console.log(`\x1b[1mTarget Host      :\x1b[0m ${hostname} (${ip})`);
    console.log(`\x1b[1mServer Header    :\x1b[0m ${serverHeader}`);
    if (isHttps) {
      console.log(`\x1b[1mEnkripsi TLS     :\x1b[0m ${tlsVersion} | Cipher: ${cipherName}`);
    }
    console.log("━".repeat(60));
    console.log(`\x1b[1m\x1b[34m[1] DNS Lookup   :\x1b[0m ${dnsDuration.toFixed(2).padStart(8)} ms`);
    console.log(`\x1b[1m\x1b[35m[2] TCP Connect  :\x1b[0m ${tcpDuration.toFixed(2).padStart(8)} ms`);
    if (isHttps) {
      console.log(`\x1b[1m\x1b[32m[3] TLS Handshake:\x1b[0m ${tlsDuration.toFixed(2).padStart(8)} ms`);
    }
    console.log(`\x1b[1m\x1b[33m[4] Server TTFB  :\x1b[0m ${ttfb.toFixed(2).padStart(8)} ms`);
    console.log(`\x1b[1m\x1b[36m[5] Data Download:\x1b[0m ${downloadDuration.toFixed(2).padStart(8)} ms (${(totalBytes/1024).toFixed(1)} KB)`);
    console.log("━".repeat(60));
    console.log(`\x1b[1m\x1b[32m★ TOTAL LATENSI  :\x1b[0m \x1b[1m${totalDuration.toFixed(2)} ms\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m★ THROUGHPUT     :\x1b[0m \x1b[1m${speedMbps.toFixed(2)} Mbps\x1b[0m (${speedKBps.toFixed(1)} KB/s)`);
    console.log("━".repeat(60));
    console.log(`\x1b[90mWeb Version: https://probe.taveve.my.id\x1b[0m\n`);

  } catch (err) {
    console.error(`\x1b[31m[ERROR] Gagal: ${err.message}\x1b[0m\n`);
    process.exit(1);
  }
}

runCliProbe();
