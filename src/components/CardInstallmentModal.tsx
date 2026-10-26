import React, { useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  Info,
  LayoutGrid,
  Table2,
  X,
} from 'lucide-react';

interface CardInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CellKind =
  | 'free' // 무이자 (노란색)
  | 'partial' // 부분무이자 (연분홍)
  | 'sub-free' // 구독 전용 무이자 (파란 테두리/배경 + 구독전용 빨간 글씨)
  | 'interest' // 고객유이자 / 저리할부
  | 'disabled' // 결제불가 (진회색)
  | 'note'; // 기타 안내

interface CellData {
  kind: CellKind;
  main: string;
  sub?: string;
}

interface CardColumnDef {
  id: string;
  brand: string;
  subName: string;
  rows: Record<string, CellData>;
}

const ROW_LABELS = [
  '2개월',
  '3개월',
  '4개월',
  '5개월',
  '6개월(비고)',
  '7개월',
  '8개월',
  '10개월(비고)',
  '11개월(비고)',
  '12개월(비고)',
  '18개월(비고)',
  '24개월(비고)',
  '36개월(비고)',
  '48/60개월(비고)',
  '기타 안내',
] as const;

const f = (main = '무이자', sub?: string): CellData => ({
  kind: 'free',
  main,
  sub,
});
const p = (rounds: string, main = '부분무이자'): CellData => ({
  kind: 'partial',
  main,
  sub: `고객부담: ${rounds}`,
});
const sf = (main = '무이자', sub = '구독 전용 (일반상품 적용불가)'): CellData => ({
  kind: 'sub-free',
  main,
  sub,
});
const u = (main = '고객유이자', sub?: string): CellData => ({
  kind: 'interest',
  main,
  sub,
});
const x = (main = '결제불가', sub?: string): CellData => ({
  kind: 'disabled',
  main,
  sub,
});
const n = (main: string, sub?: string): CellData => ({
  kind: 'note',
  main,
  sub,
});

