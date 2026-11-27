// ============================================================================
// 외부 지인(친구) 전용 초대코드 · 다중기기 허용 · 휴무표 공유 ON/OFF · 원격 차단 보안 가드
// - 비공개 구글 시트(_친구기기_접근관리) 서버 검증 연동
// - localStorage + IndexedDB 이중 기기 고유 토큰(deviceToken) 영속화
// - 친구 세션 시 오너 전용 기능 로컬 흔적 즉시 소거 + 휴무표 공유 ON/OFF 실시간 반영
// ============================================================================

export const FRIEND_SESSION_STORAGE_KEY = 'himart_friend_session_v1';
export const FRIEND_DEVICE_TOKEN_KEY = 'himart_friend_device_token_v1';
export const FRIEND_DEVICE_REVOKED_KEY = 'himart_friend_revoked_v1';
export const FRIEND_SCHEDULE_ALLOWED_KEY = 'himart_friend_schedule_allowed_v1';
export const FRIEND_INVITE_CREDENTIAL_CACHE_KEY = 'himart_friend_invite_cred_v1';
export const PENDING_INVITE_PROMPT_KEY = 'himart_pending_invite_prompt_v1';
export const FRIEND_ROLE_CHANGED_EVENT = 'himart_friend_role_changed';
export const FRIEND_SHARED_AI_SYNC_EVENT = 'himart_friend_shared_ai_sync';

const INTERNAL_CLOUD_CONFIG_KEY = 'himart_care_gh_sync_config_v1';
const INTERNAL_TARGET_SHEET_ID_KEY = 'himart_gj_target_sheet_id_v1';
const INTERNAL_CLOUD_UPDATED_EVENT = 'himart_gj_store_cloud_updated';
const INTERNAL_STAFF_VERIFIED_V2_KEY = 'himart_staff_verified_gate_v2';
const INTERNAL_STAFF_TRUSTED_DEVICE_KEY = 'himart_staff_trusted_device_v1';
const INTERNAL_STAFF_CUSTOM_PIN_KEY = 'himart_staff_custom_pin_v1';
const INTERNAL_OWNER_DB_PIN_KEY = 'himart_gj_owner_db_pin_v1';
const INTERNAL_OWNER_DB_UNLOCKED_KEY = 'himart_gj_owner_db_unlocked_v1';
const INTERNAL_ADMIN_UNLOCKED_KEY = 'himart_gj_admin_unlocked';
const INTERNAL_CUSTOMER_VIEWER_ONLY_KEY = 'himart_customer_viewer_only_v1';
const INTERNAL_CUSTOMER_TAB_LOCK_KEY = 'himart_customer_tab_lock_v1';

const RELAY_XOR_KEY = 0x5a;
const DEFAULT_RELAY_BYTES: readonly number[] = [
  50, 46, 46, 42, 41, 96, 117, 117, 41, 57, 40, 51, 42, 46, 116, 61, 53, 53, 61,
  54, 63, 116, 57, 53, 55, 117, 55, 59, 57, 40, 53, 41, 117, 41, 117, 27, 17,
  60, 35, 57, 56, 45, 32, 32, 107, 54, 62, 14, 55, 27, 31, 21, 62, 12, 99, 104,
  47, 2, 54, 57, 111, 27, 21, 43, 48, 19, 27, 32, 46, 3, 106, 16, 106, 29, 41,
  106, 3, 24, 25, 31, 106, 13, 40, 49, 34, 55, 24, 63, 8, 19, 8, 62, 105, 8, 12,
  119, 19, 34, 55, 60, 107, 10, 17, 110, 53, 49, 20, 117, 63, 34, 63, 57,
];

export function resolveBuiltInDefaultRelayUrl(): string {
  let out = '';
  for (let i = 0; i < DEFAULT_RELAY_BYTES.length; i++) {
    out += String.fromCharCode(DEFAULT_RELAY_BYTES[i] ^ RELAY_XOR_KEY);
  }
  return out;
}

const IDB_NAME = 'himart_device_auth_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'tokens';

export interface FriendSessionRecord {
  role: 'friend';
  deviceToken: string;
  codeId: string;
  label: string;
  verifiedAt: string;
  scheduleAllowed?: boolean;
}

export type FriendInviteStatus = 'ACTIVE' | 'BOUND' | 'REVOKED';

