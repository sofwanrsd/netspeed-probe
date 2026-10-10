"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Zap,
  ShieldCheck,
  Server,
  Activity,
  ArrowRight,
  Clock,
  Download,
  Lock,
  Layers,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Wifi,
  ChevronRight
} from "lucide-react";

interface ProbeResult {
  success: boolean;
  target: {
    url: string;
    hostname: string;
    protocol: string;
    port: number;
    ip: string;
    allIps: string[];
  };
  timings: {
    dns_ms: number;
    tcp_ms: number;
    tls_ms: number;
    ttfb_ms: number;
    download_ms: number;
    total_ms: number;
  };
  network: {
    totalBytes: number;
    speedKBps: number;
    speedMbps: number;
    statusCode: number;
    statusText: string;
    contentType: string;
    serverHeader: string;
  };
  tls: {
    version: string;
    cipher: string;
    certSubject: string;
    certIssuer: string;
    certValidTo: string;
    daysRemaining: number;
  } | null;
  cdn: {
    name: string;
    detected: boolean;
  };
  geo: {
    country: string;
    countryCode: string;
    city: string;
    region: string;
    isp: string;
    org: string;
    as: string;
    timezone: string;
    lat: number;
    lon: number;
  };
  timestamp: string;
}

const PRESET_DOMAINS = [
  "telkomuniversity.ac.id",
  "cloudflare.com",
  "google.com",
  "v8.voratoon.com",
  "github.com",
  "bydede.my.id"
];

