import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smartphone, Battery, Wifi, Signal, Navigation, Clock, Monitor
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
  simCarrier: string;
  screenSize: string;
  platform: string;
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

const DeviceInfoCard = () => {
  const [data, setData] = useState<DeviceData | null>(null);

  useEffect(() => {
    let batteryCleanup: (() => void) | null = null;

    const collect = async () => {
      const osInfo = getOSInfo();
      const nav = navigator as any;

      // Battery
      let batteryLevel: number | null = null;
      let batteryCharging: boolean | null = null;
      try {
        if (nav.getBattery) {
          const batt = await nav.getBattery();
          batteryLevel = Math.round(batt.level * 100);
          batteryCharging = batt.charging;
          const update = () => {
            setData(prev => prev ? {
              ...prev,
              batteryLevel: Math.round(batt.level * 100),
              batteryCharging: batt.charging
            } : prev);
          };
          batt.addEventListener("levelchange", update);
          batt.addEventListener("chargingchange", update);
          batteryCleanup = () => {
            batt.removeEventListener("levelchange", update);
            batt.removeEventListener("chargingchange", update);
          };
        }
      } catch {}

      // Connection
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      let connectionType = "Tidak diketahui";
      let effectiveType = "";
      let downlinkMbps: number | null = null;
      let rttMs: number | null = null;

      if (conn) {
        const ct = conn.type || "";
        if (ct === "wifi") connectionType = "WiFi";
        else if (ct === "cellular") connectionType = "Data Seluler";
        else if (ct === "ethernet") connectionType = "Ethernet";
        else if (ct === "none") connectionType = "Tidak ada koneksi";
        else if (ct === "bluetooth") connectionType = "Bluetooth";
        else connectionType = ct || "Tidak diketahui";

        effectiveType = conn.effectiveType || "";
        downlinkMbps = conn.downlink ?? null;
        rttMs = conn.rtt ?? null;
      }

      // SIM / Carrier - not directly available in browser, show connection info
      let simCarrier = "Tidak tersedia di browser";

      // Screen
      const screenSize = `${window.screen.width}x${window.screen.height}`;

      // UA-Data for better info
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

      setData({
        deviceType: getDeviceType(),
        os: platform,
        osVersion,
        browser: getBrowser(),
        batteryLevel,
        batteryCharging,
        connectionType,
        effectiveType,
        downlinkMbps,
        rttMs,
        simCarrier,
        screenSize,
        platform
      });
    };

    collect();

    // Listen connection changes
    const conn = (navigator as any).connection;
    const onConnChange = () => {
      if (!conn) return;
      setData(prev => prev ? {
        ...prev,
        connectionType: conn.type === "wifi" ? "WiFi" : conn.type === "cellular" ? "Data Seluler" : conn.type || "Tidak diketahui",
        effectiveType: conn.effectiveType || "",
        downlinkMbps: conn.downlink ?? null,
        rttMs: conn.rtt ?? null,
      } : prev);
    };
    conn?.addEventListener?.("change", onConnChange);

    return () => {
      batteryCleanup?.();
      conn?.removeEventListener?.("change", onConnChange);
    };
  }, []);

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
          {/* Mode HP */}
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

          {/* RTT / Latency */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Latensi:</span>
            <span className="font-semibold">
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

          {/* Speed */}
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Kecepatan:</span>
            <span className="font-semibold">
              {data.downlinkMbps !== null ? `${data.downlinkMbps} Mbps` : "N/A"}
            </span>
          </div>

          {/* Screen */}
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Layar:</span>
            <span className="font-semibold">{data.screenSize}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceInfoCard;
