import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface AllCareGuideViewProps {
  onBackToHome: () => void;
}

const REGISTRATION_URL = 'https://hiwarranty.co.kr';

export const AllCareGuideView: React.FC<AllCareGuideViewProps> = ({
  onBackToHome,
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
    '• 보장 대상: 가전 34종 통합 보장 (대형 8종 · 생활/주방 21종 · IT 5종)',
    '• 보장 한도: 가입 60일 후부터 연간 100만원 한도 (횟수 무제한)',
    '• 자기부담금: 수리 1회당 5,000원 (제조 10년 경과 제품은 5만원)',
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
    <div className="min-h-[calc(100dvh-44px)] w-full bg-slate-100 flex flex-col items-center justify-start py-4 sm:py-6 px-3 sm:px-5">
      <div className="w-full max-w-3xl mx-auto space-y-4">
        {/* 상단 헤더 바 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs shadow-2xs transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 메인 화면으로
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white font-black text-xs shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>8. 가전 올케어 안내·등록</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyKakao}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer"
          >
            {copiedKakao ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>✓ 카톡 안내문 복사 완료!</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>💬 고객 카톡 안내문 복사</span>
              </>
            )}
          </button>
        </div>

        {/* =================================================================== */}
        {/* [2-1. 상단: 보유가전 등록 사이트 & 초간단 등록 방법 (4단계)] */}
        {/* =================================================================== */}
        <section className="rounded-3xl bg-slate-900 text-white border-2 border-sky-500/70 shadow-xl p-5 sm:p-6 space-y-5">
          {/* 1) 최상단 등록 사이트 박스 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/90 border border-slate-700 rounded-2xl p-4 sm:p-5">
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-black text-sky-300">
                🛡️ 가전올케어 보유가전 등록 사이트
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight select-all">
                {REGISTRATION_URL}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>🔗 사이트 바로가기</span>
              </a>

              <button
                type="button"
                onClick={handleCopyUrl}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-black text-xs sm:text-sm border transition cursor-pointer ${
                  copiedUrl
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white'
                }`}
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0 text-sky-300" />
                    <span>📋 주소 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2) 초간단 등록 방법 (1줄 4단계 화살표 카드) */}
          <div className="space-y-2">
            <div className="text-xs font-black text-sky-300 px-1">
              ✨ 초간단 보유가전 등록 방법 (4단계)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {/* STEP 1 */}
              <div className="relative bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-sky-400">
                    ① 사이트 접속
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  hiwarranty.co.kr
                </div>
              </div>

              {/* STEP 2 */}
              <div className="relative bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-sky-400">
                    ② [제품등록] 클릭
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  가전수리올케어 제품등록
                </div>
              </div>

              {/* STEP 3 */}
              <div className="relative bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-sky-400">
                    ③ 이름 · 연락처 입력
                  </span>
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  가입 고객 본인 확인
                </div>
              </div>

              {/* STEP 4 */}
              <div className="bg-sky-500/20 border-2 border-sky-400 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="text-xs font-black text-amber-300 mb-1">
                  ④ 보유가전 등록
                </div>
                <div className="text-xs font-black text-white">
                  브랜드 · 품목 · 구매년도 선택 후 완료!
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* [2-2. 하단: 가전올케어 서비스란? (간단명료 핵심 요약)] */}
        {/* =================================================================== */}
        <section className="rounded-3xl bg-white border border-slate-200 shadow-lg p-5 sm:p-6 space-y-4">
          {/* 한 줄 정의 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                가전올케어 서비스란?
              </h2>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 text-xs sm:text-sm font-black text-slate-900 leading-relaxed">
              &ldquo;새 가전부터 집에 쓰던 기존 가전까지(구매처·브랜드 무관), 고장 수리비를 통합 보장하는 하이마트 안심 서비스&rdquo;
            </div>
          </div>

          {/* 핵심 혜택 4칸 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1) 가입 비용 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-extrabold text-sky-700">
                1) 가입 비용
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900">
                2년 50,000원{' '}
                <span className="text-xs font-bold text-slate-500">
                  (단일가)
                </span>
              </div>
            </div>

            {/* 2) 보장 대상 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-extrabold text-indigo-700">
                2) 보장 대상
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900">
                가전 34종 통합 보장
              </div>
              <div className="text-xs font-bold text-slate-500">
                대형 8종 · 생활/주방 21종 · IT 5종
              </div>
            </div>

            {/* 3) 보장 한도 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-extrabold text-rose-700">
                3) 보장 한도
              </div>
              <div className="text-base sm:text-lg font-black text-rose-600">
                연간 100만원 한도 (횟수 무제한)
              </div>
              <div className="text-xs font-bold text-slate-500">
                가입 60일 후부터 보장 적용
              </div>
            </div>

            {/* 4) 자기부담금 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-extrabold text-amber-800">
                4) 자기부담금
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900">
                수리 1회당 5,000원
              </div>
              <div className="text-xs font-bold text-slate-500">
                (제조 10년 경과 제품은 5만원)
              </div>
            </div>
          </div>

          {/* 하단 간략 안내 (1줄) */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs font-extrabold text-slate-600">
              ※ 사전 등록된 가전에 한해 보장됩니다. (전용 고객센터:{' '}
              <strong className="text-slate-900">1588-2355</strong>)
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
