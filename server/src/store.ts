/**
 * Verifies StoreKit 2 signed transactions (JWS). The certificate chain in the
 * header has to end at Apple Root CA G3, pinned by fingerprint; the leaf key
 * then has to have signed the payload.
 */
import { X509Certificate, createHash, createPublicKey, verify as nodeVerify } from "node:crypto";
import { fromBase64url } from "./auth.ts";

const APPLE_ROOT_G3_SHA256 =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";


export type Transaction = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
};

export function decodeJws<T>(jws: string): T {
  return JSON.parse(new TextDecoder().decode(fromBase64url(jws.split(".")[1])));
}

/** Throws unless the JWS is signed by a chain ending at Apple's root. Returns the payload. */
export function verifyAppleJws<T>(jws: string, rootFingerprint = APPLE_ROOT_G3_SHA256): T {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("jws shape");
  const header = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 2)
    throw new Error("jws header");
  const certificates = header.x5c.map((der: string) => new X509Certificate(Buffer.from(der, "base64")));
  const root = certificates[certificates.length - 1];
  const fingerprint = createHash("sha256").update(root.raw).digest("hex");
  if (fingerprint !== rootFingerprint) throw new Error("jws root");
  for (let i = 0; i < certificates.length - 1; i++) {
    if (!certificates[i].verify(certificates[i + 1].publicKey)) throw new Error("jws chain");
  }
  const leaf = createPublicKey(certificates[0].publicKey);
  const valid = nodeVerify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: leaf, dsaEncoding: "ieee-p1363" },
    Buffer.from(fromBase64url(parts[2])),
  );
  if (!valid) throw new Error("jws signature");
  return decodeJws<T>(jws);
}
