import { CustomerItem } from '../types/crm';
import { idbMirrorGet, idbMirrorSet } from '../../utils/offlineDbQueue';
import {
  buildConfirmedSlipUnitProfiles,
  getMonthlyAllCareCount,
  isConfirmedPurchaseCustomer,
  loadAllMonthlyAllCareCounts,
  MonthlyAllCareCountsMap,
  normalizeIsoDateStr,
  resolveCustomerPerformanceProfile,
} from './settlementEngine';

/**
 * 상품권 시상 정책 시작 기준월
 * - 구독 건당 상품권 시상: 2026년 12월 판매건부터 적용 (익월 15일 실판 완료 시 익익월 말일 지급 -> 첫 지급월 2027-02)
 * - 가전올케어 분기 합산 상품권 시상: 2027년 1~3월 판매건부터 적용 (분기 종료 익월 15일 실판 완료 시 익익월 말일 지급 -> 첫 지급월 2027-05)
 */
export const SUBSCRIPTION_GIFT_CARD_START_YM = '2026-12';
export const ALLCARE_GIFT_CARD_START_YM = '2027-01';

export const SUBSCRIPTION_UNDER_OR_EQUAL_1M_REWARD = 20_000;
export const SUBSCRIPTION_OVER_1M_REWARD = 50_000;
export const ALLCARE_PER_UNIT_REWARD = 5_000;

export const ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY =
  'himart_crm_allcare_quarter_confirmed_overrides_v1';
export const GIFT_CARD_REWARD_UPDATED_EVENT =
  'himart-giftcard-reward-updated';

export type AllCareQuarterOverridesMap = Record<string, number>;

export function shiftYearMonthStr(ym: string, deltaMonths: number): string {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const dt = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1 + deltaMonths,
    1
  );
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYearMonthKorean(ym: string): string {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return `${m[1]}년 ${parseInt(m[2], 10)}월`;
}

/**
 * 연말 해넘이 단축 배달일(예: contractYm='2026-12', rawDelivery='01-12')이 들어왔을 때
 * 계약월보다 배달월 숫자가 작으면 익년도(2027-01-12)로 정확히 정규화합니다.
 */
export function normalizeDeliveryIsoAfterContract(
  rawDeliveryDate?: string,
  contractYm?: string
): string {
  if (!rawDeliveryDate) return '';
  const trimmed = rawDeliveryDate.trim();
  if (!trimmed) return '';

  const fullMatch = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (fullMatch) {
    return normalizeIsoDateStr(trimmed);
  }

  const shortMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (shortMatch && contractYm && /^\d{4}-\d{2}$/.test(contractYm)) {
    const cYear = parseInt(contractYm.slice(0, 4), 10);
    const cMonth = parseInt(contractYm.slice(5, 7), 10);
    const dMonth = parseInt(shortMatch[1], 10);
    const dDay = parseInt(shortMatch[2], 10);
    const resolvedYear = dMonth < cMonth ? cYear + 1 : cYear;
    return `${resolvedYear}-${String(dMonth).padStart(2, '0')}-${String(
      dDay
    ).padStart(2, '0')}`;
  }

  const fallbackYear =
    contractYm && /^\d{4}-\d{2}$/.test(contractYm)
      ? contractYm.slice(0, 4)
      : String(new Date().getFullYear());
  return normalizeIsoDateStr(trimmed, fallbackYear);
}

export interface SubscriptionGiftCardUnitItem {
  id: string;
  customerId: string;
  customerName: string;
  orderNo?: string;
  modelLabel: string;
  contractDateStr: string;
  deliveryDateStr: string;
  principalAmount: number;
  tier: 'over_1m' | 'under_or_equal_1m';
  rewardAmount: number;
  eligible: boolean;
  excludeReason?: 'undated' | 'after_cutoff';
}

export interface SubscriptionGiftCardSummary {
  isPolicyActive: boolean;
  sourceContractYm: string;
  sourceContractLabel: string;
  cutoffDateStr: string;
  cutoffDisplayLabel: string;
  underOrEqual1MCount: number;
  underOrEqual1MAmount: number;
  over1MCount: number;
  over1MAmount: number;
  totalEligibleCount: number;
  totalRewardAmount: number;
  eligibleUnits: SubscriptionGiftCardUnitItem[];
  excludedUnits: SubscriptionGiftCardUnitItem[];
}

