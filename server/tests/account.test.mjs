import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { handleAccount, refund, spend, authenticate } from "../src/account.ts";
import { base64url, hashPassword, verifyAppleToken, verifyPassword } from "../src/auth.ts";

/** D1's surface over a real SQLite with the real migration. */
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(new URL("../migrations/0001_accounts.sql", import.meta.url), "utf8"));
  const prepare = (sql) => {
    let params = [];
    const statement = {
      bind: (...values) => ((params = values), statement),
      first: async () => sqlite.prepare(sql).get(...params) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
      run: async () => sqlite.prepare(sql).run(...params),
    };
    return statement;
  };
  return {
    sqlite,
    prepare,
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      for (const statement of statements) await statement.run();
      sqlite.exec("COMMIT");
    },
  };
}

function harness(extra = {}) {
  const DB = database();
  const clock = { now: Date.parse("2026-10-30T12:00:00Z") };
  const env = { DB, ZEST_BUNDLE_ID: "eu.eliasconrad.zest", ...extra };
  const sent = [];
  const deps = {
    now: () => clock.now,
    send: async (url, init) => (sent.push({ url, body: JSON.parse(init.body) }), new Response("{}")),
    verifyApple: async (token) => (token === "good" ? { sub: "apple-1", email: "relay@privaterelay.appleid.com" } : null),
    verifyJws: (jws) => {
      if (jws === "bad") throw new Error("signature");
      return JSON.parse(jws);
    },
  };
  const call = async (method, path, { token, body } = {}) => {
    const response = await handleAccount(
      new Request(`https://x${path}`, {
        method,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      new URL(`https://x${path}`),
      env,
      deps,
    );
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  return { DB, env, clock, sent, call };
}

const signup = (h, email = "mia@example.com", name = "Mia") =>
  h.call("POST", "/v1/auth/signup", { body: { email, password: "lemonade8", name } });

test("passwords hash with a per-user salt and verify only when right", async () => {
  const one = await hashPassword("lemonade8", 1);
  const two = await hashPassword("lemonade8", 1);
  assert.notEqual(one, two);
  assert.equal(await verifyPassword("lemonade8", one), true);
  assert.equal(await verifyPassword("lemonade9", one), false);
  assert.equal(await verifyPassword("x", "nonsense"), false);
});

test("sign-up, login and the wrong password", async () => {
  const h = harness();
  const created = await signup(h);
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, "mia@example.com");
  assert.equal((await signup(h)).status, 409);
  assert.equal((await h.call("POST", "/v1/auth/signup", { body: { email: "nope", password: "lemonade8" } })).status, 400);
  assert.equal((await h.call("POST", "/v1/auth/login", { body: { email: "MIA@example.com ", password: "lemonade8" } })).status, 200);
  assert.equal((await h.call("POST", "/v1/auth/login", { body: { email: "mia@example.com", password: "wrong-one" } })).status, 401);
  assert.equal((await h.call("POST", "/v1/auth/login", { body: { email: "ghost@example.com", password: "lemonade8" } })).status, 401);
});

test("a guest keeps its account when it signs up", async () => {
  const h = harness();
  const guest = await h.call("POST", "/v1/auth/anonymous", { body: {} });
  assert.equal(guest.status, 201);
  const upgraded = await h.call("POST", "/v1/auth/signup", {
    token: guest.body.token,
    body: { email: "mia@example.com", password: "lemonade8", name: "Mia" },
  });
  assert.equal(upgraded.status, 200);
  assert.equal(upgraded.body.user.id, guest.body.user.id);
});

test("sessions expire, slide and end at logout", async () => {
  const h = harness();
  const { token } = (await signup(h)).body;
  assert.equal((await h.call("GET", "/v1/me", { token })).status, 200);
  h.clock.now += 29 * 86_400_000;
  assert.equal((await h.call("GET", "/v1/me", { token })).status, 200);
  h.clock.now += 29 * 86_400_000;
  assert.equal((await h.call("GET", "/v1/me", { token })).status, 200, "the last call extended it");
  h.clock.now += 31 * 86_400_000;
  assert.equal((await h.call("GET", "/v1/me", { token })).status, 401);
  const again = (await h.call("POST", "/v1/auth/login", { body: { email: "mia@example.com", password: "lemonade8" } })).body.token;
  assert.equal((await h.call("POST", "/v1/auth/logout", { token: again, body: {} })).status, 204);
  assert.equal((await h.call("GET", "/v1/me", { token: again })).status, 401);
});

test("deleting an account removes every row that belongs to it", async () => {
  const h = harness();
  const mia = (await signup(h)).body;
  const tom = (await signup(h, "tom@example.com", "Tom")).body;
  await h.call("POST", "/v1/friends/accept", { token: tom.token, body: { code: mia.user.inviteCode } });
  await h.call("PUT", "/v1/me", { token: mia.token, body: { profile: { goal: "lose" } } });
  await h.call("POST", "/v1/sync/meals", { token: mia.token, body: { meals: [{ id: "m1", updatedAt: 1, data: { kcal: 400 } }] } });
  await h.call("POST", "/v1/me/day", { token: mia.token, body: { day: "2026-10-30", streak: 1, total: 400 } });
  await h.call("POST", "/v1/me/device", { token: mia.token, body: { token: "push-1" } });
  await h.call("POST", "/v1/purchase", { token: mia.token, body: { jws: JSON.stringify({ originalTransactionId: "t1", productId: "p", bundleId: "eu.eliasconrad.zest", expiresDate: h.clock.now + 1000 }) } });
  assert.equal((await h.call("POST", "/v1/auth/delete", { token: mia.token, body: {} })).status, 204);
  const id = mia.user.id;
  for (const [table, column] of [["users", "id"], ["sessions", "user_id"], ["profiles", "user_id"], ["meals", "user_id"], ["log_days", "user_id"], ["devices", "user_id"], ["purchases", "user_id"], ["friendships", "user_id"], ["friendships", "friend_id"]]) {
    const row = h.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(id);
    assert.equal(row.n, 0, `${table}.${column}`);
  }
  assert.equal((await h.call("GET", "/v1/friends", { token: tom.token })).body.friends.length, 0);
});

test("the free limit stops at the limit and Pro has none", async () => {
  const h = harness({ FREE_SCANS_PER_DAY: "2" });
  const { token } = (await signup(h)).body;
  const now = h.clock.now;
  const user = (await authenticate(new Request("https://x", { headers: { authorization: `Bearer ${token}` } }), h.DB, now)).user;
  assert.equal((await spend(h.env, user, "scans", now)).allowed, true);
  assert.equal((await spend(h.env, user, "scans", now)).allowed, true);
  assert.deepEqual(await spend(h.env, user, "scans", now), { allowed: false, limit: 2 });
  assert.equal((await spend(h.env, user, "scans", now + 86_400_000)).allowed, true, "a new day");
  assert.equal((await spend(h.env, { ...user, pro_until: now + 1000 }, "scans", now)).allowed, true);
});

test("sync keeps the newest version and carries deletions", async () => {
  const h = harness();
  const { token } = (await signup(h)).body;
  await h.call("POST", "/v1/sync/meals", { token, body: { meals: [{ id: "m1", updatedAt: 200, data: { kcal: 500 } }] } });
  const stale = await h.call("POST", "/v1/sync/meals", { token, body: { meals: [{ id: "m1", updatedAt: 100, data: { kcal: 1 } }] } });
  assert.equal(stale.body.meals[0].data.kcal, 500);
  const gone = await h.call("POST", "/v1/sync/meals", { token, body: { meals: [{ id: "m1", updatedAt: 300, deleted: true }], since: 250 } });
  assert.deepEqual(gone.body.meals.map((m) => [m.id, m.deleted]), [["m1", true]]);
});

test("purchases need a valid signature and the right bundle, and revocation ends Pro", async () => {
  const h = harness();
  const { token } = (await signup(h)).body;
  const later = h.clock.now + 86_400_000;
  const transaction = { originalTransactionId: "t1", productId: "yearly", bundleId: "eu.eliasconrad.zest", expiresDate: later };
  assert.equal((await h.call("POST", "/v1/purchase", { token, body: { jws: "bad" } })).status, 400);
  assert.equal((await h.call("POST", "/v1/purchase", { token, body: { jws: JSON.stringify({ ...transaction, bundleId: "other" }) } })).status, 400);
  const bought = await h.call("POST", "/v1/purchase", { token, body: { jws: JSON.stringify(transaction) } });
  assert.deepEqual(bought.body, { pro: true, proUntil: later });
  const signed = JSON.stringify({ data: { signedTransactionInfo: JSON.stringify({ ...transaction, revocationDate: h.clock.now }) } });
  assert.equal((await h.call("POST", "/v1/appstore/notifications", { body: { signedPayload: signed } })).status, 200);
  assert.equal((await h.call("GET", "/v1/me", { token })).body.user.pro, false);
});

test("friends see the streak by default, the total only when shared, and nothing after blocking", async () => {
  const h = harness();
  const mia = (await signup(h)).body;
  const tom = (await signup(h, "tom@example.com", "Tom")).body;
  assert.equal((await h.call("POST", "/v1/friends/accept", { token: mia.token, body: { code: mia.user.inviteCode } })).status, 400);
  assert.equal((await h.call("POST", "/v1/friends/accept", { token: tom.token, body: { code: "nope" } })).status, 404);
  assert.equal((await h.call("POST", "/v1/friends/accept", { token: tom.token, body: { code: mia.user.inviteCode } })).status, 200);
  await h.call("POST", "/v1/me/device", { token: tom.token, body: { token: "tom-phone" } });
  await h.call("POST", "/v1/me/day", { token: mia.token, body: { day: "2026-10-30", streak: 4, total: 900 } });
  assert.deepEqual(h.sent[0].body, [{ to: "tom-phone", title: "Zest", body: "Mia logged today." }]);
  await h.call("POST", "/v1/me/day", { token: mia.token, body: { day: "2026-10-30", streak: 4, total: 1200 } });
  assert.equal(h.sent.length, 1, "only the first meal of a day nudges");
  await h.call("POST", "/v1/me/day", { token: mia.token, body: { day: "2026-10-30", streak: 4, total: 900 } });
  let view = (await h.call("GET", "/v1/friends?day=2026-10-30", { token: tom.token })).body.friends[0];
  assert.deepEqual([view.name, view.streak, view.loggedToday, view.total, view.weekDays], ["Mia", 4, true, null, 1]);
  await h.call("PUT", `/v1/friends/${tom.user.id}`, { token: mia.token, body: { shareTotal: true } });
  view = (await h.call("GET", "/v1/friends?day=2026-10-30", { token: tom.token })).body.friends[0];
  assert.equal(view.total, 900);
  view = (await h.call("GET", "/v1/friends?day=2026-11-02", { token: tom.token })).body.friends[0];
  assert.deepEqual([view.streak, view.loggedToday, view.total], [0, false, null]);
  await h.call("POST", `/v1/friends/${tom.user.id}/block`, { token: mia.token, body: {} });
  assert.equal((await h.call("GET", "/v1/friends", { token: tom.token })).body.friends.length, 0);
  assert.equal((await h.call("POST", "/v1/friends/accept", { token: tom.token, body: { code: mia.user.inviteCode } })).status, 404);
});

test("password reset needs the mailed code and ends old sessions", async () => {
  const h = harness({ RESEND_API_KEY: "test" });
  const { token } = (await signup(h)).body;
  assert.equal((await h.call("POST", "/v1/auth/forgot", { body: { email: "ghost@example.com" } })).status, 204);
  assert.equal(h.sent.length, 0);
  assert.equal((await h.call("POST", "/v1/auth/forgot", { body: { email: "mia@example.com" } })).status, 204);
  const code = /code is (\d{6})/.exec(h.sent[0].body.text)[1];
  assert.equal((await h.call("POST", "/v1/auth/reset", { body: { email: "mia@example.com", code: "000000x", password: "lemonade9" } })).status, 401);
  assert.equal((await h.call("POST", "/v1/auth/reset", { body: { email: "mia@example.com", code, password: "lemonade9" } })).status, 200);
  assert.equal((await h.call("GET", "/v1/me", { token })).status, 401);
  assert.equal((await h.call("POST", "/v1/auth/login", { body: { email: "mia@example.com", password: "lemonade9" } })).status, 200);
  assert.equal((await harness().call("POST", "/v1/auth/forgot", { body: { email: "a@b.de" } })).status, 503);
});

test("sign in with Apple creates one account, and links a guest instead of duplicating it", async () => {
  const h = harness();
  assert.equal((await h.call("POST", "/v1/auth/apple", { body: { identityToken: "bad" } })).status, 401);
  const guest = (await h.call("POST", "/v1/auth/anonymous", { body: {} })).body;
  const linked = await h.call("POST", "/v1/auth/apple", { token: guest.token, body: { identityToken: "good", name: "Mia" } });
  assert.equal(linked.body.user.id, guest.user.id);
  assert.equal(linked.body.user.email, "relay@privaterelay.appleid.com");
  const again = await h.call("POST", "/v1/auth/apple", { body: { identityToken: "good" } });
  assert.equal(again.body.user.id, guest.user.id);
});

test("an Apple token is only accepted when signed by Apple's key, for us, and unexpired", async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };
  const now = Date.parse("2026-10-30T12:00:00Z");
  const encode = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const sign = async (claims, key = privateKey) => {
    const head = `${encode({ alg: "RS256", kid: "k1" })}.${encode(claims)}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head));
    return `${head}.${base64url(new Uint8Array(signature))}`;
  };
  const keys = async () => ({ keys: [jwk] });
  const good = { iss: "https://appleid.apple.com", aud: "eu.eliasconrad.zest", sub: "s1", exp: now / 1000 + 60 };
  assert.deepEqual(await verifyAppleToken(await sign(good), "eu.eliasconrad.zest", keys, now), { sub: "s1", email: undefined });
  assert.equal(await verifyAppleToken(await sign({ ...good, aud: "other" }), "eu.eliasconrad.zest", keys, now), null);
  assert.equal(await verifyAppleToken(await sign({ ...good, exp: now / 1000 - 60 }), "eu.eliasconrad.zest", keys, now), null);
  const other = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  assert.equal(await verifyAppleToken(await sign(good, other.privateKey), "eu.eliasconrad.zest", keys, now), null);
});

test("the meal route is not swallowed by the /v1/me prefix", async () => {
  const request = new Request("https://zest.test/v1/meal", { method: "POST", body: "{}" });
  assert.equal(await handleAccount(request, new URL(request.url), {}), null);
  const ask = new Request("https://zest.test/v1/ask", { method: "POST", body: "{}" });
  assert.equal(await handleAccount(ask, new URL(ask.url), {}), null);
});

test("a failed scan does not cost one of the free scans", async () => {
  const db = database();
  db.sqlite.exec("INSERT INTO users (id, invite_code, created_at) VALUES ('u1', 'code1', 1)");
  const env = { DB: db, FREE_SCANS_PER_DAY: 1 };
  const user = { id: "u1", pro_until: 0 };
  const now = Date.UTC(2026, 9, 30);
  assert.equal((await spend(env, user, "scans", now)).allowed, true);
  assert.equal((await spend(env, user, "scans", now)).allowed, false);
  await refund(env, user, "scans", now);
  assert.equal((await spend(env, user, "scans", now)).allowed, true);
});
