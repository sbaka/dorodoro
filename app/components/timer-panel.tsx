"use client";

import { RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { usePreferences } from "@/lib/preferences/use-preferences";
import {
  alertKindForCompletion,
  primeTimerAlerts,
  sendTimerAlert,
} from "@/lib/timer/timer-alerts";
import { useTimer } from "@/lib/timer/use-timer";
import type { TimerDurations, TimerPhase } from "@/lib/timer/timer-types";
import {
  TIMER_PHASES,
  phaseMessage,
  secondsToMinutesDisplay,
} from "@/lib/timer/timer-types";

const RING_RADIUS = 150;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type MarkerStatus = "upcoming" | "active" | "done";

type SessionMarker = {
  key: string;
  phase: TimerPhase;
  label: string;
  status: MarkerStatus;
};

function fullPhaseDuration(phase: TimerPhase, durations: TimerDurations): number {
  if (phase === TIMER_PHASES.pomo) return durations.pomoSec;
  if (phase === TIMER_PHASES.shortBreak) return durations.shortBreakSec;
  if (phase === TIMER_PHASES.longBreak) return durations.longBreakSec;
  return 0;
}

function buildSessionMarkers(
  statePhase: TimerPhase,
  count: number,
  durations: TimerDurations,
): SessionMarker[] {
  const totalPomos = Math.max(1, durations.repetition);
  const longBreakInterval = Math.max(1, durations.longBreakInterval);
  const markers: SessionMarker[] = [];

  for (let pomoIndex = 1; pomoIndex <= totalPomos; pomoIndex += 1) {
    let pomoStatus: MarkerStatus = "upcoming";

    if (statePhase === TIMER_PHASES.finished || pomoIndex < count) {
      pomoStatus = "done";
    } else if (statePhase === TIMER_PHASES.pomo && pomoIndex === count) {
      pomoStatus = "active";
    }

    markers.push({
      key: `pomo-${pomoIndex}`,
      phase: TIMER_PHASES.pomo,
      label: `Pomodoro ${pomoIndex}`,
      status: pomoStatus,
    });

    if (pomoIndex === totalPomos) {
      continue;
    }

    const breakPhase =
      pomoIndex % longBreakInterval === 0
        ? TIMER_PHASES.longBreak
        : TIMER_PHASES.shortBreak;

    let breakStatus: MarkerStatus = "upcoming";

    if (statePhase === TIMER_PHASES.finished || count > pomoIndex) {
      breakStatus = "done";
    } else if (count === pomoIndex && statePhase === breakPhase) {
      breakStatus = "active";
    }

    markers.push({
      key: `${breakPhase}-${pomoIndex}`,
      phase: breakPhase,
      label:
        breakPhase === TIMER_PHASES.longBreak
          ? `Long break after pomodoro ${pomoIndex}`
          : `Short break after pomodoro ${pomoIndex}`,
      status: breakStatus,
    });
  }

  return markers;
}

export function TimerPanel() {
  const { state, durations, toggleStart, restart, skip, resetSession, isReady } =
    useTimer();
  const { preferences, save, isSaving, status: preferencesStatus } = usePreferences();
  const previousStateRef = useRef(state);

  const soundOn = useMemo(
    () => preferences.soundNotifications,
    [preferences.soundNotifications],
  );

  useEffect(() => {
    const previousState = previousStateRef.current;

    if (
      soundOn &&
      previousState.phase !== state.phase &&
      previousState.started &&
      previousState.timerEndsAtMs !== null &&
      previousState.timerEndsAtMs <= Date.now()
    ) {
      const alertKind = alertKindForCompletion(previousState.phase, state.phase);
      if (alertKind) {
        void sendTimerAlert(alertKind);
      }
    }

    previousStateRef.current = state;
  }, [soundOn, state]);

  async function handleSoundChange(next: boolean) {
    await save({ ...preferences, soundNotifications: next });
  }

  function handleToggleStart() {
    if (!state.started || state.phase === TIMER_PHASES.finished) {
      primeTimerAlerts();
    }
    toggleStart();
  }

  const isFinished = state.phase === TIMER_PHASES.finished;
  const startLabel = !isReady
    ? "Loading..."
    : isFinished
      ? "Start new session"
      : state.started
        ? "Pause"
        : state.timeLeft < fullPhaseDuration(state.phase, durations)
          ? "Resume"
          : "Start";

  const fullDuration = fullPhaseDuration(state.phase, durations);
  const progress =
    fullDuration > 0 ? Math.min(1, Math.max(0, state.timeLeft / fullDuration)) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const totalPomos = Math.max(1, durations.repetition);
  const sessionMarkers = useMemo(
    () => buildSessionMarkers(state.phase, state.count, durations),
    [durations, state.count, state.phase],
  );
  const timelineLabel = `Session timeline. ${phaseMessage(state.phase)}. ${sessionMarkers
    .map((marker) => `${marker.label} ${marker.status}`)
    .join(", ")}.`;

  return (
    <article className="timer-card surface-card">
      <div id="timer-display">
        <p id="pomo-type">{phaseMessage(state.phase)}</p>


        <div
          className="session-dots"
          role="img"
          aria-label={timelineLabel}
        >
          {sessionMarkers.map((marker) => {
            const phaseClass =
              marker.phase === TIMER_PHASES.pomo
                ? "dot--pomo"
                : marker.phase === TIMER_PHASES.shortBreak
                  ? "dot--short-break"
                  : "dot--long-break";

            return (
              <span
                key={marker.key}
                className={`dot ${phaseClass} ${marker.status}`}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>

      <div id="countdown">
        <div id="timer-circle">
          <svg
            viewBox="0 0 320 320"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              className="ring-track"
              r={RING_RADIUS}
              cx="160"
              cy="160"
              fill="transparent"
              strokeWidth="15"
            />
            <circle
              id="ring"
              className={`timer-ring timer-ring--${state.phase}`}
              r={RING_RADIUS}
              cx="160"
              cy="160"
              fill="transparent"
              stroke="#4381A8"
              strokeWidth="15"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div id="countdown-number">{secondsToMinutesDisplay(state.timeLeft)}</div>
        </div>
      </div>

      <div className="controls">
        <button
          type="button"
          className="circle-button secondary-pill"
          onClick={restart}
          disabled={!isReady || state.started || isFinished}
          aria-label="Restart timer"
        >
          <RotateCcw className="button-icon size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="start-button"
          onClick={handleToggleStart}
          disabled={!isReady}
          aria-pressed={state.started}
        >
          {startLabel}
        </button>
        <button
          type="button"
          className="circle-button secondary-pill"
          onClick={skip}
          disabled={!isReady || isFinished}
          aria-label="Skip to next phase"
        >
          <SkipForward className="button-icon size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="notifications-toggle">
        <label>
          <input
            type="checkbox"
            checked={soundOn}
            disabled={preferencesStatus === "loading" || isSaving}
            onChange={(event) => {
              void handleSoundChange(event.target.checked);
            }}
          />
          Alarm sound and desktop alerts
        </label>
      </div>

      <div className="timer-actions">
        <button
          type="button"
          className="secondary-pill"
          onClick={resetSession}
          disabled={!isReady}
        >
          Reset full session
        </button>
  
      </div>
    </article>
  );
}
