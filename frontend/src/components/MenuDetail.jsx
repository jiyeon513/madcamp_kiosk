import React, { useState, useEffect, Suspense, memo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Preload } from '@react-three/drei';
import { menuData } from './menuData';
import { menuImageMap } from '../assets/imageLoader';
import './MenuDetail.css';

// 안전장치 1: WebGL 지원 여부 확인
const isWebGLAvailable = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) { return false; }
};

// 안전장치 2: Error Boundary
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { console.error("3D 렌더링 에러:", error, errorInfo); }
    render() {
        if (this.state.hasError) { return this.props.fallback; }
        return this.props.children;
    }
}

// 최적화된 3D 씬 컴포넌트
const Model = ({ path }) => {
    // 💡 MenuView에서 미리 로드한 모델을 캐시에서 즉시 가져옵니다.
    const { scene } = useGLTF(path);
    return <primitive object={scene} scale={8} />;
};

const MenuScene = memo(({ modelPath }) => {
    // 💡 1. 렌더러의 상태를 추적하고, 오류 발생 시 복구를 제어하는 상태
    const [isRendererOk, setRendererOk] = useState(true);

    if (!isRendererOk) {
        // 렌더러에 문제가 생기면, 복구될 때까지 로딩 상태를 표시
        return <div className="loading-3d">3D 렌더링 복구 중...</div>;
    }

    return (
        <Suspense fallback={<div className="loading-3d">3D 모델 로딩 중...</div>}>
            <Canvas
                // 💡 2. 렌더러 상태에 따라 렌더링 루프를 동적으로 제어
                frameloop={isRendererOk ? 'always' : 'never'}
                camera={{ position: [0, 0, 15], fov: 50 }}
                gl={{ powerPreference: 'high-performance', antialias: true }}
                // 💡 3. 오류 감지 및 자동 복구 콜백
                onContextLost={(e) => {
                    console.error("🚨 WebGL Context Lost! Pausing rendering.", e);
                    setRendererOk(false);
                }}
                onCreated={(state) => {
                    // onCreated는 캔버스 생성 시, 그리고 컨텍스트 복구 시 호출됩니다.
                    console.log("✅ Canvas created or context restored. Resuming rendering.");
                    setRendererOk(true);
                    // 복구 후 첫 프레임을 강제로 렌더링 요청
                    state.invalidate();
                }}
            >
                <ambientLight intensity={1.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <OrbitControls
                    enableZoom={false}
                    autoRotate
                    autoRotateSpeed={2}
                    enableDamping={true} // 'always' 모드에서는 부드러운 움직임을 위해 true로 설정
                />
                <Model path={modelPath} />
                <Preload all /> 
            </Canvas>
        </Suspense>
    );
});

const categoryMap = { /* ... 카테고리 맵 ... */ };

const MenuDetail = () => {
    const { id } = useParams();
    const [menuItem, setMenuItem] = useState(null);

    useEffect(() => {
        const foundItem = menuData.find(item => item.id.toString() === id);
        setMenuItem(foundItem);
    }, [id]);

    if (!menuItem) { return <div className="loading-container">...</div>; }

    const imageUrl = menuItem.images ? menuImageMap?.[menuItem.images.ICED] || menuImageMap?.[menuItem.images.HOT] : menuImageMap?.[menuItem.image];
    const koreanCategory = menuItem.category ? categoryMap[menuItem.category] : '';
    const modelPath = menuItem.image_3d ? `/${menuItem.image_3d.replace(/^\//, '')}` : null;
    const canRender3D = isWebGLAvailable();
    const fallbackImage = imageUrl && <img src={imageUrl} alt={menuItem.name} className="product-image-2d" />;

    return (
        <div className="detail-page-container">
            {/* ... JSX 레이아웃 ... */}
            <div className="main-image-container">
                {(modelPath && canRender3D) ? (
                    <ErrorBoundary fallback={fallbackImage}>
                        <MenuScene modelPath={modelPath} />
                    </ErrorBoundary>
                ) : (
                    fallbackImage
                )}
            </div>
            {/* ... JSX 레이아웃 ... */}
        </div>
    );
};

export default MenuDetail;