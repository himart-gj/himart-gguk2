import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, CreditCard, ExternalLink, FileText, Loader2, Mic, MicOff, RefreshCw, SlidersHorizontal, Sparkles, UserCheck, UserPlus, X, Zap } from 'lucide-react';
import { ProposalState } from '../types/proposal';
import { extractQuotePayloadFromProposalState } from '../crm/components/SaveToCrmModal';
import { saveCustomerQuote } from '../crm/services/gasApi';
import { formatCurrency, formatPhoneNumber } from '../crm/utils/date';
import { getEffectiveGeminiApiKey, getStoredGeminiApiKey, setStoredGeminiApiKey } from '../utils/aiImageParser';
import { CareTableDataset, fetchRemoteCareDataset, loadLocalCareDataset } from '../utils/careTableParser';
import { loadPartnerLinks, PartnerQuickLinkItem } from './PartnerLinksModal';
import { loadSavedUserName } from './ScheduleModal';
import { AiCustomerStatus, ParsedAiCommand, ScheduleModifyResult, ScheduleQueryResult, AiCommandModalProps, QUICK_EXAMPLES, tryExecuteScheduleCommand } from './aiCommandScheduleEngine';
import { searchCareTableFromCommand, searchInstallmentFromCommand, searchAsCenterFromCommand, searchCrmCustomersFromCommand, searchInsuranceFromCommand, parseKoreanCommandLocal, parseCommandWithHybridAi, buildProposalStateFromAiCommand, mapAiStatusToCrmStatus } from './aiCommandParsers';
import { AiCommandResultCards } from './AiCommandResultCards';
export {
  tryExecuteScheduleCommand,
} from './aiCommandScheduleEngine';
export type {
  AiCustomerStatus,
  ParsedAiCommand,
  ScheduleModifyResult,
  ScheduleQueryResult,
  InstallmentSearchResult,
  AsSearchResultItem,
  CrmSearchResult,
  InsuranceBriefResult,
} from './aiCommandScheduleEngine';
export {
  searchCareTableFromCommand,
  searchInstallmentFromCommand,
  searchAsCenterFromCommand,
  searchCrmCustomersFromCommand,
  searchInsuranceFromCommand,
  parseKoreanCommandLocal,
  parseCommandWithHybridAi,
  buildProposalStateFromAiCommand,
} from './aiCommandParsers';

