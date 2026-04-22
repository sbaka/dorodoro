(function (global) {
  "use strict";

  const CACHE_KEY = "focusBoard.cache.v1";
  const UI_CACHE_KEY = "focusBoard.ui.v1";
  const REMOTE_KEY = "focusBoard";
  const SAVE_DELAY_MS = 500;
  const EMPTY_DELTA = { ops: [{ insert: "\n" }] };
  const boardColumnsEl = document.getElementById("focus-board-columns");
  const boardEmptyEl = document.getElementById("focus-board-empty");
  const focusLayoutEl = document.querySelector(".focus-layout");
  const focusSidePanelEl = document.getElementById("focus-side-panel");
  const focusBoardEl = document.getElementById("focus-board");
  const focusOverviewEl = document.getElementById("focus-overview-card");
  const timerWrapperEl = document.getElementById("timer-wrapper");
  const addColumnButton = document.getElementById("add-column-button");
  const emptyAddColumnButton = document.getElementById("empty-add-column-button");
  const workspaceToggleButtons = Array.from(document.querySelectorAll("[data-workspace-toggle]"));
  const mobilePanelSwitcherEl = document.getElementById("mobile-panel-switcher");
  const dialogEl = document.getElementById("board-column-dialog");
  const dialogForm = document.getElementById("board-column-form");
  const dialogTitleInput = document.getElementById("board-column-title");
  const dialogTypeInput = document.getElementById("board-column-type");
  const dialogCancelButton = document.getElementById("board-column-cancel");
  const overlayEl = document.getElementById("overlay");
  const mobileViewButtons = mobilePanelSwitcherEl
    ? Array.from(mobilePanelSwitcherEl.querySelectorAll(".mobile-panel-button"))
    : [];

  if (!boardColumnsEl || !boardEmptyEl || !dialogEl || !dialogForm || !dialogTitleInput || !dialogTypeInput) {
    return;
  }

  let boardState = createEmptyBoard();
  let uiState = createDefaultUiState();
  let currentUser = null;
  let syncReady = false;
  let saveTimer = null;
  const editors = new Map();

  boot();

  function boot() {
    boardState = readCachedBoard() || createEmptyBoard();
    uiState = readCachedUiState();
    syncUiState();
    applyWorkspaceMode();
    applyMobileView();
    renderBoard();
    bindEvents();
    attachAuthSync();
  }

  function bindEvents() {
    if (addColumnButton) {
      addColumnButton.addEventListener("click", openDialog);
    }

    if (emptyAddColumnButton) {
      emptyAddColumnButton.addEventListener("click", openDialog);
    }

    workspaceToggleButtons.forEach((button) => {
      button.addEventListener("click", toggleWorkspaceMode);
    });

    if (mobilePanelSwitcherEl) {
      mobilePanelSwitcherEl.addEventListener("click", handleMobilePanelSwitch);
    }

    dialogForm.addEventListener("submit", handleCreateColumn);

    if (dialogCancelButton) {
      dialogCancelButton.addEventListener("click", closeDialog);
    }

    if (overlayEl) {
      overlayEl.addEventListener("click", closeDialog);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    });

    boardColumnsEl.addEventListener("click", handleBoardClick);
    boardColumnsEl.addEventListener("submit", handleBoardSubmit);
    boardColumnsEl.addEventListener("input", handleBoardInput);
    boardColumnsEl.addEventListener("change", handleBoardChange);
    boardColumnsEl.addEventListener("keydown", handleBoardKeydown);
    boardColumnsEl.addEventListener("focusout", handleBoardFocusOut);

    window.addEventListener("storage", (event) => {
      if (event.key !== CACHE_KEY || !event.newValue) {
        return;
      }

      try {
        boardState = normalizeBoard(JSON.parse(event.newValue));
        syncUiState();
        renderBoard();
      } catch (error) {
        console.warn("board: failed to parse storage update", error);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== UI_CACHE_KEY || !event.newValue) {
        return;
      }

      try {
        uiState = normalizeUiState(JSON.parse(event.newValue));
        syncUiState();
        applyWorkspaceMode();
        applyMobileView();
        renderBoard();
      } catch (error) {
        console.warn("board: failed to parse UI state update", error);
      }
    });
  }

  function attachAuthSync() {
    if (typeof firebase === "undefined" || !firebase.auth) {
      return;
    }

    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user || null;
      syncReady = false;

      if (!currentUser) {
        return;
      }

      fetchRemoteBoard(currentUser)
        .then((remoteBoard) => {
          const localBoard = readCachedBoard() || boardState;

          if (localBoard.updatedAt > remoteBoard.updatedAt) {
            boardState = localBoard;
            syncReady = true;
            renderBoard();
            persistBoard(true);
            return;
          }

          boardState = remoteBoard.updatedAt ? remoteBoard : localBoard;
          syncReady = true;
          cacheBoard();
          renderBoard();

          if (!remoteBoard.updatedAt && localBoard.updatedAt) {
            persistBoard(true);
          }
        })
        .catch((error) => {
          console.warn("board: remote load failed", error);
          syncReady = true;
          renderBoard();
        });
    });
  }

  function createEmptyBoard() {
    return {
      updatedAt: 0,
      columns: [],
    };
  }

  function createDefaultUiState() {
    return {
      activeColumnId: "",
      mobileView: "workspace",
      workspaceHidden: false,
    };
  }

  function normalizeBoard(raw) {
    const base = raw && typeof raw === "object" ? raw : {};
    const columns = Array.isArray(base.columns) ? base.columns.map(normalizeColumn) : [];
    columns.sort((left, right) => left.order - right.order);
    columns.forEach((column, index) => {
      column.order = index;
      if (column.type === "todos") {
        column.items.sort((left, right) => left.order - right.order);
        column.items.forEach((item, itemIndex) => {
          item.order = itemIndex;
        });
      }
    });

    return {
      updatedAt: Number(base.updatedAt) || 0,
      columns,
    };
  }

  function normalizeColumn(raw, index) {
    const base = raw && typeof raw === "object" ? raw : {};
    const type = base.type === "todos" ? "todos" : "notes";
    const column = {
      id: typeof base.id === "string" && base.id ? base.id : createId("column"),
      type,
      title: sanitizeTitle(base.title, type),
      order: Number.isFinite(base.order) ? Number(base.order) : index || 0,
      createdAt: Number(base.createdAt) || Date.now(),
      updatedAt: Number(base.updatedAt) || Date.now(),
    };

    if (type === "notes") {
      const contentDelta = normalizeDelta(base.contentDelta || base.content || base.delta);
      column.contentDelta = contentDelta;
      column.textPreview = typeof base.textPreview === "string" && base.textPreview.trim()
        ? base.textPreview.trim()
        : extractPlainText(contentDelta);
      return column;
    }

    column.items = Array.isArray(base.items) ? base.items.map(normalizeTodoItem) : [];
    return column;
  }

  function normalizeTodoItem(raw, index) {
    const base = raw && typeof raw === "object" ? raw : {};
    return {
      id: typeof base.id === "string" && base.id ? base.id : createId("todo"),
      text: typeof base.text === "string" ? base.text.slice(0, 160) : "",
      done: !!base.done,
      priority: normalizePriority(base.priority),
      order: Number.isFinite(base.order) ? Number(base.order) : index || 0,
    };
  }

  function normalizeDelta(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.ops)) {
      return clone(EMPTY_DELTA);
    }
    return clone(raw);
  }

  function sanitizeTitle(value, type) {
    const title = typeof value === "string" ? value.trim().slice(0, 40) : "";
    if (title) {
      return title;
    }
    return type === "todos" ? "Todo column" : "Notes column";
  }

  function normalizePriority(value) {
    if (value === "low" || value === "high") {
      return value;
    }
    return "medium";
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeUiState(raw) {
    const base = raw && typeof raw === "object" ? raw : {};
    return {
      activeColumnId: typeof base.activeColumnId === "string" ? base.activeColumnId : "",
      mobileView: base.mobileView === "timer" ? "timer" : "workspace",
      workspaceHidden: !!base.workspaceHidden,
    };
  }

  function readCachedBoard() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        return null;
      }
      return normalizeBoard(JSON.parse(raw));
    } catch (error) {
      console.warn("board: failed to parse cache", error);
      return null;
    }
  }

  function readCachedUiState() {
    try {
      const raw = localStorage.getItem(UI_CACHE_KEY);
      if (!raw) {
        return createDefaultUiState();
      }
      return normalizeUiState(JSON.parse(raw));
    } catch (error) {
      console.warn("board: failed to parse UI state cache", error);
      return createDefaultUiState();
    }
  }

  function cacheBoard() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(boardState));
    } catch (error) {
      console.warn("board: failed to cache board", error);
    }
  }

  function cacheUiState() {
    try {
      localStorage.setItem(UI_CACHE_KEY, JSON.stringify(uiState));
    } catch (error) {
      console.warn("board: failed to cache UI state", error);
    }
  }

  function fetchRemoteBoard(user) {
    const db = getDb();
    if (!db || !user) {
      return Promise.resolve(createEmptyBoard());
    }

    return db
      .ref(`users/${user.uid}/${REMOTE_KEY}`)
      .once("value")
      .then((snapshot) => normalizeBoard(snapshot.val()));
  }

  function getDb() {
    try {
      return typeof firebase !== "undefined" && firebase.database ? firebase.database() : null;
    } catch (_) {
      return null;
    }
  }

  function openDialog() {
    dialogForm.reset();
    dialogTitleInput.value = "";
    dialogTypeInput.value = "notes";
    showDialog(dialogEl);
    if (overlayEl) {
      showDialog(overlayEl, "block");
    }
    dialogTitleInput.focus();
  }

  function closeDialog() {
    hideDialog(dialogEl);
  }

  function showDialog(element, display = "flex") {
    if (!element) {
      return;
    }

    element.classList.add("show");
    element.style.display = display;
    element.style.visibility = "visible";
    element.style.opacity = "1";
  }

  function hideDialog(element) {
    if (!element) {
      return;
    }

    element.classList.remove("show");
    element.style.display = "none";
    element.style.visibility = "hidden";
    element.style.opacity = "0";

    if (element === dialogEl && overlayEl) {
      overlayEl.style.display = "none";
      overlayEl.style.visibility = "hidden";
      overlayEl.style.opacity = "0";
      overlayEl.classList.remove("show");
    }
  }

  function handleCreateColumn(event) {
    event.preventDefault();

    const title = sanitizeTitle(dialogTitleInput.value, dialogTypeInput.value);
    const type = dialogTypeInput.value === "todos" ? "todos" : "notes";
    const now = Date.now();
    const column = {
      id: createId(type === "todos" ? "todo-column" : "note-column"),
      type,
      title,
      order: boardState.columns.length,
      createdAt: now,
      updatedAt: now,
    };

    if (type === "notes") {
      column.contentDelta = clone(EMPTY_DELTA);
      column.textPreview = "";
    } else {
      column.items = [];
    }

    syncEditorsIntoState();
    boardState.columns.push(column);
    uiState.activeColumnId = column.id;
    touchBoard();
    cacheBoard();
    cacheUiState();
    closeDialog();
    renderBoard();
    persistBoard();
  }

  function handleBoardClick(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const columnId = actionButton.getAttribute("data-column-id");
    const itemId = actionButton.getAttribute("data-item-id");
    const action = actionButton.getAttribute("data-action");

    if (action === "delete-column") {
      deleteColumn(columnId);
      return;
    }

    if (action === "move-column-left" || action === "move-column-right") {
      moveColumn(columnId, action === "move-column-left" ? -1 : 1);
      return;
    }

    if (action === "activate-column") {
      activateColumn(columnId);
      return;
    }

    if (action === "open-create-column") {
      openDialog();
      return;
    }

    if (action === "edit-column-title") {
      beginColumnTitleEdit(columnId);
      return;
    }

    if (action === "delete-todo") {
      deleteTodo(columnId, itemId);
      return;
    }

    if (action === "move-todo-up" || action === "move-todo-down") {
      moveTodo(columnId, itemId, action === "move-todo-up" ? -1 : 1);
    }
  }

  function handleBoardSubmit(event) {
    const form = event.target.closest(".todo-add-form");
    if (!form) {
      return;
    }

    event.preventDefault();
    const columnId = form.getAttribute("data-column-id");
    const input = form.querySelector(".todo-add-input");
    if (!input) {
      return;
    }

    const text = input.value.trim();
    if (!text) {
      return;
    }

    addTodoItem(columnId, text);
    input.value = "";
  }

  function handleBoardInput(event) {
    const todoTextInput = event.target.closest(".todo-item-text");
    if (todoTextInput) {
      const item = findTodo(todoTextInput.getAttribute("data-column-id"), todoTextInput.getAttribute("data-item-id"));
      if (!item) {
        return;
      }
      item.text = todoTextInput.value.slice(0, 160);
      touchBoard();
      persistBoard();
    }
  }

  function handleBoardKeydown(event) {
    const titleInput = event.target.closest(".column-title-input");
    if (!titleInput) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      finishColumnTitleEdit(titleInput);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      finishColumnTitleEdit(titleInput, { cancel: true });
    }
  }

  function handleBoardFocusOut(event) {
    const titleInput = event.target.closest(".column-title-input");
    if (!titleInput) {
      return;
    }

    const panel = titleInput.closest(".board-column");
    if (!panel || !panel.classList.contains("is-editing-title")) {
      return;
    }

    finishColumnTitleEdit(titleInput);
  }

  function handleBoardChange(event) {
    const checkbox = event.target.closest(".todo-item-check");
    if (checkbox) {
      const item = findTodo(checkbox.getAttribute("data-column-id"), checkbox.getAttribute("data-item-id"));
      if (!item) {
        return;
      }
      item.done = checkbox.checked;
      const todoRow = checkbox.closest(".todo-item");
      if (todoRow) {
        todoRow.classList.toggle("is-done", item.done);
      }
      touchBoard();
      persistBoard();
      return;
    }

    const priorityInput = event.target.closest(".todo-item-priority");
    if (priorityInput) {
      const item = findTodo(priorityInput.getAttribute("data-column-id"), priorityInput.getAttribute("data-item-id"));
      if (!item) {
        return;
      }
      item.priority = normalizePriority(priorityInput.value);
      priorityInput.value = item.priority;

      const todoRow = priorityInput.closest(".todo-item");
      if (todoRow) {
        syncTodoPriorityClass(todoRow, item.priority);
      }

      touchBoard();
      persistBoard();
    }
  }

  function deleteColumn(columnId) {
    syncEditorsIntoState();
    const removedIndex = boardState.columns.findIndex((column) => column.id === columnId);
    boardState.columns = boardState.columns.filter((column) => column.id !== columnId);
    normalizeColumnOrder();
    if (uiState.activeColumnId === columnId) {
      const nextColumn = boardState.columns[removedIndex] || boardState.columns[removedIndex - 1] || boardState.columns[0] || null;
      uiState.activeColumnId = nextColumn ? nextColumn.id : "";
      cacheUiState();
    }
    touchBoard();
    cacheBoard();
    renderBoard();
    persistBoard();
  }

  function moveColumn(columnId, direction) {
    syncEditorsIntoState();
    const index = boardState.columns.findIndex((column) => column.id === columnId);
    if (index < 0) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= boardState.columns.length) {
      return;
    }

    const columns = boardState.columns.slice();
    const temp = columns[index];
    columns[index] = columns[nextIndex];
    columns[nextIndex] = temp;
    boardState.columns = columns;
    normalizeColumnOrder();
    touchBoard();
    cacheBoard();
    renderBoard();
    persistBoard();
  }

  function activateColumn(columnId) {
    if (!findColumn(columnId) || uiState.activeColumnId === columnId) {
      return;
    }

    syncEditorsIntoState();
    uiState.activeColumnId = columnId;
    cacheBoard();
    cacheUiState();
    renderBoard();
  }

  function addTodoItem(columnId, text) {
    const column = findColumn(columnId);
    if (!column || column.type !== "todos") {
      return;
    }

    column.items.push({
      id: createId("todo"),
      text: text.slice(0, 160),
      done: false,
      priority: "medium",
      order: column.items.length,
    });

    column.updatedAt = Date.now();
    touchBoard();
    cacheBoard();
    renderBoard();
    persistBoard();
  }

  function deleteTodo(columnId, itemId) {
    const column = findColumn(columnId);
    if (!column || column.type !== "todos") {
      return;
    }

    column.items = column.items.filter((item) => item.id !== itemId);
    normalizeTodoOrder(column);
    column.updatedAt = Date.now();
    touchBoard();
    cacheBoard();
    renderBoard();
    persistBoard();
  }

  function moveTodo(columnId, itemId, direction) {
    const column = findColumn(columnId);
    if (!column || column.type !== "todos") {
      return;
    }

    const index = column.items.findIndex((item) => item.id === itemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= column.items.length) {
      return;
    }

    const items = column.items.slice();
    const temp = items[index];
    items[index] = items[nextIndex];
    items[nextIndex] = temp;
    column.items = items;
    normalizeTodoOrder(column);
    column.updatedAt = Date.now();
    touchBoard();
    cacheBoard();
    renderBoard();
    persistBoard();
  }

  function findColumn(columnId) {
    return boardState.columns.find((column) => column.id === columnId) || null;
  }

  function findTodo(columnId, itemId) {
    const column = findColumn(columnId);
    if (!column || column.type !== "todos") {
      return null;
    }
    return column.items.find((item) => item.id === itemId) || null;
  }

  function syncTodoPriorityClass(todoRow, priority) {
    todoRow.classList.remove("todo-item-priority-low", "todo-item-priority-medium", "todo-item-priority-high");
    todoRow.classList.add(`todo-item-priority-${priority}`);
  }

  function getColumnPanel(columnId) {
    return boardColumnsEl.querySelector(`.board-column[data-column-id="${columnId}"]`);
  }

  function beginColumnTitleEdit(columnId) {
    const column = findColumn(columnId);
    const panel = getColumnPanel(columnId);
    if (!column || !panel) {
      return;
    }

    const input = panel.querySelector(".column-title-input");
    if (!input) {
      return;
    }

    panel.classList.add("is-editing-title");
    input.value = column.title;
    input.dataset.initialValue = column.title;

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function finishColumnTitleEdit(input, options = {}) {
    const columnId = input.getAttribute("data-column-id");
    const column = findColumn(columnId);
    if (!column) {
      endColumnTitleEdit(columnId);
      return;
    }

    const initialValue = input.dataset.initialValue || column.title;
    const nextTitle = options.cancel ? initialValue : sanitizeTitle(input.value, column.type);
    const hasChanged = nextTitle !== column.title;

    input.value = nextTitle;
    syncColumnTitleDisplay(columnId, nextTitle);
    syncTabTitle(columnId, nextTitle);

    if (hasChanged) {
      column.title = nextTitle;
      column.updatedAt = Date.now();
      touchBoard();
      persistBoard();
    }

    endColumnTitleEdit(columnId, options.cancel);
  }

  function endColumnTitleEdit(columnId, focusDisplay = false) {
    const panel = getColumnPanel(columnId);
    if (!panel) {
      return;
    }

    panel.classList.remove("is-editing-title");

    const input = panel.querySelector(".column-title-input");
    if (input) {
      input.dataset.initialValue = "";
    }

    if (!focusDisplay) {
      return;
    }

    const displayButton = panel.querySelector(".column-title-display");
    if (displayButton) {
      displayButton.focus();
    }
  }

  function normalizeColumnOrder() {
    boardState.columns.forEach((column, index) => {
      column.order = index;
    });
  }

  function normalizeTodoOrder(column) {
    column.items.forEach((item, index) => {
      item.order = index;
    });
  }

  function touchBoard() {
    boardState.updatedAt = Date.now();
  }

  function persistBoard(immediate) {
    syncEditorsIntoState();
    cacheBoard();

    if (!currentUser || !syncReady) {
      return;
    }

    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (immediate) {
      pushRemoteBoard();
      return;
    }

    saveTimer = setTimeout(pushRemoteBoard, SAVE_DELAY_MS);
  }

  function pushRemoteBoard() {
    saveTimer = null;

    if (!currentUser || !syncReady) {
      return;
    }

    const db = getDb();
    if (!db) {
      return;
    }

    db.ref(`users/${currentUser.uid}/${REMOTE_KEY}`)
      .set(clone(boardState))
      .catch((error) => {
        console.warn("board: failed to save board", error);
      });
  }

  function syncEditorsIntoState() {
    editors.forEach((editor, columnId) => {
      const column = findColumn(columnId);
      if (!column || column.type !== "notes") {
        return;
      }

      column.contentDelta = editor.getContents();
      column.textPreview = extractPlainText(column.contentDelta);
      column.updatedAt = Date.now();
    });
  }

  function syncUiState() {
    const columns = boardState.columns.slice().sort((left, right) => left.order - right.order);
    const hasActiveColumn = columns.some((column) => column.id === uiState.activeColumnId);

    if (uiState.mobileView !== "timer" && uiState.mobileView !== "workspace") {
      uiState.mobileView = "workspace";
      cacheUiState();
    }

    if (!columns.length) {
      uiState.activeColumnId = "";
      uiState.workspaceHidden = false;
      cacheUiState();
      return;
    }

    if (!hasActiveColumn) {
      uiState.activeColumnId = columns[0].id;
      cacheUiState();
    }
  }

  function applyWorkspaceMode() {
    if (!focusSidePanelEl || !focusBoardEl || !focusOverviewEl) {
      return;
    }

    const isHidden = !!uiState.workspaceHidden;

    focusSidePanelEl.setAttribute("data-mode", isHidden ? "overview" : "workspace");
    focusBoardEl.hidden = isHidden;
    focusOverviewEl.hidden = !isHidden;

    workspaceToggleButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(isHidden));
      button.innerHTML = isHidden
        ? '<i class="fa-solid fa-eye button-icon" aria-hidden="true"></i> Show workspace'
        : '<i class="fa-solid fa-eye-slash button-icon" aria-hidden="true"></i> Hide workspace';
    });
  }

  function applyMobileView() {
    const mobileView = uiState.mobileView === "timer" ? "timer" : "workspace";

    if (focusLayoutEl) {
      focusLayoutEl.setAttribute("data-mobile-view", mobileView);
    }

    if (focusSidePanelEl) {
      focusSidePanelEl.setAttribute("data-mobile-visible", String(mobileView === "workspace"));
    }

    if (timerWrapperEl) {
      timerWrapperEl.setAttribute("data-mobile-visible", String(mobileView === "timer"));
    }

    mobileViewButtons.forEach((button) => {
      const isActive = button.getAttribute("data-mobile-view") === mobileView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function handleMobilePanelSwitch(event) {
    const button = event.target.closest(".mobile-panel-button");
    if (!button) {
      return;
    }

    setMobileView(button.getAttribute("data-mobile-view"));
  }

  function setMobileView(nextView) {
    const mobileView = nextView === "timer" ? "timer" : "workspace";
    if (uiState.mobileView === mobileView) {
      return;
    }

    uiState.mobileView = mobileView;
    cacheUiState();
    applyMobileView();
  }

  function isCompactViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 991px)").matches;
  }

  function toggleWorkspaceMode() {
    uiState.workspaceHidden = !uiState.workspaceHidden;

    if (isCompactViewport()) {
      uiState.mobileView = uiState.workspaceHidden ? "timer" : "workspace";
    }

    cacheUiState();
    applyWorkspaceMode();
    applyMobileView();
  }

  function renderBoard() {
    syncEditorsIntoState();
    editors.clear();

    const columns = boardState.columns.slice().sort((left, right) => left.order - right.order);
    syncUiState();
    applyWorkspaceMode();

    boardEmptyEl.hidden = columns.length > 0;
    boardColumnsEl.hidden = columns.length === 0;

    if (!columns.length) {
      boardColumnsEl.innerHTML = "";
      return;
    }

    const activeColumn = columns.find((column) => column.id === uiState.activeColumnId) || columns[0];
    const activeIndex = columns.findIndex((column) => column.id === activeColumn.id);

    boardColumnsEl.innerHTML = `<div class="board-tabs-shell">
      <div class="board-tabs" role="tablist" aria-label="Workspace tabs">
        ${columns.map((column) => renderTab(column, column.id === activeColumn.id)).join("")}
        ${renderAddTabButton()}
      </div>
      <div class="board-panel-stage">
        ${renderColumn(activeColumn, activeIndex, columns.length)}
      </div>
    </div>`;

    initNoteEditors();
  }

  function renderTab(column, isActive) {
    const iconClass = column.type === "todos" ? "fa-list-check" : "fa-note-sticky";

    return `<button class="board-tab-button ${isActive ? "is-active" : ""}" type="button" data-action="activate-column" data-column-id="${escapeHtml(column.id)}" role="tab" aria-selected="${isActive ? "true" : "false"}" aria-controls="workspace-panel-${escapeHtml(column.id)}" id="workspace-tab-${escapeHtml(column.id)}">
      <span class="board-tab-icon" aria-hidden="true"><i class="fa-solid ${iconClass}"></i></span>
      <span class="board-tab-copy">
        <span class="board-tab-type">${column.type === "todos" ? "Todo" : "Notes"}</span>
        <span class="board-tab-title" data-tab-title-for="${escapeHtml(column.id)}">${escapeHtml(column.title)}</span>
      </span>
    </button>`;
  }

  function renderAddTabButton() {
    return `<button class="board-tab-create-button" type="button" data-action="open-create-column" aria-label="Add a new tab">
      <span class="board-tab-create-plus" aria-hidden="true">+</span>
    </button>`;
  }

  function renderColumn(column, index, totalColumns) {
    return `<article class="board-column board-column-${escapeHtml(column.type)}" id="workspace-panel-${escapeHtml(column.id)}" data-column-id="${escapeHtml(column.id)}" role="tabpanel" aria-labelledby="workspace-tab-${escapeHtml(column.id)}">
      <div class="board-column-header">
        <div class="board-column-meta">
          <div class="column-title-shell">
            <button class="column-title-display" type="button" data-action="edit-column-title" data-column-id="${escapeHtml(column.id)}" aria-label="Rename tab ${escapeAttribute(column.title)}">
              <span class="column-title-label" data-column-title-for="${escapeHtml(column.id)}">${escapeHtml(column.title)}</span>
              <span class="column-title-edit-icon" aria-hidden="true"><i class="fa-solid fa-pen"></i></span>
            </button>
            <input class="column-title-input" type="text" data-column-id="${escapeHtml(column.id)}" value="${escapeAttribute(column.title)}" maxlength="40" aria-label="Tab title">
          </div>
        </div>
        <div class="board-column-actions">
          <button class="column-icon-button" type="button" data-action="move-column-left" data-column-id="${escapeHtml(column.id)}" aria-label="Move tab left" ${index === 0 ? "disabled" : ""}>
            <i class="fa-solid fa-arrow-left button-icon" aria-hidden="true"></i>
          </button>
          <button class="column-icon-button" type="button" data-action="move-column-right" data-column-id="${escapeHtml(column.id)}" aria-label="Move tab right" ${index === totalColumns - 1 ? "disabled" : ""}>
            <i class="fa-solid fa-arrow-right button-icon" aria-hidden="true"></i>
          </button>
          <button class="column-icon-button danger" type="button" data-action="delete-column" data-column-id="${escapeHtml(column.id)}" aria-label="Delete tab">
            <i class="fa-solid fa-trash button-icon" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      ${column.type === "todos" ? renderTodoColumn(column) : renderNotesColumn(column)}
    </article>`;
  }

  function renderNotesColumn(column) {
    return `<div class="board-notes-editor-shell">
      ${renderNotesToolbar(column.id)}
      <div class="board-notes-editor" id="${escapeHtml(editorId(column.id))}"></div>
    </div>`;
  }

  function renderNotesToolbar(columnId) {
    return `<div class="board-notes-toolbar ql-toolbar ql-snow" id="${escapeHtml(toolbarId(columnId))}">
      <span class="ql-formats">
        <select class="ql-header" aria-label="Heading size">
          <option selected></option>
          <option value="2">Heading</option>
          <option value="3">Subheading</option>
        </select>
      </span>
      <span class="ql-formats">
        <button type="button" class="ql-bold" aria-label="Bold"><i class="fa-solid fa-bold button-icon" aria-hidden="true"></i></button>
        <button type="button" class="ql-italic" aria-label="Italic"><i class="fa-solid fa-italic button-icon" aria-hidden="true"></i></button>
        <button type="button" class="ql-underline" aria-label="Underline"><i class="fa-solid fa-underline button-icon" aria-hidden="true"></i></button>
      </span>
      <span class="ql-formats">
        <button type="button" class="ql-list" value="ordered" aria-label="Numbered list"><i class="fa-solid fa-list-ol button-icon" aria-hidden="true"></i></button>
        <button type="button" class="ql-list" value="bullet" aria-label="Bullet list"><i class="fa-solid fa-list-ul button-icon" aria-hidden="true"></i></button>
        <button type="button" class="ql-blockquote" aria-label="Block quote"><i class="fa-solid fa-quote-left button-icon" aria-hidden="true"></i></button>
      </span>
      <span class="ql-formats">
        <button type="button" class="ql-link" aria-label="Insert link"><i class="fa-solid fa-link button-icon" aria-hidden="true"></i></button>
        <button type="button" class="ql-clean" aria-label="Clear formatting"><i class="fa-solid fa-eraser button-icon" aria-hidden="true"></i></button>
      </span>
    </div>`;
  }

  function renderTodoColumn(column) {
    const items = column.items.slice().sort((left, right) => left.order - right.order);
    return `<div class="todo-column-shell">
      <div class="todo-column-content">
        <ul class="todo-list">
          ${items.length ? items.map((item) => renderTodoItem(column.id, item, item.order, items.length)).join("") : '<li class="todo-empty">No tasks yet. Add one to get started.</li>'}
        </ul>
      </div>
      <form class="todo-add-form" data-column-id="${escapeHtml(column.id)}">
        <input class="todo-add-input" type="text" maxlength="160" placeholder="Add a task" aria-label="Add a task">
        <button class="todo-add-button" type="submit">Add</button>
      </form>
    </div>`;
  }

  function renderTodoItem(columnId, item, index, totalItems) {
    return `<li class="todo-item todo-item-priority-${escapeHtml(item.priority)} ${item.done ? "is-done" : ""}">
      <div class="todo-item-main">
        <span class="todo-item-check-wrap">
          <input class="todo-item-check" type="checkbox" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} aria-label="Mark task complete">
        </span>
        <div class="todo-item-copy">
          <input class="todo-item-text" type="text" maxlength="160" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" value="${escapeAttribute(item.text)}" aria-label="Todo item text">
        </div>
      </div>
      <div class="todo-item-controls" role="group" aria-label="Task actions">
        <select class="todo-item-priority" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" aria-label="Priority">
          ${renderPriorityOptions(item.priority)}
        </select>
        <button class="column-icon-button" type="button" data-action="move-todo-up" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" aria-label="Move task up" ${index === 0 ? "disabled" : ""}>
          <i class="fa-solid fa-arrow-up button-icon" aria-hidden="true"></i>
        </button>
        <button class="column-icon-button" type="button" data-action="move-todo-down" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" aria-label="Move task down" ${index === totalItems - 1 ? "disabled" : ""}>
          <i class="fa-solid fa-arrow-down button-icon" aria-hidden="true"></i>
        </button>
        <button class="column-icon-button danger" type="button" data-action="delete-todo" data-column-id="${escapeHtml(columnId)}" data-item-id="${escapeHtml(item.id)}" aria-label="Delete task">
          <i class="fa-solid fa-xmark button-icon" aria-hidden="true"></i>
        </button>
      </div>
    </li>`;
  }

  function renderPriorityOptions(priority) {
    return ["low", "medium", "high"]
      .map((option) => `<option value="${option}" ${priority === option ? "selected" : ""}>${option}</option>`)
      .join("");
  }

  function initNoteEditors() {
    if (typeof Quill === "undefined") {
      return;
    }

    boardState.columns.forEach((column) => {
      if (column.type !== "notes") {
        return;
      }

      const host = document.getElementById(editorId(column.id));
      if (!host) {
        return;
      }

      const editor = new Quill(host, {
        theme: "snow",
        placeholder: "Capture formulas, reading notes, outlines, or reminders.",
        modules: {
          toolbar: `#${toolbarId(column.id)}`,
        },
      });

      editor.setContents(clone(column.contentDelta || EMPTY_DELTA));
      editor.on("text-change", () => {
        const currentColumn = findColumn(column.id);
        if (!currentColumn) {
          return;
        }
        currentColumn.contentDelta = editor.getContents();
        currentColumn.textPreview = extractPlainText(currentColumn.contentDelta);
        currentColumn.updatedAt = Date.now();
        touchBoard();
        persistBoard();
      });

      editors.set(column.id, editor);
    });
  }

  function editorId(columnId) {
    return `notes-editor-${columnId}`;
  }

  function toolbarId(columnId) {
    return `notes-toolbar-${columnId}`;
  }

  function extractPlainText(delta) {
    if (!delta || !Array.isArray(delta.ops)) {
      return "";
    }

    const text = delta.ops
      .map((operation) => (typeof operation.insert === "string" ? operation.insert : " "))
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 160);
  }

  function syncTabTitle(columnId, title) {
    const tabTitleEl = boardColumnsEl.querySelector(`[data-tab-title-for="${columnId}"]`);
    if (tabTitleEl) {
      tabTitleEl.textContent = title;
    }
  }

  function syncColumnTitleDisplay(columnId, title) {
    const titleLabel = boardColumnsEl.querySelector(`[data-column-title-for="${columnId}"]`);
    if (titleLabel) {
      titleLabel.textContent = title;
    }

    const displayButton = boardColumnsEl.querySelector(`.column-title-display[data-column-id="${columnId}"]`);
    if (displayButton) {
      displayButton.setAttribute("aria-label", `Rename tab ${title}`);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  global.FocusBoard = {
    readCachedBoard,
  };
})(window);