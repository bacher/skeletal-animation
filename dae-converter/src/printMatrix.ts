import { chunk } from 'lodash';
import { mat4 } from 'gl-matrix';
import { printMat } from './utils';
import { Mat4 } from '../../src/utils/m4';

const text = `1 -9.59757e-6 -7.42193e-6 -2.27374e-13 9.60456e-6 0.2524654 0.9676059 0.8693838 -7.41288e-6 -0.967606 0.2524654 0 0 0 0 1`;

const matrices = chunk(text.split(/\s+/).map(parseFloat), 16);

for (const matrix of matrices) {
  const m = mat4.fromValues(...(matrix as Mat4));
  console.log(printMat(m));
}
