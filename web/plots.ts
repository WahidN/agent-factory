// Gives each session a plot index that never changes while it runs.
// Plot 0 is a corner and the town grows outward in square shells.

export const PLOT_SIZE = 60;

export class PlotAllocator {
  private byId = new Map<string, number>();

  // Call with sessions sorted by start time so earlier sessions get lower plots.
  assign(id: string): number {
    const existing = this.byId.get(id);
    if (existing !== undefined) return existing;
    const used = new Set(this.byId.values());
    let index = 0;
    while (used.has(index)) index++;
    this.byId.set(id, index);
    return index;
  }

  release(id: string) {
    this.byId.delete(id);
  }

  indexOf(id: string): number | undefined {
    return this.byId.get(id);
  }

  indexes(): number[] {
    return [...this.byId.values()];
  }
}

// Shell s holds indexes s² .. (s+1)² - 1: down column x = s, then back along row z = s.
export function plotCell(index: number): { col: number; row: number } {
  const shell = Math.floor(Math.sqrt(index));
  const offset = index - shell * shell;
  return offset <= shell ? { col: shell, row: offset } : { col: 2 * shell - offset, row: shell };
}

export function plotPosition(index: number): { x: number; z: number } {
  const { col, row } = plotCell(index);
  return { x: col * PLOT_SIZE, z: row * PLOT_SIZE };
}
