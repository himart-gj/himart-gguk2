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
    <header
      style={{ top: 'var(--app-header-h, 54px)' }}
      className="sticky z-30 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_10px_rgba(25,31,40,0.03)] dark:shadow-none"
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1.5 sm:gap-2">
          {/* 좌측: 처음 메뉴로 + 브랜드 타이틀 (344px 폴드 커버 ~ 데스크톱 모든 화면 겹침·잘림 0%) */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1 px-2 min-[380px]:px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 text-[11.5px] sm:text-xs font-extrabold border border-[#E5E8EB] dark:border-slate-700 transition cursor-pointer shrink-0 whitespace-nowrap"
              title={`${backLabel || '홈으로'} 돌아가기`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{backLabel || '홈으로'}</span>
            </button>

            <div className="hidden min-[420px]:flex w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-[#FF3B47] items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs sm:text-base font-extrabold text-[#191F28] dark:text-slate-50 tracking-tight whitespace-nowrap shrink-0">
              <span>고객관리</span>
              <span className="hidden sm:inline text-[#4E5968] dark:text-slate-400 font-bold"> (CRM)</span>
            </h1>
          </div>

          {/* 우측 액션 버튼 */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {pastDueDeliveryCount > 0 && onOpenPastDueModal && (
              <button
                type="button"
                onClick={onOpenPastDueModal}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#059669] hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
                title="배송일 경과 고객 배송완료 확인"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">배송확인</span>
                <span className="px-1.5 rounded-full bg-white text-[#059669] text-[11.5px] font-extrabold font-mono tabular-nums">
                  {pastDueDeliveryCount}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenBriefing}
              className={`relative flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold border transition cursor-pointer shrink-0 whitespace-nowrap ${
                urgentCount > 0
                  ? 'bg-[#E60012] hover:bg-[#C8000F] text-white border-[#E60012] shadow-2xs'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 border-[#E5E8EB] dark:border-slate-700'
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
                <span className="px-1.5 rounded-full bg-white text-[#E60012] text-[11.5px] font-extrabold font-mono tabular-nums">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 text-[11.5px] sm:text-xs font-extrabold transition disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
              title="구글시트 동기화 새로고침"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  isLoading ? 'animate-spin text-[#1B64DA] dark:text-blue-400' : ''
                }`}
              />
              <span className="hidden md:inline">동기화</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 transition cursor-pointer shrink-0"
              title="시스템 설정 및 백업"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#E60012] hover:bg-[#C8000F] text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">고객 등록</span>
              <span className="sm:hidden">등록</span>
            </button>
          </div>
        </div>

        {/* 컴팩트 4칸 퀵 필터 KPI 요약 바 */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => onQuickFilter('상담진행중')}
            className="bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 border border-[#E5E8EB] dark:border-slate-800 hover:border-[#BFDBFE] dark:hover:border-slate-700 rounded-xl px-3 py-1.5 flex items-center justify-between gap-1.5 text-xs transition cursor-pointer"
          >
            <span className="font-bold text-[#4E5968] dark:text-slate-300 whitespace-nowrap truncate">💬 상담진행중</span>
            <span className="font-extrabold font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 shrink-0 whitespace-nowrap">
              {totalCount}명
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🔥긴급/오늘할일')}
            className={`rounded-xl px-3 py-1.5 border flex items-center justify-between gap-1.5 text-xs transition cursor-pointer ${
              urgentCount > 0
                ? 'bg-[#FFF1F2] dark:bg-rose-500/15 hover:bg-rose-100/70 dark:hover:bg-rose-500/25 border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-rose-300'
                : 'bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 border-[#E5E8EB] dark:border-slate-800 text-[#4E5968] dark:text-slate-300'
            }`}
          >
            <span className="font-bold whitespace-nowrap truncate">
              🔥 긴급{todayTomorrowDeliveryCount > 0 ? `(배송${todayTomorrowDeliveryCount})` : '·할일'}
            </span>
            <span className="font-extrabold font-mono tabular-nums text-[#E60012] dark:text-[#FF3B47] shrink-0 whitespace-nowrap">
              {urgentCount}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🚚물류/배송대기')}
            className="bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 border border-[#E5E8EB] dark:border-slate-800 hover:border-[#BFDBFE] dark:hover:border-slate-700 rounded-xl px-3 py-1.5 flex items-center justify-between gap-1.5 text-xs transition cursor-pointer"
          >
            <span className="font-bold text-[#4E5968] dark:text-slate-300 whitespace-nowrap truncate">🚚 물류·배송대기</span>
            <span className="font-extrabold font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 shrink-0 whitespace-nowrap">
              {unconfirmedLogisticsCount}건
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🎁사은품미지급')}
            className={`rounded-xl px-3 py-1.5 border flex items-center justify-between gap-1.5 text-xs transition cursor-pointer ${
              unpaidGiftCount > 0
                ? 'bg-[#FFF1F2]/70 dark:bg-rose-500/12 hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 border-[#FECDD3] dark:border-rose-500/30 text-[#191F28] dark:text-slate-100'
                : 'bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 border-[#E5E8EB] dark:border-slate-800 text-[#4E5968] dark:text-slate-300'
            }`}
          >
            <span className="font-bold text-[#4E5968] dark:text-slate-300 whitespace-nowrap truncate">🎁 사은품 미지급</span>
            <span
              className={`font-extrabold font-mono tabular-nums shrink-0 whitespace-nowrap ${
                unpaidGiftCount > 0
                  ? 'text-[#E60012] dark:text-[#FF3B47]'
                  : 'text-[#8B95A1] dark:text-slate-400'
              }`}
            >
              {unpaidGiftCount}건
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
