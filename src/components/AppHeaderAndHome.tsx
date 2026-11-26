import React, { useEffect, useRef, useState } from 'react';
import { AppStep } from '../types/proposal';
import { ScheduleCharacterBanner } from './ScheduleCharacterBanner';
import { FlagshipModalShell } from './ui/FlagshipModalShell';
import { ViewportSafePopover } from './ui/ViewportSafePopover';
import { openStorePolicyModal } from './StorePolicyGuideView';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Headphones,
  Home,
  Layers,
  Lock,
  Menu,
  Moon,
  Percent,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Truck,
  Users,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import {
  CONSULTANT_PROFILE_UPDATED_EVENT,
  getShortBranchLabel,
} from '../utils/shareQuoteCodec';

export type QuickConsultationGroupKey =
  | 'care-insurance'
  | 'as-massage'
  | 'finance-freed'
  | 'landing-links';

export interface OfficialLandingLinkSpec {
  id: string;
  title: string;
  sub: string;
  badge: string;
  isStaff?: boolean;
  url: string;
}

export const OFFICIAL_LANDING_LINKS: OfficialLandingLinkSpec[] = [
  {
    id: 'sub-landing',
    title: '구독 랜딩페이지',
    sub: '가전구독 × 구독플러스 맞춤 혜택 시뮬레이터',
    badge: '고객 안내',
    url: 'https://himart-gj.github.io/himart-subscription-simulator/#/',
  },
  {
    id: 'store-landing',
    title: '일반 매장랜딩페이지',
    sub: '경기광주점 A·B동 쇼룸 & 1:1 통합 상담 예약',
    badge: '고객 안내',
    url: 'https://himart-gj.github.io/himart-11/',
  },
  {
    id: 'sub-admin',
    title: '구독페이지 관리자페이지',
    sub: '구독 품목 · 추천세트 · 정책 관리 CMS',
    badge: '관리자 전용',
    isStaff: true,
    url: 'https://himart-gj.github.io/himart-subscription-simulator/#/admin',
  },
];

export function getStepShortLabel(s: AppStep): string {
  switch (s) {
    case 'home':
      return '홈';
    case 'crm':
      return '고객관리';
    case 'marketing-db':
      return '인스타DB';
    case 'input':
      return '견적설계';
    case 'proposal':
      return '제안서';
    case 'care-table':
      return '조견표';
    case 'lotte-plan':
      return '플랜계산기';
    case 'pop-printer':
      return '구독POP';
    case 'himobile':
      return '하이모바일';
    case 'allcare-guide':
      return '올케어';
    case 'insurance':
      return '보험안내';
    default:
      return '홈';
  }
}

