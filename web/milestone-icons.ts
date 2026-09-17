// One small icon per row of the ladder, in the colors of palette.ts.
// Inline SVG, so the dialog needs no image files and no network.

const BIKE = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6" cy="16" r="4.4" stroke="#4b4f55" stroke-width="1.6" />
  <circle cx="18" cy="16" r="4.4" stroke="#4b4f55" stroke-width="1.6" />
  <path d="M6 16l4.5-7 4.5 7M10.5 9h4" stroke="#f2c230" stroke-width="1.8" />
  <path d="M14 7.5h2.5" stroke="#4b4f55" stroke-width="1.6" />
</svg>`;

const car = (paint: string) => `<svg viewBox="0 0 24 24">
  <path d="M3 14.4c0-.9.4-1.5 1.2-1.8l1.7-3.4C6.3 8.4 7 8 7.9 8h8.2c.9 0 1.6.4 2 1.2l1.7 3.4c.8.3 1.2.9 1.2 1.8v2c0 .4-.3.7-.7.7h-1.6a.7.7 0 0 1-.7-.7v-.2H6v.2c0 .4-.3.7-.7.7H3.7a.7.7 0 0 1-.7-.7z" fill="${paint}" />
  <path d="M7.6 9.6h8.8l1.3 2.8H6.3z" fill="#cfe0ef" />
  <circle cx="7" cy="16.2" r="1.6" fill="#2b2b2e" />
  <circle cx="17" cy="16.2" r="1.6" fill="#2b2b2e" />
</svg>`;

const FLAG = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
  <path d="M8 3.5v17" stroke="#8f98a3" stroke-width="1.8" />
  <path d="M9 4.5h8.5L15 8l2.5 3.5H9z" fill="#e2702f" />
  <path d="M5.5 20.5h5" stroke="#4b4f55" stroke-width="1.8" />
</svg>`;

const COFFEE = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
  <path d="M5 9.5h11v4.6a3.6 3.6 0 0 1-3.6 3.6H8.6A3.6 3.6 0 0 1 5 14.1z" fill="#b68a57" />
  <path d="M16.2 11h1.4a2.1 2.1 0 1 1 0 4.2h-1.4" stroke="#8f98a3" stroke-width="1.5" />
  <path d="M8.3 7c0-1 1-1.3 1-2.3M12 7c0-1 1-1.3 1-2.3" stroke="#8f98a3" stroke-width="1.4" />
  <path d="M4 20h13" stroke="#4b4f55" stroke-width="1.7" />
</svg>`;

const TRUCK = `<svg viewBox="0 0 24 24">
  <rect x="2" y="7" width="12" height="8" rx="1" fill="#e3e6e9" stroke="#8f98a3" stroke-width="1.3" />
  <path d="M14 9h3.5l3 3.3V15H14z" fill="#c8372d" />
  <circle cx="6.5" cy="16.4" r="1.7" fill="#2b2b2e" />
  <circle cx="17" cy="16.4" r="1.7" fill="#2b2b2e" />
</svg>`;

const CHARGER = `<svg viewBox="0 0 24 24">
  <rect x="6.5" y="3.5" width="11" height="17" rx="2" fill="#8f98a3" />
  <rect x="8.5" y="5.5" width="7" height="4.5" rx="1" fill="#e9edf0" />
  <path d="M13.2 11.4 9.6 17h2.4l-.7 3.1 3.6-5.2h-2.4z" fill="#f2c230" />
</svg>`;

const HELICOPTER = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
  <path d="M2 4.5h13M8.5 5v2" stroke="#4b4f55" stroke-width="1.6" />
  <path d="M4 10.8a3.8 3.8 0 0 1 3.8-3.8h1.4c1.9 0 3.5 1.3 4 3.1l.4 1.6h5.9l-1 2.5h-.5l-.9-1.2h-3.5v1.3H5.4A1.4 1.4 0 0 1 4 12.9z" fill="#c8372d" />
  <path d="M5.6 9.2h3.6v2.2H4.6" stroke="#f0d7d4" stroke-width="1.2" />
  <path d="M3 17.5h9M5.8 14.5v3M10 14.5v3M19 12v3.4" stroke="#4b4f55" stroke-width="1.5" />
</svg>`;

const TURBINE = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
  <path d="M12 10.5v9.5" stroke="#b9bdc1" stroke-width="2.2" />
  <path d="M8.5 20.5h7" stroke="#4b4f55" stroke-width="1.7" />
  <path d="M12 10 12 3M12 10l6.2 3.4M12 10 5.8 13.4" stroke="#6f7276" stroke-width="2.3" />
  <circle cx="12" cy="10" r="1.5" fill="#4b4f55" />
</svg>`;

const BLIMP = `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
  <ellipse cx="11" cy="10.5" rx="8.5" ry="4.6" fill="#e2702f" />
  <path d="M18.5 8 22 6.3v8.4L18.5 13z" fill="#c9c7c0" />
  <rect x="8.5" y="14.6" width="5" height="2.3" rx="1" fill="#4b4f55" />
  <path d="M11 17v3.4" stroke="#8f98a3" stroke-width="1.3" />
</svg>`;

// Same order as MILESTONES in milestone-ladder.ts.
export const MILESTONE_ICONS: readonly string[] = [
  BIKE,
  car("#3a6ea5"),
  car("#4c9a4a"),
  FLAG,
  COFFEE,
  TRUCK,
  CHARGER,
  HELICOPTER,
  TURBINE,
  BLIMP,
];
