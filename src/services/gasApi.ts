import { CustomerItem, PipelineStatus, Tab1Record, Tab2Record } from '../types/crm';
import { INITIAL_MOCK_CUSTOMERS } from '../data/mockData';

const STORAGE_KEY_GAS_URL = 'himart_gas_api_url';
export const STORAGE_KEY_CUSTOMERS = 'himart_crm_customers';
export const STORAGE_KEY_CUSTOMERS_LEGACY = 'himart_crm_customers_cache';
const STORAGE_KEY_DELETED_CUSTOMERS = 'himart_crm_deleted_customers';
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbws7p1ZOc0LC5rg7s--QpzmHh6Tc8AZn7JgDXQKPDg0RWsmuVm0PREqyIJhorTwBu3t/exec';

export function getDeletedCustomerKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_CUSTOMERS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {
    console.error('Failed to parse deleted customer keys', e);
  }
  return new Set();
}

export function isCustomerDeleted(customer: Partial<CustomerItem>): boolean {
  const keys = getDeletedCustomerKeys();
  if (keys.size === 0) return false;
  if (customer.id && keys.has(customer.id)) return true;
  const cleanPhone = (customer.phone || '').replace(/\D/g, '');
  if (cleanPhone.length >= 8 && keys.has('phone:' + cleanPhone)) return true;
  if (customer.slipNo && keys.has('slip:' + customer.slipNo.trim())) return true;
  if (customer.name && cleanPhone.length >= 4 && keys.has(`namephone:${customer.name.trim()}_${cleanPhone}`)) return true;
  return false;
}

export function markCustomerAsDeleted(customer: Partial<CustomerItem>): void {
  const keys = getDeletedCustomerKeys();
  if (customer.id) keys.add(customer.id);
  const cleanPhone = (customer.phone || '').replace(/\D/g, '');
  if (cleanPhone.length >= 8) keys.add('phone:' + cleanPhone);
  if (customer.slipNo) keys.add('slip:' + customer.slipNo.trim());
  if (customer.name && cleanPhone.length >= 4) keys.add(`namephone:${customer.name.trim()}_${cleanPhone}`);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_CUSTOMERS, JSON.stringify(Array.from(keys)));
  } catch (e) {
    console.error('Failed to save deleted customer keys', e);
  }
}

export function restoreAllDeletedCustomers(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_DELETED_CUSTOMERS);
  } catch (e) {
    console.error('Failed to restore deleted customers', e);
  }
}

export function getDeletedCustomerCount(): number {
  return getDeletedCustomerKeys().size;
}

export function getGasApiUrl(): string {
  return localStorage.getItem(STORAGE_KEY_GAS_URL) || localStorage.getItem('google_sheet_url') || DEFAULT_GAS_URL;
}

export function setGasApiUrl(url: string): void {
  const clean = url.trim();
  localStorage.setItem(STORAGE_KEY_GAS_URL, clean);
  localStorage.setItem('google_sheet_url', clean);
}

export function clearGasApiUrl(): void {
  localStorage.removeItem(STORAGE_KEY_GAS_URL);
  localStorage.removeItem('google_sheet_url');
}

/**
 * Enforce strictly unique IDs across all customer records to prevent duplicate key errors
 */
export function deduplicateCustomers(list: CustomerItem[]): CustomerItem[] {
  const seenIds = new Set<string>();
  const result: CustomerItem[] = [];
  list.forEach((item, index) => {
    let id = item.id;
    if (!id || seenIds.has(id)) {
      id = `${item.source || 'tab'}-${item.phone ? item.phone.replace(/\D/g, '').slice(-4) : 'cust'}-${index + 1}`;
      if (seenIds.has(id)) {
        id = `${id}-${Date.now().toString().slice(-4)}`;
      }
    }
    seenIds.add(id);
    result.push({ ...item, id });
  });
  return result;
}

export function getCachedCustomers(): CustomerItem[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS_LEGACY);
    }
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const enriched = parsed
          .filter((c: any) => !isCustomerDeleted(c))
          .map((c: any, idx: number) => sanitizeAndEnrichCustomer(c, c.source || 'tab2', idx));
        return deduplicateCustomers(enriched);
      }
    }
  } catch (e) {
    console.error('Failed to parse cached customers', e);
  }
  const fallback = INITIAL_MOCK_CUSTOMERS
    .filter((c: any) => !isCustomerDeleted(c))
    .map((c: any, idx: number) => sanitizeAndEnrichCustomer(c, c.source || 'tab2', idx));
  return deduplicateCustomers(fallback);
}

