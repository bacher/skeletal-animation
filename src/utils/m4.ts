import { Vec4 } from './vec';

export type Mat4 = [
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

export const m4 = {
  identify(): Mat4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },

  translation(tx: number, ty: number, tz: number): Mat4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
  },

  xRotation(angleInRadians: number): Mat4 {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);

    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  },

  yRotation(angleInRadians: number): Mat4 {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);

    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  },

  zRotation(angleInRadians: number): Mat4 {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);

    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },

  scaling(sx: number, sy: number, sz: number): Mat4 {
    return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
  },

  multiply(a: Mat4, b: Mat4): Mat4 {
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    return [
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
    ];
  },

  multiplyVector(m: Mat4, vec4: Vec4): Vec4 {
    const [x1, x2, x3, x4] = vec4;

    return [
      m[0] * x1 + m[1] * x2 + m[2] * x3 + m[3] * x4,
      m[4] * x1 + m[5] * x2 + m[6] * x3 + m[7] * x4,
      m[8] * x1 + m[9] * x2 + m[10] * x3 + m[11] * x4,
      m[12] * x1 + m[13] * x2 + m[14] * x3 + m[15] * x4,
    ];
  },

  translate(m: Mat4, tx: number, ty: number, tz: number): Mat4 {
    return m4.multiply(m, m4.translation(tx, ty, tz));
  },

  xRotate(m: Mat4, angleInRadians: number): Mat4 {
    return m4.multiply(m, m4.xRotation(angleInRadians));
  },

  yRotate(m: Mat4, angleInRadians: number): Mat4 {
    return m4.multiply(m, m4.yRotation(angleInRadians));
  },

  zRotate(m: Mat4, angleInRadians: number): Mat4 {
    return m4.multiply(m, m4.zRotation(angleInRadians));
  },

  scale(m: Mat4, sx: number, sy: number, sz: number): Mat4 {
    return m4.multiply(m, m4.scaling(sx, sy, sz));
  },

  projection(width: number, height: number, depth: number): Mat4 {
    return [
      1 / width,
      0,
      0,
      0,
      0,
      1 / height,
      0,
      0,
      0,
      0,
      -1 / depth,
      0,
      0,
      0,
      0,
      1,
    ];
  },
};
