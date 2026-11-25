import React, { useRef, useState } from 'react';
import {
  Calculator,
  Check,
  ChevronRight,
  FolderKanban,
  Gift,
  MailOpen,
  MessageSquare,
  Phone,
  Truck,
} from 'lucide-react';
import { CustomerItem, CustomerStatus } from '../types/crm';
import {
  formatCurrency,
  getDeliveryDDay,
  getFollowUpInfo,
  isUrgentCustomer,
} from '../utils/date';
import { resolveCustomerPerformanceProfile } from '../utils/settlementEngine';

interface CompactCustomerCardProps {
  customer: CustomerItem;
  isDark?: boolean;
  onSelectCustomer: (customer: CustomerItem) => void;
  onOpenSMS: (customer: CustomerItem, e: React.MouseEvent) => void;
  onOpenQuote: (customer: CustomerItem, e: React.MouseEvent) => void;
  onToggleLogistics?: (customer: CustomerItem) => void;
  onToggleGift?: (customer: CustomerItem) => void;
}

const STATUS_BADGE_LIGHT: Record<CustomerStatus, string> = {
  '신규/미발송': 'bg-[#FFF1F2] text-[#E60012] border-[#FECDD3]',
  발송완료: 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]',
  상담진행중: 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]',
  '미구매/고민중': 'bg-amber-50 text-amber-800 border-amber-200',
  계약완료: 'bg-emerald-50 text-[#059669] border-emerald-200',
  배송완료: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  '취소/보류': 'bg-[#F2F4F6] text-[#8B95A1] border-[#E5E8EB]',
};

const STATUS_BADGE_DARK: Record<CustomerStatus, string> = {
  '신규/미발송': 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  발송완료: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  상담진행중: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  '미구매/고민중': 'bg-amber-400/20 text-amber-300 border-amber-400/30',
  계약완료: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  배송완료: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  '취소/보류': 'bg-slate-800 text-slate-400 border-slate-700',
};

