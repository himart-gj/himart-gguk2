import { idbMirrorGet, idbMirrorSet } from '../../utils/offlineDbQueue';
import {
  DEFAULT_INCENTIVE_GSHEET_URL,
  INCENTIVE_GSHEET_URL_STORAGE_KEY,
  MODEL_INCENTIVE_STORAGE_KEY,
  MODEL_INCENTIVE_UPDATED_EVENT,
  ParsedIncentiveWorkbookResult,
  detectIncentiveYearMonthFromText,
  downloadModelIncentiveExcelTemplate,
  extractGoogleSheetIdAndGid,
  fetchModelIncentiveFromGoogleSheetUrl,
  fetchRemoteModelIncentiveSheets,
  hydrateModelIncentiveSheetsFromIdb,
  loadAllModelIncentiveSheets,
  loadGitHubSyncConfig,
  loadSavedIncentiveGoogleSheetUrl,
  mergeModelIncentiveRules,
  parseIncentiveAmountCell,
  parseModelIncentiveExcelOrCsv,
  parseModelIncentiveExcelWithMeta,
  parseModelIncentiveFreeText,
  parseModelIncentiveImage,
  publishModelIncentiveSheetsToGitHub,
  saveAllModelIncentiveSheets,
  saveGitHubSyncConfig,
  saveIncentiveGoogleSheetUrl,
  stripPersonalLocalFromIncentiveMap,
  syncModelIncentiveSheetsToServer,
  upsertMonthlyIncentiveSheet,
} from './settlementSheetParser';
import type { GitHubSyncConfig } from '../../utils/careTableParser';

export type { GitHubSyncConfig, ParsedIncentiveWorkbookResult };
export {
  DEFAULT_INCENTIVE_GSHEET_URL,
  INCENTIVE_GSHEET_URL_STORAGE_KEY,
  MODEL_INCENTIVE_STORAGE_KEY,
  MODEL_INCENTIVE_UPDATED_EVENT,
  detectIncentiveYearMonthFromText,
  downloadModelIncentiveExcelTemplate,
  extractGoogleSheetIdAndGid,
  fetchModelIncentiveFromGoogleSheetUrl,
  fetchRemoteModelIncentiveSheets,
  hydrateModelIncentiveSheetsFromIdb,
  loadAllModelIncentiveSheets,
  loadGitHubSyncConfig,
  loadSavedIncentiveGoogleSheetUrl,
  mergeModelIncentiveRules,
  parseIncentiveAmountCell,
  parseModelIncentiveExcelOrCsv,
  parseModelIncentiveExcelWithMeta,
  parseModelIncentiveFreeText,
  parseModelIncentiveImage,
  publishModelIncentiveSheetsToGitHub,
  saveAllModelIncentiveSheets,
  saveGitHubSyncConfig,
  saveIncentiveGoogleSheetUrl,
  stripPersonalLocalFromIncentiveMap,
  syncModelIncentiveSheetsToServer,
  upsertMonthlyIncentiveSheet,
};
import {
  calculateGeneralPurchaseSummary,
  calculateSubscriptionSummary,
  getGeneralPlan1And2Summaries,
  ProposalState,
  SubscriptionPeriod,
} from '../../types/proposal';
import {
  CustomerFreedCounts,
  CustomerItem,
  CustomerSaleType,
  ModelIncentiveRule,
  ModelIncentivesMap,
  MonthlyModelIncentiveSheet,
  PurchasedModelEntry,
  QuoteRecord,
} from '../types/crm';

export const PLUS_SUBSCRIPTION_INCENTIVE_UNIT = 90_000;

export const GENERAL_FREED_INCENTIVE_UNITS = {
  hf75: 60_000,
  hf150: 120_000,
  hf225: 180_000,
  hf300: 240_000,
} as const;

export const FREED_TIER_SPECS = [
  {
    key: 'plusSub' as const,
    group: 'subscription' as const,
    label: '플러스 구독 (통합)',
    shortLabel: '플러스구독',
    unitIncentive: PLUS_SUBSCRIPTION_INCENTIVE_UNIT,
    description: '종류 무관 (플러스 72·90·108) 건당 9만원',
  },
  {
    key: 'hf75' as const,
    group: 'general' as const,
    label: '일반 하이프리드 75',
    shortLabel: '프리드 75',
    unitIncentive: GENERAL_FREED_INCENTIVE_UNITS.hf75,
    description: '건당 6만원',
  },
  {
    key: 'hf150' as const,
    group: 'general' as const,
    label: '일반 하이프리드 150',
    shortLabel: '프리드 150',
    unitIncentive: GENERAL_FREED_INCENTIVE_UNITS.hf150,
    description: '건당 12만원',
  },
  {
    key: 'hf225' as const,
    group: 'general' as const,
    label: '일반 하이프리드 225',
    shortLabel: '프리드 225',
    unitIncentive: GENERAL_FREED_INCENTIVE_UNITS.hf225,
    description: '건당 18만원',
  },
  {
    key: 'hf300' as const,
    group: 'general' as const,
    label: '일반 하이프리드 300',
    shortLabel: '프리드 300',
    unitIncentive: GENERAL_FREED_INCENTIVE_UNITS.hf300,
    description: '건당 24만원',
  },
] as const;

export function createEmptyFreedCounts(): CustomerFreedCounts {
  return {
    hi72: 0,
    hi90: 0,
    hi108: 0,
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  };
}

export function sanitizeFreedCounts(
  raw?: Partial<CustomerFreedCounts> | null
): CustomerFreedCounts {
  return {
    hi72: Math.max(0, Math.floor(Number(raw?.hi72) || 0)),
    hi90: Math.max(0, Math.floor(Number(raw?.hi90) || 0)),
    hi108: Math.max(0, Math.floor(Number(raw?.hi108) || 0)),
    hf75: Math.max(0, Math.floor(Number(raw?.hf75) || 0)),
    hf150: Math.max(0, Math.floor(Number(raw?.hf150) || 0)),
    hf225: Math.max(0, Math.floor(Number(raw?.hf225) || 0)),
    hf300: Math.max(0, Math.floor(Number(raw?.hf300) || 0)),
  };
}

export function calculateFreedIncentiveDetail(counts: CustomerFreedCounts) {
  const safe = sanitizeFreedCounts(counts);
  const plusSubCount = safe.hi72 + safe.hi90 + safe.hi108;
  const generalCount = safe.hf75 + safe.hf150 + safe.hf225 + safe.hf300;
  const totalCount = plusSubCount + generalCount;

  const plusSubIncentive = plusSubCount * PLUS_SUBSCRIPTION_INCENTIVE_UNIT;
  const hf75Incentive = safe.hf75 * GENERAL_FREED_INCENTIVE_UNITS.hf75;
  const hf150Incentive = safe.hf150 * GENERAL_FREED_INCENTIVE_UNITS.hf150;
  const hf225Incentive = safe.hf225 * GENERAL_FREED_INCENTIVE_UNITS.hf225;
  const hf300Incentive = safe.hf300 * GENERAL_FREED_INCENTIVE_UNITS.hf300;

  const generalIncentive =
    hf75Incentive + hf150Incentive + hf225Incentive + hf300Incentive;
  const totalIncentive = plusSubIncentive + generalIncentive;

  const summaryBadges: string[] = [];
  if (plusSubCount > 0) {
    const subParts: string[] = [];
    if (safe.hi72 > 0) subParts.push(`72×${safe.hi72}`);
    if (safe.hi90 > 0) subParts.push(`90×${safe.hi90}`);
    if (safe.hi108 > 0) subParts.push(`108×${safe.hi108}`);
    summaryBadges.push(
      `플러스구독 ${plusSubCount}건(${subParts.join('·')})`
    );
  }
  if (safe.hf75 > 0) summaryBadges.push(`프리드75 ${safe.hf75}건`);
  if (safe.hf150 > 0) summaryBadges.push(`프리드150 ${safe.hf150}건`);
  if (safe.hf225 > 0) summaryBadges.push(`프리드225 ${safe.hf225}건`);
  if (safe.hf300 > 0) summaryBadges.push(`프리드300 ${safe.hf300}건`);

  return {
    counts: safe,
    plusSubCount,
    generalCount,
    totalCount,
    plusSubIncentive,
    hf75Incentive,
    hf150Incentive,
    hf225Incentive,
    hf300Incentive,
    generalIncentive,
    totalIncentive,
    summaryBadges,
    summaryText: summaryBadges.join(', '),
  };
}

export function isConfirmedPurchaseCustomer(c: CustomerItem): boolean {
  if (!c || c.deletedAt) return false;
  return (
    c.status === '계약완료' ||
    c.status === '발송완료' ||
    c.status === '배송완료'
  );
}

