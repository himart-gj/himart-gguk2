import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Info,
  Layers,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { FlagshipModalShell } from './ui/FlagshipModalShell';
import { SurfaceCard } from './ui/SurfaceCard';

export type PolicyGuideTab = 'freed' | 'massage';

export const OPEN_STORE_POLICY_MODAL_EVENT = 'himart:open-store-policy-modal';

export function openStorePolicyModal(tab: PolicyGuideTab) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ tab: PolicyGuideTab }>(OPEN_STORE_POLICY_MODAL_EVENT, {
      detail: { tab },
    })
  );
}

export interface FreedGroupSpec {
  id: 'general' | 'sub-plus' | 'woongjin-plan';
  groupLabel: string;
  customerTypeLabel: string;
  compactProductTitle: string;
  billingDiscount: boolean;
  cardPayAndCashback: boolean;
  cashback: boolean;
  isRedHighlight?: boolean;
  guideTip: string;
}

export const FREED_MAX_COMBINED_PRODUCTS = 12;

export const FREED_OPERATION_GROUPS: FreedGroupSpec[] = [
  {
    id: 'general',
    groupLabel: '일반',
    customerTypeLabel: '일반 구매 고객',
    compactProductTitle: '하이프리드 75 / 150 / 225 / 300',
    billingDiscount: true,
    cardPayAndCashback: false,
    cashback: true,
    guideTip: '일반 일시불·할부 구매 시 안내 (카드납+캐시백 동시 불가, 청구할인·캐시백 가능)',
  },
  {
    id: 'sub-plus',
    groupLabel: '구독 전용(36개월/ 60개월)',
    customerTypeLabel: '가전 구독 고객 (36개월 · 60개월)',
    compactProductTitle: 'Hi구독플러스 72 / 90 / 108',
    billingDiscount: true,
    cardPayAndCashback: true,
    cashback: true,
    guideTip: '36개월·60개월 구독 전용 (청구할인 · 카드납+캐시백 · 캐시백 모두 가능)',
  },
  {
    id: 'woongjin-plan',
    groupLabel: '롯데플랜카드 전용(36개월)',
    customerTypeLabel: '롯데플랜카드 전용 (36개월)',
    compactProductTitle: 'Hi웅진플랜 72 / 90 / 108',
    billingDiscount: true,
    cardPayAndCashback: false,
    cashback: false,
    isRedHighlight: true,
    guideTip: '롯데플랜카드 36개월 전용 (청구할인만 가능 · 카드납+캐시백 및 캐시백 불가)',
  },
];

interface FreedColumnDef {
  key: string;
  titleTop: string;
  titleSub?: string;
  redLeft?: boolean;
  redMid?: boolean;
  redRight?: boolean;
  billing: boolean;
  cardCashback: boolean;
  cashback: boolean;
  redStatus?: boolean;
}

const FREED_COLUMNS: FreedColumnDef[] = [
  {
    key: 'hf',
    titleTop: '하이프리드',
    titleSub: '75/ 150/ 225/ 300',
    billing: true,
    cardCashback: false,
    cashback: true,
  },
  { key: 'sub72', titleTop: 'Hi구독플러스72', billing: true, cardCashback: true, cashback: true },
  { key: 'sub90', titleTop: 'Hi구독플러스90', billing: true, cardCashback: true, cashback: true },
  { key: 'sub108', titleTop: 'Hi구독플러스108', billing: true, cardCashback: true, cashback: true },
  {
    key: 'wj72',
    titleTop: 'Hi웅진플랜72',
    redLeft: true,
    billing: true,
    cardCashback: false,
    cashback: false,
    redStatus: true,
  },
  {
    key: 'wj90',
    titleTop: 'Hi웅진플랜90',
    redMid: true,
    billing: true,
    cardCashback: false,
    cashback: false,
    redStatus: true,
  },
  {
    key: 'wj108',
    titleTop: 'Hi웅진플랜108',
    redRight: true,
    billing: true,
    cardCashback: false,
    cashback: false,
    redStatus: true,
  },
];

