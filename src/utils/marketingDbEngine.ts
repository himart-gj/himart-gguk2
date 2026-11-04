import { ADMIN_PIN_CODE } from './careTableParser';
import { DEFAULT_OWNER_BUSINESS_CARD_DATA_URI } from './ownerBusinessCardAsset';
import { idbMirrorGet, idbMirrorSet } from './offlineDbQueue';
import {
  getOrCreateMonthSchedule,
  isOffDayCode,
  loadAllSchedules,
} from '../components/ScheduleModal';
import {
  getCachedCustomers,
  setCachedCustomers,
  syncCustomerToGas,
} from '../crm/services/gasApi';
import { getNowDateTimeStr, getTodayStr } from '../crm/utils/date';
import { safeCopyText } from './mobileQaRuntime';
import { CustomerItem, CustomerStatus } from '../crm/types/crm';

// ============================================================================
// 국지현 전용 스텔스 마케팅 DB관리 엔진 (타 직원 기기 노출 0% 보장)
// 대상 구글시트: [인스타 광고 전용 DB] 상조결합 고객 접수 현황
// 문서 고유 ID: 1ViZsP3UYxwSTAUJgu9rhEabcbLJ54zEI07eyoWXTbBk
// ============================================================================

export const DEFAULT_INSTA_SHEET_ID =
  '1ViZsP3UYxwSTAUJgu9rhEabcbLJ54zEI07eyoWXTbBk';