export function getCurrentYearMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeIsoDateStr(raw?: string, fallbackYear?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const fullMatch = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (fullMatch) {
    const yyyy = fullMatch[1];
    const mm = String(parseInt(fullMatch[2], 10)).padStart(2, '0');
    const dd = String(parseInt(fullMatch[3], 10)).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const shortMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (shortMatch) {
    const yyyy = fallbackYear || String(new Date().getFullYear());
    const mm = String(parseInt(shortMatch[1], 10)).padStart(2, '0');
    const dd = String(parseInt(shortMatch[2], 10)).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

export function extractYearMonthFromDateStr(raw?: string, fallbackYear?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})[-./](\d{1,2})/);
  if (match) {
    const yyyy = match[1];
    const mm = String(parseInt(match[2], 10)).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
  const shortMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (shortMatch) {
    const yyyy = fallbackYear || String(new Date().getFullYear());
    const mm = String(parseInt(shortMatch[1], 10)).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
  return '';
}

export function getCustomerContractYearMonth(c: CustomerItem): string {
  if (c.contractDate && c.contractDate.trim()) {
    const ym = extractYearMonthFromDateStr(c.contractDate);
    if (ym) return ym;
  }
  return extractYearMonthFromDateStr(c.regDate);
}

export function getCustomerContractDateStr(c: CustomerItem): string {
  const normContract = normalizeIsoDateStr(c.contractDate);
  if (normContract) return normContract;
  const normReg = normalizeIsoDateStr(c.regDate);
  if (normReg) return normReg;
  return '';
}

export function getCustomerDeliveryYearMonth(c: CustomerItem): string {
  const contractYm = getCustomerContractYearMonth(c);
  const fallbackYear = contractYm ? contractYm.slice(0, 4) : String(new Date().getFullYear());
  return extractYearMonthFromDateStr(c.deliveryDate, fallbackYear);
}

function computeExactSubscriptionItemPrincipal(
  item: any,
  fallbackPeriod: SubscriptionPeriod
): number {
  const period: SubscriptionPeriod =
    Number(item?.period) === 36
      ? 36
      : Number(item?.period) === 60
      ? 60
      : fallbackPeriod;
  const monthly = Math.max(0, Number(item?.monthlyFee) || 0);
  const byMonthly = monthly * period;
  const explicitContract = Math.max(0, Number(item?.contractAmount) || 0);

  if (explicitContract > 0) {
    if (monthly === 0 || Math.abs(explicitContract - byMonthly) <= period * 5) {
      return explicitContract;
    }
  }
  return byMonthly;
}

export function extractPerformanceFromProposalState(state?: ProposalState | any): {
  saleType: CustomerSaleType;
  generalProductTotal: number;
  subscriptionPrincipal: number;
  performanceAmount: number;
  freedCounts: CustomerFreedCounts;
  purchasedModels: PurchasedModelEntry[];
} | null {
  if (!state || typeof state !== 'object') return null;

  try {
    const {
      plan1Data,
      plan2Data,
      hasPlan1Data,
      hasPlan2Data,
    } = getGeneralPlan1And2Summaries(state as ProposalState);

    const usePlan2 = !hasPlan1Data && hasPlan2Data;
    const primaryData = usePlan2 ? plan2Data : plan1Data;
    const genSummary = calculateGeneralPurchaseSummary(primaryData);
    const subSummary = calculateSubscriptionSummary(primaryData);

    const mode: CustomerSaleType =
      state.quoteMode === 'subscription'
        ? 'subscription'
        : state.quoteMode === 'hybrid'
        ? 'hybrid'
        : 'general';

    const includeGeneral = mode === 'general' || mode === 'hybrid';
    const includeSub = mode === 'subscription' || mode === 'hybrid';

    const generalProductTotal = includeGeneral ? Math.max(0, genSummary.sum) : 0;

    const fallbackPeriod: SubscriptionPeriod =
      primaryData.subscriptionPeriod === 36 ? 36 : 60;
    const subItems = Array.isArray(primaryData.items) ? primaryData.items : [];
    const computedSubPrincipal = subItems.reduce(
      (acc, it) => acc + computeExactSubscriptionItemPrincipal(it, fallbackPeriod),
      0
    );
    const subscriptionPrincipal = includeSub
      ? Math.max(0, computedSubPrincipal || subSummary.totalPrincipal || 0)
      : 0;

    const performanceAmount = generalProductTotal + subscriptionPrincipal;

    const freedCounts = sanitizeFreedCounts({
      hi72: includeSub ? primaryData.hiPlusCounts?.hi72 || 0 : 0,
      hi90: includeSub ? primaryData.hiPlusCounts?.hi90 || 0 : 0,
      hi108: includeSub ? primaryData.hiPlusCounts?.hi108 || 0 : 0,
      hf75: includeGeneral ? primaryData.generalHiPreedCounts?.hf75 || 0 : 0,
      hf150: includeGeneral ? primaryData.generalHiPreedCounts?.hf150 || 0 : 0,
      hf225: includeGeneral ? primaryData.generalHiPreedCounts?.hf225 || 0 : 0,
      hf300: includeGeneral ? primaryData.generalHiPreedCounts?.hf300 || 0 : 0,
    });

    const purchasedModels: PurchasedModelEntry[] = [];

    if (includeGeneral) {
      (primaryData.generalItems || []).forEach((it, idx) => {
        const cat = (it.category || it.name || '').trim();
        const mod = (it.modelName || it.code || '').trim();
        const qty = Math.max(1, Number(it.quantity ?? it.qty) || 1);
        const unitPrice = Math.max(0, Number(it.unitPrice ?? it.price) || 0);
        if (!cat && !mod && unitPrice <= 0) return;
        purchasedModels.push({
          id: `pm-gen-${idx}-${mod || cat}`,
          category: cat || '일반가전',
          modelName: mod || cat,
          quantity: qty,
          saleType: 'general',
          principalAmount: unitPrice * qty,
        });
      });
    }

    if (includeSub) {
      subItems.forEach((it, idx) => {
        const cat = (it.category || '').trim();
        const mod = (it.modelName || it.modelCode || '').trim();
        const monthly = Math.max(0, Number(it.monthlyFee) || 0);
        if (!cat && !mod && monthly <= 0) return;
        purchasedModels.push({
          id: `pm-sub-${idx}-${mod || cat}`,
          category: cat || '구독가전',
          modelName: mod || cat,
          quantity: 1,
          saleType: 'subscription',
          principalAmount: computeExactSubscriptionItemPrincipal(
            it,
            fallbackPeriod
          ),
        });
      });
    }

    return {
      saleType: mode,
      generalProductTotal,
      subscriptionPrincipal,
      performanceAmount,
      freedCounts,
      purchasedModels,
    };
  } catch {
    return null;
  }
}

/**
 * 괄호 (...) 내부의 쉼표·슬래시(예: MH334KH/A)·플러스 기호는 절대 분리하지 않고,
 * 괄호 바깥의 구분자(쉼표, 플러스, 가운뎃점, 공백 있는 슬래시)로만 품목을 안전하게 분리합니다.
 */
function splitItemsOutsideParens(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      cur += ch;
      continue;
    }
    if (depth === 0) {
      if (ch === ',' || ch === '+') {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      if (ch === '·' && /\s*[가-힣A-Za-z]/.test(text.slice(i + 1))) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      // 슬래시(/)는 모델코드(예: MH334KH/A)가 아닐 때(앞뒤 공백이 있을 때)만 품목 구분자로 처리
      if (ch === '/' && /\s$/.test(cur) && /^\s/.test(text.slice(i + 1))) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * 모델명 내부 알파벳 X+숫자(예: SM-X620NZAAKOO -> 620)가 수량으로 오인식되는 현상을 원천 차단합니다.
 * 반드시 괄호(모델코드) 바깥 또는 독립된 수량 표기(×2, x 2, 2대, 2개, 2세트)만 추출하며 최대 20개로 안전 상한을 둡니다.
 */
function extractSafeItemQuantity(seg: string): number {
  const withoutParens = seg.replace(/\([^)]*\)/g, ' ');
  const multMatch =
    withoutParens.match(/×\s*(\d{1,2})(?!\d)/) ||
    withoutParens.match(/(?:^|[\s)])[xX*]\s*(\d{1,2})(?=\s*(?:대|개|세트)?\s*$)/) ||
    withoutParens.match(/(?:^|[\s)])(\d{1,2})\s*(?:대|개|세트)(?=\s*$)/);
  if (multMatch) {
    const parsed = parseInt(multMatch[1], 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
      return parsed;
    }
  }
  return 1;
}

function extractBalancedOuterParen(seg: string): {
  before: string;
  inside: string;
  after: string;
} | null {
  const start = seg.indexOf('(');
  if (start <= 0) return null;
  let depth = 0;
  for (let i = start; i < seg.length; i++) {
    if (seg[i] === '(') depth++;
    else if (seg[i] === ')') {
      depth--;
      if (depth === 0) {
        return {
          before: seg.slice(0, start),
          inside: seg.slice(start + 1, i),
          after: seg.slice(i + 1),
        };
      }
    }
  }
  return null;
}

export function parsePurchasedModelsFromItemsText(
  itemsText: string,
  defaultSaleType: 'general' | 'subscription' = 'general'
): PurchasedModelEntry[] {
  const raw = (itemsText || '').trim();
  if (!raw) return [];

  const cleaned = raw.replace(/^\[[^\]]+\]\s*/, '').trim();
  if (!cleaned) return [];

  const segments = splitItemsOutsideParens(cleaned);

  const results: PurchasedModelEntry[] = [];
  segments.forEach((seg, idx) => {
    const qty = extractSafeItemQuantity(seg);
    const inferredSaleType =
      seg.includes('구독') || /\b(?:36|60)M\b/i.test(seg)
        ? 'subscription'
        : defaultSaleType;

    const parenMatch = extractBalancedOuterParen(seg);
    if (parenMatch) {
      const cat = parenMatch.before
        .replace(/^(?:일반|구독)\s*\d*안?\s*/, '')
        .trim();
      const inside = parenMatch.inside
        .replace(/[·\s]*(?:36|60)\s*(?:M|개월)/gi, '')
        .replace(/(?:×\s*\d{1,2}|(?:^|\s)[xX*]\s*\d{1,2}|\d{1,2}\s*(?:대|개|세트))$/g, '')
        .trim();
      const afterClean = parenMatch.after
        .replace(/[·\s]*(?:36|60)\s*(?:M|개월)/gi, '')
        .replace(/(?:×\s*\d{1,2}|(?:^|\s)[xX*]\s*\d{1,2}|\d{1,2}\s*(?:대|개|세트))$/g, '')
        .trim();

      // 예: "쿠쿠 정수기 (36L)CP-TS100GWH(SELF)" 또는 "냉장고(870L) RM70F64M2X"처럼 괄호 뒤에 실제 모델코드가 이어지는 경우 보존
      if (/^\d{2}L$/i.test(inside) && afterClean) {
        results.push({
          id: `parsed-${idx}`,
          category: cat || '가전',
          modelName: `(${inside})${afterClean}`,
          quantity: qty,
          saleType: inferredSaleType,
          principalAmount: 0,
        });
        return;
      }
      if (isGenericNonModelLabel(inside) && afterClean && !isGenericNonModelLabel(afterClean)) {
        results.push({
          id: `parsed-${idx}`,
          category: cat || '가전',
          modelName: afterClean,
          quantity: qty,
          saleType: inferredSaleType,
          principalAmount: 0,
        });
        return;
      }
      if (inside || cat) {
        results.push({
          id: `parsed-${idx}`,
          category: cat || '가전',
          modelName: inside || cat,
          quantity: qty,
          saleType: inferredSaleType,
          principalAmount: 0,
        });
        return;
      }
    }

    const codeTokenMatch = seg.match(/\b([A-Za-z0-9][A-Za-z0-9._/-]{3,})\b/);
    if (
      codeTokenMatch &&
      /[A-Za-z]/.test(codeTokenMatch[1]) &&
      !isGenericNonModelLabel(codeTokenMatch[1])
    ) {
      const modelCode = codeTokenMatch[1];
      const catPart = seg
        .replace(modelCode, '')
        .replace(/(?:×\s*\d{1,2}|(?:^|\s)[xX*]\s*\d{1,2}|\d{1,2}\s*(?:대|개|세트))$/g, '')
        .trim();
      results.push({
        id: `parsed-${idx}`,
        category: catPart || '가전',
        modelName: modelCode,
        quantity: qty,
        saleType: inferredSaleType,
        principalAmount: 0,
      });
      return;
    }

    const cleanedModel = seg
      .replace(/(?:×\s*\d{1,2}|(?:^|\s)[xX*]\s*\d{1,2}|\d{1,2}\s*(?:대|개|세트))$/g, '')
      .trim();
    if (cleanedModel && !/^[A-Za-z]?\)$/.test(cleanedModel)) {
      results.push({
        id: `parsed-${idx}`,
        category: '품목',
        modelName: cleanedModel,
        quantity: qty,
        saleType: inferredSaleType,
        principalAmount: 0,
      });
    }
  });

  return results.filter((r) => Boolean(r.modelName));
}

