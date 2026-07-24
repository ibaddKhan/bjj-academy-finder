import { registerTemplate, TemplateInput, TemplateSettings, SSECallbacks, TemplateResult } from "@/lib/templates/registry";
import { stage1Prompt, stage2Prompt } from "./prompts";
import { parseStage1Result, parseEnrichmentResult } from "./schema";
import { scrapeWebsite } from "./tools/scrapingant";
import { facebookPageScrape } from "./tools/facebook-url";
import { smoothcompTeamScrape } from "./tools/smoothcomp-gym";

// ─── Serper helpers ────────────────────────────────────────────────────────────

interface SerperData {
  organic?: Array<{ title: string; link: string; snippet: string }>;
  answerBox?: { answer?: string; snippet?: string };
}

async function serperSearch(query: string, apiKey: string): Promise<SerperData> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Serper ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function formatSerperResults(data: SerperData): string {
  let out = "";
  if (data.answerBox?.snippet || data.answerBox?.answer) {
    out += `Answer: ${data.answerBox.snippet ?? data.answerBox.answer}\n\n`;
  }
  for (const r of (data.organic ?? []).slice(0, 8)) {
    out += `${r.title}\n${r.link}\n${r.snippet}\n\n`;
  }
  return out.trim() || "No results found.";
}

// ─── OpenRouter call ──────────────────────────────────────────────────────────

