import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Laptop,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tv,
  Wrench,
  XCircle,
} from 'lucide-react';
import { AppSubViewHeader } from './ui/AppSubViewHeader';
import { SurfaceCard } from './ui/SurfaceCard';
import { KpiMetricStrip } from './ui/KpiMetricStrip';

interface AllCareGuideViewProps {
  onBackToHome: () => void;
  backLabel?: string;
}

const REGISTRATION_URL = 'https://hiwarranty.co.kr';

export const AllCareGuideView: React.FC<AllCareGuideViewProps> = ({
  onBackToHome,
  backLabel,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKakao, setCopiedKakao] = useState(false);

  const kakaoGuideMessage = [
    '[롯데하이마트 경기광주점] 🛡️ 가전올케어 보유가전 등록 안내',
    '',
    '▶ 보유가전 등록 사이트',
    REGISTRATION_URL,
    '',
    '■ 초간단 등록 방법 (4단계)',
    '① 사이트 접속 (hiwarranty.co.kr)',
    '② [제품등록] 클릭 (가전수리올케어 제품등록)',
    '③ 이름 · 연락처 입력 (가입 고객 본인 확인)',
    '④ 보유가전 등록 (브랜드 · 품목 · 구매년도 선택 후 완료!)',
    '',
    '■ 가전올케어 핵심 혜택 요약',
    '• 한 줄 안내: 새 가전부터 집에 쓰던 기존 가전까지(구매처·브랜드 무관), 고장 수리비를 통합 보장하는 하이마트 안심 서비스',
    '• 가입 비용: 2년 50,000원 (단일가)',
    '• 보장 대상(34종): 대형 8종(냉장고, 김치냉장고, 에어컨, TV, 세탁기, 건조기, 세탁건조기, 의류관리기), 생활·주방 21종(청소기, 선풍기, 공기청정기, 제습기, 가습기, 안마의자, 비데, 전기레인지, 가스레인지, 전자레인지, 식기세척기, 전기밥솥, 정수기, 커피머신, 헤어용품, 복합오븐, 음식물처리기, 에어프라이어, 믹서기류, 전기그릴, 멀티쿠커), IT 5종(노트북, 데스크탑, 일체형PC, 모니터, 태블릿PC)',
    '• 보장 한도: 가입 60일 후부터 연간 100만원 한도 (횟수 무제한)',
    '• 자기부담금: 수리 1회당 5,000원 (제조 10년 경과 제품은 5만원)',
    '',
    '■ 기본 보장 및 제외 안내',
    '• 보장 가능: 정상 사용 중 발생한 제품 본연의 기능상·기계적 고장 공식 서비스센터 수리비',
    '• 보장 제외: 고객 과실·충격 파손(액정 깨짐·낙하·침수), 단순 소모품(배터리·필터) 교체 및 세척, 가입 60일 이내 고장, 해외직구 등 국내 공식 서비스센터 수리 불가 제품, 사업장·상업시설 등 업무·영업용 사용 제품',
    '',
    '※ 사전 등록된 가전에 한해 보장됩니다. (전용 고객센터: 1588-2355)',
  ].join('\n');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(REGISTRATION_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyKakao = async () => {
    try {
      await navigator.clipboard.writeText(kakaoGuideMessage);
      setCopiedKakao(true);
      setTimeout(() => setCopiedKakao(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[calc(100dvh-44px)] w-full bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 flex flex-col pb-12">
      <AppSubViewHeader
        title="가전 올케어 안내 · 등록"
        subtitle="구매처·브랜드 무관 34대 가전 통합 수리비 보증 안내 및 보유가전 등록"
        badge="안심 보증"
        icon={<ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />}
        onBack={onBackToHome}
        backLabel={backLabel || '홈으로'}
        maxWidthClass="max-w-4xl"
        rightSlot={
          <button
            type="button"
            onClick={handleCopyKakao}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer ${
              copiedKakao
                ? 'bg-[#059669] text-white'
                : 'bg-[#191F28] hover:bg-slate-800 dark:bg-[#60A5FA] dark:hover:bg-blue-400 text-white dark:text-[#0B1120]'
            }`}
          >
            {copiedKakao ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>✓ 카톡 안내문 복사 완료!</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>💬 고객 카톡 안내문 복사</span>
              </>
            )}
          </button>
        }
      />

      <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
        {/* =================================================================== */}
        {/* [2-1. 상단: 보유가전 등록 사이트 & 초간단 등록 방법 (4단계)] */}
        {/* =================================================================== */}
        <SurfaceCard className="border-t-[3px] border-t-[#1B64DA] space-y-5">
          {/* 1) 최상단 등록 사이트 박스 */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="space-y-1 min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-[#1B64DA] dark:text-blue-400">
                🛡️ 가전올케어 보유가전 등록 사이트
              </div>
              <div className="text-lg sm:text-2xl lg:text-3xl font-black font-mono tabular-nums text-[#191F28] dark:text-slate-50 tracking-tight select-all break-all">
                {REGISTRATION_URL}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <a
                href={REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B64DA] hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>🔗 사이트 바로가기</span>
              </a>

              <button
                type="button"
                onClick={handleCopyUrl}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm border transition cursor-pointer whitespace-nowrap ${
                  copiedUrl
                    ? 'bg-[#059669] border-[#059669] text-white'
                    : 'bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100'
                }`}
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0 text-[#1B64DA] dark:text-blue-400" />
                    <span>📋 주소 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2) 초간단 등록 방법 (1줄 4단계 화살표 카드) */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300 px-1">
              ✨ 초간단 보유가전 등록 방법 (4단계)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* STEP 1 */}
              <div className="relative bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-400">
                    ① 사이트 접속
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-500" />
                </div>
                <div className="text-xs font-bold text-[#191F28] dark:text-slate-200 font-mono">
                  hiwarranty.co.kr
                </div>
              </div>

              {/* STEP 2 */}
              <div className="relative bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-400">
                    ② [제품등록] 클릭
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-500" />
                </div>
                <div className="text-xs font-bold text-[#191F28] dark:text-slate-200">
                  가전수리올케어 제품등록
                </div>
              </div>

              {/* STEP 3 */}
              <div className="relative bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-400">
                    ③ 이름 · 연락처 입력
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-500" />
                </div>
                <div className="text-xs font-bold text-[#191F28] dark:text-slate-200">
                  가입 고객 본인 확인
                </div>
              </div>

              {/* STEP 4 */}
              <div className="bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="text-xs font-extrabold text-[#1B64DA] dark:text-blue-300 mb-1">
                  ④ 보유가전 등록
                </div>
                <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-50">
                  브랜드 · 품목 · 구매년도 선택 후 완료!
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>

        {/* =================================================================== */}
        {/* [2-2. 하단: 가전올케어 서비스란? (약관 제8조·제17조 기준 34종 및 보장/제외)] */}
        {/* =================================================================== */}
        <SurfaceCard className="space-y-5">
          {/* 한 줄 정의 */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-[#191F28] dark:text-slate-50">
                가전올케어 서비스란?
              </h2>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 leading-relaxed">
              &ldquo;새 가전부터 집에 쓰던 기존 가전까지(구매처·브랜드 무관), 고장 수리비를 통합 보장하는 하이마트 안심 서비스&rdquo;
            </div>
          </div>

          {/* 핵심 혜택 4칸 요약 KPI 스트립 */}
          <KpiMetricStrip
            columnsClass="grid-cols-1 sm:grid-cols-2"
            items={[
              {
                id: 'cost',
                label: '1) 가입 비용',
                value: '2년 50,000원',
                subLabel: '단일가',
                tone: 'benefit',
              },
              {
                id: 'target',
                label: '2) 보장 대상',
                value: '가전 34종 통합 보장',
                subLabel: '대형 8종 · 생활/주방 21종 · IT 5종',
                tone: 'default',
              },
              {
                id: 'limit',
                label: '3) 보장 한도',
                value: '연간 100만원 한도 (횟수 무제한)',
                subLabel: '가입 60일 후부터 보장 적용',
                tone: 'brand',
              },
              {
                id: 'deductible',
                label: '4) 자기부담금',
                value: '수리 1회당 5,000원',
                subLabel: '제조 10년 경과 제품은 5만원',
                tone: 'emerald',
              },
            ]}
          />

          {/* 1) 보유가전 등록 가능 34종 대상 품목 상세 리스트 (약관 제8조 제1항 기준) */}
          <div className="space-y-3 pt-3 border-t border-[#E5E8EB] dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-50 flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                <span>보유가전 등록 가능 34종 대상 품목 상세 리스트</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 text-[11.5px] font-bold">
                구매처 · 브랜드 무관
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 📺 대형가전 (8종) */}
              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold text-[#1B64DA] dark:text-blue-400 flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5" />
                    📺 대형가전 (8종)
                  </span>
                </div>
                <p className="text-xs font-bold text-[#4E5968] dark:text-slate-300 leading-relaxed">
                  냉장고, 김치냉장고, 에어컨, TV, 세탁기, 건조기, 세탁건조기, 의류관리기
                </p>
              </div>

              {/* 🍳 생활·주방가전 (21종) */}
              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold text-[#059669] dark:text-emerald-400 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" />
                    🍳 생활·주방가전 (21종)
                  </span>
                </div>
                <p className="text-xs font-bold text-[#4E5968] dark:text-slate-300 leading-relaxed">
                  청소기, 선풍기, 공기청정기, 제습기, 가습기, 안마의자, 비데, 전기레인지, 가스레인지, 전자레인지, 식기세척기, 전기밥솥, 정수기, 커피머신, 헤어용품, 복합오븐, 음식물처리기, 에어프라이어, 믹서기류, 전기그릴, 멀티쿠커
                </p>
              </div>

              {/* 💻 IT 가전 (5종) */}
              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1">
                    <Laptop className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                    💻 IT 가전 (5종)
                  </span>
                </div>
                <p className="text-xs font-bold text-[#4E5968] dark:text-slate-300 leading-relaxed">
                  노트북, 데스크탑, 일체형PC, 모니터, 태블릿PC
                </p>
                <p className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 leading-snug pt-0.5">
                  ※ 국내 정식 유통 제품으로 제조사 공식 서비스센터(애플·삼성·LG 등 공식 센터) 수리 가능 제품 보장 (단, 해외직구 등 국내 공식 서비스센터 수리 불가 제품 및 영업·업무용 제외)
                </p>
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 text-xs font-bold text-[#191F28] dark:text-slate-200">
              💡 하이마트 구매 가전뿐만 아니라 타사 구매 가전·기존 사용 중인 가전도 제조년월 기준 10년 이내면 등록 가능합니다.
            </div>
          </div>

          {/* 2) 기본 보장 기준 및 보상 제외 사항 (약관 제8조 제2항·제17조 기준) */}
          <div className="space-y-3 pt-3 border-t border-[#E5E8EB] dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-extrabold text-[#191F28] dark:text-slate-50 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#E60012] dark:text-rose-400" />
              <span>기본 보장 기준 및 보상 제외 사항</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 🟢 보장 가능 (제품 기능상의 고장) */}
              <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 p-4 space-y-2">
                <div className="text-xs sm:text-sm font-extrabold text-[#059669] dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0" />
                  <span>🟢 보장 가능 (제품 기능상의 고장)</span>
                </div>
                <ul className="space-y-1.5 text-xs font-bold text-[#191F28] dark:text-slate-200 leading-relaxed">
                  <li>
                    • 정상적인 사용 중 발생한{' '}
                    <strong className="text-[#059669] dark:text-emerald-300">
                      제품 본연의 기능상·기계적·전기적 고장
                    </strong>
                    으로 인한 공식 서비스센터 정식 수리비(부품비+공임비)
                  </li>
                  <li>
                    • 가입 60일(면책기간) 경과 후부터 보장 개시 / 연간 총 100만원 한도 내 횟수 무제한
                  </li>
                </ul>
              </div>

              {/* 🔴 보장 제외 (파손 · 소모품 교체 등 불가) */}
              <div className="rounded-2xl bg-[#FFF1F2] dark:bg-rose-500/12 border border-[#FECDD3] dark:border-rose-500/30 p-4 space-y-2">
                <div className="text-xs sm:text-sm font-extrabold text-[#E60012] dark:text-rose-300 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-[#E60012] dark:text-rose-400 shrink-0" />
                  <span>🔴 보장 제외 (파손 · 소모품 교체 등 불가)</span>
                </div>
                <ul className="space-y-1.5 text-xs font-bold text-[#191F28] dark:text-slate-200 leading-relaxed">
                  <li>
                    •{' '}
                    <strong className="text-[#E60012] dark:text-rose-300">
                      고객 과실 및 외부 충격에 의한 파손
                    </strong>{' '}
                    (액정 깨짐, 외관 파손, 낙하, 침수 등)
                  </li>
                  <li>
                    •{' '}
                    <strong className="text-[#E60012] dark:text-rose-300">
                      단순 소모품 교체 및 세척
                    </strong>{' '}
                    (필터, 배터리, 먼지봉투, 리모컨 등 소모품 교체 및 클리닝)
                  </li>
                  <li>
                    • <strong className="text-[#E60012] dark:text-rose-300">가입 후 60일 이내</strong>{' '}
                    발생한 고장, <strong className="text-[#E60012] dark:text-rose-300">도난·분실</strong>,
                    제조사 공식 센터 외{' '}
                    <strong className="text-[#E60012] dark:text-rose-300">사설 수리</strong>,{' '}
                    <strong className="text-[#E60012] dark:text-rose-300">
                      해외직구 등 국내 공식 서비스센터 수리 불가 제품, 사업장·상업시설 등 업무·영업용 사용 제품
                    </strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 하단 간략 안내 (1줄) */}
          <div className="pt-3 border-t border-[#E5E8EB] dark:border-slate-800 text-center">
            <p className="text-xs font-bold text-[#4E5968] dark:text-slate-400">
              ※ 사전 등록된 가전에 한해 보장됩니다. (전용 고객센터:{' '}
              <strong className="font-mono tabular-nums text-[#191F28] dark:text-slate-100">1588-2355</strong>)
            </p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
