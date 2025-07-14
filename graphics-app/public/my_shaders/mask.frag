#version 300 es
precision highp float;

out vec4 FragColor;

void main() {
    // 输出不透明白色，用于模板测试
    FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
