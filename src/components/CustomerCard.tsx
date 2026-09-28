import React, { useState } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Tag, 
  FileText, 
  Edit3, 
  Check, 
  Calculator, 
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { CustomerItem, PipelineStatus, QuoteRecord, ConsultationLog } from '../types/crm';

interface CustomerCardProps {
  customer: CustomerItem;
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

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
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
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(customer.note || '');

  // Promised Gift state
  const [isEditingGift, setIsEditingGift] = useState(false);
  const [giftValue, setGiftValue] = useState(customer.giftItem || '');

  // Quotation & History Tab State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'quotes' | 'logs'>('quotes');

  // Quick Log State
  const [logType, setLogType] = useState<ConsultationLog['type']>('상담메모');
  const [logContent, setLogContent] = useState('');
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  // Deletion Confirmation States (No window.confirm to prevent iframe/mobile blocking)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // Status & D-Day badge
  const getDDayBadge = () => {
    if (customer.status === '신규/미발송') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
          📋 신규 접수 (미발송)
        </span>
      );
    }

    if (customer.status === '상담진행중') {
      if (customer.isSmsSent) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> 예약문자 발송완료 (상담중)
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
          💬 상담 진행중
        </span>
      );
    }

    if (customer.status === '미구매/고민중') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
          🤔 미구매 / 고민중
        </span>
      );
    }

    if (customer.status === '배송완료') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ 배송완료
        </span>
      );
    }

    if (customer.status === '물류대기') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
          📦 물류 입고 대기
        </span>
      );
    }

    // 배송대기 status: Show calculated D-Day badges
    if (customer.dDay !== null && customer.dDay !== undefined) {
      if (customer.dDay === 0) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
            🚨 D-Day 오늘 배송
          </span>
        );
      }
      if (customer.dDay === 1) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-xs">
            ⚡ D-1 내일 배송
          </span>
        );
      }
      if (customer.dDay === 2) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
            ⏱️ D-2 모레 배송
          </span>
        );
      }
      if (customer.dDay > 2) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            🚚 D-{customer.dDay} 배송대기
          </span>
        );
      }
      if (customer.dDay < 0) {
        const cleanDate = (customer.deliveryDate || '').match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0] || customer.deliveryDate?.slice(0, 10);
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
            🚚 배송 일정 {cleanDate ? `(${cleanDate})` : ''}
          </span>
        );
      }
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
        🚚 배송대기
      </span>
    );
  };

  const handleSaveGift = () => {
    if (onUpdateGift) {
      onUpdateGift(customer.id, giftValue, Boolean(customer.isGiftDelivered));
    }
    setIsEditingGift(false);
  };

  const handleToggleGiftDelivered = () => {
    const nextVal = !customer.isGiftDelivered;
    if (onUpdateGift) {
      onUpdateGift(customer.id, customer.giftItem || giftValue, nextVal);
    }
  };

  const handleDeleteCustomerClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteCustomer = () => {
    setShowDeleteConfirm(false);
    if (onDeleteCustomer) {
      onDeleteCustomer(customer.id);
    }
  };

  const handleSaveNote = () => {
    onUpdateNote(customer.id, noteValue);
    setIsEditingNote(false);
  };

  const formatPrice = (p?: number) => {
    if (p === undefined || p === null) return '-';
    return p.toLocaleString() + '원';
  };

  const handleAddQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logContent.trim()) return;

    const newLog: ConsultationLog = {
      id: 'log-' + Date.now(),
      date: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      type: logType,
      content: logContent.trim(),
      author: '담당자',
    };

    if (onAddLog) {
      onAddLog(customer.id, newLog);
    }
    setLogContent('');
  };

  const copyQuoteToClipboard = (quote: QuoteRecord) => {
    const text = `[롯데하이마트 경기광주점 견적 안내]
${customer.name} 고객님 맞춤 ${quote.title}
━━━━━━━━━━━━━━━━━━━
■ 상담 품목: ${quote.itemSummary}
■ 실결제금액: ${quote.paidAmount.toLocaleString()}원
■ 최종 체감가: ${quote.netAmount < 0 ? '0원' : quote.netAmount.toLocaleString() + '원'}
${quote.lumpCard ? `■ 제휴 혜택: ${quote.lumpCard}` : ''}
${quote.customerMemo ? `■ 추가 안내: ${quote.customerMemo}` : ''}
━━━━━━━━━━━━━━━━━━━
* 본 견적은 행사 기간 및 제휴카드 조건 충족 기준이며, 매장 방문 시 신속히 처리해 드립니다.
* 문의: 031-767-1044`;

    navigator.clipboard.writeText(text);
    setCopiedQuoteId(quote.id);
    setTimeout(() => setCopiedQuoteId(null), 2500);
  };

  const quotesCount = customer.quotes?.length || 0;
  const logsCount = customer.logs?.length || 0;

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      {/* ⚠️ Customer Delete Confirmation Overlay (In-app safe modal) */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-4 sm:p-5 text-center rounded-2xl border-2 border-rose-500 shadow-xl animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-2.5 shadow-sm">
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className="font-black text-slate-900 text-sm sm:text-base mb-1">
            [{customer.name}] 고객을 삭제할까요?
          </h4>
          <p className="text-xs text-slate-500 mb-4 max-w-[260px] leading-relaxed">
            고객 정보와 저장된 모든 견적 및 상담 기록이 CRM에서 완전히 삭제됩니다.
          </p>
          <div className="flex items-center gap-2.5 w-full max-w-[260px]">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteCustomer}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>영구 삭제</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {getDDayBadge()}
              {customer.reservationType && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold border ${
                  customer.reservationType === '이사'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : customer.reservationType === '입주'
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : customer.reservationType === '웨딩'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  🏷️ {customer.reservationType}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                {customer.source === 'tab1' ? '온라인 예약' : '매장 전표'}
              </span>
              {customer.slipNo && (
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={customer.slipNo}>
                  {customer.slipNo}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight shrink-0 whitespace-nowrap">
                {customer.name} <span className="text-xs font-normal text-slate-500">고객님</span>
              </h3>
              <a
                href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span>{customer.phone || '연락처 없음'}</span>
              </a>

              {customer.docUrl && (
                <a
                  href={customer.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1 transition shrink-0"
                  title="구글 드라이브 상담카드 열기"
                >
                  <FileText className="w-3 h-3 text-indigo-500" />
                  <span>상담카드</span>
                </a>
              )}
            </div>
          </div>

          {/* Quick status change dropdown & Delete button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select
              value={customer.status}
              onChange={(e) => onUpdateStatus(customer.id, e.target.value as PipelineStatus)}
              className="text-xs font-bold py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
            >
              <option value="신규/미발송">📋 신규/미발송</option>
              <option value="상담진행중">💬 상담진행</option>
              <option value="미구매/고민중">🤔 미구매/팔로우업</option>
              <option value="물류대기">📦 물류입고대기</option>
              <option value="배송대기">🚚 배송대기</option>
              <option value="배송완료">✅ 배송완료</option>
            </select>

            {onDeleteCustomer && (
              <button
                type="button"
                onClick={handleDeleteCustomerClick}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                title="고객 카드 영구 삭제"
              >
                <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body Information */}
      <div className="p-3.5 sm:p-4 space-y-2.5 text-xs text-slate-600 flex-1">
        {/* Category or Items */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Tag className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-semibold text-[11px] text-slate-500">관심 및 구매 품목</span>
          </div>
          <p className="font-bold text-slate-800 text-xs sm:text-sm pl-5 leading-snug">
            {customer.items || customer.category || '품목 정보 미기재'}
          </p>
        </div>

        {/* Pricing / Financials if available */}
        {(customer.paidAmount !== undefined || customer.netAmount !== undefined || customer.benefit) && (
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {customer.paidAmount !== undefined && (
              <div>
                <span className="text-[10px] text-slate-400 block">실결제금액</span>
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  {formatPrice(customer.paidAmount)}
                </span>
              </div>
            )}
            {customer.netAmount !== undefined && (
              <div>
                <span className="text-[10px] text-rose-500 block font-medium">최종 체감가</span>
                <span className="font-extrabold text-rose-600 text-xs sm:text-sm">
                  {customer.netAmount === 0 ? '체감 0원' : formatPrice(customer.netAmount)}
                </span>
              </div>
            )}
            {customer.benefit && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block">적용 혜택</span>
                <span className="text-[11px] text-slate-700 font-semibold truncate block">
                  {customer.benefit}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Delivery / Registration Date */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          {customer.deliveryDate ? (
            <div className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>배송예정일: {customer.deliveryDate}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>접수일시: {customer.date || '-'}</span>
            </div>
          )}

          {customer.service && (
            <span className="text-slate-500 text-[11px]">
              {customer.service}
            </span>
          )}
        </div>

        {/* Note / Memo box */}
        <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-[11px] text-slate-700 relative">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-amber-800 flex items-center gap-1">
              <span>📌</span> 매장 메모 / 특이사항
            </span>
            {!isEditingNote ? (
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-0.5 text-[10px]"
              >
                <Edit3 className="w-2.5 h-2.5" /> 수정
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveNote}
                className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-0.5 text-[10px]"
              >
                <Check className="w-3 h-3" /> 저장
              </button>
            )}
          </div>

          {isEditingNote ? (
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              className="w-full text-xs p-1.5 border border-amber-300 rounded bg-white text-slate-800 focus:outline-rose-500"
              rows={2}
            />
          ) : (
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {customer.note || '등록된 메모가 없습니다.'}
            </p>
          )}
        </div>

        {/* 🎁 약속 사은품 관리 (Promised Gifts Box) */}
        <div className={`rounded-xl p-2.5 sm:p-3 text-xs border transition ${
          customer.giftItem
            ? customer.isGiftDelivered
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
              : 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs ring-1 ring-amber-400/40'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm">🎁</span>
              <span className="font-black text-slate-900 text-xs">약속 사은품</span>
              {customer.giftItem ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  customer.isGiftDelivered 
                    ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' 
                    : 'bg-rose-500 text-white animate-pulse shadow-2xs'
                }`}>
                  {customer.isGiftDelivered ? '✓ 지급완료' : '⚠️ 미지급'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">(지급 약속 메모)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Checkbox for delivery completion */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-800 hover:text-emerald-700 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs transition active:scale-95">
                <input
                  type="checkbox"
                  checked={Boolean(customer.isGiftDelivered)}
                  onChange={handleToggleGiftDelivered}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                />
                <span className={customer.isGiftDelivered ? 'text-emerald-700 font-black' : 'text-slate-700'}>
                  {customer.isGiftDelivered ? '✓ 지급완료' : '지급완료 체크'}
                </span>
              </label>

              {!isEditingGift ? (
                <button
                  type="button"
                  onClick={() => { setGiftValue(customer.giftItem || ''); setIsEditingGift(true); }}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> {customer.giftItem ? '수정' : '+ 등록'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveGift}
                  className="text-emerald-700 hover:text-emerald-900 font-black flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> 저장
                </button>
              )}
            </div>
          </div>

          {isEditingGift ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="text"
                value={giftValue}
                onChange={(e) => setGiftValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGift(); }}
                placeholder="예: 냄비 3종 세트, 신세계 5만원권, 에어프라이어 등"
                className="flex-1 text-xs p-2 border border-indigo-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveGift}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setIsEditingGift(false)}
                className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                취소
              </button>
            </div>
          ) : (
            <div 
              onClick={() => { setGiftValue(customer.giftItem || ''); setIsEditingGift(true); }}
              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer transition flex items-center justify-between"
              title="클릭하여 약속 사은품 내용 입력/수정"
            >
              <p className="font-semibold text-xs text-slate-800">
                {customer.giftItem ? (
                  <span className="font-black text-slate-900">🎁 {customer.giftItem}</span>
                ) : (
                  <span className="text-slate-400 italic flex items-center gap-1">
                    <span>+ 고객님께 주기로 한 사은품을 적어두세요 (클릭)</span>
                  </span>
                )}
              </p>
              {!customer.giftItem && (
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  + 사은품 적기
                </span>
              )}
            </div>
          )}
        </div>

        {/* 📂 고객별 견적 이력 & 상담 기록 토글 바 */}
        <div className="border border-indigo-100 rounded-xl overflow-hidden bg-slate-50/50">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full py-2 px-3 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 hover:from-indigo-100/80 hover:to-purple-100/80 text-indigo-900 text-xs font-bold flex items-center justify-between transition"
          >
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>견적 이력 ({quotesCount}건) · 상담기록 ({logsCount}건)</span>
            </div>
            {isHistoryOpen ? (
              <ChevronUp className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Expanded Drawer */}
          {isHistoryOpen && (
            <div className="p-3 bg-white border-t border-indigo-100 space-y-3">
              {/* Tab Selector */}
              <div className="flex gap-1 border-b border-slate-200 pb-1.5">
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('quotes')}
                  className={`flex-1 py-1 text-center rounded-lg text-xs font-bold transition ${
                    activeHistoryTab === 'quotes'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📊 저장된 견적서 ({quotesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('logs')}
                  className={`flex-1 py-1 text-center rounded-lg text-xs font-bold transition ${
                    activeHistoryTab === 'logs'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  💬 상담 & 특이사항 ({logsCount})
                </button>
              </div>

              {/* Quotes Tab */}
              {activeHistoryTab === 'quotes' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">고객 전용 견적 목록</span>
                    <button
                      type="button"
                      onClick={() => onOpenQuote(customer)}
                      className="text-[10px] font-extrabold text-rose-600 hover:text-rose-700 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> 새 견적 작성
                    </button>
                  </div>

                  {quotesCount === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400">아직 저장된 견적이 없습니다.</p>
                      <button
                        type="button"
                        onClick={() => onOpenQuote(customer)}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        [⚡ 계산기로 견적 산출하기]
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {customer.quotes?.map((q, qIdx) => (
                        <div
                          key={`${q.id}-${qIdx}`}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300 transition flex flex-col gap-1.5 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${q.mode === 'sub' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {q.mode === 'sub' ? '구독' : '일시불'}
                                </span>
                                <span className="font-bold text-xs text-slate-900">{q.title}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{q.createdAt}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">체감가</span>
                              <span className="text-xs font-black text-rose-600">
                                {q.netAmount < 0 ? '체감 0원' : q.netAmount.toLocaleString() + '원'}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 truncate bg-white/80 p-1 rounded border border-slate-100">
                            {q.itemSummary}
                          </p>

                          <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => copyQuoteToClipboard(q)}
                              className="text-[10px] font-bold px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>{copiedQuoteId === q.id ? '복사됨!' : '카톡복사'}</span>
                            </button>
                            {onLoadQuoteRecord && (
                              <button
                                type="button"
                                onClick={() => onLoadQuoteRecord(q, customer)}
                                className="text-[10px] font-black px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs"
                              >
                                <Calculator className="w-2.5 h-2.5" />
                                <span>계산기로 열기</span>
                              </button>
                            )}
                            {onDeleteQuote && (
                              deletingQuoteId === q.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded border border-rose-200">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteQuote(customer.id, q.id);
                                      setDeletingQuoteId(null);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                                  >
                                    삭제
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingQuoteId(null)}
                                    className="text-[10px] px-1 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeletingQuoteId(q.id)}
                                  className="text-[10px] p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="견적 삭제"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Logs & Notes Tab */}
              {activeHistoryTab === 'logs' && (
                <div className="space-y-2.5">
                  {/* Inline quick add */}
                  <form onSubmit={handleAddQuickLog} className="flex gap-1.5 items-center">
                    <select
                      value={logType}
                      onChange={(e) => setLogType(e.target.value as any)}
                      className="text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 shrink-0 font-medium"
                    >
                      <option value="상담메모">상담메모</option>
                      <option value="특이사항">특이사항</option>
                      <option value="문자발송">문자발송</option>
                      <option value="배송조율">배송조율</option>
                    </select>
                    <input
                      type="text"
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                      placeholder="상담 내용, 특이사항 입력..."
                      className="text-xs flex-1 p-1.5 border border-slate-300 rounded-lg focus:outline-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shrink-0 shadow-2xs"
                    >
                      기록
                    </button>
                  </form>

                  {logsCount === 0 ? (
                    <p className="text-center py-3 text-xs text-slate-400">등록된 상담 기록이 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {customer.logs?.map((l, lIdx) => {
                        let badgeColor = 'bg-slate-100 text-slate-700';
                        if (l.type === '문자발송') badgeColor = 'bg-sky-100 text-sky-800';
                        if (l.type === '견적산출') badgeColor = 'bg-indigo-100 text-indigo-800';
                        if (l.type === '특이사항') badgeColor = 'bg-rose-100 text-rose-800';
                        if (l.type === '배송조율') badgeColor = 'bg-amber-100 text-amber-800';

                        return (
                          <div
                            key={`${l.id}-${lIdx}`}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${badgeColor}`}>
                                  {l.type}
                                </span>
                                <span className="text-slate-400">{l.date}</span>
                              </div>
                              {onDeleteLog && (
                                deletingLogId === l.id ? (
                                  <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded border border-rose-200">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onDeleteLog(customer.id, l.id);
                                        setDeletingLogId(null);
                                      }}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                                    >
                                      삭제
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingLogId(null)}
                                      className="text-[9px] px-1 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingLogId(l.id)}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                                    title="상담메모 삭제"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )
                              )}
                            </div>
                            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mt-1">
                              {l.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 📦 배송 완료 단계 전용 관리 액션 바 (사장님 확인 및 보관/삭제) */}
      {customer.status === '배송완료' && onDeleteCustomer && (
        <div className="px-3 pt-2 pb-0">
          <button
            type="button"
            onClick={handleDeleteCustomerClick}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition active:scale-95 border border-slate-700 cursor-pointer"
            title="배송 완료 확인 후 메인 목록에서 보관/삭제 처리합니다."
          >
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>📦 배송 완료 확인 및 보관/삭제</span>
          </button>
        </div>
      )}

      {/* Bottom Action Area (Clean, comfortable hierarchy) */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex items-center gap-2">
        {/* 1. Phone Call */}
        <a
          href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 font-bold text-xs border border-slate-200 shadow-2xs transition active:scale-95 text-center flex-shrink-0"
          title="전화 걸기"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-600" />
          <span>전화</span>
        </a>

        {/* 2. SMS Send */}
        <button
          type="button"
          onClick={() => onOpenSMS(customer)}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-sky-700 font-bold text-xs border border-slate-200 shadow-2xs transition active:scale-95 text-center flex-shrink-0 cursor-pointer"
          title="문자 발송"
        >
          <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
          <span>문자</span>
        </button>

        {/* 3. Hero Action: Quotation Calculator */}
        <button
          type="button"
          onClick={() => onOpenQuote(customer)}
          title="고객 정보, 견적 품목, 모델명, 혜택을 계산기에 완벽 자동 로드"
          style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition active:scale-95 border border-rose-700 cursor-pointer"
        >
          <Calculator className="w-4 h-4 text-white" />
          <span className="truncate">견적서 계산</span>
        </button>
      </div>
    </div>
  );
};
