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
- Extract Facebook and Instagram URLs even if they appear in search snippets or redirected URLs
- A Facebook business page URL (facebook.com/GymName) counts as a valid link even without full profile data in the snippet
- If you find at least one valid URL (website, Facebook, or Instagram), set status to "found" — do not require all links
- If you cannot find ANY URL for this ${industry.entityLabel}, set status to "not_found"

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
  "locations": "full address or city, state, country or null",
  "owners": "owner/principal name(s) comma-separated or null",
  "coaches": "staff/team member name(s) comma-separated or null",
  "industry": "${industry.label} or null",
  "facebook_url": "the GYM's official Facebook page URL or null",
  "instagram_url": "the GYM's official Instagram page URL or null",
  "detected_software": "name of booking/management software if found, or null",
  "confidence_score": "0-100 as string",
  "reason": "brief summary of what was found and confidence level",
  "smoothcomp": "https://smoothcomp.com/en/team/... or null",
  "owner_instagram": "the OWNER's PERSONAL Instagram URL (a different account from the gym's Instagram) or null"
}

Rules:
- Extract ONLY information that is explicitly present in the scraped content
- Do NOT invent or guess contact details
- PRIORITY: The Facebook page data is the most reliable source for email, phone, and address — always prefer Facebook data for these fields
- For email: check Facebook "Email:" field first, then look for mailto: links or email addresses on the website
- For phone: check Facebook "Phone:" field first, then look for tel: links or phone patterns on the website
- For locations: check Facebook "Address:" field first, then look for structured address data on the website

CRITICAL — Instagram field rules (read carefully):
- "instagram_url": This is the GYM's official Instagram account (e.g. instagram.com/gymname). If you find ANY Instagram account for the gym/academy, it goes HERE.
- "owner_instagram": This is ONLY for the owner's SEPARATE PERSONAL Instagram account (e.g. instagram.com/johndoe). This must be a DIFFERENT account from the gym's Instagram.
- If you only found ONE Instagram account, it is almost certainly the gym's account — put it in "instagram_url" and set "owner_instagram" to null.
- NEVER put the gym's Instagram in "owner_instagram". When in doubt, put it in "instagram_url".
- "facebook_url": The gym's official Facebook page URL

- For owners: look for "owner", "head instructor", "founder", "professor", "head coach" mentions
- For coaches: look for "instructor", "coach", "professor", staff page listings
- confidence_score reflects how much confirmed data was found (0=none, 100=full profile)

Respond with ONLY the JSON object.`;
}
