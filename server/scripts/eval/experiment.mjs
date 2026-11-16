/**
 * Tries a way of asking against the plain prompt on the same dishes.
 *   node --experimental-strip-types scripts/eval/experiment.mjs --mode steps --offset 0 --limit 30
 * Modes: plain (one call), median (three calls, median of each number), steps
 * (the model lists components with grams and kcal first, then the final line).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { mealSystemPrompt, mealUserPrompt } from "../../src/prompts.ts";

const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    model: { type: "string", default: "google/gemma-4-26b-a4b-it" },
    mode: { type: "string", default: "plain" },
    limit: { type: "string", default: "30" },
    offset: { type: "string", default: "0" },
    concurrency: { type: "string", default: "4" },
  },
});
const key =
  process.env.OPENROUTER_API_KEY ??
  (existsSync(join(here, "../../.dev.vars"))
    ? /^OPENROUTER_API_KEY=(.+)$/m.exec(readFileSync(join(here, "../../.dev.vars"), "utf8"))?.[1]?.trim()
    : undefined);
const dishes = JSON.parse(readFileSync(join(here, "dataset.json"), "utf8")).slice(
  +values.offset,
  +values.offset + +values.limit,
);
const STEPS = `\n\nBefore the two lines, write one line starting with "Parts:" listing each component as name, grams, kcal, for example "Parts: rice 180 g 234 kcal; chicken 120 g 198 kcal; oil 8 g 72 kcal". Line 1 must use the sum of these parts.`;
const system = mealSystemPrompt() + (values.mode === "steps" ? STEPS : "");
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
let cost = 0;

async function call(dish) {
  const image = readFileSync(join(here, "data", `${dish.id}.png`)).toString("base64");
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: values.model,
        max_tokens: values.mode === "steps" ? 360 : 160,
        temperature: values.mode === "median" ? 0.5 : 0.2,
        usage: { include: true },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: mealUserPrompt("Lunch", undefined, "en") },
              { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } },
            ],
          },
        ],
      }),
    });
    if (response.ok) {
      const body = await response.json();
      cost += body.usage?.cost ?? 0;
      const line = (body.choices?.[0]?.message?.content ?? "")
        .split("\n")
        .find((l) => /\|\s*\d+\s*\|/.test(l) && !l.startsWith("Parts"));
      if (!line) return null;
      const parts = line.split("|").map((p) => Number(p.trim()));
      return { kcal: parts[1], protein: parts[2], carbs: parts[3], fat: parts[4] };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  return null;
}

async function estimate(dish) {
  const calls = values.mode === "median" ? 3 : 1;
  const got = (await Promise.all(Array.from({ length: calls }, () => call(dish)))).filter(Boolean);
  if (!got.length) return null;
  return Object.fromEntries(["kcal", "protein", "carbs", "fat"].map((k) => [k, median(got.map((g) => g[k]))]));
}

const rows = [];
let next = 0;
await Promise.all(
  Array.from({ length: +values.concurrency }, async () => {
    while (next < dishes.length) {
      const dish = dishes[next++];
      const guess = await estimate(dish);
      if (guess) rows.push({ guess, dish });
    }
  }),
);
const truth = (dish, field) => dish[field] ?? dish.truth?.[field] ?? dish[`${field}_g`] ?? dish.total?.[field];
const mae = (field) =>
  Math.round(rows.reduce((sum, { guess, dish }) => sum + Math.abs(guess[field] - truth(dish, field)), 0) / rows.length);
console.log(
  JSON.stringify({
    mode: values.mode,
    scored: `${rows.length}/${dishes.length}`,
    kcal: mae("kcal"),
    bias: Math.round(rows.reduce((sum, { guess, dish }) => sum + guess.kcal - truth(dish, "kcal"), 0) / rows.length),
    protein: mae("protein"),
    carbs: mae("carbs"),
    fat: mae("fat"),
    costPer1000: +((cost / rows.length) * 1000).toFixed(3),
  }),
);
