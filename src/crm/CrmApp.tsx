import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  FolderOpen,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  CustomerItem,
  CustomerStatus,
  FilterTab,
  QuoteRecord,
  SortOrder,
} from './types/crm';
import {
  fetchCustomersFromGas,
  getCachedCustomers,
  setCachedCustomers,
  syncCustomerToGas,
} from './services/gasApi';
import {
  getBriefingSummary,
  triggerDailyMorningNotification,
} from './services/notificationService';
import { getDeliveryDDay, isUrgentCustomer } from './utils/date';
import { CRMHeader } from './components/CRMHeader';
import { CompactCustomerCard } from './components/CompactCustomerCard';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { SMSModal } from './components/SMSModal';
import { NewCustomerModal } from './components/NewCustomerModal';
import { SettingsModal } from './components/SettingsModal';
import { MorningBriefingModal } from './components/MorningBriefingModal';

const FILTER_TABS: FilterTab[] = [
  '전체',
  '🔥긴급/오늘할일',
  '🚚물류/배송대기',
  '🎁사은품미지급',
  '신규/미발송',
  '상담진행중',
  '미구매/고민중',
  '계약완료',
  '발송완료',
  '취소/보류',
];

const BRIEFING_SHOWN_SESSION_KEY = 'gookji_crm_briefing_shown_session';

interface CrmAppProps {
  onBackToHome: () => void;
  onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
  onOpenQuoteRecordInQuoteBuilder: (
    customer: CustomerItem,
    quote: QuoteRecord
  ) => void;
  onCustomersChange?: (customers: CustomerItem[]) => void;
}

