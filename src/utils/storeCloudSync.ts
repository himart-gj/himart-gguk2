// ============================================================================
// 롯데하이마트 경기광주점 — 비공개 구글 시트(Apps Script) 전용 클라우드 동기화 브릿지
// 목적:
// 1) 월간 휴무표·모델별 수당단가표·안심케어 조견표·무이자할부를 GitHub에 커밋하지 않고
//    비공개 구글 시트(Apps Script 웹앱)로만 저장·불러오기 수행 (깃허브 민감정보 노출 0% 보장)
// 2) 기존 ScheduleModal · CareTableView · CardInstallmentModal · settlementSheetParser의
//    api.github.com 및 정적 *-data.json 요청을 투명하게 가로채어 구글 시트로 중계
// 3) 인증된 기기 자동 클라우드 연결 + 초대직원 휴무표 ON/OFF + 개인별 다중기기 CRM 동기화 지원
// ============================================================================

import {
  bootstrapInviteFromUrl,
  canAccessStoreSchedule,
  isFriendRestrictedMode,
  readFriendSession,
  resolveBuiltInDefaultRelayUrl,
  revokeLocalFriendAccess,
  syncFriendSchedulePermission,
} from './friendAccessGuard';

export type StoreCloudKind = 'schedule' | 'incentive' | 'care' | 'installment';

export interface StoreCloudRawConfig {
  repo: string;
  branch: string;
  token: string;
}

export interface FriendRemoteProfile {
  storeName: string;
  consultantName: string;
  phone: string;
  updatedAt: string;
}

export interface SharedGeminiAdminState {
  hasSharedKey: boolean;
  maskedSharedKey: string;
  globalEnabled: boolean;
  friendAiMap: Record<string, boolean>;
}

export interface CloudKindDiagnostic {
  exists: boolean;
  updatedAt: string;
  chunks: number;
  bytes: number;
  validJson: boolean;
  itemCount: number;
}

export interface CloudDiagnosticsReport {
  ok: boolean;
  needsSpreadsheetId?: boolean;
  bindingMode?: 'container' | 'standalone_id';
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  inviteCount?: number;
  boundInviteCount?: number;
  sharedAi?: SharedGeminiAdminState;
  datasets?: Record<StoreCloudKind, CloudKindDiagnostic>;
  error?: string;
}

export const FRIEND_REMOTE_PROFILES_FIELD = '__friendProfiles' as const;
export const FRIEND_SCHEDULE_MAP_FIELD = '__friendScheduleMap' as const;
export const ENCRYPTED_OWNER_CRM_VAULT_FIELD = '__encryptedOwnerCrmVault' as const;
export const PARTNER_MANUALS_META_FIELD = '__partnerManuals' as const;

const PRESERVED_CARE_META_FIELDS = [
  FRIEND_REMOTE_PROFILES_FIELD,
  PARTNER_MANUALS_META_FIELD,
  FRIEND_SCHEDULE_MAP_FIELD,
  ENCRYPTED_OWNER_CRM_VAULT_FIELD,
] as const;

export const STORE_CLOUD_CONFIG_KEY = 'himart_care_gh_sync_config_v1';
export const TARGET_SPREADSHEET_ID_STORAGE_KEY = 'himart_gj_target_sheet_id_v1';
export const INSTA_SPREADSHEET_ID_STORAGE_KEY = 'himart_gj_insta_sheet_id_v1';
export const OWNER_CUSTOM_PIN_STORAGE_KEY = 'himart_gj_owner_db_pin_v1';
export const STORE_CLOUD_UPDATED_EVENT = 'himart_gj_store_cloud_updated';
export const UNCONFIGURED_PIN_SENTINEL = '__HIMART_CLOUD_PIN_REQUIRED__';

export function extractGoogleSheetId(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const urlMatch = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s) && !s.includes('http') && !s.includes('/')) {
    return s;
  }
  return '';
}

export function loadSavedSpreadsheetId(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return extractGoogleSheetId(
      localStorage.getItem(TARGET_SPREADSHEET_ID_STORAGE_KEY)
    );
  } catch {
    return '';
  }
}

