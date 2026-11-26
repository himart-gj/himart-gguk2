// ============================================================================
// 모바일 기기/인앱브라우저 정밀 감지 + 크롬 외부열기 + 전역 PWA 설치 프롬프트 매니저
// - 카카오톡/인스타/네이버 인앱브라우저 감지 시 갤럭시(Android) 크롬(Chrome) 강제 외부 실행 지원
// - 아이폰(iOS) 인앱브라우저 / 타 브라우저 -> Safari 유도 및 홈 화면 추가 선행 가이드 지원
// - 초기 초대코드 게이트(PublicZeroTrustGateRoot)와 본 앱(App.tsx) 간 beforeinstallprompt 공유
// ============================================================================

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface InstallEnvironmentInfo {
  isStandalone: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isKakaoInApp: boolean;
  isOtherInApp: boolean;
  isInAppBrowser: boolean;
  isSamsungBrowser: boolean;
  isChromeAndroid: boolean;
  isIosSafari: boolean;
  isIosNonSafariBrowser: boolean;
}

export function isRunningAsStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
    if ((window.navigator as any)?.standalone === true) return true;
  } catch {
    // ignore
  }
  return false;
}

export function detectInstallEnvironment(
  uaOverride?: string,
  standaloneOverride?: boolean
): InstallEnvironmentInfo {
  const ua =
    typeof uaOverride === 'string'
      ? uaOverride
      : typeof navigator !== 'undefined'
      ? navigator.userAgent || ''
      : '';

  const isIosTouchMac =
    typeof uaOverride !== 'string' &&
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1;

  const isIos = /iPhone|iPad|iPod/i.test(ua) || isIosTouchMac;
  const isAndroid = !isIos && /Android/i.test(ua);
  const isKakaoInApp = /KAKAOTALK/i.test(ua);
  const isOtherInApp =
    !isKakaoInApp &&
    /Instagram|NAVER\(inapp|Line\/|FBAN|FBAV|DaumApps|EverytimeApp/i.test(ua);
  const isInAppBrowser = isKakaoInApp || isOtherInApp;
  const isSamsungBrowser = isAndroid && /SamsungBrowser/i.test(ua);
  const isStandalone =
    typeof standaloneOverride === 'boolean'
      ? standaloneOverride
      : isRunningAsStandalonePwa();

  const isChromeAndroid =
    isAndroid &&
    /Chrome\//i.test(ua) &&
    !isSamsungBrowser &&
    !isInAppBrowser &&
    !/EdgA\/|OPR\/|Whale\//i.test(ua);

  const isIosSafari =
    isIos &&
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Whale|GSA\//i.test(ua) &&
    !isInAppBrowser;

  const isIosNonSafariBrowser =
    isIos && !isIosSafari && !isInAppBrowser && !isStandalone;

  return {
    isStandalone,
    isIos,
    isAndroid,
    isKakaoInApp,
    isOtherInApp,
    isInAppBrowser,
    isSamsungBrowser,
    isChromeAndroid,
    isIosSafari,
    isIosNonSafariBrowser,
  };
}

/**
 * 안드로이드(삼성 갤럭시 등)에서 지정한 URL을 구글 크롬(com.android.chrome)으로 즉시 여는 Intent URI 생성
 * - 크롬 미설치/비활성 단말에서도 S.browser_fallback_url을 통해 기본 외부 브라우저로 안전 폴백
 */
export function buildAndroidChromeIntentUrl(targetUrl: string): string {
  const clean = String(targetUrl || '').trim();
  if (!clean) return '';
  const isHttp = /^http:\/\//i.test(clean);
  const scheme = isHttp ? 'http' : 'https';
  const stripped = clean.replace(/^https?:\/\//i, '');
  return `intent://${stripped}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
    clean
  )};end`;
}

export function launchUrlInAndroidChrome(targetUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  const intentUrl = buildAndroidChromeIntentUrl(targetUrl);
  if (!intentUrl) return false;
  try {
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}

// ==================== 전역 PWA 설치 프롬프트 싱글톤 스토어 ====================
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsStandalone: boolean = isRunningAsStandalonePwa();
let listenersInstalled = false;
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export function installGlobalPwaInstallListeners(): void {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;
  globalIsStandalone = isRunningAsStandalonePwa();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    globalIsStandalone = true;
    notifySubscribers();
  });

  const mq = window.matchMedia?.('(display-mode: standalone)');
  mq?.addEventListener?.('change', (e: MediaQueryListEvent) => {
    if (e.matches) {
      globalIsStandalone = true;
      notifySubscribers();
    }
  });
}

if (typeof window !== 'undefined') {
  installGlobalPwaInstallListeners();
}

export function getGlobalDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return globalDeferredPrompt;
}

export function getGlobalStandaloneState(): boolean {
  return globalIsStandalone || isRunningAsStandalonePwa();
}

export function subscribePwaInstallState(listener: () => void): () => void {
  installGlobalPwaInstallListeners();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export async function triggerNativePwaInstallPrompt(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  if (!globalDeferredPrompt) return 'unavailable';
  try {
    await globalDeferredPrompt.prompt();
    const choice = await globalDeferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      globalDeferredPrompt = null;
      notifySubscribers();
      return 'accepted';
    }
    return 'dismissed';
  } catch {
    return 'unavailable';
  }
}
