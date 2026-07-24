/**
 * Scrape a Facebook page by URL using the RapidAPI facebook-scraper3.
 */
export async function facebookPageScrape(
  pageUrl: string,
  rapidApiKey: string
): Promise<string> {
  if (!rapidApiKey) {
    return "RapidAPI key not configured.";
  }

  try {
    const response = await fetch(
      `https://facebook-scraper3.p.rapidapi.com/page?url=${encodeURIComponent(pageUrl)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "facebook-scraper3.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return `Facebook page scrape failed: HTTP ${response.status} — ${text.slice(0, 200)}`;
    }

    const data = await response.json();
    return formatFacebookPageData(data, pageUrl);
  } catch (error) {
    return `Facebook page scrape error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function formatFacebookPageData(data: Record<string, unknown>, url: string): string {
  let result = `Facebook Page: ${url}\n`;

  const d = data as {
    name?: string;
    about?: string;
    email?: string;
    phone?: string;
    website?: string;
    category?: string;
    address?: string | { city?: string; street?: string; country?: string };
    followers?: number;
    likes?: number;
    description?: string;
    posts?: Array<{ message?: string }>;
  };

  if (d.name) result += `Name: ${d.name}\n`;
  if (d.category) result += `Category: ${d.category}\n`;
  if (d.about) result += `About: ${String(d.about).slice(0, 300)}\n`;
  if (d.description) result += `Description: ${String(d.description).slice(0, 300)}\n`;
  if (d.email) result += `Email: ${d.email}\n`;
  if (d.phone) result += `Phone: ${d.phone}\n`;
  if (d.website) result += `Website: ${d.website}\n`;
  if (d.address) {
    const addr = typeof d.address === "string" ? d.address : JSON.stringify(d.address);
    result += `Address: ${addr}\n`;
  }
  if (d.followers) result += `Followers: ${d.followers}\n`;

  if (d.posts?.length) {
    result += `\nRecent posts:\n`;
    for (const post of d.posts.slice(0, 3)) {
      if (post.message) result += `- ${String(post.message).slice(0, 200)}\n`;
    }
  }

  return result;
}
