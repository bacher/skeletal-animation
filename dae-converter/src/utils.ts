import { mat4, quat, vec3 } from 'gl-matrix';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type Number16 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export function subtractVec3(v1: Vec3, v2: Vec3): Vec3 {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}

export function printMat(mat: mat4) {
  return Array.from(mat)
    .map((a) => a.toFixed(4).padStart(7))
    .join('  ');
}

export function crossProductVec3(a: vec3, b: vec3): vec3 {
  const x = a[1] * b[2] - b[1] * a[2];
  const y = b[0] * a[2] - a[0] * b[2];
  const z = a[0] * b[1] - b[0] * a[1];

  return vec3.fromValues(x, y, z);
}

export function dotProductVec3(a: vec3, b: vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function rotationBetween(
  v1: Vec3 | Float32Array,
  v2: Vec3 | Float32Array,
): quat {
  // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
  const cross = crossProductVec3(v1, v2); // vec3.cross(vec3.create(), v1, v2);
  const dot = dotProductVec3(v1, v2); // vec3.dot(v1, v2)
  const q = quat.fromValues(...(cross as Vec3), 1 + dot);
  quat.normalize(q, q);
  return q;
}

function serializeVec(vec: number[] | Float32Array): string {
  return Array.from(vec)
    .map((a) => `${a < 0 ? '' : ' '}${a.toFixed(4)}`)
    .join(' ');
}

export function compareTwoVec(
  v1: number[] | Float32Array,
  v2: number[] | Float32Array,
): void {
  const s1 = serializeVec(v1);
  const s2 = serializeVec(v2);

  if (s1 !== s2) {
    console.log('Assert failed', s1, '!==', s2);
  }
}
