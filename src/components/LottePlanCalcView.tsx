import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  Info,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
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
}

const PLAN_MATRIX: PlanTierOption[] = [
  // 70만원 사용조건
  { spend: 70, months: 12, discount: 240000 },
  { spend: 70, months: 24, discount: 480000 },
  { spend: 70, months: 36, discount: 720000 },
  // 120만원 사용조건
  { spend: 120, months: 12, discount: 300000 },
  { spend: 120, months: 24, discount: 600000 },
  { spend: 120, months: 36, discount: 900000 },
  // 200만원 사용조건
  { spend: 200, months: 12, discount: 360000 },
  { spend: 200, months: 24, discount: 720000 },
  { spend: 200, months: 36, discount: 1080000 },
];

const GENERAL_CATEGORY_PRESETS = [
  'TV',
  '냉장고',
  '김치냉장고',
  '세탁기',
  '건조기',
  '워시타워',
  '에어컨',
  '의류관리기',
  '청소기',
  '로봇청소기',
  '공기청정기',
  '식기세척기',
  '전기레인지',
  '정수기',
  '안마의자',
  '노트북',
  '컴퓨터',
  '모바일',
];

export const LottePlanCalcView: React.FC<LottePlanCalcViewProps> = ({
  onBackToHome,
}) => {
  // 단계 전환 상태 ('input' | 'preview', 기본값 'input')
  const [step, setStep] = useState<'input' | 'preview'>('input');

  // 스마트폰 물리 뒤로가기 연동: 제안서 화면('preview')일 때 뒤로가기를 누르면 조건 입력('input')으로 복귀
  useEffect(() => {
    if (step === 'preview') {
      try {
        window.history.pushState({ appGuard: true, tag: 'lotte-preview' }, '');
      } catch {
        // ignore
      }
    }
    (window as any).__subViewBackHandler = () => {
      if (step === 'preview') {
        setStep('input');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [step]);

  // 1) 품목 및 할인 상태
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

  // 2) 롯데 플랜 카드 기본 혜택 3종 ON/OFF
  const [useBaseCashback40k, setUseBaseCashback40k] = useState<boolean>(true);
  const [useBillingDiscount5p, setUseBillingDiscount5p] = useState<boolean>(true);
  const [useLolaMoney3p, setUseLolaMoney3p] = useState<boolean>(true);

  // 3) 플랜 서비스 신청 (ON/OFF 선택) 및 3×3 약정 구간
  const [isPlanServiceApplied, setIsPlanServiceApplied] = useState<boolean>(true);
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
        id: `lotte-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    setSelectedSpend(120);
    setSelectedMonths(24);
  };

  // 품목 조작 (ControlPanel.tsx의 일반구매 품목 조작과 동일)
  const handleAddEmptyItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `lotte-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: '',
        modelName: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleAddCategoryPreset = (presetCategory: string) => {
    setItems((prev) => {
      if (
        prev.length === 1 &&
        !prev[0].category.trim() &&
        !prev[0].modelName.trim() &&
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
      if (prev.length <= 1) return prev;
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleUpdateItem = (id: string, patch: Partial<LotteItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
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

    // 기본 혜택 1: 20만원 이상 결제 시 4만원 캐시백
    const eligibleBase40k = cardPayAmount >= 200000 ? 40000 : 0;
    const baseCashback40k = useBaseCashback40k ? eligibleBase40k : 0;

    // 기본 혜택 2: 5% 청구할인 (최대 5만원)
    const rawBilling5p = Math.min(Math.floor(cardPayAmount * 0.05), 50000);
    const billingDiscount5p = useBillingDiscount5p ? rawBilling5p : 0;

    // 기본 혜택 3: 3% 롤라머니 적립 (최대 3만점, 현금 교환 가능)
    const rawLola3p = Math.min(Math.floor(cardPayAmount * 0.03), 30000);
    const lolaMoney3p = useLolaMoney3p ? rawLola3p : 0;

    // 플랜 서비스 신청 시: 추가 2만원 캐시백 자동 합산 + 약정 구간 선 청구할인
    const planExtraCashback20k =
      isPlanServiceApplied && cardPayAmount > 0 ? 20000 : 0;

    const matchedTier =
      PLAN_MATRIX.find(
        (t) => t.spend === selectedSpend && t.months === selectedMonths
      ) || PLAN_MATRIX[4];

    const planPreDiscount =
      isPlanServiceApplied && cardPayAmount > 0 ? matchedTier.discount : 0;

    // 혜택 합산
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

    const finalNetPrice = cardPayAmount - totalLotteCardBenefit;

    return {
      totalPrice,
      step1Deduction,
      cardPayAmount,
      baseCashback40k,
      billingDiscount5p,
      lolaMoney3p,
      planExtraCashback20k,
      matchedTier,
      planPreDiscount,
      totalCashbackBenefit,
      totalBillingBenefit,
      totalLotteCardBenefit,
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
    selectedSpend,
    selectedMonths,
  ]);

  // 제안서 제목
  const validItemNames = items
    .map((it) => it.category.trim())
    .filter(Boolean);
  const proposalTitle =
    validItemNames.length === 0
      ? '롯데 플랜 카드 맞춤 구매 제안서'
      : validItemNames.length === 1
      ? `${validItemNames[0]} 롯데 플랜 맞춤 제안서`
      : `${validItemNames[0]} 외 ${validItemNames.length - 1}건 롯데 플랜 제안서`;

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
      '💳 롯데 플랜 카드 맞춤 제안서',
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
        `  • 기본 캐시백 (20만원 이상 결제): -${calc.baseCashback40k.toLocaleString()}원`
      );
    }
    if (calc.billingDiscount5p > 0) {
      lines.push(
        `  • 5% 청구할인 (최대 5만원): -${calc.billingDiscount5p.toLocaleString()}원`
      );
    }
    if (calc.lolaMoney3p > 0) {
      lines.push(
        `  • 3% 롤라머니 적립 (최대 3만점, 현금 교환 가능): -${calc.lolaMoney3p.toLocaleString()}원`
      );
    }
    if (isPlanServiceApplied) {
      if (calc.planExtraCashback20k > 0) {
        lines.push(
          `  • 플랜 서비스 신청 추가 캐시백: -${calc.planExtraCashback20k.toLocaleString()}원`
        );
      }
      if (calc.planPreDiscount > 0) {
        lines.push(
          `  • 플랜 서비스 선할인 (${selectedSpend}만원 사용조건 / ${selectedMonths}개월): -${calc.planPreDiscount.toLocaleString()}원`
        );
      }
    }
    if (extraCashback > 0) {
      lines.push(`  • 추가 캐시백: -${extraCashback.toLocaleString()}원`);
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
    lines.push('• 캐시백 입금: 결제일 다음 달 말일 입금');
    lines.push('• 롤라머니 적립: 결제 후 일주일 이내 적립');
    lines.push(
      '• 롤라머니 현금교환 방법: 로카앱 > 포인트·캐시백 메뉴 > 롤라머니 캐시백'
    );
    lines.push(
      `• 플랜 카드 사용기간: 약정 월 사용금액(${selectedSpend}만원)은 결제 다음 달부터 매월 1일 ~ 말일까지 사용 기준`
    );

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
    <div className="min-h-[calc(100dvh-44px)] w-full bg-slate-100 flex flex-col items-center justify-start py-4 sm:py-6 px-3 sm:px-5">
      {/* ==================== STEP 1: 조건 입력 화면 ==================== */}
      {step === 'input' && (
        <div className="w-full max-w-2xl lg:max-w-3xl mx-auto space-y-3">
          {/* 상단 네비게이션 바 */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs shadow-2xs transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 메인 화면으로
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-xs shadow-xs">
              <Calculator className="w-3.5 h-3.5" />
              <span>4. 롯데 플랜 계산기</span>
            </div>
          </div>

          {/* 단일 입력 카드 (1. 일반구매 견적 ControlPanel.tsx와 동일한 컨테이너 스타일) */}
          <div className="w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-4 sm:p-6 space-y-5">
            {/* 1. 구매 품목 및 행사가 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-rose-600" />
                  1. 구매 품목 및 행사가
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddEmptyItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> 품목 추가
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    title="전체 초기화"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-extrabold text-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> 초기화
                  </button>
                </div>
              </div>

              {/* 빠른 품목명 버튼 */}
              <div className="flex flex-wrap gap-1">
                {GENERAL_CATEGORY_PRESETS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleAddCategoryPreset(cat)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-extrabold text-[11px] border border-slate-200 transition cursor-pointer"
                  >
                    +{cat}
                  </button>
                ))}
              </div>

              {/* 품목 입력 행 (ControlPanel.tsx와 100% 동일한 1줄 12열 그리드) */}
              <div className="max-h-[210px] sm:max-h-[168px] overflow-y-auto space-y-1.5 pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200"
                  >
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          category: e.target.value,
                        })
                      }
                      placeholder={`품목명 ${idx + 1}`}
                      className="col-span-5 sm:col-span-3 order-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={item.modelName}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          modelName: e.target.value,
                        })
                      }
                      placeholder="상품코드/모델명"
                      className="col-span-6 sm:col-span-3 order-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:border-blue-600 focus:outline-none"
                    />
                    <div className="col-span-4 sm:col-span-2 order-4 sm:order-3 relative">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity || 1}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value) || 1);
                          handleUpdateItem(item.id, { quantity: q });
                        }}
                        className="w-full pl-2 pr-5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-center text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        개
                      </span>
                    </div>
                    <div className="col-span-8 sm:col-span-3 order-5 sm:order-4 relative">
                      <input
                        type="number"
                        step={10000}
                        value={item.unitPrice || ''}
                        onChange={(e) => {
                          const p = Math.max(0, Number(e.target.value));
                          handleUpdateItem(item.id, { unitPrice: p });
                        }}
                        placeholder="행사가(원)"
                        className="w-full pl-2 pr-5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-900 text-right focus:border-blue-600 focus:outline-none"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        원
                      </span>
                    </div>
                    <div className="col-span-1 sm:col-span-1 order-3 sm:order-5 flex justify-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 즉시할인, L.Point 사용, 추가 캐시백 3열 배치 */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-extrabold text-slate-600 block mb-1">
                    (-) 즉시할인 (원)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={instantDiscount || ''}
                    onChange={(e) =>
                      setInstantDiscount(Math.max(0, Number(e.target.value)))
                    }
                    placeholder="0"
                    className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-900 text-right focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-extrabold text-slate-600 block mb-1">
                    (-) L.Point 사용 (원)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={lpointUsed || ''}
                    onChange={(e) =>
                      setLpointUsed(Math.max(0, Number(e.target.value)))
                    }
                    placeholder="0"
                    className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-900 text-right focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-extrabold text-slate-600 block mb-1">
                    (-) 추가 캐시백 (원)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={extraCashback || ''}
                    onChange={(e) =>
                      setExtraCashback(Math.max(0, Number(e.target.value)))
                    }
                    placeholder="0"
                    className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-900 text-right focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. 롯데 플랜 카드 기본 혜택 3종 */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  2. 롯데 플랜 카드 기본 혜택 3종
                </label>
                <span className="text-[11px] font-extrabold text-slate-500">
                  카드 실결제가: {calc.cardPayAmount.toLocaleString()}원
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* ① 20만원 이상 결제 시 4만원 캐시백 */}
                <label
                  className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                    useBaseCashback40k
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="text-xs font-black text-slate-900">
                      4만원 캐시백
                    </span>
                    <input
                      type="checkbox"
                      checked={useBaseCashback40k}
                      onChange={(e) => setUseBaseCashback40k(e.target.checked)}
                      className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    20만원 이상 결제 시
                  </div>
                  <div className="text-sm font-black text-rose-600 text-right mt-1.5">
                    -{calc.baseCashback40k.toLocaleString()}원
                  </div>
                </label>

                {/* ② 5% 청구할인 (최대 5만원) */}
                <label
                  className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                    useBillingDiscount5p
                      ? 'bg-blue-50/70 border-blue-300'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="text-xs font-black text-slate-900">
                      5% 청구할인
                    </span>
                    <input
                      type="checkbox"
                      checked={useBillingDiscount5p}
                      onChange={(e) =>
                        setUseBillingDiscount5p(e.target.checked)
                      }
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    최대 5만원 한도
                  </div>
                  <div className="text-sm font-black text-blue-600 text-right mt-1.5">
                    -{calc.billingDiscount5p.toLocaleString()}원
                  </div>
                </label>

                {/* ③ 3% 롤라머니 적립 (최대 3만점, 현금 교환 가능) */}
                <label
                  className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                    useLolaMoney3p
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="text-xs font-black text-slate-900">
                      3% 롤라머니 적립
                    </span>
                    <input
                      type="checkbox"
                      checked={useLolaMoney3p}
                      onChange={(e) => setUseLolaMoney3p(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    최대 3만점 (현금 교환 가능)
                  </div>
                  <div className="text-sm font-black text-amber-700 text-right mt-1.5">
                    -{calc.lolaMoney3p.toLocaleString()}원
                  </div>
                </label>
              </div>
            </div>

            {/* 3. 플랜 서비스 신청 (ON/OFF 선택) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  3. 플랜 서비스 신청 (ON/OFF 선택)
                </label>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">
                  신청 시 추가 2만원 캐시백 자동 합산!
                </span>
              </div>

              {/* ON/OFF 버튼 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlanServiceApplied(true)}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border-2 transition cursor-pointer ${
                    isPlanServiceApplied
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  플랜 서비스 신청 (ON · +2만원 캐시백)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlanServiceApplied(false)}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border-2 transition cursor-pointer ${
                    !isPlanServiceApplied
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  플랜 서비스 미신청 (OFF)
                </button>
              </div>

              {/* 월 사용조건 및 약정기간 3×3 버튼 선택 */}
              {isPlanServiceApplied && (
                <div className="space-y-2 pt-1">
                  {([70, 120, 200] as PlanSpendTarget[]).map((spend) => {
                    const rowTiers = PLAN_MATRIX.filter(
                      (t) => t.spend === spend
                    );
                    const isRowActive = selectedSpend === spend;
                    return (
                      <div
                        key={spend}
                        className={`p-2.5 rounded-2xl border transition ${
                          isRowActive
                            ? 'bg-rose-50/50 border-rose-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 px-1">
                          <span className="text-xs font-black text-slate-900">
                            • {spend}만원 사용조건
                          </span>
                          {isRowActive && (
                            <span className="text-[11px] font-black text-rose-600">
                              선택됨 ({selectedMonths}개월 ·{' '}
                              {(calc.planPreDiscount / 10000).toLocaleString()}
                              만원)
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {rowTiers.map((tier) => {
                            const active =
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
                                className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                                  active
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                    : 'bg-white text-slate-800 border-slate-200 hover:border-rose-300'
                                }`}
                              >
                                <div
                                  className={`text-[11px] font-extrabold ${
                                    active ? 'text-rose-100' : 'text-slate-500'
                                  }`}
                                >
                                  {tier.months}개월
                                </div>
                                <div className="text-xs sm:text-sm font-black">
                                  {(tier.discount / 10000).toLocaleString()}만원
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 하단 요약 및 [맞춤 제안서 보기 ➔] 대형 버튼 */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
                  <span>
                    실결제가:{' '}
                    <strong className="text-white">
                      {calc.cardPayAmount.toLocaleString()}원
                    </strong>
                  </span>
                  <span>|</span>
                  <span>
                    총 카드혜택:{' '}
                    <strong className="text-rose-400">
                      -{calc.totalLotteCardBenefit.toLocaleString()}원
                    </strong>
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-amber-400">
                  최종 체감가 {calc.finalNetPrice.toLocaleString()}원
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('preview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>맞춤 제안서 보기</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STEP 2: 제안서 미리보기 화면 ==================== */}
      {step === 'preview' && (
        <div className="w-full max-w-4xl mx-auto space-y-4">
          {/* 상단 컨트롤 바: 좌측 [← 조건 다시 수정] / 우측 저장·인쇄·카톡복사 */}
          <div className="no-print bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setStep('input');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← 조건 다시 수정</span>
            </button>

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
                <span>🖨️ 제안서 인쇄</span>
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

          {/* 제안서 본문 시트 */}
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
                    롯데하이마트 경기광주점
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold">
                    롯데 플랜 카드 맞춤 혜택안
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {proposalTitle}
                </h2>
              </div>

              <div className="text-right">
                <div className="inline-flex flex-col items-end px-4 py-2 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400">
                    플랜 서비스 약정 조건
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-300">
                    {isPlanServiceApplied
                      ? `월 ${selectedSpend}만원 사용조건 × ${selectedMonths}개월`
                      : '플랜 서비스 미신청 (기본 혜택형)'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2) 구매 품목 내역 및 카드 실결제가 요약 */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-rose-600" />
                  구매 품목 및 카드 결제 금액
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
                          {item.category || `품목 ${idx + 1}`}
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
                    선차감 할인 (
                    {[
                      instantDiscount > 0
                        ? `즉시할인 -${instantDiscount.toLocaleString()}원`
                        : '',
                      lpointUsed > 0
                        ? `L.Point -${lpointUsed.toLocaleString()}원`
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

              <div className="bg-slate-900 text-white rounded-xl px-5 py-3 flex items-center justify-between">
                <span className="text-sm sm:text-base font-black text-slate-100">
                  💳 롯데 플랜 카드 실결제 금액
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  {calc.cardPayAmount.toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 3) 롯데 플랜 카드 혜택 3단 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 캐시백 혜택 */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700">
                    <CreditCard className="w-4 h-4" />
                    캐시백 혜택
                  </div>
                  <div className="text-xs font-bold text-slate-600 leading-relaxed">
                    • 기본 캐시백 (20만원 이상):{' '}
                    {calc.baseCashback40k.toLocaleString()}원
                    {isPlanServiceApplied && (
                      <>
                        <br />• 플랜 신청 추가 캐시백:{' '}
                        {calc.planExtraCashback20k.toLocaleString()}원
                      </>
                    )}
                    {extraCashback > 0 && (
                      <>
                        <br />• 추가 캐시백: {extraCashback.toLocaleString()}원
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-rose-200 flex items-baseline justify-between">
                  <span className="text-[11px] font-extrabold text-rose-700">
                    결제일 다음 달 말일 입금
                  </span>
                  <span className="text-lg font-black text-rose-600">
                    -{calc.totalCashbackBenefit.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 청구할인 혜택 */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700">
                    <Sparkles className="w-4 h-4" />
                    청구할인 혜택
                  </div>
                  <div className="text-xs font-bold text-slate-600 leading-relaxed">
                    • 5% 청구할인 (최대 5만원):{' '}
                    {calc.billingDiscount5p.toLocaleString()}원
                    {isPlanServiceApplied && (
                      <>
                        <br />• 플랜 선할인 ({selectedSpend}만/{selectedMonths}
                        개월): {calc.planPreDiscount.toLocaleString()}원
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-200 flex items-baseline justify-between">
                  <span className="text-[11px] font-extrabold text-blue-700">
                    청구할인 합계
                  </span>
                  <span className="text-lg font-black text-blue-600">
                    -{calc.totalBillingBenefit.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 3% 롤라머니 적립 */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800">
                    <Coins className="w-4 h-4" />
                    3% 롤라머니 적립
                  </div>
                  <div className="text-xs font-bold text-slate-600 leading-relaxed">
                    • 최대 3만점 적립 (현금 교환 가능)
                    <br />• 결제 후 일주일 이내 적립
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200 flex items-baseline justify-between">
                  <span className="text-[11px] font-extrabold text-amber-800">
                    로카앱 현금 교환
                  </span>
                  <span className="text-lg font-black text-amber-700">
                    -{calc.lolaMoney3p.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* 4) 최종 체감가 히어로 박스 */}
            <div className="bg-rose-50/80 border-2 border-rose-500 rounded-3xl p-6 text-center space-y-2 shadow-xs">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  🎯 고객 최종 체감가 (총 카드 혜택 -
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
            </div>

            {/* 5) 필수 고객 안내사항 */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-sm font-black text-amber-300">
                  📌 필수 고객 안내사항
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                  <div className="font-black text-rose-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>캐시백 입금</span>
                  </div>
                  <p className="text-slate-200 font-bold">
                    <strong className="text-white underline underline-offset-2">
                      결제일 다음 달 말일
                    </strong>{' '}
                    입금
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                  <div className="font-black text-amber-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>롤라머니 적립</span>
                  </div>
                  <p className="text-slate-200 font-bold">
                    <strong className="text-white underline underline-offset-2">
                      결제 후 일주일 이내
                    </strong>{' '}
                    적립
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                  <div className="font-black text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>롤라머니 현금교환 방법</span>
                  </div>
                  <p className="text-amber-300 font-black">
                    로카앱 &gt; 포인트·캐시백 메뉴 &gt; 롤라머니 캐시백
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                  <div className="font-black text-sky-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>플랜 월 사용금액 산정 기간</span>
                  </div>
                  {isPlanServiceApplied ? (
                    <p className="text-slate-200 font-bold">
                      약정하신 월 사용금액(월 {selectedSpend}만원 이상)은{' '}
                      <strong className="text-white underline underline-offset-2">
                        결제 다음 달부터 매월 1일 ~ 말일까지
                      </strong>{' '}
                      기준으로 산정하여 사용하셔야 합니다.
                    </p>
                  ) : (
                    <p className="text-slate-200 font-bold">
                      플랜 서비스 신청 시 약정 월 사용금액은{' '}
                      <strong className="text-white underline underline-offset-2">
                        결제 다음 달부터 매월 1일 ~ 말일까지
                      </strong>{' '}
                      기준으로 산정됩니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
