import React, { useEffect, useMemo, useState } from 'react';
import { Coins, PhoneCall, UserPlus, X } from 'lucide-react';
import {
  CustomerFreedCounts,
  CustomerItem,
  CustomerSaleType,
  CustomerStatus,
} from '../types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getFridayDateStr,
  getNowDateTimeStr,
  getOffsetDateStr,
  getTodayStr,
} from '../utils/date';
import {
  calculateFreedIncentiveDetail,
  createEmptyFreedCounts,
  parsePurchasedModelsFromItemsText,
} from '../utils/settlementEngine';

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
  const [saleType, setSaleType] = useState<CustomerSaleType>('general');
  const [items, setItems] = useState('');
  const [performanceAmount, setPerformanceAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [expectedBenefit, setExpectedBenefit] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('계약완료');
  const [memo, setMemo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [giftItems, setGiftItems] = useState('');
  const [logisticsConfirmed, setLogisticsConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [freedCounts, setFreedCounts] = useState<CustomerFreedCounts>(() =>
    createEmptyFreedCounts()
  );

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setName(prefillData?.name || '');
      setPhone(prefillData?.phone || '');
      setSaleType(prefillData?.saleType || 'general');
      setItems(prefillData?.items || '');
      setPerformanceAmount(
        prefillData?.performanceAmount
          ? String(prefillData.performanceAmount)
          : prefillData?.paidAmount
          ? String(prefillData.paidAmount)
          : ''
      );
      setPaidAmount(
        prefillData?.paidAmount ? String(prefillData.paidAmount) : ''
      );
      setNetAmount(prefillData?.netAmount ? String(prefillData.netAmount) : '');
      setExpectedBenefit(prefillData?.expectedBenefit || '');
      setContractDate(prefillData?.contractDate || getTodayStr());
      setDeliveryDate(prefillData?.deliveryDate || '');
      setFollowUpDate(prefillData?.followUpDate || '');
      setStatus(prefillData?.status || '신규/미발송');
      setMemo(prefillData?.memo || '');
      setOrderNo(prefillData?.orderNo || '');
      setGiftItems(prefillData?.giftItems || '');
      setLogisticsConfirmed(Boolean(prefillData?.logisticsConfirmed));
      setFreedCounts(prefillData?.freedCounts || createEmptyFreedCounts());
    }
  }, [isOpen, prefillData]);

  const freedPreview = useMemo(
    () => calculateFreedIncentiveDetail(freedCounts),
    [freedCounts]
  );

  if (!isOpen) return null;

  const adjustFreed = (key: keyof CustomerFreedCounts, delta: number) => {
    setFreedCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || (phone.trim() ? '직접등록 고객' : '');
    if (!cleanName) {
      setFormError('⚠️ 고객명 또는 연락처를 입력해 주세요.');
      return;
    }
    setFormError(null);

    const perfNum = Number(String(performanceAmount).replace(/\D/g, '')) || 0;
    const paidNum = Number(String(paidAmount).replace(/\D/g, '')) || perfNum;
    const netNum = Number(String(netAmount).replace(/\D/g, '')) || paidNum;
    const resolvedPerf = perfNum > 0 ? perfNum : paidNum;

    const parsedModels = parsePurchasedModelsFromItemsText(
      items,
      saleType === 'subscription' ? 'subscription' : 'general'
    );

    const nowMs = Date.now();
    const newCustomer: CustomerItem = {
      id: `CUST-${nowMs}`,
      regDate: getNowDateTimeStr(),
      contractDate: contractDate.trim() || getTodayStr(),
      name: cleanName,
      phone: phone.trim(),
      saleType,
      items: items.trim(),
      performanceAmount: resolvedPerf,
      generalProductTotal: saleType === 'subscription' ? 0 : resolvedPerf,
      subscriptionPrincipal: saleType === 'subscription' ? resolvedPerf : 0,
      freedCounts,
      purchasedModels: parsedModels,
      paidAmount: paidNum,
      netAmount: netNum,
      expectedBenefit: expectedBenefit.trim(),
      deliveryDate: deliveryDate.trim(),
      followUpDate: followUpDate.trim(),
      status,
      memo: memo.trim(),
      orderNo: orderNo.trim(),
      giftItems: giftItems.trim(),
      giftSent: false,
      logisticsConfirmed,
      deletedAt: undefined,
      updatedAtMs: nowMs,
    };

    onSave(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh] modal-kb-safe">
        {/* 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black">신규 상담/계약 고객 등록</h3>
              <p className="text-[11px] text-slate-400">
                총판·실판 실적(원금/제품합계) · 프리드 · 구매 모델 수당 자동 연동
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
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="홍길동"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 판매 구분 선택 */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setSaleType('general')}
              className={`py-2 rounded-xl text-xs font-black cursor-pointer ${
                saleType === 'general'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              일반 구매 (제품 합계금액 기준)
            </button>
            <button
              type="button"
              onClick={() => setSaleType('subscription')}
              className={`py-2 rounded-xl text-xs font-black cursor-pointer ${
                saleType === 'subscription'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              가전 구독 (구독원금 기준)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              구매/상담 품목 및 모델명 (쉼표로 구분 시 모델별 수당 자동 매칭)
            </label>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="예: 냉장고(RM70F64M2X), 워시타워(W20WAN)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 실적기준 금액 + 고객 안내용 결제가/체감가 */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <div>
              <label className="block text-xs font-black text-emerald-900 mb-1">
                {saleType === 'subscription'
                  ? '💰 총판·실판 실적기준: 구독원금 (원)'
                  : '💰 총판·실판 실적기준: 제품 합계 금액 (원)'}
              </label>
              <input
                type="number"
                value={performanceAmount}
                onChange={(e) => setPerformanceAmount(e.target.value)}
                placeholder={
                  saleType === 'subscription'
                    ? '예: 2490000 (월요금이 아닌 총 구독원금)'
                    : '예: 6200000 (할인 전 제품 합계 금액)'
                }
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-white text-base sm:text-sm font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  {saleType === 'subscription'
                    ? '월 기준 구독료 (선택)'
                    : '고객 실결제가 (선택)'}
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="5400000"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">
                  최종 체감가 (선택)
                </label>
                <input
                  type="number"
                  value={netAmount}
                  onChange={(e) => setNetAmount(e.target.value)}
                  placeholder="4350000"
                  className="w-full px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-base sm:text-xs font-bold text-blue-900"
                />
              </div>
            </div>
          </div>

          {/* 프리드 가입 종류·건수 원터치 입력 (수당 즉시 미리보기) */}
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                💎 프리드 가입 건수 (선택 시 수당 자동 합산)
              </span>
              {freedPreview.totalIncentive > 0 && (
                <span className="text-xs font-black font-mono text-amber-700">
                  수당 +{formatCurrency(freedPreview.totalIncentive)}원
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
              {[
                { key: 'hi90' as const, label: '플러스구독', sub: '9만' },
                { key: 'hf75' as const, label: '프리드75', sub: '6만' },
                { key: 'hf150' as const, label: '프리드150', sub: '12만' },
                { key: 'hf225' as const, label: '프리드225', sub: '18만' },
                { key: 'hf300' as const, label: '프리드300', sub: '24만' },
              ].map((item) => {
                const val =
                  item.key === 'hi90'
                    ? freedCounts.hi72 + freedCounts.hi90 + freedCounts.hi108
                    : freedCounts[item.key];
                return (
                  <div
                    key={item.key}
                    className="bg-white rounded-xl border border-amber-200 p-1.5 space-y-1"
                  >
                    <div className="text-[10px] font-black text-slate-800">
                      {item.label}
                    </div>
                    <div className="text-[9.5px] font-bold text-amber-700">
                      건당 {item.sub}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustFreed(item.key, -1)}
                        className="w-5 h-5 rounded bg-slate-100 text-xs font-black cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-5 text-xs font-black font-mono">
                        {val}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustFreed(item.key, 1)}
                        className="w-5 h-5 rounded bg-amber-500 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 진행상태 · 계약일(총판월) · 배송예정일(실판월) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                진행 상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="신규/미발송">신규/미발송 (미구매)</option>
                <option value="상담진행중">상담진행중 (미구매)</option>
                <option value="미구매/고민중">미구매/고민중</option>
                <option value="계약완료">✅ 계약완료 (구매확정)</option>
                <option value="발송완료">📩 발송완료 (견적안내 완료)</option>
                <option value="배송완료">🚚 배송완료 (설치·인도 완료)</option>
                <option value="취소/보류">취소/보류</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-1">
                계약일 (총판월)
              </label>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-emerald-200 text-base sm:text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">
                배송 예정일 (실판월)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-blue-200 text-base sm:text-xs font-semibold"
              />
            </div>
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-semibold"
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-semibold"
              />
            </div>
          </div>

          {/* 📞 재연락 예정일(선택) */}
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
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold cursor-pointer"
                >
                  +3일 뒤
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(false))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold cursor-pointer"
                >
                  이번 주 금요일
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpDate(getFridayDateStr(true))}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold cursor-pointer"
                >
                  다음 주 금요일
                </button>
              </div>
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-base sm:text-xs font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              혜택 요약 / 상담 메모
            </label>
            <input
              type="text"
              value={expectedBenefit}
              onChange={(e) => setExpectedBenefit(e.target.value)}
              placeholder="예: 제휴카드 캐시백 45만 + 다품목 60만"
              className="w-full px-3.5 py-2 mb-2 rounded-xl border border-slate-200 text-base sm:text-xs font-semibold"
            />
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="고객 요청사항, 타사 비교견적, 카드 발급 일정 등 기록"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
            />
          </div>

          {formError && (
            <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-700">
              {formError}
            </div>
          )}

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
