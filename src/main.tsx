import React, { Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BootEntryMode, resolveBootEntryMode } from './utils/shareQuoteCodec';
import './index.css';

// 엔트리 최상단에서 동기 판별:
// 1) 'customer-quote': 고객 견적 링크(?s=, ?q=, /q/) -> 오직 고객 견적서만 렌더링
// 2) 'public-gate': 깃허브 주소 뒤쪽(?s=...)을 지우고 루트 주소로 접속한 비인증 기기/시크릿모드 -> 직원용 App.tsx 로드 원천 차단!
// 3) 'staff-app': 인증된 직원 단말기만 본 업무용 앱(App.tsx) 로드
const INITIAL_BOOT_MODE: BootEntryMode = resolveBootEntryMode();

const StaffApp = lazy(() => import('./App.tsx'));
const CustomerShareStandaloneRoot = lazy(() =>
  import('./components/CustomerShareQuoteView').then((m) => ({
    default: m.CustomerShareStandaloneRoot,
  }))
);
const PublicZeroTrustGateRoot = lazy(() =>
  import('./components/CustomerShareQuoteView').then((m) => ({
    default: m.PublicZeroTrustGateRoot,
  }))
);

const RootDispatcher: React.FC = () => {
  const [mode, setMode] = useState<BootEntryMode>(INITIAL_BOOT_MODE);

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

createRoot(document.getElementById('root')!).render(
  <Suspense
    fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F4F2ED] text-[#18181B] text-sm font-black">
        화면을 준비하고 있습니다...
      </div>
    }
  >
    <RootDispatcher />
  </Suspense>
);

// 인증된 직원 기기('staff-app')에서만 PWA 서비스워커를 등록하여 고객/외부인 기기에 업무 캐시가 남지 않도록 차단
if (INITIAL_BOOT_MODE === 'staff-app' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