export interface FriendInviteItem {
  codeId: string;
  inviteCode: string;
  label: string;
  status: FriendInviteStatus;
  maxDevices: number;
  boundDeviceCount?: number;
  boundDevicePreview?: string;
  boundUserAgent?: string;
  aiAllowed?: boolean;
  scheduleAllowed?: boolean;
  createdAt: string;
  boundAt: string;
  lastSeenAt: string;
}

export interface FriendSharedAiMeta {
  hasSharedKey: boolean;
  maskedSharedKey: string;
  globalEnabled: boolean;
  friendAiMap: Record<string, boolean>;
}

export interface AuthenticateDeviceResult {
  ok: boolean;
  role?: 'staff' | 'friend';
  codeId?: string;
  label?: string;
  scheduleAllowed?: boolean;
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
    return { repo: resolveBuiltInDefaultRelayUrl(), branch: 'main', token: '' };
  }
  try {
    const raw = localStorage.getItem(INTERNAL_CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const explicitRepo = String(parsed?.repo || '').trim();
      return {
        repo: explicitRepo || resolveBuiltInDefaultRelayUrl(),
        branch: String(parsed?.branch || 'main').trim() || 'main',
        token: String(parsed?.token || '').trim(),
      };
    }
  } catch {
    // ignore parse error
  }
  return { repo: resolveBuiltInDefaultRelayUrl(), branch: 'main', token: '' };
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

