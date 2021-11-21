export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type Point = [number, number, number];

export type Point2D = [number, number];

export type Face = {
  v: Vec3[];
};

export type FaceUV = {
  v: Vec3[];
  t: Vec3[];
};

export type FaceUVNormal = {
  v: Vec3[];
  n: Vec3[];
  t: Vec3[];
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
