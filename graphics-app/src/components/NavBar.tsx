import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar: React.FC = () => {
  const location = useLocation();
  
  return (
    <nav className="navbar">
      <div className="nav-logo">
        图形演示应用
      </div>
      <ul className="nav-links">
        <li className={location.pathname === "/" ? "active" : ""}>
          <Link to="/">首页</Link>
        </li>
        <li className={location.pathname === "/mapbox" ? "active" : ""}>
          <Link to="/mapbox">Mapbox</Link>
        </li>
        <li className={location.pathname === "/webgl2" ? "active" : ""}>
          <Link to="/webgl2">WebGL2</Link>
        </li>
        <li className={location.pathname === "/threejs" ? "active" : ""}>
          <Link to="/threejs">Three.js</Link>
        </li>
      </ul>
    </nav>
  );
};

export default NavBar;
