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
    <header className="sticky top-0 z-30 bg-[#FAF8F4]/95 backdrop-blur-md border-b border-[#E4DFD5] shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* 좌측: 처음 메뉴로 + 브랜드 타이틀 */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#EAE5DC] text-[#18181B] text-xs font-extrabold border border-[#D6D3CD] shadow-2xs transition cursor-pointer shrink-0"
              title="처음 메뉴로 돌아가기"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>처음 메뉴로</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-[#18181B] text-white flex items-center justify-center shadow-xs shrink-0">
              <Store className="w-4 h-4 text-amber-400" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-lg font-black text-[#18181B] tracking-tight truncate">
                  VIP 통합 고객관리 (CRM)
                </h1>
              </div>
              <p className="text-[11px] text-[#78716C] font-medium hidden sm:block">
                상담 · 배송 · 물류 · 사은품 통합 파이프라인
              </p>
            </div>
          </div>

          {/* 우측 액션 버튼 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenBriefing}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition shadow-2xs cursor-pointer ${
                urgentCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                  : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
              }`}
              title="오늘의 할 일 브리핑 열기"
            >
              <BellRing
                className={`w-3.5 h-3.5 ${
                  urgentCount > 0 ? 'animate-bounce' : ''
                }`}
              />
              <span className="hidden xs:inline">아침 브리핑</span>
              {urgentCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-rose-600 text-[10px] font-black">
                  {urgentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl border border-[#D6D3CD] bg-white hover:bg-[#EAE5DC] text-[#18181B] text-xs font-extrabold transition disabled:opacity-50 cursor-pointer"
              title="구글시트 동기화 새로고침"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading ? 'animate-spin text-blue-600' : ''
                }`}
              />
              <span className="hidden md:inline">시트 동기화</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl border border-[#D6D3CD] bg-white hover:bg-[#EAE5DC] text-[#57534E] transition cursor-pointer"
              title="시스템 설정 및 백업"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-black bg-[#18181B] hover:bg-[#292524] text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 고객 등록</span>
            </button>
          </div>
        </div>

        {/* 4칸 빅 넘버 KPI 벤토 대시보드 (클릭 시 즉시 해당 필터 탭 전환) */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => onQuickFilter('전체')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-2xl px-3.5 py-2.5 text-left transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[#78716C]">
              <span>전체 관리 고객</span>
              <span>확정 {formatShortManwon(contractedSalesTotal)}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#18181B] tracking-tight mt-0.5">
              {totalCount}
              <span className="text-xs font-bold text-[#78716C] ml-1">명</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🔥긴급/오늘할일')}
            className="bg-rose-50/80 hover:bg-rose-100/70 border border-rose-200 rounded-2xl px-3.5 py-2.5 text-left transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between text-[11px] font-extrabold text-rose-700">
              <span>🔥 긴급 · 오늘할일</span>
              <span>당일·내일배송 {todayTomorrowDeliveryCount}건</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight mt-0.5">
              {urgentCount}
              <span className="text-xs font-bold text-rose-700 ml-1">건</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🚚물류/배송대기')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-2xl px-3.5 py-2.5 text-left transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[#78716C]">
              <span>🚚 물류 · 배송대기</span>
              <span>일정·물류 미확정</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight mt-0.5">
              {unconfirmedLogisticsCount}
              <span className="text-xs font-bold text-[#78716C] ml-1">건</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilter('🎁사은품미지급')}
            className="bg-white hover:bg-[#FAF8F4] border border-[#E4DFD5] rounded-2xl px-3.5 py-2.5 text-left transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[#78716C]">
              <span>🎁 사은품 미지급</span>
              <span>가망 {formatShortManwon(pipelineSalesTotal)}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight mt-0.5">
              {unpaidGiftCount}
              <span className="text-xs font-bold text-[#78716C] ml-1">건</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
