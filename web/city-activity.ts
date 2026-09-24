import type { SessionState } from "../server/types.ts";
import type { CityActivity, CityEventMode } from "./city-events.ts";

const LIVE_EVENTS = ["vierdaagse", "nec-matchday", "market-day"] as const;

/**
 * Pick exactly one live Nijmegen theme for the current clock hour. The stable
 * hourly bucket lets every open client switch together without a refresh and
 * guarantees that adjacent hours never repeat the same event.
 */
export function eventModeForTime(date: Date): Exclude<CityEventMode, "ordinary"> {
  const hour = Math.floor(date.getTime() / 3_600_000);
  const index = ((hour % LIVE_EVENTS.length) + LIVE_EVENTS.length) % LIVE_EVENTS.length;
  return LIVE_EVENTS[index];
}

export function cityActivity(
  sessions: Iterable<Pick<SessionState, "status">>,
  hour: number,
  event: Exclude<CityEventMode, "ordinary">,
): CityActivity {
  const states = [...sessions];
  const busy = states.filter(({ status }) => status === "busy").length;
  return {
    hour,
    busyRatio: states.length ? busy / states.length : 0,
    event,
  };
}
