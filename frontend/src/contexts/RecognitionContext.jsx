// src/contexts/RecognitionContext.js
import React, { createContext, useState, useContext } from 'react';

// 1. Context 생성
const RecognitionContext = createContext();

// 2. Context Provider 컴포넌트 생성
export const RecognitionProvider = ({ children }) => {
  // LogoAnimation에서 관리하던 모든 상태들을 이곳으로 옮겨옵니다.
  const [recognitionDone, setRecognitionDone] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [hasElderlyVisitor, setHasElderlyVisitor] = useState(false);
  const [lastDetected, setLastDetected] = useState(null);
  const [isElderlyMajorityGroup, setIsElderlyMajorityGroup] = useState(false);
  // 필요하다면 TTS 관련 상태도 이곳으로 옮겨올 수 있습니다.

  // 초기화 함수 (R 키와 동일한 기능)
  const resetRecognitionState = () => {
    setRecognitionDone(false);
    setVisitors([]);
    setHasElderlyVisitor(false);
    setLastDetected(null);
    setIsElderlyMajorityGroup(false);
  };

  const value = {
    recognitionDone, setRecognitionDone,
    visitors, setVisitors,
    hasElderlyVisitor, setHasElderlyVisitor,
    lastDetected, setLastDetected,
    isElderlyMajorityGroup, setIsElderlyMajorityGroup,
    resetRecognitionState, // 초기화 함수도 제공
  };

  return (
    <RecognitionContext.Provider value={value}>
      {children}
    </RecognitionContext.Provider>
  );
};

// 3. Context를 쉽게 사용할 수 있는 Custom Hook 생성
export const useRecognition = () => {
  const context = useContext(RecognitionContext);
  if (context === undefined) {
    throw new Error('useRecognition must be used within a RecognitionProvider');
  }
  return context;
};