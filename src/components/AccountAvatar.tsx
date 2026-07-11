import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImageToDataUrl } from "@/lib/avatar";
import { useToast } from "@/hooks/use-toast";

interface Props {
  visitorId: string | null | undefined;
  username?: string | null;
  avatarUrl?: string | null; // optional preloaded value (skips fetch)
  size?: number;             // px
  editable?: boolean;
  className?: string;
}

// Broadcast so other AccountAvatar instances (comments, ranking) refresh.
function emitAvatarUpdate(visitorId: string, url: string | null) {
  window.dispatchEvent(new CustomEvent("account-avatar-updated", { detail: { visitorId, url } }));
}

export default function AccountAvatar({
  visitorId,
  username,
  avatarUrl,
  size = 44,
  editable = false,
  className = "",
}: Props) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(avatarUrl ?? null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (avatarUrl !== undefined) { setUrl(avatarUrl ?? null); return; }
    if (!visitorId) { setUrl(null); return; }
    let alive = true;
    supabase.from("user_balances").select("avatar_url").eq("visitor_id", visitorId).maybeSingle()
      .then(({ data }) => { if (alive) setUrl((data as any)?.avatar_url ?? null); });
    return () => { alive = false; };
  }, [visitorId, avatarUrl]);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.visitorId && d.visitorId === visitorId) setUrl(d.url ?? null);
    };
    window.addEventListener("account-avatar-updated", handler as EventListener);
    return () => window.removeEventListener("account-avatar-updated", handler as EventListener);
  }, [visitorId]);

  const pick = () => { if (editable && !loading) inputRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !visitorId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus gambar", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 256, 0.82);
      const { error } = await supabase.from("user_balances").update({ avatar_url: dataUrl }).eq("visitor_id", visitorId);
      if (error) throw error;
      setUrl(dataUrl);
      emitAvatarUpdate(visitorId, dataUrl);
      toast({ title: "✅ Foto profil diperbarui" });
    } catch (err: any) {
      toast({ title: "Gagal unggah foto", description: err?.message || "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const initial = (username?.trim()?.[0] || "?").toUpperCase();
  const fontSize = Math.max(11, Math.round(size * 0.42));

  return (
    <div
      className={`relative shrink-0 ${editable ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size }}
      onClick={pick}
    >
      <div
        className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white font-bold"
        style={{ boxShadow: "0 8px 20px -4px rgba(34,211,238,0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)", fontSize }}
      >
        {url ? (
          <img src={url} alt={username || "avatar"} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {editable && (
        <>
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 border-2 border-background flex items-center justify-center">
            {loading ? <Loader2 className="w-2.5 h-2.5 text-white animate-spin" /> : <Camera className="w-2.5 h-2.5 text-white" />}
          </span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </>
      )}
    </div>
  );
}
