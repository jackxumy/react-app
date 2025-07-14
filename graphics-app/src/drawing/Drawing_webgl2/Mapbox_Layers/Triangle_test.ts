import mapboxgl from 'mapbox-gl';
import { mat4 } from 'gl-matrix';

export class TriangleTestLayer implements mapboxgl.CustomLayerInterface {
    id = 'TriangleTestLayer';
    type: 'custom' = 'custom';
    renderingMode: '3d' = '3d';
    program: WebGLProgram | null = null;
    vao: WebGLVertexArrayObject | null = null;
    rectProgram: WebGLProgram | null = null;
    rectVAO: WebGLVertexArrayObject | null = null;
    map!: mapboxgl.Map;

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        this.map = map;

        // 三角形经纬度坐标
        const triangleCoords = [
            25.004, 60.239, 0.0,
            13.403, 52.562, 0.0,
            30.498, 50.541, 0.0
        ];

        // 稍微扩大边界的遮罩矩形区域，避免 stencil 边缘误差
        const rectCoords = [
            19.99, 54.99, 0.0,
            19.99, 57.01, 0.0,
            22.01, 57.01, 0.0,
            22.01, 54.99, 0.0
        ];

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
                outColor = vec4(1.0, 0.0, 0.0, 0.5); // 半透明红色
            }`;

        this.program = this.createProgram(gl, vs, fs);
        this.vao = this.createVAO(gl, triangleCoords);
        this.rectProgram = this.program;
        this.rectVAO = this.createVAO(gl, rectCoords);
    }

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

    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!this.program || !this.vao || !this.rectProgram || !this.rectVAO) return;

        // ✅ 清除 Mapbox 之前帧的 stencil mask 状态
        (this.map as any).painter.resetStencilClippingMasks?.();

        // ✅ 初始化 stencil buffer 状态
        gl.enable(gl.STENCIL_TEST);
        gl.clearStencil(0); // stencil 清为 0
        gl.clear(gl.STENCIL_BUFFER_BIT);

        // === 第一步：绘制 stencil 遮罩区域（正方形）===
        gl.colorMask(false, false, false, false);
        gl.depthMask(false);
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
        gl.stencilMask(0xFF);
        gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);

        gl.useProgram(this.rectProgram);
        gl.bindVertexArray(this.rectVAO);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.rectProgram, 'u_matrix'), false, matrix);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        // === 第二步：绘制三角形，排除被遮罩区域 ===
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.stencilFunc(gl.EQUAL, 1, 0xFF);
        gl.stencilMask(0x00);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // === ✅ 清理 stencil 状态 ===
        gl.stencilMask(0xFF);
        gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.disable(gl.STENCIL_TEST);

        // === ✅ 清理其他状态（防止影响 Mapbox 后续图层）===
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
    }

    onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.rectVAO) gl.deleteVertexArray(this.rectVAO);
    }
}
