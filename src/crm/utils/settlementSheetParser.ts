import * as XLSXModule from 'xlsx';
import { GitHubSyncConfig, loadGitHubSyncConfig, saveGitHubSyncConfig } from '../../utils/careTableParser';
import { DEFAULT_MODEL_INCENTIVE_SHEETS } from '../data/defaultModelIncentiveData';

const XLSX: typeof XLSXModule =
  ((XLSXModule as any).read ? XLSXModule : (XLSXModule as any).default) || XLSXModule;
import { idbMirrorGet, idbMirrorSet } from '../../utils/offlineDbQueue';
import { buildGeminiFastConfig, compressImageFile, GEMINI_MODELS, getEffectiveGeminiApiKey } from '../../utils/aiImageParser';
import {
  ModelIncentiveRule,
  ModelIncentivesMap,
  MonthlyModelIncentiveSheet,
} from '../types/crm';
import {
  expandRuleCandidateKeys,
  getCurrentYearMonth,
  normalizeModelMatchKey,
} from './settlementEngine';

// ============================================================================
// 월별 제품 모델별 수당 단가표 저장소 + 엑셀/CSV/사진(AI OCR)/텍스트 통합 파서
// ============================================================================

export const MODEL_INCENTIVE_STORAGE_KEY = 'himart_crm_model_incentive_sheets_v1';
export const MODEL_INCENTIVE_UPDATED_EVENT = 'himart-model-incentive-updated';

function emitModelIncentiveUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MODEL_INCENTIVE_UPDATED_EVENT));
  }
}

let memoryModelIncentiveCache: ModelIncentivesMap | null = null;

function mergeWithBundledDefaults(rawMap: ModelIncentivesMap): ModelIncentivesMap {
  const out: ModelIncentivesMap = { ...DEFAULT_MODEL_INCENTIVE_SHEETS };
  for (const [ym, sheet] of Object.entries(rawMap || {})) {
    if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.rules)) continue;
    const bundled = DEFAULT_MODEL_INCENTIVE_SHEETS[ym];
    if (
      bundled &&
      parseIsoMs(sheet.updatedAt) < parseIsoMs(bundled.updatedAt)
    ) {
      const bundledKeys = new Set<string>();
      for (const br of bundled.rules) {
        expandRuleCandidateKeys(br).forEach((k) => bundledKeys.add(k));
      }
      const userCustomRules = sheet.rules.filter((r) => {
        if (!r || String(r.id || '').startsWith('NOV26-')) return false;
        const rKey = normalizeModelMatchKey(r.modelCode);
        return Boolean(rKey && !bundledKeys.has(rKey));
      });
      out[ym] = {
        ...bundled,
        rules:
          userCustomRules.length > 0
            ? mergeModelIncentiveRules(bundled.rules, userCustomRules, { allowZeroAmount: true })
            : bundled.rules,
      };
    } else {
      out[ym] = sheet;
    }
  }
  return out;
}

export function loadAllModelIncentiveSheets(): ModelIncentivesMap {
  if (memoryModelIncentiveCache) {
    return memoryModelIncentiveCache;
  }
  if (typeof localStorage === 'undefined') {
    memoryModelIncentiveCache = { ...DEFAULT_MODEL_INCENTIVE_SHEETS };
    return memoryModelIncentiveCache;
  }
  try {
    const raw = localStorage.getItem(MODEL_INCENTIVE_STORAGE_KEY);
    if (!raw) {
      memoryModelIncentiveCache = { ...DEFAULT_MODEL_INCENTIVE_SHEETS };
      return memoryModelIncentiveCache;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      memoryModelIncentiveCache = { ...DEFAULT_MODEL_INCENTIVE_SHEETS };
      return memoryModelIncentiveCache;
    }
    memoryModelIncentiveCache = mergeWithBundledDefaults(parsed as ModelIncentivesMap);
    return memoryModelIncentiveCache;
  } catch {
    memoryModelIncentiveCache = { ...DEFAULT_MODEL_INCENTIVE_SHEETS };
    return memoryModelIncentiveCache;
  }
}

export async function hydrateModelIncentiveSheetsFromIdb(): Promise<ModelIncentivesMap> {
  const local = loadAllModelIncentiveSheets();
  try {
    const mirrored = await idbMirrorGet<ModelIncentivesMap>(MODEL_INCENTIVE_STORAGE_KEY);
    if (mirrored && typeof mirrored === 'object' && !Array.isArray(mirrored)) {
      const merged: ModelIncentivesMap = mergeWithBundledDefaults({ ...local });
      let changed = false;
      for (const [ym, mSheet] of Object.entries(mirrored)) {
        if (!mSheet || !Array.isArray(mSheet.rules)) continue;
        const cur = merged[ym];
        if (
          !cur ||
          parseIsoMs(mSheet.updatedAt) > parseIsoMs(cur.updatedAt) ||
          (mSheet.rules.length > cur.rules.length && parseIsoMs(mSheet.updatedAt) >= parseIsoMs(cur.updatedAt))
        ) {
          merged[ym] = mSheet;
          changed = true;
        }
      }
      memoryModelIncentiveCache = merged;
      if (changed) {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(MODEL_INCENTIVE_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // Quota fallback handled by memoryModelIncentiveCache + IDB
          }
        }
        emitModelIncentiveUpdated();
      }
      return merged;
    }
  } catch {
    // Ignore IDB fallback errors
  }
  return local;
}

export function syncModelIncentiveSheetsToServer(map: ModelIncentivesMap): void {
  if (typeof fetch === 'undefined') return;
  try {
    fetch('/api/model-incentives/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheets: map }),
    }).catch(() => {});
  } catch {
    // Ignore on static hosting
  }
}

export function saveAllModelIncentiveSheets(
  map: ModelIncentivesMap,
  options?: { skipServerSync?: boolean }
): void {
  const safeMap = map && typeof map === 'object' ? { ...map } : {};
  memoryModelIncentiveCache = safeMap;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(MODEL_INCENTIVE_STORAGE_KEY, JSON.stringify(safeMap));
    } catch {
      // Ignore storage quota warning; memory cache + IDB mirror still persist immediately
    }
  }
  void idbMirrorSet(MODEL_INCENTIVE_STORAGE_KEY, safeMap);
  if (!options?.skipServerSync) {
    syncModelIncentiveSheetsToServer(safeMap);
  }
  emitModelIncentiveUpdated();
}

function parseIsoMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function inferGitHubPagesRepoFromLocation(): string {
  if (typeof window === 'undefined' || !window.location) return '';
  const host = window.location.hostname || '';
  if (!host.endsWith('.github.io')) return '';
  const owner = host.replace(/\.github\.io$/i, '').trim();
  const pathParts = (window.location.pathname || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  const repoName = pathParts[0] || `${owner}.github.io`;
  if (!owner || !repoName) return '';
  return `${owner}/${repoName}`;
}

function isValidSheetRecord(val: any): val is MonthlyModelIncentiveSheet {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof val.yearMonth === 'string' &&
      Array.isArray(val.rules)
  );
}

/**
 * [전 직원 단가표 자동 수신]
 * GitHub 저장소(public/model-incentive-data.json) 및 배포된 정적 파일(./model-incentive-data.json)에서
 * 최신 월별 모델 수당 단가표만 가져와 병합합니다. (개인 고객 카드·개인 실적은 절대 공유되지 않음)
 */
export async function fetchRemoteModelIncentiveSheets(): Promise<ModelIncentivesMap | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const gh = loadGitHubSyncConfig();
    const configuredRepo = gh.repo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '');
    const effectiveRepo = configuredRepo || inferGitHubPagesRepoFromLocation();
    const branch = gh.branch.trim() || 'main';

    const candidates: ModelIncentivesMap[] = [];

    // 1) GitHub Contents API (업로드 직후 1~2초 내 즉시 반영)
    if (effectiveRepo) {
      try {
        const ghApiUrl = `https://api.github.com/repos/${effectiveRepo}/contents/public/model-incentive-data.json?ref=${encodeURIComponent(
          branch
        )}`;
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3.raw',
        };
        if (configuredRepo && gh.token.trim()) {
          headers.Authorization = `Bearer ${gh.token.trim()}`;
        }
        const ghRes = await fetch(ghApiUrl, {
          cache: 'no-store',
          headers,
        });
        if (ghRes.ok) {
          const parsed = await ghRes.json();
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            candidates.push(parsed as ModelIncentivesMap);
          }
        }
      } catch {
        // Fallback to static JSON below
      }
    }

    // 2) 배포 서버 정적 파일 (./model-incentive-data.json - 토큰 없는 일반 직원 기기 100% 호환)
    try {
      const staticRes = await fetch(`./model-incentive-data.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (staticRes.ok) {
        const ct = staticRes.headers.get('content-type') || '';
        if (ct.includes('json') || ct.includes('text') || !ct) {
          const parsed = await staticRes.json();
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            candidates.push(parsed as ModelIncentivesMap);
          }
        }
      }
    } catch {
      // Ignore offline errors
    }

    if (candidates.length === 0) return null;

    // 후보 원격 맵들 중 월별로 가장 최신(updatedAt)인 단가표 선택
    const bestRemote: ModelIncentivesMap = {};
    for (const srcMap of candidates) {
      for (const [ym, sheet] of Object.entries(srcMap)) {
        if (!isValidSheetRecord(sheet)) continue;
        const prev = bestRemote[ym];
        if (!prev || parseIsoMs(sheet.updatedAt) >= parseIsoMs(prev.updatedAt)) {
          bestRemote[ym] = sheet;
        }
      }
    }

    if (Object.keys(bestRemote).length === 0) return null;

    const localMap = loadAllModelIncentiveSheets();
    const merged: ModelIncentivesMap = { ...localMap };
    let changed = false;

    for (const [ym, remoteSheet] of Object.entries(bestRemote)) {
      const localSheet = localMap[ym];
      if (
        !localSheet ||
        parseIsoMs(remoteSheet.updatedAt) > parseIsoMs(localSheet.updatedAt) ||
        (parseIsoMs(remoteSheet.updatedAt) === parseIsoMs(localSheet.updatedAt) &&
          remoteSheet.rules.length !== localSheet.rules.length)
      ) {
        merged[ym] = remoteSheet;
        changed = true;
      }
    }

    if (changed) {
      saveAllModelIncentiveSheets(merged, { skipServerSync: true });
    }
    return merged;
  } catch {
    return null;
  }
}

/**
 * [전 직원 단가표 자동 배포]
 * 월별 제품 모델 수당 단가표(ModelIncentivesMap)만 GitHub 저장소(public/model-incentive-data.json)에 업로드합니다.
 */
export async function publishModelIncentiveSheetsToGitHub(
  sheetsMap: ModelIncentivesMap,
  config?: GitHubSyncConfig
): Promise<{ ok: boolean; configured: boolean; message: string }> {
  syncModelIncentiveSheetsToServer(sheetsMap);

  const gh = config || loadGitHubSyncConfig();
  const repo = gh.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const token = gh.token.trim();
  const branch = gh.branch.trim() || 'main';

  if (!repo || !token) {
    return {
      ok: false,
      configured: false,
      message: 'GitHub 동기화 미설정 (내 기기에만 저장됨)',
    };
  }

  const filePath = 'public/model-incentive-data.json';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  try {
    let currentSha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const info = await getRes.json();
      currentSha = info.sha;
    }

    const jsonText = JSON.stringify(sheetsMap, null, 2);
    const bytes = new TextEncoder().encode(jsonText);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore(incentive): 월별 제품 모델 수당 단가표 자동 동기화 (${new Date()
          .toISOString()
          .slice(0, 10)})`,
        content: base64Content,
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errTxt = await putRes.text().catch(() => '');
      return {
        ok: false,
        configured: true,
        message: `GitHub 단가표 배포 실패 (${putRes.status})${
          errTxt ? `: ${errTxt.slice(0, 80)}` : ''
        }`,
      };
    }

    return {
      ok: true,
      configured: true,
      message: '전 직원 단가표 자동 업데이트 완료!',
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      message: `네트워크 오류로 내 기기에만 저장됨 (${err?.message || '연결 확인'})`,
    };
  }
}

