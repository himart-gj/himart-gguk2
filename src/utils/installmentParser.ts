import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  GitHubSyncConfig,
  loadGitHubSyncConfig,
  saveGitHubSyncConfig,
} from './careTableParser';
import {
  compressImageFile,
  getEffectiveGeminiApiKey,
} from './aiImageParser';
import { fetchStoreCloudDataset } from './storeCloudSync';

export { loadGitHubSyncConfig, saveGitHubSyncConfig };
export type { GitHubSyncConfig };

export type InstallmentCellKind =
  | 'free' // 무이자 (노란색)
  | 'partial' // 부분무이자 (연분홍)
  | 'sub-free' // 구독 전용 무이자 (파란 테두리/배경 + 구독전용 빨간 글씨)
  | 'interest' // 고객유이자 / 저리할부
  | 'disabled' // 결제불가 (진회색)
  | 'note'; // 기타 안내

export interface InstallmentCellData {
  kind: InstallmentCellKind;
  main: string;
  sub?: string;
}

export interface InstallmentCardColumnDef {
  id: string;
  brand: string;
  subName: string;
  rows: Record<string, InstallmentCellData>;
}

export interface InstallmentQuickSummaryCardItem {
  brandKey: string;
  brandTitle: string;
  badgeColor: string;
  freeInstallment: string;
  partialInstallment: string;
  subInstallment: string;
  specialNotes: string[];
}

export interface InstallmentDataset {
  updatedAt: string;
  fileName: string;
  versionTitle: string;
  warningBanner1: string;
  warningBanner2: string;
  columns: InstallmentCardColumnDef[];
  quickSummaries: InstallmentQuickSummaryCardItem[];
}

export const INSTALLMENT_ROW_LABELS = [
  '2개월',
  '3개월',
  '4개월',
  '5개월',
  '6개월(비고)',
  '7개월',
  '8개월',
  '10개월(비고)',
  '11개월(비고)',
  '12개월(비고)',
  '18개월(비고)',
  '24개월(비고)',
  '36개월(비고)',
  '48/60개월(비고)',
  '기타 안내',
] as const;

const INSTALLMENT_STORAGE_KEY = 'himart_gj_installment_dataset_v1';
const REMOTE_INSTALLMENT_JSON_PATH = './card-installment-data.json';

const INSTALLMENT_COLUMN_SCHEMA_META: {
  id: string;
  brand: string;
  subName: string;
}[] = [
  { id: 'lotte-members', brand: '롯데카드', subName: '멤버스 제휴카드' },
  { id: 'lotte-mobile', brand: '롯데카드', subName: '모바일 제휴카드' },
  { id: 'lotte-hiplan', brand: '롯데카드', subName: 'HI-Plan & 일반신용' },
  { id: 'lotte-class', brand: '롯데카드', subName: '클래스 제휴카드' },
  { id: 'hyundai-general', brand: '현대카드', subName: '일반신용' },
  { id: 'woori-affiliate', brand: '우리카드', subName: '제휴카드' },
  { id: 'woori-general', brand: '우리카드', subName: '일반개인 신용카드' },
  { id: 'gwangju-affiliate', brand: '광주카드', subName: '제휴카드' },
  { id: 'kb-general', brand: 'KB국민', subName: '일반개인 신용카드' },
  { id: 'shinhan-affiliate', brand: '신한카드', subName: '제휴카드' },
  { id: 'shinhan-general', brand: '신한카드', subName: '심플플러스 & 일반개인' },
  { id: 'hana-all', brand: '하나카드', subName: '제휴카드 / 일반개인' },
  { id: 'nh-general', brand: 'NH농협', subName: '일반개인 신용카드' },
  { id: 'samsung-affiliate', brand: '삼성카드', subName: '제휴카드' },
  { id: 'samsung-general', brand: '삼성카드', subName: '일반개인 신용카드' },
  { id: 'bc-general', brand: 'BC카드', subName: '일반개인 신용카드' },
];

