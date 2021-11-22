import path from 'path';
import fs from 'fs/promises';
import xmlParser from 'fast-xml-parser';
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

type ColladaGeometry = {
  mesh: {
    source: {
      float_array: string;
      technique_common: any;
    }[];
    vertices: any;
    triangles: {
      input: string[];
      p: string;
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
    source[0].float_array.split(/\s/).map(parseFloat),
    3,
  ) as Vec3[];
  const normals = chunk(
    source[1].float_array.split(/\s/).map(parseFloat),
    3,
  ) as Vec3[];
  const uvs = chunk(
    source[2].float_array.split(/\s/).map(parseFloat),
    2,
  ) as Vec2[];

  const faces = triangles.p.split(/\s/).map(Number);

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
      vertex_weights: { vcount: string; v: string };
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

  const transformData: number[] = joinsNode.float_array
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

  const weightVariants = weightsNode.float_array.split(/\s+/).map(parseFloat);

  const vCount = vcount.split(/\s+/).map(Number);
  const vs = v.split(/\s+/).map(Number);

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

type ColladaVisualScenes = {
  visual_scene: {
    node: {
      matrix: string;
      instance_geometry: unknown;
    };
  };
};

type SceneData = {
  matrix: number[] | undefined;
};

function parseScene({ visual_scene }: ColladaVisualScenes): SceneData {
  const matrix = visual_scene.node?.matrix?.split(/\s+/).map(parseFloat);

  return {
    matrix,
  };
}

export async function convert({ files }: { files: string[] }) {
  for (const filePath of files) {
    const xmlData = await fs.readFile(filePath, 'utf-8');

    const parsedCollada = xmlParser.parse(xmlData);

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
