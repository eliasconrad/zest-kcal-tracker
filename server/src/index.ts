/**
 * Zest API: a thin streaming proxy in front of OpenRouter.
 *
 *   POST /v1/meal  { image: data-URL, type, hint?, locale? }  → SSE of {type:"text",delta} … {type:"done"}
 *   POST /v1/ask   { question, diary }                         → same wire format
 *   GET  /health
 *
 * The app parses the model's text itself (see src/cookbooks/zest/data/replies.ts),
 * so this Worker stays model-agnostic: change OPENROUTER_MODEL and redeploy.
 */
import {
  askSystemPrompt,
  mealSystemPrompt,
  mealTypes,
  mealUserPrompt,
  type DiaryContext,
  type MealType,
} from "./prompts.ts";
import { streamChat, type ChatMessage } from "./openrouter.ts";

export interface Env {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  OPENROUTER_BASE_URL: string;
  ZEST_APP_TOKEN?: string;
  ZEST_MAX_IMAGE_BYTES?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function authorized(request: Request, env: Env) {
  if (!env.ZEST_APP_TOKEN) return true;
  return request.headers.get("x-zest-token") === env.ZEST_APP_TOKEN;
}

/** One SSE response; `run` writes events, errors become an `error` event instead of a broken stream. */
function sse(run: (send: (event: object) => Promise<void>, signal: AbortSignal) => Promise<void>) {
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const send = (event: object) => writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  void (async () => {
    try {
      await run(send, controller.signal);
      await send({ type: "done" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      await send({ type: "error", message }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}

function isDiary(value: unknown): value is DiaryContext {
  const d = value as DiaryContext;
  return (
    !!d &&
    typeof d.guide === "number" &&
    !!d.today &&
    Array.isArray(d.today.meals) &&
    !!d.yesterday &&
    !!d.week
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health")
      return json(200, { ok: true, model: env.OPENROUTER_MODEL });
    if (request.method !== "POST") return json(405, { error: "method" });
    if (!authorized(request, env)) return json(401, { error: "unauthorized" });
    if (!env.OPENROUTER_API_KEY) return json(503, { error: "OPENROUTER_API_KEY is not set" });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "json" });
    }

    if (url.pathname === "/v1/meal") {
      const image = typeof body.image === "string" ? body.image : "";
      const type = mealTypes.includes(body.type as MealType) ? (body.type as MealType) : "Snack";
      const hint = typeof body.hint === "string" ? body.hint : undefined;
      const locale = typeof body.locale === "string" ? body.locale.slice(0, 10) : "en";
      const limit = Number(env.ZEST_MAX_IMAGE_BYTES ?? 6_000_000);
      if (!image.startsWith("data:image/")) return json(400, { error: "image must be a data URL" });
      if (image.length > limit) return json(413, { error: "image too large" });
      const messages: ChatMessage[] = [
        { role: "system", content: mealSystemPrompt() },
        {
          role: "user",
          content: [
            { type: "text", text: mealUserPrompt(type, hint, locale) },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ];
      return sse(async (send, signal) => {
        await streamChat(env, messages, (delta) => send({ type: "text", delta }), signal, {
          maxTokens: 120,
          temperature: 0.2,
        });
      });
    }

    if (url.pathname === "/v1/ask") {
      const question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
      if (!question) return json(400, { error: "question" });
      if (!isDiary(body.diary)) return json(400, { error: "diary" });
      const messages: ChatMessage[] = [
        { role: "system", content: askSystemPrompt(body.diary) },
        { role: "user", content: question },
      ];
      return sse(async (send, signal) => {
        await streamChat(env, messages, (delta) => send({ type: "text", delta }), signal, {
          maxTokens: 260,
          temperature: 0.5,
        });
      });
    }

    return json(404, { error: "route" });
  },
} satisfies ExportedHandler<Env>;
