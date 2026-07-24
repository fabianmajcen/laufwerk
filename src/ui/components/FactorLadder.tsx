// The "show the math" panel: one row per FabScore factor, worst first,
// raw value + subscore meter + weight. No black boxes.
import { useState } from "react";
import type { FabResult } from "../../lib/derive/fabScore";
import { useUi, type TabId } from "../../store/uiStore";

// where each factor's home chart lives
const FACTOR_TARGETS: Record<string, TabId | undefined> = {
  sleep: "sleep",
  hrv: "trends",
  load: "trends",
  freshness: "runs",
  bodyBattery: undefined, // its chart is right below on Today
};

export function FactorLadder({ fab }: { fab: FabResult }) {
  const [open, setOpen] = useState(false);

  const rows = [...fab.factors].sort((a, b) => {
    if (a.subscore == null) return 1;
    if (b.subscore == null) return -1;
    return a.subscore - b.subscore;
  });

  return (
    <div className="mt-3 border-t border-hairline pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1 text-[13px] text-ink-2"
        aria-expanded={open}
      >
        <span>Why? Factor breakdown</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div className="pt-1">
          {rows.map((f) => {
            const target = FACTOR_TARGETS[f.key];
            return (
              <div
                key={f.key}
                className={`flex items-center gap-3 py-2 ${target ? "active:opacity-70" : ""}`}
                onClick={target ? () => useUi.getState().setTab(target) : undefined}
                role={target ? "button" : undefined}
              >
                <div className="w-32 shrink-0">
                  <div className="flex items-center gap-1 text-[13px]">
                    {f.label}
                    {target && (
                      <span className="text-[11px] text-ink-3" aria-hidden>
                        ›
                      </span>
                    )}
                  </div>
                  <div className="tnum text-[11px] text-ink-3">{f.raw}</div>
                </div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grid">
                  {f.subscore != null && (
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(f.subscore * 100)}%` }}
                    />
                  )}
                </div>
                <div className="tnum w-14 shrink-0 text-right text-[11px] text-ink-3">
                  {f.subscore != null ? `${Math.round(f.subscore * 100)} · w${Math.round(f.weight * 100)}%` : "n/a"}
                </div>
              </div>
            );
          })}
          {fab.overrides.map((o, i) => (
            <p key={i} className="mt-1 text-[12px] text-status-warn">
              ▲ {o}
            </p>
          ))}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            score = 100 · Σ wᵢ·fᵢ over available factors (weights renormalized). ≥75 train · 55–74 easy · &lt;55
            rest, then injury guards can only make it stricter. Garmin's own readiness isn't available for your
            watch, so this transparent score is the one that counts.
          </p>
        </div>
      )}
    </div>
  );
}
