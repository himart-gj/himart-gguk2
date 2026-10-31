import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppStep,
  extractGeneralPlanData,
  GeneralPlanData,
  ProposalState,
  QuoteMode,
  SUB_CARE_OPTIONS,
  SubscriptionPeriod,
} from './types/proposal';
import { ControlPanel } from './components/ControlPanel';
import { ProposalPreview } from './components/ProposalPreview';
import { PopPrinterApp } from './pop/PopPrinterApp';
import { CrmApp } from './crm/CrmApp';
import { HiMobileView } from './components/HiMobileView';
import { InsuranceGuideView } from './components/InsuranceGuideView';
import { CareTableView } from './components/CareTableView';
import { LottePlanCalcView } from './components/LottePlanCalcView';
import { AllCareGuideView } from './components/AllCareGuideView';
import { CardInstallmentModal } from './components/CardInstallmentModal';
import { AsCenterModal, CardIssueModal } from './components/QuickCenterModal';
import { ScheduleModal, fetchRemoteSchedules } from './components/ScheduleModal';
import { ScheduleCharacterBanner } from './components/ScheduleCharacterBanner';
import { AiCommandModal } from './components/AiCommandModal';
import { SaveToCrmModal } from './crm/components/SaveToCrmModal';
import { CustomerItem, QuoteRecord } from './crm/types/crm';
import { getCachedCustomers } from './crm/services/gasApi';
import { isUrgentCustomer } from './crm/utils/date';
import {
  CareTableDataset,
  fetchRemoteCareDataset,
  loadLocalCareDataset,
  saveLocalCareDataset,
} from './utils/careTableParser';
import {
  fetchRemoteInstallmentDataset,
  loadLocalInstallmentDataset,
  saveLocalInstallmentDataset,
} from './utils/installmentParser';
import {
  mapGeneralCardName,
  mapSubscriptionAffiliateCard,
  parseGeneralImageWithFallback,
  parseSubscriptionImageWithFallback,
  sanitizeFiveYearWarrantyText,
} from './utils/aiImageParser';
import {
  Calculator,
  Calendar,
  CreditCard,
  Download,
  FileSpreadsheet,
  Home,
  Layers,
  Menu,
  Printer,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  ChevronRight,
  Moon,
  Sun,
  Wrench,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const createEmptyGeneralPlanData = (
  mode: QuoteMode,
  planNum: 1 | 2
): GeneralPlanData => ({
  generalItems: [
    {
      id: `gen-${mode}-p${planNum}-1`,
      category: '',
      modelName: '',
      quantity: 1,
      unitPrice: 0,
    },
  ],
  generalCardType: '미정',
  instantDiscount: 0,
  earnedPoints: 0,
  pointUsed: 0,
  autoTierCashback: true,
  manualTierCashback: 0,
  extraCashback: 0,
  extraBenefits: [],
  generalHiPreedCounts: {
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  },

  // 구독구매 초기값
  items: [
    {
      id: `sub-${mode}-p${planNum}-1`,
      category: '',
      modelName: '',
      monthlyFee: 0,
      period: 60,
      careService: SUB_CARE_OPTIONS[0],
    },
  ],
  subscriptionPeriod: 60,
  careService: SUB_CARE_OPTIONS[0],
  warrantyType: 'AS연장보험 + 가전수리올케어',
  warrantyYears: 5,
  allCare: true,
  selectedCardId: 'none',
  selectedCardTierId: '',
  hiPlusCounts: {
    hi72: 0,
    hi90: 0,
    hi108: 0,
  },
});

const createInitialState = (mode: QuoteMode): ProposalState => {
  const plan1 = createEmptyGeneralPlanData(mode, 1);
  const plan2 = createEmptyGeneralPlanData(mode, 2);

  return {
    quoteMode: mode,

    // 1안 / 2안 상태 (일반구매 + 구독구매 통합)
    activeGeneralPlan: 1,
    generalPlan1: plan1,
    generalPlan2: plan2,

    ...plan1,
  };
};

export function App() {
  const [activeMode, setActiveMode] = useState<QuoteMode>('subscription');
  const [step, setStep] = useState<AppStep>('home');

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
  } | null>(null);
  const [isSaveToCrmOpen, setIsSaveToCrmOpen] = useState(false);
  const [crmCustomers, setCrmCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );

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
  const [isScheduleModalOpen, setIsScheduleModalOpen] =
    useState<boolean>(false);
  const [isAiCommandModalOpen, setIsAiCommandModalOpen] =
    useState<boolean>(false);
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

  // 안심케어 조견표 데이터셋 및 최신 업데이트 월(Month) 자동 감지
  const [careDataset, setCareDataset] = useState<CareTableDataset | null>(() =>
    loadLocalCareDataset()
  );

  // 최신 화면 및 모달 상태를 참조하기 위한 Ref
  const latestAppStateRef = useRef({
    step,
    isAiCommandModalOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isScheduleModalOpen,
    isMenuOpen,
  });

  useEffect(() => {
    latestAppStateRef.current = {
      step,
      isAiCommandModalOpen,
      isSaveToCrmOpen,
      isInstallGuideOpen,
      isInstallmentModalOpen,
      isCardIssueOpen,
      isAsCenterOpen,
      isScheduleModalOpen,
      isMenuOpen,
    };
  }, [
    step,
    isAiCommandModalOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isScheduleModalOpen,
    isMenuOpen,
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
      isAiCommandModalOpen ||
      isMenuOpen ||
      isSaveToCrmOpen ||
      isInstallGuideOpen ||
      isScheduleModalOpen ||
      isInstallmentModalOpen ||
      isCardIssueOpen ||
      isAsCenterOpen
    ) {
      pushAppHistoryGuard('modal-open');
    }
  }, [
    isAiCommandModalOpen,
    isMenuOpen,
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isScheduleModalOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    pushAppHistoryGuard,
  ]);

  // 드롭다운 바깥 영역 클릭 시 자동 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
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

      // 최우선 순위: AI 비서 모달이 열려 있으면 닫기
      if (current.isAiCommandModalOpen) {
        setIsAiCommandModalOpen(false);
        pushAppHistoryGuard('modal-close');
        return;
      }

      // 0순위: 현재 열려 있는 모달 내부에 하위 뒤로가기 상태가 있으면 그것만 먼저 한 단계 되돌림
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

      // 1순위: 현재 열려 있는 최상위 모달/메뉴 닫기 (현재 화면은 그대로 유지)
      if (current.isMenuOpen) {
        setIsMenuOpen(false);
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

      // 2순위: 현재 메인 화면 내부의 하위 뷰/팝업 뒤로가기 핸들러(__subViewBackHandler) 실행
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

      // 3순위: 제안서 미리보기('proposal') 화면이면 조건 입력('input') 화면으로 이동
      if (current.step === 'proposal') {
        setStep('input');
        pushAppHistoryGuard('back-to-input');
        return;
      }

      // 4순위: 그 외 메뉴 화면이면 메인 홈('home')으로 이동
      if (current.step !== 'home') {
        setStep('home');
        pushAppHistoryGuard('back-to-home');
        return;
      }

      // 홈 화면에서도 절대 앱이 종료되지 않도록 가드 유지
      pushAppHistoryGuard('home-stay');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pushAppHistoryGuard]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsInstallGuideOpen(false);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstallAppClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch {
        setIsInstallGuideOpen(true);
      }
    } else {
      setIsInstallGuideOpen(true);
    }
  }, [deferredPrompt]);

  // 메인 홈 화면 진입 시 최신 CRM 캐시 및 안심케어 조견표 · 무이자 할부 행사표 동기화
  useEffect(() => {
    if (step === 'home') {
      setCrmCustomers(getCachedCustomers());
      const local = loadLocalCareDataset();
      if (local) setCareDataset(local);
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
            remoteInst.updatedAt &&
            (!localInst.updatedAt ||
              remoteInst.updatedAt >= localInst.updatedAt)
          ) {
            saveLocalInstallmentDataset(remoteInst);
          }
        })
        .catch(() => {
          // ignore
        });

      // 월간 휴무표 전 직원 최신 데이터 자동 동기화
      fetchRemoteSchedules().catch(() => {
        // ignore
      });
    }
  }, [step]);

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

  // 현재 열려 있는 화면 이름 배지 텍스트
  const currentScreenBadgeLabel = useMemo(() => {
    if (step === 'home') return '메인 홈';
    if (step === 'crm') return '👑 통합 고객관리';
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

  // 메인 홈 화면 통합 고객관리 버튼 우측 실시간 긴급 배지 카운트 계산
  const urgentCount = useMemo(() => {
    return crmCustomers
      .filter((c) => !c.deletedAt)
      .filter((c) => isUrgentCustomer(c)).length;
  }, [crmCustomers]);

  const currentState =
    activeMode === 'general'
      ? generalState
      : activeMode === 'subscription'
      ? subscriptionState
      : hybridState;

  const setCurrentState: React.Dispatch<React.SetStateAction<ProposalState>> =
    useCallback(
      (updater) => {
        const applyWithSnapshotSync = (prev: ProposalState): ProposalState => {
          const nextState =
            typeof updater === 'function' ? updater(prev) : updater;
          const snapshot = extractGeneralPlanData(nextState);
          if (nextState.activeGeneralPlan === 2) {
            return {
              ...nextState,
              generalPlan2: snapshot,
            };
          }
          return {
            ...nextState,
            generalPlan1: snapshot,
          };
        };

        if (activeMode === 'general') {
          setGeneralState(applyWithSnapshotSync);
        } else if (activeMode === 'subscription') {
          setSubscriptionState(applyWithSnapshotSync);
        } else {
          setHybridState(applyWithSnapshotSync);
        }
      },
      [activeMode]
    );

  const handleEnterMode = (mode: QuoteMode) => {
    setActiveMode(mode);
    setParseError(null);
    setParseGeneralError(null);
    setStep('input');
  };

  // CRM에서 저장된 ProposalState 스냅샷 또는 고객 기본 정보를 신규 견적기로 복원
  const applyRestoredProposalState = useCallback(
    (
      customer: CustomerItem,
      savedProposalState?: any,
      fallbackItemSummary?: string,
      fallbackPaidAmount?: number,
      fallbackQuoteMode?: QuoteMode
    ) => {
      setActiveCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      });

      if (savedProposalState && typeof savedProposalState === 'object') {
        const targetMode: QuoteMode =
          savedProposalState.quoteMode === 'general' ||
          savedProposalState.quoteMode === 'subscription' ||
          savedProposalState.quoteMode === 'hybrid'
            ? savedProposalState.quoteMode
            : fallbackQuoteMode || 'general';

        const base = createInitialState(targetMode);
        const parsed = JSON.parse(JSON.stringify(savedProposalState));

        // 하위 호환성 보장: 예전 데이터에 generalPlan1/2 내부의 구독 필드가 없었던 경우 안전 병합
        const mergedPlan1 = extractGeneralPlanData({
          ...base.generalPlan1,
          ...(parsed.generalPlan1 || {}),
          items:
            Array.isArray(parsed.generalPlan1?.items) &&
            parsed.generalPlan1.items.length > 0
              ? parsed.generalPlan1.items
              : Array.isArray(parsed.items) && parsed.items.length > 0
              ? parsed.items
              : base.generalPlan1.items,
          subscriptionPeriod:
            parsed.generalPlan1?.subscriptionPeriod ||
            parsed.subscriptionPeriod ||
            base.generalPlan1.subscriptionPeriod,
          careService:
            parsed.generalPlan1?.careService ||
            parsed.careService ||
            base.generalPlan1.careService,
          warrantyType:
            parsed.generalPlan1?.warrantyType ||
            parsed.warrantyType ||
            base.generalPlan1.warrantyType,
          warrantyYears: 5,
          allCare:
            parsed.generalPlan1?.allCare ??
            parsed.allCare ??
            base.generalPlan1.allCare,
          selectedCardId:
            parsed.generalPlan1?.selectedCardId ||
            parsed.selectedCardId ||
            base.generalPlan1.selectedCardId,
          selectedCardTierId:
            parsed.generalPlan1?.selectedCardTierId ??
            parsed.selectedCardTierId ??
            base.generalPlan1.selectedCardTierId,
          hiPlusCounts:
            parsed.generalPlan1?.hiPlusCounts ||
            parsed.hiPlusCounts ||
            base.generalPlan1.hiPlusCounts,
        });

        const mergedPlan2 = extractGeneralPlanData({
          ...base.generalPlan2,
          ...(parsed.generalPlan2 || {}),
        });

        const activePlanNum: 1 | 2 = parsed.activeGeneralPlan === 2 ? 2 : 1;
        const activePlanFields =
          activePlanNum === 2 ? mergedPlan2 : mergedPlan1;

        const restored: ProposalState = {
          ...base,
          ...parsed,
          ...activePlanFields,
          quoteMode: targetMode,
          activeGeneralPlan: activePlanNum,
          generalPlan1: mergedPlan1,
          generalPlan2: mergedPlan2,
        };

        if (targetMode === 'general') {
          setGeneralState(restored);
        } else if (targetMode === 'subscription') {
          setSubscriptionState(restored);
        } else {
          setHybridState(restored);
        }
        setActiveMode(targetMode);
        setParseError(null);
        setParseGeneralError(null);
        setStep('input');
        return;
      }

      // proposalState 스냅샷이 없는 일반 등록 고객인 경우 첫 품목에 자동 세팅
      const summaryStr = (fallbackItemSummary ?? customer.items ?? '').trim();
      const paidNum = Number(fallbackPaidAmount ?? customer.paidAmount ?? 0) || 0;
      const isSub =
        fallbackQuoteMode === 'subscription' || summaryStr.includes('구독');
      const targetMode: QuoteMode = isSub ? 'subscription' : 'general';

      if (targetMode === 'subscription') {
        const nextSub = createInitialState('subscription');
        const firstSubItem = {
          id: `sub-crm-${Date.now()}`,
          category: summaryStr || '맞춤 구독 가전',
          modelName: '',
          monthlyFee: paidNum,
          period: 60 as SubscriptionPeriod,
          careService: SUB_CARE_OPTIONS[0],
        };
        nextSub.items = [firstSubItem];
        nextSub.generalPlan1 = extractGeneralPlanData(nextSub);
        setSubscriptionState(nextSub);
      } else {
        const nextGen = createInitialState('general');
        const firstItem = {
          id: `gen-crm-${Date.now()}`,
          category: summaryStr || '맞춤 가전 패키지',
          modelName: '',
          quantity: 1,
          unitPrice: paidNum,
        };
        nextGen.generalItems = [firstItem];
        nextGen.generalPlan1 = extractGeneralPlanData(nextGen);
        setGeneralState(nextGen);
      }

      setActiveMode(targetMode);
      setParseError(null);
      setParseGeneralError(null);
      setStep('input');
    },
    []
  );

  const handleOpenCustomerInQuoteBuilder = useCallback(
    (customer: CustomerItem) => {
      const latestQuote = customer.quotes?.[0];
      applyRestoredProposalState(
        customer,
        latestQuote?.proposalState,
        latestQuote?.itemSummary || customer.items,
        latestQuote?.paidAmount || customer.paidAmount,
        latestQuote?.quoteMode
      );
    },
    [applyRestoredProposalState]
  );

  const handleOpenQuoteRecordInQuoteBuilder = useCallback(
    (customer: CustomerItem, quote: QuoteRecord) => {
      applyRestoredProposalState(
        customer,
        quote.proposalState,
        quote.itemSummary,
        quote.paidAmount,
        quote.quoteMode
      );
    },
    [applyRestoredProposalState]
  );

  // [1번 사진 대응] 일반구매(general) 및 혼합견적(hybrid) 일반전산 사진 자동입력
  const handleParseGeneralImage = useCallback(
    async (file: File) => {
      setIsParsingGeneral(true);
      setParseGeneralError(null);

      try {
        const result = await parseGeneralImageWithFallback(file);
        const extractedItems = Array.isArray(result.items) ? result.items : [];

        if (extractedItems.length === 0) {
          throw new Error(
            '일반 구매 본품 품목을 찾지 못했습니다. 사진을 다시 확인해 주세요.'
          );
        }

        const instantDiscount = Math.max(0, Number(result.instantDiscount) || 0);
        const lpointTotal = Math.max(0, Number(result.lpointTotal) || 0);
        const tierCashback = Math.max(0, Number(result.tierCashback) || 0);
        let extraCashback = Math.max(0, Number(result.extraCashback) || 0);
        const finalBenefitPrice = Math.max(
          0,
          Number(result.finalBenefitPrice) || 0
        );

        const mappedItems = extractedItems.map((it, idx) => {
          const qty = Math.max(1, Number(it.quantity ?? it.qty) || 1);
          const unitPrice = Math.max(0, Number(it.unitPrice ?? it.price) || 0);
          return {
            id: `gen-ai-${Date.now()}-${idx}`,
            category: it.category || it.name || `품목 ${idx + 1}`,
            name: it.name || it.category || `품목 ${idx + 1}`,
            code: it.code || it.modelName || '',
            modelName: it.modelName || it.code || '',
            qty,
            quantity: qty,
            price: unitPrice * qty,
            unitPrice,
            discount1: idx === 0 ? instantDiscount : 0,
            discount2: idx === 0 ? lpointTotal : 0,
            cashback: idx === 0 ? tierCashback : 0,
          };
        });

        const sumOfItems = mappedItems.reduce(
          (acc, it) => acc + it.unitPrice * it.quantity,
          0
        );

        // 우측 하단 빨간색 '최종 혜택가'(finalBenefitPrice)와 정확히 일치하도록 차액 검증
        if (finalBenefitPrice > 0 && sumOfItems > finalBenefitPrice) {
          const currentCalculatedNet =
            sumOfItems -
            instantDiscount -
            lpointTotal -
            tierCashback -
            extraCashback;
          if (currentCalculatedNet > finalBenefitPrice) {
            extraCashback += currentCalculatedNet - finalBenefitPrice;
          }
        }

        const detectedCardType = mapGeneralCardName(
          result.cardName,
          tierCashback > 0
        );

        setCurrentState((prev) => {
          const updatedPlanFields = {
            generalItems: mappedItems,
            generalCardType: detectedCardType,
            instantDiscount,
            earnedPoints: lpointTotal,
            pointUsed: 0,
            autoTierCashback: false,
            manualTierCashback: tierCashback,
            extraCashback,
          };

          const nextState: ProposalState = {
            ...prev,
            ...updatedPlanFields,
          };

          const snapshot = extractGeneralPlanData(nextState);
          if (nextState.activeGeneralPlan === 2) {
            nextState.generalPlan2 = snapshot;
          } else {
            nextState.generalPlan1 = snapshot;
          }

          return nextState;
        });
      } catch (err: any) {
        setParseGeneralError(
          err?.message || '일반전산 이미지 분석 중 오류가 발생했습니다.'
        );
      } finally {
        setIsParsingGeneral(false);
      }
    },
    [setCurrentState]
  );

  // [2번 사진 대응] 구독구매(subscription) 및 혼합견적(hybrid) 맞춤 구독 견적 계산기 사진 자동입력
  const handleParseImage = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParseError(null);

      try {
        const data = await parseSubscriptionImageWithFallback(file);
        const extractedItems = Array.isArray(data.items) ? data.items : [];
        const firstItem = extractedItems[0] || ({} as any);

        const detectedPeriod: SubscriptionPeriod =
          Number(firstItem.period) === 36
            ? 36
            : Number((data as any).period) === 36
            ? 36
            : 60;

        const rawCardName = data.cardName || firstItem.cardName || '';
        const mappedCard = mapSubscriptionAffiliateCard(rawCardName);

        const resolvedWarrantyType = sanitizeFiveYearWarrantyText(
          data.warrantyType ||
            firstItem.warrantyType ||
            'AS연장보험 + 가전수리올케어'
        );

        setCurrentState((prev) => {
          const existingValidItems = prev.items.filter(
            (it) =>
              (it.category || '').trim() !== '' ||
              (it.modelName || '').trim() !== '' ||
              (Number(it.monthlyFee) || 0) > 0
          );

          const mappedItems =
            extractedItems.length > 0
              ? extractedItems.map((it: any, idx: number) => {
                  const itemPeriod: SubscriptionPeriod =
                    Number(it.period) === 36
                      ? 36
                      : Number(it.period) === 60
                      ? 60
                      : detectedPeriod;
                  const cleanCareService = sanitizeFiveYearWarrantyText(
                    it.careService || SUB_CARE_OPTIONS[0]
                  );
                  const cleanCareType = sanitizeFiveYearWarrantyText(
                    it.careType || it.careService || SUB_CARE_OPTIONS[0]
                  );
                  const cleanWarrantyType = sanitizeFiveYearWarrantyText(
                    it.warrantyType || resolvedWarrantyType || '5년 무상 A/S 기본 포함'
                  );
                  return {
                    id: `ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                    category:
                      it.category ||
                      `구독 가전 ${existingValidItems.length + idx + 1}`,
                    modelName:
                      it.modelName || it.modelCode || data.urlModelCode || '',
                    modelCode:
                      it.modelCode || it.modelName || data.urlModelCode || '',
                    monthlyFee:
                      Number(it.monthlyFee) > 0 ? Number(it.monthlyFee) : 0,
                    period: itemPeriod,
                    contractAmount:
                      Number(it.contractAmount) > 0
                        ? Number(it.contractAmount)
                        : Number(data.contractAmount) || 0,
                    careService: cleanCareService,
                    careType: cleanCareType,
                    warrantyType: cleanWarrantyType,
                    cardName: it.cardName || rawCardName,
                  };
                })
              : [];

          const nextItems =
            mappedItems.length === 0
              ? prev.items
              : existingValidItems.length === 0
              ? mappedItems
              : [...existingValidItems, ...mappedItems];

          if (mappedItems.length > 0) {
            const firstAdded = mappedItems[0];
            const addedLabel = firstAdded.modelName
              ? `${firstAdded.category} (${firstAdded.modelName})`
              : firstAdded.category;
            if (subScanNoticeTimerRef.current) {
              clearTimeout(subScanNoticeTimerRef.current);
            }
            setSubScanNotice(
              `✓ [${addedLabel}] 품목이 구독 목록에 추가되었습니다! (현재 총 ${nextItems.length}품목)`
            );
            subScanNoticeTimerRef.current = setTimeout(() => {
              setSubScanNotice(null);
            }, 3000);
          }

          const repPeriod: SubscriptionPeriod = nextItems.every(
            (it) => (it.period || 60) === 36
          )
            ? 36
            : 60;

          return {
            ...prev,
            items: nextItems,
            subscriptionPeriod: repPeriod,
            careService: sanitizeFiveYearWarrantyText(
              firstItem.careService || prev.careService
            ),
            warrantyType: resolvedWarrantyType,
            warrantyYears: 5,
            allCare: data.allCare ?? true,
            selectedCardId:
              mappedCard.cardId !== 'none'
                ? mappedCard.cardId
                : prev.selectedCardId,
            selectedCardTierId:
              mappedCard.cardId !== 'none'
                ? mappedCard.tierId
                : prev.selectedCardTierId,
          };
        });
      } catch (err: any) {
        setParseError(err?.message || '이미지 분석 중 오류가 발생했습니다.');
      } finally {
        setIsParsing(false);
      }
    },
    [setCurrentState]
  );

  // 홈 화면 상단 TODAY BRIEFING 배너용 통계 계산
  const activeCrmCustomers = useMemo(
    () => crmCustomers.filter((c) => !c.deletedAt),
    [crmCustomers]
  );
  const unconfirmedLogisticsCountHome = useMemo(
    () =>
      activeCrmCustomers.filter(
        (c) =>
          (c.status === '계약완료' || c.status === '발송완료') &&
          !c.logisticsConfirmed
      ).length,
    [activeCrmCustomers]
  );
  const unpaidGiftCountHome = useMemo(
    () =>
      activeCrmCustomers.filter(
        (c) => Boolean(c.giftItems && c.giftItems.trim()) && !c.giftSent
      ).length,
    [activeCrmCustomers]
  );

  return (
    <div
      className={`app-shell-bg min-h-[100dvh] w-full flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-[#0B0E14] text-slate-100' : 'bg-[#F4F2ED] text-[#18181B]'
      }`}
    >
      {/* ==================== 상단 글로벌 네비게이션 바 (Warm Ivory / Titanium Dark 전환 스위치 & 전체메뉴) ==================== */}
      <header
        className={`w-full min-h-[52px] border-b px-3 sm:px-5 py-2 flex items-center justify-between gap-2 sticky top-0 z-40 backdrop-blur-md transition-colors no-print ${
          isDark
            ? 'bg-[#121620]/95 text-white border-white/10'
            : 'bg-[#FAF8F4]/95 text-[#18181B] border-[#E2DDD3]'
        }`}
      >
        {/* 좌측: [홈] + [휴무표] + [AI 비서] */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setStep('home')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              step === 'home'
                ? isDark
                  ? 'bg-[#38BDF8] text-[#0B0E14] shadow-xs'
                  : 'bg-[#18181B] text-white shadow-xs'
                : isDark
                ? 'bg-[#1B2230] text-slate-200 hover:bg-[#232C3D] border border-white/10'
                : 'bg-white text-[#18181B] hover:bg-[#EAE5DC] border border-[#D6D3CD]'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>홈</span>
          </button>

          <button
            type="button"
            onClick={() => {
              pushAppHistoryGuard('open-schedule');
              setIsScheduleModalOpen(true);
            }}
            title="경기광주점 오늘 근무자 및 월별 휴무표 보기"
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 border transition cursor-pointer ${
              isDark
                ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#8C5A32]" />
            <span>휴무표</span>
          </button>

          <button
            type="button"
            onClick={() => {
              pushAppHistoryGuard('open-ai-command');
              setIsAiCommandModalOpen(true);
            }}
            title="자연어·음성 한 줄로 견적 계산 및 고객관리 자동 등록"
            className="px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xs transition cursor-pointer"
          >
            <span>✦ AI 비서</span>
          </button>

          <span
            className={`hidden lg:inline-block px-3 py-1 rounded-full text-xs font-extrabold truncate border ${
              isDark
                ? 'bg-[#1B2230] border-white/10 text-slate-300'
                : 'bg-[#EAE5DC]/70 border-[#D6D3CD] text-[#57534E]'
            }`}
          >
            {currentScreenBadgeLabel}
          </span>
        </div>

        {/* 우측: [☀️ 웜아이보리 / 🌙 다크] 테마 전환 스위치 + 앱 설치 + [☰ 전체메뉴] */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center gap-1.5 sm:gap-2 shrink-0"
        >
          {/* 1-Click 테마 전환 스위치 */}
          <button
            type="button"
            onClick={toggleUiTheme}
            title={
              isDark
                ? '웜 아이보리(라이트 모드)로 전환'
                : '티타늄 다크(다크 모드)로 전환'
            }
            className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              isDark
                ? 'bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border-[#38BDF8]/40'
                : 'bg-[#EAE5DC] hover:bg-[#DFD9CE] text-[#57534E] border-[#D4CDC0]'
            }`}
          >
            {isDark ? (
              <>
                <Moon className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="hidden xs:inline">다크 모드</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[#8C5A32]" />
                <span className="hidden xs:inline">웜 아이보리</span>
              </>
            )}
          </button>

          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallAppClick}
              title="홈 화면에 앱으로 설치하여 주소창 없이 실행"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition cursor-pointer ${
                isDark
                  ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                  : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">앱 설치</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => {
                if (!prev) pushAppHistoryGuard('open-menu');
                return !prev;
              });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              isMenuOpen
                ? isDark
                  ? 'bg-[#38BDF8] border-[#38BDF8] text-[#0B0E14]'
                  : 'bg-[#18181B] border-[#18181B] text-white'
                : isDark
                ? 'bg-[#1B2230] hover:bg-[#232C3D] border-white/10 text-white'
                : 'bg-white hover:bg-[#EAE5DC] border-[#D6D3CD] text-[#18181B]'
            }`}
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
            <span>전체메뉴</span>
            {urgentCount >= 1 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                {urgentCount}
              </span>
            )}
          </button>

          {/* [☰ 전체메뉴] 벤토 카드형 드롭다운 메뉴판 */}
          {isMenuOpen && (
            <div
              className={`absolute right-0 top-[calc(100%+10px)] w-[335px] sm:w-[395px] rounded-3xl border shadow-2xl p-3.5 space-y-2.5 z-50 ${
                isDark
                  ? 'bg-[#141924] border-white/15 text-white'
                  : 'bg-[#FAF8F4] border-[#D6D3CD] text-[#18181B]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setStep('crm');
                }}
                className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between border transition cursor-pointer ${
                  isDark
                    ? 'bg-gradient-to-r from-[#172542] to-[#0F172A] text-white border-[#38BDF8]/40 hover:border-[#38BDF8]'
                    : 'bg-[#1C1917] hover:bg-[#292524] text-white border-[#1C1917]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>VIP 통합 고객관리 (CRM)</span>
                </span>
                {urgentCount >= 1 ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black">
                    긴급 {urgentCount}건
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 opacity-75" />
                )}
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('general');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'general'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">01. 일반 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('subscription');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'subscription'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">02. 구독 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('hybrid');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'hybrid'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">03. 혼합 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('lotte-plan');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'lotte-plan'
                        ? 'bg-violet-600 text-white border-violet-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="truncate">04. 플랜 계산기</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('pop-printer');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'pop-printer'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">05. 구독 POP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('himobile');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'himobile'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="truncate">06. 하이 모바일</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('allcare-guide');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'allcare-guide'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="truncate">07. 가전 올케어</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('insurance');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'insurance'
                        ? 'bg-teal-600 text-white border-teal-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="truncate">08. 보험 청구안내</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setStep('care-table');
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                  isDark
                    ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-[#34D399]/40'
                    : 'bg-white hover:bg-[#F4ECE1] text-[#18181B] border-[#8C5A32]'
                }`}
              >
                <span className="flex items-center gap-2 shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#8C5A32]" />
                  <span>안심케어 · 가전이사 조견표</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold truncate ${
                    isDark
                      ? 'bg-[#34D399]/15 text-[#34D399]'
                      : 'bg-[#F4ECE1] text-[#8C5A32]'
                  }`}
                >
                  {careUpdateMonthBadge}
                </span>
              </button>

              <div
                className={`pt-2 border-t space-y-1.5 ${
                  isDark ? 'border-white/10' : 'border-[#E4DFD5]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-ai-command');
                    setIsAiCommandModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black text-center flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>✦ AI 비서 (한 줄 견적 · 고객관리 자동등록)</span>
                </button>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-installment');
                      setIsInstallmentModalOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-amber-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    무이자
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-card-issue');
                      setIsCardIssueOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-sky-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    카드발급
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-as-center');
                      setIsAsCenterOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-emerald-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    AS센터
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-schedule');
                      setIsScheduleModalOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-indigo-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    휴무표
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ==================== STEP 0: 3대 업무 그룹형 커맨드 센터 메인 홈 ==================== */}
      {step === 'home' && (
        <main className="flex-1 w-full flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl flex flex-col gap-3 sm:gap-3.5">
            {/* 0-1) 최상단 내 휴무 카운트다운 배너 */}
            <ScheduleCharacterBanner
              isDark={isDark}
              onOpenScheduleModal={() => {
                pushAppHistoryGuard('open-schedule');
                setIsScheduleModalOpen(true);
              }}
            />

            {/* 0-2) TODAY BRIEFING · VIP 통합 고객관리 히어로 배너 */}
            <button
              type="button"
              onClick={() => setStep('crm')}
              className={`w-full py-4 sm:py-5 px-4 sm:px-6 rounded-3xl transition-all flex items-center justify-between group cursor-pointer shadow-md hover:shadow-xl ${
                isDark
                  ? 'bg-gradient-to-r from-[#172542] to-[#0F172A] text-white border-[1.5px] border-[#38BDF8]/45 hover:border-[#38BDF8]'
                  : 'bg-[#18181B] hover:bg-[#27272A] text-white border border-[#18181B]'
              }`}
            >
              <div className="text-left min-w-0">
                <div className="text-[11px] sm:text-xs font-extrabold tracking-wider text-[#38BDF8] uppercase">
                  TODAY BRIEFING · 전체 관리 고객 {activeCrmCustomers.length}명
                </div>
                <div className="text-base sm:text-xl font-black tracking-tight truncate mt-0.5">
                  긴급 할일 {urgentCount}건 · 물류대기 {unconfirmedLogisticsCountHome}건 · 사은품 미지급 {unpaidGiftCountHome}건
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {urgentCount >= 1 ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-black animate-pulse shadow-xs">
                    VIP 고객관리 열기 ➔
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-[#38BDF8] text-[#0B0E14] text-xs sm:text-sm font-black shadow-xs">
                    VIP 고객관리 열기 ➔
                  </span>
                )}
              </div>
            </button>

            {/* STEP 01 · 맞춤 견적 & 카드 혜택 설계 (4종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-[#38BDF8]' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 01 · 맞춤 견적 & 카드 혜택 설계
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isDark ? 'text-slate-400' : 'text-[#78716C]'
                  }`}
                >
                  AI 사진스캔 지원
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleEnterMode('general')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-sky-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    일반 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    즉시할인+프리드
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('subscription')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-rose-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    구독 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    36/60개월 구독
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('hybrid')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-indigo-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    혼합 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    일반+구독 통합
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('lotte-plan')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    플랜 계산기
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    최대 -108만 할인
                  </div>
                </button>
              </div>
            </section>

            {/* STEP 02 · 매장 POP 출력 & 안심케어 조견표 (2종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-[#34D399]' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 02 · 매장 POP 출력 & 케어 조견표
                </span>
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    isDark
                      ? 'bg-[#34D399]/15 text-[#34D399]'
                      : 'bg-[#F4ECE1] text-[#8C5A32]'
                  }`}
                >
                  {careUpdateMonthBadge}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('pop-printer')}
                  className={`p-4 rounded-2xl text-left flex items-center justify-between border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-black truncate">
                      구독 POP 자동 출력기
                    </div>
                    <div
                      className={`text-xs font-medium truncate mt-0.5 ${
                        isDark ? 'text-slate-400' : 'text-[#78716C]'
                      }`}
                    >
                      견적 사진 스캔 · A4 2-UP 쇼카드
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => setStep('care-table')}
                  className={`p-4 rounded-2xl text-left flex items-center justify-between border-[1.5px] transition cursor-pointer ${
                    isDark
                      ? 'bg-[#16222F] hover:bg-[#1D2D3E] text-white border-[#34D399]/45'
                      : 'bg-[#FCF9F5] hover:bg-[#F4ECE1] text-[#18181B] border-[#8C5A32]'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-sm sm:text-base font-black truncate ${
                        isDark ? 'text-[#34D399]' : 'text-[#8C5A32]'
                      }`}
                    >
                      안심케어 · 가전이사 조견표
                    </div>
                    <div
                      className={`text-xs font-medium truncate mt-0.5 ${
                        isDark ? 'text-slate-300' : 'text-[#57534E]'
                      }`}
                    >
                      품목별 클리닝·이전설치 금액 복사
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8C5A32] shrink-0 ml-2" />
                </button>
              </div>
            </section>

            {/* STEP 03 · 고객 안내 가이드 & 즉시 조회 (6종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-slate-200' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 03 · 고객 안내 가이드 & 즉시 조회
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isDark ? 'text-slate-400' : 'text-[#78716C]'
                  }`}
                >
                  터치 시 즉시 열림
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('allcare-guide')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    가전 올케어
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    34종 2년 보증
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('insurance')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    보험 청구안내
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    구비서류 안내
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('himobile')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    하이 모바일
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    알뜰유심 개통
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-installment');
                    setIsInstallmentModalOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-amber-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">무이자 할부</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-card-issue');
                    setIsCardIssueOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-sky-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="truncate">제휴카드 발급</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-as-center');
                    setIsAsCenterOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-emerald-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span className="truncate">가전 AS센터</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      )}

      {/* ==================== STEP 1: 조건 입력 화면 ==================== */}
      {step === 'input' && (
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
          onShowProposal={() => setStep('proposal')}
          onBackToHome={() => setStep('home')}
          activeCustomer={activeCustomer}
          onClearActiveCustomer={() => setActiveCustomer(null)}
          onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
        />
      )}

      {/* ==================== STEP 2: 제안서 / 프리드 안내서 미리보기 화면 ==================== */}
      {step === 'proposal' && (
        <ProposalPreview
          state={currentState}
          onChange={setCurrentState}
          onBackToInput={() => setStep('input')}
          activeCustomer={activeCustomer}
          onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
        />
      )}

      {/* ==================== STEP 3: 4. 롯데 플랜 카드 계산기 & 제안서 화면 ==================== */}
      {step === 'lotte-plan' && (
        <LottePlanCalcView onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 4: 5. 구독 POP 자동 출력기 화면 ==================== */}
      {step === 'pop-printer' && (
        <PopPrinterApp onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 5: 통합 고객관리 시스템 화면 ==================== */}
      {step === 'crm' && (
        <CrmApp
          onBackToHome={() => setStep('home')}
          onOpenCustomerInQuoteBuilder={handleOpenCustomerInQuoteBuilder}
          onOpenQuoteRecordInQuoteBuilder={handleOpenQuoteRecordInQuoteBuilder}
          onCustomersChange={(list) => setCrmCustomers(list)}
        />
      )}

      {/* ==================== STEP 6: 6. 하이모바일 알뜰요금제 안내 & 즉시 개통 화면 ==================== */}
      {step === 'himobile' && (
        <HiMobileView onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 7: 7. 하이마트 보험상품 청구안내 (고객 전달용) 화면 ==================== */}
      {step === 'insurance' && (
        <InsuranceGuideView onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 8: 8. 가전 올케어 서비스 안내 & 보유가전 등록 화면 ==================== */}
      {step === 'allcare-guide' && (
        <AllCareGuideView onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 9: 안심케어 · 가전이사 조견표 화면 ==================== */}
      {step === 'care-table' && (
        <CareTableView onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== 카드사별 무이자 · 부분무이자 할부 행사 모달 ==================== */}
      <CardInstallmentModal
        isOpen={isInstallmentModalOpen}
        onClose={() => setIsInstallmentModalOpen(false)}
      />

      {/* ==================== 제휴카드 간편 발급 전용 모달 ==================== */}
      <CardIssueModal
        isOpen={isCardIssueOpen}
        onClose={() => setIsCardIssueOpen(false)}
      />

      {/* ==================== 가전 A/S 센터 & 플럭스·TCL 전용 모달 ==================== */}
      <AsCenterModal
        isOpen={isAsCenterOpen}
        onClose={() => setIsAsCenterOpen(false)}
      />

      {/* ==================== 경기광주점 근무 · 휴무표 전용 모달 ==================== */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* ==================== AI 비서 (통합 총괄 AI 비서) 모달 ==================== */}
      <AiCommandModal
        isOpen={isAiCommandModalOpen}
        onClose={() => setIsAiCommandModalOpen(false)}
        onApplyToQuote={(nextState, targetStep) => {
          if (nextState.quoteMode === 'general') {
            setGeneralState(nextState);
          } else if (nextState.quoteMode === 'subscription') {
            setSubscriptionState(nextState);
          } else {
            setHybridState(nextState);
          }
          setActiveMode(nextState.quoteMode);
          setParseError(null);
          setParseGeneralError(null);
          setStep(targetStep);
        }}
        onCustomerSaved={(savedCust, nextState) => {
          setActiveCustomer({
            id: savedCust.id,
            name: savedCust.name,
            phone: savedCust.phone,
          });
          setCrmCustomers(getCachedCustomers());
          if (nextState.quoteMode === 'general') {
            setGeneralState(nextState);
          } else if (nextState.quoteMode === 'subscription') {
            setSubscriptionState(nextState);
          } else {
            setHybridState(nextState);
          }
          setActiveMode(nextState.quoteMode);
        }}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        onOpenCareTable={() => setStep('care-table')}
        onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
        onOpenAsCenterModal={() => setIsAsCenterOpen(true)}
        onOpenInsuranceView={() => setStep('insurance')}
        onOpenCrmScreen={() => setStep('crm')}
        onLoadCrmCustomerQuote={(cust) => {
          const latestQuote =
            Array.isArray(cust.quotes) && cust.quotes.length > 0
              ? cust.quotes[0]
              : undefined;
          applyRestoredProposalState(
            cust,
            latestQuote?.proposalState ?? (cust as any).proposalState,
            latestQuote?.itemSummary ?? cust.items,
            latestQuote?.paidAmount ?? Number(cust.paidAmount),
            latestQuote?.quoteMode
          );
        }}
      />

      {/* ==================== CRM 고객 저장 팝업 모달 ==================== */}
      <SaveToCrmModal
        isOpen={isSaveToCrmOpen}
        onClose={() => setIsSaveToCrmOpen(false)}
        state={currentState}
        activeCustomer={activeCustomer}
        onSavedSuccess={(savedCust) => {
          setActiveCustomer(savedCust);
          setCrmCustomers(getCachedCustomers());
        }}
      />

      {/* ==================== PWA 앱 설치 / 주소창 숨김 안내 모달 ==================== */}
      {isInstallGuideOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={() => setIsInstallGuideOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    📲 주소창 없는 전용 앱(PWA) 설치 안내
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    홈 화면에 추가하면 주소창 없이 100% 전체화면으로 실행됩니다
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstallGuideOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-slate-700">
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-1.5">
                <div className="font-black text-blue-950 flex items-center gap-1.5">
                  <span>🤖 안드로이드 스마트폰 / 갤럭시탭 / 매장 PC (크롬·엣지)</span>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed font-medium">
                  1) 브라우저 우측 상단 메뉴 <strong>[⋮]</strong> 또는 주소창 우측의{' '}
                  <strong>[앱 설치 / 모니터 아이콘]</strong>을 누릅니다.
                  <br />
                  2) <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를
                  선택하면 바탕화면에 <strong>국지통합앱</strong> 아이콘이 생성됩니다.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-1.5">
                <div className="font-black text-slate-900 flex items-center gap-1.5">
                  <span>🍎 아이폰 / 아이패드 (Safari 브라우저)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  1) Safari 하단(아이패드는 상단)의{' '}
                  <strong>[공유 버튼 (네모 위 화살표 ↑)]</strong>을 터치합니다.
                  <br />
                  2) 메뉴를 내려 <strong>[홈 화면에 추가 (+)]</strong>를 누르고 우측 상단{' '}
                  <strong>[추가]</strong>를 터치합니다.
                  <br />
                  3) 홈 화면에 생성된 아이콘으로 실행하면 상·하단 주소창이 100% 사라집니다!
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsInstallGuideOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer"
                >
                  확인했습니다
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
