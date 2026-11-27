import React, { useState } from 'react';
import {
  Ban,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Loader2,
  MessageSquareHeart,
  MoreHorizontal,
  Send,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { formatFriendInviteCode, FriendInviteItem } from '../../utils/friendAccessGuard';
import { getStoredGeminiApiKey } from '../../utils/aiImageParser';

export const StoreAdminFriendInvitesPanel: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    busyInviteCodeId,
    cardBg,
    copiedInviteCodeId,
    editProfileDraft,
    editingNoticeCodeId,
    editingProfileCodeId,
    friendInvites,
    friendNoticesMap,
    friendLabelInput,
    friendPanelError,
    friendRemoteProfiles,
    friendScheduleMap,
    handleClearSharedAiKey,
    handleCopyFriendInviteGuide,
    handleCycleMaxDevices,
    handleIssueFriendInvite,
    handleMutateFriendInvite,
    handleClearFriendNotice,
    handleOpenFriendNoticeEditor,
    handleOpenRemoteProfileEditor,
    handleSaveFriendNotice,
    handleRefreshFriendInvites,
    handleSaveRemoteProfileForFriend,
    handleSaveSharedAiKey,
    handleToggleFriendAiAllowed,
    handleToggleFriendScheduleAllowed,
    handleToggleGlobalSharedAi,
    inputCls,
    isIssuingInvite,
    isLoadingInvites,
    isSavingFriendNotice,
    isSavingRemoteProfile,
    noticeDraftText,
    isSavingSharedAi,
    mutedText,
    newFriendMaxDevices,
    newFriendNameInput,
    newFriendPhoneInput,
    newFriendStoreInput,
    setEditProfileDraft,
    setEditingNoticeCodeId,
    setEditingProfileCodeId,
    setNoticeDraftText,
    setFriendLabelInput,
    setNewFriendMaxDevices,
    setNewFriendNameInput,
    setNewFriendPhoneInput,
    setNewFriendStoreInput,
    setSharedKeyDraft,
    sharedAiState,
    sharedKeyDraft,
    subBoxBg,
  } = ctx;

  const [showOptionalProfileFields, setShowOptionalProfileFields] = useState<boolean>(false);
  const [expandedManageCodeId, setExpandedManageCodeId] = useState<string | null>(null);
  const [showAiKeyEditor, setShowAiKeyEditor] = useState<boolean>(false);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 space-y-3 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
            <span>새 직원 · 지인 초대코드 발급</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowOptionalProfileFields((v) => !v)}
            className="text-xs font-bold text-[#1B64DA] dark:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>지점·연락처 미리 지정 (선택)</span>
            {showOptionalProfileFields ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={friendLabelInput}
            onChange={(e) => setFriendLabelInput(e.target.value)}
            placeholder="이름 또는 별칭 (예: 김직원)"
            className={`flex-1 px-3 py-2.5 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
          />
          <div className={`p-1 rounded-xl border inline-flex items-center gap-1 shrink-0 ${subBoxBg}`}>
            {[
              { val: 1, label: '1대' },
              { val: 2, label: '2대(폰+PC)' },
              { val: 3, label: '3대' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setNewFriendMaxDevices(opt.val)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition ${
                  newFriendMaxDevices === opt.val
                    ? 'bg-[#1B64DA] text-white'
                    : mutedText
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={isIssuingInvite}
            onClick={() => void handleIssueFriendInvite()}
            className="py-2.5 px-4 rounded-xl bg-[#191F28] hover:bg-slate-800 dark:bg-[#1B64DA] dark:hover:bg-blue-600 disabled:opacity-55 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
          >
            {isIssuingInvite ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            <span>초대코드 발급</span>
          </button>
        </div>

        {showOptionalProfileFields && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <input
              type="text"
              value={newFriendStoreInput}
              onChange={(e) => setNewFriendStoreInput(e.target.value)}
              placeholder="소속 지점명 (예: 롯데하이마트 수원점)"
              className={`px-3 py-2 rounded-xl border text-base sm:text-xs font-bold focus:outline-none focus:border-[#1B64DA] ${inputCls}`}
            />
            <input
              type="text"
              value={newFriendNameInput}
              onChange={(e) => setNewFriendNameInput(e.target.value)}
              placeholder="견적서 표기 담당자명"
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
        )}
      </div>

      <div className={`rounded-2xl border p-4 space-y-3 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold">초대 사용자 및 권한 관리</h3>
            <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold font-mono">
              {friendInvites.length}명
            </span>
          </div>
          <button
            type="button"
            disabled={isLoadingInvites}
            onClick={() => void handleRefreshFriendInvites()}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${subBoxBg}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInvites ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>

        {friendPanelError && (
          <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-xs font-bold">
            {friendPanelError}
          </div>
        )}

        {friendInvites.length === 0 ? (
          <div className={`px-4 py-6 rounded-xl border text-center text-xs font-medium ${subBoxBg} ${mutedText}`}>
            {isLoadingInvites
              ? '초대 사용자 목록을 불러오는 중입니다...'
              : '아직 발급된 초대코드가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {friendInvites.map((item: FriendInviteItem) => {
              const formattedCode = formatFriendInviteCode(item.inviteCode);
              const isBusy = busyInviteCodeId === item.codeId;
              const isCopied = copiedInviteCodeId === item.codeId;
              const isRevoked = item.status === 'REVOKED';
              const assignedProf = friendRemoteProfiles[item.codeId];
              const hasAssignedProf = Boolean(
                assignedProf &&
                  (assignedProf.storeName || assignedProf.consultantName || assignedProf.phone)
              );
              const isEditingThis = editingProfileCodeId === item.codeId;
              const isEditingNotice = editingNoticeCodeId === item.codeId;
              const activeNotice = friendNoticesMap?.[item.codeId];
              const hasActiveNotice = Boolean(activeNotice?.message);
              const isManageOpen = expandedManageCodeId === item.codeId;
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
              const schedAllowed =
                friendScheduleMap[item.codeId] !== undefined
                  ? friendScheduleMap[item.codeId] === true
                  : item.scheduleAllowed === true;

              const statusBadge = isRevoked
                ? {
                    text: '차단됨',
                    cls: 'bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border-[#FECDD3] dark:border-rose-500/35',
                  }
                : item.status === 'BOUND'
                ? {
                    text: `기기 ${boundCnt}/${maxDev}대`,
                    cls: 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/30',
                  }
                : {
                    text: `미등록 (0/${maxDev}대)`,
                    cls: 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/35',
                  };

              return (
                <div
                  key={item.codeId}
                  className={`p-3.5 rounded-2xl border space-y-2.5 transition ${subBoxBg}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold">{item.label}</span>
                        <span className="font-mono text-xs font-black tracking-wider text-[#1B64DA] dark:text-blue-300">
                          {formattedCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold font-mono ${statusBadge.cls}`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className={`text-[11px] font-medium truncate ${mutedText}`}>
                        {hasAssignedProf
                          ? `${assignedProf.storeName || '롯데하이마트'}${
                              assignedProf.consultantName ? ` · ${assignedProf.consultantName}` : ''
                            }`
                          : '기본 프로필(롯데하이마트)'}{' '}
                        · 최근 접속 {item.lastSeenAt || item.boundAt || '없음'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleFriendScheduleAllowed(item)}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                          schedAllowed && !isRevoked
                            ? 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-500/40'
                            : `${cardBg} ${mutedText}`
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>휴무표 {schedAllowed ? 'ON' : 'OFF'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || isSavingSharedAi}
                        onClick={() => void handleToggleFriendAiAllowed(item)}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                          friendAiAllowed && !isRevoked
                            ? 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border-[#BFDBFE] dark:border-blue-500/40'
                            : `${cardBg} ${mutedText}`
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5 shrink-0" />
                        <span>AI {friendAiAllowed ? 'ON' : 'OFF'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || isSavingFriendNotice}
                        onClick={() => handleOpenFriendNoticeEditor(item)}
                        title="해당 친구/직원이 통합앱을 켰을 때 1회 팝업으로 띄울 맞춤 멘트 설정"
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                          isEditingNotice
                            ? 'bg-amber-500 text-white border-amber-500'
                            : hasActiveNotice && !isRevoked
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/50'
                            : `${cardBg} ${mutedText}`
                        }`}
                      >
                        <MessageSquareHeart className="w-3.5 h-3.5 shrink-0" />
                        <span>{hasActiveNotice ? '1회 멘트 ON' : '1회 멘트'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleCopyFriendInviteGuide(item)}
                        className="py-1.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1552B5] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>복사됨</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>초대장 복사</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedManageCodeId((prev) =>
                            prev === item.codeId ? null : item.codeId
                          )
                        }
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                          isManageOpen ? 'border-[#1B64DA] text-[#1B64DA]' : `${cardBg} ${mutedText}`
                        }`}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <span>관리</span>
                      </button>
                    </div>
                  </div>

                  {isManageOpen && (
                    <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleCycleMaxDevices(item)}
                          className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${cardBg}`}
                        >
                          <Smartphone className="w-3.5 h-3.5 text-[#1B64DA]" />
                          <span>허용 기기수 변경 ({maxDev}대)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleOpenRemoteProfileEditor(item)}
                          className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${cardBg}`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#1B64DA]" />
                          <span>지점·이름 지정</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleMutateFriendInvite(item, 'reset_device')}
                          className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${cardBg}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>등록기기 초기화</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleMutateFriendInvite(
                              item,
                              isRevoked ? 'activate' : 'revoke'
                            )
                          }
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                            isRevoked
                              ? 'bg-[#059669] text-white'
                              : 'bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 border border-[#FECDD3] dark:border-rose-500/30'
                          }`}
                        >
                          {isRevoked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>차단 해제</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>접속 차단</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleMutateFriendInvite(item, 'delete')}
                          className={`p-1.5 rounded-lg border hover:text-[#E60012] cursor-pointer ${cardBg} ${mutedText}`}
                          title="초대코드 영구 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditingNotice && (
                    <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <MessageSquareHeart className="w-3.5 h-3.5" />
                          <span>
                            [{item.label}] 앱 실행 시 1회 노출 멘트 설정
                          </span>
                        </span>
                        {hasActiveNotice && activeNotice?.createdAt && (
                          <span className={`text-[11px] font-semibold ${mutedText}`}>
                            현재 등록됨 ({activeNotice.createdAt.slice(0, 16).replace('T', ' ')})
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={noticeDraftText || ''}
                        onChange={(e) => setNoticeDraftText(e.target.value)}
                        placeholder={`예) ${item.label}님! 12월부터 구독 건당 상품권 시상 기능이 추가되었으니 상단 상품권시상 버튼을 확인해 보세요 😊 (상대방이 앱을 켜면 팝업으로 딱 1번 뜨고 [확인]을 누르면 사라집니다)`}
                        className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-semibold leading-relaxed resize-y focus:outline-none focus:border-amber-500 ${inputCls}`}
                      />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          {hasActiveNotice && (
                            <button
                              type="button"
                              disabled={isSavingFriendNotice}
                              onClick={() => void handleClearFriendNotice(item)}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                            >
                              등록된 멘트 내리기
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => setEditingNoticeCodeId(null)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${cardBg}`}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={isSavingFriendNotice || !(noticeDraftText || '').trim()}
                            onClick={() => void handleSaveFriendNotice(item)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {hasActiveNotice ? '새 1회 멘트로 재발송' : '1회 멘트 등록·발송'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isEditingThis && (
                    <div className="pt-2.5 border-t border-[#E5E8EB] dark:border-white/10 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editProfileDraft.storeName}
                          onChange={(e) =>
                            setEditProfileDraft((d: any) => ({
                              ...d,
                              storeName: e.target.value,
                            }))
                          }
                          placeholder="소속 지점명 (예: 롯데하이마트 수원점)"
                          className={`px-3 py-2 rounded-lg border text-base sm:text-xs font-bold ${inputCls}`}
                        />
                        <input
                          type="text"
                          value={editProfileDraft.consultantName}
                          onChange={(e) =>
                            setEditProfileDraft((d: any) => ({
                              ...d,
                              consultantName: e.target.value,
                            }))
                          }
                          placeholder="담당자 이름"
                          className={`px-3 py-2 rounded-lg border text-base sm:text-xs font-bold ${inputCls}`}
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={editProfileDraft.phone}
                          onChange={(e) =>
                            setEditProfileDraft((d: any) => ({
                              ...d,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="연락처 (선택)"
                          className={`px-3 py-2 rounded-lg border text-base sm:text-xs font-bold font-mono ${inputCls}`}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingProfileCodeId(null)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${cardBg}`}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={isSavingRemoteProfile}
                          onClick={() => void handleSaveRemoteProfileForFriend(item)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#059669] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>원격 반영</span>
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

      <div className={`rounded-2xl border p-4 space-y-3 ${cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Bot className="w-4 h-4 text-[#1B64DA] dark:text-blue-300" />
            <span className="text-xs sm:text-sm font-extrabold">
              초대 사용자 Gemini AI 키 함께 쓰기
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                  ? 'bg-emerald-500/15 text-[#059669] dark:text-emerald-300'
                  : `${subBoxBg} ${mutedText}`
              }`}
            >
              {sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                ? '전체 공유 ON'
                : '공유 OFF'}
            </span>
            {sharedAiState.hasSharedKey && (
              <span className={`text-[11px] font-mono font-bold ${mutedText}`}>
                ({sharedAiState.maskedSharedKey})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAiKeyEditor((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${subBoxBg}`}
            >
              {sharedAiState.hasSharedKey ? '키 변경' : 'API 키 등록'}
            </button>
            <button
              type="button"
              disabled={isSavingSharedAi}
              onClick={() => void handleToggleGlobalSharedAi()}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                  ? 'bg-[#E60012] text-white'
                  : 'bg-[#059669] text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {sharedAiState.hasSharedKey && sharedAiState.globalEnabled
                  ? '공유 끄기'
                  : '공유 켜기'}
              </span>
            </button>
          </div>
        </div>

        {(showAiKeyEditor || !sharedAiState.hasSharedKey) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            {Boolean(getStoredGeminiApiKey()) && (
              <button
                type="button"
                disabled={isSavingSharedAi}
                onClick={() => void handleSaveSharedAiKey(true)}
                className="py-2 px-3 rounded-xl bg-[#1B64DA] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>내 기기 API 키 바로 연동</span>
              </button>
            )}
            <input
              type="password"
              value={sharedKeyDraft}
              onChange={(e) => setSharedKeyDraft(e.target.value)}
              placeholder="공유할 Gemini API 키 입력 (AIzaSy...)"
              className={`flex-1 px-3 py-2 rounded-xl border text-base sm:text-xs font-mono ${inputCls}`}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isSavingSharedAi || !sharedKeyDraft.trim()}
                onClick={() => void handleSaveSharedAiKey(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-extrabold cursor-pointer disabled:opacity-45 ${subBoxBg}`}
              >
                저장
              </button>
              {sharedAiState.hasSharedKey && (
                <button
                  type="button"
                  disabled={isSavingSharedAi}
                  onClick={() => void handleClearSharedAiKey()}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold hover:text-[#E60012] cursor-pointer ${subBoxBg} ${mutedText}`}
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
