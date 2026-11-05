import React from 'react';
import { AppStep } from '../types/proposal';
import { ScheduleCharacterBanner } from './ScheduleCharacterBanner';
import { ArrowLeft, Calculator, Calendar, CreditCard, Download, FileSpreadsheet, Home, Layers, Menu, Printer, RefreshCw, ShieldCheck, Smartphone, Users, ChevronRight, Moon, Sun, Database, Lock, Search, WifiOff, Wrench, X } from 'lucide-react';

function getStepShortLabel(s: AppStep): string {
  switch (s) {
    case 'home':
      return '홈';
    case 'crm':
      return '통합고객관리';
    case 'marketing-db':
      return '인스타DB';
    case 'input':
      return '견적서';
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
  isMenuOpen,
  isOnline,
  isOwnerDbUnlocked,
  isStandalone,
  menuContainerRef,
  navigateToStep,
  ownerDbQuickSummary,
  pendingCount,
  pushAppHistoryGuard,
  setInitialCrmTab,
  setIsAiCommandModalOpen,
  setIsAsCenterOpen,
  setIsCardIssueOpen,
  setIsInstallmentModalOpen,
  setIsMenuOpen,
  setIsOmnibarOpen,
  setIsPartnerLinksOpen,
  setIsScheduleModalOpen,
  step,
  toggleUiTheme,
  unconfirmedLogisticsCountHome,
  unpaidGiftCountHome,
  urgentCount,
}) => {
  return (
    <>
      {/* ==================== 상단 글로벌 네비게이션 바 (Warm Ivory / Titanium Dark 전환 스위치 & 전체메뉴) ==================== */}
      <header
        className={`safe-top-header w-full min-h-[52px] border-b px-3 sm:px-5 py-2 flex items-center justify-between gap-2 sticky top-0 z-40 backdrop-blur-md transition-colors no-print ${
          isDark
            ? 'bg-[#121620]/95 text-white border-white/10'
            : 'bg-[#FAF8F4]/95 text-[#18181B] border-[#E2DDD3]'
        }`}
      >
        {/* 좌측: [홈] + [휴무표] + [검색] + [AI 비서] (모바일 겹침 방지 스크롤 가드 적용) */}
        <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={handleHomeButtonClick}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 transition cursor-pointer ${
              step === 'home'
                ? isDark
                  ? 'bg-[#38BDF8] text-[#0B0E14] shadow-xs'
                  : 'bg-[#18181B] text-white shadow-xs'
                : isDark
                ? 'bg-[#1B2230] text-slate-200 hover:bg-[#232C3D] border border-white/10'
                : 'bg-white text-[#18181B] hover:bg-[#EAE5DC] border border-[#D6D3CD]'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">홈</span>
          </button>

          {step !== 'home' && (
            <button
              type="button"
              onClick={handleNavigateBack}
              title={`직전 화면(${backButtonLabel})으로 바로 돌아가기`}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 border transition cursor-pointer ${
                isDark
                  ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-400/35'
                  : 'bg-[#F4ECE1] hover:bg-[#EAE0D0] text-[#6E4423] border-[#D8C6AA]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backButtonLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              pushAppHistoryGuard('open-schedule');
              setIsScheduleModalOpen(true);
            }}
            title="경기광주점 오늘 근무자 및 월별 휴무표 보기"
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 border transition cursor-pointer ${
              isDark
                ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#8C5A32]" />
            <span>휴무표</span>
          </button>

          <button
            type="button"
            onClick={() => {
              pushAppHistoryGuard('open-omnibar');
              setIsOmnibarOpen(true);
            }}
            title="고객·안심케어·무이자·AS·근무자 0.01초 통합검색 (Ctrl+K)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 border transition cursor-pointer ${
              isDark
                ? 'bg-[#1B2230] hover:bg-[#232C3D] text-sky-300 border-sky-400/30'
                : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">통합검색</span>
            <span className="sm:hidden">검색</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono opacity-65 bg-black/5">
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
            className="relative z-10 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white shadow-xs transition cursor-pointer"
          >
            <span>✦ AI 비서</span>
          </button>

          {(!isOnline || pendingCount > 0) && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-600 border border-amber-400/40 text-[11px] font-black shrink-0"
              title="인터넷 연결이 복구되면 오프라인 저장 내역이 자동 동기화됩니다"
            >
              <WifiOff className="w-3 h-3" />
              <span>
                {!isOnline ? '오프라인 안전모드' : `동기화 대기 ${pendingCount}건`}
              </span>
            </span>
          )}

          <span
            className={`hidden lg:inline-block px-3 py-1 rounded-full text-xs font-extrabold truncate border ${
              isDark
                ? 'bg-[#1B2230] border-white/10 text-slate-300'
                : 'bg-[#EAE5DC]/70 border-[#D6D3CD] text-[#57534E]'
            }`}
          >
            {currentScreenBadgeLabel}
          </span>
        </div>

        {/* 우측: [☀️ 웜아이보리 / 🌙 다크] 테마 전환 스위치 + 앱 설치 + [☰ 전체메뉴] */}
        <div
          ref={menuContainerRef}
          className="relative flex items-center gap-1.5 sm:gap-2 shrink-0"
        >
          {/* 1-Click 테마 전환 스위치 */}
          <button
            type="button"
            onClick={toggleUiTheme}
            title={
              isDark
                ? '웜 아이보리(라이트 모드)로 전환'
                : '티타늄 다크(다크 모드)로 전환'
            }
            className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              isDark
                ? 'bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border-[#38BDF8]/40'
                : 'bg-[#EAE5DC] hover:bg-[#DFD9CE] text-[#57534E] border-[#D4CDC0]'
            }`}
          >
            {isDark ? (
              <>
                <Moon className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="hidden xs:inline">다크 모드</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[#8C5A32]" />
                <span className="hidden xs:inline">웜 아이보리</span>
              </>
            )}
          </button>

          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallAppClick}
              title="홈 화면에 앱으로 설치하여 주소창 없이 실행"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition cursor-pointer ${
                isDark
                  ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                  : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D3CD]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">앱 설치</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => {
                if (!prev) pushAppHistoryGuard('open-menu');
                return !prev;
              });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              isMenuOpen
                ? isDark
                  ? 'bg-[#38BDF8] border-[#38BDF8] text-[#0B0E14]'
                  : 'bg-[#18181B] border-[#18181B] text-white'
                : isDark
                ? 'bg-[#1B2230] hover:bg-[#232C3D] border-white/10 text-white'
                : 'bg-white hover:bg-[#EAE5DC] border-[#D6D3CD] text-[#18181B]'
            }`}
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
            <span>전체메뉴</span>
            {urgentCount >= 1 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                {urgentCount}
              </span>
            )}
          </button>

          {/* [☰ 전체메뉴] 벤토 카드형 드롭다운 메뉴판 */}
          {isMenuOpen && (
            <div
              className={`fixed left-2.5 right-2.5 top-[58px] w-auto max-h-[calc(100dvh-70px)] overflow-y-auto sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[395px] sm:max-h-none rounded-3xl border shadow-2xl p-3.5 space-y-2.5 z-50 ${
                isDark
                  ? 'bg-[#141924] border-white/15 text-white'
                  : 'bg-[#FAF8F4] border-[#D6D3CD] text-[#18181B]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setInitialCrmTab(undefined);
                  navigateToStep('crm');
                }}
                className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between border transition cursor-pointer ${
                  isDark
                    ? 'bg-gradient-to-r from-[#172542] to-[#0F172A] text-white border-[#38BDF8]/40 hover:border-[#38BDF8]'
                    : 'bg-[#1C1917] hover:bg-[#292524] text-white border-[#1C1917]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>VIP 통합 고객관리 (CRM)</span>
                </span>
                {urgentCount >= 1 ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black">
                    긴급 {urgentCount}건
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 opacity-75" />
                )}
              </button>

              {isOwnerDbUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigateToStep('marketing-db');
                  }}
                  className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs flex items-center justify-between border transition cursor-pointer ${
                    step === 'marketing-db'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : isDark
                      ? 'bg-gradient-to-r from-violet-950/80 to-indigo-950/70 text-amber-200 border-amber-400/40 hover:border-amber-300'
                      : 'bg-gradient-to-r from-[#2E1065] to-[#1E1B4B] text-white border-indigo-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-amber-300" />
                    <span>인스타 마케팅 DB관리 (국지현 전용)</span>
                  </span>
                  {ownerDbQuickSummary.newCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                      신규 {ownerDbQuickSummary.newCount}건
                    </span>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                  )}
                </button>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('general');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'general'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">01. 일반 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('subscription');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'subscription'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">02. 구독 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleEnterMode('hybrid');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      (step === 'input' || step === 'proposal') &&
                      activeMode === 'hybrid'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">03. 혼합 견적</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigateToStep('lotte-plan');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'lotte-plan'
                        ? 'bg-violet-600 text-white border-violet-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="truncate">04. 플랜 계산기</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigateToStep('pop-printer');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'pop-printer'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">05. 구독 POP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigateToStep('himobile');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'himobile'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="truncate">06. 하이 모바일</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigateToStep('allcare-guide');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'allcare-guide'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="truncate">07. 가전 올케어</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigateToStep('insurance');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-black flex items-center gap-2 border transition cursor-pointer ${
                      step === 'insurance'
                        ? 'bg-teal-600 text-white border-teal-500'
                        : isDark
                        ? 'bg-[#1B2230] hover:bg-[#232C3D] text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="truncate">08. 보험 청구안내</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigateToStep('care-table');
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                  isDark
                    ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-[#34D399]/40'
                    : 'bg-white hover:bg-[#F4ECE1] text-[#18181B] border-[#8C5A32]'
                }`}
              >
                <span className="flex items-center gap-2 shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#8C5A32]" />
                  <span>안심케어 · 가전이사 조견표</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold truncate ${
                    isDark
                      ? 'bg-[#34D399]/15 text-[#34D399]'
                      : 'bg-[#F4ECE1] text-[#8C5A32]'
                  }`}
                >
                  {careUpdateMonthBadge}
                </span>
              </button>

              <div
                className={`pt-2 border-t space-y-1.5 ${
                  isDark ? 'border-white/10' : 'border-[#E4DFD5]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-ai-command');
                    setIsAiCommandModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black text-center flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>✦ AI 비서 (한 줄 견적 · 고객관리 자동등록)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    pushAppHistoryGuard('open-partner-links');
                    setIsPartnerLinksOpen(true);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-amber-300 border-amber-400/30'
                      : 'bg-[#FAF6EE] hover:bg-[#F2E9D8] text-[#6E4423] border-[#D8C6AA]'
                  }`}
                >
                  <span>🔗 제휴 · 업무 바로가기 허브</span>
                  <span className="text-[10px] font-bold opacity-80">
                    입주 · 중고 · 수당 · 청약
                  </span>
                </button>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-installment');
                      setIsInstallmentModalOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-amber-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
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
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-sky-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
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
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-emerald-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    AS센터
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      pushAppHistoryGuard('open-schedule');
                      setIsScheduleModalOpen(true);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black text-center truncate border cursor-pointer ${
                      isDark
                        ? 'bg-[#1B2230] text-indigo-300 border-white/10'
                        : 'bg-white text-[#18181B] border-[#E4DFD5]'
                    }`}
                  >
                    휴무표
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ==================== STEP 0: 3대 업무 그룹형 커맨드 센터 메인 홈 ==================== */}
      {step === 'home' && (
        <main className="flex-1 w-full flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl flex flex-col gap-3 sm:gap-3.5">
            {/* 0-1) 최상단 내 휴무 카운트다운 배너 + 이번 달 수당 적립 요약 */}
            <ScheduleCharacterBanner
              isDark={isDark}
              customers={activeCrmCustomers}
              onOpenScheduleModal={() => {
                pushAppHistoryGuard('open-schedule');
                setIsScheduleModalOpen(true);
              }}
              onOpenIncentiveTab={(targetTab) => {
                setInitialCrmTab(targetTab);
                navigateToStep('crm');
              }}
            />

            {/* 0-2) TODAY BRIEFING · VIP 통합 고객관리 히어로 배너 */}
            <button
              type="button"
              onClick={() => { setInitialCrmTab(undefined); navigateToStep('crm'); }}
              className={`w-full py-3.5 sm:py-5 px-4 sm:px-6 rounded-3xl transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2 group cursor-pointer shadow-md hover:shadow-xl ${
                isDark
                  ? 'bg-gradient-to-r from-[#172542] to-[#0F172A] text-white border-[1.5px] border-[#38BDF8]/45 hover:border-[#38BDF8]'
                  : 'bg-[#18181B] hover:bg-[#27272A] text-white border border-[#18181B]'
              }`}
            >
              <div className="text-left min-w-0">
                <div className="text-[11px] sm:text-xs font-extrabold tracking-wider text-[#38BDF8] uppercase">
                  TODAY BRIEFING · 전체 관리 고객 {activeCrmCustomers.length}명
                </div>
                <div className="text-sm sm:text-xl font-black tracking-tight sm:truncate leading-snug mt-0.5">
                  긴급 할일 {urgentCount}건 · 물류대기 {unconfirmedLogisticsCountHome}건 · 사은품 미지급 {unpaidGiftCountHome}건
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:ml-2">
                {urgentCount >= 1 ? (
                  <span className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-2xl sm:rounded-full bg-rose-600 text-white text-xs sm:text-sm font-black animate-pulse shadow-xs">
                    VIP 고객관리 열기 ➔
                  </span>
                ) : (
                  <span className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-2xl sm:rounded-full bg-[#38BDF8] text-[#0B0E14] text-xs sm:text-sm font-black shadow-xs">
                    VIP 고객관리 열기 ➔
                  </span>
                )}
              </div>
            </button>

            {/* 0-3) 국지현 전용 비공개 인스타 마케팅 DB관리 배너 (타 직원 기기 노출 0%) */}
            {isOwnerDbUnlocked && (
              <button
                type="button"
                onClick={() => navigateToStep('marketing-db')}
                className={`w-full py-3.5 px-4 sm:px-5 rounded-3xl transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 cursor-pointer shadow-sm hover:shadow-lg border-[1.5px] ${
                  isDark
                    ? 'bg-gradient-to-r from-[#1E1B4B] via-[#172036] to-[#142628] text-white border-amber-400/45 hover:border-amber-300'
                    : 'bg-gradient-to-r from-[#FAF5FF] via-white to-[#ECFDF5] text-[#18181B] border-indigo-300 hover:border-indigo-500'
                }`}
              >
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black text-indigo-600 dark:text-amber-300">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>PRIVATE · 인스타 광고 전용 DB관리 (나만 보기)</span>
                  </div>
                  <div className="text-xs sm:text-sm font-black mt-0.5 truncate">
                    전체 DB {ownerDbQuickSummary.totalActive}명 · 신규{' '}
                    <span className="text-rose-500">
                      {ownerDbQuickSummary.newCount}건
                    </span>{' '}
                    · 인계중{' '}
                    <span className="text-amber-600 dark:text-amber-300">
                      {ownerDbQuickSummary.handoverTabCount}건
                    </span>{' '}
                    · 당월 DB 총매출{' '}
                    <span className="text-emerald-600 dark:text-emerald-300 font-mono">
                      {ownerDbQuickSummary.monthRevenue.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-2xl sm:rounded-full bg-indigo-600 text-white text-xs font-black text-center shrink-0">
                  DB관리 열기 ➔
                </span>
              </button>
            )}

            {/* STEP 01 · 맞춤 견적 & 카드 혜택 설계 (4종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-[#38BDF8]' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 01 · 맞춤 견적 & 카드 혜택 설계
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isDark ? 'text-slate-400' : 'text-[#78716C]'
                  }`}
                >
                  AI 사진스캔 지원
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleEnterMode('general')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-sky-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    일반 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    즉시할인+프리드
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('subscription')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-rose-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    구독 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    36/60개월 구독
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleEnterMode('hybrid')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                    isDark
                      ? 'bg-[#1D2536] hover:bg-[#253047] text-white border border-indigo-400/35'
                      : 'bg-[#18181B] hover:bg-[#292524] text-white'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    혼합 견적
                  </div>
                  <div className="text-[11px] font-bold text-[#38BDF8]">
                    일반+구독 통합
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToStep('lotte-plan')}
                  className={`p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-sm sm:text-base font-black tracking-tight">
                    플랜 계산기
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    최대 -108만 할인
                  </div>
                </button>
              </div>
            </section>

            {/* STEP 02 · 매장 POP 출력 & 안심케어 조견표 (2종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-[#34D399]' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 02 · 매장 POP 출력 & 케어 조견표
                </span>
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    isDark
                      ? 'bg-[#34D399]/15 text-[#34D399]'
                      : 'bg-[#F4ECE1] text-[#8C5A32]'
                  }`}
                >
                  {careUpdateMonthBadge}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => navigateToStep('pop-printer')}
                  className={`p-4 rounded-2xl text-left flex items-center justify-between border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-black truncate">
                      구독 POP 자동 출력기
                    </div>
                    <div
                      className={`text-xs font-medium truncate mt-0.5 ${
                        isDark ? 'text-slate-400' : 'text-[#78716C]'
                      }`}
                    >
                      견적 사진 스캔 · A4 2-UP 쇼카드
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToStep('care-table')}
                  className={`p-4 rounded-2xl text-left flex items-center justify-between border-[1.5px] transition cursor-pointer ${
                    isDark
                      ? 'bg-[#16222F] hover:bg-[#1D2D3E] text-white border-[#34D399]/45'
                      : 'bg-[#FCF9F5] hover:bg-[#F4ECE1] text-[#18181B] border-[#8C5A32]'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-sm sm:text-base font-black truncate ${
                        isDark ? 'text-[#34D399]' : 'text-[#8C5A32]'
                      }`}
                    >
                      안심케어 · 가전이사 조견표
                    </div>
                    <div
                      className={`text-xs font-medium truncate mt-0.5 ${
                        isDark ? 'text-slate-300' : 'text-[#57534E]'
                      }`}
                    >
                      품목별 클리닝·이전설치 금액 복사
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8C5A32] shrink-0 ml-2" />
                </button>
              </div>
            </section>

            {/* STEP 03 · 고객 안내 가이드 & 즉시 조회 (6종) */}
            <section
              className={`rounded-3xl border-[1.5px] p-4 sm:p-5 shadow-2xs flex flex-col gap-3 ${
                isDark
                  ? 'bg-[#141923] border-white/10'
                  : 'bg-white border-[#E4DFD5]'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight ${
                    isDark ? 'text-slate-200' : 'text-[#8C5A32]'
                  }`}
                >
                  STEP 03 · 고객 안내 가이드 & 즉시 조회
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isDark ? 'text-slate-400' : 'text-[#78716C]'
                  }`}
                >
                  터치 시 즉시 열림
                </span>
              </div>

              {/* 아이디어 1: 6대 제휴·업무 바로가기 통합 허브 배너 버튼 */}
              <button
                type="button"
                onClick={() => {
                  pushAppHistoryGuard('open-partner-links');
                  setIsPartnerLinksOpen(true);
                }}
                className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer active:scale-[0.99] ${
                  isDark
                    ? 'bg-gradient-to-r from-[#1A2336] via-[#1E293B] to-[#1A2336] hover:border-amber-400/50 border-amber-400/25 text-white'
                    : 'bg-gradient-to-r from-[#FAF5EB] via-[#F5ECE0] to-[#FAF5EB] hover:border-[#8C5A32] border-[#DCCBB2] text-[#18181B]'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black tracking-tight">
                      🔗 제휴 · 업무 바로가기 허브
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isDark
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-[#8C5A32] text-white'
                      }`}
                    >
                      6대 포털 · QR · 안내문 복사
                    </span>
                  </div>
                  <div
                    className={`text-[11px] font-semibold truncate ${
                      isDark ? 'text-slate-300' : 'text-[#685D52]'
                    }`}
                  >
                    방충망 · 크린토피아 입주청소 · 중고보상/중고몰 · 하이프리드 수당 · SK인터넷 청약
                  </div>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 ${
                    isDark
                      ? 'bg-white/10 text-amber-300'
                      : 'bg-[#18181B] text-white'
                  }`}
                >
                  열기 →
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => navigateToStep('allcare-guide')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    가전 올케어
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    34종 2년 보증
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToStep('insurance')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    보험 청구안내
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    구비서류 안내
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToStep('himobile')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-white border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black truncate">
                    하이 모바일
                  </div>
                  <div
                    className={`text-[10.5px] font-medium truncate ${
                      isDark ? 'text-slate-400' : 'text-[#78716C]'
                    }`}
                  >
                    알뜰유심 개통
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-installment');
                    setIsInstallmentModalOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-amber-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">무이자 할부</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-card-issue');
                    setIsCardIssueOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-sky-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="truncate">제휴카드 발급</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    pushAppHistoryGuard('open-as-center');
                    setIsAsCenterOpen(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl border text-center flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm transition cursor-pointer ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#232C3D] text-emerald-300 border-white/10'
                      : 'bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#18181B] border-[#E4DFD5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span className="truncate">가전 AS센터</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      )}
    </>
  );
};
