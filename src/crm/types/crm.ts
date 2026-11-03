export type CustomerStatus =
  | '신규/미발송'
  | '발송완료'
  | '상담진행중'
  | '미구매/고민중'
  | '계약완료'
  | '배송완료'
  | '취소/보류';

export type SortOrder = 'regDesc' | 'deliveryAsc' | 'amountDesc' | 'urgentFirst';

export type FilterTab =
  | '전체'
  | '🔥긴급/오늘할일'
  | '🚚물류/배송대기'
  | '🎁사은품미지급'
  | CustomerStatus;

export type CustomerSaleType = 'general' | 'subscription' | 'hybrid';

export interface CustomerFreedCounts {
  // 플러스 구독 (종류 무관 건당 90,000원 수당)
  hi72: number;
  hi90: number;
  hi108: number;
  // 일반 하이프리드 (75: 6만 / 150: 12만 / 225: 18만 / 300: 24만)
  hf75: number;
  hf150: number;
  hf225: number;
  hf300: number;
}

export interface PurchasedModelEntry {
  id: string;
  category: string;
  modelName: string;
  quantity: number;
  saleType: 'general' | 'subscription';
  /** 일반: 제품 행사가 합계(단가×수량), 구독: 구독원금 */
  principalAmount: number;
}

export interface ModelIncentiveRule {
  id: string;
  category: string;
  modelCode: string;
  productName?: string;
  incentiveAmount: number;
  saleTypeFilter?: 'all' | 'general' | 'subscription';
  note?: string;
}

export interface MonthlyModelIncentiveSheet {
  yearMonth: string; // 'YYYY-MM'
  updatedAt: string;
  sourceLabel: string;
  rules: ModelIncentiveRule[];
}

export type ModelIncentivesMap = Record<string, MonthlyModelIncentiveSheet>;

export type SettlementTabId = 'sales' | 'freed' | 'models';

export interface QuotePlan2Summary {
  itemSummary: string;
  paidAmount: number;
  netAmount: number;
  benefit?: string;
  performanceAmount?: number;
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
  // 실적 정산 기준 (일반: 제품 합계 금액 / 구독: 구독원금 / 혼합: 합산)
  performanceAmount?: number;
  generalProductTotal?: number;
  subscriptionPrincipal?: number;
  freedCounts?: CustomerFreedCounts;
  purchasedModels?: PurchasedModelEntry[];
}

export interface CustomerItem {
  id: string;
  regDate: string; // 등록일시 (YYYY-MM-DD HH:mm)
  contractDate?: string; // 계약/매출일 (YYYY-MM-DD, 총판 기준월 · 미지정 시 regDate 기준)
  name: string;
  phone: string;
  items: string;
  paidAmount: number; // 결제금액 (고객 안내용 실결제가 또는 월 구독료)
  netAmount: number; // 체감가 (고객 안내용 최종 혜택가 또는 월 체감가)
  expectedBenefit: string;
  deliveryDate: string; // YYYY-MM-DD (실판 기준월)
  status: CustomerStatus;
  memo: string;

  // 실적/수당 정산 전용 필드 (총판·실판 및 프리드·모델 수당 자동 계산용)
  saleType?: CustomerSaleType;
  performanceAmount?: number; // 실적기준액 (구독: 구독원금, 일반: 제품합계금액, 혼합: 합산)
  generalProductTotal?: number; // 일반 제품 합계 금액
  subscriptionPrincipal?: number; // 구독원금 합계
  freedCounts?: CustomerFreedCounts; // 프리드 가입 구좌 내역
  purchasedModels?: PurchasedModelEntry[]; // 구매 확정 모델 상세 목록

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
