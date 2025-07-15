import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';

class SceneManager {
    private _map: mapboxgl.Map;
    private _scene: THREE.Scene;
    private _rootModel: any;

    private _textureLoader: THREE.TextureLoader;
    private _terrainMesh: THREE.Mesh | null;
    private _waterMesh: THREE.Mesh | null;

    constructor(map: mapboxgl.Map, scene: THREE.Scene) {
        this._map = map;
        this._scene = new THREE.Scene();

        this._rootModel = null;
        this._terrainMesh = null;
        this._waterMesh = null;

        this._textureLoader = new THREE.TextureLoader();

        this.initScene();
    }

    initScene() {
        // const scene = this._scene;
        // const center = [114.028140134, 22.472900679];
        // const scope = this;
        // // 设置相机位置
        // this._rootModel = scene.addModel({
        //     id: "root-model",
        //     position: center,
        //     rotation: [0, 0, 0],
        //     scale: 1,
        //     offset: [0, 0, 0],
        //     callback: function (model: THREE.Group) {
        //         if (model.children.length > 0) {
        //             const group = model.children[0];
        //             scope.createTerrainMesh().then((terrainMesh) => {
        //                 scope._terrainMesh = terrainMesh;
        //                 group.add(scope._terrainMesh);
        //             });
        //             scope.createWaterMesh().then((waterMesh) => {
        //                 scope._waterMesh = waterMesh;
        //                 group.add(scope._waterMesh);
        //             });
        //         }
        //     },
        // });
    }

    async createTerrainMesh() {

        const [TerrainVertexShader, TerrainFragmentShader] = await Promise.all([
            fetch('/my_shaders/water_shaders/TerrainShader/TerrainVertexShader.vert').then(res => res.text()),
            fetch('/my_shaders/water_shaders/TerrainShader/TerrainFragmentShader.frag').then(res => res.text()),
        ]);

        const lightColor = new THREE.Color("#FFF4D6");//.convertLinearToSRGB(); // 光照颜色

        const lightDirection = new THREE.Vector3(0, 0, -1).applyEuler(
            new THREE.Euler((50 * Math.PI) / 180, (-30 * Math.PI) / 180, 0)
        );

        // 加载高度图
        const textureLoader = this._textureLoader;
        const terrainMap = textureLoader.load("/assets/Resources/DEM1.png");
        // minFilter 和 magFilter 是 Three.js 中的两个属性，
        // 用于控制纹理在缩小（minification）和放大（magnification）时的采样方式。
        terrainMap.minFilter = THREE.NearestFilter; // 或 THREE.LinearFilter
        terrainMap.magFilter = THREE.NearestFilter; // 或 THREE.LinearFilter
        terrainMap.generateMipmaps = false; // 禁用 Mipmap（纹理过滤）

        const minTerrainHeight = -11.35142; // 最小高度
        const maxTerrainHeight = 847.2994; // 最大高度

        // 地形几何体
        // const terrainMapSize = new THREE.Vector2(5031, 2753);
        const maxSize = 5031;//2048;
        const terrainMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);
        const geometry = new THREE.PlaneGeometry(25155, 13765, 640, 640);

        const terrainNormalY = 0.2;
        const terrainColor = new THREE.Color("#FFFFFF");//.convertLinearToSRGB(); // 地形颜色

        const terrainUniforms = {
            lightColor: { value: lightColor },
            lightDirection: { value: lightDirection },
            terrainMap: { value: terrainMap },
            terrainMapSize: { value: terrainMapSize },
            terrainColor: { value: terrainColor },
            terrainNormalY: { value: terrainNormalY },
            minTerrainHeight: { value: minTerrainHeight },
            maxTerrainHeight: { value: maxTerrainHeight },
        };

        const material = new THREE.ShaderMaterial({
            uniforms: terrainUniforms,
            vertexShader: TerrainVertexShader,
            fragmentShader: TerrainFragmentShader,
            side: THREE.DoubleSide,
        });

