// ============================================================================
// 외부 지인(친구) 전용 1회용 8자리 초대코드 · 1기기 영구 귀속 · 원격 차단 보안 가드
// - 비공개 구글 시트(_친구기기_접근관리) 서버 검증 연동
// - localStorage + IndexedDB 이중 기기 고유 토큰(deviceToken) 영속화
// - 친구 세션 시 경기광주점 휴무표 및 오너 전용 기능 로컬 흔적 즉시 소거
// ============================================================================

export const FRIEND_SESSION_STORAGE_KEY = 'himart_friend_session_v1';
export const FRIEND_DEVICE_TOKEN_KEY = 'himart_friend_device_token_v1';
export const FRIEND_DEVICE_REVOKED_KEY = 'himart_friend_revoked_v1';
export const PENDING_INVITE_PROMPT_KEY = 'himart_pending_invite_prompt_v1';
export const FRIEND_ROLE_CHANGED_EVENT = 'himart_friend_role_changed';

const INTERNAL_CLOUD_CONFIG_KEY = 'himart_care_gh_sync_config_v1';
const INTERNAL_CLOUD_UPDATED_EVENT = 'himart_gj_store_cloud_updated';
const INTERNAL_STAFF_VERIFIED_V2_KEY = 'himart_staff_verified_gate_v2';
const INTERNAL_STAFF_TRUSTED_DEVICE_KEY = 'himart_staff_trusted_device_v1';
const INTERNAL_CUSTOMER_VIEWER_ONLY_KEY = 'himart_customer_viewer_only_v1';
const INTERNAL_CUSTOMER_TAB_LOCK_KEY = 'himart_customer_tab_lock_v1';

const IDB_NAME = 'himart_device_auth_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'tokens';

export interface FriendSessionRecord {
  role: 'friend';
  deviceToken: string;
  codeId: string;
  label: string;
  verifiedAt: string;
}

export type FriendInviteStatus = 'ACTIVE' | 'BOUND' | 'REVOKED';

export interface FriendInviteItem {
  codeId: string;
  inviteCode: string;
  label: string;
  status: FriendInviteStatus;
  maxDevices: number;
  boundDevicePreview?: string;
  boundUserAgent?: string;
  createdAt: string;
  boundAt: string;
  lastSeenAt: string;
}

export interface AuthenticateDeviceResult {
  ok: boolean;
  role?: 'staff' | 'friend';
  codeId?: string;
  label?: string;
  codeAlreadyUsed?: boolean;
  revoked?: boolean;
  error?: string;
}

function isValidGasUrl(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)/i.test(s) ||
    /^https:\/\/script\.googleusercontent\.com\//i.test(s) ||
    /^http:\/\/localhost(?::\d+)?\//i.test(s) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?\//i.test(s)
  ) {
    return s;
  }
  return '';
}

function encodeB64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeB64UrlUtf8(token: string): string {
  let b64 = String(token || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const cleaned = b64.replace(/\s+/g, '');
  if (!cleaned) return '';
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function readStoredCloudRepo(): { repo: string; branch: string; token: string } {
  if (typeof localStorage === 'undefined') {
    return { repo: '', branch: 'main', token: '' };
  }
  try {
    const raw = localStorage.getItem(INTERNAL_CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        repo: String(parsed?.repo || '').trim(),
        branch: String(parsed?.branch || 'main').trim() || 'main',
        token: String(parsed?.token || '').trim(),
      };
    }
  } catch {
    // ignore parse error
  }
  return { repo: '', branch: 'main', token: '' };
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function generateRandomDeviceTokenHex(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  let fallback = '';
  for (let i = 0; i < 48; i++) {
    fallback += Math.floor(Math.random() * 16).toString(16);
  }
  return fallback;
}

function isValidDeviceToken(candidate?: string | null): candidate is string {
  const s = String(candidate || '').trim();
  return /^[0-9a-f]{32,128}$/i.test(s);
}

function openAuthTokenDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        } catch {
          // ignore
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        finish(req.result);
      };
      req.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        finish(null);
      };
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

