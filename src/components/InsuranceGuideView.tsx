import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Phone,
  ShieldCheck,
} from 'lucide-react';

interface InsuranceGuideViewProps {
  onBackToHome: () => void;
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
    <div className="flex-1 w-full bg-slate-100 pb-12">
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs sm:text-sm font-black shadow-2xl border border-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-4">
        {/* 상단 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToHome}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>메인 메뉴로</span>
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(buildAllCopyText(), '보험상품 전체')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span>📋 전체 보험안내 복사 (카톡/문자 전달용)</span>
          </button>
        </div>

        {/* 원본 사진 100% 동일 레이아웃 카드 */}
        <div className="rounded-3xl bg-white border-2 border-slate-200 shadow-lg p-4 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight inline-flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 sm:w-9 sm:h-9 text-blue-600" />
              <span>보험상품 안내</span>
            </h1>
          </div>

          {/* 표 영역 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-900 text-xs sm:text-base font-black">
                  <th className="py-3 px-2 sm:px-3 w-16 sm:w-24">상세번호</th>
                  <th className="py-3 px-2 sm:px-4">보험종류</th>
                  <th className="py-3 px-2 sm:px-4">
                    <div>서비스 내용</div>
                    <div className="text-[10px] sm:text-xs font-extrabold text-rose-600 mt-0.5">
                      *번호별 상세내용 확인
                    </div>
                  </th>
                  <th className="py-3 px-2 sm:px-4">청구 파트너사</th>
                  <th className="py-3 px-2 sm:px-3 w-20 sm:w-28">복사</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-bold text-slate-800">
                {INSURANCE_ROWS.map((row) => {
                  const fullName = row.subType
                    ? `${row.type} ${row.subType}`
                    : row.type;
                  return (
                    <tr key={row.no} className="hover:bg-slate-50/80 transition">
                      {/* 상세번호 (검은색 원형 배지 1~7) */}
                      <td className="py-4 px-2 sm:px-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 text-white font-black text-xs sm:text-sm">
                          {row.no}
                        </span>
                      </td>

                      {/* 보험종류 */}
                      <td className="py-4 px-2 sm:px-4 font-extrabold text-slate-900">
                        <div>{row.type}</div>
                        {row.subType && (
                          <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                            {row.subType}
                          </div>
                        )}
                      </td>

                      {/* 서비스 내용 */}
                      <td className="py-4 px-2 sm:px-4 whitespace-pre-line leading-relaxed text-slate-800 font-bold">
                        {row.serviceDesc}
                      </td>

                      {/* 청구 파트너사 (병합 그룹 박스) */}
                      {row.groupFirst && (
                        <td
                          rowSpan={row.groupRowSpan}
                          className="py-4 px-2 sm:px-4 align-middle bg-slate-100/90 border-l border-r border-slate-200"
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-sm sm:text-base font-black text-blue-700">
                              {row.partnerName}
                            </span>
                            <a
                              href={`tel:${row.partnerPhone}`}
                              className="text-xs sm:text-base font-black text-blue-700 hover:underline inline-flex items-center gap-1"
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
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-[11px] sm:text-xs font-black inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
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
        </div>
      </div>
    </div>
  );
};
