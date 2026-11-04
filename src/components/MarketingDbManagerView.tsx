import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Coins,
  Copy,
  CreditCard,
  Image as ImageIcon,
  Share2,
  Database,
  ExternalLink,
  EyeOff,
  FileSpreadsheet,
  Lock,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  buildLeadAutoSummary,
  copyBusinessCardImageToClipboard,
  DEFAULT_INSTA_SHEET_URL,
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

export interface MarketingDbManagerViewProps {
  onBackToHome: () => void;
  onLockAndHideMenu: () => void;
  onOpenCustomerInCrm: (customerId?: string) => void;
  onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
  onOpenQuoteRecordInQuoteBuilder?: (
    customer: CustomerItem,
    quote: QuoteRecord
  ) => void;
  isDark?: boolean;
}

type StatusFilterTab = '전체' | MarketingLeadStatus | '휴지통';

function getStatusBadgeStyle(status: MarketingLeadStatus, isDark: boolean): string {
  switch (status) {
    case '신규접수':
      return isDark
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-rose-50 text-rose-700 border-rose-300';
    case '문자전송':
      return isDark
        ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
        : 'bg-blue-50 text-blue-700 border-blue-300';
    case '상담전환':
      return isDark
        ? 'bg-violet-500/20 text-violet-300 border-violet-400/40'
        : 'bg-violet-50 text-violet-800 border-violet-300';
    case '무응답':
      return isDark
        ? 'bg-slate-500/20 text-slate-300 border-slate-400/35'
        : 'bg-stone-100 text-stone-600 border-stone-300';
    case '계약완료':
      return isDark
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50'
        : 'bg-emerald-50 text-emerald-800 border-emerald-400';
  }
}

function getStatusActiveBtnStyle(status: MarketingLeadStatus): string {
  switch (status) {
    case '신규접수':
      return 'bg-rose-600 text-white border-rose-600 shadow-2xs';
    case '문자전송':
      return 'bg-blue-600 text-white border-blue-600 shadow-2xs';
    case '상담전환':
      return 'bg-violet-600 text-white border-violet-600 shadow-2xs';
    case '무응답':
      return 'bg-stone-600 text-white border-stone-600 shadow-2xs';
    case '계약완료':
      return 'bg-emerald-600 text-white border-emerald-600 shadow-2xs';
  }
}

