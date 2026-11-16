import { test } from "node:test";
import assert from "node:assert/strict";
import {
  helperFor,
  helperIds,
  helperList,
  swapHelpers,
  helperReaction,
  helperLine,
  isHelperId,
  defaultHelper,
} from "../src/cookbooks/zest/data/helpers.ts";

test("the lemon and six friends, each complete", () => {
  assert.equal(helperIds.length, 7);
  assert.equal(defaultHelper, "zest");
  for (const helper of helperList) {
    assert.ok(helper.name && helper.role && helper.pitch && helper.persona);
    for (const key of ["body", "shade", "light", "ink", "accent", "cheek"])
      assert.match(helper.palette[key], /^#[0-9A-F]{6}$/i, `${helper.id} ${key}`);
    for (const mood of [-1, 0, 1]) assert.ok(helper.reactions[mood].length >= 2, `${helper.id} ${mood}`);
    assert.ok(helper.hello("Mia").length > 0 && helper.hello("").length > 0);
  }
});

test("no purple, indigo or blue-violet anywhere in the palettes", () => {
  for (const helper of helperList)
    for (const hex of Object.values(helper.palette)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      assert.ok(!(b > r && b > g && r > g), `${helper.id} ${hex} leans violet`);
    }
});

test("unknown ids fall back to the default", () => {
  assert.equal(helperFor("dragon").id, defaultHelper);
  assert.equal(helperFor(undefined).id, defaultHelper);
  assert.equal(helperFor("pip").id, "pip");
  assert.ok(isHelperId("olive"));
  assert.ok(!isHelperId("lemon"));
});

test("reactions are stable per seed and honour the mood", () => {
  const fig = helperFor("fig");
  assert.equal(helperReaction(fig, 1, "Dinner", 7), helperReaction(fig, 1, "Dinner", 7));
  assert.ok(fig.reactions[1].includes(helperReaction(fig, 1, undefined, 1)));
  // Seeds divisible by three use the by-type line when one exists.
  assert.equal(helperReaction(fig, 0, "Snack", 3), fig.reactions.byType.Snack);
  assert.ok(fig.reactions[0].includes(helperReaction(fig, 0, "Snack", 4)));
});

test("setup lines fall back to the lemon's", () => {
  const bao = helperFor("bao");
  assert.equal(helperLine(bao, "name", "x"), bao.lines.name);
  assert.equal(helperLine(bao, "reminders", "A small nudge, if you like."), "A small nudge, if you like.");
});

test("the swap mode shows the six animals, each with a tagline", () => {
  assert.deepEqual(
    swapHelpers.map((helper) => helper.id),
    ["pebble", "fig", "mochi", "bao", "olive", "pip"],
  );
  for (const helper of swapHelpers) assert.match(helper.tagline, /^the /);
});