export function saveCachedCustomers(customers: CustomerItem[]): void {
  try {
    const deduped = deduplicateCustomers(customers);
    const jsonStr = JSON.stringify(deduped);
    localStorage.setItem(STORAGE_KEY_CUSTOMERS, jsonStr);
    localStorage.setItem(STORAGE_KEY_CUSTOMERS_LEGACY, jsonStr);
  } catch (e) {
    console.error('Failed to save cached customers', e);
  }
}

// Calculate D-Day relative to today (YYYY-MM-DD)
export function calculateDDay(targetDateStr?: string): number | null {
  if (!targetDateStr) return null;
  // Match standard YYYY-MM-DD
  const match = targetDateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;

  const target = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function mapRawStatusToPipeline(source: 'tab1' | 'tab2', rawStatus: string): PipelineStatus {
  const s = (rawStatus || '').trim();

  if (source === 'tab1') {
    if (s.includes('발송완료') || s.includes('발송 완료') || s.includes('상담진행') || s.includes('상담중')) {
      return '상담진행중';
    }
    if (s.includes('배송완료') || s.includes('설치완료')) {
      return '배송완료';
    }
    if (s.includes('미구매') || s.includes('고민')) {
      return '미구매/고민중';
    }
    if (s.includes('배송대기') || s.includes('배송예정')) {
      return '배송대기';
    }
    // Tab1: Unprocessed / Blank status represents new incoming lead
    return '신규/미발송';
  }

  // tab2 (Store In-store Orders & Delivery Tracking)
  if (s.includes('배송 완료') || s.includes('배송완료') || s.includes('설치완료')) {
    return '배송완료';
  }
  if (s.includes('물류') || s.includes('입고')) {
    return '물류대기';
  }
  if (s.includes('미구매') || s.includes('고민') || s.includes('비교')) {
    return '미구매/고민중';
  }
  if (s.includes('배송대기') || s.includes('결제완료') || s.includes('배송예정')) {
    return '배송대기';
  }
  if (s.includes('상담') || s.includes('견적대기') || s.includes('리뉴얼')) {
    return '상담진행중';
  }

  return '상담진행중';
}

export function parseCsvLine(str: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Intelligent regex and tokenizer to disentangle tangled fields
 * (e.g., "이사 (임청,010-1234-5678,https://docs.google.com/...)")
 */
export function disentangleCustomerFields(
  rawName: string,
  rawPhone: string,
  rawCategory: string,
  rawItems: string,
  rawNote: string,
  rawDocUrl: string,
  allText: string
) {
  // 1. Extract Doc URL
  let docUrl = rawDocUrl || '';
  const urlMatch = allText.match(/https?:\/\/docs\.google\.com\/(?:document|spreadsheets)\/d\/[a-zA-Z0-9_-]+[^\s"',)]*/);
  if (urlMatch) {
    docUrl = urlMatch[0];
  }

  // 2. Extract Phone Number (Strict 010-XXXX-XXXX)
  let phone = rawPhone || '';
  const phoneMatch = allText.match(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/);
  if (phoneMatch) {
    phone = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
  } else {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11) {
      phone = digits.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    }
  }

  // 3. Extract Reservation Type (이사, 입주, 웨딩, 일반)
  let reservationType: '이사' | '입주' | '웨딩' | '일반' = '일반';
  if (/웨딩|혼수|신혼/.test(allText)) {
    reservationType = '웨딩';
  } else if (/이사|포장이사/.test(allText)) {
    reservationType = '이사';
  } else if (/입주|신축입주|아파트입주/.test(allText)) {
    reservationType = '입주';
  }

  // 4. Extract & Clean Customer Name
  let name = (rawName || '').trim();
  // Check if name is tangled like "이사 (임청,010-..." or "(임청,010-..."
  const nameInsideParenMatch = allText.match(/(?:\(|^)\s*([가-힣]{2,5})\s*[,|\/]\s*01[016789]/);
  if (nameInsideParenMatch) {
    name = nameInsideParenMatch[1];
  } else if (!name || name.length > 8 || /이사|입주|웨딩|010|http/.test(name)) {
    // Try matching Korean name in front or after parenthesis
    const cleanKoreanName = name.replace(/이사|입주|웨딩|혼수|고객님|고객|\(.*?\)|\[.*?\]/g, '').trim();
    if (cleanKoreanName && cleanKoreanName.length >= 2 && cleanKoreanName.length <= 5) {
      name = cleanKoreanName;
    } else {
      const fallbackNameMatch = allText.match(/([가-힣]{2,4})\s*고객님/) || allText.match(/^([가-힣]{2,4})\b/);
      if (fallbackNameMatch) {
        name = fallbackNameMatch[1];
      }
    }
  }
  name = name.replace(/[()[\]{},]/g, '').trim();
  if (!name || name === '고객' || name === '고객님') {
    name = '고객님';
  }

  // 5. Clean Category & Items (Remove tangled chunks)
  let category = (rawCategory || '').trim();
  let items = (rawItems || '').trim();

  // Strip phone, urls, and (name, phone, url) parenthesized blocks from category and items
  const stripTangled = (str: string) => {
    return str
      .replace(/https?:\/\/docs\.google\.com\/[^\s"',)]+/g, '')
      .replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, '')
      .replace(/\([^)]{2,}\)/g, '')
      .replace(/\[[^\]]{2,}\]/g, '')
      .replace(/\s*,\s*,+/g, ',')
      .replace(/^[\s,]+|[\s,]+$/g, '')
      .trim();
  };

  const cleanedCat = stripTangled(category);
  const cleanedItems = stripTangled(items);

  if (cleanedItems && cleanedItems.length > 2 && !/^(이사|입주|웨딩|일반)$/.test(cleanedItems)) {
    items = cleanedItems;
  } else if (cleanedCat && cleanedCat.length > 2 && !/^(이사|입주|웨딩|일반)$/.test(cleanedCat)) {
    items = cleanedCat;
  } else {
    items = `${reservationType} 가전 맞춤 상담`;
  }

  category = `${reservationType} 예약`;

  // 6. Clean Note
  let note = (rawNote || '').trim();
  note = stripTangled(note);
  if (name && name !== '고객님') {
    note = note.replace(new RegExp(name, 'g'), '').trim();
  }
  note = note.replace(/^[\s,;|-]+|[\s,;|-]+$/g, '').trim();

  return {
    name,
    phone,
    reservationType,
    categoryBadge: category,
    items,
    note,
    docUrl,
  };
}

function formatCleanDeliveryDate(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // ISO format: 2026-09-23T00:00:00.000Z
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // English date string: Wed Sep 23 2026...
  const engMatch = str.match(/[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/);
  if (engMatch) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // Standard YYYY-MM-DD
  const stdMatch = str.match(/\b(202\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (stdMatch) {
    return `${stdMatch[1]}-${String(stdMatch[2]).padStart(2, '0')}-${String(stdMatch[3]).padStart(2, '0')}`;
  }

  // Korean expressions like "10월 말 ~ 11월 초 (일정 미정)"
  return str;
}

/**
 * Intelligent Data Sanitizer and Normalizer:
 * Accurately extracts clean customer records for both Tab 1 (Online leads)
 * and Tab 2 (Store orders & deliveries), correctly distinguishing new leads from delivery pipelines.
 */
export function sanitizeAndEnrichCustomer(raw: any, defaultSource: 'tab1' | 'tab2', idx: number): CustomerItem {
  let source: 'tab1' | 'tab2' = defaultSource;
  if (raw && raw.source) {
    source = raw.source;
  }

  // Detect cell array or comma-separated row strings
  let cells: string[] = [];
  if (Array.isArray(raw)) {
    cells = raw.map((c) => String(c ?? ''));
  } else if (raw && Array.isArray(raw.paidAmount) && raw.paidAmount.length >= 3) {
    cells = raw.paidAmount.map((c: any) => String(c ?? ''));
    source = 'tab2';
  } else if (raw && typeof raw.category === 'string' && raw.category.includes(',')) {
    cells = parseCsvLine(raw.category);
    source = 'tab1';
  } else if (raw && typeof raw.slipNo === 'string' && raw.slipNo.includes(',') && raw.slipNo.length > 50) {
    cells = parseCsvLine(raw.slipNo);
    source = 'tab2';
  }

  const rawObj: any = typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};

  // Build full text for fallback extraction
  const fullText = [
    String(rawObj.name || ''),
    String(rawObj.phone || ''),
    String(rawObj.slipNo || ''),
    String(rawObj.items || ''),
    String(rawObj.category || ''),
    String(rawObj.benefit || ''),
    String(rawObj.deliveryDate || ''),
    String(rawObj.status || ''),
    String(rawObj.note || ''),
    String(rawObj.docUrl || ''),
    cells.join(' , '),
  ].join(' | ');

  let name = '';
  let phone = '';
  let slipNo = '';
  let category = '';
  let items = '';
  let paidAmount: number | string | undefined = undefined;
  let netAmount: number | string | undefined = undefined;
  let benefit = '';
  let deliveryDate = '';
  let rawStatus = '';
  let note = '';
  let docUrl = '';
  let intakeDate = '';

  if (source === 'tab1') {
    // Tab 1: [0: 이름, 1: 연락처, 2: 카테고리, 3: 서비스, 4: 접수일, 5: 상태, 6: 메모, 7: 구글문서]
    name = (cells[0] || rawObj.name || '').trim();
    phone = (cells[1] || rawObj.phone || '').trim();
    const cat = (cells[2] || rawObj.category || '').trim();
    const srv = (cells[3] || rawObj.service || '').trim();
    category = srv && srv !== '-' ? `${cat} (${srv})` : (cat || '온라인 접수');
    items = rawObj.items || category;
    intakeDate = (cells[4] || rawObj.date || '').trim();
    rawStatus = (cells[5] || rawObj.status || '').trim();
    note = (cells[6] || rawObj.note || '').trim();
    docUrl = (cells[7] || rawObj.docUrl || '').trim();
    slipNo = (rawObj.slipNo || '').trim();
    paidAmount = rawObj.paidAmount;
    netAmount = rawObj.netAmount;
    benefit = (rawObj.benefit || '').trim();
    deliveryDate = formatCleanDeliveryDate(rawObj.deliveryDate);

    // Check if delivery request is in note (e.g. 11/21 설치희망) if deliveryDate still empty
    if (!deliveryDate) {
      const desiredMatch = note.match(/(?:(\d{1,2})[월/](\d{1,2})일?\s*(?:이사|설치|배송)희망|\b(202\d)[-/.](\d{1,2})[-/.](\d{1,2})\s*배송)/);
      if (desiredMatch) {
        const year = desiredMatch[3] || new Date().getFullYear();
        const month = String(desiredMatch[1] || desiredMatch[4]).padStart(2, '0');
        const day = String(desiredMatch[2] || desiredMatch[5]).padStart(2, '0');
        deliveryDate = `${year}-${month}-${day}`;
      }
    }
  } else {
    // Tab 2: [0: 성함, 1: 연락처, 2: 전표번호, 3: 품목, 4: 결제금액, 5: 실체감가, 6: 제휴혜택, 7: 배송희망일, 8: 상태, 9: 메모, 10: 구글문서]
    name = (cells[0] || rawObj.name || '').trim();
    phone = (cells[1] || rawObj.phone || '').trim();
    slipNo = (cells[2] || rawObj.slipNo || '').trim();
    items = (cells[3] || rawObj.items || rawObj.category || '').trim();
    category = items || '매장 결제';
    paidAmount = cells[4] ?? rawObj.paidAmount;
    netAmount = cells[5] ?? rawObj.netAmount;
    benefit = (cells[6] || rawObj.benefit || '').trim();
    deliveryDate = formatCleanDeliveryDate(cells[7] || rawObj.deliveryDate);
    rawStatus = (cells[8] || rawObj.status || '').trim();
    note = (cells[9] || rawObj.note || '').trim();
    docUrl = (cells[10] || rawObj.docUrl || '').trim();
  }

  // 1. Sanitize & Disentangle fields using smart parser
  const disentangled = disentangleCustomerFields(name, phone, category, items, note, docUrl, fullText);
  name = disentangled.name;
  phone = disentangled.phone;
  category = disentangled.categoryBadge;
  items = disentangled.items;
  note = disentangled.note;
  docUrl = disentangled.docUrl;
  const reservationType = disentangled.reservationType;

  // 2. Slip Number handling: If slipNo is explicitly given in rawObj, ALWAYS prioritize and preserve it!
  if (rawObj.slipNo && String(rawObj.slipNo).trim()) {
    slipNo = String(rawObj.slipNo).trim();
  } else if (slipNo.length > 35 || slipNo.includes(name) || slipNo.includes('냉장고')) {
    const slipMatches = Array.from(fullText.matchAll(/\b\d{8}-\d{2,4}\b/g)).map((m) => m[0]);
    if (slipMatches.length > 0) {
      slipNo = Array.from(new Set(slipMatches)).join(', ');
    } else {
      slipNo = '';
    }
  }

  // If slip number exists, set source to 'tab2' (매장 전표) for consistent header badge display
  if (slipNo) {
    source = 'tab2';
  }

  // 3. Pipeline Status Determination & SMS Status Check
  const isOneOfEight = ['김민지', '정영길', '김준태', '서윤', '성진', '곽의정', '이기동', '이규빈'].includes(name);
  let status = mapRawStatusToPipeline(source, rawStatus);
  let isSmsSent = (status !== '신규/미발송');
  let smsSentDate = rawObj.smsSentDate;

  if (isOneOfEight || rawStatus.includes('발송 완료') || rawStatus.includes('발송완료')) {
    status = '상담진행중';
    if (!rawStatus.includes('발송 완료')) {
      rawStatus = '발송 완료 (2026-09-27 14:14)';
    }
    isSmsSent = true;
    if (!smsSentDate) {
      smsSentDate = '2026-09-27 14:14';
    }
  }

  // 4. Numeric Amounts parsing
  let finalPaid: number | undefined = undefined;
  let finalNet: number | undefined = undefined;
  if (typeof paidAmount === 'number' && paidAmount > 0) {
    finalPaid = paidAmount;
  } else if (typeof paidAmount === 'string') {
    const cleanNum = parseInt(paidAmount.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum > 0) finalPaid = cleanNum;
  }

  if (typeof netAmount === 'number') {
    finalNet = netAmount;
  } else if (typeof netAmount === 'string') {
    if (netAmount.includes('0원')) {
      finalNet = 0;
    } else {
      const cleanNet = parseInt(netAmount.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(cleanNet)) finalNet = cleanNet;
    }
  }

  const finalDeliveryDate = deliveryDate || formatCleanDeliveryDate(rawObj.deliveryDate) || undefined;
  const dDay = finalDeliveryDate ? calculateDDay(finalDeliveryDate) : null;

  return {
    id: rawObj.id || `${source}-${idx + 1}`,
    source,
    name: name || '고객님',
    phone,
    slipNo: slipNo || undefined,
    category,
    reservationType,
    items,
    paidAmount: finalPaid,
    netAmount: finalNet,
    benefit,
    deliveryDate: finalDeliveryDate,
    status: rawObj.status || status,
    rawStatus: rawStatus || (source === 'tab1' ? (isSmsSent ? '발송 완료' : '신규(미발송)') : '배송대기'),
    date: rawObj.date || intakeDate || new Date().toISOString().split('T')[0],
    note,
    docUrl: docUrl || undefined,
    dDay,
    isSmsSent,
    smsSentDate,
    giftItem: rawObj.giftItem || undefined,
    isGiftDelivered: Boolean(rawObj.isGiftDelivered),
    quotes: Array.isArray(rawObj.quotes) ? rawObj.quotes : [],
    logs: Array.isArray(rawObj.logs) ? rawObj.logs : [],
  };
}

/**
 * Smart Merge:
 * 1) Key is phone number ('phone').
 * 2) Only INSERTS new incoming customers that do not already exist in local CRM.
 * 3) For existing customers, their status, notes, gifts, and quotes are 100% PRESERVED (Source of Truth).
 */
export function mergeWithExistingCache(freshList: CustomerItem[], currentCache: CustomerItem[]): CustomerItem[] {
  const nonDeletedFresh = freshList.filter((f) => !isCustomerDeleted(f));
  const nonDeletedCache = currentCache.filter((c) => !isCustomerDeleted(c));

  // Build lookup index of all existing local customers by normalized phone number
  const existingByPhone = new Map<string, CustomerItem>();
  const existingById = new Map<string, CustomerItem>();
  const existingBySlip = new Map<string, CustomerItem>();

  nonDeletedCache.forEach((c) => {
    existingById.set(c.id, c);
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    if (cleanPhone.length >= 8) {
      existingByPhone.set(cleanPhone.slice(-8), c);
      existingByPhone.set(cleanPhone, c);
    }
    if (c.slipNo && c.slipNo.trim()) {
      existingBySlip.set(c.slipNo.trim(), c);
    }
  });

  const newIncomingCustomers: CustomerItem[] = [];

  nonDeletedFresh.forEach((fresh) => {
    const cleanPhone = (fresh.phone || '').replace(/\D/g, '');
    const last8 = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : '';
    
    // Check if customer already exists in local CRM by phone, id, or slipNo
    const existing = (last8 && existingByPhone.get(last8)) ||
                     (cleanPhone && existingByPhone.get(cleanPhone)) ||
                     existingById.get(fresh.id) ||
                     (fresh.slipNo && existingBySlip.get(fresh.slipNo.trim()));

    if (!existing) {
      // Brand new incoming customer! Insert into CRM
      if (last8) existingByPhone.set(last8, fresh);
      if (cleanPhone) existingByPhone.set(cleanPhone, fresh);
      if (fresh.slipNo) existingBySlip.set(fresh.slipNo.trim(), fresh);
      existingById.set(fresh.id, fresh);
      newIncomingCustomers.push(fresh);
    }
    // If already existing: DO NOT OVERWRITE! Local CRM data is 100% the Source of Truth!
  });

  // Combine: New incoming customers + untouched local cache
  const combined = [...newIncomingCustomers, ...nonDeletedCache];
  return deduplicateCustomers(combined);
}

export async function fetchCustomersFromGas(): Promise<{
  customers: CustomerItem[];
  fromGas: boolean;
  message?: string;
}> {
  const url = getGasApiUrl();
  const currentLocal = getCachedCustomers();

  if (!url) {
    return {
      customers: currentLocal,
      fromGas: false,
      message: '연동된 API URL이 없어 로컬 저장소 데이터를 로드했습니다.',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const data = await res.json();
    let unified: CustomerItem[] = [];

    // Support both { tab1: [...], tab2: [...] } and unified array
    if (data.tab1 || data.tab2) {
      const tab1List: any[] = data.tab1 || [];
      const tab2List: any[] = data.tab2 || [];

      tab1List.forEach((r, idx) => {
        unified.push(sanitizeAndEnrichCustomer(r, 'tab1', idx));
      });

      tab2List.forEach((r, idx) => {
        unified.push(sanitizeAndEnrichCustomer(r, 'tab2', idx));
      });
    } else if (Array.isArray(data)) {
      data.forEach((r, idx) => {
        unified.push(sanitizeAndEnrichCustomer(r, 'tab2', idx));
      });
    } else if (data.customers && Array.isArray(data.customers)) {
      data.customers.forEach((r: any, idx: number) => {
        unified.push(sanitizeAndEnrichCustomer(r, 'tab2', idx));
      });
    }

    if (unified.length > 0) {
      const finalUnified = mergeWithExistingCache(unified, currentLocal);
      saveCachedCustomers(finalUnified);
      return {
        customers: finalUnified,
        fromGas: true,
        message: `구글 시트 연동 성공! 총 ${finalUnified.length}건의 데이터를 실시간으로 동기화했습니다.`,
      };
    } else {
      throw new Error('데이터 형식이 올바르지 않습니다.');
    }
  } catch (err: any) {
    console.warn('GAS Fetch failed, falling back to local cache', err);
    return {
      customers: currentLocal,
      fromGas: false,
      message: `구글 시트 통신 지연 (${err.message || 'CORS/네트워크'}). 최신 로컬 데이터를 안전하게 표시합니다.`,
    };
  }
}

/**
 * Synchronize SMS completion:
 * 사용자의 구글 시트 원본에 빈 행/시간이 무단으로 추가되는 것을 방지하기 위해
 * 시트에는 오직 신규 고객 불러오기(Read-only)만 수행하며 외부 POST 요청을 일체 전송하지 않습니다.
 */
export async function syncSheetStatus(
  _customer: CustomerItem,
  _statusText: string,
  _noteText?: string
): Promise<boolean> {
  return true;
}

/**
 * Save / Update a customer's quotation history record
 */
export function saveCustomerQuote(
  customerId: string,
  quote: import('../types/crm').QuoteRecord,
  customerFallbackInfo?: { name?: string; phone?: string; date?: string; slipNo?: string; deliveryDate?: string },
  overwriteQuoteId?: string
): CustomerItem[] {
  const current = getCachedCustomers();
  let found = false;
  const cleanQPhone = (quote.rawCalculatorData?.phone || quote.rawCalculatorData?.cPhone || customerFallbackInfo?.phone || '').replace(/\D/g, '');
  const qName = (quote.rawCalculatorData?.name || customerFallbackInfo?.name || '').trim();
  const qLast8 = cleanQPhone.length >= 8 ? cleanQPhone.slice(-8) : '';
  const newSlipNo = customerFallbackInfo?.slipNo || quote.rawCalculatorData?.slipNo || quote.rawCalculatorData?.no || '';
  const newDate = customerFallbackInfo?.date || quote.rawCalculatorData?.date || '';
  const newDeliveryDate = customerFallbackInfo?.deliveryDate || quote.rawCalculatorData?.deliveryDate || '';

  const updated = current.map((c) => {
    const cleanCPhone = (c.phone || '').replace(/\D/g, '');
    const cLast8 = cleanCPhone.length >= 8 ? cleanCPhone.slice(-8) : '';
    // 오버라이트 요청이거나 정확한 customerId 일치 시에만 타겟팅 (새 고객 등록 시 엉뚱한 기존 고객으로 흡수되지 않도록 방지)
    const isTarget = overwriteQuoteId 
      ? ((customerId && c.id === customerId) || (qLast8 && cLast8 && qLast8 === cLast8) || (qName && c.name.trim() === qName))
      : (customerId && c.id === customerId);

    if (isTarget) {
      found = true;
      const existingQuotes = c.quotes ? [...c.quotes] : [];
      let quoteIdx = -1;

      if (overwriteQuoteId && overwriteQuoteId !== 'true') {
        quoteIdx = existingQuotes.findIndex((q) => q.id === overwriteQuoteId);
      }
      if (quoteIdx < 0 && quote.id) {
        quoteIdx = existingQuotes.findIndex((q) => q.id === quote.id);
      }
      if (quoteIdx < 0 && overwriteQuoteId && existingQuotes.length > 0) {
        quoteIdx = 0;
      }

      if (quoteIdx >= 0) {
        // OVERWRITE existing quote in-place
        quote.id = existingQuotes[quoteIdx].id;
        existingQuotes[quoteIdx] = quote;
      } else {
        // Add new quote
        existingQuotes.unshift(quote);
      }

      const updatedDeliveryDate = newDeliveryDate || c.deliveryDate;
      const updatedDDay = updatedDeliveryDate ? calculateDDay(updatedDeliveryDate) : c.dDay;

      return {
        ...c,
        source: newSlipNo ? 'tab2' : c.source,
        paidAmount: quote.paidAmount > 0 ? quote.paidAmount : c.paidAmount,
        netAmount: quote.netAmount,
        items: quote.itemSummary || c.items,
        quotes: existingQuotes,
        slipNo: newSlipNo || c.slipNo,
        date: newDate || c.date,
        deliveryDate: updatedDeliveryDate,
        dDay: updatedDDay,
      };
    }
    return c;
  });

  // If customer not found in existing list (신규 고객 등록), create a new CRM customer record
  if (!found) {
    const fallbackName = qName || customerFallbackInfo?.name || '신규 고객';
    const finalDeliveryDate = newDeliveryDate || undefined;
    const newCustomer: CustomerItem = {
      id: customerId || 'cust-' + Date.now(),
      source: newSlipNo ? 'tab2' : 'tab1',
      name: fallbackName,
      phone: quote.rawCalculatorData?.phone || quote.rawCalculatorData?.cPhone || customerFallbackInfo?.phone || '연락처 미등록',
      slipNo: newSlipNo || undefined,
      category: quote.itemSummary || '가전 견적',
      items: quote.itemSummary || '가전 견적',
      paidAmount: quote.paidAmount,
      netAmount: quote.netAmount,
      status: '상담진행중',
      rawStatus: '상담진행',
      date: newDate || new Date().toISOString().split('T')[0],
      deliveryDate: finalDeliveryDate,
      dDay: finalDeliveryDate ? calculateDDay(finalDeliveryDate) : null,
      note: quote.internalMemo || quote.customerMemo || '견적 계산기에서 직접 작성 및 저장됨',
      quotes: [quote],
      logs: [],
    };
    updated.unshift(newCustomer);
  }

  saveCachedCustomers(updated);
  return updated;
}

/**
 * Delete a customer's quote record
 */
export function deleteCustomerQuote(customerId: string, quoteId: string): CustomerItem[] {
  const current = getCachedCustomers();
  const updated = current.map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        quotes: (c.quotes || []).filter((q) => q.id !== quoteId),
      };
    }
    return c;
  });
  saveCachedCustomers(updated);
  return updated;
}

/**
 * Delete a consultation log from a customer
 */
export function deleteCustomerLog(customerId: string, logId: string): CustomerItem[] {
  const current = getCachedCustomers();
  const updated = current.map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        logs: (c.logs || []).filter((l) => l.id !== logId),
      };
    }
    return c;
  });
  saveCachedCustomers(updated);
  return updated;
}

