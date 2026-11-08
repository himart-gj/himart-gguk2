import React from 'react';
import {
  ArrowLeft,
  BellRing,
  Plus,
  RefreshCw,
  Settings,
  Store,
  Truck,
} from 'lucide-react';

interface CRMHeaderProps {
  totalCount: number;
  urgentCount: number;
  todayTomorrowDeliveryCount: number;
  unconfirmedLogisticsCount: number;
  unpaidGiftCount: number;
  pastDueDeliveryCount?: number;
  onOpenPastDueModal?: () => void;
  grossSalesTotal: number;
  netDeliverySalesTotal: number;
  pipelineSalesTotal: number;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenNewModal: () => void;
  onOpenSettings: () => void;
  onOpenBriefing: () => void;
  onQuickFilter: (tab: any) => void;
  onFocusSettlement?: () => void;
  onBackToHome: () => void;
  backLabel?: string;
}

export const CRMHeader: React.FC<CRMHeaderProps> = ({
  totalCount,
  urgentCount,
  todayTomorrowDeliveryCount,
  unconfirmedLogisticsCount,
  unpaidGiftCount,
  pastDueDeliveryCount = 0,
  onOpenPastDueModal,
  isLoading,
  onRefresh,
  onOpenNewModal,
  onOpenSettings,
  onOpenBriefing,
  onQuickFilter,
  onBackToHome,
  backLabel,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F4]/95 backdrop-blur-md border-b border-[#E4DFD5] shadow-2xs">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* 좌측: 처음 메뉴로 + 브랜드 타이틀 (모바일 S26 울트라 등 큰 글자 환경에서도 '고객관리' 잘림 0%) */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EAE5DC] text-[#18181B] text-[11px] sm:text-xs font-extrabold border border-[#D6D3CD] shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
              title={`${backLabel || '홈으로'} 돌아가기`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{backLabel || '홈으로'}</span>
            </button>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#18181B] text-white flex items-center justify-center shadow-xs shrink-0">
              <Store className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h1 className="text-xs sm:text-base font-black text-[#18181B] tracking-tight whitespace-nowrap shrink-0">
              <span>고객관리</span>
              <span className="hidden sm:inline"> (CRM)</span>
            </h1>
          </div>

          {/* 우측 액션 버튼 */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {pastDueDeliveryCount > 0 && onOpenPastDueModal && (
              <button
                type="button"
                onClick={onOpenPastDueModal}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
                title="배송일 경과 고객 배송완료 확인"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">배송확인</span>
                <span className="px-1.5 rounded-full bg-white text-emerald-700 text-[10px] font-black">
                  {pastDueDeliveryCount}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenBriefing}
              className={`relative flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border transition shadow-2xs cursor-pointer shrink-0 whitespace-nowrap ${
                urgentCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                  : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
              }`}
              title="오늘의 할 일 브리핑 열기"
            >
              <BellRing
                className={`w-3.5 h-3.5 shrink-0 ${
                  urgentCount > 0 ? 'animate-bounce' : ''
                }`}
              />
              <span className="hidden sm:inline">브리핑</span>
              {urgentCount > 0 && (
                <span className="px-1.5 rounded-full bg-white text-rose-600 text-[10px] font-black">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border border-[#D6D3CD] bg-white hover:bg-[#EAE5DC] text-[#18181B] text-[11px] sm:text-xs font-extrabold transition disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
              title="구글시트 동기화 새로고침"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  isLoading ? 'animate-spin text-blue-600' : ''
                }`}
              />
              <span className="hidden md:inline">동기화</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl border border-[#D6D3CD] bg-white hover:bg-[#EAE5DC] text-[#57534E] transition cursor-pointer shrink-0"
              title="시스템 설정 및 백업"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black bg-[#18181B] hover:bg-[#292524] text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">고객 등록</span>
              <span className="sm:hidden">등록</span>
            </button>
          </div>
        </div>

        {/* 컴팩트 4칸 퀵 필터 칩 바 (한 줄 슬림형) */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => onQuickFilter('상담진행중')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-xs transition cursor-pointer"
          >
            <span className="font-bold text-[#57534E] whitespace-nowrap truncate">💬 상담진행중</span>
            <span className="font-black font-mono text-indigo-600 shrink-0 whitespace-nowrap">
              {totalCount}명
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🔥긴급/오늘할일')}
            className={`rounded-xl px-2.5 py-1.5 border flex items-center justify-between gap-1.5 text-xs transition cursor-pointer ${
              urgentCount > 0
                ? 'bg-rose-50/90 hover:bg-rose-100/70 border-rose-200 text-rose-700'
                : 'bg-white hover:bg-[#FAF8F4] border-[#E4DFD5] text-[#57534E]'
            }`}
          >
            <span className="font-bold whitespace-nowrap truncate">
              🔥 긴급{todayTomorrowDeliveryCount > 0 ? `(배송${todayTomorrowDeliveryCount})` : '·할일'}
            </span>
            <span className="font-black font-mono text-rose-600 shrink-0 whitespace-nowrap">
              {urgentCount}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🚚물류/배송대기')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-xs transition cursor-pointer"
          >
            <span className="font-bold text-[#57534E] whitespace-nowrap truncate">🚚 물류·배송대기</span>
            <span className="font-black font-mono text-blue-600 shrink-0 whitespace-nowrap">
              {unconfirmedLogisticsCount}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🎁사은품미지급')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-xs transition cursor-pointer"
          >
            <span className="font-bold text-[#57534E] whitespace-nowrap truncate">🎁 사은품 미지급</span>
            <span className="font-black font-mono text-amber-600 shrink-0 whitespace-nowrap">
              {unpaidGiftCount}건
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
