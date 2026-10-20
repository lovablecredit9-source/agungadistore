import { describe, it, expect, beforeEach, vi } from "vitest";
import { ytAudio } from "@/components/apkpremium/ytAudioStore";
import type { YtEntry } from "@/components/apkpremium/useYtHistory";

class FakeAudio {
  src = ""; currentTime = 0; duration = 120; volume = 1; paused = true;
  private h: Record<string, Array<() => void>> = {};
  addEventListener(t: string, f: () => void) { (this.h[t] ||= []).push(f); }
  emit(t: string) { (this.h[t] || []).forEach((f) => f()); }
  load() {}
  removeAttribute(k: string) { if (k === "src") this.src = ""; }
  play() { this.paused = false; this.emit("play"); return Promise.resolve(); }
  pause() { this.paused = true; this.emit("pause"); }
}

const song = (id: string): YtEntry => ({ id, type: "mp3", title: `Lagu ${id}`, url: "https://youtube.com/watch?v=abc", thumbnail: null, media_url: `https://cdn.example.com/${id}.mp3`, media_kind: "audio", quality: null, duration: null, status: "ok", error: null, at: new Date().toISOString() });

let fake: FakeAudio;
beforeEach(() => { ytAudio.__reset(() => (fake = new FakeAudio()) as unknown as HTMLAudioElement); });

describe("musik YouTube MP3 tetap jalan di semua tab", () => {
  it("tetap diputar setelah halaman APK Premium ditutup (pindah tab) sampai dimatikan", () => {
    ytAudio.play(song("a"));
    // Pindah tab = komponen APK Premium hilang; audio tidak terikat komponen, jadi tidak ada yang menghentikannya.
    expect(ytAudio.get().status).toBe("playing");
    expect(fake.paused).toBe(false);
    expect(ytAudio.get().item?.id).toBe("a");
  });

  it("hanya berhenti saat dimatikan", () => {
    ytAudio.play(song("a"));
    ytAudio.stop();
    expect(fake.paused).toBe(true);
    expect(fake.src).toBe("");
    expect(ytAudio.get().item).toBeNull();
    expect(ytAudio.get().status).toBe("idle");
  });

  it("jeda lalu lanjut dari posisi yang sama, tanpa memuat ulang lagu", () => {
    ytAudio.play(song("a"));
    ytAudio.seek(42);
    ytAudio.toggle();
    expect(ytAudio.get().status).toBe("paused");
    ytAudio.toggle();
    expect(ytAudio.get().status).toBe("playing");
    expect(fake.currentTime).toBe(42);
  });

  it("memutar lagu lain mengganti lagu, hanya satu musik yang berbunyi", () => {
    ytAudio.play(song("a"));
    ytAudio.play(song("b"));
    expect(fake.src).toContain("b.mp3");
    expect(ytAudio.get().item?.id).toBe("b");
  });

  it("riwayat 'diputar' dicatat sekali per lagu", () => {
    const log = vi.fn();
    ytAudio.setPlayedLogger(log);
    ytAudio.play(song("a"));
    ytAudio.toggle(); ytAudio.toggle();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("link kedaluwarsa ditandai error, bukan diputar", () => {
    ytAudio.play(song("a"));
    fake.emit("error");
    expect(ytAudio.get().status).toBe("error");
  });

  it("item tanpa link media tidak diputar", () => {
    ytAudio.play({ ...song("x"), media_url: null });
    expect(ytAudio.get().item).toBeNull();
  });
});
