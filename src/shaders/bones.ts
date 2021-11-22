export const vertexShaderSource = `#version 300 es
uniform mat4 u_projection;
uniform mat4 u_camera;
uniform mat4 u_model;
uniform uint u_high_bone;
in vec3 a_pos;
in vec3 a_offset;
in uint a_bone_number;
out float v_intensity;

void main() {
  v_intensity = u_high_bone == a_bone_number ? 1.0 : 0.0;
  gl_Position = u_projection * u_camera * u_model * vec4(a_offset + a_pos, 1);
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in float v_intensity;
out vec4 out_color;

void main() {
  out_color = vec4(v_intensity, 0, 1.0 - v_intensity, 1);
}
`;
