// lighting — day/night tint curves for the tank canvas (W37; NFR2).
// Pure functions of the game clock: continuous interpolation for full
// motion, three snapped stops for reduced motion (ambient transitions off,
// tint jumps, fish stay calm via steering params).
export interface Tint {
  r: number;
  g: number;
  b: number;
  overlay: number;
}

const DAY: Tint = { r: 255, g: 244, b: 224, overlay: 0 };
const DUSK: Tint = { r: 255, g: 150, b: 90, overlay: 0.25 };
const NIGHT: Tint = { r: 24, g: 40, b: 90, overlay: 0.55 };

function lerp(a: Tint, b: Tint, t: number): Tint {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    overlay: a.overlay + (b.overlay - a.overlay) * t,
  };
}

/** Continuous tint: night → dawn(4–10) → day → dusk(16–22) → night. */
export function tintFor(_gameDay: number, gameHour: number): Tint {
  const h = ((gameHour % 24) + 24) % 24;
  if (h < 4) return { ...NIGHT };
  if (h < 10) return lerp(NIGHT, DAY, (h - 4) / 6);
  if (h < 16) return { ...DAY };
  if (h < 22) return lerp(DAY, NIGHT, (h - 16) / 6);
  return { ...NIGHT };
}

/** Reduced-motion tint: exactly the DAY/DUSK/NIGHT stops, never between. */
export function snappedTint(gameHour: number): Tint {
  const h = ((gameHour % 24) + 24) % 24;
  if (h >= 8 && h < 18) return { ...DAY };
  if ((h >= 6 && h < 8) || (h >= 18 && h < 20)) return { ...DUSK };
  return { ...NIGHT };
}

function channel(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
}

/** Canvas background for a tint: `#rrggbb`. */
export function tintHex(tint: Tint): string {
  return `#${channel(tint.r)}${channel(tint.g)}${channel(tint.b)}`;
}
