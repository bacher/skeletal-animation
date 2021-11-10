export const vertexShaderSource = `#version 300 es
uniform mat4 u_matrix;
in vec4 a_position;
in vec3 a_normal;
out vec3 v_normal;

void main() {
  v_normal = a_normal;
  // v_normal = vec3(0, 0.5, 0.7);

  // gl_Position = vec4(a_position[0]*0.1, a_position[1]*0.1, a_position[2]*0.1, a_position[3]);
  // gl_Position = a_position * vec4(0.3, 0.3, 0, 1);
  gl_Position = u_matrix * a_position;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec3 u_lightDirection;
in vec3 v_normal;
out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  float light = dot(normal, u_lightDirection);
  outColor = vec4(1, 0, 0, 1);
  outColor.rgb *= light;
}
`;
