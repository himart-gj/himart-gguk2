import * as XLSXModule from 'xlsx';
import { ADMIN_PIN_CODE } from './careTableParser';

const XLSX: typeof XLSXModule =
  ((XLSXModule as any).read ? XLSXModule : (XLSXModule as any).default) || XLSXModule;
import { DEFAULT_OWNER_BUSINESS_CARD_DATA_URI } from './ownerBusinessCardAsset';
import { idbMirrorGet, idbMirrorSet } from './offlineDbQueue';
import { CustomerItem } from '../crm/types/crm';
import {
  DEFAULT_SMS_TEMPLATES,
  INITIAL_SHEET_SEED_ROWS,
  RawSeedRow,
  ParsedIncomingLead,
  buildLeadAutoSummary,
  cleanMetaFieldText,
  consolidateIncomingLeadsAcrossTabs,
  copyBusinessCardImageToClipboard,
  dataUriToBlob,
  dataUriToPngBlob,
  extractLeadsFromMatrix,
  getCanonicalPhoneDigits,
  getEffectiveBusinessCardDataUri,
  getOwnerDbPin,
  getReadyMadeAppsScriptCode,
  isBogusMetaSystemName,
  isOwnerMarketingDbUnlocked,
  loadHandoverStaffOptions,
  lockOwnerMarketingDb,
  makeLeadFingerprint,
  normalizeKoreanLeadPhone,
  normalizeLeadDateTime,
  parseCsvMatrix,
  pushMarketingStateToGasBackup,
  renderSmsTemplateForLead,
  resolveLeadPlatformDisplayName,
  saveMarketingLeadToCrm,
  setOwnerDbPin,
  shareBusinessCardFileWithText,
  verifyAndUnlockOwnerDb,
  warmUpBusinessCardCacheWithUri,
} from './marketingDbStaticData';

export type { ParsedIncomingLead };
export {
  DEFAULT_SMS_TEMPLATES,
  buildLeadAutoSummary,
  cleanMetaFieldText,
  copyBusinessCardImageToClipboard,
  dataUriToBlob,
  dataUriToPngBlob,
  extractLeadsFromMatrix,
  getCanonicalPhoneDigits,
  getEffectiveBusinessCardDataUri,
  getOwnerDbPin,
  getReadyMadeAppsScriptCode,
  isBogusMetaSystemName,
  isOwnerMarketingDbUnlocked,
  loadHandoverStaffOptions,
  lockOwnerMarketingDb,
  makeLeadFingerprint,
  normalizeKoreanLeadPhone,
  normalizeLeadDateTime,
  pushMarketingStateToGasBackup,
  renderSmsTemplateForLead,
  resolveLeadPlatformDisplayName,
  saveMarketingLeadToCrm,
  setOwnerDbPin,
  shareBusinessCardFileWithText,
  verifyAndUnlockOwnerDb,
};

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
export const OWNER_CUSTOM_CARD_STORAGE_KEY = 'himart_gj_owner_card_uri_v1';

let inMemoryMarketingDbStore: MarketingDbStore | null = null;
// 네트워크 동기화 도중 사용자가 수행한 삭제·상태변경 액션을 감지하여 100% 보존하기 위한 로컬 변경 카운터
let localMutationEpoch = 0;
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
  /** 사용자가 앱에서 상태·인계·삭제를 마지막으로 변경한 시각 (시트/백업 동기화 시 상태 역전 원천 방지) */
  statusUpdatedAtMs?: number;
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
  /** 카드에서 [명함+문자 발송] 원터치 시 기본 동작 ('share-sheet' | 'sms-clipboard') */
  businessCardSendMethod?: 'sms-clipboard' | 'share-sheet';
  /** v2 기본값('share-sheet' 실제 파일 첨부) 자동 마이그레이션 완료 플래그 */
  businessCardSendMethodMigratedV2?: boolean;
  /** 마지막 시트 동기화 시각 */
  lastSyncedAt?: string;
  /** 마지막 실시간 자동연동 성공 상태 ('connected' | 'locked' | 'idle') */
  lastSyncStatus?: 'connected' | 'locked' | 'idle';
}

export interface MarketingDbStore {
  version: 1;
  leads: MarketingLeadItem[];
  deletedFingerprints: string[];
  config: MarketingDbConfig;
  updatedAtMs?: number;
  seedInitializedVersion?: number;
}

export interface HandoverStaffOption {
  name: string;
  role: string;
  isOffToday: boolean;
  todayCode: string;
}


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
    updatedAtMs: 0,
    seedInitializedVersion: 2,
    config: {
      gasWebAppUrl: '',
      sheetCsvOrShareUrl: DEFAULT_INSTA_SHEET_URL,
      activeTemplateId: DEFAULT_SMS_TEMPLATES[0].id,
      smsTemplates: DEFAULT_SMS_TEMPLATES,
      autoSaveCrmOnConvert: true,
      businessCardDataUri: DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
      businessCardSendMethod: 'share-sheet',
      businessCardSendMethodMigratedV2: true,
      lastSyncedAt: '2026-11-04 18:25 (시트 최신 13건 반영됨)',
      lastSyncStatus: 'idle',
    },
  };
}


