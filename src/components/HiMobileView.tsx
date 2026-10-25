import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Plane,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface HiMobileViewProps {
  onBackToHome: () => void;
}

type PlanContractFilter = 'all' | 'no-contract' | 'contract-24';

interface HiMobilePlanItem {
  id: string;
  title: string;
  isLaunchEvent?: boolean;
  isLifetimeBadge?: boolean;
  contractType: 'no-contract' | 'contract-24';
  contractLabel: string;
  dataMain: string;
  dataSub?: string;
  networkSpeed: 'LTE' | '5G';
  callLimit: string;
  smsLimit: string;
  pricePrefix: string;
  monthlyPrice: string;
  afterPromoNote?: string;
  contractNote?: string;
  normalPrice: string;
  roamingBenefit: string;
}

const HIMOBILE_OPEN_URL = 'https://himart.pindirectshop.com/guide';

const HIMOBILE_PLANS: HiMobilePlanItem[] = [
  {
    id: 'lte-100gb-plus',
    title: '하이모바일 LTE 100GB+',
    isLaunchEvent: true,
    contractType: 'no-contract',
    contractLabel: '✅ 무약정 (위약금 없음)',
    dataMain: '100GB + 5Mbps',
    dataSub: '소진 후 최대 5Mbps 무제한',
    networkSpeed: 'LTE',
    callLimit: '무제한',
    smsLimit: '무제한',
    pricePrefix: '(7개월) 프로모션 할인가',
    monthlyPrice: '월 9,900원',
    afterPromoNote: '7개월 후 평생할인가 월 42,900원',
    normalPrice: '정상가 월 42,900원',
    roamingBenefit:
      '✈️ [최초 개통 1회 한정] 데이터 로밍 1.5GB 무료 쿠폰 지급 (하루 500MB/일)',
  },
  {
    id: '5g-30gb-plus',
    title: '하이모바일 5G 30GB+',
    isLaunchEvent: true,
    contractType: 'contract-24',
    contractLabel: '🔒 2년(24개월) 약정',
    dataMain: '30GB + 1Mbps',
    dataSub: '소진 후 최대 1Mbps 무제한',
    networkSpeed: '5G',
    callLimit: '무제한',
    smsLimit: '무제한',
    pricePrefix: '(12개월) 프로모션 할인가',
    monthlyPrice: '월 7,900원',
    afterPromoNote: '12개월 후 평생할인가 월 25,900원',
    contractNote: '약정 24개월',
    normalPrice: '정상가 월 55,000원',
    roamingBenefit:
      '✈️ [최초 개통 1회 한정] 데이터 로밍 1.5GB 무료 쿠폰 지급 (하루 500MB/일)',
  },
  {
    id: '5g-5gb',
    title: '하이모바일 5G 5GB',
    isLifetimeBadge: true,
    contractType: 'no-contract',
    contractLabel: '✅ 무약정 (위약금 없음)',
    dataMain: '5GB',
    networkSpeed: '5G',
    callLimit: '100분',
    smsLimit: '100건',
    pricePrefix: '평생 할인가',
    monthlyPrice: '월 4,900원',
    normalPrice: '정상가 월 16,500원',
    roamingBenefit:
      '✈️ [최초 개통 1회 한정] 데이터 로밍 1.5GB 무료 쿠폰 지급 (하루 500MB/일)',
  },
  {
    id: '5g-50gb-plus',
    title: '하이모바일 5G 50GB+',
    contractType: 'contract-24',
    contractLabel: '🔒 2년(24개월) 약정',
    dataMain: '50GB + 1Mbps',
    dataSub: '소진 후 최대 1Mbps 무제한',
    networkSpeed: '5G',
    callLimit: '무제한',
    smsLimit: '무제한',
    pricePrefix: '(12개월) 할인가',
    monthlyPrice: '월 18,900원',
    afterPromoNote: '12개월 후 평생할인가 월 33,900원',
    contractNote: '약정 24개월',
    normalPrice: '정상가 월 59,400원',
    roamingBenefit:
      '✈️ [최초 개통 1회 한정] 데이터 로밍 1.5GB 무료 쿠폰 지급 (하루 500MB/일)',
  },
  {
    id: '5g-100gb',
    title: '하이모바일 5G 100GB',
    isLifetimeBadge: true,
    contractType: 'no-contract',
    contractLabel: '✅ 무약정 (위약금 없음)',
    dataMain: '100GB',
    networkSpeed: '5G',
    callLimit: '무제한',
    smsLimit: '무제한',
    pricePrefix: '평생 할인가',
    monthlyPrice: '월 37,900원',
    normalPrice: '정상가 월 63,800원',
    roamingBenefit:
      '✈️ [최초 개통 1회 한정] 데이터 로밍 1.5GB 무료 쿠폰 지급 (하루 500MB/일)',
  },
];

