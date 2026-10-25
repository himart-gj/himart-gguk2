import React, { useEffect, useRef, useState } from 'react';
import {
  AFFILIATE_CARDS,
  calculateGeneralHiPreedSummary,
  calculateGeneralPurchaseSummary,
  calculateHiPlusSummary,
  getGeneralPlan1And2Summaries,
  ProposalState,
  switchGeneralPlanInState,
} from '../types/proposal';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CreditCard,
  Download,
  FileText,
  Gift,
  HeartHandshake,
  Info,
  Layers,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
} from 'lucide-react';
import { toPng } from 'html-to-image';

interface ProposalPreviewProps {
  state: ProposalState;
  onChange: React.Dispatch<React.SetStateAction<ProposalState>>;
  onBackToInput: () => void;
  activeCustomer?: { id: string; name: string; phone?: string } | null;
  onOpenSaveToCrm?: () => void;
}

const SHEET_WIDTH = 920;

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

export const ProposalPreview: React.FC<ProposalPreviewProps> = ({
  state,
  onChange,
  onBackToInput,
  activeCustomer,
  onOpenSaveToCrm,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const proposalSheetRef = useRef<HTMLDivElement>(null);
  const guideSheetRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [sheetH, setSheetH] = useState(860);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'proposal' | 'guide-general' | 'guide-sub'
  >('proposal');

  const activePlan = state.activeGeneralPlan || 1;
  const { plan1Summary, plan2Summary } = getGeneralPlan1And2Summaries(state);
  const hasBothPlans = plan1Summary.sum > 0 && plan2Summary.sum > 0;

  // ==================== 데이터 계산 ====================
  const generalSummary = calculateGeneralPurchaseSummary(state);
  const generalHiPreedSummary = calculateGeneralHiPreedSummary(
    state.generalHiPreedCounts
  );

  const currentCard = AFFILIATE_CARDS.find(
    (c) => c.id === state.selectedCardId
  );
  const currentCardTier = currentCard?.tiers.find(
    (t) => t.id === state.selectedCardTierId
  );
  const hiSummary = calculateHiPlusSummary(
    state.hiPlusCounts,
    state.subscriptionPeriod
  );

  const totalBaseMonthly = state.items.reduce(
    (sum, item) => sum + (Number(item.monthlyFee) || 0),
    0
  );
  const totalPrincipal = totalBaseMonthly * state.subscriptionPeriod;

  const cardMonthlyDiscount = currentCardTier?.monthlyDiscount || 0;
  const hiPlusMonthlySupport = hiSummary.monthlyHiPlusSupport;

  // 마이너스 금액 허용 (0원 강제 고정 금지)
  const finalMonthlyFee =
    totalBaseMonthly - cardMonthlyDiscount - hiPlusMonthlySupport;
  const finalTotal60Fee = finalMonthlyFee * state.subscriptionPeriod;

  // 안내서 표시용: 프리드 선택이 0건이면 대표 1구좌 기준으로 안내 수치 표시
  const guideGeneralSummary =
    generalHiPreedSummary.totalAccounts > 0
      ? generalHiPreedSummary
      : calculateGeneralHiPreedSummary({
          hf75: 0,
          hf150: 1,
          hf225: 0,
          hf300: 0,
        });

  const guideHiSummary =
    hiSummary.totalAccounts > 0
      ? hiSummary
      : calculateHiPlusSummary(
          { hi72: 0, hi90: 0, hi108: 1 },
          state.subscriptionPeriod
        );

  const isGuideTab =
    activeTab === 'guide-general' || activeTab === 'guide-sub';

  // 2D Auto-Fit 스케일링: 가로폭은 무조건 상수 920 고정! (offsetWidth 측정 절대 금지)
  // 안내서 탭(#sheet-freed-guide)도 고정 1040 대신 실제 렌더링된 전체 높이를 측정하여 하단 문구 잘림 방지
  useEffect(() => {
    const updateScale = () => {
      if (!viewportRef.current) return;
      const activeEl = isGuideTab
        ? guideSheetRef.current
        : proposalSheetRef.current;
      if (!activeEl) return;

      const availW = viewportRef.current.clientWidth;
      const availH = viewportRef.current.clientHeight;
      const sheetW = 920; // 무조건 920 고정
      const nextSheetH = Math.max(
        720,
        activeEl.scrollHeight || activeEl.offsetHeight || 960
      );

      setSheetH(nextSheetH);

      const nextScale = Math.min(
        1,
        (availW - 24) / sheetW,
        (availH - 24) / nextSheetH
      );
      setScale(Math.max(0.25, nextScale));
    };

    updateScale();
    const rafId = requestAnimationFrame(updateScale);

    const observer = new ResizeObserver(updateScale);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (proposalSheetRef.current) observer.observe(proposalSheetRef.current);
    if (guideSheetRef.current) observer.observe(guideSheetRef.current);

    window.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [activeTab, isGuideTab, state]);

  const handleSwitchGeneralPlan = (targetPlan: 1 | 2) => {
    onChange((prev) => switchGeneralPlanInState(prev, targetPlan));
  };

  const handleDownloadPng = async () => {
    const targetNode = isGuideTab
      ? guideSheetRef.current
      : proposalSheetRef.current;
    if (!targetNode || isExporting) return;

    setIsExporting(true);
    try {
      const exportW = SHEET_WIDTH;
      const exportH = Math.max(
        720,
        targetNode.scrollHeight || targetNode.offsetHeight || 960
      );

      const dataUrl = await toPng(targetNode, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: exportW,
        height: exportH,
        style: {
          transform: 'none',
        },
      });
      const link = document.createElement('a');
      const suffix =
        activeTab === 'guide-general'
          ? '하이프리드안내서'
          : activeTab === 'guide-sub'
          ? '구독프리드안내서'
          : '맞춤제안서';
      link.download = `고객_${suffix}_${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('이미지 저장 실패:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 품목 요약 타이틀 생성
  const validGeneralNames = state.generalItems
    .map((it) => it.category.trim())
    .filter(Boolean);
  const generalHeaderTitle =
    validGeneralNames.length === 0
      ? '맞춤 가전 패키지 구매 제안서'
      : validGeneralNames.length === 1
      ? `${validGeneralNames[0]} 맞춤 구매 제안서`
      : `${validGeneralNames[0]} 외 ${validGeneralNames.length - 1}건 맞춤 구매 제안서`;

  const validSubNames = state.items
    .map((it) => it.category.trim())
    .filter(Boolean);
  const subHeaderTitle =
    validSubNames.length === 0
      ? `맞춤 가전 구독 제안서 (${state.subscriptionPeriod}개월 구독)`
      : validSubNames.length === 1
      ? `${validSubNames[0]} 구독 제안서 (${state.subscriptionPeriod}개월 구독)`
      : `${validSubNames[0]} 외 ${validSubNames.length - 1}건 구독 제안서 (${state.subscriptionPeriod}개월 구독)`;

  // 일반구매 1단계 즉시할인 세부 내역 한 줄 표기
  const step1DiscountDetails: string[] = [];
  if (generalSummary.instantDiscount > 0) {
    step1DiscountDetails.push(
      `기본 즉시할인 -${generalSummary.instantDiscount.toLocaleString()}원`
    );
  }
  generalSummary.extraDiscountItems.forEach((it) => {
    step1DiscountDetails.push(
      `${it.description || '추가 즉시할인'} -${(
        Number(it.amount) || 0
      ).toLocaleString()}원`
    );
  });
  if (generalSummary.pointUsed > 0) {
    step1DiscountDetails.push(
      `포인트 즉시사용 -${generalSummary.pointUsed.toLocaleString()}원`
    );
  }

  // 일반구매 2단계 캐시백 세부 내역 한 줄 표기
  const step2CashbackDetails: string[] = [];
  if (generalSummary.tierCashback > 0) {
    step2CashbackDetails.push(
      `금액대별 캐시백 -${generalSummary.tierCashback.toLocaleString()}원`
    );
  }
  if (generalSummary.extraCashback > 0) {
    step2CashbackDetails.push(
      `배송익월 추가 캐시백 -${generalSummary.extraCashback.toLocaleString()}원`
    );
  }

  // 일반구매 2단계 추가 혜택 세부 내역 한 줄 표기
  const step2ExtraDetails: string[] = [];
  generalSummary.extraEtcItems.forEach((it) => {
    step2ExtraDetails.push(
      `${it.description || '기타 추가혜택'} -${(
        Number(it.amount) || 0
      ).toLocaleString()}원`
    );
  });
  if (generalSummary.remainingPoints > 0) {
    step2ExtraDetails.push(
      `잔여 적립포인트 -${generalSummary.remainingPoints.toLocaleString()}P`
    );
  }

  // 구독구매 수식 배지 문구
  const subFormulaParts = ['월 구독료'];
  if (cardMonthlyDiscount > 0) subFormulaParts.push('카드할인');
  if (hiPlusMonthlySupport > 0) subFormulaParts.push('구독프리드');
  const subFormulaText = subFormulaParts.join(' ➖ ');

  // 혼합 모드 통합 총 할인/지원 혜택 합계
  const hybridTotalDiscountAndSupport =
    generalSummary.totalDiscountAndBenefit +
    (cardMonthlyDiscount + hiPlusMonthlySupport) * state.subscriptionPeriod;

  // 혼합 모드 일반구매 최종 혜택가 + 구독구매 총 체감가 합계
  const hybridCombinedNetTotal = generalSummary.rawNet + finalTotal60Fee;

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col bg-slate-200 select-none">
      {/* ==================== 상단 고정 액션바 (52px, 인쇄 시 숨김) ==================== */}
      <header className="no-print h-[52px] shrink-0 w-full bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={onBackToInput}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs border border-slate-700 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            조건 다시 입력하기
          </button>

          {/* 탭 전환 버튼: 모드별 제안서 및 안내서 분리 */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('proposal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                activeTab === 'proposal'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {state.quoteMode === 'hybrid'
                ? '1. 맞춤 혼합 제안서'
                : '1. 맞춤 제안서'}
            </button>

            {state.quoteMode === 'general' && (
              <button
                type="button"
                onClick={() => setActiveTab('guide-general')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                  activeTab === 'guide-general'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                2. 하이프리드 별도 안내서
                {generalHiPreedSummary.totalAccounts > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {generalHiPreedSummary.totalAccounts}건
                  </span>
                )}
              </button>
            )}

            {state.quoteMode === 'subscription' && (
              <button
                type="button"
                onClick={() => setActiveTab('guide-sub')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                  activeTab === 'guide-sub'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                2. 구독프리드 별도 안내서
                {hiSummary.totalAccounts > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {hiSummary.totalAccounts}구좌
                  </span>
                )}
              </button>
            )}

            {state.quoteMode === 'hybrid' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('guide-general')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                    activeTab === 'guide-general'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  2. 일반 하이프리드 안내서
                  {generalHiPreedSummary.totalAccounts > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-900/20 text-[10px]">
                      {generalHiPreedSummary.totalAccounts}건
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('guide-sub')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                    activeTab === 'guide-sub'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  3. 구독프리드 안내서
                  {hiSummary.totalAccounts > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                      {hiSummary.totalAccounts}구좌
                    </span>
                  )}
                </button>
              </>
            )}
          </div>

          {/* 일반구매 [일반 1안] / [일반 2안] 즉시 전환 스위치 (일반 및 혼합 모드에서 표시) */}
          {state.quoteMode !== 'subscription' && (
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchGeneralPlan(1)}
                className={`px-2.5 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                  activePlan === 1
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                일반 1안
                {plan1Summary.sum > 0
                  ? ` (${plan1Summary.rawNet.toLocaleString()}원)`
                  : ''}
              </button>
              <button
                type="button"
                onClick={() => handleSwitchGeneralPlan(2)}
                className={`px-2.5 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                  activePlan === 2
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                일반 2안
                {plan2Summary.sum > 0
                  ? ` (${plan2Summary.rawNet.toLocaleString()}원)`
                  : ''}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenSaveToCrm && (
            <button
              type="button"
              onClick={onOpenSaveToCrm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              💾 CRM 고객 저장
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '저장 중...' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            인쇄 / PDF
          </button>
        </div>
      </header>

      {/* ==================== 중앙 2D Auto-Fit 뷰포트 ==================== */}
      <div
        ref={viewportRef}
        className="print-stage flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-3"
      >
        <div
          style={{
            width: `${Math.round(920 * scale)}px`,
            height: `${Math.round(sheetH * scale)}px`,
          }}
          className="sheet-scale-wrapper relative overflow-hidden"
        >
          {/* ===================================================================== */}
          {/* TAB 1: 고객 맞춤 제안서 (#sheet-proposal) - width: 920px 고정 */}
          {/* ===================================================================== */}
          {activeTab === 'proposal' && (
            <div
              id="sheet-proposal"
              ref={proposalSheetRef}
              style={{
                width: '920px',
                minWidth: '920px',
                height: 'auto',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              className="print-sheet shrink-0 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-7 space-y-4 text-slate-900"
            >
              {/* -------------------- CASE A: 일반구매 단독 제안서 -------------------- */}
              {state.quoteMode === 'general' && (
                <div className="space-y-4">
                  {/* 상단 헤더 (깔끔한 딥 네이비 bg-slate-900) */}
                  <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-extrabold">
                          <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                          맞춤 구매 설계안
                        </div>
                        {hasBothPlans && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold">
                            견적 {activePlan}안
                          </span>
                        )}
                        {activeCustomer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-extrabold">
                            <User className="w-3 h-3 text-amber-300" />
                            [{activeCustomer.name} 고객님 맞춤 제안서]
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black tracking-tight text-white">
                        {generalHeaderTitle}
                      </h1>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-extrabold text-white">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        결제수단: {state.generalCardType}
                      </span>
                    </div>
                  </div>

                  {/* 품목 및 총 합계 영역 */}
                  {state.generalItems.length >= 2 ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-extrabold text-slate-500">
                          구매 품목 내역 (총 {state.generalItems.length}개 품목)
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          품목별 행사가
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {state.generalItems.map((item, idx) => {
                          const lineTotal =
                            (Number(item.unitPrice) || 0) *
                            Math.max(1, Number(item.quantity) || 1);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                  {item.category || `가전품목 ${idx + 1}`}
                                </span>
                                {item.modelName && (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {item.modelName}
                                  </span>
                                )}
                                {item.quantity > 1 && (
                                  <span className="text-xs font-extrabold text-blue-600">
                                    × {item.quantity}개
                                  </span>
                                )}
                              </div>
                              <span className="text-base font-black text-slate-900">
                                {lineTotal.toLocaleString()}원
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-slate-900 text-white rounded-xl px-5 py-3.5 flex items-center justify-between">
                        <span className="text-base font-black text-slate-200">
                          총 합계 금액
                        </span>
                        <span className="text-2xl font-black text-white tracking-tight">
                          {generalSummary.sum.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-blue-600">
                            구매 품목 및 총 합계 금액
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xl font-black text-slate-900">
                              {state.generalItems[0]?.category ||
                                '맞춤 가전 패키지'}
                            </span>
                            {state.generalItems[0]?.modelName && (
                              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                {state.generalItems[0].modelName}
                              </span>
                            )}
                            {(state.generalItems[0]?.quantity || 1) > 1 && (
                              <span className="text-xs font-extrabold text-blue-600">
                                × {state.generalItems[0].quantity}개
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500">
                          총 합계 금액
                        </div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight">
                          {generalSummary.sum.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [1단계: 고객 실 결제부담금 산출] 카드 */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                          1
                        </span>
                        1단계: 고객 실 결제부담금 산출
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        총 합계 금액에서 즉시할인 및 하이프리드 지원금 차감
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* (-) 즉시할인 혜택 */}
                      <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-slate-200">
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            (-) 즉시할인 혜택
                          </div>
                          <div className="text-xs font-bold text-slate-500 mt-0.5">
                            {step1DiscountDetails.length > 0
                              ? step1DiscountDetails.join(' · ')
                              : '기본 즉시할인 + 추가 즉시할인 + 포인트 즉시사용'}
                          </div>
                        </div>
                        <div className="text-xl font-black text-blue-600">
                          -{generalSummary.totalStep1InstantDiscount.toLocaleString()}
                          원
                        </div>
                      </div>

                      {/* (-) 하이프리드 지원금 (선택 시에만 표시) */}
                      {generalSummary.hiFreedSupport > 0 && (
                        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-blue-200">
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              (-) 하이프리드 지원금
                            </div>
                            <div className="text-xs font-bold text-blue-600 mt-0.5">
                              {generalHiPreedSummary.activePlans
                                .map((p) => `${p.name} (${p.count}건)`)
                                .join(' + ')}{' '}
                              결합 지원
                            </div>
                          </div>
                          <div className="text-xl font-black text-blue-600">
                            -{generalSummary.hiFreedSupport.toLocaleString()}원
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 💳 고객 실 결제부담금 (실결제가) 강조 박스 */}
                    <div className="bg-blue-600 text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-base font-black text-white">
                            💳 고객 실 결제부담금 (실결제가)
                          </div>
                          <div className="text-xs font-bold text-blue-100">
                            매장 결제 시 실제 카드로 결제하시는 금액
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-white tracking-tight">
                        {generalSummary.payPrice.toLocaleString()}원
                      </div>
                    </div>
                  </div>

                  {/* [2단계: 캐시백 및 추가 혜택 차감 ➔ 최종 혜택가] 카드 */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                        <span className="w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-black flex items-center justify-center">
                          2
                        </span>
                        2단계: 캐시백 및 추가 혜택 차감 ➔ 최종 혜택가
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        결제 후 돌려받으시는 캐시백 및 추가 혜택 반영
                      </span>
                    </div>

                    {(generalSummary.totalStep2Cashback > 0 ||
                      generalSummary.totalStep2ExtraBenefit > 0) && (
                      <div className="space-y-2">
                        {/* (-) 캐시백 혜택 (0원보다 클 때만 표시) */}
                        {generalSummary.totalStep2Cashback > 0 && (
                          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-rose-200">
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                (-) 캐시백 혜택
                              </div>
                              <div className="text-xs font-bold text-rose-600 mt-0.5">
                                {step2CashbackDetails.join(' · ')}
                              </div>
                            </div>
                            <div className="text-xl font-black text-rose-600">
                              -{generalSummary.totalStep2Cashback.toLocaleString()}
                              원
                            </div>
                          </div>
                        )}

                        {/* (-) 추가 혜택 (0원보다 클 때만 표시) */}
                        {generalSummary.totalStep2ExtraBenefit > 0 && (
                          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-slate-200">
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                (-) 추가 혜택
                              </div>
                              <div className="text-xs font-bold text-slate-600 mt-0.5">
                                {step2ExtraDetails.join(' · ')}
                              </div>
                            </div>
                            <div className="text-xl font-black text-rose-600">
                              -{generalSummary.totalStep2ExtraBenefit.toLocaleString()}
                              원
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🎯 최종 혜택가 (체감 구매가) 메인 히어로 강조 박스 */}
                    <div className="bg-rose-50/70 border-2 border-rose-500 rounded-2xl p-6 text-center space-y-2 shadow-xs">
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black">
                        <Sparkles className="w-3.5 h-3.5" />
                        🎯 최종 혜택가 (체감 구매가)
                      </div>
                      <div className="text-5xl font-black text-rose-600 tracking-tight py-1">
                        {generalSummary.rawNet.toLocaleString()}원
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        실결제가 {generalSummary.payPrice.toLocaleString()}원
                        {generalSummary.totalStep2Cashback > 0 &&
                          ` - 캐시백 ${generalSummary.totalStep2Cashback.toLocaleString()}원`}
                        {generalSummary.totalStep2ExtraBenefit > 0 &&
                          ` - 추가혜택 ${generalSummary.totalStep2ExtraBenefit.toLocaleString()}원`}
                      </div>
                      {generalSummary.rawNet < 0 && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
                            🎉 가전 구매 후 오히려 +
                            {Math.abs(generalSummary.rawNet).toLocaleString()}원 더
                            이득!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------- CASE B: 구독구매 단독 제안서 -------------------- */}
              {state.quoteMode === 'subscription' && (
                <div className="space-y-4">
                  {/* 상단 헤더 (깔끔한 딥 네이비 bg-slate-900) */}
                  <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-extrabold">
                          <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                          맞춤 구독 설계안
                        </div>
                        {activeCustomer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-extrabold">
                            <User className="w-3 h-3 text-amber-300" />
                            [{activeCustomer.name} 고객님 맞춤 제안서]
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black tracking-tight text-white">
                        {subHeaderTitle}
                      </h1>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-extrabold text-white">
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                        품목별 맞춤 케어 · 5년 무상 A/S 보장
                      </span>
                    </div>
                  </div>

                  {/* 품목 및 총 월 구독료 합계 영역 (품목 아래쪽에 개별 케어서비스 작게 표시) */}
                  {state.items.length >= 2 ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-extrabold text-slate-500">
                          구독 가전 내역 (총 {state.items.length}개 품목)
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          품목별 월 구독료 ({state.subscriptionPeriod}개월)
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {state.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200"
                          >
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                  {item.category || `구독 가전 ${idx + 1}`}
                                </span>
                                {item.modelName && (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {item.modelName}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-slate-500 mt-1 pl-7">
                                🛡️ {item.careService || '전문가 방문케어'} · 5년 무상
                                A/S 보장
                              </div>
                            </div>
                            <span className="text-base font-black text-slate-900">
                              월 {(Number(item.monthlyFee) || 0).toLocaleString()}원
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-slate-900 text-white rounded-xl px-5 py-3.5 flex items-center justify-between">
                        <span className="text-base font-black text-slate-200">
                          총 월 구독료 합계 ({state.subscriptionPeriod}개월 구독)
                        </span>
                        <span className="text-2xl font-black text-white tracking-tight">
                          월 {totalBaseMonthly.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-rose-600">
                            구독 품목 및 총 월 구독료 합계 ({state.subscriptionPeriod}
                            개월 구독)
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xl font-black text-slate-900">
                              {state.items[0]?.category || '맞춤 구독 가전'}
                            </span>
                            {state.items[0]?.modelName && (
                              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                {state.items[0].modelName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-500 mt-1">
                            🛡️ {state.items[0]?.careService || '전문가 방문케어'} ·
                            5년 무상 A/S 보장
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500">
                          총 월 구독료 합계
                        </div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight">
                          월 {totalBaseMonthly.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 차감 내역 (선택한 항목만 깔끔한 고정 높이 배너로 표시) */}
                  {(cardMonthlyDiscount > 0 || hiPlusMonthlySupport > 0) && (
                    <div className="space-y-2.5">
                      {cardMonthlyDiscount > 0 && currentCard && currentCardTier && (
                        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl px-5 py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-base font-black text-slate-900">
                                (-) 제휴카드 월 할인 ({currentCard.name})
                              </div>
                              <div className="text-xs font-bold text-blue-700">
                                {currentCardTier.minSpendLabel} ·{' '}
                                {state.subscriptionPeriod}개월간 매월 할인
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-black text-blue-600">
                            월 -{cardMonthlyDiscount.toLocaleString()}원
                          </div>
                        </div>
                      )}

                      {hiPlusMonthlySupport > 0 && (
                        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl px-5 py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-base font-black text-slate-900">
                                (-) 구독프리드 (Hi구독 플러스) 월 지원금
                              </div>
                              <div className="text-xs font-bold text-indigo-700">
                                {state.subscriptionPeriod}개월간 매월 캐시백 지원
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-black text-indigo-600">
                            월 -{hiPlusMonthlySupport.toLocaleString()}원
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 메인 히어로 강조 박스 (가운데 정렬, 초대형 숫자) */}
                  <div className="bg-rose-50/70 border-2 border-rose-500 rounded-2xl p-6 text-center space-y-2 shadow-xs">
                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white border border-rose-200 text-xs font-extrabold text-slate-700">
                      <span>{subFormulaText}</span>
                    </div>
                    <div className="text-sm font-black text-rose-600 pt-1">
                      🎯 최종 월 체감가 ({state.subscriptionPeriod}개월 구독)
                    </div>
                    <div className="text-5xl font-black text-rose-600 tracking-tight py-1">
                      월 {finalMonthlyFee.toLocaleString()}원
                    </div>
                    {finalMonthlyFee < 0 && (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
                          🎉 월 구독료 0원 + 매월 +
                          {Math.abs(finalMonthlyFee).toLocaleString()}원씩 더 이득!
                          (총 +{Math.abs(finalTotal60Fee).toLocaleString()}원 추가
                          이익!)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 최하단 요약 리본 바 */}
                  <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between">
                    <span className="text-base font-black text-slate-200">
                      최종 {state.subscriptionPeriod}개월 체감가 합계
                    </span>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-2xl font-black text-white">
                        {finalTotal60Fee.toLocaleString()}원
                      </span>
                      <span className="text-sm font-bold text-slate-400">
                        (원금 {totalPrincipal.toLocaleString()}원)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------- CASE C: 일반+구독 혼합 제안서 -------------------- */}
              {state.quoteMode === 'hybrid' && (
                <div className="space-y-4">
                  {/* 상단 헤더 */}
                  <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-extrabold">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          맞춤 혼합 설계안
                        </div>
                        {hasBothPlans && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold">
                            일반 견적 {activePlan}안 적용
                          </span>
                        )}
                        {activeCustomer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-extrabold">
                            <User className="w-3 h-3 text-amber-300" />
                            [{activeCustomer.name} 고객님 맞춤 제안서]
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black tracking-tight text-white">
                        일반구매 · 구독구매 통합 맞춤 제안서
                      </h1>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-extrabold text-blue-300">
                        일반: {state.generalCardType}
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-extrabold text-rose-300">
                        구독: {state.subscriptionPeriod}개월
                      </span>
                    </div>
                  </div>

                  {/* 좌우 2단 대칭 배치 */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    {/* 좌측: [파트 A. 일반구매] */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-sm font-black text-blue-700 flex items-center gap-1.5">
                          <ShoppingBag className="w-4 h-4" />
                          파트 A. 일반구매 (일시불)
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {state.generalItems.length}개 품목
                        </span>
                      </div>

                      {/* 품목 및 총 합계 */}
                      {state.generalItems.length >= 2 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                          {state.generalItems.map((it, idx) => {
                            const amt =
                              (Number(it.unitPrice) || 0) *
                              Math.max(1, Number(it.quantity) || 1);
                            return (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-xs font-bold text-slate-700"
                              >
                                <span>
                                  {idx + 1}. {it.category || `일반가전 ${idx + 1}`}
                                  {it.quantity > 1 ? ` ×${it.quantity}` : ''}
                                </span>
                                <span className="font-black text-slate-900">
                                  {amt.toLocaleString()}원
                                </span>
                              </div>
                            );
                          })}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700">
                              총 합계 금액
                            </span>
                            <span className="text-base font-black text-slate-900">
                              {generalSummary.sum.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-extrabold text-blue-600">
                              구매 품목
                            </div>
                            <div className="text-sm font-black text-slate-900">
                              {state.generalItems[0]?.category || '일반구매 가전'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-500">
                              총 합계 금액
                            </div>
                            <div className="text-base font-black text-slate-900">
                              {generalSummary.sum.toLocaleString()}원
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 1단계 */}
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="text-xs font-black text-blue-700">
                          [1단계: 고객 실 결제부담금 산출]
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>(-) 즉시할인 혜택</span>
                          <span className="font-black text-blue-600">
                            -{generalSummary.totalStep1InstantDiscount.toLocaleString()}
                            원
                          </span>
                        </div>
                        {generalSummary.hiFreedSupport > 0 && (
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>(-) 하이프리드 지원금</span>
                            <span className="font-black text-blue-600">
                              -{generalSummary.hiFreedSupport.toLocaleString()}원
                            </span>
                          </div>
                        )}
                        <div className="bg-blue-600 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                          <span className="text-xs font-black">
                            💳 고객 실 결제부담금
                          </span>
                          <span className="text-base font-black">
                            {generalSummary.payPrice.toLocaleString()}원
                          </span>
                        </div>
                      </div>

                      {/* 2단계 */}
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="text-xs font-black text-rose-600">
                          [2단계: 캐시백 및 추가 혜택 차감]
                        </div>
                        {generalSummary.totalStep2Cashback > 0 && (
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>(-) 캐시백 혜택</span>
                            <span className="font-black text-rose-600">
                              -{generalSummary.totalStep2Cashback.toLocaleString()}원
                            </span>
                          </div>
                        )}
                        {generalSummary.totalStep2ExtraBenefit > 0 && (
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>(-) 추가 혜택</span>
                            <span className="font-black text-rose-600">
                              -{generalSummary.totalStep2ExtraBenefit.toLocaleString()}
                              원
                            </span>
                          </div>
                        )}
                        <div className="bg-rose-50/80 border-2 border-rose-500 rounded-xl p-3.5 text-center space-y-1">
                          <div className="text-xs font-black text-rose-600">
                            🎯 최종 혜택가 (체감 구매가)
                          </div>
                          <div className="text-2xl font-black text-rose-600">
                            {generalSummary.rawNet.toLocaleString()}원
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 우측: [파트 B. 구독구매] */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4" />
                          파트 B. 구독구매 ({state.subscriptionPeriod}개월)
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {state.items.length}개 품목
                        </span>
                      </div>

                      {/* 품목 및 총 월 구독료 합계 (품목별 케어서비스 표시) */}
                      {state.items.length >= 2 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                          {state.items.map((it, idx) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-slate-800">
                                  {idx + 1}. {it.category || `구독가전 ${idx + 1}`}
                                  {it.modelName ? ` (${it.modelName})` : ''}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500">
                                  🛡️ {it.careService || '전문가 방문케어'} · 5년 무상
                                  A/S 보장
                                </div>
                              </div>
                              <span className="font-black text-slate-900">
                                월 {(Number(it.monthlyFee) || 0).toLocaleString()}원
                              </span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700">
                              총 월 구독료 합계
                            </span>
                            <span className="text-base font-black text-slate-900">
                              월 {totalBaseMonthly.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-extrabold text-rose-600">
                              구독 품목
                            </div>
                            <div className="text-sm font-black text-slate-900">
                              {state.items[0]?.category || '구독 가전'}
                              {state.items[0]?.modelName
                                ? ` (${state.items[0].modelName})`
                                : ''}
                            </div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">
                              🛡️ {state.items[0]?.careService || '전문가 방문케어'}{' '}
                              · 5년 무상 A/S 보장
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-500">
                              총 월 구독료 합계
                            </div>
                            <div className="text-base font-black text-slate-900">
                              월 {totalBaseMonthly.toLocaleString()}원
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 차감 내역 */}
                      {(cardMonthlyDiscount > 0 || hiPlusMonthlySupport > 0) && (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                          <div className="text-xs font-black text-slate-700">
                            월 할인 및 지원금 차감
                          </div>
                          {cardMonthlyDiscount > 0 &&
                            currentCard &&
                            currentCardTier && (
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>
                                  (-) 제휴카드 ({currentCard.shortName} ·{' '}
                                  {currentCardTier.minSpendShort})
                                </span>
                                <span className="font-black text-blue-600">
                                  월 -{cardMonthlyDiscount.toLocaleString()}원
                                </span>
                              </div>
                            )}
                          {hiPlusMonthlySupport > 0 && (
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                              <span>(-) 구독프리드 월 지원금</span>
                              <span className="font-black text-indigo-600">
                                월 -{hiPlusMonthlySupport.toLocaleString()}원
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 메인 히어로: 최종 월 체감가 */}
                      <div className="bg-rose-50/80 border-2 border-rose-500 rounded-xl p-4 text-center space-y-1">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white border border-rose-200 text-[10px] font-extrabold text-slate-600">
                          {subFormulaText}
                        </div>
                        <div className="text-xs font-black text-rose-600 pt-0.5">
                          🎯 최종 월 체감가
                        </div>
                        <div className="text-2xl font-black text-rose-600">
                          월 {finalMonthlyFee.toLocaleString()}원
                        </div>
                      </div>

                      {/* 최하단 요약 리본 바 */}
                      <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-300">
                          최종 {state.subscriptionPeriod}개월 체감가
                        </span>
                        <span className="font-black text-white">
                          {finalTotal60Fee.toLocaleString()}원{' '}
                          <span className="font-bold text-slate-400">
                            (원금 {totalPrincipal.toLocaleString()}원)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ==================== 혼합 제안서 최하단 통합 합산 바 ==================== */}
                  <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-md">
                    <div className="space-y-1">
                      <div className="text-sm font-black text-slate-100">
                        일반구매 최종 혜택가 ({generalSummary.rawNet.toLocaleString()}
                        원) + 구독구매 {state.subscriptionPeriod}개월 총 체감가 (
                        {finalTotal60Fee.toLocaleString()}원 / 월{' '}
                        {finalMonthlyFee.toLocaleString()}원)
                      </div>
                      <div className="text-xs font-bold text-slate-400">
                        일반 실결제 부담금 {generalSummary.payPrice.toLocaleString()}
                        원 · 통합 총 할인/지원 혜택 -
                        {hybridTotalDiscountAndSupport.toLocaleString()}원
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <div className="text-xs font-extrabold text-amber-300 mb-0.5">
                        🎯 일반구매 + 구독구매 최종 혜택가 합계
                      </div>
                      <div className="text-3xl font-black text-amber-400 tracking-tight">
                        {hybridCombinedNetTotal.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                        {state.subscriptionPeriod}개월 지원
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
                          {state.subscriptionPeriod}개월
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
        </div>
      </div>
    </div>
  );
};