const CARD_COLUMNS: CardColumnDef[] = [
  // 1. 롯데카드 (4종)
  {
    id: 'lotte-members',
    brand: '롯데카드',
    subName: '멤버스 제휴카드',
    rows: {
      '2개월': f('무이자', '5만원 이상'),
      '3개월': f('무이자', '5만원 이상'),
      '4개월': f('무이자', '5만원 이상'),
      '5개월': f('무이자', '5만원 이상'),
      '6개월(비고)': p('1회차'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2회차'),
      '11개월(비고)': u(),
      '12개월(비고)': f('★무이자★', '100만↑ 결제 시'),
      '18개월(비고)': x(),
      '24개월(비고)': f(
        '조건부무이자',
        '40~50만미만 전품목 / 초과건 특정품목'
      ),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': sf('60개월 무이자', '구독 전용'),
      '기타 안내': n(
        '롯데 2~5개월(제휴포함) 100만↑: 고객무이자, 지점 1% 수수료 / 멤버스 24개월: 특정품목 고객무이자, 지점 3.5% 수수료'
      ),
    },
  },
  {
    id: 'lotte-mobile',
    brand: '롯데카드',
    subName: '모바일 제휴카드',
    rows: {
      '2개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '3개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '4개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '5개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '6개월(비고)': p('1회차'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3회차'),
      '18개월(비고)': x(),
      '24개월(비고)': u('고객유이자', '연이자 5.5%'),
      '36개월(비고)': u('고객유이자', '연이자 6.9%'),
      '48/60개월(비고)': u('고객유이자', '48/60만↑ 결제, 연이자 8%'),
      '기타 안내': n(
        '롯데 2~5개월(제휴포함) 100만↑: 고객무이자, 지점 1% 수수료지급'
      ),
    },
  },
  {
    id: 'lotte-hiplan',
    brand: '롯데카드',
    subName: 'HI-Plan & 일반신용',
    rows: {
      '2개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '3개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '4개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '5개월': f('100만↑ 무이자', '※100만 미만 일시불 외 결제불가'),
      '6개월(비고)': p('1회차'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3회차'),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': u('고객유이자', '48/60만↑ 결제, 연이자 8%'),
      '기타 안내': n(
        '롯데 2~5개월(제휴포함) 100만↑: 고객무이자, 지점 1% 수수료지급'
      ),
    },
  },
  {
    id: 'lotte-class',
    brand: '롯데카드',
    subName: '클래스 제휴카드',
    rows: {
      '2개월': f('무이자', '5만원 이상'),
      '3개월': f('무이자', '5만원 이상'),
      '4개월': f('무이자', '5만원 이상'),
      '5개월': f('무이자', '5만원 이상'),
      '6개월(비고)': p('1회차'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3회차'),
      '18개월(비고)': x(),
      '24개월(비고)': f(
        '조건부무이자',
        '5~40만미만 이사/서비스, 40~50만미만 전품목, 초과건 특정품목'
      ),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': sf('60개월 무이자', '구독 전용 (48개월 미운영)'),
      '기타 안내': n(
        '48개월 미운영 / 클래스 24개월: 지점 3.5% 수수료 (※수수료 고객 수취)'
      ),
    },
  },

  // 2. 현대카드
  {
    id: 'hyundai-general',
    brand: '현대카드',
    subName: '일반신용',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': u(),
      '11개월(비고)': u(),
      '12개월(비고)': u(),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('제휴카드 운영종료'),
    },
  },

  // 3. 우리카드 (2종)
  {
    id: 'woori-affiliate',
    brand: '우리카드',
    subName: '제휴카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': f('무이자'),
      '5개월': f('무이자'),
      '6개월(비고)': f('무이자'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4,5회차'),
      '18개월(비고)': x(),
      '24개월(비고)': u('고객유이자', '연이자 6.0%'),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': x(),
      '기타 안내': n('2~6개월 무이자 / 구독 36개월 무이자'),
    },
  },
  {
    id: 'woori-general',
    brand: '우리카드',
    subName: '일반개인 신용카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': f('무이자'),
      '5개월': f('무이자'),
      '6개월(비고)': f('무이자'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4,5회차'),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('2~6개월 무이자'),
    },
  },

  // 4. 광주카드
  {
    id: 'gwangju-affiliate',
    brand: '광주카드',
    subName: '제휴카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3회차'),
      '11개월(비고)': p('1,2,3회차'),
      '12개월(비고)': p('1,2,3회차'),
      '18개월(비고)': x(),
      '24개월(비고)': u('고객유이자', '40만↑ 결제, 연이자 5.5%'),
      '36개월(비고)': u('고객유이자', '40만↑ 결제, 연이자 5.5%'),
      '48/60개월(비고)': x(),
      '기타 안내': n('10~12개월 부분무이자(1~3회차)'),
    },
  },

  // 5. KB국민
  {
    id: 'kb-general',
    brand: 'KB국민',
    subName: '일반개인 신용카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': f('무이자', '10월 확대'),
      '5개월': f('무이자', '10월 확대'),
      '6개월(비고)': p('1,2,3회차'),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4,5회차'),
      '11개월(비고)': u(),
      '12개월(비고)': u('저리할부', '연이자 5.5%'),
      '18개월(비고)': u(),
      '24개월(비고)': u(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('12개월 5.5% 저리할부 / 10월 4,5개월 무이자 확대'),
    },
  },

  // 6. 신한카드 (2종)
  {
    id: 'shinhan-affiliate',
    brand: '신한카드',
    subName: '제휴카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4회차'),
      '11개월(비고)': u(),
      '12개월(비고)': x(),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': x(),
      '기타 안내': n('제휴 12~24개월 결제불가 / 구독 36개월 무이자'),
    },
  },
  {
    id: 'shinhan-general',
    brand: '신한카드',
    subName: '심플플러스 & 일반개인',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4,5회차'),
      '18개월(비고)': u(),
      '24개월(비고)': x(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('신한일반 2~3개월 무이자 적용 가능'),
    },
  },

  // 7. 하나카드
  {
    id: 'hana-all',
    brand: '하나카드',
    subName: '제휴카드 / 일반개인',
    rows: {
      '2개월': f('5만↑ 무이자'),
      '3개월': f('5만↑ 무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3,4회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4,5회차'),
      '18개월(비고)': x(),
      '24개월(비고)': u('고객유이자', '연이자 6.0%'),
      '36개월(비고)': u('고객유이자', '연이자 6.0%'),
      '48/60개월(비고)': x(),
      '기타 안내': n('2~3개월 5만원 이상 무이자'),
    },
  },

  // 8. NH농협
  {
    id: 'nh-general',
    brand: 'NH농협',
    subName: '일반개인 신용카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': p('1,2회차'),
      '5개월': p('1,2회차'),
      '6개월(비고)': p('1,2회차'),
      '7개월': p('1,2,3회차'),
      '8개월': p('1,2,3회차'),
      '10개월(비고)': p('1,2,3회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4회차'),
      '18개월(비고)': p('1,2,3,4,5회차'),
      '24개월(비고)': p('1,2,3,4,5,6회차'),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('장기 부분무이자 최대 24개월 운영'),
    },
  },

  // 9. 삼성카드 (2종)
  {
    id: 'samsung-affiliate',
    brand: '삼성카드',
    subName: '제휴카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': p('1,2,3회차'),
      '8개월': u(),
      '10개월(비고)': u(),
      '11개월(비고)': p('1,2,3,4,5회차'),
      '12개월(비고)': u(),
      '18개월(비고)': x(),
      '24개월(비고)': u('고객유이자', '연이자 6.5%'),
      '36개월(비고)': sf('무이자', '구독 전용, 일반상품 적용불가'),
      '48/60개월(비고)': x(),
      '기타 안내': n('7개월·11개월 부분무이자 / 구독 36개월 무이자'),
    },
  },
  {
    id: 'samsung-general',
    brand: '삼성카드',
    subName: '일반개인 신용카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': p('1,2,3회차'),
      '8개월': u(),
      '10개월(비고)': u(),
      '11개월(비고)': p('1,2,3,4,5회차'),
      '12개월(비고)': u(),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('삼성일반 2~3개월 무이자 적용 가능'),
    },
  },

  // 10. BC카드
  {
    id: 'bc-general',
    brand: 'BC카드',
    subName: '일반개인 신용카드',
    rows: {
      '2개월': f('무이자'),
      '3개월': f('무이자'),
      '4개월': u(),
      '5개월': u(),
      '6개월(비고)': u(),
      '7개월': u(),
      '8개월': u(),
      '10개월(비고)': p('1,2,3회차'),
      '11개월(비고)': u(),
      '12개월(비고)': p('1,2,3,4회차'),
      '18개월(비고)': x(),
      '24개월(비고)': x(),
      '36개월(비고)': x(),
      '48/60개월(비고)': x(),
      '기타 안내': n('부분무이자 사전 신청 어플 및 ARS 가능 (1899-5772)'),
    },
  },
];

