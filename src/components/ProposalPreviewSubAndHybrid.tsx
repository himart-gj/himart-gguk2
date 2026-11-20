import React from 'react';
import {
  getSubscriptionItemPrincipal,
  getSubscriptionSurplusMeta,
  getValidDisplayModelName,
  normalizeSubscriptionPeriod,
  SubscriptionPeriod,
} from '../types/proposal';
import { Layers, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, User } from 'lucide-react';
import { SpringNumberFlow } from './SpringNumberFlow';
import {
  CardDiscountTermNotice,
  CardSpendSimulationBadge,
  HiPlusInBoxCallout,
  HiPlusInlineSummaryCard,
  PreedSafetyGuideBox,
} from './ProposalComplianceBlocks';

const sanitizeFiveYearText = (text?: string): string => {
  if (!text) return '';
  return text.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1');
};

export const ProposalPreviewSubAndHybrid: React.FC<Record<string, any>> = ({
  activeCustomer,
  activePlan,
  cardMonthlyDiscount,
  currentCard,
  currentCardTier,
  finalMonthlyFee,
  finalTotal60Fee,
  fmtCat,
  fmtModel,
  generalHiPreedSummary,
  generalSummary,
  hasBothPlans,
  hiPlusMonthlySupport,
  hybridCombinedNetTotal,
  hybridTotalDiscountAndSupport,
  periodLabel,
  representativePeriod,
  state,
  subCardBenefitLabel,
  subFormulaText,
  subHeaderTitle,
  subSummary,
  totalBaseMonthly,
  totalPrincipal,
  useMobileFluid,
}) => {
  const step1DiscountRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.instantDiscount > 0
      ? [
          {
            key: 'instant-base',
            label: '기본 즉시할인',
            amount: generalSummary.instantDiscount,
          },
        ]
      : []),
    ...(generalSummary.extraDiscountItems || []).map((it: any, idx: number) => ({
      key: it.id || `extra-disc-${idx}`,
      label: (it.description || '').trim() || '추가 즉시할인',
      amount: Math.max(0, Number(it.amount) || 0),
    })),
    ...(generalSummary.pointUsed > 0
      ? [
          {
            key: 'point-used',
            label: '포인트 즉시사용',
            amount: generalSummary.pointUsed,
          },
        ]
      : []),
  ];

  const step2CashbackRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.tierCashback > 0
      ? [
          {
            key: 'tier-cashback',
            label: '금액대별 캐시백',
            amount: generalSummary.tierCashback,
          },
        ]
      : []),
    ...(generalSummary.extraCashback > 0
      ? [
          {
            key: 'extra-cashback',
            label: '배송익월 추가 캐시백',
            amount: generalSummary.extraCashback,
          },
        ]
      : []),
  ];

  const step2ExtraRows: { key: string; label: string; amount: number }[] = [
    ...(generalSummary.extraEtcItems || []).map((it: any, idx: number) => ({
      key: it.id || `extra-etc-${idx}`,
      label: (it.description || '').trim() || '추가 혜택',
      amount: Math.max(0, Number(it.amount) || 0),
    })),
    ...(generalSummary.remainingPoints > 0
      ? [
          {
            key: 'remaining-points',
            label: '잔여 포인트 차감',
            amount: generalSummary.remainingPoints,
          },
        ]
      : []),
  ];

  const subCashbackRows: { key: string; label: string; amount: number }[] = [
    ...(subSummary.subTierCashback > 0
      ? [
          {
            key: 'sub-tier-cb',
            label: `${currentCard?.shortName || '제휴카드'} 금액대별 캐시백 (원금 ${Math.floor(
              totalPrincipal / 10000
            ).toLocaleString()}만원 구간)`,
            amount: subSummary.subTierCashback,
          },
        ]
      : []),
    ...(subSummary.subExtraCashback > 0
      ? [
          {
            key: 'sub-extra-cb',
            label: '구독 추가 일시 캐시백',
            amount: subSummary.subExtraCashback,
          },
        ]
      : []),
  ];

  const monthlyTotalDiscount =
    cardMonthlyDiscount + (!state.hideSubPreed ? hiPlusMonthlySupport : 0);
  const todayText = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const subSurplus = getSubscriptionSurplusMeta(
    finalMonthlyFee,
    subSummary.hiPlusPayoutMethod
  );
  const subTermSurplusTotal =
    subSurplus.monthlySurplus > 0
      ? subSurplus.monthlySurplus * representativePeriod
      : finalTotal60Fee < 0
      ? Math.abs(finalTotal60Fee)
      : 0;
  const hasSubPreedActive =
    !state.hideSubPreed && (subSummary.hiSummary?.totalAccounts || 0) > 0;

  return (
    <>
      {/* -------------------- CASE B: 구독구매 단독 스토리 제안서 -------------------- */}
      {state.quoteMode === 'subscription' && (
        <div className="space-y-4">
          {/* 공식 구독 마스트헤드 */}
          <div className="border-b border-[#E5E8EB] pb-3 flex flex-wrap items-end justify-between gap-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-[#E60012] text-white text-[11px] font-black tracking-wider">
                  LOTTE HIMART
                </span>
                <span className="text-xs font-extrabold text-[#4E5968]">
                  경기광주점 공식 구독 제안서
                </span>
                {hasBothPlans && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#191F28] text-white text-[11px] font-extrabold">
                    견적 {activePlan}안
                  </span>
                )}
                {activeCustomer && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold">
                    <User className="w-3 h-3" />
                    {activeCustomer.name} 고객님 맞춤 설계
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-[#191F28] break-keep leading-tight">
                {subHeaderTitle}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 text-right">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E5E8EB] text-[11.5px] sm:text-xs font-extrabold text-[#191F28] whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1B64DA]" />
                방문케어 · 5년 무상 A/S 기본 포함
              </span>
              <span className="text-[11px] font-semibold text-[#8B95A1] tabular-nums">
                설계일 {todayText}
              </span>
            </div>
          </div>

          {/* 핵심 1~2줄 요약 배너 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#E5E8EB] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-[13px] font-semibold text-[#4E5968] leading-snug break-keep">
              {monthlyTotalDiscount > 0 || subSummary.totalSubBenefit > 0 ? (
                <>
                  {state.items.length}품목 기본{' '}
                  <strong className="font-mono tabular-nums whitespace-nowrap font-bold text-[#191F28]">
                    월 {totalBaseMonthly.toLocaleString()}원
                  </strong>{' '}
                  → 혜택{' '}
                  <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold text-[#1B64DA]">
                    -{monthlyTotalDiscount.toLocaleString()}원
                  </strong>{' '}
                  적용 시{' '}
                  {subSurplus.isSurplusZone ? (
                    <>
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold text-[#E60012]">
                        월 0원
                      </strong>
                      {subSurplus.surplusInlineText && (
                        <>
                          {' '}
                          <strong className="font-mono tabular-nums font-extrabold text-emerald-700">
                            ({subSurplus.surplusInlineText})
                          </strong>
                        </>
                      )}
                    </>
                  ) : (
                    <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold text-[#E60012]">
                      월 체감 {finalMonthlyFee.toLocaleString()}원
                    </strong>
                  )}
                </>
              ) : (
                <>
                  {state.items.length}품목 방문케어·5년 무상 A/S 포함{' '}
                  <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold text-[#E60012]">
                    월 {Math.max(0, finalMonthlyFee).toLocaleString()}원
                  </strong>{' '}
                  공식 구독 설계안입니다.
                </>
              )}
            </p>
          </div>

          {/* 히어로 가격 집중 레이아웃 (메인 ③ 최종 월 체감 구독료 + 컴팩트 2열 요약 ①·②) */}
          <div className="space-y-2">
            {/* 메인 히어로 카드 */}
            <div className="rounded-2xl bg-gradient-to-br from-[#FFF1F2] via-[#FFF6F7] to-white border-2 border-[#E60012] p-4 shadow-[0_6px_18px_rgba(230,0,18,0.08)]">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-black text-[#E60012]">
                  <Sparkles className="w-3.5 h-3.5" />
                  ③ 최종 월 체감 구독료 ({periodLabel})
                </span>
                {subSummary.totalSubBenefit > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white border border-[#FECDD3] text-[#E60012] text-[11px] font-extrabold font-mono tabular-nums whitespace-nowrap">
                    총 -{subSummary.totalSubBenefit.toLocaleString()}원 혜택
                  </span>
                )}
              </div>
              <div className="mt-2">
                {subSurplus.isSurplusZone ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="text-[clamp(1.75rem,7.2vw,2.25rem)] font-black tracking-tight text-[#E60012] font-mono tabular-nums whitespace-nowrap leading-none">
                        월 0원
                      </div>
                      <span className="text-[11.5px] font-bold text-[#4E5968] font-mono tabular-nums whitespace-nowrap">
                        {subTermSurplusTotal > 0
                          ? `약정 기간 총 +${subTermSurplusTotal.toLocaleString()}원 초과 혜택 예상`
                          : `${periodLabel} 총 체감 0원`}
                      </span>
                    </div>
                    {subSurplus.surplusBadgeText && (
                      <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black font-mono tabular-nums break-keep">
                        {subSurplus.surplusBadgeText}
                      </div>
                    )}
                    <p className="text-[10.5px] font-semibold text-[#4E5968] leading-snug break-keep pt-0.5">
                      ※ {periodLabel} 약정 · 제휴카드 전월 실적 조건 충족 기준
                      {hasSubPreedActive && (
                        <>
                          {' '}· 지원상품(Hi구독 플러스) 월 납입금{' '}
                          <strong className="font-mono tabular-nums whitespace-nowrap text-[#191F28]">
                            {subSummary.hiSummary.totalMonthlyDeposit.toLocaleString()}원
                          </strong>
                          (1~90회 납입)은 별도입니다
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="text-[clamp(1.75rem,7.2vw,2.25rem)] font-black tracking-tight text-[#E60012] font-mono tabular-nums whitespace-nowrap leading-none">
                      월 <SpringNumberFlow value={finalMonthlyFee} suffix="원" />
                    </div>
                    <div className="text-[11.5px] font-bold text-[#4E5968] font-mono tabular-nums whitespace-nowrap">
                      {finalTotal60Fee <= 0
                        ? `${periodLabel} 총 체감가 0원`
                        : `${periodLabel} 총 체감가 ${finalTotal60Fee.toLocaleString()}원`}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 컴팩트 2열 계산 요약 */}
            <div className="grid grid-cols-2 mobile-keep-grid gap-2.5">
              <div className="min-w-0 rounded-xl bg-[#191F28] text-white px-3.5 py-2.5 flex flex-col justify-between overflow-hidden">
                <span className="text-[11px] font-extrabold text-slate-300 break-keep">
                  ① 월 기본 구독료 ({periodLabel})
                </span>
                <div className="mt-1 text-[clamp(1rem,4vw,1.35rem)] font-black tracking-tight font-mono tabular-nums whitespace-nowrap">
                  월 {totalBaseMonthly.toLocaleString()}원
                </div>
                <div className="text-[10.5px] font-medium text-slate-300 mt-0.5 font-mono tabular-nums whitespace-nowrap truncate">
                  기준 원금 합계 {totalPrincipal.toLocaleString()}원
                </div>
              </div>

              <div className="min-w-0 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3.5 py-2.5 flex flex-col justify-between overflow-hidden">
                <span className="text-[11px] font-extrabold text-[#1B64DA] break-keep">
                  ② 매월 할인 · 캐시백 혜택
                </span>
                <div className="mt-1 text-[clamp(1rem,4vw,1.35rem)] font-black tracking-tight text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                  {monthlyTotalDiscount > 0
                    ? `월 -${monthlyTotalDiscount.toLocaleString()}원`
                    : subSummary.totalSubCashback > 0
                    ? `-${subSummary.totalSubCashback.toLocaleString()}원`
                    : '0원'}
                </div>
                <div className="text-[10.5px] font-semibold text-[#4E5968] mt-0.5 font-mono tabular-nums whitespace-nowrap truncate">
                  {subSummary.totalSubBenefit > 0
                    ? `약정 기간 총 -${subSummary.totalSubBenefit.toLocaleString()}원 혜택`
                    : '제휴카드 · 프리드 결합 추가 가능'}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: 구독 가전 및 무상 케어 내역 */}
          <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
            <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded bg-[#191F28] text-white text-[11px] font-extrabold shrink-0 whitespace-nowrap">
                  STEP 1
                </span>
                <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28] break-keep">
                  구독 가전 및 무상 케어 내역 ({state.items.length}품목)
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#8B95A1] shrink-0 whitespace-nowrap">
                월 구독료 · 기준가
              </span>
            </div>
            <div className="divide-y divide-[#E5E8EB]">
              {state.items.map((item: any, idx: number) => {
                const itemPeriod: SubscriptionPeriod = normalizeSubscriptionPeriod(
                  item.period,
                  normalizeSubscriptionPeriod(state.subscriptionPeriod, 60)
                );
                const cleanCareService = sanitizeFiveYearText(
                  item.careService || '전문가 방문케어'
                );
                const validModel = getValidDisplayModelName(
                  item.modelName,
                  item.monthlyFee
                );
                const itemPrincipal = getSubscriptionItemPrincipal(
                  item,
                  representativePeriod
                );
                return (
                  <div
                    key={item.id}
                    className="ledger-row items-start px-4 sm:px-5 py-3 hover:bg-[#F8FAFC]/80 transition-colors"
                  >
                    <div className="ledger-row-label space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-md bg-[#F2F4F6] text-[#191F28] border border-[#E5E8EB] text-[11px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-extrabold text-[#191F28] break-keep">
                          {fmtCat(item.category) || `구독 가전 ${idx + 1}`}
                        </span>
                        {validModel && (
                          <span className="text-xs font-semibold text-[#4E5968] bg-[#F8FAFC] border border-[#E5E8EB] px-2 py-0.5 rounded font-mono break-all">
                            {fmtModel(validModel)}
                          </span>
                        )}
                        <span className="text-[11px] font-extrabold text-[#1B64DA] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                          {itemPeriod}개월 구독
                        </span>
                      </div>
                      <div className="text-[11.5px] font-semibold text-[#8B95A1] pl-7 break-keep">
                        {cleanCareService} · 5년 무상 A/S 기본 포함
                      </div>
                    </div>
                    <div className="ledger-row-value flex flex-col items-end">
                      <span className="text-sm sm:text-base font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                        월 {(Number(item.monthlyFee) || 0).toLocaleString()}원
                      </span>
                      {itemPrincipal > 0 && (
                        <span className="text-[11px] font-semibold text-[#6B7684] font-mono tabular-nums whitespace-nowrap mt-0.5">
                          기준 금액 {itemPrincipal.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ledger-row items-center px-4 sm:px-5 py-3 bg-[#F8FAFC] border-t border-[#E5E8EB]">
              <div className="ledger-row-label">
                <div className="text-xs sm:text-sm font-extrabold text-[#4E5968]">
                  총 월 기본 구독료 합계 ({periodLabel})
                </div>
                {totalPrincipal > 0 && (
                  <div className="text-[11px] font-semibold text-[#6B7684] font-mono tabular-nums">
                    제품 기준 금액(약정 원금) 합계 {totalPrincipal.toLocaleString()}원
                  </div>
                )}
              </div>
              <span className="ledger-row-value text-base sm:text-lg font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                월 {totalBaseMonthly.toLocaleString()}원
              </span>
            </div>
          </section>

          {/* STEP 2: 월 혜택 차감 및 체감가 계산 */}
          <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
            <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded bg-[#1B64DA] text-white text-[11px] font-extrabold shrink-0 whitespace-nowrap">
                  STEP 2
                </span>
                <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28] break-keep">
                  월 혜택 차감 및 체감가 계산
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#8B95A1] truncate">
                {subFormulaText}
              </span>
            </div>

            <div className="divide-y divide-[#E5E8EB]">
              {cardMonthlyDiscount > 0 && currentCard && currentCardTier && (
                <div className="px-4 sm:px-5 py-2.5 space-y-1.5">
                  <div className="ledger-row">
                    <div className="ledger-row-label flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold shrink-0">
                        매월 카드
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                        {currentCard.name} 월 {subCardBenefitLabel}
                      </span>
                      <span className="text-[11px] font-semibold text-[#8B95A1]">
                        ({currentCardTier.minSpendLabel} · {representativePeriod}개월간)
                      </span>
                    </div>
                    <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      월 -{cardMonthlyDiscount.toLocaleString()}원
                    </span>
                  </div>
                  <CardSpendSimulationBadge
                    enabled={subSummary.countPreedTowardCardSpend}
                    payoutMethod={subSummary.hiPlusPayoutMethod}
                    recognizedPreedSpend={subSummary.recognizedPreedSpend || 0}
                    additionalCardSpendNeeded={subSummary.additionalCardSpendNeeded || 0}
                    targetCardMinSpend={subSummary.targetCardMinSpend || 0}
                  />
                  <CardDiscountTermNotice
                    cardDiscount={cardMonthlyDiscount}
                    benefitLabel={subCardBenefitLabel}
                    representativePeriod={representativePeriod}
                  />
                </div>
              )}

              {!state.hideSubPreed && hiPlusMonthlySupport > 0 && (
                <div className="ledger-row px-4 sm:px-5 py-2.5">
                  <div className="ledger-row-label flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold shrink-0">
                      매월 지원
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                      구독프리드 (Hi구독 플러스) 월 캐시백 지원금
                    </span>
                    <span className="text-[11px] font-semibold text-[#8B95A1]">
                      ({representativePeriod}개월간 매월 지급)
                    </span>
                  </div>
                  <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                    월 -{hiPlusMonthlySupport.toLocaleString()}원
                  </span>
                </div>
              )}

              {/* 월 체감 구독료 강조 행 */}
              <div className="px-4 sm:px-5 py-4 bg-[#FFF1F2] border-t-2 border-[#E60012]">
                <div className="ledger-row items-start">
                  <div className="ledger-row-label space-y-1">
                    {subSurplus.isSurplusZone && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-[#FECDD3] text-[#E60012] text-[10.5px] font-extrabold">
                        약정 기간 · 제휴카드 전월 실적 조건 적용 기준
                      </span>
                    )}
                    <div className="text-sm sm:text-base font-black text-[#E60012]">
                      ③ 최종 월 체감 구독료 ({periodLabel})
                    </div>
                    {subSurplus.surplusBadgeText && (
                      <div className="pt-0.5 space-y-1">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black font-mono tabular-nums break-keep">
                          {subSurplus.surplusBadgeText}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-800 break-keep">
                          매월 지원 혜택이 월 기본 구독료보다{' '}
                          <span className="font-mono tabular-nums whitespace-nowrap">
                            {subSurplus.monthlySurplus.toLocaleString()}원
                          </span>{' '}
                          더 많습니다
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="ledger-row-value text-2xl sm:text-3xl font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
                    {subSurplus.isSurplusZone ? (
                      '월 0원'
                    ) : (
                      <>
                        월 <SpringNumberFlow value={finalMonthlyFee} suffix="원" />
                      </>
                    )}
                  </span>
                </div>

                {hasSubPreedActive && (
                  <HiPlusInBoxCallout
                    totalAccounts={subSummary.hiSummary.totalAccounts}
                    totalMonthlyDeposit={subSummary.hiSummary.totalMonthlyDeposit}
                    totalMaturityRefund={subSummary.hiSummary.totalMaturityRefund}
                  />
                )}
              </div>

              {/* 일시 입금 캐시백 내역 */}
              {subCashbackRows.map((row) => (
                <div key={row.key} className="ledger-row px-4 sm:px-5 py-2.5">
                  <div className="ledger-row-label flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold shrink-0">
                      1회 환급
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#191F28]">
                      {row.label}
                    </span>
                  </div>
                  <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                    -{row.amount.toLocaleString()}원
                  </span>
                </div>
              ))}

              {/* 최종 기간 체감가 합계 바 */}
              <div className="ledger-row items-center px-4 sm:px-5 py-3.5 bg-[#191F28] text-white">
                <div className="ledger-row-label space-y-0.5">
                  <div className="text-xs sm:text-sm font-black text-white">
                    최종 {periodLabel} 총 체감가 합계
                  </div>
                  {subSurplus.isSurplusZone || finalTotal60Fee <= 0 ? (
                    <div className="text-[11.5px] font-bold text-emerald-300 font-mono tabular-nums break-keep">
                      {subTermSurplusTotal > 0
                        ? `약정 기간 총 +${subTermSurplusTotal.toLocaleString()}원 초과 혜택 예상`
                        : `약정 원금 총액 ${totalPrincipal.toLocaleString()}원 기준`}
                    </div>
                  ) : (
                    <div className="text-[11.5px] font-medium text-slate-300 font-mono tabular-nums break-keep">
                      {subSummary.totalSubCashback > 0
                        ? `${periodLabel} 월 납부 합계 ${subSummary.totalTermBillingBeforeCashback.toLocaleString()}원 − 일시 캐시백 ${subSummary.totalSubCashback.toLocaleString()}원 (약정 원금 ${totalPrincipal.toLocaleString()}원)`
                        : `약정 원금 총액 ${totalPrincipal.toLocaleString()}원 기준`}
                    </div>
                  )}
                </div>
                <span className="ledger-row-value text-lg sm:text-2xl font-black text-white font-mono tabular-nums whitespace-nowrap">
                  {subSurplus.isSurplusZone || finalTotal60Fee <= 0 ? (
                    '0원'
                  ) : (
                    <SpringNumberFlow value={finalTotal60Fee} suffix="원" />
                  )}
                </span>
              </div>
            </div>
          </section>

          {hasSubPreedActive && (
            <HiPlusInlineSummaryCard
              hiSummary={subSummary.hiSummary}
              representativePeriod={representativePeriod}
              payoutMethod={subSummary.hiPlusPayoutMethod}
              useMobileFluid={useMobileFluid}
            />
          )}

          <PreedSafetyGuideBox
            hasHiPlus={hasSubPreedActive}
            hasGeneralHiPreed={false}
          />

          <div className="pt-2 border-t border-[#E5E8EB] flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-medium text-[#8B95A1]">
            <span>롯데하이마트 경기광주점 · 고객 맞춤 가전 구독 공식 견적서</span>
            <span>본 제안서는 상담일 기준 프로모션 및 카드사 정책 기준이며 변동될 수 있습니다.</span>
          </div>
        </div>
      )}

      {/* -------------------- CASE C: 일반+구독 혼합 스토리 제안서 -------------------- */}
      {state.quoteMode === 'hybrid' && (
        <div className="space-y-4">
          {/* 통합 제안서 마스트헤드 */}
          <div className="border-b border-[#E5E8EB] pb-3.5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-wider">
                  LOTTE HIMART
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#4E5968]">
                  <Layers className="w-3.5 h-3.5 text-[#1B64DA]" />
                  일반 + 구독 통합 맞춤 제안서
                </span>
                {hasBothPlans && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#191F28] text-white text-[11.5px] font-extrabold">
                    견적 {activePlan}안
                  </span>
                )}
                {activeCustomer && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11.5px] font-extrabold">
                    <User className="w-3 h-3" />
                    {activeCustomer.name} 고객님 맞춤 설계
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#191F28] break-keep">
                일반구매 · 구독구매 통합 맞춤 설계안
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <span className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E5E8EB] text-xs font-extrabold text-[#191F28] whitespace-nowrap">
                일반카드: {state.generalCardType === '미정' || state.generalCardType === '일반카드' ? '미적용' : state.generalCardType}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-extrabold text-[#1B64DA] whitespace-nowrap">
                구독기간: {periodLabel}
              </span>
            </div>
          </div>

          {/* 한 줄 통합 스토리 브리핑 배너 */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5E8EB] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-[13px] font-semibold text-[#4E5968] leading-relaxed break-keep">
              일반구매 <strong className="font-extrabold text-[#191F28]">{state.generalItems.length}품목</strong>(체감{' '}
              <strong className="font-mono font-bold tabular-nums whitespace-nowrap text-[#191F28]">{generalSummary.rawNet.toLocaleString()}원</strong>)과 구독케어{' '}
              <strong className="font-extrabold text-[#191F28]">{state.items.length}품목</strong>(
              {subSurplus.isSurplusZone ? (
                <>
                  <strong className="font-mono font-bold tabular-nums whitespace-nowrap text-[#1B64DA]">월 0원</strong>
                  {subSurplus.monthlySurplus > 0 && (
                    <>
                      {' '}
                      <strong className="font-mono font-bold tabular-nums whitespace-nowrap text-emerald-700">
                        {subSurplus.surplusBadgeText}
                      </strong>
                    </>
                  )}
                </>
              ) : (
                <>
                  월 체감{' '}
                  <strong className="font-mono font-bold tabular-nums whitespace-nowrap text-[#1B64DA]">{finalMonthlyFee.toLocaleString()}원</strong>
                </>
              )}
              )을 결합해, 총{' '}
              <strong className="font-mono font-extrabold tabular-nums whitespace-nowrap text-[#1B64DA]">-{hybridTotalDiscountAndSupport.toLocaleString()}원</strong> 혜택을 받는 통합 설계안입니다.
            </p>
          </div>

          {/* 3-Beat Hybrid Summary Flow */}
          <div className={`grid ${useMobileFluid ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-3'} gap-2.5`}>
            <div className="rounded-2xl bg-[#191F28] text-white p-3.5 flex flex-col justify-between">
              <span className="text-[11.5px] font-extrabold text-slate-300">
                ① 일반구매 최종 체감가
              </span>
              <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xl font-black font-mono tabular-nums whitespace-nowrap">
                  {generalSummary.rawNet.toLocaleString()}원
                </span>
                <span className="text-[11.5px] text-slate-300 font-mono tabular-nums whitespace-nowrap">
                  실결제 {generalSummary.payPrice.toLocaleString()}원
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] p-3.5 flex flex-col justify-between">
              <span className="text-[11.5px] font-extrabold text-[#1B64DA]">
                ② 구독 월 체감 구독료
              </span>
              <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xl font-black text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                    {subSurplus.isSurplusZone
                      ? '월 0원'
                      : `월 ${finalMonthlyFee.toLocaleString()}원`}
                  </span>
                  <span className="text-[11.5px] font-bold text-[#4E5968] font-mono tabular-nums whitespace-nowrap">
                    {subSurplus.isSurplusZone || finalTotal60Fee <= 0
                      ? `${periodLabel} 총 0원`
                      : `${periodLabel} 총 ${finalTotal60Fee.toLocaleString()}원`}
                  </span>
                </div>
                {subSurplus.monthlySurplus > 0 && (
                  <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-600 text-white text-[10.5px] font-extrabold font-mono tabular-nums break-keep">
                    {subSurplus.surplusBadgeText}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFF1F2] border-2 border-[#E60012] p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[11.5px] font-black text-[#E60012]">
                  ③ 통합 최종 혜택 체감 합계
                </span>
                {hybridTotalDiscountAndSupport > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white text-[#E60012] border border-[#FECDD3] text-[11.5px] font-extrabold tabular-nums whitespace-nowrap">
                    총 -{hybridTotalDiscountAndSupport.toLocaleString()}원
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-2xl font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
                {hybridCombinedNetTotal.toLocaleString()}원
              </div>
            </div>
          </div>

          {/* 좌우 2단 대칭 원장 (폴드 펼침 680~879px 모바일 플루이드에서는 1열, 880px+ 또는 A4 고정시트에서는 2열) */}
          <div className={`grid ${useMobileFluid ? 'grid-cols-1 min-[880px]:grid-cols-2' : 'grid-cols-2'} gap-4 items-start`}>
            {/* 좌측: STEP 1. 일반구매 */}
            <div className="rounded-2xl border border-[#E5E8EB] bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#191F28] flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#191F28] text-white text-[11.5px] font-extrabold">
                    STEP 1
                  </span>
                  <ShoppingBag className="w-3.5 h-3.5 text-[#191F28]" />
                  일반구매 ({state.generalItems.length}품목)
                </span>
                <span className="text-[11.5px] font-bold text-[#8B95A1] font-mono tabular-nums whitespace-nowrap">
                  합계 {generalSummary.sum.toLocaleString()}원
                </span>
              </div>

              <div className="divide-y divide-[#E5E8EB]">
                {state.generalItems.map((it: any, idx: number) => {
                  const amt =
                    (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1);
                  const validModel = getValidDisplayModelName(
                    fmtModel(it.modelName),
                    it.unitPrice
                  );
                  return (
                    <div key={it.id} className="ledger-row px-4 py-2.5 text-xs">
                      <div className="ledger-row-label flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-[#191F28]">
                          {idx + 1}. {fmtCat(it.category) || `일반가전 ${idx + 1}`}
                        </span>
                        {validModel && (
                          <span className="text-[11.5px] font-semibold text-[#4E5968] bg-[#F8FAFC] border border-[#E5E8EB] px-1.5 py-0.5 rounded font-mono break-all">
                            {validModel}
                          </span>
                        )}
                        {it.quantity > 1 && (
                          <span className="text-xs font-extrabold text-[#E60012] shrink-0 whitespace-nowrap">
                            ×{it.quantity}개
                          </span>
                        )}
                      </div>
                      <span className="ledger-row-value font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                        {amt.toLocaleString()}원
                      </span>
                    </div>
                  );
                })}

                {step1DiscountRows.map((row) => (
                  <div key={row.key} className="ledger-row px-4 py-2 text-xs bg-[#F8FAFC]/60">
                    <span className="ledger-row-label font-semibold text-[#4E5968]">
                      (-) {row.label}
                    </span>
                    <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      -{row.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}

                {!state.hideHiPreed && generalSummary.hiFreedSupport > 0 && (
                  <div className="ledger-row px-4 py-2 text-xs bg-[#F8FAFC]/60">
                    <span className="ledger-row-label font-semibold text-[#4E5968]">
                      (-) 하이프리드 결합 지원금
                    </span>
                    <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      -{generalSummary.hiFreedSupport.toLocaleString()}원
                    </span>
                  </div>
                )}

                <div className="ledger-row px-4 py-2.5 bg-[#F8FAFC] text-xs">
                  <span className="ledger-row-label font-black text-[#191F28]">
                    ① 매장 카드 실결제가
                  </span>
                  <span className="ledger-row-value text-sm font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                    {generalSummary.payPrice.toLocaleString()}원
                  </span>
                </div>

                {[...step2CashbackRows, ...step2ExtraRows].map((row) => (
                  <div key={row.key} className="ledger-row px-4 py-2 text-xs">
                    <span className="ledger-row-label font-semibold text-[#4E5968]">
                      (-) {row.label}
                    </span>
                    <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      -{row.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}

                <div className="ledger-row px-4 py-3 bg-[#FFF1F2] border-t border-[#FECDD3]">
                  <div className="ledger-row-label space-y-0.5">
                    <div className="text-xs font-black text-[#E60012]">
                      일반구매 최종 혜택가
                    </div>
                    {generalSummary.rawNet < 0 && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-600 text-white text-[11.5px] font-black font-mono tabular-nums">
                        오히려 +{Math.abs(generalSummary.rawNet).toLocaleString()}원 더 이득
                      </div>
                    )}
                  </div>
                  <span className="ledger-row-value text-lg font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
                    <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
                  </span>
                </div>
              </div>
            </div>

            {/* 우측: STEP 2. 구독구매 */}
            <div className="rounded-2xl border border-[#E5E8EB] bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#191F28] flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#1B64DA] text-white text-[11.5px] font-extrabold">
                    STEP 2
                  </span>
                  <RefreshCw className="w-3.5 h-3.5 text-[#1B64DA]" />
                  구독구매 ({state.items.length}품목 · {periodLabel})
                </span>
                <span className="text-[11.5px] font-bold text-[#8B95A1] font-mono tabular-nums whitespace-nowrap">
                  기본 월 {totalBaseMonthly.toLocaleString()}원
                </span>
              </div>

              <div className="divide-y divide-[#E5E8EB]">
                {state.items.map((it: any, idx: number) => {
                  const itemPeriod: SubscriptionPeriod = normalizeSubscriptionPeriod(
                    it.period,
                    normalizeSubscriptionPeriod(state.subscriptionPeriod, 60)
                  );
                  const cleanCareService = sanitizeFiveYearText(
                    it.careService || '전문가 방문케어'
                  );
                  const validModel = getValidDisplayModelName(
                    fmtModel(it.modelName),
                    it.monthlyFee
                  );
                  const itemPrincipal = getSubscriptionItemPrincipal(it, itemPeriod);
                  return (
                    <div key={it.id} className="ledger-row px-4 py-2.5 text-xs">
                      <div className="ledger-row-label space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-[#191F28]">
                            {idx + 1}. {fmtCat(it.category) || `구독가전 ${idx + 1}`}
                          </span>
                          {validModel && (
                            <span className="text-[11.5px] font-semibold text-[#4E5968] bg-[#F8FAFC] border border-[#E5E8EB] px-1.5 py-0.5 rounded font-mono break-all">
                              {validModel}
                            </span>
                          )}
                          <span className="text-[11.5px] font-extrabold text-[#1B64DA] bg-[#EFF6FF] border border-[#BFDBFE] px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                            {itemPeriod}개월 구독
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[#8B95A1] break-keep">
                          {cleanCareService} · 5년 무상 A/S 기본 포함
                        </div>
                      </div>
                      <div className="ledger-row-value flex flex-col items-end gap-0.5">
                        <span className="font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
                          월 {(Number(it.monthlyFee) || 0).toLocaleString()}원
                        </span>
                        {itemPrincipal > 0 && (
                          <span className="text-[10.5px] font-semibold text-[#6B7684] font-mono tabular-nums whitespace-nowrap">
                            기준 {itemPrincipal.toLocaleString()}원
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {cardMonthlyDiscount > 0 && currentCard && currentCardTier && (
                  <div className="px-4 py-2 text-xs bg-[#F8FAFC]/60 space-y-1.5">
                    <div className="ledger-row">
                      <span className="ledger-row-label font-semibold text-[#4E5968]">
                        (-) 제휴카드 월 {subCardBenefitLabel} ({currentCard.shortName} · {currentCardTier.minSpendShort})
                      </span>
                      <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                        월 -{cardMonthlyDiscount.toLocaleString()}원
                      </span>
                    </div>
                    <CardSpendSimulationBadge
                      compact
                      enabled={subSummary.countPreedTowardCardSpend}
                      payoutMethod={subSummary.hiPlusPayoutMethod}
                      recognizedPreedSpend={subSummary.recognizedPreedSpend || 0}
                      additionalCardSpendNeeded={subSummary.additionalCardSpendNeeded || 0}
                      targetCardMinSpend={subSummary.targetCardMinSpend || 0}
                    />
                    <CardDiscountTermNotice
                      compact
                      cardDiscount={cardMonthlyDiscount}
                      benefitLabel={subCardBenefitLabel}
                      representativePeriod={representativePeriod}
                    />
                  </div>
                )}

                {!state.hideSubPreed && hiPlusMonthlySupport > 0 && (
                  <div className="ledger-row px-4 py-2 text-xs bg-[#F8FAFC]/60">
                    <span className="ledger-row-label font-semibold text-[#4E5968]">
                      (-) 구독프리드 월 지원금
                    </span>
                    <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      월 -{hiPlusMonthlySupport.toLocaleString()}원
                    </span>
                  </div>
                )}

                <div className="px-4 py-3 bg-[#FFF1F2] border-t border-[#FECDD3]">
                  <div className="ledger-row items-start">
                    <div className="ledger-row-label space-y-1">
                      {subSurplus.isSurplusZone && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-[#FECDD3] text-[#E60012] text-[10px] font-extrabold">
                          약정 기간 · 제휴카드 전월 실적 조건 적용 기준
                        </span>
                      )}
                      <div className="text-xs font-black text-[#E60012]">
                        최종 월 체감 구독료 ({periodLabel})
                      </div>
                      {subSurplus.monthlySurplus > 0 && (
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-black font-mono tabular-nums break-keep">
                            {subSurplus.surplusBadgeText}
                          </div>
                          <div className="text-[10.5px] font-bold text-emerald-800 break-keep">
                            제휴 혜택이 월 구독료보다 매월 {subSurplus.monthlySurplus.toLocaleString()}원 더 큽니다
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="ledger-row-value text-lg font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
                      {subSurplus.isSurplusZone ? (
                        '월 0원'
                      ) : (
                        <>
                          월 <SpringNumberFlow value={finalMonthlyFee} suffix="원" />
                        </>
                      )}
                    </span>
                  </div>
                  {!state.hideSubPreed && subSummary.hiSummary?.totalAccounts > 0 && (
                    <HiPlusInBoxCallout
                      compact
                      totalAccounts={subSummary.hiSummary.totalAccounts}
                      totalMonthlyDeposit={subSummary.hiSummary.totalMonthlyDeposit}
                      totalMaturityRefund={subSummary.hiSummary.totalMaturityRefund}
                    />
                  )}
                </div>

                {subCashbackRows.map((row) => (
                  <div key={row.key} className="ledger-row px-4 py-2 text-xs">
                    <span className="ledger-row-label font-semibold text-[#4E5968]">
                      (-) {row.label}
                    </span>
                    <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                      -{row.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}

                <div className="ledger-row px-4 py-2.5 bg-[#191F28] text-white text-xs">
                  <div className="ledger-row-label space-y-0.5">
                    <div className="font-bold text-slate-200">
                      최종 {periodLabel} 총 체감가 (원금 {totalPrincipal.toLocaleString()}원)
                    </div>
                    {(subSurplus.isSurplusZone || finalTotal60Fee <= 0) && subTermSurplusTotal > 0 && (
                      <div className="text-[11px] font-bold text-emerald-300 font-mono tabular-nums break-keep">
                        약정 기간 총 +{subTermSurplusTotal.toLocaleString()}원 초과 혜택 예상
                      </div>
                    )}
                  </div>
                  <span className="ledger-row-value text-sm font-black text-white font-mono tabular-nums whitespace-nowrap">
                    {subSurplus.isSurplusZone || finalTotal60Fee <= 0 ? (
                      '0원'
                    ) : (
                      <SpringNumberFlow value={finalTotal60Fee} suffix="원" />
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!state.hideSubPreed && subSummary.hiSummary?.totalAccounts > 0 ? (
            <HiPlusInlineSummaryCard
              hiSummary={subSummary.hiSummary}
              representativePeriod={representativePeriod}
              payoutMethod={subSummary.hiPlusPayoutMethod}
              useMobileFluid={useMobileFluid}
              showGeneralLine={!state.hideHiPreed && (generalHiPreedSummary?.totalAccounts || 0) > 0}
              generalHiPreedSummary={!state.hideHiPreed ? generalHiPreedSummary : null}
            />
          ) : !state.hideHiPreed && generalHiPreedSummary?.totalAccounts > 0 ? (
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[#191F28] break-keep">
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[11.5px] font-extrabold shrink-0">
                  STEP 3
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>지원상품(하이프리드) 납입 · 100% 만기 환급 안내 (서비스 미이용 시):</span>
              </span>
              <span className="text-[11.5px] font-extrabold text-emerald-700 break-keep font-mono tabular-nums whitespace-nowrap">
                거치 없음 · 150회 만기 {generalHiPreedSummary.totalMaturityRefund.toLocaleString()}원 100% 환급
              </span>
            </div>
          ) : null}

          <PreedSafetyGuideBox
            hasHiPlus={!state.hideSubPreed && (subSummary.hiSummary?.totalAccounts || 0) > 0}
            hasGeneralHiPreed={!state.hideHiPreed && (generalHiPreedSummary?.totalAccounts || 0) > 0}
          />

          <div className="pt-2 border-t border-[#E5E8EB] flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-medium text-[#8B95A1]">
            <span>롯데하이마트 경기광주점 · 일반구매 + 구독구매 통합 맞춤 견적서</span>
            <span>본 제안서는 상담일 기준 프로모션 및 카드사 정책 기준이며 변동될 수 있습니다.</span>
          </div>
        </div>
      )}
    </>
  );
};
