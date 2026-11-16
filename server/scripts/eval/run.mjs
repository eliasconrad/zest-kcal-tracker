/**
 * Sends labelled photos to /v1/meal and prints mean absolute error.
 *
 *   ZEST_API_URL=http://127.0.0.1:8787 node scripts/eval/run.mjs
 *   ZEST_API_URL=https://… ZEST_APP_TOKEN=… node scripts/eval/run.mjs
 *
 * Without a URL the files are checked and the run stops. No numbers are invented.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const labels = JSON.parse(readFileSync(new URL("./labels.json", import.meta.url), "utf8"));
const missing = labels.items.filter((item) => !existsSync(resolve(root, item.file)));
if (missing.length) {
  console.error(`missing photos: ${missing.map((item) => item.file).join(", ")}`);
  process.exit(1);
}

const base = (process.env.ZEST_API_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.log(
    JSON.stringify(
      {
        ran: false,
        reason: "ZEST_API_URL is not set, so no model was called and no error was computed.",
        items: labels.items.length,
        models: ["qwen/qwen2.5-vl-72b-instruct"],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

function parseLine(text) {
  const line = text.split("\n")[0] ?? "";
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length < 5) return null;
  const num = (value) => (/^\d+$/.test(value) ? Number(value) : null);
  return { kcal: num(parts[1]), protein: num(parts[2]), carbs: num(parts[3]), fat: num(parts[4]) };
}

const token = process.env.ZEST_APP_TOKEN;
const errors = { kcal: [], protein: [], carbs: [], fat: [] };
let parsed = 0;
for (const item of labels.items) {
  const bytes = readFileSync(resolve(root, item.file));
  const image = `data:image/png;base64,${bytes.toString("base64")}`;
  const response = await fetch(`${base}/v1/meal`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-zest-token": token } : {}),
    },
    body: JSON.stringify({ image, type: item.type, locale: "en" }),
  });
  const body = await response.text();
  let text = "";
  for (const chunk of body.split("\n")) {
    if (!chunk.startsWith("data: ")) continue;
    const event = JSON.parse(chunk.slice(6));
    if (event.type === "text") text += event.delta;
    if (event.type === "error") throw new Error(event.message);
  }
  const estimate = parseLine(text);
  if (estimate?.kcal != null) parsed += 1;
  for (const key of Object.keys(errors)) {
    if (estimate?.[key] == null) continue;
    errors[key].push(Math.abs(estimate[key] - item[key]));
  }
  console.log(`${item.id}: ${text.split("\n")[0]}`);
}
const mean = (values) => (values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null);
console.log(
  JSON.stringify(
    {
      ran: true,
      items: labels.items.length,
      parsedOnFirstTry: parsed / labels.items.length,
      meanAbsoluteError: {
        kcal: mean(errors.kcal),
        protein: mean(errors.protein),
        carbs: mean(errors.carbs),
        fat: mean(errors.fat),
      },
    },
    null,
    2,
  ),
);
