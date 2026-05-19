"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { useSettings } from "@/lib/settings/use-settings";
import { recordCompletedSession } from "@/lib/analytics/completed-sessions";
import {
  advanceAfterBreak,
  advanceAfterPomo,
  beginRunning,
  durationsFromSettings,
  initialState,
  pauseRunning,
  remainingSecondsUntil,
  resetAll,
  restartCurrentPhase,
} from "@/lib/timer/timer-state";
import {
  RECOVERY_MAX_AGE_MS,
  TIMER_PHASES,
  TIMER_PROGRESS_KEY,
  type TimerDurations,
  type TimerState,
} from "@/lib/timer/timer-types";

type SavedProgress = TimerState & { lastUpdatedMs: number };

function readSaved(): SavedProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TIMER_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (
      !parsed ||
      typeof parsed.phase !== "string" ||
      typeof parsed.lastUpdatedMs !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.lastUpdatedMs > RECOVERY_MAX_AGE_MS) {
      window.localStorage.removeItem(TIMER_PROGRESS_KEY);
      return null;
    }
    return parsed as SavedProgress;
  } catch {
    return null;
  }
}

function writeSaved(state: TimerState) {
  if (typeof window === "undefined") return;
  const saved: SavedProgress = { ...state, lastUpdatedMs: Date.now() };
  window.localStorage.setItem(TIMER_PROGRESS_KEY, JSON.stringify(saved));
}

function clearSaved() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TIMER_PROGRESS_KEY);
}

export type UseTimerResult = {
  state: TimerState;
  durations: TimerDurations;
  toggleStart: () => void;
  restart: () => void;
  skip: () => void;
  resetSession: () => void;
  isReady: boolean;
};

export function useTimer(): UseTimerResult {
  const { user } = useAuth();
  const { settings, status: settingsStatus } = useSettings();
  const durations = durationsFromSettings(settings);
  const durationsRef = useRef(durations);
  durationsRef.current = durations;

  const [state, setState] = useState<TimerState>(() =>
    readSaved() ?? initialState(durations),
  );
  const [isReady, setIsReady] = useState(false);

  const rafRef = useRef<number | null>(null);

  // Finalize when a running timer reaches zero.
  const finalize = useCallback((prev: TimerState): TimerState => {
    if (prev.phase === TIMER_PHASES.pomo) {
      return advanceAfterPomo(prev, durationsRef.current, { completed: true });
    }
    return advanceAfterBreak(prev, durationsRef.current);
  }, []);

  // On mount / when settings become ready, reconcile any recovered running timer.
  useEffect(() => {
    if (settingsStatus === "loading") return;

    setState((prev) => {
      const saved = readSaved();
      const base = saved ?? initialState(durationsRef.current);

      // If we have a running timer, project it forward.
      if (base.started && base.timerEndsAtMs) {
        const now = Date.now();
        if (base.timerEndsAtMs <= now) {
          // Expired while away.
          return finalize({ ...base, timeLeft: 0, started: false, timerEndsAtMs: null });
        }
        const remaining = remainingSecondsUntil(base.timerEndsAtMs, now);
        return { ...base, timeLeft: remaining };
      }

      return prev === base ? prev : base;
    });

    setIsReady(true);
  }, [settingsStatus, finalize]);

  // Tick loop via rAF while the timer is running.
  useEffect(() => {
    if (!state.started || !state.timerEndsAtMs) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setState((prev) => {
        if (!prev.started || !prev.timerEndsAtMs) return prev;
        const now = Date.now();
        const remaining = remainingSecondsUntil(prev.timerEndsAtMs, now);

        if (prev.timerEndsAtMs <= now) {
          return finalize({ ...prev, timeLeft: 0, started: false, timerEndsAtMs: null });
        }

        if (remaining === prev.timeLeft) return prev;
        return { ...prev, timeLeft: remaining };
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state.started, state.timerEndsAtMs, finalize]);

  // Re-sync on visibility change so a backgrounded tab catches up instantly.
  useEffect(() => {
    function reconcile() {
      setState((prev) => {
        if (!prev.started || !prev.timerEndsAtMs) return prev;
        const now = Date.now();
        if (prev.timerEndsAtMs <= now) {
          return finalize({ ...prev, timeLeft: 0, started: false, timerEndsAtMs: null });
        }
        const remaining = remainingSecondsUntil(prev.timerEndsAtMs, now);
        return remaining === prev.timeLeft ? prev : { ...prev, timeLeft: remaining };
      });
    }

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [finalize]);

  // Persist state on every meaningful change.
  useEffect(() => {
    if (state.phase === TIMER_PHASES.finished) {
      clearSaved();
      return;
    }
    if (state === initialState(durationsRef.current)) {
      clearSaved();
      return;
    }
    writeSaved(state);
  }, [state]);

  // Write completed session to RTDB the first time we reach the finished phase.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== TIMER_PHASES.finished) {
      finishedRef.current = false;
      return;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;

    const uid = user?.uid;
    if (!uid || !state.sessionStartIso) return;

    const startMs = new Date(state.sessionStartIso).getTime();
    if (Number.isNaN(startMs)) return;

    const durationMin = Math.max(
      0,
      Math.floor((Date.now() - startMs) / 60000),
    );

    void recordCompletedSession(uid, {
      date: new Date().toISOString(),
      duration: durationMin,
      completedPomos: state.completedPomos,
      pomoDuration: settings["Pomo Duration"],
      totalPomos: durationsRef.current.repetition,
    });
  }, [state.phase, state.completedPomos, state.sessionStartIso, user, settings]);

  const toggleStart = useCallback(() => {
    setState((prev) => {
      const now = Date.now();
      if (prev.phase === TIMER_PHASES.finished) {
        return beginRunning(
          resetAll(durationsRef.current),
          now,
        );
      }
      if (prev.started) return pauseRunning(prev, now);
      return beginRunning(prev, now);
    });
  }, []);

  const restart = useCallback(() => {
    setState((prev) => restartCurrentPhase(prev, durationsRef.current));
  }, []);

  const skip = useCallback(() => {
    setState((prev) => {
      if (prev.phase === TIMER_PHASES.pomo) {
        return advanceAfterPomo(prev, durationsRef.current, { completed: false });
      }
      if (
        prev.phase === TIMER_PHASES.shortBreak ||
        prev.phase === TIMER_PHASES.longBreak
      ) {
        return advanceAfterBreak(prev, durationsRef.current);
      }
      return prev;
    });
  }, []);

  const resetSession = useCallback(() => {
    setState(() => resetAll(durationsRef.current));
    clearSaved();
  }, []);

  // If settings change while idle, refresh timeLeft to match the new durations.
  useEffect(() => {
    setState((prev) => {
      if (prev.started) return prev;
      if (prev.phase !== TIMER_PHASES.pomo) return prev;
      if (prev.count !== 1 || prev.completedPomos !== 0) return prev;
      if (prev.timeLeft === durations.pomoSec) return prev;
      return { ...prev, timeLeft: durations.pomoSec };
    });
  }, [durations.pomoSec]);

  return { state, durations, toggleStart, restart, skip, resetSession, isReady };
}
