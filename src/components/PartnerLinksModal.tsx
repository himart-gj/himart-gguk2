import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  Link2,
  Lock,
  MessageSquare,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';

export type PartnerLinkCategory = 'living' | 'resell' | 'staff';

export interface PartnerQuickLinkItem {
  id: string;
  title: string;
  url: string;
  category: PartnerLinkCategory;
  badgeText: string;
  description: string;
  isStaffOnly?: boolean;
  isBuiltIn?: boolean;
}

export const PARTNER_LINKS_STORAGE_KEY = 'himart_gj_partner_links_v1';
export const PARTNER_FAVORITES_STORAGE_KEY = 'himart_gj_partner_favs_v1';

export const DEFAULT_PARTNER_LINKS: PartnerQuickLinkItem[] = [
  {
    id: 'kobang-screen',
    title: '방충망 셀프 견적',
    url: 'https://kobang.netlify.app/',
    category: 'living',
    badgeText: '입주·이사 제휴',
    description: '신축 입주·이사 고객용 미세·안전 방충망 평형별 실시간 견적 확인',
    isStaffOnly: false,
    isBuiltIn: true,
  },
  {
    id: 'cleantopia-movein',
    title: '크린토피아 입주청소 견적',
    url: 'https://homecleaning.cleantopia.com/customer/estimate/confirm?comp=himart',
    category: 'living',
    badgeText: '하이마트 제휴',
    description: '롯데하이마트 고객 전용 크린토피아 입주·이사청소 혜택 견적 조회',
    isStaffOnly: false,
    isBuiltIn: true,
  },
  {
    id: 'himart-resell-price',
    title: '중고보상 예상금액 확인',
    url: 'http://www.e-himart.co.kr/app/resell/resellExpectedPriceInquiry',
    category: 'resell',
    badgeText: '보상판매 조회',
    description: '기존 사용 가전 반납 시 품목·모델별 예상 중고 보상가 즉시 조회',
    isStaffOnly: false,
    isBuiltIn: true,
  },
  {
    id: 'himart-resell-hall',
    title: '중고 인기가전 쇼핑몰',
    url: 'https://www.e-himart.co.kr/app/display/resellHall',
    category: 'resell',
    badgeText: '리퍼·전시 특가',
    description: '롯데하이마트 공식 리퍼·전시·중고 인기가전 온라인 특가 전문관',
    isStaffOnly: false,
    isBuiltIn: true,
  },
  {
    id: 'preed-commission',
    title: '하이프리드 수당 확인',
    url: 'http://hi.preedlife.kr:8460/Default',
    category: 'staff',
    badgeText: '직원 전용',
    description: '하이프리드 구좌별 판매 수당 및 정산 현황 조회 포털 (외부 공유 주의)',
    isStaffOnly: true,
    isBuiltIn: true,
  },
  {
    id: 'sk-internet-apply',
    title: 'SK인터넷 청약신청',
    url: 'http://aaa.t-sales.co.kr/ntsm/servlet/ChungYakServlet?pageId=CY10001&cq=sCrBqApzpzoyoynxv5v5v5v5v5v5w6x7w6v5v5v5v5v5v5v5v5v5x7',
    category: 'staff',
    badgeText: '직원 전용',
    description: 'SK브로드밴드 인터넷·TV 결합 온라인 청약 접수 (연필 버튼으로 내 코드 수정 가능)',
    isStaffOnly: true,
    isBuiltIn: true,
  },
];

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getChoseong(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 0xac00;
    if (code >= 0 && code < 11172) {
      out += CHOSEONG[Math.floor(code / 588)];
    } else {
      out += str[i];
    }
  }
  return out;
}

function matchesSearch(target: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  return getChoseong(t).includes(q);
}

export function loadPartnerLinks(): PartnerQuickLinkItem[] {
  try {
    const raw = localStorage.getItem(PARTNER_LINKS_STORAGE_KEY);
    if (!raw) return DEFAULT_PARTNER_LINKS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PARTNER_LINKS;
    }
    // 기본 탑재 링크가 새로 추가된 경우 누락 없이 병합
    const savedIds = new Set(parsed.map((x: any) => x?.id));
    const missingDefaults = DEFAULT_PARTNER_LINKS.filter(
      (d) => !savedIds.has(d.id)
    );
    return [...parsed, ...missingDefaults];
  } catch {
    return DEFAULT_PARTNER_LINKS;
  }
}