export const AiCommandModal: React.FC<AiCommandModalProps> = ({
  isOpen,
  onClose,
  onApplyToQuote,
  onCustomerSaved,
  onOpenScheduleModal,
  onOpenCareTable,
  onOpenInstallmentModal,
  onOpenAsCenterModal,
  onOpenInsuranceView,
  onOpenCrmScreen,
  onLoadCrmCustomerQuote,
  initialCommand,
  onClearInitialCommand,
  currentProposalState,
}) => {
  const [commandText, setCommandText] = useState<string>('');
  const [appendToCurrentQuote, setAppendToCurrentQuote] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<string[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [engineBadge, setEngineBadge] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedAiCommand | null>(null);

  // 휴무표 수정/조회 실행 결과 상태
  const [scheduleModifyResult, setScheduleModifyResult] =
    useState<ScheduleModifyResult | null>(null);
  const [scheduleQueryResult, setScheduleQueryResult] =
    useState<ScheduleQueryResult | null>(null);
  const [myStaffNameInput, setMyStaffNameInput] = useState<string>(() =>
    loadSavedUserName()
  );

  // 안심케어 데이터셋 로드 상태
  const [careDataset, setCareDataset] = useState<CareTableDataset | null>(() =>
    loadLocalCareDataset()
  );

  // 모달 내 고객 정보 수정용 상태
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerDeliveryDate, setCustomerDeliveryDate] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<AiCustomerStatus>('상담진행중');
  const [customerMemo, setCustomerMemo] = useState<string>('');

  const [autoSavedBanner, setAutoSavedBanner] = useState<string | null>(null);
  const [proposalReadyBanner, setProposalReadyBanner] = useState<string | null>(null);
  const [aiReplyText, setAiReplyText] = useState<string | null>(null);
  const [isApiKeyPanelOpen, setIsApiKeyPanelOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() =>
    getStoredGeminiApiKey()
  );
  const [hasActiveApiKey, setHasActiveApiKey] = useState<boolean>(() =>
    Boolean(getEffectiveGeminiApiKey())
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // 모달 열릴 때 최신 안심케어 데이터셋 및 내 이름 동기화
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    setMyStaffNameInput(loadSavedUserName());
    if (initialCommand && initialCommand.trim()) {
      const cmd = initialCommand.trim();
      setCommandText(cmd);
      setParsedResult(null);
      if (/(추가|더해|변경|바꿔|넣어)/.test(cmd)) {
        setAppendToCurrentQuote(true);
      }
      onClearInitialCommand?.();
    }
    const localCare = loadLocalCareDataset();
    if (localCare) {
      setCareDataset(localCare);
    } else {
      fetchRemoteCareDataset()
        .then((remote) => {
          if (remote) setCareDataset(remote);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [isOpen]);

  // 실시간 미리보기용 파생 명령
  const effectiveParsedCommand = useMemo<ParsedAiCommand | null>(() => {
    if (parsedResult) {
      return {
        ...parsedResult,
        customer: {
          ...parsedResult.customer,
          name: customerName,
          phone: customerPhone,
          deliveryDate: customerDeliveryDate,
          status: customerStatus,
          memo: customerMemo,
        },
      };
    }
    if (!commandText.trim()) return null;
    return parseKoreanCommandLocal(commandText);
  }, [
    parsedResult,
    commandText,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
  ]);

  // 견적 품목이 실제로 존재하는지 여부
  const hasQuoteItems = useMemo(() => {
    if (!effectiveParsedCommand) return false;
    return (
      effectiveParsedCommand.generalItems.length > 0 ||
      effectiveParsedCommand.subscriptionItems.length > 0 ||
      effectiveParsedCommand.generalHiPreedCounts.hf75 +
        effectiveParsedCommand.generalHiPreedCounts.hf150 +
        effectiveParsedCommand.generalHiPreedCounts.hf225 +
        effectiveParsedCommand.generalHiPreedCounts.hf300 >
        0 ||
      effectiveParsedCommand.hiPlusCounts.hi72 +
        effectiveParsedCommand.hiPlusCounts.hi90 +
        effectiveParsedCommand.hiPlusCounts.hi108 >
        0
    );
  }, [effectiveParsedCommand]);

  const generatedState = useMemo<ProposalState | null>(() => {
    if (!effectiveParsedCommand || !hasQuoteItems) return null;
    const fresh = buildProposalStateFromAiCommand(effectiveParsedCommand);
    if (!appendToCurrentQuote || !currentProposalState) {
      return fresh;
    }

    // 멀티턴 증분 병합 모드: 기존 작성 중인 품목/혜택 위에 새 지시사항을 이어서 반영
    const merged: ProposalState = JSON.parse(JSON.stringify(currentProposalState));
    const existingGenValid = (merged.generalItems || []).filter(
      (it) => (it.category || '').trim() || (Number(it.unitPrice) || 0) > 0
    );
    const freshGenValid = (fresh.generalItems || []).filter(
      (it) => (it.category || '').trim() || (Number(it.unitPrice) || 0) > 0
    );
    if (freshGenValid.length > 0) {
      merged.generalItems = [...existingGenValid, ...freshGenValid];
    }

    const existingSubValid = (merged.items || []).filter(
      (it) => (it.category || '').trim() || (Number(it.monthlyFee) || 0) > 0
    );
    const freshSubValid = (fresh.items || []).filter(
      (it) => (it.category || '').trim() || (Number(it.monthlyFee) || 0) > 0
    );
    if (freshSubValid.length > 0) {
      merged.items = [...existingSubValid, ...freshSubValid];
    }

    if (merged.generalItems.length > 0 && merged.items.length > 0) {
      merged.quoteMode = 'hybrid';
    } else if (merged.items.length > 0 && fresh.quoteMode === 'subscription') {
      merged.quoteMode = 'subscription';
    }

    if (fresh.generalCardType && fresh.generalCardType !== '미정') {
      merged.generalCardType = fresh.generalCardType;
    }
    if (fresh.instantDiscount > 0) merged.instantDiscount = fresh.instantDiscount;
    if (fresh.earnedPoints > 0) merged.earnedPoints = fresh.earnedPoints;
    if (fresh.extraCashback > 0) merged.extraCashback = fresh.extraCashback;

    const freshFreedTotal =
      fresh.generalHiPreedCounts.hf75 +
      fresh.generalHiPreedCounts.hf150 +
      fresh.generalHiPreedCounts.hf225 +
      fresh.generalHiPreedCounts.hf300;
    if (freshFreedTotal > 0) {
      merged.generalHiPreedCounts = { ...fresh.generalHiPreedCounts };
    }

    const freshHiPlusTotal =
      fresh.hiPlusCounts.hi72 +
      fresh.hiPlusCounts.hi90 +
      fresh.hiPlusCounts.hi108;
    if (freshHiPlusTotal > 0) {
      merged.hiPlusCounts = { ...fresh.hiPlusCounts };
    }

    if (merged.activeGeneralPlan === 1) {
      merged.generalPlan1 = { ...merged.generalPlan1, ...merged };
    } else {
      merged.generalPlan2 = { ...merged.generalPlan2, ...merged };
    }
    return merged;
  }, [effectiveParsedCommand, hasQuoteItems, appendToCurrentQuote, currentProposalState]);

  const previousQuotePayload = useMemo(() => {
    if (!currentProposalState) return null;
    const prevSummary = extractQuotePayloadFromProposalState(currentProposalState);
    if (
      prevSummary.primaryGenSummary.sum <= 0 &&
      prevSummary.primarySubSummary.totalBaseMonthly <= 0
    ) {
      return null;
    }
    return prevSummary;
  }, [currentProposalState]);

  const quotePayload = useMemo(() => {
    if (!generatedState) return null;
    return extractQuotePayloadFromProposalState(generatedState);
  }, [generatedState]);

  // 4대 DB + 보험 실시간 검색 결과
  const careResults = useMemo(
    () => searchCareTableFromCommand(commandText, careDataset),
    [commandText, careDataset]
  );

  const installmentResult = useMemo(
    () => searchInstallmentFromCommand(commandText),
    [commandText]
  );

  const asCenterResults = useMemo(
    () => searchAsCenterFromCommand(commandText),
    [commandText]
  );

  const crmSearchResult = useMemo(
    () => searchCrmCustomersFromCommand(commandText),
    [commandText]
  );

  const insuranceResult = useMemo(
    () => searchInsuranceFromCommand(commandText),
    [commandText]
  );

  const partnerLinkResults = useMemo<PartnerQuickLinkItem[]>(() => {
    const q = commandText.trim().toLowerCase();
    if (!q) return [];
    const links = loadPartnerLinks();
    if (/(바로가기|제휴\s*링크|업무\s*링크)/.test(q)) return links;
    return links.filter((it) => {
      const hay = `${it.title} ${it.badgeText} ${it.description}`.toLowerCase();
      const keywords = [
        '방충망', '코방', '크린토피아', '입주청소', '이사청소',
        '중고보상', '중고가전', '중고몰', '리퍼',
        '수당', '하이프리드 수당', '청약', 'sk인터넷', '인터넷 청약',
      ];
      return (
        hay.includes(q) ||
        keywords.some((kw) => q.includes(kw) && hay.includes(kw.split(' ')[0]))
      );
    });
  }, [commandText]);

  // 입력 중일 때 휴무표 조회 프리뷰 (수정은 실행 버튼 클릭 시 실제 반영하거나 즉시 실행)
  const liveSchedulePreview = useMemo(() => {
    if (scheduleModifyResult || scheduleQueryResult) {
      return {
        modifyResult: scheduleModifyResult,
        queryResult: scheduleQueryResult,
      };
    }
    return tryExecuteScheduleCommand(commandText, true);
  }, [commandText, scheduleModifyResult, scheduleQueryResult]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const handleCopyText = useCallback(
    async (key: string, textToCopy: string, toastLabel?: string) => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedCodeKey(key);
        if (toastLabel) showToast(toastLabel);
        setTimeout(() => {
          setCopiedCodeKey((prev) => (prev === key ? null : prev));
        }, 2000);
      } catch {
        // ignore
      }
    },
    [showToast]
  );

  // 음성 인식 토글 (Web Speech API)
  const handleToggleSpeech = useCallback(() => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechNotice(
        '현재 브라우저는 음성 인식을 지원하지 않습니다. 크롬/엣지/사파리에서 이용해 주세요.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.continuous = false;

      const baseText = commandText.trim();

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice('🎙️ 말씀을 듣고 있습니다... 편하게 말씀해 주세요.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const combined = baseText ? `${baseText} ${transcript}` : transcript;
        setCommandText(combined);
        setParsedResult(null);
        setScheduleModifyResult(null);
        setScheduleQueryResult(null);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechNotice('음성 인식이 중단되었습니다. 다시 시도하거나 텍스트로 입력해 주세요.');
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechNotice(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechNotice('마이크 권한을 확인해 주세요.');
    }
  }, [isListening, commandText]);

  // AI 분석 + 휴무표 즉시 수정 + 자동 CRM 저장 + 제안서 직행 통합 실행
  const handleRunAiCommand = useCallback(
    async (overrideText?: string) => {
      const targetText = (overrideText ?? commandText).trim();
      if (!targetText) {
        showToast('명령어를 입력하거나 상단 예시 칩을 선택해 주세요!');
        return;
      }

      setIsAnalyzing(true);
      setAutoSavedBanner(null);
      setProposalReadyBanner(null);
      setAiReplyText(null);

      try {
        // 1) 휴무표 수정/조회 명령 즉시 실행 (localStorage 'himart_gj_schedules_v4' 반영 + 이벤트 발송)
        const schedExec = tryExecuteScheduleCommand(targetText, false);
        setScheduleModifyResult(schedExec.modifyResult);
        setScheduleQueryResult(schedExec.queryResult);
        if (schedExec.modifyResult) {
          showToast(schedExec.modifyResult.message);
        }

        // 2) 1차 로컬 한국어 견적 파서 반영
        const localParsed = parseKoreanCommandLocal(targetText);
        setParsedResult(localParsed);
        setCustomerName(localParsed.customer.name);
        setCustomerPhone(localParsed.customer.phone);
        setCustomerDeliveryDate(localParsed.customer.deliveryDate);
        setCustomerStatus(localParsed.customer.status);
        setCustomerMemo(localParsed.customer.memo);
        setEngineBadge('⚡ 초고속 한국어 통합 엔진 실행 완료');

        // 3) 2차 하이브리드 AI 정밀 파서 호출
        const {
          parsed: finalParsed,
          engineLabel,
          aiReply,
        } = await parseCommandWithHybridAi(targetText);
        setParsedResult(finalParsed);
        setCustomerName(finalParsed.customer.name);
        setCustomerPhone(finalParsed.customer.phone);
        setCustomerDeliveryDate(finalParsed.customer.deliveryDate);
        setCustomerStatus(finalParsed.customer.status);
        setCustomerMemo(finalParsed.customer.memo);
        setEngineBadge(engineLabel);
        if (aiReply) {
          setAiReplyText(aiReply);
        }

        const hasItemsInFinal =
          finalParsed.generalItems.length > 0 ||
          finalParsed.subscriptionItems.length > 0 ||
          finalParsed.generalHiPreedCounts.hf75 +
            finalParsed.generalHiPreedCounts.hf150 +
            finalParsed.generalHiPreedCounts.hf225 +
            finalParsed.generalHiPreedCounts.hf300 >
            0 ||
          finalParsed.hiPlusCounts.hi72 +
            finalParsed.hiPlusCounts.hi90 +
            finalParsed.hiPlusCounts.hi108 >
            0;

        if (hasItemsInFinal) {
          const nextState = buildProposalStateFromAiCommand(finalParsed);

          // 4) 고객 저장 키워드가 있고 고객명이 추출되었다면 즉시 CRM 자동 저장
          if (
            finalParsed.customer.shouldSaveCrm &&
            finalParsed.customer.name.trim().length > 0
          ) {
            const payload = extractQuotePayloadFromProposalState(nextState);
            const statusNote =
              finalParsed.customer.status === '결제완료' ||
              finalParsed.customer.status === '배송대기'
                ? `[${finalParsed.customer.status}] `
                : '';
            const mergedMemo =
              `${statusNote}${finalParsed.customer.memo || ''}`.trim() ||
              `[AI 비서 자동등록] ${targetText}`;

            const savedRes = await saveCustomerQuote({
              name: finalParsed.customer.name.trim(),
              phone: finalParsed.customer.phone.trim(),
              items: payload.itemsSummary,
              paidAmount: payload.paidAmount,
              netAmount: payload.netAmount,
              expectedBenefit: payload.expectedBenefit,
              deliveryDate: finalParsed.customer.deliveryDate,
              status: mapAiStatusToCrmStatus(finalParsed.customer.status),
              memo: mergedMemo,
              quoteTitle: payload.defaultQuoteTitle,
              proposalState: nextState,
              quoteMode: nextState.quoteMode,
              plan2Summary: payload.plan2Summary,
            });

            onCustomerSaved(savedRes.savedCustomer, nextState);
            setAutoSavedBanner(
              `✅ 명령어 인식과 동시에 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님이 자동 저장되었습니다!`
            );
            showToast(
              `👑 [${savedRes.savedCustomer.name}] 고객님이 CRM에 자동 저장되었습니다!`
            );
          }

          // 5) "제안서 바로 보여줘" / "제안서 띄워줘" 포함 시 견적 상태를 즉시 제안서 화면(step = 'proposal')에 세팅
          if (finalParsed.shouldOpenProposalDirectly) {
            onApplyToQuote(nextState, 'proposal');
            setProposalReadyBanner(
              '📄 제안서 화면(step = proposal)에 모든 계산 결과가 즉시 세팅되었습니다! 아래 [📄 제안서 화면 바로 확인하기] 버튼을 누르거나 창을 닫으면 바로 제안서가 보입니다.'
            );
            showToast('📄 제안서 화면이 배경에 즉시 세팅되었습니다!');
          } else {
            showToast('✅ 견적 계산이 완료되었습니다! 아래 카드를 확인해 주세요.');
          }
        } else if (
          !schedExec.modifyResult &&
          !schedExec.queryResult &&
          !aiReply &&
          searchCareTableFromCommand(targetText, careDataset).length === 0 &&
          !searchInstallmentFromCommand(targetText) &&
          searchAsCenterFromCommand(targetText).length === 0 &&
          !searchCrmCustomersFromCommand(targetText) &&
          !searchInsuranceFromCommand(targetText)
        ) {
          setAiReplyText(
            hasActiveApiKey
              ? `입력하신 "${targetText}" 명령에서 금액이나 품목이 감지되지 않았습니다. 예: "TV 380만 냉장고 320만 롯데카드", "오늘 누구 쉬어?", "에어컨 클리닝 단가", "방충망 주소"처럼 입력해 보세요!`
              : `정밀 자유 대화 분석을 사용하려면 우측 상단 [🔑 AI 키] 버튼에서 Gemini API 키를 등록해 주세요. (키 없이도 "TV 380만 냉장고 320만 롯데카드", "15일 국지현 휴무", "에어컨 클리닝 단가", "방충망" 등 핵심 명령은 즉시 작동합니다!)`
          );
        }
      } catch (err: any) {
        showToast(err?.message || '명령 실행 중 오류가 발생했습니다.');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [commandText, onApplyToQuote, onCustomerSaved, showToast]
  );

  // 하단 버튼 3: 수동/즉시 CRM 저장 + 견적 반영
  const handleManualSaveToCrm = useCallback(async () => {
    if (!generatedState || !quotePayload) {
      showToast('먼저 견적 명령어를 입력해 주세요!');
      return;
    }

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showToast('⚠️ 저장할 고객명을 입력해 주세요!');
      customerNameInputRef.current?.focus();
      return;
    }

    const statusPrefix =
      customerStatus === '결제완료' || customerStatus === '배송대기'
        ? `[${customerStatus}] `
        : '';
    const finalMemo =
      `${statusPrefix}${customerMemo}`.trim() ||
      `[AI 비서 등록] ${commandText.trim()}`;

    const savedRes = await saveCustomerQuote({
      name: trimmedName,
      phone: formatPhoneNumber(customerPhone),
      items: quotePayload.itemsSummary,
      paidAmount: quotePayload.paidAmount,
      netAmount: quotePayload.netAmount,
      expectedBenefit: quotePayload.expectedBenefit,
      deliveryDate: customerDeliveryDate,
      status: mapAiStatusToCrmStatus(customerStatus),
      memo: finalMemo,
      quoteTitle: quotePayload.defaultQuoteTitle,
      proposalState: generatedState,
      quoteMode: generatedState.quoteMode,
      plan2Summary: quotePayload.plan2Summary,
    });

    onCustomerSaved(savedRes.savedCustomer, generatedState);
    setAutoSavedBanner(
      `✅ 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님의 견적이 저장 및 반영되었습니다!`
    );
    showToast(
      `👑 [${savedRes.savedCustomer.name}] 고객관리(CRM) 저장 및 견적 반영 완료!`
    );
  }, [
    generatedState,
    quotePayload,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
    commandText,
    onCustomerSaved,
    showToast,
  ]);

  if (!isOpen) return null;

  const modeBadgeInfo =
    effectiveParsedCommand?.quoteMode === 'subscription'
      ? {
          label: '2. 구독 견적 모드',
          cls: 'bg-rose-600 text-white border-rose-500',
        }
      : effectiveParsedCommand?.quoteMode === 'hybrid'
      ? {
          label: '3. 혼합 견적 (일반+구독)',
          cls: 'bg-indigo-600 text-white border-indigo-500',
        }
      : {
          label: '1. 일반 견적 모드',
          cls: 'bg-blue-600 text-white border-blue-500',
        };

  const activeModifyCard =
    scheduleModifyResult || liveSchedulePreview.modifyResult;
  const activeQueryCard =
    scheduleQueryResult || liveSchedulePreview.queryResult;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[93dvh] sm:h-auto sm:my-auto max-h-[94dvh] rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shrink-0 border border-white/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  🤖 통합 총괄 AI 비서 (견적·제안서·고객관리·휴무표·안심케어·무이자·AS)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  음성 · 자연어 만능 실행
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium truncate">
                견적 계산·제안서 직행·CRM 고객 저장부터 휴무표 말로 수정, 안심케어 단가, 무이자 할부, AS센터까지 한 줄로 해결합니다
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsApiKeyPanelOpen((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                hasActiveApiKey
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/30'
                  : 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300'
              }`}
              title="Gemini API 키 등록 및 변경"
            >
              🔑 {hasActiveApiKey ? 'AI 키 연결됨' : 'AI 키 설정'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* API 키 설정 미니 패널 */}
          {isApiKeyPanelOpen && (
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-indigo-400/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-amber-300">
                  🔑 Gemini API 키 설정 (브라우저 안전 저장 · 정밀 자연어 분석 활성화)
                </span>
                <button
                  type="button"
                  onClick={() => setIsApiKeyPanelOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  닫기
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy... 로 시작하는 Gemini API 키 입력"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-base sm:text-xs font-mono text-white focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    setStoredGeminiApiKey(apiKeyInput);
                    setHasActiveApiKey(Boolean(getEffectiveGeminiApiKey(apiKeyInput)));
                    setIsApiKeyPanelOpen(false);
                    showToast('✅ Gemini API 키가 저장되었습니다!');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer shrink-0"
                >
                  저장하기
                </button>
              </div>
            </div>
          )}

          {/* 토스트 알림 */}
          {toastMessage && (
            <div className="p-3 rounded-2xl bg-slate-900 text-amber-300 text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-md animate-fade-in">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {/* 자동 CRM 저장 완료 배지 */}
          {autoSavedBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{autoSavedBanner}</span>
            </div>
          )}

          {/* 제안서 직행 완료 배지 */}
          {proposalReadyBanner && generatedState && (
            <div className="p-3.5 rounded-2xl bg-violet-50 border-2 border-violet-500 text-violet-950 text-xs sm:text-sm font-black flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600 shrink-0" />
                <span>{proposalReadyBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onApplyToQuote(generatedState, 'proposal');
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black cursor-pointer shrink-0 shadow-xs"
              >
                📄 제안서 화면 바로 확인하기
              </button>
            </div>
          )}

          {/* 빠른 예시 칩 4개 */}
          <div className="space-y-1.5">
            <div className="text-xs font-black text-slate-700 flex items-center justify-between flex-wrap gap-1">
              <span>💡 빠른 예시 칩 4가지 (터치하면 즉시 입력 및 자동 실행됩니다)</span>
              {engineBadge && (
                <span className="text-[11px] font-extrabold text-indigo-600">
                  {engineBadge}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setCommandText(ex.command);
                    handleRunAiCommand(ex.command);
                  }}
                  className="p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 text-left transition group cursor-pointer flex flex-col justify-between gap-1"
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 group-hover:text-indigo-900">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {ex.badge}
                  </span>
                  <span className="text-[11px] text-slate-600 font-bold line-clamp-2 leading-snug">
                    "{ex.label}"
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 멀티턴 이어하기 토글 & 최근 지시 세션 칩 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            {currentProposalState && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-black text-indigo-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendToCurrentQuote}
                  onChange={(e) => setAppendToCurrentQuote(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-600 rounded"
                />
                <span>🔗 현재 작성 중인 견적에 이어서 추가·변경하기 (멀티턴 모드)</span>
              </label>
            )}
            {sessionHistory.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap text-[11px]">
                <span className="font-bold text-slate-400">최근 지시:</span>
                {sessionHistory.slice(0, 3).map((h, i) => (
                  <button
                    key={`${h}-${i}`}
                    type="button"
                    onClick={() => setCommandText(h)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold truncate max-w-[180px] cursor-pointer"
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 자연어 입력창 + 음성 인식 + 실행 버튼 */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={commandText}
                onChange={(e) => {
                  setCommandText(e.target.value);
                  setParsedResult(null);
                  setScheduleModifyResult(null);
                  setScheduleQueryResult(null);
                  setAutoSavedBanner(null);
                  setProposalReadyBanner(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleRunAiCommand();
                  }
                }}
                rows={3}
                placeholder="예: ① TV 380만 냉장고 320만 롯데카드 하이프리드 300 1개 제안서 바로 보여줘 / ② 15일 홍길동 휴무로 바꿔줘 / ③ 에어컨 클리닝 단가랑 삼성카드 무이자 알려줘"
                className="w-full rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-hidden p-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 bg-white resize-none shadow-2xs"
              />
            </div>

            {speechNotice && (
              <div className="text-xs font-extrabold text-rose-600 px-1">
                {speechNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>🛑 음성 인식 중지</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-rose-600" />
                    <span>🎤 음성으로 말하기</span>
                  </>
                )}
              </button>

              {commandText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setCommandText('');
                    setParsedResult(null);
                    setScheduleModifyResult(null);
                    setScheduleQueryResult(null);
                    setAutoSavedBanner(null);
                    setProposalReadyBanner(null);
                    setEngineBadge('');
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  초기화
                </button>
              )}

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleRunAiCommand()}
                className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 정밀 실행중...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ AI 자동 계산 및 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI 브리핑 답변 카드 */}
          {aiReplyText && (
            <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/90 p-4 space-y-1.5 shadow-2xs">
              <div className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI 비서 브리핑 안내</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">
                {aiReplyText}
              </p>
            </div>
          )}

          {/* 제휴·업무 바로가기 즉시 매칭 카드 */}
          {partnerLinkResults.length > 0 && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 space-y-2.5 shadow-2xs">
              <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-amber-700" />
                <span>🔗 제휴 · 업무 바로가기 검색 결과 ({partnerLinkResults.length}건)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {partnerLinkResults.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {pl.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {pl.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(pl.url, '_blank', 'noopener,noreferrer')
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shrink-0 cursor-pointer"
                    >
                      열기 ↗
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        <AiCommandResultCards
          activeModifyCard={activeModifyCard}
          activeQueryCard={activeQueryCard}
          asCenterResults={asCenterResults}
          careResults={careResults}
          commandText={commandText}
          copiedCodeKey={copiedCodeKey}
          crmSearchResult={crmSearchResult}
          handleCopyText={handleCopyText}
          handleRunAiCommand={handleRunAiCommand}
          installmentResult={installmentResult}
          insuranceResult={insuranceResult}
          onClose={onClose}
          onLoadCrmCustomerQuote={onLoadCrmCustomerQuote}
          onOpenAsCenterModal={onOpenAsCenterModal}
          onOpenCareTable={onOpenCareTable}
          onOpenCrmScreen={onOpenCrmScreen}
          onOpenInstallmentModal={onOpenInstallmentModal}
          onOpenInsuranceView={onOpenInsuranceView}
          onOpenScheduleModal={onOpenScheduleModal}
          scheduleModifyResult={scheduleModifyResult}
          setMyStaffNameInput={setMyStaffNameInput}
          setScheduleModifyResult={setScheduleModifyResult}
          setScheduleQueryResult={setScheduleQueryResult}
          showToast={showToast}
        />
          {/* =====================================================================
              [결과 섹션 7] 실시간 매장 공식 수식 견적 검증 및 미리보기 카드
             ===================================================================== */}
          {effectiveParsedCommand && hasQuoteItems && quotePayload && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-slate-50/80 p-3.5 sm:p-4 space-y-3.5">
              {/* 상단: 감지된 견적 모드 및 요약 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border ${modeBadgeInfo.cls}`}
                  >
                    {modeBadgeInfo.label}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    {quotePayload.itemsSummary}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-slate-500">
                  카드: {effectiveParsedCommand.generalCardType}
                </span>
              </div>

              {/* 일반구매 계산 결과 요약 (일반 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'general' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primaryGenSummary.sum > 0 && (
                  <div className="rounded-2xl bg-white border border-blue-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        일반구매 매장 공식 수식 계산 결과
                      </span>
                      {quotePayload.primaryGenSummary.tierCashback > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black">
                          금액대 자동 캐시백{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.tierCashback
                          )}
                          원 적용
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          총 행사가 합계
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          {formatCurrency(quotePayload.primaryGenSummary.sum)}원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          즉시할인 + 하이프리드
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primaryGenSummary
                              .totalStep1InstantDiscount +
                              quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="text-[11px] font-extrabold text-blue-800">
                          실결제가 (결제부담금)
                        </div>
                        <div className="text-xs sm:text-sm font-black text-blue-700">
                          {formatCurrency(
                            quotePayload.primaryGenSummary.payPrice
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          최종 체감 혜택가
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          {formatCurrency(quotePayload.primaryGenSummary.rawNet)}원
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-600 flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                      <span>
                        • 즉시할인:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.instantDiscount
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.hiFreedSupport > 0 && (
                        <span className="text-indigo-700 font-black">
                          • 하이프리드({quotePayload.primaryGenSummary.comboLabel}): -
                          {formatCurrency(
                            quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </span>
                      )}
                      <span>
                        • 금액대 캐시백:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.tierCashback
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.extraCashback > 0 && (
                        <span>
                          • 추가 캐시백:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.extraCashback
                          )}
                          원
                        </span>
                      )}
                      {quotePayload.primaryGenSummary.earnedPoints > 0 && (
                        <span>
                          • L.POINT:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.earnedPoints
                          )}
                          P
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* 구독구매 계산 결과 요약 (구독 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'subscription' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primarySubSummary.totalBaseMonthly > 0 && (
                  <div className="rounded-2xl bg-white border border-rose-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-rose-600" />
                        구독구매 ({quotePayload.primarySubSummary.periodLabel}) 계산
                        결과
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black">
                        총 약정원금{' '}
                        {formatCurrency(
                          quotePayload.primarySubSummary.totalPrincipal
                        )}
                        원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          월 기본 구독료
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.totalBaseMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          제휴카드 월 할인
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.cardDiscount
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          구독플러스 월 지원
                        </div>
                        <div className="text-xs sm:text-sm font-black text-indigo-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.hiPlusMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          월 최종 체감 구독료
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.finalMonthlyFee
                          )}
                          원
                        </div>
                      </div>
                    </div>
                    {quotePayload.primarySubSummary.totalSubCashback > 0 && (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-extrabold text-emerald-800 flex items-center justify-between flex-wrap gap-1">
                        <span>
                          🎁 1회 입금 캐시백 합계: -
                          {formatCurrency(
                            quotePayload.primarySubSummary.totalSubCashback
                          )}
                          원 ➔ 최종 {quotePayload.primarySubSummary.periodLabel} 체감가{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.finalTotalFee
                          )}
                          원 반영
                        </span>
                        <span>
                          {quotePayload.primarySubSummary.subTierCashback > 0 &&
                            `금액대별 -${formatCurrency(
                              quotePayload.primarySubSummary.subTierCashback
                            )}원`}
                          {quotePayload.primarySubSummary.subTierCashback > 0 &&
                            quotePayload.primarySubSummary.subExtraCashback > 0 &&
                            ' · '}
                          {quotePayload.primarySubSummary.subExtraCashback > 0 &&
                            `추가 -${formatCurrency(
                              quotePayload.primarySubSummary.subExtraCashback
                            )}원`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              {/* 통합 고객관리(CRM) 즉시 연동 입력 폼 */}
              <div className="rounded-2xl bg-amber-50/70 border border-amber-300 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    👑 통합 고객관리(CRM) 저장 정보 (비어 있으면 바로 입력 가능)
                  </span>
                  {effectiveParsedCommand.customer.shouldSaveCrm && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      CRM 저장 감지됨
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      고객명 (필수)
                    </label>
                    <input
                      ref={customerNameInputRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      연락처
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) =>
                        setCustomerPhone(formatPhoneNumber(e.target.value))
                      }
                      placeholder="010-0000-0000"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      배송 예정일
                    </label>
                    <input
                      type="date"
                      value={customerDeliveryDate}
                      onChange={(e) => setCustomerDeliveryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      상담/결제 상태
                    </label>
                    <select
                      value={customerStatus}
                      onChange={(e) =>
                        setCustomerStatus(e.target.value as AiCustomerStatus)
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    >
                      <option value="상담진행중">상담진행중</option>
                      <option value="결제완료">결제완료</option>
                      <option value="배송대기">배송대기</option>
                      <option value="상담종료">상담종료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                    상담 메모 / 약속 사은품
                  </label>
                  <input
                    type="text"
                    value={customerMemo}
                    onChange={(e) => setCustomerMemo(e.target.value)}
                    placeholder="예: 금요일 오전 배송 요청, 냄비세트 사은품 약속"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                  />
                </div>
              </div>

              {/* [Generative UI] 기존 견적 대비 변경 전 ➔ 변경 후 비교 승인 카드 */}
              {previousQuotePayload && quotePayload && (
                <div className="rounded-2xl bg-indigo-950 text-white p-3.5 border border-indigo-400/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-amber-300">
                      ⚡ AI 변경 전 ➔ 변경 후 체감가 비교 프리뷰
                    </span>
                    <span className="text-[11px] text-indigo-200">
                      아래 버튼을 눌러야 실제 견적기에 반영됩니다
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-white/10 p-2.5">
                      <div className="text-[10px] text-indigo-200 font-bold">
                        변경 전 현재 견적
                      </div>
                      <div className="text-sm font-black font-mono mt-0.5">
                        {previousQuotePayload.primaryGenSummary.sum > 0 &&
                        previousQuotePayload.primarySubSummary.totalBaseMonthly > 0
                          ? `합산 ${formatCurrency(
                              previousQuotePayload.primaryGenSummary.rawNet +
                                previousQuotePayload.primarySubSummary.finalTotalFee
                            )}원`
                          : previousQuotePayload.primaryGenSummary.sum > 0
                          ? `체감 ${formatCurrency(previousQuotePayload.primaryGenSummary.rawNet)}원`
                          : `월 ${formatCurrency(
                              previousQuotePayload.primarySubSummary.finalMonthlyFee
                            )}원 (총 ${formatCurrency(
                              previousQuotePayload.primarySubSummary.finalTotalFee
                            )}원)`}
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-400/20 border border-amber-400/50 p-2.5">
                      <div className="text-[10px] text-amber-200 font-bold">
                        AI 적용 후 예상 견적
                      </div>
                      <div className="text-sm font-black font-mono text-amber-300 mt-0.5">
                        {quotePayload.primaryGenSummary.sum > 0 &&
                        quotePayload.primarySubSummary.totalBaseMonthly > 0
                          ? `합산 ${formatCurrency(
                              quotePayload.primaryGenSummary.rawNet +
                                quotePayload.primarySubSummary.finalTotalFee
                            )}원`
                          : quotePayload.primaryGenSummary.sum > 0
                          ? `체감 ${formatCurrency(quotePayload.primaryGenSummary.rawNet)}원`
                          : `월 ${formatCurrency(
                              quotePayload.primarySubSummary.finalMonthlyFee
                            )}원 (총 ${formatCurrency(
                              quotePayload.primarySubSummary.finalTotalFee
                            )}원)`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 하단 원클릭 실행 버튼 3종 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!generatedState) return;
                    if (commandText.trim()) {
                      setSessionHistory((prev) => [
                        commandText.trim(),
                        ...prev.filter((x) => x !== commandText.trim()),
                      ].slice(0, 6));
                    }
                    onApplyToQuote(generatedState, 'input');
                    onClose();
                  }}
                  className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>📝 조건 입력 화면에 채우기</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!generatedState) return;
                    if (commandText.trim()) {
                      setSessionHistory((prev) => [
                        commandText.trim(),
                        ...prev.filter((x) => x !== commandText.trim()),
                      ].slice(0, 6));
                    }
                    onApplyToQuote(generatedState, 'proposal');
                    onClose();
                  }}
                  className="py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>📄 제안서 바로 보기 (미리보기 직행)</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualSaveToCrm}
                  className="py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm border border-amber-500 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-slate-950 shrink-0" />
                  <span>👑 고객관리(CRM)에 즉시 저장 + 견적 반영</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
