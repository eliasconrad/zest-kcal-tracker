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
    "Reply in exactly this shape and nothing else:",
    "Line 1: `<meal name> | <kilocalories as an integer> | <protein g> | <carbs g> | <fat g>` (integers; ? when unknown)",
    "Line 2: one friendly sentence (max 12 words) about the meal. No judgement about the person, no medical advice.",
    "Rules: the name is short (2-5 words), in the user's language. Estimate the whole visible portion.",
    "If the photo does not show food, reply `Not a meal | 0 | ?` and a one-line note saying so.",
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
  person?: { name?: string; goal?: string; streak?: number };
  today: { total: number; meals: { name: string; kcal: number; type: string; time: string }[] };
  yesterday: { total: number; count: number };
  week: { total: number; loggedDays: number };
  locale?: string;
};

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
