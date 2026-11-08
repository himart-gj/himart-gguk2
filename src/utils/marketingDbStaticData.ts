import { ADMIN_PIN_CODE } from './careTableParser';
import { DEFAULT_OWNER_BUSINESS_CARD_DATA_URI } from './ownerBusinessCardAsset';
import {
  getOrCreateMonthSchedule,
  isOffDayCode,
  loadAllSchedules,
} from '../components/ScheduleModal';
import {
  getCachedCustomers,
  setCachedCustomers,
  syncCustomerToGas,
} from '../crm/services/gasApi';
import { getNowDateTimeStr, getTodayStr } from '../crm/utils/date';
import { CustomerItem, CustomerStatus } from '../crm/types/crm';
import {
  MARKETING_DB_UPDATED_EVENT,
  OWNER_DB_CUSTOM_PIN_KEY,
  OWNER_DB_UNLOCKED_KEY,
  HandoverStaffOption,
  MarketingDbConfig,
  MarketingDbStore,
  MarketingLeadItem,
  MarketingLeadStatus,
  MarketingSmsTemplate,
} from './marketingDbEngine';


export interface RawSeedRow {
  metaId: string;
  createdAt: string;
  name: string;
  phone: string;
  benefit: string;
  contact: string;
  memoStatus: MarketingLeadStatus;
  memo: string;
}

export const DEFAULT_SMS_TEMPLATES: MarketingSmsTemplate[] = [
  {
    id: 'tpl-default-1',
    title: '1번 기본 1차 상담예약 안내 문자 (인스타·페북 자동변환)',
    body: [
      '안녕하세요 {고객명} 고객님 :)',
      '롯데하이마트 경기광주점 국지현입니다.',
      '',
      '{플랫폼}으로 상담예약 신청해주셔서 연락드립니다.',
      '하단 내용을 남겨주시면 견적진행하여 안내해드리겠습니다.',
      '',
      '- 이사/입주/웨딩/일반 중 택1',
      '- 상담희망 품목 or 견적서 공유',
      '- 희망하는 브랜드',
      '- 배송예정일',
    ].join('\n'),
  },
  {
    id: 'tpl-sangjo-2',
    title: '2번 상조(라이프케어) 결합 상담예약 안내 문자 (인스타·페북 자동변환)',
    body: [
      '안녕하세요 {고객명} 고객님 :)',
      '롯데하이마트 경기광주점 국지현입니다.',
      '',
      '{플랫폼}으로 라이프케어 결합 가전 상담예약 신청해주셔서 연락드립니다.',
      '하단 내용을 남겨주시면 결합 지원 혜택 포함하여 견적진행 후 안내해드리겠습니다.',
      '',
      '- 이사/입주/웨딩/일반 중 택1',
      '- 상담희망 품목 or 견적서 공유',
      '- 희망하는 브랜드',
      '- 배송예정일',
    ].join('\n'),
  },
  {
    id: 'tpl-followup-3',
    title: '3번 무응답 고객 2차 리마인드 안부 문자',
    body: [
      '안녕하세요 {고객명} 고객님, 롯데하이마트 경기광주점 국지현입니다 :)',
      '',
      '지난번 인스타로 신청해 주신 가전 혜택 관련하여 혹시 바쁘셔서 확인 못 하셨을까 하여 다시 한번 안내 남깁니다.',
      '부담 없이 품목만 문자로 남겨주셔도 비대면 비교 견적서 바로 보내드리니 편하실 때 답장 주세요!',
    ].join('\n'),
  },
];

// 구글 드라이브 [인스타 광고 전용 DB] 실제 최신 접수분 (13건 전수 반영) 초기 시드
export const INITIAL_SHEET_SEED_ROWS: RawSeedRow[] = [
  {
    metaId: 'l:1463204865750517',
    createdAt: '2026-11-04 18:23',
    name: '제이',
    phone: 'p:528445069585',
    benefit: '단품 가전 오픈 특가',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:1419806016529181',
    createdAt: '2026-11-04 15:26',
    name: '신정민',
    phone: '010-7106-7294',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:29287341927528843',
    createdAt: '2026-11-04 08:09',
    name: '81jyn',
    phone: '010-3797-5442',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:2024132818294855',
    createdAt: '2026-11-04 01:36',
    name: '유재영',
    phone: '010-5568-4564',
    benefit: '상조 결합 가전 최대지원 혜택(구매 부담 경감)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '',
  },
  {
    metaId: 'l:1593681889225701',
    createdAt: '2026-11-03 18:51',
    name: '권정호',
    phone: '010-7360-2686',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1269058239023204',
    createdAt: '2026-11-03 17:19',
    name: '송창호',
    phone: '010-3401-3217',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:2260340468246285',
    createdAt: '2026-11-03 13:47',
    name: '박새임',
    phone: '010-7172-1735',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1396944562253043',
    createdAt: '2026-11-03 11:45',
    name: '서예나',
    phone: '010-3459-6565',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1080425961483080',
    createdAt: '2026-11-03 09:39',
    name: '장은서',
    phone: '010-5712-8232',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1523886646215663',
    createdAt: '2026-11-03 09:19',
    name: '이윤경',
    phone: '010-7272-6687',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1159992053201721',
    createdAt: '2026-11-03 07:37',
    name: '엄마',
    phone: '010-4615-0342',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1961742325209110',
    createdAt: '2026-11-03 06:51',
    name: '이노훈',
    phone: '010-7474-0526',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '문자전송',
    memo: '문자보냄',
  },
  {
    metaId: 'l:1143932378073456',
    createdAt: '2026-11-01 16:49',
    name: '국지현',
    phone: '010-5174-5672',
    benefit: '이사,혼수 세트가전(삼성,lg 오픈점 최대 지원)',
    contact: '비대면 카톡/문자/전화로 견적 먼저 받기',
    memoStatus: '신규',
    memo: '테스트 접수',
  },
];

