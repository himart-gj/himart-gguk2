import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Truck, 
  UserCheck, 
  Package, 
  Phone, 
  MessageSquare, 
  ChevronRight, 
  CheckCircle2, 
  ExternalLink,
  Volume2
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { formatLocalDate } from '../utils/date';
import { 
  requestNotificationPermission, 
  sendMobileNotification, 
  isIOS, 
  isStandalone 
} from '../services/notificationService';

interface MorningBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  onOpenSMS: (customer: CustomerItem) => void;
  onSelectCustomer: (customer: CustomerItem) => void;
  onFilterByStatus?: (status: any) => void;
  onUpdateGift?: (customerId: string, giftItem: string, isGiftDelivered: boolean) => void;
}

export const MorningBriefingModal: React.FC<MorningBriefingModalProps> = ({
  isOpen,
  onClose,
  customers,
  onOpenSMS,
  onSelectCustomer,
  onFilterByStatus,
  onUpdateGift,
}) => {
  const [dontShowToday, setDontShowToday] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  // Categorize urgent items
  const todayDeliveries = customers.filter((c) => c.dDay === 0);
  const tomorrowDeliveries = customers.filter((c) => c.dDay === 1);
  const imminentDeliveries = customers.filter((c) => c.dDay !== null && c.dDay >= 0 && c.dDay <= 2);
  const newUnsentCustomers = customers.filter((c) => c.status === '신규/미발송' || (!c.isSmsSent && c.source === 'tab1'));
  const logisticsWaitCustomers = customers.filter((c) => c.status === '물류대기');
  const undeliveredGiftCustomers = customers.filter((c) => Boolean(c.giftItem) && !c.isGiftDelivered);

  const totalUrgentCount = todayDeliveries.length + tomorrowDeliveries.length + newUnsentCustomers.length + logisticsWaitCustomers.length + undeliveredGiftCustomers.length;

  const handleClose = () => {
    if (dontShowToday) {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem('himart_briefing_dismissed_date', todayStr);
    }
    onClose();
  };

  // Request browser Notification Permission (Mobile & Desktop compatible)
  const requestWebPush = async () => {
    const res = await requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
    setPushStatusMessage(res.message);

    if (res.granted) {
      // 모바일(안드로이드/아이폰)과 데스크톱 모두 100% 호환되는 showNotification으로 테스트 알림 전송
      await sendMobileNotification({
        title: '🔔 국지CRM 알림',
        body: `오늘 배송 ${todayDeliveries.length}건, 신규 예약 ${newUnsentCustomers.length}건이 있습니다.`,
      });
    }

    setTimeout(() => setPushStatusMessage(null), 7000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/50 flex-shrink-0 animate-pulse">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                  Daily Briefing
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {formatLocalDate(new Date())}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                오늘의 핵심 영업·배송 알림 브리핑
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Metric Pills (Mobile & iPhone SE optimized) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 p-2.5 sm:p-4 bg-slate-50 border-b border-slate-200">
          <div 
            onClick={() => onFilterByStatus && onFilterByStatus('배송대기')}
            className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-rose-200 shadow-2xs cursor-pointer hover:border-rose-400 transition min-w-0 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1 text-rose-600 mb-1">
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-black bg-rose-100 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">D-Day 임박</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate leading-tight">오늘/내일 배송</p>
            <p className="text-base sm:text-lg font-black text-slate-900 leading-none mt-1">
              {todayDeliveries.length + tomorrowDeliveries.length}
              <span className="text-[11px] sm:text-xs font-normal text-slate-500 ml-0.5">건</span>
            </p>
          </div>

          <div 
            onClick={() => onFilterByStatus && onFilterByStatus('신규/미발송')}
            className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-amber-200 shadow-2xs cursor-pointer hover:border-amber-400 transition min-w-0 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1 text-amber-600 mb-1">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-black bg-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">신규 접수</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate leading-tight">예약 미발송</p>
            <p className="text-base sm:text-lg font-black text-slate-900 leading-none mt-1">
              {newUnsentCustomers.length}
              <span className="text-[11px] sm:text-xs font-normal text-slate-500 ml-0.5">건</span>
            </p>
          </div>

          <div 
            className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-rose-300 shadow-2xs bg-rose-50/30 min-w-0 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1 text-rose-600 mb-1">
              <span className="text-xs sm:text-sm flex-shrink-0">🎁</span>
              <span className="text-[9px] sm:text-[10px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">지급 대기</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate leading-tight">미지급 사은품</p>
            <p className="text-base sm:text-lg font-black text-rose-600 leading-none mt-1">
              {undeliveredGiftCustomers.length}
              <span className="text-[11px] sm:text-xs font-normal text-slate-500 ml-0.5">건</span>
            </p>
          </div>

          <div 
            onClick={() => onFilterByStatus && onFilterByStatus('물류대기')}
            className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-purple-200 shadow-2xs cursor-pointer hover:border-purple-400 transition min-w-0 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1 text-purple-600 mb-1">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-black bg-purple-100 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">입고 대기</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate leading-tight">물류 대기</p>
            <p className="text-base sm:text-lg font-black text-slate-900 leading-none mt-1">
              {logisticsWaitCustomers.length}
              <span className="text-[11px] sm:text-xs font-normal text-slate-500 ml-0.5">건</span>
            </p>
          </div>
        </div>

        {/* Content Body: Urgent Customer List */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Section 1: Today & Tomorrow Delivery */}
          {(todayDeliveries.length > 0 || tomorrowDeliveries.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                  <span>🚨 오늘/내일 배송 고객 ({todayDeliveries.length + tomorrowDeliveries.length}명)</span>
                </h3>
                <span className="text-[10px] text-rose-600 font-bold">배송 일정 확인 및 해피콜 필수</span>
              </div>

              <div className="space-y-1.5">
                {[...todayDeliveries, ...tomorrowDeliveries].map((c, idx) => (
                  <div
                    key={`${c.id}-deliv-${idx}`}
                    className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black text-white ${c.dDay === 0 ? 'bg-rose-600 animate-pulse' : 'bg-rose-500'}`}>
                          {c.dDay === 0 ? 'D-Day 오늘 배송' : 'D-1 내일 배송'}
                        </span>
                        <span className="font-bold text-slate-900">{c.name} 고객님</span>
                        <span className="text-slate-400 text-[10px] font-mono">{c.phone}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] truncate mt-0.5">
                        {c.items || c.category || '가전 배송 대기'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-rose-600 transition"
                        title="전화 걸기"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => { onOpenSMS(c); onClose(); }}
                        className="px-2 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 transition"
                      >
                        안내문자
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: New Unsent Inquiries */}
          {newUnsentCustomers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <span>📋 신규 예약 접수 고객 ({newUnsentCustomers.length}명)</span>
                </h3>
                <span className="text-[10px] text-amber-700 font-bold">10분 내 빠른 문자 발송 권장</span>
              </div>

              <div className="space-y-1.5">
                {newUnsentCustomers.map((c, idx) => (
                  <div
                    key={`${c.id}-unsent-${idx}`}
                    className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">
                          미발송 신규
                        </span>
                        <span className="font-bold text-slate-900">{c.name}</span>
                        <span className="text-slate-400 text-[10px] font-mono">{c.phone}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] truncate mt-0.5">
                        {c.category || c.service || c.note || '온라인 상담 예약 유입'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => { onOpenSMS(c); onClose(); }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>예약문자 발송</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Undelivered Promised Gifts */}
          {undeliveredGiftCustomers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <span>🎁 약속 사은품 미지급 고객 ({undeliveredGiftCustomers.length}명)</span>
                </h3>
                <span className="text-[10px] text-rose-600 font-bold">지급 누락 방지 필수 확인</span>
              </div>

              <div className="space-y-1.5">
                {undeliveredGiftCustomers.map((c, idx) => (
                  <div
                    key={`${c.id}-gift-${idx}`}
                    className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-50 transition flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse">
                          ⚠️ 미지급
                        </span>
                        <span className="font-bold text-slate-900">{c.name} 고객님</span>
                        <span className="text-slate-400 text-[10px] font-mono">{c.phone}</span>
                        {c.deliveryDate && (
                          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                            배송: {c.deliveryDate}
                          </span>
                        )}
                      </div>
                      <p className="text-amber-950 font-black text-xs mt-1 flex items-center gap-1">
                        <span>🎁 약속 사은품:</span>
                        <span className="text-rose-700 underline">{c.giftItem}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-rose-600 transition"
                        title="전화 걸기"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      {onUpdateGift && (
                        <button
                          type="button"
                          onClick={() => onUpdateGift(c.id, c.giftItem || '', true)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                          title="사은품 지급 완료 처리"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>지급완료</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Web Push Notification Feature Card */}
          <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-200 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">🔔</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-xs text-indigo-950">
                    스마트폰 & PC 백그라운드 푸시 알림
                  </h4>
                  {pushPermission === 'granted' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-300">
                      알림 활성화됨
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  알림을 켜두시면 <b>앱 창을 닫거나 다른 작업을 하고 계셔도</b> 신규 고객 유입 및 오늘 배송 알림이 스마트폰 상단 알림 바와 진동으로 즉시 전송됩니다.
                </p>

                {/* iPhone 특별 안내 배너 */}
                {isIOS() && !isStandalone() && (
                  <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] leading-relaxed">
                    <p className="font-bold flex items-center gap-1 text-amber-800">
                      <span>📱</span> 아이폰(iOS) 알림 설정 안내
                    </p>
                    <p className="mt-0.5">
                      사파리 브라우저 하단의 <b>[공유(사각형 화살표) ➔ 홈 화면에 추가]</b>를 누르신 후, 홈 화면에 생성된 앱 아이콘으로 접속하시면 핸드폰 푸시 알림이 완벽하게 지원됩니다.
                    </p>
                  </div>
                )}

                {pushStatusMessage && (
                  <p className="mt-2 text-[11px] font-bold text-indigo-700 bg-white p-2 rounded-lg border border-indigo-200">
                    {pushStatusMessage}
                  </p>
                )}

                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={requestWebPush}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{pushPermission === 'granted' ? '🔔 알림 테스트 전송 (진동 울림)' : '🔔 핸드폰 알림 켜기'}</span>
                  </button>
                  <span className="text-[10px] text-slate-400">
                    * Android Chrome / iOS 16.4+ PWA / Windows / Mac 완벽 지원
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 accent-rose-600 border-slate-300"
            />
            <span>오늘 하루 동안 이 브리핑 자동 팝업 열지 않기</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition active:scale-95"
          >
            확인 완료 ({totalUrgentCount}건 확인)
          </button>
        </div>
      </div>
    </div>
  );
};
