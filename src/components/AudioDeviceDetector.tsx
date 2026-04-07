import { useState, useEffect } from "react";
import { Bluetooth, Speaker, Headphones, Smartphone, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

const AudioDeviceDetector = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const detectDevices = async () => {
    setLoading(true);
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = allDevices
        .filter(d => d.kind === "audiooutput")
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || "Perangkat Audio",
          kind: d.kind,
        }));
      setDevices(audioOutputs);
    } catch (e) {
      console.error("Gagal mendeteksi perangkat:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    detectDevices();
    navigator.mediaDevices?.addEventListener("devicechange", detectDevices);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", detectDevices);
  }, []);

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("bluetooth") || l.includes("bt") || l.includes("airpod") || l.includes("buds")) return <Bluetooth className="w-4 h-4 text-blue-500" />;
    if (l.includes("headphone") || l.includes("headset") || l.includes("earphone")) return <Headphones className="w-4 h-4 text-primary" />;
    if (l.includes("speaker") || l.includes("external")) return <Speaker className="w-4 h-4 text-primary" />;
    if (l.includes("phone") || l.includes("earpiece")) return <Smartphone className="w-4 h-4 text-muted-foreground" />;
    return <Volume2 className="w-4 h-4 text-muted-foreground" />;
  };

  const getDeviceType = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("bluetooth") || l.includes("bt") || l.includes("airpod") || l.includes("buds")) return "Bluetooth";
    if (l.includes("headphone") || l.includes("headset") || l.includes("earphone")) return "Headset";
    if (l.includes("speaker") || l.includes("external")) return "Speaker";
    return "Built-in";
  };

  if (devices.length === 0) return null;

  return (
    <Card className="border-primary/10">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-primary" /> Perangkat Audio
          </h4>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={detectDevices} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </Button>
        </div>
        <div className="space-y-1">
          {devices.map((d, i) => (
            <div key={d.deviceId || i} className={`flex items-center gap-2 p-1.5 rounded text-xs ${i === 0 ? "bg-primary/5 font-medium" : ""}`}>
              {getDeviceIcon(d.label)}
              <span className="flex-1 truncate">{d.label || "Audio Output"}</span>
              <span className="text-[10px] text-muted-foreground">{getDeviceType(d.label)}</span>
              {i === 0 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Aktif</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioDeviceDetector;
