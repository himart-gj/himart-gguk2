import React from 'react';
import { CheckCircle2, FileText, Truck, X } from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { hasUnpaidGift } from '../utils/date';

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
 * 요청사항 반영: 복잡한 정보 없이 간단하게 [고객명 + 전표번호]만 띄우고 옆에 [배송완료] 버튼을 배치
 */
export const PastDeliveryCheckModal: React.FC<PastDeliveryCheckModalProps> = ({
  isOpen,
  customers,
  isDark = false,
  onConfirmDelivered,
  onConfirmAllDelivered,
  onClose,
}) => {
  if (!isOpen || customers.length === 0) return null;

  const cardCls = isDark
    ? 'bg-[#151A25] text-slate-100 border-white/15'
    : 'bg-white text-[#18181B] border-[#E4DFD5]';

  return (
    <div
      className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden schedule-sheet-enter ${cardCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark
              ? 'bg-[#111622] border-white/10'
              : 'bg-[#FAF8F4] border-[#E4DFD5]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black">
                  배송일 경과 고객 확인
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white">
                  {customers.length}건
                </span>
              </div>
              <p className="text-[11px] opacity-70 font-medium mt-0.5">
                배송일이 지났습니다. 배송이 완료되었다면 옆의 버튼을 눌러주세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/10 cursor-pointer"
            title="나중에 확인"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60dvh] overflow-y-auto">
          {customers.map((c) => {
            const voucher = (c.orderNo || '').trim();
            const pendingGift = hasUnpaidGift(c);
            return (
              <div
                key={c.id}
                className={`px-3.5 py-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#1B2230] border-white/10'
                    : 'bg-[#FAF8F4] border-[#E4DFD5]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black truncate">
                      {c.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-extrabold border ${
                        voucher
                          ? isDark
                            ? 'bg-slate-800 text-amber-300 border-amber-400/30'
                            : 'bg-white text-[#18181B] border-[#D6D0C4]'
                          : 'opacity-55 border-dashed border-current text-[11px]'
                      }`}
                    >
                      <FileText className="w-3 h-3 opacity-70" />
                      <span>{voucher ? `전표 ${voucher}` : '전표번호 미입력'}</span>
                    </span>
                  </div>
                  <div className="text-[11px] opacity-65 font-semibold mt-0.5 flex items-center gap-2">
                    <span>배송예정일: {c.deliveryDate}</span>
                    {pendingGift && (
                      <span className="text-rose-500 font-extrabold">
                        · 🎁 사은품 미지급 (완료 후에도 목록 유지)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onConfirmDelivered(c.id)}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>배송완료</span>
                </button>
              </div>
            );
          })}
        </div>

        <div
          className={`px-4 py-3 border-t flex items-center justify-between gap-2 ${
            isDark ? 'border-white/10 bg-[#111622]' : 'border-[#E4DFD5] bg-[#FAF8F4]'
          }`}
        >
          <span className="text-[11px] opacity-70 font-medium">
            * 사은품 미지급 고객은 배송완료 후에도 첫 화면에 유지됩니다
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {onConfirmAllDelivered && customers.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onConfirmAllDelivered(customers.map((item) => item.id))
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-300 text-xs font-black cursor-pointer"
              >
                전체 완료
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-white/10 text-slate-200'
                  : 'bg-white border-[#D6D3CD] text-[#57534E]'
              }`}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
