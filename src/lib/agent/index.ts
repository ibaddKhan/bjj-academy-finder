import { SYSTEM_PROMPT } from "./prompt";
import { AgentResult, parseAgentResult } from "./schema";
import { serperSearch } from "./tools/serper";
import { instagramScrape, instagramSearch } from "./tools/instagram";
import { facebookScrape } from "./tools/facebook";
import { smoothcompSearch, smoothcompProfile } from "./tools/smoothcomp";
import { emitJobEvent, SSEEvent } from "@/lib/events";

export interface AgentSettings {
  openrouterKey: string;
  openrouterModel: string;
  serperKey: string;
  instagramKey: string;
  facebookKey: string;
  zenrowsKey: string;
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

const OPENROUTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "search",
      description: "Search the web for information about a BJJ competitor",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "instagram",
      description: "Search Instagram for a user profile or scrape a specific profile",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["search", "profile"],
            description: "Whether to search for users or scrape a specific profile",
          },
          query: {
            type: "string",
            description: "Search query (for search) or username (for profile, without @)",
          },
        },
        required: ["action", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "smoothcomp",
      description: "Search Smoothcomp competition database for a BJJ athlete",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["search", "profile"],
            description: "Whether to search for athletes or scrape a specific profile URL",
          },
          query: {
            type: "string",
            description: "Athlete name (for search) or profile URL (for profile)",
          },
        },
        required: ["action", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "facebook",
      description: "Search Facebook for a BJJ competitor's profile",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name or search query for the competitor",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function runAgent(
  attendeeName: string,
  settings: AgentSettings,
  jobId: string,
  rowId: string,
  rowIndex: number
): Promise<AgentResult> {
  const MAX_ITERATIONS = 12;
  const remainingSearches = { count: MAX_ITERATIONS };

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Find the current BJJ training academy/gym for: ${attendeeName}`,
    },
  ];

  const toolLog: SSEEvent[] = [];

  function emit(event: Omit<SSEEvent, "timestamp">) {
    const fullEvent: SSEEvent = { ...event, timestamp: Date.now() };
    toolLog.push(fullEvent);
    emitJobEvent(fullEvent);
  }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
          "X-Title": "BJJ Academy Finder",
        },
        body: JSON.stringify({
          model: settings.openrouterModel || "anthropic/claude-haiku-4-5",
          messages,
          tools: OPENROUTER_TOOLS,
          tool_choice: "auto",
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("No response from OpenRouter");
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // No tool calls — we have a final answer
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const content = assistantMessage.content ?? "";
      return parseAgentResult(content);
    }

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, string> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }

      emit({
        type: "tool_call",
        jobId,
        rowId,
        rowIndex,
        attendeeName,
        tool: toolName,
        input: toolArgs,
      });

      let toolResult = "";

      try {
        switch (toolName) {
          case "search":
            toolResult = await serperSearch(
              toolArgs.query,
              settings.serperKey,
              remainingSearches
            );
            break;

          case "instagram":
            if (toolArgs.action === "profile") {
              toolResult = await instagramScrape(
                toolArgs.query,
                settings.instagramKey,
                remainingSearches
              );
            } else {
              toolResult = await instagramSearch(
                toolArgs.query,
                settings.instagramKey,
                remainingSearches
              );
            }
            break;

          case "smoothcomp":
            if (toolArgs.action === "profile") {
              toolResult = await smoothcompProfile(
                toolArgs.query,
                settings.zenrowsKey,
                remainingSearches
              );
            } else {
              toolResult = await smoothcompSearch(
                toolArgs.query,
                settings.zenrowsKey,
                remainingSearches
              );
            }
            break;

          case "facebook":
            toolResult = await facebookScrape(
              toolArgs.query,
              settings.facebookKey,
              remainingSearches
            );
            break;

          default:
            toolResult = `Unknown tool: ${toolName}`;
        }
      } catch (err) {
        toolResult = `Tool execution error: ${err instanceof Error ? err.message : String(err)}\nRemaining searches: ${remainingSearches.count}`;
      }

      emit({
        type: "tool_result",
        jobId,
        rowId,
        rowIndex,
        attendeeName,
        tool: toolName,
        output: toolResult,
      });

      messages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: toolCall.id,
        name: toolName,
      });
    }

    // Budget exhausted
    if (remainingSearches.count <= 0) {
      break;
    }
  }

  // Force final answer after max iterations
  const finalResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        "X-Title": "BJJ Academy Finder",
      },
      body: JSON.stringify({
        model: settings.openrouterModel || "anthropic/claude-haiku-4-5",
        messages: [
          ...messages,
          {
            role: "user",
            content:
              "Based on your research so far, please provide your final answer as a JSON object with fields: foundGym, instagram, facebook, smoothcomp, source, reason.",
          },
        ],
        max_tokens: 512,
      }),
    }
  );

  if (!finalResponse.ok) {
    return {
      foundGym: null,
      instagram: null,
      facebook: null,
      smoothcomp: null,
      source: null,
      reason: "Max iterations reached, could not get final answer",
    };
  }

  const finalData = await finalResponse.json();
  const finalContent = finalData.choices?.[0]?.message?.content ?? "";
  return parseAgentResult(finalContent);
}
