import React from 'react';
import {
  ArrowLeft,
  BellRing,
  Camera,
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
  onOpenSlipUploadModal: () => void;
  onOpenNewModal: () => void;
  onOpenSettings: () => void;
  onOpenBriefing: () => void;
  onQuickFilter: (tab: any) => void;
  onFocusSettlement?: () => void;
  onBackToHome: () => void;
  backLabel?: string;
}

export const CRMHeader: React.FC<CRMHeaderProps> = ({
  urgentCount,
  pastDueDeliveryCount = 0,
  onOpenPastDueModal,
  isLoading,
  onRefresh,
  onOpenSlipUploadModal,
  onOpenNewModal,
  onOpenSettings,
  onOpenBriefing,
  onBackToHome,
  backLabel,
}) => {
  return (
    <header
      style={{ top: 'var(--app-header-h, 54px)' }}
      className="sticky z-30 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_10px_rgba(25,31,40,0.03)] dark:shadow-none"
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1.5 sm:gap-2">
          {/* 좌측: 홈 복귀 + 타이틀 */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 text-[11.5px] sm:text-xs font-extrabold border border-[#E5E8EB] dark:border-slate-700 transition cursor-pointer shrink-0 whitespace-nowrap"
              title={`${backLabel || '홈으로'} 돌아가기`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[440px]:inline">
                {backLabel || '홈으로'}
              </span>
              <span className="min-[440px]:hidden">홈</span>
            </button>

            <div className="hidden sm:flex w-8 h-8 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-[#FF3B47] items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs sm:text-base font-extrabold text-[#191F28] dark:text-slate-50 tracking-tight whitespace-nowrap shrink-0">
              <span>고객관리</span>
              <span className="hidden md:inline text-[#4E5968] dark:text-slate-400 font-bold">
                {' '}
                (CRM)
              </span>
            </h1>
          </div>

          {/* 우측: 유틸 아이콘 + [📸 전표 사진 등록] + [+ 수기 등록] */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {pastDueDeliveryCount > 0 && onOpenPastDueModal && (
              <button
                type="button"
                onClick={onOpenPastDueModal}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#059669] hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
                title="배송일 경과 고객 배송완료 확인"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden lg:inline">배송확인</span>
                <span className="px-1.5 rounded-full bg-white text-[#059669] text-[11px] font-extrabold font-mono tabular-nums">
                  {pastDueDeliveryCount}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenBriefing}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold border transition cursor-pointer shrink-0 whitespace-nowrap ${
                urgentCount > 0
                  ? 'bg-[#FFF1F2] dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-[#E60012] dark:text-rose-300 border-[#FECDD3] dark:border-rose-500/35'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 border-[#E5E8EB] dark:border-slate-700'
              }`}
              title="오늘의 할 일 브리핑 열기"
            >
              <BellRing
                className={`w-3.5 h-3.5 shrink-0 ${
                  urgentCount > 0 ? 'animate-bounce' : ''
                }`}
              />
              <span className="hidden lg:inline">브리핑</span>
              {urgentCount > 0 && (
                <span className="px-1.5 rounded-full bg-[#E60012] text-white text-[11px] font-extrabold font-mono tabular-nums">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 sm:px-2.5 sm:py-1.5 inline-flex items-center gap-1 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 text-xs font-extrabold transition disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
              title="동기화 새로고침"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  isLoading ? 'animate-spin text-[#1B64DA] dark:text-blue-400' : ''
                }`}
              />
              <span className="hidden xl:inline">동기화</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 transition cursor-pointer shrink-0"
              title="백업 · 알림 · 휴지통 설정"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="crm-open-slip-upload-btn"
              onClick={onOpenSlipUploadModal}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#1B64DA] hover:bg-[#1552B5] text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
              title="HISIS 판매접수등록 전표 사진 여러 장 자동 등록"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">전표 사진 등록</span>
              <span className="sm:hidden">전표등록</span>
            </button>

            <button
              type="button"
              id="crm-open-manual-new-btn"
              onClick={onOpenNewModal}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold bg-[#191F28] dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-[#191F28] dark:border-slate-700 shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
              title="수기 상담/계약 고객 등록"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">수기 등록</span>
              <span className="sm:hidden">수기</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
