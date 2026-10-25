import React, { useState } from 'react';
import {
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Edit3,
  FileSpreadsheet,
  FolderKanban,
  Gift,
  MessageSquare,
  Phone,
  PhoneCall,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import { CustomerItem, CustomerStatus, QuoteRecord } from '../types/crm';
import {
  formatCurrency,
  getDeliveryDDay,
  getFollowUpInfo,
  getFridayDateStr,
  getOffsetDateStr,
  isUrgentCustomer,
} from '../utils/date';

interface CustomerCardProps {
  customer: CustomerItem;
  onStatusChange: (id: string, nextStatus: CustomerStatus) => void;
  onMemoChange: (id: string, nextMemo: string) => void;
  onFieldChange: (id: string, patch: Partial<CustomerItem>) => void;
  onDeleteQuoteRecord: (customerId: string, quoteId: string) => void;
  onApplyQuoteAsPrimary: (customerId: string, quote: QuoteRecord) => void;
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
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  발송완료: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  상담진행중: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  '미구매/고민중': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  계약완료: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  '취소/보류': {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
};

const ALL_STATUSES: CustomerStatus[] = [
  '신규/미발송',
  '발송완료',
  '상담진행중',
  '미구매/고민중',
  '계약완료',
  '취소/보류',
];

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onStatusChange,
  onMemoChange,
  onFieldChange,
  onDeleteQuoteRecord,
  onApplyQuoteAsPrimary,
  onLoadQuoteRecord,
  onDelete,
  onOpenSMS,
  onOpenQuote,
}) => {
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(customer.memo);
  const [showDetailFields, setShowDetailFields] = useState(false);
  const [showQuotesDrawer, setShowQuotesDrawer] = useState(false);
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
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dday = getDeliveryDDay(customer.deliveryDate);
  const followUp = getFollowUpInfo(customer);
  const style = STATUS_STYLES[customer.status] || STATUS_STYLES['신규/미발송'];
  const urgent = isUrgentCustomer(customer);
  const quotes = Array.isArray(customer.quotes) ? customer.quotes : [];

  const handleSaveMemo = () => {
    onMemoChange(customer.id, memoDraft);
    setIsEditingMemo(false);
  };

  const handleSaveExtraFields = () => {
    onFieldChange(customer.id, {
      orderNo: orderNoDraft.trim(),
      giftItems: giftItemsDraft.trim(),
      deliveryDate: deliveryDateDraft.trim(),
      followUpDate: followUpDateDraft.trim(),
    });
    setShowDetailFields(false);
  };

  const handleCopyQuoteToClipboard = async (q: QuoteRecord) => {
    let text = '';
    if (q.plan2Summary && q.plan2Summary.itemSummary) {
      text = `[롯데하이마트 국지점 1안 vs 2안 비교 견적 안내]
👤 고객명: ${customer.name} 고객님

━━━━━━━━━━━━━━━━━━
📘 [1안] ${q.itemSummary || '맞춤 가전 1안'}
- 실결제가: ${formatCurrency(q.paidAmount)}원
- 최종 체감가: ${formatCurrency(q.netAmount)}원${
        q.benefit ? `\n- 혜택요약: ${q.benefit}` : ''
      }

📗 [2안] ${q.plan2Summary.itemSummary}
- 실결제가: ${formatCurrency(q.plan2Summary.paidAmount)}원
- 최종 체감가: ${formatCurrency(q.plan2Summary.netAmount)}원${
        q.plan2Summary.benefit ? `\n- 혜택요약: ${q.plan2Summary.benefit}` : ''
      }
━━━━━━━━━━━━━━━━━━
두 가지 플랜 중 예산과 구성에 맞춰 편하게 선택해 주세요! 😊`;
    } else if (q.quoteMode === 'subscription') {
      text = `[롯데하이마트 국지점 맞춤 구독 견적 안내]
👤 고객명: ${customer.name} 고객님
📌 견적명: ${q.title}
📦 구독모델: ${q.itemSummary}
💳 월 기준 구독료: 월 ${formatCurrency(q.paidAmount)}원
🎁 혜택요약: ${q.benefit || '제휴카드 및 구독프리드 혜택'}
✨ 최종 월 체감가: 월 ${formatCurrency(q.netAmount)}원`;
    } else {
      text = `[롯데하이마트 국지점 맞춤 견적 안내]
👤 고객명: ${customer.name} 고객님
📌 견적명: ${q.title}
📦 상담모델: ${q.itemSummary}
💳 결제예정가: ${formatCurrency(q.paidAmount)}원
🎁 혜택요약: ${q.benefit || '매장 특별 혜택'}
✨ 최종체감가: ${formatCurrency(q.netAmount)}원`;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuoteId(q.id);
      setTimeout(() => setCopiedQuoteId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const discountDiff = Math.max(0, customer.paidAmount - customer.netAmount);
  const discountRate =
    customer.paidAmount > 0
      ? Math.round((discountDiff / customer.paidAmount) * 100)
      : 0;

  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        urgent
          ? 'border-rose-300 shadow-md ring-1 ring-rose-200/60'
          : 'border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* 상단 영역 */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* 1행: 등록일/전표번호 & 배송 D-Day + 상태 드롭다운 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400">
              등록 {customer.regDate}
            </span>
            {customer.orderNo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                {customer.orderNo}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${dday.badgeClass}`}
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
                className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-extrabold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${style.bg} ${style.text} ${style.border}`}
              >
                {ALL_STATUSES.map((st) => (
                  <option
                    key={st}
                    value={st}
                    className="bg-white text-slate-800"
                  >
                    {st}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-70">
                ▼
              </span>
            </div>
          </div>
        </div>

        {/* 2행: 고객명 + 연락처 + 견적보관함/재연락 뱃지 */}
        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {customer.name}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  고객님
                </span>
              </h3>
              {quotes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowQuotesDrawer(!showQuotesDrawer)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <FolderKanban className="w-3 h-3" />
                  견적 보관함 ({quotes.length}/5)
                </button>
              )}
              {followUp.hasFollowUp && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    followUp.isDueOrOverdue
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                      : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  {followUp.label}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {customer.phone || '연락처 미입력'}
            </p>
          </div>

          {customer.deliveryDate && (
            <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{customer.deliveryDate}</span>
            </div>
          )}
        </div>

        {/* 매장 실전 원터치 체크바: 물류확정 & 사은품지급 */}
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
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span>
              {customer.logisticsConfirmed ? '물류/배정 완료' : '물류 미확정'}
            </span>
            {customer.logisticsConfirmed && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : customer.giftItems
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
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
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            )}
          </button>
        </div>

        {/* 3행: 관심품목/모델 (대표 견적) */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-400">
              대표 상담 품목 / 모델명
            </span>
            <button
              type="button"
              onClick={() => {
                setOrderNoDraft(customer.orderNo || '');
                setGiftItemsDraft(customer.giftItems || '');
                setDeliveryDateDraft(customer.deliveryDate || '');
                setFollowUpDateDraft(customer.followUpDate || '');
                setShowDetailFields(!showDetailFields);
              }}
              className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>전표/사은품/일정 수정</span>
              {showDetailFields ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
          <p className="text-sm font-bold text-slate-800 leading-snug break-keep">
            {customer.items || '품목 내역 없음'}
          </p>
        </div>

        {/* 고객별 다중 견적 보관함 서랍 (최대 5개) */}
        {quotes.length > 0 && (
          <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQuotesDrawer(!showQuotesDrawer)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-extrabold text-indigo-900 hover:bg-indigo-100/60 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                저장된 견적 히스토리 ({quotes.length}개 / 최대 5개)
              </span>
              {showQuotesDrawer ? (
                <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
              )}
            </button>

            {showQuotesDrawer && (
              <div className="p-2.5 space-y-2 border-t border-indigo-100 bg-white">
                {quotes.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`p-2.5 rounded-xl border transition ${
                      idx === 0
                        ? 'border-indigo-300 bg-indigo-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white">
                            견적 #{idx + 1}
                          </span>
                          {q.plan2Summary && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white">
                              1안+2안 비교
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {q.title}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          저장일시: {q.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadQuoteRecord(customer, q)}
                          className="px-2 py-1 rounded-md text-[10px] font-extrabold bg-slate-900 text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                          title="이 견적을 신규 견적기로 다시 불러와 수정합니다"
                        >
                          계산기로 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyQuoteToClipboard(q)}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-0.5 cursor-pointer"
                          title="카톡/문자용 견적 요약 복사"
                        >
                          {copiedQuoteId === q.id ? (
                            <>
                              <ClipboardCheck className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">복사됨</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>카톡복사</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteQuoteRecord(customer.id, q.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="이 견적 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-slate-700 mt-1.5 line-clamp-2">
                      {q.itemSummary || '품목 요약 없음'}
                    </p>

                    {q.plan2Summary && (
                      <div className="mt-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                        [2안] {q.plan2Summary.itemSummary} · 실결제{' '}
                        {formatCurrency(q.plan2Summary.paidAmount)}원 / 체감{' '}
                        {formatCurrency(q.plan2Summary.netAmount)}원
                      </div>
                    )}

                    <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">
                          {q.quoteMode === 'subscription' ? '월구독: ' : '결제: '}
                        </span>
                        <strong className="text-slate-800">
                          {formatCurrency(q.paidAmount)}원
                        </strong>
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span className="text-blue-600 font-bold">
                          체감: {formatCurrency(q.netAmount)}원
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onApplyQuoteAsPrimary(customer.id, q)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:underline cursor-pointer"
                      >
                        대표 견적으로 설정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 전표/사은품/배송일/재연락예정일 빠른 수정 패널 */}
        {showDetailFields && (
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  전표번호 / 계약번호
                </label>
                <input
                  type="text"
                  value={orderNoDraft}
                  onChange={(e) => setOrderNoDraft(e.target.value)}
                  placeholder="예: 250516-0042"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  배송 예정일
                </label>
                <input
                  type="date"
                  value={deliveryDateDraft}
                  onChange={(e) => setDeliveryDateDraft(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                약속 사은품 내역
              </label>
              <input
                type="text"
                value={giftItemsDraft}
                onChange={(e) => setGiftItemsDraft(e.target.value)}
                placeholder="예: 냄비 3종 세트 + 키친타올"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                  <PhoneCall className="w-3 h-3" />
                  📞 재연락 예정일 (미결/상담 리마인드)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFollowUpDateDraft(getOffsetDateStr(3))}
                    className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    +3일 뒤
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpDateDraft(getFridayDateStr(false))}
                    className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    이번주 금
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpDateDraft(getFridayDateStr(true))}
                    className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    다음주 금
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpDateDraft('')}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={followUpDateDraft}
                onChange={(e) => setFollowUpDateDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDetailFields(false)}
                className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200/60 rounded-lg cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveExtraFields}
                className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                저장
              </button>
            </div>
          </div>
        )}

        {/* 4행: 금액 박스 */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-500">
              결제 예정 금액
            </div>
            <div className="text-base font-extrabold text-slate-800 mt-0.5">
              {formatCurrency(customer.paidAmount)}
              <span className="text-xs font-semibold ml-0.5">원</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-blue-700">
                최종 체감가
              </span>
              {discountRate > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-blue-600 text-white">
                  -{discountRate}%
                </span>
              )}
            </div>
            <div className="text-base font-black text-blue-700 mt-0.5">
              {formatCurrency(customer.netAmount)}
              <span className="text-xs font-bold ml-0.5">원</span>
            </div>
          </div>
        </div>

        {/* 5행: 예상 혜택 */}
        {customer.expectedBenefit && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">
              <span className="text-amber-700 mr-1">혜택 요약:</span>
              {customer.expectedBenefit}
            </div>
          </div>
        )}

        {/* 6행: 상담 메모 (인라인 수정 가능) */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-400">
              상담 히스토리 / 특이사항 메모
            </span>
            {!isEditingMemo ? (
              <button
                type="button"
                onClick={() => {
                  setMemoDraft(customer.memo);
                  setIsEditingMemo(true);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> 메모 수정
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveMemo}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> 저장 완료
              </button>
            )}
          </div>

          {isEditingMemo ? (
            <textarea
              rows={2}
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              placeholder="고객 요청사항, 카드 발급 여부, 사은품 약속 등"
              className="w-full text-xs p-2.5 rounded-xl border border-blue-400 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div
              onClick={() => {
                setMemoDraft(customer.memo);
                setIsEditingMemo(true);
              }}
              className="text-xs text-slate-600 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer rounded-xl px-3 py-2 border border-dashed border-slate-200 min-h-[38px] flex items-center whitespace-pre-line"
            >
              {customer.memo || '클릭하여 상담 메모를 입력하세요...'}
            </div>
          )}
        </div>
      </div>

      {/* 하단 원클릭 액션 바 */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1">
          {customer.phone ? (
            <a
              href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs transition"
              title="전화 걸기"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>전화</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>전화</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenSMS(customer)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>안내 문자 발송</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuote(customer)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-xs transition cursor-pointer"
            title="신규 통합 견적기로 이 고객 정보를 불러옵니다"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>🧮 견적서 계산</span>
          </button>
        </div>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="고객 삭제 (휴지통 이동)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onDelete(customer.id)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-xs transition cursor-pointer"
            >
              삭제확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition cursor-pointer"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
