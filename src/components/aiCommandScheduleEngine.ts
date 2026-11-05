import React from 'react';
import { AffiliateCardId, GeneralHiPreedCounts, HiPlusCounts, ProposalState, QuoteMode } from '../types/proposal';
import { CustomerItem } from '../crm/types/crm';
import { CareTableItem } from '../utils/careTableParser';
import { INSTALLMENT_ROW_LABELS, InstallmentCardColumnDef, InstallmentQuickSummaryCardItem } from '../utils/installmentParser';
import { DayScheduleCode, getOrCreateMonthSchedule, GWANGJU_STAFF_ROSTER, isOffDayCode, loadAllSchedules, loadSavedUserName, saveAllSchedules } from './ScheduleModal';

export type InstallmentRowLabel = (typeof INSTALLMENT_ROW_LABELS)[number];
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

export interface AiCommandModalProps {
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
  initialCommand?: string;
  onClearInitialCommand?: () => void;
  currentProposalState?: ProposalState;
}

// 상단 빠른 예시 칩 4개 (① 견적+제안서 바로보기 / ② 견적+고객저장 / ③ 휴무표 말로 수정 / ④ 안심케어·무이자·AS 검색)
export const QUICK_EXAMPLES = [
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
export const FALLBACK_CARE_ITEMS: CareTableItem[] = [
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

export function parseKoreanAmount(numStr: string, unitStr?: string): number {
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

export const APPLIANCE_KEYWORDS: { pattern: RegExp; category: string }[] = [
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

export const RESERVED_NON_NAME_WORDS = new Set([
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

export const SCHEDULE_NON_NAME_WORDS = new Set([
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

export interface ExtractedDateToken {
  yearMonth: string;
  monthNum: number;
  dayNum: number;
  rawLabel: string;
  index: number;
}

/**
 * 문장 내 등장하는 모든 날짜 표현('오늘', '내일', '모레', '어제', 'M월 N일', 'N일')을 등장 순서대로 추출
 */
export function extractAllDateTokensInOrder(text: string): ExtractedDateToken[] {
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

export function parseTargetDateFromCommand(text: string): {
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
export function detectScheduleStatusCode(text: string): {
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