export function buildAllLeadTombstoneKeys(item: {
  fingerprint?: string;
  phone?: string;
  customerName?: string;
  createdAt?: string;
  metaId?: string;
}): string[] {
  const keys = new Set<string>();
  const fp = String(item.fingerprint || '').trim();
  if (fp) {
    keys.add(fp);
  }
  const rawMeta = String(item.metaId || '').trim();
  if (rawMeta) {
    keys.add(`meta_${rawMeta}`);
  }
  const digits = getCanonicalPhoneDigits(item.phone);
  const date10 = String(item.createdAt || '').slice(0, 10).trim();
  const cleanName = String(item.customerName || '').trim().toLowerCase();

  if (digits.length >= 7) {
    // 전화번호 자체를 영구 차단 키로 등록하여 탭(한글탭/원본탭)·날짜·포맷이 달라도 100% 재부활 차단!
    keys.add(`ph_any_${digits}`);
    keys.add(`ph_${digits}`);
    if (date10) {
      keys.add(`ph_${digits}_${date10}`);
      keys.add(`ph_${digits}__${date10}`);
    }
  }
  // 전화번호 유무와 무관하게 유효 고객명+접수일자 키를 함께 등록하여 탭 간 전화번호 표기 차이가 있어도 100% 차단!
  if (cleanName && !isBogusMetaSystemName(cleanName)) {
    if (date10) {
      keys.add(`nm_${cleanName}_${date10}`);
    }
    if (digits.length < 7) {
      keys.add(`nm_any_${cleanName}`);
    }
  }

  // 초기 시드 고객과 매칭되는 경우 시트의 metaId와 전화번호·이름 키를 교차 묶음으로 동시 등록
  for (const sr of INITIAL_SHEET_SEED_ROWS) {
    const srDigits = getCanonicalPhoneDigits(sr.phone);
    const srMetaKey = `meta_${sr.metaId}`;
    const srNameLower = sr.name.trim().toLowerCase();
    const srDate10 = sr.createdAt.slice(0, 10);
    if (
      (digits.length >= 7 && srDigits === digits) ||
      fp === srMetaKey ||
      rawMeta === sr.metaId ||
      (cleanName && cleanName === srNameLower && date10 === srDate10)
    ) {
      keys.add(srMetaKey);
      if (srDigits.length >= 7) {
        keys.add(`ph_any_${srDigits}`);
        keys.add(`ph_${srDigits}`);
        keys.add(`ph_${srDigits}_${srDate10}`);
      }
      keys.add(`nm_${srNameLower}_${srDate10}`);
    }
  }

  return Array.from(keys);
}

function buildExpandedTombstoneSet(
  deletedFingerprints: string[],
  trashedLeads: MarketingLeadItem[]
): Set<string> {
  const set = new Set<string>();
  for (const rawFp of deletedFingerprints || []) {
    if (!rawFp) continue;
    set.add(rawFp);
    // 'ph_01051745672_2026-11-01', 'ph_any_01051745672', 'ph_01051745672' 등에서 전화번호 추출
    const phMatch = rawFp.match(/^ph_(?:any_)?(\d{7,15})/);
    if (phMatch?.[1]) {
      const canon = getCanonicalPhoneDigits(phMatch[1]);
      if (canon.length >= 7) {
        set.add(`ph_any_${canon}`);
        set.add(`ph_${canon}`);
      }
    }
  }
  for (const tl of trashedLeads || []) {
    for (const k of buildAllLeadTombstoneKeys(tl)) {
      set.add(k);
    }
  }
  // 시드 행 중 하나라도 차단 세트에 포함되어 있으면 해당 시드의 모든 교차 키(metaId + 전화번호 + 이름)를 세트로 확장
  for (const sr of INITIAL_SHEET_SEED_ROWS) {
    const srDigits = getCanonicalPhoneDigits(sr.phone);
    const srMetaKey = `meta_${sr.metaId}`;
    const srNameKey = `nm_${sr.name.trim().toLowerCase()}_${sr.createdAt.slice(0, 10)}`;
    if (
      set.has(srMetaKey) ||
      (srDigits.length >= 7 && (set.has(`ph_any_${srDigits}`) || set.has(`ph_${srDigits}`))) ||
      set.has(srNameKey)
    ) {
      set.add(srMetaKey);
      if (srDigits.length >= 7) {
        set.add(`ph_any_${srDigits}`);
        set.add(`ph_${srDigits}`);
        set.add(`ph_${srDigits}_${sr.createdAt.slice(0, 10)}`);
      }
      set.add(srNameKey);
    }
  }
  return set;
}

const LEAD_STATUS_PRIORITY: Record<MarketingLeadStatus, number> = {
  계약완료: 6,
  타직원인계: 5,
  상담진행중: 4,
  무응답: 3,
  문자전송: 2,
  신규: 1,
};

function mergeTwoActiveLeads(a: MarketingLeadItem, b: MarketingLeadItem): MarketingLeadItem {
  const rankA = LEAD_STATUS_PRIORITY[a.status] || 1;
  const rankB = LEAD_STATUS_PRIORITY[b.status] || 1;
  const tsA = Number(a.statusUpdatedAtMs) || 0;
  const tsB = Number(b.statusUpdatedAtMs) || 0;

  // 사용자가 앱에서 직접 상태를 변경한 타임스탬프(statusUpdatedAtMs)가 있으면 최신 변경분을 최우선 보존!
  // (예: 문자전송 -> 신규, 상담진행중 -> 무응답 등 낮은 단계로 변경한 경우에도 절대 이전 상태로 되돌아가지 않음)
  const statusWinner =
    tsA !== tsB ? (tsB > tsA ? b : a) : rankB > rankA ? b : a;
  const primary = rankB > rankA ? b : a;
  const secondary = primary === a ? b : a;

  const realName = !isBogusMetaSystemName(primary.customerName)
    ? primary.customerName
    : !isBogusMetaSystemName(secondary.customerName)
    ? secondary.customerName
    : primary.customerName;

  const handoverStaff =
    statusWinner.handoverStaff !== undefined
      ? statusWinner.handoverStaff
      : primary.handoverStaff || secondary.handoverStaff || '';
  const mergedStatus = normalizeLeadStatusValue(
    statusWinner.status,
    handoverStaff
  );

  return {
    ...secondary,
    ...primary,
    customerName: realName,
    phone: normalizeKoreanLeadPhone(primary.phone || secondary.phone),
    fingerprint: primary.fingerprint.startsWith('meta_')
      ? primary.fingerprint
      : secondary.fingerprint.startsWith('meta_')
      ? secondary.fingerprint
      : primary.fingerprint,
    status: mergedStatus,
    statusUpdatedAtMs: Math.max(tsA, tsB) || undefined,
    handoverStaff,
    handoverStaffRole:
      statusWinner.handoverStaffRole ||
      primary.handoverStaffRole ||
      secondary.handoverStaffRole,
    handoverAt:
      statusWinner.handoverAt || primary.handoverAt || secondary.handoverAt,
    revenueAmount: Math.max(
      Number(primary.revenueAmount) || 0,
      Number(secondary.revenueAmount) || 0
    ),
    memo: primary.memo || secondary.memo || '',
    smsSentAt: primary.smsSentAt || secondary.smsSentAt,
    linkedCrmCustomerId: primary.linkedCrmCustomerId || secondary.linkedCrmCustomerId,
    deletedAt: undefined,
  };
}

