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
    borderClass: string;
    openBtnClass: string;
    url: string;
    kakaoText: string;
  }) => (
    <div
      key={card.id}
      className={`rounded-2xl bg-white border-2 ${card.borderClass} p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 transition`}
    >
      <h3 className="text-sm sm:text-base font-black text-slate-900">
        {card.title}
      </h3>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => copyText(`${card.id}-url`, card.url)}
          className="py-2 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
        >
          {copiedKey === `${card.id}-url` ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>📋 링크 복사</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => copyText(`${card.id}-msg`, card.kakaoText)}
          className="py-2 px-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
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
          className={`py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer ${card.openBtnClass}`}
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
      title: '롯데카드 발급',
      borderClass: 'border-rose-200 hover:border-rose-300',
      openBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      url: lotteCardUrl,
      kakaoText: `[롯데하이마트] 💳 롯데 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 롯데 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${lotteCardUrl}`,
    },
    {
      id: 'lotte-hiplan',
      title: '플랜약정',
      borderClass: 'border-rose-200 hover:border-rose-300',
      openBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      url: lotteHiPlanUrl,
      kakaoText: `[롯데하이마트] 📋 롯데하이플랜 약정 신청 안내\n\n아래 전용 링크에서 롯데하이플랜 약정 신청을 진행해 주세요.\n▶ 약정신청 바로가기:\n${lotteHiPlanUrl}`,
    },
    {
      id: 'lotte-lpoint',
      title: '롯데포인트 발급',
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
      title: '삼성카드 발급',
      borderClass: 'border-blue-200 hover:border-blue-300',
      openBtnClass: 'bg-blue-600 hover:bg-blue-500 text-white',
      url: samsungUrl,
      kakaoText: `[롯데하이마트] 💳 삼성 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 삼성 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${samsungUrl}`,
    },
    {
      id: 'shinhan',
      title: '신한카드 발급',
      borderClass: 'border-indigo-200 hover:border-indigo-300',
      openBtnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      url: shinhanUrl,
      kakaoText: `[롯데하이마트] 💳 신한 제휴카드 간편 발급 안내\n\n아래 전용 링크를 통해 신한 제휴카드를 간편하게 신청하실 수 있습니다.\n▶ 발급 바로가기:\n${shinhanUrl}`,
    },
  ];

  // 3번째 줄: 우리카드 단독 1종
  const row3WooriCard = {
    id: 'woori',
    title: '우리카드 발급',
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
        className="w-full max-w-4xl max-h-[94dvh] rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
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
// 2. [🛠️ AS센터] 전용 모달 (AsCenterModal)
// ============================================================================
interface AsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MajorAsCenterItem {
  id: string;
  brand: string;
  phones: { label?: string; number: string }[];
  keywords: string;
}

const MAJOR_AS_CENTERS: MajorAsCenterItem[] = [
  {
    id: 'samsung',
    brand: '삼성전자 서비스',
    phones: [{ number: '1588-3366' }],
    keywords: '삼성전자 갤럭시 비스포크 냉장고 세탁기 에어컨 TV 노트북 청소기',
  },
  {
    id: 'lg',
    brand: 'LG전자 서비스',
    phones: [{ number: '1544-7777' }],
    keywords: 'LG전자 엘지 오브제 디오스 트롬 휘센 올레드 그램',
  },
  {
    id: 'cuckoo',
    brand: '쿠쿠전자 / 쿠쿠홈시스(정수기)',
    phones: [
      { label: '밥솥/가전', number: '1588-8899' },
      { label: '정수기/홈시스', number: '1577-0010' },
    ],
    keywords: '쿠쿠전자 쿠쿠홈시스 밥솥 정수기 공기청정기 비데 인덕션',
  },
  {
    id: 'cuchen',
    brand: '쿠첸',
    phones: [{ number: '1577-2797' }],
    keywords: '쿠첸 전기밥솥 인덕션 주방가전',
  },
  {
    id: 'winia',
    brand: '위니아에이드 (딤채/대우/클라쎄)',
    phones: [
      { label: '딤채/김치냉장고', number: '1588-9588' },
      { label: '일반가전', number: '1588-1588' },
    ],
    keywords: '위니아에이드 딤채 대우 클라쎄 김치냉장고 세탁기 냉장고 에어컨',
  },
  {
    id: 'carrier',
    brand: '오텍캐리어 (에어컨/냉장고)',
    phones: [{ number: '1588-8866' }],
    keywords: '오텍캐리어 캐리어 에어컨 냉난방기 냉장고 와인셀러 제습기',
  },
  {
    id: 'skmagic',
    brand: 'SK매직',
    phones: [{ number: '1600-1661' }],
    keywords: 'SK매직 에스케이매직 정수기 식기세척기 인덕션 가스레인지 전자레인지 비데',
  },
  {
    id: 'shinil',
    brand: '신일전자',
    phones: [{ number: '1577-6667' }],
    keywords: '신일전자 선풍기 서큘레이터 히터 난로 이동식에어컨 제습기 계절가전',
  },
  {
    id: 'dyson',
    brand: '다이슨 (Dyson)',
    phones: [{ number: '1588-4253' }],
    keywords: '다이슨 무선청소기 에어랩 드라이기 공기청정기',
  },
  {
    id: 'massage',
    brand: '안마의자 (바디프랜드 / 코지마 / 세라젬 / 제스파)',
    phones: [
      { label: '바디프랜드', number: '02-3448-8980' },
      { label: '코지마', number: '1588-8543' },
      { label: '세라젬', number: '1577-5570' },
      { label: '제스파', number: '02-579-2933' },
    ],
    keywords: '안마의자 마사지기 바디프랜드 코지마 세라젬 제스파',
  },
];

interface PluxPartnerEntry {
  partnerName: string;
  phones: { label?: string; number: string }[];
  modelsDesc: string;
}

interface PluxCategoryGroup {
  category: string;
  entries: PluxPartnerEntry[];
}

const PLUX_AS_GROUPS: PluxCategoryGroup[] = [
  {
    category: '냉장고 / 냉동고 / 김치냉장고',
    entries: [
      {
        partnerName: '[냉장·냉동고] SK네트웍스 (위탁사)',
        phones: [
          { label: '대표', number: '1588-9030' },
          { label: '직통', number: '02-6923-3863' },
        ],
        modelsDesc:
          'PLX-RF420SL, PLX-SBS604BK, PLX-RF245SL/BG, PLX-RF330BG/SL, PLX-RF630SL, PLX-RF528BG, PLX-RF252BG, PLX-FRF470BG, PLX-RF85DWH, PLX-FRF566WB2, PLX-FF160SL, PLX-FF380SL2, PLX-FF272SL2 등 대다수 플럭스 냉장고/냉동고',
      },
      {
        partnerName: '[냉장·냉동고] 씨알케이',
        phones: [{ number: '1588-7100' }],
        modelsDesc: 'PLX-FF380SL, PLX-FRF566WB 등',
      },
      {
        partnerName: '[냉장·냉동고 / 김치냉장고] 하이얼',
        phones: [{ number: '1588-6645' }],
        modelsDesc:
          'PLX-FF272SL, PLX-FF120WH 틈새냉동고 / PLX-SKR338BG 338L 김치냉장고 등',
      },
      {
        partnerName: '[냉장고] 오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-RF138DWH 등',
      },
      {
        partnerName: '[김치냉장고] 디에이치글로벌',
        phones: [{ number: '1660-0286' }],
        modelsDesc: 'PLX-SKR150BG 150L 초정온 김치냉장고',
      },
      {
        partnerName: '[김치냉장고] 위니아에이드',
        phones: [{ number: '1588-9588' }],
        modelsDesc: '하이메이드 김치냉장고 HDKN / HDKR 시리즈',
      },
    ],
  },
  {
    category: '에어컨 / 냉난방기',
    entries: [
      {
        partnerName: '오텍캐리어',
        phones: [{ number: '1588-8866' }],
        modelsDesc:
          'PLX-HAC23CA, PLX-RAC0625/0627/1025/16CA, PLX-HAC16CA 등 캐리어 제조 벽걸이/스탠드',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-HAC0725CHWH 벽걸이 냉난방기 등',
      },
      {
        partnerName: '위니아에이드',
        phones: [{ number: '1588-9588' }],
        modelsDesc: 'PLX-RAC0825CH 등',
      },
      {
        partnerName: '신일전자',
        phones: [{ number: '1577-6667' }],
        modelsDesc: 'PLX-PAC07SIWH 이동식 에어컨',
      },
    ],
  },
  {
    category: 'TV',
    entries: [
      {
        partnerName: '대우테크 (위탁사)',
        phones: [{ number: '1588-1023' }],
        modelsDesc:
          'PLX-TV40FHBK, PLX-TV50QLBK, PLX-TV55UHBK, PLX-TV65UHBK 등',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-TV65QLBK, PLX-TV75MLBK (Mini-LED) 등',
      },
      {
        partnerName: '오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-TV43UHBK 등',
      },
      {
        partnerName: '미래가디언',
        phones: [{ number: '031-812-3020' }],
        modelsDesc: 'PLX-43UHWH 등',
      },
      {
        partnerName: '루미 / 루컴즈',
        phones: [
          { label: '루미', number: '1811-4493' },
          { label: '루컴즈', number: '1600-5488' },
        ],
        modelsDesc: '루미 / 루컴즈 제조 플럭스·하이메이드 TV',
      },
    ],
  },
  {
    category: '세탁기 / 건조기',
    entries: [
      {
        partnerName: '일코전자',
        phones: [{ number: '1899-1552' }],
        modelsDesc:
          'PLX-WM03STBG (3kg 삶는세탁기), PLX-WM075/16/18/21 일반세탁기, PLX-DRY03PTCBG (3kg 미니건조기)',
      },
      {
        partnerName: '오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-WM10ACGY (10kg 세탁기)',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-WM12ACGY (12kg 세탁기)',
      },
    ],
  },
  {
    category: '실링팬 / 선풍기 / 제습기 / 가습기 / 계절가전',
    entries: [
      {
        partnerName: '닥터매직 (실링팬)',
        phones: [
          { label: '센터', number: '1644-0730' },
          { label: '김찬희 팀장', number: '010-8689-4614' },
        ],
        modelsDesc: '실링팬 (PLX-CF52BDWH, PLX-MCF52IOT, PLX-CF42BDWH)',
      },
      {
        partnerName: '하이마트 당사서비스 / 제이앤티이노베이션 / 국일프라임',
        phones: [
          { label: '당사서비스', number: '1588-9030' },
          { label: '제이앤티/국일', number: '02-2135-5052' },
        ],
        modelsDesc: '선풍기 / 제습기 / 가습기 / 히터 / 전기요 등 계절가전',
      },
    ],
  },
  {
    category: '청소기 / 비데 / 생활가전',
    entries: [
      {
        partnerName: '당사서비스 / JHD / 제이앤티이노베이션 (청소기)',
        phones: [
          { label: '당사서비스', number: '1588-9030' },
          { label: 'JHD', number: '031-8035-5780' },
          { label: '제이앤티', number: '02-2135-5052' },
        ],
        modelsDesc: '청소기 (PLX-GVC250, PLX-CVC23, PLX-VC1600 등)',
      },
      {
        partnerName: 'LS대원 / 애플젠 (비데)',
        phones: [
          { label: 'LS대원', number: '1577-7817' },
          { label: '애플젠', number: '080-080-7166' },
        ],
        modelsDesc: 'LS대원 (PLX-BD01DWWH) / 애플젠 (PLX-BD02AZWH)',
      },
    ],
  },
  {
    category: '주방가전 (정수기 / 가스·전기레인지 / 밥솥 / 전자레인지 / 그릴)',
    entries: [
      {
        partnerName: '쿠쿠홈시스 (퓨어플럭스 정수기)',
        phones: [{ number: '1577-0010' }],
        modelsDesc: '퓨어플럭스 정수기 (PLX-WP100ACKW)',
      },
      {
        partnerName: '하츠 / 경동나비엔 (가스레인지 · 3구 인덕션)',
        phones: [
          { label: '하츠', number: '1644-0806' },
          { label: '경동나비엔', number: '1588-1144' },
        ],
        modelsDesc:
          '하츠 (PLX-GR0224/0325/0226, PLX-EIR0334MTBK) / 경동나비엔 (PLX-GRF0325)',
      },
      {
        partnerName: '쿠쿠 / 쿠첸 / 제이앤티 (IH 전기밥솥)',
        phones: [
          { label: '쿠쿠', number: '1588-8899' },
          { label: '쿠첸', number: '1577-2797' },
          { label: '제이앤티(4인용)', number: '02-2135-5052' },
        ],
        modelsDesc:
          '쿠쿠 (PLX-IRC0625/1025) / 쿠첸 (PLX-IRC10CHIV) / 4인용 (PLX-RC0424BG)',
      },
      {
        partnerName: '하이마트 당사서비스 (소형 주방)',
        phones: [{ number: '1588-9030' }],
        modelsDesc: '전자레인지 / 오븐 / 에어프라이어 / 음식물처리기',
      },
      {
        partnerName: '홀컴퍼니 / 리큅 / 넥스코커머스',
        phones: [
          { label: '홀컴퍼니(식기건조)', number: '031-971-2462' },
          { label: '리큅(식품건조)', number: '1566-6884' },
          { label: '넥스코(두유/다지기)', number: '031-988-1509' },
        ],
        modelsDesc:
          '식기건조기 (PLX-PD5003STBK) / 식품건조기 (PLX-FD05TPWT) / 두유메이커·다지기',
      },
    ],
  },
  {
    category: 'IT / 모니터 / 음향 / 멀티탭 / 모바일충전기',
    entries: [
      {
        partnerName: '주연테크 / 앱코 (모니터)',
        phones: [
          { label: '주연테크', number: '1588-1118' },
          { label: '앱코', number: '1599-2084' },
        ],
        modelsDesc: '주연테크 (PLX-MNT24/27/32) / 앱코 (PLX-MNT27PVWH)',
      },
      {
        partnerName: '액센코리아 / 하나인더스트리 / 제이앤티 (음향)',
        phones: [
          { label: '액센(골전도)', number: '070-4467-6574' },
          { label: '하나(스피커)', number: '1566-6793' },
          { label: '제이앤티(유선)', number: '02-2135-5052' },
        ],
        modelsDesc:
          '골전도 이어폰 (PLX-WEP02SWBK) / 스피커 (PLX-BTS10WRBK) / 유선이어폰 (PLX-EP01CNBK)',
      },
      {
        partnerName: '위드아이엔씨 (멀티탭) / 해브잇올 (고속충전기)',
        phones: [
          { label: '위드아이엔씨', number: '032-675-8669' },
          { label: '해브잇올', number: '070-4610-1134' },
        ],
        modelsDesc:
          '멀티탭 (PLX-MOS / PLX-HCMOS) / 고속충전기 (PLX-CHA18/25)',
      },
    ],
  },
];

const PLUX_CATEGORY_BUTTON_LABELS: Record<string, string> = {
  '냉장고 / 냉동고 / 김치냉장고': '🧊 냉장고 · 냉동고 · 김치냉장고',
  '에어컨 / 냉난방기': '❄️ 에어컨 · 냉난방기',
  'TV': '📺 TV',
  '세탁기 / 건조기': '🫧 세탁기 · 건조기',
  '실링팬 / 선풍기 / 제습기 / 가습기 / 계절가전':
    '🌀 실링팬 · 선풍기 · 제습기 · 계절가전',
  '청소기 / 비데 / 생활가전': '🧹 청소기 · 비데 · 생활가전',
  '주방가전 (정수기 / 가스·전기레인지 / 밥솥 / 전자레인지 / 그릴)':
    '🍳 주방가전 (정수기·레인지·밥솥·오븐)',
  'IT / 모니터 / 음향 / 멀티탭 / 모바일충전기':
    '💻 IT · 모니터 · 음향 · 멀티탭 · 충전기',
};

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
      'tcl 티씨엘 tv 티비 리모컨 셋탑박스 iptv cec 페어링 정진수 1660-1870 010-2230-2277';
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
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[94dvh] rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black tracking-tight truncate">
                🛠️ 가전 A/S 센터 &amp; 플럭스(PLUX) · TCL 통합 안내
              </h2>
              <p className="text-[11px] text-slate-300 font-bold hidden sm:block">
                주요 대기업 가전 · TCL TV · 하이마트 자체브랜드(PLUX/하이메이드) 품목별 A/S 직통 번호
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

        {/* 상단 고정 검색창 */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-5 py-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={asSearchQuery}
              onChange={(e) => setAsSearchQuery(e.target.value)}
              placeholder="품목명, 브랜드, PLX 모델명 검색 (예: 삼성, 냉장고, 실링팬, PLX-RF420, TCL, 바디프랜드...)"
              className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-white border-2 border-emerald-500/70 text-xs sm:text-sm font-black text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-emerald-600"
            />
            {asSearchQuery && (
              <button
                type="button"
                onClick={() => setAsSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-4">
          {/* 상단 대분류 3가지 선택 버튼 (기본 접힘 상태) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-600">
                👇 조회할 A/S 대분류를 선택하세요 (클릭 시 펼쳐짐)
              </span>
              {activeMainSection !== null && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainSection(null);
                    setActivePluxCategory(null);
                  }}
                  className="text-[11px] font-black text-slate-500 hover:text-slate-800 underline cursor-pointer"
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
                className={`p-3.5 rounded-2xl border-2 text-left transition flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${
                  activeMainSection === 'major'
                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-md'
                    : 'bg-white hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-300 text-slate-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    🏢 1. 주요 브랜드 A/S
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 truncate ${
                      activeMainSection === 'major'
                        ? 'text-emerald-100'
                        : 'text-slate-500'
                    }`}
                  >
                    삼성·LG·쿠쿠·위니아·다이슨·안마의자 등
                  </div>
                </div>
                {activeMainSection === 'major' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
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
                className={`p-3.5 rounded-2xl border-2 text-left transition flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${
                  activeMainSection === 'tcl'
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-white hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    📺 2. TCL TV 전용 A/S &amp; 리모컨 설정
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 truncate ${
                      activeMainSection === 'tcl'
                        ? 'text-indigo-100'
                        : 'text-slate-500'
                    }`}
                  >
                    1660-1870 · 정진수 매니저 · IPTV 호환
                  </div>
                </div>
                {activeMainSection === 'tcl' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
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
                className={`p-3.5 rounded-2xl border-2 text-left transition flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${
                  activeMainSection === 'plux'
                    ? 'bg-blue-600 border-blue-700 text-white shadow-md'
                    : 'bg-white hover:bg-blue-50/70 border-slate-200 hover:border-blue-300 text-slate-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    🏷️ 3. 플럭스(PLUX) · 하이메이드 품목별 A/S
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 truncate ${
                      activeMainSection === 'plux'
                        ? 'text-blue-100'
                        : 'text-slate-500'
                    }`}
                  >
                    하이마트 PB 8대 품목 위탁 파트너사
                  </div>
                </div>
                {activeMainSection === 'plux' ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* 아무것도 선택하지 않았고 검색어도 없을 때 안내 배너 */}
          {!isSearching && activeMainSection === null && (
            <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-6 text-center space-y-1.5">
              <div className="text-xs sm:text-sm font-black text-slate-700">
                위 3가지 대분류 버튼 중 하나를 클릭하거나, 상단 검색창에 브랜드/모델명을 입력해 주세요.
              </div>
              <p className="text-[11px] font-bold text-slate-400">
                예: 삼성, LG, TCL, 냉장고, 실링팬, PLX-RF420, 바디프랜드 등 검색 시 즉시 자동 펼쳐짐
              </p>
            </div>
          )}

          {/* 검색 결과가 전혀 없을 때 */}
          {isSearching &&
            filteredMajorCenters.length === 0 &&
            !showTclSection &&
            filteredPluxGroups.length === 0 && (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs sm:text-sm font-bold text-slate-500">
                검색하신 품목 또는 모델명과 일치하는 A/S 센터가 없습니다.
              </div>
            )}

          {/* 1. 주요 브랜드 A/S 센터 */}
          {isMajorVisible && (
            <div
              ref={majorSectionRef}
              className="space-y-2.5 rounded-3xl bg-emerald-50/50 border-2 border-emerald-200 p-3.5 sm:p-4 scroll-mt-2"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  <span>🏢 1. 주요 브랜드 A/S 센터</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  전화걸기 또는 번호 복사 가능
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredMajorCenters.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between space-y-2.5"
                  >
                    <div className="text-xs sm:text-sm font-black text-slate-900">
                      {item.brand}
                    </div>

                    <div className="space-y-1.5">
                      {item.phones.map((ph) => {
                        const copyId = `major-${item.id}-${ph.number}`;
                        return (
                          <div
                            key={ph.number}
                            className="flex items-center justify-between gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200"
                          >
                            <div className="min-w-0">
                              {ph.label && (
                                <span className="text-[10px] font-extrabold text-slate-500 mr-1.5">
                                  [{ph.label}]
                                </span>
                              )}
                              <span className="text-xs sm:text-sm font-black text-emerald-700">
                                {ph.number}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`tel:${ph.number}`}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-black transition cursor-pointer"
                              >
                                {copiedKey === copyId ? '✓ 복사됨' : '📋 복사'}
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
              className="rounded-3xl bg-slate-900 text-white border-2 border-indigo-500/60 p-4 sm:p-5 shadow-md space-y-3.5 scroll-mt-2"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center gap-1">
                      <Tv className="w-3.5 h-3.5" />
                      2. TCL TV 전용 A/S 센터
                    </span>
                    <span className="text-xs font-extrabold text-amber-300">
                      패널 3년 무상보증 / 기타 부품 2년 무상보증
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-white">
                    TCL 고객센터:{' '}
                    <span className="text-amber-400">1660-1870</span>
                    <span className="text-xs font-bold text-slate-400 ml-2">
                      (평일 09:00~18:00 / 점심 12:00~13:00 / 주말·공휴일 휴무)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-300">
                    • 영업담당: 정진수 매니저 (
                    <span className="text-sky-300 font-black">
                      010-2230-2277
                    </span>
                    )
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <a
                    href="tel:1660-1870"
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>📞 센터 전화 (1660-1870)</span>
                  </a>
                  <a
                    href="tel:010-2230-2277"
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-sky-400" />
                    <span>담당자 전화</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'tcl-as-copy',
                        '[TCL TV 고객센터 안내]\n• 전화번호: 1660-1870 (평일 09:00~18:00 / 점심 12:00~13:00)\n• 보증기간: 패널 3년 무상보증 / 기타 부품 2년 무상보증'
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-black transition cursor-pointer"
                  >
                    {copiedKey === 'tcl-as-copy' ? '✓ 복사됨' : '📋 번호 복사'}
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer"
                  >
                    {isTclGuideOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    <span>
                      📺 TCL TV 리모컨 IPTV(셋탑박스) 호환 설정법{' '}
                      {isTclGuideOpen ? '접기' : '펼쳐보기'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      copyText('tcl-remote-guide', tclRemoteGuideText)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition cursor-pointer"
                  >
                    {copiedKey === 'tcl-remote-guide' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-800" />
                        <span>✓ 리모컨 설정법 카톡 복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>💬 리모컨 IPTV 호환 설정법 카톡 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {isTclGuideOpen && (
                  <div
                    ref={tclGuideRef}
                    className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2 text-xs font-bold text-slate-200 leading-relaxed"
                  >
                    <p>
                      <strong className="text-amber-300">① 사전 준비:</strong>{' '}
                      셋탑박스를 TV{' '}
                      <strong className="text-white underline">
                        HDMI 1번 포트(권장)
                      </strong>
                      에 연결
                    </p>
                    <p>
                      <strong className="text-amber-300">
                        ② CEC 활성화:
                      </strong>{' '}
                      리모컨 설정(톱니바퀴) ➔ 모든 설정 ➔ 채널 및 입력 ➔ 입력 ➔ 외부장치제어(CEC) ➔{' '}
                      <strong className="text-emerald-300">
                        [HDMI 제어] 및 [동시에 TV 전원 켜기] 활성화
                      </strong>
                    </p>
                    <p>
                      <strong className="text-amber-300">
                        ③ 스크린리스 활성화:
                      </strong>{' '}
                      설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔{' '}
                      <strong className="text-emerald-300">
                        [스크린리스] 활성화
                      </strong>
                    </p>
                    <p>
                      <strong className="text-amber-300">
                        ④ 전원 켰을 때 IPTV 바로 연결:
                      </strong>{' '}
                      설정 ➔ 모든 설정 ➔ 시스템 ➔ 전원 및 에너지 ➔ 전원이 켜질 때 동작 ➔{' '}
                      <strong className="text-sky-300">
                        &apos;마지막으로 사용한 입력&apos; 선택
                      </strong>
                    </p>
                    <p>
                      <strong className="text-amber-300">
                        ⑤ 리모컨 페어링:
                      </strong>{' '}
                      리모컨{' '}
                      <strong className="text-rose-300">
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
              className="space-y-3.5 rounded-3xl bg-blue-50/40 border-2 border-blue-200 p-3.5 sm:p-4 scroll-mt-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <span>
                    🏷️ 3. 플럭스(PLUX) · 하이메이드 품목별 A/S 접수처
                  </span>
                </h3>
              </div>

              {/* 기본 접수 원칙 배너 */}
              <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 text-xs font-bold text-slate-800">
                  <div className="font-black text-blue-950 text-xs sm:text-sm">
                    📌 플럭스(PLUX) · 하이메이드 기본 A/S 접수 원칙
                  </div>
                  <p>
                    ① <strong className="text-blue-800">하이마트 당사 접수:</strong>{' '}
                    전산{' '}
                    <strong className="underline">
                      &ldquo;HISIS - 서비스접수 및 처리내역&rdquo;
                    </strong>
                    에서 접수 또는 하이마트 대표 CS{' '}
                    <strong className="text-rose-600">1588-9030</strong>
                  </p>
                  <p>
                    ② <strong className="text-blue-800">파트너사 직접 접수:</strong>{' '}
                    아래 8개 품목 버튼을 클릭하면 전용 팝업창에서 위탁 파트너사 직통 번호를 즉시 확인하실 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href="tel:1588-9030"
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer"
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
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-blue-300 text-xs font-black transition cursor-pointer"
                  >
                    {copiedKey === 'himart-cs-main' ? '✓ 복사됨' : '📋 복사'}
                  </button>
                </div>
              </div>

              {/* 검색 중이 아닐 때: 8대 품목 2열/4열 그리드 버튼 (클릭 시 중앙 서브 팝업 오픈) */}
              {!isSearching ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-blue-950">
                      👇 조회할 플럭스(PLUX) · 하이메이드 품목을 터치하세요 (전용 팝업 오픈)
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
                          className={`px-3 py-3 rounded-2xl border-2 text-left transition flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-400 text-slate-900'
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-black leading-snug break-keep">
                            {btnLabel}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
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
                      className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden"
                    >
                      <div className="bg-slate-800 text-white px-4 py-2 text-xs sm:text-sm font-black flex items-center justify-between">
                        <span>
                          {PLUX_CATEGORY_BUTTON_LABELS[group.category] ||
                            `■ ${group.category}`}
                        </span>
                        <span className="text-[11px] font-bold text-slate-300">
                          {group.entries.length}개 위탁 파트너
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {group.entries.map((entry, idx) => (
                          <div
                            key={`${group.category}-${idx}`}
                            className="p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 hover:bg-slate-50/80 transition"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-black text-slate-900">
                                • {entry.partnerName}
                              </div>
                              <div className="text-xs font-bold text-slate-600 leading-relaxed break-words">
                                {entry.modelsDesc}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              {entry.phones.map((ph) => {
                                const copyId = `plux-${group.category}-${entry.partnerName}-${ph.number}`;
                                return (
                                  <div
                                    key={ph.number}
                                    className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200"
                                  >
                                    {ph.label && (
                                      <span className="text-[10px] font-extrabold text-slate-500">
                                        [{ph.label}]
                                      </span>
                                    )}
                                    <span className="text-xs font-black text-blue-700 mr-1">
                                      {ph.number}
                                    </span>
                                    <a
                                      href={`tel:${ph.number}`}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
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
                                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-black transition cursor-pointer"
                                    >
                                      {copiedKey === copyId
                                        ? '✓ 복사됨'
                                        : '📋 복사'}
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
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={(e) => {
            e.stopPropagation();
            setActivePluxCategory(null);
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[86dvh] rounded-3xl bg-white border-2 border-slate-800 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 서브 팝업 상단 헤더 */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-black tracking-tight truncate">
                  {PLUX_CATEGORY_BUTTON_LABELS[selectedPluxGroupObj.category] ||
                    selectedPluxGroupObj.category}{' '}
                  위탁 파트너사 ({selectedPluxGroupObj.entries.length}곳)
                </h3>
                <p className="text-[11px] text-slate-300 font-bold">
                  바깥 배경이나 닫기(✕) 또는 휴대폰 뒤로가기를 누르면 품목 선택으로 돌아갑니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePluxCategory(null)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-black transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                <span>✕ 닫기</span>
              </button>
            </div>

            {/* 서브 팝업 본문 파트너사 리스트 */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 bg-slate-50 p-3 sm:p-4 space-y-2.5">
              {selectedPluxGroupObj.entries.map((entry, idx) => (
                <div
                  key={`${selectedPluxGroupObj.category}-modal-${idx}`}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs sm:text-base font-black text-slate-900">
                      • {entry.partnerName}
                    </div>
                    <div className="text-xs font-bold text-slate-600 leading-relaxed break-words">
                      {entry.modelsDesc}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {entry.phones.map((ph) => {
                      const copyId = `plux-modal-${selectedPluxGroupObj.category}-${entry.partnerName}-${ph.number}`;
                      return (
                        <div
                          key={ph.number}
                          className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300"
                        >
                          {ph.label && (
                            <span className="text-[11px] font-extrabold text-slate-600">
                              [{ph.label}]
                            </span>
                          )}
                          <span className="text-xs sm:text-sm font-black text-blue-700 mr-1">
                            {ph.number}
                          </span>
                          <a
                            href={`tel:${ph.number}`}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>📞 전화</span>
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                copyId,
                                `[플럭스/하이메이드 ${selectedPluxGroupObj.category} - ${entry.partnerName}] A/S 센터: ${ph.number}\n대상 모델: ${entry.modelsDesc}`
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-black transition cursor-pointer"
                          >
                            {copiedKey === copyId ? '✓ 복사됨' : '📋 복사'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
