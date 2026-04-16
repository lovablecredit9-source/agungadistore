import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import {
  Bot, Clock, CheckCircle2, XCircle, Loader2, ShoppingCart,
  Lock, Wifi, WifiOff, Crown, Sparkles, Timer, AlertCircle
} from "lucide-react";

interface BotPackage {
  id: string;
  name: string;
  duration_hours: number;
  price: number;
  sort_order: number;
}

interface BotSubscription {
  id: string;
  bot_name: string;
  status: string;
  price_paid: number;
  starts_at: string | null;
  expires_at: string | null;
  session_id: string | null;
  created_at: string;
  qr_code_url?: string | null;
  wa_bot_packages?: { name: string; duration_hours: number } | null;
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours} Jam`;
  if (hours < 168) return `${Math.round(hours / 24)} Hari`;
  if (hours < 720) return `${Math.round(hours / 168)} Minggu`;
  return `${Math.round(hours / 720)} Bulan`;
}

function formatPrice(p: number) {
  return `Rp${p.toLocaleString("id-ID")}`;
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d} hari ${h % 24} jam`;
  }
  return `${h} jam ${m} menit`;
}

const BotWaTab = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState<BotPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState<BotSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<BotPackage | null>(null);
  const [botName, setBotName] = useState("");
  const [pin, setPin] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);

  const visitorId = getVisitorId();

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [pkgRes, subRes, balRes] = await Promise.all([
        supabase.from("wa_bot_packages").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("wa_bot_subscriptions").select("*, wa_bot_packages(name, duration_hours)").eq("visitor_id", visitorId).order("created_at", { ascending: false }),
        supabase.from("user_balances").select("balance").eq("visitor_id", visitorId).maybeSingle(),
      ]);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (subRes.data) setSubscriptions(subRes.data as BotSubscription[]);
      if (balRes.data) setUserBalance(balRes.data.balance);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Refresh remaining time every minute
  useEffect(() => {
    const iv = setInterval(() => {
      setSubscriptions(prev => [...prev]);
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const handlePurchase = async () => {
    if (!selectedPkg || !botName.trim() || pin.length !== 6) {
      toast({ title: "Lengkapi data", description: "Nama bot & PIN 6 digit wajib diisi", variant: "destructive" });
      return;
    }
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-wa-bot", {
        body: { visitorId, packageId: selectedPkg.id, botName: botName.trim(), pin },
      });
      if (error || !data?.success) {
        toast({ title: "Gagal", description: data?.error || "Gagal membeli bot", variant: "destructive" });
        setPurchasing(false);
        return;
      }
      toast({ title: "✅ Berhasil!", description: `Bot "${botName}" berhasil dibuat. ID: ${data.trx_id}` });
      setShowPurchase(false);
      setSelectedPkg(null);
      setBotName("");
      setPin("");
      fetchData();
    } catch {
      toast({ title: "Error", description: "Terjadi kesalahan", variant: "destructive" });
    }
    setPurchasing(false);
  };

  const activeSubs = subscriptions.filter(s => s.status === "active" && s.expires_at && new Date(s.expires_at) > new Date());
  const pendingSubs = subscriptions.filter(s => ["pending", "connecting"].includes(s.status) && (!s.expires_at || new Date(s.expires_at) > new Date()));
  const expiredSubs = subscriptions.filter(s => s.status === "expired" || (s.expires_at && new Date(s.expires_at) <= new Date()));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" /> Sewa Bot WA
        </h2>
        {userBalance !== null && (
          <Badge variant="outline" className="gap-1 text-xs">
            Saldo: {formatPrice(userBalance)}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Sewa bot WhatsApp pribadi. Setelah beli via bot WA, QR code dikirim otomatis. Bot aktif setelah scan QR dan disconnect otomatis saat masa sewa habis.
      </p>

      {/* Packages */}
      <div className="grid grid-cols-2 gap-2">
        {packages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${selectedPkg?.id === pkg.id ? "ring-2 ring-primary border-primary" : ""}`}
            onClick={() => {
              setSelectedPkg(pkg);
              setShowPurchase(true);
            }}
          >
            <CardContent className="p-3 text-center space-y-1">
              <div className="flex items-center justify-center">
                <Timer className="w-4 h-4 text-primary mr-1" />
                <span className="text-sm font-bold">{pkg.name}</span>
              </div>
              <div className="text-lg font-extrabold text-primary">{formatPrice(pkg.price)}</div>
              <div className="text-[10px] text-muted-foreground">{formatDuration(pkg.duration_hours)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Purchase Form */}
      {showPurchase && selectedPkg && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" /> Beli {selectedPkg.name}
              </h3>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowPurchase(false)}>✕</Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Paket:</span><span className="font-bold">{selectedPkg.name}</span></div>
              <div className="flex justify-between"><span>Durasi:</span><span>{formatDuration(selectedPkg.duration_hours)}</span></div>
              <div className="flex justify-between"><span>Harga:</span><span className="font-bold text-primary">{formatPrice(selectedPkg.price)}</span></div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Nama Bot <span className="text-destructive">*</span></label>
              <Input
                placeholder="Contoh: Bot Jualan Aku"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                maxLength={50}
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Lock className="w-3 h-3" /> PIN 6 Digit <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-sm tracking-widest"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handlePurchase}
              disabled={purchasing || !botName.trim() || pin.length !== 6}
            >
              {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {purchasing ? "Memproses..." : `Bayar ${formatPrice(selectedPkg.price)}`}
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Setelah bayar via bot WA, QR code dikirim otomatis. Scan untuk mengaktifkan bot.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active Subscriptions */}
      {activeSubs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-green-600">
            <Wifi className="w-4 h-4" /> Bot Aktif
          </h3>
          {activeSubs.map((sub) => (
            <Card key={sub.id} className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{sub.bot_name}</span>
                  <Badge className="bg-green-500/20 text-green-700 text-[10px]">Aktif</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Sisa: {sub.expires_at ? timeRemaining(sub.expires_at) : "-"}
                </div>
                {sub.wa_bot_packages && (
                  <div className="text-[10px] text-muted-foreground">Paket: {sub.wa_bot_packages.name}</div>
                )}
                {sub.qr_code_url && (
                  <div className="mt-2 p-2 bg-white rounded-lg text-center">
                    <p className="text-[10px] text-gray-600 mb-1 font-medium">📱 Scan QR di WhatsApp → Linked Devices</p>
                    <img src={sub.qr_code_url} alt="QR Code Bot WA" className="mx-auto max-w-[200px] rounded" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pending Subscriptions */}
      {pendingSubs.length > 0 && (
        <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-yellow-600">
              <AlertCircle className="w-4 h-4" /> Menunggu Aktivasi
          </h3>
          {pendingSubs.map((sub) => (
            <Card key={sub.id} className={sub.status === "connecting" ? "border-blue-500/30 bg-blue-500/5" : "border-yellow-500/30 bg-yellow-500/5"}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{sub.bot_name}</span>
                  <Badge className={sub.status === "connecting" ? "bg-blue-500/20 text-blue-700 text-[10px]" : "bg-yellow-500/20 text-yellow-700 text-[10px]"}>
                    {sub.status === "connecting" ? "Menghubungkan" : "Pending"}
                  </Badge>
                </div>
                {sub.qr_code_url ? (
                  <div className="p-2 bg-white rounded-lg text-center">
                    <p className="text-[10px] text-gray-600 mb-1 font-medium">📱 Scan QR di WhatsApp → Linked Devices</p>
                    <img src={sub.qr_code_url} alt="QR Code Bot WA" className="mx-auto max-w-[200px] rounded" />
                    <p className="text-[10px] text-green-600 mt-1">Setelah scan, status akan update otomatis di panel.</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {sub.status === "connecting"
                      ? "🔄 QR sudah discan. Sistem sedang menyelesaikan koneksi bot ke WhatsApp."
                      : "⏳ QR sedang digenerate otomatis via bot WA. Cek chat bot Anda."}
                  </div>
                )}
                {sub.wa_bot_packages && (
                  <div className="text-[10px] text-muted-foreground">Paket: {sub.wa_bot_packages.name}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Expired */}
      {expiredSubs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
            <WifiOff className="w-4 h-4" /> Riwayat / Expired
          </h3>
          {expiredSubs.slice(0, 5).map((sub) => (
            <Card key={sub.id} className="opacity-60">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{sub.bot_name}</span>
                  <Badge variant="outline" className="text-[10px]">Expired</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {sub.wa_bot_packages?.name} • {formatPrice(sub.price_paid)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-muted/40">
        <CardContent className="p-3 space-y-1.5">
          <h4 className="text-xs font-bold flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-primary" /> Cara Kerja
          </h4>
          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Ketik <b>!sewabot</b> di WhatsApp bot untuk lihat paket</li>
            <li>Pilih paket dan masukkan nama bot custom</li>
            <li>Konfirmasi dengan PIN 6 digit</li>
            <li>QR code dikirim otomatis (refresh tiap 30 detik)</li>
            <li>Scan QR di WhatsApp → Perangkat Tertaut</li>
            <li>Bot otomatis aktif setelah tersambung</li>
            <li>Masa habis → bot otomatis disconnect</li>
            <li>Perpanjang kapan saja: <b>!sewabot [paket]</b></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotWaTab;
