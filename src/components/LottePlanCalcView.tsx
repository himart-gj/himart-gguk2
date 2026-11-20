import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Lock,
  Info,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { scrollToTopInstant } from '../utils/mobileQaRuntime';
import {
  maskEmbeddedModelInCategory,
  maskModelCodeAfter3,
} from '../utils/modelMasker';
import { AppSubViewHeader } from './ui/AppSubViewHeader';
import { SurfaceCard } from './ui/SurfaceCard';
import { LedgerRow } from './ui/LedgerRow';
import { ViewportSafePopover } from './ui/ViewportSafePopover';
import { FormattedMoneyInput } from './FormattedMoneyInput';

interface LottePlanCalcViewProps {
  onBackToHome: () => void;
  backLabel?: string;
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
  backLabel,
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
        scrollToTopInstant();
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

  // 2) 롯데 플랜 제휴카드 기본 혜택 3종 ON/OFF
  const [useBaseCashback40k, setUseBaseCashback40k] = useState<boolean>(true);
  const [useBillingDiscount5p, setUseBillingDiscount5p] = useState<boolean>(true);
  const [useLolaMoney3p, setUseLolaMoney3p] = useState<boolean>(true);

  // 3) 플랜 서비스 신청 (ON/OFF 선택) 및 3×3 약정 구간
  const [isPlanServiceApplied, setIsPlanServiceApplied] = useState<boolean>(true);
  const [selectedSpend, setSelectedSpend] = useState<PlanSpendTarget>(120);
  const [selectedMonths, setSelectedMonths] = useState<PlanMonths>(24);

