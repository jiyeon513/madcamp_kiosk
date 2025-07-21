// src/components/handleGesture.js

import {
    GestureRecognizer,
    FilesetResolver
} from "@mediapipe/tasks-vision";

// --- 제스처 인식기 설정 및 관리 ---
let gestureRecognizer = null;

// 움직임(Swipe) 감지용 변수
let lastDirection = null;
let directionChangeCount = 0;
let lastPosition = null;
const MOVEMENT_THRESHOLD = 0.08;
const CONSECUTIVE_FRAMES_THRESHOLD = 3;

// 정적(Static) 제스처 감지용 변수
let lastStaticGesture = null;
let staticGestureCount = 0;
const STATIC_GESTURE_CONFIDENCE_THRESHOLD = 0.8;
const STATIC_GESTURE_FRAMES_THRESHOLD = 5;


/**
 * MediaPipe GestureRecognizer를 초기화하고 생성합니다.
 * @returns {Promise<void>}
 */
async function setupGestureRecognizer() {
    if (gestureRecognizer) return Promise.resolve();

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        console.log("Gesture Recognizer가 성공적으로 초기화되었습니다.");
        return Promise.resolve();
    } catch (error) {
        console.error("Gesture Recognizer 초기화 실패:", error);
        return Promise.reject(error);
    }
}

/**
 * 비디오 프레임에서 손 제스처를 감지하고 방향을 분석합니다.
 * @param {HTMLVideoElement} video - 웹캠 비디오 요소
 * @param {number} timestamp - 현재 비디오의 타임스탬프
 * @param {function(string): void} onGestureDetected - 제스처가 감지되었을 때 호출될 콜백 함수
 */
function detectGesture(video, timestamp, onGestureDetected) {
    if (!gestureRecognizer || !video || video.paused || video.ended) {
        return;
    }

    const results = gestureRecognizer.recognizeForVideo(video, timestamp);
    let gestureHandled = false;

    // --- 1. 정적 제스처 감지 (주먹 쥐기, 손바닥 펴기) ---
    if (results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
        const topGesture = results.gestures[0][0];
        // 디버깅 로그: 감지된 모든 상위 제스처와 점수를 출력
        console.log(`[Debug] Gesture: ${topGesture.categoryName}, Score: ${topGesture.score.toFixed(2)}`);

        if (topGesture.score > STATIC_GESTURE_CONFIDENCE_THRESHOLD) {
            const gestureName = topGesture.categoryName;
            
            if (gestureName === 'Open_Palm' || gestureName === 'Closed_Fist') {
                if (gestureName === lastStaticGesture) {
                    staticGestureCount++;
                } else {
                    lastStaticGesture = gestureName;
                    staticGestureCount = 1;
                }

                if (staticGestureCount >= STATIC_GESTURE_FRAMES_THRESHOLD) {
                    onGestureDetected(gestureName.toLowerCase().replace('_', '-')); // open_palm, closed_fist
                    gestureHandled = true;
                    // 인식 후 초기화
                    staticGestureCount = 0;
                    lastStaticGesture = null;
                }
            } else {
                lastStaticGesture = null;
                staticGestureCount = 0;
            }
        }
    } else {
        lastStaticGesture = null;
        staticGestureCount = 0;
    }

    // --- 2. 움직임 제스처 감지 (상하좌우) ---
    if (!gestureHandled && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const wrist = landmarks[0];

        if (lastPosition) {
            const deltaX = wrist.x - lastPosition.x;
            const deltaY = wrist.y - lastPosition.y;

            let currentDirection = null;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > MOVEMENT_THRESHOLD) currentDirection = 'right';
                else if (deltaX < -MOVEMENT_THRESHOLD) currentDirection = 'left';
            } else {
                if (deltaY > MOVEMENT_THRESHOLD) currentDirection = 'down';
                else if (deltaY < -MOVEMENT_THRESHOLD) currentDirection = 'up';
            }

            if (currentDirection && currentDirection === lastDirection) {
                directionChangeCount++;
            } else {
                directionChangeCount = 1;
            }

            if (directionChangeCount >= CONSECUTIVE_FRAMES_THRESHOLD) {
                if (onGestureDetected) {
                    onGestureDetected(currentDirection);
                }
                directionChangeCount = 0;
            }
            
            lastDirection = currentDirection;
        }

        lastPosition = wrist;
    } else if (!results.landmarks || results.landmarks.length === 0) {
        // 손이 감지되지 않으면 모든 추적 상태 초기화
        lastPosition = null;
        lastDirection = null;
        directionChangeCount = 0;
        lastStaticGesture = null;
        staticGestureCount = 0;
    }
}

export {
    setupGestureRecognizer,
    detectGesture
};
