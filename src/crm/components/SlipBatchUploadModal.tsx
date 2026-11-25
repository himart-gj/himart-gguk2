import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FilePlus2,
  ImagePlus,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';
import { FormattedMoneyInput } from '../../components/FormattedMoneyInput';
import {
  buildProposalStateFromHisisSlip,
  SubscriptionPeriod,
} from '../../types/proposal';
import {
  formatHisisPhoneNumber,
  getEffectiveGeminiApiKey,
  getStoredGeminiApiKey,
  inferCategoryFromModelCode,
  normalizeHisisSlipPayload,
  ParsedHisisSlipResult,
  parseHisisSlipImageWithFallback,
  rebuildParsedHisisSlipFromEdits,
  setStoredGeminiApiKey,
} from '../../utils/aiImageParser';
import { CustomerItem } from '../types/crm';
import {
  getCachedCustomers,
  normalizeNameKey,
  normalizeOrderNoKey,
  normalizePhoneKey,
  saveHisisSlipsBatch,
} from '../services/gasApi';
import { formatCurrency, getTodayStr } from '../utils/date';

export interface SlipBatchSavedSummary {
  customerCount: number;
  createdCustomerCount: number;
  mergedCustomerCount: number;
  totalSlipCount: number;
  overwrittenSlipCount: number;
  savedCustomerIds: string[];
}

interface SlipBatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  /** 특정 고객 상세 모달에서 [+ 이 고객에 전표 사진 추가]로 진입한 경우 */
  lockedCustomer?: CustomerItem | null;
  onSavedBatch: (summary: SlipBatchSavedSummary) => void;
}

interface SlipQueueEntry {
  queueId: string;
  file?: File;
  fileName: string;
  previewUrl?: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  errorMessage?: string;
  parsed?: ParsedHisisSlipResult;
}

function createManualBlankSlip(
  lockedCustomer?: CustomerItem | null
): ParsedHisisSlipResult {
  const today = getTodayStr();
  const base = normalizeHisisSlipPayload({
    receiptDate: today,
    receiptSeq: '',
    saleTypeHeader: '일반',
    customerName: lockedCustomer?.name || '',
    customerMobile: lockedCustomer?.phone || '',
    rows: [
      {
        seq: '01',
        productCode: '',
        category: '일반가전',
        quantity: 1,
        receiptAmount: 0,
        discountAmount: 0,
        actualPrice: 0,
        deliveryDate: '',
        outboundPlace: '타사물류',
        directDelivery: '타사직배',
      },
    ],
  });
  return {
    ...base,
    proposalState: buildProposalStateFromHisisSlip({
      mode: 'general',
      generalItems: base.generalItems,
    }),
  };
}

