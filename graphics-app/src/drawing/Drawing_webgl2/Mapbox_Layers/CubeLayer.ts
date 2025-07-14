import mapboxgl from 'mapbox-gl';

export class CubeLayer implements mapboxgl.CustomLayerInterface {
    id: string;
    type: 'custom' = 'custom';
    renderingMode: '3d' = '3d';
    program: WebGLProgram | null = null;
    edgeProgram: WebGLProgram | null = null;
    vaoFilled: WebGLVertexArrayObject | null = null;
    vaoEdges: WebGLVertexArrayObject | null = null;
    texture: WebGLTexture | null = null;
    textureLoaded = false;
    textureCoordBuffer: WebGLBuffer | null = null;

    private center: { lng: number; lat: number };
    private height: number;
    private sideLength: number = 0.01;
    private textureUrl: string;

    constructor(
        id: string, 
        center: { lng: number; lat: number }, 
        sideLength: number, 
        height: number,
        textureUrl: string
    ) {
        this.id = id;
        this.center = center;
        this.height = height;
        this.sideLength = sideLength;
        this.textureUrl = textureUrl;
    }

    private async loadTexture(gl: WebGL2RenderingContext, url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            
            // 临时1x1像素纹理
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
                new Uint8Array([255, 255, 255, 255]));

