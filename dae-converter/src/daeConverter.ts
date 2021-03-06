import path from 'path';
import fs from 'fs/promises';
import { parse as xmlParse } from 'fast-xml-parser';
import { zip, chunk } from 'lodash';

import { mat4, vec3, quat } from 'gl-matrix';

import {
  Vec2,
  Vec3,
  Vec4,
  Number16,
  subtractVec3,
  crossProductVec3,
  dotProductVec3,
  printMat,
  compareTwoVec,
  rotationBetween,
} from './utils';
import { Mat4 } from '../../src/utils/m4';

type TextNode = { _text: string };

type ColladaGeometry = {
  mesh: {
    source: {
      float_array: TextNode;
      technique_common: any;
    }[];
    vertices: any;
    triangles: {
      input: string[];
      p: TextNode;
    };
  };
};

type Geometry = {
  vertices: Vec3[];
  normals: Vec3[];
  uvs: Vec2[];
  faces: {
    v: number[];
    n: number[];
    t: number[];
  }[];
};

function parseGeometry(data: ColladaGeometry): Geometry {
  const { source, triangles } = data.mesh;

  const vertices = chunk(
    source[0].float_array._text.split(/\s/).map(parseFloat),
    3,
  ) as Vec3[];
  const normals = chunk(
    source[1].float_array._text.split(/\s/).map(parseFloat),
    3,
  ) as Vec3[];
  const uvs = chunk(
    source[2].float_array._text.split(/\s/).map(parseFloat),
    2,
  ) as Vec2[];

  const faces = triangles.p._text.split(/\s/).map(Number);

  const trianglesCount = faces.length / 9;

  const result: Geometry = {
    vertices,
    normals,
    uvs,
    faces: [],
  };

  for (let i = 0; i < trianglesCount; i++) {
    const offset = i * 9;

    const p1 = faces[offset];
    const p2 = faces[offset + 3];
    const p3 = faces[offset + 6];
    const n1 = faces[offset + 1];
    const n2 = faces[offset + 4];
    const n3 = faces[offset + 7];
    const t1 = faces[offset + 2];
    const t2 = faces[offset + 5];
    const t3 = faces[offset + 8];

    result.faces.push({
      v: [p1, p2, p3],
      n: [n1, n2, n3],
      t: [t1, t2, t3],
    });
  }

  return result;
}

type ColladaController = {
  controller: {
    skin: {
      bind_shape_matrix: TextNode;
      source: any[];
      joints: any;
      vertex_weights: { vcount: TextNode; v: TextNode };
    };
  };
};

type ControllerData = {
  controller: {
    bindMatrix: Mat4;
  };
  bones: Vec3[];
  weights: [number, number][][];
};

function parseController({ controller }: ColladaController): ControllerData {
  // console.log(controller.skin);

  const [jointsNode, joinsNode, weightsNode] = controller.skin.source;
  const { vcount, v } = controller.skin.vertex_weights;

  const bindMatrix = mat4.fromValues(
    ...(controller.skin.bind_shape_matrix._text
      .split(/\s+/)
      .map(parseFloat) as Mat4),
  );
  mat4.transpose(bindMatrix, bindMatrix);

  const transformData: number[] = joinsNode.float_array._text
    .split(/\s+/)
    .map(parseFloat);

  const transformMatricesSource = chunk(transformData, 16);

  const bones: Vec3[] = [];

  // const accTransformation = mat4.identity(mat4.create());

  for (const matrix of transformMatricesSource) {
    const mat = mat4.fromValues(...(matrix as Number16));
    mat4.transpose(mat, mat);
    mat4.invert(mat, mat);

    const pos = vec3.create();
    vec3.transformMat4(pos, pos, mat);

    bones.push(Array.from(pos) as Vec3);
  }

  const weights: Vec2[][] = [];

  const weightVariants = weightsNode.float_array._text
    .split(/\s+/)
    .map(parseFloat);

  const vCount = vcount._text.split(/\s+/).map(Number);
  const vs = v._text.split(/\s+/).map(Number);

  let offset = 0;
  for (let vertexIndex = 0; vertexIndex < vCount.length; vertexIndex++) {
    const cnt = vCount[vertexIndex];

    let vertexWeights: [number, number][] = [];

    for (let i = 0; i < cnt; i++) {
      const boneIndex = vs[offset];
      const weight = weightVariants[vs[offset + 1]];

      vertexWeights.push([boneIndex, weight]);

      offset += 2;
    }

    vertexWeights.sort(([, weight1], [, weight2]) => weight2 - weight1);

    if (vertexWeights.length > 4) {
      vertexWeights = vertexWeights.slice(0, 4);

      const weightSum = vertexWeights.reduce(
        (acc, [, weight]) => acc + weight,
        0,
      );

      for (const weightedBone of vertexWeights) {
        weightedBone[1] /= weightSum;
      }
    }

    weights.push(vertexWeights);
  }

  return {
    controller: {
      bindMatrix: Array.from(bindMatrix) as Mat4,
    },
    bones,
    weights,
  };
}

