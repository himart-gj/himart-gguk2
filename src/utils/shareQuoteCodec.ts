import { ProposalState } from '../types/proposal';
import { loadSavedUserName } from '../components/ScheduleModal';

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
  const padded = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 브라우저 내장 Deflate 압축 스트림 지원 시 URL 길이를 최대 65% 단축하여 인코딩
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
  return `${baseUrl}#share=${token}`;
}

/**
 * URL 해시(#share=...)로부터 고객용 인터랙티브 견적 데이터 복원
 */
export async function decodeSharedQuoteFromHash(
  hashStr: string
): Promise<SharedQuotePayload | null> {
  try {
    const clean = hashStr.replace(/^#/, '').trim();
    if (!clean.startsWith('share=')) return null;
    const token = decodeURIComponent(clean.slice('share='.length));
    if (!token) return null;

    let jsonBytes: Uint8Array;
    if (token.startsWith('z1.') && typeof DecompressionStream !== 'undefined') {
      const compressed = base64UrlToBytes(token.slice(3));
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      jsonBytes = new Uint8Array(buf);
    } else if (token.startsWith('u1.')) {
      jsonBytes = base64UrlToBytes(token.slice(3));
    } else {
      jsonBytes = base64UrlToBytes(token);
    }

    const jsonText = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(jsonText) as SharedQuotePayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.state) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to decode shared quote URL:', err);
    return null;
  }
}
