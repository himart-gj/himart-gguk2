import {
  CustomerFreedCounts,
  CustomerItem,
  CustomerSaleType,
  CustomerStatus,
  MAX_QUOTES_PER_CUSTOMER,
  PurchasedModelEntry,
  QuotePlan2Summary,
  QuoteRecord,
  SlipDeliveryStatus,
} from '../types/crm';
import { getNowDateTimeStr, getTodayStr } from '../utils/date';
import {
  aggregateSlipUnitsToProfile,
  buildConfirmedSlipUnitProfiles,
  createEmptyFreedCounts,
  extractPerformanceFromProposalState,
  getConfirmedSlipQuotes,
  parsePurchasedModelsFromItemsText,
  sanitizeFreedCounts,
} from '../utils/settlementEngine';
import {
  calculateGeneralPurchaseSummary,
  calculateSubscriptionSummary,
  getGeneralPlan1And2Summaries,
  ProposalState,
} from '../../types/proposal';
import type { ParsedHisisSlipResult } from '../../utils/aiImageParser';
import {
  enqueueOfflineMutation,
  flushPendingOutbox,
  idbMirrorGet,
  idbMirrorSet,
} from '../../utils/offlineDbQueue';

export { MAX_QUOTES_PER_CUSTOMER };

const FREED_COUNT_KEYS: (keyof CustomerFreedCounts)[] = [
  'hi72',
  'hi90',
  'hi108',
  'hf75',
  'hf150',
  'hf225',
  'hf300',
];

function sumIntrinsicConfirmedSlipFreedCounts(
  quotes: QuoteRecord[]
): CustomerFreedCounts {
  const out = createEmptyFreedCounts();
  for (const q of quotes) {
    if (!q || !q.isConfirmedSlip) continue;
    const raw =
      q.freedCounts ||
      extractPerformanceFromProposalState(q.proposalState)?.freedCounts;
    const clean = sanitizeFreedCounts(raw);
    for (const k of FREED_COUNT_KEYS) {
      out[k] += clean[k];
    }
  }
  return out;
}

function mergeConfirmedSlipFreedCountsPreservingManualExtra(
  prevQuotes: QuoteRecord[],
  nextQuotes: QuoteRecord[],
  prevCustomerFreed?: CustomerFreedCounts
): CustomerFreedCounts | undefined {
  if (!nextQuotes.some((q) => Boolean(q?.isConfirmedSlip))) {
    return prevCustomerFreed;
  }
  const prevSlipSum = sumIntrinsicConfirmedSlipFreedCounts(prevQuotes);
  const nextSlipSum = sumIntrinsicConfirmedSlipFreedCounts(nextQuotes);
  const prevCust = sanitizeFreedCounts(prevCustomerFreed);
  const merged = createEmptyFreedCounts();
  for (const k of FREED_COUNT_KEYS) {
    const manualExtra = Math.max(0, prevCust[k] - prevSlipSum[k]);
    merged[k] = nextSlipSum[k] + manualExtra;
  }
  return merged;
}

export const STORAGE_KEY_CACHE = 'gookji_crm_customers_cache_v3';

let inMemoryCustomersCache: CustomerItem[] | null = null;
export const CRM_CUSTOMERS_UPDATED_EVENT = 'himart_crm_customers_updated';

