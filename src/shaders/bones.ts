export const vertexShaderSource = `#version 300 es
uniform mat4 u_projection;
uniform mat4 u_camera;
uniform mat4 u_model;
in vec3 a_pos;
in vec3 a_offset;
// in float a_intensity;
out float v_intensity;

void main() {
  // v_intensity = a_intensity;
  v_intensity = 1.0;
  gl_Position = u_projection * u_camera * u_model * vec4(a_offset + a_pos, 1);
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in float v_intensity;
out vec4 out_color;

void main() {
  out_color = vec4(0, v_intensity, 1, 1);
}
`;
