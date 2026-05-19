import {
  TIMER_PHASES,
  minToSec,
  type TimerDurations,
  type TimerPhase,
  type TimerState,
} from "@/lib/timer/timer-types";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings/settings";

const TIMER_SPEED_MULTIPLIER = process.env.NODE_ENV === "development" ? 25 : 1;

export function durationsFromSettings(settings: Settings): TimerDurations {
  const parse = (key: keyof Settings) => {
    const fallback = Number.parseInt(DEFAULT_SETTINGS[key], 10);
    const value = Number.parseInt(settings[key], 10);
    return Number.isNaN(value) ? fallback : value;
  };

  return {
    pomoSec: minToSec(parse("Pomo Duration")),
    shortBreakSec: minToSec(parse("Short Break Duration")),
    longBreakSec: minToSec(parse("Long Break Duration")),
    longBreakInterval: parse("Long Break Interval"),
    repetition: parse("Number Of Pomos"),
  };
}

export function initialState(durations: TimerDurations): TimerState {
  return {
    phase: TIMER_PHASES.pomo,
    count: 1,
    completedPomos: 0,
    timeLeft: durations.pomoSec,
    started: false,
    timerEndsAtMs: null,
    sessionStartIso: null,
  };
}

function durationForPhase(phase: TimerPhase, durations: TimerDurations): number {
  if (phase === TIMER_PHASES.pomo) return durations.pomoSec;
  if (phase === TIMER_PHASES.shortBreak) return durations.shortBreakSec;
  if (phase === TIMER_PHASES.longBreak) return durations.longBreakSec;
  return 0;
}

/**
 * Advance the state machine after a pomo or break phase ends (either by
 * timer completion or a user-initiated skip). Returns the next state.
 */
export function advanceAfterPomo(
  state: TimerState,
  durations: TimerDurations,
  { completed }: { completed: boolean },
): TimerState {
  const completedPomos = completed ? state.completedPomos + 1 : state.completedPomos;

  if (state.count >= durations.repetition) {
    return {
      ...state,
      phase: TIMER_PHASES.finished,
      completedPomos,
      timeLeft: 0,
      started: false,
      timerEndsAtMs: null,
    };
  }

  const nextPhase: TimerPhase =
    state.count % durations.longBreakInterval === 0
      ? TIMER_PHASES.longBreak
      : TIMER_PHASES.shortBreak;

  return {
    ...state,
    phase: nextPhase,
    completedPomos,
    timeLeft: durationForPhase(nextPhase, durations),
    started: false,
    timerEndsAtMs: null,
  };
}

export function advanceAfterBreak(
  state: TimerState,
  durations: TimerDurations,
): TimerState {
  if (state.count >= durations.repetition) {
    return {
      ...state,
      phase: TIMER_PHASES.finished,
      timeLeft: 0,
      started: false,
      timerEndsAtMs: null,
    };
  }

  return {
    ...state,
    phase: TIMER_PHASES.pomo,
    count: state.count + 1,
    timeLeft: durations.pomoSec,
    started: false,
    timerEndsAtMs: null,
  };
}

export function restartCurrentPhase(
  state: TimerState,
  durations: TimerDurations,
): TimerState {
  const phase = state.phase === TIMER_PHASES.finished ? TIMER_PHASES.pomo : state.phase;
  return {
    ...state,
    phase,
    timeLeft: durationForPhase(phase, durations),
    started: false,
    timerEndsAtMs: null,
  };
}

export function resetAll(durations: TimerDurations): TimerState {
  return initialState(durations);
}

export function remainingSecondsUntil(timerEndsAtMs: number, now: number): number {
  return Math.max(
    0,
    Math.ceil(((timerEndsAtMs - now) / 1000) * TIMER_SPEED_MULTIPLIER),
  );
}

export function beginRunning(
  state: TimerState,
  now: number,
): TimerState {
  const sessionStartIso =
    state.sessionStartIso ??
    (state.phase === TIMER_PHASES.pomo && state.count === 1
      ? new Date(now).toISOString()
      : null);

  return {
    ...state,
    started: true,
    timerEndsAtMs: now + Math.ceil((state.timeLeft * 1000) / TIMER_SPEED_MULTIPLIER),
    sessionStartIso,
  };
}

export function pauseRunning(state: TimerState, now: number): TimerState {
  if (!state.started || !state.timerEndsAtMs) {
    return { ...state, started: false, timerEndsAtMs: null };
  }

  const remaining = remainingSecondsUntil(state.timerEndsAtMs, now);
  return {
    ...state,
    started: false,
    timeLeft: remaining,
    timerEndsAtMs: null,
  };
}
