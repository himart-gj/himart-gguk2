import { GitHubSyncConfig, loadGitHubSyncConfig, saveGitHubSyncConfig } from '../../utils/careTableParser';
import { idbMirrorGet, idbMirrorSet } from '../../utils/offlineDbQueue';
import { compressImageFile, GEMINI_MODELS, getEffectiveGeminiApiKey } from '../../utils/aiImageParser';
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
  return c.status === '계약완료' || c.status === '발송완료';
}

export function getCurrentYearMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function extractYearMonthFromDateStr(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})[-./](\d{1,2})/);
  if (!match) return '';
  const yyyy = match[1];
  const mm = String(parseInt(match[2], 10)).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getCustomerContractYearMonth(c: CustomerItem): string {
  if (c.contractDate && c.contractDate.trim()) {
    const ym = extractYearMonthFromDateStr(c.contractDate);
    if (ym) return ym;
  }
  return extractYearMonthFromDateStr(c.regDate);
}

export function getCustomerContractDateStr(c: CustomerItem): string {
  if (c.contractDate && /^\d{4}-\d{2}-\d{2}/.test(c.contractDate.trim())) {
    return c.contractDate.trim().slice(0, 10);
  }
  if (c.regDate && /^\d{4}-\d{2}-\d{2}/.test(c.regDate.trim())) {
    return c.regDate.trim().slice(0, 10);
  }
  return '';
}

