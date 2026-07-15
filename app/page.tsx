"use client";

import { useState } from "react";

type Message = {
  role: "user" | "agent";
  content: string;
  usedSearch?: boolean;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };

    const historyToSend = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Add an empty placeholder agent message that we'll fill in
    // as chunks arrive.
    setMessages((prev) => [...prev, { role: "agent", content: "" }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          history: historyToSend,
        }),
      });

      if (!res.body) throw new Error("No response body received.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let metadataParsed = false;
      let usedSearch = false;

      // We update this one message in place as new text streams in.
      // -1 refers to "the last message" — the placeholder we just added.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        if (!metadataParsed) {
          const newlineIndex = buffer.indexOf("\n");
          if (newlineIndex === -1) continue; // wait for the full metadata line

          const metaLine = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          metadataParsed = true;

          try {
            const meta = JSON.parse(metaLine);
            usedSearch = Boolean(meta.usedSearch);
          } catch {
            // if metadata parsing fails, just continue without it
          }
        }

        if (buffer) {
          const chunkText = buffer;
          buffer = "";

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunkText,
              usedSearch,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "agent",
          content: "Error: could not reach the agent.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  function handleReset() {
    setMessages([]);
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>🤖 My First AI Agent</h1>
        <button
          onClick={handleReset}
          style={{
            fontSize: "0.8rem",
            padding: "0.4rem 0.8rem",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          New conversation
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1rem",
          minHeight: 400,
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>
            Ask me anything — responses now stream in as they're generated, just like ChatGPT.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#0070f3" : "#f1f1f1",
              color: msg.role === "user" ? "#fff" : "#000",
              padding: "0.6rem 1rem",
              borderRadius: 12,
              maxWidth: "80%",
              minHeight: msg.role === "agent" && !msg.content ? "1.2rem" : undefined,
            }}
          >
            {msg.content || (msg.role === "agent" && loading && i === messages.length - 1 ? "..." : "")}
            {msg.usedSearch && (
              <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: 4 }}>
                🔍 used web search
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={loading}
          style={{ flex: 1, padding: "0.6rem", borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: 6,
            background: "#0070f3",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </main>
  );
}
