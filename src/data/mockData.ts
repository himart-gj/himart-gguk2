import { CustomerItem } from '../types/crm';

export const INITIAL_MOCK_CUSTOMERS: CustomerItem[] = [
  // 1. 배송관리: 김영희 (전표 20260920-0040, 65인치 TV, 배송일 2026-09-28 [D-1])
  {
    id: 'tab2-001',
    source: 'tab2',
    name: '김영희',
    phone: '010-8903-1678',
    slipNo: '20260920-0040',
    category: '영상가전',
    items: 'LG 65인치 OLED TV (OLED65C3) + 사운드바',
    paidAmount: 2850000,
    netAmount: 2450000,
    benefit: '롯데제휴카드 40만 캐시백 + 전표할인',
    deliveryDate: '2026-09-28',
    status: '배송대기',
    rawStatus: '배송대기',
    date: '2026-09-20',
    note: '벽걸이 타공 설치 요청 / 사은품 사운드바 동봉 출고 완료 / 배송 전 기사 해피콜 요망',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_kim01',
    isSmsSent: true,
  },
  // 2. 배송관리 (구독): 성아현 (전표 20260920-52/0020, 냉장고+세탁건조기 36개월 구독 체감0원, 배송일 2026-10-06)
  {
    id: 'tab2-002',
    source: 'tab2',
    name: '성아현',
    phone: '010-4821-9932',
    slipNo: '20260920-52/0020',
    category: '주방/세탁',
    items: 'LG 오브제 4도어 냉장고 + 워시타워 (세탁 25kg/건조 20kg)',
    paidAmount: 4100000,
    netAmount: 0,
    benefit: '36개월 가전구독 체감0원 (하이프리드300 2구좌 + 제휴카드 전월실적)',
    deliveryDate: '2026-10-06',
    status: '배송대기',
    rawStatus: '배송대기',
    date: '2026-09-20',
    note: '사다리차 진입 가능 여부 관리사무소 사전 확인 완료. 가전구독 36개월 약정 등록 필.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_sung02',
    isSmsSent: true,
  },
  // 3. 배송완료: 정성우 (전표 20260912-0024, 원바디 세탁건조기, 9/23 배송완료)
  {
    id: 'tab2-003',
    source: 'tab2',
    name: '정성우',
    phone: '010-3321-7789',
    slipNo: '20260912-0024',
    category: '세탁가전',
    items: 'LG 원바디 세탁건조기 컴팩트 워시타워',
    paidAmount: 2490000,
    netAmount: 2190000,
    benefit: '우리제휴카드 30만 캐시백',
    deliveryDate: '2026-09-23',
    status: '배송완료',
    rawStatus: '배송완료',
    date: '2026-09-12',
    note: '9/23 기사님 설치 완료 및 만족도 최고점수 완료. 추가 필터 사은품 증정 완료.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_jung03',
    isSmsSent: true,
  },
  // 4. 미구매: 혼수고객님 (010-2465-5206, 삼성3종+TCL TV 견적 후 고민중, 10월말~11월초 배송)
  {
    id: 'tab2-004',
    source: 'tab2',
    name: '혼수고객님',
    phone: '010-2465-5206',
    slipNo: '견적-20260925-01',
    category: '혼수 패키지',
    items: '삼성 3종(비스포크 4도어 + 세탁건조기 + 식기세척기) + TCL 75인치 TV',
    paidAmount: 6800000,
    netAmount: 5200000,
    benefit: '웨딩 특별할인 + 하이프리드 1구좌(300만 지원) 검토',
    deliveryDate: '2026-10-30',
    status: '미구매/고민중',
    rawStatus: '미구매',
    date: '2026-09-25',
    note: '인근 삼성스토어 견적서와 세부 모델 비교 중. 10/2 본행사 추가 사은품 조건 제시 시 계약 유력.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_wedding04',
    isSmsSent: true,
  },
  // 5. 상담진행: 박정현 (010-9956-3414, 대전, LG 3종 630만 픽스, 10/2 리뉴얼 본행사 최종 견적)
  {
    id: 'tab2-005',
    source: 'tab2',
    name: '박정현',
    phone: '010-9956-3414',
    slipNo: '상담-20260924-02',
    category: '신혼 가전',
    items: 'LG 오브제 3종 (냉장고 + 워시타워 + 스타일러)',
    paidAmount: 6300000,
    netAmount: 5100000,
    benefit: '리뉴얼 오픈 특가 + 제휴카드 캐시백',
    deliveryDate: '2026-10-15',
    status: '상담진행중',
    rawStatus: '상담진행',
    date: '2026-09-24',
    note: '대전 거주 신혼부부. 1차 유선상담으로 630만 금액 픽스. 10/2 리뉴얼 본행사 오픈 프로모션 반영 최종 계약 내방 예정.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_park05',
    isSmsSent: true,
  },
  // 6. 상담진행: 임청 (010-4565-3476, 이사, 삼성스토어 11종 비교, 10/2 행사 재연락)
  {
    id: 'tab2-006',
    source: 'tab2',
    name: '임청',
    phone: '010-4565-3476',
    slipNo: '상담-20260925-05',
    category: '입주/이사 패키지',
    items: '삼성 11종 풀 패키지 (TV 85", 냉장고, 김치냉장고, 워시콤보, 시스템에어컨 등)',
    paidAmount: 18500000,
    netAmount: 14200000,
    benefit: '경기광주점 단독 리뉴얼 11종 결합 캐시백',
    deliveryDate: '2026-11-05',
    status: '상담진행중',
    rawStatus: '상담진행',
    date: '2026-09-25',
    note: '삼성스토어 11종 비교 견적 진행 중. 10/2 리뉴얼 그랜드 오픈 당일 센터장 특별 승인 조건 안내 후 계약 확정 예정.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_lim06',
    isSmsSent: false,
  },
  // 7. 상담진행: 문종찬 (010-6505-0020, 웨딩, LG 11종 패키지 1안 2162만/2안 2014만, 10/19 배송)
  {
    id: 'tab2-007',
    source: 'tab2',
    name: '문종찬',
    phone: '010-6505-0020',
    slipNo: '상담-20260922-01',
    category: '웨딩 프리미엄',
    items: 'LG 11종 패키지 (1안: OLED 77" 포함 2,162만 / 2안: QNED 86" 포함 2,014만)',
    paidAmount: 21620000,
    netAmount: 15800000,
    benefit: 'LG 대형 패키지 포인트 + 하이프리드 더블 혜택',
    deliveryDate: '2026-10-19',
    status: '상담진행중',
    rawStatus: '상담진행',
    date: '2026-09-22',
    note: '웨딩 가전 11종. 1안과 2안 체감가 및 사은품 비교 완료. 이번 주말 예비신부와 동행 최종 방문 계약 진행.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_moon07',
    isSmsSent: true,
  },
  // 8. 상담진행: 권용진 (010-7757-5959, 11/21 설치, 삼성 4종 1060만/로보락 조율)
  {
    id: 'tab2-008',
    source: 'tab2',
    name: '권용진',
    phone: '010-7757-5959',
    slipNo: '상담-20260923-04',
    category: '혼수/신혼',
    items: '삼성 4종 (비스포크 4도어, 그랑데 세탁건조기, 식세기) + 로보락 S8 로봇청소기',
    paidAmount: 10600000,
    netAmount: 8400000,
    benefit: '삼성 다품목 결합 + 로보락 패키지 특가',
    deliveryDate: '2026-11-21',
    status: '상담진행중',
    rawStatus: '상담진행',
    date: '2026-09-23',
    note: '11/21 입주 설치 희망. 로보락 로봇청소기 사은품 증정 여부 조율 중.',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_kwon08',
    isSmsSent: true,
  },
  // 추가 물류 대기 예시 1건 (물류 입고 대기 KPI 카드 연동)
  {
    id: 'tab2-009',
    source: 'tab2',
    name: '최원철',
    phone: '010-5124-9081',
    slipNo: '20260924-0012',
    category: '주방가전',
    items: '쿠쿠 마스터셰프 밥솥 + 밀레 인덕션',
    paidAmount: 1580000,
    netAmount: 1320000,
    benefit: '주방가전 동시구매 15만 캐시백',
    deliveryDate: '2026-10-02',
    status: '물류대기',
    rawStatus: '물류대기',
    date: '2026-09-24',
    note: '결제 완료. 수입 인덕션 본사 물류센터 입고 대기 중 (9/29 입고 예정)',
    docUrl: 'https://docs.google.com/document/d/1_himart_sample_choi09',
    isSmsSent: true,
  },

  // 9. 예약 유입 고객 (문자 발송 완료 -> 상담진행중 8명)
  {
    id: 'tab1-001',
    source: 'tab1',
    name: '김민지',
    phone: '010-3028-2700',
    category: '웨딩 가전 패키지',
    service: '리뉴얼 사전예약 혜택 안내',
    date: '2026-09-27 10:15',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 서울 | 선호: 비교견적 | 필요일자: 10월 17일 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-kmj-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '온라인 사전예약 접수 감사 및 10/2 리뉴얼 오픈 특가 상담 안내 문자 발송 완료',
        author: '국지현'
      },
      {
        id: 'log-kmj-2',
        date: '2026-09-27 14:30',
        type: '특이사항',
        content: '10/17 결혼 및 입주 예정. 삼성 vs LG 4종(냉장고/워시타워/TV/식세기) 비교견적 요청함.',
        author: '국지현'
      }
    ],
    quotes: [
      {
        id: 'Q-KMJ-01',
        title: '1차 견적: 웨딩 4종 패키지 (비교안)',
        createdAt: '2026-09-27 14:40',
        mode: 'lump',
        paidAmount: 8900000,
        netAmount: 7200000,
        itemSummary: '냉장고 4도어, 세탁건조기, 75형 TV, 인덕션',
        items: [
          { name: '냉장고 (4도어)', model: 'RF85C9001AP', qty: 1, price: 2700000 },
          { name: '세탁건조기 (원바디)', model: 'WD25H9000KP', qty: 1, price: 2900000 },
          { name: '75형 UHD TV', model: 'KQ75Q60C', qty: 1, price: 2100000 },
          { name: '3구 인덕션', model: 'NZ63B6657XW', qty: 1, price: 1200000 }
        ],
        lumpCard: '우리 제휴',
        lumpDc: 500000,
        lumpCash: 600000,
        customerMemo: '10/2 리뉴얼 오픈 행사 시 추가 모바일 상품권 및 주방용품 세트 증정',
        internalMemo: '10/2 본행사 오픈일 전화 연락 후 내방 약속'
      }
    ]
  },
  {
    id: 'tab1-002',
    source: 'tab1',
    name: '정영길',
    phone: '010-5417-5220',
    category: '이사 가전 (LG)',
    service: '대형 가전 리뉴얼 프로모션',
    date: '2026-09-27 09:40',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 부천 | 선호: LG전자 | 필요일자: 아무때나 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-jyg-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '온라인 접수 감사 및 LG전자 대형가전 특가 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-003',
    source: 'tab1',
    name: '김준태',
    phone: '010-8932-0489',
    category: '가전종합 (삼성)',
    service: '입주박람회 연계 쿠폰',
    date: '2026-09-26 18:20',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 서울 | 선호: 삼성전자 | 필요일자: 미기입 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-kjt-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '삼성전자 패키지 특가 프로모션 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-004',
    source: 'tab1',
    name: '서윤',
    phone: '010-3127-8101',
    category: '웨딩 가전 비교',
    service: '주방가전 리모델링 프로모션',
    date: '2026-09-26 15:10',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 서울 | 선호: 비교견적 | 필요일자: 10월 말 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-sy-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '웨딩 가전 비교견적 상담 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-005',
    source: 'tab1',
    name: '성진',
    phone: '010-2852-7486',
    category: '이사 가전 (LG)',
    service: '네이버 플레이스 예약',
    date: '2026-09-25 17:30',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 고양 | 선호: LG전자 | 필요일자: 미기입 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-sj-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '이사 가전 LG 프로모션 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-006',
    source: 'tab1',
    name: '곽의정',
    phone: '010-2830-7962',
    category: '이사 가전 비교',
    service: '웨딩 가전 특별전',
    date: '2026-09-25 14:00',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 서울 | 선호: 비교견적 | 필요일자: 12월 3일 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-kuj-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '12월 이사 예정 가전 비교견적 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-007',
    source: 'tab1',
    name: '이기동',
    phone: '010-7387-9011',
    category: '웨딩 가전 (LG)',
    service: '임직원몰 제휴 코드',
    date: '2026-09-24 16:45',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 광명 | 선호: LG전자 | 필요일자: 10월 17일 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-lkd-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '10/17 결혼 웨딩 가전 LG 오브제 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-008',
    source: 'tab1',
    name: '이규빈',
    phone: '010-4104-7082',
    category: '이사 가전 (LG)',
    service: '매장 톡톡 혜택 문의',
    date: '2026-09-24 11:20',
    status: '상담진행중',
    rawStatus: '발송 완료 (2026-09-27 14:14)',
    note: '담당: 국지현 | 지역: 서울 | 선호: LG전자 | 필요일자: 10월 19일 | 외부DB 유입',
    docUrl: '',
    isSmsSent: true,
    smsSentDate: '2026-09-27 14:14',
    logs: [
      {
        id: 'log-lgb-1',
        date: '2026-09-27 14:14',
        type: '문자발송',
        content: '10/19 이사 가전 LG 오브제 상담 안내 문자 발송 완료',
        author: '국지현'
      }
    ]
  },
  {
    id: 'tab1-009',
    source: 'tab1',
    name: '김영희',
    phone: '010-8903-1678',
    category: '세탁기 단품',
    service: '온라인 신규 접수',
    date: '2026-09-27 11:05',
    status: '신규/미발송',
    rawStatus: '미발송',
    note: '기존 TV 구매 고객. 안방 베란다용 통돌이 세탁기 추가 문의 유입.',
    docUrl: '',
    isSmsSent: false,
    logs: [
      {
        id: 'log-kyh-1',
        date: '2026-09-27 11:05',
        type: '특이사항',
        content: '기존 TV 구매 고객. 베란다용 통돌이 세탁기 신규 접수됨',
        author: '시스템'
      }
    ]
  },
];
