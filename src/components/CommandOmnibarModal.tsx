import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppStep } from '../types/proposal';
import { CustomerItem } from '../crm/types/crm';
import { CareTableDataset, CareTableItem } from '../utils/careTableParser';
import { InstallmentDataset } from '../utils/installmentParser';
import { MAJOR_AS_CENTERS, PLUX_AS_GROUPS } from './QuickCenterModal';
import { loadPartnerLinks } from './PartnerLinksModal';
import {
  getOrCreateMonthSchedule,
  isOffDayCode,
  loadAllSchedules,
} from './ScheduleModal';
import {
  Calculator,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Phone,
  Printer,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react';

// 한글 초성 검색 엔진 ('ㄱㅅㅇ' -> '강석원', 'ㅇㅇㅋ' -> '에어컨')
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getChoseongString(str: string): string {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 0xac00;
    if (code >= 0 && code < 11172) {
      res += CHOSEONG[Math.floor(code / 588)];
    } else {
      res += str[i];
    }
  }
  return res;
}

function matchSearch(target: string, query: string): boolean {
  if (!query) return true;
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  return getChoseongString(t).includes(q);
}

export interface CommandOmnibarModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  customers: CustomerItem[];
  careDataset: CareTableDataset | null;
  installmentDataset: InstallmentDataset;
  onNavigateStep: (step: AppStep) => void;
  onEnterQuoteMode: (mode: 'general' | 'subscription' | 'hybrid') => void;
  onOpenCustomerQuote: (customer: CustomerItem) => void;
  onOpenScheduleModal: () => void;
  onOpenInstallmentModal: () => void;
  onOpenCardIssueModal: () => void;
  onOpenAsCenterModal: () => void;
  onOpenPartnerLinksModal?: () => void;
  onRunInAiCopilot: (commandText: string) => void;
}

interface OmnibarResultItem {
  id: string;
  group: '메뉴' | '고객 CRM' | '안심케어·이사' | '무이자 할부' | 'AS 센터' | '근무·휴무';
  title: string;
  subtitle: string;
  badge?: string;
  badgeCls?: string;
  copyText?: string;
  phoneHref?: string;
  onSelect: () => void;
}

