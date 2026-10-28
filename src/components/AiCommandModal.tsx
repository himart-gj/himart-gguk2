import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AffiliateCardId,
  extractGeneralPlanData,
  GeneralCardType,
  GeneralHiPreedCounts,
  GeneralPlanData,
  HiPlusCounts,
  ProposalState,
  QuoteMode,
  SUB_CARE_OPTIONS,
  SubscriptionPeriod,
} from '../types/proposal';
import { extractQuotePayloadFromProposalState } from '../crm/components/SaveToCrmModal';
import { getCachedCustomers, saveCustomerQuote } from '../crm/services/gasApi';
import { CustomerItem, CustomerStatus } from '../crm/types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getFridayDateStr,
  getOffsetDateStr,
  getTodayStr,
  isUrgentCustomer,
} from '../crm/utils/date';
import { GEMINI_MODELS, getEffectiveGeminiApiKey } from '../utils/aiImageParser';
import {
  CareTableDataset,
  CareTableItem,
  fetchRemoteCareDataset,
  loadLocalCareDataset,
} from '../utils/careTableParser';
import {
  INSTALLMENT_ROW_LABELS,
  InstallmentCardColumnDef,
  InstallmentQuickSummaryCardItem,
  loadLocalInstallmentDataset,
} from '../utils/installmentParser';

type InstallmentRowLabel = (typeof INSTALLMENT_ROW_LABELS)[number];
import {
  MAJOR_AS_CENTERS,
  PLUX_AS_GROUPS,
} from './QuickCenterModal';
import {
  DayScheduleCode,
  getOrCreateMonthSchedule,
  GWANGJU_STAFF_ROSTER,
  isOffDayCode,
  loadAllSchedules,
  loadSavedUserName,
  saveAllSchedules,
  saveUserName,
} from './ScheduleModal';

export type AiCustomerStatus = '상담진행중' | '결제완료' | '배송대기' | '상담종료';

export interface ParsedAiCommand {
  quoteMode: QuoteMode;
  generalItems: {
    category: string;
    modelName: string;
    quantity: number;
    unitPrice: number;
  }[];
  generalCardType:
    | '롯데 제휴카드'
    | '삼성 제휴카드'
    | '신한 제휴카드'
    | '우리 제휴카드'
    | '일반 카드'
    | '미정';
  instantDiscount: number;
  earnedPoints: number;
  pointUsed: number;
  extraCashback: number;
  generalHiPreedCounts: GeneralHiPreedCounts;
  subscriptionItems: {
    category: string;
    modelName: string;
    monthlyFee: number;
    period: 36 | 60;
  }[];
  subscriptionPeriod: 36 | 60;
  selectedCardId: AffiliateCardId;
  selectedCardTierId: string;
  hiPlusCounts: HiPlusCounts;
  shouldOpenProposalDirectly: boolean;
  customer: {
    shouldSaveCrm: boolean;
    name: string;
    phone: string;
    status: AiCustomerStatus;
    deliveryDate: string;
    memo: string;
  };
}

// ============================================================================
// 통합 총괄 AI 비서 — 추가 도메인 결과 타입 정의
// ============================================================================

export interface ScheduleModifyResult {
  yearMonth: string;
  monthNum: number;
  dayNum: number;
  fromDayNum?: number;
  toDayNum?: number;
  staffName: string;
  code: DayScheduleCode;
  statusLabel: string;
  message: string;
  needsUserNameSetup?: boolean;
  unmatchedStaffName?: string;
  availableStaffList?: { name: string; role: string }[];
  isCleanupDone?: boolean;
}

export interface ScheduleQueryResult {
  yearMonth: string;
  monthNum: number;
  dayNum: number;
  dateLabel: string;
  targetStaffName?: string;
  targetStaffOffDays?: { day: number; label: string }[];
  offStaff: { name: string; role: string; badge: string }[];
  workingStaff: { name: string; role: string; note?: string }[];
}

export interface InstallmentSearchResult {
  querySummary: string;
  targetMonthLabel?: InstallmentRowLabel;
  matchedSummaries: InstallmentQuickSummaryCardItem[];
  matchedColumns: {
    col: InstallmentCardColumnDef;
    highlightRows: { label: InstallmentRowLabel; text: string; subText?: string; status: string }[];
  }[];
}

export interface AsSearchResultItem {
  id: string;
  categoryBadge: string;
  title: string;
  phones: { label?: string; number: string }[];
  description: string;
  copyMessage: string;
}

export interface CrmSearchResult {
  querySummary: string;
  customers: CustomerItem[];
}

export interface InsuranceBriefResult {
  title: string;
  phone: string;
  summaryLines: string[];
  copyText: string;
}

interface AiCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToQuote: (state: ProposalState, targetStep: 'input' | 'proposal') => void;
  onCustomerSaved: (customer: CustomerItem, state: ProposalState) => void;
  onOpenScheduleModal?: () => void;
  onOpenCareTable?: () => void;
  onOpenInstallmentModal?: () => void;
  onOpenAsCenterModal?: () => void;
  onOpenInsuranceView?: () => void;
  onOpenCrmScreen?: () => void;
  onLoadCrmCustomerQuote?: (customer: CustomerItem) => void;
}

// 상단 빠른 예시 칩 4개 (① 견적+제안서 바로보기 / ② 견적+고객저장 / ③ 휴무표 말로 수정 / ④ 안심케어·무이자·AS 검색)
const QUICK_EXAMPLES = [
  {
    id: 'ex-quote-proposal',
    badge: '① 견적 + 제안서 바로보기',
    label: 'TV 380만 냉장고 320만 롯데카드 즉시할인 40만 하이프리드 300 1개 제안서 바로 보여줘',
    command:
      'TV 380만 냉장고 320만 세탁건조기 250만 롯데제휴카드 즉시할인 40만 엘포인트 15만 하이프리드 300 1개 제안서 바로 보여줘',
  },
  {
    id: 'ex-quote-crm',
    badge: '② 견적 + 고객저장 예시',
    label: '홍길동 010-1234-5678 TV 420만 에어컨 280만 삼성카드 프리드 150 1구좌 금요일 배송 결제완료 고객저장해줘',
    command:
      '홍길동 010-1234-5678 TV 420만 에어컨 280만 즉시할인 30만 삼성제휴카드 하이프리드 150 1구좌 금요일 배송 결제완료 사은품 냄비세트 약속 고객저장해줘',
  },
  {
    id: 'ex-schedule-edit',
    badge: '③ 휴무표 말로 수정 예시',
    label: '오늘 걸 내일로 바꿔줘 (또는 "강석원 오늘 휴무 삭제해줘")',
    command: '오늘 걸 내일로 바꿔줘',
  },
  {
    id: 'ex-multi-search',
    badge: '④ 안심케어 / 무이자 / AS 검색',
    label: '에어컨 클리닝 단가랑 삼성카드 무이자 알려줘',
    command: '에어컨 클리닝 단가랑 삼성카드 무이자 알려줘',
  },
] as const;

// 로컬 캐시가 아직 로드되기 전이라도 즉시 응답할 수 있는 기본 안심케어 핵심 데이터 폴백
const FALLBACK_CARE_ITEMS: CareTableItem[] = [
  {
    id: 'fb-rac-std',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '에어컨',
    name: '벽걸이 에어컨 클리닝 (일반)',
    code: 'SET-EV-CLEAN-RAC',
    price: '85,000원',
    note: '파트너사: 케이크린 (내)8000-5337',
  },
  {
    id: 'fb-pac-std',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '에어컨',
    name: '스탠드 에어컨 클리닝 (일반)',
    code: 'SET-EV-CLEAN-PAC',
    price: '134,000원',
    note: '파트너사: 케이크린 (내)8000-5337',
  },
  {
    id: 'fb-rac-prem',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '에어컨',
    name: '프리미엄 · 벽걸이 에어컨',
    code: 'SET-V-CLEAN-RAC(P)',
    price: '117,000원',
    note: '파트너사: 케이크린',
  },
  {
    id: 'fb-pac-prem',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '에어컨',
    name: '프리미엄 · 스탠드 에어컨',
    code: 'SET-V-CLEAN-PAC(P)',
    price: '189,000원',
    note: '파트너사: 케이크린',
  },
  {
    id: 'fb-2in1-prem',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '에어컨',
    name: '프리미엄 · 2IN1 에어컨',
    code: 'SET-V-CLEAN-2IN1(P)',
    price: '293,000원',
    note: '파트너사: 케이크린',
  },
  {
    id: 'fb-sys-2way',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '시스템에어컨',
    name: '천정형 시스템에어컨 (1,2WAY)',
    code: 'SET-EV-CLEAN-SYSTEM(2WAY)',
    price: '118,000원',
    note: '파트너사: 케이크린',
  },
  {
    id: 'fb-sys-4way',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '시스템에어컨',
    name: '천정형 시스템에어컨 (4WAY)',
    code: 'SET-EV-CLEAN-SYSTEM(4WAY)',
    price: '149,000원',
    note: '파트너사: 케이크린',
  },
  {
    id: 'fb-wm-top',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '세탁기',
    name: '일반 통돌이 세탁기 분해세척',
    code: 'SET-EV-CLEAN-WM',
    price: '89,000원',
    note: '완전분해 클리닝',
  },
  {
    id: 'fb-wm-drum',
    sheetType: '안심케어',
    folderKey: 'cleaning',
    folderLabel: '1. 가전청소 · 케어십 · 소모품',
    section: '가전청소 일회성',
    category: '세탁기',
    name: '드럼 세탁기 분해세척',
    code: 'SET-EV-CLEAN-DRUM',
    price: '129,000원',
    note: '완전분해 클리닝',
  },
];

function parseKoreanAmount(numStr: string, unitStr?: string): number {
  const cleaned = String(numStr || '').replace(/,/g, '').trim();
  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) return 0;

  const unit = (unitStr || '').trim();
  if (unit.includes('천만')) return Math.round(val * 10000000);
  if (unit.includes('백만')) return Math.round(val * 1000000);
  if (unit.includes('십만')) return Math.round(val * 100000);
  if (unit.includes('만')) return Math.round(val * 10000);
  if (unit.includes('천')) return Math.round(val * 1000);
  return Math.round(val);
}

const APPLIANCE_KEYWORDS: { pattern: RegExp; category: string }[] = [
  { pattern: /(?:김치\s*냉장고|김냉)/i, category: '김치냉장고' },
  { pattern: /(?:시스템\s*에어컨|시스카)/i, category: '시스템에어컨' },
  { pattern: /(?:세탁\s*건조기|워시\s*타워|워시\s*콤보|원바디)/i, category: '세탁건조기' },
  { pattern: /(?:로봇\s*청소기|로청)/i, category: '로봇청소기' },
  { pattern: /(?:식기\s*세척기|식세기)/i, category: '식기세척기' },
  { pattern: /(?:공기\s*청정기|공청기)/i, category: '공기청정기' },
  { pattern: /(?:의류\s*관리기|스타일러|에어드레서)/i, category: '의류관리기' },
  { pattern: /(?:얼음\s*정수기|정수기)/i, category: '정수기' },
  { pattern: /(?:안마\s*의자)/i, category: '안마의자' },
  { pattern: /(?:냉장고|양문형|오브제\s*냉장고|비스포크\s*냉장고)/i, category: '냉장고' },
  { pattern: /(?:세탁기|드럼\s*세탁기|통돌이)/i, category: '세탁기' },
  { pattern: /(?:건조기)/i, category: '건조기' },
  { pattern: /(?:TV|티비|올레드|OLED|QLED)/i, category: 'TV' },
  { pattern: /(?:에어컨|투인원|2in1|벽걸이\s*에어컨|스탠드\s*에어컨)/i, category: '에어컨' },
  { pattern: /(?:청소기|코드제로|비스포크\s*제트)/i, category: '청소기' },
  { pattern: /(?:인덕션|전기\s*레인지)/i, category: '전기레인지' },
  { pattern: /(?:전자\s*레인지|광파\s*오븐|오븐|큐커)/i, category: '주방가전' },
  { pattern: /(?:비데)/i, category: '비데' },
  { pattern: /(?:매트리스|침대)/i, category: '매트리스' },
  { pattern: /(?:와인\s*셀러)/i, category: '와인셀러' },
  { pattern: /(?:노트북|갤럭시\s*북|그램|맥북|데스크탑|컴퓨터|PC)/i, category: 'IT/노트북' },
  { pattern: /(?:휴대폰|스마트폰|아이폰|갤럭시\s*S\d+|폴드|플립)/i, category: '모바일' },
];

const RESERVED_NON_NAME_WORDS = new Set([
  '일반견적',
  '구독견적',
  '혼합견적',
  '즉시할인',
  '추가할인',
  '기본할인',
  '엘포인트',
  '적립포인트',
  '포인트사용',
  '추가캐시백',
  '캐시백',
  '하이프리드',
  '프리드',
  '구독프리드',
  '구독플러스',
  '하이플러스',
  '플러스',
  '롯데카드',
  '삼성카드',
  '신한카드',
  '우리카드',
  '현대카드',
  '국민카드',
  '농협카드',
  '일반카드',
  '제휴카드',
  '고객저장',
  '고객등록',
  '고객관리',
  '결제완료',
  '계약완료',
  '배송대기',
  '상담진행중',
  '상담종료',
  '오늘배송',
  '내일배송',
  '모레배송',
  '금요일',
  '방문케어',
  '셀프케어',
  '냉장고',
  '김치냉장고',
  '세탁기',
  '건조기',
  '세탁건조기',
  '워시타워',
  '에어컨',
  '시스템에어컨',
  '식기세척기',
  '정수기',
  '청소기',
  '로봇청소기',
  '공기청정기',
  '안마의자',
  '스타일러',
  '인덕션',
  '노트북',
  '사은품',
  '냄비세트',
  '휴무표',
  '안심케어',
  '무이자',
  '클리닝',
  '제안서',
  '오늘',
  '내일',
  '모레',
  '일정',
  '휴무',
  '연차',
  '교육',
  '반차',
  '회의',
  '휴가',
  '근무',
  '근무자',
  '휴무자',
]);

// ============================================================================
// 1. 휴무표 말로 수정 및 조회 파서/실행기
// ============================================================================

