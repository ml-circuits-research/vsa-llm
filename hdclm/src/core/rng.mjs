// Generatorul cu sămânță (mulberry32). Tot hazardul din sistem vine de aici.
export const EPS = 1e-9;

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[next.int(arr.length)];
  next.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = next.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return next;
}

// Ordine stabilă: scor descrescător, apoi id crescător; scoruri la mai puțin de 1e-9 sunt egale.
export function byScoreThenId(a, b) {
  const d = b.score - a.score;
  if (Math.abs(d) > EPS) return d;
  return cmpId(a.id, b.id);
}

export function cmpId(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a), sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
