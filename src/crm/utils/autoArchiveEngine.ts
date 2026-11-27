import type { CustomerItem, QuoteRecord } from '../types/crm';

export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function hasUnpaidGiftFlag(c: CustomerItem): boolean {
  return Boolean(c.giftItems && c.giftItems.trim()) && !c.giftSent;
}

export function parseDateStrEndOfDayMs(raw?: string | null): number {
  const s = String(raw || '').trim();
  if (!s) return 0;
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 23, 59, 59, 999);
  const ts = dt.getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * 활성 고객관리(CRM 목록·칸반·달력·홈 카운트)에 노출되는지 여부
 * - 수동 휴지통(deletedAt) 및 14일 자동정리(autoArchivedAt) 고객은 활성 목록에서 제외
 * - 단, 월간 총판·실판·구독·프리드·모델수당 등 정산 엔진은 deletedAt만 제외하고 autoArchivedAt은 100% 포함하여 지표를 영구 보존합니다.
 */
export function isCustomerVisibleInActiveCrm(c?: CustomerItem | null): boolean {
  if (!c) return false;
  if (c.deletedAt) return false;
  if (c.autoArchivedAt) return false;
  return true;
}

/**
 * 배송완료 고객이 14일 자동삭제(autoArchive) 카운트다운 대상인지 판별하고,
 * 모든 전표(2개 이상 다중전표 포함) 배송완료 + 사은품 지급 완료가 모두 끝난 최종 완료 시각(ms)을 반환합니다.
 * 미처리 건(미배송 전표 또는 미지급 사은품)이 1건이라도 남아 있으면 null을 반환합니다.
 */
export function resolveCustomerAllSettledAtMs(
  customer: CustomerItem,
  fallbackNowMs = Date.now()
): number | null {
  if (!customer || customer.deletedAt) return null;
  if (customer.status !== '배송완료') return null;

  // 1) 사은품 미처리건이 남아 있으면 자동삭제 진행 금지
  if (hasUnpaidGiftFlag(customer)) return null;

  // 2) 확정 전표가 1개 이상(특히 추가 구매로 2개 이상)인 경우 모든 확정 전표가 '배송완료'여야 함
  const quotes = Array.isArray(customer.quotes) ? customer.quotes.filter(Boolean) : [];
  const confirmedSlips = quotes.filter((q) => Boolean(q.isConfirmedSlip));
  if (confirmedSlips.some((q) => q.deliveryStatus !== '배송완료')) {
    return null;
  }

  // 3) 모든 처리(배송완료 + 사은품 완료 + 다중전표 각각의 배송완료/배달일) 중 가장 늦은 완료 시점 계산
  const candidates: number[] = [];

  if (customer.deliveredCompletedAtMs && customer.deliveredCompletedAtMs > 0) {
    candidates.push(customer.deliveredCompletedAtMs);
  }

  const hasGift = Boolean(customer.giftItems && customer.giftItems.trim());
  if (hasGift && customer.giftSent && customer.giftSentAtMs && customer.giftSentAtMs > 0) {
    candidates.push(customer.giftSentAtMs);
  }

  for (const slip of confirmedSlips) {
    if (slip.deliveredAtMs && slip.deliveredAtMs > 0) {
      candidates.push(slip.deliveredAtMs);
    } else {
      const slipDelivEnd = parseDateStrEndOfDayMs(slip.deliveryDate);
      if (slipDelivEnd > 0) {
        candidates.push(slipDelivEnd);
      }
    }
  }

  if (candidates.length === 0) {
    if (customer.allSettledAtMs && customer.allSettledAtMs > 0) {
      candidates.push(customer.allSettledAtMs);
    } else {
      const topDelivEnd = parseDateStrEndOfDayMs(customer.deliveryDate);
      if (topDelivEnd > 0) {
        candidates.push(topDelivEnd);
      } else if (customer.updatedAtMs && customer.updatedAtMs > 0) {
        candidates.push(customer.updatedAtMs);
      } else {
        const regEnd = parseDateStrEndOfDayMs(customer.contractDate || customer.regDate);
        candidates.push(regEnd > 0 ? regEnd : fallbackNowMs);
      }
    }
  }

  if (customer.allSettledAtMs && customer.allSettledAtMs > 0) {
    candidates.push(customer.allSettledAtMs);
  }

  return Math.max(...candidates);
}

/**
 * 고객 상태·전표·사은품 변경 전후를 비교하여 완료 시각(deliveredAtMs, deliveredCompletedAtMs, giftSentAtMs)을 정확히 스탬핑하고
 * 14일 경과 여부를 즉시 평가합니다.
 */
