import React, { useRef, useEffect } from 'react';

const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSourceRed = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0); // red
}
`;

const fragmentShaderSourceBlue = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 1.0, 1.0); // blue
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const WebGLCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      alert('WebGL2 not supported!');
      return;
    }

    // 清除背景
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 1, 1, 1); // white background
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ---- 三角形 ----
    const triangleProgram = createProgram(gl, vertexShaderSource, fragmentShaderSourceRed);
    gl.useProgram(triangleProgram);
    const trianglePosition = gl.getAttribLocation(triangleProgram, 'a_position');

    const triangleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
    const triangleVertices = new Float32Array([
      -0.8, -0.5,
      -0.2, -0.5,
      -0.5,  0.5
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(trianglePosition);
    gl.vertexAttribPointer(trianglePosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- 矩形（两个三角形拼接）----
    const rectProgram = createProgram(gl, vertexShaderSource, fragmentShaderSourceBlue);
    gl.useProgram(rectProgram);
    const rectPosition = gl.getAttribLocation(rectProgram, 'a_position');

    const rectBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
    const rectVertices = new Float32Array([
      0.2, -0.5,
      0.8, -0.5,
      0.2,  0.5,
      0.2,  0.5,
      0.8, -0.5,
      0.8,  0.5
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, rectVertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(rectPosition);
    gl.vertexAttribPointer(rectPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={400}
      style={{ border: '1px solid black' }}
    />
  );
};

export default WebGLCanvas;
