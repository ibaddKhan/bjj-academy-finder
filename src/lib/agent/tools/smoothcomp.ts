export async function smoothcompSearch(
  athleteName: string,
  zenrowsApiKey: string,
  remainingSearches: { count: number }
): Promise<string> {
  remainingSearches.count--;

  const searchUrl = `https://smoothcomp.com/en/athletes?search=${encodeURIComponent(athleteName)}`;

  try {
    // Use ZenRows to bypass anti-bot protection
    const response = await fetch(
      `https://api.zenrows.com/v1/?apikey=${zenrowsApiKey}&url=${encodeURIComponent(searchUrl)}&js_render=true`,
      {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return `Smoothcomp scrape failed: HTTP ${response.status} - ${text.slice(0, 200)}\nRemaining searches: ${remainingSearches.count}`;
    }

    const html = await response.text();

    // Extract athlete information from HTML
    let result = "Smoothcomp search results:\n";

    // Look for athlete cards/links
    const athleteMatches = html.matchAll(
      /href="(\/en\/athlete\/[^"]+)"[^>]*>([^<]+)<\/a>/g
    );
    const athletes: string[] = [];
    for (const match of athleteMatches) {
      athletes.push(`- https://smoothcomp.com${match[1]}: ${match[2].trim()}`);
    }

    if (athletes.length > 0) {
      result += athletes.slice(0, 5).join("\n");
    } else {
      // Look for any gym/academy mentions in the page
      const gymMatches = html.matchAll(/Academy[:\s]+([^<\n]+)/gi);
      const gyms: string[] = [];
      for (const match of gymMatches) {
        gyms.push(match[1].trim());
      }
      if (gyms.length > 0) {
        result += "Gyms found: " + [...new Set(gyms)].slice(0, 5).join(", ");
      } else {
        result += "No athletes found matching the search.";
      }
    }

    result += `\nRemaining searches: ${remainingSearches.count}`;
    return result;
  } catch (error) {
    return `Smoothcomp error: ${error instanceof Error ? error.message : String(error)}\nRemaining searches: ${remainingSearches.count}`;
  }
}

export async function smoothcompProfile(
  profileUrl: string,
  zenrowsApiKey: string,
  remainingSearches: { count: number }
): Promise<string> {
  remainingSearches.count--;

  try {
    const response = await fetch(
      `https://api.zenrows.com/v1/?apikey=${zenrowsApiKey}&url=${encodeURIComponent(profileUrl)}&js_render=true`,
      { method: "GET" }
    );

    if (!response.ok) {
      return `Smoothcomp profile failed: HTTP ${response.status}\nRemaining searches: ${remainingSearches.count}`;
    }

    const html = await response.text();

    // Extract profile details
    let result = `Smoothcomp profile: ${profileUrl}\n`;

    // Extract academy
    const academyMatch = html.match(/Academy[:\s]*<[^>]*>([^<]+)<\//i) ||
      html.match(/Team[:\s]*<[^>]*>([^<]+)<\//i) ||
      html.match(/Club[:\s]*<[^>]*>([^<]+)<\//i);

    if (academyMatch) {
      result += `Academy: ${academyMatch[1].trim()}\n`;
    }

    // Extract name
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (nameMatch) {
      result += `Name: ${nameMatch[1].trim()}\n`;
    }

    // Look for any competition data
    const compMatches = html.matchAll(/(\d{4})[^"]*(?:World|Pan|Euro|IBJJF)[^<]*/gi);
    const comps: string[] = [];
    for (const match of compMatches) {
      comps.push(match[0].trim().slice(0, 100));
    }
    if (comps.length > 0) {
      result += `Recent competitions: ${comps.slice(0, 3).join(" | ")}\n`;
    }

    result += `\nRemaining searches: ${remainingSearches.count}`;
    return result;
  } catch (error) {
    return `Smoothcomp profile error: ${error instanceof Error ? error.message : String(error)}\nRemaining searches: ${remainingSearches.count}`;
  }
}
