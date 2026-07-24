export function stage1Prompt(gymName: string, location: string, serpResults: string): string {
  return `You are a BJJ gym research assistant. Your task is to find online presence links for a BJJ gym/academy.

Gym: "${gymName}"
Location: "${location}"

Search Results:
${serpResults}

Based on the search results, identify the official online presence for this specific BJJ gym/academy.

Return a JSON object:
{
  "status": "found" | "not_found",
  "websiteUrl": "https://... or null",
  "facebookUrl": "https://facebook.com/... or null",
  "smoothcompUrl": "https://smoothcomp.com/en/team/... or null",
  "instagramUrl": "https://instagram.com/... or null",
  "confidence": 0-100,
  "reason": "brief explanation"
}

Rules:
- Only include URLs that clearly belong to THIS gym in THIS location
- If multiple gyms with similar names exist, prefer the one in the specified location
- smoothcompUrl should be a TEAM page (smoothcomp.com/en/team/...), not an athlete page
- Do NOT include social media personal accounts, only official gym accounts
- If you cannot confirm the gym's online presence with confidence >= 50, set status to "not_found"

Respond with ONLY the JSON object, no markdown, no explanation.`;
}

export function stage2Prompt(
  gymName: string,
  location: string,
  scrapedContent: string
): string {
  return `You are a BJJ gym data extraction expert. Extract structured information about this BJJ gym.

Gym: "${gymName}"
Location: "${location}"

Scraped Content:
${scrapedContent}

Extract all available information and return a JSON object:
{
  "name": "official gym name or null",
  "website": "https://... or null",
  "email": "contact@... or null",
  "phone": "+1234567890 or null",
  "locations": "address(es) or null",
  "owners": "owner name(s) comma-separated or null",
  "coaches": "coach name(s) comma-separated or null",
  "industry": "BJJ | MMA | Grappling | Fitness | etc. or null",
  "social_media": "instagram:url, facebook:url, etc. or null",
  "detected_software": "name of booking/scheduling software if found, or null",
  "confidence_score": "0-100 as string",
  "reason": "brief summary of what was found and confidence level",
  "smoothcomp": "https://smoothcomp.com/en/team/... or null",
  "owner_instagram": "https://instagram.com/owner_username or null"
}

Rules:
- Extract ONLY information that is explicitly present in the scraped content
- Do NOT invent or guess contact details
- "owners" = people listed as owner/head instructor/founder
- "coaches" = people listed as coaches/instructors (excluding head instructor if listed in owners)
- "detected_software" = gym management software like Wodify, Mindbody, Zen Planner, Kicksite, Pike13, etc.
- confidence_score reflects how much confirmed data was found (0=none, 100=full profile)

Respond with ONLY the JSON object.`;
}
