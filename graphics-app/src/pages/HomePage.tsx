import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <h1>欢迎来到图形演示应用</h1>
      <p>这是一个展示不同图形渲染技术的 React 应用程序</p>
      
      <div className="page-cards">
        <div className="card">
          <h3>Mapbox 地图</h3>
          <p>使用 Mapbox GL JS 展示交互式地图</p>
          <Link to="/mapbox" className="card-button">
            查看演示
          </Link>
        </div>
        
        <div className="card">
          <h3>WebGL2 三角形</h3>
          <p>使用 WebGL2 绘制基本三角形</p>
          <Link to="/webgl2" className="card-button">
            查看演示
          </Link>
        </div>
        
        <div className="card">
          <h3>Three.js 立方体</h3>
          <p>使用 Three.js 创建可交互的 3D 立方体</p>
          <Link to="/threejs" className="card-button">
            查看演示
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
