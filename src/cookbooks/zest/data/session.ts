/**
 * The account client: a session token kept in secure storage, a quiet guest
 * session when someone has not signed up, and every plain JSON call to the Worker.
 * Dependencies are injected, so tests run in Node.
 */
export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  inviteCode: string;
  pro: boolean;
  proUntil: number;
  hasPassword: boolean;
  apple: boolean;
};

export class AccountError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type SecureStorage = {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  remove: () => Promise<void>;
};

type Fetch = (url: string, init: RequestInit) => Promise<{ status: number; text: () => Promise<string> }>;

export function createSessionClient({
  base,
  appToken,
  secure,
  send,
}: {
  base: string;
  appToken?: string;
  secure: SecureStorage;
  send: Fetch;
}) {
  let token: string | null = null;
  let loaded = false;
  let user: SessionUser | null = null;
  let pendingGuest: Promise<string> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const load = async () => {
    if (loaded) return;
    // A keychain that refuses must not cost the session; it then lasts until the app closes.
    token = await secure.get().catch(() => null);
    loaded = true;
  };
  const adopt = async (result: { token: string; user: SessionUser }) => {
    token = result.token;
    user = result.user;
    await secure.set(result.token).catch(() => {});
    emit();
    return result.user;
  };
  const forget = async () => {
    token = null;
    user = null;
    await secure.remove();
    emit();
  };
  const raw = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let response: Awaited<ReturnType<Fetch>>;
    try {
      response = await send(`${base}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(appToken ? { "x-zest-token": appToken } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AccountError("offline", 0);
    }
    const text = await response.text();
    let parsed: { error?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON: the status alone has to do.
    }
    if (response.status >= 400) throw new AccountError(parsed?.error ?? "server", response.status);
    return parsed as T;
  };

  type Authed = { token: string; user: SessionUser };

  /** A token to call the model with; creates a guest the first time. */
  const ensure = async () => {
    await load();
    if (token) return token;
    pendingGuest ??= raw<Authed>("POST", "/v1/auth/anonymous", {})
      .then(adopt)
      .then(() => token as string)
      .finally(() => {
        pendingGuest = null;
      });
    return pendingGuest;
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    user: () => user,
    /** Signed up for real, not just a guest. */
    hasAccount: () => !!user?.email || !!user?.apple,
    ensure,
    /** The session died on the server; the next `ensure` starts over. */
    invalidate: forget,
    /** Reads the account behind a stored token, if there is one. */
    refresh: async () => {
      await load();
      if (!token) return null;
      try {
        const me = await raw<{ user: SessionUser; profile: Record<string, unknown> | null }>("GET", "/v1/me");
        user = me.user;
        emit();
        return me;
      } catch (error) {
        if (error instanceof AccountError && error.status === 401) await forget();
        return null;
      }
    },
    signup: async (fields: { email: string; password: string; name: string }) => {
      await load();
      return adopt(await raw<Authed>("POST", "/v1/auth/signup", fields));
    },
    login: async (fields: { email: string; password: string }) => {
      await load();
      return adopt(await raw<Authed>("POST", "/v1/auth/login", fields));
    },
    apple: async (fields: { identityToken: string; name?: string }) => {
      await load();
      return adopt(await raw<Authed>("POST", "/v1/auth/apple", fields));
    },
    forgot: (email: string) => raw<null>("POST", "/v1/auth/forgot", { email }),
    reset: async (fields: { email: string; code: string; password: string }) =>
      adopt(await raw<Authed>("POST", "/v1/auth/reset", fields)),
    logout: async () => {
      await raw<null>("POST", "/v1/auth/logout", {}).catch(() => null);
      await forget();
    },
    remove: async () => {
      await raw<null>("POST", "/v1/auth/delete", {});
      await forget();
    },
    update: async (fields: Record<string, unknown>) => {
      const result = await raw<{ user: SessionUser }>("PUT", "/v1/me", fields);
      user = result.user;
      emit();
      return result.user;
    },
    setPro: (pro: boolean, proUntil: number) => {
      if (user) user = { ...user, pro, proUntil };
      emit();
    },
    get: <T>(path: string) => raw<T>("GET", path),
    post: <T>(path: string, body: unknown = {}) => raw<T>("POST", path, body),
    put: <T>(path: string, body: unknown = {}) => raw<T>("PUT", path, body),
    del: <T>(path: string) => raw<T>("DELETE", path),
  };
}

export type SessionClient = ReturnType<typeof createSessionClient>;
