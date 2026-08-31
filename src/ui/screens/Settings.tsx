import { useState } from "react";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";
import { useSync } from "../../store/syncStore";
import { bootstrapFromJson, clearTokens } from "../../lib/garmin/auth";
import { getDisplayName } from "../../lib/garmin/client";
import { abortSync, syncNow } from "../../lib/sync/engine";
import { exportBackup } from "../../lib/export";
import { APP_VERSION, isUpdaterConfigured } from "../../lib/updater";
import { db } from "../../lib/db/schema";

export function Settings({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const sync = useSync();

  return (
    <div className="pb-6">
      <header className="flex items-center gap-2 px-3 pb-1 pt-4">
        <button onClick={onBack} aria-label="Back" className="p-2 text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[20px] font-semibold">Settings</h1>
      </header>

      <ConnectionCard />

      <SyncCard />

      <Card kicker="Sync" title="History window">
        <div className="flex gap-2">
          {[90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => settings.set({ backfillDays: d })}
              className={`flex-1 rounded-lg py-2 text-[13px] ${
                settings.backfillDays === d ? "bg-elevated text-ink" : "bg-page text-ink-3"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          How far back the first sync reaches. Wellness data costs ~5 requests per day of history, so 90 days
          is the polite default.
        </p>
      </Card>

      <Card kicker="Appearance" title="Theme">
        <div className="flex gap-2">
          {(["dark", "light", "system"] as const).map((th) => (
            <button
              key={th}
              onClick={() => settings.set({ theme: th })}
              className={`flex-1 rounded-lg py-2 text-[13px] capitalize ${
                settings.theme === th ? "bg-elevated text-ink" : "bg-page text-ink-3"
              }`}
            >
              {th}
            </button>
          ))}
        </div>
      </Card>

      <Card kicker="Plan" title="Training plan">
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">Runs per week</span>
          <Stepper
            value={settings.plan.runsPerWeek}
            onChange={(v) => settings.setPlan({ runsPerWeek: v })}
            min={1}
            max={7}
          />
        </div>
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">Minutes per run</span>
          <Stepper
            value={settings.plan.minutesPerRun}
            onChange={(v) => settings.setPlan({ minutesPerRun: v })}
            min={15}
            max={120}
            step={2.5}
          />
        </div>
      </Card>

      <Card kicker="Plan" title="Calisthenics">
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">Workouts per week</span>
          <Stepper
            value={settings.workouts.workoutsPerWeek}
            onChange={(v) => settings.setWorkouts({ workoutsPerWeek: v })}
            min={1}
            max={7}
          />
        </div>
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">Rest days between</span>
          <Stepper
            value={settings.workouts.minRestDaysBetweenWorkouts}
            onChange={(v) => settings.setWorkouts({ minRestDaysBetweenWorkouts: v })}
            min={0}
            max={3}
          />
        </div>
        <SettingToggle
          label="Sound cue when rest ends"
          note="Uses the media volume"
          value={settings.workouts.restCueSound}
          onChange={(v) => settings.setWorkouts({ restCueSound: v })}
        />
        <SettingToggle
          label="Vibrate when rest ends"
          value={settings.workouts.restCueVibrate}
          onChange={(v) => settings.setWorkouts({ restCueVibrate: v })}
        />
        <SettingToggle
          label="Keep screen on during a session"
          value={settings.workouts.keepAwake}
          onChange={(v) => settings.setWorkouts({ keepAwake: v })}
        />
      </Card>

      <UpdateCard />

      <Card kicker="Data" title="Local cache">
        <button
          onClick={() => exportBackup().catch((e) => alert(`Export failed: ${e}`))}
          className="mb-2 w-full rounded-lg bg-page py-2 text-[13px] text-ink-2"
        >
          Export everything as JSON
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete the synced Garmin data? Your workout plans, logged sessions and schedule are kept, and the Garmin data re-syncs.")) return;
            // deliberately does NOT touch workoutPlans / workoutSessions /
            // schedule: that data is his own and cannot be re-synced
            await Promise.all([
              db.activities.clear(),
              db.activityData.clear(),
              db.wellness.clear(),
              db.ranges.clear(),
              db.syncState.clear(),
              db.kv.clear(),
            ]);
          }}
          className="w-full rounded-lg bg-page py-2 text-[13px] text-status-serious"
        >
          Clear synced Garmin data
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete every logged workout session and the schedule? Your A/B/C plans stay. This cannot be undone: workout history never came from Garmin, so it cannot be re-synced.")) return;
            await Promise.all([db.workoutSessions.clear(), db.schedule.clear()]);
          }}
          className="mt-2 w-full rounded-lg bg-page py-2 text-[13px] text-status-serious"
        >
          Delete workout history
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
          Laufwerk talks directly to Garmin's (unofficial) Connect API from this phone and keeps everything in a
          local cache. Nothing leaves the device. Workout plans and sessions are yours alone: they never came from
          Garmin, so the JSON export is their only backup. {sync.lastSyncAt ? `Last sync ${new Date(sync.lastSyncAt).toLocaleString("en-GB")}.` : ""}
        </p>
      </Card>
    </div>
  );
}

function SyncCard() {
  const sync = useSync();
  const busy = sync.phase === "running" || sync.phase === "planning";

  return (
    <Card kicker="Sync" title="Garmin data">
      {busy ? (
        <div>
          <div className="mb-1 flex justify-between text-[12px] text-ink-2">
            <span className="truncate">{sync.currentLabel || "planning…"}</span>
            <span className="tnum ml-2 shrink-0">
              {sync.done}/{sync.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-grid">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: sync.total ? `${(sync.done / sync.total) * 100}%` : "5%" }}
            />
          </div>
          <button onClick={abortSync} className="mt-3 w-full rounded-lg bg-page py-2 text-[13px] text-ink-2">
            Pause (resumes where it left off)
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => syncNow()}
            disabled={sync.authStatus !== "connected"}
            className="w-full rounded-lg bg-accent py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
          >
            Sync now
          </button>
          {sync.phase === "error" && sync.lastError && (
            <p className="mt-2 text-[12px] text-status-warn">{sync.lastError}</p>
          )}
          {sync.phase === "done" && <p className="mt-2 text-[12px] text-status-good">Sync complete.</p>}
        </>
      )}
    </Card>
  );
}

function ConnectionCard() {
  const sync = useSync();
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await bootstrapFromJson(json.trim());
      const dn = await getDisplayName();
      sync.setAuth("connected", dn);
      setJson("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      sync.setAuth("disconnected");
    } finally {
      setBusy(false);
    }
  };

  if (sync.authStatus === "connected") {
    return (
      <Card kicker="Garmin account" title="Connected">
        <p className="tnum break-all text-[12px] text-ink-3">{sync.displayName}</p>
        <button
          onClick={async () => {
            await clearTokens();
            useSync.getState().setAuth("disconnected", null);
          }}
          className="mt-3 w-full rounded-lg bg-page py-2 text-[13px] text-status-serious"
        >
          Disconnect
        </button>
      </Card>
    );
  }

  return (
    <Card kicker="Garmin account" title="Connect">
      <p className="mb-2 text-[13px] leading-relaxed text-ink-2">
        On your PC, open <code className="text-[12px]">~/.garmin_tokens/garmin_tokens.json</code> (created by the
        python exporter) and paste its full contents here. Login stays on the device and refreshes itself.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{"di_token": "...", "di_refresh_token": "...", "di_client_id": "..."}'
        rows={4}
        className="tnum w-full rounded-lg border border-hairline bg-page p-2 text-[12px] text-ink placeholder:text-ink-3"
      />
      {error && <p className="mt-2 text-[12px] text-status-critical">{error}</p>}
      <button
        onClick={connect}
        disabled={busy || !json.trim()}
        className="mt-2 w-full rounded-lg bg-accent py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
      >
        {busy ? "Connecting…" : "Connect"}
      </button>
    </Card>
  );
}

function UpdateCard() {
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "checking" }
    | { phase: "current" }
    | { phase: "available"; info: import("../../lib/updater").UpdateInfo }
    | { phase: "installing" }
    | { phase: "error"; msg: string }
  >({ phase: "idle" });

  const check = async () => {
    setState({ phase: "checking" });
    try {
      const { checkForUpdate } = await import("../../lib/updater");
      const info = await checkForUpdate();
      setState(info ? { phase: "available", info } : { phase: "current" });
    } catch (e) {
      setState({ phase: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const install = async () => {
    if (state.phase !== "available") return;
    const info = state.info;
    setState({ phase: "installing" });
    try {
      const { downloadAndInstall } = await import("../../lib/updater");
      await downloadAndInstall(info);
      setState({ phase: "idle" });
    } catch (e) {
      setState({ phase: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Card kicker="App" title={`Laufwerk ${APP_VERSION}`}>
      {!isUpdaterConfigured() ? (
        <p className="text-[12px] text-ink-3">Updates arrive here once the GitHub repository is set up.</p>
      ) : state.phase === "available" ? (
        <>
          <p className="mb-2 text-[13px] text-ink-2">
            Version {state.info.version} is available.
            {state.info.notes ? ` ${state.info.notes.slice(0, 140)}` : ""}
          </p>
          <button onClick={install} className="w-full rounded-lg bg-accent py-2.5 text-[14px] font-medium text-white">
            Download & install
          </button>
        </>
      ) : (
        <>
          <button
            onClick={check}
            disabled={state.phase === "checking" || state.phase === "installing"}
            className="w-full rounded-lg bg-page py-2 text-[13px] text-ink-2 disabled:opacity-40"
          >
            {state.phase === "checking"
              ? "Checking…"
              : state.phase === "installing"
                ? "Downloading… the installer opens when ready"
                : "Check for update"}
          </button>
          {state.phase === "current" && <p className="mt-2 text-[12px] text-status-good">You're on the latest version.</p>}
          {state.phase === "error" && <p className="mt-2 text-[12px] text-status-warn">{state.msg}</p>}
        </>
      )}
    </Card>
  );
}

function SettingToggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex w-full items-center justify-between gap-3 py-1.5 text-left active:opacity-70"
    >
      <span className="min-w-0">
        <span className="block text-[14px] text-ink-2">{label}</span>
        {note && <span className="block text-[11px] text-ink-3">{note}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-accent" : "bg-grid"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="h-8 w-8 rounded-full bg-page text-[16px] text-ink-2"
        aria-label="decrease"
      >
        −
      </button>
      <span className="tnum w-10 text-center text-[15px] font-semibold">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="h-8 w-8 rounded-full bg-page text-[16px] text-ink-2"
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}
