import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Laptop,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tv,
  Wrench,
} from 'lucide-react';

interface AllCareGuideViewProps {
  onBackToHome: () => void;
}

const REGISTRATION_URL = 'https://hiwarranty.co.kr';
const CUSTOMER_CENTER_PHONE = '1588-2355';

const REGISTRATION_STEPS = [
  {
    step: 'STEP 1',
    title: 'https://hiwarranty.co.kr 접속 및 로그인',
    desc: '스마트폰 또는 PC에서 하이워런티 공식 사이트에 접속한 뒤 본인 인증 로그인을 진행합니다.',
  },
  {
    step: 'STEP 2',
    title: '메인 메뉴에서 [가전수리올케어 제품등록] 클릭',
    desc: '상단 또는 메인 화면의 [가전수리올케어 제품등록] 전용 메뉴를 선택합니다.',
  },
  {
    step: 'STEP 3',
    title: '보유 가전 품목 · 브랜드 · 모델명 · 시리얼번호 및 라벨 사진 등록',
    desc: '보장받을 가전의 품목 선택 후 브랜드, 모델명, 제조번호(S/N) 및 제품 에너지소비효율/제조 라벨 사진을 업로드합니다.',
  },
  {
    step: 'STEP 4',
    title: '사전 등록 완료! (가입 60일 이후 고장 발생 시 언제든 보상 신청)',
    desc: '사전 등록이 완료된 가전은 가입일로부터 60일 경과 후 고장 시 연간 100만원 한도 내에서 횟수 제한 없이 수리비를 보상받으실 수 있습니다.',
  },
];

const CLAIM_STEPS = [
  {
    no: '①',
    title: '사전 제품등록 완료 확인',
    desc: '보장 개시 전 hiwarranty.co.kr에 보유 가전이 정상 등록되어 있는지 확인합니다.',
  },
  {
    no: '②',
    title: '공식 서비스센터 유상 수리 진행',
    desc: '고장 발생 시 제조사 공식 서비스센터 또는 하이마트를 통해 정식 유상 수리를 진행합니다.',
  },
  {
    no: '③',
    title: '수리 명세서 및 영수증 발급',
    desc: '수리 완료 후 수리 내역서(견적서/명세서)와 결제 영수증을 발급받습니다.',
  },
  {
    no: '④',
    title: '서류 제출 및 수리비 지급',
    desc: '하이워런티(hiwarranty.co.kr) 또는 전용 안심센터(1588-2355)에 서류 제출 후 수리비를 지급받습니다.',
  },
];

