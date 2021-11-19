export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export function normalize3v([x1, x2, x3]: Vec3 | Vec4): Vec3 {
  const modifier = Math.sqrt(x1 ** 2 + x2 ** 2 + x3 ** 2);

  return [x1 / modifier, x2 * modifier, x3 * modifier];
}
