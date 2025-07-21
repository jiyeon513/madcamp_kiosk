// src/components/LogoAnimation.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useRecognition } from '../contexts/RecognitionContext';
import { useNavigate } from 'react-router-dom';

const useWeather = (setWeatherInfo, setWeatherError) => {
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code,temperature_2m`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('날씨 API 응답 실패');
          const data = await response.json();
          setWeatherInfo(data.current);
        } catch (err) {
          setWeatherError(`날씨 정보 조회 실패: ${err.message}`);
        }
      },
      () => setWeatherError("위치 정보 접근이 거부되었습니다.")
    );
  }, [setWeatherInfo, setWeatherError]);
};


const LogoAnimation = () => {
  const navigate = useNavigate();
  
  const {
    recognitionDone, setRecognitionDone,
    visitors, setVisitors,
    hasElderlyVisitor, setHasElderlyVisitor,
    lastDetected, setLastDetected,
    resetRecognitionState,
    setIsElderlyMajorityGroup,
    videoRef, // 컨텍스트에서 videoRef 가져오기
    setWeatherInfo,
    setWeatherError
  } = useRecognition();

  useWeather(setWeatherInfo, setWeatherError);

  const canvasRef = useRef();
  const finalLogoTop = useRef('50%'); 

  const DEBUG_MODE = false; 

  const [isShrunk, setIsShrunk] = useState(false);
  const [stopTracking, setStopTracking] = useState(false); 
  const [hasAnimatedOnce, setHasAnimatedOnce] = useState(false); 
  const [currentDistance, setCurrentDistance] = useState(null); 
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showWelcomeSvg, setShowWelcomeSvg] = useState(false); 
  const [welcomeSvgOpacity, setWelcomeSvgOpacity] = useState(0); 
  const [showRecognitionText, setShowRecognitionText] = useState(false);
  const intervalIdRef = useRef(null);

  // --- 1. 모델 로딩 ---
  useEffect(() => {
    const loadModels = async () => {
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
        console.error("Face API 모델 로딩 에러:", err);
      }
    };
    loadModels();
  }, []);

  // --- 2. 얼굴 인식 및 거리 추정 로직 시작 ---
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    if (!stopTracking) {
      startDetectionInterval();
    }
  }, [videoRef, stopTracking]); // videoRef와 stopTracking에 의존

  // videoRef가 유효하고, 메타데이터가 로드되면 인식 로직 시작
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (video.readyState >= 1) { // 1: HAVE_METADATA
        handleVideoLoadedMetadata();
      } else {
        video.addEventListener('loadedmetadata', handleVideoLoadedMetadata);
      }
    }
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', handleVideoLoadedMetadata);
      }
    };
  }, [videoRef, handleVideoLoadedMetadata]);


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
        
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetection);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetection);
        }

        const box = resizedDetection.detection.box;
        const distance = calculateDistance(box.width);

        setCurrentDistance(distance);

      } else {
        setCurrentDistance(null);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
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


  // --- 4. 애니메이션 발동 후 사용자 감지 및 저장 (Context 상태 업데이트) ---
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

          const elderlyCount = detectedVisitors.filter(v => v.age >= 45).length;
          const isElderlyMajority = detectedVisitors.length > 0 && elderlyCount / detectedVisitors.length >= 0.5;
          if (typeof setIsElderlyMajorityGroup === 'function') setIsElderlyMajorityGroup(isElderlyMajority);
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
  }, [isShrunk, recognitionDone, DEBUG_MODE, setRecognitionDone, setHasElderlyVisitor, setLastDetected, setVisitors, setIsElderlyMajorityGroup]);


  // --- recognitionDone이 true가 되면 "반가워요!" SVG 및 멘트 표시 ---
  useEffect(() => {
    let timer1, timer2; 

    if (recognitionDone) {
      setShowWelcomeSvg(true);

      timer1 = setTimeout(() => {
        setWelcomeSvgOpacity(1); 
      }, 50); 

      const welcomeSvgAnimationDuration = 1500; 
      const totalDelayForText = 50 + welcomeSvgAnimationDuration; 

      timer2 = setTimeout(() => {
        setShowRecognitionText(true); 
      }, totalDelayForText);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      }; 
    } else {
      setWelcomeSvgOpacity(0); 
      setShowRecognitionText(false); 

      timer1 = setTimeout(() => {
          setShowWelcomeSvg(false); 
      }, 700); 
      
      return () => clearTimeout(timer1);
    }
  }, [recognitionDone]);

  // --- 3. (추가) 인식이 완료되면 2.5초 후 추천 페이지로 이동 ---
  useEffect(() => {
    if (recognitionDone) {
      const navigationTimer = setTimeout(() => {
        navigate('/recommendation');
      }, 2500); // 2.5초 대기 후 페이지 이동

      // 컴포넌트가 언마운트될 경우 타이머를 정리합니다.
      return () => clearTimeout(navigationTimer);
    }
  }, [recognitionDone, navigate]); // recognitionDone과 navigate가 변경될 때마다 이 효과를 재실행

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

  // --- 'R' 키 초기화 및 클린업 로직 (Context의 reset 함수 호출) ---
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'r' || event.key === 'R') {
        setIsShrunk(false);
        setHasAnimatedOnce(false);
        setStopTracking(false);
        setCurrentDistance(null);
        finalLogoTop.current = '50%'; 
        setWelcomeSvgOpacity(0); 
        setShowWelcomeSvg(false); 
        setShowRecognitionText(false); 
        
        resetRecognitionState(); 
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [resetRecognitionState]);

  // --- 로고 스타일 계산 ---
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

  // --- "고객님의 시선과 움직임을 인식하고 있어요" 멘트 스타일 ---
  const recognitionTextStyle = {
    color: 'white',
    fontSize: hasElderlyVisitor ? '40px' : '25px',
    fontWeight: 'bold', 
    whiteSpace: 'pre-wrap', 
    textAlign: 'center',
    lineHeight: hasElderlyVisitor ? '1.5' : '1.5', 
  };

  // --- "반가워요!.svg" 이미지 스타일 ---
  const welcomeSvgStyle = {
    position: 'absolute', 
    top: '50%', 
    left: '50%',
    transform: 'translateX(-50%) translateY(-80%)', 
    width: '100%', 
    maxWidth: '500px', 
    height: 'auto', 
    opacity: welcomeSvgOpacity, 
    transition: 'opacity 1.5s ease-in, top 0.7s ease-in-out', 
    zIndex: 100, 
  };

  // --- 컴포넌트 렌더링 부분 ---
  return (
    <div style={{ padding: '40px', textAlign: 'center', position: 'relative', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>

      {/* 캔버스 (얼굴 인식을 위해 필요하지만 보이지 않게 처리) */}
      <canvas
          ref={canvasRef}
          width="320"
          height="240"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: DEBUG_MODE ? 1 : 0,
            zIndex: DEBUG_MODE ? 10 : -1,
            width: DEBUG_MODE ? '320px' : '1px',
            height: DEBUG_MODE ? '240px' : '1px',
          }}
        />

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
      {showRecognitionText && ( 
        <div style={{
          position: 'fixed', 
          bottom: '12vh', 
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%', 
          maxWidth: '800px', 
          textAlign: 'center',
          zIndex: 150,
          opacity: showRecognitionText ? 1 : 0, 
          transition: 'opacity 1s ease-in-out', 
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