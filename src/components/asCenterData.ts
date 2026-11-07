export interface MajorAsCenterItem {
  id: string;
  brand: string;
  phones: { label?: string; number: string }[];
  keywords: string;
}

export const MAJOR_AS_CENTERS: MajorAsCenterItem[] = [
  {
    id: 'samsung',
    brand: '삼성전자 서비스',
    phones: [{ number: '1588-3366' }],
    keywords: '삼성전자 갤럭시 비스포크 냉장고 세탁기 에어컨 TV 노트북 청소기',
  },
  {
    id: 'lg',
    brand: 'LG전자 서비스',
    phones: [{ number: '1544-7777' }],
    keywords: 'LG전자 엘지 오브제 디오스 트롬 휘센 올레드 그램',
  },
  {
    id: 'cuckoo',
    brand: '쿠쿠전자 / 쿠쿠홈시스(정수기)',
    phones: [
      { label: '밥솥/가전', number: '1588-8899' },
      { label: '정수기/홈시스', number: '1577-0010' },
    ],
    keywords: '쿠쿠전자 쿠쿠홈시스 밥솥 정수기 공기청정기 비데 인덕션',
  },
  {
    id: 'cuchen',
    brand: '쿠첸',
    phones: [{ number: '1577-2797' }],
    keywords: '쿠첸 전기밥솥 인덕션 주방가전',
  },
  {
    id: 'winia',
    brand: '위니아딤채 · 큐에이드 (딤채/대우/클라쎄)',
    phones: [
      { label: '위니아딤채 신모델(큐에이드)', number: '1668-5590' },
      { label: '구 위니아/딤채(큐에이드)', number: '1588-9588' },
      { label: '일반가전', number: '1588-1588' },
    ],
    keywords: '위니아딤채 큐에이드 위니아에이드 신모델 구위니아 딤채 대우 클라쎄 김치냉장고 세탁기 냉장고 에어컨 1668-5590 1588-9588',
  },
  {
    id: 'carrier',
    brand: '오텍캐리어 (에어컨/냉장고)',
    phones: [{ number: '1588-8866' }],
    keywords: '오텍캐리어 캐리어 에어컨 냉난방기 냉장고 와인셀러 제습기',
  },
  {
    id: 'skmagic',
    brand: 'SK매직',
    phones: [{ number: '1600-1661' }],
    keywords: 'SK매직 에스케이매직 정수기 식기세척기 인덕션 가스레인지 전자레인지 비데',
  },
  {
    id: 'shinil',
    brand: '신일전자',
    phones: [{ number: '1577-6667' }],
    keywords: '신일전자 선풍기 서큘레이터 히터 난로 이동식에어컨 제습기 계절가전',
  },
  {
    id: 'dyson',
    brand: '다이슨 (Dyson)',
    phones: [{ number: '1588-4253' }],
    keywords: '다이슨 무선청소기 에어랩 드라이기 공기청정기',
  },
  {
    id: 'massage',
    brand: '안마의자 (바디프랜드 / 코지마 / 세라젬 / 제스파)',
    phones: [
      { label: '바디프랜드', number: '02-3448-8980' },
      { label: '코지마', number: '1588-8543' },
      { label: '세라젬', number: '1577-5570' },
      { label: '제스파', number: '02-579-2933' },
    ],
    keywords: '안마의자 마사지기 바디프랜드 코지마 세라젬 제스파',
  },
];

export interface PluxPartnerEntry {
  partnerName: string;
  phones: { label?: string; number: string }[];
  modelsDesc: string;
}

export interface PluxCategoryGroup {
  category: string;
  entries: PluxPartnerEntry[];
}

