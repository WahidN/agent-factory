export type RoofMass = {
  /** Footprint as a fraction of the hall roof. */
  width: number;
  depth: number;
  height: number;
  /** -1..1 places the mass between the matching roof edges. */
  x: number;
  z: number;
  /** Height above the common roof-mass datum. */
  elevation: number;
};

export type FactoryStyle = {
  name: string;
  stackAxis: "x" | "z";
  roofMasses: readonly [RoofMass, RoofMass];
};

export type ResolvedRoofMass = {
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  elevation: number;
};

// Six legible industrial families. Every family deliberately uses two simple
// volumes: enough to change the skyline, but still only two instanced draw
// calls for the whole far park. The same data drives the detailed hall.
const FACTORY_STYLES: readonly FactoryStyle[] = [
  {
    name: "river-monitor",
    stackAxis: "x",
    roofMasses: [
      { width: 0.28, depth: 0.78, height: 1.15, x: 0, z: 0, elevation: 0 },
      { width: 0.12, depth: 0.58, height: 0.55, x: 0.72, z: 0, elevation: 0 },
    ],
  },
  {
    name: "rail-lantern",
    stackAxis: "z",
    roofMasses: [
      { width: 0.72, depth: 0.24, height: 0.9, x: 0, z: 0, elevation: 0 },
      { width: 0.46, depth: 0.12, height: 0.5, x: 0, z: -0.72, elevation: 0 },
    ],
  },
  {
    name: "twin-clerestory",
    stackAxis: "x",
    roofMasses: [
      { width: 0.2, depth: 0.62, height: 1.3, x: -0.5, z: 0, elevation: 0 },
      { width: 0.2, depth: 0.62, height: 1.3, x: 0.5, z: 0, elevation: 0 },
    ],
  },
  {
    name: "stepped-crown",
    stackAxis: "z",
    roofMasses: [
      { width: 0.52, depth: 0.5, height: 1, x: 0, z: 0, elevation: 0 },
      { width: 0.27, depth: 0.28, height: 0.95, x: 0, z: 0, elevation: 1 },
    ],
  },
  {
    name: "offset-service-spine",
    stackAxis: "x",
    roofMasses: [
      { width: 0.2, depth: 0.82, height: 1.05, x: -0.68, z: 0, elevation: 0 },
      { width: 0.24, depth: 0.3, height: 1.9, x: 0.58, z: 0.38, elevation: 0 },
    ],
  },
  {
    name: "split-terminal",
    stackAxis: "z",
    roofMasses: [
      { width: 0.6, depth: 0.2, height: 1.2, x: 0, z: -0.55, elevation: 0 },
      { width: 0.34, depth: 0.27, height: 1.65, x: 0.52, z: 0.55, elevation: 0 },
    ],
  },
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

// Resolve fractions once, identically for detailed geometry and far LOD.
// Offsets use the free space after sizing, which guarantees every family
// remains inside even the smallest hall roof.
export function resolveRoofMasses(style: FactoryStyle, hallWidth: number, hallDepth: number): ResolvedRoofMass[] {
  return style.roofMasses.map((mass) => {
    const width = Math.min(hallWidth, Math.max(2.4, hallWidth * mass.width));
    const depth = Math.min(hallDepth, Math.max(2.4, hallDepth * mass.depth));
    return {
      width,
      depth,
      height: mass.height,
      x: (mass.x * (hallWidth - width)) / 2,
      z: (mass.z * (hallDepth - depth)) / 2,
      elevation: mass.elevation,
    };
  });
}

export const FACTORY_STYLE_COUNT = FACTORY_STYLES.length;