/**
 * [자가 치유 & 좀비 완벽 정화 엔진]
 * 1) 메타 원본 탭 'ad_name' 오인식으로 생성됐던 '새 잠재 고객 광고' 유령 카드 즉시 제거·복원
 * 2) 휴지통에 있는 고객(deletedAt)과 동일한 전화번호/지문의 활성 중복 카드를 100% 제거 (이중 노출 원천 차단)
 * 3) 영구삭제된 차단 목록(deletedFingerprints)에 해당하는 부활 카드 100% 제거
 * 4) 동일 전화번호 중복 카드를 진행단계·매출·인계정보 손실 없이 단일 카드로 통합
 */
export function sanitizeMarketingDbStore(rawStore: MarketingDbStore): MarketingDbStore {
  const seedLookupByPhone = new Map<string, RawSeedRow>();
  for (const sr of INITIAL_SHEET_SEED_ROWS) {
    const d = getCanonicalPhoneDigits(sr.phone);
    if (d) seedLookupByPhone.set(d, sr);
  }

  // 실제 고객명 사전 구축 (유령 카드 이름 복원용)
  const realNameByPhone = new Map<string, string>();
  for (const [d, sr] of seedLookupByPhone.entries()) {
    if (!isBogusMetaSystemName(sr.name)) {
      realNameByPhone.set(d, sr.name);
    }
  }
  for (const l of rawStore.leads || []) {
    if (!l) continue;
    const d = getCanonicalPhoneDigits(l.phone);
    if (d && !isBogusMetaSystemName(l.customerName)) {
      realNameByPhone.set(d, l.customerName.trim());
    }
  }

  const normalizedAll: MarketingLeadItem[] = [];
  for (const rawLead of rawStore.leads || []) {
    if (!rawLead) continue;
    const phone = normalizeKoreanLeadPhone(rawLead.phone);
    const digits = getCanonicalPhoneDigits(phone);
    let customerName = String(rawLead.customerName || '').trim();
    if (isBogusMetaSystemName(customerName)) {
      const recovered = digits ? realNameByPhone.get(digits) : undefined;
      if (recovered) {
        customerName = recovered;
      } else if (!digits) {
        // 전화번호도 없고 이름도 광고 제목인 유령 데이터는 즉시 폐기
        continue;
      }
    }
    normalizedAll.push({
      ...rawLead,
      customerName: customerName || '인스타 상담고객',
      phone,
      status: normalizeLeadStatusValue((rawLead as any).status, rawLead.handoverStaff),
    });
  }

  // 1) 휴지통 리드 중복 정리 (전화번호/지문 기준 1건만 유지)
  const trashedMap = new Map<string, MarketingLeadItem>();
  for (const l of normalizedAll) {
    if (!l.deletedAt) continue;
    const digits = getCanonicalPhoneDigits(l.phone);
    const dedupKey = digits.length >= 7 ? `ph_${digits}` : `fp_${l.fingerprint}`;
    const prev = trashedMap.get(dedupKey);
    if (!prev || (l.deletedAt || 0) > (prev.deletedAt || 0)) {
      trashedMap.set(dedupKey, l);
    }
  }
  const cleanTrashed = Array.from(trashedMap.values());

  // 2) 모든 차단 지문 세트 확장 (휴지통 보유분 + 영구삭제 지문)
  const expandedTombstones = buildExpandedTombstoneSet(
    rawStore.deletedFingerprints || [],
    cleanTrashed
  );

  // 3) 활성 리드 정리: 차단 지문/휴지통과 겹치면 즉시 제거 + 동일 전화번호 단일 병합
  const activeMap = new Map<string, MarketingLeadItem>();
  for (const l of normalizedAll) {
    if (l.deletedAt) continue;
    const candidateKeys = buildAllLeadTombstoneKeys(l);
    if (candidateKeys.some((k) => expandedTombstones.has(k))) {
      // 휴지통에 있거나 영구삭제된 사람 -> 다른 탭에 절대 뜨지 않도록 즉시 제거!
      continue;
    }
    const digits = getCanonicalPhoneDigits(l.phone);
    const dedupKey =
      digits.length >= 7
        ? `ph_${digits}`
        : `nm_${l.customerName.trim().toLowerCase()}_${(l.createdAt || '').slice(0, 10)}`;
    const existing = activeMap.get(dedupKey);
    if (!existing) {
      activeMap.set(dedupKey, l);
    } else {
      activeMap.set(dedupKey, mergeTwoActiveLeads(existing, l));
    }
  }

  const combinedLeads = [...Array.from(activeMap.values()), ...cleanTrashed].sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  return {
    ...rawStore,
    version: 1,
    leads: combinedLeads,
    deletedFingerprints: Array.from(expandedTombstones),
    seedInitializedVersion: 2,
  };
}

