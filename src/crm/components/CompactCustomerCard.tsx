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
      className={`group relative bg-white rounded-2xl border transition-all duration-150 cursor-pointer hover:shadow-md hover:border-blue-400 p-3.5 flex flex-col justify-between gap-2.5 ${
        urgent
          ? 'border-l-4 border-l-rose-500 border-slate-200 shadow-xs'
          : 'border-slate-200/90 shadow-2xs'
      }`}
    >
      {/* 상단: 고객명 + 연락처 + 상태/배송 뱃지 */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-black text-slate-900 tracking-tight truncate group-hover:text-blue-600 transition-colors">
                {customer.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                  STATUS_BADGE[customer.status]
                }`}
              >
                {customer.status}
              </span>
              {quoteCount > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <FolderKanban className="w-2.5 h-2.5" />
                  견적 {quoteCount}
                </span>
              )}
              {followUp.hasFollowUp && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
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

          {/* 배송 D-Day 뱃지 */}
          <span
            className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${dday.badgeClass}`}
          >
            {dday.label}
          </span>
        </div>

        {/* 중단: 관심품목 1줄 요약 */}
        <div className="mt-2 bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100">
          <p className="text-xs font-bold text-slate-800 line-clamp-1">
            {customer.items || '상담 품목 미입력'}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              결제{' '}
              <strong className="text-slate-700 font-extrabold">
                {formatCurrency(customer.paidAmount)}원
              </strong>
            </span>
            <span className="text-blue-600 font-black">
              체감 {formatCurrency(customer.netAmount)}원
            </span>
          </div>
        </div>
      </div>

      {/* 하단: 물류/사은품 미니 상태 + 빠른 액션 */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
              customer.logisticsConfirmed
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Truck className="w-2.5 h-2.5" />
            {customer.logisticsConfirmed ? '물류확정' : '물류대기'}
          </span>

          {customer.giftItems && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
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
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="전화 걸기"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => onOpenSMS(customer, e)}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition cursor-pointer"
            title="안내 문자 발송"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => onOpenQuote(customer, e)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 transition cursor-pointer"
            title="신규 견적기에서 불러오기"
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-300 group-hover:text-blue-500 pl-0.5">
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
};
