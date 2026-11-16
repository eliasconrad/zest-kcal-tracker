import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageFromDate,
  cmToFeetInches,
  feetInchesToCm,
  loggedThisWeek,
  maintenanceEnergy,
  plan,
  restingEnergy,
  streak,
  weeksToTarget,
} from "../src/cookbooks/zest/data/nutrition.ts";
import { createProfileStore, profilePlan, defaultProfile } from "../src/cookbooks/zest/state/profileStore.ts";

const now = new Date(2026, 9, 29, 12);
const body = { sex: "male", birthYear: 1996, heightCm: 180, weightKg: 80 };

test("resting and maintenance energy follow Mifflin-St Jeor", () => {
  // 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(restingEnergy(body, now), 1780);
  assert.equal(maintenanceEnergy(body, "light", now), Math.round(1780 * 1.375));
  assert.equal(restingEnergy({ ...body, sex: "female" }, now), 1780 - 166);
});

test("plan applies the pace deficit, rounds to tens and keeps macros consistent", () => {
  const p = plan(body, "lose", "light", "steady", now);
  const expected = Math.round((Math.round(1780 * 1.375) - 550) / 10) * 10;
  assert.equal(p.guide, expected);
  assert.equal(p.floored, false);
  assert.ok(p.protein >= 100 && p.protein <= 144, `protein ${p.protein}`);
  const kcalFromMacros = p.protein * 4 + p.carbs * 4 + p.fat * 9;
  assert.ok(Math.abs(kcalFromMacros - p.guide) <= 12, `macros sum ${kcalFromMacros} vs ${p.guide}`);
});

test("a birthday later in the year is one year younger than the birth year alone", () => {
  assert.equal(ageFromDate("1996-11-01", now), 29);
  assert.equal(ageFromDate("1996-01-01", now), 30);
});

test("vegan and vegetarian plans use the lower protein target", () => {
  const usual = plan(body, "lose", "light", "steady", now, "omnivore");
  const vegan = plan(body, "lose", "light", "steady", now, "vegan");
  const vegetarian = plan(body, "lose", "light", "steady", now, "vegetarian");
  assert.ok(vegan.protein < usual.protein);
  assert.equal(vegetarian.protein, vegan.protein);
  assert.ok(vegan.carbs > usual.carbs);
  assert.equal(vegan.guide, usual.guide);
});

test("plan never goes below the safety floor and reports it", () => {
  const small = { sex: "female", birthYear: 1960, heightCm: 150, weightKg: 45 };
  const p = plan(small, "lose", "sedentary", "fast", now);
  assert.equal(p.guide, 1200);
  assert.equal(p.floored, true);
  assert.equal(plan(body, "maintain", "light", "steady", now).guide, Math.round(Math.round(1780 * 1.375) / 10) * 10);
});

test("weeks to target and unit conversions", () => {
  assert.equal(weeksToTarget(80, 75, "steady"), 10);
  assert.equal(weeksToTarget(80, 80, "fast"), 0);
  assert.deepEqual(cmToFeetInches(180), { feet: 5, inches: 11 });
  assert.equal(feetInchesToCm(5, 11), 180);
});

test("streak counts consecutive logged days and forgives an empty today", () => {
  const days = ["2026-10-29", "2026-10-28", "2026-10-27", "2026-10-24"];
  assert.equal(streak(days, "2026-10-29", "2026-10-28"), 3);
  assert.equal(streak(days, "2026-10-30", "2026-10-29"), 3);
  assert.equal(streak(days, "2026-10-31", "2026-10-30"), 0);
  assert.equal(streak([], "2026-10-29", "2026-10-28"), 0);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("profile persists, logs weight in order and a manual guide overrides only calories", () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  assert.equal(store.getState().onboarded, false);
  store.getState().save({
    name: "Mia",
    sex: "female",
    birthYear: 1994,
    birthDate: "1994-01-01",
    heightCm: 168,
    weightKg: 70,
    targetWeightKg: 64,
    goal: "lose",
    diet: "vegetarian",
    allergies: ["nuts"],
    mealsPerDay: 3,
    reminders: false,
  });
  store.getState().logWeight({ date: "2026-10-28", kg: 69.5 });
  store.getState().logWeight({ date: "2026-10-20", kg: 70 });
  store.getState().logWeight({ date: "2026-10-28", kg: 69.2 });
  store.getState().finishOnboarding();
  const reopened = createProfileStore(storage).getState();
  assert.equal(reopened.name, "Mia");
  assert.equal(reopened.diet, "vegetarian");
  assert.deepEqual(reopened.allergies, ["nuts"]);
  assert.equal(reopened.birthDate, "1994-01-01");
  assert.equal(reopened.onboarded, true);
  assert.equal(reopened.weightKg, 69.2);
  assert.deepEqual(reopened.weights, [
    { date: "2026-10-20", kg: 70 },
    { date: "2026-10-28", kg: 69.2 },
  ]);
  assert.equal(typeof reopened.save, "function");
  const auto = profilePlan(reopened, now);
  const manual = profilePlan({ ...reopened, manualGuide: 1800 }, now);
  assert.equal(manual.guide, 1800);
  assert.notEqual(auto.guide, 1800);
  assert.ok(manual.protein <= auto.protein);
  store.getState().reset();
  assert.deepEqual({ ...store.getState(), save: 0, logWeight: 0, finishOnboarding: 0, reset: 0 }, { ...defaultProfile, save: 0, logWeight: 0, finishOnboarding: 0, reset: 0 });
});

test("week strip is Monday-first and marks only this week's logged days", () => {
  // 2026-10-29 is a Thursday; Monday is 10-26.
  const thursday = new Date(2026, 9, 29, 20);
  const strip = loggedThisWeek(["2026-10-26", "2026-10-29", "2026-10-25", "2026-11-01"], thursday);
  assert.deepEqual(strip, [true, false, false, true, false, false, true]);
  assert.deepEqual(loggedThisWeek([], thursday), [false, false, false, false, false, false, false]);
});

test("camera pre-selects the meal from the clock and the e-mail check is lenient but real", async () => {
  const { defaultMealType, validEmail } = await import("../src/cookbooks/zest/data/diary.ts");
  assert.equal(defaultMealType(new Date(2026, 9, 29, 8, 30)), "Breakfast");
  assert.equal(defaultMealType(new Date(2026, 9, 29, 12, 0)), "Lunch");
  assert.equal(defaultMealType(new Date(2026, 9, 29, 16, 0)), "Snack");
  assert.equal(defaultMealType(new Date(2026, 9, 29, 19, 45)), "Dinner");
  assert.equal(validEmail("mia@example.com"), true);
  assert.equal(validEmail(" mia@example.de "), true);
  assert.equal(validEmail("mia@example"), false);
  assert.equal(validEmail("mia.example.com"), false);
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  store.getState().save({ email: "mia@example.com" });
  assert.equal(createProfileStore(storage).getState().email, "mia@example.com");
});
