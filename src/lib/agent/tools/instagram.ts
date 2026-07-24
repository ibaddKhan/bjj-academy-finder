export async function instagramScrape(
  username: string,
  rapidApiKey: string,
  remainingSearches: { count: number }
): Promise<string> {
  remainingSearches.count--;

  // Clean username
  const cleanUsername = username.replace(/^@/, "").trim();

  try {
    const response = await fetch(
      `https://instagram-looter2.p.rapidapi.com/profile?username=${encodeURIComponent(cleanUsername)}`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "instagram-looter2.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return `Instagram scrape failed: HTTP ${response.status} - ${text}\nRemaining searches: ${remainingSearches.count}`;
    }

    const data = await response.json();

    let result = "";

    if (data.biography) {
      result += `Bio: ${data.biography}\n`;
    }
    if (data.full_name) {
      result += `Name: ${data.full_name}\n`;
    }
    if (data.follower_count) {
      result += `Followers: ${data.follower_count}\n`;
    }
    if (data.category_name) {
      result += `Category: ${data.category_name}\n`;
    }
    if (data.external_url) {
      result += `Website: ${data.external_url}\n`;
    }

    // Recent posts
    if (data.edge_owner_to_timeline_media?.edges) {
      result += "\nRecent post captions:\n";
      const posts = data.edge_owner_to_timeline_media.edges.slice(0, 5);
      for (const post of posts) {
        const caption = post.node?.edge_media_to_caption?.edges?.[0]?.node?.text;
        if (caption) {
          result += `- ${caption.slice(0, 200)}\n`;
        }
      }
    }

    if (!result) {
      result = "Profile found but no useful data extracted.";
    }

    result += `\nRemaining searches: ${remainingSearches.count}`;
    return result;
  } catch (error) {
    return `Instagram error: ${error instanceof Error ? error.message : String(error)}\nRemaining searches: ${remainingSearches.count}`;
  }
}
