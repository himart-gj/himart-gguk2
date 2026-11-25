import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Search, Truck } from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { hasUnpaidGift } from '../utils/date';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';

interface PastDeliveryCheckModalProps {
  isOpen: boolean;
  customers: CustomerItem[];
  isDark?: boolean;
  onConfirmDelivered: (customerId: string) => void;
  onConfirmAllDelivered?: (customerIds: string[]) => void;
  onClose: () => void;
}

/**
 * 배송 예정일이 지난 고객 자동 확인 팝업
 * 요청사항 반영: 다중 전표(customer.quotes 내부 모든 orderNo) 표시 및 100% 검색 매칭 지원
 */
export const PastDeliveryCheckModal: React.FC<PastDeliveryCheckModalProps> = ({
  isOpen,
  customers,
  isDark = false,
  onConfirmDelivered,
  onConfirmAllDelivered,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customers;
    const qCompact = q.replace(/[-\s]/g, '');
    return customers.filter((c) => {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.phone || '').replace(/\D/g, '').includes(qCompact) ||
        Boolean(c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
        Boolean(
          qCompact &&
            c.orderNo &&
            c.orderNo.toLowerCase().replace(/[-\s]/g, '').includes(qCompact)
        )
      ) {
        return true;
      }
      return (c.quotes || []).some(
        (qt) =>
          Boolean(qt.orderNo && qt.orderNo.toLowerCase().includes(q)) ||
          Boolean(
            qCompact &&
              qt.orderNo &&
              qt.orderNo.toLowerCase().replace(/[-\s]/g, '').includes(qCompact)
          ) ||
          Boolean(qt.itemSummary && qt.itemSummary.toLowerCase().includes(q))
      );
    });
  }, [customers, searchTerm]);

  if (!isOpen || customers.length === 0) return null;

  return (
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title="배송일 경과 고객 확인"
      subtitle="배송일이 지났습니다. 배송이 완료되었다면 옆의 버튼을 눌러주세요."
      badge={`${customers.length}건`}
      icon={<Truck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />}
      maxWidthClass="max-w-md"
      zIndexClass="z-60 no-print"
      bodyClassName="p-4 space-y-2.5 max-h-[65dvh] overflow-y-auto"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium">
            * 사은품 미지급 고객은 배송완료 후에도 첫 화면에 유지됩니다
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {onConfirmAllDelivered && filteredCustomers.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onConfirmAllDelivered(filteredCustomers.map((item) => item.id))
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-extrabold cursor-pointer"
              >
                전체 완료
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F2F4F6]'
              }`}
            >
              나중에
            </button>
          </div>
        </div>
      }
    >
      {customers.length >= 2 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8B95A1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="고객명 · 연락처 · 모든 전표번호 검색..."
            className={`w-full pl-8 pr-3 py-2 rounded-xl border text-base sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B64DA] ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-[#D1D6DB] text-[#191F28] placeholder:text-[#8B95A1]'
            }`}
          />
        </div>
      )}

      {filteredCustomers.length === 0 ? (
        <div className="py-6 text-center text-xs font-semibold text-[#8B95A1] dark:text-slate-400">
          검색어와 일치하는 고객/전표번호가 없습니다.
        </div>
      ) : (
        filteredCustomers.map((c) => {
          const slipOrderNos = Array.from(
            new Set(
              [
                ...(c.quotes || [])
                  .filter((q) => q?.isConfirmedSlip && q.deliveryStatus !== '배송완료')
                  .map((q) => (q.orderNo || '').trim()),
                ...(c.quotes || []).map((q) => (q.orderNo || '').trim()),
                (c.orderNo || '').trim(),
              ].filter(Boolean)
            )
          );
          const pendingGift = hasUnpaidGift(c);
          return (
            <div
              key={c.id}
              className={`px-3.5 py-3 rounded-2xl border flex items-center justify-between gap-3 ${
                isDark
                  ? 'bg-slate-900/70 border-slate-800'
                  : 'bg-[#F8FAFC] border-[#E5E8EB]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                    {c.name}
                  </span>
                  {slipOrderNos.length > 0 ? (
                    slipOrderNos.map((vNo) => (
                      <span
                        key={vNo}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono tabular-nums font-extrabold border ${
                          isDark
                            ? 'bg-slate-800 text-blue-300 border-blue-500/30'
                            : 'bg-white text-[#191F28] border-[#D1D6DB]'
                        }`}
                      >
                        <FileText className="w-3 h-3 opacity-70" />
                        <span>전표 {vNo}</span>
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono tabular-nums font-extrabold border text-[#8B95A1] dark:text-slate-400 border-dashed border-[#D1D6DB] dark:border-slate-700 text-[11.5px]">
                      <FileText className="w-3 h-3 opacity-70" />
                      <span>전표번호 미입력</span>
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono tabular-nums">배송예정일: {c.deliveryDate}</span>
                  {pendingGift && (
                    <span className="text-[#E60012] dark:text-[#FF3B47] font-extrabold">
                      · 🎁 사은품 미지급 (완료 후에도 목록 유지)
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onConfirmDelivered(c.id)}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>배송완료</span>
              </button>
            </div>
          );
        })
      )}
    </FlagshipModalShell>
  );
};
