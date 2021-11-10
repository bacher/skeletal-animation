import * as dat from 'dat.gui';

import type { ModelData } from '../../../objToJson/src';
import { m4 } from '../../utils/m4';
import { vertexShaderSource, fragmentShaderSource } from '../../shaders/basic';
import { normalize3v } from '../../utils/vec';

const light = {
  x: 0,
  y: 1,
  z: 0,
};

const modelControl = {
  x: 0,
  y: 0,
  z: 0,
  rX: 0.1,
  rY: 0.6,
  rZ: 0.1,
  scale: 3,
};

const scene = {
  rotate: true,
};

export function init() {
  const gui = new dat.GUI({ name: 'My GUI' });

  const lightDir = gui.addFolder('Light');
  lightDir.open();

  lightDir.add(light, 'x', -1, 1, 0.1);
  lightDir.add(light, 'y', -1, 1, 0.1);
  lightDir.add(light, 'z', -1, 1, 0.1);

  const modelDir = gui.addFolder('Model');
  modelDir.open();
  modelDir.add(modelControl, 'x', -400, 400);
  modelDir.add(modelControl, 'y', -400, 400);
  modelDir.add(modelControl, 'z', -400, 400);
  modelDir.add(modelControl, 'rX', -1, 1, 0.1);
  modelDir.add(modelControl, 'rY', -1, 1, 0.1);
  modelDir.add(modelControl, 'rZ', -1, 1, 0.1);
  modelDir.add(modelControl, 'scale', 0, 10);

  const sceneDir = gui.addFolder('Scene');
  sceneDir.open();
  sceneDir.add(scene, 'rotate');
}

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

function createGeometryBuffer(gl: WebGL2RenderingContext, model: ModelData) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
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
}

function createGeometryWithNormalsBuffer(
  gl: WebGL2RenderingContext,
  model: ModelData
) {
  const positions = new Float32Array(model.faces.length * 3 * 3);
  const normals = new Float32Array(model.faces.length * 3 * 3);

  let posOffset = 0;
  for (const face of model.faces) {
    let index = 0;
    for (const vertexIndex of face.vertices) {
      positions.set(model.vertices[vertexIndex], posOffset + index * 3);
      index++;
    }

    index = 0;
    for (const normalIndex of face.normals) {
      normals.set(model.normals[normalIndex], posOffset + index * 3);
      index++;
    }

    posOffset += 9;
  }

  const geometryBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const normalsBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    geometryBuffer,
    normalsBuffer,
  };
}

export function initGL(gl: WebGL2RenderingContext, model: ModelData) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  const program = createProgram(gl, vertexShader, fragmentShader);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  const normalAttributeLocation = gl.getAttribLocation(program, 'a_normal');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const lightLocation = gl.getUniformLocation(program, 'u_lightDirection');

  // createGeometryBuffer(gl, model);
  const { geometryBuffer, normalsBuffer } = createGeometryWithNormalsBuffer(
    gl,
    model
  );

  //
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.enableVertexAttribArray(normalAttributeLocation);

  const size = 3; // 3 components per iteration

  gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
  gl.vertexAttribPointer(
    positionAttributeLocation,
    size,
    /* type */ gl.FLOAT,
    /* normalize */ false,
    /* stride */ 0,
    /* offset */ 0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
  gl.vertexAttribPointer(
    normalAttributeLocation,
    size,
    /* type */ gl.FLOAT,
    /* normalize */ false,
    /* stride */ 0,
    /* offset */ 0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0.9, 0.9, 0.9, 1);

  gl.useProgram(program);

  gl.bindVertexArray(vao);

  function tick(time: number) {
    draw(
      gl,
      {
        projection: projectionLocation,
        model: modelLocation,
        light: lightLocation,
      },
      model,
      size,
      time
    );
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  console.log('Finish');
}

function draw(
  gl: WebGL2RenderingContext,
  locations: {
    projection: WebGLUniformLocation | null;
    model: WebGLUniformLocation | null;
    light: WebGLUniformLocation | null;
  },
  model: ModelData,
  size: number,
  time: number
) {
  const projectionMatrix = m4.projection(
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    400
  );

  let modelMatrix = m4.identify();
  modelMatrix = m4.translate(
    modelMatrix,
    modelControl.x,
    modelControl.y,
    modelControl.z
  );
  let modelRotationMatrix = m4.identify();
  modelRotationMatrix = m4.xRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rX
  );
  modelRotationMatrix = m4.yRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rY
  );
  modelRotationMatrix = m4.yRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rZ * (scene.rotate ? -time * 0.002 : 1)
  );

  modelMatrix = m4.multiply(modelMatrix, modelRotationMatrix);

  modelMatrix = m4.scale(
    modelMatrix,
    modelControl.scale * 40,
    modelControl.scale * 40,
    modelControl.scale * 40
  );

  // Set the matrix.
  gl.uniformMatrix4fv(locations.projection, false, projectionMatrix);
  gl.uniformMatrix4fv(locations.model, false, modelMatrix);

  const light3v = normalize3v([light.x, light.y, light.z]);
  // console.log('light:', light3v);
  // const light = normalize3v([0, -0.5, 0]);

  gl.uniform3fv(locations.light, light3v);

  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.drawArrays(
    gl.TRIANGLES,
    /* offset */ 0,
    /* count */ model.faces.length * size
  );
}
