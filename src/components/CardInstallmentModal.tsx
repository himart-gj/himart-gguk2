import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
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
  { value: 'free', label: '■ 무이자 (노란색 강조)' },
  { value: 'partial', label: '■ 부분무이자 (연분홍 강조)' },
  { value: 'sub-free', label: '■ 구독 전용 무이자 (파란+빨간 테두리)' },
  { value: 'interest', label: '□ 고객유이자 / 저리할부 (흰색)' },
  { value: 'disabled', label: '■ 결제불가 (진회색)' },
  { value: 'note', label: '📝 기타 안내 문구' },
];

export const CardInstallmentModal: React.FC<CardInstallmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dataset, setDataset] = useState<InstallmentDataset>(() =>
    loadLocalInstallmentDataset()
  );
  const [activeTab, setActiveTab] = useState<'table' | 'summary'>('table');
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

  // 모달 열릴 때 최신 로컬 & 원격 데이터 동기화 확인
  useEffect(() => {
    if (!isOpen) return;
    setGhConfig(loadGitHubSyncConfig());
    const local = loadLocalInstallmentDataset();
    setDataset(local);
    setTitleDraft(local.versionTitle);

    fetchRemoteInstallmentDataset()
      .then((remote) => {
        if (remote && remote.updatedAt) {
          // 원격 데이터가 더 최신이거나 로컬이 기본값이면 갱신
          if (
            !local.updatedAt ||
            remote.updatedAt >= local.updatedAt
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
      text: '기본 10월 무이자 할부 행사표 데이터로 복원되었습니다.',
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
          <div className="h-full w-full px-1.5 py-1.5 bg-amber-200/90 text-slate-950 font-black flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-extrabold text-rose-700 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'partial':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-rose-100 text-rose-900 font-extrabold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs font-black">
              {cell.main}
            </span>
            {cell.sub && (
              <span className="text-[10px] font-bold text-rose-700 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
      case 'sub-free':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-blue-50 border border-rose-500 text-blue-900 font-black flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px] sm:text-xs">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-black text-rose-600 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'disabled':
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-slate-600 text-slate-200 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[9px] text-slate-300 mt-0.5">
                {cell.sub}
              </span>
            )}
          </div>
        );
      case 'note':
        return (
          <div className="h-full w-full px-2 py-2 bg-slate-50 text-slate-800 font-bold text-[10px] sm:text-[11px] leading-snug text-left">
            {cell.main}
          </div>
        );
      case 'interest':
      default:
        return (
          <div className="h-full w-full px-1.5 py-1.5 bg-white text-slate-700 font-bold flex flex-col items-center justify-center text-center leading-tight">
            <span className="text-[11px]">{cell.main}</span>
            {cell.sub && (
              <span className="text-[10px] font-extrabold text-blue-700 mt-0.5">
                ({cell.sub})
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1440px] max-h-[94dvh] rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 숨김 파일 업로드 input (사진 / 엑셀 / JSON) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.xlsx,.xls,.csv,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 1) 모달 상단 헤더 + [📤 무이자 자료 업로드] & [☁️ 전 직원 동기화 설정] */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-amber-400 text-xs sm:text-sm font-black text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    저장
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-lg font-black tracking-tight truncate">
                    💳 {dataset.versionTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(dataset.versionTitle);
                      setIsEditingTitle(true);
                    }}
                    title="행사 제목(기준월) 수정"
                    className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-300 font-bold hidden sm:block">
                업데이트: {dataset.updatedAt} · 표의 셀을 클릭하면 직접 수정할 수 있습니다
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* [📤 무이자 자료 업로드] 버튼 */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>
                {isUploading ? 'AI 분석 중...' : '📤 무이자 자료 업로드'}
              </span>
            </button>

            {/* [☁️ 전 직원 동기화 설정] 버튼 */}
            <button
              type="button"
              onClick={() => setIsSyncPanelOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                isSyncPanelOpen
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>☁️ 전 직원 동기화 설정</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-black transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
              <span>닫기</span>
            </button>
          </div>
        </div>

        {/* 알림 메시지 배너 */}
        {statusMessage && (
          <div
            className={`px-4 py-2 text-xs font-black flex items-center justify-between gap-2 shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : statusMessage.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-sky-600 text-white'
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
        {isSyncPanelOpen && (
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 border-b border-slate-700 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-black text-sky-300 flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4" />
                <span>
                  ☁️ 전 직원 자동 동기화 (안심케어 조견표와 동일한 GitHub 설정 공유)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadInstallmentDatasetAsJson(dataset)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-black cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON 백업 다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 border border-slate-600 text-rose-300 text-[11px] font-black cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>10월 기본값 복원</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-extrabold text-slate-400 mb-1">
                  GitHub 저장소 (owner/repo)
                </label>
                <input
                  type="text"
                  value={ghConfig.repo}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, repo: e.target.value }))
                  }
                  placeholder="예: himart-gj/quote-app"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-extrabold text-slate-400 mb-1">
                  브랜치
                </label>
                <input
                  type="text"
                  value={ghConfig.branch}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, branch: e.target.value }))
                  }
                  placeholder="main"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-white"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-extrabold text-slate-400 mb-1">
                  GitHub 토큰 (PAT) — 조견표에 이미 입력하셨다면 자동 연동됨
                </label>
                <input
                  type="password"
                  value={ghConfig.token}
                  onChange={(e) =>
                    setGhConfig((prev) => ({ ...prev, token: e.target.value }))
                  }
                  placeholder="ghp_... 또는 github_pat_..."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-bold text-slate-400">
                💡 사진(JPG/PNG) 또는 엑셀(.xlsx)을 업로드하거나 표의 셀을 클릭해 수정한 뒤 [전 직원 즉시 배포]를 누르면 `public/card-installment-data.json`에 자동 반영됩니다.
              </p>
              <button
                type="button"
                disabled={isPushingGh}
                onClick={handleSaveGhConfigAndPush}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-black cursor-pointer"
              >
                {isPushingGh ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPushingGh
                    ? 'GitHub 배포 중...'
                    : '💾 설정 저장 & 전 직원 즉시 배포'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 개별 셀 클릭 즉시 편집 바 */}
        {editingCell && (
          <div className="bg-amber-50 border-b-2 border-amber-400 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-xs font-black">
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
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-900"
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
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-900 w-44 sm:w-52"
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
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveCellEdit}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>적용 저장</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 2) 상단 핵심 경고 배너 2줄 + 뷰 전환 탭 & 카드사 필터 */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 py-3 space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            <div className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{dataset.warningBanner1}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black flex items-center gap-1.5">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{dataset.warningBanner2}</span>
            </div>
          </div>

          {/* 탭 전환 + 카드사 필터 + 색상 범례 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 뷰 탭 */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  activeTab === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>📊 전체 비교표 (원본 표)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>🔍 카드사별 퀵 요약 카드</span>
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border transition cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>

            {/* 색상 범례 */}
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-black">
              <span className="px-2 py-0.5 rounded bg-amber-200/90 text-slate-950 border border-amber-400">
                ■ 무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                ■ 부분무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-rose-500">
                ■ 구독 전용 무이자
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-600 text-slate-200">
                ■ 결제불가
              </span>
            </div>
          </div>
        </div>

        {/* 3) 본문 스크롤 영역 */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-slate-50">
          {/* ==================== [탭 1: 📊 전체 비교표] ==================== */}
          {activeTab === 'table' && (
            <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
              <table className="w-full border-collapse min-w-[1150px] table-fixed">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="sticky left-0 z-20 bg-slate-900 w-28 sm:w-32 px-2 py-2.5 text-xs font-black border-r border-b border-slate-700 text-center">
                      할부 개월
                    </th>
                    {filteredColumns.map((col) => (
                      <th
                        key={col.id}
                        className="px-2 py-2 text-center border-r border-b border-slate-700 align-middle"
                      >
                        <div className="text-xs font-black text-amber-300">
                          {col.brand}
                        </div>
                        <div className="text-[11px] font-extrabold text-white mt-0.5 leading-tight">
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
                        className="border-b border-slate-200 last:border-b-0"
                      >
                        <td
                          className={`sticky left-0 z-10 px-2 py-2 text-center font-black text-xs border-r border-slate-300 ${
                            isNoteRow
                              ? 'bg-slate-800 text-amber-300'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          {rowLabel}
                        </td>
                        {filteredColumns.map((col) => {
                          const cellData = col.rows[rowLabel] || {
                            kind: 'interest',
                            main: '-',
                          };
                          const isSelectedEditing =
                            editingCell?.colId === col.id &&
                            editingCell?.rowLabel === rowLabel;
                          return (
                            <td
                              key={`${col.id}-${rowLabel}`}
                              onClick={() =>
                                setEditingCell({
                                  colId: col.id,
                                  brandTitle: `${col.brand} (${col.subName})`,
                                  rowLabel,
                                  kind: cellData.kind,
                                  main: cellData.main,
                                  sub: cellData.sub || '',
                                })
                              }
                              title="클릭하여 이 셀 수정"
                              className={`p-0 border-r border-slate-200 last:border-r-0 align-stretch h-12 cursor-pointer transition ${
                                isSelectedEditing
                                  ? 'ring-2 ring-inset ring-blue-600'
                                  : 'hover:opacity-90'
                              }`}
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
                  className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black ${card.badgeColor}`}
                      >
                        {card.brandTitle}
                      </span>
                    </div>

                    {/* 일반 무이자 */}
                    <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-300 space-y-1">
                      <div className="text-xs font-black text-amber-950">
                        ⭐ 일반 무이자 할부
                      </div>
                      <div className="text-xs font-extrabold text-slate-900 whitespace-pre-line leading-relaxed">
                        {card.freeInstallment}
                      </div>
                    </div>

                    {/* 부분무이자 */}
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                      <div className="text-xs font-black text-rose-800">
                        📌 부분무이자 (고객부담 회차)
                      </div>
                      <div className="text-xs font-bold text-slate-800 whitespace-pre-line leading-relaxed">
                        {card.partialInstallment}
                      </div>
                    </div>

                    {/* 구독 전용 무이자 */}
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-blue-900">
                        🔄 구독 전용 장기 무이자
                      </div>
                      <div className="text-xs font-extrabold text-rose-600 whitespace-pre-line leading-relaxed">
                        {card.subInstallment}
                      </div>
                    </div>
                  </div>

                  {/* 특이사항 */}
                  {card.specialNotes.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1">
                      <div className="text-[11px] font-black text-slate-700">
                        💡 특이사항 및 수수료 안내
                      </div>
                      <ul className="space-y-0.5 text-[11px] font-bold text-slate-600 list-disc list-inside">
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
        </div>

        {/* 4) 모달 하단 각주 */}
        <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold shrink-0">
          <span className="text-amber-300 font-black">
            ※ 롯데카드 수수료 예시: 롯데제휴카드로 100만원 5개월 할부결제 시 지점손익에서 1만원(1%) 차감
          </span>
          <span className="text-[11px] text-slate-400">
            표의 셀을 클릭하면 직접 편집 가능 · [📤 무이자 자료 업로드]로 매월 사진/엑셀 자동 반영
          </span>
        </div>
      </div>
    </div>
  );
};
