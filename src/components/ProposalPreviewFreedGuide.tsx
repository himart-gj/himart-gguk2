import React from 'react';
import { Award, Gift, HeartHandshake, Info, ShieldCheck } from 'lucide-react';

const LIFE_CARE_SERVICES = [
  {
    title: '크루즈 여행',
    desc: '전문 인솔자 동행 프리미엄 해외 크루즈 패키지',
  },
  {
    title: '골프 투어',
    desc: '국내외 명문 골프장 그린피·숙박 올인원 투어',
  },
  {
    title: '웨딩 서비스',
    desc: '스튜디오·드레스·메이크업 맞춤형 웨딩 패키지',
  },
  {
    title: '결혼정보 (수현)',
    desc: '1:1 전담 매칭 노블레스 결혼정보 프로그램',
  },
  {
    title: '돌잔치 · 성장앨범',
    desc: '프리미엄 스튜디오 촬영 및 돌상 패키지',
  },
  {
    title: '해외 어학연수',
    desc: '미국·캐나다·필리핀 등 주니어 캠프 및 연수',
  },
  {
    title: '하이모 · 세포보관',
    desc: '맞춤 가발케어 및 면역·줄기세포 바이오 보관',
  },
  {
    title: '프리미엄 장례의전',
    desc: '국가공인 장례지도사 및 리무진·수의 풀패키지',
  },
];

const MEMBERSHIP_BENEFITS = [
  {
    title: '한화리조트 무기명 회원가',
    desc: '전국 한화리조트 객실 주중·주말 회원가 우대 예약 (연 10박)',
  },
  {
    title: '설악 워터피아 · 아쿠아빌리지 할인',
    desc: '부대 워터파크·온천·사우나 본인 및 동반 최대 40~50% 우대',
  },
  {
    title: '휘닉스 파크 (평창 · 제주) 우대',
    desc: '콘도·호텔 객실 및 스키·블루캐니언 시즌별 특별 우대가 제공',
  },
  {
    title: '종합 건강검진 우대 서비스',
    desc: '전국 제휴 전문 검진센터 프리미엄 종합검진 최대 60% 우대',
  },
  {
    title: '직영 쉴낙원 장례식장 빈소 할인',
    desc: '전국 웅진프리드라이프 직영 쉴낙원 VIP 빈소 사용료 최대 30% 할인',
  },
  {
    title: 'KTX · 공항 프라이빗 무브 우대',
    desc: '공항·KTX역 전용 쇼퍼 서비스 및 여행·레저 제휴 할인 혜택',
  },
];


