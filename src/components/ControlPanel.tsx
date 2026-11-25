import React, { useEffect, useRef, useState } from 'react';
import { addEmptyGeneralPlanInState, AFFILIATE_CARDS, AffiliateCardId, AFFILIATE_GENERAL_CARD_OPTIONS, applyAllGeneralPlansPatch, calculateGeneralHiPreedSummary, calculateGeneralPurchaseSummary, calculateHiPlusSummary, calculateSubscriptionSummary, confirmActiveGeneralPlanInState, copyPlan1ToPlan2InState, deleteGeneralPlanInState, duplicateActiveGeneralPlanInState, GENERAL_CATEGORY_PRESETS, GENERAL_HIPREED_PLANS, GeneralExtraBenefitItem, GeneralExtraBenefitType, GeneralHiPreedKey, GeneralPurchaseItem, getGeneralPlan1And2Summaries, getSubscriptionPeriodSummary, getSubscriptionSurplusMeta, HiPlusKey, isAffiliateGeneralCardType, MAX_FREED_ACCOUNTS, MAX_QUOTE_PLANS, normalizeSubscriptionPeriod, ProposalState, QuoteMode, SUB_CARE_OPTIONS, SubscriptionItem, SubscriptionPeriod, switchGeneralPlanInState } from '../types/proposal';
import { SpringNumberFlow } from './SpringNumberFlow';
import { getStoredGeminiApiKey, setStoredGeminiApiKey } from '../utils/aiImageParser';
import { ArrowLeft, Camera, Check, Copy, CreditCard, Eye, EyeOff, KeyRound, Loader2, Minus, Plus, RotateCcw, Save, ShieldCheck, ShoppingBag, User, X } from 'lucide-react';
import { ControlPanelSubscriptionSection } from './ControlPanelSubscriptionSection';
import { QuoteModeComparisonControlBar } from './MultiModeComparisonSection';
import { FormattedMoneyInput } from './FormattedMoneyInput';
import { FlagshipModalShell } from './ui/FlagshipModalShell';

