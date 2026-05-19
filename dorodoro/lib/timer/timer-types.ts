export const TIMER_PHASES = {
  pomo: "pomo",
  shortBreak: "sbreak",
  longBreak: "lbreak",
  finished: "finished",
} as const;

export type TimerPhase = (typeof TIMER_PHASES)[keyof typeof TIMER_PHASES];

export type TimerDurations = {
  pomoSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  longBreakInterval: number;
  repetition: number;
};

export type TimerState = {
  phase: TimerPhase;
  count: number;
  completedPomos: number;
  timeLeft: number;
  started: boolean;
  timerEndsAtMs: number | null;
  sessionStartIso: string | null;
};

export const TIMER_PROGRESS_KEY = "timerProgress";
export const RECOVERY_MAX_AGE_MS = 30 * 60 * 1000;

export function secondsToMinutesDisplay(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function minToSec(minutes: number): number {
  return Math.round(minutes * 60);
}

export function phaseMessage(phase: TimerPhase): string {
  switch (phase) {
    case TIMER_PHASES.pomo:
      return "Time to focus";
    case TIMER_PHASES.shortBreak:
      return "Relax a little";
    case TIMER_PHASES.longBreak:
      return "What about a fresh breeze?";
    case TIMER_PHASES.finished:
      return "Looks like you finished all your pomodoros, well done champ!";
  }
}
