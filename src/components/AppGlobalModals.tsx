import React, { Suspense, useEffect, useState } from 'react';
import { AppStep } from '../types/proposal';
import { AsCenterModal, CardIssueModal } from './QuickCenterModal';
import { SaveToCrmModal } from '../crm/components/SaveToCrmModal';
import { CardInstallmentModal } from './CardInstallmentModal';
import { ScheduleModal } from './ScheduleModal';
import { AiCommandModal } from './AiCommandModal';
import { CommandOmnibarModal } from './CommandOmnibarModal';
import { PartnerLinksModal } from './PartnerLinksModal';
import { StoreAdminUploadHubModal } from './StoreAdminUploadHubModal';
import { OPEN_STORE_POLICY_MODAL_EVENT, PolicyGuideTab, StorePolicyQuickModal } from './StorePolicyGuideView';
import { getCachedCustomers } from '../crm/services/gasApi';
import { PastDeliveryCheckModal } from '../crm/components/PastDeliveryCheckModal';
import { PAST_DELIVERY_POPUP_DISMISSED_KEY } from '../crm/CrmApp';
import { Smartphone, Lock } from 'lucide-react';
import { FlagshipModalShell } from './ui/FlagshipModalShell';
import { SurfaceCard } from './ui/SurfaceCard';

export interface AppGlobalModalsProps extends Record<string, any> {
  setInitialCrmFilterTab?: (tab: 'urgent' | 'delivery' | 'gifts' | undefined) => void;
}

