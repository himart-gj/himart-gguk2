import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  ExternalLink,
  MessageSquare,
  Phone,
  Save,
  Search,
  Settings,
  Tv,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';

const EMP_ID_STORAGE_KEY = 'himart_gj_emp_id';
const LOTTE_URL_STORAGE_KEY = 'himart_gj_lotte_url';
const DEFAULT_EMP_ID = '4150054';
const DEFAULT_LOTTE_URL =
  'http://m.lottecard.co.kr/spa/card/booth?bId=76417&vtCdKndC=P15670-A15670';

// ============================================================================
// 1. [🪪 카드발급] 전용 모달 (CardIssueModal)
// ============================================================================
interface CardIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CardIssueModal: React.FC<CardIssueModalProps> = ({
  isOpen,
  onClose,
}) => {
  // 저장된 사번 및 롯데 개인 발급 주소 로드
  const [savedEmpId, setSavedEmpId] = useState<string>(() => {
    try {
      return localStorage.getItem(EMP_ID_STORAGE_KEY)?.trim() || '';
    } catch {
      return '';
    }
  });
  const [savedLotteUrl, setSavedLotteUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(LOTTE_URL_STORAGE_KEY)?.trim() || '';
    } catch {
      return '';
    }
  });

  // 입력 폼 상태
  const [empInput, setEmpInput] = useState<string>(() => {
    try {
      return localStorage.getItem(EMP_ID_STORAGE_KEY)?.trim() || '';
    } catch {
      return '';
    }
  });
  const [lotteUrlInput, setLotteUrlInput] = useState<string>(() => {
    try {
      return localStorage.getItem(LOTTE_URL_STORAGE_KEY)?.trim() || '';
    } catch {
      return '';
    }
  });

  // 최초 1회도 저장하지 않은 경우에만 입력칸 열림, 저장된 값이 있으면 기본 숨김
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(() => {
    try {
      const hasEmp = Boolean(localStorage.getItem(EMP_ID_STORAGE_KEY)?.trim());
      const hasLotte = Boolean(
        localStorage.getItem(LOTTE_URL_STORAGE_KEY)?.trim()
      );
      return !(hasEmp || hasLotte);
    } catch {
      return true;
    }
  });

  // 복사 완료 토스트 키
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeEmpId = (savedEmpId || empInput.trim() || DEFAULT_EMP_ID).replace(
    /\s+/g,
    ''
  );
  const activeLotteUrl =
    savedLotteUrl || lotteUrlInput.trim() || DEFAULT_LOTTE_URL;

  // 모달 내부 하위 상태(사번·롯데주소 수정 폼) 뒤로가기 핸들러 등록
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (isEditingProfile && Boolean(savedEmpId || savedLotteUrl)) {
        setIsEditingProfile(false);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [isOpen, isEditingProfile, savedEmpId, savedLotteUrl]);

  const handleSaveProfile = () => {
    const cleanEmp = (empInput.trim() || DEFAULT_EMP_ID).replace(/\s+/g, '');
    const cleanLotte = lotteUrlInput.trim();
    try {
      localStorage.setItem(EMP_ID_STORAGE_KEY, cleanEmp);
      if (cleanLotte) {
        localStorage.setItem(LOTTE_URL_STORAGE_KEY, cleanLotte);
      } else {
        localStorage.removeItem(LOTTE_URL_STORAGE_KEY);
      }
      setSavedEmpId(cleanEmp);
      setSavedLotteUrl(cleanLotte);
      setEmpInput(cleanEmp);
      setIsEditingProfile(false);
    } catch {
      setIsEditingProfile(false);
    }
  };

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

  if (!isOpen) return null;

  // 숨김 연결할 실제 URL 목록 (화면에는 URL 문자열 절대 노출 금지)
  const samsungUrl = `https://www.samsungcard.com/personal/card/simple-apply/UHPPCA0225M0.jsp?code=AAP1883&alncmpC=QKHIMART36&affcode=HMT${activeEmpId}`;
  const shinhanUrl = `https://cardapply.shinhancard.com/apply/CardInfoSelect?EntryLoc=4474&empSeq=0&targetID=&datakev=&aqcCd=&cuRecommN=${activeEmpId}`;
  const lotteCardUrl = activeLotteUrl;
  const lotteHiPlanUrl = `https://m.lottecard.co.kr/app/LPLIFHE_V100.lc`;
  const lottePointUrl = `https://m.lpoint.com/app/card/LWCA800100.do?cop=L320&br=0134&pd=10135`;
  const wooriCardUrl = `https://nm.wooricard.com/dcmw/yh1/crd/crd01/M1CRD101S02.do?cdPrdCd=102734`;

  const renderCardBox = (card: {
    id: string;
    title: string;
    subtitle: string;
    borderClass: string;
    openBtnClass: string;
    url: string;
    kakaoText: string;
  }) => (
    <div
      key={card.id}
      className={`rounded-2xl bg-white border-2 ${card.borderClass} p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 transition`}
    >
      <div>
        <h3 className="text-sm sm:text-base font-black text-slate-900">
          {card.title}
        </h3>
        <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5 leading-snug">
          {card.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => copyText(`${card.id}-msg`, card.kakaoText)}
          className="py-2 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
        >
          {copiedKey === `${card.id}-msg` ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
              <span>복사됨</span>
            </>
          ) : (
            <>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>💬 안내문 복사</span>
            </>
          )}
        </button>

        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer ${card.openBtnClass}`}
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span>🔗 바로 열기</span>
        </a>
      </div>
    </div>
  );

  // 1번째 줄: 롯데 3종
  const row1LotteCards = [
    {
      id: 'lotte-card',
      title: '롯데 제휴카드 발급',
      subtitle: '하이마트 제휴 롯데카드 모바일 간편 신청',
      borderClass: 'border-rose-200 hover:border-rose-300',
      openBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      url: lotteCardUrl,
      kakaoText: `[롯데하이마트] 💳 롯데 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 롯데 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${lotteCardUrl}`,
    },
    {
      id: 'lotte-hiplan',
      title: '플랜약정',
      subtitle: '롯데카드 발급 후 하이플랜 캐시백 약정 등록',
      borderClass: 'border-rose-200 hover:border-rose-300',
      openBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      url: lotteHiPlanUrl,
      kakaoText: `[롯데하이마트] 📋 롯데하이플랜 약정 신청 안내\n\n아래 전용 링크에서 롯데하이플랜 약정 신청을 진행해 주세요.\n▶ 약정신청 바로가기:\n${lotteHiPlanUrl}`,
    },
    {
      id: 'lotte-lpoint',
      title: '롯데포인트 발급',
      subtitle: 'L.POINT 모바일 멤버십 가입 및 포인트 카드 발급',
      borderClass: 'border-amber-200 hover:border-amber-300',
      openBtnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
      url: lottePointUrl,
      kakaoText: `[롯데하이마트] 🪙 롯데포인트(L.POINT) 모바일 카드 발급 안내\n\n아래 링크를 통해 L.POINT 멤버십을 간편하게 가입/발급받으실 수 있습니다.\n▶ 바로가기:\n${lottePointUrl}`,
    },
  ];

  // 2번째 줄: 삼성 · 신한 2종
  const row2SamsungShinhanCards = [
    {
      id: 'samsung',
      title: '삼성 제휴카드 발급',
      subtitle: '내 사번 자동 연동 · 하이마트 제휴 삼성카드 간편 신청',
      borderClass: 'border-blue-200 hover:border-blue-300',
      openBtnClass: 'bg-blue-600 hover:bg-blue-500 text-white',
      url: samsungUrl,
      kakaoText: `[롯데하이마트] 💳 삼성 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 삼성 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${samsungUrl}`,
    },
    {
      id: 'shinhan',
      title: '신한 제휴카드 발급',
      subtitle: '내 사번 자동 연동 · 하이마트 제휴 신한카드 간편 신청',
      borderClass: 'border-indigo-200 hover:border-indigo-300',
      openBtnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      url: shinhanUrl,
      kakaoText: `[롯데하이마트] 💳 신한 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 신한 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${shinhanUrl}`,
    },
  ];

  // 3번째 줄: 우리카드 단독 1종
  const row3WooriCard = {
    id: 'woori',
    title: '우리 제휴카드 발급',
    subtitle: '일반 구매 캐시백 및 가전 구독 할인 전용 우리카드 신청',
    borderClass: 'border-sky-200 hover:border-sky-300',
    openBtnClass: 'bg-sky-600 hover:bg-sky-500 text-white',
    url: wooriCardUrl,
    kakaoText: `[롯데하이마트] 💳 우리 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 우리 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${wooriCardUrl}`,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[93dvh] sm:h-auto sm:max-h-[94dvh] rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black tracking-tight truncate">
                🪪 제휴카드 간편 발급 &amp; 우리카드 ARS 센터
              </h2>
              <p className="text-[11px] text-slate-300 font-bold hidden sm:block">
                내 사번 · 개인 롯데카드 발급주소가 자동 적용되는 원터치 발급 센터
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-black transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-3">
          {/* 상단 사번 / 롯데카드 개인 발급주소 설정 영역 (저장 완료 시 한 줄 배지로 축소) */}
          {!isEditingProfile ? (
            <div className="rounded-2xl bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap shadow-xs">
              <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-black">
                <span className="text-emerald-400">
                  ✅ 내 설정 적용 중 (사번: {activeEmpId})
                </span>
                {savedLotteUrl && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[11px] font-extrabold">
                    개인 롯데카드 주소 등록됨
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  window.history.pushState({ appGuard: true }, '');
                  setIsEditingProfile(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-black transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-sky-400" />
                <span>⚙️ 사번 · 롯데주소 수정</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 border-2 border-sky-400/60 shadow-md space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-300">
                  <UserCheck className="w-4 h-4" />
                  <span>내 사번 &amp; 개인 롯데카드 발급주소 설정 (최초 1회 저장 시 자동 숨김)</span>
                </div>
                {(savedEmpId || savedLotteUrl) && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    닫기
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-300">
                    ① 내 사번 (삼성·신한 자동 연동)
                  </label>
                  <input
                    type="text"
                    value={empInput}
                    onChange={(e) => setEmpInput(e.target.value)}
                    placeholder={DEFAULT_EMP_ID}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-sm font-black text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="sm:col-span-8 space-y-1">
                  <label className="block text-[11px] font-extrabold text-slate-300">
                    ② 내 롯데카드 개인 발급주소 (선택 · 미입력 시 매장 기본주소 사용)
                  </label>
                  <input
                    type="url"
                    value={lotteUrlInput}
                    onChange={(e) => setLotteUrlInput(e.target.value)}
                    placeholder="개인별 롯데카드 발급 URL 붙여넣기 (생략 가능)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <p className="text-[11px] font-bold text-slate-400">
                  💡 [저장 완료]를 누르면 입력창이 깔끔하게 숨겨지며 내 기기에 영구 저장됩니다.
                </p>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs sm:text-sm font-black shadow-sm transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>저장 완료</span>
                </button>
              </div>
            </div>
          )}

          {/* 1번째 줄: 롯데 3종 (롯데카드 발급 / 플랜약정 / 롯데포인트 발급) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {row1LotteCards.map((card) => renderCardBox(card))}
          </div>

          {/* 2번째 줄: 삼성 · 신한 2종 (삼성카드 발급 / 신한카드 발급) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {row2SamsungShinhanCards.map((card) => renderCardBox(card))}
          </div>

          {/* 3번째 줄: 우리카드 단독 1종 (우리카드 발급) */}
          <div className="grid grid-cols-1">
            {renderCardBox(row3WooriCard)}
          </div>

          {/* 4번째 줄: 카드번호 확인 · 특별한도 2종 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 박스 1: 카드번호 확인 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/80 border-2 border-sky-200 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-black text-sky-950">
                    카드번호 확인
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-xs font-black">
                    ARS 1800-4134
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-700 leading-relaxed space-y-1">
                  <p>
                    <strong className="text-slate-900">
                      ① ARS (1800-4134):
                    </strong>{' '}
                    통화 ➔{' '}
                    <span className="text-rose-600 font-black">
                      ③번(발급정보확인)
                    </span>{' '}
                    ➔{' '}
                    <span className="text-blue-700 font-black">
                      ①번(개인정보 동의)
                    </span>{' '}
                    ➔ 주민번호·본인인증 ➔ 카드번호·유효기간 확인
                  </p>
                  <p>
                    <strong className="text-slate-900">
                      ② 우리카드 앱:
                    </strong>{' '}
                    전체메뉴(돋보기) ➔{' '}
                    <span className="text-sky-800 font-black">
                      카드발급조회/취소
                    </span>{' '}
                    발급완료 확인 ➔{' '}
                    <span className="text-sky-800 font-black">
                      내 카드 관리 ➔ 카드번호 보기
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="tel:1800-4134"
                  className="py-2 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>📞 전화걸기</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'woori-delay-ars',
                      '[우리카드 발급 후 카드번호 확인 방법]\n① ARS 확인 (1800-4134): 통화 ➔ ③번(발급정보확인) ➔ ①번(개인정보 동의) ➔ 주민번호 입력 ➔ 휴대폰 본인인증 ➔ 카드번호 및 유효기간 확인\n② 우리카드 앱: 전체 메뉴(돋보기) ➔ 카드발급조회/취소에서 발급완료 확인 후 ➔ 내 카드 관리 ➔ 카드번호 보기'
                    )
                  }
                  className="py-2 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  {copiedKey === 'woori-delay-ars' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>💬 안내문 복사</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 박스 2: 특별한도 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-black text-amber-950">
                    특별한도
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-xs font-black">
                    ARS 1800-2452
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-700 leading-relaxed space-y-1">
                  <p>
                    <strong className="text-slate-900">
                      • 특별한도 ARS (1800-2452):
                    </strong>{' '}
                    통화 ➔ 본인확인(1번) ➔ 비밀번호 입력 ➔{' '}
                    <strong className="text-rose-600 underline underline-offset-2">
                      가전 제휴카드 특별한도 상향(2번 선택)
                    </strong>{' '}
                    ➔ 잔여한도 및 상향 가능 금액 안내 후 신청
                  </p>
                  <p className="text-[11px] text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                    ※ 우리 제휴카드 소지 회원 전용 / 취소 시 한도 복원 불가 / 3개월(1회) 우선 소진
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="tel:1800-2452"
                  className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>📞 전화걸기</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'woori-limit-ars',
                      '[우리제휴카드 특별한도 상향 ARS 안내]\n• 전용 ARS: 1800-2452\n• 진행 순서: 통화 ➔ 본인확인(1번) ➔ 비밀번호 입력 ➔ 가전 제휴카드 특별한도 상향(2번 선택) ➔ 잔여한도 및 상향 가능 금액 안내 후 신청\n※ 하이마트 우리카드 소지 회원만 가능 / 취소 시 한도 복원 불가 / 3개월(1회) 우선 소진'
                    )
                  }
                  className="py-2 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  {copiedKey === 'woori-limit-ars' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>💬 안내문 복사</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. [🛠️ AS센터] 전용 모달 및 데이터 리익스포트 (모듈 분리 호환 유지)
// ============================================================================
export { AsCenterModal } from './AsCenterModal';
export type { AsCenterModalProps } from './AsCenterModal';
export {
  MAJOR_AS_CENTERS,
  PLUX_AS_GROUPS,
  PLUX_CATEGORY_BUTTON_LABELS,
} from './asCenterData';
export type {
  MajorAsCenterItem,
  PluxCategoryGroup,
  PluxPartnerEntry,
} from './asCenterData';
