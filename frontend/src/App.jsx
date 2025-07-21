// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import './App.css';
import LogoAnimation from './components/LogoAnimation';
import { RecognitionProvider } from './contexts/RecognitionContext';

function App() {
  return (
    <Router>
      <RecognitionProvider>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<LogoAnimation />} />
            {/* <Route path="/next-page" element={<SecondPage />} /> // 이 부분은 제거 */}
          </Routes>
        </div>
      </RecognitionProvider>
    </Router>
  );
}

export default App;