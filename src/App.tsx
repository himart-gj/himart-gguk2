import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Plus, 
  Calculator, 
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { CustomerItem, PipelineStatus, QuoteRecord, ConsultationLog } from './types/crm';
import { 
  saveCachedCustomers, 
  getCachedCustomers,
  deleteCustomerLog,
  updateCustomerGift,
  deleteCustomer,
  normalizePipelineStatus
} from './services/gasApi';
import { 
  sendScheduledSyncNotification, 
  updatePersistentStatusNotification,
  requestNotificationPermission
} from './services/notificationService';
import { CRMHeader } from './components/CRMHeader';
import { CompactCustomerCard } from './components/CompactCustomerCard';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { formatLocalDateTime } from './utils/date';
import { SMSModal } from './components/SMSModal';
import { SettingsModal } from './components/SettingsModal';
import { NewCustomerModal } from './components/NewCustomerModal';
import { CRMQuotePickerModal } from './components/CRMQuotePickerModal';
import { MorningBriefingModal } from './components/MorningBriefingModal';
import { 
  loadCustomerIntoCalculatorWithAI,
  loadQuoteRecordIntoCalculator
} from './services/quotationLoader';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crm' | 'calculator'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'calculator' || window.location.hash === '#calculator') {
      return 'calculator';
    }
    const saved = localStorage.getItem('himart_last_active_tab');
    return (saved === 'calculator' || saved === 'crm') ? saved : 'crm';
  });

  const [customers, setCustomers] = useState<CustomerItem[]>(() => getCachedCustomers());
  const [filterStatus, setFilterStatus] = useState<PipelineStatus | '전체' | '긴급'>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'delivery' | 'latest' | 'price'>('delivery');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modals
  const [detailCustomer, setDetailCustomer] = useState<CustomerItem | null>(null);
  const [smsCustomer, setSmsCustomer] = useState<CustomerItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isQuotePickerOpen, setIsQuotePickerOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  const reloadLocalCustomers = () => {
    setCustomers(getCachedCustomers());
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(() => {});
    }
    reloadLocalCustomers();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        requestNotificationPermission();
      }, 3000);
    }
  }, []);

  // 매일 09시 정시 모닝 브리핑 알림 스케줄러 (로컬 데이터 기반)
  useEffect(() => {
    const checkMorningBriefingTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dateStr = now.toISOString().split('T')[0];

      if (hour === 9 && minute <= 4) {
        const lockKey = `himart_morning_briefing_${dateStr}_9`;
        if (!localStorage.getItem(lockKey)) {
          localStorage.setItem(lockKey, 'done');
          const currentList = getCachedCustomers();
          setCustomers(currentList);
          const newCount = currentList.filter((c) => normalizePipelineStatus(c.status) === '신규/미발송').length;
          const todayDelivery = currentList.filter((c) => c.dDay === 0).length;
          sendScheduledSyncNotification('오전 9시', { newCount, deliveryCount: todayDelivery });
          if (currentList.length > 0) {
            setIsBriefingOpen(true);
          }
        }
      }
    };

    const clockInterval = setInterval(checkMorningBriefingTime, 60 * 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Sync activeTab with DOM #calculator-container
  useEffect(() => {
    localStorage.setItem('himart_last_active_tab', activeTab);
    const calcContainer = document.getElementById('calculator-container');
    if (calcContainer) {
      if (activeTab === 'calculator') {
        calcContainer.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => {
          if (typeof (window as any).initCalculator === 'function') {
            (window as any).initCalculator();
          } else if (typeof (window as any).calc === 'function') {
            (window as any).calc();
          }
        }, 50);
      } else {
        calcContainer.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'instant' });
        reloadLocalCustomers();
      }
    }
  }, [activeTab]);

  // Global bridges for vanilla JS in index.html
  useEffect(() => {
    (window as any).switchAppTab = (tab: 'crm' | 'calculator') => {
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (tab === 'crm') {
        reloadLocalCustomers();
      }
    };
    (window as any).openAppSettings = () => {
      setIsSettingsOpen(true);
    };
    (window as any).openCRMQuotePicker = () => {
      setIsQuotePickerOpen(true);
    };
    (window as any).refreshCRMCustomers = () => {
      reloadLocalCustomers();
    };

    const handleCrmUpdated = () => {
      reloadLocalCustomers();
    };
    window.addEventListener('crm-customer-updated', handleCrmUpdated);
    return () => {
      window.removeEventListener('crm-customer-updated', handleCrmUpdated);
    };
  }, []);

  // Update status handler
  const handleUpdateStatus = (id: string, newStatus: PipelineStatus) => {
    setCustomers((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: newStatus,
            rawStatus: newStatus,
            isSmsSent: newStatus === '신규/미발송' ? false : c.isSmsSent,
          };
        }
        return c;
      });
      saveCachedCustomers(updated);
      return updated;
    });
  };

  // Update note handler
  const handleUpdateNote = (id: string, newNote: string) => {
    setCustomers((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, note: newNote } : c));
      saveCachedCustomers(updated);
      return updated;
    });
  };

  // Add consultation / special note log handler
  const handleAddLog = (id: string, log: ConsultationLog) => {
    setCustomers((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            logs: [log, ...(c.logs || [])],
          };
        }
        return c;
      });
      saveCachedCustomers(updated);
      return updated;
    });
    setStatusMessage('새 상담 메모가 타임라인에 기록되었습니다.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Delete quote from customer history
  const handleDeleteQuote = (customerId: string, quoteId: string) => {
    setCustomers((prev) => {
      const updated = prev.map((c) => {
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
    });
    setStatusMessage('선택한 견적이 삭제되었습니다.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Delete consultation log / note
  const handleDeleteLog = (customerId: string, logId: string) => {
    setCustomers(() => {
      return deleteCustomerLog(customerId, logId);
    });
    setStatusMessage('상담 메모가 삭제되었습니다.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Update promised gift item and delivery completion status
  const handleUpdateGift = (customerId: string, giftItem: string, isGiftDelivered: boolean) => {
    setCustomers(() => {
      return updateCustomerGift(customerId, giftItem, isGiftDelivered);
    });
    setStatusMessage(isGiftDelivered ? '🎁 사은품 지급 완료 처리되었습니다.' : '🎁 약속 사은품 정보가 저장되었습니다.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // One-touch toggle gift delivery from CompactCustomerCard badge
  const handleToggleGiftBadge = (customer: CustomerItem) => {
    if (!customer.giftItem) return;
    const nextDelivered = !customer.isGiftDelivered;
    handleUpdateGift(customer.id, customer.giftItem, nextDelivered);
  };

  // Delete customer card (moves to 30-day trash)
  const handleDeleteCustomer = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    const targetName = target ? target.name : '고객';
    deleteCustomer(customerId);
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setStatusMessage(`[${targetName}] 고객 카드가 휴지통으로 이동되었습니다.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Mark SMS sent
  const handleMarkSmsSent = (id: string, sentText?: string) => {
    const timeStr = formatLocalDateTime(new Date());
    setCustomers((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === '신규/미발송' ? '상담진행중' : c.status;
          const newLog: ConsultationLog = {
            id: 'log-' + Date.now(),
            date: timeStr,
            type: '문자발송',
            content: sentText ? `[문자발송] ${sentText.slice(0, 70)}...` : '고객 안내 문자 발송 완료',
            author: '담당자',
          };
          return {
            ...c,
            isSmsSent: true,
            smsSentDate: timeStr,
            status: nextStatus,
            rawStatus: `발송 완료 (${timeStr})`,
            logs: [newLog, ...(c.logs || [])],
          };
        }
        return c;
      });
      saveCachedCustomers(updated);
      return updated;
    });
    setStatusMessage('✅ 문자 발송 완료 및 상담진행중 상태로 변경되었습니다.');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Load a saved QuoteRecord into the calculator
  const handleLoadQuoteRecord = (quote: QuoteRecord, customer: CustomerItem) => {
    setActiveTab('calculator');
    setTimeout(() => {
      loadQuoteRecordIntoCalculator(quote, customer);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStatusMessage(`[${customer.name}] ${quote.title}을 계산기로 복원했습니다.`);
      setTimeout(() => setStatusMessage(null), 3500);
    }, 100);
  };

  // Add new customer
  const handleAddCustomer = (newCustomer: CustomerItem) => {
    setCustomers((prev) => {
      const updated = [newCustomer, ...prev];
      saveCachedCustomers(updated);
      return updated;
    });
    setStatusMessage(`새 고객 [${newCustomer.name}]님이 등록되었습니다.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Open quotation calculator with Stage 1 (local) + Stage 2 (AI gemini-3.8-flash)
  const handleOpenQuote = (customer: CustomerItem) => {
    setActiveTab('calculator');

    setTimeout(() => {
      loadCustomerIntoCalculatorWithAI(customer, (message, isAiSuccess) => {
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(null), isAiSuccess ? 5000 : 3500);
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // Check if a customer belongs to "🔥 오늘 할 일 (긴급)"
  const isUrgentCustomer = (c: CustomerItem): boolean => {
    const st = normalizePipelineStatus(c.status);
    return (
      (c.dDay !== null && c.dDay !== undefined && c.dDay >= 0 && c.dDay <= 1) ||
      st === '신규/미발송' ||
      st === '물류대기' ||
      (Boolean(c.giftItem) && !c.isGiftDelivered)
    );
  };

  // Calculate urgent items count
  const urgentCount = useMemo(() => {
    return customers.filter(isUrgentCustomer).length;
  }, [customers]);

  // Calculate status counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      긴급: urgentCount,
      전체: customers.length,
      '신규/미발송': 0,
      배송대기: 0,
      물류대기: 0,
      '미구매/고민중': 0,
      상담진행중: 0,
      배송완료: 0,
    };
    customers.forEach((c) => {
      const st = normalizePipelineStatus(c.status);
      if (map[st] !== undefined) {
        map[st] += 1;
      } else {
        map['신규/미발송'] += 1;
      }
    });
    return map as Record<PipelineStatus | '전체' | '긴급', number>;
  }, [customers, urgentCount]);

  // Filter & Search & Sort
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        if (filterStatus === '긴급') {
          if (!isUrgentCustomer(c)) return false;
        } else if (filterStatus !== '전체') {
          const st = normalizePipelineStatus(c.status);
          if (st !== filterStatus) {
            return false;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
          const matchName = (c.name || '').toLowerCase().includes(q);
          const matchPhone = cleanPhone.includes(q) || (c.phone || '').includes(q);
          const matchSlip = (c.slipNo || '').toLowerCase().includes(q);
          const matchItems = (c.items || '').toLowerCase().includes(q);
          const matchCategory = (c.category || '').toLowerCase().includes(q);
          const matchNote = (c.note || '').toLowerCase().includes(q);

          if (!matchName && !matchPhone && !matchSlip && !matchItems && !matchCategory && !matchNote) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'delivery') {
          const getWeight = (c: CustomerItem) => {
            const st = normalizePipelineStatus(c.status);
            if (st === '신규/미발송') return -10;
            if (c.dDay === null || c.dDay === undefined) return 99999;
            if (c.dDay < 0) return 90000 + Math.abs(c.dDay);
            return c.dDay;
          };
          const diff = getWeight(a) - getWeight(b);
          if (diff !== 0) return diff;
          return (b.date || b.id).localeCompare(a.date || a.id);
        }
        if (sortBy === 'price') {
          const priceA = a.paidAmount || 0;
          const priceB = b.paidAmount || 0;
          return priceB - priceA;
        }
        return (b.date || b.id).localeCompare(a.date || a.id);
      });
  }, [customers, filterStatus, searchQuery, sortBy]);

  // Update persistent notification on Android notification bar
  useEffect(() => {
    if (customers.length > 0) {
      const todayDeliveries = customers.filter((c) => c.dDay === 0).length;
      const newLeads = counts['신규/미발송'] || 0;
      const undeliveredGifts = customers.filter((c) => Boolean(c.giftItem) && !c.isGiftDelivered).length;
      updatePersistentStatusNotification({
        newLeadCount: newLeads,
        todayDeliveryCount: todayDeliveries,
        giftCount: undeliveredGifts,
      });
    }
  }, [customers, counts]);

  // Automatically trigger morning briefing popup on first open of the day if urgent items exist
  useEffect(() => {
    if (customers.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const dismissed = localStorage.getItem('himart_briefing_dismissed_date');
      if (dismissed !== todayStr && urgentCount > 0) {
        setIsBriefingOpen(true);
      }
    }
  }, [customers.length, urgentCount]);

  return (
    <div className={`${activeTab === 'crm' ? 'min-h-screen bg-slate-100 pb-12' : 'bg-transparent'} text-slate-800 font-sans flex flex-col`}>
      {/* Universal Top Header */}
      <CRMHeader
        currentTab={activeTab}
        onSwitchTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'crm') {
            reloadLocalCustomers();
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
        onOpenQuotePicker={() => setIsQuotePickerOpen(true)}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        urgentCount={urgentCount}
      />

      {/* Header Height Spacer */}
      <div className="h-14 sm:h-16 w-full flex-shrink-0" aria-hidden="true" />

      {/* Floating Status Notification Toast */}
      {statusMessage && (
        <div className="fixed top-20 sm:top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* CRM Main Content Area */}
      {activeTab === 'crm' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-5 md:p-6 pt-3 sm:pt-4 space-y-3.5 sm:space-y-4">
          {/* 통합 검색 및 필터 툴바 */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="고객명, 연락처, 전표, 품목 검색..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="delivery">배송 임박순</option>
                  <option value="latest">최신 등록순</option>
                  <option value="price">결제 금액순</option>
                </select>
              </div>
            </div>

            {/* 가로 칩 형태의 상태 필터 (맨 앞에 🔥 오늘 할 일 (긴급) 배치) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === '긴급' ? '전체' : '긴급')}
                className={`px-3 py-1.5 rounded-xl font-black transition shrink-0 cursor-pointer flex items-center gap-1 border ${
                  filterStatus === '긴급'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>🔥 오늘 할 일 (긴급)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black tabular-nums ${
                  filterStatus === '긴급' ? 'bg-white text-rose-600' : 'bg-rose-600 text-white'
                }`}>
                  {urgentCount}
                </span>
              </button>

              {(['전체', '신규/미발송', '상담진행중', '미구매/고민중', '물류대기', '배송대기', '배송완료'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-1 border ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{st}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black tabular-nums ${
                    filterStatus === st ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {counts[st] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Customer Cards Grid or Clean Empty State */}
          {customers.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/90 shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                <UserPlus className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  등록된 고객 카드가 없습니다
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  첫 신규 고객을 등록하시거나, 견적 계산기에서 견적을 작성하고 <strong>[💾 CRM 저장]</strong>을 누르면 이곳에 자동으로 추가됩니다.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerOpen(true)}
                  className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black shadow-md shadow-rose-900/15 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ 첫 신규 고객 등록하기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('calculator')}
                  className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Calculator className="w-4 h-4 text-indigo-300" />
                  <span>🧮 견적 계산기 바로 열기</span>
                </button>
              </div>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCustomers.map((customer) => (
                <CompactCustomerCard
                  key={customer.id}
                  customer={customer}
                  onOpenSMS={(c) => setSmsCustomer(c)}
                  onOpenQuote={handleOpenQuote}
                  onOpenDetail={(c) => setDetailCustomer(c)}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleGift={handleToggleGiftBadge}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                해당 조건의 고객 데이터가 없습니다.
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                검색어를 초기화하시거나 다른 상태 조건을 선택해 보세요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('전체');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                전체보기로 초기화
              </button>
            </div>
          )}
        </main>
      )}

      {/* Modals */}
      <CustomerDetailModal
        customer={detailCustomer ? (customers.find((c) => c.id === detailCustomer.id) || detailCustomer) : null}
        isOpen={Boolean(detailCustomer)}
        onClose={() => setDetailCustomer(null)}
        onOpenSMS={(c) => setSmsCustomer(c)}
        onOpenQuote={handleOpenQuote}
        onLoadQuoteRecord={handleLoadQuoteRecord}
        onUpdateStatus={handleUpdateStatus}
        onUpdateNote={handleUpdateNote}
        onAddLog={handleAddLog}
        onDeleteLog={handleDeleteLog}
        onDeleteQuote={handleDeleteQuote}
        onUpdateGift={handleUpdateGift}
        onDeleteCustomer={handleDeleteCustomer}
      />

      {isBriefingOpen && (
        <MorningBriefingModal
          isOpen={isBriefingOpen}
          onClose={() => setIsBriefingOpen(false)}
          customers={customers}
          onOpenSMS={(c) => setSmsCustomer(c)}
          onSelectCustomer={handleOpenQuote}
          onFilterByStatus={(st) => setFilterStatus(st)}
          onUpdateGift={handleUpdateGift}
        />
      )}

      {smsCustomer && (
        <SMSModal
          customer={smsCustomer}
          onClose={() => setSmsCustomer(null)}
          onMarkSent={handleMarkSmsSent}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSaved={() => reloadLocalCustomers()}
        />
      )}

      {isNewCustomerOpen && (
        <NewCustomerModal
          isOpen={isNewCustomerOpen}
          onClose={() => setIsNewCustomerOpen(false)}
          onAdd={handleAddCustomer}
        />
      )}

      {isQuotePickerOpen && (
        <CRMQuotePickerModal
          isOpen={isQuotePickerOpen}
          onClose={() => setIsQuotePickerOpen(false)}
          customers={customers}
          onSelectCustomer={handleOpenQuote}
        />
      )}
    </div>
  );
};
