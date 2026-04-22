/**
 * DoroDoro Sessions
 *
 * Manages long-lived work sessions (projects / workspaces). Each session owns:
 *   - focusBoard (notes + todos)
 *   - aiChat thread (added in Phase 2)
 *   - pomodoro events attributed to it
 *
 * RTDB layout:
 *   users/{uid}/activeSessionId          -> string
 *   users/{uid}/sessions/{sessionId}/
 *     title, description, status,
 *     createdAt, updatedAt, archivedAt
 *     focusBoard/...
 *     aiChat/...
 *     stats/...
 *
 * Legacy migration (one-off):
 *   If users/{uid}/focusBoard exists and users/{uid}/sessions is empty,
 *   create a "Default" session, move the board into it, delete the legacy path.
 *
 * Emits a DOM custom event `sessions:active-changed`
 * with detail { sessionId, session } whenever the active session changes.
 */
(function (global) {
  "use strict";

  const CACHE_ACTIVE_KEY = "sessions.active.v1";
  const CACHE_LIST_KEY = "sessions.list.v1";

  let currentUser = null;
  let activeSessionId = readCachedActiveId();
  let sessionsCache = readCachedList();
  let ready = false;
  const listeners = new Set();

  // ---------- Firebase helpers ----------
  function getDb() {
    try {
      return typeof firebase !== "undefined" && firebase.database
        ? firebase.database()
        : null;
    } catch (_) {
      return null;
    }
  }

  function userRef(path) {
    const db = getDb();
    if (!db || !currentUser) return null;
    const suffix = path ? `/${path}` : "";
    return db.ref(`users/${currentUser.uid}${suffix}`);
  }

  // ---------- Caching ----------
  function readCachedActiveId() {
    try {
      return localStorage.getItem(CACHE_ACTIVE_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function writeCachedActiveId(id) {
    try {
      if (id) {
        localStorage.setItem(CACHE_ACTIVE_KEY, id);
      } else {
        localStorage.removeItem(CACHE_ACTIVE_KEY);
      }
    } catch (_) {}
  }

  function readCachedList() {
    try {
      const raw = localStorage.getItem(CACHE_LIST_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writeCachedList(list) {
    try {
      localStorage.setItem(CACHE_LIST_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  // ---------- Utilities ----------
  function sanitizeTitle(raw) {
    const title = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
    return title || "Untitled session";
  }

  function normalizeMeta(id, raw) {
    const base = raw && typeof raw === "object" ? raw : {};
    return {
      id,
      title: sanitizeTitle(base.title),
      description: typeof base.description === "string" ? base.description.slice(0, 300) : "",
      status: ["active", "paused", "done"].includes(base.status) ? base.status : "active",
      createdAt: Number(base.createdAt) || 0,
      updatedAt: Number(base.updatedAt) || 0,
      archivedAt: Number(base.archivedAt) || 0,
    };
  }

  function emitActiveChanged() {
    const detail = {
      sessionId: activeSessionId,
      session: sessionsCache.find((s) => s.id === activeSessionId) || null,
    };
    listeners.forEach((cb) => {
      try { cb(detail); } catch (err) { console.warn("sessions: listener failed", err); }
    });
    try {
      window.dispatchEvent(new CustomEvent("sessions:active-changed", { detail }));
    } catch (_) {}
  }

  // ---------- Core API ----------
  function list() {
    return sessionsCache.slice();
  }

  function getActive() {
    if (!activeSessionId) return null;
    return sessionsCache.find((s) => s.id === activeSessionId) || null;
  }

  function getActiveId() {
    return activeSessionId || "";
  }

  function onActiveChanged(cb) {
    if (typeof cb === "function") listeners.add(cb);
    return () => listeners.delete(cb);
  }

  async function loadAll() {
    const ref = userRef("sessions");
    if (!ref) return [];
    const snap = await ref.once("value");
    const raw = snap.val() || {};
    const list = Object.keys(raw)
      .map((id) => normalizeMeta(id, raw[id]))
      .filter((s) => !s.archivedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    sessionsCache = list;
    writeCachedList(list);
    return list;
  }

  async function setActive(id) {
    if (!id || id === activeSessionId) return;
    activeSessionId = id;
    writeCachedActiveId(id);
    emitActiveChanged();
    const ref = userRef("activeSessionId");
    if (ref) {
      try { await ref.set(id); } catch (err) { console.warn("sessions: failed to persist active id", err); }
    }
  }

  async function create(title) {
    const ref = userRef("sessions");
    if (!ref) throw new Error("not-authenticated");
    const now = Date.now();
    const pushRef = ref.push();
    const meta = {
      title: sanitizeTitle(title),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await pushRef.set(meta);
    const full = { id: pushRef.key, description: "", archivedAt: 0, ...meta };
    sessionsCache = [full, ...sessionsCache];
    writeCachedList(sessionsCache);
    await setActive(full.id);
    return full;
  }

  async function rename(id, title) {
    const ref = userRef(`sessions/${id}`);
    if (!ref) return;
    const clean = sanitizeTitle(title);
    const now = Date.now();
    await ref.update({ title: clean, updatedAt: now });
    const entry = sessionsCache.find((s) => s.id === id);
    if (entry) {
      entry.title = clean;
      entry.updatedAt = now;
      writeCachedList(sessionsCache);
    }
    if (id === activeSessionId) emitActiveChanged();
  }

  async function archive(id) {
    const ref = userRef(`sessions/${id}`);
    if (!ref) return;
    const now = Date.now();
    await ref.update({ archivedAt: now, status: "done", updatedAt: now });
    sessionsCache = sessionsCache.filter((s) => s.id !== id);
    writeCachedList(sessionsCache);
    if (id === activeSessionId) {
      const next = sessionsCache[0];
      if (next) {
        await setActive(next.id);
      } else {
        // No sessions left — auto-create a default.
        await create("Default");
      }
    }
  }

  // ---------- Migration + bootstrap ----------
  async function migrateLegacyBoard() {
    const uRef = userRef("");
    if (!uRef) return null;
    const snap = await uRef.once("value");
    const data = snap.val() || {};
    const hasSessions = data.sessions && Object.keys(data.sessions).length > 0;
    const legacyBoard = data.focusBoard;

    if (hasSessions) return null;

    const now = Date.now();
    const newRef = userRef("sessions").push();
    const meta = {
      title: "Default",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const updates = {
      [`sessions/${newRef.key}`]: legacyBoard
        ? { ...meta, focusBoard: legacyBoard }
        : meta,
      activeSessionId: newRef.key,
    };
    if (legacyBoard) {
      updates.focusBoard = null; // delete legacy path
    }
    await uRef.update(updates);
    return newRef.key;
  }

  async function bootstrap(user) {
    currentUser = user || null;
    if (!currentUser) {
      ready = false;
      return;
    }

    try {
      const uRef = userRef("");
      const snap = await uRef.once("value");
      const data = snap.val() || {};
      const hasSessions = data.sessions && Object.keys(data.sessions).length > 0;

      let desiredActive = data.activeSessionId || "";

      if (!hasSessions) {
        desiredActive = await migrateLegacyBoard();
      }

      await loadAll();

      // Ensure we always have at least one session.
      if (!sessionsCache.length) {
        const created = await create("Default");
        desiredActive = created.id;
      } else if (!desiredActive || !sessionsCache.some((s) => s.id === desiredActive)) {
        desiredActive = sessionsCache[0].id;
      }

      ready = true;
      if (desiredActive !== activeSessionId) {
        await setActive(desiredActive);
      } else {
        emitActiveChanged(); // tell consumers we're ready, id may be the same
      }
    } catch (err) {
      console.warn("sessions: bootstrap failed", err);
    }
  }

  // Auth wiring
  function init() {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    firebase.auth().onAuthStateChanged((user) => {
      bootstrap(user);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.Sessions = {
    list,
    getActive,
    getActiveId,
    onActiveChanged,
    setActive,
    create,
    rename,
    archive,
    reload: loadAll,
    isReady: () => ready,
  };
})(window);
