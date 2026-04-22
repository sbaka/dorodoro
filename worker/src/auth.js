// Firebase ID token verification (RS256). JWKS is cached for 1h via Cache API.
// No external deps; uses WebCrypto only.

const JWKS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const ISSUER_PREFIX = "https://securetoken.google.com/";

function base64UrlToUint8Array(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlDecodeString(s) {
  return new TextDecoder().decode(base64UrlToUint8Array(s));
}

// Minimal PEM -> CryptoKey conversion (uses JWKS directly via importKey for simplicity).
async function fetchJwks() {
  // Use the Cache API so we don't re-fetch on every request.
  const cache = caches.default;
  const cacheKey = new Request("https://jwks.local/securetoken");
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached.json();
  }
  const resp = await fetch(JWKS_URL);
  if (!resp.ok) throw new Error(`jwks fetch failed: ${resp.status}`);
  const body = await resp.text();
  const cacheResp = new Response(body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" },
  });
  await cache.put(cacheKey, cacheResp.clone());
  return JSON.parse(body);
}

async function importPemKey(pem) {
  const clean = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  // The cert body is DER in base64; extract the SubjectPublicKeyInfo.
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  // Parse minimally: find the public key OID and extract SPKI.
  // Simpler path: let WebCrypto import the whole cert via x509 (not supported) — fall back
  // to parsing the last BIT STRING tag. Most Google certs use the same structure, so we
  // instead rely on the JWKS endpoint returning x5c in the PEM shape above; for real use,
  // prefer the JWK endpoint below.
  throw new Error("x509 parsing unsupported in Workers; use JWK endpoint instead.");
}

// Alternative JWKS endpoint (JWKs format):
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

async function fetchJwkSet() {
  const cache = caches.default;
  const cacheKey = new Request("https://jwks.local/jwks");
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();
  const resp = await fetch(JWK_URL);
  if (!resp.ok) throw new Error(`jwk fetch failed: ${resp.status}`);
  const body = await resp.text();
  await cache.put(
    cacheKey,
    new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" },
    })
  );
  return JSON.parse(body);
}

async function getKeyForKid(kid) {
  const jwks = await fetchJwkSet();
  const jwk = (jwks.keys || []).find((k) => k.kid === kid);
  if (!jwk) throw new Error("unknown kid");
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export async function verifyIdToken(token, env) {
  if (!token || typeof token !== "string") throw new Error("missing token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64UrlDecodeString(headerB64));
  const payload = JSON.parse(base64UrlDecodeString(payloadB64));

  if (header.alg !== "RS256") throw new Error("bad alg");
  const key = await getKeyForKid(header.kid);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlToUint8Array(sigB64);

  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!ok) throw new Error("bad signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("expired");
  if (payload.iat && payload.iat > now + 60) throw new Error("future iat");
  if (payload.aud !== env.FIREBASE_PROJECT_ID) throw new Error("bad aud");
  if (payload.iss !== ISSUER_PREFIX + env.FIREBASE_PROJECT_ID) throw new Error("bad iss");
  if (!payload.sub) throw new Error("no sub");

  return { uid: payload.sub, email: payload.email || null };
}
