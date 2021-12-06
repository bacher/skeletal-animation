import * as dat from 'dat.gui';
import { mat4, quat, vec3 } from 'gl-matrix';

import { m4 } from '../../utils/m4';
import { vertexShaderSource, fragmentShaderSource } from '../../shaders/basic5';
import {
  vertexShaderSource as vertBonesSource,
  fragmentShaderSource as fragBonesSource,
} from '../../shaders/bones';
import { addVec3, normalize3v, Vec2, Vec3, Vec4 } from '../../utils/vec';
import { Mat4 } from '../../utils/m4';
import cubeModel from '../../models/cube.json';
import { compareTwoVec, printVec } from '../../utils/debug';

// @ts-ignore
window.vec3 = vec3;
// @ts-ignore
window.mat4 = mat4;
// @ts-ignore
window.quat = quat;

const TEX_SIDE = 64;

type Weight = [number, number];
type WeightSet = Weight[];

export type Joint = {
  id: string;
  index: number;
  matrix: Mat4;
  pos: Vec3;
  offset: Vec3;
  jointLength: number;
  rot: Vec4;
  children: Joint[];
};

export type AnimationPart = {
  id: string;
  boneIndex: number;
  timeArray: number[];
  transforms: Mat4[];
};

export type ModelDataV2 = {
  vertices: Vec3[];
  weights: WeightSet[];
  uvs: Vec2[];
  normals: Vec3[];
  faces: {
    v: Vec3;
    n: Vec3;
    t: Vec3;
  }[];
  bones: Vec3[];
  matrix: Mat4 | undefined;
  skeleton: Joint[] | undefined;
  boneIndexes: string[];
  animation: {
    parts: AnimationPart[];
  };
};

const light = {
  x: -0.4,
  y: 1,
  z: 0,
};

const modelControl = {
  x: 0,
  y: 0,
  z: 200,
  rX: 0,
  rY: 0,
  rZ: 0,
  scale: 3,
};

const cameraControl = {
  x: 0,
  y: -400,
  z: 0,
  rX: 0.1,
  rY: 0,
  rZ: 0,
};

const scene = {
  rotate: true,
};

const bones = {
  lastBone: {
    x: 0,
    y: 0,
    z: 0,
    rX: 0,
    rY: 0,
    rZ: 0,
  },
  highlightBone: 16,
};

const skeleton = {
  a: {
    rotX: 0,
    rotY: 0,
    rotZ: 0,
  },
  b: {
    rotX: 0,
    rotY: 0,
    rotZ: 0,
  },
};

const animationControl = {
  frameIndex: 9,
};

