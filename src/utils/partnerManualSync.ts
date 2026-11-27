import { resolveBuiltInDefaultRelayUrl } from './friendAccessGuard';
import {
  fetchStoreCloudDataset,
  normalizeGasWebAppUrl,
  PARTNER_MANUALS_PERSIST_CACHE_KEY,
  readRawSyncConfig,
  STORE_CLOUD_CONFIG_KEY,
  STORE_CLOUD_UPDATED_EVENT,
} from './storeCloudSync';

export interface CloudPartnerManualQuickStep {
  step: string;
  name: string;
  menu: string;
  desc: string;
}

export interface CloudPartnerManualLink {
  label: string;
  value: string;
  note?: string;
}

export interface CloudPartnerManualCallout {
  tone: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
}

export interface CloudPartnerManualSection {
  title: string;
  steps: string[];
}

export interface CloudPartnerManualTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface CloudPartnerManualChapter {
  id: string;
  number: string;
  title: string;
  slideRange?: string;
  summary: string;
  keywords?: string[];
  callouts?: CloudPartnerManualCallout[];
  sections?: CloudPartnerManualSection[];
  tables?: CloudPartnerManualTable[];
}

export interface CloudPartnerManualDoc {
  id: string;
  title: string;
  version?: string;
  updatedAt?: string;
  securityNotice?: string;
  quickFlow?: CloudPartnerManualQuickStep[];
  essentialLinks?: CloudPartnerManualLink[];
  chapters: CloudPartnerManualChapter[];
}

export const PARTNER_MANUALS_FIELD = '__partnerManuals' as const;
export const PARTNER_MANUALS_SESSION_KEY = 'himart_partner_manuals_session_v1';
export const PARTNER_MANUALS_UPDATED_EVENT = 'himart_partner_manuals_updated';
const LOCAL_CARE_DATASET_KEY = 'himart_care_table_dataset_v1';
const MARKETING_DB_STATE_KEY = 'himart_gj_marketing_db_state_v1';

function decodeCloudParamIfPresent(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const direct = normalizeGasWebAppUrl(trimmed);
  if (direct) return direct;
  try {
    const u = new URL(trimmed);
    const cloudParam = (u.searchParams.get('cloud') || u.searchParams.get('invite') || '').trim();
    if (!cloudParam) return '';
    const directParam = normalizeGasWebAppUrl(cloudParam);
    if (directParam) return directParam;
    let b64 = cloudParam.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const decoded = atob(b64).trim();
    if (decoded.startsWith('{')) {
      const obj = JSON.parse(decoded);
      return normalizeGasWebAppUrl(obj?.url || obj?.repo || '');
    }
    return normalizeGasWebAppUrl(decoded);
  } catch {
    return '';
  }
}

export function resolveCandidateManualGasUrls(explicitOverride?: string): string[] {
  const urls: string[] = [];
  const add = (raw?: string | null) => {
    const norm = normalizeGasWebAppUrl(raw);
    if (norm && !urls.includes(norm)) {
      urls.push(norm);
    }
  };
  add(explicitOverride);
  add(readRawSyncConfig().repo);
  if (typeof localStorage !== 'undefined') {
    try {
      const rawMdb = localStorage.getItem(MARKETING_DB_STATE_KEY);
      if (rawMdb) {
        const parsed = JSON.parse(rawMdb);
        add(parsed?.config?.gasWebAppUrl || '');
      }
    } catch {
      // ignore
    }
  }
  add(resolveBuiltInDefaultRelayUrl());
  return urls;
}

export function resolveEffectiveManualGasUrl(): string {
  return resolveCandidateManualGasUrls()[0] || '';
}

