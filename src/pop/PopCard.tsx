import React, { useRef, useState, useEffect } from 'react';
import { Printer, FileText, CheckSquare, Square } from 'lucide-react';
import {
  ProductData,
  CardBenefit,
  CARD_BENEFITS,
  PopMode,
  PopPaperSize,
  UnderPreedScope,
} from './types';
import { inferCategoryFromModelCode } from '../utils/aiImageParser';

// 브라우저 직접 인쇄(window.print)용 A3 세로 배율 (418mm 안전 높이 내 중앙 배치)
const A3_PORTRAIT_BROWSER_PRINT_SCALE = 1.9;
const BASE_CARD_WIDTH_PX = 561.26; // 148.5mm @ 96 DPI
const BASE_CARD_HEIGHT_PX = 793.7; // 210.0mm @ 96 DPI
// A4 4분할(148.5×105mm 칸) 내부 상하좌우 6mm 균등 안전 재단 여백 반영 실물 규격: 136.5mm × 93mm
const BASE_UNDER_WIDTH_PX = 515.91; // 136.5mm @ 96 DPI
const BASE_UNDER_HEIGHT_PX = 351.5; // 93.0mm @ 96 DPI

interface PopCardProps {
  product: ProductData;
  cardBenefit: CardBenefit;
  popMode?: PopMode;
  paperSize?: PopPaperSize;
  underPreedScope?: UnderPreedScope;
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

interface OptimalUnderPreedInfo {
  units: number;
  monthlyDiscount: number;
  summaryLabel: string;
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

