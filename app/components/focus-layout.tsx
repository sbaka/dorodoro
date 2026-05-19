"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatPanel } from "@/app/components/chat-panel";
import { SessionSwitcher } from "@/app/components/session-switcher";
import { SiteHeader } from "@/app/components/site-header";
import { TimerPanel } from "@/app/components/timer-panel";
import { WorkspaceTabs } from "@/app/components/workspace-tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type MobileView = "workspace" | "timer" | "assistant";

const MOBILE_BREAKPOINT_PX = 991;

export function FocusLayout() {
  const [mobileView, setMobileView] = useState<MobileView>("workspace");
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [workspaceHidden, setWorkspaceHidden] = useState(false);
  const effectiveWorkspaceHidden = !isMobileViewport && workspaceHidden;
  const mobileSwitcherStyle = isMobileViewport
    ? {
      position: "fixed" as const,
      left: "50%",
      top: "auto",
      bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
      zIndex: 40,
      display: "grid",
      width: "min(calc(100% - 1.5rem), 28rem)",
      height: "auto",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "0.4rem",
      padding: "0.45rem",
      margin: 0,
      background: "color-mix(in srgb, var(--surface-strong) 90%, var(--cream) 10%)",
      border: "var(--nb-border)",
      borderRadius: "var(--pill)",
      boxShadow: "var(--shadow)",
      transform: "translateX(-50%)",
      backdropFilter: "blur(12px)",
    }
    : undefined;

  function mobileSwitcherItemStyle(view: MobileView) {
    if (!isMobileViewport) return undefined;

    const active = mobileView === view;
    return {
      minHeight: "3.5rem",
      border: 0,
      background: active ? "var(--navy)" : "transparent",
      borderRadius: "var(--pill)",
      color: active ? "#fff" : "var(--text-muted)",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.02em",
      boxShadow: active ? "var(--shadow-sm)" : "none",
      transition: "background 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
    };
  }

  const toggleWorkspace = useCallback(() => {
    setWorkspaceHidden((prev) => !prev);
  }, []);

  const openChat = useCallback(() => {
    setChatOpen(true);
    if (isMobileViewport) {
      setMobileView("assistant");
    }
  }, [isMobileViewport]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setMobileView((prev) => (prev === "assistant" ? "timer" : prev));
  }, []);

  function selectMobileView(next: MobileView) {
    if (next === "assistant") {
      openChat();
      return;
    }
    setMobileView(next);
    if (chatOpen) setChatOpen(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT_PX}px)`,
    );
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || !chatOpen) return;
    setMobileView("assistant");
  }, [chatOpen, isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobileViewport) return;
    if (chatOpen && window.location.hash !== "#assistant") {
      window.history.pushState({ assistant: true }, "", "#assistant");
    } else if (!chatOpen && window.location.hash === "#assistant") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [chatOpen, isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onPopState() {
      if (!isMobileViewport) return;
      if (chatOpen && window.location.hash !== "#assistant") {
        setChatOpen(false);
        setMobileView((prev) => (prev === "assistant" ? "timer" : prev));
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [chatOpen, isMobileViewport]);

  return (
    <>
      <SiteHeader
        mode="focus"
        workspaceHidden={effectiveWorkspaceHidden}
        onToggleWorkspace={isMobileViewport ? undefined : toggleWorkspace}
      />

      {/* Full-width session strip — lives outside the workspace/timer grid */}
      <div className="sessions-strip">
        <SessionSwitcher />
      </div>

      <main
        className="timer-container"
        style={
          isMobileViewport
            ? { paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }
            : undefined
        }
      >
        <section
          className="focus-layout"
          data-mobile-view={mobileView}
          data-workspace-hidden={effectiveWorkspaceHidden ? "true" : "false"}
          style={
            isMobileViewport
              ? { paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }
              : undefined
          }
        >
          {isMobileViewport ? (
            <ToggleGroup
              variant="outline"
              value={[mobileView]}
              onValueChange={(values) => {
                const next = values[values.length - 1] as MobileView | undefined;
                if (!next) return;
                selectMobileView(next);
              }}
              className="mobile-panel-switcher"
              aria-label="Focus panel"
              style={mobileSwitcherStyle}
            >
              <ToggleGroupItem
                className="mobile-panel-switcher__item"
                value="workspace"
                style={mobileSwitcherItemStyle("workspace")}
              >
                Workspace
              </ToggleGroupItem>
              <ToggleGroupItem
                className="mobile-panel-switcher__item"
                value="timer"
                style={mobileSwitcherItemStyle("timer")}
              >
                Timer
              </ToggleGroupItem>
              <ToggleGroupItem
                className="mobile-panel-switcher__item"
                value="assistant"
                style={mobileSwitcherItemStyle("assistant")}
              >
                Assistant
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}

          {!effectiveWorkspaceHidden && (!isMobileViewport || mobileView === "workspace") ? (
            <aside className="focus-side-panel">
              <WorkspaceTabs />
            </aside>
          ) : null}

          {!isMobileViewport || mobileView === "timer" ? (
            <section className="timer-wrapper">
              <TimerPanel />
            </section>
          ) : null}

          {isMobileViewport && mobileView === "assistant" ? (
            <section className="assistant-mobile-view">
              <ChatPanel
                variant="inline"
                open={chatOpen}
                onOpen={openChat}
                onClose={closeChat}
              />
            </section>
          ) : null}
        </section>
      </main>

      {!isMobileViewport ? (
        <ChatPanel
          variant="sheet"
          open={chatOpen}
          onOpen={openChat}
          onClose={closeChat}
        />
      ) : null}
    </>
  );
}
