// W1 hero — the FabScore readiness ring + verdict + one-sentence reason.
// (Garmin's own training-readiness endpoint returns nothing for this device,
// so FabScore is the score; the factor ladder below keeps it transparent.)
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens } from "./theme";
import type { FabResult, Verdict } from "../../lib/derive/fabScore";
import { useSettings } from "../../store/settingsStore";

const VERDICT_META: Record<Verdict, { word: string; icon: string; tokenClass: string }> = {
  train: { word: "Train", icon: "▶", tokenClass: "text-status-good" },
  easy: { word: "Easy only", icon: "⚠", tokenClass: "text-status-warn" },
  rest: { word: "Rest", icon: "☾", tokenClass: "text-status-critical" },
};

export function ReadinessRing({ fab }: { fab: FabResult }) {
  const theme = useSettings((s) => s.theme);

  const option = useMemo(() => {
    const t = tokens();
    const color =
      fab.verdict === "train" ? t.statusGood : fab.verdict === "easy" ? t.statusWarn : t.statusCritical;
    return {
      series: [
        {
          type: "gauge",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 100,
          radius: "100%",
          center: ["50%", "58%"],
          progress: { show: true, width: 10, roundCap: true, itemStyle: { color } },
          axisLine: { lineStyle: { width: 10, color: [[1, t.grid]] } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, 0],
            fontSize: 44,
            fontWeight: 600,
            color: t.ink,
            formatter: (v: number) => String(Math.round(v)),
          },
          data: [{ value: fab.score ?? 0 }],
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fab.score, fab.verdict, theme]);

  const meta = fab.verdict ? VERDICT_META[fab.verdict] : null;

  return (
    <div className="flex items-center gap-4">
      <div className="w-[136px] shrink-0">
        <EChart option={option} height={130} />
      </div>
      <div className="min-w-0 flex-1">
        {meta ? (
          <>
            <div className={`flex items-center gap-2 text-[26px] font-semibold leading-tight ${meta.tokenClass}`}>
              <span aria-hidden>{meta.icon}</span>
              <span className="text-ink">{meta.word}</span>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{fab.sentence}</p>
          </>
        ) : (
          <p className="text-[13px] text-ink-2">{fab.sentence}</p>
        )}
      </div>
    </div>
  );
}
