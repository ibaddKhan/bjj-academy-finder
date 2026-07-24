/**
 * Scrape a Smoothcomp team page using ZenRows.
 */
export async function smoothcompTeamScrape(
  teamUrl: string,
  zenrowsKey: string
): Promise<string> {
  if (!zenrowsKey) {
    return "ZenRows API key not configured.";
  }

  try {
    const response = await fetch(
      `https://api.zenrows.com/v1/?apikey=${zenrowsKey}&url=${encodeURIComponent(teamUrl)}&js_render=true`,
      { method: "GET" }
    );

    if (!response.ok) {
      return `Smoothcomp team scrape failed: HTTP ${response.status}`;
    }

    const html = await response.text();
    return extractSmootchcompTeamData(html, teamUrl);
  } catch (error) {
    return `Smoothcomp team scrape error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function extractSmootchcompTeamData(html: string, url: string): string {
  let result = `Smoothcomp Team: ${url}\n`;

  // Extract team name
  const nameMatch =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
    html.match(/class=["'][^"']*team-name[^"']*["'][^>]*>([^<]+)</i);
  if (nameMatch) result += `Team Name: ${nameMatch[1].trim()}\n`;

  // Extract location/country
  const locationMatch = html.match(/(?:Location|Country|City)[:\s]*([^<\n]+)/i);
  if (locationMatch) result += `Location: ${locationMatch[1].trim()}\n`;

  // Extract athletes (members)
  const athleteLinks = Array.from(
    html.matchAll(/href="(\/en\/athlete\/[^"]+)"[^>]*>([^<]+)<\/a>/g)
  );
  const athletes: string[] = [];
  for (const match of athleteLinks.slice(0, 10)) {
    athletes.push(`${match[2].trim()} (https://smoothcomp.com${match[1]})`);
  }
  if (athletes.length) result += `Athletes: ${athletes.join("; ")}\n`;

  // Extract coaches
  const coachMatch = html.match(/(?:Coach|Instructor|Head)[^<]*<[^>]*>([^<]+)</i);
  if (coachMatch) result += `Coach: ${coachMatch[1].trim()}\n`;

  // Body text
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
  result += `\nContent: ${bodyText}`;

  return result;
}