export function getCustomerDeliveryYearMonth(c: CustomerItem): string {
  return extractYearMonthFromDateStr(c.deliveryDate);
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

export function parsePurchasedModelsFromItemsText(
  itemsText: string,
  defaultSaleType: 'general' | 'subscription' = 'general'
): PurchasedModelEntry[] {
  const raw = (itemsText || '').trim();
  if (!raw) return [];

  const cleaned = raw.replace(/^\[[^\]]+\]\s*/, '').trim();
  if (!cleaned) return [];

  const segments = cleaned
    .split(/\s*(?:,|\/|\+|·(?=\s*[가-힣A-Za-z]))\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: PurchasedModelEntry[] = [];
  segments.forEach((seg, idx) => {
    let qty = 1;
    const qtyMatch = seg.match(/(?:[×xX*]\s*(\d+)|(\d+)\s*(?:대|개|세트))/);
    if (qtyMatch) {
      qty = Math.max(1, parseInt(qtyMatch[1] || qtyMatch[2], 10) || 1);
    }

    const parenMatch = seg.match(/^([^(]+)\(([^)]+)\)/);
    if (parenMatch) {
      const cat = parenMatch[1]
        .replace(/^(?:일반|구독)\s*\d*안?\s*/, '')
        .trim();
      const inside = parenMatch[2]
        .replace(/[·\s]*(?:36|60)\s*(?:M|개월)/gi, '')
        .replace(/(?:[×xX*]\s*\d+|\d+\s*(?:대|개))/g, '')
        .trim();
      if (inside || cat) {
        results.push({
          id: `parsed-${idx}`,
          category: cat || '가전',
          modelName: inside || cat,
          quantity: qty,
          saleType:
            seg.includes('구독') || /\b(?:36|60)M\b/i.test(seg)
              ? 'subscription'
              : defaultSaleType,
          principalAmount: 0,
        });
        return;
      }
    }

    const codeTokenMatch = seg.match(/\b([A-Za-z][A-Za-z0-9._-]{3,})\b/);
    if (codeTokenMatch) {
      const modelCode = codeTokenMatch[1];
      const catPart = seg
        .replace(modelCode, '')
        .replace(/(?:[×xX*]\s*\d+|\d+\s*(?:대|개))/g, '')
        .trim();
      results.push({
        id: `parsed-${idx}`,
        category: catPart || '가전',
        modelName: modelCode,
        quantity: qty,
        saleType: defaultSaleType,
        principalAmount: 0,
      });
      return;
    }

    results.push({
      id: `parsed-${idx}`,
      category: '품목',
      modelName: seg.replace(/(?:[×xX*]\s*\d+|\d+\s*(?:대|개))/g, '').trim(),
      quantity: qty,
      saleType: defaultSaleType,
      principalAmount: 0,
    });
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

export function resolveCustomerPerformanceProfile(
  customer: CustomerItem
): ResolvedCustomerPerformanceProfile {
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
  if (
    Array.isArray(customer.purchasedModels) &&
    customer.purchasedModels.length > 0
  ) {
    purchasedModels = customer.purchasedModels;
  } else if (fromProposal && fromProposal.purchasedModels.length > 0) {
    purchasedModels = fromProposal.purchasedModels;
  } else if (
    Array.isArray(primaryQuote?.purchasedModels) &&
    primaryQuote.purchasedModels.length > 0
  ) {
    purchasedModels = primaryQuote.purchasedModels;
  } else {
    purchasedModels = parsePurchasedModelsFromItemsText(
      customer.items,
      saleType === 'subscription' ? 'subscription' : 'general'
    );
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

export function normalizeModelMatchKey(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.(AKOR\d*|AKR\d*|KOR\d*)$/i, '')
    .replace(/[\s\-_()[\]·/.,]+/g, '');
}

export function matchModelToIncentiveRule(
  modelEntry: PurchasedModelEntry,
  rules: ModelIncentiveRule[]
): ModelIncentiveRule | null {
  if (!rules || rules.length === 0) return null;

  const targetCode = normalizeModelMatchKey(modelEntry.modelName);
  const targetCat = normalizeModelMatchKey(modelEntry.category);
  if (!targetCode && !targetCat) return null;

  const eligibleRules = rules.filter((r) => {
    if (!r.incentiveAmount || r.incentiveAmount <= 0) return false;
    if (
      r.saleTypeFilter &&
      r.saleTypeFilter !== 'all' &&
      r.saleTypeFilter !== modelEntry.saleType
    ) {
      return false;
    }
    return true;
  });

  for (const r of eligibleRules) {
    const rKey = normalizeModelMatchKey(r.modelCode);
    if (rKey.length >= 2 && targetCode === rKey) {
      return r;
    }
  }

  let bestPrefixRule: ModelIncentiveRule | null = null;
  let bestPrefixLen = 0;

  for (const r of eligibleRules) {
    const rKey = normalizeModelMatchKey(r.modelCode);
    if (rKey.length < 5 || targetCode.length < 5) continue;

    if (targetCode.startsWith(rKey) || rKey.startsWith(targetCode)) {
      const matchLen = Math.min(rKey.length, targetCode.length);
      if (matchLen > bestPrefixLen) {
        bestPrefixLen = matchLen;
        bestPrefixRule = r;
      }
    } else if (targetCode.includes(rKey) && rKey.length >= 6) {
      if (rKey.length > bestPrefixLen) {
        bestPrefixLen = rKey.length;
        bestPrefixRule = r;
      }
    }
  }
  if (bestPrefixRule) return bestPrefixRule;

  for (const r of eligibleRules) {
    if (!r.productName) continue;
    const pKey = normalizeModelMatchKey(r.productName);
    if (pKey.length >= 4 && (targetCode === pKey || targetCat === pKey)) {
      return r;
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
  const confirmedCustomers = (customers || []).filter(isConfirmedPurchaseCustomer);

  const buildRow = (c: CustomerItem): ConfirmedCustomerSettlementRow => {
    const profile = resolveCustomerPerformanceProfile(c);
    const modelMatches: CustomerModelIncentiveMatchItem[] =
      profile.purchasedModels.map((m) => {
        const matchedRule = matchModelToIncentiveRule(m, rules);
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

  const allConfirmedRows = confirmedCustomers.map(buildRow);

  const grossRows = allConfirmedRows.filter(
    (r) => r.profile.contractYearMonth === yearMonth
  );
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

  const netDeliveryRows = allConfirmedRows.filter(
    (r) => r.profile.deliveryYearMonth === yearMonth
  );
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

  const undatedConfirmedCount = grossRows.filter(
    (r) => !r.profile.deliveryYearMonth
  ).length;

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
// 월별 제품 모델별 수당 단가표 저장소 + 엑셀/CSV/사진(AI OCR)/텍스트 통합 파서
// ============================================================================

export const MODEL_INCENTIVE_STORAGE_KEY = 'himart_crm_model_incentive_sheets_v1';
export const MODEL_INCENTIVE_UPDATED_EVENT = 'himart-model-incentive-updated';

function emitModelIncentiveUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MODEL_INCENTIVE_UPDATED_EVENT));
  }
}

export function loadAllModelIncentiveSheets(): ModelIncentivesMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MODEL_INCENTIVE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ModelIncentivesMap;
  } catch {
    return {};
  }
}

export async function hydrateModelIncentiveSheetsFromIdb(): Promise<ModelIncentivesMap> {
  const local = loadAllModelIncentiveSheets();
  try {
    const mirrored = await idbMirrorGet<ModelIncentivesMap>(MODEL_INCENTIVE_STORAGE_KEY);
    if (mirrored && typeof mirrored === 'object' && !Array.isArray(mirrored)) {
      const localCount = Object.keys(local).length;
      const mirrorCount = Object.keys(mirrored).length;
      if (mirrorCount > 0 && localCount === 0) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(MODEL_INCENTIVE_STORAGE_KEY, JSON.stringify(mirrored));
        }
        emitModelIncentiveUpdated();
        return mirrored;
      }
      if (mirrorCount > 0) {
        const merged: ModelIncentivesMap = { ...mirrored, ...local };
        return merged;
      }
    }
  } catch {
    // Ignore IDB fallback errors
  }
  return local;
}

export function syncModelIncentiveSheetsToServer(map: ModelIncentivesMap): void {
  if (typeof fetch === 'undefined') return;
  try {
    fetch('/api/model-incentives/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheets: map }),
    }).catch(() => {});
  } catch {
    // Ignore on static hosting
  }
}

export function saveAllModelIncentiveSheets(
  map: ModelIncentivesMap,
  options?: { skipServerSync?: boolean }
): void {
  const safeMap = map && typeof map === 'object' ? map : {};
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(MODEL_INCENTIVE_STORAGE_KEY, JSON.stringify(safeMap));
    } catch {
      // Ignore storage quota warning; IDB mirror still persists
    }
  }
  void idbMirrorSet(MODEL_INCENTIVE_STORAGE_KEY, safeMap);
  if (!options?.skipServerSync) {
    syncModelIncentiveSheetsToServer(safeMap);
  }
  emitModelIncentiveUpdated();
}

function parseIsoMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function inferGitHubPagesRepoFromLocation(): string {
  if (typeof window === 'undefined' || !window.location) return '';
  const host = window.location.hostname || '';
  if (!host.endsWith('.github.io')) return '';
  const owner = host.replace(/\.github\.io$/i, '').trim();
  const pathParts = (window.location.pathname || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  const repoName = pathParts[0] || `${owner}.github.io`;
  if (!owner || !repoName) return '';
  return `${owner}/${repoName}`;
}

function isValidSheetRecord(val: any): val is MonthlyModelIncentiveSheet {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof val.yearMonth === 'string' &&
      Array.isArray(val.rules)
  );
}

/**
 * [전 직원 단가표 자동 수신]
 * GitHub 저장소(public/model-incentive-data.json) 및 배포된 정적 파일(./model-incentive-data.json)에서
 * 최신 월별 모델 수당 단가표만 가져와 병합합니다. (개인 고객 카드·개인 실적은 절대 공유되지 않음)
 */
export async function fetchRemoteModelIncentiveSheets(): Promise<ModelIncentivesMap | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const gh = loadGitHubSyncConfig();
    const configuredRepo = gh.repo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '');
    const effectiveRepo = configuredRepo || inferGitHubPagesRepoFromLocation();
    const branch = gh.branch.trim() || 'main';

    const candidates: ModelIncentivesMap[] = [];

    // 1) GitHub Contents API (업로드 직후 1~2초 내 즉시 반영)
    if (effectiveRepo) {
      try {
        const ghApiUrl = `https://api.github.com/repos/${effectiveRepo}/contents/public/model-incentive-data.json?ref=${encodeURIComponent(
          branch
        )}`;
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3.raw',
        };
        if (configuredRepo && gh.token.trim()) {
          headers.Authorization = `Bearer ${gh.token.trim()}`;
        }
        const ghRes = await fetch(ghApiUrl, {
          cache: 'no-store',
          headers,
        });
        if (ghRes.ok) {
          const parsed = await ghRes.json();
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            candidates.push(parsed as ModelIncentivesMap);
          }
        }
      } catch {
        // Fallback to static JSON below
      }
    }

    // 2) 배포 서버 정적 파일 (./model-incentive-data.json - 토큰 없는 일반 직원 기기 100% 호환)
    try {
      const staticRes = await fetch(`./model-incentive-data.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (staticRes.ok) {
        const ct = staticRes.headers.get('content-type') || '';
        if (ct.includes('json') || ct.includes('text') || !ct) {
          const parsed = await staticRes.json();
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            candidates.push(parsed as ModelIncentivesMap);
          }
        }
      }
    } catch {
      // Ignore offline errors
    }

    if (candidates.length === 0) return null;

    // 후보 원격 맵들 중 월별로 가장 최신(updatedAt)인 단가표 선택
    const bestRemote: ModelIncentivesMap = {};
    for (const srcMap of candidates) {
      for (const [ym, sheet] of Object.entries(srcMap)) {
        if (!isValidSheetRecord(sheet)) continue;
        const prev = bestRemote[ym];
        if (!prev || parseIsoMs(sheet.updatedAt) >= parseIsoMs(prev.updatedAt)) {
          bestRemote[ym] = sheet;
        }
      }
    }

    if (Object.keys(bestRemote).length === 0) return null;

    const localMap = loadAllModelIncentiveSheets();
    const merged: ModelIncentivesMap = { ...localMap };
    let changed = false;

    for (const [ym, remoteSheet] of Object.entries(bestRemote)) {
      const localSheet = localMap[ym];
      if (
        !localSheet ||
        parseIsoMs(remoteSheet.updatedAt) > parseIsoMs(localSheet.updatedAt) ||
        (parseIsoMs(remoteSheet.updatedAt) === parseIsoMs(localSheet.updatedAt) &&
          remoteSheet.rules.length !== localSheet.rules.length)
      ) {
        merged[ym] = remoteSheet;
        changed = true;
      }
    }

    if (changed) {
      saveAllModelIncentiveSheets(merged, { skipServerSync: true });
    }
    return merged;
  } catch {
    return null;
  }
}

/**
 * [전 직원 단가표 자동 배포]
 * 월별 제품 모델 수당 단가표(ModelIncentivesMap)만 GitHub 저장소(public/model-incentive-data.json)에 업로드합니다.
 */
export async function publishModelIncentiveSheetsToGitHub(
  sheetsMap: ModelIncentivesMap,
  config?: GitHubSyncConfig
): Promise<{ ok: boolean; configured: boolean; message: string }> {
  syncModelIncentiveSheetsToServer(sheetsMap);

  const gh = config || loadGitHubSyncConfig();
  const repo = gh.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const token = gh.token.trim();
  const branch = gh.branch.trim() || 'main';

  if (!repo || !token) {
    return {
      ok: false,
      configured: false,
      message: 'GitHub 동기화 미설정 (내 기기에만 저장됨)',
    };
  }

  const filePath = 'public/model-incentive-data.json';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  try {
    let currentSha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const info = await getRes.json();
      currentSha = info.sha;
    }

    const jsonText = JSON.stringify(sheetsMap, null, 2);
    const bytes = new TextEncoder().encode(jsonText);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore(incentive): 월별 제품 모델 수당 단가표 자동 동기화 (${new Date()
          .toISOString()
          .slice(0, 10)})`,
        content: base64Content,
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errTxt = await putRes.text().catch(() => '');
      return {
        ok: false,
        configured: true,
        message: `GitHub 단가표 배포 실패 (${putRes.status})${
          errTxt ? `: ${errTxt.slice(0, 80)}` : ''
        }`,
      };
    }

    return {
      ok: true,
      configured: true,
      message: '전 직원 단가표 자동 업데이트 완료!',
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      message: `네트워크 오류로 내 기기에만 저장됨 (${err?.message || '연결 확인'})`,
    };
  }
}

