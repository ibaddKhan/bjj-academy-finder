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
    const compMatches = Array.from(html.matchAll(/(\d{4})[^"]*(?:World|Pan|Euro|IBJJF)[^<]*/gi));
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