export { loadGitHubSyncConfig, saveGitHubSyncConfig };
export type { GitHubSyncConfig };

function cleanUploadedModelCode(raw?: string): string {
  if (!raw) return '';
  let code = String(raw).replace(/_x000d_/gi, '').trim();
  code = code.replace(/^\[[^\]]+\]\s*/, '');
  code = code.replace(/\.(AKOR\d*|KOR\d*)$/i, '');
  code = code.replace(/\s{2,}/g, ' ');
  if (!/[가-힣]/.test(code)) {
    code = code.toUpperCase();
  }
  return code.trim();
}

export const INCENTIVE_GSHEET_URL_STORAGE_KEY = 'himart_crm_incentive_gsheet_url_v1';
export const DEFAULT_INCENTIVE_GSHEET_URL =
  'https://docs.google.com/spreadsheets/d/10_SOJMVMzocNU92jflgXxOObp5dtPXsFoq2Vt9w1D9k/edit?usp=sharing';

export function loadSavedIncentiveGoogleSheetUrl(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_INCENTIVE_GSHEET_URL;
  try {
    return localStorage.getItem(INCENTIVE_GSHEET_URL_STORAGE_KEY)?.trim() || DEFAULT_INCENTIVE_GSHEET_URL;
  } catch {
    return DEFAULT_INCENTIVE_GSHEET_URL;
  }
}

export function saveIncentiveGoogleSheetUrl(url: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(INCENTIVE_GSHEET_URL_STORAGE_KEY, url.trim());
  } catch {
    // ignore storage errors
  }
}

export function mergeModelIncentiveRules(
  existing: ModelIncentiveRule[],
  incoming: ModelIncentiveRule[],
  options?: { allowZeroAmount?: boolean }
): ModelIncentiveRule[] {
  const byKey = new Map<string, ModelIncentiveRule>();
  for (const r of existing || []) {
    const clean = cleanUploadedModelCode(r.modelCode);
    const key = `${normalizeModelMatchKey(clean)}::${r.saleTypeFilter || 'all'}`;
    if (!clean) continue;
    byKey.set(key, { ...r, modelCode: clean });
  }
  for (const r of incoming || []) {
    const clean = cleanUploadedModelCode(r.modelCode);
    const rawAmt = Number(r.incentiveAmount);
    const amt = Number.isFinite(rawAmt) ? Math.max(0, Math.round(rawAmt)) : 0;
    const isExplicitZeroRef =
      amt === 0 &&
      (options?.allowZeroAmount ||
        /최저가|수당종료|수당미기재|미지급|수당없음|0원/.test(String(r.note || '')));
    if (!clean || (amt <= 0 && !isExplicitZeroRef)) continue;
    const filter =
      r.saleTypeFilter === 'general' || r.saleTypeFilter === 'subscription'
        ? r.saleTypeFilter
        : 'all';
    const key = `${normalizeModelMatchKey(clean)}::${filter}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      id: r.id || prev?.id || `RULE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: (r.category || prev?.category || '가전').trim(),
      modelCode: clean,
      productName: r.productName || prev?.productName || undefined,
      incentiveAmount: amt,
      saleTypeFilter: filter,
      note: r.note || prev?.note || undefined,
    });
  }
  return Array.from(byKey.values());
}

export function upsertMonthlyIncentiveSheet(
  yearMonth: string,
  incomingRules: ModelIncentiveRule[],
  sourceLabel: string,
  replaceAll = false
): MonthlyModelIncentiveSheet {
  const all = loadAllModelIncentiveSheets();
  const prev = all[yearMonth];
  const baseRules = replaceAll ? [] : prev?.rules || [];
  const mergedRules = mergeModelIncentiveRules(baseRules, incomingRules, {
    allowZeroAmount: true,
  });
  const nextSheet: MonthlyModelIncentiveSheet = {
    yearMonth,
    updatedAt: new Date().toISOString(),
    sourceLabel: sourceLabel || prev?.sourceLabel || '단가표 업로드',
    rules: mergedRules,
  };
  const nextAll: ModelIncentivesMap = {
    ...all,
    [yearMonth]: nextSheet,
  };
  saveAllModelIncentiveSheets(nextAll);
  return nextSheet;
}

export function parseIncentiveAmountCell(
  raw: unknown,
  unitMultiplier = 1
): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.round(raw * unitMultiplier);
  }
  const s = String(raw).trim();
  if (!s || s === '-' || s === '없음') return 0;

  // 예: "12만5천", "5.5만원", "10만", "5천원"
  const manCheonMatch = s.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+(?:\.\d+)?)\s*천)?/);
  if (manCheonMatch) {
    const man = parseFloat(manCheonMatch[1] || '0') * 10_000;
    const cheon = parseFloat(manCheonMatch[2] || '0') * 1_000;
    return Math.round(man + cheon);
  }
  const cheonOnlyMatch = s.match(/^(\d+(?:\.\d+)?)\s*천(?:원)?$/);
  if (cheonOnlyMatch) {
    return Math.round(parseFloat(cheonOnlyMatch[1] || '0') * 1_000);
  }

  const cleaned = s.replace(/[,\s원₩KRW]/gi, '');
  const numMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!numMatch) return 0;
  const val = parseFloat(numMatch[0]);
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.round(val * unitMultiplier);
}

function isExplicitZeroIncentiveCell(raw: unknown): boolean {
  if (typeof raw === 'number') return raw === 0;
  const s = String(raw ?? '').trim();
  if (!s || s === '-') return false;
  return /^(₩?\s*0(?:\.0+)?\s*원?|무상|수당없음|수당종료|미지급)$/i.test(s);
}

function parseSaleTypeFilterCell(raw?: unknown): 'all' | 'general' | 'subscription' {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'all';
  if (
    s === '구독' ||
    s === '렌탈' ||
    s === '구독전용' ||
    s === '렌탈전용' ||
    s === '하이마트 구독용' ||
    s === '하이마트구독용' ||
    s === 'sub' ||
    s === 'subscription'
  ) {
    return 'subscription';
  }
  if (
    s === '일반' ||
    s === '일시불' ||
    s === '일반전용' ||
    s === '일시불전용' ||
    s === 'general'
  ) {
    return 'general';
  }
  return 'all';
}