async function callAI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": "BJJ Gym Enrichment",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function runGymEnrichment(
  input: TemplateInput,
  settings: TemplateSettings,
  callbacks: SSECallbacks,
  context: { jobId: string; rowId: string; rowIndex: number }
): Promise<TemplateResult> {
  const { gymName, location } = input;
  const { jobId, rowId, rowIndex } = context;
  const {
    serperKey,
    openrouterKey,
    enrichmentModel1,
    enrichmentModel2,
    facebookKey,
    zenrowsKey,
    scrapingantKey,
  } = settings;

  const model1 = enrichmentModel1 || "anthropic/claude-haiku-4-5";
  const model2 = enrichmentModel2 || "anthropic/claude-haiku-4-5";

  function emit(tool: string, type: "call" | "result", data: unknown) {
    callbacks.emit({
      type: type === "call" ? "tool_call" : "tool_result",
      jobId,
      rowId,
      rowIndex,
      attendeeName: gymName,
      tool,
      ...(type === "call" ? { input: data } : { output: data }),
    });
  }

  // ── Stage 1: Discovery ────────────────────────────────────────────────────

  const serpResults: string[] = [];

  // Search 1: general
  const q1 = `"${gymName}" BJJ academy ${location}`;
  emit("search", "call", { query: q1 });
  try {
    const s1 = await serperSearch(q1, serperKey);
    const t1 = formatSerperResults(s1);
    emit("search", "result", t1);
    serpResults.push(`Search 1 (${q1}):\n${t1}`);
  } catch (err) {
    emit("search", "result", `Error: ${err instanceof Error ? err.message : String(err)}`);
    serpResults.push(`Search 1 error.`);
  }

  // Search 2: Smoothcomp
  const q2 = `"${gymName}" BJJ Smoothcomp team`;
  emit("search", "call", { query: q2 });
  try {
    const s2 = await serperSearch(q2, serperKey);
    const t2 = formatSerperResults(s2);
    emit("search", "result", t2);
    serpResults.push(`Search 2 (${q2}):\n${t2}`);
  } catch (err) {
    emit("search", "result", `Error: ${err instanceof Error ? err.message : String(err)}`);
    serpResults.push(`Search 2 error.`);
  }

  const allSerpText = serpResults.join("\n\n---\n\n");

  // Stage 1 AI: link discovery
  emit("ai_stage1", "call", { gymName, location, model: model1 });
  let stage1Result;
  try {
    const stage1Content = await callAI(
      stage1Prompt(gymName, location, allSerpText),
      model1,
      openrouterKey
    );
    emit("ai_stage1", "result", stage1Content);
    stage1Result = parseStage1Result(stage1Content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("ai_stage1", "result", `Error: ${msg}`);
    return {
      success: false,
      status: "ERROR",
      data: { reason: `Stage 1 AI error: ${msg}` },
      error: msg,
    };
  }

  if (stage1Result.status === "not_found") {
    return {
      success: true,
      status: "SERP_AGENT_NOT_FOUND",
      data: {
        status: "SERP_AGENT_NOT_FOUND",
        reason: stage1Result.reason ?? "No gym links found in search results",
        confidence_score: "0",
        name: gymName,
        website: null,
        email: null,
        phone: null,
        locations: location,
        owners: null,
        coaches: null,
        industry: "BJJ",
        social_media: null,
        detected_software: null,
        smoothcomp: null,
        owner_instagram: null,
      },
      sourceData: { status: "SERP_AGENT_NOT_FOUND", aiOwner: null, aiCoach: null },
    };
  }

  // ── Stage 2: Scraping ─────────────────────────────────────────────────────

  const scrapedParts: string[] = [];

  // Scrape website
  if (stage1Result.websiteUrl) {
    emit("scrape_website", "call", { url: stage1Result.websiteUrl });
    const content = await scrapeWebsite(stage1Result.websiteUrl, scrapingantKey);
    emit("scrape_website", "result", content.slice(0, 500));
    scrapedParts.push(`WEBSITE (${stage1Result.websiteUrl}):\n${content}`);
  }

  // Scrape Facebook
  if (stage1Result.facebookUrl) {
    emit("scrape_facebook", "call", { url: stage1Result.facebookUrl });
    const content = await facebookPageScrape(stage1Result.facebookUrl, facebookKey);
    emit("scrape_facebook", "result", content.slice(0, 500));
    scrapedParts.push(`FACEBOOK (${stage1Result.facebookUrl}):\n${content}`);
  }

  // Scrape Smoothcomp team page
  if (stage1Result.smoothcompUrl) {
    emit("scrape_smoothcomp", "call", { url: stage1Result.smoothcompUrl });
    const content = await smoothcompTeamScrape(stage1Result.smoothcompUrl, zenrowsKey);
    emit("scrape_smoothcomp", "result", content.slice(0, 500));
    scrapedParts.push(`SMOOTHCOMP (${stage1Result.smoothcompUrl}):\n${content}`);
  }

  if (scrapedParts.length === 0) {
    return {
      success: true,
      status: "SERP_AGENT_NOT_FOUND",
      data: {
        status: "SERP_AGENT_NOT_FOUND",
        reason: "Found links in Stage 1 but could not scrape any content",
        confidence_score: "10",
        name: gymName,
        website: stage1Result.websiteUrl ?? null,
        email: null,
        phone: null,
        locations: location,
        owners: null,
        coaches: null,
        industry: "BJJ",
        social_media: null,
        detected_software: null,
        smoothcomp: stage1Result.smoothcompUrl ?? null,
        owner_instagram: stage1Result.instagramUrl ?? null,
      },
      sourceData: { status: "SERP_AGENT_NOT_FOUND", aiOwner: null, aiCoach: null },
    };
  }

  // ── Stage 2 AI: Validation + Extraction ──────────────────────────────────

  const combinedContent = scrapedParts.join("\n\n---\n\n");

  emit("ai_stage2", "call", { gymName, location, model: model2 });
  let extracted;
  try {
    const stage2Content = await callAI(
      stage2Prompt(gymName, location, combinedContent),
      model2,
      openrouterKey
    );
    emit("ai_stage2", "result", stage2Content);
    extracted = parseEnrichmentResult(stage2Content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit("ai_stage2", "result", `Error: ${msg}`);
    return {
      success: false,
      status: "ERROR",
      data: { reason: `Stage 2 AI error: ${msg}` },
      error: msg,
    };
  }

  const confidence = parseInt(extracted.confidence_score ?? "0", 10);
  const status: string = confidence >= 50 ? "FOUND" : "LOW_CONFIDENCE";

  const firstOwner = extracted.owners?.split(",")[0]?.trim() ?? null;
  const firstCoach = extracted.coaches?.split(",")[0]?.trim() ?? null;

  return {
    success: true,
    status,
    data: {
      status,
      ...extracted,
      smoothcomp: extracted.smoothcomp ?? stage1Result.smoothcompUrl ?? null,
      owner_instagram: extracted.owner_instagram ?? stage1Result.instagramUrl ?? null,
    },
    sourceData: {
      status,
      aiOwner: firstOwner,
      aiCoach: firstCoach,
    },
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────

registerTemplate({
  slug: "gym_enrichment",
  name: "BJJ Gym Enrichment",
  description:
    "2-stage pipeline that discovers gym online presence and extracts structured data (website, email, phone, owners, coaches, software).",
  inputFields: [
    { key: "gymName", label: "Gym / Academy Name", required: true },
    { key: "location", label: "Location (City, State/Country)", required: true },
  ],
  outputFields: [
    { key: "name", label: "Gym Name" },
    { key: "website", label: "Website" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "locations", label: "Location(s)" },
    { key: "owners", label: "Owners" },
    { key: "coaches", label: "Coaches" },
    { key: "industry", label: "Industry" },
    { key: "social_media", label: "Social Media" },
    { key: "detected_software", label: "Software Detected" },
    { key: "confidence_score", label: "Confidence Score" },
    { key: "status", label: "Status" },
    { key: "reason", label: "Reason" },
    { key: "smoothcomp", label: "Smoothcomp URL" },
    { key: "owner_instagram", label: "Owner Instagram" },
  ],
  sourceOutputFields: [
    { key: "status", label: "Enrichment Status" },
    { key: "aiOwner", label: "AI Owner" },
    { key: "aiCoach", label: "AI Coach" },
  ],
  run: runGymEnrichment,
});
