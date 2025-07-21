import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecognition } from '../contexts/RecognitionContext';
import './Recommendation.css';
import { recommendMenus } from './recommendationEngine';
import { menuImageMap } from '../assets/imageLoader';
import { setupGestureRecognizer, detectGesture } from './handleGesture';
import MenuView from './Menuview';

// --- 날씨 아이콘 SVG 파일 import ---
import sunIcon from '../assets/icons/sun.svg';
import cloudIcon from '../assets/icons/cloud.svg';
import rainIcon from '../assets/icons/rain.svg';
import snowIcon from '../assets/icons/snow.svg';
// --- 아이콘 끝 ---

function Recommendation() {
    const { visitors, isElderlyMajorityGroup, videoRef, weatherInfo, weatherError } = useRecognition();
    const navigate = useNavigate();
    
    const [time, setTime] = useState(new Date());
    const [recommendedMenu, setRecommendedMenu] = useState(null);
    const animationFrameIdRef = useRef(null);
    const lastVideoTimeRef = useRef(-1);
    const [gesture, setGesture] = useState(null);
    const gestureLockRef = useRef(false);


    // --- 제스처 감지 및 처리 콜백 ---
    const handleGesture = useCallback((direction) => {
        if (gestureLockRef.current) return; // 제스처 처리가 잠겨있으면 무시

        gestureLockRef.current = true; // 제스처 처리 잠금
        setGesture(direction);
        console.log(`[Recommendation.jsx] 제스처 감지, 네비게이션 처리: ${direction}`);

        if (direction === 'up' || direction === 'down') {
            navigate('/payment');
        } else if (direction === 'left' || direction === 'right') {
            navigate('/menuview');
        } else if (direction === 'open-palm') {
            navigate('/payment');
        } else if (direction === 'closed-fist') {
            navigate('/menuview');
        }

        // 2초 후에 잠금 해제하여 다음 제스처를 받을 수 있도록 함
        setTimeout(() => {
            gestureLockRef.current = false;
            setGesture(null); // 피드백 메시지 초기화
        }, 2000);

    }, [navigate]);


    // --- 제스처 인식 시작 및 루프 ---
    useEffect(() => {
        const startGestureDetection = async () => {
            await setupGestureRecognizer();
            
            const video = videoRef.current;
            if (!video) return;

            const predictWebcam = () => {
                const nowInMs = Date.now();
                if (video.currentTime !== lastVideoTimeRef.current) {
                    lastVideoTimeRef.current = video.currentTime;
                    detectGesture(video, nowInMs, handleGesture);
                }
                animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
            };

            predictWebcam();
        };

        startGestureDetection();

        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [videoRef, handleGesture]);


    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        const runRecommendationEngine = () => {
            if (visitors && visitors.length > 0 && weatherInfo) {
                const weatherCode = weatherInfo.weather_code;
                let weatherString = '맑음';
                if (weatherCode >= 71 && weatherCode <= 77) weatherString = '눈';
                else if (weatherCode >= 61) weatherString = '비';

                const inputs = {
                    visitors,
                    isElderlyMajorityGroup,
                    weather: weatherString,
                    temperature: weatherInfo.temperature_2m,
                    time: new Date(),
                };
                
                const results = recommendMenus(inputs);
                
                if (results && results.length > 0) {
                    const randomIndex = Math.floor(Math.random() * results.length);
                    const randomMenu = results[randomIndex];
                    setRecommendedMenu(randomMenu);
                }
            }
        };

        runRecommendationEngine();
        
        return () => clearInterval(timer);
    }, [visitors, isElderlyMajorityGroup, weatherInfo]);


    const getWeatherIcon = () => {
        let iconSrc = sunIcon;
        if (weatherInfo) {
            const code = weatherInfo.weather_code;
            if (code >= 71 && code <= 77) iconSrc = snowIcon;
            else if (code >= 61 && code <= 95) iconSrc = rainIcon;
            else if (code > 2) iconSrc = cloudIcon;
        }
        return <img src={iconSrc} alt="날씨 아이콘" style={{ width: '100%', height: '100%' }} />;
    };

    if (!recommendedMenu || weatherError || !visitors || visitors.length === 0) {
        return (
            <div className="loading-container">
                <p>{weatherError || "고객님께 가장 잘 맞는 메뉴를 찾고 있어요..."}</p>
                <div className="loading-indicator">
                    <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                </div>
            </div>
        );
    }
    
    const imageSrc = menuImageMap[recommendedMenu.image] || `https://placehold.co/400x300/f0f4f0/333333?text=Image+Not+Found`;

    return (
        <div className="recommendation-page">
            <header className="header">
                 <div className="weather-icon">{getWeatherIcon()}</div>
                <div className="time-info">
                    <span className="time">{time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                </div>
            </header>

            <main className="recommendation-card">
                <span className="greeting">당신을 위한 AI의 깜짝 추천!</span>
                <p className="sub-title">오늘 이런 메뉴는 어떠세요?</p>
                <img
                    src={imageSrc}
                    alt={recommendedMenu.name}
                    className="food-image"
                />
                <p className="menu-title">
                    <strong>{recommendedMenu.name}</strong>
                    <span> ({recommendedMenu.finalType})</span>
                </p>
                <p className="menu-reason">
                    "{recommendedMenu.reasons && recommendedMenu.reasons.length > 0 ? recommendedMenu.reasons[0] : "AI가 강력 추천하는 메뉴!"}"
                </p>
            </main>
            
            <footer className="instructions">
                <p>결제를 원하시면 손바닥을 펴거나 손을 위아래로 움직여주세요.</p>
                <p>메뉴판을 보려면 주먹을 쥐거나 손을 좌우로 움직여주세요.</p>
                <div className="hand-icon">🖐️/✊</div>
                {gesture && <p className="gesture-feedback">감지된 제스처: {gesture}</p>}
            </footer>
        </div>
    );
}

export default Recommendation;