export const CommandOmnibarModal: React.FC<CommandOmnibarModalProps> = ({
  isOpen,
  onClose,
  isDark,
  customers,
  careDataset,
  installmentDataset,
  onNavigateStep,
  onEnterQuoteMode,
  onOpenCustomerQuote,
  onOpenScheduleModal,
  onOpenInstallmentModal,
  onOpenCardIssueModal,
  onOpenAsCenterModal,
  onOpenPartnerLinksModal,
  onRunInAiCopilot,
}) => {
  const [query, setQuery] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
  }, [isOpen]);

  // 오늘 기준 근무/휴무 스냅샷
  const todayStaffSnapshot = useMemo(() => {
    if (!isOpen) return [];
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const schedules = loadAllSchedules();
    const month = getOrCreateMonthSchedule(schedules, ym);
    const dStr = String(now.getDate());
    return month.employees.map((e) => {
      const code = e.days[dStr] || '';
      return {
        name: e.name,
        role: e.role,
        code,
        isOff: isOffDayCode(code) || code === '교육' || code === '회의',
      };
    });
  }, [isOpen]);

  // 0.01초 로컬 통합 인덱싱 결과 산출
  const results = useMemo<OmnibarResultItem[]>(() => {
    const q = query.trim();
    const list: OmnibarResultItem[] = [];

    // 1) 앱 빠른 메뉴 액션
    const quickMenus: OmnibarResultItem[] = [
      {
        id: 'menu-gen',
        group: '메뉴',
        title: '일반 구매 맞춤 견적기 열기',
        subtitle: '즉시할인 · 캐시백 · 하이프리드 1안/2안 설계',
        badge: 'STEP 01',
        onSelect: () => {
          onClose();
          onEnterQuoteMode('general');
        },
      },
      {
        id: 'menu-sub',
        group: '메뉴',
        title: '가전 구독 맞춤 견적기 열기',
        subtitle: '36·60개월 구독 + 제휴카드 + Hi구독 플러스',
        badge: 'STEP 01',
        onSelect: () => {
          onClose();
          onEnterQuoteMode('subscription');
        },
      },
      {
        id: 'menu-hybrid',
        group: '메뉴',
        title: '혼합(일반+구독) 통합 견적기 열기',
        subtitle: '일시불 품목과 구독 품목을 한 장의 제안서로 설계',
        badge: 'STEP 01',
        onSelect: () => {
          onClose();
          onEnterQuoteMode('hybrid');
        },
      },
      {
        id: 'menu-crm',
        group: '메뉴',
        title: 'VIP 통합 고객관리 CRM 보드 열기',
        subtitle: '칸반 파이프라인 · 배송 캘린더 · 다중 견적 보관함',
        badge: 'CRM',
        onSelect: () => {
          onClose();
          onNavigateStep('crm');
        },
      },
      {
        id: 'menu-pop',
        group: '메뉴',
        title: '구독 POP 스캐너 & 자동 출력기',
        subtitle: '견적 사진 Ctrl+V 인식 · A4 POP 인쇄',
        badge: 'STEP 02',
        onSelect: () => {
          onClose();
          onNavigateStep('pop-printer');
        },
      },
      {
        id: 'menu-care',
        group: '메뉴',
        title: '안심케어 · 가전이사 단가 조견표',
        subtitle: '클리닝 · 워런티 · 가전이사 POS 코드 조회',
        badge: 'STEP 02',
        onSelect: () => {
          onClose();
          onNavigateStep('care-table');
        },
      },
      {
        id: 'menu-lotte',
        group: '메뉴',
        title: '롯데 플랜 카드 계산기 (최대 -108만)',
        subtitle: '70/120/200만원 구간별 할인 시뮬레이션',
        badge: '계산기',
        onSelect: () => {
          onClose();
          onNavigateStep('lotte-plan');
        },
      },
      {
        id: 'menu-sched',
        group: '메뉴',
        title: '경기광주점 근무 · 휴무 스튜디오',
        subtitle: '오늘 근무자 · 내 월간 달력 · 맞교대 비교',
        badge: '휴무표',
        onSelect: () => {
          onClose();
          onOpenScheduleModal();
        },
      },
      {
        id: 'menu-inst',
        group: '메뉴',
        title: '카드사별 무이자 · 부분무이자 할부표',
        subtitle: '당월 카드사별 할부 개월수 조견표',
        badge: '금융',
        onSelect: () => {
          onClose();
          onOpenInstallmentModal();
        },
      },
      {
        id: 'menu-card-issue',
        group: '메뉴',
        title: '제휴카드 간편 발급 QR · 링크 센터',
        subtitle: '사번 연동 카드 발급 주소 즉시 복사',
        badge: '발급',
        onSelect: () => {
          onClose();
          onOpenCardIssueModal();
        },
      },
      {
        id: 'menu-allcare-guide',
        group: '메뉴',
        title: '34대 가전수리 올케어 고객 안내서',
        subtitle: '사용 중 가전 2년 수리비 보증 품목 및 카톡 안내문 복사',
        badge: 'STEP 03',
        onSelect: () => {
          onClose();
          onNavigateStep('allcare-guide');
        },
      },
      {
        id: 'menu-insurance',
        group: '메뉴',
        title: '연장보증 · 파손보험 안내서',
        subtitle: '하이워런티 및 모바일·가전 보험 안내',
        badge: 'STEP 03',
        onSelect: () => {
          onClose();
          onNavigateStep('insurance');
        },
      },
      {
        id: 'menu-himobile',
        group: '메뉴',
        title: '하이모바일 KT망 알뜰 요금제 안내',
        subtitle: '자급제·유심 특가 요금제 비교 및 안내',
        badge: 'STEP 03',
        onSelect: () => {
          onClose();
          onNavigateStep('himobile');
        },
      },
      ...(onOpenPartnerLinksModal
        ? [
            {
              id: 'menu-partner-hub',
              group: '메뉴' as const,
              title: '제휴 · 업무 바로가기 허브 열기',
              subtitle: '방충망 · 입주청소 · 중고보상 · 하이프리드 수당 · SK인터넷 청약',
              badge: 'STEP 03',
              onSelect: () => {
                onClose();
                onOpenPartnerLinksModal();
              },
            },
          ]
        : []),
    ];

    if (!q) {
      // 검색어 입력 전: 최근 고객 3명 + 핵심 메뉴 표시
      const recentCust = customers
        .filter((c) => !c.deletedAt)
        .slice(0, 3)
        .map<OmnibarResultItem>((c) => ({
          id: `cust-${c.id}`,
          group: '고객 CRM',
          title: `${c.name} 고객님 (${c.status})`,
          subtitle: `${c.items || '상담 품목'} · 체감 ${(
            c.netAmount || 0
          ).toLocaleString()}원`,
          badge: c.deliveryDate || '최근상담',
          phoneHref: c.phone
            ? `tel:${c.phone.replace(/[^0-9]/g, '')}`
            : undefined,
          onSelect: () => {
            onClose();
            onOpenCustomerQuote(c);
          },
        }));
      return [...recentCust, ...quickMenus.slice(0, 7)];
    }

    // 검색어가 있을 때 6대 인덱스 동시 고속 스캔
    // 1. 고객 CRM
    customers
      .filter(
        (c) =>
          !c.deletedAt &&
          (matchSearch(c.name, q) ||
            matchSearch(c.phone || '', q) ||
            matchSearch(c.items || '', q) ||
            matchSearch(c.orderNo || '', q) ||
            matchSearch(c.memo || '', q))
      )
      .slice(0, 5)
      .forEach((c) => {
        list.push({
          id: `cust-${c.id}`,
          group: '고객 CRM',
          title: `${c.name} (${c.phone || '연락처 미등록'})`,
          subtitle: `${c.items || '품목 미입력'} · 결제 ${(
            c.paidAmount || 0
          ).toLocaleString()}원 / 체감 ${(c.netAmount || 0).toLocaleString()}원`,
          badge: c.status,
          phoneHref: c.phone
            ? `tel:${c.phone.replace(/[^0-9]/g, '')}`
            : undefined,
          onSelect: () => {
            onClose();
            onOpenCustomerQuote(c);
          },
        });
      });

    // 2. 안심케어 · 가전이사 조견표
    if (careDataset?.items) {
      careDataset.items
        .filter(
          (it: CareTableItem) =>
            matchSearch(it.name, q) ||
            matchSearch(it.category, q) ||
            matchSearch(it.section, q) ||
            matchSearch(it.code, q)
        )
        .slice(0, 6)
        .forEach((it) => {
          list.push({
            id: `care-${it.id}`,
            group: '안심케어·이사',
            title: `[${it.category}] ${it.name}`,
            subtitle: `${it.section} · 코드: ${it.code || '-'} · ${
              it.note ? `${it.note}` : ''
            }`,
            badge: it.price,
            copyText: it.code || `${it.name} ${it.price}`,
            onSelect: () => {
              onClose();
              onNavigateStep('care-table');
            },
          });
        });
    }

    // 3. 카드 무이자 할부
    (installmentDataset?.quickSummaries || [])
      .filter(
        (card) =>
          matchSearch(card.brandTitle, q) ||
          matchSearch(card.brandKey, q) ||
          q.includes('무이자') ||
          q.includes('할부')
      )
      .slice(0, 4)
      .forEach((card) => {
        list.push({
          id: `inst-${card.brandKey}`,
          group: '무이자 할부',
          title: `${card.brandTitle} 무이자 혜택`,
          subtitle: `무이자: ${card.freeInstallment} | 부분: ${card.partialInstallment}`,
          badge: card.subInstallment ? `구독 ${card.subInstallment}` : '할부안내',
          copyText: `[${card.brandTitle}] 무이자: ${card.freeInstallment} / 부분무이자: ${card.partialInstallment}`,
          onSelect: () => {
            onClose();
            onOpenInstallmentModal();
          },
        });
      });

    // 3-2. 제휴 · 업무 바로가기 허브 링크
    loadPartnerLinks()
      .filter(
        (pl) =>
          !q ||
          matchSearch(pl.title, q) ||
          matchSearch(pl.badgeText, q) ||
          matchSearch(pl.description, q)
      )
      .slice(0, q ? 6 : 2)
      .forEach((pl) => {
        list.push({
          id: `partner-${pl.id}`,
          group: '메뉴',
          title: `🔗 ${pl.title}`,
          subtitle: `${pl.badgeText} · ${pl.description}`,
          badge: pl.isStaffOnly ? '직원전용 ↗' : '바로열기 ↗',
          copyText: pl.isStaffOnly
            ? pl.url
            : `[롯데하이마트 경기광주점] ${pl.title} 안내\n👉 ${pl.url}`,
          onSelect: () => {
            onClose();
            window.open(pl.url, '_blank', 'noopener,noreferrer');
          },
        });
      });

    // 4. 가전 A/S 서비스센터 & 플럭스 파트너
    MAJOR_AS_CENTERS.filter(
      (asItem) =>
        matchSearch(asItem.brand, q) ||
        matchSearch(asItem.keywords, q) ||
        q.toLowerCase().includes('as') ||
        q.includes('서비스')
    )
      .slice(0, 4)
      .forEach((asItem) => {
        const mainPhone = asItem.phones[0]?.number || '';
        list.push({
          id: `as-${asItem.id}`,
          group: 'AS 센터',
          title: asItem.brand,
          subtitle: asItem.phones
            .map((p) => (p.label ? `${p.label}: ${p.number}` : p.number))
            .join(' · '),
          badge: mainPhone,
          copyText: `${asItem.brand} 고객센터: ${mainPhone}`,
          phoneHref: mainPhone
            ? `tel:${mainPhone.replace(/[^0-9]/g, '')}`
            : undefined,
          onSelect: () => {
            onClose();
            onOpenAsCenterModal();
          },
        });
      });

    PLUX_AS_GROUPS.forEach((grp) => {
      grp.entries.forEach((partner, pIdx) => {
        const mainPhone = partner.phones[0]?.number || '';
        if (
          list.filter((x) => x.group === 'AS 센터').length < 6 &&
          (matchSearch(partner.modelsDesc, q) ||
            matchSearch(partner.partnerName, q) ||
            matchSearch(grp.category, q))
        ) {
          list.push({
            id: `plux-${grp.category}-${pIdx}`,
            group: 'AS 센터',
            title: `[PLUX ${grp.category}] ${partner.partnerName}`,
            subtitle: `${partner.modelsDesc} · ${mainPhone}`,
            badge: mainPhone,
            copyText: `[플럭스 ${grp.category}] A/S(${partner.partnerName}): ${mainPhone}`,
            phoneHref: mainPhone
              ? `tel:${mainPhone.replace(/[^0-9]/g, '')}`
              : undefined,
            onSelect: () => {
              onClose();
              onOpenAsCenterModal();
            },
          });
        }
      });
    });

    // 5. 오늘 근무·휴무 직원
    todayStaffSnapshot
      .filter(
        (st) =>
          matchSearch(st.name, q) ||
          matchSearch(st.role, q) ||
          q.includes('근무') ||
          q.includes('휴무')
      )
      .slice(0, 5)
      .forEach((st) => {
        list.push({
          id: `staff-${st.name}`,
          group: '근무·휴무',
          title: `${st.name} (${st.role})`,
          subtitle: st.isOff
            ? `오늘 부재/휴무 (${st.code})`
            : `오늘 매장 정상 근무${st.code ? ` (${st.code})` : ''}`,
          badge: st.isOff ? `🔴 ${st.code}` : '🟢 근무중',
          onSelect: () => {
            onClose();
            onOpenScheduleModal();
          },
        });
      });

    // 6. 메뉴 일치 항목
    quickMenus
      .filter((m) => matchSearch(m.title, q) || matchSearch(m.subtitle, q))
      .slice(0, 3)
      .forEach((m) => list.push(m));

    return list;
  }, [
    query,
    customers,
    careDataset,
    installmentDataset,
    todayStaffSnapshot,
    onClose,
    onEnterQuoteMode,
    onNavigateStep,
    onOpenAsCenterModal,
    onOpenCardIssueModal,
    onOpenCustomerQuote,
    onOpenInstallmentModal,
    onOpenScheduleModal,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const isNaturalSentence =
    query.trim().length >= 6 &&
    (query.includes(' ') || /\d+\s*만/.test(query) || query.endsWith('줘'));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length > 0 ? (prev + 1) % results.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isNaturalSentence && results.length === 0) {
        const text = query.trim();
        onClose();
        onRunInAiCopilot(text);
        return;
      }
      const target = results[activeIndex];
      if (target) {
        target.onSelect();
      } else if (query.trim()) {
        const text = query.trim();
        onClose();
        onRunInAiCopilot(text);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleCopyItem = async (
    e: React.MouseEvent,
    id: string,
    text: string
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const groupIcon = (group: OmnibarResultItem['group']) => {
    switch (group) {
      case '고객 CRM':
        return <User className="w-4 h-4 text-amber-500" />;
      case '안심케어·이사':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case '무이자 할부':
        return <CreditCard className="w-4 h-4 text-sky-500" />;
      case 'AS 센터':
        return <Wrench className="w-4 h-4 text-rose-500" />;
      case '근무·휴무':
        return <Calendar className="w-4 h-4 text-indigo-500" />;
      default:
        return <Calculator className="w-4 h-4 text-[#8C5A32]" />;
    }
  };

  const modalCls = isDark
    ? 'bg-[#141925] text-slate-100 border-white/15'
    : 'bg-white text-[#18181B] border-[#D6D0C4]';

  return (
    <div
      className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-6 sm:pt-[10dvh] px-3 no-print"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden schedule-modal-enter ${modalCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 초고속 검색 입력 바 */}
        <div
          className={`px-4 py-3.5 border-b flex items-center gap-3 ${
            isDark ? 'border-white/10 bg-[#182030]' : 'border-[#E4DFD5] bg-[#FAF8F4]'
          }`}
        >
          <Search
            className={`w-5 h-5 shrink-0 ${
              isDark ? 'text-sky-400' : 'text-[#8C5A32]'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="고객명, 안심케어 단가, 무이자, AS 번호, 직원 초성(ㄱㅅㅇ) 또는 AI 명령 입력..."
            className="flex-1 bg-transparent text-base sm:text-sm font-bold focus:outline-none placeholder:opacity-55"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`px-2 py-1 rounded-lg text-[11px] font-black font-mono border cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-400'
                : 'bg-white border-[#D6D0C4] text-stone-500'
            }`}
          >
            ESC
          </button>
        </div>

        {/* AI 코파일럿 즉시 위임 배너 (검색어 입력 시 상단 상시 노출) */}
        {query.trim().length >= 2 && (
          <div
            className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 ${
              isDark
                ? 'bg-indigo-500/15 border-indigo-400/25'
                : 'bg-indigo-50/90 border-indigo-200/80'
            }`}
          >
            <div className="min-w-0 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-xs font-black truncate">
                AI 비서에게 지시: "{query.trim()}"
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const text = query.trim();
                onClose();
                onRunInAiCopilot(text);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shrink-0 cursor-pointer schedule-tactile"
            >
              ✦ AI 코파일럿 실행 →
            </button>
          </div>
        )}

        {/* 결과 리스트 */}
        <div className="max-h-[60dvh] overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-xs sm:text-sm font-black opacity-80">
                일치하는 로컬 항목이 없습니다.
              </p>
              <p className="text-xs opacity-60">
                Enter 키를 누르시면 AI 코파일럿이 자연어 명령으로 분석해 견적·고객·휴무표를 처리합니다.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const selected = idx === activeIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                  className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    selected
                      ? isDark
                        ? 'bg-[#222C42] border border-sky-400/35'
                        : 'bg-[#F4ECE1] border border-[#D8C3A8]'
                      : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-[#0B0E14]' : 'bg-[#FAF8F4] border border-[#E4DFD5]'
                      }`}
                    >
                      {groupIcon(item.group)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            isDark
                              ? 'bg-white/10 text-slate-300'
                              : 'bg-stone-200/80 text-stone-700'
                          }`}
                        >
                          {item.group}
                        </span>
                        <span className="text-xs sm:text-sm font-black truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-70 font-medium truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${
                          isDark
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-white text-[#18181B] border border-[#D6D0C4]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.copyText && (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleCopyItem(e, item.id, item.copyText!)
                        }
                        title="코드/안내 복사"
                        className={`p-1.5 rounded-xl border cursor-pointer ${
                          isDark
                            ? 'bg-[#151A25] border-white/10 hover:bg-white/10'
                            : 'bg-white border-[#D6D0C4] hover:bg-stone-100'
                        }`}
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {item.phoneHref && (
                      <a
                        href={item.phoneHref}
                        onClick={(e) => e.stopPropagation()}
                        title="즉시 전화"
                        className="p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 단축키 힌트 바 */}
        <div
          className={`px-4 py-2 border-t text-[11px] font-bold flex items-center justify-between ${
            isDark
              ? 'bg-[#10141F] border-white/10 text-slate-400'
              : 'bg-[#FAF8F4] border-[#E4DFD5] text-[#78716C]'
          }`}
        >
          <span>⚡ 대기시간 0초 통합 검색 (초성 지원)</span>
          <span className="hidden sm:inline font-mono">
            ↑↓ 이동 · Enter 실행 · Ctrl+K 열기
          </span>
        </div>
      </div>
    </div>
  );
};
