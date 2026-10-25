import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppStep,
  GeneralPlanData,
  ProposalState,
  QuoteMode,
  SUB_CARE_OPTIONS,
  SubscriptionPeriod,
} from './types/proposal';
import { ControlPanel } from './components/ControlPanel';
import { ProposalPreview } from './components/ProposalPreview';
import { PopPrinterApp } from './pop/PopPrinterApp';
import { CrmApp } from './crm/CrmApp';
import { SaveToCrmModal } from './crm/components/SaveToCrmModal';
import { CustomerItem, QuoteRecord } from './crm/types/crm';
import { getCachedCustomers } from './crm/services/gasApi';
import { isUrgentCustomer } from './crm/utils/date';
import { CreditCard, Layers, Printer, RefreshCw, Users } from 'lucide-react';

const createEmptyGeneralPlanData = (
  mode: QuoteMode,
  planNum: 1 | 2
): GeneralPlanData => ({
  generalItems: [
    {
      id: `gen-${mode}-p${planNum}-1`,
      category: '',
      modelName: '',
      quantity: 1,
      unitPrice: 0,
    },
  ],
  generalCardType: '미정',
  instantDiscount: 0,
  earnedPoints: 0,
  pointUsed: 0,
  autoTierCashback: true,
  manualTierCashback: 0,
  extraCashback: 0,
  extraBenefits: [],
  generalHiPreedCounts: {
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  },
});

const createInitialState = (mode: QuoteMode): ProposalState => {
  const plan1 = createEmptyGeneralPlanData(mode, 1);
  const plan2 = createEmptyGeneralPlanData(mode, 2);

  return {
    quoteMode: mode,

    // 일반구매(일시불) 1안 / 2안 상태
    activeGeneralPlan: 1,
    generalPlan1: plan1,
    generalPlan2: plan2,

    ...plan1,

    // 구독구매 상태 - 모든 기본값 공란/0/미선택으로 초기화
    items: [
      {
        id: `sub-${mode}-1`,
        category: '',
        modelName: '',
        monthlyFee: 0,
        careService: SUB_CARE_OPTIONS[0],
      },
    ],
    subscriptionPeriod: 60,
    careService: SUB_CARE_OPTIONS[0],
    warrantyYears: 5,
    allCare: true,
    selectedCardId: 'none',
    selectedCardTierId: '',
    hiPlusCounts: {
      hi72: 0,
      hi90: 0,
      hi108: 0,
    },
  };
};