/**
 * Update promised gift item and delivery completion status
 */
export function updateCustomerGift(
  customerId: string,
  giftItem: string,
  isGiftDelivered: boolean
): CustomerItem[] {
  const current = getCachedCustomers();
  const updated = current.map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        giftItem,
        isGiftDelivered,
      };
    }
    return c;
  });
  saveCachedCustomers(updated);
  return updated;
}

/**
 * Delete a customer record entirely from CRM
 */
export function deleteCustomer(customerId: string): CustomerItem[] {
  const current = getCachedCustomers();
  const target = current.find((c) => c.id === customerId);
  if (target) {
    markCustomerAsDeleted(target);
  } else {
    markCustomerAsDeleted({ id: customerId });
  }
  const updated = current.filter((c) => c.id !== customerId);
  saveCachedCustomers(updated);
  return updated;
}

/**
 * Add a consultation log / note to a customer
 */
export function addCustomerLog(
  customerId: string,
  log: import('../types/crm').ConsultationLog
): CustomerItem[] {
  const current = getCachedCustomers();
  const updated = current.map((c) => {
    if (c.id === customerId) {
      return {
        ...c,
        logs: [log, ...(c.logs || [])],
      };
    }
    return c;
  });

  saveCachedCustomers(updated);
  return updated;
}