// 11월 3일 초기 시드에서 실제 문자 발송이 완료되었던 8명의 전화번호 세트
// (구글시트 ⭐한글_고객명부 H열에 수식/드래그로 '문자보냄'이 일괄 채워져 있어도 신규 고객이 '문자전송'으로 오분류되지 않도록 보호)
export const LEGACY_INITIAL_SENT_PHONES = new Set<string>(
  INITIAL_SHEET_SEED_ROWS.filter((r) => r.memoStatus === '문자전송').map((r) =>
    r.phone.replace(/\D/g, '')
  )
);

// ==================== 시트 비공개 100% 유지용 전용 Apps Script 코드 생성기 ====================

export function getReadyMadeAppsScriptCode(): string {
  return `// =========================================================================
// [롯데하이마트 경기광주점 - 국지현 전용 인스타 광고 DB 실시간 양방향 연동 스크립트]
// 사용법:
// 1. [인스타 광고 전용 DB] 구글시트 상단 메뉴 [확장 프로그램] -> [Apps Script] 클릭
// 2. 기존 코드를 지우고 아래 코드를 그대로 붙여넣은 뒤 💾 저장
// 3. 우측 상단 [배포] -> [새 배포] -> 유형: [웹 앱] 선택
//    - 다음 사용자 인증 정보로 실행: [나]
//    - 액세스 권한이 있는 사용자: [모든 사용자] (시트 원본은 비공개 그대로 안전하게 유지됩니다!)
// 4. 배포 후 나오는 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 앱에 붙여넣기!
// =========================================================================

const BACKUP_SHEET_NAME = '_앱DB관리백업';

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const outSheets = [];

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const name = sh.getName();
    if (name === BACKUP_SHEET_NAME) continue;
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 2) continue;
    const values = sh.getDisplayValues();
    outSheets.push({ name: name, rows: values });
  }

  let backupState = null;
  const backupSh = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (backupSh && backupSh.getLastRow() >= 1) {
    try {
      const rawJson = backupSh.getRange(1, 1).getValue();
      if (rawJson) backupState = JSON.parse(rawJson);
    } catch (err) {}
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheets: outSheets, backupState: backupState }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'saveBackupState' && body.backupState) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let backupSh = ss.getSheetByName(BACKUP_SHEET_NAME);
      if (!backupSh) {
        backupSh = ss.insertSheet(BACKUP_SHEET_NAME);
        backupSh.hideSheet();
      }
      backupSh.getRange(1, 1).setValue(JSON.stringify(body.backupState));
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}

// ==================== 명함 이미지 자동 동봉 (PNG 클립보드 복사 & MMS/카톡 파일 공유) ====================

export function getEffectiveBusinessCardDataUri(config?: MarketingDbConfig): string {
  const custom = (config?.businessCardDataUri || '').trim();
  return custom.startsWith('data:image/')
    ? custom
    : DEFAULT_OWNER_BUSINESS_CARD_DATA_URI;
}

export function dataUriToBlob(dataUri: string): Blob {
  const parts = dataUri.split(',');
  const mimeMatch = (parts[0] || '').match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1] || '');
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
}

export function dataUriToPngBlob(dataUri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Browser environment required'));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 993;
        canvas.height = img.naturalHeight || img.height || 552;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG conversion failed'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUri;
  });
}

let cachedCardSourceUri = '';
let cachedCardPngBlob: Blob | null = null;
let cachedCardPngPromise: Promise<Blob> | null = null;
let cachedCardShareFile: File | null = null;

export function getOrBuildShareFileSync(dataUri: string): File {
  if (cachedCardSourceUri === dataUri && cachedCardShareFile) {
    return cachedCardShareFile;
  }
  const blob = dataUriToBlob(dataUri);
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const file = new File(
    [blob],
    `롯데하이마트_경기광주점_국지현_명함.${ext}`,
    { type: blob.type || 'image/jpeg' }
  );
  cachedCardSourceUri = dataUri;
  cachedCardShareFile = file;
  return file;
}

export function warmUpBusinessCardCacheWithUri(uri: string): void {
  if (typeof window === 'undefined' || !uri) return;
  try {
    getOrBuildShareFileSync(uri);
  } catch {
    // ignore
  }
  if (cachedCardSourceUri === uri && (cachedCardPngBlob || cachedCardPngPromise)) {
    return;
  }
  cachedCardPngBlob = null;
  cachedCardPngPromise = dataUriToPngBlob(uri)
    .then((b) => {
      if (cachedCardSourceUri === uri) {
        cachedCardPngBlob = b;
      }
      return b;
    })
    .catch((e) => {
      cachedCardPngPromise = null;
      throw e;
    });
}

function copyPhoneSyncPreservingGesture(rawPhone?: string): boolean {
  const cleanPhone = (rawPhone || '').replace(/\D/g, '');
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

export async function copyBusinessCardImageToClipboard(
  dataUri: string
): Promise<boolean> {
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (!navigator.clipboard?.write || !ClipboardItemCtor) {
      return false;
    }
    let pngBlob =
      cachedCardSourceUri === dataUri && cachedCardPngBlob
        ? cachedCardPngBlob
        : null;
    if (!pngBlob) {
      warmUpBusinessCardCacheWithUri(dataUri);
      pngBlob = await (cachedCardPngPromise || dataUriToPngBlob(dataUri));
    }
    try {
      const item = new ClipboardItemCtor({ 'image/png': pngBlob });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      const safariItem = new ClipboardItemCtor({
        'image/png': Promise.resolve(pngBlob),
      });
      await navigator.clipboard.write([safariItem]);
      return true;
    }
  } catch {
    return false;
  }
}

export async function shareBusinessCardFileWithText(params: {
  dataUri: string;
  bodyText: string;
  customerPhone?: string;
}): Promise<'shared' | 'cancelled' | 'unsupported'> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return 'unsupported';
    }
    copyPhoneSyncPreservingGesture(params.customerPhone);

    const file = getOrBuildShareFileSync(params.dataUri);
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

// ==================== 1. 국지현 전용 스텔스 잠금 제어 ====================

export function getOwnerDbPin(): string {
  try {
    const custom = (localStorage.getItem(OWNER_DB_CUSTOM_PIN_KEY) || '').trim();
    if (custom.length >= 4) return custom;
  } catch {
    // ignore
  }
  return ADMIN_PIN_CODE;
}

export function setOwnerDbPin(nextPin: string): boolean {
  const cleaned = (nextPin || '').trim();
  if (cleaned.length < 4) return false;
  try {
    localStorage.setItem(OWNER_DB_CUSTOM_PIN_KEY, cleaned);
    return true;
  } catch {
    return false;
  }
}

export function isOwnerMarketingDbUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // URL에 ?ownerdb=462846 등이 전달되면 즉시 기기 인증 후 URL 파라미터 흔적 자동 제거
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get('ownerdb');
    if (urlKey && (urlKey.trim() === getOwnerDbPin() || urlKey.trim() === ADMIN_PIN_CODE)) {
      localStorage.setItem(OWNER_DB_UNLOCKED_KEY, '1');
      params.delete('ownerdb');
      const rest = params.toString();
      const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
      return true;
    }
    return localStorage.getItem(OWNER_DB_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function verifyAndUnlockOwnerDb(pinInput: string): boolean {
  const cleaned = (pinInput || '').trim().replace(/^#(?:db)?/i, '');
  if (!cleaned) return false;
  if (cleaned === getOwnerDbPin() || cleaned === ADMIN_PIN_CODE) {
    try {
      localStorage.setItem(OWNER_DB_UNLOCKED_KEY, '1');
      window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

export function lockOwnerMarketingDb(): void {
  try {
    localStorage.removeItem(OWNER_DB_UNLOCKED_KEY);
    window.dispatchEvent(new CustomEvent(MARKETING_DB_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

// ==================== 2. 전화번호 · 날짜 · 자동 한줄 요약 정규화 ====================

export function normalizeKoreanLeadPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let s = String(rawPhone).trim();
  // Meta Lead Ads prefix 제거 ('p:+8210...', 'p:010...')
  s = s.replace(/^p:\s*/i, '');
  if (s.startsWith('+82')) {
    s = '0' + s.slice(3).replace(/^[\s-]+/, '');
  } else if (s.startsWith('8210') && s.replace(/\D/g, '').length === 12) {
    s = '0' + s.replace(/\D/g, '').slice(2);
  }
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  // 엑셀에서 앞자리 0이 잘려 10XXXXXXXX으로 들어온 경우 복원
  const normDigits =
    digits.length === 10 && digits.startsWith('10') ? `0${digits}` : digits;

  if (normDigits.length === 11) {
    return `${normDigits.slice(0, 3)}-${normDigits.slice(3, 7)}-${normDigits.slice(7)}`;
  }
  if (normDigits.length === 10) {
    return `${normDigits.slice(0, 3)}-${normDigits.slice(3, 6)}-${normDigits.slice(6)}`;
  }
  return normDigits;
}

export function normalizeLeadDateTime(rawDate?: string | null): {
  createdAt: string;
  yearMonth: string;
} {
  const fallbackNow = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatKstFromUtcMs = (utcEpochMs: number) => {
    const kst = new Date(utcEpochMs + 9 * 3600 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = pad(kst.getUTCMonth() + 1);
    const dd = pad(kst.getUTCDate());
    const hh = pad(kst.getUTCHours());
    const mi = pad(kst.getUTCMinutes());
    return {
      createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  };

  const s = String(rawDate ?? '').trim();
  if (!s) return formatKstFromUtcMs(fallbackNow.getTime());

  // 1) 한국어 '2026. 11. 4. 오후 3:26' 또는 '2026-11-04 오전 8:09'
  const korAmPm = s.match(
    /^(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})[.\s]*(?:(오전|오후)\s*)?(\d{1,2})?:?(\d{1,2})?/
  );
  if (korAmPm && !s.includes('T')) {
    const yyyy = korAmPm[1];
    const mm = pad(Number(korAmPm[2]));
    const dd = pad(Number(korAmPm[3]));
    let hhNum = Number(korAmPm[5] || 0);
    const ampm = korAmPm[4];
    if (ampm === '오후' && hhNum < 12) hhNum += 12;
    if (ampm === '오전' && hhNum === 12) hhNum = 0;
    const hh = pad(hhNum);
    const mi = pad(Number(korAmPm[6] || 0));
    return {
      createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  }

  // 2) SheetJS 미국식 '11/4/26 15:26' 또는 '11/04/2026 3:26 PM'
  const usMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?(?:\s*(AM|PM))?)?$/i
  );
  if (usMatch) {
    const rawYear = Number(usMatch[3]);
    const yyyy = String(rawYear < 100 ? 2000 + rawYear : rawYear);
    const mm = pad(Number(usMatch[1]));
    const dd = pad(Number(usMatch[2]));
    let hhNum = Number(usMatch[4] || 0);
    const ampm = (usMatch[6] || '').toUpperCase();
    if (ampm === 'PM' && hhNum < 12) hhNum += 12;
    if (ampm === 'AM' && hhNum === 12) hhNum = 0;
    const hh = pad(hhNum);
    const mi = pad(Number(usMatch[5] || 0));
    return {
      createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
      yearMonth: `${yyyy}-${mm}`,
    };
  }

  // 3) 엑셀 숫자 시리얼 (예: 46330.643)
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 40000 && serial < 60000) {
      const utcDays = Math.floor(serial - 25569);
      const frac = serial - Math.floor(serial);
      const totalMinutes = Math.round(frac * 24 * 60);
      const dObj = new Date(utcDays * 86400 * 1000);
      const yyyy = dObj.getUTCFullYear();
      const mm = pad(dObj.getUTCMonth() + 1);
      const dd = pad(dObj.getUTCDate());
      const hh = pad(Math.floor(totalMinutes / 60) % 24);
      const mi = pad(totalMinutes % 60);
      return {
        createdAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`,
        yearMonth: `${yyyy}-${mm}`,
      };
    }
  }

  // 4) ISO 타임스탬프 (예: 2026-11-03T18:09:39-05:00) -> KST(+09:00) 변환
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    return formatKstFromUtcMs(parsed);
  }

  return formatKstFromUtcMs(fallbackNow.getTime());
}

