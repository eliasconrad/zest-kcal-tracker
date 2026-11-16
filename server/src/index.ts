/**
 * Zest API: a thin streaming proxy in front of OpenRouter.
 *
 *   POST /v1/meal  { image: data-URL, type, hint?, helper?, locale? }  → SSE of {type:"text",delta} … {type:"done"}
 *   POST /v1/ask   { question, diary, helper? }                        → same wire format
 *   `helper` is one of the six ids in prompts.ts; it only changes the voice of the reply.
 *   /v1/auth/*, /v1/me, /v1/sync/*, /v1/friends, /v1/purchase, /v1/config → see account.ts
 *   GET  /health
 *
 * The app parses the model's text itself (see src/cookbooks/zest/data/replies.ts),
 * so this Worker stays model-agnostic: change OPENROUTER_MODEL and redeploy.
 */
import {
  askSystemPrompt,
  recipeSystemPrompt,
  mealSystemPrompt,
  mealTypes,
  mealUserPrompt,
  type DiaryContext,
  type MealType,
} from "./prompts.ts";
import { createLineCalibrator } from "./calibrate.ts";
import { authenticate, handleAccount, spend, type AccountEnv } from "./account.ts";
import { streamChat, type ChatMessage } from "./openrouter.ts";

export interface Env extends AccountEnv {
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
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health")
      return json(200, { ok: true, model: env.OPENROUTER_MODEL });
    if (url.pathname === "/v1/appstore/notifications") {
      // Apple is the caller; it proves itself with the signature, not our app token.
      return (await handleAccount(request, url, env)) ?? json(404, { error: "route" });
    }
    if (!authorized(request, env)) return json(401, { error: "unauthorized" });
    const account = await handleAccount(request, url, env, {}, (promise) => ctx.waitUntil(promise));
    if (account) return account;
    if (request.method !== "POST") return json(405, { error: "method" });
    const session = await authenticate(request, env.DB, Date.now());
    if (!session) return json(401, { error: "session" });
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
      const scan = await spend(env, session.user, "scans", Date.now());
      if (!scan.allowed) return json(429, { error: "limit", kind: "scans", limit: scan.limit });
      const messages: ChatMessage[] = [
        { role: "system", content: mealSystemPrompt(body.helper) },
        {
          role: "user",
          content: [
            { type: "text", text: mealUserPrompt(type, hint, locale) },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ];
      return sse(async (send, signal) => {
        const calibrator = createLineCalibrator(type, hint);
        await streamChat(
          env,
          messages,
          async (delta) => {
            const text = calibrator.push(delta);
            if (text) await send({ type: "text", delta: text });
          },
          signal,
          { maxTokens: 160, temperature: 0.2 },
        );
        const rest = calibrator.flush();
        if (rest) await send({ type: "text", delta: rest });
      });
    }

    if (url.pathname === "/v1/ask") {
      const question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
      if (!question) return json(400, { error: "question" });
      if (!isDiary(body.diary)) return json(400, { error: "diary" });
      const ask = await spend(env, session.user, "asks", Date.now());
      if (!ask.allowed) return json(429, { error: "limit", kind: "asks", limit: ask.limit });
      const messages: ChatMessage[] = [
        { role: "system", content: askSystemPrompt(body.diary, body.helper) },
        { role: "user", content: question },
      ];
      return sse(async (send, signal) => {
        await streamChat(env, messages, (delta) => send({ type: "text", delta }), signal, {
          maxTokens: 260,
          temperature: 0.5,
        });
      });
    }

    if (url.pathname === "/v1/recipe") {
      if (!isDiary(body.diary)) return json(400, { error: "diary" });
      const ask = await spend(env, session.user, "asks", Date.now());
      if (!ask.allowed) return json(429, { error: "limit", kind: "asks", limit: ask.limit });
      const messages: ChatMessage[] = [
        { role: "system", content: recipeSystemPrompt(body.diary) },
        { role: "user", content: "What could I make?" },
      ];
      return sse(async (send, signal) => {
        await streamChat(env, messages, (delta) => send({ type: "text", delta }), signal, {
          maxTokens: 200,
          temperature: 0.6,
        });
      });
    }

    return json(404, { error: "route" });
  },
} satisfies ExportedHandler<Env>;
