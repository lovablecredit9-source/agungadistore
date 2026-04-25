import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smartphone, Battery, Wifi, Signal, Navigation, Clock, Monitor, 
  BatteryCharging, Timer, MapPin, Globe, Cpu
} from "lucide-react";
import { collectDeviceInfo } from "@/lib/device-info";

interface DeviceData {
  deviceType: string;
  os: string;
  osVersion: string;
  browser: string;
  deviceModel: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  connectionType: string;
  effectiveType: string;
  downlinkMbps: number | null;
  rttMs: number | null;
  screenSize: string;
  estimatedWatts: number | null;
  estimatedTimeToFull: string | null;
  chargingType: string;
  ipAddress: string;
  location: string;
  isp: string;
}

function estimateChargingWatts(ratePerMinute: number, capacityWh: number): number {
  return Math.round((ratePerMinute / 100) * capacityWh * 60 * 10) / 10;
}

function classifyCharging(watts: number): string {
  if (watts >= 60) return "SuperVOOC / SuperCharge";
  if (watts >= 30) return "Fast Charging";
  if (watts >= 15) return "Quick Charge";
  if (watts >= 7) return "Normal";
  if (watts > 0) return "Slow";
  return "Tidak mengisi";
}

function formatTimeToFull(currentLevel: number, ratePerMinute: number): string {
  if (ratePerMinute <= 0 || currentLevel >= 100) return "-";
  const remaining = 100 - currentLevel;
  const minutes = Math.round(remaining / ratePerMinute);
  if (minutes < 1) return "< 1 menit";
  if (minutes < 60) return `~${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h}j ${m}m`;
}

const BATTERY_CAPACITY_WH = 18;

