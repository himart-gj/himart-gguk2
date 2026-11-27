import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  Cloud,
  FolderOpen,
  Kanban,
  LayoutGrid,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CrmPrimaryTab,
  CustomerItem,
  CustomerStatus,
  FilterTab,
  QuoteRecord,
  SettlementTabId,
  SortOrder,
} from '../types/crm';
import {
  applyCustomerFieldPatchWithSlipSync,
  applyCustomerStatusChangeWithSlipSync,
  confirmDraftQuoteAndCleanOthers,
  CRM_CUSTOMERS_UPDATED_EVENT,
  deleteQuoteAndSyncCustomer,
  fetchCustomersFromGas,
  getCachedCustomers,
  getCustomerIdentityKey,
  markAllConfirmedSlipsDelivered,
  QuoteSlipInlinePatch,
  setCachedCustomers,
  syncCustomerToGas,
  toggleSlipDeliveryStatusAndSyncCustomer,
  updateQuoteSlipAndSyncCustomer,
} from '../services/gasApi';
import {
  getBriefingSummary,
  triggerDailyMorningNotification,
} from '../services/notificationService';
import {
  getDeliveryDDay,
  getPastDueDeliveryCustomers,
  hasUnpaidGift,
  isPendingLogisticsCustomer,
  isUrgentCustomer,
} from '../utils/date';
import {
  computeMonthlySettlementReport,
  extractPerformanceFromProposalState,
  getCurrentYearMonth,
  resolveCustomerPerformanceProfile,
} from '../utils/settlementEngine';
import { syncMarketingDbTrashFromCrmCustomer } from '../../utils/marketingDbEngine';
import { isCustomerVisibleInActiveCrm } from '../utils/autoArchiveEngine';
import {
  getCloudCrmIdentityStatus,
  linkOwnerCodeAndSyncCrmNow,
  USER_CRM_CLOUD_SYNCED_EVENT,
} from '../services/userCrmCloudSync';
import { CRMHeader } from './CRMHeader';
import { CompactCustomerCard } from './CompactCustomerCard';
import { CustomerDetailModal } from './CustomerDetailModal';
import { SMSModal } from './SMSModal';
import { NewCustomerModal } from './NewCustomerModal';
import { SettingsModal } from './SettingsModal';
import { MorningBriefingModal } from './MorningBriefingModal';
import { PastDeliveryCheckModal } from './PastDeliveryCheckModal';
import { CrmSalesAndIncentivePanel } from './CrmSalesAndIncentivePanel';
import {
  SlipBatchSavedSummary,
  SlipBatchUploadModal,
} from './SlipBatchUploadModal';
import {
  CrmAnalyticsStrip,
  CrmDeliveryCalendar,
  CrmKanbanBoard,
} from './CrmKanbanAndAnalytics';


import { PRIMARY_CRM_TABS, type CrmViewMode, type ConsultingSubFilter, type UrgentSubFilter } from '../CrmApp';