async function readDeviceTokenFromIdb(): Promise<string> {
  const db = await openAuthTokenDb();
  if (!db) return '';
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string) => {
      if (settled) return;
      settled = true;
      try {
        db.close();
      } catch {
        // ignore
      }
      resolve(val);
    };
    const timer = setTimeout(() => finish(''), 1200);
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const getReq = store.get(FRIEND_DEVICE_TOKEN_KEY);
      getReq.onsuccess = () => {
        clearTimeout(timer);
        const val = typeof getReq.result === 'string' ? getReq.result.trim() : '';
        finish(val);
      };
      getReq.onerror = () => {
        clearTimeout(timer);
        finish('');
      };
    } catch {
      clearTimeout(timer);
      finish('');
    }
  });
}

async function writeDeviceTokenToIdb(token: string): Promise<void> {
  const db = await openAuthTokenDb();
  if (!db) return;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        db.close();
      } catch {
        // ignore
      }
      resolve();
    };
    const timer = setTimeout(finish, 1200);
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(token, FRIEND_DEVICE_TOKEN_KEY);
      tx.oncomplete = () => {
        clearTimeout(timer);
        finish();
      };
      tx.onerror = () => {
        clearTimeout(timer);
        finish();
      };
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

/**
 * 기기 고유 토큰 이중 영속화 (localStorage + IndexedDB 상호 복구)
 */
export async function getOrCreateDeviceBindingToken(): Promise<string> {
  let lsToken = '';
  try {
    if (typeof localStorage !== 'undefined') {
      lsToken = (localStorage.getItem(FRIEND_DEVICE_TOKEN_KEY) || '').trim();
    }
  } catch {
    lsToken = '';
  }

  const idbToken = await readDeviceTokenFromIdb();

  if (isValidDeviceToken(lsToken)) {
    if (idbToken !== lsToken) {
      await writeDeviceTokenToIdb(lsToken);
    }
    return lsToken;
  }

  if (isValidDeviceToken(idbToken)) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FRIEND_DEVICE_TOKEN_KEY, idbToken);
      }
    } catch {
      // ignore
    }
    return idbToken;
  }

  const existingSession = readFriendSession();
  if (existingSession && isValidDeviceToken(existingSession.deviceToken)) {
    const recovered = existingSession.deviceToken.trim();
    try {
      localStorage.setItem(FRIEND_DEVICE_TOKEN_KEY, recovered);
    } catch {
      // ignore
    }
    await writeDeviceTokenToIdb(recovered);
    return recovered;
  }

  const freshToken = generateRandomDeviceTokenHex();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FRIEND_DEVICE_TOKEN_KEY, freshToken);
    }
  } catch {
    // ignore
  }
  await writeDeviceTokenToIdb(freshToken);
  return freshToken;
}

/**
 * 초대 전용 링크(?invite=<base64url(gasUrl)>) 생성
 */
export function buildFriendInviteUrl(rawGasUrl?: string): string {
  const gasUrl = isValidGasUrl(rawGasUrl ?? readStoredCloudRepo().repo);
  if (!gasUrl) return '';
  const encoded = encodeB64UrlUtf8(gasUrl);
  if (typeof window === 'undefined' || !window.location) {
    return `https://himart-gj.github.io/himart-gguk2/?invite=${encoded}`;
  }
  const cleanPath = window.location.pathname.replace(/\/index\.html$/i, '/');
  const base = `${window.location.origin}${cleanPath}`;
  return `${base}?invite=${encoded}`;
}

/**
 * URL 쿼리 ?invite=<base64url(gasUrl)> 감지 시 repo 설정만 저장하고
 * 입력창 즉시 오픈 플래그 기록 후 주소창에서 ?invite 파라미터를 즉시 소거
 */
