import { IndustryConfig } from "@/lib/industries";

export function stage1Prompt(
  entityName: string,
  location: string,
  serpResults: string,
  industry: IndustryConfig
): string {
  return `${industry.stage1SystemPrompt}

${industry.entityLabel}: "${entityName}"
Location: "${location}"

Search Results:
${serpResults}

Based on the search results, identify the official online presence for this specific ${industry.entityType}.

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
- Only include URLs that clearly belong to THIS ${industry.entityType} in THIS location
- If multiple entities with similar names exist, prefer the one in the specified location
- Do NOT include personal accounts — only official ${industry.entityLabel} accounts
- If you cannot confirm the ${industry.entityLabel} online presence with confidence >= 50, set status to "not_found"

Respond with ONLY the JSON object, no markdown, no explanation.`;
}

export function stage2Prompt(
  entityName: string,
  location: string,
  scrapedContent: string,
  industry: IndustryConfig
): string {
  return `${industry.stage2SystemPrompt}

${industry.entityLabel}: "${entityName}"
Location: "${location}"

Scraped Content:
${scrapedContent}

Extract all available information and return a JSON object:
{
  "name": "official ${industry.entityLabel} name or null",
  "website": "https://... or null",
  "email": "contact email or null",
  "phone": "phone number or null",
  "locations": "address(es) or null",
  "owners": "owner/principal name(s) comma-separated or null",
  "coaches": "staff/team member name(s) comma-separated or null",
  "industry": "${industry.label} or null",
  "social_media": "instagram:url, facebook:url, etc. or null",
  "detected_software": "name of booking/management software if found, or null",
  "confidence_score": "0-100 as string",
  "reason": "brief summary of what was found and confidence level",
  "smoothcomp": "https://smoothcomp.com/en/team/... or null",
  "owner_instagram": "https://instagram.com/owner_username or null"
}

Rules:
- Extract ONLY information that is explicitly present in the scraped content
- Do NOT invent or guess contact details
- confidence_score reflects how much confirmed data was found (0=none, 100=full profile)

Respond with ONLY the JSON object.`;
}
