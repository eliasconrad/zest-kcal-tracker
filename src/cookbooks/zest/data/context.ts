import { dayKey, macrosOn, mealsOn, relativeDay, totalOn, type Meal } from "./diary.ts";

/** The compact, number-only view of the diary the model is allowed to see. */
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
  today: {
    total: number;
    meals: { name: string; kcal: number; type: string; time: string }[];
  };
  yesterday: { total: number; count: number };
  week: { total: number; loggedDays: number };
  locale?: string;
};

export function diaryContext(
  meals: Meal[],
  guide: number,
  locale?: string,
  now = new Date(),
  extra: Pick<DiaryContext, "targets" | "person"> = {},
): DiaryContext {
  const today = dayKey(now);
  const macros = macrosOn(meals, today);
  const yesterday = relativeDay(-1, now);
  const days = Array.from({ length: 7 }, (_, i) => relativeDay(-i, now));
  const inWeek = meals.filter((meal) => days.includes(meal.date));
  return {
    guide,
    ...extra,
    todayMacros: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
    today: {
      total: totalOn(meals, today),
      meals: mealsOn(meals, today).map((meal) => ({
        name: meal.name,
        kcal: meal.kcal,
        type: meal.type,
        time: meal.time,
      })),
    },
    yesterday: {
      total: totalOn(meals, yesterday),
      count: mealsOn(meals, yesterday).length,
    },
    week: {
      total: inWeek.reduce((sum, meal) => sum + meal.kcal, 0),
      loggedDays: days.filter((day) => mealsOn(meals, day).length).length,
    },
    locale,
  };
}
