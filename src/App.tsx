import React, { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppStep, createEmptyGeneralPlanData, createInitialState, extractGeneralPlanData, getSubscriptionPeriodSummary, hasMeaningfulGeneralItems, hasMeaningfulSubItems, hasPlanMeaningfulContent, MAX_QUOTE_PLANS, normalizeSubscriptionPeriod, ProposalState, QuoteMode, resolveComparisonModePlanData, SUB_CARE_OPTIONS, SubscriptionPeriod, syncActivePlanIntoGeneralPlans } from './types/proposal';
import { ControlPanel } from './components/ControlPanel';
import { ProposalPreview } from './components/ProposalPreview';
import { fetchRemoteSchedules } from './components/ScheduleModal';
import { fetchRemoteModelIncentiveSheets } from './crm/utils/settlementEngine';
import { decodeSharedQuoteFromHash, SharedQuotePayload } from './utils/shareQuoteCodec';
import { flushPendingOutbox, useOfflineSyncStatus } from './utils/offlineDbQueue';
import { installLifecycleResumeAndUpdateGuard, scrollToTopInstant } from './utils/mobileQaRuntime';
import { PopPrinterApp } from './pop/PopPrinterApp';
import { CrmApp } from './crm/CrmApp';
import { HiMobileView } from './components/HiMobileView';
import { InsuranceGuideView } from './components/InsuranceGuideView';
import { CareTableView } from './components/CareTableView';
import { LottePlanCalcView } from './components/LottePlanCalcView';
import { AllCareGuideView } from './components/AllCareGuideView';
import { CustomerShareQuoteView } from './components/CustomerShareQuoteView';
import { isOwnerMarketingDbUnlocked, loadMarketingDbStore, MARKETING_DB_UPDATED_EVENT, syncLeadsFromGoogleSheet, verifyAndUnlockOwnerDb } from './utils/marketingDbEngine';
import MarketingDbManagerView from './components/MarketingDbManagerView';
import { CustomerItem, QuoteRecord, SettlementTabId } from './crm/types/crm';
import { CRM_CUSTOMERS_UPDATED_EVENT, getCachedCustomers, markAllConfirmedSlipsDelivered, setCachedCustomers, syncCustomerToGas } from './crm/services/gasApi';
import { getPastDueDeliveryCustomers, isPendingLogisticsCustomer, isUrgentCustomer } from './crm/utils/date';
import { PAST_DELIVERY_POPUP_DISMISSED_KEY } from './crm/CrmApp';
import { CARE_TABLE_UPDATED_EVENT, CareTableDataset, fetchRemoteCareDataset, loadLocalCareDataset, saveLocalCareDataset } from './utils/careTableParser';
import { fetchRemoteInstallmentDataset, INSTALLMENT_UPDATED_EVENT, loadLocalInstallmentDataset, saveLocalInstallmentDataset } from './utils/installmentParser';
import { mapGeneralCardName, mapSubscriptionAffiliateCard, parseGeneralImageWithFallback, parseSubscriptionImageWithFallback, sanitizeFiveYearWarrantyText } from './utils/aiImageParser';
import { Columns2 } from 'lucide-react';
import { AppHeaderAndHome } from './components/AppHeaderAndHome';
import { AppGlobalModals, getStepShortLabel, ScreenErrorBoundary } from './components/AppGlobalModals';
import { OPEN_ADMIN_UPLOAD_HUB_EVENT } from './components/StoreAdminUploadHubModal';
import { healCloudCareItemsFromLocalIfEmpty, StoreCloudKind } from './utils/storeCloudSync';
import { prefetchPartnerManualsInBackground } from './utils/partnerManualSync';
import {
  canAccessStoreSchedule,
  FRIEND_ROLE_CHANGED_EVENT,
  isFriendRestrictedMode,
  persistVerifiedOwnerStaffPin,
  purgeLocalScheduleAndOwnerState,
} from './utils/friendAccessGuard';
import { isCustomerVisibleInActiveCrm } from './crm/utils/autoArchiveEngine';
import { syncBidirectionalUserCrm } from './crm/services/userCrmCloudSync';
import {
  BeforeInstallPromptEvent,
  getGlobalDeferredInstallPrompt,
  getGlobalStandaloneState,
  subscribePwaInstallState,
  triggerNativePwaInstallPrompt,
} from './utils/pwaInstallManager';

