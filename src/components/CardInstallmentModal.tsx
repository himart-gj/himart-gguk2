import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CloudUpload,
  CreditCard,
  Download,
  Edit3,
  Info,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Save,
  Settings,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildQuickSummariesFromColumns,
  DEFAULT_INSTALLMENT_DATASET,
  downloadInstallmentDatasetAsJson,
  fetchRemoteInstallmentDataset,
  GitHubSyncConfig,
  INSTALLMENT_ROW_LABELS,
  INSTALLMENT_UPDATED_EVENT,
  InstallmentCellData,
  InstallmentCellKind,
  InstallmentDataset,
  loadGitHubSyncConfig,
  loadLocalInstallmentDataset,
  parseInstallmentFile,
  pushInstallmentDatasetToGitHub,
  saveGitHubSyncConfig,
  saveLocalInstallmentDataset,
} from '../utils/installmentParser';
import {
  ADMIN_MODE_CHANGED_EVENT,
  ADMIN_PIN_CODE,
  isAdminDevice,
  setAdminDeviceUnlocked,
} from '../utils/careTableParser';

interface CardInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BRAND_FILTER_BUTTONS = [
  '전체',
  '롯데',
  '우리',
  'KB국민',
  '신한',
  '삼성',
  'NH농협',
  '하나',
  '광주',
  'BC',
  '현대',
] as const;

const CELL_KIND_OPTIONS: { value: InstallmentCellKind; label: string }[] = [
  { value: 'free', label: '■ 무이자 (블루 혜택 강조)' },
  { value: 'partial', label: '■ 부분무이자 (레드 강조)' },
  { value: 'sub-free', label: '■ 구독 전용 무이자 (에메랄드 강조)' },
  { value: 'interest', label: '□ 고객유이자 / 저리할부 (기본)' },
  { value: 'disabled', label: '■ 결제불가 (회색 비활성)' },
  { value: 'note', label: '📝 기타 안내 문구' },
];