export const SlipBatchUploadModal: React.FC<SlipBatchUploadModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  lockedCustomer = null,
  onSavedBatch,
}) => {
  const [queue, setQueue] = useState<SlipQueueEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomPreviewUrl, setZoomPreviewUrl] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState<string>(() =>
    getStoredGeminiApiKey()
  );
  const [showApiKeyBox, setShowApiKeyBox] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parsingIdsRef = useRef<Set<string>>(new Set());

  const existingCustomers = useMemo(() => {
    if (!isOpen) return [];
    return getCachedCustomers().filter((c) => !c.deletedAt);
  }, [isOpen, queue.length]);

  useEffect(() => {
    if (!isOpen) {
      setQueue((prev) => {
        prev.forEach((entry) => {
          if (entry.previewUrl && entry.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(entry.previewUrl);
          }
        });
        return [];
      });
      parsingIdsRef.current.clear();
      setIsDragging(false);
      setIsSaving(false);
      setValidationError(null);
      setZoomPreviewUrl(null);
      setShowApiKeyBox(false);
    } else {
      setApiKeyInput(getStoredGeminiApiKey());
    }
  }, [isOpen]);

  const applyLockedCustomerDefaults = useCallback(
    (result: ParsedHisisSlipResult): ParsedHisisSlipResult => {
      if (!lockedCustomer) return result;
      return rebuildParsedHisisSlipFromEdits(result, {
        customerName: lockedCustomer.name,
        customerPhone: lockedCustomer.phone || result.customerPhone,
      });
    },
    [lockedCustomer]
  );

  // 대기 중인('pending') 항목들을 동시 최대 3장 병렬 워커로 자동 판독
  useEffect(() => {
    if (!isOpen) return;

    const activeParsingCount = queue.filter((q) => q.status === 'parsing').length;
    if (activeParsingCount >= 3) return;

    const availableSlots = 3 - activeParsingCount;
    const pendingTargets = queue
      .filter(
        (q) =>
          q.status === 'pending' &&
          Boolean(q.file) &&
          !parsingIdsRef.current.has(q.queueId)
      )
      .slice(0, availableSlots);

    if (pendingTargets.length === 0) return;

    pendingTargets.forEach((entry) => {
      parsingIdsRef.current.add(entry.queueId);
      setQueue((prev) =>
        prev.map((item) =>
          item.queueId === entry.queueId
            ? { ...item, status: 'parsing', errorMessage: undefined }
            : item
        )
      );

      parseHisisSlipImageWithFallback(entry.file!, apiKeyInput || undefined)
        .then((parsed) => {
          const finalParsed = applyLockedCustomerDefaults(parsed);
          setQueue((prev) =>
            prev.map((item) =>
              item.queueId === entry.queueId
                ? {
                    ...item,
                    status: 'done',
                    parsed: finalParsed,
                    errorMessage: undefined,
                  }
                : item
            )
          );
        })
        .catch((err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : 'HISIS 전표 이미지 판독에 실패했습니다.';
          if (msg.includes('키가 설정되어 있지 않습니다') || msg.includes('API')) {
            setShowApiKeyBox(true);
          }
          setQueue((prev) =>
            prev.map((item) =>
              item.queueId === entry.queueId
                ? {
                    ...item,
                    status: 'error',
                    errorMessage: msg,
                  }
                : item
            )
          );
        })
        .finally(() => {
          parsingIdsRef.current.delete(entry.queueId);
        });
    });
  }, [isOpen, queue, apiKeyInput, applyLockedCustomerDefaults]);

  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setValidationError(null);

    const newEntries: SlipQueueEntry[] = arr.map((file, idx) => ({
      queueId: `SLIP-Q-${Date.now()}-${idx}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      file,
      fileName: file.name || `전표사진_${idx + 1}.jpg`,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...newEntries]);
  }, []);

  // 모달 오픈 중 Ctrl+V 클립보드 이미지 연속 붙여넣기 지원
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        enqueueFiles(pastedFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, enqueueFiles]);

  const handleRemoveEntry = (queueId: string) => {
    setQueue((prev) => {
      const target = prev.find((p) => p.queueId === queueId);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.queueId !== queueId);
    });
  };

  const handleRetryEntry = (queueId: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.queueId === queueId && item.file
          ? { ...item, status: 'pending', errorMessage: undefined }
          : item
      )
    );
  };

  const handleRetryAllErrors = () => {
    if (apiKeyInput.trim()) {
      setStoredGeminiApiKey(apiKeyInput.trim());
    }
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'error' && item.file
          ? { ...item, status: 'pending', errorMessage: undefined }
          : item
      )
    );
  };

  const handleConvertErrorToManual = (queueId: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.queueId === queueId
          ? {
              ...item,
              status: 'done',
              errorMessage: undefined,
              parsed: createManualBlankSlip(lockedCustomer),
            }
          : item
      )
    );
  };

  const handleAddManualRow = () => {
    setValidationError(null);
    setQueue((prev) => [
      ...prev,
      {
        queueId: `SLIP-MAN-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        fileName: '수동 전표 입력',
        status: 'done',
        parsed: createManualBlankSlip(lockedCustomer),
      },
    ]);
  };

  const handleEditSlip = (
    queueId: string,
    patch: Parameters<typeof rebuildParsedHisisSlipFromEdits>[1]
  ) => {
    setValidationError(null);
    setQueue((prev) =>
      prev.map((item) => {
        if (item.queueId !== queueId || !item.parsed) return item;
        return {
          ...item,
          parsed: rebuildParsedHisisSlipFromEdits(item.parsed, patch),
        };
      })
    );
  };

  const stats = useMemo(() => {
    const total = queue.length;
    const finished = queue.filter(
      (q) => q.status === 'done' || q.status === 'error'
    ).length;
    const doneEntries = queue.filter((q) => q.status === 'done' && q.parsed);
    const parsingCount = queue.filter(
      (q) => q.status === 'parsing' || q.status === 'pending'
    ).length;
    const errorCount = queue.filter((q) => q.status === 'error').length;
    return { total, finished, doneEntries, parsingCount, errorCount };
  }, [queue]);

  // 동일 고객(이름 + 연락처 숫자 일치) 자동 그룹핑 뷰 데이터
  const customerGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupKey: string;
        displayName: string;
        displayPhone: string;
        entries: SlipQueueEntry[];
        matchedExistingCustomer: CustomerItem | null;
        genCount: number;
        subCount: number;
        combinedPerformance: number;
      }
    >();

    for (const entry of stats.doneEntries) {
      const p = entry.parsed!;
      const nameNorm = normalizeNameKey(p.customerName);
      const phoneNorm = normalizePhoneKey(p.customerPhone);
      const groupKey = lockedCustomer
        ? `LOCKED__${lockedCustomer.id}`
        : nameNorm
        ? `${nameNorm}__${phoneNorm}`
        : `UNIDENTIFIED__${entry.queueId}`;

      const matchedExisting = lockedCustomer
        ? lockedCustomer
        : nameNorm
        ? existingCustomers.find((c) => {
            const cName = normalizeNameKey(c.name);
            const cPhone = normalizePhoneKey(c.phone);
            if (nameNorm && phoneNorm) {
              return cName === nameNorm && cPhone === phoneNorm;
            }
            return cName === nameNorm && cPhone === '';
          }) || null
        : null;

      const existingGroup = groupsMap.get(groupKey);
      if (!existingGroup) {
        groupsMap.set(groupKey, {
          groupKey,
          displayName: p.customerName.trim() || '고객명 미입력',
          displayPhone: p.customerPhone.trim(),
          entries: [entry],
          matchedExistingCustomer: matchedExisting,
          genCount: p.quoteMode === 'general' ? 1 : 0,
          subCount: p.quoteMode === 'subscription' ? 1 : 0,
          combinedPerformance: p.performanceAmount,
        });
      } else {
        existingGroup.entries.push(entry);
        if (p.quoteMode === 'general') existingGroup.genCount += 1;
        else existingGroup.subCount += 1;
        existingGroup.combinedPerformance += p.performanceAmount;
      }
    }

    return Array.from(groupsMap.values());
  }, [stats.doneEntries, existingCustomers, lockedCustomer]);

  const handleBatchSave = async () => {
    if (stats.doneEntries.length === 0) return;

    const missingNameEntry = stats.doneEntries.find(
      (e) => !e.parsed?.customerName.trim()
    );
    if (missingNameEntry) {
      setValidationError(
        '⚠️ 고객명이 비어 있는 전표가 있습니다. 강조 표시된 고객명 칸을 입력한 뒤 저장해 주세요.'
      );
      return;
    }

    setIsSaving(true);
    setValidationError(null);
    try {
      const slipsToSave = stats.doneEntries.map((e) => e.parsed!);
      const summary = await saveHisisSlipsBatch(slipsToSave, {
        targetCustomerId: lockedCustomer?.id,
      });
      onSavedBatch(summary);
      onClose();
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error
          ? err.message
          : '전표 일괄 저장 중 오류가 발생했습니다.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasEffectiveKey = Boolean(getEffectiveGeminiApiKey(apiKeyInput));

  return (
    <FlagshipModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        lockedCustomer
          ? `${lockedCustomer.name} 고객님 전표 사진 추가 등록`
          : 'HISIS 판매접수 전표 사진 다중 자동등록'
      }
      badge={
        stats.total > 0
          ? `${stats.finished}/${stats.total}장 판독`
          : '여러 장 동시 지원'
      }
      subtitle="전표 사진 여러 장을 한 번에 올리면 AI가 전표번호·고객(불명→인수자 자동대체)·일반/구독 견적서·배송상태를 자동 분류하고 동일 고객은 하나로 묶어 저장합니다"
      icon={<Camera className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
      maxWidthClass="max-w-4xl"
      bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#F2F4F6] dark:bg-[#0B1120]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-[#4E5968] dark:text-slate-400">
            {customerGroups.length > 0 ? (
              <span>
                총{' '}
                <strong className="text-[#191F28] dark:text-white font-mono">
                  {customerGroups.length}명
                </strong>{' '}
                고객 ·{' '}
                <strong className="text-[#1B64DA] dark:text-blue-400 font-mono">
                  {stats.doneEntries.length}건
                </strong>{' '}
                전표 및 견적서 생성 준비됨
              </span>
            ) : (
              <span>사진 선택 · 드래그앤드롭 · Ctrl+V 붙여넣기 모두 가능</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl text-xs font-extrabold border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-200 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={
                stats.doneEntries.length === 0 ||
                stats.parsingCount > 0 ||
                isSaving
              }
              onClick={handleBatchSave}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-45 disabled:cursor-not-allowed text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Save className="w-4 h-4 shrink-0" />
              )}
              <span>
                총 {customerGroups.length}명 고객 · {stats.doneEntries.length}건
                전표 일괄 저장
              </span>
            </button>
          </div>
        </div>
      }
    >
      <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
        {/* 특정 고객 고정 배너 */}
        {lockedCustomer && (
          <div className="rounded-2xl px-3.5 py-2.5 bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-[#1B64DA] dark:text-blue-300">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>
                [{lockedCustomer.name}] ({lockedCustomer.phone || '연락처 미등록'})
                고객 카드에 확정 전표를 누적 추가합니다.
              </span>
            </div>
            <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300">
              현재 보관함 {lockedCustomer.quotes?.length || 0}/30건
            </span>
          </div>
        )}

        {/* API 키 빠른 설정 바 (초기 미설정 · 키 오류 · 수동 열기 시 표시, 정상 판독 완료 시 자동 접힘) */}
        {((!hasEffectiveKey && (queue.length === 0 || stats.errorCount > 0)) ||
          showApiKeyBox) && (
          <div className="rounded-2xl p-3 bg-white dark:bg-[#131C2E] border border-amber-300 dark:border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>Gemini API 키 설정 (브라우저 내 안전 저장)</span>
              </span>
              {(hasEffectiveKey || showApiKeyBox) && (
                <button
                  type="button"
                  onClick={() => setShowApiKeyBox(false)}
                  className="text-[11.5px] font-bold text-[#8B95A1] hover:text-[#191F28] dark:hover:text-white cursor-pointer"
                >
                  접기
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza... 로 시작하는 Gemini API 키 붙여넣기"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono text-[#191F28] dark:text-white"
              />
              <button
                type="button"
                onClick={() => {
                  setStoredGeminiApiKey(apiKeyInput);
                  setShowApiKeyBox(false);
                  handleRetryAllErrors();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-xs font-extrabold cursor-pointer shrink-0 whitespace-nowrap"
              >
                키 저장 및 판독 재시도
              </button>
            </div>
          </div>
        )}

        {/* 숨김 파일 인풋 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              enqueueFiles(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {/* 드래그 앤 드롭 & 다중 추가 컨트롤 바 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              enqueueFiles(e.dataTransfer.files);
            }
          }}
          className={`rounded-[20px] border-2 border-dashed transition p-4 ${
            isDragging
              ? 'border-[#1B64DA] bg-[#EFF6FF] dark:bg-blue-500/15'
              : isDark
              ? 'border-slate-700 bg-[#131C2E]'
              : 'border-[#D1D6DB] bg-white'
          }`}
        >
          {queue.length === 0 ? (
            <div className="py-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center mx-auto">
                <ImagePlus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-100">
                  HISIS [판매접수등록] 전산 사진을 여러 장 올려주세요
                </h3>
                <p className="text-xs text-[#4E5968] dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  일반구매 · 구독(SET-CARD 36/60) · 불명고객(인수자 자동대체) ·
                  자송/물류 상태를 자동으로 읽고, 같은 고객의 여러 전표는 한 고객
                  카드에 통합합니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>전표 사진 여러 장 선택</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-3.5 py-2.5 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-xs font-extrabold text-[#4E5968] dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>빈 전표 직접 입력</span>
                </button>
              </div>
              <p className="text-[11.5px] font-semibold text-[#8B95A1] dark:text-slate-500">
                팁: PC/태블릿에서는 캡처 후 Ctrl+V로 연속 붙여넣기나 파일 드래그 앤
                드롭도 가능합니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {stats.parsingCount > 0 ? (
                  <Loader2 className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0" />
                )}
                <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
                  {stats.parsingCount > 0
                    ? `AI 병렬 판독 진행 중 (${stats.finished} / ${stats.total}장 완료)`
                    : `총 ${stats.total}장 판독 완료 (성공 ${stats.doneEntries.length}건${
                        stats.errorCount > 0 ? ` · 확인필요 ${stats.errorCount}건` : ''
                      })`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>+ 사진 더 추가</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-xs font-bold text-[#4E5968] dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>+ 수동 행 추가</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKeyBox((v) => !v)}
                  className="p-1.5 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 cursor-pointer"
                  title="Gemini API 키 변경"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 판독 대기/진행/오류 중인 항목 스트립 */}
        {queue.some((q) => q.status !== 'done') && (
          <div className="space-y-2">
            {queue
              .filter((q) => q.status !== 'done')
              .map((entry) => (
                <div
                  key={entry.queueId}
                  className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${
                    entry.status === 'error'
                      ? 'bg-[#FFF1F2] dark:bg-rose-950/30 border-[#FECDD3] dark:border-rose-500/40'
                      : 'bg-white dark:bg-[#131C2E] border-[#E5E8EB] dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {entry.previewUrl && (
                      <img
                        src={entry.previewUrl}
                        alt={entry.fileName}
                        onClick={() => setZoomPreviewUrl(entry.previewUrl!)}
                        className="w-12 h-12 rounded-xl object-cover border border-[#E5E8EB] dark:border-slate-700 shrink-0 cursor-pointer"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate text-[#191F28] dark:text-slate-100">
                        {entry.fileName}
                      </div>
                      {entry.status === 'error' ? (
                        <p className="text-[11.5px] font-bold text-[#E60012] dark:text-rose-300 mt-0.5">
                          {entry.errorMessage}
                        </p>
                      ) : (
                        <p className="text-[11.5px] font-semibold text-[#1B64DA] dark:text-blue-400 mt-0.5 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>
                            {entry.status === 'parsing'
                              ? 'AI가 전표번호·품목·출고지를 정밀 분석 중...'
                              : '판독 대기열 준비 중...'}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {entry.status === 'error' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRetryEntry(entry.queueId)}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[11.5px] font-extrabold text-[#191F28] dark:text-slate-100 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>재시도</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConvertErrorToManual(entry.queueId)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-[11.5px] font-extrabold cursor-pointer"
                        >
                          수동입력 전환
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(entry.queueId)}
                      className="p-1.5 rounded-lg text-[#8B95A1] hover:text-[#E60012] cursor-pointer"
                      title="제거"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {validationError && (
          <div className="rounded-2xl px-3.5 py-2.5 bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/40 text-xs font-extrabold text-[#E60012] dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 고객별 자동 묶음 검수 카드 리스트 */}
        {customerGroups.map((group) => {
          const slipCount = group.entries.length;
          const isMulti = slipCount >= 2;
          const modeSummaryLabel =
            group.genCount > 0 && group.subCount > 0
              ? `일반 ${group.genCount}건 + 구독 ${group.subCount}건 → 혼합 자동 통합`
              : group.subCount > 0
              ? `구독 ${group.subCount}건${isMulti ? ' 자동 합산' : ''}`
              : `일반 ${group.genCount}건${isMulti ? ' 자동 합산' : ''}`;

          return (
            <div
              key={group.groupKey}
              className="rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 bg-white dark:bg-[#131C2E] overflow-hidden shadow-2xs"
            >
              {/* 고객 그룹 헤더 */}
              <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-slate-900/80 border-b border-[#E5E8EB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#191F28] dark:bg-slate-800 text-white text-xs font-extrabold">
                    <Users className="w-3.5 h-3.5 text-[#60A5FA]" />
                    <span>{group.displayName}</span>
                    {group.displayPhone && (
                      <span className="font-mono font-normal opacity-80">
                        ({group.displayPhone})
                      </span>
                    )}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30">
                    {isMulti
                      ? `총 ${slipCount}건 전표 묶음 저장 (${modeSummaryLabel})`
                      : `전표 1건 (${modeSummaryLabel})`}
                  </span>

                  {group.matchedExistingCustomer ? (
                    <span className="px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                      기존 고객 카드에 통합됨
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11.5px] font-bold bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300">
                      신규 고객 생성
                    </span>
                  )}
                </div>

                <div className="text-xs font-extrabold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                  통합 실적 {formatCurrency(group.combinedPerformance)}원
                </div>
              </div>

              {/* 그룹 내 개별 전표 인라인 검수 카드 */}
              <div className="divide-y divide-[#E5E8EB] dark:divide-slate-800">
                {group.entries.map((entry, idx) => {
                  const slip = entry.parsed!;
                  const isDuplicateOrderInCrm = Boolean(
                    slip.orderNo &&
                      group.matchedExistingCustomer?.quotes?.some(
                        (q) =>
                          normalizeOrderNoKey(q.orderNo) ===
                          normalizeOrderNoKey(slip.orderNo)
                      )
                  );
                  const firstCode = slip.modelCodesSummary
                    .split(',')[0]
                    ?.replace(/[×xX*]\d+$/, '')
                    .trim();
                  const inferredCat = firstCode
                    ? inferCategoryFromModelCode(firstCode)
                    : '';

                  const modeSelectValue =
                    slip.quoteMode === 'subscription'
                      ? `sub-${slip.subscriptionPeriod}`
                      : 'general';

                  return (
                    <div key={entry.queueId} className="p-3.5 sm:p-4 space-y-3">
                      {/* 상단 행: 전표 순번 · 원본 썸네일 · 자동 판별 배지 · 삭제 */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.previewUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomPreviewUrl(entry.previewUrl!)}
                              className="relative group/thumb w-10 h-10 rounded-lg overflow-hidden border border-[#D1D6DB] dark:border-slate-700 shrink-0 cursor-pointer"
                              title="전표 원본 사진 크게 보기"
                            >
                              <img
                                src={entry.previewUrl}
                                alt="전표 썸네일"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          )}

                          <span className="px-2 py-0.5 rounded-md text-[11.5px] font-black bg-[#191F28] dark:bg-slate-800 text-white font-mono">
                            전표 #{idx + 1}
                          </span>

                          {slip.usedRecipientFallback && (
                            <span className="px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                              불명→인수자 자동대체됨
                            </span>
                          )}

                          {slip.needsManualIdentity && (
                            <span className="px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-[#E60012] text-white">
                              고객명 직접 입력 필요
                            </span>
                          )}

                          {isDuplicateOrderInCrm && (
                            <span className="px-2 py-0.5 rounded-full text-[11.5px] font-extrabold bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30">
                              동일 전표번호 덮어쓰기 업데이트
                            </span>
                          )}

                          {inferredCat && inferredCat !== '가전품목' && (
                            <span className="px-2 py-0.5 rounded-full text-[11.5px] font-bold bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300">
                              {inferredCat}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(entry.queueId)}
                          className="p-1.5 rounded-lg text-[#8B95A1] hover:text-[#E60012] hover:bg-[#FFF1F2] dark:hover:bg-rose-500/15 cursor-pointer"
                          title="이 전표 제외"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 인라인 수정 필드 그리드 (모바일 1~2열 · 데스크톱 4열) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            전표번호 (접수일+순번)
                          </label>
                          <input
                            type="text"
                            value={slip.orderNo}
                            onChange={(e) =>
                              handleEditSlip(entry.queueId, {
                                orderNo: e.target.value,
                              })
                            }
                            placeholder="20261125-0011"
                            className="w-full px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            고객명 {slip.needsManualIdentity && '*'}
                          </label>
                          <input
                            type="text"
                            value={slip.customerName}
                            onChange={(e) =>
                              handleEditSlip(entry.queueId, {
                                customerName: e.target.value,
                              })
                            }
                            placeholder="홍길동"
                            className={`w-full px-2.5 py-2 rounded-xl border text-base sm:text-xs font-bold ${
                              !slip.customerName.trim()
                                ? 'border-[#E60012] bg-[#FFF1F2] dark:bg-rose-950/30 text-[#191F28] dark:text-white ring-2 ring-[#E60012]/25'
                                : 'border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-[#191F28] dark:text-slate-100'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            연락처
                          </label>
                          <input
                            type="tel"
                            value={slip.customerPhone}
                            onChange={(e) =>
                              handleEditSlip(entry.queueId, {
                                customerPhone: formatHisisPhoneNumber(
                                  e.target.value
                                ),
                              })
                            }
                            placeholder="010-0000-0000"
                            className="w-full px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-semibold text-[#191F28] dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            구매유형 (일반 / 구독)
                          </label>
                          <select
                            value={modeSelectValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'general') {
                                handleEditSlip(entry.queueId, {
                                  quoteMode: 'general',
                                });
                              } else {
                                const per = Number(
                                  val.replace('sub-', '')
                                ) as SubscriptionPeriod;
                                handleEditSlip(entry.queueId, {
                                  quoteMode: 'subscription',
                                  subscriptionPeriod: per,
                                });
                              }
                            }}
                            className="w-full px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-extrabold text-[#191F28] dark:text-slate-100"
                          >
                            <option value="general">일반구매</option>
                            <option value="sub-36">구독 36개월 (SET-CARD36)</option>
                            <option value="sub-48">구독 48개월 (SET-CARD48)</option>
                            <option value="sub-60">구독 60개월 (SET-CARD60)</option>
                          </select>
                        </div>
                      </div>

                      {/* 2행: 상품코드 · 금액(실구매가 또는 구독원금/월구독료) · 배달일자 · 출고상태 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            상품코드 (쉼표로 다품목 구분)
                          </label>
                          <input
                            type="text"
                            value={slip.modelCodesSummary}
                            onChange={(e) =>
                              handleEditSlip(entry.queueId, {
                                modelCodesSummary: e.target.value,
                              })
                            }
                            placeholder="예: DDLP22AGSTE1"
                            className="w-full px-2.5 py-2 rounded-xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100"
                          />
                        </div>

                        {slip.quoteMode === 'subscription' ? (
                          <div>
                            <label className="block text-[11.5px] font-bold text-[#E60012] dark:text-rose-300 mb-1">
                              신용카드 결제액 · 월 {formatCurrency(slip.monthlyFeeTotal)}원
                            </label>
                            <FormattedMoneyInput
                              value={slip.actualPurchaseAmount || ''}
                              onValueChange={(num) =>
                                handleEditSlip(entry.queueId, {
                                  actualPurchaseAmount: num,
                                })
                              }
                              placeholder="하단 신용카드 결제금액"
                              className="w-full px-2.5 py-2 rounded-xl border border-[#FECDD3] dark:border-rose-500/40 bg-[#FFF1F2]/40 dark:bg-slate-900 sm:text-xs font-mono font-black text-[#191F28] dark:text-slate-100"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11.5px] font-bold text-[#059669] dark:text-emerald-300 mb-1">
                              실구매가 합계 (원)
                            </label>
                            <FormattedMoneyInput
                              value={slip.actualPurchaseAmount || ''}
                              onValueChange={(num) =>
                                handleEditSlip(entry.queueId, {
                                  actualPurchaseAmount: num,
                                })
                              }
                              placeholder="1,190,000"
                              className="w-full px-2.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-slate-900 sm:text-xs font-mono font-black text-[#191F28] dark:text-slate-100"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 mb-1">
                            배달일자 (실판 기준일)
                          </label>
                          <input
                            type="date"
                            value={slip.deliveryDate}
                            onChange={(e) =>
                              handleEditSlip(entry.queueId, {
                                deliveryDate: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-2 rounded-xl border border-[#BFDBFE] dark:border-blue-500/40 bg-[#F8FAFC] dark:bg-slate-900 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                            출고·물류상태 ({slip.outboundLabel || '자동판별'})
                          </label>
                          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-[#F2F4F6] dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() =>
                                handleEditSlip(entry.queueId, {
                                  deliveryStatus: '배송대기',
                                  logisticsConfirmed: false,
                                })
                              }
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap ${
                                slip.deliveryStatus !== '배송완료' &&
                                !slip.logisticsConfirmed
                                  ? 'bg-[#1B64DA] text-white shadow-2xs'
                                  : 'text-[#4E5968] dark:text-slate-400'
                              }`}
                            >
                              <Truck className="w-3 h-3 shrink-0" />
                              <span>물류대기</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditSlip(entry.queueId, {
                                  deliveryStatus: '배송대기',
                                  logisticsConfirmed: true,
                                })
                              }
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap ${
                                slip.deliveryStatus !== '배송완료' &&
                                slip.logisticsConfirmed
                                  ? 'bg-[#059669] text-white shadow-2xs'
                                  : 'text-[#4E5968] dark:text-slate-400'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>물류확정</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditSlip(entry.queueId, {
                                  deliveryStatus: '배송완료',
                                  logisticsConfirmed: true,
                                })
                              }
                              className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap ${
                                slip.deliveryStatus === '배송완료'
                                  ? 'bg-emerald-700 text-white shadow-2xs'
                                  : 'text-[#4E5968] dark:text-slate-400'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>자송완료</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 원본 사진 확대 라이트박스 */}
      {zoomPreviewUrl && (
        <div
          onClick={() => setZoomPreviewUrl(null)}
          className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[88dvh] bg-[#0B1120] rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setZoomPreviewUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomPreviewUrl}
              alt="HISIS 전표 원본 확대"
              className="max-w-full max-h-[85dvh] object-contain"
            />
          </div>
        </div>
      )}
    </FlagshipModalShell>
  );
};
