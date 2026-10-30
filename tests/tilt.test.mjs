import { test } from "node:test";
import assert from "node:assert/strict";
import { leaning } from "../src/cookbooks/zest/motion/tilt.ts";

/**
 * The gaze's tilt input, as useScene feeds it every frame: gravity in the
 * phone's frame, normalised, against a level that drifts toward how the phone
 * is held. The simulator has no gravity sensor, so this is where tilt is
 * checked.
 */
const held = { x: 0, y: -0.6 }; // phone held at a comfortable angle

test("level settles on how the phone is held; no lean at rest", () => {
  let level = { levelX: held.x, levelY: held.y };
  for (let i = 0; i < 60; i++) {
    const r = leaning(held.x, held.y, level.levelX, level.levelY, 1 / 60);
    level = { levelX: r.levelX, levelY: r.levelY };
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  }
});

test("lowering the right edge leans the gaze right, the top edge away leans it up", () => {
  const right = leaning(held.x + 0.2, held.y, held.x, held.y, 1 / 60);
  assert.ok(right.x > 0.5, `x=${right.x}`);
  assert.equal(right.y, 0);
  const left = leaning(held.x - 0.2, held.y, held.x, held.y, 1 / 60);
  assert.ok(left.x < -0.5, `x=${left.x}`);
  const up = leaning(held.x, held.y + 0.2, held.x, held.y, 1 / 60);
  assert.ok(up.y > 0.5, `y=${up.y}`);
});

test("a held tilt fades out as the level catches up (about 2.6 s)", () => {
  let level = { levelX: held.x, levelY: held.y };
  const tilted = { x: held.x + 0.2, y: held.y };
  let first = 0;
  let last = 0;
  for (let i = 0; i < 60 * 6; i++) {
    const r = leaning(tilted.x, tilted.y, level.levelX, level.levelY, 1 / 60);
    level = { levelX: r.levelX, levelY: r.levelY };
    if (i === 0) first = r.x;
    last = r.x;
  }
  assert.ok(first > 0.5 && last < 0.1, `first=${first} last=${last}`);
});

test("the lean is clamped to the unit range", () => {
  const r = leaning(1, 0, 0, 0, 1 / 60);
  assert.equal(r.x, 1);
  const l = leaning(-1, 0, 0, 0, 1 / 60);
  assert.equal(l.x, -1);
});
