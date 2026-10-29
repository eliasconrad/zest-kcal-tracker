/**
 * Pure nutrition math for the profile: Mifflin-St Jeor resting energy, an
 * activity multiplier, a pace-based daily adjustment and a macro split.
 * Everything here is an estimate shown as a guide, never a prescription.
 */

export const sexes = ["female", "male", "unspecified"] as const;
export type Sex = (typeof sexes)[number];
export const goals = ["lose", "maintain", "gain", "muscle"] as const;
export type Goal = (typeof goals)[number];
export const activities = ["sedentary", "light", "active", "athletic"] as const;
export type Activity = (typeof activities)[number];
export const paces = ["slow", "steady", "fast"] as const;
export type Pace = (typeof paces)[number];
export type Units = "metric" | "imperial";

export const goalLabel: Record<Goal, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
  muscle: "Build muscle",
};
export const activityLabel: Record<Activity, { title: string; detail: string }> = {
  sedentary: { title: "Mostly sitting", detail: "Desk days, little planned movement" },
  light: { title: "Lightly active", detail: "Walks, a workout or two a week" },
  active: { title: "Active", detail: "Training three to five days a week" },
  athletic: { title: "Very active", detail: "Daily training or a physical job" },
};
/** Kilograms per week the pace aims for; the sign follows the goal. */
export const paceKgPerWeek: Record<Pace, number> = { slow: 0.25, steady: 0.5, fast: 0.75 };
export const paceLabel: Record<Pace, string> = {
  slow: "Gentle",
  steady: "Steady",
  fast: "Brisk",
};

const activityFactor: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
  athletic: 1.725,
};

export type Body = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
};

export function age(birthYear: number, now = new Date()) {
  return Math.max(0, now.getFullYear() - birthYear);
}

/** Mifflin-St Jeor. The unspecified sex uses the midpoint of the two constants. */
export function restingEnergy(body: Body, now = new Date()) {
  const base = 10 * body.weightKg + 6.25 * body.heightCm - 5 * age(body.birthYear, now);
  const offset = body.sex === "male" ? 5 : body.sex === "female" ? -161 : -78;
  return Math.round(base + offset);
}

export function maintenanceEnergy(body: Body, activity: Activity, now = new Date()) {
  return Math.round(restingEnergy(body, now) * activityFactor[activity]);
}

/** 7,700 kcal per kilogram of body fat is the usual planning figure. */
export function dailyAdjustment(goal: Goal, pace: Pace) {
  const perDay = Math.round((paceKgPerWeek[pace] * 7700) / 7);
  if (goal === "lose") return -perDay;
  if (goal === "gain") return perDay;
  if (goal === "muscle") return 200;
  return 0;
}

export type Plan = {
  resting: number;
  maintenance: number;
  guide: number;
  protein: number;
  carbs: number;
  fat: number;
  /** The guide was raised to a safe floor; shown so the number is honest. */
  floored: boolean;
};

/** A daily guide with a floor the app will not go below, plus a macro split. */
export function plan(
  body: Body,
  goal: Goal,
  activity: Activity,
  pace: Pace,
  now = new Date(),
): Plan {
  const resting = restingEnergy(body, now);
  const maintenance = maintenanceEnergy(body, activity, now);
  const floor = body.sex === "male" ? 1500 : 1200;
  const raw = maintenance + dailyAdjustment(goal, pace);
  const guide = Math.max(floor, Math.round(raw / 10) * 10);
  // Protein per kilogram leads; fat takes a fixed share; carbs fill the rest.
  const proteinPerKg = goal === "muscle" ? 2.0 : goal === "lose" ? 1.8 : 1.5;
  const protein = Math.round(Math.min(body.weightKg * proteinPerKg, (guide * 0.4) / 4));
  const fat = Math.round((guide * 0.28) / 9);
  const carbs = Math.max(0, Math.round((guide - protein * 4 - fat * 9) / 4));
  return { resting, maintenance, guide, protein, carbs, fat, floored: raw < floor };
}

/** Whole weeks from the current to the target weight at the chosen pace; 0 when there is no distance. */
export function weeksToTarget(weightKg: number, targetKg: number, pace: Pace) {
  const distance = Math.abs(weightKg - targetKg);
  if (distance < 0.05) return 0;
  return Math.ceil(distance / paceKgPerWeek[pace]);
}

export function targetDate(weeks: number, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** Consecutive days ending today (or yesterday, if today is still empty) with a logged meal. */
export function streak(loggedDays: Iterable<string>, today: string, yesterday: string) {
  const days = new Set(loggedDays);
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = previousDay(cursor);
  }
  return count;
}

function previousDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Units. Stored values are always metric; these only format and parse input.
export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;
export const cmToFeetInches = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return { feet: Math.floor(inches / 12), inches: inches % 12 };
};
export const feetInchesToCm = (feet: number, inches: number) =>
  Math.round((feet * 12 + inches) * 2.54);

export function formatWeight(kg: number, units: Units) {
  return units === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kgToLb(kg))} lb`;
}
export function formatHeight(cm: number, units: Units) {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′ ${inches}″`;
}

/** Bounds that keep typos from producing a nonsense plan. */
export const limits = {
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  birthYear: (now = new Date()) => ({ min: now.getFullYear() - 100, max: now.getFullYear() - 13 }),
};
