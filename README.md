# 🤖 My First AI Agent

A web app featuring a real **agentic AI** system — not just a chatbot wrapper, but an agent
that reasons about what it needs, decides whether to use a tool, and responds accordingly.

Built as a hands-on learning project to understand how agentic AI actually works under the hood.

## What makes this an "agent" (not just a chatbot)

Most AI chat wrappers simply forward your message to an LLM and return the answer. This project
goes a step further — the agent:

1. **Reasons about the request** — decides on its own whether a question needs current,
   real-time information from the web, or can be answered directly from its own knowledge
2. **Uses a tool conditionally** — only calls a live web search API when it actually decides
   it's needed, rather than always searching or never searching
3. **Maintains conversation memory** — understands follow-up questions in context
   (e.g. "how tall is it?" correctly refers to something mentioned earlier)
4. **Streams its response** — generates and sends back the answer token-by-token in real time,
   rather than making you wait for the full response

## Tech stack

- **Next.js** (App Router) — full-stack React framework
- **TypeScript**
- **OpenAI API** (`gpt-4o-mini`) — the underlying language model
- **Tavily API** — real-time web search tool for the agent
- **LangChain** — message handling and LLM orchestration

## How it works

```
User question
     │
     ▼
Agent decides: "Do I need current web info to answer this?"
     │
     ├── NO  ──► Answer directly from model knowledge (streamed)
     │
     └── YES ──► Search the web ──► Answer using search results (streamed)
```

The agent also receives the full conversation history with each request, so it can
correctly interpret follow-up questions rather than treating every message in isolation.

## Running it locally

1. Clone this repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the root with:
   ```
   OPENAI_API_KEY=your_openai_key
   TAVILY_API_KEY=your_tavily_key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## What I learned building this

- How to structure an LLM-powered app around **decisions**, not just fixed prompts
- Conditional tool use — the core idea behind agentic AI
- Handling streaming responses over HTTP, from backend to frontend
- Managing conversation state/memory across multiple turns
- Debugging real-world dependency conflicts, environment variable setup, and Next.js
  App Router API routes

## Future improvements

- [ ] Add more tools (e.g. a weather API, a calculator)
- [ ] Persist conversation history across page reloads
- [ ] Deploy live on Vercel

---

*Built by Muhammad Affan — BS Computer Science student, exploring the intersection of
AI and cybersecurity.*
