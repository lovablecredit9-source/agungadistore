import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Loader2, Crown, Users, KeyRound, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string | null }
type Choice = "rock" | "paper" | "scissors";
const EMOJI: Record<Choice, string> = { rock: "✊", paper: "✋", scissors: "✌️" };

interface Room {
  id: string; room_code: string | null; visibility: string; status: string;
  player1_visitor_id: string; player1_name: string;
  player2_visitor_id: string | null; player2_name: string | null;
  current_round: number; best_of: number;
  player1_score: number; player2_score: number;
  player1_choice: string | null; player2_choice: string | null;
  round_deadline_at: string | null; winner_visitor_id: string | null;
}

export default function GamePvPBattle({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [code, setCode] = useState("");
  const [secLeft, setSecLeft] = useState(60);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const myName = useRef<string>("");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      if (!visitorId) return;
      const { data } = await supabase.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle();
      myName.current = data?.display_name || `Player_${visitorId.slice(0, 4)}`;
    })();
  }, [visitorId]);

  // Realtime subscribe to room updates
  useEffect(() => {
    if (!room?.id) return;
    const ch = supabase.channel(`pvp_${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_pvp_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room))
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room?.id]);

  // Countdown + auto timeout-check
  useEffect(() => {
    if (!room || room.status !== "playing" || !room.round_deadline_at) return;
    const tick = setInterval(() => {
      const ms = new Date(room.round_deadline_at!).getTime() - Date.now();
      const s = Math.max(0, Math.ceil(ms / 1000));
      setSecLeft(s);
      if (s <= 0) {
        // tell server to resolve timeout
        supabase.functions.invoke("pvp-battle", { body: { action: "timeout_check", roomId: room.id, visitorId } });
      }
    }, 500);
    return () => clearInterval(tick);
  }, [room?.round_deadline_at, room?.status, room?.id, visitorId]);

  async function quickMatch() {
    if (!visitorId) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pvp-battle", {
      body: { action: "quick_match", visitorId, displayName: myName.current },
    });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
    setRoom(data.room);
  }

  async function createPrivate() {
    if (!visitorId) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pvp-battle", {
      body: { action: "create", visitorId, displayName: myName.current, visibility: "private" },
    });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
    setRoom(data.room);
  }

  async function joinByCode() {
    if (!visitorId || !code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pvp-battle", {
      body: { action: "join_code", visitorId, displayName: myName.current, code: code.trim() },
    });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
    setRoom(data.room); setCode("");
  }

  async function loadPublic() {
    const { data } = await supabase.functions.invoke("pvp-battle", { body: { action: "list_public", visitorId } });
    setPublicRooms(data?.rooms || []);
  }

  async function play(c: Choice) {
    if (!room || room.status !== "playing") return;
    const isP1 = room.player1_visitor_id === visitorId;
    const myChoice = isP1 ? room.player1_choice : room.player2_choice;
    if (myChoice) return;
    await supabase.functions.invoke("pvp-battle", { body: { action: "play", visitorId, roomId: room.id, choice: c } });
  }

  async function leaveRoom() {
    if (room && room.status === "waiting") {
      await supabase.functions.invoke("pvp-battle", { body: { action: "leave", visitorId, roomId: room.id } });
    }
    setRoom(null);
  }

  function copyCode() {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      toast({ title: "Kode disalin", description: room.room_code });
    }
  }

  const isP1 = room?.player1_visitor_id === visitorId;
  const myScore = isP1 ? room?.player1_score : room?.player2_score;
  const opScore = isP1 ? room?.player2_score : room?.player1_score;
  const myChoice = (isP1 ? room?.player1_choice : room?.player2_choice) as Choice | null;
  const opChoice = (isP1 ? room?.player2_choice : room?.player1_choice) as Choice | null;
  const opName = isP1 ? room?.player2_name : room?.player1_name;

  return (
    <>
      <button
        onClick={() => { setOpen(true); loadPublic(); }}
        disabled={!visitorId}
        className="w-full cyber-card-pink rounded-2xl p-3 text-left relative overflow-hidden disabled:opacity-50"
      >
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-pink-500/30 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Swords className="w-9 h-9 icon-3d-zap" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest neon-text-pink uppercase">PvP Battle Real-time</div>
            <div className="font-extrabold text-white text-sm">Suit 1v1 - Best of 5 (60s/ronde)</div>
            <div className="text-[10px] text-white/70">Quick Match atau Private Room</div>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white">PLAY</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) leaveRoom(); setOpen(v); }}>
        <DialogContent className="max-w-sm bg-gradient-to-br from-purple-950 via-slate-950 to-pink-950 border-pink-500/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="neon-gradient-text text-xl font-black flex items-center gap-2">
              <Swords className="w-5 h-5" /> PvP ARENA
            </DialogTitle>
          </DialogHeader>

          {/* No room: lobby */}
          {!room && (
            <Tabs defaultValue="quick">
              <TabsList className="grid w-full grid-cols-2 bg-black/40">
                <TabsTrigger value="quick" className="text-xs font-black"><Users className="w-3 h-3 mr-1" /> Quick Match</TabsTrigger>
                <TabsTrigger value="private" className="text-xs font-black"><KeyRound className="w-3 h-3 mr-1" /> Private Room</TabsTrigger>
              </TabsList>
              <TabsContent value="quick" className="space-y-3 mt-3">
                <Button onClick={quickMatch} disabled={busy} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black h-11">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Swords className="w-4 h-4 mr-1.5" /> CARI LAWAN OTOMATIS</>}
                </Button>
                <div className="text-[10px] font-black text-white/60 uppercase tracking-wider">Room Publik Aktif</div>
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                  {publicRooms.length === 0 && <div className="text-center text-xs text-white/50 py-4">Belum ada room. Klik "Cari Lawan" untuk buat.</div>}
                  {publicRooms.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-black/40 rounded-lg p-2 border border-pink-500/20">
                      <div className="text-xs font-bold text-white truncate">{r.player1_name}</div>
                      <Button size="sm" onClick={quickMatch} disabled={busy} className="h-6 text-[10px] bg-pink-500 text-white">Join</Button>
                    </div>
                  ))}
                </div>
                <Button onClick={loadPublic} variant="ghost" size="sm" className="w-full text-[10px] text-white/60">Refresh</Button>
              </TabsContent>
              <TabsContent value="private" className="space-y-3 mt-3">
                <Button onClick={createPrivate} disabled={busy} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black h-11">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4 mr-1.5" /> BUAT ROOM PRIBADI</>}
                </Button>
                <div className="text-[10px] text-white/60 text-center">- atau -</div>
                <div className="space-y-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Masukkan 6-digit kode" className="text-center text-lg font-black tracking-widest bg-black/40 border-pink-500/30 text-white" />
                  <Button onClick={joinByCode} disabled={busy || code.length !== 6} className="w-full bg-pink-500 text-white font-black">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "GABUNG ROOM"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Waiting */}
          {room && room.status === "waiting" && (
            <div className="py-6 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-pink-400 mx-auto" />
              <p className="text-white font-bold">Menunggu lawan bergabung...</p>
              {room.room_code && (
                <div className="bg-black/40 border border-pink-500/30 rounded-xl p-3">
                  <div className="text-[10px] text-white/60 mb-1">KODE ROOM (bagikan ke teman)</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-black neon-text-pink tracking-widest tabular-nums">{room.room_code}</span>
                    <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="w-4 h-4 text-white" /></Button>
                  </div>
                </div>
              )}
              <Button variant="ghost" onClick={leaveRoom} className="text-white/60"><X className="w-4 h-4 mr-1" /> Batal</Button>
            </div>
          )}

          {/* Playing */}
          {room && room.status === "playing" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-center text-center">
                <div>
                  <div className="text-[10px] text-white/60">KAMU</div>
                  <div className="text-2xl font-black neon-text-cyan">{myScore}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-white/70">RONDE {room.current_round}/{room.best_of}</div>
                  <div className={`text-2xl font-black tabular-nums ${secLeft <= 10 ? "text-red-400 animate-pulse" : "text-yellow-300"}`}>{secLeft}s</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/60 truncate">{opName || "..."}</div>
                  <div className="text-2xl font-black neon-text-pink">{opScore}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 py-3">
                <div className="aspect-square rounded-2xl bg-cyan-500/20 border-2 border-cyan-400/40 flex items-center justify-center text-5xl">
                  {myChoice ? EMOJI[myChoice] : "❓"}
                </div>
                <div className="aspect-square rounded-2xl bg-pink-500/20 border-2 border-pink-400/40 flex items-center justify-center text-5xl">
                  {opChoice && myChoice ? EMOJI[opChoice] : opChoice ? "✓" : "❓"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["rock", "paper", "scissors"] as Choice[]).map(c => (
                  <Button key={c} onClick={() => play(c)} disabled={!!myChoice}
                    className="h-14 text-3xl bg-black/40 border border-white/20 hover:bg-pink-500/30">{EMOJI[c]}</Button>
                ))}
              </div>
              {myChoice && !opChoice && <div className="text-[10px] text-center text-white/60">Menunggu lawan memilih...</div>}
            </div>
          )}

          {/* Finished */}
          {room && room.status === "finished" && (
            <div className="text-center py-6 space-y-3">
              <Crown className={`w-16 h-16 mx-auto ${room.winner_visitor_id === visitorId ? "text-yellow-400" : "text-slate-500"}`} />
              <div className="text-2xl font-black text-white">
                {room.winner_visitor_id === visitorId ? "VICTORY!" : room.winner_visitor_id ? "DEFEAT" : "DRAW"}
              </div>
              <div className="text-sm text-white/70">Skor akhir: {myScore} - {opScore}</div>
              <Button onClick={() => setRoom(null)} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black">MAIN LAGI</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
