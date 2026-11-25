import React, { useRef, useState } from 'react';
import {
  AFFILIATE_CARDS,
  applyAllGeneralPlansPatch,
  getHiPlusUnitMonthlySupport,
  getSubscriptionItemPrincipal,
  getSubscriptionSurplusMeta,
  getValidDisplayModelName,
  HI_PLUS_PAYOUT_OPTIONS,
  HI_PLUS_PLANS,
  HiPlusPayoutMethod,
  isSubTierCashbackEligibleCard,
  MAX_FREED_ACCOUNTS,
  normalizeHiPlusPayoutMethod,
  normalizeSubscriptionPeriod,
  SUB_CARE_OPTIONS,
  SubscriptionPeriod,
} from '../types/proposal';
import {
  ArrowRight,
  Camera,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FormattedMoneyInput } from './FormattedMoneyInput';

export const ControlPanelSubscriptionSection: React.FC<Record<string, any>> = ({
  bothSubPlansHavePrice,
  cardDiscount,
  currentCard,
  fileInputRef,
  generalHiPreedSummary,
  handleAddSubItem,
  handleAdjustHiPlus,
  handleCardSelect,
  handleFileChange,
  handleRemoveSubItem,
  handleResetHiPlus,
  handleResetSubItems,
  handleUpdateSubItem,
  hiPlusMonthly,
  hiSummary,
  isParsing,
  liveSubSummary,
  onChange,
  onShowProposal,
  parseError,
  periodLabel,
  plan1SubSummary,
  plan2SubSummary,
  rawFinalMonthly,
  representativePeriod,
  setLastFocusedSection,
  showSubscription,
  state,
  subNetDiff,
  subScanNotice,
  subTotalNetDiff,
  totalBaseMonthly,
  totalPrincipal,
  validSubPlans,
}) => {
  const [customCareItemIds, setCustomCareItemIds] = useState<Record<string, boolean>>({});
  const customCareInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleToggleHideSubPreed = () => {
    onChange((prev: any) => {
      const nextHidden = !prev.hideSubPreed;
      return applyAllGeneralPlansPatch(prev, (plan) => ({
        ...plan,
        hideSubPreed: nextHidden,
      }));
    });
  };

  const activePayoutMethod = normalizeHiPlusPayoutMethod(
    state.hiPlusPayoutMethod
  );
  const countPreedTowardCardSpend = Boolean(state.countPreedTowardCardSpend);

  const handleSelectHiPlusPayoutMethod = (method: HiPlusPayoutMethod) => {
    onChange((prev: any) => ({
      ...prev,
      hiPlusPayoutMethod: method,
    }));
  };

  const handleToggleCountPreedTowardCardSpend = () => {
    onChange((prev: any) => ({
      ...prev,
      countPreedTowardCardSpend: !prev.countPreedTowardCardSpend,
    }));
  };

  if (!showSubscription) return null;

  return (
    <div
      onClick={() => setLastFocusedSection('subscription')}
      onMouseEnter={() => setLastFocusedSection('subscription')}
      className="@container w-full bg-white dark:bg-[#131C2E] rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_12px_rgba(25,31,40,0.04)] dark:shadow-none p-4 sm:p-6 space-y-5"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* STEP 1. 구독 품목 명세 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#1B64DA] text-white whitespace-nowrap shrink-0">
              STEP 1
            </span>
            <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight">
              구독 품목 및 월 요금 ({state.activeGeneralPlan}안)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              title="구독 전산 캡처 이미지 AI 자동 판독 (Ctrl+V 지원)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-[#DBEAFE] dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B64DA] dark:text-blue-300" />
                  <span>판독 중...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-300" />
                  <span>전산 사진 스캔</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleAddSubItem}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#191F28] dark:bg-slate-700 hover:bg-[#262F3D] dark:hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> 품목 추가
            </button>
            <button
              type="button"
              onClick={handleResetSubItems}
              title="구독 품목 초기화"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#8B95A1] dark:text-slate-400 border border-[#E5E8EB] dark:border-slate-700 font-bold text-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> 초기화
            </button>
          </div>
        </div>

        {subScanNotice && (
          <p className="text-xs font-semibold text-[#1B64DA] dark:text-blue-300 bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 rounded-xl py-2 px-3">
            {subScanNotice}
          </p>
        )}
        {parseError && (
          <p className="text-xs font-semibold text-[#E60012] dark:text-rose-300 bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 rounded-xl py-2 px-3">
            {parseError}
          </p>
        )}

        <div className="space-y-2.5 sm:max-h-[340px] sm:overflow-y-auto sm:pr-1">
          {state.items.map((item: any, index: number) => {
            const itemPeriod: SubscriptionPeriod = normalizeSubscriptionPeriod(
              item.period,
              normalizeSubscriptionPeriod(state.subscriptionPeriod, 60)
            );

            const isCustomCare =
              Boolean(customCareItemIds[item.id]) ||
              !SUB_CARE_OPTIONS.includes(item.careService);
            const itemPrincipal = getSubscriptionItemPrincipal(item, itemPeriod);
            const hasInvalidNumericModel =
              Boolean((item.modelName || '').trim()) &&
              !getValidDisplayModelName(item.modelName, item.monthlyFee);

            return (
              <div
                key={item.id}
                className="bg-[#F8FAFC] dark:bg-slate-900/70 p-3 rounded-xl border border-[#E5E8EB] dark:border-slate-800 space-y-2"
              >
                {/* Row 1: Index + Category + Full Model Code + Delete */}
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-mono font-bold text-[#8B95A1] dark:text-slate-400 w-5 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) =>
                      handleUpdateSubItem(item.id, {
                        category: e.target.value,
                      })
                    }
                    placeholder={`품목명 ${index + 1}`}
                    className="w-[38%] sm:w-[36%] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.modelName}
                    onChange={(e) =>
                      handleUpdateSubItem(item.id, {
                        modelName: e.target.value,
                        modelCode: e.target.value,
                      })
                    }
                    placeholder="모델명/품번 (선택, 예: RF85DB9581APW)"
                    className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border text-base sm:text-xs font-mono font-medium text-[#191F28] dark:text-slate-100 focus:outline-none ${
                      hasInvalidNumericModel
                        ? 'border-amber-400 dark:border-amber-500 focus:border-amber-500'
                        : 'border-[#E5E8EB] dark:border-slate-700 focus:border-[#1B64DA]'
                    }`}
                  />
                  {state.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubItem(item.id)}
                      className="p-1.5 text-[#8B95A1] hover:text-[#E60012] rounded-lg hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 transition cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {hasInvalidNumericModel && (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 pl-0 min-[380px]:pl-7">
                    ※ 숫자만 입력된 모델명은 고객 견적서 배지에 노출되지 않습니다. 월 요금은 아래 ‘월 요금’ 칸에 입력해 주세요.
                  </p>
                )}

                {/* Row 2: Period Toggle (36/60) + Care Service + Monthly Fee */}
                <div className="grid grid-cols-12 gap-2 items-center pl-0 min-[380px]:pl-7">
                  <div className="col-span-5 sm:col-span-3 inline-flex bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-[#E5E8EB] dark:border-slate-700">
                    {([36, 60] as SubscriptionPeriod[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          handleUpdateSubItem(item.id, {
                            period: p,
                            warrantyType: '5년 무상 A/S 기본 포함',
                          })
                        }
                        className={`flex-1 py-1 rounded-md font-bold text-[11.5px] transition cursor-pointer whitespace-nowrap ${
                          itemPeriod === p
                            ? 'bg-[#191F28] dark:bg-blue-600 text-white'
                            : 'text-[#8B95A1] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-100'
                        }`}
                      >
                        {p}개월
                      </button>
                    ))}
                  </div>

                  <select
                    value={isCustomCare ? 'custom' : item.careService}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setCustomCareItemIds((prev) => ({ ...prev, [item.id]: true }));
                        const nextCustomValue = SUB_CARE_OPTIONS.includes(item.careService)
                          ? ''
                          : item.careService || '';
                        handleUpdateSubItem(item.id, {
                          careService: nextCustomValue,
                          careType: nextCustomValue,
                        });
                        requestAnimationFrame(() => {
                          customCareInputRefs.current[item.id]?.focus({
                            preventScroll: true,
                          });
                        });
                      } else {
                        setCustomCareItemIds((prev) => ({ ...prev, [item.id]: false }));
                        handleUpdateSubItem(item.id, {
                          careService: val,
                          careType: val,
                        });
                      }
                    }}
                    aria-label={`품목 ${index + 1} 케어서비스 선택`}
                    className="col-span-7 sm:col-span-4 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:border-[#1B64DA] focus:outline-none"
                  >
                    {SUB_CARE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="custom">직접 입력</option>
                  </select>

                  <div className="col-span-12 sm:col-span-5 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-[#8B95A1] dark:text-slate-400">
                      월 요금
                    </span>
                    <FormattedMoneyInput
                      stepAmount={1000}
                      value={item.monthlyFee || ''}
                      onValueChange={(val) =>
                        handleUpdateSubItem(item.id, {
                          monthlyFee: val,
                        })
                      }
                      placeholder="0"
                      className="w-full pl-12 pr-6 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-[#191F28] dark:text-slate-100 text-right focus:border-[#1B64DA] focus:outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                      원
                    </span>
                  </div>
                </div>

                {isCustomCare && (
                  <div className="pl-0 min-[380px]:pl-7">
                    <input
                      ref={(el) => {
                        customCareInputRefs.current[item.id] = el;
                      }}
                      type="text"
                      value={item.careService || ''}
                      onChange={(e) =>
                        handleUpdateSubItem(item.id, {
                          careService: e.target.value,
                          careType: e.target.value,
                        })
                      }
                      placeholder="상세 케어서비스 직접 입력 (예: 6개월 방문케어 + 필터교체)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#1B64DA] dark:border-blue-400 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                )}

                {itemPrincipal > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11.5px] font-medium text-[#4E5968] dark:text-slate-300 pl-0 min-[380px]:pl-7">
                    <span>
                      제품 기준 금액(약정 원금):{' '}
                      <strong className="text-[#191F28] dark:text-slate-100 font-mono tabular-nums whitespace-nowrap">
                        {itemPrincipal.toLocaleString()}원
                      </strong>
                    </span>
                    {item.cardName && (
                      <span className="text-[#1B64DA] dark:text-blue-300 font-bold">
                        인식 카드: {item.cardName}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="ledger-row text-xs text-[#4E5968] dark:text-slate-300 px-1 pt-0.5">
          <span className="ledger-row-label">
            구독기간 <strong className="text-[#191F28] dark:text-slate-100">{periodLabel}</strong> · 원금{' '}
            <span className="font-mono">{totalPrincipal.toLocaleString()}원</span> · 5년 무상 A/S 기본 포함
          </span>
          <span className="ledger-row-value font-mono font-bold text-[#191F28] dark:text-slate-100">
            월 합계 {totalBaseMonthly.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* STEP 2. 구독 제휴카드 및 캐시백 */}
      <div className="space-y-3 pt-4 border-t border-[#E5E8EB] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30">
            STEP 2
          </span>
          <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
            <span>구독 제휴카드 · 실적 구간 · 캐시백</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 @lg:grid-cols-5 gap-1.5">
          {AFFILIATE_CARDS.map((card) => {
            const selected = state.selectedCardId === card.id;
            const hasPrincipalTier = isSubTierCashbackEligibleCard(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardSelect(card.id)}
                className={`py-2 px-2 rounded-xl font-bold text-xs break-keep leading-tight border transition cursor-pointer flex flex-col items-center justify-center ${
                  selected
                    ? 'bg-[#191F28] dark:bg-blue-600 text-white border-[#191F28] dark:border-blue-500 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700'
                }`}
              >
                <span>{card.shortName}</span>
                {hasPrincipalTier && (
                  <span
                    className={`text-[11.5px] font-bold leading-tight mt-0.5 px-1.5 py-0.5 rounded ${
                      selected
                        ? 'bg-white/15 text-white'
                        : 'bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300'
                    }`}
                  >
                    300만↑캐시백
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleCardSelect('none')}
            className={`col-span-2 @lg:col-span-1 py-2 px-2 rounded-xl font-semibold text-xs break-keep leading-tight border transition cursor-pointer ${
              state.selectedCardId === 'none'
                ? 'bg-[#4E5968] text-white border-[#4E5968]'
                : 'bg-white dark:bg-slate-800 text-[#8B95A1] dark:text-slate-400 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700'
            }`}
          >
            카드 미적용
          </button>
        </div>

        {currentCard && (
          <div className="grid grid-cols-1 @sm:grid-cols-3 gap-1.5">
            {currentCard.tiers.map((tier: any) => {
              const active = state.selectedCardTierId === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() =>
                    onChange((prev: any) => ({
                      ...prev,
                      selectedCardTierId: tier.id,
                    }))
                  }
                  className={`py-2 px-2.5 rounded-xl border flex @sm:block items-center justify-between text-left @sm:text-center transition cursor-pointer ${
                    active
                      ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#1B64DA] dark:border-blue-400 text-[#191F28] dark:text-slate-100'
                      : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 break-keep">
                    전월 {tier.minSpendShort}
                  </div>
                  <div className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-400 font-mono whitespace-nowrap">
                    월 -{tier.monthlyDiscount.toLocaleString()}원
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {state.selectedCardId === 'lotte' && (() => {
          const isLotte5pOn = Boolean(state.subLotteBilling5p);
          const previewLotte5p = Math.min(Math.floor(totalPrincipal * 0.05), 50000);
          return (
            <button
              type="button"
              onClick={() =>
                onChange((prev: any) => ({
                  ...prev,
                  subLotteBilling5p: !prev.subLotteBilling5p,
                }))
              }
              className={`w-full rounded-xl px-3.5 py-2.5 border-2 flex flex-wrap items-center justify-between gap-2 text-left transition cursor-pointer schedule-tactile ${
                isLotte5pOn
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-500 dark:border-emerald-400 text-[#191F28] dark:text-slate-100 shadow-2xs'
                  : 'bg-white dark:bg-slate-800/90 border-[#BFDBFE] dark:border-blue-500/40 hover:bg-[#EFF6FF]/60 dark:hover:bg-blue-500/15 text-[#191F28] dark:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    isLotte5pOn
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/40'
                  }`}
                >
                  {isLotte5pOn ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <CreditCard className="w-3 h-3" />
                  )}
                </span>
                <span className="text-xs font-extrabold break-keep">
                  {isLotte5pOn
                    ? '롯데카드 5% 청구할인 적용됨 (최대 5만원)'
                    : '+ 롯데카드 5% 청구할인 적용하기 (최대 5만원)'}
                </span>
              </div>
              <span
                className={`font-mono tabular-nums whitespace-nowrap text-xs font-extrabold px-2 py-0.5 rounded-md ml-auto ${
                  isLotte5pOn
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300'
                }`}
              >
                {isLotte5pOn
                  ? `-${previewLotte5p.toLocaleString()}원 청구할인`
                  : totalPrincipal > 0
                  ? `클릭 시 -${previewLotte5p.toLocaleString()}원`
                  : '원금 5% · 최대 5만원'}
              </span>
            </button>
          );
        })()}

        {liveSubSummary.isTierCashbackCard && (
          <div
            className={`rounded-xl px-3 py-2 border text-xs font-medium ${
              totalPrincipal >= 3000000
                ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300'
                : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300'
            }`}
          >
            {totalPrincipal >= 3000000 ? (
              <span>
                ✓ <strong>{currentCard?.shortName}</strong> 구독원금{' '}
                <strong className="font-mono">{totalPrincipal.toLocaleString()}원</strong> 충족 · 금액대별 캐시백{' '}
                <strong className="font-mono">
                  -{liveSubSummary.autoSubTierCashback.toLocaleString()}원
                </strong>{' '}
                자동 반영됨
              </span>
            ) : (
              <span>
                {currentCard?.shortName} 구독원금 300만원 이상 시 금액대별 캐시백 적용 (현재{' '}
                <strong className="font-mono">{totalPrincipal.toLocaleString()}원</strong> ·{' '}
                <span className="text-[#E60012] dark:text-rose-400 font-mono font-bold">
                  {(3000000 - totalPrincipal).toLocaleString()}원
                </span>{' '}
                부족)
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 @md:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 break-keep">
                (-) 금액대별 캐시백 (300만↑)
              </label>
              {state.subAutoTierCashback === false ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev: any) => ({
                      ...prev,
                      subAutoTierCashback: true,
                      subManualTierCashback: 0,
                    }))
                  }
                  className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  자동 복원
                </button>
              ) : (
                <span className="text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                  {liveSubSummary.isTierCashbackCard ? '자동계산' : '삼성·신한 전용'}
                </span>
              )}
            </div>
            <FormattedMoneyInput
              stepAmount={10000}
              value={liveSubSummary.subTierCashback || ''}
              onValueChange={(val, raw) => {
                if (raw === '') {
                  onChange((prev: any) => ({
                    ...prev,
                    subAutoTierCashback: false,
                    subManualTierCashback: 0,
                  }));
                  return;
                }
                onChange((prev: any) => ({
                  ...prev,
                  subAutoTierCashback: false,
                  subManualTierCashback: val,
                }));
              }}
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#1B64DA] dark:text-blue-400 focus:border-[#1B64DA] focus:outline-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 break-keep">
                (-) 구독 추가 캐시백 (1회 입금)
              </label>
              <div className="flex items-center gap-1">
                {[50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() =>
                      onChange((prev: any) => ({
                        ...prev,
                        subExtraCashback:
                          Math.max(0, Number(prev.subExtraCashback) || 0) + amt,
                      }))
                    }
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-blue-500/20 border border-[#E5E8EB] dark:border-slate-700 text-[11.5px] font-bold text-[#191F28] dark:text-slate-100 cursor-pointer"
                  >
                    +{amt / 10000}만
                  </button>
                ))}
                {(state.subExtraCashback || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev: any) => ({
                        ...prev,
                        subExtraCashback: 0,
                      }))
                    }
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400 cursor-pointer"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
            <FormattedMoneyInput
              stepAmount={10000}
              value={state.subExtraCashback || ''}
              onValueChange={(val) =>
                onChange((prev: any) => ({
                  ...prev,
                  subExtraCashback: val,
                }))
              }
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 sm:text-xs font-bold text-right text-[#1B64DA] dark:text-blue-400 focus:border-[#1B64DA] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* STEP 3. 구독 라이프케어 (Hi구독 플러스) */}
      <div className="space-y-3 pt-4 border-t border-[#E5E8EB] dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              STEP 3
            </span>
            <h3 className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
              <span>Hi구독 플러스 라이프케어 결합</span>
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {!state.hideSubPreed && (
              <span className="text-[11.5px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 whitespace-nowrap">
                {state.quoteMode === 'hybrid'
                  ? `합산 ${generalHiPreedSummary.totalAccounts + hiSummary.totalAccounts}/${MAX_FREED_ACCOUNTS}`
                  : `${hiSummary.totalAccounts}/${MAX_FREED_ACCOUNTS}구좌`}{' '}
                · 월 -{hiSummary.monthlyHiPlusSupport.toLocaleString()}원
              </span>
            )}
            {!state.hideSubPreed && hiSummary.totalAccounts > 0 && (
              <button
                type="button"
                onClick={handleResetHiPlus}
                className="text-[11.5px] font-bold text-[#8B95A1] hover:text-[#E60012] px-2 py-0.5 rounded-md bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 cursor-pointer"
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleHideSubPreed}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-bold border transition cursor-pointer ${
                state.hideSubPreed
                  ? 'bg-[#191F28] dark:bg-blue-600 text-white border-[#191F28] dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 hover:bg-[#F8FAFC] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700'
              }`}
            >
              {state.hideSubPreed ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>숨김중 (보이기)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>프리드 숨기기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {state.hideSubPreed ? (
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#4E5968] dark:text-slate-300">
            <span>구독프리드 영역이 제안서 및 고객 공유 화면에서 비노출 처리됩니다.</span>
            <button
              type="button"
              onClick={handleToggleHideSubPreed}
              className="px-2.5 py-1 rounded-lg bg-[#191F28] dark:bg-blue-600 text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
            >
              다시 표시
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 @lg:grid-cols-3 gap-2">
            {HI_PLUS_PLANS.map((plan) => {
              const count = state.hiPlusCounts[plan.id] || 0;
              const active = count > 0;
              const canAdd =
                hiSummary.totalAccounts +
                  (state.quoteMode === 'hybrid'
                    ? generalHiPreedSummary.totalAccounts
                    : 0) <
                MAX_FREED_ACCOUNTS;
              const monthlyUnitSupport = getHiPlusUnitMonthlySupport(
                plan,
                representativePeriod
              );

              return (
                <div
                  key={plan.id}
                  className={`p-3 rounded-xl border flex flex-row @lg:flex-col items-center @lg:items-stretch justify-between gap-2 transition ${
                    active
                      ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#1B64DA] dark:border-blue-400'
                      : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800'
                  }`}
                >
                  <div className="text-left @lg:mb-1">
                    <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 break-keep">
                      {plan.buttonLabel}
                    </div>
                    <div className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-400 font-mono tabular-nums mt-0.5 whitespace-nowrap">
                      월 -{monthlyUnitSupport.toLocaleString()}원
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-[#E5E8EB] dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAdjustHiPlus(plan.id, -1)}
                      disabled={count === 0}
                      aria-label={`${plan.buttonLabel} 감소`}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-md hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono tabular-nums font-bold min-w-[2.2rem] text-center text-[#191F28] dark:text-slate-100">
                      {count}구좌
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustHiPlus(plan.id, 1)}
                      disabled={!canAdd}
                      aria-label={`${plan.buttonLabel} 추가`}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#191F28] dark:bg-blue-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 상조회비 납부·지원금 수령 방식 선택 (3종) & 제휴카드 실적 인정 시뮬레이션 토글 */}
        {!state.hideSubPreed && (
          <div className="space-y-2.5 pt-2.5 border-t border-[#E5E8EB] dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11.5px] font-extrabold text-[#191F28] dark:text-slate-100">
                  상조회비 납부 · 지원금 수령 방식
                </span>
                <span className="text-[10.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                  제안서 표시용
                </span>
              </div>
              <div className="grid grid-cols-1 @lg:grid-cols-3 gap-1.5">
                {HI_PLUS_PAYOUT_OPTIONS.map((opt) => {
                  const selected = activePayoutMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectHiPlusPayoutMethod(opt.id)}
                      className={`text-left px-2.5 py-2 rounded-xl border transition cursor-pointer ${
                        selected
                          ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border-[#1B64DA] dark:border-blue-400 text-[#191F28] dark:text-slate-100'
                          : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800 text-[#4E5968] dark:text-slate-300 hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-extrabold leading-tight break-keep">
                          {opt.title}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1B64DA] text-white text-[9.5px] font-bold shrink-0">
                            <Check className="w-2.5 h-2.5" />
                            선택
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] font-medium text-[#6B7684] dark:text-slate-400 mt-1 leading-snug break-keep">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800 px-3 py-2.5 space-y-1.5">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={countPreedTowardCardSpend}
                  onChange={handleToggleCountPreedTowardCardSpend}
                  className="mt-0.5 w-4 h-4 rounded border-[#CBD5E1] text-[#1B64DA] focus:ring-[#1B64DA] cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold text-[#191F28] dark:text-slate-100 leading-snug break-keep">
                    상조회비 제휴카드 전월실적 인정 반영 (시뮬레이션)
                  </div>
                  <div className="text-[10.5px] font-medium text-[#6B7684] dark:text-slate-400 leading-snug break-keep mt-0.5">
                    제휴카드 선택 시 지원상품 월 납입금을 전월실적에 포함한 추가 필요 카드 사용액을 제안서에 함께 표시합니다.
                  </div>
                </div>
              </label>

              {countPreedTowardCardSpend && currentCard && liveSubSummary.currentCardTier && (
                <div
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold leading-snug break-keep ${
                    activePayoutMethod !== 'bank_bank' &&
                    liveSubSummary.additionalCardSpendNeeded === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700/70 text-emerald-800 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-800/90 border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300'
                  }`}
                >
                  {activePayoutMethod === 'bank_bank' ? (
                    <span>
                      통장납 선택 시 카드 실적 인정 0원 → 추가로 필요한 카드 사용:{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        월 {liveSubSummary.additionalCardSpendNeeded.toLocaleString()}원
                      </strong>
                    </span>
                  ) : liveSubSummary.additionalCardSpendNeeded === 0 ? (
                    <span>
                      지원상품 납입금 실적 인정{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        {liveSubSummary.recognizedPreedSpend.toLocaleString()}원
                      </strong>{' '}
                      → 추가로 필요한 카드 사용:{' '}
                      <strong className="font-extrabold text-emerald-700 dark:text-emerald-300">
                        없음 (납입금만으로 실적 충족)
                      </strong>
                    </span>
                  ) : (
                    <span>
                      지원상품 납입금 실적 인정{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        {liveSubSummary.recognizedPreedSpend.toLocaleString()}원
                      </strong>{' '}
                      → 추가로 필요한 카드 사용:{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        월 {liveSubSummary.additionalCardSpendNeeded.toLocaleString()}원
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Subscription Summary Ledger */}
      {(() => {
        const liveSurplus = getSubscriptionSurplusMeta(
          rawFinalMonthly,
          activePayoutMethod
        );
        const liveTermSurplus =
          liveSurplus.monthlySurplus > 0
            ? liveSurplus.monthlySurplus * representativePeriod
            : liveSubSummary.finalTotalFee < 0
            ? Math.abs(liveSubSummary.finalTotalFee)
            : 0;
        const oneTimeBenefitSum =
          liveSubSummary.totalSubCashback + liveSubSummary.subLotteBillingDiscount;
        return (
          <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-4 space-y-2.5">
            <div className="ledger-row">
              <div className="ledger-row-label">
                <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
                  월 체감 구독료 ({state.activeGeneralPlan}안 · {periodLabel})
                </div>
                <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium mt-0.5">
                  기본 월 {totalBaseMonthly.toLocaleString()}원 - 카드 {cardDiscount.toLocaleString()}원
                  {!state.hideSubPreed && hiPlusMonthly > 0
                    ? ` - 프리드 ${hiPlusMonthly.toLocaleString()}원`
                    : ''}
                </div>
              </div>
              <div className="ledger-row-value text-right">
                <div className="text-xl font-extrabold text-[#E60012] dark:text-[#FF3B47] font-mono tabular-nums whitespace-nowrap">
                  {liveSurplus.isSurplusZone
                    ? '월 0원'
                    : `월 ${rawFinalMonthly.toLocaleString()}원`}
                </div>
                {liveSurplus.surplusBadgeText && (
                  <div className="mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-extrabold font-mono tabular-nums">
                    {liveSurplus.surplusBadgeText}
                  </div>
                )}
              </div>
            </div>

            {/* 1회성 혜택(롯데 5% 청구할인 + 300만↑ 구간 캐시백 + 추가 캐시백) 총 실부담 절감액 강조 콜아웃 배너 */}
            {oneTimeBenefitSum > 0 ? (
              <div className="rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#1B64DA] dark:border-blue-400 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1B64DA] dark:text-blue-200">
                <div className="font-bold break-keep">
                  {liveSubSummary.totalSubCashback > 0 &&
                  liveSubSummary.subLotteBillingDiscount > 0 ? (
                    <>
                      5% 청구할인 · 일시 캐시백 총{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        -{oneTimeBenefitSum.toLocaleString()}원
                      </strong>{' '}
                      실부담 절감 반영
                    </>
                  ) : liveSubSummary.subLotteBillingDiscount > 0 ? (
                    <>
                      롯데카드 5% 청구할인{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        -{liveSubSummary.subLotteBillingDiscount.toLocaleString()}원
                      </strong>{' '}
                      (최대 5만원) 실부담 절감 반영
                    </>
                  ) : (
                    <>
                      1회 입금 캐시백 총{' '}
                      <strong className="font-mono tabular-nums whitespace-nowrap font-extrabold">
                        -{liveSubSummary.totalSubCashback.toLocaleString()}원
                      </strong>{' '}
                      실부담 절감 반영
                    </>
                  )}
                </div>
                <div className="font-extrabold text-sm sm:text-[15px] font-mono tabular-nums whitespace-nowrap ml-auto text-[#1B64DA] dark:text-blue-300">
                  {liveSurplus.isSurplusZone || liveSubSummary.finalTotalFee <= 0
                    ? `최종 ${periodLabel} 체감 0원`
                    : `최종 ${periodLabel} 체감 ${liveSubSummary.finalTotalFee.toLocaleString()}원`}
                </div>
              </div>
            ) : totalBaseMonthly > 0 ? (
              <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-slate-800 ledger-row text-xs">
                <span className="ledger-row-label font-medium text-[#4E5968] dark:text-slate-300">
                  {liveSurplus.isSurplusZone && liveTermSurplus > 0
                    ? `약정 기간 총 +${liveTermSurplus.toLocaleString()}원 초과 혜택 예상`
                    : `최종 ${periodLabel} 체감 합계 (원금 ${totalPrincipal.toLocaleString()}원)`}
                </span>
                <span className="ledger-row-value font-mono tabular-nums whitespace-nowrap font-bold text-[#191F28] dark:text-slate-100">
                  {liveSurplus.isSurplusZone || liveSubSummary.finalTotalFee <= 0
                    ? '0원'
                    : `${liveSubSummary.finalTotalFee.toLocaleString()}원`}
                </span>
              </div>
            ) : null}

            {/* 다중 안(1안~N안) 구독 차액: 월 차액 · 총 계약기간(36/60개월) 총차액 병기 */}
            {bothSubPlansHavePrice && (
              <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                <div className="font-mono tabular-nums font-semibold text-[#4E5968] dark:text-slate-300 break-keep">
                  {Array.isArray(validSubPlans) && validSubPlans.length >= 2
                    ? validSubPlans
                        .map(
                          (p: any) =>
                            `[${p.planNum}안: 월 ${Math.max(
                              0,
                              p.subSummary.finalMonthlyFee
                            ).toLocaleString()}원 · 총 ${Math.max(
                              0,
                              p.subSummary.finalTotalFee
                            ).toLocaleString()}원]`
                        )
                        .join(' vs ')
                    : `[1안: 월 ${Math.max(
                        0,
                        plan1SubSummary.finalMonthlyFee
                      ).toLocaleString()}원 · 총 ${Math.max(
                        0,
                        plan1SubSummary.finalTotalFee
                      ).toLocaleString()}원] vs [2안: 월 ${Math.max(
                        0,
                        plan2SubSummary.finalMonthlyFee
                      ).toLocaleString()}원 · 총 ${Math.max(
                        0,
                        plan2SubSummary.finalTotalFee
                      ).toLocaleString()}원]`}
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 font-mono tabular-nums font-extrabold text-[#1B64DA] dark:text-blue-300 whitespace-nowrap ml-auto">
                  월 차액 {subNetDiff > 0 ? `+${subNetDiff.toLocaleString()}` : subNetDiff.toLocaleString()}원 ·{' '}
                  {periodLabel} 총차액{' '}
                  {subTotalNetDiff > 0
                    ? `+${subTotalNetDiff.toLocaleString()}`
                    : subTotalNetDiff.toLocaleString()}
                  원
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {state.quoteMode === 'subscription' && (
        <button
          type="button"
          onClick={onShowProposal}
          className="w-full min-h-[42px] py-3.5 px-6 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer schedule-tactile shadow-[0_4px_14px_rgba(230,0,18,0.2)]"
        >
          <span>스토리 제안서 완성 · 고객 공유하기</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