export interface AllCareQuarterMonthItem {
  yearMonth: string;
  monthNum: number;
  label: string;
  count: number;
}

export interface AllCareUpcomingQuarterHint {
  quarterLabel: string;
  cutoffDisplayLabel: string;
  payoutMonthLabel: string;
  accumulatedCount: number;
  expectedAmount: number;
}

export interface AllCareGiftCardSummary {
  isPayoutMonth: boolean;
  quarterStartYm: string;
  quarterEndYm: string;
  quarterLabel: string;
  quarterShortLabel: string;
  cutoffDateStr: string;
  cutoffDisplayLabel: string;
  monthlyBreakdown: AllCareQuarterMonthItem[];
  rawQuarterTotalCount: number;
  confirmedCount: number;
  hasManualOverride: boolean;
  unitReward: number;
  totalRewardAmount: number;
  upcomingQuarterHint: AllCareUpcomingQuarterHint | null;
}

export interface MonthlyGiftCardRewardReport {
  payoutYearMonth: string;
  payoutMonthLabel: string;
  payoutDateLabel: string;
  isOverlappingMonth: boolean;
  subscription: SubscriptionGiftCardSummary;
  allCare: AllCareGiftCardSummary;
  totalGiftCardAmount: number;
}

function sanitizeQuarterOverridesMap(raw: unknown): AllCareQuarterOverridesMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: AllCareQuarterOverridesMap = {};
  for (const [ym, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    if (val === null || val === undefined || val === '') continue;
    const num = Math.floor(Number(val));
    if (Number.isFinite(num) && num >= 0) {
      out[ym] = num;
    }
  }
  return out;
}

function emitGiftCardRewardUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GIFT_CARD_REWARD_UPDATED_EVENT));
  }
}

export function loadAllCareQuarterOverrides(): AllCareQuarterOverridesMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeQuarterOverridesMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function hydrateAllCareQuarterOverridesFromIdb(): Promise<AllCareQuarterOverridesMap> {
  const local = loadAllCareQuarterOverrides();
  try {
    const mirrored = await idbMirrorGet<AllCareQuarterOverridesMap>(
      ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY
    );
    const safeMirror = sanitizeQuarterOverridesMap(mirrored);
    if (Object.keys(safeMirror).length > 0 && Object.keys(local).length === 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY,
          JSON.stringify(safeMirror)
        );
      }
      emitGiftCardRewardUpdated();
      return safeMirror;
    }
    if (Object.keys(safeMirror).length > 0) {
      return { ...safeMirror, ...local };
    }
  } catch {
    // ignore IDB errors
  }
  return local;
}

export function saveAllCareQuarterOverrides(
  map: AllCareQuarterOverridesMap
): void {
  const safe = sanitizeQuarterOverridesMap(map);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(
        ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY,
        JSON.stringify(safe)
      );
    } catch {
      // ignore storage quota errors
    }
  }
  void idbMirrorSet(ALLCARE_QUARTER_OVERRIDES_STORAGE_KEY, safe);
  emitGiftCardRewardUpdated();
}

export function setAllCareQuarterConfirmedOverride(
  payoutYearMonth: string,
  confirmedCount: number | null
): AllCareQuarterOverridesMap {
  const current = loadAllCareQuarterOverrides();
  const next: AllCareQuarterOverridesMap = { ...current };
  if (confirmedCount === null || confirmedCount === undefined) {
    delete next[payoutYearMonth];
  } else {
    next[payoutYearMonth] = Math.max(
      0,
      Math.min(9999, Math.floor(Number(confirmedCount) || 0))
    );
  }
  saveAllCareQuarterOverrides(next);
  return next;
}

