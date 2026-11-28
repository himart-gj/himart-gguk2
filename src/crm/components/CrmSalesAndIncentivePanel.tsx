import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Eye,
  EyeOff,
  Gift,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Link2,
  Cloud,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Repeat,
  Save,
  ShieldCheck,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { CrmModelIncentiveTabSection } from './CrmModelIncentiveTabSection';
import {
  getCrmIncentiveBarHiddenPref,
  getHideIncentiveAmountsPref,
  hydrateUiVisibilityPrefsFromIdb,
  setCrmIncentiveBarHiddenPref,
  setHideIncentiveAmountsPref,
  UI_VISIBILITY_UPDATED_EVENT,
} from '../../utils/uiVisibilityPrefs';
import { GiftCardRewardDetailModal } from './GiftCardRewardDetailModal';
import {
  AllCareQuarterOverridesMap,
  computeMonthlyGiftCardRewardReport,
  GIFT_CARD_REWARD_UPDATED_EVENT,
  hydrateAllCareQuarterOverridesFromIdb,
  loadAllCareQuarterOverrides,
} from '../utils/giftCardRewardEngine';
import {
  CustomerItem,
  ModelIncentiveRule,
  ModelIncentivesMap,
  SettlementTabId,
} from '../types/crm';
import { formatCurrency, formatShortManwon } from '../utils/date';
import {
  ALLCARE_COUNT_UPDATED_EVENT,
  computeMonthlySettlementReport,
  ConfirmedCustomerSettlementRow,
  getMonthlyAllCareCount,
  hydrateMonthlyAllCareCountsFromIdb,
  loadAllMonthlyAllCareCounts,
  MonthlyAllCareCountsMap,
  setMonthlyAllCareCount,
  fetchRemoteModelIncentiveSheets,
  getCurrentYearMonth,
  hydrateModelIncentiveSheetsFromIdb,
  IncentiveMonthBasis,
  isGenericNonModelLabel,
  loadAllModelIncentiveSheets,
  MODEL_INCENTIVE_UPDATED_EVENT,
  parseIncentiveAmountCell,
  parseModelIncentiveFreeText,
  saveAllModelIncentiveSheets,
  upsertMonthlyIncentiveSheet,
} from '../utils/settlementEngine';

interface CrmSalesAndIncentivePanelProps {
  customers: CustomerItem[];
  isDark: boolean;
  selectedYearMonth: string;
  onChangeYearMonth: (ym: string) => void;
  activeTab: SettlementTabId;
  onChangeTab: (tab: SettlementTabId) => void;
  onSelectCustomer: (customer: CustomerItem) => void;
  onFieldChange?: (id: string, patch: Partial<CustomerItem>) => void;
  onShowToast?: (msg: string) => void;
  defaultExpanded?: boolean;
}

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y || new Date().getFullYear(), (m || 1) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatYearMonthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${String(y).slice(2)}.${String(m).padStart(2, '0')}월`;
}

function formatYearMonthKo(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${y}년 ${m}월`;
}

export const CrmSalesAndIncentivePanel: React.FC<
  CrmSalesAndIncentivePanelProps
