import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smartphone, Battery, Wifi, Signal, Navigation, Clock, Monitor, Zap, BatteryCharging, Timer
} from "lucide-react";

interface DeviceData {
  deviceType: string;
  os: string;
  osVersion: string;
  browser: string;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  connectionType: string;
  effectiveType: string;
  downlinkMbps: number | null;
  rttMs: number | null;
  screenSize: string;
  platform: string;
  estimatedWatts: number | null;
  estimatedTimeToFull: string | null;
  chargingType: string;
}

function getOSInfo(): { os: string; version: string } {
  const ua = navigator.userAgent;
  if (/Android (\d+(\.\d+)*)/.test(ua)) {
    const v = ua.match(/Android (\d+(\.\d+)*)/)?.[1] || "";
    return { os: "Android", version: v };
  }
  if (/iPhone|iPad/.test(ua)) {
    const v = ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") || "";
    return { os: "iOS", version: v };
  }
  if (/Windows NT/.test(ua)) return { os: "Windows", version: "" };
  if (/Mac OS X/.test(ua)) return { os: "macOS", version: "" };
  if (/Linux/.test(ua)) return { os: "Linux", version: "" };
  return { os: "Unknown", version: "" };
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Browser";
  if (/Chrome\//.test(ua) && !/Edg/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "Tablet";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Mobile|Android/.test(ua)) return "HP (Mobile)";
  return "Desktop/Laptop";
}

function estimateChargingWatts(ratePerMinute: number, batteryCapacityWh: number): number {
  // ratePerMinute = % per minute
  // watts = (rate/100 * capacity) * 60
  return Math.round((ratePerMinute / 100) * batteryCapacityWh * 60 * 10) / 10;
}

function classifyCharging(watts: number): string {
  if (watts >= 60) return "SuperVOOC / SuperCharge";
  if (watts >= 30) return "Fast Charging";
  if (watts >= 15) return "Quick Charge";
  if (watts >= 7) return "Normal Charging";
  if (watts > 0) return "Slow Charging";
  return "Tidak mengisi";
}

function formatTimeToFull(currentLevel: number, ratePerMinute: number): string {
  if (ratePerMinute <= 0 || currentLevel >= 100) return "—";
  const remaining = 100 - currentLevel;
  const minutes = Math.round(remaining / ratePerMinute);
  if (minutes < 1) return "< 1 menit";
  if (minutes < 60) return `~${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h}j ${m}m`;
}

const BATTERY_CAPACITY_WH = 18; // ~5000mAh @ 3.7V, typical phone

const DeviceInfoCard = () => {
  const [data, setData] = useState<DeviceData | null>(null);
  const batteryHistoryRef = useRef<{ time: number; level: number }[]>([]);

  const updateChargingEstimate = useCallback((level: number, charging: boolean) => {
    const now = Date.now();
    const history = batteryHistoryRef.current;
    history.push({ time: now, level });

    // Keep last 20 samples
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

    if (!charging) {
      batteryHistoryRef.current = [];
    }

    setData(prev => prev ? {
      ...prev,
      batteryLevel: Math.round(level),
      batteryCharging: charging,
      estimatedWatts,
      estimatedTimeToFull,
      chargingType,
    } : prev);
  }, []);

  useEffect(() => {
    let batteryCleanup: (() => void) | null = null;
    let connectionPollId: ReturnType<typeof setInterval> | null = null;
    let batteryPollId: ReturnType<typeof setInterval> | null = null;

    const collect = async () => {
      const osInfo = getOSInfo();
      const nav = navigator as any;

      // Battery
      let batteryLevel: number | null = null;
      let batteryCharging: boolean | null = null;
      let batt: any = null;
      try {
        if (nav.getBattery) {
          batt = await nav.getBattery();
          batteryLevel = Math.round(batt.level * 100);
          batteryCharging = batt.charging;

          batteryHistoryRef.current = [{ time: Date.now(), level: batteryLevel! }];

          const update = () => {
            updateChargingEstimate(Math.round(batt.level * 100), batt.charging);
          };
          batt.addEventListener("levelchange", update);
          batt.addEventListener("chargingchange", update);
          batteryCleanup = () => {
            batt.removeEventListener("levelchange", update);
            batt.removeEventListener("chargingchange", update);
          };

          // Poll battery every 30s for charging estimate
          batteryPollId = setInterval(() => {
            updateChargingEstimate(Math.round(batt.level * 100), batt.charging);
          }, 30000);
        }
      } catch {}

      // Connection
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      const getConnData = () => {
        if (!conn) return {
          connectionType: "Tidak diketahui",
          effectiveType: "",
          downlinkMbps: null as number | null,
          rttMs: null as number | null,
        };
        const ct = conn.type || "";
        let connectionType = "Tidak diketahui";
        if (ct === "wifi") connectionType = "WiFi";
        else if (ct === "cellular") connectionType = "Data Seluler";
        else if (ct === "ethernet") connectionType = "Ethernet";
        else if (ct === "none") connectionType = "Tidak ada koneksi";
        else if (ct === "bluetooth") connectionType = "Bluetooth";
        else if (ct) connectionType = ct;
        return {
          connectionType,
          effectiveType: conn.effectiveType || "",
          downlinkMbps: conn.downlink ?? null,
          rttMs: conn.rtt ?? null,
        };
      };

      const screenSize = `${window.screen.width}x${window.screen.height}`;

      let platform = osInfo.os;
      let osVersion = osInfo.version;
      try {
        if (nav.userAgentData?.getHighEntropyValues) {
          const hints = await nav.userAgentData.getHighEntropyValues([
            "platform", "platformVersion", "model"
          ]);
          if (hints.platform) platform = hints.platform;
          if (hints.platformVersion) osVersion = hints.platformVersion;
        }
      } catch {}

      const connData = getConnData();

      setData({
        deviceType: getDeviceType(),
        os: platform,
        osVersion,
        browser: getBrowser(),
        batteryLevel,
        batteryCharging,
        ...connData,
        screenSize,
        platform,
        estimatedWatts: null,
        estimatedTimeToFull: batteryCharging ? "Menghitung..." : null,
        chargingType: batteryCharging ? "Menghitung..." : "Tidak mengisi",
      });

      // Poll connection stats every 3 seconds for real-time updates
      connectionPollId = setInterval(() => {
        const updated = getConnData();
        setData(prev => prev ? { ...prev, ...updated } : prev);
      }, 3000);

      // Listen connection changes too
      const onConnChange = () => {
        const updated = getConnData();
        setData(prev => prev ? { ...prev, ...updated } : prev);
      };
      conn?.addEventListener?.("change", onConnChange);
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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Smartphone className="w-4 h-4 text-primary" />
          Info Perangkat
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          {/* Device Type */}
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-semibold">{data.deviceType}</span>
          </div>

          {/* OS */}
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">OS:</span>
            <span className="font-semibold">
              {data.os}{data.osVersion ? ` ${data.osVersion}` : ""}
            </span>
          </div>

          {/* Browser */}
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Browser:</span>
            <span className="font-semibold">{data.browser}</span>
          </div>

          {/* RTT / Latency - live */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Latensi:</span>
            <span className="font-semibold animate-pulse">
              {data.rttMs !== null ? `${data.rttMs} ms` : "N/A"}
            </span>
          </div>

          {/* Battery */}
          <div className="flex items-center gap-1.5">
            <Battery className={`w-3 h-3 ${batteryColor}`} />
            <span className="text-muted-foreground">Baterai:</span>
            <span className={`font-semibold ${batteryColor}`}>
              {data.batteryLevel !== null
                ? `${data.batteryLevel}%${data.batteryCharging ? " ⚡" : ""}`
                : "N/A"}
            </span>
          </div>

          {/* Connection Type */}
          <div className="flex items-center gap-1.5">
            {data.connectionType === "WiFi"
              ? <Wifi className="w-3 h-3 text-blue-500" />
              : <Signal className="w-3 h-3 text-muted-foreground" />}
            <span className="text-muted-foreground">Koneksi:</span>
            <span className="font-semibold">
              {data.connectionType}
              {data.effectiveType ? ` (${data.effectiveType.toUpperCase()})` : ""}
            </span>
          </div>

          {/* Speed - live */}
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Kecepatan:</span>
            <span className="font-semibold animate-pulse">
              {data.downlinkMbps !== null ? `${data.downlinkMbps} Mbps` : "N/A"}
            </span>
          </div>

          {/* Screen */}
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Layar:</span>
            <span className="font-semibold">{data.screenSize}</span>
          </div>

          {/* Charging Type */}
          <div className="flex items-center gap-1.5 col-span-2 border-t border-primary/10 pt-1.5 mt-0.5">
            <BatteryCharging className={`w-3 h-3 ${data.batteryCharging ? "text-green-500" : "text-muted-foreground"}`} />
            <span className="text-muted-foreground">Pengisian:</span>
            <span className="font-semibold">
              {data.chargingType}
              {data.estimatedWatts ? ` (~${data.estimatedWatts}W)` : ""}
            </span>
          </div>

          {/* Time to full */}
          {data.batteryCharging && (
            <div className="flex items-center gap-1.5 col-span-2">
              <Timer className="w-3 h-3 text-green-500" />
              <span className="text-muted-foreground">Penuh dalam:</span>
              <span className="font-semibold text-green-600">
                {data.estimatedTimeToFull || "—"}
              </span>
            </div>
          )}

          {/* SIM info disclaimer */}
          <div className="col-span-2 text-[10px] text-muted-foreground/60 italic border-t border-primary/10 pt-1 mt-0.5">
            ℹ️ Info kartu SIM/operator tidak dapat diakses oleh browser (batasan keamanan)
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceInfoCard;
