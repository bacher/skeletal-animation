import path from 'path';
import fs from 'fs/promises';
import { parse as xmlParse } from 'fast-xml-parser';
import chunk from 'lodash/chunk';

import { mat4, vec3 } from 'gl-matrix';

function parseColladaMatrix(data: number[]) {
  return [
    data[0],
    data[4],
    data[8],
    data[12],
    data[1],
    data[5],
    data[9],
    data[13],
    data[2],
    data[6],
    data[10],
    data[14],
    data[3],
    data[7],
    data[11],
    data[15],
  ];
}

type Number16 = [
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

type Vec2 = [number, number];
type Vec3 = [number, number, number];

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

  for (const matrix of transformMatricesSource.map(parseColladaMatrix)) {
    // @ts-ignore
    const mat = mat4.fromValues(...matrix);
    mat4.adjoint(mat, mat);

    const pos = vec3.create();
    vec3.transformMat4(pos, pos, mat);

    bones.push(Array.from(pos) as Vec3);
  }

  const weights: [number, number][][] = [];

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
  _name: string;
  _type: 'NODE' | 'JOINT';
  matrix: TextNode;
  node?: SceneNode[];
};

type SceneJointNode = {
  _id: string;
  _name: string;
  _type: 'JOINT';
  matrix: TextNode;
  node?: SceneNode[];
};

type ColladaVisualScenes = {
  visual_scene: {
    node: SceneNode[];
  };
};

type SceneData = {
  matrix: number[] | undefined;
  skeleton: Joint;
};

type Joint = {
  id: string;
  name: string;
  matrix: number[];
  pos: number[];
  children: Joint[];
};

function extractBones(node: SceneNode, parentMat = mat4.create()): Joint {
  const matrix = node.matrix._text.split(/\s+/).map(parseFloat) as Number16;

  const mat = mat4.fromValues(...matrix);
  mat4.adjoint(mat, mat);

  mat4.multiply(mat, mat, parentMat);

  const pos = vec3.fromValues(0, 0, 0);
  vec3.transformMat4(pos, pos, mat);

  /*
  console.log(
    'P',
    node._name.padEnd(20),
    Array.from(pos)
      .map((a) => ((a < 0 ? '' : ' ') + a.toFixed(12)).padEnd(15))
      .join(' '),
    Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2),
  );
   */

  return {
    id: node._id,
    name: node._name,
    matrix,
    pos: Array.from(pos),
    children:
      (
        node.node?.filter(({ _type }) => _type === 'JOINT') as SceneJointNode[]
      ).map((joint) => extractBones(joint, mat)) ?? [],
  };
}

function parseScene({ visual_scene }: ColladaVisualScenes): SceneData {
  if (visual_scene.node.length !== 1) {
    throw new Error();
  }

  const node = visual_scene.node[0];

  const matrix = node?.node
    ?.find(({ _type }) => _type === 'NODE')
    ?.matrix?._text.split(/\s+/)
    .map(parseFloat);

  const skeleton = extractBones(node as SceneJointNode);

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
    let b;
    if (library_controllers) {
      b = parseController(library_controllers);
    }
    const s = parseScene(library_visual_scenes);

    const dir = path.dirname(filePath);
    const extName = path.extname(filePath);
    const fileName = path.basename(filePath, extName);

    const outFile = path.join(dir, `${fileName}.json`);

    await fs.writeFile(outFile, JSON.stringify({ ...g, ...b, ...s }));

    console.info(`Converted json saved: ${outFile}`);
  }
}
