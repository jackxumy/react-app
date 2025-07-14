import mapboxgl from 'mapbox-gl';

export class BridgeLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  program: WebGLProgram | null = null;
  vao: WebGLVertexArrayObject | null = null;

  private deckPolygon: number[][];
  private pierCenters: { lng: number; lat: number }[];

  private vertexCount = 0;

  constructor(
    id: string,
    deckPolygon: number[][],
    pierCenters: { lng: number; lat: number }[]
  ) {
    this.id = id;
    this.deckPolygon = deckPolygon;
    this.pierCenters = pierCenters;
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    const vs = `#version 300 es
    uniform mat4 u_matrix;
    layout(location=0) in vec3 a_pos;
    void main() {
      gl_Position = u_matrix * vec4(a_pos, 1.0);
    }`;

    const fs = `#version 300 es
    precision highp float;
    out vec4 outColor;
    void main() {
      outColor = vec4(0.4, 0.4, 0.8, 1.0);
    }`;

    const compileShader = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vsShader = compileShader(gl.VERTEX_SHADER, vs);
    const fsShader = compileShader(gl.FRAGMENT_SHADER, fs);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vsShader);
    gl.attachShader(this.program, fsShader);
    gl.linkProgram(this.program);

    // ----- 几何构造 -----
    const vertices: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    const pierHeight = 2.0;   // 桥墩高度
    const deckThickness = 1.0; // 桥面厚度

    // === 构造桥面 ===
    const deckTopZ = pierHeight + deckThickness;
    const deckBottomZ = 10;

    const top: [number, number, number][] = [];
    const bottom: [number, number, number][] = [];

    for (const [lng, lat] of this.deckPolygon) {
      const topCoord = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, deckTopZ);
      const botCoord = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, deckBottomZ);
      top.push([topCoord.x, topCoord.y, topCoord.z]);
      bottom.push([botCoord.x, botCoord.y, botCoord.z]);
    }

    for (const p of top) vertices.push(...p);
    for (const p of bottom) vertices.push(...p);

    const n = this.deckPolygon.length;
    for (let i = 1; i < n - 1; i++) {
      indices.push(0, i, i + 1); // 顶面
      indices.push(n, n + i + 1, n + i); // 底面
    }

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      indices.push(i, next, n + i);
      indices.push(next, n + next, n + i);
    }

    indexOffset = vertices.length / 3;

    // === 构造桥墩 ===
    const pierSize = 0.0002;
    for (const center of this.pierCenters) {
      const { lng, lat } = center;
      const corners = [
        [lng - pierSize, lat - pierSize],
        [lng + pierSize, lat - pierSize],
        [lng + pierSize, lat + pierSize],
        [lng - pierSize, lat + pierSize]
      ];

      const topPts = corners.map(([lng, lat]) =>
        mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, pierHeight)
      );
      const botPts = corners.map(([lng, lat]) =>
        mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, 0)
      );

      const cubeVerts: [number, number, number][] = [
        ...topPts.map(p => [p.x, p.y, p.z] as [number, number, number]),
        ...botPts.map(p => [p.x, p.y, p.z] as [number, number, number])
      ];
      for (const p of cubeVerts) vertices.push(...p);

      const base = indexOffset;
      const cubeIdx = [
        0, 1, 2, 0, 2, 3,
        4, 5, 6, 4, 6, 7,
        0, 3, 7, 0, 7, 4,
        1, 2, 6, 1, 6, 5,
        0, 1, 5, 0, 5, 4,
        3, 2, 6, 3, 6, 7
      ];
      for (const idx of cubeIdx) indices.push(base + idx);
      indexOffset += 8;
    }

    this.vertexCount = indices.length;

    // ---- 上传缓冲区 ----
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // ---- VAO ----
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
  }

  render(gl: WebGL2RenderingContext, matrix: number[]) {
    if (!this.program || !this.vao) return;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
  }
}
