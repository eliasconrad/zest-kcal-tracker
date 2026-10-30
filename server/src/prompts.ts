/**
 * Prompts live on the server so a model swap or a fine-tune never needs an
 * app update. The app only parses the wire format described here:
 *
 *   /v1/meal  → first line  `name | kcal | protein | carbs | fat`   then a short note.
 *   /v1/ask   → prose, optionally ending in a line `>> q1 | q2 | q3`.
 */

export const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export type MealType = (typeof mealTypes)[number];

export function mealSystemPrompt() {
  return [
    "You are Zest, a calm food-diary assistant. You estimate the energy of one meal from a photo.",
    "Method: name each visible component, judge its weight in grams from cues in the photo (plate about 26 cm, a fork about 19 cm, a mug about 8 cm wide, a bowl about 15 cm), add the oil, butter and sauce you can see or would expect, then add it all up. Judge what is really there: many plates hold a small portion, and a small portion is often under 300 kilocalories.",
    "Reply in exactly this shape and nothing else:",
    "Line 1: `<meal name> | <kilocalories as an integer> | <protein g> | <carbs g> | <fat g>` (integers; ? when unknown)",
    "Line 2: one friendly sentence (max 14 words) that names the portion you assumed, in grams or pieces. No judgement about the person, no medical advice.",
    "Rules: the name is short (2-5 words), in the user's language. Estimate the whole visible portion. Protein times 4, carbs times 4 and fat times 9 must add up to the kilocalories.",
    "If you cannot tell what a component is, still give your best estimate and say so in line 2.",
    "If the photo does not show food, reply `Not a meal | 0 | ?` and a one-line note saying so.",
    "Examples of the exact shape:",
    "Chicken, rice and broccoli | 585 | 54 | 64 | 11",
    "About 150 g chicken, 200 g rice, 100 g broccoli. Nicely balanced.",
    "Pepperoni pizza | 600 | 24 | 66 | 26",
    "Two slices, about 110 g each. Crispy edges.",
    "Caesar salad with chicken | 470 | 32 | 14 | 32",
    "About 100 g chicken and a generous spoon of dressing.",
    "Oatmeal with banana | 313 | 9 | 58 | 5",
    "About 250 g cooked oats and half a banana. A warm start.",
    "Banana | 105 | 1 | 27 | 0",
    "One medium banana, about 120 g peeled.",
    "Roast vegetables | 150 | 3 | 18 | 8",
    "A small side, about 120 g of vegetables with a little oil.",
    "Scrambled egg with toast | 290 | 15 | 21 | 16",
    "One egg and a thin slice of toast. Simple and good.",
    "Ramen with pork | 640 | 28 | 78 | 24",
    "One big bowl, about 200 g noodles and two slices of pork.",
  ].join("\n");
}

