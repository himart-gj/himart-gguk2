import React from 'react';
import {
  getSubscriptionSurplusMeta,
  getValidDisplayModelName,
  normalizeSubscriptionPeriod,
  SubscriptionPeriod,
  SubscriptionPhaseSegment,
} from '../types/proposal';
import { Check, Layers, ShieldCheck, ShoppingBag, Sparkles, User } from 'lucide-react';
import { SpringNumberFlow } from './SpringNumberFlow';
import {
  PreedSafetyGuideBox,
  SubscriptionCardSpendGaugeCard,
  SubscriptionRefundTimelineCard,
} from './ProposalComplianceBlocks';

const sanitizeFiveYearText = (text?: string): string => {
  if (!text) return '';
  return text.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1');
};

const isGenericSubPlaceholderCategory = (raw?: string): boolean => {
  const t = (raw || '').trim();
  return !t || /^(맞춤\s*)?구독\s*(가전|품목)(\s*\d+)?$/i.test(t);
};

const resolveWarrantyExtraText = (raw?: string): string => {
  const cleaned = sanitizeFiveYearText(raw || '').trim();
  if (!cleaned || /^5년\s*무상\s*A\/?S(\s*기본\s*포함)?$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
};

const resolveMastheadCareSummary = (
  items?: any[],
  fallbackCare?: string
): string => {
  const list = Array.isArray(items) && items.length > 0 ? items : [{}];
  const cares = list.map((it) =>
    sanitizeFiveYearText((it?.careService || fallbackCare || '').trim())
  );
  if (cares.every((c) => c.includes('케어없음'))) {
    return '5년 무상 A/S 기본 포함';
  }
  if (cares.every((c) => c.includes('셀프케어'))) {
    return '셀프케어 · 5년 무상 A/S 기본 포함';
  }
  if (cares.some((c) => !c || c.includes('방문케어'))) {
    return '방문케어 · 5년 무상 A/S 기본 포함';
  }
  return '맞춤케어 · 5년 무상 A/S 기본 포함';
};

interface SubscriptionCareServiceCardProps {
  items: any[];
  fallbackPeriod: SubscriptionPeriod;
  fallbackCare?: string;
  fallbackWarranty?: string;
  fmtCat?: (raw?: string | null) => string;
  fmtModel?: (raw?: string | null) => string;
  compact?: boolean;
}

const SubscriptionCareServiceCard: React.FC<SubscriptionCareServiceCardProps> = ({
  items,
  fallbackPeriod,
  fallbackCare,
  fallbackWarranty,
  fmtCat = (v) => (v || '').trim(),
  fmtModel = (v) => (v || '').trim(),
  compact = false,
}) => {
  const list = Array.isArray(items) && items.length > 0 ? items : [{}];
  const isSingle = list.length === 1;

  if (isSingle) {
    const it = list[0] || {};
    const itemPeriod = normalizeSubscriptionPeriod(it.period, fallbackPeriod);
    const formattedCat = fmtCat(it.category);
    const realCat = isGenericSubPlaceholderCategory(formattedCat)
      ? ''
      : formattedCat;
    const rawValidModel = getValidDisplayModelName(it.modelName, it.monthlyFee);
    const validModel = rawValidModel ? fmtModel(rawValidModel) : '';
    const hasProductHeader = Boolean(realCat || validModel);
    const cleanCare = sanitizeFiveYearText(
      (it.careService || fallbackCare || '방문케어 (전문가 점검·교체)').trim()
    );
    const warrantyExtra = resolveWarrantyExtraText(
      it.warrantyType || fallbackWarranty
    );

    return (
      <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
        <div
          className={`${
            compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-3'
          } bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-[#1B64DA] shrink-0" />
            <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28] break-keep">
              구독 포함 서비스 · 무상 케어 안내
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] sm:text-[11px] font-extrabold shrink-0 whitespace-nowrap">
            {compact ? '기본 포함' : '추가 비용 0원 · 기본 포함'}
          </span>
        </div>

        <div className="divide-y divide-[#E5E8EB]">
          {hasProductHeader && (
            <div
              className={`${
                compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-2.5'
              } bg-[#F8FAFC]/50 flex items-center justify-between gap-2 flex-wrap`}
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-[#191F28] text-white text-[10.5px] font-extrabold shrink-0">
                  구독 가전
                </span>
                {realCat && (
                  <span className="text-xs sm:text-sm font-extrabold text-[#191F28] break-keep">
                    {realCat}
                  </span>
                )}
                {validModel && (
                  <span className="text-xs font-semibold text-[#4E5968] bg-white border border-[#E5E8EB] px-2 py-0.5 rounded font-mono break-all">
                    {validModel}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-extrabold text-[#1B64DA] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                {itemPeriod}개월 구독 약정
              </span>
            </div>
          )}

          <div
            className={`${
              compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-3'
            } flex flex-wrap items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                무상 보증
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#191F28] break-keep">
                5년 무상 A/S 연장보증 기본 포함
              </span>
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#4E5968] break-keep">
              {warrantyExtra || '구독 기간 무상 수리 안심 보증'}
            </span>
          </div>

          <div
            className={`${
              compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-3'
            } flex flex-wrap items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                케어 관리
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#191F28] break-keep">
                {cleanCare}
              </span>
            </div>
            {!hasProductHeader && (
              <span className="text-[11px] font-extrabold text-[#1B64DA] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                {itemPeriod}개월 구독 약정
              </span>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E5E8EB] overflow-hidden bg-white">
      <div
        className={`${
          compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-3'
        } bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-[#1B64DA] shrink-0" />
          <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#191F28] break-keep">
            구독 포함 서비스 · 무상 케어 안내 ({list.length}품목)
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] sm:text-[11px] font-extrabold shrink-0 whitespace-nowrap">
          {compact ? '기본 포함' : '추가 비용 0원 · 기본 포함'}
        </span>
      </div>
      <div className="divide-y divide-[#E5E8EB]">
        {list.map((it: any, idx: number) => {
          const itemPeriod = normalizeSubscriptionPeriod(
            it.period,
            fallbackPeriod
          );
          const formattedCat = fmtCat(it.category);
          const realCat = isGenericSubPlaceholderCategory(formattedCat)
            ? ''
            : formattedCat;
          const rawValidModel = getValidDisplayModelName(
            it.modelName,
            it.monthlyFee
          );
          const validModel = rawValidModel ? fmtModel(rawValidModel) : '';
          const displayTitle =
            realCat || (validModel ? '구독 가전' : `구독 품목 ${idx + 1}`);
          const cleanCare = sanitizeFiveYearText(
            (it.careService || fallbackCare || '방문케어 (전문가 점검·교체)').trim()
          );
          const warrantyExtra = resolveWarrantyExtraText(
            it.warrantyType || fallbackWarranty
          );
          return (
            <div
              key={it.id || idx}
              className={`${
                compact ? 'px-4 py-2.5' : 'px-4 sm:px-5 py-3'
              } space-y-1.5`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="w-5 h-5 rounded-md bg-[#F2F4F6] text-[#191F28] border border-[#E5E8EB] text-[11px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#191F28] break-keep">
                    {displayTitle}
                  </span>
                  {validModel && (
                    <span className="text-xs font-semibold text-[#4E5968] bg-[#F8FAFC] border border-[#E5E8EB] px-2 py-0.5 rounded font-mono break-all">
                      {validModel}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-extrabold text-[#1B64DA] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                  {itemPeriod}개월 구독
                </span>
              </div>
              <div className="pl-7 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold break-keep">
                  <Check className="w-3 h-3 stroke-[3] shrink-0" />
                  5년 무상 A/S 기본 포함
                  {warrantyExtra ? ` · ${warrantyExtra}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-bold break-keep">
                  <Check className="w-3 h-3 stroke-[3] shrink-0" />
                  {cleanCare}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

interface PreviewSubscriptionReceiptProps {
  subSummary: Record<string, any>;
  totalBaseMonthly: number;
  totalPrincipal: number;
  periodLabel: string;
  representativePeriod: number;
  hiPlusMonthlySupport: number;
  cardMonthlyDiscount: number;
  finalMonthlyFee: number;
  finalTotal60Fee: number;
  hasSubPreedActive: boolean;
  currentCard: Record<string, any> | undefined;
  currentCardTier: Record<string, any> | undefined;
  subCardBenefitLabel: string;
  subCashbackRows: { key: string; label: string; amount: number }[];
  itemCount: number;
  compact?: boolean;
}

const PreviewSubscriptionReceipt: React.FC<PreviewSubscriptionReceiptProps> = ({
  subSummary,
  totalBaseMonthly,
  totalPrincipal,
  periodLabel,
  representativePeriod,
  hiPlusMonthlySupport,
  cardMonthlyDiscount,
  finalMonthlyFee,
  finalTotal60Fee,
  hasSubPreedActive,
  currentCard,
  currentCardTier,
  subCardBenefitLabel,
  subCashbackRows,
  itemCount,
  compact = false,
}) => {
  const hasPreedBenefit = hasSubPreedActive && hiPlusMonthlySupport > 0;
  const hasCardBenefit =
    cardMonthlyDiscount > 0 && Boolean(currentCard) && Boolean(currentCardTier);
  const isTwoStep = hasPreedBenefit && hasCardBenefit;

  const phaseSegments: SubscriptionPhaseSegment[] = Array.isArray(
    subSummary.phaseSegments
  )
    ? subSummary.phaseSegments
    : [];
  const isMixed = Boolean(subSummary.isMixedPeriod) && phaseSegments.length >= 2;

  const rawAfterPreed =
    typeof subSummary.baseMonthlyAfterPreed === 'number'
      ? subSummary.baseMonthlyAfterPreed
      : totalBaseMonthly - (hasPreedBenefit ? hiPlusMonthlySupport : 0);

  const preedSurplus = getSubscriptionSurplusMeta(
    rawAfterPreed,
    subSummary.hiPlusPayoutMethod
  );
  const finalSurplus = getSubscriptionSurplusMeta(
    finalMonthlyFee,
    subSummary.hiPlusPayoutMethod
  );

  const subTermSurplusTotal =
    typeof subSummary.totalTermSurplus === 'number'
      ? subSummary.totalTermSurplus
      : finalTotal60Fee < 0
      ? Math.abs(finalTotal60Fee)
      : finalSurplus.monthlySurplus > 0
      ? finalSurplus.monthlySurplus * representativePeriod
      : 0;

  const totalHiPlusSupport = subSummary.hiSummary?.totalHiPlusSupport || 0;
  const lotteBillingDiscount = Math.max(
    0,
    Number(subSummary.subLotteBillingDiscount) || 0
  );
  const hasLotteBillingDiscount = lotteBillingDiscount > 0;
  const rawTotalBaseMonthly =
    typeof subSummary.rawTotalBaseMonthly === 'number'
      ? subSummary.rawTotalBaseMonthly
      : totalBaseMonthly;
  const billedPrincipal =
    typeof subSummary.billedPrincipal === 'number'
      ? subSummary.billedPrincipal
      : Math.max(0, totalPrincipal - lotteBillingDiscount);

  return (
    <section className="rounded-2xl border border-[#D1D6DB] overflow-hidden bg-white shadow-[0_2px_10px_rgba(25,31,40,0.04)]">
      {!compact && (
        <div className="px-4 sm:px-5 py-3 bg-[#191F28] text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-[#FF6B78] shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-tight break-keep">
              내 맞춤 구독 결론 영수증 ({periodLabel})
            </span>
          </div>
          {subSummary.totalSubBenefit > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-extrabold font-mono tabular-nums whitespace-nowrap">
              약정 총 -{subSummary.totalSubBenefit.toLocaleString()}원 혜택
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
              {resolveMastheadCareSummary(subSummary.displayItems)}
            </span>
          )}
        </div>
      )}

      <div className={`${compact ? 'p-3.5 space-y-2.5' : 'p-4 sm:p-5 space-y-3.5'}`}>
        {/* 기준선: 가전 원 구독료 합계 */}
        <div className="ledger-row items-start pb-2.5 border-b border-[#E5E8EB]">
          <div className="ledger-row-label space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-[#191F28] break-keep">
                가전 원 구독료 합계 ({itemCount}품목)
              </span>
              {hasLotteBillingDiscount && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[10.5px] sm:text-[11px] font-extrabold break-keep">
                  롯데카드 5%(최대 5만원) 청구할인 적용 금액
                </span>
              )}
            </div>
            {hasLotteBillingDiscount ? (
              <div className="text-[11px] font-semibold text-[#4E5968] font-mono tabular-nums break-keep leading-snug">
                할인 전 약정 원금 {totalPrincipal.toLocaleString()}원 →{' '}
                <strong className="font-extrabold text-[#1B64DA]">
                  실청구 원금 {billedPrincipal.toLocaleString()}원
                </strong>{' '}
                (-{lotteBillingDiscount.toLocaleString()}원 카드사 청구할인)
                {isMixed &&
                  ` · ${phaseSegments
                    .map((s) => `${s.label} 월 ${s.baseMonthly.toLocaleString()}원`)
                    .join(' / ')}`}
              </div>
            ) : (
              <div className="text-[11px] font-semibold text-[#8B95A1] font-mono tabular-nums break-keep">
                약정 원금 {totalPrincipal.toLocaleString()}원
                {isMixed &&
                  ` · ${phaseSegments
                    .map((s) => `${s.label} 월 ${s.baseMonthly.toLocaleString()}원`)
                    .join(' / ')}`}
              </div>
            )}
          </div>
          {hasLotteBillingDiscount ? (
            <div className="ledger-row-value flex flex-col items-end text-right shrink-0">
              {rawTotalBaseMonthly > totalBaseMonthly && (
                <span className="text-[11px] font-semibold text-[#8B95A1] line-through font-mono tabular-nums whitespace-nowrap">
                  할인 전 월 {rawTotalBaseMonthly.toLocaleString()}원
                </span>
              )}
              <span className="text-sm sm:text-lg font-black text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                월 {totalBaseMonthly.toLocaleString()}원
              </span>
            </div>
          ) : (
            <span className="ledger-row-value text-sm sm:text-lg font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
              월 {totalBaseMonthly.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 1단계: Hi구독 플러스 현금지원 (활성 시에만 표시) */}
        {hasPreedBenefit && (
          <div className="space-y-2.5">
            <div className="ledger-row items-center">
              <div className="ledger-row-label flex items-center gap-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1B64DA] text-[11px] font-extrabold shrink-0">
                  기본 지원
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#191F28] break-keep">
                  Hi구독 플러스 월 현금지원
                </span>
                {totalHiPlusSupport > 0 && (
                  <span className="text-[11px] font-semibold text-[#8B95A1] font-mono tabular-nums whitespace-nowrap">
                    (총 {totalHiPlusSupport.toLocaleString()}원)
                  </span>
                )}
              </div>
              <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                월 -{hiPlusMonthlySupport.toLocaleString()}원
              </span>
            </div>

            {isTwoStep && (
              <div className="rounded-xl bg-[#F8FAFC] border border-[#D1D6DB] p-3.5 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs sm:text-sm font-black text-[#191F28] break-keep">
                      {hasLotteBillingDiscount
                        ? '전월 실적 조건 없이도 기본 월 체감가'
                        : '카드 조건 없이도 기본 월 체감가'}
                    </span>
                    <div className="text-[11px] font-semibold text-[#6B7684]">
                      {hasLotteBillingDiscount
                        ? '카드 월 실적 미충족 시에도 적용되는 기본 혜택가'
                        : '제휴카드 미사용 · 실적 부담 없는 기본 혜택가'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[clamp(1.3rem,5.2vw,1.65rem)] font-black tracking-tight text-[#191F28] font-mono tabular-nums whitespace-nowrap leading-none">
                      {preedSurplus.isSurplusZone ? (
                        '월 0원'
                      ) : (
                        <>
                          월{' '}
                          <SpringNumberFlow
                            value={preedSurplus.displayNetMonthly}
                            suffix="원"
                          />
                        </>
                      )}
                    </div>
                    {preedSurplus.monthlySurplus > 0 && (
                      <div className="text-[11px] font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5">
                        {preedSurplus.surplusInlineText}
                      </div>
                    )}
                  </div>
                </div>

                {isMixed && (
                  <div className="pt-2 border-t border-[#E5E8EB] grid grid-cols-2 mobile-keep-grid gap-2">
                    {phaseSegments.map((seg) => (
                      <div
                        key={`preview-preed-${seg.key}`}
                        className="min-w-0 rounded-lg bg-white border border-[#E5E8EB] px-2.5 py-1.5 flex flex-col justify-between"
                      >
                        <span className="text-[10.5px] font-bold text-[#6B7684] break-keep">
                          {seg.label} 기본 체감
                        </span>
                        <span className="text-xs sm:text-sm font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap mt-0.5">
                          {seg.surplusAfterPreed > 0
                            ? `월 0원 (+${seg.surplusAfterPreed.toLocaleString()}원)`
                            : `월 ${seg.effectiveAfterPreed.toLocaleString()}원`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2단계: 제휴카드 추가 혜택 (활성 시에만 표시) */}
        {hasCardBenefit && currentCard && currentCardTier && (
          <div className="ledger-row items-center pt-0.5">
            <div className="ledger-row-label flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-[#FFF1F2] border border-[#FECDD3] text-[#E60012] text-[11px] font-extrabold shrink-0">
                {isTwoStep ? '+ 카드 추가' : '카드 혜택'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#191F28] break-keep">
                {currentCard.name} 월 {subCardBenefitLabel}
              </span>
              <span className="text-[11px] font-semibold text-[#8B95A1] whitespace-nowrap">
                ({currentCardTier.minSpendShort} 이상)
              </span>
            </div>
            <span className="ledger-row-value text-sm sm:text-base font-extrabold text-[#E60012] font-mono tabular-nums whitespace-nowrap">
              월 -{cardMonthlyDiscount.toLocaleString()}원
            </span>
          </div>
        )}

        {/* 최종 월 체감가 결론 박스 */}
        <div className="rounded-xl bg-gradient-to-br from-[#FFF1F2] via-[#FFF6F7] to-white border-2 border-[#E60012] p-4 space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="space-y-0.5">
              <div className="text-xs sm:text-base font-black text-[#E60012] break-keep">
                {isTwoStep
                  ? '제휴카드 추가 적용 시 최종 월 체감가'
                  : hasPreedBenefit
                  ? hasLotteBillingDiscount
                    ? '5% 청구할인 · 기본 지원 반영 최종 월 체감가'
                    : '카드 조건 없이 최종 월 체감가'
                  : hasCardBenefit
                  ? '제휴카드 적용 최종 월 체감가'
                  : hasLotteBillingDiscount
                  ? '롯데카드 5%(최대 5만원) 청구할인 적용 월 구독료'
                  : '월 구독료 합계'}
              </div>
              <div className="text-[11px] font-semibold text-[#4E5968] break-keep">
                {isMixed
                  ? `${phaseSegments[0].label} 기준 · 아래 구간별 변화 확인`
                  : `${periodLabel} 약정 기준`}
              </div>
            </div>

            <div className="text-right">
              <div
                className={`${
                  compact
                    ? 'text-[clamp(1.45rem,6vw,1.9rem)]'
                    : 'text-[clamp(1.75rem,7.2vw,2.3rem)]'
                } font-black tracking-tight text-[#E60012] font-mono tabular-nums whitespace-nowrap leading-none`}
              >
                {finalSurplus.isSurplusZone ? (
                  '월 0원'
                ) : (
                  <>
                    월{' '}
                    <SpringNumberFlow
                      value={Math.max(0, finalMonthlyFee)}
                      suffix="원"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {finalSurplus.surplusBadgeText && (
            <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black font-mono tabular-nums break-keep">
              {finalSurplus.surplusBadgeText}
            </div>
          )}

          {isMixed && (
            <div className="pt-2 border-t border-[#FECDD3] grid grid-cols-2 mobile-keep-grid gap-2">
              {phaseSegments.map((seg, idx) => {
                const isLaterPhase = idx > 0;
                return (
                  <div
                    key={`preview-final-${seg.key}`}
                    className={`min-w-0 rounded-xl px-3 py-2 border flex flex-col justify-between ${
                      isLaterPhase
                        ? 'bg-emerald-50/90 border-emerald-300'
                        : 'bg-white border-[#FECDD3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span
                        className={`text-[11px] font-extrabold break-keep ${
                          isLaterPhase ? 'text-emerald-800' : 'text-[#4E5968]'
                        }`}
                      >
                        {seg.label}
                      </span>
                      <span className="text-[10px] font-bold text-[#8B95A1] whitespace-nowrap">
                        {seg.endedItemCount > 0
                          ? `완납 후 ${seg.activeItemCount}품목`
                          : `${seg.activeItemCount}품목`}
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-sm sm:text-base font-black font-mono tabular-nums whitespace-nowrap ${
                        isLaterPhase ? 'text-emerald-700' : 'text-[#E60012]'
                      }`}
                    >
                      {seg.surplusFinalMonthly > 0
                        ? '월 0원'
                        : `월 ${seg.effectiveFinalMonthly.toLocaleString()}원`}
                    </div>
                    {seg.surplusFinalMonthly > 0 && (
                      <span className="text-[10.5px] font-extrabold text-emerald-700 font-mono tabular-nums whitespace-nowrap mt-0.5">
                        +월 {seg.surplusFinalMonthly.toLocaleString()}원 혜택
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 1회성 캐시백 보너스 배지 */}
        {subCashbackRows.length > 0 && (
          <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3.5 py-2.5 space-y-1.5">
            {subCashbackRows.map((row) => (
              <div key={row.key} className="ledger-row items-center text-xs sm:text-sm">
                <div className="ledger-row-label flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#1B64DA] text-white text-[10.5px] font-extrabold shrink-0">
                    보너스 환급
                  </span>
                  <span className="font-bold text-[#191F28] break-keep">
                    {row.label}
                  </span>
                </div>
                <span className="ledger-row-value font-extrabold text-[#1B64DA] font-mono tabular-nums whitespace-nowrap">
                  -{row.amount.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 약정 기간 총 체감 합계 바 */}
      <div className="ledger-row items-center px-4 sm:px-5 py-3 bg-[#F8FAFC] border-t border-[#E5E8EB] text-xs sm:text-sm">
        <div className="ledger-row-label space-y-0.5">
          <span className="font-extrabold text-[#4E5968]">
            {periodLabel} 약정 총 체감 합계
          </span>
          {subTermSurplusTotal > 0 && (
            <div className="text-[11px] font-extrabold text-emerald-700 font-mono tabular-nums break-keep">
              약정 기간 누적 +{subTermSurplusTotal.toLocaleString()}원 초과 혜택 예상
            </div>
          )}
        </div>
        <span className="ledger-row-value text-base sm:text-lg font-black text-[#191F28] font-mono tabular-nums whitespace-nowrap">
          {finalSurplus.isSurplusZone || finalTotal60Fee <= 0 ? (
            '총 0원'
          ) : (
            <>
              총 <SpringNumberFlow value={finalTotal60Fee} suffix="원" />
            </>
          )}
        </span>
      </div>
    </section>
  );
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

  const todayText = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const hasSubPreedActive =
    !state.hideSubPreed && (subSummary.hiSummary?.totalAccounts || 0) > 0;
  const hasSubCardActive =
    cardMonthlyDiscount > 0 && Boolean(currentCard) && Boolean(currentCardTier);

  return (
    <>
      {/* -------------------- CASE B: 구독구매 단독 제안서 (무중복 4블록 구조) -------------------- */}
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
                {resolveMastheadCareSummary(
                  subSummary.displayItems,
                  state.careService
                )}
              </span>
              <span className="text-[11px] font-semibold text-[#8B95A1] tabular-nums">
                설계일 {todayText}
              </span>
            </div>
          </div>

          {/* [블록 1] 내 맞춤 구독 결론 영수증 */}
          <PreviewSubscriptionReceipt
            subSummary={subSummary}
            totalBaseMonthly={totalBaseMonthly}
            totalPrincipal={totalPrincipal}
            periodLabel={periodLabel}
            representativePeriod={representativePeriod}
            hiPlusMonthlySupport={hiPlusMonthlySupport}
            cardMonthlyDiscount={cardMonthlyDiscount}
            finalMonthlyFee={finalMonthlyFee}
            finalTotal60Fee={finalTotal60Fee}
            hasSubPreedActive={hasSubPreedActive}
            currentCard={currentCard}
            currentCardTier={currentCardTier}
            subCardBenefitLabel={subCardBenefitLabel}
            subCashbackRows={subCashbackRows}
            itemCount={subSummary.displayItems.length}
          />

          {/* [블록 2] 구독 포함 서비스 · 무상 케어 안내 (가격 중복 없이 순수 서비스 정리) */}
          <SubscriptionCareServiceCard
            items={subSummary.displayItems}
            fallbackPeriod={normalizeSubscriptionPeriod(
              state.subscriptionPeriod,
              60
            )}
            fallbackCare={state.careService}
            fallbackWarranty={state.warrantyType}
            fmtCat={fmtCat}
            fmtModel={fmtModel}
          />

          {/* [블록 3] 안심 검증 2종 카드 — 유일 노출 */}
          {(hasSubPreedActive || hasSubCardActive) && (
            <div className="space-y-3">
              {hasSubPreedActive && (
                <SubscriptionRefundTimelineCard
                  hiSummary={subSummary.hiSummary}
                  payoutMethod={subSummary.hiPlusPayoutMethod}
                  useMobileFluid={useMobileFluid}
                />
              )}

              {hasSubCardActive && currentCard && currentCardTier && (
                <SubscriptionCardSpendGaugeCard
                  cardName={currentCard.name}
                  benefitLabel={subCardBenefitLabel}
                  cardDiscount={cardMonthlyDiscount}
                  minSpendLabel={currentCardTier.minSpendLabel}
                  targetCardMinSpend={subSummary.targetCardMinSpend || 0}
                  countPreedTowardCardSpend={subSummary.countPreedTowardCardSpend}
                  hasSubPreedActive={hasSubPreedActive}
                  payoutMethod={subSummary.hiPlusPayoutMethod}
                  recognizedPreedSpend={subSummary.recognizedPreedSpend || 0}
                  additionalCardSpendNeeded={subSummary.additionalCardSpendNeeded || 0}
                  representativePeriod={representativePeriod}
                />
              )}
            </div>
          )}

          {/* 단일 법적 고지 박스 */}
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

      {/* -------------------- CASE C: 일반+구독 혼합 제안서 (무중복 동기화) -------------------- */}
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

          {/* 통합 최종 혜택 합계 요약 */}
          <div className="rounded-2xl bg-[#FFF1F2] border-2 border-[#E60012] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#E60012] inline-flex items-center gap-1">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  일반구매 + 구독 통합 최종 체감 합계
                </span>
                {hybridTotalDiscountAndSupport > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white text-[#E60012] border border-[#FECDD3] text-[11.5px] font-extrabold tabular-nums whitespace-nowrap">
                    통합 총 -{hybridTotalDiscountAndSupport.toLocaleString()}원 혜택
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[#4E5968] break-keep">
                일반구매 {generalSummary.displayItems.length}품목 + 구독케어 {subSummary.displayItems.length}품목 통합 기준
              </p>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#E60012] font-mono tabular-nums whitespace-nowrap">
              {hybridCombinedNetTotal.toLocaleString()}원
            </div>
          </div>

          {/* 좌우 2단 분할: 좌측 일반구매 / 우측 구독 무중복 블록 1·2 */}
          <div className={`grid ${useMobileFluid ? 'grid-cols-1 min-[880px]:grid-cols-2' : 'grid-cols-2'} gap-4 items-start`}>
            {/* 좌측: 일반구매 */}
            <div className="rounded-2xl border border-[#E5E8EB] bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E8EB] flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#191F28] flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#191F28]" />
                  일반구매 ({generalSummary.displayItems.length}품목)
                </span>
                <span className="text-[11.5px] font-bold text-[#8B95A1] font-mono tabular-nums whitespace-nowrap">
                  합계 {generalSummary.sum.toLocaleString()}원
                </span>
              </div>

              <div className="divide-y divide-[#E5E8EB]">
                {generalSummary.displayItems.map((it: any, idx: number) => {
                  const amt =
                    (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1);
                  const rawValidModel = getValidDisplayModelName(
                    it.modelName,
                    it.unitPrice
                  );
                  const validModel = rawValidModel ? fmtModel(rawValidModel) : '';
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
                    매장 카드 실결제가
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

            {/* 우측: 구독구매 ([블록 1] 구독 결론 영수증 + [블록 2] 가전·케어 명세) */}
            <div className="space-y-3.5">
              <PreviewSubscriptionReceipt
                compact
                subSummary={subSummary}
                totalBaseMonthly={totalBaseMonthly}
                totalPrincipal={totalPrincipal}
                periodLabel={periodLabel}
                representativePeriod={representativePeriod}
                hiPlusMonthlySupport={hiPlusMonthlySupport}
                cardMonthlyDiscount={cardMonthlyDiscount}
                finalMonthlyFee={finalMonthlyFee}
                finalTotal60Fee={finalTotal60Fee}
                hasSubPreedActive={hasSubPreedActive}
                currentCard={currentCard}
                currentCardTier={currentCardTier}
                subCardBenefitLabel={subCardBenefitLabel}
                subCashbackRows={subCashbackRows}
                itemCount={subSummary.displayItems.length}
              />

              <SubscriptionCareServiceCard
                compact
                items={subSummary.displayItems}
                fallbackPeriod={normalizeSubscriptionPeriod(
                  state.subscriptionPeriod,
                  60
                )}
                fallbackCare={state.careService}
                fallbackWarranty={state.warrantyType}
                fmtCat={fmtCat}
                fmtModel={fmtModel}
              />
            </div>
          </div>

          {/* [블록 3] 안심 검증 카드 — 유일 노출 */}
          <div className="space-y-3">
            {hasSubPreedActive ? (
              <SubscriptionRefundTimelineCard
                hiSummary={subSummary.hiSummary}
                payoutMethod={subSummary.hiPlusPayoutMethod}
                useMobileFluid={useMobileFluid}
                showGeneralLine={!state.hideHiPreed && (generalHiPreedSummary?.totalAccounts || 0) > 0}
                generalHiPreedSummary={!state.hideHiPreed ? generalHiPreedSummary : null}
              />
            ) : !state.hideHiPreed && generalHiPreedSummary?.totalAccounts > 0 ? (
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-[#191F28] break-keep">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>지원상품(하이프리드) 납입 · 100% 만기 환급 안내 (서비스 미이용 시):</span>
                </span>
                <span className="text-[11.5px] font-extrabold text-emerald-700 break-keep font-mono tabular-nums whitespace-nowrap">
                  거치 없음 · 150회 만기 {generalHiPreedSummary.totalMaturityRefund.toLocaleString()}원 100% 환급
                </span>
              </div>
            ) : null}

            {hasSubCardActive && currentCard && currentCardTier && (
              <SubscriptionCardSpendGaugeCard
                cardName={currentCard.name}
                benefitLabel={subCardBenefitLabel}
                cardDiscount={cardMonthlyDiscount}
                minSpendLabel={currentCardTier.minSpendLabel}
                targetCardMinSpend={subSummary.targetCardMinSpend || 0}
                countPreedTowardCardSpend={subSummary.countPreedTowardCardSpend}
                hasSubPreedActive={hasSubPreedActive}
                payoutMethod={subSummary.hiPlusPayoutMethod}
                recognizedPreedSpend={subSummary.recognizedPreedSpend || 0}
                additionalCardSpendNeeded={subSummary.additionalCardSpendNeeded || 0}
                representativePeriod={representativePeriod}
              />
            )}
          </div>

          <PreedSafetyGuideBox
            hasHiPlus={hasSubPreedActive}
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
