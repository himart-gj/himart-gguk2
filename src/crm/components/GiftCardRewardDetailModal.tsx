import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { formatCurrency } from '../utils/date';
import {
  ALLCARE_COUNT_UPDATED_EVENT,
  getCurrentYearMonth,
  loadAllMonthlyAllCareCounts,
  MonthlyAllCareCountsMap,
} from '../utils/settlementEngine';
import {
  AllCareQuarterOverridesMap,
  computeMonthlyGiftCardRewardReport,
  formatYearMonthKorean,
  GIFT_CARD_REWARD_UPDATED_EVENT,
  loadAllCareQuarterOverrides,
  setAllCareQuarterConfirmedOverride,
  shiftYearMonthStr,
} from '../utils/giftCardRewardEngine';

interface GiftCardRewardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialYearMonth: string;
  customers: CustomerItem[];
  isDark?: boolean;
  onSelectCustomer?: (customerId: string) => void;
  onSyncYearMonth?: (ym: string) => void;
}

export const GiftCardRewardDetailModal: React.FC<
  GiftCardRewardDetailModalProps
> = ({
  isOpen,
  onClose,
  initialYearMonth,
  customers,
  isDark = false,
  onSelectCustomer,
  onSyncYearMonth,
}) => {
  const [viewYm, setViewYm] = useState<string>(initialYearMonth);
  const [allCareMap, setAllCareMap] = useState<MonthlyAllCareCountsMap>(() =>
    loadAllMonthlyAllCareCounts()
  );
  const [quarterOverrides, setQuarterOverrides] =
    useState<AllCareQuarterOverridesMap>(() => loadAllCareQuarterOverrides());

  useEffect(() => {
    if (isOpen && initialYearMonth) {
      setViewYm(initialYearMonth);
      setAllCareMap(loadAllMonthlyAllCareCounts());
      setQuarterOverrides(loadAllCareQuarterOverrides());
    }
  }, [isOpen, initialYearMonth]);

  useEffect(() => {
    if (!isOpen) return;
    const sync = () => {
      setAllCareMap(loadAllMonthlyAllCareCounts());
      setQuarterOverrides(loadAllCareQuarterOverrides());
    };
    window.addEventListener(ALLCARE_COUNT_UPDATED_EVENT, sync);
    window.addEventListener(GIFT_CARD_REWARD_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ALLCARE_COUNT_UPDATED_EVENT, sync);
      window.removeEventListener(GIFT_CARD_REWARD_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [isOpen]);

  const currentRealYm = useMemo(() => getCurrentYearMonth(), []);

  const report = useMemo(
    () =>
      computeMonthlyGiftCardRewardReport(
        customers,
        viewYm,
        allCareMap,
        quarterOverrides
      ),
    [customers, viewYm, allCareMap, quarterOverrides]
  );

  const forwardTwoMonthsYm = useMemo(
    () => shiftYearMonthStr(viewYm, 2),
    [viewYm]
  );
  const forwardPreviewReport = useMemo(
    () =>
      viewYm >= '2026-12'
        ? computeMonthlyGiftCardRewardReport(
            customers,
            forwardTwoMonthsYm,
            allCareMap,
            quarterOverrides
          )
        : null,
    [customers, viewYm, forwardTwoMonthsYm, allCareMap, quarterOverrides]
  );

  if (!isOpen) return null;

  const handleStepMonth = (nextYm: string) => {
    setViewYm(nextYm);
    onSyncYearMonth?.(nextYm);
  };

  const handleAdjustQuarterConfirmed = (delta: number) => {
    const nextVal = Math.max(0, report.allCare.confirmedCount + delta);
    const updated = setAllCareQuarterConfirmedOverride(viewYm, nextVal);
    setQuarterOverrides(updated);
  };

  const handleResetQuarterOverride = () => {
    const updated = setAllCareQuarterConfirmedOverride(viewYm, null);
    setQuarterOverrides(updated);
  };

  const modalBg = isDark
    ? 'bg-[#111827] border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-[#191F28]';
  const cardBg = isDark
    ? 'bg-slate-900/80 border-slate-800'
    : 'bg-[#F8FAFC] border-[#E5E8EB]';
  const mutedText = isDark ? 'text-slate-400' : 'text-[#4E5968]';

  const payoutMonthNum = parseInt(viewYm.slice(5, 7), 10) || 1;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="월간 상품권 시상 상세 내역"
    >
      <div
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-2 ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-amber-50/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                상품권 시상 상세 내역
              </h3>
              <p className={`text-[11px] font-semibold truncate ${mutedText}`}>
                현금 수당과 별도로 지급 해당월 말일에 지급되는 상품권 시상
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`px-4 sm:px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-xl border ${cardBg}`}
            >
              <button
                type="button"
                onClick={() => handleStepMonth(shiftYearMonthStr(viewYm, -1))}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                title="이전 지급월"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs sm:text-sm font-black font-mono tabular-nums">
                {report.payoutMonthLabel} 지급분
              </span>
              <button
                type="button"
                onClick={() => handleStepMonth(shiftYearMonthStr(viewYm, 1))}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                title="다음 지급월"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {viewYm !== currentRealYm && (
              <button
                type="button"
                onClick={() => handleStepMonth(currentRealYm)}
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                당월
              </button>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
              report.isOverlappingMonth
                ? isDark
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
                : isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <CalendarCheck2 className="w-3.5 h-3.5" />
            {report.isOverlappingMonth
              ? `${payoutMonthNum}월 말일 합산 지급 (구독+올케어)`
              : report.payoutDateLabel}
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div
            className={`rounded-2xl border p-4 ${
              isDark
                ? 'bg-gradient-to-br from-amber-500/15 via-slate-900 to-emerald-500/10 border-amber-400/35'
                : 'bg-gradient-to-br from-amber-50 via-white to-emerald-50/60 border-amber-200'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <div className="text-xs font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{report.payoutMonthLabel} 상품권 시상 총 합계</span>
                </div>
                <div className="mt-1 text-2xl sm:text-3xl font-black font-mono tabular-nums text-[#D97706] dark:text-amber-300">
                  +{formatCurrency(report.totalGiftCardAmount)}원
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-[11.5px] font-bold">
                  구독 시상:{' '}
                  <span className="font-mono font-black text-[#1B64DA] dark:text-blue-300">
                    +{formatCurrency(report.subscription.totalRewardAmount)}원
                  </span>{' '}
                  <span className={mutedText}>
                    ({report.subscription.totalEligibleCount}개)
                  </span>
                </div>
                <div className="text-[11.5px] font-bold">
                  올케어 시상:{' '}
                  <span className="font-mono font-black text-[#059669] dark:text-emerald-300">
                    +{formatCurrency(report.allCare.totalRewardAmount)}원
                  </span>{' '}
                  <span className={mutedText}>
                    (
                    {report.allCare.isPayoutMonth
                      ? `${report.allCare.confirmedCount}개`
                      : '분기 비해당월'}
                    )
                  </span>
                </div>
              </div>
            </div>

            {forwardPreviewReport &&
              (forwardPreviewReport.subscription.totalEligibleCount > 0 ||
                forwardPreviewReport.subscription.excludedUnits.length > 0 ||
                !report.subscription.isPolicyActive) && (
                <div
                  className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 text-[11.5px] ${
                    isDark ? 'border-slate-700/80' : 'border-amber-200/80'
                  }`}
                >
                  <span className={mutedText}>
                    💡 <b>{formatYearMonthKorean(viewYm)}</b> 판매 구독건 시상은{' '}
                    <b>{formatYearMonthKorean(forwardTwoMonthsYm)} 말일</b>에 반영됩니다.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStepMonth(forwardTwoMonthsYm)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold shrink-0 cursor-pointer"
                  >
                    {parseInt(forwardTwoMonthsYm.slice(5, 7), 10)}월 지급분 보기 ›
                  </button>
                </div>
              )}
          </div>

          <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardBg}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#1B64DA] text-white">
                    구독 시상
                  </span>
                  <h4 className="text-xs sm:text-sm font-black">
                    구독 건당 상품권 시상 내역
                  </h4>
                </div>
                <p className={`mt-1 text-[11.5px] font-semibold ${mutedText}`}>
                  {report.subscription.isPolicyActive
                    ? `대상: ${report.subscription.sourceContractLabel} 판매건 중 ${report.subscription.cutoffDisplayLabel}(${report.subscription.cutoffDateStr}) 완료분`
                    : `2026년 12월 구독 판매건부터 적용됩니다 (첫 지급월: 2027년 2월 말일)`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm sm:text-base font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-300">
                  +{formatCurrency(report.subscription.totalRewardAmount)}원
                </div>
                <div className={`text-[11px] font-bold ${mutedText}`}>
                  총 {report.subscription.totalEligibleCount}개 확정
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className={`rounded-xl border px-3 py-2.5 flex items-center justify-between ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-extrabold">
                    구독 총금액 100만원 이하
                  </div>
                  <div className={`text-[11px] ${mutedText}`}>
                    건당 20,000원 × {report.subscription.underOrEqual1MCount}개
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 mr-1.5">
                    {report.subscription.underOrEqual1MCount}개
                  </span>
                  <span className="text-sm font-black font-mono tabular-nums">
                    +{formatCurrency(report.subscription.underOrEqual1MAmount)}원
                  </span>
                </div>
              </div>

              <div
                className={`rounded-xl border px-3 py-2.5 flex items-center justify-between ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-extrabold">
                    구독 총금액 100만원 초과
                  </div>
                  <div className={`text-[11px] ${mutedText}`}>
                    건당 50,000원 × {report.subscription.over1MCount}개
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 mr-1.5">
                    {report.subscription.over1MCount}개
                  </span>
                  <span className="text-sm font-black font-mono tabular-nums">
                    +{formatCurrency(report.subscription.over1MAmount)}원
                  </span>
                </div>
              </div>
            </div>

            {report.subscription.eligibleUnits.length > 0 ? (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {report.subscription.eligibleUnits.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (onSelectCustomer) {
                        onSelectCustomer(u.customerId);
                        onClose();
                      }
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      onSelectCustomer ? 'cursor-pointer hover:border-blue-400' : ''
                    } ${
                      isDark
                        ? 'bg-slate-950/40 border-slate-800'
                        : 'bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold truncate">
                        {u.customerName} · {u.modelLabel}
                      </div>
                      <div className={`text-[11px] ${mutedText}`}>
                        구독총액 {formatCurrency(u.principalAmount)}원 (
                        {u.tier === 'over_1m' ? '100만 초과' : '100만 이하'}) · 실판{' '}
                        {u.deliveryDateStr}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-black shrink-0 ${
                        u.tier === 'over_1m'
                          ? 'text-[#1B64DA] dark:text-blue-300'
                          : 'text-sky-600 dark:text-sky-300'
                      }`}
                    >
                      +{formatCurrency(u.rewardAmount)}원
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              report.subscription.isPolicyActive && (
                <div
                  className={`rounded-xl border border-dashed px-3 py-2.5 text-center text-xs ${mutedText} ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  {report.subscription.sourceContractLabel} 판매건 중{' '}
                  {report.subscription.cutoffDisplayLabel} 내 실판 확정된 구독 내역이
                  아직 없습니다.
                </div>
              )
            )}

            {report.subscription.excludedUnits.length > 0 && (
              <div
                className={`rounded-xl border px-3 py-2 text-[11.5px] space-y-1 ${
                  isDark
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="font-extrabold">
                  ⚠️ 실판 기한({report.subscription.cutoffDateStr}) 미충족·배달일 미입력 제외:{' '}
                  {report.subscription.excludedUnits.length}개
                </div>
                <div className="space-y-0.5">
                  {report.subscription.excludedUnits.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        • {ex.customerName} ({ex.modelLabel} ·{' '}
                        {formatCurrency(ex.principalAmount)}원)
                      </span>
                      <span className="font-bold shrink-0">
                        {ex.excludeReason === 'undated'
                          ? '실판일 미입력'
                          : `실판 ${ex.deliveryDateStr} (15일 초과)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardBg}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#059669] text-white">
                    올케어 시상
                  </span>
                  <h4 className="text-xs sm:text-sm font-black">
                    가전올케어 3개월 합산 상품권 시상
                  </h4>
                </div>
                <p className={`mt-1 text-[11.5px] font-semibold ${mutedText}`}>
                  {report.allCare.isPayoutMonth
                    ? `대상: ${report.allCare.quarterLabel} 합산 (${report.allCare.cutoffDisplayLabel} 기준 · 건당 5,000원)`
                    : `분기별 3개월 합산 → 익월 15일 실판 시 익익월(5·8·11·익년2월) 말일 지급`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm sm:text-base font-black font-mono tabular-nums text-[#059669] dark:text-emerald-300">
                  +{formatCurrency(report.allCare.totalRewardAmount)}원
                </div>
                <div className={`text-[11px] font-bold ${mutedText}`}>
                  {report.allCare.isPayoutMonth
                    ? `${report.allCare.quarterShortLabel} 합산 ${report.allCare.confirmedCount}개`
                    : '이번 달 비지급월'}
                </div>
              </div>
            </div>

            {report.allCare.isPayoutMonth ? (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {report.allCare.monthlyBreakdown.map((mItem) => (
                    <div
                      key={mItem.yearMonth}
                      className={`rounded-xl border px-2.5 py-2 text-center ${
                        isDark
                          ? 'bg-slate-950/60 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-bold ${mutedText}`}>
                        {mItem.label}
                      </div>
                      <div className="mt-0.5 text-sm font-black font-mono tabular-nums">
                        {mItem.count}개
                      </div>
                    </div>
                  ))}
                  <div
                    className={`rounded-xl border px-2.5 py-2 text-center ${
                      isDark
                        ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">
                      {report.allCare.quarterShortLabel} 합산
                    </div>
                    <div className="mt-0.5 text-sm font-black font-mono tabular-nums">
                      {report.allCare.rawQuarterTotalCount}개
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
                    isDark
                      ? 'bg-slate-950/60 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {report.allCare.cutoffDisplayLabel} 완료 인정 건수 × 5,000원
                      </span>
                    </div>
                    <div className={`text-[11px] ${mutedText}`}>
                      {report.allCare.hasManualOverride
                        ? `수동 보정 적용 중 (원본 3개월 합산 ${report.allCare.rawQuarterTotalCount}개)`
                        : '3개월 입력 수량이 자동 합산되었습니다 (미실판 건이 있으면 조정 가능)'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {report.allCare.hasManualOverride && (
                      <button
                        type="button"
                        onClick={handleResetQuarterOverride}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1 cursor-pointer"
                        title="3개월 자동 합산값으로 복원"
                      >
                        <RotateCcw className="w-3 h-3" />
                        자동합산
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAdjustQuarterConfirmed(-1)}
                      disabled={report.allCare.confirmedCount <= 0}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center disabled:opacity-35 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      aria-label="실판 인정 건수 1 감소"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="min-w-[44px] text-center text-sm font-black font-mono tabular-nums text-[#059669] dark:text-emerald-300">
                      {report.allCare.confirmedCount}개
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustQuarterConfirmed(1)}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      aria-label="실판 인정 건수 1 증가"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div
                className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${
                  isDark
                    ? 'bg-slate-950/50 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="font-bold">
                  📅 올케어 분기 합산 지급 스케줄 (2027년 1월 판매분부터)
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] ${mutedText}`}>
                  <div>• 1~3월 합산 (4/15 실판) → <b>5월 말일</b> 지급</div>
                  <div>• 4~6월 합산 (7/15 실판) → <b>8월 말일</b> 지급</div>
                  <div>• 7~9월 합산 (10/15 실판) → <b>11월 말일</b> 지급</div>
                  <div>• 10~12월 합산 (1/15 실판) → <b>익년 2월 말일</b> 지급</div>
                </div>
                {report.allCare.upcomingQuarterHint && (
                  <div
                    className={`mt-1.5 pt-1.5 border-t flex items-center justify-between gap-2 text-[11.5px] ${
                      isDark ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <span>
                      진행 분기(<b>{report.allCare.upcomingQuarterHint.quarterLabel}</b>) 누적:{' '}
                      <b>{report.allCare.upcomingQuarterHint.accumulatedCount}개</b> (예상 +
                      {formatCurrency(
                        report.allCare.upcomingQuarterHint.expectedAmount
                      )}
                      원)
                    </span>
                    <span className={`font-bold shrink-0 ${mutedText}`}>
                      {report.allCare.upcomingQuarterHint.payoutMonthLabel}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className={`px-4 sm:px-5 py-3 border-t flex items-center justify-between gap-2 ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/70'
          }`}
        >
          <span className={`text-[11px] font-semibold ${mutedText}`}>
            구독 총액 100만 초과 5만 / 이하 2만 · 올케어 건당 5천원
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs font-extrabold cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