            const image = new Image();
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.generateMipmap(gl.TEXTURE_2D);
                this.textureLoaded = true;
                resolve();
            };
            image.onerror = reject;
            image.src = url;
        });
    }

    async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        const { lng, lat } = this.center;
        const height = this.height;
        const sideLength = this.sideLength;

        // 加载纹理
        await this.loadTexture(gl, this.textureUrl);

        // 构造立方体的顶点坐标（位置）
        const positions = [
            // 顶面
            lng - sideLength, lat - sideLength, height,  // 前左
            lng + sideLength, lat - sideLength, height,  // 前右
            lng - sideLength, lat + sideLength, height,  // 后左
            lng + sideLength, lat + sideLength, height,  // 后右

            // 底面
            lng - sideLength, lat - sideLength, 0,       // 前左
            lng + sideLength, lat - sideLength, 0,       // 前右
            lng - sideLength, lat + sideLength, 0,       // 后左
            lng + sideLength, lat + sideLength, 0,       // 后右

            // 正面（前面）
            lng - sideLength, lat - sideLength, 0,       // 左下
            lng + sideLength, lat - sideLength, 0,       // 右下
            lng - sideLength, lat - sideLength, height,  // 左上
            lng + sideLength, lat - sideLength, height,  // 右上

            // 背面（后面）
            lng + sideLength, lat + sideLength, 0,       // 左下
            lng - sideLength, lat + sideLength, 0,       // 右下
            lng + sideLength, lat + sideLength, height,  // 左上
            lng - sideLength, lat + sideLength, height,  // 右上

            // 左面
            lng - sideLength, lat + sideLength, 0,       // 前下
            lng - sideLength, lat - sideLength, 0,       // 后下
            lng - sideLength, lat + sideLength, height,  // 前上
            lng - sideLength, lat - sideLength, height,  // 后上

            // 右面
            lng + sideLength, lat - sideLength, 0,       // 前下
            lng + sideLength, lat + sideLength, 0,       // 后下
            lng + sideLength, lat - sideLength, height,  // 前上
            lng + sideLength, lat + sideLength, height,  // 后上
        ];

        // 定义纹理坐标
        const texcoords = new Float32Array([
            // 顶面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
            // 底面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
            // 正面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
            // 背面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
            // 左面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
            // 右面
            0.0, 1.0,   1.0, 1.0,   0.0, 0.0,   1.0, 0.0,
        ]);

        // 定义顶点索引
        const indices = new Uint16Array([
            // 顶面
            0, 1, 3,    0, 3, 2,
            // 底面
            4, 5, 7,    4, 7, 6,
            // 正面
            8, 9, 11,   8, 11, 10,
            // 背面
            12, 13, 15, 12, 15, 14,
            // 左面
            16, 17, 19, 16, 19, 18,
            // 右面
            20, 21, 23, 20, 23, 22
        ]);

        // 边框线段索引
        const edgeIndices = [
            0, 1,  1, 3,  3, 2,  2, 0,  // 前面边
            4, 5,  5, 7,  7, 6,  6, 4,  // 后面边
            0, 4,  1, 5,  2, 6,  3, 7   // 连接边
        ];

        // 顶点着色器
        const vs = `#version 300 es
            uniform mat4 u_matrix;
            layout(location=0) in vec3 a_pos;
            layout(location=1) in vec2 a_texcoord;
            out vec2 v_texcoord;
            
            void main() {
                gl_Position = u_matrix * vec4(a_pos * 1.0, 1.0);
                v_texcoord = a_texcoord;
            }`;

        // 片元着色器
        const fs = `#version 300 es
            precision highp float;
            uniform sampler2D u_texture;
            in vec2 v_texcoord;
            out vec4 outColor;
            
            void main() {
                outColor = texture(u_texture, v_texcoord);
            }`;

        // 边框片元着色器
        const edgeFs = `#version 300 es
            precision highp float;
            out vec4 outColor;
            void main() {
                outColor = vec4(0.0, 0.0, 0.0, 1.0);
            }`;

        // 编译着色器
        const compileShader = (type: number, source: string): WebGLShader => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
            }
            return shader;
        };

        const vsShader = compileShader(gl.VERTEX_SHADER, vs);
        const fsShader = compileShader(gl.FRAGMENT_SHADER, fs);
        const edgeFsShader = compileShader(gl.FRAGMENT_SHADER, edgeFs);

        // 创建并链接着色器程序
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vsShader);
        gl.attachShader(this.program, fsShader);
        gl.linkProgram(this.program);

        this.edgeProgram = gl.createProgram()!;
        gl.attachShader(this.edgeProgram, vsShader);
        gl.attachShader(this.edgeProgram, edgeFsShader);
        gl.linkProgram(this.edgeProgram);

        // 将经纬度坐标转换为笛卡尔坐标
        const mercatorPositions = new Float32Array(positions.length);
        for (let i = 0; i < positions.length; i += 3) {
            const m = mapboxgl.MercatorCoordinate.fromLngLat(
                { lng: positions[i], lat: positions[i + 1] }, 
                positions[i + 2]
            );
            mercatorPositions[i] = m.x;
            mercatorPositions[i + 1] = m.y;
            mercatorPositions[i + 2] = m.z;
        }

        // 创建并设置缓冲区
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mercatorPositions, gl.STATIC_DRAW);

        // 创建并设置纹理坐标缓冲区
        this.textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);

        // 设置面VAO
        this.vaoFilled = gl.createVertexArray();
        gl.bindVertexArray(this.vaoFilled);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        // 设置边VAO
        this.vaoEdges = gl.createVertexArray();
        gl.bindVertexArray(this.vaoEdges);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        
        const edgeIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edgeIndices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    render(gl: WebGL2RenderingContext, matrix: number[]) {
        if (!this.textureLoaded || !this.program || !this.edgeProgram || !this.vaoFilled || !this.vaoEdges) return;

        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);

        // 绘制带纹理的面
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vaoFilled);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
        
        gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

        // 绘制边框
        gl.useProgram(this.edgeProgram);
        gl.bindVertexArray(this.vaoEdges);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.edgeProgram, 'u_matrix'), false, matrix);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
    }

    onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.edgeProgram) gl.deleteProgram(this.edgeProgram);
        if (this.vaoFilled) gl.deleteVertexArray(this.vaoFilled);
        if (this.vaoEdges) gl.deleteVertexArray(this.vaoEdges);
        if (this.texture) gl.deleteTexture(this.texture);
        if (this.textureCoordBuffer) gl.deleteBuffer(this.textureCoordBuffer);
    }
}