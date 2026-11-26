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
} from 'lucide-react';
import {
  StoreCloudKind,
  buildStaffAutoConnectUrl,
  clearStoreCloudMicroCache,
  deleteFriendRemoteProfile,
  fetchAllFriendRemoteProfiles,
  fetchStoreCloudDataset,
  FriendRemoteProfile,
  getStoreCloudAppsScriptCode,
  normalizeGasWebAppUrl,
  OWNER_CUSTOM_PIN_STORAGE_KEY,
  readRawSyncConfig,
  saveFriendRemoteProfile,
  saveStoreCloudDataset,
  STORE_CLOUD_UPDATED_EVENT,
  UNCONFIGURED_PIN_SENTINEL,
} from '../utils/storeCloudSync';
import {
  buildFriendInviteUrl,
  fetchFriendInviteList,
  formatFriendInviteCode,
  FriendInviteItem,
  issueNewFriendInvite,
  mutateFriendInviteStatus,
} from '../utils/friendAccessGuard';
import {
  ADMIN_MODE_CHANGED_EVENT,
  ADMIN_PIN_CODE,
  CARE_TABLE_UPDATED_EVENT,
  isAdminDevice,
  loadLocalCareDataset,
  parseCareExcelBuffer,
  refreshAdminPinBinding,
  saveGitHubSyncConfig,
  saveLocalCareDataset,
  setAdminDeviceUnlocked,
} from '../utils/careTableParser';
import {
  loadAllSchedules,
  parseScheduleFileForHub,
  saveAllSchedules,
  SCHEDULE_UPDATED_EVENT,
} from './ScheduleModal';
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
} from '../crm/utils/settlementEngine';
import { ModelIncentiveRule, ModelIncentivesMap } from '../crm/types/crm';
import {
  DEFAULT_INSTALLMENT_DATASET,
  INSTALLMENT_UPDATED_EVENT,
  loadLocalInstallmentDataset,
  parseInstallmentFile,
  saveLocalInstallmentDataset,
} from '../utils/installmentParser';
import { isOwnerMarketingDbUnlocked } from '../utils/marketingDbEngine';

export const OPEN_ADMIN_UPLOAD_HUB_EVENT = 'himart_gj_open_admin_upload_hub';

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

type StoredSchedulesMap = ReturnType<typeof loadAllSchedules>;

function formatHHMM(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 휴무표는 과거 월을 유지하되 최신 12개월 초과 시 오래된 월부터 자동 정리합니다.
 */
function pruneSchedulesToRecent12Months(
  map: StoredSchedulesMap
): StoredSchedulesMap {
  const validMonths = Object.keys(map || {})
    .filter((ym) => (map[ym]?.employees?.length || 0) > 0)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12);

  const pruned: StoredSchedulesMap = {};
  for (const ym of validMonths) {
    pruned[ym] = map[ym];
  }
  return pruned;
}

