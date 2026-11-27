import { HomeWorkspaceMainSection } from './HomeWorkspaceMainSection';
import { HomeQuickGroupModal } from './HomeQuickGroupModal';
import React, { useEffect, useRef, useState } from 'react';
import { AppStep } from '../types/proposal';
import { ViewportSafePopover } from './ui/ViewportSafePopover';
import { openStorePolicyModal } from './StorePolicyGuideView';
import { ArrowLeft, BookOpen, Calculator, Calendar, ChevronRight, CreditCard, Database, Download, FileSpreadsheet, Globe, Home, Layers, Menu, Moon, Printer, RefreshCw, Search, Settings, ShieldCheck, Smartphone, Sparkles, Sun, Truck, Users, WifiOff, Wrench, X } from 'lucide-react';
import { CONSULTANT_PROFILE_UPDATED_EVENT, getShortBranchLabel } from '../utils/shareQuoteCodec';
import { getOwnerDbDriveFolderUrl, getOwnerReservationDbSheetSpecs } from '../utils/ownerDbSheetLinks';
export type QuickConsultationGroupKey = 'care-insurance' | 'as-massage' | 'finance-freed' | 'landing-links';
export interface OfficialLandingLinkSpec {
 id: string; title: string; sub: string; badge: string; isStaff?: boolean; url: string;
}
export const OFFICIAL_LANDING_LINKS: OfficialLandingLinkSpec[] = [
 { id: 'sub-landing', title: '구독 랜딩페이지', sub: '가전구독 × 구독플러스 맞춤 혜택 시뮬레이터', badge: '고객 안내', url: 'https://himart-gj.github.io/himart-subscription-simulator/#/' },
 { id: 'store-landing', title: '일반 매장랜딩페이지', sub: '경기광주점 A·B동 쇼룸 & 1:1 통합 상담 예약', badge: '고객 안내', url: 'https://himart-gj.github.io/himart-11/' },
 { id: 'sub-admin', title: '구독페이지 관리자페이지', sub: '구독 품목 · 추천세트 · 정책 관리 CMS', badge: '관리자 전용', isStaff: true, url: 'https://himart-gj.github.io/himart-subscription-simulator/#/admin' },
];
export function getStepShortLabel(s: AppStep): string {
 switch (s) {
  case 'home': return '홈'; case 'crm': return '고객관리'; case 'marketing-db': return '인스타DB';
  case 'input': return '견적설계'; case 'proposal': return '제안서'; case 'care-table': return '조견표';
  case 'lotte-plan': return '플랜계산기'; case 'pop-printer': return '구독POP'; case 'himobile': return '하이모바일';
  case 'allcare-guide': return '올케어'; case 'insurance': return '보험안내'; default: return '홈';
 }
}
export const AppHeaderAndHome: React.FC<Record<string, any>> = ({ activeCrmCustomers, metricsCrmCustomers, canViewSchedule: canViewScheduleProp, activeMode, backButtonLabel, careUpdateMonthBadge, currentScreenBadgeLabel, handleEnterMode, handleHomeButtonClick, handleInstallAppClick, handleNavigateBack, isDark, isFriendMode = false, isMenuOpen, isOnline, isOwnerDbUnlocked, isStandalone, menuContainerRef, navigateToStep, ownerDbQuickSummary, pendingCount, pushAppHistoryGuard, setInitialCrmFilterTab, setInitialCrmTab, setIsAiCommandModalOpen, setIsAsCenterOpen, setIsCardIssueOpen, setIsInstallmentModalOpen, setIsMenuOpen, setIsOmnibarOpen, setIsPartnerLinksOpen, setIsScheduleModalOpen, setIsUploadHubOpen, step, toggleUiTheme, unconfirmedLogisticsCountHome, unpaidGiftCountHome, urgentCount }) => {
 const headerRef = useRef<HTMLElement>(null);
 const menuBtnRef = useRef<HTMLButtonElement>(null);
 const canViewSchedule = typeof canViewScheduleProp === 'boolean' ? canViewScheduleProp : !isFriendMode;
 const [activeQuickGroup, setActiveQuickGroup] = useState<QuickConsultationGroupKey | null>(null);
 const [landingMenuSection, setLandingMenuSection] = useState<'select' | 'landing' | 'db-sheets'>('select');
 const [copiedLandingId, setCopiedLandingId] = useState<string | null>(null);
 const [, setHeaderProfileTick] = useState(0);
 const ownerDbSheetSpecs = getOwnerReservationDbSheetSpecs(Boolean(isOwnerDbUnlocked), Boolean(isFriendMode));
 const ownerDbFolderUrl = getOwnerDbDriveFolderUrl(Boolean(isOwnerDbUnlocked), Boolean(isFriendMode));
 useEffect(() => {
  const onProf = () => setHeaderProfileTick((v) => v + 1);
  window.addEventListener(CONSULTANT_PROFILE_UPDATED_EVENT, onProf);
  return () => window.removeEventListener(CONSULTANT_PROFILE_UPDATED_EVENT, onProf);
 }, []);
 const headerBranchLabel = getShortBranchLabel();
 useEffect(() => {
  if (!activeQuickGroup) return;
  try { window.history.pushState({ appGuard: true, tag: 'quick-group-modal' }, ''); } catch {}
  const myHandler = (): boolean => {
   if (activeQuickGroup === 'landing-links' && landingMenuSection !== 'select') { setLandingMenuSection('select'); return true; }
   setActiveQuickGroup(null); return true;
  };
  const prevHandler = (window as any).__modalInternalBackHandler;
  (window as any).__modalInternalBackHandler = myHandler;
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveQuickGroup(null); };
  window.addEventListener('keydown', onKeyDown);
  return () => {
   window.removeEventListener('keydown', onKeyDown);
   if ((window as any).__modalInternalBackHandler === myHandler) (window as any).__modalInternalBackHandler = prevHandler;
  };
 }, [activeQuickGroup, landingMenuSection]);
 const handleCopyLandingUrl = async (item: { id: string; url: string }) => {
  try { await navigator.clipboard.writeText(item.url); } catch {
   const ta = document.createElement('textarea'); ta.value = item.url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  setCopiedLandingId(item.id);
  window.setTimeout(() => setCopiedLandingId((prev) => (prev === item.id ? null : prev)), 1800);
 };
 useEffect(() => {
  const el = headerRef.current;
  if (!el || typeof document === 'undefined') return;
  const syncHeight = () => document.documentElement.style.setProperty('--app-header-h', `${Math.max(48, Math.round(el.getBoundingClientRect().height))}px`);
  syncHeight();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeight) : null;
  ro?.observe(el);
  window.addEventListener('resize', syncHeight);
  return () => { ro?.disconnect(); window.removeEventListener('resize', syncHeight); };
 }, []);
 const surfaceBtn = isDark ? 'bg-[#1E293B] hover:bg-[#273549] text-slate-100 border-white/10' : 'bg-white hover:bg-[#F2F4F6] text-[#191F28] border-[#E5E8EB]';
 return (
  <>
   <header ref={headerRef} className={`safe-top-header w-full min-h-[54px] border-t-[3px] border-t-[#E60012] border-b px-2.5 sm:px-5 py-2 flex items-center justify-between gap-1.5 sm:gap-2 sticky top-0 z-40 backdrop-blur-md transition-colors no-print ${isDark ? 'bg-[#0B1120]/95 text-[#F8FAFC] border-b-white/10' : 'bg-white/95 text-[#191F28] border-b-[#E5E8EB] shadow-[0_1px_8px_rgba(25,31,40,0.03)]'}`}>
    <div className="flex items-center gap-1 min-[380px]:gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
     <button type="button" onClick={handleHomeButtonClick} title="홈으로 이동" aria-label="홈으로 이동" className={`h-8 min-[380px]:h-9 ${step !== 'home' ? 'w-8 min-[380px]:w-9 min-[460px]:w-auto min-[460px]:px-2.5 sm:px-3.5 justify-center' : 'px-2.5 sm:px-3.5'} rounded-xl text-xs font-extrabold flex items-center gap-1.5 sm:gap-2 shrink-0 transition cursor-pointer schedule-tactile border ${step === 'home' ? (isDark ? 'bg-[#1E293B] text-white border-white/15' : 'bg-[#191F28] text-white border-[#191F28]') : surfaceBtn}`}>
      <span className={`${step !== 'home' ? 'hidden min-[460px]:inline-block' : 'inline-block'} px-1.5 py-0.5 rounded bg-[#E60012] text-white text-[11.5px] font-black tracking-tight leading-none shrink-0`}>HIMART</span>
      <Home className={`w-4 h-4 ${step !== 'home' ? 'min-[460px]:hidden text-[#E60012]' : 'sm:hidden'}`}/>
      {headerBranchLabel && (<span className={`${step !== 'home' ? 'hidden lg:inline' : 'hidden sm:inline'} tracking-tight font-extrabold whitespace-nowrap`}>{headerBranchLabel}</span>)}
     </button>
     {step !== 'home' && (<button type="button" onClick={handleNavigateBack} title={`직전 화면(${backButtonLabel})으로 돌아가기`} className={`h-8 min-[380px]:h-9 px-2 sm:px-3 rounded-xl text-[11.5px] min-[380px]:text-xs font-bold flex items-center gap-1 min-w-0 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}><ArrowLeft className="w-3.5 h-3.5 shrink-0 text-[#1B64DA] dark:text-[#60A5FA]"/><span className="truncate">{backButtonLabel}</span></button>)}
     {step !== 'home' && currentScreenBadgeLabel && (<span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 truncate min-w-0">{currentScreenBadgeLabel}</span>)}
     {(!isOnline || pendingCount > 0) && (<span className={`${step !== 'home' ? 'hidden xl:inline-flex' : 'inline-flex'} items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11.5px] font-bold shrink-0`}><WifiOff className="w-3 h-3"/><span className="hidden lg:inline">{!isOnline ? '오프라인' : `대기 ${pendingCount}`}</span></span>)}
    </div>
    <div ref={menuContainerRef} className="relative flex items-center gap-1 sm:gap-1.5 shrink-0">
     <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-omnibar'); setIsOmnibarOpen(true); }} title="통합검색 (Ctrl+K)" aria-label="통합검색" className={`h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 md:w-auto md:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}><Search className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 text-[#4E5968] dark:text-slate-300"/><span className="hidden md:inline">통합검색</span><kbd className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[11.5px] font-mono opacity-65 bg-[#F2F4F6] dark:bg-white/10">⌘K</kbd></button>
     <button type="button" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); pushAppHistoryGuard('open-ai-command'); setIsAiCommandModalOpen(true); }} className={`h-8 min-[380px]:h-9 px-1.5 min-[380px]:px-2 sm:px-3 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0 border transition cursor-pointer schedule-tactile ${isDark ? 'bg-[#1B64DA]/25 hover:bg-[#1B64DA]/35 text-[#93C5FD] border-[#60A5FA]/35' : 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1B64DA] border-[#BFDBFE]'}`}><Sparkles className="w-3.5 h-3.5 shrink-0"/><span>AI</span><span className="hidden sm:inline">비서</span></button>
     {step !== 'home' && canViewSchedule && (<button type="button" onClick={() => { pushAppHistoryGuard('open-schedule'); setIsScheduleModalOpen(true); }} aria-label="경기광주점 휴무표 열기" className={`flex h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 md:w-auto md:px-2.5 rounded-xl text-xs font-bold items-center justify-center gap-1 border transition cursor-pointer schedule-tactile ${surfaceBtn}`}><Calendar className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 text-[#4E5968] dark:text-slate-300"/><span className="hidden md:inline">휴무표</span></button>)}
     <button type="button" onClick={toggleUiTheme} aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'} className={`flex h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 rounded-xl items-center justify-center border transition cursor-pointer schedule-tactile ${surfaceBtn}`}>{isDark ? <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-300"/> : <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#4E5968]"/>}</button>
     {!isStandalone && (<button type="button" onClick={handleInstallAppClick} className={`${step === 'home' ? 'flex' : 'hidden lg:flex'} h-8 min-[380px]:h-9 px-2 sm:px-2.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold items-center gap-1 border transition cursor-pointer schedule-tactile bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1B64DA] border-[#BFDBFE] dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-400/35`}><Download className="w-3.5 h-3.5 shrink-0"/><span>앱 설치</span></button>)}
     <button ref={menuBtnRef} type="button" onClick={() => setIsMenuOpen((prev: boolean) => { if (!prev) pushAppHistoryGuard('open-menu'); return !prev; })} aria-label="전체메뉴 열기" className={`h-8 min-[380px]:h-9 px-1.5 min-[380px]:px-2 sm:px-3 rounded-xl text-xs font-extrabold flex items-center gap-1 min-[380px]:gap-1.5 border transition cursor-pointer schedule-tactile ${isMenuOpen ? (isDark ? 'bg-[#60A5FA] border-[#60A5FA] text-[#0B1120]' : 'bg-[#191F28] border-[#191F28] text-white') : surfaceBtn}`}>
      {isMenuOpen ? <X className="w-4 h-4"/> : <Menu className="w-4 h-4"/>}
      <span className="hidden min-[430px]:inline">전체메뉴</span>
      {urgentCount >= 1 && (<span className="px-1.5 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold leading-none font-mono">{urgentCount}</span>)}
     </button>
     <ViewportSafePopover isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} anchorRef={menuBtnRef} preferredWidth={396} align="end" mobileFullWidth className={`rounded-2xl border shadow-2xl p-3.5 space-y-2.5 schedule-modal-enter ${isDark ? 'bg-[#131C2E] border-white/15 text-[#F8FAFC]' : 'bg-white border-[#D1D6DB] text-[#191F28]'}`}>
      <button type="button" onClick={() => { setIsMenuOpen(false); setInitialCrmTab(undefined); setInitialCrmFilterTab?.(undefined); navigateToStep('crm'); }} className={`w-full py-3 px-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-between border transition cursor-pointer ${isDark ? 'bg-[#1B64DA] text-white border-[#3B82F6]' : 'bg-[#191F28] hover:bg-[#262F3D] text-white border-[#191F28]'}`}>
       <span className="flex items-center gap-2"><Users className="w-4 h-4 shrink-0 text-[#FF6B78]"/><span>VIP 통합 고객관리 (CRM)</span></span>
       {urgentCount >= 1 ? (<span className="px-2 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold shrink-0">긴급 {urgentCount}건</span>) : (<ChevronRight className="w-4 h-4 opacity-70 shrink-0"/>)}
      </button>
      {isOwnerDbUnlocked && (
       <>
        <button type="button" onClick={() => { setIsMenuOpen(false); navigateToStep('marketing-db'); }} className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between border transition cursor-pointer ${isDark ? 'bg-[#1E293B] text-amber-200 border-amber-400/35' : 'bg-[#FFF1F2] text-[#191F28] border-[#FECDD3]'}`}>
         <span className="flex items-center gap-2"><Database className="w-3.5 h-3.5 text-[#E60012] shrink-0"/><span>인스타 마케팅 DB관리 (전용)</span></span>
         {ownerDbQuickSummary.newCount > 0 ? (<span className="px-2 py-0.5 rounded-full bg-[#E60012] text-white text-[11.5px] font-bold shrink-0">신규 {ownerDbQuickSummary.newCount}건</span>) : (<ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0"/>)}
        </button>
        <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-upload-hub'); setIsUploadHubOpen?.(true); }} className={`w-full py-2.5 px-3.5 rounded-xl font-extrabold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${isDark ? 'bg-[#1E293B] hover:bg-[#273549] text-emerald-300 border-emerald-500/35' : 'bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#059669] border-[#BBF7D0]'}`}>
         <span className="flex items-center gap-2 min-w-0"><Settings className="w-3.5 h-3.5 shrink-0"/><span className="truncate">매장 자료 통합 업로드 (전용)</span></span>
         <span className="text-[11px] font-bold opacity-80 shrink-0">휴무·수당·조견·무이자</span>
        </button>
       </>
      )}
      <div className="grid grid-cols-2 gap-1.5">
       {[
        { label: '일반 구매 견적', icon: CreditCard, active: (step === 'input' || step === 'proposal') && activeMode === 'general', onClick: () => handleEnterMode('general') },
        { label: '구독 구매 견적', icon: RefreshCw, active: (step === 'input' || step === 'proposal') && activeMode === 'subscription', onClick: () => handleEnterMode('subscription') },
        { label: '일반+구독 혼합', icon: Layers, active: (step === 'input' || step === 'proposal') && activeMode === 'hybrid', onClick: () => handleEnterMode('hybrid') },
        { label: '롯데 플랜 계산기', icon: Calculator, active: step === 'lotte-plan', onClick: () => navigateToStep('lotte-plan') },
        { label: '구독 POP 출력기', icon: Printer, active: step === 'pop-printer', onClick: () => navigateToStep('pop-printer') },
        { label: '하이 모바일', icon: Smartphone, active: step === 'himobile', onClick: () => navigateToStep('himobile') },
        { label: '가전 올케어', icon: Wrench, active: step === 'allcare-guide', onClick: () => navigateToStep('allcare-guide') },
        { label: '보험 청구안내', icon: ShieldCheck, active: step === 'insurance', onClick: () => navigateToStep('insurance') },
        { label: '프리드 상품 요약', icon: BookOpen, active: false, onClick: () => openStorePolicyModal('freed') },
        { label: '안마의자 설치안내', icon: Truck, active: false, onClick: () => openStorePolicyModal('massage') },
       ].map((item) => {
        const IconComp = item.icon;
        return (<button key={item.label} type="button" onClick={() => { setIsMenuOpen(false); item.onClick(); }} className={`py-2.5 px-3 rounded-xl text-left text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${item.active ? 'bg-[#E60012] text-white border-[#E60012]' : surfaceBtn}`}><IconComp className="w-3.5 h-3.5 shrink-0 opacity-80"/><span className="truncate">{item.label}</span></button>);
       })}
      </div>
      <button type="button" onClick={() => { setIsMenuOpen(false); navigateToStep('care-table'); }} className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${surfaceBtn}`}>
       <span className="flex items-center gap-2"><FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-[#1B64DA]"/><span>안심케어 · 가전이사 조견표</span></span>
       <span className="px-2 py-0.5 rounded-md text-[11.5px] font-bold bg-[#EFF6FF] text-[#1B64DA] dark:bg-blue-500/15 dark:text-blue-300">{careUpdateMonthBadge}</span>
      </button>
      <div className={`pt-2 border-t space-y-1.5 ${isDark ? 'border-white/10' : 'border-[#E5E8EB]'}`}>
       {Boolean(isOwnerDbUnlocked && !isFriendMode) && (
        <button type="button" onClick={() => { setIsMenuOpen(false); setLandingMenuSection('select'); setActiveQuickGroup('landing-links'); }} className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${isDark ? 'bg-[#1E293B] hover:bg-[#273549] text-white border-[#60A5FA]/35' : 'bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#191F28] border-[#FECDD3]'}`}>
         <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-[#E60012] dark:text-rose-300 shrink-0"/><span>내 랜딩페이지 · DB시트</span></span>
         <span className="text-[11.5px] font-bold text-[#E60012] dark:text-rose-300">랜딩메뉴 · 예약시트 3종</span>
        </button>
       )}
       <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-partner-links'); setIsPartnerLinksOpen(true); }} className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${surfaceBtn}`}>
        <span>제휴 · 업무 바로가기 허브</span>
        <span className="text-[11.5px] text-[#1B64DA] dark:text-blue-300">구독교안 · 입주 · 중고 · 수당</span>
       </button>
       <div className={`grid ${!canViewSchedule ? 'grid-cols-3' : 'grid-cols-4'} gap-1.5`}>
        <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-installment'); setIsInstallmentModalOpen(true); }} className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}>무이자</button>
        <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-card-issue'); setIsCardIssueOpen(true); }} className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}>카드발급</button>
        <button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-as-center'); setIsAsCenterOpen(true); }} className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}>AS센터</button>
        {canViewSchedule && (<button type="button" onClick={() => { setIsMenuOpen(false); pushAppHistoryGuard('open-schedule'); setIsScheduleModalOpen(true); }} className={`py-2 px-1 rounded-xl text-[11.5px] font-bold text-center border cursor-pointer ${surfaceBtn}`}>휴무표</button>)}
       </div>
       {!isStandalone && (<button type="button" onClick={() => { setIsMenuOpen(false); handleInstallAppClick(); }} className={`lg:hidden w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer ${surfaceBtn}`}><Download className="w-3.5 h-3.5"/><span>홈 화면에 앱 설치</span></button>)}
      </div>
     </ViewportSafePopover>
    </div>
   </header>
   <HomeWorkspaceMainSection ctx={{ activeCrmCustomers, canViewSchedule, careUpdateMonthBadge, handleEnterMode, isDark, isFriendMode, isOwnerDbUnlocked, metricsCrmCustomers, navigateToStep, ownerDbQuickSummary, pushAppHistoryGuard, setActiveQuickGroup, setInitialCrmFilterTab, setInitialCrmTab, setIsPartnerLinksOpen, setIsScheduleModalOpen, setLandingMenuSection, step, unconfirmedLogisticsCountHome, unpaidGiftCountHome, urgentCount }}/>
   <HomeQuickGroupModal ctx={{ activeQuickGroup, copiedLandingId, handleCopyLandingUrl, isFriendMode, isOwnerDbUnlocked, landingMenuSection, navigateToStep, ownerDbFolderUrl, ownerDbSheetSpecs, pushAppHistoryGuard, setActiveQuickGroup, setIsAsCenterOpen, setIsCardIssueOpen, setIsInstallmentModalOpen, setLandingMenuSection }}/>
  </>
 );
};
