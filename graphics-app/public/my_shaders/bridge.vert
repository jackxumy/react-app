#version 300 es
    uniform mat4 u_matrix;
    layout(location=0) in vec3 a_pos;
    void main() {
      gl_Position = u_matrix * vec4(a_pos, 1.0);
    }