export function loadMarketingDbStore(): MarketingDbStore {
  if (inMemoryMarketingDbStore) {
    return inMemoryMarketingDbStore;
  }
  const fallback = createInitialMarketingDbStore();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const savedCustomCard = (localStorage.getItem(OWNER_CUSTOM_CARD_STORAGE_KEY) || '').trim();
    const raw = localStorage.getItem(MARKETING_DB_STORAGE_KEY);
    if (!raw) {
      const cleanInit = sanitizeMarketingDbStore({
        ...fallback,
        config: {
          ...fallback.config,
          businessCardDataUri: savedCustomCard || fallback.config.businessCardDataUri,
        },
      });
      inMemoryMarketingDbStore = cleanInit;
      try {
        localStorage.setItem(MARKETING_DB_STORAGE_KEY, JSON.stringify(cleanInit));
      } catch {
        // ignore quota
      }
      return cleanInit;
    }
    const parsed = JSON.parse(raw) as MarketingDbStore;
    if (!parsed || !Array.isArray(parsed.leads)) return fallback;

    const baseStore: MarketingDbStore = {
      version: 1,
      leads: parsed.leads,
      deletedFingerprints: Array.isArray(parsed.deletedFingerprints)
        ? parsed.deletedFingerprints
        : [],
      updatedAtMs: Number(parsed.updatedAtMs) || 0,
      seedInitializedVersion: Number(parsed.seedInitializedVersion) || 0,
      config: {
        ...fallback.config,
        ...(parsed.config || {}),
        businessCardSendMethod: parsed.config?.businessCardSendMethodMigratedV2
          ? parsed.config?.businessCardSendMethod || 'share-sheet'
          : 'share-sheet',
        businessCardSendMethodMigratedV2: true,
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

    // 최초 1회만 신규 시드(신정민·제이) 보강 후 seedInitializedVersion=2로 잠가서 영구삭제한 시드가 절대 재주입되지 않도록 보장!
    if ((baseStore.seedInitializedVersion || 0) < 2) {
      const preSanitized = sanitizeMarketingDbStore(baseStore);
      const tombstones = buildExpandedTombstoneSet(
        preSanitized.deletedFingerprints,
        preSanitized.leads.filter((l) => Boolean(l.deletedAt))
      );
      const existingPhones = new Set(
        preSanitized.leads.map((l) => getCanonicalPhoneDigits(l.phone)).filter(Boolean)
      );
      const nextLeads = [...preSanitized.leads];
      for (const seedLead of fallback.leads) {
        const sKeys = buildAllLeadTombstoneKeys(seedLead);
        if (sKeys.some((k) => tombstones.has(k))) continue;
        const sDigits = getCanonicalPhoneDigits(seedLead.phone);
        if (sDigits && existingPhones.has(sDigits)) continue;
        nextLeads.push(seedLead);
        if (sDigits) existingPhones.add(sDigits);
      }
      const upgraded = sanitizeMarketingDbStore({
        ...preSanitized,
        leads: nextLeads,
        seedInitializedVersion: 2,
        config: {
          ...preSanitized.config,
          businessCardDataUri:
            savedCustomCard ||
            preSanitized.config.businessCardDataUri ||
            DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
        },
      });
      inMemoryMarketingDbStore = upgraded;
      try {
        const slim = {
          ...upgraded,
          config: { ...upgraded.config, businessCardDataUri: undefined },
        };
        localStorage.setItem(MARKETING_DB_STORAGE_KEY, JSON.stringify(slim));
      } catch {
        // ignore quota
      }
      return upgraded;
    }

    const sanitized = sanitizeMarketingDbStore({
      ...baseStore,
      config: {
        ...baseStore.config,
        businessCardDataUri:
          savedCustomCard ||
          baseStore.config.businessCardDataUri ||
          DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
      },
    });
    inMemoryMarketingDbStore = sanitized;
    if (
      sanitized.leads.length !== parsed.leads.length ||
      parsed.leads.some((l) => isBogusMetaSystemName(l?.customerName))
    ) {
      try {
        const slim = {
          ...sanitized,
          config: { ...sanitized.config, businessCardDataUri: undefined },
        };
        localStorage.setItem(MARKETING_DB_STORAGE_KEY, JSON.stringify(slim));
      } catch {
        // ignore quota
      }
    }
    return sanitized;
  } catch {
    inMemoryMarketingDbStore = fallback;
    return fallback;
  }
}

export async function hydrateMarketingDbStoreFromIdb(): Promise<MarketingDbStore> {
  const epochBeforeIdb = localMutationEpoch;
  const idbVal = await idbMirrorGet<MarketingDbStore>(MARKETING_DB_STORAGE_KEY);
  const hasLocalRaw =
    typeof localStorage !== 'undefined' &&
    Boolean(localStorage.getItem(MARKETING_DB_STORAGE_KEY));
  const local = loadMarketingDbStore();
  // 만약 IDB 조회 중 사용자가 이미 삭제·상태변경을 수행했다면 최신 로컬 상태를 최우선 유지!
  if (localMutationEpoch !== epochBeforeIdb) {
    return local;
  }
  // 주의: 절대 leads.length 크기로 비교하지 않음! (삭제 시 개수가 줄어드는 것이 정상이므로 updatedAtMs 타임스탬프로만 비교)
  if (
    idbVal &&
    Array.isArray(idbVal.leads) &&
    (!hasLocalRaw || (Number(idbVal.updatedAtMs) || 0) > (Number(local.updatedAtMs) || 0))
  ) {
    // 로컬의 삭제 차단 지문(deletedFingerprints)도 절대 유실되지 않도록 합집합 보존
    const mergedDeletedFp = Array.from(
      new Set([
        ...(local.deletedFingerprints || []),
        ...(idbVal.deletedFingerprints || []),
      ])
    );
    const sanitizedIdb = sanitizeMarketingDbStore({
      ...local,
      ...idbVal,
      deletedFingerprints: mergedDeletedFp,
      seedInitializedVersion: 2,
    });
    saveMarketingDbStore(sanitizedIdb, { preserveTimestamp: true });
    return sanitizedIdb;
  }
  return local;
}

export function addOrReviveManualLeadInStore(
  store: MarketingDbStore,
  newItem: MarketingLeadItem
): MarketingDbStore {
  const nowMs = Date.now();
  const stampedItem: MarketingLeadItem = {
    ...newItem,
    statusUpdatedAtMs: newItem.statusUpdatedAtMs || nowMs,
  };
  const keysToClear = new Set(buildAllLeadTombstoneKeys(stampedItem));
  const newDigits = getCanonicalPhoneDigits(stampedItem.phone);
  const cleanedDeletedFp = (store.deletedFingerprints || []).filter((fp) => {
    if (keysToClear.has(fp)) return false;
    if (newDigits.length >= 7 && (fp.includes(newDigits) || fp === `ph_any_${newDigits}`)) {
      return false;
    }
    return true;
  });
  const cleanedExistingLeads = (store.leads || []).filter((l) => {
    if (!l) return false;
    if (l.deletedAt) {
      const lDigits = getCanonicalPhoneDigits(l.phone);
      if (newDigits.length >= 7 && lDigits === newDigits) return false;
      if (l.fingerprint === stampedItem.fingerprint) return false;
    }
    return true;
  });
  return sanitizeMarketingDbStore({
    ...store,
    leads: [stampedItem, ...cleanedExistingLeads],
    deletedFingerprints: cleanedDeletedFp,
  });
}

export function saveMarketingDbStore(
  next: MarketingDbStore,
  options?: { preserveTimestamp?: boolean }
): MarketingDbStore {
  const nowMs = Date.now();
  let nextLeads = next.leads || [];

  // 사용자가 앱에서 상태·인계·삭제·복원을 수행할 때(!preserveTimestamp) 자동으로 변경된 리드에 statusUpdatedAtMs 기록!
  if (!options?.preserveTimestamp) {
    localMutationEpoch += 1;
    const prevById = new Map<string, MarketingLeadItem>();
    for (const pl of inMemoryMarketingDbStore?.leads || []) {
      if (pl?.id) prevById.set(pl.id, pl);
    }
    nextLeads = nextLeads.map((l) => {
      if (!l) return l;
      const prev = prevById.get(l.id);
      if (
        !prev ||
        prev.status !== l.status ||
        (prev.handoverStaff || '') !== (l.handoverStaff || '') ||
        Boolean(prev.deletedAt) !== Boolean(l.deletedAt) ||
        (prev.smsSentAt || '') !== (l.smsSentAt || '')
      ) {
        return {
          ...l,
          statusUpdatedAtMs: nowMs,
        };
      }
      return l;
    });
  }

  const sanitized = sanitizeMarketingDbStore({
    ...next,
    leads: nextLeads,
    updatedAtMs: options?.preserveTimestamp
      ? next.updatedAtMs || nowMs
      : nowMs,
    seedInitializedVersion: 2,
  });
  // 1순위: 인메모리 캐시 즉시 갱신 (localStorage 5MB 용량 초과 시에도 데이터 증발 0%)
  inMemoryMarketingDbStore = sanitized;

  if (typeof localStorage !== 'undefined') {
    const customCard = (sanitized.config?.businessCardDataUri || '').trim();
    try {
      if (customCard && customCard !== DEFAULT_OWNER_BUSINESS_CARD_DATA_URI) {
        localStorage.setItem(OWNER_CUSTOM_CARD_STORAGE_KEY, customCard);
      } else {
        localStorage.removeItem(OWNER_CUSTOM_CARD_STORAGE_KEY);
      }
    } catch {
      // ignore card quota — kept in memory + IndexedDB
    }
    try {
      // 명함 원본 Base64를 분리하여 리드 저장 JSON 용량을 수십 KB로 경량화!
      const slimForLocalStorage: MarketingDbStore = {
        ...sanitized,
        config: {
          ...sanitized.config,
          businessCardDataUri: undefined,
        },
      };
      localStorage.setItem(
        MARKETING_DB_STORAGE_KEY,
        JSON.stringify(slimForLocalStorage)
      );
    } catch {
      // ignore quota warning — mirrored to IndexedDB + inMemoryMarketingDbStore
    }
  }

  idbMirrorSet(MARKETING_DB_STORAGE_KEY, sanitized).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
  }
  return sanitized;
}


