// Gemini streaming wrapper.
// Builds the prompt with a SESSION CONTEXT block and forwards the SSE stream
// from Google's generativelanguage endpoint, re-emitted as NDJSON text chunks.

const DEFAULT_MODEL = "gemini-3-flash-preview";
const MAX_CONTEXT_BYTES = 200 * 1024; // 200KB

function buildSystemPreamble(context) {
  const parts = [];
  parts.push("You are DoroDoro's focus assistant. You help the user plan and run their current work session.");
  parts.push("Answer concisely. If asked for a plan, produce short actionable steps.");
  parts.push("If the user explicitly asks you to create notes or todos in the workspace, you may do so by appending a hidden action payload at the very end of your reply.");
  parts.push("When you need to create workspace items, append exactly one XML tag on its own line in this form:");
  parts.push("<doro-action>{\"actions\":[...]}</doro-action>");
  parts.push("Supported actions: create_note with {title, content}, and create_todo_list with {title, items:[{text, priority}]}. Priority must be low, medium, or high.");
  parts.push("Only include the tag when the user clearly asked you to create something. Keep the normal user-facing answer outside the tag.");
  parts.push("");
  parts.push("[SESSION CONTEXT]");
  if (context.sessionTitle) parts.push(`Session title: ${context.sessionTitle}`);
  if (context.sessionDescription) parts.push(`Session description: ${context.sessionDescription}`);
  if (context.stats) {
    const s = context.stats;
    parts.push(
      `Stats: ${s.totalPomos || 0} pomos, ${Math.round((s.totalFocusSec || 0) / 60)}m focused, last focus ${s.lastFocusAt ? new Date(s.lastFocusAt).toISOString() : "n/a"}.`
    );
  }
  if (context.notes) {
    parts.push("");
    parts.push("Notes:");
    parts.push(context.notes);
  }
  if (Array.isArray(context.todos) && context.todos.length) {
    parts.push("");
    parts.push("Todos:");
    context.todos.forEach((column) => {
      parts.push(`- ${column.title}:`);
      (column.items || []).forEach((item) => {
        parts.push(`  [${item.done ? "x" : " "}] (${item.priority}) ${item.text}`);
      });
    });
  }
  parts.push("[/SESSION CONTEXT]");
  return parts.join("\n");
}

function truncatePayload(text, maxBytes) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  if (bytes.length <= maxBytes) return text;
  return new TextDecoder().decode(bytes.slice(0, maxBytes)) + "\n…";
}

function toGeminiContents(messages) {
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-40) // hard cap history
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, 8000) }],
    }));
}

export async function* streamChat(env, { messages, context }) {
  const model = (env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const systemText = truncatePayload(buildSystemPreamble(context), MAX_CONTEXT_BYTES);
  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`gemini ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const obj = JSON.parse(data);
        const chunkText = obj?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (chunkText) {
          fullText += chunkText;
          yield { type: "delta", text: chunkText };
        }
        if (obj?.usageMetadata) {
          tokensIn = obj.usageMetadata.promptTokenCount || tokensIn;
          tokensOut = obj.usageMetadata.candidatesTokenCount || tokensOut;
        }
      } catch (_) {
        // ignore malformed SSE
      }
    }
  }

  yield { type: "done", fullText, tokensIn, tokensOut };
}
