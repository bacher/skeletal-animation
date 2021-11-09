import type { ModelData } from '../../../objToJson/src';
import { m4 } from '../../utils/m4';

function createShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error();
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error();
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();

  if (!program) {
    throw new Error();
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw new Error();
  }

  return program;
}

export function initGL(gl: WebGL2RenderingContext, model: ModelData) {
  const vertexShaderSource = `#version 300 es
uniform mat4 u_matrix;
in vec4 a_position;

void main() {
  // gl_Position = vec4(a_position[0]*0.1, a_position[1]*0.1, a_position[2]*0.1, a_position[3]);
  // gl_Position = a_position * vec4(0.3, 0.3, 0, 1);
  gl_Position = u_matrix * a_position;
}
`;

  const fragmentShaderSource = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
  outColor = vec4(1, 0, 0, 1);
}
`;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  const program = createProgram(gl, vertexShader, fragmentShader);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  const matrixLocation = gl.getUniformLocation(program, 'u_matrix');

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // const positions = [0, 0, 0, 0.5, 0.7, 0];

  const positions = new Float32Array(model.faces.length * 3 * 3);

  let posOffset = 0;
  for (const face of model.faces) {
    let index = 0;
    for (const vertexIndex of face.vertices) {
      positions.set(model.vertices[vertexIndex], posOffset + index * 3);
      index++;
    }

    posOffset += 9;
  }

  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  //
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.enableVertexAttribArray(positionAttributeLocation);

  const size = 3; // 2 components per iteration
  const type = gl.FLOAT; // the data is 32bit floats
  const normalize = false; // don't normalize the data
  const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  const offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(
    positionAttributeLocation,
    size,
    type,
    normalize,
    stride,
    offset
  );

  // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(vao);

  function tick(time: number) {
    draw(gl, matrixLocation, model, size, time);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  console.log('Finish');
}

function draw(
  gl: WebGL2RenderingContext,
  matrixLocation: WebGLUniformLocation | null,
  model: ModelData,
  size: number,
  time: number
) {
  // let matrix = m4.identify();

  let matrix = m4.projection(
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    400
  );
  matrix = m4.translate(matrix, 300, 200, 0);
  matrix = m4.xRotate(matrix, Math.PI * 1.1);
  matrix = m4.yRotate(matrix, Math.PI * 0.35 * (time * 0.005));
  // matrix = m4.zRotate(matrix, Math.PI * 0.1);
  matrix = m4.scale(matrix, 40, 40, 40);

  console.log('matrix:', matrix);

  // Set the matrix.
  gl.uniformMatrix4fv(matrixLocation, false, matrix);

  gl.drawArrays(
    gl.TRIANGLES,
    /* offset */ 0,
    /* count */ model.faces.length * size
  );
}