export function saveManualCloudConnectInput(rawInput: string): boolean {
  const resolved = decodeCloudParamIfPresent(rawInput);
  if (!resolved || typeof localStorage === 'undefined') return false;
  try {
    const prev = readRawSyncConfig();
    localStorage.setItem(
      STORE_CLOUD_CONFIG_KEY,
      JSON.stringify({
        repo: resolved,
        branch: prev.branch || 'main',
        token: prev.token || '',
      })
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORE_CLOUD_UPDATED_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}

export function hasConfiguredCloudEndpoint(): boolean {
  return resolveCandidateManualGasUrls().length > 0;
}

export function extractPartnerManualsMap(
  rawData: unknown
): Record<string, CloudPartnerManualDoc> {
  if (!rawData || typeof rawData !== 'object') return {};
  const rawMap = (rawData as Record<string, unknown>)[PARTNER_MANUALS_FIELD];
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const out: Record<string, CloudPartnerManualDoc> = {};
  for (const [rawId, entry] of Object.entries(rawMap as Record<string, any>)) {
    const id = String(rawId || '').trim();
    if (!id || !entry || typeof entry !== 'object' || !Array.isArray(entry.chapters)) {
      continue;
    }
    out[id] = {
      id: String(entry.id || id).trim(),
      title: String(entry.title || '업무 교안').trim(),
      version: entry.version ? String(entry.version).trim() : undefined,
      updatedAt: entry.updatedAt ? String(entry.updatedAt).trim() : undefined,
      securityNotice: entry.securityNotice ? String(entry.securityNotice).trim() : undefined,
      quickFlow: Array.isArray(entry.quickFlow) ? entry.quickFlow : [],
      essentialLinks: Array.isArray(entry.essentialLinks) ? entry.essentialLinks : [],
      chapters: entry.chapters,
    };
  }
  return out;
}

function persistPartnerManualsCache(map: Record<string, CloudPartnerManualDoc>): void {
  if (!map || Object.keys(map).length === 0) return;
  try {
    const serialized = JSON.stringify(map);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(PARTNER_MANUALS_SESSION_KEY, serialized);
    }
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('himart_friend_revoked_v1') !== '1' &&
      localStorage.getItem('himart_customer_viewer_only_v1') !== '1'
    ) {
      localStorage.setItem(PARTNER_MANUALS_PERSIST_CACHE_KEY, serialized);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PARTNER_MANUALS_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
}

export function readSessionCachedPartnerManuals(): Record<
  string,
  CloudPartnerManualDoc
> {
  try {
    if (
      typeof localStorage !== 'undefined' &&
      (localStorage.getItem('himart_friend_revoked_v1') === '1' ||
        localStorage.getItem('himart_customer_viewer_only_v1') === '1')
    ) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(PARTNER_MANUALS_SESSION_KEY);
      }
      localStorage.removeItem(PARTNER_MANUALS_PERSIST_CACHE_KEY);
      return {};
    }
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(PARTNER_MANUALS_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          return parsed as Record<string, CloudPartnerManualDoc>;
        }
      }
    }
    if (typeof localStorage !== 'undefined') {
      const persisted = localStorage.getItem(PARTNER_MANUALS_PERSIST_CACHE_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          return parsed as Record<string, CloudPartnerManualDoc>;
        }
      }
      const rawCare = localStorage.getItem(LOCAL_CARE_DATASET_KEY);
      if (rawCare) {
        const parsedCare = JSON.parse(rawCare);
        const extracted = extractPartnerManualsMap(parsedCare);
        if (Object.keys(extracted).length > 0) {
          return extracted;
        }
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export async function fetchPartnerManualsMap(options?: {
  bypassCache?: boolean;
  gasUrlOverride?: string;
}): Promise<Record<string, CloudPartnerManualDoc>> {
  if (
    typeof localStorage !== 'undefined' &&
    (localStorage.getItem('himart_friend_revoked_v1') === '1' ||
      localStorage.getItem('himart_customer_viewer_only_v1') === '1')
  ) {
    return {};
  }
  if (!options?.bypassCache) {
    const cached = readSessionCachedPartnerManuals();
    if (Object.keys(cached).length > 0) {
      return cached;
    }
  }

  const candidates = resolveCandidateManualGasUrls(options?.gasUrlOverride);
  for (const url of candidates) {
    const careData = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
      bypassCache: true,
      gasUrlOverride: url,
    });
    const map = extractPartnerManualsMap(careData);
    if (Object.keys(map).length > 0) {
      persistPartnerManualsCache(map);
      return map;
    }
  }

  return readSessionCachedPartnerManuals();
}

let prefetchInFlight = false;

export function prefetchPartnerManualsInBackground(): void {
  if (prefetchInFlight) return;
  const cached = readSessionCachedPartnerManuals();
  if (Object.keys(cached).length > 0) return;
  prefetchInFlight = true;
  void fetchPartnerManualsMap({ bypassCache: true }).finally(() => {
    prefetchInFlight = false;
  });
}
