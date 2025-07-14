import mapboxgl from 'mapbox-gl';
import { createProgram, createBuffer } from '../Drawing_Tool/Webgl2_Tool';
import { mat4 } from 'gl-matrix';
// 坐标类型定义
type Coordinates = [number, number, number]; // [经度, 纬度, 高程]

// 桥墩参数接口
interface PierParams {
  height: number;      // 桥墩高度（米）
  sideLength: number;  // 底面边长（度）
}

export class BridgeLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  program: WebGLProgram | null = null;
  edgeProgram: WebGLProgram | null = null;
  vaoFilled: WebGLVertexArrayObject | null = null;
  vaoEdges: WebGLVertexArrayObject | null = null;
  map!: mapboxgl.Map

  private deckPolygon: Coordinates[];
  private pierCenters?: { lng: number; lat: number }[];
  private bridgeThickness: number;
  private vertexCount = 0;
  private edgeCount = 0;

  private pierParams?: PierParams;  
  private pierVertices: number[] = [];
  private pierIndices: number[] = [];
  private pierEdgeIndices: number[] = [];
  private pierVertexCount = 0;
  private pierEdgeCount = 0;
   // 用于高精度渲染的属性
  private uCenterPosHighLoc: WebGLUniformLocation | null = null;
  private uCenterPosLowLoc: WebGLUniformLocation | null = null;
  private uMatrixLoc: WebGLUniformLocation | null = null;

    // 编码浮点数为高低精度部分
  private encodeFloatToDouble(value: number): Float32Array {
      const result = new Float32Array(2);
      result[0] = value;
      result[1] = value - result[0];
      return result;
  }

  constructor(
    id: string,
    deckPolygon: Coordinates[],
    pierCenters?: { lng: number; lat: number }[],
    bridgeThickness: number = 1,
    pierParams?: PierParams
  ) {
    this.id = id;
    this.deckPolygon = deckPolygon;
    this.pierCenters = pierCenters;
    this.bridgeThickness = bridgeThickness;
    this.pierParams = pierParams;
  }

  private createPierData() {
    // 如果没有桥墩参数或桥墩中心点，则不创建桥墩数据
    if (!this.pierParams || !this.pierCenters || this.pierCenters.length === 0) {
      return;
    }

    const { height, sideLength } = this.pierParams;
    
    this.pierCenters.forEach(center => {
      const { lng, lat } = center;
      const pierCoords = [
        lng - sideLength/2, lat - sideLength/2, height,
        lng + sideLength/2, lat - sideLength/2, height,
        lng + sideLength/2, lat + sideLength/2, height,
        lng - sideLength/2, lat + sideLength/2, height,
        lng - sideLength/2, lat - sideLength/2, 0,
        lng + sideLength/2, lat - sideLength/2, 0,
        lng + sideLength/2, lat + sideLength/2, 0,
        lng - sideLength/2, lat + sideLength/2, 0,
      ];

      const startIndex = this.pierVertices.length / 3;
      
      for (let i = 0; i < pierCoords.length; i += 3) {
        const coord = mapboxgl.MercatorCoordinate.fromLngLat(
          { lng: pierCoords[i], lat: pierCoords[i + 1] },
          pierCoords[i + 2]
        );
        this.pierVertices.push(coord.x, coord.y, coord.z);
      }

      const baseIndex = startIndex;
      const pierIndices = [
          0, 2, 1, 0, 3, 2,     // 顶面（逆时针）
          4, 5, 6, 4, 6, 7,     // 底面（逆时针）
          0, 4, 7, 0, 7, 3,     // 左面（逆时针）
          1, 2, 6, 1, 6, 5,     // 右面（逆时针）
          3, 7, 6, 3, 6, 2,     // 后面（逆时针）
          0, 1, 5, 0, 5, 4      // 前面（逆时针）
      ].map(i => i + baseIndex);
      
      this.pierIndices.push(...pierIndices);

      const pierEdgeIndices = [
        0, 1, 1, 2, 2, 3, 3, 0,
        4, 5, 5, 6, 6, 7, 7, 4,
        0, 4, 1, 5, 2, 6, 3, 7
      ].map(i => i + baseIndex);
      
      this.pierEdgeIndices.push(...pierEdgeIndices);
    });

    this.pierVertexCount = this.pierIndices.length;
    this.pierEdgeCount = this.pierEdgeIndices.length;
  }

  async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map
    // 顶点着色器：应用变换矩阵
    const vs = `#version 300 es
            uniform mat4 u_matrix;
            uniform vec2 u_centerPosHigh;
            uniform vec2 u_centerPosLow;
            layout(location=0) in vec3 a_pos;

            vec2 translate(vec2 high, vec2 low){
                vec2 highDiff = high - u_centerPosHigh;
                vec2 lowDiff = low - u_centerPosLow;
                return highDiff + lowDiff;
            }

            void main() {
                vec2 translated = translate(a_pos.xy, vec2(0.0));
                gl_Position = u_matrix * vec4(translated, a_pos.z, 1.0);
            }`;

    // 片元着色器：灰色填充
    const fs = `#version 300 es
        precision highp float;
        out vec4 outColor;
        void main() {
            outColor = vec4(0.8, 0.8, 0.8, 1.0);
        }`;

    // 边框片元着色器：黑色线框
    const edgeFs = `#version 300 es
        precision highp float;
        out vec4 outColor;
        void main() {
            outColor = vec4(0.0, 0.0, 0.0, 1.0);
        }`;

    // 创建着色器程序
    this.program = createProgram(gl, vs, fs);
    this.edgeProgram = createProgram(gl, vs, edgeFs);
    if (!this.program || !this.edgeProgram) throw new Error('Shader program failed.');

    // 获取 uniform 位置
    this.uMatrixLoc = gl.getUniformLocation(this.program, 'u_matrix');
    this.uCenterPosHighLoc = gl.getUniformLocation(this.program, 'u_centerPosHigh');
    this.uCenterPosLowLoc = gl.getUniformLocation(this.program, 'u_centerPosLow');

    // 创建顶点数据
    const vertices: number[] = [];
    const indices: number[] = [];
    const edgeIndices: number[] = [];
    
    // 验证输入数据
    if (this.deckPolygon.length === 0 || this.deckPolygon[0].length < 2) {
      throw new Error('坐标点数据无效：至少需要包含经度和纬度');
    }

    // 获取第一个点的墨卡托坐标作为参考
    const refPoint = mapboxgl.MercatorCoordinate.fromLngLat(
      { lng: this.deckPolygon[0][0], lat: this.deckPolygon[0][1] }
    );
    const meterInMercatorCoordinateUnits = refPoint.meterInMercatorCoordinateUnits();
    const heightInMercator = this.bridgeThickness * meterInMercatorCoordinateUnits;

    // 创建上下表面的顶点
    for (const point of this.deckPolygon) {
      if (point.length < 2) {
        throw new Error('坐标点必须至少包含经度和纬度');
      }

      const baseHeight = point.length >= 3 ? point[2] : 5; // 如果有第三个值则使用，否则默认高度为5
      const coord = mapboxgl.MercatorCoordinate.fromLngLat(
        { lng: point[0], lat: point[1] },
        baseHeight
      );
      
      vertices.push(coord.x, coord.y, coord.z); // 底面顶点
      vertices.push(coord.x, coord.y, coord.z + heightInMercator); // 顶面顶点（加上厚度）
    }

    // 创建面索引
    const pointCount = this.deckPolygon.length;
    for (let i = 0; i < pointCount - 1; i++) {
          // 底面三角形（确保逆时针）
        indices.push(
            0, ((i + 2) % pointCount) * 2, (i + 1) * 2,
        );
        // 顶面三角形（确保逆时针）
        indices.push(
            0 + 1, (i + 1) * 2 + 1, ((i + 2) % pointCount) * 2 + 1,
        );

        // 侧面矩形（两个三角形，确保逆时针）
        indices.push(
            i * 2, (i + 1) * 2, i * 2 + 1,        // 第一个三角形
            (i + 1) * 2, (i + 1) * 2 + 1, i * 2 + 1  // 第二个三角形
        );

      // 边框线段
      edgeIndices.push(
        i * 2, (i + 1) * 2,     // 底面边
        i * 2 + 1, (i + 1) * 2 + 1, // 顶面边
        i * 2, i * 2 + 1        // 垂直边
      );
    }

    // 最后一条边
    edgeIndices.push(
      (pointCount - 1) * 2, 0,
      (pointCount - 1) * 2 + 1, 1,
      (pointCount - 1) * 2, (pointCount - 1) * 2 + 1
    );

    this.vertexCount = indices.length;
    this.edgeCount = edgeIndices.length;

    // 创建法线数据
    const normals = new Float32Array(vertices.length);
    for (let i = 0; i < normals.length; i += 6) {
      // 底面顶点法线
      normals[i] = 0;
      normals[i + 1] = 0;
      normals[i + 2] = -1;
      // 顶面顶点法线
      normals[i + 3] = 0;
      normals[i + 4] = 0;
      normals[i + 5] = 1;
    }

    // 创建桥墩数据
    this.createPierData();

    // 合并桥面和桥墩的顶点数据
    const allVertices = [...vertices, ...this.pierVertices];
    const baseIndex = vertices.length / 3;
    const allIndices = [
      ...indices,
      ...this.pierIndices.map(i => i + baseIndex)
    ];
    const allEdgeIndices = [
      ...edgeIndices,
      ...this.pierEdgeIndices.map(i => i + baseIndex)
    ];

    this.vertexCount = allIndices.length;
    this.edgeCount = allEdgeIndices.length;

    // 创建并绑定 VAO
    this.vaoFilled = gl.createVertexArray();
    gl.bindVertexArray(this.vaoFilled);
    //设置顶点数据
    const positionBuffer = createBuffer(gl, new Float32Array(allVertices), gl.ARRAY_BUFFER);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    // 设置索引数据
    const indexBuffer = createBuffer(gl, new Uint16Array(allIndices), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    //------------------------------------------------------------
    this.vaoEdges = gl.createVertexArray();
    gl.bindVertexArray(this.vaoEdges);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const edgeIndexBuffer = createBuffer(gl, new Uint16Array(allEdgeIndices), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);

    gl.bindVertexArray(null);
  }

  render(gl: WebGL2RenderingContext, matrix: number[]) {
    if (!this.program || !this.edgeProgram || !this.vaoFilled || !this.vaoEdges) return;
    
     // 获取地图中心点并转换为墨卡托坐标
        const mapCenter = mapboxgl.MercatorCoordinate.fromLngLat(
            this.map .transform._center.toArray()
        );

        // 创建相对变换矩阵
        const relativeMat = mat4.translate(
            mat4.create(),
            matrix as mat4,
            [mapCenter.x, mapCenter.y, 0]
        );

        // 利用两个float32重新存储
        const mapPosX = this.encodeFloatToDouble(mapCenter.x);
        const mapPosY = this.encodeFloatToDouble(mapCenter.y);

        // 启用深度测试和面剔除
        gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.CULL_FACE);
        // gl.cullFace(gl.BACK);
        // gl.frontFace(gl.CCW);

        // 绘制面
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vaoFilled);
        
        // 设置uniform变量
        gl.uniformMatrix4fv(this.uMatrixLoc!, false, relativeMat);
        gl.uniform2f(this.uCenterPosHighLoc!, mapPosX[0], mapPosY[0]);
        gl.uniform2f(this.uCenterPosLowLoc!, mapPosX[1], mapPosY[1]);

        gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);

        // 绘制边框
        gl.useProgram(this.edgeProgram);
        gl.bindVertexArray(this.vaoEdges);
        
        // 设置边框程序的uniform变量
        gl.uniformMatrix4fv(gl.getUniformLocation(this.edgeProgram, 'u_matrix'), false, relativeMat);
        gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_centerPosHigh'), mapPosX[0], mapPosY[0]);
        gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_centerPosLow'), mapPosX[1], mapPosY[1]);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.LINES, this.edgeCount, gl.UNSIGNED_SHORT, 0);
        
        // 清理状态
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
  }

  onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    if (this.program) gl.deleteProgram(this.program);
    if (this.edgeProgram) gl.deleteProgram(this.edgeProgram);
    if (this.vaoFilled) gl.deleteVertexArray(this.vaoFilled);
    if (this.vaoEdges) gl.deleteVertexArray(this.vaoEdges);
  }
}
// 用于提升渲染精度的方法：
/* 【一个32位浮点数由三部分组成：符号位（1位）、指数部分（8位）、尾数部分（23位）】
      在这里，是使用平移的方法来实现的，对于经纬度坐标转换为webMercator，转换时的小数位数将会超过
   float32的表示精度，同时，由于在glsl中只有32位数字的计算，且硬件厂商的“处理精度”常常夸大，
   所以，需要一个方法来使得处理精度达到肉眼无法分辨的等级。
      最初的方法是采用两个float32来实现float64的模拟，拼接成 64-bit 解决，但是对于 shader 编译
   和解析性能都有影响，需要在 JS 和 GLSL 中频繁 encode/decode，同时也会增加 CPU 向 GPU 传递
   的数据带宽。（该方法使用ts特有的属性，先强制类型转换，获取高位，舍掉低位，然后用源数据减去高位，
   得到低位，再将低位存储起来：const result = new Float32Array(2);result[0] = value;
    result[1] = value - result[0];）
      那么，有没有什么不那么吃性能的方法呢？有的兄弟，有的。在缩放等级过高的情况下，通过将两个相近的点的坐标
   相减就可以得到低位，（如0.314159265358979-3.14159265358978=0.000000000000001）这样就可以存储更小的数字了！
   于是，利用视地图中心点的坐标来实现（相当于，地图视中心点存储高位），首先将坐标平移视地图中心的XY（第一次），
   构建一个新坐标系（原点为视地图中心点），然后进行计算（这时就可以直接用低位进行计算），完成计算后平移
   回去（第二次）就大功告成了！！！（这也是为什么低位坐标填上0也没有影响，因为计算用不到低位，第一次平移后，
   模型每个点的坐标就是它们的低位）
   ps；该方法应该只能解决局部的问题，如果可以将地图展开（譬如有一个边长为几十万像素的屏幕），那么远离视地图中心的区域
   仍会存在较大问题，越远抖动越剧烈。
   !!!
*/