export { loadGitHubSyncConfig, saveGitHubSyncConfig };
export type { GitHubSyncConfig };

function cleanUploadedModelCode(raw?: string): string {
  if (!raw) return '';
  let code = String(raw).trim().toUpperCase();
  code = code.replace(/^\[[^\]]+\]\s*/, '');
  code = code.replace(/\.(AKOR\d*|KOR\d*)$/i, '');
  code = code.replace(/\s+/g, '');
  return code;
}

export function mergeModelIncentiveRules(
  existing: ModelIncentiveRule[],
  incoming: ModelIncentiveRule[]
): ModelIncentiveRule[] {
  const byKey = new Map<string, ModelIncentiveRule>();
  for (const r of existing || []) {
    const clean = cleanUploadedModelCode(r.modelCode);
    const key = `${normalizeModelMatchKey(clean)}::${r.saleTypeFilter || 'all'}`;
    if (!clean) continue;
    byKey.set(key, { ...r, modelCode: clean });
  }
  for (const r of incoming || []) {
    const clean = cleanUploadedModelCode(r.modelCode);
    const amt = Math.max(0, Math.round(Number(r.incentiveAmount) || 0));
    if (!clean || amt <= 0) continue;
    const filter =
      r.saleTypeFilter === 'general' || r.saleTypeFilter === 'subscription'
        ? r.saleTypeFilter
        : 'all';
    const key = `${normalizeModelMatchKey(clean)}::${filter}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      id: r.id || prev?.id || `RULE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: (r.category || prev?.category || '가전').trim(),
      modelCode: clean,
      productName: r.productName || prev?.productName || undefined,
      incentiveAmount: amt,
      saleTypeFilter: filter,
      note: r.note || prev?.note || undefined,
    });
  }
  return Array.from(byKey.values());
}

