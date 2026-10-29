import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeltaParser } from "../src/openrouter.ts";
import { askSystemPrompt, mealSystemPrompt } from "../src/prompts.ts";

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
