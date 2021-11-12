import path from 'path';
import fs from 'fs/promises';
import glob from 'glob';
import xmlParser from 'fast-xml-parser';

async function getFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob('example/*.dae', (error, files) => {
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

type Geometry = {
  vertices: number[];
  normals: number[];
  uvs: number[];
  faces: {
    v: number[];
    n: number[];
    t: number[];
  }[];
};

function parseGeometry(data: ColladaGeometry): Geometry {
  const { source, triangles } = data.mesh;

  const vertices = source[0].float_array.split(/\s/).map(parseFloat);
  const normals = source[1].float_array.split(/\s/).map(parseFloat);
  const uvs = source[2].float_array.split(/\s/).map(parseFloat);

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

    console.log(n1, n2, n3);

    result.faces.push({
      v: [p1, p2, p3],
      n: [n1, n2, n3],
      t: [t1, t2, t3],
    });
  }

  return result;
}

async function run() {
  const files = await getFiles();

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

    const dir = path.dirname(filePath);
    const extName = path.extname(filePath);
    const fileName = path.basename(filePath, extName);

    const outFile = path.join(dir, `${fileName}.json`);

    await fs.writeFile(outFile, JSON.stringify(g));

    console.info(`Converted json saved: ${outFile}`);
  }
}

run().catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