import { AppMainShellView } from './components/AppMainShellView';
import { useAppQuoteRestoreAndOcr } from './utils/useAppQuoteRestoreAndOcr';
export function App() {
  const [activeMode, setActiveMode] = useState<QuoteMode>('subscription');
  const [step, setStep] = useState<AppStep>('home');
  const [stepHistory, setStepHistory] = useState<AppStep[]>([]);
  const stepHistoryRef = useRef<AppStep[]>([]);
  const currentStepRef = useRef<AppStep>('home');

  // 3개 메뉴 완전 개별 상태 분리
  const [generalState, setGeneralState] = useState<ProposalState>(() =>
    createInitialState('general')
  );
  const [subscriptionState, setSubscriptionState] = useState<ProposalState>(
    () => createInitialState('subscription')
  );
  const [hybridState, setHybridState] = useState<ProposalState>(() =>
    createInitialState('hybrid')
  );

  // CRM 연동 상태: 현재 작업 중인 고객 및 저장 모달
  const [activeCustomer, setActiveCustomer] = useState<{
    id: string;
    name: string;
    phone?: string;
    activeQuoteId?: string;
  } | null>(null);
  const [isSaveToCrmOpen, setIsSaveToCrmOpen] = useState(false);
  const [crmCustomers, setCrmCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );
  const [initialCrmTab, setInitialCrmTab] = useState<SettlementTabId | undefined>(undefined);
  const [initialCrmFilterTab, setInitialCrmFilterTab] = useState<'urgent' | 'delivery' | 'gifts' | undefined>(undefined);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null as string | null);
  const [subScanNotice, setSubScanNotice] = useState<string | null>(null);
  const subScanNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isParsingGeneral, setIsParsingGeneral] = useState(false);
  const [parseGeneralError, setParseGeneralError] = useState(
    null as string | null
  );

  // PWA 설치 프롬프트 및 전체화면 상태
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true
    );
  });
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] =
    useState<boolean>(false);
  const [isCardIssueOpen, setIsCardIssueOpen] = useState<boolean>(false);
  const [isAsCenterOpen, setIsAsCenterOpen] = useState<boolean>(false);
  const [isPartnerLinksOpen, setIsPartnerLinksOpen] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] =
    useState<boolean>(false);
  const [isAiCommandModalOpen, setIsAiCommandModalOpen] =
    useState<boolean>(false);
  const [aiInitialCommand, setAiInitialCommand] = useState<string>('');
  const [isOmnibarOpen, setIsOmnibarOpen] = useState<boolean>(false);
  const [isHomePastDeliveryOpen, setIsHomePastDeliveryOpen] = useState<boolean>(false);
  const [isUploadHubOpen, setIsUploadHubOpen] = useState<boolean>(false);
  const [uploadHubFocus, setUploadHubFocus] = useState<StoreCloudKind | null>(null);
  const [isFriendMode, setIsFriendMode] = useState<boolean>(() =>
    isFriendRestrictedMode()
  );
  const [canViewSchedule, setCanViewSchedule] = useState<boolean>(() =>
    canAccessStoreSchedule()
  );
  // ==================== 관리자 전용 비공개 [마케팅 DB관리] 스텔스 상태 ====================
  const [isOwnerDbUnlocked, setIsOwnerDbUnlocked] = useState<boolean>(() =>
    !isFriendRestrictedMode() && isOwnerMarketingDbUnlocked()
  );
  const [ownerDbTick, setOwnerDbTick] = useState<number>(0);
  const [initialCrmCustomerId, setInitialCrmCustomerId] = useState<
    string | null
  >(null);

  useEffect(() => {
    currentStepRef.current = step;
  }, [step]);

  // 페이지·메뉴·미리보기 전환 시에만 무조건 최상단(0px) 초기화 (같은 화면 내 옵션/입력 조작 시에는 실행 안 함)
  useLayoutEffect(() => {
    scrollToTopInstant();
  }, [step]);

  // 스마트 화면 이동 스택 (어느 화면에서 넘어왔든 1단계씩 직전 화면으로 정확히 복귀)
  const navigateToStep = useCallback(
    (nextStep: AppStep, opts?: { reset?: boolean }) => {
      if (nextStep === 'marketing-db' && isFriendRestrictedMode()) {
        return;
      }
      const cur = currentStepRef.current;
      if (opts?.reset || nextStep === 'home') {
        stepHistoryRef.current = [];
        setStepHistory([]);
        currentStepRef.current = 'home';
        setInitialCrmCustomerId(null);
        setStep('home');
        return;
      }
      if (nextStep === cur) {
        if (nextStep === 'crm') {
          setCrmCustomers(getCachedCustomers());
        }
        return;
      }
      const prevStack = stepHistoryRef.current;
      const existingIdx = prevStack.indexOf(nextStep);
      const nextStack =
        existingIdx >= 0
          ? prevStack.slice(0, existingIdx)
          : [...prevStack, cur].slice(-12);
      stepHistoryRef.current = nextStack;
      setStepHistory(nextStack);
      currentStepRef.current = nextStep;
      if (cur === 'crm' && nextStep !== 'crm') {
        setInitialCrmCustomerId(null);
      }
      if (nextStep === 'crm') {
        setCrmCustomers(getCachedCustomers());
      }
      setStep(nextStep);
    },
    []
  );

  const handleNavigateBack = useCallback(() => {
    const prevStack = stepHistoryRef.current;
    if (prevStack.length > 0) {
      const target = prevStack[prevStack.length - 1];
      const nextStack = prevStack.slice(0, -1);
      stepHistoryRef.current = nextStack;
      setStepHistory(nextStack);
      currentStepRef.current = target;
      if (target === 'crm') {
        setInitialCrmCustomerId(null);
        setCrmCustomers(getCachedCustomers());
      }
      setStep(target);
      return;
    }
    stepHistoryRef.current = [];
    setStepHistory([]);
    currentStepRef.current = 'home';
    setInitialCrmCustomerId(null);
    setStep('home');
  }, []);

  const previousStep: AppStep =
    stepHistory.length > 0 ? stepHistory[stepHistory.length - 1] : 'home';
  const backButtonLabel =
    previousStep === 'home' ? '홈으로' : `${getStepShortLabel(previousStep)}로`;
  const [isStealthPinOpen, setIsStealthPinOpen] = useState<boolean>(false);
  const [stealthPinInput, setStealthPinInput] = useState<string>('');
  const [stealthPinError, setStealthPinError] = useState<boolean>(false);
  const homeTapTimestampsRef = useRef<number[]>([]);
  const [sharedQuotePayload, setSharedQuotePayload] =
    useState<SharedQuotePayload | null>(null);
  const [foldStageMode, setFoldStageMode] = useState<
    'input' | 'preview' | 'split'
  >(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1180
      ? 'split'
      : 'input'
  );

  useEffect(() => {
    const handleStageResize = () => {
      if (window.innerWidth < 680) {
        setFoldStageMode((prev) => (prev === 'input' ? prev : 'input'));
      }
    };
    window.addEventListener('resize', handleStageResize);
    window.addEventListener('orientationchange', handleStageResize);
    window.visualViewport?.addEventListener('resize', handleStageResize);
    return () => {
      window.removeEventListener('resize', handleStageResize);
      window.removeEventListener('orientationchange', handleStageResize);
      window.visualViewport?.removeEventListener('resize', handleStageResize);
    };
  }, []);

  // [QA 02 백그라운드 복귀 · QA 08 업데이트 직후 · QA 09 푸시 알림 진입]
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('entry') === 'briefing') {
        currentStepRef.current = 'crm';
        setStep('crm');
        params.delete('entry');
        const rest = params.toString();
        window.history.replaceState(
          { appGuard: true, tag: 'push-entry' },
          '',
          `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash || ''}`
        );
      }
    } catch {
      // ignore malformed URL query
    }

    return installLifecycleResumeAndUpdateGuard({
      onResumeSync: () => {
        setCrmCustomers(getCachedCustomers());
        setCanViewSchedule(canAccessStoreSchedule());
        setIsOwnerDbUnlocked(!isFriendRestrictedMode() && isOwnerMarketingDbUnlocked());
        flushPendingOutbox().catch(() => {});
        void syncBidirectionalUserCrm(
          () => getCachedCustomers(),
          (merged) => setCachedCustomers(merged, { skipCloudPush: true })
        ).then((r) => {
          if (r.ok) setCrmCustomers(r.customers);
        });
      },
      onPushNavigate: (targetUrl) => {
        setCrmCustomers(getCachedCustomers());
        if (targetUrl.includes('entry=briefing') || targetUrl.includes('crm')) {
          navigateToStep('crm');
        }
      },
    });
  }, []);
  const { isOnline, pendingCount } = useOfflineSyncStatus();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // UI 테마 상태: 'light' (Apple Bento Warm Ivory 기본값) | 'dark' (Titanium Dark Pro)
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('himart_ui_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', uiTheme);
    }
    try {
      localStorage.setItem('himart_ui_theme', uiTheme);
    } catch {
      // ignore
    }
  }, [uiTheme]);

  const toggleUiTheme = useCallback(() => {
    setUiTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);
  const isDark = uiTheme === 'dark';

  // 안심케어 조견표 & 무이자 데이터셋 (0.01초 ⌘K 옴니바 통합 검색 연동)
  const [careDataset, setCareDataset] = useState<CareTableDataset | null>(() =>
    loadLocalCareDataset()
  );
  const [installmentDataset, setInstallmentDataset] = useState(() => loadLocalInstallmentDataset());

  // 카톡 공유 링크(?share=... 또는 #share=...) 감지 시 고객 전용 뷰로 단방향 잠금 (직원 앱 복귀 불가)
  useEffect(() => {
    const checkShareUrl = () => {
      const hasQueryShare = window.location.search.includes('share=');
      const hasHashShare = (window.location.hash || '').startsWith('#share=');
      if (hasQueryShare || hasHashShare) {
        decodeSharedQuoteFromHash().then((decoded) => {
          if (decoded) setSharedQuotePayload(decoded);
        });
      }
    };
    checkShareUrl();
    window.addEventListener('hashchange', checkShareUrl);
    return () => window.removeEventListener('hashchange', checkShareUrl);
  }, []);

  // 전역 Ctrl+K / Cmd+K 통합 검색 옴니바 단축키
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOmnibarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 최신 화면 및 모달 상태를 참조하기 위한 Ref
  const latestAppStateRef = useRef({
    step,
    isOmnibarOpen,
    isAiCommandModalOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isPartnerLinksOpen,
    isScheduleModalOpen,
    isMenuOpen,
    isStealthPinOpen,
    isHomePastDeliveryOpen,
    isUploadHubOpen,
  });

  useEffect(() => {
    latestAppStateRef.current = {
      step,
      isOmnibarOpen,
      isAiCommandModalOpen,
      isSaveToCrmOpen,
      isInstallGuideOpen,
      isInstallmentModalOpen,
      isCardIssueOpen,
      isAsCenterOpen,
      isPartnerLinksOpen,
      isScheduleModalOpen,
      isMenuOpen,
      isStealthPinOpen,
      isHomePastDeliveryOpen,
      isUploadHubOpen,
    };
  }, [
    step,
    isOmnibarOpen,
    isAiCommandModalOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isPartnerLinksOpen,
    isScheduleModalOpen,
    isMenuOpen,
    isStealthPinOpen,
    isHomePastDeliveryOpen,
    isUploadHubOpen,
  ]);

  // 히스토리 가드 주입 헬퍼 (모바일 뒤로가기 시 앱 강제 종료 원천 차단)
  const pushAppHistoryGuard = useCallback((tag?: string) => {
    try {
      window.history.pushState(
        { appGuard: true, tag: tag || 'nav', ts: Date.now() },
        ''
      );
    } catch {
      // ignore
    }
  }, []);

  // 단계나 메뉴가 바뀔 때마다 드롭다운 닫기 및 히스토리 가드 엔트리 1개 추가
  useEffect(() => {
    setIsMenuOpen(false);
    pushAppHistoryGuard(`step-${step}-${activeMode}`);
  }, [step, activeMode, pushAppHistoryGuard]);

  // 어떤 모달이나 햄버거 메뉴가 열릴 때마다 히스토리 가드 엔트리 1개 추가
  useEffect(() => {
    if (
      isOmnibarOpen ||
      isAiCommandModalOpen ||
      isMenuOpen ||
      isSaveToCrmOpen ||
      isInstallGuideOpen ||
      isScheduleModalOpen ||
      isInstallmentModalOpen ||
      isCardIssueOpen ||
      isAsCenterOpen ||
      isPartnerLinksOpen ||
      isStealthPinOpen ||
      isHomePastDeliveryOpen ||
      isUploadHubOpen
    ) {
      pushAppHistoryGuard('modal-open');
    }
  }, [
    isOmnibarOpen,
    isAiCommandModalOpen,
    isMenuOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isScheduleModalOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isPartnerLinksOpen,
    isStealthPinOpen,
    isHomePastDeliveryOpen,
    isUploadHubOpen,
    pushAppHistoryGuard,
  ]);

  // 친구(외부 지인) 제한 모드 및 휴무표 공유 ON/OFF 동기화
  useEffect(() => {
    const syncFriendRole = () => {
      const restricted = isFriendRestrictedMode();
      const schedAllowed = canAccessStoreSchedule();
      setIsFriendMode(restricted);
      setCanViewSchedule(schedAllowed);
      if (restricted) {
        purgeLocalScheduleAndOwnerState();
        if (!schedAllowed) {
          setIsScheduleModalOpen(false);
        } else {
          fetchRemoteSchedules().catch(() => {});
        }
        setIsStealthPinOpen(false);
        setIsUploadHubOpen(false);
        setIsOwnerDbUnlocked(false);
        if (currentStepRef.current === 'marketing-db') {
          navigateToStep('home', { reset: true });
        }
      }
    };
    syncFriendRole();
    window.addEventListener(FRIEND_ROLE_CHANGED_EVENT, syncFriendRole);
    window.addEventListener('storage', syncFriendRole);
    return () => {
      window.removeEventListener(FRIEND_ROLE_CHANGED_EVENT, syncFriendRole);
      window.removeEventListener('storage', syncFriendRole);
    };
  }, [navigateToStep]);

  // 인증된 관리자 기기에서만 [⚙️ 통합 업로드 센터] 호출 허용 및 4대 자료 즉시 반영 구독
  useEffect(() => {
    const onOpenHub = (ev: Event) => {
      if (isFriendRestrictedMode() || !isOwnerMarketingDbUnlocked()) return;
      const customEv = ev as CustomEvent<{ focus?: StoreCloudKind }>;
      setUploadHubFocus(customEv.detail?.focus ?? null);
      setIsMenuOpen(false);
      setIsUploadHubOpen(true);
    };
    const onCareUpdated = () => {
      const freshCare = loadLocalCareDataset();
      if (freshCare) setCareDataset(freshCare);
    };
    const onInstallmentUpdated = () => {
      setInstallmentDataset(loadLocalInstallmentDataset());
    };
    window.addEventListener(OPEN_ADMIN_UPLOAD_HUB_EVENT, onOpenHub);
    window.addEventListener(CARE_TABLE_UPDATED_EVENT, onCareUpdated);
    window.addEventListener(INSTALLMENT_UPDATED_EVENT, onInstallmentUpdated);
    return () => {
      window.removeEventListener(OPEN_ADMIN_UPLOAD_HUB_EVENT, onOpenHub);
      window.removeEventListener(CARE_TABLE_UPDATED_EVENT, onCareUpdated);
      window.removeEventListener(INSTALLMENT_UPDATED_EVENT, onInstallmentUpdated);
    };
  }, []);

  // 드롭다운 바깥 영역 클릭 시 자동 닫기 (Portal로 렌더링된 ViewportSafePopover 내부 클릭은 제외)
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const targetEl = e.target as Element | null;
      if (targetEl?.closest?.('[data-viewport-popover="true"]')) return;
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // 최초 1회만 등록되는 스마트폰 물리/제스처 뒤로가기 인터셉터 (우선순위 0~4순위 계층 처리)
  useEffect(() => {
    try {
      window.history.replaceState({ appGuard: true, tag: 'init-base', ts: Date.now() }, '');
    } catch {
      // ignore
    }
    pushAppHistoryGuard('init');

    const handlePopState = () => {
      const current = latestAppStateRef.current;

      if (current.isOmnibarOpen) {
        setIsOmnibarOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isAiCommandModalOpen) {
        setIsAiCommandModalOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }

      const modalInternalHandler = (window as any).__modalInternalBackHandler as
        | (() => boolean)
        | undefined;
      if (typeof modalInternalHandler === 'function') {
        const handledInsideModal = modalInternalHandler();
        if (handledInsideModal) {
          pushAppHistoryGuard('modal-sub');
          return;
        }
      }

      if (current.isStealthPinOpen) {
        setIsStealthPinOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isHomePastDeliveryOpen) {
        setIsHomePastDeliveryOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isMenuOpen) {
        setIsMenuOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isUploadHubOpen) {
        setIsUploadHubOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isSaveToCrmOpen) {
        setIsSaveToCrmOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isInstallGuideOpen) {
        setIsInstallGuideOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isScheduleModalOpen) {
        setIsScheduleModalOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isInstallmentModalOpen) {
        setIsInstallmentModalOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isCardIssueOpen) {
        setIsCardIssueOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isAsCenterOpen) {
        setIsAsCenterOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }
      if (current.isPartnerLinksOpen) {
        setIsPartnerLinksOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }

      const splitPreviewBackHandler = (window as any)
        .__proposalPreviewSplitBackHandler as (() => boolean) | undefined;
      if (typeof splitPreviewBackHandler === 'function') {
        if (splitPreviewBackHandler()) {
          pushAppHistoryGuard('split-preview-sub');
          return;
        }
      }

      const subBackHandler = (window as any).__subViewBackHandler as
        | (() => boolean)
        | undefined;
      if (typeof subBackHandler === 'function') {
        const handledBySubView = subBackHandler();
        if (handledBySubView) {
          pushAppHistoryGuard('subview');
          return;
        }
      }

      if (current.step !== 'home') {
        handleNavigateBack();
        pushAppHistoryGuard('step-back');
        return;
      }

      pushAppHistoryGuard('home-stay');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pushAppHistoryGuard, handleNavigateBack]);

  useEffect(() => {
    setIsStandalone(getGlobalStandaloneState());
    setDeferredPrompt(getGlobalDeferredInstallPrompt());
    return subscribePwaInstallState(() => {
      const standaloneNow = getGlobalStandaloneState();
      setIsStandalone(standaloneNow);
      setDeferredPrompt(getGlobalDeferredInstallPrompt());
      if (standaloneNow) {
        setIsInstallGuideOpen(false);
      }
    });
  }, []);

  const handleInstallAppClick = useCallback(async () => {
    if (deferredPrompt || getGlobalDeferredInstallPrompt()) {
      const outcome = await triggerNativePwaInstallPrompt();
      if (outcome === 'unavailable') {
        setIsInstallGuideOpen(true);
      }
    } else {
      setIsInstallGuideOpen(true);
    }
  }, [deferredPrompt]);

  // CRM 고객 변경 이벤트 발생 시 메인 홈(수당적립·구독건수·TODAY 브리핑) 및 통합검색 캐시 즉시 동기화
  useEffect(() => {
    const syncCustomers = () => setCrmCustomers(getCachedCustomers());
    window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncCustomers);
    window.addEventListener('storage', syncCustomers);
    return () => {
      window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncCustomers);
      window.removeEventListener('storage', syncCustomers);
    };
  }, []);

  // 메인 홈 화면 진입 시 최신 CRM 캐시 및 안심케어 조견표 · 무이자 할부 행사표 동기화
  useEffect(() => {
    if (step === 'home') {
      setCrmCustomers(getCachedCustomers());
      const local = loadLocalCareDataset();
      if (local) { setCareDataset(local); void healCloudCareItemsFromLocalIfEmpty(local); }
      prefetchPartnerManualsInBackground();
      fetchRemoteCareDataset()
        .then((remote) => {
          if (remote) {
            saveLocalCareDataset(remote);
            setCareDataset(remote);
          }
        })
        .catch(() => {
          // ignore
        });

      const localInst = loadLocalInstallmentDataset();
      fetchRemoteInstallmentDataset()
        .then((remoteInst) => {
          if (
            remoteInst &&
            remoteInst.columns.length > 0 &&
            (localInst.columns.length === 0 ||
              !localInst.updatedAt ||
              (remoteInst.updatedAt &&
                remoteInst.updatedAt >= localInst.updatedAt))
          ) {
            saveLocalInstallmentDataset(remoteInst);
            setInstallmentDataset(remoteInst);
          }
        })
        .catch(() => {
          // ignore
        });

      if (canAccessStoreSchedule()) {
        fetchRemoteSchedules().catch(() => {
          // ignore
        });
      } else {
        purgeLocalScheduleAndOwnerState();
        setIsScheduleModalOpen(false);
      }
      fetchRemoteModelIncentiveSheets().catch(() => {
        // ignore
      });
      void syncBidirectionalUserCrm(
        () => getCachedCustomers(),
        (merged) => setCachedCustomers(merged, { skipCloudPush: true })
      ).then((r) => {
        if (r.ok) setCrmCustomers(r.customers);
      });
    }
  }, [step, isFriendMode, canViewSchedule]);

  // 조견표 업데이트 월 표시 배지 텍스트 자동 추출
  const careUpdateMonthBadge = useMemo(() => {
    if (!careDataset) return '📅 기본 조견표 적용중';

    const combinedTitle = `${careDataset.versionTitle || ''} ${
      careDataset.fileName || ''
    }`;
    const monthMatch = combinedTitle.match(/(\d{1,2})\s*월/);
    if (monthMatch) {
      const m = parseInt(monthMatch[1], 10);
      if (m >= 1 && m <= 12) {
        return `📅 ${m}월 조견표 업데이트 완료`;
      }
    }

    if (careDataset.updatedAt) {
      const dateParts = careDataset.updatedAt.match(
        /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/
      );
      if (dateParts) {
        const yyyy = dateParts[1];
        const mmNum = parseInt(dateParts[2], 10);
        const mmPad = String(mmNum).padStart(2, '0');
        const ddPad = String(parseInt(dateParts[3], 10)).padStart(2, '0');
        return `📅 ${mmNum}월분 업데이트 (${yyyy}.${mmPad}.${ddPad})`;
      }
      const parsedDate = new Date(careDataset.updatedAt);
      if (!isNaN(parsedDate.getTime())) {
        const yyyy = parsedDate.getFullYear();
        const mmNum = parsedDate.getMonth() + 1;
        const mmPad = String(mmNum).padStart(2, '0');
        const ddPad = String(parsedDate.getDate()).padStart(2, '0');
        return `📅 ${mmNum}월분 업데이트 (${yyyy}.${mmPad}.${ddPad})`;
      }
    }

    return '📅 기본 조견표 적용중';
  }, [careDataset]);

  // ==================== 관리자 전용 비공개 [마케팅 DB관리] 스텔스 동기화 ====================
  useEffect(() => {
    const syncOwnerDb = () => {
      setIsOwnerDbUnlocked(!isFriendRestrictedMode() && isOwnerMarketingDbUnlocked());
      setOwnerDbTick((t) => t + 1);
    };
    window.addEventListener(MARKETING_DB_UPDATED_EVENT, syncOwnerDb);
    return () =>
      window.removeEventListener(MARKETING_DB_UPDATED_EVENT, syncOwnerDb);
  }, []);

  useEffect(() => {
    if (isFriendMode || !isOwnerDbUnlocked || step === 'marketing-db') return;
    const runBgSync = () => {
      void syncLeadsFromGoogleSheet(loadMarketingDbStore());
    };
    runBgSync();
    const timer = setInterval(runBgSync, 60000);
    const onVis = () => {
      if (document.visibilityState === 'visible') runBgSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isFriendMode, isOwnerDbUnlocked, step]);

  const ownerDbQuickSummary = useMemo(() => {
    if (isFriendMode || !isOwnerDbUnlocked) {
      return { totalActive: 0, newCount: 0, handoverTabCount: 0, monthRevenue: 0 };
    }
    const dbStore = loadMarketingDbStore();
    const active = dbStore.leads.filter((l) => !l.deletedAt);
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    const newCount = active.filter((l) => l.status === '신규').length;
    const handoverTabCount = active.filter((l) => l.status === '타직원인계').length;
    const monthRevenue = active
      .filter((l) => l.yearMonth === curYm && l.status === '계약완료')
      .reduce((s, l) => s + (Number(l.revenueAmount) || 0), 0);
    return {
      totalActive: active.length,
      newCount,
      handoverTabCount,
      monthRevenue,
    };
  }, [isFriendMode, isOwnerDbUnlocked, ownerDbTick, step]);

  const handleHomeButtonClick = () => {
    navigateToStep('home', { reset: true });
    if (isFriendMode || isFriendRestrictedMode()) {
      homeTapTimestampsRef.current = [];
      return;
    }
    const now = Date.now();
    const recent = homeTapTimestampsRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    homeTapTimestampsRef.current = recent;
    if (recent.length >= 5) {
      homeTapTimestampsRef.current = [];
      if (isOwnerMarketingDbUnlocked()) {
        setIsOwnerDbUnlocked(true);
        navigateToStep('marketing-db');
      } else {
        setStealthPinInput('');
        setStealthPinError(false);
        setIsStealthPinOpen(true);
      }
    }
  };

  const handleConfirmStealthPin = () => {
    if (isFriendMode || isFriendRestrictedMode()) {
      setIsStealthPinOpen(false);
      return;
    }
    if (verifyAndUnlockOwnerDb(stealthPinInput)) {
      persistVerifiedOwnerStaffPin(stealthPinInput.trim());
      setIsOwnerDbUnlocked(true);
      setIsStealthPinOpen(false);
      setStealthPinInput('');
      void syncBidirectionalUserCrm(
        () => getCachedCustomers(),
        (merged) => setCachedCustomers(merged, { skipCloudPush: true })
      ).then((r) => {
        if (r.ok) setCrmCustomers(r.customers);
      });
      navigateToStep('marketing-db');
    } else {
      setStealthPinError(true);
    }
  };

  // 현재 열려 있는 화면 이름 배지 텍스트
  const currentScreenBadgeLabel = useMemo(() => {
    if (step === 'home') return '메인 홈';
    if (step === 'crm') return '👑 통합 고객관리';
    if (step === 'marketing-db') return '📊 마케팅 DB관리';
    if (step === 'input' || step === 'proposal') {
      if (activeMode === 'general') return '1. 일반 견적';
      if (activeMode === 'subscription') return '2. 구독 견적';
      return '3. 혼합 견적';
    }
    if (step === 'lotte-plan') return '4. 플랜 계산기';
    if (step === 'pop-printer') return '5. 구독 POP';
    if (step === 'himobile') return '6. 하이 모바일';
    if (step === 'allcare-guide') return '7. 가전 올케어';
    if (step === 'insurance') return '8. 보험 청구안내';
    if (step === 'care-table') return '📋 안심케어 조견표';
    return '메인 홈';
  }, [step, activeMode]);

  const urgentCount = useMemo(() => {
    return crmCustomers
      .filter((c) => isCustomerVisibleInActiveCrm(c))
      .filter((c) => isUrgentCustomer(c)).length;
  }, [crmCustomers]);

  const rawCurrentState =
    activeMode === 'general'
      ? generalState
      : activeMode === 'subscription'
      ? subscriptionState
      : hybridState;

  const currentState = useMemo<ProposalState>(() => {
    const genSnap = extractGeneralPlanData(generalState);
    const subSnap = extractGeneralPlanData(subscriptionState);
    const hybSnap = extractGeneralPlanData(hybridState);
    return {
      ...rawCurrentState,
      modeConfigs: {
        ...(rawCurrentState.modeConfigs || {}),
        general: genSnap,
        subscription: subSnap,
        hybrid: hybSnap,
      },
    };
  }, [rawCurrentState, generalState, subscriptionState, hybridState]);

  const setCurrentState: React.Dispatch<React.SetStateAction<ProposalState>> =
    useCallback(
      (updater) => {
        let syncedCompareModes: QuoteMode[] | undefined = undefined;
        let compareModesChanged = false;

        const applyWithSnapshotSync = (prev: ProposalState): ProposalState => {
          const prevWithConfigs: ProposalState = {
            ...prev,
            modeConfigs: {
              ...(prev.modeConfigs || {}),
              general: extractGeneralPlanData(generalState),
              subscription: extractGeneralPlanData(subscriptionState),
              hybrid: extractGeneralPlanData(hybridState),
            },
          };
          const nextState =
            typeof updater === 'function' ? updater(prevWithConfigs) : updater;
          if (
            JSON.stringify(nextState.compareModes || []) !==
            JSON.stringify(prev.compareModes || [])
          ) {
            compareModesChanged = true;
            syncedCompareModes = nextState.compareModes;
          }
          return syncActivePlanIntoGeneralPlans(nextState);
        };

        if (activeMode === 'general') {
          setGeneralState(applyWithSnapshotSync);
        } else if (activeMode === 'subscription') {
          setSubscriptionState(applyWithSnapshotSync);
        } else {
          setHybridState(applyWithSnapshotSync);
        }

        setTimeout(() => {
          if (compareModesChanged) {
            setGeneralState((p) => ({ ...p, compareModes: syncedCompareModes }));
            setSubscriptionState((p) => ({ ...p, compareModes: syncedCompareModes }));
            setHybridState((p) => ({ ...p, compareModes: syncedCompareModes }));
          }
        }, 0);
      },
      [activeMode, generalState, subscriptionState, hybridState]
    );

  const handleSwitchQuoteModeInPlace = useCallback(
    (nextMode: QuoteMode) => {
      if (nextMode === 'general' && !hasMeaningfulGeneralItems(generalState)) {
        const seeded = resolveComparisonModePlanData(currentState, 'general');
        if (hasMeaningfulGeneralItems(seeded)) {
          setGeneralState((prev) =>
            syncActivePlanIntoGeneralPlans({
              ...prev,
              ...seeded,
              quoteMode: 'general',
              activeGeneralPlan: 1,
              generalPlans: [seeded],
              generalPlan1: seeded,
            })
          );
        }
      } else if (
        nextMode === 'subscription' &&
        !hasMeaningfulSubItems(subscriptionState)
      ) {
        const seeded = resolveComparisonModePlanData(currentState, 'subscription');
        if (hasMeaningfulSubItems(seeded)) {
          setSubscriptionState((prev) =>
            syncActivePlanIntoGeneralPlans({
              ...prev,
              ...seeded,
              quoteMode: 'subscription',
              activeGeneralPlan: 1,
              generalPlans: [seeded],
              generalPlan1: seeded,
            })
          );
        }
      } else if (nextMode === 'hybrid') {
        const hasGen = hasMeaningfulGeneralItems(hybridState);
        const hasSub = hasMeaningfulSubItems(hybridState);
        if (!hasGen || !hasSub) {
          const seeded = resolveComparisonModePlanData(currentState, 'hybrid');
          setHybridState((prev) =>
            syncActivePlanIntoGeneralPlans({
              ...prev,
              ...seeded,
              quoteMode: 'hybrid',
              activeGeneralPlan: 1,
              generalPlans: [seeded],
              generalPlan1: seeded,
            })
          );
        }
      }
      setActiveMode(nextMode);
      setParseError(null);
      setParseGeneralError(null);
    },
    [currentState, generalState, subscriptionState, hybridState]
  );

  const handleEnterMode = (mode: QuoteMode) => {
    setActiveMode(mode);
    setParseError(null);
    setParseGeneralError(null);
    navigateToStep('input');
  };

  const { applyRestoredProposalState, handleOpenCustomerInQuoteBuilder, handleOpenQuoteRecordInQuoteBuilder, handleParseGeneralImage, handleParseImage } = useAppQuoteRestoreAndOcr({ navigateToStep, setActiveCustomer, setActiveMode, setCurrentState, setGeneralState, setHybridState, setIsParsing, setIsParsingGeneral, setParseError, setParseGeneralError, setSubScanNotice, setSubscriptionState, subScanNoticeTimerRef });

  // 월간 수당·실적 지표용(14일 자동정리분 영구 보존) vs 활성 목록 관리용 고객 배열 분리
  const metricsCrmCustomers = useMemo(
    () => crmCustomers.filter((c) => !c.deletedAt),
    [crmCustomers]
  );
  const activeCrmCustomers = useMemo(
    () => crmCustomers.filter((c) => isCustomerVisibleInActiveCrm(c)),
    [crmCustomers]
  );
  const pastDueCustomersHome = useMemo(
    () => getPastDueDeliveryCustomers(activeCrmCustomers),
    [activeCrmCustomers]
  );

  useEffect(() => {
    if (
      step === 'home' &&
      pastDueCustomersHome.length > 0 &&
      sessionStorage.getItem(PAST_DELIVERY_POPUP_DISMISSED_KEY) !== '1'
    ) {
      setIsHomePastDeliveryOpen(true);
    }
  }, [step, pastDueCustomersHome.length]);

  const handleConfirmDeliveredFromHome = useCallback(
    async (customerId: string) => {
      const updated = crmCustomers.map((c) =>
        c.id === customerId ? markAllConfirmedSlipsDelivered(c) : c
      );
      const deduped = setCachedCustomers(updated);
      setCrmCustomers(deduped);
      const synced = deduped.find((c) => c.id === customerId);
      await syncCustomerToGas('update', {
        id: customerId,
        status: '배송완료',
        logisticsConfirmed: true,
        ...(synced ? { quotes: synced.quotes, deliveryDate: synced.deliveryDate } : {}),
      });
    },
    [crmCustomers]
  );

  const handleConfirmAllDeliveredFromHome = useCallback(
    async (customerIds: string[]) => {
      const idSet = new Set(customerIds);
      const updated = crmCustomers.map((c) =>
        idSet.has(c.id) ? markAllConfirmedSlipsDelivered(c) : c
      );
      const deduped = setCachedCustomers(updated);
      setCrmCustomers(deduped);
      setIsHomePastDeliveryOpen(false);
      for (const cid of customerIds) {
        const synced = deduped.find((c) => c.id === cid);
        await syncCustomerToGas('update', {
          id: cid,
          status: '배송완료',
          logisticsConfirmed: true,
          ...(synced ? { quotes: synced.quotes, deliveryDate: synced.deliveryDate } : {}),
        });
      }
    },
    [crmCustomers]
  );
  const unconfirmedLogisticsCountHome = useMemo(
    () => activeCrmCustomers.filter((c) => isPendingLogisticsCustomer(c)).length,
    [activeCrmCustomers]
  );
  const unpaidGiftCountHome = useMemo(
    () =>
      activeCrmCustomers.filter(
        (c) =>
          (c.status === '계약완료' || c.status === '배송완료') &&
          Boolean(c.giftItems && c.giftItems.trim()) &&
          !c.giftSent
      ).length,
    [activeCrmCustomers]
  );

  if (sharedQuotePayload) {
    return (
      <Suspense
        fallback={
          <div className="min-h-[100dvh] flex items-center justify-center bg-[#F2F4F6] text-[#191F28] text-sm font-bold">
            맞춤 비교 견적서를 불러오는 중입니다...
          </div>
        }
      >
        <CustomerShareQuoteView payload={sharedQuotePayload} />
      </Suspense>
    );
  }

  return <AppMainShellView ctx={{ activeCrmCustomers, activeCustomer, activeMode, aiInitialCommand, applyRestoredProposalState, backButtonLabel, canViewSchedule, careDataset, careUpdateMonthBadge, currentScreenBadgeLabel, currentState, foldStageMode, handleConfirmAllDeliveredFromHome, handleConfirmDeliveredFromHome, handleConfirmStealthPin, handleEnterMode, handleHomeButtonClick, handleInstallAppClick, handleNavigateBack, handleOpenCustomerInQuoteBuilder, handleOpenQuoteRecordInQuoteBuilder, handleParseGeneralImage, handleParseImage, handleSwitchQuoteModeInPlace, initialCrmCustomerId, initialCrmFilterTab, initialCrmTab, installmentDataset, isAiCommandModalOpen, isAsCenterOpen, isCardIssueOpen, isDark, isFriendMode, isHomePastDeliveryOpen, isInstallGuideOpen, isInstallmentModalOpen, isMenuOpen, isOmnibarOpen, isOnline, isOwnerDbUnlocked, isParsing, isParsingGeneral, isPartnerLinksOpen, isSaveToCrmOpen, isScheduleModalOpen, isStandalone, isStealthPinOpen, isUploadHubOpen, menuContainerRef, metricsCrmCustomers, navigateToStep, ownerDbQuickSummary, parseError, parseGeneralError, pastDueCustomersHome, pendingCount, pushAppHistoryGuard, setActiveCustomer, setActiveMode, setAiInitialCommand, setCrmCustomers, setCurrentState, setFoldStageMode, setGeneralState, setHybridState, setInitialCrmCustomerId, setInitialCrmFilterTab, setInitialCrmTab, setIsAiCommandModalOpen, setIsAsCenterOpen, setIsCardIssueOpen, setIsHomePastDeliveryOpen, setIsInstallGuideOpen, setIsInstallmentModalOpen, setIsMenuOpen, setIsOmnibarOpen, setIsOwnerDbUnlocked, setIsPartnerLinksOpen, setIsSaveToCrmOpen, setIsScheduleModalOpen, setIsStealthPinOpen, setIsUploadHubOpen, setParseError, setParseGeneralError, setStealthPinError, setStealthPinInput, setSubscriptionState, setUploadHubFocus, stealthPinError, stealthPinInput, step, subScanNotice, toggleUiTheme, unconfirmedLogisticsCountHome, unpaidGiftCountHome, uploadHubFocus, urgentCount }} />;
}

export default App;
