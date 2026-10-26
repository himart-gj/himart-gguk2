import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  GitHubSyncConfig,
  loadGitHubSyncConfig,
  saveGitHubSyncConfig,
} from './careTableParser';
import {
  compressImageFile,
  getEffectiveGeminiApiKey,
} from './aiImageParser';

export { loadGitHubSyncConfig, saveGitHubSyncConfig };
export type { GitHubSyncConfig };

export type InstallmentCellKind =
  | 'free' // 무이자 (노란색)
  | 'partial' // 부분무이자 (연분홍)
  | 'sub-free' // 구독 전용 무이자 (파란 테두리/배경 + 구독전용 빨간 글씨)
  | 'interest' // 고객유이자 / 저리할부
  | 'disabled' // 결제불가 (진회색)
  | 'note'; // 기타 안내

export interface InstallmentCellData {
  kind: InstallmentCellKind;
  main: string;
  sub?: string;
}

export interface InstallmentCardColumnDef {
  id: string;
  brand: string;
  subName: string;
  rows: Record<string, InstallmentCellData>;
}

export interface InstallmentQuickSummaryCardItem {
  brandKey: string;
  brandTitle: string;
  badgeColor: string;
  freeInstallment: string;
  partialInstallment: string;
  subInstallment: string;
  specialNotes: string[];
}

export interface InstallmentDataset {
  updatedAt: string;
  fileName: string;
  versionTitle: string;
  warningBanner1: string;
  warningBanner2: string;
  columns: InstallmentCardColumnDef[];
  quickSummaries: InstallmentQuickSummaryCardItem[];
}