function looksLikeValidModelCode(candidate: string): boolean {
  const c = cleanUploadedModelCode(candidate);
  if (c.length < 2 || c.length > 80) return false;
  if (
    /^(MODEL|CODE|TOTAL|PRICE|INCENTIVE|KRW|NO\d*|합계|총계|소계|평균|최고|최저|모델코드|모델명|상품명|품목|브랜드|비고|구분)$/i.test(
      c
    )
  ) {
    return false;
  }
  if (/^(합계|총계|소계|총\s*집중|기준\s*:)/.test(c)) {
    return false;
  }
  if (/[가-힣]/.test(c)) {
    // 순수 한글 문장(20자 초과 안내문 등) 제외
    return c.length >= 2 && c.length <= 28;
  }
  const compact = c.replace(/[\s()]/g, '').toUpperCase();
  if (compact.length < 2) return false;
  return /[A-Z0-9]/.test(compact) && /^[A-Z0-9._/+()\-\s,]+$/i.test(c);
}

function looksLikeGenuineModelCodeCell(candidate: string): boolean {
  const c = cleanUploadedModelCode(candidate);
  if (!looksLikeValidModelCode(c)) return false;
  // 영문+숫자 조합이거나 알려진 한글 전용 모델명(뉴팔콘SV 등)인 경우 높은 신뢰도 부여
  if (/[A-Za-z]/.test(c) && /\d/.test(c)) return true;
  if (/^[A-Z0-9][A-Z0-9\-_./()\s]{2,}$/i.test(c) && !/^\d+$/.test(c)) return true;
  return false;
}

export function detectIncentiveYearMonthFromText(raw?: string): string | null {
  if (!raw) return null;
  const s = String(raw);
  const fullMatch = s.match(/(20\d{2})\s*[-._년/\s]\s*(0?[1-9]|1[0-2])(?:\s*월|\b|_)/);
  if (fullMatch) {
    return `${fullMatch[1]}-${String(parseInt(fullMatch[2], 10)).padStart(2, '0')}`;
  }
  const shortMatch = s.match(/(?:^|\D)(2[5-9])\s*(?:년|\.)\s*(0?[1-9]|1[0-2])\s*월/);
  if (shortMatch) {
    return `20${shortMatch[1]}-${String(parseInt(shortMatch[2], 10)).padStart(2, '0')}`;
  }
  return null;
}

const HEADER_DISQUALIFIERS = [
  '총집중',
  '모델수',
  '브랜드수',
  '최고판매수당',
  '평균판매수당',
  '최고수당',
  '평균수당',
  '지급대상기준',
  '합계(',
  '전면제외',
  '사은품정책',
  '회수및배송',
  '유의사항',
  '연락처',
  '핫라인',
  '운영기간',
  '대상행사',
  '필독가이드',
];

export interface ParsedIncentiveWorkbookResult {
  rules: ModelIncentiveRule[];
  detectedYearMonth: string | null;
  paidCount: number;
  zeroRefCount: number;
}

