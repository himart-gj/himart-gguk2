import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  applyAllGeneralPlansPatch,
  calculateGeneralHiPreedSummary,
  calculateGeneralPurchaseSummary,
  calculateHiPlusSummary,
  calculateSubscriptionSummary,
  confirmActiveGeneralPlanInState,
  getActiveCompareModes,
  getGeneralPlan1And2Summaries,
  getValidDisplayModelName,
  ProposalState,
  QuoteMode,
  switchGeneralPlanInState,
  switchQuoteModeInState,
} from '../types/proposal';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Printer,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { SpringNumberFlow } from './SpringNumberFlow';
import { ShareQuoteLinkModal } from './CustomerShareQuoteView';
import { maskEmbeddedModelInCategory, maskModelCodeAfter3 } from '../utils/modelMasker';
import { ProposalPreviewSubAndHybrid } from './ProposalPreviewSubAndHybrid';
import { MultiModeTabSwitcherBanner, PreviewModeComparisonBar } from './MultiModeComparisonSection';
import { ProposalPreviewFreedGuide } from './ProposalPreviewFreedGuide';
import { PreedSafetyGuideBox } from './ProposalComplianceBlocks';
import { ViewportSafePopover } from './ui/ViewportSafePopover';
import { scrollToTopInstant } from '../utils/mobileQaRuntime';

interface ProposalPreviewProps {
  state: ProposalState;
  onChange: React.Dispatch<React.SetStateAction<ProposalState>>;
  onBackToInput: () => void;
  activeCustomer?: { id: string; name: string; phone?: string; activeQuoteId?: string } | null;
  onOpenSaveToCrm?: () => void;
  onSwitchMode?: (mode: QuoteMode) => void;
  embeddedSplitMode?: boolean;
  isDark?: boolean;
}

const SHEET_WIDTH = 920;

