import { isFriendRestrictedMode } from './friendAccessGuard';
import { idbMirrorGet, idbMirrorSet } from './offlineDbQueue';
import {
  copyBusinessCardImageToClipboard,
  dataUriToBlob,
  getEffectiveBusinessCardDataUri,
  isOwnerMarketingDbUnlocked,
  loadMarketingDbStore,
  warmUpBusinessCardCache,
} from './marketingDbEngine';

export const CONSULTANT_CARD_STORAGE_KEY = 'himart_consultant_business_card_v1';
export const CONSULTANT_CARD_AUTO_INCLUDE_KEY =
  'himart_consultant_card_auto_include_v1';
export const CONSULTANT_CARD_UPDATED_EVENT =
  'himart_consultant_business_card_updated';

let memCardDataUri: string | null = null;
let memAutoInclude: boolean | null = null;

function dispatchCardUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSULTANT_CARD_UPDATED_EVENT));
  }
}

export function loadConsultantBusinessCardDataUri(): string {
  if (memCardDataUri !== null && memCardDataUri.startsWith('data:image/')) {
    return memCardDataUri;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = (localStorage.getItem(CONSULTANT_CARD_STORAGE_KEY) || '').trim();
      if (saved.startsWith('data:image/')) {
        memCardDataUri = saved;
        return saved;
      }
    }
  } catch {
    // ignore
  }

  // 오너 단말기에서 마케팅 DB에 먼저 등록해 둔 명함이 있다면 자동 재사용 (초대 친구 기기는 100% 격리)
  if (!isFriendRestrictedMode() && isOwnerMarketingDbUnlocked()) {
    try {
      const ownerFallback = getEffectiveBusinessCardDataUri(
        loadMarketingDbStore().config
      );
      if (ownerFallback && ownerFallback.startsWith('data:image/')) {
        return ownerFallback;
      }
    } catch {
      // ignore
    }
  }

  return '';
}

export function loadConsultantCardAutoInclude(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CONSULTANT_CARD_AUTO_INCLUDE_KEY);
      if (raw === '0' || raw === 'false') {
        memAutoInclude = false;
        return false;
      }
      if (raw === '1' || raw === 'true') {
        memAutoInclude = true;
        return true;
      }
    }
  } catch {
    // ignore
  }
  if (memAutoInclude !== null) return memAutoInclude;
  return Boolean(loadConsultantBusinessCardDataUri());
}

export function saveConsultantCardAutoInclude(enabled: boolean): void {
  const next = Boolean(enabled);
  memAutoInclude = next;
  const val = next ? '1' : '0';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONSULTANT_CARD_AUTO_INCLUDE_KEY, val);
    }
  } catch {
    // ignore
  }
  void idbMirrorSet(CONSULTANT_CARD_AUTO_INCLUDE_KEY, val);
  dispatchCardUpdated();
}

export function saveConsultantBusinessCardDataUri(dataUri: string): boolean {
  const cleaned = String(dataUri || '').trim();
  if (!cleaned.startsWith('data:image/')) return false;

  memCardDataUri = cleaned;
  memAutoInclude = true;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONSULTANT_CARD_STORAGE_KEY, cleaned);
      localStorage.setItem(CONSULTANT_CARD_AUTO_INCLUDE_KEY, '1');
    }
  } catch {
    // localStorage 5MB 초과 시에도 메모리 + IndexedDB 미러로 보존
  }

  void idbMirrorSet(CONSULTANT_CARD_STORAGE_KEY, cleaned);
  void idbMirrorSet(CONSULTANT_CARD_AUTO_INCLUDE_KEY, '1');
  warmUpBusinessCardCache(cleaned);
  dispatchCardUpdated();
  return true;
}

export function clearConsultantBusinessCardDataUri(): void {
  memCardDataUri = '';
  memAutoInclude = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONSULTANT_CARD_STORAGE_KEY);
      localStorage.setItem(CONSULTANT_CARD_AUTO_INCLUDE_KEY, '0');
    }
  } catch {
    // ignore
  }
  void idbMirrorSet(CONSULTANT_CARD_STORAGE_KEY, '');
  void idbMirrorSet(CONSULTANT_CARD_AUTO_INCLUDE_KEY, '0');
  dispatchCardUpdated();
}