> = ({
  customers,
  isDark,
  selectedYearMonth,
  onChangeYearMonth,
  activeTab,
  onChangeTab,
  onSelectCustomer,
  onFieldChange,
  onShowToast,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isIncentiveBarHidden, setIsIncentiveBarHidden] = useState<boolean>(() =>
    defaultExpanded ? false : getCrmIncentiveBarHiddenPref()
  );
  const [hideIncentiveAmounts, setHideIncentiveAmounts] = useState<boolean>(() =>
    getHideIncentiveAmountsPref()
  );

  useEffect(() => {
    void hydrateUiVisibilityPrefsFromIdb();
    const syncPrefs = () => {
      setIsIncentiveBarHidden(getCrmIncentiveBarHiddenPref());
      setHideIncentiveAmounts(getHideIncentiveAmountsPref());
    };
    window.addEventListener(UI_VISIBILITY_UPDATED_EVENT, syncPrefs);
    window.addEventListener('storage', syncPrefs);
    return () => {
      window.removeEventListener(UI_VISIBILITY_UPDATED_EVENT, syncPrefs);
      window.removeEventListener('storage', syncPrefs);
    };
  }, []);

  const handleToggleIncentiveBarHidden = () => {
    const next = !isIncentiveBarHidden;
    setIsIncentiveBarHidden(next);
    setHideIncentiveAmounts(next);
    setCrmIncentiveBarHiddenPref(next);
    setHideIncentiveAmountsPref(next);
    if (next) {
      setIsExpanded(false);
    }
  };

  const handleToggleHideIncentiveAmounts = () => {
    const next = !hideIncentiveAmounts;
    setHideIncentiveAmounts(next);
    setHideIncentiveAmountsPref(next);
  };
  const [incentiveBasis, setIncentiveBasis] =
    useState<IncentiveMonthBasis>('contract');
  const [salesSubView, setSalesSubView] = useState<
    'gross' | 'delivery' | 'subscription' | 'undated'
  >('gross');
  const [editingDeliveryRowId, setEditingDeliveryRowId] = useState<string | null>(null);
  const [editingDeliveryDateVal, setEditingDeliveryDateVal] = useState<string>('');

  const [allCareMap, setAllCareMap] = useState<MonthlyAllCareCountsMap>(() =>
    loadAllMonthlyAllCareCounts()
  );
  const [isEditingAllCare, setIsEditingAllCare] = useState<boolean>(false);
  const [isGiftCardModalOpen, setIsGiftCardModalOpen] = useState<boolean>(false);
  const [quarterOverridesMap, setQuarterOverridesMap] =
    useState<AllCareQuarterOverridesMap>(() => loadAllCareQuarterOverrides());
  const [allCareDraft, setAllCareDraft] = useState<string>('');

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true);
    }
  }, [defaultExpanded, activeTab]);

  const [sheetsMap, setSheetsMap] = useState<ModelIncentivesMap>(() =>
    loadAllModelIncentiveSheets()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [showManualDrawer, setShowManualDrawer] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [ruleSearch, setRuleSearch] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<string>('');
  const [manualModelCode, setManualModelCode] = useState<string>('');
  const [manualIncentive, setManualIncentive] = useState<string>('');
  const [bulkPasteText, setBulkPasteText] = useState<string>('');

  const [quickAssignTarget, setQuickAssignTarget] = useState<{
    modelCode: string;
    category: string;
  } | null>(null);
  const [quickAssignAmount, setQuickAssignAmount] = useState<string>('');

  useEffect(() => {
    hydrateModelIncentiveSheetsFromIdb().then((loaded) => {
      if (Object.keys(loaded).length > 0) {
        setSheetsMap(loaded);
      }
      fetchRemoteModelIncentiveSheets().then((remoteMerged) => {
        if (remoteMerged && Object.keys(remoteMerged).length > 0) {
          setSheetsMap(remoteMerged);
        }
      });
    });
    hydrateMonthlyAllCareCountsFromIdb().then((loadedAllCare) => {
      if (Object.keys(loadedAllCare).length > 0) {
        setAllCareMap(loadedAllCare);
      }
    });
    hydrateAllCareQuarterOverridesFromIdb().then((loadedOverrides) => {
      if (Object.keys(loadedOverrides).length > 0) {
        setQuarterOverridesMap(loadedOverrides);
      }
    });
    const sync = () => setSheetsMap(loadAllModelIncentiveSheets());
    const syncAllCare = () => {
      setAllCareMap(loadAllMonthlyAllCareCounts());
      setQuarterOverridesMap(loadAllCareQuarterOverrides());
    };
    const syncStorage = () => {
      sync();
      syncAllCare();
    };
    window.addEventListener(MODEL_INCENTIVE_UPDATED_EVENT, sync);
    window.addEventListener(ALLCARE_COUNT_UPDATED_EVENT, syncAllCare);
    window.addEventListener(GIFT_CARD_REWARD_UPDATED_EVENT, syncAllCare);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener(MODEL_INCENTIVE_UPDATED_EVENT, sync);
      window.removeEventListener(ALLCARE_COUNT_UPDATED_EVENT, syncAllCare);
      window.removeEventListener(GIFT_CARD_REWARD_UPDATED_EVENT, syncAllCare);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  useEffect(() => {
    setIsEditingAllCare(false);
  }, [selectedYearMonth]);

  const currentSheet = sheetsMap[selectedYearMonth] || null;
  const prevYearMonth = shiftYearMonth(selectedYearMonth, -1);
  const prevSheet = sheetsMap[prevYearMonth] || null;

  const report = useMemo(
    () =>
      computeMonthlySettlementReport(
        customers,
        selectedYearMonth,
        currentSheet,
        incentiveBasis
      ),
    [customers, selectedYearMonth, currentSheet, incentiveBasis]
  );

  const giftCardReport = useMemo(
    () =>
      computeMonthlyGiftCardRewardReport(
        customers,
        selectedYearMonth,
        allCareMap,
        quarterOverridesMap
      ),
    [customers, selectedYearMonth, allCareMap, quarterOverridesMap]
  );

  const currentRealYm = getCurrentYearMonth();

  const filteredRules = useMemo(() => {
    const list = currentSheet?.rules || [];
    const q = ruleSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.modelCode.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.productName && r.productName.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q))
    );
  }, [currentSheet, ruleSearch]);

  const currentAllCareCount = getMonthlyAllCareCount(
    selectedYearMonth,
    allCareMap
  );

  const handleStepAllCare = (delta: number) => {
    const nextVal = Math.max(0, currentAllCareCount + delta);
    const updated = setMonthlyAllCareCount(selectedYearMonth, nextVal);
    setAllCareMap(updated);
  };

  const commitAllCareDraft = () => {
    const parsed = parseInt(allCareDraft.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed)) {
      const updated = setMonthlyAllCareCount(selectedYearMonth, parsed);
      setAllCareMap(updated);
    }
    setIsEditingAllCare(false);
  };

  const handleOpenOrToggleTab = (
    targetTab: SettlementTabId,
    subView?: 'gross' | 'delivery' | 'subscription'
  ) => {
    if (subView) {
      setSalesSubView(subView);
    }
    if (isExpanded && activeTab === targetTab && (!subView || salesSubView === subView)) {
      setIsExpanded(false);
    } else {
      onChangeTab(targetTab);
      setIsExpanded(true);
    }
  };

  const handleManualPullOrPush = async () => {
    setIsSyncingCloud(true);
    try {
      const pulled = await fetchRemoteModelIncentiveSheets();
      if (pulled) {
        setSheetsMap(pulled);
        onShowToast?.(
          '✅ 비공개 구글 시트에서 최신 공식 단가표를 불러왔습니다! (내 기기 추가 항목 보존됨)'
        );
      } else {
        onShowToast?.('현재 기기의 단가표가 최신 상태입니다.');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleAddSingleRule = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualModelCode.trim().toUpperCase();
    const amt = parseIncentiveAmountCell(manualIncentive, 1);
    if (!code) {
      const msg = '모델명(코드)을 입력해 주세요. (예: RM70F64M2X)';
      setUploadError(msg);
      onShowToast?.(`⚠️ ${msg}`);
      return;
    }
    if (isGenericNonModelLabel(code)) {
      const msg = '품목명("냉장고" 등)만으로는 등록할 수 없습니다. 정확한 모델코드를 입력해 주세요.';
      setUploadError(msg);
      onShowToast?.(`⚠️ ${msg}`);
      return;
    }
    if (amt <= 0) {
      const msg = '수당 금액을 입력해 주세요. (예: 50000 또는 5만)';
      setUploadError(msg);
      onShowToast?.(`⚠️ ${msg}`);
      return;
    }

    setUploadError(null);
    upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      [
        {
          id: `MAN-${Date.now()}`,
          category: manualCategory.trim() || '가전',
          modelCode: code,
          incentiveAmount: amt,
          saleTypeFilter: 'all',
          isPersonalLocal: true,
        },
      ],
      '내 기기 직접 입력',
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setManualModelCode('');
    setManualIncentive('');
    setShowRulesDrawer(true);
    setUploadSuccess(
      `✅ [${code}] 수당 ${formatCurrency(amt)}원이 내 기기에 저장되었습니다! (공식 시트 미전송)`
    );
    onShowToast?.(`✅ [${code}] 수당 ${formatCurrency(amt)}원 (내 기기 추가)`);
  };

  const handleBulkTextApply = () => {
    const trimmed = bulkPasteText.trim();
    const parsed = parseModelIncentiveFreeText(trimmed).map((r) => ({
      ...r,
      isPersonalLocal: true,
    }));
    if (parsed.length === 0) {
      const errMsg =
        '인식된 모델/수당이 없습니다. "RM70F64M2X 5만" 형태로 입력해 주세요.';
      setUploadError(errMsg);
      onShowToast?.(`⚠️ ${errMsg}`);
      return;
    }
    setUploadError(null);
    const next = upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      parsed,
      `내 기기 일괄 추가 (${parsed.length}건)`,
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setBulkPasteText('');
    setShowManualDrawer(false);
    setShowRulesDrawer(true);
    setUploadSuccess(
      `✅ ${parsed.length}개 모델을 내 기기에 추가했습니다! (총 ${next.rules.length}개 · 공식 시트 미전송)`
    );
    onShowToast?.(`✅ ${parsed.length}개 모델 내 기기 반영 완료`);
  };

  const handleQuickAssignSave = () => {
    if (!quickAssignTarget) return;
    const amt = parseIncentiveAmountCell(quickAssignAmount, 1);
    if (amt <= 0) {
      onShowToast?.('⚠️ 수당 금액을 숫자로 입력해 주세요. (예: 50000 또는 5만)');
      return;
    }
    const targetCode = quickAssignTarget.modelCode;
    upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      [
        {
          id: `QCK-${Date.now()}`,
          category: quickAssignTarget.category || '가전',
          modelCode: targetCode.trim().toUpperCase(),
          incentiveAmount: amt,
          saleTypeFilter: 'all',
          isPersonalLocal: true,
        },
      ],
      '내 기기 즉시 지정',
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setQuickAssignTarget(null);
    setQuickAssignAmount('');
    onShowToast?.(
      `💰 [${targetCode}] +${formatCurrency(amt)}원 (내 기기 전용 반영)`
    );
  };

  const handleUpdateRuleAmount = (ruleId: string, nextAmount: number) => {
    if (!currentSheet) return;
    const nextRules = currentSheet.rules.map((r) =>
      r.id === ruleId
        ? {
            ...r,
            incentiveAmount: Math.max(0, nextAmount),
            isPersonalLocal: true,
          }
        : r
    );
    const nextMap: ModelIncentivesMap = {
      ...sheetsMap,
      [selectedYearMonth]: {
        ...currentSheet,
        updatedAt: new Date().toISOString(),
        rules: nextRules,
      },
    };
    saveAllModelIncentiveSheets(nextMap, { skipServerSync: true });
    setSheetsMap(nextMap);
  };

  const handleRuleAmountBlur = () => {
    onShowToast?.('✏️ 수정된 단가가 내 기기에 저장되었습니다.');
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!currentSheet) return;
    const nextRules = currentSheet.rules.filter((r) => r.id !== ruleId);
    const nextMap: ModelIncentivesMap = {
      ...sheetsMap,
      [selectedYearMonth]: {
        ...currentSheet,
        updatedAt: new Date().toISOString(),
        rules: nextRules,
      },
    };
    saveAllModelIncentiveSheets(nextMap, { skipServerSync: true });
    setSheetsMap(nextMap);
    onShowToast?.('🗑️ 내 기기 목록에서 해당 모델 단가를 삭제했습니다.');
  };

  const shellCls = isDark
    ? 'bg-[#131C2E] border-slate-800 text-slate-100'
    : 'bg-white border-[#E5E8EB] text-[#191F28]';
  const subSurfaceCls = isDark
    ? 'bg-slate-900/70 border-slate-800 text-slate-100'
    : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]';
  const mutedCls = isDark ? 'text-slate-400' : 'text-[#4E5968]';

  const activeSalesRows: ConfirmedCustomerSettlementRow[] = useMemo(() => {
    if (salesSubView === 'delivery') return report.netDeliveryRows;
    if (salesSubView === 'subscription') return report.grossSubscriptionRows;
    if (salesSubView === 'undated') {
      return report.grossRows.filter((r) => !r.profile.deliveryYearMonth);
    }
    return report.grossRows;
  }, [salesSubView, report]);

  return (
    <section
      id="crm-sales-incentive-hub"
      className={`rounded-[20px] border px-3.5 py-2.5 shadow-2xs transition ${shellCls}`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-xl border ${subSurfaceCls}`}
            >
              <button
                type="button"
                onClick={() =>
                  onChangeYearMonth(shiftYearMonth(selectedYearMonth, -1))
                }
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                title="이전 달"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-xs font-black font-mono tabular-nums">
                {formatYearMonthShort(selectedYearMonth)}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeYearMonth(shiftYearMonth(selectedYearMonth, 1))
                }
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                title="다음 달"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedYearMonth !== currentRealYm && (
              <button
                type="button"
                onClick={() => onChangeYearMonth(currentRealYm)}
                className={`px-2 py-1 rounded-lg text-[11.5px] font-extrabold border cursor-pointer ${
                  isDark
                    ? 'bg-blue-500/15 text-blue-300 border-blue-400/35'
                    : 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE]'
                }`}
              >
                당월
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {!isIncentiveBarHidden && (
              <>
                <button
                  type="button"
                  onClick={() => setIsGiftCardModalOpen(true)}
                  title="클릭하여 구독·올케어 상품권 시상 상세 내역 보기"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black shrink-0 cursor-pointer schedule-tactile ${
                    giftCardReport.totalGiftCardAmount > 0
                      ? isDark
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                      : isDark
                      ? 'bg-amber-500/10 border-amber-400/30 text-amber-200/90'
                      : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>상품권시상</span>
                  <span className="font-mono tabular-nums text-[#D97706] dark:text-amber-300">
                    {hideIncentiveAmounts
                      ? '••••원'
                      : `+${formatCurrency(giftCardReport.totalGiftCardAmount)}원`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black shrink-0 cursor-pointer schedule-tactile ${
                    isDark
                      ? 'bg-blue-500/15 border-blue-400/35 text-blue-200'
                      : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#191F28]'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
                  <span>수당</span>
                  <span className="font-mono tabular-nums text-[#1B64DA] dark:text-blue-300">
                    {hideIncentiveAmounts
                      ? '••••원'
                      : `+${formatCurrency(report.grandTotalIncentive)}원`}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 opacity-75" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 opacity-75" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleHideIncentiveAmounts}
                  title="수치 블러 전환 (홈 화면과 연동 · 재실행 후 유지)"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl border text-[11.5px] font-extrabold shrink-0 cursor-pointer schedule-tactile ${subSurfaceCls}`}
                >
                  {hideIncentiveAmounts ? (
                    <Eye className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 opacity-75" />
                  )}
                  <span>{hideIncentiveAmounts ? '숫자 표시' : '숫자 블러'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleToggleIncentiveBarHidden}
              title="고객 동석 상담용 클린 화면 전환 (앱을 껐다 켜도 유지됩니다)"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11.5px] font-extrabold shrink-0 cursor-pointer schedule-tactile ${
                isIncentiveBarHidden
                  ? isDark
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-200'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1B64DA]'
                  : subSurfaceCls
              }`}
            >
              {isIncentiveBarHidden ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>상담 모드 ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 opacity-75" />
                  <span>상담 모드</span>
                </>
              )}
            </button>
          </div>
        </div>

        {!isIncentiveBarHidden && (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('sales', 'gross')}
            className={`min-h-[38px] ledger-row px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'sales' && salesSubView === 'gross'
                ? isDark
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : subSurfaceCls
            }`}
            title="당월 계약(총판) 확정 내역 보기"
          >
            <span className="px-1.5 py-0.5 rounded text-[11.5px] font-black bg-[#059669] text-white shrink-0">
              총판
            </span>
            <span className="font-black font-mono tabular-nums text-[#059669] dark:text-emerald-400 truncate">
              {formatShortManwon(report.grossSalesTotal)}
              <span className={`ml-0.5 text-[11.5px] font-normal ${mutedCls}`}>
                ({report.grossRows.length})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('sales', 'delivery')}
            className={`min-h-[38px] ledger-row px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'sales' && salesSubView === 'delivery'
                ? isDark
                  ? 'bg-blue-500/20 border-blue-400/60 text-blue-200'
                  : 'bg-[#EFF6FF] border-[#1B64DA] text-[#191F28]'
                : subSurfaceCls
            }`}
            title="당월 배송(실판) 내역 보기"
          >
            <span className="px-1.5 py-0.5 rounded text-[11.5px] font-black bg-[#1B64DA] text-white shrink-0">
              실판
            </span>
            <span
              className={`font-black font-mono tabular-nums truncate ${
                isDark ? 'text-blue-400' : 'text-[#1B64DA]'
              }`}
            >
              {formatShortManwon(report.netDeliverySalesTotal)}
              <span className={`ml-0.5 text-[11.5px] font-normal ${mutedCls}`}>
                ({report.netDeliveryRows.length})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('freed')}
            className={`min-h-[38px] ledger-row px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'freed'
                ? isDark
                  ? 'bg-blue-500/20 border-blue-400/60 text-blue-200'
                  : 'bg-[#EFF6FF] border-[#1B64DA] text-[#191F28]'
                : subSurfaceCls
            }`}
            title="프리드 가입 건수 및 종류별 수당 보기"
          >
            <span className="text-[11.5px] font-extrabold shrink-0">프리드</span>
            <span className="font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 truncate">
              {hideIncentiveAmounts ? '••••' : `+${formatShortManwon(report.freedSummary.totalIncentive)}`}
              <span className={`ml-0.5 text-[11.5px] font-normal ${mutedCls}`}>
                ({report.freedSummary.totalCount})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('models')}
            className={`min-h-[38px] ledger-row px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'models'
                ? isDark
                  ? 'bg-blue-500/20 border-blue-400/60 text-blue-200'
                  : 'bg-[#EFF6FF] border-[#1B64DA] text-[#191F28]'
                : subSurfaceCls
            }`}
            title="월별 단가표 업로드 및 모델별 수당 보기"
          >
            <span className="text-[11.5px] font-extrabold shrink-0">모델수당</span>
            <span className="font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 truncate">
              {hideIncentiveAmounts ? '••••' : `+${formatShortManwon(report.modelIncentiveTotal)}`}
              <span className={`ml-0.5 text-[11.5px] font-normal ${mutedCls}`}>
                ({report.matchedModelUnitCount > 0
                  ? `${report.matchedModelUnitCount}대`
                  : currentSheet?.rules.length
                  ? `단가${currentSheet.rules.length}`
                  : 0})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('sales', 'subscription')}
            className={`min-h-[38px] ledger-row px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'sales' && salesSubView === 'subscription'
                ? isDark
                  ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                  : 'bg-[#FFF1F2] border-[#FECDD3] text-[#191F28]'
                : subSurfaceCls
            }`}
            title="해당월 구독 판매접수 확정건수 자동 집계 (클릭 시 접수 고객 내역 보기)"
          >
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11.5px] font-black bg-[#E60012] text-white shrink-0">
              <Repeat className="w-2.5 h-2.5" />
              <span>구독</span>
            </span>
            <span
              className={`font-black font-mono tabular-nums truncate ${
                isDark ? 'text-rose-400' : 'text-[#E60012]'
              }`}
            >
              {report.grossSubscriptionCount}개
              {report.grossSubscriptionCustomerCount > 0 && (
                <span className={`ml-0.5 text-[11.5px] font-normal ${mutedCls}`}>
                  ({report.grossSubscriptionCustomerCount}명)
                </span>
              )}
            </span>
          </button>

          <div
            className={`min-h-[38px] flex items-center justify-between gap-1 px-2 py-1 rounded-xl border text-xs transition ${
              currentAllCareCount > 0
                ? isDark
                  ? 'bg-blue-500/15 border-blue-400/45 text-blue-100'
                  : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#191F28]'
                : subSurfaceCls
            }`}
            title={`${formatYearMonthKo(selectedYearMonth)} 가전올케어 유치 건수 조정 (메인화면 수당적립 요약에 실시간 반영)`}
          >
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11.5px] font-black bg-[#191F28] dark:bg-slate-800 text-white shrink-0">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>가전올케어</span>
            </span>

            <div className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStepAllCare(-1);
                }}
                disabled={currentAllCareCount <= 0}
                aria-label="가전올케어 수량 감소"
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed schedule-tactile ${
                  isDark
                    ? 'bg-[#131C2E] border-slate-700 hover:bg-slate-800 text-slate-200'
                    : 'bg-white border-[#D1D6DB] hover:bg-[#F2F4F6] text-[#191F28]'
                }`}
              >
                <Minus className="w-3 h-3" />
              </button>

              {isEditingAllCare ? (
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={allCareDraft}
                  onChange={(e) => setAllCareDraft(e.target.value)}
                  onBlur={commitAllCareDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitAllCareDraft();
                    } else if (e.key === 'Escape') {
                      setIsEditingAllCare(false);
                    }
                  }}
                  className={`w-12 h-6 px-1 rounded-md border text-center font-black font-mono tabular-nums text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-[#1B64DA] ${
                    isDark
                      ? 'bg-[#0B1120] border-blue-400 text-blue-300'
                      : 'bg-white border-[#1B64DA] text-[#191F28]'
                  }`}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAllCareDraft(String(currentAllCareCount));
                    setIsEditingAllCare(true);
                  }}
                  title="클릭하여 숫자로 직접 입력"
                  className={`min-w-[34px] px-1 py-0.5 rounded-md text-center font-black font-mono tabular-nums cursor-pointer hover:underline ${
                    isDark ? 'text-blue-300' : 'text-[#1B64DA]'
                  }`}
                >
                  {currentAllCareCount}개
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStepAllCare(1);
                }}
                aria-label="가전올케어 수량 증가"
                className="w-6 h-6 rounded-lg border border-[#1B64DA] bg-[#1B64DA] hover:bg-[#1552B5] text-white flex items-center justify-center transition cursor-pointer schedule-tactile"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {isExpanded && (
        <div
          className={`mt-2.5 pt-2.5 border-t space-y-2.5 ${
            isDark ? 'border-slate-800' : 'border-[#E5E8EB]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div
              className={`inline-flex items-center gap-1 p-0.5 rounded-xl border ${subSurfaceCls}`}
            >
              {[
                {
                  id: 'sales' as SettlementTabId,
                  label: `총판·실판 (${report.grossRows.length}/${report.netDeliveryRows.length})`,
                },
                {
                  id: 'freed' as SettlementTabId,
                  label: `프리드 수당 (${report.freedSummary.totalCount}건)`,
                },
                {
                  id: 'models' as SettlementTabId,
                  label: `모델별 수당 (${report.matchedModelUnitCount}대)`,
                },
              ].map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeTab(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-black cursor-pointer transition ${
                      active
                        ? isDark
                          ? 'bg-[#60A5FA] text-[#0B1120] shadow-2xs'
                          : 'bg-[#191F28] text-white shadow-2xs'
                        : mutedCls
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11.5px] font-bold hidden sm:inline ${mutedCls}`}>
                실적기준: 일반=제품합계 · 구독=구독원금 (확정건 전용)
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className={`p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${mutedCls}`}
                title="패널 접기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activeTab === 'sales' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSalesSubView('gross')}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold font-mono tabular-nums border cursor-pointer ${
                      salesSubView === 'gross'
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : subSurfaceCls
                    }`}
                  >
                    총판 {formatCurrency(report.grossSalesTotal)}원 ({report.grossRows.length}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesSubView('delivery')}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold font-mono tabular-nums border cursor-pointer ${
                      salesSubView === 'delivery'
                        ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                        : subSurfaceCls
                    }`}
                  >
                    실판 {formatCurrency(report.netDeliverySalesTotal)}원 ({report.netDeliveryRows.length}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesSubView('subscription')}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold font-mono tabular-nums border cursor-pointer ${
                      salesSubView === 'subscription'
                        ? 'bg-[#E60012] text-white border-[#E60012]'
                        : subSurfaceCls
                    }`}
                  >
                    구독접수 {report.grossSubscriptionCount}개 ({report.grossSubscriptionCustomerCount}명)
                  </button>
                  {report.undatedConfirmedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSalesSubView('undated')}
                      className={`px-2 py-1 rounded-lg text-[11.5px] font-extrabold font-mono tabular-nums border cursor-pointer ${
                        salesSubView === 'undated'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : subSurfaceCls
                      }`}
                    >
                      배송일미정 {report.undatedConfirmedCount}건
                    </button>
                  )}
                </div>

                <span className={`text-[11.5px] font-mono tabular-nums font-bold ${mutedCls}`}>
                  {salesSubView === 'delivery'
                    ? `일반 ${formatShortManwon(report.netGeneralTotal)} · 구독원금 ${formatShortManwon(report.netSubPrincipalTotal)}`
                    : `일반 ${formatShortManwon(report.grossGeneralTotal)} · 구독원금 ${formatShortManwon(report.grossSubPrincipalTotal)}`}
                </span>
              </div>

              {activeSalesRows.length === 0 ? (
                <div
                  className={`rounded-xl border py-3 px-3 text-center text-[11.5px] font-bold ${subSurfaceCls} ${mutedCls}`}
                >
                  해당 월의 확정 고객([계약완료]·[발송완료]) 내역이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 schedule-matrix-scroll">
                  {activeSalesRows.map((row) => {
                    const isEditingThisRow = editingDeliveryRowId === row.customer.id;
                    return (
                      <div
                        key={row.customer.id}
                        className={`px-3 py-2 rounded-xl border text-left flex flex-col gap-1.5 schedule-tactile ${subSurfaceCls}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            onClick={() => onSelectCustomer(row.customer)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black truncate">
                                {row.customer.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[11.5px] font-bold bg-emerald-500/15 text-[#059669] dark:text-emerald-400 shrink-0">
                                {row.profile.saleType === 'subscription'
                                  ? `구독 ${row.profile.subscriptionItemCount}개`
                                  : row.profile.saleType === 'hybrid'
                                  ? `혼합(구독 ${row.profile.subscriptionItemCount}개)`
                                  : '제품합계'}
                              </span>
                            </div>
                            <div className={`text-[11.5px] truncate ${mutedCls}`}>
                              {row.customer.items || '품목 미입력'}
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                            <div
                              onClick={() => onSelectCustomer(row.customer)}
                              className="text-xs font-black font-mono tabular-nums text-[#059669] dark:text-emerald-400 cursor-pointer"
                            >
                              {formatCurrency(row.profile.performanceAmount)}원
                            </div>
                            <div className={`text-[11.5px] font-mono tabular-nums flex items-center gap-1 ${mutedCls}`}>
                              <span>
                                <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                                {(row.profile.contractDateStr || '-').slice(5)}
                              </span>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isEditingThisRow) {
                                    setEditingDeliveryRowId(null);
                                  } else {
                                    setEditingDeliveryRowId(row.customer.id);
                                    setEditingDeliveryDateVal(row.customer.deliveryDate || '');
                                  }
                                }}
                                title="클릭하여 실판(배송일) 바로 수정"
                                className="px-1.5 py-0.5 rounded bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 font-bold inline-flex items-center gap-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/25 cursor-pointer"
                              >
                                <Truck className="w-2.5 h-2.5 inline" />
                                <span>
                                  {row.customer.deliveryDate
                                    ? row.customer.deliveryDate.slice(5)
                                    : '실판미정'}
                                </span>
                                <span className="text-[11.5px] underline ml-0.5">수정</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {isEditingThisRow && onFieldChange && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`pt-1.5 border-t flex items-center justify-between gap-1.5 ${
                              isDark ? 'border-slate-800' : 'border-[#E5E8EB]'
                            }`}
                          >
                            <span className="text-[11.5px] font-black text-[#1B64DA] dark:text-blue-300 shrink-0">
                              🚚 실판(배송일):
                            </span>
                            <input
                              type="date"
                              value={editingDeliveryDateVal}
                              onChange={(e) => setEditingDeliveryDateVal(e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[#BFDBFE] dark:border-blue-400/50 bg-white dark:bg-slate-900 text-[#191F28] dark:text-white text-base sm:text-xs font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onFieldChange(row.customer.id, {
                                  deliveryDate: editingDeliveryDateVal.trim(),
                                });
                                setEditingDeliveryRowId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] text-white text-[11.5px] font-black inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Save className="w-3 h-3" />
                              <span>저장</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'freed' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold">
                  총 <strong className="font-mono tabular-nums">{report.freedSummary.totalCount}건</strong> 가입 · 수당{' '}
                  <strong className="font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">
                    +{formatCurrency(report.freedSummary.totalIncentive)}원
                  </strong>
                </span>

                <div
                  className={`inline-flex items-center p-0.5 rounded-lg border text-[11.5px] font-black ${subSurfaceCls}`}
                >
                  <button
                    type="button"
                    onClick={() => setIncentiveBasis('contract')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      incentiveBasis === 'contract'
                        ? isDark
                          ? 'bg-[#60A5FA] text-[#0B1120]'
                          : 'bg-[#191F28] text-white'
                        : mutedCls
                    }`}
                  >
                    계약월 기준
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncentiveBasis('delivery')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      incentiveBasis === 'delivery'
                        ? isDark
                          ? 'bg-[#60A5FA] text-[#0B1120]'
                          : 'bg-[#191F28] text-white'
                        : mutedCls
                    }`}
                  >
                    배송월 기준
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[
                  {
                    key: 'plus',
                    label: '플러스구독(9만)',
                    count: report.freedSummary.plusSubCount,
                    amt: report.freedSummary.plusSubIncentive,
                    sub:
                      report.freedSummary.plusSubCount > 0
                        ? `72(${report.freedSummary.counts.hi72})·90(${report.freedSummary.counts.hi90})·108(${report.freedSummary.counts.hi108})`
                        : '',
                  },
                  {
                    key: 'hf75',
                    label: '프리드 75(6만)',
                    count: report.freedSummary.counts.hf75,
                    amt: report.freedSummary.hf75Incentive,
                    sub: '',
                  },
                  {
                    key: 'hf150',
                    label: '프리드 150(12만)',
                    count: report.freedSummary.counts.hf150,
                    amt: report.freedSummary.hf150Incentive,
                    sub: '',
                  },
                  {
                    key: 'hf225',
                    label: '프리드 225(18만)',
                    count: report.freedSummary.counts.hf225,
                    amt: report.freedSummary.hf225Incentive,
                    sub: '',
                  },
                  {
                    key: 'hf300',
                    label: '프리드 300(24만)',
                    count: report.freedSummary.counts.hf300,
                    amt: report.freedSummary.hf300Incentive,
                    sub: '',
                  },
                ].map((f) => (
                  <div
                    key={f.key}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs ${
                      f.count > 0
                        ? isDark
                          ? 'bg-blue-500/15 border-blue-400/40'
                          : 'bg-[#EFF6FF] border-[#BFDBFE]'
                        : subSurfaceCls
                    }`}
                  >
                    <div className="ledger-row">
                      <span className="text-[11.5px] font-extrabold truncate">
                        {f.label}
                      </span>
                      <span className="font-black font-mono tabular-nums shrink-0">
                        {f.count}건
                      </span>
                    </div>
                    <div className="ledger-row mt-0.5">
                      <span className="text-[11.5px] font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-300">
                        +{formatShortManwon(f.amt)}
                      </span>
                      {f.sub && (
                        <span className={`text-[11.5px] font-mono tabular-nums ${mutedCls}`}>
                          {f.sub}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {report.freedCustomerRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 schedule-matrix-scroll">
                  {report.freedCustomerRows.map((row) => (
                    <button
                      key={row.customer.id}
                      type="button"
                      onClick={() => onSelectCustomer(row.customer)}
                      className={`px-3 py-1.5 rounded-xl border text-left ledger-row text-xs cursor-pointer ${subSurfaceCls}`}
                    >
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-black">{row.customer.name}</span>
                        {row.profile.freedDetail.summaryBadges.map((b, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 rounded text-[11.5px] font-bold bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <span className="font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 shrink-0">
                        +{formatCurrency(row.customerFreedIncentive)}원
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <CrmModelIncentiveTabSection
            activeTab={activeTab}
            bulkPasteText={bulkPasteText}
            currentSheet={currentSheet}
            filteredRules={filteredRules}
            handleAddSingleRule={handleAddSingleRule}
            handleBulkTextApply={handleBulkTextApply}
            handleDeleteRule={handleDeleteRule}
            handleManualPullOrPush={handleManualPullOrPush}
            handleQuickAssignSave={handleQuickAssignSave}
            handleRuleAmountBlur={handleRuleAmountBlur}
            handleUpdateRuleAmount={handleUpdateRuleAmount}
            incentiveBasis={incentiveBasis}
            isDark={isDark}
            isSyncingCloud={isSyncingCloud}
            manualCategory={manualCategory}
            manualIncentive={manualIncentive}
            manualModelCode={manualModelCode}
            mutedCls={mutedCls}
            onSelectCustomer={onSelectCustomer}
            quickAssignAmount={quickAssignAmount}
            quickAssignTarget={quickAssignTarget}
            report={report}
            ruleSearch={ruleSearch}
            setBulkPasteText={setBulkPasteText}
            setIncentiveBasis={setIncentiveBasis}
            setManualCategory={setManualCategory}
            setManualIncentive={setManualIncentive}
            setManualModelCode={setManualModelCode}
            setQuickAssignAmount={setQuickAssignAmount}
            setQuickAssignTarget={setQuickAssignTarget}
            setRuleSearch={setRuleSearch}
            setShowManualDrawer={setShowManualDrawer}
            setShowRulesDrawer={setShowRulesDrawer}
            setUploadError={setUploadError}
            setUploadSuccess={setUploadSuccess}
            shellCls={shellCls}
            showManualDrawer={showManualDrawer}
            showRulesDrawer={showRulesDrawer}
            subSurfaceCls={subSurfaceCls}
            uploadError={uploadError}
            uploadSuccess={uploadSuccess}
          />
        </div>
      )}
      <GiftCardRewardDetailModal
        isOpen={isGiftCardModalOpen}
        onClose={() => setIsGiftCardModalOpen(false)}
        initialYearMonth={selectedYearMonth}
        customers={customers}
        isDark={isDark}
        onSyncYearMonth={onChangeYearMonth}
        onSelectCustomer={(cid) => {
          const found = customers.find((c) => c.id === cid);
          if (found) onSelectCustomer(found);
        }}
      />
    </section>
  );
};