export function bootstrapInviteFromUrl(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const rawInvite = (params.get('invite') || '').trim();
    if (!rawInvite) return false;

    let candidateUrl = isValidGasUrl(rawInvite);
    if (!candidateUrl) {
      try {
        const decoded = decodeB64UrlUtf8(rawInvite).trim();
        if (decoded.startsWith('{')) {
          const obj = JSON.parse(decoded);
          candidateUrl = isValidGasUrl(obj?.url || obj?.repo || '');
        } else {
          candidateUrl = isValidGasUrl(decoded);
        }
      } catch {
        candidateUrl = '';
      }
    }

    // 유효하지 않은 값이라도 주소창의 invite 쿼리는 깔끔히 소거
    params.delete('invite');
    const rest = params.toString();
    const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash || ''}`;
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState({}, '', cleanUrl);
    }

    if (!candidateUrl) return false;

    const prev = readStoredCloudRepo();
    const nextCfg = {
      repo: candidateUrl,
      branch: prev.branch || 'main',
      token: prev.token || '',
    };
    localStorage.setItem(INTERNAL_CLOUD_CONFIG_KEY, JSON.stringify(nextCfg));

    try {
      sessionStorage.setItem(PENDING_INVITE_PROMPT_KEY, '1');
      sessionStorage.removeItem(INTERNAL_CUSTOMER_TAB_LOCK_KEY);
    } catch {
      // ignore
    }

    window.dispatchEvent(new CustomEvent(INTERNAL_CLOUD_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function readFriendSession(): FriendSessionRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (localStorage.getItem(FRIEND_DEVICE_REVOKED_KEY) === '1') {
      return null;
    }
    const raw = localStorage.getItem(FRIEND_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.role === 'friend' &&
      typeof parsed.deviceToken === 'string' &&
      parsed.deviceToken.trim().length > 0
    ) {
      return {
        role: 'friend',
        deviceToken: parsed.deviceToken.trim(),
        codeId: String(parsed.codeId || '').trim(),
        label: String(parsed.label || '외부지인').trim(),
        verifiedAt: String(parsed.verifiedAt || '').trim(),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function isFriendRestrictedMode(): boolean {
  return readFriendSession() !== null;
}

/**
 * 친구 세션에서 경기광주점 근무·휴무표 캐시 및 오너 전용 권한 흔적 원천 소거
 */
export function purgeLocalScheduleAndOwnerState(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem('himart_gj_schedules_v4');
    localStorage.removeItem('himart_gj_schedules_v5');
    localStorage.removeItem('himart_gj_user_name');
    localStorage.removeItem('himart_gj_my_name');
    localStorage.removeItem('himart_gj_owner_db_unlocked_v1');
    localStorage.removeItem('himart_gj_admin_unlocked');
  } catch {
    // ignore
  }
}

/**
 * 서버 측 차단(revoked) 감지 시 로컬 친구 세션 즉시 회수 및 게이트 강제 복귀
 */
export function revokeLocalFriendAccess(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FRIEND_DEVICE_REVOKED_KEY, '1');
    localStorage.removeItem(FRIEND_SESSION_STORAGE_KEY);
    localStorage.removeItem(INTERNAL_STAFF_VERIFIED_V2_KEY);
    localStorage.removeItem(INTERNAL_STAFF_TRUSTED_DEVICE_KEY);
    purgeLocalScheduleAndOwnerState();
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
  }
}

/**
 * 클라우드 서버로 기기 인증 요청 (관리자 PIN -> 'staff', 8자리 초대코드 -> 'friend' 1기기 귀속)
 */
export async function authenticateDeviceWithCloud(
  rawCredential: string
): Promise<AuthenticateDeviceResult> {
  const credential = String(rawCredential || '')
    .replace(/[\s-]+/g, '')
    .trim();
  if (!credential) {
    return {
      ok: false,
      error: '보안 코드 또는 8자리 초대코드를 입력해 주세요.',
    };
  }

  const gasUrl = isValidGasUrl(readStoredCloudRepo().repo);
  if (!gasUrl) {
    return {
      ok: false,
      error: '연결된 매장 보안 서버 정보가 없습니다. 전달받은 전용 초대 링크로 다시 접속해 주세요.',
    };
  }

  const deviceToken = await getOrCreateDeviceBindingToken();

  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'authenticateDevice',
        credential,
        deviceToken,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `보안 서버 응답 오류 (${res.status}): 잠시 후 다시 시도해 주세요.`,
      };
    }

    const json = await res.json();

    if (json?.ok && json.role === 'staff') {
      try {
        localStorage.removeItem(FRIEND_SESSION_STORAGE_KEY);
        localStorage.removeItem(FRIEND_DEVICE_REVOKED_KEY);
        localStorage.removeItem(INTERNAL_CUSTOMER_VIEWER_ONLY_KEY);
        localStorage.setItem(INTERNAL_STAFF_VERIFIED_V2_KEY, '1');
        localStorage.setItem(INTERNAL_STAFF_TRUSTED_DEVICE_KEY, '1');
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(INTERNAL_CUSTOMER_TAB_LOCK_KEY);
          sessionStorage.removeItem(PENDING_INVITE_PROMPT_KEY);
        }
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
      }
      return { ok: true, role: 'staff' };
    }

    if (json?.ok && json.role === 'friend') {
      const session: FriendSessionRecord = {
        role: 'friend',
        deviceToken,
        codeId: String(json.codeId || '').trim(),
        label: String(json.label || '외부지인').trim(),
        verifiedAt: String(json.verifiedAt || new Date().toISOString()),
      };
      try {
        localStorage.setItem(FRIEND_SESSION_STORAGE_KEY, JSON.stringify(session));
        localStorage.removeItem(FRIEND_DEVICE_REVOKED_KEY);
        localStorage.removeItem(INTERNAL_CUSTOMER_VIEWER_ONLY_KEY);
        localStorage.removeItem(INTERNAL_STAFF_TRUSTED_DEVICE_KEY);
        localStorage.setItem(INTERNAL_STAFF_VERIFIED_V2_KEY, '1');
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(INTERNAL_CUSTOMER_TAB_LOCK_KEY);
          sessionStorage.removeItem(PENDING_INVITE_PROMPT_KEY);
        }
      } catch {
        // ignore
      }
      purgeLocalScheduleAndOwnerState();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
      }
      return {
        ok: true,
        role: 'friend',
        codeId: session.codeId,
        label: session.label,
      };
    }

    return {
      ok: false,
      codeAlreadyUsed: Boolean(json?.codeAlreadyUsed),
      revoked: Boolean(json?.revoked),
      error: String(
        json?.error || '보안 코드가 일치하지 않거나 사용할 수 없는 코드입니다.'
      ),
    };
  } catch {
    return {
      ok: false,
      error: '보안 서버와 통신할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    };
  }
}

/**
 * 친구 세션 백그라운드 유효성/차단 여부 확인 (일시적 오프라인 시 잠그지 않고 'offline' 반환)
 */
export async function verifyFriendSessionHeartbeat(): Promise<
  'not-friend' | 'valid' | 'revoked' | 'offline'
> {
  if (!isFriendRestrictedMode()) return 'not-friend';
  const session = readFriendSession();
  if (!session) return 'not-friend';

  const gasUrl = isValidGasUrl(readStoredCloudRepo().repo);
  if (!gasUrl) return 'offline';

  try {
    const idbOrLocalToken = await getOrCreateDeviceBindingToken();
    const deviceToken = session.deviceToken || idbOrLocalToken;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'verifyFriendSession',
        deviceToken,
        codeId: session.codeId || '',
      }),
    });

    if (!res.ok) return 'offline';
    const json = await res.json();

    if (json && (json.valid === false || json.revoked === true)) {
      revokeLocalFriendAccess();
      return 'revoked';
    }

    if (json && typeof json.codeId === 'string' && json.codeId.trim()) {
      const nextCodeId = json.codeId.trim();
      const nextLabel =
        typeof json.label === 'string' && json.label.trim()
          ? json.label.trim()
          : session.label;
      if (nextCodeId !== session.codeId || nextLabel !== session.label) {
        try {
          localStorage.setItem(
            FRIEND_SESSION_STORAGE_KEY,
            JSON.stringify({
              ...session,
              deviceToken,
              codeId: nextCodeId,
              label: nextLabel,
            })
          );
        } catch {
          // ignore
        }
      }
    }

    return 'valid';
  } catch {
    return 'offline';
  }
}

export function formatFriendInviteCode(raw: string): string {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return String(raw || '').trim();
}

function normalizeInviteItem(raw: any): FriendInviteItem {
  const statusStr = String(raw?.status || 'ACTIVE').toUpperCase();
  const status: FriendInviteStatus =
    statusStr === 'BOUND'
      ? 'BOUND'
      : statusStr === 'REVOKED'
      ? 'REVOKED'
      : 'ACTIVE';
  return {
    codeId: String(raw?.codeId || '').trim(),
    inviteCode: String(raw?.inviteCode || '').trim(),
    label: String(raw?.label || '친구1').trim(),
    status,
    maxDevices: Math.max(1, Number(raw?.maxDevices) || 1),
    boundDevicePreview: raw?.boundDevicePreview
      ? String(raw.boundDevicePreview)
      : undefined,
    boundUserAgent: raw?.boundUserAgent ? String(raw.boundUserAgent) : undefined,
    createdAt: String(raw?.createdAt || '').trim(),
    boundAt: String(raw?.boundAt || '').trim(),
    lastSeenAt: String(raw?.lastSeenAt || '').trim(),
  };
}

/**
 * [오너 전용] 발급된 친구 초대코드 목록 조회
 */
export async function fetchFriendInviteList(
  rawGasUrl: string,
  pin: string
): Promise<{ ok: boolean; items: FriendInviteItem[]; error?: string }> {
  const gasUrl = isValidGasUrl(rawGasUrl);
  const cleanPin = String(pin || '').trim();
  if (!gasUrl || !cleanPin) {
    return {
      ok: false,
      items: [],
      error: '구글 시트 Apps Script URL과 관리자 PIN을 먼저 저장해 주세요.',
    };
  }
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'listFriendInvites',
        pin: cleanPin,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        items: [],
        error: `구글 시트 응답 오류 (${res.status})`,
      };
    }
    const json = await res.json();
    if (!json?.ok) {
      return {
        ok: false,
        items: [],
        error: String(
          json?.error ||
            '초대코드 목록을 불러오지 못했습니다. 최신 Apps Script 코드로 업데이트되었는지 확인해 주세요.'
        ),
      };
    }
    const items = Array.isArray(json.items)
      ? json.items.map(normalizeInviteItem)
      : [];
    return { ok: true, items };
  } catch (err: any) {
    return {
      ok: false,
      items: [],
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

/**
 * [오너 전용] 신규 1회용 8자리 초대코드 발급
 */
export async function issueNewFriendInvite(
  rawGasUrl: string,
  pin: string,
  label: string,
  maxDevices = 1
): Promise<{
  ok: boolean;
  item?: FriendInviteItem;
  items?: FriendInviteItem[];
  error?: string;
}> {
  const gasUrl = isValidGasUrl(rawGasUrl);
  const cleanPin = String(pin || '').trim();
  if (!gasUrl || !cleanPin) {
    return {
      ok: false,
      error: '구글 시트 Apps Script URL과 관리자 PIN을 먼저 저장해 주세요.',
    };
  }
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'issueFriendInvite',
        pin: cleanPin,
        label: String(label || '').trim() || '친구1',
        maxDevices: Math.max(1, Math.floor(Number(maxDevices) || 1)),
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `구글 시트 응답 오류 (${res.status})`,
      };
    }
    const json = await res.json();
    if (!json?.ok) {
      return {
        ok: false,
        error: String(
          json?.error ||
            '초대코드 발급에 실패했습니다. 구글 시트의 Apps Script 코드를 최신 버전으로 배포해 주세요.'
        ),
      };
    }
    return {
      ok: true,
      item: json.item ? normalizeInviteItem(json.item) : undefined,
      items: Array.isArray(json.items)
        ? json.items.map(normalizeInviteItem)
        : undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

/**
 * [오너 전용] 초대코드 상태 변경 (즉시 차단 / 기기 초기화 / 차단 해제 / 삭제)
 */
export async function mutateFriendInviteStatus(
  rawGasUrl: string,
  pin: string,
  codeId: string,
  mode: 'revoke' | 'reset_device' | 'activate' | 'delete'
): Promise<{
  ok: boolean;
  items?: FriendInviteItem[];
  message?: string;
  error?: string;
}> {
  const gasUrl = isValidGasUrl(rawGasUrl);
  const cleanPin = String(pin || '').trim();
  if (!gasUrl || !cleanPin || !codeId) {
    return {
      ok: false,
      error: '필수 요청 정보(URL · PIN · 코드ID)가 누락되었습니다.',
    };
  }
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateFriendInviteStatus',
        pin: cleanPin,
        codeId,
        mode,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `구글 시트 응답 오류 (${res.status})`,
      };
    }
    const json = await res.json();
    if (!json?.ok) {
      return {
        ok: false,
        error: String(json?.error || '상태 변경에 실패했습니다.'),
      };
    }
    return {
      ok: true,
      message: json.message ? String(json.message) : undefined,
      items: Array.isArray(json.items)
        ? json.items.map(normalizeInviteItem)
        : undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}
