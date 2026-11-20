// ============================================================================
// 롯데하이마트 경기광주점 — 비공개 구글 시트(Apps Script) 전용 클라우드 동기화 브릿지
// 목적:
// 1) 월간 휴무표·모델별 수당단가표·안심케어 조견표·무이자할부를 GitHub에 커밋하지 않고
//    비공개 구글 시트(Apps Script 웹앱)로만 저장·불러오기 수행 (깃허브 민감정보 노출 0% 보장)
// 2) 기존 ScheduleModal · CareTableView · CardInstallmentModal · settlementSheetParser의
//    api.github.com 및 정적 *-data.json 요청을 투명하게 가로채어 구글 시트로 중계
// 3) ?cloud=... 원클릭 자동연결 파라미터 지원 (직원 단톡방 공유 시 PIN 제외 URL만 전달)
// ============================================================================

export type StoreCloudKind = 'schedule' | 'incentive' | 'care' | 'installment';

export interface StoreCloudRawConfig {
  repo: string;
  branch: string;
  token: string;
}

export const STORE_CLOUD_CONFIG_KEY = 'himart_care_gh_sync_config_v1';
export const OWNER_CUSTOM_PIN_STORAGE_KEY = 'himart_gj_owner_db_pin_v1';
export const STORE_CLOUD_UPDATED_EVENT = 'himart_gj_store_cloud_updated';
export const UNCONFIGURED_PIN_SENTINEL = '__HIMART_CLOUD_PIN_REQUIRED__';

const DATA_FILE_RE =
  /(?:^|[/.])(schedule|model-incentive|care-table|card-installment)-data\.json(?:$|[?#])/i;

function mapFileSlugToKind(slug: string): StoreCloudKind {
  const lower = slug.toLowerCase();
  if (lower === 'schedule') return 'schedule';
  if (lower === 'model-incentive') return 'incentive';
  if (lower === 'care-table') return 'care';
  return 'installment';
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
      const sep = gasUrl.includes('?') ? '&' : '?';
      const targetUrl = `${gasUrl}${sep}action=getDataset&kind=${encodeURIComponent(
        kind
      )}&_t=${Date.now()}`;
      const res = await getNativeFetch()(targetUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
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
  configOverride?: Partial<StoreCloudRawConfig>
): Promise<{ ok: boolean; configured: boolean; message: string }> {
  const saved = readRawSyncConfig();
  const rawRepo = (configOverride?.repo ?? saved.repo ?? '').trim();
  const gasUrl = normalizeGasWebAppUrl(rawRepo);
  const pin = (configOverride?.token ?? saved.token ?? '').trim();

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

  const serialized =
    typeof payloadData === 'string' ? payloadData : JSON.stringify(payloadData ?? {});

  try {
    const res = await getNativeFetch()(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveDataset',
        kind,
        pin,
        payload: serialized,
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
      return {
        ok: false,
        configured: true,
        message: String(json?.error || '구글 시트 저장 실패: 업로드 비밀번호(PIN)를 확인해 주세요.'),
      };
    }

    try {
      const parsedForCache =
        typeof payloadData === 'string' ? JSON.parse(payloadData) : payloadData;
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
      if (cloudData !== null) {
        return jsonHttpResponse(cloudData, 200);
      }
      const fallback = getEmptyFallbackForKind(kind);
      if (fallback === null) {
        return jsonHttpResponse({ message: 'No cloud dataset yet' }, 404);
      }
      return jsonHttpResponse(fallback, 200);
    }

    // 정적 ./schedule-data.json, ./model-incentive-data.json, ./care-table-data.json, ./card-installment-data.json 요청 중계
    const cloudData = await fetchStoreCloudDataset(kind);
    if (cloudData !== null) {
      return jsonHttpResponse(cloudData, 200);
    }
    return rawFetch(input, init);
  };
}

export function getStoreCloudAppsScriptCode(): string {
  return `const TAB_MAP = {
  schedule: '_매장공유_휴무표',
  incentive: '_매장공유_수당단가표',
  care: '_매장공유_안심케어',
  installment: '_매장공유_무이자할부'
};
const GUIDE_TAB = '00_연동가이드_및_AppsScript코드';
const CHUNK_SIZE = 40000;

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, 5).setValues([['데이터종류', '청크번호', '전체청크수', '최종업데이트', 'JSON데이터조각']]);
  }
  return sheet;
}

function readKindDataset(ss, kind) {
  const tabName = TAB_MAP[kind];
  if (!tabName) return { updatedAt: '', data: null };
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return { updatedAt: '', data: null };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const validRows = rows.filter(r => String(r[0]) === kind && r[4] !== '');
  if (!validRows.length) return { updatedAt: '', data: null };
  validRows.sort((a, b) => Number(a[1]) - Number(b[1]));
  const updatedAt = String(validRows[0][3] || '');
  const joined = validRows.map(r => String(r[4])).join('');
  try {
    return { updatedAt: updatedAt, data: JSON.parse(joined) };
  } catch (err) {
    return { updatedAt: updatedAt, data: null, parseError: String(err) };
  }
}

function verifyOrInitPin(ss, inputPin) {
  const cleanInput = String(inputPin || '').trim();
  if (!cleanInput) return { ok: false, error: '업로드 비밀번호(PIN)를 입력해 주세요.' };
  const guide = ss.getSheetByName(GUIDE_TAB);
  const props = PropertiesService.getScriptProperties();
  let savedPin = '';
  if (guide) {
    savedPin = String(guide.getRange('B3').getValue() || '').trim();
    if (savedPin.indexOf('비워둠') !== -1) savedPin = '';
  }
  if (!savedPin) {
    savedPin = String(props.getProperty('ADMIN_PIN') || '').trim();
  }
  if (!savedPin) {
    props.setProperty('ADMIN_PIN', cleanInput);
    if (guide) guide.getRange('B3').setValue(cleanInput);
    return { ok: true, initialized: true };
  }
  if (savedPin !== cleanInput) {
    return { ok: false, error: '관리자 업로드 비밀번호(PIN)가 일치하지 않습니다.' };
  }
  return { ok: true, initialized: false };
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : 'ping';
  if (action === 'getDataset') {
    const kind = String((e.parameter && e.parameter.kind) || '').trim();
    if (!TAB_MAP[kind]) return jsonResponse({ ok: false, error: '지원하지 않는 kind입니다: ' + kind });
    const result = readKindDataset(ss, kind);
    return jsonResponse({ ok: true, kind: kind, updatedAt: result.updatedAt, data: result.data });
  }
  if (action === 'getAll') {
    const datasets = {};
    Object.keys(TAB_MAP).forEach(function(k) {
      datasets[k] = readKindDataset(ss, k);
    });
    return jsonResponse({ ok: true, datasets: datasets });
  }
  const summary = {};
  Object.keys(TAB_MAP).forEach(function(k) {
    const s = ss.getSheetByName(TAB_MAP[k]);
    summary[k] = (s && s.getLastRow() >= 2) ? String(s.getRange(2, 4).getValue() || '저장됨') : '비어있음';
  });
  return jsonResponse({ ok: true, status: 'connected', store: '롯데하이마트 경기광주점', summary: summary });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = String(body.action || 'saveDataset');
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
installStoreCloudFetchBridge();
