import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderUp,
  KeyRound,
  Loader2,
  Lock,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  CloudDiagnosticsReport,
  diagnoseStoreCloudConnection,
  extractGoogleSheetId,
  healCloudCareItemsFromLocalIfEmpty,
  loadSavedSpreadsheetId,
  saveSpreadsheetId,
  SharedGeminiAdminState,
  StoreCloudKind,
  buildStaffAutoConnectUrl,
  clearStoreCloudMicroCache,
  fetchAllFriendRemoteProfiles,
  fetchFriendNoticesMap,
  fetchFriendScheduleMap,
  FriendOneTimeNotice,
  fetchStoreCloudDataset,
  FriendRemoteProfile,
  getStoreCloudAppsScriptCode,
  normalizeGasWebAppUrl,
  OWNER_CUSTOM_PIN_STORAGE_KEY,
  readRawSyncConfig,
  saveStoreCloudDataset,
  STORE_CLOUD_UPDATED_EVENT,
  UNCONFIGURED_PIN_SENTINEL,
} from '../utils/storeCloudSync';
import { fetchFriendInviteList, FriendInviteItem } from '../utils/friendAccessGuard';
import {
  ADMIN_MODE_CHANGED_EVENT,
  ADMIN_PIN_CODE,
  CARE_TABLE_UPDATED_EVENT,
  fetchRemoteCareDataset,
  isAdminDevice,
  loadLocalCareDataset,
  refreshAdminPinBinding,
  saveGitHubSyncConfig,
  saveLocalCareDataset,
  setAdminDeviceUnlocked,
} from '../utils/careTableParser';
import { loadAllSchedules, saveAllSchedules, SCHEDULE_UPDATED_EVENT } from './ScheduleModal';
import {
  getCurrentYearMonth,
  loadAllModelIncentiveSheets,
  MODEL_INCENTIVE_UPDATED_EVENT,
  stripPersonalLocalFromIncentiveMap,
} from '../crm/utils/settlementEngine';
import { fetchRemoteModelIncentiveSheets } from '../crm/utils/settlementSheetParser';
import {
  fetchRemoteInstallmentDataset,
  INSTALLMENT_UPDATED_EVENT,
  loadLocalInstallmentDataset,
  saveLocalInstallmentDataset,
} from '../utils/installmentParser';
import { isOwnerMarketingDbUnlocked } from '../utils/marketingDbEngine';
import { useStoreAdminFriendsAndAi } from './adminHub/useStoreAdminFriendsAndAi';
import { useStoreAdminDatasetHandlers } from './adminHub/useStoreAdminDatasetHandlers';
import { StoreAdminCloudBridgeBox } from './adminHub/StoreAdminCloudBridgeBox';
import { StoreAdminFriendInvitesPanel } from './adminHub/StoreAdminFriendInvitesPanel';
import { StoreAdminDatasetCardsGrid } from './adminHub/StoreAdminDatasetCardsGrid';

export const OPEN_ADMIN_UPLOAD_HUB_EVENT = 'himart_gj_open_admin_upload_hub';

export type AdminHubTabId = 'datasets' | 'invites' | 'cloud';

export function requestOpenAdminUploadHub(initialFocus?: StoreCloudKind): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(OPEN_ADMIN_UPLOAD_HUB_EVENT, {
        detail: { focus: initialFocus },
      })
    );
  }
}

interface StoreAdminUploadHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialFocus?: StoreCloudKind | null;
}

interface CardUploadFeedback {
  status: 'idle' | 'working' | 'success' | 'warning' | 'error';
  message: string;
  timeLabel?: string;
}

export type StoredSchedulesMap = ReturnType<typeof loadAllSchedules>;

export function formatHHMM(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function pruneSchedulesToRecent12Months(map: StoredSchedulesMap): StoredSchedulesMap {
  const validMonths = Object.keys(map || {})
    .filter((ym) => (map[ym]?.employees?.length || 0) > 0)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12);
  const pruned: StoredSchedulesMap = {};
  for (const ym of validMonths) pruned[ym] = map[ym];
  return pruned;
}

