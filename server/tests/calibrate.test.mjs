import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrateMeal } from "../src/calibrate.ts";
import { askSystemPrompt } from "../src/prompts.ts";

test("a tiny dinner is raised and the note says so", () => {
  const result = calibrateMeal("Soup | 20 | 2 | 3 | 0\nA small bowl.", "Dinner");
  assert.equal(result.adjusted, true);
  assert.match(result.text, /far too low for a dinner/);
  assert.match(result.text, /\| 200 \|/);
});

test("a 4000 kcal snack is pulled back", () => {
  const result = calibrateMeal("Nuts | 4500 | 20 | 40 | 80\nA handful.", "Snack");
  assert.match(result.text, /extreme/);
  assert.doesNotMatch(result.text, /4500/);
});

test("macros that disagree by more than 15% replace the kilocalories", () => {
  // 40*4 + 40*4 + 20*9 = 500, reported 200, which is more than 15% off.
  const result = calibrateMeal("Plate | 200 | 40 | 40 | 20\nA mixed plate.", "Lunch");
  assert.match(result.text, /\| 500 \|/);
  assert.match(result.text, /4\/4\/9/);
});

test("an unknown reply is left alone", () => {
  const raw = "Unknown | ? | ? | ? | ?\nI can't tell what this is.";
  const result = calibrateMeal(raw, "Snack");
  assert.equal(result.adjusted, false);
  assert.equal(result.text, raw);
});

test("a named food far from its usual portion is pulled toward the table", () => {
  const result = calibrateMeal("Banana | 900 | 1 | 20 | 0\nOne fruit.", "Snack");
  assert.match(result.text, /\| 105 \|/);
  assert.match(result.text, /usual portion/);
});

test("ask prompt includes the person's own plan lines", () => {
  const prompt = askSystemPrompt({
    guide: 1800,
    targets: { protein: 120, carbs: 180, fat: 50 },
    person: {
      name: "Mia",
      goal: "Lose weight",
      streak: 4,
      sex: "female",
      age: 32,
      heightCm: 168,
      weightKg: 70,
      targetKg: 64,
      activity: "Lightly active",
      pace: "Steady",
      diet: "Vegetarian",
      allergies: "Nuts",
      mealsPerDay: 3,
    },
    today: { total: 400, meals: [] },
    yesterday: { total: 1600, count: 3 },
    week: { total: 8000, loggedDays: 5 },
  });
  for (const line of [
    "Age: 32.",
    "Height: 168 cm.",
    "Weight: 70 kg.",
    "Target weight: 64 kg.",
    "Activity: Lightly active.",
    "Pace: Steady.",
    "Dietary pattern: Vegetarian.",
    "Allergies: Nuts.",
    "Meals per day: 3.",
    "Sex: female.",
  ]) {
    assert.match(prompt, new RegExp(line.replace(/[.]/g, "\\.")));
  }
});
