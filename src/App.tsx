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
import { ScheduleModal } from './components/ScheduleModal';
import { ScheduleCharacterBanner } from './components/ScheduleCharacterBanner';
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
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // 안심케어 조견표 데이터셋 및 최신 업데이트 월(Month) 자동 감지
  const [careDataset, setCareDataset] = useState<CareTableDataset | null>(() =>
    loadLocalCareDataset()
  );

  // 최신 화면 및 모달 상태를 참조하기 위한 Ref
  const latestAppStateRef = useRef({
    step,
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
    isSaveToCrmOpen,
    isInstallGuideOpen,
    isInstallmentModalOpen,
    isCardIssueOpen,
    isAsCenterOpen,
    isScheduleModalOpen,
    isMenuOpen,
  ]);

  // 단계나 메뉴가 바뀔 때마다 드롭다운 닫기 및 히스토리 가드 엔트리 1개 추가
  useEffect(() => {
    setIsMenuOpen(false);
    window.history.pushState({ appGuard: true }, '');
  }, [step, activeMode]);

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

  // 최초 1회만 등록되는 스마트폰 물리/제스처 뒤로가기 인터셉터
  useEffect(() => {
    window.history.replaceState({ appGuard: true }, '');
    window.history.pushState({ appGuard: true }, '');

    const handlePopState = () => {
      // 앱이 절대 종료되지 않도록 즉시 가드 히스토리 재주입
      window.history.pushState({ appGuard: true }, '');

      const current = latestAppStateRef.current;

      // 1순위: 열려 있는 모달/드롭다운 닫기
      if (current.isMenuOpen) {
        setIsMenuOpen(false);
        return;
      }
      if (current.isScheduleModalOpen) {
        setIsScheduleModalOpen(false);
        return;
      }
      if (current.isInstallmentModalOpen) {
        setIsInstallmentModalOpen(false);
        return;
      }
      if (current.isCardIssueOpen) {
        setIsCardIssueOpen(false);
        return;
      }
      if (current.isAsCenterOpen) {
        setIsAsCenterOpen(false);
        return;
      }
      if (current.isSaveToCrmOpen) {
        setIsSaveToCrmOpen(false);
        return;
      }
      if (current.isInstallGuideOpen) {
        setIsInstallGuideOpen(false);
        return;
      }

      // 2순위: 현재 화면(예: 안심케어 조견표) 내부의 하위 폴더/단계 뒤로가기가 있으면 먼저 실행
      const subBackHandler = (window as any).__subViewBackHandler as
        | (() => boolean)
        | undefined;
      if (typeof subBackHandler === 'function') {
        const handledBySubView = subBackHandler();
        if (handledBySubView) {
          return; // 하위 폴더에서 한 단계 뒤로 이동 완료했으므로 메인으로 나가지 않음!
        }
      }

      // 3순위: 제안서 미리보기('proposal') 화면이면 조건 입력('input') 화면으로 이동
      if (current.step === 'proposal') {
        setStep('input');
        return;
      }

      // 4순위: 그 외 메뉴 화면이면 메인 홈('home')으로 이동
      if (current.step !== 'home') {
        setStep('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex flex-col">
      {/* ==================== 상단 다크 글로벌 네비게이션 바 (좌: [🏠 홈] + [📅 휴무표] / 우: 앱설치 + 햄버거 메뉴) ==================== */}
      <header className="w-full min-h-[44px] bg-slate-900 text-white border-b border-slate-800 px-2.5 sm:px-4 py-1.5 flex items-center justify-between gap-2 sticky top-0 z-40 no-print">
        {/* 좌측: 모바일에서 절대 잘리지 않도록 [🏠 홈]과 [📅 휴무표] 딱 2개만 배치 */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setStep('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              step === 'home'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>🏠 홈</span>
          </button>

          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            title="경기광주점 오늘 근무자 및 월별 휴무표 보기"
            className="px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shrink-0 bg-indigo-500 hover:bg-indigo-400 text-white border border-indigo-400 shadow-xs transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📅 휴무표</span>
          </button>

          <span className="hidden lg:inline-block px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-extrabold text-slate-200 truncate">
            {currentScreenBadgeLabel}
          </span>
        </div>

        {/* 우측: PWA 앱 설치 버튼 & [☰ 메뉴] 드롭다운 */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center gap-1.5 shrink-0"
        >
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallAppClick}
              title="홈 화면에 앱으로 설치하여 주소창 없이 실행"
              className="px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>📲 앱 설치</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              isMenuOpen
                ? 'bg-amber-500 border-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
            }`}
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
            <span>☰ 메뉴</span>
            {urgentCount >= 1 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                {urgentCount}
              </span>
            )}
          </button>

          {/* [☰ 메뉴] 카드형 드롭다운 메뉴판 */}
          {isMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[330px] sm:w-[390px] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 space-y-2.5 z-50 text-white">
              {/* 1) 최상단 단독 버튼: 👑 통합 고객관리 */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setStep('crm');
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between border transition cursor-pointer ${
                  step === 'crm'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white border-amber-500/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>👑 통합 고객관리</span>
                </span>
                {urgentCount >= 1 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black">
                    🔥긴급 {urgentCount}건
                  </span>
                ) : (
                  <span className="text-[11px] font-bold opacity-75">➔</span>
                )}
              </button>

              {/* 2) 중단 2열 그리드 (좌 1~4 / 우 5~8) */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* 좌측 열 (1 ~ 4) */}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('general');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'general'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">1. 일반 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('subscription');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'subscription'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">2. 구독 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('hybrid');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'hybrid'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">3. 혼합 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('lotte-plan');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'lotte-plan'
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="truncate">4. 플랜 계산기</span>
                  </button>
                </div>

                {/* 우측 열 (5 ~ 8 — 7번 가전 올케어, 8번 보험 청구안내 위치 맞교환) */}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('pop-printer');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'pop-printer'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">5. 구독 POP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('himobile');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'himobile'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">6. 하이 모바일</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('allcare-guide');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'allcare-guide'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">7. 가전 올케어</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setStep('insurance');
                    }}
                    className={`w-full py-2.5 px-2.5 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'insurance'
                        ? 'bg-teal-600 text-white border-teal-500'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">8. 보험 청구안내</span>
                  </button>
                </div>
              </div>

              {/* 3) 최하단 단독 버튼: 📋 안심케어 조견표 */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setStep('care-table');
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                  step === 'care-table'
                    ? 'bg-cyan-600 text-white border-cyan-400'
                    : 'bg-slate-800 hover:bg-cyan-600 text-white border-cyan-500/40'
                }`}
              >
                <span className="flex items-center gap-1.5 shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>📋 안심케어 조견표</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-400/40 text-cyan-200 text-[10px] font-extrabold truncate">
                  {careUpdateMonthBadge}
                </span>
              </button>

              {/* 4) 어떤 화면에서든 열 수 있는 퀵 모달 바로가기 (무이자 할부 / 카드발급 / AS센터 / 휴무표) */}
              <div className="pt-1 border-t border-slate-800 grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInstallmentModalOpen(true);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black text-center truncate cursor-pointer"
                >
                  💳 무이자
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCardIssueOpen(true);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-[11px] font-black text-center truncate cursor-pointer"
                >
                  🪪 카드발급
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsAsCenterOpen(true);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-black text-center truncate cursor-pointer"
                >
                  🛠️ AS센터
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsScheduleModalOpen(true);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-black text-center truncate cursor-pointer"
                >
                  📅 휴무표
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ==================== STEP 0: 메인 홈 화면 ==================== */}
      {step === 'home' && (
        <main className="flex-1 w-full flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl flex flex-col gap-2.5 sm:gap-3.5">
            {/* 0-1) 최상단 졸라맨 내 휴무 카운트다운 애니메이션 배너 (클릭 시 휴무표 모달 오픈) */}
            <ScheduleCharacterBanner
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
            />

            {/* 0-2) [💳 무이자 할부] | [🪪 카드발급] | [🛠️ AS센터] 3열 상시 퀵 버튼 (통합 고객관리 바로 위) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsInstallmentModalOpen(true)}
                className="w-full py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-500 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 font-black text-xs sm:text-base cursor-pointer"
              >
                <span>💳 무이자 할부</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCardIssueOpen(true)}
                className="w-full py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl bg-sky-400 hover:bg-sky-300 text-slate-950 border-2 border-sky-500 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 font-black text-xs sm:text-base cursor-pointer"
              >
                <span>🪪 카드발급</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAsCenterOpen(true)}
                className="w-full py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-2 border-emerald-500 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 font-black text-xs sm:text-base cursor-pointer"
              >
                <span>🛠️ AS센터</span>
              </button>
            </div>

            {/* 1) 상단 단독 (가로 전체 Full-width 1칸): 👑 통합 고객관리 */}
            <button
              type="button"
              onClick={() => setStep('crm')}
              className="w-full py-4 sm:py-5 px-4 sm:px-6 rounded-2xl sm:rounded-3xl bg-white hover:bg-amber-500 text-slate-900 hover:text-white border-2 border-amber-400 hover:border-amber-500 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500 group-hover:bg-white text-white group-hover:text-amber-600 flex items-center justify-center transition shrink-0 shadow-xs">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-base sm:text-xl font-black tracking-tight truncate">
                    👑 통합 고객관리 (CRM · 스케줄 · 문자)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {urgentCount >= 1 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-black animate-pulse shadow-xs">
                    🔥 긴급 {urgentCount}건
                  </span>
                )}
                <span className="text-sm sm:text-base font-extrabold text-amber-600 group-hover:text-white">
                  ➔
                </span>
              </div>
            </button>

            {/* 2) 중앙 양쪽 두 줄 (좌 1~4 / 우 5~8 완벽 2열 대칭) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* 왼쪽 열 (1 ~ 4번 : 견적 · 계산기) */}
              <div className="flex flex-col gap-2.5 sm:gap-3.5">
                <button
                  type="button"
                  onClick={() => handleEnterMode('general')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-blue-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-blue-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-600 group-hover:bg-white text-white group-hover:text-blue-600 flex items-center justify-center transition shrink-0">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      1. 일반 견적
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('subscription')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-rose-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-rose-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-rose-600 group-hover:bg-white text-white group-hover:text-rose-600 flex items-center justify-center transition shrink-0">
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      2. 구독 견적
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('hybrid')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-indigo-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-indigo-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-600 group-hover:bg-white text-white group-hover:text-indigo-600 flex items-center justify-center transition shrink-0">
                      <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      3. 혼합 견적
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('lotte-plan')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-violet-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-violet-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-violet-600 group-hover:bg-white text-white group-hover:text-violet-600 flex items-center justify-center transition shrink-0">
                      <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      4. 플랜 계산기
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>
              </div>

              {/* 오른쪽 열 (5 ~ 8번 : 7번 가전 올케어 · 8번 보험 청구안내 위치 교체) */}
              <div className="flex flex-col gap-2.5 sm:gap-3.5">
                <button
                  type="button"
                  onClick={() => setStep('pop-printer')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-emerald-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-emerald-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-600 group-hover:bg-white text-white group-hover:text-emerald-600 flex items-center justify-center transition shrink-0">
                      <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      5. 구독 POP
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('himobile')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-purple-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-purple-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-purple-600 group-hover:bg-white text-white group-hover:text-purple-600 flex items-center justify-center transition shrink-0">
                      <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      6. 하이 모바일
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('allcare-guide')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-sky-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-sky-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-sky-600 group-hover:bg-white text-white group-hover:text-sky-600 flex items-center justify-center transition shrink-0">
                      <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      7. 가전 올케어
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('insurance')}
                  className="w-full py-4 sm:py-5 px-3 sm:px-5 rounded-2xl sm:rounded-3xl bg-white hover:bg-teal-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-teal-600 shadow-md hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-600 group-hover:bg-white text-white group-hover:text-teal-600 flex items-center justify-center transition shrink-0">
                      <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight truncate">
                      8. 보험 청구안내
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm font-extrabold text-slate-400 group-hover:text-white shrink-0 ml-1">
                    ➔
                  </span>
                </button>
              </div>
            </div>

            {/* 3) 최하단 단독 (가로 전체 Full-width 1칸 — 상단 통합고객관리와 대칭되는 배너형 버튼) */}
            <button
              type="button"
              onClick={() => setStep('care-table')}
              className="w-full py-4 sm:py-5 px-4 sm:px-6 rounded-2xl sm:rounded-3xl bg-white hover:bg-cyan-600 text-slate-900 hover:text-white border-2 border-cyan-500 hover:border-cyan-600 shadow-md hover:shadow-xl transition-all flex flex-wrap items-center justify-between gap-2 group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-600 group-hover:bg-white text-white group-hover:text-cyan-600 flex items-center justify-center transition shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-base sm:text-xl font-black tracking-tight truncate">
                    📋 안심케어 · 가전이사 조견표
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <span className="px-3 py-1 rounded-full bg-cyan-50 group-hover:bg-cyan-950/90 text-cyan-800 group-hover:text-cyan-200 border border-cyan-300 group-hover:border-cyan-400/50 text-xs sm:text-sm font-black shadow-2xs transition">
                  {careUpdateMonthBadge}
                </span>
                <span className="text-sm sm:text-base font-extrabold text-cyan-600 group-hover:text-white">
                  ➔
                </span>
              </div>
            </button>
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
