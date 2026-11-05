import React, { useEffect, useMemo, useState } from 'react';
import { calculateGeneralPurchaseSummary, calculateSubscriptionSummary, ProposalState } from '../types/proposal';
import { ConsultantProfile, createShortenedQuoteLinks, EncodedQuoteLinks, getEffectiveStaffPin, loadConsultantProfile, loadCustomViewerBaseUrl, normalizeConsultantRoleTitle, saveConsultantProfile, saveCustomStaffPin, saveCustomViewerBaseUrl, syncViewerBaseUrlFromServer, SharedQuotePayload } from '../utils/shareQuoteCodec';
import { maskModelCodeAfter3, maskProposalStateModels } from '../utils/modelMasker';
import { Check, Copy, Eye, EyeOff, ExternalLink, Link2, Lock, MessageSquare, Send, Share2, ShieldCheck, Smartphone, X } from 'lucide-react';

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
      ? `월 체감 ${subSummary.finalMonthlyFee.toLocaleString()}원 (최종 ${
          subSummary.periodLabel
        } 체감가 ${subSummary.finalTotalFee.toLocaleString()}원${
          subSummary.totalSubCashback > 0
            ? ` · 1회 캐시백 -${subSummary.totalSubCashback.toLocaleString()}원 반영`
            : ''
        })`
      : effectiveShareState.quoteMode === 'hybrid'
      ? `일시불 체감 ${genSummary.rawNet.toLocaleString()}원 + 구독 월 ${subSummary.finalMonthlyFee.toLocaleString()}원 (통합 최종 체감가 ${(
          genSummary.rawNet + subSummary.finalTotalFee
        ).toLocaleString()}원)`
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
      `아래 링크를 누르시면 스마트폰에서 1안·2안 및 제휴카드·라이프케어 체감가를 직접 비교하실 수 있습니다.`,
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
      `👤 담당: ${profile.name} (${normalizeConsultantRoleTitle(profile.roleTitle)})${
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
