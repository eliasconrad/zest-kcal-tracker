/**
 * A deterministic pass over the model's first line, before the app sees it.
 * The model estimates; this keeps its arithmetic honest and pulls impossible
 * numbers back. Ranges are sanity bounds per serving, not nutrition facts.
 */
import type { MealType } from "./prompts.ts";

const mealBounds: Record<MealType, [number, number]> = {
  Breakfast: [60, 1600],
  Lunch: [100, 2200],
  Dinner: [100, 2600],
  Snack: [15, 1400],
};

/** The disagreement between kcal and 4/4/9 macros beyond which the macros win. */
const MACRO_TOLERANCE = 0.15;

/** Common single foods, in English and German. Only an exact name matches, so "banana bread" stays free. */
const foods: { names: string[]; range: [number, number] }[] = [
  { names: ["banana", "banane"], range: [70, 160] },
  { names: ["apple", "apfel"], range: [50, 130] },
  { names: ["orange"], range: [40, 110] },
  { names: ["scrambled eggs", "rührei"], range: [120, 450] },
  { names: ["boiled egg", "boiled eggs", "gekochtes ei", "gekochte eier"], range: [60, 260] },
  { names: ["oatmeal", "porridge", "haferbrei"], range: [120, 550] },
  { names: ["yogurt", "yoghurt", "joghurt"], range: [50, 350] },
  { names: ["croissant"], range: [170, 450] },
  { names: ["bagel"], range: [200, 550] },
  { names: ["sandwich"], range: [200, 850] },
  { names: ["burger", "hamburger", "cheeseburger"], range: [300, 1300] },
  { names: ["pizza"], range: [250, 1500] },
  { names: ["pasta", "nudeln", "spaghetti"], range: [250, 1200] },
  { names: ["salad", "salat"], range: [30, 800] },
  { names: ["sushi"], range: [150, 1000] },
  { names: ["steak"], range: [220, 1000] },
  { names: ["chicken breast", "hähnchenbrust"], range: [120, 550] },
  { names: ["fries", "french fries", "pommes"], range: [200, 750] },
  { names: ["soup", "suppe"], range: [50, 550] },
  { names: ["smoothie"], range: [90, 550] },
];

function foodRange(name: string) {
  const key = name.trim().toLowerCase();
  return foods.find((food) => food.names.includes(key))?.range;
}

const clamp = (value: number, [min, max]: [number, number]) =>
  Math.min(max, Math.max(min, value));

/**
 * Corrects one `name | kcal | protein | carbs | fat` line. Anything it cannot
 * read, and "Not a meal", passes through untouched. A hint from the person
 * means they know something the photo does not show, so the bounds stand down.
 */
export function calibrateLine(line: string, type: MealType, hint?: string) {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length < 2) return line;
  const [name, kcalText, proteinText, carbsText, fatText] = parts;
  const kcal = Number(kcalText);
  if (!name || /^not a meal/i.test(name) || !Number.isFinite(kcal) || kcal <= 0) return line;
  const read = (text?: string) => {
    const value = Number(text);
    return text !== undefined && text !== "" && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const protein = read(proteinText);
  const carbs = read(carbsText);
  const fat = read(fatText);
  const macrosKnown = protein !== null && carbs !== null && fat !== null;
  let next = kcal;
  if (macrosKnown) {
    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (fromMacros > 0 && Math.abs(fromMacros - kcal) / Math.max(fromMacros, kcal) > MACRO_TOLERANCE)
      next = fromMacros;
  }
  if (!hint) {
    next = clamp(next, foodRange(name) ?? mealBounds[type]);
  }
  next = Math.round(next);
  // Macros follow a correction that came from the bounds, so the line stays consistent.
  const basis = macrosKnown ? protein * 4 + carbs * 4 + fat * 9 : 0;
  const scale = basis > 0 ? next / basis : 1;
  const out = (value: number | null) =>
    value === null ? "?" : String(Math.round(Math.abs(scale - 1) > MACRO_TOLERANCE ? value * scale : value));
  return `${name} | ${next} | ${out(protein)} | ${out(carbs)} | ${out(fat)}`;
}

/**
 * For a chat answer that may correct a meal: a reply starting with `~` keeps its
 * first line back until it is corrected as a person's own hint; any other reply
 * flows through untouched.
 */
export function createCorrectionFilter(type: MealType) {
  let buffer = "";
  let passed = false;
  const corrected = (line: string) => `~ ${calibrateLine(line.replace(/^~\s*/, "").trim(), type, "correction")}`;
  return {
    push(delta: string) {
      if (passed) return delta;
      buffer += delta;
      const trimmed = buffer.replace(/^\s+/, "");
      if (!trimmed) return "";
      if (!trimmed.startsWith("~")) {
        passed = true;
        return buffer;
      }
      const end = trimmed.indexOf("\n");
      if (end < 0) return "";
      passed = true;
      return `${corrected(trimmed.slice(0, end))}${trimmed.slice(end)}`;
    },
    flush() {
      if (passed) return "";
      passed = true;
      const trimmed = buffer.trim();
      return trimmed.startsWith("~") ? corrected(trimmed) : trimmed;
    },
  };
}

/**
 * Streams text through, holding back only the first non-empty line until it can
 * be corrected. The note after it flows untouched.
 */
export function createLineCalibrator(type: MealType, hint?: string) {
  let buffer = "";
  let passed = false;
  return {
    push(delta: string) {
      if (passed) return delta;
      buffer += delta;
      const trimmed = buffer.replace(/^\s+/, "");
      const end = trimmed.indexOf("\n");
      if (end < 0) return "";
      passed = true;
      return `${calibrateLine(trimmed.slice(0, end).trim(), type, hint)}${trimmed.slice(end)}`;
    },
    /** The stream ended; a reply without a line break is all first line. */
    flush() {
      if (passed) return "";
      passed = true;
      const trimmed = buffer.trim();
      return trimmed ? calibrateLine(trimmed, type, hint) : "";
    },
  };
}