export function normalizePhoneKey(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function normalizeNameKey(name: string): string {
  return String(name || '').trim().toLowerCase();
}

export function normalizeOrderNoKey(orderNo?: string): string {
  return String(orderNo || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function getCustomerIdentityKey(c: CustomerItem): string {
  const nameKey = normalizeNameKey(c.name);
  const phoneKey = normalizePhoneKey(c.phone);
  if (nameKey && phoneKey) {
    return `${nameKey}__${phoneKey}`;
  }
  return c.id;
}

/**
 * 과거 인스타 DB 자동연동 중 생성되었던 0원 더미 견적인지 판별
 */
export function isDummyInstaZeroQuote(q?: QuoteRecord | null): boolean {
  if (!q) return false;
  const hasRealAmount =
    (Number(q.paidAmount) || 0) > 0 ||
    (Number(q.netAmount) || 0) > 0 ||
    (Number(q.performanceAmount) || 0) > 0;
  if (hasRealAmount || q.proposalState || q.isConfirmedSlip) return false;
  const title = String(q.title || '').trim();
  const benefit = String(q.benefit || '').trim();
  return (
    title.startsWith('인스타DB') ||
    benefit === '인스타 광고 전용 최대 혜택 안내'
  );
}

/**
 * 보관된 QuoteRecord로부터 고객 카드 최상위 대표 금액·품목·실적 필드를 정확히 추출
 */
export function buildPrimaryFieldsFromQuote(
  quote: QuoteRecord,
  fallbackCustomer?: Partial<CustomerItem>
): Partial<CustomerItem> {
  const extractedPerf = extractPerformanceFromProposalState(quote.proposalState);
  let resolvedPaid = Math.max(0, Number(quote.paidAmount) || 0);
  let resolvedNet = Math.max(0, Number(quote.netAmount) || 0);

  // 혹시라도 quote.netAmount가 0이고 proposalState가 살아있는 경우 proposalState에서 즉시 정밀 재계산
  if ((resolvedNet <= 0 || resolvedPaid <= 0) && quote.proposalState) {
    try {
      const { plan1Data, plan2Data, hasPlan1Data, hasPlan2Data } =
        getGeneralPlan1And2Summaries(quote.proposalState as ProposalState);
      const primaryData = !hasPlan1Data && hasPlan2Data ? plan2Data : plan1Data;
      const mode = (quote.proposalState as ProposalState).quoteMode || quote.quoteMode;
      if (mode === 'subscription') {
        const subSum = calculateSubscriptionSummary(primaryData);
        if (resolvedPaid <= 0) resolvedPaid = Math.max(0, subSum.totalBaseMonthly || 0);
        if (resolvedNet <= 0) resolvedNet = Math.max(0, subSum.finalMonthlyFee || 0);
      } else {
        const genSum = calculateGeneralPurchaseSummary(primaryData);
        if (resolvedPaid <= 0) resolvedPaid = Math.max(0, genSum.payPrice || genSum.sum || 0);
        if (resolvedNet <= 0) resolvedNet = Math.max(0, genSum.rawNet || 0);
      }
    } catch {
      // ignore fallback calc error
    }
  }

  const saleType: CustomerSaleType =
    extractedPerf?.saleType ||
    quote.quoteMode ||
    fallbackCustomer?.saleType ||
    'general';

  const performanceAmount = quote.isConfirmedSlip
    ? quote.performanceAmount ?? extractedPerf?.performanceAmount ?? resolvedPaid
    : extractedPerf?.performanceAmount ?? quote.performanceAmount ?? resolvedPaid;

  return {
    items: (quote.itemSummary || '').trim() || fallbackCustomer?.items || '',
    paidAmount: resolvedPaid,
    netAmount: resolvedNet,
    expectedBenefit: (quote.benefit || '').trim() || fallbackCustomer?.expectedBenefit || '',
    saleType,
    performanceAmount,
    generalProductTotal: quote.isConfirmedSlip
      ? quote.generalProductTotal ?? extractedPerf?.generalProductTotal ?? 0
      : extractedPerf?.generalProductTotal ?? quote.generalProductTotal ?? 0,
    subscriptionPrincipal: quote.isConfirmedSlip
      ? quote.subscriptionPrincipal ?? extractedPerf?.subscriptionPrincipal ?? 0
      : extractedPerf?.subscriptionPrincipal ?? quote.subscriptionPrincipal ?? 0,
    freedCounts:
      extractedPerf?.freedCounts ?? quote.freedCounts ?? fallbackCustomer?.freedCounts,
    purchasedModels:
      extractedPerf?.purchasedModels ??
      quote.purchasedModels ??
      fallbackCustomer?.purchasedModels,
  };
}

/**
 * HISIS 확정 전표(isConfirmedSlip: true)를 1건 이상 보유한 고객의
 * 통합 실적(일반 2회+ / 구독 2회+ / 일반+구독 혼합), 품목, 대표 배송상태(하나라도 배송대기면 계약완료, 모두 완료면 배송완료),
 * 가장 빠른 미완료 배달일자(D-Day 기준)를 자동으로 합산·동기화합니다.
 */
export function syncCustomerFromConfirmedSlips(
  customer: CustomerItem
): CustomerItem {
  const confirmedSlips = getConfirmedSlipQuotes(customer);
  if (confirmedSlips.length === 0) return customer;

  const slipUnits = buildConfirmedSlipUnitProfiles(customer);
  const agg = aggregateSlipUnitsToProfile(customer, slipUnits);

  const genSlips = confirmedSlips.filter(
    (q) =>
      q.quoteMode === 'general' ||
      (q.quoteMode === 'hybrid' && (Number(q.generalProductTotal) || 0) > 0) ||
      (!q.quoteMode && (Number(q.generalProductTotal) || 0) > 0)
  );
  const subSlips = confirmedSlips.filter(
    (q) =>
      q.quoteMode === 'subscription' ||
      (Number(q.subscriptionPrincipal) || 0) > 0
  );

  const genPaidSum = genSlips.reduce(
    (s, q) => s + Math.max(0, Number(q.paidAmount) || 0),
    0
  );
  const genNetSum = genSlips.reduce(
    (s, q) => s + Math.max(0, Number(q.netAmount) || Number(q.paidAmount) || 0),
    0
  );
  const subMonthlyPaidSum = subSlips.reduce(
    (s, q) => s + Math.max(0, Number(q.paidAmount) || 0),
    0
  );
  const subMonthlyNetSum = subSlips.reduce(
    (s, q) => s + Math.max(0, Number(q.netAmount) || Number(q.paidAmount) || 0),
    0
  );

  let paidAmount = customer.paidAmount;
  let netAmount = customer.netAmount;
  let expectedBenefit = customer.expectedBenefit;

  if (agg.saleType === 'general') {
    paidAmount = genPaidSum;
    netAmount = genNetSum;
    expectedBenefit =
      confirmedSlips.length >= 2
        ? `확정 일반전표 ${confirmedSlips.length}건 통합 (실구매합계 ${genPaidSum.toLocaleString('ko-KR')}원)`
        : confirmedSlips[0]?.benefit || customer.expectedBenefit;
  } else if (agg.saleType === 'subscription') {
    paidAmount = subMonthlyPaidSum;
    netAmount = subMonthlyNetSum;
    expectedBenefit =
      confirmedSlips.length >= 2
        ? `확정 구독전표 ${confirmedSlips.length}건 통합 (구독원금 ${agg.subscriptionPrincipal.toLocaleString('ko-KR')}원 · 월 ${subMonthlyPaidSum.toLocaleString('ko-KR')}원)`
        : confirmedSlips[0]?.benefit || customer.expectedBenefit;
  } else {
    paidAmount = genPaidSum > 0 ? genPaidSum : subMonthlyPaidSum;
    netAmount = genNetSum > 0 ? genNetSum : subMonthlyNetSum;
    expectedBenefit = `일반 ${genSlips.length}건(${genPaidSum.toLocaleString('ko-KR')}원) + 구독 ${subSlips.length}건(월 ${subMonthlyPaidSum.toLocaleString('ko-KR')}원 · 원금 ${agg.subscriptionPrincipal.toLocaleString('ko-KR')}원)`;
  }

  const combinedItems =
    confirmedSlips
      .map((q) => (q.itemSummary || '').trim())
      .filter(Boolean)
      .join(' + ') || customer.items;

  // 대표 배송 상태 및 다음 배송일(D-Day) 자동 산정
  const pendingSlips = confirmedSlips.filter(
    (q) => q.deliveryStatus !== '배송완료'
  );
  let nextStatus: CustomerStatus = customer.status;
  let nextLogisticsConfirmed = Boolean(customer.logisticsConfirmed);
  let nextDeliveryDate = customer.deliveryDate || '';

  if (customer.status !== '취소/보류') {
    if (pendingSlips.length > 0) {
      nextStatus = '계약완료';
      // 사용자가 [배송대기] -> [물류확정]으로 전환한 상태를 덮어쓰지 않고 보존
      nextLogisticsConfirmed = Boolean(customer.logisticsConfirmed);
      const pendingDates = pendingSlips
        .map((q) => (q.deliveryDate || '').trim())
        .filter(Boolean)
        .sort();
      nextDeliveryDate = pendingDates[0] || '';
    } else {
      nextStatus = '배송완료';
      nextLogisticsConfirmed = true;
      const doneDates = confirmedSlips
        .map((q) => (q.deliveryDate || q.contractDate || '').trim())
        .filter(Boolean)
        .sort();
      nextDeliveryDate =
        doneDates[doneDates.length - 1] || customer.deliveryDate || '';
    }
  }

  const latestSlip = confirmedSlips[0];
  const latestSlipWithOrder = confirmedSlips.find((s) =>
    Boolean((s.orderNo || '').trim())
  );

  return {
    ...customer,
    items: combinedItems,
    paidAmount,
    netAmount,
    expectedBenefit,
    saleType: agg.saleType,
    performanceAmount: agg.performanceAmount,
    generalProductTotal: agg.generalProductTotal,
    subscriptionPrincipal: agg.subscriptionPrincipal,
    freedCounts: agg.freedCounts,
    purchasedModels: agg.purchasedModels,
    status: nextStatus,
    logisticsConfirmed: nextLogisticsConfirmed,
    deliveryDate: nextDeliveryDate,
    contractDate:
      latestSlip?.contractDate || customer.contractDate || agg.contractDateStr,
    orderNo: latestSlipWithOrder?.orderNo?.trim() || customer.orderNo || '',
  };
}

function isInstaPlaceholderItems(items?: string): boolean {
  const s = String(items || '').trim();
  if (!s) return true;
  return (
    s.includes('인스타 광고') ||
    s.includes('오픈점 최대 지원') ||
    s.includes('구매 부담 경감')
  );
}

function deduplicateQuoteRecords(quotes: QuoteRecord[]): QuoteRecord[] {
  const result: QuoteRecord[] = [];
  const seenIds = new Set<string>();
  const seenOrderNos = new Set<string>();

  for (const q of quotes) {
    if (!q || !q.id || isDummyInstaZeroQuote(q)) continue;
    if (seenIds.has(q.id)) continue;
    const orderKey = normalizeOrderNoKey(q.orderNo);
    if (orderKey && seenOrderNos.has(orderKey)) {
      continue;
    }
    seenIds.add(q.id);
    if (orderKey) seenOrderNos.add(orderKey);
    result.push(q);
    if (result.length >= MAX_QUOTES_PER_CUSTOMER) break;
  }
  return result;
}

/**
 * [자가 치유 엔진]
 * 1) 0원 더미 '인스타DB (...)' 견적이 남아 있으면 자동 제거
 * 2) 확정 전표 보유 고객은 다중 전표 통합 집계(syncCustomerFromConfirmedSlips) 항상 유지
 * 3) 일반 상담 고객 중 최상위 요약 필드가 비어 있으면 보관된 대표 견적으로 복원
 */
export function healCustomerPrimaryQuoteFields(item: CustomerItem): CustomerItem {
  const rawQuotes = Array.isArray(item.quotes) ? item.quotes : [];
  const cleanedQuotes = deduplicateQuoteRecords(rawQuotes);

  if (cleanedQuotes.some((q) => q.isConfirmedSlip)) {
    return syncCustomerFromConfirmedSlips({
      ...item,
      quotes: cleanedQuotes,
    });
  }

  const primaryValidQuote = cleanedQuotes.find(
    (q) =>
      (Number(q.netAmount) || 0) > 0 ||
      (Number(q.paidAmount) || 0) > 0 ||
      (Number(q.performanceAmount) || 0) > 0 ||
      Boolean(q.proposalState)
  );

  if (!primaryValidQuote) {
    if (cleanedQuotes.length !== rawQuotes.length) {
      return { ...item, quotes: cleanedQuotes };
    }
    return item;
  }

  const needsNetHeal = !(Number(item.netAmount) > 0);
  const needsPaidHeal = !(Number(item.paidAmount) > 0);
  const needsItemsHeal = isInstaPlaceholderItems(item.items);
  const needsBenefitHeal =
    !item.expectedBenefit ||
    item.expectedBenefit === '인스타 광고 전용 최대 혜택 안내';
  const needsPerfHeal = !(Number(item.performanceAmount) > 0);

  if (
    !needsNetHeal &&
    !needsPaidHeal &&
    !needsItemsHeal &&
    !needsBenefitHeal &&
    !needsPerfHeal &&
    cleanedQuotes.length === rawQuotes.length
  ) {
    return item;
  }

  const fromQuote = buildPrimaryFieldsFromQuote(primaryValidQuote, item);

  return {
    ...item,
    quotes: cleanedQuotes,
    items: needsItemsHeal ? fromQuote.items || item.items : item.items,
    paidAmount: needsPaidHeal
      ? fromQuote.paidAmount ?? item.paidAmount
      : item.paidAmount,
    netAmount: needsNetHeal
      ? fromQuote.netAmount ?? item.netAmount
      : item.netAmount,
    expectedBenefit: needsBenefitHeal
      ? fromQuote.expectedBenefit ?? item.expectedBenefit
      : item.expectedBenefit,
    saleType:
      needsNetHeal || needsPaidHeal || !item.saleType
        ? fromQuote.saleType || item.saleType
        : item.saleType,
    performanceAmount: needsPerfHeal
      ? fromQuote.performanceAmount ?? item.performanceAmount
      : item.performanceAmount,
    generalProductTotal:
      !(Number(item.generalProductTotal) > 0) &&
      (fromQuote.generalProductTotal || 0) > 0
        ? fromQuote.generalProductTotal
        : item.generalProductTotal,
    subscriptionPrincipal:
      !(Number(item.subscriptionPrincipal) > 0) &&
      (fromQuote.subscriptionPrincipal || 0) > 0
        ? fromQuote.subscriptionPrincipal
        : item.subscriptionPrincipal,
    freedCounts: item.freedCounts ?? fromQuote.freedCounts,
    purchasedModels:
      Array.isArray(item.purchasedModels) && item.purchasedModels.length > 0
        ? item.purchasedModels
        : fromQuote.purchasedModels,
  };
}

/**
 * 견적/전표 보관함에서 특정 항목을 삭제할 때 남은 전표/견적으로 고객 요약카드를 즉시 재동기화
 */
export function deleteQuoteAndSyncCustomer(
  customer: CustomerItem,
  quoteId: string
): CustomerItem {
  const nextQuotes = (customer.quotes || []).filter(
    (q) => q.id !== quoteId && !isDummyInstaZeroQuote(q)
  );
  if (nextQuotes.some((q) => q.isConfirmedSlip)) {
    const reconciledFreed = mergeConfirmedSlipFreedCountsPreservingManualExtra(
      customer.quotes || [],
      nextQuotes,
      customer.freedCounts
    );
    return syncCustomerFromConfirmedSlips({
      ...customer,
      freedCounts: reconciledFreed,
      quotes: nextQuotes,
      updatedAtMs: Date.now(),
    });
  }
  if (nextQuotes.length > 0) {
    const topValid =
      nextQuotes.find(
        (q) =>
          (Number(q.netAmount) || 0) > 0 ||
          (Number(q.paidAmount) || 0) > 0 ||
          Boolean(q.proposalState)
      ) || nextQuotes[0];
    const syncedPatch = buildPrimaryFieldsFromQuote(topValid, customer);
    return {
      ...customer,
      ...syncedPatch,
      quotes: nextQuotes,
      updatedAtMs: Date.now(),
    };
  }
  return {
    ...customer,
    quotes: [],
    updatedAtMs: Date.now(),
  };
}

/**
 * 특정 확정 전표의 배송 상태([🚚 배송] <-> [✅ 배송완료])를 토글하고 고객 대표 상태·D-Day를 즉시 재산정
 */
export function toggleSlipDeliveryStatusAndSyncCustomer(
  customer: CustomerItem,
  quoteId: string
): CustomerItem {
  const today = getTodayStr();
  let reopenedToPending = false;
  const nextQuotes = (customer.quotes || []).map((q) => {
    if (q.id !== quoteId) return q;
    const nextDelivStatus: SlipDeliveryStatus =
      q.deliveryStatus === '배송완료' ? '배송대기' : '배송완료';
    if (nextDelivStatus === '배송대기') {
      reopenedToPending = true;
    }
    const nextDelivDate =
      nextDelivStatus === '배송완료' && !(q.deliveryDate || '').trim()
        ? q.contractDate || today
        : q.deliveryDate;
    return {
      ...q,
      isConfirmedSlip: true,
      deliveryStatus: nextDelivStatus,
      deliveryDate: nextDelivDate,
    };
  });

  const nextLogistics =
    reopenedToPending && customer.status === '배송완료'
      ? false
      : Boolean(customer.logisticsConfirmed);

  return syncCustomerFromConfirmedSlips({
    ...customer,
    logisticsConfirmed: nextLogistics,
    quotes: nextQuotes,
    updatedAtMs: Date.now(),
  });
}

export interface QuoteSlipInlinePatch {
  orderNo?: string;
  contractDate?: string;
  deliveryDate?: string;
  deliveryStatus?: SlipDeliveryStatus;
  itemSummary?: string;
  promoteToConfirmedSlip?: boolean;
}

/**
 * 개별 전표/견적의 전표번호(orderNo)·계약일·배달일·배송상태·품목요약을 인라인 수정하거나
 * 일반 상담 견적을 확정 전표(isConfirmedSlip: true)로 즉시 승격하고 고객 통합 실적을 재동기화합니다.
 */
export function updateQuoteSlipAndSyncCustomer(
  customer: CustomerItem,
  quoteId: string,
  patch: QuoteSlipInlinePatch
): CustomerItem {
  const today = getTodayStr();
  const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
  let editedOrderNo: string | undefined = undefined;
  let wasPrimarySlipEdited = false;

  const prevConfirmedIds = rawQuotes
    .filter((q) => Boolean(q?.isConfirmedSlip))
    .map((q) => q.id);

  const nextQuotes = rawQuotes.map((q) => {
    if (q.id !== quoteId) return q;

    const nextIsSlip = Boolean(
      q.isConfirmedSlip || patch.promoteToConfirmedSlip
    );
    const nextOrderNo =
      patch.orderNo !== undefined
        ? patch.orderNo.trim()
        : (q.orderNo || '').trim();
    editedOrderNo = nextOrderNo;
    if (
      prevConfirmedIds.length <= 1 &&
      (prevConfirmedIds[0] === q.id || prevConfirmedIds.length === 0)
    ) {
      wasPrimarySlipEdited = true;
    }

    const nextContractDate =
      patch.contractDate !== undefined
        ? patch.contractDate.trim()
        : q.contractDate || customer.contractDate || today;
    const nextDelivStatus: SlipDeliveryStatus =
      patch.deliveryStatus || q.deliveryStatus || '배송대기';
    const rawDelivDate =
      patch.deliveryDate !== undefined
        ? patch.deliveryDate.trim()
        : q.deliveryDate || '';
    const nextDeliveryDate =
      nextDelivStatus === '배송완료' && !rawDelivDate
        ? nextContractDate || today
        : rawDelivDate;

    const nextItemSummary =
      patch.itemSummary !== undefined && patch.itemSummary.trim()
        ? patch.itemSummary.trim()
        : q.itemSummary;

    const coreTitle =
      (q.title || nextItemSummary.slice(0, 18) || '맞춤 견적')
        .replace(/^\[(?:전표[^\]]*|확정전표)\]\s*/, '')
        .trim() ||
      nextItemSummary.slice(0, 18) ||
      '확정전표';

    const nextTitle = nextIsSlip
      ? nextOrderNo
        ? `[전표 ${nextOrderNo}] ${coreTitle}`
        : `[확정전표] ${coreTitle}`
      : q.title;

    let nextPurchasedModels = q.purchasedModels;
    if (
      patch.itemSummary !== undefined &&
      nextItemSummary !== q.itemSummary &&
      nextItemSummary
    ) {
      const parsedModels = parsePurchasedModelsFromItemsText(
        nextItemSummary,
        q.quoteMode === 'subscription' ? 'subscription' : 'general'
      );
      if (parsedModels.length > 0) {
        const prevPrincipal =
          (q.quoteMode === 'subscription'
            ? q.subscriptionPrincipal
            : q.generalProductTotal) ||
          q.performanceAmount ||
          q.paidAmount ||
          0;
        nextPurchasedModels = parsedModels.map((pm, idx) => ({
          ...pm,
          principalAmount:
            idx === 0 && parsedModels.length === 1 && prevPrincipal > 0
              ? prevPrincipal
              : pm.principalAmount,
        }));
      }
    }

    return {
      ...q,
      title: nextTitle,
      itemSummary: nextItemSummary,
      orderNo: nextOrderNo,
      purchasedModels: nextPurchasedModels,
      ...(nextIsSlip
        ? {
            isConfirmedSlip: true,
            contractDate: nextContractDate,
            deliveryDate: nextDeliveryDate,
            deliveryStatus: nextDelivStatus,
          }
        : {}),
    };
  });

  const nextTopOrderNo =
    wasPrimarySlipEdited && editedOrderNo !== undefined
      ? editedOrderNo
      : customer.orderNo;

  if (nextQuotes.some((q) => q.isConfirmedSlip)) {
    const reconciledFreed = mergeConfirmedSlipFreedCountsPreservingManualExtra(
      rawQuotes,
      nextQuotes,
      customer.freedCounts
    );
    return syncCustomerFromConfirmedSlips({
      ...customer,
      orderNo: nextTopOrderNo,
      freedCounts: reconciledFreed,
      quotes: nextQuotes,
      updatedAtMs: Date.now(),
    });
  }

  const topQuote = nextQuotes[0];
  const syncedPatch = topQuote
    ? buildPrimaryFieldsFromQuote(topQuote, customer)
    : {};
  return {
    ...customer,
    ...syncedPatch,
    orderNo: editedOrderNo !== undefined ? editedOrderNo : customer.orderNo,
    quotes: nextQuotes,
    updatedAtMs: Date.now(),
  };
}

/**
 * 상담 견적(미확정 견적)이 여러 개일 때 선택된 견적만 남기고 나머지 비교 상담견적을 정리합니다.
 * 단, 확정 전표(isConfirmedSlip: true)는 절대 삭제되지 않도록 100% 보호합니다.
 */
export function confirmDraftQuoteAndCleanOthers(
  customer: CustomerItem,
  keepQuoteId: string
): CustomerItem {
  const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
  const targetQuote = rawQuotes.find((q) => q.id === keepQuoteId);
  if (!targetQuote || targetQuote.isConfirmedSlip) return customer;

  const nextQuotes = rawQuotes.filter(
    (q) => Boolean(q?.isConfirmedSlip) || q.id === keepQuoteId
  );

  if (nextQuotes.some((q) => q.isConfirmedSlip)) {
    return syncCustomerFromConfirmedSlips({
      ...customer,
      quotes: nextQuotes,
      updatedAtMs: Date.now(),
    });
  }

  const syncedPatch = buildPrimaryFieldsFromQuote(targetQuote, customer);
  return {
    ...customer,
    ...syncedPatch,
    quotes: nextQuotes,
    updatedAtMs: Date.now(),
  };
}

/**
 * 모든 확정 전표를 배송완료(deliveryStatus: '배송완료')로 일괄 전환하고 고객 대표 상태를 동기화합니다.
 */
export function markAllConfirmedSlipsDelivered(
  customer: CustomerItem
): CustomerItem {
  const nowMs = Date.now();
  const today = getTodayStr();
  if (
    !Array.isArray(customer.quotes) ||
    !customer.quotes.some((q) => Boolean(q?.isConfirmedSlip))
  ) {
    return {
      ...customer,
      status: '배송완료',
      logisticsConfirmed: true,
      updatedAtMs: nowMs,
    };
  }
  const nextQuotes = customer.quotes.map((q) =>
    q?.isConfirmedSlip
      ? {
          ...q,
          deliveryStatus: '배송완료' as const,
          deliveryDate:
            (q.deliveryDate || '').trim() ||
            (q.contractDate || '').trim() ||
            (customer.deliveryDate || '').trim() ||
            today,
        }
      : q
  );
  return syncCustomerFromConfirmedSlips({
    ...customer,
    quotes: nextQuotes,
    status: '배송완료',
    logisticsConfirmed: true,
    updatedAtMs: nowMs,
  });
}

/**
 * 고객 상태 변경 시 확정 전표(isConfirmedSlip) 보유 고객의 전표 배송상태 및 물류확정 플래그를 일관되게 동기화합니다.
 */
export function applyCustomerStatusChangeWithSlipSync(
  customer: CustomerItem,
  nextStatus: CustomerStatus
): CustomerItem {
  const nowMs = Date.now();
  if (nextStatus === '배송완료') {
    return markAllConfirmedSlipsDelivered(customer);
  }
  const hasConfirmed =
    Array.isArray(customer.quotes) &&
    customer.quotes.some((q) => Boolean(q?.isConfirmedSlip));

  if (!hasConfirmed) {
    return {
      ...customer,
      status: nextStatus,
      ...(nextStatus === '계약완료' ? {} : {}),
      updatedAtMs: nowMs,
    };
  }

  if (nextStatus === '취소/보류') {
    return syncCustomerFromConfirmedSlips({
      ...customer,
      status: '취소/보류',
      updatedAtMs: nowMs,
    });
  }

  // 확정 전표 보유 고객을 '계약완료'(또는 배송 단계 재오픈)로 전환할 때 모든 전표가 완료였다면 최신 전표를 배송대기로 재오픈
  const hasPending = (customer.quotes || []).some(
    (q) => q?.isConfirmedSlip && q.deliveryStatus !== '배송완료'
  );
  let reopenedFirst = false;
  const reopenedQuotes = hasPending
    ? customer.quotes
    : (customer.quotes || []).map((q) => {
        if (!reopenedFirst && q?.isConfirmedSlip) {
          reopenedFirst = true;
          return { ...q, deliveryStatus: '배송대기' as const };
        }
        return q;
      });

  return syncCustomerFromConfirmedSlips({
    ...customer,
    quotes: reopenedQuotes,
    status: '계약완료',
    logisticsConfirmed: hasPending ? Boolean(customer.logisticsConfirmed) : false,
    updatedAtMs: nowMs,
  });
}

/**
 * 고객 기본정보·실적·빠른일정 바·물류확정 수정 시 내부 확정 전표와 양방향 동기화하여
 * syncCustomerFromConfirmedSlips 재실행 시 수정한 값(물류확정, 품목, 금액, 계약일, 배달일, 전표번호)이 절대 되돌아가지 않도록 방어합니다.
 */
export function applyCustomerFieldPatchWithSlipSync(
  customer: CustomerItem,
  patch: Partial<CustomerItem>
): CustomerItem {
  const nowMs = Date.now();
  const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
  const confirmedSlips = rawQuotes.filter((q) => Boolean(q?.isConfirmedSlip));

  let nextQuotes = patch.quotes ?? rawQuotes;
  if (!patch.quotes && confirmedSlips.length === 1) {
    const onlySlipId = confirmedSlips[0].id;
    const hasSlipRelevantPatch =
      patch.orderNo !== undefined ||
      patch.contractDate !== undefined ||
      patch.deliveryDate !== undefined ||
      patch.items !== undefined ||
      patch.saleType !== undefined ||
      patch.performanceAmount !== undefined ||
      patch.generalProductTotal !== undefined ||
      patch.subscriptionPrincipal !== undefined ||
      patch.paidAmount !== undefined ||
      patch.netAmount !== undefined ||
      patch.purchasedModels !== undefined;

    if (hasSlipRelevantPatch) {
      nextQuotes = rawQuotes.map((q) => {
        if (q.id !== onlySlipId) return q;
        const nextItemSummary =
          patch.items !== undefined && patch.items.trim()
            ? patch.items.trim()
            : q.itemSummary;
        const updatedOrderNo =
          patch.orderNo !== undefined
            ? patch.orderNo.trim()
            : (q.orderNo || '').trim();
        const coreTitle =
          (q.title || nextItemSummary?.slice(0, 18) || '확정전표')
            .replace(/^\[(?:전표[^\]]*|확정전표)\]\s*/, '')
            .trim() ||
          nextItemSummary?.slice(0, 18) ||
          '확정전표';
        const updatedTitle =
          patch.orderNo !== undefined || patch.items !== undefined
            ? updatedOrderNo
              ? `[전표 ${updatedOrderNo}] ${
                  patch.items !== undefined
                    ? nextItemSummary.slice(0, 20)
                    : coreTitle
                }`
              : `[확정전표] ${
                  patch.items !== undefined
                    ? nextItemSummary.slice(0, 20)
                    : coreTitle
                }`
            : q.title;
        return {
          ...q,
          title: updatedTitle,
          orderNo: updatedOrderNo,
          itemSummary: nextItemSummary,
          ...(patch.saleType !== undefined ? { quoteMode: patch.saleType } : {}),
          ...(patch.performanceAmount !== undefined
            ? { performanceAmount: patch.performanceAmount }
            : {}),
          ...(patch.generalProductTotal !== undefined
            ? { generalProductTotal: patch.generalProductTotal }
            : {}),
          ...(patch.subscriptionPrincipal !== undefined
            ? { subscriptionPrincipal: patch.subscriptionPrincipal }
            : {}),
          ...(patch.paidAmount !== undefined
            ? { paidAmount: patch.paidAmount }
            : {}),
          ...(patch.netAmount !== undefined
            ? { netAmount: patch.netAmount }
            : {}),
          ...(patch.purchasedModels !== undefined
            ? { purchasedModels: patch.purchasedModels }
            : {}),
          contractDate:
            patch.contractDate !== undefined
              ? patch.contractDate.trim()
              : q.contractDate,
          deliveryDate:
            patch.deliveryDate !== undefined
              ? patch.deliveryDate.trim()
              : q.deliveryDate,
        };
      });
    }
  } else if (
    !patch.quotes &&
    confirmedSlips.length >= 2 &&
    (patch.contractDate !== undefined || patch.deliveryDate !== undefined)
  ) {
    const primarySlipId = confirmedSlips[0].id;
    const pendingSlips = confirmedSlips.filter(
      (s) => s.deliveryStatus !== '배송완료'
    );
    const cleanPatchDeliv =
      patch.deliveryDate !== undefined ? patch.deliveryDate.trim() : undefined;

    // 다중 전표에서 대표 배달일 변경 시 현재 D-Day 기준이 되는 미완료 전표(없으면 최신 완료 전표)에 동기화
    let targetDelivSlipId: string | null = null;
    if (cleanPatchDeliv !== undefined && cleanPatchDeliv !== '') {
      if (pendingSlips.length > 0) {
        const datedPending = [...pendingSlips]
          .filter((s) => Boolean((s.deliveryDate || '').trim()))
          .sort((a, b) =>
            (a.deliveryDate || '').localeCompare(b.deliveryDate || '')
          );
        targetDelivSlipId = (datedPending[0] || pendingSlips[0]).id;
      } else {
        targetDelivSlipId = confirmedSlips[0].id;
      }
    }

    nextQuotes = rawQuotes.map((q) => {
      if (!q?.isConfirmedSlip) return q;
      let nextContract = q.contractDate;
      let nextDeliv = q.deliveryDate;

      if (patch.contractDate !== undefined && q.id === primarySlipId) {
        nextContract = patch.contractDate.trim();
      }
      if (cleanPatchDeliv !== undefined) {
        if (cleanPatchDeliv === '') {
          if (pendingSlips.length > 0) {
            if (q.deliveryStatus !== '배송완료') nextDeliv = '';
          } else if (q.id === primarySlipId) {
            nextDeliv = '';
          }
        } else if (q.id === targetDelivSlipId) {
          nextDeliv = cleanPatchDeliv;
        }
      }

      if (nextContract === q.contractDate && nextDeliv === q.deliveryDate) {
        return q;
      }
      return {
        ...q,
        contractDate: nextContract,
        deliveryDate: nextDeliv,
      };
    });
  }

  const candidate: CustomerItem = {
    ...customer,
    ...patch,
    quotes: nextQuotes,
    updatedAtMs: nowMs,
  };

  if (nextQuotes.some((q) => q?.isConfirmedSlip)) {
    return syncCustomerFromConfirmedSlips(candidate);
  }
  return candidate;
}

export function deduplicateCustomers(list: CustomerItem[]): CustomerItem[] {
  const map = new Map<string, CustomerItem>();

  for (const rawItem of list) {
    if (!rawItem || !rawItem.name) continue;
    const item = healCustomerPrimaryQuoteFields(rawItem);
    const key = getCustomerIdentityKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...item,
        quotes: Array.isArray(item.quotes)
          ? deduplicateQuoteRecords(item.quotes)
          : [],
      });
    } else {
      const itemTouch = item.updatedAtMs || item.deletedAt || 0;
      const existTouch = existing.updatedAtMs || existing.deletedAt || 0;
      const isItemNewer =
        itemTouch !== existTouch
          ? itemTouch > existTouch
          : (item.regDate || '') >= (existing.regDate || '');
      const primary = isItemNewer ? item : existing;
      const secondary = isItemNewer ? existing : item;

      // 최신 레코드의 전표가 우선순위를 갖도록 병합 후 중복 제거(최대 30건)
      const mergedQuotes = deduplicateQuoteRecords([
        ...(primary.quotes || []),
        ...(secondary.quotes || []),
      ]);

      const mergedMemo = (() => {
        const pMemo = (primary.memo || '').trim();
        const sMemo = (secondary.memo || '').trim();
        if (!pMemo) return sMemo;
        if (!sMemo || pMemo.includes(sMemo)) return pMemo;
        if (sMemo.includes(pMemo)) return sMemo;
        return `${pMemo}\n${sMemo}`;
      })();

      const mergedGifts = (() => {
        const pGift = (primary.giftItems || '').trim();
        const sGift = (secondary.giftItems || '').trim();
        if (!pGift) return sGift;
        if (!sGift || pGift.includes(sGift)) return pGift;
        return `${pGift}, ${sGift}`;
      })();

      const mergedCandidate: CustomerItem = {
        ...secondary,
        ...primary,
        id: existing.id || item.id,
        paidAmount:
          (Number(primary.paidAmount) || 0) > 0
            ? primary.paidAmount
            : secondary.paidAmount,
        netAmount:
          (Number(primary.netAmount) || 0) > 0
            ? primary.netAmount
            : secondary.netAmount,
        items: !isInstaPlaceholderItems(primary.items)
          ? primary.items
          : secondary.items || primary.items,
        expectedBenefit:
          primary.expectedBenefit &&
          primary.expectedBenefit !== '인스타 광고 전용 최대 혜택 안내'
            ? primary.expectedBenefit
            : secondary.expectedBenefit || primary.expectedBenefit,
        contractDate:
          primary.contractDate !== undefined && primary.contractDate !== ''
            ? primary.contractDate
            : secondary.contractDate || undefined,
        deliveryDate:
          primary.deliveryDate !== undefined
            ? primary.deliveryDate
            : secondary.deliveryDate || '',
        saleType: primary.saleType || secondary.saleType || undefined,
        performanceAmount:
          (Number(primary.performanceAmount) || 0) > 0
            ? primary.performanceAmount
            : secondary.performanceAmount ?? primary.performanceAmount,
        generalProductTotal:
          primary.generalProductTotal ?? secondary.generalProductTotal,
        subscriptionPrincipal:
          primary.subscriptionPrincipal ?? secondary.subscriptionPrincipal,
        freedCounts: primary.freedCounts ?? secondary.freedCounts,
        purchasedModels: primary.purchasedModels ?? secondary.purchasedModels,
        orderNo: primary.orderNo ?? secondary.orderNo ?? '',
        giftItems: mergedGifts,
        giftSent: Boolean(primary.giftSent ?? secondary.giftSent),
        logisticsConfirmed: Boolean(
          primary.logisticsConfirmed ?? secondary.logisticsConfirmed
        ),
        followUpDate: primary.followUpDate ?? secondary.followUpDate ?? '',
        memo: mergedMemo,
        quotes: mergedQuotes,
        deletedAt: primary.deletedAt,
        updatedAtMs:
          Math.max(primary.updatedAtMs || 0, secondary.updatedAtMs || 0) ||
          undefined,
      };

      map.set(key, healCustomerPrimaryQuoteFields(mergedCandidate));
    }
  }

  return Array.from(map.values());
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getCachedCustomers(): CustomerItem[] {
  if (inMemoryCustomersCache) {
    return inMemoryCustomersCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const valid = parsed.filter(
          (c: CustomerItem) => !c.deletedAt || now - c.deletedAt < THIRTY_DAYS_MS
        );
        const deduped = deduplicateCustomers(valid);
        inMemoryCustomersCache = deduped;
        return deduped;
      }
    }
  } catch (e) {
    console.error('Failed to read local customer cache', e);
  }
  return [];
}