const DeviceInfoCard = () => {
  const [data, setData] = useState<DeviceData | null>(null);
  const batteryHistoryRef = useRef<{ time: number; level: number }[]>([]);

  const updateChargingEstimate = useCallback((level: number, charging: boolean) => {
    const now = Date.now();
    const history = batteryHistoryRef.current;
    history.push({ time: now, level });
    if (history.length > 20) history.shift();

    let estimatedWatts: number | null = null;
    let estimatedTimeToFull: string | null = null;
    let chargingType = "Tidak mengisi";

    if (charging && history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const timeDiffMin = (newest.time - oldest.time) / 60000;
      const levelDiff = newest.level - oldest.level;
      if (timeDiffMin > 0.3 && levelDiff > 0) {
        const ratePerMin = levelDiff / timeDiffMin;
        estimatedWatts = estimateChargingWatts(ratePerMin, BATTERY_CAPACITY_WH);
        chargingType = classifyCharging(estimatedWatts);
        estimatedTimeToFull = formatTimeToFull(level, ratePerMin);
      } else {
        chargingType = "Menghitung...";
        estimatedTimeToFull = "Menghitung...";
      }
    }
    if (!charging) batteryHistoryRef.current = [];

    setData(prev => prev ? {
      ...prev, batteryLevel: Math.round(level), batteryCharging: charging,
      estimatedWatts, estimatedTimeToFull, chargingType,
    } : prev);
  }, []);

  useEffect(() => {
    let batteryCleanup: (() => void) | null = null;
    let connectionPollId: ReturnType<typeof setInterval> | null = null;
    let batteryPollId: ReturnType<typeof setInterval> | null = null;

    const collect = async () => {
      const nav = navigator as any;

      // Device info from existing lib
      const deviceInfo = await collectDeviceInfo();

      // Battery
      let batteryLevel: number | null = null;
      let batteryCharging: boolean | null = null;
      try {
        if (nav.getBattery) {
          const batt = await nav.getBattery();
          batteryLevel = Math.round(batt.level * 100);
          batteryCharging = batt.charging;
          batteryHistoryRef.current = [{ time: Date.now(), level: batteryLevel! }];
          const update = () => updateChargingEstimate(Math.round(batt.level * 100), batt.charging);
          batt.addEventListener("levelchange", update);
          batt.addEventListener("chargingchange", update);
          batteryCleanup = () => {
            batt.removeEventListener("levelchange", update);
            batt.removeEventListener("chargingchange", update);
          };
          batteryPollId = setInterval(() => {
            updateChargingEstimate(Math.round(batt.level * 100), batt.charging);
          }, 30000);
        }
      } catch {}

      // Connection
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      const getConnData = () => {
        if (!conn) return { connectionType: "Tidak diketahui", effectiveType: "", downlinkMbps: null as number | null, rttMs: null as number | null };
        const ct = conn.type || "";
        let connectionType = "Tidak diketahui";
        if (ct === "wifi") connectionType = "WiFi";
        else if (ct === "cellular") connectionType = "Data Seluler";
        else if (ct === "ethernet") connectionType = "Ethernet";
        else if (ct === "none") connectionType = "Tidak ada koneksi";
        else if (ct) connectionType = ct;
        return {
          connectionType, effectiveType: conn.effectiveType || "",
          downlinkMbps: conn.downlink ?? null, rttMs: conn.rtt ?? null,
        };
      };

      // IP & Location via free API (try multiple providers)
      let ipAddress = "Memuat...";
      let location = "Memuat...";
      let isp = "";
      try {
        // Primary: ip-api.com (no CORS issues, generous rate limit)
        const res = await fetch("http://ip-api.com/json/?fields=query,city,regionName,country,isp", { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const ip = await res.json();
          if (ip.status === "success" || ip.query) {
            ipAddress = ip.query || "N/A";
            location = [ip.city, ip.regionName, ip.country].filter(Boolean).join(", ") || "N/A";
            isp = ip.isp || "";
          } else {
            throw new Error("primary failed");
          }
        } else {
          throw new Error("primary failed");
        }
      } catch {
        // Fallback: ipapi.co
        try {
          const res2 = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
          if (res2.ok) {
            const ip2 = await res2.json();
            ipAddress = ip2.ip || "N/A";
            location = [ip2.city, ip2.region, ip2.country_name].filter(Boolean).join(", ") || "N/A";
            isp = ip2.org || "";
          }
        } catch {
          ipAddress = "Tidak tersedia";
          location = "Tidak tersedia";
        }
      }

      const connData = getConnData();
      const screenSize = `${window.screen.width}x${window.screen.height}`;

      setData({
        deviceType: deviceInfo.device,
        os: deviceInfo.os,
        osVersion: "",
        browser: deviceInfo.browser,
        deviceModel: deviceInfo.device,
        batteryLevel,
        batteryCharging,
        ...connData,
        screenSize,
        estimatedWatts: null,
        estimatedTimeToFull: batteryCharging ? "Menghitung..." : null,
        chargingType: batteryCharging ? "Menghitung..." : "Tidak mengisi",
        ipAddress,
        location,
        isp,
      });

      // Poll connection every 3s
      connectionPollId = setInterval(() => {
        setData(prev => prev ? { ...prev, ...getConnData() } : prev);
      }, 3000);

      conn?.addEventListener?.("change", () => {
        setData(prev => prev ? { ...prev, ...getConnData() } : prev);
      });
    };

    collect();
    return () => {
      batteryCleanup?.();
      if (connectionPollId) clearInterval(connectionPollId);
      if (batteryPollId) clearInterval(batteryPollId);
    };
  }, [updateChargingEstimate]);

  if (!data) return null;

  const batteryColor = data.batteryLevel !== null
    ? data.batteryLevel > 50 ? "text-green-500" : data.batteryLevel > 20 ? "text-yellow-500" : "text-red-500"
    : "text-muted-foreground";

  const Row = ({ icon: Icon, label, value, className = "", iconClass = "text-fuchsia-300", colSpan = false, accent = "from-fuchsia-500/20 to-purple-500/10" }: {
    icon: any; label: string; value: string; className?: string; iconClass?: string; colSpan?: boolean; accent?: string;
  }) => (
    <div className={`group relative flex items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-br ${accent} px-2 py-1.5 backdrop-blur-sm transition-all hover:border-pink-400/50 hover:shadow-[0_0_12px_rgba(236,72,153,0.35)] ${colSpan ? "col-span-2" : ""}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 ${iconClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-white/50 leading-none mb-0.5">{label}</div>
        <div className={`text-[11px] font-bold text-white truncate leading-tight ${className}`}>{value}</div>
      </div>
    </div>
  );

  const battPct = data.batteryLevel ?? 0;
  const battBarColor = battPct > 50 ? "from-emerald-400 to-green-500" : battPct > 20 ? "from-yellow-400 to-amber-500" : "from-red-400 to-rose-500";

  return (
    <div className="relative rounded-2xl p-[1.5px] shadow-[0_18px_50px_-15px_rgba(217,70,239,0.7)]"
      style={{
        background: "linear-gradient(120deg, #ec4899, #a855f7, #6366f1, #06b6d4, #ec4899)",
        backgroundSize: "300% 300%",
        animation: "aurora-shift 8s ease infinite",
      }}
    >
      <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#1a0b2e]/95 via-[#2a0f47]/95 to-[#0f0a3d]/95 backdrop-blur-xl">
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-8 w-44 h-44 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full bg-cyan-400/10 blur-2xl" />

        {/* Shine sweep */}
        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
          style={{ animation: "shine-sweep 6s linear infinite" }} />

        <div className="relative p-3.5 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute inset-0 rounded-lg bg-pink-500/40 blur-md" />
                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_12px_rgba(236,72,153,0.7)]">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-fuchsia-300/80 font-bold">Diagnostics</div>
                <div className="text-sm font-black text-white drop-shadow-[0_1px_4px_rgba(236,72,153,0.5)]">Info Perangkat</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-200">Live</span>
            </div>
          </div>

          {/* Battery hero strip */}
          {data.batteryLevel !== null && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {data.batteryCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-white/70" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Baterai</span>
                  {data.batteryCharging && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[8px] font-black text-emerald-200 uppercase">
                      ⚡ Charging
                    </span>
                  )}
                </div>
                <span className="text-sm font-black text-white tabular-nums">{battPct}%</span>
              </div>
              <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${battBarColor} transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]`}
                  style={{ width: `${battPct}%` }} />
                {data.batteryCharging && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{ animation: "shine-sweep 2s linear infinite" }} />
                )}
              </div>
              {data.batteryCharging && data.estimatedTimeToFull && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-300">
                  <Timer className="w-3 h-3" /> Penuh dalam {data.estimatedTimeToFull}
                  {data.estimatedWatts && <span className="ml-auto text-white/50">~{data.estimatedWatts}W ({data.chargingType})</span>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <Row icon={Cpu} label="Perangkat" value={data.deviceModel} colSpan iconClass="text-pink-300" accent="from-pink-500/20 to-fuchsia-500/10" />
            <Row icon={Smartphone} label="OS" value={data.os} iconClass="text-purple-300" accent="from-purple-500/20 to-indigo-500/10" />
            <Row icon={Navigation} label="Browser" value={data.browser} iconClass="text-indigo-300" accent="from-indigo-500/20 to-blue-500/10" />
            <Row icon={Monitor} label="Layar" value={data.screenSize} iconClass="text-cyan-300" accent="from-cyan-500/20 to-sky-500/10" />
            <Row icon={Clock} label="Latensi" value={data.rttMs !== null ? `${data.rttMs} ms` : "N/A"} className="animate-pulse" iconClass="text-amber-300" accent="from-amber-500/20 to-orange-500/10" />

            <Row
              icon={data.connectionType === "WiFi" ? Wifi : Signal}
              label="Koneksi"
              value={`${data.connectionType}${data.effectiveType ? ` (${data.effectiveType.toUpperCase()})` : ""}`}
              iconClass={data.connectionType === "WiFi" ? "text-blue-300" : "text-white/70"}
              accent="from-blue-500/20 to-cyan-500/10"
              colSpan
            />

            <Row icon={Signal} label="Kecepatan" value={data.downlinkMbps !== null ? `${data.downlinkMbps} Mbps` : "N/A"} className="animate-pulse" colSpan iconClass="text-emerald-300" accent="from-emerald-500/20 to-teal-500/10" />

            {/* IP & Location */}
            <div className="col-span-2 flex items-center gap-2 my-0.5">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-400/30 to-transparent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/70">Network</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-400/30 to-transparent" />
            </div>
            <Row icon={Globe} label="IP" value={data.ipAddress} colSpan iconClass="text-violet-300" accent="from-violet-500/20 to-purple-500/10" />
            <Row icon={MapPin} label="Lokasi" value={data.location} colSpan iconClass="text-rose-300" accent="from-rose-500/20 to-pink-500/10" />
            {data.isp && <Row icon={Signal} label="ISP" value={data.isp} colSpan iconClass="text-teal-300" accent="from-teal-500/20 to-emerald-500/10" />}
          </div>

          <div className="text-[10px] text-white/40 italic flex items-start gap-1 pt-1 border-t border-white/10">
            <span>ℹ️</span>
            <span>Info kartu SIM/operator tidak tersedia di browser. ISP ditampilkan sebagai alternatif.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoCard;
