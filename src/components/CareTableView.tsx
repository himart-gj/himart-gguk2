import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudUpload,
  Copy,
  Download,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  CARE_FOLDERS,
  CareFolderKey,
  CareTableDataset,
  CareTableItem,
  fetchRemoteCareDataset,
  formatPriceDisplay,
  GitHubSyncConfig,
  loadGitHubSyncConfig,
  loadLocalCareDataset,
  parseCareExcelBuffer,
  publishCareDatasetToGitHub,
  saveGitHubSyncConfig,
  saveLocalCareDataset,
} from '../utils/careTableParser';

interface CareTableViewProps {
  onBackToHome: () => void;
}

export const CareTableView: React.FC<CareTableViewProps> = ({ onBackToHome }) => {
  const [dataset, setDataset] = useState<CareTableDataset | null>(() => loadLocalCareDataset());

  // 3단계 폴더 탐색 상태:
  // 1단계: selectedFolder === null (6대 상위 폴더 화면)
  // 2단계: selectedFolder !== null && selectedSection === null (하위 중분류 폴더 선택 화면)
  // 3단계: selectedSection !== null (세부 품목 필터 + 모델코드·금액 표 화면)
  const [selectedFolder, setSelectedFolder] = useState<CareFolderKey | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(() => loadGitHubSyncConfig());
  const [isPublishingGh, setIsPublishingGh] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 폴더 단계 이동 헬퍼 (하위 폴더로 들어갈 때 히스토리 가드 추가)
  const navigateCareFolder = (
    nextFolder: CareFolderKey | null,
    nextSection: string | null,
    nextCategory = 'ALL'
  ) => {
    setSelectedFolder(nextFolder);
    setSelectedSection(nextSection);
    setSelectedCategory(nextCategory);
    setSearchQuery('');
    window.history.pushState({ appGuard: true }, '');
  };

  // 조견표 내부에서 한 단계씩 뒤로 가는 공통 함수 (화면 버튼 & 휴대폰 뒤로가기 버튼 공용)
  const careStateRef = useRef({
    isSyncModalOpen,
    searchQuery,
    selectedCategory,
    selectedSection,
    selectedFolder,
  });

  useEffect(() => {
    careStateRef.current = {
      isSyncModalOpen,
      searchQuery,
      selectedCategory,
      selectedSection,
      selectedFolder,
    };
  }, [isSyncModalOpen, searchQuery, selectedCategory, selectedSection, selectedFolder]);

  const stepBackInsideCareTable = (): boolean => {
    const cur = careStateRef.current;
    if (cur.isSyncModalOpen) {
      setIsSyncModalOpen(false);
      return true;
    }
    if (cur.searchQuery.trim() !== '') {
      setSearchQuery('');
      return true;
    }
    if (cur.selectedCategory !== 'ALL') {
      setSelectedCategory('ALL');
      return true;
    }
    if (cur.selectedSection !== null) {
      // 3단계(코드·금액 표) ➔ 2단계(하위 폴더 목록)로 이동
      setSelectedSection(null);
      setSelectedCategory('ALL');
      return true;
    }
    if (cur.selectedFolder !== null) {
      // 2단계(하위 폴더 목록) ➔ 1단계(6대 상위 폴더 목록)로 이동
      setSelectedFolder(null);
      setSelectedSection(null);
      setSelectedCategory('ALL');
      return true;
    }
    // 이미 1단계(6대 상위 폴더 목록)이면 false를 반환하여 App.tsx가 메인 홈으로 이동하게 함
    return false;
  };

  useEffect(() => {
    (window as any).__subViewBackHandler = stepBackInsideCareTable;
    return () => {
      (window as any).__subViewBackHandler = undefined;
    };
  }, []);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  // 앱 실행 시 깃허브 배포 서버(./care-table-data.json 또는 ./care-table.xlsx)에서 자동 동기화
  const syncFromRemote = async (silent = false) => {
    setIsSyncing(true);
    try {
      const remote = await fetchRemoteCareDataset();
      if (remote && remote.items.length > 0) {
        setDataset(remote);
        if (!silent) {
          showToast(`✅ 서버에서 최신 조견표(${remote.versionTitle}, ${remote.items.length}개 코드)를 불러왔습니다!`);
        }
      } else if (!silent) {
        showToast('현재 기기에 저장된 조견표가 최신 상태입니다.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncFromRemote(true);
  }, []);

  // 월간 엑셀 파일 업로드 처리
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const parsed = parseCareExcelBuffer(buf, file.name);
      if (!parsed.items.length) {
        showToast('⚠️ 엑셀에서 모델코드와 금액을 찾지 못했습니다. 안심케어 조견표 파일인지 확인해 주세요.');
        return;
      }

      saveLocalCareDataset(parsed);
      setDataset(parsed);
      setSelectedFolder(null);
      setSelectedSection(null);
      setSelectedCategory('ALL');

      // 깃허브 토큰이 등록되어 있으면 자동으로 전 직원 동기화까지 실행
      const savedGh = loadGitHubSyncConfig();
      if (savedGh.repo && savedGh.token) {
        setIsPublishingGh(true);
        const ghRes = await publishCareDatasetToGitHub(parsed, savedGh);
        setIsPublishingGh(false);
        showToast(
          ghRes.ok
            ? `🎉 [${parsed.versionTitle}] ${parsed.items.length}개 코드 저장 + 전 직원 깃허브 자동 업데이트 완료!`
            : `✅ 내 기기에 ${parsed.items.length}개 코드 저장 완료 (${ghRes.message})`
        );
      } else {
        showToast(`✅ [${parsed.versionTitle}] 총 ${parsed.items.length}개 코드가 저장되었습니다! (앱을 껐다 켜도 계속 유지됩니다)`);
      }
    } catch (err: any) {
      showToast(`⚠️ 파일 처리 오류: ${err?.message || '엑셀 파일을 확인해 주세요.'}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleDownloadDeployJson = () => {
    if (!dataset) return;
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'care-table-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 care-table-data.json 파일이 다운로드되었습니다. 깃허브 public 폴더에 넣으면 전 직원에게 반영됩니다.');
  };

  const handlePublishToGitHub = async () => {
    if (!dataset) return;
    saveGitHubSyncConfig(ghConfig);
    setIsPublishingGh(true);
    const res = await publishCareDatasetToGitHub(dataset, ghConfig);
    setIsPublishingGh(false);
    showToast(res.message);
    if (res.ok) setIsSyncModalOpen(false);
  };

  // 상위 폴더별 하위 폴더수 & 코드수 집계
  const folderStats = useMemo(() => {
    const map: Record<string, { itemCount: number; sections: Map<string, number> }> = {};
    CARE_FOLDERS.forEach((f) => {
      map[f.key] = { itemCount: 0, sections: new Map() };
    });
    if (!dataset) return map;
    for (const item of dataset.items) {
      const entry = map[item.folderKey];
      if (entry) {
        entry.itemCount += 1;
        entry.sections.set(item.section, (entry.sections.get(item.section) || 0) + 1);
      }
    }
    return map;
  }, [dataset]);

  // 선택한 상위 폴더 안의 중분류(하위 폴더) 목록
  const currentSections = useMemo(() => {
    if (!dataset || !selectedFolder) return [];
    const secMap = new Map<string, { count: number; sampleCategories: Set<string> }>();
    for (const item of dataset.items) {
      if (item.folderKey !== selectedFolder) continue;
      if (!secMap.has(item.section)) {
        secMap.set(item.section, { count: 0, sampleCategories: new Set() });
      }
      const entry = secMap.get(item.section)!;
      entry.count += 1;
      if (entry.sampleCategories.size < 6) {
        entry.sampleCategories.add(item.category);
      }
    }
    return Array.from(secMap.entries()).map(([section, info]) => ({
      section,
      count: info.count,
      previewText: Array.from(info.sampleCategories).join(', '),
    }));
  }, [dataset, selectedFolder]);

  // 선택한 하위 폴더(selectedSection) 안의 세부 품목(category) 목록
  const currentCategories = useMemo(() => {
    if (!dataset || !selectedFolder || !selectedSection) return [];
    const catMap = new Map<string, number>();
    for (const item of dataset.items) {
      if (item.folderKey === selectedFolder && item.section === selectedSection) {
        catMap.set(item.category, (catMap.get(item.category) || 0) + 1);
      }
    }
    return Array.from(catMap.entries()).map(([cat, count]) => ({ cat, count }));
  }, [dataset, selectedFolder, selectedSection]);

  // 표시할 최종 코드 리스트 (검색 중이면 검색 결과, 아니면 선택된 하위 폴더 안의 항목)
  const displayedItems = useMemo(() => {
    if (!dataset) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      return dataset.items.filter((item) => {
        if (selectedFolder && item.folderKey !== selectedFolder) return false;
        const hay = `${item.folderLabel} ${item.section} ${item.category} ${item.name} ${item.code} ${item.price} ${item.note}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    if (!selectedFolder || !selectedSection) return [];
    return dataset.items.filter(
      (item) =>
        item.folderKey === selectedFolder &&
        item.section === selectedSection &&
        (selectedCategory === 'ALL' || item.category === selectedCategory)
    );
  }, [dataset, selectedFolder, selectedSection, selectedCategory, searchQuery]);

  const handleCopyCode = async (item: CareTableItem) => {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopiedId(`code-${item.id}`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const handleCopyGuide = async (item: CareTableItem) => {
    const text = [
      `[롯데하이마트 안심케어/가전이사 안내]`,
      `• 분류: ${item.section} (${item.category})`,
      `• 상품명: ${item.name}`,
      `• 모델코드: ${item.code}`,
      `• 판매가: ${formatPriceDisplay(item.price)}`,
      ...(item.note ? [`• 비고: ${item.note}`] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`guide-${item.id}`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const activeFolderObj = CARE_FOLDERS.find((f) => f.key === selectedFolder) || null;

  return (
    <div className="flex-1 w-full bg-slate-100 pb-14">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelUpload}
        className="hidden"
      />

      {/* 상단 고정 헤더 */}
      <div className="sticky top-[44px] z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>메인</span>
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900">
                {dataset ? dataset.versionTitle : '8. 안심케어 · 가전이사 조견표'}
              </h1>
              {dataset && (
                <p className="text-[11px] text-slate-500 font-bold">
                  적용 파일: {dataset.fileName} · 총{' '}
                  <span className="text-orange-600 font-black">{dataset.items.length.toLocaleString()}개</span> 코드
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>📂 이달의 엑셀 업로드 (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
              <span>전 직원 동기화</span>
            </button>
            <button
              type="button"
              onClick={() => syncFromRemote(false)}
              disabled={isSyncing}
              title="서버에서 최신 조견표 다시 불러오기"
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-orange-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {notice && (
          <div className="p-3 rounded-2xl bg-slate-900 text-white text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-md">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="p-1 hover:bg-slate-800 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 아직 엑셀이 업로드되지 않은 초기 화면 */}
        {!dataset || dataset.items.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-orange-300 p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                이달의 안심케어 조견표 엑셀(.xlsx)을 업로드해 주세요
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
                한 번만 업로드하면 <strong>6개 상위 폴더 ➔ 하위 폴더</strong>로 모든 모델코드와 금액이 정리되며,
                앱을 껐다 켜도 그 달 내내 유지됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-black inline-flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>📂 안심케어 엑셀 파일(.xlsx) 선택하기</span>
            </button>
          </div>
        ) : (
          <>
            {/* 상단 현재 폴더 위치 경로(Breadcrumb) + 빠른 검색창 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
              {/* 폴더 경로 표시줄 */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigateCareFolder(null, null, 'ALL')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                      !selectedFolder
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-orange-400" />
                    <span>전체 상위폴더 (6개)</span>
                  </button>

                  {activeFolderObj && (
                    <>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => navigateCareFolder(selectedFolder, null, 'ALL')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          selectedFolder && !selectedSection
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-50 hover:bg-orange-100 text-orange-800'
                        }`}
                      >
                        {activeFolderObj.iconEmoji} {activeFolderObj.title}
                      </button>
                    </>
                  )}

                  {selectedSection && (
                    <>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white">
                        📂 {selectedSection}
                      </span>
                    </>
                  )}
                </div>

                {(selectedFolder || selectedSection || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => stepBackInsideCareTable()}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>이전 폴더로</span>
                  </button>
                )}
              </div>

              {/* 보조 검색창 (필요할 때만 코드/품목 바로 찾기) */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="폴더를 눌러 찾거나, 품목명/모델코드(예: 에어컨, 김냉, 올케어, 무타공, SET-...)를 바로 검색하세요"
                  className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white text-xs sm:text-sm font-bold text-slate-900 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs font-black cursor-pointer"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>

            {/* ==================== [1단계 화면] 6대 상위 폴더 선택 그리드 ==================== */}
            {!searchQuery.trim() && !selectedFolder && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CARE_FOLDERS.map((folder) => {
                  const stat = folderStats[folder.key];
                  const subFolderCount = stat ? stat.sections.size : 0;
                  const codeCount = stat ? stat.itemCount : 0;

                  return (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => navigateCareFolder(folder.key, null, 'ALL')}
                      className="p-5 rounded-3xl bg-white hover:bg-orange-50/50 border-2 border-slate-200 hover:border-orange-500 shadow-xs hover:shadow-md transition-all text-left flex items-start justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-orange-600 text-2xl flex items-center justify-center shrink-0 transition">
                          {folder.iconEmoji}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-orange-600 transition">
                              {folder.title}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            {folder.subtitle}
                          </p>
                          <div className="pt-1 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black">
                              하위 폴더 {subFolderCount}개
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${folder.badgeClass}`}>
                              총 {codeCount}개 코드
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-600 shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* ==================== [2단계 화면] 선택한 상위 폴더 안의 하위(중분류) 폴더 목록 ==================== */}
            {!searchQuery.trim() && selectedFolder && !selectedSection && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-orange-600" />
                    <span>{activeFolderObj?.title} ▸ 하위 폴더를 선택해 주세요</span>
                  </h2>
                  <span className="text-xs font-bold text-slate-500">
                    총 {currentSections.length}개 하위 폴더
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {currentSections.map((secInfo) => (
                    <button
                      key={secInfo.section}
                      type="button"
                      onClick={() => navigateCareFolder(selectedFolder, secInfo.section, 'ALL')}
                      className="p-4 rounded-2xl bg-white hover:bg-orange-50/60 border-2 border-slate-200 hover:border-orange-500 text-left transition flex flex-col justify-between gap-2 shadow-2xs group cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="w-5 h-5 text-amber-500 group-hover:text-orange-600 shrink-0" />
                          <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                            {secInfo.section}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-black shrink-0">
                          {secInfo.count}개 코드
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        포함 품목: {secInfo.previewText}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== [3단계 화면 또는 검색 결과] 세부 품목 탭 + 코드·금액 리스트 ==================== */}
            {(searchQuery.trim() !== '' || (selectedFolder && selectedSection)) && (
              <div className="space-y-3">
                {/* 하위 폴더 내 세부 품목(Category) 필터 버튼 */}
                {!searchQuery.trim() && currentCategories.length > 1 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-2">
                    <div className="text-[11px] font-black text-slate-500">
                      📌 세부 품목 선택 ({selectedSection})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                          selectedCategory === 'ALL'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        전체 보기 ({currentCategories.reduce((a, b) => a + b.count, 0)})
                      </button>
                      {currentCategories.map(({ cat, count }) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                              : 'bg-white hover:bg-orange-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 모델코드 · 판매가 테이블 카드 */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-orange-400" />
                      <span className="text-xs sm:text-sm font-black">
                        {searchQuery.trim()
                          ? `"${searchQuery}" 검색 결과`
                          : `${selectedSection} ${selectedCategory !== 'ALL' ? `▸ ${selectedCategory}` : ''}`}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-orange-300 text-xs font-black">
                      총 {displayedItems.length}건
                    </span>
                  </div>

                  {displayedItems.length === 0 ? (
                    <div className="p-8 text-center text-xs sm:text-sm font-bold text-slate-500">
                      해당 조건에 일치하는 모델코드가 없습니다.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {displayedItems.map((item) => {
                        const isCodeCopied = copiedId === `code-${item.id}`;
                        const isGuideCopied = copiedId === `guide-${item.id}`;

                        return (
                          <div
                            key={item.id}
                            className="p-3 sm:px-4 sm:py-3 hover:bg-orange-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {searchQuery.trim() && (
                                  <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-black">
                                    {item.section}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black">
                                  {item.category}
                                </span>
                                <span className="text-xs sm:text-sm font-black text-slate-900">
                                  {item.name}
                                </span>
                              </div>
                              {item.note && (
                                <p className="text-[11px] text-slate-500 font-bold">
                                  ※ {item.note}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              <div className="text-left sm:text-right">
                                <div className="text-xs sm:text-sm font-black text-rose-600">
                                  {item.price}
                                </div>
                                <div className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-0.5">
                                  {item.code}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(item)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition cursor-pointer ${
                                    isCodeCopied
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                                  }`}
                                >
                                  {isCodeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{isCodeCopied ? '복사됨' : '코드복사'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyGuide(item)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition cursor-pointer ${
                                    isGuideCopied
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                  }`}
                                >
                                  {isGuideCopied ? <Check className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                  <span>{isGuideCopied ? '복사됨' : '안내복사'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 전 직원 깃허브 자동 동기화 모달 */}
      {isSyncModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsSyncModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black">
                🚀 매달 엑셀 업데이트 & 전 직원 동시 반영 설정
              </h3>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-black text-slate-900">
                  방법 1️⃣ 앱 안에서 엑셀만 올리면 전 직원 자동 업데이트 (최초 1회 설정)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  배포하신 깃허브 저장소 이름(예: <code>아이디/저장소명</code>)과 토큰(Token)을 한 번만 저장해 두면, 매달 앱에서 엑셀을 업로드할 때 깃허브 서버까지 자동으로 업데이트되어 다른 직원들 폰에도 즉시 반영됩니다.
                </p>
                <input
                  type="text"
                  value={ghConfig.repo}
                  onChange={(e) => setGhConfig({ ...ghConfig, repo: e.target.value })}
                  placeholder="깃허브 저장소 (예: honggildong/himart-app)"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={ghConfig.branch}
                    onChange={(e) => setGhConfig({ ...ghConfig, branch: e.target.value })}
                    placeholder="브랜치 (main)"
                    className="col-span-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                  />
                  <input
                    type="password"
                    value={ghConfig.token}
                    onChange={(e) => setGhConfig({ ...ghConfig, token: e.target.value })}
                    placeholder="GitHub Token (ghp_...)"
                    className="col-span-2 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      saveGitHubSyncConfig(ghConfig);
                      showToast('깃허브 연동 설정이 저장되었습니다.');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-black cursor-pointer"
                  >
                    설정 저장
                  </button>
                  <button
                    type="button"
                    disabled={isPublishingGh || !dataset}
                    onClick={handlePublishToGitHub}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {isPublishingGh ? '반영 중...' : '지금 전 직원에게 배포하기'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 space-y-2">
                <div className="font-black text-orange-950">
                  방법 2️⃣ 토큰 없이 배포파일 1개만 깃허브 public 폴더에 넣기
                </div>
                <p className="text-xs text-orange-900 leading-relaxed">
                  엑셀 업로드 후 아래 버튼을 눌러 <code>care-table-data.json</code> 파일을 다운받아 깃허브 저장소 <code>public/</code> 폴더에 넣으면 전 직원 앱에 자동 반영됩니다.
                </p>
                {dataset && (
                  <button
                    type="button"
                    onClick={handleDownloadDeployJson}
                    className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>📥 전 직원 배포파일 (care-table-data.json) 저장</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