export const ProposalPreview: React.FC<ProposalPreviewProps> = ({
  state,
  onChange,
  onBackToInput,
  activeCustomer,
  onOpenSaveToCrm,
  onSwitchMode,
  embeddedSplitMode = false,
  isDark = false,
}) => {
  const [isShareLinkOpen, setIsShareLinkOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [shareInitialMasked, setShareInitialMasked] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const proposalSheetRef = useRef<HTMLDivElement>(null);
  const guideSheetRef = useRef<HTMLDivElement>(null);
  const shareMenuBtnRef = useRef<HTMLButtonElement>(null);
  const savePrintBtnRef = useRef<HTMLButtonElement>(null);

  const [scale, setScale] = useState(1);
  const [sheetH, setSheetH] = useState(860);
  const [isMobilePhone, setIsMobilePhone] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [mobileReadableMode, setMobileReadableMode] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState(false);
  const useMobileFluid = isMobilePhone && mobileReadableMode && !isExporting && !embeddedSplitMode;
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
  const [activeTab, setActiveTab] = useState<
    'proposal' | 'guide-general' | 'guide-sub'
  >('proposal');

  useLayoutEffect(() => {
    if (embeddedSplitMode) {
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
      return;
    }
    scrollToTopInstant([viewportRef.current]);
  }, [activeTab, embeddedSplitMode]);

  const activePlan = state.activeGeneralPlan || 1;
  const {
    allPlans,
    hasMultiplePlans,
  } = getGeneralPlan1And2Summaries(state);
  const hasBothPlans = hasMultiplePlans;

  // ==================== 데이터 계산 ====================
  const generalSummary = calculateGeneralPurchaseSummary(state);
  const generalHiPreedSummary = calculateGeneralHiPreedSummary(
    state.generalHiPreedCounts,
    Boolean(state.hideHiPreed)
  );

  const subSummary = calculateSubscriptionSummary(state);
  const representativePeriod = subSummary.representativePeriod;
  const periodLabel = subSummary.periodLabel;

  const currentCard = subSummary.currentCard;
  const currentCardTier = subSummary.currentCardTier;
  const hiSummary = subSummary.hiSummary;

  const totalBaseMonthly = subSummary.totalBaseMonthly;
  const totalPrincipal = subSummary.totalPrincipal;

  const cardMonthlyDiscount = subSummary.cardDiscount;
  const hiPlusMonthlySupport = subSummary.hiPlusMonthly;

  const finalMonthlyFee = subSummary.finalMonthlyFee;
  const finalTotal60Fee = subSummary.finalTotalFee;

  // 안내서 표시용: 프리드 선택이 0건이면 대표 1구좌 기준으로 안내 수치 표시
  const guideGeneralSummary =
    generalHiPreedSummary.totalAccounts > 0
      ? generalHiPreedSummary
      : calculateGeneralHiPreedSummary({
          hf75: 0,
          hf150: 1,
          hf225: 0,
          hf300: 0,
        });

  const guideHiSummary =
    hiSummary.totalAccounts > 0
      ? hiSummary
      : calculateHiPlusSummary(
          { hi72: 0, hi90: 0, hi108: 1 },
          representativePeriod
        );

  const isGuideTab =
    activeTab === 'guide-general' || activeTab === 'guide-sub';

  const handleToggleHideHiPreed = () => {
    const nextHidden = !state.hideHiPreed;
    if (nextHidden && activeTab === 'guide-general') {
      setActiveTab('proposal');
    }
    onChange((prev) =>
      applyAllGeneralPlansPatch(prev, (plan) => ({
        ...plan,
        hideHiPreed: nextHidden,
      }))
    );
  };

  const handleToggleHideSubPreed = () => {
    const nextHidden = !state.hideSubPreed;
    if (nextHidden && activeTab === 'guide-sub') {
      setActiveTab('proposal');
    }
    onChange((prev) =>
      applyAllGeneralPlansPatch(prev, (plan) => ({
        ...plan,
        hideSubPreed: nextHidden,
      }))
    );
  };

  useEffect(() => {
    if (isGuideTab || isShareLinkOpen || isShareMenuOpen || isSavePrintOpen) {
      try {
        window.history.pushState({ appGuard: true, tag: 'preview-sub' }, '');
      } catch {
        // ignore
      }
    }
    const handler = (): boolean => {
      if (isShareLinkOpen) {
        setIsShareLinkOpen(false);
        return true;
      }
      if (isShareMenuOpen) {
        setIsShareMenuOpen(false);
        return true;
      }
      if (isSavePrintOpen) {
        setIsSavePrintOpen(false);
        return true;
      }
      if (activeTab === 'guide-general' || activeTab === 'guide-sub') {
        setActiveTab('proposal');
        return true;
      }
      return false;
    };
    if (embeddedSplitMode) {
      (window as any).__proposalPreviewSplitBackHandler = handler;
      return () => {
        delete (window as any).__proposalPreviewSplitBackHandler;
      };
    }
    (window as any).__subViewBackHandler = handler;
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [
    activeTab,
    isGuideTab,
    embeddedSplitMode,
    isShareLinkOpen,
    isShareMenuOpen,
    isSavePrintOpen,
  ]);

  // 2D Auto-Fit 스케일링: 가로폭은 무조건 상수 920 고정
  useEffect(() => {
    const updateScale = () => {
      if (!viewportRef.current) return;
      const activeEl = isGuideTab
        ? guideSheetRef.current
        : proposalSheetRef.current;
      if (!activeEl) return;

      const availW = viewportRef.current.clientWidth;
      const availH = viewportRef.current.clientHeight;
      const sheetW = 920;
      const nextSheetH = Math.max(
        720,
        activeEl.scrollHeight || activeEl.offsetHeight || 960
      );

      setSheetH(nextSheetH);

      const viewportWidth = window.innerWidth || availW;
      setIsMobilePhone(viewportWidth < 640);
      let nextScale: number;

      if (viewportWidth < 640) {
        nextScale = Math.min(1, (availW - 16) / sheetW);
      } else if (viewportWidth < 1180 && !isGuideTab) {
        nextScale = Math.min(1, (availW - 20) / sheetW);
      } else if (viewportWidth >= 1280) {
        nextScale = Math.min(
          1.08,
          (availW - 32) / sheetW,
          (availH - 28) / nextSheetH
        );
      } else {
        nextScale = Math.min(
          1,
          (availW - 24) / sheetW,
          (availH - 24) / nextSheetH
        );
      }

      setScale(Math.max(0.25, nextScale));
    };

    updateScale();
    const rafId = requestAnimationFrame(updateScale);

    const observer = new ResizeObserver(updateScale);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (proposalSheetRef.current) observer.observe(proposalSheetRef.current);
    if (guideSheetRef.current) observer.observe(guideSheetRef.current);

    window.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [activeTab, isGuideTab, state]);

  const handleSwitchGeneralPlan = (targetPlan: number) => {
    onChange((prev) => switchGeneralPlanInState(prev, targetPlan));
  };

  const handleConfirmSinglePlanInPreview = () => {
    onChange((prev) => confirmActiveGeneralPlanInState(prev, activePlan));
  };

  const handleDownloadPng = async (maskModels = false) => {
    setIsSavePrintOpen(false);
    const targetNode = isGuideTab
      ? guideSheetRef.current
      : proposalSheetRef.current;
    if (!targetNode || isExporting) return;

    setIsExporting(true);
    setExportingMode(maskModels ? 'masked' : 'full');
    setTempMaskOverride(maskModels);

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      await new Promise((resolve) => setTimeout(resolve, 60));

      const exportW = SHEET_WIDTH;
      const exportH = Math.max(
        720,
        targetNode.scrollHeight || targetNode.offsetHeight || 960
      );

      const dataUrl = await toPng(targetNode, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: exportW,
        height: exportH,
        style: {
          transform: 'none',
        },
      });
      const link = document.createElement('a');
      const suffix =
        activeTab === 'guide-general'
          ? '하이프리드안내서'
          : activeTab === 'guide-sub'
          ? '구독프리드안내서'
          : maskModels
          ? '맞춤제안서_모델가림'
          : '맞춤제안서';
      link.download = `고객_${suffix}_${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('이미지 저장 실패:', error);
    } finally {
      setTempMaskOverride(null);
      setExportingMode(null);
      setIsExporting(false);
    }
  };

  const handlePrint = async (maskOverride?: boolean) => {
    setIsSavePrintOpen(false);
    if (typeof maskOverride === 'boolean' && !isGuideTab) {
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

  const validGeneralNames = state.generalItems
    .map((it) => fmtCat(it.category))
    .filter(Boolean);
  const generalHeaderTitle =
    validGeneralNames.length === 0
      ? '맞춤 가전 패키지 구매 제안서'
      : validGeneralNames.length === 1
      ? `${validGeneralNames[0]} 맞춤 구매 제안서`
      : `${validGeneralNames[0]} 외 ${validGeneralNames.length - 1}건 맞춤 구매 제안서`;

  const validSubNames = state.items
    .map((it) => fmtCat(it.category))
    .filter(Boolean);
  const subHeaderTitle =
    validSubNames.length === 0
      ? `맞춤 가전 구독 제안서 (${periodLabel})`
      : validSubNames.length === 1
      ? `${validSubNames[0]} 구독 제안서 (${periodLabel})`
      : `${validSubNames[0]} 외 ${validSubNames.length - 1}건 구독 제안서 (${periodLabel})`;

  const step1DiscountRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.instantDiscount > 0
      ? [
          {
            key: 'instant-base',
            label: '기본 즉시할인',
            amount: generalSummary.instantDiscount,
          },
        ]
      : []),
    ...(generalSummary.extraDiscountItems || []).map((it, idx) => ({
      key: it.id || `extra-disc-${idx}`,
      label: (it.description || '').trim() || '추가 즉시할인',
      amount: Math.max(0, Number(it.amount) || 0),
    })),
    ...(generalSummary.pointUsed > 0
      ? [
          {
            key: 'point-used',
            label: '포인트 즉시사용',
            amount: generalSummary.pointUsed,
          },
        ]
      : []),
  ];

  const step2CashbackRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.tierCashback > 0
      ? [
          {
            key: 'tier-cashback',
            label: '금액대별 캐시백',
            amount: generalSummary.tierCashback,
          },
        ]
      : []),
    ...(generalSummary.extraCashback > 0
      ? [
          {
            key: 'extra-cashback',
            label: '배송익월 추가 캐시백',
            amount: generalSummary.extraCashback,
          },
        ]
      : []),
  ];

  const step2ExtraRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.extraEtcItems || []).map((it, idx) => ({
      key: it.id || `extra-etc-${idx}`,
      label: (it.description || '').trim() || '추가 혜택',
      amount: Math.max(0, Number(it.amount) || 0),
    })),
    ...(generalSummary.remainingPoints > 0
      ? [
          {
            key: 'remaining-points',
            label: '잔여 포인트 차감',
            amount: generalSummary.remainingPoints,
          },
        ]
      : []),
  ];

  const subCardBenefitLabel =
    currentCard?.benefitType === '캐시백' ||
    currentCard?.id === 'lotte' ||
    currentCard?.id === 'shinhan'
      ? '캐시백'
      : '청구할인';

  const subCashbackDetailParts: string[] = [];
  if (subSummary.subTierCashback > 0) {
    subCashbackDetailParts.push(
      `${currentCard?.shortName || '제휴카드'} 금액대별 캐시백(원금 ${Math.floor(
        totalPrincipal / 10000
      ).toLocaleString()}만원 구간) -${subSummary.subTierCashback.toLocaleString()}원`
    );
  }
  if (subSummary.subExtraCashback > 0) {
    subCashbackDetailParts.push(
      `추가 캐시백 -${subSummary.subExtraCashback.toLocaleString()}원`
    );
  }

  const subFormulaParts = ['월 구독료'];
  if (cardMonthlyDiscount > 0) subFormulaParts.push(`제휴카드${subCardBenefitLabel}`);
  if (hiPlusMonthlySupport > 0) subFormulaParts.push('구독프리드');
  const subFormulaText = subFormulaParts.join(' − ');

  const hybridTotalDiscountAndSupport =
    generalSummary.totalDiscountAndBenefit + subSummary.totalSubBenefit;
  const hybridCombinedNetTotal = generalSummary.rawNet + finalTotal60Fee;
  const activeCompareModes = getActiveCompareModes(state);
  const todayText = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const formatPlanBadgePrice = (planNum: number) => {
    const pEntry = allPlans[planNum - 1];
    if (!pEntry) return `${planNum}안`;
    const gSum = pEntry.genSummary;
    const sSum = pEntry.subSummary;
    if (state.quoteMode === 'subscription') {
      return sSum.totalBaseMonthly > 0
        ? `${planNum}안 · 월 ${sSum.finalMonthlyFee.toLocaleString()}`
        : `${planNum}안`;
    }
    if (state.quoteMode === 'hybrid') {
      return gSum.sum > 0 || sSum.totalBaseMonthly > 0
        ? `${planNum}안 · ${Math.round(gSum.rawNet / 10000).toLocaleString()}만+월${Math.round(sSum.finalMonthlyFee / 1000).toLocaleString()}천`
        : `${planNum}안`;
    }
    return gSum.sum > 0
      ? `${planNum}안 · ${Math.round(gSum.rawNet / 10000).toLocaleString()}만`
      : `${planNum}안`;
  };

  return (
    <div
      className={`${
        embeddedSplitMode ? 'h-full' : 'min-h-[calc(100dvh-54px)]'
      } w-full flex flex-col ${
        isDark ? 'bg-[#0B1120]' : 'bg-[#E9EDF2]'
      } select-none`}
    >
      {/* ==================== 상단 엔터프라이즈 액션바 (중복 뒤로가기·중복 좌우 분할 버튼 제거) ==================== */}
      <header
        style={embeddedSplitMode ? { top: 0 } : { top: 'var(--app-header-h, 54px)' }}
        className={`no-print sticky z-30 shrink-0 w-full backdrop-blur-md border-b px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 ${
          isDark
            ? 'bg-[#131C2E]/95 border-white/10 text-slate-100'
            : 'bg-white/95 border-[#E5E8EB] text-[#191F28]'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* 시트 전환 세그먼트 (제안서 / 프리드 안내서) */}
          <div
            className={`inline-flex items-center p-0.5 rounded-lg border shrink-0 ${
              isDark
                ? 'bg-[#0B1120] border-white/10'
                : 'bg-[#F2F4F6] border-[#E5E8EB]'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('proposal')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
                activeTab === 'proposal'
                  ? isDark
                    ? 'bg-[#60A5FA] text-[#0B1120] shadow-xs'
                    : 'bg-[#191F28] text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-[#4E5968] hover:text-[#191F28]'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>
                {state.quoteMode === 'hybrid'
                  ? '통합 제안서'
                  : state.quoteMode === 'subscription'
                  ? '구독 제안서'
                  : '구매 제안서'}
              </span>
            </button>

            {state.quoteMode === 'general' && !state.hideHiPreed && (
              <button
                type="button"
                onClick={() => setActiveTab('guide-general')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'guide-general'
                    ? 'bg-[#1B64DA] text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-[#4E5968] hover:text-[#191F28]'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>하이프리드 안내</span>
                {generalHiPreedSummary.totalAccounts > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[11.5px]">
                    {generalHiPreedSummary.totalAccounts}
                  </span>
                )}
              </button>
            )}

            {state.quoteMode === 'subscription' && !state.hideSubPreed && (
              <button
                type="button"
                onClick={() => setActiveTab('guide-sub')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'guide-sub'
                    ? 'bg-[#1B64DA] text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-[#4E5968] hover:text-[#191F28]'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>구독프리드 안내</span>
                {hiSummary.totalAccounts > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[11.5px]">
                    {hiSummary.totalAccounts}
                  </span>
                )}
              </button>
            )}

            {state.quoteMode === 'hybrid' && (
              <>
                {!state.hideHiPreed && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide-general')}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
                      activeTab === 'guide-general'
                        ? 'bg-[#1B64DA] text-white shadow-xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>일반프리드</span>
                  </button>
                )}
                {!state.hideSubPreed && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide-sub')}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-extrabold text-xs transition cursor-pointer whitespace-nowrap ${
                      activeTab === 'guide-sub'
                        ? 'bg-[#1B64DA] text-white shadow-xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>구독프리드</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* 좌우 동시 보기(embeddedSplitMode)에서는 바로 왼쪽 패널에 동일한 컨트롤이 있으므로 중복 노출하지 않고 전체화면 제안서에서만 표시 */}
          {!embeddedSplitMode && (
            <>
              {/* 다중 안(1안 ~ N안) 전환 세그먼트 + 선택안 확정 버튼 (2안 이상일 때만 노출) */}
              {allPlans.length >= 2 && (
                <>
                  <div
                    className={`inline-flex flex-wrap items-center p-0.5 rounded-lg border shrink-0 ${
                      isDark
                        ? 'bg-[#0B1120] border-white/10'
                        : 'bg-[#F2F4F6] border-[#E5E8EB]'
                    }`}
                  >
                    {allPlans.map((pEntry) => (
                      <button
                        key={pEntry.planNum}
                        type="button"
                        onClick={() => handleSwitchGeneralPlan(pEntry.planNum)}
                        className={`px-2.5 py-1 rounded-md font-extrabold text-xs tabular-nums transition cursor-pointer whitespace-nowrap ${
                          activePlan === pEntry.planNum
                            ? 'bg-[#1B64DA] text-white shadow-xs'
                            : isDark
                            ? 'text-slate-400 hover:text-white'
                            : 'text-[#4E5968] hover:text-[#191F28]'
                        }`}
                      >
                        {formatPlanBadgePrice(pEntry.planNum)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmSinglePlanInPreview}
                    title="현재 보고 있는 안만 남기고 나머지 비교안을 정리해 단독 1안으로 확정합니다"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-extrabold transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    <span>{activePlan}안 확정</span>
                  </button>
                </>
              )}

              {/* 프리드 표시/숨김 컴팩트 토글 */}
              {(state.quoteMode === 'general' || state.quoteMode === 'hybrid') && (
                <button
                  type="button"
                  onClick={handleToggleHideHiPreed}
                  title="일반 하이프리드 영역 표시/숨김"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                    state.hideHiPreed
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : isDark
                      ? 'bg-[#1E293B] border-white/10 text-slate-300 hover:text-white'
                      : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:text-[#191F28]'
                  }`}
                >
                  {state.hideHiPreed ? (
                    <EyeOff className="w-3 h-3 text-amber-600" />
                  ) : (
                    <Eye className="w-3 h-3 text-[#1B64DA]" />
                  )}
                  <span>{state.hideHiPreed ? '프리드 숨김중' : '프리드 표시'}</span>
                </button>
              )}

              {(state.quoteMode === 'subscription' || state.quoteMode === 'hybrid') && (
                <button
                  type="button"
                  onClick={handleToggleHideSubPreed}
                  title="구독프리드 영역 표시/숨김"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                    state.hideSubPreed
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : isDark
                      ? 'bg-[#1E293B] border-white/10 text-slate-300 hover:text-white'
                      : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:text-[#191F28]'
                  }`}
                >
                  {state.hideSubPreed ? (
                    <EyeOff className="w-3 h-3 text-amber-600" />
                  ) : (
                    <Eye className="w-3 h-3 text-[#1B64DA]" />
                  )}
                  <span>{state.hideSubPreed ? '구독프리드 숨김중' : '구독프리드 표시'}</span>
                </button>
              )}

              <PreviewModeComparisonBar
                state={state}
                onChange={onChange}
                onSwitchMode={onSwitchMode}
                onEnsureProposalTab={() => setActiveTab('proposal')}
              />
            </>
          )}

          {isMobilePhone && !embeddedSplitMode && (
            <button
              type="button"
              onClick={() => setMobileReadableMode((v) => !v)}
              className={`sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg font-extrabold text-[11.5px] border transition cursor-pointer whitespace-nowrap shrink-0 ${
                mobileReadableMode
                  ? 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                  : isDark
                  ? 'bg-[#1E293B] text-slate-300 border-white/10'
                  : 'bg-white text-[#4E5968] border-[#E5E8EB]'
              }`}
            >
              <span>{mobileReadableMode ? '모바일 스토리뷰' : 'A4 인쇄비율'}</span>
            </button>
          )}
        </div>

        {/* 우측 발송 · 저장 · 인쇄 액션 그룹 */}
        <div
          className={`grid ${
            onOpenSaveToCrm && !embeddedSplitMode ? 'grid-cols-3' : 'grid-cols-2'
          } sm:flex items-center gap-1.5 shrink-0 w-full sm:w-auto`}
        >
          {/* 고객 공유 링크 CTA */}
          <div className="relative">
            <button
              ref={shareMenuBtnRef}
              type="button"
              onClick={() => {
                setIsSavePrintOpen(false);
                setIsShareMenuOpen((v) => !v);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E60012] hover:bg-[#C8000F] text-white font-extrabold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>고객 공유 링크</span>
              <ChevronDown className="w-3 h-3 opacity-85" />
            </button>

            <ViewportSafePopover
              isOpen={isShareMenuOpen}
              onClose={() => setIsShareMenuOpen(false)}
              anchorRef={shareMenuBtnRef}
              preferredWidth={320}
              align="end"
              mobileFullWidth
              className={`rounded-2xl border shadow-2xl p-3 space-y-2 ${
                isDark
                  ? 'bg-[#131C2E] text-slate-100 border-white/15'
                  : 'bg-white text-[#191F28] border-[#D1D6DB]'
              }`}
            >
              <div
                className={`px-1 pb-2 flex items-center justify-between border-b ${
                  isDark ? 'border-white/10' : 'border-[#E5E8EB]'
                }`}
              >
                <span
                  className={`text-xs font-black ${
                    isDark ? 'text-slate-100' : 'text-[#191F28]'
                  }`}
                >
                  고객 전용 스토리 뷰어 링크 발송
                </span>
                <button
                  type="button"
                  onClick={() => setIsShareMenuOpen(false)}
                  className="text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsShareMenuOpen(false);
                  setShareInitialMasked(true);
                  setIsShareLinkOpen(true);
                }}
                className="w-full text-left px-3.5 py-3 rounded-xl bg-[#191F28] dark:bg-[#1E293B] hover:bg-[#262F3D] dark:hover:bg-[#273549] text-white transition flex items-start gap-2.5 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#FF6B78] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5 flex-wrap">
                    <span>모델가림 보안 링크 발송</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-extrabold">
                      타점 비교방지
                    </span>
                  </div>
                  <div className="text-[11.5px] text-slate-300 font-medium mt-0.5 break-keep leading-snug">
                    모델코드 앞 3자리만 공개하고 뒷자리는 *** 처리해 전송
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsShareMenuOpen(false);
                  setShareInitialMasked(false);
                  setIsShareLinkOpen(true);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition flex items-start gap-2.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#0B1120] hover:bg-slate-800 border-white/10 text-slate-100'
                    : 'bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#E5E8EB] text-[#191F28]'
                }`}
              >
                <FileText className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black break-keep">
                    전체 모델명 공개 링크 발송
                  </div>
                  <div
                    className={`text-[11.5px] font-medium mt-0.5 break-keep leading-snug ${
                      isDark ? 'text-slate-400' : 'text-[#4E5968]'
                    }`}
                  >
                    원본 모델코드 전체를 그대로 포함해 전송
                  </div>
                </div>
              </button>
            </ViewportSafePopover>
          </div>

          {onOpenSaveToCrm && !embeddedSplitMode && (
            <button
              type="button"
              onClick={onOpenSaveToCrm}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg font-extrabold text-xs border transition cursor-pointer whitespace-nowrap ${
                isDark
                  ? 'bg-[#1E293B] border-white/10 text-slate-100 hover:bg-[#273549]'
                  : 'bg-white border-[#D1D6DB] text-[#191F28] hover:bg-[#F2F4F6]'
              }`}
            >
              <Save className="w-3.5 h-3.5 text-[#1B64DA]" />
              <span>고객저장</span>
            </button>
          )}

          {/* 저장 · 인쇄 드롭다운 */}
          <div className="relative">
            <button
              ref={savePrintBtnRef}
              type="button"
              onClick={() => {
                setIsShareMenuOpen(false);
                setIsSavePrintOpen((v) => !v);
              }}
              disabled={isExporting}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg font-extrabold text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                isDark
                  ? 'bg-white text-[#191F28] hover:bg-slate-200'
                  : 'bg-[#191F28] text-white hover:bg-[#262F3D]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting
                  ? exportingMode === 'masked'
                    ? '가림 저장중...'
                    : '이미지 저장중...'
                  : '저장 · 인쇄'}
              </span>
              {!isGuideTab && isModelMasked && (
                <span className="px-1.5 py-0.2 rounded bg-[#E60012] text-white text-[11.5px] font-black">
                  가림ON
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            <ViewportSafePopover
              isOpen={isSavePrintOpen}
              onClose={() => setIsSavePrintOpen(false)}
              anchorRef={savePrintBtnRef}
              preferredWidth={320}
              align="end"
              mobileFullWidth
              className={`rounded-2xl border shadow-2xl p-3 space-y-1.5 ${
                isDark
                  ? 'bg-[#131C2E] text-slate-100 border-white/15'
                  : 'bg-white text-[#191F28] border-[#D1D6DB]'
              }`}
            >
              <div
                className={`px-1 pb-2 flex items-center justify-between border-b ${
                  isDark ? 'border-white/10' : 'border-[#E5E8EB]'
                }`}
              >
                <span
                  className={`text-xs font-black ${
                    isDark ? 'text-slate-100' : 'text-[#191F28]'
                  }`}
                >
                  제안서 이미지 저장 · A4 인쇄
                </span>
                <button
                  type="button"
                  onClick={() => setIsSavePrintOpen(false)}
                  className="text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {!isGuideTab ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadPng(true)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-[#191F28] dark:bg-[#1E293B] hover:bg-[#262F3D] dark:hover:bg-[#273549] text-white transition flex items-start gap-2.5 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-[#FF6B78] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black flex items-center gap-1.5">
                        <span>모델가림 이미지 저장</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#E60012] text-white text-[11.5px] font-extrabold">
                          비교방지
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-300 font-medium mt-0.5 break-keep">
                        앞 3자리만 표시하고 뒷자리 *** 마스킹 저장
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPng(false)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center gap-2 text-xs font-extrabold cursor-pointer ${
                      isDark
                        ? 'bg-[#0B1120] hover:bg-slate-800 border-white/10 text-slate-100'
                        : 'bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-[#1B64DA] dark:text-[#60A5FA]" />
                    <span>원본 이미지 저장 (전체 모델명)</span>
                  </button>

                  <div
                    className={`border-t my-1 ${
                      isDark ? 'border-white/10' : 'border-[#E5E8EB]'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => handlePrint(true)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center gap-2 text-xs font-extrabold cursor-pointer ${
                      isDark
                        ? 'bg-[#0B1120] hover:bg-slate-800 border-white/10 text-slate-100'
                        : 'bg-[#F8FAFC] hover:bg-[#FFF1F2] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5 text-[#E60012] dark:text-[#FF3B47]" />
                    <span>모델가림 상태로 인쇄 (앞 3자리만)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrint(false)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center gap-2 text-xs font-extrabold cursor-pointer ${
                      isDark
                        ? 'bg-[#0B1120] hover:bg-slate-800 border-white/10 text-slate-100'
                        : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>원본 제안서 인쇄 (전체 모델명)</span>
                  </button>

                  <div
                    className={`border-t my-1 ${
                      isDark ? 'border-white/10' : 'border-[#E5E8EB]'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setIsModelMasked((v) => !v)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between transition cursor-pointer ${
                      isModelMasked
                        ? 'bg-[#FFF1F2] dark:bg-rose-500/15 border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-rose-300'
                        : isDark
                        ? 'bg-[#0B1120] border-white/10 text-slate-300 hover:bg-slate-800'
                        : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isModelMasked ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>화면 미리보기 모델가림</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11.5px] font-black ${
                        isModelMasked
                          ? 'bg-[#E60012] text-white'
                          : isDark
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-[#E5E8EB] text-[#4E5968]'
                      }`}
                    >
                      {isModelMasked ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadPng(false)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-[#191F28] hover:bg-[#262F3D] text-white text-xs font-black flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>안내서 이미지 저장</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint()}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-black flex items-center gap-2 cursor-pointer ${
                      isDark
                        ? 'bg-[#0B1120] hover:bg-slate-800 border-white/10 text-slate-100'
                        : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <Printer className="w-4 h-4 text-[#E60012]" />
                    <span>안내서 A4 인쇄</span>
                  </button>
                </>
              )}
            </ViewportSafePopover>
          </div>
        </div>
      </header>

      {/* ==================== 복수 구매방식 비교 탭 전환 바 ==================== */}
      {activeCompareModes.length >= 2 && activeTab === 'proposal' && (
        <div className="no-print w-full max-w-[920px] mx-auto px-2.5 sm:px-4 pt-3">
          <MultiModeTabSwitcherBanner
            state={state}
            onSelectMode={(m) => {
              if (onSwitchMode) {
                onSwitchMode(m);
              } else {
                onChange((prev) => switchQuoteModeInState(prev, m));
              }
            }}
            compact
          />
        </div>
      )}

      {/* ==================== 중앙 2D Auto-Fit 뷰포트 ==================== */}
      <div
        ref={viewportRef}
        data-scroll-container="true"
        className="print-stage flex-1 min-h-0 w-full flex items-start justify-center overflow-x-hidden overflow-y-auto p-2 sm:p-4"
      >
        <div
          style={
            useMobileFluid
              ? { width: '100%', height: 'auto' }
              : {
                  width: `${Math.round(920 * scale)}px`,
                  height: `${Math.round(sheetH * scale)}px`,
                }
          }
          className={`sheet-scale-wrapper relative shrink-0 ${
            useMobileFluid ? 'w-full overflow-visible' : 'overflow-hidden'
          }`}
        >
          {/* ===================================================================== */}
          {/* TAB 1: 고객 맞춤 스토리 제안서 (#sheet-proposal) — Lotte Himart Flagship */}
          {/* ===================================================================== */}
          {activeTab === 'proposal' && (
            <div
              id="sheet-proposal"
              ref={proposalSheetRef}
              style={
                useMobileFluid
                  ? { width: '100%', minWidth: 0, height: 'auto', transform: 'none' }
                  : {
                      width: '920px',
                      minWidth: '920px',
                      height: 'auto',
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }
              }
              className={`print-sheet shrink-0 bg-white rounded-2xl shadow-xl border border-[#D1D6DB] border-t-[4px] border-t-[#E60012] overflow-hidden p-5 sm:p-8 space-y-5 text-[#191F28] ${
                useMobileFluid ? 'mobile-fluid-sheet' : ''
              }`}
            >
              {/* -------------------- CASE A: 일반구매 단독 스토리 제안서 -------------------- */}
              {state.quoteMode === 'general' && (
                <div className="space-y-5">
                  {/* 공식 문서 마스트헤드 */}
                  <div className="border-b border-[#E5E8EB] pb-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-wider">
                          LOTTE HIMART
                        </span>
                        <span className="text-xs font-extrabold text-[#4E5968]">
                          경기광주점 공식 맞춤 제안서
                        </span>
                        {hasBothPlans && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#191F28] text-white text-[11.5px] font-extrabold">
                            견적 {activePlan}안
                          </span>
                        )}
                        {activeCustomer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold">
                            <User className="w-3 h-3" />
                            {activeCustomer.name} 고객님 맞춤 설계
                          </span>
                        )}
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#191F28] break-keep leading-tight">
                        {generalHeaderTitle}
                      </h1>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F8FAFC] border border-[#E5E8EB] text-xs font-extrabold text-[#191F28] whitespace-nowrap">
                        <CreditCard className="w-3.5 h-3.5 text-[#1B64DA]" />
                        {state.generalCardType === '미정' || state.generalCardType === '일반카드'
                          ? '제휴카드 미적용'
                          : state.generalCardType}
                      </span>
                      <span className="text-[11.5px] font-semibold text-[#8B95A1] tabular-nums">
                        설계일 {todayText}
                      </span>
                    </div>
                  </div>

                  {/* 한 줄 스토리 브리핑 배너 — 고객이 읽자마자 3초 만에 이해하는 요약 */}
                  <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5E8EB] px-4 py-3.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs sm:text-[13.5px] font-semibold text-[#4E5968] leading-relaxed break-keep">
                      {generalSummary.totalDiscountAndBenefit > 0 && generalSummary.sum > 0 ? (
                        <>
                          선택하신 <strong className="font-extrabold text-[#191F28]">{state.generalItems.length}품목</strong> 기준가{' '}
                          <strong className="font-mono font-bold text-[#191F28]">{generalSummary.sum.toLocaleString()}원</strong>에서 총{' '}
                          <strong className="font-mono font-extrabold text-[#1B64DA]">
                            -{generalSummary.totalDiscountAndBenefit.toLocaleString()}원(
                            {Math.min(99, Math.round((generalSummary.totalDiscountAndBenefit / generalSummary.sum) * 100))}%↓)
                          </strong>{' '}
                          혜택을 적용해, 최종 체감가{' '}
                          <strong className="font-mono font-extrabold text-[#E60012]">
                            {generalSummary.rawNet.toLocaleString()}원
                          </strong>
                          으로 구매하시는 맞춤 제안입니다.
                        </>
                      ) : (
                        <>
                          선택하신 <strong className="font-extrabold text-[#191F28]">{state.generalItems.length}품목</strong> 패키지에 대한 롯데하이마트 경기광주점 공식 견적 안내입니다.
                        </>
                      )}
                    </p>
                  </div>

                  {/* 3-Beat Visual Price Story Flow (① 매장 결제 ➔ ② 사후 환급 ➔ ③ 최종 체감가) */}
                  <div
                    className={`grid gap-3 ${
                      useMobileFluid
                        ? 'grid-cols-1 sm:grid-cols-3'
                        : 'grid-cols-3 mobile-keep-grid'
                    }`}
                  >
                    {/* Beat 1: 오늘 매장 카드 실결제가 */}
                    <div className="rounded-2xl bg-[#191F28] text-white p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11.5px] font-extrabold text-slate-300">
                          ① 오늘 매장 카드 실결제가
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl sm:text-2xl font-black tracking-tight font-mono tabular-nums whitespace-nowrap">
                          <SpringNumberFlow value={generalSummary.payPrice} suffix="원" />
                        </div>
                        <div className="text-[11.5px] font-medium text-slate-300 mt-1 tabular-nums break-keep">
                          {generalSummary.totalStep1InstantDiscount + generalSummary.hiFreedSupport > 0
                            ? `기준가에서 현장 -${(generalSummary.totalStep1InstantDiscount + generalSummary.hiFreedSupport).toLocaleString()}원 차감`
                            : `기준가 합계 ${generalSummary.sum.toLocaleString()}원`}
                        </div>
                      </div>
                    </div>

                    {/* Beat 2: 결제 후 돌려받는 캐시백·포인트 */}
                    <div className="rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11.5px] font-extrabold text-[#1B64DA]">
                          ② 결제 후 돌려받는 환급 혜택
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl sm:text-2xl font-black tracking-tight text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                          {generalSummary.totalStep2Cashback + generalSummary.totalStep2ExtraBenefit > 0
                            ? `-${(generalSummary.totalStep2Cashback + generalSummary.totalStep2ExtraBenefit).toLocaleString()}원`
                            : '0원'}
                        </div>
                        <div className="text-[11.5px] font-semibold text-[#4E5968] mt-1 break-keep">
                          {generalSummary.totalStep2Cashback + generalSummary.totalStep2ExtraBenefit > 0
                            ? '카드 캐시백 · 포인트 사후 적립/입금'
                            : '현장 즉시 차감 중심 설계'}
                        </div>
                      </div>
                    </div>

                    {/* Beat 3: 모든 혜택 반영 최종 체감 구매가 */}
                    <div className="rounded-2xl bg-[#FFF1F2] border-2 border-[#E60012] p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-black text-[#E60012]">
                          <Sparkles className="w-3.5 h-3.5" />
                          ③ 최종 혜택 체감 구매가
                        </span>
                        {generalSummary.totalDiscountAndBenefit > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#FECDD3] text-[#E60012] text-[11.5px] font-extrabold tabular-nums whitespace-nowrap">
                            총 -{generalSummary.totalDiscountAndBenefit.toLocaleString()}원 혜택
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <div className="text-2xl sm:text-[28px] font-black tracking-tight text-[#E60012] font-mono tabular-nums whitespace-nowrap leading-none">
                          <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
                        </div>
                        <div className="text-[11.5px] font-bold text-[#4E5968] mt-1.5 break-keep">
                          ① 실결제가에서 ② 환급 혜택을 모두 뺀 실질 부담금
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 1: 선택하신 가전 패키지 구성 */}
                  <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
                    <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#191F28] text-white text-[11.5px] font-extrabold whitespace-nowrap">
                          STEP 1
                        </span>
                        <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28]">
                          선택하신 가전 패키지 구성 ({generalSummary.displayItems.length}품목)
                        </span>
                      </div>
                      <span className="text-[11.5px] font-bold text-[#8B95A1]">
                        기준 행사가
                      </span>
                    </div>
                    <div className="divide-y divide-[#E5E8EB]">
                      {generalSummary.displayItems.map((item, idx) => {
                        const lineTotal =
                          (Number(item.unitPrice) || 0) *
                          Math.max(1, Number(item.quantity) || 1);
                        const validModel = getValidDisplayModelName(
                          item.modelName,
                          item.unitPrice
                        );
                        return (
                          <div
                            key={item.id}
                            className="ledger-row px-4 sm:px-5 py-3 hover:bg-[#F8FAFC]/80 transition-colors"
                          >
                            <div className="ledger-row-label flex items-center gap-2.5 flex-wrap">
                              <span className="w-5 h-5 rounded-md bg-[#F2F4F6] text-[#191F28] border border-[#E5E8EB] text-[11.5px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className="text-sm font-extrabold text-[#191F28] break-keep">
                                {fmtCat(item.category) || `가전품목 ${idx + 1}`}
                              </span>
                              {validModel && (
                                <span className="text-xs font-semibold text-[#4E5968] bg-[#F2F4F6] border border-[#E5E8EB] px-2 py-0.5 rounded font-mono break-all">
                                  {fmtModel(validModel)}
                                </span>
                              )}
                              {item.quantity > 1 && (
                                <span className="text-xs font-extrabold text-[#1B64DA] shrink-0">
                                  × {item.quantity}개
                                </span>
                              )}
                            </div>
                            <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                              {lineTotal.toLocaleString()}원
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="ledger-row px-4 sm:px-5 py-3 bg-[#F8FAFC] border-t border-[#E5E8EB]">
                      <span className="ledger-row-label text-xs sm:text-sm font-extrabold text-[#4E5968]">
                        패키지 기준 행사가 합계
                      </span>
                      <span className="ledger-row-value text-base sm:text-lg font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                        {generalSummary.sum.toLocaleString()}원
                      </span>
                    </div>
                  </section>

                  {/* STEP 2: 혜택이 적용되는 순서 (워터폴 스토리 원장) */}
                  <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
                    <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#1B64DA] text-white text-[11.5px] font-extrabold whitespace-nowrap">
                          STEP 2
                        </span>
                        <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28]">
                          혜택이 적용되는 순서 (현장 할인 → 사후 환급 → 최종 체감가)
                        </span>
                      </div>
                      <span className="text-[11.5px] font-extrabold text-[#1B64DA] tabular-nums whitespace-nowrap">
                        {generalSummary.totalDiscountAndBenefit > 0
                          ? `총 혜택 -${generalSummary.totalDiscountAndBenefit.toLocaleString()}원`
                          : '기본 정가 기준'}
                      </span>
                    </div>

                    <div className="divide-y divide-[#E5E8EB]">
                      {/* 1단계 차감 항목들 */}
                      {step1DiscountRows.map((row) => (
                        <div key={row.key} className="ledger-row px-4 sm:px-5 py-2.5">
                          <div className="ledger-row-label flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold shrink-0">
                              현장 즉시차감
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                              {row.label}
                            </span>
                          </div>
                          <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                            -{row.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}

                      {!state.hideHiPreed && generalSummary.hiFreedSupport > 0 && (
                        <div className="ledger-row px-4 sm:px-5 py-2.5">
                          <div className="ledger-row-label flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold shrink-0">
                              결합 즉시지원
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                              하이프리드 라이프케어 선지원금
                            </span>
                            <span className="text-[11.5px] font-semibold text-[#4E5968]">
                              ({generalHiPreedSummary.activePlans.map((p) => `${p.name} ${p.count}건`).join(' + ')})
                            </span>
                          </div>
                          <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                            -{generalSummary.hiFreedSupport.toLocaleString()}원
                          </span>
                        </div>
                      )}

                      {/* 중간 소계: ① 오늘 매장 카드 실결제가 */}
                      <div className="ledger-row px-4 sm:px-5 py-3 bg-[#F8FAFC]">
                        <div className="ledger-row-label">
                          <span className="text-xs sm:text-sm font-black text-[#191F28]">
                            ① 오늘 매장 카드 실결제가 (현장 결제 금액)
                          </span>
                        </div>
                        <span className="ledger-row-value text-base sm:text-lg font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                          {generalSummary.payPrice.toLocaleString()}원
                        </span>
                      </div>

                      {/* 2단계 환급/추가 혜택 항목들 */}
                      {step2CashbackRows.map((row) => (
                        <div key={row.key} className="ledger-row px-4 sm:px-5 py-2.5">
                          <div className="ledger-row-label flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold shrink-0">
                              사후 환급혜택
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                              {row.label}
                            </span>
                          </div>
                          <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                            -{row.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}

                      {step2ExtraRows.map((row) => (
                        <div key={row.key} className="ledger-row px-4 sm:px-5 py-2.5">
                          <div className="ledger-row-label flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold shrink-0">
                              추가 사후혜택
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                              {row.label}
                            </span>
                          </div>
                          <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                            -{row.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}

                      {/* 최종 합계: ③ 최종 혜택 체감가 */}
                      <div className="ledger-row px-4 sm:px-5 py-4 bg-[#FFF1F2] border-t-2 border-[#E60012]">
                        <div className="ledger-row-label space-y-0.5">
                          <div className="text-sm sm:text-base font-black text-[#E60012]">
                            ③ 모든 혜택 반영 최종 체감 구매가
                          </div>
                          {(generalSummary.totalStep2Cashback > 0 || generalSummary.totalStep2ExtraBenefit > 0) && (
                            <div className="text-[11.5px] font-semibold text-[#4E5968]">
                              매장 실결제가 {generalSummary.payPrice.toLocaleString()}원에서 사후 캐시백·포인트 환급분을 모두 차감한 금액입니다.
                            </div>
                          )}
                          {generalSummary.rawNet < 0 && (
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded bg-[#1B64DA] text-white text-[11.5px] font-black mt-1">
                              가전 구매 후 오히려 +{Math.abs(generalSummary.rawNet).toLocaleString()}원 플러스 혜택
                            </div>
                          )}
                        </div>
                        <span className="ledger-row-value text-2xl sm:text-3xl font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
                          <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* STEP 3: 하이프리드 만기 원금 100% 환급 안심 보증 */}
                  {!state.hideHiPreed && generalHiPreedSummary.totalAccounts > 0 && (
                    <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 px-4 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-bold text-[#191F28] break-keep">
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11.5px] font-extrabold shrink-0 whitespace-nowrap">
                          STEP 3 · 만기보증
                        </span>
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          웅진프리드라이프 하이프리드 결합: 만기(150회[150개월] 납입 완료 · 거치 없음) 시 납입 원금{' '}
                          <strong className="font-black text-emerald-700 font-mono tabular-nums whitespace-nowrap">
                            {generalHiPreedSummary.totalMaturityRefund.toLocaleString()}원 100% 전액 환급
                          </strong>{' '}
                          보장 (상조·전환 미이용 시)
                        </span>
                      </span>
                      <span className="text-[11.5px] font-bold text-emerald-800 font-mono tabular-nums whitespace-nowrap">
                        월 납입금 {generalHiPreedSummary.totalMonthlyDeposit.toLocaleString()}원
                      </span>
                    </div>
                  )}

                  <PreedSafetyGuideBox
                    hasHiPlus={false}
                    hasGeneralHiPreed={!state.hideHiPreed && generalHiPreedSummary.totalAccounts > 0}
                  />

                  {/* 하단 공식 푸터 */}
                  <div className="pt-2 border-t border-[#E5E8EB] flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-medium text-[#8B95A1]">
                    <span>롯데하이마트 경기광주점 · 고객 맞춤 가전 컨설팅 공식 견적서</span>
                    <span>본 제안서는 상담일 기준 프로모션 및 카드사 정책 기준이며 변동될 수 있습니다.</span>
                  </div>
                </div>
              )}

              <ProposalPreviewSubAndHybrid
                activeCustomer={activeCustomer}
                generalHiPreedSummary={generalHiPreedSummary}
                activePlan={activePlan}
                cardMonthlyDiscount={cardMonthlyDiscount}
                currentCard={currentCard}
                currentCardTier={currentCardTier}
                finalMonthlyFee={finalMonthlyFee}
                finalTotal60Fee={finalTotal60Fee}
                fmtCat={fmtCat}
                fmtModel={fmtModel}
                generalSummary={generalSummary}
                hasBothPlans={hasBothPlans}
                hiPlusMonthlySupport={hiPlusMonthlySupport}
                hybridCombinedNetTotal={hybridCombinedNetTotal}
                hybridTotalDiscountAndSupport={hybridTotalDiscountAndSupport}
                periodLabel={periodLabel}
                representativePeriod={representativePeriod}
                state={state}
                subCardBenefitLabel={subCardBenefitLabel}
                subCashbackDetailParts={subCashbackDetailParts}
                subFormulaText={subFormulaText}
                subHeaderTitle={subHeaderTitle}
                subSummary={subSummary}
                totalBaseMonthly={totalBaseMonthly}
                totalPrincipal={totalPrincipal}
                useMobileFluid={useMobileFluid}
              />
            </div>
          )}

          <ProposalPreviewFreedGuide
            activeTab={activeTab}
            guideGeneralSummary={guideGeneralSummary}
            guideHiSummary={guideHiSummary}
            guideSheetRef={guideSheetRef}
            isGuideTab={isGuideTab}
            representativePeriod={representativePeriod}
            scale={scale}
            useMobileFluid={useMobileFluid}
          />
        </div>
      </div>

      <ShareQuoteLinkModal
        isOpen={isShareLinkOpen}
        onClose={() => setIsShareLinkOpen(false)}
        state={state}
        onUpdateState={onChange}
        customerName={activeCustomer?.name || ''}
        customerPhone={activeCustomer?.phone || ''}
        initialMaskModels={shareInitialMasked}
        isDark={isDark}
      />
    </div>
  );
};
