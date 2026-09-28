import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Calculator, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  User,
  Phone,
  Tag
} from 'lucide-react';
import { CustomerItem, PipelineStatus } from '../types/crm';
import { parseCustomerQuotationLocal } from '../services/quotationLoader';

interface CRMQuotePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  onSelectCustomer: (customer: CustomerItem) => void;
}

export const CRMQuotePickerModal: React.FC<CRMQuotePickerModalProps> = ({
  isOpen,
  onClose,
  customers,
  onSelectCustomer,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('권장'); // '권장', '미구매/고민중', '상담진행중', '신규/미발송', '전체'
  const [searchTerm, setSearchTerm] = useState('');

  // Priority customers: non-bought or in consultation
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Status filter
      if (selectedFilter === '권장') {
        if (c.status !== '미구매/고민중' && c.status !== '상담진행중' && c.status !== '신규/미발송') {
          return false;
        }
      } else if (selectedFilter !== '전체') {
        if (c.status !== selectedFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        const matchName = (c.name || '').toLowerCase().includes(q);
        const matchPhone = cleanPhone.includes(q) || (c.phone || '').includes(q);
        const matchItem = (c.items || c.category || '').toLowerCase().includes(q);
        const matchNote = (c.note || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchItem || matchNote;
      }

      return true;
    });
  }, [customers, selectedFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <Calculator className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-1.5">
                <span>CRM 고객 견적 불러오기</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40">
                  원클릭 동기화
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                미구매·상담중 고객의 견적 내용과 모델명을 계산기에 즉시 오차 없이 로드합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter('권장')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 flex-shrink-0 ${
                selectedFilter === '권장'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>⭐</span>
              <span>견적 대상 (미구매·상담중·신규)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('미구매/고민중')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
                selectedFilter === '미구매/고민중'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              🤔 미구매/고민중
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('상담진행중')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
                selectedFilter === '상담진행중'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              💬 상담진행중
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('신규/미발송')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
                selectedFilter === '신규/미발송'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              📋 신규/미발송
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('전체')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
                selectedFilter === '전체'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              전체 ({customers.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객 성명, 연락처, 품목명(TV, 냉장고 등), 모델명 검색..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-semibold text-slate-600">조건에 맞는 고객이 없습니다.</p>
              <p className="text-xs text-slate-400 mt-1">상단 필터나 검색어를 변경해 보세요.</p>
            </div>
          ) : (
            filteredCustomers.map((c, idx) => {
              const parsed = parseCustomerQuotationLocal(c);

              return (
                <div
                  key={`${c.id}-${idx}`}
                  className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
                >
                  {/* Left Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">
                        {c.name}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {c.phone}
                      </span>

                      {/* Status Badges */}
                      {c.status === '미구매/고민중' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          🤔 미구매/고민중
                        </span>
                      )}
                      {c.status === '상담진행중' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          💬 상담진행중
                        </span>
                      )}
                      {c.status === '신규/미발송' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          📋 신규 접수
                        </span>
                      )}
                      {c.status === '배송대기' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          🚚 배송대기
                        </span>
                      )}
                      {c.status === '배송완료' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✅ 배송완료
                        </span>
                      )}

                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-200 text-slate-700">
                        {parsed.customerType}
                      </span>
                    </div>

                    {/* Items & Models Summary */}
                    <p className="text-xs text-slate-800 font-medium line-clamp-1">
                      {c.items || c.category || '가전 견적 상담'}
                    </p>

                    {/* Note excerpt */}
                    {c.note && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        📝 {c.note.replace(/https:\/\/[^\s]+/g, '').trim()}
                      </p>
                    )}

                    {/* Benefit / Doc badge */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-wrap">
                      {c.paidAmount ? (
                        <span className="font-bold text-rose-600">
                          결제/견적: {(c.paidAmount / 10000).toLocaleString()}만원
                        </span>
                      ) : null}
                      {c.benefit && (
                        <span className="text-emerald-700 font-medium">
                          혜택: {c.benefit}
                        </span>
                      )}
                      {c.docUrl && (
                        <a
                          href={c.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> 원본 문서
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right Button */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomer(c);
                        onClose();
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>AI 정밀 견적 불러오기</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            총 <b className="text-slate-800">{filteredCustomers.length}</b>명의 고객 견적 대상
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
