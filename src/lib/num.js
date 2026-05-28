export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function round(v, decimals = 3) {
  const k = 10 ** decimals;
  return Math.round(v * k) / k;
}
