#version 300 es
uniform mat4 u_matrix;
layout(location=0) in vec2 a_pos;
void main() {
    // 使用二维顶点坐标，z设置为0.0
    gl_Position = u_matrix * vec4(a_pos.x, a_pos.y, 0.0, 1.0);
}