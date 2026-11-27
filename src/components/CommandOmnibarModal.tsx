import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppStep } from '../types/proposal';
import {
  getOwnerDbPin,
  isOwnerMarketingDbUnlocked,
  verifyAndUnlockOwnerDb,
} from '../utils/marketingDbEngine';
import { CustomerItem } from '../crm/types/crm';
import { ADMIN_PIN_CODE, CareTableDataset, CareTableItem } from '../utils/careTableParser';
import { InstallmentDataset } from '../utils/installmentParser';
import { MAJOR_AS_CENTERS, PLUX_AS_GROUPS } from './QuickCenterModal';
import { loadPartnerLinks } from './PartnerLinksModal';
import { openPartnerManualModal } from './PartnerManualViewerModal';
import { readSessionCachedPartnerManuals } from '../utils/partnerManualSync';
import {
  getOrCreateMonthSchedule,
  isOffDayCode,
  loadAllSchedules,
} from './ScheduleModal';
import {
  BookOpen,
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
import {
  buildFreedSummaryCopyText,
  buildMassageChairCopyText,
  FREED_OPERATION_GROUPS,
  MASSAGE_CHAIR_LOGISTICS_ROWS,
  openStorePolicyModal,
} from './StorePolicyGuideView';
import { getEffectiveStoreDisplayName } from '../utils/shareQuoteCodec';

// 한글 초성 검색 엔진 ('ㅎㄱㄷ' -> '홍길동', 'ㅇㅇㅋ' -> '에어컨')
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
  isFriendMode?: boolean;
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
  group: '메뉴' | '고정 기준표' | '고객 CRM' | '안심케어·이사' | '무이자 할부' | 'AS 센터' | '근무·휴무';
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
  isFriendMode = false,
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
      inputRef.current?.focus({ preventScroll: true });
    }, 30);
  }, [isOpen]);

  // 오늘 기준 근무/휴무 스냅샷
  const todayStaffSnapshot = useMemo(() => {
    if (!isOpen || isFriendMode) return [];
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
  }, [isOpen, isFriendMode]);

  // 0.01초 로컬 통합 인덱싱 결과 산출
  const results = useMemo<OmnibarResultItem[]>(() => {
    const q = query.trim();
    const list: OmnibarResultItem[] = [];

    // 0) 스텔스 소유자 전용 코드 감지 (설정된 PIN 암호 입력 시에만 노출, 친구 모드 및 타 직원에게는 노출 0%)
    if (!isFriendMode && q.startsWith('#') && q.length >= 5) {
      const candidatePin = q.replace(/^#(?:db)?/i, '').trim();
      if (
        candidatePin &&
        (candidatePin === getOwnerDbPin() || candidatePin === ADMIN_PIN_CODE)
      ) {
        list.push({
          id: 'stealth-owner-db-unlock',
          group: '메뉴',
          title: '🔒 인스타 마케팅 DB관리 (관리자 전용) 잠금해제 · 열기',
          subtitle: '터치 시 내 기기 전용 비공개 메뉴를 활성화하고 바로 엽니다',
          badge: 'OWNER',
          onSelect: () => {
            verifyAndUnlockOwnerDb(candidatePin);
            onClose();
            onNavigateStep('marketing-db');
          },
        });
      }
    }

    // 1) 앱 빠른 메뉴 액션
    const ownerUnlocked = !isFriendMode && isOwnerMarketingDbUnlocked();
    const quickMenus: OmnibarResultItem[] = [
      ...(ownerUnlocked
        ? ([
            {
              id: 'menu-owner-marketing-db',
              group: '메뉴',
              title: '📊 인스타 마케팅 DB관리 (관리자 전용 비공개)',
              subtitle: '신규 · 문자전송 · 상담진행중 · 무응답 · 타직원인계 · 계약완료 통합관리',
              badge: '비공개',
              onSelect: () => {
                onClose();
                onNavigateStep('marketing-db');
              },
            },
          ] as OmnibarResultItem[])
        : []),
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
      ...(!isFriendMode
        ? ([
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
          ] as OmnibarResultItem[])
        : []),
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
        id: 'menu-freed-summary',
        group: '메뉴',
        title: '프리드 운영 상품 요약표 (일반 · 구독플러스 · 웅진플랜)',
        subtitle: '합산 최대 12개 가입 · 청구할인 / 카드납+캐시백 / 캐시백 가능여부 비교',
        badge: '상시고정',
        copyText: buildFreedSummaryCopyText(),
        onSelect: () => {
          onClose();
          openStorePolicyModal('freed');
        },
      },
      {
        id: 'menu-massage-guide',
        group: '메뉴',
        title: '안마의자 설치 · 폐가전회수 · 사다리차 지원 안내',
        subtitle: '코지마 · 세라젬 · 바디프랜드 · 제스파 · 누하스 당사/타사물류 기준',
        badge: '상시고정',
        copyText: buildMassageChairCopyText(),
        onSelect: () => {
          onClose();
          openStorePolicyModal('massage');
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
      ...(ownerUnlocked
        ? ([
            {
              id: 'menu-sub-landing-link',
              group: '메뉴',
              title: '내 랜딩페이지 · 구독 랜딩페이지 열기',
              subtitle: '가전구독 × 구독플러스 맞춤 혜택 시뮬레이터 (새 창 링크)',
              badge: '랜딩링크',
              copyText: 'https://himart-gj.github.io/himart-subscription-simulator/#/',
              onSelect: () => {
                onClose();
                window.open('https://himart-gj.github.io/himart-subscription-simulator/#/', '_blank', 'noopener,noreferrer');
              },
            },
            {
              id: 'menu-store-landing-link',
              group: '메뉴',
              title: '내 랜딩페이지 · 일반 매장랜딩페이지 열기',
              subtitle: '경기광주점 A·B동 쇼룸 & 1:1 통합 상담 예약 페이지 (새 창 링크)',
              badge: '랜딩링크',
              copyText: 'https://himart-gj.github.io/himart-11/',
              onSelect: () => {
                onClose();
                window.open('https://himart-gj.github.io/himart-11/', '_blank', 'noopener,noreferrer');
              },
            },
            {
              id: 'menu-sub-admin-link',
              group: '메뉴',
              title: '내 랜딩페이지 · 구독페이지 관리자페이지 열기',
              subtitle: '구독 시뮬레이터 품목 · 추천세트 · 정책 마스터 관리자 CMS (새 창 링크)',
              badge: '관리자링크',
              copyText: 'https://himart-gj.github.io/himart-subscription-simulator/#/admin',
              onSelect: () => {
                onClose();
                window.open('https://himart-gj.github.io/himart-subscription-simulator/#/admin', '_blank', 'noopener,noreferrer');
              },
            },
          ] as OmnibarResultItem[])
        : []),
      {
        id: 'menu-lg-sub-manual-direct',
        group: '메뉴' as const,
        title: '📘 LG전자 구독 전산등록 실무 교안 열기',
        subtitle: '63P 전수 수록 · 청약요청 · 주문확정 · 전자서명 · 외국인/회수비 기준표',
        badge: '보안교안',
        onSelect: () => {
          onClose();
          openPartnerManualModal({});
        },
      },
      ...(onOpenPartnerLinksModal
        ? [
            {
              id: 'menu-partner-hub',
              group: '메뉴' as const,
              title: '제휴 · 업무 바로가기 허브 열기',
              subtitle: 'LG구독 전산교안 · 방충망 · 입주청소 · 중고보상 · 하이프리드 수당 · SK청약',
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
    // 1. 고객 CRM (고객 최상위 orderNo + 모든 전표/견적 quotes[].orderNo 100% 매칭)
    customers
      .filter((c) => {
        if (c.deletedAt) return false;
        const cleanQNoHyphen = q.replace(/[-\s]/g, '');
        if (
          matchSearch(c.name, q) ||
          matchSearch(c.phone || '', q) ||
          matchSearch(c.items || '', q) ||
          matchSearch(c.orderNo || '', q) ||
          (cleanQNoHyphen &&
            (c.orderNo || '')
              .toLowerCase()
              .replace(/[-\s]/g, '')
              .includes(cleanQNoHyphen)) ||
          matchSearch(c.memo || '', q)
        ) {
          return true;
        }
        return (c.quotes || []).some(
          (qt) =>
            matchSearch(qt.orderNo || '', q) ||
            (cleanQNoHyphen &&
              (qt.orderNo || '')
                .toLowerCase()
                .replace(/[-\s]/g, '')
                .includes(cleanQNoHyphen)) ||
            matchSearch(qt.itemSummary || '', q) ||
            matchSearch(qt.title || '', q)
        );
      })
      .slice(0, 5)
      .forEach((c) => {
        const allOrderNos = Array.from(
          new Set(
            [
              (c.orderNo || '').trim(),
              ...(c.quotes || []).map((qt) => (qt.orderNo || '').trim()),
            ].filter(Boolean)
          )
        );
        const orderPrefix =
          allOrderNos.length > 0 ? `🧾 ${allOrderNos.join(' · ')} · ` : '';
        list.push({
          id: `cust-${c.id}`,
          group: '고객 CRM',
          title: `${c.name} (${c.phone || '연락처 미등록'})`,
          subtitle: `${orderPrefix}${c.items || '품목 미입력'} · 결제 ${(
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

    // 3-1. 비공개 클라우드 실무 교안 (인증 기기 세션 메모리 동적 인덱싱)
    Object.values(readSessionCachedPartnerManuals()).forEach((doc) => {
      if (matchSearch(`${doc.title} ${doc.version || ''} 전산 교안 매뉴얼`, q)) {
        list.push({
          id: `cloud-manual-root-${doc.id}`,
          group: '메뉴',
          title: `📘 ${doc.title}`,
          subtitle: `${doc.version || '실무 교안'} · 전체 ${doc.chapters.length}개 단계 열기`,
          badge: '보안교안',
          onSelect: () => {
            onClose();
            openPartnerManualModal({ manualId: doc.id });
          },
        });
      }
      doc.chapters.forEach((ch) => {
        const chBlob = [
          ch.title,
          ch.summary,
          ...(ch.keywords || []),
          ...(ch.callouts || []).map((c) => c.title),
        ].join(' ');
        if (matchSearch(chBlob, q)) {
          list.push({
            id: `cloud-manual-ch-${doc.id}-${ch.id}`,
            group: '고정 기준표',
            title: `📘 [교안 ${ch.number}] ${ch.title}`,
            subtitle: ch.summary,
            badge: ch.slideRange || '실무교안',
            onSelect: () => {
              onClose();
              openPartnerManualModal({ manualId: doc.id, chapterId: ch.id });
            },
          });
        }
      });
    });

    // 3-2. 제휴 · 업무 바로가기 허브 링크
    loadPartnerLinks()
      .filter(
        (pl) =>
          pl.id !== 'lg-sub-calc-portal' && pl.id !== 'lg-sub-manual-viewer' && !pl.internalAction &&
          (!q ||
            matchSearch(pl.title, q) ||
            matchSearch(pl.badgeText, q) ||
            matchSearch(pl.description, q))
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
            : `[${getEffectiveStoreDisplayName()}] ${pl.title} 안내\n👉 ${pl.url}`,
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
    if (!isFriendMode) {
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
    }

    // 5-2. 상시 고정 기준표 (프리드 운영 상품 요약 & 안마의자 물류 기준)
    FREED_OPERATION_GROUPS.filter(
      (grp) =>
        matchSearch(grp.groupLabel, q) ||
        matchSearch(grp.compactProductTitle, q) ||
        matchSearch(grp.customerTypeLabel, q) ||
        matchSearch('프리드 하이프리드 구독플러스 웅진플랜 롯데플랜 카드납 청구할인', q)
    ).forEach((grp) => {
      list.push({
        id: `policy-freed-${grp.id}`,
        group: '고정 기준표',
        title: `[프리드 요약] ${grp.compactProductTitle} (${grp.groupLabel})`,
        subtitle: `청구할인: ${grp.billingDiscount ? '가능' : '불가'} · 카드납+캐시백: ${
          grp.cardPayAndCashback ? '가능' : '불가'
        } · 캐시백: ${grp.cashback ? '가능' : '불가'}`,
        badge: '최대 12개',
        copyText: buildFreedSummaryCopyText(grp),
        onSelect: () => {
          onClose();
          openStorePolicyModal('freed');
        },
      });
    });

    MASSAGE_CHAIR_LOGISTICS_ROWS.filter(
      (mc) =>
        matchSearch(mc.brand, q) ||
        matchSearch(mc.keywords, q) ||
        matchSearch('안마의자 사다리차 폐가전회수 당사물류 타사물류 설치', q)
    ).forEach((mc) => {
      const w = `${mc.thirdPartyWasteOk ? 'O' : 'X'}${
        mc.thirdPartyWasteNote ? ` ${mc.thirdPartyWasteNote}` : ''
      }`;
      const l = `${mc.thirdPartyLadderOk ? 'O' : 'X'}${
        mc.thirdPartyLadderNote ? ` ${mc.thirdPartyLadderNote}` : ''
      }`;
      list.push({
        id: `policy-mc-${mc.id}`,
        group: '고정 기준표',
        title: `[안마의자 설치] ${mc.brand}`,
        subtitle: `당사물류: 전브랜드 회수·사다리차 전액지원 | 타사물류: 회수 ${w} · 사다리차 ${l}`,
        badge: mc.thirdPartyWasteOk && mc.thirdPartyLadderOk ? '타사 O·O' : '설치기준',
        copyText: buildMassageChairCopyText(mc),
        onSelect: () => {
          onClose();
          openStorePolicyModal('massage');
        },
      });
    });

    // 6. 메뉴 일치 항목
    quickMenus
      .filter((m) => matchSearch(m.title, q) || matchSearch(m.subtitle, q))
      .slice(0, 4)
      .forEach((m) => list.push(m));

    return list;
  }, [
    query,
    isFriendMode,
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
        return <User className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />;
      case '안심케어·이사':
        return <ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />;
      case '무이자 할부':
        return <CreditCard className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />;
      case 'AS 센터':
        return <Wrench className="w-4 h-4 text-[#059669] dark:text-emerald-400" />;
      case '고정 기준표':
        return <BookOpen className="w-4 h-4 text-[#E60012] dark:text-rose-400" />;
      case '근무·휴무':
        return <Calendar className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />;
      default:
        return <Calculator className="w-4 h-4 text-[#191F28] dark:text-slate-200" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-[2px] flex items-start justify-center pt-6 sm:pt-[10dvh] px-3 no-print animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-[20px] bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 border-t-[3px] border-t-[#E60012] shadow-2xl modal-kb-safe overflow-hidden schedule-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 초고속 검색 입력 바 */}
        <div className="px-4 py-3.5 border-b border-[#E5E8EB] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/70 flex items-center gap-3">
          <Search className="w-5 h-5 shrink-0 text-[#1B64DA] dark:text-blue-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isFriendMode
                ? '고객명, 안심케어 단가, 무이자, AS 번호 또는 AI 명령 입력...'
                : '고객명, 안심케어 단가, 무이자, AS 번호, 직원 초성(ㄱㅅㅇ) 또는 AI 명령 입력...'
            }
            className="flex-1 bg-transparent text-base sm:text-sm font-bold text-[#191F28] dark:text-slate-100 placeholder:text-[#8B95A1] dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-[11.5px] font-extrabold font-mono border bg-white dark:bg-slate-800 border-[#D1D6DB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* AI 코파일럿 즉시 위임 배너 (검색어 입력 시 상단 상시 노출) */}
        {query.trim().length >= 2 && (
          <div className="px-4 py-2.5 border-b border-[#BFDBFE] dark:border-blue-500/30 bg-[#EFF6FF] dark:bg-blue-500/12 flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0" />
              <span className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 truncate">
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
              className="px-3 py-1.5 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold shrink-0 transition-colors cursor-pointer schedule-tactile"
            >
              ✦ AI 코파일럿 실행 →
            </button>
          </div>
        )}

        {/* 결과 리스트 */}
        <div className="max-h-[60dvh] overflow-y-auto p-2 space-y-1 bg-white dark:bg-[#131C2E]">
          {results.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                일치하는 로컬 항목이 없습니다.
              </p>
              <p className="text-xs text-[#4E5968] dark:text-slate-400">
                {isFriendMode
                  ? 'Enter 키를 누르시면 AI 코파일럿이 자연어 명령으로 분석해 견적·고객·조견표를 처리합니다.'
                  : 'Enter 키를 누르시면 AI 코파일럿이 자연어 명령으로 분석해 견적·고객·휴무표를 처리합니다.'}
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
                      ? 'bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/35'
                      : 'border border-transparent hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700">
                      {groupIcon(item.group)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11.5px] font-bold px-1.5 py-0.5 rounded-md bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border border-[#E5E8EB] dark:border-slate-700">
                          {item.group}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium truncate mt-0.5 font-mono tabular-nums">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-lg text-[11.5px] font-bold font-mono tabular-nums bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30">
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
                        className="p-1.5 rounded-xl border bg-white dark:bg-slate-800 border-[#D1D6DB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-[#059669]" />
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
                        className="p-1.5 rounded-xl bg-[#059669] text-white hover:bg-emerald-700 transition-colors"
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
        <div className="px-4 py-2 border-t border-[#E5E8EB] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B1120]/80 text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 flex items-center justify-between">
          <span>⚡ 대기시간 0초 통합 검색 (초성 지원)</span>
          <span className="hidden sm:inline font-mono">
            ↑↓ 이동 · Enter 실행 · Ctrl+K 열기
          </span>
        </div>
      </div>
    </div>
  );
};