export default function Home() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("netspeed_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveHistory = (domain: string) => {
    try {
      const updated = [domain, ...history.filter((h) => h !== domain)].slice(0, 6);
      setHistory(updated);
      localStorage.setItem("netspeed_history", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const runProbe = async (domainToTest?: string) => {
    const domain = (domainToTest || target).trim();
    if (!domain) return;

    setTarget(domain);
    setLoading(true);
    setError(null);
    setResult(null);

    const steps = [
      "Meresolve DNS Anycast...",
      "Membuka TCP Socket Handshake...",
      "Negosiasi Enkripsi TLS 1.3...",
      "Mengukur Time to First Byte (TTFB)...",
      "Menghitung Throughput & Geolocation..."
    ];

    let stepIdx = 0;
    setActiveStep(steps[0]);
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setActiveStep(steps[stepIdx]);
      }
    }, 450);

    try {
      const res = await fetch(`/api/probe?target=${encodeURIComponent(domain)}`);
      const data = await res.json();

      clearInterval(interval);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan probe jaringan ke target.");
      }

      setResult(data);
      saveHistory(data.target.hostname);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Terjadi kesalahan saat memeriksa target.");
    } finally {
      setLoading(false);
      setActiveStep("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 50) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (ms < 150) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 py-10 md:py-16 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4 tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            HIGH-PRECISION NETWORK PROBE v2.0
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-3 font-sans">
            Domain & Website <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Speedtest</span>
          </h1>
          <p className="text-zinc-400 text-sm md:text-base max-w-xl">
            Diagnosa instan latensi granular DNS, TCP handshake, TLS negotiation, TTFB, throughput unduhan, serta inteligensi CDN dan geolocation.
          </p>
        </div>

        {/* Input Bar */}
        <div className="w-full max-w-2xl mx-auto mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runProbe();
            }}
            className="relative flex items-center shadow-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-md focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all"
          >
            <div className="pl-4 text-zinc-500">
              <Globe className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Masukkan domain (contoh: telkomuniversity.ac.id)"
              className="w-full bg-transparent px-3 py-4 text-sm md:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
              disabled={loading}
            />
            <div className="pr-2">
              <button
                type="submit"
                disabled={loading || !target.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-medium text-sm transition-all shadow-md font-sans"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <span>Uji Latensi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 text-xs text-zinc-400">
            <span className="text-zinc-500 font-mono">Coba cepat:</span>
            {PRESET_DOMAINS.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => runProbe(domain)}
                className="px-2.5 py-1 rounded-md border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 font-mono transition-colors"
              >
                {domain}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Progress State */}
        {loading && (
          <div className="w-full max-w-xl mx-auto my-8 p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm text-center animate-pulse">
            <Activity className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin" />
            <p className="text-zinc-200 text-sm font-mono font-medium">{activeStep}</p>
            <p className="text-zinc-500 text-xs mt-1">Mengukur socket waktu mikrodetik ke target host...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="w-full max-w-xl mx-auto my-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <strong className="block font-medium">Pengujian Gagal</strong>
              <p className="text-xs text-rose-200/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Result Dashboard */}
        {result && !loading && (
          <div className="w-full space-y-6 animate-in fade-in duration-300">
            {/* Target Summary Banner */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white font-mono">{result.target.hostname}</span>
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {result.network.statusCode} {result.network.statusText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                    <span>IP: {result.target.ip}</span>
                    <button
                      onClick={() => copyToClipboard(result.target.ip)}
                      className="hover:text-zinc-200 p-0.5"
                      title="Salin IP"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <span>•</span>
                    <span>{result.geo.city}, {result.geo.country}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs flex items-center gap-2">
                  <span className="text-zinc-500">CDN:</span>
                  <span className={result.cdn.detected ? "text-cyan-400 font-semibold" : "text-zinc-400"}>
                    {result.cdn.name}
                  </span>
                </div>
                <a
                  href={result.target.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Buka Website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Hero Latency Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Total Latensi</span>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {result.timings.total_ms} <span className="text-xs text-zinc-500 font-normal">ms</span>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-mono rounded border ${getLatencyColor(result.timings.total_ms)}`}>
                    {result.timings.total_ms < 50 ? "Sangat Cepat" : result.timings.total_ms < 150 ? "Normal" : "Tinggi"}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>TTFB (First Byte)</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {result.timings.ttfb_ms} <span className="text-xs text-zinc-500 font-normal">ms</span>
                </div>
                <div className="mt-2 text-[10px] text-zinc-500 font-mono">
                  Waktu respon awal server
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>DNS Lookup</span>
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {result.timings.dns_ms} <span className="text-xs text-zinc-500 font-normal">ms</span>
                </div>
                <div className="mt-2 text-[10px] text-zinc-500 font-mono">
                  Resolusi domain ke IP
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Kecepatan Unduh</span>
                  <Download className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {result.network.speedMbps} <span className="text-xs text-zinc-500 font-normal">Mbps</span>
                </div>
                <div className="mt-2 text-[10px] text-zinc-500 font-mono">
                  {(result.network.totalBytes / 1024).toFixed(1)} KB transferred
                </div>
              </div>
            </div>

            {/* Waterfall Connection Breakdown */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white font-sans">Waterfall Timing Timeline</h3>
                </div>
                <span className="text-xs font-mono text-zinc-500">100% Breakdown</span>
              </div>

              {/* Stacked Progress Bar */}
              <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
                <div
                  style={{ width: `${Math.max(2, (result.timings.dns_ms / result.timings.total_ms) * 100)}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`DNS: ${result.timings.dns_ms}ms`}
                />
                <div
                  style={{ width: `${Math.max(2, (result.timings.tcp_ms / result.timings.total_ms) * 100)}%` }}
                  className="bg-purple-500 h-full transition-all"
                  title={`TCP: ${result.timings.tcp_ms}ms`}
                />
                <div
                  style={{ width: `${Math.max(2, (result.timings.tls_ms / result.timings.total_ms) * 100)}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`TLS: ${result.timings.tls_ms}ms`}
                />
                <div
                  style={{ width: `${Math.max(2, (result.timings.ttfb_ms / result.timings.total_ms) * 100)}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`TTFB: ${result.timings.ttfb_ms}ms`}
                />
                <div
                  style={{ width: `${Math.max(2, (result.timings.download_ms / result.timings.total_ms) * 100)}%` }}
                  className="bg-cyan-500 h-full transition-all"
                  title={`Download: ${result.timings.download_ms}ms`}
                />
              </div>

              {/* Waterfall Legend with Values */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-xs font-mono">
                <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>DNS Lookup</span>
                  </div>
                  <span className="text-white font-bold">{result.timings.dns_ms} ms</span>
                </div>

                <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>TCP Connect</span>
                  </div>
                  <span className="text-white font-bold">{result.timings.tcp_ms} ms</span>
                </div>

                <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>TLS Handshake</span>
                  </div>
                  <span className="text-white font-bold">{result.timings.tls_ms} ms</span>
                </div>

                <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Server TTFB</span>
                  </div>
                  <span className="text-white font-bold">{result.timings.ttfb_ms} ms</span>
                </div>

                <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span>Download</span>
                  </div>
                  <span className="text-white font-bold">{result.timings.download_ms} ms</span>
                </div>
              </div>
            </div>

            {/* Deep Technical Intelligence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Geolocation & Routing */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Server Geolocation & Network</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-zinc-800">
                    <span className="text-zinc-500">Lokasi:</span>
                    <span className="text-zinc-200">{result.geo.city}, {result.geo.country} ({result.geo.countryCode})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800">
                    <span className="text-zinc-500">ISP:</span>
                    <span className="text-zinc-200 truncate max-w-[200px]" title={result.geo.isp}>{result.geo.isp}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800">
                    <span className="text-zinc-500">ASN / Organisasi:</span>
                    <span className="text-zinc-200 truncate max-w-[200px]" title={result.geo.as}>{result.geo.as}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800">
                    <span className="text-zinc-500">Server Banner:</span>
                    <span className="text-zinc-200">{result.network.serverHeader}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Semua IP Terdeteksi:</span>
                    <span className="text-zinc-200">{result.target.allIps.join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Security & TLS Inspector */}
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Keamanan SSL / TLS</span>
                </div>
                {result.tls ? (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-500">Protokol TLS:</span>
                      <span className="text-emerald-400 font-semibold">{result.tls.version}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-500">Cipher Suite:</span>
                      <span className="text-zinc-200 truncate max-w-[200px]" title={result.tls.cipher}>{result.tls.cipher}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-500">Penerbit Sertifikat:</span>
                      <span className="text-zinc-200 truncate max-w-[200px]" title={result.tls.certIssuer}>{result.tls.certIssuer}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Masa Berlaku:</span>
                      <span className="text-zinc-200">
                        {result.tls.daysRemaining > 0 ? (
                          <span className="text-emerald-400">{result.tls.daysRemaining} hari lagi</span>
                        ) : (
                          <span className="text-rose-400">Kedaluwarsa</span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    Target menggunakan protokol HTTP biasa (Port 80) tanpa enkripsi SSL/TLS.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Tests Pill Bar */}
        {history.length > 0 && !loading && (
          <div className="mt-10 pt-6 border-t border-zinc-800/80">
            <div className="flex items-center justify-between mb-3 text-xs text-zinc-500 font-mono">
              <span>Riwayat Pengujian Terakhir:</span>
              <button
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("netspeed_history");
                }}
                className="hover:text-zinc-300"
              >
                Hapus
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  onClick={() => runProbe(item)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <span>{item}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>NetSpeed Probe • High-Precision Network Diagnostics</span>
          <span>
            Dibuat oleh{" "}
            <a
              href="https://github.com/sofwanrsd"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-emerald-400 transition-colors underline underline-offset-4"
            >
              Sofwan Rosidi
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