export async function hydrateConsultantBusinessCardFromIdb(): Promise<string> {
  const existing = loadConsultantBusinessCardDataUri();
  if (existing) {
    warmUpBusinessCardCache(existing);
    return existing;
  }
  try {
    const idbCard = await idbMirrorGet<string>(CONSULTANT_CARD_STORAGE_KEY);
    const idbAuto = await idbMirrorGet<string>(CONSULTANT_CARD_AUTO_INCLUDE_KEY);
    if (idbAuto === '0' || idbAuto === '1') {
      memAutoInclude = idbAuto === '1';
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CONSULTANT_CARD_AUTO_INCLUDE_KEY, idbAuto);
        }
      } catch {
        // ignore
      }
    }
    if (typeof idbCard === 'string' && idbCard.startsWith('data:image/')) {
      memCardDataUri = idbCard;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CONSULTANT_CARD_STORAGE_KEY, idbCard);
        }
      } catch {
        // ignore
      }
      warmUpBusinessCardCache(idbCard);
      dispatchCardUpdated();
      return idbCard;
    }
  } catch {
    // ignore
  }
  return '';
}

export function compressBusinessCardFileToDataUri(
  file: File,
  maxEdge = 1280,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (typeof Image === 'undefined' || typeof document === 'undefined') {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('이미지 형식을 불러올 수 없습니다.'));
      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width || 1000;
          const origH = img.naturalHeight || img.height || 600;
          const ratio = Math.min(1, maxEdge / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * ratio));
          const targetH = Math.max(1, Math.round(origH * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function sanitizeFileSegment(raw?: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildConsultantCardShareFile(
  dataUri: string,
  storeName?: string,
  consultantName?: string
): File {
  const blob = dataUriToBlob(dataUri);
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const safeStore = sanitizeFileSegment(storeName) || '롯데하이마트';
  const safeName = sanitizeFileSegment(consultantName);
  const fileName = safeName
    ? `${safeStore}_${safeName}_명함.${ext}`
    : `${safeStore}_명함.${ext}`;
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
}

function copyPhoneSyncForShareSheet(rawPhone?: string): boolean {
  const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
  if (!cleanPhone || typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = cleanPhone;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, cleanPhone.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareConsultantBusinessCardWithText(params: {
  dataUri: string;
  bodyText: string;
  customerPhone?: string;
  storeName?: string;
  consultantName?: string;
}): Promise<'shared' | 'cancelled' | 'unsupported'> {
  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function'
    ) {
      return 'unsupported';
    }
    copyPhoneSyncForShareSheet(params.customerPhone);
    const file = buildConsultantCardShareFile(
      params.dataUri,
      params.storeName,
      params.consultantName
    );
    if (
      typeof navigator.canShare === 'function' &&
      !navigator.canShare({ files: [file] })
    ) {
      return 'unsupported';
    }
    await navigator.share({
      files: [file],
      text: params.bodyText,
    });
    return 'shared';
  } catch (err: any) {
    if (err && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}

export async function copyConsultantCardToClipboard(
  dataUri: string
): Promise<boolean> {
  if (!dataUri || !dataUri.startsWith('data:image/')) return false;
  return copyBusinessCardImageToClipboard(dataUri);
}

export function isAppleTouchDevice(
  uaOverride?: string,
  platformOverride?: string,
  maxTouchPointsOverride?: number
): boolean {
  const ua =
    typeof uaOverride === 'string'
      ? uaOverride
      : typeof navigator !== 'undefined'
      ? navigator.userAgent
      : '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  const platform =
    typeof platformOverride === 'string'
      ? platformOverride
      : typeof navigator !== 'undefined'
      ? navigator.platform || ''
      : '';
  const touchPoints =
    typeof maxTouchPointsOverride === 'number'
      ? maxTouchPointsOverride
      : typeof navigator !== 'undefined'
      ? navigator.maxTouchPoints || 0
      : 0;
  return platform === 'MacIntel' && touchPoints > 1;
}

export function buildNativeSmsHref(
  rawPhone?: string,
  bodyText = '',
  uaOverride?: string,
  platformOverride?: string,
  maxTouchPointsOverride?: number
): string {
  const cleanPhone = String(rawPhone || '').replace(/[^0-9+]/g, '');
  const encodedBody = encodeURIComponent(bodyText);
  const isIOS = isAppleTouchDevice(
    uaOverride,
    platformOverride,
    maxTouchPointsOverride
  );
  if (isIOS) {
    return cleanPhone
      ? `sms:${cleanPhone}&body=${encodedBody}`
      : `sms:?&body=${encodedBody}`;
  }
  return cleanPhone
    ? `sms:${cleanPhone}?body=${encodedBody}`
    : `sms:?body=${encodedBody}`;
}
