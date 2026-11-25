import React from 'react';
import {
  calculateGeneralPurchaseSummary,
  calculateSubscriptionSummary,
  getActiveCompareModes,
  getSubscriptionSurplusMeta,
  ProposalState,
  QuoteMode,
  resolveComparisonModePlanData,
  switchQuoteModeInState,
} from '../types/proposal';
import { Check, Layers } from 'lucide-react';

export interface QuoteModeComparisonControlBarProps {
  state: ProposalState;
  onChange: React.Dispatch<React.SetStateAction<ProposalState>>;
  onSwitchMode?: (mode: QuoteMode) => void;
  onShowProposal: () => void;
}

export const QuoteModeComparisonControlBar: React.FC<
  QuoteModeComparisonControlBarProps
> = ({ state, onChange, onSwitchMode, onShowProposal }) => {
  const activeCompare = getActiveCompareModes(state);
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {/* Primary Quote Mode Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-[#F2F4F6] dark:bg-[#1E293B] border border-[#E5E8EB] dark:border-white/10 w-full">
          {([
            { id: 'general' as QuoteMode, label: '일반 구매' },
            { id: 'subscription' as QuoteMode, label: '구독 구매' },
            { id: 'hybrid' as QuoteMode, label: '일반+구독 혼합' },
          ]).map((m) => {
            const isCur = state.quoteMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (onSwitchMode) {
                    onSwitchMode(m.id);
                  } else {
                    onChange((prev) => switchQuoteModeInState(prev, m.id));
                  }
                }}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  isCur
                    ? 'bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] shadow-xs'
                    : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Multi-mode Share Inclusion Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 whitespace-nowrap mr-0.5">
            고객 비교탭 포함:
          </span>
          {([
            { id: 'general' as QuoteMode, label: '일반' },
            { id: 'subscription' as QuoteMode, label: '구독' },
            { id: 'hybrid' as QuoteMode, label: '혼합' },
          ]).map((m) => {
            const checked = activeCompare.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange((prev) => {
                    const curList = getActiveCompareModes(prev);
                    const exists = curList.includes(m.id);
                    let nextList: QuoteMode[];
                    if (exists) {
                      nextList = curList.filter((x) => x !== m.id);
                      if (nextList.length === 0) nextList = [prev.quoteMode];
                    } else {
                      const order: QuoteMode[] = ['general', 'subscription', 'hybrid'];
                      nextList = order.filter((x) => curList.includes(x) || x === m.id);
                    }
                    return {
                      ...prev,
                      compareModes: nextList.length >= 2 ? nextList : undefined,
                    };
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  checked
                    ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1B64DA] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#3B82F6]/40'
                    : 'bg-white dark:bg-[#131C2E] text-[#8B95A1] dark:text-slate-400 border-[#E5E8EB] dark:border-white/10 hover:border-[#CBD5E1] hover:text-[#191F28] dark:hover:text-white'
                }`}
              >
                <span className="font-mono text-[11.5px]">{checked ? '✓' : '+'}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onChange((prev) => {
                const curList = getActiveCompareModes(prev);
                const isAll3 = curList.length === 3;
                return {
                  ...prev,
                  compareModes: isAll3
                    ? undefined
                    : ['general', 'subscription', 'hybrid'],
                };
              });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold transition cursor-pointer whitespace-nowrap border ${
              activeCompare.length === 3
                ? 'bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA]'
                : 'bg-[#F2F4F6] dark:bg-[#1E293B] text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-white/10 hover:text-[#191F28] dark:hover:text-white'
            }`}
          >
            {activeCompare.length === 3 ? '✓ 3종 모두 포함' : '3종 비교'}
          </button>
        </div>
      </div>

      {activeCompare.length >= 2 && (
        <div className="px-3.5 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/35 border border-[#BFDBFE] dark:border-[#3B82F6]/40 text-xs font-medium text-[#1E3A8A] dark:text-blue-100 flex flex-wrap items-center justify-between gap-2">
          <span className="break-keep">
            <strong className="text-[#1B64DA] dark:text-[#93C5FD] font-extrabold">
              {activeCompare
                .map((m) =>
                  m === 'general' ? '일반구매' : m === 'subscription' ? '구독구매' : '일반+구독 혼합'
                )
                .join(' · ')}
            </strong>{' '}
            방식이 비교 탭으로 묶여 고객이 터치 한 번으로 전환 비교할 수 있습니다.
          </span>
          <button
            type="button"
            onClick={onShowProposal}
            className="px-2.5 py-1 rounded-lg bg-[#1B64DA] text-white text-[11.5px] font-bold cursor-pointer shrink-0 whitespace-nowrap"
          >
            비교 제안서 확인 →
          </button>
        </div>
      )}
    </div>
  );
};

export interface PreviewModeComparisonBarProps {
  state: ProposalState;
  onChange: React.Dispatch<React.SetStateAction<ProposalState>>;
  onSwitchMode?: (mode: QuoteMode) => void;
  onEnsureProposalTab: () => void;
}

export const PreviewModeComparisonBar: React.FC<
  PreviewModeComparisonBarProps
> = ({ state, onChange, onSwitchMode, onEnsureProposalTab }) => {
  const curList = getActiveCompareModes(state);
  const handleSelectOrViewMode = (modeId: QuoteMode) => {
    if (onSwitchMode) {
      onSwitchMode(modeId);
    } else {
      onChange((prev) => switchQuoteModeInState(prev, modeId));
    }
    onEnsureProposalTab();
  };

  const handleToggleIncludeMode = (e: React.MouseEvent, modeId: QuoteMode) => {
    e.stopPropagation();
    onChange((prev) => {
      const prevList = getActiveCompareModes(prev);
      const exists = prevList.includes(modeId);
      let nextList: QuoteMode[];
      if (exists) {
        nextList = prevList.filter((x) => x !== modeId);
        if (nextList.length === 0) nextList = [prev.quoteMode];
      } else {
        const order: QuoteMode[] = ['general', 'subscription', 'hybrid'];
        nextList = order.filter((x) => prevList.includes(x) || x === modeId);
      }
      return {
        ...prev,
        compareModes: nextList.length >= 2 ? nextList : undefined,
      };
    });
    onEnsureProposalTab();
  };

  return (
    <div className="inline-flex items-center gap-0.5 bg-[#F2F4F6] dark:bg-[#1E293B] p-0.5 rounded-lg border border-[#E5E8EB] dark:border-white/10 shrink-0">
      {([
        { id: 'general' as QuoteMode, label: '일반' },
        { id: 'subscription' as QuoteMode, label: '구독' },
        { id: 'hybrid' as QuoteMode, label: '혼합' },
      ]).map((m) => {
        const checked = curList.includes(m.id);
        const isCurrentView = state.quoteMode === m.id;
        return (
          <div
            key={m.id}
            className={`inline-flex items-center rounded-md overflow-hidden transition ${
              isCurrentView
                ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                : checked
                ? 'bg-[#EFF6FF] text-[#1B64DA] dark:bg-[#1B64DA]/25 dark:text-[#93C5FD]'
                : 'text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white'
            }`}
          >
            <button
              type="button"
              onClick={(e) => handleToggleIncludeMode(e, m.id)}
              title={`${m.label} 견적을 고객 공유 탭에 포함/제외`}
              className="pl-1.5 pr-0.5 py-1 text-[11.5px] font-mono font-bold cursor-pointer opacity-80 hover:opacity-100"
            >
              {checked ? '☑' : '☐'}
            </button>
            <button
              type="button"
              onClick={() => handleSelectOrViewMode(m.id)}
              title={`${m.label} 제안서 화면으로 전환`}
              className="pr-2 pl-0.5 py-1 font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              {m.label}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export interface MultiModeTabSwitcherBannerProps {
  state: ProposalState;
  onSelectMode: (mode: QuoteMode) => void;
  compact?: boolean;
}

export const MultiModeTabSwitcherBanner: React.FC<
  MultiModeTabSwitcherBannerProps
> = ({ state, onSelectMode, compact = false }) => {
  const compareModes = getActiveCompareModes(state);
  if (compareModes.length < 2) return null;

  const genData = resolveComparisonModePlanData(state, 'general');
  const subData = resolveComparisonModePlanData(state, 'subscription');
  const hybData = resolveComparisonModePlanData(state, 'hybrid');

  const genSum = calculateGeneralPurchaseSummary(genData);
  const subSum = calculateSubscriptionSummary(subData);
  const hybGenSum = calculateGeneralPurchaseSummary(hybData);
  const hybSubSum = calculateSubscriptionSummary(hybData);
  const hybCombinedNet = hybGenSum.rawNet + hybSubSum.finalTotalFee;

  const subSurplus = getSubscriptionSurplusMeta(
    subSum.finalMonthlyFee,
    subSum.hiPlusPayoutMethod
  );
  const hybSubSurplus = getSubscriptionSurplusMeta(
    hybSubSum.finalMonthlyFee,
    hybSubSum.hiPlusPayoutMethod
  );

  const getModeMeta = (m: QuoteMode, idx: number) => {
    const planBadge = `비교 ${idx + 1}안`;
    if (m === 'general') {
      return {
        badge: planBadge,
        title: '일반 구매 설계안',
        price: `${genSum.rawNet.toLocaleString()}원`,
        sub: `매장 실결제 ${genSum.payPrice.toLocaleString()}원`,
      };
    }
    if (m === 'subscription') {
      return {
        badge: planBadge,
        title: `구독 구매 (${subSum.periodLabel})`,
        price: subSurplus.isSurplusZone
          ? subSurplus.monthlySurplus > 0
            ? `월 0원 (${subSurplus.surplusStickyText})`
            : '월 0원'
          : `월 ${subSum.finalMonthlyFee.toLocaleString()}원`,
        sub:
          subSurplus.isSurplusZone || subSum.finalTotalFee <= 0
            ? subSum.totalTermSurplus > 0
              ? `총 +${subSum.totalTermSurplus.toLocaleString()}원 초과 혜택`
              : '총 체감 0원'
            : `총 체감 ${subSum.finalTotalFee.toLocaleString()}원`,
      };
    }
    return {
      badge: planBadge,
      title: '일반 + 구독 혼합',
      price: `일시불 ${Math.round(hybGenSum.rawNet / 10000).toLocaleString()}만 + ${
        hybSubSurplus.isSurplusZone
          ? hybSubSurplus.monthlySurplus > 0
            ? `월 0원 (${hybSubSurplus.surplusStickyText})`
            : '월 0원'
          : `월 ${hybSubSum.finalMonthlyFee.toLocaleString()}원`
      }`,
      sub: `통합 총 체감 ${hybCombinedNet.toLocaleString()}원`,
    };
  };

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-white/10 text-[#191F28] dark:text-[#F1F5F9] shadow-[0_2px_10px_rgba(25,31,40,0.04)] ${
        compact ? 'p-3 space-y-2' : 'p-3.5 sm:p-4 space-y-2.5'
      } no-print`}
    >
      <div className="flex items-center justify-between text-xs font-bold gap-2 flex-wrap">
        <span className="text-[#191F28] dark:text-white flex items-center gap-1.5 font-extrabold">
          <Layers className="w-3.5 h-3.5 text-[#1B64DA] dark:text-[#60A5FA] shrink-0" />
          <span>구매 방식별 맞춤 혜택 비교 ({compareModes.length}가지 방식)</span>
        </span>
        <span className="text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
          원하시는 구매 방식을 눌러 체감 혜택을 비교해 보세요
        </span>
      </div>
      <div
        className={`grid ${
          compareModes.length === 3
            ? 'grid-cols-1 min-[420px]:grid-cols-3'
            : 'grid-cols-1 min-[380px]:grid-cols-2'
        } gap-2`}
      >
        {compareModes.map((m, idx) => {
          const active = state.quoteMode === m;
          const meta = getModeMeta(m, idx);
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelectMode(m)}
              className={`p-3 rounded-xl text-left border transition cursor-pointer schedule-tactile min-w-0 flex flex-col justify-between ${
                active
                  ? 'bg-[#191F28] dark:bg-[#1E293B] text-white border-[#191F28] dark:border-[#60A5FA] shadow-xs'
                  : 'bg-[#F8FAFC] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 border-[#E5E8EB] dark:border-white/10 hover:border-[#CBD5E1]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <span
                    className={`text-[11.5px] font-extrabold tracking-tight ${
                      active ? 'text-[#93C5FD]' : 'text-[#1B64DA] dark:text-[#60A5FA]'
                    }`}
                  >
                    {meta.badge}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <div className="text-xs sm:text-[13px] font-extrabold break-keep leading-snug">
                  {meta.title}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-current/10">
                <div
                  className={`text-sm sm:text-[15px] font-extrabold font-mono tabular-nums break-keep leading-tight ${
                    active ? 'text-white' : 'text-[#E60012] dark:text-[#FF3B47]'
                  }`}
                >
                  {meta.price}
                </div>
                <div
                  className={`text-[11.5px] font-medium mt-0.5 font-mono tabular-nums break-keep ${
                    active ? 'text-slate-300' : 'text-[#4E5968] dark:text-slate-400'
                  }`}
                >
                  {meta.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export interface MultiModeComparisonSectionProps {
  state: ProposalState;
  activeCustomer?: { id: string; name: string; phone?: string } | null;
  fmtCat: (raw?: string | null) => string;
  fmtModel: (raw?: string | null) => string;
}

export const MultiModeComparisonSection: React.FC<
  MultiModeComparisonSectionProps
> = () => {
  return null;
};
