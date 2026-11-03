import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BootEntryMode, resolveBootEntryMode } from './utils/shareQuoteCodec';
import StaffApp from './App';
import {
  CustomerShareStandaloneRoot,
  PublicZeroTrustGateRoot,
} from './components/CustomerShareQuoteView';
import './index.css';

// 엔트리 최상단에서 동기 판별:
// 1) 'customer-quote': 고객 견적 링크(?s=, ?q=, /q/) -> 오직 고객 견적서만 렌더링
// 2) 'public-gate': 주소 뒤쪽(?s=...)을 지우고 루트 주소로 접속한 비인증 기기/시크릿모드 -> 직원용 App 렌더링 차단
// 3) 'staff-app': 인증된 직원 단말기만 본 업무용 앱(App.tsx) 렌더링
const INITIAL_BOOT_MODE: BootEntryMode = resolveBootEntryMode();

const RootDispatcher: React.FC = () => {
  const [mode, setMode] = useState<BootEntryMode>(INITIAL_BOOT_MODE);

  useEffect(() => {
    // 개발 서버(Vite Dev) 환경에서 이전 세션의 서비스워커가 모듈 요청(/src/*)을 가로채지 않도록 해제
    if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => r.unregister().catch(() => {}));
        })
        .catch(() => {});
    }
  }, []);

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

// 인증된 직원 기기('staff-app') 및 프로덕션 빌드에서만 PWA 서비스워커를 등록
if (INITIAL_BOOT_MODE === 'staff-app' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
