/** Accounts, sync, usage limits, friends, purchases and remote config on D1. */
import {
  hashPassword,
  normalizeEmail,
  randomToken,
  sha256,
  validEmail,
  validPassword,
  verifyAppleToken,
  verifyPassword,
} from "./auth.ts";
import { verifyAppleJws, type Transaction } from "./store.ts";

export type AccountEnv = {
  DB: D1Database;
  ZEST_BUNDLE_ID: string;
  FREE_SCANS_PER_DAY?: string;
  FREE_ASKS_PER_DAY?: string;
  RESEND_API_KEY?: string;
  ZEST_MAIL_FROM?: string;
  EXPO_ACCESS_TOKEN?: string;
};

export type Deps = {
  now?: () => number;
  verifyApple?: typeof verifyAppleToken;
  verifyJws?: <T>(jws: string) => T;
  send?: typeof fetch;
};

const DAY_MS = 86_400_000;
const SESSION_MS = 30 * DAY_MS;
const SIGNUPS_PER_IP_PER_DAY = 20;

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export type User = {
  id: string;
  email: string | null;
  name: string;
  invite_code: string;
  pro_until: number;
  apple_sub: string | null;
  password_hash: string | null;
  last_log_day: string;
};

const publicUser = (user: User, now: number) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  inviteCode: user.invite_code,
  pro: user.pro_until > now,
  proUntil: user.pro_until,
  hasPassword: !!user.password_hash,
  apple: !!user.apple_sub,
});

async function createUser(
  db: D1Database,
  fields: { email?: string; passwordHash?: string; appleSub?: string; name?: string },
  now: number,
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO users (id, email, password_hash, apple_sub, name, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      fields.email ?? null,
      fields.passwordHash ?? null,
      fields.appleSub ?? null,
      fields.name ?? "",
      randomToken(6),
      now,
    )
    .run();
  return id;
}

async function createSession(db: D1Database, userId: string, now: number) {
  const token = randomToken();
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, now + SESSION_MS)
    .run();
  return token;
}

const getUser = (db: D1Database, id: string) =>
  db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();

/** The user behind a bearer token. Sliding expiry, written at most once a day. */
export async function authenticate(request: Request, db: D1Database, now: number) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: number }>();
  if (!session) return null;
  if (session.expires_at < now) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  if (session.expires_at - now < SESSION_MS - DAY_MS)
    await db
      .prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
      .bind(now + SESSION_MS, tokenHash)
      .run();
  const user = await getUser(db, session.user_id);
  return user ? { user, tokenHash } : null;
}

/** Counts one use and says whether it was allowed. Pro has no daily limit. */
export async function spend(
  env: AccountEnv,
  user: User,
  kind: "scans" | "asks",
  now: number,
): Promise<{ allowed: boolean; limit: number }> {
  const limit = Number(
    kind === "scans" ? (env.FREE_SCANS_PER_DAY ?? 3) : (env.FREE_ASKS_PER_DAY ?? 10),
  );
  const day = isoDay(now);
  const pro = user.pro_until > now;
  const row = await env.DB.prepare(`SELECT ${kind} AS used FROM usage WHERE user_id = ? AND day = ?`)
    .bind(user.id, day)
    .first<{ used: number }>();
  if (!pro && (row?.used ?? 0) >= limit) return { allowed: false, limit };
  await env.DB.prepare(
    `INSERT INTO usage (user_id, day, ${kind}) VALUES (?, ?, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET ${kind} = ${kind} + 1`,
  )
    .bind(user.id, day)
    .run();
  return { allowed: true, limit };
}

/** Gives a use back when the model failed; a scan that never came should not count. */
export async function refund(env: AccountEnv, user: User, kind: "scans" | "asks", now: number) {
  await env.DB.prepare(`UPDATE usage SET ${kind} = MAX(0, ${kind} - 1) WHERE user_id = ? AND day = ?`)
    .bind(user.id, isoDay(now))
    .run();
}

async function underSignupLimit(request: Request, db: D1Database, now: number) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await sha256(ip);
  const day = isoDay(now);
  const row = await db
    .prepare("SELECT count FROM signups_by_ip WHERE ip_hash = ? AND day = ?")
    .bind(ipHash, day)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= SIGNUPS_PER_IP_PER_DAY) return false;
  await db
    .prepare(
      "INSERT INTO signups_by_ip (ip_hash, day, count) VALUES (?, ?, 1) ON CONFLICT (ip_hash, day) DO UPDATE SET count = count + 1",
    )
    .bind(ipHash, day)
    .run();
  return true;
}

