import path from 'path';
import fs from 'fs/promises';

const FILE = './example/man.obj';

const addNormals = false;
const addUVs = false;

const POINT_PARTS_COUNT = 1 + (addUVs ? 1 + (addNormals ? 1 : 0) : 0);

type Point = [number, number, number];

type Point2D = [number, number];

type Face = {
  vertices: number[];
};

type FaceUV = {
  vertices: number[];
  uvs: number[];
};

type FaceUVNormal = {
  vertices: number[];
  uvs: number[];
  normals: number[];
};

type AnyFace = Face | FaceUV | FaceUVNormal;

type ModelData = {
  name: string;
  vertices: Point[];
  uvs: Point2D[];
  normals: Point[];
  faces: (Face | FaceUV | FaceUVNormal)[];
};

function parsePoint(line: string, command: string): Point {
  const point = line.split(/\s/).map(parseFloat);

  if (point.length !== 3) {
    console.error(`Invalid command ${command}`, line);
    throw new Error('Invalid points count');
  }

  return point as Point;
}

function parsePoint2D(line: string, command: string): Point2D {
  const point = line.split(/\s+/).map(parseFloat);

  if (point.length !== 2) {
    console.error(`Invalid command ${command}`, line);
    throw new Error('Invalid points count');
  }

  return point as Point2D;
}

function parseFace(line: string, model: ModelData): AnyFace {
  const points = line.split(/\s+/);

  if (points.length < 3 || points.length > 4) {
    console.error('Invalid polygon:', line);
    throw new Error('Invalid polygon size');
  }

  const face: FaceUVNormal = {
    vertices: [],
    uvs: [],
    normals: [],
  };

  for (const point of points) {
    const parts = point.split('/');

    if (parts.length < POINT_PARTS_COUNT) {
      console.error('Invalid point data:', point);
      throw new Error('Invalid point description');
    }

    let v = parseInt(parts[0], 10);
    if (Number.isNaN(v)) {
      console.error('Invalid point data:', point);
      throw new Error('Invalid point description');
    }
    v--;
    if (model.vertices.length <= v) {
      throw new Error(`Vertex ${v} is not found`);
    }
    face.vertices.push(v);

    if (addUVs) {
      let vt = parseInt(parts[1], 10);
      if (Number.isNaN(vt)) {
        console.error('Invalid point data:', point);
        throw new Error('Invalid point description');
      }

      vt--;
      if (model.uvs.length <= vt) {
        throw new Error(`UV ${vt} is not found`);
      }
      face.uvs.push(vt);
    }

    if (addNormals) {
      let vn = parseInt(parts[2], 10);
      if (Number.isNaN(vn)) {
        console.error('Invalid point data:', point);
        throw new Error('Invalid point description');
      }
      vn--;
      if (model.normals.length <= vn) {
        throw new Error(`Normal ${vn} is not found`);
      }
      face.normals.push(vn);
    }
  }

  if (addUVs && addNormals) {
    return face;
  }

  if (addUVs) {
    return {
      vertices: face.vertices,
      uvs: face.uvs,
    };
  }

  return {
    vertices: face.vertices,
  };
}

async function run() {
  const file = await fs.readFile(FILE, 'utf-8');

  console.info('Loaded file:', FILE);
  console.info('--------------');

  const lines = file.split('\n');

  const models: ModelData[] = [];
  let currentModel: ModelData | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^(\w+)\s+(.+)$/);

    if (!match) {
      console.warn('Unknown line:', trimmed);
      continue;
    }

    const [, command, params] = match;
    const cmd = command.toLowerCase();

    switch (cmd) {
      case 'o': // Object
        currentModel = {
          name: params,
          vertices: [],
          normals: [],
          uvs: [],
          faces: [],
        };
        models.push(currentModel);
        continue;
      case 'mtllib': // Materials Lib
        // console.log('mtllib:', rest);
        continue;
      case 'usemtl': // Use Materials Lib
        // console.log('usemtl:', rest);
        continue;
      case 's': // Does not used
        continue;
    }

    if (!currentModel) {
      throw new Error('No current model');
    }

    switch (cmd) {
      case 'v': // Vertex
        currentModel.vertices.push(parsePoint(params, 'v'));
        break;
      case 'vt': // Texture coordinates
        if (addUVs) {
          currentModel.uvs.push(parsePoint2D(params, 'vt'));
        }
        break;
      case 'vn': // Normales
        if (addNormals) {
          currentModel.normals.push(parsePoint(params, 'vn'));
        }
        break;
      case 'f': // Face
        currentModel.faces.push(parseFace(params, currentModel));
        break;
    }
  }

  console.info(`Models loaded: ${models.length}`);

  for (const model of models) {
    console.info(
      `Model "${model.name}" loaded (vertexes: ${model.vertices.length}, normals: ${model.normals.length}, uvs: ${model.uvs.length}, faces: ${model.faces.length})`
    );

    const dir = path.dirname(FILE);
    const extName = path.extname(FILE);
    const fileName = path.basename(FILE, extName);

    const data: any = { ...model };

    if (!addUVs) {
      delete data.uvs;
    }

    if (!addNormals) {
      delete data.normals;
    }

    await fs.writeFile(
      path.join(dir, `${fileName}.json`),
      JSON.stringify(data)
    );
  }
}

run().catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