export function init() {
  const gui = new dat.GUI({ name: 'My GUI' });

  const lightDir = gui.addFolder('Light');
  // lightDir.open();

  lightDir.add(light, 'x', -1, 1, 0.01);
  lightDir.add(light, 'y', -1, 1, 0.01);
  lightDir.add(light, 'z', -1, 1, 0.01);

  const modelDir = gui.addFolder('Model');
  // modelDir.open();
  modelDir.add(modelControl, 'x', -400, 400);
  modelDir.add(modelControl, 'y', -400, 400);
  modelDir.add(modelControl, 'z', -400, 400);
  modelDir.add(modelControl, 'rX', -1, 1, 0.01);
  modelDir.add(modelControl, 'rY', -1, 1, 0.01);
  modelDir.add(modelControl, 'rZ', -1, 1, 0.01);
  modelDir.add(modelControl, 'scale', 0, 10, 0.1);

  const cameraDir = gui.addFolder('Camera');
  cameraDir.open();
  cameraDir.add(cameraControl, 'x', -400, 400);
  cameraDir.add(cameraControl, 'y', -400, 400);
  cameraDir.add(cameraControl, 'z', -400, 400);
  cameraDir.add(cameraControl, 'rX', -1, 1, 0.01);
  cameraDir.add(cameraControl, 'rY', -1, 1, 0.01);
  cameraDir.add(cameraControl, 'rZ', -1, 1, 0.01);

  const bonesDir = gui.addFolder('Bones');
  bonesDir.open();
  bonesDir.add(bones.lastBone, 'x', -10, 10, 0.1);
  bonesDir.add(bones.lastBone, 'y', -10, 10, 0.1);
  bonesDir.add(bones.lastBone, 'z', -10, 10, 0.1);
  bonesDir.add(bones.lastBone, 'rX', -1, 1, 0.01);
  bonesDir.add(bones.lastBone, 'rY', -1, 1, 0.01);
  bonesDir.add(bones.lastBone, 'rZ', -1, 1, 0.01);

  bonesDir.add(bones, 'highlightBone', 0, 18, 1); // .options(times(18));

  const sceneDir = gui.addFolder('Scene');
  sceneDir.open();
  sceneDir.add(scene, 'rotate');

  const skeletonDir = gui.addFolder('Skeleton');
  skeletonDir.open();
  skeletonDir.add(skeleton.a, 'rotX', -1, 1, 0.01);
  skeletonDir.add(skeleton.a, 'rotY', -1, 1, 0.01);
  skeletonDir.add(skeleton.a, 'rotZ', -1, 1, 0.01);
  skeletonDir.add(skeleton.b, 'rotX', -1, 1, 0.01);
  skeletonDir.add(skeleton.b, 'rotY', -1, 1, 0.01);
  skeletonDir.add(skeleton.b, 'rotZ', -1, 1, 0.01);

  const animationDir = gui.addFolder('Animation');
  animationDir.open();
  animationDir.add(animationControl, 'frameIndex', 0, 9, 1);
}

function createShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
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
  fragmentShader: WebGLShader,
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

function applyBones(
  bones: Joint[],
  animationParts: AnimationPart[],
  buffers: [Float32Array, Float32Array],
  rot = quat.create(),
  mat = mat4.create(),
  parentPos: Vec3 = [0, 0, 0],
) {
  const [posBuffer, rotBuffer] = buffers;

  for (const bone of bones) {
    let boneMat: mat4;
    let boneQuat: quat;

    const anim = animationParts.find((part) => part.boneIndex === bone.index);

    if (anim) {
      boneMat = mat4.fromValues(
        ...(anim.transforms[animationControl.frameIndex] as Mat4),
      );
    } else {
      boneMat = mat4.fromValues(...bone.matrix);
    }

    const resMat = mat4.mul(mat4.create(), mat, boneMat);

    if (anim) {
      const initMat = mat4.fromValues(...(bone.matrix as Mat4));
      const animMat = boneMat;

      // Work
      const aMat = mat4.invert(mat4.create(), initMat);
      const finMat = mat4.mul(mat4.create(), animMat, aMat);
      boneQuat = mat4.getRotation(quat.create(), finMat);

      // DEBUG
      /*const initV = vec3.fromValues(10, 20, 30);

      const v0 = vec3.transformMat4(vec3.create(), initV, animMat);

      const v1 = vec3.transformMat4(vec3.create(), initV, initMat);
      vec3.transformMat4(v1, v1, finMat);

      const v2 = vec3.transformMat4(vec3.create(), initV, initMat);
      vec3.transformQuat(v2, v2, boneQuat);

      console.log(v0, v1, v2);
      console.log('compare 1');
      compareTwoVec(v0, v1);
      console.log('compare 2');
      compareTwoVec(v0, v2);
      debugger;*/

      // -- or --
      // const aMat = mat4.invert(mat4.create(), animMat);
      // const finMat = mat4.mul(mat4.create(), aMat, initMat);
      // boneQuat = mat4.getRotation(quat.create(), finMat);

      // ???
      // quat.invert(boneQuat, boneQuat);
      // -- or -- (work)
      // const initRot = mat4.getRotation(quat.create(), initMat);
      // const animRot = mat4.getRotation(quat.create(), animMat);
      // const initInvertRot = quat.invert(quat.create(), initRot);
      // boneQuat = quat.mul(quat.create(), animRot, initInvertRot);
    } else {
      boneQuat = quat.create();
    }

    const resRot = quat.mul(quat.create(), rot, boneQuat);

    // const jointPos = bone.offset;
    // -- or --
    // const jointPos = rot.rotateVector(bone.offset);
    // -- or --
    const jointPos = vec3.transformQuat(vec3.create(), bone.offset, rot);
    // -- or --
    // boneQuat = new Quaternion(bone.rot[3], bone.rot.slice(0, 3));
    // const jointPos = rot.rotateVector([bone.jointLength, 0, 0]);

    // const newPos = addVec3(parentPos, jointPos);
    // -- or --
    const newPosV = vec3.create();
    vec3.transformMat4(newPosV, newPosV, resMat);
    const newPos = Array.from(newPosV) as Vec3;

    posBuffer.set(newPos, bone.index * 3);

    // work
    // const bb = quat.invert(quat.create(), boneQuat);
    // -- or --
    // const resRot = quat.mul(quat.create(), boneQuat, rot);

    // rotBuffer.set([resRot.x, resRot.y, resRot.z, resRot.w], bone.index * 4);
    rotBuffer.set(Array.from(resRot), bone.index * 4);

    if (bone.children) {
      applyBones(
        bone.children,
        animationParts,
        buffers,
        resRot,
        resMat,
        newPos,
      );
    }
  }
}