function parseFallbackFreedFromText(benefitAndItems: string): CustomerFreedCounts {
  const counts = createEmptyFreedCounts();
  const txt = benefitAndItems || '';
  if (!txt) return counts;

  const matchCount = (re: RegExp): number => {
    const m = txt.match(re);
    if (!m) return 0;
    return Math.max(1, parseInt(m[1] || '1', 10) || 1);
  };

  if (/플러스\s*72/i.test(txt)) {
    counts.hi72 = matchCount(/플러스\s*72[^\d]*(\d+)\s*(?:구좌|건|개)?/i);
  }
  if (/플러스\s*90/i.test(txt)) {
    counts.hi90 = matchCount(/플러스\s*90[^\d]*(\d+)\s*(?:구좌|건|개)?/i);
  }
  if (/플러스\s*108/i.test(txt)) {
    counts.hi108 = matchCount(/플러스\s*108[^\d]*(\d+)\s*(?:구좌|건|개)?/i);
  }
  if (
    counts.hi72 + counts.hi90 + counts.hi108 === 0 &&
    /구독프리드\s*\(\s*(\d+)\s*구좌\s*\)/.test(txt)
  ) {
    const m = txt.match(/구독프리드\s*\(\s*(\d+)\s*구좌\s*\)/);
    counts.hi90 = Math.max(1, parseInt(m?.[1] || '1', 10) || 1);
  }

  if (/하이프리드\s*75|프리드\s*75/.test(txt)) {
    counts.hf75 = matchCount(/(?:하이)?프리드\s*75[^\d]*(\d+)?/);
  }
  if (/하이프리드\s*150|프리드\s*150/.test(txt)) {
    counts.hf150 = matchCount(/(?:하이)?프리드\s*150[^\d]*(\d+)?/);
  }
  if (/하이프리드\s*225|프리드\s*225/.test(txt)) {
    counts.hf225 = matchCount(/(?:하이)?프리드\s*225[^\d]*(\d+)?/);
  }
  if (/하이프리드\s*300|프리드\s*300/.test(txt)) {
    counts.hf300 = matchCount(/(?:하이)?프리드\s*300[^\d]*(\d+)?/);
  }

  return counts;
}

export interface ResolvedCustomerPerformanceProfile {
  saleType: CustomerSaleType;
  generalProductTotal: number;
  subscriptionPrincipal: number;
  performanceAmount: number;
  subscriptionItemCount: number;
  freedCounts: CustomerFreedCounts;
  freedDetail: ReturnType<typeof calculateFreedIncentiveDetail>;
  purchasedModels: PurchasedModelEntry[];
  contractYearMonth: string;
  contractDateStr: string;
  deliveryYearMonth: string;
  isConfirmed: boolean;
}

export interface ConfirmedSlipUnitProfile {
  quote: QuoteRecord;
  saleType: CustomerSaleType;
  generalProductTotal: number;
  subscriptionPrincipal: number;
  performanceAmount: number;
  subscriptionItemCount: number;
  freedCounts: CustomerFreedCounts;
  purchasedModels: PurchasedModelEntry[];
  contractDateStr: string;
  contractYearMonth: string;
  deliveryDateStr: string;
  deliveryYearMonth: string;
}

export function getConfirmedSlipQuotes(customer?: CustomerItem | null): QuoteRecord[] {
  if (!customer || !Array.isArray(customer.quotes)) return [];
  return customer.quotes.filter(
    (q): q is QuoteRecord => Boolean(q && q.isConfirmedSlip)
  );
}

