import type { CompletedSessionRecord } from "@/lib/analytics/completed-sessions";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LoadedSession = CompletedSessionRecord & { id: string };

export type DashboardKpis = {
  hasAnyData: boolean;
  goal: number;
  todayPomos: number;
  todayFocusMin: number;
  weekPomos: number;
  weekFocusMin: number;
  allTimePomos: number;
  allTimeFocusMin: number;
  sessionsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  avgSessionMin: number;
  bestHour: number | null;
  bestHourCount: number;
  dailyLabels: string[];
  dailyFocusMin: number[];
  hourBuckets: number[];
  recent: LoadedSession[];
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short" });
}

function timestampOf(session: LoadedSession): number {
  const t = Date.parse(session.date);
  return Number.isFinite(t) ? t : 0;
}

export function formatMinutes(totalMin: number): string {
  if (!totalMin || totalMin <= 0) return "0m";
  const m = Math.round(totalMin);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

export function computeKpis(
  sessions: LoadedSession[],
  goal: number,
  now: number = Date.now(),
): DashboardKpis {
  const todayStart = startOfDay(now);
  const weekStart = todayStart - 6 * DAY_MS;
  const monthStart = todayStart - 29 * DAY_MS;

  const dailyLabels: string[] = [];
  const dailyFocusMin = new Array<number>(7).fill(0);
  for (let i = 0; i < 7; i++) {
    dailyLabels.push(dateLabel(weekStart + i * DAY_MS));
  }

  const hourBuckets = new Array<number>(24).fill(0);
  const dayPomoCount = new Map<number, number>();

  let todayPomos = 0;
  let todayFocusMin = 0;
  let weekPomos = 0;
  let weekFocusMin = 0;
  let allTimePomos = 0;
  let allTimeFocusMin = 0;

  for (const s of sessions) {
    const ts = timestampOf(s);
    if (!ts) continue;
    const pomos = Math.max(0, Math.floor(s.completedPomos || 0));
    const mins = Math.max(0, Math.floor(s.duration || 0));

    allTimePomos += pomos;
    allTimeFocusMin += mins;

    const dayStart = startOfDay(ts);
    dayPomoCount.set(dayStart, (dayPomoCount.get(dayStart) ?? 0) + pomos);

    if (ts >= todayStart) {
      todayPomos += pomos;
      todayFocusMin += mins;
    }
    if (ts >= weekStart) {
      weekPomos += pomos;
      weekFocusMin += mins;
      const idx = Math.floor((dayStart - weekStart) / DAY_MS);
      if (idx >= 0 && idx < 7) dailyFocusMin[idx] += mins;
    }
    if (ts >= monthStart && pomos > 0) {
      const h = new Date(ts).getHours();
      hourBuckets[h] += pomos;
    }
  }

  let bestHour: number | null = null;
  let bestHourCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > bestHourCount) {
      bestHourCount = hourBuckets[h];
      bestHour = h;
    }
  }

  const daysWithPomo = new Set<number>();
  for (const [day, count] of dayPomoCount.entries()) {
    if (count > 0) daysWithPomo.add(day);
  }

  let currentStreak = 0;
  let cursor = todayStart;
  if (!daysWithPomo.has(cursor)) cursor = todayStart - DAY_MS;
  while (daysWithPomo.has(cursor)) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }

  const sortedDays = [...daysWithPomo].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sortedDays) {
    if (prev !== null && d - prev === DAY_MS) run += 1;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  const sessionsCompleted = sessions.length;
  const avgSessionMin = sessionsCompleted
    ? allTimeFocusMin / sessionsCompleted
    : 0;

  const recent = [...sessions]
    .sort((a, b) => timestampOf(b) - timestampOf(a))
    .slice(0, 10);

  return {
    hasAnyData: sessions.length > 0,
    goal,
    todayPomos,
    todayFocusMin,
    weekPomos,
    weekFocusMin,
    allTimePomos,
    allTimeFocusMin,
    sessionsCompleted,
    currentStreak,
    longestStreak,
    avgSessionMin,
    bestHour,
    bestHourCount,
    dailyLabels,
    dailyFocusMin,
    hourBuckets,
    recent,
  };
}
