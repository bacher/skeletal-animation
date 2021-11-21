import path from 'path';
import fs from 'fs/promises';
import { chunk } from 'lodash';
import glob from 'glob';
import xmlParser from 'fast-xml-parser';

async function getFiles(globs: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob(globs.join('|'), (error, files) => {
      if (error) {
        reject(error);
      } else {
        resolve(files);
      }
    });
  });
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
      vertex_weights: any[];
    };
  };
};

type Bones = {};

function parseBones({ controller }: ColladaController): Bones {
  console.log(controller.skin);

  return 123;
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

export async function run({ files }: { files: string[] }) {
  const filePaths = await getFiles(files);

  for (const filePath of filePaths) {
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
    // const b = parseBones(library_controllers);
    const s = parseScene(library_visual_scenes);

    const dir = path.dirname(filePath);
    const extName = path.extname(filePath);
    const fileName = path.basename(filePath, extName);

    const outFile = path.join(dir, `${fileName}.json`);

    await fs.writeFile(outFile, JSON.stringify({ ...g, ...s }));

    console.info(`Converted json saved: ${outFile}`);
  }
}