function generateBonesBuffers(model: ModelDataV2) {
  const boneNumberData = new Uint32Array(model.bones.length);

  for (let i = 0; i < model.bones.length; i++) {
    boneNumberData.set([i], i);
  }

  return boneNumberData;
}

function generateBonesPositionBuffers(model: ModelDataV2) {
  const bonesOffsetsData = new Float32Array(model.bones.length * 3);
  const bonesOrientationData = new Float32Array(model.bones.length * 4);

  applyBones(model.skeleton!, model.animation.parts, [
    bonesOffsetsData,
    bonesOrientationData,
  ]);

  return {
    bonesOffsetsData,
    bonesOrientationData,
  };
}

function createGeometryWithNormalsBuffer(
  gl: WebGL2RenderingContext,
  model: ModelDataV2,
) {
  //const positions = new Float32Array(model.faces.length * 3);

  const coordsIndex = new Uint32Array(model.faces.length * 3);
  const normalsIndex = new Float32Array(model.faces.length * 3 * 2);
  // const coordsMatSize = model.vertices.length * 3;
  const coordsMatSize = TEX_SIDE ** 2;
  const coords = new Float32Array(coordsMatSize * 3);
  const normals = new Float32Array(model.normals.length * 3);
  const boneBinds = new Uint32Array(model.faces.length * 3 * 4);
  const boneWeights = new Float32Array(model.faces.length * 3 * 4);

  for (let faceIndex = 0; faceIndex < model.faces.length; faceIndex++) {
    const face = model.faces[faceIndex];
    coordsIndex.set(face.v, faceIndex * 3);

    for (let i = 0; i < face.v.length; i++) {
      const vertIndex = face.v[i];

      const weightPairs = model.weights[vertIndex];

      for (let pairIndex = 0; pairIndex < 4; pairIndex++) {
        const [boneIndex, boneWeight] = weightPairs[pairIndex] ?? [0, 0];
        boneBinds.set([boneIndex], faceIndex * 3 * 4 + i * 4 + pairIndex);
        boneWeights.set([boneWeight], faceIndex * 3 * 4 + i * 4 + pairIndex);
      }
    }

    let i = 0;
    for (const normalIndex of face.n) {
      const y = Math.floor(normalIndex / TEX_SIDE);
      const x = normalIndex % TEX_SIDE;

      normalsIndex.set([x / TEX_SIDE, y / TEX_SIDE], faceIndex * 6 + i * 2);
      i++;
    }
  }

  let posOffset = 0;
  for (const vertex of model.vertices) {
    coords.set(vertex, posOffset);
    posOffset += 3;
  }

  posOffset = 0;
  for (const normal of model.normals) {
    normals.set(normal, posOffset);
    posOffset += 3;
  }

  const geometryBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, coordsIndex, gl.STATIC_DRAW);

  const normalsBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normalsIndex, gl.STATIC_DRAW);

  const boneBindsBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, boneBindsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, boneBinds, gl.STATIC_DRAW);

  const boneWeightsBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, boneWeightsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, boneWeights, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const coordsTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, coordsTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB32F,
    TEX_SIDE,
    TEX_SIDE,
    0,
    gl.RGB,
    gl.FLOAT,
    coords,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // const normalsTexture = gl.createTexture();
  // gl.bindTexture(gl.TEXTURE_2D, normalsTexture);
  // gl.texImage2D(
  //   gl.TEXTURE_2D,
  //   0,
  //   gl.RGB,
  //   128,
  //   128,
  //   0,
  //   gl.RGB32F,
  //   gl.FLOAT,
  //   normals,
  // );
  //
  // gl.bindTexture(gl.TEXTURE_2D, null);

  const cubeMesh = new Float32Array(cubeModel.faces.length * 3 * 3);

  for (let faceI = 0; faceI < cubeModel.faces.length; faceI++) {
    const face = cubeModel.faces[faceI];

    for (let i = 0; i < face.v.length; i++) {
      const vertIndex = face.v[i];
      const pos = cubeModel.vertices[vertIndex];

      cubeMesh.set(pos, faceI * 3 * 3 + i * 3);
    }
  }

  const cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubeMesh, gl.STATIC_DRAW);

  const boneNumberData = generateBonesBuffers(model);
  const { bonesOffsetsData } = generateBonesPositionBuffers(model);

  const bonesNumberBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bonesNumberBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, boneNumberData, gl.STATIC_DRAW);

  const bonesOffsetBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bonesOffsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, bonesOffsetsData, gl.DYNAMIC_DRAW);

  return {
    geometryBuffer,
    normalsBuffer,
    coordsTexture,
    // normalsTexture,
    boneBindsBuffer,
    boneWeightsBuffer,
    cubeBuffer,
    bonesOffsetBuffer,
    bonesNumberBuffer,
  };
}

