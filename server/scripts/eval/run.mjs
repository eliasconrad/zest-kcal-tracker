/**
 * Sends the labelled photos to a model the way /v1/meal does and reports the
 * error against the weighed truth, raw and after calibration.
 *   node --experimental-strip-types scripts/eval/run.mjs --model qwen/qwen2.5-vl-72b-instruct --prompt tuned
 * Reads OPENROUTER_API_KEY from the environment or from server/.dev.vars.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { calibrateLine } from "../../src/calibrate.ts";
import { mealSystemPrompt, mealUserPrompt } from "../../src/prompts.ts";
import { parseEstimate } from "../../../src/cookbooks/zest/data/replies.ts";
import { baselinePrompt } from "./baseline-prompt.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    model: { type: "string", default: "qwen/qwen2.5-vl-72b-instruct" },
    prompt: { type: "string", default: "tuned" },
    limit: { type: "string", default: "30" },
    offset: { type: "string", default: "0" },
    tag: { type: "string", default: "" },
    concurrency: { type: "string", default: "4" },
  },
});
const key =
  process.env.OPENROUTER_API_KEY ??
  (existsSync(join(here, "../../.dev.vars"))
    ? /^OPENROUTER_API_KEY=(.+)$/m.exec(readFileSync(join(here, "../../.dev.vars"), "utf8"))?.[1]?.trim()
    : undefined);
if (!key) {
  console.error("OPENROUTER_API_KEY is missing");
  process.exit(1);
}
const system = values.prompt === "baseline" ? baselinePrompt : mealSystemPrompt();
const dataset = JSON.parse(readFileSync(join(here, "dataset.json"), "utf8")).slice(+values.offset, +values.offset + +values.limit);

async function ask(dish) {
  const image = readFileSync(join(here, "data", `${dish.id}.png`)).toString("base64");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: values.model,
        max_tokens: 160,
        temperature: 0.2,
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
      return {
        text: body.choices?.[0]?.message?.content ?? "",
        cost: body.usage?.cost ?? 0,
        tokens: [body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0],
      };
    }
    // 402 means the account is out of credits; waiting does not help.
    if (attempt >= 5 || response.status === 402) return { text: "", cost: 0, tokens: [0, 0], error: response.status };
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
}

const rows = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: +values.concurrency }, async () => {
    while (cursor < dataset.length) {
      const dish = dataset[cursor++];
      const reply = await ask(dish);
      const line = reply.text.trim().split("\n")[0] ?? "";
      const raw = parseEstimate(`${reply.text.trim()}\n`);
      const calibrated = raw ? parseEstimate(`${calibrateLine(line, "Lunch")}\n`) : null;
      rows.push({ dish, reply, raw, calibrated });
    }
  }),
);

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN);
const usable = rows.filter((r) => r.raw && !r.raw.notFood && r.raw.kcal > 0);
const errors = (pick) => usable.map((r) => pick(r).kcal - r.dish.kcal);
const summary = {
  model: values.model,
  prompt: values.prompt,
  dishes: rows.length,
  parsed: usable.length,
  kcalMaeRaw: Math.round(mean(errors((r) => r.raw).map(Math.abs))),
  kcalMaeCalibrated: Math.round(mean(errors((r) => r.calibrated ?? r.raw).map(Math.abs))),
  kcalBiasRaw: Math.round(mean(errors((r) => r.raw))),
  kcalMapePercent: Math.round(mean(usable.map((r) => Math.abs(r.raw.kcal - r.dish.kcal) / r.dish.kcal)) * 100),
  proteinMae: Math.round(mean(usable.filter((r) => r.raw.protein !== undefined).map((r) => Math.abs(r.raw.protein - r.dish.protein)))),
  carbsMae: Math.round(mean(usable.filter((r) => r.raw.carbs !== undefined).map((r) => Math.abs(r.raw.carbs - r.dish.carbs)))),
  fatMae: Math.round(mean(usable.filter((r) => r.raw.fat !== undefined).map((r) => Math.abs(r.raw.fat - r.dish.fat)))),
  costPer1000Scans: Number((mean(rows.map((r) => r.reply.cost)) * 1000).toFixed(3)),
  meanTokens: [Math.round(mean(rows.map((r) => r.reply.tokens[0]))), Math.round(mean(rows.map((r) => r.reply.tokens[1])))],
};
mkdirSync(join(here, "results"), { recursive: true });
writeFileSync(
  join(here, "results", `${values.model.replace(/\W+/g, "-")}-${values.prompt}${values.tag ? `-${values.tag}` : ""}.json`),
  `${JSON.stringify({ summary, rows: rows.map((r) => ({ id: r.dish.id, truth: r.dish.kcal, text: r.reply.text, error: r.reply.error })) }, null, 2)}\n`,
);
console.log(JSON.stringify(summary));
