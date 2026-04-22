/**
 * Sessions sidebar wiring (Phase 1).
 * Binds the DOM dropdown/switcher to window.Sessions.
 * Expected markup (rendered on pages that opt-in):
 *   <div class="sessions-bar">
 *     <button class="sessions-current" data-sessions-toggle>
 *       <span class="sessions-current-label">Session</span>
 *       <span class="sessions-current-title" data-sessions-title>…</span>
 *     </button>
 *     <button class="sessions-new" data-sessions-new title="New session">+</button>
 *     <div class="sessions-menu" data-sessions-menu hidden>
 *       <ul data-sessions-list></ul>
 *       <div class="sessions-menu-actions">
 *         <button data-sessions-rename>Rename</button>
 *         <button data-sessions-archive>Archive</button>
 *       </div>
 *     </div>
 *   </div>
 */
(function () {
  "use strict";

  const bar = document.querySelector(".sessions-bar");
  if (!bar) return;

  const titleEl = bar.querySelector("[data-sessions-title]");
  const toggleBtn = bar.querySelector("[data-sessions-toggle]");
  const newBtn = bar.querySelector("[data-sessions-new]");
  const menuEl = bar.querySelector("[data-sessions-menu]");
  const listEl = bar.querySelector("[data-sessions-list]");
  const renameBtn = bar.querySelector("[data-sessions-rename]");
  const archiveBtn = bar.querySelector("[data-sessions-archive]");

  function closeMenu() {
    if (menuEl) menuEl.hidden = true;
    bar.classList.remove("is-open");
  }

  function openMenu() {
    if (!menuEl) return;
    renderList();
    menuEl.hidden = false;
    bar.classList.add("is-open");
  }

  function toggleMenu() {
    if (!menuEl) return;
    if (menuEl.hidden) openMenu();
    else closeMenu();
  }

  function renderList() {
    if (!listEl || !window.Sessions) return;
    const active = window.Sessions.getActiveId();
    const sessions = window.Sessions.list();
    listEl.innerHTML = sessions
      .map(
        (s) => `
      <li>
        <button type="button" data-session-id="${escapeAttr(s.id)}" class="sessions-menu-item ${s.id === active ? "is-active" : ""}">
          <span class="sessions-menu-dot" aria-hidden="true"></span>
          <span class="sessions-menu-title">${escapeHtml(s.title)}</span>
        </button>
      </li>`
      )
      .join("");
  }

  function refreshCurrent() {
    if (!window.Sessions || !titleEl) return;
    const current = window.Sessions.getActive();
    titleEl.textContent = current ? current.title : "No session";
  }

  if (toggleBtn) toggleBtn.addEventListener("click", toggleMenu);

  if (newBtn) {
    newBtn.addEventListener("click", async () => {
      const raw = window.prompt("Name your new session");
      if (!raw || !raw.trim()) return;
      try {
        await window.Sessions.create(raw.trim());
        closeMenu();
      } catch (err) {
        console.warn("sessions: create failed", err);
      }
    });
  }

  if (listEl) {
    listEl.addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-session-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-session-id");
      if (id) {
        try { await window.Sessions.setActive(id); } catch (err) { console.warn(err); }
      }
      closeMenu();
    });
  }

  if (renameBtn) {
    renameBtn.addEventListener("click", async () => {
      const current = window.Sessions.getActive();
      if (!current) return;
      const raw = window.prompt("Rename session", current.title);
      if (!raw || !raw.trim()) return;
      try { await window.Sessions.rename(current.id, raw.trim()); } catch (err) { console.warn(err); }
      closeMenu();
    });
  }

  if (archiveBtn) {
    archiveBtn.addEventListener("click", async () => {
      const current = window.Sessions.getActive();
      if (!current) return;
      const ok = window.confirm(`Archive "${current.title}"? You can no longer see it in the list.`);
      if (!ok) return;
      try { await window.Sessions.archive(current.id); } catch (err) { console.warn(err); }
      closeMenu();
    });
  }

  document.addEventListener("click", (event) => {
    if (!menuEl || menuEl.hidden) return;
    if (bar.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("sessions:active-changed", refreshCurrent);
  // Also refresh after Sessions finishes loading the list (covers rename-only changes).
  window.addEventListener("sessions:active-changed", renderList);

  // Initial render in case Sessions is already ready.
  refreshCurrent();

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
