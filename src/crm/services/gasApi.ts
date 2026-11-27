import { CustomerFreedCounts, CustomerItem, CustomerSaleType, CustomerStatus, MAX_QUOTES_PER_CUSTOMER, QuoteRecord, SlipDeliveryStatus } from '../types/crm';
import { getTodayStr } from '../utils/date';
import { aggregateSlipUnitsToProfile, buildConfirmedSlipUnitProfiles, createEmptyFreedCounts, extractPerformanceFromProposalState, getConfirmedSlipQuotes, parsePurchasedModelsFromItemsText, sanitizeFreedCounts } from '../utils/settlementEngine';
import { calculateGeneralPurchaseSummary, calculateSubscriptionSummary, getGeneralPlan1And2Summaries, ProposalState } from '../../types/proposal';
import { evaluateCustomerAutoArchive, evaluateCustomerListAutoArchive, stampCustomerCompletionTransitions } from '../utils/autoArchiveEngine';
export { MAX_QUOTES_PER_CUSTOMER };
const FREED_COUNT_KEYS: (keyof CustomerFreedCounts)[] = ['hi72', 'hi90', 'hi108', 'hf75', 'hf150', 'hf225', 'hf300'];
function sumIntrinsicConfirmedSlipFreedCounts(quotes: QuoteRecord[]): CustomerFreedCounts {
 const out = createEmptyFreedCounts();
 for (const q of quotes) {
  if (!q || !q.isConfirmedSlip) continue;
  const raw = q.freedCounts || extractPerformanceFromProposalState(q.proposalState)?.freedCounts;
  const clean = sanitizeFreedCounts(raw);
  for (const k of FREED_COUNT_KEYS) out[k] += clean[k];
 }
 return out;
}
export function mergeConfirmedSlipFreedCountsPreservingManualExtra(prevQuotes: QuoteRecord[], nextQuotes: QuoteRecord[], prevCustomerFreed?: CustomerFreedCounts): CustomerFreedCounts | undefined {
 if (!nextQuotes.some((q) => Boolean(q?.isConfirmedSlip))) return prevCustomerFreed;
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
export const CRM_CUSTOMERS_UPDATED_EVENT = 'himart_crm_customers_updated';
export function normalizePhoneKey(phone: string): string { return String(phone || '').replace(/\D/g, ''); }
export function normalizeNameKey(name: string): string { return String(name || '').trim().toLowerCase(); }
export function normalizeOrderNoKey(orderNo?: string): string { return String(orderNo || '').trim().toUpperCase().replace(/\s+/g, ''); }
export function getCustomerIdentityKey(c: CustomerItem): string {
 const nameKey = normalizeNameKey(c.name);
 const phoneKey = normalizePhoneKey(c.phone);
 return nameKey && phoneKey ? `${nameKey}__${phoneKey}` : c.id;
}
export function isDummyInstaZeroQuote(q?: QuoteRecord | null): boolean {
 if (!q) return false;
 const hasRealAmount = (Number(q.paidAmount) || 0) > 0 || (Number(q.netAmount) || 0) > 0 || (Number(q.performanceAmount) || 0) > 0;
 if (hasRealAmount || q.proposalState || q.isConfirmedSlip) return false;
 const title = String(q.title || '').trim();
 const benefit = String(q.benefit || '').trim();
 return title.startsWith('인스타DB') || benefit === '인스타 광고 전용 최대 혜택 안내';
}
export function buildPrimaryFieldsFromQuote(quote: QuoteRecord, fallbackCustomer?: Partial<CustomerItem>): Partial<CustomerItem> {
 const extractedPerf = extractPerformanceFromProposalState(quote.proposalState);
 let resolvedPaid = Math.max(0, Number(quote.paidAmount) || 0);
 let resolvedNet = Math.max(0, Number(quote.netAmount) || 0);
 if ((resolvedNet <= 0 || resolvedPaid <= 0) && quote.proposalState) {
  try {
   const { plan1Data, plan2Data, hasPlan1Data, hasPlan2Data } = getGeneralPlan1And2Summaries(quote.proposalState as ProposalState);
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
  } catch {}
 }
 const saleType: CustomerSaleType = extractedPerf?.saleType || quote.quoteMode || fallbackCustomer?.saleType || 'general';
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
  generalProductTotal: quote.isConfirmedSlip ? quote.generalProductTotal ?? extractedPerf?.generalProductTotal ?? 0 : extractedPerf?.generalProductTotal ?? quote.generalProductTotal ?? 0,
  subscriptionPrincipal: quote.isConfirmedSlip ? quote.subscriptionPrincipal ?? extractedPerf?.subscriptionPrincipal ?? 0 : extractedPerf?.subscriptionPrincipal ?? quote.subscriptionPrincipal ?? 0,
  freedCounts: extractedPerf?.freedCounts ?? quote.freedCounts ?? fallbackCustomer?.freedCounts,
  purchasedModels: extractedPerf?.purchasedModels ?? quote.purchasedModels ?? fallbackCustomer?.purchasedModels,
 };
}
export function syncCustomerFromConfirmedSlips(customer: CustomerItem): CustomerItem {
 const confirmedSlips = getConfirmedSlipQuotes(customer);
 if (confirmedSlips.length === 0) return customer;
 const slipUnits = buildConfirmedSlipUnitProfiles(customer);
 const agg = aggregateSlipUnitsToProfile(customer, slipUnits);
 const genSlips = confirmedSlips.filter((q) => q.quoteMode === 'general' || (q.quoteMode === 'hybrid' && (Number(q.generalProductTotal) || 0) > 0) || (!q.quoteMode && (Number(q.generalProductTotal) || 0) > 0));
 const subSlips = confirmedSlips.filter((q) => q.quoteMode === 'subscription' || (Number(q.subscriptionPrincipal) || 0) > 0);
 const genPaidSum = genSlips.reduce((s, q) => s + Math.max(0, Number(q.paidAmount) || 0), 0);
 const genNetSum = genSlips.reduce((s, q) => s + Math.max(0, Number(q.netAmount) || Number(q.paidAmount) || 0), 0);
 const subMonthlyPaidSum = subSlips.reduce((s, q) => s + Math.max(0, Number(q.paidAmount) || 0), 0);
 const subMonthlyNetSum = subSlips.reduce((s, q) => s + Math.max(0, Number(q.netAmount) || Number(q.paidAmount) || 0), 0);
 let paidAmount = customer.paidAmount;
 let netAmount = customer.netAmount;
 let expectedBenefit = customer.expectedBenefit;
 if (agg.saleType === 'general') {
  paidAmount = genPaidSum;
  netAmount = genNetSum;
  expectedBenefit = confirmedSlips.length >= 2 ? `확정 일반전표 ${confirmedSlips.length}건 통합 (실구매합계 ${genPaidSum.toLocaleString('ko-KR')}원)` : confirmedSlips[0]?.benefit || customer.expectedBenefit;
 } else if (agg.saleType === 'subscription') {
  paidAmount = subMonthlyPaidSum;
  netAmount = subMonthlyNetSum;
  expectedBenefit = confirmedSlips.length >= 2 ? `확정 구독전표 ${confirmedSlips.length}건 통합 (구독원금 ${agg.subscriptionPrincipal.toLocaleString('ko-KR')}원 · 월 ${subMonthlyPaidSum.toLocaleString('ko-KR')}원)` : confirmedSlips[0]?.benefit || customer.expectedBenefit;
 } else {
  paidAmount = genPaidSum > 0 ? genPaidSum : subMonthlyPaidSum;
  netAmount = genNetSum > 0 ? genNetSum : subMonthlyNetSum;
  expectedBenefit = `일반 ${genSlips.length}건(${genPaidSum.toLocaleString('ko-KR')}원) + 구독 ${subSlips.length}건(월 ${subMonthlyPaidSum.toLocaleString('ko-KR')}원 · 원금 ${agg.subscriptionPrincipal.toLocaleString('ko-KR')}원)`;
 }
 const combinedItems = confirmedSlips.map((q) => (q.itemSummary || '').trim()).filter(Boolean).join(' + ') || customer.items;
 const pendingSlips = confirmedSlips.filter((q) => q.deliveryStatus !== '배송완료');
 let nextStatus: CustomerStatus = customer.status;
 let nextLogisticsConfirmed = Boolean(customer.logisticsConfirmed);
 let nextDeliveryDate = customer.deliveryDate || '';
 if (customer.status !== '취소/보류') {
  if (pendingSlips.length > 0) {
   nextStatus = '계약완료';
   nextLogisticsConfirmed = Boolean(customer.logisticsConfirmed);
   const pendingDates = pendingSlips.map((q) => (q.deliveryDate || '').trim()).filter(Boolean).sort();
   nextDeliveryDate = pendingDates[0] || '';
  } else {
   nextStatus = '배송완료';
   nextLogisticsConfirmed = true;
   const doneDates = confirmedSlips.map((q) => (q.deliveryDate || q.contractDate || '').trim()).filter(Boolean).sort();
   nextDeliveryDate = doneDates[doneDates.length - 1] || customer.deliveryDate || '';
  }
 }
 const latestSlip = confirmedSlips[0];
 const latestSlipWithOrder = confirmedSlips.find((s) => Boolean((s.orderNo || '').trim()));
 return {
  ...customer, items: combinedItems, paidAmount, netAmount, expectedBenefit,
  saleType: agg.saleType, performanceAmount: agg.performanceAmount, generalProductTotal: agg.generalProductTotal,
  subscriptionPrincipal: agg.subscriptionPrincipal, freedCounts: agg.freedCounts, purchasedModels: agg.purchasedModels,
  status: nextStatus, logisticsConfirmed: nextLogisticsConfirmed, deliveryDate: nextDeliveryDate,
  contractDate: latestSlip?.contractDate || customer.contractDate || agg.contractDateStr,
  orderNo: latestSlipWithOrder?.orderNo?.trim() || customer.orderNo || '',
 };
}
function isInstaPlaceholderItems(items?: string): boolean {
 const s = String(items || '').trim();
 return !s || s.includes('인스타 광고') || s.includes('오픈점 최대 지원') || s.includes('구매 부담 경감');
}
function deduplicateQuoteRecords(quotes: QuoteRecord[]): QuoteRecord[] {
 const result: QuoteRecord[] = [];
 const seenIds = new Set<string>();
 const seenOrderNos = new Set<string>();
 for (const q of quotes) {
  if (!q || !q.id || isDummyInstaZeroQuote(q) || seenIds.has(q.id)) continue;
  const orderKey = normalizeOrderNoKey(q.orderNo);
  if (orderKey && seenOrderNos.has(orderKey)) continue;
  seenIds.add(q.id);
  if (orderKey) seenOrderNos.add(orderKey);
  result.push(q);
  if (result.length >= MAX_QUOTES_PER_CUSTOMER) break;
 }
 return result;
}
export function healCustomerPrimaryQuoteFields(item: CustomerItem): CustomerItem {
 const rawQuotes = Array.isArray(item.quotes) ? item.quotes : [];
 const cleanedQuotes = deduplicateQuoteRecords(rawQuotes);
 if (cleanedQuotes.some((q) => q.isConfirmedSlip)) return syncCustomerFromConfirmedSlips({ ...item, quotes: cleanedQuotes });
 const primaryValidQuote = cleanedQuotes.find((q) => (Number(q.netAmount) || 0) > 0 || (Number(q.paidAmount) || 0) > 0 || (Number(q.performanceAmount) || 0) > 0 || Boolean(q.proposalState));
 if (!primaryValidQuote) return cleanedQuotes.length !== rawQuotes.length ? { ...item, quotes: cleanedQuotes } : item;
 const needsNetHeal = !(Number(item.netAmount) > 0);
 const needsPaidHeal = !(Number(item.paidAmount) > 0);
 const needsItemsHeal = isInstaPlaceholderItems(item.items);
 const needsBenefitHeal = !item.expectedBenefit || item.expectedBenefit === '인스타 광고 전용 최대 혜택 안내';
 const needsPerfHeal = !(Number(item.performanceAmount) > 0);
 if (!needsNetHeal && !needsPaidHeal && !needsItemsHeal && !needsBenefitHeal && !needsPerfHeal && cleanedQuotes.length === rawQuotes.length) return item;
 const fromQuote = buildPrimaryFieldsFromQuote(primaryValidQuote, item);
 return {
  ...item, quotes: cleanedQuotes,
  items: needsItemsHeal ? fromQuote.items || item.items : item.items,
  paidAmount: needsPaidHeal ? fromQuote.paidAmount ?? item.paidAmount : item.paidAmount,
  netAmount: needsNetHeal ? fromQuote.netAmount ?? item.netAmount : item.netAmount,
  expectedBenefit: needsBenefitHeal ? fromQuote.expectedBenefit ?? item.expectedBenefit : item.expectedBenefit,
  saleType: needsNetHeal || needsPaidHeal || !item.saleType ? fromQuote.saleType || item.saleType : item.saleType,
  performanceAmount: needsPerfHeal ? fromQuote.performanceAmount ?? item.performanceAmount : item.performanceAmount,
  generalProductTotal: !(Number(item.generalProductTotal) > 0) && (fromQuote.generalProductTotal || 0) > 0 ? fromQuote.generalProductTotal : item.generalProductTotal,
  subscriptionPrincipal: !(Number(item.subscriptionPrincipal) > 0) && (fromQuote.subscriptionPrincipal || 0) > 0 ? fromQuote.subscriptionPrincipal : item.subscriptionPrincipal,
  freedCounts: item.freedCounts ?? fromQuote.freedCounts,
  purchasedModels: Array.isArray(item.purchasedModels) && item.purchasedModels.length > 0 ? item.purchasedModels : fromQuote.purchasedModels,
 };
}
export function deleteQuoteAndSyncCustomer(customer: CustomerItem, quoteId: string): CustomerItem {
 const nextQuotes = (customer.quotes || []).filter((q) => q.id !== quoteId && !isDummyInstaZeroQuote(q));
 if (nextQuotes.some((q) => q.isConfirmedSlip)) {
  const reconciledFreed = mergeConfirmedSlipFreedCountsPreservingManualExtra(customer.quotes || [], nextQuotes, customer.freedCounts);
  return syncCustomerFromConfirmedSlips({ ...customer, freedCounts: reconciledFreed, quotes: nextQuotes, updatedAtMs: Date.now() });
 }
 if (nextQuotes.length > 0) {
  const topValid = nextQuotes.find((q) => (Number(q.netAmount) || 0) > 0 || (Number(q.paidAmount) || 0) > 0 || Boolean(q.proposalState)) || nextQuotes[0];
  return { ...customer, ...buildPrimaryFieldsFromQuote(topValid, customer), quotes: nextQuotes, updatedAtMs: Date.now() };
 }
 return { ...customer, quotes: [], updatedAtMs: Date.now() };
}
export function toggleSlipDeliveryStatusAndSyncCustomer(customer: CustomerItem, quoteId: string): CustomerItem {
 const today = getTodayStr();
 let reopenedToPending = false;
 const nextQuotes = (customer.quotes || []).map((q) => {
  if (q.id !== quoteId) return q;
  const nextDelivStatus: SlipDeliveryStatus = q.deliveryStatus === '배송완료' ? '배송대기' : '배송완료';
  if (nextDelivStatus === '배송대기') reopenedToPending = true;
  const nextDelivDate = nextDelivStatus === '배송완료' && !(q.deliveryDate || '').trim() ? q.contractDate || today : q.deliveryDate;
  return { ...q, isConfirmedSlip: true, deliveryStatus: nextDelivStatus, deliveryDate: nextDelivDate };
 });
 const nextLogistics = reopenedToPending && customer.status === '배송완료' ? false : Boolean(customer.logisticsConfirmed);
 const synced = syncCustomerFromConfirmedSlips({ ...customer, logisticsConfirmed: nextLogistics, quotes: nextQuotes, updatedAtMs: Date.now() });
 return stampCustomerCompletionTransitions(customer, synced, Date.now());
}
export interface QuoteSlipInlinePatch {
 orderNo?: string;
 contractDate?: string;
 deliveryDate?: string;
 deliveryStatus?: SlipDeliveryStatus;
 itemSummary?: string;
 promoteToConfirmedSlip?: boolean;
}
export function updateQuoteSlipAndSyncCustomer(customer: CustomerItem, quoteId: string, patch: QuoteSlipInlinePatch): CustomerItem {
 const today = getTodayStr();
 const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
 let editedOrderNo: string | undefined = undefined;
 let wasPrimarySlipEdited = false;
 const prevConfirmedIds = rawQuotes.filter((q) => Boolean(q?.isConfirmedSlip)).map((q) => q.id);
 const nextQuotes = rawQuotes.map((q) => {
  if (q.id !== quoteId) return q;
  const nextIsSlip = Boolean(q.isConfirmedSlip || patch.promoteToConfirmedSlip);
  const nextOrderNo = patch.orderNo !== undefined ? patch.orderNo.trim() : (q.orderNo || '').trim();
  editedOrderNo = nextOrderNo;
  if (prevConfirmedIds.length <= 1 && (prevConfirmedIds[0] === q.id || prevConfirmedIds.length === 0)) wasPrimarySlipEdited = true;
  const nextContractDate = patch.contractDate !== undefined ? patch.contractDate.trim() : q.contractDate || customer.contractDate || today;
  const nextDelivStatus: SlipDeliveryStatus = patch.deliveryStatus || q.deliveryStatus || '배송대기';
  const rawDelivDate = patch.deliveryDate !== undefined ? patch.deliveryDate.trim() : q.deliveryDate || '';
  const nextDeliveryDate = nextDelivStatus === '배송완료' && !rawDelivDate ? nextContractDate || today : rawDelivDate;
  const nextItemSummary = patch.itemSummary !== undefined && patch.itemSummary.trim() ? patch.itemSummary.trim() : q.itemSummary;
  const coreTitle = (q.title || nextItemSummary.slice(0, 18) || '맞춤 견적').replace(/^\[(?:전표[^\]]*|확정전표)\]\s*/, '').trim() || nextItemSummary.slice(0, 18) || '확정전표';
  const nextTitle = nextIsSlip ? (nextOrderNo ? `[전표 ${nextOrderNo}] ${coreTitle}` : `[확정전표] ${coreTitle}`) : q.title;
  let nextPurchasedModels = q.purchasedModels;
  if (patch.itemSummary !== undefined && nextItemSummary !== q.itemSummary && nextItemSummary) {
   const parsedModels = parsePurchasedModelsFromItemsText(nextItemSummary, q.quoteMode === 'subscription' ? 'subscription' : 'general');
   if (parsedModels.length > 0) {
    const prevPrincipal = (q.quoteMode === 'subscription' ? q.subscriptionPrincipal : q.generalProductTotal) || q.performanceAmount || q.paidAmount || 0;
    nextPurchasedModels = parsedModels.map((pm, idx) => ({ ...pm, principalAmount: idx === 0 && parsedModels.length === 1 && prevPrincipal > 0 ? prevPrincipal : pm.principalAmount }));
   }
  }
  return {
   ...q, title: nextTitle, itemSummary: nextItemSummary, orderNo: nextOrderNo, purchasedModels: nextPurchasedModels,
   ...(nextIsSlip ? { isConfirmedSlip: true, contractDate: nextContractDate, deliveryDate: nextDeliveryDate, deliveryStatus: nextDelivStatus } : {}),
  };
 });
 const nextTopOrderNo = wasPrimarySlipEdited && editedOrderNo !== undefined ? editedOrderNo : customer.orderNo;
 if (nextQuotes.some((q) => q.isConfirmedSlip)) {
  const reconciledFreed = mergeConfirmedSlipFreedCountsPreservingManualExtra(rawQuotes, nextQuotes, customer.freedCounts);
  const synced = syncCustomerFromConfirmedSlips({ ...customer, orderNo: nextTopOrderNo, freedCounts: reconciledFreed, quotes: nextQuotes, updatedAtMs: Date.now() });
  return stampCustomerCompletionTransitions(customer, synced, Date.now());
 }
 const topQuote = nextQuotes[0];
 return { ...customer, ...(topQuote ? buildPrimaryFieldsFromQuote(topQuote, customer) : {}), orderNo: editedOrderNo !== undefined ? editedOrderNo : customer.orderNo, quotes: nextQuotes, updatedAtMs: Date.now() };
}
export function confirmDraftQuoteAndCleanOthers(customer: CustomerItem, keepQuoteId: string): CustomerItem {
 const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
 const targetQuote = rawQuotes.find((q) => q.id === keepQuoteId);
 if (!targetQuote || targetQuote.isConfirmedSlip) return customer;
 const nextQuotes = rawQuotes.filter((q) => Boolean(q?.isConfirmedSlip) || q.id === keepQuoteId);
 if (nextQuotes.some((q) => q.isConfirmedSlip)) return syncCustomerFromConfirmedSlips({ ...customer, quotes: nextQuotes, updatedAtMs: Date.now() });
 return { ...customer, ...buildPrimaryFieldsFromQuote(targetQuote, customer), quotes: nextQuotes, updatedAtMs: Date.now() };
}
export function markAllConfirmedSlipsDelivered(customer: CustomerItem): CustomerItem {
 const nowMs = Date.now();
 const today = getTodayStr();
 if (!Array.isArray(customer.quotes) || !customer.quotes.some((q) => Boolean(q?.isConfirmedSlip))) {
  return stampCustomerCompletionTransitions(customer, { ...customer, status: '배송완료', logisticsConfirmed: true, updatedAtMs: nowMs }, nowMs);
 }
 const nextQuotes = customer.quotes.map((q) => q?.isConfirmedSlip ? {
  ...q, deliveryStatus: '배송완료' as const,
  deliveredAtMs: q.deliveryStatus === '배송완료' && q.deliveredAtMs ? q.deliveredAtMs : nowMs,
  deliveryDate: (q.deliveryDate || '').trim() || (q.contractDate || '').trim() || (customer.deliveryDate || '').trim() || today,
 } : q);
 const synced = syncCustomerFromConfirmedSlips({ ...customer, quotes: nextQuotes, status: '배송완료', logisticsConfirmed: true, updatedAtMs: nowMs });
 return stampCustomerCompletionTransitions(customer, synced, nowMs);
}
export function applyCustomerStatusChangeWithSlipSync(customer: CustomerItem, nextStatus: CustomerStatus): CustomerItem {
 const nowMs = Date.now();
 if (nextStatus === '배송완료') return markAllConfirmedSlipsDelivered(customer);
 const hasConfirmed = Array.isArray(customer.quotes) && customer.quotes.some((q) => Boolean(q?.isConfirmedSlip));
 if (!hasConfirmed) return stampCustomerCompletionTransitions(customer, { ...customer, status: nextStatus, updatedAtMs: nowMs }, nowMs);
 if (nextStatus === '취소/보류') return syncCustomerFromConfirmedSlips({ ...customer, status: '취소/보류', updatedAtMs: nowMs });
 const hasPending = (customer.quotes || []).some((q) => q?.isConfirmedSlip && q.deliveryStatus !== '배송완료');
 let reopenedFirst = false;
 const reopenedQuotes = hasPending ? customer.quotes : (customer.quotes || []).map((q) => {
  if (!reopenedFirst && q?.isConfirmedSlip) { reopenedFirst = true; return { ...q, deliveryStatus: '배송대기' as const }; }
  return q;
 });
 const syncedReopen = syncCustomerFromConfirmedSlips({ ...customer, quotes: reopenedQuotes, status: '계약완료', logisticsConfirmed: hasPending ? Boolean(customer.logisticsConfirmed) : false, updatedAtMs: nowMs });
 return stampCustomerCompletionTransitions(customer, syncedReopen, nowMs);
}
export function applyCustomerFieldPatchWithSlipSync(customer: CustomerItem, patch: Partial<CustomerItem>): CustomerItem {
 const nowMs = Date.now();
 const rawQuotes = Array.isArray(customer.quotes) ? customer.quotes : [];
 const confirmedSlips = rawQuotes.filter((q) => Boolean(q?.isConfirmedSlip));
 let nextQuotes = patch.quotes ?? rawQuotes;
 if (!patch.quotes && confirmedSlips.length === 1) {
  const onlySlipId = confirmedSlips[0].id;
  const hasSlipRelevantPatch = patch.orderNo !== undefined || patch.contractDate !== undefined || patch.deliveryDate !== undefined || patch.items !== undefined || patch.saleType !== undefined || patch.performanceAmount !== undefined || patch.generalProductTotal !== undefined || patch.subscriptionPrincipal !== undefined || patch.paidAmount !== undefined || patch.netAmount !== undefined || patch.purchasedModels !== undefined;
  if (hasSlipRelevantPatch) {
   nextQuotes = rawQuotes.map((q) => {
    if (q.id !== onlySlipId) return q;
    const nextItemSummary = patch.items !== undefined && patch.items.trim() ? patch.items.trim() : q.itemSummary;
    const updatedOrderNo = patch.orderNo !== undefined ? patch.orderNo.trim() : (q.orderNo || '').trim();
    const coreTitle = (q.title || nextItemSummary?.slice(0, 18) || '확정전표').replace(/^\[(?:전표[^\]]*|확정전표)\]\s*/, '').trim() || nextItemSummary?.slice(0, 18) || '확정전표';
    const updatedTitle = patch.orderNo !== undefined || patch.items !== undefined
     ? (updatedOrderNo ? `[전표 ${updatedOrderNo}] ${patch.items !== undefined ? nextItemSummary.slice(0, 20) : coreTitle}` : `[확정전표] ${patch.items !== undefined ? nextItemSummary.slice(0, 20) : coreTitle}`)
     : q.title;
    return {
     ...q, title: updatedTitle, orderNo: updatedOrderNo, itemSummary: nextItemSummary,
     ...(patch.saleType !== undefined ? { quoteMode: patch.saleType } : {}),
     ...(patch.performanceAmount !== undefined ? { performanceAmount: patch.performanceAmount } : {}),
     ...(patch.generalProductTotal !== undefined ? { generalProductTotal: patch.generalProductTotal } : {}),
     ...(patch.subscriptionPrincipal !== undefined ? { subscriptionPrincipal: patch.subscriptionPrincipal } : {}),
     ...(patch.paidAmount !== undefined ? { paidAmount: patch.paidAmount } : {}),
     ...(patch.netAmount !== undefined ? { netAmount: patch.netAmount } : {}),
     ...(patch.purchasedModels !== undefined ? { purchasedModels: patch.purchasedModels } : {}),
     contractDate: patch.contractDate !== undefined ? patch.contractDate.trim() : q.contractDate,
     deliveryDate: patch.deliveryDate !== undefined ? patch.deliveryDate.trim() : q.deliveryDate,
    };
   });
  }
 } else if (!patch.quotes && confirmedSlips.length >= 2 && (patch.contractDate !== undefined || patch.deliveryDate !== undefined)) {
  const primarySlipId = confirmedSlips[0].id;
  const pendingSlips = confirmedSlips.filter((s) => s.deliveryStatus !== '배송완료');
  const cleanPatchDeliv = patch.deliveryDate !== undefined ? patch.deliveryDate.trim() : undefined;
  let targetDelivSlipId: string | null = null;
  if (cleanPatchDeliv !== undefined && cleanPatchDeliv !== '') {
   if (pendingSlips.length > 0) {
    const datedPending = [...pendingSlips].filter((s) => Boolean((s.deliveryDate || '').trim())).sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
    targetDelivSlipId = (datedPending[0] || pendingSlips[0]).id;
   } else targetDelivSlipId = confirmedSlips[0].id;
  }
  nextQuotes = rawQuotes.map((q) => {
   if (!q?.isConfirmedSlip) return q;
   let nextContract = q.contractDate;
   let nextDeliv = q.deliveryDate;
   if (patch.contractDate !== undefined && q.id === primarySlipId) nextContract = patch.contractDate.trim();
   if (cleanPatchDeliv !== undefined) {
    if (cleanPatchDeliv === '') {
     if (pendingSlips.length > 0) { if (q.deliveryStatus !== '배송완료') nextDeliv = ''; }
     else if (q.id === primarySlipId) nextDeliv = '';
    } else if (q.id === targetDelivSlipId) nextDeliv = cleanPatchDeliv;
   }
   return nextContract === q.contractDate && nextDeliv === q.deliveryDate ? q : { ...q, contractDate: nextContract, deliveryDate: nextDeliv };
  });
 }
 const candidate: CustomerItem = { ...customer, ...patch, quotes: nextQuotes, updatedAtMs: nowMs };
 const syncedCandidate = nextQuotes.some((q) => q?.isConfirmedSlip) ? syncCustomerFromConfirmedSlips(candidate) : candidate;
 return stampCustomerCompletionTransitions(customer, syncedCandidate, nowMs);
}
export function deduplicateCustomers(list: CustomerItem[]): CustomerItem[] {
 const map = new Map<string, CustomerItem>();
 for (const rawItem of list) {
  if (!rawItem || !rawItem.name) continue;
  const item = healCustomerPrimaryQuoteFields(rawItem);
  const key = getCustomerIdentityKey(item);
  const existing = map.get(key);
  if (!existing) {
   map.set(key, { ...item, quotes: Array.isArray(item.quotes) ? deduplicateQuoteRecords(item.quotes) : [] });
  } else {
   const itemTouch = item.updatedAtMs || item.deletedAt || 0;
   const existTouch = existing.updatedAtMs || existing.deletedAt || 0;
   const isItemNewer = itemTouch !== existTouch ? itemTouch > existTouch : (item.regDate || '') >= (existing.regDate || '');
   const primary = isItemNewer ? item : existing;
   const secondary = isItemNewer ? existing : item;
   const mergedQuotes = deduplicateQuoteRecords([...(primary.quotes || []), ...(secondary.quotes || [])]);
   const pMemo = (primary.memo || '').trim();
   const sMemo = (secondary.memo || '').trim();
   const mergedMemo = !pMemo ? sMemo : (!sMemo || pMemo.includes(sMemo) ? pMemo : (sMemo.includes(pMemo) ? sMemo : `${pMemo}\n${sMemo}`));
   const pGift = (primary.giftItems || '').trim();
   const sGift = (secondary.giftItems || '').trim();
   const mergedGifts = !pGift ? sGift : (!sGift || pGift.includes(sGift) ? pGift : `${pGift}, ${sGift}`);
   const mergedCandidate: CustomerItem = {
    ...secondary, ...primary, id: existing.id || item.id,
    paidAmount: (Number(primary.paidAmount) || 0) > 0 ? primary.paidAmount : secondary.paidAmount,
    netAmount: (Number(primary.netAmount) || 0) > 0 ? primary.netAmount : secondary.netAmount,
    items: !isInstaPlaceholderItems(primary.items) ? primary.items : secondary.items || primary.items,
    expectedBenefit: primary.expectedBenefit && primary.expectedBenefit !== '인스타 광고 전용 최대 혜택 안내' ? primary.expectedBenefit : secondary.expectedBenefit || primary.expectedBenefit,
    contractDate: primary.contractDate !== undefined && primary.contractDate !== '' ? primary.contractDate : secondary.contractDate || undefined,
    deliveryDate: primary.deliveryDate !== undefined ? primary.deliveryDate : secondary.deliveryDate || '',
    saleType: primary.saleType || secondary.saleType || undefined,
    performanceAmount: (Number(primary.performanceAmount) || 0) > 0 ? primary.performanceAmount : secondary.performanceAmount ?? primary.performanceAmount,
    generalProductTotal: primary.generalProductTotal ?? secondary.generalProductTotal,
    subscriptionPrincipal: primary.subscriptionPrincipal ?? secondary.subscriptionPrincipal,
    freedCounts: primary.freedCounts ?? secondary.freedCounts,
    purchasedModels: primary.purchasedModels ?? secondary.purchasedModels,
    orderNo: primary.orderNo ?? secondary.orderNo ?? '',
    giftItems: mergedGifts,
    giftSent: Boolean(primary.giftSent ?? secondary.giftSent),
    giftSentAtMs: primary.giftSentAtMs ?? secondary.giftSentAtMs ?? undefined,
    logisticsConfirmed: Boolean(primary.logisticsConfirmed ?? secondary.logisticsConfirmed),
    followUpDate: primary.followUpDate ?? secondary.followUpDate ?? '',
    memo: mergedMemo,
    quotes: mergedQuotes,
    deliveredCompletedAtMs: primary.deliveredCompletedAtMs ?? secondary.deliveredCompletedAtMs ?? undefined,
    allSettledAtMs: primary.allSettledAtMs ?? secondary.allSettledAtMs ?? undefined,
    autoArchivedAt: primary.autoArchivedAt ?? secondary.autoArchivedAt ?? undefined,
    deletedAt: primary.deletedAt,
    updatedAtMs: Math.max(primary.updatedAtMs || 0, secondary.updatedAtMs || 0) || undefined,
   };
   map.set(key, evaluateCustomerAutoArchive(healCustomerPrimaryQuoteFields(mergedCandidate)));
  }
 }
 return evaluateCustomerListAutoArchive(Array.from(map.values()));
}
export * from './gasApiPersistence';
