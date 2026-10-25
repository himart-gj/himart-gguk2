import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderKanban,
  PhoneCall,
  Save,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  GeneralPlanData,
  ProposalState,
  calculateGeneralHiPreedSummary,
  getGeneralPlan1And2Summaries,
} from '../../types/proposal';
import {
  CustomerItem,
  CustomerStatus,
  QuotePlan2Summary,
} from '../types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getFridayDateStr,
  getOffsetDateStr,
} from '../utils/date';
import { getCachedCustomers, saveCustomerQuote } from '../services/gasApi';

interface SaveToCrmModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProposalState;
  activeCustomer: { id: string; name: string; phone?: string } | null;
  onSavedSuccess: (customer: {
    id: string;
    name: string;
    phone?: string;
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

export function extractQuotePayloadFromProposalState(state: ProposalState): {
  itemsSummary: string;
  paidAmount: number;
  netAmount: number;
  expectedBenefit: string;
  defaultQuoteTitle: string;
  plan2Summary?: QuotePlan2Summary;
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
    hasPlan1Data,
    hasPlan2Data,
  } = getGeneralPlan1And2Summaries(state);

  // 만약 1안은 비어 있고 2안에만 데이터가 있다면 2안을 기본 대표 데이터로 사용
  const usePlan2AsPrimary = !hasPlan1Data && hasPlan2Data;
  const primaryData = usePlan2AsPrimary ? plan2Data : plan1Data;
  const primaryGenSummary = usePlan2AsPrimary ? plan2GenSummary : plan1Summary;
  const primarySubSummary = usePlan2AsPrimary
    ? plan2SubSummary
    : plan1SubSummary;
  const hasSecondPlan = !usePlan2AsPrimary && hasPlan2Data;

  const primaryGenNames = getValidGeneralItemNames(primaryData);
  const plan2GenNames = getValidGeneralItemNames(plan2Data);

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
        `하이프리드(${generalHiPreed.totalAccounts}구좌) ${formatCurrency(
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

    let plan2Summary: QuotePlan2Summary | undefined;
    if (hasSecondPlan && plan2GenSummary.sum > 0) {
      const p2Names =
        plan2GenNames.length > 0 ? plan2GenNames.join(', ') : '일반가전 2안';
      const p2BenefitParts: string[] = [];
      if (plan2GenSummary.totalStep1InstantDiscount > 0) {
        p2BenefitParts.push(
          `즉시할인 ${formatCurrency(plan2GenSummary.totalStep1InstantDiscount)}원`
        );
      }
      if (plan2GenSummary.hiFreedSupport > 0) {
        p2BenefitParts.push(
          `하이프리드 ${formatCurrency(plan2GenSummary.hiFreedSupport)}원`
        );
      }
      if (plan2GenSummary.totalStep2Cashback > 0) {
        p2BenefitParts.push(
          `캐시백 ${formatCurrency(plan2GenSummary.totalStep2Cashback)}원`
        );
      }
      if (plan2GenSummary.totalStep2ExtraBenefit > 0) {
        p2BenefitParts.push(
          `추가혜택 ${formatCurrency(plan2GenSummary.totalStep2ExtraBenefit)}원`
        );
      }

      plan2Summary = {
        itemSummary: p2Names,
        paidAmount: plan2GenSummary.payPrice,
        netAmount: plan2GenSummary.rawNet,
        benefit:
          p2BenefitParts.join(' + ') ||
          (plan2GenSummary.totalDiscountAndBenefit > 0
            ? `총 혜택 ${formatCurrency(
                plan2GenSummary.totalDiscountAndBenefit
              )}원`
            : undefined),
      };
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
      plan2Summary,
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

    let plan2Summary: QuotePlan2Summary | undefined;
    if (hasSecondPlan && plan2SubSummary.totalBaseMonthly > 0) {
      const p2SubNames =
        plan2SubSummary.validSubNames.length > 0
          ? `[${plan2SubSummary.periodLabel} 구독] ${plan2SubSummary.validSubNames.join(', ')}`
          : `[${plan2SubSummary.periodLabel} 구독] 맞춤 구독 2안`;
      const p2SubBenefits: string[] = [];
      if (plan2SubSummary.cardDiscount > 0 && plan2SubSummary.currentCard) {
        p2SubBenefits.push(
          `${plan2SubSummary.currentCard.name} 월 -${formatCurrency(
            plan2SubSummary.cardDiscount
          )}원`
        );
      }
      if (plan2SubSummary.hiPlusMonthly > 0) {
        p2SubBenefits.push(
          `구독프리드(${plan2SubSummary.hiSummary.totalAccounts}구좌) 월 -${formatCurrency(
            plan2SubSummary.hiPlusMonthly
          )}원`
        );
      }

      plan2Summary = {
        itemSummary: p2SubNames,
        paidAmount: plan2SubSummary.totalBaseMonthly,
        netAmount: plan2SubSummary.finalMonthlyFee,
        benefit:
          p2SubBenefits.join(' + ') ||
          `${plan2SubSummary.periodLabel} 총 체감가 ${formatCurrency(
            plan2SubSummary.finalTotalFee
          )}원 (원금 ${formatCurrency(plan2SubSummary.totalPrincipal)}원)`,
      };
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
      plan2Summary,
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
  )}원 / 총 체감 ${formatCurrency(
    primarySubSummary.finalTotalFee
  )}원 · 원금 ${formatCurrency(primarySubSummary.totalPrincipal)}원)`;

  let plan2Summary: QuotePlan2Summary | undefined;
  if (
    hasSecondPlan &&
    (plan2GenSummary.sum > 0 || plan2SubSummary.totalBaseMonthly > 0)
  ) {
    const p2GenLabel =
      plan2GenNames.length > 0 ? plan2GenNames.join(', ') : '일반가전';
    const p2SubLabel =
      plan2SubSummary.validSubNames.length > 0
        ? plan2SubSummary.validSubNames.join(', ')
        : `구독가전(${plan2SubSummary.periodLabel})`;

    plan2Summary = {
      itemSummary: `일반 2안(${p2GenLabel}) + 구독 2안(${p2SubLabel})`,
      paidAmount:
        plan2GenSummary.sum > 0
          ? plan2GenSummary.payPrice
          : plan2SubSummary.totalBaseMonthly,
      netAmount:
        plan2GenSummary.sum > 0
          ? plan2GenSummary.rawNet
          : plan2SubSummary.finalMonthlyFee,
      benefit: `일반 2안 실결제 ${formatCurrency(
        plan2GenSummary.payPrice
      )}원(체감 ${formatCurrency(plan2GenSummary.rawNet)}원) + 구독(${
        plan2SubSummary.periodLabel
      }) 월 기본 ${formatCurrency(
        plan2SubSummary.totalBaseMonthly
      )}원(월 체감 ${formatCurrency(
        plan2SubSummary.finalMonthlyFee
      )}원 / 총 체감 ${formatCurrency(
        plan2SubSummary.finalTotalFee
      )}원 · 원금 ${formatCurrency(plan2SubSummary.totalPrincipal)}원)`,
    };
  }

  return {
    itemsSummary,
    paidAmount: primaryPaidAmount,
    netAmount: primaryNetAmount,
    expectedBenefit,
    defaultQuoteTitle: `[혼합견적] ${itemsSummary.slice(0, 22)}`,
    plan2Summary,
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
  const [deliveryDate, setDeliveryDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [giftItems, setGiftItems] = useState('');
  const [memo, setMemo] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const extracted = useMemo(
    () => extractQuotePayloadFromProposalState(state),
    [state]
  );

  useEffect(() => {
    if (!isOpen) return;
    const cached = getCachedCustomers().filter((c) => !c.deletedAt);
    setExistingCustomers(cached);
    setQuoteTitle(extracted.defaultQuoteTitle);
    setSavedToast(null);

    if (activeCustomer) {
      const found = cached.find((c) => c.id === activeCustomer.id);
      if (found) {
        setTabMode('existing');
        setSelectedExistingId(found.id);
        setName(found.name);
        setPhone(found.phone || '');
        setStatus(found.status || '상담진행중');
        setDeliveryDate(found.deliveryDate || '');
        setFollowUpDate(found.followUpDate || '');
        setOrderNo(found.orderNo || '');
        setGiftItems(found.giftItems || '');
        setMemo('');
        return;
      }
    }

    setTabMode('new');
    setSelectedExistingId('');
    setName('');
    setPhone('');
    setStatus('상담진행중');
    setDeliveryDate('');
    setFollowUpDate('');
    setOrderNo('');
    setGiftItems('');
    setMemo('');
  }, [isOpen, activeCustomer, extracted.defaultQuoteTitle]);

  if (!isOpen) return null;

  const handleSelectExistingCustomer = (c: CustomerItem) => {
    setSelectedExistingId(c.id);
    setName(c.name);
    setPhone(c.phone || '');
    setStatus(c.status || '상담진행중');
    setDeliveryDate(c.deliveryDate || '');
    setFollowUpDate(c.followUpDate || '');
    setOrderNo(c.orderNo || '');
    setGiftItems(c.giftItems || '');
  };

  const filteredExisting = existingCustomers.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.items.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const syncedProposalState: ProposalState = {
      ...state,
      generalPlan1: extracted.plan1Data,
      generalPlan2: extracted.plan2Data,
    };

    const result = await saveCustomerQuote({
      targetCustomerId:
        tabMode === 'existing' && selectedExistingId
          ? selectedExistingId
          : undefined,
      name: name.trim(),
      phone: phone.trim(),
      items: extracted.itemsSummary,
      paidAmount: extracted.paidAmount,
      netAmount: extracted.netAmount,
      expectedBenefit: extracted.expectedBenefit,
      deliveryDate: deliveryDate.trim(),
      followUpDate: followUpDate.trim(),
      status,
      memo: memo.trim(),
      orderNo: orderNo.trim(),
      giftItems: giftItems.trim(),
      quoteTitle: quoteTitle.trim() || extracted.defaultQuoteTitle,
      proposalState: syncedProposalState,
      quoteMode: state.quoteMode,
      plan2Summary: extracted.plan2Summary,
    });

    onSavedSuccess({
      id: result.savedCustomer.id,
      name: result.savedCustomer.name,
      phone: result.savedCustomer.phone,
    });

    setSavedToast(
      result.isExistingCustomer
        ? `✅ [${result.savedCustomer.name}] 고객님의 견적 보관함(${result.quoteCount}/5)에 저장되었습니다!`
        : `✅ 신규 고객 [${result.savedCustomer.name}]님으로 등록 및 견적이 저장되었습니다!`
    );

    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                💾 CRM 고객 저장 & 다중 견적 보관함 연동
              </h3>
              <p className="text-[11px] text-slate-300">
                현재 작성한 견적 조건을 고객 카드 및 견적 히스토리(최대 5개)에 저장합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 상단 탭: 신규 등록 vs 기존 고객 선택 */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTabMode('new');
              setSelectedExistingId('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
              tabMode === 'new'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />➕ 신규 고객으로 등록 및 저장
          </button>
          <button
            type="button"
            onClick={() => setTabMode('existing')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
              tabMode === 'existing'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />👥 기존 CRM 고객 선택하여 견적 추가 (
            {existingCustomers.length}명)
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 overflow-y-auto space-y-4 flex-1"
        >
          {/* 현재 견적 자동 요약 카드 */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 text-[11px] font-black">
                <FolderKanban className="w-3 h-3" />
                {state.quoteMode === 'general' && '일반구매 견적'}
                {state.quoteMode === 'subscription' &&
                  `구독구매 견적 (${extracted.primarySubSummary.periodLabel})`}
                {state.quoteMode === 'hybrid' &&
                  `일반+구독 혼합견적 (${extracted.primarySubSummary.periodLabel})`}
              </span>

              {extracted.plan2Summary && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-2xs">
                  <Sparkles className="w-3 h-3" />✨ 1안 + 2안 비교 견적이 함께 저장됩니다
                </span>
              )}
            </div>

            <div className="text-xs font-extrabold text-slate-800">
              📦 {extracted.itemsSummary}
            </div>

            {state.quoteMode === 'hybrid' ? (
              <div className="space-y-1.5 pt-1 border-t border-slate-200/80 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <span className="font-extrabold text-blue-700">
                    📘 [1안 일반] 실결제{' '}
                    {formatCurrency(extracted.primaryGenSummary.payPrice)}원 /
                    체감 {formatCurrency(extracted.primaryGenSummary.rawNet)}원
                  </span>
                  <span className="font-extrabold text-rose-600">
                    🔄 [1안 구독 {extracted.primarySubSummary.periodLabel}] 월 기본{' '}
                    {formatCurrency(
                      extracted.primarySubSummary.totalBaseMonthly
                    )}
                    원 / 월 체감{' '}
                    {formatCurrency(extracted.primarySubSummary.finalMonthlyFee)}
                    원
                  </span>
                </div>

                {extracted.plan2Summary && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900 space-y-0.5">
                    <div>📗 [2안 품목] {extracted.plan2Summary.itemSummary}</div>
                    <div className="text-emerald-800">
                      • {extracted.plan2Summary.benefit}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 text-xs">
                  <span className="text-slate-600 font-bold">
                    {state.quoteMode === 'subscription'
                      ? '월 기준 구독료: '
                      : '실결제가: '}
                    <strong className="text-slate-900 font-black">
                      {formatCurrency(extracted.paidAmount)}원
                    </strong>
                  </span>
                  <span className="text-blue-600 font-black">
                    {state.quoteMode === 'subscription'
                      ? '최종 월 체감가: '
                      : '최종 혜택가(체감가): '}
                    {formatCurrency(extracted.netAmount)}원
                  </span>
                </div>

                {extracted.plan2Summary && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900">
                    📗 [2안 요약] {extracted.plan2Summary.itemSummary} ·{' '}
                    {state.quoteMode === 'subscription' ? '월 기본 ' : '실결제가 '}
                    {formatCurrency(extracted.plan2Summary.paidAmount)}원 /{' '}
                    {state.quoteMode === 'subscription' ? '월 체감 ' : '체감가 '}
                    {formatCurrency(extracted.plan2Summary.netAmount)}원
                    {extracted.plan2Summary.benefit
                      ? ` (${extracted.plan2Summary.benefit})`
                      : ''}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 기존 고객 선택 리스트 (tabMode === 'existing' 일 때) */}
          {tabMode === 'existing' && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  견적을 추가할 기존 고객 선택
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="고객명/연락처 검색..."
                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs font-semibold focus:outline-none"
                />
              </div>

              {filteredExisting.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center bg-white rounded-xl border border-amber-100">
                  등록된 고객이 없습니다. [신규 고객으로 등록] 탭을 이용해 주세요.
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {filteredExisting.map((c) => {
                    const isSel = selectedExistingId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectExistingCustomer(c)}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition cursor-pointer ${
                          isSel
                            ? 'bg-slate-900 text-white font-black'
                            : 'bg-white hover:bg-amber-100/70 text-slate-800 border border-amber-200/70 font-bold'
                        }`}
                      >
                        <div className="truncate">
                          <span>{c.name} 고객님</span>
                          <span className="ml-2 opacity-75">
                            {c.phone || '번호없음'}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 shrink-0">
                          견적 {c.quotes?.length || 0}/5
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 견적 제목 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              견적 보관함 제목 (자동 완성 · 수정 가능)
            </label>
            <input
              type="text"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              placeholder="예: 85인치 TV + 오브제 냉장고 1안"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 고객명 & 연락처 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                고객명 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                연락처 (하이픈 자동)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                placeholder="010-1234-5678"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 진행 상태 & 배송 예정일 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                진행 상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-extrabold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="상담진행중">상담진행중</option>
                <option value="신규/미발송">신규/미발송</option>
                <option value="발송완료">발송완료</option>
                <option value="미구매/고민중">미구매/고민중</option>
                <option value="계약완료">계약완료</option>
                <option value="취소/보류">취소/보류</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                배송 예정일 (선택)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 📞 재연락 예정일 (미결/상담 고객 리마인드용) */}
          <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-black text-indigo-900 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                📞 재연락 예정일 (미결/고민 고객 리마인드용)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getOffsetDateStr(3))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  +3일 뒤
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(false))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  이번 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(true))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  다음 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate('')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold transition cursor-pointer"
                >
                  초기화
                </button>
              </div>
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 전표번호 & 약속 사은품 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                전표번호 (선택)
              </label>
              <input
                type="text"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="예: 250516-0042"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                약속 사은품 (선택)
              </label>
              <input
                type="text"
                value={giftItems}
                onChange={(e) => setGiftItems(e.target.value)}
                placeholder="예: 냄비 3종 세트"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 매장 상담 메모 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              매장 메모 (선택)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="고객 요청사항, 타사 비교견적, 카드 발급 일정 등"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {savedToast && (
            <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedToast}</span>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              CRM에 고객 및 견적 저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
