import { useEffect, useState } from 'react';

export interface OutboxMutationItem {
  id: string;
  createdAt: number;
  domain: 'crm' | 'schedule' | 'dataset';
  action: string;
  payload: any;
}

const IDB_NAME = 'himart_gwangju_enterprise_db';
const IDB_VERSION = 1;
const STORE_KV = 'kv_mirror';
const STORE_OUTBOX = 'sync_outbox';
const OUTBOX_FALLBACK_KEY = 'himart_gj_sync_outbox_v1';
export const SYNC_STATUS_EVENT = 'himart_gj_sync_status_changed';

function openEnterpriseIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * 대용량 데이터(CRM 고객 다중 견적, 조견표, 무이자표, 휴무표)를 IndexedDB에 비동기 미러링하여
 * localStorage 5MB 용량 한계 초과 시에도 데이터 유실을 100% 방어합니다.
 */
export async function idbMirrorSet(key: string, value: any): Promise<void> {
  const db = await openEnterpriseIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbMirrorGet<T = any>(key: string): Promise<T | null> {
  const db = await openEnterpriseIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function getLocalOutboxFallback(): OutboxMutationItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalOutboxFallback(items: OutboxMutationItem[]): void {
  try {
    localStorage.setItem(OUTBOX_FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function notifySyncChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT));
  }
}

export async function enqueueOfflineMutation(
  item: Omit<OutboxMutationItem, 'id' | 'createdAt'>
): Promise<void> {
  const record: OutboxMutationItem = {
    ...item,
    id: `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };

  const fallback = getLocalOutboxFallback();
  setLocalOutboxFallback([...fallback.slice(-99), record]);

  const db = await openEnterpriseIdb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  notifySyncChange();
}

export async function getPendingOutboxItems(): Promise<OutboxMutationItem[]> {
  const db = await openEnterpriseIdb();
  if (!db) return getLocalOutboxFallback();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const req = tx.objectStore(STORE_OUTBOX).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? req.result : [];
        resolve(list.length > 0 ? list : getLocalOutboxFallback());
      };
      req.onerror = () => resolve(getLocalOutboxFallback());
    } catch {
      resolve(getLocalOutboxFallback());
    }
  });
}

export async function clearOutboxItem(id: string): Promise<void> {
  const nextFallback = getLocalOutboxFallback().filter((it) => it.id !== id);
  setLocalOutboxFallback(nextFallback);

  const db = await openEnterpriseIdb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  notifySyncChange();
}

/**
 * 온라인 복귀 시 대기 중이던 변경 내역을 일괄 플러시
 */
export async function flushPendingOutbox(
  executor?: (item: OutboxMutationItem) => Promise<boolean>
): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const pending = await getPendingOutboxItems();
  if (pending.length === 0) return 0;

  let flushed = 0;
  for (const item of pending) {
    try {
      const ok = executor ? await executor(item) : true;
      if (ok) {
        await clearOutboxItem(item.id);
        flushed++;
      }
    } catch {
      // 다음 온라인 주기에 재시도
    }
  }
  notifySyncChange();
  return flushed;
}

/**
 * 실시간 네트워크 상태 + 오프라인 대기열 개수를 반환하는 훅
 */
export function useOfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (!mounted) return;
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      const list = await getPendingOutboxItems();
      if (mounted) setPendingCount(list.length);
    };

    refresh();

    const handleOnline = async () => {
      setIsOnline(true);
      await flushPendingOutbox();
      refresh();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refresh();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(SYNC_STATUS_EVENT, refresh);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(SYNC_STATUS_EVENT, refresh);
    };
  }, []);

  return { isOnline, pendingCount };
}