interface ControlPanelProps {
  state: ProposalState;
  onChange: React.Dispatch<React.SetStateAction<ProposalState>>;
  onParseImage: (file: File) => Promise<void>;
  isParsing: boolean;
  parseError: string | null;
  subScanNotice?: string | null;
  onParseGeneralImage?: (file: File) => Promise<void>;
  isParsingGeneral?: boolean;
  parseGeneralError?: string | null;
  onShowProposal: () => void;
  onBackToHome: () => void;
  backLabel?: string;
  activeCustomer?: { id: string; name: string; phone?: string; activeQuoteId?: string } | null;
  onClearActiveCustomer?: () => void;
  onOpenSaveToCrm?: () => void;
  onSwitchMode?: (mode: QuoteMode) => void;
  embeddedSplitMode?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  state,
  onChange,
  onParseImage,
  isParsing,
  parseError,
  subScanNotice = null,
  onParseGeneralImage,
  isParsingGeneral = false,
  parseGeneralError = null,
  onShowProposal,
  onBackToHome,
  backLabel,
  activeCustomer,
  onClearActiveCustomer,
  onOpenSaveToCrm,
  onSwitchMode,
  embeddedSplitMode = false,
}) => {
  const liveGenSummary = calculateGeneralPurchaseSummary(state);
  const liveSubSummary = calculateSubscriptionSummary(state);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // 혼합견적 모드에서 Ctrl+V 시 어느 영역에 붙여넣을지 포커스 추적
  const [lastFocusedSection, setLastFocusedSection] = useState<
    'general' | 'subscription'
  >(state.quoteMode === 'general' ? 'general' : 'subscription');

  // AI 키 설정 모달 상태
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiApiKey());
  const [apiKeySavedToast, setApiKeySavedToast] = useState(false);

  // AI 키 설정 팝업 열림 시 뒤로가기로 팝업만 먼저 닫기
  useEffect(() => {
    if (isApiKeyModalOpen) {
      try {
        window.history.pushState({ appGuard: true, tag: 'apikey-modal' }, '');
      } catch {
        // ignore
      }
    }
    (window as any).__subViewBackHandler = (): boolean => {
      if (isApiKeyModalOpen) {
        setIsApiKeyModalOpen(false);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [isApiKeyModalOpen]);

  const showGeneral =
    state.quoteMode === 'general' || state.quoteMode === 'hybrid';
  const showSubscription =
    state.quoteMode === 'subscription' || state.quoteMode === 'hybrid';

  useEffect(() => {
    if (state.quoteMode === 'general') {
      setLastFocusedSection('general');
    } else if (state.quoteMode === 'subscription') {
      setLastFocusedSection('subscription');
    }
  }, [state.quoteMode]);

  // 클립보드 붙여넣기 (Ctrl+V) 감지 - 일반구매 및 구독구매 모두 지원
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isApiKeyModalOpen) return;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            if (state.quoteMode === 'general') {
              onParseGeneralImage?.(file);
            } else if (state.quoteMode === 'subscription') {
              onParseImage(file);
            } else {
              if (lastFocusedSection === 'general' && onParseGeneralImage) {
                onParseGeneralImage(file);
              } else {
                onParseImage(file);
              }
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [
    isApiKeyModalOpen,
    lastFocusedSection,
    onParseGeneralImage,
    onParseImage,
    state.quoteMode,
  ]);

  const handleSaveApiKey = () => {
    setStoredGeminiApiKey(apiKeyInput);
    setApiKeySavedToast(true);
    setTimeout(() => {
      setApiKeySavedToast(false);
      setIsApiKeyModalOpen(false);
    }, 800);
  };

  const [planActionNotice, setPlanActionNotice] = useState<string | null>(null);
  const triggerPlanNotice = (msg: string) => {
    setPlanActionNotice(msg);
    setTimeout(() => {
      setPlanActionNotice((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  // ==================== 일반구매 & 구독구매 다중 안(1안~6안) 요약 핸들러 ====================
  const generalSummary = calculateGeneralPurchaseSummary(state);
  const generalHiPreedSummary = calculateGeneralHiPreedSummary(
    state.generalHiPreedCounts,
    Boolean(state.hideHiPreed)
  );
  const {
    plan1Summary,
    plan2Summary,
    plan1SubSummary,
    plan2SubSummary,
    allPlans,
  } = getGeneralPlan1And2Summaries(state);

  const validGenPlans = allPlans.filter((p) => p.genSummary.sum > 0);
  const bothPlansHavePrice = validGenPlans.length >= 2;
  const planNetDiff =
    validGenPlans.length >= 2
      ? validGenPlans[validGenPlans.length - 1].genSummary.rawNet -
        validGenPlans[0].genSummary.rawNet
      : plan2Summary.rawNet - plan1Summary.rawNet;

  const validSubPlans = allPlans.filter(
    (p) => p.subSummary.totalBaseMonthly > 0
  );
  const bothSubPlansHavePrice = validSubPlans.length >= 2;
  const subNetDiff =
    validSubPlans.length >= 2
      ? validSubPlans[validSubPlans.length - 1].subSummary.finalMonthlyFee -
        validSubPlans[0].subSummary.finalMonthlyFee
      : plan2SubSummary.finalMonthlyFee - plan1SubSummary.finalMonthlyFee;
  const subTotalNetDiff =
    validSubPlans.length >= 2
      ? validSubPlans[validSubPlans.length - 1].subSummary.finalTotalFee -
        validSubPlans[0].subSummary.finalTotalFee
      : plan2SubSummary.finalTotalFee - plan1SubSummary.finalTotalFee;

  const canAddMorePlans = allPlans.length < MAX_QUOTE_PLANS;

  const handleSelectGeneralPlan = (targetPlan: number) => {
    onChange((prev) => switchGeneralPlanInState(prev, targetPlan));
  };

  const handleAddEmptyPlan = () => {
    if (!canAddMorePlans) return;
    const nextNum = allPlans.length + 1;
    onChange((prev) => addEmptyGeneralPlanInState(prev));
    triggerPlanNotice(`✓ 새 견적 ${nextNum}안이 추가되었습니다`);
  };

  const handleDuplicateCurrentPlan = () => {
    if (!canAddMorePlans) return;
    const srcNum = state.activeGeneralPlan || 1;
    const nextNum = allPlans.length + 1;
    onChange((prev) => duplicateActiveGeneralPlanInState(prev));
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
    triggerPlanNotice(`✓ ${srcNum}안 구성을 ${nextNum}안으로 복제했습니다`);
  };

  const handleDeletePlan = (targetPlan: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (allPlans.length <= 1) return;
    onChange((prev) => deleteGeneralPlanInState(prev, targetPlan));
    triggerPlanNotice(
      allPlans.length === 2
        ? '✓ 남은 견적안이 단독 1안으로 자동 정렬되었습니다'
        : `✓ ${targetPlan}안 삭제 후 번호가 자동 정렬되었습니다`
    );
  };

  const handleConfirmCurrentPlan = () => {
    if (allPlans.length <= 1) return;
    const chosenNum = state.activeGeneralPlan || 1;
    onChange((prev) => confirmActiveGeneralPlanInState(prev, chosenNum));
    triggerPlanNotice(
      `✓ 선택하신 ${chosenNum}안이 단독 1안으로 확정되었습니다 (나머지 비교안 정리 완료)`
    );
  };

  const handleGeneralFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file && onParseGeneralImage) {
      await onParseGeneralImage(file);
      e.target.value = '';
    }
  };

  const handleAddGeneralCategory = (categoryName: string) => {
    onChange((prev) => {
      const emptyIdx = prev.generalItems.findIndex(
        (it) =>
          it.category.trim() === '' && (!it.unitPrice || it.unitPrice === 0)
      );
      if (emptyIdx !== -1) {
        return {
          ...prev,
          generalItems: prev.generalItems.map((it, idx) =>
            idx === emptyIdx ? { ...it, category: categoryName } : it
          ),
        };
      }
      const newItem: GeneralPurchaseItem = {
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: categoryName,
        modelName: '',
        quantity: 1,
        unitPrice: 0,
      };
      return {
        ...prev,
        generalItems: [...prev.generalItems, newItem],
      };
    });
  };

  const handleAddEmptyGeneralItem = () => {
    const newItem: GeneralPurchaseItem = {
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: '',
      modelName: '',
      quantity: 1,
      unitPrice: 0,
    };
    onChange((prev) => ({
      ...prev,
      generalItems: [...prev.generalItems, newItem],
    }));
  };

  const handleUpdateGeneralItem = (
    id: string,
    patch: Partial<GeneralPurchaseItem>
  ) => {
    onChange((prev) => ({
      ...prev,
      generalItems: prev.generalItems.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ),
    }));
  };

  const handleRemoveGeneralItem = (id: string) => {
    onChange((prev) => {
      if (prev.generalItems.length <= 1) return prev;
      return {
        ...prev,
        generalItems: prev.generalItems.filter((it) => it.id !== id),
      };
    });
  };

  const handleResetGeneralItems = () => {
    onChange((prev) => ({
      ...prev,
      generalItems: [
        {
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: '',
          modelName: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
      generalCardType: '미정',
      instantDiscount: 0,
      earnedPoints: 0,
      pointUsed: 0,
      autoTierCashback: true,
      manualTierCashback: 0,
      extraCashback: 0,
      extraBenefits: [],
      generalHiPreedCounts: {
        hf75: 0,
        hf150: 0,
        hf225: 0,
        hf300: 0,
      },
    }));
  };

  // 추가 혜택 추가 / 수정 / 삭제
  const handleAddExtraBenefit = () => {
    const newBenefit: GeneralExtraBenefitItem = {
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'etc',
      description: '',
      amount: 0,
    };
    onChange((prev) => ({
      ...prev,
      extraBenefits: [...(prev.extraBenefits || []), newBenefit],
    }));
  };

  const handleUpdateExtraBenefit = (
    id: string,
    patch: Partial<GeneralExtraBenefitItem>
  ) => {
    onChange((prev) => ({
      ...prev,
      extraBenefits: (prev.extraBenefits || []).map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    }));
  };

  const handleRemoveExtraBenefit = (id: string) => {
    onChange((prev) => ({
      ...prev,
      extraBenefits: (prev.extraBenefits || []).filter((b) => b.id !== id),
    }));
  };

  const handleAdjustGeneralHiPreed = (
    key: GeneralHiPreedKey,
    delta: number
  ) => {
    onChange((prev) => {
      const counts = prev.generalHiPreedCounts;
      const currentTotal =
        (counts.hf75 || 0) +
        (counts.hf150 || 0) +
        (counts.hf225 || 0) +
        (counts.hf300 || 0);
      const hybridSubTotal =
        prev.quoteMode === 'hybrid' && !prev.hideSubPreed
          ? (prev.hiPlusCounts.hi72 || 0) +
            (prev.hiPlusCounts.hi90 || 0) +
            (prev.hiPlusCounts.hi108 || 0)
          : 0;
      const currentVal = counts[key] || 0;
      const nextVal = currentVal + delta;

      if (nextVal < 0) return prev;
      if (delta > 0 && currentTotal + hybridSubTotal >= MAX_FREED_ACCOUNTS) return prev;

      return {
        ...prev,
        generalHiPreedCounts: {
          ...counts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleResetGeneralHiPreed = () => {
    onChange((prev) => ({
      ...prev,
      generalHiPreedCounts: {
        hf75: 0,
        hf150: 0,
        hf225: 0,
        hf300: 0,
      },
    }));
  };

  const handleToggleHideHiPreed = () => {
    onChange((prev) => {
      const nextHidden = !prev.hideHiPreed;
      return applyAllGeneralPlansPatch(prev, (plan) => ({
        ...plan,
        hideHiPreed: nextHidden,
      }));
    });
  };

  // ==================== 구독구매 핸들러 ====================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onParseImage(file);
      e.target.value = '';
    }
  };

  const handleCardSelect = (cardId: AffiliateCardId) => {
    const cardSpec = AFFILIATE_CARDS.find((c) => c.id === cardId);
    onChange((prev) => ({
      ...prev,
      selectedCardId: cardId,
      selectedCardTierId: cardSpec?.tiers[0]?.id || '',
      subAutoTierCashback: true,
      subManualTierCashback: 0,
      subLotteBilling5p: cardId === 'lotte' ? Boolean(prev.subLotteBilling5p) : false,
    }));
  };

  const handleAddSubItem = () => {
    onChange((prev) => {
      const lastItem = prev.items[prev.items.length - 1];
      const defaultPeriod: SubscriptionPeriod = normalizeSubscriptionPeriod(
        lastItem?.period,
        normalizeSubscriptionPeriod(prev.subscriptionPeriod, 60)
      );
      const newItem: SubscriptionItem = {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: '',
        modelName: '',
        monthlyFee: 0,
        period: defaultPeriod,
        careService: SUB_CARE_OPTIONS[0],
        warrantyType: '5년 무상 A/S 기본 포함',
      };
      const nextItems = [...prev.items, newItem];
      const repPeriod = getSubscriptionPeriodSummary(
        nextItems,
        defaultPeriod
      ).representativePeriod;
      return {
        ...prev,
        items: nextItems,
        subscriptionPeriod: repPeriod,
      };
    });
  };

  const handleRemoveSubItem = (id: string) => {
    onChange((prev) => {
      if (prev.items.length <= 1) return prev;
      const nextItems = prev.items.filter((it) => it.id !== id);
      const repPeriod = getSubscriptionPeriodSummary(
        nextItems,
        prev.subscriptionPeriod
      ).representativePeriod;
      return {
        ...prev,
        items: nextItems,
        subscriptionPeriod: repPeriod,
      };
    });
  };

  const handleResetSubItems = () => {
    onChange((prev) => ({
      ...prev,
      items: [
        {
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: '',
          modelName: '',
          monthlyFee: 0,
          period: 60,
          careService: SUB_CARE_OPTIONS[0],
          warrantyType: '5년 무상 A/S 기본 포함',
        },
      ],
      subscriptionPeriod: 60,
      careService: SUB_CARE_OPTIONS[0],
      warrantyType: 'AS연장보험 + 가전수리올케어',
      warrantyYears: 5,
      allCare: true,
      subAutoTierCashback: true,
      subManualTierCashback: 0,
      subExtraCashback: 0,
      subLotteBilling5p: false,
      selectedCardId: 'none',
      selectedCardTierId: '',
      hiPlusCounts: {
        hi72: 0,
        hi90: 0,
        hi108: 0,
      },
      hiPlusPayoutMethod: 'card_bank',
      countPreedTowardCardSpend: false,
    }));
  };

  const handleUpdateSubItem = (id: string, patch: Partial<SubscriptionItem>) => {
    onChange((prev) => {
      const nextItems = prev.items.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      );
      const repPeriod = getSubscriptionPeriodSummary(
        nextItems,
        prev.subscriptionPeriod
      ).representativePeriod;
      return {
        ...prev,
        items: nextItems,
        subscriptionPeriod: repPeriod,
      };
    });
  };

  const handleAdjustHiPlus = (key: HiPlusKey, delta: number) => {
    onChange((prev) => {
      const currentTotal =
        (prev.hiPlusCounts.hi72 || 0) +
        (prev.hiPlusCounts.hi90 || 0) +
        (prev.hiPlusCounts.hi108 || 0);
      const hybridGenTotal =
        prev.quoteMode === 'hybrid' && !prev.hideHiPreed
          ? (prev.generalHiPreedCounts.hf75 || 0) +
            (prev.generalHiPreedCounts.hf150 || 0) +
            (prev.generalHiPreedCounts.hf225 || 0) +
            (prev.generalHiPreedCounts.hf300 || 0)
          : 0;
      const currentVal = prev.hiPlusCounts[key] || 0;
      const nextVal = currentVal + delta;

      if (nextVal < 0) return prev;
      if (delta > 0 && currentTotal + hybridGenTotal >= MAX_FREED_ACCOUNTS) return prev;

      return {
        ...prev,
        hiPlusCounts: {
          ...prev.hiPlusCounts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleResetHiPlus = () => {
    onChange((prev) => ({
      ...prev,
      hiPlusCounts: { hi72: 0, hi90: 0, hi108: 0 },
    }));
  };

  const currentCard = AFFILIATE_CARDS.find(
    (c) => c.id === state.selectedCardId
  );
  const subPeriodInfo = getSubscriptionPeriodSummary(
    state.items,
    state.subscriptionPeriod
  );
  const representativePeriod = subPeriodInfo.representativePeriod;
  const periodLabel = subPeriodInfo.periodLabel;
  const totalBaseMonthly = subPeriodInfo.totalBaseMonthly;
  const totalPrincipal = subPeriodInfo.totalPrincipal;

  const hiSummary = calculateHiPlusSummary(
    state.hiPlusCounts,
    representativePeriod,
    Boolean(state.hideSubPreed)
  );

  const cardDiscount = liveSubSummary.cardDiscount;
  const hiPlusMonthly = liveSubSummary.hiPlusMonthly;
  const rawFinalMonthly = liveSubSummary.finalMonthlyFee;

  const hasCustomApiKey = Boolean(getStoredGeminiApiKey());

  const maxContainerCls =
    state.quoteMode === 'hybrid'
      ? 'max-w-3xl lg:max-w-6xl xl:max-w-7xl'
      : 'max-w-2xl min-[680px]:max-w-3xl';

  return (
    <div
      className={`min-h-[100dvh] w-full bg-[#F2F4F6] dark:bg-[#0B1120] flex flex-col items-center p-3 sm:p-5 ${
        embeddedSplitMode ? '' : 'pb-32 min-[440px]:pb-24 md:pb-8'
      }`}
    >
      {/* ==================== UNIFIED ENTERPRISE QUOTE STUDIO CONTROL BAR ==================== */}
      <div
        className={`@container w-full ${maxContainerCls} mb-3.5 bg-white dark:bg-[#131C2E] rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_12px_rgba(25,31,40,0.04)] dark:shadow-none p-3.5 sm:p-4 space-y-3`}
      >
        {/* Top Row: Official Eyebrow + Active Customer Pill + AI Key & CRM Save */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E8EB] dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-tight text-[#191F28] dark:text-slate-100">
              <span className="w-2 h-2 rounded-full bg-[#E60012]" />
              <span>롯데하이마트 견적 설계</span>
            </span>
            {activeCustomer && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 text-xs font-bold">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[160px]">{activeCustomer.name} 고객님</span>
                {onClearActiveCustomer && (
                  <button
                    type="button"
                    onClick={onClearActiveCustomer}
                    className="ml-0.5 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-[#F8FAFC] text-[#1B64DA] dark:text-blue-300 text-[11.5px] font-bold transition cursor-pointer"
                    title="연결된 고객 해제"
                  >
                    해제
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => {
                setApiKeyInput(getStoredGeminiApiKey());
                setIsApiKeyModalOpen(true);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                hasCustomApiKey
                  ? 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/30'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700'
              }`}
              title="Gemini AI API Key 설정"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>AI 키</span>
            </button>

            {onOpenSaveToCrm && (
              <button
                type="button"
                onClick={onOpenSaveToCrm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191F28] dark:bg-blue-600 hover:bg-[#262F3D] dark:hover:bg-blue-500 text-white text-xs font-extrabold transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>CRM 고객저장</span>
              </button>
            )}
          </div>
        </div>

        {/* Middle Row: Quote Mode & Multi-Mode Comparison Selector */}
        <QuoteModeComparisonControlBar
          state={state}
          onChange={onChange}
          onSwitchMode={onSwitchMode}
          onShowProposal={onShowProposal}
        />

        {/* Bottom Row: Dynamic Multi-Plan Switcher (1안 ~ 최대 6안) + Add / Duplicate / Confirm Actions */}
        <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-slate-800 space-y-2">
          <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-2">
            {/* 좌측: 동적 안 탭 목록 (1안 ~ N안 + 개별 삭제 ✕) */}
            <div className="flex flex-wrap items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 p-1 rounded-xl border border-[#E5E8EB] dark:border-slate-800 w-full @lg:w-auto">
              {allPlans.map((pEntry) => {
                const pNum = pEntry.planNum;
                const isAct = (state.activeGeneralPlan || 1) === pNum;
                const pGen = pEntry.genSummary;
                const pSub = pEntry.subSummary;
                return (
                  <div
                    key={pNum}
                    className={`inline-flex items-center rounded-lg transition max-w-full ${
                      isAct
                        ? 'bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-50 shadow-xs border border-[#E5E8EB] dark:border-slate-700'
                        : 'text-[#8B95A1] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-100'
                    }`}
                  >
                    <button
                      id={`quote-plan-tab-${pNum}`}
                      type="button"
                      onClick={() => handleSelectGeneralPlan(pNum)}
                      className="px-2.5 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-w-0"
                    >
                      <span>{pNum}안</span>
                      {state.quoteMode === 'general' && pGen.sum > 0 && (
                        <span className="font-mono text-[11px] text-[#E60012] dark:text-[#FF3B47] tabular-nums">
                          {Math.round(pGen.rawNet / 10000).toLocaleString()}만
                        </span>
                      )}
                      {state.quoteMode === 'subscription' &&
                        pSub.totalBaseMonthly > 0 && (
                          <span className="font-mono text-[11px] text-[#E60012] dark:text-[#FF3B47] tabular-nums">
                            월 {Math.max(0, pSub.finalMonthlyFee).toLocaleString()}원
                          </span>
                        )}
                      {state.quoteMode === 'hybrid' &&
                        (pGen.sum > 0 || pSub.totalBaseMonthly > 0) && (
                          <span className="font-mono text-[11px] text-[#E60012] dark:text-[#FF3B47] tabular-nums">
                            {Math.round(pGen.rawNet / 10000).toLocaleString()}만+월{' '}
                            {Math.max(0, pSub.finalMonthlyFee).toLocaleString()}원
                          </span>
                        )}
                    </button>

                    {allPlans.length >= 2 && (
                      <button
                        id={`quote-plan-delete-${pNum}`}
                        type="button"
                        onClick={(e) => handleDeletePlan(pNum, e)}
                        title={`${pNum}안 삭제 (남은 안은 1안부터 자동 재정렬됩니다)`}
                        aria-label={`${pNum}안 삭제`}
                        className={`mr-1 p-1 rounded-md transition cursor-pointer shrink-0 ${
                          isAct
                            ? 'text-[#8B95A1] hover:text-[#E60012] hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 dark:hover:text-rose-300'
                            : 'text-[#8B95A1]/80 hover:text-[#E60012] hover:bg-white/70 dark:hover:bg-slate-800'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 우측: [+ 새 안 추가] / [📋 현재 안 복제] / [✅ 이 안만 남기고 확정] */}
            <div className="flex flex-wrap items-center gap-1.5 w-full @lg:w-auto">
              <button
                id="quote-plan-add-btn"
                type="button"
                disabled={!canAddMorePlans}
                onClick={handleAddEmptyPlan}
                title={
                  canAddMorePlans
                    ? `빈 견적 ${allPlans.length + 1}안을 새로 추가합니다`
                    : `최대 ${MAX_QUOTE_PLANS}안까지 추가할 수 있습니다`
                }
                className="flex-1 @sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-[#DBEAFE] dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 font-extrabold text-xs transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {canAddMorePlans
                    ? `안 추가 (${allPlans.length + 1}안)`
                    : `최대 ${MAX_QUOTE_PLANS}안`}
                </span>
              </button>

              <button
                id="quote-plan-duplicate-btn"
                type="button"
                disabled={!canAddMorePlans}
                onClick={handleDuplicateCurrentPlan}
                title="현재 보고 있는 안의 품목·카드·프리드 구성을 그대로 복제한 새 비교안을 추가합니다"
                className="flex-1 @sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border border-[#E5E8EB] dark:border-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {copiedNotice
                    ? `✓ 복제 완료`
                    : `${state.activeGeneralPlan || 1}안 복제 추가`}
                </span>
              </button>

              {allPlans.length >= 2 && (
                <button
                  id="quote-plan-confirm-btn"
                  type="button"
                  onClick={handleConfirmCurrentPlan}
                  title="현재 보고 있는 안만 남기고 나머지 미선택 비교안을 모두 정리하여 단독 1안으로 확정합니다"
                  className="w-full @sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white font-extrabold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    이 안({state.activeGeneralPlan || 1}안)만 남기고 확정
                  </span>
                </button>
              )}
            </div>
          </div>

          {planActionNotice && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-300 text-[11.5px] font-extrabold break-keep">
              {planActionNotice}
            </div>
          )}
        </div>
      </div>

      {/* ==================== MAIN FORM GRID ==================== */}
      <div
        className={
          state.quoteMode === 'hybrid'
            ? `w-full ${maxContainerCls} grid grid-cols-1 ${embeddedSplitMode ? '' : 'lg:grid-cols-2'} gap-4 items-start`
            : `w-full ${maxContainerCls}`
        }
      >
        {/* ==================== GENERAL PURCHASE STUDIO CARD ==================== */}
        {showGeneral && (
          <div
            onClick={() => setLastFocusedSection('general')}
            onMouseEnter={() => setLastFocusedSection('general')}
            className="@container w-full bg-white dark:bg-[#131C2E] rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_12px_rgba(25,31,40,0.04)] dark:shadow-none p-4 sm:p-6 space-y-5"
          >
            <input
              ref={generalFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGeneralFileChange}
              className="hidden"
            />

            {/* STEP 1. 품목 명세 */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#191F28] dark:bg-slate-700 text-white whitespace-nowrap shrink-0">
                    STEP 1
                  </span>
                  <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#E60012] dark:text-[#FF3B47] shrink-0" />
                    <span>일반구매 품목 및 행사가 ({state.activeGeneralPlan}안)</span>
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => generalFileInputRef.current?.click()}
                    disabled={isParsingGeneral}
                    title="전산 캡처 이미지 AI 자동 판독 (Ctrl+V 지원)"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-[#DBEAFE] dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isParsingGeneral ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B64DA] dark:text-blue-300" />
                        <span>판독 중...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-300" />
                        <span>전산 사진 스캔</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEmptyGeneralItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#191F28] dark:bg-slate-700 hover:bg-[#262F3D] dark:hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> 품목 추가
                  </button>
                  <button
                    type="button"
                    onClick={handleResetGeneralItems}
                    title="품목 목록 초기화"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#8B95A1] dark:text-slate-400 border border-[#E5E8EB] dark:border-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> 초기화
                  </button>
                </div>
              </div>

              {parseGeneralError && (
                <p className="text-xs font-semibold text-[#E60012] dark:text-rose-300 bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 rounded-xl py-2 px-3">
                  {parseGeneralError}
                </p>
              )}

              {/* 빠른 품목 프리셋 칩 */}
              <div className="flex flex-wrap gap-1">
                {GENERAL_CATEGORY_PRESETS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleAddGeneralCategory(cat)}
                    className="px-2.5 py-1 rounded-md bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-blue-500/15 text-[#4E5968] dark:text-slate-300 hover:text-[#1B64DA] dark:hover:text-blue-300 font-bold text-[11.5px] border border-[#E5E8EB] dark:border-slate-700 hover:border-[#BFDBFE] transition cursor-pointer"
                  >
                    +{cat}
                  </button>
                ))}
              </div>

              {/* Spacious 2-Row Item Cards (Zero Clipping for 14-char Model Codes + Scroll Guard for 6+ Multi-Items) */}
              <div className="space-y-2 sm:max-h-[340px] sm:overflow-y-auto sm:pr-1">
                {state.generalItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-[#F8FAFC] dark:bg-slate-900/70 p-2.5 sm:p-3 rounded-xl border border-[#E5E8EB] dark:border-slate-800 space-y-2"
                  >
                    {/* Line 1: Index + Category + Full Model Code + Remove */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-mono font-bold text-[#8B95A1] dark:text-slate-400 w-5 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) =>
                          handleUpdateGeneralItem(item.id, {
                            category: e.target.value,
                            name: e.target.value,
                          })
                        }
                        placeholder={`품목명 ${idx + 1}`}
                        className="w-[38%] sm:w-[36%] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={item.modelName}
                        onChange={(e) =>
                          handleUpdateGeneralItem(item.id, {
                            modelName: e.target.value,
                            code: e.target.value,
                          })
                        }
                        placeholder="모델명 / 상품코드 (예: RF85DB9581APW)"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-mono font-medium text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                      />
                      {state.generalItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralItem(item.id)}
                          className="p-1.5 text-[#8B95A1] hover:text-[#E60012] rounded-lg hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 transition cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Line 2: Quantity + Comma-Formatted Unit Price */}
                    <div className="flex items-center gap-2 pl-0 min-[380px]:pl-7">
                      <div className="w-24 sm:w-28 relative shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                          수량
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.quantity || 1}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            const q = Math.max(1, Number(e.target.value) || 1);
                            handleUpdateGeneralItem(item.id, {
                              quantity: q,
                              qty: q,
                            });
                          }}
                          className="w-full pl-9 pr-5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-mono font-bold text-right text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                          개
                        </span>
                      </div>

                      <div className="flex-1 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-[#8B95A1] dark:text-slate-400">
                          행사가
                        </span>
                        <FormattedMoneyInput
                          stepAmount={10000}
                          value={item.unitPrice || ''}
                          onValueChange={(p) =>
                            handleUpdateGeneralItem(item.id, {
                              unitPrice: p,
                              price: p,
                            })
                          }
                          placeholder="0"
                          className="w-full pl-12 pr-6 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                          원
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 2. 결제카드 및 할인/캐시백 */}
            <div className="space-y-3 pt-4 border-t border-[#E5E8EB] dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30">
                    STEP 2
                  </span>
                  <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                    <span>결제카드 · 할인 · 캐시백</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddExtraBenefit}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 border border-[#E5E8EB] dark:border-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> 추가 혜택 항목
                </button>
              </div>

              <div className="grid grid-cols-2 @lg:grid-cols-5 gap-1.5">
                {AFFILIATE_GENERAL_CARD_OPTIONS.map((cardOpt) => {
                  const active = state.generalCardType === cardOpt;
                  return (
                    <button
                      key={cardOpt}
                      type="button"
                      onClick={() =>
                        onChange((prev) => ({
                          ...prev,
                          generalCardType: cardOpt,
                          autoTierCashback: true,
                        }))
                      }
                      className={`py-2 px-2 rounded-xl font-bold text-xs break-keep leading-tight border transition cursor-pointer ${
                        active
                          ? 'bg-[#191F28] dark:bg-blue-600 text-white border-[#191F28] dark:border-blue-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700'
                      }`}
                    >
                      {cardOpt}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      generalCardType: '미정',
                      autoTierCashback: true,
                    }))
                  }
                  className={`col-span-2 @lg:col-span-1 py-2 px-2 rounded-xl font-semibold text-xs break-keep leading-tight border transition cursor-pointer ${
                    !isAffiliateGeneralCardType(state.generalCardType)
                      ? 'bg-[#4E5968] text-white border-[#4E5968]'
                      : 'bg-white dark:bg-slate-800 text-[#8B95A1] dark:text-slate-400 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700'
                  }`}
                >
                  카드 미적용
                </button>
              </div>

              {/* 5 Formatted Money Inputs */}
              <div className="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 gap-2.5">
                <div className="bg-[#F8FAFC] dark:bg-slate-900/60 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 block mb-1 break-keep">
                    (-) 즉시할인 합계 (원)
                  </label>
                  <FormattedMoneyInput
                    stepAmount={10000}
                    value={state.instantDiscount || ''}
                    onValueChange={(val) =>
                      onChange((prev) => ({
                        ...prev,
                        instantDiscount: val,
                        generalItems: prev.generalItems.map((it, idx) =>
                          idx === 0 ? { ...it, discount1: val } : it
                        ),
                      }))
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                  />
                </div>

                <div className="bg-[#F8FAFC] dark:bg-slate-900/60 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 block mb-1 break-keep">
                    L.Point 적립 합계 (P)
                  </label>
                  <FormattedMoneyInput
                    stepAmount={10000}
                    value={state.earnedPoints || ''}
                    onValueChange={(val) =>
                      onChange((prev) => ({
                        ...prev,
                        earnedPoints: val,
                        generalItems: prev.generalItems.map((it, idx) =>
                          idx === 0 ? { ...it, discount2: val } : it
                        ),
                      }))
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                  />
                </div>

                <div className="bg-[#F8FAFC] dark:bg-slate-900/60 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 break-keep">
                      (-) 포인트 즉시사용
                    </label>
                    <span className="text-[11.5px] font-mono font-bold text-[#1B64DA] dark:text-blue-400">
                      잔여 {generalSummary.remainingPoints.toLocaleString()}P
                    </span>
                  </div>
                  <FormattedMoneyInput
                    stepAmount={10000}
                    value={state.pointUsed || ''}
                    onValueChange={(val) =>
                      onChange((prev) => ({
                        ...prev,
                        pointUsed: val,
                      }))
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                  />
                </div>

                <div className="col-span-1 @sm:col-span-2 bg-[#EFF6FF]/70 dark:bg-blue-500/12 p-2.5 rounded-xl border border-[#BFDBFE] dark:border-blue-500/30">
                  <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                    <span className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300 break-keep">
                      (-) 금액대별 캐시백 (원)
                    </span>
                    <span className="text-[11.5px] font-mono text-[#1B64DA] dark:text-blue-300">
                      실결제가 {generalSummary.payPrice.toLocaleString()}원 기준{' '}
                      {isAffiliateGeneralCardType(state.generalCardType)
                        ? '(자동적용)'
                        : '(카드선택 시 자동)'}
                    </span>
                  </div>
                  <FormattedMoneyInput
                    stepAmount={10000}
                    value={generalSummary.tierCashback || ''}
                    onValueChange={(val, raw) => {
                      if (raw === '') {
                        onChange((prev) => ({
                          ...prev,
                          autoTierCashback: false,
                          manualTierCashback: 0,
                        }));
                        return;
                      }
                      onChange((prev) => ({
                        ...prev,
                        autoTierCashback: false,
                        manualTierCashback: val,
                        generalItems: prev.generalItems.map((it, idx) =>
                          idx === 0 ? { ...it, cashback: val } : it
                        ),
                      }));
                    }}
                    placeholder={
                      !isAffiliateGeneralCardType(state.generalCardType)
                        ? '제휴카드 선택 시 자동 계산'
                        : '0'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#BFDBFE] dark:border-blue-500/30 sm:text-xs font-bold text-right text-[#1B64DA] dark:text-blue-300 focus:border-[#1B64DA] focus:outline-none"
                  />
                </div>

                <div className="col-span-1 @sm:col-span-2 @lg:col-span-1 bg-[#F8FAFC] dark:bg-slate-900/60 p-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 block mb-1 break-keep">
                    (-) 배송익월 추가 캐시백
                  </label>
                  <FormattedMoneyInput
                    stepAmount={10000}
                    value={state.extraCashback || ''}
                    onValueChange={(val) =>
                      onChange((prev) => ({
                        ...prev,
                        extraCashback: val,
                      }))
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#1B64DA] dark:text-blue-400 focus:border-[#1B64DA] focus:outline-none"
                  />
                </div>
              </div>

              {(state.extraBenefits || []).length > 0 && (
                <div className="space-y-2 pt-1">
                  {(state.extraBenefits || []).map((benefit) => (
                    <div
                      key={benefit.id}
                      className="grid grid-cols-12 gap-1.5 items-center bg-[#F8FAFC] dark:bg-slate-900/60 p-2 rounded-xl border border-[#E5E8EB] dark:border-slate-800"
                    >
                      <select
                        value={benefit.type}
                        onChange={(e) =>
                          handleUpdateExtraBenefit(benefit.id, {
                            type: e.target.value as GeneralExtraBenefitType,
                          })
                        }
                        className="col-span-5 sm:col-span-4 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-semibold text-[#191F28] dark:text-slate-100 focus:outline-none"
                      >
                        <option value="discount">즉시할인</option>
                        <option value="etc">기타혜택(캐시백 등)</option>
                      </select>
                      <input
                        type="text"
                        value={benefit.description}
                        onChange={(e) =>
                          handleUpdateExtraBenefit(benefit.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="항목명 (예: 다품목할인)"
                        className="col-span-6 sm:col-span-4 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none"
                      />
                      <div className="col-span-11 sm:col-span-3 order-4 sm:order-3 relative">
                        <FormattedMoneyInput
                          stepAmount={10000}
                          value={benefit.amount || ''}
                          onValueChange={(val) =>
                            handleUpdateExtraBenefit(benefit.id, {
                              amount: val,
                            })
                          }
                          placeholder="0"
                          className="w-full pl-2 pr-6 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#191F28] dark:text-slate-100 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                          원
                        </span>
                      </div>
                      <div className="col-span-1 order-3 sm:order-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraBenefit(benefit.id)}
                          className="p-1.5 text-[#8B95A1] hover:text-[#E60012] rounded-lg cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 3. 하이프리드 결합 */}
            <div className="space-y-3 pt-4 border-t border-[#E5E8EB] dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    STEP 3
                  </span>
                  <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                    <span>하이프리드 라이프케어 결합</span>
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {!state.hideHiPreed && (
                    <span className="text-[11.5px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 whitespace-nowrap">
                      {state.quoteMode === 'hybrid'
                        ? `합산 ${generalHiPreedSummary.totalAccounts + hiSummary.totalAccounts}/${MAX_FREED_ACCOUNTS}`
                        : `${generalHiPreedSummary.totalAccounts}/${MAX_FREED_ACCOUNTS}건`}{' '}
                      · -{generalHiPreedSummary.totalSupport.toLocaleString()}원
                    </span>
                  )}
                  {!state.hideHiPreed && generalHiPreedSummary.totalAccounts > 0 && (
                    <button
                      type="button"
                      onClick={handleResetGeneralHiPreed}
                      className="text-[11.5px] font-bold text-[#8B95A1] hover:text-[#E60012] px-2 py-0.5 rounded-md bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 cursor-pointer"
                    >
                      초기화
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleHideHiPreed}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-bold border transition cursor-pointer ${
                      state.hideHiPreed
                        ? 'bg-[#191F28] dark:bg-blue-600 text-white border-[#191F28] dark:border-blue-500'
                        : 'bg-white dark:bg-slate-800 hover:bg-[#F8FAFC] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700'
                    }`}
                  >
                    {state.hideHiPreed ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>숨김중 (보이기)</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>프리드 숨기기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {state.hideHiPreed ? (
                <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#4E5968] dark:text-slate-300">
                  <span>일반 하이프리드 영역이 제안서 및 고객 공유 화면에서 비노출 처리됩니다.</span>
                  <button
                    type="button"
                    onClick={handleToggleHideHiPreed}
                    className="px-2.5 py-1 rounded-lg bg-[#191F28] dark:bg-blue-600 text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
                  >
                    다시 표시
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-4 gap-2">
                  {GENERAL_HIPREED_PLANS.map((plan) => {
                    const count = state.generalHiPreedCounts[plan.id] || 0;
                    const active = count > 0;
                    const canAdd =
                      generalHiPreedSummary.totalAccounts +
                        (state.quoteMode === 'hybrid' ? hiSummary.totalAccounts : 0) <
                      MAX_FREED_ACCOUNTS;

                    return (
                      <div
                        key={plan.id}
                        className={`p-3 rounded-xl border flex flex-row @sm:flex-col items-center @sm:items-stretch justify-between gap-2 transition ${
                          active
                            ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#1B64DA] dark:border-blue-400'
                            : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800'
                        }`}
                      >
                        <div className="text-left @sm:mb-1">
                          <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 whitespace-nowrap">
                            {plan.buttonLabel}
                          </div>
                          <div className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-400 font-mono mt-0.5 whitespace-nowrap">
                            -{(plan.supportAmount / 10000).toLocaleString()}만원 즉시지원
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-[#E5E8EB] dark:border-slate-700 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAdjustGeneralHiPreed(plan.id, -1)}
                            disabled={count === 0}
                            aria-label={`${plan.buttonLabel} 감소`}
                            className="w-8 h-8 @sm:w-9 @sm:h-9 rounded-md hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono tabular-nums font-bold min-w-[2rem] text-center text-[#191F28] dark:text-slate-100">
                            {count}건
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustGeneralHiPreed(plan.id, 1)}
                            disabled={!canAdd}
                            aria-label={`${plan.buttonLabel} 추가`}
                            className="w-8 h-8 @sm:w-9 @sm:h-9 rounded-md bg-[#191F28] dark:bg-blue-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live General Summary Ledger */}
            <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-4 space-y-3">
              <div className="ledger-row text-xs text-[#4E5968] dark:text-slate-300">
                <span className="ledger-row-label font-bold">
                  일반구매 ({state.activeGeneralPlan}안) 기준 행사가 합계
                </span>
                <span className="ledger-row-value font-mono font-bold text-[#191F28] dark:text-slate-100">
                  {generalSummary.sum.toLocaleString()}원
                </span>
              </div>

              <div className="grid grid-cols-1 @md:grid-cols-2 gap-2.5">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-[#E5E8EB] dark:border-slate-700 ledger-row items-center">
                  <span className="ledger-row-label text-xs font-bold text-[#4E5968] dark:text-slate-300">
                    ① 매장 카드 실결제가
                  </span>
                  <span className="ledger-row-value text-sm font-extrabold text-[#191F28] dark:text-slate-50 font-mono">
                    {generalSummary.payPrice.toLocaleString()}원
                  </span>
                </div>
                <div className="bg-[#FFF1F2] dark:bg-rose-500/15 rounded-xl p-3 border border-[#FECDD3] dark:border-rose-500/30 ledger-row items-center">
                  <span className="ledger-row-label text-xs font-extrabold text-[#E60012] dark:text-[#FF3B47]">
                    ③ 최종 혜택 체감가
                  </span>
                  <span className="ledger-row-value text-base font-extrabold text-[#E60012] dark:text-[#FF3B47] font-mono">
                    {generalSummary.rawNet.toLocaleString()}원
                  </span>
                </div>
              </div>

              {bothPlansHavePrice && (
                <div className="pt-2 border-t border-[#E5E8EB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-mono text-[#4E5968] dark:text-slate-300 break-keep">
                    {validGenPlans
                      .map(
                        (p) =>
                          `${p.planNum}안 ${p.genSummary.rawNet.toLocaleString()}원`
                      )
                      .join(' vs ')}
                  </span>
                  <span className="font-mono font-extrabold text-[#1B64DA] dark:text-blue-400 whitespace-nowrap ml-auto">
                    {validGenPlans.length === 2 ? '차액 ' : '최대차액 '}
                    {(() => {
                      const nets = validGenPlans.map((p) => p.genSummary.rawNet);
                      const maxDiff = Math.max(...nets) - Math.min(...nets);
                      return validGenPlans.length === 2
                        ? planNetDiff > 0
                          ? `+${planNetDiff.toLocaleString()}원`
                          : `${planNetDiff.toLocaleString()}원`
                        : `${maxDiff.toLocaleString()}원`;
                    })()}
                  </span>
                </div>
              )}
            </div>

            {state.quoteMode === 'general' && (
              <button
                type="button"
                onClick={onShowProposal}
                className="w-full min-h-[42px] py-3.5 px-6 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer schedule-tactile shadow-[0_4px_14px_rgba(230,0,18,0.2)]"
              >
                <Check className="w-4 h-4" />
                <span>스토리 제안서 완성 · 고객 공유하기 →</span>
              </button>
            )}
          </div>
        )}

        <ControlPanelSubscriptionSection
          bothSubPlansHavePrice={bothSubPlansHavePrice}
          cardDiscount={cardDiscount}
          currentCard={currentCard}
          fileInputRef={fileInputRef}
          generalHiPreedSummary={generalHiPreedSummary}
          handleAddSubItem={handleAddSubItem}
          handleAdjustHiPlus={handleAdjustHiPlus}
          handleCardSelect={handleCardSelect}
          handleFileChange={handleFileChange}
          handleRemoveSubItem={handleRemoveSubItem}
          handleResetHiPlus={handleResetHiPlus}
          handleResetSubItems={handleResetSubItems}
          handleUpdateSubItem={handleUpdateSubItem}
          hiPlusMonthly={hiPlusMonthly}
          hiSummary={hiSummary}
          isParsing={isParsing}
          liveSubSummary={liveSubSummary}
          onChange={onChange}
          onShowProposal={onShowProposal}
          parseError={parseError}
          periodLabel={periodLabel}
          plan1SubSummary={plan1SubSummary}
          plan2SubSummary={plan2SubSummary}
          rawFinalMonthly={rawFinalMonthly}
          representativePeriod={representativePeriod}
          setLastFocusedSection={setLastFocusedSection}
          showSubscription={showSubscription}
          state={state}
          subNetDiff={subNetDiff}
          subScanNotice={subScanNotice}
          subTotalNetDiff={subTotalNetDiff}
          totalBaseMonthly={totalBaseMonthly}
          totalPrincipal={totalPrincipal}
          validSubPlans={validSubPlans}
        />
      </div>

      {/* Hybrid Mode Combined CTA */}
      {state.quoteMode === 'hybrid' && (
        <div className={`w-full ${maxContainerCls} mt-4`}>
          <button
            type="button"
            onClick={onShowProposal}
            className="w-full min-h-[42px] py-4 px-6 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer schedule-tactile shadow-[0_4px_14px_rgba(230,0,18,0.2)]"
          >
            <Check className="w-4 h-4" />
            <span>일반 + 구독 혼합 제안서 완성 · 공유하기 →</span>
          </button>
        </div>
      )}

      {/* AI Key Modal */}
      <FlagshipModalShell
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        title="Gemini AI 키 설정"
        subtitle="전산 캡처 자동 판독 및 POP 출력기 공통 적용"
        icon={<KeyRound className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        bodyClassName="p-5 space-y-4"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setApiKeyInput('');
                setStoredGeminiApiKey('');
              }}
              className="px-3.5 py-2 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#E5E8EB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="px-4 py-2 rounded-xl bg-[#191F28] dark:bg-blue-600 text-white text-xs font-extrabold cursor-pointer"
            >
              저장하기
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#191F28] dark:text-slate-100">
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="AIzaSy... (미입력 시 기본 환경변수 키 사용)"
            className="w-full px-3 py-2.5 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs font-mono font-semibold text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
          />
          <p className="text-[11.5px] text-[#8B95A1] dark:text-slate-400 leading-relaxed">
            입력한 키는 현재 브라우저(<code>gemini_api_key</code>)에만 안전하게 저장됩니다.
          </p>
        </div>

        {apiKeySavedToast && (
          <div className="p-2.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 text-xs font-bold text-center">
            ✓ AI 키가 저장되었습니다.
          </div>
        )}
      </FlagshipModalShell>

      {/* Mobile Sticky Summary & Primary CTA Dock */}
      {!embeddedSplitMode && (
        <div className="safe-bottom-dock fixed bottom-0 inset-x-0 z-30 bg-white/96 dark:bg-[#131C2E]/96 backdrop-blur-md border-t border-[#E5E8EB] dark:border-white/10 px-3.5 pt-2.5 shadow-xl min-[680px]:hidden no-print">
          <div className="max-w-xl mx-auto flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 truncate">
                {state.quoteMode === 'subscription'
                  ? liveSubSummary.totalSubCashback > 0
                    ? `구독 (${liveSubSummary.periodLabel}) · 최종 체감 ${liveSubSummary.finalTotalFee.toLocaleString()}원`
                    : `구독 (${liveSubSummary.periodLabel}) 월 체감가`
                  : state.quoteMode === 'hybrid'
                  ? `일반 체감 + 월 구독료 (통합 체감 ${(liveGenSummary.rawNet + liveSubSummary.finalTotalFee).toLocaleString()}원)`
                  : `최종 혜택 체감가 (총 -${liveGenSummary.totalDiscountAndBenefit.toLocaleString()}원)`}
              </div>
              <div className="text-[15px] sm:text-base font-extrabold text-[#E60012] dark:text-[#FF3B47] font-mono tabular-nums whitespace-nowrap">
                {state.quoteMode === 'subscription' ? (() => {
                  const dockSurplus = getSubscriptionSurplusMeta(
                    liveSubSummary.finalMonthlyFee,
                    state.hiPlusPayoutMethod
                  );
                  return dockSurplus.isSurplusZone ? (
                    <>
                      월 0원{' '}
                      {dockSurplus.monthlySurplus > 0 && (
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          ({dockSurplus.isCardBill ? `청구대금 -${dockSurplus.monthlySurplus.toLocaleString()}원` : `+${dockSurplus.monthlySurplus.toLocaleString()}원 입금`})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      월 <SpringNumberFlow value={liveSubSummary.finalMonthlyFee} suffix="원" />
                    </>
                  );
                })() : state.quoteMode === 'hybrid' ? (
                  liveSubSummary.finalMonthlyFee <= 0 ? (
                    <>
                      <SpringNumberFlow value={liveGenSummary.rawNet} suffix="원" /> + 월 0원{' '}
                      {liveSubSummary.finalMonthlyFee < 0 && (
                        <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          (+{Math.abs(liveSubSummary.finalMonthlyFee).toLocaleString()}원 혜택)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <SpringNumberFlow value={liveGenSummary.rawNet} suffix="원" /> + 월{' '}
                      <SpringNumberFlow value={liveSubSummary.finalMonthlyFee} suffix="원" />
                    </>
                  )
                ) : (
                  <SpringNumberFlow value={liveGenSummary.rawNet} suffix="원" />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onShowProposal}
              className="min-h-[42px] px-4 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold cursor-pointer schedule-tactile whitespace-nowrap flex items-center justify-center shrink-0 shadow-xs"
            >
              제안서 완성 · 공유 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