function buildSubscriptionUnitsFromModels(params: {
  idPrefix: string;
  customerId: string;
  customerName: string;
  orderNo?: string;
  contractDateStr: string;
  deliveryDateStr: string;
  cutoffDateStr: string;
  totalFallbackPrincipal: number;
  subModels: {
    modelName: string;
    category?: string;
    quantity: number;
    principalAmount: number;
  }[];
  hasSubscriptionFlag: boolean;
}): SubscriptionGiftCardUnitItem[] {
  const {
    idPrefix,
    customerId,
    customerName,
    orderNo,
    contractDateStr,
    deliveryDateStr,
    cutoffDateStr,
    totalFallbackPrincipal,
    subModels,
    hasSubscriptionFlag,
  } = params;

  const out: SubscriptionGiftCardUnitItem[] = [];

  const pushUnit = (
    subIdx: string,
    modelLabel: string,
    unitPrincipal: number
  ) => {
    if (!(unitPrincipal > 0)) return;
    const isOver1M = unitPrincipal > 1_000_000;
    const tier: 'over_1m' | 'under_or_equal_1m' = isOver1M
      ? 'over_1m'
      : 'under_or_equal_1m';
    const rewardAmount = isOver1M
      ? SUBSCRIPTION_OVER_1M_REWARD
      : SUBSCRIPTION_UNDER_OR_EQUAL_1M_REWARD;

    const hasDelivery = Boolean(deliveryDateStr);
    const onOrBeforeCutoff = hasDelivery && deliveryDateStr <= cutoffDateStr;
    const eligible = onOrBeforeCutoff;
    const excludeReason: 'undated' | 'after_cutoff' | undefined = eligible
      ? undefined
      : !hasDelivery
      ? 'undated'
      : 'after_cutoff';

    out.push({
      id: `${idPrefix}-${subIdx}`,
      customerId,
      customerName,
      orderNo,
      modelLabel: modelLabel || '구독가전',
      contractDateStr,
      deliveryDateStr,
      principalAmount: unitPrincipal,
      tier,
      rewardAmount,
      eligible,
      excludeReason,
    });
  };

  if (subModels.length > 0) {
    const explicitSum = subModels.reduce(
      (s, m) => s + Math.max(0, Number(m.principalAmount) || 0),
      0
    );
    const totalQty = subModels.reduce(
      (s, m) => s + Math.max(1, Math.floor(Number(m.quantity) || 1)),
      0
    );

    subModels.forEach((m, idx) => {
      const qty = Math.max(1, Math.floor(Number(m.quantity) || 1));
      const linePrincipal = Math.max(0, Number(m.principalAmount) || 0);
      let unitPrincipal = 0;
      if (linePrincipal > 0) {
        unitPrincipal = Math.round(linePrincipal / qty);
      } else if (explicitSum === 0 && totalFallbackPrincipal > 0 && totalQty > 0) {
        unitPrincipal = Math.round(totalFallbackPrincipal / totalQty);
      }
      const label = (m.modelName || m.category || '구독가전').trim();
      for (let q = 0; q < qty; q++) {
        pushUnit(`${idx}-${q}`, label, unitPrincipal);
      }
    });
  } else if (hasSubscriptionFlag && totalFallbackPrincipal > 0) {
    pushUnit('single-0', '구독가전', Math.round(totalFallbackPrincipal));
  }

  return out;
}

