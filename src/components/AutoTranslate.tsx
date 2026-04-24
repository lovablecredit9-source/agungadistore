import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { getBaseLanguageCode, getLanguageByCode } from "@/lib/languages";
import { STORE_NAME, WA_NUMBER, YOUTUBE_NAME } from "@/lib/social-links";

type SupportedAttr = "placeholder" | "title" | "aria-label";

type TranslationTarget =
  | { kind: "text"; node: Text; original: string }
  | { kind: "attr"; element: HTMLElement; attr: SupportedAttr; original: string };

const CACHE_KEY = "ui-auto-translate-cache-v1";
const ATTRIBUTES: SupportedAttr[] = ["placeholder", "title", "aria-label"];
const textOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<HTMLElement, Partial<Record<SupportedAttr, string>>>();

function readCache(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, Record<string, string>>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota / storage errors
  }
}

function splitPadding(value: string) {
  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  return {
    leading: match?.[1] || "",
    core: match?.[2] || value,
    trailing: match?.[3] || "",
  };
}

function shouldSkipText(text: string) {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < 2) return true;
  if (trimmed === STORE_NAME || trimmed === WA_NUMBER || trimmed === YOUTUBE_NAME) return true;
  if (trimmed.startsWith("http") || trimmed.startsWith("www.")) return true;
  if (trimmed.startsWith("@")) return true;
  if (/^[\d\s()[\]{}+\-–-.,:;/%!?*&|<>='"`~]+$/.test(trimmed)) return true;
  if (/^[A-Z0-9_-]{4,}$/.test(trimmed) && !/[a-z]/.test(trimmed)) return true;

  return false;
}

function collectTargets(root: ParentNode = document.body): TranslationTarget[] {
  const targets: TranslationTarget[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent || "";
      const parent = node.parentElement;

      if (!parent || !text.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-auto-translate]")) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    const node = currentNode as Text;
    const original = textOriginals.get(node) ?? node.textContent ?? "";

    if (!textOriginals.has(node)) {
      textOriginals.set(node, original);
    }

    if (shouldSkipText(splitPadding(original).core)) continue;
    targets.push({ kind: "text", node, original });
  }

  const scope = root instanceof Element || root instanceof Document ? root : document.body;
  scope.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]").forEach((element) => {
    if (element.closest("[data-no-auto-translate]")) return;

    const stored = attrOriginals.get(element) || {};

    ATTRIBUTES.forEach((attr) => {
      const current = element.getAttribute(attr);
      if (!current) return;

      if (!stored[attr]) {
        stored[attr] = current;
      }

      const original = stored[attr] || current;
      if (shouldSkipText(splitPadding(original).core)) return;

      targets.push({ kind: "attr", element, attr, original });
    });

    attrOriginals.set(element, stored);
  });

  return targets;
}

function restoreOriginals(root: ParentNode = document.body) {
  collectTargets(root).forEach((target) => {
    if (target.kind === "text") {
      if (target.node.textContent !== target.original) {
        target.node.textContent = target.original;
      }
      return;
    }

    if (target.element.getAttribute(target.attr) !== target.original) {
      target.element.setAttribute(target.attr, target.original);
    }
  });
}

function applyTranslations(targets: TranslationTarget[], translatedByOriginal: Record<string, string>) {
  targets.forEach((target) => {
    const { leading, core, trailing } = splitPadding(target.original);
    const translated = translatedByOriginal[core]?.trim();

    if (!translated || translated === core) return;

    const nextValue = `${leading}${translated}${trailing}`;

    if (target.kind === "text") {
      if (target.node.textContent !== nextValue) {
        target.node.textContent = nextValue;
      }
      return;
    }

    if (target.element.getAttribute(target.attr) !== nextValue) {
      target.element.setAttribute(target.attr, nextValue);
    }
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

export default function AutoTranslate() {
  const [lang] = useLang();
  const cacheRef = useRef<Record<string, Record<string, string>>>(readCache());

  useEffect(() => {
    const targetLang = getBaseLanguageCode(lang);
    const targetLanguageName = getLanguageByCode(lang)?.nameEn || targetLang;

    if (targetLang === "id") {
      restoreOriginals();
      return;
    }

    let cancelled = false;
    let running = false;
    let shouldRerun = false;
    let timer: number | null = null;

    const translateTexts = async (texts: string[]) => {
      const langCache = (cacheRef.current[targetLang] ||= {});
      const missing = texts.filter((text) => !langCache[text]);

      if (missing.length === 0) return langCache;

      for (const batch of chunk(missing, 25)) {
        const { data, error } = await supabase.functions.invoke("translate-ui", {
          body: {
            texts: batch,
            targetLang,
            targetLanguageName,
          },
        });

        if (cancelled) return langCache;

        const translations = Array.isArray(data?.translations) ? data.translations : [];

        batch.forEach((text, index) => {
          const candidate = typeof translations[index] === "string" ? translations[index].trim() : "";
          langCache[text] = !error && candidate ? candidate : text;
        });

        writeCache(cacheRef.current);
      }

      return langCache;
    };

    const runTranslation = async () => {
      if (running) {
        shouldRerun = true;
        return;
      }

      running = true;

      try {
        const targets = collectTargets();
        const texts = Array.from(new Set(targets.map((target) => splitPadding(target.original).core).filter((text) => !shouldSkipText(text))));
        const translatedByOriginal = await translateTexts(texts);

        if (!cancelled) {
          applyTranslations(targets, translatedByOriginal);
        }
      } finally {
        running = false;

        if (shouldRerun && !cancelled) {
          shouldRerun = false;
          timer = window.setTimeout(() => {
            void runTranslation();
          }, 80);
        }
      }
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void runTranslation();
      }, 120);
    };

    void runTranslation();

    const observer = new MutationObserver(() => {
      schedule();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [lang]);

  return null;
}