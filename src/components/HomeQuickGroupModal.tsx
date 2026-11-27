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

export const HomeQuickGroupModal: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    activeQuickGroup,
    copiedLandingId,
    handleCopyLandingUrl,
    isFriendMode,
    isOwnerDbUnlocked,
    landingMenuSection,
    navigateToStep,
    ownerDbFolderUrl,
    ownerDbSheetSpecs,
    pushAppHistoryGuard,
    setActiveQuickGroup,
    setIsAsCenterOpen,
    setIsCardIssueOpen,
    setIsInstallmentModalOpen,
    setLandingMenuSection,
  } = ctx;
  return (
    <>
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
                : landingMenuSection === 'db-sheets'
                ? '예약고객 DB 시트 바로가기 (3종)'
                : landingMenuSection === 'landing'
                ? '내 랜딩 · 관리자 페이지 바로가기'
                : '내 랜딩페이지 · 예약고객 DB 시트'
            }
            subtitle={
              activeQuickGroup === 'landing-links'
                ? landingMenuSection === 'select'
                  ? '열람하실 메뉴(랜딩페이지 또는 예약고객 DB 시트)를 선택해 주세요'
                  : '터치 시 새 창으로 바로 열리며 우측에서 주소 복사도 가능합니다'
                : '확인하실 안내 항목을 선택해 주세요'
            }
            badge={activeQuickGroup === 'landing-links' ? '관리자 전용' : '바로 선택'}
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
              Boolean(isOwnerDbUnlocked && !isFriendMode) && (
                <div className="space-y-2.5">
                  {/* 상단 빠른 메뉴 전환 탭 */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800">
                    {(
                      [
                        { id: 'select' as const, label: '메뉴 선택' },
                        { id: 'landing' as const, label: '🌐 랜딩페이지 (3)' },
                        { id: 'db-sheets' as const, label: '📊 DB 시트 (3)' },
                      ] as const
                    ).map((tab) => {
                      const active = landingMenuSection === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setLandingMenuSection(tab.id)}
                          className={`py-2 px-2 rounded-lg text-[11.5px] sm:text-xs font-extrabold transition cursor-pointer ${
                            active
                              ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                              : 'text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 1) 초기 선택 화면: 랜딩페이지 메뉴 vs 예약고객 DB 시트 메뉴 */}
                  {landingMenuSection === 'select' && (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => setLandingMenuSection('landing')}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] dark:hover:border-[#60A5FA] text-left flex items-center justify-between gap-3 transition cursor-pointer schedule-tactile"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-11 h-11 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                                랜딩페이지 메뉴 열기
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[10.5px] font-bold">
                                3개 페이지
                              </span>
                            </div>
                            <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                              구독 랜딩페이지 · 일반 매장랜딩페이지 · 구독 관리자 CMS
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setLandingMenuSection('db-sheets')}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#059669] dark:hover:border-emerald-400 text-left flex items-center justify-between gap-3 transition cursor-pointer schedule-tactile"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                                예약고객 DB 시트 메뉴 열기
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[10.5px] font-bold">
                                3개 시트
                              </span>
                            </div>
                            <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                              드라이브 DB폴더 내 인스타광고 · 구독상담 · 일반랜딩 예약고객 시트
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#8B95A1] shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* 2) 랜딩페이지 메뉴 3종 */}
                  {landingMenuSection === 'landing' &&
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
                              {item.isStaff ? (
                                <Settings className="w-5 h-5" />
                              ) : (
                                <Globe className="w-5 h-5" />
                              )}
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

                  {/* 3) 구글 드라이브 DB관리 폴더 내 예약고객 시트 3종 바로가기 */}
                  {landingMenuSection === 'db-sheets' && (
                    <div className="space-y-2.5">
                      {ownerDbSheetSpecs.map((sheet) => {
                        const isCopied = copiedLandingId === sheet.id;
                        return (
                          <div
                            key={sheet.id}
                            className="w-full p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 hover:border-[#059669] dark:hover:border-emerald-400 flex items-center justify-between gap-2.5 transition"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                window.open(sheet.url, '_blank', 'noopener,noreferrer');
                                setActiveQuickGroup(null);
                              }}
                              className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer"
                            >
                              <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-5 h-5" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm sm:text-[15px] font-extrabold text-[#191F28] dark:text-slate-50 break-keep">
                                    {sheet.title}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[10.5px] font-bold">
                                    {sheet.badge}
                                  </span>
                                </div>
                                <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5 break-keep">
                                  {sheet.sub}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyLandingUrl(sheet)}
                                title="시트 주소 복사"
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
                                href={sheet.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setActiveQuickGroup(null)}
                                title={`${sheet.title} 새 창 열기`}
                                className="h-9 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>시트 열기</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            </div>
                          </div>
                        );
                      })}

                      {ownerDbFolderUrl && (
                        <a
                          href={ownerDbFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setActiveQuickGroup(null)}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 border border-[#E5E8EB] dark:border-slate-800 text-xs font-extrabold text-[#4E5968] dark:text-slate-300 flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-[#059669]" />
                            <span>구글 드라이브 [DB관리] 폴더 전체 열기</span>
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
          </FlagshipModalShell>
        </div>
      )}

    </>
  );
};