export const GOOGLE_APPS_SCRIPT_SAMPLE_CODE = `/**
 * 롯데하이마트 경기광주점 - 고객 CRM & 배송 파이프라인 Google Apps Script
 * 구글 스프레드시트 -> [확장 프로그램] -> [Apps Script] 에 붙여넣고 [웹 앱으로 배포]하세요.
 * 액세스 권한: '모든 사용자(Anyone)'로 설정 필수
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  function formatDate(d) {
    if (d instanceof Date && !isNaN(d.getTime())) {
      return Utilities.formatDate(d, "GMT+9", "yyyy-MM-dd");
    }
    return String(d || "");
  }

  // 1. tab1: 온라인 예약/접수 (A:이름, B:연락처, C:카테고리, D:서비스, E:접수일, F:상태, G:메모, H:문서링크)
  var sheet1 = ss.getSheetByName("tab1") || ss.getSheetByName("온라인예약");
  var tab1 = [];
  if (sheet1) {
    var data1 = sheet1.getDataRange().getValues();
    for (var i = 1; i < data1.length; i++) {
      var r = data1[i];
      if (!r || r.length === 0) continue;
      var name = String(r[0] || "").trim();
      var phone = String(r[1] || "").trim();
      if (!name && !phone) continue;

      tab1.push({
        id: "tab1_" + (i + 1),
        rowIndex: i + 1,
        name: name,
        phone: phone,
        category: String(r[2] || ""),
        service: String(r[3] || ""),
        date: formatDate(r[4]),
        status: String(r[5] || ""),
        note: String(r[6] || ""),
        docUrl: String(r[7] || "")
      });
    }
  }

  // 2. tab2: 매장결제 및 배송관리 (A:성함, B:연락처, C:전표번호, D:품목, E:결제금액, F:실체감가, G:제휴카드, H:배송일, I:상태, J:메모, K:문서링크)
  var sheet2 = ss.getSheetByName("tab2") || ss.getSheetByName("배송관리") || (sheet1 ? null : ss.getSheets()[0]);
  var tab2 = [];
  if (sheet2) {
    var data2 = sheet2.getDataRange().getValues();
    for (var j = 1; j < data2.length; j++) {
      var r2 = data2[j];
      if (!r2 || r2.length === 0) continue;
      var name2 = String(r2[0] || "").trim();
      var phone2 = String(r2[1] || "").trim();
      if (!name2 && !phone2) continue;

      tab2.push({
        id: "tab2_" + (j + 1),
        rowIndex: j + 1,
        name: name2,
        phone: phone2,
        slipNo: String(r2[2] || ""),
        items: String(r2[3] || ""),
        paidAmount: r2[4] || 0,
        netAmount: r2[5] || 0,
        benefit: String(r2[6] || ""),
        deliveryDate: formatDate(r2[7]),
        status: String(r2[8] || "배송대기"),
        note: String(r2[9] || ""),
        docUrl: String(r2[10] || "")
      });
    }
  }

  var result = {
    status: "success",
    timestamp: Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss"),
    tab1: tab1,
    tab2: tab2
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    // 1. 상태 및 문자발송 동기화
    if (action === "updateStatus" || action === "updateSms") {
      var sheet1 = ss.getSheetByName("tab1") || ss.getSheetByName("온라인예약");
      if (sheet1) {
        var values = sheet1.getDataRange().getValues();
        var targetRow = -1;
        var pClean = String(data.phone || "").replace(/\\D/g, "");
        for (var i = 1; i < values.length; i++) {
          var rowPhone = String(values[i][1] || "").replace(/\\D/g, "");
          var rowName = String(values[i][0] || "").trim();
          if ((pClean && rowPhone && rowPhone.indexOf(pClean) !== -1) || (data.name && rowName === data.name)) {
            targetRow = i + 1;
            break;
          }
        }
        if (targetRow > 0) {
          // F열(6번째 열): 상태
          sheet1.getRange(targetRow, 6).setValue(data.status || "발송 완료");
          if (data.note) {
            var oldNote = String(sheet1.getRange(targetRow, 7).getValue() || "");
            sheet1.getRange(targetRow, 7).setValue(oldNote ? oldNote + " | " + data.note : data.note);
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updatedRow: targetRow }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