function initProgram(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vert);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, frag);
  return createProgram(gl, vertexShader, fragmentShader);
}

export function initGL(gl: WebGL2RenderingContext, model: ModelDataV2) {
  const program = initProgram(gl, vertexShaderSource, fragmentShaderSource);
  const programBones = initProgram(gl, vertBonesSource, fragBonesSource);

  const programs = {
    main: {
      program,
      attributes: {
        position: gl.getAttribLocation(program, 'a_coords_index'),
        normal: gl.getAttribLocation(program, 'a_normal_index'),
        boneBind: gl.getAttribLocation(program, 'a_bone_bind'),
        weights: gl.getAttribLocation(program, 'a_weights'),
      },
      uniforms: {
        projection: gl.getUniformLocation(program, 'u_projection'),
        camera: gl.getUniformLocation(program, 'u_camera'),
        model: gl.getUniformLocation(program, 'u_model'),
        light: gl.getUniformLocation(program, 'u_lightDirection'),
        bonesPos: gl.getUniformLocation(program, 'u_bones_pos'),
        bonesPosCurrent: gl.getUniformLocation(program, 'u_bones_pos_current'),
        bonesRotation: gl.getUniformLocation(program, 'u_bones_rotation'),
        highlightBone: gl.getUniformLocation(program, 'u_high_bone'),
      },
      vao: null as WebGLVertexArrayObject | null,
    },
    bonePro: {
      program: programBones,
      attributes: {
        pos: gl.getAttribLocation(programBones, 'a_pos'),
        offset: gl.getAttribLocation(programBones, 'a_offset'),
        boneNumber: gl.getAttribLocation(programBones, 'a_bone_number'),
      },
      uniforms: {
        projection: gl.getUniformLocation(programBones, 'u_projection'),
        camera: gl.getUniformLocation(programBones, 'u_camera'),
        model: gl.getUniformLocation(programBones, 'u_model'),
        highBone: gl.getUniformLocation(programBones, 'u_high_bone'),
      },
      vao: null as WebGLVertexArrayObject | null,
    },
  };

  const {
    geometryBuffer,
    normalsBuffer,
    coordsTexture,
    boneBindsBuffer,
    boneWeightsBuffer,
    cubeBuffer,
    bonesOffsetBuffer,
    bonesNumberBuffer,
  } = createGeometryWithNormalsBuffer(gl, model);

  //
  programs.main.vao = gl.createVertexArray();
  gl.bindVertexArray(programs.main.vao);

  gl.enableVertexAttribArray(programs.main.attributes.position);
  gl.enableVertexAttribArray(programs.main.attributes.boneBind);
  gl.enableVertexAttribArray(programs.main.attributes.weights);
  // gl.enableVertexAttribArray(normalAttributeLocation);

  gl.bindTexture(gl.TEXTURE_2D, coordsTexture);

  gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
  gl.vertexAttribIPointer(
    programs.main.attributes.position,
    1,
    /* type */ gl.UNSIGNED_INT,
    /* stride */ 0,
    /* offset */ 0,
  );

  // gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
  // gl.vertexAttribPointer(
  //   normalAttributeLocation,
  //   2,
  //   /* type */ gl.FLOAT,
  //   /* normalize */ false,
  //   /* stride */ 0,
  //   /* offset */ 0,
  // );

  gl.bindBuffer(gl.ARRAY_BUFFER, boneBindsBuffer);
  gl.vertexAttribIPointer(
    programs.main.attributes.boneBind,
    4,
    /* type */ gl.UNSIGNED_INT,
    /* stride */ 0,
    /* offset */ 0,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, boneWeightsBuffer);
  gl.vertexAttribPointer(
    programs.main.attributes.weights,
    4,
    /* type */ gl.FLOAT,
    false,
    /* stride */ 0,
    /* offset */ 0,
  );

  // Bones start

  programs.bonePro.vao = gl.createVertexArray();
  gl.bindVertexArray(programs.bonePro.vao);

  gl.enableVertexAttribArray(programs.bonePro.attributes.pos);
  gl.enableVertexAttribArray(programs.bonePro.attributes.offset);
  gl.enableVertexAttribArray(programs.bonePro.attributes.boneNumber);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.vertexAttribPointer(
    programs.bonePro.attributes.pos,
    3,
    /* type */ gl.FLOAT,
    false,
    /* stride */ 0,
    /* offset */ 0,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, bonesOffsetBuffer);
  gl.vertexAttribPointer(
    programs.bonePro.attributes.offset,
    3,
    /* type */ gl.FLOAT,
    false,
    /* stride */ 0,
    /* offset */ 0,
  );
  gl.vertexAttribDivisor(programs.bonePro.attributes.offset, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, bonesNumberBuffer);
  gl.vertexAttribIPointer(
    programs.bonePro.attributes.boneNumber,
    1,
    /* type */ gl.UNSIGNED_INT,
    /* stride */ 0,
    /* offset */ 0,
  );
  gl.vertexAttribDivisor(programs.bonePro.attributes.boneNumber, 1);

  // Bones end

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0.9, 0.9, 0.9, 1);

  function tick(time: number) {
    draw(gl, programs, model, bonesOffsetBuffer, time);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  console.log('Finish');
}

