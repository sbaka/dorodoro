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

  const ACTION_BLOCK_RE = /<doro-action>\s*[\s\S]*?<\/doro-action>/gi;

  // Update after `wrangler deploy`.
  const WORKER_URL = "https://dorodoro-ai.dorodoro.workers.dev";

  let currentUser = null;
  let currentSessionId = "";
  let messagesCache = [];
  let optimisticMessages = [];
  let messagesRef = null;
  let sending = false;

  const panelEl = document.getElementById("ai-chat-panel");
  const fabEl = document.getElementById("ai-chat-fab");
  const listEl = panelEl ? panelEl.querySelector(".ai-chat-list") : null;
  const formEl = panelEl ? panelEl.querySelector(".ai-chat-form") : null;
  const inputEl = panelEl ? panelEl.querySelector(".ai-chat-input") : null;
  const closeEl = panelEl ? panelEl.querySelector(".ai-chat-close") : null;
  const newChatEl = panelEl ? panelEl.querySelector(".ai-chat-new") : null;
  const statusEl = panelEl ? panelEl.querySelector(".ai-chat-status") : null;
  const titleEl = panelEl ? panelEl.querySelector(".ai-chat-session-title") : null;

  if (!panelEl || !fabEl || !listEl || !formEl || !inputEl) return;

  const STARTERS = [
    {
      prompt: "Help me plan what to tackle in this session.",
      label: "Plan this focus session",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
    },
    {
      prompt: "Summarize my notes so I know where I left off.",
      label: "Summarize my notes",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
    },
    {
      prompt: "Break my current task into a short todo list.",
      label: "Break a task into todos",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
    },
  ];

  listEl.addEventListener("click", handleListClick);
  autosizeInput();
  inputEl.addEventListener("input", autosizeInput);
  inputEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      formEl.requestSubmit();
    }
  });
  if (newChatEl) {
    newChatEl.addEventListener("click", () => {
      inputEl.value = "";
      autosizeInput();
      listEl.scrollTop = 0;
      inputEl.focus();
    });
  }

  function autosizeInput() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  }

  // ---------- Panel open/close ----------
  // On compact viewports the chat behaves like a real route: opening pushes
  // a history entry with #assistant, and the hardware/browser back button
  // (as well as the in-panel back arrow) pops it off.
  const ROUTE_HASH = "#assistant";
  const isCompactViewport = () => window.matchMedia("(max-width: 991px)").matches;
  const isRouteState = () => !!(history.state && history.state.aiChatRoute);

  function emitPanelVisibilityChange() {
    window.dispatchEvent(new CustomEvent("ai-chat:visibility-changed", {
      detail: { open: !panelEl.hidden },
    }));
  }

  function openPanel() {
    if (!panelEl.hidden) {
      emitPanelVisibilityChange();
      inputEl.focus();
      return;
    }

    if (isCompactViewport() && !isRouteState()) {
      try {
        history.pushState({ aiChatRoute: true }, "", ROUTE_HASH);
      } catch (_) {}
    }

    panelEl.hidden = false;
    requestAnimationFrame(() => panelEl.classList.add("is-open"));
    emitPanelVisibilityChange();
    inputEl.focus();
  }

  function closePanel() {
    if (panelEl.hidden) {
      emitPanelVisibilityChange();
      return;
    }

    // If we own a route entry, let history.back() drive the close so the
    // URL and back-stack stay consistent. popstate will call hidePanel().
    if (isRouteState()) {
      history.back();
      return;
    }

    hidePanel();
  }

  function hidePanel() {
    if (panelEl.hidden) return;
    panelEl.classList.remove("is-open");
    emitPanelVisibilityChange();
    setTimeout(() => { panelEl.hidden = true; }, 220);
  }

  // Browser/hardware back: if our route entry is gone but the panel is
  // still showing, close it. If the user navigates forward back to
  // #assistant, re-open.
  window.addEventListener("popstate", () => {
    if (isRouteState()) {
      if (panelEl.hidden && isCompactViewport()) {
        panelEl.hidden = false;
        requestAnimationFrame(() => panelEl.classList.add("is-open"));
        emitPanelVisibilityChange();
      }
    } else if (!panelEl.hidden) {
      hidePanel();
    }
  });

  // Deep link / refresh with #assistant opens the panel on mobile.
  window.addEventListener("load", () => {
    if (window.location.hash === ROUTE_HASH && isCompactViewport() && panelEl.hidden) {
      // Ensure state is marked as our route so back still works.
      if (!isRouteState()) {
        try { history.replaceState({ aiChatRoute: true }, "", ROUTE_HASH); } catch (_) {}
      }
      panelEl.hidden = false;
      requestAnimationFrame(() => panelEl.classList.add("is-open"));
      emitPanelVisibilityChange();
    }
  });

  fabEl.addEventListener("click", openPanel);
  if (closeEl) closeEl.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panelEl.hidden) closePanel();
  });

  // ---------- Session wiring ----------
  function syncSession(sessionId) {
    if (sessionId === currentSessionId) {
      if (currentUser && !messagesRef) {
        attachMessagesListener();
      }
      return;
    }
    currentSessionId = sessionId || "";
    messagesCache = [];
    optimisticMessages = [];
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
        optimisticMessages = optimisticMessages.filter((msg) => {
          const sig = getMessageSignature(msg);
          return !messagesCache.some((persisted) => getMessageSignature(persisted) === sig);
        });
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
    const visibleMessages = getVisibleMessages();
    if (!visibleMessages.length) {
      listEl.innerHTML = renderEmptyState();
      return;
    }
    listEl.innerHTML = visibleMessages.map(renderBubble).join("");
    listEl.scrollTop = listEl.scrollHeight;
  }

  function renderEmptyState() {
    const sparkle = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/></svg>';
    const starters = STARTERS.map((s) => `
        <button type="button" class="ai-chat-starter" data-ai-starter="${escapeAttr(s.prompt)}">
          <span class="ai-chat-starter-icon" aria-hidden="true">${s.icon}</span>
          <span class="ai-chat-starter-text">${escapeHtml(s.label)}</span>
        </button>`).join("");
    return `
      <div class="ai-chat-empty">
        <div class="ai-chat-empty-hero">
          <span class="ai-chat-empty-icon" aria-hidden="true">${sparkle}</span>
          <h3 class="ai-chat-empty-title">What can I help with?</h3>
          <p class="ai-chat-empty-subtitle">Ask about this session or pick a starter below.</p>
        </div>
        <div class="ai-chat-starters">${starters}</div>
      </div>`;
  }

  function getVisibleMessages() {
    const merged = messagesCache.slice();
    const seen = new Set(merged.map(getMessageSignature));
    optimisticMessages.forEach((msg) => {
      const sig = getMessageSignature(msg);
      if (!seen.has(sig)) {
        merged.push(msg);
        seen.add(sig);
      }
    });
    merged.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return merged;
  }

  function getMessageSignature(msg) {
    return `${msg.role || ""}|${msg.content || ""}|${Number(msg.createdAt) || 0}`;
  }

  function renderBubble(msg) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (role === "assistant") {
      const content = renderMarkdown(stripActionMarkup(msg.content || ""));
      const actionLinks = renderActionLinks(msg.actionResult);
      return `<div class="ai-chat-assistant-row">
        ${assistantAvatar()}
        <div class="ai-chat-bubble ai-chat-bubble-assistant" data-msg-id="${escapeAttr(msg.id || "")}">
          <div class="ai-chat-bubble-content">${content}</div>
          ${actionLinks}
        </div>
      </div>`;
    }
    const content = escapeHtml(msg.content || "");
    return `<div class="ai-chat-bubble ai-chat-bubble-user" data-msg-id="${escapeAttr(msg.id || "")}">
      <div class="ai-chat-bubble-content">${content}</div>
    </div>`;
  }

  function assistantAvatar() {
    return '<span class="ai-chat-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2"/><path d="M12 19v2"/><path d="M5 12H3"/><path d="M21 12h-2"/><path d="m6.5 6.5-1.4-1.4"/><path d="m18.9 18.9-1.4-1.4"/><path d="m6.5 17.5-1.4 1.4"/><path d="m18.9 5.1-1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg></span>';
  }

  function appendStreamingBubble(text) {
    const row = document.createElement("div");
    row.className = "ai-chat-assistant-row";
    row.innerHTML = `${assistantAvatar()}<div class="ai-chat-bubble ai-chat-bubble-assistant is-streaming"><div class="ai-chat-bubble-content"></div></div>`;
    listEl.appendChild(row);
    listEl.scrollTop = listEl.scrollHeight;
    return row.querySelector(".ai-chat-bubble-content");
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
    autosizeInput();

    const db = firebase.database();
    const now = Date.now();
    const userMsg = { role: "user", content: text, createdAt: now };
    optimisticMessages.push({
      id: `local-${now}`,
      ...userMsg,
    });
    render();

    const userMsgRef = db
      .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/messages`)
      .push();
    try {
      await userMsgRef.set(userMsg);
      await db
        .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/updatedAt`)
        .set(now);
    } catch (err) {
      console.warn("ai-chat: failed to save user msg", err);
    }

    const contextPayload = buildContext();
    const recentMessages = getVisibleMessages()
      .slice(-18)
      .map((m) => ({ role: m.role, content: m.content }));

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
              streamTarget.innerHTML = renderMarkdown(stripActionMarkup(streamed));
              listEl.scrollTop = listEl.scrollHeight;
            } else if (obj.type === "error") {
              setStatus(obj.message || "AI unavailable", "error");
            } else if (obj.type === "done") {
              const actionOutcome = obj.action ? handleAiActions(obj.action) : null;
              if (actionOutcome && actionOutcome.result && obj.messageId) {
                persistActionResult(obj.messageId, actionOutcome.result);
              }
              updateStatusForDone(actionOutcome, obj.quota);
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

  function handleListClick(event) {
    const starter = event.target.closest("[data-ai-starter]");
    if (starter) {
      const prompt = starter.getAttribute("data-ai-starter") || "";
      inputEl.value = prompt;
      autosizeInput();
      inputEl.focus();
      return;
    }

    const openButton = event.target.closest("[data-ai-open-column]");
    if (!openButton) {
      return;
    }

    const columnId = openButton.getAttribute("data-ai-open-column");
    const board = global.FocusBoard;
    if (!columnId || !board || typeof board.openColumnFromAssistant !== "function") {
      return;
    }

    // On mobile the chat panel is a fullscreen overlay, so the workspace
    // underneath is invisible until we close it. On desktop the panel is
    // a right-side slide-over and can stay open alongside the board.
    const isCompact = window.matchMedia("(max-width: 991px)").matches;
    if (isCompact) {
      closePanel();
    }

    board.openColumnFromAssistant(columnId);
  }

  function handleAiActions(payload) {
    const board = global.FocusBoard;
    if (!board || !payload || !Array.isArray(payload.actions)) {
      return null;
    }

    const notices = [];
    const targets = [];
    payload.actions.forEach((action) => {
      if (!action || typeof action !== "object") {
        return;
      }

      if (action.type === "create_note" && typeof board.createNoteFromAssistant === "function") {
        const created = board.createNoteFromAssistant(action.title, action.content);
        if (created) {
          notices.push(`Created note: ${created.title}`);
          targets.push({
            columnId: created.id,
            title: created.title,
            type: created.type,
          });
        }
        return;
      }

      if (action.type === "create_todo_list" && typeof board.createTodoListFromAssistant === "function") {
        const created = board.createTodoListFromAssistant(action.title, action.items);
        if (created) {
          const itemCount = Array.isArray(created.items) ? created.items.length : 0;
          notices.push(itemCount
            ? `Created todo list: ${created.title} (${itemCount} items)`
            : `Created todo list: ${created.title}`);
          targets.push({
            columnId: created.id,
            title: created.title,
            type: created.type,
          });
        }
      }
    });

    if (!targets.length) {
      return null;
    }

    return {
      notices,
      result: { targets },
    };
  }

  async function persistActionResult(messageId, actionResult) {
    if (!messageId || !actionResult || !currentUser || !currentSessionId) {
      return;
    }

    try {
      await firebase.database()
        .ref(`users/${currentUser.uid}/sessions/${currentSessionId}/aiChat/messages/${messageId}/actionResult`)
        .set(actionResult);
    } catch (err) {
      console.warn("ai-chat: failed to save action result", err);
    }
  }

  function updateStatusForDone(actionOutcome, quota) {
    const parts = [];
    if (actionOutcome && Array.isArray(actionOutcome.notices) && actionOutcome.notices.length) {
      parts.push(actionOutcome.notices.join(" · "));
    }
    if (quota) {
      parts.push(formatQuota(quota));
    }
    setStatus(parts.join(" · "));
  }

  function renderActionLinks(actionResult) {
    const targets = actionResult && Array.isArray(actionResult.targets)
      ? actionResult.targets.filter((target) => target && target.columnId && target.title)
      : [];
    if (!targets.length) {
      return "";
    }

    return `<div class="ai-chat-bubble-actions">
      ${targets.map(renderActionLink).join("")}
    </div>`;
  }

  function renderActionLink(target) {
    const label = target.type === "todos" ? "Open todo list" : "Open note";
    return `<button class="ai-chat-action-link" type="button" data-ai-open-column="${escapeAttr(target.columnId)}">
      <span class="ai-chat-action-label">${escapeHtml(label)}</span>
      <span class="ai-chat-action-title">${escapeHtml(target.title)}</span>
    </button>`;
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

  function stripActionMarkup(value) {
    return String(value || "").replace(ACTION_BLOCK_RE, "").trim();
  }

  function renderMarkdown(value) {
    const lines = normalizeMarkdown(value).split("\n");
    const blocks = [];

    for (let index = 0; index < lines.length;) {
      const line = lines[index].trim();

      if (!line) {
        index += 1;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(6, headingMatch[1].length);
        blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length) {
          const listLine = lines[index].trim();
          const match = listLine.match(/^\d+\.\s+(.+)$/);
          if (!match) break;
          items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
          index += 1;
        }
        blocks.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        const items = [];
        while (index < lines.length) {
          const listLine = lines[index].trim();
          const match = listLine.match(/^[-*+]\s+(.+)$/);
          if (!match) break;
          items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
          index += 1;
        }
        blocks.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length) {
        const paragraphLine = lines[index].trim();
        if (!paragraphLine) {
          index += 1;
          break;
        }
        if (/^(#{1,6})\s+/.test(paragraphLine) || /^\d+\.\s+/.test(paragraphLine) || /^[-*+]\s+/.test(paragraphLine)) {
          break;
        }
        paragraphLines.push(renderInlineMarkdown(paragraphLine));
        index += 1;
      }
      blocks.push(`<p>${paragraphLines.join("<br>")}</p>`);
    }

    return blocks.join("") || `<p>${escapeHtml(value || "")}</p>`;
  }

  function normalizeMarkdown(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/([:?!])\s+(\d+\.\s+)/g, "$1\n$2")
      .replace(/([.!?])\s+(\d+\.\s+)/g, "$1\n$2")
      .replace(/([.!?])\s+([-*+]\s+)/g, "$1\n$2");
  }

  function renderInlineMarkdown(value) {
    const tokens = [];
    let html = escapeHtml(value || "");

    html = html.replace(/`([^`]+)`/g, (_, code) => storeToken(tokens, `<code>${code}</code>`));
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeHref = sanitizeUrl(href);
      if (!safeHref) {
        return label;
      }
      return storeToken(tokens, `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noreferrer noopener">${label}</a>`);
    });
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*(?=[$\s).,!?:;])/g, "$1<em>$2</em>");
    html = html.replace(/(^|[\s(])_(?!\s)(.+?)(?<!\s)_(?=[$\s).,!?:;])/g, "$1<em>$2</em>");

    return restoreTokens(html, tokens);
  }

  function sanitizeUrl(value) {
    const trimmed = String(value || "").trim();
    if (/^(https?:|mailto:)/i.test(trimmed)) {
      return trimmed;
    }
    return "";
  }

  function storeToken(tokens, html) {
    const token = `__AI_MD_${tokens.length}__`;
    tokens.push(html);
    return token;
  }

  function restoreTokens(value, tokens) {
    return value.replace(/__AI_MD_(\d+)__/g, (_, index) => tokens[Number(index)] || "");
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
    isOpen: () => !panelEl.hidden,
    setWorkerUrl: () => {
      console.warn("ai-chat: edit WORKER_URL in ai-chat.js to configure");
    },
  };
})(window);
