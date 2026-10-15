import { supabase } from "@/integrations/supabase/client";
import { readFunctionError } from "@/lib/pin";

export type ApkParam = { key: string; type: "text" | "textarea" | "url" | "number"; required: boolean; default?: string };
export type ApkFeaturePublic = {
  id: string; cat: string; label: string; help: string; method: "GET" | "POST"; form: boolean; fileField: string | null;
  params: ApkParam[]; available: boolean; reason: string | null;
};
export type ApkCatalog = {
  provider: { configured: boolean; enabled: boolean; last_check_ok: boolean | null };
  categories: Record<string, string>;
  features: ApkFeaturePublic[];
};
export type NormMedia = { url: string; kind: "video" | "audio" | "image" | "file"; label: string };
export type NormItem = { title: string; subtitle?: string; image?: string; url?: string; meta: { k: string; v: string }[] };
export type Normalized = { ok: boolean; error?: string; title?: string; texts: string[]; media: NormMedia[]; items: NormItem[]; taskId?: string };
export type RunResult = { ok: boolean; error?: string; code?: string; field?: string; latency_ms?: number; normalized?: Normalized; raw?: string | null; redacted_links?: number };
export type UploadPayload = { name: string; type: string; data: string };

export async function apkApi<T = unknown>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T & { error?: string; code?: string; field?: string }> {
  const { data, error } = await supabase.functions.invoke("apk-premium", { body, ...(signal ? { signal } : {}) } as never);
  if (error) {
    const msg = (await readFunctionError(error)) || "Gagal menghubungi server";
    let extra: Record<string, unknown> = {};
    try { extra = (await (error as { context?: Response })?.context?.clone?.().json()) ?? {}; } catch { /* ignore */ }
    return { ...(extra as object), error: msg } as T & { error: string };
  }
  return data as T;
}

export function fileToPayload(file: File): Promise<UploadPayload> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Gagal membaca file"));
    r.onload = () => {
      const s = String(r.result || "");
      resolve({ name: file.name, type: file.type, data: s.slice(s.indexOf(",") + 1) });
    };
    r.readAsDataURL(file);
  });
}

export const PARAM_LABEL: Record<string, string> = {
  q: "Kata kunci", query: "Kata kunci", url: "Link / URL", prompt: "Prompt", text: "Teks", model: "Model", quality: "Kualitas",
  format: "Format", username: "Username", lang: "Bahasa", limit: "Jumlah hasil", page: "Halaman", id: "ID", slug: "Slug",
  image_url: "URL gambar", imgUrl: "URL gambar", nama: "Nama", kota: "Kota", title: "Judul", style: "Gaya", type: "Tipe",
};

export const CAT_ORDER = ["downloader", "search", "ai", "tools", "stalker", "maker", "movie", "anime", "donghua", "komik", "mlbb", "freefire", "news", "primbon", "islami", "alkitab"];
