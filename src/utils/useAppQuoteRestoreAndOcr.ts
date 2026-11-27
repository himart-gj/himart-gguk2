import React, { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppStep, createEmptyGeneralPlanData, createInitialState, extractGeneralPlanData, getSubscriptionPeriodSummary, hasMeaningfulGeneralItems, hasMeaningfulSubItems, hasPlanMeaningfulContent, MAX_QUOTE_PLANS, normalizeSubscriptionPeriod, ProposalState, QuoteMode, resolveComparisonModePlanData, SUB_CARE_OPTIONS, SubscriptionPeriod, syncActivePlanIntoGeneralPlans } from '../types/proposal';
import { ControlPanel } from '../components/ControlPanel';
import { ProposalPreview } from '../components/ProposalPreview';
import { fetchRemoteSchedules } from '../components/ScheduleModal';
import { fetchRemoteModelIncentiveSheets } from '../crm/utils/settlementEngine';
import { decodeSharedQuoteFromHash, SharedQuotePayload } from './shareQuoteCodec';
import { flushPendingOutbox, useOfflineSyncStatus } from './offlineDbQueue';
import { installLifecycleResumeAndUpdateGuard, scrollToTopInstant } from './mobileQaRuntime';
import { PopPrinterApp } from '../pop/PopPrinterApp';
import { CrmApp } from '../crm/CrmApp';
import { HiMobileView } from '../components/HiMobileView';
import { InsuranceGuideView } from '../components/InsuranceGuideView';
import { CareTableView } from '../components/CareTableView';
import { LottePlanCalcView } from '../components/LottePlanCalcView';
import { AllCareGuideView } from '../components/AllCareGuideView';
import { CustomerShareQuoteView } from '../components/CustomerShareQuoteView';
import { isOwnerMarketingDbUnlocked, loadMarketingDbStore, MARKETING_DB_UPDATED_EVENT, syncLeadsFromGoogleSheet, verifyAndUnlockOwnerDb } from './marketingDbEngine';
import MarketingDbManagerView from '../components/MarketingDbManagerView';
import { CustomerItem, QuoteRecord, SettlementTabId } from '../crm/types/crm';
import { CRM_CUSTOMERS_UPDATED_EVENT, getCachedCustomers, markAllConfirmedSlipsDelivered, setCachedCustomers, syncCustomerToGas } from '../crm/services/gasApi';
import { getPastDueDeliveryCustomers, isPendingLogisticsCustomer, isUrgentCustomer } from '../crm/utils/date';
import { PAST_DELIVERY_POPUP_DISMISSED_KEY } from '../crm/CrmApp';
import { CARE_TABLE_UPDATED_EVENT, CareTableDataset, fetchRemoteCareDataset, loadLocalCareDataset, saveLocalCareDataset } from './careTableParser';
import { fetchRemoteInstallmentDataset, INSTALLMENT_UPDATED_EVENT, loadLocalInstallmentDataset, saveLocalInstallmentDataset } from './installmentParser';
import { mapGeneralCardName, mapSubscriptionAffiliateCard, parseGeneralImageWithFallback, parseSubscriptionImageWithFallback, sanitizeFiveYearWarrantyText } from './aiImageParser';
import { Columns2 } from 'lucide-react';
import { AppHeaderAndHome } from '../components/AppHeaderAndHome';
import { AppGlobalModals, getStepShortLabel, ScreenErrorBoundary } from '../components/AppGlobalModals';
import { OPEN_ADMIN_UPLOAD_HUB_EVENT } from '../components/StoreAdminUploadHubModal';
import { StoreCloudKind } from './storeCloudSync';
import {
  canAccessStoreSchedule,
  FRIEND_ROLE_CHANGED_EVENT,
  isFriendRestrictedMode,
  persistVerifiedOwnerStaffPin,
  purgeLocalScheduleAndOwnerState,
} from './friendAccessGuard';
import { isCustomerVisibleInActiveCrm } from '../crm/utils/autoArchiveEngine';
import { syncBidirectionalUserCrm } from '../crm/services/userCrmCloudSync';
import {
  BeforeInstallPromptEvent,
  getGlobalDeferredInstallPrompt,
  getGlobalStandaloneState,
  subscribePwaInstallState,
  triggerNativePwaInstallPrompt,
} from './pwaInstallManager';