export const CrmMainBodyView: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    PAST_DELIVERY_POPUP_DISMISSED_KEY,
    activeCustomers,
    activeTab,
    applyFilterSelection,
    backLabel,
    cloudIdentity,
    consultSubFilter,
    filteredCustomers,
    handleAddNewCustomer,
    handleApplyQuoteAsPrimary,
    handleBatchSlipsSaved,
    handleConfirmAllDelivered,
    handleConfirmDelivered,
    handleConfirmDraftQuote,
    handleDeleteCustomer,
    handleDeleteQuoteRecord,
    handleEmptyTrash,
    handleFieldChange,
    handleImportCustomers,
    handleManualSlipSaved,
    handleMarkSmsSent,
    handleMemoChange,
    handlePermanentDeleteCustomer,
    handleQuickLinkOwnerCode,
    handleRestoreCustomer,
    handleStatusChange,
    handleToggleSlipDeliveryStatus,
    handleUndoLastAction,
    handleUpdateQuoteSlip,
    initialSettlementTab,
    isBriefingOpen,
    isDark,
    isLinkingCode,
    isLoading,
    isNewModalOpen,
    isPastDeliveryModalOpen,
    isSettingsOpen,
    isSlipUploadOpen,
    kpiStats,
    loadCustomers,
    metricsCustomers,
    onBackToHome,
    onOpenCustomerInQuoteBuilder,
    onOpenQuoteRecordInQuoteBuilder,
    pastDueDeliveryCustomers,
    prefillNewCustomer,
    quickLinkCode,
    searchQuery,
    selectedCustomer,
    selectedYearMonth,
    setActiveTab,
    setConsultSubFilter,
    setCustomers,
    setIsBriefingOpen,
    setIsNewModalOpen,
    setIsPastDeliveryModalOpen,
    setIsSettingsOpen,
    setIsSlipUploadOpen,
    setPrefillNewCustomer,
    setQuickLinkCode,
    setSearchQuery,
    setSelectedCustomerId,
    setSelectedYearMonth,
    setSettlementTab,
    setShowAnalytics,
    setSlipUploadTargetCustomer,
    setSmsCustomer,
    setSortOrder,
    setUrgentSubFilter,
    setViewMode,
    settlementTab,
    showAnalytics,
    showToast,
    slipUploadTargetCustomer,
    smsCustomer,
    sortOrder,
    tabCounts,
    toastState,
    trashedCustomers,
    undoHistory,
    urgentSubFilter,
    viewMode,
  } = ctx;
  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[#0B1120] text-[#F8FAFC]' : 'bg-[#F2F4F6] text-[#191F28]'
      }`}
    >
      {/* 상단 고정 헤더 */}
      <CRMHeader
        totalCount={kpiStats.totalCount}
        urgentCount={kpiStats.urgentCount}
        todayTomorrowDeliveryCount={kpiStats.todayTomorrowDeliveryCount}
        unconfirmedLogisticsCount={kpiStats.unconfirmedLogisticsCount}
        unpaidGiftCount={kpiStats.unpaidGiftCount}
        pastDueDeliveryCount={pastDueDeliveryCustomers.length}
        onOpenPastDueModal={() => setIsPastDeliveryModalOpen(true)}
        grossSalesTotal={kpiStats.grossSalesTotal}
        netDeliverySalesTotal={kpiStats.netDeliverySalesTotal}
        pipelineSalesTotal={kpiStats.pipelineSalesTotal}
        isLoading={isLoading}
        onRefresh={loadCustomers}
        onOpenSlipUploadModal={() => {
          setSlipUploadTargetCustomer(null);
          setIsSlipUploadOpen(true);
        }}
        onOpenNewModal={() => {
          setPrefillNewCustomer(null);
          setIsNewModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        onQuickFilter={(tab) => applyFilterSelection(tab)}
        onFocusSettlement={() => {
          document
            .getElementById('crm-sales-incentive-hub')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onBackToHome={onBackToHome}
        backLabel={backLabel}
      />

      {/* Sonner 스타일 하단 플로팅 토스트 (Undo 되돌리기 버튼 내장) */}
      {toastState && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] w-[92vw] max-w-md bg-[#191F28] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/15 flex items-center justify-between gap-2.5 text-xs font-extrabold schedule-sheet-enter">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastState.msg}</span>
          </div>
          {toastState.canUndo && undoHistory.length > 0 && (
            <button
              type="button"
              onClick={handleUndoLastAction}
              className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-white text-[#1B64DA] text-[11.5px] font-black shrink-0 cursor-pointer"
            >
              ↩ 되돌리기
            </button>
          )}
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 space-y-2.5">
        {cloudIdentity.needsCodeLinkOnThisDevice && (
          <form
            onSubmit={handleQuickLinkOwnerCode}
            className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isDark
                ? 'bg-[#131C2E] border-blue-500/35 text-slate-100'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#191F28]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 text-xs font-extrabold">
              <Cloud className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0" />
              <span className="break-keep">
                휴대폰 · 태블릿 · PC 내 상담고객 실시간 공유: 본인 보안코드를 1회 연결하면 모든 기기에서 내 고객이 자동 연동됩니다.
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="password"
                value={quickLinkCode}
                onChange={(e) => setQuickLinkCode(e.target.value)}
                placeholder="본인 코드 입력"
                className={`w-36 sm:w-40 px-3 py-1.5 rounded-xl border text-base sm:text-xs font-extrabold focus:outline-none ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-[#BFDBFE] text-[#191F28]'
                }`}
              />
              <button
                type="submit"
                disabled={isLinkingCode}
                className="px-3 py-1.5 rounded-xl bg-[#1B64DA] hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isLinkingCode ? '연결중' : '동기화 연결'}
              </button>
            </div>
          </form>
        )}

        {/* 1) 월간 총판·실판 분리 & 프리드/제품모델별 수당 정산 통합 허브 */}
        <CrmSalesAndIncentivePanel
          customers={metricsCustomers}
          isDark={isDark}
          selectedYearMonth={selectedYearMonth}
          onChangeYearMonth={setSelectedYearMonth}
          activeTab={settlementTab}
          onChangeTab={setSettlementTab}
          onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
          onFieldChange={handleFieldChange}
          onShowToast={(msg) => showToast(msg, false)}
          defaultExpanded={Boolean(initialSettlementTab)}
        />

        {/* 1-2) 상담 가망 파이프라인 보조 통계 바 (기본 접힘 · 토글 시 오픈) */}
        {showAnalytics && (
          <CrmAnalyticsStrip
            customers={metricsCustomers}
            isDark={isDark}
            onSelectFilter={(tab) => applyFilterSelection(tab)}
          />
        )}

        {/* 2) 뷰 모드 전환 + 검색창 + 정렬 + 5대 직관 상태 탭 */}
        <div
          className={`p-3 sm:p-3.5 rounded-[20px] border space-y-2.5 ${
            isDark
              ? 'bg-[#131C2E] border-slate-800'
              : 'bg-white border-[#E5E8EB] shadow-[0_2px_10px_rgba(25,31,40,0.03)]'
          }`}
        >
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
            {/* 좌측: 3대 뷰 전환 세그먼트 컨트롤 */}
            <div
              className={`grid grid-cols-3 sm:inline-flex p-1 rounded-xl border shrink-0 ${
                isDark
                  ? 'bg-[#0B1120] border-slate-800'
                  : 'bg-[#F2F4F6] border-[#E5E8EB]'
              }`}
            >
              {[
                {
                  id: 'grid' as CrmViewMode,
                  label: '목록',
                  icon: <LayoutGrid className="w-3.5 h-3.5" />,
                },
                {
                  id: 'kanban' as CrmViewMode,
                  label: '칸반',
                  icon: <Kanban className="w-3.5 h-3.5" />,
                },
                {
                  id: 'calendar' as CrmViewMode,
                  label: '달력',
                  icon: <Calendar className="w-3.5 h-3.5" />,
                },
              ].map((v) => {
                const active = viewMode === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setViewMode(v.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11.5px] sm:text-xs font-extrabold whitespace-nowrap shrink-0 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer schedule-tab-btn ${
                      active
                        ? isDark
                          ? 'bg-[#1E293B] text-blue-300 border border-blue-400/30 shadow-xs'
                          : 'bg-white text-[#191F28] border border-[#E5E8EB] shadow-xs'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    <span className="shrink-0">{v.icon}</span>
                    <span className="whitespace-nowrap">{v.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 중앙: 실시간 검색창 (고객명·연락처·모델명·전표번호 통합 검색) */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8B95A1] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고객명, 연락처, 상품코드, 전표번호(20261125-0011) 검색..."
                className={`w-full pl-10 pr-8 py-2 rounded-xl border text-base sm:text-sm font-medium focus:outline-none focus:border-[#1B64DA] ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28] placeholder:text-[#8B95A1]'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 우측: 상담 통계 토글 + 되돌리기 + 정렬 */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowAnalytics((v) => !v)}
                className={`px-2.5 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  showAnalytics
                    ? isDark
                      ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                      : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                    : isDark
                    ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB] hover:bg-[#F2F4F6]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span>상담 통계</span>
              </button>

              {undoHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoLastAction}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>되돌리기</span>
                </button>
              )}

              {viewMode === 'grid' && (
                <div
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border ml-auto sm:ml-0 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-200'
                      : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#4E5968] dark:text-slate-400 shrink-0" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="bg-transparent text-base sm:text-xs font-extrabold focus:outline-none cursor-pointer"
                  >
                    <option value="urgentFirst">긴급/할일 우선</option>
                    <option value="deliveryAsc">배송 임박순</option>
                    <option value="regDesc">최근 등록순</option>
                    <option value="amountDesc">실적 높은순</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 5대 직관 상태 탭 + 우측 작은 취소/휴지통 토글 */}
          {viewMode === 'grid' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRIMARY_CRM_TABS.map((tab) => {
                    const active = activeTab === tab;
                    const isUrgentTab = tab === '🔥 할일·긴급';
                    const count = tabCounts.map[tab] ?? 0;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab);
                          if (tab === '💬 상담중') setConsultSubFilter('all');
                          if (tab === '🔥 할일·긴급') setUrgentSubFilter('all');
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer schedule-tactile border ${
                          active
                            ? isUrgentTab
                              ? 'bg-[#E60012] border-[#E60012] text-white shadow-xs'
                              : isDark
                              ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                              : 'bg-[#191F28] border-[#191F28] text-white shadow-xs'
                            : isUrgentTab && count > 0
                            ? isDark
                              ? 'bg-rose-500/15 text-rose-300 border-rose-400/30'
                              : 'bg-[#FFF1F2] text-[#E60012] hover:bg-rose-100 border-[#FECDD3]'
                            : isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#4E5968] border-[#E5E8EB]'
                        }`}
                      >
                        <span>{tab}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono leading-none ${
                            active
                              ? 'bg-white/20 text-current'
                              : isUrgentTab && count > 0
                              ? 'bg-[#E60012]/15 text-[#E60012] dark:text-rose-300'
                              : 'bg-[#E5E8EB] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 우측 작은 취소/휴지통 토글 */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab((prev) =>
                        prev === '취소/보류' ? '전체' : '취소/보류'
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      activeTab === '취소/보류'
                        ? 'bg-[#4E5968] text-white border-[#4E5968]'
                        : isDark
                        ? 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        : 'bg-[#F8FAFC] text-[#8B95A1] border-[#E5E8EB] hover:text-[#4E5968]'
                    }`}
                  >
                    <span>취소</span>
                    <span className="font-mono">{tabCounts.map['취소/보류']}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        : 'bg-[#F8FAFC] text-[#8B95A1] border-[#E5E8EB] hover:text-[#4E5968]'
                    }`}
                    title="휴지통 관리 열기"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span>휴지통</span>
                    {trashedCustomers.length > 0 && (
                      <span className="font-mono">{trashedCustomers.length}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* 💬 상담중 탭 선택 시 컴팩트 보조 세부 칩 */}
              {activeTab === '💬 상담중' && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {(
                    [
                      { id: 'all' as const, label: '전체 상담' },
                      { id: '신규/미발송' as const, label: '신규/미발송' },
                      { id: '상담진행중' as const, label: '상담진행중' },
                      { id: '미구매/고민중' as const, label: '미구매/고민중' },
                    ] as const
                  ).map((chip) => {
                    const isSubActive = consultSubFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setConsultSubFilter(chip.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border cursor-pointer whitespace-nowrap ${
                          isSubActive
                            ? isDark
                              ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                              : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                            : isDark
                            ? 'bg-slate-900/60 text-slate-400 border-slate-800'
                            : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                        }`}
                      >
                        {chip.label} ({tabCounts.subConsultCounts[chip.id]})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 🔥 할일·긴급 탭에서 미지급 사은품 필터 칩 */}
              {activeTab === '🔥 할일·긴급' &&
                (kpiStats.unpaidGiftCount > 0 || urgentSubFilter === 'gifts') && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setUrgentSubFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border cursor-pointer whitespace-nowrap ${
                        urgentSubFilter === 'all'
                          ? 'bg-[#FFF1F2] dark:bg-rose-500/20 text-[#E60012] dark:text-rose-200 border-[#FECDD3] dark:border-rose-400/40'
                          : isDark
                          ? 'bg-slate-900/60 text-slate-400 border-slate-800'
                          : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                      }`}
                    >
                      전체 할일 ({kpiStats.urgentCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgentSubFilter('gifts')}
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border cursor-pointer whitespace-nowrap ${
                        urgentSubFilter === 'gifts'
                          ? 'bg-[#FFF1F2] dark:bg-rose-500/20 text-[#E60012] dark:text-rose-200 border-[#FECDD3] dark:border-rose-400/40'
                          : isDark
                          ? 'bg-slate-900/60 text-slate-400 border-slate-800'
                          : 'bg-[#F8FAFC] text-[#4E5968] border-[#E5E8EB]'
                      }`}
                    >
                      🎁 사은품 미지급 ({kpiStats.unpaidGiftCount})
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* 3) 뷰 모드별 메인 스테이지 */}
        {viewMode === 'kanban' ? (
          <CrmKanbanBoard
            customers={filteredCustomers}
            isDark={isDark}
            onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
            onStatusChange={handleStatusChange}
            onOpenSMS={(c) => setSmsCustomer(c)}
            onOpenQuote={(c) => onOpenCustomerInQuoteBuilder(c)}
          />
        ) : viewMode === 'calendar' ? (
          <CrmDeliveryCalendar
            customers={filteredCustomers}
            isDark={isDark}
            onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-1 text-[11.5px] sm:text-xs text-[#4E5968] dark:text-slate-400 font-semibold">
              <span className="min-w-0 flex-1 truncate">
                카드 클릭 시 다중 전표 타임라인 · 견적서 관리 오픈
              </span>
              <span className="shrink-0 whitespace-nowrap font-extrabold font-mono px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-[#191F28] dark:text-slate-200">
                표시 {filteredCustomers.length}명
              </span>
            </div>

            {filteredCustomers.length === 0 ? (
              <div
                className={`rounded-[20px] border p-10 text-center space-y-3 ${
                  isDark
                    ? 'bg-[#131C2E] border-slate-800'
                    : 'bg-white border-[#E5E8EB]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F2F4F6] dark:bg-slate-800 text-[#8B95A1] flex items-center justify-center mx-auto">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-[#191F28] dark:text-slate-100">
                  해당 탭에 표시할 고객 내역이 없습니다
                </h3>
                <p className="text-xs text-[#4E5968] dark:text-slate-400 max-w-md mx-auto">
                  상단 [전표 사진 등록] 버튼으로 HISIS 전산 사진을 여러 장 올리면
                  고객 정보와 견적서가 자동으로 생성·통합됩니다.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#1B64DA] text-white hover:bg-blue-700 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      검색어 초기화
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSlipUploadTargetCustomer(null);
                        setIsSlipUploadOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#1B64DA] text-white hover:bg-[#1552B5] cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      전표 사진 자동 등록하기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[720px]:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredCustomers.map((customer) => (
                  <CompactCustomerCard
                    key={customer.id}
                    customer={customer}
                    isDark={isDark}
                    onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                    onOpenSMS={(c, e) => {
                      e.stopPropagation();
                      setSmsCustomer(c);
                    }}
                    onOpenQuote={(c, e) => {
                      e.stopPropagation();
                      onOpenCustomerInQuoteBuilder(c);
                    }}
                    onToggleLogistics={(c) =>
                      handleFieldChange(c.id, {
                        logisticsConfirmed: !c.logisticsConfirmed,
                      })
                    }
                    onToggleGift={(c) =>
                      handleFieldChange(c.id, {
                        giftSent: !c.giftSent,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomerId(null)}
        onStatusChange={handleStatusChange}
        onMemoChange={handleMemoChange}
        onFieldChange={handleFieldChange}
        onDeleteQuoteRecord={handleDeleteQuoteRecord}
        onApplyQuoteAsPrimary={handleApplyQuoteAsPrimary}
        onToggleSlipDeliveryStatus={handleToggleSlipDeliveryStatus}
        onUpdateQuoteSlip={handleUpdateQuoteSlip}
        onConfirmDraftQuote={handleConfirmDraftQuote}
        onAddSlipForCustomer={(cust) => {
          setSlipUploadTargetCustomer(cust);
          setIsSlipUploadOpen(true);
        }}
        onManualSlipSaved={handleManualSlipSaved}
        onLoadQuoteRecord={(customer, quote) => {
          onOpenQuoteRecordInQuoteBuilder(customer, quote);
        }}
        onDelete={handleDeleteCustomer}
        onOpenSMS={(c) => setSmsCustomer(c)}
        onOpenQuote={(c) => onOpenCustomerInQuoteBuilder(c)}
      />

      <SlipBatchUploadModal
        isOpen={isSlipUploadOpen}
        onClose={() => {
          setIsSlipUploadOpen(false);
          setSlipUploadTargetCustomer(null);
        }}
        isDark={isDark}
        lockedCustomer={slipUploadTargetCustomer}
        onSavedBatch={handleBatchSlipsSaved}
      />

      <SMSModal
        customer={smsCustomer}
        onClose={() => setSmsCustomer(null)}
        onMarkSent={handleMarkSmsSent}
      />

      <NewCustomerModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleAddNewCustomer}
        prefillData={prefillNewCustomer}
      />

      <MorningBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        customers={activeCustomers}
        onSelectFilter={(tab) => applyFilterSelection(tab)}
        onOpenSMS={(c) => setSmsCustomer(c)}
        onToggleLogistics={(c) =>
          handleFieldChange(c.id, {
            logisticsConfirmed: !c.logisticsConfirmed,
          })
        }
        onToggleGift={(c) =>
          handleFieldChange(c.id, {
            giftSent: !c.giftSent,
          })
        }
      />

      <PastDeliveryCheckModal
        isOpen={isPastDeliveryModalOpen}
        customers={pastDueDeliveryCustomers}
        isDark={isDark}
        onConfirmDelivered={handleConfirmDelivered}
        onConfirmAllDelivered={handleConfirmAllDelivered}
        onClose={() => {
          sessionStorage.setItem(PAST_DELIVERY_POPUP_DISMISSED_KEY, '1');
          setIsPastDeliveryModalOpen(false);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        customers={activeCustomers}
        metricsCustomers={metricsCustomers}
        trashedCustomers={trashedCustomers}
        onImportCustomers={handleImportCustomers}
        onRestoreCustomer={handleRestoreCustomer}
        onPermanentDeleteCustomer={handlePermanentDeleteCustomer}
        onEmptyTrash={handleEmptyTrash}
        onSyncedFromCloud={(list) => setCustomers(list)}
      />
    </div>
  );
};