export function upsertMonthlyIncentiveSheet(
  yearMonth: string,
  incomingRules: ModelIncentiveRule[],
  sourceLabel: string,
  replaceAll = false
): MonthlyModelIncentiveSheet {
  const all = loadAllModelIncentiveSheets();
  const prev = all[yearMonth];
  const baseRules = replaceAll ? [] : prev?.rules || [];
  const mergedRules = mergeModelIncentiveRules(baseRules, incomingRules);
  const nextSheet: MonthlyModelIncentiveSheet = {
    yearMonth,
    updatedAt: new Date().toISOString(),
    sourceLabel: sourceLabel || prev?.sourceLabel || '단가표 업로드',
    rules: mergedRules,
  };
  const nextAll: ModelIncentivesMap = {
    ...all,
    [yearMonth]: nextSheet,
  };
  saveAllModelIncentiveSheets(nextAll);
  return nextSheet;
}

export function parseIncentiveAmountCell(
  raw: unknown,
  unitMultiplier = 1
): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.round(raw * unitMultiplier);
  }
  const s = String(raw).trim();
  if (!s || s === '-' || s === '없음') return 0;

  // 예: "12만5천", "5.5만원", "10만", "5천원"
  const manCheonMatch = s.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+(?:\.\d+)?)\s*천)?/);
  if (manCheonMatch) {
    const man = parseFloat(manCheonMatch[1] || '0') * 10_000;
    const cheon = parseFloat(manCheonMatch[2] || '0') * 1_000;
    return Math.round(man + cheon);
  }
  const cheonOnlyMatch = s.match(/^(\d+(?:\.\d+)?)\s*천(?:원)?$/);
  if (cheonOnlyMatch) {
    return Math.round(parseFloat(cheonOnlyMatch[1] || '0') * 1_000);
  }

  const cleaned = s.replace(/[,\s원₩KRW]/gi, '');
  const numMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!numMatch) return 0;
  const val = parseFloat(numMatch[0]);
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.round(val * unitMultiplier);
}

function parseSaleTypeFilterCell(raw?: unknown): 'all' | 'general' | 'subscription' {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'all';
  if (s.includes('구독') || s.includes('렌탈') || s === 'sub' || s === 'subscription') {
    return 'subscription';
  }
  if (s.includes('일반') || s.includes('일시불') || s === 'general') {
    return 'general';
  }
  return 'all';
}

function looksLikeValidModelCode(candidate: string): boolean {
  const c = cleanUploadedModelCode(candidate);
  if (c.length < 4 || c.length > 32) return false;
  if (!/[A-Z]/.test(c) || !/\d/.test(c)) return false;
  if (/^(MODEL|CODE|TOTAL|PRICE|INCENTIVE|KRW|NO\d*)$/i.test(c)) return false;
  return /^[A-Z0-9][A-Z0-9._/-]{3,}$/.test(c);
}

