import React, { useRef, useState, useEffect } from 'react';
import { ProductData, CardBenefit, CARD_BENEFITS, PopMode } from './types';

interface PopCardProps {
  product: ProductData;
  cardBenefit: CardBenefit;
  popMode?: PopMode;
  onToggleAllCare?: (id: string) => void;
}

interface PreedPlanInfo {
  code: '72' | '90' | '108';
  shortLabel: string;        // '플러스72' | '플러스90' | '플러스108'
  badgeTitle: string;        // '플러스72 (360만원)' | '플러스90 (450만원)' | '플러스108 (540만원)'
  monthlyDiscount: number;   // 월 추가 지원금
  monthlyDepositMan: number; // 월 상조 납입금(만원 단위: 4 | 5 | 6)
}

function getAutoPreedPlan(period: number, cardPerceivedPrice: number): PreedPlanInfo {
  // 1. 60개월 구독은 금액 무관 무조건 플러스90 (월 15,000원 지원) 고정
  if (period === 60) {
    return {
      code: '90',
      shortLabel: '플러스90',
      badgeTitle: '플러스90 (450만원)',
      monthlyDiscount: 15000,
      monthlyDepositMan: 5,
    };
  }

  // 2. 36개월 구독: 제휴카드 적용 후 혜택가(cardPerceivedPrice) 기준 자동 분기
  // - 월 30,000원 초과(이상) -> 플러스 108 (월 30,000원 지원)
  if (cardPerceivedPrice >= 30000) {
    return {
      code: '108',
      shortLabel: '플러스108',
      badgeTitle: '플러스108 (540만원)',
      monthlyDiscount: 30000,
      monthlyDepositMan: 6,
    };
  }
  // - 월 25,000원 이상 ~ 30,000원 미만 -> 플러스 90 (월 25,000원 지원)
  if (cardPerceivedPrice >= 25000) {
    return {
      code: '90',
      shortLabel: '플러스90',
      badgeTitle: '플러스90 (450만원)',
      monthlyDiscount: 25000,
      monthlyDepositMan: 5,
    };
  }
  // - 월 20,000원 이상 ~ 25,000원 미만 (및 그 이하 기본값) -> 플러스 72 (월 20,000원 지원)
  return {
    code: '72',
    shortLabel: '플러스72',
    badgeTitle: '플러스72 (360만원)',
    monthlyDiscount: 20000,
    monthlyDepositMan: 4,
  };
}

