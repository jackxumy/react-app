import mapboxgl, { MercatorCoordinate } from 'mapbox-gl';
import { mat4 } from 'gl-matrix';

export class MaskLayer implements mapboxgl.CustomLayerInterface {
    id = 'masklayer';
    type: 'custom' = 'custom';
    renderingMode?: '2d' | '3d' | undefined;
    program: WebGLProgram | null = null;
    vao: WebGLVertexArrayObjectOES | null = null;
    map!: mapboxgl.Map;

    private uMatrixLoc: WebGLUniformLocation | null = null;

    // 使用 2 个 float 来编码为 64 位精度
    private encodeFloatToDouble(value: number): Float32Array {
        const result = new Float32Array(2);
        result[0] = value;
        result[1] = value - result[0];
        return result;
    }

    // 初始化
    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        this.map = map;

        // 监听缩放事件并打印缩放等级
        this.map.on('zoom', () => {
            console.log('当前缩放等级:', this.map.getZoom());
        });

        // 三角形经纬度坐标
        const triangleCoords = [
            25.004, 60.239, 0.0,
            13.403, 52.562, 0.0,
            30.498, 50.541, 0.0
        ];

        // 顶点着色器
        const vs = `#version 300 es
        precision highp float;
        uniform mat4 u_matrix;
        uniform vec2 u_centerPosHigh;
        uniform vec2 u_centerPosLow;
        layout(location=0) in vec3 pos;

        // 计算坐标差值
        vec2 translate(vec2 high, vec2 low) {
            vec2 highDiff = high - u_centerPosHigh;
            vec2 lowDiff = low - u_centerPosLow;
            return highDiff + lowDiff;
        }

        void main() {
            vec2 translated = translate(pos.xy, vec2(0.0));
            gl_Position = u_matrix * vec4(translated, pos.z, 1.0);
        }`;

        // 片元着色器：灰色填充
        const fs = `#version 300 es
        precision highp float;
        out vec4 outColor;
        void main() {
            outColor = vec4(0.8, 0.8, 0.8, 1.0);
        }`;

        this.program = this.createProgram(gl, vs, fs);
        this.vao = this.createVAO(gl, triangleCoords);

        // 获取 uniform 位置
        this.uMatrixLoc = gl.getUniformLocation(this.program, 'u_matrix');
    }

    // 创建着色器程序
    createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error('Vertex Shader Error: ' + gl.getShaderInfoLog(vertexShader));
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error('Fragment Shader Error: ' + gl.getShaderInfoLog(fragmentShader));
        }

        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program Link Error: ' + gl.getProgramInfoLog(program));
        }

        return program;
    }

    // 创建顶点数组对象 (VAO)
    createVAO(gl: WebGL2RenderingContext, coords: number[]): WebGLVertexArrayObject {
        const positions = new Float32Array(coords.length);
        for (let i = 0; i < coords.length; i += 3) {
            const mkt = mapboxgl.MercatorCoordinate.fromLngLat(
                { lng: coords[i], lat: coords[i + 1] },
                coords[i + 2]
            );
            positions[i] = mkt.x;
            positions[i + 1] = mkt.y;
            positions[i + 2] = mkt.z;
        }

        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);

        const buffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return vao;
    }

    // 渲染过程
    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!this.program || !this.vao) return;

        // 获取地图中心点并转换为墨卡托坐标
        const mapCenter = MercatorCoordinate.fromLngLat(this.map.transform._center.toArray());

        // 创建相对变换矩阵
        const relativeMat = mat4.translate([] as any, matrix as mat4, [mapCenter.x, mapCenter.y, 0]);

        // 使用两个 float32 重新存储高位和低位
        const mapPosX = this.encodeFloatToDouble(mapCenter.x);
        const mapPosY = this.encodeFloatToDouble(mapCenter.y);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        // 设置相对变换矩阵
        gl.uniformMatrix4fv(this.uMatrixLoc!, false, relativeMat);

        // 设置高位和低位的 uniform
        const uCenterPosHighLoc = gl.getUniformLocation(this.program, 'u_centerPosHigh');
        const uCenterPosLowLoc = gl.getUniformLocation(this.program, 'u_centerPosLow');
        gl.uniform2f(uCenterPosHighLoc, mapPosX[0], mapPosY[0]);
        gl.uniform2f(uCenterPosLowLoc, mapPosX[1], mapPosY[1]);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
    }

    // 移除时清理
    onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.vao) gl.deleteVertexArray(this.vao);
    }
}
