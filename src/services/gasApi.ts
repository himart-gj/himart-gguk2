import { CustomerItem, PipelineStatus, QuoteRecord, ConsultationLog, DeletedCustomerRecord } from '../types/crm';
import { formatLocalDate, formatLocalDateTime } from '../utils/date';

const STORAGE_KEY_CUSTOMERS = 'himart_crm_customers';
const STORAGE_KEY_CUSTOMERS_LEGACY = 'himart_crm_customers_v6';
const STORAGE_KEY_DELETED_RECORDS = 'himart_crm_deleted_records';
const DELETED_RETENTION_DAYS = 30;
const DELETED_RETENTION_MS = DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Calculates D-Day relative to today's local date (KST).
 * e.g., 0 = Today, 1 = Tomorrow, -1 = Yesterday
 */
export function calculateDDay(dateStr?: string): number | null {
  if (!dateStr) return null;
  const match = String(dateStr).match(/(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
  let target: Date;
  if (match) {
    target = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  } else {
    target = new Date(dateStr);
  }
  if (isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Normalizes any status string to a canonical PipelineStatus
 */
export function normalizePipelineStatus(raw?: string, source: 'tab1' | 'tab2' = 'tab2', isSmsSent?: boolean): PipelineStatus {
  const s = (raw || '').trim();
  if (s === '신규/미발송' || s === '배송대기' || s === '물류대기' || s === '미구매/고민중' || s === '상담진행중' || s === '배송완료') {
    return s;
  }
  if (s.includes('완료') && (s.includes('배송') || s.includes('설치'))) return '배송완료';
  if (s.includes('물류') || s.includes('입고')) return '물류대기';
  if (s.includes('배송') && !s.includes('완료')) return '배송대기';
  if (s.includes('미구매') || s.includes('고민') || s.includes('보류') || s.includes('취소')) return '미구매/고민중';
  if (s.includes('상담') || s.includes('발송완료') || s.includes('발송 완료') || isSmsSent) return '상담진행중';
  if (s.includes('미발송') || s.includes('신규') || source === 'tab1') return '신규/미발송';
  return '상담진행중';
}

/**
 * 30일 경과 자동 영구삭제 및 휴지통 레코드 조회
 */
export function getDeletedCustomerRecords(): DeletedCustomerRecord[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_RECORDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    let changed = false;
    const validRecords: DeletedCustomerRecord[] = [];

    for (const rec of parsed) {
      if (!rec || !rec.customer) continue;
      const deletedTime = new Date(rec.deletedAt).getTime();
      const expiresTime = rec.expiresAt ? new Date(rec.expiresAt).getTime() : deletedTime + DELETED_RETENTION_MS;
      const remainingMs = expiresTime - now;

      if (remainingMs <= 0) {
        changed = true;
        continue;
      }

      const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      validRecords.push({
        id: rec.id || rec.customer.id,
        customer: rec.customer,
        deletedAt: rec.deletedAt,
        expiresAt: new Date(expiresTime).toISOString(),
        daysRemaining,
      });
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY_DELETED_RECORDS, JSON.stringify(validRecords));
    }

    return validRecords;
  } catch (e) {
    console.warn('Failed to parse deleted customer records', e);
    return [];
  }
}

export function isCustomerDeleted(customer: Partial<CustomerItem>): boolean {
  if (!customer || !customer.id) return false;
  const records = getDeletedCustomerRecords();
  return records.some((r) => r.id === customer.id || r.customer.id === customer.id);
}

export function markCustomerAsDeleted(customer: CustomerItem): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const records = getDeletedCustomerRecords().filter((r) => r.id !== customer.id);
    const now = new Date();
    const expires = new Date(now.getTime() + DELETED_RETENTION_MS);

    records.unshift({
      id: customer.id,
      customer,
      deletedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      daysRemaining: DELETED_RETENTION_DAYS,
    });

    localStorage.setItem(STORAGE_KEY_DELETED_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save deleted customer record', e);
  }
}

export function getDeletedCustomerCount(): number {
  return getDeletedCustomerRecords().length;
}

export function restoreIndividualCustomer(customerId: string): CustomerItem[] {
  const records = getDeletedCustomerRecords();
  const target = records.find((r) => r.id === customerId || r.customer.id === customerId);
  const remaining = records.filter((r) => r.id !== customerId && r.customer.id !== customerId);
  localStorage.setItem(STORAGE_KEY_DELETED_RECORDS, JSON.stringify(remaining));

  const current = getCachedCustomers();
  if (target && target.customer) {
    const updated = deduplicateCustomers([target.customer, ...current]);
    saveCachedCustomers(updated);
    return updated;
  }
  return current;
}

export function permanentlyDeleteCustomer(customerId: string): void {
  const remaining = getDeletedCustomerRecords().filter((r) => r.id !== customerId && r.customer.id !== customerId);
  localStorage.setItem(STORAGE_KEY_DELETED_RECORDS, JSON.stringify(remaining));
}

export function restoreAllDeletedCustomers(): CustomerItem[] {
  const records = getDeletedCustomerRecords();
  const restoredCustomers = records.map((r) => r.customer).filter(Boolean);
  localStorage.removeItem(STORAGE_KEY_DELETED_RECORDS);

  const current = getCachedCustomers();
  const updated = deduplicateCustomers([...restoredCustomers, ...current]);
  saveCachedCustomers(updated);
  return updated;
}

export function purgeAllDeletedCustomers(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_DELETED_RECORDS);
}

