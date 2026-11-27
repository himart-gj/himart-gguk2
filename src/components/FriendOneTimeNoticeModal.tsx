import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import {
  isFriendRestrictedMode,
  readFriendSession,
} from '../utils/friendAccessGuard';
import {
  dismissFriendOneTimeNotice,
  FRIEND_ONE_TIME_NOTICE_EVENT,
  FriendOneTimeNotice,
  getPendingFriendOneTimeNotice,
  hydrateDismissedFriendNoticeIdsFromIdb,
} from '../utils/friendNoticeManager';
import { fetchStoreCloudDataset } from '../utils/storeCloudSync';

interface FriendOneTimeNoticeModalProps {
  isDark?: boolean;
}

export const FriendOneTimeNoticeModal: React.FC<
  FriendOneTimeNoticeModalProps
> = ({ isDark = false }) => {
  const [activeNotice, setActiveNotice] = useState<FriendOneTimeNotice | null>(
    () => (isFriendRestrictedMode() ? getPendingFriendOneTimeNotice() : null)
  );

  useEffect(() => {
    if (!isFriendRestrictedMode()) {
      setActiveNotice(null);
      return;
    }

    let cancelled = false;

    const checkCloudNotice = async () => {
      await hydrateDismissedFriendNoticeIdsFromIdb();
      const cachedPending = getPendingFriendOneTimeNotice();
      if (!cancelled && cachedPending) {
        setActiveNotice(cachedPending);
      }
      await fetchStoreCloudDataset('care', { bypassCache: true });
      if (!cancelled) {
        setActiveNotice(getPendingFriendOneTimeNotice());
      }
    };

    const handleNoticeEvent = (ev: Event) => {
      if (cancelled) return;
      const customEv = ev as CustomEvent<FriendOneTimeNotice | null>;
      if (customEv.detail !== undefined) {
        setActiveNotice(customEv.detail);
      } else {
        setActiveNotice(getPendingFriendOneTimeNotice());
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isFriendRestrictedMode()) {
        void checkCloudNotice();
      }
    };

    void checkCloudNotice();
    window.addEventListener(FRIEND_ONE_TIME_NOTICE_EVENT, handleNoticeEvent);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener(
        FRIEND_ONE_TIME_NOTICE_EVENT,
        handleNoticeEvent
      );
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!activeNotice || !isFriendRestrictedMode()) return null;

  const session = readFriendSession();
  const recipientLabel = session?.label ? `${session.label}님` : '사용자님';

  const handleConfirmDismiss = () => {
    const idToDismiss = activeNotice.noticeId;
    setActiveNotice(null);
    dismissFriendOneTimeNotice(idToDismiss);
  };

  const formattedDate = (() => {
    if (!activeNotice.createdAt) return '';
    const dt = new Date(activeNotice.createdAt);
    if (Number.isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(
      2,
      '0'
    )}.${String(dt.getDate()).padStart(2, '0')} ${String(
      dt.getHours()
    ).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[1350] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="전달된 안내 메시지"
    >
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#111827] border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-[#191F28]'
        }`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center gap-3 ${
            isDark
              ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/10 border-slate-800'
              : 'bg-gradient-to-r from-[#EFF6FF] to-indigo-50/70 border-blue-100'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-[#1B64DA] text-white flex items-center justify-center shadow-sm shrink-0">
            <MessageSquareHeart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#1B64DA]/15 text-[#1B64DA] dark:text-blue-300">
              <BellRing className="w-3 h-3" />
              <span>1회 알림 메시지</span>
            </div>
            <h3 className="mt-0.5 text-sm sm:text-base font-black truncate">
              {recipientLabel}께 도착한 안내 멘트
            </h3>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div
            className={`rounded-2xl border p-4 text-sm sm:text-[15px] leading-relaxed font-semibold whitespace-pre-wrap break-words max-h-[52vh] overflow-y-auto ${
              isDark
                ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                : 'bg-[#F8FAFC] border-[#E5E8EB] text-[#191F28]'
            }`}
          >
            {activeNotice.message}
          </div>

          {formattedDate && (
            <div
              className={`text-[11px] font-medium text-right ${
                isDark ? 'text-slate-400' : 'text-[#6B7684]'
              }`}
            >
              전송 시각: {formattedDate} · 확인 시 다시 표시되지 않습니다
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmDismiss}
            className="w-full py-3 rounded-2xl bg-[#1B64DA] hover:bg-[#1552B5] text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>확인했습니다</span>
          </button>
        </div>
      </div>
    </div>
  );
};
