import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardPaste,
  Coins,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  Lock,
  MailOpen,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  addOrReviveManualLeadInStore,
  buildAllLeadTombstoneKeys,
  buildLeadAutoSummary,
  copyBusinessCardImageToClipboard,
  DEFAULT_INSTA_SHEET_URL,
  getCanonicalPhoneDigits,
  getEffectiveBusinessCardDataUri,
  getOwnerDbPin,
  getReadyMadeAppsScriptCode,
  HandoverStaffOption,
  hydrateMarketingDbStoreFromIdb,
  importLeadsFromFile,
  importLeadsFromRawText,
  loadHandoverStaffOptions,
  loadMarketingDbStore,
  lockOwnerMarketingDb,
  makeLeadFingerprint,
  MARKETING_DB_UPDATED_EVENT,
  MARKETING_LEAD_STATUSES,
  MarketingDbStore,
  MarketingLeadItem,
  MarketingLeadStatus,
  MarketingSmsTemplate,
  normalizeKoreanLeadPhone,
  normalizeLeadDateTime,
  pushMarketingStateToGasBackup,
  renderSmsTemplateForLead,
  saveMarketingDbStore,
  saveMarketingLeadToCrm,
  setOwnerDbPin,
  shareBusinessCardFileWithText,
  syncLeadsFromGoogleSheet,
  syncMarketingDbTrashFromCrmCustomer,
  warmUpBusinessCardCache,
} from '../utils/marketingDbEngine';
import { compressImageFile } from '../utils/aiImageParser';
import { DEFAULT_OWNER_BUSINESS_CARD_DATA_URI } from '../utils/ownerBusinessCardAsset';
import {
  buildPrimaryFieldsFromQuote,
  CRM_CUSTOMERS_UPDATED_EVENT,
  deleteQuoteAndSyncCustomer,
  getCachedCustomers,
  setCachedCustomers,
  syncCustomerToGas,
} from '../crm/services/gasApi';
import { CustomerDetailModal } from '../crm/components/CustomerDetailModal';
import { SMSModal } from '../crm/components/SMSModal';
import { MarketingDbTabsAndGrid } from './MarketingDbTabsAndGrid';
import { MarketingDbModals } from './MarketingDbModals';
import { CustomerItem, CustomerStatus, QuoteRecord } from '../crm/types/crm';
import { safeCopyText } from '../utils/mobileQaRuntime';

export const UNASSIGNED_HANDOVER_STAFF = '담당 미지정';

const MDB_LAST_STATUS_TAB_KEY = 'himart_mdb_last_tab_v1';
const MDB_LAST_HANDOVER_SUB_KEY = 'himart_mdb_last_handover_sub_v1';
const MDB_LAST_SELLER_SUB_KEY = 'himart_mdb_last_seller_sub_v1';
const VALID_MDB_TABS: readonly StatusFilterTab[] = ['신규', '문자전송', '상담진행중', '무응답', '타직원인계', '계약완료', '휴지통'];

export interface MarketingDbManagerViewProps {
  onBackToHome: () => void;
  backLabel?: string;
  onLockAndHideMenu: () => void;
  onOpenCustomerInCrm: (customerId?: string) => void;
  onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
  onOpenQuoteRecordInQuoteBuilder?: (
    customer: CustomerItem,
    quote: QuoteRecord
  ) => void;
  isDark?: boolean;
}

type StatusFilterTab = MarketingLeadStatus | '휴지통';

function getStatusBadgeStyle(status: MarketingLeadStatus, isDark: boolean): string {
  switch (status) {
    case '신규':
      return isDark
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-rose-50 text-rose-700 border-rose-300';
    case '문자전송':
      return isDark
        ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
        : 'bg-blue-50 text-blue-700 border-blue-300';
    case '상담진행중':
      return isDark
        ? 'bg-violet-500/20 text-violet-300 border-violet-400/40'
        : 'bg-violet-50 text-violet-800 border-violet-300';
    case '무응답':
      return isDark
        ? 'bg-slate-500/20 text-slate-300 border-slate-400/35'
        : 'bg-stone-100 text-stone-600 border-stone-300';
    case '타직원인계':
      return isDark
        ? 'bg-amber-500/20 text-amber-300 border-amber-400/45'
        : 'bg-amber-50 text-amber-800 border-amber-400';
    case '계약완료':
      return isDark
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50'
        : 'bg-emerald-50 text-emerald-800 border-emerald-400';
  }
}

function getStatusActiveBtnStyle(status: MarketingLeadStatus): string {
  switch (status) {
    case '신규':
      return 'bg-rose-600 text-white border-rose-600 shadow-2xs';
    case '문자전송':
      return 'bg-blue-600 text-white border-blue-600 shadow-2xs';
    case '상담진행중':
      return 'bg-violet-600 text-white border-violet-600 shadow-2xs';
    case '무응답':
      return 'bg-stone-600 text-white border-stone-600 shadow-2xs';
    case '타직원인계':
      return 'bg-amber-600 text-white border-amber-600 shadow-2xs';
    case '계약완료':
      return 'bg-emerald-600 text-white border-emerald-600 shadow-2xs';
  }
}

