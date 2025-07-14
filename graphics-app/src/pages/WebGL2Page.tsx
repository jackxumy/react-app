import React, { useRef, useEffect } from 'react';

// 顶点着色器
const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 片段着色器
const fragmentShaderSource = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.5, 1.0, 1.0); // 蓝色
}
`;

// 创建着色器
function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

// 创建程序
function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

const WebGL2Page: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      alert('您的浏览器不支持 WebGL2!');
      return;
    }
    
    // 创建着色器
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;
    
    // 创建着色程序
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;
    
    // 查找属性位置
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    
    // 创建缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // 三角形顶点
    const positions = [
      0.0,  0.5,  // 顶部
     -0.5, -0.5,  // 左下
      0.5, -0.5,  // 右下
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // 创建顶点数组对象 (VAO)
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    // 启用属性
    gl.enableVertexAttribArray(positionAttributeLocation);
    
    // 告诉属性如何从缓冲区获取数据
    gl.vertexAttribPointer(
      positionAttributeLocation,
      2,           // 2个值（x,y）
      gl.FLOAT,    // 浮点数
      false,       // 不归一化
      0,           // 每个顶点的字节步长（0 = 使用类型和大小）
      0            // 缓冲区开始位置的偏移量
    );
    
    // 设置画布大小和视口
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // 清除画布
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // 使用程序
    gl.useProgram(program);
    
    // 绑定 VAO
    gl.bindVertexArray(vao);
    
    // 绘制三角形
    gl.drawArrays(
      gl.TRIANGLES,    // 绘制的基本图元类型
      0,               // 开始的顶点索引
      3                // 要绘制的顶点数
    );
    
  }, []);
  
  return (
    <div className="webgl-page">
      <h2>WebGL2 三角形示例</h2>
      <canvas 
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: 'calc(100vh - 150px)',
          border: '1px solid #ddd',
          backgroundColor: '#f5f5f5'
        }}
      />
    </div>
  );
};

export default WebGL2Page;