export const AllCareGuideView: React.FC<AllCareGuideViewProps> = ({
  onBackToHome,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKakao, setCopiedKakao] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const kakaoGuideMessage = [
    '[롯데하이마트 경기광주점] 🛡️ 가전수리올케어 보유가전 필수 등록 안내',
    '',
    '안녕하세요 고객님! 롯데하이마트 가전수리올케어 서비스를 이용해 주셔서 감사합니다.',
    '원활한 무상 보증 및 수리비 보상을 위해 반드시 아래 전용 사이트에서 [보유가전 사전 제품등록]을 완료해 주세요!',
    '',
    '▶ 보유가전 등록 공식 사이트',
    REGISTRATION_URL,
    '',
    '■ 보유가전 사전 등록 4단계 방법',
    '1) https://hiwarranty.co.kr 접속 및 로그인',
    '2) 메인 메뉴에서 [가전수리올케어 제품등록] 클릭',
    '3) 보유 가전 품목 선택 · 브랜드 · 모델명 · 시리얼번호(제조번호) 및 라벨 사진 등록',
    '4) 사전 등록 완료! (가입 60일 이후 고장 발생 시 언제든 수리비 보상 신청 가능)',
    '',
    '■ 가전수리올케어 핵심 혜택 요약',
    '• 대상 가전: 새 가전 + 기존 사용하던 가전(구매처·브랜드 무관 총 34종 통합 케어)',
    '• 이용 요금: 2년 기준 단일가 50,000원 (월 환산 약 2,080원)',
    '• 보장 기간: 가입일로부터 60일 경과 후부터 2년간 보장 (사전 제품등록 필수)',
    '• 보장 한도: 연간 최대 100만원 한도 내 횟수 제한 없이(무제한) 실제 수리비(부품비+인건비) 지원',
    '• 자기부담금: 수리 1회당 5,000원 (제조일 10년 경과 제품은 회당 50,000원)',
    '',
    '■ 고장 발생 시 보상 신청 절차',
    '① 사전 제품등록 확인 (hiwarranty.co.kr)',
    '② 제조사 공식 서비스센터 또는 하이마트 유상 수리 진행',
    '③ 수리 명세서(견적서) 및 결제 영수증 발급',
    '④ 하이워런티(hiwarranty.co.kr) 또는 안심센터(1588-2355) 서류 제출 및 수리비 지급',
    '',
    '📞 하이워런티 전용 안심센터: 1588-2355 (평일 09:00~18:00 / 점심 12:00~13:00)',
  ].join('\n');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(REGISTRATION_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleCopyKakao = async () => {
    try {
      await navigator.clipboard.writeText(kakaoGuideMessage);
      setCopiedKakao(true);
      setTimeout(() => setCopiedKakao(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(CUSTOMER_CENTER_PHONE);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[calc(100dvh-44px)] w-full bg-slate-100 flex flex-col">
      {/* ==================== 상단 서브 헤더 ==================== */}
      <div className="sticky top-[44px] z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>메인 홈으로</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h1 className="text-sm sm:text-base font-black text-slate-900">
              8. 가전수리올케어 서비스 안내 & 보유가전 등록 센터
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyKakao}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer shrink-0"
        >
          {copiedKakao ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>카톡 안내문 복사 완료!</span>
            </>
          ) : (
            <>
              <MessageSquare className="w-3.5 h-3.5" />
              <span>고객 카톡 안내문 복사</span>
            </>
          )}
        </button>
      </div>

      {/* ==================== 메인 컨텐츠 컨테이너 ==================== */}
      <div className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
        {/* =================================================================== */}
        {/* [4-1. 상단부 (최우선 강조)] : 보유가전 등록 사이트 (https://hiwarranty.co.kr) & 등록 절차 */}
        {/* =================================================================== */}
        <section className="rounded-3xl bg-slate-900 text-white border-2 border-sky-500/60 shadow-2xl overflow-hidden p-5 sm:p-7 space-y-6">
          {/* 상단 경고/필수 배지 & 타이틀 & 공식 URL */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>⚠️ 필수 절차 · 사전 제품등록 완료 시에만 보증/보상 신청 가능!</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                롯데하이마트 가전수리올케어 보유가전 등록 센터
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-300">
                가입 후 보유하고 계신 가전을 아래 공식 사이트에 미리 등록해 주셔야 고장 발생 시 수리비 보상이 진행됩니다.
              </p>
            </div>

            {/* 공식 URL 대형 표시 박스 */}
            <div className="bg-slate-800/90 border-2 border-sky-400/50 rounded-2xl px-5 py-3.5 text-left lg:text-right shrink-0">
              <div className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider">
                OFFICIAL REGISTRATION SITE
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight select-all mt-0.5">
                {REGISTRATION_URL}
              </div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                롯데하이마트 하이워런티 공식 등록 포털
              </div>
            </div>
          </div>

          {/* 대형 액션 버튼 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 버튼 1: 보유가전 등록 사이트 바로 열기 */}
            <a
              href={REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="py-4 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm sm:text-base shadow-lg transition flex items-center justify-center gap-2 text-center cursor-pointer"
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              <span>🔗 보유가전 등록 사이트 바로 열기 (hiwarranty.co.kr)</span>
            </a>

            {/* 버튼 2: 등록 사이트 주소(URL) 복사 */}
            <button
              type="button"
              onClick={handleCopyUrl}
              className={`py-4 px-4 rounded-2xl font-black text-sm sm:text-base border-2 transition flex items-center justify-center gap-2 cursor-pointer ${
                copiedUrl
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-white'
              }`}
            >
              {copiedUrl ? (
                <>
                  <Check className="w-5 h-5 shrink-0" />
                  <span>✅ https://hiwarranty.co.kr 복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 shrink-0 text-sky-400" />
                  <span>📋 등록 사이트 주소(URL) 복사</span>
                </>
              )}
            </button>

            {/* 버튼 3: 고객 전달용 카톡 문구 전체 복사 */}
            <button
              type="button"
              onClick={handleCopyKakao}
              className={`py-4 px-4 rounded-2xl font-black text-sm sm:text-base transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                copiedKakao
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {copiedKakao ? (
                <>
                  <Check className="w-5 h-5 shrink-0" />
                  <span>✅ 고객 전달용 카톡 문구 복사 완료!</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 shrink-0" />
                  <span>💬 고객 전달용 [제품등록 안내 + 올케어 요약] 카톡 문구 전체 복사</span>
                </>
              )}
            </button>
          </div>

          {/* 보유가전 등록 4단계 가이드 카드 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-sky-300 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4" />
                보유가전 사전 등록 4단계 가이드 (고객 안내용)
              </span>
              <span className="text-xs font-bold text-slate-400">
                스마트폰 사진 촬영으로 간편 등록
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {REGISTRATION_STEPS.map((st, idx) => (
                <div
                  key={st.step}
                  className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-black">
                        {st.step}
                      </span>
                      <span className="text-xs font-black text-slate-500">
                        0{idx + 1}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white leading-snug">
                      {st.title}
                    </h3>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    {st.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* [4-2. 하단부] : 롯데하이마트 '가전수리올케어' 서비스 한눈에 보기 (공식 팩트 요약) */}
        {/* =================================================================== */}
        <section className="space-y-5">
          {/* 1) 💡 가전수리올케어란? (핵심 특장점) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  💡 롯데하이마트 ‘가전수리올케어’란? (핵심 특장점)
                </h2>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2">
              <p className="text-sm sm:text-base font-black text-slate-900 leading-relaxed">
                새 가전뿐만 아니라{' '}
                <span className="text-sky-700 underline underline-offset-4">
                  기존에 집에서 쓰던 가전(중고 가전 포함)
                </span>
                까지,{' '}
                <span className="text-rose-600">구매처·브랜드에 상관없이</span> 단 한 번의 가입으로 통합 보장하는 롯데하이마트 대표 안심케어 서비스!
              </p>
              <p className="text-xs font-bold text-slate-600">
                *(참고: 하이마트 PB &apos;PLUX&apos; 일부 대형가전 및 하이마트 주요 대형가전 구독 고객은 자동 연동 혜택 적용)*
              </p>
            </div>
          </div>

          {/* 2) 💰 이용 요금 & 보장 한도 (4칸 핵심 요약 카드) */}
          <div className="space-y-2.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 px-1 flex items-center gap-2">
              <span>💰 이용 요금 & 보장 한도 (4대 핵심 조건)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-2xl border-2 border-sky-200 p-4 shadow-xs space-y-1.5">
                <div className="text-xs font-extrabold text-sky-700">
                  1. 이용 요금
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  2년 단일가 50,000원
                </div>
                <div className="text-xs font-bold text-slate-500">
                  월 환산 약 2,080원 수준의 부담 없는 요금
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 shadow-xs space-y-1.5">
                <div className="text-xs font-extrabold text-indigo-700">
                  2. 보장 기간 및 개시
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  60일 경과 후 2년간
                </div>
                <div className="text-xs font-bold text-slate-500">
                  가입일로부터 60일 경과 후부터 2년간 보장 (사전 제품등록 필수)
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-rose-200 p-4 shadow-xs space-y-1.5">
                <div className="text-xs font-extrabold text-rose-700">
                  3. 수리비 지원 한도
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-600">
                  연 최대 100만원 (무제한)
                </div>
                <div className="text-xs font-bold text-slate-500">
                  연간 최대 100만원 한도 내 횟수 제한 없이 실제 수리비(부품비+인건비) 지원!
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 shadow-xs space-y-1.5">
                <div className="text-xs font-extrabold text-amber-800">
                  4. 수리 시 자기부담금
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  수리 1회당 5,000원
                </div>
                <div className="text-xs font-bold text-slate-500">
                  단, 제조일로부터 10년이 지난 제품은 회당 50,000원 적용
                </div>
              </div>
            </div>
          </div>

          {/* 3) 📺 보장 대상 품목 (총 34종 가전 통합 케어) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Tv className="w-5 h-5 text-sky-600" />
                <span>📺 보장 대상 품목 (총 34종 가전 통합 케어)</span>
              </h3>
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-black">
                구매처 · 브랜드 무관 등록 가능
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 대형가전 (8종) */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-blue-700 flex items-center gap-1.5">
                    <Tv className="w-4 h-4" />
                    대형가전 (8종)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black">
                    8종
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  냉장고, 김치냉장고, 에어컨, TV, 세탁기, 의류건조기, 의류관리기 등 주요 대형가전
                </p>
              </div>

              {/* 생활·주방가전 (21종) */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-emerald-700 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" />
                    생활·주방가전 (21종)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black">
                    21종
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  청소기(로봇/무선), 공기청정기, 안마의자, 식기세척기, 전기레인지, 정수기, 제습기 등 21종
                </p>
              </div>

              {/* IT 기기 (5종) */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-purple-700 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4" />
                    IT 기기 (5종)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-black">
                    5종
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  노트북, 데스크탑PC, 태블릿PC, 모니터 등 5종
                </p>
              </div>
            </div>
          </div>

          {/* 4) 🛠️ 고장 발생 시 보상 신청 절차 (4단계) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              <span>🛠️ 고장 발생 시 보상 신청 절차 (4단계)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CLAIM_STEPS.map((cs) => (
                <div
                  key={cs.no}
                  className="rounded-2xl bg-indigo-50/50 border border-indigo-200 p-4 space-y-1.5"
                >
                  <div className="text-sm font-black text-indigo-700">
                    {cs.no} {cs.title}
                  </div>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    {cs.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 5) ⚠️ 가입 및 보상 제외 대상 (클레임 예방 필수 고지 박스) */}
          <div className="bg-rose-50/80 rounded-3xl border-2 border-rose-300 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <h3 className="text-base sm:text-lg font-black text-rose-900">
                ⚠️ 가입 및 보상 제외 대상 (클레임 예방 필수 고지사항)
              </h3>
            </div>

            <ul className="space-y-2 text-xs sm:text-sm font-bold text-slate-800">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-rose-700 underline underline-offset-2">
                    보증 개시 전(가입 후 60일 이내)
                  </strong>{' '}
                  발생한 고장 및{' '}
                  <strong className="text-rose-700 underline underline-offset-2">
                    사전 제품 미등록
                  </strong>{' '}
                  가전은 보상 불가 (반드시 가입 즉시{' '}
                  <strong className="text-slate-900">https://hiwarranty.co.kr</strong>
                  에서 제품을 먼저 등록해 주세요!)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  도난·분실, 고객 과실에 의한 물리적 파손, 임의 수리·개조로 인한 고장 제외
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  필터·배터리 등 단순 소모품 교체 비용, 비공식 사설 수리점 수리 내역, 해외 직구 제품 제외
                </span>
              </li>
            </ul>
          </div>

          {/* 6) 📞 전용 고객센터 안내 바 */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="text-xs font-extrabold text-amber-300">
                📞 전용 고객센터 안내
              </div>
              <div className="text-lg sm:text-xl font-black text-white">
                롯데하이마트 하이워런티 안심센터:{' '}
                <span className="text-amber-400">{CUSTOMER_CENTER_PHONE}</span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                운영시간: 평일 09:00 ~ 18:00 (점심시간 12:00 ~ 13:00 / 주말·공휴일 휴무)
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <a
                href={`tel:${CUSTOMER_CENTER_PHONE}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>안심센터 전화걸기</span>
              </a>

              <button
                type="button"
                onClick={handleCopyPhone}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs sm:text-sm font-black transition cursor-pointer"
              >
                {copiedPhone ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>번호 복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-300" />
                    <span>번호 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