function draw(
  gl: WebGL2RenderingContext,
  {
    main,
    bonePro,
  }: Record<
    string,
    {
      program: any;
      attributes: Record<string, any>;
      uniforms: Record<string, WebGLUniformLocation | null>;
      vao: WebGLVertexArrayObject | null;
    }
  >,
  model: ModelDataV2,
  bonesOffsetBuffer: WebGLBuffer | null,
  time: number,
) {
  const projectionMatrix = m4.projection(
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    1000,
  );

  let modelMatrix = m4.identify();
  modelMatrix = m4.translate(
    modelMatrix,
    modelControl.x,
    modelControl.y,
    modelControl.z,
  );

  let modelRotationMatrix = m4.identify();
  modelRotationMatrix = m4.xRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rX,
  );
  modelRotationMatrix = m4.yRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rY,
  );
  modelRotationMatrix = m4.zRotate(
    modelRotationMatrix,
    Math.PI * modelControl.rZ,
  );

  modelMatrix = m4.multiply(modelMatrix, modelRotationMatrix);

  if (model.matrix) {
    modelMatrix = m4.multiply(modelMatrix, model.matrix);
  }

  modelMatrix = m4.scale(
    modelMatrix,
    modelControl.scale * 40,
    modelControl.scale * 40,
    modelControl.scale * 40,
  );

  let cameraMatrix = m4.identify();
  cameraMatrix = m4.xRotate(cameraMatrix, -0.5 * Math.PI);
  cameraMatrix = m4.translate(
    cameraMatrix,
    cameraControl.x,
    cameraControl.y,
    cameraControl.z,
  );
  cameraMatrix = m4.xRotate(cameraMatrix, cameraControl.rX * Math.PI);
  cameraMatrix = m4.yRotate(cameraMatrix, cameraControl.rY * Math.PI);
  cameraMatrix = m4.zRotate(
    cameraMatrix,
    cameraControl.rZ * Math.PI +
      -Math.PI / 3 +
      (scene.rotate ? -time * 0.001 : 0),
  );

  gl.useProgram(main.program);
  gl.bindVertexArray(main.vao);

  gl.uniformMatrix4fv(main.uniforms.projection, false, projectionMatrix);
  gl.uniformMatrix4fv(main.uniforms.camera, false, cameraMatrix);
  gl.uniformMatrix4fv(main.uniforms.model, false, modelMatrix);

  const bonesBuffer = new Float32Array(model.bones.length * 3);
  for (let i = 0; i < model.bones.length; i++) {
    bonesBuffer.set(model.bones[i], i * 3);
  }
  gl.uniform3fv(main.uniforms.bonesPos, bonesBuffer);

  const { bonesOffsetsData, bonesOrientationData } =
    generateBonesPositionBuffers(model);

  gl.uniform3fv(main.uniforms.bonesPosCurrent, bonesOffsetsData);

  // const bonesRotationBuffer = new Float32Array(model.bones.length * 4);
  // for (let i = 0; i < model.bones.length; i++) {
  //   let quater = [0, 0, 0, 1];
  //
  //   if (i === bones.highlightBone) {
  //     const halfAngle = (bones.lastBone.rY * Math.PI) / 2;
  //     quater = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];
  //   }
  //   bonesRotationBuffer.set(quater, i * 4);
  // }
  gl.uniform4fv(main.uniforms.bonesRotation, bonesOrientationData);

  gl.uniform1ui(main.uniforms.highlightBone, bones.highlightBone);

  const lightVector = m4.multiplyVector(modelRotationMatrix, [
    light.x,
    light.y,
    light.z,
    0,
  ]);

  gl.uniform3fv(main.uniforms.light, normalize3v(lightVector));

  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // gl.drawElements(gl.TRIANGLES, model.faces.length * 3, gl.UNSIGNED_INT, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.drawArrays(
    gl.TRIANGLES,
    /* offset */ 0,
    /* count */ model.faces.length * 3,
  );

  // Bones

  gl.useProgram(bonePro.program);
  gl.bindVertexArray(bonePro.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, bonesOffsetBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    generateBonesPositionBuffers(model).bonesOffsetsData,
    gl.DYNAMIC_DRAW,
  );

  gl.uniformMatrix4fv(bonePro.uniforms.projection, false, projectionMatrix);
  gl.uniformMatrix4fv(bonePro.uniforms.camera, false, cameraMatrix);
  gl.uniformMatrix4fv(bonePro.uniforms.model, false, modelMatrix);
  gl.uniform1ui(bonePro.uniforms.highBone, bones.highlightBone);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.drawArraysInstanced(
    gl.TRIANGLES,
    0,
    cubeModel.faces.length * 3,
    model.bones.length,
  );
}