export default function PopCard({
  product,
  cardBenefit,
  popMode = 'standard',
  onToggleAllCare,
}: PopCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const availableWidth = entry.contentRect.width;
        const targetWidth = 561.26; // 148.5mm in pixels at 96 DPI
        setScale(availableWidth < targetWidth ? availableWidth / targetWidth : 1);
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 60개월 구독은 무조건 롯데카드로 강제 세팅
  const is60Months = product.period === 60;
  const activeCardBenefit = is60Months 
    ? (CARD_BENEFITS.find(c => c.name.includes('롯데')) || cardBenefit)
    : cardBenefit;

  const perceivedPrice = Math.max(0, product.monthlyFee - activeCardBenefit.discount);
  
  // 계산된 계약금 및 최종 혜택가 (유저 요청)
  const calculatedDownPayment = product.monthlyFee * product.period;
  const totalBenefitPrice = perceivedPrice * product.period;

  // 상조모드(popMode === 'preed') 전용 1안·2안 계산
  const plan1Monthly = perceivedPrice;
  const plan1Total = plan1Monthly * product.period;
  const preedPlan = getAutoPreedPlan(product.period, plan1Monthly);
  const plan2Monthly = Math.max(0, plan1Monthly - preedPlan.monthlyDiscount);
  const plan2Total = plan2Monthly * product.period;

  // 롯데하이마트 구독 가전의 무상 A/S 보증기간은 구독 개월수(36/60개월)와 무관하게 무조건 5년 무상 A/S 고정
  const warrantyYears = '5';
  const cleanCareServiceText = product.careServiceText
    ? product.careServiceText.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1')
    : '';
  const cleanCareServiceDetail = product.careServiceDetail
    ? product.careServiceDetail.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1')
    : '';

  if (popMode === 'preed') {
    return (
      <div ref={containerRef} className="w-full flex justify-center print:w-full print:h-full">
        <div
          className="relative print:!w-full print:!h-full"
          style={{ width: `${561.26 * scale}px`, height: `${793.7 * scale}px` }}
        >
          <div
            className="w-[148.5mm] h-[210mm] border-8 border-slate-800 bg-white px-[22px] pt-[18px] pb-[16px] flex flex-col justify-between shadow-lg box-border shrink-0 origin-top-left absolute top-0 left-0 print:!relative print:!transform-none print:w-full print:h-full print:border-[6px] print:shadow-none print:m-0"
            style={{ transform: `scale(${scale})` }}
          >
            {/* [1단] 최상단 바 & 메인 타이틀 영역 */}
            <div className="text-center">
              <div className="flex items-center justify-between mb-1.5">
                {/* 좌측: 슬림 캡슐형 5년 무상 A/S 배지 */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-600 text-white rounded-full px-2.5 py-1 border border-blue-300 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-5 h-5 rounded-full bg-yellow-300 text-blue-900 font-black text-xs flex items-center justify-center shrink-0">
                    {warrantyYears}
                  </span>
                  <span className="text-[11px] font-black tracking-tight whitespace-nowrap">
                    <span className="text-yellow-300">{warrantyYears}년 무상 A/S</span> 안심보장
                  </span>
                </div>

                {/* 중앙: 노란 별 5개 */}
                <div className="flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* 우측: 화면용 올케어 ON/OFF 토글 버튼(no-print) 및 NEW / UPDATE 배지(no-print) */}
                <div className="flex items-center gap-1 justify-end min-w-[90px]">
                  {product.isAllCare ? (
                    <button
                      type="button"
                      onClick={() => onToggleAllCare?.(product.id)}
                      title="클릭하여 올케어 적용 해제"
                      className="bg-indigo-800 hover:bg-indigo-900 text-yellow-300 px-2 py-0.5 rounded-full text-[10px] font-black no-print shadow-sm flex items-center gap-1 border border-indigo-600 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>🛡️</span>
                      <span>올케어 적용됨</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleAllCare?.(product.id)}
                      title="클릭하여 올케어 적용"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold no-print shadow-sm flex items-center gap-1 border border-slate-300 transition-colors opacity-80 hover:opacity-100 cursor-pointer whitespace-nowrap"
                    >
                      <span>+</span>
                      <span>올케어</span>
                    </button>
                  )}
                  {product.changeStatus === 'new' && (
                    <div className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold no-print shadow-sm whitespace-nowrap">
                      NEW 새로추가
                    </div>
                  )}
                  {product.changeStatus === 'changed' && (
                    <div className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold no-print shadow-sm whitespace-nowrap">
                      UPDATE 가격변동
                    </div>
                  )}
                </div>
              </div>

              {/* 메인 타이틀 */}
              <h1 className="text-[30px] font-black text-slate-800 tracking-tight leading-tight">
                구독하면 <span className="text-blue-700 italic text-[36px]">더!</span> 합리적인 선택
              </h1>

              {/* 타이틀 바로 아래 서브 배너 */}
              {product.isAllCare ? (
                <div className="mt-1.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-1.5 rounded-xl shadow-md border-2 border-amber-400 inline-flex items-center justify-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black tracking-tight">
                    올케어 혜택
                  </span>
                  <span className="text-[13.5px] font-black text-amber-300 tracking-tight">
                    사용중인 가전 2년 수리비 보증 서비스
                  </span>
                </div>
              ) : (
                <div className="mt-1.5 bg-slate-800 text-white inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
                  <span className="text-yellow-400 mr-2">초기 비용 부담 ZERO!</span>
                  <span className="border-l border-slate-500 pl-2">
                    초기 부담 없이 바로 시작하세요!
                  </span>
                </div>
              )}
            </div>

            {/* [2단] 제품 스펙 4칸 요약 바 */}
            <div className="grid grid-cols-[1.45fr_0.72fr_0.95fr_0.95fr] gap-2">
              {/* 1칸: 제품 모델명 */}
              <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2.5 px-2 text-center min-h-[64px] flex flex-col justify-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 flex-wrap">
                  {product.category && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-1.5 py-0.5 rounded leading-tight">
                      [{product.category}]
                    </span>
                  )}
                  <span className="text-[10.5px] text-slate-500 font-bold">
                    🏷️ 제품 모델명
                  </span>
                </div>
                <div className="text-[13px] font-black text-slate-800 break-all leading-tight">
                  {product.modelName}
                </div>
              </div>

              {/* 2칸: 구독기간 */}
              <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2.5 px-2 text-center min-h-[64px] flex flex-col justify-center">
                <div className="text-[10.5px] text-slate-500 font-bold mb-0.5">
                  ⏳ 구독기간
                </div>
                <div className="text-[15px] font-black text-slate-800">
                  {product.period}개월
                </div>
              </div>

              {/* 3칸: 구독원금 */}
              <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2.5 px-2 text-center min-h-[64px] flex flex-col justify-center">
                <div className="text-[10.5px] text-slate-500 font-bold mb-0.5">
                  💰 구독원금
                </div>
                <div className="text-[15px] font-black text-slate-800">
                  {formatNumber(calculatedDownPayment)}원
                </div>
              </div>

              {/* 4칸: 월 구독료 */}
              <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2.5 px-2 text-center min-h-[64px] flex flex-col justify-center">
                <div className="text-[10.5px] text-slate-500 font-bold mb-0.5">
                  🗓️ 월 구독료
                </div>
                <div className="text-[15.5px] font-black text-blue-700">
                  {formatNumber(product.monthlyFee)}원
                </div>
              </div>
            </div>

            {/* [3단] 케어 서비스 2칸 나란히 배치 */}
            <div className="grid grid-cols-2 gap-2.5 h-[112px]">
              {/* 좌측 박스: 구독 케어 서비스 */}
              <div className="border-[1.5px] border-slate-800 rounded-[10px] overflow-hidden flex flex-col bg-white">
                <div className="bg-slate-800 text-white text-center py-1.5 font-extrabold text-[11px]">
                  구독 케어 서비스
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-slate-800 truncate">
                      {cleanCareServiceText || '안심케어 (방문점검)'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {product.careServiceCycle && (
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {/^\d+$/.test(product.careServiceCycle.trim())
                            ? `${product.careServiceCycle}개월 주기`
                            : product.careServiceCycle}
                        </span>
                      )}
                      {product.careServiceCount && (
                        <span className="bg-slate-100/70 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {/^\d+$/.test(product.careServiceCount.trim())
                            ? `총 ${product.careServiceCount}회`
                            : product.careServiceCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] gap-1">
                    <span className="text-slate-500 font-bold shrink-0">서비스 내용</span>
                    <span className="text-blue-700 font-extrabold text-right truncate">
                      {cleanCareServiceDetail || '5년 무상 A/S + 정기 케어'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 우측 박스: 올케어 여부에 따라 분기 */}
              {product.isAllCare ? (
                <div className="border-[1.5px] border-indigo-900 rounded-[10px] overflow-hidden flex flex-col bg-indigo-50/30">
                  <div className="bg-indigo-950 text-amber-300 text-center py-1.5 font-extrabold text-[11px]">
                    🛡️ 사용중 가전 2년 보증
                  </div>
                  <div className="px-2.5 py-2 flex-1 flex flex-col justify-between text-[10px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-indigo-950 font-black shrink-0">· 대상가전:</span>
                      <span className="font-extrabold text-blue-800 text-right">
                        총 34개 품목 (대형8·생활21·IT5)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-indigo-950 font-black shrink-0">· 보증/한도:</span>
                      <span className="font-extrabold text-slate-800 text-right">
                        2년(면책60일) · 연 100만원(총200만)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-indigo-950 font-black shrink-0">· 1회 자부담:</span>
                      <span className="font-black text-red-600 text-right">
                        5,000원 <span className="text-slate-600 font-bold">(10년 이상 5만원)</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-[1.5px] border-slate-800 rounded-[10px] overflow-hidden flex flex-col bg-white">
                  <div className="bg-slate-800 text-white text-center py-1.5 font-extrabold text-[11px]">
                    카드 사용 꿀팁!
                  </div>
                  <div className="p-2.5 flex-1 grid grid-cols-2 gap-x-2 gap-y-1.5 items-center text-[10.5px]">
                    {[
                      '개인 보험 자동이체',
                      '휴대폰 요금 자동이체',
                      '학원비 자동이체',
                      '생활비 결제',
                    ].map((tip, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3 text-blue-600 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="font-bold text-slate-700 whitespace-nowrap">
                          {tip}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* [4단] 중앙 메인 비교 영역: 선택 1안 vs 선택 2안 */}
            <div className="grid grid-cols-2 gap-3.5 mt-2.5 relative">
              {/* 정중앙 VS 원형 배지 */}
              <div className="absolute top-[53%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[34px] h-[34px] rounded-full bg-slate-900 text-yellow-400 border-[2.5px] border-white shadow-md flex items-center justify-center text-[11px] font-black">
                VS
              </div>

              {/* 좌측 카드 [선택 1안 · 제휴카드만] */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-xl pt-[18px] pb-[10px] px-3 relative flex flex-col items-center justify-between gap-1.5">
                <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-slate-800 text-white font-black px-4 py-1 rounded-full text-[12.5px] border-2 border-white shadow-sm whitespace-nowrap">
                  💳 선택 1안 · 제휴카드만
                </div>

                {/* 상단 화이트 내역 박스 */}
                <div className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">기본 월 구독료</span>
                    <span className="font-extrabold text-slate-800">
                      월 {formatNumber(product.monthlyFee)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">
                      (-) {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="font-black text-blue-600">
                      월 -{formatNumber(activeCardBenefit.discount)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-400">(-) 상조서비스 결합</span>
                    <span className="font-bold text-slate-400">선택안함</span>
                  </div>
                </div>

                {/* 중앙 체감가 영역 */}
                <div className="text-center py-0.5">
                  <div className="text-[14.5px] font-extrabold text-slate-700">
                    1안 월 체감가
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span className="text-[56px] leading-[1.02] font-black text-slate-900 tracking-tighter">
                      {formatNumber(plan1Monthly)}
                    </span>
                    <span className="text-[20px] font-black text-slate-900 ml-1">원</span>
                  </div>
                </div>

                {/* 하단 총 체감가 바 */}
                <div className="w-full bg-slate-200 text-slate-700 rounded-[7px] py-1.5 px-2 text-center text-[11.5px] font-extrabold">
                  {product.period}개월 총 체감가: {formatNumber(plan1Total)}원
                </div>
              </div>

              {/* 우측 카드 [선택 2안 · 상조서비스 결합] */}
              <div className="bg-rose-50 border-[2.5px] border-rose-600 rounded-xl pt-[18px] pb-[10px] px-3 relative flex flex-col items-center justify-between gap-1.5 shadow-md">
                <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-rose-600 text-white font-black px-4 py-1 rounded-full text-[12.5px] border-2 border-yellow-300 shadow-sm whitespace-nowrap">
                  👑 선택 2안 · 상조서비스 결합
                </div>

                {/* 상단 화이트 내역 박스 */}
                <div className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-1.5 text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">기본 월 구독료</span>
                    <span className="font-extrabold text-slate-800">
                      월 {formatNumber(product.monthlyFee)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">
                      (-) {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="font-black text-blue-600">
                      월 -{formatNumber(activeCardBenefit.discount)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-700">
                      (-) 상조결합 ({preedPlan.shortLabel})
                    </span>
                    <span className="font-black text-rose-600">
                      월 -{formatNumber(preedPlan.monthlyDiscount)}원
                    </span>
                  </div>
                </div>

                {/* 중앙 체감가 영역 */}
                <div className="text-center py-0.5">
                  <div className="text-[14.5px] font-black text-rose-700">
                    2안 월 최대 체감가 ✨
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span className="text-[56px] leading-[1.02] font-black text-red-600 tracking-tighter">
                      {formatNumber(plan2Monthly)}
                    </span>
                    <span className="text-[20px] font-black text-red-600 ml-1">원</span>
                  </div>
                </div>

                {/* 하단 총 체감가 바 */}
                <div className="w-full bg-rose-700 text-white rounded-[7px] py-1.5 px-2 text-center text-[11.5px] font-black">
                  {product.period}개월 총 체감가:{' '}
                  <span className="text-yellow-300">{formatNumber(plan2Total)}원</span>
                </div>
              </div>
            </div>

            {/* [5단] 최하단 다크 요약 배너 + 안내 문구 */}
            <div className="space-y-1">
              <div className="bg-slate-800 rounded-xl py-3 px-3.5 grid grid-cols-[0.88fr_1.12fr] gap-2.5 text-white">
                {/* 좌측 컬럼: 제휴카드 요약 */}
                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
                    <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap shrink-0">
                      {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="text-yellow-400 font-black text-[12.5px] tracking-tight whitespace-nowrap shrink-0">
                      월 {formatNumber(activeCardBenefit.discount)}원 {activeCardBenefit.benefitType}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[9px] font-bold tracking-tight whitespace-nowrap">
                    전월 30만원↑ 이용 시 매월 지급 (총{' '}
                    {Math.round((activeCardBenefit.discount * product.period) / 10000)}만원)
                  </div>
                </div>

                {/* 우측 컬럼: 상조결합 요약 */}
                <div className="border-l border-slate-600 pl-2.5 flex flex-col justify-center gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
                    <span className="bg-rose-600 text-yellow-300 text-[9px] px-1.5 py-0.5 rounded font-black whitespace-nowrap shrink-0">
                      {preedPlan.badgeTitle}
                    </span>
                    <span className="text-yellow-400 font-black text-[12.5px] tracking-tight whitespace-nowrap shrink-0">
                      월 {formatNumber(preedPlan.monthlyDiscount)}원 추가지원
                    </span>
                  </div>
                  <div className="text-slate-300 text-[9px] font-bold tracking-tight whitespace-nowrap">
                    90회 납입(월{preedPlan.monthlyDepositMan}만)+30회 거치 ·{' '}
                    <span className="text-yellow-300 font-black">
                      120회 만기 전액환급(미이용시)
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-400 text-center font-semibold">
                ※ 본 상품은 구독 서비스 상품으로, 중도 해지 시 위약금이 발생할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full flex justify-center print:w-full print:h-full">
      {/* Screen scale wrapper: reserves space on screen, transparent on print */}
      <div 
        className="relative print:!w-full print:!h-full"
        style={{ width: `${561.26 * scale}px`, height: `${793.7 * scale}px` }}
      >
        <div 
          className="w-[148.5mm] h-[210mm] bg-white border-8 border-slate-800 px-6 pt-6 pb-10 print:px-5 print:pt-5 print:pb-8 flex flex-col shadow-lg box-border shrink-0 origin-top-left absolute top-0 left-0 print:!relative print:!transform-none print:w-full print:h-full print:border-[6px] print:shadow-none print:m-0"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Top Section */}
          <div className="text-center mb-2">
        <div className="flex justify-center gap-1 mb-1">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        
        {/* All-Care Badge (Screen toggleable) */}
        {product.isAllCare ? (
          <button
            type="button"
            onClick={() => onToggleAllCare?.(product.id)}
            title="클릭하여 올케어 적용 해제"
            className="absolute top-4 left-4 bg-indigo-800 hover:bg-indigo-900 text-yellow-300 px-2.5 py-1 rounded-full text-xs font-black no-print shadow-sm flex items-center gap-1 border border-indigo-600 transition-colors cursor-pointer"
          >
            <span>🛡️</span>
            <span>올케어 적용됨</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleAllCare?.(product.id)}
            title="클릭하여 올케어 적용"
            className="absolute top-4 left-4 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-700 px-2 py-1 rounded-full text-xs font-bold no-print shadow-sm flex items-center gap-1 border border-slate-300 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
          >
            <span>+</span>
            <span>올케어</span>
          </button>
        )}

        {/* Status Badge (Only visible on screen, hidden on print) */}
        {product.changeStatus === 'new' && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold no-print shadow-sm">
            NEW 새로추가
          </div>
        )}
        {product.changeStatus === 'changed' && (
          <div className="absolute top-4 right-4 bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold no-print shadow-sm">
            UPDATE 가격변동
          </div>
        )}

        <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
          구독하면 <span className="text-blue-700 italic text-4xl">더!</span> 합리적인 선택
        </h1>
        {product.isAllCare ? (
          <div className="mt-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2 rounded-xl shadow-md border-2 border-amber-400 inline-flex items-center justify-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black tracking-tight">올케어 혜택</span>
            <span className="text-[13.5px] font-black text-amber-300 tracking-tight">
              사용중인 가전 2년 수리비 보증 서비스
            </span>
          </div>
        ) : (
          <div className="mt-2 bg-slate-800 text-white inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
            <span className="text-yellow-400 mr-2">초기 비용 부담 ZERO!</span>
            <span className="border-l border-slate-500 pl-2">초기 부담 없이 바로 시작하세요!</span>
          </div>
        )}
      </div>

      {/* Main Price Box */}
      <div className="border-2 border-slate-200 rounded-xl mt-4 p-3 relative flex-1 flex flex-col items-center justify-center bg-slate-50">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-900 font-bold px-6 py-1.5 rounded-full text-base flex items-center shadow-md border-2 border-white whitespace-nowrap">
          <span className="mr-2 text-lg">💳</span> 제휴카드 적용 시
        </div>
        
        <h2 className="text-xl font-bold text-slate-700 mb-0 mt-3">월 체감가 ✨</h2>
        <div className="flex items-end text-red-600 font-black tracking-tighter">
          <span className="text-[4.8rem] leading-none">{formatNumber(perceivedPrice)}</span>
          <span className="text-2xl mb-2 ml-2">원</span>
        </div>
        
        
        <p className="text-[10px] text-slate-500 mt-1 font-medium">※ 월 30만원 사용 기준</p>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="border border-slate-200 rounded-lg p-3 text-center bg-white shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-center gap-1">
            <span>🗓️</span> 월 구독료
          </div>
          <div className="font-extrabold text-slate-800 text-lg">{formatNumber(product.monthlyFee)}원</div>
        </div>
        <div className="border border-slate-200 rounded-lg p-3 text-center bg-white shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-center gap-1">
            <span>⏳</span> 구독기간
          </div>
          <div className="font-extrabold text-slate-800 text-lg">{product.period}개월</div>
        </div>
        <div className="border border-slate-200 rounded-lg p-2 text-center bg-white shadow-sm flex flex-col justify-center min-h-[64px]">
          {/* 품목명: 제품 모델명 제목 윗줄에 배치 */}
          {product.category && (
            <div className="mb-0.5">
              <span className="inline-block bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-black leading-tight break-words max-w-full">
                [{product.category}]
              </span>
            </div>
          )}
          <div className="text-[10px] font-bold text-slate-500 mb-0.5 flex items-center justify-center gap-1">
            <span>🏷️</span> 제품 모델명
          </div>
          <div className="font-bold text-slate-800 text-[11px] break-all leading-tight">
            {product.modelName}
          </div>
        </div>
      </div>

      {/* Card Benefit Banner */}
      <div className="mt-4 bg-slate-800 rounded-xl p-4 flex items-center justify-between shadow-md">
        <div className="flex flex-col w-24">
          <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold self-start mb-1 text-center w-full">{activeCardBenefit.name.replace('카드', '제휴카드')}</span>
          <span className="text-slate-300 text-[10px] font-medium text-center">월 30만원 사용 시</span>
        </div>
        <div className="text-center flex-1">
          <div className="text-yellow-400 font-black text-[1.7rem] leading-none tracking-tight">
            {formatNumber(activeCardBenefit.discount)}원 {activeCardBenefit.benefitType}
          </div>
          <div className="text-slate-300 text-[10px] mt-1.5 font-bold">매월 {activeCardBenefit.benefitType}으로 지급!</div>
        </div>
      </div>

      {/* 3 Bottom Boxes */}
      <div className="grid grid-cols-3 gap-2 mt-4 h-36">
        {/* Box 1 */}
        <div className="border border-slate-800 rounded-lg overflow-hidden flex flex-col text-[10px]">
          <div className="bg-slate-800 text-white text-center py-1.5 font-bold">구독 케어 서비스</div>
          <div className="p-2 flex-1 flex flex-col justify-start gap-1">
            {/* 명칭, 주기, 횟수 등을 가독성 있게 구조화 */}
            {(cleanCareServiceText || product.careServiceCycle || product.careServiceCount || product.careServiceBenefit) && (
              <div className="border-b border-slate-200 pb-1.5">
                {cleanCareServiceText && (
                  <div className="font-bold text-slate-800 break-words leading-tight mb-1">
                    {cleanCareServiceText}
                  </div>
                )}
                {(product.careServiceCycle || product.careServiceCount || product.careServiceBenefit) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.careServiceCycle && (
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {/^\d+$/.test(product.careServiceCycle.trim()) ? `${product.careServiceCycle}개월 주기` : product.careServiceCycle}
                      </span>
                    )}
                    {product.careServiceCount && (
                      <span className="bg-slate-100/70 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {/^\d+$/.test(product.careServiceCount.trim()) ? `총 ${product.careServiceCount}회` : product.careServiceCount}
                      </span>
                    )}
                    {product.careServiceBenefit && (
                      <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {product.careServiceBenefit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* 상세 내용 (데미지 케어 1년, 소모품 배송 등) */}
            {(cleanCareServiceDetail || (!cleanCareServiceText && !product.careServiceCycle && !product.careServiceCount && !product.careServiceBenefit && !cleanCareServiceDetail)) && (
              <div className="flex flex-col mt-0.5">
                <span className="text-slate-500 mb-0.5 text-[9px]">서비스 내용</span>
                <span className="font-bold text-blue-700 break-words leading-tight text-[10px]">
                  {cleanCareServiceDetail || '해당없음'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Box 2 */}
        <div className="border border-slate-800 rounded-lg overflow-hidden flex flex-col text-[10px]">
          <div className="bg-slate-800 text-white text-center py-1.5 font-bold">
            {warrantyYears}년 무상 A/S
          </div>
          <div className="p-2 flex-1 flex flex-col items-center justify-center text-center">
            
            {/* 깔끔하고 큼직한 원형 뱃지 */}
            <div className="w-14 h-14 bg-blue-800 text-white rounded-full flex flex-col items-center justify-center border-2 border-dashed border-blue-400 mb-1.5 shadow-sm">
              <span className="text-2xl font-black leading-none">{warrantyYears}</span>
              <span className="text-[9px] font-bold mt-0.5">YEARS</span>
            </div>
            <div className="font-bold text-slate-700 leading-tight text-[11px]">
              <span className="text-blue-800 font-extrabold">{warrantyYears}년간 무상 A/S</span>로<br/>안심하고 사용하세요!
            </div>
          </div>
        </div>

        {/* Box 3 */}
        {product.isAllCare ? (
          <div className="border border-indigo-900 rounded-lg overflow-hidden flex flex-col text-[10px] bg-indigo-50/20">
            <div className="bg-indigo-950 text-amber-300 text-center py-1 font-bold flex items-center justify-center gap-1">
              <span>🛡️</span>
              <span>사용중 가전 2년 보증</span>
            </div>
            <div className="p-1.5 flex-1 flex flex-col justify-between text-[8.5px] leading-tight">
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-indigo-900 font-black shrink-0">· 대상가전:</span>
                  <span className="font-extrabold text-blue-800">총 34개 품목</span>
                </div>
                <div className="text-[7.5px] text-slate-600 pl-2 leading-none mt-0.5 font-medium">
                  (대형 8개, 생활/주방 21개, IT 5개)
                </div>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-indigo-900 font-black shrink-0">· 보증기간:</span>
                <span className="font-extrabold text-slate-800">총 2년 <span className="text-slate-500 font-normal text-[7.5px]">(면책 60일)</span></span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-indigo-900 font-black shrink-0">· 보상한도:</span>
                  <span className="font-extrabold text-slate-800">총 200만원 한도</span>
                </div>
                <div className="text-[7.5px] text-blue-700 pl-2 leading-none mt-0.5 font-bold">
                  (연간 100만원 한도)
                </div>
              </div>
              <div className="border-t border-slate-200 pt-0.5 mt-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-indigo-900 font-black shrink-0">· 1회 자부담:</span>
                  <span className="font-black text-red-600">5,000원</span>
                </div>
                <div className="text-[7px] text-slate-500 font-medium pl-1 leading-none mt-0.5">
                  (제조 10년 이상 상품은 1회 5만원)
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden flex flex-col text-[10px]">
            <div className="bg-slate-800 text-white text-center py-1.5 font-bold">카드 사용 꿀팁!</div>
            <div className="p-3 flex-1 flex flex-col justify-center gap-1.5">
              {['개인 보험 자동이체', '휴대폰 요금 자동이체', '학원비 자동이체', '생활비 결제'].map((tip, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-bold text-slate-700">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Total Summary Ribbon */}
      <div className="mt-3 bg-slate-100 rounded-lg py-1.5 px-4 flex items-center justify-center gap-1.5 text-[11px] border border-slate-200">
        <span className="font-bold text-slate-700">{product.period}개월 총 체감가:</span>
        <span className="font-black text-red-600 text-[13px]">{formatNumber(totalBenefitPrice)}원</span>
        <span className="text-slate-500 font-bold ml-1">(원금 {formatNumber(calculatedDownPayment)}원)</span>
      </div>
      
      <p className="text-[8px] text-slate-400 text-center mt-2 font-medium">
        ※ 본 상품은 구독 서비스 상품으로, 중도 해지 시 위약금이 발생할 수 있습니다.
      </p>
        </div>
      </div>
    </div>
  );
}

