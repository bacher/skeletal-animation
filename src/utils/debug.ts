import { vec3, vec4 } from 'gl-matrix';

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

export function printVec(v: number[] | vec3 | vec4) {
  console.log(
    Array.from(v)
      .map((a) => a.toFixed(4).padStart(8))
      .join(' '),
  );
}
