export interface AgentResult {
  foundGym: string | null;
  instagram: string | null;
  facebook: string | null;
  smoothcomp: string | null;
  source: string | null;
  reason: string;
}

export function parseAgentResult(content: string): AgentResult {
  // Try to extract JSON from the content
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    return {
      foundGym: null,
      instagram: null,
      facebook: null,
      smoothcomp: null,
      source: null,
      reason: "Could not parse agent response: " + content.slice(0, 200),
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return {
      foundGym: parsed.foundGym ?? null,
      instagram: parsed.instagram ?? null,
      facebook: parsed.facebook ?? null,
      smoothcomp: parsed.smoothcomp ?? null,
      source: parsed.source ?? null,
      reason: parsed.reason ?? "No reason provided",
    };
  } catch {
    return {
      foundGym: null,
      instagram: null,
      facebook: null,
      smoothcomp: null,
      source: null,
      reason: "JSON parse error: " + content.slice(0, 200),
    };
  }
}
