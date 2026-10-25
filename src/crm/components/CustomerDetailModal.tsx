import React from 'react';
import { X } from 'lucide-react';
import { CustomerItem, CustomerStatus, QuoteRecord } from '../types/crm';
import { CustomerCard } from './CustomerCard';

interface CustomerDetailModalProps {
  customer: CustomerItem | null;
  onClose: () => void;
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

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
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
  if (!customer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 닫기 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight">
              {customer.name} 고객님 상세 카드 & 견적 보관함
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 기존 CustomerCard 전체 기능 그대로 렌더링 */}
        <div className="p-3 sm:p-4 bg-slate-100">
          <CustomerCard
            customer={customer}
            onStatusChange={onStatusChange}
            onMemoChange={onMemoChange}
            onFieldChange={onFieldChange}
            onDeleteQuoteRecord={onDeleteQuoteRecord}
            onApplyQuoteAsPrimary={onApplyQuoteAsPrimary}
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
        </div>
      </div>
    </div>
  );
};
