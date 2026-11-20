import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { AppSubViewHeader } from './ui/AppSubViewHeader';
import { SurfaceCard } from './ui/SurfaceCard';

interface InsuranceGuideViewProps {
  onBackToHome: () => void;
  backLabel?: string;
}

interface InsuranceRow {
  no: number;
  type: string;
  subType?: string;
  serviceDesc: string;
  partnerName: string;
  partnerPhone: string;
  groupFirst?: boolean;
  groupRowSpan?: number;
}

const INSURANCE_ROWS: InsuranceRow[] = [
  {
    no: 1,
    type: '연장보증서비스',
    subType: '(하이워런티)',
    serviceDesc: '보증기간 최대 5년\n연장서비스',
    partnerName: 'DB손해보험',
    partnerPhone: '1588-2355',
    groupFirst: true,
    groupRowSpan: 2,
  },
  {
    no: 2,
    type: '가전수리올케어',
    serviceDesc: '가정에서 사용중인\n가전제품 최대 2년 보장',
    partnerName: 'DB손해보험',
    partnerPhone: '1588-2355',
    groupFirst: false,
  },
  {
    no: 3,
    type: '연장보증서비스',
    subType: '(하이마트케어)',
    serviceDesc: '보증기간 최대 5년\n연장서비스',
    partnerName: '롯데손해보험',
    partnerPhone: '02-6320-4933',
    groupFirst: true,
    groupRowSpan: 4,
  },
  {
    no: 4,
    type: '파손보장보험',
    serviceDesc: '파손으로 인한 가전\n수리비 1년 보장',
    partnerName: '롯데손해보험',
    partnerPhone: '02-6320-4933',
    groupFirst: false,
  },
  {
    no: 5,
    type: '중고모바일파손보험',
    serviceDesc: '중고 모바일 파손\n수리비 1년 보장',
    partnerName: '롯데손해보험',
    partnerPhone: '02-6320-4933',
    groupFirst: false,
  },
  {
    no: 6,
    type: '노트북케어보험',
    serviceDesc: '고장/파손/배터리 교체\n수리비 2년 보장',
    partnerName: '롯데손해보험',
    partnerPhone: '02-6320-4933',
    groupFirst: false,
  },
  {
    no: 7,
    type: '모바일케어보험',
    serviceDesc: '모바일 파손 수리비\n최대 3년 보장',
    partnerName: '신한EZ손해보험',
    partnerPhone: '1544-0615',
    groupFirst: true,
    groupRowSpan: 1,
  },
];

