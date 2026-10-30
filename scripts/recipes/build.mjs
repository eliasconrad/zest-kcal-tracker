/**
 * Builds src/cookbooks/zest/data/recipes.json from recipes.mjs and USDA FoodData
 * Central SR Legacy (public domain, CC0). Download and unzip the JSON from
 * https://fdc.nal.usda.gov/download-datasets, then:
 *   node scripts/recipes/build.mjs /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { allergensOf, recipes } from "./recipes.mjs";

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const foods = new Map(
  raw[Object.keys(raw)[0]].map((food) => {
    const n = (number) => food.foodNutrients.find((x) => x.nutrient.number === number)?.amount ?? 0;
    return [food.description, { kcal: n("208"), protein: n("203"), carbs: n("205"), fat: n("204"), fdcId: food.fdcId }];
  }),
);
const out = recipes.map((recipe, index) => {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const [name, grams] of recipe.ingredients) {
    const food = foods.get(name);
    if (!food) throw new Error(`not in SR Legacy: ${name}`);
    for (const key of Object.keys(total)) total[key] += (food[key] * grams) / 100;
  }
  return {
    id: `r${index + 1}`,
    name: recipe.name,
    type: recipe.type,
    minutes: recipe.minutes,
    tags: recipe.tags,
    allergens: [...new Set(recipe.ingredients.flatMap(([name]) => allergensOf(name)))],
    grams: recipe.ingredients.reduce((sum, [, grams]) => sum + grams, 0),
    kcal: Math.round(total.kcal),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
    fdc: recipe.ingredients.map(([name, grams]) => [foods.get(name).fdcId, grams]),
  };
});
writeFileSync(new URL("../../src/cookbooks/zest/data/recipes.json", import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(out.length, "recipes", out.map((r) => `${r.name}: ${r.kcal}`).slice(0, 6).join("; "));