        // 创建地形网格
        const terrain = new THREE.Mesh(geometry, material);
        return terrain;
    }

    loadTexture(image: string) {
        const textureLoader = this._textureLoader;
        const texture = textureLoader.load(image);
        // wrapS 和 wrapT 分别控制纹理在水平方向（S）和垂直方向（T）的包裹模式。
        // THREE.RepeatWrapping 表示纹理会重复平铺。
        // 如果纹理的尺寸小于几何体的尺寸，重复模式可以让纹理在几何体表面无限延伸，不会出现拉伸或空白。
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // colorSpace 定义了纹理的颜色空间。
        // THREE.SRGBColorSpace 表示纹理使用 sRGB 颜色空间，
        // 这是 Web 和 3D 渲染中常用的标准颜色空间。
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    async createWaterMesh() {
        const lightColor = new THREE.Color("#FFF4D6").convertLinearToSRGB(); // 光照颜色

        const lightDirection = new THREE.Vector3(0, 0, -1).applyEuler(
            new THREE.Euler((50 * Math.PI) / 180, (-30 * Math.PI) / 180, 0)
        );

        // 加载纹理

        const textureLoader = this._textureLoader;
        const huvMapBefore = textureLoader.load("/assets/Resources/huv/huv_0.png");
        const huvMapAfter = textureLoader.load("/assets/Resources/huv/huv_1.png");
        const terrainMap = textureLoader.load("/assets/Resources/DEM1.png");

        // 泡泡纹理
        const foamTexture = this.loadTexture("/assets/Textures/Foam.png");
        // 
        const normalMap = this.loadTexture("/assets/Textures/NormalMap.png");
        // 
        const displacementMap = this.loadTexture("/assets/Textures/DisplacementMap.png");
        // 
        const heightNoiseMap = this.loadTexture("/assets/Textures/HeightMap.png");
        // 
        const heightNoiseNormalMap = this.loadTexture("/assets/Textures/HeightNormalMap.png");
        //
        const rampMap = this.loadTexture("/assets/Textures/RampMap.png");

        // 设置泡沫纹理的重复次数
        foamTexture.repeat = new THREE.Vector2(500, 500);

        // 定义地形的最小和最大高度
        const minTerrainHeight = -11.35142;
        const maxTerrainHeight = 847.2994;

        // 地形几何体
        const maxSize = 2048;//5031;//2048;
        const huvMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);
        const terrainMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);
        const geometry = new THREE.PlaneGeometry(25155, 13765, 640, 640);

        // 作用：waterNormalY 表示水面法线在 Y 轴方向上的分量，用于控制水面法线的方向。
        // 用途：在光照计算中，法线是一个关键参数，用于确定光线与表面的交互方式。
        // waterNormalY 的值越大，水面法线的 Y 分量越强，
        // 可能会使水面看起来更加平滑或具有特定的反射效果。
        // 场景：通常用于模拟水面波动的法线效果，结合法线贴图（normalMap）一起使用，
        // 以增强水面的真实感。
        const waterNormalY = 20;
        // 作用：normalStrength 表示法线贴图的强度，用于控制水面波纹的视觉效果。
        // 用途：法线贴图（normalMap）用于模拟水面波纹的细节，
        // 而 normalStrength 决定了这些波纹的强度。值越大，波纹的凹凸效果越明显；值越小，波纹会显得更加平滑。
        // 场景：在渲染水面时，通过调整 normalStrength，可以模拟不同的水面状态，
        // 例如平静的湖面或波涛汹涌的海面。
        const normalStrength = 10;
        // 作用：waterAlpha 表示水面的透明度，用于控制水面材质的视觉透明效果。
        // 用途：透明度值范围通常在 0.0（完全透明）到 1.0（完全不透明）之间。
        // waterAlpha 的值为 0.8，表示水面是部分透明的，允许观察到水面下的地形或其他物体。
        // 场景：在渲染水面时，透明度是一个重要的视觉参数，
        // 可以用来模拟清澈的湖泊、浑浊的河流或其他水体效果。
        const waterAlpha = 0.8;

        function LinearToSRGB(c: number) {
            return c;
        }
        // 定义地形和水的颜色
        // 地形颜色
        //const terrainColor = new THREE.Color("#FFFFFF");//.convertLinearToSRGB();
        // 浅水区颜色
        const waterShallowColor = new THREE.Color("#008BA7");//.convertLinearToSRGB();
        // 浅水区透明度
        const waterShallowAlpha = LinearToSRGB(166.0 / 255.0);
        // 深水区颜色
        const waterDeepColor = new THREE.Color("#2E4A6D");//.convertLinearToSRGB();
        // 深水区透明度
        const waterDeepAlpha = LinearToSRGB(228.0 / 255.0);

        // HUV 很可能表示 水深（Height）、水平速度（U）、垂直速度（V） 的缩写
        const waterHuvMaps = [
            "/assets/Resources/huv/huv_0.png",
            "/assets/Resources/huv/huv_1.png",
            "/assets/Resources/huv/huv_2.png",
            // "./assets/Resources/huv/huv_3.png",
            // "./assets/Resources/huv/huv_4.png",
            // "./assets/Resources/huv/huv_5.png",
            // "./assets/Resources/huv/huv_6.png",
            // "./assets/Resources/huv/huv_7.png",
            // "./assets/Resources/huv/huv_8.png",
        ];

        // 加载所有时间点的 HUV 纹理，并设置其参数
        const waterTextures = waterHuvMaps.map((element) => {
            const huvMap = textureLoader.load(element);
            huvMap.premultiplyAlpha = false;

            // 设置纹理参数
            // 缩小时使用最近点采样
            huvMap.minFilter = THREE.NearestFilter; // 或 THREE.LinearFilter
            // 放大时使用线性插值
            huvMap.magFilter = THREE.LinearFilter; // 或 THREE.LinearFilter
            huvMap.generateMipmaps = false; // 禁用 Mipmap

            // 如果需要，可以设置纹理的其他参数
            huvMap.wrapS = THREE.ClampToEdgeWrapping; // 禁用重复
            huvMap.wrapT = THREE.ClampToEdgeWrapping;
            huvMap.name = element;
            return huvMap;
        });
        // 九个时段的最小最大水深，水平最小最大速度，竖直最小最大速度
        const waterHeightMin = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        const waterHeightMax = [
            12.16459846496582, 12.405220985412598, 12.055933952331543,
            12.255563735961914, 13.065625190734863, 17.13294219970703,
            19.82972526550293, 20.09884262084961, 20.108835220336914,
        ];
        const velocityUMin = [
            -0.31911158561706543, -1.1285579204559326, -1.5455865859985352,
            -0.2689962387084961, -2.248750925064087, -4.991427421569824, -5.0, -5.0,
            -5.0,
        ];
        const velocityUMax = [
            3.726897954940796, 0.5173403024673462, 0.2561565041542053,
            0.21410520374774933, 5.000000476837158, 5.0, 5.0, 5.0, 5.0,
        ];
        const velocityVMin = [
            -1.3336925506591797, -0.432312548160553, -1.4641011953353882,
            -0.6702648997306824, -4.999998092651367, -4.999999523162842,
            -4.999998092651367, -4.999999523162842, -5.0,
        ];
        const velocityVMax = [
            3.334287405014038, 0.5072693228721619, 1.1337794065475464,
            0.2184210866689682, 4.147226810455322, 4.65350341796875,
            4.999999523162842, 5.0, 5.0,
        ];

        const uniforms = {
            // 纹理

            displacementMap: { value: displacementMap },
            normalMap: { value: normalMap },
            terrainMap: { value: terrainMap },
            huvMapBefore: { value: huvMapBefore },
            huvMapAfter: { value: huvMapAfter },
            foamTexture: { value: foamTexture },
            heightNoiseMap: { value: heightNoiseMap },
            heightNoiseNormalMap: { value: heightNoiseNormalMap },
            rampMap: { value: rampMap },

            // 参数
            lightColor: { value: lightColor },
            lightDirection: { value: lightDirection },
            huvMapSize: { value: huvMapSize },
            terrainMapSize: { value: terrainMapSize },
            normalStrength: { value: normalStrength },
            waterNormalY: { value: waterNormalY },
            time: { value: 0.0 },
            timeStep: { value: 0.0 },
            waterAlpha: { value: waterAlpha },

            minWaterDepth: { value: 0.0 },
            maxWaterDepth: { value: 5.0 },
            minWaterDepthAlpha: { value: 0.1 },
            maxWaterDepthAlpha: { value: 1.0 },
            swapTimeMinRange: { value: 0.75 },
            swapTimeMaxRange: { value: 1.0 },
            minTerrainHeight: { value: minTerrainHeight },
            maxTerrainHeight: { value: maxTerrainHeight },
            minWaterHeightBefore: { value: 0.001 },
            maxWaterHeightBefore: { value: 0.01 },
            minWaterHeightAfter: { value: 0.001 },
            maxWaterHeightAfter: { value: 0.01 },
            minVelocityUBefore: { value: 0.0 },
            maxVelocityUBefore: { value: 0.0 },
            minVelocityUAfter: { value: 0.0 },
            maxVelocityUAfter: { value: 0.0 },
            minVelocityVBefore: { value: 0.0 },
            maxVelocityVBefore: { value: 0.0 },
            minVelocityVAfter: { value: 0.0 },
            maxVelocityVAfter: { value: 0.0 },
            waterShallowColor: { value: waterShallowColor },
            waterDeepColor: { value: waterDeepColor },
            waterShallowAlpha: { value: waterShallowAlpha },
            waterDeepAlpha: { value: waterDeepAlpha },
            depthDensity: { value: 3.0 },
            flowStrength: { value: 1.0 },
            gridResolutionA: { value: 52 },
            wavePeriodA: { value: 1.578 },
            flowVelocityStrengthA: { value: 0.562 },
            gridResolutionB: { value: 60 },
            wavePeriodB: { value: 1.36 },
            flowVelocityStrengthB: { value: 0.512 },
            gridResolutionC: { value: 58 },
            wavePeriodC: { value: 1.66 },
            flowVelocityStrengthC: { value: 0.678 },
            gridResolutionD: { value: 54 },
            wavePeriodD: { value: 2.54 },
            flowVelocityStrengthD: { value: 0.602 },
            foamMinEdge: { value: 0.25 },
            foamMaxEdge: { value: 0.5 },
            foamVelocityMaskMinEdge: { value: 0.05 },
            foamVelocityMaskMaxEdge: { value: 0.2 },
        };

        const [vertexShader, fragmentShader] = await Promise.all([
            fetch('/my_shaders/water_shaders/TerrainShader/WaterVertexShader.vert').then(res => res.text()),
            fetch('/my_shaders/water_shaders/TerrainShader/WaterFragmentShader.frag').then(res => res.text()),
        ]);

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthWrite: true,
            blending: THREE.CustomBlending, // CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            blendEquation: THREE.AddEquation,
        });

        const startTime = Date.now();
        //let currentStep = 0;

        function updateWaterUniforms(time: number) {
            const numRasters = waterTextures.length;

            const durationTime = 2000;

            // const currIndex = displayPamams.huvIndex;
            const currIndex = Math.floor(time / durationTime) % numRasters;
            const nextIndex = (currIndex + 1) % numRasters;

            // console.log(currIndex, nextIndex);

            // 更新uniforms
            const uniforms = material.uniforms;

            const huvMapBefore = waterTextures[currIndex];
            const huvMapAfter = waterTextures[nextIndex];

            uniforms.huvMapBefore.value = huvMapBefore;
            uniforms.huvMapAfter.value = huvMapAfter;

            uniforms.minTerrainHeight.value = minTerrainHeight;
            uniforms.maxTerrainHeight.value = maxTerrainHeight;

            uniforms.time.value = time;
            uniforms.timeStep.value = (time % durationTime) / durationTime; // 将时间归一化到0-1范围
            uniforms.minWaterHeightBefore.value = waterHeightMin[currIndex];
            uniforms.maxWaterHeightBefore.value = waterHeightMax[currIndex];
            uniforms.minWaterHeightAfter.value = waterHeightMin[nextIndex];
            uniforms.maxWaterHeightAfter.value = waterHeightMax[nextIndex];

            uniforms.minVelocityUBefore.value = velocityUMin[currIndex];
            uniforms.maxVelocityUBefore.value = velocityUMax[currIndex];
            uniforms.minVelocityVBefore.value = velocityVMin[currIndex];
            uniforms.maxVelocityVBefore.value = velocityVMax[currIndex];
            uniforms.minVelocityUAfter.value = velocityUMin[nextIndex];
            uniforms.maxVelocityUAfter.value = velocityUMax[nextIndex];
            uniforms.minVelocityVAfter.value = velocityVMin[nextIndex];
            uniforms.maxVelocityVAfter.value = velocityVMax[nextIndex];
        }

        updateWaterUniforms(0); // 初始化uniforms

        // 创建水面网格
        const water = new THREE.Mesh(geometry, material);

        // 设置 onBeforeRender 钩子
        water.onBeforeRender = function (
            renderer,
            scene,
            camera,
            geometry,
            material,
            group
        ) {
            // 获取当前时间
            const time = Date.now();
            const deltaTime = time - startTime;
            updateWaterUniforms(deltaTime);
        };

        return water;
    }
}

export default SceneManager;