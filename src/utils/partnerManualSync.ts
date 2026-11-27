import {
  fetchStoreCloudDataset,
  normalizeGasWebAppUrl,
  readRawSyncConfig,
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

export function hasConfiguredCloudEndpoint(): boolean {
  return Boolean(normalizeGasWebAppUrl(readRawSyncConfig().repo));
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

export function readSessionCachedPartnerManuals(): Record<
  string,
  CloudPartnerManualDoc
> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('himart_friend_revoked_v1') === '1'
    ) {
      sessionStorage.removeItem(PARTNER_MANUALS_SESSION_KEY);
      return {};
    }
    const raw = sessionStorage.getItem(PARTNER_MANUALS_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, CloudPartnerManualDoc>;
  } catch {
    return {};
  }
}

export async function fetchPartnerManualsMap(options?: {
  bypassCache?: boolean;
  gasUrlOverride?: string;
}): Promise<Record<string, CloudPartnerManualDoc>> {
  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('himart_friend_revoked_v1') === '1'
  ) {
    return {};
  }
  if (!options?.bypassCache) {
    const cached = readSessionCachedPartnerManuals();
    if (Object.keys(cached).length > 0) {
      return cached;
    }
  }
  const careData = await fetchStoreCloudDataset<Record<string, unknown>>('care', {
    bypassCache: options?.bypassCache,
    gasUrlOverride: options?.gasUrlOverride,
  });
  const map = extractPartnerManualsMap(careData);
  if (typeof sessionStorage !== 'undefined' && Object.keys(map).length > 0) {
    try {
      sessionStorage.setItem(PARTNER_MANUALS_SESSION_KEY, JSON.stringify(map));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PARTNER_MANUALS_UPDATED_EVENT));
      }
    } catch {
      // ignore session quota errors
    }
  }
  return map;
}