export const DEFAULT_INSTA_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_INSTA_SHEET_ID}/edit`;

export const OWNER_DB_UNLOCKED_KEY = 'himart_gj_owner_db_unlocked_v1';
export const OWNER_DB_CUSTOM_PIN_KEY = 'himart_gj_owner_db_pin_v1';
export const MARKETING_DB_STORAGE_KEY = 'himart_gj_marketing_db_state_v1';
export const MARKETING_DB_UPDATED_EVENT = 'himart_gj_marketing_db_updated';

export type MarketingLeadStatus =
  | '신규'
  | '문자전송'
  | '상담진행중'
  | '무응답'
  | '타직원인계'
  | '계약완료';

export const MARKETING_LEAD_STATUSES: MarketingLeadStatus[] = [
  '신규',
  '문자전송',
  '상담진행중',
  '무응답',
  '타직원인계',
  '계약완료',
];

export function normalizeLeadStatusValue(
  raw: unknown,
  handoverStaff?: string | null
): MarketingLeadStatus {
  const s = String(raw || '').trim();
  if (s === '계약완료') return '계약완료';
  if (s === '타직원인계' || s === '타 직원 인계') return '타직원인계';
  // 기존 데이터에 인계 직원이 지정되어 있고 계약완료가 아니면 자동으로 '타직원인계' 탭으로 매핑
  if (handoverStaff && String(handoverStaff).trim()) {
    return '타직원인계';
  }
  if (s === '상담진행중' || s === '상담전환' || s === '응답') return '상담진행중';
  if (s === '무응답') return '무응답';
  if (s === '문자전송') return '문자전송';
  return '신규';
}

export interface MarketingSmsTemplate {
  id: string;
  title: string;
  body: string;
}

export interface MarketingLeadItem {
  id: string;
  /** 구글시트 중복 유입 및 삭제 후 재부활 방지용 고유 지문 */
  fingerprint: string;
  /** 접수일시 (YYYY-MM-DD HH:mm) */
  createdAt: string;
  /** 월별 관리 기준 연월 (YYYY-MM) */
  yearMonth: string;
  /** 고객명 */
  customerName: string;
  /** 정규화된 연락처 (010-XXXX-XXXX) */
  phone: string;
  /** 원본 희망 혜택 / 관심 품목 */
  interestBenefit: string;
  /** 원본 희망 안내 방식 */
  preferredContact: string;
  /** 유입 플랫폼 (인스타그램 등) */
  platform: string;
  /** 광고 캠페인명 / 양식명 */
  campaignName?: string;
  /** 시트 업데이트 시 자동 생성된 핵심 요약 */
  autoSummary: string;
  /** 현재 DB 진행 상태 */
  status: MarketingLeadStatus;
  /** 상담 인계 직원명 (미인계 시 '' = 국지현 직접상담) */
  handoverStaff: string;
  /** 인계 직원 직급/파트 표시용 */
  handoverStaffRole?: string;
  /** 인계 일시 */
  handoverAt?: string;
  /** 계약완료 시 입력하는 발생매출 (원) */
  revenueAmount: number;
  /** 진행 메모 / 추가 상담 요약 */
  memo: string;
  /** 마지막 문자 발송 일시 */
  smsSentAt?: string;
  /** 연동된 통합 고객관리(CRM) 카드 ID */
  linkedCrmCustomerId?: string;
  /** 삭제 시각 (휴지통 보관 · 시트 재동기화 부활 차단) */
  deletedAt?: number;
}

export interface MarketingDbConfig {
  /** Apps Script 웹앱 URL (시트 비공개 유지 + 실시간 양방향 연동용) */
  gasWebAppUrl: string;
  /** 웹에 게시된 CSV URL 또는 시트 공유 URL (선택) */
  sheetCsvOrShareUrl: string;
  /** 기본 선택 문자 템플릿 ID */
  activeTemplateId: string;
  /** 정해진 문자 템플릿 목록 */
  smsTemplates: MarketingSmsTemplate[];
  /** 상담전환/계약완료 변경 시 자동으로 고객관리(CRM) 카드에도 저장할지 여부 */
  autoSaveCrmOnConvert: boolean;
  /** 명함 이미지 Data URI (미지정 시 기본 국지현 명함 자동 사용) */
  businessCardDataUri?: string;
  /** 카드에서 [명함+문자 발송] 원터치 시 기본 동작 ('sms-clipboard' | 'share-sheet') */
  businessCardSendMethod?: 'sms-clipboard' | 'share-sheet';
  /** 마지막 시트 동기화 시각 */
  lastSyncedAt?: string;
}

export interface MarketingDbStore {
  version: 1;
  leads: MarketingLeadItem[];
  deletedFingerprints: string[];
  config: MarketingDbConfig;
}

export interface HandoverStaffOption {
  name: string;
  role: string;
  isOffToday: boolean;
  todayCode: string;
}

// ==================== 1. 국지현 전용 스텔스 잠금 제어 ====================

export function getOwnerDbPin(): string {
  try {
    const custom = (localStorage.getItem(OWNER_DB_CUSTOM_PIN_KEY) || '').trim();
    if (custom.length >= 4) return custom;
  } catch {
    // ignore
  }
  return ADMIN_PIN_CODE;
}

export function setOwnerDbPin(nextPin: string): boolean {
  const cleaned = (nextPin || '').trim();
  if (cleaned.length < 4) return false;
  try {
    localStorage.setItem(OWNER_DB_CUSTOM_PIN_KEY, cleaned);
    return true;
  } catch {
    return false;
  }
}

export function isOwnerMarketingDbUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // URL에 ?ownerdb=462846 등이 전달되면 즉시 기기 인증 후 URL 파라미터 흔적 자동 제거
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get('ownerdb');
    if (urlKey && (urlKey.trim() === getOwnerDbPin() || urlKey.trim() === ADMIN_PIN_CODE)) {
      localStorage.setItem(OWNER_DB_UNLOCKED_KEY, '1');
      params.delete('ownerdb');
      const rest = params.toString();
      const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
      return true;
    }
    return localStorage.getItem(OWNER_DB_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function verifyAndUnlockOwnerDb(pinInput: string): boolean {
  const cleaned = (pinInput || '').trim().replace(/^#(?:db)?/i, '');
  if (!cleaned) return false;
  if (cleaned === getOwnerDbPin() || cleaned === ADMIN_PIN_CODE) {
    try {
      localStorage.setItem(OWNER_DB_UNLOCKED_KEY, '1');
      window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

export function lockOwnerMarketingDb(): void {
  try {
    localStorage.removeItem(OWNER_DB_UNLOCKED_KEY);
    window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

// ==================== 2. 전화번호 · 날짜 · 자동 한줄 요약 정규화 ====================

export function normalizeKoreanLeadPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let s = String(rawPhone).trim();
  // Meta Lead Ads prefix 제거 ('p:+8210...', 'p:010...')
  s = s.replace(/^p:\s*/i, '');
  if (s.startsWith('+82')) {
    s = '0' + s.slice(3).replace(/^[\s-]+/, '');
  } else if (s.startsWith('8210') && s.replace(/\D/g, '').length === 12) {
    s = '0' + s.replace(/\D/g, '').slice(2);
  }
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  // 엑셀에서 앞자리 0이 잘려 10XXXXXXXX으로 들어온 경우 복원
  const normDigits =
    digits.length === 10 && digits.startsWith('10') ? `0${digits}` : digits;

  if (normDigits.length === 11) {
    return `${normDigits.slice(0, 3)}-${normDigits.slice(3, 7)}-${normDigits.slice(7)}`;
  }
  if (normDigits.length === 10) {
    return `${normDigits.slice(0, 3)}-${normDigits.slice(3, 6)}-${normDigits.slice(6)}`;
  }
  return normDigits;
}

export function normalizeLeadDateTime(rawDate?: string | null): {
  createdAt: string;
  yearMonth: string;
} {
  const fallbackNow = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatKst = (d: Date) => {
    // KST (+09:00) 변환 보장
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const kst = new Date(utcMs + 9 * 3600 * 1000);
    const yyyy = kst.getFullYear();
    const mm = pad(kst.getMonth() + 1);
    const dd = pad(kst.getDate());
    const hh = pad(kst.getHours());
    const mi = pad(kst.getMinutes());
    return {
      createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  };

  const s = String(rawDate || '').trim();
  if (!s) return formatKst(fallbackNow);

  // 이미 한국형 '2026-11-04 08:09' 또는 '2026. 11. 4. 오전 8:09' 형태인 경우
  const korSimple = s.match(
    /^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/
  );
  if (korSimple && !s.includes('T')) {
    const yyyy = korSimple[1];
    const mm = pad(Number(korSimple[2]));
    const dd = pad(Number(korSimple[3]));
    const hh = pad(Number(korSimple[4] || 0));
    const mi = pad(Number(korSimple[5] || 0));
    return {
      createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  }

  // ISO 타임스탬프 (예: 2026-11-03T18:09:39-05:00) -> 정확한 한국시간(KST)으로 자동 변환
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    return formatKst(new Date(parsed));
  }

  return formatKst(fallbackNow);
}

export function cleanMetaFieldText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 시트에 신규 고객이 업데이트될 때 관심 혜택·안내 방식·유입 채널을 즉시 읽기 쉽게 한 줄 요약
 */
export function buildLeadAutoSummary(params: {
  interestBenefit?: string;
  preferredContact?: string;
  platform?: string;
  campaignName?: string;
}): string {
  const benefitRaw = cleanMetaFieldText(params.interestBenefit);
  const contactRaw = cleanMetaFieldText(params.preferredContact);
  const platformRaw = cleanMetaFieldText(params.platform);

  const platformTag =
    platformRaw.toLowerCase() === 'ig' || platformRaw.includes('인스타')
      ? '인스타'
      : platformRaw.toLowerCase() === 'fb' || platformRaw.includes('페이스')
      ? '페이스북'
      : platformRaw || '메타광고';

  let shortBenefit = benefitRaw;
  if (benefitRaw.includes('이사') && benefitRaw.includes('혼수')) {
    shortBenefit = '이사·혼수 세트가전(삼성/LG 오픈점 최대지원) 희망';
  } else if (benefitRaw.includes('상조') && benefitRaw.includes('결합')) {
    shortBenefit = '상조결합 가전 최대지원(구매부담 경감) 희망';
  } else if (benefitRaw.includes('구독')) {
    shortBenefit = '가전 구독 케어·월 체감가 혜택 희망';
  } else if (benefitRaw) {
    shortBenefit = `${benefitRaw} 관심`;
  } else {
    shortBenefit = '맞춤 가전 혜택 상담 요청';
  }

  let shortContact = contactRaw;
  if (contactRaw.includes('비대면')) {
    shortContact = '비대면(카톡·문자·전화) 선견적 요청';
  } else if (contactRaw.includes('방문') || contactRaw.includes('매장')) {
    shortContact = '매장 방문 상담 희망';
  } else if (contactRaw.includes('전화')) {
    shortContact = '전화 상담 희망';
  }

  const parts = [`[${platformTag}]`, shortBenefit];
  if (shortContact) parts.push(`· ${shortContact}`);
  return parts.join(' ');
}

export function makeLeadFingerprint(
  customerName: string,
  phone: string,
  createdAt: string,
  rawMetaLeadId?: string
): string {
  if (rawMetaLeadId && rawMetaLeadId.trim()) {
    return `meta_${rawMetaLeadId.trim()}`;
  }
  const cleanDigits = normalizeKoreanLeadPhone(phone).replace(/\D/g, '');
  const cleanDate = (createdAt || '').slice(0, 16).trim();
  const cleanName = (customerName || '').trim().toLowerCase();
  if (cleanDigits) {
    return `ph_${cleanDigits}_${cleanDate.slice(0, 10)}`;
  }
  return `nm_${cleanName}_${cleanDate}`;
}

// ==================== 3. 기본 문자 템플릿 & 실제 시트 초기 시드 (11건) ====================

export function resolveLeadPlatformDisplayName(rawPlatform?: string | null): string {
  const p = String(rawPlatform || '').trim().toLowerCase();
  if (p === 'fb' || p.includes('facebook') || p.includes('페이스') || p.includes('페북')) {
    return '페이스북';
  }
  if (p === 'ig' || p.includes('insta') || p.includes('인스타')) {
    return '인스타그램';
  }
  return '인스타·페이스북';
}

export const DEFAULT_SMS_TEMPLATES: MarketingSmsTemplate[] = [
  {
    id: 'tpl-default-1',
    title: '1번 기본 1차 상담예약 안내 문자 (인스타·페북 자동변환)',
    body: [
      '안녕하세요 {고객명} 고객님 :)',
      '롯데하이마트 경기광주점 국지현입니다.',
      '',
      '{플랫폼}으로 상담예약 신청해주셔서 연락드립니다.',
      '하단 내용을 남겨주시면 견적진행하여 안내해드리겠습니다.',
      '',
      '- 이사/입주/웨딩/일반 중 택1',
      '- 상담희망 품목 or 견적서 공유',
      '- 희망하는 브랜드',
      '- 배송예정일',
    ].join('\n'),
  },
  {
    id: 'tpl-sangjo-2',
    title: '2번 상조(라이프케어) 결합 상담예약 안내 문자 (인스타·페북 자동변환)',
    body: [
      '안녕하세요 {고객명} 고객님 :)',
      '롯데하이마트 경기광주점 국지현입니다.',
      '',
      '{플랫폼}으로 라이프케어 결합 가전 상담예약 신청해주셔서 연락드립니다.',
      '하단 내용을 남겨주시면 결합 지원 혜택 포함하여 견적진행 후 안내해드리겠습니다.',
      '',
      '- 이사/입주/웨딩/일반 중 택1',
      '- 상담희망 품목 or 견적서 공유',
      '- 희망하는 브랜드',
      '- 배송예정일',
    ].join('\n'),
  },
  {
    id: 'tpl-followup-3',
    title: '3번 무응답 고객 2차 리마인드 안부 문자',
    body: [
      '안녕하세요 {고객명} 고객님, 롯데하이마트 경기광주점 국지현입니다 :)',
      '',
      '지난번 인스타로 신청해 주신 가전 혜택 관련하여 혹시 바쁘셔서 확인 못 하셨을까 하여 다시 한번 안내 남깁니다.',
      '부담 없이 품목만 문자로 남겨주셔도 비대면 비교 견적서 바로 보내드리니 편하실 때 답장 주세요!',
    ].join('\n'),
  },
];

export function renderSmsTemplateForLead(
  templateBody: string,
  lead: MarketingLeadItem
): string {
  const shortBenefit = lead.interestBenefit.includes('상조')
    ? '라이프케어 결합 가전 최대지원'
    : lead.interestBenefit.includes('이사') || lead.interestBenefit.includes('혼수')
    ? '이사·혼수 세트가전 오픈점 최대지원'
    : cleanMetaFieldText(lead.interestBenefit) || '맞춤 가전 최대 혜택';

  const platformName = resolveLeadPlatformDisplayName(lead.platform);

  return (templateBody || '')
    .replace(/\{고객명\}/g, lead.customerName || '고객')
    .replace(/\{플랫폼\}/g, platformName)
    .replace(/\{연락처\}/g, lead.phone || '')
    .replace(/\{희망혜택\}/g, shortBenefit)
    .replace(/\{안내방식\}/g, cleanMetaFieldText(lead.preferredContact) || '비대면 견적')
    .replace(/\{요약\}/g, lead.autoSummary || shortBenefit)
    .replace(/\{담당자\}/g, '국지현');
}

interface RawSeedRow {
  metaId: string;
  createdAt: string;
  name: string;
  phone: string;
  benefit: string;
  contact: string;
  memoStatus: MarketingLeadStatus;
  memo: string;
}

// 구글 드라이브 [인스타 광고 전용 DB] 상조결합 고객 접수 현황 실제 최신 접수분 (11건) 초기 시드
const INITIAL_SHEET_SEED_ROWS: RawSeedRow[] = [
  {
    metaId: 'l:29287341927528843',
    createdAt: '2026-11-04 08:09',
    name: '81jyn',
    phone: '010-3797-5442',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:2024132818294855',
    createdAt: '2026-11-04 01:36',
    name: '유재영',
    phone: '010-5568-4564',
    benefit: '상조 결합 가전 최대지원 혜택(구매 부담 경감)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:1593681889225701',
    createdAt: '2026-11-03 18:51',
    name: '권정호',
    phone: '010-7360-2686',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1269058239023204',
    createdAt: '2026-11-03 17:19',
    name: '송창호',
    phone: '010-3401-3217',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:2260340468246285',
    createdAt: '2026-11-03 13:47',
    name: '박새임',
    phone: '010-7172-1735',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1396944562253043',
    createdAt: '2026-11-03 11:45',
    name: '서예나',
    phone: '010-3459-6565',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1080425961483080',
    createdAt: '2026-11-03 09:39',
    name: '장은서',
    phone: '010-5712-8232',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1523886646215663',
    createdAt: '2026-11-03 09:19',
    name: '이윤경',
    phone: '010-7272-6687',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1159992053201721',
    createdAt: '2026-11-03 07:37',
    name: '엄마',
    phone: '010-4615-0342',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1961742325209110',
    createdAt: '2026-11-03 06:51',
    name: '이노훈',
    phone: '010-7474-0526',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1143932378073456',
    createdAt: '2026-11-01 16:49',
    name: '국지현',
    phone: '010-5174-5672',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '테스트 접수',
  },
];

function createInitialMarketingDbStore(): MarketingDbStore {
  const leads: MarketingLeadItem[] = INITIAL_SHEET_SEED_ROWS.map((row, idx) => {
    const phone = normalizeKoreanLeadPhone(row.phone);
    const { createdAt, yearMonth } = normalizeLeadDateTime(row.createdAt);
    const fp = makeLeadFingerprint(row.name, phone, createdAt, row.metaId);
    return {
      id: `MDB-SEED-${idx + 1}`,
      fingerprint: fp,
      createdAt,
      yearMonth,
      customerName: row.name,
      phone,
      interestBenefit: row.benefit,
      preferredContact: row.contact,
      platform: '인스타그램',
      campaignName: '11월 리뉴얼 광고',
      autoSummary: buildLeadAutoSummary({
        interestBenefit: row.benefit,
        preferredContact: row.contact,
        platform: '인스타그램',
        campaignName: '11월 리뉴얼 광고',
      }),
      status: row.memoStatus,
      handoverStaff: '',
      revenueAmount: 0,
      memo: row.memo,
    };
  });

  return {
    version: 1,
    leads,
    deletedFingerprints: [],
    config: {
      gasWebAppUrl: '',
      sheetCsvOrShareUrl: DEFAULT_INSTA_SHEET_URL,
      activeTemplateId: DEFAULT_SMS_TEMPLATES[0].id,
      smsTemplates: DEFAULT_SMS_TEMPLATES,
      autoSaveCrmOnConvert: true,
      businessCardDataUri: DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
      businessCardSendMethod: 'sms-clipboard',
      lastSyncedAt: '2026-11-04 08:15 (초기 시트 반영됨)',
    },
  };
}

// ==================== 4. 로컬 + IndexedDB 영구 저장소 ====================

export function loadMarketingDbStore(): MarketingDbStore {
  const fallback = createInitialMarketingDbStore();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(MARKETING_DB_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MARKETING_DB_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as MarketingDbStore;
    if (!parsed || !Array.isArray(parsed.leads)) return fallback;
    const migratedLeads = parsed.leads.map((l) => ({
      ...l,
      status: normalizeLeadStatusValue((l as any).status, l.handoverStaff),
    }));
    return {
      version: 1,
      leads: migratedLeads,
      deletedFingerprints: Array.isArray(parsed.deletedFingerprints)
        ? parsed.deletedFingerprints
        : [],
      config: {
        ...fallback.config,
        ...(parsed.config || {}),
        smsTemplates:
          Array.isArray(parsed.config?.smsTemplates) &&
          parsed.config.smsTemplates.length > 0
            ? parsed.config.smsTemplates.map((t) => {
                if (
                  t.id === 'tpl-default-1' &&
                  (t.body.includes('고객 맞춤 가전 컨설턴트') ||
                    t.body.includes('생각 중이신 가전 품목'))
                ) {
                  return DEFAULT_SMS_TEMPLATES[0];
                }
                if (
                  t.id === 'tpl-sangjo-2' &&
                  (t.body.includes('고객 맞춤 가전 컨설턴트') ||
                    t.body.includes('필요하신 가전 품목을 말씀해 주시면'))
                ) {
                  return DEFAULT_SMS_TEMPLATES[1];
                }
                return t;
              })
            : DEFAULT_SMS_TEMPLATES,
      },
    };
  } catch {
    return fallback;
  }
}

export async function hydrateMarketingDbStoreFromIdb(): Promise<MarketingDbStore> {
  const local = loadMarketingDbStore();
  const idbVal = await idbMirrorGet<MarketingDbStore>(MARKETING_DB_STORAGE_KEY);
  if (idbVal && Array.isArray(idbVal.leads) && idbVal.leads.length > local.leads.length) {
    const normalizedIdb: MarketingDbStore = {
      ...idbVal,
      leads: idbVal.leads.map((l) => ({
        ...l,
        status: normalizeLeadStatusValue((l as any).status, l.handoverStaff),
      })),
    };
    saveMarketingDbStore(normalizedIdb);
    return normalizedIdb;
  }
  return local;
}

export function saveMarketingDbStore(next: MarketingDbStore): void {
  try {
    localStorage.setItem(MARKETING_DB_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota warning — mirrored to IndexedDB below
  }
  idbMirrorSet(MARKETING_DB_STORAGE_KEY, next).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
  }
}

// ==================== 5. 휴무표 직원 연동 ('미화' 직군 자동 제외) ====================

export function loadHandoverStaffOptions(): HandoverStaffOption[] {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dStr = String(now.getDate());
  const schedules = loadAllSchedules();
  const month = getOrCreateMonthSchedule(schedules, ym);

  const seen = new Set<string>();
  const result: HandoverStaffOption[] = [];

  for (const emp of month.employees || []) {
    const name = String(emp.name || '').trim();
    const role = String(emp.role || '').trim();
    if (!name || seen.has(name)) continue;
    // '미화' 역할 및 이름에 '미화'가 포함된 항목 100% 제외, 본인(국지현)도 인계 대상에서 분리
    if (role.includes('미화') || name.includes('미화')) continue;
    if (name === '국지현') continue;

    seen.add(name);
    const todayCode = String(emp.days?.[dStr] || '').trim();
    result.push({
      name,
      role,
      isOffToday: isOffDayCode(todayCode),
      todayCode,
    });
  }

  return result;
}

// ==================== 6. 구글시트 CSV / JSON / 복붙 텍스트 지능형 파서 & 병합기 ====================

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  const isTsv =
    !text.includes(',') && text.includes('\t') && text.split('\n')[0].includes('\t');
  const delimiter = isTsv ? '\t' : ',';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cur.trim());
        cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur.trim());
        if (row.some((c) => c !== '')) {
          rows.push(row);
        }
        row = [];
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((c) => c !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function mapSheetStatusToLeadStatus(
  rawStatus?: string,
  rawMemo?: string
): MarketingLeadStatus {
  const s = `${rawStatus || ''} ${rawMemo || ''}`.trim();
  if (s.includes('계약완료') || s.includes('결제완료')) return '계약완료';
  if (s.includes('인계')) return '타직원인계';
  if (
    s.includes('상담진행') ||
    s.includes('상담전환') ||
    s.includes('방문예약') ||
    s.includes('견적발송') ||
    s.includes('응답') ||
    s.includes('답장')
  )
    return '상담진행중';
  if (s.includes('무응답') || s.includes('부재')) return '무응답';
  if (s.includes('문자전송') || s.includes('문자보냄') || s.includes('문자발송'))
    return '문자전송';
  return '신규';
}

export interface ParsedIncomingLead {
  metaId?: string;
  createdAt: string;
  yearMonth: string;
  customerName: string;
  phone: string;
  interestBenefit: string;
  preferredContact: string;
  platform: string;
  campaignName?: string;
  initialStatus: MarketingLeadStatus;
  initialMemo: string;
}

export function extractLeadsFromMatrix(matrix: string[][]): ParsedIncomingLead[] {
  if (!matrix || matrix.length < 2) return [];
  const header = matrix[0].map((h) => h.trim().toLowerCase());

  const findCol = (keywords: string[]) =>
    header.findIndex((h) => keywords.some((kw) => h.includes(kw)));

  const isMetaRawTab =
    header.includes('full_name') ||
    header.includes('phone_number') ||
    header.includes('created_time');

  const out: ParsedIncomingLead[] = [];

  if (isMetaRawTab) {
    const idIdx = header.indexOf('id');
    const timeIdx = findCol(['created_time', '접수일시']);
    const campIdx = findCol(['campaign_name', 'ad_name']);
    const platIdx = findCol(['platform', '플랫폼']);
    const nameIdx = findCol(['full_name', 'name', '고객명', '이름']);
    const phoneIdx = findCol(['phone_number', 'phone', '연락처', '전화']);
    const benefitIdx = findCol(['혜택', '품목', '관심', '궁금']);
    const contactIdx = findCol(['방식', '안내', '상담']);

    for (let r = 1; r < matrix.length; r++) {
      const cols = matrix[r];
      const rawName = (nameIdx >= 0 ? cols[nameIdx] : '') || '';
      const rawPhone = (phoneIdx >= 0 ? cols[phoneIdx] : '') || '';
      const phone = normalizeKoreanLeadPhone(rawPhone);
      if (!rawName.trim() && !phone) continue;

      const { createdAt, yearMonth } = normalizeLeadDateTime(
        timeIdx >= 0 ? cols[timeIdx] : ''
      );
      const benefit = cleanMetaFieldText(benefitIdx >= 0 ? cols[benefitIdx] : '');
      const contact = cleanMetaFieldText(contactIdx >= 0 ? cols[contactIdx] : '');
      const rawPlat = (platIdx >= 0 ? cols[platIdx] : 'ig') || 'ig';
      const platform =
        rawPlat.toLowerCase() === 'ig'
          ? '인스타그램'
          : rawPlat.toLowerCase() === 'fb'
          ? '페이스북'
          : rawPlat;

      out.push({
        metaId: idIdx >= 0 ? cols[idIdx] : undefined,
        createdAt,
        yearMonth,
        customerName: rawName.trim() || '인스타 고객',
        phone,
        interestBenefit: benefit,
        preferredContact: contact,
        platform,
        campaignName: campIdx >= 0 ? cols[campIdx] : undefined,
        initialStatus: '신규',
        initialMemo: '',
      });
    }
  } else {
    // ⭐한글_고객명부 또는 일반 한글 시트 구조
    // 주의: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)'처럼 따옴표 없는 쉼표가 섞인 CSV 행도 안전하게 복원!
    const dateIdx = findCol(['접수일시', '일시', '날짜', 'date']);
    const nameIdx = findCol(['고객명', '이름', '성함', 'name']);
    const phoneIdx = findCol(['연락처', '전화', '휴대폰', 'phone']);
    const benefitIdx = findCol(['혜택', '품목', '관심', '문의']);
    const contactIdx = findCol(['방식', '안내']);
    const platIdx = findCol(['플랫폼', '채널', '유입']);
    const statusIdx = findCol(['상담 상태', '진행 상태', '발송 상태', '상태']);
    const memoIdx = findCol(['진행 메모', '메모', '비고']);

    for (let r = 1; r < matrix.length; r++) {
      const cols = matrix[r];
      const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0] || '';
      const rawName = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
      const rawPhone = phoneIdx >= 0 ? cols[phoneIdx] : cols[2] || '';
      const phone = normalizeKoreanLeadPhone(rawPhone);
      if (!rawName.trim() && !phone) continue;

      // 만약 쉼표 때문에 열 개수가 헤더(8열)보다 늘어난 경우 가운데(혜택 열)를 자연스럽게 합침
      const extraCols = Math.max(0, cols.length - header.length);
      const rawBenefit =
        benefitIdx >= 0
          ? cols.slice(benefitIdx, benefitIdx + 1 + extraCols).join(', ')
          : cols[3] || '';
      const rawContact =
        contactIdx >= 0 ? cols[contactIdx + extraCols] || '' : '';
      const rawPlat =
        platIdx >= 0 ? cols[platIdx + extraCols] || '인스타그램' : '인스타그램';
      const rawStatus =
        statusIdx >= 0 ? cols[statusIdx + extraCols] || '' : '';
      const rawMemo =
        memoIdx >= 0 ? cols[memoIdx + extraCols] || '' : '';

      const { createdAt, yearMonth } = normalizeLeadDateTime(rawDate);
      out.push({
        createdAt,
        yearMonth,
        customerName: rawName.trim() || '인스타 고객',
        phone,
        interestBenefit: cleanMetaFieldText(rawBenefit),
        preferredContact: cleanMetaFieldText(rawContact),
        platform: resolveLeadPlatformDisplayName(rawPlat),
        initialStatus: mapSheetStatusToLeadStatus(rawStatus, rawMemo),
        initialMemo: rawMemo.trim(),
      });
    }
  }

  return out;
}

export function mergeIncomingLeadsIntoStore(
  store: MarketingDbStore,
  incoming: ParsedIncomingLead[]
): {
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
} {
  const deletedSet = new Set(store.deletedFingerprints || []);
  const existingByFp = new Map<string, MarketingLeadItem>();
  const existingByPhoneDate = new Map<string, MarketingLeadItem>();

  for (const lead of store.leads) {
    existingByFp.set(lead.fingerprint, lead);
    const pdKey = `${lead.phone.replace(/\D/g, '')}__${lead.createdAt.slice(0, 10)}`;
    if (lead.phone) existingByPhoneDate.set(pdKey, lead);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const mergedList = [...store.leads];

  for (const inc of incoming) {
    const fp = makeLeadFingerprint(
      inc.customerName,
      inc.phone,
      inc.createdAt,
      inc.metaId
    );
    const pdKey = `${inc.phone.replace(/\D/g, '')}__${inc.createdAt.slice(0, 10)}`;

    // 사용자가 앱에서 삭제한 고객이면 시트에 남아있어도 절대 다시 부활시키지 않음
    if (deletedSet.has(fp) || (inc.phone && deletedSet.has(`ph_${pdKey}`))) {
      continue;
    }

    const matched =
      existingByFp.get(fp) || (inc.phone ? existingByPhoneDate.get(pdKey) : undefined);

    const freshSummary = buildLeadAutoSummary({
      interestBenefit: inc.interestBenefit,
      preferredContact: inc.preferredContact,
      platform: inc.platform,
      campaignName: inc.campaignName,
    });

    if (!matched) {
      const createdItem: MarketingLeadItem = {
        id: `MDB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fingerprint: fp,
        createdAt: inc.createdAt,
        yearMonth: inc.yearMonth,
        customerName: inc.customerName,
        phone: inc.phone,
        interestBenefit: inc.interestBenefit,
        preferredContact: inc.preferredContact,
        platform: inc.platform || '인스타그램',
        campaignName: inc.campaignName,
        autoSummary: freshSummary,
        status: inc.initialStatus || '신규',
        handoverStaff: '',
        revenueAmount: 0,
        memo: inc.initialMemo || '',
      };
      mergedList.push(createdItem);
      existingByFp.set(fp, createdItem);
      if (inc.phone) existingByPhoneDate.set(pdKey, createdItem);
      addedCount++;
    } else if (!matched.deletedAt) {
      // 시트에서 추가 메모나 항목이 보강된 경우 기존 앱 상태(매출·인계·진행단계)는 보존하면서 요약만 최신화
      let changed = false;
      const idx = mergedList.findIndex((x) => x.id === matched.id);
      if (idx >= 0) {
        const nextItem = { ...mergedList[idx] };
        if (!nextItem.interestBenefit && inc.interestBenefit) {
          nextItem.interestBenefit = inc.interestBenefit;
          nextItem.autoSummary = freshSummary;
          changed = true;
        }
        if (
          nextItem.status === '신규' &&
          inc.initialStatus !== '신규'
        ) {
          nextItem.status = inc.initialStatus;
          changed = true;
        }
        if (!nextItem.memo && inc.initialMemo) {
          nextItem.memo = inc.initialMemo;
          changed = true;
        }
        if (changed) {
          mergedList[idx] = nextItem;
          updatedCount++;
        }
      }
    }
  }

  // 최신 접수일시 순 정렬
  mergedList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const now = new Date();
  const syncStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')} ${String(
    now.getHours()
  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    nextStore: {
      ...store,
      leads: mergedList,
      config: {
        ...store.config,
        lastSyncedAt: syncStamp,
      },
    },
    addedCount,
    updatedCount,
  };
}