export const StoreAdminUploadHubModal: React.FC<StoreAdminUploadHubModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  initialFocus = null,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminDevice());
  const [pinInput, setPinInput] = useState<string>('');
  const [showPinValue, setShowPinValue] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  // 클라우드 연결 설정 상태
  const [gasUrl, setGasUrl] = useState<string>(() => readRawSyncConfig().repo);
  const [cloudPin, setCloudPin] = useState<string>(() => readRawSyncConfig().token);
  const [showCloudPin, setShowCloudPin] = useState<boolean>(false);
  const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
  const [cloudVerified, setCloudVerified] = useState<boolean | null>(null);

  // 상단 글로벌 토스트
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // 4대 자료 로컬 현황 스냅샷 리비전
  const [dataTick, setDataTick] = useState<number>(0);

  // 모델별 수당 단가표 대상 연월 및 병합 옵션 (기본 unchecked = Clean Replace)
  const [incentiveYm, setIncentiveYm] = useState<string>(() => getCurrentYearMonth());
  const [mergeIncentiveInMonth, setMergeIncentiveInMonth] = useState<boolean>(false);

  // 외부 지인(친구) 전용 기기 잠금 초대코드 관리 상태
  const [friendLabelInput, setFriendLabelInput] = useState<string>('친구1');
  const [newFriendMaxDevices, setNewFriendMaxDevices] = useState<number>(1);
  const [isFriendListCollapsed, setIsFriendListCollapsed] =
    useState<boolean>(false);
  const [newFriendStoreInput, setNewFriendStoreInput] = useState<string>('');
  const [newFriendNameInput, setNewFriendNameInput] = useState<string>('');
  const [newFriendPhoneInput, setNewFriendPhoneInput] = useState<string>('');
  const [friendInvites, setFriendInvites] = useState<FriendInviteItem[]>([]);
  const [friendRemoteProfiles, setFriendRemoteProfiles] = useState<
    Record<string, FriendRemoteProfile>
  >({});
  const [editingProfileCodeId, setEditingProfileCodeId] = useState<string | null>(
    null
  );
  const [editProfileDraft, setEditProfileDraft] = useState<{
    storeName: string;
    consultantName: string;
    phone: string;
  }>({ storeName: '', consultantName: '', phone: '' });
  const [isSavingRemoteProfile, setIsSavingRemoteProfile] =
    useState<boolean>(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState<boolean>(false);
  const [isIssuingInvite, setIsIssuingInvite] = useState<boolean>(false);
  const [busyInviteCodeId, setBusyInviteCodeId] = useState<string | null>(null);
  const [copiedInviteCodeId, setCopiedInviteCodeId] = useState<string | null>(null);
  const [friendPanelError, setFriendPanelError] = useState<string | null>(null);

  // 카드별 업로드 상태 배지
  const [cardFeedback, setCardFeedback] = useState<
    Record<StoreCloudKind, CardUploadFeedback>
  >({
    schedule: { status: 'idle', message: '' },
    incentive: { status: 'idle', message: '' },
    care: { status: 'idle', message: '' },
    installment: { status: 'idle', message: '' },
  });

  // 파일 input refs
  const scheduleExcelRef = useRef<HTMLInputElement>(null);
  const schedulePhotoRef = useRef<HTMLInputElement>(null);
  const incentiveExcelRef = useRef<HTMLInputElement>(null);
  const incentivePhotoRef = useRef<HTMLInputElement>(null);
  const careExcelRef = useRef<HTMLInputElement>(null);
  const installmentFileRef = useRef<HTMLInputElement>(null);

  const showToastMessage = (
    type: 'success' | 'error' | 'info',
    text: string
  ) => {
    setToast({ type, text });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 모달 열릴 때 최신 설정·권한·로컬 스냅샷 동기화
  useEffect(() => {
    if (!isOpen) return;
    const rawCfg = readRawSyncConfig();
    setGasUrl(rawCfg.repo);
    setCloudPin(rawCfg.token);
    setIsAdmin(isOwnerMarketingDbUnlocked() && isAdminDevice());
    setPinInput('');
    setPinError(null);
    setIsVerifyingPin(false);
    setEditingProfileCodeId(null);
    setCloudVerified(normalizeGasWebAppUrl(rawCfg.repo) ? null : false);
    setDataTick((v) => v + 1);
  }, [isOpen]);

  // 관리자 인증 상태에서 시트 URL · PIN이 준비되어 있으면 친구 초대코드 목록 + 원격 프로필 자동 로드
  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    const rawCfg = readRawSyncConfig();
    const targetUrl = normalizeGasWebAppUrl(gasUrl || rawCfg.repo);
    const targetPin = (cloudPin || rawCfg.token).trim();
    if (!targetUrl || targetPin.length < 4) return;

    let cancelled = false;
    setIsLoadingInvites(true);
    setFriendPanelError(null);
    void Promise.all([
      fetchFriendInviteList(targetUrl, targetPin),
      fetchAllFriendRemoteProfiles(targetUrl),
    ])
      .then(([res, remoteMap]) => {
        if (cancelled) return;
        setFriendRemoteProfiles(remoteMap || {});
        if (res.ok) {
          setFriendInvites(res.items);
          if (res.items.length >= 3) {
            setIsFriendListCollapsed(true);
          }
        } else {
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

  // 관리자 권한 및 4대 데이터 변경 이벤트 구독
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

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // 4대 자료 현재 상태 요약 계산
  const summaries = useMemo(() => {
    void dataTick;
    // 1. 휴무표
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

    // 2. 모델별 수당단가표 (순수 공식 단가 기준 집계)
    const officialIncentiveSheets = stripPersonalLocalFromIncentiveMap(
      loadAllModelIncentiveSheets()
    );
    const activeIncentiveSheet = officialIncentiveSheets[incentiveYm] || null;
    const allIncentiveMonths = Object.keys(officialIncentiveSheets)
      .filter((ym) => (officialIncentiveSheets[ym]?.rules?.length || 0) > 0)
      .sort()
      .reverse();

    // 3. 안심케어 조견표
    const careDataset = loadLocalCareDataset();

    // 4. 카드 무이자할부
    const installmentDataset = loadLocalInstallmentDataset();

    return {
      schedule: {
        hasData: regScheduleMonths.length > 0,
        version: latestScheduleYm || '미등록',
        countText: latestSchedule
          ? `${latestSchedule.employees.length}명 (총 ${regScheduleMonths.length}개월)`
          : '0명',
        updatedAt: latestSchedule?.updatedAt || '-',
        months: scheduleMonthItems,
      },
      incentive: {
        hasData: Boolean(
          activeIncentiveSheet && activeIncentiveSheet.rules.length > 0
        ),
        totalMonths: allIncentiveMonths.length,
        version: incentiveYm,
        countText: activeIncentiveSheet
          ? `공식 ${activeIncentiveSheet.rules.length.toLocaleString()}개 모델`
          : '0개 모델',
        updatedAt: activeIncentiveSheet?.updatedAt || '-',
      },
      care: {
        hasData: Boolean(careDataset && careDataset.items.length > 0),
        version: careDataset?.versionTitle || '미등록',
        countText: careDataset
          ? `${careDataset.items.length.toLocaleString()}개 코드`
          : '0개 코드',
        updatedAt: careDataset?.updatedAt || '-',
      },
      installment: {
        hasData: installmentDataset.columns.length > 0,
        version: installmentDataset.versionTitle || '미등록',
        countText:
          installmentDataset.columns.length > 0
            ? `${installmentDataset.columns.length}개 카드`
            : '0개 카드',
        updatedAt: installmentDataset.updatedAt || '-',
      },
    };
  }, [dataTick, incentiveYm]);

  if (!isOpen) return null;

  const setKindFeedback = (
    kind: StoreCloudKind,
    next: CardUploadFeedback
  ) => {
    setCardFeedback((prev) => ({ ...prev, [kind]: next }));
  };

  // ==================== 1) 관리자 PIN 잠금 해제 (등록 PIN 또는 서버 측 PIN 검증 전용) ====================
  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingPin) return;

    const cleanedPin = pinInput.trim();
    if (cleanedPin.length < 4) {
      setPinError('관리자 PIN을 4자리 이상(권장 8자리) 입력해 주세요.');
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

    // A) 기기에 이미 등록된 PIN이 있는 경우 -> 정확히 일치해야만 잠금 해제
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
        showToastMessage(
          'success',
          '🔓 관리자 인증 완료! 4대 매장 자료를 한곳에서 업로드·동기화할 수 있습니다.'
        );
      } else {
        setPinError('관리자 비밀번호(PIN)가 일치하지 않습니다.');
      }
      return;
    }

    // B) 로컬에 등록된 PIN이 없는 기기 -> 임의 신규 설정 차단, 반드시 구글 시트 서버 측 PIN 검증 통과 필요
    const normalizedUrl = normalizeGasWebAppUrl(rawCfg.repo);
    if (!normalizedUrl) {
      setPinError(
        '등록된 관리자 PIN 또는 구글 시트 연결 정보가 없는 기기에서는 접근할 수 없습니다.'
      );
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);
    try {
      const probeKinds: StoreCloudKind[] = [
        'schedule',
        'incentive',
        'care',
        'installment',
      ];
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
        setPinError(
          '구글 시트에 저장된 기준 데이터가 없어 서버 측 PIN 검증을 진행할 수 없습니다.'
        );
        return;
      }

      const verifyRes = await saveStoreCloudDataset(probeKind, probeData, {
        repo: normalizedUrl,
        token: cleanedPin,
      });

      if (!verifyRes.ok) {
        setPinError(
          verifyRes.message ||
            '구글 시트 서버 PIN 검증에 실패했습니다. 관리자 비밀번호를 확인해 주세요.'
        );
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
      showToastMessage(
        'success',
        '🔓 구글 시트 서버 PIN 검증 완료! 통합 업로드 센터가 잠금 해제되었습니다.'
      );
    } catch {
      setPinError(
        '구글 시트 서버 연결에 실패하여 관리자 인증을 완료할 수 없습니다.'
      );
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // ==================== 2) 상단 클라우드 연결 저장 & 검증 ====================
  const handleSaveAndCheckCloud = async () => {
    const cleanUrl = gasUrl.trim();
    const cleanPin = cloudPin.trim();
    const normalized = normalizeGasWebAppUrl(cleanUrl);

    if (!normalized) {
      showToastMessage(
        'error',
        '올바른 구글 Apps Script 웹앱 URL(https://script.google.com/macros/s/.../exec)을 입력해 주세요.'
      );
      setCloudVerified(false);
      return;
    }
    if (cleanPin.length < 4) {
      showToastMessage(
        'error',
        '관리자 업로드 비밀번호(PIN)를 4자리 이상 입력해 주세요.'
      );
      return;
    }

    saveGitHubSyncConfig({
      repo: normalized,
      branch: 'main',
      token: cleanPin,
    });
    refreshAdminPinBinding();
    clearStoreCloudMicroCache();
    setGasUrl(normalized);
    setCloudPin(cleanPin);

    setIsCheckingCloud(true);
    try {
      const probe = await fetchStoreCloudDataset('schedule', {
        bypassCache: true,
        gasUrlOverride: normalized,
      });
      setCloudVerified(true);
      window.dispatchEvent(new CustomEvent(STORE_CLOUD_UPDATED_EVENT));
      void fetchFriendInviteList(normalized, cleanPin).then((invRes) => {
        if (invRes.ok) {
          setFriendInvites(invRes.items);
          setFriendPanelError(null);
        }
      });
      showToastMessage(
        'success',
        probe !== null
          ? '✅ 비공개 구글 시트 연결 저장 및 응답 확인 완료! (전 직원 공유 준비됨)'
          : '✅ 연결 설정 저장 완료! 이제 아래 4개 카드에서 자료를 업로드하면 시트에 자동 적재됩니다.'
      );
    } catch {
      setCloudVerified(false);
      showToastMessage(
        'error',
        '연결 설정은 저장되었으나 시트 응답 확인에 실패했습니다. Apps Script 웹앱 배포 권한을 확인해 주세요.'
      );
    } finally {
      setIsCheckingCloud(false);
    }
  };

  const handleCopyStaffAutoConnectLink = () => {
    const staffLink = buildStaffAutoConnectUrl(gasUrl.trim());
    if (!staffLink) {
      showToastMessage(
        'error',
        '먼저 구글 Apps Script 웹앱 URL을 입력하고 [연결 저장·확인]을 눌러주세요.'
      );
      return;
    }
    void navigator.clipboard
      ?.writeText(staffLink)
      .then(() => {
        showToastMessage(
          'success',
          '📋 전 직원 원클릭 자동연결 링크 복사 완료! (관리자 PIN 제외 · 카톡 단톡방에 바로 붙여넣기 하세요)'
        );
      })
      .catch(() => {
        showToastMessage('error', '클립보드 복사에 실패했습니다.');
      });
  };

  const handleCopyAppsScriptCode = () => {
    void navigator.clipboard
      ?.writeText(getStoreCloudAppsScriptCode())
      .then(() => {
        showToastMessage(
          'info',
          'Apps Script(Code.gs) 코드가 복사되었습니다. 구글 시트 [확장 프로그램 → Apps Script]에 붙여넣고 웹 앱으로 배포하세요.'
        );
      })
      .catch(() => {
        showToastMessage('error', '클립보드 복사에 실패했습니다.');
      });
  };

  // ==================== 외부 지인(친구) 전용 1기기 잠금 초대코드 핸들러 ====================
  const resolveActiveCloudAuth = (): { url: string; pin: string } | null => {
    const rawCfg = readRawSyncConfig();
    const url = normalizeGasWebAppUrl(gasUrl.trim() || rawCfg.repo);
    const pin = (cloudPin.trim() || rawCfg.token).trim();
    if (!url || pin.length < 4) {
      showToastMessage(
        'error',
        '상단 비공개 구글 시트 URL과 관리자 PIN을 먼저 입력하고 [연결 저장·확인]을 눌러주세요.'
      );
      return null;
    }
    return { url, pin };
  };

  const handleRefreshFriendInvites = async () => {
    const auth = resolveActiveCloudAuth();
    if (!auth) return;
    setIsLoadingInvites(true);
    setFriendPanelError(null);
    try {
      const [res, remoteMap] = await Promise.all([
        fetchFriendInviteList(auth.url, auth.pin),
        fetchAllFriendRemoteProfiles(auth.url),
      ]);
      setFriendRemoteProfiles(remoteMap || {});
      if (res.ok) {
        setFriendInvites(res.items);
      } else {
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
        newFriendMaxDevices
      );
      if (!res.ok) {
        const msg =
          res.error ||
          '8자리 초대코드 발급에 실패했습니다. Apps Script 코드가 최신 버전인지 확인해 주세요.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
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

  const handleCycleMaxDevices = async (item: FriendInviteItem) => {
    if (busyInviteCodeId) return;
    const auth = resolveActiveCloudAuth();
    if (!auth) return;

    const currentMax = Math.max(1, item.maxDevices || 1);
    const nextMax = currentMax === 1 ? 2 : currentMax === 2 ? 3 : 1;

    setBusyInviteCodeId(item.codeId);
    setFriendPanelError(null);
    try {
      const res = await mutateFriendInviteStatus(
        auth.url,
        auth.pin,
        item.codeId,
        'set_max_devices',
        { maxDevices: nextMax }
      );
      if (!res.ok) {
        const rawErr = res.error || '';
        const msg = rawErr.includes('set_max_devices')
          ? '코드 1개로 다중 기기(폰+PC 2대 등) 허용 기능을 쓰시려면 상단 [Apps Script 코드 복사]를 눌러 구글 시트 Code.gs를 최신 코드로 1회 업데이트(새 버전 배포)해 주세요! (또는 PC용 별도 코드를 1개 더 발급하셔도 됩니다.)'
          : rawErr || '허용 기기수 변경에 실패했습니다.';
        setFriendPanelError(msg);
        showToastMessage('error', `⚠️ ${msg}`);
        return;
      }
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

    // URL 주소창 노출 최소화를 위해 단축 URL 자동 시도 (실패/지연 시 즉시 원본 URL 사용)
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
        mode
      );
      if (!res.ok) {
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
      }
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

  // 공통 클라우드 업로드 헬퍼 (설정창 최신 입력값 우선 반영)
  const pushDatasetToCloud = async (
    kind: StoreCloudKind,
    payload: unknown,
    localSummaryText: string
  ) => {
    const res = await saveStoreCloudDataset(kind, payload, {
      repo: gasUrl.trim() || readRawSyncConfig().repo,
      token: cloudPin.trim() || readRawSyncConfig().token,
    });
    const hhmm = formatHHMM();
    if (res.ok) {
      setKindFeedback(kind, {
        status: 'success',
        message: `구글 시트 적재 완료 (${hhmm}) · ${localSummaryText}`,
        timeLabel: hhmm,
      });
      setCloudVerified(true);
      showToastMessage(
        'success',
        `✓ 구글 시트 적재 완료 (${hhmm}) — ${localSummaryText}`
      );
    } else if (!res.configured) {
      setKindFeedback(kind, {
        status: 'warning',
        message: `내 기기 반영 완료 · 시트 미연결 (${res.message})`,
        timeLabel: hhmm,
      });
      showToastMessage(
        'info',
        `내 기기에 저장되었습니다. 전 직원 반영을 위해 상단 구글 시트 URL·PIN을 저장해 주세요.`
      );
    } else {
      setKindFeedback(kind, {
        status: 'error',
        message: res.message,
      });
      showToastMessage('error', `⚠️ ${res.message}`);
    }
    setDataTick((v) => v + 1);
  };

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

  // 스타일 헬퍼
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
          <span className="break-words leading-snug">✓ {fb.message}</span>
        </div>
      );
    }
    if (fb.status === 'warning') {
      return (
        <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11.5px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="break-words leading-snug">{fb.message}</span>
        </div>
      );
    }
    if (fb.status === 'error') {
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

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[94dvh] rounded-[24px] border shadow-2xl flex flex-col overflow-hidden ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== 모달 상단 헤더 ==================== */}
        <div
          className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark
              ? 'bg-[#131C2E] border-slate-800'
              : 'bg-white border-[#E5E8EB]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#191F28] dark:bg-[#1B64DA] text-white flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-[15px] sm:text-base font-extrabold tracking-tight truncate">
                  매장 자료 통합 업로드 센터
                </h2>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black shrink-0">
                    관리자 인증됨
                  </span>
                )}
              </div>
              <p className={`text-[11.5px] font-medium truncate ${mutedText}`}>
                휴무표 · 모델수당 · 안심케어 · 무이자할부 — 비공개 구글 시트 1-STOP 동기화
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminDeviceUnlocked(false);
                  setIsAdmin(false);
                  showToastMessage('info', '🔒 관리자 모드가 잠금 처리되었습니다.');
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

        {/* ==================== 알림 토스트 배너 ==================== */}
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

        {/* ==================== 본문 스크롤 영역 ==================== */}
        <div
          className={`flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 ${
            isDark ? 'bg-[#0B1120]' : 'bg-[#F2F4F6]'
          }`}
        >
          {!isAdmin ? (
            /* ==================== 관리자 PIN 잠금 해제 화면 ==================== */
            <div className="max-w-md mx-auto my-4 sm:my-8">
              <form
                onSubmit={(e) => void handleUnlockWithPin(e)}
                className={`rounded-2xl border p-5 sm:p-6 space-y-4 shadow-sm ${cardBg}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold">
                      관리자 비밀번호(PIN) 인증
                    </h3>
                    <p className={`text-xs font-medium mt-0.5 ${mutedText}`}>
                      등록된 관리자 PIN 또는 비공개 구글 시트 서버 PIN 검증을 통과해야 통합 업로드 센터가 열립니다.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={`block text-xs font-extrabold ${mutedText}`}>
                    관리자 업로드 비밀번호 (PIN)
                  </label>
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
                      placeholder="관리자 PIN 입력 (예: 8자리 숫자)"
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
                </div>

                {pinError && (
                  <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-xs font-bold">
                    ⚠️ {pinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="w-full py-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-60 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
                >
                  {isVerifyingPin ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {isVerifyingPin
                      ? '구글 시트 서버 PIN 검증 중...'
                      : '인증하고 통합 업로드 센터 열기'}
                  </span>
                </button>

                <div className="pt-1 text-[11.5px]">
                  <span className={mutedText}>
                    보안 정책상 미인증 기기의 임의 PIN 등록은 차단되며, 비밀번호는 인증된 기기 로컬에만 보관됩니다.
                  </span>
                </div>
              </form>
            </div>
          ) : (
            /* ==================== 인증 완료: 통합 업로드 센터 본문 ==================== */
            <>
              {/* 1) 상단 클라우드 연결 요약 바 + 대형 직원 자동연결 링크 복사 버튼 */}
              <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cloud className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold truncate">
                      비공개 구글 시트 (Apps Script) 클라우드 브릿지
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                        hasValidCloudUrl
                          ? cloudVerified === false
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300'
                          : 'bg-[#F2F4F6] dark:bg-slate-800 text-[#8B95A1]'
                      }`}
                    >
                      {hasValidCloudUrl
                        ? cloudVerified === true
                          ? '● 연결 확인됨'
                          : '● URL 설정됨'
                        : '미설정'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAppsScriptCode}
                    className={`self-start sm:self-auto px-2.5 py-1.5 rounded-xl border text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${subBoxBg}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Apps Script 코드 복사</span>
                  </button>
                </div>

                {/* 대형 CTA: 전 직원 원클릭 자동연결 링크 복사 */}
                <button
                  type="button"
                  onClick={handleCopyStaffAutoConnectLink}
                  className="w-full py-3 px-3.5 sm:px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition text-center leading-snug"
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span>
                    📋 전 직원 원클릭 자동연결 링크 복사{' '}
                    <span className="opacity-90 font-bold text-[11px] sm:text-xs">
                      (단톡방 공유 · PIN 제외)
                    </span>
                  </span>
                </button>

                {/* URL + PIN 입력 및 [연결 저장·확인] */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <input
                      type="url"
                      value={gasUrl}
                      onChange={(e) => setGasUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                  </div>
                  <div className="sm:col-span-4 relative">
                    <input
                      type={showCloudPin ? 'text' : 'password'}
                      inputMode="numeric"
                      value={cloudPin}
                      onChange={(e) => setCloudPin(e.target.value)}
                      placeholder="관리자 PIN (업로드 비밀번호)"
                      className={`w-full pl-3 pr-9 py-2 rounded-xl border text-base sm:text-xs font-mono font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCloudPin((v) => !v)}
                      aria-label="PIN 표시 전환"
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer ${mutedText}`}
                    >
                      {showCloudPin ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isCheckingCloud}
                    onClick={() => void handleSaveAndCheckCloud()}
                    className="sm:col-span-2 py-2 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    {isCheckingCloud ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>연결 저장·확인</span>
                  </button>
                </div>
              </div>

              {/* 1-B) 외부 지인(친구) 전용 기기 잠금 초대코드 관리 패널 */}
              <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold">
                        🔐 외부 지인(친구) 전용 초대코드 관리 (휴무표·랜딩 분리)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[10.5px] font-black">
                        총 {friendInvites.length}명
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium mt-0.5 ${mutedText}`}>
                      허용된 기기 대수(1대 휴대폰 전용 또는 2대 휴대폰+PC 동시 사용)만큼만 귀속되며, 내 랜딩페이지·휴무표·네이버지도는 완전 분리됩니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                    {friendInvites.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsFriendListCollapsed((v) => !v)}
                        className={`px-3 py-1.5 rounded-xl border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition ${
                          isFriendListCollapsed
                            ? 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/35'
                            : subBoxBg
                        }`}
                      >
                        {isFriendListCollapsed ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>목록 펼치기 ({friendInvites.length}명)</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>목록 접기</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isLoadingInvites}
                      onClick={() => void handleRefreshFriendInvites()}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${subBoxBg}`}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isLoadingInvites ? 'animate-spin' : ''
                        }`}
                      />
                      <span>새로고침</span>
                    </button>
                  </div>
                </div>

                {/* 별칭 + 초기 지점명·담당자(선택) + 허용 기기수(1대/2대 폰+PC/3대) + [+ 8자리 코드 발급] */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={friendLabelInput}
                      onChange={(e) => setFriendLabelInput(e.target.value)}
                      placeholder="관리용 별칭 (예: 친구1)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={newFriendStoreInput}
                      onChange={(e) => setNewFriendStoreInput(e.target.value)}
                      placeholder="소속 지점명 (선택, 예: 롯데하이마트 수원점)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={newFriendNameInput}
                      onChange={(e) => setNewFriendNameInput(e.target.value)}
                      placeholder="담당자 이름 (선택, 예: 홍길동)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={newFriendPhoneInput}
                      onChange={(e) => setNewFriendPhoneInput(e.target.value)}
                      placeholder="담당자 연락처 (선택)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-extrabold ${mutedText}`}>
                        허용 기기수:
                      </span>
                      {[
                        { val: 1, label: '📱 1대 (폰 전용)' },
                        { val: 2, label: '📱+💻 2대 (폰+PC)' },
                        { val: 3, label: '3대' },
                      ].map((opt) => {
                        const active = newFriendMaxDevices === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setNewFriendMaxDevices(opt.val)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold cursor-pointer transition ${
                              active
                                ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                                : `${subBoxBg} hover:border-[#1B64DA]`
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={isIssuingInvite}
                      onClick={() => void handleIssueFriendInvite()}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-55 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      {isIssuingInvite ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>+ 8자리 초대코드 발급 ({newFriendMaxDevices}대)</span>
                    </button>
                  </div>
                  <p className={`text-[11px] font-semibold break-keep ${mutedText}`}>
                    💡 한 친구가 <strong>휴대폰 + 컴퓨터(PC)</strong>를 같이 쓰길 원하면 <strong>[📱+💻 2대 (폰+PC)]</strong>로 설정하세요! 코드 1개로 폰과 PC 2대까지 등록됩니다. (※ 기존 구글 시트를 쓰시는 경우 상단 [Apps Script 코드 복사]로 Code.gs를 1회 업데이트하시면 코드 1개 다중기기 기능이 바로 활성화됩니다.)
                  </p>
                </div>

                {friendPanelError && (
                  <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-[11.5px] font-bold">
                    ⚠️ {friendPanelError}
                  </div>
                )}

                {/* 발급된 초대코드 목록 (접기/펼치기 지원) */}
                {friendInvites.length === 0 ? (
                  <div
                    className={`px-3.5 py-3 rounded-xl border text-xs font-medium ${subBoxBg} ${mutedText}`}
                  >
                    {isLoadingInvites
                      ? '비공개 구글 시트에서 초대코드 목록을 불러오는 중입니다...'
                      : '발급된 외부 지인용 초대코드가 없습니다. 위에서 별칭과 허용 기기수를 선택한 뒤 [+ 8자리 초대코드 발급]을 눌러주세요.'}
                  </div>
                ) : isFriendListCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsFriendListCollapsed(false)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 cursor-pointer transition hover:border-[#1B64DA] ${subBoxBg}`}
                  >
                    <span className="truncate">
                      👥 발급된 초대코드 총 <strong>{friendInvites.length}명</strong> 목록이 접혀 있습니다 ({friendInvites.map((f) => f.label).slice(0, 4).join(', ')}{friendInvites.length > 4 ? ' 외' : ''})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#1B64DA] dark:text-blue-300 shrink-0">
                      <span>펼치기</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {friendInvites.map((item) => {
                      const formattedCode = formatFriendInviteCode(item.inviteCode);
                      const isBusy = busyInviteCodeId === item.codeId;
                      const isCopied = copiedInviteCodeId === item.codeId;
                      const isRevoked = item.status === 'REVOKED';
                      const assignedProf = friendRemoteProfiles[item.codeId];
                      const hasAssignedProf = Boolean(
                        assignedProf &&
                          (assignedProf.storeName ||
                            assignedProf.consultantName ||
                            assignedProf.phone)
                      );
                      const isEditingThis = editingProfileCodeId === item.codeId;
                      const maxDev = Math.max(1, item.maxDevices || 1);
                      const boundCnt =
                        typeof item.boundDeviceCount === 'number'
                          ? item.boundDeviceCount
                          : item.status === 'BOUND'
                          ? 1
                          : 0;
                      const statusBadge =
                        item.status === 'BOUND'
                          ? {
                              text:
                                boundCnt < maxDev
                                  ? `${boundCnt}/${maxDev}대 등록 (추가등록 가능)`
                                  : `${boundCnt}/${maxDev}대 등록잠금`,
                              cls: 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/30',
                            }
                          : item.status === 'REVOKED'
                          ? {
                              text: '차단됨 REVOKED',
                              cls: 'bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border-[#FECDD3] dark:border-rose-500/35',
                            }
                          : {
                              text: `대기중 (0/${maxDev}대)`,
                              cls: 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/35',
                            };

                      return (
                        <div
                          key={item.codeId}
                          className={`p-3 rounded-xl border space-y-2.5 ${subBoxBg}`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-black tracking-wider text-[#1B64DA] dark:text-blue-300">
                                  {formattedCode}
                                </span>
                                <span className="text-xs font-extrabold">
                                  {item.label}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black ${statusBadge.cls}`}
                                >
                                  {statusBadge.text}
                                </span>
                                {hasAssignedProf ? (
                                  <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/20 border border-[#BFDBFE] dark:border-blue-500/35 text-[#1B64DA] dark:text-blue-200 text-[11px] font-extrabold">
                                    📍 {assignedProf.storeName || '롯데하이마트'}
                                    {assignedProf.consultantName
                                      ? ` · 👤 ${assignedProf.consultantName}`
                                      : ''}
                                    {assignedProf.phone
                                      ? ` · ${assignedProf.phone}`
                                      : ''}
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[11px] font-semibold ${mutedText}`}
                                  >
                                    (지점·이름 원격 미지정 · 기본 표기: 롯데하이마트)
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[11px] font-medium flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono tabular-nums ${mutedText}`}
                              >
                                <span>
                                  최근 접속: {item.lastSeenAt || item.boundAt || '미접속'}
                                </span>
                                {item.createdAt && (
                                  <span>· 발급: {item.createdAt}</span>
                                )}
                                {item.boundDevicePreview && (
                                  <span>· 기기ID: {item.boundDevicePreview}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleCycleMaxDevices(item)}
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${cardBg}`}
                                title="클릭할 때마다 허용 기기수를 1대(휴대폰) → 2대(폰+PC) → 3대로 변경합니다"
                              >
                                <Smartphone className="w-3 h-3 shrink-0 text-[#1B64DA] dark:text-blue-300" />
                                <span>허용 {maxDev}대 변경</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleOpenRemoteProfileEditor(item)}
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                  isEditingThis
                                    ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-blue-600 dark:border-blue-500'
                                    : `${cardBg} text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/40`
                                }`}
                                title="이미 설치·등록된 친구 기기의 고객 견적서 지점명·이름·연락처를 원격으로 지정하거나 수정합니다"
                              >
                                <Pencil className="w-3 h-3 shrink-0" />
                                <span>지점·이름 원격수정</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleCopyFriendInviteGuide(item)}
                                className="py-1.5 px-2.5 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                    <span>복사됨!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 shrink-0" />
                                    <span>초대 안내문 복사</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(item, 'reset_device')
                                }
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${cardBg}`}
                                title="휴대폰 기기변경 시 기존 귀속을 풀어 새 휴대폰 1대를 다시 등록할 수 있게 초기화"
                              >
                                <RotateCcw className="w-3 h-3 shrink-0" />
                                <span>기기 초기화</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(
                                    item,
                                    isRevoked ? 'activate' : 'revoke'
                                  )
                                }
                                className={`py-1.5 px-2.5 rounded-lg text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                  isRevoked
                                    ? 'bg-[#059669] hover:bg-emerald-700 text-white'
                                    : 'bg-[#E60012] hover:bg-[#C8000F] text-white'
                                }`}
                              >
                                {isRevoked ? (
                                  <>
                                    <Unlock className="w-3 h-3 shrink-0" />
                                    <span>차단 해제</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3 shrink-0" />
                                    <span>즉시 차단</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(item, 'delete')
                                }
                                aria-label="초대코드 삭제"
                                title="초대코드 영구 삭제"
                                className={`p-1.5 rounded-lg border cursor-pointer disabled:opacity-50 hover:text-[#E60012] transition ${cardBg} ${mutedText}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditingThis && (
                            <div
                              className={`pt-2.5 border-t border-[#E5E8EB] dark:border-white/10 space-y-2`}
                            >
                              <div className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300">
                                ✏️ [{item.label}] 고객 견적서 표기 프로필 원격 지정 (이미 설치한 친구 기기에도 자동 동기화)
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    소속 지점명
                                  </label>
                                  <input
                                    type="text"
                                    value={editProfileDraft.storeName}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        storeName: e.target.value,
                                      }))
                                    }
                                    placeholder="예: 롯데하이마트 수원점"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    담당자 이름
                                  </label>
                                  <input
                                    type="text"
                                    value={editProfileDraft.consultantName}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        consultantName: e.target.value,
                                      }))
                                    }
                                    placeholder="예: 홍길동"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    담당자 직통 연락처 (선택)
                                  </label>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={editProfileDraft.phone}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        phone: e.target.value,
                                      }))
                                    }
                                    placeholder="010-0000-0000"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={isSavingRemoteProfile}
                                  onClick={() => setEditingProfileCodeId(null)}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${cardBg}`}
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingRemoteProfile}
                                  onClick={() =>
                                    void handleSaveRemoteProfileForFriend(item)
                                  }
                                  className="px-3.5 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 disabled:opacity-55 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  {isSavingRemoteProfile ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>친구 기기에 원격 반영</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2) 4대 자료 원스톱 업로드 카드 그리드 (모바일 1열 / 펼친화면·PC 2열) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* ==================== 카드 ① 월간 근무·휴무표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'schedule'
                      ? 'ring-2 ring-[#1B64DA] border-[#1B64DA]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ① 월간 근무·휴무표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_휴무표
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[11px] font-black font-mono shrink-0">
                        {summaries.schedule.version}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>등록 건수</div>
                        <div className="font-extrabold font-mono tabular-nums truncate">
                          {summaries.schedule.countText}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.schedule.updatedAt}
                        </div>
                      </div>
                    </div>

                    {summaries.schedule.months.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>
                          등록된 월별 휴무표 (최근 12개월 자동 보관 · × 클릭 시 시트에서 삭제)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {summaries.schedule.months.map((item) => (
                            <span
                              key={item.yearMonth}
                              className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border text-[11px] font-mono font-bold ${subBoxBg}`}
                            >
                              <span>
                                {item.yearMonth} ({item.count}명)
                              </span>
                              <button
                                type="button"
                                disabled={cardFeedback.schedule.status === 'working'}
                                onClick={() =>
                                  void handleDeleteScheduleMonth(item.yearMonth)
                                }
                                title={`${item.yearMonth} 휴무표 삭제`}
                                aria-label={`${item.yearMonth} 휴무표 삭제`}
                                className="p-0.5 rounded hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 text-[#8B95A1] hover:text-[#E60012] dark:hover:text-rose-300 cursor-pointer disabled:opacity-40 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {renderCardBadge('schedule')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <input
                      ref={scheduleExcelRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv"
                      onChange={handleScheduleFileUpload}
                      className="hidden"
                    />
                    <input
                      ref={schedulePhotoRef}
                      type="file"
                      accept="image/*"
                      onChange={handleScheduleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={cardFeedback.schedule.status === 'working'}
                      onClick={() => scheduleExcelRef.current?.click()}
                      className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      <span>엑셀 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={cardFeedback.schedule.status === 'working'}
                      onClick={() => schedulePhotoRef.current?.click()}
                      className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>사진 AI 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.schedule.status === 'working' ||
                        !summaries.schedule.hasData
                      }
                      onClick={() => void handleScheduleResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                      title="현재 기기에 저장된 휴무표를 비공개 구글 시트로 재전송"
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ② 모델별 판매수당 단가표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'incentive'
                      ? 'ring-2 ring-[#059669] border-[#059669]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ② 모델별 판매수당 단가표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_수당단가표
                          </p>
                        </div>
                      </div>
                      <input
                        type="month"
                        value={incentiveYm}
                        onChange={(e) =>
                          setIncentiveYm(e.target.value || getCurrentYearMonth())
                        }
                        aria-label="단가표 대상 연월"
                        className={`px-2 py-1 rounded-lg border text-base sm:text-[11.5px] font-mono font-extrabold shrink-0 max-w-full ${inputCls}`}
                      />
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>
                          {incentiveYm} 등록 건수
                        </div>
                        <div className="font-extrabold font-mono tabular-nums truncate">
                          {summaries.incentive.countText}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.incentive.updatedAt}
                        </div>
                      </div>
                    </div>

                    <label className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={mergeIncentiveInMonth}
                        onChange={(e) => setMergeIncentiveInMonth(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[#059669] cursor-pointer"
                      />
                      <span className={mutedText}>
                        기존 당월 목록에 추가 병합{' '}
                        <span className="opacity-75 font-medium">
                          (미체크 시 선택 월 100% 클린 교체)
                        </span>
                      </span>
                    </label>

                    {renderCardBadge('incentive')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <input
                      ref={incentiveExcelRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv"
                      multiple
                      onChange={handleIncentiveExcelUpload}
                      className="hidden"
                    />
                    <input
                      ref={incentivePhotoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleIncentivePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={cardFeedback.incentive.status === 'working'}
                      onClick={() => incentiveExcelRef.current?.click()}
                      className="flex-1 min-w-[115px] py-2 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>엑셀·시트 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={cardFeedback.incentive.status === 'working'}
                      onClick={() => incentivePhotoRef.current?.click()}
                      className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>사진 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.incentive.status === 'working' ||
                        !summaries.incentive.hasData
                      }
                      onClick={() => void handleIncentiveResend()}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>재전송</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const officialSheets = stripPersonalLocalFromIncentiveMap(
                          loadAllModelIncentiveSheets()
                        );
                        void downloadModelIncentiveExcelTemplate(
                          incentiveYm,
                          officialSheets[incentiveYm]?.rules || []
                        );
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition ${subBoxBg}`}
                      title="모델별 수당 엑셀 양식 다운로드"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>양식</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ③ 안심케어서비스 조견표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'care'
                      ? 'ring-2 ring-[#E60012] border-[#E60012]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ③ 안심케어서비스 조견표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_안심케어
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] text-[11px] font-black font-mono shrink-0">
                        {summaries.care.countText}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>적용 버전</div>
                        <div className="font-extrabold truncate">
                          {summaries.care.version}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.care.updatedAt}
                        </div>
                      </div>
                    </div>

                    {renderCardBadge('care')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <input
                      ref={careExcelRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleCareExcelUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={cardFeedback.care.status === 'working'}
                      onClick={() => careExcelRef.current?.click()}
                      className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-[#E60012] hover:bg-[#C8000F] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>조견표 엑셀(.xlsx) 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.care.status === 'working' ||
                        !summaries.care.hasData
                      }
                      onClick={() => void handleCareResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ④ 카드 무이자할부 행사표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'installment'
                      ? 'ring-2 ring-indigo-500 border-indigo-500'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ④ 카드 무이자할부 행사표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_무이자할부
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[11px] font-black font-mono shrink-0">
                        {summaries.installment.countText}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>행사 기준</div>
                        <div className="font-extrabold truncate">
                          {summaries.installment.version}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.installment.updatedAt}
                        </div>
                      </div>
                    </div>

                    {renderCardBadge('installment')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <input
                      ref={installmentFileRef}
                      type="file"
                      accept="image/*,.xlsx,.xls,.csv,.json"
                      onChange={handleInstallmentUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={cardFeedback.installment.status === 'working'}
                      onClick={() => installmentFileRef.current?.click()}
                      className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>이미지·엑셀 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.installment.status === 'working' ||
                        !summaries.installment.hasData
                      }
                      onClick={() => void handleInstallmentResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ==================== 하단 안내 바 ==================== */}
        <div
          className={`px-4 sm:px-6 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-medium shrink-0 ${
            isDark
              ? 'bg-[#131C2E] border-slate-800 text-slate-400'
              : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#4E5968]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            <span>
              모든 업로드 데이터는 GitHub에 기록되지 않고 비공개 구글 시트에만 암호화(PIN 검증) 저장됩니다.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
