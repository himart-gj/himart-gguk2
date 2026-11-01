import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { detectCustomerSandboxMode } from './utils/shareQuoteCodec';
import './index.css';

// 엔트리 최상단에서 고객 공유 링크(?share=... / #share=...) 여부를 동기 판별하여
// 고객 스마트폰에서는 직원용 App.tsx 및 PWA 서비스워커가 아예 로드·실행되지 않도록 원천 격리합니다.
const IS_CUSTOMER_SANDBOX = detectCustomerSandboxMode();

const StaffApp = lazy(() => import('./App.tsx'));
const CustomerShareStandaloneRoot = lazy(() =>
  import('./components/CustomerShareQuoteView').then((m) => ({
    default: m.CustomerShareStandaloneRoot,
  }))
);

createRoot(document.getElementById('root')!).render(
  <Suspense
    fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F4F2ED] text-[#18181B] text-sm font-black">
        화면을 준비하고 있습니다...
      </div>
    }
  >
    {IS_CUSTOMER_SANDBOX ? <CustomerShareStandaloneRoot /> : <StaffApp />}
  </Suspense>
);

// 고객 전용 뷰어 모드에서는 직원용 PWA 서비스워커(휴무표·수당단가표 캐시)를 절대 등록하지 않음
if (!IS_CUSTOMER_SANDBOX && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
