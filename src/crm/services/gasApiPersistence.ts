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
import {
  evaluateCustomerAutoArchive,
  evaluateCustomerListAutoArchive,
  stampCustomerCompletionTransitions,
} from '../utils/autoArchiveEngine';
import {
  scheduleDebouncedUserCrmCloudPush,
  syncBidirectionalUserCrm,
} from './userCrmCloudSync';

export { MAX_QUOTES_PER_CUSTOMER };

import {
  CRM_CUSTOMERS_UPDATED_EVENT,
  STORAGE_KEY_CACHE,
  deduplicateCustomers,
  isDummyInstaZeroQuote,
  mergeConfirmedSlipFreedCountsPreservingManualExtra,
  normalizeNameKey,
  normalizeOrderNoKey,
  normalizePhoneKey,
  syncCustomerFromConfirmedSlips,
} from './gasApi';

let inMemoryCustomersCache: CustomerItem[] | null = null;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getCachedCustomers(): CustomerItem[] {
  const now = Date.now();
  if (inMemoryCustomersCache) {
    const evaluated = evaluateCustomerListAutoArchive(inMemoryCustomersCache, now);
    inMemoryCustomersCache = evaluated;
    return evaluated;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (c: CustomerItem) => !c.deletedAt || now - c.deletedAt < THIRTY_DAYS_MS
        );
        const deduped = evaluateCustomerListAutoArchive(
          deduplicateCustomers(valid),
          now
        );
        inMemoryCustomersCache = deduped;
        return deduped;
      }
    }
  } catch (e) {
    console.error('Failed to read local customer cache', e);
  }
  return [];
}

export function setCachedCustomers(
  customers: CustomerItem[],
  options?: { skipCloudPush?: boolean }
): CustomerItem[] {
  const deduped = evaluateCustomerListAutoArchive(
    deduplicateCustomers(customers),
    Date.now()
  );
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
  if (!options?.skipCloudPush) {
    scheduleDebouncedUserCrmCloudPush(() => inMemoryCustomersCache || deduped);
  }
  return deduped;
}

export async function fetchCustomersFromGas(): Promise<{
  customers: CustomerItem[];
  fromCloud: boolean;
}> {
  let baseLocal = getCachedCustomers();
  if (baseLocal.length === 0) {
    const idbData = await idbMirrorGet<CustomerItem[]>(STORAGE_KEY_CACHE);
    if (Array.isArray(idbData) && idbData.length > 0) {
      baseLocal = setCachedCustomers(idbData, { skipCloudPush: true });
    }
  } else {
    idbMirrorSet(STORAGE_KEY_CACHE, baseLocal).catch(() => {});
  }

  await flushPendingOutbox();

  // 본인 코드(관리자 PIN 또는 초대코드) 기준 다중기기 클라우드 자동 병합 동기화
  try {
    const cloudRes = await syncBidirectionalUserCrm(
      () => getCachedCustomers(),
      (merged) => setCachedCustomers(merged, { skipCloudPush: true })
    );
    if (cloudRes.ok) {
      return {
        customers: cloudRes.customers,
        fromCloud: cloudRes.fromCloud,
      };
    }
  } catch {
    // 오프라인 등 네트워크 실패 시 로컬 캐시 즉시 유지
  }

  return { customers: baseLocal, fromCloud: false };
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

    const rawSyncedExisting = nextQuotes.some((q) => q.isConfirmedSlip)
      ? syncCustomerFromConfirmedSlips(rawUpdatedCustomer)
      : rawUpdatedCustomer;
    savedCustomer = stampCustomerCompletionTransitions(
      existing,
      rawSyncedExisting,
      Date.now()
    );

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

    const rawSyncedNew = newQuote.isConfirmedSlip
      ? syncCustomerFromConfirmedSlips(rawNewCustomer)
      : rawNewCustomer;
    savedCustomer = stampCustomerCompletionTransitions(
      null,
      rawSyncedNew,
      Date.now()
    );

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
      // HISIS 판매접수 전산 사진에는 사은품란이 없으므로 전표 등록 시 사은품을 임의 채움/체크하지 않음 (기존 고객 수동 사은품은 보존)
      giftItems: undefined,
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