export function cleanMetaFieldText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildLeadAutoSummary(params: {
  interestBenefit?: string;
  preferredContact?: string;
  platform?: string;
  campaignName?: string;
}): string {
  const benefitRaw = cleanMetaFieldText(params.interestBenefit);
  const contactRaw = cleanMetaFieldText(params.preferredContact);
  const platformRaw = cleanMetaFieldText(params.platform);

  const platformTag =
    platformRaw.toLowerCase() === 'ig' || platformRaw.includes('인스타')
      ? '인스타'
      : platformRaw.toLowerCase() === 'fb' || platformRaw.includes('페이스')
      ? '페이스북'
      : platformRaw || '메타광고';

  let shortBenefit = benefitRaw;
  if (benefitRaw.includes('이사') && benefitRaw.includes('혼수')) {
    shortBenefit = '이사·혼수 세트가전(삼성/LG 오픈점 최대지원) 희망';
  } else if (benefitRaw.includes('상조') && benefitRaw.includes('결합')) {
    shortBenefit = '상조결합 가전 최대지원(구매부담 경감) 희망';
  } else if (benefitRaw.includes('구독')) {
    shortBenefit = '가전 구독 케어·월 체감가 혜택 희망';
  } else if (benefitRaw) {
    shortBenefit = `${benefitRaw} 관심`;
  } else {
    shortBenefit = '맞춤 가전 혜택 상담 요청';
  }

  let shortContact = contactRaw;
  if (contactRaw.includes('비대면')) {
    shortContact = '비대면(카톡·문자·전화) 선견적 요청';
  } else if (contactRaw.includes('방문') || contactRaw.includes('매장')) {
    shortContact = '매장 방문 상담 희망';
  } else if (contactRaw.includes('전화')) {
    shortContact = '전화 상담 희망';
  }

  const parts = [`[${platformTag}]`, shortBenefit];
  if (shortContact) parts.push(`· ${shortContact}`);
  return parts.join(' ');
}

