import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderKanban,
  PhoneCall,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';
import {
  GeneralPlanData,
  ProposalState,
  QuoteMode,
  ResolvedPlanSummaryEntry,
  calculateGeneralHiPreedSummary,
  getGeneralPlan1And2Summaries,
  syncActivePlanIntoGeneralPlans,
} from '../../types/proposal';
import {
  CustomerFreedCounts,
  CustomerItem,
  CustomerSaleType,
  CustomerStatus,
  MAX_QUOTES_PER_CUSTOMER,
  PurchasedModelEntry,
  QuotePlan2Summary,
} from '../types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getFridayDateStr,
  getOffsetDateStr,
  getTodayStr,
} from '../utils/date';
import {
  calculateFreedIncentiveDetail,
  extractPerformanceFromProposalState,
} from '../utils/settlementEngine';
import {
  getCachedCustomers,
  normalizeOrderNoKey,
  saveCustomerQuote,
} from '../services/gasApi';

interface SaveToCrmModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProposalState;
  activeCustomer: {
    id: string;
    name: string;
    phone?: string;
    activeQuoteId?: string;
  } | null;
  onSavedSuccess: (customer: {
    id: string;
    name: string;
    phone?: string;
    activeQuoteId?: string;
  }) => void;
}

function getValidGeneralItemNames(planData: GeneralPlanData): string[] {
  return (planData.generalItems || [])
    .map((it) => {
      const cat = (it.category || '').trim();
      const mod = (it.modelName || '').trim();
      if (!cat && !mod) return '';
      return mod ? `${cat || '가전'}(${mod})` : cat;
    })
    .filter(Boolean);
}

function buildPlanComparisonSummaryEntry(
  planEntry: ResolvedPlanSummaryEntry,
  displayPlanNum: number,
  mode: QuoteMode
): QuotePlan2Summary {
  const genNames = getValidGeneralItemNames(planEntry.data);
  const gSum = planEntry.genSummary;
  const sSum = planEntry.subSummary;

  if (mode === 'subscription') {
    const subNames =
      sSum.validSubNames.length > 0
        ? `[${sSum.periodLabel} 구독] ${sSum.validSubNames.join(', ')}`
        : `[${sSum.periodLabel} 구독] 맞춤 구독 ${displayPlanNum}안`;
    const subBenefits: string[] = [];
    if (sSum.cardDiscount > 0 && sSum.currentCard) {
      subBenefits.push(
        `${sSum.currentCard.name} 월 -${formatCurrency(sSum.cardDiscount)}원`
      );
    }
    if (sSum.hiPlusMonthly > 0) {
      subBenefits.push(
        `구독프리드(${sSum.hiSummary.totalAccounts}구좌) 월 -${formatCurrency(
          sSum.hiPlusMonthly
        )}원`
      );
    }
    if (sSum.subTierCashback > 0) {
      subBenefits.push(
        `${sSum.currentCard?.shortName || '제휴카드'} 금액대캐시백 -${formatCurrency(
          sSum.subTierCashback
        )}원`
      );
    }
    if (sSum.subExtraCashback > 0) {
      subBenefits.push(
        `1회 추가캐시백 -${formatCurrency(sSum.subExtraCashback)}원`
      );
    }
    if (sSum.totalSubCashback > 0) {
      subBenefits.push(
        `최종 ${sSum.periodLabel} 체감가 ${formatCurrency(sSum.finalTotalFee)}원`
      );
    }
    return {
      itemSummary: subNames,
      paidAmount: sSum.totalBaseMonthly,
      netAmount: sSum.finalMonthlyFee,
      performanceAmount: sSum.totalPrincipal,
      benefit:
        subBenefits.join(' + ') ||
        `${sSum.periodLabel} 총 체감가 ${formatCurrency(
          sSum.finalTotalFee
        )}원 (원금 ${formatCurrency(sSum.totalPrincipal)}원)`,
    };
  }

  if (mode === 'hybrid') {
    const genLabel = genNames.length > 0 ? genNames.join(', ') : '일반가전';
    const subLabel =
      sSum.validSubNames.length > 0
        ? sSum.validSubNames.join(', ')
        : `구독가전(${sSum.periodLabel})`;
    return {
      itemSummary: `일반 ${displayPlanNum}안(${genLabel}) + 구독 ${displayPlanNum}안(${subLabel})`,
      paidAmount: gSum.sum > 0 ? gSum.payPrice : sSum.totalBaseMonthly,
      netAmount: gSum.sum > 0 ? gSum.rawNet : sSum.finalMonthlyFee,
      performanceAmount: gSum.sum + sSum.totalPrincipal,
      benefit: `일반 ${displayPlanNum}안 실결제 ${formatCurrency(
        gSum.payPrice
      )}원(체감 ${formatCurrency(gSum.rawNet)}원) + 구독(${
        sSum.periodLabel
      }) 월 기본 ${formatCurrency(
        sSum.totalBaseMonthly
      )}원(월 체감 ${formatCurrency(
        sSum.finalMonthlyFee
      )}원 / 총 체감 ${formatCurrency(
        sSum.finalTotalFee
      )}원 · 원금 ${formatCurrency(sSum.totalPrincipal)}원)`,
    };
  }

  const pNames =
    genNames.length > 0 ? genNames.join(', ') : `일반가전 ${displayPlanNum}안`;
  const benefitParts: string[] = [];
  if (gSum.totalStep1InstantDiscount > 0) {
    benefitParts.push(
      `즉시할인 ${formatCurrency(gSum.totalStep1InstantDiscount)}원`
    );
  }
  if (gSum.hiFreedSupport > 0) {
    benefitParts.push(`하이프리드 ${formatCurrency(gSum.hiFreedSupport)}원`);
  }
  if (gSum.totalStep2Cashback > 0) {
    benefitParts.push(`캐시백 ${formatCurrency(gSum.totalStep2Cashback)}원`);
  }
  if (gSum.totalStep2ExtraBenefit > 0) {
    benefitParts.push(
      `추가혜택 ${formatCurrency(gSum.totalStep2ExtraBenefit)}원`
    );
  }
  return {
    itemSummary: pNames,
    paidAmount: gSum.payPrice,
    netAmount: gSum.rawNet,
    performanceAmount: gSum.sum,
    benefit:
      benefitParts.join(' + ') ||
      (gSum.totalDiscountAndBenefit > 0
        ? `총 혜택 ${formatCurrency(gSum.totalDiscountAndBenefit)}원`
        : undefined),
  };
}

