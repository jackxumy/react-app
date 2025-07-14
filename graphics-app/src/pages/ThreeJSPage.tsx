import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const ThreeJSPage: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // 基本场景、相机和渲染器设置
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    const camera = new THREE.PerspectiveCamera(
      75, // 视野角度
      window.innerWidth / window.innerHeight, // 宽高比
      0.1, // 近平面
      1000 // 远平面
    );
    camera.position.z = 5;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 保存当前的 mountRef.current 的引用，以便在清理函数中使用
    const currentMount = mountRef.current;
    
    // 添加到 DOM
    if (currentMount) {
      currentMount.appendChild(renderer.domElement);
    }
    
    // 添加轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼效果
    controls.dampingFactor = 0.05;
    
    // 创建立方体
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // 为立方体的每个面创建不同的材质
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }), // 红色
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // 绿色
      new THREE.MeshBasicMaterial({ color: 0x0000ff }), // 蓝色
      new THREE.MeshBasicMaterial({ color: 0xffff00 }), // 黄色
      new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 品红
      new THREE.MeshBasicMaterial({ color: 0x00ffff }), // 青色
    ];
    
    // 创建立方体网格
    const cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);
    
    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // 添加定向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // 添加辅助线
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // 自适应窗口大小
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    
    window.addEventListener('resize', handleResize);
    
    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      
      // 旋转立方体
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      // 更新控制器
      controls.update();
      
      // 渲染场景
      renderer.render(scene, camera);
    };
    
    animate();
    
    // 清理函数
    return () => {
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      
      // 释放资源
      geometry.dispose();
      materials.forEach(material => material.dispose());
      scene.remove(cube);
      renderer.dispose();
    };
  }, []);
  
  return (
    <div className="threejs-page">
      <h2>Three.js 立方体示例</h2>
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: 'calc(100vh - 150px)',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default ThreeJSPage;
