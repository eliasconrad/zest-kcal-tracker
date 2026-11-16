/**
 * Fetches a fixed sample of Nutrition5k dishes (CC BY 4.0, weighed ground truth,
 * overhead cafeteria photos) into scripts/eval/data/, which is git-ignored.
 *   node scripts/eval/prepare.mjs [count]
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, "data");
const root = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset";
const count = Number(process.argv[2] ?? 30);
mkdirSync(data, { recursive: true });

const csv = await (await fetch(`${root}/metadata/dish_metadata_cafe1.csv`)).text();
// id, kcal, mass, fat, carb, protein, then ingredients. A plain seeded shuffle keeps the sample stable.
const dishes = csv.trim().split("\n").map((line) => {
  const c = line.split(",");
  return { id: c[0], kcal: +c[1], grams: +c[2], fat: +c[3], carbs: +c[4], protein: +c[5] };
}).filter((d) => d.kcal >= 100 && d.kcal <= 1500);
let seed = 42;
const next = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
for (let i = dishes.length - 1; i > 0; i--) {
  const j = Math.floor(next() * (i + 1));
  [dishes[i], dishes[j]] = [dishes[j], dishes[i]];
}
const picked = [];
for (const dish of dishes) {
  if (picked.length >= count) break;
  const file = join(data, `${dish.id}.png`);
  if (!existsSync(file)) {
    const response = await fetch(`${root}/imagery/realsense_overhead/${dish.id}/rgb.png`);
    if (!response.ok) continue; // not every dish has the overhead camera
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  picked.push(dish);
}
writeFileSync(join(here, "dataset.json"), `${JSON.stringify(picked, null, 2)}\n`);
console.log(`${picked.length} dishes, median ${[...picked].map((d) => d.kcal).sort((a, b) => a - b)[picked.length >> 1]} kcal`);
