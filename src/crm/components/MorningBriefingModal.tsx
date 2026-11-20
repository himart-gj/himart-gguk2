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
} from 'lucide-react';
import { CustomerItem, FilterTab } from '../types/crm';
import {
  getBriefingSummary,
  getNotificationPermission,
  requestNotificationPermission,
  triggerDailyMorningNotification,
} from '../services/notificationService';
import { formatCurrency, getFollowUpInfo, getTodayStr } from '../utils/date';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';
import { KpiMetricStrip } from '../../components/ui/KpiMetricStrip';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

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
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title="출근 모닝 브리핑 & 오늘의 할 일"
      badge={`총 ${summary.totalActionCount}건 점검`}
      subtitle={`${todayStr} 기준 당일·내일 배송, 오늘 재연락 예정, 물류 미확정, 사은품 미지급 고객 자동 요약`}
      icon={
        <BellRing
          className={`w-4 h-4 text-[#E60012] dark:text-[#FF3B47] ${
            summary.totalActionCount > 0 ? 'animate-bounce' : ''
          }`}
        />
      }
      maxWidthClass="max-w-2xl"
      bodyClassName="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectFilter('🔥긴급/오늘할일');
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#E60012] hover:bg-[#C8000F] text-white transition cursor-pointer"
          >
            🔥 긴급/오늘할일 탭만 모아보기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#191F28] hover:bg-slate-800 dark:bg-[#60A5FA] dark:hover:bg-blue-300 text-white dark:text-[#0B1120] transition cursor-pointer"
          >
            확인 후 닫기
          </button>
        </div>
      }
    >
      {/* 휴대폰 푸시 알림 연동 배너 */}
      <SurfaceCard tone="benefit" padded={false} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#191F28] dark:text-slate-100">
          <Bell className="w-4 h-4 text-[#1B64DA] dark:text-blue-400 shrink-0" />
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
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#1B64DA] hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
            >
              🔔 휴대폰 알림 켜기
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTestPush}
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 transition cursor-pointer"
            >
              📲 지금 상단바 알림 받기
            </button>
          )}
        </div>
        {pushSentMsg && (
          <div className="w-full text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-[#BFDBFE] dark:border-blue-500/30">
            {pushSentMsg}
          </div>
        )}
      </SurfaceCard>

      {/* 5대 핵심 요약 카운트 카드 */}
      <KpiMetricStrip
        columnsClass="grid-cols-2 sm:grid-cols-5"
        items={[
          {
            id: 'delivery',
            label: '🚨 오늘/내일 배송',
            value: `${summary.todayDelivery.length + summary.tomorrowDelivery.length}건`,
            tone: 'brand',
          },
          {
            id: 'followup',
            label: '📞 오늘 재연락',
            value: `${summary.followUpToday.length}건`,
            tone: 'benefit',
          },
          {
            id: 'logistics',
            label: '🚚 물류 미확정(D-3)',
            value: `${summary.unconfirmedLogistics.length}건`,
            tone: 'default',
          },
          {
            id: 'unsent',
            label: '📩 견적 미발송',
            value: `${summary.unsentQuotes.length}건`,
            tone: 'benefit',
          },
          {
            id: 'gifts',
            label: '🎁 사은품 미지급',
            value: `${summary.unpaidGifts.length}건`,
            tone: 'brand',
          },
        ]}
      />

      {/* 0. 오늘 재연락 예정 고객 (리마인드) */}
      {summary.followUpToday.length > 0 && (
        <SurfaceCard tone="benefit" padded={false} className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
              📞 오늘 재연락 예정 고객 (리마인드) (
              <span className="font-mono tabular-nums">{summary.followUpToday.length}</span>명)
            </h3>
            <span className="text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300">
              혜택 마감 / 미결 클로징 필수!
            </span>
          </div>
          <div className="space-y-2">
            {summary.followUpToday.map((c) => {
              const fInfo = getFollowUpInfo(c);
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#131C2E] p-3 rounded-xl border border-[#BFDBFE] dark:border-blue-500/30 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[11.5px] font-extrabold bg-[#E60012] text-white">
                        {fInfo.label}
                      </span>
                      <span className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                        {c.name} 고객님
                      </span>
                      <span className="text-xs font-semibold font-mono tabular-nums text-[#8B95A1] dark:text-slate-400">
                        ({c.phone})
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#4E5968] dark:text-slate-300 mt-1">
                      {c.items} · 체감가{' '}
                      <span className="font-mono tabular-nums text-[#E60012] dark:text-[#FF3B47]">
                        {formatCurrency(c.netAmount)}원
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.phone && (
                      <a
                        href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                        className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30"
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
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#1B64DA] text-white hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      리마인드 문자
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* 1. 오늘/내일 배송 고객 리스트 */}
      {(summary.todayDelivery.length > 0 ||
        summary.tomorrowDelivery.length > 0) && (
        <SurfaceCard tone="brand" padded={false} className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-[#E60012] dark:text-[#FF3B47] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              오늘·내일 배송 스케줄 점검 (
              <span className="font-mono tabular-nums">
                {summary.todayDelivery.length + summary.tomorrowDelivery.length}
              </span>
              건)
            </h3>
            <span className="text-[11.5px] font-bold text-[#E60012] dark:text-rose-300">
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
                    className="bg-white dark:bg-[#131C2E] p-3 rounded-xl border border-[#FECDD3] dark:border-rose-500/30 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11.5px] font-extrabold font-mono tabular-nums ${
                            isToday
                              ? 'bg-[#E60012] text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {isToday ? '오늘배송 D-Day' : '내일배송 D-1'}
                        </span>
                        <span className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                          {c.name} 고객님
                        </span>
                        <span className="text-xs font-semibold font-mono tabular-nums text-[#8B95A1] dark:text-slate-400">
                          ({c.phone})
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#4E5968] dark:text-slate-300 mt-1">
                        {c.items}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleLogistics(c)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                          c.logisticsConfirmed
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
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
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#1B64DA] text-white hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
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
        </SurfaceCard>
      )}

      {/* 2. 견적 미발송 & 미구매 고민 고객 */}
      {summary.unsentQuotes.length > 0 && (
        <SurfaceCard tone="benefit" padded={false} className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
              견적서 문자 미발송 고객 (<span className="font-mono tabular-nums">{summary.unsentQuotes.length}</span>명)
            </h3>
          </div>
          <div className="space-y-2">
            {summary.unsentQuotes.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-[#131C2E] p-3 rounded-xl border border-[#BFDBFE] dark:border-blue-500/30 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                      {c.name} 고객님
                    </span>
                    <span className="text-xs font-bold font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">
                      체감가 {formatCurrency(c.netAmount)}원
                    </span>
                  </div>
                  <p className="text-xs text-[#4E5968] dark:text-slate-300 mt-0.5">{c.items}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                      className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30"
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
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B64DA] text-white hover:bg-blue-700 cursor-pointer"
                  >
                    견적문자 발송
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* 3. 사은품 미지급 고객 */}
      {summary.unpaidGifts.length > 0 && (
        <SurfaceCard tone="brand" padded={false} className="p-3.5 space-y-2.5">
          <h3 className="text-xs font-extrabold text-[#E60012] dark:text-[#FF3B47] flex items-center gap-1.5">
            <Gift className="w-4 h-4" />
            배송완료 후 사은품 미지급 고객 (<span className="font-mono tabular-nums">{summary.unpaidGifts.length}</span>명)
          </h3>
          <div className="space-y-2">
            {summary.unpaidGifts.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-[#131C2E] p-3 rounded-xl border border-[#FECDD3] dark:border-rose-500/30 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                    {c.name} 고객님
                  </span>
                  <p className="text-xs font-bold text-[#E60012] dark:text-rose-300 mt-0.5">
                    약속 사은품: {c.giftItems}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleGift(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#059669] text-white hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  지급 완료 처리
                </button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {summary.totalActionCount === 0 && (
        <div className="py-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-[#059669] mx-auto" />
          <h4 className="text-base font-extrabold text-[#191F28] dark:text-slate-100">
            현재 밀린 긴급 배송이나 미발송 건이 없습니다!
          </h4>
          <p className="text-xs text-[#4E5968] dark:text-slate-400">
            오늘도 국지점 대박 실적을 응원합니다.
          </p>
        </div>
      )}
    </FlagshipModalShell>
  );
};