export function makeLeadFingerprint(
  customerName: string,
  phone: string,
  createdAt: string,
  rawMetaLeadId?: string
): string {
  if (rawMetaLeadId && rawMetaLeadId.trim()) {
    return `meta_${rawMetaLeadId.trim()}`;
  }
  const cleanDigits = normalizeKoreanLeadPhone(phone).replace(/\D/g, '');
  const cleanDate = (createdAt || '').slice(0, 16).trim();
  const cleanName = (customerName || '').trim().toLowerCase();
  if (cleanDigits) {
    return `ph_${cleanDigits}_${cleanDate.slice(0, 10)}`;
  }
  return `nm_${cleanName}_${cleanDate}`;
}

export function resolveLeadPlatformDisplayName(rawPlatform?: string | null): string {
  const p = String(rawPlatform || '').trim().toLowerCase();
  if (p === 'fb' || p.includes('facebook') || p.includes('페이스') || p.includes('페북')) {
    return '페이스북';
  }
  if (p === 'ig' || p.includes('insta') || p.includes('인스타')) {
    return '인스타그램';
  }
  return '인스타·페이스북';
}

export function renderSmsTemplateForLead(
  templateBody: string,
  lead: MarketingLeadItem
): string {
  const shortBenefit = lead.interestBenefit.includes('상조')
    ? '라이프케어 결합 가전 최대지원'
    : lead.interestBenefit.includes('이사') || lead.interestBenefit.includes('혼수')
    ? '이사·혼수 세트가전 오픈점 최대지원'
    : cleanMetaFieldText(lead.interestBenefit) || '맞춤 가전 최대 혜택';

  const platformName = resolveLeadPlatformDisplayName(lead.platform);

  return (templateBody || '')
    .replace(/\{고객명\}/g, lead.customerName || '고객')
    .replace(/\{플랫폼\}/g, platformName)
    .replace(/\{연락처\}/g, lead.phone || '')
    .replace(/\{희망혜택\}/g, shortBenefit)
    .replace(/\{안내방식\}/g, cleanMetaFieldText(lead.preferredContact) || '비대면 견적')
    .replace(/\{요약\}/g, lead.autoSummary || shortBenefit)
    .replace(/\{담당자\}/g, '국지현');
}