export function buildConfirmedSlipUnitProfiles(
  customer: CustomerItem
): ConfirmedSlipUnitProfile[] {
  const slips = getConfirmedSlipQuotes(customer);
  if (slips.length === 0) return [];

  const rawUnits = slips.map((q, sIdx) => {
    const fromProposal = extractPerformanceFromProposalState(q.proposalState);
    const mode: CustomerSaleType =
      q.quoteMode || fromProposal?.saleType || 'general';

    let generalProductTotal = 0;
    let subscriptionPrincipal = 0;

    if (mode === 'subscription') {
      subscriptionPrincipal = Math.max(
        0,
        Number(q.subscriptionPrincipal) ||
          Number(q.performanceAmount) ||
          fromProposal?.subscriptionPrincipal ||
          0
      );
    } else if (mode === 'general') {
      // HISIS 일반 확정 전표는 실구매가(paidAmount / generalProductTotal)를 매출 실적으로 정확히 귀속
      generalProductTotal = Math.max(
        0,
        Number(q.generalProductTotal) ||
          Number(q.performanceAmount) ||
          Number(q.paidAmount) ||
          fromProposal?.generalProductTotal ||
          0
      );
    } else {
      generalProductTotal = Math.max(
        0,
        Number(q.generalProductTotal) || fromProposal?.generalProductTotal || 0
      );
      subscriptionPrincipal = Math.max(
        0,
        Number(q.subscriptionPrincipal) ||
          fromProposal?.subscriptionPrincipal ||
          0
      );
    }

    const performanceAmount = generalProductTotal + subscriptionPrincipal;

    let rawModels: PurchasedModelEntry[] = [];
    if (Array.isArray(q.purchasedModels) && q.purchasedModels.length > 0) {
      rawModels = q.purchasedModels;
    } else if (fromProposal && fromProposal.purchasedModels.length > 0) {
      rawModels = fromProposal.purchasedModels;
    } else if (q.itemSummary) {
      rawModels = parsePurchasedModelsFromItemsText(
        q.itemSummary,
        mode === 'subscription' ? 'subscription' : 'general'
      );
    }

    const purchasedModels: PurchasedModelEntry[] = rawModels
      .filter((m) => m && !/^[A-Za-z]?\)$/.test(String(m.modelName || '').trim()))
      .map((m, mIdx) => ({
        ...m,
        id: `${q.id || `slip-${sIdx}`}-${m.id || mIdx}`,
        quantity:
          Number(m.quantity) > 20 || Number(m.quantity) < 1
            ? 1
            : Math.floor(Number(m.quantity) || 1),
      }));

    const parsedSubUnits = purchasedModels
      .filter((m) => m.saleType === 'subscription')
      .reduce(
        (acc, m) => acc + Math.max(1, Math.floor(Number(m.quantity) || 1)),
        0
      );
    const subscriptionItemCount =
      parsedSubUnits > 0
        ? parsedSubUnits
        : mode === 'subscription' || subscriptionPrincipal > 0
        ? 1
        : 0;

    const contractDateStr =
      normalizeIsoDateStr(q.contractDate) ||
      getCustomerContractDateStr(customer);
    const contractYearMonth =
      extractYearMonthFromDateStr(contractDateStr) ||
      getCustomerContractYearMonth(customer);

    const fallbackYear = contractYearMonth
      ? contractYearMonth.slice(0, 4)
      : String(new Date().getFullYear());
    const rawSlipDelivery =
      q.deliveryDate !== undefined
        ? q.deliveryDate
        : slips.length === 1
        ? customer.deliveryDate
        : '';
    const deliveryDateStr = normalizeIsoDateStr(rawSlipDelivery, fallbackYear);
    const deliveryYearMonth = extractYearMonthFromDateStr(
      deliveryDateStr,
      fallbackYear
    );

    const freedCounts = sanitizeFreedCounts(
      q.freedCounts || fromProposal?.freedCounts
    );

    return {
      quote: q,
      saleType: mode,
      generalProductTotal,
      subscriptionPrincipal,
      performanceAmount,
      subscriptionItemCount,
      freedCounts,
      purchasedModels,
      contractDateStr,
      contractYearMonth,
      deliveryDateStr,
      deliveryYearMonth,
    };
  });

  // 고객 카드에서 수동으로 추가/조정한 프리드 구좌가 있다면 중복 없이 대표(최신) 전표 1곳에만 안전 귀속
  if (customer.freedCounts && rawUnits.length > 0) {
    const custFreed = sanitizeFreedCounts(customer.freedCounts);
    const keys: (keyof CustomerFreedCounts)[] = [
      'hi72',
      'hi90',
      'hi108',
      'hf75',
      'hf150',
      'hf225',
      'hf300',
    ];
    for (const k of keys) {
      const sumInSlips = rawUnits.reduce((s, u) => s + u.freedCounts[k], 0);
      if (custFreed[k] > sumInSlips) {
        rawUnits[0].freedCounts[k] += custFreed[k] - sumInSlips;
      } else if (custFreed[k] < sumInSlips) {
        let remaining = custFreed[k];
        for (const u of rawUnits) {
          const take = Math.min(remaining, u.freedCounts[k]);
          u.freedCounts[k] = take;
          remaining -= take;
        }
      }
    }
  }

  return rawUnits;
}

export function aggregateSlipUnitsToProfile(
  customer: CustomerItem,
  units: ConfirmedSlipUnitProfile[],
  overrides?: {
    contractYearMonth?: string;
    deliveryYearMonth?: string;
  }
): ResolvedCustomerPerformanceProfile {
  const generalProductTotal = units.reduce(
    (s, u) => s + u.generalProductTotal,
    0
  );
  const subscriptionPrincipal = units.reduce(
    (s, u) => s + u.subscriptionPrincipal,
    0
  );
  const performanceAmount = generalProductTotal + subscriptionPrincipal;

  const hasGen = units.some(
    (u) =>
      u.saleType === 'general' ||
      u.saleType === 'hybrid' ||
      u.generalProductTotal > 0
  );
  const hasSub = units.some(
    (u) =>
      u.saleType === 'subscription' ||
      u.saleType === 'hybrid' ||
      u.subscriptionPrincipal > 0
  );
  const saleType: CustomerSaleType =
    hasGen && hasSub ? 'hybrid' : hasSub ? 'subscription' : 'general';

  const subscriptionItemCount = units.reduce(
    (s, u) => s + u.subscriptionItemCount,
    0
  );

  const freedCounts = createEmptyFreedCounts();
  for (const u of units) {
    freedCounts.hi72 += u.freedCounts.hi72;
    freedCounts.hi90 += u.freedCounts.hi90;
    freedCounts.hi108 += u.freedCounts.hi108;
    freedCounts.hf75 += u.freedCounts.hf75;
    freedCounts.hf150 += u.freedCounts.hf150;
    freedCounts.hf225 += u.freedCounts.hf225;
    freedCounts.hf300 += u.freedCounts.hf300;
  }
  const freedDetail = calculateFreedIncentiveDetail(freedCounts);

  const purchasedModels = units.flatMap((u) => u.purchasedModels);

  const contractDateStr =
    units[0]?.contractDateStr || getCustomerContractDateStr(customer);
  const contractYearMonth =
    overrides?.contractYearMonth ??
    (units[0]?.contractYearMonth || getCustomerContractYearMonth(customer));
  const deliveryYearMonth =
    overrides?.deliveryYearMonth ??
    (units.every((u) => Boolean(u.deliveryYearMonth))
      ? units[0]?.deliveryYearMonth || getCustomerDeliveryYearMonth(customer)
      : '');

  return {
    saleType,
    generalProductTotal,
    subscriptionPrincipal,
    performanceAmount,
    subscriptionItemCount,
    freedCounts,
    freedDetail,
    purchasedModels,
    contractYearMonth,
    contractDateStr,
    deliveryYearMonth,
    isConfirmed: isConfirmedPurchaseCustomer(customer),
  };
}

