import React from 'react';
import {
  ArrowLeft,
  BellRing,
  Plus,
  RefreshCw,
  Settings,
  Store,
} from 'lucide-react';
import { formatShortManwon } from '../utils/date';

interface CRMHeaderProps {
  totalCount: number;
  urgentCount: number;
  todayTomorrowDeliveryCount: number;
  unconfirmedLogisticsCount: number;
  unpaidGiftCount: number;
  contractedSalesTotal: number;
  pipelineSalesTotal: number;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenNewModal: () => void;
  onOpenSettings: () => void;
  onOpenBriefing: () => void;
  onQuickFilter: (tab: any) => void;
  onBackToHome: () => void;
}

export const CRMHeader: React.FC<CRMHeaderProps> = ({
  totalCount,
  urgentCount,
  todayTomorrowDeliveryCount,
  unconfirmedLogisticsCount,
  unpaidGiftCount,
  contractedSalesTotal,
  pipelineSalesTotal,
  isLoading,
  onRefresh,
  onOpenNewModal,
  onOpenSettings,
  onOpenBriefing,
  onQuickFilter,
  onBackToHome,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* 좌측: 처음 메뉴로 + 브랜드 타이틀 */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold border border-slate-200 shadow-2xs transition cursor-pointer shrink-0"
              title="처음 메뉴로 돌아가기"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>처음 메뉴로</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Store className="w-5 h-5 text-amber-400" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                  국지CRM
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {totalCount}명
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium hidden sm:block">
                상담 · 배송 · 물류 · 사은품 통합 고객관리
              </p>
            </div>
          </div>

          {/* 우측 액션 버튼 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 오늘의 브리핑 버튼 */}
            <button
              type="button"
              onClick={onOpenBriefing}
              className={`relative flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-extrabold transition shadow-xs cursor-pointer ${
                urgentCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="오늘의 할 일 브리핑 열기"
            >
              <BellRing
                className={`w-3.5 h-3.5 ${
                  urgentCount > 0 ? 'animate-bounce' : ''
                }`}
              />
              <span className="hidden xs:inline">브리핑</span>
              {urgentCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-rose-600 text-[10px] font-black">
                  {urgentCount}
                </span>
              )}
            </button>

            {/* 신규 고객 등록 */}
            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 등록</span>
            </button>

            {/* 새로고침 */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition disabled:opacity-50 cursor-pointer"
              title="동기화 새로고침"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading ? 'animate-spin text-blue-600' : ''
                }`}
              />
            </button>

            {/* 설정 */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="시스템 설정 및 백업"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 한 줄 초슬림 KPI 요약 바 (클릭 시 즉시 필터링) */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
          <button
            type="button"
            onClick={() => onQuickFilter('🔥긴급/오늘할일')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-bold shrink-0 transition cursor-pointer"
          >
            <span>🔥 오늘할일</span>
            <span className="font-black">{urgentCount}건</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🔥긴급/오늘할일')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-bold shrink-0 transition cursor-pointer"
          >
            <span>🚨 당일·내일배송</span>
            <span className="font-black">{todayTomorrowDeliveryCount}건</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🚚물류/배송대기')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 font-bold shrink-0 transition cursor-pointer"
          >
            <span>🚚 물류대기</span>
            <span className="font-black">{unconfirmedLogisticsCount}건</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🎁사은품미지급')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 font-bold shrink-0 transition cursor-pointer"
          >
            <span>🎁 사은품미지급</span>
            <span className="font-black">{unpaidGiftCount}건</span>
          </button>

          <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
            <span className="text-slate-500 font-semibold">
              확정매출{' '}
              <strong className="text-emerald-700 font-black">
                {formatShortManwon(contractedSalesTotal)}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-semibold">
              가망{' '}
              <strong className="text-slate-700 font-black">
                {formatShortManwon(pipelineSalesTotal)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