export function saveSpreadsheetId(raw?: string | null): string {
  const clean = extractGoogleSheetId(raw);
  if (typeof localStorage !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(TARGET_SPREADSHEET_ID_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(TARGET_SPREADSHEET_ID_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}

export function loadSavedInstaSpreadsheetId(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return extractGoogleSheetId(
      localStorage.getItem(INSTA_SPREADSHEET_ID_STORAGE_KEY)
    );
  } catch {
    return '';
  }
}

export function saveInstaSpreadsheetId(raw?: string | null): string {
  const clean = extractGoogleSheetId(raw);
  if (typeof localStorage !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(INSTA_SPREADSHEET_ID_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(INSTA_SPREADSHEET_ID_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}

const DATA_FILE_RE =
  /(?:^|[/.])(schedule|model-incentive|care-table|card-installment)-data\.json(?:$|[?#])/i;

function mapFileSlugToKind(slug: string): StoreCloudKind {
  const lower = slug.toLowerCase();
  if (lower === 'schedule') return 'schedule';
  if (lower === 'model-incentive') return 'incentive';
  if (lower === 'care-table') return 'care';
  return 'installment';
}

function hasValidCloudCareItems(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      Array.isArray((data as { items?: unknown[] }).items) &&
      (data as { items: unknown[] }).items.length > 0
  );
}

function getEmptyFallbackForKind(kind: StoreCloudKind): unknown {
  if (kind === 'care') {
    return { versionTitle: '', updatedAt: '', fileName: '', items: [] };
  }
  if (kind === 'installment') {
    return null;
  }
  return {};
}

export function normalizeGasWebAppUrl(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)/i.test(s) ||
    /^https:\/\/script\.googleusercontent\.com\//i.test(s) ||
    /^http:\/\/localhost(?::\d+)?\//i.test(s)
  ) {
    return s;
  }
  return '';
}

export function decodeBase64Utf8(b64: string): string {
  const cleaned = String(b64 || '').replace(/\s+/g, '');
  if (!cleaned) return '{}';
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64UrlUtf8(token: string): string {
  let b64 = String(token || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return decodeBase64Utf8(b64);
}

export function readRawSyncConfig(): StoreCloudRawConfig {
  const fallbackRelay = resolveBuiltInDefaultRelayUrl();
  if (typeof localStorage === 'undefined') {
    return { repo: fallbackRelay, branch: 'main', token: '' };
  }
  try {
    const raw = localStorage.getItem(STORE_CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const savedRepo = String(parsed?.repo || '').trim();
      return {
        repo: savedRepo || fallbackRelay,
        branch: String(parsed?.branch || 'main').trim() || 'main',
        token: String(parsed?.token || '').trim(),
      };
    }
  } catch {
    // ignore storage parse errors
  }
  return { repo: fallbackRelay, branch: 'main', token: '' };
}

export function resolveRuntimeAdminPin(): string {
  if (typeof localStorage === 'undefined') return UNCONFIGURED_PIN_SENTINEL;
  try {
    const syncToken = readRawSyncConfig().token.trim();
    if (syncToken.length >= 4) return syncToken;
    const ownerCustom = String(localStorage.getItem(OWNER_CUSTOM_PIN_STORAGE_KEY) || '').trim();
    if (ownerCustom.length >= 4) return ownerCustom;
    const staffCustom = String(localStorage.getItem('himart_staff_custom_pin_v1') || '').trim();
    if (staffCustom.length >= 4) return staffCustom;
  } catch {
    // ignore
  }
  return UNCONFIGURED_PIN_SENTINEL;
}

export function bootstrapCloudConfigFromUrl(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const rawCloud = (params.get('cloud') || '').trim();
    if (!rawCloud) return false;

    let candidateUrl = normalizeGasWebAppUrl(rawCloud);
    if (!candidateUrl) {
      try {
        const decoded = decodeBase64UrlUtf8(rawCloud).trim();
        if (decoded.startsWith('{')) {
          const obj = JSON.parse(decoded);
          candidateUrl = normalizeGasWebAppUrl(obj?.url || obj?.repo || '');
        } else {
          candidateUrl = normalizeGasWebAppUrl(decoded);
        }
      } catch {
        candidateUrl = '';
      }
    }

    if (!candidateUrl) return false;

    const prev = readRawSyncConfig();
    const nextCfg: StoreCloudRawConfig = {
      repo: candidateUrl,
      branch: prev.branch || 'main',
      token: prev.token || '',
    };
    localStorage.setItem(STORE_CLOUD_CONFIG_KEY, JSON.stringify(nextCfg));

    params.delete('cloud');
    const rest = params.toString();
    const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash || ''}`;
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState({}, '', cleanUrl);
    }
    window.dispatchEvent(new CustomEvent(STORE_CLOUD_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function buildStaffAutoConnectUrl(rawGasUrl?: string): string {
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl ?? readRawSyncConfig().repo);
  if (!gasUrl) return '';
  const encoded = encodeBase64UrlUtf8(gasUrl);
  if (typeof window === 'undefined' || !window.location) {
    return `https://himart-gj.github.io/himart-gguk2/?cloud=${encoded}`;
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?cloud=${encoded}`;
}

export function extractFriendScheduleMap(rawData: unknown): Record<string, boolean> {
  if (!rawData || typeof rawData !== 'object') return {};
  const rawMap = (rawData as Record<string, unknown>)[FRIEND_SCHEDULE_MAP_FIELD];
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
    const cleanKey = String(k || '').trim();
    if (cleanKey) {
      out[cleanKey] = v === true;
    }
  }
  return out;
}

export function syncCurrentFriendScheduleAccessFromCareData(rawData: unknown): void {
  if (!rawData || typeof rawData !== 'object') return;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const manuals = (rawData as Record<string, unknown>)[PARTNER_MANUALS_META_FIELD];
      if (manuals && typeof manuals === 'object' && !Array.isArray(manuals) && Object.keys(manuals).length > 0) {
        sessionStorage.setItem('himart_partner_manuals_session_v1', JSON.stringify(manuals));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('himart_partner_manuals_updated'));
        }
      }
    }
  } catch {
    // ignore session quota
  }

  if (!isFriendRestrictedMode()) return;
  const session = readFriendSession();
  if (!session || !session.codeId) return;
  const scheduleMap = extractFriendScheduleMap(rawData);
  const allowed = scheduleMap[session.codeId] === true;
  syncFriendSchedulePermission(allowed);
}

interface CacheEntry {
  fetchedAtMs: number;
  data: unknown;
}

const datasetMicroCache = new Map<StoreCloudKind, CacheEntry>();
const inFlightReads = new Map<StoreCloudKind, Promise<unknown>>();
const MICRO_CACHE_TTL_MS = 1500;

let nativeFetchRef: typeof fetch | null = null;

function getNativeFetch(): typeof fetch {
  if (nativeFetchRef) return nativeFetchRef;
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch.bind(window);
  }
  return fetch;
}

export function clearStoreCloudMicroCache(kind?: StoreCloudKind): void {
  if (kind) {
    datasetMicroCache.delete(kind);
  } else {
    datasetMicroCache.clear();
  }
}

export async function fetchStoreCloudDataset<T = unknown>(
  kind: StoreCloudKind,
  options?: { bypassCache?: boolean; gasUrlOverride?: string }
): Promise<T | null> {
  if (kind === 'schedule' && !canAccessStoreSchedule()) {
    return ({} as unknown) as T;
  }

  const gasUrl = normalizeGasWebAppUrl(options?.gasUrlOverride ?? readRawSyncConfig().repo);
  if (!gasUrl) return null;

  const now = Date.now();
  if (!options?.bypassCache) {
    const cached = datasetMicroCache.get(kind);
    if (cached && now - cached.fetchedAtMs < MICRO_CACHE_TTL_MS) {
      return (cached.data as T) ?? null;
    }
    const existingFlight = inFlightReads.get(kind);
    if (existingFlight) {
      return (await existingFlight) as T | null;
    }
  }

  const runner = (async (): Promise<unknown> => {
    try {
      const friendSession = isFriendRestrictedMode() ? readFriendSession() : null;
      // 관리자가 휴무표 공유를 ON(canAccessStoreSchedule === true)한 초대 직원의 경우,
      // 구버전 Code.gs의 role=friend 일괄 휴무표 차단 분기를 우회하여 읽기 전용으로 열람 가능하도록 처리
      const includeFriendRoleParam =
        friendSession &&
        friendSession.deviceToken &&
        !(kind === 'schedule' && canAccessStoreSchedule());
      const friendQuery = includeFriendRoleParam
        ? `&role=friend&dt=${encodeURIComponent(friendSession.deviceToken)}`
        : '';
      const savedSid = !friendSession ? loadSavedSpreadsheetId() : '';
      const sidQuery = savedSid ? `&sid=${encodeURIComponent(savedSid)}` : '';
      const sep = gasUrl.includes('?') ? '&' : '?';
      const targetUrl = `${gasUrl}${sep}action=getDataset&kind=${encodeURIComponent(
        kind
      )}${friendQuery}${sidQuery}&_t=${Date.now()}`;
      const res = await getNativeFetch()(targetUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.revoked === true) {
        revokeLocalFriendAccess();
        datasetMicroCache.delete(kind);
        return null;
      }
      if (!json?.ok || json.data === null || json.data === undefined) {
        datasetMicroCache.set(kind, { fetchedAtMs: Date.now(), data: null });
        return null;
      }
      if (kind === 'care') {
        syncCurrentFriendScheduleAccessFromCareData(json.data);
      }
      datasetMicroCache.set(kind, { fetchedAtMs: Date.now(), data: json.data });
      return json.data;
    } catch {
      return null;
    }
  })();

  inFlightReads.set(kind, runner);
  try {
    return ((await runner) as T) ?? null;
  } finally {
    inFlightReads.delete(kind);
  }
}

export async function saveStoreCloudDataset(
  kind: StoreCloudKind,
  payloadData: unknown,
  configOverride?: Partial<StoreCloudRawConfig> & { spreadsheetId?: string }
): Promise<{
  ok: boolean;
  configured: boolean;
  needsSpreadsheetId?: boolean;
  message: string;
}> {
  if (isFriendRestrictedMode()) {
    return {
      ok: false,
      configured: false,
      message: '외부 공유 기기에서는 매장 공용 시트를 덮어쓸 수 없습니다 (내 기기에만 반영됨).',
    };
  }

  const saved = readRawSyncConfig();
  const rawRepo = (configOverride?.repo ?? saved.repo ?? '').trim();
  const gasUrl = normalizeGasWebAppUrl(rawRepo);
  const pin = (configOverride?.token ?? saved.token ?? '').trim();
  const spreadsheetId = extractGoogleSheetId(
    configOverride?.spreadsheetId ?? loadSavedSpreadsheetId()
  );

  if (!gasUrl) {
    if (rawRepo) {
      return {
        ok: false,
        configured: false,
        message:
          '보안 정책상 GitHub 저장소에는 업로드할 수 없습니다. 구글 시트 Apps Script 웹앱 URL(https://script.google.com/macros/s/.../exec)을 입력해 주세요.',
      };
    }
    return {
      ok: false,
      configured: false,
      message: '구글 시트 동기화 미설정 (내 기기에만 저장됨)',
    };
  }

  if (!pin) {
    return {
      ok: false,
      configured: false,
      message: '관리자 업로드 비밀번호(PIN)를 먼저 입력해 주세요.',
    };
  }

  let finalPayload: unknown = payloadData;
  if (kind === 'care') {
    try {
      const parsedObj =
        typeof payloadData === 'string'
          ? JSON.parse(payloadData)
          : payloadData && typeof payloadData === 'object'
          ? { ...(payloadData as Record<string, unknown>) }
          : null;
      if (
        parsedObj &&
        typeof parsedObj === 'object' &&
        !Array.isArray(parsedObj) &&
        PRESERVED_CARE_META_FIELDS.some((field) => !(field in parsedObj))
      ) {
        const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>(
          'care',
          {
            bypassCache: true,
            gasUrlOverride: gasUrl,
          }
        );
        if (existingCare && typeof existingCare === 'object') {
          for (const field of PRESERVED_CARE_META_FIELDS) {
            if (
              !(field in parsedObj) &&
              existingCare[field] &&
              typeof existingCare[field] === 'object'
            ) {
              (parsedObj as Record<string, unknown>)[field] = existingCare[field];
            }
          }
          finalPayload = parsedObj;
        }
      }
    } catch {
      // keep original payloadData if JSON parse fails
    }
  }

  const serialized =
    typeof finalPayload === 'string'
      ? finalPayload
      : JSON.stringify(finalPayload ?? {});

  try {
    const res = await getNativeFetch()(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveDataset',
        kind,
        pin,
        payload: serialized,
        ...(spreadsheetId ? { spreadsheetId } : {}),
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        message: `구글 시트 웹앱 응답 오류 (${res.status}): 웹앱 배포 권한이 [모든 사용자]로 설정되어 있는지 확인해 주세요.`,
      };
    }

    const json = await res.json();
    if (!json?.ok) {
      const rawErr = String(json?.error || '');
      const isNullSheetErr =
        Boolean(json?.needsSpreadsheetId) || rawErr.includes('getSheetByName');
      return {
        ok: false,
        configured: true,
        needsSpreadsheetId: isNullSheetErr,
        message: isNullSheetErr
          ? '독립형 Apps Script가 감지되었습니다! 상단 [연동할 구글 시트 주소(URL)] 칸에 기존 구글 시트 주소를 붙여넣고 최신 Apps Script 코드로 배포 후 [연결 저장·확인]을 눌러주세요.'
          : rawErr || '구글 시트 저장 실패: 업로드 비밀번호(PIN)를 확인해 주세요.',
      };
    }

    try {
      const parsedForCache =
        typeof finalPayload === 'string' ? JSON.parse(finalPayload) : finalPayload;
      datasetMicroCache.set(kind, {
        fetchedAtMs: Date.now(),
        data: parsedForCache,
      });
    } catch {
      datasetMicroCache.delete(kind);
    }

    return {
      ok: true,
      configured: true,
      message: json.pinInitialized
        ? '비공개 구글 시트에 저장되었으며 입력하신 PIN이 관리자 비밀번호로 최초 등록되었습니다!'
        : '비공개 구글 시트에 최신 자료가 반영되었습니다! 전 직원 기기에서 자동 연동됩니다.',
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      message: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

export async function fetchFriendScheduleMap(
  gasUrlOverride?: string
): Promise<Record<string, boolean>> {
  const careData = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
    bypassCache: true,
    gasUrlOverride,
  });
  return extractFriendScheduleMap(careData);
}

export async function saveFriendSchedulePermission(
  rawGasUrl: string,
  pin: string,
  codeId: string,
  allowed: boolean,
  spreadsheetIdOverride?: string
): Promise<{
  ok: boolean;
  scheduleMap?: Record<string, boolean>;
  message: string;
}> {
  const cleanCodeId = String(codeId || '').trim();
  if (!cleanCodeId) {
    return { ok: false, message: '대상 초대코드 식별자(codeId)가 없습니다.' };
  }
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl || readRawSyncConfig().repo);
  if (!gasUrl || !pin.trim()) {
    return {
      ok: false,
      message: '구글 시트 웹앱 URL과 관리자 PIN을 먼저 확인해 주세요.',
    };
  }

  const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
    bypassCache: true,
    gasUrlOverride: gasUrl,
  });
  const baseObj: Record<string, unknown> =
    existingCare && typeof existingCare === 'object' && !Array.isArray(existingCare)
      ? { ...existingCare }
      : { versionTitle: '', updatedAt: '', fileName: '', items: [] };
  if (!Array.isArray(baseObj.items)) {
    baseObj.items = [];
  }

  const prevMap = extractFriendScheduleMap(baseObj);
  const nextMap: Record<string, boolean> = {
    ...prevMap,
    [cleanCodeId]: Boolean(allowed),
  };
  baseObj[FRIEND_SCHEDULE_MAP_FIELD] = nextMap;

  const res = await saveStoreCloudDataset('care', baseObj, {
    repo: gasUrl,
    token: pin.trim(),
    ...(spreadsheetIdOverride ? { spreadsheetId: spreadsheetIdOverride } : {}),
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  return {
    ok: true,
    scheduleMap: nextMap,
    message: allowed
      ? '초대 직원 기기에 경기광주점 휴무표 열람 공유가 [ON] 되었습니다.'
      : '초대 직원 기기의 휴무표 공유가 [OFF] 차단되었습니다.',
  };
}

export function normalizeSharedGeminiAdminState(
  raw: any
): SharedGeminiAdminState {
  const rawMap =
    raw?.friendAiMap && typeof raw.friendAiMap === 'object'
      ? raw.friendAiMap
      : {};
  const cleanMap: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawMap)) {
    if (k) cleanMap[k] = v !== false;
  }
  return {
    hasSharedKey: Boolean(raw?.hasSharedKey),
    maskedSharedKey: String(raw?.maskedSharedKey || '').trim(),
    globalEnabled: Boolean(raw?.globalEnabled),
    friendAiMap: cleanMap,
  };
}

export async function diagnoseStoreCloudConnection(
  rawGasUrl: string,
  pin: string,
  sheetIdOverride?: string
): Promise<CloudDiagnosticsReport> {
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl || readRawSyncConfig().repo);
  const cleanPin = String(pin || '').trim();
  const spreadsheetId = extractGoogleSheetId(
    sheetIdOverride ?? loadSavedSpreadsheetId()
  );
  if (spreadsheetId) {
    saveSpreadsheetId(spreadsheetId);
  }
  if (!gasUrl || cleanPin.length < 4) {
    return {
      ok: false,
      error: '구글 Apps Script 웹앱 URL과 관리자 PIN(4자리 이상)을 먼저 입력해 주세요.',
    };
  }

  try {
    const res = await getNativeFetch()(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'diagnoseCloudSync',
        pin: cleanPin,
        ...(spreadsheetId ? { spreadsheetId } : {}),
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `구글 시트 웹앱 응답 오류 (${res.status}): 배포 권한이 [모든 사용자]인지 확인해 주세요.`,
      };
    }
    const json = await res.json();
    if (json?.ok) {
      if (json.spreadsheetId) {
        saveSpreadsheetId(String(json.spreadsheetId));
      }
      return {
        ok: true,
        bindingMode: json.bindingMode === 'standalone_id' ? 'standalone_id' : 'container',
        spreadsheetId: String(json.spreadsheetId || ''),
        spreadsheetTitle: String(json.spreadsheetTitle || '비공개 구글 시트'),
        inviteCount: Math.max(0, Number(json.inviteCount) || 0),
        boundInviteCount: Math.max(0, Number(json.boundInviteCount) || 0),
        sharedAi: normalizeSharedGeminiAdminState(json.sharedAi),
        datasets: json.datasets || undefined,
      };
    }

    const rawErr = String(json?.error || '');
    if (json?.needsSpreadsheetId || rawErr.includes('getSheetByName')) {
      return {
        ok: false,
        needsSpreadsheetId: true,
        error: rawErr.includes('getSheetByName')
          ? '현재 Apps Script에 구버전 단독 코드가 배포되어 시트를 찾지 못했습니다! [연결할 구글 시트 주소(URL)] 칸에 기존 시트 주소를 입력한 뒤 [Apps Script 코드 복사] → Code.gs 붙여넣기·배포를 1회 진행해 주세요. (기존 초대 목록과 4대 자료는 시트에 100% 보존되어 있습니다!)'
          : rawErr,
      };
    }

    if (rawErr.includes('diagnoseCloudSync')) {
      const sep = gasUrl.includes('?') ? '&' : '?';
      const sidParam = spreadsheetId ? `&sid=${encodeURIComponent(spreadsheetId)}` : '';
      const getRes = await getNativeFetch()(`${gasUrl}${sep}action=getAll${sidParam}&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson?.ok && getJson.datasets) {
          const ds: Record<StoreCloudKind, CloudKindDiagnostic> = {
            schedule: { exists: false, updatedAt: '', chunks: 0, bytes: 0, validJson: true, itemCount: 0 },
            incentive: { exists: false, updatedAt: '', chunks: 0, bytes: 0, validJson: true, itemCount: 0 },
            care: { exists: false, updatedAt: '', chunks: 0, bytes: 0, validJson: true, itemCount: 0 },
            installment: { exists: false, updatedAt: '', chunks: 0, bytes: 0, validJson: true, itemCount: 0 },
          };
          (['schedule', 'incentive', 'care', 'installment'] as StoreCloudKind[]).forEach((k) => {
            const entry = getJson.datasets?.[k];
            const d = entry?.data;
            const exists = d !== null && d !== undefined;
            let count = 0;
            if (exists && typeof d === 'object') {
              if (k === 'care' && Array.isArray((d as any).items)) count = (d as any).items.length;
              else if (k === 'installment' && Array.isArray((d as any).columns)) count = (d as any).columns.length;
              else count = Object.keys(d as object).length;
            }
            ds[k] = {
              exists,
              updatedAt: String(entry?.updatedAt || ''),
              chunks: exists ? 1 : 0,
              bytes: exists ? JSON.stringify(d).length : 0,
              validJson: !entry?.parseError,
              itemCount: count,
            };
          });
          return {
            ok: true,
            spreadsheetTitle: '비공개 구글 시트 (구버전 스크립트 — AI공유 기능을 쓰려면 코드 업데이트 권장)',
            datasets: ds,
          };
        }
      }
    }

    return {
      ok: false,
      error: rawErr || '시트 연동 진단에 실패했습니다.',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '인터넷 또는 배포 권한 확인'})`,
    };
  }
}

export async function saveCloudSharedGeminiConfig(
  rawGasUrl: string,
  pin: string,
  patch: {
    apiKey?: string;
    clearKey?: boolean;
    globalEnabled?: boolean;
    friendCodeId?: string;
    friendAiAllowed?: boolean;
    spreadsheetId?: string;
  }
): Promise<{
  ok: boolean;
  sharedAi?: SharedGeminiAdminState;
  error?: string;
}> {
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl || readRawSyncConfig().repo);
  const cleanPin = String(pin || '').trim();
  const spreadsheetId = extractGoogleSheetId(
    patch.spreadsheetId ?? loadSavedSpreadsheetId()
  );
  if (!gasUrl || cleanPin.length < 4) {
    return {
      ok: false,
      error: '구글 Apps Script 웹앱 URL과 관리자 PIN을 먼저 저장해 주세요.',
    };
  }
  try {
    const res = await getNativeFetch()(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveSharedGeminiConfig',
        pin: cleanPin,
        ...(typeof patch.apiKey === 'string' ? { apiKey: patch.apiKey.trim() } : {}),
        ...(patch.clearKey ? { clearKey: true } : {}),
        ...(typeof patch.globalEnabled === 'boolean'
          ? { globalEnabled: patch.globalEnabled }
          : {}),
        ...(patch.friendCodeId ? { friendCodeId: patch.friendCodeId } : {}),
        ...(typeof patch.friendAiAllowed === 'boolean'
          ? { friendAiAllowed: patch.friendAiAllowed }
          : {}),
        ...(spreadsheetId ? { spreadsheetId } : {}),
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `구글 시트 응답 오류 (${res.status})` };
    }
    const json = await res.json();
    if (!json?.ok) {
      const rawErr = String(json?.error || '');
      return {
        ok: false,
        error: rawErr.includes('saveSharedGeminiConfig')
          ? '초대 친구 API 키 공유 ON/OFF 기능을 활성화하려면 상단 [Apps Script 코드 복사]를 눌러 Code.gs를 최신 코드로 1회 업데이트(새 버전 배포)해 주세요!'
          : rawErr || '공유 API 키 설정 저장에 실패했습니다.',
      };
    }
    return {
      ok: true,
      sharedAi: normalizeSharedGeminiAdminState(json.sharedAi),
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

export async function fetchFriendSharedGeminiKeyFromCloud(
  rawGasUrlOverride?: string
): Promise<{
  ok: boolean;
  aiEnabled: boolean;
  sharedApiKey: string;
  revoked?: boolean;
}> {
  if (!isFriendRestrictedMode()) {
    return { ok: true, aiEnabled: false, sharedApiKey: '' };
  }
  const session = readFriendSession();
  if (!session || !session.deviceToken) {
    return { ok: false, aiEnabled: false, sharedApiKey: '' };
  }
  const gasUrl = normalizeGasWebAppUrl(
    rawGasUrlOverride ?? readRawSyncConfig().repo
  );
  if (!gasUrl) {
    return { ok: false, aiEnabled: false, sharedApiKey: '' };
  }
  try {
    const res = await getNativeFetch()(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getFriendSharedGeminiKey',
        deviceToken: session.deviceToken,
        codeId: session.codeId || '',
      }),
    });
    if (!res.ok) {
      return { ok: false, aiEnabled: false, sharedApiKey: '' };
    }
    const json = await res.json();
    if (json?.revoked === true) {
      revokeLocalFriendAccess();
      return { ok: true, aiEnabled: false, sharedApiKey: '', revoked: true };
    }
    if (!json?.ok) {
      return { ok: false, aiEnabled: false, sharedApiKey: '' };
    }
    const enabled = Boolean(json.aiEnabled && json.sharedApiKey);
    return {
      ok: true,
      aiEnabled: enabled,
      sharedApiKey: enabled ? String(json.sharedApiKey).trim() : '',
    };
  } catch {
    return { ok: false, aiEnabled: false, sharedApiKey: '' };
  }
}

export function extractFriendRemoteProfilesMap(
  rawData: unknown
): Record<string, FriendRemoteProfile> {
  if (!rawData || typeof rawData !== 'object') return {};
  const rawMap = (rawData as Record<string, unknown>)[FRIEND_REMOTE_PROFILES_FIELD];
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const out: Record<string, FriendRemoteProfile> = {};
  for (const [rawCodeId, entry] of Object.entries(rawMap as Record<string, any>)) {
    const codeId = String(rawCodeId || '').trim();
    if (!codeId || !entry || typeof entry !== 'object') continue;
    out[codeId] = {
      storeName: String(entry.storeName || '').trim(),
      consultantName: String(entry.consultantName || '').trim(),
      phone: String(entry.phone || '').trim(),
      updatedAt: String(entry.updatedAt || '').trim(),
    };
  }
  return out;
}

export async function fetchAllFriendRemoteProfiles(
  gasUrlOverride?: string
): Promise<Record<string, FriendRemoteProfile>> {
  const careData = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
    bypassCache: true,
    gasUrlOverride,
  });
  return extractFriendRemoteProfilesMap(careData);
}

export async function saveFriendRemoteProfile(
  rawGasUrl: string,
  pin: string,
  codeId: string,
  profileInput: {
    storeName: string;
    consultantName: string;
    phone: string;
  }
): Promise<{
  ok: boolean;
  profiles?: Record<string, FriendRemoteProfile>;
  message: string;
}> {
  const cleanCodeId = String(codeId || '').trim();
  if (!cleanCodeId) {
    return { ok: false, message: '대상 초대코드 식별자(codeId)가 없습니다.' };
  }
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl || readRawSyncConfig().repo);
  if (!gasUrl || !pin.trim()) {
    return {
      ok: false,
      message: '구글 시트 웹앱 URL과 관리자 PIN을 먼저 확인해 주세요.',
    };
  }

  const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>(
    'care',
    {
      bypassCache: true,
      gasUrlOverride: gasUrl,
    }
  );
  const baseObj: Record<string, unknown> =
    existingCare && typeof existingCare === 'object' && !Array.isArray(existingCare)
      ? { ...existingCare }
      : { versionTitle: '', updatedAt: '', fileName: '', items: [] };
  if (!Array.isArray(baseObj.items)) {
    baseObj.items = [];
  }

  const prevMap = extractFriendRemoteProfilesMap(baseObj);
  const nextProfile: FriendRemoteProfile = {
    storeName: String(profileInput.storeName || '').trim(),
    consultantName: String(profileInput.consultantName || '').trim(),
    phone: String(profileInput.phone || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  const nextMap: Record<string, FriendRemoteProfile> = {
    ...prevMap,
    [cleanCodeId]: nextProfile,
  };
  baseObj[FRIEND_REMOTE_PROFILES_FIELD] = nextMap;

  const res = await saveStoreCloudDataset('care', baseObj, {
    repo: gasUrl,
    token: pin.trim(),
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  return {
    ok: true,
    profiles: nextMap,
    message: '친구 기기 프로필(지점명·담당자)이 비공개 시트에 원격 반영되었습니다.',
  };
}

export async function deleteFriendRemoteProfile(
  rawGasUrl: string,
  pin: string,
  codeId: string
): Promise<void> {
  const cleanCodeId = String(codeId || '').trim();
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl || readRawSyncConfig().repo);
  if (!cleanCodeId || !gasUrl || !pin.trim()) return;
  try {
    const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>(
      'care',
      {
        bypassCache: true,
        gasUrlOverride: gasUrl,
      }
    );
    if (!existingCare || typeof existingCare !== 'object') return;
    const prevMap = extractFriendRemoteProfilesMap(existingCare);
    const prevSched = extractFriendScheduleMap(existingCare);
    if (!(cleanCodeId in prevMap) && !(cleanCodeId in prevSched)) return;
    const nextMap = { ...prevMap };
    const nextSched = { ...prevSched };
    delete nextMap[cleanCodeId];
    delete nextSched[cleanCodeId];
    await saveStoreCloudDataset(
      'care',
      {
        ...existingCare,
        [FRIEND_REMOTE_PROFILES_FIELD]: nextMap,
        [FRIEND_SCHEDULE_MAP_FIELD]: nextSched,
      },
      {
        repo: gasUrl,
        token: pin.trim(),
      }
    );
  } catch {
    // ignore optional cleanup errors
  }
}

function readHeaderValue(headersInit: HeadersInit | undefined, targetName: string): string {
  if (!headersInit) return '';
  const lower = targetName.toLowerCase();
  if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
    return headersInit.get(targetName) || '';
  }
  if (Array.isArray(headersInit)) {
    const found = headersInit.find(([k]) => String(k).toLowerCase() === lower);
    return found ? String(found[1]) : '';
  }
  for (const [k, v] of Object.entries(headersInit as Record<string, string>)) {
    if (k.toLowerCase() === lower) return String(v || '');
  }
  return '';
}

function extractGasUrlFromGitHubApiUrl(urlStr: string): string {
  const m = urlStr.match(/api\.github\.com\/repos\/(.+?)\/contents\/public\//i);
  if (!m?.[1]) return '';
  let candidate = m[1];
  try {
    if (candidate.includes('%3A') || candidate.includes('%2F')) {
      candidate = decodeURIComponent(candidate);
    }
  } catch {
    // ignore decode error
  }
  return normalizeGasWebAppUrl(candidate);
}

function jsonHttpResponse(bodyObj: unknown, status = 200): Response {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function installStoreCloudFetchBridge(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const winAny = window as any;
  if (winAny.__himartStoreCloudBridgeInstalled) return;
  winAny.__himartStoreCloudBridgeInstalled = true;

  const rawFetch = window.fetch.bind(window);
  nativeFetchRef = rawFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input && typeof (input as Request).url === 'string'
        ? (input as Request).url
        : String(input);

    if (/\/api\/(?:schedule|model-incentives)\/save(?:$|\?)/i.test(urlStr)) {
      return jsonHttpResponse({ ok: true, skippedStaticWrite: true }, 200);
    }

    const dataMatch = urlStr.match(DATA_FILE_RE);
    if (!dataMatch) {
      return rawFetch(input, init);
    }

    const kind = mapFileSlugToKind(dataMatch[1]);

    // 초대 기기에서 휴무표 공유가 OFF 상태이면 schedule 네트워크 요청을 즉시 차단
    if (kind === 'schedule' && !canAccessStoreSchedule()) {
      return jsonHttpResponse({}, 200);
    }

    const isGitHubApi = /api\.github\.com\/repos\//i.test(urlStr);

    if (isGitHubApi) {
      const method = String(
        init?.method ||
          (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
      ).toUpperCase();

      if (method === 'PUT' || method === 'POST') {
        let decodedPayload = '{}';
        try {
          const rawBodyStr = typeof init?.body === 'string' ? init.body : '';
          const parsedBody = rawBodyStr ? JSON.parse(rawBodyStr) : {};
          if (typeof parsedBody?.content === 'string') {
            decodedPayload = decodeBase64Utf8(parsedBody.content);
          }
        } catch {
          return jsonHttpResponse(
            { message: '업로드 데이터 인코딩 해석에 실패했습니다.' },
            400
          );
        }

        const authHeader = readHeaderValue(init?.headers, 'authorization');
        const bearerPin = authHeader.replace(/^Bearer\s+/i, '').trim();
        const urlGas = extractGasUrlFromGitHubApiUrl(urlStr);
        const savedCfg = readRawSyncConfig();

        const saveResult = await saveStoreCloudDataset(kind, decodedPayload, {
          repo: urlGas || savedCfg.repo,
          token: bearerPin || savedCfg.token,
        });

        if (!saveResult.ok) {
          return jsonHttpResponse({ message: saveResult.message }, 400);
        }
        return jsonHttpResponse(
          { ok: true, content: { sha: 'gas-cloud-sha' }, message: saveResult.message },
          200
        );
      }

      const accept = readHeaderValue(init?.headers, 'accept').toLowerCase();
      if (!accept.includes('raw')) {
        return jsonHttpResponse({ sha: 'gas-cloud-sha' }, 200);
      }

      const urlGas = extractGasUrlFromGitHubApiUrl(urlStr);
      const cloudData = await fetchStoreCloudDataset(kind, {
        gasUrlOverride: urlGas || undefined,
      });
      if (
        cloudData !== null &&
        (kind !== 'care' || hasValidCloudCareItems(cloudData))
      ) {
        return jsonHttpResponse(cloudData, 200);
      }
      const fallback = getEmptyFallbackForKind(kind);
      if (fallback === null || kind === 'care') {
        return jsonHttpResponse({ message: 'No cloud dataset yet' }, 404);
      }
      return jsonHttpResponse(fallback, 200);
    }

    const cloudData = await fetchStoreCloudDataset(kind);
    if (
      cloudData !== null &&
      (kind !== 'care' || hasValidCloudCareItems(cloudData))
    ) {
      return jsonHttpResponse(cloudData, 200);
    }
    return rawFetch(input, init);
  };
}


export { getStoreCloudAppsScriptCode } from './storeCloudAppsScriptCode';

bootstrapCloudConfigFromUrl();
bootstrapInviteFromUrl();
installStoreCloudFetchBridge();
