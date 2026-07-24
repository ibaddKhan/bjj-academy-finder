/**
 * Scrape a website using ScrapingAnt API.
 */
export async function scrapeWebsite(
  url: string,
  scrapingantKey: string
): Promise<string> {
  if (!scrapingantKey) {
    return "ScrapingAnt API key not configured.";
  }

  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(
      `https://api.scrapingant.com/v2/general?url=${encodedUrl}&x-api-key=${scrapingantKey}&browser=false`,
      { method: "GET" }
    );

    if (!response.ok) {
      const text = await response.text();
      return `Website scrape failed: HTTP ${response.status} — ${text.slice(0, 200)}`;
    }

    const html = await response.text();
    return extractTextContent(html, url);
  } catch (error) {
    return `Website scrape error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function extractTextContent(html: string, url: string): string {
  let result = `Website: ${url}\n`;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) result += `Title: ${titleMatch[1].trim()}\n`;

  // Extract meta description
  const metaDesc = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  if (metaDesc) result += `Description: ${metaDesc[1].trim()}\n`;

  // Extract emails
  const emails = [...new Set(html.match(/[\w.-]+@[\w.-]+\.\w+/g) ?? [])].slice(0, 5);
  if (emails.length) result += `Emails: ${emails.join(", ")}\n`;

  // Extract phone numbers
  const phones = [
    ...new Set(
      html.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s][0-9]{3}[-.\s][0-9]{4}/g) ?? []
    ),
  ].slice(0, 3);
  if (phones.length) result += `Phones: ${phones.join(", ")}\n`;

  // Extract social media links
  const socials: string[] = [];
  const igMatch = html.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  if (igMatch) socials.push(`instagram: https://instagram.com/${igMatch[1]}`);
  const fbMatch = html.match(/facebook\.com\/([A-Za-z0-9._/-]+)/);
  if (fbMatch) socials.push(`facebook: https://facebook.com/${fbMatch[1]}`);
  if (socials.length) result += `Social: ${socials.join(", ")}\n`;

  // Detect gym management software
  const software: string[] = [];
  if (html.includes("wodify")) software.push("Wodify");
  if (html.includes("mindbody")) software.push("Mindbody");
  if (html.includes("zenplanner")) software.push("Zen Planner");
  if (html.includes("kicksite")) software.push("Kicksite");
  if (html.includes("pike13")) software.push("Pike13");
  if (html.includes("jackrabbit")) software.push("Jackrabbit");
  if (html.includes("clubready")) software.push("ClubReady");
  if (software.length) result += `Software: ${software.join(", ")}\n`;

  // Extract body text (strip tags)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyText = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
    result += `\nContent:\n${bodyText}`;
  }

  return result;
}