export function resolveCustomerPerformanceProfile(
  customer: CustomerItem
): ResolvedCustomerPerformanceProfile {
  const slipUnits = buildConfirmedSlipUnitProfiles(customer);
  if (slipUnits.length > 0) {
    return aggregateSlipUnitsToProfile(customer, slipUnits, {
      deliveryYearMonth: getCustomerDeliveryYearMonth(customer),
    });
  }

  const primaryQuote = customer.quotes?.[0];
  const fromProposal = extractPerformanceFromProposalState(
    primaryQuote?.proposalState
  );

  const inferredSubFromText =
    customer.saleType === 'subscription' ||
    primaryQuote?.quoteMode === 'subscription' ||
    (customer.items || '').includes('구독');

  const saleType: CustomerSaleType =
    customer.saleType ||
    fromProposal?.saleType ||
    primaryQuote?.quoteMode ||
    (inferredSubFromText ? 'subscription' : 'general');

  let generalProductTotal = 0;
  let subscriptionPrincipal = 0;
  let performanceAmount = 0;

  if (
    typeof customer.performanceAmount === 'number' &&
    customer.performanceAmount > 0
  ) {
    performanceAmount = customer.performanceAmount;
    if (
      typeof customer.generalProductTotal === 'number' ||
      typeof customer.subscriptionPrincipal === 'number'
    ) {
      generalProductTotal = customer.generalProductTotal || 0;
      subscriptionPrincipal = customer.subscriptionPrincipal || 0;
    } else if (saleType === 'subscription') {
      subscriptionPrincipal = performanceAmount;
    } else {
      generalProductTotal = performanceAmount;
    }
  } else if (
    (typeof customer.generalProductTotal === 'number' && customer.generalProductTotal > 0) ||
    (typeof customer.subscriptionPrincipal === 'number' && customer.subscriptionPrincipal > 0)
  ) {
    generalProductTotal = Math.max(0, Number(customer.generalProductTotal) || 0);
    subscriptionPrincipal = Math.max(0, Number(customer.subscriptionPrincipal) || 0);
    performanceAmount = generalProductTotal + subscriptionPrincipal;
  } else if (fromProposal && fromProposal.performanceAmount > 0) {
    generalProductTotal = fromProposal.generalProductTotal;
    subscriptionPrincipal = fromProposal.subscriptionPrincipal;
    performanceAmount = fromProposal.performanceAmount;
  } else if (
    typeof primaryQuote?.performanceAmount === 'number' &&
    primaryQuote.performanceAmount > 0
  ) {
    performanceAmount = primaryQuote.performanceAmount;
    generalProductTotal = primaryQuote.generalProductTotal || 0;
    subscriptionPrincipal = primaryQuote.subscriptionPrincipal || 0;
  } else {
    const rawPaid = Math.max(0, Number(customer.paidAmount) || 0);
    if (saleType === 'subscription') {
      if (rawPaid > 0 && rawPaid < 400_000) {
        const periodGuess =
          (customer.items || '').includes('36개월') ||
          (customer.items || '').includes('36M')
            ? 36
            : 60;
        subscriptionPrincipal = rawPaid * periodGuess;
      } else {
        subscriptionPrincipal = rawPaid;
      }
      performanceAmount = subscriptionPrincipal;
    } else {
      generalProductTotal = rawPaid;
      performanceAmount = rawPaid;
    }
  }

  let freedCounts: CustomerFreedCounts;
  if (customer.freedCounts) {
    freedCounts = sanitizeFreedCounts(customer.freedCounts);
  } else if (fromProposal) {
    freedCounts = fromProposal.freedCounts;
  } else if (primaryQuote?.freedCounts) {
    freedCounts = sanitizeFreedCounts(primaryQuote.freedCounts);
  } else {
    freedCounts = parseFallbackFreedFromText(
      `${customer.expectedBenefit || ''} ${customer.items || ''}`
    );
  }

  const freedDetail = calculateFreedIncentiveDetail(freedCounts);

  let purchasedModels: PurchasedModelEntry[];
  const trimmedCustomerItems = (customer.items || '').trim();
  const trimmedQuoteSummary = (primaryQuote?.itemSummary || '').trim();
  const hasManualItemsOverride =
    Boolean(trimmedCustomerItems) &&
    Boolean(primaryQuote) &&
    Boolean(trimmedQuoteSummary) &&
    trimmedCustomerItems !== trimmedQuoteSummary;

  // 1순위: 고객카드에서 품목/모델명을 직접 수정한 경우 수정된 customer.items 우선 반영
  // 2순위: 견적서 계산기(proposalState)에서 저장된 정밀 모델 내역
  // 3순위: 수기 등록 고객의 customer.items 재해석
  if (hasManualItemsOverride) {
    purchasedModels = parsePurchasedModelsFromItemsText(
      trimmedCustomerItems,
      saleType === 'subscription' ? 'subscription' : 'general'
    );
  } else if (fromProposal && fromProposal.purchasedModels.length > 0) {
    purchasedModels = fromProposal.purchasedModels;
  } else if (trimmedCustomerItems) {
    purchasedModels = parsePurchasedModelsFromItemsText(
      customer.items,
      saleType === 'subscription' ? 'subscription' : 'general'
    );
  } else if (
    Array.isArray(customer.purchasedModels) &&
    customer.purchasedModels.length > 0
  ) {
    purchasedModels = customer.purchasedModels
      .filter((m) => m && !/^[A-Za-z]?\)$/.test(String(m.modelName || '').trim()))
      .map((m) => ({
        ...m,
        quantity:
          Number(m.quantity) > 20 || Number(m.quantity) < 1
            ? 1
            : Math.floor(Number(m.quantity) || 1),
      }));
  } else if (
    Array.isArray(primaryQuote?.purchasedModels) &&
    primaryQuote.purchasedModels.length > 0
  ) {
    purchasedModels = primaryQuote.purchasedModels
      .filter((m) => m && !/^[A-Za-z]?\)$/.test(String(m.modelName || '').trim()))
      .map((m) => ({
        ...m,
        quantity:
          Number(m.quantity) > 20 || Number(m.quantity) < 1
            ? 1
            : Math.floor(Number(m.quantity) || 1),
      }));
  } else {
    purchasedModels = [];
  }

  // 구독 판매접수 품목(대수/건수) 자동 산출:
  // - 단독 구독(subscription) 및 혼합 견적(hybrid) 내 subscription 품목 수량 합산
  // - 수기 등록 등으로 세부 품목 배열이 비어 있더라도 구독 주문(구독원금>0 또는 구독모드 또는 플러스구독 가입)이면 최소 1개 보장
  const parsedSubUnits = purchasedModels
    .filter((m) => m.saleType === 'subscription')
    .reduce((acc, m) => acc + Math.max(1, Math.floor(Number(m.quantity) || 1)), 0);
  const hasSubscriptionOrder =
    saleType === 'subscription' ||
    subscriptionPrincipal > 0 ||
    freedDetail.plusSubCount > 0;
  const subscriptionItemCount =
    parsedSubUnits > 0 ? parsedSubUnits : hasSubscriptionOrder ? 1 : 0;

  return {
    saleType,
    generalProductTotal,
    subscriptionPrincipal,
    performanceAmount,
    subscriptionItemCount,
    freedCounts,
    freedDetail,
    purchasedModels,
    contractYearMonth: getCustomerContractYearMonth(customer),
    contractDateStr: getCustomerContractDateStr(customer),
    deliveryYearMonth: getCustomerDeliveryYearMonth(customer),
    isConfirmed: isConfirmedPurchaseCustomer(customer),
  };
}

const GENERIC_NON_MODEL_TOKEN_RE =
  /^(?:삼성|삼성전자|엘지|LG|LG전자|쿠쿠|쿠쿠전자|쿠쿠홈시스|쿠첸|코지마|세라젬|바디프랜드|바디프렌드|제스파|누하스|휴테크|로보락|드리미|샤크|닌자|필립스|다이슨|캐리어|플럭스|PLUX|나비엔|나비엔매직|테팔|브라운|애플|밀레|리페르|하이얼|위니아|SK매직|비스포크|오브제|오브제컬렉션|디오스|트롬|휘센|시그니처|무풍|김치톡톡|김치플러스|일반|구독|렌탈|일시불|세트|세트가전|혼수|혼수가전|입주|입주가전|가전|일반가전|구독가전|품목|주방가전|생활가전|세탁가전|계절가전|설치|설치형|셀프|셀프형|방문|방문형|직배수|직배수형|일반형|프리스탠딩|빌트인|키친핏|스탠드|스탠드형|벽걸이|벽걸이형|창문형|천장형|뚜껑형|양문형|콤비|원도어|포도어|화이트|블랙|실버|그레이|베이지|그레이지|네이비|핑크|그린|브라운|아이보리|골드|민트|블루|냉장고|김치냉장고|냉동고|저온냉동고|와인셀러|세탁기|드럼세탁기|통돌이|통돌이세탁기|전자동세탁기|건조기|의류건조기|세탁건조기|올인원세탁건조기|일체형세탁건조기|워시타워|워시콤보|콤보|의류관리기|스타일러|에어드레서|슈드레서|TV|티비|올레드|올레드TV|QLED|QLEDTV|QNED|구글TV|스마트TV|스탠바이미|모니터|에어컨|투인원|투인원에어컨|시스템에어컨|멀티에어컨|냉방기|냉난방기|식기세척기|식세기|정수기|얼음정수기|냉온정수기|직수정수기|필터형정수기|공기청정기|청정기|청소기|로봇청소기|무선청소기|건습식청소기|건타입|건타입청소기|핸디형|핸디형청소기|유선청소기|전기밥솥|압력밥솥|IH전기압력밥솥|밥솥|전기레인지|인덕션|인덕션레인지|하이라이트|가스레인지|전자레인지|무회전전자레인지|전기오븐|광파오븐|복합오븐|오븐|에어프라이어|에어프라이기|전기그릴|멀티그릴|양면멀티그릴|전기주전자|커피머신|에스프레소머신|블렌더|무선블렌더|믹서기|원액기|두유제조기|음식물처리기|프라이팬|기물프라이팬|레인지후드|에어후드|싱크볼|수전|욕실환풍기|복합욕실팬|비데|방수비데|안마의자|마사지기|종아리발마사지기|가습기|제습기|실링팬|선풍기|서큘레이터|카본매트|숙면매트|전기매트|온수매트|제빙기|버블클렌저|면도기|구강용품|전동칫솔|구강세정기|헤어드라이기|헤어드라이어|드라이기|헤어아이론|스트레이트너|고데기|노트북|데스크탑|컴퓨터|태블릿|태블릿PC|아이패드|갤럭시탭|갤럭시북|그램|서피스|프린터|복합기|자급제|휴대폰|스마트폰)$/i;

const GENERIC_SPEC_TOKEN_RE =
  /^(?:\d+(?:\.\d+)?(?:KG|L|리터|인치|형|평|평형|구|도어|인용|벌|단|등급|세트|개|대|개월|M|W|HZ|GB|TB|MM|CM)?|2IN1|4K|8K|FHD|UHD|HD|QLED|OLED|QNED|LED|LCD|AI|IOT|BLDC|IH|UV|IPX\d+|5G|LTE|WIFI|USB|HDMI)$/i;

const COMPOUND_GENERIC_KO_STRIP_RE =
  /(삼성전자|삼성|LG전자|LG|엘지|쿠쿠홈시스|쿠쿠전자|쿠쿠|쿠첸|코지마|세라젬|바디프랜드|바디프렌드|로보락|드리미|샤크|닌자|필립스|다이슨|캐리어|플럭스|PLUX|나비엔매직|나비엔|리페르|\d+(?:\.\d+)?(?:KG|L|리터|인치|형|평|평형|구|도어|인용|벌|단|등급)|일반형?|직배수형?|설치형?|셀프형?|방문형?|공통|빌트인|스탠드형?|벽걸이형?|창문형|양문형|콤비|무선|유선|건타입|핸디형|일체형|올인원|사계절|냉장고|김치냉장고|냉동고|세탁기|드럼세탁기|통돌이세탁기|건조기|의류건조기|세탁건조기|워시타워|워시콤보|스타일러|에어드레서|의류관리기|에어컨|냉방기|냉난방기|식기세척기|정수기|얼음정수기|필터형정수기|공기청정기|로봇청소기|청소기|건습식청소기|전기밥솥|압력밥솥|밥솥|인덕션|전기레인지|레인지|가스레인지|전자레인지|전기오븐|복합오븐|광파오븐|오븐|에어프라이어|음식물처리기|커피머신|블렌더|원액기|두유제조기|전기그릴|양면멀티그릴|프라이팬|기물프라이팬|전기주전자|레인지후드|에어후드|싱크볼|수전|욕실환풍기|복합욕실팬|비데|안마의자|마사지기|종아리|발|가습기|제습기|실링팬|카본매트|숙면매트|제빙기|버블클렌저|면도기|전동칫솔|구강용품|헤어드라이기|헤어드라이어|드라이기|헤어아이론|스트레이트너|노트북|데스크탑|태블릿PC|태블릿|프린터|자급제|가전|품목)/gi;