export const INSTALLMENT_ROW_LABELS = [
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

const INSTALLMENT_STORAGE_KEY = 'himart_gj_installment_dataset_v1';
const REMOTE_INSTALLMENT_JSON_PATH = './card-installment-data.json';

const f = (main = '무이자', sub?: string): InstallmentCellData => ({
  kind: 'free',
  main,
  sub,
});
const p = (rounds: string, main = '부분무이자'): InstallmentCellData => ({
  kind: 'partial',
  main,
  sub: `고객부담: ${rounds}`,
});
const sf = (
  main = '무이자',
  sub = '구독 전용 (일반상품 적용불가)'
): InstallmentCellData => ({
  kind: 'sub-free',
  main,
  sub,
});
const u = (main = '고객유이자', sub?: string): InstallmentCellData => ({
  kind: 'interest',
  main,
  sub,
});
const x = (main = '결제불가', sub?: string): InstallmentCellData => ({
  kind: 'disabled',
  main,
  sub,
});
const n = (main: string, sub?: string): InstallmentCellData => ({
  kind: 'note',
  main,
  sub,
});

export const DEFAULT_INSTALLMENT_COLUMNS: InstallmentCardColumnDef[] = [
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

export const DEFAULT_QUICK_SUMMARY_CARDS: InstallmentQuickSummaryCardItem[] = [
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

export const DEFAULT_INSTALLMENT_DATASET: InstallmentDataset = {
  updatedAt: '2026-10-01 09:00',
  fileName: "10월 카드사별 무이자·부분무이자 할부 행사표.json",
  versionTitle: "'26년 10월 카드사별 무이자 · 부분무이자 할부 행사",
  warningBanner1:
    '⚠️ 롯데카드 8/1(토)부 신규/추가 발급 불가 (기존 고객 교체발급 가능)',
  warningBanner2:
    '⚠️ 법인 / 개인사업자 / 체크 / 하이브리드 / BC(일부 제외) / 해외 / 가족카드는 행사 적용 불가',
  columns: DEFAULT_INSTALLMENT_COLUMNS,
  quickSummaries: DEFAULT_QUICK_SUMMARY_CARDS,
};

export function loadLocalInstallmentDataset(): InstallmentDataset {
  try {
    const raw = localStorage.getItem(INSTALLMENT_STORAGE_KEY);
    if (!raw) return DEFAULT_INSTALLMENT_DATASET;
    const parsed = JSON.parse(raw) as InstallmentDataset;
    if (
      parsed &&
      Array.isArray(parsed.columns) &&
      parsed.columns.length > 0 &&
      Array.isArray(parsed.quickSummaries)
    ) {
      return parsed;
    }
    return DEFAULT_INSTALLMENT_DATASET;
  } catch {
    return DEFAULT_INSTALLMENT_DATASET;
  }
}

export function saveLocalInstallmentDataset(dataset: InstallmentDataset): void {
  try {
    localStorage.setItem(INSTALLMENT_STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchRemoteInstallmentDataset(): Promise<InstallmentDataset | null> {
  try {
    const res = await fetch(
      `${REMOTE_INSTALLMENT_JSON_PATH}?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as InstallmentDataset;
    if (
      data &&
      Array.isArray(data.columns) &&
      data.columns.length > 0 &&
      Array.isArray(data.quickSummaries)
    ) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function downloadInstallmentDatasetAsJson(
  dataset: InstallmentDataset
): void {
  const jsonStr = JSON.stringify(dataset, null, 2);
  const blob = new Blob([jsonStr], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'card-installment-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function encodeUtf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(sub));
  }
  return btoa(binary);
}

export async function pushInstallmentDatasetToGitHub(
  dataset: InstallmentDataset,
  config: GitHubSyncConfig
): Promise<{ ok: boolean; message: string }> {
  const repo = config.repo.trim().replace(/^\/+|\/+$/g, '');
  const branch = (config.branch || 'main').trim();
  const token = config.token.trim();
  const filePath = 'public/card-installment-data.json';

  if (!repo || !token) {
    return {
      ok: false,
      message: 'GitHub 저장소(owner/repo)와 토큰(PAT)이 설정되지 않았습니다.',
    };
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    let sha: string | undefined;
    const getRes = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(branch)}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing?.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return {
        ok: false,
        message: `GitHub 파일 조회 실패 (${getRes.status}): ${errText.slice(0, 120)}`,
      };
    }

    const jsonString = JSON.stringify(dataset, null, 2);
    const contentBase64 = encodeUtf8ToBase64(jsonString);

    const putBody: Record<string, unknown> = {
      message: `chore(installment): update card-installment-data.json (${dataset.versionTitle})`,
      content: contentBase64,
      branch,
    };
    if (sha) {
      putBody.sha = sha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return {
        ok: false,
        message: `GitHub 업로드 실패 (${putRes.status}): ${errText.slice(0, 150)}`,
      };
    }

    return {
      ok: true,
      message:
        '✅ GitHub 저장소에 무이자 할부 행사표가 자동 반영되었습니다! (약 1~2분 내 전 직원 앱에 자동 동기화됩니다)',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `네트워크 오류: ${err?.message || '알 수 없는 오류'}`,
    };
  }
}

/**
 * 요약 카드(quickSummaries)를 columns 데이터 기반으로 자동 재생성/보강
 */
export function buildQuickSummariesFromColumns(
  columns: InstallmentCardColumnDef[],
  fallbackSummaries: InstallmentQuickSummaryCardItem[] = DEFAULT_QUICK_SUMMARY_CARDS
): InstallmentQuickSummaryCardItem[] {
  const brandMeta: {
    brandKey: string;
    matchBrand: string;
    brandTitle: string;
    badgeColor: string;
  }[] = [
    {
      brandKey: '롯데',
      matchBrand: '롯데',
      brandTitle: '롯데카드 (멤버스 / 모바일 / HI-Plan / 클래스)',
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      brandKey: '우리',
      matchBrand: '우리',
      brandTitle: '우리카드 (제휴카드 / 일반개인 신용)',
      badgeColor: 'bg-sky-600 text-white',
    },
    {
      brandKey: 'KB국민',
      matchBrand: 'KB',
      brandTitle: 'KB국민카드 (일반개인 신용)',
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      brandKey: '신한',
      matchBrand: '신한',
      brandTitle: '신한카드 (제휴카드 / 심플플러스 & 일반개인)',
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      brandKey: '삼성',
      matchBrand: '삼성',
      brandTitle: '삼성카드 (제휴카드 / 일반개인 신용)',
      badgeColor: 'bg-indigo-600 text-white',
    },
    {
      brandKey: 'NH농협',
      matchBrand: '농협',
      brandTitle: 'NH농협카드 (일반개인 신용)',
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      brandKey: '하나',
      matchBrand: '하나',
      brandTitle: '하나카드 (제휴카드 / 일반개인)',
      badgeColor: 'bg-teal-600 text-white',
    },
    {
      brandKey: '광주',
      matchBrand: '광주',
      brandTitle: '광주카드 (제휴카드)',
      badgeColor: 'bg-cyan-700 text-white',
    },
    {
      brandKey: 'BC',
      matchBrand: 'BC',
      brandTitle: 'BC카드 (일반개인 신용)',
      badgeColor: 'bg-red-700 text-white',
    },
    {
      brandKey: '현대',
      matchBrand: '현대',
      brandTitle: '현대카드 (일반신용)',
      badgeColor: 'bg-slate-800 text-white',
    },
  ];

  return brandMeta.map((meta) => {
    const matchedCols = columns.filter((c) =>
      c.brand.includes(meta.matchBrand)
    );
    const existing = fallbackSummaries.find(
      (s) => s.brandKey === meta.brandKey
    );
    if (matchedCols.length === 0) {
      return (
        existing || {
          brandKey: meta.brandKey,
          brandTitle: meta.brandTitle,
          badgeColor: meta.badgeColor,
          freeInstallment: '-',
          partialInstallment: '-',
          subInstallment: '-',
          specialNotes: [],
        }
      );
    }

    const freeLines: string[] = [];
    const partialLines: string[] = [];
    const subLines: string[] = [];
    const noteLines: string[] = [];

    matchedCols.forEach((col) => {
      const freeMonths: string[] = [];
      const partialMonths: string[] = [];
      const subMonths: string[] = [];

      INSTALLMENT_ROW_LABELS.forEach((rLabel) => {
        const cell = col.rows[rLabel];
        if (!cell) return;
        const shortM = rLabel.replace('(비고)', '');
        if (rLabel === '기타 안내') {
          if (cell.main && cell.main !== '-') {
            noteLines.push(`${col.subName}: ${cell.main}`);
          }
          return;
        }
        if (cell.kind === 'free') {
          freeMonths.push(
            cell.sub ? `${shortM}(${cell.main}·${cell.sub})` : `${shortM}(${cell.main})`
          );
        } else if (cell.kind === 'partial') {
          partialMonths.push(
            cell.sub ? `${shortM}(${cell.sub})` : `${shortM}(${cell.main})`
          );
        } else if (cell.kind === 'sub-free') {
          subMonths.push(`${shortM}(${cell.main})`);
        }
      });

      const prefix = matchedCols.length > 1 ? `• [${col.subName}] ` : '• ';
      if (freeMonths.length > 0) {
        freeLines.push(`${prefix}${freeMonths.join(', ')}`);
      }
      if (partialMonths.length > 0) {
        partialLines.push(`${prefix}${partialMonths.join(', ')}`);
      }
      if (subMonths.length > 0) {
        subLines.push(`${prefix}${subMonths.join(', ')} (구독 전용)`);
      }
    });

    return {
      brandKey: meta.brandKey,
      brandTitle: meta.brandTitle,
      badgeColor: meta.badgeColor,
      freeInstallment:
        freeLines.length > 0 ? freeLines.join('\n') : '• 무이자 할부 없음',
      partialInstallment:
        partialLines.length > 0
          ? partialLines.join('\n')
          : '• 부분무이자 없음',
      subInstallment:
        subLines.length > 0
          ? subLines.join('\n')
          : '• 구독 전용 무이자 없음',
      specialNotes:
        noteLines.length > 0
          ? noteLines
          : existing?.specialNotes || [],
    };
  });
}

function classifyCellText(rawText: string, rowLabel: string): InstallmentCellData {
  if (rowLabel === '기타 안내') {
    return {
      kind: 'note',
      main: rawText.trim() || '-',
    };
  }
  const t = rawText.trim();
  if (!t || t === '-') {
    return { kind: 'interest', main: '고객유이자' };
  }
  if (t.includes('구독') && t.includes('무이자')) {
    return {
      kind: 'sub-free',
      main: t.includes('60') ? '60개월 무이자' : '무이자',
      sub: '구독 전용, 일반상품 적용불가',
    };
  }
  if (t.includes('부분') || t.includes('회차')) {
    const subMatch = t.match(/\(([^)]+)\)/);
    return {
      kind: 'partial',
      main: '부분무이자',
      sub: subMatch ? subMatch[1] : t.replace('부분무이자', '').trim() || undefined,
    };
  }
  if (t.includes('불가') || t.includes('미운영') || t === 'X' || t === 'x') {
    return {
      kind: 'disabled',
      main: '결제불가',
    };
  }
  if (t.includes('무이자')) {
    const lines = t.split(/\n|\//).map((s) => s.trim()).filter(Boolean);
    return {
      kind: 'free',
      main: lines[0] || '무이자',
      sub: lines.slice(1).join(' / ') || undefined,
    };
  }
  if (t.includes('저리') || t.includes('유이자') || t.includes('%')) {
    const lines = t.split(/\n|\//).map((s) => s.trim()).filter(Boolean);
    return {
      kind: 'interest',
      main: lines[0] || '고객유이자',
      sub: lines.slice(1).join(' / ') || undefined,
    };
  }
  return {
    kind: 'interest',
    main: t,
  };
}

/**
 * 사진(JPG/PNG), 엑셀(.xlsx), JSON 파일을 업로드받아 InstallmentDataset으로 변환
 */
export async function parseInstallmentFile(
  file: File,
  currentDataset: InstallmentDataset
): Promise<InstallmentDataset> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const updatedAt = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

  // 1) JSON 파일인 경우
  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as InstallmentDataset;
    if (parsed && Array.isArray(parsed.columns) && parsed.columns.length > 0) {
      return {
        ...parsed,
        updatedAt,
        fileName: file.name,
        quickSummaries:
          Array.isArray(parsed.quickSummaries) &&
          parsed.quickSummaries.length > 0
            ? parsed.quickSummaries
            : buildQuickSummariesFromColumns(parsed.columns),
      };
    }
    throw new Error('올바른 무이자 할부 JSON 파일 형식이 아닙니다.');
  }

  // 2) 엑셀(.xlsx, .xls, .csv) 파일인 경우
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });

    // 복사본 생성 후 엑셀 행에서 개월수 매칭 업데이트
    const nextCols: InstallmentCardColumnDef[] = JSON.parse(
      JSON.stringify(currentDataset.columns)
    );

    let detectedTitle = currentDataset.versionTitle;
    for (const r of rows.slice(0, 5)) {
      const joined = r.map((c) => String(c || '').trim()).join(' ');
      if (joined.includes('무이자') && joined.includes('월')) {
        detectedTitle = joined.slice(0, 55);
        break;
      }
    }

    for (const r of rows) {
      const firstCell = String(r[0] || '').trim();
      const matchedRowLabel = INSTALLMENT_ROW_LABELS.find(
        (lbl) =>
          firstCell === lbl ||
          firstCell.startsWith(lbl.replace('(비고)', ''))
      );
      if (matchedRowLabel) {
        nextCols.forEach((col, idx) => {
          const val = String(r[idx + 1] ?? '').trim();
          if (val) {
            col.rows[matchedRowLabel] = classifyCellText(val, matchedRowLabel);
          }
        });
      }
    }

    return {
      ...currentDataset,
      updatedAt,
      fileName: file.name,
      versionTitle: detectedTitle,
      columns: nextCols,
      quickSummaries: buildQuickSummariesFromColumns(
        nextCols,
        currentDataset.quickSummaries
      ),
    };
  }

  // 3) 이미지(JPG/PNG 등) 파일인 경우 — Gemini Vision AI 자동 파싱
  const apiKey = getEffectiveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API 키가 설정되어 있지 않아 사진 인식을 사용할 수 없습니다.'
    );
  }

  const { base64Data, mimeType } = await compressImageFile(file);
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `당신은 롯데하이마트 카드사별 무이자/부분무이자 할부 행사표 이미지를 정확하게 읽어내는 전문 데이터 파서입니다.
제공된 무이자 할부 행사표 이미지를 분석하여 아래 JSON 구조로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.

카드 컬럼 ID 목록 (이 ID들을 그대로 사용):
- "lotte-members": 롯데카드 (멤버스 제휴카드)
- "lotte-mobile": 롯데카드 (모바일 제휴카드)
- "lotte-hiplan": 롯데카드 (HI-Plan & 일반신용)
- "lotte-class": 롯데카드 (클래스 제휴카드)
- "hyundai-general": 현대카드 (일반신용)
- "woori-affiliate": 우리카드 (제휴카드)
- "woori-general": 우리카드 (일반개인 신용카드)
- "gwangju-affiliate": 광주카드 (제휴카드)
- "kb-general": KB국민 (일반개인 신용카드)
- "shinhan-affiliate": 신한카드 (제휴카드)
- "shinhan-general": 신한카드 (심플플러스 & 일반개인)
- "hana-all": 하나카드 (제휴카드 / 일반개인)
- "nh-general": NH농협 (일반개인 신용카드)
- "samsung-affiliate": 삼성카드 (제휴카드)
- "samsung-general": 삼성카드 (일반개인 신용카드)
- "bc-general": BC카드 (일반개인 신용카드)

할부 개월 행 키 목록 (이 키들을 그대로 사용):
["2개월","3개월","4개월","5개월","6개월(비고)","7개월","8개월","10개월(비고)","11개월(비고)","12개월(비고)","18개월(비고)","24개월(비고)","36개월(비고)","48/60개월(비고)","기타 안내"]

셀 kind 값 규칙:
- "free": 무이자 할부 (예: main: "무이자", sub: "5만원 이상")
- "partial": 부분무이자 (예: main: "부분무이자", sub: "고객부담: 1,2회차")
- "sub-free": 구독 전용 무이자 (예: main: "무이자", sub: "구독 전용, 일반상품 적용불가")
- "interest": 고객유이자 또는 저리할부 (예: main: "고객유이자", sub: "연이자 5.5%")
- "disabled": 결제불가 (예: main: "결제불가")
- "note": 기타 안내 행 전용 (예: main: "특이사항 요약")

반환 JSON 스키마:
{
  "versionTitle": "예: '26년 11월 카드사별 무이자 · 부분무이자 할부 행사",
  "warningBanner1": "상단 핵심 경고문 1 (없으면 빈 문자열)",
  "columns": [
    {
      "id": "lotte-members",
      "rows": {
        "2개월": { "kind": "free", "main": "무이자", "sub": "5만원 이상" }
      }
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
  });

  const rawText = (response.text || '').trim();
  const cleanedJson = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsedAi = JSON.parse(cleanedJson);
  const nextCols: InstallmentCardColumnDef[] = JSON.parse(
    JSON.stringify(currentDataset.columns)
  );

  if (Array.isArray(parsedAi.columns)) {
    for (const aiCol of parsedAi.columns) {
      const targetCol = nextCols.find((c) => c.id === aiCol.id);
      if (targetCol && aiCol.rows && typeof aiCol.rows === 'object') {
        for (const rLabel of INSTALLMENT_ROW_LABELS) {
          const cellObj = aiCol.rows[rLabel];
          if (cellObj && cellObj.main) {
            targetCol.rows[rLabel] = {
              kind: cellObj.kind || 'interest',
              main: String(cellObj.main),
              sub: cellObj.sub ? String(cellObj.sub) : undefined,
            };
          }
        }
      }
    }
  }

  const nextVersionTitle =
    typeof parsedAi.versionTitle === 'string' && parsedAi.versionTitle.trim()
      ? parsedAi.versionTitle.trim()
      : currentDataset.versionTitle;

  const nextWarning1 =
    typeof parsedAi.warningBanner1 === 'string' &&
    parsedAi.warningBanner1.trim()
      ? parsedAi.warningBanner1.trim()
      : currentDataset.warningBanner1;

  return {
    updatedAt,
    fileName: file.name,
    versionTitle: nextVersionTitle,
    warningBanner1: nextWarning1,
    warningBanner2: currentDataset.warningBanner2,
    columns: nextCols,
    quickSummaries: buildQuickSummariesFromColumns(
      nextCols,
      currentDataset.quickSummaries
    ),
  };
}