export const ProposalPreviewFreedGuide: React.FC<Record<string, any>> = ({
  activeTab,
  guideGeneralSummary,
  guideHiSummary,
  guideSheetRef,
  isGuideTab,
  representativePeriod,
  scale,
}) => {
  return (
    <>
          {/* ===================================================================== */}
          {/* TAB 2 / TAB 3: 프리드라이프 별도 안내서 (#sheet-freed-guide) - 920px × auto */}
          {/* 4단계 상하 순서 (1층 요약 ➔ 2층 풀어쓴 3단계 설명 ➔ 3층 기본혜택 ➔ 4층 유의사항) */}
          {/* ===================================================================== */}
          {isGuideTab && (
            <div
              id="sheet-freed-guide"
              ref={guideSheetRef}
              style={{
                width: '920px',
                minWidth: '920px',
                height: 'auto',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              className="print-sheet shrink-0 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-3 text-slate-900"
            >
              {/* ==================== [1층 - 최상단] 타이틀 헤더 + 4칸 핵심 요약 카드 ==================== */}
              <div className="space-y-3 shrink-0">
                <div className="bg-slate-900 text-white rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-extrabold mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      WOONGJIN PREED LIFE MEMBERSHIP GUIDE
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white">
                      {activeTab === 'guide-sub'
                        ? '웅진프리드라이프 Hi구독 플러스 안내서'
                        : '웅진프리드라이프 하이프리드 안내서'}
                    </h1>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-xs">
                      {activeTab === 'guide-sub'
                        ? `${
                            guideHiSummary.activePlans
                              .map((p) => `${p.plan.name} (${p.count}구좌)`)
                              .join(' + ') || 'Hi구독 플러스 108 (1구좌 기준)'
                          } · 총 ${guideHiSummary.totalAccounts}구좌`
                        : `${
                            guideGeneralSummary.activePlans
                              .map((p) => `${p.name} (${p.count}건)`)
                              .join(' + ') || '하이프리드 150 (1건 기준)'
                          } · 총 ${guideGeneralSummary.totalAccounts}건`}
                    </span>
                  </div>
                </div>

                {/* 바로 아래 4칸 핵심 수치 요약 박스 (grid-cols-4) */}
                {activeTab === 'guide-sub' ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-rose-50/80 border-2 border-rose-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-rose-700">
                        ① 가전 구독 총 지원금
                      </div>
                      <div className="text-2xl font-black text-rose-600 mt-1">
                        {guideHiSummary.totalHiPlusSupport.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        월 -{guideHiSummary.monthlyHiPlusSupport.toLocaleString()}원 ×{' '}
                        {representativePeriod}개월 지원
                      </div>
                    </div>

                    <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-blue-700">
                        ② 월 납입금 (1~90회차)
                      </div>
                      <div className="text-2xl font-black text-blue-700 mt-1">
                        월 {guideHiSummary.totalMonthlyDeposit.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        1회차~90회차 정기 적립
                      </div>
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-slate-700">
                        ③ 무납입 거치 (91~120회차)
                      </div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        30개월간 월 0원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        91~120회차 추가 납입 없음
                      </div>
                    </div>

                    <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-emerald-800">
                        ④ 120회 만기 100% 환급 원금
                      </div>
                      <div className="text-2xl font-black text-emerald-700 mt-1">
                        {guideHiSummary.totalMaturityRefund.toLocaleString()}원
                      </div>
                      <div className="text-[10px] font-extrabold text-emerald-800 mt-1">
                        상조·전환 미이용 시 100% 전액 환급
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-blue-700">
                        ① 가전 구매 총 지원금
                      </div>
                      <div className="text-2xl font-black text-blue-700 mt-1">
                        {guideGeneralSummary.totalSupport.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        제휴카드 35개월 할부 선결제분
                      </div>
                    </div>

                    <div className="bg-rose-50/80 border-2 border-rose-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-rose-700">
                        ② 35개월 할부 매월 상쇄액
                      </div>
                      <div className="text-2xl font-black text-rose-600 mt-1">
                        월 {guideGeneralSummary.monthlyInstallment35.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        할부 이자 포함 매월 100% 상쇄
                      </div>
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-slate-700">
                        ③ 상조 월 납입금 (1~150회차)
                      </div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        월 {guideGeneralSummary.totalMonthlyDeposit.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">
                        1~150회 납입 후 30개월 거치
                      </div>
                    </div>

                    <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3">
                      <div className="text-xs font-extrabold text-emerald-800">
                        ④ 만기 100% 환급 원금
                      </div>
                      <div className="text-2xl font-black text-emerald-700 mt-1">
                        {guideGeneralSummary.totalMaturityRefund.toLocaleString()}원
                      </div>
                      <div className="text-[10px] font-extrabold text-emerald-800 mt-1">
                        상조·전환 미이용 시 100% 전액 환급
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ==================== [2층 - 중단 상부] 선택한 구좌의 지원·납입·거치·환급 방식 풀어쓴 3단계 설명 ==================== */}
              {activeTab === 'guide-sub' ? (
                <div className="bg-blue-50/60 border-2 border-blue-200 rounded-2xl p-3.5 space-y-2 shrink-0">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-blue-600" />
                      고객님이 선택하신 구좌의 지원 · 납입 · 거치 · 만기 환급 진행 방식
                    </span>
                    <span className="text-xs font-extrabold text-blue-700">
                      한눈에 이해하는 3단계 핵심 구조
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-rose-600">
                        ① 가전 구독기간 매월 캐시백 지원
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        가전 구독 기간(
                        <strong className="text-slate-900">
                          {representativePeriod}개월
                        </strong>
                        ) 동안 매월{' '}
                        <strong className="text-rose-600 font-black">
                          -{guideHiSummary.monthlyHiPlusSupport.toLocaleString()}원
                        </strong>
                        씩(총{' '}
                        <strong className="text-rose-600 font-black">
                          {guideHiSummary.totalHiPlusSupport.toLocaleString()}원
                        </strong>
                        ) 구독료를 지원받으십니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-blue-700">
                        ② 90개월 적립 후 30개월(91~120회) 무납입 거치
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        프리드라이프에는 1회차~90회차까지 월{' '}
                        <strong className="text-blue-700 font-black">
                          {guideHiSummary.totalMonthlyDeposit.toLocaleString()}원
                        </strong>
                        씩 납입하시며, 이후 91회차~120회차(30개월) 동안은{' '}
                        <strong className="text-slate-900 font-black">
                          월 0원(추가 납입 없음)
                        </strong>
                        으로 거치됩니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-emerald-300 space-y-1">
                      <div className="text-xs font-black text-emerald-700">
                        ③ 120회 만기 시 납입 원금 100% 전액 환급
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        120회 만기 도래 시(상조·전환 서비스 미이용 시), 그동안 적립하신
                        원금{' '}
                        <strong className="text-emerald-700 font-black">
                          {guideHiSummary.totalMaturityRefund.toLocaleString()}원
                          전액(100%)
                        </strong>
                        을 그대로 돌려받으십니다.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50/60 border-2 border-blue-200 rounded-2xl p-3.5 space-y-2 shrink-0">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-blue-600" />
                      고객님이 선택하신 구좌의 지원 · 할부 상쇄 · 납입 · 만기 환급 진행 방식
                    </span>
                    <span className="text-xs font-extrabold text-blue-700">
                      한눈에 이해하는 3단계 핵심 구조
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-blue-700">
                        ① 가전 결제 시 지원금만큼 35개월 할부 선결제
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        가전 결제 금액 중 지원금{' '}
                        <strong className="text-blue-700 font-black">
                          {guideGeneralSummary.totalSupport.toLocaleString()}원
                        </strong>
                        을 제휴카드 35개월 할부로 결제하여 매장 실결제 부담을 즉시
                        낮춥니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-1">
                      <div className="text-xs font-black text-rose-600">
                        ② 35개월간 할부 원리금(이자 포함) 매월 100% 상쇄
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        할부 이자를 포함한 실제 월 할부 청구액{' '}
                        <strong className="text-rose-600 font-black">
                          월 {guideGeneralSummary.monthlyInstallment35.toLocaleString()}원
                        </strong>
                        을 35개월간 매월 똑같이 지원해 드려 실질 할부 부담이 0원입니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-emerald-300 space-y-1">
                      <div className="text-xs font-black text-emerald-700">
                        ③ 정기 납입 후 만기 시 납입 원금 100% 전액 환급
                      </div>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        1회차~150회차 동안 월{' '}
                        <strong className="text-slate-900 font-black">
                          {guideGeneralSummary.totalMonthlyDeposit.toLocaleString()}원
                        </strong>
                        씩 납입 후 만기 도래 시(상조·전환 서비스 미이용 시) 적립 원금{' '}
                        <strong className="text-emerald-700 font-black">
                          {guideGeneralSummary.totalMaturityRefund.toLocaleString()}원
                          전액(100%)
                        </strong>
                        을 돌려받으십니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== [3층 - 중단 하부] 프리드라이프 기본 혜택 (좌우 2단 카드 grid-cols-2 gap-4) ==================== */}
              <div className="grid grid-cols-2 gap-4 shrink-0">
                {/* 좌측 카드: 8대 라이프케어 전환 서비스 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-blue-600" />✨ 8대
                      라이프케어 전환 서비스
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      상조 대신 원하는 서비스로 전환 가능
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {LIFE_CARE_SERVICES.map((svc) => (
                      <div
                        key={svc.title}
                        className="bg-white rounded-xl p-2.5 border border-slate-200"
                      >
                        <div className="text-xs font-black text-slate-900">
                          • {svc.title}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-snug">
                          {svc.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 우측 카드: 가입 즉시 누리는 회원 전용 멤버십 혜택 6종 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-rose-600" />🎁 가입 즉시 누리는 회원
                      전용 멤버십 혜택 6종
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      계약 유지 기간 내내 상시 우대
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {MEMBERSHIP_BENEFITS.map((bf) => (
                      <div
                        key={bf.title}
                        className="bg-white rounded-xl px-3 py-1.5 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="text-xs font-black text-slate-900">
                            ✓ {bf.title}
                          </span>
                          <p className="text-[10px] font-semibold text-slate-500">
                            {bf.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ==================== [4층 - 최하단] 중도 해지 유의사항 및 만기 시 100% 환급 조건 안내 박스 ==================== */}
              <div className="bg-slate-900 text-white rounded-2xl px-5 py-3.5 text-xs space-y-1 shrink-0">
                <div className="font-black text-amber-400 flex items-center gap-1.5 text-sm mb-0.5">
                  <Info className="w-4 h-4" />
                  [중도 해지 시 유의사항 및 만기 100% 환급 조건 필수 안내]
                </div>
                <div className="text-slate-200 font-semibold leading-relaxed">
                  1. <strong className="text-white">만기 시 100% 환급 조건:</strong>{' '}
                  지정된 만기 회차(구독 플러스 90회 납입+30개월 거치 총 120회 /
                  하이프리드 150회 납입+30개월 거치 총 180회) 만기 도래 후 해약 신청 시
                  납입 원금 전액을 환급해 드립니다.{' '}
                  <strong className="text-amber-300">
                    (단, 상조 또는 전환 서비스 미이용 시 만기 납입 원금 100% 전액 환급)
                  </strong>
                </div>
                <div className="text-slate-300 font-semibold leading-relaxed">
                  2. <strong className="text-rose-300">중도 해지 시 불이익 안내:</strong>{' '}
                  만기 전 상조 계약을 중도 해지하거나 월 부금이 3회 이상 연체될 경우,
                  가전 지원금(캐시백/할부지원) 지급이 즉시 중단·환수되며 잔여 할부금 및
                  구독료는 고객 본인 부담으로 전환됩니다. (상조 해약환급금은 공정거래위원회
                  해약환급금 산정기준 고시에 따름)
                </div>
                <div className="text-slate-300 font-semibold leading-relaxed">
                  3.{' '}
                  <strong className="text-emerald-300">
                    상품 성격 및 소비자 피해보상 지급보증:
                  </strong>{' '}
                  본 상품은 예·적금 등 금융상품이 아닌 웅진프리드라이프의 선불식
                  할부거래(상조·라이프케어) 상품이며, 할부거래에 관한 법률 제27조에 의거해
                  제1금융권(우리·신한·수협은행 등)과 소비자피해보상 지급보증 계약을 체결하여
                  고객 납입금을 안전하게 보증합니다.
                </div>
              </div>
            </div>
          )}
    </>
  );
};