function parseIncentiveSheetMatrix(
  rows: any[][],
  sheetName: string,
  collected: ModelIncentiveRule[]
): string | null {
  if (!rows || rows.length === 0) return null;

  let sheetDetectedYm = detectIncentiveYearMonthFromText(sheetName);
  for (let r = 0; r < Math.min(rows.length, 6) && !sheetDetectedYm; r++) {
    const joined = (rows[r] || []).slice(0, 4).join(' ');
    sheetDetectedYm = detectIncentiveYearMonthFromText(joined);
  }

  // 정책/연락처 안내 전용 시트 이름이면 건너뛰기 (단, 모델코드 열이 있는 시트는 통과)
  const modelStrongAliases = ['모델코드', '모델명', '모델번호', '상품코드', '품번', '제품코드'];
  const modelExactAliases = ['모델', 'model', 'modelcode', 'modelname'];
  const amountStrongAliases = [
    '판매수당(원)',
    '수당금액(원)',
    '판매수당',
    '수당금액',
    '모델수당',
    '인센티브',
    '시상금',
    '장려금',
    '지급액',
    '프로모션수당',
  ];
  const amountExactAliases = ['수당', '시상', '단가', 'incentive'];
  const brandAliases = ['브랜드', '브랜드명', '제조사', '메이커', '협력사'];
  const catAliases = ['품목', '품목(카테고리)', '품목명', '카테고리', '제품군', '분류', '대분류', '중분류'];
  const nameAliases = ['상품명', '제품명', '품명'];
  const specAliases = ['세부사양/구분', '세부사양', '사양', '스펙'];
  const retailAliases = ['정상가/행사가(판매가)', '정상가/행사가', '행사가', '판매가', '정상가', '출고가'];
  const payTypeAliases = ['지급형태', '지급방식', '지급구분', '수당구분'];
  const saleTypeAliases = ['적용구분', '판매유형', '구독구분'];
  const noteAliases = ['비고및조건', '비고', '특이사항', '메모', '조건'];

  let bestScore = -1;
  let headerRowIdx = -1;
  let modelCol = -1;
  let amountCol = -1;
  let brandCol = -1;
  let catCol = -1;
  let nameCol = -1;
  let specCol = -1;
  let retailCol = -1;
  let payTypeCol = -1;
  let saleTypeCol = -1;
  let noteCol = -1;
  let unitMultiplier = 1;

  const maxScanRow = Math.min(rows.length, 30);
  for (let r = 0; r < maxScanRow; r++) {
    const row = rows[r] || [];
    const nonEmptyCells = row.map((c) => String(c ?? '').trim()).filter(Boolean);
    if (nonEmptyCells.length < 2) continue;

    // KPI 요약 행("총 집중관리 모델 수", "최고 판매수당" 등)은 행 전체 즉시 배제
    const joinedNorm = nonEmptyCells.join('|').replace(/\s+/g, '').toLowerCase();
    if (
      joinedNorm.includes('총집중관리모델수') ||
      joinedNorm.includes('최고판매수당') ||
      joinedNorm.includes('평균판매수당') ||
      joinedNorm.includes('취급브랜드수')
    ) {
      continue;
    }

    let mIdx = -1;
    let aIdx = -1;
    let bIdx = -1;
    let cIdx = -1;
    let nIdx = -1;
    let spIdx = -1;
    let rtIdx = -1;
    let ptIdx = -1;
    let stIdx = -1;
    let ntIdx = -1;
    let mult = 1;
    let rowScore = 0;

    row.forEach((cell, idx) => {
      const rawCell = String(cell ?? '').trim();
      if (!rawCell || rawCell.length > 26 || rawCell.includes('\n')) return;
      const norm = rawCell.replace(/\s+/g, '').toLowerCase();
      if (!norm) return;
      if (HEADER_DISQUALIFIERS.some((d) => norm.includes(d))) return;

      if (
        mIdx === -1 &&
        (modelStrongAliases.some((k) => norm.includes(k)) ||
          modelExactAliases.some((k) => norm === k))
      ) {
        mIdx = idx;
        rowScore += modelStrongAliases.some((k) => norm.includes(k)) ? 6 : 4;
        return;
      }

      if (
        aIdx === -1 &&
        (amountStrongAliases.some((k) => norm.includes(k)) ||
          amountExactAliases.some((k) => norm === k)) &&
        !norm.includes('출고가') &&
        !norm.includes('판매가') &&
        !norm.includes('행사가') &&
        !norm.includes('정상가') &&
        !norm.includes('지급형태') &&
        !norm.includes('지급기준') &&
        !norm.includes('수당정책')
      ) {
        aIdx = idx;
        rowScore += amountStrongAliases.some((k) => norm.includes(k)) ? 6 : 4;
        if (norm.includes('만원') || norm.includes('(만)') || norm.includes('단위:만')) {
          mult = 10_000;
        } else if (norm.includes('천원') || norm.includes('(천)')) {
          mult = 1_000;
        }
        return;
      }

      if (bIdx === -1 && brandAliases.some((k) => norm === k || norm.startsWith(k))) {
        bIdx = idx;
        rowScore += 2;
      } else if (cIdx === -1 && catAliases.some((k) => norm === k || norm.includes(k))) {
        cIdx = idx;
        rowScore += 2;
      } else if (nIdx === -1 && nameAliases.some((k) => norm === k || norm.includes(k))) {
        nIdx = idx;
        rowScore += 1;
      } else if (spIdx === -1 && specAliases.some((k) => norm === k || norm.includes(k))) {
        spIdx = idx;
        rowScore += 1;
      } else if (rtIdx === -1 && retailAliases.some((k) => norm === k || norm.includes(k))) {
        rtIdx = idx;
        rowScore += 1;
      } else if (ptIdx === -1 && payTypeAliases.some((k) => norm === k || norm.includes(k))) {
        ptIdx = idx;
        rowScore += 2;
      } else if (
        stIdx === -1 &&
        (saleTypeAliases.some((k) => norm === k || norm.includes(k)) || norm === '구분')
      ) {
        stIdx = idx;
        rowScore += 1;
      } else if (ntIdx === -1 && noteAliases.some((k) => norm === k || norm.includes(k))) {
        ntIdx = idx;
        rowScore += 1;
      }
    });

    if (mIdx !== -1 && aIdx !== -1 && mIdx !== aIdx) {
      // 실제 아래 데이터 행(최대 8행)에 유효 모델코드와 금액 셀이 존재하는지 검증
      let validSampleRows = 0;
      for (let look = r + 1; look < Math.min(rows.length, r + 9); look++) {
        const subRow = rows[look] || [];
        const sampleModel = String(subRow[mIdx] ?? '').trim();
        const sampleAmtRaw = subRow[aIdx];
        if (
          looksLikeValidModelCode(sampleModel) &&
          (parseIncentiveAmountCell(sampleAmtRaw, mult) > 0 ||
            isExplicitZeroIncentiveCell(sampleAmtRaw))
        ) {
          validSampleRows += looksLikeGenuineModelCodeCell(sampleModel) ? 2 : 1;
        }
      }

      const totalCandidateScore = rowScore + validSampleRows * 2;
      if (validSampleRows > 0 && totalCandidateScore > bestScore) {
        bestScore = totalCandidateScore;
        headerRowIdx = r;
        modelCol = mIdx;
        amountCol = aIdx;
        brandCol = bIdx;
        catCol = cIdx;
        nameCol = nIdx;
        specCol = spIdx;
        retailCol = rtIdx;
        payTypeCol = ptIdx;
        saleTypeCol = stIdx;
        noteCol = ntIdx;
        unitMultiplier = mult;
      }
    }
  }

  if (headerRowIdx !== -1) {
    let carryCategory = '';
    let carryBrand = '';
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawBrand = brandCol !== -1 ? String(row[brandCol] ?? '').trim() : '';
      const rawCat = catCol !== -1 ? String(row[catCol] ?? '').trim() : '';
      const rawModel = String(row[modelCol] ?? '').trim();

      // 하단 합계/요약 행 배제
      if (
        /^(합계|총계|소계)/.test(rawBrand) ||
        /^(합계|총계|소계)/.test(rawCat) ||
        /^(합계|총계|소계)/.test(rawModel)
      ) {
        continue;
      }

      if (rawBrand && rawBrand !== '-') carryBrand = rawBrand;
      if (rawCat && rawCat !== '-') carryCategory = rawCat;
      if (!rawModel || rawModel === '-') continue;

      const cleanCode = cleanUploadedModelCode(rawModel);
      if (!looksLikeValidModelCode(cleanCode)) continue;

      const rawAmountCell = row[amountCol];
      let amt = parseIncentiveAmountCell(rawAmountCell, unitMultiplier);
      if (unitMultiplier === 1 && amt > 0 && amt < 300) {
        amt = amt * 10_000;
      }
      const explicitZero = amt === 0 && isExplicitZeroIncentiveCell(rawAmountCell);
      if (amt <= 0 && !explicitZero) continue;

      const rawName = nameCol !== -1 ? String(row[nameCol] ?? '').trim() : '';
      const rawSpec = specCol !== -1 ? String(row[specCol] ?? '').trim() : '';
      const rawRetail = retailCol !== -1 ? String(row[retailCol] ?? '').trim() : '';
      const rawPayType = payTypeCol !== -1 ? String(row[payTypeCol] ?? '').trim() : '';
      const rawNote = noteCol !== -1 ? String(row[noteCol] ?? '').trim() : '';

      const prodParts: string[] = [];
      if (carryBrand) prodParts.push(`[${carryBrand}]`);
      if (rawName && rawName !== '-') prodParts.push(rawName);
      if (rawSpec && rawSpec !== '-' && rawSpec !== rawName) prodParts.push(rawSpec);
      const productName = prodParts.join(' ').trim() || undefined;

      const noteParts: string[] = [];
      if (rawPayType && rawPayType !== '-') noteParts.push(`[${rawPayType}]`);
      if (rawRetail && rawRetail !== '-') noteParts.push(rawRetail);
      if (rawNote && rawNote !== '-') noteParts.push(rawNote);
      if (explicitZero && noteParts.length === 0) noteParts.push('수당 0원 / 지급제외');
      const combinedNote = noteParts.join(' · ').trim() || undefined;

      let filter: 'all' | 'general' | 'subscription' = 'all';
      if (saleTypeCol !== -1) {
        filter = parseSaleTypeFilterCell(row[saleTypeCol]);
      } else if (specCol !== -1) {
        filter = parseSaleTypeFilterCell(rawSpec);
      }

      collected.push({
        id: `XLS-${Date.now()}-${r}-${collected.length}`,
        category: carryCategory || sheetName || '가전',
        modelCode: cleanCode,
        productName,
        incentiveAmount: amt,
        saleTypeFilter: filter,
        note: combinedNote,
      });
    }
    return sheetDetectedYm;
  }

  // 정책/담당자 안내 탭은 헤더 없는 폴백에서 전화번호 등을 오인식하지 않도록 건너뜀
  if (/정책|담당자|연락처|가이드|안내/.test(sheetName)) {
    return sheetDetectedYm;
  }

  // 헤더 없는 단순 2~4열 시트 자동 복구 (실제 영문+숫자 모델코드 셀만 허용)
  for (let r = 0; r < rows.length; r++) {
    const row = (rows[r] || []).map((v) => String(v ?? '').trim()).filter(Boolean);
    if (row.length < 2 || row.length > 6) continue;
    const codeCell = row.find((cell) => looksLikeGenuineModelCodeCell(cell));
    if (!codeCell) continue;
    const otherCells = row.filter((c) => c !== codeCell);
    let amt = 0;
    for (const c of otherCells) {
      if (/^0\d{1,2}-\d{3,4}-\d{4}$/.test(c) || /^15\d{2}-\d{4}$/.test(c)) continue;
      const parsedAmt = parseIncentiveAmountCell(c, 1);
      const adjusted = parsedAmt > 0 && parsedAmt < 300 ? parsedAmt * 10_000 : parsedAmt;
      if (adjusted >= 1_000 && adjusted <= 1_500_000) {
        amt = adjusted;
        break;
      }
    }
    if (amt > 0) {
      const catGuess = otherCells.find((c) => !/\d/.test(c) && c.length <= 14);
      collected.push({
        id: `XLSF-${Date.now()}-${r}-${collected.length}`,
        category: catGuess || sheetName || '가전',
        modelCode: cleanUploadedModelCode(codeCell),
        incentiveAmount: amt,
        saleTypeFilter: 'all',
      });
    }
  }
  return sheetDetectedYm;
}

