import React from 'react';
import { UserCheck } from 'lucide-react';
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
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title={`${customer.name} 고객님 상세 카드 & 견적 보관함`}
      badge={customer.status}
      icon={<UserCheck className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />}
      maxWidthClass="max-w-2xl"
      bodyClassName="p-3 sm:p-4 overflow-y-auto flex-1 bg-[#F2F4F6] dark:bg-[#0B1120]"
      closeOnBackdrop={true}
    >
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
    </FlagshipModalShell>
  );
};
