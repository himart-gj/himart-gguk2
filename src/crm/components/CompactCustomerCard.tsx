import React from 'react';
import {
  Calculator,
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

interface CompactCustomerCardProps {
  customer: CustomerItem;
  onSelectCustomer: (customer: CustomerItem) => void;
  onOpenSMS: (customer: CustomerItem, e: React.MouseEvent) => void;
  onOpenQuote: (customer: CustomerItem, e: React.MouseEvent) => void;
}

const STATUS_BADGE: Record<CustomerStatus, string> = {
  '신규/미발송': 'bg-rose-50 text-rose-700 border-rose-200',
  발송완료: 'bg-blue-50 text-blue-700 border-blue-200',
  상담진행중: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '미구매/고민중': 'bg-amber-50 text-amber-800 border-amber-200',
  계약완료: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '취소/보류': 'bg-slate-100 text-slate-500 border-slate-200',
};

export const CompactCustomerCard: React.FC<CompactCustomerCardProps> = ({
  customer,
  onSelectCustomer,
  onOpenSMS,
  onOpenQuote,
}) => {
  const dday = getDeliveryDDay(customer.deliveryDate);
  const followUp = getFollowUpInfo(customer);
  const urgent = isUrgentCustomer(customer);
  const quoteCount = customer.quotes?.length || 0;
  const hasUnpaidGift =
    Boolean(customer.giftItems && customer.giftItems.trim()) &&
    !customer.giftSent;

  return (
    <div
      onClick={() => onSelectCustomer(customer)}
      className={`group relative bg-white rounded-3xl border-[1.5px] transition-all duration-150 cursor-pointer hover:shadow-md hover:border-[#8C5A32] p-4 flex flex-col justify-between gap-2.5 ${
        urgent
          ? 'border-rose-500 shadow-xs'
          : 'border-[#E4DFD5] shadow-2xs'
      }`}
    >
      {/* 상단: 고객명 + 연락처 + 상태/배송 뱃지 */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-[#18181B] tracking-tight truncate group-hover:text-[#8C5A32] transition-colors">
                {customer.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  STATUS_BADGE[customer.status]
                }`}
              >
                {customer.status}
              </span>
              {quoteCount > 0 && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F4ECE1] text-[#8C5A32] border border-[#DFD9CE]">
                  <FolderKanban className="w-2.5 h-2.5" />
                  견적 {quoteCount}
                </span>
              )}
              {followUp.hasFollowUp && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    followUp.isDueOrOverdue
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                      : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  {followUp.label}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-[#78716C] mt-0.5">
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

        {/* 중단: 관심품목 1줄 요약 (Warm Ivory Bento Strip) */}
        <div className="mt-2.5 bg-[#F7F5F0] rounded-2xl px-3 py-2.5 border border-[#E4DFD5]">
          <p className="text-xs font-bold text-[#18181B] line-clamp-1">
            {customer.items || '상담 품목 미입력'}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-[#78716C]">
              결제{' '}
              <strong className="text-[#18181B] font-extrabold">
                {formatCurrency(customer.paidAmount)}원
              </strong>
            </span>
            <span className="text-[#8C5A32] font-black">
              체감 {formatCurrency(customer.netAmount)}원
            </span>
          </div>
        </div>
      </div>

      {/* 하단: 물류/사은품 미니 상태 + 빠른 액션 */}
      <div className="flex items-center justify-between pt-1.5 border-t border-[#E4DFD5]">
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
              customer.logisticsConfirmed
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-[#F4F2ED] text-[#78716C]'
            }`}
          >
            <Truck className="w-2.5 h-2.5" />
            {customer.logisticsConfirmed ? '물류확정' : '물류대기'}
          </span>

          {customer.giftItems && (
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                hasUnpaidGift
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Gift className="w-2.5 h-2.5" />
              {customer.giftSent ? '사은품완료' : '사은품미지급'}
            </span>
          )}
        </div>

        {/* 우측 퀵 버튼 (이벤트 버블링 방지) */}
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
              className="p-1.5 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE5DC] text-[#18181B] border border-[#D6D3CD] transition"
              title="전화 걸기"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => onOpenSMS(customer, e)}
            className="px-2.5 py-1.5 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE5DC] text-[#18181B] border border-[#D6D3CD] text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer"
            title="안내 문자 발송"
          >
            <MessageSquare className="w-3 h-3" />
            <span>안내문자</span>
          </button>
          <button
            type="button"
            onClick={(e) => onOpenQuote(customer, e)}
            className="px-2.5 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#292524] text-white text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
            title="견적기에서 불러오기"
          >
            <Calculator className="w-3 h-3 text-amber-400" />
            <span>견적서 열기</span>
          </button>
          <span className="text-stone-400 group-hover:text-[#8C5A32] pl-0.5">
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
};