function finalizeWorkbookRules(
  wb: XLSXModule.WorkBook,
  initialHintText?: string
): ParsedIncentiveWorkbookResult {
  const collected: ModelIncentiveRule[] = [];
  let detectedYearMonth = detectIncentiveYearMonthFromText(initialHintText);

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const ymFromSheet = parseIncentiveSheetMatrix(rows, sheetName, collected);
    if (!detectedYearMonth && ymFromSheet) {
      detectedYearMonth = ymFromSheet;
    }
  }

  const deduped = mergeModelIncentiveRules([], collected, { allowZeroAmount: true });
  if (deduped.length === 0) {
    throw new Error(
      '시트에서 모델코드와 판매수당 열을 찾지 못했습니다. (헤더에 "모델명/모델코드"와 "판매수당/수당" 열이 있는지 확인해 주세요.)'
    );
  }
  const paidCount = deduped.filter((r) => r.incentiveAmount > 0).length;
  const zeroRefCount = deduped.length - paidCount;
  return { rules: deduped, detectedYearMonth, paidCount, zeroRefCount };
}

function decodeCsvOrTextBuffer(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (utf8.includes('\uFFFD')) {
    try {
      return new TextDecoder('euc-kr').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export function extractGoogleSheetIdAndGid(
  rawUrlOrId: string
): { sheetId: string; gid: string | null } | null {
  const trimmed = String(rawUrlOrId || '').trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  const gidMatch = trimmed.match(/[?#&]gid=(\d+)/);
  if (urlMatch?.[1]) {
    return { sheetId: urlMatch[1], gid: gidMatch?.[1] || null };
  }
  if (/^[a-zA-Z0-9-_]{25,}$/.test(trimmed) && !trimmed.includes(' ')) {
    return { sheetId: trimmed, gid: null };
  }
  return null;
}

export async function fetchModelIncentiveFromGoogleSheetUrl(
  rawUrlOrId: string
): Promise<ParsedIncentiveWorkbookResult> {
  const extracted = extractGoogleSheetIdAndGid(rawUrlOrId);
  const directTrimmed = String(rawUrlOrId || '').trim();

  const tryUrls: Array<{ url: string; mode: 'xlsx' | 'csv' }> = [];
  if (extracted) {
    tryUrls.push({
      url: `https://docs.google.com/spreadsheets/d/${extracted.sheetId}/export?format=xlsx`,
      mode: 'xlsx',
    });
    const gidParam = extracted.gid ? `&gid=${extracted.gid}` : '';
    tryUrls.push({
      url: `https://docs.google.com/spreadsheets/d/${extracted.sheetId}/export?format=csv${gidParam}`,
      mode: 'csv',
    });
    tryUrls.push({
      url: `https://docs.google.com/spreadsheets/d/${extracted.sheetId}/gviz/tq?tqx=out:csv${gidParam}`,
      mode: 'csv',
    });
  } else if (/^https?:\/\//i.test(directTrimmed)) {
    tryUrls.push({ url: directTrimmed, mode: 'csv' });
  } else {
    throw new Error('올바른 구글 시트 주소(URL)를 입력해 주세요.');
  }

  let lastErr: any = null;
  for (const candidate of tryUrls) {
    try {
      const resp = await fetch(candidate.url, { cache: 'no-store' });
      if (!resp.ok) continue;
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        // 비공개 로그인 페이지로 리다이렉트된 경우
        lastErr = new Error(
          '구글 시트 공유 권한이 "링크가 있는 모든 사용자(뷰어)"로 열려 있는지 확인해 주세요. (또는 구글 시트에서 [파일 → 다운로드 → Microsoft Excel(.xlsx)] 후 엑셀 업로드 버튼을 눌러주세요.)'
        );
        continue;
      }
      const buf = await resp.arrayBuffer();
      if (candidate.mode === 'xlsx') {
        const wb = XLSX.read(buf, { type: 'array' });
        return finalizeWorkbookRules(wb, directTrimmed);
      } else {
        const csvText = decodeCsvOrTextBuffer(buf);
        if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
          lastErr = new Error(
            '구글 시트가 비공개 상태입니다. 시트 우측 상단 [공유 → 링크가 있는 모든 사용자]로 변경하시거나 .xlsx 파일로 다운로드해 업로드해 주세요.'
          );
          continue;
        }
        const wb = XLSX.read(csvText, { type: 'string' });
        return finalizeWorkbookRules(wb, directTrimmed);
      }
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw (
    lastErr ||
    new Error(
      '구글 시트를 불러오지 못했습니다. 시트 우측 상단 [공유 → 링크가 있는 모든 사용자] 설정을 확인하거나 [파일 → 다운로드 → Excel(.xlsx)] 파일로 업로드해 주세요.'
    )
  );
}

export async function parseModelIncentiveExcelWithMeta(
  file: File
): Promise<ParsedIncentiveWorkbookResult> {
  const buf = await file.arrayBuffer();
  const lowerName = (file.name || '').toLowerCase();

  // 1) 구글 드라이브 .gsheet 바로가기 파일 또는 텍스트 내 구글시트 URL 자동 처리
  if (lowerName.endsWith('.gsheet') || buf.byteLength < 2048) {
    try {
      const maybeText = decodeCsvOrTextBuffer(buf).trim();
      if (maybeText.startsWith('{') && maybeText.includes('docs.google.com/spreadsheets')) {
        const parsedJson = JSON.parse(maybeText);
        const gUrl = parsedJson.url || parsedJson.doc_id || '';
        if (gUrl) {
          return await fetchModelIncentiveFromGoogleSheetUrl(gUrl);
        }
      } else if (/^https?:\/\/docs\.google\.com\/spreadsheets/i.test(maybeText)) {
        return await fetchModelIncentiveFromGoogleSheetUrl(maybeText);
      }
    } catch (gsheetErr: any) {
      if (lowerName.endsWith('.gsheet')) {
        throw gsheetErr;
      }
    }
  }

  // 2) CSV / TSV 파일은 한글 인코딩 깨짐 방지를 위해 문자열 디코딩 우선 처리
  if (
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values'
  ) {
    const text = decodeCsvOrTextBuffer(buf);
    const wb = XLSX.read(text, { type: 'string' });
    return finalizeWorkbookRules(wb, file.name);
  }

  // 3) 표준 Excel (.xlsx / .xls) 워크북 파싱
  const wb = XLSX.read(buf, { type: 'array' });
  return finalizeWorkbookRules(wb, file.name);
}

export async function parseModelIncentiveExcelOrCsv(
  file: File
): Promise<ModelIncentiveRule[]> {
  const res = await parseModelIncentiveExcelWithMeta(file);
  return res.rules;
}

export async function parseModelIncentiveImage(
  file: File
): Promise<ModelIncentiveRule[]> {
  const compressed = await compressImageFile(file, 1920, 0.86);
  const apiKey = getEffectiveGeminiApiKey();

  // 1차: 백엔드 서버 엔드포인트(/api/ai/parse-model-incentive-image) 호출
  try {
    const resp = await fetch('/api/ai/parse-model-incentive-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.dataUrl,
        mimeType: compressed.mimeType,
        apiKey,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.rules) && data.rules.length > 0) {
        const mapped: ModelIncentiveRule[] = data.rules
          .map((item: any, idx: number) => {
            const rawAmt = Number(item.incentiveAmount) || 0;
            const amt = rawAmt > 0 && rawAmt < 300 ? rawAmt * 10_000 : rawAmt;
            return {
              id: `IMG-${Date.now()}-${idx}`,
              category: String(item.category || '가전').trim(),
              modelCode: cleanUploadedModelCode(item.modelCode || ''),
              productName: item.productName ? String(item.productName).trim() : undefined,
              incentiveAmount: amt,
              saleTypeFilter: parseSaleTypeFilterCell(item.saleTypeFilter),
              note: item.note ? String(item.note).trim() : undefined,
            };
          })
          .filter((r: ModelIncentiveRule) => r.modelCode && r.incentiveAmount > 0);
        const deduped = mergeModelIncentiveRules([], mapped);
        if (deduped.length > 0) return deduped;
      }
    }
  } catch {
    // 서버 미구동(정적 배포) 환경일 경우 아래 클라이언트 직접 호출로 자동 폴백
  }

  // 2차: 클라이언트 직접 Gemini Vision 호출 폴백
  if (!apiKey) {
    throw new Error(
      'AI 사진 인식을 위해 상단 설정(열쇠 아이콘)에서 Gemini API 키를 먼저 등록해 주세요.'
    );
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const promptText = `당신은 가전 매장의 '월별 제품 모델별 판매수당(인센티브/장려금/시상금) 단가표' 이미지를 분석하는 전문 AI입니다.
이미지 속 표나 목록에서 각 제품의 모델코드(모델명)와 해당 모델 판매 시 지급되는 수당 금액(원 단위 정수)을 추출해 JSON으로 반환하세요.
- modelCode: 영문+숫자 모델코드(예: RM70F64M2X, OLED65C4, W20WAN). 제조사 접미사(.AKOR 등) 제거.
- category: 품목명(예: 냉장고, 김치냉장고, TV, 워시타워, 에어컨, 세탁기 등).
- productName: 상품명(있을 경우).
- incentiveAmount: 원 단위 수당 정수 (예: 표에 '5만', '50,000', 또는 단위:만원 열에 '5'로 적혀 있으면 반드시 50000으로 변환. 제품 판매가가 아닌 판매사원 수당/시상금을 추출할 것).
- saleTypeFilter: 전체 공통이면 'all', 구독 전용이면 'subscription', 일반 전용이면 'general'.`;

  let lastErr: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: compressed.mimeType,
                  data: compressed.base64Data,
                },
              },
              { text: promptText },
            ],
          },
        ],
        config: buildGeminiFastConfig(modelName, {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    modelCode: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    incentiveAmount: { type: Type.INTEGER },
                    saleTypeFilter: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['modelCode', 'incentiveAmount'],
                },
              },
            },
            required: ['rules'],
          },
        }),
      });
      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        const rules: ModelIncentiveRule[] = (parsed?.rules || [])
          .map((item: any, idx: number) => {
            const rawAmt = Number(item.incentiveAmount) || 0;
            const amt = rawAmt > 0 && rawAmt < 300 ? rawAmt * 10_000 : rawAmt;
            return {
              id: `IMGC-${Date.now()}-${idx}`,
              category: String(item.category || '가전').trim(),
              modelCode: cleanUploadedModelCode(item.modelCode || ''),
              productName: item.productName ? String(item.productName).trim() : undefined,
              incentiveAmount: amt,
              saleTypeFilter: parseSaleTypeFilterCell(item.saleTypeFilter),
              note: item.note ? String(item.note).trim() : undefined,
            };
          })
          .filter((r: ModelIncentiveRule) => r.modelCode && r.incentiveAmount > 0);
        const deduped = mergeModelIncentiveRules([], rules);
        if (deduped.length > 0) return deduped;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    lastErr?.message || '이미지에서 모델별 수당 정보를 추출하지 못했습니다. 선명한 표 사진으로 다시 시도해 주세요.'
  );
}

