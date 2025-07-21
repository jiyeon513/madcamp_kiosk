import React, { useRef, useEffect, useState } from "react";
import * as faceapi from 'face-api.js';

const GRID_ROWS = 2;
const GRID_COLS = 2;
const AREA_INDEX = [
  [1, 2],
  [3, 4],
];

const CARD_DATA = [
  {
    img: "/cat_coffee.png",
    title: "Coffee",
    subtitle: "Espresso, Blonde",
  },
  {
    img: "/cat_blend.png",
    title: "Blended",
    subtitle: "Blended, Frappuccino",
  },
  {
    img: "/cat_refresh.png",
    title: "Refreshers",
    subtitle: "Tea, Fizzio, Refresher",
  },
  {
    img: "/cat_food.png",
    title: "Food",
    subtitle: "Bread, Dessert, etc",
  },
];

function avg(points) {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

export default function GazeDetection() {
  const DEBUG_MODE = false;
  const videoRef = useRef(null);
  const [focusIdx, setFocusIdx] = useState(null); // 1~4번 중 시선이 머무는 영역
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [nosePos, setNosePos] = useState(null);
  const [eyeCenter, setEyeCenter] = useState(null);
  const [gazePoint, setGazePoint] = useState(null);
  const [rowCol, setRowCol] = useState([null, null]);
  const intervalIdRef = useRef(null);

  // 모델 로드 및 웹캠 연결
  useEffect(() => {
    const loadModelsAndStartVideo = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Face API 모델 로딩 에러:", err);
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

  // 얼굴 추적 및 영역 계산
  useEffect(() => {
    if (!modelsLoaded) return;
    if (intervalIdRef.current) return;
    const analyze = async () => {
      if (videoRef.current) {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks();

        if (detection && detection.landmarks) {
          // 왼쪽/오른쪽 눈 6개 점의 평균
          const leftEye = detection.landmarks.positions.slice(36, 42);
          const rightEye = detection.landmarks.positions.slice(42, 48);
          const leftCenter = avg(leftEye);
          const rightCenter = avg(rightEye);
          const eyesCenter = {
            x: (leftCenter.x + rightCenter.x) / 2,
            y: (leftCenter.y + rightCenter.y) / 2,
          };
          // 코 끝(30번)
          const nose = detection.landmarks.positions[30];
          // 눈 중심과 코 끝의 평균
          const gaze = {
            x: (eyesCenter.x + nose.x) / 2,
            y: (eyesCenter.y + nose.y) / 2,
          };
          const video = videoRef.current;
          const width = video.videoWidth;
          const height = video.videoHeight;

          // 2x2 그리드(4칸) 계산: 행(row), 열(col)
          // 행: 0~1, 열: 0~1
          const mirroredX = width - gaze.x;
          const row = Math.min(
            Math.floor((gaze.y / height) * GRID_ROWS),
            GRID_ROWS - 1
          );
          const col = Math.min(
            Math.floor((mirroredX / width) * GRID_COLS),
            GRID_COLS - 1
          );
          setFocusIdx(AREA_INDEX[row][col]);
          setNosePos({ x: nose.x, y: nose.y });
          setEyeCenter(eyesCenter);
          setGazePoint(gaze);
          setRowCol([row, col]);
        } else {
          setFocusIdx(null);
          setNosePos(null);
          setEyeCenter(null);
          setGazePoint(null);
          setRowCol([null, null]);
        }
      }
    };
    intervalIdRef.current = setInterval(analyze, 200);
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [modelsLoaded]);

  // 카드 렌더링
  const renderCards = () => {
    const cards = [];
    let idx = 1;
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowCards = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const card = CARD_DATA[idx - 1];
        const isFocused = focusIdx === idx;
        rowCards.push(
          <div
            key={`card-${idx}`}
            style={{
              background: '#fff',
              borderRadius: 32,
              boxShadow: isFocused
                ? '0 0 32px 12px rgba(0,0,0,0.25)'
                : '0 2px 16px 0 rgba(0,0,0,0.07)',
              border: isFocused ? '3px solid #00704A' : '2px solid #eee',
              width: 320,
              height: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 0,
              marginBottom: row !== GRID_ROWS - 1 ? 48 : 0,
              marginRight: col === 0 ? 48 : 0,
              transition: 'box-shadow 0.2s, border 0.2s',
            }}
          >
            <img
              src={card.img}
              alt={card.title}
              style={{ width: 140, height: 140, marginBottom: 24, objectFit: 'contain' }}
            />
            <div style={{ fontWeight: 700, fontSize: 28, marginBottom: 12 }}>{card.title}</div>
            <div style={{ color: '#444', fontSize: 20, textAlign: 'center', fontWeight: 400 }}>{card.subtitle}</div>
          </div>
        );
        idx++;
      }
      cards.push(
        <div key={`row-${row}`} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          {rowCards}
        </div>
      );
    }
    return cards;
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      minHeight: 0,
      minWidth: 0,
      background: '#fafbfc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      overflow: 'hidden',
    }}>
      <h1 style={{
        fontSize: 54,
        fontWeight: 800,
        marginTop: 48,
        marginLeft: 64,
        marginBottom: 32,
        textShadow: '2px 2px 8px #eee',
        letterSpacing: -2,
        textAlign: 'left',
      }}>
        Look Around
      </h1>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: 'calc(100vh - 120px)',
        minWidth: 0,
        minHeight: 0,
        boxSizing: 'border-box',
      }}>
        {renderCards()}
      </div>
      {/* 웹캠 및 디버깅 정보 (DEBUG_MODE가 true일 때만 표시) */}
      {DEBUG_MODE && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
          padding: 20,
          borderRadius: 12,
          zIndex: 100,
          minWidth: 260,
        }}>
          <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>디버깅 정보</div>
          <div>모델 로딩: {modelsLoaded ? '완료' : '대기중'}</div>
          <div>시선 영역: {focusIdx ? focusIdx : '없음'}</div>
          <div>코 끝 좌표: {nosePos ? `(${nosePos.x.toFixed(1)}, ${nosePos.y.toFixed(1)})` : '-'}</div>
          <div>눈 중심: {eyeCenter ? `(${eyeCenter.x.toFixed(1)}, ${eyeCenter.y.toFixed(1)})` : '-'}</div>
          <div>최종 시선: {gazePoint ? `(${gazePoint.x.toFixed(1)}, ${gazePoint.y.toFixed(1)})` : '-'}</div>
          <div>row/col: {rowCol[0] !== null ? `${rowCol[0]} / ${rowCol[1]}` : '-'}</div>
        </div>
      )}
      {/* 웹캠 영상 (LogoAnimation과 동일한 스타일, DEBUG_MODE가 true일 때만 보임) */}
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
      </div>
    </div>
  );
} 