/**
 * Deduplicate customers by ID while refreshing D-Day
 */
export function deduplicateCustomers(list: CustomerItem[]): CustomerItem[] {
  const seenIds = new Set<string>();
  const result: CustomerItem[] = [];

  for (const item of list) {
    if (!item || !item.id) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    result.push({
      ...item,
      status: normalizePipelineStatus(item.status, item.source, item.isSmsSent),
      dDay: calculateDDay(item.deliveryDate),
    });
  }

  return result;
}

/**
 * 100% LocalStorage Customer Loader (No sanitize re-parsing to preserve user edits)
 */
export function getCachedCustomers(): CustomerItem[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    let raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS_LEGACY);
    }
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const validCustomers = parsed.filter((c: any) => c && !isCustomerDeleted(c));
        return deduplicateCustomers(validCustomers);
      }
    }
  } catch (e) {
    console.error('Failed to parse cached customers', e);
  }
  return [];
}

/**
 * Save customers directly to LocalStorage
 */
export function saveCachedCustomers(customers: CustomerItem[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const cleaned = deduplicateCustomers(customers);
    localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed to save customers to localStorage', e);
  }
}

/**
 * Save or update a QuoteRecord inside a customer's CRM card
 */
export function saveCustomerQuote(
  customerId: string,
  quote: QuoteRecord,
  customerInfo?: {
    name?: string;
    phone?: string;
    date?: string;
    slipNo?: string;
    deliveryDate?: string;
  },
  overwriteQuoteId?: string
): CustomerItem[] {
  const list = getCachedCustomers();
  const cleanTargetPhone = (customerInfo?.phone || '').replace(/\D/g, '');
  const targetName = (customerInfo?.name || '').trim();

  let targetIndex = list.findIndex((c) => c.id === customerId);

  if (targetIndex === -1 && cleanTargetPhone.length >= 8) {
    targetIndex = list.findIndex((c) => (c.phone || '').replace(/\D/g, '') === cleanTargetPhone);
  }
  if (targetIndex === -1 && targetName && targetName !== '신규 고객' && targetName !== '이름없음') {
    targetIndex = list.findIndex((c) => c.name === targetName);
  }

  const benefitParts: string[] = [];
  if (quote.lumpCard && quote.lumpCard !== '미정(상담안함)') benefitParts.push(quote.lumpCard);
  if (quote.lumpDc && quote.lumpDc > 0) benefitParts.push(`할인 ${(quote.lumpDc / 10000).toFixed(0)}만`);
  if (quote.lumpCash && quote.lumpCash > 0) benefitParts.push(`캐시백 ${(quote.lumpCash / 10000).toFixed(0)}만`);
  if (quote.subCardCorp && quote.subCardCorp !== 'none') benefitParts.push(`구독카드(${quote.subCardCorp})`);

  if (targetIndex !== -1) {
    const existing = list[targetIndex];
    const existingQuotes = Array.isArray(existing.quotes) ? [...existing.quotes] : [];

    if (overwriteQuoteId) {
      const qIdx = existingQuotes.findIndex((q) => q.id === overwriteQuoteId || q.id === quote.id);
      if (qIdx !== -1) {
        existingQuotes[qIdx] = quote;
      } else {
        existingQuotes.unshift(quote);
      }
    } else {
      const qIdx = existingQuotes.findIndex((q) => q.id === quote.id);
      if (qIdx !== -1) {
        existingQuotes[qIdx] = quote;
      } else {
        existingQuotes.unshift(quote);
      }
    }

    const updatedDeliveryDate = customerInfo?.deliveryDate || existing.deliveryDate;

    list[targetIndex] = {
      ...existing,
      name: targetName && targetName !== '신규 고객' ? targetName : existing.name,
      phone: customerInfo?.phone || existing.phone,
      slipNo: customerInfo?.slipNo || existing.slipNo,
      deliveryDate: updatedDeliveryDate,
      dDay: calculateDDay(updatedDeliveryDate),
      items: quote.itemSummary || existing.items,
      paidAmount: quote.paidAmount,
      netAmount: quote.netAmount,
      benefit: benefitParts.length > 0 ? benefitParts.join(' + ') : existing.benefit,
      note: quote.internalMemo ? quote.internalMemo : existing.note,
      quotes: existingQuotes,
    };
  } else {
    const newDeliveryDate = customerInfo?.deliveryDate || undefined;
    const newCustomer: CustomerItem = {
      id: customerId || 'crm-' + Date.now(),
      source: customerInfo?.slipNo ? 'tab2' : 'tab1',
      name: targetName || '신규 고객',
      phone: customerInfo?.phone || '',
      slipNo: customerInfo?.slipNo || '',
      category: quote.itemSummary || '가전 견적 상담',
      items: quote.itemSummary || '가전 견적 상담',
      paidAmount: quote.paidAmount,
      netAmount: quote.netAmount,
      benefit: benefitParts.join(' + '),
      deliveryDate: newDeliveryDate,
      date: customerInfo?.date || formatLocalDate(new Date()),
      status: '신규/미발송',
      rawStatus: '신규/미발송',
      note: quote.internalMemo || '',
      dDay: calculateDDay(newDeliveryDate),
      isSmsSent: false,
      quotes: [quote],
      logs: [
        {
          id: 'log-' + Date.now(),
          date: formatLocalDateTime(new Date()),
          type: '견적산출',
          content: `[견적생성] ${quote.title} (실결제 ${quote.paidAmount.toLocaleString()}원 / 체감가 ${quote.netAmount.toLocaleString()}원)`,
          author: '담당자',
        },
      ],
    };
    list.unshift(newCustomer);
  }

  saveCachedCustomers(list);
  return list;
}

