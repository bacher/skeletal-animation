export function normalize3v(v3: number[]): number[] {
  const modifier = Math.sqrt(v3[0] ** 2 + v3[1] ** 2 + v3[2] ** 2);

  return v3.map((v) => v / modifier);
}