export const HiMobileView: React.FC<HiMobileViewProps> = ({ onBackToHome }) => {
  const [filter, setFilter] = useState<PlanContractFilter>('all');
  const [copiedToast, setCopiedToast] = useState(false);

  const filteredPlans = HIMOBILE_PLANS.filter((plan) => {
    if (filter === 'no-contract') return plan.contractType === 'no-contract';
    if (filter === 'contract-24') return plan.contractType === 'contract-24';
    return true;
  });

  const handleOpenGuideSite = () => {
    window.open(HIMOBILE_OPEN_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(HIMOBILE_OPEN_URL);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = HIMOBILE_OPEN_URL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-100 pb-12">
      {/* 토스트 알림 */}
      {copiedToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs sm:text-sm font-black shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>개통 사이트 주소가 클립보드에 복사되었습니다!</span>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
        {/* ==================== 상단 헤더 & 즉시 개통 배너 ==================== */}
        <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 shadow-xl border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold border border-white/15 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← 메인 메뉴로</span>
                </button>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-black tracking-tight">
                  롯데하이마트 경기광주점 × KT망 알뜰폰
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight flex items-center gap-2">
                <span>📱 하이모바일 핵심 요금제 안내 & 즉시 개통</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                KT망 고품질 5G·LTE 통화품질 그대로! 약정 부담 없는 무약정 요금제부터 초특가 프로모션까지 한눈에 비교하고 바로 개통하세요.
              </p>
            </div>

            {/* 우측 핵심 액션바 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenGuideSite}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm sm:text-base shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>🚀 하이모바일 즉시 개통 사이트 열기</span>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-extrabold text-xs sm:text-sm border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Copy className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>🔗 개통 주소 복사</span>
              </button>
            </div>
          </div>
        </section>

        {/* ==================== 상단 핵심 정보 배지 바 (유심 안내 & 최초 개통 혜택) ==================== */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 border-2 border-slate-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-black">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-500">
                💳 유심(USIM) 비용 안내
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                NFC 유심 <span className="text-blue-600">8,800원</span> / 일반 유심{' '}
                <span className="text-blue-600">6,600원</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 border-2 border-rose-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-black">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-rose-600">
                ✈️ 최초 개통 1회 한정 혜택
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 leading-snug">
                첫 개통 시 데이터 로밍 1.5GB 무료 쿠폰 1회 지급 (하루 500MB/일)
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 border-2 border-emerald-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-black">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-emerald-700">
                📡 통신망
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                KT망 고품질 5G / LTE 그대로 사용
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 필터 탭 ==================== */}
        <section className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              전체 요금제 (5종)
            </button>
            <button
              type="button"
              onClick={() => setFilter('no-contract')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                filter === 'no-contract'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              ✅ 무약정 추천 (3종)
            </button>
            <button
              type="button"
              onClick={() => setFilter('contract-24')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                filter === 'contract-24'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🔒 24개월 약정 특가 (2종)
            </button>
          </div>

          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>카드 클릭 또는 하단 버튼 터치 시 즉시 개통 안내 페이지로 연결됩니다</span>
          </div>
        </section>

        {/* ==================== 5종 요금제 카드 그리드 ==================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredPlans.map((plan) => {
            const isNoContract = plan.contractType === 'no-contract';
            return (
              <div
                key={plan.id}
                className={`rounded-3xl bg-white border-2 transition-all shadow-md hover:shadow-xl flex flex-col justify-between overflow-hidden ${
                  isNoContract
                    ? 'border-emerald-300 hover:border-emerald-500'
                    : 'border-indigo-200 hover:border-indigo-500'
                }`}
              >
                {/* 상단 영역 */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* 배지 줄 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {plan.isLaunchEvent && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black tracking-tight inline-flex items-center gap-1 shadow-xs">
                        <Sparkles className="w-3 h-3" />
                        런칭 이벤트
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-black">
                      KT 망
                    </span>
                    {plan.isLifetimeBadge && (
                      <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black">
                        평생
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                        isNoContract
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                      }`}
                    >
                      {plan.contractLabel}
                    </span>
                  </div>

                  {/* 요금제 타이틀 & 데이터 */}
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-700">
                      {plan.title}
                    </h2>
                    <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                        {plan.dataMain}
                      </span>
                    </div>
                    {plan.dataSub && (
                      <p className="text-xs font-bold text-blue-600 mt-1">
                        ({plan.dataSub})
                      </p>
                    )}
                  </div>

                  {/* 통신 / 통화 / 문자 스펙 바 */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-100 border border-slate-200 text-center">
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">통신망</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        ⚡ {plan.networkSpeed}
                      </div>
                    </div>
                    <div className="border-x border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500">음성통화</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        📞 {plan.callLimit}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">문자메시지</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        💬 {plan.smsLimit}
                      </div>
                    </div>
                  </div>

                  {/* 요금 영역 */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-cyan-300">
                        {plan.pricePrefix}
                      </span>
                      <span className="text-xs font-bold text-slate-400 line-through">
                        {plan.normalPrice}
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                      {plan.monthlyPrice}
                    </div>
                    {(plan.afterPromoNote || plan.contractNote) && (
                      <div className="pt-1 border-t border-slate-700/80 text-xs font-bold text-slate-200 flex items-center justify-between gap-2 flex-wrap">
                        {plan.afterPromoNote && <span>· {plan.afterPromoNote}</span>}
                        {plan.contractNote && (
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[11px]">
                            {plan.contractNote}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 하단 로밍 혜택 */}
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-900 leading-relaxed">
                    {plan.roamingBenefit}
                  </div>
                </div>

                {/* 카드 하단 즉시 개통 버튼 */}
                <div className="px-5 pb-5 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenGuideSite}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                      isNoContract
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <span>이 요금제로 즉시 개통하기 ➔</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};