  // 내보내기 / 복사 피드백 상태
  const proposalRef = useRef<HTMLDivElement>(null);
  const savePrintBtnRef = useRef<HTMLButtonElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingMode, setExportingMode] = useState<'full' | 'masked' | null>(null);
  const [isModelMasked, setIsModelMasked] = useState(false);
  const [tempMaskOverride, setTempMaskOverride] = useState<boolean | null>(null);
  const [isSavePrintOpen, setIsSavePrintOpen] = useState(false);
  const effectiveMaskModels =
    tempMaskOverride !== null ? tempMaskOverride : isModelMasked;

  const fmtModel = (raw?: string | null) =>
    effectiveMaskModels ? maskModelCodeAfter3(raw) : (raw || '').trim();
  const fmtCat = (raw?: string | null) =>
    effectiveMaskModels ? maskEmbeddedModelInCategory(raw) : (raw || '').trim();
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
    .map((it) => fmtCat(it.category))
    .filter(Boolean);
  const proposalTitle =
    validItemNames.length === 0
      ? '롯데 플랜 제휴카드 맞춤 구매 제안서'
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
        const dispMod = isModelMasked
          ? maskModelCodeAfter3(it.modelName)
          : it.modelName;
        const dispCat = isModelMasked
          ? maskEmbeddedModelInCategory(it.category)
          : it.category;
        const modelStr = dispMod ? ` (${dispMod})` : '';
        const qtyStr = it.quantity > 1 ? ` × ${it.quantity}개` : '';
        return `  ${idx + 1}. ${dispCat || '가전품목'}${modelStr}${qtyStr}: ${lineAmt.toLocaleString()}원`;
      });

    const lines: string[] = [
      '==============================',
      '[롯데하이마트 경기광주점]',
      '💳 롯데 플랜 제휴카드 맞춤 제안서',
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
    lines.push('■ 롯데 플랜 제휴카드 혜택 상세');
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

  const handleDownloadImage = async (maskModels = false) => {
    setIsSavePrintOpen(false);
    if (!proposalRef.current || isExporting) return;
    setIsExporting(true);
    setExportingMode(maskModels ? 'masked' : 'full');
    setTempMaskOverride(maskModels);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      await new Promise((resolve) => setTimeout(resolve, 60));

      const dataUrl = await toPng(proposalRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      const suffix = maskModels ? '롯데플랜_맞춤제안서_모델가림' : '롯데플랜_맞춤제안서';
      link.download = `${suffix}_${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('제안서 이미지 저장 실패:', err);
    } finally {
      setTempMaskOverride(null);
      setExportingMode(null);
      setIsExporting(false);
    }
  };

  const handlePrint = async (maskOverride?: boolean) => {
    setIsSavePrintOpen(false);
    if (typeof maskOverride === 'boolean') {
      setTempMaskOverride(maskOverride);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.print();
      setTempMaskOverride(null);
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-[calc(100dvh-54px)] w-full bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 flex flex-col items-stretch justify-start pb-12 transition-colors">
      <AppSubViewHeader
        title={step === 'input' ? '4. 롯데 플랜 계산기' : '롯데 플랜 맞춤 제안서'}
        badge={step === 'input' ? '제휴카드 · 선할인' : '고객 안내용'}
        subtitle={
          step === 'input'
            ? '구매 품목 · 플랜 약정 구간별 청구할인 · 캐시백 · 최종 체감가 산출'
            : isPlanServiceApplied
            ? `월 ${selectedSpend}만원 사용조건 × ${selectedMonths}개월 약정`
            : '플랜 서비스 미신청 (기본 혜택형)'
        }
        icon={
          step === 'input' ? (
            <Calculator className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />
          ) : (
            <CreditCard className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />
          )
        }
        onBack={
          step === 'input'
            ? onBackToHome
            : () => {
                setStep('input');
                scrollToTopInstant();
              }
        }
        backLabel={step === 'input' ? backLabel || '홈으로' : '조건 다시 수정'}
        maxWidthClass={step === 'input' ? 'max-w-3xl' : 'max-w-4xl'}
        className="top-[54px]"
        rightSlot={
          step === 'preview' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <button
                  ref={savePrintBtnRef}
                  type="button"
                  onClick={() => setIsSavePrintOpen((v) => !v)}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExporting
                      ? exportingMode === 'masked'
                        ? '가림 저장중...'
                        : '이미지 저장중...'
                      : '📥 저장 · 인쇄'}
                  </span>
                  {isModelMasked && (
                    <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[11.5px] font-black">
                      가림ON
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                <ViewportSafePopover
                  isOpen={isSavePrintOpen}
                  onClose={() => setIsSavePrintOpen(false)}
                  anchorRef={savePrintBtnRef}
                  preferredWidth={296}
                  align="end"
                  mobileFullWidth
                  className="rounded-2xl bg-[#131C2E] text-white border border-slate-700 shadow-2xl p-2.5 space-y-1.5"
                >
                  <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800">
                    <span className="text-[11.5px] font-black text-slate-300">
                      📥 롯데 플랜 제안서 저장 · 인쇄
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSavePrintOpen(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage(true)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white transition flex items-start gap-2.5 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black">
                        모델가림 이미지 저장 (앞 3글자만)
                      </div>
                      <div className="text-[11.5px] text-blue-100 font-medium mt-0.5">
                        비교견적 방지용 *** 마스킹 이미지 저장
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage(false)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>원본 이미지 저장 (전체 모델명)</span>
                  </button>

                  <div className="border-t border-slate-800 my-1" />

                  <button
                    type="button"
                    onClick={() => handlePrint(true)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-300" />
                    <span>모델가림 상태로 인쇄 (앞 3글자만)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrint(false)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#FF3B47]" />
                    <span>원본 제안서 인쇄 (전체 모델명)</span>
                  </button>

                  <div className="border-t border-slate-800 my-1" />

                  <button
                    type="button"
                    onClick={() => setIsModelMasked((v) => !v)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between transition cursor-pointer ${
                      isModelMasked
                        ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isModelMasked ? (
                        <EyeOff className="w-3.5 h-3.5 text-emerald-300" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>화면·카톡복사 모델가림</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11.5px] font-black bg-slate-700">
                      {isModelMasked ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </ViewportSafePopover>
              </div>

              <button
                type="button"
                onClick={handleCopyKakao}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer ${
                  copiedKakao
                    ? 'bg-[#059669] text-white'
                    : 'bg-[#191F28] hover:bg-slate-800 text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                }`}
              >
                {copiedKakao ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
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
          ) : undefined
        }
      />

      <div className="w-full px-3 sm:px-5 pt-4 sm:pt-5">
        {/* ==================== STEP 1: 조건 입력 화면 ==================== */}
        {step === 'input' && (
          <div className="w-full max-w-3xl mx-auto space-y-3">
            {/* 단일 입력 카드 */}
            <SurfaceCard className="p-4 sm:p-6 space-y-5 shadow-sm">
              {/* 1. 구매 품목 및 행사가 */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-xs sm:text-sm font-black text-[#191F28] dark:text-slate-50 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />
                    1. 구매 품목 및 행사가
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAddEmptyItem}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white font-extrabold text-xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 품목 추가
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      title="전체 초기화"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border border-[#E5E8EB] dark:border-slate-700 font-extrabold text-xs transition cursor-pointer"
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
                      className="px-2 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/90 hover:bg-[#EFF6FF] dark:hover:bg-blue-500/15 hover:text-[#1B64DA] dark:hover:text-blue-300 text-[#4E5968] dark:text-slate-300 font-extrabold text-[11.5px] border border-[#E5E8EB] dark:border-slate-700 transition cursor-pointer"
                    >
                      +{cat}
                    </button>
                  ))}
                </div>

                {/* 품목 입력 행 */}
                <div className="max-h-none sm:max-h-[196px] sm:overflow-y-auto space-y-2 sm:space-y-1.5 sm:pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-1.5 items-center bg-[#F8FAFC] dark:bg-slate-900/70 p-2 rounded-xl border border-[#E5E8EB] dark:border-slate-800"
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
                        className="col-span-5 sm:col-span-3 order-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
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
                        className="col-span-6 sm:col-span-3 order-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-semibold font-mono text-[#191F28] dark:text-slate-200 focus:border-[#1B64DA] focus:outline-none"
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
                          className="w-full pl-2 pr-6 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-mono tabular-nums font-extrabold text-center text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400 pointer-events-none">
                          개
                        </span>
                      </div>
                      <div className="col-span-8 sm:col-span-3 order-5 sm:order-4 relative">
                        <FormattedMoneyInput
                          stepAmount={10000}
                          value={item.unitPrice || ''}
                          onValueChange={(numericValue) => {
                            handleUpdateItem(item.id, {
                              unitPrice: Math.max(0, numericValue),
                            });
                          }}
                          placeholder="행사가(원)"
                          className="w-full pl-2 pr-6 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 sm:text-xs font-black text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400 pointer-events-none">
                          원
                        </span>
                      </div>
                      <div className="col-span-1 sm:col-span-1 order-3 sm:order-5 flex justify-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-[#8B95A1] hover:text-[#E60012] rounded-lg hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 즉시할인, L.Point 사용, 추가 캐시백 반응형 배치 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                    <label className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 block mb-1">
                      (-) 즉시할인 (원)
                    </label>
                    <FormattedMoneyInput
                      stepAmount={10000}
                      value={instantDiscount || ''}
                      onValueChange={(numericValue) =>
                        setInstantDiscount(Math.max(0, numericValue))
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 sm:text-xs font-black text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                    />
                  </div>

                  <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                    <label className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 block mb-1">
                      (-) L.Point 사용 (원)
                    </label>
                    <FormattedMoneyInput
                      stepAmount={1000}
                      value={lpointUsed || ''}
                      onValueChange={(numericValue) =>
                        setLpointUsed(Math.max(0, numericValue))
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 sm:text-xs font-black text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                    />
                  </div>

                  <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                    <label className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 block mb-1">
                      (-) 추가 캐시백 (원)
                    </label>
                    <FormattedMoneyInput
                      stepAmount={10000}
                      value={extraCashback || ''}
                      onValueChange={(numericValue) =>
                        setExtraCashback(Math.max(0, numericValue))
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 sm:text-xs font-black text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 롯데 플랜 제휴카드 기본 혜택 3종 */}
              <div className="space-y-2.5 pt-3 border-t border-[#E5E8EB] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs sm:text-sm font-black text-[#191F28] dark:text-slate-50 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                    2. 롯데 플랜 제휴카드 기본 혜택 3종
                  </label>
                  <span className="text-[11.5px] font-extrabold font-mono tabular-nums text-[#4E5968] dark:text-slate-300">
                    카드 실결제가: {calc.cardPayAmount.toLocaleString()}원
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* ① 20만원 이상 결제 시 4만원 캐시백 */}
                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      useBaseCashback40k
                        ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-xs font-black text-[#191F28] dark:text-slate-100">
                        4만원 캐시백
                      </span>
                      <input
                        type="checkbox"
                        checked={useBaseCashback40k}
                        onChange={(e) => setUseBaseCashback40k(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#059669] cursor-pointer"
                      />
                    </div>
                    <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                      20만원 이상 결제 시
                    </div>
                    <div className="text-sm font-black font-mono tabular-nums text-[#059669] dark:text-emerald-400 text-right mt-1.5">
                      -{calc.baseCashback40k.toLocaleString()}원
                    </div>
                  </label>

                  {/* ② 5% 청구할인 (최대 5만원) */}
                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      useBillingDiscount5p
                        ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#BFDBFE] dark:border-blue-500/30'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-xs font-black text-[#191F28] dark:text-slate-100">
                        5% 청구할인
                      </span>
                      <input
                        type="checkbox"
                        checked={useBillingDiscount5p}
                        onChange={(e) =>
                          setUseBillingDiscount5p(e.target.checked)
                        }
                        className="w-4 h-4 rounded accent-[#1B64DA] cursor-pointer"
                      />
                    </div>
                    <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                      최대 5만원 한도
                    </div>
                    <div className="text-sm font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 text-right mt-1.5">
                      -{calc.billingDiscount5p.toLocaleString()}원
                    </div>
                  </label>

                  {/* ③ 3% 롤라머니 적립 (최대 3만점, 현금 교환 가능) */}
                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer ${
                      useLolaMoney3p
                        ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#BFDBFE] dark:border-blue-500/30'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-xs font-black text-[#191F28] dark:text-slate-100">
                        3% 롤라머니 적립
                      </span>
                      <input
                        type="checkbox"
                        checked={useLolaMoney3p}
                        onChange={(e) => setUseLolaMoney3p(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#1B64DA] cursor-pointer"
                      />
                    </div>
                    <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                      최대 3만점 (현금 교환 가능)
                    </div>
                    <div className="text-sm font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 text-right mt-1.5">
                      -{calc.lolaMoney3p.toLocaleString()}원
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. 플랜 서비스 신청 (ON/OFF 선택) */}
              <div className="space-y-3 pt-3 border-t border-[#E5E8EB] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs sm:text-sm font-black text-[#191F28] dark:text-slate-50 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                    3. 플랜 서비스 신청 (ON/OFF 선택)
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-300 text-[11.5px] font-black">
                    신청 시 추가 2만원 캐시백 자동 합산!
                  </span>
                </div>

                {/* ON/OFF 버튼 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlanServiceApplied(true)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border transition cursor-pointer ${
                      isPlanServiceApplied
                        ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA] shadow-xs'
                        : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
                    }`}
                  >
                    플랜 서비스 신청 (ON · +2만원 캐시백)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlanServiceApplied(false)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border transition cursor-pointer ${
                      !isPlanServiceApplied
                        ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA] shadow-xs'
                        : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
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
                              ? 'bg-[#EFF6FF] dark:bg-blue-500/10 border-[#BFDBFE] dark:border-blue-500/30'
                              : 'bg-[#F8FAFC] dark:bg-slate-900/70 border-[#E5E8EB] dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-xs font-black text-[#191F28] dark:text-slate-100">
                              • {spend}만원 사용조건
                            </span>
                            {isRowActive && (
                              <span className="text-[11.5px] font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">
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
                                      ? 'bg-[#1B64DA] text-white border-[#1B64DA] shadow-xs'
                                      : 'bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 border-[#D1D6DB] dark:border-slate-700 hover:border-[#1B64DA]'
                                  }`}
                                >
                                  <div
                                    className={`text-[11.5px] font-extrabold font-mono tabular-nums ${
                                      active
                                        ? 'text-blue-100'
                                        : 'text-[#8B95A1] dark:text-slate-400'
                                    }`}
                                  >
                                    {tier.months}개월
                                  </div>
                                  <div className="text-xs sm:text-sm font-black font-mono tabular-nums">
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

              {/* 하단 원장 요약 및 [맞춤 제안서 보기 ➔] 대형 버튼 */}
              <div className="pt-3 border-t border-[#E5E8EB] dark:border-slate-800 space-y-3">
                <SurfaceCard tone="sub" padded={false} className="px-4 py-3 space-y-0.5">
                  <LedgerRow
                    label="품목 행사가 합계"
                    value={`${calc.totalPrice.toLocaleString()}원`}
                    bold
                  />
                  {calc.step1Deduction > 0 && (
                    <LedgerRow
                      label="선차감 할인 (즉시할인 · L.Point)"
                      value={`-${calc.step1Deduction.toLocaleString()}원`}
                      tone="benefit"
                    />
                  )}
                  <LedgerRow
                    label="카드 실결제 금액"
                    value={`${calc.cardPayAmount.toLocaleString()}원`}
                    bold
                  />
                  <LedgerRow
                    label="롯데 플랜 총 카드 혜택 (청구할인 · 캐시백 · 적립)"
                    value={`-${calc.totalLotteCardBenefit.toLocaleString()}원`}
                    tone="benefit"
                    bold
                  />
                  <div className="pt-2 mt-1.5 border-t border-[#E5E8EB] dark:border-slate-700 flex items-baseline justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-[#191F28] dark:text-slate-50">
                      고객 최종 체감가
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#E60012] dark:text-[#FF3B47]">
                      {calc.finalNetPrice.toLocaleString()}원
                    </span>
                  </div>
                </SurfaceCard>

                <button
                  type="button"
                  onClick={() => {
                    setStep('preview');
                    scrollToTopInstant();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#E60012] hover:bg-[#C8000F] text-white font-black text-base shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>맞춤 제안서 보기</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </SurfaceCard>
          </div>
        )}

        {/* ==================== STEP 2: 제안서 미리보기 화면 ==================== */}
        {step === 'preview' && (
          <div className="w-full max-w-4xl mx-auto space-y-4">
            {/* 제안서 본문 시트 (인쇄·PNG 내보내기 고정 라이트 페이퍼 규격) */}
            <div
              ref={proposalRef}
              className="print-sheet bg-white rounded-3xl border border-[#E5E8EB] border-t-[4px] border-t-[#E60012] shadow-lg p-5 sm:p-7 space-y-5 text-[#191F28]"
            >
              {/* 1) 상단 헤더 */}
              <div className="bg-[#191F28] text-white rounded-2xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-extrabold">
                      <CreditCard className="w-3.5 h-3.5" />
                      롯데하이마트 경기광주점
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[11.5px] font-extrabold">
                      롯데 플랜 제휴카드 맞춤 혜택안
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {proposalTitle}
                  </h2>
                </div>

                <div className="text-right">
                  <div className="inline-flex flex-col items-end px-4 py-2 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[11.5px] font-bold text-slate-300">
                      플랜 서비스 약정 조건
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-blue-300">
                      {isPlanServiceApplied
                        ? `월 ${selectedSpend}만원 사용조건 × ${selectedMonths}개월`
                        : '플랜 서비스 미신청 (기본 혜택형)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2) 구매 품목 내역 및 카드 실결제가 요약 */}
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E8EB] p-4 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-[#4E5968] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#E60012]" />
                    구매 품목 및 카드 결제 금액
                  </span>
                  <span className="text-xs font-bold font-mono tabular-nums text-[#8B95A1]">
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
                        className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-[#E5E8EB]"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-[#191F28] text-white text-[11.5px] font-black font-mono flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-black text-[#191F28]">
                            {fmtCat(item.category) || `품목 ${idx + 1}`}
                          </span>
                          {item.modelName && (
                            <span className="text-xs font-bold text-[#4E5968] bg-[#F2F4F6] px-2 py-0.5 rounded-md font-mono">
                              {fmtModel(item.modelName)}
                            </span>
                          )}
                          {item.quantity > 1 && (
                            <span className="text-xs font-extrabold font-mono tabular-nums text-[#1B64DA]">
                              × {item.quantity}개
                            </span>
                          )}
                        </div>
                        <span className="text-base font-black font-mono tabular-nums text-[#191F28]">
                          {lineTotal.toLocaleString()}원
                        </span>
                      </div>
                    );
                  })}
                </div>

                {calc.step1Deduction > 0 && (
                  <div className="ledger-row px-4 py-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-bold text-[#1B64DA]">
                    <span className="ledger-row-label">
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
                    <span className="ledger-row-value font-mono font-black text-[#1B64DA]">
                      -{calc.step1Deduction.toLocaleString()}원
                    </span>
                  </div>
                )}

                <div className="bg-[#191F28] text-white rounded-xl px-5 py-3 flex items-center justify-between">
                  <span className="text-sm sm:text-base font-black text-white">
                    💳 롯데 플랜 제휴카드 실결제 금액
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                    {calc.cardPayAmount.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 3) 롯데 플랜 제휴카드 혜택 3단 요약 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 캐시백 혜택 */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#059669]">
                      <CreditCard className="w-4 h-4" />
                      캐시백 혜택
                    </div>
                    <div className="text-xs font-bold text-[#4E5968] leading-relaxed font-mono tabular-nums">
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
                  <div className="pt-2 border-t border-emerald-200 flex items-baseline justify-between">
                    <span className="text-[11.5px] font-extrabold text-[#059669]">
                      결제일 다음 달 말일 입금
                    </span>
                    <span className="text-lg font-black font-mono tabular-nums text-[#059669]">
                      -{calc.totalCashbackBenefit.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 청구할인 혜택 */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#1B64DA]">
                      <Sparkles className="w-4 h-4" />
                      청구할인 혜택
                    </div>
                    <div className="text-xs font-bold text-[#4E5968] leading-relaxed font-mono tabular-nums">
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
                  <div className="pt-2 border-t border-[#BFDBFE] flex items-baseline justify-between">
                    <span className="text-[11.5px] font-extrabold text-[#1B64DA]">
                      청구할인 합계
                    </span>
                    <span className="text-lg font-black font-mono tabular-nums text-[#1B64DA]">
                      -{calc.totalBillingBenefit.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 3% 롤라머니 적립 */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#1B64DA]">
                      <Coins className="w-4 h-4" />
                      3% 롤라머니 적립
                    </div>
                    <div className="text-xs font-bold text-[#4E5968] leading-relaxed">
                      • 최대 3만점 적립 (현금 교환 가능)
                      <br />• 결제 후 일주일 이내 적립
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#BFDBFE] flex items-baseline justify-between">
                    <span className="text-[11.5px] font-extrabold text-[#1B64DA]">
                      로카앱 현금 교환
                    </span>
                    <span className="text-lg font-black font-mono tabular-nums text-[#1B64DA]">
                      -{calc.lolaMoney3p.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 4) 최종 체감가 히어로 박스 */}
              <div className="bg-[#FFF1F2] border-2 border-[#E60012] rounded-3xl p-6 text-center space-y-2 shadow-2xs">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E60012] text-white text-xs font-black">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    🎯 고객 최종 체감가 (총 카드 혜택 -
                    {calc.totalLotteCardBenefit.toLocaleString()}원)
                  </span>
                </div>

                <div className="text-4xl sm:text-5xl font-black font-mono tabular-nums text-[#E60012] tracking-tight py-1">
                  {calc.finalNetPrice.toLocaleString()}원
                </div>

                <div className="text-xs font-bold font-mono tabular-nums text-[#4E5968]">
                  카드 실결제가 {calc.cardPayAmount.toLocaleString()}원 - 총 카드 혜택{' '}
                  {calc.totalLotteCardBenefit.toLocaleString()}원 차감 기준
                </div>
              </div>

              {/* 5) 필수 고객 안내사항 */}
              <div className="bg-[#191F28] text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <Info className="w-4 h-4 text-blue-300 shrink-0" />
                  <h3 className="text-sm font-black text-white">
                    📌 필수 고객 안내사항
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                    <div className="font-black text-emerald-300 flex items-center gap-1.5">
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
                    <div className="font-black text-blue-300 flex items-center gap-1.5">
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
                    <p className="text-blue-200 font-black">
                      로카앱 &gt; 포인트·캐시백 메뉴 &gt; 롤라머니 캐시백
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                    <div className="font-black text-blue-300 flex items-center gap-1.5">
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
    </div>
  );
};
