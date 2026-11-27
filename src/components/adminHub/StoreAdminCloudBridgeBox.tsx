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


export const StoreAdminCloudBridgeBox: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    cardBg,
    cloudDiag,
    cloudPin,
    cloudVerified,
    friendInvites,
    gasUrl,
    handleCopyAppsScriptCode,
    handleCopyStaffAutoConnectLink,
    handlePullAllDatasetsFromCloud,
    handleSaveAndCheckCloud,
    hasValidCloudUrl,
    inputCls,
    isCheckingCloud,
    isPullingFromCloud,
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
    <>
              {/* 1) 상단 클라우드 연결 요약 바 + 독립형 시트 주소 연결 + 4대 자료 연동 실시간 검수 */}
              <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Cloud className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold truncate">
                      비공개 구글 시트 (Apps Script) 클라우드 브릿지
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                        hasValidCloudUrl
                          ? cloudVerified === false || needsSheetBinding
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300'
                          : 'bg-[#F2F4F6] dark:bg-slate-800 text-[#8B95A1]'
                      }`}
                    >
                      {hasValidCloudUrl
                        ? needsSheetBinding
                          ? '● 시트 주소 연결 필요'
                          : cloudVerified === true
                          ? '● 시트 연동 확인됨'
                          : '● URL 설정됨'
                        : '미설정'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      disabled={isPullingFromCloud || !hasValidCloudUrl}
                      onClick={() => void handlePullAllDatasetsFromCloud()}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${subBoxBg}`}
                      title="비공개 구글 시트에 저장된 최신 4대 자료를 내 기기로 즉시 동기화합니다"
                    >
                      {isPullingFromCloud ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B64DA]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-300" />
                      )}
                      <span>시트 자료 내 기기로 불러오기</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAppsScriptCode}
                      className="px-2.5 py-1.5 rounded-xl border border-[#1B64DA]/40 bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition hover:opacity-90"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Apps Script 코드 복사</span>
                    </button>
                  </div>
                </div>

                {/* 독립형 스크립트 시트 미연결 복구 안내 배너 */}
                {needsSheetBinding && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border-2 border-amber-400 dark:border-amber-500/50 text-amber-950 dark:text-amber-100 text-xs space-y-1.5">
                    <div className="font-extrabold text-[12.5px] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                      <span>
                        안심하세요! 기존에 초대한 친구 목록과 4대 자료는 구글 시트에 100% 그대로 살아있습니다!
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed font-semibold opacity-95">
                      현재 웹앱이 <strong>독립형 Apps Script</strong>여서 어떤 구글 시트를 읽을지 시트 주소만 알려주면 즉시 복구됩니다:
                      <br />
                      ① 아래 <strong>[연동할 비공개 구글 시트 주소(URL)]</strong> 칸에 기존 구글 시트 주소(<code>https://docs.google.com/spreadsheets/d/...</code>)를 붙여넣으세요. (시트가 기억 안 나면 Apps Script 좌측 시계 아이콘 <strong>[프로젝트 기록]</strong>에서 이전 코드의 시트 ID를 확인할 수 있습니다.)
                      <br />
                      ② 우측 상단 <strong>[Apps Script 코드 복사]</strong> 클릭 → <code>Code.gs</code>에 붙여넣기 → <strong>[배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포]</strong> 후 <strong>[연결 저장·검수]</strong>를 누르면 기존 초대 목록이 즉시 복구됩니다!
                    </p>
                  </div>
                )}

                {/* 대형 CTA: 전 직원 원클릭 자동연결 링크 복사 */}
                <button
                  type="button"
                  onClick={handleCopyStaffAutoConnectLink}
                  className="w-full py-3 px-3.5 sm:px-4 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition text-center leading-snug"
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span>
                    📋 전 직원 원클릭 자동연결 링크 복사{' '}
                    <span className="opacity-90 font-bold text-[11px] sm:text-xs">
                      (단톡방 공유 · PIN 제외)
                    </span>
                  </span>
                </button>

                {/* URL + PIN 입력 및 [연결 저장·검수] */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <input
                      type="url"
                      value={gasUrl}
                      onChange={(e) => setGasUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                  </div>
                  <div className="sm:col-span-4 relative">
                    <input
                      type={showCloudPin ? 'text' : 'password'}
                      inputMode="numeric"
                      value={cloudPin}
                      onChange={(e) => setCloudPin(e.target.value)}
                      placeholder="관리자 PIN (업로드 비밀번호)"
                      className={`w-full pl-3 pr-9 py-2 rounded-xl border text-base sm:text-xs font-mono font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCloudPin((v) => !v)}
                      aria-label="PIN 표시 전환"
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer ${mutedText}`}
                    >
                      {showCloudPin ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isCheckingCloud}
                    onClick={() => void handleSaveAndCheckCloud()}
                    className="sm:col-span-2 py-2 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    {isCheckingCloud ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>연결 저장·검수</span>
                  </button>
                </div>

                {/* 독립형 Apps Script 호환: 연동할 비공개 구글 시트 주소(URL) 또는 시트 ID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className={`text-[11px] font-extrabold ${mutedText}`}>
                      📊 연동할 비공개 구글 시트 주소(URL) 또는 시트 ID{' '}
                      <span className="opacity-80 font-semibold">
                        (독립형 Apps Script 사용 시 필수 · 시트 내부 확장프로그램 스크립트는 비워둬도 자동 인식)
                      </span>
                    </label>
                    {extractGoogleSheetId(spreadsheetIdInput) && (
                      <span className="text-[10.5px] font-mono font-bold text-[#059669] dark:text-emerald-300">
                        ✓ 시트ID 인식됨: {extractGoogleSheetId(spreadsheetIdInput).slice(0, 12)}...
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={spreadsheetIdInput}
                    onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                    placeholder="예: https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz.../edit"
                    className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono focus:outline-none ${
                      needsSheetBinding
                        ? 'border-2 border-amber-500 ring-2 ring-amber-400/30'
                        : 'focus:border-[#1B64DA]'
                    } ${inputCls}`}
                  />
                </div>

                {/* 실시간 시트 & 4대 자료 연동 검수 리포트 */}
                {cloudDiag && cloudDiag.ok && (
                  <div className={`p-2.5 sm:p-3 rounded-xl border space-y-2 ${subBoxBg}`}>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11.5px]">
                      <div className="flex items-center gap-1.5 flex-wrap font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                        <span>
                          시트 연동 검수 정상: <strong>{cloudDiag.spreadsheetTitle || '비공개 구글 시트'}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[#059669] dark:text-emerald-300 text-[10.5px] font-black">
                          {cloudDiag.bindingMode === 'standalone_id'
                            ? '독립형 시트ID 연결됨'
                            : '시트 내장 스크립트'}
                        </span>
                      </div>
                      <span className={`text-[11px] font-mono font-bold ${mutedText}`}>
                        초대코드 {cloudDiag.inviteCount ?? friendInvites.length}명 (등록 {cloudDiag.boundInviteCount ?? 0}명)
                      </span>
                    </div>

                    {cloudDiag.datasets && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                        {(
                          [
                            { key: 'schedule', label: '① 휴무표', unit: '개월' },
                            { key: 'incentive', label: '② 모델수당', unit: '개월' },
                            { key: 'care', label: '③ 안심케어', unit: '개 코드' },
                            { key: 'installment', label: '④ 무이자할부', unit: '개 카드' },
                          ] as const
                        ).map(({ key, label, unit }) => {
                          const d = cloudDiag.datasets?.[key];
                          const ok = Boolean(d?.exists && d?.validJson);
                          return (
                            <div
                              key={key}
                              className={`px-2.5 py-1.5 rounded-lg border flex flex-col justify-between ${
                                ok
                                  ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                  : cardBg
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 font-extrabold">
                                <span>{label}</span>
                                <span
                                  className={
                                    ok
                                      ? 'text-[#059669] dark:text-emerald-300'
                                      : mutedText
                                  }
                                >
                                  {ok ? '✓ 연동됨' : '비어있음'}
                                </span>
                              </div>
                              <div className={`text-[10.5px] font-mono truncate ${mutedText}`}>
                                {ok
                                  ? `${d?.itemCount?.toLocaleString() || 0}${unit} (${d?.chunks || 1}청크)`
                                  : d?.exists && !d?.validJson
                                  ? '⚠️ JSON 점검 필요'
                                  : '미업로드'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>


    </>
  );
};
