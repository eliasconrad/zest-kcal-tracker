/** Password hashing, session tokens and Sign in with Apple, on WebCrypto only. */

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string) {
  const plain = atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "="));
  return Uint8Array.from(plain, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
}

/**
 * Workers cap one PBKDF2 call at 100,000 iterations and have no Argon2. Six
 * chained calls cost an attacker the 600,000 iterations OWASP asks for.
 * The stored string names its parameters, so they can rise later.
 */
const ITERATIONS = 100_000;
const ROUNDS = 6;

async function stretch(password: string, salt: Uint8Array, iterations: number, rounds: number) {
  let material: Uint8Array = encoder.encode(password);
  for (let round = 0; round < rounds; round++) {
    const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    material = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256),
    );
  }
  return base64url(material);
}

export async function hashPassword(password: string, rounds = ROUNDS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${rounds}$${base64url(salt)}$${await stretch(password, salt, ITERATIONS, rounds)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, rounds, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !hash) return false;
  const candidate = await stretch(password, fromBase64url(salt), Number(iterations), Number(rounds));
  if (candidate.length !== hash.length) return false;
  let difference = 0;
  for (let i = 0; i < hash.length; i++) difference |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return difference === 0;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
export const validPassword = (password: string) => password.length >= 8 && password.length <= 200;

type Jwk = JsonWebKey & { kid?: string };

/** Verifies an Apple identity token against Apple's published keys; returns its claims or null. */
export async function verifyAppleToken(
  token: string,
  audience: string,
  fetchKeys: () => Promise<{ keys: Jwk[] }> = async () =>
    (await fetch("https://appleid.apple.com/auth/keys")).json(),
  now = Date.now(),
): Promise<{ sub: string; email?: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(fromBase64url(parts[0])));
    const claims = JSON.parse(decoder.decode(fromBase64url(parts[1])));
    if (header.alg !== "RS256") return null;
    if (claims.iss !== "https://appleid.apple.com" || claims.aud !== audience) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < now || typeof claims.sub !== "string") return null;
    const jwk = (await fetchKeys()).keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      fromBase64url(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? { sub: claims.sub, email: claims.email } : null;
  } catch {
    return null;
  }
}