export const MarketingDbManagerView: React.FC<MarketingDbManagerViewProps> = ({
  onBackToHome,
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

  // 필터 상태
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [statusTab, setStatusTab] = useState<StatusFilterTab>('전체');
  const [handoverFilter, setHandoverFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 다중 선택 삭제 모드
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  // 카드별 명함 동봉 선택 상태: 신규접수는 기본 true(자동), 나머지 상태는 기본 false(선택사항)
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
  const [newLeadPlatform, setNewLeadPlatform] = useState<'인스타그램' | '페이스북'>('인스타그램');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadBenefit, setNewLeadBenefit] = useState(
    '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)'
  );
  const [newLeadContact, setNewLeadContact] = useState(
    '비대면 카톡/문자/전화로 견적 먼저 받기'
  );
  const [newLeadMemo, setNewLeadMemo] = useState('');

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
    }, 3200);
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
      if (hydrated.config.gasWebAppUrl?.trim()) {
        syncLeadsFromGoogleSheet(hydrated).then((res) => {
          if (mounted && res.ok) {
            setStore(res.nextStore);
            if (res.addedCount > 0) {
              showToast(res.message);
            }
          }
        });
      }
    });
    setStaffOptions(loadHandoverStaffOptions());
    setCrmCustomers(getCachedCustomers());
    return () => {
      mounted = false;
    };
  }, []);

  // Apps Script 연동되어 있을 때 60초 주기 백그라운드 자동 감지
  useEffect(() => {
    if (!store.config.gasWebAppUrl?.trim()) return;
    const timer = setInterval(() => {
      syncLeadsFromGoogleSheet(loadMarketingDbStore()).then((res) => {
        if (res.ok && (res.addedCount > 0 || res.updatedCount > 0)) {
          setStore(res.nextStore);
          if (res.addedCount > 0) {
            showToast(res.message);
          }
        }
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [store.config.gasWebAppUrl]);

  // 백그라운드 복귀(문자/카톡/전화 후 복귀) 및 CRM 데이터 변동 시 즉시 최신화
  useEffect(() => {
    const refreshLatest = () => {
      setCrmCustomers(getCachedCustomers());
      setStaffOptions(loadHandoverStaffOptions());
      setStore(loadMarketingDbStore());
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshLatest();
      }
    };
    window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshLatest);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshLatest);
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

  // CRM 매칭 맵 (이미 고객관리 카드에 등록된 고객인지 실시간 판별)
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

  // 월별 필터링된 리드 목록
  const monthFilteredLeads = useMemo(() => {
    if (selectedMonth === 'ALL') return activeLeads;
    return activeLeads.filter((l) => l.yearMonth === selectedMonth);
  }, [activeLeads, selectedMonth]);

  // 상단 KPI & 발생매출 합계 통계
  const stats = useMemo(() => {
    const allTimeContractLeads = activeLeads.filter(
      (l) => l.status === '계약완료'
    );
    const allTimeRevenue = allTimeContractLeads.reduce(
      (sum, l) => sum + (Number(l.revenueAmount) || 0),
      0
    );

    const statusCounts: Record<MarketingLeadStatus, number> = {
      신규접수: 0,
      문자전송: 0,
      상담전환: 0,
      무응답: 0,
      계약완료: 0,
    };

    let periodRevenue = 0;
    let directRevenue = 0;
    let handoverRevenue = 0;
    let handoverCount = 0;

    for (const l of monthFilteredLeads) {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      if (l.handoverStaff) handoverCount++;
      if (l.status === '계약완료') {
        const rev = Number(l.revenueAmount) || 0;
        periodRevenue += rev;
        if (l.handoverStaff) handoverRevenue += rev;
        else directRevenue += rev;
      }
    }

    const totalPeriod = monthFilteredLeads.length;
    const responseOrHigher =
      statusCounts['상담전환'] + statusCounts['계약완료'];
    const conversionRate =
      totalPeriod > 0
        ? ((statusCounts['계약완료'] / totalPeriod) * 100).toFixed(1)
        : '0.0';
    const responseRate =
      totalPeriod > 0
        ? ((responseOrHigher / totalPeriod) * 100).toFixed(1)
        : '0.0';

    return {
      totalPeriod,
      statusCounts,
      periodRevenue,
      allTimeRevenue,
      directRevenue,
      handoverRevenue,
      handoverCount,
      conversionRate,
      responseRate,
    };
  }, [activeLeads, monthFilteredLeads]);

  // 최종 화면 표시 리드 목록
  const visibleLeads = useMemo(() => {
    const base =
      statusTab === '휴지통'
        ? trashedLeads
        : statusTab === '전체'
        ? monthFilteredLeads
        : monthFilteredLeads.filter((l) => l.status === statusTab);

    return base.filter((l) => {
      if (handoverFilter === 'DIRECT' && l.handoverStaff) return false;
      if (handoverFilter === 'HANDOVER_ONLY' && !l.handoverStaff) return false;
      if (
        handoverFilter !== 'ALL' &&
        handoverFilter !== 'DIRECT' &&
        handoverFilter !== 'HANDOVER_ONLY' &&
        l.handoverStaff !== handoverFilter
      ) {
        return false;
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
    monthFilteredLeads,
    handoverFilter,
    searchQuery,
  ]);

  // ==================== 핵심 액션 핸들러 ====================

  const handleManualSheetSync = async () => {
    setIsSyncing(true);
    const res = await syncLeadsFromGoogleSheet(store);
    setStore(res.nextStore);
    setIsSyncing(false);
    showToast(res.message);
    if (!res.ok) {
      setSettingsTab('sheet');
      setIsSettingsOpen(true);
    }
  };

  const handleChangeStatus = async (
    lead: MarketingLeadItem,
    nextStatus: MarketingLeadStatus
  ) => {
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === lead.id ? { ...item, status: nextStatus } : item
      ),
    }));

    // 상담전환 또는 계약완료 전환 시 옵션이 켜져 있으면 고객관리(CRM) 카드에도 자동 저장/갱신
    if (
      store.config.autoSaveCrmOnConvert &&
      (nextStatus === '상담전환' || nextStatus === '계약완료')
    ) {
      const updatedLead: MarketingLeadItem = { ...lead, status: nextStatus };
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
        `${lead.customerName} 고객님 상태 [${nextStatus}] 반영 및 고객관리 카드 자동 동기화 완료!`
      );
    }
  };

  const handleChangeHandoverStaff = (
    leadId: string,
    staffName: string
  ) => {
    const found = staffOptions.find((s) => s.name === staffName);
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((item) =>
        item.id === leadId
          ? {
              ...item,
              handoverStaff: staffName,
              handoverStaffRole: found?.role || undefined,
              handoverAt: staffName ? nowStamp : undefined,
            }
          : item
      ),
    }));
    if (staffName) {
      showToast(`인계 확인 기록됨: ${staffName}${found?.role ? ` (${found.role})` : ''}`);
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
    const { savedCustomer } = await saveMarketingLeadToCrm(lead, { syncRevenue: true });
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
      `${lead.customerName} 고객님의 발생매출(${lead.revenueAmount.toLocaleString()}원)이 고객관리 카드에도 반영되었습니다!`
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

  // 신규접수 고객은 명함 동봉이 기본 ON(자동), 나머지 상태 고객은 기본 OFF(선택 시 ON)
  const isCardAttachedForLead = (lead: MarketingLeadItem): boolean => {
    if (lead.id in cardAttachOverrides) {
      return cardAttachOverrides[lead.id];
    }
    return lead.status === '신규접수';
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
              status: item.status === '신규접수' ? '문자전송' : item.status,
              smsSentAt: nowStamp,
            }
          : item
      ),
    }));
  };

  // 방식 A: 문자앱 바로열기 (수신번호+본문 100% 자동입력, 명함 동봉 ON이면 클립보드에 명함 이미지 자동 복사!)
  const triggerNativeSmsSend = async (
    lead: MarketingLeadItem,
    bodyText: string,
    includeBusinessCard: boolean
  ) => {
    if (includeBusinessCard) {
      const cardUri = getEffectiveBusinessCardDataUri(store.config);
      const imgCopied = await copyBusinessCardImageToClipboard(cardUri);
      if (imgCopied) {
        showToast(
          '🪪 명함 사진이 키보드 클립보드에 자동 복사되었습니다! 문자창에서 붙여넣기(1터치)로 함께 전송하세요.'
        );
      } else {
        await safeCopyText(bodyText);
      }
    } else {
      await safeCopyText(bodyText);
    }

    markLeadSmsSent(lead);

    const cleanPhone = (lead.phone || '').replace(/[^0-9+]/g, '');
    const encoded = encodeURIComponent(bodyText);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const sep = isIOS ? '&' : '?';
    window.location.href = cleanPhone
      ? `sms:${cleanPhone}${sep}body=${encoded}`
      : `sms:${sep}body=${encoded}`;
  };

  // 방식 B: OS 공유창(MMS/카톡)으로 명함 이미지 파일 + 문자 본문을 한 번에 첨부 전달 (전화번호 자동 복사)
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
      // PC 등 파일 공유 미지원 브라우저에서는 자동으로 클립보드 명함 복사 + 문자앱 실행으로 폴백
      await triggerNativeSmsSend(lead, bodyText, true);
    }
  };

  const handleQuickSendDefaultSms = async (lead: MarketingLeadItem) => {
    const rendered = getDefaultRenderedTextForLead(lead);
    const withCard = isCardAttachedForLead(lead);
    if (withCard && store.config.businessCardSendMethod === 'share-sheet') {
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

  // 원터치 고객관리(CRM) 카드 저장 / 열기 (고객관리열기는 DB관리 화면 위에서 바로 모달 오픈 -> X 누르면 DB관리 그대로 유지!)
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
      await saveMarketingLeadToCrm(lead);
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
          : `${lead.customerName} 고객님이 VIP 고객관리에 새 카드로 저장되었습니다!`
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
    const updated = crmCustomers.map((c) =>
      c.id === id ? { ...c, deletedAt } : c
    );
    const deduped = setCachedCustomers(updated);
    setCrmCustomers(deduped);
    setInlineDetailCustomerId(null);
    showToast('고객카드가 고객관리 휴지통으로 이동되었습니다.');
    await syncCustomerToGas('update', { id, deletedAt });
  };

  // 개별 / 선택 고객 삭제 (시트 재동기화 부활 차단 지문 등록)
  const handleSoftDeleteLeads = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const nowMs = Date.now();
    commitStore((prev) => {
      const extraFingerprints: string[] = [];
      const nextLeads = prev.leads.map((l) => {
        if (!idSet.has(l.id)) return l;
        extraFingerprints.push(l.fingerprint);
        if (l.phone) {
          extraFingerprints.push(
            `ph_${l.phone.replace(/\D/g, '')}__${l.createdAt.slice(0, 10)}`
          );
        }
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
    setSelectedIds([]);
    setIsSelectMode(false);
    showToast(
      `${ids.length}명의 DB가 삭제(휴지통 이동)되었습니다. 시트 동기화 시에도 다시 뜨지 않습니다.`
    );
  };

  const handleRestoreLead = (lead: MarketingLeadItem) => {
    const phKey = `ph_${lead.phone.replace(/\D/g, '')}__${lead.createdAt.slice(
      0,
      10
    )}`;
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === lead.id ? { ...l, deletedAt: undefined } : l
      ),
      deletedFingerprints: (prev.deletedFingerprints || []).filter(
        (fp) => fp !== lead.fingerprint && fp !== phKey
      ),
    }));
    showToast(`${lead.customerName} 고객님 DB가 복원되었습니다.`);
  };

  const handlePermanentPurgeLead = (leadId: string) => {
    commitStore((prev) => ({
      ...prev,
      leads: prev.leads.filter((l) => l.id !== leadId),
    }));
    showToast('영구 삭제되었습니다 (시트 재유입 차단은 유지됩니다).');
  };

  // 수동 DB 고객 등록
  const handleAddManualLead = () => {
    if (!newLeadName.trim() && !newLeadPhone.trim()) return;
    const phone = normalizeKoreanLeadPhone(newLeadPhone);
    const { createdAt, yearMonth } = normalizeLeadDateTime();
    const name = newLeadName.trim() || '인스타 고객';
    const fp = makeLeadFingerprint(name, phone, createdAt, `manual_${Date.now()}`);
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
      status: '신규접수',
      handoverStaff: '',
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
    showToast(`${name} 고객님이 DB관리 목록에 추가되었습니다.`);
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
              <span>홈</span>
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
              onClick={() => setIsAddModalOpen(true)}
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

        {/* ==================== 2. 상단 KPI & 계약완료 발생매출 합계 보드 ==================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              {selectedMonth === 'ALL'
                ? '전체 유입 DB'
                : `${formatMonthLabel(selectedMonth)} 유입 DB`}
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono">
              {stats.totalPeriod}명
            </div>
            <div className="text-[11px] font-bold text-rose-500">
              미발송 신규 {stats.statusCounts['신규접수']}건 · 문자전송{' '}
              {stats.statusCounts['문자전송']}건
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              상담전환 · 무응답 현황
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-violet-600 dark:text-violet-300">
              {stats.statusCounts['상담전환']}명
            </div>
            <div className="text-[11px] font-bold opacity-75">
              상담전환 {stats.statusCounts['상담전환']} · 무응답{' '}
              {stats.statusCounts['무응답']} (전환반응 {stats.responseRate}%)
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-1 ${cardSurface}`}>
            <div className="text-[11px] font-extrabold opacity-70">
              계약완료 전환 · 직원 인계
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-300">
              {stats.statusCounts['계약완료']}건{' '}
              <span className="text-xs font-extrabold">
                ({stats.conversionRate}%)
              </span>
            </div>
            <div className="text-[11px] font-bold opacity-75">
              직원 인계 확인용 매칭: {stats.handoverCount}명
            </div>
          </div>

          {/* 핵심: 계약완료 발생매출 총합계 보드 */}
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
                    ? '계약완료 발생매출 총합계'
                    : `${formatMonthLabel(selectedMonth)} 발생매출 합계`}
                </span>
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 truncate">
              {stats.periodRevenue.toLocaleString()}원
            </div>
            <div className="text-[10.5px] font-bold opacity-80 truncate">
              {selectedMonth === 'ALL'
                ? stats.handoverRevenue > 0
                  ? `직접 ${stats.directRevenue.toLocaleString()}원 · 인계 ${stats.handoverRevenue.toLocaleString()}원`
                  : '계약완료 고객 입력 매출 실시간 합산'
                : `전체 누적 총매출: ${stats.allTimeRevenue.toLocaleString()}원`}
            </div>
          </div>
        </div>

        {/* ==================== 3. 상태별 탭 & 검색 · 인계필터 · 선택삭제 바 ==================== */}
        <div className={`rounded-2xl border p-3 space-y-2.5 ${cardSurface}`}>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { id: '전체', label: `전체 (${monthFilteredLeads.length})` },
                {
                  id: '신규접수',
                  label: `🔥신규접수 (${stats.statusCounts['신규접수']})`,
                },
                {
                  id: '문자전송',
                  label: `📩문자전송 (${stats.statusCounts['문자전송']})`,
                },
                {
                  id: '상담전환',
                  label: `🤝상담전환 (${stats.statusCounts['상담전환']})`,
                },
                {
                  id: '무응답',
                  label: `⏳무응답 (${stats.statusCounts['무응답']})`,
                },
                {
                  id: '계약완료',
                  label: `🎉계약완료 (${stats.statusCounts['계약완료']})`,
                },
                { id: '휴지통', label: `🗑️휴지통 (${trashedLeads.length})` },
              ] as { id: StatusFilterTab; label: string }[]
            ).map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border whitespace-nowrap cursor-pointer transition ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : `${subSurface} opacity-85 hover:opacity-100`
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고객명 · 연락처 · 요약내용 · 메모 · 인계직원 검색"
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

            <div className="flex items-center gap-2">
              <select
                value={handoverFilter}
                onChange={(e) => setHandoverFilter(e.target.value)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border text-base sm:text-xs font-extrabold ${inputSurface}`}
              >
                <option value="ALL">👤 상담/인계 전체</option>
                <option value="DIRECT">국지현 직접상담만</option>
                <option value="HANDOVER_ONLY">직원 인계건만 모아보기</option>
                {staffOptions.map((st) => (
                  <option key={st.name} value={st.name}>
                    인계: {st.name} ({st.role})
                  </option>
                ))}
              </select>

              {statusTab !== '휴지통' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectMode((v) => !v);
                    setSelectedIds([]);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-black whitespace-nowrap cursor-pointer ${
                    isSelectMode
                      ? 'bg-rose-600 text-white border-rose-600'
                      : subSurface
                  }`}
                >
                  {isSelectMode ? '선택취소' : '선택삭제'}
                </button>
              )}

              {isSelectMode && selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSoftDeleteLeads(selectedIds)}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black whitespace-nowrap cursor-pointer"
                >
                  {selectedIds.length}명 삭제
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==================== 4. 고객 DB 카드 리스트 ==================== */}
        {visibleLeads.length === 0 ? (
          <div
            className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}
          >
            <Database className="w-8 h-8 mx-auto opacity-40" />
            <div className="text-sm font-black">
              조건에 해당하는 인스타 광고 DB 고객이 없습니다.
            </div>
            <p className="text-xs opacity-70">
              상단 [시트 동기화] 또는 [직접추가] 버튼으로 새 DB를 불러올 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleLeads.map((lead) => {
              const linkedCrm = findLinkedCrmCustomer(lead);
              const isChecked = selectedIds.includes(lead.id);

              return (
                <div
                  key={lead.id}
                  className={`rounded-3xl border p-4 space-y-3 shadow-2xs transition ${
                    lead.status === '계약완료'
                      ? isDark
                        ? 'bg-[#13221E] border-emerald-500/45'
                        : 'bg-white border-2 border-emerald-500'
                      : cardSurface
                  }`}
                >
                  {/* 1) 고객명 · 전화번호 · 접수일시 · 삭제 버튼 */}
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
                          className="mt-1 w-4 h-4 accent-rose-600 cursor-pointer shrink-0"
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
                          {linkedCrm && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                              ✓ 고객관리 연동됨
                            </span>
                          )}
                          {lead.handoverStaff && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-400/40 text-[10px] font-black">
                              ↪ 인계: {lead.handoverStaff}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                          {lead.phone ? (
                            <a
                              href={`tel:${lead.phone.replace(/\D/g, '')}`}
                              className="font-mono font-black text-blue-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{lead.phone}</span>
                            </a>
                          ) : (
                            <span className="opacity-50 text-xs">연락처 없음</span>
                          )}
                          <span className="text-[11px] font-mono opacity-65">
                            · {lead.platform || '인스타그램'} · 접수 {lead.createdAt}
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
                      placeholder="진행/상담 요약 메모 입력 (예: 12월 입주, 냉장고·세탁기 견적 희망)"
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
                    />
                  </div>

                  {statusTab !== '휴지통' && (
                    <>
                      {/* 3) 상태 변경 버튼 (신규접수 / 문자전송 / 상담전환 / 무응답 / 계약완료) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold opacity-75">
                          <span>진행 상태 변경</span>
                          {lead.smsSentAt && (
                            <span className="font-mono text-[10px]">
                              최근 문자: {lead.smsSentAt}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 min-[380px]:grid-cols-5 gap-1">
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

                      {/* 4) 계약완료 시 발생매출 입력 박스 */}
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
                              <span>계약완료 발생매출 입력</span>
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
                            <button
                              type="button"
                              onClick={() => handleSyncRevenueToCrm(lead)}
                              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black whitespace-nowrap cursor-pointer shrink-0"
                            >
                              고객카드 매출반영
                            </button>
                          </div>

                          {lead.revenueAmount > 0 && (
                            <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 text-right font-mono">
                              입력 매출: {lead.revenueAmount.toLocaleString()}원 (
                              {(lead.revenueAmount / 10000).toLocaleString()}만원)
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5) 직원 인계 매칭 (휴무표 내 '미화' 제외 직원 목록 연동 · 인계 확인용) */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] font-extrabold opacity-75 flex items-center gap-1 shrink-0">
                          <Users className="w-3.5 h-3.5 text-amber-500" />
                          <span>상담 인계 확인용:</span>
                        </span>
                        <select
                          value={lead.handoverStaff || ''}
                          onChange={(e) =>
                            handleChangeHandoverStaff(lead.id, e.target.value)
                          }
                          className={`flex-1 max-w-[240px] px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
                        >
                          <option value="">직접 상담 (인계 안 함)</option>
                          {staffOptions.map((st) => (
                            <option key={st.name} value={st.name}>
                              {st.name} ({st.role} ·{' '}
                              {st.isOffToday
                                ? `오늘휴무[${st.todayCode}]`
                                : '오늘근무'}
                              )
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 6) 명함 동봉 컨트롤 바 (신규접수 = 기본 자동 ON / 그 외 상태 = 선택사항 토글) */}
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
                            {lead.status === '신규접수' ? (
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
                          )}
                        </div>

                        {/* 하단 원터치 실행 버튼 (폴드 커버 등 초소형 320px 화면 2x2 자동배열 보호) */}
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
            <div className="flex items-center justify-between">
              <div className="font-black text-sm sm:text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>{smsPreviewLead.customerName} 고객님 문자 발송</span>
              </div>
              <button
                type="button"
                onClick={() => setSmsPreviewLead(null)}
                className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
                      ({smsPreviewLead.status === '신규접수' ? '신규고객 자동 ON' : '선택사항'})
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
                {/* 등록된 내 명함 미리보기 & 원터치 발송 방식 설정 */}
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
                            id: 'sms-clipboard' as const,
                            label:
                              '① 문자앱 바로열기 (수신번호·본문 자동입력 + 명함 클립보드 복사)',
                          },
                          {
                            id: 'share-sheet' as const,
                            label:
                              '② 명함파일 직접첨부 공유창 (명함파일+본문 첨부 · 번호 자동복사)',
                          },
                        ].map((opt) => {
                          const active =
                            (store.config.businessCardSendMethod ||
                              'sms-clipboard') === opt.id;
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
                  • 카드 하단 <strong>[정해진 문자발송]</strong> 버튼을 누르면 아래에서 기본으로 지정한 문구가 자동으로 채워져 문자앱이 열립니다.
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
                <div className={`rounded-2xl border p-3.5 space-y-2.5 ${subSurface}`}>
                  <div className="font-black text-indigo-600 dark:text-sky-300">
                    ① [권장 · 시트 비공개 유지] 실시간 자동연동 &amp; 폰↔PC 백업 연결
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    고객 전화번호 보호를 위해 시트를 [전체 공개]로 풀지 않고도, 시트 안의 <strong>Apps Script</strong>에 아래 전용 코드를 1회만 붙여넣어 배포하시면 시트에 고객이 들어올 때마다 자동 요약 유입 + 폰/PC 간 상태·매출 동기화가 작동합니다.
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
                        onClick={() => {
                          commitStore((prev) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              gasWebAppUrl: gasUrlInput.trim(),
                              sheetCsvOrShareUrl: sheetUrlInput.trim(),
                            },
                          }));
                          showToast('실시간 시트 연동 주소가 저장되었습니다!');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-black cursor-pointer shrink-0"
                      >
                        저장
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
                      상담전환 · 계약완료 변경 시 자동으로 고객관리(CRM) 카드 생성
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
