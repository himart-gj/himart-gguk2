import React, { useEffect, useMemo, useState } from 'react';
import {
  AFFILIATE_CARDS,
  AffiliateCardId,
  calculateGeneralHiPreedSummary,
  calculateGeneralPurchaseSummary,
  calculateHiPlusSummary,
  calculateSubscriptionSummary,
  GENERAL_CARD_OPTIONS,
  GENERAL_HIPREED_PLANS,
  GeneralCardType,
  GeneralHiPreedKey,
  getGeneralPlan1And2Summaries,
  HI_PLUS_PLANS,
  HiPlusKey,
  ProposalState,
  switchGeneralPlanInState,
} from '../types/proposal';
import {
  ConsultantProfile,
  encodeSharedQuoteUrl,
  loadConsultantProfile,
  saveConsultantProfile,
  SharedQuotePayload,
} from '../utils/shareQuoteCodec';
import { SpringNumberFlow } from './SpringNumberFlow';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  ExternalLink,
  Gift,
  Layers,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';

// ============================================================================
// 1. 상담사용 [카톡 인터랙티브 견적 링크 생성 & 전달 메시지 복사] 모달
// ============================================================================
export interface ShareQuoteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProposalState;
  customerName?: string;
  isDark?: boolean;
}

export const ShareQuoteLinkModal: React.FC<ShareQuoteLinkModalProps> = ({
  isOpen,
  onClose,
  state,
  customerName = '',
  isDark = false,
}) => {
  const [profile, setProfile] = useState<ConsultantProfile>(() =>
    loadConsultantProfile()
  );
  const [custInput, setCustInput] = useState<string>(customerName);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'kakao' | 'url' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProfile(loadConsultantProfile());
    setCustInput(customerName || '');
    setCopiedType(null);
  }, [isOpen, customerName]);

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
      state,
    };

    encodeSharedQuoteUrl(payload)
      .then((url) => {
        if (!cancelled) {
          setGeneratedUrl(url);
          setIsGenerating(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, profile, custInput, state]);

  if (!isOpen) return null;

  const genSummary = calculateGeneralPurchaseSummary(state);
  const subSummary = calculateSubscriptionSummary(state);

  const buildKakaoShareMessage = () => {
    const honorific = custInput.trim() ? `${custInput.trim()} 고객님` : '고객님';
    const itemLine =
      state.quoteMode === 'subscription'
        ? subSummary.validSubNames.join(', ') || '맞춤 가전 구독 패키지'
        : state.generalItems
            .map((it) => `${it.category}${it.modelName ? `(${it.modelName})` : ''}`)
            .filter(Boolean)
            .join(', ') || '맞춤 가전 패키지';

    const priceHighlight =
      state.quoteMode === 'subscription'
        ? `월 체감가 ${subSummary.finalMonthlyFee.toLocaleString()}원 (${subSummary.periodLabel})`
        : state.quoteMode === 'hybrid'
        ? `일시불 체감 ${genSummary.rawNet.toLocaleString()}원 + 구독 월 ${subSummary.finalMonthlyFee.toLocaleString()}원`
        : `최종 혜택 체감가 ${genSummary.rawNet.toLocaleString()}원 (총 혜택 -${genSummary.totalDiscountAndBenefit.toLocaleString()}원)`;

    return [
      `✨ [${profile.storeName}] ${honorific} 맞춤 비교 견적서`,
      `━━━━━━━━━━━━━━`,
      `📦 상담 품목: ${itemLine}`,
      `💡 핵심 혜택: ${priceHighlight}`,
      ``,
      `아래 전용 링크를 누르시면 스마트폰에서 [1안 vs 2안] 및 제휴카드·구좌별 체감가를 직접 눌러보며 비교하실 수 있습니다 👇`,
      generatedUrl,
      ``,
      `👤 담당: ${profile.name} (${profile.roleTitle})${
        profile.phone ? ` / 📞 ${profile.phone}` : ''
      }`,
      profile.greeting ? `💬 "${profile.greeting}"` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopy = async (mode: 'kakao' | 'url') => {
    if (!generatedUrl) return;
    const text = mode === 'kakao' ? buildKakaoShareMessage() : generatedUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(mode);
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      // ignore
    }
  };

  const handlePreviewCustomerScreen = () => {
    if (!generatedUrl) return;
    window.open(generatedUrl, '_blank', 'noopener,noreferrer');
  };

  const cardCls = isDark
    ? 'bg-[#151A25] text-slate-100 border-white/15'
    : 'bg-white text-[#18181B] border-[#E4DFD5]';
  const inputCls = isDark
    ? 'bg-[#1B2230] text-white border-white/15 placeholder:text-slate-500'
    : 'bg-[#FAF8F4] text-[#18181B] border-[#D6D0C4] placeholder:text-stone-400';

  return (
    <div
      className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden schedule-sheet-enter ${cardCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark ? 'bg-[#111622] border-white/10' : 'bg-[#FAF8F4] border-[#E4DFD5]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                카톡 인터랙티브 비교 견적 링크 공유
              </h3>
              <p className="text-[11px] opacity-70 font-medium">
                고객이 내 폰에서 직접 1안·2안과 카드/구좌 혜택을 눌러보며 비교합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80dvh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">
                고객님 성함 (선택)
              </label>
              <input
                type="text"
                value={custInput}
                onChange={(e) => setCustInput(e.target.value)}
                placeholder="예: 김민수"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">
                담당 컨설턴트 성함 (자동저장)
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="예: 강석원 점장"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">
                담당자 직통 연락처 (하단 전화·문자 버튼 연동)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={profile.phone}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="010-0000-0000"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">
                직책 / 지점 안내
              </label>
              <input
                type="text"
                value={profile.roleTitle}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, roleTitle: e.target.value }))
                }
                placeholder="수석 가전 컨설턴트"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputCls}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black mb-1">
              고객님께 띄울 한 줄 안심 인사말
            </label>
            <input
              type="text"
              value={profile.greeting}
              onChange={(e) =>
                setProfile((p) => ({ ...p, greeting: e.target.value }))
              }
              className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputCls}`}
            />
          </div>

          {/* 생성된 메시지 미리보기 */}
          <div
            className={`rounded-2xl border p-3.5 text-xs space-y-1.5 ${
              isDark
                ? 'bg-[#0B0E14] border-white/10 text-slate-300'
                : 'bg-[#F4F2ED] border-[#DFD9CE] text-stone-800'
            }`}
          >
            <div className="flex items-center justify-between font-black">
              <span>💬 카카오톡 전달 문구 미리보기</span>
              <span className="text-[10px] font-mono opacity-70">
                {isGenerating
                  ? '링크 압축 중...'
                  : `압축 URL (${generatedUrl.length}자)`}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-all font-sans text-[11px] leading-relaxed max-h-32 overflow-y-auto">
              {buildKakaoShareMessage()}
            </pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={!generatedUrl}
              onClick={() => handleCopy('kakao')}
              className="py-3 px-4 rounded-2xl bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer schedule-tactile"
            >
              {copiedType === 'kakao' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>카톡 안내문+링크 복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>카톡 안내문 + 링크 복사</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!generatedUrl}
              onClick={handlePreviewCustomerScreen}
              className={`py-3 px-4 rounded-2xl border text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer schedule-tactile ${
                isDark
                  ? 'bg-[#1B2230] hover:bg-[#242E42] text-sky-300 border-sky-400/30'
                  : 'bg-[#18181B] hover:bg-stone-800 text-white border-[#18181B]'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>고객 화면 새 탭 미리보기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. 고객 스마트폰 전용 고전환 인터랙티브 비교 견적 웹뷰 (#share=... 진입 시 작동)
// ============================================================================
export interface CustomerShareQuoteViewProps {
  payload: SharedQuotePayload;
  onExitCustomerView?: () => void;
}

export const CustomerShareQuoteView: React.FC<CustomerShareQuoteViewProps> = ({
  payload,
  onExitCustomerView,
}) => {
  // 고객이 직접 조건을 눌러보며 비교할 수 있는 로컬 시뮬레이션 상태 (언제든 원본 복원 가능)
  const [simState, setSimState] = useState<ProposalState>(() =>
    JSON.parse(JSON.stringify(payload.state))
  );
  const [showCompliance, setShowCompliance] = useState<boolean>(false);

  const isModifiedFromOriginal = useMemo(
    () => JSON.stringify(simState) !== JSON.stringify(payload.state),
    [simState, payload.state]
  );

  const handleResetToOriginal = () => {
    setSimState(JSON.parse(JSON.stringify(payload.state)));
  };

  const activePlan = simState.activeGeneralPlan || 1;
  const {
    plan1Summary,
    plan2Summary,
    plan1SubSummary,
    plan2SubSummary,
    hasPlan1Data,
    hasPlan2Data,
  } = getGeneralPlan1And2Summaries(simState);
  const hasBothPlans = hasPlan1Data && hasPlan2Data;

  const generalSummary = calculateGeneralPurchaseSummary(simState);
  const generalHiPreed = calculateGeneralHiPreedSummary(
    simState.generalHiPreedCounts
  );
  const subSummary = calculateSubscriptionSummary(simState);
  const hiPlusSummary = calculateHiPlusSummary(
    simState.hiPlusCounts,
    subSummary.representativePeriod
  );

  const showGeneral =
    simState.quoteMode === 'general' || simState.quoteMode === 'hybrid';
  const showSub =
    simState.quoteMode === 'subscription' || simState.quoteMode === 'hybrid';

  const handleAdjustHiPreed = (key: GeneralHiPreedKey, delta: number) => {
    setSimState((prev) => {
      const current = prev.generalHiPreedCounts[key] || 0;
      const nextVal = Math.max(0, Math.min(4, current + delta));
      return {
        ...prev,
        generalHiPreedCounts: {
          ...prev.generalHiPreedCounts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleAdjustHiPlus = (key: HiPlusKey, delta: number) => {
    setSimState((prev) => {
      const current = prev.hiPlusCounts[key] || 0;
      const nextVal = Math.max(0, Math.min(4, current + delta));
      return {
        ...prev,
        hiPlusCounts: {
          ...prev.hiPlusCounts,
          [key]: nextVal,
        },
      };
    });
  };

  const handleSelectSubCard = (cardId: AffiliateCardId) => {
    const card = AFFILIATE_CARDS.find((c) => c.id === cardId);
    const firstTier = card?.tiers?.[0]?.id || '';
    setSimState((prev) => ({
      ...prev,
      selectedCardId: cardId,
      selectedCardTierId: firstTier,
    }));
  };

  // 문자 상담 프리필 생성
  const cleanPhone = (payload.consultant.phone || '').replace(/[^0-9]/g, '');
  const smsBody = encodeURIComponent(
    `[${payload.consultant.storeName}] 안녕하세요 ${payload.consultant.name}님! 보내주신 맞춤 비교 견적서(${
      hasBothPlans ? `${activePlan}안` : '확인완료'
    }) 보고 연락드립니다.`
  );

  return (
    <div className="min-h-[100dvh] bg-[#F4F2ED] text-[#18181B] pb-28">
      {/* 상단 프리미엄 브랜드 바 */}
      <header className="sticky top-0 z-30 bg-[#18181B]/95 backdrop-blur-md text-white px-4 py-3 border-b border-white/10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{payload.consultant.storeName} 공식 맞춤 제안서</span>
            </div>
            <h1 className="text-sm sm:text-base font-black truncate mt-0.5">
              {payload.customerName
                ? `${payload.customerName} 고객님 전용 혜택 설계안`
                : 'VIP 고객님 전용 가전 혜택 설계안'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isModifiedFromOriginal && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer schedule-tactile"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>원래 제안 복귀</span>
              </button>
            )}
            {onExitCustomerView && (
              <button
                type="button"
                onClick={onExitCustomerView}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                관리앱으로
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3.5 sm:px-5 pt-4 space-y-4">
        {/* 담당 컨설턴트 안심 인사 카드 */}
        <div className="rounded-3xl bg-white border border-[#E4DFD5] p-4 shadow-2xs flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#8C5A32] text-white font-black text-base flex items-center justify-center shrink-0">
            {payload.consultant.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black">
                {payload.consultant.name}{' '}
                <span className="text-xs font-bold text-[#78716C]">
                  · {payload.consultant.roleTitle}
                </span>
              </span>
              <span className="text-[11px] font-mono text-[#78716C]">
                설계일 {payload.createdAt}
              </span>
            </div>
            <p className="text-xs text-[#57534E] font-medium mt-1 leading-relaxed">
              "{payload.consultant.greeting}"
            </p>
          </div>
        </div>

        {/* [킬러 기능 1] 1안 vs 2안 원터치 비교 스위치 (둘 다 있을 때 자동 노출) */}
        {hasBothPlans && (
          <div className="rounded-3xl bg-[#18181B] text-white p-3.5 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-amber-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                설계안 1안 ↔ 2안 실시간 비교
              </span>
              <span className="text-[11px] text-slate-300">
                탭을 눌러 두 플랜의 혜택을 비교해 보세요
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setSimState((prev) => switchGeneralPlanInState(prev, 1))
                }
                className={`p-3 rounded-2xl text-left border cursor-pointer schedule-tactile ${
                  activePlan === 1
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-black">견적 1안</div>
                <div className="text-sm sm:text-base font-black font-mono mt-0.5">
                  {simState.quoteMode === 'subscription'
                    ? `월 ${plan1SubSummary.finalMonthlyFee.toLocaleString()}원`
                    : `${plan1Summary.rawNet.toLocaleString()}원`}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSimState((prev) => switchGeneralPlanInState(prev, 2))
                }
                className={`p-3 rounded-2xl text-left border cursor-pointer schedule-tactile ${
                  activePlan === 2
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-black">견적 2안</div>
                <div className="text-sm sm:text-base font-black font-mono mt-0.5">
                  {simState.quoteMode === 'subscription'
                    ? `월 ${plan2SubSummary.finalMonthlyFee.toLocaleString()}원`
                    : `${plan2Summary.rawNet.toLocaleString()}원`}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ==================== A. 일반구매 패키지 & 인터랙티브 시뮬레이터 ==================== */}
        {showGeneral && (
          <section className="rounded-3xl bg-white border border-[#E4DFD5] overflow-hidden shadow-xs">
            {/* 상단 최종 체감가 히어로 스테이지 */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#292524] text-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black">
                  맞춤 구매 최대 혜택가
                </span>
                <span className="text-xs font-bold text-stone-300">
                  총 혜택{' '}
                  <strong className="text-emerald-400 font-mono">
                    -{generalSummary.totalDiscountAndBenefit.toLocaleString()}원
                  </strong>
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-xs text-stone-400 font-bold">
                    모든 할인·캐시백·지원금 반영 시 최종 체감가
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-300 mt-0.5">
                    <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-stone-400 font-bold">
                    행사가 합계 {generalSummary.sum.toLocaleString()}원
                  </div>
                  <div className="text-sm font-black text-white font-mono">
                    실결제가 <SpringNumberFlow value={generalSummary.payPrice} suffix="원" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* 구성 품목 리스트 */}
              <div className="space-y-2">
                <div className="text-xs font-black text-[#78716C] flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#8C5A32]" />
                  <span>선택하신 가전 구성 품목</span>
                </div>
                <div className="space-y-1.5">
                  {generalSummary.displayItems.map((it, idx) => {
                    const lineAmt =
                      (Number(it.unitPrice) || 0) *
                      Math.max(1, Number(it.quantity) || 1);
                    return (
                      <div
                        key={it.id || idx}
                        className="rounded-2xl bg-[#FAF8F4] border border-[#E4DFD5] px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-black truncate">
                            {it.category || `품목 ${idx + 1}`}{' '}
                            {it.quantity > 1 && (
                              <span className="text-[#8C5A32]">×{it.quantity}</span>
                            )}
                          </div>
                          {it.modelName && (
                            <div className="text-[11px] font-mono text-[#78716C]">
                              {it.modelName}
                            </div>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-black font-mono shrink-0">
                          {lineAmt.toLocaleString()}원
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 혜택 단계별 차감 요약 */}
              <div className="rounded-2xl bg-[#FAF8F4] border border-[#E4DFD5] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-[#78716C]">1단계 즉시할인·포인트 차감</span>
                  <span className="font-mono font-black text-blue-600">
                    -{generalSummary.totalStep1InstantDiscount.toLocaleString()}원
                  </span>
                </div>
                {generalSummary.hiFreedSupport > 0 && (
                  <div className="flex justify-between font-bold">
                    <span className="text-[#78716C]">
                      라이프케어 결합 즉시지원 ({generalHiPreed.comboLabel})
                    </span>
                    <span className="font-mono font-black text-rose-600">
                      -{generalSummary.hiFreedSupport.toLocaleString()}원
                    </span>
                  </div>
                )}
                {generalSummary.totalStep2Cashback > 0 && (
                  <div className="flex justify-between font-bold">
                    <span className="text-[#78716C]">
                      카드 금액대·익월 캐시백 ({simState.generalCardType})
                    </span>
                    <span className="font-mono font-black text-emerald-700">
                      -{generalSummary.totalStep2Cashback.toLocaleString()}원
                    </span>
                  </div>
                )}
                {generalSummary.totalStep2ExtraBenefit > 0 && (
                  <div className="flex justify-between font-bold">
                    <span className="text-[#78716C]">추가 사은·적립 포인트 혜택</span>
                    <span className="font-mono font-black text-amber-700">
                      -{generalSummary.totalStep2ExtraBenefit.toLocaleString()}원
                    </span>
                  </div>
                )}
              </div>

              {/* [One Live Thing] 고객 직접 체험용 카드 & 하이프리드 구좌 시뮬레이터 */}
              <div className="rounded-2xl border-2 border-[#D8C3A8] bg-[#FAF5EC] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#6E4423] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    직접 눌러보는 결제카드 · 결합 지원금 시뮬레이터
                  </span>
                  <span className="text-[10px] font-bold text-[#8C5A32]">
                    실시간 계산
                  </span>
                </div>

                {/* 카드 종류 토글 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {GENERAL_CARD_OPTIONS.map((cardOpt: GeneralCardType) => {
                    const active = simState.generalCardType === cardOpt;
                    return (
                      <button
                        key={cardOpt}
                        type="button"
                        onClick={() =>
                          setSimState((prev) => ({
                            ...prev,
                            generalCardType: cardOpt,
                          }))
                        }
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-black border cursor-pointer schedule-tactile ${
                          active
                            ? 'bg-[#18181B] text-white border-[#18181B]'
                            : 'bg-white text-[#57534E] border-[#DFD6C7]'
                        }`}
                      >
                        {cardOpt}
                      </button>
                    );
                  })}
                </div>

                {/* 하이프리드 플랜 구좌 조절기 */}
                <div className="grid grid-cols-2 gap-2">
                  {GENERAL_HIPREED_PLANS.map((plan) => {
                    const cnt = simState.generalHiPreedCounts[plan.id] || 0;
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-xl border p-2.5 flex items-center justify-between ${
                          cnt > 0
                            ? 'bg-white border-[#8C5A32] shadow-2xs'
                            : 'bg-white/70 border-[#E4DFD5]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-black">{plan.name}</div>
                          <div className="text-[10px] font-bold text-rose-600 font-mono">
                            -{(plan.supportAmount / 10000).toLocaleString()}만원 지원
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustHiPreed(plan.id, -1)}
                            className="w-6 h-6 rounded-lg bg-[#F4F2ED] font-black text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-black font-mono w-4 text-center">
                            {cnt}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustHiPreed(plan.id, 1)}
                            className="w-6 h-6 rounded-lg bg-[#18181B] text-white font-black text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {generalHiPreed.totalAccounts > 0 && (
                  <p className="text-[11px] font-bold text-[#6E4423] leading-relaxed">
                    ✓ 만기(150회) 시 납입 원금{' '}
                    <strong>
                      {generalHiPreed.totalMaturityRefund.toLocaleString()}원 100% 전액 환급
                    </strong>{' '}
                    (월 납입금 {generalHiPreed.totalMonthlyDeposit.toLocaleString()}원 적립형)
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ==================== B. 가전 구독 패키지 & 인터랙티브 카드/구좌 시뮬레이터 ==================== */}
        {showSub && (
          <section className="rounded-3xl bg-white border border-[#E4DFD5] overflow-hidden shadow-xs">
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/30 text-xs font-black">
                  가전 구독 ({subSummary.periodLabel}) 케어 설계안
                </span>
                <span className="text-xs font-bold text-slate-300">
                  무상 A/S · 정기 케어 포함
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-xs text-slate-400 font-bold">
                    제휴카드·결합 혜택 적용 월 체감 구독료
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-sky-300 mt-0.5">
                    월 <SpringNumberFlow value={subSummary.finalMonthlyFee} suffix="원" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-bold">
                    기본 월 구독료 {subSummary.totalBaseMonthly.toLocaleString()}원
                  </div>
                  <div className="text-xs font-black text-emerald-400 font-mono">
                    매월 -{(subSummary.cardDiscount + subSummary.hiPlusMonthly).toLocaleString()}원 절감
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* 구독 품목 */}
              <div className="space-y-1.5">
                {subSummary.displayItems.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="rounded-2xl bg-[#FAF8F4] border border-[#E4DFD5] px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-black">
                        {it.category || `구독 가전 ${idx + 1}`}{' '}
                        <span className="text-[11px] font-bold text-sky-700">
                          ({it.period || subSummary.representativePeriod}개월)
                        </span>
                      </div>
                      <div className="text-[11px] text-[#78716C] font-medium">
                        {it.modelName ? `${it.modelName} · ` : ''}
                        {it.careService}
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-black font-mono shrink-0">
                      월 {(Number(it.monthlyFee) || 0).toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>

              {/* 구독 제휴카드 & 실적 구간 시뮬레이터 */}
              <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-3.5 space-y-3">
                <div className="text-xs font-black text-sky-950">
                  💳 제휴카드 및 전월 실적 구간 직접 변경해 보기
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {AFFILIATE_CARDS.map((card) => {
                    const active = simState.selectedCardId === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectSubCard(card.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                          active
                            ? 'bg-sky-600 text-white border-sky-700'
                            : 'bg-white text-slate-700 border-sky-200'
                        }`}
                      >
                        {card.shortName}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setSimState((prev) => ({
                        ...prev,
                        selectedCardId: 'none',
                        selectedCardTierId: '',
                      }))
                    }
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer ${
                      simState.selectedCardId === 'none'
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    카드 미적용
                  </button>
                </div>

                {subSummary.currentCard && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {subSummary.currentCard.tiers.map((tier) => {
                      const active = simState.selectedCardTierId === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() =>
                            setSimState((prev) => ({
                              ...prev,
                              selectedCardTierId: tier.id,
                            }))
                          }
                          className={`p-2 rounded-xl border text-center cursor-pointer schedule-tactile ${
                            active
                              ? 'bg-white border-2 border-sky-600 shadow-2xs'
                              : 'bg-white/70 border-sky-200'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-slate-500">
                            {tier.minSpendShort} 이상
                          </div>
                          <div className="text-xs font-black text-sky-700 font-mono">
                            -{(tier.monthlyDiscount / 10000).toFixed(1)}만/월
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Hi구독 플러스 구좌 시뮬레이터 */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {HI_PLUS_PLANS.map((plan) => {
                    const cnt = simState.hiPlusCounts[plan.id] || 0;
                    const unitSupport =
                      subSummary.representativePeriod === 36
                        ? plan.monthlySupport36
                        : plan.monthlySupport60;
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-xl border p-2 flex flex-col justify-between gap-1.5 ${
                          cnt > 0
                            ? 'bg-white border-rose-500 shadow-2xs'
                            : 'bg-white/70 border-sky-200'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-black">{plan.buttonLabel}</div>
                          <div className="text-[10px] font-bold text-rose-600 font-mono">
                            월 -{(unitSupport / 1000).toLocaleString()}천원
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleAdjustHiPlus(plan.id, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 font-black text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-black font-mono">{cnt}</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustHiPlus(plan.id, 1)}
                            className="w-6 h-6 rounded-lg bg-slate-900 text-white font-black text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hiPlusSummary.totalAccounts > 0 && (
                  <p className="text-[11px] font-bold text-sky-900 leading-relaxed">
                    ✓ Hi구독 플러스 만기(120회) 시 납입 원금{' '}
                    <strong>
                      {hiPlusSummary.totalMaturityRefund.toLocaleString()}원 100% 환급
                    </strong>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 결합상품 필수 안내 아코디언 (공정위/소비자 안내 준수) */}
        <div className="rounded-2xl bg-white border border-[#E4DFD5] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCompliance((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-black text-[#57534E] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#8C5A32]" />
              제휴카드 · 라이프케어 결합상품 유의사항 안내
            </span>
            {showCompliance ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showCompliance && (
            <div className="px-4 pb-4 text-[11px] text-[#78716C] space-y-1.5 leading-relaxed border-t border-[#F4F2ED] pt-3">
              <p>
                • 본 제안서의 금액대별 캐시백 및 제휴카드 청구할인/캐시백은 카드사 전월 실적 조건 충족 및 당월 행사 기준이며, 발급월·결제일에 따라 일부 변동될 수 있습니다.
              </p>
              <p>
                • 하이프리드 및 Hi구독 플러스 결합상품은 웅진프리드라이프 상조/라이프케어 별도 계약 상품으로, 만기 완납 및 계약 유지 시 약정 원금 100% 환급이 적용되며 중도 해약 시 해약환급금 산정 기준에 따라 지원금 반환 또는 차감이 발생할 수 있습니다.
              </p>
              <p>
                • 정확한 재고, 배송 희망일 배정, 사은품 혜택 확정은 아래 담당 컨설턴트에게 문의해 주시면 신속히 안내해 드립니다.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ==================== 하단 엄지 영역 고정 컨버전 독 (Smart Thumb-Zone Dock) ==================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#D6D0C4] px-3.5 py-2.5 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-[#78716C] truncate">
              {payload.consultant.storeName} · {payload.consultant.name}
            </div>
            <div className="text-sm font-black text-[#18181B] font-mono truncate">
              {simState.quoteMode === 'subscription' ? (
                <>
                  월 <SpringNumberFlow value={subSummary.finalMonthlyFee} suffix="원" />
                </>
              ) : (
                <SpringNumberFlow value={generalSummary.rawNet} suffix="원" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://map.naver.com/p/search/%EB%A1%AF%EB%8D%B0%ED%95%98%EC%9D%B4%EB%A7%88%ED%8A%B8%20%EA%B2%BD%EA%B8%B0%EA%B4%91%EC%A3%BC%EC%A0%90"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-2xl bg-[#F4F2ED] hover:bg-[#EAE5DC] text-[#18181B] border border-[#D6D0C4]"
              title="매장 위치 지도 보기"
            >
              <MapPin className="w-4 h-4 text-[#8C5A32]" />
            </a>

            {cleanPhone && (
              <a
                href={`sms:${cleanPhone}?body=${smsBody}`}
                className="px-3.5 py-2.5 rounded-2xl bg-[#F4ECE1] hover:bg-[#EAE0D0] text-[#6E4423] border border-[#D8C3A8] text-xs font-black inline-flex items-center gap-1.5 schedule-tactile"
              >
                <MessageSquare className="w-4 h-4" />
                <span>문자 문의</span>
              </a>
            )}

            {cleanPhone ? (
              <a
                href={`tel:${cleanPhone}`}
                className="px-4 py-2.5 rounded-2xl bg-[#18181B] hover:bg-stone-800 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-md schedule-tactile"
              >
                <Phone className="w-4 h-4 text-amber-400" />
                <span>담당자 바로 통화</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                  } catch {
                    // ignore
                  }
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#18181B] text-white text-xs font-black inline-flex items-center gap-1.5"
              >
                <Gift className="w-4 h-4 text-amber-400" />
                <span>이 혜택 조건 보관하기</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
