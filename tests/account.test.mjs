import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountError, createSessionClient } from "../src/cookbooks/zest/data/session.ts";
import { paywallConfig, defaultPaywall, perMonth } from "../src/cookbooks/zest/data/plans.ts";
import { parseRecipes } from "../src/cookbooks/zest/data/replies.ts";
import { fitsDiet, perServings, visibleRecipes } from "../src/cookbooks/zest/data/recipeRules.ts";
import { readFileSync } from "node:fs";

function client(routes, stored = null) {
  const secure = {
    value: stored,
    get: async () => secure.value,
    set: async (token) => void (secure.value = token),
    remove: async () => void (secure.value = null),
  };
  const calls = [];
  const send = async (url, init) => {
    const path = url.replace("https://z", "");
    calls.push({ path, method: init.method, auth: init.headers.authorization, app: init.headers["x-zest-token"], body: init.body && JSON.parse(init.body) });
    const [status, body] = routes[`${init.method} ${path}`] ?? [404, { error: "route" }];
    return { status, text: async () => (body === null ? "" : JSON.stringify(body)) };
  };
  return { session: createSessionClient({ base: "https://z", appToken: "app", secure, send }), secure, calls };
}
const mia = { id: "1", email: "mia@example.com", name: "Mia", inviteCode: "c", pro: false, proUntil: 0, hasPassword: true, apple: false };
const guest = { ...mia, email: null, hasPassword: false };

test("a guest session is created once, even when two calls race, and stored securely", async () => {
  const { session, secure, calls } = client({ "POST /v1/auth/anonymous": [201, { token: "g", user: guest }] });
  const [a, b] = await Promise.all([session.ensure(), session.ensure()]);
  assert.deepEqual([a, b], ["g", "g"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].app, "app");
  assert.equal(secure.value, "g");
  assert.equal(session.hasAccount(), false);
});

test("a stored token is reused and a dead one forgotten", async () => {
  const live = client({ "GET /v1/me": [200, { user: mia, profile: { goal: "lose" } }] }, "t");
  assert.equal(await live.session.ensure(), "t");
  assert.equal((await live.session.refresh()).profile.goal, "lose");
  assert.equal(live.calls[0].auth, "Bearer t");
  assert.equal(live.session.hasAccount(), true);
  const dead = client({ "GET /v1/me": [401, { error: "session" }] }, "t");
  assert.equal(await dead.session.refresh(), null);
  assert.equal(dead.secure.value, null);
});

test("errors carry their code; being offline is its own case", async () => {
  const { session } = client({ "POST /v1/auth/login": [401, { error: "credentials" }] });
  await assert.rejects(session.login({ email: "a", password: "b" }), (error) => error instanceof AccountError && error.code === "credentials");
  const offline = createSessionClient({
    base: "https://z",
    secure: { get: async () => null, set: async () => {}, remove: async () => {} },
    send: async () => {
      throw new Error("network");
    },
  });
  await assert.rejects(offline.login({ email: "a", password: "b" }), (error) => error.code === "offline");
});

test("logout forgets the token even if the server can't be reached", async () => {
  const { session, secure } = client({}, "t");
  await session.ensure();
  await session.logout();
  assert.equal(secure.value, null);
});

test("deleting an account ends the session only once the server confirmed", async () => {
  const failing = client({ "POST /v1/auth/delete": [500, {}] }, "t");
  await failing.session.ensure();
  await assert.rejects(failing.session.remove());
  assert.equal(failing.secure.value, "t");
  const working = client({ "POST /v1/auth/delete": [204, null] }, "t");
  await working.session.ensure();
  await working.session.remove();
  assert.equal(working.secure.value, null);
});

test("remote paywall config falls back field by field", () => {
  assert.deepEqual(paywallConfig(null), defaultPaywall);
  assert.deepEqual(paywallConfig({ paywall_benefits: "not json", paywall_highlight: "weekly" }), defaultPaywall);
  const custom = paywallConfig({ paywall_benefits: '["One"]', paywall_highlight: "monthly", paywall_line: " Hi " });
  assert.deepEqual(custom, { benefits: ["One"], highlight: "monthly", line: "Hi" });
  assert.equal(paywallConfig({ paywall_benefits: "[1,2]" }).benefits, defaultPaywall.benefits);
});

test("the monthly equivalent is computed from the store's price, not stored", () => {
  assert.match(perMonth(29.99, "EUR", "en-US"), /2\.50/);
  assert.equal(perMonth(0, "EUR"), null);
  assert.equal(perMonth(10, ""), null);
});

test("recipe lines parse; anything else is skipped", () => {
  const ideas = parseRecipes("Sure!\n- Tofu bowl | 420 | 25 | 40 | 15 | 15\n`Soup | 200 | 8 | 20 | 8 | 20`\nbad | x | 1 | 2 | 3 | 4\n");
  assert.deepEqual(ideas.map((i) => [i.name, i.kcal, i.minutes]), [["Tofu bowl", 420, 15], ["Soup", 200, 20]]);
});

test("seed recipes are consistent, filtered by diet and allergy, and scale by servings", () => {
  const recipes = JSON.parse(readFileSync(new URL("../src/cookbooks/zest/data/recipes.json", import.meta.url)));
  assert.equal(recipes.length, 40);
  for (const r of recipes) {
    const fromMacros = r.protein * 4 + r.carbs * 4 + r.fat * 9;
    assert.ok(Math.abs(fromMacros - r.kcal) / r.kcal < 0.1, `${r.name}: ${fromMacros} vs ${r.kcal}`);
    assert.ok(r.fdc.length >= 2, r.name);
  }
  const base = { query: "", diet: "none", allergies: [], favourites: [] };
  assert.equal(visibleRecipes(recipes, base).length, 40);
  const vegan = visibleRecipes(recipes, { ...base, diet: "vegan" });
  assert.ok(vegan.length >= 10 && vegan.every((r) => r.tags.includes("vegan")));
  assert.ok(vegan.every((r) => !r.allergens.includes("Lactose") && !r.allergens.includes("Egg") && !r.allergens.includes("Fish")));
  assert.equal(visibleRecipes(recipes, { ...base, allergies: ["Peanuts"] }).some((r) => r.allergens.includes("Peanuts")), false);
  assert.equal(visibleRecipes(recipes, { ...base, query: "SALMON" }).length, 2);
  assert.deepEqual(visibleRecipes(recipes, { ...base, type: "Favourites", favourites: ["r1"] }).map((r) => r.id), ["r1"]);
  assert.equal(fitsDiet(recipes.find((r) => r.name === "Beef burger bowl"), "halal"), true);
  const doubled = perServings(recipes[0], 2);
  assert.equal(doubled.kcal, recipes[0].kcal * 2);
});

test("dishes come from the recipe by id, with its numbers, or from a whole line", async () => {
  const { resolveDishes } = await import("../src/cookbooks/zest/data/recipeRules.ts");
  const list = [{ id: "r1", name: "Soup", type: "Dinner", minutes: 20, kcal: 400, protein: 20, carbs: 40, fat: 10 }];
  const [known, made] = resolveDishes(["r1", "Toast | 300 | 12 | 40 | 9 | 10", "r99", "nonsense"], list);
  assert.equal(known.recipeId, "r1");
  assert.equal(known.kcal, 400);
  assert.equal(made.recipeId, undefined);
  assert.equal(made.kcal, 300);
  assert.equal(resolveDishes(["r1", "r1"], list).length, 1);
});
