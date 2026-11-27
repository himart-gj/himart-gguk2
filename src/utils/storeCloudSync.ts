// ============================================================================
// 롯데하이마트 경기광주점 — 비공개 구글 시트(Apps Script) 전용 클라우드 동기화 브릿지
// 목적:
// 1) 월간 휴무표·모델별 수당단가표·안심케어 조견표·무이자할부를 GitHub에 커밋하지 않고
//    비공개 구글 시트(Apps Script 웹앱)로만 저장·불러오기 수행 (깃허브 민감정보 노출 0% 보장)
// 2) 기존 ScheduleModal · CareTableView · CardInstallmentModal · settlementSheetParser의
//    api.github.com 및 정적 *-data.json 요청을 투명하게 가로채어 구글 시트로 중계
// 3) ?cloud=... 원클릭 자동연결 파라미터 지원 (직원 단톡방 공유 시 PIN 제외 URL만 전달)
// ============================================================================

import {
  bootstrapInviteFromUrl,
  isFriendRestrictedMode,
  readFriendSession,
  revokeLocalFriendAccess,
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
  if (typeof localStorage === 'undefined') {
    return { repo: '', branch: 'main', token: '' };
  }
  try {
    const raw = localStorage.getItem(STORE_CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        repo: String(parsed?.repo || '').trim(),
        branch: String(parsed?.branch || 'main').trim() || 'main',
        token: String(parsed?.token || '').trim(),
      };
    }
  } catch {
    // ignore storage parse errors
  }
  return { repo: '', branch: 'main', token: '' };
}

