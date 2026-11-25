import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FilePlus2,
  PlusCircle,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  CustomerItem,
  CustomerStatus,
  QuoteRecord,
  SlipDeliveryStatus,
} from '../types/crm';
import { CustomerCard } from './CustomerCard';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';
import { FormattedMoneyInput } from '../../components/FormattedMoneyInput';
import {
  buildProposalStateFromHisisSlip,
  SubscriptionPeriod,
} from '../../types/proposal';
import { inferCategoryFromModelCode } from '../../utils/aiImageParser';
import { parsePurchasedModelsFromItemsText } from '../utils/settlementEngine';
import {
  normalizeOrderNoKey,
  QuoteSlipInlinePatch,
  saveCustomerQuote,
  syncCustomerToGas,
} from '../services/gasApi';
import { formatCurrency, getTodayStr } from '../utils/date';

type ManualSaleMode = 'general' | 'sub36' | 'sub60';
type ManualOutboundMode = 'logistics' | 'self';

interface CustomerDetailModalProps {
  customer: CustomerItem | null;
  onClose: () => void;
  onStatusChange: (id: string, nextStatus: CustomerStatus) => void;
  onMemoChange: (id: string, nextMemo: string) => void;
  onFieldChange: (id: string, patch: Partial<CustomerItem>) => void;
  onDeleteQuoteRecord: (customerId: string, quoteId: string) => void;
  onApplyQuoteAsPrimary: (customerId: string, quote: QuoteRecord) => void;
  onToggleSlipDeliveryStatus?: (customerId: string, quoteId: string) => void;
  onUpdateQuoteSlip?: (
    customerId: string,
    quoteId: string,
    patch: QuoteSlipInlinePatch
  ) => void;
  onConfirmDraftQuote?: (customerId: string, quoteId: string) => void;
  onAddSlipForCustomer?: (customer: CustomerItem) => void;
  onManualSlipSaved?: (customer: CustomerItem, orderNo?: string) => void;
  onLoadQuoteRecord: (customer: CustomerItem, quote: QuoteRecord) => void;
  onDelete: (id: string) => void;
  onOpenSMS: (customer: CustomerItem) => void;
  onOpenQuote: (customer: CustomerItem) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  onStatusChange,
  onMemoChange,
  onFieldChange,
  onDeleteQuoteRecord,
  onApplyQuoteAsPrimary,
  onToggleSlipDeliveryStatus,
  onUpdateQuoteSlip,
  onConfirmDraftQuote,
  onAddSlipForCustomer,
  onManualSlipSaved,
  onLoadQuoteRecord,
  onDelete,
  onOpenSMS,
  onOpenQuote,
}) => {
  const [showManualSlipForm, setShowManualSlipForm] = useState(false);
  const [manualOrderNo, setManualOrderNo] = useState('');
  const [manualSaleMode, setManualSaleMode] =
    useState<ManualSaleMode>('general');
  const [manualCategory, setManualCategory] = useState('');
  const [manualModelCode, setManualModelCode] = useState('');
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualMonthlyOverride, setManualMonthlyOverride] = useState<
    number | null
  >(null);
  const [manualContractDate, setManualContractDate] = useState(() =>
    getTodayStr()
  );
  const [manualDeliveryDate, setManualDeliveryDate] = useState('');
  const [manualOutbound, setManualOutbound] =
    useState<ManualOutboundMode>('logistics');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const resetManualForm = () => {
    setManualOrderNo('');
    setManualSaleMode('general');
    setManualCategory('');
    setManualModelCode('');
    setManualAmount(0);
    setManualMonthlyOverride(null);
    setManualContractDate(getTodayStr());
    setManualDeliveryDate('');
    setManualOutbound('logistics');
    setManualError(null);
  };

  useEffect(() => {
    setShowManualSlipForm(false);
    resetManualForm();
  }, [customer?.id]);

  const activeSubPeriod: SubscriptionPeriod | null =
    manualSaleMode === 'sub36' ? 36 : manualSaleMode === 'sub60' ? 60 : null;

  const autoMonthlyFee = useMemo(() => {
    if (!activeSubPeriod) return 0;
    const principal = Math.max(0, Math.round(Number(manualAmount) || 0));
    return principal > 0 ? Math.round(principal / activeSubPeriod) : 0;
  }, [activeSubPeriod, manualAmount]);

  const effectiveMonthlyFee =
    manualMonthlyOverride !== null && manualMonthlyOverride > 0
      ? Math.round(manualMonthlyOverride)
      : autoMonthlyFee;

  const duplicateOrderQuote = useMemo(() => {
    if (!customer) return null;
    const key = normalizeOrderNoKey(manualOrderNo);
    if (!key) return null;
    return (
      (customer.quotes || []).find(
        (q) => normalizeOrderNoKey(q.orderNo) === key
      ) || null
    );
  }, [customer, manualOrderNo]);

  if (!customer) return null;

  const handleSaveManualSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingManual) return;
    setManualError(null);

    const cleanOrderNo = manualOrderNo.trim();
    if (cleanOrderNo && duplicateOrderQuote) {
      setManualError(
        `전표번호 [${cleanOrderNo}]는 이미 등록되어 있습니다. 기존 전표 수정은 아래 타임라인의 [✏️ 전표수정]을 이용해 주세요.`
      );
      return;
    }

    const isSub = activeSubPeriod !== null;
    let cat = manualCategory.trim();
    let code = manualModelCode.trim().toUpperCase();

    if (!code && cat) {
      const parsed = parsePurchasedModelsFromItemsText(
        cat,
        isSub ? 'subscription' : 'general'
      );
      if (parsed.length > 0) {
        const first = parsed[0];
        if (first.modelName && first.modelName !== first.category) {
          cat = first.category || cat;
          code = first.modelName.trim().toUpperCase();
        }
      }
    }

    if (!cat && code) {
      cat =
        inferCategoryFromModelCode(code) ||
        (isSub ? '구독가전' : '일반가전');
    }

    if (!cat && !code && !cleanOrderNo && manualAmount <= 0) {
      setManualError('전표번호 또는 구매 품목·금액을 입력해 주세요.');
      return;
    }

    if (!cat) {
      cat = isSub ? '구독 추가구매' : '일반 추가구매';
    }

    const cleanContractDate = manualContractDate.trim() || getTodayStr();
    const isSelfOutbound = manualOutbound === 'self';
    const slipDeliveryStatus: SlipDeliveryStatus = isSelfOutbound
      ? '배송완료'
      : '배송대기';
    const resolvedDeliveryDate =
      manualDeliveryDate.trim() || (isSelfOutbound ? cleanContractDate : '');
    const outboundType = isSelfOutbound ? '자송' : '타사물류·직배';

    setIsSavingManual(true);
    try {
      if (isSub && activeSubPeriod) {
        const principal = Math.max(0, Math.round(Number(manualAmount) || 0));
        const monthly = effectiveMonthlyFee;
        const proposalState = buildProposalStateFromHisisSlip({
          mode: 'subscription',
          subscriptionItems: [
            {
              category: cat,
              modelName: code,
              contractAmount: principal,
              period: activeSubPeriod,
              monthlyFee: monthly,
            },
          ],
        });
        const itemSummary = `[구독 ${activeSubPeriod}M] ${
          code ? `${cat}(${code})` : cat
        }`;
        const savedRes = await saveCustomerQuote({
          targetCustomerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          items: itemSummary,
          paidAmount: monthly,
          netAmount: monthly,
          expectedBenefit: `구독원금 ${formatCurrency(principal)}원 (${activeSubPeriod}개월)`,
          contractDate: cleanContractDate,
          deliveryDate: resolvedDeliveryDate,
          status: isSelfOutbound ? '배송완료' : '계약완료',
          memo: '',
          orderNo: cleanOrderNo,
          quoteTitle: cleanOrderNo
            ? `[전표 ${cleanOrderNo}] ${itemSummary}`
            : `[확정전표] ${itemSummary}`,
          proposalState,
          quoteMode: 'subscription',
          saleType: 'subscription',
          performanceAmount: principal,
          generalProductTotal: 0,
          subscriptionPrincipal: principal,
          purchasedModels: [
            {
              id: `man-sub-${Date.now()}`,
              category: cat,
              modelName: code || cat,
              quantity: 1,
              saleType: 'subscription',
              principalAmount: principal,
            },
          ],
          saveMode: 'append',
          isConfirmedSlip: true,
          slipDeliveryStatus,
          outboundType,
          logisticsConfirmed: isSelfOutbound,
        });

        await syncCustomerToGas('update', savedRes.savedCustomer);
        resetManualForm();
        setShowManualSlipForm(false);
        onManualSlipSaved?.(savedRes.savedCustomer, cleanOrderNo);
      } else {
        const actual = Math.max(0, Math.round(Number(manualAmount) || 0));
        const proposalState = buildProposalStateFromHisisSlip({
          mode: 'general',
          generalItems: [
            {
              category: cat,
              modelName: code,
              productName: cat,
              quantity: 1,
              receiptAmount: actual,
              discountAmount: 0,
              actualPrice: actual,
            },
          ],
        });
        const itemSummary = code ? `${cat}(${code})` : cat;
        const savedRes = await saveCustomerQuote({
          targetCustomerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          items: itemSummary,
          paidAmount: actual,
          netAmount: actual,
          expectedBenefit: cleanOrderNo
            ? `전표 ${cleanOrderNo} 수기등록`
            : '전표 수기등록',
          contractDate: cleanContractDate,
          deliveryDate: resolvedDeliveryDate,
          status: isSelfOutbound ? '배송완료' : '계약완료',
          memo: '',
          orderNo: cleanOrderNo,
          quoteTitle: cleanOrderNo
            ? `[전표 ${cleanOrderNo}] ${itemSummary}`
            : `[확정전표] ${itemSummary}`,
          proposalState,
          quoteMode: 'general',
          saleType: 'general',
          performanceAmount: actual,
          generalProductTotal: actual,
          subscriptionPrincipal: 0,
          purchasedModels: [
            {
              id: `man-gen-${Date.now()}`,
              category: cat,
              modelName: code || cat,
              quantity: 1,
              saleType: 'general',
              principalAmount: actual,
            },
          ],
          saveMode: 'append',
          isConfirmedSlip: true,
          slipDeliveryStatus,
          outboundType,
          logisticsConfirmed: isSelfOutbound,
        });

        await syncCustomerToGas('update', savedRes.savedCustomer);
        resetManualForm();
        setShowManualSlipForm(false);
        onManualSlipSaved?.(savedRes.savedCustomer, cleanOrderNo);
      }
    } catch (err: any) {
      setManualError(err?.message || '수기 전표 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title={`${customer.name} 고객님 상세 카드 & 전표·견적 보관함`}
      badge={
        customer.status === '계약완료' || customer.status === '발송완료'
          ? '🚚 배송'
          : customer.status === '배송완료'
          ? '✅ 배송완료'
          : customer.status
      }
      icon={<UserCheck className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />}
      maxWidthClass="max-w-2xl"
      bodyClassName="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 bg-[#F2F4F6] dark:bg-[#0B1120]"
      closeOnBackdrop={true}
    >
      {/* 상단 원클릭 재구매/전표 추가 & 수기 등록 & 새 견적 작성 바 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {onAddSlipForCustomer && (
          <button
            type="button"
            id="crm-detail-add-slip-btn"
            onClick={() => onAddSlipForCustomer(customer)}
            className="w-full min-w-0 py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span className="truncate">이 고객에 전표 사진 추가</span>
          </button>
        )}

        <button
          type="button"
          id="crm-detail-manual-slip-btn"
          onClick={() => {
            setManualError(null);
            setShowManualSlipForm((prev) => !prev);
          }}
          className={`w-full min-w-0 py-2.5 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer ${
            showManualSlipForm
              ? 'bg-[#191F28] dark:bg-blue-500 text-white border-[#191F28] dark:border-blue-400'
              : 'bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/30'
          }`}
        >
          <FilePlus2 className="w-4 h-4 shrink-0" />
          <span className="truncate">🧾 전표번호 · 추가구매 수기 등록</span>
        </button>

        <button
          type="button"
          id="crm-detail-new-quote-btn"
          onClick={() => {
            onClose();
            onOpenQuote(customer);
          }}
          className="w-full min-w-0 py-2.5 px-3 rounded-xl bg-white dark:bg-[#131C2E] hover:bg-[#F8FAFC] dark:hover:bg-slate-800 text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-[#E60012] dark:text-rose-400 shrink-0" />
          <span className="truncate">이 고객 새 견적 작성</span>
        </button>
      </div>

      {/* 사진 없이 1초 만에 추가하는 수기 전표 미니 폼 (기존 전표 덮어쓰기 0% · 항상 새 전표로 누적 합산) */}
      {showManualSlipForm && (
        <form
          id="crm-manual-slip-form"
          onSubmit={handleSaveManualSlip}
          className="rounded-2xl p-3 sm:p-3.5 bg-white dark:bg-[#131C2E] border-2 border-[#1B64DA]/40 dark:border-blue-500/40 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300 text-[11px] font-black shrink-0">
                추가구매 보호
              </span>
              <h4 className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                전표번호 · 추가구매 수기 등록 (기존 전표 유지 + 자동 합산)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowManualSlipForm(false)}
              className="p-1 rounded-lg text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white cursor-pointer shrink-0"
              aria-label="수기 전표 폼 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                전표번호 (YYYYMMDD-NNNN)
              </label>
              <input
                type="text"
                value={manualOrderNo}
                onChange={(e) => {
                  setManualOrderNo(e.target.value);
                  setManualError(null);
                }}
                placeholder="예: 20261127-0004"
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-white focus:outline-none focus:border-[#1B64DA]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                구매유형
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F2F4F6] dark:bg-slate-900 border border-[#E5E8EB] dark:border-slate-700">
                {(
                  [
                    { id: 'general' as const, label: '일반' },
                    { id: 'sub36' as const, label: '구독 36M' },
                    { id: 'sub60' as const, label: '구독 60M' },
                  ] as const
                ).map((opt) => {
                  const active = manualSaleMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setManualSaleMode(opt.id);
                        setManualMonthlyOverride(null);
                      }}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-white dark:bg-[#1B64DA] text-[#1B64DA] dark:text-white shadow-2xs'
                          : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                품목명 (또는 품목+모델코드)
              </label>
              <input
                type="text"
                value={manualCategory}
                onChange={(e) => {
                  setManualCategory(e.target.value);
                  setManualError(null);
                }}
                placeholder="예: 밥솥, 세탁기, 식기세척기"
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-bold text-[#191F28] dark:text-white focus:outline-none focus:border-[#1B64DA]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                모델코드 (선택 · 자동 카테고리 추론)
              </label>
              <input
                type="text"
                value={manualModelCode}
                onChange={(e) => {
                  setManualModelCode(e.target.value);
                  setManualError(null);
                }}
                placeholder="예: CRP-CHP1010FD, WF24CB8650BW"
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-white focus:outline-none focus:border-[#1B64DA]"
              />
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              activeSubPeriod ? 'sm:grid-cols-2' : ''
            } gap-2`}
          >
            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                {activeSubPeriod
                  ? `구독 접수원금 (${activeSubPeriod}개월 실적 기준)`
                  : '실구매가 (원)'}
              </label>
              <FormattedMoneyInput
                value={manualAmount}
                onValueChange={(v) => setManualAmount(v)}
                placeholder={activeSubPeriod ? '예: 1,800,000' : '예: 450,000'}
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-extrabold text-right text-[#191F28] dark:text-white focus:outline-none focus:border-[#1B64DA]"
              />
            </div>

            {activeSubPeriod && (
              <div>
                <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  월 구독료 (원금÷{activeSubPeriod} 자동계산 · 수정가능)
                </label>
                <FormattedMoneyInput
                  value={effectiveMonthlyFee}
                  onValueChange={(v) => setManualMonthlyOverride(v)}
                  placeholder="월 구독료"
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#BFDBFE] dark:border-blue-500/40 bg-[#EFF6FF]/60 dark:bg-blue-950/30 text-base sm:text-xs font-mono font-extrabold text-right text-[#1B64DA] dark:text-blue-300 focus:outline-none focus:border-[#1B64DA]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                계약일 (접수일)
              </label>
              <input
                type="date"
                value={manualContractDate}
                onChange={(e) => setManualContractDate(e.target.value)}
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                배달일자 {manualOutbound === 'self' ? '(미입력 시 계약일)' : ''}
              </label>
              <input
                type="date"
                value={manualDeliveryDate}
                onChange={(e) => setManualDeliveryDate(e.target.value)}
                className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                출고구분 (전표별 독립 상태)
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F2F4F6] dark:bg-slate-900 border border-[#E5E8EB] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setManualOutbound('logistics')}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    manualOutbound === 'logistics'
                      ? 'bg-white dark:bg-[#1B64DA] text-[#1B64DA] dark:text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-400'
                  }`}
                >
                  <Truck className="w-3 h-3 shrink-0" />
                  <span>배송(물류)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualOutbound('self')}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    manualOutbound === 'self'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>자송(즉시완료)</span>
                </button>
              </div>
            </div>
          </div>

          {(manualError || duplicateOrderQuote) && (
            <div className="rounded-xl px-3 py-2 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-[11.5px] font-bold text-[#E60012] dark:text-rose-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {manualError ||
                  `전표번호 [${manualOrderNo.trim()}]는 이미 이 고객 카드에 등록되어 있습니다. 기존 전표 번호나 배달일 변경은 아래 타임라인의 [✏️ 전표수정]을 이용해 주세요.`}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-semibold text-[#4E5968] dark:text-slate-400">
              기존 전표는 그대로 보존되며, 미배송 전표가 남아 있으면 🚚 배송 D-Day가 유지됩니다.
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => {
                  resetManualForm();
                  setShowManualSlipForm(false);
                }}
                className="px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 text-xs font-bold text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                type="submit"
                id="crm-manual-slip-submit-btn"
                disabled={isSavingManual || Boolean(duplicateOrderQuote)}
                className="px-4 py-2 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isSavingManual ? '등록 중...' : '새 확정 전표로 추가 등록'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      <CustomerCard
        customer={customer}
        onStatusChange={onStatusChange}
        onMemoChange={onMemoChange}
        onFieldChange={onFieldChange}
        onDeleteQuoteRecord={onDeleteQuoteRecord}
        onApplyQuoteAsPrimary={onApplyQuoteAsPrimary}
        onToggleSlipDeliveryStatus={onToggleSlipDeliveryStatus}
        onUpdateQuoteSlip={onUpdateQuoteSlip}
        onConfirmDraftQuote={onConfirmDraftQuote}
        onLoadQuoteRecord={(c, q) => {
          onClose();
          onLoadQuoteRecord(c, q);
        }}
        onDelete={(id) => {
          onClose();
          onDelete(id);
        }}
        onOpenSMS={(c) => {
          onOpenSMS(c);
        }}
        onOpenQuote={(c) => {
          onClose();
          onOpenQuote(c);
        }}
      />
    </FlagshipModalShell>
  );
};
