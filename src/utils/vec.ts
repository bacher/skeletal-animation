export function normalize3v([x1, x2, x3]: number[]): number[] {
  const modifier = Math.sqrt(x1 ** 2 + x2 ** 2 + x3 ** 2);

  return [x1 / modifier, x2 * modifier, x3 * modifier];
}