const PROPER_KO_MODEL_ALIASES: Record<string, string[]> = {
  메디컬파라오: ['메디컬파라오', 'MEDICALPHARAOH'],
  메디컬팬텀: ['메디컬팬텀', 'MEDICALPHANTOM'],
  뉴팔콘SV: ['뉴팔콘SV', 'NEWFALCONSV'],
  카르나로보: ['카르나로보', 'CARNAROBO'],
  모멘티아: ['모멘티아', '모멘티아안마의자'],
  셀라제: ['셀라제', '셀라제안마의자'],
  포레체: ['포레체', '포레체안마의자'],
  더퍼스트클래스: ['더퍼스트클래스', '더퍼스트클래스안마의자'],
};

function stripManufacturerChannelSuffix(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^\(\d{2}L\)\s*/i, '')
    .replace(/\.(?:[A-Z]?KOR\d*|AKR[A-Z0-9]*)$/i, '')
    .trim();
}

export function normalizeModelMatchKey(raw?: string): string {
  const s = stripManufacturerChannelSuffix(raw).toUpperCase();
  return s.replace(/[^A-Z0-9가-힣]+/g, '');
}

/**
 * 실제 모델코드가 아닌 일반 품목명·브랜드+품목·용량/인치 표기(예: "냉장고", "김치냉장고", "샤크 무선청소기", "10kg 세탁기", "870L")인지 판별합니다.
 * 일반 품목명은 어떠한 경우에도 특정 모델 수당에 매칭되지 않도록 원천 차단합니다.
 */
export function isGenericNonModelLabel(raw?: string): boolean {
  if (!raw || !String(raw).trim()) return true;
  const s = stripManufacturerChannelSuffix(raw);
  const nk = normalizeModelMatchKey(s);
  if (!nk) return true;

  for (const aliases of Object.values(PROPER_KO_MODEL_ALIASES)) {
    if (aliases.some((a) => normalizeModelMatchKey(a) === nk)) {
      return false;
    }
  }
  if (nk === '빌트인가스레인지전모델') return false;

  const tokens = s
    .split(/[\s,/+()\[\]·_-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const meaningful: string[] = [];

  for (const tok of tokens) {
    const tu = tok.toUpperCase();
    if (GENERIC_SPEC_TOKEN_RE.test(tu) || GENERIC_NON_MODEL_TOKEN_RE.test(tu)) {
      continue;
    }
    const strippedKo = tu
      .replace(COMPOUND_GENERIC_KO_STRIP_RE, '')
      .replace(/[^A-Z0-9가-힣]+/g, '');
    if (!strippedKo) continue;
    meaningful.push(strippedKo);
  }

  if (meaningful.length === 0) return true;
  const joined = meaningful.join('');
  if (/^\d+$/.test(joined)) return true;
  return false;
}

function buildCanonicalModelVariants(raw?: string): Set<string> {
  const out = new Set<string>();
  const s0 = stripManufacturerChannelSuffix(raw);
  if (!s0) return out;

  const k0 = normalizeModelMatchKey(s0);
  if (k0) out.add(k0);

  const hasVariant = /설치|셀프|직배수|일반형|install|self|drainage/i.test(s0);
  if (hasVariant) {
    const vNorm = s0
      .replace(/\(\s*(?:install|설치형?)\s*\)/gi, '설치')
      .replace(/\(\s*(?:self|셀프형?)\s*\)/gi, '셀프')
      .replace(/\(\s*직배수형?\s*\)/gi, '직배수')
      .replace(/\(\s*일반형\s*\)/gi, '일반형');
    const vk = normalizeModelMatchKey(vNorm);
    if (vk) out.add(vk);
  }

  // 비모델 패키징/국가/유통 접미사만 정밀 제거: (SET), _SET, (PKG), _PKG, (T), (G), _(WW|WK)-KRH?, _WIN11, _HM
  let sClean = s0
    .replace(/\((?:SET|PKG|T|G)\)/gi, '')
    .replace(/_(?:SET|PKG|WIN11|HM)$/i, '')
    .replace(/_(?:WW|WK)-KRH?$/i, '');
  if (/\(T\)/i.test(s0)) {
    sClean = sClean.replace(/_BS$/i, '');
  }
  const kc = normalizeModelMatchKey(sClean);
  if (kc && kc.length >= 2 && !hasVariant) {
    out.add(kc);
  }

  // 하이마트 구독 카탈로그 전용 래퍼 코드: OFF_S10MAXVULTRA_WH / OFF_S10MAXVULTRA_AUTO_WH
  const offMatch = s0.match(
    /^OFF_([A-Z0-9]+?)_(?:AUTO_)?(?:WH|BK|SV|GY|BG|BL|GN|PK)$/i
  );
  if (offMatch?.[1]) {
    const ok = normalizeModelMatchKey(offMatch[1]);
    if (ok) out.add(ok);
  }

  // 삼성 국내 TV 유통 접미사(FXKR / EXKR / XKR) 정규화: KQ85QNH80AFXKR <-> KQ85QNH80A
  for (const existing of Array.from(out)) {
    const tvMatch = existing.match(
      /^((?:KQ|KU|KMR|UN|LH)\d{2,3}[A-Z0-9]{4,}?)(?:FXKR|EXKR|XKR)$/
    );
    if (tvMatch?.[1]) {
      out.add(tvMatch[1]);
    }
  }

  // 쿠쿠 정수기 하이마트 구독 코드 래퍼: (36L)CP-TS100GWH(SELF) -> CPTS100
  const cuckooSubMatch = String(raw || '')
    .trim()
    .match(
      /^(?:\(\d{2}L\))?\s*(CP-[A-Z]{2,5}\d{3})(?:GWH|EWH|GWT|GPN|DS|WH|BK)?\s*\((?:SELF|셀프)\)$/i
    );
  if (cuckooSubMatch?.[1]) {
    out.add(normalizeModelMatchKey(cuckooSubMatch[1]));
  }

  // 안마의자 고유 한글·영문 모델명 양방향 별칭 매핑
  const noParenBase = normalizeModelMatchKey(s0.replace(/\([^)]*\)/g, ''));
  for (const aliases of Object.values(PROPER_KO_MODEL_ALIASES)) {
    const normAliases = aliases.map((a) => normalizeModelMatchKey(a));
    if (
      normAliases.includes(noParenBase) ||
      Array.from(out).some((k) => normAliases.includes(k))
    ) {
      normAliases.forEach((na) => out.add(na));
    }
  }

  return out;
}

export function expandRuleCandidateKeys(rule: ModelIncentiveRule): string[] {
  const raw = String(rule.modelCode || '').trim();
  if (!raw || isGenericNonModelLabel(raw)) return [];

  const keys = buildCanonicalModelVariants(raw);
  const hasVariant = /설치|셀프|직배수|일반형|install|self|drainage/i.test(raw);
  const noParen = raw.replace(/\([^)]*\)/g, '').trim();
  if (noParen && !hasVariant) {
    buildCanonicalModelVariants(noParen).forEach((k) => keys.add(k));
  }

  // 인라인 괄호 옵션 코드 전개: 예) RAC552-09TCA(B)C -> RAC552-09TCAC, RAC552-09TCBC
  const inlineParen = raw.match(
    /^([A-Za-z0-9-]+?)([A-Za-z])\(([A-Za-z])\)([A-Za-z0-9]*)$/
  );
  if (inlineParen) {
    const [, p1, c1, c2, p2] = inlineParen;
    buildCanonicalModelVariants(`${p1}${c1}${p2}`).forEach((k) => keys.add(k));
    buildCanonicalModelVariants(`${p1}${c2}${p2}`).forEach((k) => keys.add(k));
  }

  // 괄호 내부 명시적 서브 영문+숫자 모델코드 전개 (예: (BFR-M8080))
  const parenRegex = /\(([^)]+)\)/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = parenRegex.exec(raw)) !== null) {
    const inner = pMatch[1].trim();
    if (!inner || inner.startsWith('+')) continue;
    const innerParts = inner.split(/[/,]/).map((p) => p.trim()).filter(Boolean);
    for (const part of innerParts) {
      if (part.startsWith('+')) continue;
      if (
        /^(SET|PKG|T|G|B|INSTALL|SELF|REFILL|DRAINAGE|BEST|WHITE|BLACK|SILVER|살균형|일반형|직배수형|설치|셀프)$/i.test(
          part
        )
      ) {
        continue;
      }
      const pKey = normalizeModelMatchKey(part);
      if (pKey.length >= 5 && /[A-Z]/.test(pKey) && /\d/.test(pKey)) {
        keys.add(pKey);
      }
    }
  }

  // 슬래시(/) 병기 모델코드 전개: 예) POCOX8P/POCOX8PM, GRF-1052ND/PD, EMF520-K/Q/S, TMA551/531-012F
  if (noParen.includes('/')) {
    const midSlash = noParen.match(/^([A-Za-z]+)(\d+)\/(\d+)(-[A-Za-z0-9]+)$/);
    if (midSlash) {
      const [, pfx, n1, n2, sfx] = midSlash;
      buildCanonicalModelVariants(`${pfx}${n1}${sfx}`).forEach((k) => keys.add(k));
      buildCanonicalModelVariants(`${pfx}${n2}${sfx}`).forEach((k) => keys.add(k));
    } else {
      const parts = noParen.split('/').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const first = parts[0];
        const firstKey = normalizeModelMatchKey(first);
        if (firstKey.length >= 4) {
          buildCanonicalModelVariants(first).forEach((k) => keys.add(k));
        }
        for (let i = 1; i < parts.length; i++) {
          const sub = parts[i];
          const subKey = normalizeModelMatchKey(sub);
          if (subKey.length >= 5 && firstKey.slice(0, 3) === subKey.slice(0, 3)) {
            buildCanonicalModelVariants(sub).forEach((k) => keys.add(k));
          } else if (
            subKey.length >= 1 &&
            subKey.length <= 4 &&
            first.length > sub.length
          ) {
            const rebuilt = first.slice(0, first.length - sub.length) + sub;
            buildCanonicalModelVariants(rebuilt).forEach((k) => keys.add(k));
          }
        }
      }
    }
  }

  // 상품명에는 오직 명시적 실내기 모델코드(실내기: XXX)와 안마의자 고유 모델명만 허용 (일반 품목명 매칭 원천 차단)
  if (rule.productName) {
    const indoorMatch = rule.productName.match(
      /실내기\s*[:：]?\s*([A-Za-z0-9\-_]+)/
    );
    if (indoorMatch?.[1]) {
      const indoorKey = normalizeModelMatchKey(indoorMatch[1]);
      if (indoorKey.length >= 5) keys.add(indoorKey);
    }
    if (rule.category === '안마의자') {
      const mcName = rule.productName
        .replace(
          /^(?:\[[^\]]+\]\s*)?(?:바디프랜드|바디프렌드|코지마|세라젬|제스파|누하스|휴테크)\s*/,
          ''
        )
        .replace(/\s*안마의자.*$/, '')
        .trim();
      const mcKey = normalizeModelMatchKey(mcName);
      const matchedAliases = PROPER_KO_MODEL_ALIASES[mcKey];
      if (matchedAliases) {
        matchedAliases.forEach((a) => keys.add(normalizeModelMatchKey(a)));
      }
    }
  }

  return Array.from(keys).filter((k) => k.length >= 2);
}

