import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';

export class TerrainWaterLayer implements mapboxgl.CustomLayerInterface {
  id = 'terrain-water-layer';
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private map!: mapboxgl.Map;
  
  private textureLoader!: THREE.TextureLoader;
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private refCenter: [number, number] = [114.028140134, 22.472900679]; // 场景中心坐标

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.scene = new THREE.Scene();
    
    // 创建透视相机
    this.camera = new THREE.PerspectiveCamera(
      window.innerWidth / window.innerHeight, // 宽高比
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this.renderer.autoClear = false;

    this.textureLoader = new THREE.TextureLoader();

    // 初始化场景
    this.initScene();
  }

  private async initScene(): Promise<void> {
    try {
      // 创建地形和水面
      const [terrainMesh, waterMesh] = await Promise.all([
        this.createTerrainMesh(),
        this.createWaterMesh()
      ]);

      this.terrainMesh = terrainMesh;
      this.waterMesh = waterMesh;

      // 计算场景位置
      const mercator = mapboxgl.MercatorCoordinate.fromLngLat(this.refCenter, 0);
      const scale = mercator.meterInMercatorCoordinateUnits();

      // 设置地形位置
      this.terrainMesh.position.set(mercator.x, mercator.y, mercator.z);
      this.terrainMesh.scale.set(scale, scale, scale);
      //this.terrainMesh.rotation.y = Math.PI/2; // 水平放置
      

      // 设置水面位置
      this.waterMesh.position.set(mercator.x, mercator.y, mercator.z);
      this.waterMesh.scale.set(scale, scale, scale);
      //this.waterMesh.rotation.y= Math.PI/2; // 水平放置

      // 添加到场景
      this.scene.add(this.terrainMesh);
      this.scene.add(this.waterMesh);

    } catch (error) {
      console.error('Failed to initialize terrain and water scene:', error);
    }
  }

  private async createTerrainMesh(): Promise<THREE.Mesh> {
    // 加载地形着色器
    const [TerrainVertexShader, TerrainFragmentShader] = await Promise.all([
      fetch('/my_shaders/water_shaders/TerrainShader/TerrainVertexShader.vert').then(res => res.text()),
      fetch('/my_shaders/water_shaders/TerrainShader/TerrainFragmentShader.frag').then(res => res.text()),
    ]);

    // 光照设置
    const lightColor = new THREE.Color("#FFF4D6");
    const lightDirection = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler((50 * Math.PI) / 180, (-30 * Math.PI) / 180, 0)
    );

    // 加载高度图
    const terrainMap = this.textureLoader.load("/assets/Resources/DEM1.png");
    terrainMap.minFilter = THREE.NearestFilter;
    terrainMap.magFilter = THREE.NearestFilter;
    terrainMap.generateMipmaps = false;