export const StoreAdminUploadHubModal: React.FC<StoreAdminUploadHubModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  initialFocus = null,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminDevice());
  const [activeHubTab, setActiveHubTab] = useState<AdminHubTabId>('datasets');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPinValue, setShowPinValue] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [gasUrl, setGasUrl] = useState<string>(() => readRawSyncConfig().repo);
  const [cloudPin, setCloudPin] = useState<string>(() => readRawSyncConfig().token);
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>(() =>
    loadSavedSpreadsheetId()
  );
  const [showCloudPin, setShowCloudPin] = useState<boolean>(false);
  const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
  const [isPullingFromCloud, setIsPullingFromCloud] = useState<boolean>(false);
  const [cloudVerified, setCloudVerified] = useState<boolean | null>(null);
  const [needsSheetBinding, setNeedsSheetBinding] = useState<boolean>(false);
  const [cloudDiag, setCloudDiag] = useState<CloudDiagnosticsReport | null>(null);
  const [sharedAiState, setSharedAiState] = useState<SharedGeminiAdminState>({
    hasSharedKey: false,
    maskedSharedKey: '',
    globalEnabled: false,
    friendAiMap: {},
  });
  const [sharedKeyDraft, setSharedKeyDraft] = useState<string>('');
  const [isSavingSharedAi, setIsSavingSharedAi] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [dataTick, setDataTick] = useState<number>(0);
  const [incentiveYm, setIncentiveYm] = useState<string>(() => getCurrentYearMonth());
  const [mergeIncentiveInMonth, setMergeIncentiveInMonth] = useState<boolean>(false);
  const [friendLabelInput, setFriendLabelInput] = useState<string>('');
  const [newFriendMaxDevices, setNewFriendMaxDevices] = useState<number>(2);
  const [isFriendListCollapsed, setIsFriendListCollapsed] = useState<boolean>(false);
  const [newFriendStoreInput, setNewFriendStoreInput] = useState<string>('');
  const [newFriendNameInput, setNewFriendNameInput] = useState<string>('');
  const [newFriendPhoneInput, setNewFriendPhoneInput] = useState<string>('');
  const [friendInvites, setFriendInvites] = useState<FriendInviteItem[]>([]);
  const [friendRemoteProfiles, setFriendRemoteProfiles] = useState<
    Record<string, FriendRemoteProfile>
  >({});
  const [friendScheduleMap, setFriendScheduleMap] = useState<Record<string, boolean>>({});
  const [friendNoticesMap, setFriendNoticesMap] = useState<Record<string, FriendOneTimeNotice>>({});
  const [editingNoticeCodeId, setEditingNoticeCodeId] = useState<string | null>(null);
  const [noticeDraftText, setNoticeDraftText] = useState<string>('');
  const [isSavingFriendNotice, setIsSavingFriendNotice] = useState<boolean>(false);
  const [editingProfileCodeId, setEditingProfileCodeId] = useState<string | null>(null);
  const [editProfileDraft, setEditProfileDraft] = useState<{
    storeName: string;
    consultantName: string;
    phone: string;
  }>({ storeName: '', consultantName: '', phone: '' });
  const [isSavingRemoteProfile, setIsSavingRemoteProfile] = useState<boolean>(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState<boolean>(false);
  const [isIssuingInvite, setIsIssuingInvite] = useState<boolean>(false);
  const [busyInviteCodeId, setBusyInviteCodeId] = useState<string | null>(null);
  const [copiedInviteCodeId, setCopiedInviteCodeId] = useState<string | null>(null);
  const [friendPanelError, setFriendPanelError] = useState<string | null>(null);
  const [cardFeedback, setCardFeedback] = useState<
    Record<StoreCloudKind, CardUploadFeedback>
  >({
    schedule: { status: 'idle', message: '' },
    incentive: { status: 'idle', message: '' },
    care: { status: 'idle', message: '' },
    installment: { status: 'idle', message: '' },
  });

  const scheduleExcelRef = useRef<HTMLInputElement>(null);
  const schedulePhotoRef = useRef<HTMLInputElement>(null);
  const incentiveExcelRef = useRef<HTMLInputElement>(null);
  const incentivePhotoRef = useRef<HTMLInputElement>(null);
  const careExcelRef = useRef<HTMLInputElement>(null);
  const installmentFileRef = useRef<HTMLInputElement>(null);

  const showToastMessage = (type: 'success' | 'error' | 'info', text: string) =>
    setToast({ type, text });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    const rawCfg = readRawSyncConfig();
    const validUrl = Boolean(normalizeGasWebAppUrl(rawCfg.repo));
    setGasUrl(rawCfg.repo);
    setCloudPin(rawCfg.token);
    setSpreadsheetIdInput(loadSavedSpreadsheetId());
    setIsAdmin(isOwnerMarketingDbUnlocked() && isAdminDevice());
    setPinInput('');
    setPinError(null);
    setIsVerifyingPin(false);
    setEditingProfileCodeId(null);
    setEditingNoticeCodeId(null);
    setNeedsSheetBinding(false);
    setCloudVerified(validUrl ? null : false);
    setActiveHubTab(!validUrl ? 'cloud' : 'datasets');
    setDataTick((v) => v + 1);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialFocus) {
      setActiveHubTab('datasets');
    }
  }, [isOpen, initialFocus]);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    const rawCfg = readRawSyncConfig();
    const targetUrl = normalizeGasWebAppUrl(gasUrl || rawCfg.repo);
    const targetPin = (cloudPin || rawCfg.token).trim();
    const savedSid = spreadsheetIdInput || loadSavedSpreadsheetId();
    if (!targetUrl || targetPin.length < 4) return;
    let cancelled = false;
    setIsLoadingInvites(true);
    setFriendPanelError(null);

    void healCloudCareItemsFromLocalIfEmpty(loadLocalCareDataset());

    void Promise.all([
      fetchFriendInviteList(targetUrl, targetPin, savedSid),
      fetchAllFriendRemoteProfiles(targetUrl),
      fetchFriendScheduleMap(targetUrl),
      fetchFriendNoticesMap(targetUrl),
      diagnoseStoreCloudConnection(targetUrl, targetPin, savedSid),
    ])
      .then(([res, remoteMap, schedMap, noticesMap, diag]) => {
        if (cancelled) return;
        setFriendRemoteProfiles(remoteMap || {});
        setFriendScheduleMap(schedMap || {});
        setFriendNoticesMap(noticesMap || {});
        setCloudDiag(diag);
        if (diag.ok) {
          setCloudVerified(true);
          setNeedsSheetBinding(false);
          if (diag.spreadsheetId && !spreadsheetIdInput) {
            setSpreadsheetIdInput(diag.spreadsheetId);
          }
          if (diag.sharedAi) setSharedAiState(diag.sharedAi);
        } else if (diag.needsSpreadsheetId) {
          setNeedsSheetBinding(true);
          setCloudVerified(false);
          setActiveHubTab('cloud');
        }
        if (res.ok) {
          setFriendInvites(res.items);
          if (res.sharedAi) setSharedAiState(res.sharedAi);
        } else {
          if (res.needsSpreadsheetId) {
            setNeedsSheetBinding(true);
            setActiveHubTab('cloud');
          }
          setFriendPanelError(res.error || null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInvites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAdmin]);

  useEffect(() => {
    const onAdminChange = () =>
      setIsAdmin(isOwnerMarketingDbUnlocked() && isAdminDevice());
    const onDataChange = () => setDataTick((v) => v + 1);
    window.addEventListener(ADMIN_MODE_CHANGED_EVENT, onAdminChange);
    window.addEventListener(SCHEDULE_UPDATED_EVENT, onDataChange);
    window.addEventListener(MODEL_INCENTIVE_UPDATED_EVENT, onDataChange);
    window.addEventListener(CARE_TABLE_UPDATED_EVENT, onDataChange);
    window.addEventListener(INSTALLMENT_UPDATED_EVENT, onDataChange);
    window.addEventListener(STORE_CLOUD_UPDATED_EVENT, onDataChange);
    return () => {
      window.removeEventListener(ADMIN_MODE_CHANGED_EVENT, onAdminChange);
      window.removeEventListener(SCHEDULE_UPDATED_EVENT, onDataChange);
      window.removeEventListener(MODEL_INCENTIVE_UPDATED_EVENT, onDataChange);
      window.removeEventListener(CARE_TABLE_UPDATED_EVENT, onDataChange);
      window.removeEventListener(INSTALLMENT_UPDATED_EVENT, onDataChange);
      window.removeEventListener(STORE_CLOUD_UPDATED_EVENT, onDataChange);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const summaries = useMemo(() => {
    void dataTick;
    const schedulesMap = loadAllSchedules();
    const regScheduleMonths = Object.keys(schedulesMap)
      .filter((ym) => (schedulesMap[ym]?.employees?.length || 0) > 0)
      .sort()
      .reverse();
    const latestScheduleYm = regScheduleMonths[0] || '';
    const latestSchedule = latestScheduleYm ? schedulesMap[latestScheduleYm] : null;
    const scheduleMonthItems = regScheduleMonths.map((ym) => ({
      yearMonth: ym,
      count: schedulesMap[ym]?.employees?.length || 0,
    }));
    const officialIncentiveSheets = stripPersonalLocalFromIncentiveMap(
      loadAllModelIncentiveSheets()
    );
    const activeIncentiveSheet = officialIncentiveSheets[incentiveYm] || null;
    const allIncentiveMonths = Object.keys(officialIncentiveSheets)
      .filter((ym) => (officialIncentiveSheets[ym]?.rules?.length || 0) > 0)
      .sort()
      .reverse();
    const careDataset = loadLocalCareDataset();
    const installmentDataset = loadLocalInstallmentDataset();
    return {
      schedule: {
        hasData: regScheduleMonths.length > 0,
        version: latestScheduleYm || '미등록',
        countText: latestSchedule
          ? `${latestSchedule.employees.length}명 (${regScheduleMonths.length}개월)`
          : '미등록',
        updatedAt: latestSchedule?.updatedAt || '-',
        months: scheduleMonthItems,
      },
      incentive: {
        hasData: Boolean(activeIncentiveSheet && activeIncentiveSheet.rules.length > 0),
        totalMonths: allIncentiveMonths.length,
        version: incentiveYm,
        countText: activeIncentiveSheet
          ? `${activeIncentiveSheet.rules.length.toLocaleString()}개 모델`
          : '미등록',
        updatedAt: activeIncentiveSheet?.updatedAt || '-',
      },
      care: {
        hasData: Boolean(careDataset && careDataset.items.length > 0),
        version: careDataset?.versionTitle || '조견표 미등록',
        countText: careDataset
          ? `${careDataset.items.length.toLocaleString()}개 코드`
          : '미등록',
        updatedAt: careDataset?.updatedAt || '-',
      },
      installment: {
        hasData: installmentDataset.columns.length > 0,
        version: installmentDataset.versionTitle || '미등록',
        countText:
          installmentDataset.columns.length > 0
            ? `${installmentDataset.columns.length}개 카드`
            : '미등록',
        updatedAt: installmentDataset.updatedAt || '-',
      },
    };
  }, [dataTick, incentiveYm]);

  if (!isOpen) return null;

  const setKindFeedback = (kind: StoreCloudKind, next: CardUploadFeedback) =>
    setCardFeedback((prev) => ({ ...prev, [kind]: next }));

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingPin) return;
    const cleanedPin = pinInput.trim();
    if (cleanedPin.length < 4) {
      setPinError('관리자 PIN을 4자리 이상 입력해 주세요.');
      return;
    }
    const rawCfg = readRawSyncConfig();
    const savedToken = rawCfg.token.trim();
    const ownerSaved =
      typeof localStorage !== 'undefined'
        ? String(localStorage.getItem(OWNER_CUSTOM_PIN_STORAGE_KEY) || '').trim()
        : '';
    const knownPins = [savedToken, ownerSaved, ADMIN_PIN_CODE].filter(
      (p) => p && p !== UNCONFIGURED_PIN_SENTINEL && p.length >= 4
    );
    if (knownPins.length > 0) {
      if (knownPins.includes(cleanedPin)) {
        if (!savedToken) {
          saveGitHubSyncConfig({
            repo: rawCfg.repo || '',
            branch: rawCfg.branch || 'main',
            token: cleanedPin,
          });
          setCloudPin(cleanedPin);
        }
        refreshAdminPinBinding();
        setAdminDeviceUnlocked(true);
        setIsAdmin(true);
        setPinInput('');
        setPinError(null);
        showToastMessage('success', '관리자 인증이 완료되었습니다.');
      } else {
        setPinError('관리자 비밀번호(PIN)가 일치하지 않습니다.');
      }
      return;
    }
    const normalizedUrl = normalizeGasWebAppUrl(rawCfg.repo);
    if (!normalizedUrl) {
      setPinError('등록된 관리자 PIN 또는 클라우드 연결 정보가 없습니다.');
      return;
    }
    setIsVerifyingPin(true);
    setPinError(null);
    try {
      const probeKinds: StoreCloudKind[] = ['schedule', 'incentive', 'care', 'installment'];
      let probeKind: StoreCloudKind | null = null;
      let probeData: unknown = null;
      for (const kind of probeKinds) {
        const fetched = await fetchStoreCloudDataset(kind, {
          bypassCache: true,
          gasUrlOverride: normalizedUrl,
        });
        if (fetched !== null) {
          probeKind = kind;
          probeData = fetched;
          break;
        }
      }
      if (!probeKind) {
        setPinError('구글 시트 기준 데이터를 확인할 수 없습니다.');
        return;
      }
      const verifyRes = await saveStoreCloudDataset(probeKind, probeData, {
        repo: normalizedUrl,
        token: cleanedPin,
      });
      if (!verifyRes.ok) {
        setPinError(verifyRes.message || 'PIN 검증에 실패했습니다.');
        return;
      }
      saveGitHubSyncConfig({
        repo: normalizedUrl,
        branch: rawCfg.branch || 'main',
        token: cleanedPin,
      });
      refreshAdminPinBinding();
      setAdminDeviceUnlocked(true);
      setGasUrl(normalizedUrl);
      setCloudPin(cleanedPin);
      setIsAdmin(true);
      setPinInput('');
      setPinError(null);
      showToastMessage('success', '관리자 인증이 완료되었습니다.');
    } catch {
      setPinError('클라우드 서버 연결에 실패했습니다.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleSaveAndCheckCloud = async () => {
    const normalized = normalizeGasWebAppUrl(gasUrl.trim());
    const cleanPin = cloudPin.trim();
    const extractedSid = saveSpreadsheetId(spreadsheetIdInput);
    if (extractedSid) setSpreadsheetIdInput(extractedSid);
    if (!normalized) {
      showToastMessage(
        'error',
        '올바른 Apps Script 웹앱 주소(https://script.google.com/macros/s/.../exec)를 입력해 주세요.'
      );
      setCloudVerified(false);
      return;
    }
    if (cleanPin.length < 4) {
      showToastMessage('error', '관리자 PIN을 4자리 이상 입력해 주세요.');
      return;
    }
    saveGitHubSyncConfig({ repo: normalized, branch: 'main', token: cleanPin });
    refreshAdminPinBinding();
    clearStoreCloudMicroCache();
    setGasUrl(normalized);
    setCloudPin(cleanPin);
    setIsCheckingCloud(true);
    try {
      const [diag, invRes, remoteMap, schedMap, noticesMap] = await Promise.all([
        diagnoseStoreCloudConnection(normalized, cleanPin, extractedSid),
        fetchFriendInviteList(normalized, cleanPin, extractedSid),
        fetchAllFriendRemoteProfiles(normalized),
        fetchFriendScheduleMap(normalized),
        fetchFriendNoticesMap(normalized),
      ]);
      setCloudDiag(diag);
      setFriendRemoteProfiles(remoteMap || {});
      setFriendScheduleMap(schedMap || {});
      setFriendNoticesMap(noticesMap || {});
      if (invRes.ok) {
        setFriendInvites(invRes.items);
        if (invRes.sharedAi) setSharedAiState(invRes.sharedAi);
        setFriendPanelError(null);
      } else if (invRes.error) {
        setFriendPanelError(invRes.error);
      }
      if (diag.ok) {
        setCloudVerified(true);
        setNeedsSheetBinding(false);
        if (diag.spreadsheetId) setSpreadsheetIdInput(diag.spreadsheetId);
        if (diag.sharedAi) setSharedAiState(diag.sharedAi);
        window.dispatchEvent(new CustomEvent(STORE_CLOUD_UPDATED_EVENT));
        showToastMessage(
          'success',
          `연동 완료: ${diag.spreadsheetTitle || '비공개 시트'} (초대 ${diag.inviteCount ?? invRes.items.length}명)`
        );
      } else {
        setCloudVerified(false);
        if (diag.needsSpreadsheetId || invRes.needsSpreadsheetId) {
          setNeedsSheetBinding(true);
        }
        showToastMessage('error', diag.error || '시트 연동 확인에 실패했습니다.');
      }
    } catch {
      setCloudVerified(false);
      showToastMessage('error', '시트 응답 확인에 실패했습니다.');
    } finally {
      setIsCheckingCloud(false);
    }
  };

  const resolveActiveCloudAuth = (): { url: string; pin: string; sid: string } | null => {
    const rawCfg = readRawSyncConfig();
    const url = normalizeGasWebAppUrl(gasUrl.trim() || rawCfg.repo);
    const pin = (cloudPin.trim() || rawCfg.token).trim();
    const sid = extractGoogleSheetId(spreadsheetIdInput) || loadSavedSpreadsheetId();
    if (!url || pin.length < 4) {
      setActiveHubTab('cloud');
      showToastMessage('error', '[클라우드 설정] 탭에서 웹앱 주소와 관리자 PIN을 먼저 저장해 주세요.');
      return null;
    }
    return { url, pin, sid };
  };

  const handlePullAllDatasetsFromCloud = async () => {
    const auth = resolveActiveCloudAuth();
    if (!auth || isPullingFromCloud) return;
    setIsPullingFromCloud(true);
    clearStoreCloudMicroCache();
    try {
      const [schedCloud, incCloud, careCloud, instCloud] = await Promise.all([
        fetchStoreCloudDataset<StoredSchedulesMap>('schedule', {
          bypassCache: true,
          gasUrlOverride: auth.url,
        }),
        fetchRemoteModelIncentiveSheets(),
        fetchRemoteCareDataset(),
        fetchRemoteInstallmentDataset(),
      ]);
      const pulledKinds: string[] = [];
      if (schedCloud && typeof schedCloud === 'object' && Object.keys(schedCloud).length > 0) {
        saveAllSchedules(pruneSchedulesToRecent12Months(schedCloud));
        pulledKinds.push(`휴무표(${Object.keys(schedCloud).length}개월)`);
      }
      if (incCloud && Object.keys(incCloud).length > 0) {
        pulledKinds.push(`모델수당(${Object.keys(incCloud).length}개월)`);
      }
      if (careCloud && Array.isArray(careCloud.items) && careCloud.items.length > 0) {
        saveLocalCareDataset(careCloud);
        pulledKinds.push(`안심케어(${careCloud.items.length.toLocaleString()}개)`);
      }
      if (instCloud && Array.isArray(instCloud.columns) && instCloud.columns.length > 0) {
        saveLocalInstallmentDataset(instCloud);
        pulledKinds.push(`무이자할부(${instCloud.columns.length}카드)`);
      }
      setDataTick((v) => v + 1);
      showToastMessage(
        pulledKinds.length > 0 ? 'success' : 'info',
        pulledKinds.length > 0
          ? `시트 최신 자료 동기화 완료: ${pulledKinds.join(' · ')}`
          : '시트에 적재된 자료가 없습니다.'
      );
    } catch {
      showToastMessage('error', '자료 불러오기 중 오류가 발생했습니다.');
    } finally {
      setIsPullingFromCloud(false);
    }
  };

  const handleCopyStaffAutoConnectLink = () => {
    const staffLink = buildStaffAutoConnectUrl(gasUrl.trim());
    if (!staffLink) {
      showToastMessage('error', 'Apps Script 웹앱 URL을 먼저 저장해 주세요.');
      return;
    }
    void navigator.clipboard
      ?.writeText(staffLink)
      .then(() =>
        showToastMessage('success', '전 직원 원클릭 자동연결 링크가 복사되었습니다!')
      )
      .catch(() => showToastMessage('error', '복사에 실패했습니다.'));
  };

  const handleCopyAppsScriptCode = () => {
    const cleanSid = saveSpreadsheetId(spreadsheetIdInput);
    if (cleanSid) setSpreadsheetIdInput(cleanSid);
    const scriptText = getStoreCloudAppsScriptCode(cleanSid);
    void navigator.clipboard
      ?.writeText(scriptText)
      .then(() =>
        showToastMessage(
          'success',
          '최신 Apps Script(Code.gs) 코드가 복사되었습니다! 붙여넣기 후 [새 버전 배포] 해주세요.'
        )
      )
      .catch(() => showToastMessage('error', '복사에 실패했습니다.'));
  };

  const pushDatasetToCloud = async (
    kind: StoreCloudKind,
    payload: unknown,
    localSummaryText: string
  ) => {
    const activeUrl = gasUrl.trim() || readRawSyncConfig().repo;
    const activePin = cloudPin.trim() || readRawSyncConfig().token;
    const activeSid = extractGoogleSheetId(spreadsheetIdInput) || loadSavedSpreadsheetId();
    const res = await saveStoreCloudDataset(kind, payload, {
      repo: activeUrl,
      token: activePin,
      spreadsheetId: activeSid,
    });
    const hhmm = formatHHMM();
    if (res.ok) {
      setKindFeedback(kind, {
        status: 'success',
        message: `업로드 완료 (${hhmm}) · ${localSummaryText}`,
        timeLabel: hhmm,
      });
      setCloudVerified(true);
      setNeedsSheetBinding(false);
      void diagnoseStoreCloudConnection(activeUrl, activePin, activeSid).then((diag) => {
        if (diag.ok) setCloudDiag(diag);
      });
      showToastMessage('success', `클라우드 반영 완료 (${hhmm}) — ${localSummaryText}`);
    } else if (!res.configured) {
      setKindFeedback(kind, {
        status: 'warning',
        message: `내 기기 반영 완료 · 클라우드 설정 필요`,
        timeLabel: hhmm,
      });
      showToastMessage('info', '내 기기에 저장되었습니다.');
    } else {
      if (res.needsSpreadsheetId) setNeedsSheetBinding(true);
      setKindFeedback(kind, { status: 'error', message: res.message });
      showToastMessage('error', res.message);
    }
    setDataTick((v) => v + 1);
  };

  const {
    handleSaveSharedAiKey,
    handleToggleGlobalSharedAi,
    handleClearSharedAiKey,
    handleToggleFriendAiAllowed,
    handleToggleFriendScheduleAllowed,
    handleRefreshFriendInvites,
    handleIssueFriendInvite,
    handleClearFriendNotice,
    handleOpenFriendNoticeEditor,
    handleOpenRemoteProfileEditor,
    handleSaveFriendNotice,
    handleSaveRemoteProfileForFriend,
    handleCycleMaxDevices,
    handleCopyFriendInviteGuide,
    handleMutateFriendInvite,
  } = useStoreAdminFriendsAndAi({
    busyInviteCodeId,
    editProfileDraft,
    editingProfileCodeId,
    friendLabelInput: friendLabelInput || `직원${friendInvites.length + 1}`,
    editingNoticeCodeId,
    friendNoticesMap,
    friendRemoteProfiles,
    friendScheduleMap,
    isSavingFriendNotice,
    noticeDraftText,
    gasUrl,
    isIssuingInvite,
    isSavingRemoteProfile,
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
    setEditingProfileCodeId,
    setFriendInvites,
    setFriendPanelError,
    setEditingNoticeCodeId,
    setFriendNoticesMap,
    setFriendRemoteProfiles,
    setFriendScheduleMap,
    setIsSavingFriendNotice,
    setNoticeDraftText,
    setIsFriendListCollapsed,
    setIsIssuingInvite,
    setIsLoadingInvites,
    setIsSavingRemoteProfile,
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
  });

  const {
    handleScheduleFileUpload,
    handleScheduleResend,
    handleDeleteScheduleMonth,
    handleIncentiveExcelUpload,
    handleIncentivePhotoUpload,
    handleIncentiveResend,
    handleCareExcelUpload,
    handleCareResend,
    handleInstallmentUpload,
    handleInstallmentResend,
  } = useStoreAdminDatasetHandlers({
    incentiveYm,
    mergeIncentiveInMonth,
    pushDatasetToCloud,
    setIncentiveYm,
    setKindFeedback,
    showToastMessage,
  });

  const modalBg = isDark
    ? 'bg-[#0B1120] border-slate-700 text-slate-100'
    : 'bg-white border-[#D1D6DB] text-[#191F28]';
  const cardBg = isDark
    ? 'bg-[#131C2E] border-slate-700/80'
    : 'bg-white border-[#E5E8EB]';
  const subBoxBg = isDark
    ? 'bg-[#0F172A] border-slate-700/80'
    : 'bg-[#F8FAFC] border-[#E5E8EB]';
  const inputCls = isDark
    ? 'bg-[#0B1120] border-slate-700 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-[#D1D6DB] text-[#191F28] placeholder:text-[#8B95A1]';
  const mutedText = isDark ? 'text-slate-400' : 'text-[#4E5968]';

  const renderCardBadge = (kind: StoreCloudKind) => {
    const fb = cardFeedback[kind];
    if (fb.status === 'working') {
      return (
        <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/35 text-[#1B64DA] dark:text-blue-300 text-[11.5px] font-extrabold flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="break-words leading-snug">{fb.message}</span>
        </div>
      );
    }
    if (fb.status === 'success') {
      return (
        <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-[#059669] dark:text-emerald-300 text-[11.5px] font-extrabold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="break-words leading-snug">{fb.message}</span>
        </div>
      );
    }
    if (fb.status === 'warning' || fb.status === 'error') {
      return (
        <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-[11.5px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="break-words leading-snug">{fb.message}</span>
        </div>
      );
    }
    return null;
  };

  const hasValidCloudUrl = Boolean(normalizeGasWebAppUrl(gasUrl));
  const cloudHealthy = hasValidCloudUrl && !needsSheetBinding && cloudVerified !== false;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[92dvh] rounded-[22px] border border-t-[3px] border-t-[#E60012] shadow-2xl flex flex-col overflow-hidden ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-[#131C2E] border-slate-800' : 'bg-white border-[#E5E8EB]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#191F28] dark:bg-[#1B64DA] text-white flex items-center justify-center shrink-0">
              <FolderUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight truncate">
                  매장 자료 · 초대 관리
                </h2>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveHubTab('cloud')}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                      cloudHealthy
                        ? 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                    }`}
                  >
                    {cloudHealthy ? '● 시트 연동됨' : '● 연동 확인 필요'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminDeviceUnlocked(false);
                  setIsAdmin(false);
                  showToastMessage('info', '관리자 모드가 잠금 처리되었습니다.');
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    : 'bg-[#F2F4F6] hover:bg-[#E5E8EB] border-[#E5E8EB] text-[#4E5968]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">잠금</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-[#F2F4F6] hover:bg-[#E5E8EB] border-[#E5E8EB] text-[#4E5968]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isAdmin && (
          <div
            className={`px-4 sm:px-6 py-2.5 border-b shrink-0 ${
              isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-[#F8FAFC] border-[#E5E8EB]'
            }`}
          >
            <div
              className={`p-1 rounded-xl grid grid-cols-3 gap-1 border ${
                isDark
                  ? 'bg-[#0B1120] border-slate-800'
                  : 'bg-[#EEF1F4] border-[#E5E8EB]'
              }`}
            >
              {(
                [
                  {
                    id: 'datasets' as AdminHubTabId,
                    label: '매장 자료 업로드',
                    shortLabel: '자료 업로드',
                    badge: '4종',
                    icon: FolderUp,
                  },
                  {
                    id: 'invites' as AdminHubTabId,
                    label: '초대 · 권한 관리',
                    shortLabel: '초대 관리',
                    badge: `${friendInvites.length}명`,
                    icon: Users,
                  },
                  {
                    id: 'cloud' as AdminHubTabId,
                    label: '클라우드 설정',
                    shortLabel: '연동 설정',
                    badge: needsSheetBinding || !hasValidCloudUrl ? '점검' : '',
                    icon: Settings,
                  },
                ] as const
              ).map((tab) => {
                const IconComp = tab.icon;
                const active = activeHubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveHubTab(tab.id)}
                    className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      active
                        ? isDark
                          ? 'bg-[#1B64DA] text-white shadow-sm'
                          : 'bg-white text-[#191F28] shadow-sm'
                        : mutedText
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden truncate">{tab.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold font-mono shrink-0 ${
                          active
                            ? isDark
                              ? 'bg-white/20 text-white'
                              : 'bg-[#EFF6FF] text-[#1B64DA]'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-white/80 text-[#4E5968]'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`px-4 sm:px-6 py-2.5 text-xs font-extrabold flex items-center justify-between gap-2 shrink-0 ${
              toast.type === 'success'
                ? 'bg-[#059669] text-white'
                : toast.type === 'error'
                ? 'bg-[#E60012] text-white'
                : 'bg-[#1B64DA] text-white'
            }`}
          >
            <span className="leading-snug">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-0.5 rounded hover:bg-black/20 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 ${
            isDark ? 'bg-[#0B1120]' : 'bg-[#F2F4F6]'
          }`}
        >
          {!isAdmin ? (
            <div className="max-w-sm mx-auto my-6">
              <form
                onSubmit={(e) => void handleUnlockWithPin(e)}
                className={`rounded-2xl border p-5 space-y-4 shadow-sm ${cardBg}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold">관리자 PIN 인증</h3>
                    <p className={`text-xs mt-0.5 ${mutedText}`}>
                      관리자 비밀번호 입력 후 자료 업로드 및 초대 관리가 열립니다.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showPinValue ? 'text' : 'password'}
                    inputMode="numeric"
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError(null);
                    }}
                    placeholder="관리자 PIN 입력"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-base sm:text-sm font-mono font-extrabold tracking-widest focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinValue((v) => !v)}
                    aria-label="PIN 표시 전환"
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg cursor-pointer ${mutedText}`}
                  >
                    {showPinValue ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {pinError && (
                  <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-xs font-bold">
                    {pinError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="w-full py-2.5 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-60 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  {isVerifyingPin ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{isVerifyingPin ? '검증 중...' : '잠금 해제'}</span>
                </button>
              </form>
            </div>
          ) : activeHubTab === 'datasets' ? (
            <StoreAdminDatasetCardsGrid
              ctx={{
                cardBg,
                cardFeedback,
                careExcelRef,
                handleCareExcelUpload,
                handleCareResend,
                handleDeleteScheduleMonth,
                handleIncentiveExcelUpload,
                handleIncentivePhotoUpload,
                handleIncentiveResend,
                handleInstallmentResend,
                handleInstallmentUpload,
                handlePullAllDatasetsFromCloud,
                handleScheduleFileUpload,
                handleScheduleResend,
                hasValidCloudUrl,
                incentiveExcelRef,
                incentivePhotoRef,
                incentiveYm,
                initialFocus,
                inputCls,
                installmentFileRef,
                isPullingFromCloud,
                mergeIncentiveInMonth,
                mutedText,
                renderCardBadge,
                scheduleExcelRef,
                schedulePhotoRef,
                setIncentiveYm,
                setMergeIncentiveInMonth,
                subBoxBg,
                summaries,
              }}
            />
          ) : activeHubTab === 'invites' ? (
            <StoreAdminFriendInvitesPanel
              ctx={{
                busyInviteCodeId,
                cardBg,
                copiedInviteCodeId,
                editProfileDraft,
                editingNoticeCodeId,
                editingProfileCodeId,
                friendInvites,
                friendNoticesMap,
                friendLabelInput,
                friendPanelError,
                friendRemoteProfiles,
                friendScheduleMap,
                handleClearSharedAiKey,
                handleCopyFriendInviteGuide,
                handleCycleMaxDevices,
                handleIssueFriendInvite,
                handleMutateFriendInvite,
                handleClearFriendNotice,
                handleOpenFriendNoticeEditor,
                handleOpenRemoteProfileEditor,
                handleRefreshFriendInvites,
                handleSaveFriendNotice,
                handleSaveRemoteProfileForFriend,
                handleSaveSharedAiKey,
                handleToggleFriendAiAllowed,
                handleToggleFriendScheduleAllowed,
                handleToggleGlobalSharedAi,
                inputCls,
                isFriendListCollapsed,
                isIssuingInvite,
                isLoadingInvites,
                isSavingFriendNotice,
                isSavingRemoteProfile,
                isSavingSharedAi,
                noticeDraftText,
                mutedText,
                newFriendMaxDevices,
                newFriendNameInput,
                newFriendPhoneInput,
                newFriendStoreInput,
                setEditProfileDraft,
                setEditingNoticeCodeId,
                setEditingProfileCodeId,
                setNoticeDraftText,
                setFriendLabelInput,
                setIsFriendListCollapsed,
                setNewFriendMaxDevices,
                setNewFriendNameInput,
                setNewFriendPhoneInput,
                setNewFriendStoreInput,
                setSharedKeyDraft,
                sharedAiState,
                sharedKeyDraft,
                subBoxBg,
              }}
            />
          ) : (
            <StoreAdminCloudBridgeBox
              ctx={{
                cardBg,
                cloudDiag,
                cloudPin,
                cloudVerified,
                friendInvites,
                gasUrl,
                handleCopyAppsScriptCode,
                handleCopyStaffAutoConnectLink,
                handlePullAllDatasetsFromCloud,
                handleSaveAndCheckCloud,
                hasValidCloudUrl,
                inputCls,
                isCheckingCloud,
                isPullingFromCloud,
                mutedText,
                needsSheetBinding,
                setCloudPin,
                setGasUrl,
                setShowCloudPin,
                setSpreadsheetIdInput,
                showCloudPin,
                spreadsheetIdInput,
                subBoxBg,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
