import React from 'react';
import { Phone, MessageSquare, Calculator, ChevronRight, Gift, Package, Calendar } from 'lucide-react';
import { CustomerItem, PipelineStatus } from '../types/crm';

interface CompactCustomerCardProps {
  customer: CustomerItem;
  onOpenSMS: (customer: CustomerItem) => void;
  onOpenQuote: (customer: CustomerItem) => void;
  onOpenDetail: (customer: CustomerItem) => void;
  onUpdateStatus: (id: string, newStatus: PipelineStatus) => void;
}

const STATUS_COLOR_MAP: Record<PipelineStatus, { bg: string; text: string; border: string }> = {
  '신규/미발송': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  '상담진행중': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  '미구매/고민중': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  '물류대기': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  '배송대기': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  '배송완료': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const ALL_STATUSES: PipelineStatus[] = [
  '신규/미발송',
  '상담진행중',
  '미구매/고민중',
  '물류대기',
  '배송대기',
  '배송완료',
];

export const CompactCustomerCard: React.FC<CompactCustomerCardProps> = ({
  customer,
  onOpenSMS,
  onOpenQuote,
  onOpenDetail,
  onUpdateStatus,
}) => {
  const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
  const statusTheme = STATUS_COLOR_MAP[customer.status] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  const getDDayBadge = () => {
    if (customer.dDay === null || customer.dDay === undefined) return null;
    if (customer.dDay === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse shadow-xs">
          🚨 오늘 배송 (D-0)
        </span>
      );
    }
    if (customer.dDay === 1) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-xs">
          ⏰ 내일 배송 (D-1)
        </span>
      );
    }
    if (customer.dDay > 1 && customer.dDay <= 7) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          D-{customer.dDay}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
        {customer.dDay > 0 ? `D-${customer.dDay}` : `배송경과 (+${Math.abs(customer.dDay)}일)`}
      </span>
    );
  };

  const hasPendingGift = Boolean(customer.giftItem && !customer.isGiftDelivered);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-150 flex flex-col justify-between overflow-hidden group">
      <div className="p-3.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-slate-900 tracking-tight truncate">
                {customer.name}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border}`}>
                {customer.status}
              </span>
              {getDDayBadge()}
              {hasPendingGift && (
                <span title={`사은품 미지급: ${customer.giftItem}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                  <Gift className="w-2.5 h-2.5 text-amber-600" /> 사은품
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="font-mono text-slate-600">{customer.phone || '연락처 없음'}</span>
              {customer.deliveryDate && (
                <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                  <Calendar className="w-3 h-3 text-slate-400" /> {customer.deliveryDate}
                </span>
              )}
            </div>
          </div>

          {/* 우측 상단: [상태 ▾] 컴팩트 드롭다운 */}
          <div className="shrink-0">
            <select
              value={customer.status}
              onChange={(e) => onUpdateStatus(customer.id, e.target.value as PipelineStatus)}
              className="text-[11px] font-bold py-1 px-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              title="상태 빠른 변경"
            >
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 품목 및 체감가 요약 */}
        <div className="mt-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-700 font-medium truncate" title={customer.items || customer.category || '가전 견적'}>
              {customer.items || customer.category || '가전 견적'}
            </span>
          </div>
          <div className="text-right shrink-0">
            {customer.paidAmount && customer.paidAmount > 0 ? (
              <div>
                <span className="text-xs font-black text-slate-900">{customer.paidAmount.toLocaleString()}원</span>
                {customer.netAmount !== undefined && customer.netAmount !== customer.paidAmount && (
                  <div className="text-[10px] text-rose-600 font-bold">체감 {customer.netAmount.toLocaleString()}원</div>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">견적 산출 전</span>
            )}
          </div>
        </div>
      </div>

      {/* 하단 4대 액션 버튼: 전화, 문자, 견적서 계산, 상세 */}
      <div className="p-2.5 pt-0 bg-white">
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
          <a
            href={cleanPhone ? `tel:${cleanPhone}` : undefined}
            className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 font-bold text-xs border border-slate-200 transition active:scale-95 text-center shrink-0"
            title="전화 걸기"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>전화</span>
          </a>

          <button
            type="button"
            onClick={() => onOpenSMS(customer)}
            className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-sky-50 text-slate-700 font-bold text-xs border border-slate-200 transition active:scale-95 text-center shrink-0 cursor-pointer"
            title="문자 발송"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
            <span>문자</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuote(customer)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-2xs transition active:scale-95 cursor-pointer truncate"
            title="계산기로 견적 작성/수정"
          >
            <Calculator className="w-3.5 h-3.5 text-white shrink-0" />
            <span>견적서 계산</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(customer)}
            className="flex items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition active:scale-95 cursor-pointer shrink-0"
            title="고객 상세 및 이력 전체보기"
          >
            <span>상세</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