    // 地形参数
    const minTerrainHeight = -11.35142;
    const maxTerrainHeight = 847.2994;
    const maxSize = 5031;
    const terrainMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);

    // 创建地形几何体
    const geometry = new THREE.PlaneGeometry(25155, 13765, 640, 640);
    
    // 修复UV坐标映射，确保地形正确对应高度图
    const uvAttribute = geometry.getAttribute('uv');
    const uvArray = uvAttribute.array as Float32Array;
    
    for (let i = 0; i < uvArray.length; i += 2) {
      // 翻转V坐标以修复地形镜像问题
      uvArray[i + 1] = 1.0 - uvArray[i + 1];
    }
    
    uvAttribute.needsUpdate = true;

    const terrainNormalY = 0.2;
    const terrainColor = new THREE.Color("#FFFFFF");

    // 地形材质uniforms
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

  private loadTexture(image: string): THREE.Texture {
    const texture = this.textureLoader.load(image);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private async createWaterMesh(): Promise<THREE.Mesh> {
    // 光照设置
    const lightColor = new THREE.Color("#FFF4D6").convertLinearToSRGB();
    const lightDirection = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler((50 * Math.PI) / 180, (-30 * Math.PI) / 180, 0)
    );

    // 加载基础纹理
    const huvMapBefore = this.textureLoader.load("/assets/Resources/huv/huv_0.png");
    const huvMapAfter = this.textureLoader.load("/assets/Resources/huv/huv_1.png");
    const terrainMap = this.textureLoader.load("/assets/Resources/DEM1.png");

    // 加载水面纹理
    const foamTexture = this.loadTexture("/assets/Textures/Foam.png");
    const normalMap = this.loadTexture("/assets/Textures/NormalMap.png");
    const displacementMap = this.loadTexture("/assets/Textures/DisplacementMap.png");
    const heightNoiseMap = this.loadTexture("/assets/Textures/HeightMap.png");
    const heightNoiseNormalMap = this.loadTexture("/assets/Textures/HeightNormalMap.png");
    const rampMap = this.loadTexture("/assets/Textures/RampMap.png");

    // 设置泡沫纹理重复
    foamTexture.repeat = new THREE.Vector2(500, 500);

    // 地形参数
    const minTerrainHeight = -11.35142;
    const maxTerrainHeight = 847.2994;
    const maxSize = 2048;
    const huvMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);
    const terrainMapSize = new THREE.Vector2(maxSize, 2753 * maxSize / 5031);

    // 创建水面几何体
    const geometry = new THREE.PlaneGeometry(25155, 13765, 640, 640);

    // 水面参数
    const waterNormalY = 20;
    const normalStrength = 10;
    const waterAlpha = 0.8;

    function LinearToSRGB( c: number ) {
      return c;
    }

    // 定义地形和水的颜色
    // 浅水区颜色
    const waterShallowColor = new THREE.Color("#008BA7");//.convertLinearToSRGB();
    // 浅水区透明度
    const waterShallowAlpha = LinearToSRGB(166.0 / 255.0);
    // 深水区颜色
    const waterDeepColor = new THREE.Color("#2E4A6D");//.convertLinearToSRGB();
    // 深水区透明度
    const waterDeepAlpha = LinearToSRGB(228.0 / 255.0);

    // HUV 纹理数组
    const waterHuvMaps = [
      "/assets/Resources/huv/huv_0.png",
      "/assets/Resources/huv/huv_1.png",
      "/assets/Resources/huv/huv_2.png",
    ];

    // 加载所有HUV纹理
    const waterTextures = waterHuvMaps.map((element) => {
      const huvMap = this.textureLoader.load(element);
      huvMap.premultiplyAlpha = false;
      huvMap.minFilter = THREE.NearestFilter;
      huvMap.magFilter = THREE.LinearFilter;
      huvMap.generateMipmaps = false;
      huvMap.wrapS = THREE.ClampToEdgeWrapping;
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
      waterNormalY: { value: waterNormalY}, 
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

    // 加载水面着色器
    const [vertexShader, fragmentShader] = await Promise.all([
      fetch('/my_shaders/water_shaders/WaterShader/WaterVertexShader.vert').then(res => res.text()),
      fetch('/my_shaders/water_shaders/WaterShader/WaterFragmentShader.frag').then(res => res.text()),
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
    // let currentStep = 0;

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

  render(gl: WebGLRenderingContext, matrix: number[]): void {
    // 使用 Mapbox 提供的变换矩阵
    const m = new THREE.Matrix4().fromArray(matrix);
    
    // 直接使用 Mapbox 的投影矩阵
    this.camera.projectionMatrix = m;
    this.camera.matrixWorldInverse = new THREE.Matrix4();

    // 更新水面动画
    if (this.waterMesh) {
      this.updateWaterUniforms();
    }
    
    // 重置渲染器状态并渲染
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    // 重置深度测试状态，避免与 Mapbox 冲突
    gl.enable(gl.DEPTH_TEST);
  }

  private updateWaterUniforms(): void {
    if (!this.waterMesh) return;
    
    const material = this.waterMesh.material as THREE.ShaderMaterial & {
      waterTextures: THREE.Texture[];
      startTime: number;
    };
    
    if (!material.uniforms || !material.waterTextures) return;

    const currentTime = Date.now();
    const durationTime = 2000; // 2秒切换周期
    const numRasters = material.waterTextures.length;
    
    const timeElapsed = (currentTime - material.startTime) % (durationTime * numRasters);
    const currentStep = Math.floor(timeElapsed / durationTime);
    const nextStep = (currentStep + 1) % numRasters;
    const stepProgress = (timeElapsed % durationTime) / durationTime;

    // 更新HUV纹理
    material.uniforms.huvMapBefore.value = material.waterTextures[currentStep];
    material.uniforms.huvMapAfter.value = material.waterTextures[nextStep];
    
    // 更新时间参数
    material.uniforms.time.value = performance.now() * 0.001;
    material.uniforms.timeStep.value = stepProgress;
  }

  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    // 清理 Three.js 场景
    this.scene.clear();

    // 清理对象引用，防止内存泄漏
    (this.renderer as any) = null;
    (this.scene as any) = null;
    (this.camera as any) = null;
    (this.terrainMesh as any) = null;
    (this.waterMesh as any) = null;
    (this.textureLoader as any) = null;
  }
}

// // 在 MapboxPage.tsx 中使用 TerrainWaterLayer 的示例

// import { TerrainWaterLayer } from '../drawing/Drawing_threejs/Mapbox/terrain_water_layer';

// // 在地图加载完成后添加图层
// map.current.on('load', () => {
//   const terrainWaterLayer = new TerrainWaterLayer();
//   map.current?.addLayer(terrainWaterLayer);
  
//   // 可选：将地图中心移动到地形区域
//   map.current?.flyTo({
//     center: [114.028140134, 22.472900679], // 深圳坐标
//     zoom: 10,
//     duration: 2000
//   });
// });

// // 如果需要移除图层
// // map.current?.removeLayer('terrain-water-layer');