export const MarketingDbManagerView: React.FC<MarketingDbManagerViewProps> = ({
  onBackToHome,
  backLabel,
  onLockAndHideMenu,
  onOpenCustomerInQuoteBuilder,
  onOpenQuoteRecordInQuoteBuilder,
  isDark: propIsDark,
}) => {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof propIsDark === 'boolean'
      ? propIsDark
      : typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'dark'
      : false
  );

  useEffect(() => {
    if (typeof propIsDark === 'boolean') {
      setIsDark(propIsDark);
    }
  }, [propIsDark]);

  const [store, setStore] = useState<MarketingDbStore>(() =>
    loadMarketingDbStore()
  );
  const storeRef = useRef<MarketingDbStore>(store);
  const suppressSelfDbEventRef = useRef<boolean>(false);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  const [staffOptions, setStaffOptions] = useState<HandoverStaffOption[]>(() =>
    loadHandoverStaffOptions()
  );
  const [crmCustomers, setCrmCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );

  // 필터 상태 (직전 작업 중이던 탭 세션 복원 지원, 최초 기본값 '신규')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [statusTab, setStatusTab] = useState<StatusFilterTab>(() => {
    try {
      const saved = sessionStorage.getItem(MDB_LAST_STATUS_TAB_KEY) as StatusFilterTab | null;
      if (saved && VALID_MDB_TABS.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return '신규';
  });
  // 1) '타직원인계' 탭 전용 하단 직원 서브탭 ('ALL' | 직원명)
  const [handoverSubTab, setHandoverSubTab] = useState<string>(() => {
    try {
      return sessionStorage.getItem(MDB_LAST_HANDOVER_SUB_KEY) || 'ALL';
    } catch {
      return 'ALL';
    }
  });
  // 2) '계약완료' 탭 전용 하단 판매자 서브탭 ('ALL' | 'DIRECT' | 직원명)
  const [contractSellerTab, setContractSellerTab] = useState<string>(() => {
    try {
      return sessionStorage.getItem(MDB_LAST_SELLER_SUB_KEY) || 'ALL';
    } catch {
      return 'ALL';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(MDB_LAST_STATUS_TAB_KEY, statusTab);
      sessionStorage.setItem(MDB_LAST_HANDOVER_SUB_KEY, handoverSubTab);
      sessionStorage.setItem(MDB_LAST_SELLER_SUB_KEY, contractSellerTab);
    } catch {
      // ignore
    }
  }, [statusTab, handoverSubTab, contractSellerTab]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 다중 선택 일괄 처리 모드 (일괄 인계 / 일괄 계약완료 / 일괄 삭제)
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkHandoverTarget, setBulkHandoverTarget] = useState<string>(
    UNASSIGNED_HANDOVER_STAFF
  );

  // 모달 & 알림 토스트 상태
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'sms' | 'sheet' | 'security'>(
    'sms'
  );
  const [smsPreviewLead, setSmsPreviewLead] =
    useState<MarketingLeadItem | null>(null);
  const [smsPreviewText, setSmsPreviewText] = useState<string>('');
  const [smsPreviewTplId, setSmsPreviewTplId] = useState<string>('');
  const [smsPreviewIncludeCard, setSmsPreviewIncludeCard] =
    useState<boolean>(true);
  // 카드별 명함 동봉 선택 상태: '신규'는 기본 true(자동), 나머지 상태는 기본 false(선택사항)
  const [cardAttachOverrides, setCardAttachOverrides] = useState<
    Record<string, boolean>
  >({});
  const businessCardInputRef = useRef<HTMLInputElement>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // DB관리 화면 이탈 없이 바로 위에서 열리는 고객 요약/상세 카드 모달 상태
  const [inlineDetailCustomerId, setInlineDetailCustomerId] = useState<
    string | null
  >(null);
  const [inlineSmsCustomer, setInlineSmsCustomer] =
    useState<CustomerItem | null>(null);

  // 수동 추가 폼 상태
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPlatform, setNewLeadPlatform] = useState<'인스타그램' | '페이스북'>(
    '인스타그램'
  );
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadBenefit, setNewLeadBenefit] = useState(
    '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)'
  );
  const [newLeadContact] = useState('비대면 카톡/문자/전화로 견적 먼저 받기');
  const [newLeadMemo, setNewLeadMemo] = useState('');
  const [newLeadInitialStatus, setNewLeadInitialStatus] =
    useState<MarketingLeadStatus>('신규');
  const [newLeadRevenue, setNewLeadRevenue] = useState<string>('');
  const [newLeadIsHandover, setNewLeadIsHandover] = useState<boolean>(false);
  const [newLeadHandoverStaff, setNewLeadHandoverStaff] = useState<string>(
    UNASSIGNED_HANDOVER_STAFF
  );

  // 시트 복붙/설정 상태
  const [pasteRawText, setPasteRawText] = useState('');
  const [gasUrlInput, setGasUrlInput] = useState(
    () => store.config.gasWebAppUrl || ''
  );
  const [sheetUrlInput, setSheetUrlInput] = useState(
    () => store.config.sheetCsvOrShareUrl || DEFAULT_INSTA_SHEET_URL
  );
  const [newPinInput, setNewPinInput] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  // IndexedDB 복구 및 초기 자동 동기화 시도
  useEffect(() => {
    let mounted = true;
    hydrateMarketingDbStoreFromIdb().then((hydrated) => {
      if (!mounted) return;
      storeRef.current = hydrated;
      setStore(hydrated);
      setGasUrlInput(hydrated.config.gasWebAppUrl || '');
      setSheetUrlInput(
        hydrated.config.sheetCsvOrShareUrl || DEFAULT_INSTA_SHEET_URL
      );
      // 진입 즉시 백그라운드 자동 동기화 (네트워크 중 로컬 삭제/수정 덮어쓰기 0%)
      syncLeadsFromGoogleSheet(hydrated).then((res) => {
        if (!mounted) return;
        const latest = loadMarketingDbStore();
        storeRef.current = latest;
        setStore(latest);
        if (res.ok && res.addedCount > 0) {
          showToast(res.message);
        }
      });
    });
    setStaffOptions(loadHandoverStaffOptions());
    setCrmCustomers(getCachedCustomers());
    warmUpBusinessCardCache();
    return () => {
      mounted = false;
    };
  }, []);

  // 45초 주기 실시간 백그라운드 자동 감지
  useEffect(() => {
    const timer = setInterval(() => {
      syncLeadsFromGoogleSheet(loadMarketingDbStore()).then((res) => {
        setStore(loadMarketingDbStore());
        if (res.ok && res.addedCount > 0) {
          showToast(res.message);
        }
      });
    }, 45000);
    return () => clearInterval(timer);
  }, [store.config.gasWebAppUrl, store.config.sheetCsvOrShareUrl]);

  // 백그라운드 복귀(문자/카톡/전화 후 복귀) 및 CRM/DB 변동 시 즉시 최신화
  useEffect(() => {
    const refreshLatest = () => {
      setCrmCustomers(getCachedCustomers());
      setStaffOptions(loadHandoverStaffOptions());
      setStore(loadMarketingDbStore());
    };
    const onDbUpdated = () => {
      if (suppressSelfDbEventRef.current) return;
      const latest = loadMarketingDbStore();
      storeRef.current = latest;
      setStore(latest);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshLatest();
        syncLeadsFromGoogleSheet(loadMarketingDbStore()).then((res) => {
          setStore(loadMarketingDbStore());
          if (res.ok && res.addedCount > 0) {
            showToast(res.message);
          }
        });
      }
    };
    window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshLatest);
    window.addEventListener(MARKETING_DB_UPDATED_EVENT, onDbUpdated);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshLatest);
      window.removeEventListener(MARKETING_DB_UPDATED_EVENT, onDbUpdated);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // 모바일 물리 뒤로가기 지원 (인라인 고객카드 모달·문자 모달 먼저 닫고 DB관리 화면 유지)
  useEffect(() => {
    if (
      inlineSmsCustomer !== null ||
      inlineDetailCustomerId !== null ||
      isSettingsOpen ||
      smsPreviewLead !== null ||
      isAddModalOpen
    ) {
      try {
        window.history.pushState({ appGuard: true, tag: 'mdb-modal' }, '');
      } catch {
        // ignore
      }
    }
    (window as any).__subViewBackHandler = (): boolean => {
      if (inlineSmsCustomer !== null) {
        setInlineSmsCustomer(null);
        return true;
      }
      if (inlineDetailCustomerId !== null) {
        setInlineDetailCustomerId(null);
        return true;
      }
      if (smsPreviewLead !== null) {
        setSmsPreviewLead(null);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [
    inlineSmsCustomer,
    inlineDetailCustomerId,
    isSettingsOpen,
    smsPreviewLead,
    isAddModalOpen,
  ]);

  const commitStore = (updater: (prev: MarketingDbStore) => MarketingDbStore): MarketingDbStore => {
    const base = storeRef.current || loadMarketingDbStore();
    const draft = updater(base);
    suppressSelfDbEventRef.current = true;
    const saved = saveMarketingDbStore(draft);
    suppressSelfDbEventRef.current = false;
    storeRef.current = saved;
    setStore(saved);
    pushMarketingStateToGasBackup(saved).catch(() => {});
    return saved;
  };

  // CRM 매칭 맵 (내가 직접 관리하는 고객카드와 연결되었는지 실시간 판별)
  const crmLookupByIdAndPhone = useMemo(() => {
    const byId = new Map<string, CustomerItem>();
    const byPhone = new Map<string, CustomerItem>();
    for (const c of crmCustomers) {
      if (c.deletedAt) continue;
      byId.set(c.id, c);
      const digits = (c.phone || '').replace(/\D/g, '');
      if (digits) byPhone.set(digits, c);
    }
    return { byId, byPhone };
  }, [crmCustomers]);

  const findLinkedCrmCustomer = (
    lead: MarketingLeadItem
  ): CustomerItem | undefined => {
    if (lead.linkedCrmCustomerId) {
      const byId = crmLookupByIdAndPhone.byId.get(lead.linkedCrmCustomerId);
      if (byId) return byId;
    }
    const digits = (lead.phone || '').replace(/\D/g, '');
    if (digits) {
      return crmLookupByIdAndPhone.byPhone.get(digits);
    }
    return undefined;
  };

  // 활성 리드 vs 휴지통 리드
  const activeLeads = useMemo(
    () => store.leads.filter((l) => !l.deletedAt),
    [store.leads]
  );
  const trashedLeads = useMemo(
    () => store.leads.filter((l) => Boolean(l.deletedAt)),
    [store.leads]
  );

  // 선택 가능한 월 목록 (현재 월 + 데이터가 존재하는 모든 월 내림차순)
  const availableMonths = useMemo(() => {
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    const set = new Set<string>([curYm]);
    for (const l of activeLeads) {
      if (l.yearMonth) set.add(l.yearMonth);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [activeLeads]);

  // 월별 필터링된 전체 활성 리드 목록
  const monthFilteredLeads = useMemo(() => {
    if (selectedMonth === 'ALL') return activeLeads;
    return activeLeads.filter((l) => l.yearMonth === selectedMonth);
  }, [activeLeads, selectedMonth]);

  // 상단 회사 보고용 DB 매출 합계 & 상태별 통계 (직접 판매 + 타직원 판매 통합 보고 + 상세 내역 분리)
  const stats = useMemo(() => {
    const allTimeContracts = activeLeads.filter((l) => l.status === '계약완료');
    const allTimeTotalRevenue = allTimeContracts.reduce(
      (sum, l) => sum + (Number(l.revenueAmount) || 0),
      0
    );
    const allTimeDirectRevenue = allTimeContracts
      .filter((l) => !l.handoverStaff)
      .reduce((sum, l) => sum + (Number(l.revenueAmount) || 0), 0);
    const allTimeStaffRevenue = allTimeContracts
      .filter((l) => Boolean(l.handoverStaff))
      .reduce((sum, l) => sum + (Number(l.revenueAmount) || 0), 0);

    const statusCounts: Record<MarketingLeadStatus, number> = {
      신규: 0,
      문자전송: 0,
      상담진행중: 0,
      무응답: 0,
      타직원인계: 0,
      계약완료: 0,
    };

    let periodRevenue = 0;
    let directPeriodRevenue = 0;
    let staffPeriodRevenue = 0;
    let directContractCount = 0;
    let staffContractCount = 0;

    for (const l of monthFilteredLeads) {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      if (l.status === '계약완료') {
        const rev = Number(l.revenueAmount) || 0;
        periodRevenue += rev;
        if (l.handoverStaff) {
          staffPeriodRevenue += rev;
          staffContractCount += 1;
        } else {
          directPeriodRevenue += rev;
          directContractCount += 1;
        }
      }
    }

    const totalPeriod = monthFilteredLeads.length;
    const conversionRate =
      totalPeriod > 0
        ? ((statusCounts['계약완료'] / totalPeriod) * 100).toFixed(1)
        : '0.0';

    return {
      totalPeriod,
      statusCounts,
      periodRevenue,
      directPeriodRevenue,
      staffPeriodRevenue,
      directContractCount,
      staffContractCount,
      allTimeTotalRevenue,
      allTimeDirectRevenue,
      allTimeStaffRevenue,
      conversionRate,
    };
  }, [activeLeads, monthFilteredLeads]);

  // [타직원인계 탭 전용] 인계 직원별 하단 서브탭 집계
  const handoverStaffTabs = useMemo(() => {
    const inHandover = monthFilteredLeads.filter(
      (l) => l.status === '타직원인계'
    );
    const map = new Map<string, number>();
    for (const l of inHandover) {
      const staffKey = l.handoverStaff || UNASSIGNED_HANDOVER_STAFF;
      map.set(staffKey, (map.get(staffKey) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [monthFilteredLeads]);

  // [계약완료 탭 전용] 직접 판매 vs 타 직원 이름별 판매 건수 & 누적 판매 금액 집계!
  const contractSellerBreakdown = useMemo(() => {
    const allTimeContracts = activeLeads.filter((l) => l.status === '계약완료');
    const periodContracts = monthFilteredLeads.filter(
      (l) => l.status === '계약완료'
    );

    const directAll = allTimeContracts.filter((l) => !l.handoverStaff);
    const directPeriod = periodContracts.filter((l) => !l.handoverStaff);

    // 계약완료에 한 번이라도 등장한 타 직원 목록 (전체 누적 기준 + 현재 기간 기준 통합)
    const staffNamesSet = new Set<string>();
    for (const l of allTimeContracts) {
      if (l.handoverStaff) staffNamesSet.add(l.handoverStaff);
    }

    const staffSellers = Array.from(staffNamesSet).map((staffName) => {
      const pList = periodContracts.filter((l) => l.handoverStaff === staffName);
      const aList = allTimeContracts.filter((l) => l.handoverStaff === staffName);
      return {
        staffName,
        periodCount: pList.length,
        periodRevenue: pList.reduce(
          (s, l) => s + (Number(l.revenueAmount) || 0),
          0
        ),
        allTimeCount: aList.length,
        allTimeRevenue: aList.reduce(
          (s, l) => s + (Number(l.revenueAmount) || 0),
          0
        ),
      };
    });

    staffSellers.sort((a, b) => b.allTimeRevenue - a.allTimeRevenue || b.allTimeCount - a.allTimeCount);

    return {
      totalPeriodCount: periodContracts.length,
      totalAllTimeCount: allTimeContracts.length,
      hasAnyStaffContract: staffSellers.length > 0,
      direct: {
        periodCount: directPeriod.length,
        periodRevenue: directPeriod.reduce(
          (s, l) => s + (Number(l.revenueAmount) || 0),
          0
        ),
        allTimeCount: directAll.length,
        allTimeRevenue: directAll.reduce(
          (s, l) => s + (Number(l.revenueAmount) || 0),
          0
        ),
      },
      staffSellers,
    };
  }, [activeLeads, monthFilteredLeads]);

  // 선택된 서브탭이 데이터 변동으로 사라졌을 때 안전하게 'ALL'로 복귀
  useEffect(() => {
    if (
      handoverSubTab !== 'ALL' &&
      !handoverStaffTabs.some((t) => t.name === handoverSubTab)
    ) {
      setHandoverSubTab('ALL');
    }
  }, [handoverSubTab, handoverStaffTabs]);

  useEffect(() => {
    if (
      contractSellerTab !== 'ALL' &&
      contractSellerTab !== 'DIRECT' &&
      !contractSellerBreakdown.staffSellers.some(
        (s) => s.staffName === contractSellerTab
      )
    ) {
      setContractSellerTab('ALL');
    }
  }, [contractSellerTab, contractSellerBreakdown.staffSellers]);

  // 최종 화면 표시 리드 목록
  // (검색어 입력 중일 때는 전체 보기 탭이 없더라도 놓치는 고객이 없도록 전 단계 통합 검색 지원!)
  const isSearchingAll = Boolean(searchQuery.trim()) && statusTab !== '휴지통';

  const visibleLeads = useMemo(() => {
    const base =
      statusTab === '휴지통'
        ? trashedLeads
        : isSearchingAll
        ? monthFilteredLeads
        : monthFilteredLeads.filter((l) => l.status === statusTab);

    return base.filter((l) => {
      if (!isSearchingAll && statusTab === '타직원인계' && handoverSubTab !== 'ALL') {
        const staffKey = l.handoverStaff || UNASSIGNED_HANDOVER_STAFF;
        if (staffKey !== handoverSubTab) return false;
      }

      if (!isSearchingAll && statusTab === '계약완료') {
        if (contractSellerTab === 'DIRECT' && l.handoverStaff) return false;
        if (
          contractSellerTab !== 'ALL' &&
          contractSellerTab !== 'DIRECT' &&
          l.handoverStaff !== contractSellerTab
        ) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          l.customerName,
          l.phone,
          l.phone.replace(/\D/g, ''),
          l.autoSummary,
          l.interestBenefit,
          l.memo,
          l.handoverStaff,
          l.status,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    statusTab,
    trashedLeads,
    isSearchingAll,
    monthFilteredLeads,
    handoverSubTab,
    contractSellerTab,
    searchQuery,
  ]);

  // ==================== 핵심 액션 핸들러 ====================

  const handleManualSheetSync = async () => {
    setIsSyncing(true);
    const res = await syncLeadsFromGoogleSheet(store);
    setStore(res.nextStore);
    setIsSyncing(false);
    showToast(res.message);
    if (!res.ok && navigator.onLine !== false) {
      setSettingsTab('sheet');
      setIsSettingsOpen(true);
    }
  };

  const handleChangeStatus = async (
    lead: MarketingLeadItem,
    nextStatus: MarketingLeadStatus
  ) => {
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // '타직원인계'로 바꿀 때 아직 인계 직원 이름이 비어 있으면 기본값 세팅
    // 반대로 '타직원인계'에서 '신규/문자전송/상담진행중/무응답'으로 되돌리면 내 직접 상담으로 복귀(handoverStaff 해제)
    // 단, '계약완료'로 바꿀 때는 기존 handoverStaff(직접 판매 '' vs 타직원 이름)를 그대로 보존하여 계약완료 탭으로 이동!
    const nextHandoverStaff =
      nextStatus === '타직원인계'
        ? lead.handoverStaff || UNASSIGNED_HANDOVER_STAFF
        : nextStatus === '계약완료'
        ? lead.handoverStaff
        : '';

    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              status: nextStatus,
              handoverStaff: nextHandoverStaff,
              handoverAt: nextHandoverStaff
                ? item.handoverAt || nowStamp
                : undefined,
            }
          : item
      ),
    }));

    // 내가 직접 상담·판매하는 건(!nextHandoverStaff)만 내 개인 고객관리(CRM -> 내 총판/실판)에 자동 동기화!
    if (
      !nextHandoverStaff &&
      store.config.autoSaveCrmOnConvert &&
      (nextStatus === '상담진행중' || nextStatus === '계약완료')
    ) {
      const updatedLead: MarketingLeadItem = {
        ...lead,
        status: nextStatus,
        handoverStaff: '',
      };
      const { savedCustomer } = await saveMarketingLeadToCrm(updatedLead);
      setCrmCustomers(getCachedCustomers());
      commitStore((prev) => ({
        ...prev,
        leads: prev.leads.map((item) =>
          item.id === lead.id
            ? { ...item, linkedCrmCustomerId: savedCustomer.id }
            : item
        ),
      }));
      showToast(
        `${lead.customerName} 고객님 [${nextStatus}] 반영 및 내 고객관리(총판·실판) 자동 연동 완료!`
      );
    } else if (nextStatus === '계약완료' && nextHandoverStaff) {
      showToast(
        `🎉 [${nextHandoverStaff}] 인계 판매 건이 [계약완료] 탭으로 이동했습니다! 발생매출을 입력해 주세요.`
      );
    } else if (nextStatus === '타직원인계') {
      // 타직원 인계로 전환 시, 이전에 자동 생성된 0원 임시 CRM 카드가 있다면 내 개인 고객관리에서 자동 정리
      const lDigits = getCanonicalPhoneDigits(lead.phone);
      const latestCrm = getCachedCustomers();
      const autoPlaceholder = latestCrm.find(
        (c) =>
          !c.deletedAt &&
          (c.id === lead.linkedCrmCustomerId ||
            (lDigits.length >= 7 && getCanonicalPhoneDigits(c.phone) === lDigits)) &&
          (!c.quotes || c.quotes.length === 0) &&
          (Number(c.paidAmount) || 0) === 0 &&
          (Number(c.netAmount) || 0) === 0
      );
      if (autoPlaceholder) {
        const nowMs = Date.now();
        const cleanedCrm = setCachedCustomers(
          latestCrm.map((c) =>
            c.id === autoPlaceholder.id
              ? { ...c, deletedAt: nowMs, updatedAtMs: nowMs }
              : c
          )
        );
        setCrmCustomers(cleanedCrm);
      }
      showToast(
        `↪ ${lead.customerName} 고객님이 [타직원인계] 탭으로 이동했습니다. 인계 직원을 지정해 주세요.`
      );
    }
  };

  // 카드에서 인계 직원을 선택/변경했을 때의 동작
  const handleChangeHandoverStaff = (lead: MarketingLeadItem, staffName: string) => {
    const found = staffOptions.find((s) => s.name === staffName);
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) => {
        if (item.id !== lead.id) return item;
        // 계약완료 상태에서는 판매자(직접 판매 '' vs 타직원 이름)만 전환하고 계약완료 탭 유지
        // 계약완료가 아닌 상태에서 직원을 선택하면 즉시 '타직원인계' 상태로 전환되어 타직원인계 탭으로 이동!
        const nextStatus: MarketingLeadStatus =
          item.status === '계약완료'
            ? '계약완료'
            : staffName
            ? '타직원인계'
            : item.status === '타직원인계'
            ? '상담진행중'
            : item.status;

        return {
          ...item,
          status: nextStatus,
          handoverStaff: staffName,
          handoverStaffRole: found?.role || undefined,
          handoverAt: staffName ? item.handoverAt || nowStamp : undefined,
        };
      }),
    }));

    if (staffName) {
      if (lead.status === '계약완료') {
        showToast(
          `판매 담당자가 [${staffName}]으로 설정되었습니다 (DB 총매출 합산 · 내 개인 CRM 제외).`
        );
      } else {
        showToast(
          `↪ ${lead.customerName} 고객님이 [${staffName}] 인계건으로 [타직원인계] 탭에 배치되었습니다.`
        );
      }
    } else {
      showToast(
        `👑 ${lead.customerName} 고객님이 [직접 상담/판매]로 전환되었습니다.`
      );
    }
  };

  // 다중 선택: 일괄 타직원 인계 이동
  const handleBulkHandoverLeads = (ids: string[], targetStaffName: string) => {
    if (ids.length === 0 || !targetStaffName) return;
    const idSet = new Set(ids);
    const found = staffOptions.find((s) => s.name === targetStaffName);
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        idSet.has(item.id)
          ? {
              ...item,
              status: item.status === '계약완료' ? '계약완료' : '타직원인계',
              handoverStaff: targetStaffName,
              handoverStaffRole: found?.role || undefined,
              handoverAt: item.handoverAt || nowStamp,
            }
          : item
      ),
    }));
    setSelectedIds([]);
    setIsSelectMode(false);
    showToast(
      `↪ 선택한 ${ids.length}명이 [${targetStaffName}] 인계건으로 변경되었습니다.`
    );
  };

  // 다중 선택: 타직원인계 등에서 선택 고객 일괄 [계약완료] 전환!
  const handleBulkMarkContractCompleted = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        idSet.has(item.id)
          ? {
              ...item,
              status: '계약완료',
            }
          : item
      ),
    }));
    setSelectedIds([]);
    setIsSelectMode(false);
    setStatusTab('계약완료');
    showToast(
      `🎉 선택한 ${ids.length}건이 [계약완료] 탭으로 일괄 이동되었습니다! 각 카드의 발생매출을 입력해 주세요.`
    );
  };

  const handleCopyStaffHandoverSummary = async (lead: MarketingLeadItem) => {
    const summaryText = [
      `[인스타·페북 광고 DB 상담 인계]`,
      `• 인계 담당: ${lead.handoverStaff || UNASSIGNED_HANDOVER_STAFF}`,
      `• 고객명: ${lead.customerName} 고객님`,
      `• 연락처: ${lead.phone || '미입력'}`,
      `• 유입/접수: ${lead.platform || '인스타그램'} (${lead.createdAt})`,
      `• 희망혜택: ${lead.interestBenefit || lead.autoSummary}`,
      lead.preferredContact ? `• 희망방식: ${lead.preferredContact}` : '',
      lead.memo ? `• 전달메모: ${lead.memo}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (await safeCopyText(summaryText)) {
      showToast(
        `📋 [${lead.customerName}님] 직원 전달용 요약이 복사되었습니다! 카톡·문자에 붙여넣으세요.`
      );
    }
  };

  const handleChangeRevenue = (lead: MarketingLeadItem, nextAmount: number) => {
    const cleanAmt = Math.max(0, Math.round(Number(nextAmount) || 0));
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id ? { ...item, revenueAmount: cleanAmt } : item
      ),
    }));
  };

  const handleSyncRevenueToCrm = async (lead: MarketingLeadItem) => {
    if (lead.handoverStaff) {
      showToast(
        '타 직원 판매 건은 회사 보고용 DB 총매출에만 합산되며 내 개인 고객관리에는 반영되지 않습니다.'
      );
      return;
    }
    const { savedCustomer } = await saveMarketingLeadToCrm(lead, {
      syncRevenue: true,
    });
    setCrmCustomers(getCachedCustomers());
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id
          ? { ...item, linkedCrmCustomerId: savedCustomer.id }
          : item
      ),
    }));
    showToast(
      `${lead.customerName} 고객님 발생매출(${lead.revenueAmount.toLocaleString()}원)이 내 고객관리 카드에도 반영되었습니다!`
    );
  };

  const handleUpdateMemo = (leadId: string, memo: string) => {
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === leadId ? { ...item, memo } : item
      ),
    }));
  };

  // 신규 고객은 명함 동봉이 기본 ON(자동), 나머지 상태 고객은 기본 OFF(선택 시 ON)
  const isCardAttachedForLead = (lead: MarketingLeadItem): boolean => {
    if (lead.id in cardAttachOverrides) {
      return cardAttachOverrides[lead.id];
    }
    return lead.status === '신규';
  };

  const toggleCardAttachForLead = (lead: MarketingLeadItem) => {
    const cur = isCardAttachedForLead(lead);
    setCardAttachOverrides((prev) => ({
      ...prev,
      [lead.id]: !cur,
    }));
  };

  const getDefaultRenderedTextForLead = (lead: MarketingLeadItem): string => {
    const defaultTpl =
      store.config.smsTemplates.find(
        (t) => t.id === store.config.activeTemplateId
      ) || store.config.smsTemplates[0];
    const sangjoTpl = store.config.smsTemplates.find((t) =>
      t.id.includes('sangjo')
    );
    const chosenTpl =
      lead.interestBenefit.includes('상조') &&
      store.config.activeTemplateId === 'tpl-default-1' &&
      sangjoTpl
        ? sangjoTpl
        : defaultTpl;
    return renderSmsTemplateForLead(chosenTpl.body, lead);
  };

  const markLeadSmsSent = (lead: MarketingLeadItem) => {
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              status: item.status === '신규' ? '문자전송' : item.status,
              smsSentAt: nowStamp,
            }
          : item
      ),
    }));
  };

  // 방식 A: 자동 문구 포함 문자앱 열기 (명함 동봉 ON이면 클립보드에 명함 이미지 자동 복사)
  useEffect(() => {
    warmUpBusinessCardCache(getEffectiveBusinessCardDataUri(store.config));
  }, [store.config.businessCardDataUri]);

  const triggerNativeSmsSend = async (
    lead: MarketingLeadItem,
    bodyText: string,
    includeBusinessCard: boolean
  ) => {
    let copiedCardImg = false;
    if (includeBusinessCard) {
      const cardUri = getEffectiveBusinessCardDataUri(store.config);
      copiedCardImg = await copyBusinessCardImageToClipboard(cardUri);
      if (copiedCardImg) {
        showToast(
          '🪪 명함 이미지가 키보드 클립보드에 복사되었습니다! 문자 입력칸에서 붙여넣기 해주세요.'
        );
      } else {
        await safeCopyText(bodyText);
      }
    } else {
      await safeCopyText(bodyText);
    }

    markLeadSmsSent(lead);

    // 갤럭시·안드로이드 클립보드 데몬에 PNG 비트맵이 완전히 커밋되도록 짧은 여유 후 문자앱 전환
    if (copiedCardImg) {
      await new Promise((r) => setTimeout(r, 320));
    }

    const cleanPhone = (lead.phone || '').replace(/[^0-9+]/g, '');
    const encoded = encodeURIComponent(bodyText);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const sep = isIOS ? '&' : '?';
    window.location.href = cleanPhone
      ? `sms:${cleanPhone}${sep}body=${encoded}`
      : `sms:${sep}body=${encoded}`;
  };

  // 방식 B: OS 공유창(MMS/카톡)으로 명함 파일 + 문자 본문을 한 번에 전달
  const triggerDirectFileShareWithCard = async (
    lead: MarketingLeadItem,
    bodyText: string
  ) => {
    const cardUri = getEffectiveBusinessCardDataUri(store.config);
    const res = await shareBusinessCardFileWithText({
      dataUri: cardUri,
      bodyText,
      customerPhone: lead.phone,
    });
    if (res === 'shared') {
      markLeadSmsSent(lead);
      showToast(
        `🪪 명함 파일+문구 공유 완료! (전화번호 ${lead.phone} 자동 복사됨)`
      );
    } else if (res === 'unsupported') {
      await triggerNativeSmsSend(lead, bodyText, true);
    }
  };

  const handleQuickSendDefaultSms = async (lead: MarketingLeadItem) => {
    const rendered = getDefaultRenderedTextForLead(lead);
    const withCard = isCardAttachedForLead(lead);
    const method = store.config.businessCardSendMethod || 'share-sheet';
    if (withCard && method === 'share-sheet') {
      await triggerDirectFileShareWithCard(lead, rendered);
    } else {
      await triggerNativeSmsSend(lead, rendered, withCard);
    }
  };

  const handleOpenSmsPreview = (lead: MarketingLeadItem) => {
    const defaultTpl =
      store.config.smsTemplates.find(
        (t) => t.id === store.config.activeTemplateId
      ) || store.config.smsTemplates[0];
    const sangjoTpl = store.config.smsTemplates.find((t) =>
      t.id.includes('sangjo')
    );
    const chosenTpl =
      lead.interestBenefit.includes('상조') &&
      store.config.activeTemplateId === 'tpl-default-1' &&
      sangjoTpl
        ? sangjoTpl
        : defaultTpl;

    setSmsPreviewLead(lead);
    setSmsPreviewTplId(chosenTpl.id);
    setSmsPreviewText(renderSmsTemplateForLead(chosenTpl.body, lead));
    setSmsPreviewIncludeCard(isCardAttachedForLead(lead));
  };

  const handleBusinessCardImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressed = await compressImageFile(file, 960, 0.86);
      if (compressed.dataUrl.startsWith('data:image/')) {
        commitStore((prev) => ({
          ...prev,
          config: {
            ...prev.config,
            businessCardDataUri: compressed.dataUrl,
          },
        }));
        showToast('새 명함 이미지가 경량화되어 안전하게 저장되었습니다!');
      }
    } catch {
      showToast('⚠️ 명함 이미지를 읽는 중 오류가 발생했습니다.');
    }
  };

  // 원터치 내 고객관리(CRM) 카드 저장 / 인라인 열기
  const handleSaveOrOpenCrm = async (
    lead: MarketingLeadItem,
    mode: 'save-only' | 'open-crm' | 'open-quote'
  ) => {
    const existing = findLinkedCrmCustomer(lead);
    if (existing && mode === 'open-crm') {
      setCrmCustomers(getCachedCustomers());
      setInlineDetailCustomerId(existing.id);
      return;
    }
    if (existing && mode === 'open-quote') {
      onOpenCustomerInQuoteBuilder(existing);
      return;
    }

    const { savedCustomer, isExistingCustomer } =
      await saveMarketingLeadToCrm(lead, { allowRestoreFromTrash: true });
    setCrmCustomers(getCachedCustomers());
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id
          ? { ...item, linkedCrmCustomerId: savedCustomer.id }
          : item
      ),
    }));

    if (mode === 'open-crm') {
      setInlineDetailCustomerId(savedCustomer.id);
    } else if (mode === 'open-quote') {
      onOpenCustomerInQuoteBuilder(savedCustomer);
    } else {
      showToast(
        isExistingCustomer
          ? `${lead.customerName} 고객님 기존 고객카드(최종혜택가 보존)와 연동되었습니다!`
          : `${lead.customerName} 고객님이 내 VIP 고객관리에 저장되었습니다!`
      );
    }
  };

  // DB관리 내 인라인 고객 요약/상세 카드 모달 실시간 수정 핸들러
  const inlineSelectedCustomer = useMemo(
    () =>
      inlineDetailCustomerId
        ? crmCustomers.find(
            (c) => c.id === inlineDetailCustomerId && !c.deletedAt
          ) || null
        : null,
    [crmCustomers, inlineDetailCustomerId]
  );

  const handleInlineCrmStatusChange = async (
    id: string,
    nextStatus: CustomerStatus
  ) => {
    const nowMs = Date.now();
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, status: nextStatus, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast(`고객카드 상태가 [${nextStatus}]로 변경되었습니다.`);
    await syncCustomerToGas('update', { id, status: nextStatus });
  };

  const handleInlineCrmMemoChange = async (id: string, nextMemo: string) => {
    const nowMs = Date.now();
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, memo: nextMemo, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast('고객카드 메모가 저장되었습니다.');
    await syncCustomerToGas('update', { id, memo: nextMemo });
  };

  const handleInlineCrmFieldChange = async (
    id: string,
    patch: Partial<CustomerItem>
  ) => {
    const nowMs = Date.now();
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAtMs: nowMs } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast('고객카드 정보가 업데이트되었습니다.');
    await syncCustomerToGas('update', { id, ...patch });
  };

  const handleInlineDeleteQuoteRecord = async (
    customerId: string,
    quoteId: string
  ) => {
    const updated = crmCustomers.map((c) =>
      c.id === customerId ? deleteQuoteAndSyncCustomer(c, quoteId) : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast('견적이 삭제되었으며 남은 대표 견적 금액으로 자동 복원되었습니다.');
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
      });
    }
  };

  const handleInlineApplyQuoteAsPrimary = async (
    customerId: string,
    quote: QuoteRecord
  ) => {
    const patch = buildPrimaryFieldsFromQuote(quote);
    const updated = crmCustomers.map((c) =>
      c.id === customerId ? { ...c, ...patch } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast(`[${quote.title}] 견적이 대표 견적으로 적용되었습니다.`);
    await syncCustomerToGas('update', { id: customerId, ...patch });
  };

  const handleInlineDeleteCustomer = async (id: string) => {
    const deletedAt = Date.now();
    const target = crmCustomers.find((c) => c.id === id);
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, deletedAt, updatedAtMs: deletedAt } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    if (target) {
      syncMarketingDbTrashFromCrmCustomer(target, true);
      setStore(loadMarketingDbStore());
    }
    setInlineDetailCustomerId(null);
    showToast('고객카드가 휴지통으로 이동되었습니다 (인스타 DB도 함께 동기화 완료).');
    await syncCustomerToGas('update', { id, deletedAt });
  };

  // 개별 / 선택 고객 삭제 (전화번호·지문 전방위 부활 차단 + 연동된 내 고객관리 카드도 함께 휴지통 이동!)
  const handleSoftDeleteLeads = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const nowMs = Date.now();
    const deletedPhoneDigits = new Set<string>();
    const deletedLinkedCrmIds = new Set<string>();

    commitStore((prev) => {
      const extraFingerprints: string[] = [];
      const nextLeads = prev.leads.map((l) => {
        if (!idSet.has(l.id)) return l;
        extraFingerprints.push(...buildAllLeadTombstoneKeys(l));
        const d = getCanonicalPhoneDigits(l.phone);
        if (d.length >= 7) deletedPhoneDigits.add(d);
        if (l.linkedCrmCustomerId) deletedLinkedCrmIds.add(l.linkedCrmCustomerId);
        return { ...l, deletedAt: nowMs };
      });
      return {
        ...prev,
        leads: nextLeads,
        deletedFingerprints: Array.from(
          new Set([...(prev.deletedFingerprints || []), ...extraFingerprints])
        ),
      };
    });

    // 연동되어 있던 내 고객관리(CRM) 카드가 있으면 함께 휴지통으로 보내서 다른 메뉴/홈 브리핑에 뜨지 않도록 동기화!
    const currentCrm = getCachedCustomers();
    let crmChanged = false;
    const updatedCrm = currentCrm.map((c) => {
      if (c.deletedAt) return c;
      const cDigits = getCanonicalPhoneDigits(c.phone);
      const isMatched =
        deletedLinkedCrmIds.has(c.id) ||
        (cDigits.length >= 7 && deletedPhoneDigits.has(cDigits));
      if (!isMatched) return c;
      crmChanged = true;
      return { ...c, deletedAt: nowMs, updatedAtMs: nowMs };
    });
    if (crmChanged) {
      const dedupedCrm = setCachedCustomers(updatedCrm);
      setCrmCustomers(dedupedCrm);
    }

    setSelectedIds([]);
    setIsSelectMode(false);
    showToast(
      `🗑️ ${ids.length}명이 휴지통으로 이동되었습니다. (구글시트 동기화 및 다른 메뉴에서도 더 이상 뜨지 않습니다)`
    );
  };

  const handleRestoreLead = (lead: MarketingLeadItem) => {
    const keysToRemove = new Set(buildAllLeadTombstoneKeys(lead));
    const leadDigits = getCanonicalPhoneDigits(lead.phone);

    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === lead.id ? { ...l, deletedAt: undefined } : l
      ),
      deletedFingerprints: (prev.deletedFingerprints || []).filter((fp) => {
        if (keysToRemove.has(fp)) return false;
        if (leadDigits.length >= 7 && fp.startsWith(`ph_${leadDigits}`)) return false;
        return true;
      }),
    }));

    // CRM 휴지통에 함께 들어가 있던 카드가 있으면 같이 복원
    const currentCrm = getCachedCustomers();
    let crmRestored = false;
    const nowMs = Date.now();
    const updatedCrm = currentCrm.map((c) => {
      if (!c.deletedAt) return c;
      const cDigits = getCanonicalPhoneDigits(c.phone);
      const isMatched =
        (lead.linkedCrmCustomerId && c.id === lead.linkedCrmCustomerId) ||
        (leadDigits.length >= 7 && cDigits === leadDigits);
      if (!isMatched) return c;
      crmRestored = true;
      return { ...c, deletedAt: undefined, updatedAtMs: nowMs };
    });
    if (crmRestored) {
      const dedupedCrm = setCachedCustomers(updatedCrm);
      setCrmCustomers(dedupedCrm);
    }

    showToast(`♻️ ${lead.customerName} 고객님 DB가 복원되었습니다.`);
  };

  const handlePermanentPurgeLead = (leadId: string) => {
    commitStore((prev) => {
      const target = prev.leads.find((l) => l.id === leadId);
      const extraKeys = target ? buildAllLeadTombstoneKeys(target) : [];
      return {
        ...prev,
        leads: prev.leads.filter((l) => l.id !== leadId),
        deletedFingerprints: Array.from(
          new Set([...(prev.deletedFingerprints || []), ...extraKeys])
        ),
      };
    });
    showToast('영구 삭제되었습니다 (구글시트 재유입 영구 차단은 계속 유지됩니다).');
  };

  const handleEmptyDbTrash = () => {
    commitStore((prev) => {
      const trashed = prev.leads.filter((l) => Boolean(l.deletedAt));
      const extraKeys = trashed.flatMap((l) => buildAllLeadTombstoneKeys(l));
      return {
        ...prev,
        leads: prev.leads.filter((l) => !l.deletedAt),
        deletedFingerprints: Array.from(
          new Set([...(prev.deletedFingerprints || []), ...extraKeys])
        ),
      };
    });
    showToast('🗑️ 휴지통을 모두 비웠습니다 (삭제 고객 재유입 차단은 계속 유지됩니다).');
  };

  // 수동 DB 고객 등록 (과거 삭제번호 재등록 부활 · 필터 자동해제 · CRM 자동연동 지원)
  const handleAddManualLead = async () => {
    if (!newLeadName.trim() && !newLeadPhone.trim() && !newLeadMemo.trim()) {
      showToast('⚠️ 고객명 또는 연락처 중 하나는 입력해 주세요!');
      return;
    }
    const phone = normalizeKoreanLeadPhone(newLeadPhone);
    const { createdAt, yearMonth } = normalizeLeadDateTime();
    const name = newLeadName.trim() || '직접등록 고객';
    const fp = makeLeadFingerprint(name, phone, createdAt, `manual_${Date.now()}`);
    const resolvedStatus: MarketingLeadStatus = newLeadIsHandover
      ? newLeadInitialStatus === '계약완료'
        ? '계약완료'
        : '타직원인계'
      : newLeadInitialStatus === '타직원인계'
      ? '신규'
      : newLeadInitialStatus;
    const assignedStaff = newLeadIsHandover
      ? newLeadHandoverStaff || UNASSIGNED_HANDOVER_STAFF
      : '';
    const foundRole = staffOptions.find((st) => st.name === assignedStaff)?.role;
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const revNum =
      resolvedStatus === '계약완료'
        ? Math.max(0, Math.round(Number(newLeadRevenue.replace(/\D/g, '')) || 0))
        : 0;

    const newItem: MarketingLeadItem = {
      id: `MDB-${Date.now()}`,
      fingerprint: fp,
      createdAt,
      yearMonth,
      customerName: name,
      phone,
      interestBenefit: newLeadBenefit.trim(),
      preferredContact: newLeadContact.trim(),
      platform: newLeadPlatform,
      autoSummary: buildLeadAutoSummary({
        interestBenefit: newLeadBenefit,
        preferredContact: newLeadContact,
        platform: newLeadPlatform,
      }),
      status: resolvedStatus,
      handoverStaff: assignedStaff,
      handoverStaffRole: foundRole,
      handoverAt: assignedStaff ? nowStamp : undefined,
      revenueAmount: revNum,
      memo: newLeadMemo.trim(),
    };

    commitStore((prev) => addOrReviveManualLeadInStore(prev, newItem));

    // 직접 상담/계약완료로 등록했고 CRM 자동 저장이 켜져 있으면 내 고객관리에도 자동 생성
    if (
      !assignedStaff &&
      storeRef.current.config.autoSaveCrmOnConvert &&
      (resolvedStatus === '상담진행중' || resolvedStatus === '계약완료')
    ) {
      const { savedCustomer } = await saveMarketingLeadToCrm(newItem, {
        syncRevenue: resolvedStatus === '계약완료' && revNum > 0,
        allowRestoreFromTrash: true,
      });
      setCrmCustomers(getCachedCustomers());
      commitStore((prev) => ({
        ...prev,
        leads: prev.leads.map((item) =>
          item.id === newItem.id
            ? { ...item, linkedCrmCustomerId: savedCustomer.id }
            : item
        ),
      }));
    }

    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadMemo('');
    setNewLeadRevenue('');
    setIsAddModalOpen(false);
    // 월/검색/하위탭 필터에 가려지지 않고 방금 추가한 카드가 즉시 최상단에 보이도록 정렬!
    setSearchQuery('');
    if (selectedMonth !== 'ALL' && selectedMonth !== yearMonth) {
      setSelectedMonth('ALL');
    }
    setStatusTab(resolvedStatus);
    if (resolvedStatus === '타직원인계') {
      setHandoverSubTab('ALL');
    } else if (resolvedStatus === '계약완료') {
      setContractSellerTab('ALL');
    }

    showToast(
      assignedStaff
        ? `✅ ${name} 고객님이 [${resolvedStatus} (${assignedStaff})] 탭에 저장되었습니다!`
        : `✅ ${name} 고객님이 [${resolvedStatus}] 탭에 저장되었습니다!`
    );
  };

  // 시트 복붙 / CSV·엑셀 파일 업로드 처리
  const handlePasteImport = () => {
    if (!pasteRawText.trim()) {
      showToast('⚠️ 붙여넣을 시트 내용을 먼저 입력해 주세요.');
      return;
    }
    const base = storeRef.current || loadMarketingDbStore();
    const merged = importLeadsFromRawText(base, pasteRawText);
    commitStore(() => merged.nextStore);
    setPasteRawText('');
    setIsSettingsOpen(false);
    setSearchQuery('');
    showToast(
      `✅ 붙여넣기 완료! 신규 ${merged.addedCount}건 추가 · ${merged.updatedCount}건 보강되었습니다.`
    );
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const base = storeRef.current || loadMarketingDbStore();
      const merged = await importLeadsFromFile(base, file);
      commitStore(() => merged.nextStore);
      setIsSettingsOpen(false);
      setSearchQuery('');
      showToast(
        `✅ 파일 반영 완료! 신규 ${merged.addedCount}건 추가 · ${merged.updatedCount}건 보강되었습니다.`
      );
    } catch {
      showToast('⚠️ 파일을 읽는 중 오류가 발생했습니다. CSV 또는 엑셀(.xlsx) 형식을 확인해 주세요.');
    }
  };

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return y && m ? `${y}년 ${Number(m)}월` : ym;
  };

  const cardSurface = isDark
    ? 'bg-[#141923] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';
  const subSurface = isDark
    ? 'bg-[#1B2230] border-white/10 text-slate-200'
    : 'bg-[#FAF8F4] border-[#E4DFD5] text-[#18181B]';
  const inputSurface = isDark
    ? 'bg-[#0E131D] border-white/15 text-white placeholder:text-slate-500'
    : 'bg-white border-[#D6D0C4] text-[#18181B] placeholder:text-stone-400';

  // 계약완료 탭에서 특정 판매자(직접 판매 or 특정 직원명) 선택 시 보여줄 누적 판매 금액 프로필
  const selectedContractSellerProfile = useMemo(() => {
    if (statusTab !== '계약완료' || contractSellerTab === 'ALL') return null;
    if (contractSellerTab === 'DIRECT') {
      return {
        label: '👑 직접 판매 (국지현 · 내 고객관리/총판·실판 반영)',
        isDirect: true,
        ...contractSellerBreakdown.direct,
      };
    }
    const found = contractSellerBreakdown.staffSellers.find(
      (s) => s.staffName === contractSellerTab
    );
    if (!found) return null;
    return {
      label: `👤 ${found.staffName} 인계 판매 누적 실적`,
      isDirect: false,
      periodCount: found.periodCount,
      periodRevenue: found.periodRevenue,
      allTimeCount: found.allTimeCount,
      allTimeRevenue: found.allTimeRevenue,
    };
  }, [statusTab, contractSellerTab, contractSellerBreakdown]);

  return (
    <div
      className={`min-h-[calc(100dvh-52px)] w-full pb-20 ${
        isDark ? 'bg-[#0B0E14] text-slate-100' : 'bg-[#F4F2ED] text-[#18181B]'
      }`}
    >
      {/* 상단 고정 헤더 */}
      <div
        className={`sticky top-[52px] z-30 border-b backdrop-blur-md px-3 sm:px-5 py-2.5 ${
          isDark
            ? 'bg-[#121620]/95 border-white/10'
            : 'bg-[#FAF8F4]/95 border-[#E2DDD3]'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-black inline-flex items-center gap-1 cursor-pointer shrink-0 ${subSurface}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel || '홈으로'}</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  📊 인스타 마케팅 DB관리
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40 text-[10px] font-black inline-flex items-center gap-1 shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  <span>국지현 전용 비공개</span>
                </span>
              </div>
              {store.config.lastSyncedAt && (
                <p className="text-[10.5px] opacity-65 font-medium truncate">
                  최근 동기화: {store.config.lastSyncedAt}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {store.config.lastSyncStatus === 'connected' ? (
              <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>자동연동 ON</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('sheet');
                  setIsSettingsOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                title="구글시트 공유 권한을 1회만 허용하면 45초마다 실시간 자동 유입됩니다"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>자동연동 켜기</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualSheetSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>시트 동기화</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const initHandover = statusTab === '타직원인계';
                setNewLeadIsHandover(initHandover);
                setNewLeadInitialStatus(
                  statusTab === '휴지통'
                    ? '신규'
                    : statusTab
                );
                setNewLeadRevenue('');
                setIsAddModalOpen(true);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-black inline-flex items-center gap-1 cursor-pointer ${subSurface}`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>직접추가</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsTab('sms');
                setIsSettingsOpen(true);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-black inline-flex items-center gap-1 cursor-pointer ${subSurface}`}
            >
              <Settings className="w-3.5 h-3.5 text-amber-500" />
              <span>문자·시트설정</span>
            </button>

            <button
              type="button"
              onClick={() => {
                lockOwnerMarketingDb();
                onLockAndHideMenu();
              }}
              title="공용 PC 등에서 이 메뉴를 즉시 숨깁니다 (다시 열려면 [홈] 5연타 + 비밀번호)"
              className="px-2.5 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">메뉴 숨김</span>
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92vw] px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-2xl border border-white/15 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="leading-snug">{toastMsg}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-4 space-y-3.5">
        {/* ==================== 1. 월별 관리 선택 바 ==================== */}
        <div
          className={`rounded-2xl border p-2.5 flex items-center justify-between gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${cardSurface}`}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-black px-2 flex items-center gap-1 text-[#8C5A32] dark:text-amber-300">
              <Calendar className="w-3.5 h-3.5" />
              <span>월별 DB 관리</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition whitespace-nowrap ${
                selectedMonth === 'ALL'
                  ? 'bg-[#18181B] dark:bg-sky-400 text-white dark:text-slate-950 border-transparent'
                  : `${subSurface} opacity-80 hover:opacity-100`
              }`}
            >
              전체 기간 ({activeLeads.length}건)
            </button>
            {availableMonths.map((ym) => {
              const cnt = activeLeads.filter((l) => l.yearMonth === ym).length;
              const active = selectedMonth === ym;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => setSelectedMonth(ym)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition whitespace-nowrap ${
                    active
                      ? 'bg-[#18181B] dark:bg-sky-400 text-white dark:text-slate-950 border-transparent'
                      : `${subSurface} opacity-80 hover:opacity-100`
                  }`}
                >
                  {formatMonthLabel(ym)} ({cnt}건)
                </button>
              );
            })}
          </div>

          <a
            href={store.config.sheetCsvOrShareUrl || DEFAULT_INSTA_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black inline-flex items-center gap-1 shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>구글시트 원본 열기</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* ==================== 2. 상단 KPI & 회사 보고용 DB 발생매출 총합계 보드 ==================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              {selectedMonth === 'ALL'
                ? '유입 DB 현황'
                : `${formatMonthLabel(selectedMonth)} 유입 DB`}
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono">
              {stats.totalPeriod}명
            </div>
            <div className="text-[11px] font-bold text-rose-500">
              신규 {stats.statusCounts['신규']}건 · 문자전송{' '}
              {stats.statusCounts['문자전송']}건
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              상담진행 · 타직원인계 현황
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-violet-600 dark:text-violet-300">
              {stats.statusCounts['상담진행중'] + stats.statusCounts['타직원인계']}명
            </div>
            <div className="text-[11px] font-bold opacity-75">
              상담진행중 {stats.statusCounts['상담진행중']} · 타직원인계{' '}
              {stats.statusCounts['타직원인계']} · 무응답{' '}
              {stats.statusCounts['무응답']}
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              계약완료 성과 (직접 + 타직원)
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-300">
              {stats.statusCounts['계약완료']}건{' '}
              <span className="text-xs font-extrabold">
                ({stats.conversionRate}%)
              </span>
            </div>
            <div className="text-[11px] font-bold opacity-75">
              직접 판매 {stats.directContractCount}건 · 타직원 판매{' '}
              {stats.staffContractCount}건
            </div>
          </div>

          {/* 핵심: 회사 보고용 DB 발생매출 총합계 (직접 판매 + 타직원 판매 전액 합산 / 내 개인 CRM은 직접 판매만 반영) */}
          <div
            className={`rounded-2xl border-2 p-3.5 space-y-1 ${
              isDark
                ? 'bg-gradient-to-br from-emerald-950/60 to-[#141923] border-emerald-400/50 text-white'
                : 'bg-gradient-to-br from-emerald-50 to-amber-50/50 border-emerald-500 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>
                  {selectedMonth === 'ALL'
                    ? '회사 보고용 DB 총 발생매출'
                    : `${formatMonthLabel(selectedMonth)} DB 총 발생매출`}
                </span>
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 truncate">
              {stats.periodRevenue.toLocaleString()}원
            </div>
            <div className="text-[10.5px] font-bold opacity-85 truncate">
              직접 {stats.directPeriodRevenue.toLocaleString()}원 · 타직원{' '}
              {stats.staffPeriodRevenue.toLocaleString()}원
            </div>
          </div>
        </div>

        <MarketingDbTabsAndGrid
          ctx={{
            bulkHandoverTarget,
            cardSurface,
            contractSellerBreakdown,
            contractSellerTab,
            findLinkedCrmCustomer,
            formatMonthLabel,
            getDefaultRenderedTextForLead,
            handleBulkHandoverLeads,
            handleBulkMarkContractCompleted,
            handleChangeHandoverStaff,
            handleChangeRevenue,
            handleChangeStatus,
            handleCopyStaffHandoverSummary,
            handleEmptyDbTrash,
            handleOpenSmsPreview,
            handlePermanentPurgeLead,
            handleQuickSendDefaultSms,
            handleRestoreLead,
            handleSaveOrOpenCrm,
            handleSoftDeleteLeads,
            handleSyncRevenueToCrm,
            handleUpdateMemo,
            handoverStaffTabs,
            handoverSubTab,
            inputSurface,
            isCardAttachedForLead,
            isDark,
            isSearchingAll,
            isSelectMode,
            searchQuery,
            selectedContractSellerProfile,
            selectedIds,
            selectedMonth,
            setBulkHandoverTarget,
            setContractSellerTab,
            setHandoverSubTab,
            setIsSelectMode,
            setSearchQuery,
            setSelectedIds,
            setStatusTab,
            staffOptions,
            stats,
            statusTab,
            store,
            subSurface,
            toggleCardAttachForLead,
            trashedLeads,
            triggerDirectFileShareWithCard,
            triggerNativeSmsSend,
            visibleLeads
          }}
        />
      </div>

      <MarketingDbModals
        ctx={{
          businessCardInputRef,
          cardSurface,
          commitStore,
          copiedScript,
          crmCustomers,
          csvFileInputRef,
          gasUrlInput,
          handleAddManualLead,
          handleBusinessCardImageUpload,
          handleCsvFileUpload,
          handleInlineApplyQuoteAsPrimary,
          handleInlineCrmFieldChange,
          handleInlineCrmMemoChange,
          handleInlineCrmStatusChange,
          handleInlineDeleteCustomer,
          handleInlineDeleteQuoteRecord,
          handlePasteImport,
          inlineSelectedCustomer,
          inlineSmsCustomer,
          inputSurface,
          isAddModalOpen,
          isSettingsOpen,
          isSyncing,
          newLeadBenefit,
          newLeadHandoverStaff,
          newLeadInitialStatus,
          newLeadIsHandover,
          newLeadMemo,
          newLeadName,
          newLeadPhone,
          newLeadPlatform,
          newLeadRevenue,
          newPinInput,
          onOpenCustomerInQuoteBuilder,
          onOpenQuoteRecordInQuoteBuilder,
          pasteRawText,
          setCopiedScript,
          setGasUrlInput,
          setInlineDetailCustomerId,
          setInlineSmsCustomer,
          setIsAddModalOpen,
          setIsSettingsOpen,
          setIsSyncing,
          setNewLeadBenefit,
          setNewLeadHandoverStaff,
          setNewLeadInitialStatus,
          setNewLeadIsHandover,
          setNewLeadMemo,
          setNewLeadName,
          setNewLeadPhone,
          setNewLeadPlatform,
          setNewLeadRevenue,
          setNewPinInput,
          setPasteRawText,
          setSettingsTab,
          setSheetUrlInput,
          setSmsPreviewIncludeCard,
          setSmsPreviewLead,
          setSmsPreviewText,
          setSmsPreviewTplId,
          setStore,
          settingsTab,
          sheetUrlInput,
          showToast,
          smsPreviewIncludeCard,
          smsPreviewLead,
          smsPreviewText,
          smsPreviewTplId,
          staffOptions,
          store,
          subSurface,
          triggerDirectFileShareWithCard,
          triggerNativeSmsSend
        }}
      />
    </div>
  );
};

export default MarketingDbManagerView;
