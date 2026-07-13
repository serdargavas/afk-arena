// Custom inline-SVG icons themed for the knight's armor (steel line + gold gem).
// `currentColor` drives the steel; the gold accents are fixed so they always pop.

const GOLD = '#ffcf4d';

interface P {
  size?: number;
}

function Svg({ size = 22, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Meta / rebirth — an ornate crested shield with a gem. */
export function IconMeta(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 2.5 20 5.5v6c0 5-4 8.5-8 10.5-4-2-8-5.5-8-10.5v-6z" />
      <path d="M12 6.5v9" stroke={GOLD} />
      <circle cx="12" cy="10" r="1.9" fill={GOLD} stroke={GOLD} />
    </Svg>
  );
}

/** Skills — a branching node tree. */
export function IconSkills(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 20v-5m0 0 5-4m-5 4-5-4m5 4V7" />
      <circle cx="12" cy="5" r="2.2" fill={GOLD} stroke={GOLD} />
      <circle cx="6" cy="10" r="1.8" />
      <circle cx="18" cy="10" r="1.8" />
      <circle cx="12" cy="21" r="1.6" />
    </Svg>
  );
}

/** Gear — a knight's horned helmet. */
export function IconGear(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 4c-1 3-1 5 0 7 1.5 2 4 3 7 3s5.5-1 7-3c1-2 1-4 0-7" stroke={GOLD} />
      <path d="M6 11v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" />
      <path d="M9.5 12.5h5" />
      <path d="M12 18v3" />
    </Svg>
  );
}

/** Leaderboard — a trophy. */
export function IconTrophy(p: P) {
  return (
    <Svg {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" stroke={GOLD} />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v4m-3 4h6m-5 0 .6-3.5h2.8L14 21" />
    </Svg>
  );
}

/** Settings — a cog. */
export function IconSettings(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Svg>
  );
}
