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

  const title = payload.title || '🔔 롯데하이마트 경기광주점 알림';
  const options: NotificationOptions = {
    body: payload.body,
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    tag: payload.tag || 'himart-notification',
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