export function mergeIncomingLeadsIntoStore(
  store: MarketingDbStore,
  incoming: ParsedIncomingLead[],
  options?: { allowReviveManual?: boolean }
): {
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
} {
  let workingInputStore = store;
  const consolidatedIncoming = consolidateIncomingLeadsAcrossTabs(incoming);

  if (options?.allowReviveManual && consolidatedIncoming.length > 0) {
    const incomingDigits = new Set(
      consolidatedIncoming
        .map((inc) => getCanonicalPhoneDigits(inc.phone))
        .filter((d) => d.length >= 7)
    );
    workingInputStore = {
      ...store,
      leads: (store.leads || []).filter((l) => {
        if (!l?.deletedAt) return true;
        const ld = getCanonicalPhoneDigits(l.phone);
        return !(ld.length >= 7 && incomingDigits.has(ld));
      }),
      deletedFingerprints: (store.deletedFingerprints || []).filter((fp) => {
        for (const d of incomingDigits) {
          if (fp.includes(d)) return false;
        }
        return true;
      }),
    };
  }
  const cleanBase = sanitizeMarketingDbStore(workingInputStore);
  const trashedList = cleanBase.leads.filter((l) => Boolean(l.deletedAt));
  const tombstoneSet = buildExpandedTombstoneSet(
    cleanBase.deletedFingerprints || [],
    trashedList
  );

  const existingByFp = new Map<string, MarketingLeadItem>();
  const existingByPhone = new Map<string, MarketingLeadItem>();
  const existingByNameDate = new Map<string, MarketingLeadItem>();

  for (const lead of cleanBase.leads) {
    existingByFp.set(lead.fingerprint, lead);
    const digits = getCanonicalPhoneDigits(lead.phone);
    if (digits.length >= 7) {
      existingByPhone.set(digits, lead);
    }
    const nmKey = `${lead.customerName.trim().toLowerCase()}__${lead.createdAt.slice(0, 10)}`;
    if (lead.customerName.trim() && !isBogusMetaSystemName(lead.customerName)) {
      existingByNameDate.set(nmKey, lead);
    }
  }

  let addedCount = 0;
  let updatedCount = 0;
  const mergedList = [...cleanBase.leads];

  for (const inc of consolidatedIncoming) {
    const fp = makeLeadFingerprint(
      inc.customerName,
      inc.phone,
      inc.createdAt,
      inc.metaId
    );
    const incKeys = buildAllLeadTombstoneKeys({
      fingerprint: fp,
      phone: inc.phone,
      customerName: inc.customerName,
      createdAt: inc.createdAt,
      metaId: inc.metaId,
    });

    // 휴지통에 있거나 영구삭제된 고객이면 어떤 탭(한글탭/원본탭)에서 읽히든 100% 재부활 차단!
    if (incKeys.some((k) => tombstoneSet.has(k))) {
      for (const k of incKeys) tombstoneSet.add(k);
      continue;
    }

    const digits = getCanonicalPhoneDigits(inc.phone);
    const nmKey = `${inc.customerName.trim().toLowerCase()}__${inc.createdAt.slice(0, 10)}`;

    const matched =
      existingByFp.get(fp) ||
      (digits.length >= 7 ? existingByPhone.get(digits) : undefined) ||
      (!isBogusMetaSystemName(inc.customerName)
        ? existingByNameDate.get(nmKey)
        : undefined);

    // 매칭된 기존 카드가 휴지통(deletedAt) 상태라면 절대 부활시키거나 다른 상태로 변경하지 않고 차단 지문만 보강!
    if (matched?.deletedAt) {
      for (const k of incKeys) tombstoneSet.add(k);
      continue;
    }

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
        phone: normalizeKoreanLeadPhone(inc.phone),
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
      if (digits.length >= 7) existingByPhone.set(digits, createdItem);
      if (!isBogusMetaSystemName(createdItem.customerName)) {
        existingByNameDate.set(nmKey, createdItem);
      }
      addedCount++;
    } else {
      // 이미 앱에 존재하는 고객은 구글시트 동기화 시 상태(status)·인계직원·삭제여부를 절대 변경하지 않음!
      // (오직 누락된 고객명·희망혜택·캠페인명·고유 meta 지문만 무손실 보강)
      let changed = false;
      const idx = mergedList.findIndex((x) => x.id === matched.id);
      if (idx >= 0) {
        const nextItem = { ...mergedList[idx] };
        if (
          isBogusMetaSystemName(nextItem.customerName) &&
          !isBogusMetaSystemName(inc.customerName)
        ) {
          nextItem.customerName = inc.customerName;
          changed = true;
        }
        if (!nextItem.interestBenefit && inc.interestBenefit) {
          nextItem.interestBenefit = inc.interestBenefit;
          nextItem.autoSummary = freshSummary;
          changed = true;
        }
        if (!nextItem.campaignName && inc.campaignName) {
          nextItem.campaignName = inc.campaignName;
          changed = true;
        }
        if (!nextItem.fingerprint.startsWith('meta_') && fp.startsWith('meta_')) {
          nextItem.fingerprint = fp;
          changed = true;
        }
        if (changed) {
          mergedList[idx] = nextItem;
          existingByFp.set(nextItem.fingerprint, nextItem);
          if (digits.length >= 7) existingByPhone.set(digits, nextItem);
          updatedCount++;
        }
      }
    }
  }

  const now = new Date();
  const syncStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')} ${String(
    now.getHours()
  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const finalized = sanitizeMarketingDbStore({
    ...cleanBase,
    leads: mergedList,
    deletedFingerprints: Array.from(tombstoneSet),
    config: {
      ...cleanBase.config,
      lastSyncedAt: syncStamp,
    },
  });

  return {
    nextStore: finalized,
    addedCount,
    updatedCount,
  };
}

