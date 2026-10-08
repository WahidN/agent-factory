import * as THREE from "three";

export type Daylight = {
  sky: THREE.Color;
  sunIntensity: number;
  hemiIntensity: number;
  lampGlow: number;
  terraceBoost: number;
};

// Day values equal what scene.ts and palette.ts used before the day rhythm.
const DAY = {
  classic: { sky: "#a9ced7", sun: 2.75, hemi: 1.55 },
  ink: { sky: "#797fa3", sun: 2.65, hemi: 1.45 },
} as const;
const NIGHT_SKY = { classic: "#0e1a33", ink: "#23274a" } as const;
const NIGHT_SUN = 0.35;
const NIGHT_HEMI = 0.6;
const DAY_LAMP = 0.6;
const NIGHT_LAMP = 2.5;

const DAWN = { from: 6.5 * 60, to: 8 * 60 };
const DUSK = { from: 18 * 60, to: 20 * 60 };

const { lerp } = THREE.MathUtils;

// Not THREE.MathUtils.smoothstep: it takes (value, min, max), this one (from, to, value).
function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

/** Minutes since midnight and ISO weekday (1 = Monday .. 7 = Sunday) in Europe/Amsterdam. */
export function amsterdamClock(date: Date): { minutes: number; weekday: number } {
  const parts = clockFormat.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")) + 1,
  };
}

export function daylightAt(minutes: number, weekday: number, ink: boolean): Daylight {
  const style = ink ? "ink" : "classic";
  // 0 at night, 1 by day, smooth through dawn and dusk.
  const day = smoothstep(DAWN.from, DAWN.to, minutes) * (1 - smoothstep(DUSK.from, DUSK.to, minutes));
  const friday = weekday === 5 && minutes >= 16 * 60 && minutes < 20 * 60;
  return {
    sky: new THREE.Color(NIGHT_SKY[style]).lerp(new THREE.Color(DAY[style].sky), day),
    sunIntensity: lerp(NIGHT_SUN, DAY[style].sun, day),
    hemiIntensity: lerp(NIGHT_HEMI, DAY[style].hemi, day),
    lampGlow: lerp(NIGHT_LAMP, DAY_LAMP, day),
    terraceBoost: friday ? 2 : 1,
  };
}