function computeSubscriptionGiftCardForPayoutMonth(
  customers: CustomerItem[],
  payoutYearMonth: string
): SubscriptionGiftCardSummary {
  const sourceContractYm = shiftYearMonthStr(payoutYearMonth, -2);
  const cutoffYm = shiftYearMonthStr(payoutYearMonth, -1);
  const cutoffDateStr = `${cutoffYm}-15`;
  const cutoffMonthNum = parseInt(cutoffYm.slice(5, 7), 10) || 1;
  const cutoffDisplayLabel = `${cutoffMonthNum}월 15일 실판 마감`;
  const sourceContractLabel = formatYearMonthKorean(sourceContractYm);

  const isPolicyActive = sourceContractYm >= SUBSCRIPTION_GIFT_CARD_START_YM;
  if (!isPolicyActive) {
    return {
      isPolicyActive: false,
      sourceContractYm,
      sourceContractLabel,
      cutoffDateStr,
      cutoffDisplayLabel,
      underOrEqual1MCount: 0,
      underOrEqual1MAmount: 0,
      over1MCount: 0,
      over1MAmount: 0,
      totalEligibleCount: 0,
      totalRewardAmount: 0,
      eligibleUnits: [],
      excludedUnits: [],
    };
  }

  const allSourceUnits: SubscriptionGiftCardUnitItem[] = [];

  for (const c of customers || []) {
    if (!c || c.deletedAt || !isConfirmedPurchaseCustomer(c)) continue;

    const slipUnits = buildConfirmedSlipUnitProfiles(c);
    if (slipUnits.length > 0) {
      slipUnits.forEach((u, sIdx) => {
        if (u.contractYearMonth !== sourceContractYm) return;
        const rawDeliv =
          u.quote.deliveryDate !== undefined && String(u.quote.deliveryDate).trim()
            ? u.quote.deliveryDate
            : slipUnits.length === 1
            ? c.deliveryDate
            : '';
        const deliveryDateStr = normalizeDeliveryIsoAfterContract(
          rawDeliv,
          u.contractYearMonth
        );
        const subModels = u.purchasedModels.filter(
          (m) => m.saleType === 'subscription'
        );
        const extracted = buildSubscriptionUnitsFromModels({
          idPrefix: `${c.id}-slip-${sIdx}`,
          customerId: c.id,
          customerName: c.name,
          orderNo: u.quote.orderNo,
          contractDateStr: u.contractDateStr,
          deliveryDateStr,
          cutoffDateStr,
          totalFallbackPrincipal: u.subscriptionPrincipal,
          subModels,
          hasSubscriptionFlag:
            u.saleType === 'subscription' || u.subscriptionPrincipal > 0,
        });
        allSourceUnits.push(...extracted);
      });
    } else {
      const profile = resolveCustomerPerformanceProfile(c);
      if (!profile.isConfirmed || profile.contractYearMonth !== sourceContractYm) {
        continue;
      }
      const deliveryDateStr = normalizeDeliveryIsoAfterContract(
        c.deliveryDate,
        profile.contractYearMonth
      );
      const explicitCustSubModels = Array.isArray(c.purchasedModels)
        ? c.purchasedModels.filter(
            (m) => m && m.saleType === 'subscription' && (Number(m.principalAmount) || 0) > 0
          )
        : [];
      const profileSubModels = profile.purchasedModels.filter(
        (m) => m.saleType === 'subscription'
      );
      const subModels =
        profileSubModels.some((m) => (Number(m.principalAmount) || 0) > 0)
          ? profileSubModels
          : explicitCustSubModels.length > 0
          ? explicitCustSubModels
          : profileSubModels;
      const extracted = buildSubscriptionUnitsFromModels({
        idPrefix: `${c.id}-cust`,
        customerId: c.id,
        customerName: c.name,
        contractDateStr: profile.contractDateStr,
        deliveryDateStr,
        cutoffDateStr,
        totalFallbackPrincipal: profile.subscriptionPrincipal,
        subModels,
        hasSubscriptionFlag:
          profile.saleType === 'subscription' ||
          profile.subscriptionPrincipal > 0,
      });
      allSourceUnits.push(...extracted);
    }
  }

  const eligibleUnits = allSourceUnits.filter((u) => u.eligible);
  const excludedUnits = allSourceUnits.filter((u) => !u.eligible);

  const underOrEqual1MCount = eligibleUnits.filter(
    (u) => u.tier === 'under_or_equal_1m'
  ).length;
  const over1MCount = eligibleUnits.filter((u) => u.tier === 'over_1m').length;

  const underOrEqual1MAmount =
    underOrEqual1MCount * SUBSCRIPTION_UNDER_OR_EQUAL_1M_REWARD;
  const over1MAmount = over1MCount * SUBSCRIPTION_OVER_1M_REWARD;
  const totalRewardAmount = underOrEqual1MAmount + over1MAmount;

  return {
    isPolicyActive: true,
    sourceContractYm,
    sourceContractLabel,
    cutoffDateStr,
    cutoffDisplayLabel,
    underOrEqual1MCount,
    underOrEqual1MAmount,
    over1MCount,
    over1MAmount,
    totalEligibleCount: eligibleUnits.length,
    totalRewardAmount,
    eligibleUnits,
    excludedUnits,
  };
}