async function sendResetMail(env: AccountEnv, send: typeof fetch, email: string, code: string) {
  const response = await send("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.ZEST_MAIL_FROM ?? "Zest <hello@zest.app>",
      to: email,
      subject: `Your Zest code: ${code}`,
      text: `Your code is ${code}. It works for 15 minutes. If you did not ask for it, you can ignore this mail.`,
    }),
  });
  return response.ok;
}

async function notifyFriends(env: AccountEnv, send: typeof fetch, user: User) {
  const { results } = await env.DB.prepare(
    `SELECT d.token FROM friendships f
     JOIN friendships back ON back.user_id = f.friend_id AND back.friend_id = f.user_id
     JOIN devices d ON d.user_id = f.friend_id
     WHERE f.user_id = ? AND f.blocked = 0 AND back.blocked = 0`,
  )
    .bind(user.id)
    .all<{ token: string }>();
  if (!results.length) return;
  await send("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(
      results.map((row) => ({
        to: row.token,
        title: "Zest",
        body: `${user.name || "A friend"} logged today.`,
      })),
    ),
  }).catch(() => undefined);
}

/** Records a transaction on the user it belongs to and returns when Pro now ends. */
async function applyTransaction(env: AccountEnv, userId: string, transaction: Transaction, now: number) {
  const expires = transaction.revocationDate ? now - 1 : (transaction.expiresDate ?? 0);
  await env.DB.prepare(
    `INSERT INTO purchases (original_transaction_id, user_id, product_id, expires_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (original_transaction_id) DO UPDATE SET user_id = excluded.user_id, product_id = excluded.product_id, expires_at = excluded.expires_at`,
  )
    .bind(transaction.originalTransactionId, userId, transaction.productId, expires)
    .run();
  const best = await env.DB.prepare("SELECT MAX(expires_at) AS until FROM purchases WHERE user_id = ?")
    .bind(userId)
    .first<{ until: number }>();
  const until = best?.until ?? 0;
  await env.DB.prepare("UPDATE users SET pro_until = ? WHERE id = ?").bind(until, userId).run();
  return until;
}

