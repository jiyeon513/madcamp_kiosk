// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import './App.css';
import LogoAnimation from './components/LogoAnimation';
import { RecognitionProvider, useRecognition } from './contexts/RecognitionContext';
import Recommendation from './components/Recommendation';
import Payment from './components/Payment';
import MenuView from './components/Menuview';
import Coffee from './components/Coffee';
import Tea from './components/Tea';
import BlendedRefreshers from './components/BlendedRefreshers';
import MenuDetail from './components/MenuDetail';


// 웹캠을 앱 레벨에서 관리하기 위한 컴포넌트
const WebcamManager = () => {
  const { videoRef, startWebcam, stopWebcam } = useRecognition();

  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        position: 'absolute',     
        top: '1px',
        left: '20px',
        width: '1px',
        height: '1px',
        zIndex: 1000,
        border: '3px solid white',
        borderRadius: '10px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        transform: 'scaleX(-1)', // 거울 모드
      }}
    />
  );
};

function App() {
  return (
    <Router>
      <RecognitionProvider>
        <WebcamManager />
        <div className="app-container">
          <Routes>
            <Route path="/" element={<LogoAnimation />} />
            <Route path="/recommendation" element={<Recommendation />}/>
            <Route path="/payment" element={<Payment />} />
            <Route path="/coffee" element={<Coffee />} />
            <Route path="/tea" element={<Tea />} />
            <Route path="/blended-refreshers" element={<BlendedRefreshers />} />
            <Route path="/menuview" element={<Coffee />} /> {/* 기존 menuview를 coffee로 연결 */}
            <Route path="/menu/:id" element={<MenuDetail />} />
          </Routes>
        </div>
      </RecognitionProvider>
    </Router>
  );
}

export default App;