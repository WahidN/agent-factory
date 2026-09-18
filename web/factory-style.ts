export type FactoryStyle = {
  roofWidth: number;
  roofDepth: number;
  roofHeight: number;
  stackAxis: "x" | "z";
};

const FACTORY_STYLES: readonly FactoryStyle[] = [
  { roofWidth: 0.26, roofDepth: 0.74, roofHeight: 1.15, stackAxis: "x" },
  { roofWidth: 0.68, roofDepth: 0.24, roofHeight: 0.85, stackAxis: "z" },
  { roofWidth: 0.44, roofDepth: 0.48, roofHeight: 1.45, stackAxis: "x" },
];

// FNV-1a gives every session a stable visual identity without persisting
// additional state or introducing Math.random() into the city layout.
export function factoryStyleIndex(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % FACTORY_STYLES.length;
}

export function factoryStyleFor(id: string): FactoryStyle {
  return FACTORY_STYLES[factoryStyleIndex(id)];
}

export const FACTORY_STYLE_COUNT = FACTORY_STYLES.length;
