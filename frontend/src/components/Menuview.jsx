import React, { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import './Menuview.css'; // 스타일시트 임포트
import { menuData } from './menuData'; // menuData 임포트
import { menuImageMap } from '../assets/imageLoader';


const MenuView = () => {
    // 💡 3D 모델 프리로딩 로직을 다시 활성화합니다.
    // 이 로직은 사용자가 메뉴 목록을 보는 동안, 상세 페이지에 필요한
    // 모든 3D 모델을 백그라운드에서 미리 다운로드하여 캐시에 저장합니다.
    useEffect(() => {
        const modelsToPreload = menuData
            .filter(item => item.image_3d)
            // MenuDetail의 경로 처리 방식과 일관되게 절대 경로로 만듭니다.
            .map(item => `/${item.image_3d.replace(/^\//, '')}`);
        
        modelsToPreload.forEach(path => {
            useGLTF.preload(path);
        });

        console.log("Preloading 3D models in the background:", modelsToPreload);
    }, []);

    // 예시로 '카페 아메리카노' 메뉴를 찾습니다.
    const americano = menuData.find(item => item.id === 'americano');

    // HOT 음료 이미지 경로를 가져옵니다.
    const imageUrl = americano && americano.images ? menuImageMap[americano.images.HOT] : '';

    return (
        <div className="menu-view-container">
            <div className="menu-item-card">
                <div className="question-text">Coffee</div>
                {imageUrl && <img src={imageUrl} alt={americano.name} className="menu-item-image" />}
                <div className="menu-item-name">{americano ? americano.name : '메뉴 없음'}</div>
                <div className="menu-item-price">{americano ? `${americano.price.toLocaleString()}원` : ''}</div>
            </div>
            <div className="look-down-text">
                Look Down for Tea !
                <div className="eye-icons">                    <div className="eye"></div>
                    <div className="eye"></div>
                </div>
            </div>
        </div>
    );
};

export default MenuView;
