import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Plane,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { getEffectiveStoreDisplayName } from '../utils/shareQuoteCodec';
import { AppSubViewHeader } from './ui/AppSubViewHeader';
import { SurfaceCard } from './ui/SurfaceCard';

interface HiMobileViewProps {
  onBackToHome: () => void;
  backLabel?: string;
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

export const HiMobileView: React.FC<HiMobileViewProps> = ({ onBackToHome, backLabel }) => {
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
    <div className="min-h-[calc(100dvh-44px)] flex-1 w-full bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 pb-12">
      {/* 토스트 알림 */}
      {copiedToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-[#191F28] dark:bg-slate-800 text-white text-xs sm:text-sm font-extrabold shadow-2xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>개통 사이트 주소가 클립보드에 복사되었습니다!</span>
        </div>
      )}

      <AppSubViewHeader
        title="하이모바일 핵심 요금제 안내 & 즉시 개통"
        subtitle={`${getEffectiveStoreDisplayName()} × KT망 고품질 5G·LTE 알뜰 요금제 비교 및 즉시 개통`}
        badge="KT망 알뜰폰"
        icon={<Smartphone className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
        onBack={onBackToHome}
        backLabel={backLabel || '홈으로'}
        rightSlot={
          <>
            <button
              type="button"
              onClick={handleOpenGuideSite}
              className="h-9 px-3.5 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white font-extrabold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>🚀 즉시 개통 사이트 열기</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="h-9 px-3 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 font-bold text-xs border border-[#D1D6DB] dark:border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
              <span>개통 주소 복사</span>
            </button>
          </>
        }
      />

      <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
        {/* ==================== 상단 핵심 정보 배지 바 (유심 안내 & 최초 개통 혜택) ==================== */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SurfaceCard className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#4E5968] dark:text-slate-400">
                💳 유심 · eSIM 비용 안내
              </div>
              <div className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-50 mt-0.5 tabular-nums">
                NFC 유심 <span className="font-mono text-[#1B64DA] dark:text-blue-400">8,800원</span> · 일반 유심{' '}
                <span className="font-mono text-[#1B64DA] dark:text-blue-400">6,600원</span> · eSIM{' '}
                <span className="font-mono text-[#1B64DA] dark:text-blue-400">3,000원</span>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="brand" className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-rose-500/20 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-rose-300 flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#E60012] dark:text-rose-300">
                ✈️ 최초 개통 1회 한정 혜택
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 mt-0.5 leading-snug">
                첫 개통 시 데이터 로밍 1.5GB 무료 쿠폰 1회 지급 (하루 500MB/일)
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="emerald" className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#059669] dark:text-emerald-300">
                📡 통신망
              </div>
              <div className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-100 mt-0.5">
                KT망 고품질 5G / LTE 그대로 사용
              </div>
            </div>
          </SurfaceCard>
        </section>

        {/* ==================== 필터 탭 ==================== */}
        <section className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center bg-white dark:bg-[#131C2E] p-1.5 rounded-2xl border border-[#E5E8EB] dark:border-slate-800 shadow-2xs flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-2xs'
                  : 'text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
              }`}
            >
              전체 요금제 (5종)
            </button>
            <button
              type="button"
              onClick={() => setFilter('no-contract')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                filter === 'no-contract'
                  ? 'bg-[#059669] text-white shadow-2xs'
                  : 'text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
              }`}
            >
              ✅ 무약정 추천 (3종)
            </button>
            <button
              type="button"
              onClick={() => setFilter('contract-24')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                filter === 'contract-24'
                  ? 'bg-[#1B64DA] text-white shadow-2xs'
                  : 'text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
              }`}
            >
              🔒 24개월 약정 특가 (2종)
            </button>
          </div>

          <div className="text-xs font-bold text-[#4E5968] dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
            <span>하단 버튼 터치 시 즉시 개통 안내 페이지로 연결됩니다</span>
          </div>
        </section>

        {/* ==================== 5종 요금제 카드 그리드 ==================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredPlans.map((plan) => {
            const isNoContract = plan.contractType === 'no-contract';
            return (
              <div
                key={plan.id}
                className={`rounded-[20px] bg-white dark:bg-[#131C2E] border transition-all shadow-[0_2px_10px_rgba(25,31,40,0.03)] hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                  isNoContract
                    ? 'border-emerald-200 dark:border-emerald-500/35 hover:border-[#059669]'
                    : 'border-[#BFDBFE] dark:border-blue-500/35 hover:border-[#1B64DA]'
                }`}
              >
                {/* 상단 영역 */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* 배지 줄 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {plan.isLaunchEvent && (
                      <span className="px-2.5 py-0.5 rounded-md bg-[#E60012] text-white text-[11.5px] font-extrabold tracking-tight inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        런칭 이벤트
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-md bg-[#191F28] dark:bg-slate-800 text-white dark:text-slate-100 text-[11.5px] font-bold">
                      KT 망
                    </span>
                    {plan.isLifetimeBadge && (
                      <span className="px-2.5 py-0.5 rounded-md bg-[#1B64DA] text-white text-[11.5px] font-bold">
                        평생
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11.5px] font-bold border ${
                        isNoContract
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/30'
                      }`}
                    >
                      {plan.contractLabel}
                    </span>
                  </div>

                  {/* 요금제 타이틀 & 데이터 */}
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#4E5968] dark:text-slate-300">
                      {plan.title}
                    </h2>
                    <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[#191F28] dark:text-slate-50 tracking-tight">
                        {plan.dataMain}
                      </span>
                    </div>
                    {plan.dataSub && (
                      <p className="text-xs font-bold text-[#1B64DA] dark:text-blue-400 mt-1">
                        ({plan.dataSub})
                      </p>
                    )}
                  </div>

                  {/* 통신 / 통화 / 문자 스펙 바 */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 text-center">
                    <div>
                      <div className="text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400">통신망</div>
                      <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 mt-0.5">
                        ⚡ {plan.networkSpeed}
                      </div>
                    </div>
                    <div className="border-x border-[#E5E8EB] dark:border-slate-800">
                      <div className="text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400">음성통화</div>
                      <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 mt-0.5">
                        📞 {plan.callLimit}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400">문자메시지</div>
                      <div className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 mt-0.5">
                        💬 {plan.smsLimit}
                      </div>
                    </div>
                  </div>

                  {/* 요금 영역 */}
                  <div className="p-4 rounded-2xl bg-[#FFF1F2]/70 dark:bg-rose-500/12 border border-[#FECDD3] dark:border-rose-500/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-300">
                        {plan.pricePrefix}
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-[#8B95A1] dark:text-slate-400 line-through">
                        {plan.normalPrice}
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[#E60012] dark:text-[#FF3B47] tracking-tight">
                      {plan.monthlyPrice}
                    </div>
                    {(plan.afterPromoNote || plan.contractNote) && (
                      <div className="pt-1.5 border-t border-[#FECDD3]/70 dark:border-rose-500/25 text-xs font-bold text-[#4E5968] dark:text-slate-200 flex items-center justify-between gap-2 flex-wrap tabular-nums">
                        {plan.afterPromoNote && <span>· {plan.afterPromoNote}</span>}
                        {plan.contractNote && (
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 text-[11.5px]">
                            {plan.contractNote}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 하단 로밍 혜택 */}
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 text-xs font-bold text-[#4E5968] dark:text-slate-300 leading-relaxed">
                    {plan.roamingBenefit}
                  </div>
                </div>

                {/* 카드 하단 즉시 개통 버튼 */}
                <div className="px-5 pb-5 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenGuideSite}
                    className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                      isNoContract
                        ? 'bg-[#059669] hover:bg-emerald-700 text-white'
                        : 'bg-[#1B64DA] hover:bg-blue-700 text-white'
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