function buildUpcomingQuarterHint(
  payoutYearMonth: string,
  allCareMap: MonthlyAllCareCountsMap
): AllCareUpcomingQuarterHint | null {
  const m = String(payoutYearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);

  let qYear = year;
  let startM = 1;
  let endM = 3;
  let cutoffLabel = '4월 15일 실판 마감';
  let payoutLabel = `${year}년 5월 말일 지급`;

  if (payoutYearMonth < '2027-01') {
    qYear = 2027;
    startM = 1;
    endM = 3;
    cutoffLabel = '4월 15일 실판 마감';
    payoutLabel = '2027년 5월 말일 지급';
  } else if (month === 1 || month === 2 || month === 3 || month === 4) {
    qYear = year;
    startM = 1;
    endM = 3;
    cutoffLabel = '4월 15일 실판 마감';
    payoutLabel = `${year}년 5월 말일 지급`;
  } else if (month === 6 || month === 7) {
    qYear = year;
    startM = 4;
    endM = 6;
    cutoffLabel = '7월 15일 실판 마감';
    payoutLabel = `${year}년 8월 말일 지급`;
  } else if (month === 9 || month === 10) {
    qYear = year;
    startM = 7;
    endM = 9;
    cutoffLabel = '10월 15일 실판 마감';
    payoutLabel = `${year}년 11월 말일 지급`;
  } else if (month === 12) {
    qYear = year;
    startM = 10;
    endM = 12;
    cutoffLabel = '익년 1월 15일 실판 마감';
    payoutLabel = `${year + 1}년 2월 말일 지급`;
  } else {
    return null;
  }

  let acc = 0;
  for (let mm = startM; mm <= endM; mm++) {
    const ym = `${qYear}-${String(mm).padStart(2, '0')}`;
    acc += getMonthlyAllCareCount(ym, allCareMap);
  }

  return {
    quarterLabel: `${qYear}년 ${startM}~${endM}월`,
    cutoffDisplayLabel: cutoffLabel,
    payoutMonthLabel: payoutLabel,
    accumulatedCount: acc,
    expectedAmount: acc * ALLCARE_PER_UNIT_REWARD,
  };
}

