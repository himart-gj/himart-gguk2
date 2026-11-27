import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudUpload,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import {
  CloudDiagnosticsReport,
  diagnoseStoreCloudConnection,
  extractGoogleSheetId,
  loadSavedSpreadsheetId,
  saveCloudSharedGeminiConfig,
  saveSpreadsheetId,
  SharedGeminiAdminState,
  StoreCloudKind,
  buildStaffAutoConnectUrl,
  clearStoreCloudMicroCache,
  deleteFriendRemoteProfile,
  fetchAllFriendRemoteProfiles,
  fetchFriendScheduleMap,
  fetchStoreCloudDataset,
  saveFriendSchedulePermission,
  FriendRemoteProfile,
  getStoreCloudAppsScriptCode,
  normalizeGasWebAppUrl,
  OWNER_CUSTOM_PIN_STORAGE_KEY,
  readRawSyncConfig,
  saveFriendRemoteProfile,
  saveStoreCloudDataset,
  STORE_CLOUD_UPDATED_EVENT,
  UNCONFIGURED_PIN_SENTINEL,
} from '../../utils/storeCloudSync';
import {
  buildFriendInviteUrl,
  fetchFriendInviteList,
  formatFriendInviteCode,
  FriendInviteItem,
  issueNewFriendInvite,
  mutateFriendInviteStatus,
} from '../../utils/friendAccessGuard';
import {
  ADMIN_MODE_CHANGED_EVENT,
  ADMIN_PIN_CODE,
  CARE_TABLE_UPDATED_EVENT,
  fetchRemoteCareDataset,
  isAdminDevice,
  loadLocalCareDataset,
  parseCareExcelBuffer,
  refreshAdminPinBinding,
  saveGitHubSyncConfig,
  saveLocalCareDataset,
  setAdminDeviceUnlocked,
} from '../../utils/careTableParser';
import {
  loadAllSchedules,
  parseScheduleFileForHub,
  saveAllSchedules,
  SCHEDULE_UPDATED_EVENT,
} from '../ScheduleModal';
import {
  downloadModelIncentiveExcelTemplate,
  getCurrentYearMonth,
  loadAllModelIncentiveSheets,
  mergeModelIncentiveRules,
  MODEL_INCENTIVE_UPDATED_EVENT,
  parseModelIncentiveExcelWithMeta,
  parseModelIncentiveImage,
  saveAllModelIncentiveSheets,
  stripPersonalLocalFromIncentiveMap,
} from '../../crm/utils/settlementEngine';
import { fetchRemoteModelIncentiveSheets } from '../../crm/utils/settlementSheetParser';
import { ModelIncentiveRule, ModelIncentivesMap } from '../../crm/types/crm';
import {
  DEFAULT_INSTALLMENT_DATASET,
  fetchRemoteInstallmentDataset,
  INSTALLMENT_UPDATED_EVENT,
  loadLocalInstallmentDataset,
  parseInstallmentFile,
  saveLocalInstallmentDataset,
} from '../../utils/installmentParser';
import { getStoredGeminiApiKey } from '../../utils/aiImageParser';
import { isOwnerMarketingDbUnlocked } from '../../utils/marketingDbEngine';

import { pruneSchedulesToRecent12Months, type StoredSchedulesMap } from '../StoreAdminUploadHubModal';

