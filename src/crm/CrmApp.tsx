import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
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
} from './types/crm';
import {
  CRM_CUSTOMERS_UPDATED_EVENT,
  deleteQuoteAndSyncCustomer,
  fetchCustomersFromGas,
  getCachedCustomers,
  getCustomerIdentityKey,
  setCachedCustomers,
  syncCustomerFromConfirmedSlips,
  syncCustomerToGas,
  toggleSlipDeliveryStatusAndSyncCustomer,
} from './services/gasApi';
import {
  getBriefingSummary,
  triggerDailyMorningNotification,
} from './services/notificationService';
import {
  getDeliveryDDay,
  getPastDueDeliveryCustomers,
  hasUnpaidGift,
  isPendingLogisticsCustomer,
  isUrgentCustomer,
} from './utils/date';
import {
  computeMonthlySettlementReport,
  extractPerformanceFromProposalState,
  getCurrentYearMonth,
  resolveCustomerPerformanceProfile,
} from './utils/settlementEngine';
import { syncMarketingDbTrashFromCrmCustomer } from '../utils/marketingDbEngine';
import { CRMHeader } from './components/CRMHeader';
import { CompactCustomerCard } from './components/CompactCustomerCard';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { SMSModal } from './components/SMSModal';
import { NewCustomerModal } from './components/NewCustomerModal';
import { SettingsModal } from './components/SettingsModal';
import { MorningBriefingModal } from './components/MorningBriefingModal';
import { PastDeliveryCheckModal } from './components/PastDeliveryCheckModal';
import { CrmSalesAndIncentivePanel } from './components/CrmSalesAndIncentivePanel';
import {
  SlipBatchSavedSummary,
  SlipBatchUploadModal,
} from './components/SlipBatchUploadModal';
import {
  CrmAnalyticsStrip,
  CrmDeliveryCalendar,
  CrmKanbanBoard,
} from './components/CrmKanbanAndAnalytics';

const PRIMARY_CRM_TABS: CrmPrimaryTab[] = [
  '전체',
  '🔥 할일·긴급',
  '💬 상담중',
  '🚚 배송',
  '✅ 배송완료',
];

const BRIEFING_SHOWN_SESSION_KEY = 'gookji_crm_briefing_shown_session';
export const PAST_DELIVERY_POPUP_DISMISSED_KEY =
  'himart_past_delivery_popup_dismissed_session';

type CrmViewMode = 'grid' | 'kanban' | 'calendar';
type ConsultingSubFilter = 'all' | '신규/미발송' | '상담진행중' | '미구매/고민중';
type UrgentSubFilter = 'all' | 'gifts';

const CRM_LAST_ACTIVE_TAB_KEY = 'himart_crm_last_tab_v2';

export type CrmQuickFilterShortcut = 'urgent' | 'delivery' | 'gifts' | FilterTab;

function mapFilterShortcutToPrimaryState(raw?: CrmQuickFilterShortcut): {
  primary: CrmPrimaryTab;
  consultSub?: ConsultingSubFilter;
  urgentSub?: UrgentSubFilter;
} | null {
  if (!raw) return null;
  if (raw === '전체') return { primary: '전체' };
  if (raw === 'urgent' || raw === '🔥긴급/오늘할일' || raw === '🔥 할일·긴급') {
    return { primary: '🔥 할일·긴급', urgentSub: 'all' };
  }
  if (raw === 'gifts' || raw === '🎁사은품미지급') {
    return { primary: '🔥 할일·긴급', urgentSub: 'gifts' };
  }
  if (
    raw === 'delivery' ||
    raw === '🚚물류/배송대기' ||
    raw === '🚚 배송' ||
    raw === '계약완료' ||
    raw === '발송완료'
  ) {
    return { primary: '🚚 배송' };
  }
  if (raw === '💬 상담중') {
    return { primary: '💬 상담중', consultSub: 'all' };
  }
  if (
    raw === '신규/미발송' ||
    raw === '상담진행중' ||
    raw === '미구매/고민중'
  ) {
    return { primary: '💬 상담중', consultSub: raw };
  }
  if (raw === '배송완료' || raw === '✅ 배송완료') {
    return { primary: '✅ 배송완료' };
  }
  if (raw === '취소/보류') {
    return { primary: '취소/보류' };
  }
  return null;
}

