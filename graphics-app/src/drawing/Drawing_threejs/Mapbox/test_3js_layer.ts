import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';

export class CustomThreeLayer implements mapboxgl.CustomLayerInterface {
  id = 'threejs-layer';
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private cube!: THREE.Mesh;
  private map!: mapboxgl.Map;

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

    // 定位坐标（北京天安门）
    const lng = 116.48, lat = 39.90;
    const mercator = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    
    // 获取缩放系数，用于将米转换为 Mercator 坐标单位
    const scale = mercator.meterInMercatorCoordinateUnits();
    
    // 创建立方体几何体（使用 Mercator 坐标系下的合适尺寸）
    const size = 100 * scale; // 100米的立方体
    const geometry = new THREE.BoxGeometry(size, size, size);
    /*const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      wireframe: false
    });*/
    
    // 定义简单的顶点着色器
    const vertexShader = `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // 定义简单的片段着色器 - 纯红色
    const fragmentShader = `
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 红色
      }
    `;
    
    // 创建 ShaderMaterial
    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });
    
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
    
    // 设置立方体位置
    this.cube.position.set(
      mercator.x,
      mercator.y, 
      mercator.z + size / 2 // 抬高立方体的一半高度，使其底部贴地
    );
  }

  render(gl: WebGLRenderingContext, matrix: number[]): void {
    // 使用 Mapbox 提供的变换矩阵
    const m = new THREE.Matrix4().fromArray(matrix);
    
    // 直接使用 Mapbox 的投影矩阵
    this.camera.projectionMatrix = m;
    this.camera.matrixWorldInverse = new THREE.Matrix4();
    
    // 重置渲染器状态并渲染
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    // 重置深度测试状态，避免与 Mapbox 冲突
    gl.enable(gl.DEPTH_TEST);
  }

  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    // 清理 Three.js 场景
    this.scene.clear();

    // 清理对象引用，防止内存泄漏
    (this.renderer as any) = null;
    (this.scene as any) = null;
    (this.camera as any) = null;
    (this.cube as any) = null;
  }
}