export function importLeadsFromRawText(
  store: MarketingDbStore,
  rawText: string
): {
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
} {
  const matrix = parseCsvMatrix(rawText);
  const incoming = extractLeadsFromMatrix(matrix);
  return mergeIncomingLeadsIntoStore(store, incoming);
}

/**
 * 실시간 구글시트 동기화 실행 (1순위: 전용 Apps Script 웹앱 / 2순위: 게시된 CSV 또는 공유 시트 URL)
 */
export async function syncLeadsFromGoogleSheet(
  store: MarketingDbStore
): Promise<{
  ok: boolean;
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
  message: string;
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      nextStore: store,
      addedCount: 0,
      updatedCount: 0,
      message:
        '현재 오프라인(네트워크 끊김) 상태입니다. 변경하신 내역은 기기에 안전하게 자동 보관되며 인터넷 연결 후 동기화됩니다.',
    };
  }
  const gasUrl = (store.config.gasWebAppUrl || '').trim();

  // 1순위: 비공개 시트 보안 유지 + 전 탭 자동 스캔이 가능한 Apps Script Web App URL
  if (gasUrl && /^https?:\/\//i.test(gasUrl)) {
    try {
      const sep = gasUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${gasUrl}${sep}action=syncLeads&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        let allIncoming: ParsedIncomingLead[] = [];
        if (Array.isArray(data?.sheets)) {
          for (const sh of data.sheets) {
            if (Array.isArray(sh?.rows)) {
              const strMatrix = sh.rows.map((r: any[]) =>
                r.map((cell) => String(cell ?? ''))
              );
              allIncoming = allIncoming.concat(extractLeadsFromMatrix(strMatrix));
            }
          }
        } else if (Array.isArray(data?.rows)) {
          const strMatrix = data.rows.map((r: any[]) =>
            r.map((cell) => String(cell ?? ''))
          );
          allIncoming = extractLeadsFromMatrix(strMatrix);
        }

        // 클라우드 백업 상태가 있으면 로컬과 스마트 병합
        let workingStore = store;
        if (data?.backupState && Array.isArray(data.backupState.leads)) {
          const cloudMap = new Map<string, MarketingLeadItem>();
          for (const cl of data.backupState.leads as MarketingLeadItem[]) {
            if (cl?.fingerprint) cloudMap.set(cl.fingerprint, cl);
          }
          const combinedDeleted = Array.from(
            new Set([
              ...(store.deletedFingerprints || []),
              ...(data.backupState.deletedFingerprints || []),
            ])
          );
          const mergedLocal = store.leads.map((loc) => {
            const cl = cloudMap.get(loc.fingerprint);
            if (!cl) return loc;
            return {
              ...loc,
              status: loc.status !== '신규' ? normalizeLeadStatusValue(loc.status, loc.handoverStaff || cl.handoverStaff) : normalizeLeadStatusValue(cl.status, loc.handoverStaff || cl.handoverStaff),
              revenueAmount: loc.revenueAmount || cl.revenueAmount || 0,
              handoverStaff: loc.handoverStaff || cl.handoverStaff || '',
              handoverStaffRole: loc.handoverStaffRole || cl.handoverStaffRole,
              memo: loc.memo || cl.memo || '',
              linkedCrmCustomerId:
                loc.linkedCrmCustomerId || cl.linkedCrmCustomerId,
            };
          });
          workingStore = {
            ...store,
            leads: mergedLocal,
            deletedFingerprints: combinedDeleted,
          };
        }

        const merged = mergeIncomingLeadsIntoStore(workingStore, allIncoming);
        saveMarketingDbStore(merged.nextStore);
        return {
          ok: true,
          ...merged,
          message:
            merged.addedCount > 0
              ? `신규 인스타 DB ${merged.addedCount}건이 자동 요약되어 추가되었습니다!`
              : '시트와 최신 상태로 동기화되었습니다 (신규 추가 0건).',
        };
      }
    } catch {
      // 폴백으로 진행
    }
  }

  // 2순위: 웹에 게시된 CSV 주소 또는 시트 공유 링크에서 CSV 직접 읽기
  const rawUrl = (store.config.sheetCsvOrShareUrl || '').trim();
  if (rawUrl) {
    let fetchTarget = rawUrl;
    if (rawUrl.includes('/pub?') || rawUrl.includes('/pubhtml')) {
      fetchTarget = rawUrl
        .replace('/pubhtml', '/pub')
        .replace(/output=[a-z]+/i, 'output=csv');
      if (!fetchTarget.includes('output=csv')) {
        fetchTarget += (fetchTarget.includes('?') ? '&' : '?') + 'output=csv';
      }
    } else {
      const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = idMatch ? idMatch[1] : DEFAULT_INSTA_SHEET_ID;
      fetchTarget = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    }

    try {
      const res = await fetch(fetchTarget);
      if (res.ok) {
        const text = await res.text();
        if (
          text &&
          !text.trim().toLowerCase().startsWith('<!doctype html') &&
          !text.includes('accounts.google.com')
        ) {
          const merged = importLeadsFromRawText(store, text);
          saveMarketingDbStore(merged.nextStore);
          return {
            ok: true,
            ...merged,
            message:
              merged.addedCount > 0
                ? `시트에서 신규 고객 ${merged.addedCount}건을 불러와 자동 요약했습니다!`
                : '시트 확인 완료 (새로 추가된 고객이 없습니다).',
          };
        }
      }
    } catch {
      // 비공개 시트 CORS 차단 시 안내 반환
    }
  }

  return {
    ok: false,
    nextStore: store,
    addedCount: 0,
    updatedCount: 0,
    message:
      '현재 인스타 DB 시트가 [비공개(나만 보기)]로 보호되어 있어 직접 외부 접근이 차단되어 있습니다. 우측 [시트 자동연동 설정]에서 전용 Apps Script 웹앱 주소를 1회 연결하시거나 시트 내용을 붙여넣어 주세요!',
  };
}

