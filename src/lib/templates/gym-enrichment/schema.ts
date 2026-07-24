export type EnrichmentStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "SERP_NOT_FOUND"
  | "SERP_AGENT_NOT_FOUND"
  | "LOW_CONFIDENCE"
  | "ERROR";

export interface Stage1Result {
  status: "found" | "not_found";
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  smoothcompUrl?: string | null;
  instagramUrl?: string | null;
  confidence?: number;
  reason?: string;
}

export interface EnrichmentResult {
  status: EnrichmentStatus;
  name: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  locations: string | null;
  owners: string | null;
  coaches: string | null;
  industry: string | null;
  social_media: string | null;
  detected_software: string | null;
  confidence_score: string | null;
  reason: string;
  smoothcomp: string | null;
  owner_instagram: string | null;
  // Written back to source sheet
  aiOwner: string | null;
  aiCoach: string | null;
}

export function parseStage1Result(content: string): Stage1Result {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    return { status: "not_found", reason: "Could not parse Stage 1 response" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return {
      status: parsed.status === "found" ? "found" : "not_found",
      websiteUrl: parsed.websiteUrl ?? null,
      facebookUrl: parsed.facebookUrl ?? null,
      smoothcompUrl: parsed.smoothcompUrl ?? null,
      instagramUrl: parsed.instagramUrl ?? null,
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason ?? "",
    };
  } catch {
    return { status: "not_found", reason: "JSON parse error in Stage 1" };
  }
}

export function parseEnrichmentResult(
  content: string
): Omit<EnrichmentResult, "status" | "aiOwner" | "aiCoach"> {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/(\{[\s\S]*\})/);

  const empty = {
    name: null,
    website: null,
    email: null,
    phone: null,
    locations: null,
    owners: null,
    coaches: null,
    industry: null,
    social_media: null,
    detected_software: null,
    confidence_score: null,
    reason: "Could not parse response",
    smoothcomp: null,
    owner_instagram: null,
  };

  if (!jsonMatch) return empty;

  try {
    const p = JSON.parse(jsonMatch[1]);
    return {
      name: p.name ?? null,
      website: p.website ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      locations: p.locations ?? null,
      owners: p.owners ?? null,
      coaches: p.coaches ?? null,
      industry: p.industry ?? null,
      social_media: p.social_media ?? null,
      detected_software: p.detected_software ?? null,
      confidence_score: p.confidence_score ?? null,
      reason: p.reason ?? "No reason provided",
      smoothcomp: p.smoothcomp ?? null,
      owner_instagram: p.owner_instagram ?? null,
    };
  } catch {
    return { ...empty, reason: "JSON parse error in Stage 2" };
  }
}
