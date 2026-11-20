import { CustomerItem, CustomerStatus } from '../types/crm';

export function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNowDateTimeStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

/**
 * 오늘 기준으로 N일 뒤 날짜 문자열 (YYYY-MM-DD) 반환
 */
export function getOffsetDateStr(daysOffset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 이번 주 금요일 또는 다음 주 금요일 날짜 문자열 (YYYY-MM-DD) 반환
 * nextWeek=false: 이번 주 금요일 (오늘이 금/토일 경우 다가오는 금요일 또는 이번주 금요일)
 * nextWeek=true: 다음 주 금요일
 */
export function getFridayDateStr(nextWeek = false): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0(일) ~ 6(토)
  // 금요일은 5
  let diffToFriday = 5 - dayOfWeek;
  if (diffToFriday < 0) {
    diffToFriday += 7;
  }
  if (nextWeek) {
    diffToFriday += 7;
  }
  d.setDate(d.getDate() + diffToFriday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DDayInfo {
  diff: number | null;
  label: string;
  badgeClass: string;
  isUrgent: boolean;
}

export function getDeliveryDDay(
  deliveryDate: string,
  status?: CustomerStatus
): DDayInfo {
  if (!deliveryDate || !deliveryDate.trim()) {
    return {
      diff: null,
      label: '일정미정',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
      isUrgent: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = deliveryDate.trim().split('-');
  if (parts.length !== 3) {
    return {
      diff: null,
      label: deliveryDate,
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      isUrgent: false,
    };
  }

  const target = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );
  target.setHours(0, 0, 0, 0);

  if (isNaN(target.getTime())) {
    return {
      diff: null,
      label: deliveryDate,
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      isUrgent: false,
    };
  }

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const shortMd = `${parts[1]}/${parts[2]}`;

  // 계약완료 전 상담 단계 고객은 배송일이 적혀 있어도 '희망 수령일'일 뿐이므로 실제 배송 카운트다운/배송완료로 표시하지 않음!
  if (status && status !== '계약완료' && status !== '배송완료') {
    return {
      diff: diffDays,
      label: `희망일 ${shortMd}`,
      badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      isUrgent: false,
    };
  }

  if (status === '배송완료') {
    return {
      diff: diffDays,
      label: `배송완료 (${shortMd})`,
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      isUrgent: false,
    };
  }

  if (diffDays === 0) {
    return {
      diff: 0,
      label: '🚨 오늘배송 (D-Day)',
      badgeClass: 'bg-rose-600 text-white border-rose-600 animate-pulse',
      isUrgent: true,
    };
  }
  if (diffDays === 1) {
    return {
      diff: 1,
      label: '🔥 내일배송 (D-1)',
      badgeClass: 'bg-amber-500 text-white border-amber-500',
      isUrgent: true,
    };
  }
  if (diffDays > 1 && diffDays <= 3) {
    return {
      diff: diffDays,
      label: `⏰ 배송 D-${diffDays}`,
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      isUrgent: true,
    };
  }
  if (diffDays > 3) {
    return {
      diff: diffDays,
      label: `배송 D-${diffDays}`,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      isUrgent: false,
    };
  }
  if (diffDays === -1) {
    return {
      diff: -1,
      label: '어제배송 (해피콜요망)',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      isUrgent: true,
    };
  }
  return {
    diff: diffDays,
    label: `배송완료 (${Math.abs(diffDays)}일전)`,
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    isUrgent: false,
  };
}

/**
 * 재연락 예정일(followUpDate) 상태 계산
 */
export function getFollowUpInfo(customer: CustomerItem): {
  hasFollowUp: boolean;
  isDueOrOverdue: boolean;
  diffDays: number | null;
  shortDate: string;
  label: string;
} {
  const fDate = customer.followUpDate?.trim();
  if (!fDate) {
    return {
      hasFollowUp: false,
      isDueOrOverdue: false,
      diffDays: null,
      shortDate: '',
      label: '',
    };
  }

  const parts = fDate.split('-');
  if (parts.length !== 3) {
    return {
      hasFollowUp: true,
      isDueOrOverdue: false,
      diffDays: null,
      shortDate: fDate,
      label: `📞 재연락: ${fDate}`,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );
  target.setHours(0, 0, 0, 0);

  if (isNaN(target.getTime())) {
    return {
      hasFollowUp: true,
      isDueOrOverdue: false,
      diffDays: null,
      shortDate: fDate,
      label: `📞 재연락: ${fDate}`,
    };
  }

  const shortDate = `${parts[1]}/${parts[2]}`;
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isFollowUpTargetStatus =
    customer.status === '미구매/고민중' ||
    customer.status === '상담진행중' ||
    customer.status === '신규/미발송' ||
    customer.status === '발송완료';

  const isDueOrOverdue = isFollowUpTargetStatus && diffDays <= 0;

  let suffix = '';
  if (diffDays === 0) suffix = ' (오늘!)';
  else if (diffDays < 0) suffix = ` (${Math.abs(diffDays)}일 경과!)`;
  else if (diffDays === 1) suffix = ' (내일)';
  else suffix = ` (D-${diffDays})`;

  return {
    hasFollowUp: true,
    isDueOrOverdue,
    diffDays,
    shortDate,
    label: `📞 재연락: ${shortDate}${suffix}`,
  };
}

/**
 * 오늘 당장 챙겨야 할 긴급/할일 고객 판별
 */
/**
 * 약속된 사은품이 아직 지급되지 않았는지 여부
 */
export function hasUnpaidGift(c: CustomerItem): boolean {
  return Boolean(c.giftItems && c.giftItems.trim()) && !c.giftSent;
}

/**
 * 배송완료 처리되었고 미지급 사은품도 없는 고객인지 여부
 * -> 고객정보 첫 화면(기본 목록)에서는 숨기고, 사은품 미지급이 남아있으면 첫 화면에 계속 표시합니다.
 */
export function isDeliveryDoneAndSettled(c: CustomerItem): boolean {
  return c.status === '배송완료' && !hasUnpaidGift(c);
}

/**
 * 저장된 고객 중 배송 예정일(deliveryDate)이 오늘보다 지났으나(diff < 0)
 * 아직 '배송완료' 처리되지 않은 확인 대상 고객 목록 반환
 */
/**
 * 오직 '계약완료'된 고객만 실제 물류/배송대기 관리 대상입니다.
 * (상담진행중·미구매/고민중·신규/미발송·발송완료 고객의 배송일은 단순 희망 수령일이므로 물류대기에서 100% 제외!)
 */
export function isPendingLogisticsCustomer(c: CustomerItem): boolean {
  if (!c || c.deletedAt) return false;
  if (c.status !== '계약완료') return false;
  if (c.logisticsConfirmed) return false;
  const dday = getDeliveryDDay(c.deliveryDate, c.status);
  // 배송일이 아직 미정이거나 오늘 이후(diff >= 0)인 계약완료 미배정 건
  return dday.diff === null || dday.diff >= 0;
}

export function getPastDueDeliveryCustomers(
  customers: CustomerItem[]
): CustomerItem[] {
  return (customers || [])
    .filter((c) => {
      if (!c || c.deletedAt) return false;
      // 실제 계약완료 고객 중 배송 예정일이 지난 고객만 배송완료 확인 대상
      if (c.status !== '계약완료') return false;
      const dday = getDeliveryDDay(c.deliveryDate, c.status);
      return dday.diff !== null && dday.diff < 0;
    })
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
}

export function isUrgentCustomer(c: CustomerItem): boolean {
  if (c.status === '취소/보류') return false;
  // 배송완료 상태인 경우: 미지급 사은품이 남아있는 경우에만 긴급/할일로 표시
  if (c.status === '배송완료') {
    return hasUnpaidGift(c);
  }
  if (c.status === '신규/미발송') return true;

  // 재연락 예정일이 오늘이거나 지난 미결/상담 고객
  const followUp = getFollowUpInfo(c);
  if (followUp.isDueOrOverdue) return true;

  // 실제 배송·물류·해피콜 긴급 알림은 오직 '계약완료' 고객에게만 적용!
  if (c.status === '계약완료') {
    const dday = getDeliveryDDay(c.deliveryDate, c.status);
    if (
      dday.diff !== null &&
      (dday.diff === 0 || dday.diff === 1 || dday.diff === -1)
    ) {
      return true;
    }
    if (
      dday.diff !== null &&
      dday.diff >= 0 &&
      dday.diff <= 3 &&
      !c.logisticsConfirmed
    ) {
      return true;
    }
    if (dday.diff !== null && dday.diff <= 0 && hasUnpaidGift(c)) {
      return true;
    }
  }

  return false;
}

export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatCurrency(num: number): string {
  if (!num || isNaN(num)) return '0';
  return Math.round(num).toLocaleString('ko-KR');
}

export function formatShortManwon(num: number): string {
  if (!num || isNaN(num)) return '0원';
  if (num >= 10000) {
    const man = Math.round(num / 10000);
    return `${man.toLocaleString('ko-KR')}만`;
  }
  return `${num.toLocaleString('ko-KR')}원`;
}
