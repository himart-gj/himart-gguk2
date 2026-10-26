import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  FileText,
  Info,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toPng } from 'html-to-image';

interface LottePlanCalcViewProps {
  onBackToHome: () => void;
}

interface LotteItem {
  id: string;
  category: string;
  modelName: string;
  quantity: number;
  unitPrice: number;
}

type PlanSpendTarget = 70 | 120 | 200;
type PlanMonths = 12 | 24 | 36;

interface PlanTierOption {
  spend: PlanSpendTarget;
  months: PlanMonths;
  discount: number;
  monthlyEquiv: number;
}

const PLAN_MATRIX: PlanTierOption[] = [
  // 월 70만원 사용 조건
  { spend: 70, months: 12, discount: 240000, monthlyEquiv: 20000 },
  { spend: 70, months: 24, discount: 480000, monthlyEquiv: 20000 },
  { spend: 70, months: 36, discount: 720000, monthlyEquiv: 20000 },
  // 월 120만원 사용 조건
  { spend: 120, months: 12, discount: 300000, monthlyEquiv: 25000 },
  { spend: 120, months: 24, discount: 600000, monthlyEquiv: 25000 },
  { spend: 120, months: 36, discount: 900000, monthlyEquiv: 25000 },
  // 월 200만원 사용 조건
  { spend: 200, months: 12, discount: 360000, monthlyEquiv: 30000 },
  { spend: 200, months: 24, discount: 720000, monthlyEquiv: 30000 },
  { spend: 200, months: 36, discount: 1080000, monthlyEquiv: 30000 },
];

const QUICK_CATEGORIES = [
  '냉장고',
  '김치냉장고',
  '세탁건조기',
  'TV',
  '에어컨',
  '청소기',
  '노트북/PC',
  '공기청정기',
  '식기세척기',
];

const formatNumberInput = (val: number): string => {
  if (!val || val <= 0) return '';
  return val.toLocaleString('ko-KR');
};

