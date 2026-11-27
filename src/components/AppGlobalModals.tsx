import React, { Suspense, useEffect, useState } from 'react';
import { AppStep } from '../types/proposal';
import { AsCenterModal, CardIssueModal } from './QuickCenterModal';
import { SaveToCrmModal } from '../crm/components/SaveToCrmModal';
import { CardInstallmentModal } from './CardInstallmentModal';
import { ScheduleModal } from './ScheduleModal';
import { AiCommandModal } from './AiCommandModal';
import { CommandOmnibarModal } from './CommandOmnibarModal';
import { PartnerLinksModal } from './PartnerLinksModal';
import {
  OPEN_PARTNER_MANUAL_MODAL_EVENT,
  OpenPartnerManualDetail,
  PartnerManualViewerModal,
} from './PartnerManualViewerModal';
import {
  fetchPartnerManualsMap,
  hasConfiguredCloudEndpoint,
} from '../utils/partnerManualSync';
import { StoreAdminUploadHubModal } from './StoreAdminUploadHubModal';
import { FriendOneTimeNoticeModal } from './FriendOneTimeNoticeModal';
import { OPEN_STORE_POLICY_MODAL_EVENT, PolicyGuideTab, StorePolicyQuickModal } from './StorePolicyGuideView';
import { getCachedCustomers } from '../crm/services/gasApi';
import { PastDeliveryCheckModal } from '../crm/components/PastDeliveryCheckModal';
import { PAST_DELIVERY_POPUP_DISMISSED_KEY } from '../crm/CrmApp';
import { ExternalLink, Smartphone, Lock } from 'lucide-react';
import { FlagshipModalShell } from './ui/FlagshipModalShell';
import { SurfaceCard } from './ui/SurfaceCard';
import {
  detectInstallEnvironment,
  launchUrlInAndroidChrome,
} from '../utils/pwaInstallManager';

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
  canViewSchedule: canViewScheduleProp,
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
  const canViewSchedule = typeof canViewScheduleProp === 'boolean' ? canViewScheduleProp : !isFriendMode;
  const [policyModalTab, setPolicyModalTab] = useState<PolicyGuideTab | null>(null);
  const [partnerManualTarget, setPartnerManualTarget] =
    useState<OpenPartnerManualDetail | null>(null);

  useEffect(() => {
    const onOpenPolicy = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tab?: PolicyGuideTab }>;
      setPolicyModalTab(customEv.detail?.tab || 'freed');
    };
    const onOpenManual = (ev: Event) => {
      const customEv = ev as CustomEvent<OpenPartnerManualDetail>;
      setPartnerManualTarget(customEv.detail || {});
    };
    if (hasConfiguredCloudEndpoint()) {
      void fetchPartnerManualsMap();
    }
    window.addEventListener(OPEN_STORE_POLICY_MODAL_EVENT, onOpenPolicy);
    window.addEventListener(OPEN_PARTNER_MANUAL_MODAL_EVENT, onOpenManual);
    return () => {
      window.removeEventListener(OPEN_STORE_POLICY_MODAL_EVENT, onOpenPolicy);
      window.removeEventListener(OPEN_PARTNER_MANUAL_MODAL_EVENT, onOpenManual);
    };
  }, []);

  return (
    <>
      {isFriendMode && <FriendOneTimeNoticeModal isDark={isDark} />}
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
      <PartnerManualViewerModal
        isOpen={Boolean(partnerManualTarget)}
        initialManualId={partnerManualTarget?.manualId}
        initialChapterId={partnerManualTarget?.chapterId}
        isFriendMode={Boolean(isFriendMode)}
        onOpenCloudSetup={() => {
          setIsPartnerLinksOpen(false);
          setIsUploadHubOpen?.(true);
        }}
        onClose={() => setPartnerManualTarget(null)}
      />
      <StorePolicyQuickModal
        isOpen={Boolean(policyModalTab)}
        initialTab={policyModalTab || 'freed'}
        onClose={() => setPolicyModalTab(null)}
      />

      {!isFriendMode && (
        <StoreAdminUploadHubModal
          isOpen={Boolean(isUploadHubOpen)}
          onClose={() => setIsUploadHubOpen?.(false)}
          isDark={isDark}
          initialFocus={uploadHubFocus ?? null}
        />
      )}

      <Suspense fallback={null}>
        {isInstallmentModalOpen && (
          <CardInstallmentModal
            isOpen={isInstallmentModalOpen}
            onClose={() => setIsInstallmentModalOpen(false)}
          />
        )}

        {canViewSchedule && isScheduleModalOpen && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            isDark={isDark}
            onToggleTheme={toggleUiTheme}
          />
        )}
      </Suspense>

      {isOmnibarOpen && (
          <CommandOmnibarModal
            isOpen={isOmnibarOpen}
            onClose={() => setIsOmnibarOpen(false)}
            isDark={isDark}
            isFriendMode={Boolean(isFriendMode)}
            canViewSchedule={canViewSchedule}
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
              if (canViewSchedule) setIsScheduleModalOpen(true);
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
            if (canViewSchedule) setIsScheduleModalOpen(true);
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

      {isInstallGuideOpen && (
        <div className="no-print">
          <FlagshipModalShell
            isOpen={isInstallGuideOpen}
            onClose={() => setIsInstallGuideOpen(false)}
            title="바탕화면 전용 앱 설치 안내"
            subtitle="한 번만 추가해 두면 일반 앱처럼 주소창 없이 바로 실행됩니다"
            badge="간편 설치"
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
            {(() => {
              const modalEnv = detectInstallEnvironment();
              if (
                modalEnv.isAndroid &&
                (modalEnv.isInAppBrowser || modalEnv.isSamsungBrowser)
              ) {
                return (
                  <SurfaceCard tone="benefit" padded className="space-y-2">
                    <div className="text-xs sm:text-[13px] font-extrabold text-[#1B64DA] dark:text-blue-300">
                      🌐 삼성 갤럭시 간편 설치 (크롬 자동 전환)
                    </div>
                    <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium break-keep">
                      아래 버튼을 누르면 <strong>구글 크롬(Chrome)</strong>으로 바로 열리며 상단 <strong>[앱 설치]</strong> 버튼으로 한 번에 바탕화면 설치가 됩니다.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        launchUrlInAndroidChrome(window.location.href)
                      }
                      className="min-h-[42px] w-full py-2.5 px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>크롬(Chrome)으로 열어서 설치하기</span>
                    </button>
                  </SurfaceCard>
                );
              }
              return null;
            })()}

            <SurfaceCard tone="benefit" padded className="space-y-1.5">
              <div className="text-xs sm:text-[13px] font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                <span>🤖 삼성 갤럭시 · 안드로이드 · PC (크롬 권장)</span>
              </div>
              <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium break-keep">
                1) 크롬 화면 오른쪽 맨 위 <strong className="text-[#191F28] dark:text-slate-100">점 3개 [⋮]</strong> 버튼을 누릅니다.
                <br />
                2) 메뉴에서 <strong className="text-[#191F28] dark:text-slate-100">[앱 설치]</strong> 또는 <strong className="text-[#191F28] dark:text-slate-100">[홈 화면에 추가]</strong>를 누르면 바탕화면에 <strong className="text-[#1B64DA] dark:text-blue-300">하이마트 상담앱</strong> 아이콘이 생성됩니다.
                <br />
                <span className="text-[11px] opacity-85">
                  ※ 삼성 인터넷 사용 시: 오른쪽 아래 <strong>[≡]</strong> ➔ <strong>[+ 현재 페이지 추가]</strong> ➔ <strong>[홈 화면]</strong>
                </span>
              </p>
            </SurfaceCard>

            <SurfaceCard tone="sub" padded className="space-y-1.5">
              <div className="text-xs sm:text-[13px] font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                <span>🍎 아이폰 · 아이패드 (Safari 브라우저 필수)</span>
              </div>
              <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed font-medium break-keep">
                1) 반드시 기본 <strong>Safari(나침반 모양 앱)</strong>로 주소를 엽니다.
                <br />
                2) 화면 맨 아래 가운데 <strong className="text-[#191F28] dark:text-slate-100">[공유 버튼 (네모 위 화살표 ↑)]</strong>을 터치합니다.
                <br />
                3) 메뉴를 살짝 올려 <strong className="text-[#191F28] dark:text-slate-100">[홈 화면에 추가 (+)]</strong> ➔ 우측 상단 <strong className="text-[#191F28] dark:text-slate-100">[추가]</strong>를 누르면 바탕화면에 아이콘이 생깁니다!
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
