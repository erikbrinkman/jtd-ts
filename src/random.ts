export function bernoulli(prob = 0.5): boolean {
  return Math.random() < prob;
}

export function uniform(start: number, end: number): number {
  return start + Math.floor(Math.random() * (end - start));
}

export function choice<T>(vals: readonly T[]): T {
  return vals[uniform(0, vals.length)];
}

let CACHE: number | undefined;
export function gaussian(): number {
  if (CACHE === undefined) {
    const rad = Math.sqrt(-2 * Math.log(Math.random()));
    const ang = 2 * Math.PI * Math.random();
    CACHE = rad * Math.sin(ang);
    return rad * Math.cos(ang);
  } else {
    const val = CACHE;
    CACHE = undefined;
    return val;
  }
}

export function poisson(rate = 1): number {
  const limit = Math.exp(-rate);
  let k = 0;
  let p = Math.random();
  while (p > limit) {
    k++;
    p *= Math.random();
  }
  return k;
}

const CHARS =
  // eslint-disable-next-line spellcheck/spell-checker
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ;,'\"";

export function chars(len: number): string {
  return Array(len)
    .fill(null)
    .map(() => CHARS.charAt(Math.floor(Math.random() * CHARS.length)))
    .join("");
}
