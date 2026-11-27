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
import {
  getOwnerDbDriveFolderUrl,
  getOwnerReservationDbSheetSpecs,
} from '../utils/ownerDbSheetLinks';
import { OFFICIAL_LANDING_LINKS, QuickConsultationGroupKey, getStepShortLabel } from './AppHeaderAndHome';

export const HomeWorkspaceMainSection: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    activeCrmCustomers,
    canViewSchedule,
    careUpdateMonthBadge,
    handleEnterMode,
    isDark,
    isFriendMode,
    isOwnerDbUnlocked,
    metricsCrmCustomers,
    navigateToStep,
    ownerDbQuickSummary,
    pushAppHistoryGuard,
    setActiveQuickGroup,
    setInitialCrmFilterTab,
    setInitialCrmTab,
    setIsPartnerLinksOpen,
    setIsScheduleModalOpen,
    setLandingMenuSection,
    step,
    unconfirmedLogisticsCountHome,
    unpaidGiftCountHome,
    urgentCount,
  } = ctx;
  return (
    <>
      {step === 'home' && (
        <main className="flex-1 w-full flex justify-center px-3.5 sm:px-6 py-4 sm:py-6">
          <div className="w-full max-w-5xl flex flex-col gap-3.5 sm:gap-4">
            {/* 01. STAFF DAILY SCHEDULE & INCENTIVE BRIEFING */}
            <ScheduleCharacterBanner
              isDark={isDark}
              customers={activeCrmCustomers}
              settlementCustomers={metricsCrmCustomers || activeCrmCustomers}
              hideScheduleSection={!canViewSchedule}
              onOpenScheduleModal={() => {
                if (!canViewSchedule) return;
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
                          LG구독 전산교안 · 입주 · 중고 · 수당 · 청약
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
                    ...(Boolean(isOwnerDbUnlocked && !isFriendMode)
                      ? [
                          {
                            key: 'landing-links' as QuickConsultationGroupKey,
                            title: '내 랜딩페이지',
                            sub: '랜딩페이지 메뉴 · 예약고객 DB 시트 3종',
                            pill: '선택 열기',
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
                        onClick={() => {
                          if (tile.key === 'landing-links') setLandingMenuSection('select');
                          setActiveQuickGroup(tile.key);
                        }}
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


    </>
  );
};