interface CrmAppProps {
  onBackToHome: () => void;
  backLabel?: string;
  onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
  onOpenQuoteRecordInQuoteBuilder: (
    customer: CustomerItem,
    quote: QuoteRecord
  ) => void;
  onCustomersChange?: (customers: CustomerItem[]) => void;
  initialSettlementTab?: SettlementTabId;
  initialFilterTab?: CrmQuickFilterShortcut;
  initialSelectedCustomerId?: string | null;
}

export const CrmApp: React.FC<CrmAppProps> = ({
  onBackToHome,
  backLabel,
  onOpenCustomerInQuoteBuilder,
  onOpenQuoteRecordInQuoteBuilder,
  onCustomersChange,
  initialSettlementTab,
  initialFilterTab,
  initialSelectedCustomerId,
}) => {
  // 앱 다크모드 실시간 동기화
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'dark'
      : false
  );

  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const sync = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  const [customers, setCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 월간 총판·실판 및 수당 정산 탭 상태
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() =>
    getCurrentYearMonth()
  );
  const [settlementTab, setSettlementTab] = useState<SettlementTabId>(
    initialSettlementTab || 'sales'
  );

  useEffect(() => {
    if (initialSettlementTab) {
      setSettlementTab(initialSettlementTab);
    }
  }, [initialSettlementTab]);

  const [viewMode, setViewMode] = useState<CrmViewMode>('grid');
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [consultSubFilter, setConsultSubFilter] =
    useState<ConsultingSubFilter>(() => {
      const mapped = mapFilterShortcutToPrimaryState(initialFilterTab);
      return mapped?.consultSub || 'all';
    });
  const [urgentSubFilter, setUrgentSubFilter] = useState<UrgentSubFilter>(() => {
    const mapped = mapFilterShortcutToPrimaryState(initialFilterTab);
    return mapped?.urgentSub || 'all';
  });

  const [activeTab, setActiveTab] = useState<CrmPrimaryTab>(() => {
    const mappedInitial = mapFilterShortcutToPrimaryState(initialFilterTab);
    if (mappedInitial) return mappedInitial.primary;
    try {
      const saved = sessionStorage.getItem(
        CRM_LAST_ACTIVE_TAB_KEY
      ) as CrmPrimaryTab | null;
      if (
        saved &&
        ([...PRIMARY_CRM_TABS, '취소/보류'] as readonly string[]).includes(saved)
      ) {
        return saved;
      }
    } catch {
      // ignore
    }
    return '전체';
  });

  const applyFilterSelection = useCallback((rawTab: CrmQuickFilterShortcut) => {
    const mapped = mapFilterShortcutToPrimaryState(rawTab);
    if (!mapped) return;
    setViewMode('grid');
    setActiveTab(mapped.primary);
    setConsultSubFilter(mapped.consultSub || 'all');
    setUrgentSubFilter(mapped.urgentSub || 'all');
  }, []);

  useEffect(() => {
    if (initialFilterTab) {
      applyFilterSelection(initialFilterTab);
    }
  }, [initialFilterTab, applyFilterSelection]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CRM_LAST_ACTIVE_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('urgentFirst');

  // Undo 실행 취소 히스토리 스택 (최대 15단계)
  const [undoHistory, setUndoHistory] = useState<
    { label: string; snapshot: CustomerItem[] }[]
  >([]);

  // 모달 상태
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialSelectedCustomerId || null
  );

  useEffect(() => {
    if (initialSelectedCustomerId) {
      setCustomers(getCachedCustomers());
      setSelectedCustomerId(initialSelectedCustomerId);
    }
  }, [initialSelectedCustomerId]);
  const [smsCustomer, setSmsCustomer] = useState<CustomerItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [prefillNewCustomer, setPrefillNewCustomer] =
    useState<Partial<CustomerItem> | null>(null);
  const [isSlipUploadOpen, setIsSlipUploadOpen] = useState<boolean>(false);
  const [slipUploadTargetCustomer, setSlipUploadTargetCustomer] =
    useState<CustomerItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);
  const [isPastDeliveryModalOpen, setIsPastDeliveryModalOpen] =
    useState<boolean>(false);

  useEffect(() => {
    if (
      isSlipUploadOpen ||
      smsCustomer !== null ||
      selectedCustomerId !== null ||
      isNewModalOpen ||
      isSettingsOpen ||
      isBriefingOpen ||
      isPastDeliveryModalOpen
    ) {
      try {
        window.history.pushState({ appGuard: true, tag: 'crm-modal' }, '');
      } catch {
        // ignore
      }
    }
    (window as any).__subViewBackHandler = (): boolean => {
      if (isSlipUploadOpen) {
        setIsSlipUploadOpen(false);
        setSlipUploadTargetCustomer(null);
        return true;
      }
      if (smsCustomer !== null) {
        setSmsCustomer(null);
        return true;
      }
      if (selectedCustomerId !== null) {
        setSelectedCustomerId(null);
        return true;
      }
      if (isNewModalOpen) {
        setIsNewModalOpen(false);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isPastDeliveryModalOpen) {
        setIsPastDeliveryModalOpen(false);
        return true;
      }
      if (isBriefingOpen) {
        setIsBriefingOpen(false);
        return true;
      }
      if (viewMode !== 'grid') {
        setViewMode('grid');
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [
    isSlipUploadOpen,
    smsCustomer,
    selectedCustomerId,
    isNewModalOpen,
    isSettingsOpen,
    isBriefingOpen,
    isPastDeliveryModalOpen,
    viewMode,
  ]);

  // Sonner 스타일 플로팅 토스트 (Undo 지원)
  const [toastState, setToastState] = useState<{
    msg: string;
    canUndo?: boolean;
  } | null>(null);

  const showToast = useCallback((msg: string, canUndo = false) => {
    setToastState({ msg, canUndo });
    setTimeout(() => {
      setToastState((prev) => (prev?.msg === msg ? null : prev));
    }, 4200);
  }, []);

  const pushUndoSnapshot = useCallback(
    (label: string) => {
      setUndoHistory((prev) => [
        ...prev.slice(-14),
        { label, snapshot: customers },
      ]);
    },
    [customers]
  );

  const handleUndoLastAction = useCallback(() => {
    if (undoHistory.length === 0) return;
    const last = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, -1));
    const deduped = setCachedCustomers(last.snapshot);
    setCustomers(deduped);
    showToast(`↩ 실행 취소됨: ${last.label}`, false);
  }, [undoHistory, showToast]);

  useEffect(() => {
    if (onCustomersChange) {
      onCustomersChange(customers);
    }
  }, [customers, onCustomersChange]);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    const { customers: loaded } = await fetchCustomersFromGas();
    setCustomers(loaded);
    setIsLoading(false);

    const activeLoaded = loaded.filter((c) => !c.deletedAt);
    const alreadyShown = sessionStorage.getItem(BRIEFING_SHOWN_SESSION_KEY);
    const summary = getBriefingSummary(activeLoaded);
    if (!alreadyShown && summary.totalActionCount > 0) {
      sessionStorage.setItem(BRIEFING_SHOWN_SESSION_KEY, '1');
      setIsBriefingOpen(true);
      triggerDailyMorningNotification(activeLoaded, false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    const syncLocal = () => setCustomers(getCachedCustomers());
    window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncLocal);
    return () => window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncLocal);
  }, [loadCustomers]);

  const activeCustomers = useMemo(
    () => customers.filter((c) => !c.deletedAt),
    [customers]
  );
  const pastDueDeliveryCustomers = useMemo(
    () => getPastDueDeliveryCustomers(activeCustomers),
    [activeCustomers]
  );

  useEffect(() => {
    if (
      pastDueDeliveryCustomers.length > 0 &&
      sessionStorage.getItem(PAST_DELIVERY_POPUP_DISMISSED_KEY) !== '1'
    ) {
      setIsPastDeliveryModalOpen(true);
    }
  }, [pastDueDeliveryCustomers.length]);

  const markCustomerSlipsDelivered = (c: CustomerItem): CustomerItem => {
    if (!Array.isArray(c.quotes) || !c.quotes.some((q) => q?.isConfirmedSlip)) {
      return c;
    }
    const nextQuotes = c.quotes.map((q) =>
      q?.isConfirmedSlip
        ? {
            ...q,
            deliveryStatus: '배송완료' as const,
            deliveryDate: q.deliveryDate || q.contractDate || c.deliveryDate,
          }
        : q
    );
    return syncCustomerFromConfirmedSlips({
      ...c,
      quotes: nextQuotes,
      status: '배송완료',
      logisticsConfirmed: true,
    });
  };

  const handleConfirmDelivered = async (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    pushUndoSnapshot(`${target.name} 배송완료 처리`);
    const nowMs = Date.now();
    const updated = customers.map((c) =>
      c.id === customerId
        ? {
            ...markCustomerSlipsDelivered(c),
            status: '배송완료' as CustomerStatus,
            logisticsConfirmed: true,
            updatedAtMs: nowMs,
          }
        : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    const keepForGift = hasUnpaidGift(target);
    showToast(
      keepForGift
        ? `🚚 [${target.name}] 배송완료! (🎁 미지급 사은품이 남아 있어 할일 탭에 표시됩니다)`
        : `✅ [${target.name}] 배송완료 처리되었습니다.`,
      true
    );
    await syncCustomerToGas('update', {
      id: customerId,
      status: '배송완료',
      logisticsConfirmed: true,
    });
  };

  const handleConfirmAllDelivered = async (customerIds: string[]) => {
    if (customerIds.length === 0) return;
    const idSet = new Set(customerIds);
    pushUndoSnapshot(`배송완료 일괄 처리 (${customerIds.length}건)`);
    const nowMs = Date.now();
    const updated = customers.map((c) =>
      idSet.has(c.id)
        ? {
            ...markCustomerSlipsDelivered(c),
            status: '배송완료' as CustomerStatus,
            logisticsConfirmed: true,
            updatedAtMs: nowMs,
          }
        : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    setIsPastDeliveryModalOpen(false);
    showToast(`✅ 총 ${customerIds.length}건 배송완료 처리되었습니다.`, true);
    for (const cid of customerIds) {
      await syncCustomerToGas('update', {
        id: cid,
        status: '배송완료',
        logisticsConfirmed: true,
      });
    }
  };

  const trashedCustomers = useMemo(
    () => customers.filter((c) => Boolean(c.deletedAt)),
    [customers]
  );

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId) || null,
    [activeCustomers, selectedCustomerId]
  );

  const handleStatusChange = async (
    id: string,
    nextStatus: CustomerStatus
  ) => {
    const target = customers.find((c) => c.id === id);
    if (target && target.status === nextStatus) return;
    pushUndoSnapshot(`${target?.name || '고객'} 상태 변경`);
    const nowMs = Date.now();
    const updated: CustomerItem[] = customers.map((c): CustomerItem => {
      if (c.id !== id) return c;
      if (nextStatus === '배송완료') {
        return {
          ...markCustomerSlipsDelivered(c),
          status: '배송완료',
          updatedAtMs: nowMs,
        };
      }
      if (
        nextStatus === '계약완료' &&
        Array.isArray(c.quotes) &&
        c.quotes.some((q) => q?.isConfirmedSlip)
      ) {
        const hasPending = c.quotes.some(
          (q) => q?.isConfirmedSlip && q.deliveryStatus !== '배송완료'
        );
        const reopenedQuotes = hasPending
          ? c.quotes
          : c.quotes.map((q, idx) =>
              idx === 0 && q?.isConfirmedSlip
                ? { ...q, deliveryStatus: '배송대기' as const }
                : q
            );
        return {
          ...c,
          quotes: reopenedQuotes,
          status: '계약완료',
          logisticsConfirmed: false,
          updatedAtMs: nowMs,
        };
      }
      return { ...c, status: nextStatus, updatedAtMs: nowMs };
    });
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(
      `📌 [${target?.name || '고객'}] 상태 → [${nextStatus}]`,
      true
    );
    await syncCustomerToGas('update', { id, status: nextStatus, updatedAtMs: nowMs });
  };

  const handleToggleSlipDeliveryStatus = async (
    customerId: string,
    quoteId: string
  ) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    pushUndoSnapshot(`${target.name} 전표 배송상태 변경`);
    const updated = customers.map((c) =>
      c.id === customerId
        ? toggleSlipDeliveryStatusAndSyncCustomer(c, quoteId)
        : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    const synced = deduped.find((c) => c.id === customerId);
    if (synced) {
      const targetQuote = synced.quotes?.find((q) => q.id === quoteId);
      const slipStateLabel =
        targetQuote?.deliveryStatus === '배송완료' ? '✅ 배송완료' : '🚚 배송';
      showToast(
        `${slipStateLabel} 반영 완료 (고객 대표 상태: ${
          synced.status === '계약완료' ? '🚚 배송' : synced.status
        })`,
        true
      );
      await syncCustomerToGas('update', {
        id: customerId,
        status: synced.status,
        deliveryDate: synced.deliveryDate,
        logisticsConfirmed: synced.logisticsConfirmed,
        quotes: synced.quotes,
        updatedAtMs: synced.updatedAtMs,
      });
    }
  };

  const handleMemoChange = async (id: string, nextMemo: string) => {
    const nowMs = Date.now();
    const updated = customers.map((c) =>
      c.id === id ? { ...c, memo: nextMemo, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast('📝 상담 메모가 저장되었습니다.');
    await syncCustomerToGas('update', { id, memo: nextMemo, updatedAtMs: nowMs });
  };

  const handleFieldChange = async (
    id: string,
    patch: Partial<CustomerItem>
  ) => {
    const target = customers.find((c) => c.id === id);
    pushUndoSnapshot(`${target?.name || '고객'} 정보 수정`);
    const nowMs = Date.now();
    const stampedPatch: Partial<CustomerItem> = {
      ...patch,
      updatedAtMs: nowMs,
    };
    const updated = customers.map((c) =>
      c.id === id ? { ...c, ...stampedPatch } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    if (selectedCustomerId === id && !deduped.some((c) => c.id === id) && target) {
      const mergedKey = getCustomerIdentityKey({ ...target, ...stampedPatch } as CustomerItem);
      const survivor = deduped.find((c) => !c.deletedAt && getCustomerIdentityKey(c) === mergedKey);
      if (survivor) setSelectedCustomerId(survivor.id);
    }
    if ('logisticsConfirmed' in patch) {
      showToast(
        `🚚 [${target?.name || '고객'}] ${
          patch.logisticsConfirmed ? '물류확정 완료' : '배송대기로 변경'
        }`,
        true
      );
    } else if ('giftSent' in patch) {
      showToast(
        `🎁 [${target?.name || '고객'}] ${
          patch.giftSent ? '사은품 지급완료' : '사은품 미지급으로 변경'
        }`,
        true
      );
    } else {
      showToast(`✅ [${target?.name || '고객'}] 정보가 업데이트되었습니다.`, true);
    }
    await syncCustomerToGas('update', { id, ...patch });
  };

  const handleDeleteQuoteRecord = async (
    customerId: string,
    quoteId: string
  ) => {
    pushUndoSnapshot('보관 전표/견적 삭제');
    const updated = customers.map((c) =>
      c.id === customerId ? deleteQuoteAndSyncCustomer(c, quoteId) : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast('🗑️ 선택한 항목이 삭제되었으며 고객 실적·상태가 자동 재합산되었습니다.', true);
    const target = deduped.find((c) => c.id === customerId);
    if (target) {
      await syncCustomerToGas('update', {
        id: customerId,
        quotes: target.quotes,
        items: target.items,
        paidAmount: target.paidAmount,
        netAmount: target.netAmount,
        expectedBenefit: target.expectedBenefit,
        saleType: target.saleType,
        performanceAmount: target.performanceAmount,
        generalProductTotal: target.generalProductTotal,
        subscriptionPrincipal: target.subscriptionPrincipal,
        freedCounts: target.freedCounts,
        purchasedModels: target.purchasedModels,
        status: target.status,
        deliveryDate: target.deliveryDate,
        logisticsConfirmed: target.logisticsConfirmed,
      });
    }
  };

  const handleApplyQuoteAsPrimary = async (
    customerId: string,
    quote: QuoteRecord
  ) => {
    pushUndoSnapshot('대표 견적 변경');
    const extractedPerf = extractPerformanceFromProposalState(
      quote.proposalState
    );
    const patch: Partial<CustomerItem> = {
      items: quote.itemSummary,
      paidAmount: quote.paidAmount,
      netAmount: quote.netAmount,
      expectedBenefit: quote.benefit,
      saleType: extractedPerf?.saleType || quote.quoteMode || 'general',
      performanceAmount:
        extractedPerf?.performanceAmount ?? quote.performanceAmount,
      generalProductTotal:
        extractedPerf?.generalProductTotal ?? quote.generalProductTotal,
      subscriptionPrincipal:
        extractedPerf?.subscriptionPrincipal ?? quote.subscriptionPrincipal,
      freedCounts: extractedPerf?.freedCounts ?? quote.freedCounts,
      purchasedModels:
        extractedPerf?.purchasedModels ?? quote.purchasedModels,
    };

    const nowMs = Date.now();
    const updated = customers.map((c) =>
      c.id === customerId ? { ...c, ...patch, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(`📌 [${quote.title}] 견적이 대표 견적 및 실적 기준으로 적용되었습니다.`, true);
    await syncCustomerToGas('update', {
      id: customerId,
      ...patch,
    });
  };

  const handleDeleteCustomer = async (id: string) => {
    const deletedAt = Date.now();
    const target = customers.find((c) => c.id === id);
    pushUndoSnapshot(`${target?.name || '고객'} 휴지통 이동`);
    const updated = customers.map((c) =>
      c.id === id ? { ...c, deletedAt, updatedAtMs: deletedAt } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    if (target) {
      syncMarketingDbTrashFromCrmCustomer(target, true);
    }
    showToast(
      `🗑️ [${target?.name || '고객'}]님이 휴지통으로 이동되었습니다.`,
      true
    );
    await syncCustomerToGas('update', { id, deletedAt });
  };

  const handleRestoreCustomer = async (id: string) => {
    const target = customers.find((c) => c.id === id);
    const nowMs = Date.now();
    const updated = customers.map((c) =>
      c.id === id ? { ...c, deletedAt: undefined, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    if (target) {
      syncMarketingDbTrashFromCrmCustomer(target, false);
    }
    showToast(`♻️ [${target?.name || '고객'}]님 데이터가 복원되었습니다!`);
    await syncCustomerToGas('update', { id, deletedAt: undefined });
  };

  const handlePermanentDeleteCustomer = async (id: string) => {
    const target = customers.find((c) => c.id === id);
    const updated = customers.filter((c) => c.id !== id);
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    if (target) {
      syncMarketingDbTrashFromCrmCustomer(target, true);
    }
    await syncCustomerToGas('delete', { id });
  };

  const handleEmptyTrash = () => {
    const trashedList = customers.filter((c) => Boolean(c.deletedAt));
    const updated = customers.filter((c) => !c.deletedAt);
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    for (const tc of trashedList) {
      syncMarketingDbTrashFromCrmCustomer(tc, true);
    }
    showToast('🗑️ 휴지통을 모두 비웠습니다.');
  };

  const handleAddNewCustomer = async (newCustomer: CustomerItem) => {
    pushUndoSnapshot(`${newCustomer.name} 신규 등록`);
    const nowMs = Date.now();
    const stampedNew: CustomerItem = {
      ...newCustomer,
      deletedAt: undefined,
      updatedAtMs: nowMs,
    };
    const targetIdentity = getCustomerIdentityKey(stampedNew);
    const cleanedExisting = customers.filter(
      (c) => !(c.deletedAt && getCustomerIdentityKey(c) === targetIdentity)
    );
    const updated = [stampedNew, ...cleanedExisting];
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    syncMarketingDbTrashFromCrmCustomer(stampedNew, false);
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
    if (viewMode === 'grid') {
      applyFilterSelection(stampedNew.status);
    }
    showToast(`✅ [${stampedNew.name}] 고객님이 등록되었습니다.`, true);
    await syncCustomerToGas('create', stampedNew);
  };

  const handleBatchSlipsSaved = useCallback(
    (summary: SlipBatchSavedSummary) => {
      const latest = getCachedCustomers();
      setCustomers(latest);
      if (searchQuery.trim()) {
        setSearchQuery('');
      }
      if (!slipUploadTargetCustomer && viewMode === 'grid') {
        setActiveTab('전체');
      }
      const overwriteNote =
        summary.overwrittenSlipCount > 0
          ? ` (기존 전표 ${summary.overwrittenSlipCount}건 덮어쓰기 반영)`
          : '';
      showToast(
        `✅ 총 ${summary.customerCount}명 고객 · ${summary.totalSlipCount}건 전표 및 견적서 등록 완료!${overwriteNote}`,
        false
      );
    },
    [searchQuery, slipUploadTargetCustomer, viewMode, showToast]
  );

  const handleImportCustomers = (imported: CustomerItem[]) => {
    const merged = setCachedCustomers([...imported, ...customers]);
    setCustomers(merged);
  };

  const handleMarkSmsSent = async (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    if (target && target.status === '신규/미발송') {
      await handleStatusChange(customerId, '상담진행중');
    }
  };

  const kpiStats = useMemo(() => {
    const briefing = getBriefingSummary(activeCustomers);
    const urgentCount = activeCustomers.filter((c) =>
      isUrgentCustomer(c)
    ).length;
    const todayTomorrowDeliveryCount =
      briefing.todayDelivery.length + briefing.tomorrowDelivery.length;
    const unconfirmedLogisticsCount = activeCustomers.filter((c) =>
      isPendingLogisticsCustomer(c)
    ).length;
    const unpaidGiftCount = activeCustomers.filter(
      (c) =>
        (c.status === '계약완료' || c.status === '배송완료') && hasUnpaidGift(c)
    ).length;

    const monthlyReport = computeMonthlySettlementReport(
      activeCustomers,
      selectedYearMonth,
      null,
      'contract'
    );

    const pipelineSalesTotal = activeCustomers
      .filter(
        (c) =>
          c.status === '신규/미발송' ||
          c.status === '상담진행중' ||
          c.status === '미구매/고민중'
      )
      .reduce(
        (acc, cur) =>
          acc + resolveCustomerPerformanceProfile(cur).performanceAmount,
        0
      );

    return {
      totalCount: activeCustomers.filter((c) => c.status !== '취소/보류').length,
      urgentCount,
      todayTomorrowDeliveryCount,
      unconfirmedLogisticsCount,
      unpaidGiftCount,
      grossSalesTotal: monthlyReport.grossSalesTotal,
      netDeliverySalesTotal: monthlyReport.netDeliverySalesTotal,
      pipelineSalesTotal,
    };
  }, [activeCustomers, selectedYearMonth]);

  const tabCounts = useMemo(() => {
    const consultingAll = activeCustomers.filter(
      (c) =>
        c.status === '신규/미발송' ||
        c.status === '상담진행중' ||
        c.status === '미구매/고민중'
    ).length;

    const shippingPending = activeCustomers.filter(
      (c) => c.status === '계약완료' || c.status === '발송완료'
    ).length;

    const deliveredDone = activeCustomers.filter(
      (c) => c.status === '배송완료'
    ).length;

    const cancelledCount = activeCustomers.filter(
      (c) => c.status === '취소/보류'
    ).length;

    const map: Record<CrmPrimaryTab, number> = {
      전체: activeCustomers.filter((c) => c.status !== '취소/보류').length,
      '🔥 할일·긴급': activeCustomers.filter((c) => isUrgentCustomer(c)).length,
      '💬 상담중': consultingAll,
      '🚚 배송': shippingPending,
      '✅ 배송완료': deliveredDone,
      '취소/보류': cancelledCount,
    };

    const subConsultCounts: Record<ConsultingSubFilter, number> = {
      all: consultingAll,
      '신규/미발송': activeCustomers.filter((c) => c.status === '신규/미발송')
        .length,
      상담진행중: activeCustomers.filter((c) => c.status === '상담진행중').length,
      '미구매/고민중': activeCustomers.filter((c) => c.status === '미구매/고민중')
        .length,
    };

    return { map, subConsultCounts };
  }, [activeCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesSearch = (c: CustomerItem) => {
      if (!q) return true;
      const inTop =
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q) ||
        c.items.toLowerCase().includes(q) ||
        c.memo.toLowerCase().includes(q) ||
        Boolean(c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
        Boolean(c.giftItems && c.giftItems.toLowerCase().includes(q));
      if (inTop) return true;
      return (c.quotes || []).some(
        (qt) =>
          Boolean(qt.orderNo && qt.orderNo.toLowerCase().includes(q)) ||
          Boolean(qt.itemSummary && qt.itemSummary.toLowerCase().includes(q)) ||
          Boolean(qt.title && qt.title.toLowerCase().includes(q))
      );
    };

    const filtered = activeCustomers.filter((c) => {
      // 검색어 입력 시에는 놓치는 고객이 없도록 전 단계 통합 검색
      if (q) {
        return matchesSearch(c);
      }

      if (viewMode === 'grid') {
        if (activeTab === '전체') {
          return c.status !== '취소/보류';
        }
        if (activeTab === '🔥 할일·긴급') {
          if (urgentSubFilter === 'gifts') {
            return (
              (c.status === '계약완료' || c.status === '배송완료') &&
              hasUnpaidGift(c)
            );
          }
          return isUrgentCustomer(c);
        }
        if (activeTab === '💬 상담중') {
          if (consultSubFilter !== 'all') {
            return c.status === consultSubFilter;
          }
          return (
            c.status === '신규/미발송' ||
            c.status === '상담진행중' ||
            c.status === '미구매/고민중'
          );
        }
        if (activeTab === '🚚 배송') {
          return c.status === '계약완료' || c.status === '발송완료';
        }
        if (activeTab === '✅ 배송완료') {
          return c.status === '배송완료';
        }
        if (activeTab === '취소/보류') {
          return c.status === '취소/보류';
        }
      } else if (viewMode === 'kanban') {
        if (c.status === '배송완료' && !hasUnpaidGift(c)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'urgentFirst') {
        const ua = isUrgentCustomer(a) ? 1 : 0;
        const ub = isUrgentCustomer(b) ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return b.regDate.localeCompare(a.regDate);
      }
      if (sortOrder === 'deliveryAsc') {
        const da = getDeliveryDDay(a.deliveryDate).diff;
        const db = getDeliveryDDay(b.deliveryDate).diff;
        const scoreA = da === null ? 9999 : da < 0 ? 5000 + Math.abs(da) : da;
        const scoreB = db === null ? 9999 : db < 0 ? 5000 + Math.abs(db) : db;
        return scoreA - scoreB;
      }
      if (sortOrder === 'amountDesc') {
        return (
          resolveCustomerPerformanceProfile(b).performanceAmount -
          resolveCustomerPerformanceProfile(a).performanceAmount
        );
      }
      return b.regDate.localeCompare(a.regDate);
    });
  }, [
    activeCustomers,
    activeTab,
    consultSubFilter,
    urgentSubFilter,
    searchQuery,
    sortOrder,
    viewMode,
  ]);

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
        {/* 1) 월간 총판·실판 분리 & 프리드/제품모델별 수당 정산 통합 허브 */}
        <CrmSalesAndIncentivePanel
          customers={activeCustomers}
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
            customers={activeCustomers}
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
        onAddSlipForCustomer={(cust) => {
          setSlipUploadTargetCustomer(cust);
          setIsSlipUploadOpen(true);
        }}
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
        trashedCustomers={trashedCustomers}
        onImportCustomers={handleImportCustomers}
        onRestoreCustomer={handleRestoreCustomer}
        onPermanentDeleteCustomer={handlePermanentDeleteCustomer}
        onEmptyTrash={handleEmptyTrash}
      />
    </div>
  );
};