function computeAllCareGiftCardForPayoutMonth(
  payoutYearMonth: string,
  allCareMap: MonthlyAllCareCountsMap,
  quarterOverrides: AllCareQuarterOverridesMap
): AllCareGiftCardSummary {
  const m = String(payoutYearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    return {
      isPayoutMonth: false,
      quarterStartYm: '',
      quarterEndYm: '',
      quarterLabel: '',
      quarterShortLabel: '',
      cutoffDateStr: '',
      cutoffDisplayLabel: '',
      monthlyBreakdown: [],
      rawQuarterTotalCount: 0,
      confirmedCount: 0,
      hasManualOverride: false,
      unitReward: ALLCARE_PER_UNIT_REWARD,
      totalRewardAmount: 0,
      upcomingQuarterHint: null,
    };
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);

  let quarterMonths: string[] | null = null;
  let quarterLabel = '';
  let quarterShortLabel = '';
  let cutoffDateStr = '';
  let cutoffDisplayLabel = '';

  if (month === 5 && year >= 2027) {
    quarterMonths = [`${year}-01`, `${year}-02`, `${year}-03`];
    quarterLabel = `${year}년 1~3월`;
    quarterShortLabel = '1~3월';
    cutoffDateStr = `${year}-04-15`;
    cutoffDisplayLabel = '4월 15일 실판 마감';
  } else if (month === 8 && year >= 2027) {
    quarterMonths = [`${year}-04`, `${year}-05`, `${year}-06`];
    quarterLabel = `${year}년 4~6월`;
    quarterShortLabel = '4~6월';
    cutoffDateStr = `${year}-07-15`;
    cutoffDisplayLabel = '7월 15일 실판 마감';
  } else if (month === 11 && year >= 2027) {
    quarterMonths = [`${year}-07`, `${year}-08`, `${year}-09`];
    quarterLabel = `${year}년 7~9월`;
    quarterShortLabel = '7~9월';
    cutoffDateStr = `${year}-10-15`;
    cutoffDisplayLabel = '10월 15일 실판 마감';
  } else if (month === 2 && year >= 2028) {
    const prevY = year - 1;
    quarterMonths = [`${prevY}-10`, `${prevY}-11`, `${prevY}-12`];
    quarterLabel = `${prevY}년 10~12월`;
    quarterShortLabel = '10~12월';
    cutoffDateStr = `${year}-01-15`;
    cutoffDisplayLabel = '1월 15일 실판 마감';
  }

  if (
    !quarterMonths ||
    quarterMonths[0] < ALLCARE_GIFT_CARD_START_YM
  ) {
    return {
      isPayoutMonth: false,
      quarterStartYm: '',
      quarterEndYm: '',
      quarterLabel: '',
      quarterShortLabel: '',
      cutoffDateStr: '',
      cutoffDisplayLabel: '',
      monthlyBreakdown: [],
      rawQuarterTotalCount: 0,
      confirmedCount: 0,
      hasManualOverride: false,
      unitReward: ALLCARE_PER_UNIT_REWARD,
      totalRewardAmount: 0,
      upcomingQuarterHint: buildUpcomingQuarterHint(payoutYearMonth, allCareMap),
    };
  }

  const monthlyBreakdown: AllCareQuarterMonthItem[] = quarterMonths.map(
    (ym) => {
      const mNum = parseInt(ym.slice(5, 7), 10);
      return {
        yearMonth: ym,
        monthNum: mNum,
        label: `${mNum}월`,
        count: getMonthlyAllCareCount(ym, allCareMap),
      };
    }
  );

  const rawQuarterTotalCount = monthlyBreakdown.reduce(
    (s, item) => s + item.count,
    0
  );
  const hasManualOverride = Object.prototype.hasOwnProperty.call(
    quarterOverrides,
    payoutYearMonth
  );
  const confirmedCount = hasManualOverride
    ? Math.max(0, Math.floor(Number(quarterOverrides[payoutYearMonth]) || 0))
    : rawQuarterTotalCount;
  const totalRewardAmount = confirmedCount * ALLCARE_PER_UNIT_REWARD;

  return {
    isPayoutMonth: true,
    quarterStartYm: quarterMonths[0],
    quarterEndYm: quarterMonths[quarterMonths.length - 1],
    quarterLabel,
    quarterShortLabel,
    cutoffDateStr,
    cutoffDisplayLabel,
    monthlyBreakdown,
    rawQuarterTotalCount,
    confirmedCount,
    hasManualOverride,
    unitReward: ALLCARE_PER_UNIT_REWARD,
    totalRewardAmount,
    upcomingQuarterHint: null,
  };
}

export function computeMonthlyGiftCardRewardReport(
  customers: CustomerItem[],
  payoutYearMonth: string,
  allCareCountsMap?: MonthlyAllCareCountsMap,
  quarterOverridesMap?: AllCareQuarterOverridesMap
): MonthlyGiftCardRewardReport {
  const effectiveAllCare = allCareCountsMap ?? loadAllMonthlyAllCareCounts();
  const effectiveOverrides = quarterOverridesMap ?? loadAllCareQuarterOverrides();

  const subscription = computeSubscriptionGiftCardForPayoutMonth(
    customers,
    payoutYearMonth
  );
  const allCare = computeAllCareGiftCardForPayoutMonth(
    payoutYearMonth,
    effectiveAllCare,
    effectiveOverrides
  );

  const payoutMonthLabel = formatYearMonthKorean(payoutYearMonth);
  const payoutMonthNum = parseInt(payoutYearMonth.slice(5, 7), 10) || 1;
  const payoutDateLabel = `${payoutMonthNum}월 말일 상품권 지급`;
  const isOverlappingMonth =
    subscription.isPolicyActive && allCare.isPayoutMonth;
  const totalGiftCardAmount =
    subscription.totalRewardAmount + allCare.totalRewardAmount;

  return {
    payoutYearMonth,
    payoutMonthLabel,
    payoutDateLabel,
    isOverlappingMonth,
    subscription,
    allCare,
    totalGiftCardAmount,
  };
}