export const CompactCustomerCard: React.FC<CompactCustomerCardProps> = ({
  customer,
  isDark = false,
  onSelectCustomer,
  onOpenSMS,
  onOpenQuote,
  onToggleLogistics,
  onToggleGift,
}) => {
  const dday = getDeliveryDDay(customer.deliveryDate, customer.status);
  const isContractOrDelivered =
    customer.status === '계약완료' ||
    customer.status === '발송완료' ||
    customer.status === '배송완료';
  const followUp = getFollowUpInfo(customer);
  const urgent = isUrgentCustomer(customer);
  const allQuotes = customer.quotes || [];
  const confirmedSlips = allQuotes.filter((q) => Boolean(q?.isConfirmedSlip));
  const slipCount = confirmedSlips.length;
  const draftQuoteCount = allQuotes.length - slipCount;

  const sortedSlips = [...confirmedSlips].sort((a, b) => {
    const da = (a.contractDate || a.createdAt || '').slice(0, 10);
    const db = (b.contractDate || b.createdAt || '').slice(0, 10);
    if (da !== db) return db.localeCompare(da);
    return 0;
  });
  const slipOrderNos = sortedSlips
    .map((s) => (s.orderNo || '').trim())
    .filter(Boolean);
  if (slipOrderNos.length === 0 && customer.orderNo?.trim()) {
    slipOrderNos.push(customer.orderNo.trim());
  }

  const pendingSlipCount = confirmedSlips.filter(
    (s) => s.deliveryStatus !== '배송완료'
  ).length;
  const doneSlipCount = confirmedSlips.filter(
    (s) => s.deliveryStatus === '배송완료'
  ).length;

  const orderNoChipText = (() => {
    if (slipCount <= 1) {
      return slipOrderNos[0] ? `🧾 ${slipOrderNos[0]}` : '';
    }
    if (slipCount === 2) {
      if (slipOrderNos.length >= 2) {
        return `🧾 ${slipOrderNos[0]} · ${slipOrderNos[1]}`;
      }
      if (slipOrderNos.length === 1) {
        return `🧾 ${slipOrderNos[0]} 외 1건`;
      }
      return '';
    }
    if (slipOrderNos.length >= 1) {
      return `🧾 ${slipOrderNos[0]} 외 ${slipCount - 1}건`;
    }
    return '';
  })();

  const hasUnpaidGift =
    Boolean(customer.giftItems && customer.giftItems.trim()) &&
    !customer.giftSent;
  const perf = resolveCustomerPerformanceProfile(customer);
  const fallbackQuoteWithNet = allQuotes.find(
    (q) => (Number(q.netAmount) || 0) > 0 || (Number(q.paidAmount) || 0) > 0
  );
  const effectiveNetAmount =
    (Number(customer.netAmount) || 0) > 0
      ? customer.netAmount
      : fallbackQuoteWithNet?.netAmount ?? customer.netAmount ?? 0;

  // 다중 전표 고객일 때 대표 품목 1개 + '외 N건'으로 지저분함 없이 한 줄 정돈
  const conciseItemsHeadline = (() => {
    if (slipCount >= 2) {
      const firstSummary = (sortedSlips[0]?.itemSummary || customer.items || '')
        .split(/\s*\+\s*|\s*,\s*/)[0]
        ?.trim();
      return firstSummary
        ? `${firstSummary} 외 ${slipCount - 1}건`
        : `확정 전표 ${slipCount}건 통합`;
    }
    if (slipCount === 1 && confirmedSlips[0]?.itemSummary) {
      return confirmedSlips[0].itemSummary;
    }
    return customer.items || '상담 품목 미입력';
  })();

  const statusDisplayLabel =
    customer.status === '계약완료' || customer.status === '발송완료'
      ? '🚚 배송'
      : customer.status === '배송완료'
      ? '✅ 배송완료'
      : customer.status;

  // 모바일 좌우 스와이프 제스처 지원
  const touchStartXRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    if (Math.abs(dx) > 12) {
      setSwipeOffset(Math.max(-88, Math.min(88, dx)));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset <= -56 && onToggleLogistics && isContractOrDelivered) {
      onToggleLogistics(customer);
    } else if (swipeOffset >= 56) {
      const syntheticEvt = { stopPropagation: () => {} } as React.MouseEvent;
      onOpenSMS(customer, syntheticEvt);
    }
    setSwipeOffset(0);
    touchStartXRef.current = null;
  };

  const cardSurface = isDark
    ? urgent
      ? 'bg-[#131C2E] border-rose-500/75 text-slate-100 hover:border-rose-400'
      : 'bg-[#131C2E] border-slate-800 text-slate-100 hover:border-blue-400/50'
    : urgent
    ? 'bg-white border-[#E60012] text-[#191F28] hover:border-[#E60012] ring-1 ring-[#E60012]/15 shadow-[0_2px_10px_rgba(230,0,18,0.06)]'
    : 'bg-white border-[#E5E8EB] text-[#191F28] hover:border-[#1B64DA] shadow-[0_2px_10px_rgba(25,31,40,0.03)]';

  const stripSurface = isDark
    ? 'bg-slate-900/70 border-slate-800'
    : 'bg-[#F8FAFC] border-[#E5E8EB]';

  const mutedText = isDark ? 'text-slate-400' : 'text-[#8B95A1]';

  return (
    <div className="relative overflow-hidden rounded-[20px]">
      {/* 스와이프 배경 힌트 레이어 */}
      {swipeOffset !== 0 && (
        <div
          className={`absolute inset-0 rounded-[20px] flex items-center justify-between px-5 text-xs font-extrabold ${
            swipeOffset > 0
              ? 'bg-[#1B64DA] text-white'
              : 'bg-[#059669] text-white'
          }`}
        >
          <span>💬 안내문자 발송</span>
          <span>✓ 물류확정 토글</span>
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onSelectCustomer(customer)}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
        }}
        className={`group relative rounded-[20px] border cursor-pointer hover:shadow-md p-4 flex flex-col justify-between gap-2.5 schedule-tactile ${cardSurface}`}
      >
        {/* 상단: 고객명 + 연락처 + 상태/전표수/배송 뱃지 */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                  {customer.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11.5px] font-extrabold border whitespace-nowrap ${
                    isDark
                      ? STATUS_BADGE_DARK[customer.status]
                      : STATUS_BADGE_LIGHT[customer.status]
                  }`}
                >
                  {statusDisplayLabel}
                </span>
                {slipCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold border font-mono tabular-nums whitespace-nowrap ${
                      isDark
                        ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                        : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                    }`}
                  >
                    🧾 전표 {slipCount}건
                  </span>
                )}
                {slipCount >= 2 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold border font-mono tabular-nums whitespace-nowrap ${
                      pendingSlipCount > 0
                        ? isDark
                          ? 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                        : isDark
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                        : 'bg-emerald-50 text-[#059669] border-emerald-200'
                    }`}
                  >
                    배송 {pendingSlipCount} · 완료 {doneSlipCount}
                  </span>
                )}
                {draftQuoteCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold border font-mono tabular-nums whitespace-nowrap ${
                      isDark
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                    }`}
                  >
                    <FolderKanban className="w-2.5 h-2.5" />
                    견적 {draftQuoteCount}
                  </span>
                )}
                {customer.status === '배송완료' && hasUnpaidGift && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-[#E60012] text-white border border-[#E60012] animate-pulse">
                    🎁 사은품 미지급
                  </span>
                )}
                {perf.freedDetail.totalCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold border font-mono tabular-nums ${
                      isDark
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                        : 'bg-emerald-50 text-[#059669] border-emerald-200'
                    }`}
                  >
                    💎 프리드 {perf.freedDetail.totalCount}건
                  </span>
                )}
                {followUp.hasFollowUp && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-extrabold border ${
                      followUp.isDueOrOverdue
                        ? 'bg-[#E60012] text-white border-[#E60012] animate-pulse'
                        : isDark
                        ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                        : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                    }`}
                  >
                    {followUp.label}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold font-mono tabular-nums ${mutedText}`}>
                  {customer.phone || '연락처 미입력'}
                </span>
                {orderNoChipText && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono tabular-nums border max-w-full truncate ${
                      isDark
                        ? 'bg-slate-800/90 text-slate-200 border-slate-700'
                        : 'bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]'
                    }`}
                    title={slipOrderNos.join(', ')}
                  >
                    {orderNoChipText}
                  </span>
                )}
              </div>
            </div>

            {/* 배송 D-Day 뱃지 */}
            <span
              className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold font-mono tabular-nums border ${dday.badgeClass}`}
            >
              {dday.label}
            </span>
          </div>

          {/* 중단: 대표 품목 1줄 요약 + 통합 실적기준액/체감가 */}
          <div className={`mt-2.5 rounded-2xl px-3 py-2.5 border ${stripSurface}`}>
            <p className="text-xs font-bold text-[#191F28] dark:text-slate-100 line-clamp-1">
              {conciseItemsHeadline}
            </p>
            <div className="mt-1 ledger-row text-[11.5px] font-mono tabular-nums">
              <span className={`ledger-row-label truncate ${mutedText}`}>
                {perf.saleType === 'subscription'
                  ? '구독원금 '
                  : perf.saleType === 'hybrid'
                  ? '통합실적 '
                  : slipCount >= 2
                  ? '통합실적 '
                  : '제품합계 '}
                <strong
                  className={
                    isDark ? 'text-emerald-400 font-extrabold' : 'text-[#059669] font-extrabold'
                  }
                >
                  {formatCurrency(perf.performanceAmount)}원
                </strong>
              </span>
              <span
                className={`ledger-row-value font-extrabold ${
                  isDark ? 'text-[#FF3B47]' : 'text-[#E60012]'
                }`}
              >
                {perf.saleType === 'subscription'
                  ? '월체감 '
                  : perf.saleType === 'hybrid'
                  ? '일반결제 '
                  : '체감 '}
                {formatCurrency(effectiveNetAmount)}원
              </span>
            </div>
          </div>
        </div>

        {/* 하단: 원터치 물류/사은품 토글 배지 + 빠른 액션 */}
        <div
          className={`flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1.5 pt-2.5 border-t ${
            isDark ? 'border-slate-800' : 'border-[#E5E8EB]'
          }`}
        >
          <div
            className="flex flex-wrap items-center gap-1 text-[11.5px] font-bold min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isContractOrDelivered ? (
              <button
                type="button"
                onClick={() => onToggleLogistics?.(customer)}
                title="클릭하여 물류확정 상태 즉시 변경"
                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full border cursor-pointer whitespace-nowrap shrink-0 schedule-tactile ${
                  customer.logisticsConfirmed
                    ? isDark
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-emerald-50 text-[#059669] border-emerald-200'
                    : isDark
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                }`}
              >
                {customer.logisticsConfirmed ? (
                  <Check className="w-2.5 h-2.5 shrink-0" />
                ) : (
                  <Truck className="w-2.5 h-2.5 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {customer.status === '배송완료'
                    ? '배송완료'
                    : customer.logisticsConfirmed
                    ? '물류확정'
                    : '배송대기'}
                </span>
              </button>
            ) : (
              customer.deliveryDate && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full border whitespace-nowrap shrink-0 font-mono tabular-nums ${
                    isDark
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                  }`}
                >
                  <span className="whitespace-nowrap">희망수령 {customer.deliveryDate.slice(5)}</span>
                </span>
              )
            )}

            {customer.giftItems && (
              <button
                type="button"
                onClick={() => onToggleGift?.(customer)}
                title="클릭하여 사은품 지급완료 상태 즉시 변경"
                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full border cursor-pointer whitespace-nowrap shrink-0 schedule-tactile ${
                  hasUnpaidGift
                    ? isDark
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                      : 'bg-[#FFF1F2] text-[#E60012] border-[#FECDD3]'
                    : isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-emerald-50 text-[#059669] border-emerald-200'
                }`}
              >
                <Gift className="w-2.5 h-2.5 shrink-0" />
                <span className="whitespace-nowrap">{customer.giftSent ? '사은품완료' : '사은품미지급'}</span>
              </button>
            )}
          </div>

          {/* 우측 퀵 버튼 */}
          <div
            className="flex flex-wrap items-center justify-end gap-1 ml-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {customer.phone && (
              <>
                <a
                  href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                  className={`p-1.5 rounded-xl border shrink-0 transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                      : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#059669] border-[#E5E8EB]'
                  }`}
                  title="전화 걸기"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`sms:${customer.phone.replace(/[^0-9+]/g, '')}`}
                  className={`px-2 py-1.5 rounded-xl border text-[11.5px] font-extrabold flex items-center gap-0.5 whitespace-nowrap shrink-0 schedule-tactile ${
                    isDark
                      ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/30'
                      : 'bg-[#EFF6FF] hover:bg-blue-100/80 text-[#1B64DA] border-[#BFDBFE]'
                  }`}
                  title="자동 문구 없이 이 번호와의 문자 대화내역(문자앱) 바로 열기"
                >
                  <MailOpen className="w-3 h-3 shrink-0" />
                  <span className="whitespace-nowrap">문자내역</span>
                </a>
              </>
            )}
            <button
              type="button"
              onClick={(e) => onOpenSMS(customer, e)}
              className={`px-2 py-1.5 rounded-xl border text-[11.5px] font-extrabold flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0 schedule-tactile ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]'
              }`}
              title="자동 완성 안내문자 발송"
            >
              <MessageSquare className="w-3 h-3 shrink-0" />
              <span className="whitespace-nowrap">안내문자</span>
            </button>
            <button
              type="button"
              onClick={(e) => onOpenQuote(customer, e)}
              className={`px-2.5 py-1.5 rounded-xl text-[11.5px] font-extrabold flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0 schedule-tactile ${
                isDark
                  ? 'bg-[#60A5FA] hover:bg-blue-300 text-[#0B1120]'
                  : 'bg-[#191F28] hover:bg-slate-800 text-white'
              }`}
              title="견적기에서 불러오기"
            >
              <Calculator
                className={`w-3 h-3 shrink-0 ${isDark ? 'text-[#0B1120]' : 'text-white'}`}
              />
              <span className="whitespace-nowrap">견적서</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
