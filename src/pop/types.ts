export interface ProductData {
  id: string;
  category: string; // 품목
  modelName: string; // 모델명
  period: number; // 구독기간
  monthlyFee: number; // 구독료
  downPayment?: number; // 구독 계약금
  careServiceText: string; // 케어명 및 횟수 (예: 데미지 케어보험 1회)
  careServiceCycle: string; // 주기 (예: 구독기간내, 24개월 주기)
  careServiceCount: string; // 횟수
  careServiceBenefit?: string; // 혜택 가치 (예: 27만원 상당)
  careServiceDetail?: string; // 상세 내용 (예: 파손보장, 소모품 배송 등)
  imageUrl: string; // User can upload/paste image later
  changeStatus?: 'new' | 'changed' | 'unchanged';
  rawRowText?: string; // 엑셀의 원본 줄 전체 텍스트 (누락된 헤더의 정보까지 검색하기 위함)
  isAllCare?: boolean; // 올케어 상품 여부 (사용중인 가전 2년 수리비 보증 서비스 포함)
}

export interface CardBenefit {
  id: string;
  name: string;
  discount: number;
  description: string;
  benefitType: string;
}

export const CARD_BENEFITS: CardBenefit[] = [
  {
    id: 'lotte',
    name: '롯데카드',
    discount: 16000,
    description: '30만원 이용시 월 16,000원 캐시백',
    benefitType: '캐시백'
  },
  {
    id: 'woori',
    name: '우리카드',
    discount: 18000,
    description: '30만원 이용시 월 18,000원 청구할인',
    benefitType: '청구할인'
  }
];
