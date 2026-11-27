import React from 'react';
import {
  Calendar,
  CloudUpload,
  CreditCard,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import {
  downloadModelIncentiveExcelTemplate,
  getCurrentYearMonth,
  loadAllModelIncentiveSheets,
  stripPersonalLocalFromIncentiveMap,
} from '../../crm/utils/settlementEngine';

export const StoreAdminDatasetCardsGrid: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    cardBg,
    cardFeedback,
    careExcelRef,
    handleCareExcelUpload,
    handleCareResend,
    handleDeleteScheduleMonth,
    handleIncentiveExcelUpload,
    handleIncentivePhotoUpload,
    handleIncentiveResend,
    handleInstallmentResend,
    handleInstallmentUpload,
    handlePullAllDatasetsFromCloud,
    handleScheduleFileUpload,
    handleScheduleResend,
    hasValidCloudUrl,
    incentiveExcelRef,
    incentivePhotoRef,
    incentiveYm,
    initialFocus,
    inputCls,
    installmentFileRef,
    isPullingFromCloud,
    mergeIncentiveInMonth,
    mutedText,
    renderCardBadge,
    scheduleExcelRef,
    schedulePhotoRef,
    setIncentiveYm,
    setMergeIncentiveInMonth,
    subBoxBg,
    summaries,
  } = ctx;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className={`text-xs font-semibold ${mutedText}`}>
          파일을 올리면 비공개 구글 시트에 즉시 저장되어 연결된 기기에 자동 반영됩니다.
        </p>
        <button
          type="button"
          disabled={isPullingFromCloud || !hasValidCloudUrl}
          onClick={() => void handlePullAllDatasetsFromCloud?.()}
          className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition ${cardBg}`}
        >
          {isPullingFromCloud ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B64DA]" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-300" />
          )}
          <span>시트 최신자료 내 기기로 가져오기</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${cardBg} ${
            initialFocus === 'schedule' ? 'ring-2 ring-[#1B64DA] border-[#1B64DA]' : ''
          }`}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold truncate">월간 근무 · 휴무표</h3>
                  <p className={`text-xs font-medium truncate ${mutedText}`}>
                    {summaries.schedule.countText} · {summaries.schedule.updatedAt}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold font-mono shrink-0">
                {summaries.schedule.version}
              </span>
            </div>

            {summaries.schedule.months.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {summaries.schedule.months.map((item: { yearMonth: string; count: number }) => (
                  <span
                    key={item.yearMonth}
                    className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border text-[11px] font-mono font-bold ${subBoxBg}`}
                  >
                    <span>
                      {item.yearMonth} ({item.count}명)
                    </span>
                    <button
                      type="button"
                      disabled={cardFeedback.schedule.status === 'working'}
                      onClick={() => void handleDeleteScheduleMonth(item.yearMonth)}
                      aria-label={`${item.yearMonth} 휴무표 삭제`}
                      className="p-0.5 rounded hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 text-[#8B95A1] hover:text-[#E60012] cursor-pointer disabled:opacity-40"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {renderCardBadge('schedule')}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              ref={scheduleExcelRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              onChange={handleScheduleFileUpload}
              className="hidden"
            />
            <input
              ref={schedulePhotoRef}
              type="file"
              accept="image/*"
              onChange={handleScheduleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={cardFeedback.schedule.status === 'working'}
              onClick={() => scheduleExcelRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>엑셀 등록</span>
            </button>
            <button
              type="button"
              disabled={cardFeedback.schedule.status === 'working'}
              onClick={() => schedulePhotoRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>사진 등록</span>
            </button>
            <button
              type="button"
              disabled={
                cardFeedback.schedule.status === 'working' || !summaries.schedule.hasData
              }
              onClick={() => void handleScheduleResend()}
              title="시트로 다시 전송"
              className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition ${subBoxBg}`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${cardBg} ${
            initialFocus === 'incentive' ? 'ring-2 ring-[#059669] border-[#059669]' : ''
          }`}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold truncate">모델별 판매수당 단가표</h3>
                  <p className={`text-xs font-medium truncate ${mutedText}`}>
                    {summaries.incentive.countText} · {summaries.incentive.updatedAt}
                  </p>
                </div>
              </div>
              <input
                type="month"
                value={incentiveYm}
                onChange={(e) => setIncentiveYm(e.target.value || getCurrentYearMonth())}
                aria-label="단가표 대상 연월"
                className={`px-2 py-1 rounded-lg border text-xs font-mono font-extrabold shrink-0 ${inputCls}`}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mergeIncentiveInMonth}
                  onChange={(e) => setMergeIncentiveInMonth(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#059669] cursor-pointer"
                />
                <span className={mutedText}>기존 당월 모델에 병합 추가</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const officialSheets = stripPersonalLocalFromIncentiveMap(
                    loadAllModelIncentiveSheets()
                  );
                  void downloadModelIncentiveExcelTemplate(
                    incentiveYm,
                    officialSheets[incentiveYm]?.rules || []
                  );
                }}
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${subBoxBg}`}
              >
                <Download className="w-3 h-3" />
                <span>엑셀 양식</span>
              </button>
            </div>

            {renderCardBadge('incentive')}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              ref={incentiveExcelRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              multiple
              onChange={handleIncentiveExcelUpload}
              className="hidden"
            />
            <input
              ref={incentivePhotoRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleIncentivePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={cardFeedback.incentive.status === 'working'}
              onClick={() => incentiveExcelRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>엑셀 등록</span>
            </button>
            <button
              type="button"
              disabled={cardFeedback.incentive.status === 'working'}
              onClick={() => incentivePhotoRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>사진 등록</span>
            </button>
            <button
              type="button"
              disabled={
                cardFeedback.incentive.status === 'working' || !summaries.incentive.hasData
              }
              onClick={() => void handleIncentiveResend()}
              title="시트로 다시 전송"
              className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition ${subBoxBg}`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${cardBg} ${
            initialFocus === 'care' ? 'ring-2 ring-[#E60012] border-[#E60012]' : ''
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold truncate">안심케어 · 가전이사 조견표</h3>
                  <p className={`text-xs font-medium truncate ${mutedText}`}>
                    {summaries.care.version} · {summaries.care.updatedAt}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] text-xs font-extrabold font-mono shrink-0">
                {summaries.care.countText}
              </span>
            </div>

            {renderCardBadge('care')}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              ref={careExcelRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleCareExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={cardFeedback.care.status === 'working'}
              onClick={() => careExcelRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#E60012] hover:bg-[#C8000F] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>조견표 엑셀(.xlsx) 업로드</span>
            </button>
            <button
              type="button"
              disabled={cardFeedback.care.status === 'working' || !summaries.care.hasData}
              onClick={() => void handleCareResend()}
              title="시트로 다시 전송"
              className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition ${subBoxBg}`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${cardBg} ${
            initialFocus === 'installment'
              ? 'ring-2 ring-indigo-500 border-indigo-500'
              : ''
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold truncate">카드 무이자할부 행사표</h3>
                  <p className={`text-xs font-medium truncate ${mutedText}`}>
                    {summaries.installment.version} · {summaries.installment.updatedAt}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs font-extrabold font-mono shrink-0">
                {summaries.installment.countText}
              </span>
            </div>

            {renderCardBadge('installment')}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              ref={installmentFileRef}
              type="file"
              accept="image/*,.xlsx,.xls,.csv,.json"
              onChange={handleInstallmentUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={cardFeedback.installment.status === 'working'}
              onClick={() => installmentFileRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>이미지 · 엑셀 업로드</span>
            </button>
            <button
              type="button"
              disabled={
                cardFeedback.installment.status === 'working' ||
                !summaries.installment.hasData
              }
              onClick={() => void handleInstallmentResend()}
              title="시트로 다시 전송"
              className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer transition ${subBoxBg}`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
