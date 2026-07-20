export async function facebookScrape(
  query: string,
  rapidApiKey: string,
  remainingSearches: { count: number }
): Promise<string> {
  remainingSearches.count--;

  try {
    // Using a Facebook scraper API via RapidAPI
    const response = await fetch(
      `https://facebook-scraper3.p.rapidapi.com/search/people?query=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "facebook-scraper3.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return `Facebook scrape failed: HTTP ${response.status} - ${text}\nRemaining searches: ${remainingSearches.count}`;
    }

    const data = await response.json();

    let result = "Facebook search results:\n";

    const people = data.data ?? data.results ?? [];
    for (const person of people.slice(0, 5)) {
      if (person.name) result += `Name: ${person.name}\n`;
      if (person.url) result += `URL: ${person.url}\n`;
      if (person.work) result += `Work: ${JSON.stringify(person.work)}\n`;
      if (person.location) result += `Location: ${person.location}\n`;
      result += "\n";
    }

    if (people.length === 0) {
      result += "No results found.";
    }

    result += `\nRemaining searches: ${remainingSearches.count}`;
    return result;
  } catch (error) {
    return `Facebook error: ${error instanceof Error ? error.message : String(error)}\nRemaining searches: ${remainingSearches.count}`;
  }
}
