/**
 * The app's only network boundary. Streams from the Zest Worker (server/) using
 * expo/fetch, which exposes response bodies as ReadableStreams on native.
 *
 * Configure with EXPO_PUBLIC_ZEST_API_URL (and EXPO_PUBLIC_ZEST_APP_TOKEN when the
 * Worker has ZEST_APP_TOKEN set). Without a URL the template's local behaviour stays.
 */
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { getLocales } from "expo-localization";
import { createEventParser, fitLongEdge, parseAnswer, parseEstimate, type Estimate } from "./replies.ts";
import type { DiaryContext } from "./context.ts";
import type { MealType } from "./diary.ts";

const base = (process.env.EXPO_PUBLIC_ZEST_API_URL ?? "").replace(/\/$/, "");
const token = process.env.EXPO_PUBLIC_ZEST_APP_TOKEN;

export const apiConfigured = base.length > 0;
/** Mirrors the Worker's ZEST_MAX_IMAGE_BYTES. */
const MAX_IMAGE_CHARS = 6_000_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "server" | "aborted" | "format",
  ) {
    super(message);
  }
}

function locale() {
  return getLocales()[0]?.languageTag ?? "en";
}

/** Streams `text` events into `onText` with the accumulated text; resolves with the full text. */
async function stream(
  path: string,
  body: object,
  onText: (full: string) => void,
  signal: AbortSignal,
  timeoutMs: number,
) {
  if (!apiConfigured) throw new ApiError("Zest API is not configured", "server");
  const timeout = setTimeout(() => {
    if (!signal.aborted) controller.abort();
  }, timeoutMs);
  const controller = new AbortController();
  const forward = () => controller.abort();
  signal.addEventListener("abort", forward, { once: true });
  try {
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${base}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-zest-token": token } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (signal.aborted) throw new ApiError("stopped", "aborted");
      throw new ApiError(error instanceof Error ? error.message : "offline", "offline");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ApiError(`${response.status} ${detail.slice(0, 200)}`, "server");
    }
    if (!response.body) throw new ApiError("no body", "server");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parse = createEventParser();
    let full = "";
    for (;;) {
      let next: ReadableStreamReadResult<Uint8Array>;
      try {
        next = await reader.read();
      } catch (error) {
        if (signal.aborted) throw new ApiError("stopped", "aborted");
        throw new ApiError(error instanceof Error ? error.message : "stream", "offline");
      }
      if (next.done) break;
      for (const event of parse(decoder.decode(next.value, { stream: true }))) {
        if (event.type === "text") {
          full += event.delta;
          onText(full);
        } else if (event.type === "error") throw new ApiError(event.message, "server");
        else if (event.type === "done") return full;
      }
    }
    return full;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", forward);
  }
}

/**
 * A JPEG data URL for the model: long edge at most 1280 px, re-encoded so no
 * EXIF (location, device) leaves the phone, and small enough for the Worker's
 * limit. The diary keeps its own full-size copy.
 */
export async function photoDataUrl(uri: string, maxEdge = 1280) {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const size = fitLongEdge(probe.width, probe.height, maxEdge);
  probe.release();
  const context = ImageManipulator.manipulate(uri);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  try {
    for (const compress of [0.8, 0.6, 0.4]) {
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      const base64 = saved.base64 ?? (await new File(saved.uri).base64());
      try {
        new File(saved.uri).delete();
      } catch {
        // temp file; the OS clears it anyway
      }
      const url = `data:image/jpeg;base64,${base64}`;
      if (url.length <= MAX_IMAGE_CHARS) return url;
    }
  } finally {
    image.release();
    context.release();
  }
  throw new ApiError("photo too large", "format");
}

/** Streams the estimate for one photo; `onEstimate` fires on every update until settled. */
export async function estimateMeal(
  input: { uri: string; type: MealType; hint?: string },
  onEstimate: (estimate: Estimate | null, raw: string) => void,
  signal: AbortSignal,
) {
  const image = await photoDataUrl(input.uri);
  if (signal.aborted) throw new ApiError("stopped", "aborted");
  const full = await stream(
    "/v1/meal",
    { image, type: input.type, hint: input.hint, locale: locale() },
    (text) => onEstimate(parseEstimate(text), text),
    signal,
    45_000,
  );
  const estimate = parseEstimate(full.includes("\n") ? full : `${full}\n`);
  if (!estimate) throw new ApiError(`unexpected reply: ${full.slice(0, 80)}`, "format");
  return estimate;
}

/** Streams a conversational answer grounded in the diary context. */
export async function askZest(
  question: string,
  diary: DiaryContext,
  onAnswer: (answer: ReturnType<typeof parseAnswer>) => void,
  signal: AbortSignal,
) {
  const full = await stream(
    "/v1/ask",
    { question, diary: { ...diary, locale: locale() } },
    (text) => onAnswer(parseAnswer(text)),
    signal,
    40_000,
  );
  return parseAnswer(`${full}\n`);
}