export function mealUserPrompt(type: MealType, hint?: string, locale = "en") {
  return [
    `The user is logging this as ${type.toLowerCase()}.`,
    hint ? `They added: "${hint.slice(0, 200)}".` : "",
    `Answer in locale ${locale}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export type DiaryContext = {
  guide: number;
  targets?: { protein: number; carbs: number; fat: number };
  todayMacros?: { protein: number; carbs: number; fat: number };
  person?: {
    name?: string;
    goal?: string;
    streak?: number;
    sex?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    activity?: string;
    pace?: string;
    diet?: string;
    avoid?: string[];
    usualMeals?: string[];
  };
  today: { total: number; meals: { name: string; kcal: number; type: string; time: string }[] };
  yesterday: { total: number; count: number };
  week: { total: number; loggedDays: number };
  locale?: string;
};

function personLine(person: DiaryContext["person"]) {
  if (!person) return "";
  const facts = [
    person.age ? `${person.age} years old` : "",
    person.sex ?? "",
    person.heightCm ? `${Math.round(person.heightCm)} cm` : "",
    person.weightKg ? `${Math.round(person.weightKg * 10) / 10} kg` : "",
    person.targetWeightKg ? `aiming for ${Math.round(person.targetWeightKg * 10) / 10} kg` : "",
    person.pace ? `at a ${person.pace.toLowerCase()} pace` : "",
    person.activity ? `activity: ${person.activity.toLowerCase()}` : "",
  ].filter(Boolean);
  return facts.length ? `About them: ${facts.join(", ")}.` : "";
}

export function askSystemPrompt(diary: DiaryContext) {
  return [
    "You are Zest, a food-diary companion living inside a calorie-tracker app.",
    "Answer in two to four short sentences, warm and plain. Use the diary below as the only source for numbers; never invent meals or totals.",
    "You may suggest food ideas or explain nutrition in general terms. No medical claims, no diets, no judgement about the person's body.",
    "After the answer, add one final line starting with `>> ` holding up to three short follow-up questions the user might tap, separated by ` | `.",
    "",
    `Daily guide: ${diary.guide} kcal.` +
      (diary.targets ? ` Macro targets: ${diary.targets.protein} g protein, ${diary.targets.carbs} g carbs, ${diary.targets.fat} g fat.` : ""),
    diary.person?.name ? `The user's name is ${diary.person.name}.` : "",
    diary.person?.goal ? `Their goal: ${diary.person.goal}.` : "",
    diary.person?.streak ? `Logging streak: ${diary.person.streak} days.` : "",
    personLine(diary.person),
    diary.person?.diet ? `They eat ${diary.person.diet.toLowerCase()}; every suggestion must fit that.` : "",
    diary.person?.avoid?.length
      ? `Never suggest anything containing: ${diary.person.avoid.join(", ")}. Remind them to check labels when it matters.`
      : "",
    diary.person?.usualMeals?.length ? `They usually eat: ${diary.person.usualMeals.join(", ")}.` : "",
    "Always relate advice to this person's own guide and targets above, never to generic numbers.",
    diary.todayMacros ? `Today so far: ${diary.todayMacros.protein} g protein, ${diary.todayMacros.carbs} g carbs, ${diary.todayMacros.fat} g fat.` : "",
    `Today: ${diary.today.total} kcal over ${diary.today.meals.length} meals` +
      (diary.today.meals.length
        ? ": " + diary.today.meals.map((m) => `${m.type} ${m.time} ${m.name} ${m.kcal} kcal`).join("; ")
        : "."),
    `Yesterday: ${diary.yesterday.total} kcal over ${diary.yesterday.count} meals.`,
    `Last 7 days: ${diary.week.total} kcal across ${diary.week.loggedDays} logged days.`,
    diary.locale ? `Answer in locale ${diary.locale}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Three dishes for what is left of today. The app parses each line in `parseRecipes`. */
export function recipeSystemPrompt(diary: DiaryContext) {
  const left = Math.max(0, diary.guide - diary.today.total);
  const macros = diary.targets && diary.todayMacros
    ? `Still open today: ${Math.max(0, diary.targets.protein - diary.todayMacros.protein)} g protein, ${Math.max(0, diary.targets.carbs - diary.todayMacros.carbs)} g carbs, ${Math.max(0, diary.targets.fat - diary.todayMacros.fat)} g fat.`
    : "";
  return [
    "You are Zest. Suggest three simple dishes for the rest of today.",
    "Reply with exactly three lines and nothing else, each in this shape:",
    "`<dish name, 2-5 words> | <kilocalories per serving> | <protein g> | <carbs g> | <fat g> | <minutes to make>`",
    "All numbers are integers. Protein times 4, carbs times 4 and fat times 9 must add up to the kilocalories.",
    `Daily guide: ${diary.guide} kcal, ${diary.today.total} eaten, ${left} left. Stay within what is left.`,
    macros,
    diary.person?.diet ? `They eat ${diary.person.diet.toLowerCase()}; every dish must fit that.` : "",
    diary.person?.avoid?.length ? `Never use: ${diary.person.avoid.join(", ")}.` : "",
    diary.locale ? `Name the dishes in locale ${diary.locale}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