type SceneNode = {
  _id: string;
  _sid: string;
  _name: string;
  _type: 'NODE' | 'JOINT';
  matrix: TextNode;
  node?: SceneNode[];
};

type ColladaVisualScenes = {
  visual_scene: {
    node?: SceneNode[];
  };
};

type Joint = {
  id: string;
  index: number;
  matrix: number[];
  pos: number[];
  offset: number[];
  rot: number[];
  children: Joint[];
};

function extractBones(
  nodes: SceneNode[],
  bonesIndexes: Record<string, number>,
  bonesPositions: Vec3[],
  parentPos: Vec3,
  parentMat = mat4.create(),
): Joint[] {
  return nodes
    .filter(({ _type }) => _type === 'JOINT')
    .map((node) => {
      const id = node._sid;

      const boneMat = mat4.fromValues(
        ...(node.matrix._text.split(/\s+/).map(parseFloat) as Number16),
      );
      mat4.transpose(boneMat, boneMat);

      const mat = mat4.multiply(mat4.create(), parentMat, boneMat);

      const pos1 = vec3.fromValues(1, 0, 0);
      // const pos1 = vec3.fromValues(...parentPos);
      const pos2 = vec3.create();
      vec3.transformMat4(pos2, pos1, mat);
      vec3.normalize(pos2, pos2);

      const q = quat.rotationTo(quat.create(), pos1, pos2);

      const index = bonesIndexes[id];

      if (isNaN(index)) {
        throw new Error();
      }

      let children: Joint[] = [];

      // const pos: Vec3 = bonesPositions[index];
      const posVec = vec3.fromValues(0, 0, 0);
      const pos = Array.from(vec3.transformMat4(posVec, posVec, mat)) as Vec3;

      if (node.node) {
        children = extractBones(
          node.node.filter(({ _type }) => _type === 'JOINT'),
          bonesIndexes,
          bonesPositions,
          pos,
          mat,
        );
      }

      const offset = subtractVec3(pos, parentPos);
      const jointLength = vec3.len(offset);

      // const b = vec3.fromValues(jointLength, 0, 0);
      // vec3.transformQuat(b, b, q);
      // compareTwoVec3(offset, b);

      return {
        id,
        matrix: Array.from(boneMat),
        index,
        pos,
        offset,
        jointLength,
        rot: Array.from(q),
        children,
      };
    });
}

type SceneData = {
  matrix: number[] | undefined;
  skeleton: Joint[] | undefined;
  boneIndexes: string[];
};

function parseScene(
  { visual_scene }: ColladaVisualScenes,
  { controller }: ColladaController,
  bonesPositions: Vec3[],
): SceneData {
  const bones: string[] =
    controller.skin.source[0].Name_array._text.split(/\s+/);
  const bonesIndexes: Record<string, number> = {};

  for (let i = 0; i < bones.length; i++) {
    bonesIndexes[bones[i]] = i;
  }

  let matrix: number[] | undefined;
  let skeleton: Joint[] | undefined;

  if (visual_scene.node) {
    if (visual_scene.node.length !== 1) {
      throw new Error();
    }

    const node = visual_scene.node[0];

    matrix = node?.node
      ?.find(({ _type }) => _type === 'NODE')
      ?.matrix?._text.split(/\s+/)
      .map(parseFloat);

    skeleton = node.node
      ? extractBones(node.node, bonesIndexes, bonesPositions, [0, 0, 0])
      : undefined;
  } else {
    console.warn('Skeleton without relations!');

    const matrices: string[] =
      controller.skin.source[1].float_array._text.split(/\s+/);
    const boneMatrices = chunk(matrices, 16);
    const list = zip(boneMatrices, bones).map(([mat, name]) => ({
      _id: '',
      _sid: name!,
      _name: '',
      _type: 'JOINT' as 'JOINT',
      matrix: {
        _text: mat!.join(' '),
      },
    }));

    skeleton = extractBones(list, bonesIndexes, bonesPositions, [0, 0, 0]);
  }

  return {
    matrix,
    skeleton,
    boneIndexes: bones,
  };
}

