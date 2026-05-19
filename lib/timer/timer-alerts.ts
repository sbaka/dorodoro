import { TIMER_PHASES, type TimerPhase } from "@/lib/timer/timer-types";

export type TimerAlertKind =
  | "break-started"
  | "focus-started"
  | "session-complete";

type AlertDescriptor = {
  title: string;
  body: string;
  tag: string;
  frequencies: number[];
  requireInteraction?: boolean;
};

type NotificationOptionsWithRenotify = NotificationOptions & {
  renotify?: boolean;
};

const ALERTS: Record<TimerAlertKind, AlertDescriptor> = {
  "break-started": {
    title: "Pomodoro Complete!",
    body: "Time for a break.",
    tag: "timer-break-started",
    frequencies: [880, 740, 880],
  },
  "focus-started": {
    title: "Break Complete!",
    body: "Time to focus again.",
    tag: "timer-focus-started",
    frequencies: [740, 880, 740],
  },
  "session-complete": {
    title: "Session Complete!",
    body: "You finished all your pomodoros.",
    tag: "timer-session-complete",
    frequencies: [880, 988, 1174, 988],
    requireInteraction: true,
  },
};

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const typedWindow = window as WindowWithWebkitAudio;
  const AudioContextCtor = window.AudioContext ?? typedWindow.webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
}

function scheduleTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  durationSec: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + durationSec + 0.02);
}

function playAlarmLikeSound(kind: TimerAlertKind) {
  const context = getAudioContext();
  if (!context) return;

  const descriptor = ALERTS[kind];

  if (context.state === "suspended") {
    void context.resume().then(() => {
      playAlarmLikeSound(kind);
    }).catch(() => {});
    return;
  }

  const toneDurationSec = kind === "session-complete" ? 0.22 : 0.18;
  const gapSec = 0.05;
  const startBase = context.currentTime + 0.02;

  descriptor.frequencies.forEach((frequency, index) => {
    const startAt = startBase + index * (toneDurationSec + gapSec);
    scheduleTone(context, frequency, startAt, toneDurationSec);
  });
}

async function showDesktopNotification(kind: TimerAlertKind) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const descriptor = ALERTS[kind];
  const options: NotificationOptionsWithRenotify = {
    body: descriptor.body,
    badge: "/android-chrome-192x192.png",
    icon: "/android-chrome-192x192.png",
    requireInteraction: descriptor.requireInteraction,
    renotify: true,
    tag: descriptor.tag,
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(descriptor.title, options);
      return;
    } catch {
      // Fall through to the window-level notification API.
    }
  }

  try {
    new Notification(descriptor.title, options);
  } catch {
    // Ignore notification failures and keep the sound as the fallback.
  }
}

export function primeTimerAlerts() {
  if (typeof window === "undefined") return;

  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume().catch(() => {});
  }

  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission().catch(() => {});
  }
}

export function alertKindForCompletion(
  previousPhase: TimerPhase,
  nextPhase: TimerPhase,
): TimerAlertKind | null {
  if (nextPhase === TIMER_PHASES.finished) {
    return "session-complete";
  }

  if (previousPhase === TIMER_PHASES.pomo) {
    return "break-started";
  }

  if (
    previousPhase === TIMER_PHASES.shortBreak ||
    previousPhase === TIMER_PHASES.longBreak
  ) {
    return "focus-started";
  }

  return null;
}

export async function sendTimerAlert(kind: TimerAlertKind) {
  playAlarmLikeSound(kind);
  await showDesktopNotification(kind);
}