export function resolveRuntimeAdminPin(): string {
  if (typeof localStorage === 'undefined') return UNCONFIGURED_PIN_SENTINEL;
  try {
    const syncToken = readRawSyncConfig().token.trim();
    if (syncToken.length >= 4) return syncToken;
    const ownerCustom = String(localStorage.getItem(OWNER_CUSTOM_PIN_STORAGE_KEY) || '').trim();
    if (ownerCustom.length >= 4) return ownerCustom;
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
  if (isFriendRestrictedMode() && kind === 'schedule') {
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
      const friendQuery =
        friendSession && friendSession.deviceToken
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
        (!(FRIEND_REMOTE_PROFILES_FIELD in parsedObj) ||
          !('__partnerManuals' in parsedObj))
      ) {
        const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>(
          'care',
          {
            bypassCache: true,
            gasUrlOverride: gasUrl,
          }
        );
        if (existingCare && typeof existingCare === 'object') {
          if (
            !(FRIEND_REMOTE_PROFILES_FIELD in parsedObj) &&
            existingCare[FRIEND_REMOTE_PROFILES_FIELD] &&
            typeof existingCare[FRIEND_REMOTE_PROFILES_FIELD] === 'object'
          ) {
            (parsedObj as Record<string, unknown>)[FRIEND_REMOTE_PROFILES_FIELD] =
              existingCare[FRIEND_REMOTE_PROFILES_FIELD];
          }
          if (
            !('__partnerManuals' in parsedObj) &&
            existingCare['__partnerManuals'] &&
            typeof existingCare['__partnerManuals'] === 'object'
          ) {
            (parsedObj as Record<string, unknown>)['__partnerManuals'] =
              existingCare['__partnerManuals'];
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
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl);
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

    // 만약 구버전 Code.gs라 diagnoseCloudSync 액션이 아직 없는 경우 GET ?action=getAll 로 폴백 점검
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
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl);
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
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl);
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
  const gasUrl = normalizeGasWebAppUrl(rawGasUrl);
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
    if (!(cleanCodeId in prevMap)) return;
    const nextMap = { ...prevMap };
    delete nextMap[cleanCodeId];
    await saveStoreCloudDataset(
      'care',
      {
        ...existingCare,
        [FRIEND_REMOTE_PROFILES_FIELD]: nextMap,
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

    // 로컬 개발서버가 public/*-data.json에 민감 데이터를 쓰는 것도 사전 차단
    if (/\/api\/(?:schedule|model-incentives)\/save(?:$|\?)/i.test(urlStr)) {
      return jsonHttpResponse({ ok: true, skippedStaticWrite: true }, 200);
    }

    const dataMatch = urlStr.match(DATA_FILE_RE);
    if (!dataMatch) {
      return rawFetch(input, init);
    }

    const kind = mapFileSlugToKind(dataMatch[1]);

    // 친구 제한 모드에서는 schedule 관련 네트워크 요청을 원천 차단하고 빈 객체를 즉시 반환
    if (kind === 'schedule' && isFriendRestrictedMode()) {
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

    // 정적 ./schedule-data.json, ./model-incentive-data.json, ./care-table-data.json, ./card-installment-data.json 요청 중계
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

export function getStoreCloudAppsScriptCode(
  defaultSpreadsheetId?: string,
  defaultInstaSpreadsheetId?: string
): string {
  const bakedSheetId = extractGoogleSheetId(
    defaultSpreadsheetId ?? loadSavedSpreadsheetId()
  );
  const bakedInstaSheetId = extractGoogleSheetId(
    defaultInstaSpreadsheetId ?? loadSavedInstaSpreadsheetId()
  );
  return `// ============================================================================
// [하이마트 스마트 상담앱 — 비공개 구글 시트 1-STOP 클라우드 · 초대 · AI공유 · 마케팅DB 통합 브릿지]
// - 시트 내부 [확장 프로그램 -> Apps Script] 및 독립형(script.google.com) 모두 100% 호환
// - 4대 매장 공유 자료 + 친구 다중기기 잠금 + 공유 Gemini API 키 ON/OFF + 인스타 DB(syncLeads/saveBackupState) 통합 지원
// ============================================================================
const DEFAULT_SPREADSHEET_ID = '${bakedSheetId}';
const DEFAULT_INSTA_SPREADSHEET_ID = '${bakedInstaSheetId}';

const TAB_MAP = {
  schedule: '_매장공유_휴무표',
  incentive: '_매장공유_수당단가표',
  care: '_매장공유_안심케어',
  installment: '_매장공유_무이자할부'
};
const FRIEND_ACCESS_TAB = '_친구기기_접근관리';
const GUIDE_TAB = '00_연동가이드_및_AppsScript코드';
const BACKUP_SHEET_NAME = '_앱DB관리백업';
const CHUNK_SIZE = 40000;

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowKstLabel() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function formatCellDate(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val).trim();
}

function normalizePinValue(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  return String(raw).replace(/\\.0+$/, '').trim();
}

function normalizeInviteDigits(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && isFinite(raw)) {
    const intStr = String(Math.trunc(Math.abs(raw)));
    return intStr.length < 8 ? ('00000000' + intStr).slice(-8) : intStr;
  }
  const digits = String(raw).replace(/\\D+/g, '').trim();
  return digits;
}

function extractSheetId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]{20,})/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s) && s.indexOf('http') === -1 && s.indexOf('/') === -1) {
    return s;
  }
  return '';
}

function resolveSpreadsheetContext(reqSheetId, allowPersist) {
  const props = PropertiesService.getScriptProperties();
  const incomingId = extractSheetId(reqSheetId);
  if (incomingId) {
    try {
      const opened = SpreadsheetApp.openById(incomingId);
      if (opened) {
        if (allowPersist === true) {
          props.setProperty('TARGET_SPREADSHEET_ID', incomingId);
        }
        return { ss: opened, mode: 'standalone_id' };
      }
    } catch (err) {
      return {
        ss: null,
        mode: 'error',
        error: '입력하신 구글 시트 주소(ID)에 접근할 수 없습니다. 본인 계정의 시트인지 확인해 주세요: ' + String(err)
      };
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      return { ss: active, mode: 'container' };
    }
  } catch (e) {}

  const savedId = extractSheetId(props.getProperty('TARGET_SPREADSHEET_ID')) || extractSheetId(DEFAULT_SPREADSHEET_ID);
  if (savedId) {
    try {
      const openedSaved = SpreadsheetApp.openById(savedId);
      if (openedSaved) {
        if (allowPersist === true) {
          props.setProperty('TARGET_SPREADSHEET_ID', savedId);
        }
        return { ss: openedSaved, mode: 'standalone_id' };
      }
    } catch (err) {
      return {
        ss: null,
        mode: 'error',
        error: '저장된 구글 시트 ID(' + savedId + ')를 열 수 없습니다: ' + String(err)
      };
    }
  }

  return {
    ss: null,
    mode: 'missing',
    error: '독립형 Apps Script가 감지되었습니다! 앱 업로드 센터 상단의 [연동할 비공개 구글 시트 주소(URL)] 칸에 기존 구글 시트 주소를 붙여넣고 [연결 저장·검수]를 누르면 기존 초대 목록과 4대 자료가 즉시 100% 복구됩니다!'
  };
}

function resolveInstaSpreadsheet(reqInstaSheetId, allowPersist) {
  const props = PropertiesService.getScriptProperties();
  const incomingId = extractSheetId(reqInstaSheetId);
  if (incomingId) {
    try {
      const opened = SpreadsheetApp.openById(incomingId);
      if (opened) {
        if (allowPersist === true) {
          props.setProperty('INSTA_SPREADSHEET_ID', incomingId);
        }
        return opened;
      }
    } catch (e) {}
  }
  const savedInstaId = extractSheetId(props.getProperty('INSTA_SPREADSHEET_ID')) || extractSheetId(DEFAULT_INSTA_SPREADSHEET_ID);
  if (savedInstaId) {
    try {
      const openedSaved = SpreadsheetApp.openById(savedInstaId);
      if (openedSaved) return openedSaved;
    } catch (e) {}
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return null;
}

function writeInstaBackup(instaSs, backupState) {
  let sh = instaSs.getSheetByName(BACKUP_SHEET_NAME);
  if (!sh) {
    sh = instaSs.insertSheet(BACKUP_SHEET_NAME);
    sh.hideSheet();
  }
  sh.clearContents();
  const raw = JSON.stringify(backupState);
  const rows = [];
  for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
    rows.push(['CHUNK', Math.floor(i / CHUNK_SIZE) + 1, raw.slice(i, i + CHUNK_SIZE)]);
  }
  if (rows.length > 0) {
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
  }
}

function readInstaBackup(instaSs) {
  const bSh = instaSs.getSheetByName(BACKUP_SHEET_NAME);
  if (!bSh || bSh.getLastRow() < 1) return null;
  try {
    const vals = bSh.getRange(1, 1, bSh.getLastRow(), Math.min(3, bSh.getLastColumn())).getValues();
    if (vals[0][0] === 'CHUNK') {
      const joined = vals.map(function(r) { return String(r[2] || ''); }).join('');
      return joined ? JSON.parse(joined) : null;
    }
    if (vals[0][0]) {
      return JSON.parse(String(vals[0][0]));
    }
  } catch (err) {}
  return null;
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, 5).setValues([['데이터종류', '청크번호', '전체청크수', '최종업데이트', 'JSON데이터조각']]);
  }
  return sheet;
}

function ensureFriendAccessSheet(ss) {
  let sheet = ss.getSheetByName(FRIEND_ACCESS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(FRIEND_ACCESS_TAB);
    sheet.getRange(1, 1, 1, 10).setValues([[
      '코드ID',
      '8자리초대코드',
      '별칭',
      '상태(ACTIVE/BOUND/REVOKED)',
      '최대기기수',
      '귀속기기토큰',
      '기기정보(UA)',
      '발급일시',
      '최초귀속일시',
      '최근접속일시'
    ]]);
  }
  return sheet;
}

function readSavedAdminPin(ss) {
  const props = PropertiesService.getScriptProperties();
  let savedPin = '';
  if (ss) {
    const guide = ss.getSheetByName(GUIDE_TAB);
    if (guide) {
      savedPin = normalizePinValue(guide.getRange('B3').getValue());
      if (savedPin.indexOf('비워둠') !== -1) savedPin = '';
    }
  }
  if (!savedPin) {
    savedPin = normalizePinValue(props.getProperty('ADMIN_PIN'));
  }
  return savedPin;
}

function verifyOrInitPin(ss, inputPin) {
  const cleanInput = normalizePinValue(inputPin);
  if (!cleanInput) return { ok: false, error: '업로드 비밀번호(PIN)를 입력해 주세요.' };
  const props = PropertiesService.getScriptProperties();
  const sheetPin = ss && ss.getSheetByName(GUIDE_TAB)
    ? normalizePinValue(ss.getSheetByName(GUIDE_TAB).getRange('B3').getValue())
    : '';
  const validSheetPin = sheetPin && sheetPin.indexOf('비워둠') === -1 ? sheetPin : '';
  const propsPin = normalizePinValue(props.getProperty('ADMIN_PIN'));

  if (!validSheetPin && !propsPin) {
    props.setProperty('ADMIN_PIN', cleanInput);
    if (ss) {
      const guide = ss.getSheetByName(GUIDE_TAB);
      if (guide) guide.getRange('B3').setValue(cleanInput);
    }
    return { ok: true, initialized: true };
  }
  if ((validSheetPin && cleanInput === validSheetPin) || (!validSheetPin && propsPin && cleanInput === propsPin)) {
    if (propsPin !== cleanInput) {
      props.setProperty('ADMIN_PIN', cleanInput);
    }
    return { ok: true, initialized: false };
  }
  return { ok: false, error: '관리자 업로드 비밀번호(PIN)가 일치하지 않습니다.' };
}

function maskApiKey(rawKey) {
  const k = String(rawKey || '').trim();
  if (!k) return '';
  if (k.length <= 10) return '****';
  return k.slice(0, 6) + '••••' + k.slice(-4);
}

function readSharedGeminiConfig() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('SHARED_GEMINI_API_KEY') || '').trim();
  const globalRaw = String(props.getProperty('SHARED_GEMINI_ENABLED') || '').trim();
  const globalEnabled = globalRaw === 'true';
  let friendAiMap = {};
  try {
    const rawMap = props.getProperty('SHARED_GEMINI_FRIEND_MAP');
    if (rawMap) {
      const parsed = JSON.parse(rawMap);
      if (parsed && typeof parsed === 'object') {
        friendAiMap = parsed;
      }
    }
  } catch (e) {
    friendAiMap = {};
  }
  return {
    apiKey: apiKey,
    hasSharedKey: Boolean(apiKey),
    maskedSharedKey: maskApiKey(apiKey),
    globalEnabled: globalEnabled,
    friendAiMap: friendAiMap
  };
}

function toPublicSharedAiMeta(cfg) {
  return {
    hasSharedKey: cfg.hasSharedKey,
    maskedSharedKey: cfg.maskedSharedKey,
    globalEnabled: cfg.globalEnabled,
    friendAiMap: cfg.friendAiMap
  };
}

function resolveFriendSharedKeyPayload(codeId, status) {
  const cfg = readSharedGeminiConfig();
  const friendAllowed = cfg.friendAiMap[codeId] !== false;
  const active = status === 'BOUND' && cfg.hasSharedKey && cfg.globalEnabled && friendAllowed;
  return {
    aiEnabled: active,
    sharedApiKey: active ? cfg.apiKey : ''
  };
}

function parseTokenList(raw) {
  return String(raw || '')
    .split(',')
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 0; });
}

function maskDeviceToken(token) {
  const list = parseTokenList(token);
  if (!list.length) return '';
  return list
    .map(function(t) {
      if (t.length <= 12) return t;
      return t.slice(0, 6) + '...' + t.slice(-4);
    })
    .join(' / ');
}

function readAllFriendInviteRows(ss) {
  const sheet = ensureFriendAccessSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheet, records: [] };
  const colCount = Math.max(9, Math.min(10, sheet.getLastColumn() || 10));
  const values = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  const records = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const codeId = String(r[0] || '').trim();
    const inviteCode = normalizeInviteDigits(r[1]);
    if (!codeId && !inviteCode) continue;
    const isLegacyNineCol = colCount === 9 && (!r[9] && String(r[8] || '').indexOf('Mozilla') !== -1);
    records.push({
      rowNumber: i + 2,
      codeId: codeId,
      inviteCode: inviteCode,
      label: String(r[2] || '친구1').trim(),
      status: String(r[3] || 'ACTIVE').trim().toUpperCase(),
      maxDevices: Math.max(1, Number(r[4]) || 1),
      boundDeviceToken: String(r[5] || '').trim(),
      boundUserAgent: isLegacyNineCol ? String(r[8] || '').trim() : String(r[6] || '').trim(),
      createdAt: isLegacyNineCol ? formatCellDate(r[6]) : formatCellDate(r[7]),
      boundAt: isLegacyNineCol ? formatCellDate(r[6]) : formatCellDate(r[8]),
      lastSeenAt: isLegacyNineCol ? formatCellDate(r[7]) : formatCellDate(r[9])
    });
  }
  return { sheet: sheet, records: records };
}

function toClientFriendItem(rec, friendAiMap) {
  const tokens = parseTokenList(rec.boundDeviceToken);
  const mapObj = friendAiMap || {};
  return {
    codeId: rec.codeId,
    inviteCode: rec.inviteCode,
    label: rec.label,
    status: rec.status,
    maxDevices: rec.maxDevices,
    boundDeviceCount: tokens.length,
    boundDevicePreview: maskDeviceToken(rec.boundDeviceToken),
    boundUserAgent: rec.boundUserAgent,
    aiAllowed: mapObj[rec.codeId] !== false,
    createdAt: rec.createdAt,
    boundAt: rec.boundAt,
    lastSeenAt: rec.lastSeenAt
  };
}

function readKindDataset(ss, kind) {
  const tabName = TAB_MAP[kind];
  if (!tabName) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const validRows = rows.filter(function(r) { return String(r[0]) === kind && r[4] !== ''; });
  if (!validRows.length) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  validRows.sort(function(a, b) { return Number(a[1]) - Number(b[1]); });
  const updatedAt = formatCellDate(validRows[0][3]);
  const joined = validRows.map(function(r) { return String(r[4]); }).join('');
  try {
    return {
      updatedAt: updatedAt,
      chunks: validRows.length,
      bytes: joined.length,
      data: JSON.parse(joined)
    };
  } catch (err) {
    return {
      updatedAt: updatedAt,
      chunks: validRows.length,
      bytes: joined.length,
      data: null,
      parseError: String(err)
    };
  }
}

function countDatasetItems(kind, data) {
  if (!data || typeof data !== 'object') return 0;
  if (kind === 'care' && Array.isArray(data.items)) return data.items.length;
  if (kind === 'installment' && Array.isArray(data.columns)) return data.columns.length;
  return Object.keys(data).length;
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : 'ping';
  if (action === 'syncLeads') {
    return jsonResponse({ ok: false, error: '보안 정책상 고객 DB는 관리자 PIN이 포함된 POST 요청으로만 조회할 수 있습니다.' });
  }
  const sidParam = (e && e.parameter && e.parameter.sid) ? String(e.parameter.sid).trim() : '';
  // 무인증 GET 요청에서는 ScriptProperties의 시트 ID를 절대 덮어쓰지 않음(allowPersist = false)
  const ctx = resolveSpreadsheetContext(sidParam, false);
  if (!ctx.ss) {
    return jsonResponse({ ok: false, needsSpreadsheetId: true, error: ctx.error });
  }
  const ss = ctx.ss;
  const role = (e && e.parameter && e.parameter.role) ? String(e.parameter.role).trim() : '';
  const dt = (e && e.parameter && e.parameter.dt) ? String(e.parameter.dt).trim() : '';

  if (action === 'getDataset') {
    const kind = String((e.parameter && e.parameter.kind) || '').trim();
    if (!TAB_MAP[kind]) return jsonResponse({ ok: false, error: '지원하지 않는 kind입니다: ' + kind });

    if (role === 'friend') {
      if (kind === 'schedule') {
        return jsonResponse({ ok: false, forbidden: true, error: '외부 공유 기기에서는 휴무표를 조회할 수 없습니다.', data: {} });
      }
      const friendStore = readAllFriendInviteRows(ss);
      const matched = friendStore.records.find(function(rec) {
        const tokens = parseTokenList(rec.boundDeviceToken);
        return dt && tokens.indexOf(dt) !== -1;
      });
      if (!matched || matched.status !== 'BOUND') {
        return jsonResponse({ ok: false, revoked: true, valid: false, error: '접근 권한이 차단되었거나 만료된 기기입니다.' });
      }
    }

    const result = readKindDataset(ss, kind);
    return jsonResponse({ ok: true, kind: kind, updatedAt: result.updatedAt, data: result.data });
  }
  if (action === 'getAll') {
    if (role === 'friend') {
      return jsonResponse({ ok: false, forbidden: true, error: '허용되지 않는 요청입니다.' });
    }
    const datasets = {};
    Object.keys(TAB_MAP).forEach(function(k) {
      datasets[k] = readKindDataset(ss, k);
    });
    return jsonResponse({ ok: true, datasets: datasets });
  }
  const summary = {};
  Object.keys(TAB_MAP).forEach(function(k) {
    if (role === 'friend' && k === 'schedule') return;
    const s = ss.getSheetByName(TAB_MAP[k]);
    summary[k] = (s && s.getLastRow() >= 2) ? formatCellDate(s.getRange(2, 4).getValue()) || '저장됨' : '비어있음';
  });
  return jsonResponse({
    ok: true,
    status: 'connected',
    store: '롯데하이마트',
    bindingMode: ctx.mode,
    spreadsheetTitle: role === 'friend' ? '스마트상담 클라우드 연동됨' : ss.getName(),
    summary: summary
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = String(body.action || 'saveDataset');
    const reqSid = body.spreadsheetId ? String(body.spreadsheetId).trim() : '';

    // 1차로 영속 저장 없이 대상 시트를 열어 PIN을 먼저 검증한 뒤에만 시트 ID를 영속 저장
    const ctx = resolveSpreadsheetContext(reqSid, false);

    // 인스타 광고 고객 DB 연동 (syncLeads / saveBackupState) — 기존 기능 100% 보존
    if (action === 'syncLeads' || action === 'saveBackupState') {
      const instaSs = resolveInstaSpreadsheet(body.instaSpreadsheetId || '', false);
      const pinCheckTarget = ctx.ss || instaSs;
      const pinCheck = verifyOrInitPin(pinCheckTarget, body.pin);
      if (!pinCheck.ok) {
        Utilities.sleep(300);
        return jsonResponse({ ok: false, error: pinCheck.error });
      }
      if (body.instaSpreadsheetId) {
        resolveInstaSpreadsheet(body.instaSpreadsheetId, true);
      }
      const finalInstaSs = instaSs || ctx.ss;
      if (!finalInstaSs) {
        return jsonResponse({ ok: false, error: '연결된 인스타 고객 DB 구글 시트를 찾을 수 없습니다. 인스타 DB 설정에서 시트 주소를 확인해 주세요.' });
      }
      if (action === 'saveBackupState') {
        if (body.backupState) {
          writeInstaBackup(finalInstaSs, body.backupState);
        }
        return jsonResponse({ ok: true });
      }
      const sheets = finalInstaSs.getSheets();
      const outSheets = [];
      for (let i = 0; i < sheets.length; i++) {
        const sh = sheets[i];
        const name = sh.getName();
        if (name === BACKUP_SHEET_NAME || name === FRIEND_ACCESS_TAB || name === GUIDE_TAB || name.indexOf('_') === 0) continue;
        if (sh.getLastRow() < 2 || sh.getLastColumn() < 2) continue;
        outSheets.push({ name: name, rows: sh.getDisplayValues() });
      }
      const backupState = readInstaBackup(finalInstaSs);
      return jsonResponse({ ok: true, sheets: outSheets, backupState: backupState });
    }

    if (!ctx.ss) {
      return jsonResponse({ ok: false, needsSpreadsheetId: true, error: ctx.error });
    }
    const ss = ctx.ss;

    if (action === 'diagnoseCloudSync') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const friendStore = readAllFriendInviteRows(ss);
      const boundCount = friendStore.records.filter(function(r) { return r.status === 'BOUND'; }).length;
      const sharedCfg = readSharedGeminiConfig();
      const datasets = {};
      Object.keys(TAB_MAP).forEach(function(k) {
        const res = readKindDataset(ss, k);
        const exists = res.data !== null && res.data !== undefined;
        datasets[k] = {
          exists: exists,
          updatedAt: res.updatedAt || '',
          chunks: res.chunks || 0,
          bytes: res.bytes || 0,
          validJson: !res.parseError,
          itemCount: exists ? countDatasetItems(k, res.data) : 0
        };
      });
      return jsonResponse({
        ok: true,
        bindingMode: ctx.mode,
        spreadsheetId: ss.getId(),
        spreadsheetTitle: ss.getName(),
        inviteCount: friendStore.records.length,
        boundInviteCount: boundCount,
        sharedAi: toPublicSharedAiMeta(sharedCfg),
        datasets: datasets
      });
    }

    if (action === 'saveSharedGeminiConfig') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const props = PropertiesService.getScriptProperties();
      const current = readSharedGeminiConfig();

      if (body.clearKey === true) {
        props.deleteProperty('SHARED_GEMINI_API_KEY');
        props.setProperty('SHARED_GEMINI_ENABLED', 'false');
      } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
        props.setProperty('SHARED_GEMINI_API_KEY', body.apiKey.trim());
      }

      if (typeof body.globalEnabled === 'boolean' && body.clearKey !== true) {
        props.setProperty('SHARED_GEMINI_ENABLED', body.globalEnabled ? 'true' : 'false');
      }

      if (body.friendCodeId && typeof body.friendAiAllowed === 'boolean') {
        const nextMap = current.friendAiMap || {};
        nextMap[String(body.friendCodeId).trim()] = body.friendAiAllowed;
        props.setProperty('SHARED_GEMINI_FRIEND_MAP', JSON.stringify(nextMap));
      }

      const updatedCfg = readSharedGeminiConfig();
      const store = readAllFriendInviteRows(ss);
      return jsonResponse({
        ok: true,
        sharedAi: toPublicSharedAiMeta(updatedCfg),
        items: store.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, updatedCfg.friendAiMap);
        })
      });
    }

    if (action === 'getFriendSharedGeminiKey') {
      const deviceToken = String(body.deviceToken || '').trim();
      const codeId = String(body.codeId || '').trim();
      if (!deviceToken) {
        return jsonResponse({ ok: true, aiEnabled: false, sharedApiKey: '', revoked: true });
      }
      const store = readAllFriendInviteRows(ss);
      const matched = store.records.find(function(r) {
        if (codeId && r.codeId === codeId) return true;
        return parseTokenList(r.boundDeviceToken).indexOf(deviceToken) !== -1;
      });
      if (!matched || matched.status !== 'BOUND' || parseTokenList(matched.boundDeviceToken).indexOf(deviceToken) === -1) {
        return jsonResponse({ ok: true, aiEnabled: false, sharedApiKey: '', revoked: true });
      }
      const resolved = resolveFriendSharedKeyPayload(matched.codeId, matched.status);
      return jsonResponse({
        ok: true,
        aiEnabled: resolved.aiEnabled,
        sharedApiKey: resolved.sharedApiKey,
        revoked: false
      });
    }

    if (action === 'authenticateDevice') {
      const credential = String(body.credential || '').replace(/[\\s-]+/g, '').trim();
      const deviceToken = String(body.deviceToken || '').trim();
      const userAgent = String(body.userAgent || '').slice(0, 180);
      if (!credential) {
        return jsonResponse({ ok: false, error: '보안 코드 또는 8자리 초대코드를 입력해 주세요.' });
      }
      const savedPin = readSavedAdminPin(ss);
      if (savedPin && credential === savedPin) {
        return jsonResponse({ ok: true, role: 'staff' });
      }

      const store = readAllFriendInviteRows(ss);
      const found = store.records.find(function(r) {
        return r.inviteCode === credential;
      });
      if (!found) {
        return jsonResponse({ ok: false, error: '보안 코드가 일치하지 않습니다. 전달받은 8자리 코드를 확인해 주세요.' });
      }
      if (found.status === 'REVOKED') {
        return jsonResponse({ ok: false, revoked: true, error: '관리자에 의해 접근이 차단된 초대 코드입니다.' });
      }
      if (!deviceToken || deviceToken.length < 16) {
        return jsonResponse({ ok: false, error: '기기 고유 식별 토큰을 확인할 수 없습니다.' });
      }

      const nowStr = nowKstLabel();
      const boundTokens = parseTokenList(found.boundDeviceToken);

      if (boundTokens.indexOf(deviceToken) !== -1) {
        store.sheet.getRange(found.rowNumber, 4).setValue('BOUND');
        store.sheet.getRange(found.rowNumber, 10).setValue("'" + nowStr);
        SpreadsheetApp.flush();
        const aiPayload = resolveFriendSharedKeyPayload(found.codeId, 'BOUND');
        return jsonResponse({
          ok: true,
          role: 'friend',
          codeId: found.codeId,
          label: found.label,
          verifiedAt: new Date().toISOString(),
          aiEnabled: aiPayload.aiEnabled,
          sharedApiKey: aiPayload.sharedApiKey
        });
      }

      if (boundTokens.length < found.maxDevices) {
        const nextTokens = boundTokens.concat([deviceToken]).join(',');
        const nextUa = [found.boundUserAgent, userAgent]
          .filter(function(s) { return Boolean(String(s || '').trim()); })
          .join(' | ')
          .slice(0, 380);
        store.sheet.getRange(found.rowNumber, 4, 1, 7).setValues([[
          'BOUND',
          found.maxDevices,
          nextTokens,
          nextUa,
          "'" + (found.createdAt || nowStr),
          "'" + (found.boundAt || nowStr),
          "'" + nowStr
        ]]);
        SpreadsheetApp.flush();
        const aiPayload = resolveFriendSharedKeyPayload(found.codeId, 'BOUND');
        return jsonResponse({
          ok: true,
          role: 'friend',
          codeId: found.codeId,
          label: found.label,
          verifiedAt: new Date().toISOString(),
          aiEnabled: aiPayload.aiEnabled,
          sharedApiKey: aiPayload.sharedApiKey
        });
      }

      return jsonResponse({
        ok: false,
        codeAlreadyUsed: true,
        error: '허용된 기기 대수(' + found.maxDevices + '대)가 모두 등록된 코드입니다. PC 등 추가 기기 등록이 필요하면 관리자에게 허용 기기수 변경을 요청해 주세요.'
      });
    }

    if (action === 'verifyFriendSession') {
      const deviceToken = String(body.deviceToken || '').trim();
      const codeId = String(body.codeId || '').trim();
      if (!deviceToken) {
        return jsonResponse({ ok: true, valid: false, revoked: true });
      }
      const store = readAllFriendInviteRows(ss);
      const matched = store.records.find(function(r) {
        if (codeId && r.codeId === codeId) return true;
        return parseTokenList(r.boundDeviceToken).indexOf(deviceToken) !== -1;
      });
      if (!matched || matched.status !== 'BOUND' || parseTokenList(matched.boundDeviceToken).indexOf(deviceToken) === -1) {
        return jsonResponse({ ok: true, valid: false, revoked: true });
      }
      const nowStr = nowKstLabel();
      if (!matched.lastSeenAt || matched.lastSeenAt.slice(0, 15) !== nowStr.slice(0, 15)) {
        store.sheet.getRange(matched.rowNumber, 10).setValue("'" + nowStr);
        SpreadsheetApp.flush();
      }
      const aiPayload = resolveFriendSharedKeyPayload(matched.codeId, matched.status);
      return jsonResponse({
        ok: true,
        valid: true,
        revoked: false,
        codeId: matched.codeId,
        label: matched.label,
        aiEnabled: aiPayload.aiEnabled,
        sharedApiKey: aiPayload.sharedApiKey
      });
    }

    if (action === 'listFriendInvites') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const sharedCfg = readSharedGeminiConfig();
      const store = readAllFriendInviteRows(ss);
      const items = store.records.slice().reverse().map(function(r) {
        return toClientFriendItem(r, sharedCfg.friendAiMap);
      });
      return jsonResponse({
        ok: true,
        items: items,
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action === 'issueFriendInvite') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const label = String(body.label || '').trim() || '친구1';
      const maxDevices = Math.max(1, Math.min(5, Math.floor(Number(body.maxDevices) || 1)));
      const savedPin = readSavedAdminPin(ss);
      const sharedCfg = readSharedGeminiConfig();
      const store = readAllFriendInviteRows(ss);
      const existingCodes = {};
      store.records.forEach(function(r) { existingCodes[r.inviteCode] = true; });
      let inviteCode = '';
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = String(Math.floor(10000000 + Math.random() * 90000000));
        if (!existingCodes[candidate] && candidate !== savedPin) {
          inviteCode = candidate;
          break;
        }
      }
      if (!inviteCode) {
        return jsonResponse({ ok: false, error: '초대코드 생성에 실패했습니다. 다시 시도해 주세요.' });
      }
      const codeId = 'INV-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      const nowStr = nowKstLabel();
      store.sheet.appendRow([codeId, "'" + inviteCode, label, 'ACTIVE', maxDevices, '', '', "'" + nowStr, '', '']);
      SpreadsheetApp.flush();
      const updated = readAllFriendInviteRows(ss);
      const createdRec = updated.records.find(function(r) { return r.codeId === codeId; });
      return jsonResponse({
        ok: true,
        item: createdRec ? toClientFriendItem(createdRec, sharedCfg.friendAiMap) : {
          codeId: codeId,
          inviteCode: inviteCode,
          label: label,
          status: 'ACTIVE',
          maxDevices: maxDevices,
          boundDeviceCount: 0,
          aiAllowed: true,
          createdAt: nowStr,
          boundAt: '',
          lastSeenAt: ''
        },
        items: updated.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, sharedCfg.friendAiMap);
        }),
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action === 'updateFriendInviteStatus') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const codeId = String(body.codeId || '').trim();
      const mode = String(body.mode || '').trim();
      const store = readAllFriendInviteRows(ss);
      const target = store.records.find(function(r) { return r.codeId === codeId; });
      if (!target) {
        return jsonResponse({ ok: false, error: '대상 초대코드를 찾을 수 없습니다.' });
      }
      if (mode === 'delete') {
        store.sheet.deleteRow(target.rowNumber);
      } else if (mode === 'revoke') {
        store.sheet.getRange(target.rowNumber, 4).setValue('REVOKED');
      } else if (mode === 'reset_device') {
        store.sheet.getRange(target.rowNumber, 4).setValue('ACTIVE');
        store.sheet.getRange(target.rowNumber, 6, 1, 2).setValues([['', '']]);
        store.sheet.getRange(target.rowNumber, 9, 1, 2).setValues([['', '']]);
      } else if (mode === 'activate') {
        const nextStatus = parseTokenList(target.boundDeviceToken).length > 0 ? 'BOUND' : 'ACTIVE';
        store.sheet.getRange(target.rowNumber, 4).setValue(nextStatus);
      } else if (mode === 'set_max_devices') {
        const nextMax = Math.max(1, Math.min(5, Math.floor(Number(body.maxDevices) || 1)));
        store.sheet.getRange(target.rowNumber, 5).setValue(nextMax);
      } else {
        return jsonResponse({ ok: false, error: '지원하지 않는 상태 변경 모드입니다: ' + mode });
      }
      SpreadsheetApp.flush();
      const sharedCfg = readSharedGeminiConfig();
      const updated = readAllFriendInviteRows(ss);
      return jsonResponse({
        ok: true,
        items: updated.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, sharedCfg.friendAiMap);
        }),
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action !== 'saveDataset') {
      return jsonResponse({ ok: false, error: '지원하지 않는 action입니다: ' + action });
    }
    const kind = String(body.kind || '').trim();
    if (!TAB_MAP[kind]) {
      return jsonResponse({ ok: false, error: '지원하지 않는 데이터 종류입니다: ' + kind });
    }
    const pinCheck = verifyOrInitPin(ss, body.pin);
    if (!pinCheck.ok) {
      return jsonResponse({ ok: false, error: pinCheck.error });
    }
    if (reqSid) resolveSpreadsheetContext(reqSid, true);
    const serialized = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.data || {});
    const chunks = [];
    for (let i = 0; i < serialized.length; i += CHUNK_SIZE) {
      chunks.push(serialized.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('{}');
    const nowIso = new Date().toISOString();
    const sheet = ensureSheet(ss, TAB_MAP[kind]);
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
    }
    const rows = chunks.map(function(chunk, idx) {
      return [kind, idx + 1, chunks.length, nowIso, chunk];
    });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    SpreadsheetApp.flush();
    return jsonResponse({
      ok: true,
      kind: kind,
      chunks: chunks.length,
      bytes: serialized.length,
      updatedAt: nowIso,
      pinInitialized: pinCheck.initialized
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}`;
}

// 앱 시작 시 자동 부트스트랩 및 fetch 브릿지 즉시 활성화
bootstrapCloudConfigFromUrl();
bootstrapInviteFromUrl();
installStoreCloudFetchBridge();
