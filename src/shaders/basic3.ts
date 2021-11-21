export const vertexShaderSource = `#version 300 es
uniform mat4 u_projection;
uniform mat4 u_camera;
uniform mat4 u_model;
uniform sampler2D u_coords_texture;
uniform vec3 u_bones_pos[3];
uniform vec3 u_bones_pos_current[3];
// uniform sampler2D u_normals_texture;
in uint a_coords_index;
// in vec2 a_normal_index;
in uvec4 a_bone_bind;
// in vec4 a_weights;
out vec3 v_normal;

void main() {
  // vec4 a_position = texture(u_coords_texture, a_coords_index);
  
  uint tex_size = uint(textureSize(u_coords_texture, 0));
  uint ind = uint(a_coords_index);
  uint pixelX = ind % tex_size;
  uint pixelY = ind / tex_size;
  
  vec4 a_position = texelFetch(u_coords_texture, ivec2(pixelX, pixelY), 0);
  
  uint bone_index = a_bone_bind[0];
  vec4 bone_pos = vec4(u_bones_pos[bone_index], 1);
  vec4 bone_pos_current = vec4(u_bones_pos_current[bone_index], 1);
  vec4 vertex_offset = a_position - bone_pos;
  vec4 final_pos = bone_pos_current + vertex_offset;

  // v_normal = (u_model * vec4(a_normal, 1)).xyz;
  // v_normal = texture(u_normals_texture, a_normal_index);
  v_normal = vec3(0,0,1);

  // gl_Position = vec4(a_position[0]*0.1, a_position[1]*0.1, a_position[2]*0.1, a_position[3]);
  // gl_Position = a_position * vec4(0.3, 0.3, 0, 1);
  gl_Position = u_projection * u_camera * u_model * final_pos;
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
  outColor.rgb *= 0.3 + 0.7*light;
}
`;
