import mapboxgl from 'mapbox-gl';
import { createProgram, createBuffer } from '../Drawing_Tool/Webgl2_Tool';
import { mat4 } from 'gl-matrix';
// 坐标类型定义
type Point = [number, number, number]; // [经度, 纬度, 高程]
type Shape = Point[];

// 添加接口定义
interface BridgeData {
    id: string;
    deck: Shape; // [经度, 纬度, 高程]
    thickness: number;
    piers: Shape[];
    piersHeight:number;
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
    // 桥梁基本数据，包括桥面与桥墩
    private deck: Shape;
    private bridgeThickness: number;
    private piers: Shape[];
    private piersHeight: number;
    // 桥面的基本数据
    private bridgeheight = 5;
    // 总面数与变数
    private vertexCount = 0;
    private edgeCount = 0;
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
        deck: Shape,
        bridgeThickness: number,
        piers: Shape[],
        piersHeight: number
    ) {
        this.id = id;
        this.deck = deck;
        this.bridgeThickness = bridgeThickness;
        this.piers = piers;
        this.piersHeight = piersHeight;
    }

    private build3D_PolyGeometryS(map: mapboxgl.Map, polygons: Shape[], height: number, thickness: number): {
        piers_vertices: number[];
        piers_indices: number[];
        piers_edgeIndices: number[];
    } {
        const piers_vertices: number[] = [];
        const piers_indices: number[] = [];
        const piers_edgeIndices: number[] = [];

        let baseIndex = 0;

        polygons.forEach(pier => {
            const { vertices, indices, edgeIndices } = this.build3D_PolyGeometry(map, pier, height, thickness);

            // 合并顶点
            piers_vertices.push(...vertices);

            // 顶点数目是每 3 个为一组
            const currentVertexCount = vertices.length / 3;

            // 修正索引偏移
            piers_indices.push(...indices.map(i => i + baseIndex)); // 先由map方法展开indeces，对其中每一个元素i进行操作，然后将这个元素何为一个数组，再由...展开到每个元素加入。
            piers_edgeIndices.push(...edgeIndices.map(i => i + baseIndex));

            // 更新 baseIndex
            baseIndex += currentVertexCount;
        });

        return { piers_vertices, piers_indices, piers_edgeIndices };
    }


    private build3D_PolyGeometry(map: mapboxgl.Map, polygon: Shape, height: number, thickness: number): {
        vertices: number[];
        indices: number[];
        edgeIndices: number[];
    } {
        const vertices: number[] = [];
        const indices: number[] = [];
        const edgeIndices: number[] = [];

        if (polygon.length === 0) {
            throw new Error('桥面数据为空：请重新上传！');
        }

        for (let i = 0; i < polygon.length; i++) {
            if (polygon[i].length < 2) {
                throw new Error('桥面坐标点数据无效：至少需要包含经度和纬度！');
            }
        }

        const refPoint = mapboxgl.MercatorCoordinate.fromLngLat(
            { lng: polygon[0][0], lat: polygon[0][1] }
        );
        const meterInMercatorCoordinateUnits = refPoint.meterInMercatorCoordinateUnits();

        const heightInMercator = thickness * meterInMercatorCoordinateUnits!; // 厚度（底面顶面高差）
        for (const point of polygon) {
            const baseHeight = point.length >= 3 ? point[2] : height; // 设置底面高度
            const coord = mapboxgl.MercatorCoordinate.fromLngLat(
                { lng: point[0], lat: point[1] },
                baseHeight
            );

            vertices.push(coord.x, coord.y, coord.z);                // 底面
            vertices.push(coord.x, coord.y, coord.z + heightInMercator); // 顶面
        }

        const pointCount = polygon.length;
        for (let i = 0; i < pointCount - 1; i++) {
            indices.push(
                0, ((i + 2) % pointCount) * 2, (i + 1) * 2
            );
            indices.push(
                1, (i + 1) * 2 + 1, ((i + 2) % pointCount) * 2 + 1
            );
            indices.push(
                i * 2, (i + 1) * 2, i * 2 + 1,
                (i + 1) * 2, (i + 1) * 2 + 1, i * 2 + 1
            );
            edgeIndices.push(
                i * 2, (i + 1) * 2,
                i * 2 + 1, (i + 1) * 2 + 1,
                i * 2, i * 2 + 1
            );
        }

        edgeIndices.push(
            (pointCount - 1) * 2, 0,
            (pointCount - 1) * 2 + 1, 1,
            (pointCount - 1) * 2, (pointCount - 1) * 2 + 1
        );

        return { vertices, indices, edgeIndices };
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

        // 创建桥面顶点数据
        const { vertices, indices, edgeIndices } = this.build3D_PolyGeometry(map, this.deck, this.bridgeheight, this.bridgeThickness);

        // 创建桥墩数据
        const { piers_vertices, piers_indices, piers_edgeIndices } = this.build3D_PolyGeometryS(map, this.piers, 0, this.piersHeight);

        // 合并桥面和桥墩的顶点数据
        const allVertices = [...vertices, ...piers_vertices];
        const baseIndex = vertices.length / 3;
        const allIndices = [
            ...indices,
            ...piers_indices.map(i => i + baseIndex)
        ];
        const allEdgeIndices = [
            ...edgeIndices,
            ...piers_edgeIndices.map(i => i + baseIndex)
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
            this.map.transform._center.toArray()
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