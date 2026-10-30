/** Turns an OpenAI-compatible SSE stream into plain text deltas. Pure, so tests can feed it chunks. */

export function createDeltaParser() {
  let buffer = "";
  /** Returns the text deltas contained in this chunk; `done` once `[DONE]` arrived. */
  return function push(chunk: string): { deltas: string[]; done: boolean } {
    buffer += chunk;
    const deltas: string[] = [];
    let done = false;
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        done = true;
        continue;
      }
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) deltas.push(delta);
        const error = json?.error?.message;
        if (error) throw new Error(String(error));
      } catch (error) {
        if (error instanceof SyntaxError) continue; // keep-alive comments, partial junk
        throw error;
      }
    }
    return { deltas, done };
  };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
};

export type OpenRouterEnv = {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  OPENROUTER_BASE_URL: string;
};

/** Streams the model's text to `onDelta`; resolves with the full text. */
export async function streamChat(
  env: OpenRouterEnv,
  messages: ChatMessage[],
  onDelta: (text: string) => Promise<void> | void,
  signal: AbortSignal,
  options: { maxTokens?: number; temperature?: number } = {},
) {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": "https://github.com/Appllama/zest-kcal-tracker",
      "x-title": "Zest",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      stream: true,
      max_tokens: options.maxTokens ?? 220,
      temperature: options.temperature ?? 0.4,
      messages,
    }),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`upstream ${response.status}: ${detail.slice(0, 300)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parse = createDeltaParser();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = parse(decoder.decode(value, { stream: true }));
    for (const delta of parsed.deltas) {
      full += delta;
      await onDelta(delta);
    }
    if (parsed.done) break;
  }
  return full;
}
