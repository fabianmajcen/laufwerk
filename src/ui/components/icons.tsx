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

export function FootprintsIcon() {
  return (
    <svg {...S}>
      <path d="M6.5 3.5C8.2 3.5 9 5.1 9 7c0 2-.8 3-.8 4.5H4.8C4.8 10 4 9 4 7c0-1.9.8-3.5 2.5-3.5z" />
      <path d="M4.9 14h3.2v1.4a1.6 1.6 0 0 1-3.2 0z" />
      <path d="M17.5 8.5C15.8 8.5 15 10.1 15 12c0 2 .8 3 .8 4.5h3.4c0-1.5.8-2.5.8-4.5 0-1.9-.8-3.5-2.5-3.5z" />
      <path d="M15.9 19h3.2v1.4a1.6 1.6 0 0 1-3.2 0z" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg {...S}>
      <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6C3.2 13.6 12 19 12 19s8.8-5.4 8.8-10.4z" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function CloudSunIcon() {
  return (
    <svg {...S}>
      <circle cx="7.5" cy="7" r="2.4" />
      <path d="M7.5 2.5v1M2.5 7h1M4 3.5l.7.7M11 3.5l-.7.7" />
      <path d="M9.5 20h7.8a3.4 3.4 0 0 0 .5-6.8 4.8 4.8 0 0 0-9.3 1.2A2.9 2.9 0 0 0 9.5 20z" />
    </svg>
  );
}

export function CloudIcon() {
  return (
    <svg {...S}>
      <path d="M7 19h9.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 19z" />
    </svg>
  );
}

export function RainIcon() {
  return (
    <svg {...S}>
      <path d="M7 15h9.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 15z" />
      <path d="M8.5 18l-.7 2M12.5 18l-.7 2M16.5 18l-.7 2" />
    </svg>
  );
}

export function SnowIcon() {
  return (
    <svg {...S}>
      <path d="M7 15h9.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 15z" />
      <path d="M9 18.5h.01M12.5 19.5h.01M16 18.5h.01" />
    </svg>
  );
}
