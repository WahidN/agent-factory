// Token total of this machine since the season start. Pure: no files and no
// clock.
//
// Keeps the largest total per message id. Streaming writes the same message
// several times while its output grows, and a resumed session copies old
// lines into a new file, so the first or the last copy would both be wrong.
//
// Messages from before the season start add nothing, so every machine starts
// at 0 on the same day. A new season is a new date here.

export const SEASON_START = Date.parse("2026-09-16T00:00:00Z");

export class UsageLedger {
  private totals = new Map<string, number>();
  private sum = 0;

  constructor(private since: number) {}

  // Returns true when the sum changed.
  add(id: string, total: number, at: number): boolean {
    if (at < this.since) return false;
    const known = this.totals.get(id) ?? 0;
    if (total <= known) return false;
    this.totals.set(id, total);
    this.sum += total - known;
    return true;
  }

  total(): number {
    return this.sum;
  }
}