export const AppGlobalModals: React.FC<AppGlobalModalsProps> = ({
  activeCrmCustomers,
  activeCustomer,
  aiInitialCommand,
  applyRestoredProposalState,
  careDataset,
  currentState,
  handleConfirmAllDeliveredFromHome,
  handleConfirmDeliveredFromHome,
  handleConfirmStealthPin,
  handleEnterMode,
  handleOpenCustomerInQuoteBuilder,
  installmentDataset,
  isAiCommandModalOpen,
  isAsCenterOpen,
  isCardIssueOpen,
  isDark,
  isFriendMode = false,
  isHomePastDeliveryOpen,
  isInstallGuideOpen,
  isInstallmentModalOpen,
  isOmnibarOpen,
  isPartnerLinksOpen,
  isSaveToCrmOpen,
  isScheduleModalOpen,
  isStealthPinOpen,
  isUploadHubOpen,
  navigateToStep,
  pastDueCustomersHome,
  setActiveCustomer,
  setActiveMode,
  setAiInitialCommand,
  setCrmCustomers,
  setGeneralState,
  setHybridState,
  setInitialCrmFilterTab,
  setInitialCrmTab,
  setIsAiCommandModalOpen,
  setIsAsCenterOpen,
  setIsCardIssueOpen,
  setIsHomePastDeliveryOpen,
  setIsInstallGuideOpen,
  setIsInstallmentModalOpen,
  setIsOmnibarOpen,
  setIsPartnerLinksOpen,
  setIsSaveToCrmOpen,
  setIsScheduleModalOpen,
  setIsStealthPinOpen,
  setIsUploadHubOpen,
  setParseError,
  setParseGeneralError,
  setStealthPinError,
  setStealthPinInput,
  setSubscriptionState,
  stealthPinError,
  stealthPinInput,
  step,
  toggleUiTheme,
  uploadHubFocus,
}) => {
  const [policyModalTab, setPolicyModalTab] = useState<PolicyGuideTab | null>(null);

  useEffect(() => {
    const onOpenPolicy = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tab?: PolicyGuideTab }>;
      setPolicyModalTab(customEv.detail?.tab || 'freed');
    };
    window.addEventListener(OPEN_STORE_POLICY_MODAL_EVENT, onOpenPolicy);
    return () => window.removeEventListener(OPEN_STORE_POLICY_MODAL_EVENT, onOpenPolicy);
  }, []);

  return (
    <>
      {/* ==================== 카드발급 & AS센터 즉시 모달 ==================== */}
      <CardIssueModal
        isOpen={isCardIssueOpen}
        onClose={() => setIsCardIssueOpen(false)}
      />
      <AsCenterModal
        isOpen={isAsCenterOpen}
        onClose={() => setIsAsCenterOpen(false)}
      />
      <PartnerLinksModal
        isOpen={isPartnerLinksOpen}
        onClose={() => setIsPartnerLinksOpen(false)}
        isDark={isDark}
      />
      <StorePolicyQuickModal
        isOpen={Boolean(policyModalTab)}
        initialTab={policyModalTab || 'freed'}
        onClose={() => setPolicyModalTab(null)}
      />

      {/* ==================== 매장 자료 통합 업로드 센터 모달 ==================== */}
      {!isFriendMode && (
        <StoreAdminUploadHubModal
          isOpen={Boolean(isUploadHubOpen)}
          onClose={() => setIsUploadHubOpen?.(false)}
          isDark={isDark}
          initialFocus={uploadHubFocus ?? null}
        />
      )}

      {/* ==================== 지연 로딩 모달 묶음 (무이자 / 휴무표) ==================== */}
      <Suspense fallback={null}>
        {isInstallmentModalOpen && (
          <CardInstallmentModal
            isOpen={isInstallmentModalOpen}
            onClose={() => setIsInstallmentModalOpen(false)}
          />
        )}

        {!isFriendMode && isScheduleModalOpen && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            isDark={isDark}
            onToggleTheme={toggleUiTheme}
          />
        )}
      </Suspense>

      {/* ==================== 즉시 응답 모달 (⌘K 통합검색 & ✦ AI 비서 — 청크 지연 제로) ==================== */}
      {isOmnibarOpen && (
          <CommandOmnibarModal
            isOpen={isOmnibarOpen}
            onClose={() => setIsOmnibarOpen(false)}
            isDark={isDark}
            isFriendMode={Boolean(isFriendMode)}
            customers={activeCrmCustomers}
            careDataset={careDataset}
            installmentDataset={installmentDataset}
            onNavigateStep={(nextStep) => {
              if (nextStep === 'crm') {
                setInitialCrmTab?.(undefined);
                setInitialCrmFilterTab?.(undefined);
              }
              navigateToStep(nextStep);
            }}
            onEnterQuoteMode={(mode) => handleEnterMode(mode)}
            onOpenCustomerQuote={(cust) =>
              handleOpenCustomerInQuoteBuilder(cust)
            }
            onOpenScheduleModal={() => {
              if (!isFriendMode) setIsScheduleModalOpen(true);
            }}
            onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
            onOpenCardIssueModal={() => setIsCardIssueOpen(true)}
            onOpenAsCenterModal={() => setIsAsCenterOpen(true)}
            onOpenPartnerLinksModal={() => setIsPartnerLinksOpen(true)}
            onRunInAiCopilot={(cmd) => {
              setAiInitialCommand(cmd);
              setIsAiCommandModalOpen(true);
            }}
          />
        )}

        <AiCommandModal
          isOpen={isAiCommandModalOpen}
          onClose={() => setIsAiCommandModalOpen(false)}
          isFriendMode={Boolean(isFriendMode)}
          initialCommand={aiInitialCommand}
          onClearInitialCommand={() => setAiInitialCommand('')}
          currentProposalState={currentState}
          onApplyToQuote={(nextState, targetStep) => {
            if (nextState.quoteMode === 'general') {
              setGeneralState(nextState);
            } else if (nextState.quoteMode === 'subscription') {
              setSubscriptionState(nextState);
            } else {
              setHybridState(nextState);
            }
            setActiveMode(nextState.quoteMode);
            setParseError(null);
            setParseGeneralError(null);
            navigateToStep(targetStep);
          }}
          onCustomerSaved={(savedCust, nextState) => {
            setActiveCustomer({
              id: savedCust.id,
              name: savedCust.name,
              phone: savedCust.phone,
            });
            setCrmCustomers(getCachedCustomers());
            if (nextState.quoteMode === 'general') {
              setGeneralState(nextState);
            } else if (nextState.quoteMode === 'subscription') {
              setSubscriptionState(nextState);
            } else {
              setHybridState(nextState);
            }
            setActiveMode(nextState.quoteMode);
          }}
          onOpenScheduleModal={() => {
            if (!isFriendMode) setIsScheduleModalOpen(true);
          }}
          onOpenCareTable={() => navigateToStep('care-table')}
          onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
          onOpenAsCenterModal={() => setIsAsCenterOpen(true)}
          onOpenInsuranceView={() => navigateToStep('insurance')}
          onOpenCrmScreen={() => {
            setInitialCrmTab(undefined);
            setInitialCrmFilterTab?.(undefined);
            navigateToStep('crm');
          }}
          onLoadCrmCustomerQuote={(cust) => {
            const latestQuote =
              Array.isArray(cust.quotes) && cust.quotes.length > 0
                ? cust.quotes[0]
                : undefined;
            applyRestoredProposalState(
              cust,
              latestQuote?.proposalState ?? (cust as any).proposalState,
              latestQuote?.itemSummary ?? cust.items,
              latestQuote?.paidAmount ?? Number(cust.paidAmount),
              latestQuote?.quoteMode
            );
          }}
        />

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

      {/* ==================== PWA 앱 설치 / 주소창 숨김 안내 모달 ==================== */}
      {isInstallGuideOpen && (
        <div className="no-print">
          <FlagshipModalShell
            isOpen={isInstallGuideOpen}
            onClose={() => setIsInstallGuideOpen(false)}
            title="주소창 없는 전용 앱(PWA) 설치 안내"
            subtitle="홈 화면에 추가하면 주소창 없이 100% 전체화면으로 실행됩니다"
            badge="PWA 전체화면"
            icon={<Smartphone className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
            maxWidthClass="max-w-md"
            bodyClassName="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1"
            footer={
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsInstallGuideOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] hover:opacity-90 text-white dark:text-[#0B1120] text-xs font-extrabold transition cursor-pointer"
                >
                  확인했습니다
                </button>
              </div>
            }
          >
            <SurfaceCard tone="benefit" padded className="space-y-1.5">
              <div className="text-xs sm:text-[13px] font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                <span>🤖 안드로이드 스마트폰 / 갤럭시탭 / 매장 PC (크롬·엣지)</span>
              </div>
              <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium">
                1) 브라우저 우측 상단 메뉴 <strong className="text-[#191F28] dark:text-slate-100">[⋮]</strong> 또는 주소창 우측의{' '}
                <strong className="text-[#191F28] dark:text-slate-100">[앱 설치 / 모니터 아이콘]</strong>을 누릅니다.
                <br />
                2) <strong className="text-[#191F28] dark:text-slate-100">[앱 설치]</strong> 또는 <strong className="text-[#191F28] dark:text-slate-100">[홈 화면에 추가]</strong>를
                선택하면 바탕화면에 <strong className="text-[#1B64DA] dark:text-blue-300">국지통합앱</strong> 아이콘이 생성됩니다.
              </p>
            </SurfaceCard>

            <SurfaceCard tone="sub" padded className="space-y-1.5">
              <div className="text-xs sm:text-[13px] font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                <span>🍎 아이폰 / 아이패드 (Safari 브라우저)</span>
              </div>
              <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium">
                1) Safari 하단(아이패드는 상단)의{' '}
                <strong className="text-[#191F28] dark:text-slate-100">[공유 버튼 (네모 위 화살표 ↑)]</strong>을 터치합니다.
                <br />
                2) 메뉴를 내려 <strong className="text-[#191F28] dark:text-slate-100">[홈 화면에 추가 (+)]</strong>를 누르고 우측 상단{' '}
                <strong className="text-[#191F28] dark:text-slate-100">[추가]</strong>를 터치합니다.
                <br />
                3) 홈 화면에 생성된 아이콘으로 실행하면 상·하단 주소창이 100% 사라집니다!
              </p>
            </SurfaceCard>
          </FlagshipModalShell>
        </div>
      )}

      {!isFriendMode && isStealthPinOpen && (
        <div className="no-print">
          <FlagshipModalShell
            isOpen={isStealthPinOpen}
            onClose={() => setIsStealthPinOpen(false)}
            title="개인 보안 코드 인증"
            badge="보안"
            icon={<Lock className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />}
            maxWidthClass="max-w-xs"
            bodyClassName="p-4 sm:p-5 space-y-3.5"
          >
            <input
              type="password"
              inputMode="numeric"
              value={stealthPinInput}
              onChange={(e) => {
                setStealthPinInput(e.target.value);
                setStealthPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmStealthPin();
              }}
              placeholder="보안 코드 입력"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-100 placeholder:text-[#8B95A1] dark:placeholder:text-slate-500 text-center font-mono tabular-nums text-base font-extrabold focus:outline-none focus:border-[#1B64DA] dark:focus:border-blue-400 transition-colors"
            />
            {stealthPinError && (
              <p className="text-xs font-bold text-[#E60012] dark:text-[#FF3B47] text-center">
                코드가 일치하지 않습니다.
              </p>
            )}
            <button
              type="button"
              onClick={handleConfirmStealthPin}
              className="w-full py-2.5 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold transition-colors cursor-pointer"
            >
              확인
            </button>
          </FlagshipModalShell>
        </div>
      )}

      {step !== 'crm' && step !== 'marketing-db' && (
        <PastDeliveryCheckModal
          isOpen={isHomePastDeliveryOpen}
          customers={pastDueCustomersHome}
          isDark={isDark}
          onConfirmDelivered={handleConfirmDeliveredFromHome}
          onConfirmAllDelivered={handleConfirmAllDeliveredFromHome}
          onClose={() => {
            sessionStorage.setItem(PAST_DELIVERY_POPUP_DISMISSED_KEY, '1');
            setIsHomePastDeliveryOpen(false);
          }}
        />
      )}
    </>
  );
};

