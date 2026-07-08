import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AiRequestBody = {
  model: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
};

type ParsedLrcLine = {
  text: string;
  timeSeconds: number;
};

const TIMESTAMP_PREFIX_REGEX = /^(\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*)+/;

function uint8ToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractLrc(content: string) {
  return content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => /^(\[(\d{1,2}):(\d{2}(?:\.\d+)?)\])/.test(line))
    .join("\n");
}

export function sanitizeLyricsText(content: string) {
  return content
    .split("\n")
    .map((line) => line.replace(TIMESTAMP_PREFIX_REGEX, "").trim())
    .filter(Boolean)
    .join("\n");
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSongInfo(song_title?: string, song_artist?: string) {
  return [song_title, song_artist].filter(Boolean).join(" by ");
}

function buildDurationInfo(song_duration?: number) {
  return song_duration ? `The song duration is approximately ${song_duration} seconds.` : "";
}

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function callLovableAi(LOVABLE_API_KEY: string, body: AiRequestBody, logLabel: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) throw createHttpError(429, "Rate limit exceeded, coba lagi nanti.");
    if (response.status === 402) throw createHttpError(402, "Credit habis, silakan top up.");

    const text = await response.text();
    console.error(`${logLabel}:`, response.status, text);
    throw createHttpError(500, "AI gateway error");
  }

  return await response.json();
}

function detectAudioFormat(file_url: string, contentType?: string | null) {
  const lowerUrl = String(file_url).toLowerCase();
  const lowerType = String(contentType || "").toLowerCase();

  if (lowerUrl.includes(".wav") || lowerType.includes("audio/wav")) return "wav";
  return "mp3";
}

async function downloadAudioAsBase64(file_url: string) {
  const audioResp = await fetch(file_url);
  if (!audioResp.ok) throw new Error("Failed to download audio file");

  const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
  return {
    base64Audio: uint8ToBase64(audioBytes),
    format: detectAudioFormat(file_url, audioResp.headers.get("content-type")),
  };
}

async function transcribeAudioToLrc({
  LOVABLE_API_KEY,
  base64Audio,
  format,
  durationInfo,
  songInfo,
}: {
  LOVABLE_API_KEY: string;
  base64Audio: string;
  format: string;
  durationInfo: string;
  songInfo: string;
}) {
  const data = await callLovableAi(
    LOVABLE_API_KEY,
    {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a precise lyrics transcriber.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Transcribe EVERY sung line from start to end of the audio, including repeated choruses, ad-libs, and backing vocals that carry words
- Do not stop early — cover the whole song until the vocals end
- Transcribe the exact sung words; do your best on quiet or fast parts instead of skipping them
- Never add spoken section labels like [Verse], [Chorus], [Bridge], or [Outro]
- Keep the original language used in the song
 - Match timestamps to the actual vocal timing in the audio
 - Place each timestamp on or slightly before the first audible sung syllable, never after the vocal has already started
- Keep timestamps strictly increasing
- ${durationInfo}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe the vocals from this audio into precise LRC timestamps${songInfo ? ` for \"${songInfo}\"` : ""}.`,
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format,
              },
            },
          ],
        },
      ],
    },
    "AI audio error",
  );

  const content = data.choices?.[0]?.message?.content || "";
  return extractLrc(content);
}

async function alignLyricsWithAudioReference({
  LOVABLE_API_KEY,
  lyricsText,
  base64Audio,
  format,
  durationInfo,
  songInfo,
}: {
  LOVABLE_API_KEY: string;
  lyricsText: string;
  base64Audio: string;
  format: string;
  durationInfo: string;
  songInfo: string;
}) {
  const cleanedLyrics = sanitizeLyricsText(lyricsText);

  const data = await callLovableAi(
    LOVABLE_API_KEY,
    {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a lyrics timing aligner.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Use the provided lyrics text EXACTLY as written, preserving the same words, line order, punctuation, and line breaks
- Do not rewrite, paraphrase, translate, censor, merge, split, complete, or remove lyric lines
- Every non-empty provided lyric line must appear exactly once in the result
 - Timestamp each line at the moment its first sung word starts in the audio
 - If needed, place the timestamp just slightly before the first audible sung syllable so it never feels late
- Keep timestamps strictly increasing
- If there is intro or outro music, reflect it naturally in the timestamps
- ${durationInfo}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Align these exact lyrics to the vocals in this audio${songInfo ? ` for \"${songInfo}\"` : ""}. Return LRC only and keep each lyric line exactly as provided:\n\n${cleanedLyrics}`,
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format,
              },
            },
          ],
        },
      ],
    },
    "AI audio alignment error",
  );

  const content = data.choices?.[0]?.message?.content || "";
  return extractLrc(content);
}

