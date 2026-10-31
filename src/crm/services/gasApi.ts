import { CustomerItem, CustomerStatus, QuoteRecord } from '../types/crm';
import { getNowDateTimeStr } from '../utils/date';
import {
  enqueueOfflineMutation,
  flushPendingOutbox,
  idbMirrorGet,
  idbMirrorSet,
} from '../../utils/offlineDbQueue';

const STORAGE_KEY_CACHE = 'gookji_crm_customers_cache_v3';

function normalizePhoneKey(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeNameKey(name: string): string {
  return String(name || '').trim().toLowerCase();
}

export function getCustomerIdentityKey(c: CustomerItem): string {
  const nameKey = normalizeNameKey(c.name);
  const phoneKey = normalizePhoneKey(c.phone);
  if (nameKey && phoneKey) {
    return `${nameKey}__${phoneKey}`;
  }
  return c.id;
}

export function deduplicateCustomers(list: CustomerItem[]): CustomerItem[] {
  const map = new Map<string, CustomerItem>();

  for (const item of list) {
    if (!item || !item.name) continue;
    const key = getCustomerIdentityKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...item,
        quotes: Array.isArray(item.quotes) ? item.quotes.slice(0, 5) : [],
      });
    } else {
      const mergedQuotesMap = new Map<string, QuoteRecord>();
      const allQuotes = [...(item.quotes || []), ...(existing.quotes || [])];
      for (const q of allQuotes) {
        if (q && q.id && !mergedQuotesMap.has(q.id)) {
          mergedQuotesMap.set(q.id, q);
        }
      }
      const mergedQuotes = Array.from(mergedQuotesMap.values()).slice(0, 5);

      const isItemNewer = (item.regDate || '') >= (existing.regDate || '');
      const primary = isItemNewer ? item : existing;
      const secondary = isItemNewer ? existing : item;

      map.set(key, {
        ...secondary,
        ...primary,
        id: existing.id || item.id,
        orderNo: primary.orderNo || secondary.orderNo || '',
        giftItems: primary.giftItems || secondary.giftItems || '',
        giftSent: Boolean(primary.giftSent ?? secondary.giftSent),
        logisticsConfirmed: Boolean(
          primary.logisticsConfirmed ?? secondary.logisticsConfirmed
        ),
        followUpDate: primary.followUpDate ?? secondary.followUpDate ?? '',
        memo: primary.memo || secondary.memo || '',
        quotes: mergedQuotes,
        deletedAt: primary.deletedAt ?? secondary.deletedAt,
      });
    }
  }

  return Array.from(map.values());
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getCachedCustomers(): CustomerItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const valid = parsed.filter(
          (c: CustomerItem) => !c.deletedAt || now - c.deletedAt < THIRTY_DAYS_MS
        );
        return deduplicateCustomers(valid);
      }
    }
  } catch (e) {
    console.error('Failed to read local customer cache', e);
  }
  return [];
}

export function setCachedCustomers(customers: CustomerItem[]): CustomerItem[] {
  const deduped = deduplicateCustomers(customers);
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(deduped));
  } catch (e) {
    console.error('localStorage quota warning — relying on IndexedDB mirror', e);
  }
  // 대용량 다중 견적 데이터를 IndexedDB에도 즉시 비동기 미러링 (5MB 한계 돌파)
  idbMirrorSet(STORAGE_KEY_CACHE, deduped).catch(() => {});
  return deduped;
}

export async function fetchCustomersFromGas(): Promise<{
  customers: CustomerItem[];
  fromCloud: boolean;
}> {
  const local = getCachedCustomers();
  if (local.length > 0) {
    idbMirrorSet(STORAGE_KEY_CACHE, local).catch(() => {});
    await flushPendingOutbox();
    return { customers: local, fromCloud: false };
  }

  // localStorage가 비어있거나 용량 초과였을 경우 IndexedDB 미러에서 복구
  const idbData = await idbMirrorGet<CustomerItem[]>(STORAGE_KEY_CACHE);
  if (Array.isArray(idbData) && idbData.length > 0) {
    const deduped = deduplicateCustomers(idbData);
    try {
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(deduped));
    } catch {
      // ignore
    }
    return { customers: deduped, fromCloud: false };
  }

  return { customers: [], fromCloud: false };
}

