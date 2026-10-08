import type { CityEvent, CityEventSink } from "./city-feed.ts";

export type TourTarget = { x: number; z: number };

const EVENT_HOLD_S = 8;
const LOT_HOLD_S = 12;
const USER_PAUSE_S = 60;
const MAX_QUEUE = 5;
const IDLE_RETRY_S = 1;

/** What the tour is doing. `left` counts down in seconds. */
export type TourPhase =
  | { kind: "idle"; left: number }
  | { kind: "showingEvent"; left: number }
  | { kind: "cycling"; left: number }
  | { kind: "paused"; left: number };

export type TourState = {
  phase: TourPhase;
  /** Located events waiting for their turn, oldest first; the newest is shown first. */
  queue: TourTarget[];
  /** The last busy lot shown, so the round-robin continues after it. */
  lastLot: TourTarget | null;
};

export function createTourState(): TourState {
  return { phase: { kind: "idle", left: 0 }, queue: [], lastLot: null };
}

/** Next lot after `last` in (x, z) order, wrapping to the first. No allocation, no sort. */
function nextLot(lots: readonly TourTarget[], last: TourTarget | null): TourTarget | null {
  let after: TourTarget | null = null;
  let first: TourTarget | null = null;
  for (const lot of lots) {
    if (first === null || lot.x < first.x || (lot.x === first.x && lot.z < first.z)) first = lot;
    const isAfterLast = last === null || lot.x > last.x || (lot.x === last.x && lot.z > last.z);
    if (isAfterLast && (after === null || lot.x < after.x || (lot.x === after.x && lot.z < after.z))) after = lot;
  }
  return after ?? first;
}

export function pauseTour(state: TourState): void {
  state.phase = { kind: "paused", left: USER_PAUSE_S };
}

export function pushTourTarget(state: TourState, target: TourTarget): void {
  state.queue.push(target);
  if (state.queue.length > MAX_QUEUE) state.queue.shift();
}

/**
 * Advances the tour by dt seconds and returns where to pan, or null.
 * Mutates `state` in place and only allocates when the phase changes, so it is
 * safe to call every frame. `lots` is only called when a lot is needed.
 */
export function stepTour(state: TourState, dt: number, lots: () => readonly TourTarget[]): TourTarget | null {
  const { phase } = state;
  phase.left -= dt;
  if (phase.left > 0) {
    // A new event cuts a lot visit or an idle wait short, but never an event hold or a user pause.
    const interruptible = phase.kind === "cycling" || phase.kind === "idle";
    if (!interruptible || state.queue.length === 0) return null;
  }

  // Newest first: the tour follows the latest event, not a backlog.
  const event = state.queue.pop();
  if (event) {
    state.phase = { kind: "showingEvent", left: EVENT_HOLD_S };
    return event;
  }
  const lot = nextLot(lots(), state.lastLot);
  if (lot === null) {
    // Wait before searching again; reuse the idle phase so this does not allocate.
    if (phase.kind === "idle") phase.left = IDLE_RETRY_S;
    else state.phase = { kind: "idle", left: IDLE_RETRY_S };
    return null;
  }
  // Copy: the caller rewrites its pool in place between ticks.
  if (state.lastLot === null) state.lastLot = { x: lot.x, z: lot.z };
  else {
    state.lastLot.x = lot.x;
    state.lastLot.z = lot.z;
  }
  state.phase = { kind: "cycling", left: LOT_HOLD_S };
  return lot;
}

export class Tour implements CityEventSink {
  private readonly state = createTourState();

  constructor(
    private readonly pan: (x: number, z: number) => void,
    private readonly locate: (event: CityEvent) => TourTarget | null,
    private readonly busyLots: () => TourTarget[],
  ) {}

  push(event: CityEvent): void {
    const target = this.locate(event);
    if (target) pushTourTarget(this.state, target);
  }

  /** The user touched the camera: the tour stays still for 60 s, then continues. */
  pauseForUser(): void {
    pauseTour(this.state);
  }

  tick(dt: number): void {
    const target = stepTour(this.state, dt, this.busyLots);
    if (target) this.pan(target.x, target.z);
  }
}
