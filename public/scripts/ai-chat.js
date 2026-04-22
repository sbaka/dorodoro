/**
 * DoroDoro AI chat panel.
 * Right-side slide-over scoped to the active session.
 * Streams NDJSON from the Cloudflare Worker at WORKER_URL.
 *
 * Expected markup (injected by ai-chat-mount.js if absent):
 *   <button class="ai-fab" id="ai-chat-fab">…</button>
 *   <div class="ai-chat-panel" id="ai-chat-panel" hidden>…</div>
 */
(function (global) {
  "use strict";

  // Update after `wrangler deploy`.
  const WORKER_URL = "https://dorodoro-ai.dorodoro.workers.dev";

  let currentUser = null;
  let currentSessionId = "";
  let messagesCache = [];
  let messagesRef = null;
  let sending = false;

  const panelEl = document.getElementById("ai-chat-panel");
  const fabEl = document.getElementById("ai-chat-fab");
  const listEl = panelEl ? panelEl.querySelector(".ai-chat-list") : null;
  const formEl = panelEl ? panelEl.querySelector(".ai-chat-form") : null;
  const inputEl = panelEl ? panelEl.querySelector(".ai-chat-input") : null;
  const closeEl = panelEl ? panelEl.querySelector(".ai-chat-close") : null;
  const statusEl = panelEl ? panelEl.querySelector(".ai-chat-status") : null;
  const titleEl = panelEl ? panelEl.querySelector(".ai-chat-session-title") : null;

  if (!panelEl || !fabEl || !listEl || !formEl || !inputEl) return;

  // ---------- Panel open/close ----------
  function openPanel() {
    panelEl.hidden = false;
    requestAnimationFrame(() => panelEl.classList.add("is-open"));
    inputEl.focus();
  }

  function closePanel() {
    panelEl.classList.remove("is-open");
    setTimeout(() => { panelEl.hidden = true; }, 220);
  }

  fabEl.addEventListener("click", openPanel);
  if (closeEl) closeEl.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panelEl.hidden) closePanel();
  });

  // ---------- Session wiring ----------
  function syncSession(sessionId) {
    if (sessionId === currentSessionId) return;
    currentSessionId = sessionId || "";
    messagesCache = [];
    render();
    if (titleEl && global.Sessions) {
      const s = global.Sessions.getActive();
      titleEl.textContent = s ? s.title : "";
    }
    detachMessagesListener();
    attachMessagesListener();
  }

  window.addEventListener("sessions:active-changed", (e) => {
    if (e && e.detail) syncSession(e.detail.sessionId);
  });

  // ---------- Auth wiring ----------
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user || null;
      detachMessagesListener();
      if (currentUser) {
        const active = global.Sessions ? global.Sessions.getActiveId() : "";
        if (active) syncSession(active);
      } else {
        currentSessionId = "";
        messagesCache = [];
        render();
      }
    });
  }

  // Handle case where Sessions is already ready.
  if (global.Sessions && global.Sessions.getActiveId()) {
    syncSession(global.Sessions.getActiveId());
  }

  // ---------- RTDB live messages ----------
  function attachMessagesListener() {
    if (!currentUser || !currentSessionId) return;
    if (typeof firebase === "undefined" || !firebase.database) return;
    try {
      const db = firebase.database();
      messagesRef = db
        .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/messages`)
        .orderByChild("createdAt")
        .limitToLast(50);
      messagesRef.on("value", (snap) => {
        const val = snap.val() || {};
        messagesCache = Object.keys(val)
          .map((id) => ({ id, ...val[id] }))
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        render();
      });
    } catch (err) {
      console.warn("ai-chat: listener failed", err);
    }
  }

  function detachMessagesListener() {
    if (messagesRef && typeof messagesRef.off === "function") {
      try { messagesRef.off(); } catch (_) {}
    }
    messagesRef = null;
  }

  // ---------- Rendering ----------
  function render() {
    if (!messagesCache.length) {
      listEl.innerHTML = `
        <div class="ai-chat-empty">
          <p>Ask about your current session — plans, reviews, breakdowns.</p>
        </div>`;
      return;
    }
    listEl.innerHTML = messagesCache.map(renderBubble).join("");
    listEl.scrollTop = listEl.scrollHeight;
  }

  function renderBubble(msg) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    return `<div class="ai-chat-bubble ai-chat-bubble-${role}" data-msg-id="${escapeAttr(msg.id || "")}">
      <div class="ai-chat-bubble-content">${escapeHtml(msg.content || "")}</div>
    </div>`;
  }

  function appendStreamingBubble(text) {
    const div = document.createElement("div");
    div.className = "ai-chat-bubble ai-chat-bubble-assistant is-streaming";
    div.innerHTML = `<div class="ai-chat-bubble-content"></div>`;
    listEl.appendChild(div);
    listEl.scrollTop = listEl.scrollHeight;
    return div.querySelector(".ai-chat-bubble-content");
  }

  // ---------- Send ----------
  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = inputEl.value.trim();
    if (!raw || sending) return;
    if (!currentUser) {
      setStatus("Sign in to chat with the assistant.", "error");
      return;
    }
    if (!currentSessionId) {
      setStatus("No active session yet.", "error");
      return;
    }
    await sendMessage(raw);
  });

  async function sendMessage(text) {
    sending = true;
    setStatus("Thinking…");
    inputEl.value = "";

    const db = firebase.database();
    const userMsgRef = db
      .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/messages`)
      .push();
    const now = Date.now();
    const userMsg = { role: "user", content: text, createdAt: now };
    try {
      await userMsgRef.set(userMsg);
      await db
        .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/updatedAt`)
        .set(now);
    } catch (err) {
      console.warn("ai-chat: failed to save user msg", err);
    }

    const contextPayload = buildContext();
    const recentMessages = messagesCache.slice(-18).map((m) => ({ role: m.role, content: m.content }));
    recentMessages.push({ role: "user", content: text });

    let streamTarget = null;
    let streamed = "";

    try {
      const token = await currentUser.getIdToken();
      const resp = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages: recentMessages,
          context: contextPayload,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          setStatus(formatRateLimit(data), "error");
        } else {
          setStatus(data.error || `Error ${resp.status}`, "error");
        }
        sending = false;
        return;
      }

      streamTarget = appendStreamingBubble("");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed);
            if (obj.type === "delta" && obj.text) {
              streamed += obj.text;
              streamTarget.textContent = streamed;
              listEl.scrollTop = listEl.scrollHeight;
            } else if (obj.type === "error") {
              setStatus(obj.message || "AI unavailable", "error");
            } else if (obj.type === "done") {
              if (obj.quota) setStatus(formatQuota(obj.quota));
            }
          } catch (_) {}
        }
      }

      // The RTDB listener will replace the streaming bubble with the persisted one.
      if (streamTarget) {
        streamTarget.closest(".ai-chat-bubble").classList.remove("is-streaming");
      }
    } catch (err) {
      console.warn("ai-chat: request failed", err);
      setStatus("Network error", "error");
    } finally {
      sending = false;
    }
  }

  function buildContext() {
    const notes = (global.FocusBoard && global.FocusBoard.getNotesText)
      ? global.FocusBoard.getNotesText()
      : "";
    const todos = (global.FocusBoard && global.FocusBoard.getTodos)
      ? global.FocusBoard.getTodos()
      : [];
    const session = global.Sessions ? global.Sessions.getActive() : null;
    return {
      sessionTitle: session ? session.title : "",
      sessionDescription: session ? session.description : "",
      notes,
      todos,
    };
  }

  function setStatus(text, level = "info") {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.dataset.level = level;
  }

  function formatQuota(q) {
    if (!q) return "";
    return `${q.userDaily}/${q.userDailyMax} today · ${q.userMonthly}/${q.userMonthlyMax} this month`;
  }

  function formatRateLimit(data) {
    switch (data.reason) {
      case "cooldown": return `Slow down — try again in ${data.retryAfter || 3}s.`;
      case "user_daily": return `Daily limit reached (${data.limit || 50}). Resets at 00:00 UTC.`;
      case "user_monthly": return `Monthly limit reached (${data.limit || 500}).`;
      case "global_cap": return "Shared daily cap reached. Try again tomorrow.";
      default: return "Rate limited.";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(value) { return escapeHtml(value); }

  global.AIChat = {
    open: openPanel,
    close: closePanel,
    setWorkerUrl: () => {
      console.warn("ai-chat: edit WORKER_URL in ai-chat.js to configure");
    },
  };
})(window);
