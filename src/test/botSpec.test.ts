import { describe, it, expect } from "vitest";
import { validateSpec, replyFor, unsafePath, nodeIncompatibility } from "../../supabase/functions/_shared/bot-spec";

const spec = validateSpec({ commands: { "/start": "Halo {first_name} {version}", "/ping": "PONG" }, fallback: { mode: "echo", prefix: "Echo: " } });

describe("bot spec runtime", () => {
  it("validates and renders commands", () => {
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    expect(replyFor(spec.spec, "/start", { first_name: "Adi", version: "v3" }).reply).toBe("Halo Adi v3");
    expect(replyFor(spec.spec, "/ping@ADITESTBTGBOT", {})).toEqual({ reply: "PONG", isCommand: true });
    expect(replyFor(spec.spec, "halo", {}).reply).toBe("Echo: halo");
    expect(replyFor(spec.spec, "/nope", {}).reply).toBeNull();
  });
  it("rejects bad specs and unsafe paths", () => {
    expect(validateSpec({ commands: { "start": "x" } }).ok).toBe(false);
    expect(validateSpec({}).ok).toBe(false);
    expect(unsafePath("../../etc/x")).toBe(true);
    expect(unsafePath("/abs")).toBe(true);
    expect(unsafePath("bot/adistore-bot.json")).toBe(false);
  });
  it("reports node dependencies as incompatible", () => {
    const r = nodeIncompatibility({ dependencies: { "node-telegram-bot-api": "1" } }, ["index.js"]);
    expect(r.compatible).toBe(false);
    expect(r.reasons[0]).toBe("Bot tidak kompatibel dengan runtime serverless saat ini.");
    expect(r.dependencies).toContain("node-telegram-bot-api");
  });
});
