import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BootEntryMode, resolveBootEntryMode } from './utils/shareQuoteCodec';
import {
  FRIEND_DEVICE_REVOKED_KEY,
  FRIEND_ROLE_CHANGED_EVENT,
  isFriendRestrictedMode,
  purgeLocalScheduleAndOwnerState,
  verifyFriendSessionHeartbeat,
} from './utils/friendAccessGuard';
import { installMobileViewportAndKeyboardGuard } from './utils/mobileQaRuntime';
import StaffApp from './App';
import {
  CustomerShareStandaloneRoot,
  PublicZeroTrustGateRoot,
} from './components/CustomerShareQuoteView';
import './index.css';

// 엔트리 최상단에서 동기 판별:
// 1) 'customer-quote': 고객 견적 링크(?s=, ?q=, /q/) -> 오직 고객 견적서만 렌더링
// 2) 'public-gate': 주소 뒤쪽(?s=...)을 지우고 루트 주소로 접속한 비인증 기기/시크릿모드 -> 직원용 App 렌더링 차단
// 3) 'staff-app': 인증된 직원 단말기(또는 1기기 귀속 완료 친구 단말기)만 본 업무용 앱(App.tsx) 렌더링
const INITIAL_BOOT_MODE: BootEntryMode = resolveBootEntryMode();
if (INITIAL_BOOT_MODE === 'staff-app' && isFriendRestrictedMode()) {
  purgeLocalScheduleAndOwnerState();
}

const HEARTBEAT_COOLDOWN_MS = 60_000;

const RootDispatcher: React.FC = () => {
  const [mode, setMode] = useState<BootEntryMode>(INITIAL_BOOT_MODE);

  useEffect(() => {
    const cleanupViewportGuard = installMobileViewportAndKeyboardGuard();
    // 개발 서버(Vite Dev) 환경에서 이전 세션의 서비스워커가 모듈 요청(/src/*)을 가로채지 않도록 해제
    if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => r.unregister().catch(() => {}));
        })
        .catch(() => {});
    }
    return cleanupViewportGuard;
  }, []);

  // 친구 기기 원격 차단(FRIEND_ROLE_CHANGED_EVENT / storage) 감지 시 새로고침 없이 즉시 잠금 게이트 전환
  useEffect(() => {
    const syncEntryGate = () => {
      try {
        if (localStorage.getItem(FRIEND_DEVICE_REVOKED_KEY) === '1') {
          setMode((prev) => (prev === 'customer-quote' ? prev : 'public-gate'));
          return;
        }
      } catch {
        // ignore
      }
      const next = resolveBootEntryMode();
      setMode((prev) => {
        if (prev === 'customer-quote') return prev;
        return next;
      });
    };

    window.addEventListener(FRIEND_ROLE_CHANGED_EVENT, syncEntryGate);
    window.addEventListener('storage', syncEntryGate);
    return () => {
      window.removeEventListener(FRIEND_ROLE_CHANGED_EVENT, syncEntryGate);
      window.removeEventListener('storage', syncEntryGate);
    };
  }, []);

  // 친구 세션일 때 마운트 직후 1회 및 포그라운드 복귀 시(60초 쿨다운) 원격 차단 여부 서버 검증
  useEffect(() => {
    if (mode !== 'staff-app' || !isFriendRestrictedMode()) return;

    purgeLocalScheduleAndOwnerState();
    let lastCheckedAt = Date.now();
    void verifyFriendSessionHeartbeat();

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isFriendRestrictedMode()) return;
      const now = Date.now();
      if (now - lastCheckedAt < HEARTBEAT_COOLDOWN_MS) return;
      lastCheckedAt = now;
      void verifyFriendSessionHeartbeat();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [mode]);

  // 인증된 직원 기기('staff-app') 및 프로덕션 빌드에서만 PWA 서비스워커를 등록하고, 새 버전 활성화 시 자동 새로고침
  useEffect(() => {
    if (mode === 'staff-app' && 'serviceWorker' in navigator && import.meta.env.PROD) {
      let refreshing = false;
      const hadController = Boolean(navigator.serviceWorker.controller);
      const onControllerChange = () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      };
    }
  }, [mode]);

  if (mode === 'customer-quote') {
    return <CustomerShareStandaloneRoot />;
  }
  if (mode === 'public-gate') {
    return (
      <PublicZeroTrustGateRoot
        onStaffVerified={() => {
          setMode('staff-app');
        }}
      />
    );
  }
  return <StaffApp />;
};

createRoot(document.getElementById('root')!).render(<RootDispatcher />);