export async function parseModelIncentiveExcelOrCsv(
  file: File
): Promise<ModelIncentiveRule[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const collected: ModelIncentiveRule[] = [];

  const modelAliases = ['모델코드', '모델명', '모델번호', '상품코드', '품번', '제품코드', '모델', 'model'];
  const amountAliases = ['수당', '인센티브', '시상금', '장려금', '판매수당', '모델수당', '지급액', '프로모션수당', '시상', 'incentive'];
  const catAliases = ['품목', '품목명', '카테고리', '제품군', '분류', '대분류', '중분류'];
  const nameAliases = ['상품명', '제품명', '품명'];
  const saleTypeAliases = ['적용구분', '판매유형', '구분', '유형', '구독구분'];
  const noteAliases = ['비고', '특이사항', '메모', '조건'];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    let headerRowIdx = -1;
    let modelCol = -1;
    let amountCol = -1;
    let catCol = -1;
    let nameCol = -1;
    let saleTypeCol = -1;
    let noteCol = -1;
    let unitMultiplier = 1;

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r] || [];
      let mIdx = -1;
      let aIdx = -1;
      let cIdx = -1;
      let nIdx = -1;
      let stIdx = -1;
      let ntIdx = -1;
      let mult = 1;

      row.forEach((cell, idx) => {
        const norm = String(cell || '').replace(/\s+/g, '').toLowerCase();
        if (!norm) return;
        if (mIdx === -1 && modelAliases.some((k) => norm.includes(k))) {
          mIdx = idx;
        }
        if (
          aIdx === -1 &&
          amountAliases.some((k) => norm.includes(k)) &&
          !norm.includes('출고가') &&
          !norm.includes('판매가') &&
          !norm.includes('행사가')
        ) {
          aIdx = idx;
          if (norm.includes('만원') || norm.includes('(만)') || norm.includes('단위:만')) {
            mult = 10_000;
          } else if (norm.includes('천원') || norm.includes('(천)')) {
            mult = 1_000;
          }
        }
        if (cIdx === -1 && catAliases.some((k) => norm === k || norm.includes(k))) {
          cIdx = idx;
        }
        if (nIdx === -1 && nameAliases.some((k) => norm === k || norm.includes(k))) {
          nIdx = idx;
        }
        if (stIdx === -1 && saleTypeAliases.some((k) => norm === k || norm.includes(k))) {
          stIdx = idx;
        }
        if (ntIdx === -1 && noteAliases.some((k) => norm === k || norm.includes(k))) {
          ntIdx = idx;
        }
      });

      if (mIdx !== -1 && aIdx !== -1 && mIdx !== aIdx) {
        headerRowIdx = r;
        modelCol = mIdx;
        amountCol = aIdx;
        catCol = cIdx;
        nameCol = nIdx;
        saleTypeCol = stIdx;
        noteCol = ntIdx;
        unitMultiplier = mult;
        break;
      }
    }

    if (headerRowIdx !== -1) {
      let carryCategory = '';
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const rawModel = String(row[modelCol] ?? '').trim();
        const rawCat = catCol !== -1 ? String(row[catCol] ?? '').trim() : '';
        if (rawCat) carryCategory = rawCat;
        if (!rawModel) continue;

        const cleanCode = cleanUploadedModelCode(rawModel);
        if (!looksLikeValidModelCode(cleanCode)) continue;

        let amt = parseIncentiveAmountCell(row[amountCol], unitMultiplier);
        // 단가표에 헤더 단위 표기 없이 1~99 숫자로 적힌 만원 단위 방어 (예: 5 -> 50,000원)
        if (unitMultiplier === 1 && amt > 0 && amt < 300) {
          amt = amt * 10_000;
        }
        if (amt <= 0) continue;

        collected.push({
          id: `XLS-${Date.now()}-${r}-${collected.length}`,
          category: carryCategory || sheetName || '가전',
          modelCode: cleanCode,
          productName: nameCol !== -1 ? String(row[nameCol] ?? '').trim() || undefined : undefined,
          incentiveAmount: amt,
          saleTypeFilter: saleTypeCol !== -1 ? parseSaleTypeFilterCell(row[saleTypeCol]) : 'all',
          note: noteCol !== -1 ? String(row[noteCol] ?? '').trim() || undefined : undefined,
        });
      }
    } else {
      // 헤더 없는 단순 2~4열 시트 자동 복구
      for (let r = 0; r < rows.length; r++) {
        const row = (rows[r] || []).map((v) => String(v ?? '').trim()).filter(Boolean);
        if (row.length < 2) continue;
        const codeCell = row.find((cell) => looksLikeValidModelCode(cell));
        if (!codeCell) continue;
        const otherCells = row.filter((c) => c !== codeCell);
        let amt = 0;
        for (const c of otherCells) {
          const parsedAmt = parseIncentiveAmountCell(c, 1);
          const adjusted = parsedAmt > 0 && parsedAmt < 300 ? parsedAmt * 10_000 : parsedAmt;
          // 제품 출고가(수백만원)가 아닌 수당 범위(1천원 ~ 150만원) 우선 선택
          if (adjusted >= 1_000 && adjusted <= 1_500_000) {
            amt = adjusted;
            break;
          }
        }
        if (amt > 0) {
          const catGuess = otherCells.find(
            (c) => !/\d/.test(c) && c.length <= 12
          );
          collected.push({
            id: `XLSF-${Date.now()}-${r}-${collected.length}`,
            category: catGuess || sheetName || '가전',
            modelCode: cleanUploadedModelCode(codeCell),
            incentiveAmount: amt,
            saleTypeFilter: 'all',
          });
        }
      }
    }
  }

  const deduped = mergeModelIncentiveRules([], collected);
  if (deduped.length === 0) {
    throw new Error(
      '파일에서 모델코드와 수당 금액 열을 찾지 못했습니다. (헤더에 "모델명/모델코드"와 "수당/인센티브/시상금" 열이 있는지 확인해 주세요.)'
    );
  }
  return deduped;
}

