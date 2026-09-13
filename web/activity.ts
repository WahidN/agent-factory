// A 0..1 value for one animated part. It eases toward its target over FADE_S,
// and once switched on it stays on for at least HOLD_MS, so short tool calls show.

export const FADE_S = 0.3;
export const HOLD_MS = 600;

export class Activity {
  value = 0;
  private on = false;
  private holdUntil = 0;

  set(on: boolean, nowMs: number) {
    if (on && !this.on) this.holdUntil = nowMs + HOLD_MS;
    this.on = on;
  }

  update(dtSeconds: number, nowMs: number): number {
    const target = this.on || nowMs < this.holdUntil ? 1 : 0;
    const step = dtSeconds / FADE_S;
    this.value = target > this.value ? Math.min(target, this.value + step) : Math.max(target, this.value - step);
    return this.value;
  }
}
