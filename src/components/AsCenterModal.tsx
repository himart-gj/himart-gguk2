import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Phone,
  Search,
  Tv,
  Wrench,
  X,
} from 'lucide-react';
import {
  MAJOR_AS_CENTERS,
  PLUX_AS_GROUPS,
  PLUX_CATEGORY_BUTTON_LABELS,
} from './asCenterData';
import { FlagshipModalShell } from './ui/FlagshipModalShell';

export interface AsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AsCenterModal: React.FC<AsCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [asSearchQuery, setAsSearchQuery] = useState<string>('');
  const [activeMainSection, setActiveMainSection] = useState<
    'major' | 'tcl' | 'plux' | null
  >(null);
  const [activePluxCategory, setActivePluxCategory] = useState<string | null>(
    null
  );
  const [isTclGuideOpen, setIsTclGuideOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 대분류 1·2·3 및 TCL 가이드 자동 시선이동 Ref
  const majorSectionRef = useRef<HTMLDivElement>(null);
  const tclSectionRef = useRef<HTMLDivElement>(null);
  const pluxSectionRef = useRef<HTMLDivElement>(null);
  const tclGuideRef = useRef<HTMLDivElement>(null);

  // AS센터 모달 내부 하위 상태 뒤로가기 핸들러 등록:
  // ① 플럭스 품목 팝업(activePluxCategory) ➔ ② TCL 리모컨 설정 가이드(isTclGuideOpen) ➔ ③ 검색어(asSearchQuery) ➔ ④ 대분류 아코디언(activeMainSection)
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (activePluxCategory !== null) {
        setActivePluxCategory(null);
        return true;
      }
      if (isTclGuideOpen) {
        setIsTclGuideOpen(false);
        return true;
      }
      if (asSearchQuery.trim() !== '') {
        setAsSearchQuery('');
        return true;
      }
      if (activeMainSection !== null) {
        setActiveMainSection(null);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [isOpen, activePluxCategory, isTclGuideOpen, asSearchQuery, activeMainSection]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // ignore
    }
  };

  const normalizedQuery = asSearchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const filteredMajorCenters = useMemo(() => {
    if (!normalizedQuery) return MAJOR_AS_CENTERS;
    return MAJOR_AS_CENTERS.filter(
      (item) =>
        item.brand.toLowerCase().includes(normalizedQuery) ||
        item.keywords.toLowerCase().includes(normalizedQuery) ||
        item.phones.some(
          (p) =>
            p.number.includes(normalizedQuery) ||
            (p.label && p.label.toLowerCase().includes(normalizedQuery))
        )
    );
  }, [normalizedQuery]);

  const showTclSection = useMemo(() => {
    if (!normalizedQuery) return true;
    const tclKeywords =
      'tcl 티씨엘 tv 티비 리모컨 셋탑박스 iptv cec 페어링 1660-1870';
    return tclKeywords.includes(normalizedQuery);
  }, [normalizedQuery]);

  const filteredPluxGroups = useMemo(() => {
    if (!normalizedQuery) return PLUX_AS_GROUPS;
    return PLUX_AS_GROUPS.map((group) => {
      const buttonLabel =
        PLUX_CATEGORY_BUTTON_LABELS[group.category] || group.category;
      const catMatch =
        group.category.toLowerCase().includes(normalizedQuery) ||
        buttonLabel.toLowerCase().includes(normalizedQuery) ||
        '플럭스 plux 하이메이드 himade pb'.includes(normalizedQuery);
      const matchedEntries = group.entries.filter(
        (entry) =>
          catMatch ||
          entry.partnerName.toLowerCase().includes(normalizedQuery) ||
          entry.modelsDesc.toLowerCase().includes(normalizedQuery) ||
          entry.phones.some(
            (p) =>
              p.number.includes(normalizedQuery) ||
              (p.label && p.label.toLowerCase().includes(normalizedQuery))
          )
      );
      return {
        ...group,
        entries: matchedEntries,
      };
    }).filter((g) => g.entries.length > 0);
  }, [normalizedQuery]);

  if (!isOpen) return null;

  const tclRemoteGuideText = [
    '[롯데하이마트 경기광주점] 📺 TCL TV 통합리모컨(IPTV) 호환 설정 안내',
    '• TCL 고객센터: 1660-1870 (패널 3년 / 일반부품 2년 무상보증)',
    '',
    '① 사전 준비: 셋탑박스를 TV HDMI 1번 포트(권장)에 연결해 주세요.',
    '② CEC 활성화: 리모컨 설정(톱니바퀴) ➔ 모든 설정 ➔ 채널 및 입력 ➔ 입력 ➔ 외부장치제어(CEC) ➔ [HDMI 제어] 및 [동시에 TV 전원 켜기] 활성화',
    '③ 스크린리스 활성화: 설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔ [스크린리스] 활성화',
    "④ 전원 켰을 때 IPTV 바로 연결: 설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔ 전원이 켜질 때 동작 ➔ ['마지막으로 사용한 입력'] 선택",
    '⑤ 리모컨 페어링: 리모컨 [OK 버튼 + 홈(집) 버튼] 동시에 5초 누르기 (수동: 설정 ➔ 채널 및 입력 ➔ 리모컨 및 액세서리 ➔ 리모컨 페어링)',
  ].join('\n');

  const isMajorVisible = isSearching
    ? filteredMajorCenters.length > 0
    : activeMainSection === 'major';
  const isTclVisible = isSearching
    ? showTclSection
    : activeMainSection === 'tcl';
  const isPluxVisible = isSearching
    ? filteredPluxGroups.length > 0
    : activeMainSection === 'plux';

  const selectedPluxGroupObj = PLUX_AS_GROUPS.find(
    (g) => g.category === activePluxCategory
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 no-print animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-5xl h-[93dvh] sm:h-auto sm:max-h-[94dvh] rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 border-t-[3px] border-t-[#E60012] shadow-2xl modal-kb-safe flex flex-col overflow-hidden text-[#191F28] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="bg-white dark:bg-[#131C2E] border-b border-[#E5E8EB] dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 truncate">
                  가전 A/S 센터 &amp; 플럭스(PLUX) · TCL 통합 안내
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[11.5px] font-bold text-[#059669] dark:text-emerald-300 shrink-0">
                  직통번호 · 카톡복사
                </span>
              </div>
              <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 font-medium hidden sm:block mt-0.5">
                주요 대기업 가전 · TCL TV · 하이마트 자체브랜드(PLUX/하이메이드) 품목별 A/S 직통 번호
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="w-9 h-9 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#4E5968] dark:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 상단 고정 검색창 */}
        <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border-b border-[#E5E8EB] dark:border-slate-800 px-3 sm:px-5 py-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8B95A1] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={asSearchQuery}
              onChange={(e) => setAsSearchQuery(e.target.value)}
              placeholder="품목명, 브랜드, PLX 모델명 검색 (예: 삼성, 냉장고, 실링팬, PLX-RF420, TCL, 바디프랜드...)"
              className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 text-base sm:text-sm font-bold text-[#191F28] dark:text-slate-100 placeholder:text-[#8B95A1] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#1B64DA] dark:focus:border-blue-400 transition-colors"
            />
            {asSearchQuery && (
              <button
                type="button"
                onClick={() => setAsSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 text-xs font-extrabold cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#F2F4F6] dark:bg-[#0B1120] space-y-4">
          {/* 상단 대분류 3가지 선택 버튼 (기본 접힘 상태) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300">
                조회할 A/S 대분류를 선택하세요 (클릭 시 펼쳐짐)
              </span>
              {activeMainSection !== null && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainSection(null);
                    setActivePluxCategory(null);
                  }}
                  className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-200 underline cursor-pointer"
                >
                  전체 접기
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 대분류 1 */}
              <button
                type="button"
                onClick={() => {
                  setActiveMainSection((prev) => {
                    const next = prev === 'major' ? null : 'major';
                    if (next === 'major') {
                      window.history.pushState({ appGuard: true }, '');
                      setTimeout(() => {
                        majorSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }, 80);
                    }
                    return next;
                  });
                }}
                className={`p-3.5 rounded-2xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  activeMainSection === 'major'
                    ? 'bg-[#191F28] border-[#191F28] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0B1120]'
                    : 'bg-white dark:bg-[#131C2E] hover:bg-[#F8FAFC] dark:hover:bg-slate-800/80 border-[#E5E8EB] dark:border-slate-800 text-[#191F28] dark:text-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold truncate">
                    1. 주요 브랜드 A/S
                  </div>
                  <div
                    className={`text-[11.5px] font-medium mt-0.5 truncate ${
                      activeMainSection === 'major'
                        ? 'text-slate-300 dark:text-slate-900'
                        : 'text-[#4E5968] dark:text-slate-400'
                    }`}
                  >
                    삼성·LG·쿠쿠·위니아·다이슨·안마의자 등
                  </div>
                </div>
                {activeMainSection === 'major' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[#8B95A1]" />
                )}
              </button>

              {/* 대분류 2 */}
              <button
                type="button"
                onClick={() => {
                  setActiveMainSection((prev) => {
                    const next = prev === 'tcl' ? null : 'tcl';
                    if (next === 'tcl') {
                      window.history.pushState({ appGuard: true }, '');
                      setTimeout(() => {
                        tclSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }, 80);
                    }
                    return next;
                  });
                }}
                className={`p-3.5 rounded-2xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  activeMainSection === 'tcl'
                    ? 'bg-[#191F28] border-[#191F28] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0B1120]'
                    : 'bg-white dark:bg-[#131C2E] hover:bg-[#F8FAFC] dark:hover:bg-slate-800/80 border-[#E5E8EB] dark:border-slate-800 text-[#191F28] dark:text-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold truncate">
                    2. TCL TV 전용 A/S &amp; 리모컨 설정
                  </div>
                  <div
                    className={`text-[11.5px] font-medium mt-0.5 truncate ${
                      activeMainSection === 'tcl'
                        ? 'text-slate-300 dark:text-slate-900'
                        : 'text-[#4E5968] dark:text-slate-400'
                    }`}
                  >
                    1660-1870 · 공식 고객센터 · IPTV 호환
                  </div>
                </div>
                {activeMainSection === 'tcl' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[#8B95A1]" />
                )}
              </button>

              {/* 대분류 3 */}
              <button
                type="button"
                onClick={() => {
                  setActiveMainSection((prev) => {
                    const next = prev === 'plux' ? null : 'plux';
                    if (next === 'plux') {
                      window.history.pushState({ appGuard: true }, '');
                      setTimeout(() => {
                        pluxSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }, 80);
                    }
                    return next;
                  });
                }}
                className={`p-3.5 rounded-2xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  activeMainSection === 'plux'
                    ? 'bg-[#191F28] border-[#191F28] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0B1120]'
                    : 'bg-white dark:bg-[#131C2E] hover:bg-[#F8FAFC] dark:hover:bg-slate-800/80 border-[#E5E8EB] dark:border-slate-800 text-[#191F28] dark:text-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold truncate">
                    3. 플럭스(PLUX) · 하이메이드 품목별 A/S
                  </div>
                  <div
                    className={`text-[11.5px] font-medium mt-0.5 truncate ${
                      activeMainSection === 'plux'
                        ? 'text-slate-300 dark:text-slate-900'
                        : 'text-[#4E5968] dark:text-slate-400'
                    }`}
                  >
                    하이마트 PB 8대 품목 위탁 파트너사
                  </div>
                </div>
                {activeMainSection === 'plux' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[#8B95A1]" />
                )}
              </button>
            </div>
          </div>

          {/* 아무것도 선택하지 않았고 검색어도 없을 때 안내 배너 */}
          {!isSearching && activeMainSection === null && (
            <div className="rounded-[20px] bg-white dark:bg-[#131C2E] border border-dashed border-[#D1D6DB] dark:border-slate-700 p-6 text-center space-y-1.5">
              <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                위 3가지 대분류 버튼 중 하나를 클릭하거나, 상단 검색창에 브랜드/모델명을 입력해 주세요.
              </div>
              <p className="text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                예: 삼성, LG, TCL, 냉장고, 실링팬, PLX-RF420, 바디프랜드 등 검색 시 즉시 자동 펼쳐짐
              </p>
            </div>
          )}

          {/* 검색 결과가 전혀 없을 때 */}
          {isSearching &&
            filteredMajorCenters.length === 0 &&
            !showTclSection &&
            filteredPluxGroups.length === 0 && (
              <div className="p-8 rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 text-center text-xs sm:text-sm font-bold text-[#4E5968] dark:text-slate-400">
                검색하신 품목 또는 모델명과 일치하는 A/S 센터가 없습니다.
              </div>
            )}

          {/* 1. 주요 브랜드 A/S 센터 */}
          {isMajorVisible && (
            <div
              ref={majorSectionRef}
              className="space-y-2.5 rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-3.5 sm:p-4 scroll-mt-2"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                  <span>1. 주요 브랜드 A/S 센터</span>
                </h3>
                <span className="text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400">
                  전화걸기 또는 번호 복사 가능
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredMajorCenters.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-2.5"
                  >
                    <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                      {item.brand}
                    </div>

                    <div className="space-y-1.5">
                      {item.phones.map((ph) => {
                        const copyId = `major-${item.id}-${ph.number}`;
                        return (
                          <div
                            key={ph.number}
                            className="flex items-center justify-between gap-1.5 bg-white dark:bg-[#131C2E] px-2.5 py-1.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800"
                          >
                            <div className="min-w-0">
                              {ph.label && (
                                <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 mr-1.5">
                                  [{ph.label}]
                                </span>
                              )}
                              <span className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                                {ph.number}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`tel:${ph.number}`}
                                className="px-2 py-1 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Phone className="w-3 h-3" />
                                <span>전화</span>
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  copyText(
                                    copyId,
                                    `[${item.brand}${
                                      ph.label ? ` - ${ph.label}` : ''
                                    }] 고객센터: ${ph.number}`
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-200 text-[11.5px] font-extrabold transition-colors cursor-pointer"
                              >
                                {copiedKey === copyId ? '✓ 복사됨' : '복사'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 📺 TCL TV 전용 A/S 센터 & 통합리모컨 호환 가이드 카드 */}
          {isTclVisible && (
            <div
              ref={tclSectionRef}
              className="rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-4 sm:p-5 space-y-3.5 scroll-mt-2"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E8EB] dark:border-slate-800 pb-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#1B64DA] text-white text-xs font-extrabold flex items-center gap-1">
                      <Tv className="w-3.5 h-3.5" />
                      2. TCL TV 전용 A/S 센터
                    </span>
                    <span className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                      패널 3년 무상보증 / 기타 부품 2년 무상보증
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[#191F28] dark:text-slate-50">
                    TCL 고객센터:{' '}
                    <span className="text-[#E60012] dark:text-[#FF3B47] font-mono tabular-nums">
                      1660-1870
                    </span>
                    <span className="text-xs font-medium text-[#4E5968] dark:text-slate-400 ml-2">
                      (평일 09:00~18:00 / 점심 12:00~13:00 / 주말·공휴일 휴무)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#4E5968] dark:text-slate-300">
                    • 영업담당 문의: 매장 안내 참조 (공식 A/S 및 설치 문의는 고객센터 1660-1870 이용)
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <a
                    href="tel:1660-1870"
                    className="px-3 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold font-mono tabular-nums flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>센터 전화 (1660-1870)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'tcl-as-copy',
                        '[TCL TV 고객센터 안내]\n• 전화번호: 1660-1870 (평일 09:00~18:00 / 점심 12:00~13:00)\n• 보증기간: 패널 3년 무상보증 / 기타 부품 2년 무상보증'
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100 text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {copiedKey === 'tcl-as-copy' ? '✓ 복사됨' : '번호 복사'}
                  </button>
                </div>
              </div>

              {/* 접기/펼치기 + 카톡 복사: TCL TV 리모컨 IPTV 호환 설정법 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTclGuideOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          window.history.pushState({ appGuard: true }, '');
                          setTimeout(() => {
                            tclGuideRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }, 80);
                        }
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#191F28] dark:bg-slate-800 hover:opacity-90 text-white text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {isTclGuideOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    <span>
                      TCL TV 리모컨 IPTV(셋탑박스) 호환 설정법{' '}
                      {isTclGuideOpen ? '접기' : '펼쳐보기'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      copyText('tcl-remote-guide', tclRemoteGuideText)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {copiedKey === 'tcl-remote-guide' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#059669]" />
                        <span>✓ 리모컨 설정법 카톡 복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>리모컨 IPTV 호환 설정법 카톡 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {isTclGuideOpen && (
                  <div
                    ref={tclGuideRef}
                    className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 space-y-2 text-xs font-medium text-[#4E5968] dark:text-slate-300 leading-relaxed"
                  >
                    <p>
                      <strong className="text-[#191F28] dark:text-slate-100 font-extrabold">① 사전 준비:</strong>{' '}
                      셋탑박스를 TV{' '}
                      <strong className="text-[#1B64DA] dark:text-blue-400 underline">
                        HDMI 1번 포트(권장)
                      </strong>
                      에 연결
                    </p>
                    <p>
                      <strong className="text-[#191F28] dark:text-slate-100 font-extrabold">
                        ② CEC 활성화:
                      </strong>{' '}
                      리모컨 설정(톱니바퀴) ➔ 모든 설정 ➔ 채널 및 입력 ➔ 입력 ➔ 외부장치제어(CEC) ➔{' '}
                      <strong className="text-[#059669] dark:text-emerald-400">
                        [HDMI 제어] 및 [동시에 TV 전원 켜기] 활성화
                      </strong>
                    </p>
                    <p>
                      <strong className="text-[#191F28] dark:text-slate-100 font-extrabold">
                        ③ 스크린리스 활성화:
                      </strong>{' '}
                      설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔{' '}
                      <strong className="text-[#059669] dark:text-emerald-400">
                        [스크린리스] 활성화
                      </strong>
                    </p>
                    <p>
                      <strong className="text-[#191F28] dark:text-slate-100 font-extrabold">
                        ④ 전원 켰을 때 IPTV 바로 연결:
                      </strong>{' '}
                      설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔ 전원이 켜질 때 동작 ➔{' '}
                      <strong className="text-[#1B64DA] dark:text-blue-400">
                        &apos;마지막으로 사용한 입력&apos; 선택
                      </strong>
                    </p>
                    <p>
                      <strong className="text-[#191F28] dark:text-slate-100 font-extrabold">
                        ⑤ 리모컨 페어링:
                      </strong>{' '}
                      리모컨{' '}
                      <strong className="text-[#E60012] dark:text-[#FF3B47]">
                        OK 버튼 + 홈(집) 버튼 동시에 5초 누르기
                      </strong>{' '}
                      (수동: 설정 ➔ 채널 및 입력 ➔ 리모컨 및 액세서리 ➔ 리모컨 페어링)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. 🏷️ 하이마트 PB 자체브랜드 플럭스(PLUX) · 하이메이드 품목별 A/S 접수처 */}
          {isPluxVisible && (
            <div
              ref={pluxSectionRef}
              className="space-y-3.5 rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 p-3.5 sm:p-4 scroll-mt-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <h3 className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                  <span>
                    3. 플럭스(PLUX) · 하이메이드 품목별 A/S 접수처
                  </span>
                </h3>
              </div>

              {/* 기본 접수 원칙 배너 */}
              <div className="rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 text-xs font-medium text-[#4E5968] dark:text-slate-300">
                  <div className="font-extrabold text-[#191F28] dark:text-slate-100 text-xs sm:text-sm">
                    플럭스(PLUX) · 하이메이드 기본 A/S 접수 원칙
                  </div>
                  <p>
                    ① <strong className="text-[#1B64DA] dark:text-blue-300 font-extrabold">하이마트 당사 접수:</strong>{' '}
                    전산{' '}
                    <strong className="underline text-[#191F28] dark:text-slate-100">
                      &ldquo;HISIS - 서비스접수 및 처리내역&rdquo;
                    </strong>
                    에서 접수 또는 하이마트 대표 CS{' '}
                    <strong className="text-[#E60012] dark:text-[#FF3B47] font-mono tabular-nums font-extrabold">
                      1588-9030
                    </strong>
                  </p>
                  <p>
                    ② <strong className="text-[#1B64DA] dark:text-blue-300 font-extrabold">파트너사 직접 접수:</strong>{' '}
                    아래 8개 품목 버튼을 클릭하면 전용 팝업창에서 위탁 파트너사 직통 번호를 즉시 확인하실 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href="tel:1588-9030"
                    className="px-3.5 py-2 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-extrabold font-mono tabular-nums flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>대표 CS 1588-9030</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'himart-cs-main',
                        '[롯데하이마트 대표 CS / 플럭스·하이메이드 접수] 1588-9030'
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#131C2E] hover:bg-[#F2F4F6] dark:hover:bg-slate-800 text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {copiedKey === 'himart-cs-main' ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
              </div>

              {/* 검색 중이 아닐 때: 8대 품목 2열/4열 그리드 버튼 (클릭 시 중앙 서브 팝업 오픈) */}
              {!isSearching ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300">
                      조회할 플럭스(PLUX) · 하이메이드 품목을 터치하세요 (전용 팝업 오픈)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PLUX_AS_GROUPS.map((group) => {
                      const isSelected = activePluxCategory === group.category;
                      const btnLabel =
                        PLUX_CATEGORY_BUTTON_LABELS[group.category] ||
                        group.category;
                      return (
                        <button
                          key={group.category}
                          type="button"
                          onClick={() => {
                            window.history.pushState({ appGuard: true }, '');
                            setActivePluxCategory(group.category);
                          }}
                          className={`px-3 py-3 rounded-2xl border text-left transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#191F28] border-[#191F28] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-[#0B1120]'
                              : 'bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#EFF6FF] dark:hover:bg-blue-500/15 border-[#E5E8EB] dark:border-slate-800 hover:border-[#1B64DA] text-[#191F28] dark:text-slate-100'
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-extrabold leading-snug break-keep">
                            {btnLabel}
                          </span>
                          <span
                            className={`text-[11.5px] font-bold px-2 py-0.5 rounded-md shrink-0 font-mono tabular-nums ${
                              isSelected
                                ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-[#0B1120]'
                                : 'bg-white dark:bg-[#131C2E] text-[#1B64DA] dark:text-blue-400 border border-[#E5E8EB] dark:border-slate-700'
                            }`}
                          >
                            {group.entries.length}곳
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* 검색어 입력 시: 일치하는 플럭스 품목들을 즉시 펼쳐서 표시 */
                <div className="space-y-3">
                  {filteredPluxGroups.map((group) => (
                    <div
                      key={group.category}
                      className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 overflow-hidden"
                    >
                      <div className="bg-[#191F28] dark:bg-slate-900 text-white px-4 py-2.5 text-xs sm:text-sm font-extrabold flex items-center justify-between">
                        <span>
                          {PLUX_CATEGORY_BUTTON_LABELS[group.category] ||
                            `■ ${group.category}`}
                        </span>
                        <span className="text-[11.5px] font-bold text-slate-300 font-mono tabular-nums">
                          {group.entries.length}개 위탁 파트너
                        </span>
                      </div>

                      <div className="divide-y divide-[#E5E8EB] dark:divide-slate-800">
                        {group.entries.map((entry, idx) => (
                          <div
                            key={`${group.category}-${idx}`}
                            className="p-3 sm:p-3.5 bg-white dark:bg-[#131C2E] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                                • {entry.partnerName}
                              </div>
                              <div className="text-xs font-medium text-[#4E5968] dark:text-slate-400 leading-relaxed break-words">
                                {entry.modelsDesc}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              {entry.phones.map((ph) => {
                                const copyId = `plux-${group.category}-${entry.partnerName}-${ph.number}`;
                                return (
                                  <div
                                    key={ph.number}
                                    className="inline-flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-slate-900/70 px-2.5 py-1.5 rounded-xl border border-[#E5E8EB] dark:border-slate-700"
                                  >
                                    {ph.label && (
                                      <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                                        [{ph.label}]
                                      </span>
                                    )}
                                    <span className="text-xs font-extrabold font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 mr-1">
                                      {ph.number}
                                    </span>
                                    <a
                                      href={`tel:${ph.number}`}
                                      className="px-2 py-1 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>전화</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyText(
                                          copyId,
                                          `[플럭스/하이메이드 ${group.category} - ${entry.partnerName}] A/S 센터: ${ph.number}\n대상 모델: ${entry.modelsDesc}`
                                        )
                                      }
                                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-200 border border-[#D1D6DB] dark:border-slate-700 text-[11.5px] font-extrabold transition-colors cursor-pointer"
                                    >
                                      {copiedKey === copyId ? '✓ 복사됨' : '복사'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 플럭스(PLUX) 8대 품목 전용 서브 팝업 모달 */}
      {selectedPluxGroupObj && (
        <div onClick={(e) => e.stopPropagation()}>
          <FlagshipModalShell
            isOpen={Boolean(selectedPluxGroupObj)}
            onClose={() => setActivePluxCategory(null)}
            title={`${
              PLUX_CATEGORY_BUTTON_LABELS[selectedPluxGroupObj.category] ||
              selectedPluxGroupObj.category
            } 위탁 파트너사`}
            subtitle="바깥 배경이나 닫기(✕) 또는 휴대폰 뒤로가기를 누르면 품목 선택으로 돌아갑니다"
            badge={`${selectedPluxGroupObj.entries.length}곳`}
            icon={<Wrench className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
            maxWidthClass="max-w-3xl"
            zIndexClass="z-[60]"
            bodyClassName="flex-1 overflow-y-auto bg-[#F2F4F6] dark:bg-[#0B1120] p-3 sm:p-4 space-y-2.5"
          >
            {selectedPluxGroupObj.entries.map((entry, idx) => (
              <div
                key={`${selectedPluxGroupObj.category}-modal-${idx}`}
                className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#131C2E] border border-[#E5E8EB] dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-xs sm:text-base font-extrabold text-[#191F28] dark:text-slate-100">
                    • {entry.partnerName}
                  </div>
                  <div className="text-xs font-medium text-[#4E5968] dark:text-slate-400 leading-relaxed break-words">
                    {entry.modelsDesc}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {entry.phones.map((ph) => {
                    const copyId = `plux-modal-${selectedPluxGroupObj.category}-${entry.partnerName}-${ph.number}`;
                    return (
                      <div
                        key={ph.number}
                        className="inline-flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-slate-900/70 px-3 py-2 rounded-xl border border-[#E5E8EB] dark:border-slate-700"
                      >
                        {ph.label && (
                          <span className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                            [{ph.label}]
                          </span>
                        )}
                        <span className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-[#1B64DA] dark:text-blue-400 mr-1">
                          {ph.number}
                        </span>
                        <a
                          href={`tel:${ph.number}`}
                          className="px-2.5 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>전화</span>
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              copyId,
                              `[플럭스/하이메이드 ${selectedPluxGroupObj.category} - ${entry.partnerName}] A/S 센터: ${ph.number}\n대상 모델: ${entry.modelsDesc}`
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-200 border border-[#D1D6DB] dark:border-slate-700 text-xs font-extrabold transition-colors cursor-pointer"
                        >
                          {copiedKey === copyId ? '✓ 복사됨' : '복사'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </FlagshipModalShell>
        </div>
      )}
    </div>
  );
};
