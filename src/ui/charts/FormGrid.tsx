// R9 — 2×2 form sparkline tiles: cadence (170–180 target band), stride,
// vertical oscillation, ground contact — direction-aware delta chips.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { computeFormMetrics, FORM_DIRECTION, type FormMetrics } from "../../lib/derive/form";
import { linearFit } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";

export interface FormPoint extends FormMetrics {
  date: Date;
  activityId: number;
}

/** Per-run distance-weighted form metrics, oldest first. Shared by the tile
 *  grid and the full-page detail charts. */
export function useFormPoints(): FormPoint[] | undefined {
  return useLiveQuery(async () => {
    const runs = await getRuns();
    const out: FormPoint[] = [];
    for (const r of [...runs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      if (!data?.splits?.length) continue;
      out.push({
        date: new Date(r.startTimeLocal.replace(" ", "T")),
        activityId: r.activityId,
        ...computeFormMetrics(data.splits),
      });
    }
    return out;
  }, []);
}

export const FORM_META: Record<
  keyof FormMetrics,
  { label: string; unit: string; band?: [number, number] }
> = {
  cadenceSpm: { label: "Cadence", unit: "spm", band: [170, 180] },
  strideLengthCm: { label: "Stride length", unit: "cm" },
  verticalOscCm: { label: "Vertical oscillation", unit: "cm" },
  groundContactMs: { label: "Ground contact time", unit: "ms" },
};

export function FormGrid({ onSelect }: { onSelect?: (key: keyof FormMetrics) => void }) {
  const points = useFormPoints();

  const tiles = useMemo(() => {
    if (!points || points.length < 2) return null;
    return (Object.keys(FORM_META) as (keyof FormMetrics)[])
      .map((key) => {
        const d = FORM_META[key];
        const vals = points.map((p) => p[key]).filter((v): v is number => v != null);
        if (vals.length < 2) return null;
        const fit = linearFit(vals.map((_, i) => i), vals);
        const better = fit ? (fit[0] > 0) === (FORM_DIRECTION[key] === "higher") : null;
        return { key, label: key === "cadenceSpm" ? "Cadence" : key === "strideLengthCm" ? "Stride" : key === "verticalOscCm" ? "Vert. osc" : "Ground contact", unit: d.unit, band: d.band, vals, better };
      })
      .filter((t): t is NonNullable<typeof t> => t != null);
  }, [points]);

  if (!tiles?.length) return null;

  return (
    <Card kicker="Form" title="Technique trend">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ key, ...tile }) => (
          <FormTile key={key} {...tile} onClick={onSelect ? () => onSelect(key) : undefined} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        Distance-weighted lap averages per run. Cadence band: 170–180 spm target.{onSelect ? " Tap a tile for the full chart." : ""}
      </p>
    </Card>
  );
}

function FormTile({
  label,
  unit,
  vals,
  better,
  band,
  onClick,
}: {
  label: string;
  unit: string;
  vals: number[];
  better: boolean | null;
  band?: [number, number];
  onClick?: () => void;
}) {
  const current = vals[vals.length - 1];
  const lo = Math.min(...vals, ...(band ? [band[0]] : []));
  const hi = Math.max(...vals, ...(band ? [band[1]] : []));
  const y = (v: number) => (hi === lo ? 14 : 26 - ((v - lo) / (hi - lo)) * 24);
  const pts = vals.map((v, i) => `${((i / Math.max(vals.length - 1, 1)) * 100).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`rounded-xl bg-page p-3 text-left ${onClick ? "active:opacity-70" : ""}`}>
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
    </Tag>
  );
}
