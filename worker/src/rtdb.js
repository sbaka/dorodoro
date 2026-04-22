// Firebase service-account OAuth2 token minting for admin RTDB REST access.
// Uses JWT Bearer grant (RS256-signed by the SA private key) to mint a short-lived
// access token with the correct scopes. Token is cached in a module variable.

let cachedToken = null;
let cachedExpiresAt = 0;

function b64url(bytes) {
  let s = "";
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function strToU8(s) {
  return new TextEncoder().encode(s);
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem) {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function getAdminAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExpiresAt - 60 > now) return cachedToken;

  const sa = JSON.parse(env.FIREBASE_SA_JSON);
  const scope = "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email";

  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encHeader = b64url(strToU8(JSON.stringify(header)));
  const encClaims = b64url(strToU8(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    strToU8(signingInput)
  );
  const assertion = `${signingInput}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" +
      encodeURIComponent(assertion),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`token exchange failed: ${resp.status} ${body}`);
  }
  const json = await resp.json();
  cachedToken = json.access_token;
  cachedExpiresAt = now + (json.expires_in || 3600);
  return cachedToken;
}

async function rtdbReq(env, path, method, body, opts = {}) {
  const token = await getAdminAccessToken(env);
  const qs = opts.query ? "?" + opts.query : "";
  const url = `${env.RTDB_URL}/${path}.json${qs}`;
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`rtdb ${method} ${path} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

// Atomic increment using a conditional PUT with ETag (Firebase REST supports
// `?print=silent` + retry-on-conflict semantics via `x-firebase-etag`).
// Simpler: we read-then-write with a small retry loop. Contention is rare.
export async function incrementCounter(env, path, max) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = (await rtdbReq(env, path, "GET")) || 0;
    if (typeof max === "number" && current >= max) {
      return { ok: false, count: current };
    }
    const next = Number(current) + 1;
    try {
      await rtdbReq(env, path, "PUT", next);
      return { ok: true, count: next };
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  return { ok: false, count: -1 };
}

export async function rtdbGet(env, path) {
  return rtdbReq(env, path, "GET");
}

export async function rtdbPut(env, path, value) {
  return rtdbReq(env, path, "PUT", value);
}

export async function rtdbPatch(env, path, value) {
  return rtdbReq(env, path, "PATCH", value);
}

export async function rtdbPush(env, path, value) {
  const res = await rtdbReq(env, path, "POST", value);
  return res && res.name ? res.name : null;
}
