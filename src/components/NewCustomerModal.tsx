import React, { useState } from 'react';
import { X, UserPlus, Calendar, Phone, FileText } from 'lucide-react';
import { CustomerItem, PipelineStatus } from '../types/crm';
import { calculateDDay } from '../services/gasApi';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newCustomer: CustomerItem) => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<PipelineStatus>('배송대기');
  const [slipNo, setSlipNo] = useState('');
  const [items, setItems] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [netAmount, setNetAmount] = useState<number | ''>('');
  const [benefit, setBenefit] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [note, setNote] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('고객명을 입력해주세요.');
      return;
    }
    setErrorMessage(null);

    const dDay = calculateDDay(deliveryDate);
    const newRecord: CustomerItem = {
      id: `manual-${Date.now()}`,
      source: slipNo ? 'tab2' : 'tab1',
      name: name.trim(),
      phone: phone.trim(),
      slipNo: slipNo.trim(),
      category: items.trim() || '신규 등록 가전',
      items: items.trim(),
      paidAmount: paidAmount === '' ? undefined : Number(paidAmount),
      netAmount: netAmount === '' ? undefined : Number(netAmount),
      benefit: benefit.trim(),
      deliveryDate: deliveryDate || undefined,
      status,
      rawStatus: status,
      date: new Date().toLocaleDateString('ko-KR'),
      note: note.trim(),
      docUrl: docUrl.trim(),
      dDay,
      isSmsSent: false,
    };

    onAdd(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-base font-bold">신규 고객 / 배송 파이프라인 등록</h3>
              <p className="text-[11px] text-slate-300">신규 상담 고객 또는 배송 확정 건 추가</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMessage}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">고객명 *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">연락처</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">파이프라인 상태</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PipelineStatus)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:outline-rose-500"
              >
                <option value="신규/미발송">📋 신규/미발송</option>
                <option value="배송대기">🚚 배송대기</option>
                <option value="물류대기">📦 물류대기</option>
                <option value="미구매/고민중">🤔 미구매/고민중</option>
                <option value="상담진행중">💬 상담진행중</option>
                <option value="배송완료">✅ 배송완료</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">전표번호 (매장결제 시)</label>
              <input
                type="text"
                value={slipNo}
                onChange={(e) => setSlipNo(e.target.value)}
                placeholder="예: 20260927-0012"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">구매/관심 품목 및 모델명</label>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="예: LG 오브제 4도어 냉장고 + 세탁건조기"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">실결제금액 (원)</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">체감구매가 (원)</label>
              <input
                type="number"
                value={netAmount}
                onChange={(e) => setNetAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block font-bold text-slate-700 mb-1">배송 예정일</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">적용 혜택 요약</label>
            <input
              type="text"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              placeholder="예: 롯데제휴카드 40만 캐시백 + 하이프리드 1구좌"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">메모 및 특이사항</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="고객 요청사항, 벽걸이 타공 유무, 사다리차 등"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">상담카드 URL (Google Docs 링크)</label>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-rose-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-md shadow-rose-900/20 active:scale-95"
            >
              등록 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
