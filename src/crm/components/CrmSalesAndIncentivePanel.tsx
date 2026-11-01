import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
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
  Sparkles,
  Trash2,
  Truck,
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
import { SpringNumberFlow } from '../../components/SpringNumberFlow';

interface CrmSalesAndIncentivePanelProps {
  customers: CustomerItem[];
  isDark: boolean;
  selectedYearMonth: string;
  onChangeYearMonth: (ym: string) => void;
  activeTab: SettlementTabId;
  onChangeTab: (tab: SettlementTabId) => void;
  onSelectCustomer: (customer: CustomerItem) => void;
  onShowToast?: (msg: string) => void;
}

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y || new Date().getFullYear(), (m || 1) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
}) => {
  const [incentiveBasis, setIncentiveBasis] =
    useState<IncentiveMonthBasis>('contract');
  const [salesSubView, setSalesSubView] = useState<
    'gross' | 'delivery' | 'undated'
  >('gross');

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

  const monthNum = parseInt(selectedYearMonth.split('-')[1] || '1', 10);
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
        `📊 ${formatYearMonthKo(selectedYearMonth)} 모델 수당표 반영 완료! (총 ${
          nextSheet.rules.length
        }개 모델)`
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
        `📷 사진에서 ${totalParsed.length}개 모델 수당을 추출했습니다! (누적 ${nextSheet.rules.length}개)`
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
      '직접 입력 및 업로드 통합본',
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    setManualModelCode('');
    setManualIncentive('');
    onShowToast?.(`✅ [${code}] 수당 ${formatCurrency(amt)}원이 등록되었습니다.`);
  };

  const handleBulkTextApply = () => {
    const parsed = parseModelIncentiveFreeText(bulkPasteText);
    if (parsed.length === 0) {
      setUploadError(
        '인식된 모델/수당 줄이 없습니다. 예: "RM70F64M2X 50000" 또는 "OLED65C4 10만" 형태로 입력해 주세요.'
      );
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
    onShowToast?.(
      `✅ ${parsed.length}개 모델 수당이 일괄 반영되었습니다! (총 ${next.rules.length}개)`
    );
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
      `💰 [${quickAssignTarget.modelCode}] 모델 수당 ${formatCurrency(
        amt
      )}원이 자동 반영되었습니다!`
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
      `${formatYearMonthKo(prevYearMonth)} 단가표 복사본`,
      false
    );
    setSheetsMap(loadAllModelIncentiveSheets());
    onShowToast?.(
      `📋 ${formatYearMonthKo(prevYearMonth)} 수당 단가표(${next.rules.length}개)를 불러왔습니다.`
    );
  };

  const shellCls = isDark
    ? 'bg-[#151A25] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';
  const subSurfaceCls = isDark
    ? 'bg-[#0E131D] border-white/10'
    : 'bg-[#FAF8F4] border-[#E4DFD5]';
  const mutedCls = isDark ? 'text-slate-400' : 'text-[#78716C]';

  const renderSaleTypeBadge = (
    saleType: 'general' | 'subscription' | 'hybrid'
  ) => {
    if (saleType === 'subscription') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/25">
          구독원금 기준
        </span>
      );
    }
    if (saleType === 'hybrid') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
          일반합계+구독원금
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-600 border border-sky-500/25">
        제품합계 기준
      </span>
    );
  };

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
      className={`rounded-3xl border p-4 sm:p-5 shadow-2xs space-y-4 ${shellCls}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-2xl border ${subSurfaceCls}`}
          >
            <button
              type="button"
              onClick={() =>
                onChangeYearMonth(shiftYearMonth(selectedYearMonth, -1))
              }
              className="p-1.5 rounded-xl hover:bg-black/5 cursor-pointer schedule-tactile"
              title="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-sm font-black font-mono">
              {formatYearMonthKo(selectedYearMonth)}
            </span>
            <button
              type="button"
              onClick={() =>
                onChangeYearMonth(shiftYearMonth(selectedYearMonth, 1))
              }
              className="p-1.5 rounded-xl hover:bg-black/5 cursor-pointer schedule-tactile"
              title="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedYearMonth !== currentRealYm && (
            <button
              type="button"
              onClick={() => onChangeYearMonth(currentRealYm)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                isDark
                  ? 'bg-sky-400/15 text-sky-300 border-sky-400/30'
                  : 'bg-[#F4ECE1] text-[#8C5A32] border-[#DCCBB2]'
              }`}
            >
              이번 달로 이동
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>실적기준: 일반=제품합계금액 · 구독=구독원금 (확정고객 전용)</span>
          </span>
        </div>

        <div
          className={`flex items-center justify-between sm:justify-end gap-3 px-3.5 py-2 rounded-2xl border ${
            isDark
              ? 'bg-gradient-to-r from-[#17253B] to-[#121D2F] border-amber-400/35'
              : 'bg-gradient-to-r from-[#FAF4EA] to-[#FFFDF9] border-[#DFC9AC]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black">
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{monthNum}월 총 수당 적립</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-amber-500">
            +<SpringNumberFlow value={report.grandTotalIncentive} suffix="원" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onChangeTab('sales');
            setSalesSubView('gross');
          }}
          className={`text-left rounded-2xl border p-4 transition cursor-pointer schedule-tactile space-y-1.5 ${
            activeTab === 'sales' && salesSubView === 'gross'
              ? isDark
                ? 'bg-[#1A2436] border-emerald-400/60 ring-1 ring-emerald-400/30'
                : 'bg-[#F6FBF8] border-emerald-500/60 ring-1 ring-emerald-500/20'
              : subSurfaceCls
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-600 text-white">
                총판
              </span>
              <span className="text-xs sm:text-sm font-black">
                {monthNum}월 당월 계약 매출
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono bg-emerald-500/15 text-emerald-500">
              확정 {report.grossRows.length}건
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-500">
            <SpringNumberFlow value={report.grossSalesTotal} suffix="원" />
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold pt-1 border-t ${
              isDark ? 'border-white/10' : 'border-[#E4DFD5]'
            } ${mutedCls}`}
          >
            <span>
              일반 합계{' '}
              <strong className={isDark ? 'text-slate-200' : 'text-[#18181B]'}>
                {formatShortManwon(report.grossGeneralTotal)}
              </strong>{' '}
              · 구독원금{' '}
              <strong className={isDark ? 'text-rose-300' : 'text-rose-600'}>
                {formatShortManwon(report.grossSubPrincipalTotal)}
              </strong>
            </span>
            <span className="text-[10px] opacity-80">계약월 기준 ›</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onChangeTab('sales');
            setSalesSubView('delivery');
          }}
          className={`text-left rounded-2xl border p-4 transition cursor-pointer schedule-tactile space-y-1.5 ${
            activeTab === 'sales' && salesSubView === 'delivery'
              ? isDark
                ? 'bg-[#192338] border-sky-400/60 ring-1 ring-sky-400/30'
                : 'bg-[#F4F9FE] border-sky-500/60 ring-1 ring-sky-500/20'
              : subSurfaceCls
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-sky-600 text-white">
                실판
              </span>
              <span className="text-xs sm:text-sm font-black">
                {monthNum}월 당월 배송출고 매출
              </span>
            </div>
            <div className="flex items-center gap-1">
              {report.undatedConfirmedCount > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeTab('sales');
                    setSalesSubView('undated');
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30"
                  title="배송일이 아직 입력되지 않은 당월 확정 고객"
                >
                  일정미정 {report.undatedConfirmedCount}건
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono bg-sky-500/15 text-sky-500">
                배송 {report.netDeliveryRows.length}건
              </span>
            </div>
          </div>

          <div
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              isDark ? 'text-sky-400' : 'text-blue-600'
            }`}
          >
            <SpringNumberFlow value={report.netDeliverySalesTotal} suffix="원" />
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold pt-1 border-t ${
              isDark ? 'border-white/10' : 'border-[#E4DFD5]'
            } ${mutedCls}`}
          >
            <span>
              일반 합계{' '}
              <strong className={isDark ? 'text-slate-200' : 'text-[#18181B]'}>
                {formatShortManwon(report.netGeneralTotal)}
              </strong>{' '}
              · 구독원금{' '}
              <strong className={isDark ? 'text-rose-300' : 'text-rose-600'}>
                {formatShortManwon(report.netSubPrincipalTotal)}
              </strong>
            </span>
            <span className="text-[10px] opacity-80">배송월 기준 ›</span>
          </div>
        </button>
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 rounded-2xl border ${subSurfaceCls}`}
      >
        <button
          type="button"
          onClick={() => onChangeTab('sales')}
          className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between sm:justify-center gap-2 cursor-pointer schedule-tab-btn ${
            activeTab === 'sales'
              ? isDark
                ? 'bg-[#1E2738] text-white border border-sky-400/35 shadow-xs'
                : 'bg-[#18181B] text-white shadow-xs'
              : mutedCls
          }`}
        >
          <span>📊 총판 · 실판 확정내역</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400">
            {report.grossRows.length}/{report.netDeliveryRows.length}건
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('freed')}
          className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between sm:justify-center gap-2 cursor-pointer schedule-tab-btn ${
            activeTab === 'freed'
              ? isDark
                ? 'bg-[#1E2738] text-amber-300 border border-amber-400/40 shadow-xs'
                : 'bg-[#18181B] text-amber-300 shadow-xs'
              : mutedCls
          }`}
        >
          <span>💎 프리드 가입 · 수당</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-500">
            {report.freedSummary.totalCount}건 · +
            {formatShortManwon(report.freedSummary.totalIncentive)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('models')}
          className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between sm:justify-center gap-2 cursor-pointer schedule-tab-btn ${
            activeTab === 'models'
              ? isDark
                ? 'bg-[#1E2738] text-sky-300 border border-sky-400/40 shadow-xs'
                : 'bg-[#18181B] text-sky-300 shadow-xs'
              : mutedCls
          }`}
        >
          <span>🏷️ 제품 모델별 수당</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-500">
            {report.matchedModelUnitCount}대 · +
            {formatShortManwon(report.modelIncentiveTotal)}
          </span>
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                {
                  id: 'gross' as const,
                  label: `총판 확정 (${report.grossRows.length}건)`,
                },
                {
                  id: 'delivery' as const,
                  label: `실판 배송 (${report.netDeliveryRows.length}건)`,
                },
                ...(report.undatedConfirmedCount > 0
                  ? [
                      {
                        id: 'undated' as const,
                        label: `⚠️ 배송일 미지정 (${report.undatedConfirmedCount}건)`,
                      },
                    ]
                  : []),
              ].map((pill) => {
                const active = salesSubView === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSalesSubView(pill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer schedule-tactile ${
                      active
                        ? isDark
                          ? 'bg-sky-400 text-slate-950 border-sky-300'
                          : 'bg-[#8C5A32] text-white border-[#8C5A32]'
                        : subSurfaceCls
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <span className={`text-[11px] font-bold ${mutedCls}`}>
              ※ 미구매·상담중 고객은 자동 제외되며 계약완료·발송완료 건만 집계됩니다
            </span>
          </div>

          {activeSalesRows.length === 0 ? (
            <div
              className={`rounded-2xl border p-6 text-center text-xs font-bold ${subSurfaceCls} ${mutedCls}`}
            >
              {formatYearMonthKo(selectedYearMonth)}에 해당하는 구매 확정 고객 내역이
              없습니다. (고객 상태를 [계약완료] 또는 [발송완료]로 변경하면 즉시
              반영됩니다)
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1 schedule-matrix-scroll">
              {activeSalesRows.map((row) => (
                <button
                  key={row.customer.id}
                  type="button"
                  onClick={() => onSelectCustomer(row.customer)}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer schedule-tactile flex flex-col justify-between gap-2 ${subSurfaceCls}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black truncate">
                          {row.customer.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-500">
                          {row.customer.status}
                        </span>
                        {renderSaleTypeBadge(row.profile.saleType)}
                      </div>
                      <p className={`text-xs font-semibold truncate mt-1 ${mutedCls}`}>
                        {row.customer.items || '품목 미입력'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold opacity-70">
                        실적 기준액
                      </div>
                      <div className="text-sm sm:text-base font-black font-mono text-emerald-500">
                        {formatCurrency(row.profile.performanceAmount)}원
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] font-mono ${
                      isDark ? 'border-white/10' : 'border-[#E4DFD5]'
                    } ${mutedCls}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      계약(총판): {row.profile.contractDateStr || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-3 h-3 text-sky-500" />
                      배송(실판):{' '}
                      <strong
                        className={
                          row.customer.deliveryDate
                            ? isDark
                              ? 'text-sky-300'
                              : 'text-blue-700'
                            : 'text-amber-500'
                        }
                      >
                        {row.customer.deliveryDate || '미지정 (클릭해 입력)'}
                      </strong>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'freed' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black">
                💎 {formatYearMonthKo(selectedYearMonth)} 프리드 가입 종류별 수당 정산
              </span>
              <span className={`text-[11px] font-bold ${mutedCls}`}>
                (구매 확정 고객 기준)
              </span>
            </div>

            <div
              className={`inline-flex items-center p-0.5 rounded-xl border text-[11px] font-black ${subSurfaceCls}`}
            >
              <button
                type="button"
                onClick={() => setIncentiveBasis('contract')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  incentiveBasis === 'contract'
                    ? isDark
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#18181B] text-white'
                    : mutedCls
                }`}
              >
                계약월(총판) 기준
              </button>
              <button
                type="button"
                onClick={() => setIncentiveBasis('delivery')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  incentiveBasis === 'delivery'
                    ? isDark
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-[#18181B] text-white'
                    : mutedCls
                }`}
              >
                배송월(실판) 기준
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div
              className={`col-span-2 sm:col-span-1 rounded-2xl border p-3 space-y-1 ${
                report.freedSummary.plusSubCount > 0
                  ? isDark
                    ? 'bg-rose-500/15 border-rose-400/40'
                    : 'bg-rose-50/80 border-rose-200'
                  : subSurfaceCls
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-rose-500">플러스 구독</span>
                <span className={`text-[10px] font-mono ${mutedCls}`}>
                  건당 9만
                </span>
              </div>
              <div className="text-xl font-black font-mono">
                {report.freedSummary.plusSubCount}
                <span className="text-xs font-bold ml-0.5">건</span>
              </div>
              <div className="text-xs font-black font-mono text-rose-500">
                +{formatCurrency(report.freedSummary.plusSubIncentive)}원
              </div>
              <div className={`text-[10px] font-semibold ${mutedCls}`}>
                72({report.freedSummary.counts.hi72}) · 90(
                {report.freedSummary.counts.hi90}) · 108(
                {report.freedSummary.counts.hi108})
              </div>
            </div>

            {[
              {
                key: 'hf75' as const,
                title: '하이프리드 75',
                unitLabel: '건당 6만',
                count: report.freedSummary.counts.hf75,
                amount: report.freedSummary.hf75Incentive,
              },
              {
                key: 'hf150' as const,
                title: '하이프리드 150',
                unitLabel: '건당 12만',
                count: report.freedSummary.counts.hf150,
                amount: report.freedSummary.hf150Incentive,
              },
              {
                key: 'hf225' as const,
                title: '하이프리드 225',
                unitLabel: '건당 18만',
                count: report.freedSummary.counts.hf225,
                amount: report.freedSummary.hf225Incentive,
              },
              {
                key: 'hf300' as const,
                title: '하이프리드 300',
                unitLabel: '건당 24만',
                count: report.freedSummary.counts.hf300,
                amount: report.freedSummary.hf300Incentive,
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border p-3 space-y-1 ${
                  item.count > 0
                    ? isDark
                      ? 'bg-amber-400/15 border-amber-400/40'
                      : 'bg-amber-50/90 border-amber-300'
                    : subSurfaceCls
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span>{item.title}</span>
                  <span className={`text-[10px] font-mono ${mutedCls}`}>
                    {item.unitLabel}
                  </span>
                </div>
                <div className="text-xl font-black font-mono">
                  {item.count}
                  <span className="text-xs font-bold ml-0.5">건</span>
                </div>
                <div className="text-xs font-black font-mono text-amber-500">
                  +{formatCurrency(item.amount)}원
                </div>
                <div className={`text-[10px] font-semibold ${mutedCls}`}>
                  일반 결합상품
                </div>
              </div>
            ))}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
              isDark
                ? 'bg-[#121927] border-amber-400/30'
                : 'bg-[#FAF5EB] border-[#DCCBB2]'
            }`}
          >
            <div className="text-xs font-extrabold">
              <span>
                총 프리드 가입{' '}
                <strong className="font-mono">
                  {report.freedSummary.totalCount}건
                </strong>{' '}
                (플러스 구독 {report.freedSummary.plusSubCount}건 + 일반 프리드{' '}
                {report.freedSummary.generalCount}건)
              </span>
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-amber-500">
              프리드 수당 합계: +{formatCurrency(report.freedSummary.totalIncentive)}원
            </div>
          </div>

          {report.freedCustomerRows.length === 0 ? (
            <div
              className={`rounded-2xl border p-5 text-center text-xs font-bold ${subSurfaceCls} ${mutedCls}`}
            >
              이번 달 프리드가 포함된 구매 확정 고객이 아직 없습니다. (견적기에서
              프리드 선택 후 [계약완료]로 저장하거나 고객 카드에서 프리드 구좌를
              지정해 보세요)
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1 schedule-matrix-scroll">
              {report.freedCustomerRows.map((row) => (
                <button
                  key={row.customer.id}
                  type="button"
                  onClick={() => onSelectCustomer(row.customer)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2.5 cursor-pointer schedule-tactile ${subSurfaceCls}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black">
                        {row.customer.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-500">
                        {row.customer.status}
                      </span>
                      <span className={`text-[11px] font-mono ${mutedCls}`}>
                        {incentiveBasis === 'delivery'
                          ? `배송 ${row.customer.deliveryDate || '-'}`
                          : `계약 ${row.profile.contractDateStr || '-'}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {row.profile.freedDetail.summaryBadges.map((b, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            isDark
                              ? 'bg-amber-400/15 text-amber-300'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold opacity-65">프리드 수당</div>
                    <div className="text-sm font-black font-mono text-amber-500">
                      +{formatCurrency(row.customerFreedIncentive)}원
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black">
                  🏷️ {formatYearMonthKo(selectedYearMonth)} 제품 모델별 수당 자동 정산
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500">
                  ✓ 구매 확정 고객만 자동 반영 (미구매 제외)
                </span>
              </div>
              <p className={`text-[11px] font-semibold mt-0.5 ${mutedCls}`}>
                매월 수당표 사진·엑셀을 업로드하면 구매 확정 고객 카드의 구매 모델과
                자동 매칭되어 수당이 합산됩니다.
              </p>
            </div>

            <div
              className={`inline-flex items-center p-0.5 rounded-xl border text-[11px] font-black ${subSurfaceCls}`}
            >
              <button
                type="button"
                onClick={() => setIncentiveBasis('contract')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  incentiveBasis === 'contract'
                    ? isDark
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-[#18181B] text-white'
                    : mutedCls
                }`}
              >
                계약월(총판) 기준
              </button>
              <button
                type="button"
                onClick={() => setIncentiveBasis('delivery')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  incentiveBasis === 'delivery'
                    ? isDark
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-[#18181B] text-white'
                    : mutedCls
                }`}
              >
                배송월(실판) 기준
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-3 ${subSurfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer schedule-tactile"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  <span>사진·캡처 업로드 (AI)</span>
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
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer schedule-tactile"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>엑셀·CSV 업로드</span>
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
                  className={`px-3 py-2 rounded-xl border text-xs font-black inline-flex items-center gap-1 cursor-pointer schedule-tactile ${shellCls}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>모델 직접·텍스트 추가</span>
                </button>

                {prevSheet && prevSheet.rules.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyFromPrevMonth}
                    className={`px-3 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer schedule-tactile ${shellCls}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>전월 단가표 불러오기</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceOnUpload}
                    onChange={(e) => setReplaceOnUpload(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  <span>업로드 시 기존 목록 교체</span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    downloadModelIncentiveExcelTemplate(
                      selectedYearMonth,
                      currentSheet?.rules || []
                    )
                  }
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${shellCls}`}
                  title="현재 단가표를 엑셀로 내려받거나 업로드 양식을 받습니다"
                >
                  <Download className="w-3 h-3" />
                  <span>엑셀 양식/저장</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRulesDrawer((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${
                    isDark
                      ? 'bg-sky-400/15 text-sky-300 border-sky-400/30'
                      : 'bg-[#F4ECE1] text-[#8C5A32] border-[#DCCBB2]'
                  }`}
                >
                  <span>등록 단가표 ({currentSheet?.rules.length || 0}개)</span>
                  {showRulesDrawer ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold">
                ⚠️ {uploadError}
              </div>
            )}

            {showManualDrawer && (
              <div className={`p-3 rounded-2xl border space-y-3 ${shellCls}`}>
                <form
                  onSubmit={handleAddSingleRule}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2"
                >
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    placeholder="품목 (예: 냉장고)"
                    className={`sm:col-span-3 px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${subSurfaceCls}`}
                  />
                  <input
                    type="text"
                    value={manualModelCode}
                    onChange={(e) => setManualModelCode(e.target.value)}
                    placeholder="모델코드 (예: RM70F64M2X)"
                    className={`sm:col-span-5 px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono ${subSurfaceCls}`}
                  />
                  <input
                    type="text"
                    value={manualIncentive}
                    onChange={(e) => setManualIncentive(e.target.value)}
                    placeholder="수당 (예: 50000 또는 5만)"
                    className={`sm:col-span-2 px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono ${subSurfaceCls}`}
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer"
                  >
                    + 단가 추가
                  </button>
                </form>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className={mutedCls}>
                      또는 카톡·엑셀 표 내용을 여러 줄 복사해 붙여넣기 (예:
                      RM70F64M2X 5만)
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkTextApply}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black cursor-pointer"
                    >
                      붙여넣기 일괄 반영
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                    placeholder={`RM70F64M2X 50000\nW20WAN 7만\nOLED65C4 100,000`}
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono ${subSurfaceCls}`}
                  />
                </div>
              </div>
            )}

            {showRulesDrawer && (
              <div className={`p-3 rounded-2xl border space-y-2.5 ${shellCls}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      placeholder="등록된 모델코드 또는 품목 검색..."
                      className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-base sm:text-xs font-semibold ${subSurfaceCls}`}
                    />
                  </div>
                  {currentSheet && (
                    <span className={`text-[11px] font-mono ${mutedCls}`}>
                      최근 반영: {currentSheet.updatedAt}
                    </span>
                  )}
                </div>

                {filteredRules.length === 0 ? (
                  <div className={`py-4 text-center text-xs font-bold ${mutedCls}`}>
                    등록된 모델 수당 단가가 없습니다. 위에서 사진이나 엑셀을
                    업로드해 주세요.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 schedule-matrix-scroll">
                    {filteredRules.map((r) => (
                      <div
                        key={r.id}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${subSurfaceCls}`}
                      >
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 text-[10px] font-black">
                            {r.category}
                          </span>
                          <span className="font-mono font-black">
                            {r.modelCode}
                          </span>
                          {r.productName && (
                            <span className={`text-[11px] truncate ${mutedCls}`}>
                              {r.productName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            value={r.incentiveAmount}
                            onChange={(e) =>
                              handleUpdateRuleAmount(
                                r.id,
                                Number(e.target.value) || 0
                              )
                            }
                            className={`w-24 px-2 py-1 rounded-lg border text-right font-mono font-black text-base sm:text-xs ${shellCls}`}
                          />
                          <span className="text-[11px] font-bold">원</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
              isDark
                ? 'bg-[#121D2D] border-sky-400/30'
                : 'bg-[#F3F8FE] border-sky-200'
            }`}
          >
            <div className="text-xs font-extrabold flex items-center gap-2 flex-wrap">
              <Award className="w-4 h-4 text-sky-500" />
              <span>
                확정 고객 <strong>{report.confirmedRowsForIncentive.length}명</strong>{' '}
                중 수당 매칭 <strong>{report.matchedCustomerCount}명</strong> (총{' '}
                <strong>{report.matchedModelUnitCount}대</strong> 매칭)
              </span>
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-sky-500">
              제품 모델 수당 합계: +{formatCurrency(report.modelIncentiveTotal)}원
            </div>
          </div>

          {quickAssignTarget && (
            <div
              className={`rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                isDark
                  ? 'bg-indigo-950/50 border-indigo-400/40'
                  : 'bg-indigo-50 border-indigo-200'
              }`}
            >
              <div className="text-xs font-black">
                ⚡ [{quickAssignTarget.category}]{' '}
                <span className="font-mono text-indigo-500">
                  {quickAssignTarget.modelCode}
                </span>{' '}
                수당 단가 지정 ({formatYearMonthKo(selectedYearMonth)} 공통 적용)
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={quickAssignAmount}
                  onChange={(e) => setQuickAssignAmount(e.target.value)}
                  placeholder="예: 50000 또는 5만"
                  className={`w-36 px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                />
                <button
                  type="button"
                  onClick={handleQuickAssignSave}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> 반영
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAssignTarget(null)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold opacity-70 cursor-pointer"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {report.confirmedRowsForIncentive.length === 0 ? (
            <div
              className={`rounded-2xl border p-6 text-center text-xs font-bold ${subSurfaceCls} ${mutedCls}`}
            >
              {formatYearMonthKo(selectedYearMonth)}에 구매 확정([계약완료] ·
              [발송완료])된 고객 카드가 없습니다. 고객이 구매 확정되면 카드 내 구매
              모델에서 자동으로 수당이 계산됩니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1 schedule-matrix-scroll">
              {report.confirmedRowsForIncentive.map((row) => (
                <div
                  key={row.customer.id}
                  onClick={() => onSelectCustomer(row.customer)}
                  className={`p-3.5 rounded-2xl border space-y-2.5 cursor-pointer transition schedule-tactile ${
                    row.customerModelIncentive > 0
                      ? isDark
                        ? 'bg-[#142030] border-sky-400/40'
                        : 'bg-white border-sky-300 shadow-2xs'
                      : subSurfaceCls
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black">
                          {row.customer.name} 고객님
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-500">
                          {row.customer.status}
                        </span>
                        <span className={`text-[10px] font-mono ${mutedCls}`}>
                          {incentiveBasis === 'delivery'
                            ? `배송 ${row.customer.deliveryDate || '-'}`
                            : `계약 ${row.profile.contractDateStr || '-'}`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold opacity-70">
                        모델 수당 합계
                      </div>
                      <div
                        className={`text-sm font-black font-mono ${
                          row.customerModelIncentive > 0
                            ? 'text-sky-500'
                            : mutedCls
                        }`}
                      >
                        +{formatCurrency(row.customerModelIncentive)}원
                      </div>
                    </div>
                  </div>

                  <div
                    className="space-y-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.modelMatches.length === 0 ? (
                      <div className={`text-[11px] ${mutedCls}`}>
                        등록된 세부 모델코드가 없습니다 (카드 클릭하여 모델 입력)
                      </div>
                    ) : (
                      row.modelMatches.map((mm, mIdx) => {
                        const matched = Boolean(mm.matchedRule);
                        return (
                          <div
                            key={`${mm.modelEntry.id}-${mIdx}`}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              matched
                                ? isDark
                                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                : isDark
                                ? 'bg-[#0B0E14]/70 border-white/10 text-slate-300'
                                : 'bg-white/80 border-[#E4DFD5] text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black opacity-75">
                                [{mm.modelEntry.category}]
                              </span>
                              <span className="font-mono font-black truncate">
                                {mm.modelEntry.modelName}
                              </span>
                              {mm.modelEntry.quantity > 1 && (
                                <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-black/10">
                                  ×{mm.modelEntry.quantity}대
                                </span>
                              )}
                            </div>

                            {matched ? (
                              <span className="font-mono font-black text-emerald-500 shrink-0">
                                +{formatCurrency(mm.subtotalIncentive)}원
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAssignTarget({
                                    modelCode: mm.modelEntry.modelName,
                                    category: mm.modelEntry.category,
                                  });
                                  setQuickAssignAmount('');
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border shrink-0 cursor-pointer ${
                                  isDark
                                    ? 'bg-white/5 hover:bg-white/15 text-sky-300 border-white/10'
                                    : 'bg-[#FAF8F4] hover:bg-[#EAE5DC] text-[#8C5A32] border-[#D6D0C4]'
                                }`}
                              >
                                + 수당단가 지정
                              </button>
                            )}
                          </div>
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
    </section>
  );
};