export function setCachedCustomers(customers: CustomerItem[]): CustomerItem[] {
  const deduped = deduplicateCustomers(customers);
  // 1순위: 인메모리 캐시 즉시 반영 (localStorage 5MB 초과 시에도 유실 0%)
  inMemoryCustomersCache = deduped;
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(deduped));
  } catch (e) {
    console.error('localStorage quota warning — relying on memory + IndexedDB mirror', e);
  }
  // 대용량 다중 견적 데이터를 IndexedDB에도 즉시 비동기 미러링 (5MB 한계 돌파)
  idbMirrorSet(STORAGE_KEY_CACHE, deduped).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CRM_CUSTOMERS_UPDATED_EVENT));
  }
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
    inMemoryCustomersCache = deduped;
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
  contractDate?: string;
  deliveryDate: string;
  followUpDate?: string;
  status: CustomerStatus;
  memo: string;
  orderNo?: string;
  giftItems?: string;
  quoteTitle?: string;
  proposalState?: any;
  quoteMode?: 'general' | 'subscription' | 'hybrid';
  saleType?: CustomerSaleType;
  performanceAmount?: number;
  generalProductTotal?: number;
  subscriptionPrincipal?: number;
  freedCounts?: CustomerFreedCounts;
  purchasedModels?: PurchasedModelEntry[];
  plan2Summary?: QuotePlan2Summary;
  planSummaries?: QuotePlan2Summary[];
  saveMode?: 'overwrite' | 'append';
  overwriteQuoteId?: string;
  allowOverwriteConfirmedSlip?: boolean;
  isConfirmedSlip?: boolean;
  slipDeliveryStatus?: SlipDeliveryStatus;
  outboundType?: string;
  deliveryTimeSlot?: string;
  logisticsConfirmed?: boolean;
}): Promise<{
  customers: CustomerItem[];
  savedCustomer: CustomerItem;
  isExistingCustomer: boolean;
  quoteCount: number;
  savedQuoteId: string;
  wasOverwritten: boolean;
}> {
  const current = getCachedCustomers();
  const nowStr = getNowDateTimeStr();
  const todayStr = getTodayStr();

  const extractedPerf = extractPerformanceFromProposalState(payload.proposalState);
  const resolvedSaleType: CustomerSaleType =
    payload.saleType ||
    extractedPerf?.saleType ||
    payload.quoteMode ||
    'general';
  const resolvedGeneralTotal =
    payload.generalProductTotal ?? extractedPerf?.generalProductTotal ?? 0;
  const resolvedSubPrincipal =
    payload.subscriptionPrincipal ?? extractedPerf?.subscriptionPrincipal ?? 0;
  const resolvedPerformanceAmount =
    payload.performanceAmount ??
    extractedPerf?.performanceAmount ??
    payload.paidAmount;
  const resolvedFreedCounts =
    payload.freedCounts ?? extractedPerf?.freedCounts;
  const resolvedPurchasedModels =
    payload.purchasedModels ?? extractedPerf?.purchasedModels;

  const cleanOrderNo = (payload.orderNo || '').trim();
  const cleanContractDate = payload.contractDate?.trim() || todayStr;
  const rawDeliveryDate = (payload.deliveryDate || '').trim();
  const effectiveIsConfirmedSlip = Boolean(
    payload.isConfirmedSlip ||
      payload.status === '계약완료' ||
      payload.status === '배송완료' ||
      cleanOrderNo
  );
  const effectiveSlipDelivStatus: SlipDeliveryStatus =
    payload.slipDeliveryStatus ||
    (payload.status === '배송완료' ? '배송완료' : '배송대기');
  const cleanDeliveryDate =
    effectiveIsConfirmedSlip &&
    effectiveSlipDelivStatus === '배송완료' &&
    !rawDeliveryDate
      ? cleanContractDate
      : rawDeliveryDate;

  const baseTitle =
    payload.quoteTitle?.trim() ||
    `${payload.items.slice(0, 18) || '맞춤 견적'}`;
  const resolvedQuoteTitle =
    effectiveIsConfirmedSlip &&
    cleanOrderNo &&
    !baseTitle.includes(cleanOrderNo)
      ? `[전표 ${cleanOrderNo}] ${baseTitle.replace(/^\[(?:전표[^\]]*|확정전표)\]\s*/, '')}`
      : baseTitle;

  const newQuote: QuoteRecord = {
    id: `QT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: resolvedQuoteTitle,
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
    ...(payload.planSummaries && payload.planSummaries.length > 0
      ? { planSummaries: payload.planSummaries }
      : {}),
    performanceAmount: resolvedPerformanceAmount,
    generalProductTotal: resolvedGeneralTotal,
    subscriptionPrincipal: resolvedSubPrincipal,
    freedCounts: resolvedFreedCounts,
    purchasedModels: resolvedPurchasedModels,
    ...(cleanOrderNo ? { orderNo: cleanOrderNo } : {}),
    ...(effectiveIsConfirmedSlip
      ? {
          isConfirmedSlip: true,
          contractDate: cleanContractDate,
          deliveryDate: cleanDeliveryDate,
          deliveryStatus: effectiveSlipDelivStatus,
          outboundType: payload.outboundType || '',
          deliveryTimeSlot: payload.deliveryTimeSlot || '',
        }
      : {}),
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
      const cName = normalizeNameKey(c.name);
      const cPhone = normalizePhoneKey(c.phone);
      if (targetNameKey && targetPhoneKey) {
        return cName === targetNameKey && cPhone === targetPhoneKey;
      }
      return targetNameKey !== '' && cName === targetNameKey && cPhone === '';
    });
  }

  let updatedList: CustomerItem[];
  let savedCustomer: CustomerItem;
  let isExistingCustomer = false;
  let savedQuoteId = newQuote.id;
  let wasOverwritten = false;

  if (existingIndex >= 0) {
    isExistingCustomer = true;
    const existing = current[existingIndex];
    const prevQuotes = (Array.isArray(existing.quotes) ? existing.quotes : []).filter(
      (q) => Boolean(q) && !isDummyInstaZeroQuote(q)
    );

    const incomingOrderKey = normalizeOrderNoKey(cleanOrderNo);
    const duplicateOrderIdx = incomingOrderKey
      ? prevQuotes.findIndex(
          (q) => normalizeOrderNoKey(q.orderNo) === incomingOrderKey
        )
      : -1;

    let nextQuotes: QuoteRecord[];
    if (duplicateOrderIdx >= 0) {
      // 동일 전표번호(orderNo) 재업로드/재저장 시 중복 추가 대신 해당 전표만 안전하게 업데이트
      wasOverwritten = true;
      const preservedId = prevQuotes[duplicateOrderIdx]?.id || newQuote.id;
      savedQuoteId = preservedId;
      const overwrittenQuote: QuoteRecord = {
        ...prevQuotes[duplicateOrderIdx],
        ...newQuote,
        id: preservedId,
      };
      nextQuotes = prevQuotes
        .map((q, idx) => (idx === duplicateOrderIdx ? overwrittenQuote : q))
        .slice(0, MAX_QUOTES_PER_CUSTOMER);
    } else if (payload.saveMode === 'overwrite' && prevQuotes.length > 0) {
      const explicitIdx = payload.overwriteQuoteId
        ? prevQuotes.findIndex((q) => q.id === payload.overwriteQuoteId)
        : -1;
      const fallbackDraftIdx = prevQuotes.findIndex((q) => !q.isConfirmedSlip);
      const candidateIdx =
        explicitIdx >= 0 ? explicitIdx : fallbackDraftIdx;
      const candidateTarget =
        candidateIdx >= 0 ? prevQuotes[candidateIdx] : undefined;

      // 확정 전표는 명시적 허용(allowOverwriteConfirmedSlip) 없이는 절대 덮어쓰지 않고 새 전표/견적으로 안전 추가
      if (
        candidateTarget &&
        (!candidateTarget.isConfirmedSlip ||
          payload.allowOverwriteConfirmedSlip)
      ) {
        wasOverwritten = true;
        const preservedId = candidateTarget.id || newQuote.id;
        savedQuoteId = preservedId;
        const overwrittenQuote: QuoteRecord = {
          ...candidateTarget,
          ...newQuote,
          id: preservedId,
          orderNo: cleanOrderNo || candidateTarget.orderNo,
          ...(effectiveIsConfirmedSlip || candidateTarget.isConfirmedSlip
            ? {
                isConfirmedSlip: true,
                contractDate:
                  payload.contractDate?.trim() ||
                  candidateTarget.contractDate ||
                  cleanContractDate,
                deliveryDate:
                  cleanDeliveryDate || candidateTarget.deliveryDate || '',
                deliveryStatus:
                  payload.status === '배송완료'
                    ? '배송완료'
                    : candidateTarget.deliveryStatus || effectiveSlipDelivStatus,
                outboundType:
                  payload.outboundType || candidateTarget.outboundType || '',
                deliveryTimeSlot:
                  payload.deliveryTimeSlot ||
                  candidateTarget.deliveryTimeSlot ||
                  '',
              }
            : {}),
        };
        const remaining = prevQuotes.filter((_, idx) => idx !== candidateIdx);
        nextQuotes = [overwrittenQuote, ...remaining].slice(
          0,
          MAX_QUOTES_PER_CUSTOMER
        );
      } else {
        nextQuotes = [newQuote, ...prevQuotes].slice(
          0,
          MAX_QUOTES_PER_CUSTOMER
        );
      }
    } else {
      nextQuotes = [newQuote, ...prevQuotes].slice(0, MAX_QUOTES_PER_CUSTOMER);
    }

    const mergedMemo = payload.memo
      ? existing.memo && !existing.memo.includes(payload.memo)
        ? `${payload.memo}\n${existing.memo}`
        : existing.memo || payload.memo
      : existing.memo;

    const mergedGiftItems = (() => {
      const incGift = (payload.giftItems || '').trim();
      const exGift = (existing.giftItems || '').trim();
      if (!incGift) return exGift;
      if (!exGift || exGift.includes(incGift)) return exGift || incGift;
      return `${exGift}, ${incGift}`;
    })();

    const reconciledFreedCounts = nextQuotes.some((q) => q.isConfirmedSlip)
      ? mergeConfirmedSlipFreedCountsPreservingManualExtra(
          prevQuotes,
          nextQuotes,
          existing.freedCounts
        )
      : existing.freedCounts ?? resolvedFreedCounts;

    const rawUpdatedCustomer: CustomerItem = {
      ...existing,
      regDate: nowStr,
      contractDate:
        payload.contractDate?.trim() ||
        existing.contractDate ||
        existing.regDate?.slice(0, 10) ||
        todayStr,
      name: payload.name.trim() || existing.name,
      phone: payload.phone.trim() || existing.phone,
      items: payload.items,
      paidAmount: payload.paidAmount,
      netAmount: payload.netAmount,
      expectedBenefit: payload.expectedBenefit,
      saleType: resolvedSaleType,
      performanceAmount: resolvedPerformanceAmount,
      generalProductTotal: resolvedGeneralTotal,
      subscriptionPrincipal: resolvedSubPrincipal,
      freedCounts: reconciledFreedCounts,
      purchasedModels: resolvedPurchasedModels,
      deliveryDate:
        payload.deliveryDate !== undefined
          ? payload.deliveryDate.trim()
          : existing.deliveryDate,
      followUpDate:
        payload.followUpDate !== undefined
          ? payload.followUpDate
          : existing.followUpDate,
      status: payload.status || existing.status,
      memo: mergedMemo,
      orderNo: cleanOrderNo || existing.orderNo,
      giftItems: mergedGiftItems,
      logisticsConfirmed: !effectiveIsConfirmedSlip
        ? Boolean(existing.logisticsConfirmed)
        : wasOverwritten
        ? Boolean(payload.logisticsConfirmed || existing.logisticsConfirmed)
        : effectiveSlipDelivStatus === '배송완료'
        ? Boolean(existing.logisticsConfirmed)
        : Boolean(payload.logisticsConfirmed),
      quotes: nextQuotes,
      deletedAt: undefined,
      updatedAtMs: Date.now(),
    };

    savedCustomer = nextQuotes.some((q) => q.isConfirmedSlip)
      ? syncCustomerFromConfirmedSlips(rawUpdatedCustomer)
      : rawUpdatedCustomer;

    updatedList = [
      savedCustomer,
      ...current.filter((_, idx) => idx !== existingIndex),
    ];
  } else {
    const rawNewCustomer: CustomerItem = {
      id: `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      regDate: nowStr,
      contractDate: cleanContractDate,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      items: payload.items,
      paidAmount: payload.paidAmount,
      netAmount: payload.netAmount,
      expectedBenefit: payload.expectedBenefit,
      saleType: resolvedSaleType,
      performanceAmount: resolvedPerformanceAmount,
      generalProductTotal: resolvedGeneralTotal,
      subscriptionPrincipal: resolvedSubPrincipal,
      freedCounts: resolvedFreedCounts,
      purchasedModels: resolvedPurchasedModels,
      deliveryDate: cleanDeliveryDate,
      followUpDate: payload.followUpDate || '',
      status: payload.status,
      memo: payload.memo,
      orderNo: cleanOrderNo,
      giftItems: (payload.giftItems || '').trim(),
      giftSent: false,
      logisticsConfirmed: Boolean(payload.logisticsConfirmed),
      quotes: [newQuote],
      deletedAt: undefined,
      updatedAtMs: Date.now(),
    };

    savedCustomer = newQuote.isConfirmedSlip
      ? syncCustomerFromConfirmedSlips(rawNewCustomer)
      : rawNewCustomer;

    updatedList = [savedCustomer, ...current];
  }

  const deduped = setCachedCustomers(updatedList);
  const syncedFinal =
    deduped.find((c) => c.id === savedCustomer.id) || savedCustomer;
  await syncCustomerToGas('upsertCustomer', syncedFinal);

  return {
    customers: deduped,
    savedCustomer: syncedFinal,
    isExistingCustomer,
    quoteCount: syncedFinal.quotes?.length || 1,
    savedQuoteId,
    wasOverwritten,
  };
}

