import React, { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppStep, createEmptyGeneralPlanData, createInitialState, extractGeneralPlanData, getSubscriptionPeriodSummary, hasMeaningfulGeneralItems, hasMeaningfulSubItems, hasPlanMeaningfulContent, MAX_QUOTE_PLANS, normalizeSubscriptionPeriod, ProposalState, QuoteMode, resolveComparisonModePlanData, SUB_CARE_OPTIONS, SubscriptionPeriod, syncActivePlanIntoGeneralPlans } from '../types/proposal';
import { ControlPanel } from './ControlPanel';
import { ProposalPreview } from './ProposalPreview';
import { fetchRemoteSchedules } from './ScheduleModal';
import { fetchRemoteModelIncentiveSheets } from '../crm/utils/settlementEngine';
import { decodeSharedQuoteFromHash, SharedQuotePayload } from '../utils/shareQuoteCodec';
import { flushPendingOutbox, useOfflineSyncStatus } from '../utils/offlineDbQueue';
import { installLifecycleResumeAndUpdateGuard, scrollToTopInstant } from '../utils/mobileQaRuntime';
import { PopPrinterApp } from '../pop/PopPrinterApp';
import { CrmApp } from '../crm/CrmApp';
import { HiMobileView } from './HiMobileView';
import { InsuranceGuideView } from './InsuranceGuideView';
import { CareTableView } from './CareTableView';
import { LottePlanCalcView } from './LottePlanCalcView';
import { AllCareGuideView } from './AllCareGuideView';
import { CustomerShareQuoteView } from './CustomerShareQuoteView';
import { isOwnerMarketingDbUnlocked, loadMarketingDbStore, MARKETING_DB_UPDATED_EVENT, syncLeadsFromGoogleSheet, verifyAndUnlockOwnerDb } from '../utils/marketingDbEngine';
import MarketingDbManagerView from './MarketingDbManagerView';
import { CustomerItem, QuoteRecord, SettlementTabId } from '../crm/types/crm';
import { CRM_CUSTOMERS_UPDATED_EVENT, getCachedCustomers, markAllConfirmedSlipsDelivered, setCachedCustomers, syncCustomerToGas } from '../crm/services/gasApi';
import { getPastDueDeliveryCustomers, isPendingLogisticsCustomer, isUrgentCustomer } from '../crm/utils/date';
import { PAST_DELIVERY_POPUP_DISMISSED_KEY } from '../crm/CrmApp';
import { CARE_TABLE_UPDATED_EVENT, CareTableDataset, fetchRemoteCareDataset, loadLocalCareDataset, saveLocalCareDataset } from '../utils/careTableParser';
import { fetchRemoteInstallmentDataset, INSTALLMENT_UPDATED_EVENT, loadLocalInstallmentDataset, saveLocalInstallmentDataset } from '../utils/installmentParser';
import { mapGeneralCardName, mapSubscriptionAffiliateCard, parseGeneralImageWithFallback, parseSubscriptionImageWithFallback, sanitizeFiveYearWarrantyText } from '../utils/aiImageParser';
import { Columns2 } from 'lucide-react';
import { AppHeaderAndHome } from './AppHeaderAndHome';
import { AppGlobalModals, getStepShortLabel, ScreenErrorBoundary } from './AppGlobalModals';
import { OPEN_ADMIN_UPLOAD_HUB_EVENT } from './StoreAdminUploadHubModal';
import { StoreCloudKind } from '../utils/storeCloudSync';
import {
  canAccessStoreSchedule,
  FRIEND_ROLE_CHANGED_EVENT,
  isFriendRestrictedMode,
  persistVerifiedOwnerStaffPin,
  purgeLocalScheduleAndOwnerState,
} from '../utils/friendAccessGuard';
import { isCustomerVisibleInActiveCrm } from '../crm/utils/autoArchiveEngine';
import { syncBidirectionalUserCrm } from '../crm/services/userCrmCloudSync';
import {
  BeforeInstallPromptEvent,
  getGlobalDeferredInstallPrompt,
  getGlobalStandaloneState,
  subscribePwaInstallState,
  triggerNativePwaInstallPrompt,
} from '../utils/pwaInstallManager';


