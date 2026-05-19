"use client";

import Link from "next/link";
import { useMemo } from "react";

import { WeeklyFocusChart } from "@/app/components/weekly-focus-chart";
import { useSettings } from "@/lib/settings/use-settings";
import { useCompletedSessions } from "@/lib/analytics/use-completed-sessions";
import {
  computeKpis,
  formatHour,
  formatMinutes,
  type LoadedSession,
} from "@/lib/analytics/kpis";

function parseGoal(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

function todayHeadline(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function sessionTime(session: LoadedSession): string {
  const t = Date.parse(session.date);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DashboardView() {
  const { settings, status: settingsStatus } = useSettings();
  const { sessions, status: sessionsStatus, error } = useCompletedSessions();

  const goal = parseGoal(settings["Daily Goal"]);
  const kpis = useMemo(() => computeKpis(sessions, goal), [sessions, goal]);

  const isLoading =
    settingsStatus === "loading" || sessionsStatus === "loading";

  const goalRatio = kpis.goal
    ? Math.min(1, kpis.todayPomos / kpis.goal)
    : 0;
  const goalPct = Math.round(goalRatio * 100);
  const remainingGoal = Math.max(kpis.goal - kpis.todayPomos, 0);
  const hasWeeklyFocus = kpis.dailyFocusMin.some((minutes) => minutes > 0);
  const hasData = kpis.hasAnyData;

  return (
    <div className="dashboard-shell">
      {error ? (
        <p className="settings-notice settings-notice--error">
          Couldn&apos;t load your analytics: {error.message}
        </p>
      ) : null}

      {!isLoading ? (
        <section className="dash-empty-hero surface-card">
          <div className="dash-empty-text">
            <p
              className={`dash-eyebrow ${hasData ? "" : "dash-eyebrow--green"}`.trim()}
            >
              {hasData ? "Your focus dashboard" : "Fresh board"}
            </p>
            <p className="dash-kicker">Welcome back · {todayHeadline()}</p>
            <h1>
              {hasData
                ? remainingGoal === 0
                  ? "Daily target cleared. Keep the streak going."
                  : `${remainingGoal} pomodoro${remainingGoal === 1 ? "" : "s"} left for today.`
                : "Start with one 25-minute sprint."}
            </h1>
            <p>
              {hasData
                ? kpis.todayPomos === 0
                  ? "Your stats are ready. One focused block gets the board moving again."
                  : `${kpis.todayPomos} session${kpis.todayPomos === 1 ? " is" : "s are"} already in the log today.`
                : "Log a session and this page turns into your weekly snapshot."}
            </p>
            <ul className="dash-empty-points">
              {hasData ? (
                <>
                  <li>{kpis.todayPomos} today</li>
                  <li>{kpis.weekPomos} this week</li>
                  <li>{kpis.currentStreak} day streak</li>
                </>
              ) : (
                <>
                  <li>One task</li>
                  <li>25 min focus</li>
                  <li>5 min reset</li>
                </>
              )}
            </ul>
          </div>

          <div className="dash-empty-actions">
            <div className="dash-empty-goal">
              <span className="dash-empty-goal-label">
                {hasData ? "Today's progress" : "Today's target"}
              </span>
              <strong>
                {hasData
                  ? `${kpis.todayPomos}/${kpis.goal}`
                  : `${kpis.goal} pomo${kpis.goal === 1 ? "" : "s"}`}
              </strong>
              <small>
                {remainingGoal === 0
                  ? "You already hit it. Add another round if you want."
                  : hasData
                    ? `${remainingGoal} more to close the day strong.`
                    : `${remainingGoal} more and your dashboard starts moving.`}
              </small>
            </div>

            <Link href="/start" className="primary-pill dash-cta">
              {hasData ? "Start next session" : "Start a 25-min session"}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid">
        <article className="kpi-card kpi-goal">
          <div
            className="kpi-ring"
            role="img"
            aria-label={`Daily goal progress: ${kpis.todayPomos} of ${kpis.goal} pomodoros`}
            style={
              {
                ["--goal-progress" as string]: `${goalPct}%`,
              } as React.CSSProperties
            }
          >
            <div className="kpi-ring-label">
              <span className="kpi-ring-count">{kpis.todayPomos}</span>
              <small>
                of <span>{kpis.goal}</span>
              </small>
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Today&apos;s goal</p>
            <h3>
              {kpis.todayPomos} / {kpis.goal} pomodoros
            </h3>
            <p className="kpi-sub">
              {kpis.todayPomos >= kpis.goal
                ? "Goal reached — nice work."
                : kpis.hasAnyData
                  ? `${kpis.goal - kpis.todayPomos} to go today.`
                  : "Start your first session of the day."}
            </p>
          </div>
        </article>

        <article className="kpi-card kpi-card--focus">
          <p className="kpi-label">Today focus time</p>
          <h2 className="kpi-value">
            {kpis.todayFocusMin ? formatMinutes(kpis.todayFocusMin) : "—"}
          </h2>
          <p className="kpi-sub">
            {kpis.todayPomos === 0
              ? "Nothing logged today yet"
              : `${kpis.todayPomos} pomodoro${kpis.todayPomos === 1 ? "" : "s"} completed`}
          </p>
        </article>

        <article className="kpi-card kpi-card--week">
          <p className="kpi-label">This week</p>
          <h2 className="kpi-value">
            {kpis.weekFocusMin ? formatMinutes(kpis.weekFocusMin) : "—"}
          </h2>
          <p className="kpi-sub">
            {kpis.weekPomos === 0
              ? "No pomodoros this week yet"
              : `${kpis.weekPomos} pomodoro${kpis.weekPomos === 1 ? "" : "s"} this week`}
          </p>
        </article>

        <article className="kpi-card kpi-streak">
          <p className="kpi-label">Current streak</p>
          <h2 className="kpi-value">
            <span aria-hidden="true">🔥</span> {kpis.currentStreak}{" "}
            <small>days</small>
          </h2>
          <p className="kpi-sub">Longest: {kpis.longestStreak} days</p>
        </article>
      </section>

      <section className="dash-columns">
        <article className="surface-card dash-chart-card">
          <header className="dash-card-header">
            <h3>Last 7 days</h3>
            <p>Focused minutes by day.</p>
          </header>
          <div className="chart-wrap">
            {hasWeeklyFocus ? (
              <WeeklyFocusChart
                labels={kpis.dailyLabels}
                minutes={kpis.dailyFocusMin}
              />
            ) : (
              <div className="chart-empty">
                <p>No sessions yet.</p>
                <small>Finish one to plot your week.</small>
              </div>
            )}
          </div>
        </article>

        <article className="surface-card dash-stats-card">
          <header className="dash-card-header">
            <h3>At a glance</h3>
          </header>
          <ul className="mini-stats">
            <li>
              <span className="mini-label">Avg session</span>
              <span className="mini-value">
                {kpis.avgSessionMin
                  ? formatMinutes(kpis.avgSessionMin)
                  : "—"}
              </span>
            </li>
            <li>
              <span className="mini-label">Sessions completed</span>
              <span className="mini-value">{kpis.sessionsCompleted}</span>
            </li>
            <li>
              <span className="mini-label">Best focus hour</span>
              <span className="mini-value">
                {kpis.bestHour === null ? "—" : formatHour(kpis.bestHour)}
              </span>
            </li>
            <li>
              <span className="mini-label">All-time focus</span>
              <span className="mini-value">
                {formatMinutes(kpis.allTimeFocusMin)}
              </span>
            </li>
            <li>
              <span className="mini-label">All-time pomos</span>
              <span className="mini-value">{kpis.allTimePomos}</span>
            </li>
          </ul>
        </article>
      </section>

      {kpis.recent.length > 0 ? (
        <section className="surface-card dash-recent-card">
          <header className="dash-card-header">
            <h3>Recent sessions</h3>
            <p>Your last 10 completed sessions.</p>
          </header>
          <ul className="recent-list">
            {kpis.recent.map((s) => (
              <li key={s.id} className="recent-item">
                <div className="recent-main">
                  <span className="recent-subject">
                    {s.completedPomos} pomo
                    {s.completedPomos === 1 ? "" : "s"}
                  </span>
                  <span className="recent-meta">
                    {formatMinutes(s.duration)} · {sessionTime(s)}
                  </span>
                </div>
                <span className="badge badge-ok">
                  {s.completedPomos}/{s.totalPomos}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
