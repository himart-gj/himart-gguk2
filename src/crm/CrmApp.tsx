import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CrmPrimaryTab, CustomerItem, CustomerStatus, FilterTab, QuoteRecord, SettlementTabId, SortOrder } from './types/crm';
import { applyCustomerFieldPatchWithSlipSync, applyCustomerStatusChangeWithSlipSync, confirmDraftQuoteAndCleanOthers, CRM_CUSTOMERS_UPDATED_EVENT, deleteQuoteAndSyncCustomer, fetchCustomersFromGas, getCachedCustomers, getCustomerIdentityKey, markAllConfirmedSlipsDelivered, QuoteSlipInlinePatch, setCachedCustomers, syncCustomerToGas, toggleSlipDeliveryStatusAndSyncCustomer, updateQuoteSlipAndSyncCustomer } from './services/gasApi';
import { getBriefingSummary, triggerDailyMorningNotification } from './services/notificationService';
import { getDeliveryDDay, getPastDueDeliveryCustomers, hasUnpaidGift, isPendingLogisticsCustomer, isUrgentCustomer } from './utils/date';
import { computeMonthlySettlementReport, extractPerformanceFromProposalState, getCurrentYearMonth, resolveCustomerPerformanceProfile } from './utils/settlementEngine';
import { syncMarketingDbTrashFromCrmCustomer } from '../utils/marketingDbEngine';
import { isCustomerVisibleInActiveCrm } from './utils/autoArchiveEngine';
import { getCloudCrmIdentityStatus, linkOwnerCodeAndSyncCrmNow, USER_CRM_CLOUD_SYNCED_EVENT } from './services/userCrmCloudSync';
import { SlipBatchSavedSummary } from './components/SlipBatchUploadModal';
import { CrmMainBodyView } from './components/CrmMainBodyView';
export const PRIMARY_CRM_TABS: CrmPrimaryTab[] = ['전체', '🔥 할일·긴급', '💬 상담중', '🚚 배송', '✅ 배송완료'];
const BRIEFING_SHOWN_SESSION_KEY = 'gookji_crm_briefing_shown_session';
export const PAST_DELIVERY_POPUP_DISMISSED_KEY = 'himart_past_delivery_popup_dismissed_session';
export type CrmViewMode = 'grid' | 'kanban' | 'calendar';
export type ConsultingSubFilter = 'all' | '신규/미발송' | '상담진행중' | '미구매/고민중';
export type UrgentSubFilter = 'all' | 'gifts';
const CRM_LAST_ACTIVE_TAB_KEY = 'himart_crm_last_tab_v2';
export type CrmQuickFilterShortcut = 'urgent' | 'delivery' | 'gifts' | FilterTab;
function mapFilterShortcutToPrimaryState(raw?: CrmQuickFilterShortcut): { primary: CrmPrimaryTab; consultSub?: ConsultingSubFilter; urgentSub?: UrgentSubFilter } | null {
 if (!raw) return null;
 if (raw === '전체') return { primary: '전체' };
 if (raw === 'urgent' || raw === '🔥긴급/오늘할일' || raw === '🔥 할일·긴급') return { primary: '🔥 할일·긴급', urgentSub: 'all' };
 if (raw === 'gifts' || raw === '🎁사은품미지급') return { primary: '🔥 할일·긴급', urgentSub: 'gifts' };
 if (raw === 'delivery' || raw === '🚚물류/배송대기' || raw === '🚚 배송' || raw === '계약완료' || raw === '발송완료') return { primary: '🚚 배송' };
 if (raw === '💬 상담중') return { primary: '💬 상담중', consultSub: 'all' };
 if (raw === '신규/미발송' || raw === '상담진행중' || raw === '미구매/고민중') return { primary: '💬 상담중', consultSub: raw };
 if (raw === '배송완료' || raw === '✅ 배송완료') return { primary: '✅ 배송완료' };
 if (raw === '취소/보류') return { primary: '취소/보류' };
 return null;
}
interface CrmAppProps {
 onBackToHome: () => void;
 backLabel?: string;
 onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
 onOpenQuoteRecordInQuoteBuilder: (customer: CustomerItem, quote: QuoteRecord) => void;
 onCustomersChange?: (customers: CustomerItem[]) => void;
 initialSettlementTab?: SettlementTabId;
 initialFilterTab?: CrmQuickFilterShortcut;
 initialSelectedCustomerId?: string | null;
}
export const CrmApp: React.FC<CrmAppProps> = ({ onBackToHome, backLabel, onOpenCustomerInQuoteBuilder, onOpenQuoteRecordInQuoteBuilder, onCustomersChange, initialSettlementTab, initialFilterTab, initialSelectedCustomerId }) => {
 const [isDark, setIsDark] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') === 'dark' : false);
 useEffect(() => {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  const sync = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
  sync();
  const obs = new MutationObserver(sync);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
 }, []);
 const [customers, setCustomers] = useState<CustomerItem[]>(() => getCachedCustomers());
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => getCurrentYearMonth());
 const [settlementTab, setSettlementTab] = useState<SettlementTabId>(initialSettlementTab || 'sales');
 useEffect(() => { if (initialSettlementTab) setSettlementTab(initialSettlementTab); }, [initialSettlementTab]);
 const [viewMode, setViewMode] = useState<CrmViewMode>('grid');
 const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
 const [searchQuery, setSearchQuery] = useState<string>('');
 const [consultSubFilter, setConsultSubFilter] = useState<ConsultingSubFilter>(() => mapFilterShortcutToPrimaryState(initialFilterTab)?.consultSub || 'all');
 const [urgentSubFilter, setUrgentSubFilter] = useState<UrgentSubFilter>(() => mapFilterShortcutToPrimaryState(initialFilterTab)?.urgentSub || 'all');
 const [activeTab, setActiveTab] = useState<CrmPrimaryTab>(() => {
  const mappedInitial = mapFilterShortcutToPrimaryState(initialFilterTab);
  if (mappedInitial) return mappedInitial.primary;
  try {
   const saved = sessionStorage.getItem(CRM_LAST_ACTIVE_TAB_KEY) as CrmPrimaryTab | null;
   if (saved && ([...PRIMARY_CRM_TABS, '취소/보류'] as readonly string[]).includes(saved)) return saved;
  } catch {}
  return '전체';
 });
 const applyFilterSelection = useCallback((rawTab: CrmQuickFilterShortcut) => {
  const mapped = mapFilterShortcutToPrimaryState(rawTab);
  if (!mapped) return;
  setViewMode('grid');
  setActiveTab(mapped.primary);
  setConsultSubFilter(mapped.consultSub || 'all');
  setUrgentSubFilter(mapped.urgentSub || 'all');
 }, []);
 useEffect(() => { if (initialFilterTab) applyFilterSelection(initialFilterTab); }, [initialFilterTab, applyFilterSelection]);
 useEffect(() => { try { sessionStorage.setItem(CRM_LAST_ACTIVE_TAB_KEY, activeTab); } catch {} }, [activeTab]);
 const [sortOrder, setSortOrder] = useState<SortOrder>('urgentFirst');
 const [undoHistory, setUndoHistory] = useState<{ label: string; snapshot: CustomerItem[] }[]>([]);
 const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialSelectedCustomerId || null);
 useEffect(() => {
  if (initialSelectedCustomerId) {
   setCustomers(getCachedCustomers());
   setSelectedCustomerId(initialSelectedCustomerId);
  }
 }, [initialSelectedCustomerId]);
 const [smsCustomer, setSmsCustomer] = useState<CustomerItem | null>(null);
 const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
 const [prefillNewCustomer, setPrefillNewCustomer] = useState<Partial<CustomerItem> | null>(null);
 const [isSlipUploadOpen, setIsSlipUploadOpen] = useState<boolean>(false);
 const [slipUploadTargetCustomer, setSlipUploadTargetCustomer] = useState<CustomerItem | null>(null);
 const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
 const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);
 const [isPastDeliveryModalOpen, setIsPastDeliveryModalOpen] = useState<boolean>(false);
 useEffect(() => {
  if (isSlipUploadOpen || smsCustomer !== null || selectedCustomerId !== null || isNewModalOpen || isSettingsOpen || isBriefingOpen || isPastDeliveryModalOpen) {
   try { window.history.pushState({ appGuard: true, tag: 'crm-modal' }, ''); } catch {}
  }
  (window as any).__subViewBackHandler = (): boolean => {
   if (isSlipUploadOpen) { setIsSlipUploadOpen(false); setSlipUploadTargetCustomer(null); return true; }
   if (smsCustomer !== null) { setSmsCustomer(null); return true; }
   if (selectedCustomerId !== null) { setSelectedCustomerId(null); return true; }
   if (isNewModalOpen) { setIsNewModalOpen(false); return true; }
   if (isSettingsOpen) { setIsSettingsOpen(false); return true; }
   if (isPastDeliveryModalOpen) { setIsPastDeliveryModalOpen(false); return true; }
   if (isBriefingOpen) { setIsBriefingOpen(false); return true; }
   if (viewMode !== 'grid') { setViewMode('grid'); return true; }
   return false;
  };
  return () => { delete (window as any).__subViewBackHandler; };
 }, [isSlipUploadOpen, smsCustomer, selectedCustomerId, isNewModalOpen, isSettingsOpen, isBriefingOpen, isPastDeliveryModalOpen, viewMode]);
 const [toastState, setToastState] = useState<{ msg: string; canUndo?: boolean } | null>(null);
 const showToast = useCallback((msg: string, canUndo = false) => {
  setToastState({ msg, canUndo });
  setTimeout(() => setToastState((prev) => (prev?.msg === msg ? null : prev)), 4200);
 }, []);
 const pushUndoSnapshot = useCallback((label: string) => {
  setUndoHistory((prev) => [...prev.slice(-14), { label, snapshot: customers }]);
 }, [customers]);
 const handleUndoLastAction = useCallback(() => {
  if (undoHistory.length === 0) return;
  const last = undoHistory[undoHistory.length - 1];
  setUndoHistory((prev) => prev.slice(0, -1));
  const deduped = setCachedCustomers(last.snapshot);
  setCustomers(deduped);
  showToast(`↩ 실행 취소됨: ${last.label}`, false);
 }, [undoHistory, showToast]);
 useEffect(() => { if (onCustomersChange) onCustomersChange(customers); }, [customers, onCustomersChange]);
 const loadCustomers = useCallback(async () => {
  setIsLoading(true);
  const { customers: loaded } = await fetchCustomersFromGas();
  setCustomers(loaded);
  setIsLoading(false);
  const activeLoaded = loaded.filter((c) => isCustomerVisibleInActiveCrm(c));
  const alreadyShown = sessionStorage.getItem(BRIEFING_SHOWN_SESSION_KEY);
  const summary = getBriefingSummary(activeLoaded);
  if (!alreadyShown && summary.totalActionCount > 0) {
   sessionStorage.setItem(BRIEFING_SHOWN_SESSION_KEY, '1');
   setIsBriefingOpen(true);
   triggerDailyMorningNotification(activeLoaded, false);
  }
 }, []);
 const [cloudIdentity, setCloudIdentity] = useState(() => getCloudCrmIdentityStatus());
 const [quickLinkCode, setQuickLinkCode] = useState('');
 const [isLinkingCode, setIsLinkingCode] = useState(false);
 useEffect(() => {
  loadCustomers();
  const syncLocal = () => {
   setCustomers(getCachedCustomers());
   setCloudIdentity(getCloudCrmIdentityStatus());
  };
  window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncLocal);
  window.addEventListener(USER_CRM_CLOUD_SYNCED_EVENT, syncLocal);
  window.addEventListener('himart_gj_store_cloud_updated', syncLocal);
  return () => {
   window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, syncLocal);
   window.removeEventListener(USER_CRM_CLOUD_SYNCED_EVENT, syncLocal);
   window.removeEventListener('himart_gj_store_cloud_updated', syncLocal);
  };
 }, [loadCustomers]);
 const handleQuickLinkOwnerCode = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!quickLinkCode.trim() || isLinkingCode) return;
  setIsLinkingCode(true);
  try {
   const res = await linkOwnerCodeAndSyncCrmNow(quickLinkCode, () => getCachedCustomers(), (merged) => setCachedCustomers(merged, { skipCloudPush: true }));
   if (res.ok) {
    setQuickLinkCode('');
    setCustomers(getCachedCustomers());
    setCloudIdentity(getCloudCrmIdentityStatus());
    showToast(`☁️ 다중기기 상담 공유 연결 완료! 내 모든 기기에서 고객 ${res.customerCount}명이 실시간 동기화됩니다.`, false);
   } else showToast(`⚠️ ${res.error || '보안코드를 확인해 주세요.'}`, false);
  } finally { setIsLinkingCode(false); }
 };
 const metricsCustomers = useMemo(() => customers.filter((c) => !c.deletedAt), [customers]);
 const activeCustomers = useMemo(() => customers.filter((c) => isCustomerVisibleInActiveCrm(c)), [customers]);
 const pastDueDeliveryCustomers = useMemo(() => getPastDueDeliveryCustomers(activeCustomers), [activeCustomers]);
 useEffect(() => {
  if (pastDueDeliveryCustomers.length > 0 && sessionStorage.getItem(PAST_DELIVERY_POPUP_DISMISSED_KEY) !== '1') setIsPastDeliveryModalOpen(true);
 }, [pastDueDeliveryCustomers.length]);
 const handleConfirmDelivered = async (customerId: string) => {
  const target = customers.find((c) => c.id === customerId);
  if (!target) return;
  pushUndoSnapshot(`${target.name} 배송완료 처리`);
  const deduped = setCachedCustomers(customers.map((c) => c.id === customerId ? markAllConfirmedSlipsDelivered(c) : c));
  setCustomers(deduped);
  const synced = deduped.find((c) => c.id === customerId);
  showToast(hasUnpaidGift(target) ? `🚚 [${target.name}] 배송완료! (🎁 미지급 사은품이 남아 있어 할일 탭에 표시됩니다)` : `✅ [${target.name}] 배송완료 처리되었습니다.`, true);
  await syncCustomerToGas('update', { id: customerId, status: '배송완료', logisticsConfirmed: true, ...(synced ? { quotes: synced.quotes, deliveryDate: synced.deliveryDate, updatedAtMs: synced.updatedAtMs } : {}) });
 };
 const handleConfirmAllDelivered = async (customerIds: string[]) => {
  if (customerIds.length === 0) return;
  const idSet = new Set(customerIds);
  pushUndoSnapshot(`배송완료 일괄 처리 (${customerIds.length}건)`);
  const deduped = setCachedCustomers(customers.map((c) => idSet.has(c.id) ? markAllConfirmedSlipsDelivered(c) : c));
  setCustomers(deduped);
  setIsPastDeliveryModalOpen(false);
  showToast(`✅ 총 ${customerIds.length}건 배송완료 처리되었습니다.`, true);
  for (const cid of customerIds) {
   const synced = deduped.find((c) => c.id === cid);
   await syncCustomerToGas('update', { id: cid, status: '배송완료', logisticsConfirmed: true, ...(synced ? { quotes: synced.quotes, deliveryDate: synced.deliveryDate, updatedAtMs: synced.updatedAtMs } : {}) });
  }
 };
 const trashedCustomers = useMemo(() => customers.filter((c) => Boolean(c.deletedAt)), [customers]);
 const selectedCustomer = useMemo(() => metricsCustomers.find((c) => c.id === selectedCustomerId) || null, [metricsCustomers, selectedCustomerId]);
 const handleStatusChange = async (id: string, nextStatus: CustomerStatus) => {
  const target = customers.find((c) => c.id === id);
  if (!target || target.status === nextStatus) return;
  const hasConfirmedSlips = Array.isArray(target.quotes) && target.quotes.some((q) => Boolean(q?.isConfirmedSlip));
  if (hasConfirmedSlips && nextStatus !== '계약완료' && nextStatus !== '배송완료' && nextStatus !== '취소/보류') {
   showToast(`ℹ️ [${target.name}] 확정 전표 보유 고객은 [계약완료 / 배송완료 / 취소·보류] 단계로 관리됩니다.`, false);
   return;
  }
  pushUndoSnapshot(`${target.name} 상태 변경`);
  const deduped = setCachedCustomers(customers.map((c) => c.id === id ? applyCustomerStatusChangeWithSlipSync(c, nextStatus) : c));
  setCustomers(deduped);
  const synced = deduped.find((c) => c.id === id);
  showToast(`📌 [${target.name}] 상태 → [${synced?.status || nextStatus}]`, true);
  await syncCustomerToGas('update', { id, status: synced?.status || nextStatus, ...(synced ? { logisticsConfirmed: synced.logisticsConfirmed, deliveryDate: synced.deliveryDate, quotes: synced.quotes, updatedAtMs: synced.updatedAtMs } : {}) });
 };
 const handleToggleSlipDeliveryStatus = async (customerId: string, quoteId: string) => {
  const target = customers.find((c) => c.id === customerId);
  if (!target) return;
  pushUndoSnapshot(`${target.name} 전표 배송상태 변경`);
  const deduped = setCachedCustomers(customers.map((c) => c.id === customerId ? toggleSlipDeliveryStatusAndSyncCustomer(c, quoteId) : c));
  setCustomers(deduped);
  const synced = deduped.find((c) => c.id === customerId);
  if (synced) {
   const targetQuote = synced.quotes?.find((q) => q.id === quoteId);
   showToast(`${targetQuote?.deliveryStatus === '배송완료' ? '✅ 배송완료' : '🚚 배송'} 반영 완료 (고객 대표 상태: ${synced.status === '계약완료' ? '🚚 배송' : synced.status})`, true);
   await syncCustomerToGas('update', { id: customerId, status: synced.status, deliveryDate: synced.deliveryDate, logisticsConfirmed: synced.logisticsConfirmed, quotes: synced.quotes, updatedAtMs: synced.updatedAtMs });
  }
 };
 const handleMemoChange = async (id: string, nextMemo: string) => {
  const nowMs = Date.now();
  const deduped = setCachedCustomers(customers.map((c) => c.id === id ? { ...c, memo: nextMemo, updatedAtMs: nowMs } : c));
  setCustomers(deduped);
  showToast('📝 상담 메모가 저장되었습니다.');
  await syncCustomerToGas('update', { id, memo: nextMemo, updatedAtMs: nowMs });
 };
 const handleFieldChange = async (id: string, patch: Partial<CustomerItem>) => {
  const target = customers.find((c) => c.id === id);
  pushUndoSnapshot(`${target?.name || '고객'} 정보 수정`);
  const nowMs = Date.now();
  const stampedPatch: Partial<CustomerItem> = { ...patch, updatedAtMs: nowMs };
  const deduped = setCachedCustomers(customers.map((c) => c.id === id ? applyCustomerFieldPatchWithSlipSync(c, stampedPatch) : c));
  setCustomers(deduped);
  let syncedTarget = deduped.find((c) => c.id === id);
  if (selectedCustomerId === id && !syncedTarget && target) {
   const mergedKey = getCustomerIdentityKey({ ...target, ...stampedPatch } as CustomerItem);
   const survivor = deduped.find((c) => !c.deletedAt && getCustomerIdentityKey(c) === mergedKey);
   if (survivor) { setSelectedCustomerId(survivor.id); syncedTarget = survivor; }
  }
  if ('logisticsConfirmed' in patch) showToast(`🚚 [${target?.name || '고객'}] ${patch.logisticsConfirmed ? '물류확정 완료' : '배송대기로 변경'}`, true);
  else if ('giftSent' in patch) showToast(`🎁 [${target?.name || '고객'}] ${patch.giftSent ? '사은품 지급완료' : '사은품 미지급으로 변경'}`, true);
  else showToast(`✅ [${target?.name || '고객'}] 정보가 업데이트되었습니다.`, true);
  if (syncedTarget) {
   await syncCustomerToGas('update', { id: syncedTarget.id, ...patch, orderNo: syncedTarget.orderNo, contractDate: syncedTarget.contractDate, deliveryDate: syncedTarget.deliveryDate, status: syncedTarget.status, logisticsConfirmed: syncedTarget.logisticsConfirmed, quotes: syncedTarget.quotes, updatedAtMs: nowMs });
  } else await syncCustomerToGas('update', { id, ...patch });
 };
 const handleUpdateQuoteSlip = async (customerId: string, quoteId: string, patch: QuoteSlipInlinePatch) => {
  const target = customers.find((c) => c.id === customerId);
  if (!target) return;
  pushUndoSnapshot(`${target.name} 전표 정보 수정`);
  const deduped = setCachedCustomers(customers.map((c) => c.id === customerId ? updateQuoteSlipAndSyncCustomer(c, quoteId, patch) : c));
  setCustomers(deduped);
  const synced = deduped.find((c) => c.id === customerId);
  const updatedQuote = synced?.quotes?.find((q) => q.id === quoteId);
  showToast(patch.promoteToConfirmedSlip && !target.quotes?.find((q) => q.id === quoteId)?.isConfirmedSlip ? `🧾 [${target.name}] 상담 견적이 확정 전표${updatedQuote?.orderNo ? `(${updatedQuote.orderNo})` : ''}로 등록·합산되었습니다.` : `✏️ [${target.name}] 전표 정보${updatedQuote?.orderNo ? `(${updatedQuote.orderNo})` : ''}가 수정되었습니다.`, true);
  if (synced) {
   await syncCustomerToGas('update', { id: customerId, quotes: synced.quotes, orderNo: synced.orderNo, contractDate: synced.contractDate, deliveryDate: synced.deliveryDate, status: synced.status, logisticsConfirmed: synced.logisticsConfirmed, items: synced.items, paidAmount: synced.paidAmount, netAmount: synced.netAmount, expectedBenefit: synced.expectedBenefit, saleType: synced.saleType, performanceAmount: synced.performanceAmount, generalProductTotal: synced.generalProductTotal, subscriptionPrincipal: synced.subscriptionPrincipal, freedCounts: synced.freedCounts, purchasedModels: synced.purchasedModels, updatedAtMs: synced.updatedAtMs });
  }
 };
 const handleConfirmDraftQuote = async (customerId: string, quoteId: string) => {
  const target = customers.find((c) => c.id === customerId);
  if (!target) return;
  pushUndoSnapshot(`${target.name} 선택 상담견적 확정`);
  const deduped = setCachedCustomers(customers.map((c) => c.id === customerId ? confirmDraftQuoteAndCleanOthers(c, quoteId) : c));
  setCustomers(deduped);
  const synced = deduped.find((c) => c.id === customerId);
  showToast(`✅ [${target.name}] 선택한 상담 견적으로 확정되었습니다.`, true);
  if (synced) {
   await syncCustomerToGas('update', { id: customerId, quotes: synced.quotes, items: synced.items, paidAmount: synced.paidAmount, netAmount: synced.netAmount, expectedBenefit: synced.expectedBenefit, saleType: synced.saleType, performanceAmount: synced.performanceAmount, generalProductTotal: synced.generalProductTotal, subscriptionPrincipal: synced.subscriptionPrincipal, freedCounts: synced.freedCounts, purchasedModels: synced.purchasedModels, updatedAtMs: synced.updatedAtMs });
  }
 };
 const handleManualSlipSaved = useCallback((savedCustomer: CustomerItem, orderNo?: string) => {
  setCustomers(getCachedCustomers());
  setSelectedCustomerId(savedCustomer.id);
  const slipCount = (savedCustomer.quotes || []).filter((q) => q?.isConfirmedSlip).length;
  showToast(`🧾 [${savedCustomer.name}] 새 전표${orderNo ? `(${orderNo})` : ''} 추가 완료! (총 확정전표 ${slipCount}건 합산)`, false);
 }, [showToast]);
 const handleDeleteQuoteRecord = async (customerId: string, quoteId: string) => {
  pushUndoSnapshot('보관 전표/견적 삭제');
  const deduped = setCachedCustomers(customers.map((c) => c.id === customerId ? deleteQuoteAndSyncCustomer(c, quoteId) : c));
  setCustomers(deduped);
  showToast('🗑️ 선택한 항목이 삭제되었으며 고객 실적·상태가 자동 재합산되었습니다.', true);
  const target = deduped.find((c) => c.id === customerId);
  if (target) {
   await syncCustomerToGas('update', { id: customerId, quotes: target.quotes, items: target.items, paidAmount: target.paidAmount, netAmount: target.netAmount, expectedBenefit: target.expectedBenefit, saleType: target.saleType, performanceAmount: target.performanceAmount, generalProductTotal: target.generalProductTotal, subscriptionPrincipal: target.subscriptionPrincipal, freedCounts: target.freedCounts, purchasedModels: target.purchasedModels, status: target.status, deliveryDate: target.deliveryDate, logisticsConfirmed: target.logisticsConfirmed });
  }
 };
 const handleApplyQuoteAsPrimary = async (customerId: string, quote: QuoteRecord) => {
  pushUndoSnapshot('대표 견적 변경');
  const extractedPerf = extractPerformanceFromProposalState(quote.proposalState);
  const patch: Partial<CustomerItem> = {
   items: quote.itemSummary, paidAmount: quote.paidAmount, netAmount: quote.netAmount, expectedBenefit: quote.benefit,
   saleType: extractedPerf?.saleType || quote.quoteMode || 'general',
   performanceAmount: extractedPerf?.performanceAmount ?? quote.performanceAmount,
   generalProductTotal: extractedPerf?.generalProductTotal ?? quote.generalProductTotal,
   subscriptionPrincipal: extractedPerf?.subscriptionPrincipal ?? quote.subscriptionPrincipal,
   freedCounts: extractedPerf?.freedCounts ?? quote.freedCounts,
   purchasedModels: extractedPerf?.purchasedModels ?? quote.purchasedModels,
  };
  const nowMs = Date.now();
  setCustomers(setCachedCustomers(customers.map((c) => c.id === customerId ? { ...c, ...patch, updatedAtMs: nowMs } : c)));
  showToast(`📌 [${quote.title}] 견적이 대표 견적 및 실적 기준으로 적용되었습니다.`, true);
  await syncCustomerToGas('update', { id: customerId, ...patch });
 };
 const handleDeleteCustomer = async (id: string) => {
  const deletedAt = Date.now();
  const target = customers.find((c) => c.id === id);
  pushUndoSnapshot(`${target?.name || '고객'} 휴지통 이동`);
  setCustomers(setCachedCustomers(customers.map((c) => c.id === id ? { ...c, deletedAt, updatedAtMs: deletedAt } : c)));
  if (target) syncMarketingDbTrashFromCrmCustomer(target, true);
  showToast(`🗑️ [${target?.name || '고객'}]님이 휴지통으로 이동되었습니다.`, true);
  await syncCustomerToGas('update', { id, deletedAt });
 };
 const handleRestoreCustomer = async (id: string) => {
  const target = customers.find((c) => c.id === id);
  const nowMs = Date.now();
  setCustomers(setCachedCustomers(customers.map((c) => c.id === id ? { ...c, deletedAt: undefined, updatedAtMs: nowMs } : c)));
  if (target) syncMarketingDbTrashFromCrmCustomer(target, false);
  showToast(`♻️ [${target?.name || '고객'}]님 데이터가 복원되었습니다!`);
  await syncCustomerToGas('update', { id, deletedAt: undefined });
 };
 const handlePermanentDeleteCustomer = async (id: string) => {
  const target = customers.find((c) => c.id === id);
  setCustomers(setCachedCustomers(customers.filter((c) => c.id !== id)));
  if (target) syncMarketingDbTrashFromCrmCustomer(target, true);
  await syncCustomerToGas('delete', { id });
 };
 const handleEmptyTrash = () => {
  const trashedList = customers.filter((c) => Boolean(c.deletedAt));
  setCustomers(setCachedCustomers(customers.filter((c) => !c.deletedAt)));
  for (const tc of trashedList) syncMarketingDbTrashFromCrmCustomer(tc, true);
  showToast('🗑️ 휴지통을 모두 비웠습니다.');
 };
 const handleAddNewCustomer = async (newCustomer: CustomerItem) => {
  pushUndoSnapshot(`${newCustomer.name} 신규 등록`);
  const stampedNew: CustomerItem = { ...newCustomer, deletedAt: undefined, updatedAtMs: Date.now() };
  const targetIdentity = getCustomerIdentityKey(stampedNew);
  const cleanedExisting = customers.filter((c) => !(c.deletedAt && getCustomerIdentityKey(c) === targetIdentity));
  setCustomers(setCachedCustomers([stampedNew, ...cleanedExisting]));
  syncMarketingDbTrashFromCrmCustomer(stampedNew, false);
  if (searchQuery.trim()) setSearchQuery('');
  if (viewMode === 'grid') applyFilterSelection(stampedNew.status);
  showToast(`✅ [${stampedNew.name}] 고객님이 등록되었습니다.`, true);
  await syncCustomerToGas('create', stampedNew);
 };
 const handleBatchSlipsSaved = useCallback((summary: SlipBatchSavedSummary) => {
  setCustomers(getCachedCustomers());
  if (searchQuery.trim()) setSearchQuery('');
  if (!slipUploadTargetCustomer && viewMode === 'grid') setActiveTab('전체');
  const overwriteNote = summary.overwrittenSlipCount > 0 ? ` (기존 전표 ${summary.overwrittenSlipCount}건 덮어쓰기 반영)` : '';
  showToast(`✅ 총 ${summary.customerCount}명 고객 · ${summary.totalSlipCount}건 전표 및 견적서 등록 완료!${overwriteNote}`, false);
 }, [searchQuery, slipUploadTargetCustomer, viewMode, showToast]);
 const handleImportCustomers = (imported: CustomerItem[]) => setCustomers(setCachedCustomers([...imported, ...customers]));
 const handleMarkSmsSent = async (customerId: string) => {
  const target = customers.find((c) => c.id === customerId);
  if (target && target.status === '신규/미발송') await handleStatusChange(customerId, '상담진행중');
 };
 const kpiStats = useMemo(() => {
  const briefing = getBriefingSummary(activeCustomers);
  const monthlyReport = computeMonthlySettlementReport(metricsCustomers, selectedYearMonth, null, 'contract');
  const pipelineSalesTotal = activeCustomers.filter((c) => c.status === '신규/미발송' || c.status === '상담진행중' || c.status === '미구매/고민중').reduce((acc, cur) => acc + resolveCustomerPerformanceProfile(cur).performanceAmount, 0);
  return {
   totalCount: activeCustomers.filter((c) => c.status !== '취소/보류').length,
   urgentCount: activeCustomers.filter((c) => isUrgentCustomer(c)).length,
   todayTomorrowDeliveryCount: briefing.todayDelivery.length + briefing.tomorrowDelivery.length,
   unconfirmedLogisticsCount: activeCustomers.filter((c) => isPendingLogisticsCustomer(c)).length,
   unpaidGiftCount: activeCustomers.filter((c) => (c.status === '계약완료' || c.status === '배송완료') && hasUnpaidGift(c)).length,
   grossSalesTotal: monthlyReport.grossSalesTotal,
   netDeliverySalesTotal: monthlyReport.netDeliverySalesTotal,
   pipelineSalesTotal,
  };
 }, [activeCustomers, metricsCustomers, selectedYearMonth]);
 const tabCounts = useMemo(() => {
  const consultingAll = activeCustomers.filter((c) => c.status === '신규/미발송' || c.status === '상담진행중' || c.status === '미구매/고민중').length;
  const map: Record<CrmPrimaryTab, number> = {
   전체: activeCustomers.filter((c) => c.status !== '취소/보류').length,
   '🔥 할일·긴급': activeCustomers.filter((c) => isUrgentCustomer(c)).length,
   '💬 상담중': consultingAll,
   '🚚 배송': activeCustomers.filter((c) => c.status === '계약완료' || c.status === '발송완료').length,
   '✅ 배송완료': activeCustomers.filter((c) => c.status === '배송완료').length,
   '취소/보류': activeCustomers.filter((c) => c.status === '취소/보류').length,
  };
  const subConsultCounts: Record<ConsultingSubFilter, number> = {
   all: consultingAll,
   '신규/미발송': activeCustomers.filter((c) => c.status === '신규/미발송').length,
   상담진행중: activeCustomers.filter((c) => c.status === '상담진행중').length,
   '미구매/고민중': activeCustomers.filter((c) => c.status === '미구매/고민중').length,
  };
  return { map, subConsultCounts };
 }, [activeCustomers]);
 const filteredCustomers = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  const qNoHyphen = q.replace(/-/g, '');
  const matchesSearch = (c: CustomerItem) => {
   if (!q) return true;
   const topOrder = (c.orderNo || '').toLowerCase();
   if (c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q) || c.items.toLowerCase().includes(q) || c.memo.toLowerCase().includes(q) || Boolean(topOrder && (topOrder.includes(q) || (qNoHyphen && topOrder.replace(/-/g, '').includes(qNoHyphen)))) || Boolean(c.giftItems && c.giftItems.toLowerCase().includes(q))) return true;
   return (c.quotes || []).some((qt) => {
    const qtOrder = (qt.orderNo || '').toLowerCase();
    return Boolean(qtOrder && (qtOrder.includes(q) || (qNoHyphen && qtOrder.replace(/-/g, '').includes(qNoHyphen)))) || Boolean(qt.itemSummary && qt.itemSummary.toLowerCase().includes(q)) || Boolean(qt.title && qt.title.toLowerCase().includes(q));
   });
  };
  const filtered = activeCustomers.filter((c) => {
   if (q) return matchesSearch(c);
   if (viewMode === 'grid') {
    if (activeTab === '전체') return c.status !== '취소/보류';
    if (activeTab === '🔥 할일·긴급') return urgentSubFilter === 'gifts' ? ((c.status === '계약완료' || c.status === '배송완료') && hasUnpaidGift(c)) : isUrgentCustomer(c);
    if (activeTab === '💬 상담중') return consultSubFilter !== 'all' ? c.status === consultSubFilter : (c.status === '신규/미발송' || c.status === '상담진행중' || c.status === '미구매/고민중');
    if (activeTab === '🚚 배송') return c.status === '계약완료' || c.status === '발송완료';
    if (activeTab === '✅ 배송완료') return c.status === '배송완료';
    if (activeTab === '취소/보류') return c.status === '취소/보류';
   } else if (viewMode === 'kanban') {
    if (c.status === '배송완료' && !hasUnpaidGift(c)) return false;
   }
   return true;
  });
  return [...filtered].sort((a, b) => {
   if (sortOrder === 'urgentFirst') {
    const ua = isUrgentCustomer(a) ? 1 : 0;
    const ub = isUrgentCustomer(b) ? 1 : 0;
    return ua !== ub ? ub - ua : b.regDate.localeCompare(a.regDate);
   }
   if (sortOrder === 'deliveryAsc') {
    const da = getDeliveryDDay(a.deliveryDate).diff;
    const db = getDeliveryDDay(b.deliveryDate).diff;
    return (da === null ? 9999 : da < 0 ? 5000 + Math.abs(da) : da) - (db === null ? 9999 : db < 0 ? 5000 + Math.abs(db) : db);
   }
   if (sortOrder === 'amountDesc') return resolveCustomerPerformanceProfile(b).performanceAmount - resolveCustomerPerformanceProfile(a).performanceAmount;
   return b.regDate.localeCompare(a.regDate);
  });
 }, [activeCustomers, activeTab, consultSubFilter, urgentSubFilter, searchQuery, sortOrder, viewMode]);
 return <CrmMainBodyView ctx={{ PAST_DELIVERY_POPUP_DISMISSED_KEY, activeCustomers, activeTab, applyFilterSelection, backLabel, cloudIdentity, consultSubFilter, filteredCustomers, handleAddNewCustomer, handleApplyQuoteAsPrimary, handleBatchSlipsSaved, handleConfirmAllDelivered, handleConfirmDelivered, handleConfirmDraftQuote, handleDeleteCustomer, handleDeleteQuoteRecord, handleEmptyTrash, handleFieldChange, handleImportCustomers, handleManualSlipSaved, handleMarkSmsSent, handleMemoChange, handlePermanentDeleteCustomer, handleQuickLinkOwnerCode, handleRestoreCustomer, handleStatusChange, handleToggleSlipDeliveryStatus, handleUndoLastAction, handleUpdateQuoteSlip, initialSettlementTab, isBriefingOpen, isDark, isLinkingCode, isLoading, isNewModalOpen, isPastDeliveryModalOpen, isSettingsOpen, isSlipUploadOpen, kpiStats, loadCustomers, metricsCustomers, onBackToHome, onOpenCustomerInQuoteBuilder, onOpenQuoteRecordInQuoteBuilder, pastDueDeliveryCustomers, prefillNewCustomer, quickLinkCode, searchQuery, selectedCustomer, selectedYearMonth, setActiveTab, setConsultSubFilter, setCustomers, setIsBriefingOpen, setIsNewModalOpen, setIsPastDeliveryModalOpen, setIsSettingsOpen, setIsSlipUploadOpen, setPrefillNewCustomer, setQuickLinkCode, setSearchQuery, setSelectedCustomerId, setSelectedYearMonth, setSettlementTab, setShowAnalytics, setSlipUploadTargetCustomer, setSmsCustomer, setSortOrder, setUrgentSubFilter, setViewMode, settlementTab, showAnalytics, showToast, slipUploadTargetCustomer, smsCustomer, sortOrder, tabCounts, toastState, trashedCustomers, undoHistory, urgentSubFilter, viewMode }}/>;
};
