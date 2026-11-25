import React, { useEffect, useState } from 'react';
import {
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Coins,
  Copy,
  Edit3,
  FileSpreadsheet,
  FolderKanban,
  Gift,
  Link2,
  MailOpen,
  MessageSquare,
  Phone,
  PhoneCall,
  Save,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CustomerFreedCounts,
  CustomerItem,
  CustomerSaleType,
  CustomerStatus,
  MAX_QUOTES_PER_CUSTOMER,
  QuoteRecord,
  SlipDeliveryStatus,
} from '../types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getDeliveryDDay,
  getFollowUpInfo,
  getFridayDateStr,
  getOffsetDateStr,
  getTodayStr,
  isUrgentCustomer,
} from '../utils/date';
import { safeCopyText } from '../../utils/mobileQaRuntime';
import { loadConsultantProfile } from '../../utils/shareQuoteCodec';
import { ShareQuoteLinkModal } from '../../components/ShareQuoteLinkModal';
import {
  calculateFreedIncentiveDetail,
  parsePurchasedModelsFromItemsText,
  resolveCustomerPerformanceProfile,
} from '../utils/settlementEngine';
import {
  normalizeOrderNoKey,
  QuoteSlipInlinePatch,
} from '../services/gasApi';
import { FormattedMoneyInput } from '../../components/FormattedMoneyInput';

interface CustomerCardProps {
  customer: CustomerItem;
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
  onLoadQuoteRecord: (customer: CustomerItem, quote: QuoteRecord) => void;
  onDelete: (id: string) => void;
  onOpenSMS: (customer: CustomerItem) => void;
  onOpenQuote: (customer: CustomerItem) => void;
}

const STATUS_STYLES: Record<
  CustomerStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  '신규/미발송': {
    bg: 'bg-[#FFF1F2] dark:bg-rose-500/15',
    text: 'text-[#E60012] dark:text-rose-300',
    border: 'border-[#FECDD3] dark:border-rose-500/30',
    dot: 'bg-[#E60012]',
  },
  발송완료: {
    bg: 'bg-[#EFF6FF] dark:bg-blue-500/15',
    text: 'text-[#1B64DA] dark:text-blue-300',
    border: 'border-[#BFDBFE] dark:border-blue-500/30',
    dot: 'bg-[#1B64DA]',
  },
  상담진행중: {
    bg: 'bg-[#EFF6FF] dark:bg-blue-500/15',
    text: 'text-[#1B64DA] dark:text-blue-300',
    border: 'border-[#BFDBFE] dark:border-blue-500/30',
    dot: 'bg-[#1B64DA]',
  },
  '미구매/고민중': {
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  계약완료: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-[#059669] dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    dot: 'bg-[#059669]',
  },
  배송완료: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-500/30',
    dot: 'bg-emerald-700',
  },
  '취소/보류': {
    bg: 'bg-[#F2F4F6] dark:bg-slate-800',
    text: 'text-[#4E5968] dark:text-slate-300',
    border: 'border-[#D1D6DB] dark:border-slate-700',
    dot: 'bg-[#8B95A1]',
  },
};

const ALL_STATUSES: CustomerStatus[] = [
  '신규/미발송',
  '발송완료',
  '상담진행중',
  '미구매/고민중',
  '계약완료',
  '배송완료',
  '취소/보류',
];

