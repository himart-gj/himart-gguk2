import { CustomerItem, SMSTemplate } from '../types/crm';
import { formatCurrency } from '../utils/date';

// 초기 실행 시 가짜 샘플 고객이 보이지 않도록 빈 배열로 시작합니다.
export const INITIAL_CUSTOMERS: CustomerItem[] = [];

export const SMS_TEMPLATES: SMSTemplate[] = [
  {
    id: 'quote_detail',
    label: '맞춤 견적안내',
    icon: '📋',
    badgeColor: 'bg-blue-600 text-white',
    generate: (c) =>
      `안녕하세요, ${c.name} 고객님! 😊\n롯데하이마트 국지점 상담원입니다.\n\n오늘 매장에서 상담받으신 맞춤 가전 견적 내역 정리해 드립니다.\n\n■ 상담 모델: ${
        c.items || '맞춤 가전 패키지'
      }\n■ 결제 예정금액: ${formatCurrency(
        c.paidAmount
      )}원\n■ 총 혜택 요약: ${
        c.expectedBenefit || '매장 특별 혜택 적용'
      }\n■ 최종 체감가: ${formatCurrency(
        c.netAmount
      )}원\n${
        c.giftItems ? `■ 약속 사은품: ${c.giftItems}\n` : ''
      }■ 희망 배송일: ${
        c.deliveryDate || '추후 지정 가능'
      }\n\n안내드린 조건은 당월 한정 프로모션 기준이며, 모델 변경이나 추가 궁금하신 점은 언제든 편하게 연락 주세요! 감사합니다.`,
  },
  {
    id: 'promo_closing',
    label: '미결/혜택마감 리마인드',
    icon: '🔥',
    badgeColor: 'bg-amber-600 text-white',
    generate: (c) =>
      `안녕하세요, ${c.name} 고객님! 롯데하이마트 국지점입니다. 😊\n\n지난번 관심 있게 보셨던 [${
        c.items || '상담 가전'
      }] 관련하여 안내 연락드립니다.\n\n현재 적용해 드렸던 특별 혜택(${
        c.expectedBenefit || '카드 캐시백 및 매장 할인'
      } / 체감가 ${formatCurrency(
        c.netAmount
      )}원)이 이번 주 마감될 예정입니다.\n\n재고 소진 전 미리 혜택만 선점해 두실 수 있으니, 진행 원하시면 편하게 말씀해 주세요! 끝까지 가장 좋은 조건으로 챙겨드리겠습니다.`,
  },
  {
    id: 'delivery_notice',
    label: '배송 전일/당일 안내',
    icon: '🚚',
    badgeColor: 'bg-emerald-600 text-white',
    generate: (c) =>
      `안녕하세요, ${c.name} 고객님! 롯데하이마트 국지점입니다. 🚚\n\n주문하신 [${
        c.items || '가전 제품'
      }] 배송 일정 안내드립니다.\n\n■ 배송 예정일: ${
        c.deliveryDate || '지정일'
      }\n${
        c.orderNo ? `■ 전표/계약번호: ${c.orderNo}\n` : ''
      }\n배송 당일 오전에 담당 설치 기사님이 정확한 방문 시간 안내 전화를 드릴 예정입니다.\n설치 공간 확보 및 기존 제품 수거 여부를 미리 확인해 주시면 더욱 빠르고 안전한 설치가 가능합니다.\n\n궁금하신 점은 언제든 연락 주세요!`,
  },
  {
    id: 'happy_call',
    label: '설치 후 해피콜 & 사은품',
    icon: '🎁',
    badgeColor: 'bg-purple-600 text-white',
    generate: (c) =>
      `안녕하세요, ${c.name} 고객님! 롯데하이마트 국지점입니다. 😊\n\n배송받으신 [${
        c.items || '가전 제품'
      }]은 마음에 드시나요?\n설치 과정이나 제품 사용 중 불편하신 점이 있다면 언제든 바로 연락 주시기 바랍니다.\n\n${
        c.giftItems
          ? `아울러 약속드린 사은품(${c.giftItems}) 및 `
          : '아울러 '
      }안내드렸던 캐시백/포인트 혜택(${
        c.expectedBenefit || '결제 혜택'
      })도 일정에 맞춰 꼼꼼히 챙겨드리겠습니다.\n\n항상 건강하시고 행복한 일만 가득하시길 바랍니다. 감사합니다!`,
  },
];