export async function parseModelIncentiveImage(
  file: File
): Promise<ModelIncentiveRule[]> {
  const compressed = await compressImageFile(file, 1920, 0.86);
  const apiKey = getEffectiveGeminiApiKey();

  // 1차: 백엔드 서버 엔드포인트(/api/ai/parse-model-incentive-image) 호출
  try {
    const resp = await fetch('/api/ai/parse-model-incentive-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.dataUrl,
        mimeType: compressed.mimeType,
        apiKey,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.rules) && data.rules.length > 0) {
        const mapped: ModelIncentiveRule[] = data.rules
          .map((item: any, idx: number) => {
            const rawAmt = Number(item.incentiveAmount) || 0;
            const amt = rawAmt > 0 && rawAmt < 300 ? rawAmt * 10_000 : rawAmt;
            return {
              id: `IMG-${Date.now()}-${idx}`,
              category: String(item.category || '가전').trim(),
              modelCode: cleanUploadedModelCode(item.modelCode || ''),
              productName: item.productName ? String(item.productName).trim() : undefined,
              incentiveAmount: amt,
              saleTypeFilter: parseSaleTypeFilterCell(item.saleTypeFilter),
              note: item.note ? String(item.note).trim() : undefined,
            };
          })
          .filter((r: ModelIncentiveRule) => r.modelCode && r.incentiveAmount > 0);
        const deduped = mergeModelIncentiveRules([], mapped);
        if (deduped.length > 0) return deduped;
      }
    }
  } catch {
    // 서버 미구동(정적 배포) 환경일 경우 아래 클라이언트 직접 호출로 자동 폴백
  }

  // 2차: 클라이언트 직접 Gemini Vision 호출 폴백
  if (!apiKey) {
    throw new Error(
      'AI 사진 인식을 위해 상단 설정(열쇠 아이콘)에서 Gemini API 키를 먼저 등록해 주세요.'
    );
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const promptText = `당신은 가전 매장의 '월별 제품 모델별 판매수당(인센티브/장려금/시상금) 단가표' 이미지를 분석하는 전문 AI입니다.
이미지 속 표나 목록에서 각 제품의 모델코드(모델명)와 해당 모델 판매 시 지급되는 수당 금액(원 단위 정수)을 추출해 JSON으로 반환하세요.
- modelCode: 영문+숫자 모델코드(예: RM70F64M2X, OLED65C4, W20WAN). 제조사 접미사(.AKOR 등) 제거.
- category: 품목명(예: 냉장고, 김치냉장고, TV, 워시타워, 에어컨, 세탁기 등).
- productName: 상품명(있을 경우).
- incentiveAmount: 원 단위 수당 정수 (예: 표에 '5만', '50,000', 또는 단위:만원 열에 '5'로 적혀 있으면 반드시 50000으로 변환. 제품 판매가가 아닌 판매사원 수당/시상금을 추출할 것).
- saleTypeFilter: 전체 공통이면 'all', 구독 전용이면 'subscription', 일반 전용이면 'general'.`;

  let lastErr: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: compressed.mimeType,
                  data: compressed.base64Data,
                },
              },
              { text: promptText },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    modelCode: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    incentiveAmount: { type: Type.INTEGER },
                    saleTypeFilter: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['modelCode', 'incentiveAmount'],
                },
              },
            },
            required: ['rules'],
          },
        },
      });
      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        const rules: ModelIncentiveRule[] = (parsed?.rules || [])
          .map((item: any, idx: number) => {
            const rawAmt = Number(item.incentiveAmount) || 0;
            const amt = rawAmt > 0 && rawAmt < 300 ? rawAmt * 10_000 : rawAmt;
            return {
              id: `IMGC-${Date.now()}-${idx}`,
              category: String(item.category || '가전').trim(),
              modelCode: cleanUploadedModelCode(item.modelCode || ''),
              productName: item.productName ? String(item.productName).trim() : undefined,
              incentiveAmount: amt,
              saleTypeFilter: parseSaleTypeFilterCell(item.saleTypeFilter),
              note: item.note ? String(item.note).trim() : undefined,
            };
          })
          .filter((r: ModelIncentiveRule) => r.modelCode && r.incentiveAmount > 0);
        const deduped = mergeModelIncentiveRules([], rules);
        if (deduped.length > 0) return deduped;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    lastErr?.message || '이미지에서 모델별 수당 정보를 추출하지 못했습니다. 선명한 표 사진으로 다시 시도해 주세요.'
  );
}

