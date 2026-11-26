import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  calculateGeneralPurchaseSummary,
  calculateSubscriptionSummary,
  getActiveCompareModes,
  getAllGeneralPlanSummaries,
  getSubscriptionSurplusMeta,
  hasMeaningfulGeneralItems,
  hasMeaningfulSubItems,
  ProposalState,
  QuoteMode,
  resolveComparisonModePlanData,
  switchQuoteModeInState,
} from '../types/proposal';
import {
  CONSULTANT_PROFILE_UPDATED_EVENT,
  ConsultantProfile,
  createShortenedQuoteLinks,
  EncodedQuoteLinks,
  FRIEND_NEUTRAL_STORE_NAME,
  getEffectiveStaffPin,
  loadConsultantProfile,
  loadCustomViewerBaseUrl,
  normalizeConsultantRoleTitle,
  saveConsultantProfile,
  saveCustomStaffPin,
  saveCustomViewerBaseUrl,
  SharedQuotePayload,
  syncFriendRemoteProfileFromCloud,
  syncViewerBaseUrlFromServer,
} from '../utils/shareQuoteCodec';
import { isFriendRestrictedMode } from '../utils/friendAccessGuard';
import { maskModelCodeAfter3, maskProposalStateModels } from '../utils/modelMasker';
import { safeCopyText } from '../utils/mobileQaRuntime';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Link2,
  Lock,
  MessageSquare,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';

interface SecurityDomainConfigBoxProps {
  isDark: boolean;
  onDomainChanged: () => void;
}

