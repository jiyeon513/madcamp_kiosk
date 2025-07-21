// src/components/LogoAnimation.jsx

import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

const LogoAnimation = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const finalLogoTop = useRef('50%'); 

  const DEBUG_MODE = false; 

  const [isShrunk, setIsShrunk] = useState(false);
  const [stopTracking, setStopTracking] = useState(false); 
  const [hasAnimatedOnce, setHasAnimatedOnce] = useState(false); 
  const [currentDistance, setCurrentDistance] = useState(null); 

  const [visitors, setVisitors] = useState([]); 
  const [showDebugInfo, setShowDebugInfo] = useState(false); 
  const [lastDetected, setLastDetected] = useState(null); 
  const [recognitionDone, setRecognitionDone] = useState(false); 
  
  const [hasElderlyVisitor, setHasElderlyVisitor] = useState(false); 

  const [showWelcomeSvg, setShowWelcomeSvg] = useState(false); 
  const [welcomeSvgOpacity, setWelcomeSvgOpacity] = useState(0); 
  
  // --- 새로 추가된 상태: "고객님..." 멘트 표시 여부 제어 ---
  const [showRecognitionText, setShowRecognitionText] = useState(false);

  // --- 1. 모델 로딩 및 웹캠 설정 ---
  useEffect(() => {
    const loadModelsAndStartVideo = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        console.log("Face API 모델 로딩 완료");
      } catch (err) {
        console.error("웹캠 접근 또는 Face API 모델 로딩 에러:", err);
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("웹캠 스트림 가져오기 에러:", err);
      }
    };
    loadModelsAndStartVideo();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  // --- 2. 얼굴 인식 및 거리 추정 로직 (애니메이션 트리거용) ---
  const intervalIdRef = useRef(null);

  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const checkVideoDimensions = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        if (!stopTracking) {
          startDetectionInterval();
        }
      } else {
        setTimeout(checkVideoDimensions, 50);
      }
    };

    checkVideoDimensions();
  };

  const startDetectionInterval = () => {
    if (intervalIdRef.current || stopTracking) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    intervalIdRef.current = setInterval(async () => {
      if (stopTracking || video.paused || video.ended) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks();

      if (detection) {
        const currentDisplaySize = { width: video.videoWidth, height: video.videoHeight };

        if (currentDisplaySize.width === 0 || currentDisplaySize.height === 0) {
          return;
        }

        const resizedDetection = faceapi.resizeResults(detection, currentDisplaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetection);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

        const box = resizedDetection.detection.box;
        const distance = calculateDistance(box.width);

        setCurrentDistance(distance);

      } else {
        setCurrentDistance(null);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 100);
  };

  // --- 3. 거리 감지 및 로고 애니메이션 제어 ---
  const PROXIMITY_THRESHOLD = 1.0;

  useEffect(() => {
    if (hasAnimatedOnce) {
      return; 
    }

    if (currentDistance !== null && currentDistance < PROXIMITY_THRESHOLD) {
      if (!isShrunk) {
        setIsShrunk(true); 
        setHasAnimatedOnce(true); 
        setStopTracking(true); 
        finalLogoTop.current = '20%'; 
      }
    }
  }, [currentDistance, hasAnimatedOnce, isShrunk]);


  // --- 4. 애니메이션 발동 후 사용자 감지 및 저장 ---
  useEffect(() => {
    if (isShrunk && !recognitionDone) {
      const video = videoRef.current;
      if (!video) return;

      const detectAndSaveVisitorsWithExpressions = async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                                      .withFaceLandmarks()
                                      .withAgeAndGender()
                                      .withFaceExpressions();

        const detectedVisitors = [];
        let foundElderly = false;

        if (detections && detections.length > 0) {
          detections.forEach(detection => {
            const { age, gender, genderProbability, expressions } = detection;

            if (Math.round(age) >= 45) {
              foundElderly = true;
            }

            const dominantExpression = Object.keys(expressions).reduce((a, b) =>
              expressions[a] > expressions[b] ? a : b
            );

            detectedVisitors.push({
              age: Math.round(age),
              gender: `${gender} (${(genderProbability * 100).toFixed(1)}%)`,
              expressions: dominantExpression,
              expressionProbabilities: expressions,
              timestamp: new Date().toISOString()
            });
          });

          setHasElderlyVisitor(foundElderly);
          setLastDetected(detectedVisitors[0] || null);
          setVisitors(detectedVisitors);
        } else {
          setHasElderlyVisitor(false);
          setVisitors([]);
          setLastDetected({ age: '감지 실패', gender: '-', expressions: 'N/A' });
        }

        setRecognitionDone(true);
        if (DEBUG_MODE) setShowDebugInfo(true); 
      };

      setTimeout(detectAndSaveVisitorsWithExpressions, 500);
    }
  }, [isShrunk, recognitionDone, DEBUG_MODE]);

  // --- recognitionDone이 true가 되면 "반가워요!" SVG를 DOM에 표시하고, 그 후 opacity 애니메이션 시작 ---
  useEffect(() => {
    let timer1, timer2;
    if (recognitionDone) {
      setShowWelcomeSvg(true); // 1. SVG를 일단 DOM에 추가 (초기 opacity는 0)

      timer1 = setTimeout(() => {
        setWelcomeSvgOpacity(1); // 2. DOM에 추가된 후 50ms 딜레이 후 opacity를 1로 변경
      }, 30); 

      // --- "반가워요!" SVG 애니메이션이 끝난 후 "고객님..." 멘트 표시 ---
      const welcomeSvgAnimationDuration = 1500; // welcomeSvgStyle에 설정된 opacity transition 시간 (1.5s)
      const totalDelayForText = 50 + welcomeSvgAnimationDuration; // SVG opacity 시작 딜레이 + SVG 애니메이션 시간

      timer2 = setTimeout(() => {
        setShowRecognitionText(true); // SVG 애니메이션 완료 후 멘트 표시
      }, totalDelayForText);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      }; 
    } else {
      setWelcomeSvgOpacity(0); // recognitionDone이 false면 opacity를 0으로 먼저 설정 (숨김 효과)
      setShowRecognitionText(false); // 멘트도 숨김

      timer1 = setTimeout(() => {
          setShowWelcomeSvg(false); // 그 다음 DOM에서 제거 (디스플레이 none과 유사)
      }, 700); // opacity transition 시간(1.5s)보다 짧게 설정하여 사라지는 애니메이션이 끝나기 전에 제거
      return () => clearTimeout(timer1);
    }
  }, [recognitionDone]);

  // 얼굴 박스 너비로 거리 추정 함수
  const calculateDistance = (boxWidth) => {
    const referenceWidth = 200;
    return boxWidth > 0 ? referenceWidth / boxWidth : 9999;
  };

  // --- 5. 초기화 및 클린업 ---
  useEffect(() => {
    if (stopTracking && intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    } else if (!stopTracking && !intervalIdRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      startDetectionInterval();
    }
  }, [stopTracking]);

  // 'R' 키를 눌러 초기화하는 기능
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'r' || event.key === 'R') {
        setIsShrunk(false);
        setHasAnimatedOnce(false);
        setStopTracking(false);
        setCurrentDistance(null);
        setRecognitionDone(false);
        setShowDebugInfo(false);
        setLastDetected(null);
        setVisitors([]);
        setHasElderlyVisitor(false);
        finalLogoTop.current = '50%'; 
        setWelcomeSvgOpacity(0); 
        setShowWelcomeSvg(false); 
        setShowRecognitionText(false); // --- 초기화 시 멘트도 숨김 ---
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // 로고 스타일 계산
  const logoStyle = {
    position: 'absolute', 
    left: '50%',
    transform: 'translateX(-50%) translateY(-50%)', 
    width: isShrunk ? '350px' : '500px',
    top: hasAnimatedOnce ? finalLogoTop.current : '50%', 
    transition: 'width 0.6s ease-in-out, top 0.6s ease-in-out', 
    textAlign: 'center',
    display: 'block',
    filter: 'drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.3))'
  };

  // "고객님의 시선과 움직임을 인식하고 있어요" 멘트 스타일
  const recognitionTextStyle = {
    color: 'white',
    fontSize: hasElderlyVisitor ? '40px' : '25px',
    fontWeight: 'bold', 
    whiteSpace: 'pre-wrap', 
    textAlign: 'center',
    lineHeight: hasElderlyVisitor ? '1.5' : '1.5', 
    // opacity와 transition은 외부 div에서 제어하므로 여기서는 제거
  };

  // "반가워요!.svg" 이미지 스타일
  const welcomeSvgStyle = {
    position: 'absolute', 
    top: '50%', 
    left: '50%',
    transform: 'translateX(-50%) translateY(-80%)', 
    width: '100%', 
    maxWidth: '500px', 
    height: 'auto', 
    opacity: welcomeSvgOpacity, 
    transition: 'opacity 1.5s ease-in, top 0.7s ease-in-out', // opacity 트랜지션 시간 1.5s
    zIndex: 100, 
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center', position: 'relative', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>

      {/* 웹캠 비디오 및 캔버스 (DEBUG_MODE에 따라 표시) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'hidden',
        zIndex: DEBUG_MODE ? 10 : -1,
        width: DEBUG_MODE ? '320px' : '1px',
        height: DEBUG_MODE ? '240px' : '1px',
        opacity: DEBUG_MODE ? 1 : 0
      }}>
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoadedMetadata}
          autoPlay
          muted
          width="320" 
          height="240"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        <canvas
          ref={canvasRef}
          width="320"
          height="240"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>

      {/* 로고 */}
      <img
        src="/starbucks_logo.svg"
        alt="Cafe Logo"
        style={logoStyle}
      />

      {/* "반가워요!.svg" 이미지 (절대 위치로 변경, showWelcomeSvg에 따라 렌더링) */}
      {showWelcomeSvg && ( 
        <img 
          src="/반가워요!.svg" 
          alt="Welcome!" 
          style={welcomeSvgStyle} 
        />
      )}

      {/* "고객님의 시선과 움직임을 인식하고 있어요" 멘트 (화면 하단에 고정) */}
      {showRecognitionText && ( // --- showRecognitionText가 true일 때 렌더링 ---
        <div style={{
          position: 'fixed', 
          bottom: '12vh', 
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%', 
          maxWidth: '800px', 
          textAlign: 'center',
          zIndex: 150,
          opacity: showRecognitionText ? 1 : 0, // --- showRecognitionText에 따라 opacity 제어 ---
          transition: 'opacity 1s ease-in-out', // 멘트의 페이드인 애니메이션
        }}>
          <p style={recognitionTextStyle}>
            {hasElderlyVisitor ? '고객님의 시선과 움직임을\n인식하고 있어요' : '고객님의 시선과 움직임을 인식하고 있어요'}
          </p>
        </div>
      )}

      {/* 디버깅 정보 (DEBUG_MODE가 true일 때만 표시) */}
      {DEBUG_MODE && showDebugInfo && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          zIndex: 200,
          minWidth: '300px',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2em', marginBottom: '10px' }}>인식 완료하였습니다!</div>
          
          <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#ccc' }}>
            감지된 방문자 수: <b>{visitors.length}명</b><br />
            {visitors.length > 0 ? (
              visitors.map((v, i) => (
                <div key={i} style={{ fontSize: '0.85em', marginBottom: '5px' }}>
                  #{i + 1} - 나이: {v.age}, 성별: {v.gender}<br/>
                  표정: <b>{v.expressions}</b>
                </div>
              ))
            ) : (
              <div>감지된 사람이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 일반 디버깅 정보 (화면 오른쪽 하단) */}
      {DEBUG_MODE && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 100
        }}>
          거리: {currentDistance !== null ? currentDistance.toFixed(2) : '감지 안 됨'}<br />
          로고 상태: {isShrunk ? '축소됨' : '기본'}<br />
          애니메이션 실행됨: {hasAnimatedOnce ? '예' : '아니오'}<br />
          거리 추적 중단: {stopTracking ? '예' : '아니오'}<br />
          45세 이상: {hasElderlyVisitor ? '예' : '아니오'}<br />
          <small>R키: 초기화</small>
        </div>
      )}
    </div>
  );
};

export default LogoAnimation;