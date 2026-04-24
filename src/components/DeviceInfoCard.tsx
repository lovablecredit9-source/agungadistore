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

  const Row = ({ icon: Icon, label, value, className = "", iconClass = "text-muted-foreground", colSpan = false }: {
    icon: any; label: string; value: string; className?: string; iconClass?: string; colSpan?: boolean;
  }) => (
    <div className={`flex items-center gap-1.5 ${colSpan ? "col-span-2" : ""}`}>
      <Icon className={`w-3 h-3 flex-shrink-0 ${iconClass}`} />
      <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className={`font-semibold truncate ${className}`}>{value}</span>
    </div>
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Smartphone className="w-4 h-4 text-primary" />
          Info Perangkat
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <Row icon={Cpu} label="Perangkat" value={data.deviceModel} colSpan />
          <Row icon={Smartphone} label="OS" value={data.os} />
          <Row icon={Navigation} label="Browser" value={data.browser} />
          <Row icon={Monitor} label="Layar" value={data.screenSize} />
          <Row icon={Clock} label="Latensi" value={data.rttMs !== null ? `${data.rttMs} ms` : "N/A"} className="animate-pulse" />

          {/* Battery */}
          <Row icon={Battery} label="Baterai"
            value={data.batteryLevel !== null ? `${data.batteryLevel}%${data.batteryCharging ? " ⚡" : ""}` : "N/A"}
            className={batteryColor} iconClass={batteryColor} />

          {/* Connection */}
          <Row
            icon={data.connectionType === "WiFi" ? Wifi : Signal}
            label="Koneksi"
            value={`${data.connectionType}${data.effectiveType ? ` (${data.effectiveType.toUpperCase()})` : ""}`}
            iconClass={data.connectionType === "WiFi" ? "text-blue-500" : "text-muted-foreground"}
          />

          <Row icon={Signal} label="Kecepatan" value={data.downlinkMbps !== null ? `${data.downlinkMbps} Mbps` : "N/A"} className="animate-pulse" />

          {/* Charging section */}
          <div className="col-span-2 border-t border-primary/10 pt-1.5 mt-0.5" />
          <Row icon={BatteryCharging} label="Pengisian"
            value={`${data.chargingType}${data.estimatedWatts ? ` (~${data.estimatedWatts}W)` : ""}`}
            iconClass={data.batteryCharging ? "text-green-500" : "text-muted-foreground"} colSpan />

          {data.batteryCharging && (
            <Row icon={Timer} label="Penuh dalam" value={data.estimatedTimeToFull || "-"}
              iconClass="text-green-500" className="text-green-600" colSpan />
          )}

          {/* IP & Location section */}
          <div className="col-span-2 border-t border-primary/10 pt-1.5 mt-0.5" />
          <Row icon={Globe} label="IP" value={data.ipAddress} colSpan />
          <Row icon={MapPin} label="Lokasi" value={data.location} colSpan />
          {data.isp && <Row icon={Signal} label="ISP" value={data.isp} colSpan />}

          <div className="col-span-2 text-[10px] text-muted-foreground/60 italic border-t border-primary/10 pt-1 mt-0.5">
            ℹ️ Info kartu SIM/operator tidak tersedia di browser. ISP ditampilkan sebagai alternatif.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceInfoCard;
