import path from 'path';
import fs from 'fs/promises';

import type { ModelData, Point, Point2D, AnyFace } from './types';

const FILE = './example/man_s2.obj';

const addNormals = false;
const addUVs = false;

const POINT_PARTS_COUNT = 1 + (addUVs ? 1 + (addNormals ? 1 : 0) : 0);

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

function parseFace(line: string, model: ModelData): AnyFace[] {
  const points = line.split(/\s+/);

  if (points.length < 3 || points.length > 4) {
    console.error('Invalid polygon:', line);
    throw new Error('Invalid polygon size');
  }

  const processedPoints = points.map((point) => {
    const pointData: any = {};

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
    pointData.vertex = v;

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
      pointData.uv = vt;
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
      pointData.normal = vn;
    }

    return pointData;
  });

  const triangles = [
    [processedPoints[0], processedPoints[1], processedPoints[2]],
  ];

  if (processedPoints.length === 4) {
    triangles.push([
      processedPoints[2],
      processedPoints[3],
      processedPoints[0],
    ]);
  }

  return triangles.map((points) => {
    const data: any = {
      vertices: points.map((data) => data.vertex),
    };

    if (addUVs) {
      data.uvs = points.map((data) => data.uv);

      if (addNormals) {
        data.normals = points.map((data) => data.normal);
      }
    }

    return data;
  });
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
        // currently ignore
        continue;
      case 'usemtl': // Use Materials Lib
        // currently ignore
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
      case 'vn': // Normals
        if (addNormals) {
          currentModel.normals.push(parsePoint(params, 'vn'));
        }
        break;
      case 'f': // Face
        currentModel.faces.push(...parseFace(params, currentModel));
        break;
    }
  }

  console.info(`Models loaded: ${models.length}`);

  for (const model of models) {
    const info = [`vertexes: ${model.vertices.length}`];

    if (addUVs) {
      info.push(`uvs: ${model.uvs.length}`);

      if (addNormals) {
        info.push(`normals: ${model.normals.length}`);
      }
    }

    info.push(`faces: ${model.faces.length}`);

    console.info(`Model "${model.name}" loaded (${info.join(', ')})`);

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

    const outFile = path.join(
      dir,
      `${fileName}_${model.name.toLowerCase()}.json`
    );

    await fs.writeFile(outFile, JSON.stringify(data));

    console.info(`File saved: ${outFile}`);
  }
}

run().catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