export const AppMainShellView: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    activeCrmCustomers,
    activeCustomer,
    activeMode,
    aiInitialCommand,
    applyRestoredProposalState,
    backButtonLabel,
    canViewSchedule,
    careDataset,
    careUpdateMonthBadge,
    currentScreenBadgeLabel,
    currentState,
    foldStageMode,
    handleConfirmAllDeliveredFromHome,
    handleConfirmDeliveredFromHome,
    handleConfirmStealthPin,
    handleEnterMode,
    handleHomeButtonClick,
    handleInstallAppClick,
    handleNavigateBack,
    handleOpenCustomerInQuoteBuilder,
    handleOpenQuoteRecordInQuoteBuilder,
    handleParseGeneralImage,
    handleParseImage,
    handleSwitchQuoteModeInPlace,
    initialCrmCustomerId,
    initialCrmFilterTab,
    initialCrmTab,
    installmentDataset,
    isAiCommandModalOpen,
    isAsCenterOpen,
    isCardIssueOpen,
    isDark,
    isFriendMode,
    isHomePastDeliveryOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isMenuOpen,
    isOmnibarOpen,
    isOnline,
    isOwnerDbUnlocked,
    isParsing,
    isParsingGeneral,
    isPartnerLinksOpen,
    isSaveToCrmOpen,
    isScheduleModalOpen,
    isStandalone,
    isStealthPinOpen,
    isUploadHubOpen,
    menuContainerRef,
    metricsCrmCustomers,
    navigateToStep,
    ownerDbQuickSummary,
    parseError,
    parseGeneralError,
    pastDueCustomersHome,
    pendingCount,
    pushAppHistoryGuard,
    setActiveCustomer,
    setActiveMode,
    setAiInitialCommand,
    setCrmCustomers,
    setCurrentState,
    setFoldStageMode,
    setGeneralState,
    setHybridState,
    setInitialCrmCustomerId,
    setInitialCrmFilterTab,
    setInitialCrmTab,
    setIsAiCommandModalOpen,
    setIsAsCenterOpen,
    setIsCardIssueOpen,
    setIsHomePastDeliveryOpen,
    setIsInstallGuideOpen,
    setIsInstallmentModalOpen,
    setIsMenuOpen,
    setIsOmnibarOpen,
    setIsOwnerDbUnlocked,
    setIsPartnerLinksOpen,
    setIsSaveToCrmOpen,
    setIsScheduleModalOpen,
    setIsStealthPinOpen,
    setIsUploadHubOpen,
    setParseError,
    setParseGeneralError,
    setStealthPinError,
    setStealthPinInput,
    setSubscriptionState,
    setUploadHubFocus,
    stealthPinError,
    stealthPinInput,
    step,
    subScanNotice,
    toggleUiTheme,
    unconfirmedLogisticsCountHome,
    unpaidGiftCountHome,
    uploadHubFocus,
    urgentCount,
  } = ctx;
  return (
    <div
      className={`app-shell-bg min-h-[100dvh] w-full flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-[#0B1120] text-[#F8FAFC]' : 'bg-[#F2F4F6] text-[#191F28]'
      }`}
    >
        <AppHeaderAndHome
          activeCrmCustomers={activeCrmCustomers}
          metricsCrmCustomers={metricsCrmCustomers}
          canViewSchedule={canViewSchedule}
          activeMode={activeMode}
          backButtonLabel={backButtonLabel}
          careUpdateMonthBadge={careUpdateMonthBadge}
          currentScreenBadgeLabel={currentScreenBadgeLabel}
          handleEnterMode={handleEnterMode}
          handleHomeButtonClick={handleHomeButtonClick}
          handleInstallAppClick={handleInstallAppClick}
          handleNavigateBack={handleNavigateBack}
          isDark={isDark}
          isFriendMode={isFriendMode}
          isMenuOpen={isMenuOpen}
          isOnline={isOnline}
          isOwnerDbUnlocked={!isFriendMode && isOwnerDbUnlocked}
          isStandalone={isStandalone}
          menuContainerRef={menuContainerRef}
          navigateToStep={navigateToStep}
          ownerDbQuickSummary={ownerDbQuickSummary}
          pendingCount={pendingCount}
          pushAppHistoryGuard={pushAppHistoryGuard}
          setInitialCrmFilterTab={setInitialCrmFilterTab}
          setInitialCrmTab={setInitialCrmTab}
          setIsAiCommandModalOpen={setIsAiCommandModalOpen}
          setIsAsCenterOpen={setIsAsCenterOpen}
          setIsCardIssueOpen={setIsCardIssueOpen}
          setIsInstallmentModalOpen={setIsInstallmentModalOpen}
          setIsMenuOpen={setIsMenuOpen}
          setIsOmnibarOpen={setIsOmnibarOpen}
          setIsPartnerLinksOpen={setIsPartnerLinksOpen}
          setIsScheduleModalOpen={(open: boolean) => {
            if (!canAccessStoreSchedule()) return;
            setIsScheduleModalOpen(open);
          }}
          setIsUploadHubOpen={(open: boolean) => {
            if (isFriendRestrictedMode()) return;
            if (open) setUploadHubFocus(null);
            setIsUploadHubOpen(open);
          }}
          step={step}
          toggleUiTheme={toggleUiTheme}
          unconfirmedLogisticsCountHome={unconfirmedLogisticsCountHome}
          unpaidGiftCountHome={unpaidGiftCountHome}
          urgentCount={urgentCount}
        />

      {/* ==================== STEP 1: 조건 입력 & 폴드/PC 3-모드 실시간 상담 스테이지 ==================== */}
      {step === 'input' && (
        <div className="flex-1 w-full flex flex-col">
          <div
            className={`hidden min-[680px]:flex items-center justify-between gap-2 px-4 sm:px-5 py-2 border-b no-print ${
              isDark
                ? 'bg-[#131C2E] border-white/10 text-slate-300'
                : 'bg-white border-[#E5E8EB] text-[#4E5968]'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold min-w-0">
              <Columns2 className="w-3.5 h-3.5 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
              <span className="truncate">
                화면 모드 ·{' '}
                <strong className={isDark ? 'text-white' : 'text-[#191F28]'}>
                  {foldStageMode === 'split'
                    ? '좌우 동시 비교 상담'
                    : foldStageMode === 'preview'
                    ? '제안서 실시간 미리보기'
                    : '견적 입력 집중'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`inline-flex items-center p-0.5 rounded-lg border ${
                  isDark
                    ? 'bg-[#0B1120] border-white/10'
                    : 'bg-[#F2F4F6] border-[#E5E8EB]'
                }`}
              >
                {(
                  [
                    { id: 'input', label: '입력 집중' },
                    { id: 'preview', label: '제안서 미리보기' },
                    { id: 'split', label: '좌우 동시 보기' },
                  ] as const
                ).map((opt) => {
                  const active = foldStageMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (foldStageMode !== opt.id) {
                          setFoldStageMode(opt.id);
                          scrollToTopInstant();
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer schedule-tactile whitespace-nowrap ${
                        active
                          ? isDark
                            ? 'bg-[#60A5FA] text-[#0B1120] shadow-xs'
                            : 'bg-white text-[#191F28] shadow-xs'
                          : isDark
                          ? 'text-slate-400 hover:text-white'
                          : 'text-[#4E5968] hover:text-[#191F28]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigateToStep('proposal')}
                className="px-3.5 py-1.5 rounded-lg bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold cursor-pointer whitespace-nowrap transition shadow-xs"
              >
                제안서 완성 · 공유하기 →
              </button>
            </div>
          </div>

          {foldStageMode === 'split' ? (
            <div className="flex-1 w-full flex flex-col min-[680px]:grid min-[680px]:grid-cols-12 min-[680px]:h-[calc(100dvh-96px)] min-[680px]:overflow-hidden">
              <div
                data-scroll-container="true"
                className="min-[680px]:col-span-6 lg:col-span-5 min-[680px]:h-full min-[680px]:overflow-y-auto min-[680px]:border-r border-[#E5E8EB] dark:border-white/10"
              >
                <ControlPanel
                  state={currentState}
                  onChange={setCurrentState}
                  onParseImage={handleParseImage}
                  isParsing={isParsing}
                  parseError={parseError}
                  subScanNotice={subScanNotice}
                  onParseGeneralImage={handleParseGeneralImage}
                  isParsingGeneral={isParsingGeneral}
                  parseGeneralError={parseGeneralError}
                  onShowProposal={() => navigateToStep('proposal')}
                  onBackToHome={handleNavigateBack}
                  backLabel={backButtonLabel}
                  activeCustomer={activeCustomer}
                  onClearActiveCustomer={() => setActiveCustomer(null)}
                  onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
                  onSwitchMode={handleSwitchQuoteModeInPlace}
                  embeddedSplitMode
                />
              </div>
              <div
                data-scroll-container="true"
                className="hidden min-[680px]:block min-[680px]:col-span-6 lg:col-span-7 min-[680px]:h-full min-[680px]:overflow-y-auto"
              >
                <ProposalPreview
                  state={currentState}
                  onChange={setCurrentState}
                  onBackToInput={() => setFoldStageMode('input')}
                  activeCustomer={activeCustomer}
                  onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
                  onSwitchMode={handleSwitchQuoteModeInPlace}
                  embeddedSplitMode
                  isDark={isDark}
                />
              </div>
            </div>
          ) : foldStageMode === 'preview' ? (
            <div
              data-scroll-container="true"
              className="flex-1 w-full min-[680px]:h-[calc(100dvh-96px)] min-[680px]:overflow-y-auto"
            >
              <ProposalPreview
                state={currentState}
                onChange={setCurrentState}
                onBackToInput={() => setFoldStageMode('input')}
                activeCustomer={activeCustomer}
                onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
                onSwitchMode={handleSwitchQuoteModeInPlace}
                embeddedSplitMode
                isDark={isDark}
              />
            </div>
          ) : (
            <ControlPanel
              state={currentState}
              onChange={setCurrentState}
              onParseImage={handleParseImage}
              isParsing={isParsing}
              parseError={parseError}
              subScanNotice={subScanNotice}
              onParseGeneralImage={handleParseGeneralImage}
              isParsingGeneral={isParsingGeneral}
              parseGeneralError={parseGeneralError}
              onShowProposal={() => navigateToStep('proposal')}
              onBackToHome={handleNavigateBack}
              backLabel={backButtonLabel}
              activeCustomer={activeCustomer}
              onClearActiveCustomer={() => setActiveCustomer(null)}
              onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
              onSwitchMode={handleSwitchQuoteModeInPlace}
            />
          )}
        </div>
      )}

      {/* ==================== STEP 2: 제안서 / 프리드 안내서 미리보기 화면 ==================== */}
      {step === 'proposal' && (
        <ProposalPreview
          state={currentState}
          onChange={setCurrentState}
          onBackToInput={handleNavigateBack}
          activeCustomer={activeCustomer}
          onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
          onSwitchMode={handleSwitchQuoteModeInPlace}
          isDark={isDark}
        />
      )}

      {/* ==================== 지연 로딩(React.lazy) 서브 뷰 영역 ==================== */}
      <ScreenErrorBoundary
        stepKey={step}
        onResetToHome={() => navigateToStep('home', { reset: true })}
      >
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-20 text-xs sm:text-sm font-black opacity-70">
            화면을 준비하고 있습니다...
          </div>
        }
      >
        {step === 'lotte-plan' && (
          <LottePlanCalcView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
        {step === 'pop-printer' && (
          <PopPrinterApp
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
        {step === 'crm' && (
          <CrmApp
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
            onOpenCustomerInQuoteBuilder={handleOpenCustomerInQuoteBuilder}
            onOpenQuoteRecordInQuoteBuilder={handleOpenQuoteRecordInQuoteBuilder}
            onCustomersChange={(list) => setCrmCustomers(list)}
            initialSettlementTab={initialCrmTab}
            initialFilterTab={initialCrmFilterTab}
            initialSelectedCustomerId={initialCrmCustomerId}
          />
        )}
        {!isFriendMode && step === 'marketing-db' && (isOwnerDbUnlocked || isOwnerMarketingDbUnlocked()) && (
          <MarketingDbManagerView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
            onLockAndHideMenu={() => {
              setIsOwnerDbUnlocked(false);
              navigateToStep('home', { reset: true });
            }}
            onOpenCustomerInCrm={(custId) => {
              setInitialCrmTab(undefined);
              setInitialCrmFilterTab(undefined);
              setInitialCrmCustomerId(custId || null);
              setCrmCustomers(getCachedCustomers());
              navigateToStep('crm');
            }}
            onOpenCustomerInQuoteBuilder={(cust) => {
              setCrmCustomers(getCachedCustomers());
              handleOpenCustomerInQuoteBuilder(cust);
            }}
            onOpenQuoteRecordInQuoteBuilder={(cust, quote) => {
              setCrmCustomers(getCachedCustomers());
              handleOpenQuoteRecordInQuoteBuilder(cust, quote);
            }}
            isDark={isDark}
          />
        )}
        {step === 'himobile' && (
          <HiMobileView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
        {step === 'insurance' && (
          <InsuranceGuideView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
        {step === 'allcare-guide' && (
          <AllCareGuideView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
        {!isFriendMode && step === 'marketing-db' && !isOwnerDbUnlocked && !isOwnerMarketingDbUnlocked() && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
            <p className="text-sm font-extrabold">개인 보안 코드 인증이 필요합니다.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStealthPinInput('');
                  setStealthPinError(false);
                  setIsStealthPinOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#191F28] dark:bg-blue-600 text-white text-xs font-extrabold cursor-pointer"
              >
                보안 코드 입력
              </button>
              <button
                type="button"
                onClick={handleNavigateBack}
                className="px-4 py-2 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 text-[#191F28] dark:text-slate-100 border border-[#E5E8EB] dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                {backButtonLabel}
              </button>
            </div>
          </div>
        )}
        {step === 'care-table' && (
          <CareTableView
            onBackToHome={handleNavigateBack}
            backLabel={backButtonLabel}
          />
        )}
      </Suspense>
      </ScreenErrorBoundary>

        <AppGlobalModals
          activeCrmCustomers={activeCrmCustomers}
          activeCustomer={activeCustomer}
          aiInitialCommand={aiInitialCommand}
          applyRestoredProposalState={applyRestoredProposalState}
          careDataset={careDataset}
          currentState={currentState}
          handleConfirmAllDeliveredFromHome={handleConfirmAllDeliveredFromHome}
          handleConfirmDeliveredFromHome={handleConfirmDeliveredFromHome}
          handleConfirmStealthPin={handleConfirmStealthPin}
          handleEnterMode={handleEnterMode}
          handleOpenCustomerInQuoteBuilder={handleOpenCustomerInQuoteBuilder}
          installmentDataset={installmentDataset}
          isAiCommandModalOpen={isAiCommandModalOpen}
          isAsCenterOpen={isAsCenterOpen}
          isCardIssueOpen={isCardIssueOpen}
          isDark={isDark}
          isFriendMode={isFriendMode}
          canViewSchedule={canViewSchedule}
          isHomePastDeliveryOpen={isHomePastDeliveryOpen}
          isInstallGuideOpen={isInstallGuideOpen}
          isInstallmentModalOpen={isInstallmentModalOpen}
          isOmnibarOpen={isOmnibarOpen}
          isPartnerLinksOpen={isPartnerLinksOpen}
          isSaveToCrmOpen={isSaveToCrmOpen}
          isScheduleModalOpen={canViewSchedule && isScheduleModalOpen}
          isStealthPinOpen={!isFriendMode && isStealthPinOpen}
          isUploadHubOpen={!isFriendMode && isUploadHubOpen}
          navigateToStep={navigateToStep}
          pastDueCustomersHome={pastDueCustomersHome}
          setActiveCustomer={setActiveCustomer}
          setActiveMode={setActiveMode}
          setAiInitialCommand={setAiInitialCommand}
          setCrmCustomers={setCrmCustomers}
          setGeneralState={setGeneralState}
          setHybridState={setHybridState}
          setInitialCrmFilterTab={setInitialCrmFilterTab}
          setInitialCrmTab={setInitialCrmTab}
          setIsAiCommandModalOpen={setIsAiCommandModalOpen}
          setIsAsCenterOpen={setIsAsCenterOpen}
          setIsCardIssueOpen={setIsCardIssueOpen}
          setIsHomePastDeliveryOpen={setIsHomePastDeliveryOpen}
          setIsInstallGuideOpen={setIsInstallGuideOpen}
          setIsInstallmentModalOpen={setIsInstallmentModalOpen}
          setIsOmnibarOpen={setIsOmnibarOpen}
          setIsPartnerLinksOpen={setIsPartnerLinksOpen}
          setIsSaveToCrmOpen={setIsSaveToCrmOpen}
          setIsScheduleModalOpen={(open: boolean) => {
            if (!canAccessStoreSchedule()) return;
            setIsScheduleModalOpen(open);
          }}
          setIsStealthPinOpen={(open: boolean) => {
            if (isFriendRestrictedMode()) return;
            setIsStealthPinOpen(open);
          }}
          setIsUploadHubOpen={(open: boolean) => {
            if (isFriendRestrictedMode()) return;
            setIsUploadHubOpen(open);
          }}
          setParseError={setParseError}
          setParseGeneralError={setParseGeneralError}
          setStealthPinError={setStealthPinError}
          setStealthPinInput={setStealthPinInput}
          setSubscriptionState={setSubscriptionState}
          stealthPinError={stealthPinError}
          stealthPinInput={stealthPinInput}
          step={step}
          toggleUiTheme={toggleUiTheme}
          uploadHubFocus={uploadHubFocus}
        />
    </div>
  );
};