export interface MassageChairLogisticsRow {
  id: string;
  brand: string;
  keywords: string;
  thirdPartyWasteOk: boolean;
  thirdPartyWasteNote?: string;
  thirdPartyLadderOk: boolean;
  thirdPartyLadderNote?: string;
}

export const MASSAGE_CHAIR_LOGISTICS_ROWS: MassageChairLogisticsRow[] = [
  {
    id: 'cozyma',
    brand: '코지마',
    keywords: '코지마 cozyma 안마의자',
    thirdPartyWasteOk: false,
    thirdPartyWasteNote: '(비고사항 작성시, 1층까지 이동가능)',
    thirdPartyLadderOk: true,
  },
  {
    id: 'ceragem',
    brand: '세라젬',
    keywords: '세라젬 ceragem 파우제 마스터 안마의자',
    thirdPartyWasteOk: false,
    thirdPartyWasteNote: '(모델별 상이, 세라젬 판촉가이드 확인)',
    thirdPartyLadderOk: false,
  },
  {
    id: 'bodyfriend',
    brand: '바디프랜드',
    keywords: '바디프랜드 바디프렌드 bodyfriend 안마의자',
    thirdPartyWasteOk: true,
    thirdPartyLadderOk: true,
  },
  {
    id: 'zespa',
    brand: '제스파',
    keywords: '제스파 zespa 안마의자',
    thirdPartyWasteOk: false,
    thirdPartyWasteNote: '(비고사항 작성시, 1층까지 이동가능)',
    thirdPartyLadderOk: false,
    thirdPartyLadderNote: '(일부모델전액지원)',
  },
  {
    id: 'nouhaus',
    brand: '누하스',
    keywords: '누하스 nouhaus 안마의자',
    thirdPartyWasteOk: false,
    thirdPartyWasteNote: '(비고사항 작성시, 1층까지 이동가능)',
    thirdPartyLadderOk: false,
  },
];

export function buildFreedSummaryCopyText(group?: FreedGroupSpec): string {
  if (group) {
    return [
      `[프리드 운영 상품 요약 · ${group.groupLabel}]`,
      `• 운영 상품: ${group.compactProductTitle} (전체 합산 최대 ${FREED_MAX_COMBINED_PRODUCTS}개 가입)`,
      `• 청구할인: ${group.billingDiscount ? '가능' : '불가'}`,
      `• 카드납 + 캐시백: ${group.cardPayAndCashback ? '가능' : '불가'}`,
      `• 캐시백: ${group.cashback ? '가능' : '불가'}`,
    ].join('\n');
  }
  return [
    `[롯데하이마트 프리드 운영 상품 요약]`,
    `※ 전 운영 상품 합산 최대 ${FREED_MAX_COMBINED_PRODUCTS}개 상품 가입 가능 (고객 타입 맞춤 안내)`,
    `1. 일반 (하이프리드 75/150/225/300): 청구할인 가능 / 카드납+캐시백 불가 / 캐시백 가능`,
    `2. 구독 전용 36·60개월 (Hi구독플러스 72/90/108): 청구할인 가능 / 카드납+캐시백 가능 / 캐시백 가능`,
    `3. 롯데플랜카드 전용 36개월 (Hi웅진플랜 72/90/108): 청구할인 가능 / 카드납+캐시백 불가 / 캐시백 불가`,
  ].join('\n');
}

export function buildMassageChairCopyText(row?: MassageChairLogisticsRow): string {
  if (row) {
    const w = `${row.thirdPartyWasteOk ? 'O' : 'X'}${row.thirdPartyWasteNote ? ` ${row.thirdPartyWasteNote}` : ''}`;
    const l = `${row.thirdPartyLadderOk ? 'O' : 'X'}${row.thirdPartyLadderNote ? ` ${row.thirdPartyLadderNote}` : ''}`;
    return [
      `[안마의자 설치 안내 · ${row.brand}]`,
      `• 당사물류: 폐가전 전 브랜드 회수 가능 / 사다리차 비용 전액 지원`,
      `• 타사물류 폐가전회수: ${w}`,
      `• 타사물류 사다리차지원: ${l}`,
    ].join('\n');
  }
  return [
    `[안마의자 설치 관련 안내 — 폐가전회수 & 사다리차 지원여부]`,
    `■ 당사물류 (5대 브랜드 공통): 폐가전 전 브랜드 회수 가능 / 사다리차 비용 전액 지원`,
    `■ 타사물류 (브랜드별 기준)`,
    ...MASSAGE_CHAIR_LOGISTICS_ROWS.map((r) => {
      const w = `${r.thirdPartyWasteOk ? 'O' : 'X'}${r.thirdPartyWasteNote ? ` ${r.thirdPartyWasteNote}` : ''}`;
      const l = `${r.thirdPartyLadderOk ? 'O' : 'X'}${r.thirdPartyLadderNote ? ` ${r.thirdPartyLadderNote}` : ''}`;
      return `• ${r.brand} — 폐가전회수: ${w} / 사다리차: ${l}`;
    }),
  ].join('\n');
}

