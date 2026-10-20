import { describe, it, expect } from "vitest";
import { APK_FEATURES, APK_EXCLUDED } from "../../supabase/functions/_shared/apk-premium-catalog";

describe("APK Premium: cek nomor XL/Axis dan Tri", () => {
  for (const [id, path] of [["tools.cekaxis", "/api/tools/cekaxis"], ["tools.cekkartutri", "/api/tools/cekkartutri"]]) {
    it(`${id} tersedia sebagai fitur dengan input nomor wajib`, () => {
      const f = APK_FEATURES.find((x) => x.id === id);
      expect(f?.path).toBe(path);
      expect(f?.method).toBe("GET");
      expect(f?.params.find((p) => p.key === "nomor")?.required).toBe(true);
      expect(f?.unsupported).toBeUndefined();
    });
    it(`${id} tidak lagi ada di daftar pengecualian`, () => {
      expect(APK_EXCLUDED.some((e) => e.path === path)).toBe(false);
    });
  }
});