const PLAN_BOOK_ICONS = ['📘', '📗', '📙', '📕', '📒', '📓'];

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onStatusChange,
  onMemoChange,
  onFieldChange,
  onDeleteQuoteRecord,
  onApplyQuoteAsPrimary,
  onToggleSlipDeliveryStatus,
  onUpdateQuoteSlip,
  onConfirmDraftQuote,
  onLoadQuoteRecord,
  onDelete,
  onOpenSMS,
  onOpenQuote,
}) => {
  const perf = resolveCustomerPerformanceProfile(customer);
  const fallbackValidQuote = (customer.quotes || []).find(
    (q) => (Number(q.netAmount) || 0) > 0 || (Number(q.paidAmount) || 0) > 0
  );
  const effectivePaidAmount =
    (Number(customer.paidAmount) || 0) > 0
      ? customer.paidAmount
      : fallbackValidQuote?.paidAmount ?? customer.paidAmount ?? 0;
  const effectiveNetAmount =
    (Number(customer.netAmount) || 0) > 0
      ? customer.netAmount
      : fallbackValidQuote?.netAmount ?? customer.netAmount ?? 0;

  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(customer.memo);
  const [showDetailFields, setShowDetailFields] = useState(false);
  const [showQuotesDrawer, setShowQuotesDrawer] = useState<boolean>(() =>
    Boolean(customer.quotes && customer.quotes.length > 0)
  );
  const [shareModalQuote, setShareModalQuote] = useState<QuoteRecord | null>(
    null
  );

  // 인라인 전표 수정 상태
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [slipOrderNoDraft, setSlipOrderNoDraft] = useState('');
  const [slipContractDateDraft, setSlipContractDateDraft] = useState('');
  const [slipDeliveryDateDraft, setSlipDeliveryDateDraft] = useState('');
  const [slipDeliveryStatusDraft, setSlipDeliveryStatusDraft] =
    useState<SlipDeliveryStatus>('배송대기');
  const [slipItemSummaryDraft, setSlipItemSummaryDraft] = useState('');
  const [slipEditError, setSlipEditError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState(customer.name || '');
  const [phoneDraft, setPhoneDraft] = useState(customer.phone || '');
  const [itemsDraft, setItemsDraft] = useState(customer.items || '');
  const [saleTypeDraft, setSaleTypeDraft] = useState<CustomerSaleType>(
    perf.saleType
  );
  const [perfAmountDraft, setPerfAmountDraft] = useState(
    perf.performanceAmount > 0 ? String(perf.performanceAmount) : ''
  );
  const [netAmountDraft, setNetAmountDraft] = useState(
    effectiveNetAmount > 0 ? String(effectiveNetAmount) : ''
  );
  const [contractDateDraft, setContractDateDraft] = useState(
    perf.contractDateStr || ''
  );
  const [orderNoDraft, setOrderNoDraft] = useState(customer.orderNo || '');
  const [giftItemsDraft, setGiftItemsDraft] = useState(
    customer.giftItems || ''
  );
  const [deliveryDateDraft, setDeliveryDateDraft] = useState(
    customer.deliveryDate || ''
  );
  const [followUpDateDraft, setFollowUpDateDraft] = useState(
    customer.followUpDate || ''
  );
  const [freedDraft, setFreedDraft] = useState<CustomerFreedCounts>(
    perf.freedCounts
  );

  useEffect(() => {
    setMemoDraft(customer.memo || '');
    setNameDraft(customer.name || '');
    setPhoneDraft(customer.phone || '');
    setItemsDraft(customer.items || '');
    setSaleTypeDraft(perf.saleType);
    setPerfAmountDraft(
      perf.performanceAmount > 0 ? String(perf.performanceAmount) : ''
    );
    setNetAmountDraft(
      effectiveNetAmount > 0 ? String(effectiveNetAmount) : ''
    );
    setContractDateDraft(perf.contractDateStr || '');
    setOrderNoDraft(customer.orderNo || '');
    setGiftItemsDraft(customer.giftItems || '');
    setDeliveryDateDraft(customer.deliveryDate || '');
    setFollowUpDateDraft(customer.followUpDate || '');
    setFreedDraft(perf.freedCounts);
  }, [
    customer.id,
    customer.updatedAtMs,
    customer.name,
    customer.phone,
    customer.memo,
    customer.items,
    customer.orderNo,
    customer.giftItems,
    customer.deliveryDate,
    customer.followUpDate,
    customer.paidAmount,
    customer.netAmount,
    perf.saleType,
    perf.performanceAmount,
    perf.contractDateStr,
    effectiveNetAmount,
  ]);

  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quickSaveBadge, setQuickSaveBadge] = useState<string | null>(null);

  const triggerQuickSaveBadge = (key: string) => {
    setQuickSaveBadge(key);
    setTimeout(() => {
      setQuickSaveBadge((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const handleSaveContractDateOnly = () => {
    const clean = contractDateDraft.trim();
    onFieldChange(customer.id, { contractDate: clean });
    triggerQuickSaveBadge("contractDate");
  };

  const handleSaveDeliveryDateOnly = (overrideVal?: string) => {
    const clean = (overrideVal !== undefined ? overrideVal : deliveryDateDraft).trim();
    if (overrideVal !== undefined) {
      setDeliveryDateDraft(clean);
    }
    onFieldChange(customer.id, { deliveryDate: clean });
    triggerQuickSaveBadge("deliveryDate");
  };

  const dday = getDeliveryDDay(customer.deliveryDate, customer.status);
  const isContractOrDelivered = customer.status === '계약완료' || customer.status === '배송완료';
  const followUp = getFollowUpInfo(customer);
  const style = STATUS_STYLES[customer.status] || STATUS_STYLES['신규/미발송'];
  const urgent = isUrgentCustomer(customer);
  const quotes = Array.isArray(customer.quotes) ? customer.quotes : [];
  const confirmedSlips = quotes.filter((q) => Boolean(q?.isConfirmedSlip));
  const draftQuotes = quotes.filter((q) => !q?.isConfirmedSlip);

  const allDisplayOrderNos = Array.from(
    new Set(
      [
        ...confirmedSlips.map((s) => (s.orderNo || '').trim()),
        (customer.orderNo || '').trim(),
      ].filter(Boolean)
    )
  );

  const openInlineSlipEditor = (q: QuoteRecord) => {
    if (editingQuoteId === q.id) {
      setEditingQuoteId(null);
      setSlipEditError(null);
      return;
    }
    setEditingQuoteId(q.id);
    setSlipOrderNoDraft(q.orderNo || '');
    setSlipContractDateDraft(
      q.contractDate ||
        customer.contractDate ||
        q.createdAt?.slice(0, 10) ||
        getTodayStr()
    );
    setSlipDeliveryDateDraft(q.deliveryDate || '');
    setSlipDeliveryStatusDraft(q.deliveryStatus || '배송대기');
    setSlipItemSummaryDraft(q.itemSummary || '');
    setSlipEditError(null);
  };

  const handleSaveInlineSlipEdit = (
    q: QuoteRecord,
    promoteToConfirmedSlip: boolean
  ) => {
    if (!onUpdateQuoteSlip) return;
    const cleanOrderKey = normalizeOrderNoKey(slipOrderNoDraft);
    if (cleanOrderKey) {
      const hasCollision = quotes.some(
        (other) =>
          other.id !== q.id &&
          normalizeOrderNoKey(other.orderNo) === cleanOrderKey
      );
      if (hasCollision) {
        setSlipEditError(
          `이미 이 고객의 다른 전표에 동일한 전표번호(${slipOrderNoDraft.trim()})가 등록되어 있습니다.`
        );
        return;
      }
    }
    onUpdateQuoteSlip(customer.id, q.id, {
      orderNo: slipOrderNoDraft.trim(),
      contractDate: slipContractDateDraft.trim(),
      deliveryDate: slipDeliveryDateDraft.trim(),
      deliveryStatus: slipDeliveryStatusDraft,
      itemSummary: slipItemSummaryDraft.trim(),
      promoteToConfirmedSlip,
    });
    setEditingQuoteId(null);
    setSlipEditError(null);
  };

  const handleSaveMemo = () => {
    onMemoChange(customer.id, memoDraft);
    setIsEditingMemo(false);
  };

  const adjustFreedDraft = (key: keyof CustomerFreedCounts, delta: number) => {
    setFreedDraft((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  const handleSaveExtraFields = () => {
    const rawPerfDigits = String(perfAmountDraft ?? '').replace(/\D/g, '');
    const nextPerfNum =
      rawPerfDigits === '' ? 0 : Number(rawPerfDigits) || 0;
    const rawNetDigits = String(netAmountDraft ?? '').replace(/\D/g, '');
    const nextNetNum =
      rawNetDigits === '' ? nextPerfNum : Number(rawNetDigits) || 0;
    const nextPaidNum =
      (Number(customer.paidAmount) || 0) > 0 && quotes.length > 0
        ? customer.paidAmount
        : nextPerfNum > 0
        ? nextPerfNum
        : nextNetNum;

    const cleanName = nameDraft.trim() || customer.name;
    const cleanPhone = phoneDraft.trim();
    const trimmedItems = itemsDraft.trim();
    const shouldReParseModels =
      trimmedItems !== (customer.items || '').trim() ||
      saleTypeDraft !== perf.saleType;
    const perfChanged =
      nextPerfNum !== perf.performanceAmount || saleTypeDraft !== perf.saleType;

    onFieldChange(customer.id, {
      name: cleanName,
      phone: cleanPhone,
      items: trimmedItems,
      saleType: saleTypeDraft,
      performanceAmount: nextPerfNum,
      paidAmount: nextPaidNum,
      netAmount: nextNetNum,
      generalProductTotal: perfChanged
        ? saleTypeDraft === 'subscription'
          ? 0
          : nextPerfNum
        : customer.generalProductTotal,
      subscriptionPrincipal: perfChanged
        ? saleTypeDraft === 'subscription'
          ? nextPerfNum
          : 0
        : customer.subscriptionPrincipal,
      contractDate: contractDateDraft.trim(),
      orderNo: orderNoDraft.trim(),
      giftItems: giftItemsDraft.trim(),
      deliveryDate: deliveryDateDraft.trim(),
      followUpDate: followUpDateDraft.trim(),
      freedCounts: freedDraft,
      ...(shouldReParseModels
        ? {
            purchasedModels: parsePurchasedModelsFromItemsText(
              trimmedItems,
              saleTypeDraft === 'subscription' ? 'subscription' : 'general'
            ),
          }
        : {}),
    });
    triggerQuickSaveBadge("allFields");
    setShowDetailFields(false);
  };

  const handleCopyQuoteToClipboard = async (q: QuoteRecord) => {
    const extraPlans =
      Array.isArray(q.planSummaries) && q.planSummaries.length > 0
        ? q.planSummaries.filter((ps) => Boolean(ps && ps.itemSummary))
        : q.plan2Summary && q.plan2Summary.itemSummary
        ? [q.plan2Summary]
        : [];
    const totalPlans = extraPlans.length + 1;
    const rangeLabel = Array.from(
      { length: totalPlans },
      (_, i) => `${i + 1}안`
    ).join(' vs ');

    let text = '';
    const storeDisplayName =
      (loadConsultantProfile().storeName || '').trim() ||
      '롯데하이마트 경기광주점';
    const fmtSubNetMonthly = (amt: number) =>
      amt <= 0
        ? amt < 0
          ? `월 0원 (매월 +${formatCurrency(Math.abs(amt))}원 혜택)`
          : '월 0원'
        : `월 ${formatCurrency(amt)}원`;

    if (extraPlans.length > 0) {
      if (q.quoteMode === 'subscription') {
        const blocks = [
          `📘 [구독 1안] ${q.itemSummary || '맞춤 구독 가전 1안'}\n- 월 기준 구독료: 월 ${formatCurrency(q.paidAmount)}원\n- 최종 월 체감가: ${fmtSubNetMonthly(q.netAmount)}${
            q.benefit ? `\n- 혜택요약: ${q.benefit}` : ''
          }`,
          ...extraPlans.map((ps, idx) => {
            const pNum = idx + 2;
            const icon = PLAN_BOOK_ICONS[(pNum - 1) % PLAN_BOOK_ICONS.length];
            return `${icon} [구독 ${pNum}안] ${ps.itemSummary}\n- 월 기준 구독료: 월 ${formatCurrency(ps.paidAmount)}원\n- 최종 월 체감가: ${fmtSubNetMonthly(ps.netAmount)}${
              ps.benefit ? `\n- 혜택요약: ${ps.benefit}` : ''
            }`;
          }),
        ];
        text = `[${storeDisplayName} 구독 ${rangeLabel} 비교 견적 안내]
👤 고객명: ${customer.name} 고객님

━━━━━━━━━━━━━━━━━━
${blocks.join('\n\n')}
━━━━━━━━━━━━━━━━━━
${totalPlans}가지 구독 플랜 중 예산과 구성에 맞춰 편하게 선택해 주세요! 😊`;
      } else if (q.quoteMode === 'hybrid') {
        const blocks = [
          `📘 [혼합 1안] ${q.itemSummary || '일반+구독 혼합 1안'}\n- 일반 일시불 실결제가: ${formatCurrency(q.paidAmount)}원 (최종 체감가: ${formatCurrency(q.netAmount)}원)${
            q.benefit ? `\n- 상세 구성: ${q.benefit}` : ''
          }`,
          ...extraPlans.map((ps, idx) => {
            const pNum = idx + 2;
            const icon = PLAN_BOOK_ICONS[(pNum - 1) % PLAN_BOOK_ICONS.length];
            return `${icon} [혼합 ${pNum}안] ${ps.itemSummary}\n- 일반 일시불 실결제가: ${formatCurrency(ps.paidAmount)}원 (최종 체감가: ${formatCurrency(ps.netAmount)}원)${
              ps.benefit ? `\n- 상세 구성: ${ps.benefit}` : ''
            }`;
          }),
        ];
        text = `[${storeDisplayName} 혼합 ${rangeLabel} 비교 견적 안내]
👤 고객명: ${customer.name} 고객님

━━━━━━━━━━━━━━━━━━
${blocks.join('\n\n')}
━━━━━━━━━━━━━━━━━━
${totalPlans}가지 플랜 중 예산과 구성에 맞춰 편하게 선택해 주세요! 😊`;
      } else {
        const blocks = [
          `📘 [1안] ${q.itemSummary || '맞춤 가전 1안'}\n- 실결제가: ${formatCurrency(q.paidAmount)}원\n- 최종 체감가: ${formatCurrency(q.netAmount)}원${
            q.benefit ? `\n- 혜택요약: ${q.benefit}` : ''
          }`,
          ...extraPlans.map((ps, idx) => {
            const pNum = idx + 2;
            const icon = PLAN_BOOK_ICONS[(pNum - 1) % PLAN_BOOK_ICONS.length];
            return `${icon} [${pNum}안] ${ps.itemSummary}\n- 실결제가: ${formatCurrency(ps.paidAmount)}원\n- 최종 체감가: ${formatCurrency(ps.netAmount)}원${
              ps.benefit ? `\n- 혜택요약: ${ps.benefit}` : ''
            }`;
          }),
        ];
        text = `[${storeDisplayName} ${rangeLabel} 비교 견적 안내]
👤 고객명: ${customer.name} 고객님

━━━━━━━━━━━━━━━━━━
${blocks.join('\n\n')}
━━━━━━━━━━━━━━━━━━
${totalPlans}가지 플랜 중 예산과 구성에 맞춰 편하게 선택해 주세요! 😊`;
      }
    } else if (q.quoteMode === 'subscription') {
      text = `[${storeDisplayName} 맞춤 구독 견적 안내]
👤 고객명: ${customer.name} 고객님
📌 견적명: ${q.title}
📦 구독모델: ${q.itemSummary}
💳 월 기준 구독료: 월 ${formatCurrency(q.paidAmount)}원
🎁 혜택요약: ${q.benefit || '제휴카드 및 구독프리드 혜택'}
✨ 최종 월 체감가: ${fmtSubNetMonthly(q.netAmount)}`;
    } else if (q.quoteMode === 'hybrid') {
      text = `[${storeDisplayName} 맞춤 일반+구독 혼합 견적 안내]
👤 고객명: ${customer.name} 고객님
📌 견적명: ${q.title}
📦 상담모델: ${q.itemSummary}
💳 일반 일시불 결제예정가: ${formatCurrency(q.paidAmount)}원 (체감가: ${formatCurrency(q.netAmount)}원)
🎁 통합 혜택 및 구독 상세: ${q.benefit || '일반+구독 결합 혜택'}`;
    } else {
      text = `[${storeDisplayName} 맞춤 견적 안내]
👤 고객명: ${customer.name} 고객님
📌 견적명: ${q.title}
📦 상담모델: ${q.itemSummary}
💳 결제예정가: ${formatCurrency(q.paidAmount)}원
🎁 혜택요약: ${q.benefit || '매장 특별 혜택'}
✨ 최종체감가: ${formatCurrency(q.netAmount)}원`;
    }

    if (await safeCopyText(text)) {
      setCopiedQuoteId(q.id);
      setTimeout(() => setCopiedQuoteId(null), 2000);
    }
  };

  const draftFreedPreview = calculateFreedIncentiveDetail(freedDraft);

  return (
    <div
      className={`group bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 rounded-[20px] border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        urgent
          ? 'border-[#FECDD3] dark:border-rose-500/40 shadow-md ring-1 ring-[#FECDD3]/60'
          : 'border-[#E5E8EB] dark:border-slate-800 shadow-xs hover:shadow-md hover:border-[#D1D6DB] dark:hover:border-slate-700'
      }`}
    >
      {/* 상단 영역 */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* 1행: 계약일/다중 전표번호 & 배송 D-Day + 상태 드롭다운 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] font-semibold font-mono tabular-nums text-[#4E5968] dark:text-slate-400">
              계약(총판) {perf.contractDateStr || customer.regDate}
            </span>
            {allDisplayOrderNos.map((oNo) => (
              <span
                key={oNo}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-bold font-mono tabular-nums bg-[#F2F4F6] dark:bg-slate-800 text-[#191F28] dark:text-slate-200 border border-[#E5E8EB] dark:border-slate-700"
              >
                <FileSpreadsheet className="w-3 h-3 text-[#4E5968] dark:text-slate-400 shrink-0" />
                {oNo}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold border whitespace-nowrap ${dday.badgeClass}`}
            >
              {dday.label}
            </span>

            <div className="relative">
              <select
                value={customer.status}
                onChange={(e) =>
                  onStatusChange(customer.id, e.target.value as CustomerStatus)
                }
                aria-label="고객 상태 변경"
                className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-base sm:text-xs font-extrabold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1B64DA] ${style.bg} ${style.text} ${style.border}`}
              >
                {(confirmedSlips.length > 0
                  ? (['계약완료', '배송완료', '취소/보류'] as CustomerStatus[])
                  : ALL_STATUSES
                ).map((st) => (
                  <option
                    key={st}
                    value={st}
                    className="bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                  >
                    {st}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] opacity-70">
                ▼
              </span>
            </div>
          </div>
        </div>

        {/* 2행: 고객명 + 연락처 + 견적보관함/재연락 뱃지 */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-[#191F28] dark:text-slate-50 tracking-tight">
                {customer.name}{' '}
                <span className="text-xs font-semibold text-[#4E5968] dark:text-slate-400">
                  고객님
                </span>
              </h3>
              {quotes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowQuotesDrawer(!showQuotesDrawer)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/25 transition cursor-pointer whitespace-nowrap"
                >
                  <FolderKanban className="w-3 h-3 shrink-0" />
                  전표·견적 ({quotes.length}/{MAX_QUOTES_PER_CUSTOMER})
                </button>
              )}
              {followUp.hasFollowUp && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold border whitespace-nowrap ${
                    followUp.isDueOrOverdue
                      ? 'bg-[#E60012] text-white border-[#E60012] animate-pulse'
                      : 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30'
                  }`}
                >
                  {followUp.label}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold font-mono tabular-nums text-[#4E5968] dark:text-slate-400 mt-0.5">
              {customer.phone || '연락처 미입력'}
            </p>
          </div>

          {customer.deliveryDate && (
            <div className="flex items-center gap-1 text-xs font-bold font-mono tabular-nums text-[#4E5968] dark:text-slate-300 bg-[#F2F4F6] dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-[#E5E8EB] dark:border-slate-700 shrink-0 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-400 shrink-0" />
              <span>{isContractOrDelivered ? `실판(배송) ${customer.deliveryDate}` : `희망수령 ${customer.deliveryDate}`}</span>
            </div>
          )}
        </div>

        {/* 상단 직관적 일정 변경 바: 총판(계약일) & 실판(배송예정일) + 명시적 저장 아이콘 버튼 */}
        <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 bg-white dark:bg-[#131C2E] rounded-lg p-2 border border-emerald-200 dark:border-emerald-500/30">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11.5px] font-extrabold text-[#059669] dark:text-emerald-300 flex items-center gap-1">
                📅 총판 기준일 (계약일)
              </span>
              {quickSaveBadge === "contractDate" && (
                <span className="text-[11.5px] font-black text-[#059669] dark:text-emerald-400">
                  ✓ 저장완료
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={contractDateDraft}
                onChange={(e) => setContractDateDraft(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-base sm:text-xs font-mono font-bold rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-[#191F28] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveContractDateOnly}
                title="계약일(총판) 저장"
                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-black inline-flex items-center gap-1 shrink-0 transition cursor-pointer ${
                  contractDateDraft.trim() !== (perf.contractDateStr || "")
                    ? "bg-[#059669] hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-300"
                    : "bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                }`}
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>저장</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 bg-white dark:bg-[#131C2E] rounded-lg p-2 border border-[#BFDBFE] dark:border-blue-500/30">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300 flex items-center gap-1">
                🚚 실판 기준일 (배송예정일)
              </span>
              <div className="flex items-center gap-1">
                {quickSaveBadge === "deliveryDate" && (
                  <span className="text-[11.5px] font-black text-[#1B64DA] dark:text-blue-400">
                    ✓ 저장완료
                  </span>
                )}
                {deliveryDateDraft && (
                  <button
                    type="button"
                    onClick={() => handleSaveDeliveryDateOnly("")}
                    className="text-[11.5px] font-bold px-1.5 py-0.5 rounded bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 text-[#4E5968] dark:text-slate-400 hover:text-[#E60012] dark:hover:text-rose-300 cursor-pointer"
                    title="배송일 미정으로 초기화 후 즉시 저장"
                  >
                    미정초기화
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={deliveryDateDraft}
                onChange={(e) => setDeliveryDateDraft(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-base sm:text-xs font-mono font-bold rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-[#191F28] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
              <button
                type="button"
                onClick={() => handleSaveDeliveryDateOnly()}
                title="배송예정일(실판) 저장"
                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-black inline-flex items-center gap-1 shrink-0 transition cursor-pointer ${
                  deliveryDateDraft.trim() !== (customer.deliveryDate || "")
                    ? "bg-[#1B64DA] hover:bg-[#1552B5] text-white shadow-xs ring-2 ring-blue-300"
                    : "bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30"
                }`}
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>저장</span>
              </button>
            </div>
          </div>
        </div>

        {/* 매장 실전 원터치 체크바: 계약완료/배송완료 고객에게만 물류확정 & 사은품지급 노출 */}
        {isContractOrDelivered && (
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() =>
              onFieldChange(customer.id, {
                logisticsConfirmed: !customer.logisticsConfirmed,
              })
            }
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              customer.logisticsConfirmed
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span>
              {customer.logisticsConfirmed ? '물류/배정 완료' : '물류 미확정'}
            </span>
            {customer.logisticsConfirmed && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onFieldChange(customer.id, {
                giftSent: !customer.giftSent,
              })
            }
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              customer.giftSent
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                : customer.giftItems
                ? 'bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border-[#FECDD3] dark:border-rose-500/30 hover:bg-rose-100/60'
                : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#8B95A1] dark:text-slate-400 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
            }`}
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {customer.giftSent
                ? '사은품 지급완료'
                : customer.giftItems
                ? `미지급: ${customer.giftItems}`
                : '사은품 없음'}
            </span>
            {customer.giftSent && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
            )}
          </button>
        </div>
        )}

        {/* 3행: 관심품목/구매 모델 (대표 견적) */}
        <div className="bg-[#F8FAFC] dark:bg-slate-900/70 rounded-xl p-3 border border-[#E5E8EB] dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 whitespace-nowrap truncate">
              대표 구매 품목 / 모델명
              <span className="hidden sm:inline"> (모델별 수당 자동 매칭)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (!showDetailFields) {
                  setItemsDraft(customer.items || '');
                  setSaleTypeDraft(perf.saleType);
                  setPerfAmountDraft(String(perf.performanceAmount || ''));
                  setOrderNoDraft(customer.orderNo || '');
                  setGiftItemsDraft(customer.giftItems || '');
                  setFollowUpDateDraft(customer.followUpDate || '');
                  setFreedDraft(perf.freedCounts);
                }
                setShowDetailFields(!showDetailFields);
              }}
              className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="whitespace-nowrap">실적·프리드·일정 수정</span>
              {showDetailFields ? (
                <ChevronUp className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0" />
              )}
            </button>
          </div>
          <p className="text-sm font-bold text-[#191F28] dark:text-slate-100 leading-snug break-keep">
            {customer.items || '품목 내역 없음'}
          </p>
        </div>

        {/* 고객별 다중 전표 · 견적 보관함 타임라인 (최대 30개) */}
        {quotes.length > 0 && (
          <div className="border border-[#BFDBFE] dark:border-blue-500/30 bg-[#EFF6FF]/60 dark:bg-blue-500/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQuotesDrawer(!showQuotesDrawer)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-extrabold text-[#191F28] dark:text-slate-100 hover:bg-[#EFF6FF] dark:hover:bg-blue-500/20 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                보관된 전표 · 견적 타임라인 ({quotes.length}건 / 최대{' '}
                {MAX_QUOTES_PER_CUSTOMER}건)
              </span>
              {showQuotesDrawer ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
              )}
            </button>

            {showQuotesDrawer && (
              <div className="p-2.5 space-y-2 border-t border-[#BFDBFE] dark:border-slate-800 bg-white dark:bg-[#131C2E]">
                {quotes.map((q, idx) => {
                  const isSlip = Boolean(q.isConfirmedSlip);
                  const isSlipDone = q.deliveryStatus === '배송완료';
                  const isEditingThis = editingQuoteId === q.id;
                  const subPeriodMatch =
                    q.proposalState?.subscriptionPeriod ||
                    (q.itemSummary?.includes('36') ? 36 : 60);
                  const modeBadgeLabel =
                    q.quoteMode === 'subscription'
                      ? `구독 ${subPeriodMatch}M`
                      : q.quoteMode === 'hybrid'
                      ? '일반+구독'
                      : '일반';

                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-xl border transition ${
                        isSlip
                          ? isSlipDone
                            ? 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/35 dark:bg-emerald-500/10'
                            : 'border-[#BFDBFE] dark:border-blue-500/40 bg-[#EFF6FF]/40 dark:bg-blue-500/10'
                          : idx === 0
                          ? 'border-[#BFDBFE] dark:border-blue-500/40 bg-[#EFF6FF]/40 dark:bg-blue-500/10'
                          : 'border-[#E5E8EB] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        {/* 좌측: 전표번호 · 구매유형 · 계약/배달일자 */}
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[11.5px] font-black font-mono whitespace-nowrap ${
                              isSlip
                                ? 'bg-[#191F28] dark:bg-slate-800 text-white'
                                : 'bg-[#1B64DA] text-white'
                            }`}
                          >
                            {isSlip
                              ? q.orderNo
                                ? `🧾 ${q.orderNo}`
                                : `🧾 전표 #${idx + 1}`
                              : `견적 #${idx + 1}`}
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[11px] font-extrabold whitespace-nowrap ${
                              q.quoteMode === 'subscription'
                                ? 'bg-[#FFF1F2] dark:bg-rose-500/20 text-[#E60012] dark:text-rose-300 border border-[#FECDD3] dark:border-rose-500/30'
                                : 'bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-200 border border-[#E5E8EB] dark:border-slate-700'
                            }`}
                          >
                            {modeBadgeLabel}
                          </span>

                          {isSlip && q.contractDate && (
                            <span className="text-[11px] font-mono font-semibold text-[#4E5968] dark:text-slate-400 whitespace-nowrap">
                              접수 {q.contractDate.slice(5)}
                            </span>
                          )}

                          {isSlip && q.deliveryDate && (
                            <span className="text-[11px] font-mono font-bold text-[#1B64DA] dark:text-blue-300 whitespace-nowrap">
                              배달 {q.deliveryDate}
                            </span>
                          )}
                          {!isSlip && (
                            <span className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                              {q.title}
                            </span>
                          )}
                        </div>

                        {/* 우측 액션: 전표 상태 토글 · [✏️ 전표수정] · [✅ 선택 견적 확정] · [견적서 열기] · 카톡복사 · 삭제 */}
                        <div className="flex items-center gap-1 flex-wrap ml-auto">
                          {isSlip && onToggleSlipDeliveryStatus && (
                            <button
                              type="button"
                              onClick={() =>
                                onToggleSlipDeliveryStatus(customer.id, q.id)
                              }
                              title="클릭하여 이 전표의 배송 상태(배송 ↔ 배송완료) 변경"
                              className={`px-2 py-1 rounded-md text-[11.5px] font-extrabold inline-flex items-center gap-0.5 border transition cursor-pointer whitespace-nowrap ${
                                isSlipDone
                                  ? 'bg-[#059669] hover:bg-emerald-700 text-white border-[#059669]'
                                  : 'bg-[#EFF6FF] dark:bg-blue-500/20 hover:bg-blue-100 text-[#1B64DA] dark:text-blue-200 border-[#BFDBFE] dark:border-blue-400/40'
                              }`}
                            >
                              {isSlipDone ? (
                                <>
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>배송완료</span>
                                </>
                              ) : (
                                <>
                                  <Truck className="w-3 h-3 shrink-0" />
                                  <span>배송</span>
                                </>
                              )}
                            </button>
                          )}

                          {onUpdateQuoteSlip && (
                            <button
                              id={`crm-quote-edit-slip-${idx + 1}`}
                              type="button"
                              onClick={() => openInlineSlipEditor(q)}
                              title="전표번호 · 계약일 · 배달일 · 배송상태 인라인 수정 또는 확정 전표 등록"
                              className={`px-2 py-1 rounded-md text-[11.5px] font-extrabold inline-flex items-center gap-0.5 border transition cursor-pointer whitespace-nowrap ${
                                isEditingThis
                                  ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                                  : 'bg-white dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-200 border-[#D1D6DB] dark:border-slate-700'
                              }`}
                            >
                              <Edit3 className="w-3 h-3 shrink-0" />
                              <span>{isSlip ? '전표수정' : '전표등록·수정'}</span>
                            </button>
                          )}

                          {!isSlip &&
                            draftQuotes.length >= 2 &&
                            onConfirmDraftQuote && (
                              <button
                                id={`crm-quote-confirm-draft-${idx + 1}`}
                                type="button"
                                onClick={() =>
                                  onConfirmDraftQuote(customer.id, q.id)
                                }
                                title="이 상담견적만 남기고 나머지 비교 상담견적을 정리합니다 (확정 전표는 절대 삭제되지 않음)"
                                className="px-2 py-1 rounded-md text-[11.5px] font-extrabold inline-flex items-center gap-0.5 bg-[#059669] hover:bg-emerald-700 text-white transition cursor-pointer whitespace-nowrap"
                              >
                                <Check className="w-3 h-3 shrink-0" />
                                <span>선택 견적 확정</span>
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() => onLoadQuoteRecord(customer, q)}
                            className="px-2 py-1 rounded-md text-[11.5px] font-extrabold bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] hover:opacity-90 transition cursor-pointer whitespace-nowrap"
                          >
                            견적서 열기
                          </button>
                          {q.proposalState && (
                            <button
                              type="button"
                              onClick={() => setShareModalQuote(q)}
                              title="고객 전용 웹 견적링크 즉시 발송"
                              className="px-2 py-1 rounded-md text-[11.5px] font-extrabold bg-[#EFF6FF] dark:bg-blue-500/20 border border-[#BFDBFE] dark:border-blue-500/40 text-[#1B64DA] dark:text-blue-300 hover:bg-[#DBEAFE] dark:hover:bg-blue-500/30 inline-flex items-center gap-0.5 transition cursor-pointer whitespace-nowrap"
                            >
                              <Link2 className="w-3 h-3 shrink-0" />
                              <span>웹링크</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyQuoteToClipboard(q)}
                            className="px-2 py-1 rounded-md text-[11.5px] font-bold bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#4E5968] dark:text-slate-200 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                          >
                            {copiedQuoteId === q.id ? (
                              <>
                                <ClipboardCheck className="w-3 h-3 text-[#059669] dark:text-emerald-400" />
                                <span className="text-[#059669] dark:text-emerald-400">
                                  복사됨
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>복사</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteQuoteRecord(customer.id, q.id)
                            }
                            className="p-1 rounded-md text-[#8B95A1] hover:text-[#E60012] hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 cursor-pointer"
                            title="이 전표/견적 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 품목 · 금액 1줄 요약 */}
                      <div className="mt-1.5 pt-1.5 border-t border-[#E5E8EB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                        <span className="font-bold text-[#191F28] dark:text-slate-200 truncate max-w-full sm:max-w-[55%]">
                          {q.itemSummary || '품목 요약 없음'}
                        </span>

                        <div className="font-mono tabular-nums flex items-center gap-1.5 ml-auto">
                          {q.quoteMode === 'subscription' ? (
                            <>
                              <span className="text-[#4E5968] dark:text-slate-400">
                                원금{' '}
                                {formatCurrency(
                                  q.subscriptionPrincipal ||
                                    q.performanceAmount ||
                                    0
                                )}
                                원
                              </span>
                              <span className="text-[#D1D6DB] dark:text-slate-700">
                                |
                              </span>
                              <strong className="text-[#E60012] dark:text-rose-400 font-extrabold">
                                월 {formatCurrency(q.paidAmount)}원
                              </strong>
                            </>
                          ) : (
                            <>
                              <span className="text-[#4E5968] dark:text-slate-400">
                                실구매가
                              </span>
                              <strong className="text-[#059669] dark:text-emerald-400 font-extrabold">
                                {formatCurrency(q.paidAmount)}원
                              </strong>
                              {q.netAmount > 0 &&
                                q.netAmount !== q.paidAmount && (
                                  <>
                                    <span className="text-[#D1D6DB] dark:text-slate-700">
                                      |
                                    </span>
                                    <span className="text-[#E60012] dark:text-rose-400 font-bold">
                                      체감 {formatCurrency(q.netAmount)}원
                                    </span>
                                  </>
                                )}
                            </>
                          )}

                          {!isSlip && (
                            <button
                              type="button"
                              onClick={() =>
                                onApplyQuoteAsPrimary(customer.id, q)
                              }
                              className="ml-1 text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              대표설정
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 인라인 전표 수정 · 확정 전표 승격 바 */}
                      {isEditingThis && onUpdateQuoteSlip && (
                        <div className="mt-2 pt-2.5 border-t border-[#BFDBFE] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/90 rounded-lg p-2.5 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-extrabold text-[#191F28] dark:text-slate-200 mb-0.5">
                                전표번호 (orderNo)
                              </label>
                              <input
                                type="text"
                                value={slipOrderNoDraft}
                                onChange={(e) => {
                                  setSlipOrderNoDraft(e.target.value);
                                  if (slipEditError) setSlipEditError(null);
                                }}
                                placeholder="예: 20261125-0011"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold text-[#059669] dark:text-emerald-300 mb-0.5">
                                접수/계약일 (총판월)
                              </label>
                              <input
                                type="date"
                                value={slipContractDateDraft}
                                onChange={(e) =>
                                  setSlipContractDateDraft(e.target.value)
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[11px] font-extrabold text-[#1B64DA] dark:text-blue-300">
                                  배달일자 (실판월)
                                </label>
                                {slipDeliveryDateDraft && (
                                  <button
                                    type="button"
                                    onClick={() => setSlipDeliveryDateDraft('')}
                                    className="text-[10.5px] font-bold text-[#8B95A1] hover:text-[#E60012] cursor-pointer"
                                  >
                                    미정
                                  </button>
                                )}
                              </div>
                              <input
                                type="date"
                                value={slipDeliveryDateDraft}
                                onChange={(e) =>
                                  setSlipDeliveryDateDraft(e.target.value)
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-[#BFDBFE] dark:border-blue-500/40 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-0.5">
                                품목 · 모델 요약
                              </label>
                              <input
                                type="text"
                                value={slipItemSummaryDraft}
                                onChange={(e) =>
                                  setSlipItemSummaryDraft(e.target.value)
                                }
                                placeholder="예: 김치냉장고(RQ48C9421AP)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base sm:text-xs font-semibold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-0.5">
                                출고 / 배송 상태
                              </label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSlipDeliveryStatusDraft('배송대기')
                                  }
                                  className={`py-1.5 px-2 rounded-lg text-[11.5px] font-extrabold border inline-flex items-center justify-center gap-1 transition cursor-pointer ${
                                    slipDeliveryStatusDraft !== '배송완료'
                                      ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                                      : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700'
                                  }`}
                                >
                                  <Truck className="w-3 h-3 shrink-0" />
                                  <span>🚚 배송</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSlipDeliveryStatusDraft('배송완료')
                                  }
                                  className={`py-1.5 px-2 rounded-lg text-[11.5px] font-extrabold border inline-flex items-center justify-center gap-1 transition cursor-pointer ${
                                    slipDeliveryStatusDraft === '배송완료'
                                      ? 'bg-[#059669] text-white border-[#059669]'
                                      : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700'
                                  }`}
                                >
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>✅ 배송완료</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {slipEditError && (
                            <div className="px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-rose-300 text-[11px] font-bold">
                              ⚠️ {slipEditError}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuoteId(null);
                                setSlipEditError(null);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#4E5968] dark:text-slate-300 hover:bg-[#E5E8EB] dark:hover:bg-slate-800 cursor-pointer"
                            >
                              취소
                            </button>

                            {isSlip ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveInlineSlipEdit(q, true)
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-xs font-extrabold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Save className="w-3 h-3 shrink-0" />
                                <span>전표 수정 저장</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveInlineSlipEdit(q, false)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-200 text-xs font-bold cursor-pointer"
                                >
                                  견적정보만 저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveInlineSlipEdit(q, true)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>🧾 확정 전표로 등록</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 전표/사은품/계약일/배송일/실적원금/프리드 빠른 수정 패널 */}
        {showDetailFields && (
          <div className="bg-[#EFF6FF]/60 dark:bg-slate-900/80 border border-[#BFDBFE] dark:border-slate-700 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#BFDBFE] dark:border-slate-800">
              <span className="text-[11.5px] font-black text-[#191F28] dark:text-slate-100">
                ✏️ 고객 상세 정보 · 실적 · 일정 수정 (수정 후 우측 💾 저장 클릭)
              </span>
              <button
                type="button"
                onClick={handleSaveExtraFields}
                className="px-2.5 py-1 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] text-white text-[11.5px] font-black inline-flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>전체 저장</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 mb-0.5">
                  고객명
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="고객명 입력"
                  className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 font-bold"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 mb-0.5">
                  연락처
                </label>
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(formatPhoneNumber(e.target.value))}
                  placeholder="010-1234-5678"
                  className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 mb-0.5">
                구매 품목 / 모델명 수정 (쉼표 구분)
              </label>
              <input
                type="text"
                value={itemsDraft}
                onChange={(e) => setItemsDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11.5px] font-bold text-[#059669] dark:text-emerald-300 mb-0.5">
                  실적 유형
                </label>
                <select
                  value={saleTypeDraft}
                  onChange={(e) =>
                    setSaleTypeDraft(e.target.value as CustomerSaleType)
                  }
                  className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 font-bold"
                >
                  <option value="general">일반구매 (제품 합계금액)</option>
                  <option value="subscription">구독 (구독원금)</option>
                  <option value="hybrid">혼합 (일반합계+구독원금)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#059669] dark:text-emerald-300 mb-0.5">
                  실적 기준 금액 (원금 / 제품합계)
                </label>
                <FormattedMoneyInput
                  value={
                    perfAmountDraft === ''
                      ? ''
                      : Number(String(perfAmountDraft).replace(/\D/g, '')) || 0
                  }
                  onValueChange={(_num, raw) => setPerfAmountDraft(raw)}
                  placeholder="예: 5,200,000"
                  className="w-full px-2.5 py-1.5 sm:text-xs rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 font-black"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#E60012] dark:text-rose-300 mb-0.5">
                  최종 체감가 / 월체감가
                </label>
                <FormattedMoneyInput
                  value={
                    netAmountDraft === ''
                      ? ''
                      : Number(String(netAmountDraft).replace(/\D/g, '')) || 0
                  }
                  onValueChange={(_num, raw) => setNetAmountDraft(raw)}
                  placeholder="미입력 시 실적금액과 동일"
                  className="w-full px-2.5 py-1.5 sm:text-xs rounded-lg border border-[#FECDD3] dark:border-rose-500/40 bg-white dark:bg-slate-900 font-black text-[#E60012] dark:text-rose-300"
                />
              </div>
            </div>

            {/* 프리드 구좌 수정 */}
            <div className="bg-[#EFF6FF] dark:bg-blue-500/10 border border-[#BFDBFE] dark:border-blue-500/25 rounded-lg p-2 space-y-1.5">
              <div className="ledger-row text-[11.5px] font-black text-[#191F28] dark:text-slate-100">
                <span>💎 프리드 가입 건수 수정</span>
                <span className="font-mono tabular-nums text-[#1B64DA] dark:text-blue-300">
                  예상 수당 +{formatCurrency(draftFreedPreview.totalIncentive)}원
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-1 text-center">
                {[
                  { key: 'hi90' as const, label: '플러스', unit: '9만' },
                  { key: 'hf75' as const, label: '75형', unit: '6만' },
                  { key: 'hf150' as const, label: '150형', unit: '12만' },
                  { key: 'hf225' as const, label: '225형', unit: '18만' },
                  { key: 'hf300' as const, label: '300형', unit: '24만' },
                ].map((fItem) => {
                  const val =
                    fItem.key === 'hi90'
                      ? freedDraft.hi72 + freedDraft.hi90 + freedDraft.hi108
                      : freedDraft[fItem.key];
                  return (
                    <div
                      key={fItem.key}
                      className="bg-white dark:bg-[#131C2E] rounded border border-[#BFDBFE] dark:border-slate-700 p-1"
                    >
                      <div className="text-[11.5px] font-black">{fItem.label}</div>
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => adjustFreedDraft(fItem.key, -1)}
                          className="w-5 h-5 rounded bg-[#F2F4F6] dark:bg-slate-800 text-[11.5px] font-black cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-5 text-[11.5px] font-mono tabular-nums font-black">
                          {val}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustFreedDraft(fItem.key, 1)}
                          className="w-5 h-5 rounded bg-[#1B64DA] text-white text-[11.5px] font-black cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11.5px] font-bold text-[#059669] dark:text-emerald-300 mb-0.5">
                  계약일 (총판월 기준)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={contractDateDraft}
                    onChange={(e) => setContractDateDraft(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-base sm:text-xs font-mono rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleSaveContractDateOnly}
                    title="계약일 즉시 저장"
                    className="p-2 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 mb-0.5">
                  배송 예정일 (실판월 기준)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={deliveryDateDraft}
                    onChange={(e) => setDeliveryDateDraft(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-base sm:text-xs font-mono rounded-lg border border-[#BFDBFE] dark:border-blue-500/40 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveDeliveryDateOnly()}
                    title="배송예정일(실판) 즉시 저장"
                    className="p-2 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] text-white shrink-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 mb-0.5">
                  전표번호
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={orderNoDraft}
                    onChange={(e) => setOrderNoDraft(e.target.value)}
                    placeholder="250516-0042"
                    className="flex-1 min-w-0 px-2 py-1.5 text-base sm:text-xs font-mono rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onFieldChange(customer.id, { orderNo: orderNoDraft.trim() });
                      triggerQuickSaveBadge("orderNo");
                    }}
                    title="전표번호 즉시 저장"
                    className="p-2 rounded-lg bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] shrink-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 mb-0.5">
                  약속 사은품 내역
                </label>
                <input
                  type="text"
                  value={giftItemsDraft}
                  onChange={(e) => setGiftItemsDraft(e.target.value)}
                  placeholder="예: 냄비 3종 세트"
                  className="w-full px-2.5 py-1.5 text-base sm:text-xs rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 flex items-center gap-0.5">
                    <PhoneCall className="w-3 h-3" /> 재연락 예정일
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setFollowUpDateDraft(getOffsetDateStr(3))}
                      className="px-1.5 rounded bg-white dark:bg-slate-800 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 cursor-pointer"
                    >
                      +3일
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFollowUpDateDraft(getFridayDateStr(false))
                      }
                      className="px-1.5 rounded bg-white dark:bg-slate-800 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 cursor-pointer"
                    >
                      금요일
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={followUpDateDraft}
                  onChange={(e) => setFollowUpDateDraft(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-base sm:text-xs font-mono rounded-lg border border-[#BFDBFE] dark:border-blue-500/40 bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDetailFields(false)}
                className="px-2.5 py-1 text-xs font-bold text-[#4E5968] dark:text-slate-300 hover:bg-[#E5E8EB] dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveExtraFields}
                className="px-3.5 py-1.5 text-xs font-black bg-[#E60012] hover:bg-[#C80010] text-white rounded-lg inline-flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>변경사항 저장 반영</span>
              </button>
            </div>
          </div>
        )}

        {/* 4행: 금액 박스 (실적기준액 + 고객 체감가) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
            <div className="text-[11.5px] font-extrabold text-[#059669] dark:text-emerald-300">
              {perf.saleType === 'subscription'
                ? '실적 (구독원금)'
                : perf.saleType === 'hybrid'
                ? '실적 (합계+원금)'
                : '실적 (제품합계)'}
            </div>
            <div className="text-sm sm:text-base font-black font-mono tabular-nums text-[#059669] dark:text-emerald-400 mt-0.5">
              {formatCurrency(perf.performanceAmount)}원
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800">
            <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
              {perf.saleType === 'subscription' ? '월 기준 구독료' : '고객 실결제가'}
            </div>
            <div className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-[#191F28] dark:text-slate-100 mt-0.5">
              {formatCurrency(effectivePaidAmount)}원
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/10 border border-[#FECDD3] dark:border-rose-500/25">
            <div className="text-[11.5px] font-extrabold text-[#E60012] dark:text-rose-300">
              {perf.saleType === 'subscription' ? '최종 월 체감가' : '최종 체감가'}
            </div>
            <div className="text-sm sm:text-base font-black font-mono tabular-nums text-[#E60012] dark:text-rose-400 mt-0.5">
              {formatCurrency(effectiveNetAmount)}원
            </div>
          </div>
        </div>

        {/* 프리드 수당 요약 배너 (가입 시) */}
        {perf.freedDetail.totalCount > 0 && (
          <div className="ledger-row px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/10 border border-[#BFDBFE] dark:border-blue-500/25 text-[#191F28] dark:text-slate-100 text-xs font-extrabold">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
              <span>💎 {perf.freedDetail.summaryText}</span>
            </span>
            <span className="font-mono tabular-nums font-black text-[#1B64DA] dark:text-blue-300 shrink-0">
              수당 +{formatCurrency(perf.freedDetail.totalIncentive)}원
            </span>
          </div>
        )}

        {/* 5행: 예상 혜택 */}
        {customer.expectedBenefit && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 text-[#191F28] dark:text-slate-200">
            <Sparkles className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">
              <span className="text-[#4E5968] dark:text-slate-400 mr-1">혜택 요약:</span>
              {customer.expectedBenefit}
            </div>
          </div>
        )}

        {/* 6행: 상담 메모 (인라인 수정 가능) */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400">
              상담 히스토리 / 특이사항 메모
            </span>
            {!isEditingMemo ? (
              <button
                type="button"
                onClick={() => {
                  setMemoDraft(customer.memo);
                  setIsEditingMemo(true);
                }}
                className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> 메모 수정
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveMemo}
                className="px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-black flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Save className="w-3 h-3" /> 메모 저장
              </button>
            )}
          </div>

          {isEditingMemo ? (
            <textarea
              rows={2}
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              placeholder="고객 요청사항, 카드 발급 여부, 사은품 약속 등"
              className="w-full text-base sm:text-xs p-2.5 rounded-xl border border-[#1B64DA] bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
            />
          ) : (
            <div
              onClick={() => {
                setMemoDraft(customer.memo);
                setIsEditingMemo(true);
              }}
              className="text-xs text-[#4E5968] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 cursor-pointer rounded-xl px-3 py-2 border border-dashed border-[#D1D6DB] dark:border-slate-700 min-h-[38px] flex items-center whitespace-pre-line"
            >
              {customer.memo || '클릭하여 상담 메모를 입력하세요...'}
            </div>
          )}
        </div>
      </div>

      {/* 하단 원클릭 액션 바 (344px 폴드 커버 ~ 데스크톱 모든 화면에서 글자 잘림·휴지통 겹침 0%) */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#F8FAFC] dark:bg-[#0B1120]/80 border-t border-[#E5E8EB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {customer.phone ? (
            <>
              <a
                href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11.5px] sm:text-xs font-bold bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-200 border border-[#D1D6DB] dark:border-slate-700 shadow-2xs transition shrink-0 whitespace-nowrap"
                title="전화 걸기"
              >
                <Phone className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">전화</span>
              </a>
              <a
                href={`sms:${customer.phone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 shadow-2xs transition shrink-0 whitespace-nowrap"
                title="자동 문구 없이 주고받은 문자 내역만 확인하기 위해 빈 문자앱으로 바로 이동"
              >
                <MailOpen className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
                <span className="whitespace-nowrap">문자내역</span>
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11.5px] sm:text-xs font-bold bg-[#F2F4F6] dark:bg-slate-800 text-[#8B95A1] dark:text-slate-500 border border-[#E5E8EB] dark:border-slate-700 cursor-not-allowed shrink-0 whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">전화</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenSMS(customer)}
            className="flex-1 min-w-[88px] flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-[11.5px] sm:text-xs font-bold bg-[#1B64DA] hover:bg-[#1552B5] text-white shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap sm:hidden">안내문자</span>
            <span className="whitespace-nowrap hidden sm:inline">안내 문자 발송</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuote(customer)}
            className="flex-1 sm:flex-initial min-w-[88px] flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#E60012] hover:bg-[#C80010] text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
            title="신규 통합 견적기로 이 고객 정보를 불러옵니다"
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap sm:hidden">견적계산</span>
            <span className="whitespace-nowrap hidden sm:inline">🧮 견적서 계산</span>
          </button>
        </div>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="p-2 rounded-xl text-[#8B95A1] hover:text-[#E60012] hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 transition cursor-pointer shrink-0 ml-auto"
            title="고객 삭제 (휴지통 이동)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div
            className="flex items-center gap-1 shrink-0 ml-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onDelete(customer.id)}
              className="px-2.5 py-1.5 rounded-xl bg-[#E60012] hover:bg-[#C80010] text-white text-[11.5px] font-black shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              삭제확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1.5 rounded-xl bg-[#E5E8EB] dark:bg-slate-800 hover:bg-[#D1D6DB] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 text-[11.5px] font-bold transition cursor-pointer whitespace-nowrap"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {shareModalQuote?.proposalState && (
        <ShareQuoteLinkModal
          isOpen={true}
          onClose={() => setShareModalQuote(null)}
          state={shareModalQuote.proposalState}
          customerName={customer.name}
          customerPhone={customer.phone}
          isDark={
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark')
          }
        />
      )}
    </div>
  );
};