const SecurityDomainConfigBox: React.FC<SecurityDomainConfigBoxProps> = ({
  isDark,
  onDomainChanged,
}) => {
  const [savedUrl, setSavedUrl] = useState(() => loadCustomViewerBaseUrl());
  const [viewerUrl, setViewerUrl] = useState(() => loadCustomViewerBaseUrl());
  const [expanded, setExpanded] = useState(() => !loadCustomViewerBaseUrl());
  const [pinInput, setPinInput] = useState('');
  const [showPinConfig, setShowPinConfig] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    syncViewerBaseUrlFromServer().then((remoteOrLocal) => {
      if (!mounted) return;
      if (remoteOrLocal && remoteOrLocal !== savedUrl) {
        setSavedUrl(remoteOrLocal);
        setViewerUrl(remoteOrLocal);
        setExpanded(false);
        onDomainChanged();
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveDomain = () => {
    const normalized = saveCustomViewerBaseUrl(viewerUrl);
    setSavedUrl(normalized);
    setViewerUrl(normalized);
    onDomainChanged();
    if (normalized) {
      setExpanded(false);
      setSavedNotice('고객 전용 미니 뷰어 주소가 저장되었습니다.');
    } else {
      setSavedNotice('별도 뷰어 주소가 해제되어 기본 주소로 발송됩니다.');
    }
    setTimeout(() => setSavedNotice(null), 3200);
  };

  const handleSavePin = () => {
    if (saveCustomStaffPin(pinInput)) {
      setPinInput('');
      setSavedNotice('새 기기 등록용 보안 코드가 변경되었습니다.');
      setTimeout(() => setSavedNotice(null), 2500);
    } else {
      setSavedNotice('보안 코드는 4자리 이상 입력해 주세요.');
    }
  };

  const isSeparated = Boolean(savedUrl);

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-xs transition ${
        isSeparated
          ? isDark
            ? 'bg-[#131C2E] border-white/10 text-slate-200'
            : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
          : isDark
          ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
          : 'bg-amber-50/80 border-amber-300 text-[#191F28]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-extrabold min-w-0 leading-snug">
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              isSeparated ? 'text-[#1B64DA]' : 'text-amber-600'
            }`}
          />
          <span className="break-keep">
            {isSeparated
              ? '고객 전용 미니 뷰어 분리 발송 활성 (내부 앱 주소 비노출)'
              : '고객 전용 미니 뷰어 주소를 연결해 주세요 (최초 1회)'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 underline hover:opacity-100 shrink-0 cursor-pointer whitespace-nowrap"
        >
          {expanded ? '접기' : isSeparated ? '설정' : '주소 입력'}
        </button>
      </div>

      {isSeparated && !expanded && (
        <div className="mt-1 text-[11.5px] font-mono text-[#8B95A1] break-all leading-snug">
          연결 뷰어: {savedUrl}
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-current/10 space-y-2.5">
          <p className="text-[11.5px] opacity-80 leading-relaxed font-medium break-keep">
            별도 배포된 고객 전용 미니 뷰어(`quote-view`) 주소를 등록하면 모든 발송 링크가 전용 뷰어 도메인으로만 생성됩니다.
          </p>

          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={viewerUrl}
              onChange={(e) => setViewerUrl(e.target.value)}
              placeholder="예: https://himart-gj.github.io/quote-view"
              className={`flex-1 px-2.5 py-2 rounded-lg border text-base sm:text-xs font-mono ${
                isDark
                  ? 'bg-[#0B1120] border-white/10 text-white'
                  : 'bg-white border-[#D1D6DB] text-[#191F28]'
              }`}
            />
            <button
              type="button"
              onClick={handleSaveDomain}
              className="min-h-[42px] sm:min-h-0 px-3.5 py-2 rounded-lg bg-[#191F28] hover:bg-[#262F3D] text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              저장
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPinConfig((v) => !v)}
              className="text-[11.5px] font-bold opacity-75 hover:opacity-100 underline cursor-pointer"
            >
              {showPinConfig ? '기기 인증 코드 설정 닫기' : '새 기기 스텔스 등록 코드 변경'}
            </button>
          </div>

          {showPinConfig && (
            <div className="space-y-1">
              <label className="block text-[11.5px] font-extrabold break-keep">
                스텔스 인증 코드 (현재: {getEffectiveStaffPin()})
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="숫자 4~8자리"
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono ${
                    isDark
                      ? 'bg-[#0B1120] border-white/10 text-white'
                      : 'bg-white border-[#D1D6DB] text-[#191F28]'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="min-h-[42px] sm:min-h-0 px-3 py-1.5 rounded-lg bg-[#1B64DA] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  변경
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {savedNotice && (
        <div className="mt-1.5 text-[11.5px] font-extrabold text-[#1B64DA] break-keep">
          ✓ {savedNotice}
        </div>
      )}
    </div>
  );
};

export interface ShareQuoteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProposalState;
  onUpdateState?: React.Dispatch<React.SetStateAction<ProposalState>>;
  customerName?: string;
  customerPhone?: string;
  initialMaskModels?: boolean;
  isDark?: boolean;
}

const MODE_ORDER: QuoteMode[] = ['general', 'subscription', 'hybrid'];

export const ShareQuoteLinkModal: React.FC<ShareQuoteLinkModalProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateState,
  customerName = '',
  customerPhone = '',
  initialMaskModels = false,
  isDark = false,
}) => {
  const [profile, setProfile] = useState<ConsultantProfile>(() =>
    loadConsultantProfile()
  );
  const [custInput, setCustInput] = useState<string>(customerName);
  const [custPhoneInput, setCustPhoneInput] = useState<string>(customerPhone);
  const [channelTab, setChannelTab] = useState<'sms' | 'kakao'>('sms');
  const [linkBundle, setLinkBundle] = useState<EncodedQuoteLinks | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'sms' | 'kakao' | 'url' | null>(
    null
  );
  const [maskSharedModels, setMaskSharedModels] = useState<boolean>(
    initialMaskModels
  );
  const [selectedCompareModes, setSelectedCompareModes] = useState<QuoteMode[]>(
    () => getActiveCompareModes(state)
  );

  const isFriendMode = isFriendRestrictedMode();

  useEffect(() => {
    if (!isOpen) return;
    setProfile(loadConsultantProfile());
    setCustInput(customerName || '');
    setCustPhoneInput(customerPhone || '');
    setMaskSharedModels(Boolean(initialMaskModels));
    setSelectedCompareModes(getActiveCompareModes(state));
    setCopiedType(null);

    if (isFriendRestrictedMode()) {
      void syncFriendRemoteProfileFromCloud().then((updated) => {
        if (updated) {
          setProfile(loadConsultantProfile());
        }
      });
    }

    const onProfileUpdated = () => {
      setProfile(loadConsultantProfile());
    };
    window.addEventListener(CONSULTANT_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      window.removeEventListener(
        CONSULTANT_PROFILE_UPDATED_EVENT,
        onProfileUpdated
      );
    };
  }, [isOpen, customerName, customerPhone, initialMaskModels]);

  const isModeDataValid = (targetState: ProposalState, m: QuoteMode): boolean => {
    const planData = resolveComparisonModePlanData(targetState, m);
    if (m === 'general') return hasMeaningfulGeneralItems(planData);
    if (m === 'subscription') return hasMeaningfulSubItems(planData);
    return hasMeaningfulGeneralItems(planData) && hasMeaningfulSubItems(planData);
  };

  const handleToggleShareMode = (modeId: QuoteMode) => {
    setCopiedType(null);
    setSelectedCompareModes((prev) => {
      const exists = prev.includes(modeId);
      let nextList: QuoteMode[];
      if (exists) {
        if (prev.length <= 1) return prev;
        nextList = prev.filter((x) => x !== modeId);
      } else {
        nextList = MODE_ORDER.filter((x) => prev.includes(x) || x === modeId);
      }
      if (onUpdateState) {
        onUpdateState((prevState) => {
          const validNext = nextList.filter((m) => isModeDataValid(prevState, m));
          return {
            ...prevState,
            compareModes: validNext.length >= 2 ? validNext : undefined,
          };
        });
      }
      return nextList;
    });
  };

  const activeCompareList = useMemo<QuoteMode[]>(() => {
    const ordered = MODE_ORDER.filter((m) => selectedCompareModes.includes(m));
    return ordered.length > 0 ? ordered : [state.quoteMode];
  }, [selectedCompareModes, state.quoteMode]);

  const emptyModeWarnings = useMemo<string[]>(() => {
    const warnings: string[] = [];
    activeCompareList.forEach((m) => {
      const planData = resolveComparisonModePlanData(state, m);
      if (m === 'general' && !hasMeaningfulGeneralItems(planData)) {
        warnings.push(
          '일반견적에 입력된 품목이 없습니다. 먼저 일반구매 탭에서 품목을 확인해 주세요.'
        );
      } else if (m === 'subscription' && !hasMeaningfulSubItems(planData)) {
        warnings.push(
          '구독견적에 입력된 품목이 없습니다. 먼저 구독구매 탭에서 품목을 확인해 주세요.'
        );
      } else if (
        m === 'hybrid' &&
        (!hasMeaningfulGeneralItems(planData) || !hasMeaningfulSubItems(planData))
      ) {
        warnings.push(
          '혼합견적에 입력된 품목이 없습니다. 먼저 혼합구매 탭에서 품목을 확인해 주세요.'
        );
      }
    });
    return warnings;
  }, [activeCompareList, state]);

  const hasEmptyModeWarning = emptyModeWarnings.length > 0;

  const composedShareBaseState = useMemo<ProposalState>(() => {
    const firstMode = activeCompareList[0];
    const switched =
      state.quoteMode !== firstMode
        ? switchQuoteModeInState(state, firstMode)
        : { ...state };
    if (activeCompareList.length < 2) {
      return {
        ...switched,
        compareModes: undefined,
      };
    }
    const nextModeConfigs = {
      ...(switched.modeConfigs || {}),
      ...(activeCompareList.includes('general')
        ? { general: resolveComparisonModePlanData(switched, 'general') }
        : {}),
      ...(activeCompareList.includes('subscription')
        ? { subscription: resolveComparisonModePlanData(switched, 'subscription') }
        : {}),
      ...(activeCompareList.includes('hybrid')
        ? { hybrid: resolveComparisonModePlanData(switched, 'hybrid') }
        : {}),
    };
    return {
      ...switched,
      compareModes: activeCompareList,
      modeConfigs: nextModeConfigs,
    };
  }, [activeCompareList, state]);

  const sampleRawModel = useMemo(() => {
    const genMod = (composedShareBaseState.generalItems || [])
      .map((it) => (it.modelName || '').trim())
      .find(Boolean);
    if (genMod) return genMod;
    const subMod = (composedShareBaseState.items || [])
      .map((it) => (it.modelName || '').trim())
      .find(Boolean);
    return subMod || 'RF85DB9581APW';
  }, [composedShareBaseState]);

  const effectiveShareState = useMemo(
    () =>
      maskSharedModels
        ? maskProposalStateModels(composedShareBaseState)
        : composedShareBaseState,
    [maskSharedModels, composedShareBaseState]
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsGenerating(true);
    saveConsultantProfile(profile);

    const payload: SharedQuotePayload = {
      v: 1,
      createdAt: new Date().toISOString().slice(0, 10),
      customerName: custInput.trim() || undefined,
      consultant: profile,
      state: effectiveShareState,
    };

    const delayMs = linkBundle ? 300 : 0;
    const timer = window.setTimeout(() => {
      createShortenedQuoteLinks(payload)
        .then((bundle) => {
          if (!cancelled) {
            setLinkBundle(bundle);
            setIsGenerating(false);
          }
        })
        .catch(() => {
          if (!cancelled) setIsGenerating(false);
        });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, profile, custInput, effectiveShareState]);

  if (!isOpen) return null;

  const activeUrl = linkBundle?.shortUrl || '';
  const genSummary = calculateGeneralPurchaseSummary(effectiveShareState);
  const subSummary = calculateSubscriptionSummary(effectiveShareState);

  const formatSubMonthlyShort = (
    sSum: ReturnType<typeof calculateSubscriptionSummary>
  ) => {
    const sSurplus = getSubscriptionSurplusMeta(
      sSum.finalMonthlyFee,
      sSum.hiPlusPayoutMethod
    );
    if (sSurplus.isSurplusZone) {
      return sSurplus.monthlySurplus > 0
        ? `월 0원(${sSurplus.surplusStickyText})`
        : '월 0원';
    }
    return `월 ${sSum.finalMonthlyFee.toLocaleString()}원`;
  };

  const formatSubTotalShort = (
    sSum: ReturnType<typeof calculateSubscriptionSummary>
  ) => {
    const sSurplus = getSubscriptionSurplusMeta(
      sSum.finalMonthlyFee,
      sSum.hiPlusPayoutMethod
    );
    if (sSurplus.isSurplusZone || sSum.finalTotalFee <= 0) {
      return sSum.totalTermSurplus > 0
        ? `0원(누적 +${sSum.totalTermSurplus.toLocaleString()}원 혜택)`
        : '0원';
    }
    return `${sSum.finalTotalFee.toLocaleString()}원`;
  };

  const honorific = custInput.trim() ? `${custInput.trim()} 고객님` : '고객님';
  const isMultiModeShare = activeCompareList.length >= 2;
  const multiModeTabLabels = activeCompareList
    .map((_, idx) => `${idx + 1}안`)
    .join(' · ');

  const multiModeSummaries = activeCompareList.map((m, idx) => {
    const pData = resolveComparisonModePlanData(effectiveShareState, m);
    const gSum = calculateGeneralPurchaseSummary(pData);
    const sSum = calculateSubscriptionSummary(pData);
    if (m === 'general') {
      return {
        mode: m,
        planLabel: `${idx + 1}안`,
        modeTitle: '일반구매',
        line: `[${idx + 1}안 일반구매] 최종 체감가 ${gSum.rawNet.toLocaleString()}원`,
        itemNames: gSum.displayItems
          .map((it) => `${it.category}${it.modelName ? `(${it.modelName})` : ''}`)
          .filter(Boolean),
      };
    }
    if (m === 'subscription') {
      return {
        mode: m,
        planLabel: `${idx + 1}안`,
        modeTitle: '구독구매',
        line: `[${idx + 1}안 구독구매] ${formatSubMonthlyShort(sSum)} (${sSum.periodLabel} 총 체감 ${formatSubTotalShort(sSum)})`,
        itemNames: sSum.validSubNames,
      };
    }
    return {
      mode: m,
      planLabel: `${idx + 1}안`,
      modeTitle: '혼합구매',
      line: `[${idx + 1}안 혼합구매] 일시불 체감 ${gSum.rawNet.toLocaleString()}원 + 구독 ${formatSubMonthlyShort(sSum)}`,
      itemNames: [
        ...gSum.displayItems
          .map((it) => `${it.category}${it.modelName ? `(${it.modelName})` : ''}`)
          .filter(Boolean),
        ...sSum.validSubNames,
      ],
    };
  });

  const itemLine = isMultiModeShare
    ? Array.from(new Set(multiModeSummaries.flatMap((s) => s.itemNames))).join(', ') ||
      '맞춤 가전 비교 패키지'
    : effectiveShareState.quoteMode === 'subscription'
    ? subSummary.validSubNames.join(', ') || '맞춤 가전 구독 패키지'
    : effectiveShareState.generalItems
        .map((it) => `${it.category}${it.modelName ? `(${it.modelName})` : ''}`)
        .filter(Boolean)
        .join(', ') || '맞춤 가전 패키지';

  const subOneTimeExtra =
    subSummary.totalSubCashback + subSummary.subLotteBillingDiscount;
  const subOneTimeLabel =
    subSummary.subLotteBillingDiscount > 0 && subSummary.totalSubCashback > 0
      ? `5% 청구할인·캐시백 -${subOneTimeExtra.toLocaleString()}원 반영`
      : subSummary.subLotteBillingDiscount > 0
      ? `롯데카드 5% 청구할인 -${subSummary.subLotteBillingDiscount.toLocaleString()}원 반영`
      : subSummary.totalSubCashback > 0
      ? `1회 캐시백 -${subSummary.totalSubCashback.toLocaleString()}원 반영`
      : '';

  const mainSubSurplus = getSubscriptionSurplusMeta(
    subSummary.finalMonthlyFee,
    subSummary.hiPlusPayoutMethod
  );
  const mainSubMonthlyHighlight = mainSubSurplus.isSurplusZone
    ? mainSubSurplus.monthlySurplus > 0
      ? `월 체감 0원 (${mainSubSurplus.surplusStickyText})`
      : '월 체감 0원'
    : `월 체감 ${subSummary.finalMonthlyFee.toLocaleString()}원`;

  const priceHighlight =
    effectiveShareState.quoteMode === 'subscription'
      ? `${mainSubMonthlyHighlight} (최종 ${
          subSummary.periodLabel
        } 체감가 ${formatSubTotalShort(subSummary)}${
          subOneTimeLabel ? ` · ${subOneTimeLabel}` : ''
        })`
      : effectiveShareState.quoteMode === 'hybrid'
      ? `일시불 체감 ${genSummary.rawNet.toLocaleString()}원 + 구독 ${formatSubMonthlyShort(
          subSummary
        )} (통합 최종 체감가 ${(
          genSummary.rawNet + subSummary.finalTotalFee
        ).toLocaleString()}원${subOneTimeLabel ? ` · ${subOneTimeLabel}` : ''})`
      : `최종 혜택 체감가 ${genSummary.rawNet.toLocaleString()}원`;

  const validSharePlans = getAllGeneralPlanSummaries(effectiveShareState).filter(
    (p) => p.hasData
  );
  const hasMultipleGeneralPlans = validSharePlans.length >= 2;
  const planRangeText = hasMultipleGeneralPlans
    ? validSharePlans.map((p) => `${p.planNum}안`).join('·')
    : '';

  const buildSmsShareMessage = () => {
    const shortItem =
      itemLine.length > 42 ? `${itemLine.slice(0, 40)}...` : itemLine;
    if (isMultiModeShare) {
      return [
        `[${profile.storeName}] ${honorific} 맞춤 비교 견적서 안내`,
        `품목: ${shortItem}`,
        ...multiModeSummaries.map((s) => s.line),
        ``,
        `아래 링크에서 [${multiModeTabLabels}] 탭을 눌러 비교해 보세요.`,
        ``,
        activeUrl,
        ``,
        `담당: ${profile.name}${profile.phone ? ` (${profile.phone})` : ''}`,
      ]
        .join('\n')
        .trim();
    }
    return [
      `[${profile.storeName}] ${honorific} 맞춤 견적서 안내`,
      `품목: ${shortItem}`,
      `혜택: ${priceHighlight}`,
      ...(hasMultipleGeneralPlans
        ? validSharePlans.map((p) => {
            if (effectiveShareState.quoteMode === 'subscription') {
              return `• ${p.planNum}안: ${formatSubMonthlyShort(p.subSummary)}`;
            }
            if (effectiveShareState.quoteMode === 'hybrid') {
              return `• ${p.planNum}안: 일시불 ${p.genSummary.rawNet.toLocaleString()}원 + ${formatSubMonthlyShort(p.subSummary)}`;
            }
            return `• ${p.planNum}안: 체감 ${p.genSummary.rawNet.toLocaleString()}원`;
          })
        : []),
      ``,
      hasMultipleGeneralPlans
        ? `아래 링크를 누르시면 스마트폰에서 [${planRangeText}] 및 제휴카드·라이프케어 체감가를 직접 비교하실 수 있습니다.`
        : `아래 전용 링크를 누르시면 스마트폰에서 상세 혜택 내역과 제휴카드·라이프케어 조건을 확인하실 수 있습니다.`,
      ``,
      activeUrl,
      ``,
      `담당: ${profile.name}${profile.phone ? ` (${profile.phone})` : ''}`,
    ]
      .join('\n')
      .trim();
  };

  const buildKakaoShareMessage = () => {
    if (isMultiModeShare) {
      return [
        `[${profile.storeName}] ${honorific} 맞춤 비교 견적서`,
        `상담 품목: ${itemLine}`,
        ...multiModeSummaries.map((s) => `• ${s.line}`),
        ``,
        `아래 전용 링크에서 [${multiModeTabLabels}] 탭을 눌러 혜택을 직접 비교해 보세요.`,
        ``,
        activeUrl,
        ``,
        `담당: ${profile.name} (${normalizeConsultantRoleTitle(profile.roleTitle)})${
          profile.phone ? ` / ${profile.phone}` : ''
        }`,
        profile.greeting ? `"${profile.greeting}"` : '',
      ]
        .filter((line) => line !== undefined && line !== '')
        .join('\n');
    }
    return [
      `[${profile.storeName}] ${honorific} ${
        hasMultipleGeneralPlans ? '맞춤 비교 견적서' : '공식 맞춤 견적서'
      }`,
      `상담 품목: ${itemLine}`,
      `핵심 혜택: ${priceHighlight}`,
      ...(hasMultipleGeneralPlans
        ? validSharePlans.map((p) => {
            if (effectiveShareState.quoteMode === 'subscription') {
              return `• [${p.planNum}안] ${formatSubMonthlyShort(p.subSummary)} (${p.subSummary.periodLabel} 총 ${formatSubTotalShort(p.subSummary)})`;
            }
            if (effectiveShareState.quoteMode === 'hybrid') {
              return `• [${p.planNum}안] 일시불 ${p.genSummary.rawNet.toLocaleString()}원 + 구독 ${formatSubMonthlyShort(p.subSummary)}`;
            }
            return `• [${p.planNum}안] 실결제 ${p.genSummary.payPrice.toLocaleString()}원 / 최종 체감 ${p.genSummary.rawNet.toLocaleString()}원`;
          })
        : []),
      ``,
      hasMultipleGeneralPlans
        ? `아래 전용 링크에서 [${planRangeText}] 및 제휴카드·구좌별 체감가를 직접 비교하실 수 있습니다.`
        : `아래 전용 링크에서 상세 혜택과 제휴카드·구좌별 조건을 확인하실 수 있습니다.`,
      ``,
      activeUrl,
      ``,
      `담당: ${profile.name} (${normalizeConsultantRoleTitle(profile.roleTitle)})${
        profile.phone ? ` / ${profile.phone}` : ''
      }`,
      profile.greeting ? `"${profile.greeting}"` : '',
    ]
      .filter((line) => line !== undefined && line !== '')
      .join('\n');
  };

  const previewText =
    channelTab === 'sms' ? buildSmsShareMessage() : buildKakaoShareMessage();

  const handleCopy = async (mode: 'sms' | 'kakao' | 'url') => {
    if (isGenerating || !activeUrl || hasEmptyModeWarning) return;
    const text =
      mode === 'sms'
        ? buildSmsShareMessage()
        : mode === 'kakao'
        ? buildKakaoShareMessage()
        : activeUrl;
    const ok = await safeCopyText(text);
    if (ok) {
      setCopiedType(mode);
      setTimeout(() => setCopiedType(null), 3000);
    }
  };

  const handleOpenNativeSmsApp = () => {
    if (isGenerating || !activeUrl || hasEmptyModeWarning) return;
    const cleanPhone = custPhoneInput.replace(/[^0-9+]/g, '');
    const body = encodeURIComponent(buildSmsShareMessage());
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const sep = isIOS ? '&' : '?';
    const smsHref = cleanPhone
      ? `sms:${cleanPhone}${sep}body=${body}`
      : `sms:${sep}body=${body}`;
    window.location.href = smsHref;
  };

  const handlePreviewCustomerScreen = () => {
    if (isGenerating || !activeUrl || hasEmptyModeWarning) return;
    const target = linkBundle?.compactUrl || activeUrl;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const modeBadgeLabel =
    linkBundle?.mode === 'server'
      ? `단축 완료 (${activeUrl.length}자)`
      : linkBundle?.mode === 'external'
      ? `URL 단축 (${activeUrl.length}자)`
      : `경량 토큰 (${activeUrl.length}자)`;

  const shellCls = isDark
    ? 'bg-[#131C2E] text-slate-100 border-white/10'
    : 'bg-white text-[#191F28] border-[#D1D6DB]';
  const inputCls = isDark
    ? 'bg-[#0B1120] text-white border-white/10 placeholder:text-slate-500 focus:border-[#60A5FA]'
    : 'bg-[#F8FAFC] text-[#191F28] border-[#D1D6DB] placeholder:text-[#8B95A1] focus:border-[#1B64DA]';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-t-[4px] border-t-[#E60012] shadow-2xl overflow-hidden schedule-sheet-enter ${shellCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div
          className={`px-5 py-4 border-b shrink-0 flex items-center justify-between gap-3 ${
            isDark ? 'bg-[#0B1120] border-white/10' : 'bg-[#F8FAFC] border-[#E5E8EB]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E60012] text-white flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-wider">
                  LOTTE HIMART
                </span>
                <span className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300">
                  고객 전용 미니 뷰어 발송
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black break-keep leading-snug mt-0.5">
                맞춤 견적 공유 링크 생성 · 전송
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* STEP 1: 모델명 표시 보안 모드 선택 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#E60012]" />
                <span>STEP 1 · 모델코드 공개 방식 선택</span>
              </span>
              <span className="text-[11.5px] font-semibold text-[#8B95A1]">
                선택 즉시 링크 실시간 갱신
              </span>
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMaskSharedModels(false);
                  setCopiedType(null);
                }}
                className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                  !maskSharedModels
                    ? isDark
                      ? 'bg-[#1E293B] border-[#60A5FA] text-white'
                      : 'bg-[#EFF6FF] border-[#1B64DA] text-[#191F28] shadow-2xs'
                    : isDark
                    ? 'bg-[#0B1120] border-white/10 text-slate-400 hover:text-slate-200'
                    : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#4E5968] hover:border-[#D1D6DB]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#1B64DA]" />
                    <span>전체 모델명 공개</span>
                  </span>
                  {!maskSharedModels && (
                    <span className="px-2 py-0.5 rounded bg-[#1B64DA] text-white text-[11.5px] font-black">
                      선택됨
                    </span>
                  )}
                </div>
                <div className="mt-1.5 px-2 py-1 rounded bg-white dark:bg-black/40 border border-[#E5E8EB] dark:border-white/10 font-mono text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 break-all">
                  예: {sampleRawModel}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMaskSharedModels(true);
                  setCopiedType(null);
                }}
                className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                  maskSharedModels
                    ? 'bg-[#FFF1F2] dark:bg-[#2A1519] border-[#E60012] text-[#191F28] dark:text-white shadow-2xs'
                    : isDark
                    ? 'bg-[#0B1120] border-white/10 text-slate-400 hover:text-slate-200'
                    : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#4E5968] hover:border-[#D1D6DB]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-[#E60012]" />
                    <span>앞 3자리 외 *** 가림</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11.5px] font-black ${
                      maskSharedModels
                        ? 'bg-[#E60012] text-white'
                        : 'bg-[#FFF1F2] text-[#E60012]'
                    }`}
                  >
                    {maskSharedModels ? '선택됨' : '비교방지'}
                  </span>
                </div>
                <div className="mt-1.5 px-2 py-1 rounded bg-white dark:bg-black/40 border border-[#FECDD3] dark:border-white/10 font-mono text-[11.5px] font-bold text-[#E60012] break-all">
                  예: {maskModelCodeAfter3(sampleRawModel)}
                </div>
              </button>
            </div>
          </div>

          {/* STEP 2: 함께 보낼 구매방식 탭 선택 */}
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 ${
              isDark ? 'bg-[#0B1120] border-white/10' : 'bg-[#F8FAFC] border-[#E5E8EB]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#1B64DA]" />
                <span>STEP 2 · 함께 보낼 견적탭 구성 (복수 선택 시 고객 비교탭 생성)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-2">
              {(
                [
                  { id: 'general' as QuoteMode, label: '일반구매' },
                  { id: 'subscription' as QuoteMode, label: '구독구매' },
                  { id: 'hybrid' as QuoteMode, label: '혼합구매' },
                ]
              ).map((m) => {
                const checked = activeCompareList.includes(m.id);
                const orderIdx = activeCompareList.indexOf(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleShareMode(m.id)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-between gap-1 transition cursor-pointer ${
                      checked
                        ? isDark
                          ? 'bg-[#60A5FA] text-[#0B1120] border-[#60A5FA]'
                          : 'bg-[#191F28] text-white border-[#191F28]'
                        : isDark
                        ? 'bg-[#131C2E] text-slate-400 border-white/10 hover:text-white'
                        : 'bg-white text-[#4E5968] border-[#D1D6DB] hover:text-[#191F28]'
                    }`}
                  >
                    <span className="whitespace-nowrap">
                      {checked ? '✓ ' : ''}
                      {m.label}
                    </span>
                    {checked && isMultiModeShare && orderIdx >= 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black whitespace-nowrap">
                        {orderIdx + 1}안
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {emptyModeWarnings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {emptyModeWarnings.map((warn, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-amber-300 bg-amber-50 text-amber-950 px-3 py-2 text-xs font-bold flex items-start gap-1.5 leading-snug"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="break-keep">{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: 고객 · 소속 지점 · 담당 컨설턴트 정보 */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  고객 성함 (선택)
                </label>
                <input
                  type="text"
                  value={custInput}
                  onChange={(e) => setCustInput(e.target.value)}
                  placeholder="예: 김민수"
                  className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  고객 연락처 (문자앱 수신번호)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={custPhoneInput}
                  onChange={(e) => setCustPhoneInput(e.target.value)}
                  placeholder="010-0000-0000"
                  className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold font-mono focus:outline-none ${inputCls}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  소속 지점명 (자동저장 · 고객 견적서 및 문자·카톡 상단 표기)
                </label>
                <input
                  type="text"
                  value={profile.storeName}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      storeName: e.target.value,
                      storeCustomized: true,
                    }))
                  }
                  placeholder="예: 롯데하이마트 수원점"
                  className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none ${inputCls}`}
                />
                {isFriendMode &&
                  profile.storeName.trim() === FRIEND_NEUTRAL_STORE_NAME && (
                    <p className="mt-1 text-[11px] font-bold text-[#1B64DA] dark:text-blue-300 break-keep">
                      💡 본인 소속 지점명(예: 롯데하이마트 OO점)을 한 번 입력해 두면 다음부터 자동 저장됩니다.
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  담당 컨설턴트 (자동저장)
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="예: 홍길동"
                  className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 mb-1">
                  담당자 직통 번호 (통화·문자 연동)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="010-0000-0000"
                  className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold font-mono focus:outline-none ${inputCls}`}
                />
              </div>
            </div>
          </div>

          {/* 미니 뷰어 도메인 연결 설정 (오너/내부 직원 기기 전용) */}
          {!isFriendMode && (
            <SecurityDomainConfigBox
              isDark={isDark}
              onDomainChanged={() => {
                setProfile((p) => ({ ...p }));
              }}
            />
          )}

          {/* 생성된 단축 URL 바 */}
          <div
            className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-2.5 ${
              maskSharedModels
                ? 'bg-[#FFF1F2] dark:bg-[#2A1519] border-[#FECDD3] dark:border-[#E60012]/50'
                : isDark
                ? 'bg-[#0B1120] border-white/10'
                : 'bg-[#EFF6FF] border-[#BFDBFE]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div
                className={`text-[11.5px] font-black ${
                  maskSharedModels ? 'text-[#E60012]' : 'text-[#1B64DA]'
                }`}
              >
                {isGenerating
                  ? '전용 링크 생성 중...'
                  : maskSharedModels
                  ? `[모델가림 보안 링크] ${modeBadgeLabel}`
                  : `[전체 모델명 공개 링크] ${modeBadgeLabel}`}
              </div>
              <div className="text-xs font-mono font-bold break-all leading-snug mt-0.5">
                {activeUrl || '생성 중...'}
              </div>
            </div>
            <button
              type="button"
              disabled={isGenerating || !activeUrl || hasEmptyModeWarning}
              onClick={() => handleCopy('url')}
              className={`min-h-[36px] shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 whitespace-nowrap ${
                maskSharedModels
                  ? 'bg-[#E60012] hover:bg-[#C8000F]'
                  : 'bg-[#1B64DA] hover:bg-[#1552B5]'
              }`}
            >
              {copiedType === 'url' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>복사됨</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{isGenerating ? '생성중...' : '링크 복사'}</span>
                </>
              )}
            </button>
          </div>

          {/* 채널 탭 + 메시지 미리보기 */}
          <div className="space-y-2">
            <div
              className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
                isDark ? 'bg-[#0B1120] border-white/10' : 'bg-[#F2F4F6] border-[#E5E8EB]'
              }`}
            >
              <button
                type="button"
                onClick={() => setChannelTab('sms')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  channelTab === 'sms'
                    ? isDark
                      ? 'bg-[#60A5FA] text-[#0B1120]'
                      : 'bg-[#191F28] text-white'
                    : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>문자(SMS) 발송용</span>
              </button>
              <button
                type="button"
                onClick={() => setChannelTab('kakao')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  channelTab === 'kakao'
                    ? 'bg-[#FEE500] text-[#191919]'
                    : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>카카오톡 발송용</span>
              </button>
            </div>

            <div
              className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                isDark
                  ? 'bg-[#0B1120] border-white/10 text-slate-300'
                  : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
              }`}
            >
              <div className="flex items-center justify-between text-[11.5px] font-extrabold text-[#8B95A1]">
                <span>발송 문구 미리보기</span>
                <span className="tabular-nums">{previewText.length}자</span>
              </div>
              <pre className="whitespace-pre-wrap break-all font-sans text-xs leading-relaxed max-h-28 overflow-y-auto">
                {previewText}
              </pre>
            </div>
          </div>

          {/* 하단 발송 실행 버튼 */}
          {channelTab === 'sms' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isGenerating || !activeUrl || hasEmptyModeWarning}
                onClick={handleOpenNativeSmsApp}
                className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>{isGenerating ? '링크 갱신 중...' : '휴대폰 문자앱 바로 열기'}</span>
              </button>

              <button
                type="button"
                disabled={isGenerating || !activeUrl || hasEmptyModeWarning}
                onClick={() => handleCopy('sms')}
                className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#191F28] hover:bg-[#262F3D] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
              >
                {copiedType === 'sms' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>문자 안내문+링크 복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>{isGenerating ? '링크 갱신 중...' : '문자 안내문 + 링크 복사'}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isGenerating || !activeUrl || hasEmptyModeWarning}
                onClick={() => handleCopy('kakao')}
                className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
              >
                {copiedType === 'kakao' ? (
                  <>
                    <Check className="w-4 h-4 text-[#1B64DA] shrink-0" />
                    <span>카톡 안내문+링크 복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>{isGenerating ? '링크 갱신 중...' : '카톡 안내문 + 링크 복사'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isGenerating || !activeUrl || hasEmptyModeWarning}
                onClick={handlePreviewCustomerScreen}
                className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#191F28] hover:bg-[#262F3D] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>고객 화면 새 탭 미리보기</span>
              </button>
            </div>
          )}

          {channelTab === 'sms' && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11.5px] text-[#8B95A1] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1B64DA] shrink-0" />
                <span>고객 전용 격리 뷰어로 안전하게 연결됩니다</span>
              </span>
              <button
                type="button"
                disabled={!activeUrl || hasEmptyModeWarning}
                onClick={handlePreviewCustomerScreen}
                className="text-xs font-extrabold text-[#1B64DA] hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>고객 화면 미리보기</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