export function App() {
  const [activeMode, setActiveMode] = useState<QuoteMode>('subscription');
  const [step, setStep] = useState<AppStep>('home');

  // 3개 메뉴 완전 개별 상태 분리
  const [generalState, setGeneralState] = useState<ProposalState>(() =>
    createInitialState('general')
  );
  const [subscriptionState, setSubscriptionState] = useState<ProposalState>(
    () => createInitialState('subscription')
  );
  const [hybridState, setHybridState] = useState<ProposalState>(() =>
    createInitialState('hybrid')
  );

  // CRM 연동 상태: 현재 작업 중인 고객 및 저장 모달
  const [activeCustomer, setActiveCustomer] = useState<{
    id: string;
    name: string;
    phone?: string;
  } | null>(null);
  const [isSaveToCrmOpen, setIsSaveToCrmOpen] = useState(false);
  const [crmCustomers, setCrmCustomers] = useState<CustomerItem[]>(() =>
    getCachedCustomers()
  );

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null as string | null);

  // 메인 홈 화면 진입 시 최신 CRM 캐시 동기화
  useEffect(() => {
    if (step === 'home') {
      setCrmCustomers(getCachedCustomers());
    }
  }, [step]);

  // 메인 홈 화면 5번 버튼 우측 실시간 긴급 배지 카운트 계산
  const urgentCount = useMemo(() => {
    return crmCustomers
      .filter((c) => !c.deletedAt)
      .filter((c) => isUrgentCustomer(c)).length;
  }, [crmCustomers]);

  const currentState =
    activeMode === 'general'
      ? generalState
      : activeMode === 'subscription'
      ? subscriptionState
      : hybridState;

  const setCurrentState: React.Dispatch<React.SetStateAction<ProposalState>> =
    useCallback(
      (updater) => {
        if (activeMode === 'general') {
          setGeneralState(updater);
        } else if (activeMode === 'subscription') {
          setSubscriptionState(updater);
        } else {
          setHybridState(updater);
        }
      },
      [activeMode]
    );

  const handleEnterMode = (mode: QuoteMode) => {
    setActiveMode(mode);
    setParseError(null);
    setStep('input');
  };

  // CRM에서 저장된 ProposalState 스냅샷 또는 고객 기본 정보를 신규 견적기로 복원
  const applyRestoredProposalState = useCallback(
    (
      customer: CustomerItem,
      savedProposalState?: any,
      fallbackItemSummary?: string,
      fallbackPaidAmount?: number,
      fallbackQuoteMode?: QuoteMode
    ) => {
      setActiveCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      });

      if (savedProposalState && typeof savedProposalState === 'object') {
        const targetMode: QuoteMode =
          savedProposalState.quoteMode === 'general' ||
          savedProposalState.quoteMode === 'subscription' ||
          savedProposalState.quoteMode === 'hybrid'
            ? savedProposalState.quoteMode
            : fallbackQuoteMode || 'general';

        const base = createInitialState(targetMode);
        const restored: ProposalState = {
          ...base,
          ...JSON.parse(JSON.stringify(savedProposalState)),
          quoteMode: targetMode,
        };

        if (targetMode === 'general') {
          setGeneralState(restored);
        } else if (targetMode === 'subscription') {
          setSubscriptionState(restored);
        } else {
          setHybridState(restored);
        }
        setActiveMode(targetMode);
        setParseError(null);
        setStep('input');
        return;
      }

      // proposalState 스냅샷이 없는 일반 등록 고객인 경우 첫 품목에 자동 세팅
      const summaryStr = (fallbackItemSummary ?? customer.items ?? '').trim();
      const paidNum = Number(fallbackPaidAmount ?? customer.paidAmount ?? 0) || 0;
      const isSub =
        fallbackQuoteMode === 'subscription' || summaryStr.includes('구독');
      const targetMode: QuoteMode = isSub ? 'subscription' : 'general';

      if (targetMode === 'subscription') {
        const nextSub = createInitialState('subscription');
        nextSub.items = [
          {
            id: `sub-crm-${Date.now()}`,
            category: summaryStr || '맞춤 구독 가전',
            modelName: '',
            monthlyFee: paidNum,
            careService: SUB_CARE_OPTIONS[0],
          },
        ];
        setSubscriptionState(nextSub);
      } else {
        const nextGen = createInitialState('general');
        const firstItem = {
          id: `gen-crm-${Date.now()}`,
          category: summaryStr || '맞춤 가전 패키지',
          modelName: '',
          quantity: 1,
          unitPrice: paidNum,
        };
        nextGen.generalItems = [firstItem];
        nextGen.generalPlan1 = {
          ...nextGen.generalPlan1,
          generalItems: [firstItem],
        };
        setGeneralState(nextGen);
      }

      setActiveMode(targetMode);
      setParseError(null);
      setStep('input');
    },
    []
  );

  const handleOpenCustomerInQuoteBuilder = useCallback(
    (customer: CustomerItem) => {
      const latestQuote = customer.quotes?.[0];
      applyRestoredProposalState(
        customer,
        latestQuote?.proposalState,
        latestQuote?.itemSummary || customer.items,
        latestQuote?.paidAmount || customer.paidAmount,
        latestQuote?.quoteMode
      );
    },
    [applyRestoredProposalState]
  );

  const handleOpenQuoteRecordInQuoteBuilder = useCallback(
    (customer: CustomerItem, quote: QuoteRecord) => {
      applyRestoredProposalState(
        customer,
        quote.proposalState,
        quote.itemSummary,
        quote.paidAmount,
        quote.quoteMode
      );
    },
    [applyRestoredProposalState]
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleParseImage = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParseError(null);

      try {
        const base64 = await fileToBase64(file);
        const response = await fetch('/api/ai/parse-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/png',
          }),
        }),
          json = await response.json();
        if (!response.ok || (!json.success && !json.items)) {
          throw new Error(json.error || '전산 화면 인식에 실패했습니다.');
        }

        const data = json.data || json;
        const extractedItems = Array.isArray(data.items) ? data.items : [];
        const firstItem = extractedItems[0] || {};

        const detectedPeriod: SubscriptionPeriod =
          firstItem.subscriptionPeriod === 36 || firstItem.period === 36
            ? 36
            : 60;

        setCurrentState((prev) => {
          const mappedItems =
            extractedItems.length > 0
              ? extractedItems.map((it: any, idx: number) => ({
                  id: `ai-${Date.now()}-${idx}`,
                  category: it.category || `구독 가전 ${idx + 1}`,
                  modelName: it.modelName || '',
                  monthlyFee:
                    Number(it.monthlyFee) > 0 ? Number(it.monthlyFee) : 0,
                  careService: it.careService || SUB_CARE_OPTIONS[0],
                }))
              : prev.items;

          return {
            ...prev,
            items: mappedItems,
            subscriptionPeriod: detectedPeriod,
            careService: firstItem.careService || prev.careService,
            warrantyYears: 5,
            allCare: true,
          };
        });
      } catch (err: any) {
        setParseError(err?.message || '이미지 분석 중 오류가 발생했습니다.');
      } finally {
        setIsParsing(false);
      }
    },
    [setCurrentState]
  );

  // 전역 클립보드 붙여넣기 (Ctrl+V) - step === 'input'일 때만 동작
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (step !== 'input') return;
      if (activeMode === 'general') return;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleParseImage(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleParseImage, step, activeMode]);

  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex flex-col">
      {/* ==================== STEP 0: 심플 메인 메뉴 선택 화면 ==================== */}
      {step === 'home' && (
        <main className="min-h-[100dvh] w-full flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-3">
            <button
              type="button"
              onClick={() => handleEnterMode('general')}
              className="w-full py-6 px-6 rounded-3xl bg-white hover:bg-blue-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-blue-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 group-hover:bg-white text-white group-hover:text-blue-600 flex items-center justify-center transition">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  1. 일반구매 견적서
                </span>
              </div>
              <span className="text-sm font-extrabold text-slate-400 group-hover:text-white">
                ➔
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleEnterMode('subscription')}
              className="w-full py-6 px-6 rounded-3xl bg-white hover:bg-rose-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-rose-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 group-hover:bg-white text-white group-hover:text-rose-600 flex items-center justify-center transition">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  2. 구독구매 견적서
                </span>
              </div>
              <span className="text-sm font-extrabold text-slate-400 group-hover:text-white">
                ➔
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleEnterMode('hybrid')}
              className="w-full py-6 px-6 rounded-3xl bg-white hover:bg-indigo-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-indigo-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 group-hover:bg-white text-white group-hover:text-indigo-600 flex items-center justify-center transition">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  3. 일반+구독 혼합견적서
                </span>
              </div>
              <span className="text-sm font-extrabold text-slate-400 group-hover:text-white">
                ➔
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep('pop-printer')}
              className="w-full py-6 px-6 rounded-3xl bg-white hover:bg-emerald-600 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-emerald-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 group-hover:bg-white text-white group-hover:text-emerald-600 flex items-center justify-center transition">
                  <Printer className="w-6 h-6" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  4. 구독 POP 자동 출력기
                </span>
              </div>
              <span className="text-sm font-extrabold text-slate-400 group-hover:text-white">
                ➔
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep('crm')}
              className="w-full py-6 px-6 rounded-3xl bg-white hover:bg-amber-500 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-amber-500 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 group-hover:bg-white text-white group-hover:text-amber-500 flex items-center justify-center transition">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  5. 통합 고객관리 시스템
                </span>
              </div>
              <div className="flex items-center gap-2">
                {urgentCount >= 1 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black animate-pulse shadow-xs">
                    🔥 긴급 {urgentCount}건
                  </span>
                )}
                <span className="text-sm font-extrabold text-slate-400 group-hover:text-white">
                  ➔
                </span>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* ==================== STEP 1: 조건 입력 화면 ==================== */}
      {step === 'input' && (
        <ControlPanel
          state={currentState}
          onChange={setCurrentState}
          onParseImage={handleParseImage}
          isParsing={isParsing}
          parseError={parseError}
          onShowProposal={() => setStep('proposal')}
          onBackToHome={() => setStep('home')}
          activeCustomer={activeCustomer}
          onClearActiveCustomer={() => setActiveCustomer(null)}
          onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
        />
      )}

      {/* ==================== STEP 2: 제안서 / 프리드 안내서 미리보기 화면 ==================== */}
      {step === 'proposal' && (
        <ProposalPreview
          state={currentState}
          onChange={setCurrentState}
          onBackToInput={() => setStep('input')}
          activeCustomer={activeCustomer}
          onOpenSaveToCrm={() => setIsSaveToCrmOpen(true)}
        />
      )}

      {/* ==================== STEP 3: 4. 구독 POP 자동 출력기 화면 ==================== */}
      {step === 'pop-printer' && (
        <PopPrinterApp onBackToHome={() => setStep('home')} />
      )}

      {/* ==================== STEP 4: 5. 통합 고객관리 시스템 화면 ==================== */}
      {step === 'crm' && (
        <CrmApp
          onBackToHome={() => setStep('home')}
          onOpenCustomerInQuoteBuilder={handleOpenCustomerInQuoteBuilder}
          onOpenQuoteRecordInQuoteBuilder={handleOpenQuoteRecordInQuoteBuilder}
          onCustomersChange={(list) => setCrmCustomers(list)}
        />
      )}

      {/* ==================== CRM 고객 저장 팝업 모달 ==================== */}
      <SaveToCrmModal
        isOpen={isSaveToCrmOpen}
        onClose={() => setIsSaveToCrmOpen(false)}
        state={currentState}
        activeCustomer={activeCustomer}
        onSavedSuccess={(savedCust) => {
          setActiveCustomer(savedCust);
          setCrmCustomers(getCachedCustomers());
        }}
      />
    </div>
  );
}

export default App;
