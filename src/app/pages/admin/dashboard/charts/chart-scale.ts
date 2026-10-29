// Round axis steps (1, 2, 2.5, 5 x 10^n) reaching at least max, in about `count` ticks
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ??
    10 * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step / 2; tick += step) ticks.push(tick);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Indexes of about `count` evenly spread labels, the last one always included
export function spreadIndexes(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = Math.ceil((length - 1) / (count - 1));
  const indexes: number[] = [];
  for (let i = length - 1; i >= 0; i -= step) indexes.unshift(i);
  return indexes;
}