function expandTargetModelCandidateKeys(modelName?: string): Set<string> {
  const raw = String(modelName || '').trim();
  if (!raw || isGenericNonModelLabel(raw)) return new Set();

  const keys = buildCanonicalModelVariants(raw);

  // 모델명 앞뒤에 설명 어구가 함께 적힌 경우(예: "비스포크 RM70F64M2X") 실제 영문+숫자 모델코드 토큰만 추출
  if (/[\s()]/.test(raw)) {
    const tokens = raw.match(/[A-Za-z0-9][A-Za-z0-9._/-]{3,}/g) || [];
    for (const tok of tokens) {
      const tu = tok.toUpperCase();
      if (GENERIC_SPEC_TOKEN_RE.test(tu) || GENERIC_NON_MODEL_TOKEN_RE.test(tu)) {
        continue;
      }
      if (/[A-Za-z]/.test(tok) && /\d/.test(tok) && !isGenericNonModelLabel(tok)) {
        const tk = normalizeModelMatchKey(tok);
        if (tk.length >= 4) {
          buildCanonicalModelVariants(tok).forEach((k) => keys.add(k));
        }
      }
    }
  }

  return new Set(Array.from(keys).filter((k) => k.length >= 2));
}

export function matchModelToIncentiveRule(
  modelEntry: PurchasedModelEntry,
  rules: ModelIncentiveRule[],
  precomputedRuleKeys?: Map<ModelIncentiveRule, Set<string>>
): ModelIncentiveRule | null {
  if (!rules || rules.length === 0) return null;

  const targetKeys = expandTargetModelCandidateKeys(modelEntry.modelName);
  if (targetKeys.size === 0) return null;

  for (const r of rules) {
    if (!r.incentiveAmount || r.incentiveAmount <= 0) continue;
    if (
      r.saleTypeFilter &&
      r.saleTypeFilter !== 'all' &&
      r.saleTypeFilter !== modelEntry.saleType
    ) {
      continue;
    }
    const rKeys =
      precomputedRuleKeys?.get(r) ?? new Set(expandRuleCandidateKeys(r));
    for (const tk of targetKeys) {
      if (rKeys.has(tk)) {
        return r;
      }
    }
  }

  return null;
}

export type IncentiveMonthBasis = 'contract' | 'delivery';

export interface CustomerModelIncentiveMatchItem {
  modelEntry: PurchasedModelEntry;
  matchedRule: ModelIncentiveRule | null;
  unitIncentive: number;
  subtotalIncentive: number;
}

export interface ConfirmedCustomerSettlementRow {
  customer: CustomerItem;
  profile: ResolvedCustomerPerformanceProfile;
  modelMatches: CustomerModelIncentiveMatchItem[];
  matchedModelCount: number;
  customerModelIncentive: number;
  customerFreedIncentive: number;
  customerTotalIncentive: number;
}

export interface MonthlySettlementReport {
  yearMonth: string;
  incentiveBasis: IncentiveMonthBasis;
  grossSalesTotal: number;
  grossGeneralTotal: number;
  grossSubPrincipalTotal: number;
  grossRows: ConfirmedCustomerSettlementRow[];
  grossSubscriptionCount: number;
  grossSubscriptionCustomerCount: number;
  grossSubscriptionRows: ConfirmedCustomerSettlementRow[];
  netDeliverySalesTotal: number;
  netGeneralTotal: number;
  netSubPrincipalTotal: number;
  netDeliveryRows: ConfirmedCustomerSettlementRow[];
  netDeliverySubscriptionCount: number;
  undatedConfirmedCount: number;
  freedSummary: ReturnType<typeof calculateFreedIncentiveDetail>;
  freedCustomerRows: ConfirmedCustomerSettlementRow[];
  modelIncentiveTotal: number;
  matchedModelUnitCount: number;
  matchedCustomerCount: number;
  confirmedRowsForIncentive: ConfirmedCustomerSettlementRow[];
  grandTotalIncentive: number;
}

