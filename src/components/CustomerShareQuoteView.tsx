import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AFFILIATE_CARDS,
  AffiliateCardId,
  calculateGeneralHiPreedSummary,
  calculateGeneralPurchaseSummary,
  calculateHiPlusSummary,
  calculateSubscriptionSummary,
  extractGeneralPlanData,
  GENERAL_HIPREED_PLANS,
  GeneralHiPreedKey,
  getActiveCompareModes,
  getGeneralPlan1And2Summaries,
  getHiPlusUnitMonthlySupport,
  getLottePlanQuoteMeta,
  getSubscriptionSurplusMeta,
  HI_PLUS_PLANS,
  HiPlusCounts,
  HiPlusKey,
  HiPlusPayoutMethod,
  isAffiliateGeneralCardType,
  MAX_FREED_ACCOUNTS,
  ProposalState,
  recommendCardSpendHiPlusCounts,
  resolveComparisonModePlanData,
  switchGeneralPlanInState,
  switchQuoteModeInState,
} from '../types/proposal';
import {
  decodeSharedQuoteFromHash,
  getEffectiveStaffPin,
  loadCachedCustomerQuotePayload,
  normalizeConsultantRoleTitle,
  SharedQuotePayload,
  syncFriendRemoteProfileFromCloud,
  unlockStaffDeviceWithPin,
} from '../utils/shareQuoteCodec';
import {
  authenticateDeviceWithCloud,
  buildFriendInviteUrl,
  PENDING_INVITE_PROMPT_KEY,
} from '../utils/friendAccessGuard';
import {
  detectInstallEnvironment,
  getGlobalDeferredInstallPrompt,
  getGlobalStandaloneState,
  launchUrlInAndroidChrome,
  subscribePwaInstallState,
  triggerNativePwaInstallPrompt,
} from '../utils/pwaInstallManager';
import {
  normalizeGasWebAppUrl,
  readRawSyncConfig,
  UNCONFIGURED_PIN_SENTINEL,
} from '../utils/storeCloudSync';
import { SpringNumberFlow } from './SpringNumberFlow';
import { CustomerProposalSheet } from './CustomerProposalSheet';
import { ProposalPreviewFreedGuide } from './ProposalPreviewFreedGuide';
import { UnifiedComplianceAccordion } from './ProposalComplianceBlocks';
import { MultiModeTabSwitcherBanner } from './MultiModeComparisonSection';
import { safeCopyText, scrollToTopInstant } from '../utils/mobileQaRuntime';
import {
  ArrowDown,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Gift,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Printer,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';

export { ShareQuoteLinkModal } from './ShareQuoteLinkModal';
export type { ShareQuoteLinkModalProps } from './ShareQuoteLinkModal';

export interface CustomerShareQuoteViewProps {
  payload: SharedQuotePayload;
}

export const CustomerShareQuoteView: React.FC<CustomerShareQuoteViewProps> = ({
  payload,
}) => {
  const [simState, setSimState] = useState<ProposalState>(() =>
    JSON.parse(JSON.stringify(payload.state))
  );
  const [showCompliance, setShowCompliance] = useState<boolean>(false);
  const [showCustomControls, setShowCustomControls] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);
  const simulatorRef = useRef<HTMLElement | null>(null);
  const [isFreedGuideModalOpen, setIsFreedGuideModalOpen] = useState<boolean>(false);
  const [hybridGuideTab, setHybridGuideTab] = useState<'guide-general' | 'guide-sub'>('guide-general');

  useEffect(() => {
    if (!isFreedGuideModalOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFreedGuideModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFreedGuideModalOpen]);
  const pendingSimAnchorTopRef = useRef<number | null>(null);

  const handleShareOrCopyLink = async () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (!currentUrl) return;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: payload.customerName
            ? `${payload.customerName} 고객님 맞춤 가전 견적서`
            : `${payload.consultant.storeName || '롯데하이마트'} 맞춤 가전 견적서`,
          url: currentUrl,
        });
        return;
      } catch {
        // 취소 시 클립보드 복사로 폴백
      }
    }
    const ok = await safeCopyText(currentUrl);
    if (ok) {
      setCopiedShareLink(true);
      window.setTimeout(() => setCopiedShareLink(false), 2200);
    }
  };

  // 공유 링크 최초 진입 시 무조건 최상단(0px)부터 시작
  useLayoutEffect(() => {
    scrollToTopInstant();
  }, [payload]);

  // 하단 시뮬레이터 버튼 조작 시 상단 제안서 높이 변동으로 화면이 튀지 않도록 동기 스크롤 앵커 보정
  useLayoutEffect(() => {
    const prevTop = pendingSimAnchorTopRef.current;
    if (prevTop === null) return;
    pendingSimAnchorTopRef.current = null;
    const simEl = simulatorRef.current;
    if (!simEl) return;
    const delta = simEl.getBoundingClientRect().top - prevTop;
    if (Math.abs(delta) >= 1) {
      try {
        window.scrollBy({ top: delta, left: 0, behavior: 'instant' as ScrollBehavior });
      } catch {
        window.scrollBy(0, delta);
      }
    }
  }, [simState]);

  const captureSimulatorAnchor = () => {
    if (simulatorRef.current) {
      pendingSimAnchorTopRef.current =
        simulatorRef.current.getBoundingClientRect().top;
    }
  };

  const isModifiedFromOriginal = useMemo(
    () => JSON.stringify(simState) !== JSON.stringify(payload.state),
    [simState, payload.state]
  );

  const handleResetToOriginal = () => {
    setSimState(JSON.parse(JSON.stringify(payload.state)));
  };

  const activePlan = simState.activeGeneralPlan || 1;
  const {
    allPlans,
  } = getGeneralPlan1And2Summaries(simState);
  const validSharePlans = useMemo(
    () => allPlans.filter((p) => p.hasData),
    [allPlans]
  );
  const hasBothPlans = allPlans.length >= 2 && validSharePlans.length >= 2;

  const generalSummary = calculateGeneralPurchaseSummary(simState);
  const generalHiPreed = calculateGeneralHiPreedSummary(
    simState.generalHiPreedCounts,
    Boolean(simState.hideHiPreed)
  );
  const subSummary = calculateSubscriptionSummary(simState);
  const hiPlusSummary = calculateHiPlusSummary(
    simState.hiPlusCounts,
    subSummary.representativePeriod,
    Boolean(simState.hideSubPreed)
  );
  const subSurplus = getSubscriptionSurplusMeta(
    subSummary.finalMonthlyFee,
    subSummary.hiPlusPayoutMethod
  );

  const showGeneral =
    simState.quoteMode === 'general' || simState.quoteMode === 'hybrid';
  const showSub =
    simState.quoteMode === 'subscription' || simState.quoteMode === 'hybrid';
  const isHybrid = simState.quoteMode === 'hybrid';

  const payloadCompareModes = useMemo(
    () => getActiveCompareModes(payload.state),
    [payload.state]
  );

  const originPlanData = useMemo(() => {
    if (payloadCompareModes.length >= 2) {
      return resolveComparisonModePlanData(payload.state, simState.quoteMode);
    }
    if (
      Array.isArray(payload.state.generalPlans) &&
      payload.state.generalPlans[activePlan - 1]
    ) {
      return payload.state.generalPlans[activePlan - 1];
    }
    if (activePlan === 2 && payload.state.generalPlan2) {
      return payload.state.generalPlan2;
    }
    if (payload.state.generalPlan1) {
      return payload.state.generalPlan1;
    }
    return payload.state;
  }, [payloadCompareModes, payload.state, simState.quoteMode, activePlan]);

  const originGeneralAffiliateCard = isAffiliateGeneralCardType(
    originPlanData.generalCardType
  )
    ? originPlanData.generalCardType
    : null;

  const originSubAffiliateCard = useMemo(() => {
    const cid = originPlanData.selectedCardId;
    if (!cid || cid === 'none') return null;
    return AFFILIATE_CARDS.find((c) => c.id === cid) || null;
  }, [originPlanData.selectedCardId]);

  const combinedLifecareAccounts =
    (showGeneral && !simState.hideHiPreed ? generalHiPreed.totalAccounts : 0) +
    (showSub && !simState.hideSubPreed ? hiPlusSummary.totalAccounts : 0);
  const canAddMoreLifecare = combinedLifecareAccounts < MAX_FREED_ACCOUNTS;

  const handleAdjustHiPreed = (key: GeneralHiPreedKey, delta: number) => {
    setSimState((prev) => {
      const counts = prev.generalHiPreedCounts;
      const genTotal =
        (counts.hf75 || 0) +
        (counts.hf150 || 0) +
        (counts.hf225 || 0) +
        (counts.hf300 || 0);
      const subTotal =
        prev.quoteMode === 'hybrid' && !prev.hideSubPreed
          ? (prev.hiPlusCounts.hi72 || 0) +
            (prev.hiPlusCounts.hi90 || 0) +
            (prev.hiPlusCounts.hi108 || 0)
          : 0;
      const current = counts[key] || 0;
      const nextVal = current + delta;
      if (nextVal < 0) return prev;
      if (delta > 0 && genTotal + subTotal >= MAX_FREED_ACCOUNTS) {
        return prev;
      }
      return {
        ...prev,
        generalHiPreedCounts: {
          ...counts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleAdjustHiPlus = (key: HiPlusKey, delta: number) => {
    setSimState((prev) => {
      const counts = prev.hiPlusCounts;
      const subTotal =
        (counts.hi72 || 0) +
        (counts.hi90 || 0) +
        (counts.hi108 || 0);
      const genTotal =
        prev.quoteMode === 'hybrid' && !prev.hideHiPreed
          ? (prev.generalHiPreedCounts.hf75 || 0) +
            (prev.generalHiPreedCounts.hf150 || 0) +
            (prev.generalHiPreedCounts.hf225 || 0) +
            (prev.generalHiPreedCounts.hf300 || 0)
          : 0;
      const current = counts[key] || 0;
      const nextVal = current + delta;
      if (nextVal < 0) return prev;
      if (delta > 0 && subTotal + genTotal >= MAX_FREED_ACCOUNTS) {
        return prev;
      }
      return {
        ...prev,
        hiPlusCounts: {
          ...counts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleSelectPayoutMethod = (method: HiPlusPayoutMethod) => {
    setSimState((prev) => ({
      ...prev,
      hiPlusPayoutMethod: method,
    }));
  };

  const handleToggleSelectedSubCard = (cardId: AffiliateCardId) => {
    setSimState((prev) => {
      if (prev.selectedCardId === cardId) {
        return {
          ...prev,
          selectedCardId: 'none',
          selectedCardTierId: '',
          subAutoTierCashback: true,
        };
      }
      const card = AFFILIATE_CARDS.find((c) => c.id === cardId);
      const preferredTier =
        originPlanData.selectedCardId === cardId &&
        originPlanData.selectedCardTierId
          ? originPlanData.selectedCardTierId
          : card?.tiers?.[0]?.id || '';
      return {
        ...prev,
        selectedCardId: cardId,
        selectedCardTierId: preferredTier,
        subAutoTierCashback: true,
        subLotteBilling5p:
          originPlanData.selectedCardId === cardId
            ? Boolean(originPlanData.subLotteBilling5p)
            : Boolean(prev.subLotteBilling5p),
      };
    });
  };

  const originCleanPlan = useMemo(
    () => extractGeneralPlanData(originPlanData),
    [originPlanData]
  );

  const hasAnyOriginCard = Boolean(
    (showSub && originSubAffiliateCard) ||
      (showGeneral && originGeneralAffiliateCard)
  );

  const isSameHiPlusAsOrigin =
    (simState.hiPlusCounts?.hi72 || 0) === (originCleanPlan.hiPlusCounts?.hi72 || 0) &&
    (simState.hiPlusCounts?.hi90 || 0) === (originCleanPlan.hiPlusCounts?.hi90 || 0) &&
    (simState.hiPlusCounts?.hi108 || 0) === (originCleanPlan.hiPlusCounts?.hi108 || 0);

  const isSameGenPreedAsOrigin =
    (simState.generalHiPreedCounts?.hf75 || 0) ===
      (originCleanPlan.generalHiPreedCounts?.hf75 || 0) &&
    (simState.generalHiPreedCounts?.hf150 || 0) ===
      (originCleanPlan.generalHiPreedCounts?.hf150 || 0) &&
    (simState.generalHiPreedCounts?.hf225 || 0) ===
      (originCleanPlan.generalHiPreedCounts?.hf225 || 0) &&
    (simState.generalHiPreedCounts?.hf300 || 0) ===
      (originCleanPlan.generalHiPreedCounts?.hf300 || 0);

  const isOriginPresetActive =
    !showCustomControls &&
    isSameHiPlusAsOrigin &&
    isSameGenPreedAsOrigin &&
    (!showSub ||
      (simState.selectedCardId === originCleanPlan.selectedCardId &&
        simState.selectedCardTierId === originCleanPlan.selectedCardTierId &&
        Boolean(simState.subLotteBilling5p) ===
          Boolean(originCleanPlan.subLotteBilling5p))) &&
    (!showGeneral || simState.generalCardType === originCleanPlan.generalCardType);

  const isNoCardPresetActive =
    !showCustomControls &&
    hasAnyOriginCard &&
    isSameHiPlusAsOrigin &&
    isSameGenPreedAsOrigin &&
    (!showSub || simState.selectedCardId === 'none') &&
    (!showGeneral ||
      simState.generalCardType === '미정' ||
      simState.generalCardType === '일반카드');

  const handleApplyOriginPlanPreset = () => {
    setShowCustomControls(false);
    setSimState((prev) => ({
      ...prev,
      ...extractGeneralPlanData(originPlanData),
    }));
  };

  const handleApplyNoCardPreset = () => {
    setShowCustomControls(false);
    const base = extractGeneralPlanData(originPlanData);
    setSimState((prev) => ({
      ...prev,
      ...base,
      ...(showSub
        ? {
            selectedCardId: 'none' as AffiliateCardId,
            selectedCardTierId: '',
            subAutoTierCashback: true,
          }
        : {}),
      ...(showGeneral ? { generalCardType: '미정' } : {}),
    }));
  };

  const handleSetHiPlusCounts = (nextCounts: HiPlusCounts) => {
    setSimState((prev) => ({
      ...prev,
      hiPlusCounts: { ...nextCounts },
    }));
  };

  const maxSubAccountsAvailable =
    isHybrid && !simState.hideHiPreed
      ? Math.max(0, MAX_FREED_ACCOUNTS - generalHiPreed.totalAccounts)
      : MAX_FREED_ACCOUNTS;

  const autoSpendHiPlusPreset = useMemo(() => {
    if (!originSubAffiliateCard) return null;
    const activeTier =
      subSummary.currentCard &&
      subSummary.currentCard.id === originSubAffiliateCard.id &&
      subSummary.currentCardTier
        ? subSummary.currentCardTier
        : originSubAffiliateCard.tiers.find(
            (t) => t.id === originCleanPlan.selectedCardTierId
          ) || originSubAffiliateCard.tiers[0];
    if (!activeTier || !simState.countPreedTowardCardSpend) return null;
    if (simState.hiPlusPayoutMethod === 'bank_bank') return null;
    return recommendCardSpendHiPlusCounts(
      activeTier.minSpendAmount,
      maxSubAccountsAvailable
    );
  }, [
    originSubAffiliateCard,
    subSummary.currentCard,
    subSummary.currentCardTier,
    originCleanPlan.selectedCardTierId,
    simState.countPreedTowardCardSpend,
    simState.hiPlusPayoutMethod,
    maxSubAccountsAvailable,
  ]);

  const hasEverSubPreedInPlan =
    !simState.hideSubPreed &&
    (hiPlusSummary.totalAccounts > 0 ||
      (originCleanPlan.hiPlusCounts.hi72 || 0) +
        (originCleanPlan.hiPlusCounts.hi90 || 0) +
        (originCleanPlan.hiPlusCounts.hi108 || 0) >
        0);

  const hasEverGenPreedInPlan =
    !simState.hideHiPreed &&
    (generalHiPreed.totalAccounts > 0 ||
      (originCleanPlan.generalHiPreedCounts.hf75 || 0) +
        (originCleanPlan.generalHiPreedCounts.hf150 || 0) +
        (originCleanPlan.generalHiPreedCounts.hf225 || 0) +
        (originCleanPlan.generalHiPreedCounts.hf300 || 0) >
        0);

  const displayRoleTitle = normalizeConsultantRoleTitle(
    payload.consultant.roleTitle
  );

  const activeCompareModes = getActiveCompareModes(simState);
  const activeModeIdx = activeCompareModes.indexOf(simState.quoteMode);
  const effectivePlanNum =
    activeCompareModes.length >= 2
      ? activeModeIdx >= 0
        ? activeModeIdx + 1
        : 1
      : activePlan;
  const effectiveHasMultiplePlans =
    activeCompareModes.length >= 2 ? true : hasBothPlans;

  const cleanPhone = (payload.consultant.phone || '').replace(/[^0-9]/g, '');
  const smsBody = encodeURIComponent(
    `[${payload.consultant.storeName}] 안녕하세요 ${payload.consultant.name}님! 보내주신 맞춤 비교 견적서(${
      effectiveHasMultiplePlans ? `${effectivePlanNum}안` : '확인완료'
    }) 보고 연락드립니다.`
  );

  const lottePlanMeta = useMemo(() => getLottePlanQuoteMeta(simState), [simState]);
  const isLottePlanQuote = lottePlanMeta.isLottePlan;

  const validGeneralNames = generalSummary.displayItems
    .map((it) => (it.category || '').trim())
    .filter(Boolean);
  const generalHeaderTitle = isLottePlanQuote
    ? validGeneralNames.length === 0
      ? '롯데 플랜 제휴카드 맞춤 구매 제안서'
      : validGeneralNames.length === 1
      ? `${validGeneralNames[0]} 롯데 플랜 맞춤 제안서`
      : `${validGeneralNames[0]} 외 ${validGeneralNames.length - 1}건 롯데 플랜 제안서`
    : validGeneralNames.length === 0
    ? '맞춤 가전 패키지 구매 제안서'
    : validGeneralNames.length === 1
    ? `${validGeneralNames[0]} 맞춤 구매 제안서`
    : `${validGeneralNames[0]} 외 ${validGeneralNames.length - 1}건 맞춤 구매 제안서`;

  const validSubNames = subSummary.displayItems
    .map((it) => (it.category || '').trim())
    .filter(Boolean);
  const subHeaderTitle =
    validSubNames.length === 0
      ? `맞춤 가전 구독 제안서 (${subSummary.periodLabel})`
      : validSubNames.length === 1
      ? `${validSubNames[0]} 구독 제안서 (${subSummary.periodLabel})`
      : `${validSubNames[0]} 외 ${validSubNames.length - 1}건 구독 제안서 (${subSummary.periodLabel})`;

  const step1DiscountDetails: string[] = [];
  const step2CashbackDetails: string[] = [];
  const step2ExtraDetails: string[] = [];

  const currentCard = subSummary.currentCard;
  const currentCardTier = subSummary.currentCardTier;
  const subCardBenefitLabel =
    currentCard?.benefitType === '캐시백' ||
    currentCard?.id === 'lotte' ||
    currentCard?.id === 'shinhan'
      ? '캐시백'
      : '청구할인';

  const subCashbackDetailParts: string[] = [];
  const subFormulaParts = ['월 구독료'];
  if (subSummary.cardDiscount > 0) {
    subFormulaParts.push(`제휴카드${subCardBenefitLabel}`);
  }
  if (!simState.hideSubPreed && subSummary.hiPlusMonthly > 0) {
    subFormulaParts.push('구독프리드');
  }
  const subFormulaText = subFormulaParts.join(' − ');

  const hybridTotalDiscountAndSupport =
    generalSummary.totalDiscountAndBenefit + subSummary.totalSubBenefit;
  const hybridCombinedNetTotal = generalSummary.rawNet + subSummary.finalTotalFee;

  const hasGeneralSim =
    !isLottePlanQuote &&
    showGeneral &&
    (Boolean(originGeneralAffiliateCard) || !simState.hideHiPreed);
  const hasSubSim =
    showSub && (Boolean(originSubAffiliateCard) || !simState.hideSubPreed);
  const showSimulatorSection = hasGeneralSim || hasSubSim;

  const hasActiveGenPreedGuide =
    showGeneral &&
    !simState.hideHiPreed &&
    !isLottePlanQuote &&
    generalHiPreed.totalAccounts > 0;
  const hasActiveSubPreedGuide =
    showSub && !simState.hideSubPreed && hiPlusSummary.totalAccounts > 0;
  const hasAnyActivePreedGuide =
    hasActiveGenPreedGuide || hasActiveSubPreedGuide;
  const effectiveFreedGuideTab: 'guide-general' | 'guide-sub' =
    hasActiveGenPreedGuide && hasActiveSubPreedGuide
      ? hybridGuideTab
      : hasActiveSubPreedGuide
      ? 'guide-sub'
      : 'guide-general';
  const activePreedGuideTitle =
    hasActiveGenPreedGuide && hasActiveSubPreedGuide
      ? '하이프리드 · Hi구독 플러스 안내서'
      : hasActiveSubPreedGuide
      ? 'Hi구독 플러스 안내서'
      : '하이프리드 안내서';

  const planCompareMetrics = useMemo(() => {
    if (validSharePlans.length < 2) {
      return { cheaperPlanNum: 0, planDiffAmount: 0, planTotalSubDiff: 0 };
    }
    const priced = validSharePlans.map((p) => {
      const compareVal =
        simState.quoteMode === 'subscription'
          ? p.subSummary.finalMonthlyFee
          : simState.quoteMode === 'hybrid'
          ? p.genSummary.rawNet + p.subSummary.finalTotalFee
          : p.genSummary.rawNet;
      return {
        planNum: p.planNum,
        compareVal,
        subTotalVal: p.subSummary.finalTotalFee,
      };
    });
    let minItem = priced[0];
    let maxItem = priced[0];
    for (const item of priced) {
      if (item.compareVal < minItem.compareVal) minItem = item;
      if (item.compareVal > maxItem.compareVal) maxItem = item;
    }
    const diff = Math.abs(maxItem.compareVal - minItem.compareVal);
    const subTotalDiff = Math.abs(maxItem.subTotalVal - minItem.subTotalVal);
    return {
      cheaperPlanNum: diff > 0 ? minItem.planNum : 0,
      planDiffAmount: diff,
      planTotalSubDiff: subTotalDiff,
    };
  }, [validSharePlans, simState.quoteMode]);

  const { cheaperPlanNum, planDiffAmount, planTotalSubDiff } = planCompareMetrics;
  const mapSearchUrl = `https://map.naver.com/p/search/${encodeURIComponent(
    payload.consultant.storeName || '롯데하이마트'
  )}`;

  const containerMaxW = 'max-w-2xl min-[700px]:max-w-3xl lg:max-w-4xl';

  return (
    <div className="min-h-[100dvh] bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-[#F1F5F9] pb-32 min-[480px]:pb-24">
      {/* 공식 롯데하이마트 플래그십 헤더 — 모바일 390px 첫 화면 압축 */}
      <header className="safe-top-header no-print sticky top-0 z-30 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-white/10 border-t-[3px] border-t-[#E60012] px-3 sm:px-5 py-1.5 sm:py-2 shadow-[0_1px_6px_rgba(25,31,40,0.03)]">
        <div className={`${containerMaxW} mx-auto flex items-center justify-between gap-2`}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[10.5px] font-black tracking-wider shrink-0">
                LOTTE HIMART
              </span>
              <span className="text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 truncate">
                {payload.consultant.storeName}
              </span>
            </div>
            <h1 className="text-[13px] sm:text-base font-black text-[#191F28] dark:text-white break-keep leading-tight mt-0.5 truncate">
              {payload.customerName
                ? `${payload.customerName} 고객님 맞춤 견적서`
                : '고객님 전용 맞춤 가전 견적서'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              title="견적서 인쇄 / PDF 저장"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#1E293B] hover:bg-[#F2F4F6] text-[#4E5968] dark:text-slate-200 border border-[#D1D6DB] dark:border-white/10 text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>인쇄</span>
            </button>
            {isModifiedFromOriginal ? (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E60012] hover:bg-[#C8000F] text-white text-[11.5px] font-extrabold cursor-pointer schedule-tactile whitespace-nowrap shadow-xs"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>원래 제안 복귀</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1B64DA] dark:text-[#93C5FD] text-[11px] font-extrabold border border-[#BFDBFE] dark:border-[#3B82F6]/40 whitespace-nowrap">
                <UserCheck className="w-3 h-3 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
                <span>공식 안심 뷰어</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className={`${containerMaxW} mx-auto px-2.5 sm:px-5 pt-2 sm:pt-3 space-y-2.5 sm:space-y-3.5`}>
        {/* 담당 컨설턴트 컨시어지 바 (컴팩트 압축) */}
        <div className="no-print rounded-xl sm:rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-white/10 shadow-[0_1px_6px_rgba(25,31,40,0.03)] px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[#191F28] dark:bg-[#1E293B] text-white font-black text-xs flex items-center justify-center shrink-0">
              {payload.consultant.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap leading-tight">
                <span className="text-xs sm:text-[13px] font-black text-[#191F28] dark:text-white">
                  {payload.consultant.name}
                </span>
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-[#8B95A1] dark:text-slate-400 truncate">
                  · {displayRoleTitle} · {payload.createdAt}
                </span>
              </div>
              {payload.consultant.greeting && (
                <p className="text-[11px] sm:text-xs text-[#4E5968] dark:text-slate-300 font-medium mt-0.5 line-clamp-1 sm:line-clamp-2 break-keep leading-snug">
                  "{payload.consultant.greeting}"
                </p>
              )}
            </div>
          </div>

          <div className="no-print flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {hasAnyActivePreedGuide && (
              <button
                type="button"
                onClick={() => setIsFreedGuideModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer shadow-2xs schedule-tactile"
              >
                <BookOpen className="w-3 h-3 shrink-0" />
                <span>프리드 안내서</span>
              </button>
            )}
            {showSimulatorSection && (
              <button
                type="button"
                onClick={() => {
                  simulatorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 hover:bg-[#DBEAFE] border border-[#BFDBFE] dark:border-[#3B82F6]/40 text-[#1B64DA] dark:text-[#93C5FD] text-[11px] font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3 text-[#1B64DA] dark:text-[#60A5FA]" />
                <span>조건 비교</span>
                <ArrowDown className="w-3 h-3 text-[#1B64DA] dark:text-[#60A5FA]" />
              </button>
            )}
          </div>
        </div>

        {/* 복수 구매방식 비교 탭 */}
        {activeCompareModes.length >= 2 && (
          <MultiModeTabSwitcherBanner
            state={simState}
            onSelectMode={(m) =>
              setSimState((prev) => switchQuoteModeInState(prev, m))
            }
          />
        )}

        {/* 다중 안(1안 ~ N안) 실시간 비교 스위치 */}
        {activeCompareModes.length < 2 && hasBothPlans && (
          <div className="no-print rounded-2xl bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-white/10 p-3 sm:p-4 space-y-2 shadow-[0_2px_10px_rgba(25,31,40,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-black text-[#191F28] dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Layers className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
                <span>
                  맞춤 설계{' '}
                  {validSharePlans.map((p) => `${p.planNum}안`).join(' ↔ ')}{' '}
                  비교
                </span>
              </span>
              {cheaperPlanNum > 0 && (planDiffAmount > 0 || planTotalSubDiff > 0) ? (
                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#3B82F6]/40 text-[#1B64DA] dark:text-[#93C5FD] text-[11px] font-extrabold font-mono tabular-nums break-keep">
                  {simState.quoteMode === 'subscription'
                    ? `${cheaperPlanNum}안 선택 시 최대 월 ${planDiffAmount.toLocaleString()}원 · ${subSummary.periodLabel} 총 ${planTotalSubDiff.toLocaleString()}원 절감`
                    : `${cheaperPlanNum}안 선택 시 최대 ${planDiffAmount.toLocaleString()}원 절감`}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[#8B95A1] dark:text-slate-400 whitespace-nowrap">
                  탭하여 체감가 즉시 비교
                </span>
              )}
            </div>
            <div
              className={`grid grid-cols-1 min-[380px]:grid-cols-2 ${
                validSharePlans.length >= 3 ? 'md:grid-cols-3' : ''
              } gap-2`}
            >
              {validSharePlans.map((pEntry) => {
                const pNum = pEntry.planNum;
                const isSelected = activePlan === pNum;
                const gSum = pEntry.genSummary;
                const sSum = pEntry.subSummary;
                const sSurplus = getSubscriptionSurplusMeta(
                  sSum.finalMonthlyFee,
                  sSum.hiPlusPayoutMethod
                );
                const monthlyText = sSurplus.isSurplusZone
                  ? sSurplus.monthlySurplus > 0
                    ? `월 0원 (${sSurplus.surplusStickyText})`
                    : '월 0원'
                  : `월 ${sSum.finalMonthlyFee.toLocaleString()}원`;
                const mainPrice =
                  simState.quoteMode === 'subscription'
                    ? monthlyText
                    : simState.quoteMode === 'hybrid'
                    ? `일시불 ${gSum.rawNet.toLocaleString()}원 + ${monthlyText}`
                    : `${gSum.rawNet.toLocaleString()}원`;
                const subPrice =
                  simState.quoteMode === 'subscription'
                    ? sSurplus.isSurplusZone || sSum.finalTotalFee <= 0
                      ? sSum.totalTermSurplus > 0
                        ? `총 +${sSum.totalTermSurplus.toLocaleString()}원 초과 혜택`
                        : '총 체감 0원'
                      : `총 체감 ${sSum.finalTotalFee.toLocaleString()}원`
                    : simState.quoteMode === 'hybrid'
                    ? `통합 체감 ${(gSum.rawNet + sSum.finalTotalFee).toLocaleString()}원 · 실결제 ${gSum.payPrice.toLocaleString()}원`
                    : `실결제 ${gSum.payPrice.toLocaleString()}원`;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() =>
                      setSimState((prev) =>
                        switchGeneralPlanInState(prev, pNum)
                      )
                    }
                    className={`p-2.5 sm:p-3 rounded-xl text-left border-2 transition cursor-pointer schedule-tactile min-w-0 ${
                      isSelected
                        ? 'bg-[#191F28] dark:bg-[#1E293B] text-white border-[#191F28] dark:border-[#60A5FA] shadow-xs'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 border-[#E5E8EB] dark:border-white/10 hover:border-[#1B64DA]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-extrabold ${
                          isSelected
                            ? 'bg-[#1B64DA] text-white'
                            : 'bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-white/10 text-[#4E5968] dark:text-slate-300'
                        }`}
                      >
                        견적 {pNum}안
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-extrabold text-emerald-400">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span className="hidden min-[380px]:inline">선택됨</span>
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm sm:text-base font-black font-mono tabular-nums break-keep mt-1 ${
                        isSelected ? 'text-white' : 'text-[#E60012] dark:text-[#FF3B47]'
                      }`}
                    >
                      {mainPrice}
                    </div>
                    <div
                      className={`text-[11px] font-semibold font-mono tabular-nums break-keep mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-[#8B95A1] dark:text-slate-400'
                      }`}
                    >
                      {subPrice}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 메인 고객 스토리 제안서 시트 */}
        <CustomerProposalSheet
          activePlan={effectivePlanNum}
          currentCard={currentCard}
          currentCardTier={currentCardTier}
          generalHeaderTitle={generalHeaderTitle}
          generalHiPreed={generalHiPreed}
          generalSummary={generalSummary}
          hasBothPlans={effectiveHasMultiplePlans}
          hideInlineSafetyBox={simState.quoteMode !== 'general'}
          hiPlusSummary={hiPlusSummary}
          hybridCombinedNetTotal={hybridCombinedNetTotal}
          hybridTotalDiscountAndSupport={hybridTotalDiscountAndSupport}
          onSelectPayoutMethod={handleSelectPayoutMethod}
          simState={simState}
          step1DiscountDetails={step1DiscountDetails}
          step2CashbackDetails={step2CashbackDetails}
          step2ExtraDetails={step2ExtraDetails}
          subCardBenefitLabel={subCardBenefitLabel}
          subCashbackDetailParts={subCashbackDetailParts}
          subFormulaText={subFormulaText}
          subHeaderTitle={subHeaderTitle}
          subSummary={subSummary}
        />

        {/* [블록 4] 원클릭 조건 비교 시뮬레이터 */}
        {showSimulatorSection && (
          <section
            id="benefit-simulator"
            ref={simulatorRef}
            onClickCapture={captureSimulatorAnchor}
            className="no-print scroll-mt-16 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-white/10 p-3.5 sm:p-5 space-y-3.5 shadow-[0_2px_10px_rgba(25,31,40,0.03)]"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[#E5E8EB] dark:border-white/10 pb-2.5">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-[#191F28] dark:text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
                  <span>
                    {showSub ? '원클릭 조건 비교 · 구좌 조절' : '조건 직접 비교 시뮬레이터'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#8B95A1] dark:text-slate-400 mt-0.5 break-keep">
                  {showSub
                    ? '아래 모드를 터치하면 위 영수증 금액이 즉시 비교됩니다'
                    : '제휴카드·라이프케어 구좌를 조절하면 위 제안서와 하단 체감가가 실시간 반영됩니다'}
                </p>
              </div>
              {isModifiedFromOriginal && (
                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1B64DA] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#3B82F6]/40 text-[11px] font-extrabold shrink-0 whitespace-nowrap">
                  시뮬레이션 중
                </span>
              )}
            </div>

            {/* 구독·통합 모드 원클릭 모드 칩 */}
            {showSub && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleApplyOriginPlanPreset}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer schedule-tactile ${
                    isOriginPresetActive
                      ? 'bg-[#191F28] dark:bg-[#1B64DA] text-white border-[#191F28] dark:border-[#60A5FA] shadow-2xs'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1120] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-white/10 hover:border-[#1B64DA]/50'
                  }`}
                >
                  {isOriginPresetActive && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[3]" />
                  )}
                  <span>상담사 추천안(원본)</span>
                </button>

                {hasAnyOriginCard && (
                  <button
                    type="button"
                    onClick={handleApplyNoCardPreset}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer schedule-tactile ${
                      isNoCardPresetActive
                        ? 'bg-[#191F28] dark:bg-[#1B64DA] text-white border-[#191F28] dark:border-[#60A5FA] shadow-2xs'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1120] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-white/10 hover:border-[#1B64DA]/50'
                  }`}
                >
                  {isNoCardPresetActive && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[3]" />
                  )}
                  <span>제휴카드 미적용 시</span>
                </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCustomControls((v) => !v)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer schedule-tactile ${
                    showCustomControls || (!isOriginPresetActive && !isNoCardPresetActive)
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 text-[#1B64DA] dark:text-[#93C5FD] border-[#1B64DA] dark:border-[#60A5FA]'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1120] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-white/10 hover:border-[#1B64DA]/50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>구좌 직접 조절</span>
                  {showCustomControls ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
              </div>
            )}

            {(!showSub ||
              showCustomControls ||
              (!isOriginPresetActive && !isNoCardPresetActive)) && (
              <div
                className={
                  hasGeneralSim && hasSubSim
                    ? 'grid grid-cols-1 min-[880px]:grid-cols-2 gap-3.5'
                    : 'space-y-3.5'
                }
              >
                {hasGeneralSim && (
                  <div className="space-y-3">
                    {originGeneralAffiliateCard && (
                      <div className="rounded-xl border border-[#E5E8EB] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0B1120] p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#191F28] dark:text-white flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA]" />
                            <span>일반구매 제휴카드 적용 ON/OFF</span>
                          </span>
                          <span className="text-[11px] font-semibold text-[#8B95A1] dark:text-slate-400">
                            터치 시 전환
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSimState((prev) => ({
                              ...prev,
                              generalCardType:
                                prev.generalCardType === originGeneralAffiliateCard
                                  ? '미정'
                                  : originGeneralAffiliateCard,
                            }))
                          }
                          className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-extrabold border inline-flex items-center gap-1.5 cursor-pointer transition ${
                            simState.generalCardType === originGeneralAffiliateCard
                              ? 'bg-[#191F28] dark:bg-[#1E293B] text-white border-[#191F28] dark:border-[#60A5FA]'
                              : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-white/10'
                          }`}
                        >
                          {simState.generalCardType === originGeneralAffiliateCard && (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>{originGeneralAffiliateCard}</span>
                        </button>
                      </div>
                    )}

                    {!simState.hideHiPreed && (
                      <div className="rounded-xl border border-[#E5E8EB] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0B1120] p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-[#191F28] dark:text-white flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA]" />
                              <span>하이프리드 결합 구좌 조절</span>
                            </div>
                            <p className="text-[11px] font-medium text-[#8B95A1] dark:text-slate-400 mt-0.5">
                              합산 최대 {MAX_FREED_ACCOUNTS}구좌까지 선택하여 선지원금을 비교해 보세요
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-white/10 text-[11.5px] font-black text-[#191F28] dark:text-white font-mono tabular-nums whitespace-nowrap">
                            {isHybrid && !simState.hideSubPreed
                              ? `합산 ${combinedLifecareAccounts}/${MAX_FREED_ACCOUNTS}`
                              : `${generalHiPreed.totalAccounts}/${MAX_FREED_ACCOUNTS}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                          {GENERAL_HIPREED_PLANS.map((plan) => {
                            const cnt = simState.generalHiPreedCounts[plan.id] || 0;
                            return (
                              <div
                                key={plan.id}
                                className={`rounded-lg border p-2.5 flex items-center justify-between gap-2 ${
                                  cnt > 0
                                    ? 'bg-white dark:bg-[#131C2E] border-[#1B64DA] dark:border-[#60A5FA] shadow-2xs'
                                    : 'bg-white/80 dark:bg-[#131C2E]/70 border-[#E5E8EB] dark:border-white/10'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-[#191F28] dark:text-white">
                                    {plan.name}
                                  </div>
                                  <div className="text-[11px] font-extrabold text-[#1B64DA] dark:text-[#60A5FA] font-mono tabular-nums whitespace-nowrap">
                                    -{(plan.supportAmount / 10000).toLocaleString()}만원 지원
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={cnt === 0}
                                    onClick={() => handleAdjustHiPreed(plan.id, -1)}
                                    aria-label={`${plan.name} 구좌 감소`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#F2F4F6] dark:bg-[#1E293B] border border-[#E5E8EB] dark:border-white/10 font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs font-black font-mono tabular-nums w-5 text-center">
                                    {cnt}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!canAddMoreLifecare}
                                    onClick={() => handleAdjustHiPreed(plan.id, 1)}
                                    aria-label={`${plan.name} 구좌 추가`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#191F28] dark:bg-[#1B64DA] text-white font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!showSub && generalHiPreed.totalAccounts > 0 && (
                          <p className="text-[11px] font-semibold text-[#4E5968] dark:text-slate-300 leading-relaxed break-keep">
                            만기(150회[150개월] 납입 완료 · 거치 없음) 시 납입 원금{' '}
                            <strong className="text-emerald-700 dark:text-emerald-400 font-black font-mono tabular-nums whitespace-nowrap">
                              {generalHiPreed.totalMaturityRefund.toLocaleString()}원 100% 전액 환급
                            </strong>{' '}
                            (미이용 시 · 월 납입금{' '}
                            <span className="font-mono tabular-nums whitespace-nowrap">
                              {generalHiPreed.totalMonthlyDeposit.toLocaleString()}원
                            </span>
                            )
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {hasSubSim && (
                  <div className="space-y-3">
                    {originSubAffiliateCard && (
                      <div className="rounded-xl border border-[#E5E8EB] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0B1120] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#191F28] dark:text-white flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA]" />
                            <span>구독 제휴카드 · 전월 실적 구간</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleSelectedSubCard(originSubAffiliateCard.id)
                          }
                          className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-extrabold border inline-flex items-center gap-1.5 cursor-pointer transition ${
                            simState.selectedCardId === originSubAffiliateCard.id
                              ? 'bg-[#191F28] dark:bg-[#1E293B] text-white border-[#191F28] dark:border-[#60A5FA]'
                              : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-white/10'
                          }`}
                        >
                          {simState.selectedCardId === originSubAffiliateCard.id && (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>{originSubAffiliateCard.name}</span>
                        </button>

                        {currentCard && currentCard.id === originSubAffiliateCard.id && (
                          <div className="grid grid-cols-1 min-[390px]:grid-cols-3 gap-1.5">
                            {currentCard.tiers.map((tier) => {
                              const active = simState.selectedCardTierId === tier.id;
                              return (
                                <button
                                  key={tier.id}
                                  type="button"
                                  onClick={() =>
                                    setSimState((prev) => ({
                                      ...prev,
                                      selectedCardTierId: tier.id,
                                    }))
                                  }
                                  className={`px-2.5 py-2 rounded-lg border flex min-[390px]:block items-center justify-between text-center cursor-pointer transition ${
                                    active
                                      ? 'bg-white dark:bg-[#131C2E] border-2 border-[#1B64DA] dark:border-[#60A5FA] shadow-2xs'
                                      : 'bg-white/75 dark:bg-[#131C2E]/60 border-[#E5E8EB] dark:border-white/10'
                                  }`}
                                >
                                  <div className="text-[11px] font-bold text-[#4E5968] dark:text-slate-300">
                                    {tier.minSpendShort} 이상
                                  </div>
                                  <div className="text-xs font-black text-[#1B64DA] dark:text-[#60A5FA] font-mono tabular-nums whitespace-nowrap">
                                    -{(tier.monthlyDiscount / 10000).toFixed(1)}만/월
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {!simState.hideSubPreed && (
                      <div className="rounded-xl border border-[#E5E8EB] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0B1120] p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-[#191F28] dark:text-white flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA]" />
                              <span>Hi구독 플러스 구좌 조절</span>
                            </div>
                            <p className="text-[11px] font-medium text-[#8B95A1] dark:text-slate-400 mt-0.5">
                              최대 {MAX_FREED_ACCOUNTS}구좌 범위에서 월 현금지원 규모를 조절합니다
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[11.5px] font-black font-mono tabular-nums whitespace-nowrap ${
                              !canAddMoreLifecare
                                ? 'bg-[#FFF1F2] dark:bg-rose-950/60 border-[#FECDD3] dark:border-rose-700 text-[#E60012] dark:text-rose-300'
                                : 'bg-white dark:bg-[#131C2E] border-[#D1D6DB] dark:border-white/10 text-[#191F28] dark:text-white'
                            }`}
                          >
                            {isHybrid && !simState.hideHiPreed
                              ? `합산 ${combinedLifecareAccounts}/${MAX_FREED_ACCOUNTS}`
                              : `${hiPlusSummary.totalAccounts}/${MAX_FREED_ACCOUNTS}`}
                          </span>
                        </div>

                        {/* 원클릭 구좌 프리셋 칩 */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleSetHiPlusCounts({ hi72: 0, hi90: 0, hi108: 0 })
                            }
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-white/10 text-[11px] font-bold text-[#4E5968] dark:text-slate-300 cursor-pointer"
                          >
                            초기화(0구좌)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSetHiPlusCounts(originCleanPlan.hiPlusCounts)
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#3B82F6]/40 text-[11px] font-extrabold text-[#1B64DA] dark:text-[#93C5FD] cursor-pointer"
                          >
                            추천 구좌 복원
                          </button>
                          {autoSpendHiPlusPreset && originSubAffiliateCard && (
                            <button
                              type="button"
                              onClick={() => {
                                setSimState((prev) => {
                                  const preferredTier =
                                    prev.selectedCardId === originSubAffiliateCard.id &&
                                    prev.selectedCardTierId
                                      ? prev.selectedCardTierId
                                      : originCleanPlan.selectedCardTierId ||
                                        originSubAffiliateCard.tiers[0]?.id ||
                                        '';
                                  return {
                                    ...prev,
                                    selectedCardId: originSubAffiliateCard.id,
                                    selectedCardTierId: preferredTier,
                                    hiPlusCounts: { ...autoSpendHiPlusPreset },
                                  };
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                            >
                              카드실적 자동충족
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                          {HI_PLUS_PLANS.map((plan) => {
                            const cnt = simState.hiPlusCounts[plan.id] || 0;
                            const unitSupport = getHiPlusUnitMonthlySupport(
                              plan,
                              subSummary.representativePeriod
                            );
                            return (
                              <div
                                key={plan.id}
                                className={`rounded-lg border p-2.5 flex flex-row min-[420px]:flex-col items-center min-[420px]:items-stretch justify-between gap-2 ${
                                  cnt > 0
                                    ? 'bg-white dark:bg-[#131C2E] border-[#1B64DA] dark:border-[#60A5FA] shadow-2xs'
                                    : 'bg-white/80 dark:bg-[#131C2E]/70 border-[#E5E8EB] dark:border-white/10'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-[#191F28] dark:text-white leading-snug">
                                    {plan.buttonLabel}
                                  </div>
                                  <div className="text-[11px] font-extrabold text-[#1B64DA] dark:text-[#60A5FA] font-mono tabular-nums whitespace-nowrap mt-0.5">
                                    월 -{(unitSupport / 1000).toLocaleString()}천원
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={cnt === 0}
                                    onClick={() => handleAdjustHiPlus(plan.id, -1)}
                                    aria-label={`${plan.buttonLabel} 구좌 감소`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#F2F4F6] dark:bg-[#1E293B] border border-[#E5E8EB] dark:border-white/10 font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs font-black font-mono tabular-nums min-w-[1.25rem] text-center">
                                    {cnt}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!canAddMoreLifecare}
                                    onClick={() => handleAdjustHiPlus(plan.id, 1)}
                                    aria-label={`${plan.buttonLabel} 구좌 추가`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#191F28] dark:bg-[#1B64DA] text-white font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* [블록 4] 단일 통합 유의사항 아코디언 (구독/통합 모드 시 법적 고지 100% 무중복 일원화) */}
        {showSub ? (
          <UnifiedComplianceAccordion
            open={showCompliance}
            onToggle={() => setShowCompliance((v) => !v)}
            hasHiPlus={hasEverSubPreedInPlan}
            hasGeneralHiPreed={isHybrid && hasEverGenPreedInPlan}
            chevronUpIcon={<ChevronUp className="w-4 h-4 shrink-0" />}
            chevronDownIcon={<ChevronDown className="w-4 h-4 shrink-0" />}
          />
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCompliance((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[#4E5968] dark:text-slate-300 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#8B95A1] dark:text-slate-400 shrink-0" />
                <span>제휴카드 · 결합상품 유의사항 안내</span>
              </span>
              {showCompliance ? (
                <ChevronUp className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
            </button>
            {showCompliance && (
              <div className="px-4 pb-3.5 text-xs text-[#8B95A1] dark:text-slate-400 space-y-1.5 leading-relaxed break-keep border-t border-[#E5E8EB] dark:border-white/10 pt-3">
                <p>
                  • 본 제안서의 캐시백 및 제휴카드 월 캐시백/청구할인은 카드사 전월 실적 조건 충족 및 당월 행사 기준이며 결제일에 따라 일부 변동될 수 있습니다.
                </p>
                {!simState.hideHiPreed && (
                  <p>
                    • 하이프리드(거치기간 없이 150회[150개월] 납입 완료 시 만기)는 예·적금·보험 등 금융상품이 아닌 웅진프리드라이프의 선불식 할부거래 별도 계약 상품입니다. 상조·전환 서비스 미이용 및 만기 유지 시 납입 원금 100% 전액 환급이 적용되며, 중도 해지·3회 이상 연체 시 가전 지원금 지급 중단·환수가 발생하고 해약환급금은 공정거래위원회 고시에 따라 납입 원금보다 적거나 없을 수 있습니다. 계약서 수령일로부터 14일 이내 청약철회(할부거래법 제24조)가 가능하며, 할부거래법 제27조에 의거해 고객 납입금의 50%를 제1금융권 지급보증·예치 계약으로 안전하게 보전합니다.
                  </p>
                )}
                <p>
                  • 재고 확인 및 배송일 지정은 아래 담당 컨설턴트에게 문의해 주시면 신속히 안내해 드립니다.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 프리드 안내서 전용 팝업 모달 */}
      {isFreedGuideModalOpen && hasAnyActivePreedGuide && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsFreedGuideModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`웅진프리드라이프 ${activePreedGuideTitle}`}
        >
          <div
            className="w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#F2F4F6] dark:bg-[#0B1120] border border-[#D1D6DB] dark:border-slate-700 border-t-[4px] border-t-emerald-600 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-white dark:bg-[#131C2E] border-b border-[#E5E8EB] dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-[#191F28] dark:text-white break-keep leading-snug">
                    웅진프리드라이프 {activePreedGuideTitle}
                  </div>
                  <div className="text-[11px] font-semibold text-[#8B95A1] dark:text-slate-400 truncate">
                    만기 100% 환급 구조 · 8대 전환 서비스 · 멤버십 우대 안내
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {hasActiveGenPreedGuide && hasActiveSubPreedGuide && (
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F2F4F6] dark:bg-[#0B1120] border border-[#D1D6DB] dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setHybridGuideTab('guide-general')}
                      className={`px-2 py-1 rounded-md text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                        effectiveFreedGuideTab === 'guide-general'
                          ? 'bg-[#191F28] dark:bg-blue-600 text-white'
                          : 'text-[#4E5968] dark:text-slate-300'
                      }`}
                    >
                      하이프리드 ({generalHiPreed.totalAccounts}건)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHybridGuideTab('guide-sub')}
                      className={`px-2 py-1 rounded-md text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                        effectiveFreedGuideTab === 'guide-sub'
                          ? 'bg-[#191F28] dark:bg-blue-600 text-white'
                          : 'text-[#4E5968] dark:text-slate-300'
                      }`}
                    >
                      Hi구독 플러스 ({hiPlusSummary.totalAccounts}구좌)
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsFreedGuideModalOpen(false)}
                  aria-label="안내서 닫기"
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#4E5968] dark:text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <ProposalPreviewFreedGuide
                activeTab={effectiveFreedGuideTab}
                guideGeneralSummary={generalHiPreed}
                guideHiSummary={hiPlusSummary}
                isGuideTab={true}
                representativePeriod={subSummary.representativePeriod}
                scale={1}
                useMobileFluid={true}
              />
            </div>

            <div className="px-4 py-2.5 bg-white dark:bg-[#131C2E] border-t border-[#E5E8EB] dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsFreedGuideModalOpen(false)}
                className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-[#191F28] dark:bg-blue-600 hover:opacity-95 text-white text-xs sm:text-sm font-black cursor-pointer"
              >
                안내서 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 고정 컨시어지 액션 독 */}
      <div className="safe-bottom-dock no-print fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-t border-[#D1D6DB] dark:border-white/10 px-3.5 sm:px-5 pt-2 shadow-[0_-4px_16px_rgba(25,31,40,0.06)]">
        <div
          className={`${containerMaxW} mx-auto flex flex-col min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between gap-2 min-[480px]:gap-3`}
        >
          <div className="flex items-baseline justify-between min-[480px]:block gap-x-2 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8B95A1] dark:text-slate-400">
              <span>
                {payload.consultant.storeName} · {payload.consultant.name}
              </span>
              {isModifiedFromOriginal && (
                <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1B64DA] dark:text-[#93C5FD] text-[10.5px] font-black">
                  시뮬레이션 중
                </span>
              )}
            </div>
            <div className="text-sm sm:text-lg font-black text-[#E60012] dark:text-[#FF3B47] font-mono tabular-nums break-keep ml-auto min-[480px]:ml-0 leading-snug flex flex-wrap items-center gap-1">
              {simState.quoteMode === 'subscription' ? (
                subSurplus.isSurplusZone ? (
                  <>
                    <span className="whitespace-nowrap">월 0원</span>
                    {subSurplus.monthlySurplus > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10.5px] font-extrabold whitespace-nowrap">
                        {subSurplus.surplusStickyText}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="whitespace-nowrap">
                      월 <SpringNumberFlow value={subSummary.finalMonthlyFee} suffix="원" />
                    </span>
                    <span className="text-[11px] text-[#4E5968] dark:text-slate-300 font-bold whitespace-nowrap">
                      (총 {Math.max(0, subSummary.finalTotalFee).toLocaleString()}원)
                    </span>
                  </>
                )
              ) : simState.quoteMode === 'hybrid' ? (
                <>
                  <span className="whitespace-nowrap">
                    일시불 <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
                  </span>
                  <span className="text-[#4E5968] dark:text-slate-400">+</span>
                  {subSurplus.isSurplusZone ? (
                    <>
                      <span className="text-[#1B64DA] dark:text-blue-400 whitespace-nowrap">
                        월 0원
                      </span>
                      {subSurplus.monthlySurplus > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10.5px] font-extrabold whitespace-nowrap">
                          {subSurplus.surplusStickyText}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#1B64DA] dark:text-blue-400 whitespace-nowrap">
                      월 <SpringNumberFlow value={subSummary.finalMonthlyFee} suffix="원" />
                    </span>
                  )}
                  <span className="text-[11px] text-[#4E5968] dark:text-slate-300 font-bold whitespace-nowrap">
                    (통합 {hybridCombinedNetTotal.toLocaleString()}원)
                  </span>
                </>
              ) : (
                <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full min-[480px]:w-auto shrink-0">
            {!payload.consultant.hideStoreMap && (
              <a
                href={mapSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] min-w-[42px] p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] hover:bg-[#F2F4F6] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-white/10 inline-flex items-center justify-center shrink-0"
                title="매장 위치 지도 보기"
              >
                <MapPin className="w-4 h-4 text-[#4E5968] dark:text-slate-300" />
              </a>
            )}

            <button
              type="button"
              onClick={() => void handleShareOrCopyLink()}
              className={`min-h-[42px] px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 schedule-tactile whitespace-nowrap cursor-pointer shrink-0 transition ${
                copiedShareLink
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[#F8FAFC] dark:bg-[#1E293B] hover:bg-[#F2F4F6] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-white/10'
              }`}
              title="가족·배우자에게 견적 링크 공유 또는 복사"
            >
              {copiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>복사됨</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
                  <span>공유</span>
                </>
              )}
            </button>

            {cleanPhone && (
              <a
                href={`sms:${cleanPhone}${
                  typeof navigator !== 'undefined' &&
                  /iPad|iPhone|iPod/i.test(navigator.userAgent)
                    ? '&'
                    : '?'
                }body=${smsBody}`}
                className="min-h-[42px] flex-1 min-[480px]:flex-initial px-2.5 sm:px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] hover:bg-[#F2F4F6] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-white/10 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 schedule-tactile whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
                <span>문자 문의</span>
              </a>
            )}

            {cleanPhone ? (
              <a
                href={`tel:${cleanPhone}`}
                className="min-h-[42px] flex-[1.25] min-[480px]:flex-initial px-3 sm:px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 shadow-xs schedule-tactile whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 text-white shrink-0" />
                <span>담당자 통화</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void handleShareOrCopyLink()}
                className="min-h-[42px] flex-1 min-[480px]:flex-initial px-3.5 py-2 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5 text-white shrink-0" />
                <span>{copiedShareLink ? '견적 링크 복사됨' : '이 혜택 조건 보관'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CustomerShareStandaloneRoot: React.FC = () => {
  const [payload, setPayload] = useState<SharedQuotePayload | null>(() =>
    loadCachedCustomerQuotePayload()
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');

  useEffect(() => {
    let active = true;

    const loadFromUrl = async () => {
      const decoded = await decodeSharedQuoteFromHash();
      if (!active) return;
      if (decoded) {
        setPayload(decoded);
        setStatus('ready');
      } else {
        setStatus('invalid');
      }
    };

    loadFromUrl();

    const handleUrlChange = () => {
      loadFromUrl();
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      active = false;
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  if (status === 'loading' && !payload) {
    return (
      <div className="min-h-[100dvh] bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-[#F1F5F9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-11 h-11 rounded-xl bg-[#E60012] text-white flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div className="text-sm sm:text-base font-black">맞춤 견적서를 불러오는 중입니다...</div>
        <p className="text-xs text-[#8B95A1] dark:text-slate-400 font-medium mt-1">
          롯데하이마트 고객 전용 맞춤 견적 뷰어
        </p>
      </div>
    );
  }

  if (!payload || status === 'invalid') {
    return (
      <PublicZeroTrustGateRoot
        onStaffVerified={() => {
          window.location.href = `${window.location.origin}${window.location.pathname}`;
        }}
      />
    );
  }

  return <CustomerShareQuoteView payload={payload} />;
};

export const PublicZeroTrustGateRoot: React.FC<{
  onStaffVerified: () => void;
}> = ({ onStaffVerified }) => {
  const isInviteEntry = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(PENDING_INVITE_PROMPT_KEY) === '1'
      ) {
        return true;
      }
      const p = new URLSearchParams(window.location.search);
      if ((p.get('invite') || '').trim()) return true;
      // 아이폰 홈 화면 앱에서 첫 실행될 때 이미 GAS URL이 저장되어 있으면 초대 인증 모드로 인식
      if (
        getGlobalStandaloneState() &&
        Boolean(normalizeGasWebAppUrl(readRawSyncConfig().repo))
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const [showPinBox, setShowPinBox] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(PENDING_INVITE_PROMPT_KEY) === '1'
      ) {
        return true;
      }
      const p = new URLSearchParams(window.location.search);
      if (
        p.get('staff') === '1' ||
        p.get('admin') === '1' ||
        Boolean((p.get('invite') || '').trim())
      ) {
        return true;
      }
      if (
        getGlobalStandaloneState() &&
        Boolean(normalizeGasWebAppUrl(readRawSyncConfig().repo))
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const [tapCount, setTapCount] = useState(0);
  const [pinValue, setPinValue] = useState('');
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isStandaloneNow, setIsStandaloneNow] = useState<boolean>(() =>
    getGlobalStandaloneState()
  );
  const [hasNativePrompt, setHasNativePrompt] = useState<boolean>(() =>
    Boolean(getGlobalDeferredInstallPrompt())
  );
  const [showManualInstallHelp, setShowManualInstallHelp] =
    useState<boolean>(false);
  const [installDoneBanner, setInstallDoneBanner] = useState<boolean>(false);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState<boolean>(false);
  const [forceShowIosSafariCodeBox, setForceShowIosSafariCodeBox] =
    useState<boolean>(false);

  const env = useMemo(
    () => detectInstallEnvironment(undefined, isStandaloneNow),
    [isStandaloneNow]
  );

  const targetInviteUrl = useMemo(() => {
    const built = buildFriendInviteUrl(readRawSyncConfig().repo);
    if (built) return built;
    return typeof window !== 'undefined' ? window.location.href : '';
  }, []);

  useEffect(() => {
    return subscribePwaInstallState(() => {
      const standalone = getGlobalStandaloneState();
      setIsStandaloneNow(standalone);
      setHasNativePrompt(Boolean(getGlobalDeferredInstallPrompt()));
      if (standalone) {
        setInstallDoneBanner(true);
        setShowManualInstallHelp(false);
      }
    });
  }, []);

  // 삼성 갤럭시(안드로이드) 카카오톡/인앱브라우저에서 초대링크 진입 시 구글 크롬(Chrome)으로 즉시 자동 실행
  useEffect(() => {
    if (!isInviteEntry) return;
    if (!env.isAndroid || !env.isInAppBrowser) return;
    if (!targetInviteUrl) return;
    const timer = window.setTimeout(() => {
      launchUrlInAndroidChrome(targetInviteUrl);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isInviteEntry, env.isAndroid, env.isInAppBrowser, targetInviteUrl]);

  const handleCopyInviteUrl = async () => {
    if (!targetInviteUrl) return;
    await safeCopyText(targetInviteUrl);
    setCopiedInviteUrl(true);
    window.setTimeout(() => setCopiedInviteUrl(false), 2500);
  };

  const handleGateInstallClick = async () => {
    if (env.isAndroid && (env.isInAppBrowser || env.isSamsungBrowser)) {
      launchUrlInAndroidChrome(targetInviteUrl);
      return;
    }
    if (hasNativePrompt || getGlobalDeferredInstallPrompt()) {
      const res = await triggerNativePwaInstallPrompt();
      if (res === 'accepted') {
        setInstallDoneBanner(true);
        setShowManualInstallHelp(false);
        return;
      }
    }
    setShowManualInstallHelp((prev) => !prev);
  };

  const handleSecretShieldTap = () => {
    setTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowPinBox(true);
        return 0;
      }
      return next;
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const trimmed = pinValue.trim();
    if (!trimmed) {
      setPinErrorMsg('보안 코드 또는 8자리 초대코드를 입력해 주세요.');
      return;
    }

    // 1차: 로컬 마스터 PIN이 설정되어 있고 일치하면 즉시 해제
    const localPin = getEffectiveStaffPin();
    if (
      localPin !== UNCONFIGURED_PIN_SENTINEL &&
      unlockStaffDeviceWithPin(trimmed)
    ) {
      setPinErrorMsg(null);
      onStaffVerified();
      return;
    }

    // 2차: 클라우드 GAS URL이 연결되어 있으면 서버 기기 인증(관리자 PIN 및 8자리 1회용 친구 초대코드) 검증
    const configuredGasUrl = normalizeGasWebAppUrl(readRawSyncConfig().repo);
    if (configuredGasUrl) {
      setIsSubmitting(true);
      setPinErrorMsg(null);
      try {
        const authRes = await authenticateDeviceWithCloud(trimmed);
        if (authRes.ok) {
          if (authRes.role === 'friend') {
            await syncFriendRemoteProfileFromCloud(authRes.codeId);
          }
          setPinErrorMsg(null);
          onStaffVerified();
          return;
        }
        setPinErrorMsg(
          authRes.error || '보안 코드가 일치하지 않습니다.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setPinErrorMsg('보안 코드가 일치하지 않습니다.');
  };

  // 카카오톡/인앱브라우저 또는 아이폰 비-Safari 브라우저에서는 1회용 코드가 오소진되지 않도록 코드 입력창을 안전 보호
  const blockCodeInputUntilProperBrowser =
    isInviteEntry &&
    !isStandaloneNow &&
    (env.isInAppBrowser || env.isIosNonSafariBrowser);

  // 아이폰 Safari(설치 전)에서는 바탕화면 먼저 추가하도록 기본 안내하고, 원할 때만 코드창 열기 허용
  const isIosSafariPreInstall =
    isInviteEntry && env.isIosSafari && !isStandaloneNow;

  const shouldRenderCodeForm =
    showPinBox &&
    !blockCodeInputUntilProperBrowser &&
    (!isIosSafariPreInstall || forceShowIosSafariCodeBox);

  return (
    <div className="min-h-[100dvh] bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-[#F1F5F9] flex flex-col items-center justify-center p-4 sm:p-5 select-none">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-white/10 border-t-[4px] border-t-[#E60012] p-5 sm:p-6 text-center shadow-[0_4px_20px_rgba(25,31,40,0.06)] space-y-4">
        <div
          onClick={handleSecretShieldTap}
          className="w-11 h-11 mx-auto rounded-xl bg-[#191F28] dark:bg-[#1E293B] text-white flex items-center justify-center"
        >
          <ShieldCheck className="w-5 h-5 text-[#60A5FA]" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-wider">
              LOTTE HIMART
            </span>
            {!isInviteEntry && (
              <span className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300">
                {isStandaloneNow ? '스마트 상담 시스템' : '공식 맞춤 견적 뷰어'}
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight break-keep">
            {isInviteEntry
              ? '전용 앱 설치 및 초대코드 등록'
              : isStandaloneNow
              ? '초대코드 또는 보안코드 등록'
              : '전용 견적 링크로만 열람 가능합니다'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium break-keep">
            {isInviteEntry || isStandaloneNow ? (
              isStandaloneNow ? (
                <>
                  바탕화면 앱 실행이 확인되었습니다! 아래에 전달받으신{' '}
                  <strong>8자리 등록코드</strong>를 입력하면 바로 시작됩니다.
                </>
              ) : (
                <>
                  처음 오셨나요? 아래 안내에 따라{' '}
                  <strong>바탕화면에 앱을 설치</strong>하고{' '}
                  <strong>8자리 등록코드</strong>를 입력해 주세요.
                </>
              )
            ) : (
              <>
                문자(SMS) 또는 카카오톡으로 전달받으신 <strong>맞춤 견적 링크</strong>를 눌러 접속해 주세요.
              </>
            )}
          </p>
        </div>

        {/* ==================== 초대 링크 접속자용 기기별 맞춤 앱 설치 · 브라우저 자동 유도 블록 ==================== */}
        {isInviteEntry && (
          <div className="space-y-3 text-left">
            {/* CASE 1: 삼성/안드로이드 카카오톡 등 인앱브라우저 -> 크롬 자동 열기 + 원클릭 버튼 */}
            {env.isAndroid && env.isInAppBrowser && !isStandaloneNow && (
              <div className="rounded-xl border-2 border-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-950/40 p-3.5 space-y-2.5">
                <div className="text-xs sm:text-[13px] font-black text-[#1B64DA] dark:text-blue-300 leading-snug break-keep">
                  🤖 삼성 갤럭시 안내 — 크롬(Chrome)으로 이동해 주세요!
                </div>
                <p className="text-[11.5px] sm:text-xs font-semibold text-[#191F28] dark:text-slate-200 leading-relaxed break-keep">
                  지금 보고 계신 <strong>카카오톡 내부 화면</strong>에서는 바탕화면 앱 설치가 되지 않으며, 여기서 코드를 입력하면 기기 허용 횟수가 차감됩니다.
                  <br />
                  자동으로 크롬이 열리지 않았다면 아래 파란 버튼을 눌러주세요!
                </p>
                <button
                  type="button"
                  onClick={() => launchUrlInAndroidChrome(targetInviteUrl)}
                  className="min-h-[46px] w-full py-3 px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>크롬(Chrome)으로 바로 열기</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyInviteUrl()}
                  className="min-h-[38px] w-full py-2 px-3 rounded-lg bg-white dark:bg-[#0B1120] border border-[#BFDBFE] dark:border-white/15 text-[#4E5968] dark:text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedInviteUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#059669]" />
                      <span className="text-[#059669] font-extrabold">초대 링크 복사됨! 크롬 주소창에 붙여넣으세요</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span>안 열릴 경우 초대 링크 복사하기</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CASE 2: 아이폰 카카오톡/인앱브라우저 또는 비-Safari 브라우저 -> Safari 열기 안내 */}
            {env.isIos &&
              !isStandaloneNow &&
              (env.isInAppBrowser || env.isIosNonSafariBrowser) && (
                <div className="rounded-xl border-2 border-[#E60012] bg-[#FFF1F2] dark:bg-rose-950/35 p-3.5 space-y-2.5">
                  <div className="text-xs sm:text-[13px] font-black text-[#E60012] dark:text-rose-300 leading-snug break-keep">
                    🍎 아이폰 필수 안내 — 기본 Safari(사파리)로 열어주세요!
                  </div>
                  <p className="text-[11.5px] sm:text-xs font-semibold text-[#191F28] dark:text-slate-200 leading-relaxed break-keep">
                    아이폰은 애플 보안 정책상 <strong>기본 Safari(나침반 모양 앱)</strong>에서만 바탕화면 앱 설치가 가능합니다. 아래 2가지 방법 중 편한 방법으로 열어주세요!
                  </p>
                  <div className="rounded-lg bg-white dark:bg-[#0B1120] border border-[#FECDD3] dark:border-rose-500/30 p-3 space-y-1.5 text-[11.5px] sm:text-xs font-bold text-[#191F28] dark:text-slate-100 leading-relaxed break-keep">
                    <div>
                      1️⃣ <strong>가장 쉬운 방법:</strong> 지금 화면 오른쪽 맨 아래{' '}
                      <span className="text-[#1B64DA] dark:text-blue-300">[⋯]</span> 또는{' '}
                      <span className="text-[#1B64DA] dark:text-blue-300">[공유 ↑]</span> 버튼 터치 ➔{' '}
                      <span className="underline">[Safari로 열기]</span> 선택!
                    </div>
                    <div>
                      2️⃣ <strong>직접 붙여넣기:</strong> 아래 버튼으로 주소를 복사한 뒤, 아이폰 바탕화면의{' '}
                      <span className="text-[#1B64DA] dark:text-blue-300">Safari</span> 앱을 열어 주소창에 붙여넣기!
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyInviteUrl()}
                    className="min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-[#191F28] dark:bg-[#1B64DA] hover:opacity-95 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    {copiedInviteUrl ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>복사 완료! 이제 Safari 주소창에 붙여넣어 주세요</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 shrink-0" />
                        <span>초대 링크 주소 복사하기</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            {/* CASE 3: 아이폰 Safari 접속 완료 (바탕화면 설치 전) -> 앱 설치하기 버튼 + 1·2·3 초보자 친절 설명 */}
            {isIosSafariPreInstall && (
              <div className="rounded-xl border-2 border-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-950/40 p-3.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowManualInstallHelp((v) => !v)}
                  className="min-h-[46px] w-full py-3 px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>📲 1단계: 아이폰 바탕화면에 앱 설치하기</span>
                </button>

                <div className="rounded-lg bg-white dark:bg-[#0B1120] border border-[#BFDBFE] dark:border-blue-500/35 p-3 space-y-2 text-[11.5px] sm:text-xs leading-relaxed break-keep">
                  <div className="font-black text-[#1B64DA] dark:text-blue-300">
                    🍎 아이폰 따라하기 (딱 10초! 꼭 앱부터 추가해 주세요)
                  </div>
                  <ol className="space-y-1.5 font-semibold text-[#191F28] dark:text-slate-200 list-none">
                    <li>
                      <strong>①</strong> 화면 맨 아래 가운데{' '}
                      <strong className="text-[#E60012] dark:text-rose-300">
                        [공유 버튼 (네모 위 화살표 ↑)]
                      </strong>
                      을 누릅니다.{' '}
                      <span className="text-[11px] text-[#8B95A1]">
                        (안 보이면 우측 하단 [⋯] 터치)
                      </span>
                    </li>
                    <li>
                      <strong>②</strong> 메뉴를 살짝 위로 올려{' '}
                      <strong className="text-[#1B64DA] dark:text-blue-300">
                        [홈 화면에 추가 (+)]
                      </strong>
                      를 누르고 우측 상단 <strong>[추가]</strong>를 누릅니다.
                    </li>
                    <li>
                      <strong>③</strong> 아이폰 바탕화면에 생긴 빨간{' '}
                      <strong>[하이마트 상담앱]</strong> 아이콘을 눌러 실행한 뒤,{' '}
                      <strong>그 앱 안에서 8자리 등록코드</strong>를 입력하면 완료!
                    </li>
                  </ol>
                  <p className="text-[11px] font-bold text-[#4E5968] dark:text-slate-400 pt-1 border-t border-[#E5E8EB] dark:border-white/10">
                    💡 왜 먼저 설치하나요? 아이폰은 사파리에서 코드를 먼저 치면 바탕화면 앱에서 코드를 또 물어볼 수 있어, 바탕화면 앱을 먼저 만든 뒤 입력하셔야 한 번에 끝납니다!
                  </p>
                </div>

                {!forceShowIosSafariCodeBox && (
                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => setForceShowIosSafariCodeBox(true)}
                      className="text-[11px] font-bold text-[#8B95A1] underline cursor-pointer"
                    >
                      바탕화면 설치 없이 지금 브라우저에서만 코드 입력하기
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CASE 4: 삼성 인터넷으로 열었을 때 -> 크롬 전환 원클릭 버튼 + 삼성 인터넷 설치 안내 */}
            {env.isSamsungBrowser && !isStandaloneNow && (
              <div className="rounded-xl border-2 border-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-950/40 p-3.5 space-y-2">
                <div className="text-xs font-black text-[#1B64DA] dark:text-blue-300 break-keep">
                  🤖 삼성 인터넷 접속 감지 — 크롬으로 열면 버튼 한 번으로 앱이 설치됩니다!
                </div>
                <button
                  type="button"
                  onClick={() => launchUrlInAndroidChrome(targetInviteUrl)}
                  className="min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>크롬(Chrome)으로 열어서 앱 설치하기 (추천)</span>
                </button>
                <div className="text-[11px] font-semibold text-[#4E5968] dark:text-slate-300 leading-relaxed break-keep">
                  ※ 삼성 인터넷에서 바로 설치하려면: 화면 오른쪽 아래 <strong>[≡ 줄 3개 메뉴]</strong> ➔ <strong>[+ 현재 페이지 추가]</strong> ➔ <strong>[홈 화면]</strong>을 누르세요.
                </div>
              </div>
            )}

            {/* CASE 5: 갤럭시 크롬 / PC 크롬·엣지 (설치 전) -> 큼직한 [📲 앱 설치하기] 버튼 + 초보자 가이드 */}
            {!env.isIos &&
              !env.isInAppBrowser &&
              !env.isSamsungBrowser &&
              !isStandaloneNow && (
                <div className="rounded-xl border border-[#BFDBFE] dark:border-blue-500/35 bg-[#EFF6FF] dark:bg-blue-950/35 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-[#1B64DA] dark:text-blue-300">
                      STEP 1 · 바탕화면에 전용 앱 설치
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-[#1B64DA] dark:text-blue-300 text-[10.5px] font-extrabold border border-[#BFDBFE] dark:border-blue-500/30">
                      전체화면 실행
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleGateInstallClick()}
                    className="min-h-[46px] w-full py-3 px-4 rounded-xl bg-[#191F28] hover:bg-[#262F3D] dark:bg-[#1B64DA] dark:hover:bg-[#1552B5] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
                  >
                    <Download className="w-4 h-4 shrink-0 text-[#60A5FA] dark:text-white" />
                    <span>📲 바탕화면에 앱 설치하기</span>
                  </button>

                  {(showManualInstallHelp || !hasNativePrompt) && (
                    <div className="rounded-lg bg-white dark:bg-[#0B1120] border border-[#DBEAFE] dark:border-white/10 p-2.5 text-[11.5px] font-semibold text-[#4E5968] dark:text-slate-300 leading-relaxed break-keep">
                      💡 <strong>설치 팝업이 안 뜨면 이렇게 해보세요!</strong>
                      <br />
                      크롬 화면 오른쪽 맨 위 <strong>점 3개 [⋮]</strong> 터치 ➔ 메뉴에서{' '}
                      <strong className="text-[#191F28] dark:text-white">[앱 설치]</strong> 또는{' '}
                      <strong className="text-[#191F28] dark:text-white">[홈 화면에 추가]</strong>를 누르면 바탕화면에 아이콘이 생깁니다.
                    </div>
                  )}
                </div>
              )}

            {/* CASE 6: 앱 설치 완료 / 바탕화면 앱으로 실행된 상태 */}
            {(isStandaloneNow || installDoneBanner) && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 flex items-center gap-2 text-xs font-extrabold text-[#059669] dark:text-emerald-300 break-keep">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>
                  ✅ 바탕화면 전용 앱 준비 완료! 아래에 8자리 등록코드를 입력해 주세요.
                </span>
              </div>
            )}
          </div>
        )}

        {shouldRenderCodeForm && (
          <div className="pt-3 border-t border-[#E5E8EB] dark:border-white/10">
            <form onSubmit={(e) => void handleVerify(e)} className="space-y-2 text-left">
              <label className="block text-xs font-extrabold text-[#191F28] dark:text-white break-keep">
                {isInviteEntry
                  ? 'STEP 2 · 전달받은 8자리 등록코드 입력 (허용된 본인 기기 귀속)'
                  : '기기 등록 보안 코드 입력 (8자리 초대코드 또는 관리자 코드)'}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={isSubmitting}
                  value={pinValue}
                  onChange={(e) => {
                    setPinValue(e.target.value);
                    setPinErrorMsg(null);
                  }}
                  placeholder={isInviteEntry ? '예: 1234-5678' : '보안 코드 또는 8자리 초대코드'}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-[#D1D6DB] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0B1120] text-base sm:text-sm font-mono font-extrabold tracking-wider focus:outline-none focus:border-[#1B64DA] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg bg-[#E60012] hover:bg-[#C8000F] disabled:opacity-60 text-white text-xs sm:text-sm font-black shrink-0 cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>확인중</span>
                    </>
                  ) : (
                    <span>등록 완료</span>
                  )}
                </button>
              </div>
              {isInviteEntry && (
                <p className="text-[11px] font-medium text-[#8B95A1] dark:text-slate-400 leading-snug break-keep">
                  ※ 하이픈(-) 없이 숫자 8자리만 입력하셔도 됩니다. 한 번 등록하면 다음부터는 코드 입력 없이 바로 열립니다.
                </p>
              )}
              {pinErrorMsg && (
                <p className="text-xs font-bold text-[#E60012] dark:text-[#FF3B47] leading-relaxed break-keep">
                  {pinErrorMsg}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
