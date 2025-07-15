# TerrainWaterLayer - 地形与水流图层

## 概述

`TerrainWaterLayer` 是一个自定义的 Mapbox GL JS 图层，基于 SceneManager 中的地形和水面构建方法，结合 Three.js 在地图上渲染复杂的地形和水流效果。

## 特性

### 地形系统
- **高度图驱动**: 使用 DEM 数据 (`/assets/Resources/DEM1.png`) 生成真实地形
- **自定义着色器**: 支持复杂的地形渲染效果
- **光照系统**: 包含环境光和方向光，增强立体感

### 水流系统
- **HUV 数据**: 支持水深（Height）、水平速度（U）、垂直速度（V）的动态模拟
- **多层纹理**: 泡沫、法线、位移等多种纹理效果
- **时间动画**: 水流状态会随时间变化，模拟真实水流
- **透明度混合**: 支持浅水和深水的不同视觉效果

## 场景中心

- **坐标**: `[114.028140134, 22.472900679]` (深圳地区)
- **坐标系**: 使用 Mapbox Mercator 坐标系进行转换

## 使用方法

### 1. 导入图层
```typescript
import { TerrainWaterLayer } from '../drawing/Drawing_threejs/Mapbox/terrain_water_layer';
```

### 2. 在地图加载完成后添加图层
```typescript
map.on('load', () => {
  const terrainWaterLayer = new TerrainWaterLayer();
  map.addLayer(terrainWaterLayer);
  
  // 可选：移动到场景中心
  map.flyTo({
    center: [114.028140134, 22.472900679],
    zoom: 10,
    duration: 2000
  });
});
```

### 3. 移除图层
```typescript
map.removeLayer('terrain-water-layer');
```

## 技术架构

### 继承结构
```typescript
class TerrainWaterLayer implements mapboxgl.CustomLayerInterface
```

### 主要方法
- `onAdd()`: 初始化场景、相机、渲染器
- `initScene()`: 创建地形和水面mesh
- `createTerrainMesh()`: 构建地形几何体和材质
- `createWaterMesh()`: 构建水面几何体和材质
- `render()`: 渲染循环，更新动画
- `updateWaterUniforms()`: 更新水面动画参数
- `onRemove()`: 清理资源

### 核心组件

#### 地形组件
- **几何体**: `PlaneGeometry(25155, 13765, 640, 640)`
- **材质**: 基于 TerrainVertexShader 和 TerrainFragmentShader
- **纹理**: DEM1.png 高度图

#### 水面组件
- **几何体**: `PlaneGeometry(25155, 13765, 640, 640)`
- **材质**: 基于 WaterVertexShader 和 WaterFragmentShader
- **纹理**: HUV数据、泡沫、法线贴图等

## 依赖资源

### 着色器文件
- `/my_shaders/water_shaders/TerrainShader/TerrainVertexShader.vert`
- `/my_shaders/water_shaders/TerrainShader/TerrainFragmentShader.frag`
- `/my_shaders/water_shaders/TerrainShader/WaterVertexShader.vert`
- `/my_shaders/water_shaders/TerrainShader/WaterFragmentShader.frag`

### 纹理资源
- `/assets/Resources/DEM1.png` - 地形高度图
- `/assets/Resources/huv/huv_0.png` - HUV数据第0帧
- `/assets/Resources/huv/huv_1.png` - HUV数据第1帧
- `/assets/Resources/huv/huv_2.png` - HUV数据第2帧
- `/assets/Textures/Foam.png` - 泡沫纹理
- `/assets/Textures/NormalMap.png` - 法线贴图
- `/assets/Textures/DisplacementMap.png` - 位移贴图
- `/assets/Textures/HeightMap.png` - 高度噪声图
- `/assets/Textures/HeightNormalMap.png` - 高度法线图
- `/assets/Textures/RampMap.png` - 渐变图

## 参数配置

### 地形参数
- `minTerrainHeight`: -11.35142 (最小地形高度)
- `maxTerrainHeight`: 847.2994 (最大地形高度)
- `terrainNormalY`: 0.2 (地形法线Y分量)

### 水面参数
- `waterNormalY`: 20 (水面法线Y分量)
- `normalStrength`: 10 (法线强度)
- `waterAlpha`: 0.8 (水面透明度)
- `depthDensity`: 3.0 (深度密度)
- `flowStrength`: 1.0 (流速强度)

### 动画参数
- `durationTime`: 2000ms (纹理切换周期)
- HUV纹理数组会循环播放，创建动态水流效果

## 性能考虑

1. **高精度几何体**: 640x640 顶点分辨率
2. **多纹理加载**: 异步加载避免阻塞
3. **着色器复杂度**: 需要WebGL2支持
4. **内存管理**: onRemove中正确清理资源

## 注意事项

1. 确保所有纹理资源文件存在
2. 着色器文件需要放在public目录下
3. 需要支持WebGL2的浏览器
4. 地形尺寸较大，适合中等缩放级别查看

## 错误处理

图层包含完整的错误处理机制：
- 纹理加载失败处理
- 着色器编译错误捕获
- 异步初始化错误处理

## 扩展功能

可以基于此图层进一步扩展：
- 添加更多HUV时间帧
- 调整水流参数实现不同效果
- 集成天气系统
- 添加粒子效果
