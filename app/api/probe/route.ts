import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import net from "net";
import tls from "tls";
import { performance } from "perf_hooks";

function isPrivateIP(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
  }
  return false;
}

function detectCDN(headers: Record<string, string>, server: string): { name: string; detected: boolean } {
  const s = server.toLowerCase();
  const h = headers;

  if (s.includes("cloudflare") || h["cf-ray"] || h["cf-cache-status"]) {
    return { name: "Cloudflare", detected: true };
  }
  if (h["x-amz-cf-id"] || h["x-amz-cf-pop"] || s.includes("cloudfront")) {
    return { name: "Amazon CloudFront", detected: true };
  }
  if (s.includes("akamaighost") || h["x-akamai-transformed"]) {
    return { name: "Akamai", detected: true };
  }
  if (h["x-served-by"] || h["fastly-restarts"] || s.includes("fastly")) {
    return { name: "Fastly", detected: true };
  }
  if (h["x-vercel-id"] || s.includes("vercel")) {
    return { name: "Vercel Edge Network", detected: true };
  }
  if (h["x-nf-request-id"] || s.includes("netlify")) {
    return { name: "Netlify Edge", detected: true };
  }
  if (s.includes("sucuri")) {
    return { name: "Sucuri CloudProxy", detected: true };
  }

  return { name: "Direct / Origin Server", detected: false };
}

