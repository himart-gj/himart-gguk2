import { CustomerItem } from '../types/crm';
import { evaluateCustomerListAutoArchive } from '../utils/autoArchiveEngine';
import {
  FRIEND_INVITE_CREDENTIAL_CACHE_KEY,
  getOrCreateDeviceBindingToken,
  isFriendRestrictedMode,
  persistVerifiedOwnerStaffPin,
  readFriendSession,
  resolveBuiltInDefaultRelayUrl,
} from '../../utils/friendAccessGuard';
import {
  ENCRYPTED_OWNER_CRM_VAULT_FIELD,
  UNCONFIGURED_PIN_SENTINEL,
  fetchStoreCloudDataset,
  loadSavedSpreadsheetId,
  normalizeGasWebAppUrl,
  readRawSyncConfig,
  resolveRuntimeAdminPin,
  saveStoreCloudDataset,
} from '../../utils/storeCloudSync';

export interface EncryptedVaultEnvelope {
  v: 1;
  updatedAt: string;
  salt: string;
  iv: string;
  ct: string;
}

export interface UserCrmCloudSnapshot {
  version: 'himart-user-crm-cloud-v1';
  updatedAtMs: number;
  customers: CustomerItem[];
  monthlyAllCareCounts?: Record<string, number>;
  allCareQuarterOverrides?: Record<string, number>;
}

