import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEventParser,
  isDiaryQuestion,
  parseAnswer,
  parseCorrection,
  parseEstimate,
} from "../src/cookbooks/zest/data/replies.ts";
import { diaryContext } from "../src/cookbooks/zest/data/context.ts";
import { dayKey, relativeDay } from "../src/cookbooks/zest/data/diary.ts";

test("event parser handles split chunks and ignores partial lines", () => {
  const push = createEventParser();
  assert.deepEqual(push('data: {"type":"text","del'), []);
  assert.deepEqual(push('ta":"Hi"}\n\ndata: {"type":"done"}\n\n'), [
    { type: "text", delta: "Hi" },
    { type: "done" },
  ]);
});

test("estimate is null until the first line has shape, settled after its newline", () => {
  assert.equal(parseEstimate("Penne"), null);
  const partial = parseEstimate("Penne with garlic bread | 11");
  assert.equal(partial?.settled, false);
  assert.equal(partial?.kcal, 11);
  const settled = parseEstimate("Penne with garlic bread | 1120 kcal | 32 g | 150 | 40\nA generous plate.");
  assert.deepEqual(settled, {
    name: "Penne with garlic bread",
    kcal: 1120,
    protein: 32,
    carbs: 150,
    fat: 40,
    note: "A generous plate.",
    settled: true,
    notFood: false,
  });
  assert.equal(parseEstimate("Not a meal | 0 | ?\nNo food here.")?.notFood, true);
  assert.equal(parseEstimate("Soup | 310 | ?\n")?.protein, undefined);
  assert.equal(parseEstimate("Soup | 310 | 12\n")?.carbs, undefined);
  // Qwen opened its real reply with a newline; the leading blank line must not count as line one.
  const led = parseEstimate("\nAvocado toast eggs | 450 | 20 | 30 | 25\nA balanced breakfast.");
  assert.equal(led?.name, "Avocado toast eggs");
  assert.equal(led?.kcal, 450);
  assert.equal(led?.note, "A balanced breakfast.");
});

test("answer parser hides a half-arrived marker and extracts follow-ups", () => {
  assert.deepEqual(parseAnswer("Try a light soup.\n>"), {
    text: "Try a light soup.",
    followups: [],
    pendingMarker: true,
  });
  const done = parseAnswer("Try a light soup.\n>> Soup ideas? | Protein today? | Show my week\n");
  assert.equal(done.text, "Try a light soup.");
  assert.deepEqual(done.followups, ["Soup ideas?", "Protein today?", "Show my week"]);
  assert.equal(done.pendingMarker, false);
  assert.equal(parseAnswer("Plain answer").text, "Plain answer");
});

test("diary questions stay local; open questions go to the model", () => {
  assert.equal(isDiaryQuestion("How much did I eat today?"), true);
  assert.equal(isDiaryQuestion("protein yesterday"), true);
  assert.equal(isDiaryQuestion("What should I cook tonight?"), false);
  assert.equal(isDiaryQuestion("Is pasta healthy?"), false);
});

test("diary context carries only numbers and names, never photos", () => {
  const now = new Date(2026, 9, 29, 20);
  const meals = [
    { id: "a", date: dayKey(now), name: "Bowl", kcal: 640, type: "Lunch", time: "1:10 PM", photo: { sample: false, uri: "file:///secret.jpg" } },
    { id: "b", date: relativeDay(-1, now), name: "Toast", kcal: 420, type: "Breakfast", time: "9:00 AM" },
    { id: "c", date: relativeDay(-9, now), name: "Old", kcal: 999, type: "Dinner", time: "7:00 PM" },
  ];
  const context = diaryContext(meals, 2000, "de-DE", now);
  assert.equal(context.today.total, 640);
  assert.deepEqual(context.today.meals, [{ name: "Bowl", kcal: 640, type: "Lunch", time: "1:10 PM" }]);
  assert.deepEqual(context.yesterday, { total: 420, count: 1 });
  assert.deepEqual(context.week, { total: 1060, loggedDays: 2 });
  assert.equal(JSON.stringify(context).includes("secret"), false);
});

test("photos shrink to the long edge in either orientation", async () => {
  const { fitLongEdge } = await import("../src/cookbooks/zest/data/replies.ts");
  assert.deepEqual(fitLongEdge(3024, 4032, 1280), { width: 960, height: 1280 });
  assert.deepEqual(fitLongEdge(4032, 3024, 1280), { width: 1280, height: 960 });
  assert.equal(fitLongEdge(800, 600, 1280), null);
});

test("follow-ups are found when the model keeps them on the last line", () => {
  const done = parseAnswer("Try the tofu. >> More protein? | A soup?\n");
  assert.equal(done.text, "Try the tofu.");
  assert.deepEqual(done.followups, ["More protein?", "A soup?"]);
  assert.equal(parseAnswer("Try the tofu. >").text, "Try the tofu.");
});

test("a correction reads like a meal line, anything else is not one", () => {
  const fix = parseCorrection("~ Bowl with oats | 420 | 18 | 58 | 12\nAdded about 40 g oats, now 420 kcal.\n");
  assert.equal(fix.name, "Bowl with oats");
  assert.equal(fix.kcal, 420);
  assert.equal(fix.carbs, 58);
  assert.equal(fix.note, "Added about 40 g oats, now 420 kcal.");
  assert.equal(parseCorrection("Try a soup.\n"), null);
  assert.equal(parseCorrection("~ Bowl | 42"), null);
});