import { AppMainShellView } from '../components/AppMainShellView';

export function useAppQuoteRestoreAndOcr(ctx: Record<string, any>) {
  const {
    navigateToStep,
    setActiveCustomer,
    setActiveMode,
    setCurrentState,
    setGeneralState,
    setHybridState,
    setIsParsing,
    setIsParsingGeneral,
    setParseError,
    setParseGeneralError,
    setSubScanNotice,
    setSubscriptionState,
    subScanNoticeTimerRef,
  } = ctx;
  // CRM에서 저장된 ProposalState 스냅샷 또는 고객 기본 정보를 신규 견적기로 복원
  const applyRestoredProposalState = useCallback(
    (
      customer: CustomerItem,
      savedProposalState?: any,
      fallbackItemSummary?: string,
      fallbackPaidAmount?: number,
      fallbackQuoteMode?: QuoteMode,
      activeQuoteId?: string
    ) => {
      setActiveCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        activeQuoteId: activeQuoteId || customer.quotes?.[0]?.id,
      });

      if (savedProposalState && typeof savedProposalState === 'object') {
        const targetMode: QuoteMode =
          savedProposalState.quoteMode === 'general' ||
          savedProposalState.quoteMode === 'subscription' ||
          savedProposalState.quoteMode === 'hybrid'
            ? savedProposalState.quoteMode
            : fallbackQuoteMode || 'general';

        const base = createInitialState(targetMode);
        const parsed = JSON.parse(JSON.stringify(savedProposalState));

        const mergedPlan1 = extractGeneralPlanData({
          ...base.generalPlan1,
          ...(parsed.generalPlan1 || {}),
          items:
            Array.isArray(parsed.generalPlan1?.items) &&
            parsed.generalPlan1.items.length > 0
              ? parsed.generalPlan1.items
              : Array.isArray(parsed.items) && parsed.items.length > 0
              ? parsed.items
              : base.generalPlan1.items,
          subscriptionPeriod:
            parsed.generalPlan1?.subscriptionPeriod ||
            parsed.subscriptionPeriod ||
            base.generalPlan1.subscriptionPeriod,
          careService:
            parsed.generalPlan1?.careService ||
            parsed.careService ||
            base.generalPlan1.careService,
          warrantyType:
            parsed.generalPlan1?.warrantyType ||
            parsed.warrantyType ||
            base.generalPlan1.warrantyType,
          warrantyYears: 5,
          allCare:
            parsed.generalPlan1?.allCare ??
            parsed.allCare ??
            base.generalPlan1.allCare,
          selectedCardId:
            parsed.generalPlan1?.selectedCardId ||
            parsed.selectedCardId ||
            base.generalPlan1.selectedCardId,
          selectedCardTierId:
            parsed.generalPlan1?.selectedCardTierId ??
            parsed.selectedCardTierId ??
            base.generalPlan1.selectedCardTierId,
          hiPlusCounts:
            parsed.generalPlan1?.hiPlusCounts ||
            parsed.hiPlusCounts ||
            base.generalPlan1.hiPlusCounts,
          hideHiPreed: Boolean(
            parsed.generalPlan1?.hideHiPreed ?? parsed.hideHiPreed
          ),
          hideSubPreed: Boolean(
            parsed.generalPlan1?.hideSubPreed ?? parsed.hideSubPreed
          ),
          subAutoTierCashback:
            parsed.generalPlan1?.subAutoTierCashback ??
            parsed.subAutoTierCashback ??
            true,
          subManualTierCashback:
            parsed.generalPlan1?.subManualTierCashback ??
            parsed.subManualTierCashback ??
            0,
          subExtraCashback:
            parsed.generalPlan1?.subExtraCashback ??
            parsed.subExtraCashback ??
            0,
          subLotteBilling5p: Boolean(
            parsed.generalPlan1?.subLotteBilling5p ?? parsed.subLotteBilling5p
          ),
        });

        const mergedPlan2 = extractGeneralPlanData({
          ...base.generalPlan2,
          ...(parsed.generalPlan2 || {}),
        });

        const restoredPlans: ReturnType<typeof extractGeneralPlanData>[] =
          Array.isArray(parsed.generalPlans) && parsed.generalPlans.length > 0
            ? parsed.generalPlans
                .slice(0, MAX_QUOTE_PLANS)
                .map((p: any, idx: number) =>
                  extractGeneralPlanData({
                    ...createEmptyGeneralPlanData(targetMode, idx + 1),
                    ...(p || {}),
                  })
                )
            : parsed.activeGeneralPlan === 2 ||
              hasPlanMeaningfulContent(mergedPlan2)
            ? [mergedPlan1, mergedPlan2]
            : [mergedPlan1];

        const activePlanNum = Math.min(
          restoredPlans.length,
          Math.max(1, Math.floor(Number(parsed.activeGeneralPlan) || 1))
        );
        const activePlanFields = restoredPlans[activePlanNum - 1] || mergedPlan1;

        const restored: ProposalState = {
          ...base,
          ...parsed,
          ...activePlanFields,
          quoteMode: targetMode,
          activeGeneralPlan: activePlanNum,
          generalPlans: restoredPlans,
          generalPlan1: restoredPlans[0] || mergedPlan1,
          generalPlan2:
            restoredPlans[1] ??
            createEmptyGeneralPlanData(targetMode, 2),
        };

        if (parsed.modeConfigs && typeof parsed.modeConfigs === 'object') {
          if (parsed.modeConfigs.general) {
            const gBase = createInitialState('general');
            const gSnap = extractGeneralPlanData({ ...gBase, ...parsed.modeConfigs.general });
            setGeneralState({
              ...gBase,
              ...gSnap,
              quoteMode: 'general',
              compareModes: parsed.compareModes,
              generalPlans: [gSnap],
              generalPlan1: gSnap,
            });
          }
          if (parsed.modeConfigs.subscription) {
            const sBase = createInitialState('subscription');
            const sSnap = extractGeneralPlanData({ ...sBase, ...parsed.modeConfigs.subscription });
            setSubscriptionState({
              ...sBase,
              ...sSnap,
              quoteMode: 'subscription',
              compareModes: parsed.compareModes,
              generalPlans: [sSnap],
              generalPlan1: sSnap,
            });
          }
          if (parsed.modeConfigs.hybrid) {
            const hBase = createInitialState('hybrid');
            const hSnap = extractGeneralPlanData({ ...hBase, ...parsed.modeConfigs.hybrid });
            setHybridState({
              ...hBase,
              ...hSnap,
              quoteMode: 'hybrid',
              compareModes: parsed.compareModes,
              generalPlans: [hSnap],
              generalPlan1: hSnap,
            });
          }
        }

        if (targetMode === 'general') {
          setGeneralState(restored);
        } else if (targetMode === 'subscription') {
          setSubscriptionState(restored);
        } else {
          setHybridState(restored);
        }
        setActiveMode(targetMode);
        setParseError(null);
        setParseGeneralError(null);
        navigateToStep('input');
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
        const firstSubItem = {
          id: `sub-crm-${Date.now()}`,
          category: summaryStr || '맞춤 구독 가전',
          modelName: '',
          monthlyFee: paidNum,
          period: 60 as SubscriptionPeriod,
          careService: SUB_CARE_OPTIONS[0],
        };
        nextSub.items = [firstSubItem];
        const subSnap = extractGeneralPlanData(nextSub);
        nextSub.generalPlans = [subSnap];
        nextSub.generalPlan1 = subSnap;
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
        const genSnap = extractGeneralPlanData(nextGen);
        nextGen.generalPlans = [genSnap];
        nextGen.generalPlan1 = genSnap;
        setGeneralState(nextGen);
      }

      setActiveMode(targetMode);
      setParseError(null);
      setParseGeneralError(null);
      navigateToStep('input');
    },
    [navigateToStep]
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
        quote.quoteMode,
        quote.id
      );
    },
    [applyRestoredProposalState]
  );

  // [1번 사진 대응] 일반구매(general) 및 혼합견적(hybrid) 일반전산 사진 자동입력
  const handleParseGeneralImage = useCallback(
    async (file: File) => {
      setIsParsingGeneral(true);
      setParseGeneralError(null);

      try {
        const result = await parseGeneralImageWithFallback(file);
        const extractedItems = Array.isArray(result.items) ? result.items : [];

        if (extractedItems.length === 0) {
          throw new Error(
            '일반 구매 본품 품목을 찾지 못했습니다. 사진을 다시 확인해 주세요.'
          );
        }

        const instantDiscount = Math.max(0, Number(result.instantDiscount) || 0);
        const lpointTotal = Math.max(0, Number(result.lpointTotal) || 0);
        const tierCashback = Math.max(0, Number(result.tierCashback) || 0);
        let extraCashback = Math.max(0, Number(result.extraCashback) || 0);
        const finalBenefitPrice = Math.max(
          0,
          Number(result.finalBenefitPrice) || 0
        );

        const mappedItems = extractedItems.map((it, idx) => {
          const qty = Math.max(1, Number(it.quantity ?? it.qty) || 1);
          const unitPrice = Math.max(0, Number(it.unitPrice ?? it.price) || 0);
          return {
            id: `gen-ai-${Date.now()}-${idx}`,
            category: it.category || it.name || `품목 ${idx + 1}`,
            name: it.name || it.category || `품목 ${idx + 1}`,
            code: it.code || it.modelName || '',
            modelName: it.modelName || it.code || '',
            qty,
            quantity: qty,
            price: unitPrice * qty,
            unitPrice,
            discount1: idx === 0 ? instantDiscount : 0,
            discount2: idx === 0 ? lpointTotal : 0,
            cashback: idx === 0 ? tierCashback : 0,
          };
        });

        const sumOfItems = mappedItems.reduce(
          (acc, it) => acc + it.unitPrice * it.quantity,
          0
        );

        if (finalBenefitPrice > 0 && sumOfItems > finalBenefitPrice) {
          const currentCalculatedNet =
            sumOfItems -
            instantDiscount -
            lpointTotal -
            tierCashback -
            extraCashback;
          if (currentCalculatedNet > finalBenefitPrice) {
            extraCashback += currentCalculatedNet - finalBenefitPrice;
          }
        }

        const detectedCardType = mapGeneralCardName(
          result.cardName,
          tierCashback > 0
        );

        setCurrentState((prev) => {
          const updatedPlanFields = {
            generalItems: mappedItems,
            generalCardType: detectedCardType,
            instantDiscount,
            earnedPoints: lpointTotal,
            pointUsed: 0,
            autoTierCashback: false,
            manualTierCashback: tierCashback,
            extraCashback,
          };

          const nextState: ProposalState = {
            ...prev,
            ...updatedPlanFields,
          };

          return syncActivePlanIntoGeneralPlans(nextState);
        });
      } catch (err: any) {
        setParseGeneralError(
          err?.message || '일반전산 이미지 분석 중 오류가 발생했습니다.'
        );
      } finally {
        setIsParsingGeneral(false);
      }
    },
    [setCurrentState]
  );

  // [2번 사진 대응] 구독구매(subscription) 및 혼합견적(hybrid) 맞춤 구독 견적 계산기 사진 자동입력
  const handleParseImage = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParseError(null);

      try {
        const data = await parseSubscriptionImageWithFallback(file);
        const extractedItems = Array.isArray(data.items) ? data.items : [];
        const firstItem = extractedItems[0] || ({} as any);

        const detectedPeriod: SubscriptionPeriod = normalizeSubscriptionPeriod(
          firstItem.period ?? (data as any).period,
          60
        );

        const rawCardName = data.cardName || firstItem.cardName || '';
        const mappedCard = mapSubscriptionAffiliateCard(rawCardName);

        const resolvedWarrantyType = sanitizeFiveYearWarrantyText(
          data.warrantyType || firstItem.warrantyType || 'AS연장보험'
        );

        setCurrentState((prev) => {
          const existingValidItems = prev.items.filter(
            (it) =>
              (it.category || '').trim() !== '' ||
              (it.modelName || '').trim() !== '' ||
              (Number(it.monthlyFee) || 0) > 0
          );

          const mappedItems =
            extractedItems.length > 0
              ? extractedItems.map((it: any, idx: number) => {
                  const itemPeriod: SubscriptionPeriod =
                    normalizeSubscriptionPeriod(it.period, detectedPeriod);
                  const cleanCareService = sanitizeFiveYearWarrantyText(
                    it.careService || SUB_CARE_OPTIONS[0]
                  );
                  const cleanCareType = sanitizeFiveYearWarrantyText(
                    it.careType || it.careService || SUB_CARE_OPTIONS[0]
                  );
                  const cleanWarrantyType = sanitizeFiveYearWarrantyText(
                    it.warrantyType || resolvedWarrantyType || '5년 무상 A/S 기본 포함'
                  );
                  return {
                    id: `ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                    category:
                      it.category ||
                      `구독 가전 ${existingValidItems.length + idx + 1}`,
                    modelName:
                      it.modelName || it.modelCode || data.urlModelCode || '',
                    modelCode:
                      it.modelCode || it.modelName || data.urlModelCode || '',
                    monthlyFee:
                      Number(it.monthlyFee) > 0 ? Number(it.monthlyFee) : 0,
                    period: itemPeriod,
                    contractAmount:
                      Number(it.contractAmount) > 0
                        ? Number(it.contractAmount)
                        : Number(data.contractAmount) || 0,
                    careService: cleanCareService,
                    careType: cleanCareType,
                    warrantyType: cleanWarrantyType,
                    cardName: it.cardName || rawCardName,
                  };
                })
              : [];

          const nextItems =
            mappedItems.length === 0
              ? prev.items
              : existingValidItems.length === 0
              ? mappedItems
              : [...existingValidItems, ...mappedItems];

          if (mappedItems.length > 0) {
            const firstAdded = mappedItems[0];
            const addedLabel = firstAdded.modelName
              ? `${firstAdded.category} (${firstAdded.modelName})`
              : firstAdded.category;
            if (subScanNoticeTimerRef.current) {
              clearTimeout(subScanNoticeTimerRef.current);
            }
            setSubScanNotice(
              `✓ [${addedLabel}] 품목이 구독 목록에 추가되었습니다! (현재 총 ${nextItems.length}품목)`
            );
            subScanNoticeTimerRef.current = setTimeout(() => {
              setSubScanNotice(null);
            }, 3000);
          }

          const repPeriod: SubscriptionPeriod = getSubscriptionPeriodSummary(
            nextItems,
            detectedPeriod
          ).representativePeriod;

          const scannedExtraCashback = extractedItems.reduce(
            (acc: number, it: any) =>
              acc + Math.max(0, Number(it?.extraCashback) || 0),
            0
          );

          return {
            ...prev,
            items: nextItems,
            subExtraCashback:
              scannedExtraCashback > 0
                ? existingValidItems.length === 0
                  ? scannedExtraCashback
                  : Math.max(0, Number(prev.subExtraCashback) || 0) +
                    scannedExtraCashback
                : prev.subExtraCashback,
            subscriptionPeriod: repPeriod,
            careService: sanitizeFiveYearWarrantyText(
              firstItem.careService || prev.careService
            ),
            warrantyType: resolvedWarrantyType,
            warrantyYears: 5,
            allCare: data.allCare ?? resolvedWarrantyType.includes('가전수리올케어'),
            subAutoTierCashback: mappedCard ? true : (prev.subAutoTierCashback ?? true),
            selectedCardId:
              mappedCard.cardId !== 'none'
                ? mappedCard.cardId
                : prev.selectedCardId,
            selectedCardTierId:
              mappedCard.cardId !== 'none'
                ? mappedCard.tierId
                : prev.selectedCardTierId,
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


  return {
    applyRestoredProposalState,
    handleOpenCustomerInQuoteBuilder,
    handleOpenQuoteRecordInQuoteBuilder,
    handleParseGeneralImage,
    handleParseImage,
  };
}
