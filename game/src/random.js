// Ember & Thyme: small deterministic helpers (seeded RNG, geometry, lists).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function rectCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Nearest point on a rect to (x, y); used for "in range of a station" checks.
export function nearestPointOnRect(x, y, rect) {
  return {
    x: clamp(x, rect.x, rect.x + rect.w),
    y: clamp(y, rect.y, rect.y + rect.h),
  };
}

export function distToRect(x, y, rect) {
  const p = nearestPointOnRect(x, y, rect);
  return dist(x, y, p.x, p.y);
}

export function pickRandom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

// Multiset equality: same prepared ids, same counts, any order.
export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const item of a) counts.set(item, (counts.get(item) || 0) + 1);
  for (const item of b) {
    const n = counts.get(item) || 0;
    if (n === 0) return false;
    counts.set(item, n - 1);
  }
  return true;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
