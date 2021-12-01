import path from 'path';
import fs from 'fs/promises';
import { parse as xmlParse } from 'fast-xml-parser';
import chunk from 'lodash/chunk';

import { mat4, vec3 } from 'gl-matrix';

import {
  Vec2,
  Vec3,
  Number16,
  subtractVec3,
  crossProductVec3,
  dotProductVec3,
  printMat,
} from './utils';

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
      bind_shape_matrix: string;
      source: any[];
      joints: any;
      vertex_weights: { vcount: TextNode; v: TextNode };
    };
  };
};

type ControllerData = {
  bones: Vec3[];
  weights: [number, number][][];
};

function parseController({ controller }: ColladaController): ControllerData {
  // console.log(controller.skin);

  const [jointsNode, joinsNode, weightsNode] = controller.skin.source;
  const { vcount, v } = controller.skin.vertex_weights;

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
    node: SceneNode[];
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

      const matrix = node.matrix._text.split(/\s+/).map(parseFloat) as Number16;

      const mat = mat4.fromValues(...matrix);
      // console.log();
      // console.log(' '.repeat(68), printMat(mat));

      mat4.transpose(mat, mat);
      mat4.multiply(mat, mat, parentMat);

      const pos1 = vec3.fromValues(1, 0, 0);
      const pos2 = vec3.create();
      vec3.transformMat4(pos2, pos1, mat);
      vec3.normalize(pos2, pos2);

      // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
      const cross = crossProductVec3(pos1, pos2);
      const dot = dotProductVec3(pos1, pos2);
      const rot = [...cross, dot];

      /*
      console.log(
        node._name.padEnd(15),
        Array.from(pos2)
          .map((a) => ((a < 0 ? '' : ' ') + a.toFixed(12)).padEnd(15))
          .join(' '),
        '  ',
        printMat(mat),
      );
       */

      const index = bonesIndexes[id];

      if (isNaN(index)) {
        throw new Error();
      }

      let children: Joint[] = [];

      const pos: Vec3 = bonesPositions[index];

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

      return {
        id,
        matrix,
        index,
        pos,
        offset,
        jointLength: vec3.len(offset),
        rot,
        children,
      };
    });
}

type SceneData = {
  matrix: number[] | undefined;
  skeleton: Joint[] | undefined;
};

function parseScene(
  { visual_scene }: ColladaVisualScenes,
  { controller }: ColladaController,
  bonesPositions: Vec3[],
): SceneData {
  if (visual_scene.node.length !== 1) {
    throw new Error();
  }

  const bones = controller.skin.source[0].Name_array._text.split(/\s+/);
  const bonesIndexes: Record<string, number> = {};

  for (let i = 0; i < bones.length; i++) {
    bonesIndexes[bones[i]] = i;
  }

  const node = visual_scene.node[0];

  const matrix = node?.node
    ?.find(({ _type }) => _type === 'NODE')
    ?.matrix?._text.split(/\s+/)
    .map(parseFloat);

  const skeleton = node.node
    ? extractBones(node.node, bonesIndexes, bonesPositions, [0, 0, 0])
    : undefined;

  return {
    matrix,
    skeleton,
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
        ['node', 'source'].includes(name.toLowerCase()),
    });

    const {
      library_cameras,
      library_lights,
      library_effects,
      library_materials,
      library_geometries: { geometry },
      library_controllers,
      library_visual_scenes,
      scene,
    } = parsedCollada.COLLADA;

    const g = parseGeometry(geometry);
    let c;
    let s;

    if (library_controllers) {
      c = parseController(library_controllers);
      s = parseScene(library_visual_scenes, library_controllers, c.bones);
    }

    const dir = path.dirname(filePath);
    const extName = path.extname(filePath);
    const fileName = path.basename(filePath, extName);

    const outFile = path.join(dir, `${fileName}.json`);

    await fs.writeFile(outFile, JSON.stringify({ ...g, ...c, ...s }));

    console.info(`Converted json saved: ${outFile}`);
  }
}