const renderStatusPill = (allowed: boolean, emphasizeRed = false) => {
  if (allowed) {
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 font-extrabold text-xs sm:text-sm whitespace-nowrap">
        가능
      </span>
    );
  }
  if (emphasizeRed) {
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/20 text-[#E60012] dark:text-rose-300 border border-[#FECDD3] dark:border-rose-500/40 font-extrabold text-xs sm:text-sm whitespace-nowrap">
        불가
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border border-[#D1D6DB] dark:border-slate-700 font-extrabold text-xs sm:text-sm whitespace-nowrap">
      불가
    </span>
  );
};

const renderOxBadge = (ok: boolean, note?: string) => (
  <div className="flex flex-col items-center justify-center gap-1">
    {ok ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/35 font-extrabold text-xs sm:text-sm">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>O</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border border-[#FECDD3] dark:border-rose-500/35 font-extrabold text-xs sm:text-sm">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>X</span>
      </span>
    )}
    {note && (
      <span className="text-[11px] sm:text-xs font-semibold text-[#4E5968] dark:text-slate-300 leading-snug break-keep text-center">
        {note}
      </span>
    )}
  </div>
);

export interface StorePolicyQuickModalProps {
  isOpen: boolean;
  initialTab: PolicyGuideTab;
  onClose: () => void;
}

