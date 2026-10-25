import { CustomerItem, CustomerStatus, QuoteRecord } from '../types/crm';
import { INITIAL_CUSTOMERS } from '../data/mockData';
import { getNowDateTimeStr } from '../utils/date';

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzbd3L6eB-3_z8xSw-wch23yBe6zEesf-2yVVf7c-gE080BzH-G8d7cV8z2iH2s5t13/exec';

const STORAGE_KEY_URL = 'gookji_crm_gas_url';
const STORAGE_KEY_CACHE = 'gookji_crm_customers_cache_v3';

export function getGasUrl(): string {
  return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_GAS_URL;
}

export function setGasUrl(url: string): void {
  if (!url.trim()) {
    localStorage.removeItem(STORAGE_KEY_URL);
  } else {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
  }
}

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
  return INITIAL_CUSTOMERS;
}

export function setCachedCustomers(customers: CustomerItem[]): CustomerItem[] {
  const deduped = deduplicateCustomers(customers);
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(deduped));
  } catch (e) {
    console.error('Failed to save local customer cache', e);
  }
  return deduped;
}

function normalizeStatus(raw: string): CustomerStatus {
  const valid: CustomerStatus[] = [
    '신규/미발송',
    '발송완료',
    '상담진행중',
    '미구매/고민중',
    '계약완료',
    '취소/보류',
  ];
  const trimmed = (raw || '').trim() as CustomerStatus;
  return valid.includes(trimmed) ? trimmed : '신규/미발송';
}

export async function fetchCustomersFromGas(): Promise<{
  customers: CustomerItem[];
  fromCloud: boolean;
}> {
  const url = getGasUrl();
  const localCache = getCachedCustomers();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rows: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.customers)
      ? data.customers
      : [];

    if (rows.length > 0) {
      const cloudMapped: CustomerItem[] = rows.map((r, idx) => ({
        id: String(r.id || r.ID || `row-${idx + 1}`),
        regDate: String(r.regDate || r['등록일시'] || r.date || '2025-05-15 10:00'),
        name: String(r.name || r['고객명'] || '이름없음'),
        phone: String(r.phone || r['연락처'] || ''),
        items: String(r.items || r['관심품목'] || r['상담품목'] || ''),
        paidAmount: Number(r.paidAmount ?? r['결제금액'] ?? 0) || 0,
        netAmount: Number(r.netAmount ?? r['체감가'] ?? 0) || 0,
        expectedBenefit: String(r.expectedBenefit || r['예상혜택'] || ''),
        deliveryDate: String(r.deliveryDate || r['배송희망일'] || ''),
        status: normalizeStatus(r.status || r['상태']),
        memo: String(r.memo || r['상담메모'] || ''),
        orderNo: String(r.orderNo || r['전표번호'] || ''),
        giftItems: String(r.giftItems || r['사은품'] || ''),
        giftSent: Boolean(r.giftSent ?? r['사은품지급'] ?? false),
        logisticsConfirmed: Boolean(
          r.logisticsConfirmed ?? r['물류확정'] ?? false
        ),
        followUpDate: String(r.followUpDate || r['재연락예정일'] || ''),
        quotes: Array.isArray(r.quotes) ? r.quotes : [],
      }));

      const combined = deduplicateCustomers([...localCache, ...cloudMapped]);
      setCachedCustomers(combined);
      return { customers: combined, fromCloud: true };
    }
  } catch (err) {
    console.warn('GAS Cloud fetch fallback to local cache:', err);
  }

  return { customers: localCache, fromCloud: false };
}

export async function saveCustomerQuote(payload: {
  targetCustomerId?: string; // 기존 고객 ID 직접 지정 시
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

export async function syncCustomerToGas(
  action: 'create' | 'update' | 'delete' | 'upsertCustomer',
  customer: Partial<CustomerItem> & { id: string }
): Promise<boolean> {
  const url = getGasUrl();
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        customer,
        timestamp: new Date().toISOString(),
      }),
    });
    return true;
  } catch (err) {
    console.warn('GAS sync warning (saved locally):', err);
    return false;
  }
}
