// src/recommendationEngine.js
import { menuData } from './menuData';

// 메뉴의 대표 카테고리를 반환하는 함수 (커피, 티, 기타)
const getMajorCategory = (tags) => {
  if (tags.includes('#카페인') || tags.includes('#카페인(커피)') || tags.includes('#진한커피') || tags.includes('#부드러운커피') || tags.includes('#커피맛')) return '커피';
  if (tags.includes('#티(Tea)')) return '티';
  return '논카페인/기타';
};

/**
 * 방문객 정보, 날씨, 시간대를 기반으로 메뉴를 추천합니다.
 * @param {object} inputs - 추천 로직에 필요한 입력 데이터.
 * @param {Array<object>} inputs.visitors - 감지된 방문객 정보 배열.
 *   - {number} age - 나이
 *   - {string} gender - 성별
 *   - {string} expressions - 대표 감정
 * @param {boolean} inputs.isElderlyMajorityGroup - 노인 과반수 그룹 여부.
 * @param {string} inputs.weather - 현재 날씨 (예: '맑음', '비')
 * @param {number} inputs.temperature - 현재 온도
 * @param {Date} inputs.time - 현재 시간
 * @returns {Array<object>} 추천 메뉴 3개의 배열.
 */
export const recommendMenus = (inputs) => {
  const { visitors, isElderlyMajorityGroup, weather, temperature, time } = inputs;
  const hour = time.getHours();

  // 1. 방문객 데이터 분석
  const groupSize = visitors.length || 1; // 0으로 나누는 것을 방지
  const averageAge = visitors.reduce((sum, v) => sum + v.age, 0) / groupSize;
  const hasChildren = visitors.some(v => v.age < 15);
  const maleCount = visitors.filter(v => v.gender === 'male').length;
  const femaleCount = groupSize - maleCount;
  let dominantGender = 'mixed';
  if (maleCount / groupSize >= 0.7) dominantGender = 'male';
  if (femaleCount / groupSize >= 0.7) dominantGender = 'female';
  
  // 2. 음료 메뉴 점수 계산
  const drinkData = menuData.filter(m => !m.type.includes('FOOD'));
  let scoredDrinks = drinkData.map(menu => {
    let score = 0;
    const reasons = [];
    const tempPreference = temperature >= 20 ? 'ICED' : 'HOT';

    // 기본 점수: 온도/날씨
    if (weather === '비' || weather === '눈') {
      if (menu.type.includes('HOT')) { score += 25; reasons.push('궂은 날씨엔 따뜻하게'); }
    } else {
      if (menu.type.includes(tempPreference)) { score += 25; reasons.push(tempPreference === 'ICED' ? '더운 날씨엔 시원하게' : '쌀쌀한 날씨엔 따뜻하게');}
    }
    
    // 시간대별 점수
    if (hour >= 7 && hour < 11) {
      if (menu.tags.includes('#카페인') || menu.tags.includes('#고카페인')) { score += 20; reasons.push('오전 카페인 충전'); }
    } else if (hour >= 14 && hour < 17) {
      if (menu.tags.includes('#달콤한') || menu.tags.includes('#디저트음료')) { score += 20; reasons.push('나른한 오후 당 충전'); }
    } else if (hour >= 18) {
      if (menu.tags.includes('#논카페인') || menu.tags.includes('#디카페인 가능')) { score += 20; reasons.push('편안한 저녁'); }
      if (menu.tags.includes('#고카페인')) score -= 30;
    }

    // 방문객 그룹 특성 점수
    if (groupSize > 1) {
      if (menu.tags.includes('#인기') || menu.tags.includes('#기본')) { score += 15; reasons.push(`${groupSize}명이 함께! 무난한 인기 메뉴`); }
    }

    // 연령대별 점수
    if (isElderlyMajorityGroup) {
      if (menu.tags.includes('#부드러운커피') || menu.tags.includes('#티(Tea)')) { score += 25; reasons.push('어르신들께 좋은 부드러운 음료'); }
      if (menu.tags.includes('#고카페인') || menu.tags.includes('#아주달콤')) score -= 15;
    } else if (hasChildren) {
      if (menu.tags.includes('#논카페인') && menu.tags.includes('#달콤한')) { score += 25; reasons.push('아이와 함께! 달콤한 논카페인 음료'); }
      if (menu.tags.includes('#고카페인')) score -= 30;
    } else if (averageAge < 30) {
      if (menu.tags.includes('#디저트음료') || menu.tags.includes('#인기') || menu.tags.includes('#새콤달콤')) { score += 15; reasons.push('젊은 층이 선호하는 인기 메뉴');}
    }
    
    // 성별 점수
    if (dominantGender === 'female') {
      if (menu.tags.includes('#새콤달콤') || menu.tags.includes('#크리미') || menu.tags.includes('#과일')) { score += 10; reasons.push('여성분들이 선호하는 맛');}
    } else if (dominantGender === 'male') {
      if (menu.tags.includes('#진한커피') || menu.tags.includes('#깔끔한')) { score += 10; reasons.push('남성분들이 선호하는 맛'); }
    }

    return { ...menu, score, reasons };
  });
  
  // 3. 점수 순으로 정렬 및 추천 조합 생성
  const sortedDrinks = scoredDrinks.sort((a, b) => b.score - a.score);
  
  if (sortedDrinks.length === 0) return [];

  const recommendations = [];
  const topPick = sortedDrinks[0];
  recommendations.push(topPick);

  // 첫 추천과 다른 카테고리의 메뉴 추가
  const topPickCategory = getMajorCategory(topPick.tags);
  const alternativePick = sortedDrinks.find(
    (drink) => drink.id !== topPick.id && getMajorCategory(drink.tags) !== topPickCategory
  );
  if (alternativePick) {
    recommendations.push(alternativePick);
  }
  
  // 인기 메뉴 중에서 랜덤으로 하나 추가
  const wildcardPool = sortedDrinks.filter(d => d.tags.includes('#인기')).slice(0, 5);
  if (wildcardPool.length > 0) {
    let wildcardPick = wildcardPool[Math.floor(Math.random() * wildcardPool.length)];
    if (wildcardPick && !recommendations.some(rec => rec.id === wildcardPick.id)) {
       recommendations.push(wildcardPick);
    }
  }

  // 추천이 3개 미만이면 점수 순으로 채우기
  let i = 1;
  while (recommendations.length < 3 && i < sortedDrinks.length) {
    const nextBest = sortedDrinks[i];
    if (!recommendations.some(rec => rec.id === nextBest.id)) {
      recommendations.push(nextBest);
    }
    i++;
  }

  // 4. 최종 추천 메뉴의 타입(HOT/ICED)과 이미지 결정
  const tempPreference = temperature >= 20 ? 'ICED' : 'HOT';
  return recommendations.slice(0, 3).map(menu => {
    let finalType = tempPreference;
    if (weather === '비' || weather === '눈') finalType = 'HOT';
    
    // 메뉴가 최종 결정된 타입을 지원하지 않으면, 지원하는 다른 타입으로 변경
    if (!menu.type.includes(finalType)) {
      finalType = menu.type[0]; 
    }

    let finalImage = menu.image; // 단일 타입 메뉴용 (예: 프라푸치노)
    if (menu.images) { // HOT/ICED 둘 다 있는 메뉴용
      finalImage = menu.images[finalType];
    }

    return { ...menu, finalType, image: finalImage };
  });
};