export function parseModelIncentiveFreeText(text: string): ModelIncentiveRule[] {
  if (!text || !text.trim()) return [];

  // 1) 구글 시트에서 드래그 복사(Ctrl+C)한 탭 구분(TSV) 다중 열 표인 경우 정밀 행렬 파서로 직행!
  if (text.includes('\t')) {
    const rawRows = text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => l.split('\t').map((c) => c.trim()));
    if (rawRows.length >= 2) {
      const matrixCollected: ModelIncentiveRule[] = [];
      parseIncentiveSheetMatrix(rawRows, '붙여넣기', matrixCollected);
      if (matrixCollected.length > 0) {
        return mergeModelIncentiveRules([], matrixCollected, { allowZeroAmount: true });
      }
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rules: ModelIncentiveRule[] = [];
  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
    const tokens = line
      .split(/[\t,|]+|\s{2,}|\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length < 2) return;

    // 영문+숫자 모델코드를 한글 브랜드명보다 최우선 선택
    const codeToken =
      tokens.find((t) => looksLikeGenuineModelCodeCell(t)) ||
      tokens.find((t) => looksLikeValidModelCode(t));
    if (!codeToken) return;

    const remaining = tokens.filter((t) => t !== codeToken);
    let foundAmt = 0;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const tok = remaining[i];
      // 연도(2025년, 2026년)나 날짜(11/30)는 금액 후보에서 제외
      if (/^20\d{2}년?$/.test(tok) || /^\d{1,2}\/\d{1,2}/.test(tok)) continue;
      const candidate = parseIncentiveAmountCell(tok, 1);
      const adjusted = candidate > 0 && candidate < 300 ? candidate * 10_000 : candidate;
      if (adjusted >= 1_000 && adjusted <= 2_000_000) {
        foundAmt = adjusted;
        break;
      }
    }
    if (foundAmt <= 0) return;

    const catToken = remaining.find(
      (t) => !/\d/.test(t) && !t.includes('만') && !t.includes('천') && t.length <= 12
    );

    rules.push({
      id: `TXT-${Date.now()}-${idx}`,
      category: catToken || '가전',
      modelCode: cleanUploadedModelCode(codeToken),
      incentiveAmount: foundAmt,
      saleTypeFilter: parseSaleTypeFilterCell(line),
    });
  });

  return mergeModelIncentiveRules([], rules);
}

