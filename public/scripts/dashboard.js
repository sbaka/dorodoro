/**
 * DoroDoro Dashboard
 * Renders KPIs on home.html for signed-in users.
 * Reads session events via window.Analytics.fetchEvents.
 */
(function (global) {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;

  let chart = null;
  let currentUser = null;
  let liveRef = null;

  function $(id) {
    return document.getElementById(id);
  }

  function fmtMinutes(totalSec) {
    const m = Math.round((totalSec || 0) / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function dateLabel(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      weekday: "short",
    });
  }

  function loadGoal() {
    try {
      const raw = localStorage.getItem("settings");
      if (!raw) return 4;
      const s = JSON.parse(raw);
      const n = parseInt(s["Daily Goal"], 10);
      return Number.isFinite(n) && n > 0 ? n : 4;
    } catch (_) {
      return 4;
    }
  }

  function computeKpis(events, goal) {
    const now = Date.now();
    const todayStart = startOfDay(now);
    const weekStart = todayStart - 6 * DAY_MS;
    const monthStart = todayStart - 29 * DAY_MS;

    const pomos = events.filter((e) => e.type === "pomo");
    const completedPomos = pomos.filter((e) => e.completed);
    const skippedPomos = pomos.filter((e) => e.skipped);

    const sumFocus = (arr) => arr.reduce((s, e) => s + (e.actualSec || 0), 0);

    const today = completedPomos.filter((e) => e.startedAt >= todayStart);
    const week = completedPomos.filter((e) => e.startedAt >= weekStart);

    // Per-day buckets for the last 7 days
    const dailyFocus = new Array(7).fill(0);
    const dailyLabels = new Array(7);
    for (let i = 0; i < 7; i++) {
      const ts = weekStart + i * DAY_MS;
      dailyLabels[i] = dateLabel(ts);
    }
    for (const ev of week) {
      const idx = Math.floor((startOfDay(ev.startedAt) - weekStart) / DAY_MS);
      if (idx >= 0 && idx < 7) dailyFocus[idx] += ev.actualSec || 0;
    }

    // Hour-of-day buckets over last 30 days (for heatmap + best hour)
    const hourBuckets = new Array(24).fill(0);
    const month = completedPomos.filter((e) => e.startedAt >= monthStart);
    for (const ev of month) {
      const h = new Date(ev.startedAt).getHours();
      hourBuckets[h] += 1;
    }
    let bestHour = -1;
    let bestHourCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h] > bestHourCount) {
        bestHourCount = hourBuckets[h];
        bestHour = h;
      }
    }

    // Streak: consecutive days (ending today or yesterday) with >= 1 completed pomo
    const daysWithPomo = new Set(
      completedPomos.map((e) => startOfDay(e.startedAt))
    );
    let currentStreak = 0;
    let cursor = todayStart;
    if (!daysWithPomo.has(cursor)) {
      // allow grace: if nothing today but yesterday had one, start from yesterday
      cursor = todayStart - DAY_MS;
    }
    while (daysWithPomo.has(cursor)) {
      currentStreak += 1;
      cursor -= DAY_MS;
    }

    // Longest streak: walk sorted unique days
    const sortedDays = [...daysWithPomo].sort((a, b) => a - b);
    let longestStreak = 0;
    let run = 0;
    let prev = null;
    for (const d of sortedDays) {
      if (prev !== null && d - prev === DAY_MS) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longestStreak) longestStreak = run;
      prev = d;
    }

    const totalTried = completedPomos.length + skippedPomos.length;
    const completionRate = totalTried
      ? Math.round((completedPomos.length / totalTried) * 100)
      : null;

    const avgSec = completedPomos.length
      ? sumFocus(completedPomos) / completedPomos.length
      : 0;

    return {
      goal,
      todayFocusSec: sumFocus(today),
      todayPomos: today.length,
      weekFocusSec: sumFocus(week),
      weekPomos: week.length,
      allTimeFocusSec: sumFocus(completedPomos),
      allTimePomos: completedPomos.length,
      currentStreak,
      longestStreak,
      avgSec,
      completionRate,
      bestHour,
      bestHourCount,
      dailyFocus,
      dailyLabels,
      hourBuckets,
      recent: events.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 10),
    };
  }

  function render(kpis) {
    const totalEvents =
      (kpis.allTimePomos || 0) +
      (kpis.recent ? kpis.recent.length : 0);
    const hasAnyData = kpis.allTimePomos > 0 || (kpis.recent && kpis.recent.length > 0);

    // First-run empty hero replaces the data-heavy sections
    toggleEmptyHero(!hasAnyData);

    // Greeting date
    const dateEl = $("dash-date");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }

    // Goal ring
    const goalCount = Math.min(kpis.todayPomos, kpis.goal);
    const pct = kpis.goal ? Math.min(1, kpis.todayPomos / kpis.goal) : 0;
    const ring = $("goal-ring");
    if (ring) {
      const r = 52;
      const circ = 2 * Math.PI * r;
      ring.setAttribute("stroke-dasharray", `${circ}`);
      ring.setAttribute("stroke-dashoffset", `${circ * (1 - pct)}`);
    }
    setText("goal-count", kpis.todayPomos);
    setText("goal-target", kpis.goal);
    setText(
      "goal-headline",
      `${kpis.todayPomos} / ${kpis.goal} pomodoros`
    );
    setText(
      "goal-sub",
      kpis.todayPomos >= kpis.goal
        ? "Goal reached — nice work."
        : hasAnyData
        ? `${kpis.goal - kpis.todayPomos} to go today.`
        : "Your daily target will track here."
    );

    // KPI cards
    setText("today-focus", kpis.todayFocusSec ? fmtMinutes(kpis.todayFocusSec) : "—");
    setText(
      "today-pomos-sub",
      kpis.todayPomos === 0
        ? "Nothing logged today yet"
        : `${kpis.todayPomos} pomodoro${kpis.todayPomos === 1 ? "" : "s"} completed`
    );
    setText("week-focus", kpis.weekFocusSec ? fmtMinutes(kpis.weekFocusSec) : "—");
    setText(
      "week-pomos-sub",
      kpis.weekPomos === 0
        ? "No pomodoros this week yet"
        : `${kpis.weekPomos} pomodoro${kpis.weekPomos === 1 ? "" : "s"} this week`
    );
    setText("current-streak", kpis.currentStreak);
    setText("longest-streak", kpis.longestStreak);

    // At a glance
    setText(
      "avg-session",
      kpis.avgSec ? fmtMinutes(kpis.avgSec) : "—"
    );
    setText(
      "completion-rate",
      kpis.completionRate === null ? "—" : `${kpis.completionRate}%`
    );
    setText(
      "best-hour",
      kpis.bestHour < 0 ? "—" : formatHour(kpis.bestHour)
    );
    setText("all-time-focus", kpis.allTimeFocusSec ? fmtMinutes(kpis.allTimeFocusSec) : "—");
    setText("all-time-pomos", kpis.allTimePomos);

    renderWeeklyChart(kpis);
    renderHeatmap(kpis);
    renderRecent(kpis.recent);
  }

  function formatHour(h) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
    });
  }

  function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = String(val);
  }

  function toggleEmptyHero(show) {
    const hero = $("dash-empty-hero");
    const kpiGrid = $("kpi-grid");
    const cols = $("dash-columns");
    const heat = $("dash-heatmap-card");
    if (hero) hero.hidden = !show;
    // Keep KPI grid visible either way (goal ring, streak still meaningful at 0),
    // but hide the chart + heatmap cards when there's no data to show.
    if (cols) cols.hidden = show;
    if (heat) heat.hidden = show;
    if (kpiGrid) kpiGrid.classList.toggle("kpi-grid-muted", show);
  }

  function renderWeeklyChart(kpis) {
    const canvas = $("weekly-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const minutes = kpis.dailyFocus.map((s) => Math.round(s / 60));
    const hasData = minutes.some((m) => m > 0);

    const emptyEl = $("chart-empty");
    if (emptyEl) emptyEl.hidden = hasData;
    canvas.style.visibility = hasData ? "visible" : "hidden";

    if (chart) {
      chart.data.labels = kpis.dailyLabels;
      chart.data.datasets[0].data = minutes;
      chart.update();
      return;
    }

    chart = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: kpis.dailyLabels,
        datasets: [
          {
            label: "Minutes",
            data: minutes,
            backgroundColor: "rgba(217, 40, 40, 0.75)",
            borderRadius: 8,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} min`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#4381A8" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#4381A8", precision: 0 },
            grid: { color: "rgba(67, 129, 168, 0.12)" },
          },
        },
      },
    });
  }

  function renderHeatmap(kpis) {
    const host = $("hour-heatmap");
    if (!host) return;
    const hasData = kpis.hourBuckets.some((c) => c > 0);
    const emptyEl = $("heatmap-empty");
    const legendEl = $("heatmap-legend");
    if (emptyEl) emptyEl.hidden = hasData;
    if (legendEl) legendEl.style.display = hasData ? "" : "none";
    host.style.display = hasData ? "" : "none";
    if (!hasData) {
      host.innerHTML = "";
      return;
    }
    const max = Math.max(1, ...kpis.hourBuckets);
    const cells = [];
    for (let h = 0; h < 24; h++) {
      const c = kpis.hourBuckets[h];
      const level = c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4));
      cells.push(
        `<div class="heatmap-cell l${level}" title="${formatHour(h)} — ${c} pomo${
          c === 1 ? "" : "s"
        }"><span>${String(h).padStart(2, "0")}</span></div>`
      );
    }
    host.innerHTML = cells.join("");
  }

  function renderRecent(list) {
    const host = $("recent-sessions");
    if (!host) return;
    if (!list.length) {
      host.innerHTML =
        '<li class="recent-empty">No sessions yet — hit <strong>Start session</strong> to log your first pomodoro.</li>';
      return;
    }
    host.innerHTML = list
      .map((ev) => {
        const dur = fmtMinutes(ev.actualSec);
        const when = new Date(ev.startedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const typeLabel =
          ev.type === "pomo"
            ? "Focus"
            : ev.type === "sbreak"
            ? "Short break"
            : "Long break";
        const badge = ev.completed
          ? '<span class="badge badge-ok">Completed</span>'
          : ev.skipped
          ? '<span class="badge badge-skip">Skipped</span>'
          : '<span class="badge badge-partial">Partial</span>';
        const subject = ev.subject
          ? `<span class="recent-subject">${escapeHtml(ev.subject)}</span>`
          : `<span class="recent-subject muted">${typeLabel}</span>`;
        return `<li class="recent-item">
          <div class="recent-main">
            ${subject}
            <span class="recent-meta">${typeLabel} · ${dur} · ${when}</span>
          </div>
          ${badge}
        </li>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function refresh() {
    if (!currentUser || !window.Analytics) return;
    const sinceMs = Date.now() - 120 * DAY_MS;
    window.Analytics
      .fetchEvents(currentUser.uid, sinceMs)
      .then((events) => {
        const kpis = computeKpis(events, loadGoal());
        render(kpis);
      })
      .catch((err) => {
        console.warn("dashboard: fetch failed", err);
        const kpis = computeKpis(window.Analytics.getLocalEvents(), loadGoal());
        render(kpis);
      });
  }

  function setupGreeting(user) {
    const hello = $("dash-hello");
    if (!hello) return;
    const name =
      (user && user.displayName) ||
      (user && user.email && user.email.split("@")[0]) ||
      "there";
    hello.textContent = `Welcome back, ${name}`;
  }

  function setupLive(user) {
    if (liveRef) {
      try { liveRef.off(); } catch (_) {}
      liveRef = null;
    }
    try {
      if (typeof firebase === "undefined" || !firebase.database) return;
      const db = firebase.database();
      liveRef = db
        .ref(`users/${user.uid}/events`)
        .orderByChild("startedAt")
        .limitToLast(1);
      let firstSnapshotSeen = false;
      liveRef.on("child_added", () => {
        // Skip the initial snapshot replay
        if (!firstSnapshotSeen) {
          firstSnapshotSeen = true;
          return;
        }
        refresh();
      });
      // Flip the flag after the initial snapshot completes
      liveRef.once("value").then(() => {
        firstSnapshotSeen = true;
      });
    } catch (e) {
      console.warn("dashboard: live listener failed", e);
    }
  }

  function init(user) {
    currentUser = user;
    setupGreeting(user);
    refresh();
    setupLive(user);
    // Refresh when another tab logs a session (same-origin storage event)
    window.addEventListener("storage", (e) => {
      if (e.key === "analytics.events") refresh();
    });
    window.addEventListener("analytics:event", refresh);
  }

  global.Dashboard = { init, refresh };
})(window);
