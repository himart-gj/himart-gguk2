import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Gift,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  Truck,
  X,
} from 'lucide-react';
import { CustomerItem, FilterTab } from '../types/crm';
import {
  getBriefingSummary,
  getNotificationPermission,
  requestNotificationPermission,
  triggerDailyMorningNotification,
} from '../services/notificationService';
import { formatCurrency, getFollowUpInfo, getTodayStr } from '../utils/date';

interface MorningBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  onSelectFilter: (tab: FilterTab) => void;
  onOpenSMS: (customer: CustomerItem) => void;
  onToggleLogistics: (customer: CustomerItem) => void;
  onToggleGift: (customer: CustomerItem) => void;
}

export const MorningBriefingModal: React.FC<MorningBriefingModalProps> = ({
  isOpen,
  onClose,
  customers,
  onSelectFilter,
  onOpenSMS,
  onToggleLogistics,
  onToggleGift,
}) => {
  const [permStatus, setPermStatus] = useState(getNotificationPermission());
  const [pushSentMsg, setPushSentMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const summary = getBriefingSummary(customers);
  const todayStr = getTodayStr();

  const handleEnableNotification = async () => {
    const res = await requestNotificationPermission();
    setPermStatus(res);
    if (res === 'granted') {
      const ok = await triggerDailyMorningNotification(customers, true);
      setPushSentMsg(
        ok
          ? '✅ 휴대폰/브라우저 상단 알림으로 오늘의 브리핑을 발송했습니다!'
          : '알림 권한이 허용되었습니다.'
      );
    } else {
      setPushSentMsg(
        '⚠️ 브라우저 알림 권한이 차단되어 있습니다. 주소창 좌측 자물쇠 아이콘에서 알림을 허용해 주세요.'
      );
    }
  };

  const handleTestPush = async () => {
    if (permStatus !== 'granted') {
      await handleEnableNotification();
      return;
    }
    const ok = await triggerDailyMorningNotification(customers, true);
    setPushSentMsg(
      ok
        ? '📲 휴대폰 상단바(시스템 알림)로 오늘의 할 일 요약을 즉시 전송했습니다!'
        : '알림 전송에 실패했습니다.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  출근 모닝 브리핑 & 오늘의 할 일
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500 text-white">
                  총 {summary.totalActionCount}건 점검
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {todayStr} 기준 당일·내일 배송, 오늘 재연락 예정, 물류 미확정, 사은품 미지급 고객 자동 요약
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 휴대폰 푸시 알림 연동 배너 */}
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
            <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              {permStatus === 'granted'
                ? '휴대폰/PC 시스템 푸시 알림이 활성화되어 있습니다.'
                : '아침마다 휴대폰 상단바 알림으로 오늘 배송/할 일을 받아보세요!'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {permStatus !== 'granted' ? (
              <button
                type="button"
                onClick={handleEnableNotification}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition cursor-pointer"
              >
                🔔 휴대폰 알림 켜기
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestPush}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
              >
                📲 지금 상단바 알림 받기
              </button>
            )}
          </div>
          {pushSentMsg && (
            <div className="w-full text-[11px] font-bold text-indigo-700 bg-white/80 px-3 py-1.5 rounded-lg border border-indigo-200/60">
              {pushSentMsg}
            </div>
          )}
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 5대 핵심 요약 카운트 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-[11px] font-bold text-rose-700">
                🚨 오늘/내일 배송
              </div>
              <div className="text-xl font-black text-rose-700 mt-0.5">
                {summary.todayDelivery.length + summary.tomorrowDelivery.length}
                건
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
              <div className="text-[11px] font-bold text-indigo-700">
                📞 오늘 재연락
              </div>
              <div className="text-xl font-black text-indigo-700 mt-0.5">
                {summary.followUpToday.length}건
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-[11px] font-bold text-amber-800">
                🚚 물류 미확정(D-3)
              </div>
              <div className="text-xl font-black text-amber-800 mt-0.5">
                {summary.unconfirmedLogistics.length}건
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
              <div className="text-[11px] font-bold text-blue-700">
                📩 견적 미발송
              </div>
              <div className="text-xl font-black text-blue-700 mt-0.5">
                {summary.unsentQuotes.length}건
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-center">
              <div className="text-[11px] font-bold text-purple-700">
                🎁 사은품 미지급
              </div>
              <div className="text-xl font-black text-purple-700 mt-0.5">
                {summary.unpaidGifts.length}건
              </div>
            </div>
          </div>

          {/* 0. 오늘 재연락 예정 고객 (리마인드) */}
          {summary.followUpToday.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-indigo-600" />
                  📞 오늘 재연락 예정 고객 (리마인드) (
                  {summary.followUpToday.length}명)
                </h3>
                <span className="text-[11px] font-bold text-indigo-700">
                  혜택 마감 / 미결 클로징 필수!
                </span>
              </div>
              <div className="space-y-2">
                {summary.followUpToday.map((c) => {
                  const fInfo = getFollowUpInfo(c);
                  return (
                    <div
                      key={c.id}
                      className="bg-white p-3 rounded-xl border border-indigo-200/80 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white">
                            {fInfo.label}
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {c.name} 고객님
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            ({c.phone})
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                          {c.items} · 체감가 {formatCurrency(c.netAmount)}원
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                            className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            title="전화 걸기"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenSMS(c);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          리마인드 문자
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. 오늘/내일 배송 고객 리스트 */}
          {(summary.todayDelivery.length > 0 ||
            summary.tomorrowDelivery.length > 0) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  오늘·내일 배송 스케줄 점검 (
                  {summary.todayDelivery.length +
                    summary.tomorrowDelivery.length}
                  건)
                </h3>
                <span className="text-[11px] font-bold text-rose-600">
                  해피콜 / 설치안내 문자 필수!
                </span>
              </div>
              <div className="space-y-2">
                {[...summary.todayDelivery, ...summary.tomorrowDelivery].map(
                  (c) => {
                    const isToday = c.deliveryDate === todayStr;
                    return (
                      <div
                        key={c.id}
                        className="bg-white p-3 rounded-xl border border-rose-200/80 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isToday
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              {isToday ? '오늘배송 D-Day' : '내일배송 D-1'}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {c.name} 고객님
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              ({c.phone})
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-600 mt-1">
                            {c.items}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onToggleLogistics(c)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                              c.logisticsConfirmed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            {c.logisticsConfirmed ? '물류확정됨' : '물류미확정'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSMS(c);
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            배송문자
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* 2. 견적 미발송 & 미구매 고민 고객 */}
          {summary.unsentQuotes.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-blue-600" />
                  견적서 문자 미발송 고객 ({summary.unsentQuotes.length}명)
                </h3>
              </div>
              <div className="space-y-2">
                {summary.unsentQuotes.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white p-3 rounded-xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {c.name} 고객님
                        </span>
                        <span className="text-xs font-bold text-blue-600">
                          체감가 {formatCurrency(c.netAmount)}원
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{c.items}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSMS(c);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                      >
                        견적문자 발송
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 사은품 미지급 고객 */}
          {summary.unpaidGifts.length > 0 && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2.5">
              <h3 className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-purple-600" />
                배송완료 후 사은품 미지급 고객 ({summary.unpaidGifts.length}명)
              </h3>
              <div className="space-y-2">
                {summary.unpaidGifts.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white p-3 rounded-xl border border-purple-200/80 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-sm font-black text-slate-900">
                        {c.name} 고객님
                      </span>
                      <p className="text-xs font-bold text-purple-700 mt-0.5">
                        약속 사은품: {c.giftItems}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleGift(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      지급 완료 처리
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.totalActionCount === 0 && (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-base font-black text-slate-800">
                현재 밀린 긴급 배송이나 미발송 건이 없습니다!
              </h4>
              <p className="text-xs text-slate-500">
                오늘도 국지점 대박 실적을 응원합니다.
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectFilter('🔥긴급/오늘할일');
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
          >
            🔥 긴급/오늘할일 탭만 모아보기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
          >
            확인 후 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
