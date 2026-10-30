import assert from "node:assert/strict";
import { test } from "node:test";
import { createDiaryStore } from "../src/cookbooks/zest/state/diaryStore.ts";
import { dayKey, totalOn } from "../src/cookbooks/zest/data/diary.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const meal = {
  id: "test-meal",
  date: dayKey(),
  name: "My lunch",
  kcal: 640,
  type: "Lunch",
  time: "1:00 PM",
};

test("ordinary launch is empty; a repeated confirmation does not duplicate a meal", () => {
  const store = createDiaryStore(memoryStorage());
  assert.deepEqual(store.getState().meals, []);
  store.getState().add(meal);
  store.getState().add(meal);
  assert.equal(store.getState().meals.length, 1);
  assert.equal(totalOn(store.getState().meals, dayKey()), 640);
});

test("edits, deletion and guide survive reopening the same storage", () => {
  const storage = memoryStorage();
  const first = createDiaryStore(storage);
  first.getState().add(meal);
  first.getState().edit(meal.id, { name: "Edited lunch", kcal: 720 });
  first.getState().setGuide(2200);
  const reopened = createDiaryStore(storage);
  assert.equal(reopened.getState().guide, 2200);
  const { updatedAt, ...edited } = reopened.getState().meals[0];
  assert.deepEqual([edited], [{ ...meal, name: "Edited lunch", kcal: 720 }]);
  assert.equal(typeof updatedAt, "number");
  reopened.getState().remove(meal.id);
  assert.deepEqual(createDiaryStore(storage).getState().meals, []);
});

test("demo data is explicit, resettable and isolated from a separate diary", () => {
  const diary = createDiaryStore(memoryStorage());
  const other = createDiaryStore(memoryStorage());
  diary.getState().seedDemo();
  assert.equal(diary.getState().meals.length, 32);
  diary.getState().add(meal);
  diary.getState().seedDemo();
  assert.equal(diary.getState().meals.length, 32);
  assert.deepEqual(other.getState().meals, []);
});

test("sync merge: the newer version wins, deletions travel, a local photo stays", () => {
  const store = createDiaryStore(memoryForMerge());
  const base = { date: "2026-10-30", name: "Lunch", kcal: 500, type: "Lunch", time: "1 PM" };
  store.getState().add({ ...base, id: "a", photo: { uri: "file:///a.jpg", sample: false } });
  store.getState().add({ ...base, id: "gone" });
  const t = store.getState().meals[0].updatedAt;
  store.getState().merge(
    [
      { id: "a", data: { ...base, id: "a", kcal: 111 }, deleted: false, updatedAt: t - 1000 },
      { id: "gone", data: {}, deleted: true, updatedAt: t + 1000 },
      { id: "new", data: { ...base, id: "new", kcal: 222 }, deleted: false, updatedAt: t + 2000 },
    ],
    t + 5000,
  );
  const meals = store.getState().meals;
  assert.equal(meals.find((m) => m.id === "a").kcal, 500, "older remote loses");
  assert.equal(meals.some((m) => m.id === "gone"), false);
  assert.equal(meals.find((m) => m.id === "new").kcal, 222);
  assert.equal(store.getState().lastSyncAt, t + 5000);
  store.getState().merge(
    [{ id: "a", data: { ...base, id: "a", kcal: 333 }, deleted: false, updatedAt: t + 9000 }],
    t + 9000,
  );
  const a = store.getState().meals.find((m) => m.id === "a");
  assert.equal(a.kcal, 333);
  assert.equal(a.photo.uri, "file:///a.jpg", "the server has no photo; the phone's stays");
  store.getState().remove("a");
  assert.equal(store.getState().tombstones.some((g) => g.id === "a"), true);
});

function memoryForMerge() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