// ==================== 4. 좀비/중복 원천 차단 지문(Tombstone) & 자가치유 저장소 ====================

const BOGUS_META_SYSTEM_NAMES = new Set([
  '새 잠재 고객 광고',
  '새 잠재 고객 광고 세트',
  '11월 리뉴얼 광고',
  '잠재 고객 광고',
  '11월 리뉴얼x블프 26초 릴스 광고',
  '11월 리뉴얼x블프 릴스 전용 세트',
  '11월 리뉴얼x블프 릴스 전용 광고',
]);

export function isBogusMetaSystemName(name?: string | null): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (BOGUS_META_SYSTEM_NAMES.has(n)) return true;
  if (n.startsWith('제목 없는 양식')) return true;
  if (/^(ag|as|c|f|l):\d+$/i.test(n)) return true;
  return false;
}

export function getCanonicalPhoneDigits(rawPhone?: string | null): string {
  const norm = normalizeKoreanLeadPhone(rawPhone);
  return norm.replace(/\D/g, '');
}


// ==================== 5. 휴무표 직원 연동 ('미화' 직군 자동 제외) ====================

export function loadHandoverStaffOptions(): HandoverStaffOption[] {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dStr = String(now.getDate());
  const schedules = loadAllSchedules();
  const month = getOrCreateMonthSchedule(schedules, ym);

  const seen = new Set<string>();
  const result: HandoverStaffOption[] = [];

  for (const emp of month.employees || []) {
    const name = String(emp.name || '').trim();
    const role = String(emp.role || '').trim();
    if (!name || seen.has(name)) continue;
    if (role.includes('미화') || name.includes('미화')) continue;
    if (name === '국지현') continue;

    seen.add(name);
    const todayCode = String(emp.days?.[dStr] || '').trim();
    result.push({
      name,
      role,
      isOffToday: isOffDayCode(todayCode),
      todayCode,
    });
  }

  return result;
}

// ==================== 6. 구글시트 CSV / XLSX / 복붙 지능형 파서 & 무충돌 병합기 ====================

