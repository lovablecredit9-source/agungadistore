// ZIP inspection without extracting to disk and without executing anything.
import { unzipSync } from "npm:fflate@0.8.2";
import { SPEC_FILE, validateSpec, nodeIncompatibility, unsafePath, type BotSpec, type CompatReport } from "../_shared/bot-spec.ts";

const MAX_ENTRIES = 300;
const MAX_UNCOMPRESSED = 20 * 1024 * 1024; // zip-bomb guard
const MAX_SPEC = 256 * 1024;

export type ZipResult = { ok: false; error: string } | { ok: true; report: CompatReport; spec: BotSpec | null };

export function inspectZip(bytes: Uint8Array): ZipResult {
  let count = 0; let total = 0; const names: string[] = []; let bad: string | null = null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        count++; names.push(f.name);
        if (unsafePath(f.name)) bad = bad ?? `Path berbahaya di ZIP ditolak: ${f.name.slice(0, 80)}`;
        total += f.originalSize;
        const base = f.name.split("/").pop() ?? "";
        // only read small text files we need; everything else is listed, never extracted
        return !bad && count <= MAX_ENTRIES && total <= MAX_UNCOMPRESSED && (base === SPEC_FILE || base === "package.json") && f.originalSize <= MAX_SPEC;
      },
    });
  } catch {
    return { ok: false, error: "ZIP rusak atau tidak dapat dibaca" };
  }
  if (bad) return { ok: false, error: bad };
  if (count > MAX_ENTRIES) return { ok: false, error: `ZIP berisi terlalu banyak file (maks ${MAX_ENTRIES})` };
  if (total > MAX_UNCOMPRESSED) return { ok: false, error: "Isi ZIP terlalu besar setelah diekstrak (maks 20 MB)" };

  const depth = (n: string) => n.split("/").length;
  const pick = (base: string) => Object.keys(files).filter((n) => n.split("/").pop() === base && depth(n) <= 2).sort((a, b) => depth(a) - depth(b))[0];
  const dec = new TextDecoder();
  const specPath = pick(SPEC_FILE);
  if (specPath) {
    let raw: unknown;
    try { raw = JSON.parse(dec.decode(files[specPath])); } catch { return { ok: true, spec: null, report: { compatible: false, runtime: "webhook-spec", reasons: [`${SPEC_FILE} bukan JSON yang valid`], dependencies: [] } }; }
    const v = validateSpec(raw);
    if (!v.ok) return { ok: true, spec: null, report: { compatible: false, runtime: "webhook-spec", reasons: v.errors, dependencies: [] } };
    return { ok: true, spec: v.spec, report: { compatible: true, runtime: "webhook-spec", reasons: [`${SPEC_FILE} valid (${Object.keys(v.spec.commands).length} command)`], dependencies: [], commands: Object.keys(v.spec.commands) } };
  }
  const pkgPath = pick("package.json");
  let pkg: Record<string, unknown> | null = null;
  if (pkgPath) { try { pkg = JSON.parse(dec.decode(files[pkgPath])); } catch { pkg = null; } }
  const js = names.filter((n) => /\.(c|m)?js$/i.test(n) && !n.includes("node_modules/"));
  const rep = nodeIncompatibility(pkg, js);
  if (!pkgPath && !js.length) rep.reasons.splice(1, 0, "Tidak ada package.json atau file bot yang dikenali.");
  if (pkgPath && !pkg) rep.reasons.splice(1, 0, "package.json tidak valid.");
  return { ok: true, spec: null, report: rep };
}
