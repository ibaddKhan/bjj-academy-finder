export interface SerperResult {
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  answerBox?: {
    answer?: string;
    snippet?: string;
  };
  knowledgeGraph?: {
    title?: string;
    description?: string;
  };
}

export async function serperSearch(
  query: string,
  apiKey: string,
  remainingSearches: { count: number }
): Promise<string> {
  remainingSearches.count--;

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      const text = await response.text();
      return `Search failed: HTTP ${response.status} - ${text}\nRemaining searches: ${remainingSearches.count}`;
    }

    const data: SerperResult = await response.json();

    let result = "";

    if (data.answerBox?.snippet || data.answerBox?.answer) {
      result += `Answer Box: ${data.answerBox.snippet || data.answerBox.answer}\n\n`;
    }

    if (data.knowledgeGraph?.title) {
      result += `Knowledge Graph: ${data.knowledgeGraph.title} - ${data.knowledgeGraph.description ?? ""}\n\n`;
    }

    if (data.organic && data.organic.length > 0) {
      result += "Organic Results:\n";
      for (const item of data.organic) {
        result += `- ${item.title}\n  URL: ${item.link}\n  ${item.snippet}\n\n`;
      }
    }

    if (!result) {
      result = "No results found.";
    }

    result += `\nRemaining searches: ${remainingSearches.count}`;
    return result;
  } catch (error) {
    return `Search error: ${error instanceof Error ? error.message : String(error)}\nRemaining searches: ${remainingSearches.count}`;
  }
}
