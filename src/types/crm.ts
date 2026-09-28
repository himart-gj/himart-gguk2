export type PipelineStatus = 
  | '신규/미발송'
  | '배송대기'
  | '물류대기'
  | '미구매/고민중'
  | '상담진행중'
  | '배송완료';

export interface Tab1Record {
  id: string;
  name: string;
  phone: string;
  category: string;
  service: string;
  date: string;
  status: string; // '미발송', '발송완료' 등
  note: string;
  docUrl?: string;
}

export interface Tab2Record {
  id: string;
  name: string;
  phone: string;
  slipNo: string;
  items: string;
  paidAmount: number;
  netAmount: number;
  benefit: string;
  deliveryDate: string; // YYYY-MM-DD
  status: string; // '배송대기', '물류대기', '미구매', '상담진행', '배송완료'
  note: string;
  docUrl?: string;
}

export interface QuoteRecordItem {
  name: string;
  model: string;
  qty: number;
  price: number;
  months?: string;
}

export interface QuoteRecord {
  id: string;
  title: string;
  createdAt: string;
  mode: 'lump' | 'sub';
  paidAmount: number;
  netAmount: number;
  itemSummary: string;
  items: QuoteRecordItem[];
  lumpCard?: string;
  lumpDc?: number;
  lumpCash?: number;
  subCardCorp?: string;
  subCardTier?: number;
  hiFreedSummary?: string;
  customerMemo?: string;
  internalMemo?: string;
  rawCalculatorData?: any; // Full snapshot for 100% loss-free restore
}

export interface ConsultationLog {
  id: string;
  date: string;
  type: '상담메모' | '문자발송' | '견적산출' | '배송조율' | '특이사항';
  content: string;
  author?: string;
}

export interface CustomerItem {
  id: string;
  source: 'tab1' | 'tab2';
  name: string;
  phone: string;
  slipNo?: string;
  category?: string;
  reservationType?: '이사' | '입주' | '웨딩' | '일반' | string;
  items?: string;
  paidAmount?: number;
  netAmount?: number;
  benefit?: string;
  deliveryDate?: string; // YYYY-MM-DD
  status: PipelineStatus;
  rawStatus?: string;
  service?: string;
  date?: string;
  note: string;
  docUrl?: string;
  dDay?: number | null; // e.g. 0 for today, 1 for tomorrow, -1 for yesterday
  isSmsSent?: boolean;
  smsSentDate?: string;
  giftItem?: string;
  isGiftDelivered?: boolean;
  quotes?: QuoteRecord[];
  logs?: ConsultationLog[];
}

