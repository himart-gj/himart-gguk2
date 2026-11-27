import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Lock,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CloudPartnerManualCallout,
  CloudPartnerManualDoc,
  fetchPartnerManualsMap,
  readSessionCachedPartnerManuals,
} from '../utils/partnerManualSync';

export const OPEN_PARTNER_MANUAL_MODAL_EVENT = 'himart:open-partner-manual-modal';

export interface OpenPartnerManualDetail {
  manualId?: string;
  chapterId?: string;
}

export function openPartnerManualModal(detail?: OpenPartnerManualDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenPartnerManualDetail>(OPEN_PARTNER_MANUAL_MODAL_EVENT, {
      detail: detail || {},
    })
  );
}

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getChoseongText(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 0xac00;
    if (code >= 0 && code < 11172) {
      out += CHOSEONG[Math.floor(code / 588)];
    } else {
      out += str[i];
    }
  }
  return out;
}

function matchesManualQuery(target: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  return getChoseongText(t).includes(q);
}

function isUrlValue(val: string): boolean {
  return /^https?:\/\//i.test(val.trim());
}

function extractCopyableToken(cell: string): string | null {
  const trimmed = cell.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;
  if (/^\d{2,4}-\d{3,4}-\d{4}$/.test(trimmed) || /^\d{4}-\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

interface PartnerManualViewerModalProps {
  isOpen: boolean;
  initialManualId?: string;
  initialChapterId?: string;
  onClose: () => void;
}

export const PartnerManualViewerModal: React.FC<PartnerManualViewerModalProps> = ({
  isOpen,
  initialManualId,
  initialChapterId,
  onClose,
}) => {
  const [manualsMap, setManualsMap] = useState<Record<string, CloudPartnerManualDoc>>(
    () => readSessionCachedPartnerManuals()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedManualId, setSelectedManualId] = useState<string>(
    initialManualId || ''
  );
  const [activeChapterId, setActiveChapterId] = useState<string>(
    initialChapterId || 'all-overview'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadManuals = async (bypassCache = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const fetched = await fetchPartnerManualsMap({ bypassCache });
      const keys = Object.keys(fetched);
      if (keys.length === 0) {
        setLoadError(
          '연결된 클라우드 보안 저장소에서 업무 교안 데이터를 찾을 수 없습니다. 초대 링크 또는 클라우드 연결 상태를 확인해 주세요.'
        );
      } else {
        setManualsMap(fetched);
      }
    } catch {
      setLoadError('클라우드 교안 데이터를 불러오는 중 일시적인 통신 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const cached = readSessionCachedPartnerManuals();
    if (Object.keys(cached).length > 0) {
      setManualsMap(cached);
      void loadManuals(false);
    } else {
      void loadManuals(true);
    }
  }, [isOpen]);

  const manualList = useMemo(() => Object.values(manualsMap), [manualsMap]);

  const activeDoc: CloudPartnerManualDoc | null = useMemo(() => {
    if (manualList.length === 0) return null;
    if (selectedManualId && manualsMap[selectedManualId]) {
      return manualsMap[selectedManualId];
    }
    if (initialManualId && manualsMap[initialManualId]) {
      return manualsMap[initialManualId];
    }
    return manualList[0];
  }, [manualList, manualsMap, selectedManualId, initialManualId]);

  useEffect(() => {
    if (!isOpen || !activeDoc) return;
    if (initialChapterId && activeDoc.chapters.some((c) => c.id === initialChapterId)) {
      setActiveChapterId(initialChapterId);
    } else if (
      activeChapterId !== 'all-overview' &&
      !activeDoc.chapters.some((c) => c.id === activeChapterId)
    ) {
      setActiveChapterId(activeDoc.chapters[0]?.id || 'all-overview');
    }
  }, [isOpen, activeDoc, initialChapterId]);

  useEffect(() => {
    if (!isOpen) return;
    const prevHandler = (window as any).__modalInternalBackHandler;
    const myHandler = (): boolean => {
      if (searchQuery.trim()) {
        setSearchQuery('');
        return true;
      }
      onClose();
      return true;
    };
    (window as any).__modalInternalBackHandler = myHandler;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if ((window as any).__modalInternalBackHandler === myHandler) {
        (window as any).__modalInternalBackHandler = prevHandler;
      }
    };
  }, [isOpen, searchQuery, onClose]);

  const handleCopyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const toggleStepCheck = (stepKey: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const visibleChapters = useMemo(() => {
    if (!activeDoc) return [];
    const q = searchQuery.trim();
    if (q) {
      return activeDoc.chapters.filter((ch) => {
        const blob = [
          ch.number,
          ch.title,
          ch.slideRange,
          ch.summary,
          ...(ch.keywords || []),
          ...(ch.callouts || []).flatMap((c) => [c.title, c.body]),
          ...(ch.sections || []).flatMap((s) => [s.title, ...(s.steps || [])]),
          ...(ch.tables || []).flatMap((t) => [
            t.title,
            ...(t.headers || []),
            ...(t.rows || []).flat(),
          ]),
        ].join(' ');
        return matchesManualQuery(blob, q);
      });
    }
    if (activeChapterId === 'all-overview') {
      return activeDoc.chapters;
    }
    return activeDoc.chapters.filter((ch) => ch.id === activeChapterId);
  }, [activeDoc, activeChapterId, searchQuery]);

  const currentChapterIndex = useMemo(() => {
    if (!activeDoc || activeChapterId === 'all-overview') return -1;
    return activeDoc.chapters.findIndex((c) => c.id === activeChapterId);
  }, [activeDoc, activeChapterId]);

  const renderCallout = (callout: CloudPartnerManualCallout, key: string) => {
    const toneMap = {
      danger: {
        wrap: 'bg-[#FFF1F2] dark:bg-rose-500/10 border-[#FECDD3] dark:border-rose-500/30 text-[#9F1239] dark:text-rose-200',
        badge: 'bg-[#E60012] text-white',
        icon: <AlertTriangle className="w-4 h-4 text-[#E60012] dark:text-rose-400 shrink-0 mt-0.5" />,
        label: '필수 주의',
      },
      warning: {
        wrap: 'bg-amber-50/90 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-100',
        badge: 'bg-amber-600 text-white',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
        label: '체크포인트',
      },
      success: {
        wrap: 'bg-emerald-50/90 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-100',
        badge: 'bg-[#059669] text-white',
        icon: <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />,
        label: '실무 꿀팁',
      },
      info: {
        wrap: 'bg-[#EFF6FF] dark:bg-blue-500/10 border-[#BFDBFE] dark:border-blue-500/30 text-[#1E3A8A] dark:text-blue-100',
        badge: 'bg-[#1B64DA] text-white',
        icon: <Info className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0 mt-0.5" />,
        label: '참고 안내',
      },
    } as const;
    const style = toneMap[callout.tone] || toneMap.info;

    return (
      <div
        key={key}
        className={`rounded-2xl border p-3.5 sm:p-4 space-y-1.5 ${style.wrap}`}
      >
        <div className="flex items-start gap-2">
          {style.icon}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-extrabold ${style.badge}`}>
                {style.label}
              </span>
              <h4 className="text-xs sm:text-[13.5px] font-extrabold tracking-tight break-keep">
                {callout.title}
              </h4>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed font-medium whitespace-pre-line break-keep opacity-95">
              {callout.body}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const checkedCount = Object.values(checkedSteps).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-t-[22px] sm:rounded-[22px] bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 border-t-[3px] border-t-[#E60012] shadow-2xl modal-kb-safe overflow-hidden max-h-[94dvh] flex flex-col text-[#191F28] dark:text-slate-100"
      >
        {/* 상단 고정 헤더 */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-[#131C2E] border-b border-[#E5E8EB] dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-[#FF3B47] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[11px] font-extrabold text-[#E60012] dark:text-rose-300 shrink-0">
                  <Lock className="w-3 h-3" />
                  인증 기기 전용
                </span>
                {activeDoc?.version && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11px] font-bold text-[#1B64DA] dark:text-blue-300 shrink-0">
                    {activeDoc.version}
                  </span>
                )}
              </div>
              <h2 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 truncate mt-0.5">
                {activeDoc?.title || '전산 실무 교안 뷰어'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {checkedCount > 0 && (
              <button
                type="button"
                onClick={() => setCheckedSteps({})}
                title="체크 표시 초기화"
                className="px-2.5 py-1.5 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>체크 해제({checkedCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => loadManuals(true)}
              disabled={isLoading}
              title="클라우드 최신본 새로고침"
              className="w-9 h-9 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#4E5968] dark:text-slate-300 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="교안 닫기"
              className="w-9 h-9 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#4E5968] dark:text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 검색바 + 챕터 탭 네비게이션 */}
        {activeDoc && (
          <div className="px-4 sm:px-6 py-3 bg-[#F8FAFC] dark:bg-slate-900/80 border-b border-[#E5E8EB] dark:border-slate-800 space-y-2.5 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2">
              {manualList.length > 1 && (
                <select
                  value={activeDoc.id}
                  onChange={(e) => {
                    setSelectedManualId(e.target.value);
                    setActiveChapterId('all-overview');
                  }}
                  className="px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs font-extrabold"
                >
                  {manualList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1] dark:text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="교안 전체 키워드·초성 검색 (예: 외국인, 농막, 선납, 인수불가, 회수비, 503, ㅇㄱㅇ, ㅅㄴ)"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 placeholder:text-[#8B95A1] dark:placeholder:text-slate-500 text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] dark:focus:border-blue-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveChapterId('all-overview');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-colors cursor-pointer ${
                  !searchQuery && activeChapterId === 'all-overview'
                    ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA]'
                    : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  전체 요약·펼침 ({activeDoc.chapters.length}장)
                </span>
              </button>

              {activeDoc.chapters.map((ch) => {
                const isSelected = !searchQuery && activeChapterId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveChapterId(ch.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E60012] text-white border-[#E60012]'
                        : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                    }`}
                  >
                    {ch.number}. {ch.title.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F2F4F6] dark:bg-[#0B1120] space-y-4">
          {isLoading && !activeDoc && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#1B64DA] dark:text-blue-400" />
              <div className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                비공개 클라우드에서 전산 교안을 불러오는 중입니다...
              </div>
              <p className="text-xs text-[#4E5968] dark:text-slate-400">
                인증된 기기 세션을 확인하고 데이터를 동기화합니다.
              </p>
            </div>
          )}

          {!isLoading && loadError && !activeDoc && (
            <div className="rounded-2xl border border-[#FECDD3] dark:border-rose-500/30 bg-[#FFF1F2] dark:bg-rose-500/10 p-5 text-center space-y-3">
              <AlertTriangle className="w-7 h-7 text-[#E60012] dark:text-rose-400 mx-auto" />
              <div className="text-sm font-extrabold text-[#9F1239] dark:text-rose-200">
                {loadError}
              </div>
              <button
                type="button"
                onClick={() => loadManuals(true)}
                className="px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold cursor-pointer"
              >
                다시 불러오기
              </button>
            </div>
          )}

          {activeDoc && (
            <>
              {/* 전체 보기일 때 상단 핵심 동선 + 필수 포털/콜센터 원클릭 바 노출 */}
              {!searchQuery && activeChapterId === 'all-overview' && (
                <div className="space-y-3">
                  {Array.isArray(activeDoc.quickFlow) && activeDoc.quickFlow.length > 0 && (
                    <div className="rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                          한눈에 보는 전산 진행 표준 동선
                        </span>
                        {activeDoc.securityNotice && (
                          <span className="text-[11px] font-bold text-[#8B95A1] dark:text-slate-400">
                            {activeDoc.securityNotice}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {activeDoc.quickFlow.map((qf) => (
                          <div
                            key={qf.step}
                            className="rounded-xl border border-[#E5E8EB] dark:border-slate-700/80 bg-[#F8FAFC] dark:bg-slate-900/60 p-3 flex flex-col justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-[#191F28] dark:bg-blue-500 text-white dark:text-slate-950 text-[10.5px] font-mono font-black">
                                {qf.step}
                              </span>
                              <span className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                                {qf.name}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-[#1B64DA] dark:text-blue-300 break-keep">
                              {qf.menu}
                            </div>
                            <div className="text-[11px] text-[#4E5968] dark:text-slate-400 leading-snug break-keep">
                              {qf.desc}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(activeDoc.essentialLinks) &&
                    activeDoc.essentialLinks.length > 0 && (
                      <div className="rounded-[20px] border border-[#BFDBFE] dark:border-blue-500/30 bg-white dark:bg-[#131C2E] p-4 space-y-2.5">
                        <div className="text-xs sm:text-[13px] font-extrabold text-[#1B64DA] dark:text-blue-300">
                          ⚡ 필수 접속 주소 · 고객센터 · 할부 확인 바로가기
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeDoc.essentialLinks.map((lnk, idx) => {
                            const isWeb = isUrlValue(lnk.value);
                            const cKey = `ess-${idx}`;
                            return (
                              <div
                                key={cKey}
                                className="rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/70 p-3 flex flex-col justify-between gap-2"
                              >
                                <div>
                                  <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
                                    {lnk.label}
                                  </div>
                                  <div className="text-[11.5px] font-mono font-bold text-[#1B64DA] dark:text-blue-300 break-all mt-0.5">
                                    {lnk.value}
                                  </div>
                                  {lnk.note && (
                                    <div className="text-[11px] text-[#4E5968] dark:text-slate-400 mt-1 break-keep">
                                      {lnk.note}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isWeb ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        window.open(
                                          lnk.value,
                                          '_blank',
                                          'noopener,noreferrer'
                                        )
                                      }
                                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#1B64DA] hover:bg-[#1554B8] text-white text-[11.5px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>열기</span>
                                    </button>
                                  ) : (
                                    <a
                                      href={`tel:${lnk.value.replace(/[^0-9]/g, '')}`}
                                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-extrabold inline-flex items-center justify-center gap-1"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>전화 연결</span>
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyValue(cKey, lnk.value)}
                                    className="py-1.5 px-2.5 rounded-lg border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedKey === cKey ? (
                                      <Check className="w-3 h-3 text-[#059669]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                    <span>{copiedKey === cKey ? '복사됨' : '복사'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 검색 결과 없음 */}
              {visibleChapters.length === 0 && (
                <div className="rounded-2xl border border-[#E5E8EB] dark:border-slate-800 bg-white dark:bg-[#131C2E] p-8 text-center space-y-2">
                  <div className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                    &lsquo;{searchQuery}&rsquo; 검색 결과가 없습니다.
                  </div>
                  <p className="text-xs text-[#4E5968] dark:text-slate-400">
                    다른 단어(예: 외국인, 거래선, 선납, 농막, 인수불가, 회수비, 발급번호)로 검색해 보세요.
                  </p>
                </div>
              )}

              {/* 챕터별 상세 카드 렌더링 */}
              {visibleChapters.map((chapter) => (
                <section
                  key={chapter.id}
                  className="rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 bg-white dark:bg-[#131C2E] overflow-hidden shadow-xs"
                >
                  <div className="px-4 sm:px-6 py-4 bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-[#E5E8EB] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-[#E60012] text-white text-xs font-mono font-black">
                          STEP {chapter.number}
                        </span>
                        <h3 className="text-base sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50">
                          {chapter.title}
                        </h3>
                        {chapter.slideRange && (
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[11px] font-mono font-bold text-[#4E5968] dark:text-slate-300">
                            원본 {chapter.slideRange}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4E5968] dark:text-slate-400 font-medium leading-relaxed break-keep">
                        {chapter.summary}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-5">
                    {/* 핵심 주의·꿀팁 콜아웃 */}
                    {Array.isArray(chapter.callouts) && chapter.callouts.length > 0 && (
                      <div className="space-y-2.5">
                        {chapter.callouts.map((co, cIdx) =>
                          renderCallout(co, `${chapter.id}-co-${cIdx}`)
                        )}
                      </div>
                    )}

                    {/* 단계별 실행 체크리스트 섹션 */}
                    {Array.isArray(chapter.sections) &&
                      chapter.sections.map((sec, sIdx) => (
                        <div key={`${chapter.id}-sec-${sIdx}`} className="space-y-2.5">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-[#1B64DA] dark:bg-blue-400 inline-block shrink-0" />
                            <span>{sec.title}</span>
                          </h4>

                          <div className="space-y-2">
                            {(sec.steps || []).map((stepText, stIdx) => {
                              const stepKey = `${chapter.id}-${sIdx}-${stIdx}`;
                              const isDone = Boolean(checkedSteps[stepKey]);
                              return (
                                <div
                                  key={stepKey}
                                  onClick={() => toggleStepCheck(stepKey)}
                                  className={`rounded-xl border p-3 flex items-start gap-2.5 cursor-pointer transition-colors ${
                                    isDone
                                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                      : 'bg-[#F8FAFC] dark:bg-slate-900/50 border-[#E5E8EB] dark:border-slate-800 hover:border-[#BFDBFE] dark:hover:border-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center text-[11px] font-mono font-extrabold shrink-0 transition-colors ${
                                      isDone
                                        ? 'bg-[#059669] border-[#059669] text-white'
                                        : 'bg-white dark:bg-slate-800 border-[#D1D6DB] dark:border-slate-600 text-[#4E5968] dark:text-slate-300'
                                    }`}
                                  >
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : stIdx + 1}
                                  </span>
                                  <p
                                    className={`text-xs sm:text-[13px] leading-relaxed font-medium break-keep flex-1 ${
                                      isDone
                                        ? 'line-through text-[#8B95A1] dark:text-slate-500'
                                        : 'text-[#191F28] dark:text-slate-200'
                                    }`}
                                  >
                                    {stepText}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                    {/* 기준표 / 회수비표 / 카드발급번호표 / NERP 상태표 */}
                    {Array.isArray(chapter.tables) &&
                      chapter.tables.map((tbl, tIdx) => (
                        <div key={`${chapter.id}-tbl-${tIdx}`} className="space-y-2">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-[#E60012] inline-block shrink-0" />
                            <span>{tbl.title}</span>
                          </h4>

                          <div className="overflow-x-auto rounded-2xl border border-[#E5E8EB] dark:border-slate-700">
                            <table className="w-full text-left border-collapse min-w-[520px]">
                              <thead>
                                <tr className="bg-[#F2F4F6] dark:bg-slate-800/90 border-b border-[#E5E8EB] dark:border-slate-700">
                                  {tbl.headers.map((h, hIdx) => (
                                    <th
                                      key={hIdx}
                                      className="px-3 py-2.5 text-[11.5px] font-extrabold text-[#333D4B] dark:text-slate-200 whitespace-nowrap"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E5E8EB] dark:divide-slate-800 bg-white dark:bg-[#131C2E]">
                                {tbl.rows.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors"
                                  >
                                    {row.map((cell, cIdx) => {
                                      const token = extractCopyableToken(cell);
                                      const cellKey = `${chapter.id}-t${tIdx}-r${rIdx}-c${cIdx}`;
                                      return (
                                        <td
                                          key={cIdx}
                                          className={`px-3 py-2.5 text-xs leading-snug align-top break-keep ${
                                            cIdx === 0
                                              ? 'font-extrabold text-[#191F28] dark:text-slate-100 whitespace-nowrap'
                                              : 'font-medium text-[#4E5968] dark:text-slate-300'
                                          }`}
                                        >
                                          {token ? (
                                            <button
                                              type="button"
                                              onClick={() => handleCopyValue(cellKey, token)}
                                              title="터치하여 번호/주소 복사"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 font-mono font-bold hover:opacity-85 cursor-pointer"
                                            >
                                              <span>{cell}</span>
                                              {copiedKey === cellKey ? (
                                                <Check className="w-3 h-3 text-[#059669]" />
                                              ) : (
                                                <Copy className="w-3 h-3 opacity-75" />
                                              )}
                                            </button>
                                          ) : (
                                            cell
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        {/* 하단 이전/다음 챕터 빠른 이동 푸터 */}
        {activeDoc && !searchQuery && activeChapterId !== 'all-overview' && (
          <div className="px-4 sm:px-6 py-3 bg-white dark:bg-[#131C2E] border-t border-[#E5E8EB] dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              disabled={currentChapterIndex <= 0}
              onClick={() => {
                if (currentChapterIndex > 0) {
                  setActiveChapterId(activeDoc.chapters[currentChapterIndex - 1].id);
                }
              }}
              className="px-3.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>이전 단계</span>
            </button>

            <span className="text-xs font-mono font-bold text-[#4E5968] dark:text-slate-400">
              {currentChapterIndex + 1} / {activeDoc.chapters.length}
            </span>

            <button
              type="button"
              disabled={
                currentChapterIndex < 0 ||
                currentChapterIndex >= activeDoc.chapters.length - 1
              }
              onClick={() => {
                if (currentChapterIndex < activeDoc.chapters.length - 1) {
                  setActiveChapterId(activeDoc.chapters[currentChapterIndex + 1].id);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <span>다음 단계</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
