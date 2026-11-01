import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  CustomerItem,
  ModelIncentiveRule,
  ModelIncentivesMap,
  SettlementTabId,
} from '../types/crm';
import { formatCurrency, formatShortManwon } from '../utils/date';
import {
  computeMonthlySettlementReport,
  ConfirmedCustomerSettlementRow,
  downloadModelIncentiveExcelTemplate,
  getCurrentYearMonth,
  hydrateModelIncentiveSheetsFromIdb,
  IncentiveMonthBasis,
  loadAllModelIncentiveSheets,
  MODEL_INCENTIVE_UPDATED_EVENT,
  parseIncentiveAmountCell,
  parseModelIncentiveExcelOrCsv,
  parseModelIncentiveFreeText,
  parseModelIncentiveImage,
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
  onShowToast,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [incentiveBasis, setIncentiveBasis] =
    useState<IncentiveMonthBasis>('contract');
  const [salesSubView, setSalesSubView] = useState<
    'gross' | 'delivery' | 'undated'
  >('gross');

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true);
    }
  }, [defaultExpanded, activeTab]);

  const [sheetsMap, setSheetsMap] = useState<ModelIncentivesMap>(() =>
    loadAllModelIncentiveSheets()
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replaceOnUpload, setReplaceOnUpload] = useState<boolean>(false);

  const [showManualDrawer, setShowManualDrawer] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);
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

  const excelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrateModelIncentiveSheetsFromIdb().then((loaded) => {
      if (Object.keys(loaded).length > 0) {
        setSheetsMap(loaded);
      }
    });
    const sync = () => setSheetsMap(loadAllModelIncentiveSheets());
    window.addEventListener(MODEL_INCENTIVE_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(MODEL_INCENTIVE_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

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

  const handleOpenOrToggleTab = (
    targetTab: SettlementTabId,
    subView?: 'gross' | 'delivery'
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

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      let totalParsed: ModelIncentiveRule[] = [];
      for (const f of files) {
        const rules = await parseModelIncentiveExcelOrCsv(f);
        totalParsed = [...totalParsed, ...rules];
      }
      const nextSheet = upsertMonthlyIncentiveSheet(
        selectedYearMonth,
        totalParsed,
        `${files[0].name}${files.length > 1 ? ` 외 ${files.length - 1}건` : ''}`,
        replaceOnUpload
      );
      setSheetsMap(loadAllModelIncentiveSheets());
      onShowToast?.(
        `📊 ${formatYearMonthKo(selectedYearMonth)} 모델 수당표 반영 (${nextSheet.rules.length}개)`
      );
    } catch (err: any) {
      setUploadError(err?.message || '엑셀 파일 분석 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      let totalParsed: ModelIncentiveRule[] = [];
      for (const f of files) {
        const rules = await parseModelIncentiveImage(f);
        totalParsed = [...totalParsed, ...rules];
      }
      const nextSheet = upsertMonthlyIncentiveSheet(
        selectedYearMonth,
        totalParsed,
        `사진 스캔 (${files.length}장)`,
        replaceOnUpload
      );
      setSheetsMap(loadAllModelIncentiveSheets());
      onShowToast?.(
        `📷 사진에서 ${totalParsed.length}개 모델 수당 추출 완료 (누적 ${nextSheet.rules.length}개)`
      );
    } catch (err: any) {
      setUploadError(err?.message || '사진 분석 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddSingleRule = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualModelCode.trim().toUpperCase();
    const amt = parseIncentiveAmountCell(manualIncentive, 1);
    if (!code || amt <= 0) return;

    upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      [
        {
          id: `MAN-${Date.now()}`,
          category: manualCategory.trim() || '가전',
          modelCode: code,
          incentiveAmount: amt,
          saleTypeFilter: 'all',
        },
      ],
      '직접 입력',
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setManualModelCode('');
    setManualIncentive('');
    onShowToast?.(`✅ [${code}] 수당 ${formatCurrency(amt)}원 등록`);
  };

  const handleBulkTextApply = () => {
    const parsed = parseModelIncentiveFreeText(bulkPasteText);
    if (parsed.length === 0) {
      setUploadError('예: "RM70F64M2X 50000" 또는 "OLED65C4 10만" 형태로 입력해 주세요.');
      return;
    }
    setUploadError(null);
    const next = upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      parsed,
      `텍스트 일괄등록 (${parsed.length}건)`,
      replaceOnUpload
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setBulkPasteText('');
    setShowManualDrawer(false);
    onShowToast?.(`✅ ${parsed.length}개 모델 수당 반영 (총 ${next.rules.length}개)`);
  };

  const handleQuickAssignSave = () => {
    if (!quickAssignTarget) return;
    const amt = parseIncentiveAmountCell(quickAssignAmount, 1);
    if (amt <= 0) return;
    upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      [
        {
          id: `QCK-${Date.now()}`,
          category: quickAssignTarget.category || '가전',
          modelCode: quickAssignTarget.modelCode.trim().toUpperCase(),
          incentiveAmount: amt,
          saleTypeFilter: 'all',
        },
      ],
      '고객 카드 즉시 지정',
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    onShowToast?.(
      `💰 [${quickAssignTarget.modelCode}] +${formatCurrency(amt)}원 반영 완료`
    );
    setQuickAssignTarget(null);
    setQuickAssignAmount('');
  };

  const handleUpdateRuleAmount = (ruleId: string, nextAmount: number) => {
    if (!currentSheet) return;
    const nextRules = currentSheet.rules.map((r) =>
      r.id === ruleId ? { ...r, incentiveAmount: Math.max(0, nextAmount) } : r
    );
    const nextMap: ModelIncentivesMap = {
      ...sheetsMap,
      [selectedYearMonth]: {
        ...currentSheet,
        rules: nextRules,
      },
    };
    saveAllModelIncentiveSheets(nextMap);
    setSheetsMap(nextMap);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!currentSheet) return;
    const nextRules = currentSheet.rules.filter((r) => r.id !== ruleId);
    const nextMap: ModelIncentivesMap = {
      ...sheetsMap,
      [selectedYearMonth]: {
        ...currentSheet,
        rules: nextRules,
      },
    };
    saveAllModelIncentiveSheets(nextMap);
    setSheetsMap(nextMap);
  };

  const handleCopyFromPrevMonth = () => {
    if (!prevSheet || prevSheet.rules.length === 0) return;
    const next = upsertMonthlyIncentiveSheet(
      selectedYearMonth,
      prevSheet.rules,
      `${formatYearMonthKo(prevYearMonth)} 복사본`,
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    onShowToast?.(`📋 전월 단가표(${next.rules.length}개)를 불러왔습니다.`);
  };

  const shellCls = isDark
    ? 'bg-[#151A25] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';
  const subSurfaceCls = isDark
    ? 'bg-[#0E131D] border-white/10'
    : 'bg-[#FAF8F4] border-[#E4DFD5]';
  const mutedCls = isDark ? 'text-slate-400' : 'text-[#78716C]';

  const activeSalesRows: ConfirmedCustomerSettlementRow[] = useMemo(() => {
    if (salesSubView === 'delivery') return report.netDeliveryRows;
    if (salesSubView === 'undated') {
      return report.grossRows.filter((r) => !r.profile.deliveryYearMonth);
    }
    return report.grossRows;
  }, [salesSubView, report]);

  return (
    <section
      id="crm-sales-incentive-hub"
      className={`rounded-2xl border px-3 py-2 shadow-2xs transition ${shellCls}`}
    >
      {/* 슬림 요약 바: 데스크톱 1줄 · 모바일 깔끔한 2단 그리드 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5">
        {/* 상단/좌측: 월 선택 + (모바일에서는 우측에 수당합계 배치) */}
        <div className="flex items-center justify-between lg:justify-start gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-xl border ${subSurfaceCls}`}
            >
              <button
                type="button"
                onClick={() =>
                  onChangeYearMonth(shiftYearMonth(selectedYearMonth, -1))
                }
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                title="이전 달"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-xs font-black font-mono">
                {formatYearMonthShort(selectedYearMonth)}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeYearMonth(shiftYearMonth(selectedYearMonth, 1))
                }
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                title="다음 달"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedYearMonth !== currentRealYm && (
              <button
                type="button"
                onClick={() => onChangeYearMonth(currentRealYm)}
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                  isDark
                    ? 'bg-sky-400/15 text-sky-300 border-sky-400/30'
                    : 'bg-[#F4ECE1] text-[#8C5A32] border-[#DCCBB2]'
                }`}
              >
                당월
              </button>
            )}
          </div>

          {/* 모바일·태블릿용 우측 수당합계 토글 */}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-black cursor-pointer schedule-tactile ${
              isDark
                ? 'bg-[#172234] border-amber-400/35 text-amber-300'
                : 'bg-[#FAF4EA] border-[#DFC9AC] text-[#7C4D25]'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>수당</span>
            <span className="font-mono text-amber-600 dark:text-amber-400">
              +{formatCurrency(report.grandTotalIncentive)}원
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 opacity-75" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 opacity-75" />
            )}
          </button>
        </div>

        {/* 중앙 4칸 정렬 칩 (모바일 2×2 칼각 그리드 / 태블릿·PC 4칸 1줄) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-1.5 flex-1 lg:justify-center">
          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('sales', 'gross')}
            className={`flex items-center justify-between lg:justify-start gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'sales' && salesSubView === 'gross'
                ? isDark
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : subSurfaceCls
            }`}
            title="당월 계약(총판) 확정 내역 보기"
          >
            <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-600 text-white shrink-0">
              총판
            </span>
            <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {formatShortManwon(report.grossSalesTotal)}
              <span className={`ml-0.5 text-[10px] font-normal ${mutedCls}`}>
                ({report.grossRows.length})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('sales', 'delivery')}
            className={`flex items-center justify-between lg:justify-start gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'sales' && salesSubView === 'delivery'
                ? isDark
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                  : 'bg-sky-50 border-sky-400 text-sky-900'
                : subSurfaceCls
            }`}
            title="당월 배송(실판) 내역 보기"
          >
            <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-sky-600 text-white shrink-0">
              실판
            </span>
            <span
              className={`font-black font-mono truncate ${
                isDark ? 'text-sky-400' : 'text-blue-600'
              }`}
            >
              {formatShortManwon(report.netDeliverySalesTotal)}
              <span className={`ml-0.5 text-[10px] font-normal ${mutedCls}`}>
                ({report.netDeliveryRows.length})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('freed')}
            className={`flex items-center justify-between lg:justify-start gap-1 px-2.5 py-1 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'freed'
                ? isDark
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-200'
                  : 'bg-amber-50 border-amber-400 text-amber-900'
                : subSurfaceCls
            }`}
            title="프리드 가입 건수 및 종류별 수당 보기"
          >
            <span className="text-[11px] font-extrabold shrink-0">프리드</span>
            <span className="font-black font-mono text-amber-500 truncate">
              +{formatShortManwon(report.freedSummary.totalIncentive)}
              <span className={`ml-0.5 text-[10px] font-normal ${mutedCls}`}>
                ({report.freedSummary.totalCount})
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenOrToggleTab('models')}
            className={`flex items-center justify-between lg:justify-start gap-1 px-2.5 py-1 rounded-xl border text-xs transition cursor-pointer schedule-tactile ${
              isExpanded && activeTab === 'models'
                ? isDark
                  ? 'bg-indigo-500/20 border-indigo-400/60 text-indigo-200'
                  : 'bg-indigo-50 border-indigo-400 text-indigo-900'
                : subSurfaceCls
            }`}
            title="월별 단가표 업로드 및 모델별 수당 보기"
          >
            <span className="text-[11px] font-extrabold shrink-0">모델수당</span>
            <span className="font-black font-mono text-sky-500 truncate">
              +{formatShortManwon(report.modelIncentiveTotal)}
              <span className={`ml-0.5 text-[10px] font-normal ${mutedCls}`}>
                ({report.matchedModelUnitCount})
              </span>
            </span>
          </button>
        </div>

        {/* 데스크톱용 우측 수당 총합 + 열기/접기 */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black shrink-0 cursor-pointer schedule-tactile ${
            isDark
              ? 'bg-[#172234] border-amber-400/35 text-amber-300'
              : 'bg-[#FAF4EA] border-[#DFC9AC] text-[#7C4D25]'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>수당합계</span>
          <span className="font-mono text-amber-600 dark:text-amber-400">
            +{formatCurrency(report.grandTotalIncentive)}원
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 opacity-75" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-75" />
          )}
        </button>
      </div>

      {/* 펼쳐졌을 때만 나타나는 심플·컴팩트 상세 탭 영역 */}
      {isExpanded && (
        <div
          className={`mt-2.5 pt-2.5 border-t space-y-2.5 ${
            isDark ? 'border-white/10' : 'border-[#EAE5DC]'
          }`}
        >
          {/* 컴팩트 탭 바 + 안내 + 닫기 */}
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition ${
                      active
                        ? isDark
                          ? 'bg-[#1E2738] text-white shadow-2xs'
                          : 'bg-[#18181B] text-white shadow-2xs'
                        : mutedCls
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold hidden sm:inline ${mutedCls}`}>
                실적기준: 일반=제품합계 · 구독=구독원금 (확정건 전용)
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className={`p-1 rounded-lg hover:bg-black/5 cursor-pointer ${mutedCls}`}
                title="패널 접기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 탭 1: 총판 · 실판 컴팩트 내역 */}
          {activeTab === 'sales' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSalesSubView('gross')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                      salesSubView === 'gross'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : subSurfaceCls
                    }`}
                  >
                    총판 {formatCurrency(report.grossSalesTotal)}원 ({report.grossRows.length}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesSubView('delivery')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                      salesSubView === 'delivery'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : subSurfaceCls
                    }`}
                  >
                    실판 {formatCurrency(report.netDeliverySalesTotal)}원 ({report.netDeliveryRows.length}건)
                  </button>
                  {report.undatedConfirmedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSalesSubView('undated')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                        salesSubView === 'undated'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : subSurfaceCls
                      }`}
                    >
                      배송일미정 {report.undatedConfirmedCount}건
                    </button>
                  )}
                </div>

                <span className={`text-[11px] font-mono font-bold ${mutedCls}`}>
                  {salesSubView === 'delivery'
                    ? `일반 ${formatShortManwon(report.netGeneralTotal)} · 구독원금 ${formatShortManwon(report.netSubPrincipalTotal)}`
                    : `일반 ${formatShortManwon(report.grossGeneralTotal)} · 구독원금 ${formatShortManwon(report.grossSubPrincipalTotal)}`}
                </span>
              </div>

              {activeSalesRows.length === 0 ? (
                <div
                  className={`rounded-xl border py-3 px-3 text-center text-[11px] font-bold ${subSurfaceCls} ${mutedCls}`}
                >
                  해당 월의 확정 고객([계약완료]·[발송완료]) 내역이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 schedule-matrix-scroll">
                  {activeSalesRows.map((row) => (
                    <button
                      key={row.customer.id}
                      type="button"
                      onClick={() => onSelectCustomer(row.customer)}
                      className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer schedule-tactile ${subSurfaceCls}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black truncate">
                            {row.customer.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                            {row.profile.saleType === 'subscription'
                              ? '구독원금'
                              : row.profile.saleType === 'hybrid'
                              ? '혼합원금'
                              : '제품합계'}
                          </span>
                        </div>
                        <div className={`text-[11px] truncate ${mutedCls}`}>
                          {row.customer.items || '품목 미입력'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(row.profile.performanceAmount)}원
                        </div>
                        <div className={`text-[10px] font-mono ${mutedCls}`}>
                          <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                          {(row.profile.contractDateStr || '-').slice(5)} ·{' '}
                          <Truck className="w-2.5 h-2.5 inline mr-0.5 text-sky-500" />
                          {row.customer.deliveryDate
                            ? row.customer.deliveryDate.slice(5)
                            : '미정'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 탭 2: 프리드 가입 건수 & 종류별 수당 (심플 컴팩트형) */}
          {activeTab === 'freed' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold">
                  총 <strong className="font-mono">{report.freedSummary.totalCount}건</strong> 가입 · 수당{' '}
                  <strong className="font-mono text-amber-500">
                    +{formatCurrency(report.freedSummary.totalIncentive)}원
                  </strong>
                </span>

                <div
                  className={`inline-flex items-center p-0.5 rounded-lg border text-[10px] font-black ${subSurfaceCls}`}
                >
                  <button
                    type="button"
                    onClick={() => setIncentiveBasis('contract')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      incentiveBasis === 'contract'
                        ? isDark
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-[#18181B] text-white'
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
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-[#18181B] text-white'
                        : mutedCls
                    }`}
                  >
                    배송월 기준
                  </button>
                </div>
              </div>

              {/* 5종 컴팩트 수당 칩 그리드 */}
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
                          ? 'bg-amber-400/15 border-amber-400/40'
                          : 'bg-amber-50/90 border-amber-300'
                        : subSurfaceCls
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-extrabold truncate">
                        {f.label}
                      </span>
                      <span className="font-black font-mono shrink-0">
                        {f.count}건
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[11px] font-black font-mono text-amber-600 dark:text-amber-400">
                        +{formatShortManwon(f.amt)}
                      </span>
                      {f.sub && (
                        <span className={`text-[9px] font-mono ${mutedCls}`}>
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
                      className={`px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs cursor-pointer ${subSurfaceCls}`}
                    >
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-black">{row.customer.name}</span>
                        {row.profile.freedDetail.summaryBadges.map((b, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <span className="font-black font-mono text-amber-500 shrink-0">
                        +{formatCurrency(row.customerFreedIncentive)}원
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 탭 3: 제품 모델별 수당 (심플 컴팩트형) */}
          {activeTab === 'models' && (
            <div className="space-y-2">
              {/* 한 줄 업로드·관리 툴바 */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => photoInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3 h-3" />
                    )}
                    <span>사진 업로드</span>
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => excelInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>엑셀 업로드</span>
                  </button>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    multiple
                    onChange={handleExcelUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setShowManualDrawer((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>직접입력</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRulesDrawer((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                  >
                    <span>단가표({currentSheet?.rules.length || 0})</span>
                    {showRulesDrawer ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {prevSheet && prevSheet.rules.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyFromPrevMonth}
                      className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                      title="전월 단가표 불러오기"
                    >
                      <Copy className="w-3 h-3" />
                      <span>전월복사</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      downloadModelIncentiveExcelTemplate(
                        selectedYearMonth,
                        currentSheet?.rules || []
                      )
                    }
                    className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                    title="엑셀 양식 또는 현재 단가표 다운로드"
                  >
                    <Download className="w-3 h-3" />
                    <span>양식</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono text-sky-500">
                    매칭 {report.matchedModelUnitCount}대 · +{formatCurrency(report.modelIncentiveTotal)}원
                  </span>
                  <div
                    className={`inline-flex items-center p-0.5 rounded-lg border text-[10px] font-black ${subSurfaceCls}`}
                  >
                    <button
                      type="button"
                      onClick={() => setIncentiveBasis('contract')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        incentiveBasis === 'contract'
                          ? isDark
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-[#18181B] text-white'
                          : mutedCls
                      }`}
                    >
                      계약월
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncentiveBasis('delivery')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        incentiveBasis === 'delivery'
                          ? isDark
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-[#18181B] text-white'
                          : mutedCls
                      }`}
                    >
                      배송월
                    </button>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[11px] font-bold">
                  ⚠️ {uploadError}
                </div>
              )}

              {showManualDrawer && (
                <div className={`p-2.5 rounded-xl border space-y-2 ${subSurfaceCls}`}>
                  <form
                    onSubmit={handleAddSingleRule}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-1.5"
                  >
                    <input
                      type="text"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder="품목(냉장고)"
                      className={`sm:col-span-3 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-bold ${shellCls}`}
                    />
                    <input
                      type="text"
                      value={manualModelCode}
                      onChange={(e) => setManualModelCode(e.target.value)}
                      placeholder="모델코드(RM70F64M2X)"
                      className={`sm:col-span-5 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <input
                      type="text"
                      value={manualIncentive}
                      onChange={(e) => setManualIncentive(e.target.value)}
                      placeholder="수당(5만)"
                      className={`sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-black cursor-pointer"
                    >
                      + 추가
                    </button>
                  </form>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder="한 줄/여러 줄 붙여넣기 (예: RM70F64M2X 5만, OLED65C4 10만)"
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono ${shellCls}`}
                    />
                    <button
                      type="button"
                      onClick={handleBulkTextApply}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black shrink-0 cursor-pointer"
                    >
                      일괄 반영
                    </button>
                  </div>
                </div>
              )}

              {showRulesDrawer && (
                <div className={`p-2.5 rounded-xl border space-y-2 ${subSurfaceCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ruleSearch}
                        onChange={(e) => setRuleSearch(e.target.value)}
                        placeholder="모델코드/품목 검색..."
                        className={`w-full pl-7 pr-2.5 py-1 rounded-lg border text-base sm:text-xs ${shellCls}`}
                      />
                    </div>
                    <label className="inline-flex items-center gap-1 text-[10px] font-bold shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceOnUpload}
                        onChange={(e) => setReplaceOnUpload(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>업로드시 교체</span>
                    </label>
                  </div>

                  {filteredRules.length === 0 ? (
                    <div className={`py-2 text-center text-[11px] font-bold ${mutedCls}`}>
                      등록된 모델 단가가 없습니다.
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 schedule-matrix-scroll">
                      {filteredRules.map((r) => (
                        <div
                          key={r.id}
                          className={`px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 text-xs ${shellCls}`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-500 text-[10px] font-black shrink-0">
                              {r.category}
                            </span>
                            <span className="font-mono font-black truncate">
                              {r.modelCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              value={r.incentiveAmount}
                              onChange={(e) =>
                                handleUpdateRuleAmount(
                                  r.id,
                                  Number(e.target.value) || 0
                                )
                              }
                              className={`w-20 px-1.5 py-0.5 rounded border text-right font-mono font-bold text-base sm:text-xs ${subSurfaceCls}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(r.id)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {quickAssignTarget && (
                <div
                  className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs ${
                    isDark
                      ? 'bg-indigo-950/50 border-indigo-400/40'
                      : 'bg-indigo-50 border-indigo-200'
                  }`}
                >
                  <span className="font-black">
                    ⚡ [{quickAssignTarget.category}]{' '}
                    <span className="font-mono text-indigo-500">
                      {quickAssignTarget.modelCode}
                    </span>{' '}
                    수당 지정
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={quickAssignAmount}
                      onChange={(e) => setQuickAssignAmount(e.target.value)}
                      placeholder="예: 5만"
                      className={`w-28 px-2 py-1 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <button
                      type="button"
                      onClick={handleQuickAssignSave}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> 반영
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAssignTarget(null)}
                      className="px-2 py-1 text-[11px] font-bold opacity-70 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {report.confirmedRowsForIncentive.length === 0 ? (
                <div
                  className={`rounded-xl border py-3 px-3 text-center text-[11px] font-bold ${subSurfaceCls} ${mutedCls}`}
                >
                  구매 확정([계약완료]·[발송완료]) 고객이 등록되면 구매 모델에서 자동 계산됩니다. (미구매 제외)
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 schedule-matrix-scroll">
                  {report.confirmedRowsForIncentive.map((row) => (
                    <div
                      key={row.customer.id}
                      onClick={() => onSelectCustomer(row.customer)}
                      className={`px-3 py-2 rounded-xl border space-y-1.5 cursor-pointer ${
                        row.customerModelIncentive > 0
                          ? isDark
                            ? 'bg-[#142030] border-sky-400/40'
                            : 'bg-white border-sky-300'
                          : subSurfaceCls
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-black truncate">
                          {row.customer.name} 고객님
                        </span>
                        <span
                          className={`font-black font-mono shrink-0 ${
                            row.customerModelIncentive > 0 ? 'text-sky-500' : mutedCls
                          }`}
                        >
                          +{formatCurrency(row.customerModelIncentive)}원
                        </span>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.modelMatches.length === 0 ? (
                          <span className={`text-[10px] ${mutedCls}`}>
                            세부 모델 미입력
                          </span>
                        ) : (
                          row.modelMatches.map((mm, mIdx) => {
                            const matched = Boolean(mm.matchedRule);
                            return matched ? (
                              <span
                                key={`${mm.modelEntry.id}-${mIdx}`}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              >
                                {mm.modelEntry.modelName}
                                {mm.modelEntry.quantity > 1 ? `×${mm.modelEntry.quantity}` : ''}{' '}
                                +{formatShortManwon(mm.subtotalIncentive)}
                              </span>
                            ) : (
                              <button
                                key={`${mm.modelEntry.id}-${mIdx}`}
                                type="button"
                                onClick={() => {
                                  setQuickAssignTarget({
                                    modelCode: mm.modelEntry.modelName,
                                    category: mm.modelEntry.category,
                                  });
                                  setQuickAssignAmount('');
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer ${subSurfaceCls}`}
                              >
                                {mm.modelEntry.modelName} +단가지정
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