export const AppHeaderAndHome: React.FC<Record<string, any>> = ({
  activeCrmCustomers,
  activeMode,
  backButtonLabel,
  careUpdateMonthBadge,
  currentScreenBadgeLabel,
  handleEnterMode,
  handleHomeButtonClick,
  handleInstallAppClick,
  handleNavigateBack,
  isDark,
  isFriendMode = false,
  isMenuOpen,
  isOnline,
  isOwnerDbUnlocked,
  isStandalone,
  menuContainerRef,
  navigateToStep,
  ownerDbQuickSummary,
  pendingCount,
  pushAppHistoryGuard,
  setInitialCrmFilterTab,
  setInitialCrmTab,
  setIsAiCommandModalOpen,
  setIsAsCenterOpen,
  setIsCardIssueOpen,
  setIsInstallmentModalOpen,
  setIsMenuOpen,
  setIsOmnibarOpen,
  setIsPartnerLinksOpen,
  setIsScheduleModalOpen,
  setIsUploadHubOpen,
  step,
  toggleUiTheme,
  unconfirmedLogisticsCountHome,
  unpaidGiftCountHome,
  urgentCount,
}) => {
  const headerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [activeQuickGroup, setActiveQuickGroup] = useState<QuickConsultationGroupKey | null>(null);
  const [copiedLandingId, setCopiedLandingId] = useState<string | null>(null);
  const [, setHeaderProfileTick] = useState(0);

  useEffect(() => {
    const onProf = () => setHeaderProfileTick((v) => v + 1);
    window.addEventListener(CONSULTANT_PROFILE_UPDATED_EVENT, onProf);
    return () =>
      window.removeEventListener(CONSULTANT_PROFILE_UPDATED_EVENT, onProf);
  }, []);
  const headerBranchLabel = getShortBranchLabel();

  useEffect(() => {
    if (!activeQuickGroup) return;
    try {
      window.history.pushState({ appGuard: true, tag: 'quick-group-modal' }, '');
    } catch {
      // ignore
    }
    const myHandler = (): boolean => {
      setActiveQuickGroup(null);
      return true;
    };
    const prevHandler = (window as any).__modalInternalBackHandler;
    (window as any).__modalInternalBackHandler = myHandler;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveQuickGroup(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if ((window as any).__modalInternalBackHandler === myHandler) {
        (window as any).__modalInternalBackHandler = prevHandler;
      }
    };
  }, [activeQuickGroup]);

  const handleCopyLandingUrl = async (item: OfficialLandingLinkSpec) => {
    try {
      await navigator.clipboard.writeText(item.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = item.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedLandingId(item.id);
    window.setTimeout(() => {
      setCopiedLandingId((prev) => (prev === item.id ? null : prev));
    }, 1800);
  };

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === 'undefined') return;
    const syncHeight = () => {
      const h = Math.max(48, Math.round(el.getBoundingClientRect().height));
      document.documentElement.style.setProperty('--app-header-h', `${h}px`);
    };
    syncHeight();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeight) : null;
    ro?.observe(el);
    window.addEventListener('resize', syncHeight);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, []);

  const surfaceBtn = isDark
    ? 'bg-[#1E293B] hover:bg-[#273549] text-slate-100 border-white/10'
    : 'bg-white hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]';

  return (
    <>
      {/* ==================== OFFICIAL LOTTE HIMART ENTERPRISE HEADER (ZERO COLLISION AT 344/390/820/1440PX) ==================== */}
      <header
        ref={headerRef}
        className={`safe-top-header w-full min-h-[54px] border-t-[3px] border-t-[#E60012] border-b px-2.5 sm:px-5 py-2 flex items-center justify-between gap-1.5 sm:gap-2 sticky top-0 z-40 backdrop-blur-md transition-colors no-print ${
          isDark
            ? 'bg-[#0B1120]/95 text-[#F8FAFC] border-b-white/10'
            : 'bg-white/95 text-[#191F28] border-b-[#E5E8EB] shadow-[0_1px_8px_rgba(25,31,40,0.03)]'
        }`}
      >
        {/* Left: Official Brand Home (preserves 5-tap stealth PIN unlock) + Contextual Back + Desktop Current Screen Badge */}
        <div className="flex items-center gap-1 min-[380px]:gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
          <button
            type="button"
            onClick={handleHomeButtonClick}
            title="홈으로 이동"
            aria-label="홈으로 이동"
            className={`h-8 min-[380px]:h-9 ${
              step !== 'home' ? 'w-8 min-[380px]:w-9 min-[460px]:w-auto min-[460px]:px-2.5 sm:px-3.5 justify-center' : 'px-2.5 sm:px-3.5'
            } rounded-xl text-xs font-extrabold flex items-center gap-1.5 sm:gap-2 shrink-0 transition cursor-pointer schedule-tactile border ${
              step === 'home'
                ? isDark
                  ? 'bg-[#1E293B] text-white border-white/15'
                  : 'bg-[#191F28] text-white border-[#191F28]'
                : surfaceBtn
            }`}
          >
            <span
              className={`${
                step !== 'home' ? 'hidden min-[460px]:inline-block' : 'inline-block'
              } px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-tight leading-none shrink-0`}
            >
              HIMART
            </span>
            <Home
              className={`w-4 h-4 ${
                step !== 'home' ? 'min-[460px]:hidden text-[#E60012]' : 'sm:hidden'
              }`}
            />
            {headerBranchLabel && (
              <span
                className={`${
                  step !== 'home' ? 'hidden lg:inline' : 'hidden sm:inline'
                } tracking-tight font-extrabold whitespace-nowrap`}
              >
                {headerBranchLabel}
              </span>
            )}
          </button>

          {step !== 'home' && (
            <button
              type="button"
              onClick={handleNavigateBack}
              title={`직전 화면(${backButtonLabel})으로 돌아가기`}
              className={`h-8 min-[380px]:h-9 px-2 sm:px-3 rounded-xl text-[11.5px] min-[380px]:text-xs font-bold flex items-center gap-1 min-w-0 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-[#1B64DA] dark:text-[#60A5FA]" />
              <span className="truncate">
                {backButtonLabel}
              </span>
            </button>
          )}

          {step !== 'home' && currentScreenBadgeLabel && (
            <span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 truncate min-w-0">
              {currentScreenBadgeLabel}
            </span>
          )}

          {(!isOnline || pendingCount > 0) && (
            <span
              className={`${
                step !== 'home' ? 'hidden xl:inline-flex' : 'inline-flex'
              } items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11.5px] font-bold shrink-0`}
              title="인터넷 연결 복구 시 자동 동기화"
            >
              <WifiOff className="w-3 h-3" />
              <span className="hidden lg:inline">
                {!isOnline ? '오프라인' : `대기 ${pendingCount}`}
              </span>
            </span>
          )}
        </div>

        {/* Right: Omnibar Search + AI Assistant + Contextual Schedule Icon/Btn + Theme Toggle + Full Menu */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center gap-1 sm:gap-1.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              pushAppHistoryGuard('open-omnibar');
              setIsOmnibarOpen(true);
            }}
            title="통합검색 (Ctrl+K)"
            aria-label="통합검색"
            className={`h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 md:w-auto md:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}
          >
            <Search className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 text-[#4E5968] dark:text-slate-300" />
            <span className="hidden md:inline">통합검색</span>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[11.5px] font-mono opacity-65 bg-[#F2F4F6] dark:bg-white/10">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(false);
              pushAppHistoryGuard('open-ai-command');
              setIsAiCommandModalOpen(true);
            }}
            title="자연어·음성 한 줄로 견적 계산 및 고객관리 자동 등록"
            className={`h-8 min-[380px]:h-9 px-1.5 min-[380px]:px-2 sm:px-3 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0 border transition cursor-pointer schedule-tactile ${
              isDark
                ? 'bg-[#1B64DA]/25 hover:bg-[#1B64DA]/35 text-[#93C5FD] border-[#60A5FA]/35'
                : 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1B64DA] border-[#BFDBFE]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>AI</span>
            <span className="hidden sm:inline">비서</span>
          </button>

          {/* 서브 화면에서는 모바일에서도 즉시 휴무표 접근 가능한 깔끔한 아이콘 버튼 노출 */}
          {step !== 'home' && !isFriendMode && (
            <button
              type="button"
              onClick={() => {
                pushAppHistoryGuard('open-schedule');
                setIsScheduleModalOpen(true);
              }}
              title="경기광주점 근무자 및 휴무표 보기"
              aria-label="경기광주점 휴무표 열기"
              className={`flex h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 md:w-auto md:px-2.5 rounded-xl text-xs font-bold items-center justify-center gap-1 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}
            >
              <Calendar className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 text-[#4E5968] dark:text-slate-300" />
              <span className="hidden md:inline">휴무표</span>
            </button>
          )}

          {/* 다크모드 토글: 홈과 모든 서브 화면(모바일 포함)에서 100% 접근 가능 */}
          <button
            type="button"
            onClick={toggleUiTheme}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            className={`flex h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 rounded-xl items-center justify-center border transition cursor-pointer schedule-tactile ${surfaceBtn}`}
          >
            {isDark ? (
              <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-300" />
            ) : (
              <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#4E5968]" />
            )}
          </button>

          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallAppClick}
              title="홈 화면에 앱 설치"
              className={`hidden lg:flex h-9 px-2.5 rounded-xl text-xs font-bold items-center gap-1 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>앱 설치</span>
            </button>
          )}

          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => {
              setIsMenuOpen((prev: boolean) => {
                if (!prev) pushAppHistoryGuard('open-menu');
                return !prev;
              });
            }}
            aria-label="전체메뉴 열기"
            className={`h-8 min-[380px]:h-9 px-1.5 min-[380px]:px-2 sm:px-3 rounded-xl text-xs font-extrabold flex items-center gap-1 min-[380px]:gap-1.5 border transition cursor-pointer schedule-tactile ${
              isMenuOpen
                ? isDark
                  ? 'bg-[#60A5FA] border-[#60A5FA] text-[#0B1120]'
                  : 'bg-[#191F28] border-[#191F28] text-white'
                : surfaceBtn
            }`}
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="hidden min-[430px]:inline">전체메뉴</span>
            {urgentCount >= 1 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold leading-none font-mono">
                {urgentCount}
              </span>
            )}
          </button>

          {/* Enterprise Navigation Menu Popover (Portaled & Viewport-Clamped) */}
          <ViewportSafePopover
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            anchorRef={menuBtnRef}
            preferredWidth={396}
            align="end"
            mobileFullWidth
            className={`rounded-2xl border shadow-2xl p-3.5 space-y-2.5 schedule-modal-enter ${
              isDark
                ? 'bg-[#131C2E] border-white/15 text-[#F8FAFC]'
                : 'bg-white border-[#D1D6DB] text-[#191F28]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setInitialCrmTab(undefined);
                setInitialCrmFilterTab?.(undefined);
                navigateToStep('crm');
              }}
              className={`w-full py-3 px-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-between border transition cursor-pointer ${
                isDark
                  ? 'bg-[#1B64DA] text-white border-[#3B82F6]'
                  : 'bg-[#191F28] hover:bg-[#262F3D] text-white border-[#191F28]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0 text-[#FF6B78]" />
                <span>VIP 통합 고객관리 (CRM)</span>
              </span>
              {urgentCount >= 1 ? (
                <span className="px-2 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold shrink-0">
                  긴급 {urgentCount}건
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
              )}
            </button>

            {isOwnerDbUnlocked && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigateToStep('marketing-db');
                  }}
                  className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1E293B] text-amber-200 border-amber-400/35'
                      : 'bg-[#FFF1F2] text-[#191F28] border-[#FECDD3]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-[#E60012] shrink-0" />
                    <span>인스타 마케팅 DB관리 (전용)</span>
                  </span>
                  {ownerDbQuickSummary.newCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold shrink-0">
                      신규 {ownerDbQuickSummary.newCount}건
                    </span>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-upload-hub');
                    setIsUploadHubOpen?.(true);
                  }}
                  className={`w-full py-2.5 px-3.5 rounded-xl font-extrabold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1E293B] hover:bg-[#273549] text-emerald-300 border-emerald-500/35'
                      : 'bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#059669] border-[#BBF7D0]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">매장 자료 통합 업로드 (전용)</span>
                  </span>
                  <span className="text-[11px] font-bold opacity-80 shrink-0">
                    휴무·수당·조견·무이자
                  </span>
                </button>
              </>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {[
                {
                  label: '일반 구매 견적',
                  icon: CreditCard,
                  active: (step === 'input' || step === 'proposal') && activeMode === 'general',
                  onClick: () => handleEnterMode('general'),
                },
                {
                  label: '구독 구매 견적',
                  icon: RefreshCw,
                  active:
                    (step === 'input' || step === 'proposal') && activeMode === 'subscription',
                  onClick: () => handleEnterMode('subscription'),
                },
                {
                  label: '일반+구독 혼합',
                  icon: Layers,
                  active: (step === 'input' || step === 'proposal') && activeMode === 'hybrid',
                  onClick: () => handleEnterMode('hybrid'),
                },
                {
                  label: '롯데 플랜 계산기',
                  icon: Calculator,
                  active: step === 'lotte-plan',
                  onClick: () => navigateToStep('lotte-plan'),
                },
                {
                  label: '구독 POP 출력기',
                  icon: Printer,
                  active: step === 'pop-printer',
                  onClick: () => navigateToStep('pop-printer'),
                },
                {
                  label: '하이 모바일',
                  icon: Smartphone,
                  active: step === 'himobile',
                  onClick: () => navigateToStep('himobile'),
                },
                {
                  label: '가전 올케어',
                  icon: Wrench,
                  active: step === 'allcare-guide',
                  onClick: () => navigateToStep('allcare-guide'),
                },
                {
                  label: '보험 청구안내',
                  icon: ShieldCheck,
                  active: step === 'insurance',
                  onClick: () => navigateToStep('insurance'),
                },
                {
                  label: '프리드 상품 요약',
                  icon: BookOpen,
                  active: false,
                  onClick: () => openStorePolicyModal('freed'),
                },
                {
                  label: '안마의자 설치안내',
                  icon: Truck,
                  active: false,
                  onClick: () => openStorePolicyModal('massage'),
                },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      item.onClick();
                    }}
                    className={`py-2.5 px-3 rounded-xl text-left text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                      item.active
                        ? 'bg-[#E60012] text-white border-[#E60012]'
                        : surfaceBtn
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                navigateToStep('care-table');
              }}
              className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${surfaceBtn}`}
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-[#1B64DA]" />
                <span>안심케어 · 가전이사 조견표</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11.5px] font-bold bg-[#EFF6FF] text-[#1B64DA] dark:bg-blue-500/15 dark:text-blue-300">
                {careUpdateMonthBadge}
              </span>
            </button>

            <div
              className={`pt-2 border-t space-y-1.5 ${
                isDark ? 'border-white/10' : 'border-[#E5E8EB]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveQuickGroup('landing-links');
                }}
                className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                  isDark
                    ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-[#60A5FA]/35'
                    : 'bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#191F28] border-[#FECDD3]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#E60012] dark:text-rose-300 shrink-0" />
                  <span>내 랜딩페이지 바로가기</span>
                </span>
                <span className="text-[11.5px] font-bold text-[#E60012] dark:text-rose-300">
                  구독 · 매장 · 관리자
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  pushAppHistoryGuard('open-partner-links');
                  setIsPartnerLinksOpen(true);
                }}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${surfaceBtn}`}
              >
                <span>제휴 · 업무 바로가기 허브</span>
                <span className="text-[11.5px] text-[#1B64DA] dark:text-blue-300">입주 · 중고 · 수당 · 청약</span>
              </button>

              <div className={`grid ${isFriendMode ? 'grid-cols-3' : 'grid-cols-4'} gap-1.5`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-installment');
                    setIsInstallmentModalOpen(true);
                  }}
                  className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}
                >
                  무이자
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-card-issue');
                    setIsCardIssueOpen(true);
                  }}
                  className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}
                >
                  카드발급
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-as-center');
                    setIsAsCenterOpen(true);
                  }}
                  className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}
                >
                  AS센터
                </button>
                {!isFriendMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-schedule');
                      setIsScheduleModalOpen(true);
                    }}
                    className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}
                  >
                    휴무표
                  </button>
                )}
              </div>

              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleInstallAppClick();
                  }}
                  className={`lg:hidden w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer ${surfaceBtn}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>홈 화면에 앱 설치</span>
                </button>
              )}
            </div>
          </ViewportSafePopover>
        </div>
      </header>

      {/* ==================== HOME: LOTTE HIMART ENTERPRISE FLAGSHIP WORKSPACE ==================== */}
      {step === 'home' && (
        <main className="flex-1 w-full flex justify-center px-3.5 sm:px-6 py-4 sm:py-6">
          <div className="w-full max-w-5xl flex flex-col gap-3.5 sm:gap-4">
            {/* 01. STAFF DAILY SCHEDULE & INCENTIVE BRIEFING */}
            <ScheduleCharacterBanner
              isDark={isDark}
              customers={activeCrmCustomers}
              hideScheduleSection={Boolean(isFriendMode)}
              onOpenScheduleModal={() => {
                if (isFriendMode) return;
                pushAppHistoryGuard('open-schedule');
                setIsScheduleModalOpen(true);
              }}
              onOpenIncentiveTab={(targetTab: any) => {
                setInitialCrmFilterTab?.(undefined);
                setInitialCrmTab(targetTab);
                navigateToStep('crm');
              }}
            />

            {/* 02. VIP INTEGRATED CRM LIVE DASHBOARD CARD */}
            <div
              className={`w-full rounded-[20px] border p-4 sm:px-5 sm:py-4 transition flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 ${
                isDark
                  ? 'bg-[#131C2E] border-white/10 text-[#F8FAFC]'
                  : 'bg-white border-[#E5E8EB] text-[#191F28] shadow-[0_2px_12px_rgba(25,31,40,0.04)]'
              }`}
            >
              <div className="min-w-0 space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 text-xs font-extrabold">
                    <Users className="w-3.5 h-3.5" />
                    <span>VIP 통합 고객관리 (CRM)</span>
                  </span>
                  <span className="text-xs font-bold text-[#4E5968] dark:text-slate-300">
                    등록 고객 총 <strong className="font-mono text-[#191F28] dark:text-white">{activeCrmCustomers.length}명</strong> 실시간 연동
                  </span>
                </div>

                <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:flex sm:items-center sm:flex-wrap sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInitialCrmTab(undefined);
                      setInitialCrmFilterTab?.('urgent');
                      navigateToStep('crm');
                    }}
                    className={`px-3 py-2 rounded-xl border flex min-[380px]:block items-center justify-between text-left sm:inline-flex sm:items-center sm:gap-2 transition cursor-pointer schedule-tactile ${
                      urgentCount > 0
                        ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#E60012] dark:bg-rose-500/15 dark:border-rose-400/30 dark:text-rose-300'
                        : isDark
                        ? 'bg-[#1E293B] border-white/10 text-slate-200'
                        : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <div className="text-[11.5px] font-bold opacity-85">긴급 할일</div>
                    <div className="text-sm font-extrabold font-mono">{urgentCount}건</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInitialCrmTab(undefined);
                      setInitialCrmFilterTab?.('delivery');
                      navigateToStep('crm');
                    }}
                    className={`px-3 py-2 rounded-xl border flex min-[380px]:block items-center justify-between text-left sm:inline-flex sm:items-center sm:gap-2 transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1E293B] border-white/10 text-slate-200'
                        : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">물류대기</div>
                    <div className="text-sm font-extrabold font-mono text-[#1B64DA] dark:text-[#60A5FA]">
                      {unconfirmedLogisticsCountHome}건
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInitialCrmTab(undefined);
                      setInitialCrmFilterTab?.('gifts');
                      navigateToStep('crm');
                    }}
                    className={`px-3 py-2 rounded-xl border flex min-[380px]:block items-center justify-between text-left sm:inline-flex sm:items-center sm:gap-2 transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1E293B] border-white/10 text-slate-200'
                        : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
                    }`}
                  >
                    <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">사은품 미지급</div>
                    <div className="text-sm font-extrabold font-mono">{unpaidGiftCountHome}건</div>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInitialCrmTab(undefined);
                  setInitialCrmFilterTab?.(undefined);
                  navigateToStep('crm');
                }}
                className={`w-full lg:w-auto min-h-[42px] px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer schedule-tactile transition shadow-xs ${
                  urgentCount >= 1
                    ? 'bg-[#E60012] hover:bg-[#C8000F] text-white'
                    : isDark
                    ? 'bg-[#60A5FA] text-[#0B1120]'
                    : 'bg-[#191F28] hover:bg-[#262F3D] text-white'
                }`}
              >
                <span>VIP 고객관리 열기</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Owner Private Marketing DB Banner (Only when unlocked via 5-tap PIN) */}
            {isOwnerDbUnlocked && (
              <button
                type="button"
                onClick={() => navigateToStep('marketing-db')}
                className={`w-full py-3.5 px-4 sm:px-5 rounded-[20px] transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer schedule-tactile border text-left ${
                  isDark
                    ? 'bg-[#131C2E] text-white border-amber-400/35'
                    : 'bg-[#FFF1F2] text-[#191F28] border-[#FECDD3]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#E60012]">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>PRIVATE · 인스타 마케팅 DB관리</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold mt-0.5 break-keep">
                    전체 {ownerDbQuickSummary.totalActive}명 · 신규{' '}
                    <span className="text-[#E60012] font-mono">
                      {ownerDbQuickSummary.newCount}건
                    </span>{' '}
                    · 인계중 <span className="font-mono">{ownerDbQuickSummary.handoverTabCount}건</span> · 당월 매출{' '}
                    <span className="text-[#1B64DA] dark:text-blue-300 font-mono">
                      {ownerDbQuickSummary.monthRevenue.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-xl bg-[#191F28] dark:bg-white text-white dark:text-[#191F28] text-xs font-extrabold text-center shrink-0 whitespace-nowrap">
                  DB관리 열기 →
                </span>
              </button>
            )}

            {/* 03. FLAGSHIP QUOTE DESIGN STUDIO (4 CORE MODES) */}
            <section
              className={`rounded-[20px] border p-4 sm:p-6 flex flex-col gap-4 ${
                isDark
                  ? 'bg-[#131C2E] border-white/10'
                  : 'bg-white border-[#E5E8EB] shadow-[0_2px_12px_rgba(25,31,40,0.04)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11.5px] font-extrabold tracking-[0.06em] uppercase text-[#E60012]">
                    <span>LOTTE HIMART · OFFICIAL QUOTE STUDIO</span>
                  </div>
                  <h1 className="text-lg sm:text-[22px] font-extrabold tracking-tight leading-snug">
                    맞춤 가전 혜택 견적 설계
                  </h1>
                  <p className="text-xs sm:text-[13px] text-[#4E5968] dark:text-slate-300 font-medium">
                    전산 캡처 AI 자동인식부터 1·2안 비교, 카카오톡 스토리 제안서 공유까지 원스톱으로 설계합니다.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold border ${
                    isDark
                      ? 'bg-[#1E293B] border-white/10 text-blue-300'
                      : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1B64DA]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI 전산스캔 · 고객 뷰어 100% 연동</span>
                </span>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                {/* 01 일반 구매 견적 */}
                <button
                  type="button"
                  onClick={() => handleEnterMode('general')}
                  className="group p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between gap-3.5 transition cursor-pointer schedule-tactile border bg-[#E60012] hover:bg-[#C8000F] text-white border-[#E60012] shadow-[0_6px_18px_rgba(230,0,18,0.18)]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-8 h-8 rounded-xl bg-white/18 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-white" />
                    </span>
                    <ArrowUpRight className="w-4 h-4 opacity-85 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <div>
                    <span className="text-[11.5px] font-extrabold tracking-wider uppercase opacity-85">
                      GENERAL PACKAGE
                    </span>
                    <div className="text-[15px] sm:text-[17px] font-extrabold tracking-tight break-keep mt-0.5">
                      일반 구매 견적
                    </div>
                    <div className="text-xs text-white/85 font-medium mt-1 break-keep">
                      즉시할인 · 캐시백 · 프리드 체감가
                    </div>
                  </div>
                </button>

                {/* 02 구독 구매 견적 */}
                <button
                  type="button"
                  onClick={() => handleEnterMode('subscription')}
                  className={`group p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between gap-3.5 transition cursor-pointer schedule-tactile border ${
                    isDark
                      ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/12 hover:border-[#60A5FA]/60'
                      : 'bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#191F28] border-[#E5E8EB] hover:border-[#93C5FD]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-8 h-8 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/20 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-[#1B64DA] dark:text-[#60A5FA]" />
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8B95A1] group-hover:text-[#1B64DA] transition-colors" />
                  </div>
                  <div>
                    <span className="text-[11.5px] font-extrabold tracking-wider uppercase text-[#1B64DA] dark:text-[#60A5FA]">
                      SUBSCRIPTION CARE
                    </span>
                    <div className="text-[15px] sm:text-[17px] font-extrabold tracking-tight break-keep mt-0.5">
                      구독 구매 견적
                    </div>
                    <div className="text-xs text-[#4E5968] dark:text-slate-300 font-medium mt-1 break-keep">
                      36·60개월 케어 · 월 청구할인
                    </div>
                  </div>
                </button>

                {/* 03 일반+구독 혼합 */}
                <button
                  type="button"
                  onClick={() => handleEnterMode('hybrid')}
                  className={`group p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between gap-3.5 transition cursor-pointer schedule-tactile border ${
                    isDark
                      ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/12 hover:border-emerald-400/50'
                      : 'bg-[#F8FAFC] hover:bg-emerald-50/70 text-[#191F28] border-[#E5E8EB] hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-[#059669] dark:text-emerald-300" />
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8B95A1] group-hover:text-[#059669] transition-colors" />
                  </div>
                  <div>
                    <span className="text-[11.5px] font-extrabold tracking-wider uppercase text-[#059669] dark:text-emerald-300">
                      HYBRID DESIGN
                    </span>
                    <div className="text-[15px] sm:text-[17px] font-extrabold tracking-tight break-keep mt-0.5">
                      일반 + 구독 혼합
                    </div>
                    <div className="text-xs text-[#4E5968] dark:text-slate-300 font-medium mt-1 break-keep">
                      일시불 + 월구독 결합 비교 제안
                    </div>
                  </div>
                </button>

                {/* 04 롯데 플랜 계산기 */}
                <button
                  type="button"
                  onClick={() => navigateToStep('lotte-plan')}
                  className={`group p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between gap-3.5 transition cursor-pointer schedule-tactile border ${
                    isDark
                      ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/12'
                      : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-8 h-8 rounded-xl bg-[#191F28]/8 dark:bg-white/10 flex items-center justify-center">
                      <Calculator className="w-4 h-4 text-[#191F28] dark:text-white" />
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8B95A1] group-hover:text-[#191F28] transition-colors" />
                  </div>
                  <div>
                    <span className="text-[11.5px] font-extrabold tracking-wider uppercase text-[#4E5968] dark:text-slate-400">
                      LOTTE CARD PLAN
                    </span>
                    <div className="text-[15px] sm:text-[17px] font-extrabold tracking-tight break-keep mt-0.5">
                      롯데 플랜 계산기
                    </div>
                    <div className="text-xs text-[#4E5968] dark:text-slate-300 font-medium mt-1 break-keep">
                      최대 -108만 플랜 시뮬레이션
                    </div>
                  </div>
                </button>
              </div>
            </section>

            {/* 04. STOREFRONT OPERATIONS & CONSULTATION HUB */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left 5 cols: POP, Care Table, HiMobile & Partner Links Hub */}
              <section
                className={`lg:col-span-5 rounded-[20px] border p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                  isDark
                    ? 'bg-[#131C2E] border-white/10'
                    : 'bg-white border-[#E5E8EB] shadow-[0_2px_12px_rgba(25,31,40,0.04)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold tracking-tight text-[#191F28] dark:text-white">
                    매장 실무 도구 · 모바일 · 제휴
                  </span>
                  <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1B64DA] dark:bg-blue-500/15 dark:text-blue-300">
                    {careUpdateMonthBadge}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigateToStep('pop-printer')}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/10'
                        : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Printer className="w-4 h-4 text-[#E60012] dark:text-rose-300" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-sm font-extrabold break-keep">구독 POP 자동 출력기</div>
                        <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 mt-0.5 break-keep">
                          견적 사진 스캔 · A4 2-UP 쇼카드 인쇄
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToStep('care-table')}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/10'
                        : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-[#1B64DA] dark:text-blue-300" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-sm font-extrabold break-keep">
                          안심케어 · 가전이사 조견표
                        </div>
                        <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 mt-0.5 break-keep">
                          품목별 클리닝 · 이전설치 요금 즉시 복사
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToStep('himobile')}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/10'
                        : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4 text-[#E60012] dark:text-rose-300" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-sm font-extrabold break-keep">
                          하이 모바일 알뜰 요금제
                        </div>
                        <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 mt-0.5 break-keep">
                          KT망 무약정 · 24개월 약정 유심 특가 안내
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      pushAppHistoryGuard('open-partner-links');
                      setIsPartnerLinksOpen(true);
                    }}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1B64DA]/20 hover:bg-[#1B64DA]/30 text-white border-[#60A5FA]/30'
                        : 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#191F28] border-[#BFDBFE]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[#1B64DA] text-white flex items-center justify-center shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-sm font-extrabold text-[#1B64DA] dark:text-blue-200 break-keep">
                          제휴 · 업무 바로가기 허브
                        </div>
                        <div className="text-[11.5px] text-[#4E5968] dark:text-slate-300 mt-0.5 break-keep">
                          입주 · 중고매입 · 수당조회 · 청약 QR 포털
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#1B64DA] dark:text-blue-300 shrink-0 ml-2" />
                  </button>
                </div>
              </section>

              {/* Right 7 cols: 4 Consolidated Customer Consultation & Landing Groups (2x2 Grid) */}
              <section
                className={`lg:col-span-7 rounded-[20px] border p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                  isDark
                    ? 'bg-[#131C2E] border-white/10'
                    : 'bg-white border-[#E5E8EB] shadow-[0_2px_12px_rgba(25,31,40,0.04)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold tracking-tight text-[#191F28] dark:text-white">
                    고객 상담 퀵 가이드 · 내 랜딩페이지
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#8B95A1]">
                    터치 시 세부 항목 선택 팝업
                  </span>
                </div>

                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5 sm:gap-3 flex-1">
                  {[
                    {
                      key: 'care-insurance' as QuickConsultationGroupKey,
                      title: '올케어 · 보험접수',
                      sub: '가전 연장보증 · 보험 청구안내',
                      pill: '2개 안내',
                      icon: ShieldCheck,
                      tone: 'text-[#059669] bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-300',
                    },
                    {
                      key: 'as-massage' as QuickConsultationGroupKey,
                      title: '가전 AS · 안마의자 설치',
                      sub: '서비스센터 연락처 · 사다리차 기준',
                      pill: '2개 안내',
                      icon: Headphones,
                      tone: 'text-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-500/20 dark:text-blue-300',
                    },
                    {
                      key: 'finance-freed' as QuickConsultationGroupKey,
                      title: '무이자 · 제휴카드 · 프리드',
                      sub: '이달의 무이자 · QR발급 · 상품요약',
                      pill: '3개 혜택',
                      icon: Percent,
                      tone: 'text-[#E60012] bg-[#FFF1F2] dark:bg-rose-500/20 dark:text-rose-300',
                    },
                    ...(!isFriendMode
                      ? [
                          {
                            key: 'landing-links' as QuickConsultationGroupKey,
                            title: '내 랜딩페이지',
                            sub: '구독 랜딩 · 매장 랜딩 · 구독 관리자',
                            pill: '3개 링크',
                            icon: Globe,
                            tone: 'text-[#191F28] bg-[#F2F4F6] dark:bg-white/15 dark:text-slate-100',
                          },
                        ]
                      : []),
                  ].map((tile) => {
                    const IconComp = tile.icon;
                    return (
                      <button
                        key={tile.key}
                        type="button"
                        onClick={() => setActiveQuickGroup(tile.key)}
                        className={`p-4 rounded-2xl border text-left flex flex-row min-[380px]:flex-col items-center min-[380px]:items-stretch justify-between gap-3 transition cursor-pointer schedule-tactile ${
                          isDark
                            ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-white/10 hover:border-[#60A5FA]/50'
                            : 'bg-[#F8FAFC] hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB] hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2.5 min-[380px]:w-full">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tile.tone}`}>
                            <IconComp className="w-4 h-4" />
                          </span>
                          <div className="min-[380px]:hidden min-w-0">
                            <div className="text-[13.5px] font-extrabold break-keep leading-snug">
                              {tile.title}
                            </div>
                            <div className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium mt-0.5">
                              {tile.sub}
                            </div>
                          </div>
                          <div className="hidden min-[380px]:flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-white/10 text-[11px] font-bold text-[#4E5968] dark:text-slate-300">
                              {tile.pill}
                            </span>
                            <ChevronRight className="w-4 h-4 text-[#8B95A1]" />
                          </div>
                        </div>
                        <div className="hidden min-[380px]:block">
                          <div className="text-sm sm:text-[15px] font-extrabold break-keep leading-snug">
                            {tile.title}
                          </div>
                          <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-1 break-keep">
                            {tile.sub}
                          </div>
                        </div>
                        <ChevronRight className="min-[380px]:hidden w-4 h-4 text-[#8B95A1] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </main>
      )}

      {/* ==================== 4대 통합 메뉴 간편 선택 팝업 (올케어·보험 / AS·안마의자 / 무이자·카드·프리드 / 내 랜딩페이지) ==================== */}
      {activeQuickGroup && (
        <div className="no-print">
          <FlagshipModalShell
            isOpen={Boolean(activeQuickGroup)}
            onClose={() => setActiveQuickGroup(null)}
            title={
              activeQuickGroup === 'care-insurance'
                ? '올케어 · 보험접수'
                : activeQuickGroup === 'as-massage'
                ? '가전 AS · 안마의자 설치'
                : activeQuickGroup === 'finance-freed'
                ? '무이자 · 제휴카드 · 프리드'
                : '내 랜딩페이지 바로가기'
            }
            subtitle={
              activeQuickGroup === 'landing-links'
                ? '터치 시 새 창으로 열리며 우측에서 주소 복사도 가능합니다'
                : '확인하실 안내 항목을 선택해 주세요'
            }
            badge={activeQuickGroup === 'landing-links' ? '외부 링크' : '바로 선택'}
            icon={
              activeQuickGroup === 'care-insurance' ? (
                <ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-300" />
              ) : activeQuickGroup === 'as-massage' ? (
                <Headphones className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
              ) : activeQuickGroup === 'finance-freed' ? (
                <Percent className="w-4 h-4 text-[#E60012] dark:text-rose-400" />
              ) : (
                <Globe className="w-4 h-4 text-[#191F28] dark:text-slate-100" />
              )
            }
            maxWidthClass="max-w-md"
            bodyClassName="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto flex-1 bg-[#F2F4F6] dark:bg-[#0B1120]"
          >
            {activeQuickGroup === 'care-insurance' &&
              [
                {
                  title: '가전 올케어 안내',
                  sub: '34종 사용 가전 연장보증 품목 · 카톡 안내문 복사',
                  icon: Wrench,
                  tone: 'text-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-500/20 dark:text-blue-300',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    navigateToStep('allcare-guide');
                  },
                },
                {
                  title: '보험 청구 · 접수 안내',
                  sub: '연장보증 · 파손보험 구비서류 및 접수처 확인',
                  icon: ShieldCheck,
                  tone: 'text-[#059669] bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-300',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    navigateToStep('insurance');
                  },
                },
              ].map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={opt.onClick}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] dark:hover:border-[#60A5FA] text-left flex items-center justify-between gap-3 transition cursor-pointer schedule-tactile"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.tone}`}>
                        <OptIcon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                          {opt.title}
                        </div>
                        <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0" />
                  </button>
                );
              })}

            {activeQuickGroup === 'as-massage' &&
              [
                {
                  title: '가전 AS센터 연락처',
                  sub: '삼성 · LG · PLUX 등 제조사 서비스센터 전화 · 복사',
                  icon: Headphones,
                  tone: 'text-[#4E5968] bg-[#F2F4F6] dark:bg-white/10 dark:text-slate-200',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    pushAppHistoryGuard('open-as-center');
                    setIsAsCenterOpen(true);
                  },
                },
                {
                  title: '안마의자 설치 안내',
                  sub: '코지마 · 세라젬 · 바디프랜드 등 폐가전회수 · 사다리차 기준',
                  icon: Truck,
                  tone: 'text-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-500/20 dark:text-blue-300',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    openStorePolicyModal('massage');
                  },
                },
              ].map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={opt.onClick}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] dark:hover:border-[#60A5FA] text-left flex items-center justify-between gap-3 transition cursor-pointer schedule-tactile"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.tone}`}>
                        <OptIcon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                          {opt.title}
                        </div>
                        <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0" />
                  </button>
                );
              })}

            {activeQuickGroup === 'finance-freed' &&
              [
                {
                  title: '무이자 할부 보기',
                  sub: '이달의 카드사별 무이자 · 부분무이자 개월수 조견표',
                  icon: Percent,
                  tone: 'text-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-500/20 dark:text-blue-300',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    pushAppHistoryGuard('open-installment');
                    setIsInstallmentModalOpen(true);
                  },
                },
                {
                  title: '제휴카드 발급 보기',
                  sub: '롯데 · 신한 등 제휴카드 간편 발급 QR코드 · 링크',
                  icon: QrCode,
                  tone: 'text-[#191F28] bg-[#F2F4F6] dark:bg-white/10 dark:text-slate-200',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    pushAppHistoryGuard('open-card-issue');
                    setIsCardIssueOpen(true);
                  },
                },
                {
                  title: '프리드 상품 요약 보기',
                  sub: '일반 · Hi구독플러스 · Hi웅진플랜 운영 상품 요약표',
                  icon: BookOpen,
                  tone: 'text-[#E60012] bg-[#FFF1F2] dark:bg-rose-500/20 dark:text-rose-300',
                  onClick: () => {
                    setActiveQuickGroup(null);
                    openStorePolicyModal('freed');
                  },
                },
              ].map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={opt.onClick}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] dark:hover:border-[#60A5FA] text-left flex items-center justify-between gap-3 transition cursor-pointer schedule-tactile"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.tone}`}>
                        <OptIcon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                          {opt.title}
                        </div>
                        <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0" />
                  </button>
                );
              })}

            {activeQuickGroup === 'landing-links' &&
              OFFICIAL_LANDING_LINKS.map((item) => {
                const isCopied = copiedLandingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] dark:hover:border-[#60A5FA] flex items-center justify-between gap-2.5 transition"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        window.open(item.url, '_blank', 'noopener,noreferrer');
                        setActiveQuickGroup(null);
                      }}
                      className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer"
                    >
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          item.isStaff
                            ? 'bg-[#FFF1F2] text-[#E60012] dark:bg-rose-500/20 dark:text-rose-300'
                            : 'bg-[#EFF6FF] text-[#1B64DA] dark:bg-blue-500/20 dark:text-blue-300'
                        }`}
                      >
                        {item.isStaff ? <Settings className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                            {item.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                              item.isStaff
                                ? 'bg-[#FFF1F2] text-[#E60012] dark:bg-rose-500/15 dark:text-rose-300'
                                : 'bg-[#EFF6FF] text-[#1B64DA] dark:bg-blue-500/15 dark:text-blue-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                          {item.sub}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyLandingUrl(item)}
                        title="주소 복사"
                        className="h-9 px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#D1D6DB] dark:border-slate-700 text-xs font-bold text-[#191F28] dark:text-slate-100 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#059669]" />
                            <span>복사됨</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#4E5968] dark:text-slate-300" />
                            <span>복사</span>
                          </>
                        )}
                      </button>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setActiveQuickGroup(null)}
                        title={`${item.title} 새 창 열기`}
                        className="h-9 px-3 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] hover:opacity-90 text-white dark:text-[#0B1120] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>열기</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  </div>
                );
              })}
          </FlagshipModalShell>
        </div>
      )}
    </>
  );
};
