// Small stroke icons for tiles and explore rows — same language as the tab
// bar (1.8 stroke, round caps, currentColor).
const S = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PulseIcon() {
  return (
    <svg {...S}>
      <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5 8.8 10.4 8.8 10.4s3.4-2 6.1-4.9" />
      <path d="M3.5 12h4l1.5-3 2.5 6 2-4h6" />
    </svg>
  );
}

export function BarsIcon() {
  return (
    <svg {...S}>
      <path d="M5 20V12" />
      <path d="M10 20V6" />
      <path d="M15 20v-5" />
      <path d="M20 20V9" />
    </svg>
  );
}

export function RouteIcon() {
  return (
    <svg {...S}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7" transform="rotate(180 12 12)" />
    </svg>
  );
}

export function StrideIcon() {
  return (
    <svg {...S}>
      <path d="M4 17l4-1 2-4-2-2 3-4 3 2 4 1" />
      <path d="M10 12l2 5-1 4" />
      <circle cx="15" cy="4" r="1.6" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg {...S}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H5a3 3 0 0 0 3 4" />
      <path d="M16 5h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function MoonBedIcon() {
  return (
    <svg {...S}>
      <path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function WavesIcon() {
  return (
    <svg {...S}>
      <path d="M3 8c2 0 2.5-1.5 4.5-1.5S10 8 12 8s2.5-1.5 4.5-1.5S19 8 21 8" />
      <path d="M3 13c2 0 2.5-1.5 4.5-1.5S10 13 12 13s2.5-1.5 4.5-1.5S19 13 21 13" />
      <path d="M3 18c2 0 2.5-1.5 4.5-1.5S10 18 12 18s2.5-1.5 4.5-1.5S19 18 21 18" />
    </svg>
  );
}

export function SwapIcon() {
  return (
    <svg {...S}>
      <path d="M16 4l4 4-4 4" />
      <path d="M20 8H7" />
      <path d="M8 12l-4 4 4 4" />
      <path d="M4 16h13" />
    </svg>
  );
}
