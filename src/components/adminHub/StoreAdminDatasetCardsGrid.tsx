import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudUpload,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import {
  CloudDiagnosticsReport,
  diagnoseStoreCloudConnection,
  extractGoogleSheetId,
  loadSavedSpreadsheetId,
  saveCloudSharedGeminiConfig,
  saveSpreadsheetId,
  SharedGeminiAdminState,
  StoreCloudKind,
  buildStaffAutoConnectUrl,
  clearStoreCloudMicroCache,
  deleteFriendRemoteProfile,
  fetchAllFriendRemoteProfiles,
  fetchFriendScheduleMap,
  fetchStoreCloudDataset,
  saveFriendSchedulePermission,
  FriendRemoteProfile,
  getStoreCloudAppsScriptCode,
  normalizeGasWebAppUrl,
  OWNER_CUSTOM_PIN_STORAGE_KEY,
  readRawSyncConfig,
  saveFriendRemoteProfile,
  saveStoreCloudDataset,
  STORE_CLOUD_UPDATED_EVENT,
  UNCONFIGURED_PIN_SENTINEL,
} from '../../utils/storeCloudSync';
import {
  buildFriendInviteUrl,
  fetchFriendInviteList,
  formatFriendInviteCode,
  FriendInviteItem,
  issueNewFriendInvite,
  mutateFriendInviteStatus,
} from '../../utils/friendAccessGuard';
import {
  ADMIN_MODE_CHANGED_EVENT,
  ADMIN_PIN_CODE,
  CARE_TABLE_UPDATED_EVENT,
  fetchRemoteCareDataset,
  isAdminDevice,
  loadLocalCareDataset,
  parseCareExcelBuffer,
  refreshAdminPinBinding,
  saveGitHubSyncConfig,
  saveLocalCareDataset,
  setAdminDeviceUnlocked,
} from '../../utils/careTableParser';
import {
  loadAllSchedules,
  parseScheduleFileForHub,
  saveAllSchedules,
  SCHEDULE_UPDATED_EVENT,
} from '../ScheduleModal';
import {
  downloadModelIncentiveExcelTemplate,
  getCurrentYearMonth,
  loadAllModelIncentiveSheets,
  mergeModelIncentiveRules,
  MODEL_INCENTIVE_UPDATED_EVENT,
  parseModelIncentiveExcelWithMeta,
  parseModelIncentiveImage,
  saveAllModelIncentiveSheets,
  stripPersonalLocalFromIncentiveMap,
} from '../../crm/utils/settlementEngine';
import { fetchRemoteModelIncentiveSheets } from '../../crm/utils/settlementSheetParser';
import { ModelIncentiveRule, ModelIncentivesMap } from '../../crm/types/crm';
import {
  DEFAULT_INSTALLMENT_DATASET,
  fetchRemoteInstallmentDataset,
  INSTALLMENT_UPDATED_EVENT,
  loadLocalInstallmentDataset,
  parseInstallmentFile,
  saveLocalInstallmentDataset,
} from '../../utils/installmentParser';
import { getStoredGeminiApiKey } from '../../utils/aiImageParser';
import { isOwnerMarketingDbUnlocked } from '../../utils/marketingDbEngine';


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
    handleScheduleFileUpload,
    handleScheduleResend,
    incentiveExcelRef,
    incentivePhotoRef,
    incentiveYm,
    initialFocus,
    inputCls,
    installmentFileRef,
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
    <>
              {/* 2) 4대 자료 원스톱 업로드 카드 그리드 (모바일 1열 / 펼친화면·PC 2열) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* ==================== 카드 ① 월간 근무·휴무표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'schedule'
                      ? 'ring-2 ring-[#1B64DA] border-[#1B64DA]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ① 월간 근무·휴무표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_휴무표
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[11px] font-black font-mono shrink-0">
                        {summaries.schedule.version}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>등록 건수</div>
                        <div className="font-extrabold font-mono tabular-nums truncate">
                          {summaries.schedule.countText}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.schedule.updatedAt}
                        </div>
                      </div>
                    </div>

                    {summaries.schedule.months.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>
                          등록된 월별 휴무표 (최근 12개월 자동 보관 · × 클릭 시 시트에서 삭제)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {summaries.schedule.months.map((item) => (
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
                                onClick={() =>
                                  void handleDeleteScheduleMonth(item.yearMonth)
                                }
                                title={`${item.yearMonth} 휴무표 삭제`}
                                aria-label={`${item.yearMonth} 휴무표 삭제`}
                                className="p-0.5 rounded hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 text-[#8B95A1] hover:text-[#E60012] dark:hover:text-rose-300 cursor-pointer disabled:opacity-40 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {renderCardBadge('schedule')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
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
                      className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      <span>엑셀 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={cardFeedback.schedule.status === 'working'}
                      onClick={() => schedulePhotoRef.current?.click()}
                      className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>사진 AI 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.schedule.status === 'working' ||
                        !summaries.schedule.hasData
                      }
                      onClick={() => void handleScheduleResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                      title="현재 기기에 저장된 휴무표를 비공개 구글 시트로 재전송"
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ② 모델별 판매수당 단가표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'incentive'
                      ? 'ring-2 ring-[#059669] border-[#059669]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ② 모델별 판매수당 단가표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_수당단가표
                          </p>
                        </div>
                      </div>
                      <input
                        type="month"
                        value={incentiveYm}
                        onChange={(e) =>
                          setIncentiveYm(e.target.value || getCurrentYearMonth())
                        }
                        aria-label="단가표 대상 연월"
                        className={`px-2 py-1 rounded-lg border text-base sm:text-[11.5px] font-mono font-extrabold shrink-0 max-w-full ${inputCls}`}
                      />
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>
                          {incentiveYm} 등록 건수
                        </div>
                        <div className="font-extrabold font-mono tabular-nums truncate">
                          {summaries.incentive.countText}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.incentive.updatedAt}
                        </div>
                      </div>
                    </div>

                    <label className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={mergeIncentiveInMonth}
                        onChange={(e) => setMergeIncentiveInMonth(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[#059669] cursor-pointer"
                      />
                      <span className={mutedText}>
                        기존 당월 목록에 추가 병합{' '}
                        <span className="opacity-75 font-medium">
                          (미체크 시 선택 월 100% 클린 교체)
                        </span>
                      </span>
                    </label>

                    {renderCardBadge('incentive')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
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
                      className="flex-1 min-w-[115px] py-2 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>엑셀·시트 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={cardFeedback.incentive.status === 'working'}
                      onClick={() => incentivePhotoRef.current?.click()}
                      className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>사진 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.incentive.status === 'working' ||
                        !summaries.incentive.hasData
                      }
                      onClick={() => void handleIncentiveResend()}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>재전송</span>
                    </button>
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
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition ${subBoxBg}`}
                      title="모델별 수당 엑셀 양식 다운로드"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>양식</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ③ 안심케어서비스 조견표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'care'
                      ? 'ring-2 ring-[#E60012] border-[#E60012]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ③ 안심케어서비스 조견표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_안심케어
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-[#FF3B47] text-[11px] font-black font-mono shrink-0">
                        {summaries.care.countText}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>적용 버전</div>
                        <div className="font-extrabold truncate">
                          {summaries.care.version}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.care.updatedAt}
                        </div>
                      </div>
                    </div>

                    {renderCardBadge('care')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
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
                      className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-[#E60012] hover:bg-[#C8000F] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>조견표 엑셀(.xlsx) 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.care.status === 'working' ||
                        !summaries.care.hasData
                      }
                      onClick={() => void handleCareResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 카드 ④ 카드 무이자할부 행사표 ==================== */}
                <div
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition ${cardBg} ${
                    initialFocus === 'installment'
                      ? 'ring-2 ring-indigo-500 border-indigo-500'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            ④ 카드 무이자할부 행사표
                          </h3>
                          <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                            시트 탭: _매장공유_무이자할부
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[11px] font-black font-mono shrink-0">
                        {summaries.installment.countText}
                      </span>
                    </div>

                    <div
                      className={`mt-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[11.5px] ${subBoxBg}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>행사 기준</div>
                        <div className="font-extrabold truncate">
                          {summaries.installment.version}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-bold ${mutedText}`}>마지막 반영</div>
                        <div className="font-bold font-mono tabular-nums truncate">
                          {summaries.installment.updatedAt}
                        </div>
                      </div>
                    </div>

                    {renderCardBadge('installment')}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
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
                      className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>이미지·엑셀 업로드</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cardFeedback.installment.status === 'working' ||
                        !summaries.installment.hasData
                      }
                      onClick={() => void handleInstallmentResend()}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer transition ${subBoxBg}`}
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      <span>시트 재전송</span>
                    </button>
                  </div>
                </div>
              </div>

    </>
  );
};