export function stampCustomerCompletionTransitions(
  prevCustomer: CustomerItem | undefined | null,
  nextCustomer: CustomerItem,
  nowMs = Date.now()
): CustomerItem {
  const prevSlipMap = new Map<string, QuoteRecord>();
  for (const pq of prevCustomer?.quotes || []) {
    if (pq?.id) prevSlipMap.set(pq.id, pq);
  }

  let nextQuotes = nextCustomer.quotes;
  if (Array.isArray(nextCustomer.quotes)) {
    nextQuotes = nextCustomer.quotes.map((q) => {
      if (!q || !q.isConfirmedSlip) return q;
      const prevQ = prevSlipMap.get(q.id);
      if (q.deliveryStatus === '배송완료') {
        const preservedMs =
          prevQ?.deliveryStatus === '배송완료' && prevQ.deliveredAtMs
            ? prevQ.deliveredAtMs
            : q.deliveredAtMs || nowMs;
        if (q.deliveredAtMs === preservedMs) return q;
        return { ...q, deliveredAtMs: preservedMs };
      }
      if (q.deliveredAtMs !== undefined) {
        return { ...q, deliveredAtMs: undefined };
      }
      return q;
    });
  }

  const hasGift = Boolean(nextCustomer.giftItems && nextCustomer.giftItems.trim());
  let nextGiftSentAtMs = nextCustomer.giftSentAtMs;
  if (hasGift && nextCustomer.giftSent) {
    if (prevCustomer && prevCustomer.giftSent && prevCustomer.giftSentAtMs) {
      nextGiftSentAtMs = prevCustomer.giftSentAtMs;
    } else if (!nextGiftSentAtMs) {
      nextGiftSentAtMs = nowMs;
    }
  } else {
    nextGiftSentAtMs = undefined;
  }

  let nextDeliveredCompletedAtMs = nextCustomer.deliveredCompletedAtMs;
  const confirmedSlips = (nextQuotes || []).filter((q) => Boolean(q?.isConfirmedSlip));
  const allSlipsDone =
    nextCustomer.status === '배송완료' &&
    confirmedSlips.every((q) => q.deliveryStatus === '배송완료');

  if (allSlipsDone) {
    const prevConfirmed = (prevCustomer?.quotes || []).filter((q) => Boolean(q?.isConfirmedSlip));
    const wasAllSlipsDone =
      prevCustomer?.status === '배송완료' &&
      prevConfirmed.length === confirmedSlips.length &&
      prevConfirmed.every((q) => q.deliveryStatus === '배송완료');
    if (wasAllSlipsDone && prevCustomer?.deliveredCompletedAtMs) {
      nextDeliveredCompletedAtMs = prevCustomer.deliveredCompletedAtMs;
    } else if (!nextDeliveredCompletedAtMs) {
      nextDeliveredCompletedAtMs = nowMs;
    } else if (!wasAllSlipsDone) {
      // 추가 전표가 새로 완료된 경우 최신 완료 시점으로 갱신
      nextDeliveredCompletedAtMs = Math.max(nextDeliveredCompletedAtMs, nowMs);
    }
  } else {
    nextDeliveredCompletedAtMs = undefined;
  }

  return evaluateCustomerAutoArchive(
    {
      ...nextCustomer,
      quotes: nextQuotes,
      giftSentAtMs: nextGiftSentAtMs,
      deliveredCompletedAtMs: nextDeliveredCompletedAtMs,
    },
    nowMs
  );
}

/**
 * 단일 고객에 대해 14일 경과 자동정리(autoArchivedAt) 여부를 판정합니다.
 * - 미처리 사은품이 생기거나 추가 전표가 배송대기로 들어오면 autoArchivedAt을 즉시 해제하여 다시 목록에 노출합니다.
 */
export function evaluateCustomerAutoArchive(
  customer: CustomerItem,
  nowMs = Date.now()
): CustomerItem {
  if (!customer) return customer;
  if (customer.deletedAt) {
    return customer;
  }

  const settledAtMs = resolveCustomerAllSettledAtMs(customer, nowMs);
  if (settledAtMs === null) {
    if (customer.allSettledAtMs !== undefined || customer.autoArchivedAt !== undefined) {
      return {
        ...customer,
        allSettledAtMs: undefined,
        autoArchivedAt: undefined,
      };
    }
    return customer;
  }

  const elapsed = nowMs - settledAtMs;
  if (elapsed >= FOURTEEN_DAYS_MS) {
    const archivedTs = customer.autoArchivedAt || nowMs;
    if (
      customer.allSettledAtMs === settledAtMs &&
      customer.autoArchivedAt === archivedTs
    ) {
      return customer;
    }
    return {
      ...customer,
      allSettledAtMs: settledAtMs,
      autoArchivedAt: archivedTs,
    };
  }

  if (customer.allSettledAtMs !== settledAtMs || customer.autoArchivedAt !== undefined) {
    return {
      ...customer,
      allSettledAtMs: settledAtMs,
      autoArchivedAt: undefined,
    };
  }
  return customer;
}

export function evaluateCustomerListAutoArchive(
  list: CustomerItem[],
  nowMs = Date.now()
): CustomerItem[] {
  return (list || []).map((c) => evaluateCustomerAutoArchive(c, nowMs));
}
