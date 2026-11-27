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


export const StoreAdminFriendInvitesPanel: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    busyInviteCodeId,
    cardBg,
    copiedInviteCodeId,
    editProfileDraft,
    editingProfileCodeId,
    friendInvites,
    friendLabelInput,
    friendPanelError,
    friendRemoteProfiles,
    friendScheduleMap,
    handleClearSharedAiKey,
    handleCopyFriendInviteGuide,
    handleCycleMaxDevices,
    handleIssueFriendInvite,
    handleMutateFriendInvite,
    handleOpenRemoteProfileEditor,
    handleRefreshFriendInvites,
    handleSaveRemoteProfileForFriend,
    handleSaveSharedAiKey,
    handleToggleFriendAiAllowed,
    handleToggleFriendScheduleAllowed,
    handleToggleGlobalSharedAi,
    inputCls,
    isFriendListCollapsed,
    isIssuingInvite,
    isLoadingInvites,
    isSavingRemoteProfile,
    isSavingSharedAi,
    mutedText,
    newFriendMaxDevices,
    newFriendNameInput,
    newFriendPhoneInput,
    newFriendStoreInput,
    setEditProfileDraft,
    setEditingProfileCodeId,
    setFriendLabelInput,
    setIsFriendListCollapsed,
    setNewFriendMaxDevices,
    setNewFriendNameInput,
    setNewFriendPhoneInput,
    setNewFriendStoreInput,
    setSharedKeyDraft,
    sharedAiState,
    sharedKeyDraft,
    subBoxBg,
  } = ctx;
  return (
    <>
              {/* 1-B) 외부 지인(친구) 전용 기기 잠금 초대코드 & 내 API 키 공유 관리 패널 */}
              <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3.5 ${cardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold">
                        🔐 외부 지인(친구) 전용 초대코드 & 내 API 키 함께 쓰기 관리
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[10.5px] font-black">
                        총 {friendInvites.length}명
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium mt-0.5 ${mutedText}`}>
                      허용된 기기 대수(1대 폰 전용 / 2대 폰+PC)만큼만 귀속되며, 내 랜딩페이지·휴무표·네이버지도는 완전 분리됩니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                    {friendInvites.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsFriendListCollapsed((v) => !v)}
                        className={`px-3 py-1.5 rounded-xl border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition ${
                          isFriendListCollapsed
                            ? 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/35'
                            : subBoxBg
                        }`}
                      >
                        {isFriendListCollapsed ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>목록 펼치기 ({friendInvites.length}명)</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>목록 접기</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isLoadingInvites}
                      onClick={() => void handleRefreshFriendInvites()}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${subBoxBg}`}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isLoadingInvites ? 'animate-spin' : ''
                        }`}
                      />
                      <span>새로고침</span>
                    </button>
                  </div>
                </div>

                {/* ==================== 🤖 초대한 친구 내 Gemini API 키 공유 ON / OFF 컨트롤 박스 ==================== */}
                <div
                  className={`p-3 rounded-xl border space-y-2.5 ${
                    sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                      ? 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/35'
                      : subBoxBg
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Bot className="w-4 h-4 text-[#1B64DA] dark:text-blue-300 shrink-0" />
                        <span className="text-xs font-extrabold">
                          초대한 친구들 내 Gemini API 키 함께 쓰기
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-black border ${
                            sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-slate-500/15 text-[#4E5968] dark:text-slate-300 border-slate-400/30'
                          }`}
                        >
                          {sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                            ? '● 전체 공유 ON'
                            : '○ 공유 OFF'}
                        </span>
                        {sharedAiState.hasSharedKey && (
                          <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 border border-[#D1D6DB] dark:border-slate-700 font-mono text-[10.5px] font-bold">
                            공유키: {sharedAiState.maskedSharedKey}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] font-medium leading-snug ${mutedText}`}>
                        ON 시 허용된 친구 기기 메모리에만 임시 연결되며(친구 화면·저장소 키 노출 0%), OFF 전환 즉시 모든 친구 기기에서 차단됩니다. (AI Ultra 월 $40 무료 크레딧 보호 저비용 모델 <code>gemini-3.8-flash</code> · <code>3.5-flash-lite</code> · <code>4-hydrogen</code> 자동 작동)
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingSharedAi}
                      onClick={() => void handleToggleGlobalSharedAi()}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shrink-0 ${
                        sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                          ? 'bg-[#E60012] hover:bg-[#C8000F] text-white'
                          : 'bg-[#059669] hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isSavingSharedAi ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                          ? '전체 API 키 공유 OFF 하기'
                          : '전체 API 키 공유 ON 켜기'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {Boolean(getStoredGeminiApiKey()) && (
                      <button
                        type="button"
                        disabled={isSavingSharedAi}
                        onClick={() => void handleSaveSharedAiKey(true)}
                        className="py-2 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-[11.5px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
                      >
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                        <span>⚡ 내 기기 저장 API 키 바로 연동</span>
                      </button>
                    )}

                    <input
                      type="password"
                      value={sharedKeyDraft}
                      onChange={(e) => setSharedKeyDraft(e.target.value)}
                      placeholder={
                        sharedAiState.hasSharedKey
                          ? '다른 Gemini API 키로 변경하려면 입력 (AIzaSy...)'
                          : '공유할 Gemini API 키 직접 입력 (AIzaSy...)'
                      }
                      className={`flex-1 px-3 py-1.5 rounded-xl border text-base sm:text-xs font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isSavingSharedAi || !sharedKeyDraft.trim()}
                        onClick={() => void handleSaveSharedAiKey(false)}
                        className={`py-1.5 px-3 rounded-xl border text-[11.5px] font-extrabold cursor-pointer disabled:opacity-45 transition ${cardBg}`}
                      >
                        키 저장
                      </button>
                      {sharedAiState.hasSharedKey && (
                        <button
                          type="button"
                          disabled={isSavingSharedAi}
                          onClick={() => void handleClearSharedAiKey()}
                          className={`py-1.5 px-2.5 rounded-xl border text-[11.5px] font-bold hover:text-[#E60012] cursor-pointer disabled:opacity-45 transition ${cardBg} ${mutedText}`}
                        >
                          공유키 삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 별칭 + 초기 지점명·담당자(선택) + 허용 기기수(1대/2대 폰+PC/3대) + [+ 8자리 코드 발급] */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={friendLabelInput}
                      onChange={(e) => setFriendLabelInput(e.target.value)}
                      placeholder="관리용 별칭 (예: 친구1)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={newFriendStoreInput}
                      onChange={(e) => setNewFriendStoreInput(e.target.value)}
                      placeholder="소속 지점명 (선택, 예: 롯데하이마트 수원점)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={newFriendNameInput}
                      onChange={(e) => setNewFriendNameInput(e.target.value)}
                      placeholder="담당자 이름 (선택, 예: 홍길동)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={newFriendPhoneInput}
                      onChange={(e) => setNewFriendPhoneInput(e.target.value)}
                      placeholder="담당자 연락처 (선택)"
                      className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-extrabold ${mutedText}`}>
                        허용 기기수:
                      </span>
                      {[
                        { val: 1, label: '📱 1대 (폰 전용)' },
                        { val: 2, label: '📱+💻 2대 (폰+PC)' },
                        { val: 3, label: '3대' },
                      ].map((opt) => {
                        const active = newFriendMaxDevices === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setNewFriendMaxDevices(opt.val)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold cursor-pointer transition ${
                              active
                                ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                                : `${subBoxBg} hover:border-[#1B64DA]`
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={isIssuingInvite}
                      onClick={() => void handleIssueFriendInvite()}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-55 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      {isIssuingInvite ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>+ 8자리 초대코드 발급 ({newFriendMaxDevices}대)</span>
                    </button>
                  </div>
                  <p className={`text-[11px] font-semibold break-keep ${mutedText}`}>
                    💡 한 친구가 <strong>휴대폰 + 컴퓨터(PC)</strong>를 같이 쓰길 원하면 <strong>[📱+💻 2대 (폰+PC)]</strong>로 설정하세요! 코드 1개로 폰과 PC 2대까지 등록되며, 친구별로 <strong>[🤖 AI공유 ON/OFF]</strong>도 개별 제어할 수 있습니다.
                  </p>
                </div>

                {friendPanelError && (
                  <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-[11.5px] font-bold">
                    ⚠️ {friendPanelError}
                  </div>
                )}

                {/* 발급된 초대코드 목록 (접기/펼치기 지원) */}
                {friendInvites.length === 0 ? (
                  <div
                    className={`px-3.5 py-3 rounded-xl border text-xs font-medium ${subBoxBg} ${mutedText}`}
                  >
                    {isLoadingInvites
                      ? '비공개 구글 시트에서 초대코드 목록을 불러오는 중입니다...'
                      : '발급된 외부 지인용 초대코드가 없습니다. 위에서 별칭과 허용 기기수를 선택한 뒤 [+ 8자리 초대코드 발급]을 눌러주세요.'}
                  </div>
                ) : isFriendListCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsFriendListCollapsed(false)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 cursor-pointer transition hover:border-[#1B64DA] ${subBoxBg}`}
                  >
                    <span className="truncate">
                      👥 발급된 초대코드 총 <strong>{friendInvites.length}명</strong> 목록이 접혀 있습니다 ({friendInvites.map((f) => f.label).slice(0, 4).join(', ')}{friendInvites.length > 4 ? ' 외' : ''})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#1B64DA] dark:text-blue-300 shrink-0">
                      <span>펼치기</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {friendInvites.map((item) => {
                      const formattedCode = formatFriendInviteCode(item.inviteCode);
                      const isBusy = busyInviteCodeId === item.codeId;
                      const isCopied = copiedInviteCodeId === item.codeId;
                      const isRevoked = item.status === 'REVOKED';
                      const assignedProf = friendRemoteProfiles[item.codeId];
                      const hasAssignedProf = Boolean(
                        assignedProf &&
                          (assignedProf.storeName ||
                            assignedProf.consultantName ||
                            assignedProf.phone)
                      );
                      const isEditingThis = editingProfileCodeId === item.codeId;
                      const maxDev = Math.max(1, item.maxDevices || 1);
                      const boundCnt =
                        typeof item.boundDeviceCount === 'number'
                          ? item.boundDeviceCount
                          : item.status === 'BOUND'
                          ? 1
                          : 0;
                      const friendAiAllowed =
                        sharedAiState.friendAiMap[item.codeId] !== undefined
                          ? sharedAiState.friendAiMap[item.codeId] !== false
                          : item.aiAllowed !== false;
                      const friendAiEffectivelyActive =
                        sharedAiState.hasSharedKey &&
                        sharedAiState.globalEnabled &&
                        friendAiAllowed &&
                        !isRevoked;
                      const statusBadge =
                        item.status === 'BOUND'
                          ? {
                              text:
                                boundCnt < maxDev
                                  ? `${boundCnt}/${maxDev}대 등록 (추가등록 가능)`
                                  : `${boundCnt}/${maxDev}대 등록잠금`,
                              cls: 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/30',
                            }
                          : item.status === 'REVOKED'
                          ? {
                              text: '차단됨 REVOKED',
                              cls: 'bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border-[#FECDD3] dark:border-rose-500/35',
                            }
                          : {
                              text: `대기중 (0/${maxDev}대)`,
                              cls: 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/35',
                            };

                      return (
                        <div
                          key={item.codeId}
                          className={`p-3 rounded-xl border space-y-2.5 ${subBoxBg}`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-black tracking-wider text-[#1B64DA] dark:text-blue-300">
                                  {formattedCode}
                                </span>
                                <span className="text-xs font-extrabold">
                                  {item.label}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black ${statusBadge.cls}`}
                                >
                                  {statusBadge.text}
                                </span>
                                {hasAssignedProf ? (
                                  <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/20 border border-[#BFDBFE] dark:border-blue-500/35 text-[#1B64DA] dark:text-blue-200 text-[11px] font-extrabold">
                                    📍 {assignedProf.storeName || '롯데하이마트'}
                                    {assignedProf.consultantName
                                      ? ` · 👤 ${assignedProf.consultantName}`
                                      : ''}
                                    {assignedProf.phone
                                      ? ` · ${assignedProf.phone}`
                                      : ''}
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[11px] font-semibold ${mutedText}`}
                                  >
                                    (지점·이름 원격 미지정 · 기본 표기: 롯데하이마트)
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[11px] font-medium flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono tabular-nums ${mutedText}`}
                              >
                                <span>
                                  최근 접속: {item.lastSeenAt || item.boundAt || '미접속'}
                                </span>
                                {item.createdAt && (
                                  <span>· 발급: {item.createdAt}</span>
                                )}
                                {item.boundDevicePreview && (
                                  <span>· 기기ID: {item.boundDevicePreview}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isBusy || isSavingSharedAi}
                                onClick={() => void handleToggleFriendAiAllowed(item)}
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                  friendAiAllowed
                                    ? friendAiEffectivelyActive
                                      ? 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/40'
                                      : 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/40'
                                    : `${cardBg} ${mutedText}`
                                }`}
                                title="이 친구에게만 내 Gemini API 키 공유를 개별 허용(ON)하거나 차단(OFF)합니다"
                              >
                                <Bot className="w-3 h-3 shrink-0" />
                                <span>
                                  {friendAiAllowed ? 'AI공유 ON' : 'AI공유 OFF'}
                                </span>
                              </button>

                              {(() => {
                                const schedAllowed =
                                  friendScheduleMap[item.codeId] !== undefined
                                    ? friendScheduleMap[item.codeId] === true
                                    : item.scheduleAllowed === true;
                                return (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleToggleFriendScheduleAllowed(item)
                                    }
                                    className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                      schedAllowed && !isRevoked
                                        ? 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/40'
                                        : `${cardBg} ${mutedText}`
                                    }`}
                                    title="초대하여 사용 중인 직원에게 경기광주점 근무·휴무표를 읽기 전용으로 공유할지(ON) 숨길지(OFF) 전환합니다"
                                  >
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    <span>
                                      {schedAllowed ? '휴무표 ON' : '휴무표 OFF'}
                                    </span>
                                  </button>
                                );
                              })()}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleCycleMaxDevices(item)}
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${cardBg}`}
                                title="클릭할 때마다 허용 기기수를 1대(휴대폰) → 2대(폰+PC) → 3대로 변경합니다"
                              >
                                <Smartphone className="w-3 h-3 shrink-0 text-[#1B64DA] dark:text-blue-300" />
                                <span>허용 {maxDev}대 변경</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleOpenRemoteProfileEditor(item)}
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                  isEditingThis
                                    ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-blue-600 dark:border-blue-500'
                                    : `${cardBg} text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/40`
                                }`}
                                title="이미 설치·등록된 친구 기기의 고객 견적서 지점명·이름·연락처를 원격으로 지정하거나 수정합니다"
                              >
                                <Pencil className="w-3 h-3 shrink-0" />
                                <span>지점·이름 원격수정</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleCopyFriendInviteGuide(item)}
                                className="py-1.5 px-2.5 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                    <span>복사됨!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 shrink-0" />
                                    <span>초대 안내문 복사</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(item, 'reset_device')
                                }
                                className={`py-1.5 px-2.5 rounded-lg border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${cardBg}`}
                                title="휴대폰 기기변경 시 기존 귀속을 풀어 새 휴대폰 1대를 다시 등록할 수 있게 초기화"
                              >
                                <RotateCcw className="w-3 h-3 shrink-0" />
                                <span>기기 초기화</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(
                                    item,
                                    isRevoked ? 'activate' : 'revoke'
                                  )
                                }
                                className={`py-1.5 px-2.5 rounded-lg text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                                  isRevoked
                                    ? 'bg-[#059669] hover:bg-emerald-700 text-white'
                                    : 'bg-[#E60012] hover:bg-[#C8000F] text-white'
                                }`}
                              >
                                {isRevoked ? (
                                  <>
                                    <Unlock className="w-3 h-3 shrink-0" />
                                    <span>차단 해제</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3 shrink-0" />
                                    <span>즉시 차단</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMutateFriendInvite(item, 'delete')
                                }
                                aria-label="초대코드 삭제"
                                title="초대코드 영구 삭제"
                                className={`p-1.5 rounded-lg border cursor-pointer disabled:opacity-50 hover:text-[#E60012] transition ${cardBg} ${mutedText}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditingThis && (
                            <div
                              className={`pt-2.5 border-t border-[#E5E8EB] dark:border-white/10 space-y-2`}
                            >
                              <div className="text-[11.5px] font-extrabold text-[#1B64DA] dark:text-blue-300">
                                ✏️ [{item.label}] 고객 견적서 표기 프로필 원격 지정 (이미 설치한 친구 기기에도 자동 동기화)
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    소속 지점명
                                  </label>
                                  <input
                                    type="text"
                                    value={editProfileDraft.storeName}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        storeName: e.target.value,
                                      }))
                                    }
                                    placeholder="예: 롯데하이마트 수원점"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    담당자 이름
                                  </label>
                                  <input
                                    type="text"
                                    value={editProfileDraft.consultantName}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        consultantName: e.target.value,
                                      }))
                                    }
                                    placeholder="예: 홍길동"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold mb-1 opacity-80">
                                    담당자 직통 연락처 (선택)
                                  </label>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={editProfileDraft.phone}
                                    onChange={(e) =>
                                      setEditProfileDraft((d) => ({
                                        ...d,
                                        phone: e.target.value,
                                      }))
                                    }
                                    placeholder="010-0000-0000"
                                    className={`w-full px-3 py-2 rounded-lg border text-base sm:text-xs font-bold font-mono focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={isSavingRemoteProfile}
                                  onClick={() => setEditingProfileCodeId(null)}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${cardBg}`}
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingRemoteProfile}
                                  onClick={() =>
                                    void handleSaveRemoteProfileForFriend(item)
                                  }
                                  className="px-3.5 py-1.5 rounded-lg bg-[#059669] hover:bg-emerald-700 disabled:opacity-55 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  {isSavingRemoteProfile ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>친구 기기에 원격 반영</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


    </>
  );
};
