import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TranslationRequest = {
  texts?: string[];
  targetLang?: string;
  targetLanguageName?: string;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Invalid translation response");
  }

  return cleaned.slice(start, end + 1);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts = [], targetLang, targetLanguageName } = (await request.json()) as TranslationRequest;

    if (!targetLang || !Array.isArray(texts) || texts.length === 0) {
      return jsonResponse({ translations: [] });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const sanitizedTexts = texts.map((text) => String(text ?? "").slice(0, 500));

    const response = await aiFetch("chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a UI translator.

Translate each input string into the requested target language.

Rules:
- Return strict JSON only using this shape: {"translations":["..."]}
- Keep the array length and order exactly the same as the input
- Preserve emojis, punctuation, numbers, placeholders, arrows, and symbols
- Keep brand names, product names, usernames, codes, URLs, QRIS, WhatsApp, E-Wallet, IDR, and proper nouns unchanged when appropriate
- If a string is already correct for the target language, return it unchanged
- Never add explanations, markdown, or extra keys`,
          },
          {
            role: "user",
            content: `Target language code: ${targetLang}\nTarget language name: ${targetLanguageName || targetLang}\n\nTranslate this JSON array and return JSON only:\n${JSON.stringify(sanitizedTexts)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("translate-ui AI error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(extractJsonObject(rawContent));
    const translations = Array.isArray(parsed.translations) ? parsed.translations : [];

    const normalized = sanitizedTexts.map((text, index) => {
      const value = translations[index];
      return typeof value === "string" && value.trim() ? value : text;
    });

    return jsonResponse({ translations: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to translate UI";
    return jsonResponse({ error: message }, 500);
  }
});