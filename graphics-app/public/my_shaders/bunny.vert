#version 300 es
in vec3 a_position;
in vec3 a_normal;
uniform mat4 u_matrix;
out vec3 v_normal;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  v_normal = a_normal;
}
