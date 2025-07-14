import mapboxgl from 'mapbox-gl';
import { createProgram, createBuffer } from '../Drawing_Tool/Webgl2_Tool';
import { Mesh } from 'webgl-obj-loader';

export class MyObjLayer implements mapboxgl.CustomLayerInterface {
  id = 'bunny-layer';
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private mesh!: Mesh;
  private program!: WebGLProgram;
  private vaoFilled!: WebGLVertexArrayObject;
  private indexCount = 0;
  private bool_state = false;

  constructor(
    private center: { lng: number; lat: number; alt: number },
    private scale = 1 // 模型现实世界的高度,默认1米
  ) {
    // Provide default value for alt if not set
    if (this.center.alt === undefined) {
      this.center.alt = 0;
    }
  }

  async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    // 1. 加载 OBJ 模型
    this.mesh = new Mesh(await fetch('/3D_models/obj/bunny_10k.obj').then(r => r.text()));

    // 2. 加载着色器代码
    const [vs, fs] = await Promise.all([
      fetch('/my_shaders/bunny.vert').then(r => r.text()),
      fetch('/my_shaders/bunny.frag').then(r => r.text()),
    ]);
    this.program = createProgram(gl, vs, fs);
    if (!this.program) throw new Error('Shader program failed.');

    // 3. 转换地图中心点为笛卡尔坐标
    const ctr = mapboxgl.MercatorCoordinate.fromLngLat(
      { lng: this.center.lng, lat: this.center.lat },
      this.center.alt
    );
    const meterUnit = ctr.meterInMercatorCoordinateUnits(); // 1 米在 WebGL 中的长度


    // 4. 原始模型数据
    const vert = this.mesh.vertices; // 顶点坐标
    const norm = this.mesh.vertexNormals; // 法线
    const idx = this.mesh.indices; // 索引

    // 5. 归一化模型坐标（居中 + 缩放）
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < vert.length; i += 3) {
      minX = Math.min(minX, vert[i]);
      maxX = Math.max(maxX, vert[i]);
      minY = Math.min(minY, vert[i + 1]);
      maxY = Math.max(maxY, vert[i + 1]);
      minZ = Math.min(minZ, vert[i + 2]);
      maxZ = Math.max(maxZ, vert[i + 2]);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const modelHeight = maxY - minY; // 模型在文件中的高度
    const normYHeight = (maxY - minY) / maxExtent; // 归一化之后的 Y 高度（大概 1.0 以下）
    const scaleToOneMeter = meterUnit / normYHeight; // 缩放比例，将模型高度归一化到 1 米的长度


    const positions = new Float32Array(vert.length);
    for (let i = 0; i < vert.length; i += 3) {
      const x = ((vert[i] - centerX) / maxExtent) * scaleToOneMeter * this.scale;
      const y = ((vert[i + 1] - centerY) / maxExtent) * scaleToOneMeter * this.scale + modelHeight/2 * scaleToOneMeter * this.scale;
      const z = ((vert[i + 2] - centerZ) / maxExtent) * scaleToOneMeter * this.scale;

      // 正确方向：从 Y-up → Z-up（绕 X 轴 +90°）
      positions[i]     = x + ctr.x;
      positions[i + 1] = z + ctr.y;
      positions[i + 2] = y + ctr.z;
    }



    const normals = new Float32Array(norm);
    const indices = new Uint16Array(idx);
    this.indexCount = indices.length;

    // 6. 创建缓冲区
    const posBuf = createBuffer(gl, positions, gl.ARRAY_BUFFER);
    const normBuf = createBuffer(gl, normals, gl.ARRAY_BUFFER);
    const idxBuf = createBuffer(gl, indices, gl.ELEMENT_ARRAY_BUFFER);

    // 7. 创建 VAO 并配置
    this.vaoFilled = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoFilled);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    const normLoc = gl.getAttribLocation(this.program, 'a_normal');
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bindVertexArray(null);

    this.bool_state = true;
  }

  render(gl: WebGL2RenderingContext, matrix: number[]) {
    if (!this.bool_state) return;

    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.program);

    gl.bindVertexArray(this.vaoFilled);
    const loc = gl.getUniformLocation(this.program, 'u_matrix');
    gl.uniformMatrix4fv(loc, false, matrix);

    gl.disable(gl.BLEND);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vaoFilled);
  }
}
