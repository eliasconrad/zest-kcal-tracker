/**
 * Pure parsing of what the Zest API streams. No React, no network: tests run in Node.
 *
 * Wire format (one `data:` line per event):
 *   {"type":"text","delta":"…"}   model text, in order
 *   {"type":"done"}               end of a successful reply
 *   {"type":"error","message"}    the Worker hit a problem after headers were sent
 *
 * Model text formats (see server/src/prompts.ts):
 *   meal:  `name | kcal | protein | carbs | fat`\n`note`  (macros may be ?)
 *   ask:   prose … `\n>> follow-up | follow-up | follow-up`
 */

export type ApiEvent =
  | { type: "text"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Incremental SSE reader for the Worker's event stream; feed it decoded chunks. */
export function createEventParser() {
  let buffer = "";
  return function push(chunk: string): ApiEvent[] {
    buffer += chunk;
    const events: ApiEvent[] = [];
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as ApiEvent;
        if (event && typeof event.type === "string") events.push(event);
      } catch {
        // partial or non-JSON line; ignore
      }
    }
    return events;
  };
}

export type Estimate = {
  name: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  note: string;
  /** True once the first line has fully arrived (a newline was seen). */
  settled: boolean;
  /** True when the model says the photo is not food. */
  notFood: boolean;
};

/** Reads `name | kcal | protein` from streamed text as soon as its newline arrives. */
export function parseEstimate(raw: string): Estimate | null {
  // Models often open with a blank line; the first line is the first non-empty one.
  const text = raw.replace(/^\s+/, "");
  const newline = text.indexOf("\n");
  const settled = newline >= 0;
  const head = (settled ? text.slice(0, newline) : text).trim();
  const parts = head.split("|").map((part) => part.trim());
  if (parts.length < 2) return null;
  const [name, kcalText, proteinText = "?", carbsText = "?", fatText = "?"] = parts;
  const kcal = Number.parseInt(kcalText.replace(/[^\d]/g, ""), 10);
  if (!name || Number.isNaN(kcal)) return null;
  const grams = (value: string) => {
    const n = Number.parseInt((value ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isNaN(n) ? undefined : n;
  };
  const note = settled ? text.slice(newline + 1).trim() : "";
  return {
    name: name.replace(/^[`"'\s]+|[`"'\s]+$/g, ""),
    kcal,
    protein: grams(proteinText),
    carbs: grams(carbsText),
    fat: grams(fatText),
    note,
    settled,
    notFood: /^not (a )?(meal|food)/i.test(name) || kcal === 0,
  };
}

export type Answer = { text: string; followups: string[]; pendingMarker: boolean };

/** Splits streamed prose from the trailing `>> a | b | c` follow-up line, even mid-stream. */
export function parseAnswer(text: string): Answer {
  const marker = text.lastIndexOf("\n>>");
  const startsWithMarker = text.startsWith(">>");
  const at = startsWithMarker ? 0 : marker;
  if (at < 0) {
    // A partial marker may be arriving ("\n>" or "\n>>"); hide it until it resolves.
    const tail = text.match(/\n>?$/);
    return {
      text: tail ? text.slice(0, tail.index).trimEnd() : text,
      followups: [],
      pendingMarker: !!tail,
    };
  }
  const prose = text.slice(0, at).trimEnd();
  const line = text.slice(at).replace(/^\n?>>\s*/, "");
  const complete = line.includes("\n");
  const followups = line
    .split("\n")[0]
    .split("|")
    .map((item) => item.trim().replace(/[.?!]+$/, (m) => (m === "?" ? "?" : m)))
    .filter(Boolean)
    .slice(0, 3);
  return { text: prose, followups, pendingMarker: !complete };
}

/** Diary questions the local engine answers exactly; everything else goes to the model. */
export function isDiaryQuestion(question: string) {
  const q = question.toLowerCase();
  return /\b(week|yesterday|today|protein|left|remaining|guide|goal|over|too much|breakfast|lunch|dinner|snack|total|so far|how much|how many|calories|kcal|streak)\b/.test(
    q,
  );
}

/** The size that brings the long edge down to `max`, or null when it already fits. */
export function fitLongEdge(width: number, height: number, max: number) {
  const long = Math.max(width, height);
  if (long <= max) return null;
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