async function getGeoInfo(ip: string) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "success") {
        return {
          country: data.country || "Unknown",
          countryCode: data.countryCode || "UN",
          city: data.city || "Unknown",
          region: data.regionName || "",
          isp: data.isp || "Unknown",
          org: data.org || "Unknown",
          as: data.as || "Unknown",
          timezone: data.timezone || "UTC",
          lat: data.lat,
          lon: data.lon
        };
      }
    }
  } catch {
    // Ignore geo fallback
  }
  return {
    country: "Unknown",
    countryCode: "UN",
    city: "Unknown",
    region: "",
    isp: "Unknown",
    org: "Unknown",
    as: "Unknown",
    timezone: "UTC",
    lat: 0,
    lon: 0
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetRaw = searchParams.get("target")?.trim();

  if (!targetRaw) {
    return NextResponse.json({ error: "Parameter 'target' (domain/URL) wajib disertakan." }, { status: 400 });
  }

  let urlString = targetRaw;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return NextResponse.json({ error: "Format domain atau URL tidak valid." }, { status: 400 });
  }

  const hostname = parsedUrl.hostname;
  const isHttps = parsedUrl.protocol === "https:";
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80);
  const requestPath = (parsedUrl.pathname || "/") + (parsedUrl.search || "");

  try {
    // Phase 1: DNS Resolution
    const dnsStart = performance.now();
    const addresses = await dns.resolve4(hostname);
    const dnsDuration = performance.now() - dnsStart;

    if (!addresses || addresses.length === 0) {
      return NextResponse.json({ error: `Gagal meresolve alamat IP untuk host ${hostname}` }, { status: 502 });
    }

    const primaryIp = addresses[0];

    // SSRF Guard
    if (isPrivateIP(primaryIp)) {
      return NextResponse.json({ error: "Target alamat IP private/internal diblokir demi keamanan." }, { status: 403 });
    }

    // Phase 2: TCP Connection
    const tcpStart = performance.now();
    const rawSocket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({ host: primaryIp, port: port }, () => resolve(s));
      s.setTimeout(7000, () => {
        s.destroy();
        reject(new Error("TCP connection timeout (7 detik)"));
      });
      s.on("error", reject);
    });
    const tcpDuration = performance.now() - tcpStart;

    // Phase 3: TLS Handshake (if HTTPS)
    let tlsDuration = 0;
    let tlsInfo: {
      version: string;
      cipher: string;
      certSubject: string;
      certIssuer: string;
      certValidTo: string;
      daysRemaining: number;
    } | null = null;

    let activeSocket: net.Socket | tls.TLSSocket = rawSocket;

    if (isHttps) {
      const tlsStart = performance.now();
      const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const ts = tls.connect({
          socket: rawSocket,
          servername: hostname,
          rejectUnauthorized: false
        }, () => resolve(ts));
        ts.setTimeout(8000, () => {
          ts.destroy();
          reject(new Error("TLS handshake timeout (8 detik)"));
        });
        ts.on("error", reject);
      });
      tlsDuration = performance.now() - tlsStart;
      activeSocket = tlsSocket;

      const cert = tlsSocket.getPeerCertificate();
      const protocol = tlsSocket.getProtocol() || "Unknown";
      const cipher = tlsSocket.getCipher()?.name || "Unknown";

      let daysRemaining = 0;
      if (cert.valid_to) {
        const expiry = new Date(cert.valid_to).getTime();
        daysRemaining = Math.max(0, Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24)));
      }

      const formatField = (val: any): string => {
        if (!val) return "";
        return Array.isArray(val) ? val.join(", ") : String(val);
      };

      tlsInfo = {
        version: protocol,
        cipher: cipher,
        certSubject: formatField(cert.subject?.CN) || hostname,
        certIssuer: formatField(cert.issuer?.O) || formatField(cert.issuer?.CN) || "Unknown Issuer",
        certValidTo: cert.valid_to || "",
        daysRemaining
      };
    }

    // Phase 4 & 5: HTTP Request, TTFB, and Transfer Speed
    const httpStart = performance.now();
    const reqHeaders = [
      `GET ${requestPath} HTTP/1.1`,
      `Host: ${hostname}`,
      `User-Agent: NetSpeedProbe/2.0 (Engineering Diagnostic; +https://github.com/sofwanrsd)`,
      `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
      `Connection: close`,
      ``,
      ``
    ].join("\r\n");

    activeSocket.write(reqHeaders);

    let ttfb = 0;
    let totalBytes = 0;
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      activeSocket.on("data", (chunk: Buffer) => {
        if (!ttfb) {
          ttfb = performance.now() - httpStart;
        }
        totalBytes += chunk.length;
        if (chunks.length < 50) {
          chunks.push(chunk);
        }
      });
      activeSocket.on("end", resolve);
      activeSocket.on("error", reject);
    });

    const downloadDuration = Math.max(0.1, performance.now() - (httpStart + ttfb));
    const totalDuration = dnsDuration + tcpDuration + tlsDuration + ttfb + downloadDuration;

    // Parse Response Header
    const fullBuffer = Buffer.concat(chunks);
    const headerEndIndex = fullBuffer.indexOf("\r\n\r\n");
    let statusCode = 200;
    let statusText = "OK";
    const respHeaders: Record<string, string> = {};

    if (headerEndIndex !== -1) {
      const headerStr = fullBuffer.subarray(0, headerEndIndex).toString("utf-8");
      const lines = headerStr.split("\r\n");
      const statusLine = lines[0];
      const matchStatus = statusLine.match(/HTTP\/\d\.\d\s+(\d+)\s*(.*)/i);
      if (matchStatus) {
        statusCode = parseInt(matchStatus[1], 10);
        statusText = matchStatus[2] || "OK";
      }
      for (let i = 1; i < lines.length; i++) {
        const colon = lines[i].indexOf(":");
        if (colon !== -1) {
          const k = lines[i].slice(0, colon).trim().toLowerCase();
          const v = lines[i].slice(colon + 1).trim();
          respHeaders[k] = v;
        }
      }
    }

    try {
      activeSocket.destroy();
    } catch {
      // Ignore
    }

    // Phase 6: Geolocation & ASN Analysis
    const geo = await getGeoInfo(primaryIp);
    const cdn = detectCDN(respHeaders, respHeaders["server"] || "");

    // Throughput Calculation
    // speed in KB/s and Mbps
    const speedKBps = (totalBytes / 1024) / (downloadDuration / 1000);
    const speedMbps = (speedKBps * 8) / 1024;

    return NextResponse.json({
      success: true,
      target: {
        url: urlString,
        hostname: hostname,
        protocol: isHttps ? "https:" : "http:",
        port: port,
        ip: primaryIp,
        allIps: addresses
      },
      timings: {
        dns_ms: Number(dnsDuration.toFixed(2)),
        tcp_ms: Number(tcpDuration.toFixed(2)),
        tls_ms: Number(tlsDuration.toFixed(2)),
        ttfb_ms: Number(ttfb.toFixed(2)),
        download_ms: Number(downloadDuration.toFixed(2)),
        total_ms: Number(totalDuration.toFixed(2))
      },
      network: {
        totalBytes: totalBytes,
        speedKBps: Number(speedKBps.toFixed(2)),
        speedMbps: Number(speedMbps.toFixed(2)),
        statusCode: statusCode,
        statusText: statusText,
        contentType: respHeaders["content-type"] || "unknown",
        serverHeader: respHeaders["server"] || "Hidden / Unspecified"
      },
      tls: tlsInfo,
      cdn: cdn,
      geo: geo,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Gagal melakukan probe jaringan ke target.",
      target: hostname
    }, { status: 500 });
  }
}
