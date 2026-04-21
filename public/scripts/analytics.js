/**
 * DoroDoro Analytics
 * Captures every timer session (completed, skipped, abandoned) and stores
 * them in Firebase Realtime Database + localStorage. The dashboard on home
 * reads from this to compute KPIs.
 *
 * Event schema:
 *   {
 *     id:         string,            // local id (push key if synced)
 *     startedAt:  number (ms epoch),
 *     endedAt:    number (ms epoch),
 *     plannedSec: number,             // intended duration in seconds
 *     actualSec:  number,             // real elapsed seconds (<= planned)
 *     type:       'pomo' | 'sbreak' | 'lbreak',
 *     completed:  boolean,            // ran to 0
 *     skipped:    boolean,            // user pressed skip
 *     subject:    string | null,      // optional free-text tag
 *     synced:     boolean             // written to RTDB
 *   }
 *
 * RTDB paths:
 *   users/{uid}/events/{eventId}                    -> raw event
 *   users/{uid}/statsDaily/{YYYY-MM-DD}             -> { pomos, focusSec, completed, skipped }
 */
(function (global) {
  "use strict";

  const LS_KEY = "analytics.events";
  const LS_MAX = 500;
  const LS_PENDING_KEY = "analytics.pendingBackfill";

  // ---------- Local storage ring buffer ----------
  function readLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn("analytics: bad local cache", e);
      return [];
    }
  }

  function writeLocal(arr) {
    try {
      const trimmed = arr.slice(-LS_MAX);
      localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("analytics: failed to persist local events", e);
    }
  }

  function appendLocal(event) {
    const arr = readLocal();
    arr.push(event);
    writeLocal(arr);
  }

  function markSynced(localId, remoteId) {
    const arr = readLocal();
    for (const ev of arr) {
      if (ev.id === localId) {
        ev.synced = true;
        if (remoteId) ev.id = remoteId;
        break;
      }
    }
    writeLocal(arr);
  }

  function ymd(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ---------- Firebase helpers ----------
  function getUser() {
    try {
      return typeof firebase !== "undefined" &&
        firebase.auth &&
        firebase.auth().currentUser
        ? firebase.auth().currentUser
        : null;
    } catch (_) {
      return null;
    }
  }

  function getDb() {
    try {
      return typeof firebase !== "undefined" && firebase.database
        ? firebase.database()
        : null;
    } catch (_) {
      return null;
    }
  }

  function pushRemote(uid, event) {
    const db = getDb();
    if (!db) return Promise.reject(new Error("no-db"));
    const ref = db.ref(`users/${uid}/events`).push();
    const payload = {
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      plannedSec: event.plannedSec,
      actualSec: event.actualSec,
      type: event.type,
      completed: !!event.completed,
      skipped: !!event.skipped,
      subject: event.subject || null,
    };
    return ref.set(payload).then(() => ref.key);
  }

  function updateDailyAggregate(uid, event) {
    if (event.type !== "pomo") return Promise.resolve();
    const db = getDb();
    if (!db) return Promise.resolve();
    const dayKey = ymd(event.startedAt);
    const ref = db.ref(`users/${uid}/statsDaily/${dayKey}`);
    return ref.transaction((cur) => {
      const base = cur || { pomos: 0, focusSec: 0, completed: 0, skipped: 0 };
      if (event.completed) base.pomos += 1;
      base.focusSec += event.actualSec || 0;
      if (event.completed) base.completed += 1;
      if (event.skipped) base.skipped += 1;
      return base;
    });
  }

  // ---------- Public API ----------
  function recordSession(partial) {
    const now = Date.now();
    const event = {
      id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: partial.startedAt || now,
      endedAt: partial.endedAt || now,
      plannedSec: Math.max(0, Math.round(partial.plannedSec || 0)),
      actualSec: Math.max(0, Math.round(partial.actualSec || 0)),
      type: partial.type || "pomo",
      completed: !!partial.completed,
      skipped: !!partial.skipped,
      subject: (partial.subject || "").trim() || null,
      synced: false,
    };

    // Never record a zero-length session
    if (event.actualSec < 1 && !event.completed) return null;

    appendLocal(event);

    const user = getUser();
    if (user) {
      pushRemote(user.uid, event)
        .then((remoteId) => {
          markSynced(event.id, remoteId);
          return updateDailyAggregate(user.uid, event);
        })
        .catch((err) => {
          console.warn("analytics: remote push failed, keeping local", err);
          queuePending(event.id);
        });
    } else {
      queuePending(event.id);
    }

    // Notify listeners on same tab
    try {
      window.dispatchEvent(
        new CustomEvent("analytics:event", { detail: event })
      );
    } catch (_) {}

    return event;
  }

  function queuePending(localId) {
    try {
      const raw = localStorage.getItem(LS_PENDING_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!arr.includes(localId)) {
        arr.push(localId);
        localStorage.setItem(LS_PENDING_KEY, JSON.stringify(arr));
      }
    } catch (_) {}
  }

  function drainPending(uid) {
    let pending = [];
    try {
      const raw = localStorage.getItem(LS_PENDING_KEY);
      pending = raw ? JSON.parse(raw) : [];
    } catch (_) {
      pending = [];
    }
    if (!pending.length) return;

    const all = readLocal();
    const byId = new Map(all.map((e) => [e.id, e]));
    const remaining = [];

    const chain = pending.reduce((p, localId) => {
      const ev = byId.get(localId);
      if (!ev || ev.synced) return p;
      return p
        .then(() => pushRemote(uid, ev))
        .then((remoteId) => {
          markSynced(ev.id, remoteId);
          return updateDailyAggregate(uid, ev);
        })
        .catch((err) => {
          console.warn("analytics: backfill failed for", localId, err);
          remaining.push(localId);
        });
    }, Promise.resolve());

    chain.finally(() => {
      try {
        localStorage.setItem(LS_PENDING_KEY, JSON.stringify(remaining));
      } catch (_) {}
    });
  }

  function getLocalEvents() {
    return readLocal();
  }

  // Fetch events from RTDB for a time window; merge with local cache by id.
  function fetchEvents(uid, sinceMs) {
    const db = getDb();
    if (!db || !uid) {
      return Promise.resolve(mergeWithLocal([], sinceMs));
    }
    const ref = db
      .ref(`users/${uid}/events`)
      .orderByChild("startedAt")
      .startAt(sinceMs);
    return ref.once("value").then((snap) => {
      const remote = [];
      snap.forEach((child) => {
        const v = child.val() || {};
        remote.push({ id: child.key, synced: true, ...v });
      });
      return mergeWithLocal(remote, sinceMs);
    });
  }

  function mergeWithLocal(remote, sinceMs) {
    const local = readLocal().filter(
      (e) => !sinceMs || e.startedAt >= sinceMs
    );
    const seen = new Set(remote.map((e) => e.id));
    for (const ev of local) {
      if (!seen.has(ev.id)) remote.push(ev);
    }
    remote.sort((a, b) => a.startedAt - b.startedAt);
    return remote;
  }

  // Auto-backfill once auth resolves
  function setupAutoBackfill() {
    try {
      if (typeof firebase === "undefined" || !firebase.auth) return;
      firebase.auth().onAuthStateChanged((user) => {
        if (user) drainPending(user.uid);
      });
    } catch (e) {
      console.warn("analytics: auth listener failed", e);
    }
  }

  // Expose
  global.Analytics = {
    recordSession,
    getLocalEvents,
    fetchEvents,
    drainPending,
    ymd,
  };

  // Kick off backfill on script load (auth SDK may load after us)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAutoBackfill);
  } else {
    setupAutoBackfill();
  }
})(window);