export const CrmApp: React.FC<CrmAppProps> = ({
  onBackToHome,
  onOpenCustomerInQuoteBuilder,
  onOpenQuoteRecordInQuoteBuilder,
  onCustomersChange,
}) => {
  const [customers, setCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FilterTab>('전체');
  const [sortOrder, setSortOrder] = useState<SortOrder>('urgentFirst');

  // 모달 상태
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [smsCustomer, setSmsCustomer] = useState<CustomerItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [prefillNewCustomer, setPrefillNewCustomer] =
    useState<Partial<CustomerItem> | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);

  // 상단 토스트 알림
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // 부모(App.tsx)에 최신 고객 목록 동기화
  useEffect(() => {
    if (onCustomersChange) {
      onCustomersChange(customers);
    }
  }, [customers, onCustomersChange]);

  // 1. 초기 데이터 로드 + 출근 모닝 브리핑 자동 팝업/알림
  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    const { customers: loaded } = await fetchCustomersFromGas();
    setCustomers(loaded);
    setIsLoading(false);

    const activeLoaded = loaded.filter((c) => !c.deletedAt);
    const alreadyShown = sessionStorage.getItem(BRIEFING_SHOWN_SESSION_KEY);
    const summary = getBriefingSummary(activeLoaded);
    if (!alreadyShown && summary.totalActionCount > 0) {
      sessionStorage.setItem(BRIEFING_SHOWN_SESSION_KEY, '1');
      setIsBriefingOpen(true);
      triggerDailyMorningNotification(activeLoaded, false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // 활성 고객(휴지통 제외) 및 휴지통 고객 분리
  const activeCustomers = useMemo(
    () => customers.filter((c) => !c.deletedAt),
    [customers]
  );
  const trashedCustomers = useMemo(
    () => customers.filter((c) => Boolean(c.deletedAt)),
    [customers]
  );

  // 현재 상세 모달에 띄울 고객 객체
  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId) || null,
    [activeCustomers, selectedCustomerId]
  );

  // 2. 고객 상태 변경
  const handleStatusChange = async (
    id: string,
    nextStatus: CustomerStatus
  ) => {
    const updated = customers.map((c) =>
      c.id === id ? { ...c, status: nextStatus } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    await syncCustomerToGas('update', { id, status: nextStatus });
  };

  // 3. 고객 메모 변경
  const handleMemoChange = async (id: string, nextMemo: string) => {
    const updated = customers.map((c) =>
      c.id === id ? { ...c, memo: nextMemo } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    await syncCustomerToGas('update', { id, memo: nextMemo });
  };

  // 4. 물류확정 / 사은품지급 / 전표번호 등 필드 업데이트
  const handleFieldChange = async (
    id: string,
    patch: Partial<CustomerItem>
  ) => {
    const updated = customers.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    await syncCustomerToGas('update', { id, ...patch });
  };

  // 5. 고객별 견적 보관함에서 특정 견적 삭제
  const handleDeleteQuoteRecord = async (
    customerId: string,
    quoteId: string
  ) => {
    const updated = customers.map((c) => {
      if (c.id !== customerId) return c;
      const nextQuotes = (c.quotes || []).filter((q) => q.id !== quoteId);
      return { ...c, quotes: nextQuotes };
    });
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    const target = deduped.find((c) => c.id === customerId);
    if (target) {
      await syncCustomerToGas('update', {
        id: customerId,
        quotes: target.quotes,
      });
    }
  };

  // 6. 보관함의 특정 견적을 대표 견적으로 적용
  const handleApplyQuoteAsPrimary = async (
    customerId: string,
    quote: QuoteRecord
  ) => {
    const updated = customers.map((c) => {
      if (c.id !== customerId) return c;
      return {
        ...c,
        items: quote.itemSummary,
        paidAmount: quote.paidAmount,
        netAmount: quote.netAmount,
        expectedBenefit: quote.benefit,
      };
    });
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(`📌 [${quote.title}] 견적이 대표 견적으로 적용되었습니다.`);
    await syncCustomerToGas('update', {
      id: customerId,
      items: quote.itemSummary,
      paidAmount: quote.paidAmount,
      netAmount: quote.netAmount,
      expectedBenefit: quote.benefit,
    });
  };

  // 7. 고객 삭제 (소프트 삭제: 휴지통으로 이동하여 30일간 보관)
  const handleDeleteCustomer = async (id: string) => {
    const deletedAt = Date.now();
    const target = customers.find((c) => c.id === id);
    const updated = customers.map((c) =>
      c.id === id ? { ...c, deletedAt } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(
      `🗑️ [${
        target?.name || '고객'
      }]님이 휴지통으로 이동되었습니다. (설정 ➔ 휴지통에서 30일 내 복원 가능)`
    );
    await syncCustomerToGas('update', { id, deletedAt });
  };

  // 7-1. 휴지통에서 고객 복원
  const handleRestoreCustomer = async (id: string) => {
    const target = customers.find((c) => c.id === id);
    const updated = customers.map((c) =>
      c.id === id ? { ...c, deletedAt: undefined } : c
    );
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(`♻️ [${target?.name || '고객'}]님 데이터가 복원되었습니다!`);
    await syncCustomerToGas('update', { id, deletedAt: undefined });
  };

  // 7-2. 휴지통에서 영구 삭제
  const handlePermanentDeleteCustomer = async (id: string) => {
    const updated = customers.filter((c) => c.id !== id);
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    await syncCustomerToGas('delete', { id });
  };

  // 7-3. 휴지통 전체 비우기
  const handleEmptyTrash = () => {
    const updated = customers.filter((c) => !c.deletedAt);
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast('🗑️ 휴지통을 모두 비웠습니다.');
  };

  // 8. 신규 고객 등록
  const handleAddNewCustomer = async (newCustomer: CustomerItem) => {
    const updated = [newCustomer, ...customers];
    const deduped = setCachedCustomers(updated);
    setCustomers(deduped);
    showToast(`✅ [${newCustomer.name}] 고객님이 등록되었습니다.`);
    await syncCustomerToGas('create', newCustomer);
  };

  // 9. 백업 파일에서 전체 고객 복원
  const handleImportCustomers = (imported: CustomerItem[]) => {
    const merged = setCachedCustomers([...imported, ...customers]);
    setCustomers(merged);
  };

  // 10. 문자 발송 시 상태 자동 변경 ('신규/미발송' -> '발송완료')
  const handleMarkSmsSent = async (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    if (target && target.status === '신규/미발송') {
      await handleStatusChange(customerId, '발송완료');
    }
  };

  // KPI 통계 계산 (휴지통 제외 활성 고객 기준)
  const kpiStats = useMemo(() => {
    const briefing = getBriefingSummary(activeCustomers);
    const urgentCount = activeCustomers.filter((c) =>
      isUrgentCustomer(c)
    ).length;
    const todayTomorrowDeliveryCount =
      briefing.todayDelivery.length + briefing.tomorrowDelivery.length;
    const unconfirmedLogisticsCount = briefing.unconfirmedLogistics.length;
    const unpaidGiftCount = briefing.unpaidGifts.length;

    const contractedSalesTotal = activeCustomers
      .filter((c) => c.status === '계약완료' || c.status === '발송완료')
      .reduce((acc, cur) => acc + (cur.paidAmount || 0), 0);

    const pipelineSalesTotal = activeCustomers
      .filter(
        (c) =>
          c.status === '신규/미발송' ||
          c.status === '상담진행중' ||
          c.status === '미구매/고민중'
      )
      .reduce((acc, cur) => acc + (cur.paidAmount || 0), 0);

    return {
      totalCount: activeCustomers.length,
      urgentCount,
      todayTomorrowDeliveryCount,
      unconfirmedLogisticsCount,
      unpaidGiftCount,
      contractedSalesTotal,
      pipelineSalesTotal,
    };
  }, [activeCustomers]);

  // 탭별 카운트 (휴지통 제외 활성 고객 기준)
  const tabCounts = useMemo(() => {
    const map: Record<string, number> = {
      전체: activeCustomers.length,
      '🔥긴급/오늘할일': activeCustomers.filter((c) => isUrgentCustomer(c))
        .length,
      '🚚물류/배송대기': activeCustomers.filter((c) => {
        if (c.status === '취소/보류') return false;
        const diff = getDeliveryDDay(c.deliveryDate).diff;
        return diff !== null && diff >= 0 && !c.logisticsConfirmed;
      }).length,
      '🎁사은품미지급': activeCustomers.filter(
        (c) =>
          c.status !== '취소/보류' &&
          Boolean(c.giftItems && c.giftItems.trim()) &&
          !c.giftSent
      ).length,
    };
    FILTER_TABS.forEach((tab) => {
      if (!(tab in map)) {
        map[tab] = activeCustomers.filter((c) => c.status === tab).length;
      }
    });
    return map;
  }, [activeCustomers]);

  // 검색 + 탭 필터 + 정렬된 리스트 (휴지통 제외 활성 고객 기준)
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = activeCustomers.filter((c) => {
      if (activeTab === '🔥긴급/오늘할일') {
        if (!isUrgentCustomer(c)) return false;
      } else if (activeTab === '🚚물류/배송대기') {
        if (c.status === '취소/보류') return false;
        const diff = getDeliveryDDay(c.deliveryDate).diff;
        if (diff === null || diff < 0 || c.logisticsConfirmed) return false;
      } else if (activeTab === '🎁사은품미지급') {
        if (
          c.status === '취소/보류' ||
          !c.giftItems ||
          !c.giftItems.trim() ||
          c.giftSent
        ) {
          return false;
        }
      } else if (activeTab !== '전체') {
        if (c.status !== activeTab) return false;
      }

      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.items.toLowerCase().includes(q) ||
        c.memo.toLowerCase().includes(q) ||
        (c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
        (c.giftItems && c.giftItems.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'urgentFirst') {
        const ua = isUrgentCustomer(a) ? 1 : 0;
        const ub = isUrgentCustomer(b) ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return b.regDate.localeCompare(a.regDate);
      }
      if (sortOrder === 'deliveryAsc') {
        const da = getDeliveryDDay(a.deliveryDate).diff;
        const db = getDeliveryDDay(b.deliveryDate).diff;
        const scoreA = da === null ? 9999 : da < 0 ? 5000 + Math.abs(da) : da;
        const scoreB = db === null ? 9999 : db < 0 ? 5000 + Math.abs(db) : db;
        return scoreA - scoreB;
      }
      if (sortOrder === 'amountDesc') {
        return (b.paidAmount || 0) - (a.paidAmount || 0);
      }
      return b.regDate.localeCompare(a.regDate);
    });
  }, [activeCustomers, activeTab, searchQuery, sortOrder]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 상단 고정 헤더 */}
      <CRMHeader
        totalCount={kpiStats.totalCount}
        urgentCount={kpiStats.urgentCount}
        todayTomorrowDeliveryCount={kpiStats.todayTomorrowDeliveryCount}
        unconfirmedLogisticsCount={kpiStats.unconfirmedLogisticsCount}
        unpaidGiftCount={kpiStats.unpaidGiftCount}
        contractedSalesTotal={kpiStats.contractedSalesTotal}
        pipelineSalesTotal={kpiStats.pipelineSalesTotal}
        isLoading={isLoading}
        onRefresh={loadCustomers}
        onOpenNewModal={() => {
          setPrefillNewCustomer(null);
          setIsNewModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        onQuickFilter={(tab) => setActiveTab(tab)}
        onBackToHome={onBackToHome}
      />

      {/* 상단 토스트 알림 */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-extrabold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* 검색창 + 정렬 + 필터 탭 바 */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* 실시간 검색창 */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고객명, 연락처(뒷자리), 모델명, 전표번호, 사은품 검색..."
                className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 정렬 드롭다운 */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="bg-transparent text-xs font-extrabold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="urgentFirst">🔥 긴급/할일 우선순</option>
                  <option value="deliveryAsc">🚚 배송 임박순 (D-Day)</option>
                  <option value="regDesc">🕒 최근 등록/상담순</option>
                  <option value="amountDesc">💰 결제금액 높은순</option>
                </select>
              </div>
            </div>
          </div>

          {/* 상태별 필터 탭 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {FILTER_TABS.map((tab) => {
              const active = activeTab === tab;
              const isSpecialUrgent = tab === '🔥긴급/오늘할일';
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? isSpecialUrgent
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : isSpecialUrgent
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : isSpecialUrgent
                        ? 'bg-rose-200/70 text-rose-800'
                        : 'bg-white text-slate-600'
                    }`}
                  >
                    {tabCounts[tab] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 안내 배너: 카드를 클릭하면 상세 정보 및 견적 보관함이 열립니다 */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
          <span>
            💡 고객 카드를 클릭하면 상세 메모·전표·사은품 및{' '}
            <strong className="text-indigo-600">다중 견적 보관함(최대 5개)</strong>
            을 확인할 수 있습니다.
          </span>
          <span className="font-bold text-slate-700">
            표시 {filteredCustomers.length}명
          </span>
        </div>

        {/* 컴팩트 고객 카드 그리드 (한눈에 많이 보이는 3~4열) */}
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-700">
              조건에 맞는 고객 내역이 없습니다
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              우측 상단의 [신규 등록] 버튼을 누르거나, 견적서 계산 화면에서 [💾 CRM 고객 저장]을 누르면 이곳에 자동으로 쌓입니다.
            </p>
            {activeTab !== '전체' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('전체');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                전체 고객 보기로 돌아가기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCustomers.map((customer) => (
              <CompactCustomerCard
                key={customer.id}
                customer={customer}
                onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                onOpenSMS={(c, e) => {
                  e.stopPropagation();
                  setSmsCustomer(c);
                }}
                onOpenQuote={(c, e) => {
                  e.stopPropagation();
                  onOpenCustomerInQuoteBuilder(c);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* 고객 상세 카드 & 다중 견적 보관함 팝업 모달 */}
      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomerId(null)}
        onStatusChange={handleStatusChange}
        onMemoChange={handleMemoChange}
        onFieldChange={handleFieldChange}
        onDeleteQuoteRecord={handleDeleteQuoteRecord}
        onApplyQuoteAsPrimary={handleApplyQuoteAsPrimary}
        onLoadQuoteRecord={(customer, quote) => {
          onOpenQuoteRecordInQuoteBuilder(customer, quote);
        }}
        onDelete={handleDeleteCustomer}
        onOpenSMS={(c) => setSmsCustomer(c)}
        onOpenQuote={(c) => onOpenCustomerInQuoteBuilder(c)}
      />

      {/* 원클릭 문자/알림톡 모달 */}
      <SMSModal
        customer={smsCustomer}
        onClose={() => setSmsCustomer(null)}
        onMarkSent={handleMarkSmsSent}
      />

      {/* 신규 고객 등록 모달 */}
      <NewCustomerModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleAddNewCustomer}
        prefillData={prefillNewCustomer}
      />

      {/* 출근 모닝 브리핑 모달 */}
      <MorningBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        customers={activeCustomers}
        onSelectFilter={(tab) => setActiveTab(tab)}
        onOpenSMS={(c) => setSmsCustomer(c)}
        onToggleLogistics={(c) =>
          handleFieldChange(c.id, {
            logisticsConfirmed: !c.logisticsConfirmed,
          })
        }
        onToggleGift={(c) =>
          handleFieldChange(c.id, {
            giftSent: !c.giftSent,
          })
        }
      />

      {/* 데이터 백업 / 알림 / 휴지통 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        customers={activeCustomers}
        trashedCustomers={trashedCustomers}
        onImportCustomers={handleImportCustomers}
        onRestoreCustomer={handleRestoreCustomer}
        onPermanentDeleteCustomer={handlePermanentDeleteCustomer}
        onEmptyTrash={handleEmptyTrash}
      />
    </div>
  );
};
