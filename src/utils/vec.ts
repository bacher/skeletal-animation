export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export function normalize3v([x1, x2, x3]: Vec3 | Vec4): Vec3 {
  const modifier = Math.sqrt(x1 ** 2 + x2 ** 2 + x3 ** 2);

  return [x1 / modifier, x2 * modifier, x3 * modifier];
}

export function addVec3(v1: Vec3, v2: Vec3): Vec3 {
  return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
}
