// W3 hero — last night as a stepped stage band (custom series) with a synced
// overnight-HR panel below and the stage-duration table beneath (the table is
// the documented contrast-relief channel for the stage colors).
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults, type Tokens } from "./theme";
import type { SleepView } from "../../lib/hooks";
import { fmtHoursMin } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

function NavBtn({ dir, onClick }: { dir: "prev" | "next"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-label={dir === "prev" ? "previous night" : "next night"}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-page text-ink-2 disabled:opacity-25"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M14.5 6l-6 6 6 6" /> : <path d="M9.5 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

// Garmin activityLevel: 0=deep 1=light 2=REM 3=awake — plotted shallow→deep
interface Stage {
  level: number;
  name: string;
  color: string;
}
const STAGE = (t: Tokens): Stage[] => [
  { level: 0, name: "Deep", color: t.sleepDeep },
  { level: 1, name: "Light", color: t.sleepLight },
  { level: 2, name: "REM", color: t.sleepRem },
  { level: 3, name: "Awake", color: t.sleepAwake },
];

export interface HypnogramNav {
  onPrev?: () => void;
  onNext?: () => void;
  isLatest: boolean;
}

export function Hypnogram({ sleep, nav }: { sleep: SleepView; nav?: HypnogramNav }) {
  const theme = useSettings((s) => s.theme);

  const option = useMemo(() => {
    const t = tokens();
    const stages = STAGE(t);
    const byLevel = new Map(stages.map((s) => [s.level, s]));

    // GMT strings like "2026-07-23T22:20:27.0" (no zone suffix) — treat as UTC
    const parseGmt = (s: string) => new Date(s + "Z").getTime();
    const segs = sleep.levels
      .map((l) => ({
        start: parseGmt(l.startGMT),
        end: parseGmt(l.endGMT),
        stage: byLevel.get(l.activityLevel),
      }))
      .filter((s) => s.stage && isFinite(s.start) && isFinite(s.end));
    if (!segs.length) return null;

    const tMin = segs[0].start;
    const tMax = segs[segs.length - 1].end;

    const hrData = sleep.heartRate.filter(([ts]) => ts >= tMin - 600000 && ts <= tMax + 600000);
    const respData = sleep.respiration.filter(([ts]) => ts >= tMin - 600000 && ts <= tMax + 600000);
    const hasResp = respData.length > 5;
    const hrValues = hrData.map(([, v]) => v);
    const hrRange = hrValues.length ? [Math.min(...hrValues), Math.max(...hrValues)] : null;

    return {
      grid: [
        { left: 46, right: 12, top: 18, height: 120 },
        { left: 46, right: 12, top: 186, height: 68 },
        ...(hasResp ? [{ left: 46, right: 12, top: 302, height: 62 }] : []),
      ],
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { axisValue?: number; value?: unknown; seriesIndex: number }[]) => {
          const x = ps[0]?.axisValue;
          if (x == null) return "";
          const d = new Date(x);
          const seg = segs.find((s) => x >= s.start && x < s.end);
          const hr = hrData.reduce<[number, number] | null>(
            (best, cur) => (!best || Math.abs(cur[0] - x) < Math.abs(best[0] - x) ? cur : best),
            null,
          );
          return `<b>${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b><br/>${
            seg ? seg.stage!.name : ""
          }${hr ? ` · HR ${hr[1]} bpm` : ""}`;
        },
      },
      axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.ink3 } },
      xAxis: (hasResp ? [0, 1, 2] : [0, 1]).map((i, _, arr) => ({
        type: "time",
        gridIndex: i,
        min: tMin,
        max: tMax,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          show: i === arr.length - 1,
          formatter: (v: number) =>
            new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        },
      })),
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          min: -0.5,
          max: 3.5,
          inverse: true, // deep at the bottom
          interval: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: t.ink3,
            fontSize: 11,
            formatter: (v: number) => byLevel.get(Math.round(v))?.name ?? "",
          },
        },
        {
          type: "value",
          gridIndex: 1,
          scale: true,
          ...yAxisDefaults(t),
          splitNumber: 2,
          // the topmost tick label would crowd the panel title row
          axisLabel: { ...yAxisDefaults(t).axisLabel, showMaxLabel: false },
        },
        ...(hasResp
          ? [
              {
                type: "value",
                gridIndex: 2,
                scale: true,
                minInterval: 5,
                ...yAxisDefaults(t),
                splitNumber: 2,
                axisLabel: { ...yAxisDefaults(t).axisLabel, showMaxLabel: false },
              },
            ]
          : []),
      ],
      series: [
        {
          type: "custom",
          xAxisIndex: 0,
          yAxisIndex: 0,
          renderItem: (
            _params: unknown,
            api: {
              value: (i: number) => number;
              coord: (v: [number, number]) => [number, number];
              size: (v: [number, number]) => [number, number];
            },
          ) => {
            const start = api.value(0);
            const end = api.value(1);
            const level = api.value(2);
            const [x0, y] = api.coord([start, level]);
            const [x1] = api.coord([end, level]);
            const h = 26;
            return {
              type: "rect",
              shape: { x: x0, y: y - h / 2, width: Math.max(x1 - x0, 1.5), height: h, r: 3 },
              style: { fill: stages[level]?.color ?? t.ink3 },
            };
          },
          data: segs.map((s) => [s.start, s.end, s.stage!.level]),
          encode: { x: [0, 1], y: 2 },
        },
        {
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: hrData,
          showSymbol: false,
          lineStyle: { color: t.hr, width: 2, cap: "round" },
        },
        ...(hasResp
          ? [
              {
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: respData,
                showSymbol: false,
                lineStyle: { color: t.hrv, width: 1.5, cap: "round" },
                areaStyle: { color: t.hrv, opacity: 0.08 },
              },
            ]
          : []),
      ],
      graphic: [
        {
          type: "text",
          left: 8,
          top: 160,
          style: { text: hrRange ? `HR   low ${hrRange[0]} · high ${hrRange[1]} bpm` : "HR", fill: t.ink2, fontSize: 11, fontWeight: 600 },
          silent: true,
        },
        ...(hasResp
          ? [
              {
                type: "text",
                left: 8,
                top: 276,
                style: { text: "Breaths/min", fill: t.ink2, fontSize: 11, fontWeight: 600 },
                silent: true,
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleep, theme]);

  if (!option) return null;

  const rows = [
    { name: "Deep", s: sleep.deepS, cls: "bg-[var(--sleep-deep)]" },
    { name: "Light", s: sleep.lightS, cls: "bg-[var(--sleep-light)]" },
    { name: "REM", s: sleep.remS, cls: "bg-[var(--sleep-rem)]" },
    { name: "Awake", s: sleep.awakeS, cls: "bg-[var(--sleep-awake)]" },
  ];
  const total = rows.reduce((a, b) => a + b.s, 0) || 1;

  const dateLabel = new Date(sleep.date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <Card
      kicker={nav && !nav.isLatest ? "Night" : "Last night"}
      title={nav ? undefined : dateLabel}
      value={sleep.score != null ? String(sleep.score) : undefined}
    >
      {nav && (
        <div className="mb-2 flex items-center justify-between">
          {/* arrows pinned to the card edges: fixed positions regardless of
              the date's width, and clear of the score above */}
          <NavBtn dir="prev" onClick={nav.onPrev} />
          <span className="flex-1 text-center text-[17px] font-semibold">{dateLabel}</span>
          <NavBtn dir="next" onClick={nav.onNext} />
        </div>
      )}
      <EChart option={option} height={sleep.respiration.length > 5 ? 392 : 284} />
      {(sleep.restlessMoments != null || sleep.awakeCount != null || sleep.sleepNeedMin != null) && (
        <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
          {sleep.restlessMoments != null && <span>{sleep.restlessMoments} restless moments</span>}
          {sleep.awakeCount != null && <span>{sleep.awakeCount} wake-up{sleep.awakeCount === 1 ? "" : "s"}</span>}
          {sleep.sleepNeedMin != null && <span>need {fmtHoursMin(sleep.sleepNeedMin)}</span>}
        </div>
      )}
      <table className="tnum mt-1 w-full text-[12px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-hairline">
              <td className="flex items-center gap-2 py-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${r.cls}`} />
                <span className="text-ink-2">{r.name}</span>
              </td>
              <td className="text-right">{fmtHoursMin(r.s / 60)}</td>
              <td className="w-14 text-right text-ink-3">{Math.round((r.s / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
