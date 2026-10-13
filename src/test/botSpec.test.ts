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

import { callbackReply, keyboardFor, handlerCount } from "../../supabase/functions/_shared/bot-spec";
describe("universal spec: hears, callbacks, buttons", () => {
  it("accepts a button-only bot without commands", () => {
    const v = validateSpec({ hears: { "Menu": "Pilih menu" }, callbacks: { buy: "Beli {first_name}" }, buttons: { "hears:menu": [[{ text: "Beli", data: "buy" }, { text: "Web", url: "https://x.id" }, { text: "Bad", url: "http://x" }]] } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(handlerCount(v.spec)).toBe(2);
    const r = replyFor(v.spec, "menu", {});
    expect(r.reply).toBe("Pilih menu");
    expect(keyboardFor(v.spec, r.key ?? null)).toEqual({ inline_keyboard: [[{ text: "Beli", callback_data: "buy" }, { text: "Web", url: "https://x.id" }]] });
    expect(callbackReply(v.spec, "buy", { first_name: "Adi" }).reply).toBe("Beli Adi");
    expect(callbackReply(v.spec, "nope", {}).reply).toBeNull();
  });
  it("still rejects a spec with no handler at all", () => {
    const v = validateSpec({ commands: {}, fallback: "none" });
    expect(v.ok).toBe(false);
  });
});
