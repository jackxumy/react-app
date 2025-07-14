import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MyObjLayer } from '../drawing/Drawing_webgl2/Mapbox_Layers/bunny';

// 注意：您需要创建一个 Mapbox 账户并获取访问令牌
// 请在实际应用中使用环境变量存储此令牌
mapboxgl.accessToken = 'pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg';

const MapboxPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const initialLng = 116.4074; // 北京坐标
  const initialLat = 39.9042;
  const initialZoom = 11;
  // 用于显示当前地图状态的状态变量，不作为地图初始化的依赖
  const [lng, setLng] = useState<number>(initialLng);
  const [lat, setLat] = useState<number>(initialLat);
  const [zoom, setZoom] = useState<number>(initialZoom);

  useEffect(() => {
    if (map.current) return; // 防止重复初始化地图
    
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/ycsoku/cldjl0d2m000501qlpmmex490',
        center: [initialLng, initialLat],
        zoom: initialZoom
      });
      
      // 添加导航控件
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // 禁用 pitchWithRotate 以防止在三维模式下意外的视角改变
      // map.current.touchPitch.disable();
      
      // 地图加载完成事件，用于添加自定义图层

      map.current.on('load', () => {
        // 在此处添加您的自定义图层代码
        const center = { lng: 116.397389, lat: 39.90, alt: 0 }; // 天安门经纬度
        const MyObj = new MyObjLayer(center, 1000);
        map.current?.addLayer(MyObj);

        
      });
      
      // 监听地图移动事件
      map.current.on('move', () => {
        if (map.current) {
          const center = map.current.getCenter();
          setLng(Number(center.lng.toFixed(4)));
          setLat(Number(center.lat.toFixed(4)));
          setZoom(Number(map.current.getZoom().toFixed(2)));
        }
      });
    }
    
    // 组件卸载时清理
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // 空依赖数组表示仅在组件挂载时运行一次

  return (
    <div className="map-page">
      <div className="map-info">
        经度: {lng} | 纬度: {lat} | 缩放级别: {zoom}
      </div>
      <div 
        ref={mapContainer} 
        className="map-container" 
        style={{ width: '100%', height: 'calc(100vh - 100px)' }}
      />
    </div>
  );
};

export default MapboxPage;