export function importLeadsFromRawText(
  store: MarketingDbStore,
  rawText: string,
  options?: { allowReviveManual?: boolean }
): {
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
} {
  const matrix = parseCsvMatrix(rawText);
  const incoming = extractLeadsFromMatrix(matrix);
  // 시트 전체 복붙이나 CSV 동기화 시 삭제했던 고객이 부활하지 않도록 기본값 false 유지
  return mergeIncomingLeadsIntoStore(store, incoming, {
    allowReviveManual: Boolean(options?.allowReviveManual),
  });
}

export async function importLeadsFromFile(
  store: MarketingDbStore,
  file: File,
  options?: { allowReviveManual?: boolean }
): Promise<{
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
}> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    let allIncoming: ParsedIncomingLead[] = [];
    for (const sheetName of wb.SheetNames) {
      if (sheetName === '_앱DB관리백업') continue;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });
      const strMatrix = rows.map((r) =>
        (Array.isArray(r) ? r : []).map((c) => String(c ?? ''))
      );
      allIncoming = allIncoming.concat(extractLeadsFromMatrix(strMatrix));
    }
    return mergeIncomingLeadsIntoStore(store, allIncoming, {
      allowReviveManual: Boolean(options?.allowReviveManual),
    });
  }
  const text = await file.text();
  return importLeadsFromRawText(store, text, options);
}

// 동시 네트워크 요청 충돌(Race Condition) 원천 차단용 단일 실행 락
let inFlightGoogleSheetSync: Promise<{
  ok: boolean;
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
  message: string;
}> | null = null;

/**
 * 실시간 구글시트 동기화 실행 (동시 실행 락 + 네트워크 응답 직후 최신 로컬 상태 재조회로 사용자 삭제/수정 덮어쓰기 0% 보장!)
 */
