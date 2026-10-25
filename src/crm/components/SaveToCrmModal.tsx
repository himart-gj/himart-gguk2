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
  AFFILIATE_CARDS,
  ProposalState,
  calculateGeneralHiPreedSummary,
  calculateGeneralPurchaseSummary,
  calculateHiPlusSummary,
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

export function extractQuotePayloadFromProposalState(state: ProposalState): {
  itemsSummary: string;
  paidAmount: number;
  netAmount: number;
  expectedBenefit: string;
  defaultQuoteTitle: string;
  plan2Summary?: QuotePlan2Summary;
} {
  // 1안 및 현재 플랜 계산
  const generalSummary = calculateGeneralPurchaseSummary(state);
  const generalHiPreed = calculateGeneralHiPreedSummary(
    state.generalHiPreedCounts
  );

  // 2안 유효성 및 계산 (일반 또는 혼합 모드에서 generalPlan2에 유효 품목이 있는지 확인)
  const plan2Data = state.generalPlan2;
  const validPlan2Items = (plan2Data?.generalItems || []).filter(
    (it) => it.category.trim() !== '' || (Number(it.unitPrice) || 0) > 0
  );
  const plan2SummaryCalc = calculateGeneralPurchaseSummary(plan2Data);

  // 구독 계산
  const currentCard = AFFILIATE_CARDS.find(
    (c) => c.id === state.selectedCardId
  );
  const currentCardTier = currentCard?.tiers.find(
    (t) => t.id === state.selectedCardTierId
  );
  const hiSummary = calculateHiPlusSummary(
    state.hiPlusCounts,
    state.subscriptionPeriod
  );
  const totalBaseMonthly = state.items.reduce(
    (sum, item) => sum + (Number(item.monthlyFee) || 0),
    0
  );
  const cardDiscount = currentCardTier?.monthlyDiscount || 0;
  const hiPlusMonthly = hiSummary.monthlyHiPlusSupport;
  const finalMonthlyFee = totalBaseMonthly - cardDiscount - hiPlusMonthly;

  const validGenNames = state.generalItems
    .map((it) => {
      const cat = it.category.trim();
      const mod = it.modelName.trim();
      if (!cat && !mod) return '';
      return mod ? `${cat || '가전'}(${mod})` : cat;
    })
    .filter(Boolean);

  const validSubNames = state.items
    .map((it) => {
      const cat = it.category.trim();
      const mod = it.modelName.trim();
      if (!cat && !mod) return '';
      return mod ? `${cat || '구독가전'}(${mod})` : cat;
    })
    .filter(Boolean);

  if (state.quoteMode === 'general') {
    const itemsSummary =
      validGenNames.length > 0
        ? validGenNames.join(', ')
        : '일반구매 맞춤 가전 패키지';
    const benefitParts: string[] = [];
    if (generalSummary.totalStep1InstantDiscount > 0) {
      benefitParts.push(
        `즉시할인 ${formatCurrency(generalSummary.totalStep1InstantDiscount)}원`
      );
    }
    if (generalSummary.hiFreedSupport > 0) {
      benefitParts.push(
        `하이프리드(${generalHiPreed.totalAccounts}구좌) ${formatCurrency(
          generalSummary.hiFreedSupport
        )}원`
      );
    }
    if (generalSummary.totalStep2Cashback > 0) {
      benefitParts.push(
        `캐시백 ${formatCurrency(generalSummary.totalStep2Cashback)}원`
      );
    }
    if (generalSummary.totalStep2ExtraBenefit > 0) {
      benefitParts.push(
        `추가혜택 ${formatCurrency(generalSummary.totalStep2ExtraBenefit)}원`
      );
    }

    let plan2Summary: QuotePlan2Summary | undefined;
    if (validPlan2Items.length > 0 && plan2SummaryCalc.sum > 0) {
      const p2Names = validPlan2Items
        .map((it) =>
          it.modelName.trim()
            ? `${it.category.trim() || '가전'}(${it.modelName.trim()})`
            : it.category.trim() || '일반가전'
        )
        .join(', ');
      plan2Summary = {
        itemSummary: p2Names,
        paidAmount: plan2SummaryCalc.payPrice,
        netAmount: plan2SummaryCalc.rawNet,
        benefit:
          plan2SummaryCalc.totalDiscountAndBenefit > 0
            ? `총 혜택 ${formatCurrency(
                plan2SummaryCalc.totalDiscountAndBenefit
              )}원`
            : undefined,
      };
    }

    return {
      itemsSummary,
      paidAmount: generalSummary.payPrice,
      netAmount: generalSummary.rawNet,
      expectedBenefit:
        benefitParts.join(' + ') ||
        `총 할인/혜택 ${formatCurrency(
          generalSummary.totalDiscountAndBenefit
        )}원`,
      defaultQuoteTitle: `[일반구매] ${itemsSummary.slice(0, 22)}`,
      plan2Summary,
    };
  }

  if (state.quoteMode === 'subscription') {
    const itemsSummary =
      validSubNames.length > 0
        ? `[${state.subscriptionPeriod}개월 구독] ${validSubNames.join(', ')}`
        : `[${state.subscriptionPeriod}개월 구독] 맞춤 구독 패키지`;
    const benefitParts: string[] = [];
    if (cardDiscount > 0 && currentCard) {
      benefitParts.push(`${currentCard.name} 월 -${formatCurrency(cardDiscount)}원`);
    }
    if (hiPlusMonthly > 0) {
      benefitParts.push(
        `구독프리드(${hiSummary.totalAccounts}구좌) 월 -${formatCurrency(
          hiPlusMonthly
        )}원`
      );
    }

    return {
      itemsSummary,
      paidAmount: totalBaseMonthly,
      netAmount: finalMonthlyFee,
      expectedBenefit:
        benefitParts.join(' + ') ||
        `${state.subscriptionPeriod}개월 무상 A/S 및 방문케어`,
      defaultQuoteTitle: `[구독 ${state.subscriptionPeriod}M] ${
        validSubNames.join(', ').slice(0, 18) || '맞춤 구독'
      }`,
    };
  }

  // hybrid 모드
  const genLabel =
    validGenNames.length > 0 ? `일반(${validGenNames.join(', ')})` : '일반가전';
  const subLabel =
    validSubNames.length > 0
      ? `구독 ${state.subscriptionPeriod}M(${validSubNames.join(', ')})`
      : `구독 ${state.subscriptionPeriod}M`;
  const itemsSummary = `${genLabel} + ${subLabel}`;
  const hybridTotalBenefit =
    generalSummary.totalDiscountAndBenefit +
    (cardDiscount + hiPlusMonthly) * state.subscriptionPeriod;

  let plan2Summary: QuotePlan2Summary | undefined;
  if (validPlan2Items.length > 0 && plan2SummaryCalc.sum > 0) {
    const p2Names = validPlan2Items
      .map((it) =>
        it.modelName.trim()
          ? `${it.category.trim() || '가전'}(${it.modelName.trim()})`
          : it.category.trim() || '일반가전'
      )
      .join(', ');
    plan2Summary = {
      itemSummary: `일반 2안(${p2Names}) + ${subLabel}`,
      paidAmount: plan2SummaryCalc.payPrice,
      netAmount: plan2SummaryCalc.rawNet,
      benefit: `일반 2안 체감가 ${formatCurrency(
        plan2SummaryCalc.rawNet
      )}원 / 구독 월 ${formatCurrency(finalMonthlyFee)}원`,
    };
  }

  return {
    itemsSummary,
    paidAmount: generalSummary.payPrice,
    netAmount: generalSummary.rawNet,
    expectedBenefit: `일반 체감 ${formatCurrency(
      generalSummary.rawNet
    )}원 + 구독 월 체감 ${formatCurrency(
      finalMonthlyFee
    )}원 (통합 총혜택 ${formatCurrency(hybridTotalBenefit)}원)`,
    defaultQuoteTitle: `[혼합견적] ${itemsSummary.slice(0, 22)}`,
    plan2Summary,
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
      proposalState: state,
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
                  `구독구매 견적 (${state.subscriptionPeriod}개월)`}
                {state.quoteMode === 'hybrid' && '일반+구독 혼합견적'}
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
                📗 [2안 요약] {extracted.plan2Summary.itemSummary} · 실결제가{' '}
                {formatCurrency(extracted.plan2Summary.paidAmount)}원 / 체감가{' '}
                {formatCurrency(extracted.plan2Summary.netAmount)}원
              </div>
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