export const StorePolicyQuickModal: React.FC<StorePolicyQuickModalProps> = ({
  isOpen,
  initialTab,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PolicyGuideTab>(initialTab);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setSelectedBrandId('ALL');
  }, [isOpen, initialTab]);

  // 모바일 물리 뒤로가기 연동 (App.tsx의 __modalInternalBackHandler 체인 활용)
  useEffect(() => {
    if (!isOpen) return;
    try {
      window.history.pushState({ appGuard: true, tag: 'policy-modal' }, '');
    } catch {
      // ignore
    }
    const prevHandler = (window as any).__modalInternalBackHandler;
    (window as any).__modalInternalBackHandler = (): boolean => {
      onClose();
      return true;
    };
    return () => {
      (window as any).__modalInternalBackHandler = prevHandler;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFreed = activeTab === 'freed';
  const filteredMassageRows =
    selectedBrandId === 'ALL'
      ? MASSAGE_CHAIR_LOGISTICS_ROWS
      : MASSAGE_CHAIR_LOGISTICS_ROWS.filter((r) => r.id === selectedBrandId);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const redColCls = (col: FreedColumnDef, isBottom = false) => {
    const parts: string[] = [];
    if (col.redLeft || col.redMid || col.redRight) {
      parts.push('bg-[#FFF1F2]/30 dark:bg-rose-950/15');
      if (isBottom) parts.push('border-b-[3px] border-b-[#E60012]');
    }
    if (col.redLeft) parts.push('border-l-[3px] border-l-[#E60012]');
    if (col.redRight) parts.push('border-r-[3px] border-r-[#E60012]');
    return parts.join(' ');
  };

  return (
    <div className="no-print">
      <FlagshipModalShell
        isOpen={isOpen}
        onClose={onClose}
        title={isFreed ? '프리드 운영 상품 요약표' : '안마의자 설치 관련 안내'}
        subtitle={
          isFreed
            ? '합산 최대 12개 가입 · 일반 / 구독전용(36·60개월) / 롯데플랜카드 전용(36개월)'
            : '당사물류 vs 타사물류 브랜드별 폐가전회수 & 사다리차 지원여부'
        }
        badge="상시 고정"
        icon={
          isFreed ? (
            <Layers className="w-4 h-4 text-[#E60012] dark:text-rose-400" />
          ) : (
            <Truck className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
          )
        }
        maxWidthClass="max-w-5xl"
        headerRight={
          <button
            type="button"
            onClick={() =>
              handleCopy(
                isFreed ? buildFreedSummaryCopyText() : buildMassageChairCopyText(),
                'modal-all'
              )
            }
            className="px-3 py-1.5 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer schedule-tactile"
          >
            {copiedKey === 'modal-all' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">전체 요약 복사</span>
              </>
            )}
          </button>
        }
        bodyClassName="p-3.5 sm:p-5 space-y-3.5 overflow-y-auto flex-1 bg-[#F2F4F6] dark:bg-[#0B1120]"
      >
        {/* 상단 2탭 전환 바 */}
        <div className="inline-flex w-full sm:w-auto p-1 rounded-xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('freed')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              isFreed
                ? 'bg-[#FFF1F2] dark:bg-rose-500/20 text-[#E60012] dark:text-rose-300 border border-[#FECDD3] dark:border-rose-500/35'
                : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>프리드 상품 요약</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('massage')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              !isFreed
                ? 'bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/35'
                : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-100'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span>
              안마의자 설치<span className="hidden sm:inline"> · 사다리차</span> 안내
            </span>
          </button>
        </div>

        {isFreed ? (
          <SurfaceCard className="p-4 sm:p-6 space-y-5 border-t-[3px] border-t-[#E60012]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E8EB] dark:border-slate-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 text-xs font-extrabold">
                  <span>Q. 프리드 상품이 많아요. 요약해주세요</span>
                </div>
                <h3 className="text-base sm:text-xl font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 break-keep">
                  총 운영 상품은 아래와 같으며, 고객 타입에 맞춰 안내해 주세요
                </h3>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/35 shrink-0 self-start sm:self-center">
                <Layers className="w-4 h-4 text-[#1B64DA] dark:text-blue-300 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 whitespace-nowrap">
                  합산 최대{' '}
                  <strong className="text-[#1B64DA] dark:text-blue-300 font-mono tabular-nums">
                    {FREED_MAX_COMBINED_PRODUCTS}개
                  </strong>{' '}
                  상품 가입
                </span>
              </div>
            </div>

            {/* 모바일(<640px) 무스크롤 카드 뷰 */}
            <div className="sm:hidden space-y-3">
              {FREED_OPERATION_GROUPS.map((grp) => {
                const copyId = `freed-m-${grp.id}`;
                return (
                  <div
                    key={grp.id}
                    className={`rounded-2xl p-3.5 space-y-3 border ${
                      grp.isRedHighlight
                        ? 'bg-[#FFF1F2]/60 dark:bg-rose-950/25 border-2 border-[#E60012] dark:border-rose-500'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/70 border-[#E5E8EB] dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11.5px] font-extrabold ${
                              grp.isRedHighlight
                                ? 'bg-[#E60012] text-white'
                                : 'bg-[#191F28] dark:bg-slate-700 text-white'
                            }`}
                          >
                            {grp.groupLabel}
                          </span>
                          {grp.isRedHighlight && (
                            <span className="text-[11px] font-extrabold text-[#E60012] dark:text-rose-300">
                              청구할인 전용
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-extrabold text-[#191F28] dark:text-slate-50 pt-1 break-keep">
                          {grp.compactProductTitle}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(buildFreedSummaryCopyText(grp), copyId)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100 text-[11.5px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === copyId ? (
                          <>
                            <Check className="w-3 h-3 text-[#059669]" />
                            <span>복사됨</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#1B64DA] dark:text-blue-400" />
                            <span>복사</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: '청구할인', val: grp.billingDiscount },
                        { label: '카드납+캐시백', val: grp.cardPayAndCashback },
                        { label: '캐시백', val: grp.cashback },
                      ].map((cell) => (
                        <div
                          key={cell.label}
                          className="rounded-xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-2 space-y-1"
                        >
                          <div className="text-[11px] font-bold text-[#4E5968] dark:text-slate-400 break-keep">
                            {cell.label}
                          </div>
                          <div>{renderStatusPill(cell.val, grp.isRedHighlight)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 태블릿·PC(640px+) 공식 7열 매트릭스 표 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs lg:text-sm">
                <thead>
                  <tr>
                    <th
                      rowSpan={3}
                      className="w-28 lg:w-36 py-3 px-2 border border-[#D1D6DB] dark:border-slate-700 bg-[#F2F4F6] dark:bg-slate-800/90 font-extrabold text-[#191F28] dark:text-slate-100 align-middle"
                    >
                      구 분
                    </th>
                    <th
                      colSpan={7}
                      className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#FAF5FF] dark:bg-indigo-950/40 font-extrabold text-sm lg:text-base text-[#191F28] dark:text-slate-100"
                    >
                      합산 최대{' '}
                      <span className="text-[#1B64DA] dark:text-blue-300 font-mono tabular-nums">
                        12개
                      </span>{' '}
                      상품 가입
                    </th>
                  </tr>
                  <tr className="bg-white dark:bg-[#131C2E] font-extrabold text-[#191F28] dark:text-slate-100">
                    {FREED_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={`py-2.5 px-2 border border-[#D1D6DB] dark:border-slate-700 leading-snug whitespace-nowrap ${
                          col.redLeft || col.redMid || col.redRight
                            ? 'border-t-[3px] border-t-[#E60012] bg-[#FFF1F2]/40 dark:bg-rose-950/20'
                            : ''
                        } ${col.redLeft ? 'border-l-[3px] border-l-[#E60012]' : ''} ${
                          col.redRight ? 'border-r-[3px] border-r-[#E60012]' : ''
                        }`}
                      >
                        <div>{col.titleTop}</div>
                        {col.titleSub && (
                          <div className="font-mono tabular-nums text-[11px] lg:text-xs text-[#4E5968] dark:text-slate-300">
                            {col.titleSub}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-[#F8FAFC] dark:bg-slate-900/70 font-extrabold text-xs lg:text-[13px]">
                    <th className="py-2.5 px-2 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-200">
                      일반
                    </th>
                    <th
                      colSpan={3}
                      className="py-2.5 px-2 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100"
                    >
                      구독 전용{' '}
                      <span className="text-[#E60012] dark:text-rose-300 font-mono">
                        (36개월/ 60개월)
                      </span>
                    </th>
                    <th
                      colSpan={3}
                      className="py-2.5 px-2 border border-[#D1D6DB] dark:border-slate-700 border-l-[3px] border-l-[#E60012] border-r-[3px] border-r-[#E60012] bg-[#FFF1F2]/60 dark:bg-rose-950/30 text-[#E60012] dark:text-rose-300"
                    >
                      롯데플랜카드 전용(36개월)
                    </th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  {(
                    [
                      { label: '청구할인', field: 'billing', bottom: false },
                      { label: '카드납 + 캐시백', field: 'cardCashback', bottom: false },
                      { label: '캐시백', field: 'cashback', bottom: true },
                    ] as const
                  ).map((rowSpec) => (
                    <tr
                      key={rowSpec.label}
                      className="bg-[#FEFCE8]/60 dark:bg-slate-900/40"
                    >
                      <td className="py-3.5 px-2 border border-[#D1D6DB] dark:border-slate-700 bg-[#FEF9C3]/65 dark:bg-slate-800/80 font-extrabold text-[#191F28] dark:text-slate-100 whitespace-nowrap">
                        {rowSpec.label}
                      </td>
                      {FREED_COLUMNS.map((col) => (
                        <td
                          key={`${rowSpec.field}-${col.key}`}
                          className={`py-3.5 px-2 border border-[#D1D6DB] dark:border-slate-700 ${redColCls(
                            col,
                            rowSpec.bottom
                          )}`}
                        >
                          {renderStatusPill(col[rowSpec.field], col.redStatus)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {FREED_OPERATION_GROUPS.map((grp) => (
                <div
                  key={`tip-${grp.id}`}
                  className={`rounded-xl px-3.5 py-3 border text-xs space-y-1 ${
                    grp.isRedHighlight
                      ? 'bg-[#FFF1F2] dark:bg-rose-500/12 border-[#FECDD3] dark:border-rose-500/30'
                      : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-[#E5E8EB] dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-extrabold ${
                        grp.isRedHighlight
                          ? 'text-[#E60012] dark:text-rose-300'
                          : 'text-[#191F28] dark:text-slate-100'
                      }`}
                    >
                      {grp.customerTypeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(buildFreedSummaryCopyText(grp), `tip-${grp.id}`)
                      }
                      className="text-[11px] font-bold text-[#1B64DA] dark:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === `tip-${grp.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-[#059669]" />
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[#4E5968] dark:text-slate-300 font-medium leading-relaxed break-keep">
                    {grp.guideTip}
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-4 sm:p-6 space-y-5 border-t-[3px] border-t-[#1B64DA]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E8EB] dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold">
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    <span>폐가전회수 &amp; 사다리차 지원여부</span>
                  </span>
                  <span className="text-[11.5px] font-mono font-bold text-[#8B95A1] dark:text-slate-400">
                    25.09 기준 (상시 고정)
                  </span>
                </div>
                <h3 className="text-base sm:text-xl font-extrabold tracking-tight text-[#191F28] dark:text-slate-50">
                  안마의자 설치 관련 안내
                </h3>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: '전체 5대 브랜드' },
                  ...MASSAGE_CHAIR_LOGISTICS_ROWS.map((r) => ({
                    id: r.id,
                    label: r.brand,
                  })),
                ].map((chip) => {
                  const active = selectedBrandId === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSelectedBrandId(chip.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                        active
                          ? 'bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA]'
                          : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 p-3.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#1B64DA] dark:text-blue-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>당사물류 진행 시 (5대 브랜드 전체 공통)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-extrabold">
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 border border-[#BFDBFE] dark:border-blue-500/30">
                  폐가전회수:{' '}
                  <strong className="text-[#059669] dark:text-emerald-300">
                    전 브랜드 회수 가능
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-[#191F28] dark:text-slate-100 border border-[#BFDBFE] dark:border-blue-500/30">
                  사다리차:{' '}
                  <strong className="text-[#1B64DA] dark:text-blue-300">
                    비용 전액 지원
                  </strong>
                </span>
              </div>
            </div>

            {/* 모바일(<640px) 브랜드 카드 */}
            <div className="sm:hidden space-y-2.5">
              {filteredMassageRows.map((row) => {
                const copyId = `mc-m-${row.id}`;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-[#191F28] dark:text-slate-50">
                          {row.brand}
                        </span>
                        {row.thirdPartyWasteOk && row.thirdPartyLadderOk && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-extrabold">
                            타사물류도 회수·사다리차 O
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(buildMassageChairCopyText(row), copyId)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100 text-[11.5px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === copyId ? (
                          <>
                            <Check className="w-3 h-3 text-[#059669]" />
                            <span>복사됨</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#1B64DA] dark:text-blue-400" />
                            <span>복사</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="rounded-xl bg-[#EFF6FF]/70 dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-500/25 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-[#1B64DA] dark:text-blue-300">
                        당사물류
                      </span>
                      <span className="font-bold text-[#191F28] dark:text-slate-100 text-right break-keep">
                        전 브랜드 회수 가능 · 사다리차 전액 지원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-2.5 space-y-1.5 text-center">
                        <div className="text-[11px] font-bold text-[#4E5968] dark:text-slate-400">
                          타사물류 · 폐가전회수
                        </div>
                        {renderOxBadge(row.thirdPartyWasteOk, row.thirdPartyWasteNote)}
                      </div>
                      <div className="rounded-xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-2.5 space-y-1.5 text-center">
                        <div className="text-[11px] font-bold text-[#4E5968] dark:text-slate-400">
                          타사물류 · 사다리차
                        </div>
                        {renderOxBadge(row.thirdPartyLadderOk, row.thirdPartyLadderNote)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 태블릿·PC(640px+) 공식 원본 표 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F2F4F6] dark:bg-slate-800/90 font-extrabold text-[#191F28] dark:text-slate-100">
                    <th
                      rowSpan={2}
                      className="py-3 px-3 border border-[#D1D6DB] dark:border-slate-700 w-28 align-middle"
                    >
                      브랜드
                    </th>
                    <th
                      colSpan={2}
                      className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#EFF6FF] dark:bg-blue-950/40 text-[#1B64DA] dark:text-blue-300"
                    >
                      당사물류
                    </th>
                    <th
                      colSpan={2}
                      className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700"
                    >
                      타사물류
                    </th>
                    <th
                      rowSpan={2}
                      className="py-3 px-2 border border-[#D1D6DB] dark:border-slate-700 w-20 align-middle"
                    >
                      복사
                    </th>
                  </tr>
                  <tr className="bg-[#F8FAFC] dark:bg-slate-900/80 font-extrabold text-xs sm:text-[13px] text-[#191F28] dark:text-slate-200">
                    <th className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#EFF6FF]/60 dark:bg-blue-950/25">
                      폐가전회수여부
                    </th>
                    <th className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#EFF6FF]/60 dark:bg-blue-950/25">
                      사다리차 지원여부
                    </th>
                    <th className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700">
                      폐가전회수여부
                    </th>
                    <th className="py-2.5 px-3 border border-[#D1D6DB] dark:border-slate-700">
                      사다리차 지원여부
                    </th>
                  </tr>
                </thead>
                <tbody className="font-bold text-[#191F28] dark:text-slate-100">
                  {filteredMassageRows.map((row, idx) => {
                    const copyId = `mc-d-${row.id}`;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-4 px-3 border border-[#D1D6DB] dark:border-slate-700 font-extrabold text-sm sm:text-base whitespace-nowrap">
                          {row.brand}
                        </td>

                        {idx === 0 && (
                          <>
                            <td
                              rowSpan={filteredMassageRows.length}
                              className="py-4 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#EFF6FF]/35 dark:bg-blue-950/20 align-middle font-extrabold"
                            >
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#BFDBFE] dark:border-blue-500/30 text-[#059669] dark:text-emerald-300">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>전 브랜드 회수 가능</span>
                              </div>
                            </td>
                            <td
                              rowSpan={filteredMassageRows.length}
                              className="py-4 px-3 border border-[#D1D6DB] dark:border-slate-700 bg-[#EFF6FF]/35 dark:bg-blue-950/20 align-middle font-extrabold"
                            >
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>비용 전액 지원</span>
                              </div>
                            </td>
                          </>
                        )}

                        <td className="py-4 px-3 border border-[#D1D6DB] dark:border-slate-700 align-middle">
                          {renderOxBadge(row.thirdPartyWasteOk, row.thirdPartyWasteNote)}
                        </td>
                        <td className="py-4 px-3 border border-[#D1D6DB] dark:border-slate-700 align-middle">
                          {renderOxBadge(row.thirdPartyLadderOk, row.thirdPartyLadderNote)}
                        </td>
                        <td className="py-4 px-2 border border-[#D1D6DB] dark:border-slate-700 align-middle">
                          <button
                            type="button"
                            onClick={() => handleCopy(buildMassageChairCopyText(row), copyId)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#191F28] dark:bg-slate-800 hover:bg-[#1B64DA] dark:hover:bg-[#1B64DA] text-white text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {copiedKey === copyId ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-300" />
                                <span>복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>복사</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-[#E5E8EB] dark:border-slate-800 px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#4E5968] dark:text-slate-300 font-medium leading-relaxed">
              <Info className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                타사물류 진행 시 <strong className="text-[#191F28] dark:text-slate-100">코지마, 제스파, 누하스</strong>는 전산 비고사항 작성 시 기존 안마의자 1층까지 이동이 가능하며,{' '}
                <strong className="text-[#191F28] dark:text-slate-100">세라젬</strong>은 모델별 상이하므로 판촉가이드를 반드시 확인해 주세요.
              </span>
            </div>
          </SurfaceCard>
        )}
      </FlagshipModalShell>
    </div>
  );
};
