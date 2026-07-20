export interface AgentResult {
  foundGym: string | null;
  instagram: string | null;
  facebook: string | null;
  smoothcomp: string | null;
  source: string | null;
  reason: string;
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    foundGym: {
      type: ["string", "null"],
      description: "Name of the BJJ academy/gym where they currently train",
    },
    instagram: {
      type: ["string", "null"],
      description: "Instagram handle (without @)",
    },
    facebook: {
      type: ["string", "null"],
      description: "Facebook profile URL or name",
    },
    smoothcomp: {
      type: ["string", "null"],
      description: "Smoothcomp profile URL",
    },
    source: {
      type: ["string", "null"],
      description: "Which source confirmed the gym",
    },
    reason: {
      type: "string",
      description: "Brief explanation of how you found the gym or why you couldn't",
    },
  },
  required: ["foundGym", "instagram", "facebook", "smoothcomp", "source", "reason"],
};

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
