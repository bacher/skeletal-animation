export type Point = [number, number, number];

export type Point2D = [number, number];

export type Face = {
  vertices: number[];
};

export type FaceUV = {
  vertices: number[];
  uvs: number[];
};

export type FaceUVNormal = {
  vertices: number[];
  uvs: number[];
  normals: number[];
};

export type AnyFace = Face | FaceUV | FaceUVNormal;

export type ModelData = {
  name: string;
  vertices: Point[];
  uvs: Point2D[];
  normals: Point[];
  // faces: (Face | FaceUV | FaceUVNormal)[];
  faces: FaceUVNormal[];
};
