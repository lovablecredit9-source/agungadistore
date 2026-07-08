import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sliders, RotateCcw, Headphones, Zap, Music, Repeat, Gauge, Sparkles, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAudioFx, EQ_PRESETS, EQ_FREQS, type AudioFxSettings } from "@/lib/audio-visualizer";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional A-B loop controls — when provided, shown as extra section */
  abLoop?: {
    enabled: boolean;
    a: number | null;
    b: number | null;
    currentTime: number;
    onSetA: () => void;
    onSetB: () => void;
    onClear: () => void;
    onToggle: (v: boolean) => void;
  };
  /** Optional crossfade seconds (0-12) controlled outside */
  crossfade?: {
    seconds: number;
    onChange: (s: number) => void;
  };
}

const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0+$/, "");
const fmtTime = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function AudioFxSettings({ open, onClose, abLoop, crossfade }: Props) {
  const { fx, setFx, reset } = useAudioFx();
  const [tab, setTab] = useState<"audio" | "playback">("audio");

  const updateEq = (i: number, v: number) => {
    const next = [...fx.eq] as AudioFxSettings["eq"];
    next[i] = v;
    setFx({ eq: next, eqPreset: "Custom" });
  };

  const applyPreset = (name: string) => {
    const preset = EQ_PRESETS[name];
    if (!preset) return;
    setFx({ eq: [...preset] as AudioFxSettings["eq"], eqPreset: name });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-violet-950 via-fuchsia-950 to-slate-950 border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-900/80 to-fuchsia-900/80 backdrop-blur-md border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Sliders className="w-5 h-5 text-fuchsia-300" />
                <h3 className="font-bold text-base">Audio Studio</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={reset} className="text-white/80 hover:text-white h-8 px-2">
                  <RotateCcw className="w-4 h-4 mr-1" /> Reset
                </Button>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 pt-3 flex gap-2">
              {(["audio", "playback"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
                    tab === t
                      ? "bg-white text-fuchsia-700 shadow-lg"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {t === "audio" ? "🎚️ Audio FX" : "⚡ Playback"}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {tab === "audio" && (
                <>
                  {/* Balance L/R */}
                  <Card icon={<Headphones className="w-4 h-4" />} title="Karaoke & Balance L/R">
                    {/* Karaoke Only — both speakers instrumental */}
                    <button
                      onClick={() => setFx({ karaokeOnly: !fx.karaokeOnly, balance: 0, mono: false })}
                      className={`w-full mb-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        fx.karaokeOnly
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                    >
                      {fx.karaokeOnly ? "🎤 KARAOKE AKTIF — Vokal Dicancel" : "🎤 Karaoke Vocal Cut"}
                    </button>
                    <p className="text-[10px] text-white/50 mb-3">Mode karaoke mencancel vokal tengah di kedua speaker. Kalau vokal lagu pakai stereo/reverb, sisa vokal bisa masih terdengar tipis.</p>

                    <div className={`flex items-center justify-between text-[11px] text-white/70 font-mono mb-1 ${fx.karaokeOnly ? "opacity-40 pointer-events-none" : ""}`}>
                      <span>L</span>
                      <span className="text-white font-bold">
                        {fx.balance === 0
                          ? "Tengah"
                          : fx.balance <= -0.95
                          ? "R Mati · L Aktif"
                          : fx.balance >= 0.95
                          ? "L Mati · R Aktif"
                          : fx.balance < 0
                          ? "← L Lebih Besar"
                          : "R Lebih Besar →"}
                      </span>
                      <span>R</span>
                    </div>
                    <div className={fx.karaokeOnly ? "opacity-40 pointer-events-none" : ""}>
                      <Slider
                        value={[fx.balance]}
                        min={-1} max={1} step={0.05}
                        onValueChange={(v) => setFx({ balance: v[0] })}
                      />
                      <div className="flex justify-between mt-2">
                        <button onClick={() => setFx({ balance: -1 })} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20">L Only</button>
                        <button onClick={() => setFx({ balance: 0 })} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20">Normal</button>
                        <button onClick={() => setFx({ balance: 1 })} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20">R Only</button>
                      </div>
                      <p className="text-[10px] text-white/50 mt-2">Geser kiri hanya keluar channel L. Geser kanan hanya keluar channel R. Karaoke pakai tombol vocal cut di atas.</p>
                    </div>
                  </Card>

                  {/* Mono / Stereo */}
                  <Card icon={<Music className="w-4 h-4" />} title="Mode Output">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">{fx.mono ? "Mono" : "Stereo"}</p>
                        <p className="text-[11px] text-white/60">{fx.mono ? "Cocok untuk 1 earphone" : "Default 2 channel"}</p>
                      </div>
                      <Switch checked={fx.mono} onCheckedChange={(v) => setFx({ mono: v })} />
                    </div>
                  </Card>

                  {/* EQ 5-band */}
                  <Card icon={<Sliders className="w-4 h-4" />} title={`Equalizer · ${fx.eqPreset}`}>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {Object.keys(EQ_PRESETS).map((p) => (
                        <button
                          key={p}
                          onClick={() => applyPreset(p)}
                          className={`text-[10px] px-2 py-1 rounded-full font-semibold transition ${
                            fx.eqPreset === p
                              ? "bg-fuchsia-500 text-white shadow-md"
                              : "bg-white/10 text-white/80 hover:bg-white/20"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between items-end gap-2 h-32 px-2">
                      {EQ_FREQS.map((freq, i) => (
                        <div key={freq} className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-[9px] text-fuchsia-200 font-mono w-8 text-center">
                            {fx.eq[i] > 0 ? "+" : ""}{fmt(fx.eq[i], 0)}
                          </span>
                          <div className="relative h-20 w-full flex items-center justify-center">
                            <input
                              type="range"
                              min={-12} max={12} step={1}
                              value={fx.eq[i]}
                              onChange={(e) => updateEq(i, Number(e.target.value))}
                              className="vertical-slider"
                              style={{
                                writingMode: "vertical-lr" as const,
                                WebkitAppearance: "slider-vertical",
                                width: "20px",
                                height: "80px",
                                accentColor: "#e879f9",
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-white/60 font-medium">
                            {freq >= 1000 ? `${freq / 1000}k` : freq}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Bass Boost */}
                  <Card icon={<Zap className="w-4 h-4" />} title={`Bass Boost · +${fmt(fx.bassBoost, 0)} dB`}>
                    <Slider
                      value={[fx.bassBoost]}
                      min={0} max={12} step={1}
                      onValueChange={(v) => setFx({ bassBoost: v[0] })}
                    />
                  </Card>

                  {/* Loudness Booster */}
                  <Card icon={<Volume2 className="w-4 h-4" />} title={`Volume Booster · ${fmt(fx.loudness ?? 1, 2)}x`}>
                    <Slider
                      value={[fx.loudness ?? 1]}
                      min={1} max={4} step={0.1}
                      onValueChange={(v) => setFx({ loudness: v[0] })}
                    />
                    <div className="flex justify-between mt-2">
                      {[1, 1.5, 2, 2.5, 3, 4].map((r) => (
                        <button
                          key={r}
                          onClick={() => setFx({ loudness: r })}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            Math.abs((fx.loudness ?? 1) - r) < 0.05
                              ? "bg-fuchsia-500 text-white"
                              : "bg-white/10 text-white/80 hover:bg-white/20"
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                      <div>
                        <p className="text-white text-xs font-semibold">Anti-Pecah (Compressor)</p>
                        <p className="text-[10px] text-white/60">Auto aktif kalau booster &gt; 1x</p>
                      </div>
                      <Switch checked={fx.compressor ?? false} onCheckedChange={(v) => setFx({ compressor: v })} />
                    </div>
                    <p className="text-[10px] text-white/50 mt-2">Bikin speaker lebih kencang dari maksimal HP. Pakai compressor biar suara nggak pecah.</p>
                  </Card>

                  {/* 3D Surround */}
                  <Card icon={<Sparkles className="w-4 h-4" />} title={`3D Surround · ${Math.round(fx.surround * 100)}%`}>
                    <Slider
                      value={[fx.surround]}
                      min={0} max={1} step={0.05}
                      onValueChange={(v) => setFx({ surround: v[0] })}
                    />
                    <p className="text-[10px] text-white/50 mt-2">Efek ruangan virtual (reverb)</p>
                  </Card>
                </>
              )}

              {tab === "playback" && (
                <>
                  {/* Playback rate */}
                  <Card icon={<Gauge className="w-4 h-4" />} title={`Kecepatan · ${fmt(fx.rate, 2)}x`}>
                    <Slider
                      value={[fx.rate]}
                      min={0.5} max={2} step={0.05}
                      onValueChange={(v) => setFx({ rate: v[0] })}
                    />
                    <div className="flex justify-between mt-2">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          onClick={() => setFx({ rate: r })}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            Math.abs(fx.rate - r) < 0.01
                              ? "bg-fuchsia-500 text-white"
                              : "bg-white/10 text-white/80 hover:bg-white/20"
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Pitch preserve */}
                  <Card icon={<Music className="w-4 h-4" />} title="Pitch Shifter">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {fx.preservePitch ? "Pitch dijaga (normal)" : "Pitch ikut kecepatan"}
                        </p>
                        <p className="text-[11px] text-white/60">
                          {fx.preservePitch ? "Cocok belajar lirik" : "Mode chipmunk / slowed"}
                        </p>
                      </div>
                      <Switch checked={fx.preservePitch} onCheckedChange={(v) => setFx({ preservePitch: v })} />
                    </div>
                  </Card>

                  {/* Crossfade */}
                  {crossfade && (
                    <Card icon={<Sparkles className="w-4 h-4" />} title={`Crossfade · ${crossfade.seconds}s`}>
                      <Slider
                        value={[crossfade.seconds]}
                        min={0} max={12} step={1}
                        onValueChange={(v) => crossfade.onChange(v[0])}
                      />
                      <p className="text-[10px] text-white/50 mt-2">
                        {crossfade.seconds === 0 ? "Mati — lagu langsung ganti" : `Lagu memudar selama ${crossfade.seconds} detik`}
                      </p>
                    </Card>
                  )}

                  {/* A-B loop */}
                  {abLoop && (
                    <Card icon={<Repeat className="w-4 h-4" />} title="Loop A — B">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] text-white/70">
                          <p>A: <span className="font-mono text-white">{fmtTime(abLoop.a)}</span></p>
                          <p>B: <span className="font-mono text-white">{fmtTime(abLoop.b)}</span></p>
                        </div>
                        <Switch
                          checked={abLoop.enabled && abLoop.a != null && abLoop.b != null}
                          onCheckedChange={abLoop.onToggle}
                          disabled={abLoop.a == null || abLoop.b == null}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="secondary" onClick={abLoop.onSetA} className="h-8 text-xs">
                          Set A ({fmtTime(abLoop.currentTime)})
                        </Button>
                        <Button size="sm" variant="secondary" onClick={abLoop.onSetB} className="h-8 text-xs">
                          Set B ({fmtTime(abLoop.currentTime)})
                        </Button>
                        <Button size="sm" variant="ghost" onClick={abLoop.onClear} className="h-8 text-xs text-white/80">
                          Clear
                        </Button>
                      </div>
                      <p className="text-[10px] text-white/50 mt-2">Pilih dua titik di lagu lalu loop bagian itu terus.</p>
                    </Card>
                  )}
                </>
              )}
            </div>

            <div className="px-4 pb-4 pt-1 text-center">
              <p className="text-[10px] text-white/40">Pengaturan tersimpan otomatis ✨</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-white/90 mb-2">
        <span className="text-fuchsia-300">{icon}</span>
        <h4 className="text-xs font-bold tracking-wide uppercase">{title}</h4>
      </div>
      {children}
    </div>
  );
}