/**
 * Apps Script 양방향 백업 푸시 (폰 <-> 매장 PC 간 상태·발생매출·인계내역 동기화)
 */
export async function pushMarketingStateToGasBackup(
  store: MarketingDbStore
): Promise<void> {
  const gasUrl = (store.config.gasWebAppUrl || '').trim();
  if (!gasUrl || !/^https?:\/\//i.test(gasUrl)) return;
  try {
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveBackupState',
        backupState: {
          leads: store.leads,
          deletedFingerprints: store.deletedFingerprints,
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  } catch {
    // 정적/오프라인 시 무시 (로컬+IndexedDB에는 이미 안전하게 저장됨)
  }
}

// ==================== 7. 통합 고객관리(CRM) 원터치 카드 자동저장 & 연결 브릿지 ====================

function mapLeadStatusToCrmStatus(st: MarketingLeadStatus): CustomerStatus {
  if (st === '계약완료') return '계약완료';
  if (st === '상담진행중') return '상담진행중';
  if (st === '무응답') return '미구매/고민중';
  return '신규/미발송';
}

function mergeLeadMemoWithoutDuplicates(
  existingMemo: string | undefined,
  lead: MarketingLeadItem
): string {
  const baseTag = `[인스타 광고 DB · ${lead.createdAt}] ${lead.autoSummary}`;
  const extraLines = [
    lead.memo ? `진행메모: ${lead.memo}` : '',
    lead.handoverStaff ? `상담 인계 확인: ${lead.handoverStaff}` : '',
  ].filter(Boolean);

  const prev = String(existingMemo || '').trim();
  if (!prev) {
    return [baseTag, ...extraLines].join('\n');
  }

  const linesToPrepend: string[] = [];
  if (!prev.includes(`[인스타 광고 DB · ${lead.createdAt}]`)) {
    linesToPrepend.push(baseTag);
  }
  for (const line of extraLines) {
    if (!prev.includes(line)) {
      linesToPrepend.push(line);
    }
  }
  return linesToPrepend.length > 0
    ? `${linesToPrepend.join('\n')}\n${prev}`
    : prev;
}

export async function saveMarketingLeadToCrm(
  lead: MarketingLeadItem,
  options?: { syncRevenue?: boolean }
): Promise<{
  savedCustomer: CustomerItem;
  isExistingCustomer: boolean;
}> {
  const current = getCachedCustomers();
  const nowStr = getNowDateTimeStr();
  const todayStr = getTodayStr();
  const targetPhoneDigits = String(lead.phone || '').replace(/\D/g, '');
  const targetNameLower = String(lead.customerName || '').trim().toLowerCase();

  let existingIndex = -1;
  if (lead.linkedCrmCustomerId) {
    existingIndex = current.findIndex(
      (c) => c.id === lead.linkedCrmCustomerId && !c.deletedAt
    );
  }
  if (existingIndex < 0 && targetPhoneDigits) {
    existingIndex = current.findIndex(
      (c) => !c.deletedAt && String(c.phone || '').replace(/\D/g, '') === targetPhoneDigits
    );
  }
  if (existingIndex < 0 && targetNameLower && !targetPhoneDigits) {
    existingIndex = current.findIndex(
      (c) =>
        !c.deletedAt &&
        String(c.name || '').trim().toLowerCase() === targetNameLower &&
        !String(c.phone || '').replace(/\D/g, '')
    );
  }

  const mappedStatus = mapLeadStatusToCrmStatus(lead.status);
  const revAmt = Math.max(0, Number(lead.revenueAmount) || 0);

  if (existingIndex >= 0) {
    // [핵심 보호] 이미 고객카드가 있는 고객은 기존 견적서(quotes)·최종혜택가(netAmount)·실결제가·구매품목·프리드를 100% 보존합니다!
    // 더미 0원 견적(QuoteRecord)을 절대 추가하지 않습니다!
    const existing = current[existingIndex];
    const isAlreadyConfirmed =
      existing.status === '계약완료' ||
      existing.status === '발송완료' ||
      existing.status === '배송완료';

    const resolvedStatus: CustomerStatus = isAlreadyConfirmed
      ? existing.status
      : lead.status === '계약완료'
      ? '계약완료'
      : existing.status === '신규/미발송' || existing.status === '미구매/고민중'
      ? mappedStatus
      : existing.status;

    const shouldApplyRev = Boolean(options?.syncRevenue && revAmt > 0);
    const hasExistingNet = (Number(existing.netAmount) || 0) > 0;
    const hasExistingPaid = (Number(existing.paidAmount) || 0) > 0;

    const updatedCustomer: CustomerItem = {
      ...existing,
      name: existing.name || lead.customerName.trim(),
      phone: existing.phone || lead.phone.trim(),
      status: resolvedStatus,
      contractDate:
        existing.contractDate ||
        (lead.status === '계약완료' ? lead.createdAt.slice(0, 10) : undefined),
      memo: mergeLeadMemoWithoutDuplicates(existing.memo, lead),
      // 기존 최종혜택가(netAmount)가 있으면 절대 덮어쓰지 않고 보존!
      paidAmount: hasExistingPaid
        ? existing.paidAmount
        : shouldApplyRev
        ? revAmt
        : existing.paidAmount,
      netAmount: hasExistingNet
        ? existing.netAmount
        : shouldApplyRev
        ? revAmt
        : existing.netAmount,
      performanceAmount:
        shouldApplyRev && !((existing.quotes?.length || 0) > 0 && (Number(existing.performanceAmount) || 0) > 0)
          ? revAmt
          : existing.performanceAmount,
      deletedAt: undefined,
    };

    const nextList = current.map((c, idx) =>
      idx === existingIndex ? updatedCustomer : c
    );
    const deduped = setCachedCustomers(nextList);
    const saved =
      deduped.find((c) => c.id === updatedCustomer.id) || updatedCustomer;
    await syncCustomerToGas('update', saved);
    return {
      savedCustomer: saved,
      isExistingCustomer: true,
    };
  }

  // 신규 고객카드 생성 시에도 0원 가짜 견적(quotes) 없이 깔끔한 고객카드로만 등록!
  const newCustomer: CustomerItem = {
    id: `CUST-${Date.now()}`,
    regDate: nowStr,
    contractDate:
      lead.status === '계약완료' ? lead.createdAt.slice(0, 10) : todayStr,
    name: lead.customerName.trim() || '인스타 상담고객',
    phone: lead.phone.trim(),
    items: cleanMetaFieldText(lead.interestBenefit) || '인스타 광고 상담 고객',
    paidAmount: revAmt,
    netAmount: revAmt,
    expectedBenefit: '',
    saleType: 'general',
    performanceAmount: revAmt,
    generalProductTotal: revAmt,
    subscriptionPrincipal: 0,
    deliveryDate: '',
    followUpDate: '',
    status: mappedStatus,
    memo: mergeLeadMemoWithoutDuplicates('', lead),
    orderNo: '',
    giftItems: '',
    giftSent: false,
    logisticsConfirmed: false,
    quotes: [],
  };

  const deduped = setCachedCustomers([newCustomer, ...current]);
  const saved = deduped.find((c) => c.id === newCustomer.id) || newCustomer;
  await syncCustomerToGas('create', saved);

  return {
    savedCustomer: saved,
    isExistingCustomer: false,
  };
}

// ==================== 8. 시트 비공개 100% 유지용 전용 Apps Script 코드 생성기 ====================

export function getReadyMadeAppsScriptCode(): string {
  return `// =========================================================================
// [롯데하이마트 경기광주점 - 국지현 전용 인스타 광고 DB 실시간 양방향 연동 스크립트]
// 사용법:
// 1. [인스타 광고 전용 DB] 구글시트 상단 메뉴 [확장 프로그램] -> [Apps Script] 클릭
// 2. 기존 코드를 지우고 아래 코드를 그대로 붙여넣은 뒤 💾 저장
// 3. 우측 상단 [배포] -> [새 배포] -> 유형: [웹 앱] 선택
//    - 다음 사용자 인증 정보로 실행: [나]
//    - 액세스 권한이 있는 사용자: [모든 사용자] (시트 원본은 비공개 그대로 안전하게 유지됩니다!)
// 4. 배포 후 나오는 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 앱에 붙여넣기!
// =========================================================================

const BACKUP_SHEET_NAME = '_앱DB관리백업';

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const outSheets = [];

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const name = sh.getName();
    if (name === BACKUP_SHEET_NAME) continue;
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 2) continue;
    const values = sh.getDisplayValues();
    outSheets.push({ name: name, rows: values });
  }

  let backupState = null;
  const backupSh = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (backupSh && backupSh.getLastRow() >= 1) {
    try {
      const rawJson = backupSh.getRange(1, 1).getValue();
      if (rawJson) backupState = JSON.parse(rawJson);
    } catch (err) {}
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheets: outSheets, backupState: backupState }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'saveBackupState' && body.backupState) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let backupSh = ss.getSheetByName(BACKUP_SHEET_NAME);
      if (!backupSh) {
        backupSh = ss.insertSheet(BACKUP_SHEET_NAME);
        backupSh.hideSheet();
      }
      backupSh.getRange(1, 1).setValue(JSON.stringify(body.backupState));
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}


// ==================== 9. 명함 이미지 자동 동봉 (PNG 클립보드 복사 & MMS/카톡 파일 공유) ====================

export function getEffectiveBusinessCardDataUri(config?: MarketingDbConfig): string {
  const custom = (config?.businessCardDataUri || '').trim();
  return custom.startsWith('data:image/')
    ? custom
    : DEFAULT_OWNER_BUSINESS_CARD_DATA_URI;
}

export function dataUriToBlob(dataUri: string): Blob {
  const parts = dataUri.split(',');
  const mimeMatch = (parts[0] || '').match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1] || '');
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
}

/**
 * Web Clipboard API (ClipboardItem)는 브라우저 표준상 'image/png'만 허용하므로
 * JPEG 명함 원본을 고해상도 무손실 PNG Blob Promise로 변환하여 갤럭시·아이폰·PC 클립보드에 복사합니다.
 */
export function dataUriToPngBlob(dataUri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Browser environment required'));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 993;
        canvas.height = img.naturalHeight || img.height || 552;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG conversion failed'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUri;
  });
}

export async function copyBusinessCardImageToClipboard(
  dataUri: string
): Promise<boolean> {
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (!navigator.clipboard?.write || !ClipboardItemCtor) {
      return false;
    }
    const item = new ClipboardItemCtor({
      'image/png': dataUriToPngBlob(dataUri),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export async function shareBusinessCardFileWithText(params: {
  dataUri: string;
  bodyText: string;
  customerPhone?: string;
}): Promise<'shared' | 'cancelled' | 'unsupported'> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return 'unsupported';
    }
    // 공유 시트에서 메시지 앱 선택 후 받는 사람 칸에 바로 붙여넣을 수 있도록 고객 전화번호를 먼저 복사
    const cleanPhone = (params.customerPhone || '').replace(/\D/g, '');
    if (cleanPhone) {
      await safeCopyText(cleanPhone);
    }

    const blob = dataUriToBlob(params.dataUri);
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const file = new File(
      [blob],
      `롯데하이마트_경기광주점_국지현_명함.${ext}`,
      { type: blob.type || 'image/jpeg' }
    );

    if (
      typeof navigator.canShare === 'function' &&
      !navigator.canShare({ files: [file] })
    ) {
      return 'unsupported';
    }

    await navigator.share({
      files: [file],
      text: params.bodyText,
    });
    return 'shared';
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}
