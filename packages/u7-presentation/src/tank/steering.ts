// steering — allocation-free boids for the render loop (W36; BR20).
// Render-side only: reads/writes the world buffers, never GameState, never
// the store. All working state lives in preallocated Float32Arrays owned by
// the world (plus module scratch sized once per capacity), so the hot loop
// performs zero per-frame allocation — pinned by the constructor-count probe
// in render.test.ts. Time is injected (game-time derived), never wall-clock.
export interface BoidsWorld {
  pos: Float32Array;
  vel: Float32Array;
  count: number;
  capacity: number;
}

export interface BoidsParams {
  separation: number;
  alignment: number;
  cohesion: number;
  maxSpeed: number;
  radius: number;
  bounds: { w: number; h: number };
  reducedMotion: boolean;
  time: number;
}

export function createBoidsWorld(capacity: number): BoidsWorld {
  return {
    pos: new Float32Array(capacity * 2),
    vel: new Float32Array(capacity * 2),
    count: 0,
    capacity,
  };
}

/** Deterministic dart gate: full motion bursts, reduced motion never does. */
function dartGate(time: number, index: number, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  let h = 5381 + index * 97;
  h = (h * 33 + (time | 0)) >>> 0;
  h = (h * 33 + ((time * 7) | 0)) >>> 0;
  return h % 10 >= 8;
}

export function stepBoids(world: BoidsWorld, p: BoidsParams): void {
  const pos = world.pos;
  const vel = world.vel;
  const n = world.count < world.capacity ? world.count : world.capacity;
  const r2 = p.radius * p.radius;
  const cap = p.reducedMotion ? p.maxSpeed : p.maxSpeed * 2;
  const wobbleAmp = p.reducedMotion ? 0.02 : 0.15;
  const wob = Math.sin(p.time * 2.1) * wobbleAmp;
  for (let i = 0; i < n; i++) {
    const ix = i * 2;
    const iy = ix + 1;
    const px: number = pos[ix]!;
    const py: number = pos[iy]!;
    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let nb = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const jx = j * 2;
      const jy = jx + 1;
      const dx = px - pos[jx]!;
      const dy = py - pos[jy]!;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 === 0) continue;
      nb++;
      const inv = 1 / d2;
      sepX += dx * inv;
      sepY += dy * inv;
      aliX += vel[jx]!;
      aliY += vel[jy]!;
      cohX += pos[jx]!;
      cohY += pos[jy]!;
    }
    let ax = 0;
    let ay = 0;
    if (nb > 0) {
      const invNb = 1 / nb;
      ax += sepX * p.separation;
      ay += sepY * p.separation;
      ax += (aliX * invNb - vel[ix]!) * p.alignment;
      ay += (aliY * invNb - vel[iy]!) * p.alignment;
      const gx = cohX * invNb - px;
      const gy = cohY * invNb - py;
      const gl = Math.sqrt(gx * gx + gy * gy);
      if (gl > 0.0001) {
        // Arrive falloff: full pull beyond 20 units, easing off inside so
        // the pair settles instead of oscillating through each other.
        const arrive = gl > 20 ? 1 : gl / 20;
        ax += (gx / gl) * p.cohesion * arrive;
        ay += (gy / gl) * p.cohesion * arrive;
      }
    }
    const dart = dartGate(p.time, i, p.reducedMotion);
    let vx = vel[ix]! + ax + -wob * 0.1;
    let vy = vel[iy]! + ay + wob * 0.1;
    // Water drag: keeps pursuit stable (no orbit/overshoot) and identical
    // for both motion modes — darting is the only full-motion extra.
    vx *= 0.9;
    vy *= 0.9;
    if (dart) {
      // Bounded burst: snap to 1.5x cruise in the current heading — a dart
      // is an impulse, never a multiplier, so it cannot run away.
      const sp = Math.sqrt(vx * vx + vy * vy);
      if (sp > 0.0001) {
        const k = (p.maxSpeed * 1.5) / sp;
        vx *= k;
        vy *= k;
      }
    }
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > cap && sp > 0) {
      const k = cap / sp;
      vx *= k;
      vy *= k;
    }
    vel[ix] = vx;
    vel[iy] = vy;
    let nx = px + vx;
    let ny = py + vy;
    if (nx < 0) {
      nx = 0;
      vel[ix] = -vx * 0.8;
    } else if (nx > p.bounds.w) {
      nx = p.bounds.w;
      vel[ix] = -vx * 0.8;
    }
    if (ny < 0) {
      ny = 0;
      vel[iy] = -vy * 0.8;
    } else if (ny > p.bounds.h) {
      ny = p.bounds.h;
      vel[iy] = -vy * 0.8;
    }
    pos[ix] = nx;
    pos[iy] = ny;
  }
}