export function savePartnerLinks(items: PartnerQuickLinkItem[]): void {
  try {
    localStorage.setItem(PARTNER_LINKS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(PARTNER_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavoriteIds(ids: string[]): void {
  try {
    localStorage.setItem(PARTNER_FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

interface PartnerLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export const PartnerLinksModal: React.FC<PartnerLinksModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
}) => {
  const [links, setLinks] = useState<PartnerQuickLinkItem[]>(() =>
    loadPartnerLinks()
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    loadFavoriteIds()
  );
  const [activeTab, setActiveTab] = useState<'all' | PartnerLinkCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // QR 팝업 상태
  const [qrTarget, setQrTarget] = useState<PartnerQuickLinkItem | null>(null);

  // 추가 / 수정 폼 상태
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formCategory, setFormCategory] =
    useState<PartnerLinkCategory>('living');
  const [formBadge, setFormBadge] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLinks(loadPartnerLinks());
      setFavoriteIds(loadFavoriteIds());
    } else {
      setQrTarget(null);
      setIsFormOpen(false);
      setEditingId(null);
    }
  }, [isOpen]);

  // 모바일 물리 뒤로가기 보호 핸들러
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (qrTarget) {
        setQrTarget(null);
        return true;
      }
      if (isFormOpen) {
        setIsFormOpen(false);
        setEditingId(null);
        return true;
      }
      if (activeTab !== 'all') {
        setActiveTab('all');
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [isOpen, qrTarget, isFormOpen, activeTab]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleToggleFavorite = (id: string) => {
    const next = favoriteIds.includes(id)
      ? favoriteIds.filter((x) => x !== id)
      : [id, ...favoriteIds];
    setFavoriteIds(next);
    saveFavoriteIds(next);
  };

  const handleOpenExternal = (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async (
    item: PartnerQuickLinkItem,
    withGreeting: boolean
  ) => {
    const textToCopy = withGreeting
      ? `[롯데하이마트 경기광주점] ${item.title} 안내드립니다.\n• ${item.description}\n👉 바로 확인하기: ${item.url}`
      : item.url;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(`${item.id}-${withGreeting ? 'msg' : 'raw'}`);
      showToast(
        withGreeting
          ? `💬 [${item.title}] 고객 카톡 안내문과 주소가 복사되었습니다!`
          : `🔗 [${item.title}] 주소(URL)가 복사되었습니다!`
      );
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormUrl('');
    setFormCategory(activeTab === 'all' ? 'living' : activeTab);
    setFormBadge('');
    setFormDesc('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: PartnerQuickLinkItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormCategory(item.category);
    setFormBadge(item.badgeText);
    setFormDesc(item.description);
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = formTitle.trim();
    let cleanUrl = formUrl.trim();
    if (!cleanTitle || !cleanUrl) {
      showToast('⚠️ 바로가기 이름과 주소(URL)를 모두 입력해 주세요.');
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const isStaff = formCategory === 'staff';
    const defaultBadge =
      formCategory === 'living'
        ? '입주·제휴'
        : formCategory === 'resell'
        ? '중고·특가'
        : '직원 전용';

    if (editingId) {
      const next = links.map((it) =>
        it.id === editingId
          ? {
              ...it,
              title: cleanTitle,
              url: cleanUrl,
              category: formCategory,
              badgeText: formBadge.trim() || defaultBadge,
              description: formDesc.trim() || `${cleanTitle} 바로가기`,
              isStaffOnly: isStaff,
            }
          : it
      );
      setLinks(next);
      savePartnerLinks(next);
      showToast(`✅ [${cleanTitle}] 바로가기 정보가 수정되었습니다.`);
    } else {
      const newItem: PartnerQuickLinkItem = {
        id: `custom-${Date.now()}`,
        title: cleanTitle,
        url: cleanUrl,
        category: formCategory,
        badgeText: formBadge.trim() || defaultBadge,
        description: formDesc.trim() || `${cleanTitle} 바로가기`,
        isStaffOnly: isStaff,
        isBuiltIn: false,
      };
      const next = [newItem, ...links];
      setLinks(next);
      savePartnerLinks(next);
      showToast(`✨ 새 바로가기 [${cleanTitle}] 항목이 등록되었습니다!`);
    }
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDeleteLink = (item: PartnerQuickLinkItem) => {
    const next = links.filter((x) => x.id !== item.id);
    setLinks(next);
    savePartnerLinks(next);
    showToast(`🗑️ [${item.title}] 바로가기가 삭제되었습니다.`);
  };

  const handleResetDefaults = () => {
    setLinks(DEFAULT_PARTNER_LINKS);
    savePartnerLinks(DEFAULT_PARTNER_LINKS);
    showToast('🔄 기본 6대 바로가기 주소로 복원되었습니다.');
  };

  const filteredLinks = useMemo(() => {
    return links
      .filter((it) => {
        if (activeTab !== 'all' && it.category !== activeTab) return false;
        if (searchQuery.trim()) {
          return matchesSearch(
            `${it.title} ${it.badgeText} ${it.description} ${it.url}`,
            searchQuery
          );
        }
        return true;
      })
      .sort((a, b) => {
        const favA = favoriteIds.includes(a.id) ? 1 : 0;
        const favB = favoriteIds.includes(b.id) ? 1 : 0;
        return favB - favA;
      });
  }, [links, activeTab, searchQuery, favoriteIds]);

  const counts = useMemo(
    () => ({
      all: links.length,
      living: links.filter((x) => x.category === 'living').length,
      resell: links.filter((x) => x.category === 'resell').length,
      staff: links.filter((x) => x.category === 'staff').length,
    }),
    [links]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col transition-colors ${
          isDark
            ? 'bg-[#121722] border-white/15 text-slate-100'
            : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
        }`}
      >
        {/* 상단 헤더 */}
        <div
          className={`px-4 sm:px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark
              ? 'bg-[#171E2E] border-white/10'
              : 'bg-[#18181B] text-white border-stone-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-sm shrink-0">
              <Link2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                  제휴 · 업무 바로가기 허브
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black">
                  총 {links.length}개 등록됨
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium truncate">
                입주청소 · 방충망 · 중고보상 · 하이프리드 수당 · SK청약을 터치 한 번으로 실행·공유합니다
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openAddForm}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>주소 추가</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 카테고리 탭 & 검색바 */}
        <div
          className={`px-4 sm:px-6 py-3 border-b space-y-2.5 shrink-0 ${
            isDark
              ? 'bg-[#151B28] border-white/10'
              : 'bg-white border-[#E4DFD5]'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: `전체 (${counts.all})` },
                { id: 'living', label: `🏠 입주·이사 제휴 (${counts.living})` },
                { id: 'resell', label: `♻️ 중고·특가 (${counts.resell})` },
                { id: 'staff', label: `🔒 직원 전용 (${counts.staff})` },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-2xs'
                        : 'bg-[#18181B] text-white border-[#18181B] shadow-2xs'
                      : isDark
                      ? 'bg-[#1D2536] text-slate-300 border-white/10 hover:bg-[#253047]'
                      : 'bg-[#FAF8F4] text-[#57534E] border-[#E4DFD5] hover:bg-[#EFECE4]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleResetDefaults}
              title="기본 6개 주소로 복원"
              className={`ml-auto px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border whitespace-nowrap cursor-pointer ${
                isDark
                  ? 'bg-[#1D2536] text-slate-300 border-white/10 hover:bg-[#253047]'
                  : 'bg-[#FAF8F4] text-[#78716C] border-[#E4DFD5] hover:bg-[#EFECE4]'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">기본값 복원</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="방충망, 크린토피아, 중고, 수당, SK인터넷 (초성 ㅂㅊㅁ, ㅅㄷ 검색 가능)"
              className={`w-full pl-9 pr-8 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-hidden ${
                isDark
                  ? 'bg-[#0E131D] border-white/10 text-white placeholder:text-slate-500 focus:border-sky-400'
                  : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B] placeholder:text-stone-400 focus:border-[#8C5A32]'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 본문 영역 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {toastMsg && (
            <div className="px-4 py-2.5 rounded-2xl bg-slate-900 text-amber-300 text-xs font-black flex items-center justify-between shadow-md">
              <span>{toastMsg}</span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="text-slate-400 hover:text-white ml-2 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {/* 새 주소 추가 / 기존 주소 수정 폼 */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveForm}
              className={`p-4 rounded-2xl border-2 space-y-3 ${
                isDark
                  ? 'bg-[#192131] border-sky-400/40'
                  : 'bg-white border-[#8C5A32]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {editingId
                    ? '바로가기 주소 수정 (내 전용 코드·URL 저장 가능)'
                    : '새 제휴 · 업무 바로가기 등록'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                  }}
                  className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
                >
                  취소
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold opacity-75 mb-1">
                    분류 선택
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as PartnerLinkCategory)
                    }
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-black ${
                      isDark
                        ? 'bg-[#0E131D] border-white/15 text-white'
                        : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
                    }`}
                  >
                    <option value="living">🏠 입주·이사 제휴 (고객 안내용)</option>
                    <option value="resell">♻️ 중고·특가 조회 (고객 겸용)</option>
                    <option value="staff">🔒 직원 전용 (수당·청약 포털)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold opacity-75 mb-1">
                    바로가기 명칭 (필수)
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="예: KT 인터넷 청약"
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-black ${
                      isDark
                        ? 'bg-[#0E131D] border-white/15 text-white'
                        : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold opacity-75 mb-1">
                    배지 태그 (선택)
                  </label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="예: 결합 특가 / 직원 전용"
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${
                      isDark
                        ? 'bg-[#0E131D] border-white/15 text-white'
                        : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold opacity-75 mb-1">
                  연결 주소 URL (필수)
                </label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono font-bold ${
                    isDark
                      ? 'bg-[#0E131D] border-white/15 text-white'
                      : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
                  }`}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-extrabold opacity-75 mb-1">
                    한 줄 설명 (카톡 안내문 복사 시 함께 활용)
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="예: 인터넷+TV 신규 가입 시 사은품 및 결합 할인 접수"
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-medium ${
                      isDark
                        ? 'bg-[#0E131D] border-white/15 text-white'
                        : 'bg-[#FAF8F4] border-[#DCD5C7] text-[#18181B]'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shrink-0"
                >
                  저장하기
                </button>
              </div>
            </form>
          )}

          {/* 바로가기 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredLinks.map((item) => {
              const isFav = favoriteIds.includes(item.id);
              const isStaff = item.category === 'staff' || item.isStaffOnly;

              const catTone =
                item.category === 'living'
                  ? isDark
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : item.category === 'resell'
                  ? isDark
                    ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                    : 'bg-sky-100 text-sky-900 border-sky-300'
                  : isDark
                  ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  : 'bg-rose-100 text-rose-900 border-rose-300';

              return (
                <div
                  key={item.id}
                  className={`min-w-0 rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${
                    isDark
                      ? 'bg-[#171E2C] border-white/10 hover:border-white/20'
                      : 'bg-white border-[#E4DFD5] hover:border-[#C8BFA8] shadow-2xs'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black border ${catTone}`}
                      >
                        {isStaff ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Globe className="w-3 h-3" />
                        )}
                        {item.badgeText}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(item.id)}
                          title="상단 즐겨찾기 고정"
                          className={`p-1.5 rounded-lg cursor-pointer transition ${
                            isFav
                              ? 'text-amber-400'
                              : 'opacity-40 hover:opacity-100'
                          }`}
                        >
                          <Star
                            className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          title="주소 또는 설명 수정"
                          className="p-1.5 rounded-lg opacity-55 hover:opacity-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!item.isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(item)}
                            title="바로가기 삭제"
                            className="p-1.5 rounded-lg text-rose-500 opacity-70 hover:opacity-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-black tracking-tight">
                      {item.title}
                    </h3>

                    <p
                      className={`text-xs leading-relaxed font-medium ${
                        isDark ? 'text-slate-400' : 'text-[#68625B]'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* 하단 원터치 액션 버튼들 */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenExternal(item.url)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs ${
                        isStaff
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : isDark
                          ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                          : 'bg-[#18181B] hover:bg-[#2E2E33] text-white'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>바로 열기</span>
                    </button>

                    {!isStaff ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item, true)}
                          className={`py-2.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 border cursor-pointer transition ${
                            isDark
                              ? 'bg-[#222B3E] hover:bg-[#2B364E] text-amber-300 border-white/10'
                              : 'bg-[#FAF6EE] hover:bg-[#F2E9D8] text-[#7C4D25] border-[#DFD4C0]'
                          }`}
                          title="고객에게 카톡/문자로 보낼 안내 문구와 주소 복사"
                        >
                          {copiedId === `${item.id}-msg` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                          <span>안내문 복사</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrTarget(item)}
                          className={`py-2.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 border cursor-pointer transition ${
                            isDark
                              ? 'bg-[#222B3E] hover:bg-[#2B364E] text-slate-200 border-white/10'
                              : 'bg-white hover:bg-[#F3EFE6] text-[#18181B] border-[#DFD9CE]'
                          }`}
                          title="고객 휴대폰 카메라 스캔용 QR 코드 띄우기"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item, false)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 border cursor-pointer transition ${
                          isDark
                            ? 'bg-[#222B3E] hover:bg-[#2B364E] text-slate-200 border-white/10'
                            : 'bg-white hover:bg-[#F3EFE6] text-[#18181B] border-[#DFD9CE]'
                        }`}
                        title="순수 URL 주소만 복사 (직원 전용)"
                      >
                        {copiedId === `${item.id}-raw` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>주소 복사</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 고객 휴대폰 스캔용 즉석 QR 팝업 */}
      {qrTarget && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setQrTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white text-slate-900 p-6 shadow-2xl border border-slate-200 text-center space-y-4"
          >
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black">
                고객 스마트폰 카메라로 스캔해 주세요
              </span>
              <h3 className="text-lg font-black tracking-tight">
                {qrTarget.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {qrTarget.description}
              </p>
            </div>

            <div className="mx-auto w-60 h-60 rounded-2xl border-2 border-slate-200 bg-white p-3 flex items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                  qrTarget.url
                )}`}
                alt={`${qrTarget.title} QR 코드`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyLink(qrTarget, true)}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                💬 카톡 안내문 복사
              </button>
              <button
                type="button"
                onClick={() => setQrTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
