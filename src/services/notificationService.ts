/**
 * 모바일 및 데스크톱 PWA 푸시 알림 매니저
 * Android Chrome, iOS Safari(PWA), Desktop 브라우저를 완벽하게 지원합니다.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  badgeCount?: number;
}

/**
 * 기기 환경 감지
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
}

export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS 브라우저 탭에서는 Notification이 제공되지 않고 홈 화면 PWA에서만 제공됨
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * 모바일 호환 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  status: NotificationPermission | 'unsupported' | 'ios_needs_pwa';
  message: string;
}> {
  if (typeof window === 'undefined') {
    return { granted: false, status: 'unsupported', message: '지원되지 않는 환경입니다.' };
  }

  // iOS Safari인데 홈 화면에 추가되지 않은 일반 브라우저 탭인 경우
  if (isIOS() && !isStandalone()) {
    return {
      granted: false,
      status: 'ios_needs_pwa',
      message: '📱 아이폰에서는 사파리 하단의 [공유 버튼(사각형 화살표) ➔ 홈 화면에 추가]를 하신 후, 홈 화면 앱으로 여셔야 푸시 알림을 받으실 수 있습니다.',
    };
  }

  if (!isNotificationSupported()) {
    return {
      granted: false,
      status: 'unsupported',
      message: '현재 브라우저는 웹 알림 기능을 지원하지 않습니다. 크롬 브라우저를 사용해주세요.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return {
        granted: true,
        status: 'granted',
        message: '✅ 핸드폰 알림이 활성화되었습니다! 앱을 내려두어도 배송 및 신규 고객 알림을 수신합니다.',
      };
    } else if (permission === 'denied') {
      return {
        granted: false,
        status: 'denied',
        message: '⚠️ 브라우저 설정에서 알림 권한이 차단되어 있습니다. 주소창 좌측 설정(자물쇠)에서 알림을 허용해주세요.',
      };
    } else {
      return {
        granted: false,
        status: 'default',
        message: '알림 권한 요청이 보류되었습니다.',
      };
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    return {
      granted: false,
      status: 'unsupported',
      message: '알림 권한 요청 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 모바일 호환 알림 발송 (Android Chrome은 new Notification()이 차단되므로 반드시 serviceWorkerRegistration.showNotification 사용)
 */
export async function sendMobileNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const title = payload.title || '🔔 국지CRM 알림';
  const options: NotificationOptions = {
    body: payload.body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: payload.tag || 'kukji-crm-notification',
    // @ts-ignore 진동 패턴 (모바일 기기에서 진동 알림)
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.url || window.location.href,
      dateOfArrival: Date.now(),
    },
    requireInteraction: false,
    silent: false,
  };

  try {
    // 1순위: ServiceWorker registration.showNotification (모바일 안드로이드/아이폰 100% 필수)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }

    // 2순위: 데스크톱 폴백
    new Notification(title, options);
    return true;
  } catch (err) {
    console.warn('showNotification failed, falling back to desktop Notification:', err);
    try {
      new Notification(title, options);
      return true;
    } catch (fallbackErr) {
      console.error('Both notification methods failed:', fallbackErr);
      return false;
    }
  }
}

/**
 * 📱 모바일 상단바 알림창 상주 고정 알림 (Persistent Notification)
 * 앱을 닫거나 다른 작업을 해도 스마트폰 알림창에 실시간 업무 현황이 상시 노출됩니다.
 */
export async function updatePersistentStatusNotification(summary: {
  newLeadCount: number;
  todayDeliveryCount: number;
  giftCount: number;
}): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;

  const title = `⚡ [국지CRM] 실시간 매장 업무 현황`;
  const body = `신규 미발송 ${summary.newLeadCount}건 · 오늘 배송 ${summary.todayDeliveryCount}건 · 미지급 사은품 ${summary.giftCount}건`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: './icon.svg',
          badge: './icon.svg',
          tag: 'himart-persistent-status-bar',
          // @ts-ignore
          renotify: false,
          requireInteraction: true, // 사용자가 지우기 전까지 상단바 상주
          data: { url: window.location.origin + window.location.pathname },
        });
        return true;
      }
    }
  } catch (e) {
    console.error('Failed to update persistent notification:', e);
  }
  return false;
}

/**
 * 🚨 신규 고객 유입 시 즉시 팝업/진동 알림
 */
export async function sendNewCustomerAlert(customerName: string, itemsSummary: string): Promise<boolean> {
  // 모바일 기기 진동
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 400]);
    } catch (e) {}
  }

  return sendMobileNotification({
    title: `🚨 [신규 접수] ${customerName} 고객님 등록!`,
    body: `${itemsSummary || '가전 견적 상담'}\n지금 즉시 CRM에서 확인하고 문자를 발송하세요.`,
    tag: `new-customer-${Date.now()}`,
  });
}

/**
 * ⏰ 정시(09:00, 13:00, 18:00) 정기 브리핑 알림
 */
export async function sendScheduledSyncNotification(timeLabel: string, stats: { newCount: number; deliveryCount: number }): Promise<boolean> {
  return sendMobileNotification({
    title: `⏰ [${timeLabel} 정기 점검] 구글 시트 동기화 완료`,
    body: `신규 미발송 ${stats.newCount}건, 오늘 배송 ${stats.deliveryCount}건이 있습니다. 현황을 점검하세요!`,
    tag: `scheduled-sync-${timeLabel}`,
  });
}
