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
      setStore(hydrated);
      setGasUrlInput(hydrated.config.gasWebAppUrl || '');
      setSheetUrlInput(
        hydrated.config.sheetCsvOrShareUrl || DEFAULT_INSTA_SHEET_URL
      );
      // 진입 즉시 백그라운드 자동 동기화 (네트워크 중 로컬 삭제/수정 덮어쓰기 0%)
      syncLeadsFromGoogleSheet(hydrated).then((res) => {
        if (!mounted) return;
        setStore(loadMarketingDbStore());
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
      setStore(loadMarketingDbStore());
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

  const commitStore = (updater: (prev: MarketingDbStore) => MarketingDbStore) => {
    setStore((prev) => {
      const next = updater(prev);
      saveMarketingDbStore(next);
      pushMarketingStateToGasBackup(next).catch(() => {});
      return next;
    });
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

  const handleBusinessCardImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (result.startsWith('data:image/')) {
        commitStore((prev) => ({
          ...prev,
          config: {
            ...prev.config,
            businessCardDataUri: result,
          },
        }));
        showToast('새 명함 이미지가 저장되었습니다!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, status: nextStatus } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    showToast(`고객카드 상태가 [${nextStatus}]로 변경되었습니다.`);
    await syncCustomerToGas('update', { id, status: nextStatus });
  };

  const handleInlineCrmMemoChange = async (id: string, nextMemo: string) => {
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, memo: nextMemo } : c
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
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, ...patch } : c
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

  // 수동 DB 고객 등록
  const handleAddManualLead = () => {
    if (!newLeadName.trim() && !newLeadPhone.trim()) return;
    const phone = normalizeKoreanLeadPhone(newLeadPhone);
    const { createdAt, yearMonth } = normalizeLeadDateTime();
    const name = newLeadName.trim() || '인스타 고객';
    const fp = makeLeadFingerprint(name, phone, createdAt, `manual_${Date.now()}`);
    const assignedStaff = newLeadIsHandover
      ? newLeadHandoverStaff || UNASSIGNED_HANDOVER_STAFF
      : '';
    const foundRole = staffOptions.find((st) => st.name === assignedStaff)?.role;
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

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
      status: assignedStaff ? '타직원인계' : '신규',
      handoverStaff: assignedStaff,
      handoverStaffRole: foundRole,
      handoverAt: assignedStaff ? nowStamp : undefined,
      revenueAmount: 0,
      memo: newLeadMemo.trim(),
    };
    commitStore((prev) => ({
      ...prev,
      leads: [newItem, ...prev.leads],
    }));
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadMemo('');
    setIsAddModalOpen(false);
    setStatusTab(assignedStaff ? '타직원인계' : '신규');
    showToast(
      assignedStaff
        ? `${name} 고객님이 [타직원인계 (${assignedStaff})] 탭에 추가되었습니다.`
        : `${name} 고객님이 [신규] 탭에 추가되었습니다.`
    );
  };

  // 시트 복붙 / CSV 파일 업로드 처리
  const handlePasteImport = () => {
    if (!pasteRawText.trim()) return;
    const merged = importLeadsFromRawText(store, pasteRawText);
    saveMarketingDbStore(merged.nextStore);
    pushMarketingStateToGasBackup(merged.nextStore).catch(() => {});
    setStore(merged.nextStore);
    setPasteRawText('');
    setIsSettingsOpen(false);
    showToast(
      `붙여넣기 완료! 신규 ${merged.addedCount}건 추가 · ${merged.updatedCount}건 보강되었습니다.`
    );
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const merged = importLeadsFromRawText(store, text);
    saveMarketingDbStore(merged.nextStore);
    pushMarketingStateToGasBackup(merged.nextStore).catch(() => {});
    setStore(merged.nextStore);
    e.target.value = '';
    setIsSettingsOpen(false);
    showToast(
      `파일 반영 완료! 신규 ${merged.addedCount}건 추가 · ${merged.updatedCount}건 보강되었습니다.`
    );
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
                setNewLeadIsHandover(statusTab === '타직원인계');
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

        {/* ==================== 3. 6대 진행 상태 탭 (전체 보기 없음) & 하위 직원별 서브탭 ==================== */}
        <div className={`rounded-2xl border p-3 space-y-2.5 ${cardSurface}`}>
          {/* 3-1) 메인 6대 상태 탭 + 휴지통 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                {
                  id: '신규',
                  label: `🔥 신규 (${stats.statusCounts['신규']})`,
                },
                {
                  id: '문자전송',
                  label: `📩 문자전송 (${stats.statusCounts['문자전송']})`,
                },
                {
                  id: '상담진행중',
                  label: `🤝 상담진행중 (${stats.statusCounts['상담진행중']})`,
                },
                {
                  id: '무응답',
                  label: `⏳ 무응답 (${stats.statusCounts['무응답']})`,
                },
                {
                  id: '타직원인계',
                  label: `↪ 타직원인계 (${stats.statusCounts['타직원인계']})`,
                },
                {
                  id: '계약완료',
                  label: `🎉 계약완료 (${stats.statusCounts['계약완료']})`,
                },
                {
                  id: '휴지통',
                  label: `🗑️ 휴지통 (${trashedLeads.length})`,
                },
              ] as { id: StatusFilterTab; label: string }[]
            ).map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusTab(tab.id);
                    setIsSelectMode(false);
                    setSelectedIds([]);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                    active
                      ? tab.id === '타직원인계'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : tab.id === '계약완료'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : `${subSurface} opacity-85 hover:opacity-100`
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 3-2) [타직원인계] 탭 선택 시 하단에 열리는 인계 직원별 선택 서브탭 */}
          {statusTab === '타직원인계' && !isSearchingAll && (
            <div
              className={`rounded-2xl border p-2.5 space-y-2 ${
                isDark
                  ? 'bg-amber-950/25 border-amber-400/35'
                  : 'bg-amber-50/75 border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>인계 직원별 보기 (계약완료로 변경 시 계약완료 탭으로 즉시 이동)</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setHandoverSubTab('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                    handoverSubTab === 'ALL'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : `${subSurface} opacity-85 hover:opacity-100`
                  }`}
                >
                  전체 인계건 ({stats.statusCounts['타직원인계']}명)
                </button>
                {handoverStaffTabs.map((stTab) => {
                  const active = handoverSubTab === stTab.name;
                  return (
                    <button
                      key={stTab.name}
                      type="button"
                      onClick={() => setHandoverSubTab(stTab.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                        active
                          ? 'bg-amber-600 text-white border-amber-600'
                          : `${subSurface} opacity-90 hover:opacity-100`
                      }`}
                    >
                      👤 {stTab.name} ({stTab.count}명)
                    </button>
                  );
                })}
                {handoverStaffTabs.length === 0 && (
                  <span className="text-xs opacity-70 px-1 py-0.5">
                    현재 진행 중인 타 직원 인계건이 없습니다.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3-3) [계약완료] 탭 선택 시 하단에 열리는 [직접 판매 vs 타 직원 이름] 선택 서브탭 & 직원별 누적 판매 금액 보드 */}
          {statusTab === '계약완료' && !isSearchingAll && (
            <div
              className={`rounded-2xl border p-2.5 space-y-2.5 ${
                isDark
                  ? 'bg-emerald-950/25 border-emerald-400/35'
                  : 'bg-emerald-50/75 border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  <span>판매 담당자별 모아보기 &amp; 누적 판매 금액 확인</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setContractSellerTab('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                    contractSellerTab === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : `${subSurface} opacity-85 hover:opacity-100`
                  }`}
                >
                  전체 계약완료 ({contractSellerBreakdown.totalPeriodCount}건)
                </button>

                <button
                  type="button"
                  onClick={() => setContractSellerTab('DIRECT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                    contractSellerTab === 'DIRECT'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : `${subSurface} opacity-90 hover:opacity-100`
                  }`}
                >
                  👑 직접 판매 ({contractSellerBreakdown.direct.periodCount}건)
                </button>

                {contractSellerBreakdown.staffSellers.map((seller) => {
                  const active = contractSellerTab === seller.staffName;
                  return (
                    <button
                      key={seller.staffName}
                      type="button"
                      onClick={() => setContractSellerTab(seller.staffName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                        active
                          ? 'bg-amber-600 text-white border-amber-600'
                          : `${subSurface} opacity-90 hover:opacity-100`
                      }`}
                    >
                      👤 {seller.staffName} ({seller.periodCount}건)
                    </button>
                  );
                })}
              </div>

              {/* 특정 판매자(직접 판매 or 특정 타 직원) 탭 선택 시 해당 담당자의 누적 판매 금액 박스 표시 */}
              {selectedContractSellerProfile ? (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isDark
                      ? 'bg-[#111923] border-white/15'
                      : 'bg-white border-emerald-300'
                  }`}
                >
                  <div className="text-xs font-black">
                    {selectedContractSellerProfile.label}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                    {selectedMonth !== 'ALL' && (
                      <span className="font-bold opacity-80">
                        {formatMonthLabel(selectedMonth)}:{' '}
                        <strong>
                          {selectedContractSellerProfile.periodCount}건 ·{' '}
                          {selectedContractSellerProfile.periodRevenue.toLocaleString()}원
                        </strong>
                      </span>
                    )}
                    <span className="font-black text-sm text-emerald-700 dark:text-emerald-300">
                      누적 판매 금액: 총{' '}
                      {selectedContractSellerProfile.allTimeCount}건 ·{' '}
                      {selectedContractSellerProfile.allTimeRevenue.toLocaleString()}원
                    </span>
                  </div>
                </div>
              ) : (
                contractSellerBreakdown.hasAnyStaffContract && (
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold pt-0.5">
                    <span className="opacity-75">담당자별 누적 판매액:</span>
                    <button
                      type="button"
                      onClick={() => setContractSellerTab('DIRECT')}
                      className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono font-black cursor-pointer"
                    >
                      직접 판매{' '}
                      {contractSellerBreakdown.direct.allTimeRevenue.toLocaleString()}원
                    </button>
                    {contractSellerBreakdown.staffSellers.map((s) => (
                      <button
                        key={s.staffName}
                        type="button"
                        onClick={() => setContractSellerTab(s.staffName)}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono font-black cursor-pointer"
                      >
                        {s.staffName} {s.allTimeRevenue.toLocaleString()}원
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* 3-4) 검색창 + 다중 선택 관리 버튼 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고객명 · 연락처 · 요약내용 · 메모 · 인계직원 검색 (전 단계 통합검색)"
                className={`w-full pl-9 pr-8 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {statusTab === '휴지통' && trashedLeads.length > 0 && (
                <button
                  type="button"
                  onClick={handleEmptyDbTrash}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black whitespace-nowrap cursor-pointer"
                >
                  🗑️ 휴지통 비우기 ({trashedLeads.length}명)
                </button>
              )}
              {statusTab !== '휴지통' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectMode((v) => !v);
                    setSelectedIds([]);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-black whitespace-nowrap cursor-pointer ${
                    isSelectMode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : subSurface
                  }`}
                >
                  {isSelectMode
                    ? '선택닫기'
                    : statusTab === '타직원인계'
                    ? '선택 일괄계약·관리'
                    : '선택 일괄인계·삭제'}
                </button>
              )}

              {isSelectMode && visibleLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.length === visibleLeads.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(visibleLeads.map((l) => l.id));
                    }
                  }}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-black whitespace-nowrap cursor-pointer ${subSurface}`}
                >
                  {selectedIds.length === visibleLeads.length
                    ? '전체해제'
                    : `전체선택(${visibleLeads.length})`}
                </button>
              )}
            </div>
          </div>

          {isSearchingAll && (
            <div className="text-[11px] font-black text-indigo-600 dark:text-sky-300 px-1">
              🔍 모든 진행 단계에서 &lsquo;{searchQuery}&rsquo; 검색 결과{' '}
              {visibleLeads.length}건을 표시 중입니다.
            </div>
          )}

          {/* 다중 선택 시 열리는 [일괄 직원 인계] / [일괄 계약완료 전환] / [선택 삭제] 바 */}
          {isSelectMode && selectedIds.length > 0 && statusTab !== '휴지통' && (
            <div
              className={`rounded-2xl border p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 ${
                isDark
                  ? 'bg-amber-950/35 border-amber-400/40'
                  : 'bg-amber-50/90 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <span className="text-xs font-black text-amber-800 dark:text-amber-200 shrink-0">
                  ✓ {selectedIds.length}명 선택됨:
                </span>

                {statusTab === '타직원인계' && (
                  <button
                    type="button"
                    onClick={() => handleBulkMarkContractCompleted(selectedIds)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black whitespace-nowrap cursor-pointer"
                  >
                    🎉 {selectedIds.length}명 일괄 계약완료로 넘기기
                  </button>
                )}

                <select
                  value={bulkHandoverTarget}
                  onChange={(e) => setBulkHandoverTarget(e.target.value)}
                  className={`flex-1 min-w-[155px] px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
                >
                  <option value={UNASSIGNED_HANDOVER_STAFF}>
                    ↪ {UNASSIGNED_HANDOVER_STAFF}
                  </option>
                  {staffOptions.map((st) => (
                    <option key={st.name} value={st.name}>
                      ↪ {st.name} ({st.role} ·{' '}
                      {st.isOffToday ? `오늘휴무[${st.todayCode}]` : '오늘근무'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkHandoverLeads(selectedIds, bulkHandoverTarget)
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black whitespace-nowrap cursor-pointer"
                >
                  {statusTab === '타직원인계'
                    ? '담당직원 일괄변경'
                    : `↪ ${selectedIds.length}명 타직원인계로 이동`}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSoftDeleteLeads(selectedIds)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black whitespace-nowrap cursor-pointer"
              >
                🗑️ {selectedIds.length}명 삭제
              </button>
            </div>
          )}
        </div>

        {/* ==================== 4. 고객 DB 카드 리스트 ==================== */}
        {visibleLeads.length === 0 ? (
          <div
            className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}
          >
            <Database className="w-8 h-8 mx-auto opacity-40" />
            <div className="text-sm font-black">
              현재 [{statusTab}] 단계에 해당하는 고객이 없습니다.
            </div>
            <p className="text-xs opacity-70">
              다른 진행 상태 탭을 눌러 확인하시거나 상단 [시트 동기화] · [직접추가]를 이용해 주세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleLeads.map((lead) => {
              const linkedCrm = findLinkedCrmCustomer(lead);
              const isChecked = selectedIds.includes(lead.id);
              const cleanPhoneDigits = (lead.phone || '').replace(/[^0-9+]/g, '');
              const isHandedOverLead =
                lead.status === '타직원인계' || Boolean(lead.handoverStaff);

              return (
                <div
                  key={lead.id}
                  className={`rounded-3xl border p-4 space-y-3 shadow-2xs transition ${
                    lead.status === '계약완료'
                      ? isDark
                        ? 'bg-[#13221E] border-emerald-500/45'
                        : 'bg-white border-2 border-emerald-500'
                      : lead.status === '타직원인계'
                      ? isDark
                        ? 'bg-[#1E1910] border-amber-500/45'
                        : 'bg-white border-2 border-amber-400'
                      : cardSurface
                  }`}
                >
                  {/* 1) 고객명 · 전화번호 · [문자내역 바로보기] · 접수일시 · 삭제 버튼 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isSelectMode && statusTab !== '휴지통' && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, lead.id]);
                            } else {
                              setSelectedIds((prev) =>
                                prev.filter((id) => id !== lead.id)
                              );
                            }
                          }}
                          className="mt-1 w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-black tracking-tight">
                            {lead.customerName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10.5px] font-black ${getStatusBadgeStyle(
                              lead.status,
                              isDark
                            )}`}
                          >
                            {lead.status}
                          </span>
                          {lead.handoverStaff ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-400/45 text-[10px] font-black">
                              👤 {lead.status === '계약완료' ? '타직원 판매: ' : '인계: '}
                              {lead.handoverStaff}
                            </span>
                          ) : (
                            lead.status === '계약완료' && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/35 text-[10px] font-black">
                                👑 직접 판매
                              </span>
                            )
                          )}
                          {!lead.handoverStaff && linkedCrm && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                              ✓ 내 고객관리 연동됨
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                          {lead.phone ? (
                            <>
                              <a
                                href={`tel:${cleanPhoneDigits}`}
                                className="font-mono font-black text-blue-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                                title="전화 걸기"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{lead.phone}</span>
                              </a>
                              {/* 자동 입력 문구 없이 주고받은 문자 내역만 확인하는 빈 문자앱 이동 버튼 */}
                              <a
                                href={`sms:${cleanPhoneDigits}`}
                                className={`px-2 py-0.5 rounded-lg border text-[10.5px] font-black inline-flex items-center gap-1 transition ${
                                  isDark
                                    ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border-indigo-400/35'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                                }`}
                                title="자동 문구 없이 이 번호와 주고받은 문자 대화내역(문자앱) 바로 보기"
                              >
                                <MailOpen className="w-3 h-3 shrink-0" />
                                <span>문자내역</span>
                              </a>
                            </>
                          ) : (
                            <span className="opacity-50 text-xs">연락처 없음</span>
                          )}
                          <span className="text-[11px] font-mono opacity-65">
                            · {lead.platform || '인스타그램'} · {lead.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    {statusTab === '휴지통' ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreLead(lead)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-black cursor-pointer"
                        >
                          복원
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentPurgeLead(lead.id)}
                          className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black cursor-pointer"
                        >
                          영구삭제
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSoftDeleteLeads([lead.id])}
                        title="이 고객 삭제 (휴지통 보관 및 시트 재동기화 차단)"
                        className="p-1.5 rounded-xl opacity-55 hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* 2) 시트 업데이트 자동 요약 박스 + 상담 메모 */}
                  <div className={`rounded-2xl border p-3 space-y-2 ${subSurface}`}>
                    <div className="text-xs font-black leading-snug text-indigo-700 dark:text-sky-300">
                      📌 요약: {lead.autoSummary}
                    </div>
                    {(lead.interestBenefit || lead.preferredContact) && (
                      <div className="text-[11px] opacity-75 leading-relaxed">
                        • 신청원문: {lead.interestBenefit || '-'}
                        {lead.preferredContact
                          ? ` / ${lead.preferredContact}`
                          : ''}
                      </div>
                    )}
                    <input
                      type="text"
                      value={lead.memo || ''}
                      onChange={(e) => handleUpdateMemo(lead.id, e.target.value)}
                      placeholder="진행/상담/인계 요약 메모 입력 (예: 12월 입주, 냉장고·세탁기 견적 희망)"
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
                    />
                  </div>

                  {statusTab !== '휴지통' && (
                    <>
                      {/* 3) 6단계 진행 상태 변경 버튼 (신규 / 문자전송 / 상담진행중 / 무응답 / 타직원인계 / 계약완료) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold opacity-75">
                          <span>진행 상태 변경</span>
                          {lead.smsSentAt && (
                            <span className="font-mono text-[10px]">
                              최근 문자: {lead.smsSentAt}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                          {MARKETING_LEAD_STATUSES.map((st) => {
                            const active = lead.status === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleChangeStatus(lead, st)}
                                className={`py-1.5 px-1 rounded-xl text-[11px] font-black border transition cursor-pointer whitespace-nowrap ${
                                  active
                                    ? getStatusActiveBtnStyle(st)
                                    : `${subSurface} opacity-80 hover:opacity-100`
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4) 계약완료 시 발생매출 입력 박스 (회사 보고용 DB 총매출 자동 합산 + 직접 판매는 내 고객관리 연동) */}
                      {lead.status === '계약완료' && (
                        <div
                          className={`rounded-2xl border-2 p-3 space-y-2 ${
                            isDark
                              ? 'bg-emerald-950/35 border-emerald-500/40'
                              : 'bg-emerald-50/80 border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              <span>
                                {lead.handoverStaff
                                  ? `계약완료 발생매출 (${lead.handoverStaff} 판매 · DB 총매출 합산)`
                                  : '계약완료 발생매출 (직접 판매 · DB매출 + 내 실적)'}
                              </span>
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {[1000000, 3000000, 5000000, 10000000].map(
                                (inc) => (
                                  <button
                                    key={inc}
                                    type="button"
                                    onClick={() =>
                                      handleChangeRevenue(
                                        lead,
                                        (lead.revenueAmount || 0) + inc
                                      )
                                    }
                                    className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-black text-emerald-700 dark:text-emerald-300 cursor-pointer"
                                  >
                                    +{inc / 10000}만
                                  </button>
                                )
                              )}
                              {lead.revenueAmount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleChangeRevenue(lead, 0)}
                                  className="px-1.5 py-0.5 rounded-lg bg-stone-200 dark:bg-slate-800 text-[10px] font-bold cursor-pointer"
                                >
                                  0원
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                step={10000}
                                value={lead.revenueAmount || ''}
                                onChange={(e) =>
                                  handleChangeRevenue(
                                    lead,
                                    Number(e.target.value) || 0
                                  )
                                }
                                placeholder="발생매출 금액 입력 (예: 8500000)"
                                className={`w-full pl-3 pr-7 py-2 rounded-xl border text-base sm:text-xs font-black font-mono text-right ${inputSurface}`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60">
                                원
                              </span>
                            </div>
                            {!lead.handoverStaff && (
                              <button
                                type="button"
                                onClick={() => handleSyncRevenueToCrm(lead)}
                                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black whitespace-nowrap cursor-pointer shrink-0"
                              >
                                내 고객카드 반영
                              </button>
                            )}
                          </div>

                          {lead.revenueAmount > 0 && (
                            <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 text-right font-mono">
                              {lead.handoverStaff
                                ? `${lead.handoverStaff} 판매 DB매출: `
                                : '내 직접판매 DB매출: '}
                              {lead.revenueAmount.toLocaleString()}원 (
                              {(lead.revenueAmount / 10000).toLocaleString()}만원)
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5) 타 직원 인계 이름 지정 / 판매 담당자 선택 바 */}
                      {isHandedOverLead ? (
                        <div
                          className={`rounded-2xl border p-2.5 space-y-2 ${
                            isDark
                              ? 'bg-amber-950/30 border-amber-400/40'
                              : 'bg-amber-50/85 border-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {lead.status === '계약완료'
                                  ? '👤 타 직원 판매 담당자'
                                  : '↪ 인계받은 직원 이름 선택'}
                              </span>
                              {lead.handoverAt && (
                                <span className="font-mono text-[10px] opacity-75">
                                  ({lead.handoverAt})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleChangeHandoverStaff(lead, '')}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-400/50 text-[10.5px] font-black text-amber-800 dark:text-amber-300 cursor-pointer"
                            >
                              {lead.status === '계약완료'
                                ? '👑 직접 판매로 변경'
                                : '↩ 직접 상담으로 복귀'}
                            </button>
                          </div>

                          <select
                            value={lead.handoverStaff || UNASSIGNED_HANDOVER_STAFF}
                            onChange={(e) =>
                              handleChangeHandoverStaff(lead, e.target.value)
                            }
                            className={`w-full px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-black ${inputSurface}`}
                          >
                            <option value={UNASSIGNED_HANDOVER_STAFF}>
                              ↪ {UNASSIGNED_HANDOVER_STAFF} (직원 선택 전)
                            </option>
                            {staffOptions.map((st) => (
                              <option key={st.name} value={st.name}>
                                👤 {st.name} ({st.role} ·{' '}
                                {st.isOffToday
                                  ? `오늘휴무[${st.todayCode}]`
                                  : '오늘근무'}
                                )
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[11px] font-extrabold opacity-80 flex items-center gap-1 shrink-0">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            <span>
                              {lead.status === '계약완료'
                                ? '판매 구분 변경:'
                                : '타 직원 인계 지정:'}
                            </span>
                          </span>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleChangeHandoverStaff(lead, e.target.value);
                              }
                            }}
                            className={`flex-1 max-w-[245px] px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
                          >
                            <option value="">
                              {lead.status === '계약완료'
                                ? '👑 직접 판매 (내 고객관리/실적)'
                                : '👑 내가 직접 상담'}
                            </option>
                            <option value={UNASSIGNED_HANDOVER_STAFF}>
                              ↪ 타직원인계 ({UNASSIGNED_HANDOVER_STAFF})
                            </option>
                            {staffOptions.map((st) => (
                              <option key={st.name} value={st.name}>
                                ↪ {st.name} ({st.role} ·{' '}
                                {st.isOffToday
                                  ? `오늘휴무[${st.todayCode}]`
                                  : '오늘근무'}
                                )
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* 6) 하단 액션 바 */}
                      {isHandedOverLead ? (
                        <div className="pt-1.5 border-t border-black/5 dark:border-white/10 grid grid-cols-2 min-[400px]:grid-cols-12 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyStaffHandoverSummary(lead)}
                            className="col-span-2 min-[400px]:col-span-5 py-2.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">직원전달 요약복사</span>
                          </button>

                          {cleanPhoneDigits ? (
                            <a
                              href={`sms:${cleanPhoneDigits}`}
                              className={`col-span-1 min-[400px]:col-span-3 py-2.5 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 ${subSurface}`}
                              title="자동 문구 없이 주고받은 문자 대화내역만 보기"
                            >
                              <MailOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">문자내역</span>
                            </a>
                          ) : (
                            <span />
                          )}

                          <button
                            type="button"
                            onClick={() => handleQuickSendDefaultSms(lead)}
                            className="col-span-1 min-[400px]:col-span-4 py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3 shrink-0" />
                            <span className="truncate">안내문자 발송</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1.5 border-t border-black/5 dark:border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => toggleCardAttachForLead(lead)}
                              className={`px-2.5 py-1 rounded-xl border text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer transition ${
                                isCardAttachedForLead(lead)
                                  ? isDark
                                    ? 'bg-indigo-500/25 text-amber-200 border-indigo-400/50'
                                    : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                  : `${subSurface} opacity-75 hover:opacity-100`
                              }`}
                            >
                              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                              {lead.status === '신규' ? (
                                <span>
                                  {isCardAttachedForLead(lead)
                                    ? '✓ 신규고객 명함사진 자동동봉 ON'
                                    : '명함사진 동봉 OFF (터치 시 켜기)'}
                                </span>
                              ) : (
                                <span>
                                  {isCardAttachedForLead(lead)
                                    ? '✓ 명함사진 함께 보내기 선택됨'
                                    : '+ 명함사진 함께 보내기 (선택)'}
                                </span>
                              )}
                            </button>

                            {isCardAttachedForLead(lead) && (
                              (store.config.businessCardSendMethod || 'share-sheet') === 'share-sheet' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerNativeSmsSend(
                                      lead,
                                      getDefaultRenderedTextForLead(lead),
                                      true
                                    )
                                  }
                                  title="수신번호와 문구를 문자앱에 먼저 채우고 명함 사진은 키보드 클립보드에 복사합니다"
                                  className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 dark:text-amber-200 border border-amber-400/40 text-[10.5px] font-black inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Send className="w-3 h-3 shrink-0" />
                                  <span>번호자동 문자앱(명함복사)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerDirectFileShareWithCard(
                                      lead,
                                      getDefaultRenderedTextForLead(lead)
                                    )
                                  }
                                  title="명함 이미지 파일과 문구를 MMS/카톡 공유창으로 직접 첨부하여 보냅니다 (전화번호 자동 복사)"
                                  className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 dark:text-amber-200 border border-amber-400/40 text-[10.5px] font-black inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Share2 className="w-3 h-3 shrink-0" />
                                  <span>MMS·카톡 명함파일 직접첨부</span>
                                </button>
                              )
                            )}
                          </div>

                          {/* 하단 원터치 실행 버튼 (폴드 커버 등 초소형 화면 자동배열 보호) */}
                          <div className="grid grid-cols-2 min-[380px]:grid-cols-12 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickSendDefaultSms(lead)}
                              className={`col-span-1 min-[380px]:col-span-5 py-2.5 px-2 rounded-xl text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-2xs ${
                                isCardAttachedForLead(lead)
                                  ? 'bg-indigo-600 hover:bg-indigo-500'
                                  : 'bg-blue-600 hover:bg-blue-500'
                              }`}
                            >
                              <Send className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {isCardAttachedForLead(lead)
                                  ? '명함+문자 발송'
                                  : '정해진 문자발송'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenSmsPreview(lead)}
                              title="문자 문구 및 명함 미리보기 / 다른 템플릿 선택"
                              className={`col-span-1 min-[380px]:col-span-2 py-2.5 px-1.5 rounded-xl border text-[11px] font-black flex items-center justify-center cursor-pointer ${subSurface}`}
                            >
                              문구변경
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleSaveOrOpenCrm(
                                  lead,
                                  linkedCrm ? 'open-crm' : 'save-only'
                                )
                              }
                              className={`col-span-1 min-[380px]:col-span-3 py-2.5 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer border ${
                                linkedCrm
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                                  : isDark
                                  ? 'bg-[#1B2230] hover:bg-[#253047] text-amber-300 border-amber-400/35'
                                  : 'bg-[#FAF5EB] hover:bg-[#F2E8D5] text-[#6E4423] border-[#D8C3A8]'
                              }`}
                            >
                              {linkedCrm ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">고객관리열기</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">고객카드저장</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleSaveOrOpenCrm(lead, 'open-quote')
                              }
                              title="고객카드 자동 저장 후 바로 견적기 화면으로 연결"
                              className="col-span-1 min-[380px]:col-span-2 py-2.5 px-1.5 rounded-xl bg-[#18181B] dark:bg-sky-500 hover:opacity-90 text-white dark:text-slate-950 text-[11px] font-black flex items-center justify-center gap-0.5 cursor-pointer"
                            >
                              <Calculator className="w-3 h-3 shrink-0" />
                              <span>견적</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== 모달 1: 고객별 문자 미리보기 / 문구 선택 발송 ==================== */}
      {smsPreviewLead && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSmsPreviewLead(null)}
        >
          <div
            className={`w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto modal-kb-safe rounded-t-3xl sm:rounded-3xl border p-5 space-y-3.5 shadow-2xl ${cardSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-black text-sm sm:text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>{smsPreviewLead.customerName} 고객님 문자 발송</span>
              </div>
              <div className="flex items-center gap-1.5">
                {smsPreviewLead.phone && (
                  <a
                    href={`sms:${smsPreviewLead.phone.replace(/[^0-9+]/g, '')}`}
                    onClick={() => setSmsPreviewLead(null)}
                    className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black inline-flex items-center gap-1"
                    title="자동 문구 없이 문자 대화내역만 보기"
                  >
                    <MailOpen className="w-3.5 h-3.5" />
                    <span>문자내역만 보기</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSmsPreviewLead(null)}
                  className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold opacity-75">
                문자 템플릿 선택
              </label>
              <select
                value={smsPreviewTplId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSmsPreviewTplId(id);
                  const found = store.config.smsTemplates.find(
                    (t) => t.id === id
                  );
                  if (found) {
                    setSmsPreviewText(
                      renderSmsTemplateForLead(found.body, smsPreviewLead)
                    );
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
              >
                {store.config.smsTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 명함 사진 동봉 선택 (신규고객 자동 ON / 나머지 선택사항) */}
            <div className={`rounded-2xl border p-3 space-y-2 ${subSurface}`}>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  <span>
                    명함 사진 함께 보내기{' '}
                    <span className="text-[10.5px] opacity-75">
                      ({smsPreviewLead.status === '신규' ? '신규고객 자동 ON' : '선택사항'})
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={smsPreviewIncludeCard}
                  onChange={(e) => setSmsPreviewIncludeCard(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </label>

              {smsPreviewIncludeCard && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={getEffectiveBusinessCardDataUri(store.config)}
                    alt="국지현 명함 미리보기"
                    className="w-28 h-auto rounded-lg border border-black/10 dark:border-white/15 bg-white shrink-0"
                  />
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    • <strong>[문자앱 바로 열기]</strong>: 수신번호·문구가 자동 입력되며 명함 이미지가 클립보드에 자동 복사됩니다.
                    <br />• <strong>[명함파일 직접첨부]</strong>: 명함 사진 파일이 이미 첨부된 상태로 메시지/카톡 공유창이 열립니다(전화번호 자동 복사).
                  </p>
                </div>
              )}
            </div>

            <textarea
              rows={7}
              value={smsPreviewText}
              onChange={(e) => setSmsPreviewText(e.target.value)}
              className={`w-full p-3 rounded-2xl border text-base sm:text-xs font-medium leading-relaxed ${inputSurface}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {smsPreviewIncludeCard ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerNativeSmsSend(target, smsPreviewText, true);
                    }}
                    className="py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>문자앱 바로열기 (명함복사됨)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerDirectFileShareWithCard(target, smsPreviewText);
                    }}
                    className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>명함파일 직접첨부 (MMS·카톡)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await safeCopyText(smsPreviewText)) {
                        showToast('문자 문구가 복사되었습니다.');
                      }
                    }}
                    className={`py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${subSurface}`}
                  >
                    <Copy className="w-4 h-4" />
                    <span>문구만 복사</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerNativeSmsSend(target, smsPreviewText, false);
                    }}
                    className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>문자만 바로 열기</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 모달 2: 고정 문자 편집 · 구글시트 실시간 연동 · 보안코드 설정 ==================== */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className={`w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border p-5 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto modal-kb-safe ${cardSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black">
                ⚙️ DB관리 고정문자 · 구글시트 자동연동 설정
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-xl opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border ${subSurface}`}>
              {[
                { id: 'sms', label: '📩 고정문자 설정' },
                { id: 'sheet', label: '🔄 구글시트 연동' },
                { id: 'security', label: '🔒 비공개 보안' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettingsTab(t.id as any)}
                  className={`py-2 rounded-xl text-xs font-black cursor-pointer ${
                    settingsTab === t.id
                      ? 'bg-indigo-600 text-white'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {settingsTab === 'sms' && (
              <div className="space-y-3">
                <div className={`rounded-2xl border p-3.5 space-y-2.5 ${subSurface}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-500" />
                      <span>신규고객 자동동봉 명함 이미지 &amp; 발송 방식</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={businessCardInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBusinessCardImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => businessCardInputRef.current?.click()}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer ${cardSurface}`}
                      >
                        명함 교체
                      </button>
                      {store.config.businessCardDataUri &&
                        store.config.businessCardDataUri !==
                          DEFAULT_OWNER_BUSINESS_CARD_DATA_URI && (
                          <button
                            type="button"
                            onClick={() => {
                              commitStore((prev) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  businessCardDataUri:
                                    DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
                                },
                              }));
                              showToast('기본 국지현 명함으로 복원되었습니다.');
                            }}
                            className="px-2 py-1 rounded-lg bg-stone-200 dark:bg-slate-800 text-[10.5px] font-bold cursor-pointer"
                          >
                            기본명함 복원
                          </button>
                        )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <img
                      src={getEffectiveBusinessCardDataUri(store.config)}
                      alt="등록된 국지현 명함"
                      className="w-40 h-auto rounded-xl border border-black/10 dark:border-white/15 bg-white shadow-2xs shrink-0"
                    />
                    <div className="space-y-1.5 text-[11px] w-full">
                      <div className="font-extrabold opacity-85">
                        카드 하단 [명함+문자 발송] 버튼 기본 동작 선택:
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          {
                            id: 'share-sheet' as const,
                            label:
                              '① 명함파일 직접첨부 공유창 (추천 · 명함사진+본문 자동첨부, 번호 자동복사)',
                          },
                          {
                            id: 'sms-clipboard' as const,
                            label:
                              '② 문자앱 바로열기 (수신번호·본문 자동입력 + 명함 키보드 클립보드 복사)',
                          },
                        ].map((opt) => {
                          const active =
                            (store.config.businessCardSendMethod ||
                              'share-sheet') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                commitStore((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    businessCardSendMethod: opt.id,
                                  },
                                }))
                              }
                              className={`p-2 rounded-xl border text-left font-black cursor-pointer transition ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : `${cardSurface} opacity-80 hover:opacity-100`
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs opacity-80 leading-relaxed">
                  • 카드 하단 <strong>[정해진 문자발송]</strong> 버튼을 누르면 아래에서 기본으로 지정한 문구가 자동으로 채워져 문자앱이 열립니다. (주고받은 내역만 볼 때는 전화번호 옆 <strong>[문자내역]</strong> 버튼을 누르세요!)
                  <br />• 사용 가능한 자동 치환어:{' '}
                  <code className="font-mono font-bold text-indigo-500">
                    {'{고객명}'} {'{플랫폼}'} {'{희망혜택}'} {'{안내방식}'} {'{요약}'}
                  </code>
                </p>

                {store.config.smsTemplates.map((tpl: MarketingSmsTemplate) => {
                  const isDefault = store.config.activeTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      className={`rounded-2xl border p-3 space-y-2 ${subSurface}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={tpl.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            commitStore((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                smsTemplates: prev.config.smsTemplates.map(
                                  (item) =>
                                    item.id === tpl.id
                                      ? { ...item, title: val }
                                      : item
                                ),
                              },
                            }));
                          }}
                          className={`flex-1 px-2.5 py-1 rounded-lg border text-xs font-black ${inputSurface}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            commitStore((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                activeTemplateId: tpl.id,
                              },
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer shrink-0 ${
                            isDefault
                              ? 'bg-blue-600 text-white'
                              : 'bg-black/10 dark:bg-white/10'
                          }`}
                        >
                          {isDefault ? '✓ 기본 고정문자' : '기본으로 지정'}
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        value={tpl.body}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitStore((prev) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              smsTemplates: prev.config.smsTemplates.map(
                                (item) =>
                                  item.id === tpl.id
                                    ? { ...item, body: val }
                                    : item
                              ),
                            },
                          }));
                        }}
                        className={`w-full p-2.5 rounded-xl border text-xs leading-relaxed ${inputSurface}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {settingsTab === 'sheet' && (
              <div className="space-y-3.5 text-xs">
                {/* 방법 A: 코드 복사 없이 모바일/PC에서 10초 만에 켜는 초간단 자동연동 */}
                <div className={`rounded-2xl border-2 border-emerald-500/40 p-3.5 space-y-2.5 ${subSurface}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-black text-emerald-700 dark:text-emerald-300">
                      ① [초간단 10초 완성 · 코드 불필요] 시트 공유 1회 허용으로 즉시 자동연동
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        store.config.lastSyncStatus === 'connected'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {store.config.lastSyncStatus === 'connected'
                        ? '✓ 실시간 연동됨'
                        : '시트 공유 허용 대기중'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    앱에 이미 <strong>[인스타 광고 전용 DB]</strong> 시트 고유 주소가 사전 세팅되어 있습니다! 아래 버튼으로 시트를 연 뒤 우측 상단 <strong>[공유 → 일반 액세스: &lsquo;링크가 있는 모든 사용자(뷰어)&rsquo;]</strong>로 1회만 바꿔주시면, 앱을 열 때마다·45초마다 신규 DB가 자동으로 들어옵니다. (DB 메뉴 자체가 비밀번호로 숨겨져 있어 타 직원은 볼 수 없습니다.)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <a
                      href={sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>1단계: 인스타 DB 시트 열기</span>
                    </a>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={async () => {
                        const updatedCfgStore = {
                          ...store,
                          config: {
                            ...store.config,
                            sheetCsvOrShareUrl:
                              sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL,
                            gasWebAppUrl: gasUrlInput.trim(),
                          },
                        };
                        saveMarketingDbStore(updatedCfgStore);
                        setStore(updatedCfgStore);
                        setIsSyncing(true);
                        const res = await syncLeadsFromGoogleSheet(updatedCfgStore);
                        setStore(res.nextStore);
                        setIsSyncing(false);
                        showToast(res.message);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                      />
                      <span>2단계: 지금 자동연동 확인</span>
                    </button>
                  </div>
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-extrabold opacity-80 block">
                      연결된 인스타 DB 구글시트 주소 (변경 시에만 수정 · 웹에 게시 CSV 링크도 호환)
                    </label>
                    <input
                      type="url"
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      placeholder={DEFAULT_INSTA_SHEET_URL}
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-[11px] ${inputSurface}`}
                    />
                  </div>
                </div>

                {/* 방법 B: 시트를 '나만 보기' 비공개로 유지 + 폰↔PC 상태 양방향 백업 */}
                <div className={`rounded-2xl border p-3.5 space-y-2.5 ${subSurface}`}>
                  <div className="font-black text-indigo-600 dark:text-sky-300">
                    ② [시트 &lsquo;제한됨&rsquo; 비공개 유지 + 폰↔PC 백업용] Apps Script 웹앱 연결 (선택)
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    시트 공유를 &lsquo;제한됨(나만 보기)&rsquo;으로 완전히 잠가두면서 폰↔PC 간 진행상태·매출까지 양방향 백업하고 싶으실 때는 PC에서 시트 상단 <strong>[확장 프로그램 → Apps Script]</strong>에 아래 코드를 붙여넣고 <strong>[배포 → 새 배포 → 웹 앱(모든 사용자)]</strong> URL을 넣어주세요.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await safeCopyText(getReadyMadeAppsScriptCode())) {
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2500);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedScript ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                        <span>전용 Apps Script 코드 복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>전용 Apps Script 자동연동 코드 1클릭 복사</span>
                      </>
                    )}
                  </button>

                  <div className="space-y-1 pt-1">
                    <label className="font-extrabold block">
                      배포된 Apps Script 웹 앱 URL 붙여넣기
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        value={gasUrlInput}
                        onChange={(e) => setGasUrlInput(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs ${inputSurface}`}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const nextCfgStore = {
                            ...store,
                            config: {
                              ...store.config,
                              gasWebAppUrl: gasUrlInput.trim(),
                              sheetCsvOrShareUrl:
                                sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL,
                            },
                          };
                          saveMarketingDbStore(nextCfgStore);
                          setStore(nextCfgStore);
                          setIsSyncing(true);
                          const res = await syncLeadsFromGoogleSheet(nextCfgStore);
                          setStore(res.nextStore);
                          setIsSyncing(false);
                          showToast(
                            res.ok
                              ? `✅ 연동 성공! ${res.message}`
                              : '주소가 저장되었습니다. (배포 권한: 모든 사용자 설정을 확인해 주세요)'
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-black cursor-pointer shrink-0"
                      >
                        저장·테스트
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-3.5 space-y-2 ${subSurface}`}>
                  <div className="font-black">
                    ② 시트 행 복사·붙여넣기 또는 CSV 즉시 반영
                  </div>
                  <textarea
                    rows={4}
                    value={pasteRawText}
                    onChange={(e) => setPasteRawText(e.target.value)}
                    placeholder="구글시트에서 행(헤더 포함)을 드래그해 복사(Ctrl+C)한 뒤 여기에 붙여넣으면 신규 고객만 골라 자동 요약 등록됩니다."
                    className={`w-full p-2.5 rounded-xl border text-xs ${inputSurface}`}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteImport}
                      className="flex-1 py-2.5 rounded-xl bg-[#18181B] dark:bg-sky-500 text-white dark:text-slate-950 font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      <span>붙여넣은 내용 즉시 반영</span>
                    </button>
                    <input
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => csvFileInputRef.current?.click()}
                      className={`px-3.5 py-2.5 rounded-xl border font-black flex items-center gap-1.5 cursor-pointer ${cardSurface}`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>CSV 파일</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'security' && (
              <div className="space-y-3 text-xs">
                <div className={`rounded-2xl border p-3.5 space-y-2 ${subSurface}`}>
                  <div className="font-black flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span>타 직원 완벽 차단 · 나만 보기 작동 방식</span>
                  </div>
                  <p className="opacity-80 leading-relaxed">
                    • 다른 직원이 이 앱을 다운받아 설치하거나 실행해도 <strong>DB관리 메뉴 버튼 자체가 화면·전체메뉴·검색 어디에도 전혀 나타나지 않습니다.</strong>
                    <br />• 오직 국지현님 기기에서 상단 <strong>[홈] 버튼을 연속 5번 터치</strong>(또는 검색창에 <code>#{getOwnerDbPin()}</code> 입력)하여 비밀번호를 입력했을 때만 활성화됩니다.
                  </p>

                  <label className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10 cursor-pointer">
                    <span className="font-extrabold">
                      내가 직접 상담·계약한 건을 자동으로 내 고객관리(CRM) 카드에 생성
                    </span>
                    <input
                      type="checkbox"
                      checked={store.config.autoSaveCrmOnConvert}
                      onChange={(e) =>
                        commitStore((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            autoSaveCrmOnConvert: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 accent-indigo-600"
                    />
                  </label>
                </div>

                <div className={`rounded-2xl border p-3.5 space-y-2 ${subSurface}`}>
                  <label className="font-black block">
                    전용 잠금 비밀번호 변경 (현재: {getOwnerDbPin()})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      placeholder="새 숫자 4~8자리 입력"
                      className={`flex-1 px-3 py-2 rounded-xl border font-mono ${inputSurface}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (setOwnerDbPin(newPinInput)) {
                          setNewPinInput('');
                          showToast('전용 비공개 비밀번호가 변경되었습니다.');
                        } else {
                          showToast('4자리 이상 입력해 주세요.');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black cursor-pointer"
                    >
                      변경
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 모달 3: 수동 DB 고객 빠른 추가 ==================== */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className={`w-full sm:max-w-md max-h-[90dvh] overflow-y-auto modal-kb-safe rounded-t-3xl sm:rounded-3xl border p-5 space-y-3 shadow-2xl ${cardSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black">
                ➕ 인스타/마케팅 DB 고객 직접 추가
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-extrabold block mb-1">초기 배정 단계</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewLeadIsHandover(false)}
                    className={`py-2 rounded-xl border text-xs font-black cursor-pointer ${
                      !newLeadIsHandover
                        ? 'bg-rose-600 text-white border-rose-600'
                        : subSurface
                    }`}
                  >
                    🔥 신규 (내가 직접 상담)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLeadIsHandover(true)}
                    className={`py-2 rounded-xl border text-xs font-black cursor-pointer ${
                      newLeadIsHandover
                        ? 'bg-amber-600 text-white border-amber-600'
                        : subSurface
                    }`}
                  >
                    ↪ 타직원인계
                  </button>
                </div>
              </div>
              {newLeadIsHandover && (
                <div>
                  <label className="font-extrabold block mb-1">
                    인계 담당 직원 선택
                  </label>
                  <select
                    value={newLeadHandoverStaff}
                    onChange={(e) => setNewLeadHandoverStaff(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
                  >
                    <option value={UNASSIGNED_HANDOVER_STAFF}>
                      ↪ {UNASSIGNED_HANDOVER_STAFF}
                    </option>
                    {staffOptions.map((st) => (
                      <option key={st.name} value={st.name}>
                        👤 {st.name} ({st.role} ·{' '}
                        {st.isOffToday ? `오늘휴무[${st.todayCode}]` : '오늘근무'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="font-extrabold block mb-1">유입 플랫폼</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['인스타그램', '페이스북'] as const).map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setNewLeadPlatform(plat)}
                      className={`py-2 rounded-xl border text-xs font-black cursor-pointer ${
                        newLeadPlatform === plat
                          ? plat === '페이스북'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-pink-600 text-white border-pink-600'
                          : subSurface
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-extrabold block mb-1">고객명</label>
                <input
                  type="text"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="예: 김민지"
                  className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
                />
              </div>
              <div>
                <label className="font-extrabold block mb-1">연락처</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono font-bold ${inputSurface}`}
                />
              </div>
              <div>
                <label className="font-extrabold block mb-1">희망 혜택 / 품목</label>
                <input
                  type="text"
                  value={newLeadBenefit}
                  onChange={(e) => setNewLeadBenefit(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
                />
              </div>
              <div>
                <label className="font-extrabold block mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={newLeadMemo}
                  onChange={(e) => setNewLeadMemo(e.target.value)}
                  placeholder="예: DM 문의 병행 고객"
                  className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddManualLead}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black cursor-pointer"
            >
              DB 목록에 추가하기
            </button>
          </div>
        </div>
      )}

      {/* ==================== 모달 4: DB관리 위에서 바로 열리는 고객 요약/상세 카드 (X 닫기 시 DB관리 화면 100% 그대로 유지!) ==================== */}
      <CustomerDetailModal
        customer={inlineSelectedCustomer}
        onClose={() => setInlineDetailCustomerId(null)}
        onStatusChange={handleInlineCrmStatusChange}
        onMemoChange={handleInlineCrmMemoChange}
        onFieldChange={handleInlineCrmFieldChange}
        onDeleteQuoteRecord={handleInlineDeleteQuoteRecord}
        onApplyQuoteAsPrimary={handleInlineApplyQuoteAsPrimary}
        onLoadQuoteRecord={(cust, quote) => {
          setInlineDetailCustomerId(null);
          if (onOpenQuoteRecordInQuoteBuilder) {
            onOpenQuoteRecordInQuoteBuilder(cust, quote);
          } else {
            onOpenCustomerInQuoteBuilder(cust);
          }
        }}
        onDelete={handleInlineDeleteCustomer}
        onOpenSMS={(cust) => setInlineSmsCustomer(cust)}
        onOpenQuote={(cust) => {
          setInlineDetailCustomerId(null);
          onOpenCustomerInQuoteBuilder(cust);
        }}
      />

      <SMSModal
        customer={inlineSmsCustomer}
        onClose={() => setInlineSmsCustomer(null)}
        onMarkSent={(customerId) => {
          const target = crmCustomers.find((c) => c.id === customerId);
          if (target && target.status === '신규/미발송') {
            handleInlineCrmStatusChange(customerId, '발송완료');
          }
        }}
      />
    </div>
  );
};

export default MarketingDbManagerView;