interface QuickSummaryCardItem {
  brandKey: string;
  brandTitle: string;
  badgeColor: string;
  freeInstallment: string;
  partialInstallment: string;
  subInstallment: string;
  specialNotes: string[];
}

const QUICK_SUMMARY_CARDS: QuickSummaryCardItem[] = [
  {
    brandKey: '롯데',
    brandTitle: '롯데카드 (멤버스 / 모바일 / HI-Plan / 클래스)',
    badgeColor: 'bg-rose-600 text-white',
    freeInstallment:
      '• 멤버스·클래스: 2~5개월 (5만원↑ 무이자)\n• 멤버스 12개월: ★100만원↑ 무이자★\n• 모바일·HI-Plan·일반: 2~5개월 (100만원↑ 시 무이자, 100만 미만 일시불 외 불가)\n• 멤버스·클래스 24개월: 조건부 무이자 (40~50만 미만 전품목, 초과건 특정품목)',
    partialInstallment:
      '• 6개월: 1회차 고객부담\n• 10개월: 1,2회차 고객부담\n• 12개월 (모바일/HI-Plan/클래스): 1,2,3회차 고객부담',
    subInstallment:
      '• 36개월 무이자 (멤버스 / HI-Plan·일반 / 클래스 — 구독 전용)\n• 60개월 무이자 (멤버스 / 클래스 — 구독 전용)',
    specialNotes: [
      '⚠️ 8/1(토)부 신규/추가 발급 불가 (기존 고객 교체발급 가능)',
      '롯데 2~5개월(제휴 포함) 100만원 이상 결제 시 고객 무이자 (지점 1% 수수료 차감)',
      '멤버스·클래스 24개월 특정품목 지점 3.5% 수수료 (클래스는 고객 수취)',
    ],
  },
  {
    brandKey: '우리',
    brandTitle: '우리카드 (제휴카드 / 일반개인 신용)',
    badgeColor: 'bg-sky-600 text-white',
    freeInstallment: '• 2 ~ 6개월 무이자 (제휴카드 / 일반개인 모두 적용)',
    partialInstallment:
      '• 10개월: 1,2,3,4회차 고객부담\n• 12개월: 1,2,3,4,5회차 고객부담',
    subInstallment: '• 제휴카드 36개월 무이자 (구독 전용, 일반상품 적용불가)',
    specialNotes: [
      '제휴카드 24개월: 고객유이자 (연이자 6.0%)',
      '18개월 / 48·60개월 결제불가',
    ],
  },
  {
    brandKey: 'KB국민',
    brandTitle: 'KB국민카드 (일반개인 신용)',
    badgeColor: 'bg-amber-500 text-slate-950',
    freeInstallment: '• 2 ~ 5개월 무이자 (10월 4,5개월 무이자 확대!)',
    partialInstallment:
      '• 6개월: 1,2,3회차 고객부담\n• 10개월: 1,2,3,4,5회차 고객부담',
    subInstallment: '• 36~60개월 결제불가',
    specialNotes: [
      '12개월: 연이자 5.5% (저리할부 운영)',
      '18개월·24개월: 고객유이자',
    ],
  },
  {
    brandKey: '신한',
    brandTitle: '신한카드 (제휴카드 / 심플플러스 & 일반개인)',
    badgeColor: 'bg-blue-600 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자 (제휴 및 신한일반 모두 적용 가능)',
    partialInstallment:
      '• 10개월 (제휴/일반): 1,2,3,4회차 고객부담\n• 12개월 (심플플러스/일반만 가능): 1,2,3,4,5회차 고객부담 (※제휴카드는 12~24개월 결제불가)',
    subInstallment: '• 제휴카드 36개월 무이자 (구독 전용, 일반상품 적용불가)',
    specialNotes: [
      '제휴카드는 12개월~24개월 할부 결제불가 (일반개인 카드는 12개월 부분무이자 가능)',
    ],
  },
  {
    brandKey: '삼성',
    brandTitle: '삼성카드 (제휴카드 / 일반개인 신용)',
    badgeColor: 'bg-indigo-600 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자 (제휴 및 삼성일반 모두 적용 가능)',
    partialInstallment:
      '• 7개월: 1,2,3회차 고객부담\n• 11개월: 1,2,3,4,5회차 고객부담 (※6, 8, 10, 12개월은 고객유이자)',
    subInstallment: '• 제휴카드 36개월 무이자 (구독 전용, 일반상품 적용불가)',
    specialNotes: [
      '삼성카드는 10·12개월이 아닌 7개월·11개월에 부분무이자가 적용됩니다!',
      '제휴카드 24개월: 고객유이자 (연이자 6.5%)',
    ],
  },
  {
    brandKey: 'NH농협',
    brandTitle: 'NH농협카드 (일반개인 신용)',
    badgeColor: 'bg-emerald-600 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자',
    partialInstallment:
      '• 4~6개월: 1,2회차 부담\n• 7~10개월: 1,2,3회차 부담\n• 12개월: 1,2,3,4회차 부담\n• 18개월: 1,2,3,4,5회차 부담\n• 24개월: 1,2,3,4,5,6회차 부담',
    subInstallment: '• 36~60개월 결제불가',
    specialNotes: [
      '전 카드사 중 유일하게 4~10개월, 12개월, 18개월, 24개월 장기 부분무이자 폭넓게 운영',
    ],
  },
  {
    brandKey: '하나',
    brandTitle: '하나카드 (제휴카드 / 일반개인)',
    badgeColor: 'bg-teal-600 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자 (5만원 이상 결제 시)',
    partialInstallment:
      '• 10개월: 1,2,3,4회차 고객부담\n• 12개월: 1,2,3,4,5회차 고객부담',
    subInstallment: '• 48/60개월 결제불가',
    specialNotes: ['24개월 · 36개월: 고객유이자 (연이자 6.0%)'],
  },
  {
    brandKey: '광주',
    brandTitle: '광주카드 (제휴카드)',
    badgeColor: 'bg-cyan-700 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자',
    partialInstallment: '• 10 ~ 12개월: 1,2,3회차 고객부담',
    subInstallment: '• 48/60개월 결제불가',
    specialNotes: ['24개월 · 36개월: 40만원 이상 결제 시 고객유이자 (연이자 5.5%)'],
  },
  {
    brandKey: 'BC',
    brandTitle: 'BC카드 (일반개인 신용)',
    badgeColor: 'bg-red-700 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자',
    partialInstallment:
      '• 10개월: 1,2,3회차 고객부담\n• 12개월: 1,2,3,4회차 고객부담',
    subInstallment: '• 18~60개월 결제불가',
    specialNotes: [
      '부분무이자 사전 신청: 페이북 어플 및 ARS에서 가능 (☎ 1899-5772)',
    ],
  },
  {
    brandKey: '현대',
    brandTitle: '현대카드 (일반신용)',
    badgeColor: 'bg-slate-800 text-white',
    freeInstallment: '• 2 ~ 3개월 무이자',
    partialInstallment: '• 없음 (4 ~ 12개월 모두 고객유이자)',
    subInstallment: '• 18~60개월 결제불가',
    specialNotes: ['제휴카드 운영종료'],
  },
];

