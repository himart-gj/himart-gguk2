import React from 'react';
import { Camera, PlusCircle, UserCheck } from 'lucide-react';
import { CustomerItem, CustomerStatus, QuoteRecord } from '../types/crm';
import { CustomerCard } from './CustomerCard';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';

interface CustomerDetailModalProps {
  customer: CustomerItem | null;
  onClose: () => void;
  onStatusChange: (id: string, nextStatus: CustomerStatus) => void;
  onMemoChange: (id: string, nextMemo: string) => void;
  onFieldChange: (id: string, patch: Partial<CustomerItem>) => void;
  onDeleteQuoteRecord: (customerId: string, quoteId: string) => void;
  onApplyQuoteAsPrimary: (customerId: string, quote: QuoteRecord) => void;
  onToggleSlipDeliveryStatus?: (customerId: string, quoteId: string) => void;
  onAddSlipForCustomer?: (customer: CustomerItem) => void;
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
  onAddSlipForCustomer,
  onLoadQuoteRecord,
  onDelete,
  onOpenSMS,
  onOpenQuote,
}) => {
  if (!customer) return null;

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
      {/* 상단 원클릭 재구매/전표 추가 & 새 견적 작성 바 */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
        {onAddSlipForCustomer && (
          <button
            type="button"
            id="crm-detail-add-slip-btn"
            onClick={() => onAddSlipForCustomer(customer)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>이 고객에 전표 사진 추가</span>
          </button>
        )}

        <button
          type="button"
          id="crm-detail-new-quote-btn"
          onClick={() => {
            onClose();
            onOpenQuote(customer);
          }}
          className="w-full py-2.5 px-3.5 rounded-xl bg-white dark:bg-[#131C2E] hover:bg-[#F8FAFC] dark:hover:bg-slate-800 text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4 text-[#E60012] dark:text-rose-400 shrink-0" />
          <span>이 고객 새 견적 작성</span>
        </button>
      </div>

      <CustomerCard
        customer={customer}
        onStatusChange={onStatusChange}
        onMemoChange={onMemoChange}
        onFieldChange={onFieldChange}
        onDeleteQuoteRecord={onDeleteQuoteRecord}
        onApplyQuoteAsPrimary={onApplyQuoteAsPrimary}
        onToggleSlipDeliveryStatus={onToggleSlipDeliveryStatus}
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
