/**
 * A stand-in for OpenRouter's /chat/completions that streams a fixed answer.
 * Lets the whole chain (app → Worker → model) run on a simulator without a key.
 *
 *   node scripts/mock-openrouter.mjs            # listens on 127.0.0.1:8788
 *   OPENROUTER_BASE_URL=http://127.0.0.1:8788/v1 in .dev.vars
 */
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8788);

function answerFor(messages) {
  const user = messages.find((m) => m.role === "user");
  const hasImage =
    Array.isArray(user?.content) && user.content.some((part) => part.type === "image_url");
  if (hasImage) return "Penne with garlic bread | 1120 | 32 | 150 | 40\nA generous plate. Enjoy every bite.";
  const question = typeof user?.content === "string" ? user.content : "";
  return (
    `You asked: "${question}". Mock model here, streaming word by word so the app can show live text. ` +
    "Your diary numbers come from the app, not from me.\n>> What’s a light dinner? | How much protein today? | Show my week"
  );
}

createServer((request, response) => {
  if (request.method !== "POST" || !request.url.endsWith("/chat/completions")) {
    response.writeHead(404).end();
    return;
  }
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const text = answerFor(body.messages ?? []);
    response.writeHead(200, { "content-type": "text/event-stream" });
    const words = text.match(/\S+\s*/g) ?? [];
    let index = 0;
    const timer = setInterval(() => {
      if (index >= words.length) {
        response.write("data: [DONE]\n\n");
        response.end();
        clearInterval(timer);
        return;
      }
      const chunk = { choices: [{ delta: { content: words[index++] } }] };
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }, 45);
  });
}).listen(port, "127.0.0.1", () => console.log(`mock openrouter on http://127.0.0.1:${port}/v1`));
