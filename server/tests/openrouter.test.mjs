import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeltaParser } from "../src/openrouter.ts";
import { askSystemPrompt, mealSystemPrompt } from "../src/prompts.ts";
import { calibrateLine, createLineCalibrator } from "../src/calibrate.ts";

test("delta parser survives chunks split mid-line and ignores keep-alives", () => {
  const push = createDeltaParser();
  const a = push(': keep-alive\n\ndata: {"choices":[{"delta":{"content":"Hel');
  assert.deepEqual(a, { deltas: [], done: false });
  const b = push('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" there"}}]}\n\ndata: [DONE]\n\n');
  assert.deepEqual(b, { deltas: ["Hello", " there"], done: true });
});

test("delta parser surfaces upstream error payloads", () => {
  const push = createDeltaParser();
  assert.throws(() => push('data: {"error":{"message":"rate limited"}}\n'), /rate limited/);
});

test("prompts carry the wire format the app parses", () => {
  assert.match(mealSystemPrompt(), /<meal name> \| <kilocalories/);
  const prompt = askSystemPrompt({
    guide: 2000,
    today: { total: 640, meals: [{ name: "Bowl", kcal: 640, type: "Lunch", time: "1:10 PM" }] },
    yesterday: { total: 1800, count: 3 },
    week: { total: 9000, loggedDays: 5 },
  });
  assert.match(prompt, /Today: 640 kcal over 1 meals: Lunch 1:10 PM Bowl 640 kcal/);
  assert.match(prompt, /`>> `/);
});

const diary = {
  guide: 1420,
  targets: { protein: 112, carbs: 150, fat: 44 },
  today: { total: 0, meals: [] },
  yesterday: { total: 0, count: 0 },
  week: { total: 0, loggedDays: 0 },
};

test("the ask prompt carries the whole onboarding profile", () => {
  const prompt = askSystemPrompt({
    ...diary,
    person: {
      name: "Mia",
      goal: "Lose weight",
      sex: "female",
      age: 32,
      heightCm: 168,
      weightKg: 70,
      targetWeightKg: 64,
      activity: "Lightly active",
      pace: "Steady",
      diet: "Vegetarian",
      avoid: ["Peanuts", "Kiwi"],
      usualMeals: ["Lunch", "Dinner"],
    },
  });
  assert.match(prompt, /32 years old, female, 168 cm, 70 kg, aiming for 64 kg, at a steady pace, activity: lightly active/);
  assert.match(prompt, /They eat vegetarian/);
  assert.match(prompt, /Never suggest anything containing: Peanuts, Kiwi/);
  assert.match(prompt, /They usually eat: Lunch, Dinner/);
  assert.match(prompt, /Daily guide: 1420 kcal\. Macro targets: 112 g protein/);
  assert.match(prompt, /never to generic numbers/);
});

test("the meal prompt's examples obey its own arithmetic", () => {
  const examples = mealSystemPrompt().split("\n").filter((line) => /^[A-Z][^|]* \| \d+ \| \d+ \| \d+ \| \d+$/.test(line));
  assert.ok(examples.length >= 5);
  for (const line of examples) {
    const [, kcal, p, c, f] = line.split("|").map((part) => Number(part.trim()));
    assert.ok(Math.abs(p * 4 + c * 4 + f * 9 - kcal) / kcal < 0.08, line);
  }
});

test("calibration trusts macros over a wrong total", () => {
  assert.equal(calibrateLine("Bowl | 300 | 30 | 60 | 20", "Lunch"), "Bowl | 540 | 30 | 60 | 20");
  assert.equal(calibrateLine("Bowl | 530 | 30 | 60 | 20", "Lunch"), "Bowl | 530 | 30 | 60 | 20");
});

test("calibration enforces meal bounds, scales macros and stands down for a hint", () => {
  assert.equal(calibrateLine("Stew | 40 | ? | ? | ?", "Dinner"), "Stew | 100 | ? | ? | ?");
  assert.equal(calibrateLine("Feast | 4000 | 100 | 400 | 200", "Snack"), "Feast | 1400 | 37 | 147 | 74");
  assert.equal(calibrateLine("Feast | 4000 | ? | ? | ?", "Snack", "the whole table"), "Feast | 4000 | ? | ? | ?");
});

test("calibration knows common foods only by their exact name", () => {
  assert.equal(calibrateLine("Banana | 400 | ? | ? | ?", "Snack"), "Banana | 160 | ? | ? | ?");
  assert.equal(calibrateLine("Banana bread | 400 | ? | ? | ?", "Snack"), "Banana bread | 400 | ? | ? | ?");
  assert.equal(calibrateLine("Banane | 30 | ? | ? | ?", "Snack"), "Banane | 70 | ? | ? | ?");
});

test("calibration leaves what it cannot read alone", () => {
  assert.equal(calibrateLine("Not a meal | 0 | ?", "Lunch"), "Not a meal | 0 | ?");
  assert.equal(calibrateLine("no pipes here", "Lunch"), "no pipes here");
  assert.equal(calibrateLine("Soup | ? | ?", "Lunch"), "Soup | ? | ?");
});

test("the stream holds back line one, corrects it and lets the note flow", () => {
  const c = createLineCalibrator("Lunch");
  assert.equal(c.push("\nBowl | 300 "), "");
  assert.equal(c.push("| 30 | 60 | 20"), "");
  assert.equal(c.push("\nAbout 300"), "Bowl | 540 | 30 | 60 | 20\nAbout 300");
  assert.equal(c.push(" g."), " g.");
  assert.equal(c.flush(), "");
  const short = createLineCalibrator("Dinner");
  assert.equal(short.push("Stew | 40 | ? | ? | ?"), "");
  assert.equal(short.flush(), "Stew | 100 | ? | ? | ?");
});