export const CardInstallmentModal: React.FC<CardInstallmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dataset, setDataset] = useState<InstallmentDataset>(() =>
    loadLocalInstallmentDataset()
  );
  const [activeTab, setActiveTab] = useState<'table' | 'summary'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'summary' : 'table'
  );
  const [selectedBrand, setSelectedBrand] = useState<string>('전체');

  // 업로드 / AI 파싱 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // 전 직원 GitHub 동기화 설정 패널 상태 (조견표 GitHub 설정과 100% 공유)
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(() =>
    loadGitHubSyncConfig()
  );
  const [isPushingGh, setIsPushingGh] = useState(false);

  // 개별 셀 클릭 즉시 편집 상태
  const [editingCell, setEditingCell] = useState<{
    colId: string;
    brandTitle: string;
    rowLabel: string;
    kind: InstallmentCellKind;
    main: string;
    sub: string;
  } | null>(null);

  // 제목(기준월) 편집 상태
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(dataset.versionTitle);

  // 관리자 권한 상태 (관리자 PIN 인증 기기 또는 동기화 설정 보유 기기)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminDevice());
  const [isAdminPinOpen, setIsAdminPinOpen] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const adminTapCountRef = useRef<number>(0);
  const adminTapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncAdmin = () => setIsAdmin(isAdminDevice());
    const syncInstallment = () => {
      const fresh = loadLocalInstallmentDataset();
      setDataset(fresh);
      setTitleDraft(fresh.versionTitle);
    };
    window.addEventListener(ADMIN_MODE_CHANGED_EVENT, syncAdmin);
    window.addEventListener(INSTALLMENT_UPDATED_EVENT, syncInstallment);
    window.addEventListener('storage', syncAdmin);
    return () => {
      window.removeEventListener(ADMIN_MODE_CHANGED_EVENT, syncAdmin);
      window.removeEventListener(INSTALLMENT_UPDATED_EVENT, syncInstallment);
      window.removeEventListener('storage', syncAdmin);
    };
  }, []);

  const handleSecretAdminTap = () => {
    if (isAdmin) return;
    adminTapCountRef.current += 1;
    if (adminTapTimerRef.current) {
      window.clearTimeout(adminTapTimerRef.current);
    }
    if (adminTapCountRef.current >= 5) {
      adminTapCountRef.current = 0;
      setAdminPinInput('');
      setIsAdminPinOpen(true);
      return;
    }
    adminTapTimerRef.current = window.setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 1800);
  };

  const handleConfirmAdminPin = () => {
    if (adminPinInput.trim() === ADMIN_PIN_CODE) {
      setAdminDeviceUnlocked(true);
      setIsAdminPinOpen(false);
      setAdminPinInput('');
      setStatusMessage({
        type: 'success',
        text: '🔓 관리자 모드가 활성화되었습니다. (무이자 자료 업로드 · 전 직원 동기화 · 셀 직접 수정 가능)',
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: '⚠️ 관리자 비밀번호가 일치하지 않습니다.',
      });
    }
  };

  // 모달 열릴 때 최신 로컬 & 비공개 구글 시트(_매장공유_무이자할부) 동기화 확인
  useEffect(() => {
    if (!isOpen) return;
    setGhConfig(loadGitHubSyncConfig());
    const local = loadLocalInstallmentDataset();
    setDataset(local);
    setTitleDraft(local.versionTitle);

    fetchRemoteInstallmentDataset()
      .then((remote) => {
        if (remote && remote.columns.length > 0) {
          if (
            local.columns.length === 0 ||
            !local.updatedAt ||
            (remote.updatedAt && remote.updatedAt >= local.updatedAt)
          ) {
            saveLocalInstallmentDataset(remote);
            setDataset(remote);
            setTitleDraft(remote.versionTitle);
          }
        }
      })
      .catch(() => {
        // ignore
      });
  }, [isOpen]);

  // 모달 내부 하위 상태 뒤로가기 핸들러 등록
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (isAdminPinOpen) {
        setIsAdminPinOpen(false);
        setAdminPinInput('');
        return true;
      }
      if (editingCell !== null) {
        setEditingCell(null);
        return true;
      }
      if (isSyncPanelOpen) {
        setIsSyncPanelOpen(false);
        return true;
      }
      if (activeTab === 'summary') {
        setActiveTab('table');
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [isOpen, isAdminPinOpen, editingCell, isSyncPanelOpen, activeTab]);

  if (!isOpen) return null;

  const applyAndSaveDataset = async (
    nextData: InstallmentDataset,
    autoPushIfConfigured = true
  ) => {
    saveLocalInstallmentDataset(nextData);
    setDataset(nextData);
    setTitleDraft(nextData.versionTitle);

    const cfg = loadGitHubSyncConfig();
    if (autoPushIfConfigured && cfg.repo.trim() && cfg.token.trim()) {
      setIsPushingGh(true);
      const res = await pushInstallmentDatasetToGitHub(nextData, cfg);
      setIsPushingGh(false);
      setStatusMessage({
        type: res.ok ? 'success' : 'error',
        text: res.message,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploading(true);
    setStatusMessage({
      type: 'info',
      text: `⏳ [${file.name}] 무이자 할부 자료를 분석하여 표를 자동 업데이트하고 있습니다...`,
    });

    try {
      const updated = await parseInstallmentFile(file, dataset);
      await applyAndSaveDataset(updated, true);
      const cfg = loadGitHubSyncConfig();
      if (!cfg.repo.trim() || !cfg.token.trim()) {
        setStatusMessage({
          type: 'success',
          text: `✅ [${file.name}] 업로드 완료! (전 직원 동기화 설정 시 전 직원 스마트폰에 자동 배포됩니다)`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text:
          err?.message ||
          '무이자 할부 자료 분석 중 오류가 발생했습니다. 파일 형식을 확인해 주세요.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveGhConfigAndPush = async () => {
    saveGitHubSyncConfig(ghConfig);
    if (!ghConfig.repo.trim() || !ghConfig.token.trim()) {
      setStatusMessage({
        type: 'info',
        text: 'GitHub 설정이 저장되었습니다. 저장소와 토큰을 입력하면 전 직원 자동 배포가 활성화됩니다.',
      });
      return;
    }

    setIsPushingGh(true);
    const res = await pushInstallmentDatasetToGitHub(dataset, ghConfig);
    setIsPushingGh(false);
    setStatusMessage({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
    if (res.ok) {
      setIsSyncPanelOpen(false);
    }
  };

  const handleSaveCellEdit = async () => {
    if (!editingCell) return;
    const now = new Date();
    const updatedAt = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const nextCols = dataset.columns.map((col) => {
      if (col.id !== editingCell.colId) return col;
      return {
        ...col,
        rows: {
          ...col.rows,
          [editingCell.rowLabel]: {
            kind: editingCell.kind,
            main: editingCell.main.trim() || '-',
            sub: editingCell.sub.trim() || undefined,
          },
        },
      };
    });

    const nextData: InstallmentDataset = {
      ...dataset,
      updatedAt,
      columns: nextCols,
      quickSummaries: buildQuickSummariesFromColumns(
        nextCols,
        dataset.quickSummaries
      ),
    };

    setEditingCell(null);
    await applyAndSaveDataset(nextData, true);
    setStatusMessage({
      type: 'success',
      text: `✅ [${editingCell.brandTitle} - ${editingCell.rowLabel}] 항목이 수정되었습니다.`,
    });
  };

  const handleSaveTitle = async () => {
    const cleanTitle = titleDraft.trim() || dataset.versionTitle;
    setIsEditingTitle(false);
    const now = new Date();
    const updatedAt = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const nextData: InstallmentDataset = {
      ...dataset,
      updatedAt,
      versionTitle: cleanTitle,
    };
    await applyAndSaveDataset(nextData, true);
  };

  const handleResetDefault = () => {
    saveLocalInstallmentDataset(DEFAULT_INSTALLMENT_DATASET);
    setDataset(DEFAULT_INSTALLMENT_DATASET);
    setTitleDraft(DEFAULT_INSTALLMENT_DATASET.versionTitle);
    setStatusMessage({
      type: 'info',
      text: '로컬 무이자 할부 캐시가 초기화되었습니다. 비공개 구글 시트 동기화 또는 자료 업로드로 최신 행사표를 불러오세요.',
    });
  };

  const filteredColumns =
    selectedBrand === '전체'
      ? dataset.columns
      : dataset.columns.filter((col) => col.brand.includes(selectedBrand));

  const filteredQuickCards =
    selectedBrand === '전체'
      ? dataset.quickSummaries
      : dataset.quickSummaries.filter((c) => c.brandKey === selectedBrand);

  const renderCell = (cell: InstallmentCellData) => {
    switch (cell.kind) {
      case 'free':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-200 font-extrabold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11.5px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[11.5px] font-bold text-[#191F28] dark:text-slate-200 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'partial':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] font-extrabold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11.5px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-rose-200 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
      case 'sub-free':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-[#059669] dark:text-emerald-200 font-extrabold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11.5px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[11.5px] font-bold text-[#E60012] dark:text-[#FF3B47] mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'disabled':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-[#E5E8EB] dark:bg-slate-800/90 text-[#8B95A1] dark:text-slate-400 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11.5px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[11.5px] text-[#8B95A1] dark:text-slate-500 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'note':
        return (
          <div className="h-full w-full px-2 py-2 bg-[#F8FAFC] dark:bg-slate-900/70 text-[#4E5968] dark:text-slate-300 font-bold text-[11.5px] leading-snug text-left">
            {cell.main}
          </div>
        );
      case 'interest':
      default:
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-200 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11.5px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-400 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[1440px] h-[94dvh] sm:h-auto sm:max-h-[94dvh] rounded-t-[20px] sm:rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 border-t-[3px] border-t-[#E60012] shadow-2xl modal-kb-safe flex flex-col overflow-hidden text-[#191F28] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1) 모달 상단 헤더 (순수 카드 할부 조회 모달) */}
        <div className="bg-white dark:bg-[#131C2E] border-b border-[#E5E8EB] dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0 select-none">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 truncate select-none">
                  {dataset.versionTitle || '카드사별 무이자 · 부분무이자 할부 행사'}
                </h2>
              </div>
              <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium hidden sm:block mt-0.5 font-mono tabular-nums">
                {dataset.updatedAt
                  ? `업데이트: ${dataset.updatedAt} · 매월 최신 카드사 무이자 혜택이 자동 반영됩니다`
                  : '매월 최신 카드사 무이자 혜택이 자동 반영됩니다'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              aria-label="모달 닫기"
              className="w-9 h-9 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#4E5968] dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 알림 메시지 배너 */}
        {statusMessage && (
          <div
            className={`px-4 py-2 text-xs font-extrabold flex items-center justify-between gap-2 shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-[#059669] text-white'
                : statusMessage.type === 'error'
                ? 'bg-[#E60012] text-white'
                : 'bg-[#1B64DA] text-white'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-0.5 rounded hover:bg-black/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 전 직원 GitHub 동기화 설정 드롭다운 패널 */}
        {isAdmin && isSyncPanelOpen && (
          <div className="bg-[#F8FAFC] dark:bg-slate-900/90 px-4 sm:px-6 py-3.5 border-b border-[#E5E8EB] dark:border-slate-800 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-extrabold text-[#1B64DA] dark:text-blue-400 flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4" />
                <span>
                  전 직원 자동 동기화 (안심케어 조견표와 동일한 GitHub 설정 공유)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadInstallmentDatasetAsJson(dataset)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-200 text-[11.5px] font-bold cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON 백업 다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 hover:opacity-90 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-[#FF3B47] text-[11.5px] font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>로컬 캐시 초기화</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4">
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                  GitHub 저장소 (owner/repo)
                </label>
                <input
                  type="text"
                  value={ghConfig.repo}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, repo: e.target.value }))
                  }
                  placeholder="예: himart-gj/quote-app"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:border-[#1B64DA]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                  브랜치
                </label>
                <input
                  type="text"
                  value={ghConfig.branch}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, branch: e.target.value }))
                  }
                  placeholder="main"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:border-[#1B64DA]"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mb-1">
                  GitHub 토큰 (PAT) — 조견표에 이미 입력하셨다면 자동 연동됨
                </label>
                <input
                  type="password"
                  value={ghConfig.token}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, token: e.target.value }))
                  }
                  placeholder="ghp_... 또는 github_pat_..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-mono font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:border-[#1B64DA]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11.5px] font-medium text-[#4E5968] dark:text-slate-400">
                💡 사진(JPG/PNG) 또는 엑셀(.xlsx)을 업로드하거나 표의 셀을 클릭해 수정한 뒤 [전 직원 즉시 배포]를 누르면 `public/card-installment-data.json`에 자동 반영됩니다.
              </p>
              <button
                type="button"
                disabled={isPushingGh}
                onClick={handleSaveGhConfigAndPush}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] disabled:opacity-60 text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                {isPushingGh ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPushingGh
                    ? 'GitHub 배포 중...'
                    : '설정 저장 & 전 직원 즉시 배포'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 개별 셀 클릭 즉시 편집 바 */}
        {isAdmin && editingCell && (
          <div className="bg-[#EFF6FF] dark:bg-blue-500/12 border-b border-[#BFDBFE] dark:border-blue-500/30 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-[#191F28] dark:bg-slate-800 text-white text-xs font-extrabold">
                ✏️ 셀 직접 수정: {editingCell.brandTitle} ({editingCell.rowLabel})
              </span>

              <select
                value={editingCell.kind}
                onChange={(e) =>
                  setEditingCell((prev) =>
                    prev
                      ? {
                          ...prev,
                          kind: e.target.value as InstallmentCellKind,
                        }
                      : null
                  )
                }
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-extrabold text-[#191F28] dark:text-slate-100"
              >
                {CELL_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={editingCell.main}
                onChange={(e) =>
                  setEditingCell((prev) =>
                    prev ? { ...prev, main: e.target.value } : null
                  )
                }
                placeholder="메인 문구 (예: 무이자, 부분무이자, 결제불가)"
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-extrabold text-[#191F28] dark:text-slate-100 w-44 sm:w-52"
              />

              <input
                type="text"
                value={editingCell.sub}
                onChange={(e) =>
                  setEditingCell((prev) =>
                    prev ? { ...prev, sub: e.target.value } : null
                  )
                }
                placeholder="보조 문구 (예: 5만원 이상, 고객부담: 1,2회차)"
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-xs font-bold text-[#4E5968] dark:text-slate-200 w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveCellEdit}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-extrabold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>적용 저장</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 border border-[#D1D6DB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 text-xs font-extrabold cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 2) 상단 핵심 경고 배너 2줄 + 뷰 전환 탭 & 카드사 필터 */}
        <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border-b border-[#E5E8EB] dark:border-slate-800 px-3 sm:px-6 py-3 space-y-2.5 shrink-0">
          {(dataset.warningBanner1 || dataset.warningBanner2) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
              {dataset.warningBanner1 && (
                <div className="px-3 py-1.5 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-[#FF3B47] text-xs font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{dataset.warningBanner1}</span>
                </div>
              )}
              {dataset.warningBanner2 && (
                <div className="px-3 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{dataset.warningBanner2}</span>
                </div>
              )}
            </div>
          )}

          {/* 탭 전환 + 카드사 필터 + 색상 범례 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 뷰 탭 */}
            <div className="grid grid-cols-2 sm:flex items-center w-full sm:w-auto bg-white dark:bg-[#131C2E] p-1 rounded-xl border border-[#D1D6DB] dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'table'
                    ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                    : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-200'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="truncate">전체 비교표</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTab !== 'summary') {
                    window.history.pushState({ appGuard: true }, '');
                  }
                  setActiveTab('summary');
                }}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                    : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="truncate">카드사별 요약</span>
              </button>
            </div>

            {/* 카드사 퀵 필터 버튼 */}
            <div className="flex items-center gap-1 flex-wrap">
              {BRAND_FILTER_BUTTONS.map((brand) => {
                const active = selectedBrand === brand;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setSelectedBrand(brand)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA]'
                        : 'bg-white dark:bg-[#131C2E] text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                    }`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>

            {/* 색상 범례 */}
            <div className="hidden xl:flex items-center gap-2 text-[11.5px] font-extrabold">
              <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/20 text-[#1B64DA] dark:text-blue-200 border border-[#BFDBFE] dark:border-blue-500/30">
                ■ 무이자
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] border border-[#FECDD3] dark:border-rose-500/30">
                ■ 부분무이자
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40">
                ■ 구독 전용 무이자
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#E5E8EB] dark:bg-slate-800 text-[#8B95A1] dark:text-slate-400">
                ■ 결제불가
              </span>
            </div>
          </div>
        </div>

        {/* 3) 본문 스크롤 영역 */}
        <div
          className={`flex-1 p-3 sm:p-4 bg-[#F2F4F6] dark:bg-[#0B1120] ${
            activeTab === 'table'
              ? 'overflow-hidden flex flex-col min-h-0'
              : 'overflow-auto'
          }`}
        >
          {/* ==================== [데이터 미로드 안내] ==================== */}
          {dataset.columns.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-6 text-center space-y-2.5">
                <CreditCard className="w-8 h-8 mx-auto text-[#1B64DA] dark:text-blue-400" />
                <div className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                  무이자 할부 행사표 동기화 대기 중
                </div>
                <p className="text-xs font-medium text-[#4E5968] dark:text-slate-400 leading-relaxed">
                  비공개 구글 시트(_매장공유_무이자할부) 자동연결 링크로 접속하거나,
                  관리자 모드에서 당월 무이자 자료(사진·엑셀·JSON)를 업로드하면
                  전체 비교표와 카드사별 요약이 자동으로 표시됩니다.
                </p>
              </div>
            </div>
          ) : (
            <>
          {/* ==================== [탭 1: 📊 전체 비교표] ==================== */}
          {activeTab === 'table' && (
            <div className="w-full h-full max-h-[calc(94dvh-220px)] overflow-auto rounded-2xl border border-[#D1D6DB] dark:border-slate-700 bg-white dark:bg-[#131C2E]">
              <table className="w-full border-collapse min-w-[1150px] table-fixed">
                <thead className="sticky top-0 z-20 bg-[#191F28] dark:bg-slate-950 text-white">
                  <tr className="bg-[#191F28] dark:bg-slate-950 text-white">
                    <th className="sticky top-0 left-0 z-30 bg-[#191F28] dark:bg-slate-950 w-28 sm:w-32 px-2 py-2.5 text-xs font-extrabold border-r border-b border-slate-700 text-center">
                      할부 개월
                    </th>
                    {filteredColumns.map((col) => (
                      <th
                        key={col.id}
                        className="sticky top-0 z-20 bg-[#191F28] dark:bg-slate-900 px-2 py-2.5 text-center border-r border-b border-slate-700 align-middle"
                      >
                        <div className="text-xs font-extrabold text-blue-300">
                          {col.brand}
                        </div>
                        <div className="text-[11.5px] font-bold text-slate-100 mt-0.5 leading-tight">
                          {col.subName}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INSTALLMENT_ROW_LABELS.map((rowLabel) => {
                    const isNoteRow = rowLabel === '기타 안내';
                    return (
                      <tr
                        key={rowLabel}
                        className="border-b border-[#E5E8EB] dark:border-slate-800 last:border-b-0"
                      >
                        <td
                          className={`sticky left-0 z-10 px-2 py-2 text-center font-extrabold text-xs font-mono tabular-nums border-r border-[#D1D6DB] dark:border-slate-700 ${
                            isNoteRow
                              ? 'bg-[#191F28] dark:bg-slate-900 text-white'
                              : 'bg-[#F8FAFC] dark:bg-slate-900/90 text-[#191F28] dark:text-slate-100'
                          }`}
                        >
                          {rowLabel}
                        </td>
                        {filteredColumns.map((col) => {
                          const cellData = col.rows[rowLabel] || {
                            kind: 'interest',
                            main: '-',
                          };
                          return (
                            <td
                              key={`${col.id}-${rowLabel}`}
                              className="p-0 border-r border-[#E5E8EB] dark:border-slate-800 last:border-r-0 align-stretch h-12 cursor-default"
                            >
                              {renderCell(cellData)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ==================== [탭 2: 🔍 카드사별 퀵 요약 카드] ==================== */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredQuickCards.map((card) => (
                <div
                  key={card.brandKey}
                  className="rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-[#E5E8EB] dark:border-slate-800 pb-2.5">
                      <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold bg-[#191F28] dark:bg-slate-800 text-white">
                        {card.brandTitle}
                      </span>
                    </div>

                    {/* 일반 무이자 */}
                    <div className="p-3 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 space-y-1">
                      <div className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-300">
                        일반 무이자 할부
                      </div>
                      <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 whitespace-pre-line leading-relaxed">
                        {card.freeInstallment}
                      </div>
                    </div>

                    {/* 부분무이자 */}
                    <div className="p-3 rounded-2xl bg-[#FFF1F2] dark:bg-rose-500/12 border border-[#FECDD3] dark:border-rose-500/30 space-y-1">
                      <div className="text-xs font-extrabold text-[#E60012] dark:text-[#FF3B47]">
                        부분무이자 (고객부담 회차)
                      </div>
                      <div className="text-xs font-bold text-[#191F28] dark:text-slate-200 whitespace-pre-line leading-relaxed">
                        {card.partialInstallment}
                      </div>
                    </div>

                    {/* 구독 전용 무이자 */}
                    <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 space-y-1">
                      <div className="text-xs font-extrabold text-[#059669] dark:text-emerald-300">
                        구독 전용 장기 무이자
                      </div>
                      <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 whitespace-pre-line leading-relaxed">
                        {card.subInstallment}
                      </div>
                    </div>
                  </div>

                  {/* 특이사항 */}
                  {card.specialNotes.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 space-y-1">
                      <div className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300">
                        특이사항 및 안내
                      </div>
                      <ul className="space-y-0.5 text-[11.5px] font-medium text-[#4E5968] dark:text-slate-400 list-disc list-inside">
                        {card.specialNotes.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {/* 4) 모달 하단 각주 */}
        <div className="bg-[#F8FAFC] dark:bg-[#0B1120]/80 border-t border-[#E5E8EB] dark:border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-bold shrink-0">
          <span className="text-[#4E5968] dark:text-slate-300 font-extrabold">
            ※ 카드사별 무이자·부분무이자 적용 조건은 비공개 구글 시트 당월 행사표 기준입니다.
          </span>
          <span className="text-[11.5px] text-[#4E5968] dark:text-slate-400">
            상단 카드사 필터를 눌러 원하는 카드사의 무이자·부분무이자 혜택을 빠르게 확인하세요
          </span>
        </div>
      </div>
    </div>
  );
};