export function extractQuotePayloadFromProposalState(state: ProposalState): {
  itemsSummary: string;
  paidAmount: number;
  netAmount: number;
  expectedBenefit: string;
  defaultQuoteTitle: string;
  saleType: CustomerSaleType;
  performanceAmount: number;
  generalProductTotal: number;
  subscriptionPrincipal: number;
  freedCounts: CustomerFreedCounts;
  purchasedModels: PurchasedModelEntry[];
  plan2Summary?: QuotePlan2Summary;
  planSummaries?: QuotePlan2Summary[];
  plan1Data: GeneralPlanData;
  plan2Data: GeneralPlanData;
  primaryGenSummary: ReturnType<typeof getGeneralPlan1And2Summaries>['plan1Summary'];
  primarySubSummary: ReturnType<typeof getGeneralPlan1And2Summaries>['plan1SubSummary'];
  secondaryGenSummary: ReturnType<typeof getGeneralPlan1And2Summaries>['plan2Summary'];
  secondarySubSummary: ReturnType<typeof getGeneralPlan1And2Summaries>['plan2SubSummary'];
} {
  const {
    plan1Data,
    plan2Data,
    plan1Summary,
    plan2Summary: plan2GenSummary,
    plan1SubSummary,
    plan2SubSummary,
    allPlans,
  } = getGeneralPlan1And2Summaries(state);

  const validPlans = allPlans.filter((p) => p.hasData);
  const primaryEntry = validPlans[0] || allPlans[0];
  const primaryData = primaryEntry ? primaryEntry.data : plan1Data;
  const primaryGenSummary = primaryEntry
    ? primaryEntry.genSummary
    : plan1Summary;
  const primarySubSummary = primaryEntry
    ? primaryEntry.subSummary
    : plan1SubSummary;

  const extraPlanEntries = validPlans.length >= 2 ? validPlans.slice(1) : [];
  const builtPlanSummaries: QuotePlan2Summary[] | undefined =
    extraPlanEntries.length > 0
      ? extraPlanEntries.map((entry, idx) =>
          buildPlanComparisonSummaryEntry(entry, idx + 2, state.quoteMode)
        )
      : undefined;
  const plan2Summary: QuotePlan2Summary | undefined = builtPlanSummaries?.[0];

  const perfInfo = extractPerformanceFromProposalState(state);
  const saleType: CustomerSaleType = perfInfo?.saleType || state.quoteMode;
  const generalProductTotal =
    perfInfo?.generalProductTotal ?? primaryGenSummary.sum;
  const subscriptionPrincipal =
    perfInfo?.subscriptionPrincipal ?? primarySubSummary.totalPrincipal;
  const performanceAmount =
    perfInfo?.performanceAmount ??
    (state.quoteMode === 'subscription'
      ? primarySubSummary.totalPrincipal
      : state.quoteMode === 'hybrid'
      ? primaryGenSummary.sum + primarySubSummary.totalPrincipal
      : primaryGenSummary.sum);
  const freedCounts = perfInfo?.freedCounts || {
    hi72: 0,
    hi90: 0,
    hi108: 0,
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  };
  const purchasedModels = perfInfo?.purchasedModels || [];

  const primaryGenNames = getValidGeneralItemNames(primaryData);

  if (state.quoteMode === 'general') {
    const itemsSummary =
      primaryGenNames.length > 0
        ? primaryGenNames.join(', ')
        : '일반구매 맞춤 가전 패키지';

    const generalHiPreed = calculateGeneralHiPreedSummary(
      primaryData.generalHiPreedCounts
    );
    const benefitParts: string[] = [];
    if (primaryGenSummary.totalStep1InstantDiscount > 0) {
      benefitParts.push(
        `즉시할인 ${formatCurrency(primaryGenSummary.totalStep1InstantDiscount)}원`
      );
    }
    if (primaryGenSummary.hiFreedSupport > 0) {
      benefitParts.push(
        `하이프리드(${generalHiPreed.comboLabel || `${generalHiPreed.totalAccounts}구좌`}) ${formatCurrency(
          primaryGenSummary.hiFreedSupport
        )}원`
      );
    }
    if (primaryGenSummary.totalStep2Cashback > 0) {
      benefitParts.push(
        `캐시백 ${formatCurrency(primaryGenSummary.totalStep2Cashback)}원`
      );
    }
    if (primaryGenSummary.totalStep2ExtraBenefit > 0) {
      benefitParts.push(
        `추가혜택 ${formatCurrency(primaryGenSummary.totalStep2ExtraBenefit)}원`
      );
    }

    return {
      itemsSummary,
      paidAmount: primaryGenSummary.payPrice,
      netAmount: primaryGenSummary.rawNet,
      expectedBenefit:
        benefitParts.join(' + ') ||
        `총 할인/혜택 ${formatCurrency(
          primaryGenSummary.totalDiscountAndBenefit
        )}원`,
      defaultQuoteTitle: `[일반구매] ${itemsSummary.slice(0, 22)}`,
      saleType,
      performanceAmount,
      generalProductTotal,
      subscriptionPrincipal,
      freedCounts,
      purchasedModels,
      plan2Summary,
      planSummaries: builtPlanSummaries,
      plan1Data,
      plan2Data,
      primaryGenSummary,
      primarySubSummary,
      secondaryGenSummary: plan2GenSummary,
      secondarySubSummary: plan2SubSummary,
    };
  }

  if (state.quoteMode === 'subscription') {
    const itemsSummary =
      primarySubSummary.validSubNames.length > 0
        ? `[${primarySubSummary.periodLabel} 구독] ${primarySubSummary.validSubNames.join(', ')}`
        : `[${primarySubSummary.periodLabel} 구독] 맞춤 구독 패키지`;

    const benefitParts: string[] = [];
    if (primarySubSummary.cardDiscount > 0 && primarySubSummary.currentCard) {
      benefitParts.push(
        `${primarySubSummary.currentCard.name} 월 -${formatCurrency(
          primarySubSummary.cardDiscount
        )}원`
      );
    }
    if (primarySubSummary.hiPlusMonthly > 0) {
      benefitParts.push(
        `구독프리드(${primarySubSummary.hiSummary.totalAccounts}구좌) 월 -${formatCurrency(
          primarySubSummary.hiPlusMonthly
        )}원`
      );
    }
    if (primarySubSummary.subTierCashback > 0) {
      benefitParts.push(
        `${primarySubSummary.currentCard?.shortName || '제휴카드'} 금액대캐시백 -${formatCurrency(
          primarySubSummary.subTierCashback
        )}원`
      );
    }
    if (primarySubSummary.subExtraCashback > 0) {
      benefitParts.push(
        `1회 추가캐시백 -${formatCurrency(primarySubSummary.subExtraCashback)}원`
      );
    }
    if (primarySubSummary.totalSubCashback > 0) {
      benefitParts.push(
        `최종 ${primarySubSummary.periodLabel} 체감가 ${formatCurrency(
          primarySubSummary.finalTotalFee
        )}원`
      );
    }

    return {
      itemsSummary,
      paidAmount: primarySubSummary.totalBaseMonthly,
      netAmount: primarySubSummary.finalMonthlyFee,
      expectedBenefit:
        benefitParts.join(' + ') || '전 품목 5년 무상 A/S 및 방문케어',
      defaultQuoteTitle: `[구독 ${primarySubSummary.periodLabel}] ${
        primarySubSummary.validSubNames.join(', ').slice(0, 18) || '맞춤 구독'
      }`,
      saleType,
      performanceAmount,
      generalProductTotal,
      subscriptionPrincipal,
      freedCounts,
      purchasedModels,
      plan2Summary,
      planSummaries: builtPlanSummaries,
      plan1Data,
      plan2Data,
      primaryGenSummary,
      primarySubSummary,
      secondaryGenSummary: plan2GenSummary,
      secondarySubSummary: plan2SubSummary,
    };
  }

  // hybrid 모드 (일반 + 구독 혼합견적)
  const p1GenLabel =
    primaryGenNames.length > 0 ? primaryGenNames.join(', ') : '일반가전';
  const p1SubLabel =
    primarySubSummary.validSubNames.length > 0
      ? primarySubSummary.validSubNames.join(', ')
      : `구독가전(${primarySubSummary.periodLabel})`;
  const itemsSummary = `일반 1안(${p1GenLabel}) + 구독 1안(${p1SubLabel})`;

  const primaryPaidAmount =
    primaryGenSummary.sum > 0
      ? primaryGenSummary.payPrice
      : primarySubSummary.totalBaseMonthly;
  const primaryNetAmount =
    primaryGenSummary.sum > 0
      ? primaryGenSummary.rawNet
      : primarySubSummary.finalMonthlyFee;

  const expectedBenefit = `일반 1안 실결제 ${formatCurrency(
    primaryGenSummary.payPrice
  )}원(체감 ${formatCurrency(primaryGenSummary.rawNet)}원) + 구독(${
    primarySubSummary.periodLabel
  }) 월 기본 ${formatCurrency(
    primarySubSummary.totalBaseMonthly
  )}원(월 체감 ${formatCurrency(
    primarySubSummary.finalMonthlyFee
  )}원 / 최종 체감 ${formatCurrency(
    primarySubSummary.finalTotalFee
  )}원${
    primarySubSummary.totalSubCashback > 0
      ? ` · 1회 캐시백 -${formatCurrency(primarySubSummary.totalSubCashback)}원 반영`
      : ''
  } · 통합 최종 체감가 ${formatCurrency(
    primaryGenSummary.rawNet + primarySubSummary.finalTotalFee
  )}원)`;

  return {
    itemsSummary,
    paidAmount: primaryPaidAmount,
    netAmount: primaryNetAmount,
    expectedBenefit,
    defaultQuoteTitle: `[혼합견적] ${itemsSummary.slice(0, 22)}`,
    saleType,
    performanceAmount,
    generalProductTotal,
    subscriptionPrincipal,
    freedCounts,
    purchasedModels,
    plan2Summary,
    planSummaries: builtPlanSummaries,
    plan1Data,
    plan2Data,
    primaryGenSummary,
    primarySubSummary,
    secondaryGenSummary: plan2GenSummary,
    secondarySubSummary: plan2SubSummary,
  };
}

