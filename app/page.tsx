"use client";

import { useState, useEffect, useRef } from "react";
import {
  Globe,
  Zap,
  ShieldCheck,
  Server,
  Activity,
  ArrowRight,
  Clock,
  Download,
  Upload,
  Lock,
  Layers,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Wifi,
  ChevronRight,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw
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
  dnsRecords: {
    a: string[];
    aaaa: string[];
    mx: Array<{ exchange: string; priority: number }>;
    txt: string[];
    ns: string[];
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
  headers: Record<string, string>;
  securityAudit: {
    grade: string;
    passCount: number;
    total: number;
    checks: Array<{
      name: string;
      header: string;
      status: "pass" | "warn" | "fail";
      value?: string;
      description: string;
    }>;
  };
  tls: {
    version: string;
    cipher: string;
    alpnProtocol: string;
    certSubject: string;
    certIssuer: string;
    certValidTo: string;
    daysRemaining: number;
  } | null;
  cdn: {
    name: string;
    detected: boolean;
    pop?: string;
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

interface ClientInfo {
  ip: string;
  city: string;
  country: string;
  isp: string;
}

const PRESET_DOMAINS = [
  "telkomuniversity.ac.id",
  "cloudflare.com",
  "google.com",
  "v8.voratoon.com",
  "github.com",
  "bydede.my.id"
];

type AppMode = "domain" | "speedtest";
type ActiveTab = "overview" | "dns" | "security" | "headers";

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("domain");

  // Domain Probe State
  const [target, setTarget] = useState("");
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [domainHistory, setDomainHistory] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  // Internet Speedtest State
  const [speedState, setSpeedState] = useState<"idle" | "ping" | "download" | "upload" | "finished">("idle");
  const [pingMs, setPingMs] = useState<number>(0);
  const [jitterMs, setJitterMs] = useState<number>(0);
  const [downloadMbps, setDownloadMbps] = useState<number>(0);
  const [uploadMbps, setUploadMbps] = useState<number>(0);
  const [currentSpeedDisplay, setCurrentSpeedDisplay] = useState<number>(0);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("netspeed_history");
      if (saved) {
        setDomainHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }

    // Fetch client info once
    fetch("/api/speedtest/client-info")
      .then((r) => r.json())
      .then((d) => setClientInfo(d))
      .catch(() => {});
  }, []);

  const saveDomainHistory = (domain: string) => {
    try {
      const updated = [domain, ...domainHistory.filter((h) => h !== domain)].slice(0, 8);
      setDomainHistory(updated);
      localStorage.setItem("netspeed_history", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const runDomainProbe = async (domainToTest?: string) => {
    const domain = (domainToTest || target).trim();
    if (!domain) return;

    setTarget(domain);
    setProbeLoading(true);
    setProbeError(null);
    setProbeResult(null);

    const steps = [
      "Meresolve DNS Matrix (A, AAAA, MX, NS, TXT)...",
      "Membuka TCP Socket Handshake...",
      "Negosiasi Enkripsi TLS 1.3 & ALPN...",
      "Mengukur Time to First Byte (TTFB)...",
      "Menganalisa Security Headers & Throughput..."
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

      setProbeResult(data);
      saveDomainHistory(data.target.hostname);
    } catch (err: any) {
      clearInterval(interval);
      setProbeError(err.message || "Terjadi kesalahan saat memeriksa target.");
    } finally {
      setProbeLoading(false);
      setActiveStep("");
    }
  };

  // Internet Speedtest Execution
  const runInternetSpeedtest = async () => {
    setSpeedState("ping");
    setPingMs(0);
    setJitterMs(0);
    setDownloadMbps(0);
    setUploadMbps(0);
    setCurrentSpeedDisplay(0);

    abortControllerRef.current = new AbortController();

    try {
      // 1. Measure Ping & Jitter (8 rapid samples)
      const pings: number[] = [];
      for (let i = 0; i < 8; i++) {
        const t0 = performance.now();
        await fetch(`/api/speedtest/ping?t=${Date.now()}_${i}`, {
          cache: "no-store",
          signal: abortControllerRef.current.signal
        });
        const rtt = performance.now() - t0;
        pings.push(rtt);
        setPingMs(Number((pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(1)));
        await new Promise((r) => setTimeout(r, 60));
      }

      // Calculate Jitter
      let jitterSum = 0;
      for (let i = 1; i < pings.length; i++) {
        jitterSum += Math.abs(pings[i] - pings[i - 1]);
      }
      const finalJitter = Number((jitterSum / (pings.length - 1)).toFixed(1));
      const finalPing = Number((pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(1));
      setPingMs(finalPing);
      setJitterMs(finalJitter);

      // 2. Measure Download Speed (Multi-stream)
      setSpeedState("download");
      const downloadStart = performance.now();
      let totalBytesRead = 0;

      const downloadStream = async (sizeMb: number) => {
        const response = await fetch(`/api/speedtest/download?size=${sizeMb}&t=${Date.now()}`, {
          cache: "no-store",
          signal: abortControllerRef.current?.signal
        });
        const reader = response.body?.getReader();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytesRead += value.length;
            const elapsedSec = (performance.now() - downloadStart) / 1000;
            if (elapsedSec > 0.2) {
              const currentSpeed = (totalBytesRead * 8) / (elapsedSec * 1000000);
              setCurrentSpeedDisplay(Number(currentSpeed.toFixed(1)));
            }
          }
        }
      };

      await Promise.all([downloadStream(10), downloadStream(10), downloadStream(10)]);
      const downloadElapsed = (performance.now() - downloadStart) / 1000;
      const finalDownload = Number(((totalBytesRead * 8) / (downloadElapsed * 1000000)).toFixed(1));
      setDownloadMbps(finalDownload);
      setCurrentSpeedDisplay(finalDownload);

      // 3. Measure Upload Speed (Parallel POST streams)
      setSpeedState("upload");
      const uploadStart = performance.now();
      let totalBytesUploaded = 0;

      const uploadStream = async () => {
        const payload = new Uint8Array(1024 * 512); // 512KB payload
        for (let i = 0; i < 6; i++) {
          await fetch("/api/speedtest/upload", {
            method: "POST",
            body: payload,
            cache: "no-store",
            signal: abortControllerRef.current?.signal
          });
          totalBytesUploaded += payload.length;
          const elapsedSec = (performance.now() - uploadStart) / 1000;
          if (elapsedSec > 0.2) {
            const currentSpeed = (totalBytesUploaded * 8) / (elapsedSec * 1000000);
            setCurrentSpeedDisplay(Number(currentSpeed.toFixed(1)));
          }
        }
      };

      await Promise.all([uploadStream(), uploadStream()]);
      const uploadElapsed = (performance.now() - uploadStart) / 1000;
      const finalUpload = Number(((totalBytesUploaded * 8) / (uploadElapsed * 1000000)).toFixed(1));
      setUploadMbps(finalUpload);
      setCurrentSpeedDisplay(0);

      setSpeedState("finished");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSpeedState("idle");
      }
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getLatencyPill = (ms: number) => {
    if (ms < 50) return { label: "Sangat Cepat", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    if (ms < 150) return { label: "Normal", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    return { label: "Latensi Tinggi", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  };

  const getSecurityGradePill = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "B":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
      case "C":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      default:
        return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#09090b] text-zinc-100 font-sans">
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/[0.1] flex items-center justify-center text-zinc-200">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">NetSpeed Probe</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-white/[0.05]">
                  v2.5
                </span>
              </div>
              <p className="text-xs text-zinc-400">Network Telemetry & Internet Speed Diagnostic</p>
            </div>
          </div>

          {/* Mode Switcher Dock */}
          <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-white/[0.08] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAppMode("domain")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                appMode === "domain"
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Diagnosa Domain</span>
            </button>

            <button
              type="button"
              onClick={() => setAppMode("speedtest")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                appMode === "speedtest"
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Speedtest Internet</span>
            </button>
          </div>
        </header>

        {/* ==================================================================== */}
        {/* MODE 1: DOMAIN TELEMETRY PROBE */}
        {/* ==================================================================== */}
        {appMode === "domain" && (
          <div className="space-y-6">
            <div className="w-full max-w-3xl mx-auto mb-8 text-center">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-2">
                Diagnosa Kecepatan & Rute Jaringan Domain
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto mb-6">
                Ukur latensi koneksi soket mikrodetik, inspeksi DNS multi-rekord, negosiasi TLS, dan audit keamanan HTTP headers secara instan.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runDomainProbe();
                }}
                className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-xl border border-white/[0.1] bg-zinc-900/80 shadow-2xl focus-within:border-emerald-500/50 transition-all"
              >
                <div className="flex items-center gap-2.5 w-full pl-3 pr-2 py-2 sm:py-0">
                  <Globe className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Masukkan hostname (contoh: telkomuniversity.ac.id)"
                    className="w-full bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none font-mono"
                    disabled={probeLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={probeLoading || !target.trim()}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-6 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-all disabled:bg-zinc-800 disabled:text-zinc-400 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {probeLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <span>Mulai Uji</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
                <span className="text-zinc-400">Target Cepat:</span>
                {PRESET_DOMAINS.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => runDomainProbe(domain)}
                    className="px-2.5 py-1 rounded border border-white/[0.06] bg-zinc-900/40 hover:bg-zinc-800 text-zinc-300 font-mono transition-colors min-h-[30px]"
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            {probeLoading && (
              <div className="w-full max-w-2xl mx-auto my-12 p-8 rounded-xl border border-white/[0.08] bg-zinc-900/30 text-center animate-pulse">
                <Activity className="w-6 h-6 text-emerald-400 mx-auto mb-3 animate-spin" />
                <p className="text-sm font-mono text-zinc-200 font-medium">{activeStep}</p>
                <p className="text-xs text-zinc-400 mt-1">Mengukur telemetri soket TCP/TLS mikrodetik...</p>
              </div>
            )}

            {probeError && (
              <div className="w-full max-w-2xl mx-auto my-8 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 flex items-start gap-3 text-xs sm:text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="block font-medium">Uji Koneksi Gagal</strong>
                  <p className="text-xs text-rose-300/80 mt-0.5">{probeError}</p>
                </div>
              </div>
            )}

            {probeResult && !probeLoading && (
              <div className="space-y-6">
                <div className="p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-zinc-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-zinc-800 border border-white/[0.08] text-zinc-200">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-lg font-bold text-white font-mono">{probeResult.target.hostname}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                          HTTP {probeResult.network.statusCode} {probeResult.network.statusText}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-400 border border-white/[0.06]">
                          Port {probeResult.target.port}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-1 flex-wrap">
                        <span>IP: {probeResult.target.ip}</span>
                        <button
                          onClick={() => copyText(probeResult.target.ip, "ip-main")}
                          className="hover:text-white p-0.5"
                          title="Salin IP"
                        >
                          {copiedKey === "ip-main" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <span>•</span>
                        <span>{probeResult.geo.city}, {probeResult.geo.country}</span>
                        <span>•</span>
                        <span className="text-zinc-400">{probeResult.geo.isp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <div className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-950 text-xs font-mono flex items-center gap-2">
                      <span className="text-zinc-400">CDN:</span>
                      <span className={probeResult.cdn.detected ? "text-cyan-400 font-medium" : "text-zinc-400"}>
                        {probeResult.cdn.name} {probeResult.cdn.pop ? `(${probeResult.cdn.pop})` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const summary = `NetSpeed Probe Diagnostic\nTarget: ${probeResult.target.hostname} (${probeResult.target.ip})\nRTT: ${probeResult.timings.total_ms}ms • TTFB: ${probeResult.timings.ttfb_ms}ms • Download: ${probeResult.network.speedMbps} Mbps\nDNS: ${probeResult.timings.dns_ms}ms • CDN: ${probeResult.cdn.name} • Location: ${probeResult.geo.city}, ${probeResult.geo.country}\nTested on https://probe.taveve.my.id`;
                        copyText(summary, "share-domain");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-mono flex items-center gap-1.5 min-h-[36px]"
                    >
                      {copiedKey === "share-domain" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "share-domain" ? "Tersalin!" : "Bagikan"}</span>
                    </button>
                    <a
                      href={probeResult.target.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg border border-white/[0.08] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Buka URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                      <span>Total Latensi RTT</span>
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {probeResult.timings.total_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-mono rounded border ${getLatencyPill(probeResult.timings.total_ms).color}`}>
                        {getLatencyPill(probeResult.timings.total_ms).label}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                      <span>Time to First Byte</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {probeResult.timings.ttfb_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                      Respon awal server
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                      <span>DNS Resolution</span>
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {probeResult.timings.dns_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                      Resolusi nama domain
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                      <span>Transfer Speed</span>
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {probeResult.network.speedMbps} <span className="text-xs font-normal text-zinc-400">Mbps</span>
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                      {(probeResult.network.totalBytes / 1024).toFixed(1)} KB ditransfer
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/[0.08] flex items-center gap-1 overflow-x-auto scrollbar-none pb-px">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                      activeTab === "overview"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Waterfall & Rute</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("dns")}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                      activeTab === "dns"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>DNS Matrix ({probeResult.dnsRecords.a.length + probeResult.dnsRecords.aaaa.length + probeResult.dnsRecords.mx.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("security")}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                      activeTab === "security"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Security Audit ({probeResult.securityAudit.grade})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("headers")}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                      activeTab === "headers"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>HTTP Headers</span>
                  </button>
                </div>

                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                          Granular Waterfall Timeline
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          Total: {probeResult.timings.total_ms} ms
                        </span>
                      </div>

                      <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-white/[0.06]">
                        <div
                          style={{ width: `${Math.max(2, (probeResult.timings.dns_ms / probeResult.timings.total_ms) * 100)}%` }}
                          className="bg-blue-500 h-full transition-all"
                          title={`DNS: ${probeResult.timings.dns_ms}ms`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (probeResult.timings.tcp_ms / probeResult.timings.total_ms) * 100)}%` }}
                          className="bg-purple-500 h-full transition-all"
                          title={`TCP: ${probeResult.timings.tcp_ms}ms`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (probeResult.timings.tls_ms / probeResult.timings.total_ms) * 100)}%` }}
                          className="bg-emerald-500 h-full transition-all"
                          title={`TLS: ${probeResult.timings.tls_ms}ms`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (probeResult.timings.ttfb_ms / probeResult.timings.total_ms) * 100)}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`TTFB: ${probeResult.timings.ttfb_ms}ms`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (probeResult.timings.download_ms / probeResult.timings.total_ms) * 100)}%` }}
                          className="bg-cyan-500 h-full transition-all"
                          title={`Download: ${probeResult.timings.download_ms}ms`}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
                        <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>DNS Lookup</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{probeResult.timings.dns_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <span>TCP Connect</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{probeResult.timings.tcp_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>TLS Handshake</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{probeResult.timings.tls_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Server TTFB</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{probeResult.timings.ttfb_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>Download</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{probeResult.timings.download_ms} ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Infrastruktur Jaringan & Server</span>
                        </div>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-400">Lokasi Fisik:</span>
                            <span className="text-zinc-200">{probeResult.geo.city}, {probeResult.geo.country} ({probeResult.geo.countryCode})</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-400">ISP Penyedia:</span>
                            <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.geo.isp}>{probeResult.geo.isp}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-400">BGP ASN:</span>
                            <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.geo.as}>{probeResult.geo.as}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-400">Zona Waktu:</span>
                            <span className="text-zinc-200">{probeResult.geo.timezone}</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-zinc-400">Server Banner:</span>
                            <span className="text-zinc-200">{probeResult.network.serverHeader}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Protokol Enkripsi & Sertifikat</span>
                        </div>
                        {probeResult.tls ? (
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Versi TLS / ALPN:</span>
                              <span className="text-emerald-400 font-semibold">{probeResult.tls.version} ({probeResult.tls.alpnProtocol})</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Cipher Suite:</span>
                              <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.tls.cipher}>{probeResult.tls.cipher}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Penerbit Sertifikat:</span>
                              <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.tls.certIssuer}>{probeResult.tls.certIssuer}</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className="text-zinc-400">Sisa Masa Aktif:</span>
                              <span className="text-zinc-200">
                                {probeResult.tls.daysRemaining > 0 ? (
                                  <span className="text-emerald-400">{probeResult.tls.daysRemaining} hari lagi</span>
                                ) : (
                                  <span className="text-rose-400">Kedaluwarsa</span>
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                            Koneksi HTTP Port 80 (Tanpa enkripsi TLS).
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "dns" && (
                  <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-5">
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono text-zinc-400 uppercase">Alamat IPv4 (A Records):</h4>
                      <div className="space-y-1">
                        {probeResult.dnsRecords.a.map((ip, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/[0.05] text-xs font-mono">
                            <span className="text-emerald-400">{ip}</span>
                            <button
                              onClick={() => copyText(ip, `dns-a-${idx}`)}
                              className="text-zinc-400 hover:text-white p-1"
                              title="Salin IP"
                            >
                              {copiedKey === `dns-a-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {probeResult.dnsRecords.aaaa.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">Alamat IPv6 (AAAA Records):</h4>
                        <div className="space-y-1">
                          {probeResult.dnsRecords.aaaa.map((ip, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/[0.05] text-xs font-mono">
                              <span className="text-cyan-400 truncate max-w-[280px] sm:max-w-none">{ip}</span>
                              <button
                                onClick={() => copyText(ip, `dns-aaaa-${idx}`)}
                                className="text-zinc-400 hover:text-white p-1"
                                title="Salin IPv6"
                              >
                                {copiedKey === `dns-aaaa-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {probeResult.dnsRecords.mx.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">Mail Exchanger (MX Records):</h4>
                        <div className="space-y-1">
                          {probeResult.dnsRecords.mx.map((mx, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/[0.05] text-xs font-mono">
                              <span className="text-zinc-200">{mx.exchange}</span>
                              <span className="text-zinc-400">Pri: {mx.priority}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {probeResult.dnsRecords.ns.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">Authoritative Nameservers (NS):</h4>
                        <div className="space-y-1">
                          {probeResult.dnsRecords.ns.map((ns, idx) => (
                            <div key={idx} className="p-2 rounded bg-zinc-950 border border-white/[0.05] text-xs font-mono text-zinc-300">
                              {ns}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {probeResult.dnsRecords.txt.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">TXT Verification / SPF:</h4>
                        <div className="space-y-1">
                          {probeResult.dnsRecords.txt.map((txt, idx) => (
                            <div key={idx} className="p-2 rounded bg-zinc-950 border border-white/[0.05] text-xs font-mono text-zinc-400 break-all">
                              {txt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                          HTTP Security Headers Evaluation
                        </span>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Analisa kepatuhan header keamanan standar OWASP.
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded border font-mono font-bold text-sm ${getSecurityGradePill(probeResult.securityAudit.grade)}`}>
                        Grade {probeResult.securityAudit.grade} ({probeResult.securityAudit.passCount}/{probeResult.securityAudit.total})
                      </div>
                    </div>

                    <div className="space-y-2">
                      {probeResult.securityAudit.checks.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-lg bg-zinc-950/70 border border-white/[0.05] flex items-start gap-3">
                          {item.status === "pass" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : item.status === "warn" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white font-mono">{item.name}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                                item.status === "pass"
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : item.status === "warn"
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                              }`}>
                                {item.status === "pass" ? "Passed" : item.status === "warn" ? "Optional / Missing" : "Missing"}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">{item.description}</p>
                            {item.value && (
                              <div className="mt-1.5 p-1.5 rounded bg-zinc-900 border border-white/[0.04] text-[11px] font-mono text-zinc-300 break-all">
                                {item.value}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "headers" && (
                  <div className="p-5 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                          Raw Response Headers (curl -I)
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const text = Object.entries(probeResult.headers).map(([k, v]) => `${k}: ${v}`).join("\n");
                          copyText(text, "headers-all");
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/[0.08] bg-zinc-950 hover:bg-zinc-800 text-xs font-mono text-zinc-300 transition-colors"
                      >
                        {copiedKey === "headers-all" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Salin Semua</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-950 border border-white/[0.05] overflow-x-auto">
                      <pre className="text-xs font-mono text-zinc-300 space-y-1">
                        <div><span className="text-emerald-400">HTTP/1.1</span> <span className="text-amber-400">{probeResult.network.statusCode} {probeResult.network.statusText}</span></div>
                        {Object.entries(probeResult.headers).map(([k, v]) => (
                          <div key={k} className="leading-relaxed">
                            <span className="text-cyan-400">{k}</span>: <span className="text-zinc-300">{v}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {domainHistory.length > 0 && !probeLoading && (
              <div className="mt-12 pt-6 border-t border-white/[0.08]">
                <div className="flex items-center justify-between mb-3 text-xs text-zinc-400 font-mono">
                  <span>Riwayat Pengujian Terakhir:</span>
                  <button
                    onClick={() => {
                      setDomainHistory([]);
                      localStorage.removeItem("netspeed_history");
                    }}
                    className="hover:text-zinc-200"
                  >
                    Bersihkan
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {domainHistory.map((item) => (
                    <button
                      key={item}
                      onClick={() => runDomainProbe(item)}
                      className="px-3 py-1.5 rounded-md border border-white/[0.08] bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-colors min-h-[36px]"
                    >
                      <span>{item}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODE 2: INTERNET SPEEDTEST (CLIENT-SIDE BANDWIDTH) */}
        {/* ==================================================================== */}
        {appMode === "speedtest" && (
          <div className="space-y-8 max-w-4xl mx-auto w-full">
            <div className="text-center">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-2">
                Uji Kecepatan Koneksi Internet Anda
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto">
                Ukur latensi Ping, Jitter, kecepatan Download, dan Upload secara langsung dari perangkat Anda ke edge server.
              </p>
            </div>

            {/* Client ISP Strip */}
            {clientInfo && (
              <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-400">Penyedia Layanan (ISP):</span>
                  <span className="text-white font-semibold">{clientInfo.isp}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400">
                  <span>IP: {clientInfo.ip}</span>
                  <span>•</span>
                  <span>{clientInfo.city}, {clientInfo.country}</span>
                </div>
              </div>
            )}

            {/* Central Dial & Gauge Area */}
            <div className="py-8 sm:py-12 flex flex-col items-center justify-center">
              {speedState === "idle" && (
                <button
                  type="button"
                  onClick={runInternetSpeedtest}
                  className="w-44 h-44 sm:w-52 sm:h-52 rounded-full border border-emerald-500/40 bg-zinc-900 hover:bg-zinc-800/80 flex flex-col items-center justify-center gap-2 group transition-all shadow-2xl hover:scale-105 active:scale-95"
                >
                  <Play className="w-10 h-10 text-emerald-400 group-hover:scale-110 transition-transform ml-1" />
                  <span className="font-bold text-sm tracking-wider uppercase text-white font-mono">
                    Mulai Uji
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">Klik untuk mulai</span>
                </button>
              )}

              {(speedState === "ping" || speedState === "download" || speedState === "upload") && (
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-emerald-400/40 bg-zinc-900/80 flex flex-col items-center justify-center relative p-4">
                  <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin" />
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                    {speedState === "ping" ? "Mengukur Ping..." : speedState === "download" ? "Download..." : "Upload..."}
                  </span>
                  <span className="text-4xl sm:text-5xl font-bold font-mono text-white tracking-tight">
                    {currentSpeedDisplay.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono text-zinc-400 mt-1">Mbps</span>
                </div>
              )}

              {speedState === "finished" && (
                <div className="flex flex-col items-center">
                  <div className="text-center mb-6">
                    <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-semibold block mb-1">
                      Pengujian Selesai
                    </span>
                    <span className="text-5xl sm:text-6xl font-bold font-mono text-white">
                      {downloadMbps} <span className="text-lg font-normal text-zinc-400">Mbps</span>
                    </span>
                    <p className="text-xs text-zinc-400 mt-2">
                      Kecepatan unduh koneksi internet aktif perangkat Anda
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={runInternetSpeedtest}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-white transition-colors min-h-[44px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Uji Ulang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const summary = `Internet Speedtest Result\nDownload: ${downloadMbps} Mbps\nUpload: ${uploadMbps} Mbps\nPing: ${pingMs} ms • Jitter: ${jitterMs} ms\nISP: ${clientInfo?.isp || "Unknown"} (${clientInfo?.city || ""}, ${clientInfo?.country || ""})\nTested on https://probe.taveve.my.id`;
                        copyText(summary, "share-speedtest");
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-mono text-emerald-300 transition-colors min-h-[44px]"
                    >
                      {copiedKey === "share-speedtest" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "share-speedtest" ? "Tersalin!" : "Salin Hasil"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Speedtest Metrics Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Download</span>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {downloadMbps || (speedState === "download" ? currentSpeedDisplay.toFixed(1) : "—")}{" "}
                  <span className="text-xs font-normal text-zinc-400">Mbps</span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Throughput unduh</span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Upload</span>
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {uploadMbps || (speedState === "upload" ? currentSpeedDisplay.toFixed(1) : "—")}{" "}
                  <span className="text-xs font-normal text-zinc-400">Mbps</span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Throughput kirim</span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Latency Ping</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {pingMs || "—"} <span className="text-xs font-normal text-zinc-400">ms</span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Round-trip delay</span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Jitter</span>
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {jitterMs || "—"} <span className="text-xs font-normal text-zinc-400">ms</span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">Variasi stabilitas</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.08] py-6 text-center text-xs text-zinc-400 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>NetSpeed Probe • Engineered for Network Engineers</span>
          <span>
            Koleksi Proyek{" "}
            <a
              href="https://github.com/sofwanrsd"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-300 hover:text-white transition-colors underline underline-offset-4"
            >
              sofwanrsd
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