export const USER_CRM_CLOUD_SYNCED_EVENT = 'himart_user_crm_cloud_synced';
const ALLCARE_STORAGE_KEY = 'himart_crm_monthly_allcare_counts_v1';
const ALLCARE_QUARTER_OVERRIDES_KEY = 'himart_crm_allcare_quarter_confirmed_overrides_v1';

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = String(b64 || '').replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function getSubtleCrypto(): SubtleCrypto | null {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

function getRandomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
    return arr;
  }
  for (let i = 0; i < len; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

async function deriveAesGcmKey(
  secretPin: string,
  saltBytes: Uint8Array,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    throw new Error('WebCrypto API unavailable');
  }
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(`HIMART-CRM-VAULT-V1::${secretPin.trim()}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export async function encryptVaultJsonWithPin(
  payload: unknown,
  secretPin: string
): Promise<EncryptedVaultEnvelope> {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveAesGcmKey(secretPin, salt, ['encrypt']);
  const plainBytes = new TextEncoder().encode(JSON.stringify(payload ?? {}));
  const subtle = getSubtleCrypto();
  if (!subtle) throw new Error('WebCrypto API unavailable');
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainBytes as BufferSource
  );
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptVaultJsonWithPin<T = unknown>(
  envelope: EncryptedVaultEnvelope | null | undefined,
  secretPin: string
): Promise<T | null> {
  if (
    !envelope ||
    envelope.v !== 1 ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.ct ||
    !secretPin.trim()
  ) {
    return null;
  }
  try {
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);
    const key = await deriveAesGcmKey(secretPin, salt, ['decrypt']);
    const subtle = getSubtleCrypto();
    if (!subtle) return null;
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    const jsonStr = new TextDecoder('utf-8').decode(new Uint8Array(plainBuf));
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

function normalizePhoneDigits(phone?: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeNameLower(name?: string): string {
  return String(name || '').trim().toLowerCase();
}

function makeSyncIdentityKey(c: CustomerItem): string {
  const n = normalizeNameLower(c.name);
  const p = normalizePhoneDigits(c.phone);
  if (n && p) return `${n}__${p}`;
  return c.id;
}

export function mergeCustomerListsForCloudSync(
  localList: CustomerItem[],
  remoteList: CustomerItem[],
  nowMs = Date.now()
): CustomerItem[] {
  const map = new Map<string, CustomerItem>();

  const ingest = (raw: CustomerItem) => {
    if (!raw || !raw.name) return;
    const key = makeSyncIdentityKey(raw);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...raw });
      return;
    }

    const rawTouch = Math.max(raw.updatedAtMs || 0, raw.deletedAt || 0);
    const existTouch = Math.max(existing.updatedAtMs || 0, existing.deletedAt || 0);
    const isRawNewer =
      rawTouch !== existTouch
        ? rawTouch > existTouch
        : (raw.regDate || '') >= (existing.regDate || '');

    const primary = isRawNewer ? raw : existing;
    const secondary = isRawNewer ? existing : raw;

    const seenQuoteIds = new Set<string>();
    const seenOrderNos = new Set<string>();
    const mergedQuotes = [...(primary.quotes || []), ...(secondary.quotes || [])].filter(
      (q) => {
        if (!q || !q.id) return false;
        const ord = String(q.orderNo || '').trim().toUpperCase();
        if (seenQuoteIds.has(q.id)) return false;
        if (ord && seenOrderNos.has(ord)) return false;
        seenQuoteIds.add(q.id);
        if (ord) seenOrderNos.add(ord);
        return true;
      }
    );

    const pMemo = String(primary.memo || '').trim();
    const sMemo = String(secondary.memo || '').trim();
    const mergedMemo = !pMemo
      ? sMemo
      : !sMemo || pMemo.includes(sMemo)
      ? pMemo
      : sMemo.includes(pMemo)
      ? sMemo
      : `${pMemo}\n${sMemo}`;

    const pGift = String(primary.giftItems || '').trim();
    const sGift = String(secondary.giftItems || '').trim();
    const mergedGifts = !pGift
      ? sGift
      : !sGift || pGift.includes(sGift)
      ? pGift
      : `${pGift}, ${sGift}`;

    map.set(key, {
      ...secondary,
      ...primary,
      id: existing.id || raw.id,
      memo: mergedMemo,
      giftItems: mergedGifts,
      quotes: mergedQuotes.slice(0, 30),
      deletedAt: primary.deletedAt,
      giftSentAtMs: primary.giftSent
        ? primary.giftSentAtMs ?? secondary.giftSentAtMs
        : undefined,
      deliveredCompletedAtMs:
        primary.status === '배송완료'
          ? Math.max(
              primary.deliveredCompletedAtMs || 0,
              secondary.deliveredCompletedAtMs || 0
            ) || undefined
          : undefined,
      allSettledAtMs:
        primary.status === '배송완료'
          ? primary.allSettledAtMs ?? secondary.allSettledAtMs
          : undefined,
      autoArchivedAt:
        primary.status === '배송완료' && !primary.deletedAt
          ? primary.autoArchivedAt ?? secondary.autoArchivedAt
          : undefined,
      updatedAtMs:
        Math.max(primary.updatedAtMs || 0, secondary.updatedAtMs || 0) || undefined,
    });
  };

  for (const c of localList || []) ingest(c);
  for (const c of remoteList || []) ingest(c);

  const combined = Array.from(map.values()).sort((a, b) =>
    (b.regDate || '').localeCompare(a.regDate || '')
  );
  return evaluateCustomerListAutoArchive(combined, nowMs);
}

function readLocalMonthlyAllCare(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ALLCARE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalMonthlyAllCare(next: Record<string, number>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ALLCARE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function readLocalAllCareQuarterOverrides(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ALLCARE_QUARTER_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalAllCareQuarterOverrides(next: Record<string, number>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ALLCARE_QUARTER_OVERRIDES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export interface CloudCrmIdentityStatus {
  ready: boolean;
  role: 'staff' | 'friend' | 'unlinked';
  label: string;
  needsCodeLinkOnThisDevice: boolean;
}

export function getCloudCrmIdentityStatus(): CloudCrmIdentityStatus {
  if (isFriendRestrictedMode()) {
    const session = readFriendSession();
    return {
      ready: Boolean(session && session.deviceToken && session.codeId),
      role: 'friend',
      label: session?.label ? `${session.label} (초대코드 기기연동)` : '초대 사용자',
      needsCodeLinkOnThisDevice: false,
    };
  }
  const adminPin = resolveRuntimeAdminPin();
  if (adminPin && adminPin !== UNCONFIGURED_PIN_SENTINEL && adminPin.length >= 4) {
    return {
      ready: true,
      role: 'staff',
      label: '관리자 본인 코드 (다중기기 실시간 공유)',
      needsCodeLinkOnThisDevice: false,
    };
  }
  return {
    ready: false,
    role: 'unlinked',
    label: '본인 보안코드 1회 연결 필요',
    needsCodeLinkOnThisDevice: true,
  };
}

let lastCloudUpdatedAtMs = 0;
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncingNow = false;

export async function pushUserCrmSnapshotToCloud(
  customers: CustomerItem[]
): Promise<{ ok: boolean; mode?: 'native' | 'encrypted_vault'; message?: string }> {
  const gasUrl = normalizeGasWebAppUrl(
    readRawSyncConfig().repo || resolveBuiltInDefaultRelayUrl()
  );
  if (!gasUrl) return { ok: false, message: '클라우드 연결 주소 없음' };

  const snapshot: UserCrmCloudSnapshot = {
    version: 'himart-user-crm-cloud-v1',
    updatedAtMs: Date.now(),
    customers,
    monthlyAllCareCounts: readLocalMonthlyAllCare(),
    allCareQuarterOverrides: readLocalAllCareQuarterOverrides(),
  };

  if (isFriendRestrictedMode()) {
    const session = readFriendSession();
    if (!session || !session.codeId) {
      return { ok: false, message: '초대 세션 정보 없음' };
    }
    const deviceToken = session.deviceToken || (await getOrCreateDeviceBindingToken());
    const cachedCred =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem(FRIEND_INVITE_CREDENTIAL_CACHE_KEY) || '').trim()
        : '';
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'pushUserCrm',
          role: 'friend',
          codeId: session.codeId,
          deviceToken,
          ...(cachedCred ? { inviteCode: cachedCred } : {}),
          payload: JSON.stringify(snapshot),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok) {
          lastCloudUpdatedAtMs = snapshot.updatedAtMs;
          return { ok: true, mode: 'native' };
        }
      }
    } catch {
      // ignore offline error
    }
    return {
      ok: false,
      message: '초대 기기 클라우드 저장을 위해 관리자의 Apps Script 최신 배포가 필요합니다.',
    };
  }

  const adminPin = resolveRuntimeAdminPin();
  if (!adminPin || adminPin === UNCONFIGURED_PIN_SENTINEL || adminPin.length < 4) {
    return { ok: false, message: '관리자 본인 보안코드를 먼저 1회 연결해 주세요.' };
  }

  const spreadsheetId = loadSavedSpreadsheetId();

  try {
    const nativeRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'pushUserCrm',
        role: 'staff',
        pin: adminPin,
        ...(spreadsheetId ? { spreadsheetId } : {}),
        payload: JSON.stringify(snapshot),
      }),
    });
    if (nativeRes.ok) {
      const json = await nativeRes.json();
      if (json?.ok) {
        lastCloudUpdatedAtMs = snapshot.updatedAtMs;
        return { ok: true, mode: 'native' };
      }
    }
  } catch {
    // fallback to encrypted vault below
  }

  try {
    const encryptedEnvelope = await encryptVaultJsonWithPin(snapshot, adminPin);
    const existingCare = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
      bypassCache: true,
      gasUrlOverride: gasUrl,
    });
    if (!existingCare || typeof existingCare !== 'object' || Array.isArray(existingCare)) {
      return { ok: false, message: '클라우드 응답 지연으로 기존 자료 보호를 위해 동기화를 다음 주기로 보류했습니다.' };
    }
    const baseObj: Record<string, unknown> = { ...existingCare };
    baseObj[ENCRYPTED_OWNER_CRM_VAULT_FIELD] = encryptedEnvelope;

    const saveRes = await saveStoreCloudDataset('care', baseObj, {
      repo: gasUrl,
      token: adminPin,
      ...(spreadsheetId ? { spreadsheetId } : {}),
    });
    if (saveRes.ok) {
      lastCloudUpdatedAtMs = snapshot.updatedAtMs;
      return { ok: true, mode: 'encrypted_vault' };
    }
    return { ok: false, message: saveRes.message };
  } catch (err: any) {
    return { ok: false, message: err?.message || '클라우드 암호화 저장 오류' };
  }
}

export async function pullUserCrmSnapshotFromCloud(): Promise<UserCrmCloudSnapshot | null> {
  const gasUrl = normalizeGasWebAppUrl(
    readRawSyncConfig().repo || resolveBuiltInDefaultRelayUrl()
  );
  if (!gasUrl) return null;

  if (isFriendRestrictedMode()) {
    const session = readFriendSession();
    if (!session || !session.codeId) return null;
    const deviceToken = session.deviceToken || (await getOrCreateDeviceBindingToken());
    const cachedCred =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem(FRIEND_INVITE_CREDENTIAL_CACHE_KEY) || '').trim()
        : '';
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'pullUserCrm',
          role: 'friend',
          codeId: session.codeId,
          deviceToken,
          ...(cachedCred ? { inviteCode: cachedCred } : {}),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json.data && Array.isArray(json.data.customers)) {
          return json.data as UserCrmCloudSnapshot;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  const adminPin = resolveRuntimeAdminPin();
  if (!adminPin || adminPin === UNCONFIGURED_PIN_SENTINEL || adminPin.length < 4) {
    return null;
  }

  const spreadsheetId = loadSavedSpreadsheetId();

  let nativeSupported = false;
  let nativeSnapshot: UserCrmCloudSnapshot | null = null;
  try {
    const nativeRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'pullUserCrm',
        role: 'staff',
        pin: adminPin,
        ...(spreadsheetId ? { spreadsheetId } : {}),
      }),
    });
    if (nativeRes.ok) {
      const json = await nativeRes.json();
      if (json?.ok) {
        nativeSupported = true;
        if (json.data && Array.isArray(json.data.customers)) {
          nativeSnapshot = json.data as UserCrmCloudSnapshot;
        }
      }
    }
  } catch {
    // ignore
  }

  let vaultSnapshot: UserCrmCloudSnapshot | null = null;
  if (!nativeSupported || !nativeSnapshot) {
    try {
      const careData = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
        bypassCache: true,
        gasUrlOverride: gasUrl,
      });
      const rawEnvelope = careData?.[ENCRYPTED_OWNER_CRM_VAULT_FIELD] as
        | EncryptedVaultEnvelope
        | undefined;
      if (rawEnvelope && rawEnvelope.v === 1) {
        const dec = await decryptVaultJsonWithPin<UserCrmCloudSnapshot>(
          rawEnvelope,
          adminPin
        );
        if (dec && Array.isArray(dec.customers)) {
          vaultSnapshot = dec;
        }
      }
    } catch {
      // ignore
    }
  }

  if (nativeSnapshot && vaultSnapshot) {
    return (nativeSnapshot.updatedAtMs || 0) >= (vaultSnapshot.updatedAtMs || 0)
      ? nativeSnapshot
      : vaultSnapshot;
  }
  return nativeSnapshot || vaultSnapshot;
}

export async function syncBidirectionalUserCrm(
  getLocalCustomers: () => CustomerItem[],
  commitLocalCustomers: (merged: CustomerItem[]) => CustomerItem[],
  options?: { forcePushIfLocalNewer?: boolean }
): Promise<{
  ok: boolean;
  customers: CustomerItem[];
  fromCloud: boolean;
  pushedToCloud: boolean;
  message?: string;
}> {
  if (isSyncingNow) {
    return {
      ok: true,
      customers: getLocalCustomers(),
      fromCloud: false,
      pushedToCloud: false,
    };
  }

  const identity = getCloudCrmIdentityStatus();
  if (!identity.ready) {
    return {
      ok: false,
      customers: getLocalCustomers(),
      fromCloud: false,
      pushedToCloud: false,
      message: '본인 보안코드 연결 대기 중',
    };
  }

  isSyncingNow = true;
  try {
    const remoteSnap = await pullUserCrmSnapshotFromCloud();
    const latestLocal = getLocalCustomers();

    if (remoteSnap && Array.isArray(remoteSnap.customers)) {
      if (
        remoteSnap.monthlyAllCareCounts &&
        typeof remoteSnap.monthlyAllCareCounts === 'object'
      ) {
        const localAc = readLocalMonthlyAllCare();
        const mergedAc: Record<string, number> = { ...localAc };
        for (const [ym, cnt] of Object.entries(remoteSnap.monthlyAllCareCounts)) {
          mergedAc[ym] = Math.max(Number(localAc[ym]) || 0, Number(cnt) || 0);
        }
        writeLocalMonthlyAllCare(mergedAc);
      }
      if (
        remoteSnap.allCareQuarterOverrides &&
        typeof remoteSnap.allCareQuarterOverrides === 'object'
      ) {
        const localOv = readLocalAllCareQuarterOverrides();
        writeLocalAllCareQuarterOverrides({
          ...remoteSnap.allCareQuarterOverrides,
          ...localOv,
        });
      }

      const merged = mergeCustomerListsForCloudSync(
        latestLocal,
        remoteSnap.customers,
        Date.now()
      );
      const saved = commitLocalCustomers(merged);

      const shouldPushBack =
        Boolean(options?.forcePushIfLocalNewer) ||
        saved.length > remoteSnap.customers.length ||
        (remoteSnap.updatedAtMs || 0) < lastCloudUpdatedAtMs;

      let pushed = false;
      if (shouldPushBack && saved.length > 0) {
        const pRes = await pushUserCrmSnapshotToCloud(saved);
        pushed = pRes.ok;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(USER_CRM_CLOUD_SYNCED_EVENT));
      }
      return {
        ok: true,
        customers: saved,
        fromCloud: true,
        pushedToCloud: pushed,
      };
    }

    if (latestLocal.length > 0) {
      const pushRes = await pushUserCrmSnapshotToCloud(latestLocal);
      return {
        ok: pushRes.ok,
        customers: latestLocal,
        fromCloud: false,
        pushedToCloud: pushRes.ok,
        message: pushRes.message,
      };
    }

    return {
      ok: true,
      customers: latestLocal,
      fromCloud: false,
      pushedToCloud: false,
    };
  } finally {
    isSyncingNow = false;
  }
}

export function scheduleDebouncedUserCrmCloudPush(
  getCustomersSnapshot: () => CustomerItem[],
  delayMs = 1200
): void {
  const identity = getCloudCrmIdentityStatus();
  if (!identity.ready) return;

  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
  }
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    const latest = getCustomersSnapshot();
    void pushUserCrmSnapshotToCloud(latest);
  }, delayMs);
}

export async function linkOwnerCodeAndSyncCrmNow(
  rawCode: string,
  getLocalCustomers: () => CustomerItem[],
  commitLocalCustomers: (merged: CustomerItem[]) => CustomerItem[]
): Promise<{ ok: boolean; customerCount: number; error?: string }> {
  const clean = String(rawCode || '').replace(/[\s-]+/g, '').trim();
  if (clean.length < 4) {
    return { ok: false, customerCount: 0, error: '보안코드를 정확히 입력해 주세요.' };
  }
  const gasUrl = normalizeGasWebAppUrl(
    readRawSyncConfig().repo || resolveBuiltInDefaultRelayUrl()
  );
  if (!gasUrl) {
    return { ok: false, customerCount: 0, error: '클라우드 주소를 확인할 수 없습니다.' };
  }

  try {
    const deviceToken = await getOrCreateDeviceBindingToken();
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'authenticateDevice',
        credential: clean,
        deviceToken,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });
    if (!res.ok) {
      return { ok: false, customerCount: 0, error: `서버 응답 오류 (${res.status})` };
    }
    const json = await res.json();
    if (!json?.ok || json.role !== 'staff') {
      return {
        ok: false,
        customerCount: 0,
        error: json?.error || '관리자 본인 보안코드가 일치하지 않습니다.',
      };
    }

    persistVerifiedOwnerStaffPin(clean);
    const syncRes = await syncBidirectionalUserCrm(
      getLocalCustomers,
      commitLocalCustomers,
      { forcePushIfLocalNewer: true }
    );
    return {
      ok: true,
      customerCount: syncRes.customers.length,
    };
  } catch {
    return {
      ok: false,
      customerCount: 0,
      error: '네트워크 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}
