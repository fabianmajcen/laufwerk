// R9 — 2×2 form sparkline tiles: cadence (170–180 target band), stride,
// vertical oscillation, ground contact — direction-aware delta chips.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { computeFormMetrics, FORM_DIRECTION, type FormMetrics } from "../../lib/derive/form";
import { linearFit } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";

interface FormPoint extends FormMetrics {
  date: Date;
}

export function FormGrid() {
  const points = useLiveQuery(async () => {
    const runs = await getRuns();
    const out: FormPoint[] = [];
    for (const r of [...runs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      if (!data?.splits?.length) continue;
      out.push({ date: new Date(r.startTimeLocal.replace(" ", "T")), ...computeFormMetrics(data.splits) });
    }
    return out;
  }, []);

  const tiles = useMemo(() => {
    if (!points || points.length < 2) return null;
    const defs: { key: keyof FormMetrics; label: string; unit: string; band?: [number, number] }[] = [
      { key: "cadenceSpm", label: "Cadence", unit: "spm", band: [170, 180] },
      { key: "strideLengthCm", label: "Stride", unit: "cm" },
      { key: "verticalOscCm", label: "Vert. osc", unit: "cm" },
      { key: "groundContactMs", label: "Ground contact", unit: "ms" },
    ];
    return defs
      .map((d) => {
        const vals = points.map((p) => p[d.key]).filter((v): v is number => v != null);
        if (vals.length < 2) return null;
        const fit = linearFit(vals.map((_, i) => i), vals);
        const better = fit ? (fit[0] > 0) === (FORM_DIRECTION[d.key] === "higher") : null;
        return { ...d, vals, better };
      })
      .filter(Boolean) as { key: string; label: string; unit: string; band?: [number, number]; vals: number[]; better: boolean | null }[];
  }, [points]);

  if (!tiles?.length) return null;

  return (
    <Card kicker="Form" title="Technique trend">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ key, ...tile }) => (
          <FormTile key={key} {...tile} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Distance-weighted lap averages per run. Cadence band: 170–180 spm target.</p>
    </Card>
  );
}

function FormTile({
  label,
  unit,
  vals,
  better,
  band,
}: {
  label: string;
  unit: string;
  vals: number[];
  better: boolean | null;
  band?: [number, number];
}) {
  const current = vals[vals.length - 1];
  const lo = Math.min(...vals, ...(band ? [band[0]] : []));
  const hi = Math.max(...vals, ...(band ? [band[1]] : []));
  const y = (v: number) => (hi === lo ? 14 : 26 - ((v - lo) / (hi - lo)) * 24);
  const pts = vals.map((v, i) => `${((i / Math.max(vals.length - 1, 1)) * 100).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-xl bg-page p-3">
      <div className="kicker">{label}</div>
      <div className="tnum mt-1 flex items-baseline gap-1">
        <span className="text-[20px] font-semibold">{Math.round(current * 10) / 10}</span>
        <span className="text-[11px] text-ink-3">{unit}</span>
        {better != null && (
          <span className={`ml-auto text-[11px] ${better ? "text-status-good" : "text-status-warn"}`}>
            {better ? "▲ better" : "▼ worse"}
          </span>
        )}
      </div>
      <svg viewBox="0 0 100 28" className="mt-1 h-7 w-full" preserveAspectRatio="none" aria-hidden>
        {band && (
          <rect x="0" y={Math.min(y(band[0]), y(band[1]))} width="100" height={Math.abs(y(band[0]) - y(band[1]))} fill="var(--cadence)" opacity="0.12" />
        )}
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
