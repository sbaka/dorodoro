// Rate limiting backed by RTDB admin writes.
// Ordering: cooldown -> user daily -> user monthly -> global daily.
// Exposes check(uid) that increments all counters and returns { ok, reason, retryAfter }.
// Provides rollback(uid, stamp) to decrement on upstream 5xx.

import { rtdbGet, rtdbPut, incrementCounter } from "./rtdb.js";

const COOLDOWN_MS = 3000;
const USER_DAILY_MAX = 50;
const USER_MONTHLY_MAX = 500;
const GLOBAL_DAILY_MAX = 1000;

function ymd(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function ym(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function check(env, uid) {
  const now = Date.now();
  const dayKey = ymd(now);
  const monthKey = ym(now);

  const lastPath = `aiLimits/users/${uid}/lastRequestAt`;
  const last = (await rtdbGet(env, lastPath)) || 0;
  if (now - last < COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", retryAfter: Math.ceil((COOLDOWN_MS - (now - last)) / 1000) };
  }

  // User daily
  const userDaily = await incrementCounter(env, `aiLimits/users/${uid}/daily/${dayKey}/count`, USER_DAILY_MAX);
  if (!userDaily.ok) {
    return { ok: false, reason: "user_daily", limit: USER_DAILY_MAX, retryAfter: secondsToMidnightUTC(now) };
  }

  // User monthly
  const userMonthly = await incrementCounter(env, `aiLimits/users/${uid}/monthly/${monthKey}/count`, USER_MONTHLY_MAX);
  if (!userMonthly.ok) {
    // Rollback daily
    await incrementCounter(env, `aiLimits/users/${uid}/daily/${dayKey}/count`, null).catch(() => {});
    await decrement(env, `aiLimits/users/${uid}/daily/${dayKey}/count`);
    return { ok: false, reason: "user_monthly", limit: USER_MONTHLY_MAX };
  }

  // Global daily
  const global = await incrementCounter(env, `aiLimits/global/${dayKey}/count`, GLOBAL_DAILY_MAX);
  if (!global.ok) {
    await decrement(env, `aiLimits/users/${uid}/daily/${dayKey}/count`);
    await decrement(env, `aiLimits/users/${uid}/monthly/${monthKey}/count`);
    return { ok: false, reason: "global_cap", retryAfter: secondsToMidnightUTC(now) };
  }

  await rtdbPut(env, lastPath, now);

  return {
    ok: true,
    stamp: { uid, dayKey, monthKey },
    quota: {
      userDaily: userDaily.count,
      userDailyMax: USER_DAILY_MAX,
      userMonthly: userMonthly.count,
      userMonthlyMax: USER_MONTHLY_MAX,
      globalDaily: global.count,
      globalDailyMax: GLOBAL_DAILY_MAX,
    },
  };
}

export async function rollback(env, stamp) {
  if (!stamp) return;
  const { uid, dayKey, monthKey } = stamp;
  await Promise.all([
    decrement(env, `aiLimits/users/${uid}/daily/${dayKey}/count`),
    decrement(env, `aiLimits/users/${uid}/monthly/${monthKey}/count`),
    decrement(env, `aiLimits/global/${dayKey}/count`),
  ]).catch(() => {});
}

export async function quota(env, uid) {
  const dayKey = ymd();
  const monthKey = ym();
  const [ud, um, gd] = await Promise.all([
    rtdbGet(env, `aiLimits/users/${uid}/daily/${dayKey}/count`),
    rtdbGet(env, `aiLimits/users/${uid}/monthly/${monthKey}/count`),
    rtdbGet(env, `aiLimits/global/${dayKey}/count`),
  ]);
  return {
    userDaily: ud || 0,
    userDailyMax: USER_DAILY_MAX,
    userMonthly: um || 0,
    userMonthlyMax: USER_MONTHLY_MAX,
    globalDaily: gd || 0,
    globalDailyMax: GLOBAL_DAILY_MAX,
  };
}

async function decrement(env, path) {
  const cur = (await rtdbGet(env, path)) || 0;
  const next = Math.max(0, Number(cur) - 1);
  await rtdbPut(env, path, next);
}

function secondsToMidnightUTC(now) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  return Math.ceil((next - now) / 1000);
}
