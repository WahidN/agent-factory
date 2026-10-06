export type ViewOptions = {
  autoFit: boolean;
  fitScale: number;
  /** `?tour`, with or without a value. */
  tour: boolean;
  /** `?demo=events`: the page invents events for a screenshot or a pitch. */
  demoEvents: boolean;
  /** `?clock=HH:MM` as minutes since midnight, or null. */
  clockMinutes: number | null;
  /** `?weekday=1..7`, ISO (5 = Friday), or null. */
  weekday: number | null;
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

function clockMinutesFrom(value: string | null): number | null {
  const match = value === null ? null : CLOCK.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function weekdayFrom(value: string | null): number | null {
  return value !== null && /^[1-7]$/.test(value) ? Number(value) : null;
}

const MIN_FIT_SCALE = 0.5;
const MAX_FIT_SCALE = 1.35;

/** URL-controlled camera behavior for wall displays and overview links. */
export function viewOptionsFrom(search: string): ViewOptions {
  const params = new URLSearchParams(search);
  const showcase = params.get("mode") === "showcase";
  const requestedScale = Number(params.get("zoom"));
  const fitScale =
    Number.isFinite(requestedScale) && requestedScale > 0
      ? Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, requestedScale))
      : showcase
        ? MAX_FIT_SCALE
        : 1;

  return {
    autoFit: params.get("view") === "all" || showcase,
    fitScale,
    tour: params.has("tour"),
    demoEvents: params.get("demo") === "events",
    clockMinutes: clockMinutesFrom(params.get("clock")),
    weekday: weekdayFrom(params.get("weekday")),
  };
}
