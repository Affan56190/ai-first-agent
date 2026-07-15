import { NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

type ChatTurn = { role: "user" | "agent"; content: string };

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

function historyToMessages(history: ChatTurn[]): BaseMessage[] {
  return history.map((turn) =>
    turn.role === "user"
      ? new HumanMessage(turn.content)
      : new AIMessage(turn.content)
  );
}

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[searchTavily] No TAVILY_API_KEY set — skipping search.");
    return "";
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 3 }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`[searchTavily] Tavily request failed (${res.status}):`, errText);
    return "";
  }

  const data = await res.json();
  return (data.results || [])
    .map((r: any) => `- ${r.title}: ${r.content}`)
    .join("\n");
}

// ---------------------------------------------
// Step 1: decide if search is needed (same logic as before,
// just called directly instead of through a graph — this makes
// it simpler to then hand off to a streaming final answer).
// ---------------------------------------------
async function decideIfSearchNeeded(question: string, history: ChatTurn[]): Promise<boolean> {
  const historyText = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Agent"}: ${t.content}`)
    .join("\n");

  const response = await llm.invoke(
    `Conversation so far:
${historyText || "(no previous messages)"}

New question: "${question}"

Does answering this NEW question require current/real-time information from
the web (news, prices, recent events, live data)? Consider conversation context.
Reply with ONLY one word: YES or NO.`
  );

  return response.content.toString().trim().toUpperCase().includes("YES");
}

// ---------------------------------------------
// The API route — this time returns a STREAM instead of one JSON blob.
//
// Protocol: the first line sent back is a small JSON metadata object
// (e.g. whether search was used), followed by a newline, followed by
// the answer text streamed in small chunks as it's generated.
// The frontend reads the first line separately, then displays
// everything after it as it arrives.
// ---------------------------------------------
export async function POST(req: NextRequest) {
  const { question, history } = await req.json();

  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "Missing question" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const safeHistory: ChatTurn[] = Array.isArray(history) ? history : [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: decide (not streamed — it's a quick single decision)
        const needsSearch = await decideIfSearchNeeded(question, safeHistory);

        // Step 2: search if needed (not streamed — it's a single fetch call)
        let searchResults = "";
        if (needsSearch) {
          searchResults = await searchTavily(question);
        }
        const actuallyUsedSearch = Boolean(searchResults && searchResults.trim());

        // Send metadata as the very first chunk, so the frontend
        // knows upfront whether search was used.
        controller.enqueue(
          encoder.encode(JSON.stringify({ usedSearch: actuallyUsedSearch }) + "\n")
        );

        // Step 3: stream the final answer token-by-token
        const pastMessages = historyToMessages(safeHistory);
        const contextNote = searchResults
          ? `\n\n[Relevant web search results]\n${searchResults}\n\nUse these where relevant, and mention the answer is based on current web info.`
          : "";

        const messages: BaseMessage[] = [
          ...pastMessages,
          new HumanMessage(question + contextNote),
        ];

        const llmStream = await llm.stream(messages);

        for await (const chunk of llmStream) {
          const text = chunk.content?.toString() ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }

        controller.close();
      } catch (err) {
        console.error("Streaming agent error:", err);
        controller.enqueue(
          encoder.encode("\n\n[Error: something went wrong generating the response]")
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