export const SaveToCrmModal: React.FC<SaveToCrmModalProps> = ({
  isOpen,
  onClose,
  state,
  activeCustomer,
  onSavedSuccess,
}) => {
  const [tabMode, setTabMode] = useState<'new' | 'existing'>('new');
  const [existingCustomers, setExistingCustomers] = useState<CustomerItem[]>(
    []
  );
  const [selectedExistingId, setSelectedExistingId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('상담진행중');
  const [contractDate, setContractDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [giftItems, setGiftItems] = useState('');
  const [memo, setMemo] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [saveMode, setSaveMode] = useState<'overwrite' | 'append'>('overwrite');
  const [overwriteQuoteId, setOverwriteQuoteId] = useState<string>('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const extracted = useMemo(
    () => extractQuotePayloadFromProposalState(state),
    [state]
  );

  const freedIncentivePreview = useMemo(
    () => calculateFreedIncentiveDetail(extracted.freedCounts),
    [extracted.freedCounts]
  );

  const applyCustomerToForm = (c: CustomerItem, loadedQuoteId?: string) => {
    const today = getTodayStr();
    const quotes = Array.isArray(c.quotes) ? c.quotes : [];
    const hasConfirmedSlip = quotes.some((q) => Boolean(q?.isConfirmedSlip));
    const isPurchasedStatus =
      c.status === '계약완료' || c.status === '배송완료';
    const loadedDraft = loadedQuoteId
      ? quotes.find((q) => q.id === loadedQuoteId && !q.isConfirmedSlip)
      : undefined;
    const firstDraft = quotes.find((q) => !q.isConfirmedSlip);

    setSelectedExistingId(c.id);
    setName(c.name);
    setPhone(c.phone || '');
    setStatus(c.status || '상담진행중');
    setDeliveryDate(c.deliveryDate || '');
    setFollowUpDate(c.followUpDate || '');
    setGiftItems(c.giftItems || '');
    setMemo('');

    if (loadedDraft) {
      setSaveMode('overwrite');
      setOverwriteQuoteId(loadedDraft.id);
      setOrderNo(loadedDraft.orderNo || '');
      setContractDate(
        c.contractDate || c.regDate?.slice(0, 10) || today
      );
      return;
    }

    if (hasConfirmedSlip || isPurchasedStatus) {
      // 배송 전 재방문 추가 구매 보호: 기본 저장 방식을 무조건 'append'로 세팅하고 이전 전표번호를 비워 덮어쓰기 원천 차단
      setSaveMode('append');
      setOverwriteQuoteId(firstDraft?.id || '');
      setOrderNo('');
      setContractDate(today);
      return;
    }

    setSaveMode(quotes.length > 0 ? 'overwrite' : 'append');
    setOverwriteQuoteId(firstDraft?.id || quotes[0]?.id || '');
    setOrderNo(c.orderNo || '');
    setContractDate(c.contractDate || c.regDate?.slice(0, 10) || today);
  };

  useEffect(() => {
    if (!isOpen) return;
    const cached = getCachedCustomers().filter((c) => !c.deletedAt);
    setExistingCustomers(cached);
    setQuoteTitle(extracted.defaultQuoteTitle);
    setSavedToast(null);
    const today = getTodayStr();

    if (activeCustomer) {
      const found = cached.find((c) => c.id === activeCustomer.id);
      if (found) {
        setTabMode('existing');
        applyCustomerToForm(found, activeCustomer.activeQuoteId);
        return;
      }
    }

    setTabMode('new');
    setSelectedExistingId('');
    setSaveMode('overwrite');
    setOverwriteQuoteId('');
    setName('');
    setPhone('');
    setStatus('상담진행중');
    setContractDate(today);
    setDeliveryDate('');
    setFollowUpDate('');
    setOrderNo('');
    setGiftItems('');
    setMemo('');
  }, [isOpen, activeCustomer, extracted.defaultQuoteTitle]);

  if (!isOpen) return null;

  const handleSelectExistingCustomer = (c: CustomerItem) => {
    applyCustomerToForm(c);
  };

  const matchedExistingCustomer = (() => {
    if (tabMode === 'existing' && selectedExistingId) {
      return existingCustomers.find((c) => c.id === selectedExistingId) || null;
    }
    const targetName = name.trim().toLowerCase();
    const targetPhone = phone.replace(/\D/g, '');
    if (!targetName) return null;
    return (
      existingCustomers.find((c) => {
        const cName = (c.name || '').trim().toLowerCase();
        const cPhone = (c.phone || '').replace(/\D/g, '');
        if (targetName && targetPhone) {
          return cName === targetName && cPhone === targetPhone;
        }
        return cName === targetName && cPhone === '';
      }) || null
    );
  })();

  const existingQuotesForTarget = matchedExistingCustomer?.quotes || [];
  const confirmedSlipsForTarget = existingQuotesForTarget.filter((q) =>
    Boolean(q?.isConfirmedSlip)
  );
  const draftQuotesForTarget = existingQuotesForTarget.filter(
    (q) => !q?.isConfirmedSlip
  );
  const targetIsPurchasedOrHasSlip =
    confirmedSlipsForTarget.length > 0 ||
    matchedExistingCustomer?.status === '계약완료' ||
    matchedExistingCustomer?.status === '배송완료';

  const existingOrderNosForTarget = Array.from(
    new Set(
      [
        ...confirmedSlipsForTarget.map((q) => (q.orderNo || '').trim()),
        (matchedExistingCustomer?.orderNo || '').trim(),
      ].filter(Boolean)
    )
  );

  const handleOrderNoChange = (nextVal: string) => {
    setOrderNo(nextVal);
    const trimmedKey = normalizeOrderNoKey(nextVal);
    if (trimmedKey && matchedExistingCustomer) {
      const matchesOverwriteTarget =
        overwriteQuoteId &&
        existingQuotesForTarget.some(
          (q) =>
            q.id === overwriteQuoteId &&
            normalizeOrderNoKey(q.orderNo) === trimmedKey
        );
      if (!matchesOverwriteTarget) {
        setSaveMode('append');
      }
    }
  };

  const filteredExisting = existingCustomers.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const qCompact = q.replace(/[-\s]/g, '');
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.phone.replace(/\D/g, '').includes(qCompact) ||
      c.items.toLowerCase().includes(q) ||
      Boolean(c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
      (c.quotes || []).some((qt) =>
        Boolean(qt.orderNo && qt.orderNo.toLowerCase().includes(q))
      )
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const syncedProposalState: ProposalState = syncActivePlanIntoGeneralPlans({
      ...state,
      generalPlan1: extracted.plan1Data,
      generalPlan2: extracted.plan2Data,
    });

    const effectiveTargetId =
      tabMode === 'existing' && selectedExistingId
        ? selectedExistingId
        : matchedExistingCustomer?.id;

    const cleanOrderNo = orderNo.trim();
    const incomingOrderKey = normalizeOrderNoKey(cleanOrderNo);
    const isNewDistinctOrderNo =
      Boolean(incomingOrderKey) &&
      existingOrderNosForTarget.length > 0 &&
      !existingOrderNosForTarget.some(
        (no) => normalizeOrderNoKey(no) === incomingOrderKey
      );

    // 확정 전표만 있고 미확정 상담견적이 없거나, 새 전표번호가 입력된 경우 무조건 append 강제
    const canOverwriteDraft =
      existingQuotesForTarget.length > 0 &&
      draftQuotesForTarget.length > 0 &&
      !isNewDistinctOrderNo;
    const effectiveSaveMode: 'overwrite' | 'append' =
      saveMode === 'overwrite' && canOverwriteDraft ? 'overwrite' : 'append';

    const effectiveOverwriteId =
      effectiveSaveMode === 'overwrite'
        ? draftQuotesForTarget.some((q) => q.id === overwriteQuoteId)
          ? overwriteQuoteId
          : draftQuotesForTarget[0]?.id
        : undefined;

    const isConfirmedSlipSave =
      status === '계약완료' ||
      status === '배송완료' ||
      Boolean(cleanOrderNo);

    const result = await saveCustomerQuote({
      targetCustomerId: effectiveTargetId,
      name: name.trim(),
      phone: phone.trim(),
      items: extracted.itemsSummary,
      paidAmount: extracted.paidAmount,
      netAmount: extracted.netAmount,
      expectedBenefit: extracted.expectedBenefit,
      contractDate: contractDate.trim() || getTodayStr(),
      deliveryDate: deliveryDate.trim(),
      followUpDate: followUpDate.trim(),
      status,
      memo: memo.trim(),
      orderNo: cleanOrderNo,
      giftItems: giftItems.trim(),
      quoteTitle: quoteTitle.trim() || extracted.defaultQuoteTitle,
      proposalState: syncedProposalState,
      quoteMode: state.quoteMode,
      saleType: extracted.saleType,
      performanceAmount: extracted.performanceAmount,
      generalProductTotal: extracted.generalProductTotal,
      subscriptionPrincipal: extracted.subscriptionPrincipal,
      freedCounts: extracted.freedCounts,
      purchasedModels: extracted.purchasedModels,
      plan2Summary: extracted.plan2Summary,
      planSummaries: extracted.planSummaries,
      saveMode: effectiveSaveMode,
      overwriteQuoteId: effectiveOverwriteId,
      isConfirmedSlip: isConfirmedSlipSave,
      slipDeliveryStatus:
        status === '배송완료' ? '배송완료' : '배송대기',
    });

    onSavedSuccess({
      id: result.savedCustomer.id,
      name: result.savedCustomer.name,
      phone: result.savedCustomer.phone,
      activeQuoteId: result.savedQuoteId,
    });

    setSavedToast(
      result.wasOverwritten
        ? `🔄 [${result.savedCustomer.name}] 고객님의 기존 항목을 수정 업데이트했습니다! (보관함 ${result.quoteCount}/${MAX_QUOTES_PER_CUSTOMER})`
        : result.isExistingCustomer
        ? isConfirmedSlipSave
          ? `🧾 [${result.savedCustomer.name}] 고객님께 추가 구매 전표가 별도 추가되고 통합 실적이 자동 합산되었습니다! (${result.quoteCount}/${MAX_QUOTES_PER_CUSTOMER})`
          : `✅ [${result.savedCustomer.name}] 고객님의 견적 보관함(${result.quoteCount}/${MAX_QUOTES_PER_CUSTOMER})에 새 견적으로 추가 저장되었습니다!`
        : `✅ 신규 고객 [${result.savedCustomer.name}]님으로 등록 및 저장되었습니다!`
    );

    setTimeout(() => {
      onClose();
    }, 900);
  };

  const extraSummaries = extracted.planSummaries || [];

  return (
    <FlagshipModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="CRM 고객 저장 & 총판·실판·수당 자동 연동"
      subtitle="계약완료/전표번호 입력 시 확정 전표로 기록되며 다중 전표 통합 실적·배송상태에 자동 반영됩니다"
      icon={<Save className="w-4 h-4 text-[#E60012] dark:text-rose-400" />}
      maxWidthClass="max-w-xl"
      bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {/* 상단 탭: 신규 등록 vs 기존 고객 선택 */}
      <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900/70 border-b border-[#E5E8EB] dark:border-slate-800 grid grid-cols-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setTabMode('new');
            setSelectedExistingId('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
            tabMode === 'new'
              ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-xs'
              : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white border border-[#E5E8EB] dark:border-slate-700'
          }`}
        >
          <UserPlus className="w-4 h-4" />➕ 신규 고객으로 등록 및 저장
        </button>
        <button
          type="button"
          onClick={() => setTabMode('existing')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
            tabMode === 'existing'
              ? 'bg-[#1B64DA] text-white shadow-xs'
              : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white border border-[#E5E8EB] dark:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />👥 기존 CRM 고객 선택 · 추가구매 (
          <span className="font-mono tabular-nums">{existingCustomers.length}</span>명)
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 현재 견적 자동 요약 카드 + 총판/실판 실적기준 금액 미리보기 */}
          <div className="bg-[#F8FAFC] dark:bg-slate-900/70 rounded-2xl p-3.5 border border-[#E5E8EB] dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#191F28] text-white dark:bg-slate-800 dark:text-slate-100 text-[11.5px] font-black">
                <FolderKanban className="w-3 h-3" />
                {state.quoteMode === 'general' && '일반구매 견적'}
                {state.quoteMode === 'subscription' &&
                  `구독구매 견적 (${extracted.primarySubSummary.periodLabel})`}
                {state.quoteMode === 'hybrid' &&
                  `일반+구독 혼합견적 (${extracted.primarySubSummary.periodLabel})`}
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#059669] text-white text-[11.5px] font-black font-mono tabular-nums">
                실적기준(
                {state.quoteMode === 'subscription'
                  ? '구독원금'
                  : state.quoteMode === 'hybrid'
                  ? '제품합계+구독원금'
                  : '제품합계'}
                ): {formatCurrency(extracted.performanceAmount)}원
              </span>
            </div>

            <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
              📦 {extracted.itemsSummary}
            </div>

            {freedIncentivePreview.totalCount > 0 && (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-800/60 text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300 flex items-center justify-between gap-2">
                <span>💎 프리드: {freedIncentivePreview.summaryText}</span>
                <span className="font-mono tabular-nums">
                  확정 시 수당 +{formatCurrency(freedIncentivePreview.totalIncentive)}원
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#E5E8EB] dark:border-slate-800 text-xs">
              <span className="text-[#4E5968] dark:text-slate-400 font-bold">
                {state.quoteMode === 'subscription'
                  ? '월 기준 구독료: '
                  : '고객 실결제가: '}
                <strong className="text-[#191F28] dark:text-slate-100 font-black font-mono tabular-nums">
                  {formatCurrency(extracted.paidAmount)}원
                </strong>
              </span>
              <span className="text-[#E60012] dark:text-rose-400 font-black font-mono tabular-nums">
                {state.quoteMode === 'subscription' ? (
                  <>
                    월 체감 구독료: {formatCurrency(extracted.netAmount)}원
                    {extracted.primarySubSummary.totalSubCashback > 0 && (
                      <span className="ml-1 text-emerald-700 dark:text-emerald-400">
                        (최종 {extracted.primarySubSummary.periodLabel} 체감가{' '}
                        {formatCurrency(extracted.primarySubSummary.finalTotalFee)}원)
                      </span>
                    )}
                  </>
                ) : state.quoteMode === 'hybrid' ? (
                  <>
                    일반 체감 {formatCurrency(extracted.primaryGenSummary.rawNet)}원 · 통합 최종 체감{' '}
                    {formatCurrency(
                      extracted.primaryGenSummary.rawNet +
                        extracted.primarySubSummary.finalTotalFee
                    )}
                    원
                  </>
                ) : (
                  <>최종 혜택가(체감가): {formatCurrency(extracted.netAmount)}원</>
                )}
              </span>
            </div>

            {extraSummaries.length > 0 && (
              <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11.5px] font-bold text-emerald-800 dark:text-emerald-300 space-y-0.5">
                {extraSummaries.map((ps, idx) => (
                  <div key={idx} className="truncate">
                    <Sparkles className="w-3 h-3 inline mr-1" />[{idx + 2}안 동시 저장]{' '}
                    {ps.itemSummary} ({formatCurrency(ps.netAmount)}원)
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 기존 고객 선택 리스트 (tabMode === 'existing' 일 때) */}
          {tabMode === 'existing' && (
            <div className="bg-[#EFF6FF]/60 dark:bg-blue-950/25 border border-[#BFDBFE] dark:border-blue-800/60 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-black text-[#1B64DA] dark:text-blue-300 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                  전표/견적을 추가할 기존 고객 선택
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="고객명/연락처/전표번호 검색..."
                  className="px-2.5 py-1 rounded-lg border border-[#BFDBFE] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-semibold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                />
              </div>

              {filteredExisting.length === 0 ? (
                <div className="text-xs text-[#8B95A1] dark:text-slate-400 py-3 text-center bg-white dark:bg-[#131C2E] rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  등록된 고객이 없습니다. [신규 고객으로 등록] 탭을 이용해 주세요.
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {filteredExisting.map((c) => {
                    const isSel = selectedExistingId === c.id;
                    const cSlips = (c.quotes || []).filter((q) => q?.isConfirmedSlip);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectExistingCustomer(c)}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSel
                            ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] font-black'
                            : 'bg-white dark:bg-[#131C2E] hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#191F28] dark:text-slate-100 border border-[#E5E8EB] dark:border-slate-700 font-bold'
                        }`}
                      >
                        <div className="truncate min-w-0">
                          <span>{c.name} 고객님</span>
                          <span className="ml-2 opacity-75 font-mono tabular-nums">
                            {c.phone || '번호없음'}
                          </span>
                          {cSlips.length > 0 && (
                            <span className="ml-1.5 text-[11px] font-mono opacity-85">
                              · 🧾전표 {cSlips.length}건
                            </span>
                          )}
                        </div>
                        <span className="text-[11.5px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono tabular-nums shrink-0">
                          보관 {c.quotes?.length || 0}/{MAX_QUOTES_PER_CUSTOMER}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 기존 전표/견적이 있는 고객일 때: 덮어쓰기 보호 vs 추가 구매(새 전표/견적 별도 추가) 선택 박스 */}
          {matchedExistingCustomer && existingQuotesForTarget.length > 0 && (
            <div className="bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-800/70 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-black text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                  [{matchedExistingCustomer.name}] 고객님 저장 방식 (현재{' '}
                  <span className="font-mono tabular-nums">{existingQuotesForTarget.length}</span>/
                  {MAX_QUOTES_PER_CUSTOMER}개 보관 중)
                </span>
                <span
                  className={`text-[11.5px] font-extrabold px-2 py-0.5 rounded-full text-white ${
                    saveMode === 'append' || draftQuotesForTarget.length === 0
                      ? 'bg-[#059669]'
                      : 'bg-[#1B64DA]'
                  }`}
                >
                  {saveMode === 'append' || draftQuotesForTarget.length === 0
                    ? targetIsPurchasedOrHasSlip
                      ? '🛡️ 기존 전표 보존 · 추가 구매 별도 추가'
                      : '별도 비교용 새 견적 추가'
                    : '상담 견적 수정 덮어쓰기'}
                </span>
              </div>

              {targetIsPurchasedOrHasSlip && (
                <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11.5px] font-bold text-emerald-900 dark:text-emerald-200 flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="break-keep">
                    기존 확정 전표(
                    {confirmedSlipsForTarget.length > 0
                      ? `${confirmedSlipsForTarget.length}건${
                          existingOrderNosForTarget.length > 0
                            ? `: ${existingOrderNosForTarget.join(', ')}`
                            : ''
                        }`
                      : matchedExistingCustomer.status}
                    ) 보호를 위해 <strong>[➕ 추가 구매 · 새 전표/견적으로 별도 추가]</strong>가 자동 선택되었습니다.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaveMode('append')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    saveMode === 'append' || draftQuotesForTarget.length === 0
                      ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA] shadow-xs'
                      : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#BFDBFE] dark:border-slate-700 hover:bg-white/90 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-black flex items-center gap-1">
                    <span>
                      ➕ 추가 구매 · 새 전표/견적 별도 추가
                      {targetIsPurchasedOrHasSlip ? ' (권장)' : ''}
                    </span>
                  </div>
                  <div
                    className={`text-[11.5px] font-semibold ${
                      saveMode === 'append' || draftQuotesForTarget.length === 0
                        ? 'text-slate-300 dark:text-slate-900/80'
                        : 'text-[#8B95A1] dark:text-slate-400'
                    }`}
                  >
                    기존 전표·견적 보존 + 새 항목 나란히 추가 (
                    {Math.min(
                      MAX_QUOTES_PER_CUSTOMER,
                      existingQuotesForTarget.length + 1
                    )}
                    /{MAX_QUOTES_PER_CUSTOMER})
                  </div>
                </button>

                <button
                  type="button"
                  disabled={draftQuotesForTarget.length === 0}
                  onClick={() => {
                    if (draftQuotesForTarget.length === 0) return;
                    setSaveMode('overwrite');
                    if (
                      !overwriteQuoteId ||
                      !draftQuotesForTarget.some((q) => q.id === overwriteQuoteId)
                    ) {
                      setOverwriteQuoteId(draftQuotesForTarget[0]?.id || '');
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                    draftQuotesForTarget.length === 0
                      ? 'bg-slate-100 dark:bg-slate-900/50 text-[#8B95A1] dark:text-slate-500 border-[#E5E8EB] dark:border-slate-800 cursor-not-allowed opacity-70'
                      : saveMode === 'overwrite'
                      ? 'bg-[#1B64DA] text-white border-[#1B64DA] shadow-xs cursor-pointer'
                      : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#BFDBFE] dark:border-slate-700 hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  <div className="text-xs font-black flex items-center gap-1">
                    <span>
                      🔄 미확정 상담 견적 덮어쓰기
                      {!targetIsPurchasedOrHasSlip ? ' (권장)' : ''}
                    </span>
                  </div>
                  <div
                    className={`text-[11.5px] font-semibold ${
                      saveMode === 'overwrite' && draftQuotesForTarget.length > 0
                        ? 'text-blue-100'
                        : 'text-[#8B95A1] dark:text-slate-400'
                    }`}
                  >
                    {draftQuotesForTarget.length === 0
                      ? '확정 전표는 덮어쓰기 불가 (상세카드 [✏️전표수정] 이용)'
                      : `상담 견적(${draftQuotesForTarget.length}건) 중 선택하여 수정`}
                  </div>
                </button>
              </div>

              {saveMode === 'overwrite' && draftQuotesForTarget.length > 0 && (
                <div className="pt-1">
                  <label className="block text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300 mb-1">
                    덮어쓸 상담 견적 선택 (확정 전표는 목록에서 자동 보호됨):
                  </label>
                  <select
                    value={overwriteQuoteId || draftQuotesForTarget[0]?.id || ''}
                    onChange={(e) => setOverwriteQuoteId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#BFDBFE] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                  >
                    {draftQuotesForTarget.map((q, idx) => (
                      <option key={q.id} value={q.id}>
                        [상담견적 #{idx + 1}] {q.title} ({formatCurrency(q.netAmount)}원 · {q.createdAt.slice(5, 16)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 견적 제목 */}
          <div>
            <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
              전표 · 견적 보관함 제목 (자동 완성 · 수정 가능)
            </label>
            <input
              type="text"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              placeholder="예: 85인치 TV + 오브제 냉장고"
              className="w-full px-3.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
            />
          </div>

          {/* 고객명 & 연락처 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                고객명 <span className="text-[#E60012]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-sm font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                연락처 (하이픈 자동)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                placeholder="010-1234-5678"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-sm font-bold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>
          </div>

          {/* 진행 상태 & 계약일(총판월) & 배송예정일(실판월) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                진행 상태 (구매확정 여부)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-extrabold bg-white dark:bg-slate-900/70 text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              >
                <option value="상담진행중">상담진행중 (미구매)</option>
                <option value="신규/미발송">신규/미발송 (미구매)</option>
                <option value="미구매/고민중">미구매/고민중</option>
                <option value="계약완료">✅ 계약완료 (구매·배송대기 전표)</option>
                <option value="발송완료">📩 발송완료 (견적안내 완료)</option>
                <option value="배송완료">🚚 배송완료 (당일자송·인도완료 전표)</option>
                <option value="취소/보류">취소/보류</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                계약/매출일 (총판월 기준)
              </label>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-slate-900/70 text-base sm:text-xs font-bold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1B64DA] dark:text-blue-400 mb-1">
                이 전표 배달일자 (실판월 기준)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#BFDBFE] dark:border-blue-800/70 bg-white dark:bg-slate-900/70 text-base sm:text-xs font-bold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>
          </div>

          {/* 📞 재연락 예정일 (미결/상담 고객 리마인드용) */}
          <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-3 rounded-2xl border border-[#E5E8EB] dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-black text-[#191F28] dark:text-slate-100 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                📞 재연락 예정일 (미결/고민 고객 리마인드용)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getOffsetDateStr(3))}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#131C2E] hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-slate-700 text-[11.5px] font-extrabold transition cursor-pointer"
                >
                  +3일 뒤
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(false))}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#131C2E] hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-slate-700 text-[11.5px] font-extrabold transition cursor-pointer"
                >
                  이번 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(true))}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#131C2E] hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-slate-700 text-[11.5px] font-extrabold transition cursor-pointer"
                >
                  다음 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate('')}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#131C2E] hover:bg-slate-100 dark:hover:bg-slate-800 text-[#8B95A1] dark:text-slate-400 border border-[#E5E8EB] dark:border-slate-700 text-[11.5px] font-bold transition cursor-pointer"
                >
                  초기화
                </button>
              </div>
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-bold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
            />
          </div>

          {/* 전표번호 & 약속 사은품 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                전표번호 (입력 시 확정 전표로 자동 등록)
              </label>
              <input
                type="text"
                value={orderNo}
                onChange={(e) => handleOrderNoChange(e.target.value)}
                placeholder={
                  targetIsPurchasedOrHasSlip
                    ? '새 추가구매 전표번호 (예: 20261127-0004)'
                    : '예: 20261125-0011'
                }
                className="w-full px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-xs font-semibold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                약속 사은품 (선택)
              </label>
              <input
                type="text"
                value={giftItems}
                onChange={(e) => setGiftItems(e.target.value)}
                placeholder="예: 냄비 3종 세트"
                className="w-full px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-xs font-semibold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>
          </div>

          {/* 매장 상담 메모 */}
          <div>
            <label className="block text-xs font-bold text-[#4E5968] dark:text-slate-300 mb-1">
              매장 메모 (선택)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="고객 요청사항, 추가 구매 메모, 카드 발급 일정 등"
              className="w-full px-3.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900/70 text-base sm:text-xs text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
            />
          </div>

          {savedToast && (
            <div className="p-3 rounded-xl bg-[#059669] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedToast}</span>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-3.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-t border-[#E5E8EB] dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#4E5968] dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#E60012] hover:bg-[#c8000f] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {matchedExistingCustomer && existingQuotesForTarget.length > 0
              ? saveMode === 'overwrite' && draftQuotesForTarget.length > 0
                ? '🔄 상담 견적 덮어쓰기 저장'
                : targetIsPurchasedOrHasSlip
                ? '➕ 추가 구매 · 새 전표/견적 추가 저장'
                : '➕ 새 견적으로 추가 저장'
              : 'CRM에 고객 및 견적 저장하기'}
          </button>
        </div>
      </form>
    </FlagshipModalShell>
  );
};