export const PLUX_AS_GROUPS: PluxCategoryGroup[] = [
  {
    category: '냉장고 / 냉동고 / 김치냉장고',
    entries: [
      {
        partnerName: '[냉장·냉동고] SK네트웍스 (위탁사)',
        phones: [
          { label: '대표', number: '1588-9030' },
          { label: '직통', number: '02-6923-3863' },
        ],
        modelsDesc:
          'PLX-RF420SL, PLX-SBS604BK, PLX-RF245SL/BG, PLX-RF330BG/SL, PLX-RF630SL, PLX-RF528BG, PLX-RF252BG, PLX-FRF470BG, PLX-RF85DWH, PLX-FRF566WB2, PLX-FF160SL, PLX-FF380SL2, PLX-FF272SL2 등 대다수 플럭스 냉장고/냉동고',
      },
      {
        partnerName: '[냉장·냉동고] 씨알케이',
        phones: [{ number: '1588-7100' }],
        modelsDesc: 'PLX-FF380SL, PLX-FRF566WB 등',
      },
      {
        partnerName: '[냉장·냉동고 / 김치냉장고] 하이얼',
        phones: [{ number: '1588-6645' }],
        modelsDesc:
          'PLX-FF272SL, PLX-FF120WH 틈새냉동고 / PLX-SKR338BG 338L 김치냉장고 등',
      },
      {
        partnerName: '[냉장고] 오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-RF138DWH 등',
      },
      {
        partnerName: '[김치냉장고] 디에이치글로벌',
        phones: [{ number: '1660-0286' }],
        modelsDesc: 'PLX-SKR150BG 150L 초정온 김치냉장고',
      },
      {
        partnerName: '[김치냉장고] 위니아에이드',
        phones: [{ number: '1588-9588' }],
        modelsDesc: '하이메이드 김치냉장고 HDKN / HDKR 시리즈',
      },
    ],
  },
  {
    category: '에어컨 / 냉난방기',
    entries: [
      {
        partnerName: '오텍캐리어',
        phones: [{ number: '1588-8866' }],
        modelsDesc:
          'PLX-HAC23CA, PLX-RAC0625/0627/1025/16CA, PLX-HAC16CA 등 캐리어 제조 벽걸이/스탠드',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-HAC0725CHWH 벽걸이 냉난방기 등',
      },
      {
        partnerName: '위니아에이드',
        phones: [{ number: '1588-9588' }],
        modelsDesc: 'PLX-RAC0825CH 등',
      },
      {
        partnerName: '신일전자',
        phones: [{ number: '1577-6667' }],
        modelsDesc: 'PLX-PAC07SIWH 이동식 에어컨',
      },
    ],
  },
  {
    category: 'TV',
    entries: [
      {
        partnerName: '대우테크 (위탁사)',
        phones: [{ number: '1588-1023' }],
        modelsDesc:
          'PLX-TV40FHBK, PLX-TV50QLBK, PLX-TV55UHBK, PLX-TV65UHBK 등',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-TV65QLBK, PLX-TV75MLBK (Mini-LED) 등',
      },
      {
        partnerName: '오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-TV43UHBK 등',
      },
      {
        partnerName: '미래가디언',
        phones: [{ number: '031-812-3020' }],
        modelsDesc: 'PLX-43UHWH 등',
      },
      {
        partnerName: '루미 / 루컴즈',
        phones: [
          { label: '루미', number: '1811-4493' },
          { label: '루컴즈', number: '1600-5488' },
        ],
        modelsDesc: '루미 / 루컴즈 제조 플럭스·하이메이드 TV',
      },
    ],
  },
  {
    category: '세탁기 / 건조기',
    entries: [
      {
        partnerName: '일코전자',
        phones: [{ number: '1899-1552' }],
        modelsDesc:
          'PLX-WM03STBG (3kg 삶는세탁기), PLX-WM075/16/18/21 일반세탁기, PLX-DRY03PTCBG (3kg 미니건조기)',
      },
      {
        partnerName: '오리온창홍',
        phones: [{ number: '1522-2544' }],
        modelsDesc: 'PLX-WM10ACGY (10kg 세탁기)',
      },
      {
        partnerName: '비앰에스 (위탁사)',
        phones: [{ number: '1522-7499' }],
        modelsDesc: 'PLX-WM12ACGY (12kg 세탁기)',
      },
    ],
  },
  {
    category: '실링팬 / 선풍기 / 제습기 / 가습기 / 계절가전',
    entries: [
      {
        partnerName: '닥터매직 (실링팬)',
        phones: [
          { label: '센터', number: '1644-0730' },
          { label: '김찬희 팀장', number: '010-8689-4614' },
        ],
        modelsDesc: '실링팬 (PLX-CF52BDWH, PLX-MCF52IOT, PLX-CF42BDWH)',
      },
      {
        partnerName: '하이마트 당사서비스 / 제이앤티이노베이션 / 국일프라임',
        phones: [
          { label: '당사서비스', number: '1588-9030' },
          { label: '제이앤티/국일', number: '02-2135-5052' },
        ],
        modelsDesc: '선풍기 / 제습기 / 가습기 / 히터 / 전기요 등 계절가전',
      },
    ],
  },
  {
    category: '청소기 / 비데 / 생활가전',
    entries: [
      {
        partnerName: '당사서비스 / JHD / 제이앤티이노베이션 (청소기)',
        phones: [
          { label: '당사서비스', number: '1588-9030' },
          { label: 'JHD', number: '031-8035-5780' },
          { label: '제이앤티', number: '02-2135-5052' },
        ],
        modelsDesc: '청소기 (PLX-GVC250, PLX-CVC23, PLX-VC1600 등)',
      },
      {
        partnerName: 'LS대원 / 애플젠 (비데)',
        phones: [
          { label: 'LS대원', number: '1577-7817' },
          { label: '애플젠', number: '080-080-7166' },
        ],
        modelsDesc: 'LS대원 (PLX-BD01DWWH) / 애플젠 (PLX-BD02AZWH)',
      },
    ],
  },
  {
    category: '주방가전 (정수기 / 가스·전기레인지 / 밥솥 / 전자레인지 / 그릴)',
    entries: [
      {
        partnerName: '쿠쿠홈시스 (퓨어플럭스 정수기)',
        phones: [{ number: '1577-0010' }],
        modelsDesc: '퓨어플럭스 정수기 (PLX-WP100ACKW)',
      },
      {
        partnerName: '하츠 / 경동나비엔 (가스레인지 · 3구 인덕션)',
        phones: [
          { label: '하츠', number: '1644-0806' },
          { label: '경동나비엔', number: '1588-1144' },
        ],
        modelsDesc:
          '하츠 (PLX-GR0224/0325/0226, PLX-EIR0334MTBK) / 경동나비엔 (PLX-GRF0325)',
      },
      {
        partnerName: '쿠쿠 / 쿠첸 / 제이앤티 (IH 전기밥솥)',
        phones: [
          { label: '쿠쿠', number: '1588-8899' },
          { label: '쿠첸', number: '1577-2797' },
          { label: '제이앤티(4인용)', number: '02-2135-5052' },
        ],
        modelsDesc:
          '쿠쿠 (PLX-IRC0625/1025) / 쿠첸 (PLX-IRC10CHIV) / 4인용 (PLX-RC0424BG)',
      },
      {
        partnerName: '하이마트 당사서비스 (소형 주방)',
        phones: [{ number: '1588-9030' }],
        modelsDesc: '전자레인지 / 오븐 / 에어프라이어 / 음식물처리기',
      },
      {
        partnerName: '홀컴퍼니 / 리큅 / 넥스코커머스',
        phones: [
          { label: '홀컴퍼니(식기건조)', number: '031-971-2462' },
          { label: '리큅(식품건조)', number: '1566-6884' },
          { label: '넥스코(두유/다지기)', number: '031-988-1509' },
        ],
        modelsDesc:
          '식기건조기 (PLX-PD5003STBK) / 식품건조기 (PLX-FD05TPWT) / 두유메이커·다지기',
      },
    ],
  },
  {
    category: 'IT / 모니터 / 음향 / 멀티탭 / 모바일충전기',
    entries: [
      {
        partnerName: '주연테크 / 앱코 (모니터)',
        phones: [
          { label: '주연테크', number: '1588-1118' },
          { label: '앱코', number: '1599-2084' },
        ],
        modelsDesc: '주연테크 (PLX-MNT24/27/32) / 앱코 (PLX-MNT27PVWH)',
      },
      {
        partnerName: '액센코리아 / 하나인더스트리 / 제이앤티 (음향)',
        phones: [
          { label: '액센(골전도)', number: '070-4467-6574' },
          { label: '하나(스피커)', number: '1566-6793' },
          { label: '제이앤티(유선)', number: '02-2135-5052' },
        ],
        modelsDesc:
          '골전도 이어폰 (PLX-WEP02SWBK) / 스피커 (PLX-BTS10WRBK) / 유선이어폰 (PLX-EP01CNBK)',
      },
      {
        partnerName: '위드아이엔씨 (멀티탭) / 해브잇올 (고속충전기)',
        phones: [
          { label: '위드아이엔씨', number: '032-675-8669' },
          { label: '해브잇올', number: '070-4610-1134' },
        ],
        modelsDesc:
          '멀티탭 (PLX-MOS / PLX-HCMOS) / 고속충전기 (PLX-CHA18/25)',
      },
    ],
  },
];

export const PLUX_CATEGORY_BUTTON_LABELS: Record<string, string> = {
  '냉장고 / 냉동고 / 김치냉장고': '🧊 냉장고 · 냉동고 · 김치냉장고',
  '에어컨 / 냉난방기': '❄️ 에어컨 · 냉난방기',
  'TV': '📺 TV',
  '세탁기 / 건조기': '🫧 세탁기 · 건조기',
  '실링팬 / 선풍기 / 제습기 / 가습기 / 계절가전':
    '🌀 실링팬 · 선풍기 · 제습기 · 계절가전',
  '청소기 / 비데 / 생활가전': '🧹 청소기 · 비데 · 생활가전',
  '주방가전 (정수기 / 가스·전기레인지 / 밥솥 / 전자레인지 / 그릴)':
    '🍳 주방가전 (정수기·레인지·밥솥·오븐)',
  'IT / 모니터 / 음향 / 멀티탭 / 모바일충전기':
    '💻 IT · 모니터 · 음향 · 멀티탭 · 충전기',
};