type ColladaAnimationData = {
  animation: {
    _id: string;
    _name: string;
    animation: ColladaAnimation[];
  }[];
};

type ColladaAnimation = {
  _id: string;
  _name: string;
  source: {
    _id: string;
    float_array: TextNode;
    technique_common: any;
  }[];
  sampler: any;
  channel: any;
};

type AnimationPart = {
  id: string;
  boneIndex: number;
  timeArray: number[];
  transforms: Number16[];
};

type AnimationData = {
  animation: {
    parts: AnimationPart[];
  };
};

function parseAnimations(
  { animation }: ColladaAnimationData,
  boneIndexes: string[],
): AnimationData | undefined {
  if (!animation || animation.length === 0) {
    return undefined;
  }

  if (animation.length > 1) {
    throw new Error("Several animations doesn't support yet");
  }

  const sortedBones = boneIndexes
    .map((name, index) => ({ name, index }))
    .sort((a, b) => b.name.length - a.name.length);

  const mainAnim = animation[0];

  const parts = mainAnim.animation;

  const animations: AnimationPart[] = parts.map((part) => {
    const { _id, source } = part;

    const bone = sortedBones.find(({ name }) => _id.includes(name));

    if (!bone) {
      // console.log('not found', _id);
      // return undefined;
      throw new Error('Joint is not found');
    }

    const input = source.find(({ _id }) => _id.includes('input'));
    const output = source.find(({ _id }) => _id.includes('output'));
    // const interpolation = source.find(({ _id }) => _id.includes('interpolation'));

    if (!input || !output) {
      throw new Error('Invalid animation');
    }

    const timeArray = input.float_array._text.split(/\s+/).map(parseFloat);

    // console.log(bone.name);
    const matrices = chunk(
      output.float_array._text.split(/\s+/).map(parseFloat),
      16,
    ).map((arr) => {
      const mat = mat4.fromValues(...(arr as Number16));
      mat4.transpose(mat, mat);
      // console.log(printMat(mat));
      return Array.from(mat) as Number16;
    });

    if (timeArray.length !== matrices.length) {
      throw new Error('Invalid animation steps');
    }

    return {
      id: part._id,
      boneIndex: bone.index,
      timeArray,
      transforms: matrices,
    };
  });

  return {
    animation: {
      parts: animations,
    },
  };
}

export async function convert({ files }: { files: string[] }) {
  for (const filePath of files) {
    const xmlData = await fs.readFile(filePath, 'utf-8');

    const parsedCollada = xmlParse(xmlData, {
      ignoreAttributes: false,
      attributeNamePrefix: '_',
      allowBooleanAttributes: true,
      alwaysCreateTextNode: true,
      textNodeName: '_text',
      arrayMode: (name, parent) =>
        ['node', 'source', 'animation'].includes(name.toLowerCase()),
    });

    const {
      library_cameras,
      library_lights,
      library_effects,
      library_materials,
      library_geometries: { geometry },
      library_controllers,
      library_visual_scenes,
      library_animations,
      scene,
    } = parsedCollada.COLLADA;

    const g = parseGeometry(geometry);
    let c;
    let s;
    let a;

    if (library_controllers) {
      c = parseController(library_controllers);
      s = parseScene(library_visual_scenes, library_controllers, c.bones);
    }

    if (library_animations && s) {
      a = parseAnimations(library_animations, s.boneIndexes);
    }

    const dir = path.dirname(filePath);
    const extName = path.extname(filePath);
    const fileName = path.basename(filePath, extName);

    const outFile = path.join(dir, `${fileName}.json`);

    await fs.writeFile(outFile, JSON.stringify({ ...g, ...c, ...s, ...a }));

    console.info(`Converted json saved: ${outFile}`);
  }
}
