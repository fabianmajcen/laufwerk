// W16 — personal records straight from Garmin's PR service.
import { useLiveQuery } from "dexie-react-hooks";
import { getKv } from "../../lib/db/repo";
import { fmtDuration } from "../../lib/format";
import { Card } from "../components/ScreenHeader";

// Garmin PR typeIds (running + steps subset)
const PR_TYPES: Record<number, { label: string; kind: "time" | "distance" | "steps" }> = {
  1: { label: "Fastest 1 km", kind: "time" },
  2: { label: "Fastest 1 mile", kind: "time" },
  3: { label: "Fastest 5 km", kind: "time" },
  4: { label: "Fastest 10 km", kind: "time" },
  7: { label: "Longest run", kind: "distance" },
  12: { label: "Most steps in a day", kind: "steps" },
  13: { label: "Most steps in a week", kind: "steps" },
};

interface PrRow {
  typeId: number;
  value?: number;
  activityStartDateTimeLocal?: number;
}

export function RecordsShelf() {
  const stored = useLiveQuery(
    async () => getKv<{ payload: PrRow[]; fetchedAt: number }>("personalRecords"),
    [],
  );

  const prs = (stored?.payload ?? [])
    .filter((p) => PR_TYPES[p.typeId] && p.value != null && p.value > 0)
    .sort((a, b) => a.typeId - b.typeId);

  if (!prs.length) return null;

  const fmt = (p: PrRow) => {
    const kind = PR_TYPES[p.typeId].kind;
    if (kind === "time") return fmtDuration(p.value as number);
    if (kind === "distance") return `${((p.value as number) / 1000).toFixed(2)} km`;
    return Math.round(p.value as number).toLocaleString("en-GB");
  };

  return (
    <Card kicker="Personal records" title="Your bests" footnote="Straight from Garmin's PR service — beat one and it updates on the next sync.">
      <div className="grid grid-cols-2 gap-3">
        {prs.map((p) => (
          <div key={p.typeId} className="rounded-xl bg-page p-3">
            <div className="kicker">{PR_TYPES[p.typeId].label}</div>
            <div className="tnum mt-1 text-[20px] font-semibold">{fmt(p)}</div>
            {p.activityStartDateTimeLocal && (
              <div className="text-[10px] text-ink-3">
                {new Date(p.activityStartDateTimeLocal).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