const parseNumberInput = (raw: string): number => {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

export const LottePlanCalcView: React.FC<LottePlanCalcViewProps> = ({
  onBackToHome,
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'both' | 'input' | 'preview'>('both');

  // 1) 품목 및 금액 상태
  const [items, setItems] = useState<LotteItem[]>([
    {
      id: `lotte-item-1`,
      category: '',
      modelName: '',
      quantity: 1,
      unitPrice: 0,
    },
  ]);
  const [instantDiscount, setInstantDiscount] = useState<number>(0);
  const [lpointUsed, setLpointUsed] = useState<number>(0);
  const [extraCashback, setExtraCashback] = useState<number>(0);

  // 2) 롯데 플랜 카드 기본 혜택 ON/OFF
  const [useBaseCashback40k, setUseBaseCashback40k] = useState<boolean>(true);
  const [useBillingDiscount5p, setUseBillingDiscount5p] = useState<boolean>(true);
  const [useLolaMoney3p, setUseLolaMoney3p] = useState<boolean>(true);

  // 3) 플랜 서비스 (선할인 약정) 신청 여부 및 약정 구간
  const [isPlanServiceApplied, setIsPlanServiceApplied] = useState<boolean>(true);
  const [usePlanExtraCashback20k, setUsePlanExtraCashback20k] = useState<boolean>(true);
  const [selectedSpend, setSelectedSpend] = useState<PlanSpendTarget>(120);
  const [selectedMonths, setSelectedMonths] = useState<PlanMonths>(24);

  // 내보내기 / 복사 피드백 상태
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedKakao, setCopiedKakao] = useState<boolean>(false);

  // 초기화 핸들러
  const handleResetAll = () => {
    setItems([
      {
        id: `lotte-item-${Date.now()}`,
        category: '',
        modelName: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
    setInstantDiscount(0);
    setLpointUsed(0);
    setExtraCashback(0);
    setUseBaseCashback40k(true);
    setUseBillingDiscount5p(true);
    setUseLolaMoney3p(true);
    setIsPlanServiceApplied(true);
    setUsePlanExtraCashback20k(true);
    setSelectedSpend(120);
    setSelectedMonths(24);
  };

  // 품목 조작
  const handleAddItem = (presetCategory = '') => {
    setItems((prev) => {
      // 첫 품목이 비어 있고 금액도 0원이면 첫 품목에 바로 채움
      if (
        presetCategory &&
        prev.length === 1 &&
        !prev[0].category.trim() &&
        prev[0].unitPrice === 0
      ) {
        return [{ ...prev[0], category: presetCategory }];
      }
      return [
        ...prev,
        {
          id: `lotte-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: presetCategory,
          modelName: '',
          quantity: 1,
          unitPrice: 0,
        },
      ];
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: `lotte-item-${Date.now()}`,
            category: '',
            modelName: '',
            quantity: 1,
            unitPrice: 0,
          },
        ];
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleUpdateItem = (id: string, patch: Partial<LotteItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  };

  // 빠른 금액 추가 (첫 번째 품목 기준)
  const handleQuickAddAmount = (addWon: number) => {
    setItems((prev) => {
      const next = [...prev];
      const first = next[0];
      if (!first) return prev;
      next[0] = {
        ...first,
        unitPrice: Math.max(0, (Number(first.unitPrice) || 0) + addWon),
      };
      return next;
    });
  };

  const handleQuickResetAmount = () => {
    setItems((prev) => {
      const next = [...prev];
      if (!next[0]) return prev;
      next[0] = { ...next[0], unitPrice: 0 };
      return next;
    });
  };

  // ==================== 실시간 계산 ====================
  const calc = useMemo(() => {
    const totalPrice = items.reduce(
      (acc, it) =>
        acc + (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1),
      0
    );

    const step1Deduction =
      Math.max(0, instantDiscount) + Math.max(0, lpointUsed);
    const cardPayAmount = Math.max(0, totalPrice - step1Deduction);

    // 1) 기본 캐시백 (20만원 이상 결제 시 40,000원)
    const eligibleBase40k = cardPayAmount >= 200000 ? 40000 : 0;
    const baseCashback40k = useBaseCashback40k ? eligibleBase40k : 0;

    // 2) 5% 청구할인 (최대 50,000원)
    const rawBilling5p = Math.min(Math.floor(cardPayAmount * 0.05), 50000);
    const billingDiscount5p = useBillingDiscount5p ? rawBilling5p : 0;

    // 3) 3% 롤라머니 적립 (최대 30,000점)
    const rawLola3p = Math.min(Math.floor(cardPayAmount * 0.03), 30000);
    const lolaMoney3p = useLolaMoney3p ? rawLola3p : 0;

    // 4) 플랜 서비스 신청 시 추가 혜택
    const planExtraCashback20k =
      isPlanServiceApplied && usePlanExtraCashback20k && cardPayAmount > 0
        ? 20000
        : 0;

    const matchedTier =
      PLAN_MATRIX.find(
        (t) => t.spend === selectedSpend && t.months === selectedMonths
      ) || PLAN_MATRIX[4];

    const planPreDiscount =
      isPlanServiceApplied && cardPayAmount > 0 ? matchedTier.discount : 0;

    // 합산
    const totalCashbackBenefit =
      baseCashback40k + planExtraCashback20k + Math.max(0, extraCashback);
    const totalBillingBenefit = billingDiscount5p + planPreDiscount;
    const totalLotteCardBenefit =
      baseCashback40k +
      billingDiscount5p +
      lolaMoney3p +
      planExtraCashback20k +
      planPreDiscount +
      Math.max(0, extraCashback);

    const totalAllBenefits = step1Deduction + totalLotteCardBenefit;
    const finalNetPrice = cardPayAmount - totalLotteCardBenefit;

    return {
      totalPrice,
      step1Deduction,
      cardPayAmount,
      eligibleBase40k,
      baseCashback40k,
      rawBilling5p,
      billingDiscount5p,
      rawLola3p,
      lolaMoney3p,
      planExtraCashback20k,
      matchedTier,
      planPreDiscount,
      totalCashbackBenefit,
      totalBillingBenefit,
      totalLotteCardBenefit,
      totalAllBenefits,
      finalNetPrice,
    };
  }, [
    items,
    instantDiscount,
    lpointUsed,
    extraCashback,
    useBaseCashback40k,
    useBillingDiscount5p,
    useLolaMoney3p,
    isPlanServiceApplied,
    usePlanExtraCashback20k,
    selectedSpend,
    selectedMonths,
  ]);

  // 품목 요약 제목
  const validItemNames = items
    .map((it) => it.category.trim())
    .filter(Boolean);
  const proposalTitle =
    validItemNames.length === 0
      ? '롯데 플랜 카드 맞춤 구매 제안서'
      : validItemNames.length === 1
      ? `${validItemNames[0]} 롯데 플랜 맞춤 제안서`
      : `${validItemNames[0]} 외 ${validItemNames.length - 1}건 롯데 플랜 제안서`;

  // 수식 배지
  const formulaParts = ['카드 결제가'];
  if (calc.baseCashback40k > 0) formulaParts.push('기본 캐시백(4만)');
  if (calc.billingDiscount5p > 0) formulaParts.push('5% 청구할인(최대 5만)');
  if (calc.lolaMoney3p > 0) formulaParts.push('3% 롤라머니(최대 3만)');
  if (calc.planExtraCashback20k > 0) formulaParts.push('플랜 추가캐시백(2만)');
  if (calc.planPreDiscount > 0)
    formulaParts.push(
      `플랜 약정 선청구할인(${(calc.planPreDiscount / 10000).toLocaleString()}만)`
    );
  if (extraCashback > 0) formulaParts.push('추가 캐시백');
  const formulaText = formulaParts.join(' ➖ ');

  // 카카오톡 안내문 생성
  const buildKakaoText = () => {
    const itemLines = items
      .filter((it) => it.category.trim() || it.unitPrice > 0)
      .map((it, idx) => {
        const lineAmt =
          (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1);
        const modelStr = it.modelName ? ` (${it.modelName})` : '';
        const qtyStr = it.quantity > 1 ? ` × ${it.quantity}개` : '';
        return `  ${idx + 1}. ${it.category || '가전품목'}${modelStr}${qtyStr}: ${lineAmt.toLocaleString()}원`;
      });

    const lines: string[] = [
      '==============================',
      '[롯데하이마트 경기광주점]',
      '💳 롯데 플랜 카드 맞춤 혜택 제안서',
      '==============================',
      '',
      '■ 구매 품목 및 결제 금액',
      ...(itemLines.length > 0
        ? itemLines
        : [`  • 총 행사가 합계: ${calc.totalPrice.toLocaleString()}원`]),
    ];

    if (instantDiscount > 0) {
      lines.push(`  • 즉시할인: -${instantDiscount.toLocaleString()}원`);
    }
    if (lpointUsed > 0) {
      lines.push(`  • L.Point 사용: -${lpointUsed.toLocaleString()}원`);
    }
    lines.push(`▶ 카드 실결제 금액: ${calc.cardPayAmount.toLocaleString()}원`);
    lines.push('');
    lines.push('■ 롯데 플랜 카드 혜택 상세');
    if (calc.baseCashback40k > 0) {
      lines.push(
        `  ① 기본 캐시백 (20만원 이상 결제): -${calc.baseCashback40k.toLocaleString()}원`
      );
    }
    if (calc.billingDiscount5p > 0) {
      lines.push(
        `  ② 5% 청구할인 (최대 5만원): -${calc.billingDiscount5p.toLocaleString()}원`
      );
    }
    if (calc.lolaMoney3p > 0) {
      lines.push(
        `  ③ 3% 롤라머니 적립 (최대 3만점/현금교환 가능): -${calc.lolaMoney3p.toLocaleString()}원`
      );
    }
    if (isPlanServiceApplied) {
      if (calc.planExtraCashback20k > 0) {
        lines.push(
          `  ④ 플랜 서비스 신청 추가 캐시백: -${calc.planExtraCashback20k.toLocaleString()}원`
        );
      }
      if (calc.planPreDiscount > 0) {
        lines.push(
          `  ⑤ 플랜 서비스 선 청구할인 (월 ${selectedSpend}만원 × ${selectedMonths}개월 약정): -${calc.planPreDiscount.toLocaleString()}원`
        );
      }
    }
    if (extraCashback > 0) {
      lines.push(`  • 추가 캐시백 혜택: -${extraCashback.toLocaleString()}원`);
    }

    lines.push('');
    lines.push('==============================');
    lines.push(
      `🎁 총 카드 혜택 합계: -${calc.totalLotteCardBenefit.toLocaleString()}원`
    );
    lines.push(
      `🎯 고객 최종 체감가: ${calc.finalNetPrice.toLocaleString()}원`
    );
    lines.push('==============================');
    lines.push('');
    lines.push('[📌 필수 고객 안내사항]');
    lines.push(
      '• 캐시백 입금 시기: 결제일 다음 달 말일 고객님 결제 계좌로 입금됩니다. (기본 4만원 + 플랜 신청 시 추가 2만원)'
    );
    lines.push(
      '• 롤라머니 적립 시기: 결제 후 1주일 이내 적립됩니다. (최대 3만점, 현금으로 100% 교환 가능)'
    );
    lines.push(
      '• 롤라머니 현금 교환 방법: 스마트폰 [로카앱(LOCA)] 접속 ➔ [포인트·캐시백] 메뉴 ➔ [롤라머니 캐시백] 신청 시 현금으로 즉시 입금/교환됩니다.'
    );
    if (isPlanServiceApplied) {
      lines.push(
        `• 플랜 서비스 안내: 매월 약정하신 목표 사용금액(월 ${selectedSpend}만원) 및 기간(${selectedMonths}개월) 조건으로 ${calc.planPreDiscount.toLocaleString()}원을 미리 청구할인 받는 서비스입니다.`
      );
    }

    return lines.join('\n');
  };

  const handleCopyKakao = async () => {
    try {
      await navigator.clipboard.writeText(buildKakaoText());
      setCopiedKakao(true);
      setTimeout(() => setCopiedKakao(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleDownloadImage = async () => {
    if (!proposalRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(proposalRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `롯데플랜_맞춤제안서_${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('제안서 이미지 저장 실패:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[calc(100dvh-44px)] w-full bg-slate-100 flex flex-col">
      {/* ==================== 상단 서브 액션바 ==================== */}
      <div className="no-print sticky top-[44px] z-30 bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>메인 홈으로</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                4. 롯데 플랜 카드 계산기 & 맞춤 제안서
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 화면 보기 전환 탭 (모바일/태블릿 편의) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveViewTab('both')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                activeViewTab === 'both'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              통합 보기
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('input')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                activeViewTab === 'input'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. 조건 입력
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('preview')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                activeViewTab === 'preview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. 고객 제안서
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 text-xs font-black transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>
        </div>
      </div>

      {/* ==================== 메인 컨텐츠 영역 ==================== */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto p-3 sm:p-5">
        <div
          className={`grid gap-5 items-start ${
            activeViewTab === 'both'
              ? 'grid-cols-1 xl:grid-cols-12'
              : 'grid-cols-1 max-w-4xl mx-auto'
          }`}
        >
          {/* =================================================================== */}
          {/* 좌측: [3-1. 조건 입력 및 실시간 계산 패널] */}
          {/* =================================================================== */}
          {(activeViewTab === 'both' || activeViewTab === 'input') && (
            <div
              className={`no-print space-y-4 ${
                activeViewTab === 'both' ? 'xl:col-span-5' : 'w-full'
              }`}
            >
              {/* 1) 구매 품목 및 결제 예정 금액 입력 */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-black flex items-center justify-center">
                      1
                    </span>
                    <h2 className="text-base font-black text-slate-900">
                      구매 품목 및 결제 예정 금액
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddItem('')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>품목 추가</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>초기화</span>
                    </button>
                  </div>
                </div>

                {/* 빠른 품목 추가 버튼 */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleAddItem(cat)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-xs font-extrabold text-slate-700 transition cursor-pointer"
                    >
                      +{cat}
                    </button>
                  ))}
                </div>

                {/* 빠른 단일 금액 추가 버튼 */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-600">
                    ⚡ 빠른 금액 입력 (1번 품목):
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleQuickAddAmount(1000000)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black transition cursor-pointer"
                    >
                      +100만
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddAmount(500000)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black transition cursor-pointer"
                    >
                      +50만
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddAmount(100000)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black transition cursor-pointer"
                    >
                      +10만
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickResetAmount}
                      className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-extrabold transition cursor-pointer"
                    >
                      금액 0원
                    </button>
                  </div>
                </div>

                {/* 품목 리스트 */}
                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { category: e.target.value })
                          }
                          placeholder="품목명 (예: 냉장고, TV)"
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-rose-500"
                        />
                        <input
                          type="text"
                          value={item.modelName}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { modelName: e.target.value })
                          }
                          placeholder="모델명 (선택)"
                          className="w-28 sm:w-36 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                          title="품목 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500">
                            수량
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="w-14 px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-center text-slate-900 focus:outline-none focus:border-rose-500"
                          />
                        </div>

                        <div className="flex-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500 shrink-0">
                            행사가
                          </span>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberInput(item.unitPrice)}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  unitPrice: parseNumberInput(e.target.value),
                                })
                              }
                              placeholder="0"
                              className="w-full pr-7 pl-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm font-black text-right text-slate-900 focus:outline-none focus:border-rose-500"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                              원
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 추가 할인 입력란 (선택) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      즉시할인 (선택)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(instantDiscount)}
                        onChange={(e) =>
                          setInstantDiscount(parseNumberInput(e.target.value))
                        }
                        placeholder="0"
                        className="w-full pr-6 pl-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-right text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        원
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      L.Point 사용 (선택)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(lpointUsed)}
                        onChange={(e) =>
                          setLpointUsed(parseNumberInput(e.target.value))
                        }
                        placeholder="0"
                        className="w-full pr-6 pl-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-right text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        원
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      추가 캐시백 (선택)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(extraCashback)}
                        onChange={(e) =>
                          setExtraCashback(parseNumberInput(e.target.value))
                        }
                        placeholder="0"
                        className="w-full pr-6 pl-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-right text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                        원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 카드 실결제 대상 금액 요약 바 */}
                <div className="bg-slate-900 text-white rounded-2xl px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-slate-300">
                      💳 카드 실결제 대상 금액
                    </div>
                    <div className="text-[11px] text-slate-400">
                      총 행사가 {calc.totalPrice.toLocaleString()}원
                      {calc.step1Deduction > 0
                        ? ` - 선차감 ${calc.step1Deduction.toLocaleString()}원`
                        : ''}
                    </div>
                  </div>
                  <div className="text-xl font-black text-amber-400">
                    {calc.cardPayAmount.toLocaleString()}원
                  </div>
                </div>
              </div>

              {/* 2) 롯데 플랜 카드 기본 혜택 (자동 계산 + 개별 ON/OFF) */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-base font-black text-slate-900">
                      롯데 플랜 카드 기본 혜택 (자동 계산)
                    </h2>
                  </div>
                  <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    개별 ON/OFF 가능
                  </span>
                </div>

                <div className="space-y-2">
                  {/* ① 기본 캐시백 (40,000원) */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={useBaseCashback40k}
                        onChange={(e) => setUseBaseCashback40k(e.target.checked)}
                        className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                      />
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          ① 기본 캐시백 (40,000원)
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          카드 실결제 20만원 이상 시 4만원 자동 적용 (익월 말 입금)
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-black ${
                          calc.baseCashback40k > 0
                            ? 'text-rose-600'
                            : 'text-slate-400'
                        }`}
                      >
                        -{calc.baseCashback40k.toLocaleString()}원
                      </span>
                      {calc.cardPayAmount > 0 && calc.cardPayAmount < 200000 && (
                        <div className="text-[10px] font-extrabold text-amber-600">
                          20만원 이상 시 적용
                        </div>
                      )}
                    </div>
                  </label>

                  {/* ② 5% 청구할인 (최대 50,000원) */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={useBillingDiscount5p}
                        onChange={(e) =>
                          setUseBillingDiscount5p(e.target.checked)
                        }
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      />
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          ② 5% 청구할인 (최대 50,000원)
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          결제금액의 5% 자동 계산 (100만원 이상 시 최대 5만원)
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-base font-black shrink-0 ${
                        calc.billingDiscount5p > 0
                          ? 'text-blue-600'
                          : 'text-slate-400'
                      }`}
                    >
                      -{calc.billingDiscount5p.toLocaleString()}원
                    </span>
                  </label>

                  {/* ③ 3% 롤라머니 적립 (최대 30,000점) */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={useLolaMoney3p}
                        onChange={(e) => setUseLolaMoney3p(e.target.checked)}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          ③ 3% 롤라머니 적립 (최대 30,000점 · 현금 교환 가능)
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          결제 후 1주일 이내 적립 · 로카앱에서 100% 현금 캐시백 교환
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-base font-black shrink-0 ${
                        calc.lolaMoney3p > 0 ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    >
                      -{calc.lolaMoney3p.toLocaleString()}원
                    </span>
                  </label>
                </div>
              </div>

              {/* 3) 플랜 서비스 (선할인 약정) 신청 여부 및 구간 선택 */}
              <div className="bg-white rounded-3xl border-2 border-rose-200 shadow-sm p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-black flex items-center justify-center">
                      3
                    </span>
                    <h2 className="text-base font-black text-slate-900">
                      플랜 서비스 (선할인 약정) 선택
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">
                    신청 시 +2만원 추가 캐시백!
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs font-bold text-slate-700 leading-relaxed">
                  💡 <strong className="text-rose-700">플랜 서비스란?</strong> 한 달에
                  얼마씩(70만 / 120만 / 200만원), 몇 개월(12 / 24 / 36개월) 사용할지를
                  약정하여 <strong className="text-slate-900">최대 108만원을 미리 선(先) 청구할인</strong> 받는 서비스입니다.
                </div>

                {/* 신청 / 미신청 토글 버튼 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsPlanServiceApplied(false)}
                    className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm border-2 transition cursor-pointer ${
                      !isPlanServiceApplied
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>플랜 서비스 미신청</div>
                    <div className="text-[11px] font-bold opacity-80 mt-0.5">
                      (기본 카드 혜택만 적용)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPlanServiceApplied(true)}
                    className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm border-2 transition cursor-pointer ${
                      isPlanServiceApplied
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <div>✨ 플랜 서비스 신청</div>
                    <div className="text-[11px] font-bold opacity-95 mt-0.5">
                      (+추가 2만원 캐시백 지급!)
                    </div>
                  </button>
                </div>

                {isPlanServiceApplied && (
                  <div className="space-y-3.5 pt-1">
                    {/* 추가 혜택 1: 플랜 신청 추가 캐시백 +20,000원 */}
                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={usePlanExtraCashback20k}
                          onChange={(e) =>
                            setUsePlanExtraCashback20k(e.target.checked)
                          }
                          className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                        />
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            🎁 플랜 서비스 신청 추가 캐시백 (+20,000원)
                          </div>
                          <div className="text-xs font-bold text-amber-800">
                            기본 캐시백 4만원 + 플랜 추가 2만원 = 캐시백 총 6만원!
                          </div>
                        </div>
                      </div>
                      <span className="text-base font-black text-rose-600 shrink-0">
                        -{calc.planExtraCashback20k.toLocaleString()}원
                      </span>
                    </label>

                    {/* 추가 혜택 2: 약정 구간 선택 3×3 매트릭스 */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">
                          📊 월 목표 사용금액 × 약정 기간 선택 (3×3 매트릭스)
                        </span>
                        <span className="text-xs font-black text-rose-600">
                          선 청구할인 -{calc.planPreDiscount.toLocaleString()}원
                        </span>
                      </div>

                      {([70, 120, 200] as PlanSpendTarget[]).map((spend) => {
                        const rowTiers = PLAN_MATRIX.filter(
                          (t) => t.spend === spend
                        );
                        const isRowActive = selectedSpend === spend;
                        return (
                          <div
                            key={spend}
                            className={`p-3 rounded-2xl border transition ${
                              isRowActive
                                ? 'bg-rose-50/50 border-rose-300'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                                월 {spend}만원 이상 사용 조건
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                월 {rowTiers[0].monthlyEquiv.toLocaleString()}원 할인 기준
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              {rowTiers.map((tier) => {
                                const isSelected =
                                  selectedSpend === tier.spend &&
                                  selectedMonths === tier.months;
                                return (
                                  <button
                                    key={`${tier.spend}-${tier.months}`}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSpend(tier.spend);
                                      setSelectedMonths(tier.months);
                                    }}
                                    className={`p-2.5 rounded-xl border-2 text-center transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-white text-slate-800 border-slate-200 hover:border-rose-300'
                                    }`}
                                  >
                                    <div
                                      className={`text-xs font-extrabold ${
                                        isSelected
                                          ? 'text-rose-100'
                                          : 'text-slate-500'
                                      }`}
                                    >
                                      {tier.months}개월 약정
                                    </div>
                                    <div className="text-sm sm:text-base font-black mt-0.5">
                                      {(tier.discount / 10000).toLocaleString()}만원
                                    </div>
                                    <div
                                      className={`text-[10px] font-bold ${
                                        isSelected
                                          ? 'text-amber-200'
                                          : 'text-rose-600'
                                      }`}
                                    >
                                      선 청구할인
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 우측: [3-2. 고객 맞춤 제안서 미리보기 & 인쇄 / 이미지 / 카톡 복사] */}
          {/* =================================================================== */}
          {(activeViewTab === 'both' || activeViewTab === 'preview') && (
            <div
              className={`space-y-4 ${
                activeViewTab === 'both' ? 'xl:col-span-7' : 'w-full'
              }`}
            >
              {/* 상단 액션 버튼 3종 */}
              <div className="no-print bg-slate-900 text-white rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 shadow-md">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span className="text-xs sm:text-sm font-black">
                    고객 제시용 맞춤 제안서 미리보기
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isExporting ? '이미지 저장중...' : '📸 제안서 이미지 저장'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-xs transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>🖨️ A4 제안서 인쇄</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyKakao}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer"
                  >
                    {copiedKakao ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>카톡 안내문 복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>📋 고객 카톡 안내문 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ==================== 제안서 본문 시트 ==================== */}
              <div
                ref={proposalRef}
                className="print-sheet bg-white rounded-3xl border border-slate-200 shadow-xl p-5 sm:p-7 space-y-5 text-slate-900"
              >
                {/* 1) 상단 헤더 */}
                <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-extrabold">
                        <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                        롯데하이마트 경기광주점 전용
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold">
                        롯데 플랜 카드 특별 혜택안
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      {proposalTitle}
                    </h2>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex flex-col items-end px-4 py-2 rounded-xl bg-slate-800 border border-slate-700">
                      <span className="text-[11px] font-bold text-slate-400">
                        적용 플랜 약정 조건
                      </span>
                      <span className="text-xs sm:text-sm font-black text-amber-300">
                        {isPlanServiceApplied
                          ? `월 ${selectedSpend}만원 × ${selectedMonths}개월 약정`
                          : '플랜 미신청 (기본 카드 혜택형)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1-2) 구매 품목 내역 및 카드 실결제 금액 요약 */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-rose-600" />
                      구매 품목 및 카드 결제 금액 요약
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      총 {items.length}개 품목
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      const lineTotal =
                        (Number(item.unitPrice) || 0) *
                        Math.max(1, Number(item.quantity) || 1);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {item.category || `가전품목 ${idx + 1}`}
                            </span>
                            {item.modelName && (
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {item.modelName}
                              </span>
                            )}
                            {item.quantity > 1 && (
                              <span className="text-xs font-extrabold text-rose-600">
                                × {item.quantity}개
                              </span>
                            )}
                          </div>
                          <span className="text-base font-black text-slate-900">
                            {lineTotal.toLocaleString()}원
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {calc.step1Deduction > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900">
                      <span>
                        선차감 할인 합계 (
                        {[
                          instantDiscount > 0
                            ? `즉시할인 -${instantDiscount.toLocaleString()}원`
                            : '',
                          lpointUsed > 0
                            ? `L.Point 사용 -${lpointUsed.toLocaleString()}원`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        )
                      </span>
                      <span className="font-black text-blue-700">
                        -{calc.step1Deduction.toLocaleString()}원
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-900 text-white rounded-xl px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm sm:text-base font-black text-slate-100">
                        💳 롯데 플랜 카드 실결제 금액
                      </span>
                      {calc.step1Deduction > 0 && (
                        <span className="ml-2 text-xs font-bold text-slate-400">
                          (총 행사가 {calc.totalPrice.toLocaleString()}원)
                        </span>
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
                      {calc.cardPayAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 2) 혜택별 상세 명세 카드 (3단 구성) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-slate-700">
                      ✨ 롯데 플랜 카드 핵심 혜택 상세 명세
                    </span>
                    <span className="text-xs font-black text-rose-600">
                      총 카드 혜택 -{calc.totalLotteCardBenefit.toLocaleString()}원
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* 💳 캐시백 혜택 */}
                    <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700">
                          <CreditCard className="w-4 h-4" />
                          💳 캐시백 혜택 (계좌 입금)
                        </div>
                        <div className="text-xs font-bold text-slate-600 leading-relaxed">
                          • 기본 캐시백: {calc.baseCashback40k.toLocaleString()}원
                          <br />• 플랜 신청 추가:{' '}
                          {calc.planExtraCashback20k.toLocaleString()}원
                          {extraCashback > 0 && (
                            <>
                              <br />• 추가 캐시백: {extraCashback.toLocaleString()}원
                            </>
                          )}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-rose-200/80 flex items-baseline justify-between">
                        <span className="text-[11px] font-extrabold text-rose-700">
                          익월 말일 입금
                        </span>
                        <span className="text-lg font-black text-rose-600">
                          -{calc.totalCashbackBenefit.toLocaleString()}원
                        </span>
                      </div>
                    </div>

                    {/* 📉 청구할인 혜택 */}
                    <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700">
                          <Sparkles className="w-4 h-4" />
                          📉 청구할인 혜택
                        </div>
                        <div className="text-xs font-bold text-slate-600 leading-relaxed">
                          • 기본 5% 청구할인:{' '}
                          {calc.billingDiscount5p.toLocaleString()}원
                          <br />• 플랜 선 청구할인:{' '}
                          {calc.planPreDiscount.toLocaleString()}원
                          {isPlanServiceApplied && (
                            <span className="block text-[11px] text-blue-700 font-extrabold">
                              (월 {selectedSpend}만 × {selectedMonths}개월)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-blue-200/80 flex items-baseline justify-between">
                        <span className="text-[11px] font-extrabold text-blue-700">
                          결제대금 청구할인
                        </span>
                        <span className="text-lg font-black text-blue-600">
                          -{calc.totalBillingBenefit.toLocaleString()}원
                        </span>
                      </div>
                    </div>

                    {/* 🪙 롤라머니 3% 적립 */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800">
                          <Coins className="w-4 h-4" />
                          🪙 롤라머니 3% 적립
                        </div>
                        <div className="text-xs font-bold text-slate-600 leading-relaxed">
                          • 결제금액의 3% (최대 3만점)
                          <br />• 결제 후 1주일 이내 적립
                          <br />• <strong className="text-amber-900">100% 현금 교환 가능</strong>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-amber-200/80 flex items-baseline justify-between">
                        <span className="text-[11px] font-extrabold text-amber-800">
                          로카앱 현금교환
                        </span>
                        <span className="text-lg font-black text-amber-700">
                          -{calc.lolaMoney3p.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3) 메인 최종 체감가 히어로 박스 */}
                <div className="bg-rose-50/80 border-2 border-rose-500 rounded-3xl p-6 text-center space-y-2.5 shadow-xs">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-rose-200 text-[11px] sm:text-xs font-extrabold text-slate-700">
                    <span>{formulaText}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black">
                      <Sparkles className="w-3.5 h-3.5" />
                      🎯 고객 최종 체감가 (총 혜택 -
                      {calc.totalLotteCardBenefit.toLocaleString()}원)
                    </span>
                  </div>

                  <div className="text-4xl sm:text-5xl font-black text-rose-600 tracking-tight py-1">
                    {calc.finalNetPrice.toLocaleString()}원
                  </div>

                  <div className="text-xs font-bold text-slate-600">
                    카드 실결제가 {calc.cardPayAmount.toLocaleString()}원 - 총 카드 혜택{' '}
                    {calc.totalLotteCardBenefit.toLocaleString()}원 차감 기준
                  </div>

                  {calc.finalNetPrice < 0 && (
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
                        🎉 결제 금액보다 총 혜택이 +
                        {Math.abs(calc.finalNetPrice).toLocaleString()}원 더 큽니다!
                      </span>
                    </div>
                  )}
                </div>

                {/* 4) 필수 고객 안내사항 박스 (하단 고정 표기 — 100% 필수 반영) */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="text-sm font-black text-amber-300">
                      📌 필수 고객 안내사항 (캐시백 입금 · 롤라머니 현금교환 · 플랜 약정)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                      <div className="font-black text-rose-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>📌 캐시백 입금 시기</span>
                      </div>
                      <p className="text-slate-200 font-medium">
                        <strong className="text-white underline underline-offset-2">
                          결제일 다음 달 말일
                        </strong>{' '}
                        고객님 결제 계좌로 입금됩니다.
                        <br />
                        <span className="text-slate-400 text-[11px]">
                          (기본 4만원 + 플랜 신청 시 추가 2만원 = 총 6만원)
                        </span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                      <div className="font-black text-amber-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>📌 롤라머니 적립 시기</span>
                      </div>
                      <p className="text-slate-200 font-medium">
                        <strong className="text-white underline underline-offset-2">
                          결제 후 1주일 이내
                        </strong>{' '}
                        적립됩니다.
                        <br />
                        <span className="text-slate-400 text-[11px]">
                          (결제금액의 3%, 최대 3만점 한도 · 현금으로 100% 교환 가능)
                        </span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                      <div className="font-black text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>📌 롤라머니 현금 교환 방법</span>
                      </div>
                      <p className="text-slate-200 font-medium">
                        스마트폰{' '}
                        <strong className="text-amber-300">
                          [로카앱(LOCA)] 접속 ➔ [포인트·캐시백] 메뉴 ➔ [롤라머니 캐시백]
                        </strong>{' '}
                        신청 시 현금으로 즉시 입금/교환됩니다.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                      <div className="font-black text-blue-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>📌 플랜 서비스 안내</span>
                      </div>
                      <p className="text-slate-200 font-medium">
                        매월 약정하신 목표 사용금액(70만/120만/200만원) 및 기간(12/24/36개월)
                        조건으로 해당 금액을 미리 청구할인 받는 서비스입니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
