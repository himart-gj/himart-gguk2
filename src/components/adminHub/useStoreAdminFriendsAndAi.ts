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
  fetchFriendNoticesMap,
  fetchFriendScheduleMap,
  fetchStoreCloudDataset,
  saveFriendOneTimeNotice,
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


export function useStoreAdminFriendsAndAi(ctx: Record<string, any>) {
  const {
    busyInviteCodeId,
    editProfileDraft,
    editingNoticeCodeId,
    editingProfileCodeId,
    friendNoticesMap,
    friendLabelInput,
    friendRemoteProfiles,
    friendScheduleMap,
    gasUrl,
    isIssuingInvite,
    isSavingFriendNotice,
    isSavingRemoteProfile,
    noticeDraftText,
    isSavingSharedAi,
    newFriendMaxDevices,
    newFriendNameInput,
    newFriendPhoneInput,
    newFriendStoreInput,
    resolveActiveCloudAuth,
    setBusyInviteCodeId,
    setCloudDiag,
    setCopiedInviteCodeId,
    setEditProfileDraft,
    setEditingNoticeCodeId,
    setEditingProfileCodeId,
    setFriendNoticesMap,
    setFriendInvites,
    setFriendPanelError,
    setFriendRemoteProfiles,
    setFriendScheduleMap,
    setIsFriendListCollapsed,
    setIsIssuingInvite,
    setIsLoadingInvites,
    setIsSavingFriendNotice,
    setIsSavingRemoteProfile,
    setNoticeDraftText,
    setIsSavingSharedAi,
    setNeedsSheetBinding,
    setNewFriendNameInput,
    setNewFriendPhoneInput,
    setNewFriendStoreInput,
    setSharedAiState,
    setSharedKeyDraft,
    sharedAiState,
    sharedKeyDraft,
    showToastMessage,
  } = ctx;
  const handleSaveSharedAiKey = async (useLocalStoredKey = false) => {
    if (isSavingSharedAi) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const candidate = useLocalStoredKey
      ? getStoredGeminiApiKey()
      : sharedKeyDraft.trim();
    if (!candidate || candidate.length < 15) {
      showToastMessage(
        'error',
        useLocalStoredKey
          ? '현재 기기에 저장된 Gemini API 키가 없습니다. 우측 입력칸에 AIzaSy... 키를 직접 붙여넣어 주세요.'
          : '올바른 Gemini API 키(AIzaSy... 형태)를 입력해 주세요.'
      );
      return;
    }

    setIsSavingSharedAi(true);
    setFriendPanelError(null);
    try {
      const res = await saveCloudSharedGeminiConfig(auth.url, auth.pin, {
        apiKey: candidate,
        globalEnabled: true,
        spreadsheetId: auth.sid,
      });
      if (!res.ok) {
        const msg = res.error || '공유 API 키 저장에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (res.sharedAi) {
        setSharedAiState(res.sharedAi);
      }
      setSharedKeyDraft('');
      showToastMessage(
        'success',
        '🤖 내 Gemini API 키 공유 등록 및 [전체 공유 ON] 활성화 완료! 허용된 초대 친구 기기에서 키 노출 없이 AI 기능을 함께 사용할 수 있습니다.'
      );
    } finally {
      setIsSavingSharedAi(false);
    }
  };

  const handleToggleGlobalSharedAi = async () => {
    if (isSavingSharedAi) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    if (!sharedAiState.hasSharedKey && !sharedAiState.globalEnabled) {
      const localKey = getStoredGeminiApiKey();
      if (localKey && localKey.length >= 15) {
        await handleSaveSharedAiKey(true);
        return;
      }
      showToastMessage(
        'error',
        '먼저 아래에서 공유할 Gemini API 키를 등록하거나 [내 기기 API 키 바로 연동]을 눌러주세요.'
      );
      return;
    }

    const nextEnabled = !sharedAiState.globalEnabled;
    setIsSavingSharedAi(true);
    setFriendPanelError(null);
    try {
      const res = await saveCloudSharedGeminiConfig(auth.url, auth.pin, {
        globalEnabled: nextEnabled,
        spreadsheetId: auth.sid,
      });
      if (!res.ok) {
        const msg = res.error || '공유 상태 변경에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (res.sharedAi) {
        setSharedAiState(res.sharedAi);
      }
      showToastMessage(
        nextEnabled ? 'success' : 'info',
        nextEnabled
          ? '🟢 초대 친구 API 키 [전체 공유 ON] 활성화! 허용된 친구 기기에서 즉시 AI 기능을 사용할 수 있습니다.'
          : '⚪ 초대 친구 API 키 [전체 공유 OFF] 전환됨! 모든 초대 친구 기기에서 내 API 키 사용이 즉시 중지됩니다.'
      );
    } finally {
      setIsSavingSharedAi(false);
    }
  };

  const handleClearSharedAiKey = async () => {
    if (isSavingSharedAi || !sharedAiState.hasSharedKey) return;
    if (
      !window.confirm(
        '서버에 등록된 공유용 Gemini API 키를 완전히 삭제하고 공유를 OFF 할까요?\n(본인 기기에 저장된 개인 API 키는 유지됩니다.)'
      )
    ) {
      return;
    }
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    setIsSavingSharedAi(true);
    try {
      const res = await saveCloudSharedGeminiConfig(auth.url, auth.pin, {
        clearKey: true,
        spreadsheetId: auth.sid,
      });
      if (res.ok && res.sharedAi) {
        setSharedAiState(res.sharedAi);
        showToastMessage(
          'info',
          '🗑️ 공유용 API 키가 서버에서 완전히 삭제되었으며 친구 공유가 OFF 되었습니다.'
        );
      } else if (res.error) {
        showToastMessage('error', `⚠️ ${res.error}`);
      }
    } finally {
      setIsSavingSharedAi(false);
    }
  };

  const handleToggleFriendAiAllowed = async (item: FriendInviteItem) => {
    if (busyInviteCodeId || isSavingSharedAi) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const currentAllowed =
      sharedAiState.friendAiMap[item.codeId] !== undefined
        ? sharedAiState.friendAiMap[item.codeId] !== false
        : item.aiAllowed !== false;
    const nextAllowed = !currentAllowed;

    setBusyInviteCodeId(item.codeId);
    setFriendPanelError(null);
    try {
      const res = await saveCloudSharedGeminiConfig(auth.url, auth.pin, {
        friendCodeId: item.codeId,
        friendAiAllowed: nextAllowed,
        spreadsheetId: auth.sid,
      });
      if (!res.ok) {
        const msg = res.error || '개별 친구 AI 공유 설정 변경에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (res.sharedAi) {
        setSharedAiState(res.sharedAi);
      }
      setFriendInvites((prev) =>
        prev.map((f) =>
          f.codeId === item.codeId ? { ...f, aiAllowed: nextAllowed } : f
        )
      );
      showToastMessage(
        nextAllowed ? 'success' : 'info',
        nextAllowed
          ? `🤖 [${item.label}] 내 API 키 함께 쓰기 [ON] 허용됨`
          : `🔒 [${item.label}] 내 API 키 함께 쓰기 [OFF] 차단됨 (해당 친구는 본인 API 키만 사용 가능)`
      );
    } finally {
      setBusyInviteCodeId(null);
    }
  };

  const handleToggleFriendScheduleAllowed = async (item: FriendInviteItem) => {
    if (busyInviteCodeId || isSavingSharedAi) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const currentAllowed =
      friendScheduleMap[item.codeId] !== undefined
        ? friendScheduleMap[item.codeId] === true
        : item.scheduleAllowed === true;
    const nextAllowed = !currentAllowed;

    setBusyInviteCodeId(item.codeId);
    setFriendPanelError(null);
    try {
      const res = await saveFriendSchedulePermission(
        auth.url,
        auth.pin,
        item.codeId,
        nextAllowed,
        auth.sid
      );
      if (!res.ok) {
        setFriendPanelError(res.message);
        showToastMessage('error', `⚠️ ${res.message}`);
        return;
      }
      if (res.scheduleMap) {
        setFriendScheduleMap(res.scheduleMap);
      } else {
        setFriendScheduleMap((prev) => ({ ...prev, [item.codeId]: nextAllowed }));
      }
      setFriendInvites((prev) =>
        prev.map((f) =>
          f.codeId === item.codeId ? { ...f, scheduleAllowed: nextAllowed } : f
        )
      );
      showToastMessage(
        nextAllowed ? 'success' : 'info',
        nextAllowed
          ? `📅 [${item.label}] 경기광주점 휴무표 공유 [ON] 허용됨 (열람 전용으로 반영됩니다)`
          : `🔒 [${item.label}] 경기광주점 휴무표 공유 [OFF] 해제됨 (해당 기기에서 휴무표가 즉시 숨겨집니다)`
      );
    } finally {
      setBusyInviteCodeId(null);
    }
  };

  const handleRefreshFriendInvites = async () => {
    const auth = resolveActiveCloudAuth();
    if (!auth) return;
    setIsLoadingInvites(true);
    setFriendPanelError(null);
    try {
      const [res, remoteMap, schedMap, noticesMap, diag] = await Promise.all([
        fetchFriendInviteList(auth.url, auth.pin, auth.sid),
        fetchAllFriendRemoteProfiles(auth.url),
        fetchFriendScheduleMap(auth.url),
        fetchFriendNoticesMap(auth.url),
        diagnoseStoreCloudConnection(auth.url, auth.pin, auth.sid),
      ]);
      setFriendRemoteProfiles(remoteMap || {});
      setFriendScheduleMap(schedMap || {});
      setFriendNoticesMap(noticesMap || {});
      setCloudDiag(diag);
      if (diag.ok) {
        setNeedsSheetBinding(false);
        if (diag.sharedAi) setSharedAiState(diag.sharedAi);
      } else if (diag.needsSpreadsheetId) {
        setNeedsSheetBinding(true);
      }
      if (res.ok) {
        setFriendInvites(res.items);
        if (res.sharedAi) setSharedAiState(res.sharedAi);
      } else {
        if (res.needsSpreadsheetId) setNeedsSheetBinding(true);
        setFriendPanelError(res.error || '초대코드 목록 조회에 실패했습니다.');
      }
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleIssueFriendInvite = async () => {
    if (isIssuingInvite) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const cleanLabel = friendLabelInput.trim() || '친구1';
    const initStore = newFriendStoreInput.trim();
    const initName = newFriendNameInput.trim();
    const initPhone = newFriendPhoneInput.trim();

    setIsIssuingInvite(true);
    setFriendPanelError(null);
    try {
      const res = await issueNewFriendInvite(
        auth.url,
        auth.pin,
        cleanLabel,
        newFriendMaxDevices,
        auth.sid
      );
      if (!res.ok) {
        if (res.needsSpreadsheetId) setNeedsSheetBinding(true);
        const msg =
          res.error ||
          '8자리 초대코드 발급에 실패했습니다. Apps Script 코드가 최신 버전인지 확인해 주세요.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (res.sharedAi) setSharedAiState(res.sharedAi);
      if (Array.isArray(res.items)) {
        setFriendInvites(res.items);
      } else if (res.item) {
        setFriendInvites((prev) => [res.item!, ...prev]);
      }
      setIsFriendListCollapsed(false);

      if (res.item?.codeId && (initStore || initName || initPhone)) {
        const profRes = await saveFriendRemoteProfile(
          auth.url,
          auth.pin,
          res.item.codeId,
          {
            storeName: initStore,
            consultantName: initName,
            phone: initPhone,
          }
        );
        if (profRes.ok && profRes.profiles) {
          setFriendRemoteProfiles(profRes.profiles);
        }
        setNewFriendStoreInput('');
        setNewFriendNameInput('');
        setNewFriendPhoneInput('');
      }

      const formatted = res.item
        ? formatFriendInviteCode(res.item.inviteCode)
        : '';
      showToastMessage(
        'success',
        `🔐 [${cleanLabel}] 8자리 코드(${formatted} · 최대 ${newFriendMaxDevices}대 허용) 발급 완료! 우측 [초대 안내문 복사]를 눌러 카톡으로 전달하세요.`
      );
    } finally {
      setIsIssuingInvite(false);
    }
  };

  const handleOpenRemoteProfileEditor = (item: FriendInviteItem) => {
    if (editingProfileCodeId === item.codeId) {
      setEditingProfileCodeId(null);
      return;
    }
    const existing = friendRemoteProfiles[item.codeId];
    setEditProfileDraft({
      storeName: existing?.storeName || '',
      consultantName: existing?.consultantName || '',
      phone: existing?.phone || '',
    });
    setEditingProfileCodeId(item.codeId);
  };

  const handleSaveRemoteProfileForFriend = async (item: FriendInviteItem) => {
    if (isSavingRemoteProfile) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const cleanStore = editProfileDraft.storeName.trim();
    const cleanName = editProfileDraft.consultantName.trim();
    const cleanPhone = editProfileDraft.phone.trim();

    if (!cleanStore && !cleanName && !cleanPhone) {
      showToastMessage(
        'error',
        '지점명, 담당자 이름, 연락처 중 최소 1개 이상을 입력해 주세요.'
      );
      return;
    }

    setIsSavingRemoteProfile(true);
    setFriendPanelError(null);
    try {
      const saveRes = await saveFriendRemoteProfile(
        auth.url,
        auth.pin,
        item.codeId,
        {
          storeName: cleanStore,
          consultantName: cleanName,
          phone: cleanPhone,
        }
      );
      if (!saveRes.ok) {
        setFriendPanelError(saveRes.message);
        showToastMessage('error', `⚠️ ${saveRes.message}`);
        return;
      }
      if (saveRes.profiles) {
        setFriendRemoteProfiles(saveRes.profiles);
      }
      setEditingProfileCodeId(null);
      showToastMessage(
        'success',
        `✅ [${item.label}] 기기에 지점명(${cleanStore || '유지'}) · 담당자(${cleanName || '유지'}) 원격 설정 완료! 친구가 앱을 열거나 견적전달 창을 열면 자동 반영됩니다.`
      );
    } finally {
      setIsSavingRemoteProfile(false);
    }
  };

  const handleOpenFriendNoticeEditor = (item: FriendInviteItem) => {
    if (editingNoticeCodeId === item.codeId) {
      setEditingNoticeCodeId(null);
      return;
    }
    const existingNotice = friendNoticesMap?.[item.codeId];
    setNoticeDraftText(existingNotice?.message || '');
    setEditingProfileCodeId(null);
    setEditingNoticeCodeId(item.codeId);
  };

  const handleSaveFriendNotice = async (item: FriendInviteItem) => {
    if (isSavingFriendNotice) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const cleanMsg = String(noticeDraftText || '').trim();
    if (!cleanMsg) {
      showToastMessage('error', '전달할 1회성 공지 멘트를 입력해 주세요.');
      return;
    }

    setIsSavingFriendNotice(true);
    setFriendPanelError(null);
    try {
      const saveRes = await saveFriendOneTimeNotice(
        auth.url,
        auth.pin,
        item.codeId,
        cleanMsg,
        auth.sid
      );
      if (!saveRes.ok) {
        setFriendPanelError(saveRes.message);
        showToastMessage('error', `⚠️ ${saveRes.message}`);
        return;
      }
      if (saveRes.noticesMap) {
        setFriendNoticesMap(saveRes.noticesMap);
      }
      setEditingNoticeCodeId(null);
      showToastMessage(
        'success',
        `💬 [${item.label}] 기기에 1회성 멘트가 발송 대기 등록되었습니다! 해당 친구/직원이 통합앱을 켜면 팝업으로 딱 1번 표시됩니다.`
      );
    } finally {
      setIsSavingFriendNotice(false);
    }
  };

  const handleClearFriendNotice = async (item: FriendInviteItem) => {
    if (isSavingFriendNotice) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    setIsSavingFriendNotice(true);
    setFriendPanelError(null);
    try {
      const saveRes = await saveFriendOneTimeNotice(
        auth.url,
        auth.pin,
        item.codeId,
        '',
        auth.sid
      );
      if (!saveRes.ok) {
        setFriendPanelError(saveRes.message);
        showToastMessage('error', `⚠️ ${saveRes.message}`);
        return;
      }
      if (saveRes.noticesMap) {
        setFriendNoticesMap(saveRes.noticesMap);
      }
      setNoticeDraftText('');
      setEditingNoticeCodeId(null);
      showToastMessage('info', `🗑️ [${item.label}] 등록된 1회성 멘트를 내렸습니다.`);
    } finally {
      setIsSavingFriendNotice(false);
    }
  };

  const handleCycleMaxDevices = async (item: FriendInviteItem) => {
    if (busyInviteCodeId) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const currentMax = Math.max(1, item.maxDevices || 1);
    const nextMax = currentMax === 1 ? 2 : currentMax === 2 ? 3 : currentMax === 3 ? 5 : 1;

    setBusyInviteCodeId(item.codeId);
    setFriendPanelError(null);
    try {
      const res = await mutateFriendInviteStatus(
        auth.url,
        auth.pin,
        item.codeId,
        'set_max_devices',
        { maxDevices: nextMax, spreadsheetId: auth.sid }
      );
      if (!res.ok) {
        if (res.needsSpreadsheetId) setNeedsSheetBinding(true);
        const rawErr = res.error || '';
        const msg = rawErr.includes('set_max_devices')
          ? '코드 1개로 다중 기기(폰+PC 2대 등) 허용 기능을 쓰시려면 상단 [Apps Script 코드 복사]를 눌러 구글 시트 Code.gs를 최신 코드로 1회 업데이트(새 버전 배포)해 주세요! (또는 PC용 별도 코드를 1개 더 발급하셔도 됩니다.)'
          : rawErr || '허용 기기수 변경에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (res.sharedAi) setSharedAiState(res.sharedAi);
      if (Array.isArray(res.items)) {
        setFriendInvites(res.items);
      } else {
        await handleRefreshFriendInvites();
      }
      showToastMessage(
        'success',
        `📱💻 [${item.label}] 허용 기기수가 최대 ${nextMax}대로 변경되었습니다! (${
          nextMax === 2
            ? '휴대폰 + PC 동시 등록 가능'
            : nextMax === 3
            ? '최대 3대 기기 등록 가능'
            : '휴대폰 1대 전용'
        })`
      );
    } finally {
      setBusyInviteCodeId(null);
    }
  };

  const handleCopyFriendInviteGuide = async (item: FriendInviteItem) => {
    const rawCfg = readRawSyncConfig();
    const rawInviteUrl = buildFriendInviteUrl(gasUrl.trim() || rawCfg.repo);
    if (!rawInviteUrl) {
      showToastMessage(
        'error',
        '전용 초대 링크를 생성하려면 상단 구글 시트 웹앱 URL을 먼저 입력해 주세요.'
      );
      return;
    }

    let displayInviteUrl = rawInviteUrl;
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1600);
      const api = `https://is.gd/create.php?format=json&url=${encodeURIComponent(
        rawInviteUrl
      )}`;
      const res = await fetch(api, { signal: controller.signal });
      window.clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.shorturl && typeof data.shorturl === 'string') {
          displayInviteUrl = data.shorturl;
        }
      }
    } catch {
      // 단축 실패 시 원본 링크 그대로 사용
    }

    const formattedCode = formatFriendInviteCode(item.inviteCode);
    const maxDev = Math.max(1, item.maxDevices || 1);
    const guideLines: string[] = [
      `[하이마트 스마트 상담앱 초대 안내 — ${item.label}]`,
      `• 전용 접속 링크:`,
      displayInviteUrl,
      ``,
      `• 등록코드 (8자리): ${formattedCode} (최대 ${maxDev}대 기기 등록 가능)`,
      ``,
      `📌 기기별 간편 설치 방법 (꼭 순서대로 진행해 주세요!)`,
      `🤖 [갤럭시/삼성폰]`,
      `1) 위 링크를 누르면 자동으로 크롬(Chrome) 화면이 열립니다.`,
      `2) 화면의 [📲 바탕화면에 앱 설치하기] 버튼을 먼저 누른 뒤, 아래에 8자리 코드를 입력하면 완료!`,
      ``,
      `🍎 [아이폰/아이패드]`,
      `1) 카톡 우측 하단 [⋯] 또는 [공유 ↑] → [Safari로 열기]를 선택합니다. (코드 먼저 입력 X)`,
      `2) Safari 맨 아래 [공유 ↑] → [홈 화면에 추가]로 바탕화면에 앱 아이콘을 먼저 만듭니다.`,
      `3) 바탕화면에 생긴 [하이마트 상담앱]을 열어서 8자리 등록코드를 입력하면 완료!`,
    ];

    if (maxDev >= 2) {
      guideLines.push(
        ``,
        `💻 [PC / 노트북 함께 쓰기 (${maxDev}대 허용)]`,
        `• PC 크롬(Chrome) 또는 엣지(Edge)에서 위 링크로 접속 후 동일한 8자리 코드(${formattedCode})를 입력하면 휴대폰과 PC에서 함께 사용할 수 있습니다.`
      );
    } else {
      guideLines.push(
        ``,
        `※ 등록코드는 최초 인증한 본인 기기(${maxDev}대)에만 전용 귀속됩니다.`
      );
    }

    const guideText = guideLines.join('\n');

    try {
      await navigator.clipboard.writeText(guideText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = guideText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    setCopiedInviteCodeId(item.codeId);
    window.setTimeout(() => {
      setCopiedInviteCodeId((prev) => (prev === item.codeId ? null : prev));
    }, 2000);
    showToastMessage(
      'success',
      `📋 [${item.label} · ${formattedCode}] 카톡 전달용 초대 안내문이 복사되었습니다!`
    );
  };

  const handleMutateFriendInvite = async (
    item: FriendInviteItem,
    mode: 'revoke' | 'reset_device' | 'activate' | 'delete'
  ) => {
    if (busyInviteCodeId) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const formattedCode = formatFriendInviteCode(item.inviteCode);
    if (mode === 'reset_device') {
      const ok = window.confirm(
        `[${item.label} (${formattedCode})] 기기 귀속을 초기화할까요?\n기존 등록된 기기 귀속이 모두 해제되어 새 기기를 다시 등록할 수 있게 리셋됩니다.`
      );
      if (!ok) return;
    } else if (mode === 'delete') {
      const ok = window.confirm(
        `[${item.label} (${formattedCode})] 초대코드를 목록에서 완전히 삭제할까요?\n삭제 즉시 해당 기기의 접근도 차단됩니다.`
      );
      if (!ok) return;
    }

    setBusyInviteCodeId(item.codeId);
    setFriendPanelError(null);
    try {
      const res = await mutateFriendInviteStatus(
        auth.url,
        auth.pin,
        item.codeId,
        mode,
        { spreadsheetId: auth.sid }
      );
      if (!res.ok) {
        if (res.needsSpreadsheetId) setNeedsSheetBinding(true);
        const msg = res.error || '상태 변경에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
      if (mode === 'delete') {
        void deleteFriendRemoteProfile(auth.url, auth.pin, item.codeId);
        setFriendRemoteProfiles((prev) => {
          const next = { ...prev };
          delete next[item.codeId];
          return next;
        });
        setFriendNoticesMap((prev: Record<string, any>) => {
          const next = { ...(prev || {}) };
          delete next[item.codeId];
          return next;
        });
      }
      if (res.sharedAi) setSharedAiState(res.sharedAi);
      if (Array.isArray(res.items)) {
        setFriendInvites(res.items);
      } else {
        await handleRefreshFriendInvites();
      }

      if (mode === 'revoke') {
        showToastMessage(
          'success',
          `🚫 [${item.label}] 접근이 즉시 차단되었습니다! 친구 기기 진입/복귀 시 즉시 잠금 화면으로 전환됩니다.`
        );
      } else if (mode === 'activate') {
        showToastMessage(
          'success',
          `🔓 [${item.label}] 차단이 해제되어 정상 복구되었습니다.`
        );
      } else if (mode === 'reset_device') {
        showToastMessage(
          'success',
          `🔄 [${item.label}] 기기 귀속이 초기화되었습니다. 새 기기에서 다시 등록할 수 있습니다.`
        );
      } else if (mode === 'delete') {
        showToastMessage('info', `🗑️ [${item.label}] 초대코드가 삭제되었습니다.`);
      }
    } finally {
      setBusyInviteCodeId(null);
    }
  };

  return {
    handleSaveSharedAiKey,
    handleToggleGlobalSharedAi,
    handleClearSharedAiKey,
    handleToggleFriendAiAllowed,
    handleToggleFriendScheduleAllowed,
    handleRefreshFriendInvites,
    handleIssueFriendInvite,
    handleOpenFriendNoticeEditor,
    handleSaveFriendNotice,
    handleClearFriendNotice,
    handleOpenRemoteProfileEditor,
    handleSaveRemoteProfileForFriend,
    handleCycleMaxDevices,
    handleCopyFriendInviteGuide,
    handleMutateFriendInvite,
  };
}
