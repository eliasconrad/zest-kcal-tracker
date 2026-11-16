/**
 * The app's only network boundary. Streams from the Zest Worker (server/) using
 * expo/fetch, which exposes response bodies as ReadableStreams on native.
 *
 * Configure with EXPO_PUBLIC_ZEST_API_URL (and EXPO_PUBLIC_ZEST_APP_TOKEN when the
 * Worker has ZEST_APP_TOKEN set). Without a URL the template's local behaviour stays.
 */
import { Image } from "react-native";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { getLocales } from "expo-localization";
import { createEventParser, parseAnswer, parseEstimate, type Estimate } from "./replies.ts";
import type { DiaryContext } from "./context.ts";
import type { MealType } from "./diary.ts";

const base = (process.env.EXPO_PUBLIC_ZEST_API_URL ?? "").replace(/\/$/, "");
const token = process.env.EXPO_PUBLIC_ZEST_APP_TOKEN;

export const apiConfigured = base.length > 0;

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

/** Matches the Worker's default `ZEST_MAX_IMAGE_BYTES`. The diary keeps the original file. */
export const UPLOAD_MAX_BYTES = 6_000_000;
const UPLOAD_LONG_EDGE = 1280;

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Downscales a local photo so the long edge is 1280 px, JPEG quality 0.8,
 * and returns a data URL under `UPLOAD_MAX_BYTES`. Re-encoding strips EXIF.
 * The file in the diary is left untouched.
 */
export async function photoDataUrl(uri: string) {
  const { width, height } = await imageSize(uri);
  const long = Math.max(width, height);
  const chain = ImageManipulator.manipulate(uri);
  if (long > UPLOAD_LONG_EDGE) {
    chain.resize(width >= height ? { width: UPLOAD_LONG_EDGE } : { height: UPLOAD_LONG_EDGE });
  }
  const image = await chain.renderAsync();
  let quality = 0.8;
  let saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  let base64 = saved.base64 ?? (await new File(saved.uri).base64());
  while (Math.ceil((base64.length * 3) / 4) > UPLOAD_MAX_BYTES && quality > 0.4) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    if (saved.uri !== uri) {
      try {
        new File(saved.uri).delete();
      } catch {
        // temp file
      }
    }
    saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    base64 = saved.base64 ?? (await new File(saved.uri).base64());
  }
  image.release();
  chain.release();
  if (saved.uri !== uri) {
    try {
      new File(saved.uri).delete();
    } catch {
      // temp file; the OS clears it anyway
    }
  }
  if (Math.ceil((base64.length * 3) / 4) > UPLOAD_MAX_BYTES) {
    throw new ApiError("image too large", "server");
  }
  return `data:image/jpeg;base64,${base64}`;
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