export function deleteCustomerQuote(customerId: string, quoteId: string): CustomerItem[] {
  const list = getCachedCustomers().map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        quotes: (c.quotes || []).filter((q) => q.id !== quoteId),
      };
    }
    return c;
  });
  saveCachedCustomers(list);
  return list;
}

export function addCustomerLog(customerId: string, log: ConsultationLog): CustomerItem[] {
  const list = getCachedCustomers().map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        logs: [log, ...(c.logs || [])],
      };
    }
    return c;
  });
  saveCachedCustomers(list);
  return list;
}

export function deleteCustomerLog(customerId: string, logId: string): CustomerItem[] {
  const list = getCachedCustomers().map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        logs: (c.logs || []).filter((l) => l.id !== logId),
      };
    }
    return c;
  });
  saveCachedCustomers(list);
  return list;
}

export function updateCustomerGift(customerId: string, giftItem: string, isGiftDelivered: boolean): CustomerItem[] {
  const list = getCachedCustomers().map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        giftItem: giftItem.trim(),
        isGiftDelivered,
      };
    }
    return c;
  });
  saveCachedCustomers(list);
  return list;
}

export function deleteCustomer(customerId: string): CustomerItem[] {
  const list = getCachedCustomers();
  const target = list.find((c) => c.id === customerId);
  if (target) {
    markCustomerAsDeleted(target);
  }
  const remaining = list.filter((c) => c.id !== customerId);
  saveCachedCustomers(remaining);
  return remaining;
}

/**
 * Full LocalStorage Backup Export (.json)
 */
export function exportFullBackupJson(): string {
  const payload = {
    version: '2.0-local-only',
    exportedAt: new Date().toISOString(),
    himart_crm_customers: getCachedCustomers(),
    app_customer_folders: (() => {
      try {
        return JSON.parse(localStorage.getItem('app_customer_folders') || '[]');
      } catch {
        return [];
      }
    })(),
    himart_crm_deleted_records: getDeletedCustomerRecords(),
    app_hipreed_rates: localStorage.getItem('app_hipreed_rates') || null,
    app_sub_cards: localStorage.getItem('app_sub_cards') || null,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Full LocalStorage Backup Restore (.json)
 */
export function importFullBackupJson(rawJson: string): { success: boolean; count: number; message: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, count: 0, message: '올바른 백업 JSON 파일 형식이 아닙니다.' };
    }

    let restoredCount = 0;

    if (Array.isArray(parsed.himart_crm_customers)) {
      saveCachedCustomers(parsed.himart_crm_customers);
      restoredCount = parsed.himart_crm_customers.length;
    } else if (Array.isArray(parsed)) {
      saveCachedCustomers(parsed);
      restoredCount = parsed.length;
    }

    if (Array.isArray(parsed.app_customer_folders)) {
      localStorage.setItem('app_customer_folders', JSON.stringify(parsed.app_customer_folders));
    }

    if (Array.isArray(parsed.himart_crm_deleted_records)) {
      localStorage.setItem(STORAGE_KEY_DELETED_RECORDS, JSON.stringify(parsed.himart_crm_deleted_records));
    }

    if (typeof parsed.app_hipreed_rates === 'string' && parsed.app_hipreed_rates) {
      localStorage.setItem('app_hipreed_rates', parsed.app_hipreed_rates);
    }

    if (typeof parsed.app_sub_cards === 'string' && parsed.app_sub_cards) {
      localStorage.setItem('app_sub_cards', parsed.app_sub_cards);
    }

    return {
      success: true,
      count: restoredCount,
      message: `백업 파일 복원 완료! 총 ${restoredCount}명의 고객 데이터가 기기에 복구되었습니다.`,
    };
  } catch (e: any) {
    return {
      success: false,
      count: 0,
      message: `백업 파일 파싱 오류: ${e?.message || '파일 내용을 확인해주세요.'}`,
    };
  }
}