async function generateTimedLyricsFromText({
  LOVABLE_API_KEY,
  lyricsText,
  durationInfo,
  songInfo,
}: {
  LOVABLE_API_KEY: string;
  lyricsText: string;
  durationInfo: string;
  songInfo: string;
}) {
  const data = await callLovableAi(
    LOVABLE_API_KEY,
    {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a lyrics timestamp generator. Given plain lyrics text, generate timestamps in LRC format.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Distribute timestamps evenly across the song duration
- Account for intro/outro instrumental sections
- Keep the original lyrics text exactly as provided
- Each line should have a unique timestamp
- Start timestamps slightly after 00:00 to account for intro
- Do not rewrite, paraphrase, translate, summarize, censor, or remove any lyric lines
- Keep blank lyric lines out of the result
- ${durationInfo}`,
        },
        {
          role: "user",
          content: `Generate LRC timestamps for this song${songInfo ? ` \"${songInfo}\"` : ""}:\n\n${lyricsText}`,
        },
      ],
    },
    "AI timestamp error",
  );

  const content = data.choices?.[0]?.message?.content || "";
  return extractLrc(content) || content;
}

function parseLrc(content: string): ParsedLrcLine[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)$/);
      if (!match) return [];

      return [
        {
          timeSeconds: Number(match[1]) * 60 + Number(match[2]),
          text: match[3].trim(),
        },
      ];
    });
}

function linesExactlyMatchLyrics(lyricsText: string, lrcText: string) {
  const original = sanitizeLyricsText(lyricsText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = sanitizeLyricsText(lrcText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (original.length !== candidate.length) return false;
  return original.every((line, index) => line === candidate[index]);
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalizedText(text: string) {
  return text.split(" ").filter(Boolean);
}

function countLeadingTokenMatches(leftTokens: string[], rightTokens: string[]) {
  let count = 0;
  const max = Math.min(leftTokens.length, rightTokens.length);

  while (count < max && leftTokens[count] === rightTokens[count]) {
    count += 1;
  }

  return count;
}

function containsWholePhrase(text: string, phrase: string) {
  return text === phrase || text.startsWith(`${phrase} `) || text.endsWith(` ${phrase}`) || text.includes(` ${phrase} `);
}

function scoreLyricAgainstTranscriptWindow({
  lyric,
  candidate,
  distance,
  windowSize,
}: {
  lyric: string;
  candidate: string;
  distance: number;
  windowSize: number;
}) {
  if (!lyric || !candidate) return 0;

  const lyricTokens = tokenizeNormalizedText(lyric);
  const candidateTokens = tokenizeNormalizedText(candidate);
  if (!lyricTokens.length || !candidateTokens.length) return 0;

  const sharedLeadingTokens = countLeadingTokenMatches(lyricTokens, candidateTokens);
  const lyricCoverage = sharedLeadingTokens / lyricTokens.length;
  const candidateCoverage = sharedLeadingTokens / candidateTokens.length;
  let score = similarityScore(lyric, candidate);

  if (sharedLeadingTokens === lyricTokens.length && candidateTokens.length > lyricTokens.length) {
    score += 0.65;
  } else if (sharedLeadingTokens === candidateTokens.length && lyricTokens.length > candidateTokens.length) {
    score += 0.22;
  } else {
    score += lyricCoverage * 0.18;
    score += candidateCoverage * 0.08;
  }

  if (containsWholePhrase(candidate, lyric) && sharedLeadingTokens < lyricTokens.length && lyricTokens.length >= 3) {
    score += 0.12;
  }

  score -= Math.min(distance * (lyricTokens.length <= 2 ? 0.12 : 0.08), 0.48);
  score -= Math.max(windowSize - 1, 0) * 0.03;

  return score;
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const nextDiagonal = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + cost);
      diagonal = nextDiagonal;
    }
  }

  return prev[b.length];
}

function similarityScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const charScore = 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const tokenScore = intersection / union;
  const lengthScore = 1 - Math.min(Math.abs(left.length - right.length) / Math.max(left.length, right.length), 1);

  return charScore * 0.55 + tokenScore * 0.35 + lengthScore * 0.1;
}

function averageGap(times: number[]) {
  const gaps = times
    .slice(1)
    .map((time, index) => time - times[index])
    .filter((gap) => gap > 0.05);

  if (!gaps.length) return 3.5;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

function fillMissingTimes(times: Array<number | null>, fallbackStart: number, fallbackEnd: number) {
  const result = [...times];
  const knownTimes = result.filter((time): time is number => time !== null);
  const fallbackGap = averageGap(knownTimes.length > 1 ? knownTimes : [fallbackStart, fallbackEnd || fallbackStart + 3.5]);

  if (!knownTimes.length) {
    const span = Math.max(fallbackEnd - fallbackStart, fallbackGap * Math.max(result.length - 1, 1));
    const step = result.length > 1 ? span / (result.length - 1) : 0;
    return result.map((_, index) => fallbackStart + step * index);
  }

  let index = 0;
  while (index < result.length) {
    if (result[index] !== null) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < result.length && result[index] === null) index += 1;
    const end = index - 1;
    const previousIndex = start - 1;
    const nextIndex = index < result.length ? index : -1;
    const previousTime = previousIndex >= 0 ? result[previousIndex] : null;
    const nextTime = nextIndex >= 0 ? result[nextIndex] : null;
    const missingCount = end - start + 1;

    if (previousTime !== null && nextTime !== null) {
      const step = (nextTime - previousTime) / (missingCount + 1);
      for (let offset = 1; offset <= missingCount; offset += 1) {
        result[start + offset - 1] = previousTime + step * offset;
      }
      continue;
    }

    if (nextTime !== null) {
      for (let offset = missingCount; offset >= 1; offset -= 1) {
        result[start + (missingCount - offset)] = Math.max(0, nextTime - fallbackGap * offset);
      }
      continue;
    }

    const anchor = previousTime ?? fallbackStart;
    for (let offset = 1; offset <= missingCount; offset += 1) {
      result[start + offset - 1] = anchor + fallbackGap * offset;
    }
  }

  return result.map((time) => time ?? fallbackStart);
}

function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  let minutes = Math.floor(safeSeconds / 60);
  let seconds = safeSeconds - minutes * 60;

  if (seconds >= 59.995) {
    minutes += 1;
    seconds = 0;
  }

  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function calculateOnsetLeadSeconds({
  currentTime,
  previousTime,
  nextTime,
  text,
}: {
  currentTime: number;
  previousTime: number | null;
  nextTime: number | null;
  text: string;
}) {
  const tokenCount = tokenizeNormalizedText(normalizeText(text)).length;
  // Highlight each line slightly BEFORE the vocal actually starts so karaoke
  // never feels late. Longer lines get a bigger head start.
  let lead = tokenCount >= 6 ? 0.55 : tokenCount >= 3 ? 0.45 : 0.35;

  const closestGap = [
    previousTime !== null ? currentTime - previousTime : null,
    nextTime !== null ? nextTime - currentTime : null,
  ]
    .filter((gap): gap is number => gap !== null && gap > 0.05)
    .sort((left, right) => left - right)[0];

  if (closestGap !== undefined) {
    // Never lead by more than ~40% of the closest gap so lines stay ordered.
    lead = Math.min(lead, Math.max(0.15, closestGap * 0.4));
  }

  return Math.min(Math.max(lead, 0.15), 0.55);
}

export function applyOnsetCompensationToLrc(lrcText: string) {
  const parsedLines = parseLrc(lrcText);
  if (!parsedLines.length) return lrcText;

  const adjustedTimes: number[] = [];

  for (let index = 0; index < parsedLines.length; index += 1) {
    const currentLine = parsedLines[index];
    const previousOriginalTime = index > 0 ? parsedLines[index - 1].timeSeconds : null;
    const nextOriginalTime = index < parsedLines.length - 1 ? parsedLines[index + 1].timeSeconds : null;
    const earliestAllowed = index > 0 ? adjustedTimes[index - 1] + 0.05 : 0;
    const latestAllowed = nextOriginalTime !== null ? Math.max(earliestAllowed, nextOriginalTime - 0.05) : Number.POSITIVE_INFINITY;
    const lead = calculateOnsetLeadSeconds({
      currentTime: currentLine.timeSeconds,
      previousTime: previousOriginalTime,
      nextTime: nextOriginalTime,
      text: currentLine.text,
    });

    const compensatedTime = Math.min(
      Math.max(currentLine.timeSeconds - lead, earliestAllowed),
      latestAllowed,
    );

    adjustedTimes.push(compensatedTime);
  }

  return parsedLines
    .map((line, index) => `[${formatTimestamp(adjustedTimes[index])}]${line.text}`)
    .join("\n");
}

export function alignLyricsToTranscript(lyricsText: string, transcriptLrc: string) {
  const lyricsLines = sanitizeLyricsText(lyricsText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const transcriptLines = parseLrc(transcriptLrc);

  if (!lyricsLines.length || !transcriptLines.length) return "";

  const assignedTimes: Array<number | null> = Array.from({ length: lyricsLines.length }, () => null);
  let searchStart = 0;

  for (let lyricIndex = 0; lyricIndex < lyricsLines.length; lyricIndex += 1) {
    const lyric = normalizeText(lyricsLines[lyricIndex]);
    if (!lyric) continue;

    let bestMatch = { score: 0, start: -1, end: -1, timeSeconds: 0 };
    const lyricTokenCount = tokenizeNormalizedText(lyric).length;

    transcriptSearch:
    for (let transcriptIndex = searchStart; transcriptIndex < transcriptLines.length; transcriptIndex += 1) {
      let combined = "";

      for (let endIndex = transcriptIndex; endIndex < Math.min(transcriptIndex + 3, transcriptLines.length); endIndex += 1) {
        combined = `${combined} ${transcriptLines[endIndex].text}`.trim();
        const normalizedCombined = normalizeText(combined);
        const score = scoreLyricAgainstTranscriptWindow({
          lyric,
          candidate: normalizedCombined,
          distance: transcriptIndex - searchStart,
          windowSize: endIndex - transcriptIndex + 1,
        });

        if (score > bestMatch.score || (Math.abs(score - bestMatch.score) <= 0.02 && bestMatch.start >= 0 && transcriptIndex < bestMatch.start)) {
          bestMatch = {
            score,
            start: transcriptIndex,
            end: endIndex,
            timeSeconds: transcriptLines[transcriptIndex].timeSeconds,
          };
        }

        const leadingTokens = countLeadingTokenMatches(tokenizeNormalizedText(lyric), tokenizeNormalizedText(normalizedCombined));
        const isStrongSequentialAnchor = leadingTokens === lyricTokenCount && lyricTokenCount >= 2 && transcriptIndex === searchStart;

        if (isStrongSequentialAnchor && score >= 0.9) {
          break transcriptSearch;
        }
      }

      if (bestMatch.score > 1.1 && transcriptIndex === searchStart) break;
    }

    const threshold = lyricTokenCount <= 2 ? 0.58 : 0.48;
    if (bestMatch.start >= 0 && bestMatch.score >= threshold) {
      assignedTimes[lyricIndex] = bestMatch.timeSeconds;
      searchStart = bestMatch.end + 1;
    }
  }

  const fallbackStart = transcriptLines[0].timeSeconds;
  const fallbackEnd = transcriptLines[transcriptLines.length - 1].timeSeconds;
  const finalTimes = fillMissingTimes(assignedTimes, fallbackStart, fallbackEnd);

  for (let index = 1; index < finalTimes.length; index += 1) {
    if (finalTimes[index] <= finalTimes[index - 1]) {
      finalTimes[index] = finalTimes[index - 1] + 0.05;
    }
  }

  return lyricsLines.map((line, index) => `[${formatTimestamp(finalTimes[index])}]${line}`).join("\n");
}

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lyrics_text, song_duration, song_title, song_artist, file_url, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const durationInfo = buildDurationInfo(song_duration);
    const songInfo = buildSongInfo(song_title, song_artist);
    const cleanedLyricsText = typeof lyrics_text === "string" ? sanitizeLyricsText(lyrics_text) : "";
    const hasLyrics = cleanedLyricsText.length > 0;
    const shouldTranscribeFromAudio = mode === "audio_transcribe" || (!hasLyrics && !!file_url);

    if (shouldTranscribeFromAudio) {
      if (!file_url) {
        return jsonResponse({ error: "File audio wajib ada untuk generate lirik dari lagu." }, 400);
      }

      const { base64Audio, format } = await downloadAudioAsBase64(file_url);
      const lrc = await transcribeAudioToLrc({ LOVABLE_API_KEY, base64Audio, format, durationInfo, songInfo });

      if (!lrc) return jsonResponse({ error: "AI tidak berhasil membaca lirik dari file audio ini." }, 422);
      return jsonResponse({ lrc });
    }

    if (!hasLyrics) return jsonResponse({ error: "Lirik belum ada untuk dibuat timestamp." }, 400);

    if (file_url) {
      try {
        const { base64Audio, format } = await downloadAudioAsBase64(file_url);
        const transcriptLrc = await transcribeAudioToLrc({ LOVABLE_API_KEY, base64Audio, format, durationInfo, songInfo });
        const alignedLrc = alignLyricsToTranscript(cleanedLyricsText, transcriptLrc);

        if (alignedLrc && linesExactlyMatchLyrics(cleanedLyricsText, alignedLrc)) {
          return jsonResponse({ lrc: applyOnsetCompensationToLrc(alignedLrc) });
        }

        const directAlignedLrc = await alignLyricsWithAudioReference({
          LOVABLE_API_KEY,
          lyricsText: cleanedLyricsText,
          base64Audio,
          format,
          durationInfo,
          songInfo,
        });

        if (directAlignedLrc && linesExactlyMatchLyrics(cleanedLyricsText, directAlignedLrc)) {
          return jsonResponse({ lrc: applyOnsetCompensationToLrc(directAlignedLrc) });
        }
      } catch (error) {
        console.error("Audio-assisted timestamp alignment failed, falling back to text timing:", error);
      }
    }

    const lrc = await generateTimedLyricsFromText({
      LOVABLE_API_KEY,
      lyricsText: cleanedLyricsText,
      durationInfo,
      songInfo,
    });

    return jsonResponse({ lrc });
  } catch (e) {
    console.error("generate-lyrics-timestamps error:", e);
    const status = typeof e === "object" && e !== null && "status" in e && typeof (e as { status?: number }).status === "number"
      ? (e as { status: number }).status
      : 500;
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, status);
  }
}

if (import.meta.main) {
  serve(handleRequest);
}