export async function syncLeadsFromGoogleSheet(
  storeSnapshot?: MarketingDbStore
): Promise<{
  ok: boolean;
  nextStore: MarketingDbStore;
  addedCount: number;
  updatedCount: number;
  message: string;
}> {
  if (inFlightGoogleSheetSync) {
    return inFlightGoogleSheetSync;
  }

  const runSync = async () => {
    const initialStore = loadMarketingDbStore() || storeSnapshot;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        ok: false,
        nextStore: loadMarketingDbStore(),
        addedCount: 0,
        updatedCount: 0,
        message:
          '현재 오프라인(네트워크 끊김) 상태입니다. 변경하신 내역은 기기에 안전하게 자동 보관되며 인터넷 연결 후 동기화됩니다.',
      };
    }

    const gasUrl = (initialStore.config.gasWebAppUrl || '').trim();

    // 1순위: Apps Script Web App URL
    if (gasUrl && /^https?:\/\//i.test(gasUrl)) {
      try {
        const sep = gasUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${gasUrl}${sep}action=syncLeads&_t=${Date.now()}`, {
          cache: 'no-store',
        });
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

          // 네트워크 대기 중 사용자가 휴지통 이동·상태 변경한 최신 상태를 즉시 다시 읽어와 절대 덮어쓰지 않음!
          let workingStore = loadMarketingDbStore();
          if (data?.backupState && Array.isArray(data.backupState.leads)) {
            const cloudLeads = (data.backupState.leads as MarketingLeadItem[]).filter(Boolean);
            const cloudByFp = new Map<string, MarketingLeadItem>();
            const cloudByDigits = new Map<string, MarketingLeadItem>();
            for (const cl of cloudLeads) {
              if (cl.fingerprint) cloudByFp.set(cl.fingerprint, cl);
              const cd = getCanonicalPhoneDigits(cl.phone);
              if (cd.length >= 7) cloudByDigits.set(cd, cl);
            }
            const combinedDeleted = Array.from(
              new Set([
                ...(workingStore.deletedFingerprints || []),
                ...(data.backupState.deletedFingerprints || []),
              ])
            );
            const cloudTombstones = buildExpandedTombstoneSet(combinedDeleted, [
              ...workingStore.leads.filter((l) => Boolean(l.deletedAt)),
              ...cloudLeads.filter((l) => Boolean(l.deletedAt)),
            ]);

            const mergedLocal = workingStore.leads.map((loc) => {
              const locDigits = getCanonicalPhoneDigits(loc.phone);
              const cl =
                cloudByFp.get(loc.fingerprint) ||
                (locDigits.length >= 7 ? cloudByDigits.get(locDigits) : undefined);
              if (!cl) return loc;
              if (loc.deletedAt) return loc;
              const locKeys = buildAllLeadTombstoneKeys(loc);
              if (cl.deletedAt || locKeys.some((k) => cloudTombstones.has(k))) {
                return { ...loc, deletedAt: loc.deletedAt || cl.deletedAt || Date.now() };
              }
              const locStatusTs = Number(loc.statusUpdatedAtMs) || 0;
              const clStatusTs = Number(cl.statusUpdatedAtMs) || 0;
              // 클라우드에 더 최신 statusUpdatedAtMs 타임스탬프가 명시된 경우에만 클라우드 상태를 따르고, 그 외에는 무조건 로컬 현재 상태 유지!
              const useCloudStatus = clStatusTs > locStatusTs && clStatusTs > 0;
              const chosenHandover = useCloudStatus
                ? cl.handoverStaff || loc.handoverStaff || ''
                : loc.handoverStaff || '';
              const chosenStatus = useCloudStatus
                ? normalizeLeadStatusValue(cl.status, chosenHandover)
                : normalizeLeadStatusValue(loc.status, chosenHandover);

              return {
                ...loc,
                status: chosenStatus,
                statusUpdatedAtMs: Math.max(locStatusTs, clStatusTs) || loc.statusUpdatedAtMs,
                revenueAmount: loc.revenueAmount || cl.revenueAmount || 0,
                handoverStaff: chosenHandover,
                handoverStaffRole: loc.handoverStaffRole || cl.handoverStaffRole,
                memo: loc.memo || cl.memo || '',
                linkedCrmCustomerId:
                  loc.linkedCrmCustomerId || cl.linkedCrmCustomerId,
              };
            });
            workingStore = sanitizeMarketingDbStore({
              ...workingStore,
              leads: mergedLocal,
              deletedFingerprints: Array.from(cloudTombstones),
            });
          }

          const merged = mergeIncomingLeadsIntoStore(workingStore, allIncoming, {
            allowReviveManual: false,
          });
          merged.nextStore.config.lastSyncStatus = 'connected';
          const saved = saveMarketingDbStore(merged.nextStore, {
            preserveTimestamp: merged.addedCount === 0 && merged.updatedCount === 0,
          });
          return {
            ok: true,
            ...merged,
            nextStore: saved,
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

    // 2순위: 인스타 DB 구글시트 직접 읽기
    const rawUrl = (initialStore.config.sheetCsvOrShareUrl || DEFAULT_INSTA_SHEET_URL).trim();
    if (rawUrl) {
      if (rawUrl.includes('/pub?') || rawUrl.includes('/pubhtml') || rawUrl.endsWith('/pub')) {
        let pubTarget = rawUrl
          .replace('/pubhtml', '/pub')
          .replace(/output=[a-z]+/i, 'output=csv');
        if (!pubTarget.includes('output=csv')) {
          pubTarget += (pubTarget.includes('?') ? '&' : '?') + 'output=csv';
        }
        try {
          const res = await fetch(`${pubTarget}${pubTarget.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const text = await res.text();
            if (
              text &&
              !text.trim().toLowerCase().startsWith('<!doctype') &&
              !text.trim().toLowerCase().startsWith('<html') &&
              !text.includes('accounts.google.com')
            ) {
              const latestStore = loadMarketingDbStore();
              const incoming = extractLeadsFromMatrix(parseCsvMatrix(text));
              const merged = mergeIncomingLeadsIntoStore(latestStore, incoming, {
                allowReviveManual: false,
              });
              merged.nextStore.config.lastSyncStatus = 'connected';
              const saved = saveMarketingDbStore(merged.nextStore, {
                preserveTimestamp: merged.addedCount === 0 && merged.updatedCount === 0,
              });
              return {
                ok: true,
                ...merged,
                nextStore: saved,
                message:
                  merged.addedCount > 0
                    ? `인스타 DB 시트에서 신규 고객 ${merged.addedCount}건을 자동 반영했습니다!`
                    : '인스타 DB 시트와 실시간 최신 동기화 완료! (추가 고객 0건)',
              };
            }
          }
        } catch {
          // 다음 후보 엔드포인트 시도
        }
      }

      const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
      const sheetId = idMatch ? idMatch[1] : DEFAULT_INSTA_SHEET_ID;
      const gidMatch = rawUrl.match(/[?#&]gid=(\d+)/);
      const gidSuffix = gidMatch?.[1] ? `&gid=${gidMatch[1]}` : '';

      // ① 전 탭(⭐한글_고객명부 + 메타 원본 탭) XLSX 무손실 스캔
      try {
        const xlsxRes = await fetch(
          `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const ct = (xlsxRes.headers.get('content-type') || '').toLowerCase();
        if (xlsxRes.ok && !ct.includes('text/html')) {
          const buf = await xlsxRes.arrayBuffer();
          if (buf.byteLength > 200) {
            const wb = XLSX.read(buf, { type: 'array' });
            let allIncoming: ParsedIncomingLead[] = [];
            for (const sheetName of wb.SheetNames) {
              if (sheetName === '_앱DB관리백업') continue;
              const sh = wb.Sheets[sheetName];
              if (!sh) continue;
              const rows: any[][] = XLSX.utils.sheet_to_json(sh, {
                header: 1,
                raw: false,
                defval: '',
              });
              const strMatrix = rows.map((r) => r.map((c) => String(c ?? '').trim()));
              allIncoming = allIncoming.concat(extractLeadsFromMatrix(strMatrix));
            }
            // 반드시 네트워크 완료 직후 최신 로컬 저장소를 읽어 병합!
            const latestStore = loadMarketingDbStore();
            const merged = mergeIncomingLeadsIntoStore(latestStore, allIncoming, {
              allowReviveManual: false,
            });
            merged.nextStore.config.lastSyncStatus = 'connected';
            const saved = saveMarketingDbStore(merged.nextStore, {
              preserveTimestamp: merged.addedCount === 0 && merged.updatedCount === 0,
            });
            return {
              ok: true,
              ...merged,
              nextStore: saved,
              message:
                merged.addedCount > 0
                  ? `인스타 DB 시트에서 신규 고객 ${merged.addedCount}건이 자동 추가되었습니다!`
                  : '인스타 DB 시트와 실시간 최신 동기화 완료! (추가 고객 0건)',
            };
          }
        }
      } catch {
        // CSV 폴백으로 진행
      }

      // ② CSV 엔드포인트 2종 폴백 (절대 allowReviveManual: true로 호출하지 않아 삭제 고객 부활 원천 차단!)
      for (const csvUrl of [
        `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidSuffix}&_t=${Date.now()}`,
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidSuffix}&_t=${Date.now()}`,
      ]) {
        try {
          const res = await fetch(csvUrl, { cache: 'no-store' });
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (res.ok && !ct.includes('text/html')) {
            const text = await res.text();
            if (
              text &&
              !text.trim().toLowerCase().startsWith('<!doctype') &&
              !text.trim().toLowerCase().startsWith('<html') &&
              !text.includes('accounts.google.com')
            ) {
              const latestStore = loadMarketingDbStore();
              const incoming = extractLeadsFromMatrix(parseCsvMatrix(text));
              const merged = mergeIncomingLeadsIntoStore(latestStore, incoming, {
                allowReviveManual: false,
              });
              merged.nextStore.config.lastSyncStatus = 'connected';
              const saved = saveMarketingDbStore(merged.nextStore, {
                preserveTimestamp: merged.addedCount === 0 && merged.updatedCount === 0,
              });
              return {
                ok: true,
                ...merged,
                nextStore: saved,
                message:
                  merged.addedCount > 0
                    ? `인스타 DB 시트에서 신규 고객 ${merged.addedCount}건이 자동 추가되었습니다!`
                    : '인스타 DB 시트와 실시간 최신 동기화 완료! (추가 고객 0건)',
              };
            }
          }
        } catch {
          // 비공개 시트 차단 시 아래 안내 반환
        }
      }
    }

    const latestForLock = loadMarketingDbStore();
    const lockedStore: MarketingDbStore = {
      ...latestForLock,
      config: {
        ...latestForLock.config,
        lastSyncStatus: 'locked',
      },
    };
    const savedLocked = saveMarketingDbStore(lockedStore, { preserveTimestamp: true });

    return {
      ok: false,
      nextStore: savedLocked,
      addedCount: 0,
      updatedCount: 0,
      message:
        '구글시트가 아직 [제한됨(나만 보기)] 상태입니다. 시트에서 [공유 → 링크가 있는 모든 사용자(뷰어)]를 1회만 켜주시거나 전용 Apps Script 주소를 연결하면 즉시 실시간 자동연동됩니다!',
    };
  };

  inFlightGoogleSheetSync = runSync().finally(() => {
    inFlightGoogleSheetSync = null;
  });
  return inFlightGoogleSheetSync;
}