export function useStoreAdminDatasetHandlers(ctx: Record<string, any>) {
  const {
    incentiveYm,
    mergeIncentiveInMonth,
    pushDatasetToCloud,
    setIncentiveYm,
    setKindFeedback,
    showToastMessage,
  } = ctx;
  // ==================== 카드 ① 월간 근무·휴무표 핸들러 (과거 월 보존 + 최신 12개월 자동 정리 + 월별 삭제) ====================
  const handleScheduleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setKindFeedback('schedule', {
      status: 'working',
      message: `[${file.name}] 휴무표 분석 중...`,
    });
    try {
      const parsed = await parseScheduleFileForHub(file, getCurrentYearMonth());
      const pruned = pruneSchedulesToRecent12Months(parsed.nextSchedules);
      saveAllSchedules(pruned);
      const keptCount = Object.keys(pruned).length;
      await pushDatasetToCloud(
        'schedule',
        pruned,
        `${parsed.targetYearMonth} (${parsed.employeeCount}명 · 최근 ${keptCount}개월 보관)`
      );
    } catch (err: any) {
      const msg = err?.message || '휴무표 파일 분석 중 오류가 발생했습니다.';
      setKindFeedback('schedule', { status: 'error', message: msg });
      showToastMessage('error', `⚠️ ${msg}`);
    }
  };

  const handleScheduleResend = async () => {
    const pruned = pruneSchedulesToRecent12Months(loadAllSchedules());
    const monthKeys = Object.keys(pruned);
    if (monthKeys.length === 0) {
      showToastMessage('error', '현재 기기에 저장된 휴무표 데이터가 없습니다.');
      return;
    }
    saveAllSchedules(pruned);
    setKindFeedback('schedule', {
      status: 'working',
      message: '현재 기기 휴무표 시트 재전송 중...',
    });
    await pushDatasetToCloud(
      'schedule',
      pruned,
      `총 ${monthKeys.length}개월 휴무표 재전송`
    );
  };

  const handleDeleteScheduleMonth = async (targetYm: string) => {
    if (
      !window.confirm(
        `${targetYm} 휴무표를 내 기기와 비공개 구글 시트에서 삭제할까요?`
      )
    ) {
      return;
    }
    const current = loadAllSchedules();
    const next: StoredSchedulesMap = { ...current };
    delete next[targetYm];
    const pruned = pruneSchedulesToRecent12Months(next);
    saveAllSchedules(pruned);
    setKindFeedback('schedule', {
      status: 'working',
      message: `${targetYm} 휴무표 삭제 반영 중...`,
    });
    await pushDatasetToCloud(
      'schedule',
      pruned,
      `${targetYm} 삭제 완료 (남은 ${Object.keys(pruned).length}개월)`
    );
  };

  // ==================== 카드 ② 모델별 판매수당 단가표 핸들러 (단일 월 Clean Replace 기본 + 내 기기 개인 항목 보존) ====================
  const applyOfficialIncentiveUpload = (
    targetYm: string,
    incomingRawRules: ModelIncentiveRule[],
    sourceLabel: string,
    shouldMergeInMonth: boolean
  ): { officialPayload: ModelIncentivesMap; officialCount: number } => {
    // 업로드 파일의 규칙은 항상 순수 공식 항목(isPersonalLocal 없음)으로 정제
    const cleanIncoming: ModelIncentiveRule[] = incomingRawRules.map((r) => {
      const { isPersonalLocal: _omit, ...rest } = r;
      return rest;
    });

    const currentLocalMap = loadAllModelIncentiveSheets();
    const existingOfficialRules = (currentLocalMap[targetYm]?.rules || [])
      .filter((r) => !r.isPersonalLocal)
      .map((r) => {
        const { isPersonalLocal: _omit, ...rest } = r;
        return rest;
      });

    const officialRulesForTargetYm = shouldMergeInMonth
      ? mergeModelIncentiveRules(existingOfficialRules, cleanIncoming)
      : mergeModelIncentiveRules([], cleanIncoming);

    const nowIso = new Date().toISOString();
    // 구글 시트에는 선택한 단일 월의 순수 공식 단가표만 적재 (이전 월 공식 데이터 · 개인 항목 100% 제외)
    const officialPayload: ModelIncentivesMap = {
      [targetYm]: {
        yearMonth: targetYm,
        updatedAt: nowIso,
        sourceLabel,
        rules: officialRulesForTargetYm,
      },
    };

    // 내 기기 로컬은 새 공식 단가표로 교체하되, 내 기기 개인 추가 항목(isPersonalLocal === true)은 보존
    const nextLocalMap: ModelIncentivesMap = {};
    for (const [ym, sheet] of Object.entries(currentLocalMap)) {
      if (!sheet || !Array.isArray(sheet.rules)) continue;
      const personalOnly = sheet.rules.filter(
        (r) => r.isPersonalLocal === true
      );
      if (ym === targetYm) {
        nextLocalMap[ym] = {
          yearMonth: targetYm,
          updatedAt: nowIso,
          sourceLabel,
          rules:
            personalOnly.length > 0
              ? mergeModelIncentiveRules(officialRulesForTargetYm, personalOnly, {
                  allowZeroAmount: true,
                })
              : officialRulesForTargetYm,
        };
      } else if (personalOnly.length > 0) {
        nextLocalMap[ym] = {
          ...sheet,
          rules: personalOnly,
        };
      }
    }
    if (!nextLocalMap[targetYm]) {
      nextLocalMap[targetYm] = officialPayload[targetYm];
    }

    saveAllModelIncentiveSheets(nextLocalMap, { skipServerSync: true });
    return {
      officialPayload,
      officialCount: officialRulesForTargetYm.length,
    };
  };

  const handleIncentiveExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    e.target.value = '';
    if (files.length === 0) return;

    setKindFeedback('incentive', {
      status: 'working',
      message: `[${files[0].name}] 단가표 분석 중...`,
    });
    try {
      let targetYm = incentiveYm;
      const combinedRules: ModelIncentiveRule[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const meta = await parseModelIncentiveExcelWithMeta(file);
        if (meta.detectedYearMonth && i === 0) {
          targetYm = meta.detectedYearMonth;
          setIncentiveYm(targetYm);
        }
        combinedRules.push(...meta.rules);
      }
      if (combinedRules.length === 0) {
        throw new Error('엑셀 파일에서 유효한 모델 수당 정보를 찾지 못했습니다.');
      }
      const sourceLabel =
        files.length === 1
          ? files[0].name
          : `${files[0].name} 외 ${files.length - 1}건`;
      const { officialPayload, officialCount } = applyOfficialIncentiveUpload(
        targetYm,
        combinedRules,
        sourceLabel,
        mergeIncentiveInMonth
      );
      await pushDatasetToCloud(
        'incentive',
        officialPayload,
        `${targetYm} 공식 ${officialCount.toLocaleString()}개 모델 (${
          mergeIncentiveInMonth ? '당월 병합' : '클린 교체'
        })`
      );
    } catch (err: any) {
      const msg = err?.message || '수당 단가표 엑셀 분석에 실패했습니다.';
      setKindFeedback('incentive', { status: 'error', message: msg });
      showToastMessage('error', `⚠️ ${msg}`);
    }
  };

  const handleIncentivePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    e.target.value = '';
    if (files.length === 0) return;

    setKindFeedback('incentive', {
      status: 'working',
      message: `사진 ${files.length}장 AI 단가표 판독 중...`,
    });
    try {
      const mergedIncoming: ModelIncentiveRule[] = [];
      for (const file of files) {
        const rules = await parseModelIncentiveImage(file);
        mergedIncoming.push(...rules);
      }
      if (mergedIncoming.length === 0) {
        throw new Error('사진에서 유효한 모델 수당 정보를 추출하지 못했습니다.');
      }
      const { officialPayload, officialCount } = applyOfficialIncentiveUpload(
        incentiveYm,
        mergedIncoming,
        `사진 AI 인식 (${files.length}장)`,
        mergeIncentiveInMonth
      );
      await pushDatasetToCloud(
        'incentive',
        officialPayload,
        `${incentiveYm} 공식 ${officialCount.toLocaleString()}개 모델 (${
          mergeIncentiveInMonth ? '당월 병합' : '클린 교체'
        })`
      );
    } catch (err: any) {
      const msg = err?.message || '단가표 사진 인식에 실패했습니다.';
      setKindFeedback('incentive', { status: 'error', message: msg });
      showToastMessage('error', `⚠️ ${msg}`);
    }
  };

  const handleIncentiveResend = async () => {
    const officialMap = stripPersonalLocalFromIncentiveMap(
      loadAllModelIncentiveSheets()
    );
    const activeOfficialSheet = officialMap[incentiveYm];
    if (!activeOfficialSheet || activeOfficialSheet.rules.length === 0) {
      showToastMessage(
        'error',
        `선택한 ${incentiveYm}에 저장된 공식 모델 수당 단가표가 없습니다.`
      );
      return;
    }
    const singleMonthPayload: ModelIncentivesMap = {
      [incentiveYm]: activeOfficialSheet,
    };
    setKindFeedback('incentive', {
      status: 'working',
      message: `${incentiveYm} 공식 단가표 시트 재전송 중...`,
    });
    await pushDatasetToCloud(
      'incentive',
      singleMonthPayload,
      `${incentiveYm} 공식 ${activeOfficialSheet.rules.length.toLocaleString()}개 모델 재전송`
    );
  };

  // ==================== 카드 ③ 안심케어서비스 조견표 핸들러 (Clean Replace) ====================
  const handleCareExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setKindFeedback('care', {
      status: 'working',
      message: `[${file.name}] 조견표 파싱 중...`,
    });
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseCareExcelBuffer(buf, file.name);
      if (!parsed.items || parsed.items.length === 0) {
        throw new Error('조견표 엑셀에서 유효한 품목 코드를 찾지 못했습니다.');
      }
      saveLocalCareDataset(parsed);
      await pushDatasetToCloud(
        'care',
        parsed,
        `${parsed.items.length.toLocaleString()}개 코드 (클린 교체)`
      );
    } catch (err: any) {
      const msg = err?.message || '안심케어 조견표 분석에 실패했습니다.';
      setKindFeedback('care', { status: 'error', message: msg });
      showToastMessage('error', `⚠️ ${msg}`);
    }
  };

  const handleCareResend = async () => {
    const localCare = loadLocalCareDataset();
    if (!localCare || localCare.items.length === 0) {
      showToastMessage('error', '현재 기기에 저장된 안심케어 조견표가 없습니다.');
      return;
    }
    setKindFeedback('care', {
      status: 'working',
      message: '안심케어 조견표 시트 재전송 중...',
    });
    await pushDatasetToCloud(
      'care',
      localCare,
      `${localCare.items.length.toLocaleString()}개 코드 재전송`
    );
  };

  // ==================== 카드 ④ 카드 무이자할부 행사표 핸들러 (빈 초기 스키마 기반 Clean Replace) ====================
  const handleInstallmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setKindFeedback('installment', {
      status: 'working',
      message: `[${file.name}] 무이자 행사표 분석 중...`,
    });
    try {
      // 이전 월 잔재 문구·셀이 섞이지 않도록 빈 기본 구조(DEFAULT_INSTALLMENT_DATASET)에서 새로 파싱
      const updated = await parseInstallmentFile(
        file,
        DEFAULT_INSTALLMENT_DATASET
      );
      saveLocalInstallmentDataset(updated);
      await pushDatasetToCloud(
        'installment',
        updated,
        `${updated.versionTitle || '무이자 행사표'} (${updated.columns.length}개 카드 · 클린 교체)`
      );
    } catch (err: any) {
      const msg = err?.message || '무이자 할부 행사표 분석에 실패했습니다.';
      setKindFeedback('installment', { status: 'error', message: msg });
      showToastMessage('error', `⚠️ ${msg}`);
    }
  };

  const handleInstallmentResend = async () => {
    const localInst = loadLocalInstallmentDataset();
    if (localInst.columns.length === 0) {
      showToastMessage('error', '현재 기기에 저장된 무이자 할부 데이터가 없습니다.');
      return;
    }
    setKindFeedback('installment', {
      status: 'working',
      message: '무이자 할부 행사표 시트 재전송 중...',
    });
    await pushDatasetToCloud(
      'installment',
      localInst,
      `${localInst.columns.length}개 카드 재전송`
    );
  };


  return {
    handleScheduleFileUpload,
    handleScheduleResend,
    handleDeleteScheduleMonth,
    applyOfficialIncentiveUpload,
    handleIncentiveExcelUpload,
    handleIncentivePhotoUpload,
    handleIncentiveResend,
    handleCareExcelUpload,
    handleCareResend,
    handleInstallmentUpload,
    handleInstallmentResend,
  };
}
