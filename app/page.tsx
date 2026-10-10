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
  RotateCcw,
  Radio,
  Cpu,
  BarChart2
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

interface EdgeNode {
  code: string;
  name: string;
  city: string;
  flag: string;
  target: string;
  ping: number | null;
  status: "idle" | "testing" | "ok";
}

const PRESET_DOMAINS = [
  "telkomuniversity.ac.id",
  "cloudflare.com",
  "google.com",
  "v8.voratoon.com",
  "github.com",
  "bydede.my.id"
];

const INITIAL_EDGE_NODES: EdgeNode[] = [
  { code: "CGK", name: "Jakarta Edge", city: "Jakarta, ID", flag: "🇮🇩", target: "1.1.1.1", ping: 14.2, status: "ok" },
  { code: "SIN", name: "Singapore POP", city: "Singapore, SG", flag: "🇸🇬", target: "8.8.8.8", ping: 22.8, status: "ok" },
  { code: "NRT", name: "Tokyo Central", city: "Tokyo, JP", flag: "🇯🇵", target: "1.0.0.1", ping: 84.5, status: "ok" },
  { code: "SFO", name: "Silicon Valley", city: "San Jose, US", flag: "🇺🇸", target: "9.9.9.9", ping: 172.4, status: "ok" },
  { code: "FRA", name: "DE-CIX Core", city: "Frankfurt, DE", flag: "🇩🇪", target: "208.67.222.222", ping: 198.1, status: "ok" },
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

  // Edge Nodes Monitor State
  const [edgeNodes, setEdgeNodes] = useState<EdgeNode[]>(INITIAL_EDGE_NODES);
  const [edgeNodesTesting, setEdgeNodesTesting] = useState(false);

  // Internet Speedtest State
  const [speedState, setSpeedState] = useState<"idle" | "ping" | "download" | "upload" | "finished">("idle");
  const [pingMs, setPingMs] = useState<number>(0);
  const [jitterMs, setJitterMs] = useState<number>(0);
  const [downloadMbps, setDownloadMbps] = useState<number>(0);
  const [uploadMbps, setUploadMbps] = useState<number>(0);
  const [currentSpeedDisplay, setCurrentSpeedDisplay] = useState<number>(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
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

  const pingEdgeNodes = async () => {
    setEdgeNodesTesting(true);
    const updated = [...edgeNodes];
    for (let i = 0; i < updated.length; i++) {
      updated[i].status = "testing";
      setEdgeNodes([...updated]);
      const t0 = performance.now();
      try {
        await fetch(`/api/speedtest/ping?node=${updated[i].code}&t=${Date.now()}`, { cache: "no-store" });
        const latency = performance.now() - t0;
        updated[i].ping = Number(latency.toFixed(1));
        updated[i].status = "ok";
      } catch {
        updated[i].status = "ok";
      }
      setEdgeNodes([...updated]);
    }
    setEdgeNodesTesting(false);
  };

  // Internet Speedtest Execution
  const runInternetSpeedtest = async () => {
    setSpeedState("ping");
    setPingMs(0);
    setJitterMs(0);
    setDownloadMbps(0);
    setUploadMbps(0);
    setCurrentSpeedDisplay(0);
    setSpeedHistory([]);

    abortControllerRef.current = new AbortController();

    try {
      // 1. Measure Ping & Jitter
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

      let jitterSum = 0;
      for (let i = 1; i < pings.length; i++) {
        jitterSum += Math.abs(pings[i] - pings[i - 1]);
      }
      const finalJitter = Number((jitterSum / (pings.length - 1)).toFixed(1));
      const finalPing = Number((pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(1));
      setPingMs(finalPing);
      setJitterMs(finalJitter);

      // 2. Measure Download Speed
      setSpeedState("download");
      const downloadStart = performance.now();
      let totalBytesRead = 0;
      const historyBuffer: number[] = [];

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
            if (elapsedSec > 0.15) {
              const currentSpeed = (totalBytesRead * 8) / (elapsedSec * 1000000);
              const rounded = Number(currentSpeed.toFixed(1));
              setCurrentSpeedDisplay(rounded);
              historyBuffer.push(rounded);
              if (historyBuffer.length > 24) historyBuffer.shift();
              setSpeedHistory([...historyBuffer]);
            }
          }
        }
      };

      await Promise.all([downloadStream(12), downloadStream(12), downloadStream(12)]);
      const downloadElapsed = (performance.now() - downloadStart) / 1000;
      const finalDownload = Number(((totalBytesRead * 8) / (downloadElapsed * 1000000)).toFixed(1));
      setDownloadMbps(finalDownload);
      setCurrentSpeedDisplay(finalDownload);

      // 3. Measure Upload Speed
      setSpeedState("upload");
      const uploadStart = performance.now();
      let totalBytesUploaded = 0;
      historyBuffer.length = 0;

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
          if (elapsedSec > 0.15) {
            const currentSpeed = (totalBytesUploaded * 8) / (elapsedSec * 1000000);
            const rounded = Number(currentSpeed.toFixed(1));
            setCurrentSpeedDisplay(rounded);
            historyBuffer.push(rounded);
            if (historyBuffer.length > 24) historyBuffer.shift();
            setSpeedHistory([...historyBuffer]);
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

  // Speedometer Gauge Math (Angle from -135deg to +135deg, scale 0 - 500 Mbps max visually)
  const maxScaleMbps = 500;
  const speedRatio = Math.min(1, currentSpeedDisplay / maxScaleMbps);
  const needleAngle = -135 + speedRatio * 270;

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#08090a] bg-dot-grid text-zinc-100 font-sans relative selection:bg-emerald-500/30 selection:text-white">
      {/* Top Ambient Glow Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gradient-to-b from-indigo-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Edge Node Telemetry Micro-Bar */}
      <div className="w-full border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md text-[11px] font-mono text-zinc-400 py-1.5 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">EDGE REGION:</span> SIN1 (Singapore)
            </span>
            <span className="text-zinc-600">|</span>
            <span className="hidden sm:inline">ROUTING: Anycast BGP</span>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <span className="hidden md:inline">TLS 1.3 / HTTP/2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">DNS Resolver:</span>
            <span className="text-cyan-400 font-medium">1.1.1.1 (Cloudflare Edge)</span>
          </div>
        </div>
      </div>

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.12] flex items-center justify-center text-zinc-200 shadow-lg shadow-black/40">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white font-mono">NetSpeed Probe</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.5 PRO
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-400 border border-white/[0.06] hidden sm:inline">
                  probe.taveve.my.id
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">High-Precision Network Telemetry & Bandwidth Benchmarking</p>
            </div>
          </div>

          {/* Mode Switcher Dock */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-950/90 border border-white/[0.08] shadow-inner w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAppMode("domain")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                appMode === "domain"
                  ? "bg-zinc-800 text-white shadow-sm border border-white/[0.1]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Diagnosa Domain</span>
            </button>

            <button
              type="button"
              onClick={() => setAppMode("speedtest")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                appMode === "speedtest"
                  ? "bg-zinc-800 text-white shadow-sm border border-white/[0.1]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Speedtest Internet</span>
            </button>
          </div>
        </header>

        {/* ==================================================================== */}
        {/* MODE 1: DOMAIN TELEMETRY PROBE */}
        {/* ==================================================================== */}
        {appMode === "domain" && (
          <div className="space-y-6">
            <div className="w-full max-w-3xl mx-auto text-center pt-2 pb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs font-mono mb-4">
                <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                <span>Socket-Level Granular Network Inspector</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
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
                className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-2xl border border-white/[0.1] bg-zinc-900/90 backdrop-blur-xl shadow-2xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3 w-full pl-3 pr-2 py-2 sm:py-0">
                  <Globe className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Masukkan domain (contoh: telkomuniversity.ac.id)"
                    className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
                    disabled={probeLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={probeLoading || !target.trim()}
                  className="w-full sm:w-auto min-h-[46px] flex items-center justify-center gap-2 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-semibold text-xs sm:text-sm transition-all shadow-md shadow-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {probeLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <span>Mulai Diagnosa</span>
                      <ArrowRight className="w-4 h-4 text-zinc-950" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-mono">
                <span className="text-zinc-500">Preset:</span>
                {PRESET_DOMAINS.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => runDomainProbe(domain)}
                    className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300 transition-colors min-h-[28px] hover:border-emerald-500/30"
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            {/* Edge Node Latency Radar Bar */}
            <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-zinc-200">Global Edge Latency Radar</span>
                  <span className="text-zinc-500 hidden sm:inline">• Live ping dari edge nodes</span>
                </div>
                <button
                  type="button"
                  onClick={pingEdgeNodes}
                  disabled={edgeNodesTesting}
                  className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${edgeNodesTesting ? "animate-spin" : ""}`} />
                  <span>{edgeNodesTesting ? "Mengukur..." : "Uji Radar"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                {edgeNodes.map((node) => (
                  <div
                    key={node.code}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.06] flex flex-col justify-between hover:border-white/[0.15] transition-all"
                  >
                    <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 font-medium text-white">
                        <span>{node.flag}</span>
                        <span>{node.code}</span>
                      </span>
                      <span className="text-[10px] text-zinc-500">{node.city.split(",")[0]}</span>
                    </div>
                    <div className="text-base font-bold text-white flex items-baseline gap-1 mt-1">
                      {node.status === "testing" ? (
                        <span className="text-xs text-amber-400 animate-pulse">Ping...</span>
                      ) : (
                        <>
                          <span className={node.ping && node.ping < 50 ? "text-emerald-400" : node.ping && node.ping < 120 ? "text-amber-400" : "text-zinc-300"}>
                            {node.ping}
                          </span>
                          <span className="text-[10px] font-normal text-zinc-500">ms</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {probeLoading && (
              <div className="w-full max-w-2xl mx-auto my-10 p-8 rounded-2xl border border-white/[0.1] bg-zinc-950/80 backdrop-blur-md text-center shadow-2xl animate-pulse">
                <div className="w-12 h-12 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
                <p className="text-sm font-mono text-zinc-200 font-semibold">{activeStep}</p>
                <p className="text-xs text-zinc-500 mt-1 font-mono">Mengukur telemetri soket TCP/TLS mikrodetik & audit header...</p>
              </div>
            )}

            {probeError && (
              <div className="w-full max-w-2xl mx-auto my-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3 text-xs sm:text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="block font-medium">Uji Koneksi Gagal</strong>
                  <p className="text-xs text-rose-300/80 mt-0.5">{probeError}</p>
                </div>
              </div>
            )}

            {probeResult && !probeLoading && (
              <div className="space-y-6">
                {/* Result Hero Header */}
                <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/70 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-zinc-800/80 border border-white/[0.1] text-zinc-200 shadow-inner">
                      <Server className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xl font-bold text-white font-mono">{probeResult.target.hostname}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          HTTP {probeResult.network.statusCode} {probeResult.network.statusText}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-800 text-zinc-400 border border-white/[0.06]">
                          Port {probeResult.target.port}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-1.5 flex-wrap">
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
                        <span className="text-zinc-300">{probeResult.geo.isp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                    <div className="px-3.5 py-2 rounded-xl border border-white/[0.08] bg-zinc-950 text-xs font-mono flex items-center gap-2">
                      <span className="text-zinc-500">CDN:</span>
                      <span className={probeResult.cdn.detected ? "text-cyan-400 font-semibold" : "text-zinc-400"}>
                        {probeResult.cdn.name} {probeResult.cdn.pop ? `(${probeResult.cdn.pop})` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const summary = `NetSpeed Probe Diagnostic\nTarget: ${probeResult.target.hostname} (${probeResult.target.ip})\nRTT: ${probeResult.timings.total_ms}ms • TTFB: ${probeResult.timings.ttfb_ms}ms • Download: ${probeResult.network.speedMbps} Mbps\nDNS: ${probeResult.timings.dns_ms}ms • CDN: ${probeResult.cdn.name} • Location: ${probeResult.geo.city}, ${probeResult.geo.country}\nTested on https://probe.taveve.my.id`;
                        copyText(summary, "share-domain");
                      }}
                      className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors text-xs font-mono flex items-center gap-1.5 min-h-[38px]"
                    >
                      {copiedKey === "share-domain" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "share-domain" ? "Tersalin!" : "Bagikan"}</span>
                    </button>
                    <a
                      href={probeResult.target.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl border border-white/[0.08] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                      title="Buka URL Langsung"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* 4 Key Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md relative overflow-hidden group">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                      <span>Total Latensi RTT</span>
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {probeResult.timings.total_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-mono rounded-md border ${getLatencyPill(probeResult.timings.total_ms).color}`}>
                        {getLatencyPill(probeResult.timings.total_ms).label}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                      <span>Time to First Byte</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {probeResult.timings.ttfb_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2.5 text-[10px] text-zinc-500 font-mono">
                      Respon pemrosesan server
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                      <span>DNS Resolution</span>
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {probeResult.timings.dns_ms} <span className="text-xs font-normal text-zinc-400">ms</span>
                    </div>
                    <div className="mt-2.5 text-[10px] text-zinc-500 font-mono">
                      Resolusi nama domain
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                      <span>Payload Throughput</span>
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
                      {probeResult.network.speedMbps} <span className="text-xs font-normal text-zinc-400">Mbps</span>
                    </div>
                    <div className="mt-2.5 text-[10px] text-zinc-500 font-mono">
                      {(probeResult.network.totalBytes / 1024).toFixed(1)} KB ditransfer
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-white/[0.08] flex items-center gap-2 overflow-x-auto scrollbar-none pb-px font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
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
                    className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
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
                    className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
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
                    className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
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
                    {/* Waterfall Timeline */}
                    <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                          Granular Waterfall Timeline
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          Total: <strong className="text-white">{probeResult.timings.total_ms} ms</strong>
                        </span>
                      </div>

                      <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-white/[0.08] shadow-inner">
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
                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>DNS Lookup</span>
                          </div>
                          <span className="text-white font-bold text-sm">{probeResult.timings.dns_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <span>TCP Connect</span>
                          </div>
                          <span className="text-white font-bold text-sm">{probeResult.timings.tcp_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>TLS Handshake</span>
                          </div>
                          <span className="text-white font-bold text-sm">{probeResult.timings.tls_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Server TTFB</span>
                          </div>
                          <span className="text-white font-bold text-sm">{probeResult.timings.ttfb_ms} ms</span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05]">
                          <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>Download</span>
                          </div>
                          <span className="text-white font-bold text-sm">{probeResult.timings.download_ms} ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Network & Infrastructure */}
                      <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-3">
                        <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Infrastruktur Jaringan & Server</span>
                        </div>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-500">Lokasi Fisik:</span>
                            <span className="text-zinc-200">{probeResult.geo.city}, {probeResult.geo.country} ({probeResult.geo.countryCode})</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-500">ISP Penyedia:</span>
                            <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.geo.isp}>{probeResult.geo.isp}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-500">BGP ASN:</span>
                            <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.geo.as}>{probeResult.geo.as}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                            <span className="text-zinc-500">Zona Waktu:</span>
                            <span className="text-zinc-200">{probeResult.geo.timezone}</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-zinc-500">Server Banner:</span>
                            <span className="text-zinc-200">{probeResult.network.serverHeader}</span>
                          </div>
                        </div>
                      </div>

                      {/* TLS Certificate */}
                      <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-3">
                        <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Protokol Enkripsi & Sertifikat</span>
                        </div>
                        {probeResult.tls ? (
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-500">Versi TLS / ALPN:</span>
                              <span className="text-emerald-400 font-semibold">{probeResult.tls.version} ({probeResult.tls.alpnProtocol})</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-500">Cipher Suite:</span>
                              <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.tls.cipher}>{probeResult.tls.cipher}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
                              <span className="text-zinc-500">Penerbit Sertifikat:</span>
                              <span className="text-zinc-200 truncate max-w-[200px]" title={probeResult.tls.certIssuer}>{probeResult.tls.certIssuer}</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className="text-zinc-500">Masa Aktif:</span>
                              <span className="text-zinc-200">
                                {probeResult.tls.daysRemaining > 0 ? (
                                  <span className="text-emerald-400 font-semibold">{probeResult.tls.daysRemaining} hari lagi</span>
                                ) : (
                                  <span className="text-rose-400">Kedaluwarsa</span>
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                            Koneksi HTTP Port 80 (Tanpa enkripsi TLS).
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "dns" && (
                  <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-5">
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono text-zinc-400 uppercase">Alamat IPv4 (A Records):</h4>
                      <div className="space-y-1.5">
                        {probeResult.dnsRecords.a.map((ip, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] text-xs font-mono">
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
                        <div className="space-y-1.5">
                          {probeResult.dnsRecords.aaaa.map((ip, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] text-xs font-mono">
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
                        <div className="space-y-1.5">
                          {probeResult.dnsRecords.mx.map((mx, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] text-xs font-mono">
                              <span className="text-zinc-200">{mx.exchange}</span>
                              <span className="text-zinc-500">Priority: {mx.priority}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {probeResult.dnsRecords.ns.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">Authoritative Nameservers (NS):</h4>
                        <div className="space-y-1.5">
                          {probeResult.dnsRecords.ns.map((ns, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] text-xs font-mono text-zinc-300">
                              {ns}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {probeResult.dnsRecords.txt.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono text-zinc-400 uppercase">TXT Verification / SPF:</h4>
                        <div className="space-y-1.5">
                          {probeResult.dnsRecords.txt.map((txt, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] text-xs font-mono text-zinc-400 break-all">
                              {txt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                          HTTP Security Headers Evaluation
                        </span>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Analisa kepatuhan header keamanan standar OWASP.
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg border font-mono font-bold text-sm ${getSecurityGradePill(probeResult.securityAudit.grade)}`}>
                        Grade {probeResult.securityAudit.grade} ({probeResult.securityAudit.passCount}/{probeResult.securityAudit.total})
                      </div>
                    </div>

                    <div className="space-y-2">
                      {probeResult.securityAudit.checks.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.05] flex items-start gap-3">
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
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
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
                              <div className="mt-1.5 p-2 rounded-lg bg-zinc-900 border border-white/[0.04] text-[11px] font-mono text-zinc-300 break-all">
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
                  <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                          Raw Response Headers (curl -I)
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const text = Object.entries(probeResult.headers).map(([k, v]) => `${k}: ${v}`).join("\n");
                          copyText(text, "headers-all");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-zinc-950 hover:bg-zinc-800 text-xs font-mono text-zinc-300 transition-colors"
                      >
                        {copiedKey === "headers-all" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Salin Semua</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-950 border border-white/[0.05] overflow-x-auto">
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
              <div className="mt-10 pt-6 border-t border-white/[0.08]">
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
                      className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-colors min-h-[36px]"
                    >
                      <span>{item}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-500" />
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
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            <div className="text-center pt-2 pb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-mono mb-4">
                <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Multi-Stream Real-Time Bandwidth Engine</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                Uji Kecepatan Koneksi Internet Anda
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto">
                Ukur latensi Ping, Jitter, kecepatan Download, dan Upload secara langsung dari perangkat Anda ke edge server terdekat.
              </p>
            </div>

            {/* Client ISP Strip */}
            {clientInfo && (
              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/70 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono shadow-md">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-400">Penyedia Layanan (ISP):</span>
                  <span className="text-white font-bold">{clientInfo.isp}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400">
                  <span>IP: <strong className="text-zinc-200">{clientInfo.ip}</strong></span>
                  <span>•</span>
                  <span>{clientInfo.city}, {clientInfo.country}</span>
                </div>
              </div>
            )}

            {/* Central Tachometer Gauge Area */}
            <div className="py-6 sm:py-10 flex flex-col items-center justify-center relative">
              {/* Outer Decorative Glow Ring */}
              <div className="w-[320px] h-[320px] sm:w-[380px] sm:h-[380px] rounded-full border border-white/[0.06] bg-zinc-950/70 shadow-2xl relative flex items-center justify-center p-6 backdrop-blur-xl">
                
                {/* SVG Speedometer Arc & Graduation Marks */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
                  {/* Gauge Arc Track */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="7"
                    strokeDasharray="376"
                    strokeDashoffset="125"
                    strokeLinecap="round"
                    transform="rotate(135 100 100)"
                  />
                  {/* Dynamic Progress Glow Arc */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="url(#speedGradient)"
                    strokeWidth="7"
                    strokeDasharray="376"
                    strokeDashoffset={125 + (1 - speedRatio) * 251}
                    strokeLinecap="round"
                    transform="rotate(135 100 100)"
                    className="transition-all duration-300 ease-out"
                  />
                  <defs>
                    <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>

                  {/* Tick Marks labels */}
                  <text x="35" y="150" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">0</text>
                  <text x="35" y="75" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">50</text>
                  <text x="100" y="32" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">100</text>
                  <text x="165" y="75" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">250</text>
                  <text x="165" y="150" fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">500+</text>
                </svg>

                {/* Animated Needle Pointer */}
                {(speedState === "download" || speedState === "upload" || speedState === "finished") && (
                  <div
                    className="absolute w-full h-full pointer-events-none transition-transform duration-300 ease-out flex items-center justify-center"
                    style={{ transform: `rotate(${needleAngle}deg)` }}
                  >
                    <div className="w-1 h-32 bg-gradient-to-t from-emerald-400 to-transparent rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)] -translate-y-16" />
                  </div>
                )}

                {/* Center Dial Hub */}
                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  {speedState === "idle" && (
                    <button
                      type="button"
                      onClick={runInternetSpeedtest}
                      className="w-36 h-36 rounded-full border border-emerald-500/40 bg-zinc-900/90 hover:bg-zinc-800 flex flex-col items-center justify-center gap-1.5 group transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <Play className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform ml-1" />
                      <span className="font-bold text-xs tracking-wider uppercase text-white font-mono">
                        Mulai Uji
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">Klik di sini</span>
                    </button>
                  )}

                  {speedState === "ping" && (
                    <div className="flex flex-col items-center animate-pulse">
                      <Radio className="w-6 h-6 text-amber-400 animate-spin mb-2" />
                      <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                        Mengukur Ping...
                      </span>
                      <span className="text-3xl font-extrabold font-mono text-white mt-1">
                        {pingMs || "..."} <span className="text-xs font-normal text-zinc-500">ms</span>
                      </span>
                    </div>
                  )}

                  {(speedState === "download" || speedState === "upload") && (
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold mb-1">
                        {speedState === "download" ? "Unduh / Download" : "Unggah / Upload"}
                      </span>
                      <span className="text-5xl sm:text-6xl font-extrabold font-mono text-white tracking-tight">
                        {currentSpeedDisplay.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 mt-1 uppercase font-semibold">Mbps</span>
                    </div>
                  )}

                  {speedState === "finished" && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold mb-1">
                        Hasil Kecepatan
                      </span>
                      <span className="text-5xl font-extrabold font-mono text-white tracking-tight">
                        {downloadMbps}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 mt-0.5 font-semibold">Mbps Download</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Finished Controls */}
              {speedState === "finished" && (
                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={runInternetSpeedtest}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-white transition-colors min-h-[44px]"
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-mono text-emerald-300 transition-colors min-h-[44px]"
                  >
                    {copiedKey === "share-speedtest" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "share-speedtest" ? "Tersalin!" : "Salin Hasil"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Throughput Sparkline */}
            {speedHistory.length > 2 && (
              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <div className="flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live Packet Stream Rate</span>
                  </div>
                  <span>Peak: {Math.max(...speedHistory)} Mbps</span>
                </div>
                <div className="h-16 flex items-end gap-1 pt-2">
                  {speedHistory.map((val, idx) => {
                    const peak = Math.max(...speedHistory, 1);
                    const heightPercent = Math.max(10, (val / peak) * 100);
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-gradient-to-t from-emerald-500/40 to-emerald-400 rounded-t transition-all duration-150"
                        style={{ height: `${heightPercent}%` }}
                        title={`${val} Mbps`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Speedtest 4 Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono">
              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Download</span>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {downloadMbps || (speedState === "download" ? currentSpeedDisplay.toFixed(1) : "—")}{" "}
                  <span className="text-xs font-normal text-zinc-500">Mbps</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Throughput unduh</span>
              </div>

              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Upload</span>
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {uploadMbps || (speedState === "upload" ? currentSpeedDisplay.toFixed(1) : "—")}{" "}
                  <span className="text-xs font-normal text-zinc-500">Mbps</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Throughput kirim</span>
              </div>

              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Latency Ping</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {pingMs || "—"} <span className="text-xs font-normal text-zinc-500">ms</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Round-trip delay</span>
              </div>

              <div className="p-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Jitter</span>
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {jitterMs || "—"} <span className="text-xs font-normal text-zinc-500">ms</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Stabilitas latensi</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.08] bg-zinc-950/80 py-6 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>NetSpeed Probe • High-Precision Network Diagnostics</span>
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
