"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type SettingKey,
  type Settings,
} from "@/lib/settings/settings";
import { useSettings } from "@/lib/settings/use-settings";

type RangeConfig = {
  key: SettingKey;
  id: string;
  label: string;
  min: number;
  max: number;
  suffix: string;
  note: string;
};

const RANGES: RangeConfig[] = [
  {
    key: "Pomo Duration",
    id: "pomoDur",
    label: "Pomodoro Duration",
    min: 20,
    max: 50,
    suffix: "min",
    note: "Focus session length (recommended: 25-30 minutes)",
  },
  {
    key: "Short Break Duration",
    id: "sBrDur",
    label: "Short Break Duration",
    min: 1,
    max: 10,
    suffix: "min",
    note: "Brief rest between focus sessions",
  },
  {
    key: "Long Break Duration",
    id: "brDur",
    label: "Long Break Duration",
    min: 15,
    max: 30,
    suffix: "min",
    note: "Extended rest after completing multiple pomodoros",
  },
  {
    key: "Number Of Pomos",
    id: "noPomo",
    label: "Number of Pomodoros",
    min: 1,
    max: 10,
    suffix: "pomos",
    note: "Total focus sessions in one set",
  },
  {
    key: "Long Break Interval",
    id: "lBrInter",
    label: "Long Break Interval",
    min: 1,
    max: 4,
    suffix: "SBr",
    note: "How many short breaks before a long break",
  },
  {
    key: "Daily Goal",
    id: "dailyGoal",
    label: "Daily Pomodoro Goal",
    min: 1,
    max: 16,
    suffix: "pomos",
    note: "Target number of completed pomodoros per day",
  },
];

type SaveState = "idle" | "saving" | "saved" | "error";

type InlineNotice = {
  tone: "error" | "success" | "info";
  text: string;
} | null;

function clampToRange(value: string, config: RangeConfig): string {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_SETTINGS[config.key];
  }
  if (parsed < config.min) return String(config.min);
  if (parsed > config.max) return String(config.max);
  return String(parsed);
}

export function SettingsForm() {
  const { settings, status, error, save, isSaving } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<InlineNotice>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (error) {
      setNotice({ tone: "error", text: error });
    }
  }, [error]);

  const isDirty = useMemo(
    () => SETTING_KEYS.some((key) => draft[key] !== settings[key]),
    [draft, settings],
  );

  const isAtDefaults = useMemo(
    () => SETTING_KEYS.every((key) => draft[key] === DEFAULT_SETTINGS[key]),
    [draft],
  );

  function updateValue(key: SettingKey, value: string, config: RangeConfig) {
    setDraft((current) => ({ ...current, [key]: clampToRange(value, config) }));
    setSaveState("idle");
    setNotice(null);
  }

  function resetToDefaults() {
    setDraft({ ...DEFAULT_SETTINGS });
    setSaveState("idle");
    setNotice({ tone: "info", text: "Reset to default values. Save to apply." });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || isSaving) {
      return;
    }

    setSaveState("saving");
    setNotice(null);

    try {
      await save(draft);
      setSaveState("saved");
      setNotice({ tone: "success", text: "Settings saved." });
    } catch {
      setSaveState("error");
      setNotice({
        tone: "error",
        text: "Could not save your settings. Try again in a moment.",
      });
    }
  }

  const submitLabel =
    saveState === "saving" || isSaving
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Error — Try Again"
          : "Save Settings";

  const isLoading = status === "loading";

  return (
    <form className="settings-form-grid" onSubmit={handleSubmit} noValidate>
      <div className="settings-form-header">
        <p className="dash-eyebrow">Core timer setup</p>
        <h3>Shape the rhythm of each focus block.</h3>
        <p className="settings-form-copy">
          Adjust session length, break cadence, and your daily target here. The
          sidebar keeps weekly goals, reminders, and assistant defaults close by
          so this page feels like one connected workspace.
        </p>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`settings-notice settings-notice--${notice.tone}`}
        >
          {notice.text}
        </p>
      )}

      <div className="settings-form-fields">
        {RANGES.map((config) => {
          const value = draft[config.key];
          return (
            <label key={config.key} className="setting-item" htmlFor={config.id}>
              <span className="field-label">{config.label}</span>
              <input
                id={config.id}
                name={config.id}
                type="range"
                min={config.min}
                max={config.max}
                value={value}
                disabled={isLoading}
                onChange={(event) => updateValue(config.key, event.target.value, config)}
              />
              <span className="range-readout">
                {value} {config.suffix}
              </span>
              <small>{config.note}</small>
            </label>
          );
        })}
      </div>

      <div className="settings-actions">
        <button
          type="submit"
          className="primary-pill"
          disabled={!isDirty || isSaving || isLoading}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="secondary-pill"
          onClick={resetToDefaults}
          disabled={isAtDefaults || isSaving || isLoading}
        >
          Reset to defaults
        </button>
        <Link href="/start" className="secondary-pill">
          Back to focus
        </Link>
      </div>
    </form>
  );
}
