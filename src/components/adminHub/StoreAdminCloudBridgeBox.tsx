import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
} from 'lucide-react';
import { extractGoogleSheetId } from '../../utils/storeCloudSync';

export const StoreAdminCloudBridgeBox: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    cardBg,
    cloudDiag,
    cloudPin,
    friendInvites,
    gasUrl,
    handleCopyAppsScriptCode,
    handleCopyStaffAutoConnectLink,
    handleSaveAndCheckCloud,
    inputCls,
    isCheckingCloud,
    mutedText,
    needsSheetBinding,
    setCloudPin,
    setGasUrl,
    setShowCloudPin,
    setSpreadsheetIdInput,
    showCloudPin,
    spreadsheetIdInput,
    subBoxBg,
  } = ctx;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleCopyStaffAutoConnectLink}
          className="p-3.5 rounded-2xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-left flex items-center gap-3 cursor-pointer transition shadow-xs"
        >
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold truncate">
              전 직원 자동연결 링크 복사
            </div>
            <div className="text-[11px] opacity-85 truncate">
              단톡방 공유용 (관리자 PIN 제외)
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleCopyAppsScriptCode}
          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 cursor-pointer transition hover:border-[#1B64DA] ${cardBg}`}
        >
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 flex items-center justify-center shrink-0">
            <Copy className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold truncate">
              최신 Apps Script 코드 복사
            </div>
            <div className={`text-[11px] truncate ${mutedText}`}>
              Code.gs 붙여넣기 후 [새 버전 배포]
            </div>
          </div>
        </button>
      </div>

      <div className={`rounded-2xl border p-4 space-y-3.5 ${cardBg}`}>
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
          <h3 className="text-sm font-extrabold">비공개 구글 시트 연결 정보</h3>
        </div>

        {needsSheetBinding && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              아래 구글 시트 주소 칸에 기존 시트 URL을 입력한 뒤 [연결 저장 · 점검]을 눌러주세요.
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          <div>
            <label className={`block text-xs font-bold mb-1 ${mutedText}`}>
              Apps Script 웹앱 URL
            </label>
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className={`w-full px-3 py-2.5 rounded-xl border text-base sm:text-xs font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-xs font-bold mb-1 ${mutedText}`}>
                관리자 업로드 PIN
              </label>
              <div className="relative">
                <input
                  type={showCloudPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={cloudPin}
                  onChange={(e) => setCloudPin(e.target.value)}
                  placeholder="관리자 PIN 입력"
                  className={`w-full pl-3 pr-9 py-2.5 rounded-xl border text-base sm:text-xs font-mono font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => setShowCloudPin((v: boolean) => !v)}
                  aria-label="PIN 표시 전환"
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 cursor-pointer ${mutedText}`}
                >
                  {showCloudPin ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-xs font-bold ${mutedText}`}>
                  구글 시트 주소 또는 ID (선택)
                </label>
                {extractGoogleSheetId(spreadsheetIdInput) && (
                  <span className="text-[11px] font-mono font-bold text-[#059669] dark:text-emerald-300">
                    인식됨
                  </span>
                )}
              </div>
              <input
                type="text"
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={`w-full px-3 py-2.5 rounded-xl border text-base sm:text-xs font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isCheckingCloud}
            onClick={() => void handleSaveAndCheckCloud()}
            className="w-full py-2.5 px-4 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            {isCheckingCloud ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>연결 저장 · 상태 점검</span>
          </button>
        </div>

        {cloudDiag && cloudDiag.ok && (
          <div className={`p-3 rounded-xl border space-y-2.5 ${subBoxBg}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-extrabold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                <span>{cloudDiag.spreadsheetTitle || '비공개 구글 시트'}</span>
              </span>
              <span className={`font-mono font-bold ${mutedText}`}>
                초대 {cloudDiag.inviteCount ?? friendInvites.length}명 (등록{' '}
                {cloudDiag.boundInviteCount ?? 0}명)
              </span>
            </div>

            {cloudDiag.datasets && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(
                  [
                    { key: 'schedule', label: '휴무표', unit: '개월' },
                    { key: 'incentive', label: '모델수당', unit: '개월' },
                    { key: 'care', label: '안심케어', unit: '개' },
                    { key: 'installment', label: '무이자할부', unit: '카드' },
                  ] as const
                ).map(({ key, label, unit }) => {
                  const d = cloudDiag.datasets?.[key];
                  const ok = Boolean(d?.exists && d?.validJson);
                  return (
                    <div
                      key={key}
                      className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-1 ${cardBg}`}
                    >
                      <span className="font-bold">{label}</span>
                      <span
                        className={`font-mono font-extrabold text-[11px] ${
                          ok ? 'text-[#059669] dark:text-emerald-300' : mutedText
                        }`}
                      >
                        {ok ? `${d?.itemCount?.toLocaleString() || 0}${unit}` : '비어있음'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