export function parseModelIncentiveFreeText(text: string): ModelIncentiveRule[] {
  if (!text || !text.trim()) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rules: ModelIncentiveRule[] = [];
  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
    const tokens = line
      .split(/[\t,|/]+|\s{2,}|\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length < 2) return;

    const codeToken = tokens.find((t) => looksLikeValidModelCode(t));
    if (!codeToken) return;

    const remaining = tokens.filter((t) => t !== codeToken);
    let foundAmt = 0;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const candidate = parseIncentiveAmountCell(remaining[i], 1);
      const adjusted = candidate > 0 && candidate < 300 ? candidate * 10_000 : candidate;
      if (adjusted >= 1_000 && adjusted <= 2_000_000) {
        foundAmt = adjusted;
        break;
      }
    }
    if (foundAmt <= 0) return;

    const catToken = remaining.find(
      (t) => !/\d/.test(t) && !t.includes('만') && !t.includes('천') && t.length <= 12
    );

    rules.push({
      id: `TXT-${Date.now()}-${idx}`,
      category: catToken || '가전',
      modelCode: cleanUploadedModelCode(codeToken),
      incentiveAmount: foundAmt,
      saleTypeFilter: parseSaleTypeFilterCell(line),
    });
  });

  return mergeModelIncentiveRules([], rules);
}

export async function downloadModelIncentiveExcelTemplate(
  yearMonth: string,
  existingRules: ModelIncentiveRule[] = []
): Promise<void> {
  const XLSX = await import('xlsx');
  const rows =
    existingRules.length > 0
      ? existingRules.map((r) => ({
          품목: r.category || '가전',
          모델코드: r.modelCode,
          상품명: r.productName || '',
          '수당금액(원)': r.incentiveAmount,
          적용구분:
            r.saleTypeFilter === 'subscription'
              ? '구독전용'
              : r.saleTypeFilter === 'general'
              ? '일반전용'
              : '공통',
          비고: r.note || '',
        }))
      : [
          {
            품목: '냉장고',
            모델코드: 'RM70F64M2X',
            상품명: '비스포크 AI 하이브리드 4도어',
            '수당금액(원)': 50000,
            적용구분: '공통',
            비고: '예시 행 (자유롭게 수정 후 업로드하세요)',
          },
          {
            품목: 'TV',
            모델코드: 'OLED65C4',
            상품명: 'LG 올레드 evo 65형',
            '수당금액(원)': 100000,
            적용구분: '공통',
            비고: '',
          },
          {
            품목: '워시타워',
            모델코드: 'W20WAN',
            상품명: '오브제컬렉션 워시타워',
            '수당금액(원)': 70000,
            적용구분: '구독전용',
            비고: '',
          },
        ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${yearMonth}_모델수당표`);
  XLSX.writeFile(wb, `모델별_수당단가표_${yearMonth}.xlsx`);
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
