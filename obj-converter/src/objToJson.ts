import path from 'path';
import fs from 'fs/promises';
import glob from 'glob';

import type { ModelData, Point, Point2D, AnyFace, Vec3 } from './types';

const addNormals = true;
const addUVs = false;

const POINT_PARTS_COUNT = 1 + (addUVs ? 1 : 0) + (addNormals ? 1 : 0);

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
    const vertices = points.map((data) => data.vertex);
    let uvs;
    let normals;

    if (addUVs) {
      uvs = points.map((data) => data.uv);
    }

    if (addNormals) {
      normals = points.map((data) => data.normal);
    }

    return {
      v: vertices,
      n: normals,
      t: uvs,
    };
  });
}

async function run() {
  const files = await getFiles();

  for (const filepath of files) {
    if (filepath !== files[0]) {
      console.info('---');
    }

    await processFile(filepath);
  }
}

async function processFile(filepath: string) {
  const file = await fs.readFile(filepath, 'utf-8');

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
        currentModel.faces.push(...(parseFace(params, currentModel) as any));
        break;
    }
  }

  console.info(`File ${filepath} loaded, models found ${models.length}:`);

  for (const model of models) {
    const info = [`vertexes: ${model.vertices.length}`];

    if (addUVs) {
      info.push(`uvs: ${model.uvs.length}`);
    }

    if (addNormals) {
      info.push(`normals: ${model.normals.length}`);
    }

    info.push(`faces: ${model.faces.length}`);

    console.info(`  Model "${model.name}" loaded (${info.join(', ')})`);

    const dir = path.dirname(filepath);
    const extName = path.extname(filepath);
    const fileName = path.basename(filepath, extName);

    const data: any = { ...model };

    if (!addUVs) {
      delete data.t;
    }

    if (!addNormals) {
      delete data.n;
    }

    const outFile = path.join(
      dir,
      `${fileName}_${model.name.toLowerCase()}.json`,
    );

    await fs.writeFile(outFile, JSON.stringify(data));

    console.info(`Converted json saved: ${outFile}`);
  }
}

async function getFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob('example/*.obj', (error, files) => {
      if (error) {
        reject(error);
      } else {
        resolve(files);
      }
    });
  });
}

run().catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