const SCHEDULE_NON_NAME_WORDS = new Set([
  '오늘',
  '금일',
  '당일',
  '내일',
  '명일',
  '모레',
  '어제',
  '작일',
  '이번달',
  '다음달',
  '이번주',
  '다음주',
  '오늘걸',
  '내일걸',
  '모레걸',
  '어제걸',
  '내일로',
  '모레로',
  '오늘로',
  '어제로',
  '나',
  '내',
  '내꺼',
  '내거',
  '내가',
  '본인',
  '저',
  '제',
  '제꺼',
  '일정',
  '내일정',
  '내휴무',
  '내근무',
  '스케줄',
  '휴무표',
  '계획표',
  '근무표',
  '휴무자',
  '근무자',
  '출근자',
  '결원',
  '직원',
  '사람',
  '명단',
  '이름',
  '행',
  '줄',
  '걸',
  '거',
  '것',
  '날짜',
  '날',
  '휴무',
  '정기휴무',
  '정규휴무',
  '오프',
  '연차',
  '반차',
  '오전반차',
  '오후반차',
  '교육',
  '집체',
  '연수',
  '회의',
  '미팅',
  '휴가',
  '여름휴가',
  '하계휴가',
  '동계휴가',
  '리프레시',
  '리프',
  '근무',
  '정상근무',
  '출근',
  '정상출근',
  '쉬는날',
  '쉬는',
  '바꿔줘',
  '바꿔',
  '바꾸기',
  '변경해줘',
  '변경해',
  '변경',
  '수정해줘',
  '수정해',
  '수정',
  '옮겨줘',
  '옮겨',
  '이동해줘',
  '이동해',
  '이동',
  '미뤄줘',
  '미뤄',
  '당겨줘',
  '당겨',
  '삭제해줘',
  '삭제해',
  '삭제',
  '없애줘',
  '없애',
  '취소해줘',
  '취소해',
  '취소',
  '지워줘',
  '지워',
  '제거해줘',
  '제거',
  '초기화해줘',
  '초기화',
  '원래대로',
  '돌려줘',
  '돌려',
  '넣어줘',
  '넣어',
  '등록해줘',
  '등록해',
  '등록',
  '처리해줘',
  '처리해',
  '처리',
  '적용해줘',
  '적용해',
  '적용',
  '정리해줘',
  '정리해',
  '정리',
  '알려줘',
  '알려',
  '보여줘',
  '보여',
  '조회해줘',
  '조회',
  '누구야',
  '누구',
  '언제야',
  '언제',
  '해줘',
  '해',
  '줘',
  '에서',
  '부터',
  '까지',
  '으로',
  '로',
  '잘못',
  '생성된',
  '추가된',
  '등록된',
  '유령',
  '이상한',
  '없는',
  '정식',
]);

interface ExtractedDateToken {
  yearMonth: string;
  monthNum: number;
  dayNum: number;
  rawLabel: string;
  index: number;
}

/**
 * 문장 내 등장하는 모든 날짜 표현('오늘', '내일', '모레', '어제', 'M월 N일', 'N일')을 등장 순서대로 추출
 */
function extractAllDateTokensInOrder(text: string): ExtractedDateToken[] {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // '일정', '일반' 등 한글이 바로 뒤에 붙는 '일'은 매칭하지 않도록 (?![가-힣]) 적용
  const regex =
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\s*일(?![가-힣])|(오늘|금일|당일|내일|명일|모레|어제|작일)/g;
  const tokens: ExtractedDateToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      const m = parseInt(match[1], 10);
      const d = parseInt(match[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const ym = `${curYear}-${String(m).padStart(2, '0')}`;
        tokens.push({
          yearMonth: ym,
          monthNum: m,
          dayNum: d,
          rawLabel: `${m}월 ${d}일`,
          index: match.index,
        });
      }
    } else if (match[3]) {
      const d = parseInt(match[3], 10);
      if (d >= 1 && d <= 31) {
        const ym = `${curYear}-${String(curMonth).padStart(2, '0')}`;
        tokens.push({
          yearMonth: ym,
          monthNum: curMonth,
          dayNum: d,
          rawLabel: `${d}일`,
          index: match.index,
        });
      }
    } else if (match[4]) {
      const word = match[4];
      const dt = new Date(curYear, now.getMonth(), now.getDate());
      if (word === '내일' || word === '명일') {
        dt.setDate(dt.getDate() + 1);
      } else if (word === '모레') {
        dt.setDate(dt.getDate() + 2);
      } else if (word === '어제' || word === '작일') {
        dt.setDate(dt.getDate() - 1);
      }
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      tokens.push({
        yearMonth: `${y}-${String(m).padStart(2, '0')}`,
        monthNum: m,
        dayNum: d,
        rawLabel: word,
        index: match.index,
      });
    }
  }

  return tokens;
}