export function cleanInviteQueryFromAddressBar(): void {
  if (typeof window === 'undefined' || !window.location) return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('invite')) return;
    params.delete('invite');
    const rest = params.toString();
    const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${
      window.location.hash || ''
    }`;
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState({}, '', cleanUrl);
    }
  } catch {
    // ignore
  }
}

function shouldKeepInviteQueryInAddressBar(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isInApp =
    /KAKAOTALK|Instagram|NAVER\(inapp|Line\/|FBAN|FBAV|DaumApps|EverytimeApp/i.test(
      ua
    );
  if (isInApp) return true;

  const isIosTouchMac =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIos = /iPhone|iPad|iPod/i.test(ua) || isIosTouchMac;
  const isStandalone =
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
    (window.navigator as any)?.standalone === true;

  if (isIos && !isStandalone) return true;

  return false;
}

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

    if (!candidateUrl) {
      cleanInviteQueryFromAddressBar();
      return false;
    }

    if (!shouldKeepInviteQueryInAddressBar()) {
      cleanInviteQueryFromAddressBar();
    }

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
      const explicitScheduleFlag =
        typeof parsed.scheduleAllowed === 'boolean'
          ? parsed.scheduleAllowed
          : localStorage.getItem(FRIEND_SCHEDULE_ALLOWED_KEY) === '1';
      return {
        role: 'friend',
        deviceToken: parsed.deviceToken.trim(),
        codeId: String(parsed.codeId || '').trim(),
        label: String(parsed.label || '외부지인').trim(),
        verifiedAt: String(parsed.verifiedAt || '').trim(),
        scheduleAllowed: explicitScheduleFlag,
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

export function isFriendScheduleAllowed(): boolean {
  const session = readFriendSession();
  if (!session) return false;
  return Boolean(session.scheduleAllowed);
}

export function canAccessStoreSchedule(): boolean {
  if (!isFriendRestrictedMode()) return true;
  return isFriendScheduleAllowed();
}

export function purgeLocalScheduleDataOnly(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem('himart_gj_schedules_v4');
    localStorage.removeItem('himart_gj_schedules_v5');
    localStorage.removeItem('himart_gj_user_name');
    localStorage.removeItem('himart_gj_my_name');
  } catch {
    // ignore
  }
}

export function purgeLocalOwnerStateOnly(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(INTERNAL_OWNER_DB_UNLOCKED_KEY);
    localStorage.removeItem(INTERNAL_ADMIN_UNLOCKED_KEY);
    localStorage.removeItem(INTERNAL_OWNER_DB_PIN_KEY);
  } catch {
    // ignore
  }
}

export function purgeLocalScheduleAndOwnerState(): void {
  purgeLocalOwnerStateOnly();
  if (!isFriendScheduleAllowed()) {
    purgeLocalScheduleDataOnly();
  }
}

export function syncFriendSchedulePermission(allowed: boolean): void {
  if (typeof localStorage === 'undefined') return;
  const session = readFriendSession();
  if (!session) return;

  const prevAllowed = Boolean(session.scheduleAllowed);
  const nextAllowed = Boolean(allowed);

  try {
    localStorage.setItem(FRIEND_SCHEDULE_ALLOWED_KEY, nextAllowed ? '1' : '0');
    localStorage.setItem(
      FRIEND_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session,
        scheduleAllowed: nextAllowed,
      })
    );
  } catch {
    // ignore
  }

  if (!nextAllowed) {
    purgeLocalScheduleDataOnly();
  }

  if (prevAllowed !== nextAllowed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent('himart_gj_schedule_updated'));
  }
}

export function persistVerifiedOwnerStaffPin(cleanPin: string): void {
  if (typeof localStorage === 'undefined' || !cleanPin || cleanPin.length < 4) return;
  try {
    const prev = readStoredCloudRepo();
    localStorage.setItem(
      INTERNAL_CLOUD_CONFIG_KEY,
      JSON.stringify({
        repo: prev.repo || resolveBuiltInDefaultRelayUrl(),
        branch: prev.branch || 'main',
        token: cleanPin,
      })
    );
    localStorage.setItem(INTERNAL_STAFF_CUSTOM_PIN_KEY, cleanPin);
    localStorage.setItem(INTERNAL_OWNER_DB_PIN_KEY, cleanPin);
    localStorage.setItem(INTERNAL_OWNER_DB_UNLOCKED_KEY, '1');
    localStorage.setItem(INTERNAL_ADMIN_UNLOCKED_KEY, 'true');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(INTERNAL_CLOUD_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent('himart_gj_marketing_db_updated'));
    }
  } catch {
    // ignore
  }
}

function readSavedSheetId(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const s = String(localStorage.getItem(INTERNAL_TARGET_SHEET_ID_KEY) || '').trim();
    if (!s) return '';
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
    if (m?.[1]) return m[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
    return '';
  } catch {
    return '';
  }
}

let ramOnlyFriendSharedApiKey = '';

export function getRamOnlyFriendSharedApiKey(): string {
  return isFriendRestrictedMode() ? ramOnlyFriendSharedApiKey : '';
}

export function dispatchFriendSharedAiSync(
  aiEnabled: boolean,
  sharedApiKey: string
): void {
  const active = Boolean(aiEnabled && sharedApiKey && isFriendRestrictedMode());
  ramOnlyFriendSharedApiKey = active ? String(sharedApiKey).trim() : '';
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(FRIEND_SHARED_AI_SYNC_EVENT, {
      detail: {
        aiEnabled: active,
        sharedApiKey: ramOnlyFriendSharedApiKey,
      },
    })
  );
}

export function revokeLocalFriendAccess(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FRIEND_DEVICE_REVOKED_KEY, '1');
    localStorage.removeItem(FRIEND_SESSION_STORAGE_KEY);
    localStorage.removeItem(FRIEND_SCHEDULE_ALLOWED_KEY);
    localStorage.removeItem(FRIEND_INVITE_CREDENTIAL_CACHE_KEY);
    localStorage.removeItem(INTERNAL_STAFF_VERIFIED_V2_KEY);
    localStorage.removeItem(INTERNAL_STAFF_TRUSTED_DEVICE_KEY);
    localStorage.removeItem('himart_care_table_dataset_v1');
    purgeLocalOwnerStateOnly();
    purgeLocalScheduleDataOnly();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('himart_partner_manuals_session_v1');
    }
  } catch {
    // ignore
  }
  dispatchFriendSharedAiSync(false, '');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
  }
}

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
        localStorage.removeItem(FRIEND_SCHEDULE_ALLOWED_KEY);
        localStorage.removeItem(FRIEND_INVITE_CREDENTIAL_CACHE_KEY);
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
      persistVerifiedOwnerStaffPin(credential);
      dispatchFriendSharedAiSync(false, '');
      cleanInviteQueryFromAddressBar();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
      }
      return { ok: true, role: 'staff' };
    }

    if (json?.ok && json.role === 'friend') {
      const initScheduleAllowed = Boolean(json.scheduleAllowed === true);
      const session: FriendSessionRecord = {
        role: 'friend',
        deviceToken,
        codeId: String(json.codeId || '').trim(),
        label: String(json.label || '외부지인').trim(),
        verifiedAt: String(json.verifiedAt || new Date().toISOString()),
        scheduleAllowed: initScheduleAllowed,
      };
      try {
        const prev = readStoredCloudRepo();
        localStorage.setItem(
          INTERNAL_CLOUD_CONFIG_KEY,
          JSON.stringify({
            repo: gasUrl,
            branch: prev.branch || 'main',
            token: '',
          })
        );
        localStorage.setItem(FRIEND_SESSION_STORAGE_KEY, JSON.stringify(session));
        localStorage.setItem(
          FRIEND_SCHEDULE_ALLOWED_KEY,
          initScheduleAllowed ? '1' : '0'
        );
        localStorage.setItem(FRIEND_INVITE_CREDENTIAL_CACHE_KEY, credential);
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
      if (typeof json.aiEnabled === 'boolean') {
        dispatchFriendSharedAiSync(
          Boolean(json.aiEnabled),
          String(json.sharedApiKey || '')
        );
      }
      cleanInviteQueryFromAddressBar();
      purgeLocalScheduleAndOwnerState();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIEND_ROLE_CHANGED_EVENT));
      }
      return {
        ok: true,
        role: 'friend',
        codeId: session.codeId,
        label: session.label,
        scheduleAllowed: initScheduleAllowed,
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

    if (json && typeof json.aiEnabled === 'boolean') {
      dispatchFriendSharedAiSync(
        Boolean(json.aiEnabled),
        String(json.sharedApiKey || '')
      );
    }

    if (json && typeof json.scheduleAllowed === 'boolean') {
      syncFriendSchedulePermission(Boolean(json.scheduleAllowed));
    }

    if (json && typeof json.codeId === 'string' && json.codeId.trim()) {
      const nextCodeId = json.codeId.trim();
      const nextLabel =
        typeof json.label === 'string' && json.label.trim()
          ? json.label.trim()
          : session.label;
      const latestSession = readFriendSession() || session;
      if (nextCodeId !== latestSession.codeId || nextLabel !== latestSession.label) {
        try {
          localStorage.setItem(
            FRIEND_SESSION_STORAGE_KEY,
            JSON.stringify({
              ...latestSession,
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
  const previewStr = raw?.boundDevicePreview
    ? String(raw.boundDevicePreview)
    : undefined;
  const inferredCount =
    typeof raw?.boundDeviceCount === 'number'
      ? Math.max(0, raw.boundDeviceCount)
      : previewStr
      ? previewStr.split('/').map((s) => s.trim()).filter(Boolean).length
      : status === 'BOUND'
      ? 1
      : 0;
  return {
    codeId: String(raw?.codeId || '').trim(),
    inviteCode: String(raw?.inviteCode || '').trim(),
    label: String(raw?.label || '친구1').trim(),
    status,
    maxDevices: Math.max(1, Number(raw?.maxDevices) || 1),
    boundDeviceCount: inferredCount,
    boundDevicePreview: previewStr,
    boundUserAgent: raw?.boundUserAgent ? String(raw.boundUserAgent) : undefined,
    aiAllowed: raw?.aiAllowed !== false,
    scheduleAllowed: raw?.scheduleAllowed === true,
    createdAt: String(raw?.createdAt || '').trim(),
    boundAt: String(raw?.boundAt || '').trim(),
    lastSeenAt: String(raw?.lastSeenAt || '').trim(),
  };
}

function parseSharedAiMeta(raw: any): FriendSharedAiMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rawMap =
    raw.friendAiMap && typeof raw.friendAiMap === 'object' ? raw.friendAiMap : {};
  const cleanMap: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawMap)) {
    if (k) cleanMap[k] = v !== false;
  }
  return {
    hasSharedKey: Boolean(raw.hasSharedKey),
    maskedSharedKey: String(raw.maskedSharedKey || '').trim(),
    globalEnabled: Boolean(raw.globalEnabled),
    friendAiMap: cleanMap,
  };
}

function formatFriendlyGasError(rawError: unknown, fallback: string): {
  needsSpreadsheetId: boolean;
  message: string;
} {
  const s = String(rawError || '').trim();
  if (!s) return { needsSpreadsheetId: false, message: fallback };
  if (s.includes('getSheetByName')) {
    return {
      needsSpreadsheetId: true,
      message:
        '현재 독립형 Apps Script에 시트가 연결되지 않았습니다! 상단 [연동할 구글 시트 주소(URL)] 칸에 기존 구글 시트 주소를 붙여넣고 [Apps Script 코드 복사] → Code.gs 붙여넣기·새 버전 배포를 해주세요. (기존 시트의 초대 목록과 4대 자료는 단 1건도 삭제되지 않고 그대로 살아있습니다!)',
    };
  }
  return { needsSpreadsheetId: false, message: s };
}

function normalizeSheetIdCandidate(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return '';
}

export async function fetchFriendInviteList(
  rawGasUrl: string,
  pin: string,
  spreadsheetIdOverride?: string
): Promise<{
  ok: boolean;
  items: FriendInviteItem[];
  sharedAi?: FriendSharedAiMeta;
  needsSpreadsheetId?: boolean;
  error?: string;
}> {
  const gasUrl = isValidGasUrl(rawGasUrl || resolveBuiltInDefaultRelayUrl());
  const cleanPin = String(pin || '').trim();
  const spreadsheetId =
    normalizeSheetIdCandidate(spreadsheetIdOverride) || readSavedSheetId();
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
        ...(spreadsheetId ? { spreadsheetId } : {}),
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
      const formatted = formatFriendlyGasError(
        json?.error,
        '초대코드 목록을 불러오지 못했습니다. 최신 Apps Script 코드로 업데이트되었는지 확인해 주세요.'
      );
      return {
        ok: false,
        items: [],
        needsSpreadsheetId:
          Boolean(json?.needsSpreadsheetId) || formatted.needsSpreadsheetId,
        error: formatted.message,
      };
    }
    const items = Array.isArray(json.items)
      ? json.items.map(normalizeInviteItem)
      : [];
    return {
      ok: true,
      items,
      sharedAi: parseSharedAiMeta(json.sharedAi),
    };
  } catch (err: any) {
    return {
      ok: false,
      items: [],
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

export async function issueNewFriendInvite(
  rawGasUrl: string,
  pin: string,
  label: string,
  maxDevices = 3,
  spreadsheetIdOverride?: string
): Promise<{
  ok: boolean;
  item?: FriendInviteItem;
  items?: FriendInviteItem[];
  sharedAi?: FriendSharedAiMeta;
  needsSpreadsheetId?: boolean;
  error?: string;
}> {
  const gasUrl = isValidGasUrl(rawGasUrl || resolveBuiltInDefaultRelayUrl());
  const cleanPin = String(pin || '').trim();
  const spreadsheetId =
    normalizeSheetIdCandidate(spreadsheetIdOverride) || readSavedSheetId();
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
        maxDevices: Math.max(1, Math.min(5, Math.floor(Number(maxDevices) || 3))),
        ...(spreadsheetId ? { spreadsheetId } : {}),
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
      const formatted = formatFriendlyGasError(
        json?.error,
        '초대코드 발급에 실패했습니다. 구글 시트의 Apps Script 코드를 최신 버전으로 배포해 주세요.'
      );
      return {
        ok: false,
        needsSpreadsheetId:
          Boolean(json?.needsSpreadsheetId) || formatted.needsSpreadsheetId,
        error: formatted.message,
      };
    }
    return {
      ok: true,
      item: json.item ? normalizeInviteItem(json.item) : undefined,
      items: Array.isArray(json.items)
        ? json.items.map(normalizeInviteItem)
        : undefined,
      sharedAi: parseSharedAiMeta(json.sharedAi),
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}

export async function mutateFriendInviteStatus(
  rawGasUrl: string,
  pin: string,
  codeId: string,
  mode: 'revoke' | 'reset_device' | 'activate' | 'delete' | 'set_max_devices',
  options?: { maxDevices?: number; spreadsheetId?: string }
): Promise<{
  ok: boolean;
  items?: FriendInviteItem[];
  sharedAi?: FriendSharedAiMeta;
  needsSpreadsheetId?: boolean;
  message?: string;
  error?: string;
}> {
  const gasUrl = isValidGasUrl(rawGasUrl || resolveBuiltInDefaultRelayUrl());
  const cleanPin = String(pin || '').trim();
  const spreadsheetId =
    normalizeSheetIdCandidate(options?.spreadsheetId) || readSavedSheetId();
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
        ...(typeof options?.maxDevices === 'number'
          ? { maxDevices: options.maxDevices }
          : {}),
        ...(spreadsheetId ? { spreadsheetId } : {}),
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
      const formatted = formatFriendlyGasError(
        json?.error,
        '상태 변경에 실패했습니다.'
      );
      return {
        ok: false,
        needsSpreadsheetId:
          Boolean(json?.needsSpreadsheetId) || formatted.needsSpreadsheetId,
        error: formatted.message,
      };
    }
    return {
      ok: true,
      message: json.message ? String(json.message) : undefined,
      items: Array.isArray(json.items)
        ? json.items.map(normalizeInviteItem)
        : undefined,
      sharedAi: parseSharedAiMeta(json.sharedAi),
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `구글 시트 통신 오류 (${err?.message || '연결 확인'})`,
    };
  }
}