export const InsuranceGuideView: React.FC<InsuranceGuideViewProps> = ({
  onBackToHome,
  backLabel,
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} 안내가 복사되었습니다!`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(`${label} 안내가 복사되었습니다!`);
    }
  };

  const buildSingleCopyText = (row: InsuranceRow) => {
    const fullName = row.subType ? `${row.type} ${row.subType}` : row.type;
    const cleanService = row.serviceDesc.replace(/\n/g, ' ');
    return [
      `[보험상품 안내]`,
      `${row.no}. ${fullName}`,
      `• 서비스 내용: ${cleanService}`,
      `• 청구 파트너사: ${row.partnerName} (${row.partnerPhone})`,
    ].join('\n');
  };

  const buildAllCopyText = () => {
    const lines = [
      `[보험상품 안내]`,
      ``,
      `1. 연장보증서비스 (하이워런티)`,
      `   - 서비스 내용: 보증기간 최대 5년 연장서비스`,
      `   - 청구 파트너사: DB손해보험 (1588-2355)`,
      ``,
      `2. 가전수리올케어`,
      `   - 서비스 내용: 가정에서 사용중인 가전제품 최대 2년 보장`,
      `   - 청구 파트너사: DB손해보험 (1588-2355)`,
      ``,
      `3. 연장보증서비스 (하이마트케어)`,
      `   - 서비스 내용: 보증기간 최대 5년 연장서비스`,
      `   - 청구 파트너사: 롯데손해보험 (02-6320-4933)`,
      ``,
      `4. 파손보장보험`,
      `   - 서비스 내용: 파손으로 인한 가전 수리비 1년 보장`,
      `   - 청구 파트너사: 롯데손해보험 (02-6320-4933)`,
      ``,
      `5. 중고모바일파손보험`,
      `   - 서비스 내용: 중고 모바일 파손 수리비 1년 보장`,
      `   - 청구 파트너사: 롯데손해보험 (02-6320-4933)`,
      ``,
      `6. 노트북케어보험`,
      `   - 서비스 내용: 고장/파손/배터리 교체 수리비 2년 보장`,
      `   - 청구 파트너사: 롯데손해보험 (02-6320-4933)`,
      ``,
      `7. 모바일케어보험`,
      `   - 서비스 내용: 모바일 파손 수리비 최대 3년 보장`,
      `   - 청구 파트너사: 신한EZ손해보험 (1544-0615)`,
    ];
    return lines.join('\n');
  };

  return (
    <div className="min-h-[calc(100dvh-44px)] flex-1 w-full bg-[#F2F4F6] dark:bg-[#0B1120] text-[#191F28] dark:text-slate-100 pb-12">
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#191F28] dark:bg-slate-800 text-white text-xs sm:text-sm font-extrabold shadow-2xl border border-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <AppSubViewHeader
        title="보험 청구안내"
        subtitle="연장보증 · 가전수리올케어 · 파손보장 · 모바일/노트북 케어 청구 파트너사"
        badge="청구 파트너사"
        icon={<ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />}
        onBack={onBackToHome}
        backLabel={backLabel || '홈으로'}
        maxWidthClass="max-w-4xl"
        rightSlot={
          <button
            type="button"
            onClick={() => copyToClipboard(buildAllCopyText(), '보험상품 전체')}
            className="h-9 px-3.5 rounded-xl bg-[#1B64DA] hover:bg-blue-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span>📋 전체 보험안내 복사</span>
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4">
        {/* 보험상품 안내 레이아웃 카드 */}
        <SurfaceCard className="p-4 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#191F28] dark:text-slate-50 tracking-tight inline-flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[#1B64DA] dark:text-blue-400" />
              <span>보험상품 안내</span>
            </h2>
          </div>

          {/* 스마트폰(<640px) 전용 고가독성 카드 리스트 (폴드 펼침/PC에서는 기존 원본 표 그대로 유지) */}
          <div className="sm:hidden space-y-2.5">
            {INSURANCE_ROWS.map((row) => {
              const fullName = row.subType
                ? `${row.type} ${row.subType}`
                : row.type;
              return (
                <div
                  key={`m-${row.no}`}
                  className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#191F28] dark:bg-slate-700 text-white font-extrabold font-mono tabular-nums text-xs shrink-0">
                        {row.no}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-[#191F28] dark:text-slate-100 leading-tight">
                          {row.type}
                        </div>
                        {row.subType && (
                          <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400">
                            {row.subType}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(buildSingleCopyText(row), fullName)
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-[#191F28] dark:bg-slate-800 hover:bg-[#1B64DA] text-white text-[11.5px] font-bold inline-flex items-center gap-1 shrink-0 transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>안내 복사</span>
                    </button>
                  </div>

                  <p className="text-xs font-bold text-[#4E5968] dark:text-slate-200 leading-relaxed bg-white dark:bg-[#131C2E] rounded-xl px-3 py-2 border border-[#E5E8EB] dark:border-slate-800">
                    {row.serviceDesc.replace(/\n/g, ' ')}
                  </p>

                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <span className="font-bold text-[#4E5968] dark:text-slate-400">
                      청구처:{' '}
                      <strong className="text-[#1B64DA] dark:text-blue-400">
                        {row.partnerName}
                      </strong>
                    </span>
                    <a
                      href={`tel:${row.partnerPhone}`}
                      className="px-3 py-1 rounded-xl bg-[#1B64DA] hover:bg-blue-700 text-white font-extrabold font-mono tabular-nums inline-flex items-center gap-1 transition"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{row.partnerPhone}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 표 영역 (폴드 펼침 640px+ 및 PC 전용 원본 표) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="border-b-2 border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-100 text-xs sm:text-base font-extrabold">
                  <th className="py-3 px-2 sm:px-3 w-16 sm:w-24">상세번호</th>
                  <th className="py-3 px-2 sm:px-4">보험종류</th>
                  <th className="py-3 px-2 sm:px-4">
                    <div>서비스 내용</div>
                    <div className="text-[11.5px] sm:text-xs font-bold text-[#E60012] dark:text-rose-400 mt-0.5">
                      *번호별 상세내용 확인
                    </div>
                  </th>
                  <th className="py-3 px-2 sm:px-4">청구 파트너사</th>
                  <th className="py-3 px-2 sm:px-3 w-20 sm:w-28">복사</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8EB] dark:divide-slate-800 text-xs sm:text-sm font-bold text-[#191F28] dark:text-slate-200">
                {INSURANCE_ROWS.map((row) => {
                  const fullName = row.subType
                    ? `${row.type} ${row.subType}`
                    : row.type;
                  return (
                    <tr
                      key={row.no}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50 transition"
                    >
                      {/* 상세번호 (원형 배지 1~7) */}
                      <td className="py-4 px-2 sm:px-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#191F28] dark:bg-slate-700 text-white font-extrabold font-mono tabular-nums text-xs sm:text-sm">
                          {row.no}
                        </span>
                      </td>

                      {/* 보험종류 */}
                      <td className="py-4 px-2 sm:px-4 font-extrabold text-[#191F28] dark:text-slate-50">
                        <div>{row.type}</div>
                        {row.subType && (
                          <div className="text-xs sm:text-sm font-bold text-[#4E5968] dark:text-slate-400 mt-0.5">
                            {row.subType}
                          </div>
                        )}
                      </td>

                      {/* 서비스 내용 */}
                      <td className="py-4 px-2 sm:px-4 whitespace-pre-line leading-relaxed text-[#4E5968] dark:text-slate-200 font-bold">
                        {row.serviceDesc}
                      </td>

                      {/* 청구 파트너사 (병합 그룹 박스) */}
                      {row.groupFirst && (
                        <td
                          rowSpan={row.groupRowSpan}
                          className="py-4 px-2 sm:px-4 align-middle bg-[#F8FAFC] dark:bg-slate-900/70 border-l border-r border-[#E5E8EB] dark:border-slate-800"
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-sm sm:text-base font-extrabold text-[#1B64DA] dark:text-blue-400">
                              {row.partnerName}
                            </span>
                            <a
                              href={`tel:${row.partnerPhone}`}
                              className="text-xs sm:text-base font-extrabold font-mono tabular-nums text-[#1B64DA] dark:text-blue-300 hover:underline inline-flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>({row.partnerPhone})</span>
                            </a>
                          </div>
                        </td>
                      )}

                      {/* 개별 복사 버튼 */}
                      <td className="py-4 px-2 sm:px-3">
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(buildSingleCopyText(row), fullName)
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-[#191F28] dark:bg-slate-800 hover:bg-[#1B64DA] dark:hover:bg-[#1B64DA] text-white text-[11.5px] sm:text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                        >
                          <Copy className="w-3 h-3 shrink-0" />
                          <span>복사</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
