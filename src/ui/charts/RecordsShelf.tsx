// W16 — personal records straight from Garmin's PR service. Fixed slots so
// the page reads as a complete shelf; distances you haven't raced yet show
// as open goals.
import { useLiveQuery } from "dexie-react-hooks";
import { getKv } from "../../lib/db/repo";
import { fmtDuration } from "../../lib/format";
import { Card } from "../components/ScreenHeader";

interface Slot {
  typeId: number;
  label: string;
  kind: "time" | "distance" | "steps";
}

// Garmin PR typeIds; fixed shelf order (1 mile omitted deliberately)
const SLOTS: Slot[] = [
  { typeId: 1, label: "Fastest 1 km", kind: "time" },
  { typeId: 3, label: "Fastest 5 km", kind: "time" },
  { typeId: 4, label: "Fastest 10 km", kind: "time" },
  { typeId: 5, label: "Half marathon", kind: "time" },
  { typeId: 6, label: "Marathon", kind: "time" },
  { typeId: 7, label: "Longest run", kind: "distance" },
  { typeId: 12, label: "Most steps · day", kind: "steps" },
  { typeId: 13, label: "Most steps · week", kind: "steps" },
];

interface PrRow {
  typeId: number;
  value?: number;
  activityStartDateTimeLocal?: number;
}

export function RecordsShelf({ onSelect }: { onSelect?: (typeId: number, label: string) => void }) {
  const stored = useLiveQuery(
    async () => getKv<{ payload: PrRow[]; fetchedAt: number }>("personalRecords"),
    [],
  );

  const byType = new Map(
    (stored?.payload ?? [])
      .filter((p) => p.value != null && p.value > 0)
      .map((p) => [p.typeId, p]),
  );
  if (!byType.size) return null;

  const fmt = (slot: Slot, p: PrRow) => {
    if (slot.kind === "time") return fmtDuration(p.value as number);
    if (slot.kind === "distance") return `${((p.value as number) / 1000).toFixed(2)} km`;
    return Math.round(p.value as number).toLocaleString("en-GB");
  };

  return (
    <Card
      kicker="Personal records"
      title="Your bests"
      info="Straight from Garmin's records service; beat one and it updates on the next sync. Tap a record for its top 10. Empty slots are distances you haven't raced yet."
    >
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map((slot) => {
          const p = byType.get(slot.typeId);
          return (
            <button
              key={slot.typeId}
              onClick={onSelect ? () => onSelect(slot.typeId, slot.label) : undefined}
              className={`rounded-xl bg-page p-3 text-left active:opacity-70 ${p ? "" : "opacity-60"}`}
            >
              <div className="kicker">{slot.label}</div>
              {p ? (
                <>
                  <div className="tnum mt-1 text-[20px] font-semibold">{fmt(slot, p)}</div>
                  {p.activityStartDateTimeLocal && (
                    <div className="text-[10px] text-ink-3">
                      {new Date(p.activityStartDateTimeLocal).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-1 text-[20px] font-semibold text-ink-3">-</div>
                  <div className="text-[10px] text-ink-3">not yet run</div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