/**
 * [양방향 휴지통 동기화]
 */
export function syncMarketingDbTrashFromCrmCustomer(
  customer: Pick<CustomerItem, 'id' | 'name' | 'phone'>,
  trashed: boolean
): void {
  const digits = getCanonicalPhoneDigits(customer.phone);
  const store = loadMarketingDbStore();
  let changed = false;
  const nowMs = Date.now();
  const extraTombstones: string[] = [];
  const removeTombstones = new Set<string>();

  const nextLeads = store.leads.map((l) => {
    const lDigits = getCanonicalPhoneDigits(l.phone);
    const isMatch =
      (customer.id && l.linkedCrmCustomerId === customer.id) ||
      (digits.length >= 7 && lDigits === digits);
    if (!isMatch) return l;

    if (trashed) {
      // 타직원에게 인계한 DB는 내 개인 CRM에서만 지운 것이므로 DB관리의 타직원인계 탭에는 안전하게 유지
      if (l.handoverStaff && l.handoverStaff.trim()) {
        return { ...l, linkedCrmCustomerId: undefined };
      }
      if (!l.deletedAt) {
        changed = true;
        extraTombstones.push(...buildAllLeadTombstoneKeys(l));
        return { ...l, deletedAt: nowMs, statusUpdatedAtMs: nowMs };
      }
      return l;
    } else {
      if (l.deletedAt) {
        changed = true;
        for (const k of buildAllLeadTombstoneKeys(l)) {
          removeTombstones.add(k);
        }
        return { ...l, deletedAt: undefined, statusUpdatedAtMs: nowMs };
      }
      return l;
    }
  });

  if (!changed) return;

  const nextDeletedFp = trashed
    ? Array.from(new Set([...(store.deletedFingerprints || []), ...extraTombstones]))
    : (store.deletedFingerprints || []).filter((fp) => {
        if (removeTombstones.has(fp)) return false;
        if (digits.length >= 7 && fp.includes(digits)) return false;
        return true;
      });

  saveMarketingDbStore({
    ...store,
    leads: nextLeads,
    deletedFingerprints: nextDeletedFp,
  });
}


export function warmUpBusinessCardCache(customDataUri?: string): void {
  if (typeof window === 'undefined') return;
  const uri =
    customDataUri && customDataUri.trim().startsWith('data:image/')
      ? customDataUri.trim()
      : getEffectiveBusinessCardDataUri(loadMarketingDbStore().config);
  warmUpBusinessCardCacheWithUri(uri);
}
