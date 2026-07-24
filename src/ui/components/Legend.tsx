// Compact visual legend row: swatch + label pairs. Replaces prose like
// "green dot = start" under charts. One per chart, right below the plot.
export interface LegendItem {
  swatch: "dot" | "ring" | "line" | "dash" | "band" | "bar" | "triangle" | "gradient";
  /** CSS color (for dot/ring/line/dash/band/bar/triangle) */
  color?: string;
  /** CSS background (for gradient) */
  gradient?: string;
  /** swatch opacity, e.g. 0.55 for a de-emphasized series */
  opacity?: number;
  label: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <Swatch item={it} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Swatch({ item }: { item: LegendItem }) {
  const c = item.color ?? "var(--ink-3)";
  const op = item.opacity ?? 1;
  switch (item.swatch) {
    case "dot":
      return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c, opacity: op }} />;
    case "ring":
      return <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: c, opacity: op }} />;
    case "line":
      return <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: c, opacity: op }} />;
    case "dash":
      return (
        <span className="flex w-4 shrink-0 items-center justify-between" style={{ opacity: op }}>
          <span className="h-0.5 w-1 rounded-full" style={{ background: c }} />
          <span className="h-0.5 w-1 rounded-full" style={{ background: c }} />
          <span className="h-0.5 w-1 rounded-full" style={{ background: c }} />
        </span>
      );
    case "band":
      return <span className="h-2 w-4 shrink-0 rounded-sm" style={{ background: c, opacity: 0.35 * op }} />;
    case "bar":
      return <span className="h-3 w-2 shrink-0 rounded-[3px]" style={{ background: c, opacity: op }} />;
    case "triangle":
      return (
        <span
          className="h-0 w-0 shrink-0"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: `8px solid ${c}`,
            opacity: op,
          }}
        />
      );
    case "gradient":
      return <span className="h-2 w-6 shrink-0 rounded-full" style={{ background: item.gradient, opacity: op }} />;
  }
}

/** the recency ramp as a CSS gradient (older -> newer) */
export const RECENCY_GRADIENT = "linear-gradient(to right, var(--recency-lo), var(--recency-hi))";