/**
 * 다중 업로드된 HISIS 확정 전표(1장~수십 장)를 원클릭 일괄 등록합니다.
 * - 동일 고객(이름 + 전화번호 숫자 일치)은 단 1개의 고객 카드로 자동 통합(일반 2회+ / 구독 2회+ / 혼합 자동 합산)
 * - 동일 전표번호(orderNo) 재업로드 시 중복 생성 없이 기존 전표 항목만 덮어쓰기 업데이트
 */
export async function saveHisisSlipsBatch(
  slips: ParsedHisisSlipResult[],
  options: { targetCustomerId?: string } = {}
): Promise<{
  customers: CustomerItem[];
  customerCount: number;
  createdCustomerCount: number;
  mergedCustomerCount: number;
  totalSlipCount: number;
  overwrittenSlipCount: number;
  savedCustomerIds: string[];
}> {
  const savedCustomerIdSet = new Set<string>();
  const newlyCreatedCustomerIds = new Set<string>();
  let overwrittenSlipCount = 0;

  for (let i = 0; i < slips.length; i++) {
    const slip = slips[i];
    const cleanName = slip.customerName.trim() || '고객명미입력';
    const cleanPhone = slip.customerPhone.trim();

    const purchasedModels: PurchasedModelEntry[] =
      slip.quoteMode === 'subscription'
        ? slip.subscriptionItems.map((it, idx) => ({
            id: `slip-sub-${i}-${idx}-${it.modelName || it.category}`,
            category: it.category || '구독가전',
            modelName: it.modelName || it.category || '구독가전',
            quantity: 1,
            saleType: 'subscription',
            principalAmount: it.contractAmount,
          }))
        : slip.generalItems.map((it, idx) => ({
            id: `slip-gen-${i}-${idx}-${it.modelName || it.category}`,
            category: it.category || '일반가전',
            modelName: it.modelName || it.category || '일반가전',
            quantity: Math.max(1, it.quantity || 1),
            saleType: 'general',
            principalAmount: it.actualPrice,
          }));

    const paidAmount =
      slip.quoteMode === 'subscription'
        ? slip.monthlyFeeTotal
        : slip.actualPurchaseAmount;
    const netAmount = paidAmount;

    const expectedBenefit =
      slip.quoteMode === 'subscription'
        ? `${slip.subscriptionPeriod}개월 구독 (구독원금 ${slip.actualPurchaseAmount.toLocaleString('ko-KR')}원 · 월 ${slip.monthlyFeeTotal.toLocaleString('ko-KR')}원)`
        : slip.totalDiscountAmount > 0
        ? `에누리 ${slip.totalDiscountAmount.toLocaleString('ko-KR')}원 반영 (실구매가 ${slip.actualPurchaseAmount.toLocaleString('ko-KR')}원)`
        : `전표 실구매가 ${slip.actualPurchaseAmount.toLocaleString('ko-KR')}원 확정`;

    const quoteTitle = slip.orderNo
      ? `[전표 ${slip.orderNo}] ${
          slip.modelCodesSummary || slip.itemSummary.slice(0, 18)
        }`
      : `[확정전표] ${slip.modelCodesSummary || slip.itemSummary.slice(0, 18)}`;

    const res = await saveCustomerQuote({
      targetCustomerId: options.targetCustomerId,
      name: cleanName,
      phone: cleanPhone,
      items: slip.itemSummary,
      paidAmount,
      netAmount,
      expectedBenefit,
      contractDate: slip.contractDate,
      deliveryDate: slip.deliveryDate,
      status: slip.crmStatus,
      memo: slip.memoSummary,
      orderNo: slip.orderNo,
      giftItems: slip.giftItems,
      quoteTitle,
      proposalState: slip.proposalState,
      quoteMode: slip.quoteMode,
      saleType: slip.quoteMode,
      performanceAmount: slip.performanceAmount,
      generalProductTotal:
        slip.quoteMode === 'general' ? slip.actualPurchaseAmount : 0,
      subscriptionPrincipal:
        slip.quoteMode === 'subscription' ? slip.actualPurchaseAmount : 0,
      purchasedModels,
      saveMode: 'append',
      isConfirmedSlip: true,
      slipDeliveryStatus: slip.deliveryStatus,
      outboundType: slip.outboundLabel,
      deliveryTimeSlot: slip.deliveryTimeSlot,
      logisticsConfirmed: slip.logisticsConfirmed,
    });

    savedCustomerIdSet.add(res.savedCustomer.id);
    if (!res.isExistingCustomer) {
      newlyCreatedCustomerIds.add(res.savedCustomer.id);
    }
    if (res.wasOverwritten) {
      overwrittenSlipCount += 1;
    }
  }

  const finalCustomers = getCachedCustomers();
  const savedCustomerIds = Array.from(savedCustomerIdSet);
  const createdCustomerCount = newlyCreatedCustomerIds.size;
  const mergedCustomerCount = Math.max(
    0,
    savedCustomerIds.length - createdCustomerCount
  );

  return {
    customers: finalCustomers,
    customerCount: savedCustomerIds.length,
    createdCustomerCount,
    mergedCustomerCount,
    totalSlipCount: slips.length,
    overwrittenSlipCount,
    savedCustomerIds,
  };
}

export async function fetchCustomers(): Promise<CustomerItem[]> {
  return getCachedCustomers();
}

export async function saveCustomerToSheet(
  customer: CustomerItem
): Promise<boolean> {
  const stamped: CustomerItem = {
    ...customer,
    updatedAtMs: Date.now(),
  };
  const list = getCachedCustomers();
  const idx = list.findIndex((c) => c.id === stamped.id);
  const next =
    idx >= 0
      ? list.map((c, i) => (i === idx ? stamped : c))
      : [stamped, ...list];
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
