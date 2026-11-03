import React, { useRef, useState, useEffect } from 'react';
import { Printer, FileText, CheckSquare, Square, Maximize2 } from 'lucide-react';
import { ProductData, CardBenefit, CARD_BENEFITS, PopMode, PopPaperSize } from './types';

// 브라우저 직접 인쇄(window.print)용 A3 세로 배율 (418mm 안전 높이 내 중앙 배치)
const A3_PORTRAIT_BROWSER_PRINT_SCALE = 1.9;
const BASE_CARD_WIDTH_PX = 561.26; // 148.5mm @ 96 DPI
const BASE_CARD_HEIGHT_PX = 793.7; // 210.0mm @ 96 DPI

interface PopCardProps {
  product: ProductData;
  cardBenefit: CardBenefit;
  popMode?: PopMode;
  paperSize?: PopPaperSize;
  /** 인쇄/PDF 전용 영역(#print-area) 내부 렌더링 여부 (화면용 편집 버튼 완벽 제거) */
  isPrintSheet?: boolean;
  /** 브라우저 직접 A3 인쇄(window.print) 시 1.9배 확대 적용 여부 (PDF 캡처 시에는 false로 두어 폰트 자간 왜곡 원천 차단) */
  isA3BrowserPrintScale?: boolean;
  isA3Selected?: boolean;
  onToggleAllCare?: (id: string) => void;
  onToggleA3Select?: (id: string) => void;
  onQuickPrintA3?: (product: ProductData) => void;
  onQuickDownloadA3Pdf?: (product: ProductData) => void;
}

interface PreedPlanInfo {
  code: '72' | '90' | '108';
  shortLabel: string;
  badgeTitle: string;
  monthlyDiscount: number;
  monthlyDepositMan: number;
}

function getAutoPreedPlan(period: number, cardPerceivedPrice: number): PreedPlanInfo | null {
  if (period === 60) {
    if (cardPerceivedPrice < 15000) return null;
    return {
      code: '90',
      shortLabel: '플러스90',
      badgeTitle: '플러스90 (450만원)',
      monthlyDiscount: 15000,
      monthlyDepositMan: 5,
    };
  }

  if (cardPerceivedPrice < 20000) return null;

  if (cardPerceivedPrice >= 30000) {
    return {
      code: '108',
      shortLabel: '플러스108',
      badgeTitle: '플러스108 (540만원)',
      monthlyDiscount: 30000,
      monthlyDepositMan: 6,
    };
  }

  if (cardPerceivedPrice >= 25000) {
    return {
      code: '90',
      shortLabel: '플러스90',
      badgeTitle: '플러스90 (450만원)',
      monthlyDiscount: 25000,
      monthlyDepositMan: 5,
    };
  }

  return {
    code: '72',
    shortLabel: '플러스72',
    badgeTitle: '플러스72 (360만원)',
    monthlyDiscount: 20000,
    monthlyDepositMan: 4,
  };
}

/**
 * 전산/엑셀 원본의 내부 접미사(예: '안심케어_1', '케어십_2')를 매장 고객용 표기로 깔끔히 정돈
 */
