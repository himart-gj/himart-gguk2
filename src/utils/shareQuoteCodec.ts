import { ProposalState } from '../types/proposal';
import { loadSavedUserName } from '../components/ScheduleModal';
import { ADMIN_PIN_CODE } from './careTableParser';

export interface ConsultantProfile {
  name: string;
  roleTitle: string;
  phone: string;
  storeName: string;
  greeting: string;
}

export interface SharedQuotePayload {
  v: 1;
  createdAt: string;
  customerName?: string;
  consultant: ConsultantProfile;
  state: ProposalState;
}

const CONSULTANT_STORAGE_KEY = 'himart_gj_consultant_profile_v1';
export const CUSTOMER_TAB_LOCK_KEY = 'himart_customer_tab_lock_v1';
export const CUSTOMER_DEVICE_VIEWER_ONLY_KEY = 'himart_customer_viewer_only_v1';
export const STAFF_TRUSTED_DEVICE_KEY = 'himart_staff_trusted_device_v1';
export const LAST_CUSTOMER_QUOTE_CACHE_KEY = 'himart_last_customer_quote_v1';

export function loadConsultantProfile(): ConsultantProfile {
  try {
    const raw = localStorage.getItem(CONSULTANT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          name: String(parsed.name || loadSavedUserName() || '전문 상담사').trim(),
          roleTitle: String(parsed.roleTitle || '수석 가전 컨설턴트').trim(),
          phone: String(parsed.phone || '').trim(),
          storeName: String(parsed.storeName || '롯데하이마트 경기광주점').trim(),
          greeting: String(
            parsed.greeting ||
              '고객님 가계에 가장 유리한 플랜을 직접 비교해 보시고 편하게 연락 주세요!'
          ).trim(),
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    name: loadSavedUserName() || '전문 상담사',
    roleTitle: '가전 전문 컨설턴트',
    phone: '',
    storeName: '롯데하이마트 경기광주점',
    greeting:
      '고객님 가계에 가장 유리한 플랜을 직접 비교해 보시고 편하게 연락 주세요!',
  };
}

export function saveConsultantProfile(profile: ConsultantProfile): void {
  try {
    localStorage.setItem(CONSULTANT_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const cleaned = b64url.trim().replace(/\s+/g, '');
  const padded = cleaned
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(cleaned.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 현재 URL(?share=... 또는 #share=...)에서 공유 토큰을 안전하게 추출합니다.
 */
export function extractRawShareTokenFromUrl(
  searchStr?: string,
  hashStr?: string
): string | null {
  try {
    const s =
      typeof searchStr === 'string'
        ? searchStr
        : typeof window !== 'undefined'
        ? window.location.search
        : '';
    if (s) {
      const params = new URLSearchParams(s);
      const qShare = params.get('share');
      if (qShare && qShare.trim()) {
        return qShare.trim();
      }
    }
  } catch {
    // ignore
  }

  try {
    const h =
      typeof hashStr === 'string'
        ? hashStr
        : typeof window !== 'undefined'
        ? window.location.hash
        : '';
    const clean = h.replace(/^#/, '').trim();
    if (clean.startsWith('share=')) {
      const token = decodeURIComponent(clean.slice('share='.length)).trim();
      if (token) return token;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 기존 직원용 데이터가 이미 존재하는 신뢰된 직원 기기인지 판별
 */
function hasExistingStaffFootprint(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(STAFF_TRUSTED_DEVICE_KEY) === '1') return true;
    if (localStorage.getItem('gookji_crm_customers_cache_v3')) return true;
    if (localStorage.getItem('himart_crm_model_incentive_sheets_v1')) return true;
    if (localStorage.getItem('gemini_api_key')) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * [고객 전용 보안 샌드박스 판별기 - main.tsx 최상단에서 동기 실행]
 * 1) URL에 ?share= 또는 #share= 가 있으면 현재 탭을 영구 고객 뷰어로 격리하고,
 *    직원 사용 이력이 없는 고객 스마트폰에는 기기 단위 고객 뷰어 잠금도 함께 기록하여
 *    고객이 주소창 뒤쪽 파라미터를 지우고 루트 도메인으로 접속해도 직원 앱이 절대 열리지 않습니다.
 * 2) 일반 직원 기기(처음부터 기본 URL로 접속한 기기)는 비밀번호 없이 평소처럼 즉시 실행됩니다.
 */
export function detectCustomerSandboxMode(): boolean {
  if (typeof window === 'undefined') return false;

  const hasShareTokenInUrl = Boolean(extractRawShareTokenFromUrl());
  const isStaffDevice = hasExistingStaffFootprint();

  if (hasShareTokenInUrl) {
    try {
      sessionStorage.setItem(CUSTOMER_TAB_LOCK_KEY, '1');
      if (!isStaffDevice) {
        localStorage.setItem(CUSTOMER_DEVICE_VIEWER_ONLY_KEY, '1');
      }
    } catch {
      // ignore
    }
    return true;
  }

  try {
    if (sessionStorage.getItem(CUSTOMER_TAB_LOCK_KEY) === '1') {
      return true;
    }
    if (!isStaffDevice && localStorage.getItem(CUSTOMER_DEVICE_VIEWER_ONLY_KEY) === '1') {
      return true;
    }
    // 기본 URL로 정상 진입한 직원 기기로 마킹
    localStorage.setItem(STAFF_TRUSTED_DEVICE_KEY, '1');
  } catch {
    // ignore
  }

  return false;
}

export function unlockStaffDeviceWithPin(pin: string): boolean {
  if ((pin || '').trim() !== ADMIN_PIN_CODE) return false;
  try {
    localStorage.setItem(STAFF_TRUSTED_DEVICE_KEY, '1');
    localStorage.removeItem(CUSTOMER_DEVICE_VIEWER_ONLY_KEY);
    sessionStorage.removeItem(CUSTOMER_TAB_LOCK_KEY);
  } catch {
    // ignore
  }
  return true;
}

export function cacheCustomerQuotePayload(payload: SharedQuotePayload): void {
  const serialized = JSON.stringify(payload);
  try {
    sessionStorage.setItem(LAST_CUSTOMER_QUOTE_CACHE_KEY, serialized);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(LAST_CUSTOMER_QUOTE_CACHE_KEY, serialized);
  } catch {
    // ignore
  }
}

export function loadCachedCustomerQuotePayload(): SharedQuotePayload | null {
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(LAST_CUSTOMER_QUOTE_CACHE_KEY)) ||
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem(LAST_CUSTOMER_QUOTE_CACHE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SharedQuotePayload;
    if (parsed && typeof parsed === 'object' && parsed.state) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 카카오톡 인앱 브라우저/리다이렉트 시 #해시 유실을 원천 방지하기 위해
 * 쿼리 파라미터(?share=...) 방식으로 고객 전용 비교 견적 링크를 생성합니다.
 * (기존 #share=... 링크도 decodeSharedQuoteFromHash / decodeSharedQuoteFromLocation에서 100% 호환 지원)
 */
export async function encodeSharedQuoteUrl(
  payload: SharedQuotePayload
): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const rawBytes = new TextEncoder().encode(jsonStr);

  let token = '';
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const compressedBuf = await new Response(cs.readable).arrayBuffer();
      token = 'z1.' + bytesToBase64Url(new Uint8Array(compressedBuf));
    } catch {
      token = 'u1.' + bytesToBase64Url(rawBytes);
    }
  } else {
    token = 'u1.' + bytesToBase64Url(rawBytes);
  }

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  return `${baseUrl}?share=${encodeURIComponent(token)}`;
}

export async function decodeSharedQuoteToken(
  token: string
): Promise<SharedQuotePayload | null> {
  try {
    const cleanToken = (token || '').trim();
    if (!cleanToken) return null;

    let jsonBytes: Uint8Array;
    if (cleanToken.startsWith('z1.')) {
      if (typeof DecompressionStream === 'undefined') {
        return null;
      }
      const compressed = base64UrlToBytes(cleanToken.slice(3));
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      jsonBytes = new Uint8Array(buf);
    } else if (cleanToken.startsWith('u1.')) {
      jsonBytes = base64UrlToBytes(cleanToken.slice(3));
    } else {
      jsonBytes = base64UrlToBytes(cleanToken);
    }

    const jsonText = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(jsonText) as SharedQuotePayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.state) {
      return null;
    }
    cacheCustomerQuotePayload(parsed);
    return parsed;
  } catch (err) {
    console.error('Failed to decode shared quote token:', err);
    return null;
  }
}

/**
 * URL 해시(#share=...) 또는 쿼리(?share=...)로부터 고객용 인터랙티브 견적 데이터 복원
 */
export async function decodeSharedQuoteFromHash(
  hashOrSearchStr?: string
): Promise<SharedQuotePayload | null> {
  if (typeof hashOrSearchStr === 'string' && hashOrSearchStr.trim()) {
    const trimmed = hashOrSearchStr.trim();
    const token = trimmed.startsWith('?')
      ? extractRawShareTokenFromUrl(trimmed, '')
      : trimmed.startsWith('#')
      ? extractRawShareTokenFromUrl('', trimmed)
      : trimmed.startsWith('share=')
      ? decodeURIComponent(trimmed.slice('share='.length))
      : trimmed;
    if (token) {
      return decodeSharedQuoteToken(token);
    }
  }

  const locToken = extractRawShareTokenFromUrl();
  if (locToken) {
    const decoded = await decodeSharedQuoteToken(locToken);
    if (decoded) return decoded;
  }

  return loadCachedCustomerQuotePayload();
}
