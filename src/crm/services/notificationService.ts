import { CustomerItem } from '../types/crm';
import { getDeliveryDDay, getFollowUpInfo, getTodayStr } from '../utils/date';

const NOTIFIED_DATE_KEY = 'gookji_crm_last_notified_date';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (e) {
    console.warn('Notification permission request error:', e);
    return Notification.permission;
  }
}

export async function sendSystemNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          tag: 'gookji-crm-briefing',
          renotify: true,
        } as any);
        return true;
      }
    }

    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
    });
    return true;
  } catch (e) {
    console.warn('Failed to show notification:', e);
    return false;
  }
}

export function getBriefingSummary(customers: CustomerItem[]) {
  const active = customers.filter((c) => c.status !== '취소/보류');

  const todayDelivery = active.filter(
    (c) => getDeliveryDDay(c.deliveryDate).diff === 0
  );
  const tomorrowDelivery = active.filter(
    (c) => getDeliveryDDay(c.deliveryDate).diff === 1
  );
  const unconfirmedLogistics = active.filter((c) => {
    const diff = getDeliveryDDay(c.deliveryDate).diff;
    return diff !== null && diff >= 0 && diff <= 3 && !c.logisticsConfirmed;
  });
  const unsentQuotes = active.filter((c) => c.status === '신규/미발송');
  const undecided = active.filter(
    (c) => c.status === '미구매/고민중' || c.status === '상담진행중'
  );
  const unpaidGifts = active.filter((c) => {
    const diff = getDeliveryDDay(c.deliveryDate).diff;
    return (
      diff !== null &&
      diff <= 0 &&
      Boolean(c.giftItems && c.giftItems.trim()) &&
      !c.giftSent
    );
  });
  const happyCallNeeded = active.filter(
    (c) => getDeliveryDDay(c.deliveryDate).diff === -1
  );
  // 오늘 또는 지난 재연락 예정 고객 (미구매/고민중, 상담진행중 등)
  const followUpToday = active.filter((c) => getFollowUpInfo(c).isDueOrOverdue);

  const totalActionCount =
    todayDelivery.length +
    tomorrowDelivery.length +
    unconfirmedLogistics.length +
    unsentQuotes.length +
    unpaidGifts.length +
    happyCallNeeded.length +
    followUpToday.length;

  return {
    todayDelivery,
    tomorrowDelivery,
    unconfirmedLogistics,
    unsentQuotes,
    undecided,
    unpaidGifts,
    happyCallNeeded,
    followUpToday,
    totalActionCount,
  };
}

export async function triggerDailyMorningNotification(
  customers: CustomerItem[],
  force = false
): Promise<boolean> {
  const todayStr = getTodayStr();
  const lastDate = localStorage.getItem(NOTIFIED_DATE_KEY);

  if (!force && lastDate === todayStr) {
    return false;
  }

  const summary = getBriefingSummary(customers);
  if (!force && summary.totalActionCount === 0) {
    return false;
  }

  const lines: string[] = [];
  if (summary.todayDelivery.length > 0) {
    lines.push(
      `🚨 오늘 배송: ${summary.todayDelivery.map((c) => c.name).join(', ')} (${
        summary.todayDelivery.length
      }건)`
    );
  }
  if (summary.tomorrowDelivery.length > 0) {
    lines.push(
      `🔥 내일 배송(D-1): ${summary.tomorrowDelivery
        .map((c) => c.name)
        .join(', ')} (${summary.tomorrowDelivery.length}건)`
    );
  }
  if (summary.followUpToday.length > 0) {
    lines.push(
      `📞 오늘 재연락 예정: ${summary.followUpToday
        .map((c) => c.name)
        .join(', ')} (${summary.followUpToday.length}건)`
    );
  }
  if (summary.unconfirmedLogistics.length > 0) {
    lines.push(`🚚 물류/배정 미확정: ${summary.unconfirmedLogistics.length}건`);
  }
  if (summary.unsentQuotes.length > 0) {
    lines.push(`📩 견적 미발송: ${summary.unsentQuotes.length}건`);
  }
  if (summary.unpaidGifts.length > 0) {
    lines.push(`🎁 사은품 미지급: ${summary.unpaidGifts.length}건`);
  }

  const body =
    lines.length > 0
      ? lines.join('\n')
      : '오늘 예정된 긴급 배송/미발송 건이 없습니다. 좋은 하루 되세요!';

  const sent = await sendSystemNotification(
    `🔔 국지점 오늘의 할 일 브리핑 (${todayStr})`,
    body
  );

  if (sent) {
    localStorage.setItem(NOTIFIED_DATE_KEY, todayStr);
  }
  return sent;
}
