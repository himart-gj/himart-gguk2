import React, { useEffect } from 'react';
import { X, User } from 'lucide-react';
import { CustomerItem, PipelineStatus, QuoteRecord, ConsultationLog } from '../types/crm';
import { CustomerCard } from './CustomerCard';

interface CustomerDetailModalProps {
  customer: CustomerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSMS: (customer: CustomerItem) => void;
  onOpenQuote: (customer: CustomerItem) => void;
  onLoadQuoteRecord?: (quote: QuoteRecord, customer: CustomerItem) => void;
  onUpdateStatus: (id: string, newStatus: PipelineStatus) => void;
  onUpdateNote: (id: string, newNote: string) => void;
  onAddLog?: (id: string, log: ConsultationLog) => void;
  onDeleteLog?: (customerId: string, logId: string) => void;
  onDeleteQuote?: (customerId: string, quoteId: string) => void;
  onUpdateGift?: (customerId: string, giftItem: string, isGiftDelivered: boolean) => void;
  onDeleteCustomer?: (customerId: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  onOpenSMS,
  onOpenQuote,
  onLoadQuoteRecord,
  onUpdateStatus,
  onUpdateNote,
  onAddLog,
  onDeleteLog,
  onDeleteQuote,
  onUpdateGift,
  onDeleteCustomer,
}) => {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !customer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-100 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black truncate tracking-tight">
                  {customer.name} 고객 상세 관리
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {customer.phone || '연락처 없음'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                상담 타임라인 메모, 견적 이력 복원, 약속 사은품 관리 등 전체 심층 기능
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer ml-2 flex-shrink-0"
            title="닫기 (ESC)"
          >
            <span>닫기</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Wraps Full-Featured CustomerCard with pre-expanded mode */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain">
          <CustomerCard
            customer={customer}
            defaultExpanded={true}
            onOpenSMS={onOpenSMS}
            onOpenQuote={(c) => {
              onClose();
              onOpenQuote(c);
            }}
            onLoadQuoteRecord={(quote, c) => {
              onClose();
              if (onLoadQuoteRecord) onLoadQuoteRecord(quote, c);
            }}
            onUpdateStatus={onUpdateStatus}
            onUpdateNote={onUpdateNote}
            onAddLog={onAddLog}
            onDeleteLog={onDeleteLog}
            onDeleteQuote={onDeleteQuote}
            onUpdateGift={onUpdateGift}
            onDeleteCustomer={(id) => {
              onClose();
              if (onDeleteCustomer) onDeleteCustomer(id);
            }}
          />
        </div>
      </div>
    </div>
  );
};
