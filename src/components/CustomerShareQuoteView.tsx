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
  createShortenedQuoteLinks,
  decodeSharedQuoteFromHash,
  EncodedQuoteLinks,
  getEffectiveStaffPin,
  loadCachedCustomerQuotePayload,
  loadConsultantProfile,
  loadCustomViewerBaseUrl,
  saveConsultantProfile,
  saveCustomStaffPin,
  saveCustomViewerBaseUrl,
  syncViewerBaseUrlFromServer,
  SharedQuotePayload,
  unlockStaffDeviceWithPin,
} from '../utils/shareQuoteCodec';
import { SpringNumberFlow } from './SpringNumberFlow';
import { maskModelCodeAfter3, maskProposalStateModels } from '../utils/modelMasker';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  ExternalLink,
  Gift,
  Layers,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  ShoppingBag,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';

// ============================================================================
// 1. 상담사용 [카톡 인터랙티브 견적 링크 생성 & 전달 메시지 복사] 모달
// ============================================================================
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
      setSavedNotice('미니 뷰어 주소가 저장되었습니다. 이제 모든 링크가 미니 뷰어로 자동 생성됩니다!');
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
      className={`rounded-2xl border px-3.5 py-2.5 text-xs transition ${
        isSeparated
          ? isDark
            ? 'bg-emerald-950/30 border-emerald-500/35 text-slate-100'
            : 'bg-emerald-50/80 border-emerald-300 text-stone-900'
          : isDark
          ? 'bg-amber-950/30 border-amber-400/40 text-amber-100'
          : 'bg-amber-50/90 border-amber-300 text-stone-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 font-extrabold min-w-0 ${
            isSeparated
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {isSeparated
              ? `미니 뷰어 분리 발송 중 (내 앱 주소 노출 0%)`
              : `고객 전용 미니 뷰어 주소를 연결해 주세요 (최초 1회)`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-black underline opacity-85 hover:opacity-100 shrink-0 cursor-pointer"
        >
          {expanded ? '접기' : isSeparated ? '주소 변경' : '주소 입력'}
        </button>
      </div>

      {isSeparated && !expanded && (
        <div className="mt-1 text-[10.5px] font-mono opacity-75 truncate">
          연결된 뷰어: {savedUrl}
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-current/15 space-y-2.5">
          <p className="text-[11px] opacity-85 leading-relaxed font-medium">
            • 별도 배포하신 <strong>고객 전용 미니 웹앱 주소</strong>를 아래에 한 번만 저장해 두시면, 앞으로 복사·발송하는 모든 문자/카톡 단축 링크가 자동으로 미니 뷰어 주소로만 연결되어 <strong>본래 통합관리앱 주소는 절대 노출되지 않습니다.</strong>
          </p>

          <div className="space-y-1">
            <label className="block text-[11px] font-black">
              고객 전용 미니 뷰어 웹앱 주소 (최초 1회 저장 시 영구 유지)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={viewerUrl}
                onChange={(e) => setViewerUrl(e.target.value)}
                placeholder="예: https://아이디.github.io/quote-view"
                className={`flex-1 px-2.5 py-2 rounded-xl border text-xs font-mono ${
                  isDark
                    ? 'bg-[#1B2230] border-white/20 text-white'
                    : 'bg-white border-stone-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveDomain}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shrink-0 cursor-pointer"
              >
                저장
              </button>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPinConfig((v) => !v)}
              className="text-[10.5px] font-bold opacity-75 hover:opacity-100 underline cursor-pointer"
            >
              {showPinConfig ? '기기 인증 코드 설정 닫기' : '새 기기 스텔스 등록 코드 변경'}
            </button>
          </div>

          {showPinConfig && (
            <div className="space-y-1 pt-1">
              <label className="block text-[11px] font-black">
                새 기기 스텔스 인증 코드 (방패 아이콘 5회 터치 시 입력 · 현재: {getEffectiveStaffPin()})
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="변경할 숫자 4~8자리 입력"
                  className={`flex-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono ${
                    isDark
                      ? 'bg-[#1B2230] border-white/15 text-white'
                      : 'bg-white border-emerald-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black shrink-0 cursor-pointer"
                >
                  변경
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {savedNotice && (
        <div className="mt-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-300">
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
  customerName?: string;
  customerPhone?: string;
  initialMaskModels?: boolean;
  isDark?: boolean;
}

export const ShareQuoteLinkModal: React.FC<ShareQuoteLinkModalProps> = ({
  isOpen,
  onClose,
  state,
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

  const sampleRawModel = useMemo(() => {
    const genMod = (state.generalItems || [])
      .map((it) => (it.modelName || '').trim())
      .find(Boolean);
    if (genMod) return genMod;
    const subMod = (state.items || [])
      .map((it) => (it.modelName || '').trim())
      .find(Boolean);
    return subMod || 'RF85DB9581APW';
  }, [state]);

  const effectiveShareState = useMemo(
    () => (maskSharedModels ? maskProposalStateModels(state) : state),
    [maskSharedModels, state]
  );

  useEffect(() => {
    if (!isOpen) return;
    setProfile(loadConsultantProfile());
    setCustInput(customerName || '');
    setCustPhoneInput(customerPhone || '');
    setMaskSharedModels(Boolean(initialMaskModels));
    setCopiedType(null);
  }, [isOpen, customerName, customerPhone, initialMaskModels]);

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

    return () => {
      cancelled = true;
    };
  }, [isOpen, profile, custInput, effectiveShareState]);

  if (!isOpen) return null;

  const activeUrl = linkBundle?.shortUrl || '';
  const genSummary = calculateGeneralPurchaseSummary(effectiveShareState);
  const subSummary = calculateSubscriptionSummary(effectiveShareState);

  const honorific = custInput.trim() ? `${custInput.trim()} 고객님` : '고객님';
  const itemLine =
    effectiveShareState.quoteMode === 'subscription'
      ? subSummary.validSubNames.join(', ') || '맞춤 가전 구독 패키지'
      : effectiveShareState.generalItems
          .map((it) => `${it.category}${it.modelName ? `(${it.modelName})` : ''}`)
          .filter(Boolean)
          .join(', ') || '맞춤 가전 패키지';

  const priceHighlight =
    effectiveShareState.quoteMode === 'subscription'
      ? `월 체감가 ${subSummary.finalMonthlyFee.toLocaleString()}원 (${
          subSummary.periodLabel
        }${
          subSummary.totalSubCashback > 0
            ? ` · 캐시백 ${subSummary.totalSubCashback.toLocaleString()}원`
            : ''
        })`
      : effectiveShareState.quoteMode === 'hybrid'
      ? `일시불 체감 ${genSummary.rawNet.toLocaleString()}원 + 구독 월 ${subSummary.finalMonthlyFee.toLocaleString()}원`
      : `최종 혜택 체감가 ${genSummary.rawNet.toLocaleString()}원`;

  // [문자(SMS/LMS) 전용 포맷]:
  // 1) 특수 괘선(━━━) 및 과도한 이모지를 제거해 LMS 바이트 초과 잘림 방지
  // 2) 링크 위·아래 빈 줄 확보 및 링크 줄에 어떠한 부호도 붙이지 않아 갤럭시·아이폰 문자앱 파란색 자동링크 100% 보장
  const buildSmsShareMessage = () => {
    const shortItem =
      itemLine.length > 42 ? `${itemLine.slice(0, 40)}...` : itemLine;
    return [
      `[${profile.storeName}] ${honorific} 맞춤 견적서 안내`,
      `품목: ${shortItem}`,
      `혜택: ${priceHighlight}`,
      ``,
      `아래 링크를 누르시면 스마트폰에서 1안·2안 및 카드별 체감가를 직접 비교하실 수 있습니다.`,
      ``,
      activeUrl,
      ``,
      `담당: ${profile.name}${profile.phone ? ` (${profile.phone})` : ''}`,
    ]
      .join('\n')
      .trim();
  };

  // [카카오톡 전용 포맷]
  const buildKakaoShareMessage = () => {
    return [
      `✨ [${profile.storeName}] ${honorific} 맞춤 비교 견적서`,
      `━━━━━━━━━━━━━━`,
      `📦 상담 품목: ${itemLine}`,
      `💡 핵심 혜택: ${priceHighlight}`,
      ``,
      `아래 전용 링크를 누르시면 스마트폰에서 [1안 vs 2안] 및 제휴카드·구좌별 체감가를 직접 눌러보며 비교하실 수 있습니다 👇`,
      ``,
      activeUrl,
      ``,
      `👤 담당: ${profile.name} (${profile.roleTitle})${
        profile.phone ? ` / 📞 ${profile.phone}` : ''
      }`,
      profile.greeting ? `💬 "${profile.greeting}"` : '',
    ]
      .filter((line) => line !== undefined)
      .join('\n');
  };

  const previewText =
    channelTab === 'sms' ? buildSmsShareMessage() : buildKakaoShareMessage();

  const handleCopy = async (mode: 'sms' | 'kakao' | 'url') => {
    if (!activeUrl) return;
    const text =
      mode === 'sms'
        ? buildSmsShareMessage()
        : mode === 'kakao'
        ? buildKakaoShareMessage()
        : activeUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(mode);
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      // ignore
    }
  };

  // 안드로이드(갤럭시) / 아이폰 기본 문자(SMS) 앱 즉시 실행 (수신번호 + 단축링크 본문 자동 채움)
  const handleOpenNativeSmsApp = () => {
    if (!activeUrl) return;
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
    if (!activeUrl) return;
    const target = linkBundle?.compactUrl || activeUrl;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const modeBadgeLabel =
    linkBundle?.mode === 'server'
      ? `초단축 링크 완료 (${activeUrl.length}자)`
      : linkBundle?.mode === 'external'
      ? `초단축 URL 완료 (${activeUrl.length}자)`
      : `V2 경량 링크 완료 (${activeUrl.length}자 · 점 제거)`;

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
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? 'bg-[#111622] border-white/10' : 'bg-[#FAF8F4] border-[#E4DFD5]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                문자(SMS) · 카톡 비교 견적 단축링크 발송
              </h3>
              <p className="text-[11px] opacity-70 font-medium">
                문자에서도 파란색 클릭 링크가 끊기지 않도록 주소를 초단축하여 전송합니다
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

        <div className="p-5 space-y-3.5 max-h-[82dvh] overflow-y-auto">
          {/* [핵심] 발송 견적서 버전 선택: 일반 버전 vs 앞 3글자 외 가림 버전 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-violet-500" />
                <span>발송할 견적서 버전 선택</span>
              </span>
              <span className="text-[10.5px] font-bold opacity-75">
                선택 즉시 전용 단축링크 자동 전환
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMaskSharedModels(false);
                  setCopiedType(null);
                }}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer schedule-tactile ${
                  !maskSharedModels
                    ? isDark
                      ? 'bg-emerald-950/50 border-emerald-400 text-white shadow-sm'
                      : 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-sm'
                    : isDark
                    ? 'bg-[#1B2230] border-white/10 text-slate-300 opacity-75 hover:opacity-100'
                    : 'bg-[#FAF8F4] border-[#E4DFD5] text-stone-600 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    <span>일반 버전</span>
                  </span>
                  {!maskSharedModels && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                      선택됨
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] font-bold opacity-80 mt-1">
                  모델명 전체 그대로 표시
                </div>
                <div className="mt-1.5 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-black/25 font-mono text-[10px] font-bold truncate">
                  예: {sampleRawModel}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMaskSharedModels(true);
                  setCopiedType(null);
                }}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer schedule-tactile ${
                  maskSharedModels
                    ? isDark
                      ? 'bg-violet-950/60 border-violet-400 text-white shadow-sm'
                      : 'bg-violet-50 border-violet-600 text-violet-950 shadow-sm'
                    : isDark
                    ? 'bg-[#1B2230] border-white/10 text-slate-300 opacity-75 hover:opacity-100'
                    : 'bg-[#FAF8F4] border-[#E4DFD5] text-stone-600 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                    <span>모델명 가림 버전</span>
                  </span>
                  {maskSharedModels ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[9px] font-black">
                      선택됨
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[9px] font-black">
                      비교방지
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] font-bold opacity-80 mt-1">
                  앞 3글자만 표시 · 뒤쪽 가림
                </div>
                <div className="mt-1.5 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-black/25 font-mono text-[10px] font-bold truncate">
                  예: {maskModelCodeAfter3(sampleRawModel)}
                </div>
              </button>
            </div>
          </div>

          {/* 발송 채널 선택 탭: 문자(SMS) 기본 선택 */}
          <div
            className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border ${
              isDark
                ? 'bg-[#0B0E14] border-white/10'
                : 'bg-[#F4F2ED] border-[#E4DFD5]'
            }`}
          >
            <button
              type="button"
              onClick={() => setChannelTab('sms')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                channelTab === 'sms'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📩 문자(SMS) 발송용 (권장)</span>
            </button>
            <button
              type="button"
              onClick={() => setChannelTab('kakao')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                channelTab === 'kakao'
                  ? 'bg-[#FEE500] text-[#191919] shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>💬 카카오톡 발송용</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                고객 휴대폰 번호 (문자앱 바로열기용)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={custPhoneInput}
                onChange={(e) => setCustPhoneInput(e.target.value)}
                placeholder="010-0000-0000 (비워도 발송 가능)"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono ${inputCls}`}
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
                placeholder="예: 국지현"
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">
                담당자 직통 연락처 (하단 통화·문자 연동)
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
          </div>

          {/* 깃허브 주소 뒤쪽 삭제 방어 & 별도 고객 도메인 보안 설정 */}
          <SecurityDomainConfigBox
            isDark={isDark}
            onDomainChanged={() => {
              // trigger link regeneration via profile shallow clone
              setProfile((p) => ({ ...p }));
            }}
          />

          {/* 생성된 단축 URL 단독 복사 바 (일반 버전 vs 모델가림 버전 명확히 구분 표시) */}
          <div
            className={`rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 ${
              maskSharedModels
                ? isDark
                  ? 'bg-violet-950/40 border-violet-400/35 text-violet-100'
                  : 'bg-violet-50/95 border-violet-300 text-violet-950'
                : isDark
                ? 'bg-emerald-950/35 border-emerald-500/30 text-emerald-200'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div
                className={`text-[10px] font-black ${
                  maskSharedModels
                    ? 'text-violet-700 dark:text-violet-300'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isGenerating
                  ? '전용 단축 주소 생성 중...'
                  : maskSharedModels
                  ? `🔒 [앞 3글자 외 가림 버전] ${modeBadgeLabel}`
                  : `📄 [일반 전체 모델명 버전] ${modeBadgeLabel}`}
              </div>
              <div className="text-xs font-mono font-bold truncate">
                {activeUrl || '링크 생성 중...'}
              </div>
            </div>
            <button
              type="button"
              disabled={!activeUrl}
              onClick={() => handleCopy('url')}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${
                maskSharedModels
                  ? 'bg-violet-600 hover:bg-violet-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
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
                  <span>주소만 복사</span>
                </>
              )}
            </button>
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
              <span>
                {channelTab === 'sms'
                  ? '📩 문자(SMS) 전달 문구 (링크 줄바꿈 보호 적용)'
                  : '💬 카카오톡 전달 문구 미리보기'}
              </span>
              <span className="text-[10px] font-mono opacity-75">
                총 {previewText.length}자
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-all font-sans text-[11px] leading-relaxed max-h-28 overflow-y-auto">
              {previewText}
            </pre>
          </div>

          {channelTab === 'sms' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={!activeUrl}
                onClick={handleOpenNativeSmsApp}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer schedule-tactile"
              >
                <Send className="w-4 h-4" />
                <span>📲 휴대폰 문자앱 바로 열기</span>
              </button>

              <button
                type="button"
                disabled={!activeUrl}
                onClick={() => handleCopy('sms')}
                className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer schedule-tactile"
              >
                {copiedType === 'sms' ? (
                  <>
                    <Check className="w-4 h-4 text-amber-300" />
                    <span>문자 안내문+링크 복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>📩 문자 안내문 + 링크 복사</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={!activeUrl}
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
                    <span>💬 카톡 안내문 + 링크 복사</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!activeUrl}
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
          )}

          {channelTab === 'sms' && (
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] opacity-70 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                고객 보안 격리 적용 (직원 앱 진입 차단)
              </span>
              <button
                type="button"
                disabled={!activeUrl}
                onClick={handlePreviewCustomerScreen}
                className="text-[11px] font-black text-indigo-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>고객 화면 미리보기</span>
              </button>
            </div>
          )}
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
}

export const CustomerShareQuoteView: React.FC<CustomerShareQuoteViewProps> = ({
  payload,
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
      subAutoTierCashback: true,
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
            {isModifiedFromOriginal ? (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer schedule-tactile"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>원래 제안 복귀</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-amber-300 text-[11px] font-extrabold border border-white/10">
                <UserCheck className="w-3 h-3" />
                <span>고객 전용 안심뷰</span>
              </span>
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
                    매월 -
                    {(
                      subSummary.cardDiscount +
                      subSummary.hiPlusMonthly +
                      subSummary.monthlyCashbackEquiv
                    ).toLocaleString()}
                    원 체감 절감
                  </div>
                  {subSummary.totalSubCashback > 0 && (
                    <div className="text-[10.5px] font-extrabold text-amber-300 mt-0.5">
                      일시 캐시백 총 {subSummary.totalSubCashback.toLocaleString()}원 포함
                    </div>
                  )}
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
                        subAutoTierCashback: true,
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

                {subSummary.totalSubCashback > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-2 text-[11px] font-bold text-emerald-900 space-y-0.5">
                    <div>
                      🎁 일시 지급 캐시백 총{' '}
                      <strong>-{subSummary.totalSubCashback.toLocaleString()}원</strong> 적용됨
                      (월 환산 -{subSummary.monthlyCashbackEquiv.toLocaleString()}원 체감)
                    </div>
                    <div className="text-[10.5px] text-emerald-700">
                      {subSummary.subTierCashback > 0 &&
                        `${subSummary.currentCard?.shortName || ''} 300만↑ 금액대별 캐시백 -${subSummary.subTierCashback.toLocaleString()}원`}
                      {subSummary.subTierCashback > 0 &&
                        subSummary.subExtraCashback > 0 &&
                        ' · '}
                      {subSummary.subExtraCashback > 0 &&
                        `추가 캐시백 -${subSummary.subExtraCashback.toLocaleString()}원`}
                    </div>
                  </div>
                )}

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


// ============================================================================
// 3. 고객 전용 독립 보안 루트 (직원용 App.tsx 마운트 자체를 원천 차단하는 샌드박스 엔트리)
// ============================================================================
export const CustomerShareStandaloneRoot: React.FC = () => {
  const [payload, setPayload] = useState<SharedQuotePayload | null>(() =>
    loadCachedCustomerQuotePayload()
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');

  useEffect(() => {
    let active = true;

    const loadFromUrl = async () => {
      const decoded = await decodeSharedQuoteFromHash();
      if (!active) return;
      if (decoded) {
        setPayload(decoded);
        setStatus('ready');
      } else {
        setStatus('invalid');
      }
    };

    loadFromUrl();

    const handleUrlChange = () => {
      loadFromUrl();
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      active = false;
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  if (status === 'loading' && !payload) {
    return (
      <div className="min-h-[100dvh] bg-[#F4F2ED] text-[#18181B] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#18181B] text-amber-300 flex items-center justify-center mb-3 shadow-md">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-base font-black">맞춤 비교 견적서를 불러오는 중입니다...</div>
        <p className="text-xs text-[#78716C] font-semibold mt-1">
          롯데하이마트 경기광주점 고객 전용 보안 뷰어
        </p>
      </div>
    );
  }

  if (!payload || status === 'invalid') {
    return (
      <PublicZeroTrustGateRoot
        onStaffVerified={() => {
          window.location.href = `${window.location.origin}${window.location.pathname}`;
        }}
      />
    );
  }

  return <CustomerShareQuoteView payload={payload} />;
};


// ============================================================================
// 4. 스텔스 Zero-Trust 기본 주소 완전 봉쇄 게이트
//    외부인에게는 직원용 앱의 존재나 인증 버튼조차 일절 보이지 않으며,
//    오직 담당자가 상단 방패 아이콘을 5회 연속 터치하거나 ?staff=1 파라미터로 진입했을 때만
//    기기 등록 창이 열립니다.
// ============================================================================
export const PublicZeroTrustGateRoot: React.FC<{
  onStaffVerified: () => void;
}> = ({ onStaffVerified }) => {
  const [showPinBox, setShowPinBox] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('staff') === '1' || p.get('admin') === '1';
    } catch {
      return false;
    }
  });
  const [tapCount, setTapCount] = useState(0);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleSecretShieldTap = () => {
    setTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowPinBox(true);
        return 0;
      }
      return next;
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockStaffDeviceWithPin(pinValue)) {
      setPinError(false);
      onStaffVerified();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F2ED] text-[#18181B] flex flex-col items-center justify-center p-5 select-none">
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#E4DFD5] p-6 text-center shadow-sm space-y-4">
        <div
          onClick={handleSecretShieldTap}
          className="w-12 h-12 mx-auto rounded-2xl bg-[#18181B] text-amber-300 flex items-center justify-center shadow-xs"
        >
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-extrabold text-[#8C5A32]">
            롯데하이마트 경기광주점
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight">
            전용 견적 링크로만 열람 가능합니다
          </h1>
          <p className="text-xs text-[#57534E] leading-relaxed font-medium">
            문자(SMS) 또는 카카오톡으로 전달받으신 <strong>전체 맞춤 견적 링크</strong>를 눌러 접속해 주세요.
            <br />
            (기본 주소로는 열람할 수 없는 페이지입니다.)
          </p>
        </div>

        <a
          href="https://map.naver.com/p/search/%EB%A1%AF%EB%8D%B0%ED%95%98%EC%9D%B4%EB%A7%88%ED%8A%B8%20%EA%B2%BD%EA%B8%B0%EA%B4%91%EC%A3%BC%EC%A0%90"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-2xl bg-[#18181B] hover:bg-stone-800 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition"
        >
          <MapPin className="w-4 h-4 text-amber-300" />
          <span>롯데하이마트 경기광주점 위치 안내</span>
        </a>

        {showPinBox && (
          <div className="pt-3 border-t border-[#F4F2ED]">
            <form onSubmit={handleVerify} className="space-y-2 text-left">
              <label className="block text-[11px] font-black text-stone-700">
                담당자 기기 등록 코드 입력 (최초 1회 인증 시 영구 유지)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinValue}
                  onChange={(e) => {
                    setPinValue(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="보안 코드 입력"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#D6D0C4] bg-[#FAF8F4] text-sm font-mono font-bold focus:outline-none focus:border-[#18181B]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shrink-0 cursor-pointer"
                >
                  인증
                </button>
              </div>
              {pinError && (
                <p className="text-[11px] font-bold text-rose-600">
                  보안 코드가 일치하지 않습니다.
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
