#version 300 es
precision highp float;
in vec3 v_normal;
out vec4 outColor;
void main() {
  vec3 light = normalize(vec3(1.0, 1.0, 1.0));
  float diffuse = max(dot(normalize(v_normal), light), 0.0);
  outColor = vec4(vec3(0.8, 0.7, 0.6) * diffuse, 1.0);
}