function createEmptyInstallmentColumnTemplates(): InstallmentCardColumnDef[] {
  return INSTALLMENT_COLUMN_SCHEMA_META.map((meta) => ({
    ...meta,
    rows: {},
  }));
}

// 보안 정책상 정적 영업 조건/지점 수수료/내부 공지 하드코딩 비움 — 비공개 구글 시트(_매장공유_무이자할부)에서 동적 로드
export const DEFAULT_INSTALLMENT_COLUMNS: InstallmentCardColumnDef[] = [];

export const DEFAULT_QUICK_SUMMARY_CARDS: InstallmentQuickSummaryCardItem[] = [];

export const DEFAULT_INSTALLMENT_DATASET: InstallmentDataset = {
  updatedAt: '',
  fileName: '',
  versionTitle: '',
  warningBanner1: '',
  warningBanner2: '',
  columns: DEFAULT_INSTALLMENT_COLUMNS,
  quickSummaries: DEFAULT_QUICK_SUMMARY_CARDS,
};

function isValidInstallmentDataset(
  data: unknown
): data is InstallmentDataset {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<InstallmentDataset>;
  return Array.isArray(d.columns) && d.columns.length > 0;
}

function normalizeLoadedInstallmentDataset(
  data: InstallmentDataset
): InstallmentDataset {
  return {
    updatedAt: String(data.updatedAt || ''),
    fileName: String(data.fileName || ''),
    versionTitle: String(data.versionTitle || ''),
    warningBanner1: String(data.warningBanner1 || ''),
    warningBanner2: String(data.warningBanner2 || ''),
    columns: data.columns,
    quickSummaries:
      Array.isArray(data.quickSummaries) && data.quickSummaries.length > 0
        ? data.quickSummaries
        : buildQuickSummariesFromColumns(data.columns),
  };
}

export function loadLocalInstallmentDataset(): InstallmentDataset {
  try {
    const raw = localStorage.getItem(INSTALLMENT_STORAGE_KEY);
    if (!raw) return DEFAULT_INSTALLMENT_DATASET;
    const parsed = JSON.parse(raw) as InstallmentDataset;
    if (isValidInstallmentDataset(parsed)) {
      return normalizeLoadedInstallmentDataset(parsed);
    }
    return DEFAULT_INSTALLMENT_DATASET;
  } catch {
    return DEFAULT_INSTALLMENT_DATASET;
  }
}

export const INSTALLMENT_UPDATED_EVENT = 'himart_gj_installment_updated';