interface ScreenErrorBoundaryProps {
  stepKey: string;
  onResetToHome: () => void;
  children: React.ReactNode;
}
interface ScreenErrorBoundaryState {
  error: Error | null;
}
export class ScreenErrorBoundary extends React.Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  state: ScreenErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ScreenErrorBoundaryProps) {
    if (prevProps.stepKey !== this.props.stepKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3 bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100">
          <div className="text-sm font-extrabold text-[#E60012] dark:text-[#FF3B47]">
            화면을 불러오는 중 일시적인 오류가 발생했습니다.
          </div>
          <div className="text-xs text-[#4E5968] dark:text-slate-400 max-w-md break-all">
            {this.state.error.message}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-extrabold transition-colors cursor-pointer"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                this.props.onResetToHome();
              }}
              className="px-4 py-2 rounded-xl bg-[#191F28] dark:bg-slate-800 hover:opacity-90 text-white text-xs font-extrabold transition-colors cursor-pointer"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function getStepShortLabel(s: AppStep): string {
  switch (s) {
    case 'home':
      return '홈';
    case 'crm':
      return '통합고객관리';
    case 'marketing-db':
      return '인스타DB';
    case 'input':
      return '견적서';
    case 'proposal':
      return '제안서';
    case 'care-table':
      return '조견표';
    case 'lotte-plan':
      return '플랜계산기';
    case 'pop-printer':
      return '구독POP';
    case 'himobile':
      return '하이모바일';
    case 'allcare-guide':
      return '올케어';
    case 'insurance':
      return '보험안내';
    default:
      return '홈';
  }
}
