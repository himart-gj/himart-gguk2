import { idbMirrorGet, idbMirrorSet } from './offlineDbQueue';

export const HIDE_INCENTIVE_AMOUNTS_KEY = 'himart_hide_home_incentive_amounts';
export const HOME_BANNER_EXPANDED_KEY = 'himart_home_banner_expanded_v1';
export const CRM_INCENTIVE_BAR_HIDDEN_KEY = 'himart_crm_incentive_bar_hidden_v1';
export const DEFAULT_HIDE_HIPREED_KEY = 'himart_default_hide_hipreed_v1';
export const DEFAULT_HIDE_SUBPREED_KEY = 'himart_default_hide_subpreed_v1';

export const UI_VISIBILITY_UPDATED_EVENT = 'himart_ui_visibility_prefs_updated';

interface UiVisibilityMemCache {
  hideIncentiveAmounts: boolean | null;
  homeBannerExpanded: boolean | null;
  crmIncentiveBarHidden: boolean | null;
  defaultHideHiPreed: boolean | null;
  defaultHideSubPreed: boolean | null;
}

const mem: UiVisibilityMemCache = {
  hideIncentiveAmounts: null,
  homeBannerExpanded: null,
  crmIncentiveBarHidden: null,
  defaultHideHiPreed: null,
  defaultHideSubPreed: null,
};

function readBoolStorage(key: string, fallback: boolean): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function writeBoolStorageAndMirror(key: string, value: boolean): void {
  const strVal = value ? '1' : '0';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, strVal);
    }
  } catch {
    // ignore quota/private mode errors
  }
  void idbMirrorSet(key, strVal);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_VISIBILITY_UPDATED_EVENT));
  }
}

export function getHideIncentiveAmountsPref(): boolean {
  const stored = readBoolStorage(
    HIDE_INCENTIVE_AMOUNTS_KEY,
    mem.hideIncentiveAmounts ?? false
  );
  mem.hideIncentiveAmounts = stored;
  return stored;
}

export function setHideIncentiveAmountsPref(hidden: boolean): void {
  const next = Boolean(hidden);
  mem.hideIncentiveAmounts = next;
  writeBoolStorageAndMirror(HIDE_INCENTIVE_AMOUNTS_KEY, next);
}

export function getHomeBannerExpandedPref(): boolean {
  const stored = readBoolStorage(
    HOME_BANNER_EXPANDED_KEY,
    mem.homeBannerExpanded ?? true
  );
  mem.homeBannerExpanded = stored;
  return stored;
}

export function setHomeBannerExpandedPref(expanded: boolean): void {
  const next = Boolean(expanded);
  mem.homeBannerExpanded = next;
  writeBoolStorageAndMirror(HOME_BANNER_EXPANDED_KEY, next);
}

export function getCrmIncentiveBarHiddenPref(): boolean {
  const stored = readBoolStorage(
    CRM_INCENTIVE_BAR_HIDDEN_KEY,
    mem.crmIncentiveBarHidden ?? false
  );
  mem.crmIncentiveBarHidden = stored;
  return stored;
}

export function setCrmIncentiveBarHiddenPref(hidden: boolean): void {
  const next = Boolean(hidden);
  mem.crmIncentiveBarHidden = next;
  writeBoolStorageAndMirror(CRM_INCENTIVE_BAR_HIDDEN_KEY, next);
}

export function getDefaultHidePreedPref(
  kind: 'general' | 'subscription'
): boolean {
  if (kind === 'general') {
    const stored = readBoolStorage(
      DEFAULT_HIDE_HIPREED_KEY,
      mem.defaultHideHiPreed ?? false
    );
    mem.defaultHideHiPreed = stored;
    return stored;
  }
  const stored = readBoolStorage(
    DEFAULT_HIDE_SUBPREED_KEY,
    mem.defaultHideSubPreed ?? false
  );
  mem.defaultHideSubPreed = stored;
  return stored;
}

export function setDefaultHidePreedPref(
  kind: 'general' | 'subscription',
  hidden: boolean
): void {
  const next = Boolean(hidden);
  if (kind === 'general') {
    mem.defaultHideHiPreed = next;
    writeBoolStorageAndMirror(DEFAULT_HIDE_HIPREED_KEY, next);
  } else {
    mem.defaultHideSubPreed = next;
    writeBoolStorageAndMirror(DEFAULT_HIDE_SUBPREED_KEY, next);
  }
}

let hydratedOnce = false;

/**
 * iOS PWA / 인앱 브라우저 등 재실행 시 localStorage 유실 환경에서도
 * IndexedDB 미러에 저장된 수당표·배너·프리드 숨김 설정을 복원합니다.
 */
export async function hydrateUiVisibilityPrefsFromIdb(): Promise<boolean> {
  if (hydratedOnce && typeof indexedDB === 'undefined') return false;
  hydratedOnce = true;

  const entries: Array<{
    key: string;
    cacheProp: keyof UiVisibilityMemCache;
  }> = [
    { key: HIDE_INCENTIVE_AMOUNTS_KEY, cacheProp: 'hideIncentiveAmounts' },
    { key: HOME_BANNER_EXPANDED_KEY, cacheProp: 'homeBannerExpanded' },
    { key: CRM_INCENTIVE_BAR_HIDDEN_KEY, cacheProp: 'crmIncentiveBarHidden' },
    { key: DEFAULT_HIDE_HIPREED_KEY, cacheProp: 'defaultHideHiPreed' },
    { key: DEFAULT_HIDE_SUBPREED_KEY, cacheProp: 'defaultHideSubPreed' },
  ];

  let changed = false;
  await Promise.all(
    entries.map(async ({ key, cacheProp }) => {
      try {
        const localRaw =
          typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        if (localRaw === '1' || localRaw === '0') {
          mem[cacheProp] = localRaw === '1';
          void idbMirrorSet(key, localRaw);
          return;
        }
        const idbVal = await idbMirrorGet<string>(key);
        if (idbVal === '1' || idbVal === '0') {
          const parsed = idbVal === '1';
          mem[cacheProp] = parsed;
          changed = true;
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(key, idbVal);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    })
  );

  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_VISIBILITY_UPDATED_EVENT));
  }
  return changed;
}
