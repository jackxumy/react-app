import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// 导入组件
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import MapboxPage from './pages/MapboxPage';
import WebGL2Page from './pages/WebGL2Page';
import ThreeJSPage from './pages/ThreeJSPage';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mapbox" element={<MapboxPage />} />
            <Route path="/webgl2" element={<WebGL2Page />} />
            <Route path="/threejs" element={<ThreeJSPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