export function saveLocalInstallmentDataset(dataset: InstallmentDataset): void {
  try {
    localStorage.setItem(INSTALLMENT_STORAGE_KEY, JSON.stringify(dataset));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(INSTALLMENT_UPDATED_EVENT));
    }
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchRemoteInstallmentDataset(): Promise<InstallmentDataset | null> {
  try {
    // 1순위: 비공개 구글 시트(_매장공유_무이자할부) 클라우드 브릿지에서 직접 로드
    const cloudData = await fetchStoreCloudDataset<InstallmentDataset>(
      'installment'
    );
    if (isValidInstallmentDataset(cloudData)) {
      return normalizeLoadedInstallmentDataset(cloudData);
    }
  } catch {
    // fallback to static endpoint (which may also be bridged)
  }

  try {
    const res = await fetch(
      `${REMOTE_INSTALLMENT_JSON_PATH}?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as InstallmentDataset;
    if (isValidInstallmentDataset(data)) {
      return normalizeLoadedInstallmentDataset(data);
    }
    return null;
  } catch {
    return null;
  }
}

export function downloadInstallmentDatasetAsJson(
  dataset: InstallmentDataset
): void {
  const jsonStr = JSON.stringify(dataset, null, 2);
  const blob = new Blob([jsonStr], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'card-installment-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function encodeUtf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(sub));
  }
  return btoa(binary);
}

export async function pushInstallmentDatasetToGitHub(
  dataset: InstallmentDataset,
  config: GitHubSyncConfig
): Promise<{ ok: boolean; message: string }> {
  const repo = config.repo.trim().replace(/^\/+|\/+$/g, '');
  const branch = (config.branch || 'main').trim();
  const token = config.token.trim();
  const filePath = 'public/card-installment-data.json';

  if (!repo || !token) {
    return {
      ok: false,
      message: 'GitHub 저장소(owner/repo)와 토큰(PAT)이 설정되지 않았습니다.',
    };
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    let sha: string | undefined;
    const getRes = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(branch)}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing?.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return {
        ok: false,
        message: `GitHub 파일 조회 실패 (${getRes.status}): ${errText.slice(0, 120)}`,
      };
    }

    const jsonString = JSON.stringify(dataset, null, 2);
    const contentBase64 = encodeUtf8ToBase64(jsonString);

    const putBody: Record<string, unknown> = {
      message: `chore(installment): update card-installment-data.json (${dataset.versionTitle})`,
      content: contentBase64,
      branch,
    };
    if (sha) {
      putBody.sha = sha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return {
        ok: false,
        message: `GitHub 업로드 실패 (${putRes.status}): ${errText.slice(0, 150)}`,
      };
    }

    return {
      ok: true,
      message:
        '✅ GitHub 저장소에 무이자 할부 행사표가 자동 반영되었습니다! (약 1~2분 내 전 직원 앱에 자동 동기화됩니다)',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `네트워크 오류: ${err?.message || '알 수 없는 오류'}`,
    };
  }
}

/**
 * 요약 카드(quickSummaries)를 columns 데이터 기반으로 자동 재생성/보강
 */
export function buildQuickSummariesFromColumns(
  columns: InstallmentCardColumnDef[],
  fallbackSummaries: InstallmentQuickSummaryCardItem[] = DEFAULT_QUICK_SUMMARY_CARDS
): InstallmentQuickSummaryCardItem[] {
  const brandMeta: {
    brandKey: string;
    matchBrand: string;
    brandTitle: string;
    badgeColor: string;
  }[] = [
    {
      brandKey: '롯데',
      matchBrand: '롯데',
      brandTitle: '롯데카드 (멤버스 / 모바일 / HI-Plan / 클래스)',
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      brandKey: '우리',
      matchBrand: '우리',
      brandTitle: '우리카드 (제휴카드 / 일반개인 신용)',
      badgeColor: 'bg-sky-600 text-white',
    },
    {
      brandKey: 'KB국민',
      matchBrand: 'KB',
      brandTitle: 'KB국민카드 (일반개인 신용)',
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      brandKey: '신한',
      matchBrand: '신한',
      brandTitle: '신한카드 (제휴카드 / 심플플러스 & 일반개인)',
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      brandKey: '삼성',
      matchBrand: '삼성',
      brandTitle: '삼성카드 (제휴카드 / 일반개인 신용)',
      badgeColor: 'bg-indigo-600 text-white',
    },
    {
      brandKey: 'NH농협',
      matchBrand: '농협',
      brandTitle: 'NH농협카드 (일반개인 신용)',
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      brandKey: '하나',
      matchBrand: '하나',
      brandTitle: '하나카드 (제휴카드 / 일반개인)',
      badgeColor: 'bg-teal-600 text-white',
    },
    {
      brandKey: '광주',
      matchBrand: '광주',
      brandTitle: '광주카드 (제휴카드)',
      badgeColor: 'bg-cyan-700 text-white',
    },
    {
      brandKey: 'BC',
      matchBrand: 'BC',
      brandTitle: 'BC카드 (일반개인 신용)',
      badgeColor: 'bg-red-700 text-white',
    },
    {
      brandKey: '현대',
      matchBrand: '현대',
      brandTitle: '현대카드 (일반신용)',
      badgeColor: 'bg-slate-800 text-white',
    },
  ];

  return brandMeta.map((meta) => {
    const matchedCols = columns.filter((c) =>
      c.brand.includes(meta.matchBrand)
    );
    const existing = fallbackSummaries.find(
      (s) => s.brandKey === meta.brandKey
    );
    if (matchedCols.length === 0) {
      return (
        existing || {
          brandKey: meta.brandKey,
          brandTitle: meta.brandTitle,
          badgeColor: meta.badgeColor,
          freeInstallment: '-',
          partialInstallment: '-',
          subInstallment: '-',
          specialNotes: [],
        }
      );
    }

    const freeLines: string[] = [];
    const partialLines: string[] = [];
    const subLines: string[] = [];
    const noteLines: string[] = [];

    matchedCols.forEach((col) => {
      const freeMonths: string[] = [];
      const partialMonths: string[] = [];
      const subMonths: string[] = [];

      INSTALLMENT_ROW_LABELS.forEach((rLabel) => {
        const cell = col.rows[rLabel];
        if (!cell) return;
        const shortM = rLabel.replace('(비고)', '');
        if (rLabel === '기타 안내') {
          if (cell.main && cell.main !== '-') {
            noteLines.push(`${col.subName}: ${cell.main}`);
          }
          return;
        }
        if (cell.kind === 'free') {
          freeMonths.push(
            cell.sub ? `${shortM}(${cell.main}·${cell.sub})` : `${shortM}(${cell.main})`
          );
        } else if (cell.kind === 'partial') {
          partialMonths.push(
            cell.sub ? `${shortM}(${cell.sub})` : `${shortM}(${cell.main})`
          );
        } else if (cell.kind === 'sub-free') {
          subMonths.push(`${shortM}(${cell.main})`);
        }
      });

      const prefix = matchedCols.length > 1 ? `• [${col.subName}] ` : '• ';
      if (freeMonths.length > 0) {
        freeLines.push(`${prefix}${freeMonths.join(', ')}`);
      }
      if (partialMonths.length > 0) {
        partialLines.push(`${prefix}${partialMonths.join(', ')}`);
      }
      if (subMonths.length > 0) {
        subLines.push(`${prefix}${subMonths.join(', ')} (구독 전용)`);
      }
    });

    return {
      brandKey: meta.brandKey,
      brandTitle: meta.brandTitle,
      badgeColor: meta.badgeColor,
      freeInstallment:
        freeLines.length > 0 ? freeLines.join('\n') : '• 무이자 할부 없음',
      partialInstallment:
        partialLines.length > 0
          ? partialLines.join('\n')
          : '• 부분무이자 없음',
      subInstallment:
        subLines.length > 0
          ? subLines.join('\n')
          : '• 구독 전용 무이자 없음',
      specialNotes:
        noteLines.length > 0
          ? noteLines
          : existing?.specialNotes || [],
    };
  });
}

function classifyCellText(rawText: string, rowLabel: string): InstallmentCellData {
  if (rowLabel === '기타 안내') {
    return {
      kind: 'note',
      main: rawText.trim() || '-',
    };
  }
  const t = rawText.trim();
  if (!t || t === '-') {
    return { kind: 'interest', main: '고객유이자' };
  }
  if (t.includes('구독') && t.includes('무이자')) {
    return {
      kind: 'sub-free',
      main: t.includes('60') ? '60개월 무이자' : '무이자',
      sub: '구독 전용, 일반상품 적용불가',
    };
  }
  if (t.includes('부분') || t.includes('회차')) {
    const subMatch = t.match(/\(([^)]+)\)/);
    return {
      kind: 'partial',
      main: '부분무이자',
      sub: subMatch ? subMatch[1] : t.replace('부분무이자', '').trim() || undefined,
    };
  }
  if (t.includes('불가') || t.includes('미운영') || t === 'X' || t === 'x') {
    return {
      kind: 'disabled',
      main: '결제불가',
    };
  }
  if (t.includes('무이자')) {
    const lines = t.split(/\n|\//).map((s) => s.trim()).filter(Boolean);
    return {
      kind: 'free',
      main: lines[0] || '무이자',
      sub: lines.slice(1).join(' / ') || undefined,
    };
  }
  if (t.includes('저리') || t.includes('유이자') || t.includes('%')) {
    const lines = t.split(/\n|\//).map((s) => s.trim()).filter(Boolean);
    return {
      kind: 'interest',
      main: lines[0] || '고객유이자',
      sub: lines.slice(1).join(' / ') || undefined,
    };
  }
  return {
    kind: 'interest',
    main: t,
  };
}

/**
 * 사진(JPG/PNG), 엑셀(.xlsx), JSON 파일을 업로드받아 InstallmentDataset으로 변환
 */
export async function parseInstallmentFile(
  file: File,
  currentDataset: InstallmentDataset
): Promise<InstallmentDataset> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const updatedAt = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

  // 1) JSON 파일인 경우
  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as InstallmentDataset;
    if (parsed && Array.isArray(parsed.columns) && parsed.columns.length > 0) {
      return {
        ...parsed,
        updatedAt,
        fileName: file.name,
        quickSummaries:
          Array.isArray(parsed.quickSummaries) &&
          parsed.quickSummaries.length > 0
            ? parsed.quickSummaries
            : buildQuickSummariesFromColumns(parsed.columns),
      };
    }
    throw new Error('올바른 무이자 할부 JSON 파일 형식이 아닙니다.');
  }

  // 2) 엑셀(.xlsx, .xls, .csv) 파일인 경우
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });

    // 복사본 생성 후 엑셀 행에서 개월수 매칭 업데이트 (빈 데이터셋이면 기본 카드 컬럼 템플릿으로 초기화)
    const nextCols: InstallmentCardColumnDef[] =
      currentDataset.columns.length > 0
        ? JSON.parse(JSON.stringify(currentDataset.columns))
        : createEmptyInstallmentColumnTemplates();

    let detectedTitle = currentDataset.versionTitle;
    for (const r of rows.slice(0, 5)) {
      const joined = r.map((c) => String(c || '').trim()).join(' ');
      if (joined.includes('무이자') && joined.includes('월')) {
        detectedTitle = joined.slice(0, 55);
        break;
      }
    }

    for (const r of rows) {
      const firstCell = String(r[0] || '').trim();
      const matchedRowLabel = INSTALLMENT_ROW_LABELS.find(
        (lbl) =>
          firstCell === lbl ||
          firstCell.startsWith(lbl.replace('(비고)', ''))
      );
      if (matchedRowLabel) {
        nextCols.forEach((col, idx) => {
          const val = String(r[idx + 1] ?? '').trim();
          if (val) {
            col.rows[matchedRowLabel] = classifyCellText(val, matchedRowLabel);
          }
        });
      }
    }

    return {
      ...currentDataset,
      updatedAt,
      fileName: file.name,
      versionTitle: detectedTitle,
      columns: nextCols,
      quickSummaries: buildQuickSummariesFromColumns(
        nextCols,
        currentDataset.quickSummaries
      ),
    };
  }

  // 3) 이미지(JPG/PNG 등) 파일인 경우 — Gemini Vision AI 자동 파싱
  const apiKey = getEffectiveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API 키가 설정되어 있지 않아 사진 인식을 사용할 수 없습니다.'
    );
  }

  const compressed = await compressImageFile(file);
  const base64Data = compressed.base64 || compressed.base64Data;
  const mimeType = compressed.mimeType;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `당신은 롯데하이마트 카드사별 무이자/부분무이자 할부 행사표 이미지를 정확하게 읽어내는 전문 데이터 파서입니다.
제공된 무이자 할부 행사표 이미지를 분석하여 아래 JSON 구조로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.

카드 컬럼 ID 목록 (이 ID들을 그대로 사용):
- "lotte-members": 롯데카드 (멤버스 제휴카드)
- "lotte-mobile": 롯데카드 (모바일 제휴카드)
- "lotte-hiplan": 롯데카드 (HI-Plan & 일반신용)
- "lotte-class": 롯데카드 (클래스 제휴카드)
- "hyundai-general": 현대카드 (일반신용)
- "woori-affiliate": 우리카드 (제휴카드)
- "woori-general": 우리카드 (일반개인 신용카드)
- "gwangju-affiliate": 광주카드 (제휴카드)
- "kb-general": KB국민 (일반개인 신용카드)
- "shinhan-affiliate": 신한카드 (제휴카드)
- "shinhan-general": 신한카드 (심플플러스 & 일반개인)
- "hana-all": 하나카드 (제휴카드 / 일반개인)
- "nh-general": NH농협 (일반개인 신용카드)
- "samsung-affiliate": 삼성카드 (제휴카드)
- "samsung-general": 삼성카드 (일반개인 신용카드)
- "bc-general": BC카드 (일반개인 신용카드)

할부 개월 행 키 목록 (이 키들을 그대로 사용):
["2개월","3개월","4개월","5개월","6개월(비고)","7개월","8개월","10개월(비고)","11개월(비고)","12개월(비고)","18개월(비고)","24개월(비고)","36개월(비고)","48/60개월(비고)","기타 안내"]

셀 kind 값 규칙:
- "free": 무이자 할부 (예: main: "무이자", sub: "5만원 이상")
- "partial": 부분무이자 (예: main: "부분무이자", sub: "고객부담: 1,2회차")
- "sub-free": 구독 전용 무이자 (예: main: "무이자", sub: "구독 전용, 일반상품 적용불가")
- "interest": 고객유이자 또는 저리할부 (예: main: "고객유이자", sub: "연이자 5.5%")
- "disabled": 결제불가 (예: main: "결제불가")
- "note": 기타 안내 행 전용 (예: main: "특이사항 요약")

반환 JSON 스키마:
{
  "versionTitle": "예: '26년 11월 카드사별 무이자 · 부분무이자 할부 행사",
  "warningBanner1": "상단 핵심 경고문 1 (없으면 빈 문자열)",
  "columns": [
    {
      "id": "lotte-members",
      "rows": {
        "2개월": { "kind": "free", "main": "무이자", "sub": "5만원 이상" }
      }
    }
  ]
}`;

  const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

  let rawText = '';
  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: 'LOW' as any },
        },
      });
      if (response.text) {
        rawText = response.text.trim();
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawText) {
    throw lastError || new Error('무이자 할부 행사표 AI 이미지 인식에 실패했습니다.');
  }

  const cleanedJson = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsedAi = JSON.parse(cleanedJson);
  const nextCols: InstallmentCardColumnDef[] =
    currentDataset.columns.length > 0
      ? JSON.parse(JSON.stringify(currentDataset.columns))
      : createEmptyInstallmentColumnTemplates();

  if (Array.isArray(parsedAi.columns)) {
    for (const aiCol of parsedAi.columns) {
      const targetCol = nextCols.find((c) => c.id === aiCol.id);
      if (targetCol && aiCol.rows && typeof aiCol.rows === 'object') {
        for (const rLabel of INSTALLMENT_ROW_LABELS) {
          const cellObj = aiCol.rows[rLabel];
          if (cellObj && cellObj.main) {
            targetCol.rows[rLabel] = {
              kind: cellObj.kind || 'interest',
              main: String(cellObj.main),
              sub: cellObj.sub ? String(cellObj.sub) : undefined,
            };
          }
        }
      }
    }
  }

  const nextVersionTitle =
    typeof parsedAi.versionTitle === 'string' && parsedAi.versionTitle.trim()
      ? parsedAi.versionTitle.trim()
      : currentDataset.versionTitle;

  const nextWarning1 =
    typeof parsedAi.warningBanner1 === 'string' &&
    parsedAi.warningBanner1.trim()
      ? parsedAi.warningBanner1.trim()
      : currentDataset.warningBanner1;

  return {
    updatedAt,
    fileName: file.name,
    versionTitle: nextVersionTitle,
    warningBanner1: nextWarning1,
    warningBanner2: currentDataset.warningBanner2,
    columns: nextCols,
    quickSummaries: buildQuickSummariesFromColumns(
      nextCols,
      currentDataset.quickSummaries
    ),
  };
}
