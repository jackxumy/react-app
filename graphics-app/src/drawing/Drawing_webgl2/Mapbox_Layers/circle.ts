import mapboxgl from 'mapbox-gl';

export class CylinderLayer implements mapboxgl.CustomLayerInterface {
    id: string;
    type: 'custom' = 'custom';
    renderingMode: '3d' = '3d';

    program: WebGLProgram | null = null;
    edgeProgram: WebGLProgram | null = null;
    vaoFilled: WebGLVertexArrayObject | null = null;
    vaoEdges: WebGLVertexArrayObject | null = null;

    private center: { lng: number; lat: number };
    private height: number;
    private diameter: number;
    private radius: number;
    private segments: number;

    /**
     * 
     * @param id 图层id
     * @param center 底面中心点 { lng, lat }
     * @param diameter 底面直径
     * @param height 圆柱高度
     * @param segments 圆周细分数，默认32
     */
    constructor(
        id: string,
        center: { lng: number; lat: number },
        diameter: number,
        height: number,
        segments = 32
    ) {
        this.id = id;
        this.center = center;
        this.diameter = diameter;
        this.radius = diameter / 2;
        this.height = height;
        this.segments = segments;
    }

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        const { lng, lat } = this.center;
        const r = this.radius;
        const h = this.height;
        const n = this.segments;

        // 构建顶点（上圆面、下圆面）
        const vertices: number[] = [];
        const topCenter = [lng, lat, h];
        const bottomCenter = [lng, lat, 0];

        const angleStep = (Math.PI * 2) / n;

        // 上圆心点
        const topVertices = [topCenter[0], topCenter[1], topCenter[2]];
        // 下圆心点
        const bottomVertices = [bottomCenter[0], bottomCenter[1], bottomCenter[2]];

        // 生成圆周点
        for (let i = 0; i <= n; i++) {
            const angle = i * angleStep;
            const dx = Math.cos(angle) * r;
            const dy = Math.sin(angle) * r;
            topVertices.push(lng + dx, lat + dy, h);
            bottomVertices.push(lng + dx, lat + dy, 0);
        }

        vertices.push(...topVertices, ...bottomVertices);

        // 经纬度转Mercator坐标
        const positions = new Float32Array(vertices.length);
        for (let i = 0; i < vertices.length; i += 3) {
            const m = mapboxgl.MercatorCoordinate.fromLngLat(
                { lng: vertices[i], lat: vertices[i + 1] }, vertices[i + 2]
            );
            positions[i] = m.x;
            positions[i + 1] = m.y;
            positions[i + 2] = m.z;
        }

        // 索引：顶面三角扇
        const indices: number[] = [];
        for (let i = 1; i <= n; i++) {
            indices.push(0, i, i + 1);
        }

        // 底面三角扇，offset为下圆心点索引
        const offset = n + 2;
        for (let i = 1; i <= n; i++) {
            indices.push(offset, offset + i + 1, offset + i);
        }

        // 侧面矩形（三角形组成）
        for (let i = 1; i <= n; i++) {
            const top1 = i;
            const top2 = i + 1;
            const bottom1 = offset + i;
            const bottom2 = offset + i + 1;
            indices.push(top1, bottom1, bottom2);
            indices.push(top1, bottom2, top2);
        }

        // 边框索引
        const edgeIndices: number[] = [];
        for (let i = 1; i <= n; i++) {
            const top = i;
            const bottom = offset + i;
            edgeIndices.push(top, bottom); // 侧边线
            if (i < n) {
                edgeIndices.push(top, top + 1); // 顶圆边线
                edgeIndices.push(bottom, bottom + 1); // 底圆边线
            }
        }

        // shader 和程序
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
                outColor = vec4(0.2, 0.6, 0.9, 1.0);
            }`;

        const edgeFs = `#version 300 es
            precision highp float;
            out vec4 outColor;
            void main() {
                outColor = vec4(0.0, 0.0, 0.0, 1.0);
            }`;

        const compileShader = (type: number, source: string): WebGLShader => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };

        const vsShader = compileShader(gl.VERTEX_SHADER, vs);
        const fsShader = compileShader(gl.FRAGMENT_SHADER, fs);
        const edgeFsShader = compileShader(gl.FRAGMENT_SHADER, edgeFs);

        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vsShader);
        gl.attachShader(this.program, fsShader);
        gl.linkProgram(this.program);

        this.edgeProgram = gl.createProgram()!;
        gl.attachShader(this.edgeProgram, vsShader);
        gl.attachShader(this.edgeProgram, edgeFsShader);
        gl.linkProgram(this.edgeProgram);

        // 顶点缓冲
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // VAO填充
        this.vaoFilled = gl.createVertexArray();
        gl.bindVertexArray(this.vaoFilled);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        // VAO边框
        this.vaoEdges = gl.createVertexArray();
        gl.bindVertexArray(this.vaoEdges);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        const edgeIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edgeIndices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);
    }

    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!(this.vaoFilled && this.vaoEdges && this.program && this.edgeProgram)) return;

        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vaoFilled);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
        gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, 6 * this.segments, gl.UNSIGNED_SHORT, 0);

        gl.useProgram(this.edgeProgram);
        gl.bindVertexArray(this.vaoEdges);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.edgeProgram, 'u_matrix'), false, matrix);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.LINES, (this.segments - 1) * 4 + this.segments, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);
    }

    onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.edgeProgram) gl.deleteProgram(this.edgeProgram);
        if (this.vaoFilled) gl.deleteVertexArray(this.vaoFilled);
        if (this.vaoEdges) gl.deleteVertexArray(this.vaoEdges);
    }
}