const BRAND_FILTER_BUTTONS = [
  '전체',
  '롯데',
  '우리',
  'KB국민',
  '신한',
  '삼성',
  'NH농협',
  '하나',
  '광주',
  'BC',
  '현대',
] as const;

export const CardInstallmentModal: React.FC<CardInstallmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'summary'>('table');
  const [selectedBrand, setSelectedBrand] = useState<string>('전체');

  if (!isOpen) return null;

  const filteredColumns =
    selectedBrand === '전체'
      ? CARD_COLUMNS
      : CARD_COLUMNS.filter((col) => col.brand.includes(selectedBrand));

  const filteredQuickCards =
    selectedBrand === '전체'
      ? QUICK_SUMMARY_CARDS
      : QUICK_SUMMARY_CARDS.filter((c) => c.brandKey === selectedBrand);

  const renderCell = (cell: CellData) => {
    switch (cell.kind) {
      case 'free':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-amber-200/90 text-slate-950 font-black flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-extrabold text-rose-700 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'partial':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-rose-100 text-rose-900 font-extrabold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs font-black">
              {cell.main}
            </span>
            {cell.sub && (
              <span className="text-[10px] font-bold text-rose-700 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
      case 'sub-free':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-blue-50 border border-rose-500 text-blue-900 font-black flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-black text-rose-600 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'disabled':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-slate-600 text-slate-200 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[9px] text-slate-300 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'note':
        return (
          <div className="h-full w-full px-2 py-2 bg-slate-50 text-slate-800 font-bold text-[10px] sm:text-[11px] leading-snug text-left">
            {cell.main}
          </div>
        );
      case 'interest':
      default:
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-white text-slate-700 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-extrabold text-blue-700 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1440px] max-h-[94dvh] rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1) 모달 상단 헤더 */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black tracking-tight truncate">
                💳 &apos;26년 10월 카드사별 무이자 · 부분무이자 할부 행사
              </h2>
              <p className="text-[11px] text-slate-300 font-bold hidden sm:block">
                현재 입력 중인 견적 화면을 닫지 않고 언제든 바로 확인하실 수 있습니다
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-black transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* 2) 상단 핵심 경고 배너 2줄 + 뷰 전환 탭 & 카드사 필터 */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 py-3 space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            <div className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                ⚠️ 롯데카드 8/1(토)부 신규/추가 발급 불가 (기존 고객 교체발급 가능)
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black flex items-center gap-1.5">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                ⚠️ 법인 / 개인사업자 / 체크 / 하이브리드 / BC(일부 제외) / 해외 / 가족카드는 행사 적용 불가
              </span>
            </div>
          </div>

          {/* 탭 전환 + 카드사 필터 + 색상 범례 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 뷰 탭 */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  activeTab === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>📊 전체 비교표 (원본 표)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>🔍 카드사별 퀵 요약 카드</span>
              </button>
            </div>

            {/* 카드사 퀵 필터 버튼 */}
            <div className="flex items-center gap-1 flex-wrap">
              {BRAND_FILTER_BUTTONS.map((brand) => {
                const active = selectedBrand === brand;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setSelectedBrand(brand)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border transition cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>

            {/* 색상 범례 */}
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-black">
              <span className="px-2 py-0.5 rounded bg-amber-200/90 text-slate-950 border border-amber-400">
                ■ 무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                ■ 부분무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-rose-500">
                ■ 구독 전용 무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-600 text-slate-200">
                ■ 결제불가
              </span>
            </div>
          </div>
        </div>

        {/* 3) 본문 스크롤 영역 */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-slate-50">
          {/* ==================== [탭 1: 📊 전체 비교표] ==================== */}
          {activeTab === 'table' && (
            <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
              <table className="w-full border-collapse min-w-[1150px] table-fixed">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="sticky left-0 z-20 bg-slate-900 w-28 sm:w-32 px-2 py-2.5 text-xs font-black border-r border-b border-slate-700 text-center">
                      할부 개월
                    </th>
                    {filteredColumns.map((col) => (
                      <th
                        key={col.id}
                        className="px-2 py-2 text-center border-r border-b border-slate-700 align-middle"
                      >
                        <div className="text-xs font-black text-amber-300">
                          {col.brand}
                        </div>
                        <div className="text-[11px] font-extrabold text-white mt-0.5 leading-tight">
                          {col.subName}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROW_LABELS.map((rowLabel) => {
                    const isNoteRow = rowLabel === '기타 안내';
                    return (
                      <tr
                        key={rowLabel}
                        className="border-b border-slate-200 last:border-b-0"
                      >
                        <td
                          className={`sticky left-0 z-10 px-2 py-2 text-center font-black text-xs border-r border-slate-300 ${
                            isNoteRow
                              ? 'bg-slate-800 text-amber-300'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          {rowLabel}
                        </td>
                        {filteredColumns.map((col) => {
                          const cellData = col.rows[rowLabel] || u('-');
                          return (
                            <td
                              key={`${col.id}-${rowLabel}`}
                              className="p-0 border-r border-slate-200 last:border-r-0 align-stretch h-12"
                            >
                              {renderCell(cellData)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ==================== [탭 2: 🔍 카드사별 퀵 요약 카드] ==================== */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredQuickCards.map((card) => (
                <div
                  key={card.brandKey}
                  className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black ${card.badgeColor}`}
                      >
                        {card.brandTitle}
                      </span>
                    </div>

                    {/* 일반 무이자 */}
                    <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-300 space-y-1">
                      <div className="text-xs font-black text-amber-950">
                        ⭐ 일반 무이자 할부
                      </div>
                      <div className="text-xs font-extrabold text-slate-900 whitespace-pre-line leading-relaxed">
                        {card.freeInstallment}
                      </div>
                    </div>

                    {/* 부분무이자 */}
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                      <div className="text-xs font-black text-rose-800">
                        📌 부분무이자 (고객부담 회차)
                      </div>
                      <div className="text-xs font-bold text-slate-800 whitespace-pre-line leading-relaxed">
                        {card.partialInstallment}
                      </div>
                    </div>

                    {/* 구독 전용 무이자 */}
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-blue-900">
                        🔄 구독 전용 장기 무이자
                      </div>
                      <div className="text-xs font-extrabold text-rose-600 whitespace-pre-line leading-relaxed">
                        {card.subInstallment}
                      </div>
                    </div>
                  </div>

                  {/* 특이사항 */}
                  {card.specialNotes.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1">
                      <div className="text-[11px] font-black text-slate-700">
                        💡 특이사항 및 수수료 안내
                      </div>
                      <ul className="space-y-0.5 text-[11px] font-bold text-slate-600 list-disc list-inside">
                        {card.specialNotes.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4) 모달 하단 각주 */}
        <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold shrink-0">
          <span className="text-amber-300 font-black">
            ※ 롯데카드 수수료 예시: 롯데제휴카드로 100만원 5개월 할부결제 시 지점손익에서 1만원(1%) 차감
          </span>
          <span className="text-[11px] text-slate-400">
            ESC 또는 바깥 영역을 클릭하면 닫힙니다
          </span>
        </div>
      </div>
    </div>
  );
};