function parseTargetDateFromCommand(text: string): {
  yearMonth: string;
  monthNum: number;
  dayNum: number;
  dateLabel: string;
} {
  const tokens = extractAllDateTokensInOrder(text);
  if (tokens.length > 0) {
    const first = tokens[0];
    const isWordLabel = /^(오늘|금일|당일|내일|명일|모레|어제|작일)$/.test(
      first.rawLabel
    );
    return {
      yearMonth: first.yearMonth,
      monthNum: first.monthNum,
      dayNum: first.dayNum,
      dateLabel: isWordLabel
        ? `${first.rawLabel} (${first.monthNum}월 ${first.dayNum}일)`
        : `${first.monthNum}월 ${first.dayNum}일`,
    };
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  return {
    yearMonth: `${yyyy}-${String(mm).padStart(2, '0')}`,
    monthNum: mm,
    dayNum: dd,
    dateLabel: `오늘 (${mm}월 ${dd}일)`,
  };
}

/**
 * ScheduleModal.tsx 코드 체계와 100% 호환되는 근태 기호 매핑:
 * - 일반 휴무 -> 'O' (절대 '휴무'로 저장 금지)
 * - 연차 -> '연차'
 * - 휴가 / 여름휴가 / 리프레시 -> 'V'
 * - 반차 -> '반차'
 * - 교육 -> '교육'
 * - 회의 -> '회의'
 * - 삭제 / 없애 / 취소 / 지워 / 초기화 / 원래대로 / 출근 / 근무 -> '' (빈 문자열 및 키 삭제)
 */
function detectScheduleStatusCode(text: string): {
  code: DayScheduleCode;
  label: string;
  isClear?: boolean;
} | null {
  if (
    /(?:삭제|없애|취소|지워|초기화|원래대로|출근|정상\s*근무|근무로|출근으로)/.test(
      text
    ) &&
    !/(?:근무자|출근자|누구|알려|보여)/.test(text)
  ) {
    return { code: '', label: '정상 출근(휴무 삭제)', isClear: true };
  }
  if (/연차/.test(text)) return { code: '연차', label: '연차' };
  if (/휴가|여름\s*휴가|하계|동계|리프레시|리프/.test(text)) {
    return { code: 'V', label: '휴가(V)' };
  }
  if (/반차|오전\s*반차|오후\s*반차/.test(text)) {
    return { code: '반차', label: '반차' };
  }
  if (/교육|집체|연수/.test(text)) return { code: '교육', label: '교육' };
  if (/회의|미팅/.test(text)) return { code: '회의', label: '회의' };
  if (/휴무|오프|OFF|쉬는\s*날/i.test(text)) {
    return { code: 'O', label: '휴무(O)' };
  }
  if (/(?:정상\s*)?근무|출근/.test(text)) {
    return { code: '', label: '정상 출근', isClear: true };
  }
  return null;
}

export function tryExecuteScheduleCommand(
  rawText: string,
  dryRun = false,
  overrideStaffName?: string
): {
  modifyResult: ScheduleModifyResult | null;
  queryResult: ScheduleQueryResult | null;
} {
  const text = (rawText || '').trim();
  if (!text) return { modifyResult: null, queryResult: null };

  // 견적 금액(예: 380만)이 포함된 순수 견적 명령이고 휴무 키워드가 없으면 패스
  const hasPriceAmount = /\d+\s*(?:만|천만|백만)\s*원?/.test(text);
  const dateTokens = extractAllDateTokensInOrder(text);

  // 날짜 이동(Swap/Move) 패턴 감지: 두 개의 날짜 표현 + 이동/변경 동사
  const isDateMoveCommand =
    dateTokens.length >= 2 &&
    /(?:바꿔|옮겨|변경|이동|미뤄|당겨|수정|교체|스왑)/.test(text) &&
    !hasPriceAmount;

  // 잘못 생성된 직원 행 삭제 / 정리 명령 감지
  const isBulkStaffCleanupCommand =
    /(?:잘못\s*(?:생성|추가|등록)된?\s*(?:이름|직원|행|줄)?|유령\s*직원|이상한\s*(?:이름|직원)|없는\s*(?:이름|직원)|정식\s*명단\s*외).*(?:정리|삭제|지워|제거|초기화)/.test(
      text
    );

  const isSingleStaffRowDeleteCommand =
    !isBulkStaffCleanupCommand &&
    !/(?:휴무|연차|반차|교육|회의|휴가)\s*(?:을|를)?\s*(?:삭제|지워|없애|취소)/.test(
      text
    ) &&
    /(?:직원|이름|명단|줄|행)\s*(?:을|를)?\s*(?:삭제|지워|제거|없애)/.test(text);

  // 휴무 삭제 / 취소 / 출근 전환 명령 감지
  const isClearAttendanceCommand =
    !isBulkStaffCleanupCommand &&
    !isSingleStaffRowDeleteCommand &&
    !isDateMoveCommand &&
    ((/(?:휴무|연차|반차|교육|회의|휴가|일정)/.test(text) &&
      /(?:삭제|없애|취소|지워|초기화|원래대로)/.test(text)) ||
      /(?:출근으로|정상\s*근무로|근무로\s*바꿔|출근으로\s*바꿔|출근으로\s*변경)/.test(
        text
      ));

  const hasScheduleTopic =
    isBulkStaffCleanupCommand ||
    isSingleStaffRowDeleteCommand ||
    isDateMoveCommand ||
    isClearAttendanceCommand ||
    /(?:휴무표|휴무자|근무자|쉬는\s*사람|출근자|누구\s*쉬|일정|휴무로|연차로|반차로|교육으로|회의로|휴가로|근무로|출근으로)/.test(
      text
    ) ||
    (/(?:휴무|연차|반차|교육|회의|휴가|근무)/.test(text) &&
      /(?:바꿔|변경|수정|옮겨|삭제|없애|취소|지워|초기화|넣어|등록|처리|해\s*줘|해줘|누구|알려|언제|보여|조회)/.test(
        text
      ));

  if (!hasScheduleTopic) {
    return { modifyResult: null, queryResult: null };
  }

  const schedules = loadAllSchedules();
  const { yearMonth, monthNum, dayNum, dateLabel } =
    parseTargetDateFromCommand(text);
  const monthSchedule = getOrCreateMonthSchedule(schedules, yearMonth);
  const officialSet = new Set(GWANGJU_STAFF_ROSTER.map((r) => r.name));

  // ---------------------------------------------------------------------------
  // [1] 잘못 생성된 유령 직원 행 삭제 / 일괄 정리 명령 처리
  // ---------------------------------------------------------------------------
  if (isBulkStaffCleanupCommand) {
    const removedSet = new Set<string>();
    const nextSchedules = { ...schedules };

    // 현재 월 포함 모든 저장된 월에서 19명 정식 명단에 없는 이름 제거
    const targetMonths = Array.from(
      new Set([...Object.keys(nextSchedules), yearMonth])
    );
    for (const ym of targetMonths) {
      const mData = nextSchedules[ym] || getOrCreateMonthSchedule(schedules, ym);
      const filtered = mData.employees.filter((emp) => {
        const isOfficial = officialSet.has((emp.name || '').trim());
        if (!isOfficial && emp.name) {
          removedSet.add(emp.name);
        }
        return isOfficial;
      });
      if (nextSchedules[ym] || removedSet.size > 0) {
        nextSchedules[ym] = {
          ...mData,
          updatedAt: `${new Date().toLocaleString('ko-KR')} (유령 직원 정리)`,
          employees: filtered,
        };
      }
    }

    if (!dryRun) {
      saveAllSchedules(nextSchedules);
      window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
    }

    const removedList = Array.from(removedSet);
    const msg =
      removedList.length > 0
        ? dryRun
          ? `⚡ [실행 대기] 휴무표에서 잘못 생성된 이름 [${removedList.join(', ')}] (${removedList.length}명)을 일괄 삭제합니다.`
          : `✅ 휴무표에서 잘못 생성된 이름 [${removedList.join(', ')}] (${removedList.length}명)을 삭제하여 19명 정식 명단으로 정리했습니다!`
        : '✅ 현재 휴무표에는 잘못 생성된 이름이 없습니다. (19명 정식 직원 명단 유지 중)';

    return {
      modifyResult: {
        yearMonth,
        monthNum,
        dayNum,
        staffName: removedList.join(', ') || '정식 명단 외 직원',
        code: '',
        statusLabel: '잘못 생성된 이름 정리',
        message: msg,
        isCleanupDone: true,
      },
      queryResult: null,
    };
  }

  if (isSingleStaffRowDeleteCommand) {
    const cleaned = text
      .replace(
        /(?:휴무표에서|휴무표|에서|직원|이름|명단|줄|행|삭제해줘|삭제해|삭제|지워줘|지워|제거해줘|제거|없애줘|없애|해줘|해|줘)/g,
        ' '
      )
      .trim();
    const tokens = (cleaned.match(/[가-힣A-Za-z0-9]{1,8}/g) || []).map((t) =>
      t.replace(/(?:을|를|은|는|이|가|의)$/, '')
    );
    const targetRemoveName = tokens[0] || '';

    if (targetRemoveName) {
      const nextSchedules = { ...schedules };
      const targetMonths = Array.from(
        new Set([...Object.keys(nextSchedules), yearMonth])
      );
      for (const ym of targetMonths) {
        const mData =
          nextSchedules[ym] || getOrCreateMonthSchedule(schedules, ym);
        const filtered = mData.employees.filter(
          (emp) => emp.name !== targetRemoveName
        );
        nextSchedules[ym] = {
          ...mData,
          updatedAt: `${new Date().toLocaleString('ko-KR')} (${targetRemoveName} 행 삭제)`,
          employees: filtered,
        };
      }

      if (!dryRun) {
        saveAllSchedules(nextSchedules);
        window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
      }

      return {
        modifyResult: {
          yearMonth,
          monthNum,
          dayNum,
          staffName: targetRemoveName,
          code: '',
          statusLabel: '직원 행 삭제',
          message: dryRun
            ? `⚡ [실행 대기] 휴무표에서 '${targetRemoveName}' 직원 행(줄)을 삭제합니다.`
            : `✅ 휴무표에서 '${targetRemoveName}' 직원 행(줄)을 완전히 삭제했습니다!`,
          isCleanupDone: true,
        },
        queryResult: null,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // [2] 대상 직원 이름 판별 (절대 임의의 새 직원을 push하지 않음!)
  // ---------------------------------------------------------------------------
  // 현재 휴무표에 등록된 실제 직원 명단 (단, 예약어나 명령어 파편은 제외)
  const validRegisteredEmployees = monthSchedule.employees.filter(
    (emp) =>
      emp.name &&
      !SCHEDULE_NON_NAME_WORDS.has(emp.name.trim()) &&
      !RESERVED_NON_NAME_WORDS.has(emp.name.trim())
  );

  // 선택 버튼에 노출할 직원 목록 (현재 휴무표 직원 우선, 없으면 19명 정식 명단)
  const availableStaffList: { name: string; role: string }[] =
    validRegisteredEmployees.length > 0
      ? validRegisteredEmployees.map((e) => ({ name: e.name, role: e.role }))
      : GWANGJU_STAFF_ROSTER.map((r) => ({ name: r.name, role: r.role }));

  // 1) overrideStaffName이 지정된 경우(사용자가 직원 선택 버튼 클릭 시) 최우선 적용
  let matchedStaffName = '';
  let extractedUnknownName = '';
  let needsUserNameSetup = false;

  if (overrideStaffName) {
    matchedStaffName = overrideStaffName;
  } else {
    // 2) 현재 휴무표 직원 명단 또는 경기광주점 19명 정식 명단(GWANGJU_STAFF_ROSTER)과 일치하는 이름 검색
    for (const emp of validRegisteredEmployees) {
      if (emp.name && text.includes(emp.name)) {
        matchedStaffName = emp.name;
        break;
      }
    }
    if (!matchedStaffName) {
      for (const r of GWANGJU_STAFF_ROSTER) {
        if (text.includes(r.name)) {
          matchedStaffName = r.name;
          break;
        }
      }
    }

    // 3) 정식 명단에 매칭된 이름이 없는 경우:
    //    - 문장에 '나', '내', '내꺼', '내 휴무', '내 일정'만 있거나 아예 이름이 생략되었는지,
    //    - 아니면 명단에 없는 제3의 인물 이름(예: '홍길동', '김철수')이 들어있는지 판별
    if (!matchedStaffName) {
      const isExplicitSelf =
        /(?:^|\s)(?:나|내|내꺼|내\s*거|내\s*일정|내\s*휴무|내\s*근무|내가|본인)(?:\s|를|을|은|는|이|가|의|$)/.test(
          text
        );

      // 날짜·근태·동사 키워드를 모두 제거하고 남은 한글 토큰이 있는지 확인
      const strippedSentence = text
        .replace(/(\d{1,2})\s*월/g, ' ')
        .replace(/(\d{1,2})\s*일/g, ' ')
        .replace(
          /(?:오늘|금일|당일|내일|명일|모레|어제|작일|이번달|다음달|이번주|다음주|나|내꺼|내거|내|내가|본인|일정|스케줄|휴무표|계획표|휴무자|근무자|출근자|정기휴무|정규휴무|휴무|오프|연차|반차|오전반차|오후반차|교육|집체|연수|회의|미팅|여름휴가|하계휴가|동계휴가|리프레시|휴가|정상근무|정상출근|근무|출근|쉬는날|쉬는|사람|직원|바꿔줘|바꿔|변경해줘|변경해|변경|수정해줘|수정해|수정|옮겨줘|옮겨|이동해줘|이동해|이동|미뤄줘|미뤄|당겨줘|당겨|삭제해줘|삭제해|삭제|없애줘|없애|취소해줘|취소해|취소|지워줘|지워|초기화해줘|초기화|원래대로|돌려줘|돌려|넣어줘|넣어|등록해줘|등록해|등록|처리해줘|처리해|처리|적용해줘|적용해|적용|알려줘|알려|보여줘|보여|조회해줘|조회|누구야|누구|언제야|언제|해줘|해|줘)/g,
          ' '
        );

      const rawTokens = strippedSentence.match(/[가-힣]{2,4}/g) || [];
      for (const tok of rawTokens) {
        const cleanTok = tok.replace(
          /(?:에서|부터|까지|으로|한테|에게|께서|이라|라고|이랑|하고|만|도|은|는|이|가|을|를|의|로|와|과|걸|거|님|씨)$/,
          ''
        );
        if (
          cleanTok.length >= 2 &&
          cleanTok.length <= 4 &&
          !SCHEDULE_NON_NAME_WORDS.has(cleanTok) &&
          !RESERVED_NON_NAME_WORDS.has(cleanTok) &&
          !SCHEDULE_NON_NAME_WORDS.has(tok) &&
          !RESERVED_NON_NAME_WORDS.has(tok)
        ) {
          extractedUnknownName = cleanTok;
          break;
        }
      }

      // 제3의 미등록 이름이 명시되지 않았거나, '나/내/내꺼/내 휴무'인 경우 -> 저장된 내 이름(himart_gj_user_name) 사용!
      if (!extractedUnknownName || isExplicitSelf) {
        const savedMe = loadSavedUserName();
        if (savedMe) {
          // 저장된 내 이름이 실제 명단(또는 19명 정식 명단)에 있는지 확인
          const existsInSchedule =
            validRegisteredEmployees.some((e) => e.name === savedMe) ||
            officialSet.has(savedMe);
          if (existsInSchedule) {
            matchedStaffName = savedMe;
            extractedUnknownName = '';
          } else {
            extractedUnknownName = savedMe;
          }
        } else {
          needsUserNameSetup = true;
        }
      }
    }
  }

  const isModifyIntent =
    isDateMoveCommand ||
    isClearAttendanceCommand ||
    (/(?:바꿔|변경|수정|옮겨|이동|미뤄|당겨|삭제|없애|취소|지워|초기화|원래대로|넣어|설정|처리|고쳐|적용)/.test(
      text
    ) &&
      !/(?:누구|언제|알려|보여\s*줘)/.test(text));

  // ---------------------------------------------------------------------------
  // [3] 수정 명령 처리 (A: 날짜 이동 Swap/Move, B: 휴무 삭제/취소/출근전환, C: 일반 근태 변경)
  // ---------------------------------------------------------------------------
  if (isModifyIntent) {
    // 3-0) 대상 직원이 휴무표에 없거나 내 이름이 미설정된 경우:
    //      절대 employees.push(...) 하지 않고 직원 선택 버튼 안내 반환!
    const existingEmpIdx = matchedStaffName
      ? monthSchedule.employees.findIndex((e) => e.name === matchedStaffName)
      : -1;

    if (!matchedStaffName || existingEmpIdx === -1) {
      const displayUnknown =
        extractedUnknownName || matchedStaffName || '미지정(내 이름 미설정)';
      const statusPreview = isDateMoveCommand
        ? `${dateTokens[0].dayNum}일 ➔ ${dateTokens[1].dayNum}일 휴무 이동`
        : isClearAttendanceCommand
        ? '휴무 삭제(정상 출근 전환)'
        : detectScheduleStatusCode(text)?.label || '휴무(O)';

      return {
        modifyResult: {
          yearMonth,
          monthNum,
          dayNum: isDateMoveCommand ? dateTokens[1].dayNum : dayNum,
          fromDayNum: isDateMoveCommand ? dateTokens[0].dayNum : undefined,
          toDayNum: isDateMoveCommand ? dateTokens[1].dayNum : undefined,
          staffName: displayUnknown,
          code: 'O',
          statusLabel: statusPreview,
          unmatchedStaffName: displayUnknown,
          availableStaffList,
          needsUserNameSetup,
          message:
            displayUnknown === '미지정(내 이름 미설정)'
              ? `⚠️ 내 직원 이름이 아직 설정되지 않았습니다. 아래 직원 중 누구의 일정을 변경할까요?`
              : `⚠️ 휴무표에 '${displayUnknown}' 직원이 없습니다. 아래 직원 중 누구의 일정을 변경할까요?`,
        },
        queryResult: null,
      };
    }

    const targetEmp = monthSchedule.employees[existingEmpIdx];

    // -------------------------------------------------------------------------
    // (A) 날짜 이동(Swap/Move) 명령: "[fromDay] 걸/휴무를 [toDay]로 바꿔줘/옮겨줘/변경해줘"
    // -------------------------------------------------------------------------
    if (isDateMoveCommand && dateTokens.length >= 2) {
      const fromToken = dateTokens[0];
      const toToken = dateTokens[1];
      const fromDay = fromToken.dayNum;
      const toDay = toToken.dayNum;

      const prevFromCode = (targetEmp.days?.[String(fromDay)] || '').trim();
      let moveCode: DayScheduleCode = 'O';
      if (/연차/.test(text)) {
        moveCode = '연차';
      } else if (/휴가|여름\s*휴가|하계|동계|리프레시|리프/.test(text)) {
        moveCode = 'V';
      } else if (/반차/.test(text)) {
        moveCode = '반차';
      } else if (/교육/.test(text)) {
        moveCode = '교육';
      } else if (/회의/.test(text)) {
        moveCode = '회의';
      } else if (prevFromCode === '연차') {
        moveCode = '연차';
      } else if (prevFromCode === 'V') {
        moveCode = 'V';
      } else {
        moveCode = 'O'; // 일반 휴무는 반드시 대문자 'O'로 저장
      }

      const moveCodeLabel =
        moveCode === 'O'
          ? '휴무(O)'
          : moveCode === 'V'
          ? '휴가(V)'
          : moveCode;

      if (!dryRun) {
        const updatedEmployees = monthSchedule.employees.map((emp, idx) => {
          if (idx !== existingEmpIdx) return emp;
          const nextDays = { ...emp.days };
          // ① fromDay는 출근('')으로 깨끗이 삭제
          delete nextDays[String(fromDay)];
          // ② toDay에 해당 휴무 코드('O' 등) 입력
          nextDays[String(toDay)] = moveCode;
          return {
            ...emp,
            days: nextDays,
          };
        });

        const nextSchedules = {
          ...schedules,
          [yearMonth]: {
            ...monthSchedule,
            updatedAt: `${new Date().toLocaleString('ko-KR')} (AI 비서 일정 이동)`,
            isRegistered: true,
            employees: updatedEmployees,
          },
        };
        saveAllSchedules(nextSchedules);
        window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
      }

      return {
        modifyResult: {
          yearMonth,
          monthNum,
          dayNum: toDay,
          fromDayNum: fromDay,
          toDayNum: toDay,
          staffName: matchedStaffName,
          code: moveCode,
          statusLabel: `${fromDay}일 삭제 ➔ ${toDay}일 ${moveCodeLabel}`,
          message: dryRun
            ? `⚡ [실행 대기] ${matchedStaffName}님의 ${fromDay}일 휴무를 삭제(출근 전환)하고 ${toDay}일 ${moveCodeLabel}로 변경합니다.`
            : `✅ ${matchedStaffName}님의 ${fromDay}일 휴무를 삭제(출근 전환)하고 ${toDay}일 ${moveCodeLabel}로 변경했습니다!`,
        },
        queryResult: null,
      };
    }

    // -------------------------------------------------------------------------
    // (B) 휴무 삭제 / 없애 / 취소 / 지워 / 출근 전환 명령
    // -------------------------------------------------------------------------
    const statusObj = detectScheduleStatusCode(text);
    if (isClearAttendanceCommand || statusObj?.isClear) {
      let targetClearDay = dayNum;

      // 날짜를 명시하지 않고 "강석원 휴무 삭제해줘"라고만 한 경우:
      // 오늘 또는 내일 중 휴무가 잡혀 있는 날짜를 우선 찾아 삭제 (둘 다 없으면 오늘 날짜 기준)
      if (dateTokens.length === 0) {
        const now = new Date();
        const todayD = now.getDate();
        const tomorrowDt = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );
        const tomorrowD = tomorrowDt.getDate();

        if (targetEmp.days?.[String(todayD)]) {
          targetClearDay = todayD;
        } else if (
          tomorrowDt.getMonth() === now.getMonth() &&
          targetEmp.days?.[String(tomorrowD)]
        ) {
          targetClearDay = tomorrowD;
        } else {
          targetClearDay = todayD;
        }
      }

      if (!dryRun) {
        const updatedEmployees = monthSchedule.employees.map((emp, idx) => {
          if (idx !== existingEmpIdx) return emp;
          const nextDays = { ...emp.days };
          delete nextDays[String(targetClearDay)];
          return {
            ...emp,
            days: nextDays,
          };
        });

        const nextSchedules = {
          ...schedules,
          [yearMonth]: {
            ...monthSchedule,
            updatedAt: `${new Date().toLocaleString('ko-KR')} (AI 비서 휴무 삭제)`,
            isRegistered: true,
            employees: updatedEmployees,
          },
        };
        saveAllSchedules(nextSchedules);
        window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
      }

      return {
        modifyResult: {
          yearMonth,
          monthNum,
          dayNum: targetClearDay,
          staffName: matchedStaffName,
          code: '',
          statusLabel: '휴무 삭제 (정상 출근 전환)',
          message: dryRun
            ? `⚡ [실행 대기] ${matchedStaffName}님의 ${monthNum}월 ${targetClearDay}일 휴무(근태)를 삭제하여 [정상 출근] 상태로 되돌립니다.`
            : `✅ ${matchedStaffName}님의 ${monthNum}월 ${targetClearDay}일 휴무를 삭제하여 [정상 출근] 상태로 변경했습니다!`,
        },
        queryResult: null,
      };
    }

    // -------------------------------------------------------------------------
    // (C) 일반 휴무('O') · 연차('연차') · 휴가('V') · 반차 · 교육 · 회의 등록/변경
    // -------------------------------------------------------------------------
    if (statusObj) {
      if (!dryRun) {
        const updatedEmployees = monthSchedule.employees.map((emp, idx) => {
          if (idx !== existingEmpIdx) return emp;
          const nextDays = { ...emp.days };
          if (!statusObj.code) {
            delete nextDays[String(dayNum)];
          } else {
            nextDays[String(dayNum)] = statusObj.code;
          }
          return {
            ...emp,
            days: nextDays,
          };
        });

        const nextSchedules = {
          ...schedules,
          [yearMonth]: {
            ...monthSchedule,
            updatedAt: `${new Date().toLocaleString('ko-KR')} (AI 비서 수정)`,
            isRegistered: true,
            employees: updatedEmployees,
          },
        };
        saveAllSchedules(nextSchedules);
        window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
      }

      return {
        modifyResult: {
          yearMonth,
          monthNum,
          dayNum,
          staffName: matchedStaffName,
          code: statusObj.code,
          statusLabel: statusObj.label,
          message: dryRun
            ? `⚡ [실행 대기] ${matchedStaffName}님의 ${monthNum}월 ${dayNum}일 일정을 [${statusObj.label}](으)로 변경합니다.`
            : `✅ ${matchedStaffName}님의 ${monthNum}월 ${dayNum}일 일정이 [${statusObj.label}](으)로 즉시 수정되었습니다!`,
        },
        queryResult: null,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // [4] 조회 명령 처리 ("내일 쉬는 사람 누구야?", "18일 근무자 알려줘", "강석원 휴무 언제야?")
  // ---------------------------------------------------------------------------
  const offStaff: { name: string; role: string; badge: string }[] = [];
  const workingStaff: { name: string; role: string; note?: string }[] = [];

  for (const emp of validRegisteredEmployees) {
    const code = (emp.days?.[String(dayNum)] || '').trim() as DayScheduleCode;
    if (isOffDayCode(code)) {
      const badge =
        code === '연차' ? '연차' : code === 'V' ? '휴가(V)' : '정기휴무(O)';
      offStaff.push({ name: emp.name, role: emp.role, badge });
    } else {
      workingStaff.push({
        name: emp.name,
        role: emp.role,
        note: code ? code : undefined,
      });
    }
  }

  let targetStaffOffDays: { day: number; label: string }[] | undefined;
  if (matchedStaffName) {
    const foundEmp = validRegisteredEmployees.find(
      (e) => e.name === matchedStaffName
    );
    if (foundEmp) {
      targetStaffOffDays = [];
      for (let d = 1; d <= 31; d++) {
        const c = foundEmp.days?.[String(d)];
        if (
          c &&
          (isOffDayCode(c) || c === '반차' || c === '교육' || c === '회의')
        ) {
          targetStaffOffDays.push({
            day: d,
            label: c === 'O' ? '휴무(O)' : c === 'V' ? '휴가(V)' : c,
          });
        }
      }
    }
  }

  return {
    modifyResult: null,
    queryResult: {
      yearMonth,
      monthNum,
      dayNum,
      dateLabel,
      targetStaffName: matchedStaffName || undefined,
      targetStaffOffDays,
      offStaff,
      workingStaff,
    },
  };
}

// ============================================================================
// 2. 앱 내 4대 데이터베이스 통합 검색기
// ============================================================================

/**
 * (A) 안심케어 · 가전이사 조견표 검색
 */
export function searchCareTableFromCommand(
  rawText: string,
  dataset: CareTableDataset | null
): CareTableItem[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  const isCareIntent =
    /(?:안심\s*케어|클리닝|청소|분해\s*세척|세척|케어십|가전\s*이사|이전\s*설치|철거|재설치|타공|사다리차|단가|모델\s*코드|상품\s*코드|코드\s*찾아|코드\s*알려)/.test(
      text
    );

  if (!isCareIntent) return [];

  const itemsPool =
    dataset && Array.isArray(dataset.items) && dataset.items.length > 0
      ? dataset.items
      : FALLBACK_CARE_ITEMS;

  // 핵심 키워드 추출
  const keywordCandidates = [
    '벽걸이',
    '스탠드',
    '2in1',
    '투인원',
    '시스템',
    '천정형',
    '창문형',
    '에어컨',
    '통돌이',
    '드럼',
    '세탁기',
    '건조기',
    '워시타워',
    '냉장고',
    '김치냉장고',
    '비데',
    '매트리스',
    '후드',
    '주방후드',
    '공기청정기',
    '가전이사',
    '이전설치',
    '철거',
    '재설치',
    '프리미엄',
  ];

  const matchedKeywords = keywordCandidates.filter((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  // 투인원 정규화
  const normalizedKeywords = matchedKeywords.map((kw) =>
    kw === '투인원' ? '2in1' : kw === '시스템' ? '천정형' : kw
  );

  if (normalizedKeywords.length === 0) {
    return itemsPool.slice(0, 8);
  }

  const scored = itemsPool
    .map((item) => {
      const hay = `${item.sheetType} ${item.section} ${item.category} ${item.name} ${item.code} ${item.note}`.toLowerCase();
      let score = 0;
      for (const kw of normalizedKeywords) {
        if (hay.includes(kw.toLowerCase())) {
          score += 10;
        }
      }
      if (/클리닝|청소|세척/.test(text) && item.folderKey === 'cleaning') {
        score += 5;
      }
      if (/이사|이전|철거|재설치/.test(text) && item.sheetType === '가전이사') {
        score += 8;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((s) => s.item);
}

/**
 * (B) 카드 무이자 할부 조견표 검색
 */
export function searchInstallmentFromCommand(
  rawText: string
): InstallmentSearchResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  const isInstallmentIntent =
    /(?:무이자|할부|부분\s*무이자|몇\s*개월\s*무이자|\d{1,2}\s*개월\s*무이자)/.test(text);

  if (!isInstallmentIntent) return null;

  const dataset = loadLocalInstallmentDataset();

  const cardBrands = [
    '롯데',
    '삼성',
    '신한',
    '우리',
    '현대',
    '국민',
    'KB',
    '농협',
    'NH',
    '하나',
    '비씨',
    'BC',
    '광주',
    '전북',
  ];
  const matchedBrands = cardBrands.filter((b) =>
    text.toUpperCase().includes(b.toUpperCase())
  );

  // 개월 수 추출 (예: 12개월, 24개월, 36개월, 60개월 등)
  let targetMonthLabel: InstallmentRowLabel | undefined;
  const monthMatch = text.match(/(\d{1,2})\s*개월/);
  if (monthMatch) {
    const m = parseInt(monthMatch[1], 10);
    if (m === 48 || m === 60) {
      targetMonthLabel = '48/60개월(비고)';
    } else {
      const foundRow = INSTALLMENT_ROW_LABELS.find((label) =>
        label.startsWith(`${m}개월`)
      );
      if (foundRow) targetMonthLabel = foundRow;
    }
  }

  const matchedSummaries = dataset.quickSummaries.filter((qs) => {
    if (matchedBrands.length > 0) {
      return matchedBrands.some((b) =>
        qs.brandTitle
          .toUpperCase()
          .includes(b === 'KB' ? '국민' : b === 'NH' ? '농협' : b.toUpperCase())
      );
    }
    if (targetMonthLabel) {
      const mStr = targetMonthLabel.replace('(비고)', '');
      return (
        qs.freeInstallment.includes(mStr.replace('개월', '')) ||
        qs.partialInstallment.includes(mStr.replace('개월', '')) ||
        qs.subInstallment.includes(mStr.replace('개월', ''))
      );
    }
    return true;
  });

  const matchedColumns = dataset.columns
    .filter((col) => {
      if (matchedBrands.length > 0) {
        return matchedBrands.some((b) => {
          const normalizedB = b === 'KB' ? '국민' : b === 'NH' ? '농협' : b;
          return (
            col.brand.toUpperCase().includes(normalizedB.toUpperCase()) ||
            col.subName.toUpperCase().includes(normalizedB.toUpperCase())
          );
        });
      }
      if (targetMonthLabel) {
        const cell = col.rows[targetMonthLabel];
        return (
          cell &&
          (cell.kind === 'free' ||
            cell.kind === 'partial' ||
            cell.kind === 'sub-free')
        );
      }
      return true;
    })
    .map((col) => {
      const rowsToInspect: InstallmentRowLabel[] = targetMonthLabel
        ? [targetMonthLabel, '기타 안내']
        : [
            '2개월',
            '3개월',
            '5개월',
            '6개월(비고)',
            '10개월(비고)',
            '12개월(비고)',
            '24개월(비고)',
            '36개월(비고)',
            '48/60개월(비고)',
          ];

      const highlightRows = rowsToInspect
        .map((rLabel) => {
          const cell = col.rows[rLabel];
          if (!cell || cell.kind === 'interest' || cell.kind === 'disabled') {
            if (rLabel === targetMonthLabel) {
              return {
                label: rLabel,
                text: cell?.main || '무이자 불가 (일반 유이자)',
                subText: cell?.sub,
                status: cell?.kind || 'disabled',
              };
            }
            return null;
          }
          return {
            label: rLabel,
            text: cell.main,
            subText: cell.sub,
            status: cell.kind,
          };
        })
        .filter(Boolean) as {
        label: InstallmentRowLabel;
        text: string;
        subText?: string;
        status: string;
      }[];

      return { col, highlightRows };
    });

  return {
    querySummary:
      matchedBrands.length > 0
        ? `${matchedBrands.join('·')}카드 ${targetMonthLabel ? targetMonthLabel.replace('(비고)', '') + ' ' : ''}무이자 할부 조회 결과`
        : targetMonthLabel
        ? `${targetMonthLabel.replace('(비고)', '')} 무이자/부분무이자 가능 카드 조회 결과`
        : '전 카드사 무이자 할부 핵심 요약',
    targetMonthLabel,
    matchedSummaries: matchedSummaries.slice(0, 6),
    matchedColumns: matchedColumns.slice(0, 8),
  };
}

/**
 * (C) 가전 AS센터 · 플럭스(PLUX) · TCL 번호 검색
 */
export function searchAsCenterFromCommand(rawText: string): AsSearchResultItem[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  const isAsIntent =
    /(?:AS|A\/S|에이에스|서비스\s*센터|고객\s*센터|수리\s*센터|리모컨\s*페어링|리모컨\s*설정|플럭스|PLUX|하이메이드|TCL|티씨엘|쿠쿠\s*번호|쿠첸\s*번호|다이슨\s*번호|바디프랜드|세라젬|코지마)/i.test(
      text
    );

  if (!isAsIntent) return [];

  const results: AsSearchResultItem[] = [];
  const lower = text.toLowerCase();

  // 1) TCL 검색
  if (/tcl|티씨엘|리모컨|셋탑|페어링/.test(lower)) {
    results.push({
      id: 'as-tcl',
      categoryBadge: '📺 TCL TV 전담',
      title: 'TCL TV 공식 고객센터 & 전담 매니저',
      phones: [
        { label: 'TCL 고객센터', number: '1660-1870' },
        { label: 'TCL 정진수 매니저', number: '010-2230-2277' },
      ],
      description:
        '패널 3년 / 일반부품 2년 무상보증 · IPTV 통합리모컨 CEC/페어링 설정 지원',
      copyMessage:
        '[롯데하이마트 경기광주점] 📺 TCL TV A/S 및 고객센터 안내\n• TCL 공식 고객센터: 1660-1870 (패널 3년 / 일반부품 2년 무상보증)',
    });
  }

  // 2) 플럭스(PLUX) / 하이메이드 검색
  const isPluxMentioned = /플럭스|plux|하이메이드|pb|plx/i.test(text);
  for (const group of PLUX_AS_GROUPS) {
    const groupMatch =
      isPluxMentioned &&
      group.category
        .split(/[/·()\s]+/)
        .filter((w) => w.length >= 2)
        .some((w) => lower.includes(w.toLowerCase()));

    for (const entry of group.entries) {
      const entryMatch =
        groupMatch ||
        entry.partnerName.toLowerCase().includes(lower) ||
        (isPluxMentioned &&
          entry.modelsDesc
            .split(/[,/\s()]+/)
            .filter((w) => w.length >= 2)
            .some((w) => lower.includes(w.toLowerCase())));

      if (entryMatch) {
        const phoneSummary = entry.phones
          .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
          .join(' / ');
        results.push({
          id: `plux-${group.category}-${entry.partnerName}`,
          categoryBadge: `⚡ PLUX · ${group.category}`,
          title: entry.partnerName,
          phones: entry.phones,
          description: entry.modelsDesc,
          copyMessage: `[롯데하이마트 경기광주점] ⚡ 플럭스(PLUX) A/S 센터 안내\n• 품목/위탁사: ${entry.partnerName}\n• 전화번호: ${phoneSummary}\n• 대상모델: ${entry.modelsDesc}`,
        });
      }
    }
  }

  // 만약 '플럭스 AS'라고만 검색해서 세부 품목이 특정되지 않았으면 플럭스 대표 냉장고/TV/세탁기/당사서비스 노출
  if (isPluxMentioned && results.length === 0) {
    for (const group of PLUX_AS_GROUPS.slice(0, 4)) {
      const firstEntry = group.entries[0];
      if (firstEntry) {
        const phoneSummary = firstEntry.phones
          .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
          .join(' / ');
        results.push({
          id: `plux-default-${group.category}`,
          categoryBadge: `⚡ PLUX · ${group.category}`,
          title: firstEntry.partnerName,
          phones: firstEntry.phones,
          description: firstEntry.modelsDesc,
          copyMessage: `[롯데하이마트 경기광주점] ⚡ 플럭스(PLUX) A/S 안내\n• ${firstEntry.partnerName}: ${phoneSummary}`,
        });
      }
    }
  }

  // 3) 주요 대기업/브랜드 A/S 검색
  for (const major of MAJOR_AS_CENTERS) {
    const tokens = `${major.brand} ${major.keywords}`
      .split(/[\s/()·]+/)
      .filter((w) => w.length >= 2);
    const matched = tokens.some((tok) => lower.includes(tok.toLowerCase()));
    if (matched) {
      const phoneSummary = major.phones
        .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
        .join(' / ');
      results.push({
        id: `major-${major.id}`,
        categoryBadge: '🏢 주요 브랜드 공식 A/S',
        title: major.brand,
        phones: major.phones,
        description: `취급 품목: ${major.keywords}`,
        copyMessage: `[롯데하이마트 경기광주점] 🛠️ ${major.brand} 고객센터 안내\n• 대표번호: ${phoneSummary}`,
      });
    }
  }

  // AS 키워드는 있는데 특정 브랜드가 안 걸렸다면 상위 대표 센터 노출
  if (results.length === 0) {
    return MAJOR_AS_CENTERS.slice(0, 4).map((major) => {
      const phoneSummary = major.phones
        .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
        .join(' / ');
      return {
        id: `major-fallback-${major.id}`,
        categoryBadge: '🏢 주요 브랜드 공식 A/S',
        title: major.brand,
        phones: major.phones,
        description: `취급 품목: ${major.keywords}`,
        copyMessage: `[롯데하이마트 경기광주점] 🛠️ ${major.brand} 고객센터 안내\n• 대표번호: ${phoneSummary}`,
      };
    });
  }

  return results.slice(0, 8);
}

/**
 * (D) 기존 통합 고객관리(CRM) 고객 검색
 */
export function searchCrmCustomersFromCommand(
  rawText: string
): CrmSearchResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  // 신규 고객 저장 명령이 아닌 '조회/검색/찾기' 의도인지 판별
  const isSaveCommand = /(?:저장해|등록해|고객\s*저장|고객\s*등록)/.test(text);
  if (isSaveCommand) return null;

  const isCrmSearchIntent =
    /(?:고객\s*찾아|고객\s*검색|고객\s*조회|고객\s*보여|고객\s*알려|고객\s*누구|오늘\s*배송\s*고객|내일\s*배송\s*고객|긴급\s*고객|결제\s*완료\s*고객|상담\s*중인?\s*고객)/.test(
      text
    );

  if (!isCrmSearchIntent) return null;

  const allCustomers = getCachedCustomers().filter((c) => !c.deletedAt);

  if (/긴급\s*고객/.test(text)) {
    const urgentList = allCustomers.filter((c) => isUrgentCustomer(c));
    return {
      querySummary: `🚨 배송임박 · 미결제 긴급 고객 (${urgentList.length}명)`,
      customers: urgentList,
    };
  }

  if (/오늘\s*배송/.test(text)) {
    const today = getTodayStr();
    const list = allCustomers.filter((c) => c.deliveryDate === today);
    return {
      querySummary: `🚚 오늘(${today}) 배송 예정 고객 (${list.length}명)`,
      customers: list,
    };
  }

  if (/내일\s*배송/.test(text)) {
    const tomorrow = getOffsetDateStr(1);
    const list = allCustomers.filter((c) => c.deliveryDate === tomorrow);
    return {
      querySummary: `🚚 내일(${tomorrow}) 배송 예정 고객 (${list.length}명)`,
      customers: list,
    };
  }

  // 특정 고객 이름 또는 전화번호 뒷자리 검색
  const cleaned = text
    .replace(
      /(?:고객님|고객|찾아줘|찾아|검색해줘|검색|조회해줘|조회|보여줘|보여|알려줘|알려|누구야|누구)/g,
      ' '
    )
    .trim();

  const nameTokens = (cleaned.match(/[가-힣]{2,4}/g) || []).filter(
    (w) => !RESERVED_NON_NAME_WORDS.has(w)
  );
  const numTokens = cleaned.match(/\d{3,4}/g) || [];

  const matched = allCustomers.filter((c) => {
    const nameMatch =
      nameTokens.length > 0 &&
      nameTokens.some((tok) => (c.name || '').includes(tok));
    const phoneMatch =
      numTokens.length > 0 &&
      numTokens.some((num) => (c.phone || '').includes(num));
    if (nameTokens.length === 0 && numTokens.length === 0) return true;
    return nameMatch || phoneMatch;
  });

  const targetLabel =
    nameTokens.length > 0
      ? `'${nameTokens.join(', ')}' 고객 검색 결과 (${matched.length}명)`
      : `통합 고객관리(CRM) 조회 결과 (${matched.length}명)`;

  return {
    querySummary: targetLabel,
    customers: matched.slice(0, 10),
  };
}

/**
 * (E) 보험 청구 안내 검색
 */
export function searchInsuranceFromCommand(
  rawText: string
): InsuranceBriefResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  if (!/(?:보험\s*청구|연장\s*보험|파손\s*보험|수리비\s*청구|보험\s*접수|롯데\s*손해\s*보험)/.test(text)) {
    return null;
  }

  return {
    title: '🛡️ 하이마트 연장보증 · 파손보험 청구 핵심 안내',
    phone: '1566-4982',
    summaryLines: [
      '• 전담 접수처: 롯데손해보험 하이마트 전담센터 (1566-4982)',
      '• 필수 준비서류: ① 수리비 영수증 ② 수리내역서(부품명·고장원인 기재) ③ 통장사본',
      '• 접수 절차: 공식 제조사(삼성/LG 등) A/S 기사 방문 수리 및 결제 후 서류 발급 ➔ 전용 URL 또는 콜센터 접수',
    ],
    copyText:
      '[롯데하이마트 경기광주점] 🛡️ 가전 보험 청구 안내\n• 전담 콜센터: 1566-4982 (롯데손해보험)\n• 준비서류: 수리비 영수증, 수리내역서(고장원인/수리부품 명시), 본인 통장사본',
  };
}

// ============================================================================
// 3. 1차 초고속 한국어 견적 규칙 파서 + 2차 Gemini AI 정밀 파서
// ============================================================================

export function parseKoreanCommandLocal(rawText: string): ParsedAiCommand {
  const text = (rawText || '').trim();
  let workingText = text;

  const shouldOpenProposalDirectly =
    /(?:제안서\s*(?:바로\s*)?(?:보여|띄워|열어|이동|직행)|바로\s*제안서)/.test(text);

  // 1) 하이프리드 (일반구매용: 75 / 150 / 225 / 300) 추출
  const generalHiPreedCounts: GeneralHiPreedCounts = {
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  };
  const hiPreedRegex =
    /(?:하이\s*프리드|프리드(?:\s*라이프)?|상조)\s*(75|150|225|300)(?:\s*만?\s*원?)?(?:\s*[x×*]?\s*(\d+)\s*(?:개|구좌|건)?)?/gi;
  let hpMatch: RegExpExecArray | null;
  while ((hpMatch = hiPreedRegex.exec(workingText)) !== null) {
    const code = hpMatch[1];
    const count = Math.min(6, Math.max(1, parseInt(hpMatch[2] || '1', 10)));
    if (code === '75') generalHiPreedCounts.hf75 = count;
    if (code === '150') generalHiPreedCounts.hf150 = count;
    if (code === '225') generalHiPreedCounts.hf225 = count;
    if (code === '300') generalHiPreedCounts.hf300 = count;
  }
  workingText = workingText.replace(hiPreedRegex, ' ');

  // 2) 구독 플러스 (구독구매용: 72 / 90 / 108) 추출
  const hiPlusCounts: HiPlusCounts = {
    hi72: 0,
    hi90: 0,
    hi108: 0,
  };
  const hiPlusRegex =
    /(?:구독\s*플러스|하이\s*구독\s*플러스|구독\s*프리드|하이\s*플러스|프리드|플러스)\s*(72|90|108)(?:\s*만?\s*원?)?(?:\s*[x×*]?\s*(\d+)\s*(?:개|구좌|건)?)?/gi;
  let plusMatch: RegExpExecArray | null;
  while ((plusMatch = hiPlusRegex.exec(workingText)) !== null) {
    const code = plusMatch[1];
    const count = Math.min(8, Math.max(1, parseInt(plusMatch[2] || '1', 10)));
    if (code === '72') hiPlusCounts.hi72 = count;
    if (code === '90') hiPlusCounts.hi90 = count;
    if (code === '108') hiPlusCounts.hi108 = count;
  }
  workingText = workingText.replace(hiPlusRegex, ' ');

  // 3) 할인 / 포인트 / 추가캐시백 추출
  let instantDiscount = 0;
  const instantRegex =
    /(?:즉시\s*할인|즉할|기본\s*할인|특별\s*할인|할인)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?/i;
  const instMatch = workingText.match(instantRegex);
  if (instMatch) {
    const rawVal = parseKoreanAmount(
      instMatch[1],
      instMatch[2] || (parseFloat(instMatch[1]) < 1000 ? '만' : '')
    );
    instantDiscount = rawVal;
    workingText = workingText.replace(instMatch[0], ' ');
  }

  let pointUsed = 0;
  const pointUsedRegex =
    /(?:포인트\s*사용|포인트\s*차감|사용\s*포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const puMatch = workingText.match(pointUsedRegex);
  if (puMatch) {
    pointUsed = parseKoreanAmount(
      puMatch[1],
      puMatch[2] || (parseFloat(puMatch[1]) < 1000 ? '만' : '')
    );
    workingText = workingText.replace(puMatch[0], ' ');
  }

  let earnedPoints = 0;
  const earnedRegex =
    /(?:적립\s*포인트|엘\s*포인트|L\.?\s*POINT|포인트\s*적립|포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const epMatch = workingText.match(earnedRegex);
  if (epMatch) {
    earnedPoints = parseKoreanAmount(
      epMatch[1],
      epMatch[2] || (parseFloat(epMatch[1]) < 1000 ? '만' : '')
    );
    workingText = workingText.replace(epMatch[0], ' ');
  }

  let extraCashback = 0;
  const extraCbRegex =
    /(?:추가\s*캐시백|익월\s*캐시백|배송\s*익월\s*캐시백|특별\s*캐시백)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?/i;
  const ecbMatch = workingText.match(extraCbRegex);
  if (ecbMatch) {
    extraCashback = parseKoreanAmount(
      ecbMatch[1],
      ecbMatch[2] || (parseFloat(ecbMatch[1]) < 1000 ? '만' : '')
    );
    workingText = workingText.replace(ecbMatch[0], ' ');
  }

  // 4) 구독 개월수 감지 (기본 60개월, 36개월/3년 언급 시 36)
  const subscriptionPeriod: 36 | 60 = /(?:36\s*개월|36\s*M|3\s*년\s*구독)/i.test(text)
    ? 36
    : 60;
  workingText = workingText.replace(/(?:36|60)\s*(?:개월|M)/gi, ' ');

  // 5) 카드사 및 실적 구간 감지
  let generalCardType: ParsedAiCommand['generalCardType'] = '롯데 제휴카드';
  let selectedCardId: AffiliateCardId = 'lotte';
  let selectedCardTierId = 'lotte-30';

  if (/(?:카드\s*미정|카드\s*없음|현금)/.test(text)) {
    generalCardType = '미정';
    selectedCardId = 'none';
    selectedCardTierId = '';
  } else if (/일반\s*카드|타사\s*카드/.test(text)) {
    generalCardType = '일반 카드';
    selectedCardId = 'none';
    selectedCardTierId = '';
  } else if (/삼성\s*(?:제휴\s*)?카드|삼성\s*제휴/.test(text)) {
    generalCardType = '삼성 제휴카드';
    selectedCardId = 'samsung';
    selectedCardTierId = /150\s*만\s*실적/.test(text)
      ? 'samsung-150'
      : /70\s*만\s*실적/.test(text)
      ? 'samsung-70'
      : 'samsung-30';
  } else if (/신한\s*(?:제휴\s*)?카드|신한\s*제휴/.test(text)) {
    generalCardType = '신한 제휴카드';
    selectedCardId = 'shinhan';
    selectedCardTierId = /200\s*만\s*실적/.test(text)
      ? 'shinhan-200'
      : /100\s*만\s*실적/.test(text)
      ? 'shinhan-100'
      : 'shinhan-50';
  } else if (/우리\s*(?:제휴\s*)?카드|우리\s*제휴/.test(text)) {
    generalCardType = '우리 제휴카드';
    selectedCardId = 'woori';
    selectedCardTierId = /120\s*만\s*실적/.test(text)
      ? 'woori-120'
      : /70\s*만\s*실적/.test(text)
      ? 'woori-70'
      : 'woori-30';
  } else if (/롯데\s*(?:제휴\s*)?카드|롯데\s*제휴|제휴\s*카드|롯데/.test(text)) {
    generalCardType = '롯데 제휴카드';
    selectedCardId = 'lotte';
    selectedCardTierId = /150\s*만\s*실적/.test(text)
      ? 'lotte-150'
      : /70\s*만\s*실적/.test(text)
      ? 'lotte-70'
      : 'lotte-30';
  }

  // 6) 고객 정보 (연락처, 배송일, 상태, 고객명, 메모) 추출
  let phone = '';
  const phoneMatch = workingText.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/);
  if (phoneMatch) {
    phone = formatPhoneNumber(phoneMatch[0]);
    workingText = workingText.replace(phoneMatch[0], ' ');
  }

  let deliveryDate = '';
  if (/(?:오늘\s*배송|당일\s*배송)/.test(text)) {
    deliveryDate = getOffsetDateStr(0);
  } else if (/내일\s*배송/.test(text)) {
    deliveryDate = getOffsetDateStr(1);
  } else if (/모레\s*배송/.test(text)) {
    deliveryDate = getOffsetDateStr(2);
  } else if (/(?:다음\s*주|차주)\s*금요일/.test(text)) {
    deliveryDate = getFridayDateStr(true);
  } else if (/금요일\s*배송|이번\s*주\s*금요일/.test(text)) {
    deliveryDate = getFridayDateStr(false);
  } else {
    const isoDateMatch = text.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
    const mdDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*배송)/);
    if (isoDateMatch) {
      deliveryDate = `${isoDateMatch[1]}-${String(isoDateMatch[2]).padStart(2, '0')}-${String(
        isoDateMatch[3]
      ).padStart(2, '0')}`;
    } else if (mdDateMatch) {
      const m = parseInt(mdDateMatch[1], 10);
      const d = parseInt(mdDateMatch[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const y = new Date().getFullYear();
        deliveryDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  let status: AiCustomerStatus = '상담진행중';
  if (/(?:결제\s*완료|계약\s*완료|완납)/.test(text)) {
    status = '결제완료';
  } else if (/(?:배송\s*대기|출고\s*대기)/.test(text)) {
    status = '배송대기';
  } else if (/(?:상담\s*종료|보류|취소)/.test(text)) {
    status = '상담종료';
  }

  let customerName = '';
  const explicitCustomerMatch =
    text.match(/(?:고객명|이름)\s*[:：]?\s*([가-힣]{2,4})/) ||
    text.match(/([가-힣]{2,4})\s*고객(?:님)?/);
  if (explicitCustomerMatch && !RESERVED_NON_NAME_WORDS.has(explicitCustomerMatch[1])) {
    customerName = explicitCustomerMatch[1];
  } else if (phoneMatch) {
    const beforePhone = text.slice(0, text.indexOf(phoneMatch[0])).trim();
    const nameBeforePhone = beforePhone.match(/([가-힣]{2,4})\s*$/);
    if (nameBeforePhone && !RESERVED_NON_NAME_WORDS.has(nameBeforePhone[1])) {
      customerName = nameBeforePhone[1];
    }
  }
  if (!customerName) {
    const nimMatch = text.match(/([가-힣]{2,4})님/);
    if (nimMatch && !RESERVED_NON_NAME_WORDS.has(nimMatch[1])) {
      customerName = nimMatch[1];
    } else if (/(?:저장|등록|고객관리)/.test(text)) {
      const leadingHangul = text.match(/^([가-힣]{2,4})\s+/);
      if (leadingHangul && !RESERVED_NON_NAME_WORDS.has(leadingHangul[1])) {
        customerName = leadingHangul[1];
      }
    }
  }

  const hasSaveKeyword = /(?:저장|등록|고객\s*관리|CRM)/i.test(text);
  const shouldSaveCrm = hasSaveKeyword || Boolean(customerName && phone);

  let memo = '';
  const memoMatch = text.match(/(?:메모|사은품|비고|특이사항)\s*[:：]?\s*([^\n,]+)/);
  if (memoMatch) {
    memo = memoMatch[0]
      .replace(/(?:고객\s*)?(?:저장|등록)(?:해\s*줘|해줘|하기)?/g, '')
      .trim();
  }

  // 7) 품목 및 금액 추출 (일반품목 vs 구독품목)
  const generalItems: ParsedAiCommand['generalItems'] = [];
  const subscriptionItems: ParsedAiCommand['subscriptionItems'] = [];

  const isGlobalSubOnly =
    /(?:^|\s)구독(?:\s*견적)?/.test(text) && !/일반\s*견적|혼합\s*견적/.test(text);

  const itemTokenRegex =
    /(?:(구독)\s*)?(김치\s*냉장고|김냉|시스템\s*에어컨|시스카|세탁\s*건조기|워시\s*타워|워시\s*콤보|원바디|로봇\s*청소기|로청|식기\s*세척기|식세기|공기\s*청정기|공청기|의류\s*관리기|스타일러|에어드레서|얼음\s*정수기|정수기|안마\s*의자|냉장고|양문형|세탁기|드럼\s*세탁기|통돌이|건조기|TV|티비|올레드|OLED|QLED|에어컨|투인원|2in1|청소기|코드제로|인덕션|전기\s*레인지|전자\s*레인지|오븐|큐커|비데|매트리스|침대|와인\s*셀러|노트북|그램|맥북|컴퓨터|PC|아이폰|갤럭시)(?:\s+([A-Za-z0-9][A-Za-z0-9-_]{2,}))?\s*(?:(월)\s*)?([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?(?:\s*(\d+)\s*(?:개|대))?/gi;

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemTokenRegex.exec(workingText)) !== null) {
    const subPrefix = Boolean(itemMatch[1]);
    const rawCat = itemMatch[2];
    const modelCode = (itemMatch[3] || '').trim();
    const monthlyPrefix = Boolean(itemMatch[4]);
    const numStr = itemMatch[5];
    const unitStr = itemMatch[6] || '';
    const qty = Math.max(1, parseInt(itemMatch[7] || '1', 10));

    let normalizedCategory = rawCat.replace(/\s+/g, '');
    for (const kw of APPLIANCE_KEYWORDS) {
      if (kw.pattern.test(rawCat)) {
        normalizedCategory = kw.category;
        break;
      }
    }

    const numericRaw = parseFloat(numStr.replace(/,/g, ''));
    const effectiveUnit =
      unitStr ||
      (!monthlyPrefix && numericRaw > 0 && numericRaw < 1000 ? '만' : '');
    const amount = parseKoreanAmount(numStr, effectiveUnit);

    if (amount <= 0) continue;

    const isSubItem =
      monthlyPrefix ||
      subPrefix ||
      amount < 200000 ||
      (isGlobalSubOnly && amount < 300000);

    if (isSubItem) {
      subscriptionItems.push({
        category: normalizedCategory,
        modelName: modelCode,
        monthlyFee: amount,
        period: subscriptionPeriod,
      });
    } else {
      generalItems.push({
        category: normalizedCategory,
        modelName: modelCode,
        quantity: qty,
        unitPrice: amount,
      });
    }
  }

  let quoteMode: QuoteMode = 'general';
  const hasHiPlus =
    hiPlusCounts.hi72 + hiPlusCounts.hi90 + hiPlusCounts.hi108 > 0;
  if (generalItems.length > 0 && (subscriptionItems.length > 0 || hasHiPlus)) {
    quoteMode = 'hybrid';
  } else if (
    subscriptionItems.length > 0 ||
    (generalItems.length === 0 && (hasHiPlus || /구독|월\s*\d/.test(text)))
  ) {
    quoteMode = 'subscription';
  } else {
    quoteMode = 'general';
  }

  if (/혼합\s*견적/.test(text)) {
    quoteMode = 'hybrid';
  }

  return {
    quoteMode,
    generalItems,
    generalCardType,
    instantDiscount,
    earnedPoints,
    pointUsed,
    extraCashback,
    generalHiPreedCounts,
    subscriptionItems,
    subscriptionPeriod,
    selectedCardId,
    selectedCardTierId,
    hiPlusCounts,
    shouldOpenProposalDirectly,
    customer: {
      shouldSaveCrm,
      name: customerName,
      phone,
      status,
      deliveryDate,
      memo,
    },
  };
}

/**
 * 2차 Gemini AI 정밀 파서
 */
export async function parseCommandWithHybridAi(
  rawText: string
): Promise<{ parsed: ParsedAiCommand; engineLabel: string }> {
  const localResult = parseKoreanCommandLocal(rawText);
  const apiKey = getEffectiveGeminiApiKey();

  // 견적 품목이 없고 휴무표/안심케어/무이자/AS/CRM 검색 전용 명령이면 로컬 엔진으로 즉시 응답
  const hasQuoteItemsLocally =
    localResult.generalItems.length > 0 ||
    localResult.subscriptionItems.length > 0;

  if (!apiKey || !hasQuoteItemsLocally) {
    return {
      parsed: localResult,
      engineLabel: '⚡ 초고속 한국어 통합 엔진 (즉시 처리 완료)',
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const todayStr = getOffsetDateStr(0);
  const tomorrowStr = getOffsetDateStr(1);
  const fridayStr = getFridayDateStr(false);

  const systemPrompt = `당신은 롯데하이마트 경기광주점 통합 총괄 AI 비서입니다.
사용자의 한 줄 자연어 명령을 분석하여 아래 JSON 구조로만 정확히 응답하세요.
오늘 날짜: ${todayStr}, 내일 날짜: ${tomorrowStr}, 이번주 금요일: ${fridayStr}

[추출 규칙]
1. quoteMode: 'general' | 'subscription' | 'hybrid'
2. generalItems: [{ category, modelName, quantity, unitPrice }] (만원 단위는 * 10000 원 단위로 변환)
3. generalCardType: '롯데 제휴카드' | '삼성 제휴카드' | '신한 제휴카드' | '우리 제휴카드' | '일반 카드' | '미정'
4. instantDiscount(즉시할인), earnedPoints(적립포인트/엘포인트), pointUsed(포인트사용), extraCashback(추가캐시백): 원 단위 숫자
5. generalHiPreedCounts: { hf75, hf150, hf225, hf300 }
6. subscriptionItems: [{ category, modelName, monthlyFee, period }]
7. subscriptionPeriod: 36 | 60
8. selectedCardId: 'lotte' | 'samsung' | 'shinhan' | 'woori' | 'none'
9. selectedCardTierId: 롯데 기본 'lotte-30', 삼성 'samsung-30', 신한 'shinhan-50', 우리 'woori-30'
10. hiPlusCounts: { hi72, hi90, hi108 }
11. shouldOpenProposalDirectly: boolean ('제안서 보여줘', '제안서 바로 보여줘', '제안서 띄워줘' 포함 시 true)
12. customer: { shouldSaveCrm: boolean, name: string, phone: string, status: '상담진행중' | '결제완료' | '배송대기' | '상담종료', deliveryDate: string (YYYY-MM-DD), memo: string }`;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n[사용자 명령어]\n${rawText}` }],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const rawJson = (response.text || '').trim();
      if (!rawJson) continue;

      const parsedJson = JSON.parse(rawJson);

      const mergedGeneralItems =
        Array.isArray(parsedJson.generalItems) && parsedJson.generalItems.length > 0
          ? parsedJson.generalItems.map((it: any) => ({
              category: String(it.category || '가전'),
              modelName: String(it.modelName || ''),
              quantity: Math.max(1, Number(it.quantity) || 1),
              unitPrice: Math.max(0, Number(it.unitPrice) || 0),
            }))
          : localResult.generalItems;

      const mergedSubItems =
        Array.isArray(parsedJson.subscriptionItems) &&
        parsedJson.subscriptionItems.length > 0
          ? parsedJson.subscriptionItems.map((it: any) => ({
              category: String(it.category || '구독가전'),
              modelName: String(it.modelName || ''),
              monthlyFee: Math.max(0, Number(it.monthlyFee) || 0),
              period: (Number(it.period) === 36 ? 36 : 60) as 36 | 60,
            }))
          : localResult.subscriptionItems;

      const mergedResult: ParsedAiCommand = {
        quoteMode:
          parsedJson.quoteMode === 'general' ||
          parsedJson.quoteMode === 'subscription' ||
          parsedJson.quoteMode === 'hybrid'
            ? parsedJson.quoteMode
            : localResult.quoteMode,
        generalItems: mergedGeneralItems,
        generalCardType: parsedJson.generalCardType || localResult.generalCardType,
        instantDiscount:
          Number(parsedJson.instantDiscount) > 0
            ? Number(parsedJson.instantDiscount)
            : localResult.instantDiscount,
        earnedPoints:
          Number(parsedJson.earnedPoints) > 0
            ? Number(parsedJson.earnedPoints)
            : localResult.earnedPoints,
        pointUsed:
          Number(parsedJson.pointUsed) > 0
            ? Number(parsedJson.pointUsed)
            : localResult.pointUsed,
        extraCashback:
          Number(parsedJson.extraCashback) > 0
            ? Number(parsedJson.extraCashback)
            : localResult.extraCashback,
        generalHiPreedCounts: {
          hf75:
            Number(parsedJson.generalHiPreedCounts?.hf75) ||
            localResult.generalHiPreedCounts.hf75,
          hf150:
            Number(parsedJson.generalHiPreedCounts?.hf150) ||
            localResult.generalHiPreedCounts.hf150,
          hf225:
            Number(parsedJson.generalHiPreedCounts?.hf225) ||
            localResult.generalHiPreedCounts.hf225,
          hf300:
            Number(parsedJson.generalHiPreedCounts?.hf300) ||
            localResult.generalHiPreedCounts.hf300,
        },
        subscriptionItems: mergedSubItems,
        subscriptionPeriod:
          Number(parsedJson.subscriptionPeriod) === 36
            ? 36
            : localResult.subscriptionPeriod,
        selectedCardId: parsedJson.selectedCardId || localResult.selectedCardId,
        selectedCardTierId:
          parsedJson.selectedCardTierId || localResult.selectedCardTierId,
        hiPlusCounts: {
          hi72:
            Number(parsedJson.hiPlusCounts?.hi72) || localResult.hiPlusCounts.hi72,
          hi90:
            Number(parsedJson.hiPlusCounts?.hi90) || localResult.hiPlusCounts.hi90,
          hi108:
            Number(parsedJson.hiPlusCounts?.hi108) || localResult.hiPlusCounts.hi108,
        },
        shouldOpenProposalDirectly: Boolean(
          parsedJson.shouldOpenProposalDirectly ||
            localResult.shouldOpenProposalDirectly
        ),
        customer: {
          shouldSaveCrm: Boolean(
            parsedJson.customer?.shouldSaveCrm ?? localResult.customer.shouldSaveCrm
          ),
          name: String(
            parsedJson.customer?.name || localResult.customer.name || ''
          ).trim(),
          phone: formatPhoneNumber(
            String(parsedJson.customer?.phone || localResult.customer.phone || '')
          ),
          status:
            parsedJson.customer?.status === '결제완료' ||
            parsedJson.customer?.status === '배송대기' ||
            parsedJson.customer?.status === '상담종료' ||
            parsedJson.customer?.status === '상담진행중'
              ? parsedJson.customer.status
              : localResult.customer.status,
          deliveryDate:
            String(
              parsedJson.customer?.deliveryDate ||
                localResult.customer.deliveryDate ||
                ''
            ).trim(),
          memo: String(
            parsedJson.customer?.memo || localResult.customer.memo || ''
          ).trim(),
        },
      };

      return {
        parsed: mergedResult,
        engineLabel: `✨ Gemini AI 정밀 분석 완료 (${modelName})`,
      };
    } catch {
      // 다음 폴백 모델 재시도
    }
  }

  return {
    parsed: localResult,
    engineLabel: '⚡ 초고속 한국어 통합 엔진 (AI 폴백 완료)',
  };
}

/**
 * ParsedAiCommand -> ProposalState 변환
 */
export function buildProposalStateFromAiCommand(cmd: ParsedAiCommand): ProposalState {
  const normalizedCardType: GeneralCardType =
    cmd.generalCardType === '일반 카드'
      ? '일반카드'
      : cmd.generalCardType === '롯데 제휴카드' ||
        cmd.generalCardType === '삼성 제휴카드' ||
        cmd.generalCardType === '신한 제휴카드' ||
        cmd.generalCardType === '우리 제휴카드' ||
        cmd.generalCardType === '미정'
      ? cmd.generalCardType
      : '롯데 제휴카드';

  const mappedGeneralItems =
    cmd.generalItems.length > 0
      ? cmd.generalItems.map((it, idx) => ({
          id: `ai-gen-${Date.now()}-${idx}`,
          category: it.category || `가전 ${idx + 1}`,
          name: it.category || `가전 ${idx + 1}`,
          modelName: it.modelName || '',
          code: it.modelName || '',
          quantity: Math.max(1, Number(it.quantity) || 1),
          qty: Math.max(1, Number(it.quantity) || 1),
          unitPrice: Math.max(0, Number(it.unitPrice) || 0),
          price:
            Math.max(0, Number(it.unitPrice) || 0) *
            Math.max(1, Number(it.quantity) || 1),
        }))
      : [
          {
            id: `ai-gen-empty-${Date.now()}`,
            category: '',
            modelName: '',
            quantity: 1,
            unitPrice: 0,
          },
        ];

  const mappedSubItems =
    cmd.subscriptionItems.length > 0
      ? cmd.subscriptionItems.map((it, idx) => ({
          id: `ai-sub-${Date.now()}-${idx}`,
          category: it.category || `구독가전 ${idx + 1}`,
          modelName: it.modelName || '',
          modelCode: it.modelName || '',
          monthlyFee: Math.max(0, Number(it.monthlyFee) || 0),
          period: (it.period === 36 ? 36 : 60) as SubscriptionPeriod,
          careService: SUB_CARE_OPTIONS[0],
          warrantyType: 'AS연장보험 + 가전수리올케어',
        }))
      : [
          {
            id: `ai-sub-empty-${Date.now()}`,
            category: '',
            modelName: '',
            monthlyFee: 0,
            period: cmd.subscriptionPeriod,
            careService: SUB_CARE_OPTIONS[0],
          },
        ];

  const plan1: GeneralPlanData = {
    generalItems: mappedGeneralItems,
    generalCardType: normalizedCardType,
    instantDiscount: Math.max(0, Number(cmd.instantDiscount) || 0),
    earnedPoints: Math.max(0, Number(cmd.earnedPoints) || 0),
    pointUsed: Math.max(0, Number(cmd.pointUsed) || 0),
    autoTierCashback: true,
    manualTierCashback: 0,
    extraCashback: Math.max(0, Number(cmd.extraCashback) || 0),
    extraBenefits: [],
    generalHiPreedCounts: {
      hf75: cmd.generalHiPreedCounts.hf75 || 0,
      hf150: cmd.generalHiPreedCounts.hf150 || 0,
      hf225: cmd.generalHiPreedCounts.hf225 || 0,
      hf300: cmd.generalHiPreedCounts.hf300 || 0,
    },
    items: mappedSubItems,
    subscriptionPeriod: cmd.subscriptionPeriod,
    careService: SUB_CARE_OPTIONS[0],
    warrantyType: 'AS연장보험 + 가전수리올케어',
    warrantyYears: 5,
    allCare: true,
    selectedCardId: cmd.selectedCardId || 'none',
    selectedCardTierId: cmd.selectedCardTierId || '',
    hiPlusCounts: {
      hi72: cmd.hiPlusCounts.hi72 || 0,
      hi90: cmd.hiPlusCounts.hi90 || 0,
      hi108: cmd.hiPlusCounts.hi108 || 0,
    },
  };

  const emptyPlan2: GeneralPlanData = {
    generalItems: [
      {
        id: `ai-gen-p2-${Date.now()}`,
        category: '',
        modelName: '',
        quantity: 1,
        unitPrice: 0,
      },
    ],
    generalCardType: '미정',
    instantDiscount: 0,
    earnedPoints: 0,
    pointUsed: 0,
    autoTierCashback: true,
    manualTierCashback: 0,
    extraCashback: 0,
    extraBenefits: [],
    generalHiPreedCounts: { hf75: 0, hf150: 0, hf225: 0, hf300: 0 },
    items: [
      {
        id: `ai-sub-p2-${Date.now()}`,
        category: '',
        modelName: '',
        monthlyFee: 0,
        period: 60,
        careService: SUB_CARE_OPTIONS[0],
      },
    ],
    subscriptionPeriod: 60,
    careService: SUB_CARE_OPTIONS[0],
    warrantyType: 'AS연장보험 + 가전수리올케어',
    warrantyYears: 5,
    allCare: true,
    selectedCardId: 'none',
    selectedCardTierId: '',
    hiPlusCounts: { hi72: 0, hi90: 0, hi108: 0 },
  };

  return {
    quoteMode: cmd.quoteMode,
    activeGeneralPlan: 1,
    generalPlan1: extractGeneralPlanData(plan1),
    generalPlan2: extractGeneralPlanData(emptyPlan2),
    ...plan1,
  };
}

function mapAiStatusToCrmStatus(status: AiCustomerStatus): CustomerStatus {
  if (status === '결제완료' || status === '배송대기') return '계약완료';
  if (status === '상담종료') return '미구매/고민중';
  return '상담진행중';
}

export const AiCommandModal: React.FC<AiCommandModalProps> = ({
  isOpen,
  onClose,
  onApplyToQuote,
  onCustomerSaved,
  onOpenScheduleModal,
  onOpenCareTable,
  onOpenInstallmentModal,
  onOpenAsCenterModal,
  onOpenInsuranceView,
  onOpenCrmScreen,
  onLoadCrmCustomerQuote,
}) => {
  const [commandText, setCommandText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [engineBadge, setEngineBadge] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedAiCommand | null>(null);

  // 휴무표 수정/조회 실행 결과 상태
  const [scheduleModifyResult, setScheduleModifyResult] =
    useState<ScheduleModifyResult | null>(null);
  const [scheduleQueryResult, setScheduleQueryResult] =
    useState<ScheduleQueryResult | null>(null);
  const [myStaffNameInput, setMyStaffNameInput] = useState<string>(() =>
    loadSavedUserName()
  );

  // 안심케어 데이터셋 로드 상태
  const [careDataset, setCareDataset] = useState<CareTableDataset | null>(() =>
    loadLocalCareDataset()
  );

  // 모달 내 고객 정보 수정용 상태
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerDeliveryDate, setCustomerDeliveryDate] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<AiCustomerStatus>('상담진행중');
  const [customerMemo, setCustomerMemo] = useState<string>('');

  const [autoSavedBanner, setAutoSavedBanner] = useState<string | null>(null);
  const [proposalReadyBanner, setProposalReadyBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // 모달 열릴 때 최신 안심케어 데이터셋 및 내 이름 동기화
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    setMyStaffNameInput(loadSavedUserName());
    const localCare = loadLocalCareDataset();
    if (localCare) {
      setCareDataset(localCare);
    } else {
      fetchRemoteCareDataset()
        .then((remote) => {
          if (remote) setCareDataset(remote);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [isOpen]);

  // 실시간 미리보기용 파생 명령
  const effectiveParsedCommand = useMemo<ParsedAiCommand | null>(() => {
    if (parsedResult) {
      return {
        ...parsedResult,
        customer: {
          ...parsedResult.customer,
          name: customerName,
          phone: customerPhone,
          deliveryDate: customerDeliveryDate,
          status: customerStatus,
          memo: customerMemo,
        },
      };
    }
    if (!commandText.trim()) return null;
    return parseKoreanCommandLocal(commandText);
  }, [
    parsedResult,
    commandText,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
  ]);

  // 견적 품목이 실제로 존재하는지 여부
  const hasQuoteItems = useMemo(() => {
    if (!effectiveParsedCommand) return false;
    return (
      effectiveParsedCommand.generalItems.length > 0 ||
      effectiveParsedCommand.subscriptionItems.length > 0 ||
      effectiveParsedCommand.generalHiPreedCounts.hf75 +
        effectiveParsedCommand.generalHiPreedCounts.hf150 +
        effectiveParsedCommand.generalHiPreedCounts.hf225 +
        effectiveParsedCommand.generalHiPreedCounts.hf300 >
        0 ||
      effectiveParsedCommand.hiPlusCounts.hi72 +
        effectiveParsedCommand.hiPlusCounts.hi90 +
        effectiveParsedCommand.hiPlusCounts.hi108 >
        0
    );
  }, [effectiveParsedCommand]);

  const generatedState = useMemo<ProposalState | null>(() => {
    if (!effectiveParsedCommand || !hasQuoteItems) return null;
    return buildProposalStateFromAiCommand(effectiveParsedCommand);
  }, [effectiveParsedCommand, hasQuoteItems]);

  const quotePayload = useMemo(() => {
    if (!generatedState) return null;
    return extractQuotePayloadFromProposalState(generatedState);
  }, [generatedState]);

  // 4대 DB + 보험 실시간 검색 결과
  const careResults = useMemo(
    () => searchCareTableFromCommand(commandText, careDataset),
    [commandText, careDataset]
  );

  const installmentResult = useMemo(
    () => searchInstallmentFromCommand(commandText),
    [commandText]
  );

  const asCenterResults = useMemo(
    () => searchAsCenterFromCommand(commandText),
    [commandText]
  );

  const crmSearchResult = useMemo(
    () => searchCrmCustomersFromCommand(commandText),
    [commandText]
  );

  const insuranceResult = useMemo(
    () => searchInsuranceFromCommand(commandText),
    [commandText]
  );

  // 입력 중일 때 휴무표 조회 프리뷰 (수정은 실행 버튼 클릭 시 실제 반영하거나 즉시 실행)
  const liveSchedulePreview = useMemo(() => {
    if (scheduleModifyResult || scheduleQueryResult) {
      return {
        modifyResult: scheduleModifyResult,
        queryResult: scheduleQueryResult,
      };
    }
    return tryExecuteScheduleCommand(commandText, true);
  }, [commandText, scheduleModifyResult, scheduleQueryResult]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const handleCopyText = useCallback(
    async (key: string, textToCopy: string, toastLabel?: string) => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedCodeKey(key);
        if (toastLabel) showToast(toastLabel);
        setTimeout(() => {
          setCopiedCodeKey((prev) => (prev === key ? null : prev));
        }, 2000);
      } catch {
        // ignore
      }
    },
    [showToast]
  );

  // 음성 인식 토글 (Web Speech API)
  const handleToggleSpeech = useCallback(() => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechNotice(
        '현재 브라우저는 음성 인식을 지원하지 않습니다. 크롬/엣지/사파리에서 이용해 주세요.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.continuous = false;

      const baseText = commandText.trim();

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice('🎙️ 말씀을 듣고 있습니다... 편하게 말씀해 주세요.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const combined = baseText ? `${baseText} ${transcript}` : transcript;
        setCommandText(combined);
        setParsedResult(null);
        setScheduleModifyResult(null);
        setScheduleQueryResult(null);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechNotice('음성 인식이 중단되었습니다. 다시 시도하거나 텍스트로 입력해 주세요.');
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechNotice(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechNotice('마이크 권한을 확인해 주세요.');
    }
  }, [isListening, commandText]);

  // AI 분석 + 휴무표 즉시 수정 + 자동 CRM 저장 + 제안서 직행 통합 실행
  const handleRunAiCommand = useCallback(
    async (overrideText?: string) => {
      const targetText = (overrideText ?? commandText).trim();
      if (!targetText) {
        showToast('명령어를 입력하거나 상단 예시 칩을 선택해 주세요!');
        return;
      }

      setIsAnalyzing(true);
      setAutoSavedBanner(null);
      setProposalReadyBanner(null);

      try {
        // 1) 휴무표 수정/조회 명령 즉시 실행 (localStorage 'himart_gj_schedules_v4' 반영 + 이벤트 발송)
        const schedExec = tryExecuteScheduleCommand(targetText, false);
        setScheduleModifyResult(schedExec.modifyResult);
        setScheduleQueryResult(schedExec.queryResult);
        if (schedExec.modifyResult) {
          showToast(schedExec.modifyResult.message);
        }

        // 2) 1차 로컬 한국어 견적 파서 반영
        const localParsed = parseKoreanCommandLocal(targetText);
        setParsedResult(localParsed);
        setCustomerName(localParsed.customer.name);
        setCustomerPhone(localParsed.customer.phone);
        setCustomerDeliveryDate(localParsed.customer.deliveryDate);
        setCustomerStatus(localParsed.customer.status);
        setCustomerMemo(localParsed.customer.memo);
        setEngineBadge('⚡ 초고속 한국어 통합 엔진 실행 완료');

        // 3) 2차 하이브리드 AI 정밀 파서 호출
        const { parsed: finalParsed, engineLabel } =
          await parseCommandWithHybridAi(targetText);
        setParsedResult(finalParsed);
        setCustomerName(finalParsed.customer.name);
        setCustomerPhone(finalParsed.customer.phone);
        setCustomerDeliveryDate(finalParsed.customer.deliveryDate);
        setCustomerStatus(finalParsed.customer.status);
        setCustomerMemo(finalParsed.customer.memo);
        setEngineBadge(engineLabel);

        const hasItemsInFinal =
          finalParsed.generalItems.length > 0 ||
          finalParsed.subscriptionItems.length > 0 ||
          finalParsed.generalHiPreedCounts.hf75 +
            finalParsed.generalHiPreedCounts.hf150 +
            finalParsed.generalHiPreedCounts.hf225 +
            finalParsed.generalHiPreedCounts.hf300 >
            0 ||
          finalParsed.hiPlusCounts.hi72 +
            finalParsed.hiPlusCounts.hi90 +
            finalParsed.hiPlusCounts.hi108 >
            0;

        if (hasItemsInFinal) {
          const nextState = buildProposalStateFromAiCommand(finalParsed);

          // 4) 고객 저장 키워드가 있고 고객명이 추출되었다면 즉시 CRM 자동 저장
          if (
            finalParsed.customer.shouldSaveCrm &&
            finalParsed.customer.name.trim().length > 0
          ) {
            const payload = extractQuotePayloadFromProposalState(nextState);
            const statusNote =
              finalParsed.customer.status === '결제완료' ||
              finalParsed.customer.status === '배송대기'
                ? `[${finalParsed.customer.status}] `
                : '';
            const mergedMemo =
              `${statusNote}${finalParsed.customer.memo || ''}`.trim() ||
              `[AI 비서 자동등록] ${targetText}`;

            const savedRes = await saveCustomerQuote({
              name: finalParsed.customer.name.trim(),
              phone: finalParsed.customer.phone.trim(),
              items: payload.itemsSummary,
              paidAmount: payload.paidAmount,
              netAmount: payload.netAmount,
              expectedBenefit: payload.expectedBenefit,
              deliveryDate: finalParsed.customer.deliveryDate,
              status: mapAiStatusToCrmStatus(finalParsed.customer.status),
              memo: mergedMemo,
              quoteTitle: payload.defaultQuoteTitle,
              proposalState: nextState,
              quoteMode: nextState.quoteMode,
              plan2Summary: payload.plan2Summary,
            });

            onCustomerSaved(savedRes.savedCustomer, nextState);
            setAutoSavedBanner(
              `✅ 명령어 인식과 동시에 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님이 자동 저장되었습니다!`
            );
            showToast(
              `👑 [${savedRes.savedCustomer.name}] 고객님이 CRM에 자동 저장되었습니다!`
            );
          }

          // 5) "제안서 바로 보여줘" / "제안서 띄워줘" 포함 시 견적 상태를 즉시 제안서 화면(step = 'proposal')에 세팅
          if (finalParsed.shouldOpenProposalDirectly) {
            onApplyToQuote(nextState, 'proposal');
            setProposalReadyBanner(
              '📄 제안서 화면(step = proposal)에 모든 계산 결과가 즉시 세팅되었습니다! 아래 [📄 제안서 화면 바로 확인하기] 버튼을 누르거나 창을 닫으면 바로 제안서가 보입니다.'
            );
            showToast('📄 제안서 화면이 배경에 즉시 세팅되었습니다!');
          }
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [commandText, onApplyToQuote, onCustomerSaved, showToast]
  );

  // 하단 버튼 3: 수동/즉시 CRM 저장 + 견적 반영
  const handleManualSaveToCrm = useCallback(async () => {
    if (!generatedState || !quotePayload) {
      showToast('먼저 견적 명령어를 입력해 주세요!');
      return;
    }

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showToast('⚠️ 저장할 고객명을 입력해 주세요!');
      customerNameInputRef.current?.focus();
      return;
    }

    const statusPrefix =
      customerStatus === '결제완료' || customerStatus === '배송대기'
        ? `[${customerStatus}] `
        : '';
    const finalMemo =
      `${statusPrefix}${customerMemo}`.trim() ||
      `[AI 비서 등록] ${commandText.trim()}`;

    const savedRes = await saveCustomerQuote({
      name: trimmedName,
      phone: formatPhoneNumber(customerPhone),
      items: quotePayload.itemsSummary,
      paidAmount: quotePayload.paidAmount,
      netAmount: quotePayload.netAmount,
      expectedBenefit: quotePayload.expectedBenefit,
      deliveryDate: customerDeliveryDate,
      status: mapAiStatusToCrmStatus(customerStatus),
      memo: finalMemo,
      quoteTitle: quotePayload.defaultQuoteTitle,
      proposalState: generatedState,
      quoteMode: generatedState.quoteMode,
      plan2Summary: quotePayload.plan2Summary,
    });

    onCustomerSaved(savedRes.savedCustomer, generatedState);
    setAutoSavedBanner(
      `✅ 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님의 견적이 저장 및 반영되었습니다!`
    );
    showToast(
      `👑 [${savedRes.savedCustomer.name}] 고객관리(CRM) 저장 및 견적 반영 완료!`
    );
  }, [
    generatedState,
    quotePayload,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
    commandText,
    onCustomerSaved,
    showToast,
  ]);

  if (!isOpen) return null;

  const modeBadgeInfo =
    effectiveParsedCommand?.quoteMode === 'subscription'
      ? {
          label: '2. 구독 견적 모드',
          cls: 'bg-rose-600 text-white border-rose-500',
        }
      : effectiveParsedCommand?.quoteMode === 'hybrid'
      ? {
          label: '3. 혼합 견적 (일반+구독)',
          cls: 'bg-indigo-600 text-white border-indigo-500',
        }
      : {
          label: '1. 일반 견적 모드',
          cls: 'bg-blue-600 text-white border-blue-500',
        };

  const activeModifyCard =
    scheduleModifyResult || liveSchedulePreview.modifyResult;
  const activeQueryCard =
    scheduleQueryResult || liveSchedulePreview.queryResult;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[94dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shrink-0 border border-white/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  🤖 통합 총괄 AI 비서 (견적·제안서·고객관리·휴무표·안심케어·무이자·AS)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  음성 · 자연어 만능 실행
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium truncate">
                견적 계산·제안서 직행·CRM 고객 저장부터 휴무표 말로 수정, 안심케어 단가, 무이자 할부, AS센터까지 한 줄로 해결합니다
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 토스트 알림 */}
          {toastMessage && (
            <div className="p-3 rounded-2xl bg-slate-900 text-amber-300 text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-md animate-fade-in">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {/* 자동 CRM 저장 완료 배지 */}
          {autoSavedBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{autoSavedBanner}</span>
            </div>
          )}

          {/* 제안서 직행 완료 배지 */}
          {proposalReadyBanner && generatedState && (
            <div className="p-3.5 rounded-2xl bg-violet-50 border-2 border-violet-500 text-violet-950 text-xs sm:text-sm font-black flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600 shrink-0" />
                <span>{proposalReadyBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onApplyToQuote(generatedState, 'proposal');
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black cursor-pointer shrink-0 shadow-xs"
              >
                📄 제안서 화면 바로 확인하기
              </button>
            </div>
          )}

          {/* 빠른 예시 칩 4개 */}
          <div className="space-y-1.5">
            <div className="text-xs font-black text-slate-700 flex items-center justify-between flex-wrap gap-1">
              <span>💡 빠른 예시 칩 4가지 (터치하면 즉시 입력 및 자동 실행됩니다)</span>
              {engineBadge && (
                <span className="text-[11px] font-extrabold text-indigo-600">
                  {engineBadge}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setCommandText(ex.command);
                    handleRunAiCommand(ex.command);
                  }}
                  className="p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 text-left transition group cursor-pointer flex flex-col justify-between gap-1"
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 group-hover:text-indigo-900">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {ex.badge}
                  </span>
                  <span className="text-[11px] text-slate-600 font-bold line-clamp-2 leading-snug">
                    "{ex.label}"
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 자연어 입력창 + 음성 인식 + 실행 버튼 */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={commandText}
                onChange={(e) => {
                  setCommandText(e.target.value);
                  setParsedResult(null);
                  setScheduleModifyResult(null);
                  setScheduleQueryResult(null);
                  setAutoSavedBanner(null);
                  setProposalReadyBanner(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleRunAiCommand();
                  }
                }}
                rows={3}
                placeholder="예: ① TV 380만 냉장고 320만 롯데카드 하이프리드 300 1개 제안서 바로 보여줘 / ② 15일 홍길동 휴무로 바꿔줘 / ③ 에어컨 클리닝 단가랑 삼성카드 무이자 알려줘"
                className="w-full rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-hidden p-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 bg-white resize-none shadow-2xs"
              />
            </div>

            {speechNotice && (
              <div className="text-xs font-extrabold text-rose-600 px-1">
                {speechNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>🛑 음성 인식 중지</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-rose-600" />
                    <span>🎤 음성으로 말하기</span>
                  </>
                )}
              </button>

              {commandText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setCommandText('');
                    setParsedResult(null);
                    setScheduleModifyResult(null);
                    setScheduleQueryResult(null);
                    setAutoSavedBanner(null);
                    setProposalReadyBanner(null);
                    setEngineBadge('');
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  초기화
                </button>
              )}

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleRunAiCommand()}
                className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 정밀 실행중...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ AI 자동 계산 및 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* =====================================================================
              [결과 섹션 1] 📅 휴무표 말로 즉시 수정 / 근무·휴무자 조회 카드
             ===================================================================== */}
          {activeModifyCard && (
            <div
              className={`rounded-2xl border-2 p-4 space-y-3 shadow-xs ${
                activeModifyCard.unmatchedStaffName
                  ? 'border-amber-400 bg-amber-50/95'
                  : 'border-emerald-400 bg-emerald-50/90'
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white text-[11px] font-black ${
                      activeModifyCard.unmatchedStaffName
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {activeModifyCard.unmatchedStaffName
                      ? '휴무표 대상 직원 선택 필요'
                      : '휴무표 말로 즉시 수정'}
                  </span>
                  <h3
                    className={`text-sm sm:text-base font-black ${
                      activeModifyCard.unmatchedStaffName
                        ? 'text-amber-950'
                        : 'text-emerald-950'
                    }`}
                  >
                    {activeModifyCard.message}
                  </h3>
                </div>

                {!scheduleModifyResult &&
                  !activeModifyCard.unmatchedStaffName && (
                    <button
                      type="button"
                      onClick={() => handleRunAiCommand()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-xs"
                    >
                      ✅ 지금 바로 휴무표에 반영하기
                    </button>
                  )}
              </div>

              {/* 미등록 이름이거나 내 이름 미설정 시 실제 직원 선택 버튼 목록 표시 */}
              {activeModifyCard.unmatchedStaffName &&
                activeModifyCard.availableStaffList &&
                activeModifyCard.availableStaffList.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white border border-amber-300 space-y-2.5">
                    <div className="text-xs font-black text-slate-800 flex items-center justify-between flex-wrap gap-1">
                      <span>
                        👇 변경할 직원을 터치하면 [{activeModifyCard.monthNum}월{' '}
                        {activeModifyCard.fromDayNum
                          ? `${activeModifyCard.fromDayNum}일 ➔ ${activeModifyCard.toDayNum}일`
                          : `${activeModifyCard.dayNum}일`}{' '}
                        · {activeModifyCard.statusLabel}] 일정이 즉시 반영됩니다:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeModifyCard.availableStaffList.map((staff) => (
                        <button
                          key={staff.name}
                          type="button"
                          onClick={() => {
                            if (activeModifyCard.needsUserNameSetup) {
                              saveUserName(staff.name);
                              setMyStaffNameInput(staff.name);
                            }
                            const execRes = tryExecuteScheduleCommand(
                              commandText,
                              false,
                              staff.name
                            );
                            setScheduleModifyResult(execRes.modifyResult);
                            setScheduleQueryResult(execRes.queryResult);
                            if (execRes.modifyResult) {
                              showToast(execRes.modifyResult.message);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-400 text-slate-900 border border-amber-300 text-xs font-black transition cursor-pointer shadow-2xs"
                        >
                          {staff.name}{' '}
                          <span className="text-[10px] font-bold text-slate-600">
                            ({staff.role})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !scheduleModifyResult &&
                      !activeModifyCard.unmatchedStaffName
                    ) {
                      tryExecuteScheduleCommand(commandText, false);
                    }
                    onClose();
                    onOpenScheduleModal?.();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Calendar className="w-4 h-4" />
                  <span>📅 휴무표 열어서 확인하기</span>
                </button>
              </div>
            </div>
          )}

          {activeQueryCard && (
            <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/80 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {activeQueryCard.dateLabel} 근무 · 휴무 브리핑
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScheduleModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>📅 휴무표 열기</span>
                </button>
              </div>

              {activeQueryCard.targetStaffName &&
                activeQueryCard.targetStaffOffDays && (
                  <div className="p-3 rounded-xl bg-white border border-sky-200 space-y-1.5">
                    <div className="text-xs font-black text-sky-950">
                      👤 [{activeQueryCard.targetStaffName}]님 {activeQueryCard.monthNum}월 전체 휴무/특근 일정
                    </div>
                    {activeQueryCard.targetStaffOffDays.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeQueryCard.targetStaffOffDays.map((d) => (
                          <span
                            key={d.day}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black"
                          >
                            {activeQueryCard.monthNum}/{d.day}일 ({d.label})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-500">
                        해당 월에 등록된 휴무 일정이 없습니다.
                      </p>
                    )}
                  </div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-1.5">
                  <div className="text-xs font-black text-rose-700">
                    🌴 쉬는 직원 (휴무/연차/휴가: {activeQueryCard.offStaff.length}명)
                  </div>
                  {activeQueryCard.offStaff.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeQueryCard.offStaff.map((st) => (
                        <span
                          key={st.name}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-black"
                        >
                          {st.name}{' '}
                          <span className="text-[10px] text-rose-600">
                            ({st.badge})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">
                      등록된 휴무자가 없습니다 (전원 근무 또는 휴무표 미업로드).
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1.5">
                  <div className="text-xs font-black text-emerald-800">
                    💼 근무 직원 ({activeQueryCard.workingStaff.length}명)
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {activeQueryCard.workingStaff.map((st) => (
                      <span
                        key={st.name}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold"
                      >
                        {st.name}
                        {st.note ? `(${st.note})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 2] 📋 안심케어 · 가전이사 조견표 검색 결과 카드
             ===================================================================== */}
          {careResults.length > 0 && (
            <div className="rounded-2xl border-2 border-teal-300 bg-teal-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-700 text-white text-xs font-black flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" />
                    안심케어 · 가전이사 조견표 검색 ({careResults.length}건)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCareTable?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>📋 안심케어 조견표 화면 열기</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-teal-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-teal-900 text-white font-black">
                      <th className="py-2 px-3">분류 / 상품명</th>
                      <th className="py-2 px-3">상품코드 (모델코드)</th>
                      <th className="py-2 px-3 text-right">단가 / 행사가</th>
                      <th className="py-2 px-3 text-center">코드 복사</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {careResults.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/50">
                        <td className="py-2 px-3">
                          <div className="font-black text-slate-900">
                            [{item.category}] {item.name}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            {item.section} {item.note ? `· ${item.note}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-teal-800">
                          {item.code}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                          {item.price}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                `care-${item.id}`,
                                item.code,
                                `📋 상품코드 [${item.code}] 복사 완료!`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-950 font-black text-[11px] cursor-pointer"
                          >
                            {copiedCodeKey === `care-${item.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>📋 상품코드 복사</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 3] 💳 카드 무이자 할부 조견표 검색 결과 카드
             ===================================================================== */}
          {installmentResult && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-black flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  💳 {installmentResult.querySummary}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInstallmentModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>💳 무이자 할부표 열기</span>
                </button>
              </div>

              {installmentResult.matchedSummaries.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {installmentResult.matchedSummaries.map((qs) => (
                    <div
                      key={qs.brandKey}
                      className="p-3 rounded-xl bg-white border border-amber-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {qs.brandTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-black">
                          핵심 요약
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-700 space-y-0.5">
                        <div>
                          • <strong className="text-blue-700">무이자:</strong>{' '}
                          {qs.freeInstallment}
                        </div>
                        {qs.partialInstallment &&
                          qs.partialInstallment !== '없음' && (
                            <div>
                              •{' '}
                              <strong className="text-amber-700">
                                부분무이자(다이나믹):
                              </strong>{' '}
                              {qs.partialInstallment}
                            </div>
                          )}
                        {qs.subInstallment && qs.subInstallment !== '없음' && (
                          <div>
                            •{' '}
                            <strong className="text-emerald-700">
                              구독전용 무이자:
                            </strong>{' '}
                            {qs.subInstallment}
                          </div>
                        )}
                        {Array.isArray(qs.specialNotes) &&
                          qs.specialNotes.length > 0 && (
                            <div className="text-[11px] text-slate-500 pt-0.5">
                              ※ {qs.specialNotes.join(' / ')}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {installmentResult.matchedColumns.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {installmentResult.matchedColumns.map(({ col, highlightRows }) => (
                    <div
                      key={col.id}
                      className="p-2.5 rounded-xl bg-white/90 border border-slate-200 space-y-1"
                    >
                      <div className="text-xs font-black text-indigo-950">
                        [{col.brand}] {col.subName}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {highlightRows.map((hr) => (
                          <span
                            key={hr.label}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${
                              hr.status === 'free'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : hr.status === 'partial'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : hr.status === 'sub-free'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {hr.label.replace('(비고)', '')}: {hr.text}
                            {hr.subText ? ` (${hr.subText})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 4] 🛠️ 가전 AS센터 · 플럭스(PLUX) · TCL 번호 검색 카드
             ===================================================================== */}
          {asCenterResults.length > 0 && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  🛠️ 가전 A/S 센터 · 플럭스(PLUX) · TCL 검색 ({asCenterResults.length}건)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAsCenterModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>🛠️ AS센터 창 열기</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {asCenterResults.map((asItem) => {
                  const primaryPhone = asItem.phones[0]?.number || '';
                  return (
                    <div
                      key={asItem.id}
                      className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black">
                          {asItem.categoryBadge}
                        </span>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          {asItem.title}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {asItem.phones.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900 text-xs font-black"
                            >
                              {p.label ? `${p.label}: ` : ''}
                              <span className="text-emerald-700">{p.number}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 leading-snug">
                          {asItem.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <a
                          href={`tel:${primaryPhone}`}
                          className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>📞 바로 전화걸기</span>
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              `as-${asItem.id}`,
                              asItem.copyMessage,
                              `💬 [${asItem.title}] 고객 안내문이 복사되었습니다!`
                            )
                          }
                          className="py-1.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          {copiedCodeKey === `as-${asItem.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-800" />
                              <span>복사됨</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>💬 고객 안내문 복사</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 5] 👑 기존 통합 고객관리(CRM) 고객 검색 카드
             ===================================================================== */}
          {crmSearchResult && (
            <div className="rounded-2xl border-2 border-purple-300 bg-purple-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-purple-700 text-white text-xs font-black flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {crmSearchResult.querySummary}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCrmScreen?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>👑 통합 고객관리 열기</span>
                </button>
              </div>

              {crmSearchResult.customers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {crmSearchResult.customers.map((cust) => (
                    <div
                      key={cust.id}
                      className="p-3 rounded-xl bg-white border border-purple-200 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {cust.name} 고객님
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[11px] font-black">
                            {cust.status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                          📞 {cust.phone || '연락처 미등록'}{' '}
                          {cust.deliveryDate ? `· 🚚 배송: ${cust.deliveryDate}` : ''}
                        </div>
                        <div className="text-xs font-extrabold text-slate-800 truncate">
                          📦 {cust.items || '품목 미상'}
                        </div>
                        <div className="text-xs font-black text-blue-700">
                          실결제가: {formatCurrency(Number(cust.paidAmount) || 0)}원 / 체감가:{' '}
                          {formatCurrency(Number(cust.netAmount) || 0)}원
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadCrmCustomerQuote?.(cust);
                            onClose();
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>📊 이 고객 견적서 불러오기</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs font-bold text-slate-500">
                  일치하는 저장 고객이 없습니다. [👑 통합 고객관리 열기]에서 전체 명단을 확인해 주세요.
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 6] 🛡️ 보험 청구 안내 요약 카드
             ===================================================================== */}
          {insuranceResult && (
            <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/80 p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-blue-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  {insuranceResult.title}
                </span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${insuranceResult.phone}`}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>📞 {insuranceResult.phone}</span>
                  </a>
                  {onOpenInsuranceView && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenInsuranceView();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
                    >
                      🛡️ 보험 청구안내 화면 열기
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-blue-200 text-xs font-bold text-slate-700 space-y-1">
                {insuranceResult.summaryLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 7] 실시간 매장 공식 수식 견적 검증 및 미리보기 카드
             ===================================================================== */}
          {effectiveParsedCommand && hasQuoteItems && quotePayload && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-slate-50/80 p-3.5 sm:p-4 space-y-3.5">
              {/* 상단: 감지된 견적 모드 및 요약 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border ${modeBadgeInfo.cls}`}
                  >
                    {modeBadgeInfo.label}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    {quotePayload.itemsSummary}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-slate-500">
                  카드: {effectiveParsedCommand.generalCardType}
                </span>
              </div>

              {/* 일반구매 계산 결과 요약 (일반 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'general' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primaryGenSummary.sum > 0 && (
                  <div className="rounded-2xl bg-white border border-blue-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        일반구매 매장 공식 수식 계산 결과
                      </span>
                      {quotePayload.primaryGenSummary.tierCashback > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black">
                          금액대 자동 캐시백{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.tierCashback
                          )}
                          원 적용
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          총 행사가 합계
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          {formatCurrency(quotePayload.primaryGenSummary.sum)}원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          즉시할인 + 하이프리드
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primaryGenSummary
                              .totalStep1InstantDiscount +
                              quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="text-[11px] font-extrabold text-blue-800">
                          실결제가 (결제부담금)
                        </div>
                        <div className="text-xs sm:text-sm font-black text-blue-700">
                          {formatCurrency(
                            quotePayload.primaryGenSummary.payPrice
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          최종 체감 혜택가
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          {formatCurrency(quotePayload.primaryGenSummary.rawNet)}원
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-600 flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                      <span>
                        • 즉시할인:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.instantDiscount
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.hiFreedSupport > 0 && (
                        <span className="text-indigo-700 font-black">
                          • 하이프리드({quotePayload.primaryGenSummary.comboLabel}): -
                          {formatCurrency(
                            quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </span>
                      )}
                      <span>
                        • 금액대 캐시백:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.tierCashback
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.extraCashback > 0 && (
                        <span>
                          • 추가 캐시백:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.extraCashback
                          )}
                          원
                        </span>
                      )}
                      {quotePayload.primaryGenSummary.earnedPoints > 0 && (
                        <span>
                          • L.POINT:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.earnedPoints
                          )}
                          P
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* 구독구매 계산 결과 요약 (구독 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'subscription' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primarySubSummary.totalBaseMonthly > 0 && (
                  <div className="rounded-2xl bg-white border border-rose-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-rose-600" />
                        구독구매 ({quotePayload.primarySubSummary.periodLabel}) 계산
                        결과
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black">
                        총 약정원금{' '}
                        {formatCurrency(
                          quotePayload.primarySubSummary.totalPrincipal
                        )}
                        원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          월 기본 구독료
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.totalBaseMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          제휴카드 월 할인
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.cardDiscount
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          구독플러스 월 지원
                        </div>
                        <div className="text-xs sm:text-sm font-black text-indigo-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.hiPlusMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          월 최종 체감 구독료
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.finalMonthlyFee
                          )}
                          원
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* 통합 고객관리(CRM) 즉시 연동 입력 폼 */}
              <div className="rounded-2xl bg-amber-50/70 border border-amber-300 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    👑 통합 고객관리(CRM) 저장 정보 (비어 있으면 바로 입력 가능)
                  </span>
                  {effectiveParsedCommand.customer.shouldSaveCrm && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      CRM 저장 감지됨
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      고객명 (필수)
                    </label>
                    <input
                      ref={customerNameInputRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      연락처
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) =>
                        setCustomerPhone(formatPhoneNumber(e.target.value))
                      }
                      placeholder="010-0000-0000"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      배송 예정일
                    </label>
                    <input
                      type="date"
                      value={customerDeliveryDate}
                      onChange={(e) => setCustomerDeliveryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      상담/결제 상태
                    </label>
                    <select
                      value={customerStatus}
                      onChange={(e) =>
                        setCustomerStatus(e.target.value as AiCustomerStatus)
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    >
                      <option value="상담진행중">상담진행중</option>
                      <option value="결제완료">결제완료</option>
                      <option value="배송대기">배송대기</option>
                      <option value="상담종료">상담종료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                    상담 메모 / 약속 사은품
                  </label>
                  <input
                    type="text"
                    value={customerMemo}
                    onChange={(e) => setCustomerMemo(e.target.value)}
                    placeholder="예: 금요일 오전 배송 요청, 냄비세트 사은품 약속"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                  />
                </div>
              </div>

              {/* 하단 원클릭 실행 버튼 3종 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!generatedState) return;
                    onApplyToQuote(generatedState, 'input');
                    onClose();
                  }}
                  className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>📝 조건 입력 화면에 채우기</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!generatedState) return;
                    onApplyToQuote(generatedState, 'proposal');
                    onClose();
                  }}
                  className="py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>📄 제안서 바로 보기 (미리보기 직행)</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualSaveToCrm}
                  className="py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm border border-amber-500 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-slate-950 shrink-0" />
                  <span>👑 고객관리(CRM)에 즉시 저장 + 견적 반영</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
