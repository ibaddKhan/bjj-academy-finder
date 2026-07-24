import { AgentResult, parseAgentResult } from "./schema";
import { instagramScrape } from "./tools/instagram";
import { facebookScrape } from "./tools/facebook";
import { smoothcompProfile } from "./tools/smoothcomp";
import { emitJobEvent, SSEEvent } from "@/lib/events";
import { db } from "@/lib/db";

export interface AgentSettings {
  openrouterKey: string;
  openrouterModel: string;
  serperKey: string;
  instagramKey: string;
  facebookKey: string;
  zenrowsKey: string;
}

// ─── Serper helpers ───────────────────────────────────────────────────────────

interface SerperData {
  organic?: Array<{ title: string; link: string; snippet: string }>;
  answerBox?: { answer?: string; snippet?: string };
}

async function serperRaw(query: string, apiKey: string): Promise<SerperData> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Serper ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function formatSerper(data: SerperData): string {
  let out = "";
  if (data.answerBox?.snippet || data.answerBox?.answer) {
    out += `Answer: ${data.answerBox.snippet ?? data.answerBox.answer}\n\n`;
  }
  for (const r of (data.organic ?? []).slice(0, 5)) {
    out += `${r.title}\n${r.link}\n${r.snippet}\n\n`;
  }
  return out.trim() || "No results found.";
}

// ─── Link extractors ──────────────────────────────────────────────────────────

const INSTA_SKIP = new Set(["p", "reels", "reel", "explore", "stories", "tv", "accounts"]);

