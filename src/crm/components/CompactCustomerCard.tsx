import React, { useRef, useState } from 'react';
import {
  Calculator,
  Check,
  ChevronRight,
  FolderKanban,
  Gift,
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
  '신규/미발송': 'bg-rose-50 text-rose-700 border-rose-200',
  발송완료: 'bg-blue-50 text-blue-700 border-blue-200',
  상담진행중: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '미구매/고민중': 'bg-amber-50 text-amber-800 border-amber-200',
  계약완료: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  배송완료: 'bg-teal-50 text-teal-800 border-teal-300',
  '취소/보류': 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_BADGE_DARK: Record<CustomerStatus, string> = {
  '신규/미발송': 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  발송완료: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
  상담진행중: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
  '미구매/고민중': 'bg-amber-400/20 text-amber-300 border-amber-400/30',
  계약완료: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  배송완료: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
  '취소/보류': 'bg-slate-700/50 text-slate-400 border-white/10',
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
  const dday = getDeliveryDDay(customer.deliveryDate);
  const followUp = getFollowUpInfo(customer);
  const urgent = isUrgentCustomer(customer);
  const quoteCount = customer.quotes?.length || 0;
  const hasUnpaidGift =
    Boolean(customer.giftItems && customer.giftItems.trim()) &&
    !customer.giftSent;
  const perf = resolveCustomerPerformanceProfile(customer);
  const fallbackQuoteWithNet = customer.quotes?.find(
    (q) => (Number(q.netAmount) || 0) > 0 || (Number(q.paidAmount) || 0) > 0
  );
  const effectiveNetAmount =
    (Number(customer.netAmount) || 0) > 0
      ? customer.netAmount
      : fallbackQuoteWithNet?.netAmount ?? customer.netAmount ?? 0;

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
    if (swipeOffset <= -56 && onToggleLogistics) {
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
      ? 'bg-[#171E2E] border-rose-500/75 text-slate-100 hover:border-rose-400'
      : 'bg-[#151A25] border-white/10 text-slate-100 hover:border-sky-400/50'
    : urgent
    ? 'bg-white border-rose-500 text-[#18181B] hover:border-[#8C5A32]'
    : 'bg-white border-[#E4DFD5] text-[#18181B] hover:border-[#8C5A32]';

  const stripSurface = isDark
    ? 'bg-[#0E131D] border-white/10'
    : 'bg-[#F7F5F0] border-[#E4DFD5]';

  const mutedText = isDark ? 'text-slate-400' : 'text-[#78716C]';

  return (
    <div className="relative overflow-hidden rounded-3xl">
      {/* 스와이프 배경 힌트 레이어 */}
      {swipeOffset !== 0 && (
        <div
          className={`absolute inset-0 rounded-3xl flex items-center justify-between px-5 text-xs font-black ${
            swipeOffset > 0
              ? 'bg-sky-600 text-white'
              : 'bg-emerald-600 text-white'
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
        className={`group relative rounded-3xl border-[1.5px] cursor-pointer hover:shadow-md p-4 flex flex-col justify-between gap-2.5 schedule-tactile ${cardSurface}`}
      >
        {/* 상단: 고객명 + 연락처 + 상태/배송 뱃지 */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight truncate">
                  {customer.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    isDark
                      ? STATUS_BADGE_DARK[customer.status]
                      : STATUS_BADGE_LIGHT[customer.status]
                  }`}
                >
                  {customer.status}
                </span>
                {quoteCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      isDark
                        ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                        : 'bg-[#F4ECE1] text-[#8C5A32] border-[#DFD9CE]'
                    }`}
                  >
                    <FolderKanban className="w-2.5 h-2.5" />
                    견적 {quoteCount}
                  </span>
                )}
                {customer.status === '배송완료' && hasUnpaidGift && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-500 animate-pulse">
                    🎁 사은품 미지급
                  </span>
                )}
                {perf.freedDetail.totalCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      isDark
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    💎 프리드 {perf.freedDetail.totalCount}건
                  </span>
                )}
                {followUp.hasFollowUp && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      followUp.isDueOrOverdue
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                        : isDark
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
                        : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {followUp.label}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold font-mono mt-0.5 ${mutedText}`}>
                {customer.phone || '연락처 미입력'}
              </p>
            </div>

            {/* 배송 D-Day 뱃지 */}
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${dday.badgeClass}`}
            >
              {dday.label}
            </span>
          </div>

          {/* 중단: 관심품목 1줄 요약 + 실적기준액/체감가 */}
          <div className={`mt-2.5 rounded-2xl px-3 py-2.5 border ${stripSurface}`}>
            <p className="text-xs font-bold line-clamp-1">
              {customer.items || '상담 품목 미입력'}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
              <span className={mutedText}>
                {perf.saleType === 'subscription'
                  ? '구독원금 '
                  : perf.saleType === 'hybrid'
                  ? '실적합계 '
                  : '제품합계 '}
                <strong
                  className={
                    isDark ? 'text-emerald-300 font-black' : 'text-emerald-700 font-extrabold'
                  }
                >
                  {formatCurrency(perf.performanceAmount)}원
                </strong>
              </span>
              <span
                className={`font-black ${
                  isDark ? 'text-amber-300' : 'text-[#8C5A32]'
                }`}
              >
                {perf.saleType === 'subscription' ? '월체감 ' : '체감 '}
                {formatCurrency(effectiveNetAmount)}원
              </span>
            </div>
          </div>
        </div>

        {/* 하단: 원터치 물류/사은품 토글 배지 + 빠른 액션 */}
        <div
          className={`flex items-center justify-between pt-1.5 border-t ${
            isDark ? 'border-white/10' : 'border-[#E4DFD5]'
          }`}
        >
          <div
            className="flex items-center gap-1.5 text-[10px] font-bold"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleLogistics?.(customer)}
              title="클릭하여 물류확정 상태 즉시 변경"
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border cursor-pointer schedule-tactile ${
                customer.logisticsConfirmed
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isDark
                  ? 'bg-[#1B2230] text-slate-400 border-white/10'
                  : 'bg-[#F4F2ED] text-[#78716C] border-[#E4DFD5]'
              }`}
            >
              {customer.logisticsConfirmed ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <Truck className="w-2.5 h-2.5" />
              )}
              <span>{customer.logisticsConfirmed ? '물류확정' : '물류대기'}</span>
            </button>

            {customer.giftItems && (
              <button
                type="button"
                onClick={() => onToggleGift?.(customer)}
                title="클릭하여 사은품 지급완료 상태 즉시 변경"
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border cursor-pointer schedule-tactile ${
                  hasUnpaidGift
                    ? isDark
                      ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                    : isDark
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <Gift className="w-2.5 h-2.5" />
                <span>{customer.giftSent ? '사은품완료' : '사은품미지급'}</span>
              </button>
            )}
          </div>

          {/* 우측 퀵 버튼 */}
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {customer.phone && (
              <a
                href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                className={`p-1.5 rounded-xl border ${
                  isDark
                    ? 'bg-[#1B2230] hover:bg-white/10 text-emerald-300 border-white/10'
                    : 'bg-[#F4F2ED] hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
                }`}
                title="전화 걸기"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={(e) => onOpenSMS(customer, e)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 cursor-pointer schedule-tactile ${
                isDark
                  ? 'bg-[#1B2230] hover:bg-white/10 text-slate-200 border-white/10'
                  : 'bg-[#F4F2ED] hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
              }`}
              title="안내 문자 발송"
            >
              <MessageSquare className="w-3 h-3" />
              <span>문자</span>
            </button>
            <button
              type="button"
              onClick={(e) => onOpenQuote(customer, e)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer schedule-tactile ${
                isDark
                  ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                  : 'bg-[#18181B] hover:bg-[#292524] text-white'
              }`}
              title="견적기에서 불러오기"
            >
              <Calculator
                className={`w-3 h-3 ${isDark ? 'text-slate-950' : 'text-amber-400'}`}
              />
              <span>견적서</span>
            </button>
            <span className="opacity-45 pl-0.5">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
