/**
 * Deterministic cleanup of a /v1/meal reply. The model still writes the
 * wire format; this only pulls obvious outliers back and makes macros and
 * kilocalories agree. Portion anchors are typical single servings from
 * USDA FoodData Central, used as a sanity check, not as a nutrient database.
 */
import type { MealType } from "./prompts.ts";

const bounds: Record<MealType, { min: number; max: number }> = {
  Breakfast: { min: 80, max: 1400 },
  Lunch: { min: 150, max: 1800 },
  Dinner: { min: 200, max: 2000 },
  Snack: { min: 40, max: 900 },
};

/** kcal / protein / carbs / fat for one usual portion. */
const foods: Record<string, [number, number, number, number]> = {
  banana: [105, 1, 27, 0],
  apple: [95, 0, 25, 0],
  rice: [206, 4, 45, 0],
  chicken: [250, 40, 0, 8],
  egg: [155, 13, 1, 11],
  bread: [160, 6, 28, 2],
  pasta: [330, 12, 60, 4],
  salmon: [280, 28, 0, 18],
  yogurt: [150, 12, 12, 4],
  cheese: [220, 14, 2, 18],
  potato: [160, 4, 37, 0],
  broccoli: [55, 4, 11, 1],
  oats: [300, 10, 54, 6],
  milk: [150, 8, 12, 8],
  avocado: [240, 3, 12, 22],
  pizza: [570, 24, 70, 22],
  burger: [540, 28, 40, 28],
  salad: [180, 6, 14, 12],
  soup: [180, 8, 20, 6],
  coffee: [15, 1, 2, 0],
};

export type Calibrated = {
  text: string;
  adjusted: boolean;
};

function integers(line: string) {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length < 5) return null;
  const [name, kcal, protein, carbs, fat] = parts;
  const number = (value: string) => (/^\d+$/.test(value) ? Number(value) : null);
  return {
    name,
    kcal: number(kcal),
    protein: number(protein),
    carbs: number(carbs),
    fat: number(fat),
    unknown: kcal === "?" || name.toLowerCase() === "unknown",
  };
}

function lookup(name: string) {
  const lower = name.toLowerCase();
  const key = Object.keys(foods).find((food) => lower.includes(food));
  return key ? foods[key] : null;
}

/** Returns the reply unchanged when it is not a meal line. */
export function calibrateMeal(raw: string, type: MealType): Calibrated {
  const trimmed = raw.trim();
  const [first, ...rest] = trimmed.split("\n");
  const parsed = first ? integers(first) : null;
  if (!parsed || parsed.unknown || parsed.kcal == null) return { text: trimmed, adjusted: false };
  let { kcal, protein, carbs, fat } = parsed;
  const original = kcal;
  const notes: string[] = [];
  const bound = bounds[type];
  if (type === "Dinner" && original < 40) {
    notes.push("The estimate was far too low for a dinner, so it was raised.");
  }
  if (type === "Snack" && original > 4000) {
    notes.push("That snack estimate was extreme, so it was pulled back.");
  }
  const anchor = lookup(parsed.name);
  if (anchor && (kcal < anchor[0] * 0.4 || kcal > anchor[0] * 2.5)) {
    kcal = anchor[0];
    protein = anchor[1];
    carbs = anchor[2];
    fat = anchor[3];
    notes.push("Pulled toward a usual portion for this food.");
  }
  if (protein != null && carbs != null && fat != null) {
    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (fromMacros > 0 && Math.abs(fromMacros - kcal) / fromMacros > 0.15) {
      kcal = fromMacros;
      notes.push("Kilocalories were set from the macros (4/4/9).");
    }
  }
  if (kcal < bound.min) {
    kcal = bound.min;
    if (!notes.some((note) => note.includes("far too low"))) {
      notes.push(`Raised to the low end for a ${type.toLowerCase()}.`);
    }
  } else if (kcal > bound.max) {
    kcal = bound.max;
    if (!notes.some((note) => note.includes("extreme"))) {
      notes.push(`Capped at the high end for a ${type.toLowerCase()}.`);
    }
  }
  const line = `${parsed.name} | ${kcal} | ${protein ?? "?"} | ${carbs ?? "?"} | ${fat ?? "?"}`;
  const note = [rest.join("\n").trim(), notes.join(" ")].filter(Boolean).join(" ");
  const text = note ? `${line}\n${note}` : line;
  return { text, adjusted: text !== trimmed };
}