  if (period === 36) {
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

  const safePeriod = Number.isFinite(period) && period > 0 ? period : 60;
  const candidates: PreedPlanInfo[] = [
    {
      code: '108',
      shortLabel: '플러스108',
      badgeTitle: '플러스108 (540만원)',
      monthlyDiscount: Math.round(1080000 / safePeriod),
      monthlyDepositMan: 6,
    },
    {
      code: '90',
      shortLabel: '플러스90',
      badgeTitle: '플러스90 (450만원)',
      monthlyDiscount: Math.round(900000 / safePeriod),
      monthlyDepositMan: 5,
    },
    {
      code: '72',
      shortLabel: '플러스72',
      badgeTitle: '플러스72 (360만원)',
      monthlyDiscount: Math.round(720000 / safePeriod),
      monthlyDepositMan: 4,
    },
  ];

  return candidates.find((c) => cardPerceivedPrice >= c.monthlyDiscount) || null;
}

/**
 * 전자가격표(ESL) 하단 부착용 미니 POP 전용:
 * - 'optimal': 플러스 72·90·108 다구좌(최대 5구좌) 중 잔여 월 체감가를 0원~만원 미만 앞자리로 낮추는 최소 납입 조합 자동 추천
 * - 'single': 1구좌 기준 보수적 차감
 */
function getUnderPopPreedAllocation(
  period: number,
  baseMonthlyFee: number,
  afterCardMonthly: number,
  scope: UnderPreedScope = 'optimal'
): OptimalUnderPreedInfo {
  const safePeriod = Number.isFinite(period) && period > 0 ? period : 60;
  if (baseMonthlyFee <= 0) {
    return { units: 0, monthlyDiscount: 0, summaryLabel: '결합없음' };
  }
  const targetMonthly = afterCardMonthly > 0 ? afterCardMonthly : baseMonthlyFee;

  const s72 =
    safePeriod === 36
      ? 20000
      : safePeriod === 60
      ? 12000
      : Math.round(720000 / safePeriod);
  const s90 =
    safePeriod === 36
      ? 25000
      : safePeriod === 60
      ? 15000
      : Math.round(900000 / safePeriod);
  const s108 =
    safePeriod === 36
      ? 30000
      : safePeriod === 60
      ? 18000
      : Math.round(1080000 / safePeriod);

  if (scope === 'single') {
    if (targetMonthly >= s108) {
      return { units: 1, monthlyDiscount: s108, summaryLabel: '플러스108×1' };
    }
    if (targetMonthly >= s90) {
      return { units: 1, monthlyDiscount: s90, summaryLabel: '플러스90×1' };
    }
    return { units: 1, monthlyDiscount: s72, summaryLabel: '플러스72×1' };
  }

  const maxUnits = 5;
  let best: {
    units: number;
    monthlyDiscount: number;
    dues: number;
    tier: number;
    dist: number;
    summaryLabel: string;
  } | null = null;

  for (let c108 = 0; c108 <= maxUnits; c108++) {
    for (let c90 = 0; c90 <= maxUnits - c108; c90++) {
      for (let c72 = 0; c72 <= maxUnits - c108 - c90; c72++) {
        const totalU = c108 + c90 + c72;
        if (totalU === 0) continue;

        const sup = c72 * s72 + c90 * s90 + c108 * s108;
        const dues = c72 * 40000 + c90 * 50000 + c108 * 60000;
        const rem = targetMonthly - sup;

        let tier = 4;
        let dist = Math.abs(rem);

        if (rem >= 1 && rem < 10000) {
          tier = 1;
          dist = rem;
        } else if (rem <= 0 && rem >= -3500) {
          tier = 2;
          dist = Math.abs(rem);
        } else if (rem >= 10000) {
          tier = 3;
          dist = rem;
        } else {
          tier = 5;
          dist = Math.abs(rem) + 100000;
        }

        const parts: string[] = [];
        if (c108 > 0) parts.push(`108×${c108}`);
        if (c90 > 0) parts.push(`90×${c90}`);
        if (c72 > 0) parts.push(`72×${c72}`);

        const cand = {
          units: totalU,
          monthlyDiscount: sup,
          dues,
          tier,
          dist,
          summaryLabel: parts.join('+'),
        };

        if (
          !best ||
          cand.tier < best.tier ||
          (cand.tier === best.tier && cand.dist < best.dist) ||
          (cand.tier === best.tier &&
            cand.dist === best.dist &&
            cand.dues < best.dues)
        ) {
          best = cand;
        }
      }
    }
  }

  return (
    best || {
      units: 1,
      monthlyDiscount: s72,
      summaryLabel: '플러스72×1',
    }
  );
}

function formatShortManwon(amount: number): string {
  const man = amount / 10000;
  if (Math.abs(man - Math.round(man)) < 0.01) {
    return `${Math.round(man)}.0만`.replace(/\.0만$/, '만');
  }
  return `${man.toFixed(1)}만`;
}

function formatManwonFixedOne(amount: number): string {
  const man = amount / 10000;
  return `${man.toFixed(1)}만`;
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
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * 긴 제품 모델명을 괄호·하이픈 단위로 자연스럽게 분할 (절대 '(PK' / 'G)'처럼 괄호 중간이 잘리지 않도록 보호)
 */
function formatSmartModelLines(rawModel?: string): { lines: string[]; fontCls: string } {
  const text = (rawModel || '').trim().replace(/\s+/g, ' ');
  if (!text) return { lines: [''], fontCls: 'text-[13.5px] whitespace-nowrap' };

  const len = text.length;
  if (len <= 12) {
    return { lines: [text], fontCls: 'text-[13.5px] whitespace-nowrap' };
  }
  if (len <= 16) {
    return { lines: [text], fontCls: 'text-[11.5px] whitespace-nowrap' };
  }
  if (len <= 20) {
    return { lines: [text], fontCls: 'text-[10.2px] whitespace-nowrap' };
  }

  const parenIdx = text.lastIndexOf('(');
  if (parenIdx >= 6 && parenIdx < len - 2) {
    return {
      lines: [text.slice(0, parenIdx).trim(), text.slice(parenIdx).trim()],
      fontCls: 'text-[10px] leading-tight whitespace-nowrap',
    };
  }

  const mid = Math.floor(len / 2);
  let bestSplit = -1;
  let bestDist = Infinity;
  for (let i = 5; i < len - 4; i++) {
    const ch = text[i];
    if (ch === ' ' || ch === '-' || ch === '/' || ch === '.') {
      const splitPos = ch === ' ' ? i : i + 1;
      const dist = Math.abs(splitPos - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestSplit = splitPos;
      }
    }
  }
  if (bestSplit > 0) {
    return {
      lines: [text.slice(0, bestSplit).trim(), text.slice(bestSplit).trim()],
      fontCls: 'text-[9.5px] leading-tight whitespace-nowrap',
    };
  }

  return { lines: [text], fontCls: 'text-[9px] leading-tight break-all' };
}

function splitSingleCareSegment(seg: string, maxLen: number): string[] {
  const text = seg.trim();
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const delimiterRegex = /\s*(?:,|\/|\+|·|\|)\s*/;
  if (delimiterRegex.test(text)) {
    const parts = text
      .split(/\s*(?:,|\/|\+|·|\|)\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const merged: string[] = [];
      for (const p of parts) {
        if (merged.length > 0 && (merged[merged.length - 1] + ' · ' + p).length <= maxLen) {
          merged[merged.length - 1] = merged[merged.length - 1] + ' · ' + p;
        } else {
          merged.push(p);
        }
      }
      return merged.flatMap((m) => (m.length > maxLen + 4 ? splitByWordsOrParen(m, maxLen) : [m]));
    }
  }

  return splitByWordsOrParen(text, maxLen);
}

function splitByWordsOrParen(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const parenIdx = text.indexOf('(');
  if (parenIdx > 3 && parenIdx <= maxLen) {
    const beforeParen = text.slice(0, parenIdx).trim();
    const fromParen = text.slice(parenIdx).trim();
    if (beforeParen && fromParen && fromParen.length <= maxLen + 4) {
      return [beforeParen, fromParen];
    }
  }

  const words = text.split(' ');
  if (words.length >= 2) {
    let bestSplit = 1;
    let bestScore = Infinity;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(' ');
      const l2 = words.slice(i).join(' ');
      const orphanPenalty = l2.length <= 4 ? 20 : 0;
      const overPenalty =
        Math.max(0, l1.length - (maxLen + 3)) * 4 +
        Math.max(0, l2.length - (maxLen + 3)) * 4;
      const score = Math.abs(l1.length - l2.length) + orphanPenalty + overPenalty;
      if (score < bestScore) {
        bestScore = score;
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

function formatSmartCareLines(rawText: string, maxSingleLineLen = 18): string[] {
  const cleaned = (rawText || '').trim();
  if (!cleaned) return [];
  const rawSegments = cleaned
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const seg of rawSegments) {
    out.push(...splitSingleCareSegment(seg, maxSingleLineLen));
  }
  return out.slice(0, 4);
}

export default function PopCard({
  product,
  cardBenefit,
  popMode = 'standard',
  paperSize = 'a4-4up',
  underPreedScope = 'optimal',
  isPrintSheet = false,
  isA3BrowserPrintScale = false,
  isA3Selected = false,
  onToggleAllCare,
  onToggleA3Select,
  onQuickPrintA3,
  onQuickDownloadA3Pdf,
}: PopCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHalfA5UnderMode = paperSize === 'a4-4up';

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
        const targetWidth =
          paperSize === 'a4-4up' ? BASE_UNDER_WIDTH_PX : BASE_CARD_WIDTH_PX;
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

  const safePeriod =
    Number.isFinite(product.period) && product.period > 0 ? product.period : 60;

  // 60개월 구독은 무조건 롯데카드로 강제 세팅
  const is60Months = safePeriod === 60;
  const activeCardBenefit = is60Months
    ? CARD_BENEFITS.find((c) => c.name.includes('롯데')) || cardBenefit
    : cardBenefit;

  const perceivedPrice = Math.max(0, product.monthlyFee - activeCardBenefit.discount);
  const calculatedDownPayment =
    product.downPayment && product.downPayment >= product.monthlyFee * 12
      ? product.downPayment
      : product.monthlyFee * safePeriod;
  const totalBenefitPrice = perceivedPrice * safePeriod;

  // -------------------- [신규] 전자가격표 하단 부착용 A5 반절 (A4 4분할 · 6mm 균등 재단 여백) 모드 --------------------
  if (isHalfA5UnderMode) {
    const underPreed = getUnderPopPreedAllocation(
      safePeriod,
      product.monthlyFee,
      perceivedPrice,
      underPreedScope
    );
    // 메인 체감가: 카드 사용실적 없이 프리드 혜택만 적용한 월 체감가
    const noCardMainMonthly = Math.max(
      0,
      product.monthlyFee - underPreed.monthlyDiscount
    );
    const noCardMainTotal = noCardMainMonthly * safePeriod;

    // 하단 소형 병기: 카드 사용실적 추가 시 월 체감가
    const withCardSubMonthly = Math.max(
      0,
      noCardMainMonthly - activeCardBenefit.discount
    );
    const withCardSubTotal = withCardSubMonthly * safePeriod;

    const netStr = formatNumber(noCardMainMonthly);

    // 메인 체감가 글씨 크기: 가로 충돌 0px 보장 + 세로 1.20배 포스터형 장체(Tall Display)로 체감 크기 극대화
    const bigNumPx =
      netStr.length <= 2
        ? 132
        : netStr.length <= 3
        ? 120
        : netStr.length <= 5
        ? 104
        : netStr.length === 6
        ? 91
        : 76;
    const unitSidePx = netStr.length <= 3 ? 27 : netStr.length <= 5 ? 23 : 20.5;

    const cleanModelText = (product.modelName || '').trim() || '구독모델';
    const inferredCategory = inferCategoryFromModelCode(cleanModelText, product.category);
    const displayCategory =
      inferredCategory && inferredCategory !== '가전품목'
        ? inferredCategory
        : (product.category || '').trim();
    const topModelFontPx =
      cleanModelText.length > 20 ? 8.8 : cleanModelText.length > 15 ? 9.4 : 10;

    const effectiveHalfScale = isPrintSheet ? 1 : scale;
    const halfStageW = BASE_UNDER_WIDTH_PX * effectiveHalfScale;
    const halfStageH = BASE_UNDER_HEIGHT_PX * effectiveHalfScale;

    return (
      <div
        ref={containerRef}
        className={
          isPrintSheet
            ? 'w-full h-full flex items-center justify-center'
            : 'w-full flex flex-col items-center print:w-full print:h-full'
        }
      >
        <div
          className={
            isPrintSheet ? 'relative shrink-0' : 'relative print:!w-[136.5mm] print:!h-[93mm]'
          }
          style={{ width: `${halfStageW}px`, height: `${halfStageH}px` }}
        >
          <div
            className={
              isPrintSheet
                ? 'pop-card-under-print w-[136.5mm] h-[93mm] border border-slate-300 flex flex-col overflow-hidden bg-[#B80012] select-none shrink-0 origin-top-left absolute top-0 left-0 m-0 box-border'
                : 'pop-card-under-print w-[136.5mm] h-[93mm] rounded-xl shadow-lg border border-slate-300 flex flex-col overflow-hidden bg-[#B80012] select-none shrink-0 origin-top-left absolute top-0 left-0 box-border print:!relative print:!transform-none print:rounded-none print:shadow-none print:m-0'
            }
            style={
              effectiveHalfScale === 1
                ? undefined
                : { transform: `scale(${effectiveHalfScale})` }
            }
          >
            {/* [1단] 상단 블랙 바 (56px): '카드 사용실적 없이도' + 우측 품목명·모델명·계약금 */}
            <div
              className="h-[56px] px-[16px] flex items-center justify-between border-b border-white/15 shrink-0"
              style={{
                background: 'linear-gradient(180deg, #0D1017 0%, #161B26 100%)',
              }}
            >
              <div className="flex items-center gap-[7px] min-w-0">
                <div className="bg-[#FFE600] text-[#0D1017] px-[6.5px] py-[3px] text-[10px] font-black tracking-tight leading-none whitespace-nowrap shrink-0">
                  무실적 혜택
                </div>
                <div className="text-[16.5px] font-black text-white tracking-tight whitespace-nowrap leading-none">
                  <span className="text-[#FFE600]">카드 사용실적</span> 없이도
                </div>
              </div>

              <div className="flex flex-col items-end justify-center text-right shrink-0 ml-2 tabular-nums gap-[0.5px]">
                {displayCategory && (
                  <div className="text-[9.2px] font-black text-[#FFE600] tracking-tight whitespace-nowrap leading-tight max-w-[180px] truncate">
                    {displayCategory}
                  </div>
                )}
                <div
                  className="font-extrabold text-slate-100 tracking-tight whitespace-nowrap leading-tight"
                  style={{ fontSize: `${topModelFontPx}px` }}
                >
                  {cleanModelText} · {safePeriod}개월
                </div>
                <div className="text-[8.6px] font-bold text-slate-400 tracking-tight whitespace-nowrap leading-tight">
                  계약금 {formatNumber(calculatedDownPayment)}원
                </div>
              </div>
            </div>

            {/* [2단] 메인 크림슨 스테이지: 좌측 컴팩트 가전지원금 / 우측 초대형 메인 체감가 + 하단 카드실적 추가 소형 바 */}
            <div
              className="flex-1 px-[14px] flex items-center justify-between gap-[10px] relative overflow-hidden"
              style={{
                background:
                  'repeating-linear-gradient(-45deg, rgba(255,255,255,0.042) 0px, rgba(255,255,255,0.042) 2px, transparent 2px, transparent 8px), radial-gradient(circle at 72% 42%, #F5001E 0%, #CA0015 58%, #92000D 100%)',
              }}
            >
              <div className="flex flex-col items-start justify-center -translate-y-[4px] z-10 shrink-0">
                <div
                  className="bg-[#FFE600] text-[#0E1117] text-[10.8px] font-black px-[7.5px] py-[2.5px] tracking-tight whitespace-nowrap tabular-nums"
                  style={{ boxShadow: '0 4px 10px rgba(60,0,6,0.34)' }}
                >
                  가전지원금({safePeriod}개월)
                </div>
                <div
                  className="mt-[6px] text-white flex items-baseline whitespace-nowrap tabular-nums"
                  style={{ textShadow: '0 4px 10px rgba(55,0,6,0.58)' }}
                >
                  <span className="text-[21.5px] font-black leading-[0.94] tracking-tight">
                    -{formatNumber(underPreed.monthlyDiscount)}
                  </span>
                  <span className="text-[11px] font-black ml-[2px]">원/월</span>
                </div>
              </div>

              <div className="flex flex-col items-end justify-center z-10 shrink-0">
                <div
                  className="text-[12.5px] font-black text-[#FFE600] tracking-tight mb-[9px] whitespace-nowrap leading-none"
                  style={{ textShadow: '0 2px 6px rgba(55,0,6,0.5)' }}
                >
                  프리드 결합 월 체감가
                </div>
                <div
                  className="flex items-baseline text-white whitespace-nowrap tabular-nums"
                  style={{ textShadow: '0 8px 20px rgba(48,0,6,0.84)' }}
                >
                  <span
                    className="font-black mr-[4px] leading-none whitespace-nowrap"
                    style={{ fontSize: `${unitSidePx}px` }}
                  >
                    월
                  </span>
                  <span
                    className="inline-block font-black leading-[0.82] tracking-[-0.06em] whitespace-nowrap"
                    style={{
                      fontSize: `${bigNumPx}px`,
                      transform: 'scaleY(1.20)',
                      transformOrigin: 'center 78%',
                    }}
                  >
                    {netStr}
                  </span>
                  <span
                    className="font-black ml-[2.5px] leading-none whitespace-nowrap"
                    style={{ fontSize: `${unitSidePx + 1}px` }}
                  >
                    원~
                  </span>
                </div>

                <div className="mt-[4px] text-[8.8px] font-extrabold text-rose-100/90 tracking-tight whitespace-nowrap tabular-nums leading-none">
                  {safePeriod}개월 최종혜택금액 {formatNumber(noCardMainTotal)}원
                </div>

                <div
                  className="mt-[4px] bg-[#0D1017] border-[1.5px] border-[#FFE600] px-[8px] py-[2.5px] flex items-baseline gap-[5px] whitespace-nowrap tabular-nums"
                  style={{ boxShadow: '0 4px 10px rgba(45,0,5,0.48)' }}
                >
                  <span className="text-[9.4px] font-extrabold text-slate-200 tracking-tight">
                    카드 사용실적 추가 시
                  </span>
                  <span className="text-[12.2px] font-black text-[#FFE600] leading-none">
                    월 {formatNumber(withCardSubMonthly)}원~
                  </span>
                  <span className="text-[8.2px] font-bold text-slate-400">
                    (최종 {formatNumber(withCardSubTotal)}원)
                  </span>
                </div>
              </div>
            </div>

            {/* [3단] 하단 슬림 화이트 요약 바 (62px · 지점명 무표기 범용 규격) */}
            <div className="h-[62px] px-[16px] bg-white border-t-[3.5px] border-[#FFE600] flex flex-col justify-center gap-[3px] shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-[4.5px] text-[13.5px] font-black tracking-tight whitespace-nowrap tabular-nums">
                  <span className="text-slate-800">
                    월 {formatNumber(product.monthlyFee)}원
                  </span>
                  <span className="text-slate-400 font-black">→</span>
                  <span className="text-[#D60019]">
                    프리드 -{formatShortManwon(underPreed.monthlyDiscount)}
                  </span>
                  <span className="text-[#1B64DA] text-[11.5px]">
                    (+카드추가 -{formatManwonFixedOne(activeCardBenefit.discount)})
                  </span>
                </div>
                <div className="bg-[#0E1117] text-[#FFE600] text-[11px] font-black px-[8px] py-[2.5px] tracking-tight whitespace-nowrap shrink-0">
                  만기 100% 환급형 · 직원문의
                </div>
              </div>
              <div className="text-[8.1px] text-slate-500 font-bold tracking-tight whitespace-nowrap">
                ※ {safePeriod}개월 약정 · 프리드라이프(별도납입 · 만기 100% 환급) 결합 기준 · 카드 추가 시 전월 30만원↑ 조건 충족 기준
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- [기존] A5 세로 기본 쇼카드(A4 2분할) 및 A3 단독 포스터 모드 --------------------
  const plan1Monthly = perceivedPrice;
  const plan1Total = plan1Monthly * safePeriod;
  const preedPlan =
    popMode === 'preed' ? getAutoPreedPlan(safePeriod, perceivedPrice) : null;
  const isPreedRender = popMode === 'preed' && preedPlan !== null;
  const plan2Monthly = preedPlan
    ? Math.max(0, plan1Monthly - preedPlan.monthlyDiscount)
    : plan1Monthly;
  const plan2Total = plan2Monthly * safePeriod;

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
    19
  );

  const smartModel = formatSmartModelLines(product.modelName);
  const modelFontCls = smartModel.fontCls;

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
    paperSize === 'a3-portrait' &&
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
      {/* A3 모드일 때만 간결한 상단 개별출력 바 표시 */}
      {showQuickA3Toolbar && (
        <div
          className={`no-print print:hidden mb-2 rounded-xl px-2.5 py-1.5 border flex items-center justify-between gap-1.5 flex-wrap transition-all ${
            isA3Selected
              ? 'bg-emerald-50 border-emerald-400'
              : 'bg-white border-slate-200'
          }`}
          style={{ width: `${stageWidthPx}px`, maxWidth: '100%' }}
        >
          {onToggleA3Select && (
            <button
              type="button"
              onClick={() => onToggleA3Select(product.id)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold border transition-colors cursor-pointer whitespace-nowrap ${
                isA3Selected
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
              }`}
            >
              {isA3Selected ? (
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              )}
              <span>{isA3Selected ? '출력 선택됨' : '선택 출력 체크'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {onQuickPrintA3 && (
              <button
                type="button"
                onClick={() => onQuickPrintA3(product)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3 h-3 shrink-0" />
                <span>단독 인쇄</span>
              </button>
            )}
            {onQuickDownloadA3Pdf && (
              <button
                type="button"
                onClick={() => onQuickDownloadA3Pdf(product)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span>단독 PDF</span>
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
              <div className="justify-self-start bg-gradient-to-r from-blue-900 to-blue-600 text-white rounded-full px-2.5 py-1 border border-blue-300 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
                <span className="w-4.5 h-4.5 rounded-full bg-yellow-300 text-blue-900 font-black text-[11px] flex items-center justify-center shrink-0">
                  {warrantyYears}
                </span>
                <span className="text-[10.5px] font-black tracking-tight whitespace-nowrap">
                  <span className="text-yellow-300">{warrantyYears}년 무상 A/S</span> 안심보장
                </span>
              </div>

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
                        <span>올케어 ON</span>
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

            <h1 className="text-[28px] font-black text-slate-800 tracking-tight leading-tight whitespace-nowrap">
              구독하면 <span className="text-blue-700 italic text-[34px]">더!</span> 합리적인 선택
            </h1>

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

          {/* [2단] 제품 스펙 4칸 요약 바 */}
          <div className="grid grid-cols-[1.58fr_0.66fr_0.93fr_0.93fr] gap-1.5">
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
                {smartModel.lines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>

            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                ⏳ 구독기간
              </div>
              <div className="text-[14.5px] font-black text-slate-800 whitespace-nowrap">
                {safePeriod}개월
              </div>
            </div>

            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                💰 구독원금
              </div>
              <div className={`${principalFontCls} font-black text-slate-800 whitespace-nowrap tracking-tight`}>
                {principalStr}원
              </div>
            </div>

            <div className="bg-white border-[1.5px] border-slate-300 rounded-[10px] py-2 px-1.5 text-center min-h-[62px] flex flex-col justify-center">
              <div className="text-[10px] text-slate-500 font-extrabold mb-1 whitespace-nowrap">
                🗓️ 월 구독료
              </div>
              <div className="text-[14.5px] font-black text-blue-700 whitespace-nowrap tracking-tight">
                {formatNumber(product.monthlyFee)}원
              </div>
            </div>
          </div>

          {/* [3단] 케어 서비스 2칸 */}
          <div className="grid grid-cols-2 gap-2.5 min-h-[108px] items-stretch">
            <div className="border-[1.5px] border-slate-800 rounded-[10px] overflow-hidden flex flex-col bg-white">
              <div className="bg-slate-800 text-white text-center py-1 font-extrabold text-[11px] shrink-0 whitespace-nowrap">
                구독 케어 서비스
              </div>
              <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between gap-1">
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
                <div className="px-2 py-2 flex-1 grid grid-cols-2 gap-x-1 gap-y-1.5 items-center text-[9.5px]">
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

              <div className="bg-slate-50 border-2 border-slate-300 rounded-xl pt-[17px] pb-[9px] px-2.5 relative flex flex-col items-center justify-between gap-1.5">
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-slate-800 text-white font-black px-3.5 py-0.5 rounded-full text-[11.5px] border-2 border-white shadow-sm whitespace-nowrap">
                  💳 선택 1안 · 제휴카드만
                </div>

                <div className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10px] tracking-tight flex flex-col gap-0.5">
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
                  {safePeriod}개월 총 체감가: {formatNumber(plan1Total)}원
                </div>
              </div>

              <div className="bg-rose-50 border-[2.5px] border-rose-600 rounded-xl pt-[17px] pb-[9px] px-2.5 relative flex flex-col items-center justify-between gap-1.5 shadow-md">
                <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-rose-600 text-white font-black px-3.5 py-0.5 rounded-full text-[11.5px] border-2 border-yellow-300 shadow-sm whitespace-nowrap">
                  👑 선택 2안 · 상조서비스 결합
                </div>

                <div className="w-full bg-white border border-rose-200 rounded-lg px-1.5 py-1.5 text-[10px] tracking-tight flex flex-col gap-0.5">
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
                  {safePeriod}개월 총 체감가:{' '}
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
                      기본 월 구독료 ({safePeriod}개월)
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
                  {safePeriod}개월 총 체감가:{' '}
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
                    {Math.round((activeCardBenefit.discount * safePeriod) / 10000)}만원)
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
                    90회 납입(월{preedPlan.monthlyDepositMan}만)+30개월 거치 ·{' '}
                    <span className="text-yellow-300 font-black">
                      120개월 만기 전액환급(미이용시)
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-400 text-center font-semibold whitespace-nowrap">
                ※ 본 상품은 구독 서비스 및 선불식 할부거래(비금융) 결합 안내로, 중도 해지 시 위약금·지원금 환수가 발생할 수 있습니다.
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
                    매월 {activeCardBenefit.benefitType}으로 지급! ({safePeriod}개월 총{' '}
                    {Math.round((activeCardBenefit.discount * safePeriod) / 10000)}만원 혜택)
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