export async function saveCustomerQuote(payload: {
  targetCustomerId?: string;
  name: string;
  phone: string;
  items: string;
  paidAmount: number;
  netAmount: number;
  expectedBenefit: string;
  deliveryDate: string;
  followUpDate?: string;
  status: CustomerStatus;
  memo: string;
  orderNo?: string;
  giftItems?: string;
  quoteTitle?: string;
  proposalState?: any;
  quoteMode?: 'general' | 'subscription' | 'hybrid';
  plan2Summary?: {
    itemSummary: string;
    paidAmount: number;
    netAmount: number;
    benefit?: string;
  };
}): Promise<{
  customers: CustomerItem[];
  savedCustomer: CustomerItem;
  isExistingCustomer: boolean;
  quoteCount: number;
}> {
  const current = getCachedCustomers();
  const nowStr = getNowDateTimeStr();

  const newQuote: QuoteRecord = {
    id: `QT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title:
      payload.quoteTitle?.trim() ||
      `${payload.items.slice(0, 18) || '맞춤 견적'}`,
    createdAt: nowStr,
    itemSummary: payload.items,
    paidAmount: payload.paidAmount,
    netAmount: payload.netAmount,
    benefit: payload.expectedBenefit,
    proposalState: payload.proposalState
      ? JSON.parse(JSON.stringify(payload.proposalState))
      : undefined,
    quoteMode: payload.quoteMode,
    plan2Summary: payload.plan2Summary,
  };

  let existingIndex = -1;
  if (payload.targetCustomerId) {
    existingIndex = current.findIndex(
      (c) => c.id === payload.targetCustomerId && !c.deletedAt
    );
  }
  if (existingIndex < 0) {
    const targetNameKey = normalizeNameKey(payload.name);
    const targetPhoneKey = normalizePhoneKey(payload.phone);
    existingIndex = current.findIndex((c) => {
      if (c.deletedAt) return false;
      const cName = normalizeNameKey(c.name);
      const cPhone = normalizePhoneKey(c.phone);
      if (targetNameKey && targetPhoneKey) {
        return cName === targetNameKey && cPhone === targetPhoneKey;
      }
      return cName === targetNameKey && cPhone === '';
    });
  }

  let updatedList: CustomerItem[];
  let savedCustomer: CustomerItem;
  let isExistingCustomer = false;

  if (existingIndex >= 0) {
    isExistingCustomer = true;
    const existing = current[existingIndex];
    const prevQuotes = Array.isArray(existing.quotes) ? existing.quotes : [];
    const nextQuotes = [newQuote, ...prevQuotes].slice(0, 5);

    savedCustomer = {
      ...existing,
      regDate: nowStr,
      name: payload.name.trim() || existing.name,
      phone: payload.phone.trim() || existing.phone,
      items: payload.items,
      paidAmount: payload.paidAmount,
      netAmount: payload.netAmount,
      expectedBenefit: payload.expectedBenefit,
      deliveryDate: payload.deliveryDate || existing.deliveryDate,
      followUpDate:
        payload.followUpDate !== undefined
          ? payload.followUpDate
          : existing.followUpDate,
      status: payload.status || existing.status,
      memo: payload.memo
        ? existing.memo && existing.memo !== payload.memo
          ? `${payload.memo}\n${existing.memo}`
          : payload.memo
        : existing.memo,
      orderNo: payload.orderNo || existing.orderNo,
      giftItems: payload.giftItems || existing.giftItems,
      quotes: nextQuotes,
      deletedAt: undefined,
    };

    updatedList = [
      savedCustomer,
      ...current.filter((_, idx) => idx !== existingIndex),
    ];
  } else {
    savedCustomer = {
      id: `CUST-${Date.now()}`,
      regDate: nowStr,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      items: payload.items,
      paidAmount: payload.paidAmount,
      netAmount: payload.netAmount,
      expectedBenefit: payload.expectedBenefit,
      deliveryDate: payload.deliveryDate,
      followUpDate: payload.followUpDate || '',
      status: payload.status,
      memo: payload.memo,
      orderNo: payload.orderNo || '',
      giftItems: payload.giftItems || '',
      giftSent: false,
      logisticsConfirmed: false,
      quotes: [newQuote],
    };

    updatedList = [savedCustomer, ...current];
  }

  const deduped = setCachedCustomers(updatedList);
  await syncCustomerToGas('upsertCustomer', savedCustomer);

  return {
    customers: deduped,
    savedCustomer,
    isExistingCustomer,
    quoteCount: savedCustomer.quotes?.length || 1,
  };
}

export async function fetchCustomers(): Promise<CustomerItem[]> {
  return getCachedCustomers();
}

export async function saveCustomerToSheet(
  customer: CustomerItem
): Promise<boolean> {
  const list = getCachedCustomers();
  const idx = list.findIndex((c) => c.id === customer.id);
  const next =
    idx >= 0
      ? list.map((c, i) => (i === idx ? customer : c))
      : [customer, ...list];
  setCachedCustomers(next);
  return true;
}

export async function syncCustomerToGas(
  action: 'create' | 'update' | 'delete' | 'upsertCustomer',
  customer: Partial<CustomerItem> & { id: string }
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineMutation({
      domain: 'crm',
      action,
      payload: customer,
    });
  }
  return true;
}