function extractInstagramUsername(data: SerperData): string | null {
  for (const r of data.organic ?? []) {
    const m = r.link.match(/instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#]|$)/);
    if (m && !INSTA_SKIP.has(m[1])) return m[1];
  }
  return null;
}

function extractFacebookUrl(data: SerperData): string | null {
  for (const r of data.organic ?? []) {
    if (
      r.link.includes("facebook.com/") &&
      !r.link.includes("/posts/") &&
      !r.link.includes("/photos/") &&
      !r.link.includes("/videos/") &&
      !r.link.includes("/events/")
    ) {
      return r.link;
    }
  }
  return null;
}

function extractSmoothcompUrl(data: SerperData): string | null {
  for (const r of data.organic ?? []) {
    if (r.link.includes("smoothcomp.com/en/athlete/")) return r.link;
  }
  return null;
}

// ─── AI synthesis ─────────────────────────────────────────────────────────────

async function askAI(
  attendeeName: string,
  researchParts: string[],
  settings: AgentSettings
): Promise<AgentResult> {
  const prompt = `You are a BJJ researcher. Based on the data gathered below, determine the current training gym/academy for: "${attendeeName}"

${researchParts.join("\n\n---\n\n")}

## Verification Rules (STRICT — follow exactly)

Before accepting ANY profile or gym, you MUST verify it belongs to "${attendeeName}":

1. **Name match**: The profile's full name must match or be a clear variation of "${attendeeName}" (nicknames, abbreviations, middle names are OK — but a completely different person is NOT).
2. **BJJ context**: The profile must show BJJ/jiu-jitsu/grappling/MMA content (bio, posts, competition records, team tags, etc.).
3. **If uncertain**: Return null for that field. Do NOT guess. A missing field is better than a wrong one.
4. **Common-name caution**: If the name is common (e.g. "John Smith") and the profile shows no BJJ connection, reject it and return null.
5. **Gym name**: Only return a gym name if the profile content explicitly mentions it as the person's current team/academy. Do NOT infer from a gym's own page.

## Output Field Rules
- "foundGym": the NAME of the gym/academy (not a URL) — only if confirmed current — or null
- "instagram": the FULL Instagram profile URL of THIS PERSON (e.g. https://www.instagram.com/username) — NOT a gym page — null if not verified
- "facebook": the FULL Facebook profile URL of THIS PERSON — NOT a gym page — null if not verified
- "smoothcomp": the FULL Smoothcomp profile URL of THIS PERSON — null if not verified
- "source": which source confirmed the gym ("instagram" | "facebook" | "smoothcomp" | null)
- "reason": one sentence — what you verified, or why you couldn't confirm

Respond with ONLY a valid JSON object (no markdown, no explanation outside it):
{
  "foundGym": "gym/academy name or null",
  "instagram": "https://www.instagram.com/username or null",
  "facebook": "https://www.facebook.com/profile or null",
  "smoothcomp": "https://smoothcomp.com/en/athlete/... or null",
  "source": "instagram | facebook | smoothcomp | null",
  "reason": "one sentence explanation"
}`;

  const modelToUse = settings.openrouterModel || "anthropic/claude-haiku-4-5";
  console.log(`[agent] using model: ${modelToUse}`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": "BJJ Academy Finder",
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseAgentResult(content);
}

// ─── Main agent (waterfall) ───────────────────────────────────────────────────

export async function runAgent(
  attendeeName: string,
  settings: AgentSettings,
  jobId: string,
  rowId: string,
  rowIndex: number
): Promise<AgentResult> {
  const toolLog: SSEEvent[] = [];

  function emit(event: Omit<SSEEvent, "timestamp">) {
    const full: SSEEvent = { ...event, timestamp: Date.now() };
    toolLog.push(full);
    emitJobEvent(full);
  }

  async function saveLog() {
    await db.jobRow
      .update({ where: { id: rowId }, data: { toolLog: toolLog as object[] } })
      .catch(() => {});
  }

  const noop = { count: 99 };
  const researchParts: string[] = [];

  // ── 1. INSTAGRAM ─────────────────────────────────────────────────────────
  const instaQuery = `${attendeeName} BJJ instagram`;
  emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "search", input: { query: instaQuery } });
  try {
    const instaSearch = await serperRaw(instaQuery, settings.serperKey);
    const instaText = formatSerper(instaSearch);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: instaText });

    const username = extractInstagramUsername(instaSearch);
    if (username) {
      emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "instagram", input: { action: "profile", query: username } });
      const profile = await instagramScrape(username, settings.instagramKey, noop);
      emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "instagram", output: profile });
      researchParts.push(`INSTAGRAM (@${username}):\n${profile}`);
    } else {
      researchParts.push(`INSTAGRAM: No profile link found.\nSearch results:\n${instaText}`);
    }

    // Check if gym found — stop waterfall if yes
    const result = await askAI(attendeeName, researchParts, settings);
    if (result.foundGym) {
      await saveLog();
      return result;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: `Error: ${msg}` });
    researchParts.push(`INSTAGRAM: Error — ${msg}`);
  }

  // ── 2. FACEBOOK ──────────────────────────────────────────────────────────
  const fbQuery = `${attendeeName} BJJ fighter facebook`;
  emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "search", input: { query: fbQuery } });
  try {
    const fbSearch = await serperRaw(fbQuery, settings.serperKey);
    const fbText = formatSerper(fbSearch);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: fbText });

    const fbUrl = extractFacebookUrl(fbSearch);
    if (fbUrl) {
      emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "facebook", input: { query: fbUrl } });
      const profile = await facebookScrape(fbUrl, settings.facebookKey, noop);
      emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "facebook", output: profile });
      researchParts.push(`FACEBOOK (${fbUrl}):\n${profile}`);
    } else {
      researchParts.push(`FACEBOOK: No profile link found.\nSearch results:\n${fbText}`);
    }

    // Check if gym found — stop waterfall if yes
    const result = await askAI(attendeeName, researchParts, settings);
    if (result.foundGym) {
      await saveLog();
      return result;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: `Error: ${msg}` });
    researchParts.push(`FACEBOOK: Error — ${msg}`);
  }

  // ── 3. SMOOTHCOMP (last resort) ──────────────────────────────────────────
  const scQuery = `${attendeeName} site:smoothcomp.com`;
  emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "search", input: { query: scQuery } });
  try {
    const scSearch = await serperRaw(scQuery, settings.serperKey);
    const scText = formatSerper(scSearch);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: scText });

    const scUrl = extractSmoothcompUrl(scSearch);
    if (scUrl) {
      emit({ type: "tool_call", jobId, rowId, rowIndex, attendeeName, tool: "smoothcomp", input: { action: "profile", query: scUrl } });
      const profile = await smoothcompProfile(scUrl, settings.zenrowsKey, noop);
      emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "smoothcomp", output: profile });
      researchParts.push(`SMOOTHCOMP (${scUrl}):\n${profile}`);
    } else {
      researchParts.push(`SMOOTHCOMP: No profile found.\nSearch results:\n${scText}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "tool_result", jobId, rowId, rowIndex, attendeeName, tool: "search", output: `Error: ${msg}` });
    researchParts.push(`SMOOTHCOMP: Error — ${msg}`);
  }

  // Final AI call with everything collected
  await saveLog();
  return askAI(attendeeName, researchParts, settings);
}