export async function downloadModelIncentiveExcelTemplate(
  yearMonth: string,
  existingRules: ModelIncentiveRule[] = []
): Promise<void> {
  const rows =
    existingRules.length > 0
      ? existingRules.map((r) => ({
          품목: r.category || '가전',
          모델코드: r.modelCode,
          상품명: r.productName || '',
          '수당금액(원)': r.incentiveAmount,
          적용구분:
            r.saleTypeFilter === 'subscription'
              ? '구독전용'
              : r.saleTypeFilter === 'general'
              ? '일반전용'
              : '공통',
          비고: r.note || '',
        }))
      : [
          {
            품목: '냉장고',
            모델코드: 'RM70F64M2X',
            상품명: '비스포크 AI 하이브리드 4도어',
            '수당금액(원)': 50000,
            적용구분: '공통',
            비고: '예시 행 (자유롭게 수정 후 업로드하세요)',
          },
          {
            품목: 'TV',
            모델코드: 'OLED65C4',
            상품명: 'LG 올레드 evo 65형',
            '수당금액(원)': 100000,
            적용구분: '공통',
            비고: '',
          },
          {
            품목: '워시타워',
            모델코드: 'W20WAN',
            상품명: '오브제컬렉션 워시타워',
            '수당금액(원)': 70000,
            적용구분: '구독전용',
            비고: '',
          },
        ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${yearMonth}_모델수당표`);
  XLSX.writeFile(wb, `모델별_수당단가표_${yearMonth}.xlsx`);
}