export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');
  const isTsv =
    clean.split('\n')[0]?.includes('\t') && !clean.split('\n')[0]?.includes(',');
  const delim = isTsv ? '\t' : ',';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(cur.trim());
        cur = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cur.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        cur = '';
        i++;
      } else if (ch === '\n') {
        row.push(cur.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

/**
 * 시트 '상담 상태' 열만 엄격하게 판독 (진행 메모 열의 드래그된 '문자보냄' 등으로 인해
 * 신규 고객이나 다른 상태 고객이 '문자전송'으로 오분류되는 현상 원천 차단!)
 */
function mapSheetStatusToLeadStatus(rawStatus?: string): MarketingLeadStatus {
  const st = String(rawStatus || '').trim();
  if (!st || st.includes('신규')) return '신규';
  if (st.includes('계약완료') || st.includes('결제완료')) return '계약완료';
  if (st.includes('인계')) return '타직원인계';
  if (st.includes('상담진행') || st.includes('상담전환')) return '상담진행중';
  if (st.includes('무응답') || st.includes('부재')) return '무응답';
  if (st.includes('문자전송') || st.includes('문자보냄') || st.includes('문자발송'))
    return '문자전송';
  return '신규';
}

export interface ParsedIncomingLead {
  metaId?: string;
  createdAt: string;
  yearMonth: string;
  customerName: string;
  phone: string;
  interestBenefit: string;
  preferredContact: string;
  platform: string;
  campaignName?: string;
  initialStatus: MarketingLeadStatus;
  initialMemo: string;
}

const META_SYSTEM_HEADERS = new Set([
  'id',
  'ad_id',
  'ad_name',
  'adset_id',
  'adset_name',
  'campaign_id',
  'campaign_name',
  'form_id',
  'form_name',
  'is_organic',
  'lead_status',
]);

export function extractLeadsFromMatrix(matrix: string[][]): ParsedIncomingLead[] {
  if (!matrix || matrix.length < 2) return [];
  const header = matrix[0].map((h) => String(h ?? '').trim().toLowerCase());

  // 키워드 우선순위대로 ① 정확 일치 먼저 탐색 -> ② 시스템 열(ad_name 등)을 제외한 부분 일치 탐색!
  const findCol = (keywords: string[], allowMetaSystem = false): number => {
    for (const kw of keywords) {
      const exactIdx = header.indexOf(kw);
      if (exactIdx >= 0) return exactIdx;
    }
    for (const kw of keywords) {
      const subIdx = header.findIndex((h) => {
        if (!h) return false;
        if (!allowMetaSystem && META_SYSTEM_HEADERS.has(h)) return false;
        return h.includes(kw);
      });
      if (subIdx >= 0) return subIdx;
    }
    return -1;
  };

  const isMetaRawTab =
    header.includes('full_name') ||
    header.includes('phone_number') ||
    header.includes('created_time');

  const out: ParsedIncomingLead[] = [];

  if (isMetaRawTab) {
    const idIdx = header.indexOf('id');
    const timeIdx = findCol(['created_time', '접수일시'], true);
    const campIdx = findCol(['campaign_name', 'ad_name'], true);
    const platIdx = findCol(['platform', '플랫폼'], true);
    const nameIdx = findCol(['full_name', '고객명', '성함', '이름', 'name'], false);
    const phoneIdx = findCol(['phone_number', '연락처', '전화번호', '휴대폰', 'phone'], false);
    const benefitIdx = findCol(['혜택', '품목', '관심', '궁금'], false);
    const contactIdx = findCol(['방식', '안내', '상담'], false);

    for (let r = 1; r < matrix.length; r++) {
      const cols = matrix[r];
      const rawName = (nameIdx >= 0 ? cols[nameIdx] : '') || '';
      const rawPhone = (phoneIdx >= 0 ? cols[phoneIdx] : '') || '';
      const phone = normalizeKoreanLeadPhone(rawPhone);
      if ((!rawName.trim() || isBogusMetaSystemName(rawName)) && !phone) continue;

      const { createdAt, yearMonth } = normalizeLeadDateTime(
        timeIdx >= 0 ? cols[timeIdx] : ''
      );
      const benefit = cleanMetaFieldText(benefitIdx >= 0 ? cols[benefitIdx] : '');
      const contact = cleanMetaFieldText(contactIdx >= 0 ? cols[contactIdx] : '');
      const rawPlat = (platIdx >= 0 ? cols[platIdx] : 'ig') || 'ig';
      const platform =
        rawPlat.toLowerCase() === 'ig'
          ? '인스타그램'
          : rawPlat.toLowerCase() === 'fb'
          ? '페이스북'
          : rawPlat;

      const digits = getCanonicalPhoneDigits(phone);
      const isLegacySent = digits.length >= 7 && LEGACY_INITIAL_SENT_PHONES.has(digits);

      out.push({
        metaId: idIdx >= 0 ? cols[idIdx] : undefined,
        createdAt,
        yearMonth,
        customerName: !isBogusMetaSystemName(rawName) ? rawName.trim() : '인스타 상담고객',
        phone,
        interestBenefit: benefit,
        preferredContact: contact,
        platform,
        campaignName: campIdx >= 0 ? cols[campIdx] : undefined,
        initialStatus: isLegacySent ? '문자전송' : '신규',
        initialMemo: isLegacySent ? '문자보냄' : '',
      });
    }
  } else {
    // ⭐한글_고객명부 또는 일반 한글 시트 구조
    // 빈 열 패딩 제거 후 실제 유효 헤더 길이 산출
    let effectiveHeaderLen = header.length;
    while (effectiveHeaderLen > 0 && !header[effectiveHeaderLen - 1]) {
      effectiveHeaderLen--;
    }
    if (effectiveHeaderLen < 2) return [];

    const dateIdx = findCol(['접수일시', '일시', '날짜', 'date']);
    const nameIdx = findCol(['고객명', '이름', '성함', 'full_name', 'name']);
    const phoneIdx = findCol(['연락처', '전화번호', '전화', '휴대폰', 'phone']);
    const benefitIdx = findCol(['혜택', '품목', '관심', '문의']);
    const contactIdx = findCol(['방식', '안내']);
    const platIdx = findCol(['플랫폼', '채널', '유입']);
    const statusIdx = findCol(['상담 상태', '진행 상태', '발송 상태', '상태']);
    const memoIdx = findCol(['진행 메모', '메모', '비고']);

    for (let r = 1; r < matrix.length; r++) {
      const rawCols = matrix[r];
      let effectiveColLen = rawCols.length;
      while (effectiveColLen > effectiveHeaderLen && !String(rawCols[effectiveColLen - 1] || '').trim()) {
        effectiveColLen--;
      }
      const cols = rawCols.slice(0, Math.max(effectiveHeaderLen, effectiveColLen));

      const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0] || '';
      const rawName = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
      const rawPhone = phoneIdx >= 0 ? cols[phoneIdx] : cols[2] || '';
      const phone = normalizeKoreanLeadPhone(rawPhone);
      if ((!rawName.trim() || isBogusMetaSystemName(rawName)) && !phone) continue;

      const extraCols = Math.max(0, cols.length - effectiveHeaderLen);
      const rawBenefit =
        benefitIdx >= 0
          ? cols.slice(benefitIdx, benefitIdx + 1 + extraCols).join(', ')
          : cols[3] || '';
      const rawContact =
        contactIdx >= 0 ? cols[contactIdx + extraCols] || '' : '';
      const rawPlat =
        platIdx >= 0 ? cols[platIdx + extraCols] || '인스타그램' : '인스타그램';
      const rawStatus =
        statusIdx >= 0 ? cols[statusIdx + extraCols] || '' : '';
      const rawMemo =
        memoIdx >= 0 ? cols[memoIdx + extraCols] || '' : '';

      const { createdAt, yearMonth } = normalizeLeadDateTime(rawDate);
      const digits = getCanonicalPhoneDigits(phone);
      const isLegacySent = digits.length >= 7 && LEGACY_INITIAL_SENT_PHONES.has(digits);
      const parsedSheetStatus = mapSheetStatusToLeadStatus(rawStatus);
      // ⭐한글_고객명부 H열에 드래그되어 있는 기본 '문자보냄' 텍스트가 신규 고객을 '문자전송' 상태로 오염시키지 않도록 방어
      const cleanedMemo =
        rawMemo.trim() === '문자보냄' && !isLegacySent ? '' : rawMemo.trim();

      out.push({
        createdAt,
        yearMonth,
        customerName: !isBogusMetaSystemName(rawName) ? rawName.trim() : '인스타 상담고객',
        phone,
        interestBenefit: cleanMetaFieldText(rawBenefit),
        preferredContact: cleanMetaFieldText(rawContact),
        platform: resolveLeadPlatformDisplayName(rawPlat),
        initialStatus: isLegacySent ? '문자전송' : parsedSheetStatus,
        initialMemo: cleanedMemo,
      });
    }
  }

  return out;
}

/**
 * 두 개 이상의 시트 탭(⭐한글_고객명부 + 메타 원본 탭)에서 동일 고객이 중복 추출될 때
 * 병합 전에 먼저 단일 레코드로 통합하여 metaId·전화번호·고객명을 모두 갖춘 상태로 차단 지문(Tombstone)을 대조합니다.
 */
export function consolidateIncomingLeadsAcrossTabs(
  incoming: ParsedIncomingLead[]
): ParsedIncomingLead[] {
  const consolidatedMap = new Map<string, ParsedIncomingLead>();
  for (const inc of incoming || []) {
    if (!inc) continue;
    const digits = getCanonicalPhoneDigits(inc.phone);
    const cleanName = String(inc.customerName || '').trim().toLowerCase();
    const date10 = String(inc.createdAt || '').slice(0, 10);
    const key =
      digits.length >= 7
        ? `ph_${digits}`
        : cleanName && !isBogusMetaSystemName(cleanName)
        ? `nm_${cleanName}_${date10}`
        : `meta_${inc.metaId || Math.random()}`;

    const prev = consolidatedMap.get(key);
    if (!prev) {
      consolidatedMap.set(key, { ...inc });
    } else {
      consolidatedMap.set(key, {
        metaId: prev.metaId || inc.metaId,
        createdAt: prev.createdAt || inc.createdAt,
        yearMonth: prev.yearMonth || inc.yearMonth,
        customerName: !isBogusMetaSystemName(prev.customerName)
          ? prev.customerName
          : inc.customerName,
        phone: prev.phone || inc.phone,
        interestBenefit: prev.interestBenefit || inc.interestBenefit,
        preferredContact: prev.preferredContact || inc.preferredContact,
        platform: prev.platform || inc.platform,
        campaignName: prev.campaignName || inc.campaignName,
        initialStatus:
          prev.initialStatus !== '신규' ? prev.initialStatus : inc.initialStatus,
        initialMemo: prev.initialMemo || inc.initialMemo,
      });
    }
  }
  return Array.from(consolidatedMap.values());
}

export async function pushMarketingStateToGasBackup(
  store: MarketingDbStore
): Promise<void> {
  const gasUrl = (store.config.gasWebAppUrl || '').trim();
  if (!gasUrl || !/^https?:\/\//i.test(gasUrl)) return;
  try {
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveBackupState',
        backupState: {
          leads: store.leads,
          deletedFingerprints: store.deletedFingerprints,
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  } catch {
    // 정적/오프라인 시 무시
  }
}

// ==================== 7. 통합 고객관리(CRM) 원터치 카드 자동저장 & 연결 브릿지 ====================

function mapLeadStatusToCrmStatus(st: MarketingLeadStatus): CustomerStatus {
  if (st === '계약완료') return '계약완료';
  if (st === '상담진행중') return '상담진행중';
  if (st === '무응답') return '미구매/고민중';
  return '신규/미발송';
}

function mergeLeadMemoWithoutDuplicates(
  existingMemo: string | undefined,
  lead: MarketingLeadItem
): string {
  const baseTag = `[인스타 광고 DB · ${lead.createdAt}] ${lead.autoSummary}`;
  const extraLines = [
    lead.memo ? `진행메모: ${lead.memo}` : '',
    lead.handoverStaff ? `상담 인계 확인: ${lead.handoverStaff}` : '',
  ].filter(Boolean);

  const prev = String(existingMemo || '').trim();
  if (!prev) {
    return [baseTag, ...extraLines].join('\n');
  }

  const linesToPrepend: string[] = [];
  if (!prev.includes(`[인스타 광고 DB · ${lead.createdAt}]`)) {
    linesToPrepend.push(baseTag);
  }
  for (const line of extraLines) {
    if (!prev.includes(line)) {
      linesToPrepend.push(line);
    }
  }
  return linesToPrepend.length > 0
    ? `${linesToPrepend.join('\n')}\n${prev}`
    : prev;
}

export async function saveMarketingLeadToCrm(
  lead: MarketingLeadItem,
  options?: { syncRevenue?: boolean; allowRestoreFromTrash?: boolean }
): Promise<{
  savedCustomer: CustomerItem;
  isExistingCustomer: boolean;
}> {
  const current = getCachedCustomers();
  const nowStr = getNowDateTimeStr();
  const todayStr = getTodayStr();
  const targetPhoneDigits = getCanonicalPhoneDigits(lead.phone);
  const targetNameLower = String(lead.customerName || '').trim().toLowerCase();

  // 휴지통 포함 전체 CRM 목록에서 먼저 매칭 확인 (휴지통 고객과 같은 번호로 새 중복 카드가 생성되는 현상 원천 차단!)
  let existingIndex = -1;
  if (lead.linkedCrmCustomerId) {
    existingIndex = current.findIndex((c) => c.id === lead.linkedCrmCustomerId);
  }
  if (existingIndex < 0 && targetPhoneDigits) {
    existingIndex = current.findIndex(
      (c) => getCanonicalPhoneDigits(c.phone) === targetPhoneDigits
    );
  }
  if (existingIndex < 0 && targetNameLower && !targetPhoneDigits) {
    existingIndex = current.findIndex(
      (c) =>
        String(c.name || '').trim().toLowerCase() === targetNameLower &&
        !getCanonicalPhoneDigits(c.phone)
    );
  }

  const mappedStatus = mapLeadStatusToCrmStatus(lead.status);
  const revAmt = Math.max(0, Number(lead.revenueAmount) || 0);

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    // 만약 CRM 휴지통에 들어가 있는 고객인데 자동 저장(allowRestoreFromTrash 아님)으로 호출된 경우 절대 부활시키지 않음!
    if (existing.deletedAt && !options?.allowRestoreFromTrash) {
      return {
        savedCustomer: existing,
        isExistingCustomer: true,
      };
    }
    const isAlreadyConfirmed =
      existing.status === '계약완료' ||
      existing.status === '발송완료' ||
      existing.status === '배송완료';

    const resolvedStatus: CustomerStatus = isAlreadyConfirmed
      ? existing.status
      : lead.status === '계약완료'
      ? '계약완료'
      : existing.status === '신규/미발송' || existing.status === '미구매/고민중'
      ? mappedStatus
      : existing.status;

    const shouldApplyRev = Boolean(options?.syncRevenue && revAmt > 0);
    const hasExistingNet = (Number(existing.netAmount) || 0) > 0;
    const hasExistingPaid = (Number(existing.paidAmount) || 0) > 0;

    const updatedCustomer: CustomerItem = {
      ...existing,
      name: existing.name || lead.customerName.trim(),
      phone: existing.phone || lead.phone.trim(),
      status: resolvedStatus,
      contractDate:
        existing.contractDate ||
        (lead.status === '계약완료' ? lead.createdAt.slice(0, 10) : undefined),
      memo: mergeLeadMemoWithoutDuplicates(existing.memo, lead),
      // 기존 최종혜택가(netAmount)가 있으면 절대 덮어쓰지 않고 보존!
      paidAmount: hasExistingPaid
        ? existing.paidAmount
        : shouldApplyRev
        ? revAmt
        : existing.paidAmount,
      netAmount: hasExistingNet
        ? existing.netAmount
        : shouldApplyRev
        ? revAmt
        : existing.netAmount,
      performanceAmount:
        shouldApplyRev && !((existing.quotes?.length || 0) > 0 && (Number(existing.performanceAmount) || 0) > 0)
          ? revAmt
          : existing.performanceAmount,
      deletedAt: undefined,
      updatedAtMs: Date.now(),
    };

    const nextList = current.map((c, idx) =>
      idx === existingIndex ? updatedCustomer : c
    );
    const deduped = setCachedCustomers(nextList);
    const saved =
      deduped.find((c) => c.id === updatedCustomer.id) || updatedCustomer;
    await syncCustomerToGas('update', saved);
    return {
      savedCustomer: saved,
      isExistingCustomer: true,
    };
  }

  // 신규 고객카드 생성 시에도 0원 가짜 견적(quotes) 없이 깔끔한 고객카드로만 등록!
  const newCustomer: CustomerItem = {
    id: `CUST-${Date.now()}`,
    regDate: nowStr,
    contractDate:
      lead.status === '계약완료' ? lead.createdAt.slice(0, 10) : todayStr,
    name: lead.customerName.trim() || '인스타 상담고객',
    phone: lead.phone.trim(),
    items: cleanMetaFieldText(lead.interestBenefit) || '인스타 광고 상담 고객',
    paidAmount: revAmt,
    netAmount: revAmt,
    expectedBenefit: '',
    saleType: 'general',
    performanceAmount: revAmt,
    generalProductTotal: revAmt,
    subscriptionPrincipal: 0,
    deliveryDate: '',
    followUpDate: '',
    status: mappedStatus,
    memo: mergeLeadMemoWithoutDuplicates('', lead),
    orderNo: '',
    giftItems: '',
    giftSent: false,
    logisticsConfirmed: false,
    quotes: [],
    updatedAtMs: Date.now(),
  };

  const deduped = setCachedCustomers([newCustomer, ...current]);
  const saved = deduped.find((c) => c.id === newCustomer.id) || newCustomer;
  await syncCustomerToGas('create', saved);

  return {
    savedCustomer: saved,
    isExistingCustomer: false,
  };
}
