import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Plus, 
  Layers, 
  RotateCw, 
  Calculator, 
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { CustomerItem, PipelineStatus, QuoteRecord, ConsultationLog } from './types/crm';
import { 
  fetchCustomersFromGas, 
  saveCachedCustomers, 
  getCachedCustomers,
  getGasApiUrl, 
  calculateDDay,
  deleteCustomerLog,
  updateCustomerGift,
  deleteCustomer
} from './services/gasApi';
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
  // Support opening directly in calculator mode if launched from PWA or previous state
  const [activeTab, setActiveTab] = useState<'crm' | 'calculator'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'calculator' || window.location.hash === '#calculator') {
      return 'calculator';
    }
    const saved = localStorage.getItem('himart_last_active_tab');
    return (saved === 'calculator' || saved === 'crm') ? saved : 'crm';
  });
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<PipelineStatus | '전체'>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'delivery' | 'latest' | 'price'>('delivery');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGasConnected, setIsGasConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modals
  const [detailCustomer, setDetailCustomer] = useState<CustomerItem | null>(null);
  const [smsCustomer, setSmsCustomer] = useState<CustomerItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isQuotePickerOpen, setIsQuotePickerOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  // Initial load
  const loadData = async (showToast = false) => {
    setIsRefreshing(true);
    const result = await fetchCustomersFromGas();
    setCustomers(result.customers);
    setIsGasConnected(result.fromGas);
    setIsRefreshing(false);
    if (showToast && result.message) {
      setStatusMessage(result.message);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  useEffect(() => {
    loadData();
    setIsGasConnected(Boolean(getGasApiUrl()));
  }, []);

  // Sync activeTab with DOM #calculator-container
  useEffect(() => {
    localStorage.setItem('himart_last_active_tab', activeTab);
    const calcContainer = document.getElementById('calculator-container');
    if (calcContainer) {
      if (activeTab === 'calculator') {
        calcContainer.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Trigger initialization of calculator if empty
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
        // CRM 탭으로 돌아왔을 때 항상 최신 캐시 데이터를 동기화
        setCustomers(getCachedCustomers());
      }
    }
  }, [activeTab]);

  // Global bridges so vanilla JS in index.html can interact seamlessly
  useEffect(() => {
    (window as any).switchAppTab = (tab: 'crm' | 'calculator') => {
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (tab === 'crm') {
        setCustomers(getCachedCustomers());
      }
    };
    (window as any).openAppSettings = () => {
      setIsSettingsOpen(true);
    };
    (window as any).openCRMQuotePicker = () => {
      setIsQuotePickerOpen(true);
    };
    (window as any).refreshCRMCustomers = () => {
      setCustomers(getCachedCustomers());
    };

    // Auto-update React state when quote is auto-saved or manual-saved from calculator
    const handleCrmUpdated = () => {
      setCustomers(getCachedCustomers());
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
    setCustomers((prev) => {
      const updated = deleteCustomerLog(customerId, logId);
      return updated;
    });
    setStatusMessage('상담 메모가 삭제되었습니다.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Update promised gift item and delivery completion status
  const handleUpdateGift = (customerId: string, giftItem: string, isGiftDelivered: boolean) => {
    setCustomers((prev) => {
      const updated = updateCustomerGift(customerId, giftItem, isGiftDelivered);
      return updated;
    });
    setStatusMessage(isGiftDelivered ? '🎁 사은품 지급 완료 처리되었습니다.' : '🎁 약속 사은품 정보가 저장되었습니다.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Delete customer card entirely from CRM
  const handleDeleteCustomer = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    const targetName = target ? target.name : '고객';
    deleteCustomer(customerId);
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setStatusMessage(`[${targetName}] 고객 카드가 CRM에서 완전히 삭제되었습니다.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Mark SMS sent (with optional sent text to record in logs)
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
    setStatusMessage('문자 발송이 완료되어 상담진행중 상태 및 시트에 동기화되었습니다.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Load a saved QuoteRecord into the calculator
  const handleLoadQuoteRecord = (quote: QuoteRecord, customer: CustomerItem) => {
    setActiveTab('calculator');
    setTimeout(() => {
      loadQuoteRecordIntoCalculator(quote, customer);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStatusMessage(`[${customer.name}] ${quote.title}을 계산기로 완벽하게 복원했습니다.`);
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
    setStatusMessage(`새 고객 [${newCustomer.name}]님이 파이프라인에 등록되었습니다.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Open quotation calculator with AI-powered intelligent extraction
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

  // Calculate status counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      전체: customers.length,
      '신규/미발송': 0,
      배송대기: 0,
      물류대기: 0,
      '미구매/고민중': 0,
      상담진행중: 0,
      배송완료: 0,
    };
    customers.forEach((c) => {
      if (map[c.status] !== undefined) {
        map[c.status] += 1;
      }
    });
    return map as Record<PipelineStatus | '전체', number>;
  }, [customers]);

  // Filter & Search & Sort
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Tab Filter
        if (filterStatus !== '전체' && c.status !== filterStatus) {
          return false;
        }

        // Search Query
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
          // 신규 미발송 고객은 배송일자 미지정이더라도 CRM 상단에 최우선 노출
          const getWeight = (c: CustomerItem) => {
            if (c.status === '신규/미발송') return -10;
            if (c.dDay === null || c.dDay === undefined) return 99999;
            if (c.dDay < 0) return 90000 + Math.abs(c.dDay); // Past delivery dates
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
        // latest: by ID or date
        return (b.date || b.id).localeCompare(a.date || a.id);
      });
  }, [customers, filterStatus, searchQuery, sortBy]);

  // Calculate urgent items count (today/tomorrow deliveries, new unsent inquiries, logistics wait, undelivered promised gifts)
  const urgentCount = useMemo(() => {
    return customers.filter((c) => 
      (c.dDay !== null && c.dDay >= 0 && c.dDay <= 1) || 
      (c.status === '신규/미발송' || (!c.isSmsSent && c.source === 'tab1')) ||
      (c.status === '물류대기') ||
      (Boolean(c.giftItem) && !c.isGiftDelivered)
    ).length;
  }, [customers]);

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
            setCustomers(getCachedCustomers());
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={() => loadData(true)}
        onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
        onOpenQuotePicker={() => setIsQuotePickerOpen(true)}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        urgentCount={urgentCount}
        isRefreshing={isRefreshing}
        isGasConnected={isGasConnected}
      />

      {/* Header Height Spacer: Ensures content below never gets hidden behind fixed header */}
      <div className="h-14 sm:h-16 w-full flex-shrink-0" aria-hidden="true" />

      {/* Floating Status Notification Toast */}
      {statusMessage && (
        <div className="fixed top-20 sm:top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* CRM Main Content Area (Displayed when activeTab === 'crm') */}
      {activeTab === 'crm' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 pt-3 sm:pt-4 space-y-4 sm:space-y-5">
          {/* Notice Banner: Clearly answers whether sheet URL is set or using mock data */}
          {!isGasConnected ? (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl flex-shrink-0">📢</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded">
                      체험 모드
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-800">
                      현재 [경기광주점 실제 매장 Mock Data]가 표시 중입니다.
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    매장 구글 스프레드시트 배포 Web App URL을 등록하시면 실시간 데이터로 자동 동기화됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <Settings className="w-3.5 h-3.5 text-white" />
                <span>시트 URL 등록</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>구글 스프레드시트 실시간 동기화 상태 활성화됨</span>
                <span className="text-[11px] text-emerald-700 font-normal hidden sm:inline">
                  (온라인 예약접수 tab1 & 매장결제/배송관리 tab2 결합)
                </span>
              </div>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 hover:underline"
              >
                <RotateCw className="w-3 h-3" />
                <span>지금 갱신</span>
              </button>
            </div>
          )}

          {/* 1. 슬림 업무 요약 바 (시각적 부하 최소화) */}
          <div className="bg-slate-900 text-white rounded-2xl px-4 py-2.5 shadow-sm border border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span className="text-xs font-black tracking-tight">오늘의 업무 현황</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold">
              <button 
                type="button" 
                onClick={() => setFilterStatus(filterStatus === '신규/미발송' ? '전체' : '신규/미발송')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === '신규/미발송' ? 'bg-rose-600 text-white' : 'hover:bg-slate-800 text-rose-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>신규</span>
                <strong className="text-white">{counts['신규/미발송'] || 0}</strong>
              </button>
              <span className="text-slate-700">|</span>
              <button 
                type="button" 
                onClick={() => setFilterStatus(filterStatus === '상담진행중' ? '전체' : '상담진행중')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === '상담진행중' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-indigo-400'
                }`}
              >
                <span>상담</span>
                <strong className="text-white">{counts['상담진행중'] || 0}</strong>
              </button>
              <span className="text-slate-700">|</span>
              <button 
                type="button" 
                onClick={() => setFilterStatus(filterStatus === '배송대기' ? '전체' : '배송대기')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === '배송대기' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-blue-400'
                }`}
              >
                <span>배송</span>
                <strong className="text-white">{counts['배송대기'] || 0}</strong>
              </button>
              <span className="text-slate-700">|</span>
              <button 
                type="button" 
                onClick={() => setFilterStatus(filterStatus === '미구매/고민중' ? '전체' : '미구매/고민중')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === '미구매/고민중' ? 'bg-sky-600 text-white' : 'hover:bg-slate-800 text-sky-400'
                }`}
              >
                <span>고민</span>
                <strong className="text-white">{counts['미구매/고민중'] || 0}</strong>
              </button>
            </div>
          </div>

          {/* 2. 통합 검색 및 실제 필터 툴바 */}
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
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shrink-0">
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

            {/* 가로 칩 형태의 상태 필터 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
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
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    filterStatus === st ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {counts[st] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Customer Cards Grid (Rendered with CompactCustomerCard) */}
          {filteredCustomers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCustomers.map((customer) => (
                <CompactCustomerCard
                  key={customer.id}
                  customer={customer}
                  onOpenSMS={(c) => setSmsCustomer(c)}
                  onOpenQuote={handleOpenQuote}
                  onOpenDetail={(c) => setDetailCustomer(c)}
                  onUpdateStatus={handleUpdateStatus}
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
      {/* Customer Full Detail & Management Modal */}
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
          onSaved={() => loadData(true)}
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