export function computeMonthlySettlementReport(
  customers: CustomerItem[],
  yearMonth: string,
  incentiveSheet?: MonthlyModelIncentiveSheet | null,
  incentiveBasis: IncentiveMonthBasis = 'contract'
): MonthlySettlementReport {
  const rules = incentiveSheet?.rules || [];
  const precomputedRuleKeys = new Map<ModelIncentiveRule, Set<string>>();
  for (const r of rules) {
    if (r.incentiveAmount && r.incentiveAmount > 0) {
      precomputedRuleKeys.set(r, new Set(expandRuleCandidateKeys(r)));
    }
  }
  const confirmedCustomers = (customers || []).filter(isConfirmedPurchaseCustomer);

  const buildRowWithProfile = (
    c: CustomerItem,
    profile: ResolvedCustomerPerformanceProfile
  ): ConfirmedCustomerSettlementRow => {
    const modelMatches: CustomerModelIncentiveMatchItem[] =
      profile.purchasedModels.map((m) => {
        const matchedRule = matchModelToIncentiveRule(
          m,
          rules,
          precomputedRuleKeys
        );
        const unitIncentive = matchedRule ? matchedRule.incentiveAmount : 0;
        const qty = Math.max(1, Number(m.quantity) || 1);
        return {
          modelEntry: m,
          matchedRule,
          unitIncentive,
          subtotalIncentive: unitIncentive * qty,
        };
      });

    const matchedModelCount = modelMatches.reduce(
      (s, x) => s + (x.matchedRule ? Math.max(1, x.modelEntry.quantity || 1) : 0),
      0
    );
    const customerModelIncentive = modelMatches.reduce(
      (s, x) => s + x.subtotalIncentive,
      0
    );
    const customerFreedIncentive = profile.freedDetail.totalIncentive;

    return {
      customer: c,
      profile,
      modelMatches,
      matchedModelCount,
      customerModelIncentive,
      customerFreedIncentive,
      customerTotalIncentive: customerFreedIncentive + customerModelIncentive,
    };
  };

  const grossRows: ConfirmedCustomerSettlementRow[] = [];
  const netDeliveryRows: ConfirmedCustomerSettlementRow[] = [];
  let undatedConfirmedCount = 0;

  for (const c of confirmedCustomers) {
    const slipUnits = buildConfirmedSlipUnitProfiles(c);

    if (slipUnits.length === 0) {
      // 확정 전표가 없는 기존 수기/상담 고객은 단일 고객 정산 방식 100% 그대로 유지
      const singleRow = buildRowWithProfile(
        c,
        resolveCustomerPerformanceProfile(c)
      );
      if (singleRow.profile.contractYearMonth === yearMonth) {
        grossRows.push(singleRow);
        if (!singleRow.profile.deliveryYearMonth) {
          undatedConfirmedCount += 1;
        }
      }
      if (singleRow.profile.deliveryYearMonth === yearMonth) {
        netDeliveryRows.push(singleRow);
      }
      continue;
    }

    // 다중(또는 단일) HISIS 확정 전표 보유 고객: 각 전표별 계약월(총판)과 배달월(실판)로 개별 분리 집계
    const grossMatchingUnits = slipUnits.filter(
      (u) => u.contractYearMonth === yearMonth
    );
    if (grossMatchingUnits.length > 0) {
      const undatedInMonth = grossMatchingUnits.filter(
        (u) => !u.deliveryYearMonth
      ).length;
      undatedConfirmedCount += undatedInMonth;

      const grossProfile = aggregateSlipUnitsToProfile(c, grossMatchingUnits, {
        contractYearMonth: yearMonth,
        deliveryYearMonth:
          undatedInMonth > 0
            ? ''
            : grossMatchingUnits[0]?.deliveryYearMonth || '',
      });
      const scopedGrossItems =
        grossMatchingUnits.length < slipUnits.length
          ? grossMatchingUnits
              .map((u) => u.quote.itemSummary)
              .filter(Boolean)
              .join(' + ') || c.items
          : c.items;
      const scopedGrossDelivery =
        grossMatchingUnits[0]?.deliveryDateStr || c.deliveryDate;

      grossRows.push(
        buildRowWithProfile(
          {
            ...c,
            items: scopedGrossItems,
            deliveryDate: undatedInMonth > 0 ? '' : scopedGrossDelivery,
          },
          grossProfile
        )
      );
    }

    const netMatchingUnits = slipUnits.filter(
      (u) => u.deliveryYearMonth === yearMonth
    );
    if (netMatchingUnits.length > 0) {
      const netProfile = aggregateSlipUnitsToProfile(c, netMatchingUnits, {
        deliveryYearMonth: yearMonth,
      });
      const scopedNetItems =
        netMatchingUnits.length < slipUnits.length
          ? netMatchingUnits
              .map((u) => u.quote.itemSummary)
              .filter(Boolean)
              .join(' + ') || c.items
          : c.items;
      const scopedNetDelivery =
        netMatchingUnits[0]?.deliveryDateStr || c.deliveryDate;

      netDeliveryRows.push(
        buildRowWithProfile(
          {
            ...c,
            items: scopedNetItems,
            deliveryDate: scopedNetDelivery,
          },
          netProfile
        )
      );
    }
  }

  const grossSalesTotal = grossRows.reduce(
    (s, r) => s + r.profile.performanceAmount,
    0
  );
  const grossGeneralTotal = grossRows.reduce(
    (s, r) => s + r.profile.generalProductTotal,
    0
  );
  const grossSubPrincipalTotal = grossRows.reduce(
    (s, r) => s + r.profile.subscriptionPrincipal,
    0
  );
  const grossSubscriptionRows = grossRows.filter(
    (r) => r.profile.subscriptionItemCount > 0
  );
  const grossSubscriptionCount = grossSubscriptionRows.reduce(
    (s, r) => s + r.profile.subscriptionItemCount,
    0
  );
  const grossSubscriptionCustomerCount = grossSubscriptionRows.length;

  const netDeliverySalesTotal = netDeliveryRows.reduce(
    (s, r) => s + r.profile.performanceAmount,
    0
  );
  const netGeneralTotal = netDeliveryRows.reduce(
    (s, r) => s + r.profile.generalProductTotal,
    0
  );
  const netSubPrincipalTotal = netDeliveryRows.reduce(
    (s, r) => s + r.profile.subscriptionPrincipal,
    0
  );
  const netDeliverySubscriptionCount = netDeliveryRows.reduce(
    (s, r) => s + r.profile.subscriptionItemCount,
    0
  );

  const confirmedRowsForIncentive =
    incentiveBasis === 'delivery' ? netDeliveryRows : grossRows;

  const aggFreedCounts = createEmptyFreedCounts();
  confirmedRowsForIncentive.forEach((r) => {
    aggFreedCounts.hi72 += r.profile.freedCounts.hi72;
    aggFreedCounts.hi90 += r.profile.freedCounts.hi90;
    aggFreedCounts.hi108 += r.profile.freedCounts.hi108;
    aggFreedCounts.hf75 += r.profile.freedCounts.hf75;
    aggFreedCounts.hf150 += r.profile.freedCounts.hf150;
    aggFreedCounts.hf225 += r.profile.freedCounts.hf225;
    aggFreedCounts.hf300 += r.profile.freedCounts.hf300;
  });

  const freedSummary = calculateFreedIncentiveDetail(aggFreedCounts);
  const freedCustomerRows = confirmedRowsForIncentive.filter(
    (r) => r.profile.freedDetail.totalCount > 0
  );

  const modelIncentiveTotal = confirmedRowsForIncentive.reduce(
    (s, r) => s + r.customerModelIncentive,
    0
  );
  const matchedModelUnitCount = confirmedRowsForIncentive.reduce(
    (s, r) => s + r.matchedModelCount,
    0
  );
  const matchedCustomerCount = confirmedRowsForIncentive.filter(
    (r) => r.customerModelIncentive > 0
  ).length;

  const grandTotalIncentive =
    freedSummary.totalIncentive + modelIncentiveTotal;

  return {
    yearMonth,
    incentiveBasis,
    grossSalesTotal,
    grossGeneralTotal,
    grossSubPrincipalTotal,
    grossRows,
    grossSubscriptionCount,
    grossSubscriptionCustomerCount,
    grossSubscriptionRows,
    netDeliverySalesTotal,
    netGeneralTotal,
    netSubPrincipalTotal,
    netDeliveryRows,
    netDeliverySubscriptionCount,
    undatedConfirmedCount,
    freedSummary,
    freedCustomerRows,
    modelIncentiveTotal,
    matchedModelUnitCount,
    matchedCustomerCount,
    confirmedRowsForIncentive,
    grandTotalIncentive,
  };
}



// ============================================================================
// 월별 가전올케어 수동 수량 저장소 (고객관리 <-> 메인화면 수당적립 요약 실시간 연동)
// ============================================================================

export type MonthlyAllCareCountsMap = Record<string, number>;

export const MONTHLY_ALLCARE_STORAGE_KEY = 'himart_crm_monthly_allcare_counts_v1';
export const ALLCARE_COUNT_UPDATED_EVENT = 'himart-allcare-count-updated';

function sanitizeAllCareMap(raw: unknown): MonthlyAllCareCountsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: MonthlyAllCareCountsMap = {};
  for (const [ym, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const n = Math.max(0, Math.floor(Number(val) || 0));
    out[ym] = n;
  }
  return out;
}

function emitAllCareCountUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ALLCARE_COUNT_UPDATED_EVENT));
  }
}

export function loadAllMonthlyAllCareCounts(): MonthlyAllCareCountsMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MONTHLY_ALLCARE_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeAllCareMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function getMonthlyAllCareCount(
  yearMonth: string,
  map?: MonthlyAllCareCountsMap
): number {
  const target = map ?? loadAllMonthlyAllCareCounts();
  return Math.max(0, Math.floor(Number(target[yearMonth]) || 0));
}

export async function hydrateMonthlyAllCareCountsFromIdb(): Promise<MonthlyAllCareCountsMap> {
  const local = loadAllMonthlyAllCareCounts();
  try {
    const mirrored = await idbMirrorGet<MonthlyAllCareCountsMap>(
      MONTHLY_ALLCARE_STORAGE_KEY
    );
    const safeMirror = sanitizeAllCareMap(mirrored);
    if (Object.keys(safeMirror).length > 0 && Object.keys(local).length === 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          MONTHLY_ALLCARE_STORAGE_KEY,
          JSON.stringify(safeMirror)
        );
      }
      emitAllCareCountUpdated();
      return safeMirror;
    }
    if (Object.keys(safeMirror).length > 0) {
      return { ...safeMirror, ...local };
    }
  } catch {
    // Ignore IDB fallback errors
  }
  return local;
}

export function saveAllMonthlyAllCareCounts(map: MonthlyAllCareCountsMap): void {
  const safe = sanitizeAllCareMap(map);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(MONTHLY_ALLCARE_STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // Ignore storage quota warning
    }
  }
  void idbMirrorSet(MONTHLY_ALLCARE_STORAGE_KEY, safe);
  emitAllCareCountUpdated();
}

export function setMonthlyAllCareCount(
  yearMonth: string,
  nextCount: number
): MonthlyAllCareCountsMap {
  const current = loadAllMonthlyAllCareCounts();
  const clamped = Math.max(0, Math.min(9999, Math.floor(Number(nextCount) || 0)));
  const updated: MonthlyAllCareCountsMap = {
    ...current,
    [yearMonth]: clamped,
  };
  saveAllMonthlyAllCareCounts(updated);
  return updated;
}
