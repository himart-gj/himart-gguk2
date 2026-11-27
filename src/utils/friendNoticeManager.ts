import { idbMirrorGet, idbMirrorSet } from './offlineDbQueue';
import { isFriendRestrictedMode, readFriendSession } from './friendAccessGuard';

export const FRIEND_ONE_TIME_NOTICES_FIELD = '__friendNotices' as const;
export const FRIEND_DISMISSED_NOTICES_STORAGE_KEY =
  'himart_friend_dismissed_notices_v1' as const;
export const FRIEND_ONE_TIME_NOTICE_EVENT =
  'himart_friend_one_time_notice' as const;

export interface FriendOneTimeNotice {
  noticeId: string;
  codeId: string;
  message: string;
  createdAt: string;
}

let pendingNoticeCache: FriendOneTimeNotice | null = null;
let noticeSeqCounter = 0;

export function createFriendOneTimeNotice(
  codeId: string,
  message: string,
  nowIso = new Date().toISOString()
): FriendOneTimeNotice {
  noticeSeqCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    noticeId: `fn_${Date.now()}_${noticeSeqCounter}_${rand}`,
    codeId: String(codeId || '').trim(),
    message: String(message || '').trim(),
    createdAt: nowIso,
  };
}

export function extractFriendNoticesMap(
  rawData: unknown
): Record<string, FriendOneTimeNotice> {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return {};
  }
  const rawMap = (rawData as Record<string, unknown>)[
    FRIEND_ONE_TIME_NOTICES_FIELD
  ];
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
    return {};
  }
  const out: Record<string, FriendOneTimeNotice> = {};
  for (const [rawCodeId, entry] of Object.entries(
    rawMap as Record<string, any>
  )) {
    const codeId = String(rawCodeId || '').trim();
    const noticeId = String(entry?.noticeId || '').trim();
    const message = String(entry?.message || '').trim();
    if (!codeId || !noticeId || !message) continue;
    out[codeId] = {
      noticeId,
      codeId,
      message,
      createdAt: String(entry?.createdAt || '').trim(),
    };
  }
  return out;
}

function sanitizeDismissedMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || '').trim();
    if (!key) continue;
    out[key] = Number(v) || Date.now();
  }
  return out;
}

export function readDismissedFriendNoticeIds(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FRIEND_DISMISSED_NOTICES_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeDismissedMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function hydrateDismissedFriendNoticeIdsFromIdb(): Promise<
  Record<string, number>
> {
  const local = readDismissedFriendNoticeIds();
  try {
    const mirrored = await idbMirrorGet<Record<string, number>>(
      FRIEND_DISMISSED_NOTICES_STORAGE_KEY
    );
    const safeMirror = sanitizeDismissedMap(mirrored);
    const merged = { ...safeMirror, ...local };
    if (
      Object.keys(safeMirror).length > 0 &&
      Object.keys(merged).length > Object.keys(local).length &&
      typeof localStorage !== 'undefined'
    ) {
      localStorage.setItem(
        FRIEND_DISMISSED_NOTICES_STORAGE_KEY,
        JSON.stringify(merged)
      );
    }
    return merged;
  } catch {
    return local;
  }
}

export function isFriendNoticeDismissed(
  noticeId: string,
  dismissedMap?: Record<string, number>
): boolean {
  const cleanId = String(noticeId || '').trim();
  if (!cleanId) return true;
  const target = dismissedMap ?? readDismissedFriendNoticeIds();
  return Boolean(target[cleanId]);
}

export function dismissFriendOneTimeNotice(noticeId: string): void {
  const cleanId = String(noticeId || '').trim();
  if (!cleanId) return;
  const current = readDismissedFriendNoticeIds();
  const next: Record<string, number> = {
    ...current,
    [cleanId]: Date.now(),
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(
        FRIEND_DISMISSED_NOTICES_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  }
  void idbMirrorSet(FRIEND_DISMISSED_NOTICES_STORAGE_KEY, next);
  if (pendingNoticeCache?.noticeId === cleanId) {
    pendingNoticeCache = null;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FRIEND_ONE_TIME_NOTICE_EVENT, { detail: null })
    );
  }
}

export function resolveActiveOneTimeNoticeForFriend(
  rawData: unknown,
  currentCodeId: string,
  dismissedMap?: Record<string, number>
): FriendOneTimeNotice | null {
  const cleanCodeId = String(currentCodeId || '').trim();
  if (!cleanCodeId) return null;
  const map = extractFriendNoticesMap(rawData);
  const candidate = map[cleanCodeId];
  if (!candidate || !candidate.noticeId || !candidate.message) {
    return null;
  }
  if (isFriendNoticeDismissed(candidate.noticeId, dismissedMap)) {
    return null;
  }
  return candidate;
}

export function getPendingFriendOneTimeNotice(): FriendOneTimeNotice | null {
  if (
    pendingNoticeCache &&
    isFriendNoticeDismissed(pendingNoticeCache.noticeId)
  ) {
    pendingNoticeCache = null;
  }
  return pendingNoticeCache;
}

export function evaluateAndEmitFriendNoticeFromCareData(rawData: unknown): void {
  if (!isFriendRestrictedMode()) return;
  const session = readFriendSession();
  if (!session || !session.codeId) return;

  void hydrateDismissedFriendNoticeIdsFromIdb().then((dismissedMap) => {
    const active = resolveActiveOneTimeNoticeForFriend(
      rawData,
      session.codeId,
      dismissedMap
    );
    pendingNoticeCache = active;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(FRIEND_ONE_TIME_NOTICE_EVENT, { detail: active })
      );
    }
  });
}