function normalizeCareLabel(rawText?: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/3년\s*(무상|A\/?S)/gi, '5년 $1')
    .replace(/_+\d+\b/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 긴 케어 명칭이나 서비스 내용을 단어·괄호 중간 절단 없이 읽기 좋게 1~2줄로 분할
 */
function formatSmartCareLines(rawText: string, maxSingleLineLen = 16): string[] {
  const text = (rawText || '').trim().replace(/\s+/g, ' ');
  if (!text) return [];

  // 괄호 '(' 가 포함되어 있고 전체 길이가 조금이라도 길면 괄호 앞에서 깔끔하게 줄바꿈
  // 예: "샤크 정품 배터리 배송 (1회 24개월)" -> ["샤크 정품 배터리 배송", "(1회 24개월)"]
  const parenIdx = text.indexOf('(');
  if (parenIdx > 3 && text.length > maxSingleLineLen) {
    const beforeParen = text.slice(0, parenIdx).trim();
    const fromParen = text.slice(parenIdx).trim();
    if (beforeParen && fromParen) {
      return [beforeParen, fromParen];
    }
  }

  if (text.length <= maxSingleLineLen) return [text];

  const delimiterRegex = /\s*(?:,|\/|\+|·|\|)\s*/;
  if (delimiterRegex.test(text)) {
    const tokens = text
      .split(/\s*(?:,|\/|\+|·|\|)\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 2) {
      return [tokens[0], tokens[1]];
    }
    if (tokens.length >= 3) {
      let bestIdx = 1;
      let bestDiff = Infinity;
      for (let i = 1; i < tokens.length; i++) {
        const line1 = tokens.slice(0, i).join(' · ');
        const line2 = tokens.slice(i).join(' · ');
        const diff = Math.abs(line1.length - line2.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      return [
        tokens.slice(0, bestIdx).join(' · '),
        tokens.slice(bestIdx).join(' · '),
      ];
    }
  }

  const words = text.split(' ');
  if (words.length >= 2) {
    let bestSplit = 1;
    let minDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(' ');
      const l2 = words.slice(i).join(' ');
      const diff = Math.abs(l1.length - l2.length);
      if (diff < minDiff) {
        minDiff = diff;
        bestSplit = i;
      }
    }
    return [
      words.slice(0, bestSplit).join(' '),
      words.slice(bestSplit).join(' '),
    ];
  }

  return [text];
}

export default function PopCard({
  product,
  cardBenefit,
  popMode = 'standard',
  paperSize = 'a4-2up',
  isPrintSheet = false,
  isA3BrowserPrintScale = false,
  isA3Selected = false,
  onToggleAllCare,
  onToggleA3Select,
  onQuickPrintA3,
  onQuickDownloadA3Pdf,
}: PopCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(
    isPrintSheet
      ? isA3BrowserPrintScale
        ? A3_PORTRAIT_BROWSER_PRINT_SCALE
        : 1
      : 1
  );

  useEffect(() => {
    if (isPrintSheet) {
      setScale(isA3BrowserPrintScale ? A3_PORTRAIT_BROWSER_PRINT_SCALE : 1);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const availableWidth = entry.contentRect.width;
        const targetWidth = BASE_CARD_WIDTH_PX;
        if (availableWidth < targetWidth) {
          setScale(availableWidth / targetWidth);
        } else if (paperSize === 'a3-portrait') {
          setScale(Math.min(1.16, availableWidth / targetWidth));
        } else {
          setScale(1);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isPrintSheet, isA3BrowserPrintScale, paperSize]);

  const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num);

  // 60개월 구독은 무조건 롯데카드로 강제 세팅
  const is60Months = product.period === 60;
  const activeCardBenefit = is60Months
    ? CARD_BENEFITS.find((c) => c.name.includes('롯데')) || cardBenefit
    : cardBenefit;

  const perceivedPrice = Math.max(0, product.monthlyFee - activeCardBenefit.discount);
  const calculatedDownPayment = product.monthlyFee * product.period;
  const totalBenefitPrice = perceivedPrice * product.period;

  // 상조모드(popMode === 'preed') 전용 1안·2안 계산
  const plan1Monthly = perceivedPrice;
  const plan1Total = plan1Monthly * product.period;
  const preedPlan =
    popMode === 'preed' ? getAutoPreedPlan(product.period, perceivedPrice) : null;
  const isPreedRender = popMode === 'preed' && preedPlan !== null;
  const plan2Monthly = preedPlan
    ? Math.max(0, plan1Monthly - preedPlan.monthlyDiscount)
    : plan1Monthly;
  const plan2Total = plan2Monthly * product.period;

  const warrantyYears = '5';
  const cleanCareServiceText = normalizeCareLabel(product.careServiceText);
  const cleanCareServiceDetail = normalizeCareLabel(product.careServiceDetail);

  const hasCareBadges = Boolean(
    (product.careServiceCycle && product.careServiceCycle.trim()) ||
      (product.careServiceCount && product.careServiceCount.trim())
  );

  const careTitleLines = formatSmartCareLines(
    cleanCareServiceText || '안심케어 (방문점검)',
    hasCareBadges ? 11 : 16
  );
  const careDetailLines = formatSmartCareLines(
    cleanCareServiceDetail || '5년 무상 A/S + 정기 케어',
    16
  );

  // 모델명·원금 글자 수 기반 자동 폰트 크기 조절 (절대 겹침/줄바꿈 깨짐 방지)
  const modelLen = (product.modelName || '').trim().length;
  const modelFontCls =
    modelLen <= 12
      ? 'text-[13.5px] whitespace-nowrap'
      : modelLen <= 16
      ? 'text-[11.5px] whitespace-nowrap'
      : modelLen <= 22
      ? 'text-[10px] leading-tight break-all'
      : 'text-[9px] leading-tight break-all';

  const catText = (product.category || '').trim();
  const modelHeaderLabel = catText.length >= 5 ? '🏷️ 모델명' : '🏷️ 제품 모델명';

  const principalStr = formatNumber(calculatedDownPayment);
  const principalFontCls =
    principalStr.length >= 10
      ? 'text-[12px]'
      : principalStr.length >= 9
      ? 'text-[13.5px]'
      : 'text-[15px]';

  const effectiveScale = isPrintSheet
    ? isA3BrowserPrintScale
      ? A3_PORTRAIT_BROWSER_PRINT_SCALE
      : 1
    : scale;
  const stageWidthPx = BASE_CARD_WIDTH_PX * effectiveScale;
  const stageHeightPx = BASE_CARD_HEIGHT_PX * effectiveScale;
  const showQuickA3Toolbar =
    !isPrintSheet &&
    Boolean(onQuickPrintA3 || onQuickDownloadA3Pdf || onToggleA3Select);

  return (
    <div
      ref={containerRef}
      className={
        isPrintSheet
          ? 'w-full h-full flex items-center justify-center'
          : 'w-full flex flex-col items-center print:w-full print:h-full'
      }
    >
      {/* 웹 미리보기 전용: 개별 연출(A3 세로) 선택 및 1클릭 단독 출력 툴바 */}
      {showQuickA3Toolbar && (
        <div
          className={`no-print print:hidden mb-2 rounded-xl px-2.5 py-1.5 border flex items-center justify-between gap-1.5 flex-wrap transition-all ${
            isA3Selected
              ? 'bg-emerald-50 border-emerald-400 shadow-xs'
              : paperSize === 'a3-portrait'
              ? 'bg-indigo-50/80 border-indigo-200'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}
          style={{ width: `${stageWidthPx}px`, maxWidth: '100%' }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {onToggleA3Select && (
              <button
                type="button"
                onClick={() => onToggleA3Select(product.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold border transition-colors cursor-pointer whitespace-nowrap ${
                  isA3Selected
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                }`}
                title="A3 세로 개별 연출 출력 대상으로 이 모델을 체크합니다"
              >
                {isA3Selected ? (
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                )}
                <span>{isA3Selected ? 'A3 연출 선택됨' : '개별연출 선택'}</span>
              </button>
            )}
            {paperSize === 'a3-portrait' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black whitespace-nowrap">
                <Maximize2 className="w-2.5 h-2.5" />
                A3 세로 297×420mm
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {onQuickPrintA3 && (
              <button
                type="button"
                onClick={() => onQuickPrintA3(product)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[11px] font-black transition-colors cursor-pointer whitespace-nowrap"
                title="전체 모드를 바꾸지 않고 이 모델 1개만 즉시 A3 세로(297×420mm) 단독 포스터로 인쇄합니다"
              >
                <Printer className="w-3 h-3 shrink-0" />
                <span>A3 단독인쇄</span>
              </button>
            )}
            {onQuickDownloadA3Pdf && (
              <button
                type="button"
                onClick={() => onQuickDownloadA3Pdf(product)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black transition-colors cursor-pointer whitespace-nowrap"
                title="이 모델 1개만 A3 세로(297×420mm) 고해상도 PDF로 즉시 저장합니다"
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span>A3 PDF</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={isPrintSheet ? 'relative shrink-0' : 'relative print:!w-full print:!h-full'}
        style={{ width: `${stageWidthPx}px`, height: `${stageHeightPx}px` }}
      >
        <div
          className={
            isPrintSheet
              ? 'pop-card-print w-[148.5mm] h-[210mm] border-8 border-slate-800 bg-white px-[20px] pt-[15px] pb-[13px] flex flex-col justify-between box-border shrink-0 origin-top-left absolute top-0 left-0 shadow-none m-0'
              : `pop-card-print w-[148.5mm] h-[210mm] border-8 ${
                  isA3Selected
                    ? 'border-emerald-700 ring-4 ring-emerald-400/40'
                    : 'border-slate-800'
                } bg-white px-[20px] pt-[15px] pb-[13px] flex flex-col justify-between shadow-lg box-border shrink-0 origin-top-left absolute top-0 left-0 print:!relative print:!transform-none print:w-full print:h-full print:border-[6px] print:shadow-none print:m-0`
          }
          style={
            effectiveScale === 1
              ? undefined
              : { transform: `scale(${effectiveScale})` }
          }
        >
          {/* [1단] 최상단 바 & 메인 타이틀 영역 */}
          <div className="text-center">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
              {/* 좌측: 슬림 캡슐형 5년 무상 A/S 배지 */}
              <div className="justify-self-start bg-gradient-to-r from-blue-900 to-blue-600 text-white rounded-full px-2.5 py-1 border border-blue-300 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
                <span className="w-4.5 h-4.5 rounded-full bg-yellow-300 text-blue-900 font-black text-[11px] flex items-center justify-center shrink-0">
                  {warrantyYears}
                </span>
                <span className="text-[10.5px] font-black tracking-tight whitespace-nowrap">
                  <span className="text-yellow-300">{warrantyYears}년 무상 A/S</span> 안심보장
                </span>
              </div>

              {/* 정중앙 고정: 노란 별 5개 */}
              <div className="flex justify-center gap-1 px-2 shrink-0">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-yellow-400 fill-current shrink-0"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* 우측: 인쇄/PDF 시에는 편집용 버튼(+올케어, NEW 새로추가 등)을 완전히 제거해 깔끔한 매장 포스터로 출력 */}
              <div className="justify-self-end flex items-center gap-1 justify-end">
                {isPrintSheet ? (
                  product.isAllCare ? (
                    <span className="bg-indigo-900 text-yellow-300 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-indigo-700 whitespace-nowrap">
                      🛡️ 올케어 보증
                    </span>
                  ) : null
                ) : (
                  <>
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
                      <div className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[9.5px] font-bold no-print shadow-sm whitespace-nowrap">
                        NEW
                      </div>
                    )}
                    {product.changeStatus === 'changed' && (
                      <div className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9.5px] font-bold no-print shadow-sm whitespace-nowrap">
                        변동
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 메인 타이틀 */}
            <h1 className="text-[28px] font-black text-slate-800 tracking-tight leading-tight whitespace-nowrap">
              구독하면 <span className="text-blue-700 italic text-[34px]">더!</span> 합리적인 선택
            </h1>

            {/* 타이틀 바로 아래 서브 배너 (줄바꿈 이탈 100% 원천 차단) */}
            {product.isAllCare ? (
              <div className="mt-1.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-3.5 py-1.5 rounded-xl shadow-md border-2 border-amber-400 inline-flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap max-w-full">
                <span className="text-sm shrink-0">🛡️</span>
                <span className="bg-amber-400 text-slate-950 text-[11px] px-2 py-0.5 rounded-full font-black tracking-tight whitespace-nowrap shrink-0">
                  올케어 혜택
                </span>
                <span className="text-[12.5px] font-black text-amber-300 tracking-tight whitespace-nowrap shrink-0">
                  사용중인 가전 2년 수리비 보증 서비스
                </span>
              </div>
            ) : (
              <div className="mt-1.5 bg-slate-800 text-white inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[12.5px] font-extrabold shadow-md flex-nowrap whitespace-nowrap max-w-full">
                <span className="text-yellow-400 mr-2 whitespace-nowrap shrink-0">
                  초기 비용 부담 ZERO!
                </span>
                <span className="border-l border-slate-500 pl-2 whitespace-nowrap shrink-0">
                  초기 부담 없이 바로 시작하세요!
                </span>
              </div>
            )}
          </div>

          {/* [2단] 제품 스펙 4칸 요약 바 (라벨 줄바꿈 겹침 완벽 방지) */}
          <div className="grid grid-cols-[1.58fr_0.66fr_0.93fr_0.93fr] gap-1.5">
            {/* 1칸: 제품 모델명 */}
            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-2 text-center min-h-[62px] flex flex-col justify-center overflow-hidden">
              <div className="flex items-center justify-center gap-1 mb-1 flex-nowrap whitespace-nowrap">
                {catText && (
                  <span className="bg-blue-100 text-blue-800 text-[9.5px] font-black px-1.5 py-0.5 rounded leading-none whitespace-nowrap shrink-0 max-w-[78px] truncate">
                    [{catText}]
                  </span>
                )}
                <span className="text-[10px] text-slate-500 font-extrabold whitespace-nowrap shrink-0">
                  {modelHeaderLabel}
                </span>
              </div>
              <div className={`${modelFontCls} font-black text-slate-900 tracking-tight px-0.5`}>
                {product.modelName}
              </div>
            </div>

            {/* 2칸: 구독기간 */}
            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                ⏳ 구독기간
              </div>
              <div className="text-[14.5px] font-black text-slate-800 whitespace-nowrap">
                {product.period}개월
              </div>
            </div>

            {/* 3칸: 구독원금 */}
            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                💰 구독원금
              </div>
              <div className={`${principalFontCls} font-black text-slate-800 whitespace-nowrap tracking-tight`}>
                {principalStr}원
              </div>
            </div>

            {/* 4칸: 월 구독료 */}
            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                🗓️ 월 구독료
              </div>
              <div className="text-[14.5px] font-black text-blue-700 whitespace-nowrap tracking-tight">
                {formatNumber(product.monthlyFee)}원
              </div>
            </div>
          </div>

          {/* [3단] 케어 서비스 2칸 나란히 배치 (고정 높이 잘림 해제 -> 유연한 min-h) */}
          <div className="grid grid-cols-2 gap-2.5 min-h-[108px] items-stretch">
            {/* 좌측 박스: 구독 케어 서비스 */}
            <div className="border-[1.5px] border-slate-800 rounded-[10px] overflow-hidden flex flex-col bg-white">
              <div className="bg-slate-800 text-white text-center py-1 font-extrabold text-[11px] shrink-0 whitespace-nowrap">
                구독 케어 서비스
              </div>
              <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between gap-1">
                {/* 상단: 케어 명칭 + 주기/횟수 배지 */}
                <div className="border-b border-slate-200 pb-1 flex items-center justify-between gap-1.5">
                  <div
                    className={`text-[10.5px] font-extrabold text-slate-800 leading-snug text-left min-w-0 ${
                      careTitleLines.length === 1 ? 'whitespace-nowrap' : ''
                    }`}
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {careTitleLines.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {product.careServiceCycle && (
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold whitespace-nowrap">
                        {/^\d+$/.test(product.careServiceCycle.trim())
                          ? `${product.careServiceCycle.trim()}개월 주기`
                          : product.careServiceCycle.trim()}
                      </span>
                    )}
                    {product.careServiceCount && (
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold whitespace-nowrap">
                        {/^\d+$/.test(product.careServiceCount.trim())
                          ? `총 ${product.careServiceCount.trim()}회`
                          : product.careServiceCount.trim()}
                      </span>
                    )}
                  </div>
                </div>

                {/* 하단: 서비스 내용 */}
                <div className="flex flex-col justify-center text-left">
                  <span className="text-slate-400 font-extrabold text-[8.5px] leading-none mb-0.5 whitespace-nowrap">
                    · 서비스 내용
                  </span>
                  <div
                    className="text-blue-700 font-extrabold text-[10px] leading-snug pl-1"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {careDetailLines.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 우측 박스: 올케어 여부에 따라 분기 */}
            {product.isAllCare ? (
              <div className="border-[1.5px] border-indigo-900 rounded-[10px] overflow-hidden flex flex-col bg-indigo-50/30">
                <div className="bg-indigo-950 text-amber-300 text-center py-1 font-extrabold text-[11px] whitespace-nowrap">
                  🛡️ 사용중 가전 2년 보증
                </div>
                <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between text-[9.5px]">
                  <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                    <span className="text-indigo-950 font-black shrink-0">· 대상가전:</span>
                    <span className="font-extrabold text-blue-800 text-right">
                      총 34개 품목 (대형8·생활21·IT5)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                    <span className="text-indigo-950 font-black shrink-0">· 보증/한도:</span>
                    <span className="font-extrabold text-slate-800 text-right">
                      2년(면책60일) · 연 100만원(총200만)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                    <span className="text-indigo-950 font-black shrink-0">· 1회 자부담:</span>
                    <span className="font-black text-red-600 text-right">
                      5,000원 <span className="text-slate-600 font-bold">(10년↑ 5만원)</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-[1.5px] border-slate-800 rounded-[10px] overflow-hidden flex flex-col bg-white">
                <div className="bg-slate-800 text-white text-center py-1 font-extrabold text-[11px] whitespace-nowrap">
                  카드 사용 꿀팁!
                </div>
                <div className="px-2.5 py-2 flex-1 grid grid-cols-2 gap-x-1.5 gap-y-1.5 items-center text-[10px]">
                  {[
                    '개인 보험 자동이체',
                    '휴대폰 요금 자동이체',
                    '학원비 자동이체',
                    '생활비 결제',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-center gap-1 whitespace-nowrap">
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
                      <span className="font-bold text-slate-700 tracking-tight whitespace-nowrap">
                        {tip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* [4단] 중앙 메인 가격 영역 */}
          {isPreedRender && preedPlan ? (
            <div className="grid grid-cols-2 gap-3 mt-2 relative">
              <div className="absolute top-[53%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[32px] h-[32px] rounded-full bg-slate-900 text-yellow-400 border-[2.5px] border-white shadow-md flex items-center justify-center text-[10.5px] font-black">
                VS
              </div>

              {/* 좌측 카드 [선택 1안 · 제휴카드만] */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-xl pt-[17px] pb-[9px] px-2.5 relative flex flex-col items-center justify-between gap-1.5">
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-slate-800 text-white font-black px-3.5 py-0.5 rounded-full text-[11.5px] border-2 border-white shadow-sm whitespace-nowrap">
                  💳 선택 1안 · 제휴카드만
                </div>

                <div className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10.5px] flex flex-col gap-0.5">
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-600">기본 월 구독료</span>
                    <span className="font-extrabold text-slate-800">
                      월 {formatNumber(product.monthlyFee)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-600">
                      (-) {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="font-black text-blue-600">
                      월 -{formatNumber(activeCardBenefit.discount)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-400">(-) 상조서비스 결합</span>
                    <span className="font-bold text-slate-400">선택안함</span>
                  </div>
                </div>

                <div className="text-center py-0.5 whitespace-nowrap">
                  <div className="text-[13.5px] font-extrabold text-slate-700">
                    1안 월 체감가
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span
                      className={`${
                        plan1Monthly >= 100000 ? 'text-[44px]' : 'text-[52px]'
                      } leading-[1.2] font-black text-slate-900 tracking-tighter`}
                    >
                      {formatNumber(plan1Monthly)}
                    </span>
                    <span className="text-[18px] font-black text-slate-900 ml-1">원</span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 text-slate-700 rounded-[7px] py-1 px-2 text-center text-[11px] font-extrabold whitespace-nowrap">
                  {product.period}개월 총 체감가: {formatNumber(plan1Total)}원
                </div>
              </div>

              {/* 우측 카드 [선택 2안 · 상조서비스 결합] */}
              <div className="bg-rose-50 border-[2.5px] border-rose-600 rounded-xl pt-[17px] pb-[9px] px-2.5 relative flex flex-col items-center justify-between gap-1.5 shadow-md">
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-rose-600 text-white font-black px-3.5 py-0.5 rounded-full text-[11.5px] border-2 border-yellow-300 shadow-sm whitespace-nowrap">
                  👑 선택 2안 · 상조서비스 결합
                </div>

                <div className="w-full bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-[10.5px] flex flex-col gap-0.5">
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-600">기본 월 구독료</span>
                    <span className="font-extrabold text-slate-800">
                      월 {formatNumber(product.monthlyFee)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-600">
                      (-) {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="font-black text-blue-600">
                      월 -{formatNumber(activeCardBenefit.discount)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-extrabold text-rose-700">
                      (-) 상조결합 ({preedPlan.shortLabel})
                    </span>
                    <span className="font-black text-rose-600">
                      월 -{formatNumber(preedPlan.monthlyDiscount)}원
                    </span>
                  </div>
                </div>

                <div className="text-center py-0.5 whitespace-nowrap">
                  <div className="text-[13.5px] font-black text-rose-700">
                    2안 월 최대 체감가 ✨
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span
                      className={`${
                        plan2Monthly >= 100000 ? 'text-[44px]' : 'text-[52px]'
                      } leading-[1.2] font-black text-red-600 tracking-tighter`}
                    >
                      {formatNumber(plan2Monthly)}
                    </span>
                    <span className="text-[18px] font-black text-red-600 ml-1">원</span>
                  </div>
                </div>

                <div className="w-full bg-rose-700 text-white rounded-[7px] py-1 px-2 text-center text-[11px] font-black whitespace-nowrap">
                  {product.period}개월 총 체감가:{' '}
                  <span className="text-yellow-300">{formatNumber(plan2Total)}원</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 relative">
              <div className="bg-rose-50 border-[2.5px] border-rose-600 rounded-xl pt-[19px] pb-[9px] px-4 relative flex flex-col items-center justify-between gap-1.5 shadow-md">
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-rose-600 text-white font-black px-5 py-0.5 rounded-full text-[12.5px] border-2 border-yellow-300 shadow-sm whitespace-nowrap">
                  💳 제휴카드 혜택 적용 시
                </div>

                <div className="w-full bg-white border border-rose-200 rounded-lg px-3.5 py-1.5 text-[11.5px] flex flex-col gap-1">
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-bold text-slate-600">
                      기본 월 구독료 ({product.period}개월)
                    </span>
                    <span className="font-extrabold text-slate-800">
                      월 {formatNumber(product.monthlyFee)}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between whitespace-nowrap">
                    <span className="font-extrabold text-blue-700">
                      (-) {activeCardBenefit.name.replace('카드', '제휴카드')} 할인 (전월 30만원↑)
                    </span>
                    <span className="font-black text-blue-600">
                      월 -{formatNumber(activeCardBenefit.discount)}원
                    </span>
                  </div>
                </div>

                <div className="text-center py-0.5 whitespace-nowrap">
                  <div className="text-[15px] font-black text-rose-700">
                    제휴카드 적용 월 체감가 ✨
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span className="text-[58px] leading-[1.2] font-black text-red-600 tracking-tighter">
                      {formatNumber(perceivedPrice)}
                    </span>
                    <span className="text-[21px] font-black text-red-600 ml-1">원</span>
                  </div>
                </div>

                <div className="w-full bg-rose-700 text-white rounded-[7px] py-1.5 px-3 text-center text-[11.5px] font-black whitespace-nowrap">
                  {product.period}개월 총 체감가:{' '}
                  <span className="text-yellow-300">
                    {formatNumber(totalBenefitPrice)}원
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* [5단] 최하단 다크 요약 배너 + 안내 문구 */}
          {isPreedRender && preedPlan ? (
            <div className="space-y-1">
              <div className="bg-slate-800 rounded-xl py-2.5 px-3 grid grid-cols-[0.88fr_1.12fr] gap-2 text-white">
                <div className="flex flex-col justify-center gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
                    <span className="bg-blue-600 text-white text-[8.5px] px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap shrink-0">
                      {activeCardBenefit.name.replace('카드', '제휴카드')}
                    </span>
                    <span className="text-yellow-400 font-black text-[12px] tracking-tight whitespace-nowrap shrink-0">
                      월 {formatNumber(activeCardBenefit.discount)}원 {activeCardBenefit.benefitType}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[8.5px] font-bold tracking-tight whitespace-nowrap">
                    전월 30만원↑ 이용 시 매월 지급 (총{' '}
                    {Math.round((activeCardBenefit.discount * product.period) / 10000)}만원)
                  </div>
                </div>

                <div className="border-l border-slate-600 pl-2 flex flex-col justify-center gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
                    <span className="bg-rose-600 text-yellow-300 text-[8.5px] px-1.5 py-0.5 rounded font-black whitespace-nowrap shrink-0">
                      {preedPlan.badgeTitle}
                    </span>
                    <span className="text-yellow-400 font-black text-[12px] tracking-tight whitespace-nowrap shrink-0">
                      월 {formatNumber(preedPlan.monthlyDiscount)}원 추가지원
                    </span>
                  </div>
                  <div className="text-slate-300 text-[8.5px] font-bold tracking-tight whitespace-nowrap">
                    90회 납입(월{preedPlan.monthlyDepositMan}만)+30회 거치 ·{' '}
                    <span className="text-yellow-300 font-black">
                      120회 만기 전액환급(미이용시)
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-400 text-center font-semibold whitespace-nowrap">
                ※ 본 상품은 구독 서비스 상품으로, 중도 해지 시 위약금이 발생할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="bg-slate-800 rounded-xl py-2.5 px-4 flex items-center justify-between gap-2 text-white shadow-sm">
                <div className="flex flex-col items-start gap-0.5 shrink-0">
                  <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap">
                    {activeCardBenefit.name.replace('카드', '제휴카드')}
                  </span>
                  <span className="text-slate-300 text-[9.5px] font-bold whitespace-nowrap">
                    월 30만원 이상 사용 시
                  </span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="text-yellow-400 font-black text-[20px] leading-tight tracking-tight">
                    {formatNumber(activeCardBenefit.discount)}원 {activeCardBenefit.benefitType}
                  </div>
                  <div className="text-slate-300 text-[9.5px] font-bold">
                    매월 {activeCardBenefit.benefitType}으로 지급! ({product.period}개월 총{' '}
                    {Math.round((activeCardBenefit.discount * product.period) / 10000)}만원 혜택)
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-400 text-center font-semibold whitespace-nowrap">
                ※ 본 상품은 구독 서비스 상품으로, 중도 해지 시 위약금이 발생할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
