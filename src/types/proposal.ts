export type QuoteMode = 'general' | 'subscription' | 'hybrid';
export type AppStep = 'home' | 'input' | 'proposal' | 'pop-printer' | 'crm' | 'himobile' | 'insurance' | 'care-table' | 'lotte-plan' | 'allcare-guide' | 'marketing-db';
export type SubscriptionPeriod = 36 | 60;

// ==================== 일반구매(일시불) 타입 ====================
export interface GeneralPurchaseItem {
  id: string;
  category: string;
  modelName: string;
  quantity: number;
  unitPrice: number; // 단가(행사가)
  name?: string;
  code?: string;
  qty?: number;
  price?: number;
  discount1?: number; // 기타할인1 (즉시할인 합계)
  discount2?: number; // 기타할인2 (L.Point 합계)
  cashback?: number; // 캐시백 (금액대 캐시백)
}

export type GeneralExtraBenefitType = 'discount' | 'etc';

export interface GeneralExtraBenefitItem {
  id: string;
  type: GeneralExtraBenefitType; // 'discount' = 즉시할인성 추가혜택, 'etc' = 캐시백/사은품 등 실결제 이후 추가혜택
  description: string;
  amount: number;
}

export type GeneralCardType =
  | '롯데 제휴카드'
  | '삼성 제휴카드'
  | '신한 제휴카드'
  | '우리 제휴카드'
  | '일반카드'
  | '미정';

export const GENERAL_CARD_OPTIONS: GeneralCardType[] = [
  '롯데 제휴카드',
  '삼성 제휴카드',
  | '신한 제휴카드'
  , '우리 제휴카드',
  '일반카드',
  '미정',
];