/** Handles every account route; null when the path is not one of them. */
export async function handleAccount(
  request: Request,
  url: URL,
  env: AccountEnv,
  deps: Deps = {},
  waitUntil: (promise: Promise<unknown>) => void = () => {},
): Promise<Response | null> {
  const now = (deps.now ?? Date.now)();
  const db = env.DB;
  const send = deps.send ?? fetch;
  const path = url.pathname;
  const method = request.method;
  if (!path.startsWith("/v1/auth/") && path !== "/v1/me" && !path.startsWith("/v1/me/") && !path.startsWith("/v1/sync/") && !path.startsWith("/v1/friends") && !path.startsWith("/v1/purchase") && path !== "/v1/config" && path !== "/v1/appstore/notifications")
    return null;

  if (path === "/v1/config" && method === "GET") {
    const { results } = await db.prepare("SELECT key, value FROM config").all<{ key: string; value: string }>();
    return json(200, Object.fromEntries(results.map((row) => [row.key, row.value])));
  }

  let body: Record<string, unknown> = {};
  if (method !== "GET" && method !== "DELETE") {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: "json" });
    }
  }

  // App Store Server Notifications: Apple calls this, identified only by its signature.
  if (path === "/v1/appstore/notifications" && method === "POST") {
    const verify = deps.verifyJws ?? verifyAppleJws;
    try {
      const payload = verify<{ data?: { signedTransactionInfo?: string; bundleId?: string } }>(String(body.signedPayload));
      const info = payload.data?.signedTransactionInfo;
      if (!info) return json(200, { ok: true });
      const transaction = verify<Transaction>(info);
      if (transaction.bundleId !== env.ZEST_BUNDLE_ID) return json(400, { error: "bundle" });
      const owner = await db
        .prepare("SELECT user_id FROM purchases WHERE original_transaction_id = ?")
        .bind(transaction.originalTransactionId)
        .first<{ user_id: string }>();
      const userId = owner?.user_id ?? transaction.appAccountToken;
      if (userId && (await getUser(db, userId))) await applyTransaction(env, userId, transaction, now);
      return json(200, { ok: true });
    } catch {
      return json(400, { error: "signature" });
    }
  }

  if (method === "POST" && path === "/v1/auth/anonymous") {
    if (!(await underSignupLimit(request, db, now))) return json(429, { error: "too many" });
    const id = await createUser(db, {}, now);
    return json(201, { token: await createSession(db, id, now), user: publicUser((await getUser(db, id))!, now) });
  }

  if (method === "POST" && path === "/v1/auth/login") {
    const email = normalizeEmail(String(body.email ?? ""));
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
    // The same work and the same answer whether or not the address exists.
    const stored = user?.password_hash ?? "pbkdf2-sha256$100000$6$AAAAAAAAAAAAAAAAAAAAAA$AAAA";
    const valid = await verifyPassword(String(body.password ?? ""), stored);
    if (!user || !valid) return json(401, { error: "credentials" });
    return json(200, { token: await createSession(db, user.id, now), user: publicUser(user, now) });
  }

  if (method === "POST" && path === "/v1/auth/apple") {
    const verify = deps.verifyApple ?? verifyAppleToken;
    const claims = await verify(String(body.identityToken ?? ""), env.ZEST_BUNDLE_ID);
    if (!claims) return json(401, { error: "apple" });
    const name = typeof body.name === "string" ? body.name.slice(0, 80) : "";
    const email = claims.email ? normalizeEmail(claims.email) : undefined;
    let user = await db.prepare("SELECT * FROM users WHERE apple_sub = ?").bind(claims.sub).first<User>();
    const current = await authenticate(request, db, now);
    if (!user && current && !current.user.apple_sub) {
      // A guest or an e-mail account signs in with Apple: same account, nothing lost.
      await db
        .prepare("UPDATE users SET apple_sub = ?, email = COALESCE(email, ?), name = CASE WHEN name = '' THEN ? ELSE name END WHERE id = ?")
        .bind(claims.sub, email ?? null, name, current.user.id)
        .run();
      user = await getUser(db, current.user.id);
    }
    if (!user) {
      const taken = email
        ? await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
        : null;
      const id = await createUser(db, { appleSub: claims.sub, email: taken ? undefined : email, name }, now);
      user = await getUser(db, id);
    }
    return json(200, { token: await createSession(db, user!.id, now), user: publicUser(user!, now) });
  }

  if (method === "POST" && path === "/v1/auth/forgot") {
    const email = normalizeEmail(String(body.email ?? ""));
    if (!env.RESEND_API_KEY) return json(503, { error: "mail" });
    const user = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (user) {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      await db
        .prepare(
          `INSERT INTO reset_codes (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
           ON CONFLICT (user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
        )
        .bind(user.id, await sha256(code), now + 15 * 60_000)
        .run();
      await sendResetMail(env, send, email, code);
    }
    return json(204, null);
  }

  if (method === "POST" && path === "/v1/auth/reset") {
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    if (!validPassword(password)) return json(400, { error: "password" });
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
    const reset = user
      ? await db
          .prepare("SELECT code_hash, expires_at, attempts FROM reset_codes WHERE user_id = ?")
          .bind(user.id)
          .first<{ code_hash: string; expires_at: number; attempts: number }>()
      : null;
    if (!user || !reset || reset.expires_at < now || reset.attempts >= 5) return json(401, { error: "code" });
    if ((await sha256(String(body.code ?? ""))) !== reset.code_hash) {
      await db.prepare("UPDATE reset_codes SET attempts = attempts + 1 WHERE user_id = ?").bind(user.id).run();
      return json(401, { error: "code" });
    }
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), user.id),
      db.prepare("DELETE FROM reset_codes WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    ]);
    return json(200, { token: await createSession(db, user.id, now), user: publicUser(user, now) });
  }

  const session = await authenticate(request, db, now);

  if (method === "POST" && path === "/v1/auth/signup") {
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!validEmail(email)) return json(400, { error: "email" });
    if (!validPassword(password)) return json(400, { error: "password" });
    if (await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first())
      return json(409, { error: "taken" });
    const passwordHash = await hashPassword(password);
    if (session && !session.user.email) {
      // A guest keeps everything it logged, friends and Pro included.
      await db
        .prepare("UPDATE users SET email = ?, password_hash = ?, name = CASE WHEN ? = '' THEN name ELSE ? END WHERE id = ?")
        .bind(email, passwordHash, name, name, session.user.id)
        .run();
      return json(200, { token: await createSession(db, session.user.id, now), user: publicUser((await getUser(db, session.user.id))!, now) });
    }
    if (!(await underSignupLimit(request, db, now))) return json(429, { error: "too many" });
    const id = await createUser(db, { email, passwordHash, name }, now);
    return json(201, { token: await createSession(db, id, now), user: publicUser((await getUser(db, id))!, now) });
  }

  if (!session) return json(401, { error: "session" });
  const user = session.user;

  if (method === "POST" && path === "/v1/auth/logout") {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
    return json(204, null);
  }

  if (method === "POST" && path === "/v1/auth/delete") {
    await db.batch([
      db.prepare("DELETE FROM friendships WHERE user_id = ? OR friend_id = ?").bind(user.id, user.id),
      db.prepare("DELETE FROM devices WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM log_days WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM purchases WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM reset_codes WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM usage WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM meals WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    ]);
    return json(204, null);
  }

  if (path === "/v1/me" && method === "GET") {
    const profile = await db
      .prepare("SELECT data, updated_at FROM profiles WHERE user_id = ?")
      .bind(user.id)
      .first<{ data: string; updated_at: number }>();
    return json(200, {
      user: publicUser(user, now),
      profile: profile ? JSON.parse(profile.data) : null,
      profileUpdatedAt: profile?.updated_at ?? 0,
    });
  }

  if (path === "/v1/me" && method === "PUT") {
    const updates: D1PreparedStatement[] = [];
    if (body.profile && typeof body.profile === "object") {
      const { password: _never, ...profile } = body.profile as Record<string, unknown>;
      updates.push(
        db
          .prepare(
            `INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          )
          .bind(user.id, JSON.stringify(profile), now),
      );
    }
    if (typeof body.name === "string")
      updates.push(db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(body.name.trim().slice(0, 80), user.id));
    if (typeof body.email === "string") {
      const email = normalizeEmail(body.email);
      if (!validEmail(email)) return json(400, { error: "email" });
      if (email !== user.email && (await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()))
        return json(409, { error: "taken" });
      updates.push(db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, user.id));
    }
    if (typeof body.password === "string") {
      if (!validPassword(body.password)) return json(400, { error: "password" });
      if (user.password_hash && !(await verifyPassword(String(body.currentPassword ?? ""), user.password_hash)))
        return json(401, { error: "credentials" });
      updates.push(db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(body.password), user.id));
    }
    if (updates.length) await db.batch(updates);
    return json(200, { user: publicUser((await getUser(db, user.id))!, now) });
  }

  if (path === "/v1/me/day" && method === "POST") {
    if (!isDay(body.day)) return json(400, { error: "day" });
    const first = user.last_log_day !== body.day;
    await db.batch([
      db
        .prepare("UPDATE users SET streak = ?, last_log_day = ?, today_total = ? WHERE id = ?")
        .bind(Math.max(0, Number(body.streak) || 0), body.day, Math.max(0, Number(body.total) || 0), user.id),
      db.prepare("INSERT OR IGNORE INTO log_days (user_id, day) VALUES (?, ?)").bind(user.id, body.day),
    ]);
    if (first) waitUntil(notifyFriends(env, send, user));
    return json(200, { ok: true });
  }

  if (path === "/v1/me/device" && method === "POST") {
    if (typeof body.token !== "string" || !body.token) return json(400, { error: "token" });
    await db
      .prepare("INSERT INTO devices (token, user_id) VALUES (?, ?) ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id")
      .bind(body.token, user.id)
      .run();
    return json(200, { ok: true });
  }

  if (path === "/v1/sync/meals" && method === "POST") {
    const meals = Array.isArray(body.meals) ? (body.meals as { id: string; updatedAt: number; deleted?: boolean; data?: unknown }[]) : [];
    const since = Number(body.since) || 0;
    const statements = meals
      .filter((meal) => typeof meal?.id === "string" && Number.isFinite(meal.updatedAt))
      .slice(0, 500)
      .map((meal) =>
        db
          .prepare(
            `INSERT INTO meals (user_id, id, data, deleted, updated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at
             WHERE excluded.updated_at > meals.updated_at`,
          )
          .bind(user.id, meal.id, JSON.stringify(meal.data ?? {}), meal.deleted ? 1 : 0, meal.updatedAt),
      );
    if (statements.length) await db.batch(statements);
    const { results } = await db
      .prepare("SELECT id, data, deleted, updated_at FROM meals WHERE user_id = ? AND updated_at > ?")
      .bind(user.id, since)
      .all<{ id: string; data: string; deleted: number; updated_at: number }>();
    return json(200, {
      meals: results.map((row) => ({ id: row.id, data: JSON.parse(row.data), deleted: !!row.deleted, updatedAt: row.updated_at })),
      serverTime: now,
    });
  }

  if (path === "/v1/purchase" && method === "POST") {
    const verify = deps.verifyJws ?? verifyAppleJws;
    let transaction: Transaction;
    try {
      transaction = verify<Transaction>(String(body.jws));
    } catch {
      return json(400, { error: "signature" });
    }
    if (transaction.bundleId !== env.ZEST_BUNDLE_ID) return json(400, { error: "bundle" });
    const until = await applyTransaction(env, user.id, transaction, now);
    return json(200, { pro: until > now, proUntil: until });
  }

  if (path === "/v1/friends" && method === "GET") {
    const day = isDay(url.searchParams.get("day")) ? url.searchParams.get("day")! : isoDay(now);
    const weekAgo = isoDay(Date.parse(`${day}T12:00:00Z`) - 6 * DAY_MS);
    const yesterday = isoDay(Date.parse(`${day}T12:00:00Z`) - DAY_MS);
    const { results } = await db
      .prepare(
        `SELECT u.id, u.name, u.streak, u.last_log_day, u.today_total, f.share_total AS i_share, back.share_total AS they_share,
           (SELECT COUNT(*) FROM log_days l WHERE l.user_id = u.id AND l.day BETWEEN ? AND ?) AS week_days
         FROM friendships f
         JOIN friendships back ON back.user_id = f.friend_id AND back.friend_id = f.user_id
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ? AND f.blocked = 0 AND back.blocked = 0`,
      )
      .bind(weekAgo, day, user.id)
      .all<{ id: string; name: string; streak: number; last_log_day: string; today_total: number; i_share: number; they_share: number; week_days: number }>();
    return json(200, {
      inviteCode: user.invite_code,
      friends: results.map((row) => {
        const loggedToday = row.last_log_day === day;
        return {
          id: row.id,
          name: row.name || "A friend",
          streak: loggedToday || row.last_log_day === yesterday ? row.streak : 0,
          loggedToday,
          weekDays: row.week_days,
          sharingMine: !!row.i_share,
          total: row.they_share && loggedToday ? row.today_total : null,
        };
      }),
    });
  }

  if (path === "/v1/friends/accept" && method === "POST") {
    const friend = await db
      .prepare("SELECT id, name FROM users WHERE invite_code = ?")
      .bind(String(body.code ?? ""))
      .first<{ id: string; name: string }>();
    if (!friend) return json(404, { error: "code" });
    if (friend.id === user.id) return json(400, { error: "self" });
    const blocked = await db
      .prepare("SELECT blocked FROM friendships WHERE user_id = ? AND friend_id = ? AND blocked = 1")
      .bind(friend.id, user.id)
      .first();
    if (blocked) return json(404, { error: "code" });
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)").bind(user.id, friend.id, now),
      db.prepare("INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)").bind(friend.id, user.id, now),
    ]);
    return json(200, { id: friend.id, name: friend.name || "A friend" });
  }

  const friendRoute = /^\/v1\/friends\/([^/]+)(\/block)?$/.exec(path);
  if (friendRoute) {
    const friendId = decodeURIComponent(friendRoute[1]);
    if (method === "DELETE" && !friendRoute[2]) {
      await db.batch([
        db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").bind(user.id, friendId),
        db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").bind(friendId, user.id),
      ]);
      return json(204, null);
    }
    if (method === "POST" && friendRoute[2]) {
      await db
        .prepare(
          `INSERT INTO friendships (user_id, friend_id, blocked, created_at) VALUES (?, ?, 1, ?)
           ON CONFLICT (user_id, friend_id) DO UPDATE SET blocked = 1`,
        )
        .bind(user.id, friendId, now)
        .run();
      return json(204, null);
    }
    if (method === "PUT" && !friendRoute[2]) {
      await db
        .prepare("UPDATE friendships SET share_total = ? WHERE user_id = ? AND friend_id = ?")
        .bind(body.shareTotal ? 1 : 0, user.id, friendId)
        .run();
      return json(204, null);
    }
  }

  return json(404, { error: "route" });
}

