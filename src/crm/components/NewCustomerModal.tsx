import React, { useEffect, useState } from 'react';
import { PhoneCall, UserPlus, X } from 'lucide-react';
import { CustomerItem, CustomerStatus } from '../types/crm';
import {
  formatPhoneNumber,
  getFridayDateStr,
  getNowDateTimeStr,
  getOffsetDateStr,
} from '../utils/date';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newCustomer: CustomerItem) => void;
  prefillData?: Partial<CustomerItem> | null;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  prefillData,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [expectedBenefit, setExpectedBenefit] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('신규/미발송');
  const [memo, setMemo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [giftItems, setGiftItems] = useState('');
  const [logisticsConfirmed, setLogisticsConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(prefillData?.name || '');
      setPhone(prefillData?.phone || '');
      setItems(prefillData?.items || '');
      setPaidAmount(
        prefillData?.paidAmount ? String(prefillData.paidAmount) : ''
      );
      setNetAmount(prefillData?.netAmount ? String(prefillData.netAmount) : '');
      setExpectedBenefit(prefillData?.expectedBenefit || '');
      setDeliveryDate(prefillData?.deliveryDate || '');
      setFollowUpDate(prefillData?.followUpDate || '');
      setStatus(prefillData?.status || '신규/미발송');
      setMemo(prefillData?.memo || '');
      setOrderNo(prefillData?.orderNo || '');
      setGiftItems(prefillData?.giftItems || '');
      setLogisticsConfirmed(Boolean(prefillData?.logisticsConfirmed));
    }
  }, [isOpen, prefillData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCustomer: CustomerItem = {
      id: `CUST-${Date.now()}`,
      regDate: getNowDateTimeStr(),
      name: name.trim(),
      phone: phone.trim(),
      items: items.trim(),
      paidAmount: Number(paidAmount.replace(/\D/g, '')) || 0,
      netAmount: Number(netAmount.replace(/\D/g, '')) || 0,
      expectedBenefit: expectedBenefit.trim(),
      deliveryDate: deliveryDate.trim(),
      followUpDate: followUpDate.trim(),
      status,
      memo: memo.trim(),
      orderNo: orderNo.trim(),
      giftItems: giftItems.trim(),
      giftSent: false,
      logisticsConfirmed,
    };

    onSave(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black">신규 상담/계약 고객 등록</h3>
              <p className="text-[11px] text-slate-400">
                매장 상담 내역, 재연락 예정일 및 사은품 약속을 기록합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleSubmit}
          className="p-5 overflow-y-auto space-y-3.5 flex-1"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                고객명 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                연락처
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                placeholder="010-1234-5678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              관심품목 / 모델명
            </label>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="예: 오브제 냉장고 + 워시타워 웨딩 패키지"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                결제 예정 금액 (원)
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="5400000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">
                최종 체감가 (원)
              </label>
              <input
                type="number"
                value={netAmount}
                onChange={(e) => setNetAmount(e.target.value)}
                placeholder="4350000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-blue-50/40 text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              예상 혜택 요약 (캐시백/상품권/포인트 등)
            </label>
            <input
              type="text"
              value={expectedBenefit}
              onChange={(e) => setExpectedBenefit(e.target.value)}
              placeholder="예: 제휴카드 캐시백 45만 + 다품목 60만"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 매장 실전 필드: 전표번호 & 약속 사은품 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                전표번호 / 계약번호 (선택)
              </label>
              <input
                type="text"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="예: 250516-0042"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                약속 사은품 내역 (선택)
              </label>
              <input
                type="text"
                value={giftItems}
                onChange={(e) => setGiftItems(e.target.value)}
                placeholder="예: 독일 냄비 3종 세트"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                배송 희망일
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                진행 상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="신규/미발송">신규/미발송</option>
                <option value="발송완료">발송완료</option>
                <option value="상담진행중">상담진행중</option>
                <option value="미구매/고민중">미구매/고민중</option>
                <option value="계약완료">계약완료</option>
                <option value="취소/보류">취소/보류</option>
              </select>
            </div>
          </div>

          {/* 📞 재연락 예정일(선택) + 원터치 빠른 선택 버튼 */}
          <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-extrabold text-indigo-900 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                📞 재연락 예정일(선택)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getOffsetDateStr(3))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  +3일 뒤
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(false))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  이번 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(true))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer"
                >
                  다음 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate('')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold transition cursor-pointer"
                >
                  초기화
                </button>
              </div>
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              상담 메모 / 특이사항
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="고객 요청사항, 타사 비교견적, 카드 발급 일정 등 기록"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
            >
              고객 등록 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
