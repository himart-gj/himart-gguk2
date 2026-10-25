export type CustomerStatus =
  | '신규/미발송'
  | '발송완료'
  | '상담진행중'
  | '미구매/고민중'
  | '계약완료'
  | '취소/보류';

export type SortOrder = 'regDesc' | 'deliveryAsc' | 'amountDesc' | 'urgentFirst';

export type FilterTab =
  | '전체'
  | '🔥긴급/오늘할일'
  | '🚚물류/배송대기'
  | '🎁사은품미지급'
  | CustomerStatus;

export interface QuotePlan2Summary {
  itemSummary: string;
  paidAmount: number;
  netAmount: number;
  benefit?: string;
}

export interface QuoteRecord {
  id: string;
  title: string;
  createdAt: string;
  itemSummary: string;
  paidAmount: number;
  netAmount: number;
  benefit: string;
  // 신규 통합 견적기 완벽 호환용 스냅샷
  proposalState?: any;
  quoteMode?: 'general' | 'subscription' | 'hybrid';
  plan2Summary?: QuotePlan2Summary;
}

export interface CustomerItem {
  id: string;
  regDate: string; // 등록일시 (YYYY-MM-DD HH:mm)
  name: string;
  phone: string;
  items: string;
  paidAmount: number; // 결제금액
  netAmount: number; // 체감가
  expectedBenefit: string;
  deliveryDate: string; // YYYY-MM-DD
  status: CustomerStatus;
  memo: string;

  // 매장 실전 추가 항목
  orderNo?: string; // 전표번호 / 계약번호
  giftItems?: string; // 약속 사은품 내역
  giftSent?: boolean; // 사은품 지급 완료 여부
  logisticsConfirmed?: boolean; // 물류/기사 배정 확인 여부

  // 미결/고민 고객 재연락 예정일 (YYYY-MM-DD)
  followUpDate?: string;

  // 고객별 다중 견적 보관함 (최대 5개)
  quotes?: QuoteRecord[];

  // 휴지통 (소프트 삭제: 삭제된 시각 타임스탬프 ms)
  deletedAt?: number;
}

export interface SMSTemplate {
  id: string;
  label: string;
  icon: string;
  badgeColor: string;
  generate: (customer: CustomerItem) => string;
}
