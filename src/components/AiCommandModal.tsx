import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
  Bot,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Phone,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import {
  AffiliateCardId,
  extractGeneralPlanData,
  GeneralCardType,
  GeneralHiPreedCounts,
  GeneralPlanData,
  HiPlusCounts,
  ProposalState,
  QuoteMode,
  SUB_CARE_OPTIONS,
  SubscriptionPeriod,
} from '../types/proposal';
import { extractQuotePayloadFromProposalState } from '../crm/components/SaveToCrmModal';
import { saveCustomerQuote } from '../crm/services/gasApi';
import { CustomerItem, CustomerStatus } from '../crm/types/crm';
import {
  formatCurrency,
  formatPhoneNumber,
  getFridayDateStr,
  getOffsetDateStr,
} from '../crm/utils/date';
import { GEMINI_MODELS, getEffectiveGeminiApiKey } from '../utils/aiImageParser';

export type AiCustomerStatus = '상담진행중' | '결제완료' | '배송대기' | '상담종료';

export interface ParsedAiCommand {
  quoteMode: QuoteMode;
  generalItems: {
    category: string;
    modelName: string;
    quantity: number;
    unitPrice: number;
  }[];
  generalCardType:
    | '롯데 제휴카드'
    | '삼성 제휴카드'
    | '신한 제휴카드'
    | '우리 제휴카드'
    | '일반 카드'
    | '미정';
  instantDiscount: number;
  earnedPoints: number;
  pointUsed: number;
  extraCashback: number;
  generalHiPreedCounts: GeneralHiPreedCounts;
  subscriptionItems: {
    category: string;
    modelName: string;
    monthlyFee: number;
    period: 36 | 60;
  }[];
  subscriptionPeriod: 36 | 60;
  selectedCardId: AffiliateCardId;
  selectedCardTierId: string;
  hiPlusCounts: HiPlusCounts;
  customer: {
    shouldSaveCrm: boolean;
    name: string;
    phone: string;
    status: AiCustomerStatus;
    deliveryDate: string;
    memo: string;
  };
}

interface AiCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToQuote: (state: ProposalState, targetStep: 'input' | 'proposal') => void;
  onCustomerSaved: (customer: CustomerItem, state: ProposalState) => void;
}

const QUICK_EXAMPLES = [
  {
    id: 'ex-general',
    badge: '① 일반견적 + 하이프리드 계산',
    label: 'TV 380만 냉장고 320만 세탁기 250만 롯데제휴카드 즉시할인 45만 엘포인트 15만 하이프리드 300 1개',
    command:
      'TV 380만 냉장고 320만원 세탁건조기 250만 롯데제휴카드 즉시할인 45만 엘포인트 15만 추가캐시백 10만 하이프리드 300 1개',
  },
  {
    id: 'ex-sub',
    badge: '② 구독견적 + 구독플러스 계산',
    label: '구독 냉장고 월 4.69만 정수기 월 32,900원 60개월 롯데카드 플러스 108 1구좌',
    command:
      '구독 냉장고 월 4.69만 정수기 월 32900원 식기세척기 월 2.49만 60개월 롯데제휴카드 플러스 108 1개',
  },
  {
    id: 'ex-crm',
    badge: '③ 견적 계산 + 고객관리 즉시 저장',
    label: '홍길동 010-1234-5678 TV 420만 에어컨 280만 삼성카드 프리드 150 1구좌 금요일 배송 결제완료 고객저장해줘',
    command:
      '홍길동 010-1234-5678 TV 420만 에어컨 280만 즉시할인 30만 삼성제휴카드 하이프리드 150 1구좌 금요일 배송 결제완료 사은품 냄비세트 약속 고객저장해줘',
  },
] as const;

function parseKoreanAmount(numStr: string, unitStr?: string): number {
  const cleaned = String(numStr || '').replace(/,/g, '').trim();
  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) return 0;

  const unit = (unitStr || '').trim();
  if (unit.includes('천만')) return Math.round(val * 10000000);
  if (unit.includes('백만')) return Math.round(val * 1000000);
  if (unit.includes('십만')) return Math.round(val * 100000);
  if (unit.includes('만')) return Math.round(val * 10000);
  if (unit.includes('천')) return Math.round(val * 1000);
  return Math.round(val);
}

const APPLIANCE_KEYWORDS: { pattern: RegExp; category: string }[] = [
  { pattern: /(?:김치\s*냉장고|김냉)/i, category: '김치냉장고' },
  { pattern: /(?:시스템\s*에어컨|시스카)/i, category: '시스템에어컨' },
  { pattern: /(?:세탁\s*건조기|워시\s*타워|워시\s*콤보|원바디)/i, category: '세탁건조기' },
  { pattern: /(?:로봇\s*청소기|로청)/i, category: '로봇청소기' },
  { pattern: /(?:식기\s*세척기|식세기)/i, category: '식기세척기' },
  { pattern: /(?:공기\s*청정기|공청기)/i, category: '공기청정기' },
  { pattern: /(?:의류\s*관리기|스타일러|에어드레서)/i, category: '의류관리기' },
  { pattern: /(?:얼음\s*정수기|정수기)/i, category: '정수기' },
  { pattern: /(?:안마\s*의자)/i, category: '안마의자' },
  { pattern: /(?:냉장고|양문형|오브제\s*냉장고|비스포크\s*냉장고)/i, category: '냉장고' },
  { pattern: /(?:세탁기|드럼\s*세탁기|통돌이)/i, category: '세탁기' },
  { pattern: /(?:건조기)/i, category: '건조기' },
  { pattern: /(?:TV|티비|올레드|OLED|QLED)/i, category: 'TV' },
  { pattern: /(?:에어컨|투인원|2in1|벽걸이\s*에어컨|스탠드\s*에어컨)/i, category: '에어컨' },
  { pattern: /(?:청소기|코드제로|비스포크\s*제트)/i, category: '청소기' },
  { pattern: /(?:인덕션|전기\s*레인지)/i, category: '전기레인지' },
  { pattern: /(?:전자\s*레인지|광파\s*오븐|오븐|큐커)/i, category: '주방가전' },
  { pattern: /(?:비데)/i, category: '비데' },
  { pattern: /(?:매트리스|침대)/i, category: '매트리스' },
  { pattern: /(?:와인\s*셀러)/i, category: '와인셀러' },
  { pattern: /(?:노트북|갤럭시\s*북|그램|맥북|데스크탑|컴퓨터|PC)/i, category: 'IT/노트북' },
  { pattern: /(?:휴대폰|스마트폰|아이폰|갤럭시\s*S\d+|폴드|플립)/i, category: '모바일' },
];

const RESERVED_NON_NAME_WORDS = new Set([
  '일반견적',
  '구독견적',
  '혼합견적',
  '즉시할인',
  '추가할인',
  '기본할인',
  '엘포인트',
  '적립포인트',
  '포인트사용',
  '추가캐시백',
  '캐시백',
  '하이프리드',
  '프리드',
  '구독프리드',
  '구독플러스',
  '하이플러스',
  '플러스',
  '롯데카드',
  '삼성카드',
  '신한카드',
  '우리카드',
  '일반카드',
  '제휴카드',
  '고객저장',
  '고객등록',
  '고객관리',
  '결제완료',
  '계약완료',
  '배송대기',
  '상담진행중',
  '상담종료',
  '오늘배송',
  '내일배송',
  '모레배송',
  '금요일',
  '방문케어',
  '셀프케어',
  '냉장고',
  '김치냉장고',
  '세탁기',
  '건조기',
  '세탁건조기',
  '워시타워',
  '에어컨',
  '시스템에어컨',
  '식기세척기',
  '정수기',
  '청소기',
  '로봇청소기',
  '공기청정기',
  '안마의자',
  '스타일러',
  '인덕션',
  '노트북',
  '사은품',
  '냄비세트',
]);

/**
 * 1차 초고속 한국어 규칙 파서 (API 키 없이도 100% 즉시 작동)
 */
export function parseKoreanCommandLocal(rawText: string): ParsedAiCommand {
  const text = (rawText || '').trim();
  let workingText = text;

  // 1) 하이프리드 (일반구매용: 75 / 150 / 225 / 300) 추출
  const generalHiPreedCounts: GeneralHiPreedCounts = {
    hf75: 0,
    hf150: 0,
    hf225: 0,
    hf300: 0,
  };
  const hiPreedRegex =
    /(?:하이\s*프리드|프리드(?:\s*라이프)?|상조)\s*(75|150|225|300)(?:\s*만?\s*원?)?(?:\s*[x×*]?\s*(\d+)\s*(?:개|구좌|건)?)?/gi;
  let hpMatch: RegExpExecArray | null;
  while ((hpMatch = hiPreedRegex.exec(workingText)) !== null) {
    const code = hpMatch[1];
    const count = Math.min(6, Math.max(1, parseInt(hpMatch[2] || '1', 10)));
    if (code === '75') generalHiPreedCounts.hf75 = count;
    if (code === '150') generalHiPreedCounts.hf150 = count;
    if (code === '225') generalHiPreedCounts.hf225 = count;
    if (code === '300') generalHiPreedCounts.hf300 = count;
  }
  workingText = workingText.replace(hiPreedRegex, ' ');

  // 2) 구독 플러스 (구독구매용: 72 / 90 / 108) 추출
  const hiPlusCounts: HiPlusCounts = {
    hi72: 0,
    hi90: 0,
    hi108: 0,
  };
  const hiPlusRegex =
    /(?:구독\s*플러스|하이\s*구독\s*플러스|구독\s*프리드|하이\s*플러스|프리드|플러스)\s*(72|90|108)(?:\s*만?\s*원?)?(?:\s*[x×*]?\s*(\d+)\s*(?:개|구좌|건)?)?/gi;
  let plusMatch: RegExpExecArray | null;
  while ((plusMatch = hiPlusRegex.exec(workingText)) !== null) {
    const code = plusMatch[1];
    const count = Math.min(8, Math.max(1, parseInt(plusMatch[2] || '1', 10)));
    if (code === '72') hiPlusCounts.hi72 = count;
    if (code === '90') hiPlusCounts.hi90 = count;
    if (code === '108') hiPlusCounts.hi108 = count;
  }
  workingText = workingText.replace(hiPlusRegex, ' ');

  // 3) 할인 / 포인트 / 추가캐시백 추출
  let instantDiscount = 0;
  const instantRegex =
    /(?:즉시\s*할인|즉할|기본\s*할인|특별\s*할인|할인)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?/i;
  const instMatch = workingText.match(instantRegex);
  if (instMatch) {
    const rawVal = parseKoreanAmount(instMatch[1], instMatch[2] || (parseFloat(instMatch[1]) < 1000 ? '만' : ''));
    instantDiscount = rawVal;
    workingText = workingText.replace(instMatch[0], ' ');
  }

  let pointUsed = 0;
  const pointUsedRegex =
    /(?:포인트\s*사용|포인트\s*차감|사용\s*포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const puMatch = workingText.match(pointUsedRegex);
  if (puMatch) {
    pointUsed = parseKoreanAmount(puMatch[1], puMatch[2] || (parseFloat(puMatch[1]) < 1000 ? '만' : ''));
    workingText = workingText.replace(puMatch[0], ' ');
  }

  let earnedPoints = 0;
  const earnedRegex =
    /(?:적립\s*포인트|엘\s*포인트|L\.?\s*POINT|포인트\s*적립|포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const epMatch = workingText.match(earnedRegex);
  if (epMatch) {
    earnedPoints = parseKoreanAmount(epMatch[1], epMatch[2] || (parseFloat(epMatch[1]) < 1000 ? '만' : ''));
    workingText = workingText.replace(epMatch[0], ' ');
  }

  let extraCashback = 0;
  const extraCbRegex =
    /(?:추가\s*캐시백|익월\s*캐시백|배송\s*익월\s*캐시백|특별\s*캐시백)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?/i;
  const ecbMatch = workingText.match(extraCbRegex);
  if (ecbMatch) {
    extraCashback = parseKoreanAmount(ecbMatch[1], ecbMatch[2] || (parseFloat(ecbMatch[1]) < 1000 ? '만' : ''));
    workingText = workingText.replace(ecbMatch[0], ' ');
  }

  // 4) 구독 개월수 감지 (기본 60개월, 36개월/3년 언급 시 36)
  const subscriptionPeriod: 36 | 60 = /(?:36\s*개월|36\s*M|3\s*년\s*구독)/i.test(text)
    ? 36
    : 60;
  workingText = workingText.replace(/(?:36|60)\s*(?:개월|M)/gi, ' ');

  // 5) 카드사 및 실적 구간 감지
  let generalCardType: ParsedAiCommand['generalCardType'] = '롯데 제휴카드';
  let selectedCardId: AffiliateCardId = 'lotte';
  let selectedCardTierId = 'lotte-30';

  if (/(?:카드\s*미정|카드\s*없음|현금)/.test(text)) {
    generalCardType = '미정';
    selectedCardId = 'none';
    selectedCardTierId = '';
  } else if (/일반\s*카드|타사\s*카드/.test(text)) {
    generalCardType = '일반 카드';
    selectedCardId = 'none';
    selectedCardTierId = '';
  } else if (/삼성\s*(?:제휴\s*)?카드|삼성\s*제휴/.test(text)) {
    generalCardType = '삼성 제휴카드';
    selectedCardId = 'samsung';
    selectedCardTierId = /150\s*만\s*실적/.test(text)
      ? 'samsung-150'
      : /70\s*만\s*실적/.test(text)
      ? 'samsung-70'
      : 'samsung-30';
  } else if (/신한\s*(?:제휴\s*)?카드|신한\s*제휴/.test(text)) {
    generalCardType = '신한 제휴카드';
    selectedCardId = 'shinhan';
    selectedCardTierId = /200\s*만\s*실적/.test(text)
      ? 'shinhan-200'
      : /100\s*만\s*실적/.test(text)
      ? 'shinhan-100'
      : 'shinhan-50';
  } else if (/우리\s*(?:제휴\s*)?카드|우리\s*제휴/.test(text)) {
    generalCardType = '우리 제휴카드';
    selectedCardId = 'woori';
    selectedCardTierId = /120\s*만\s*실적/.test(text)
      ? 'woori-120'
      : /70\s*만\s*실적/.test(text)
      ? 'woori-70'
      : 'woori-30';
  } else if (/롯데\s*(?:제휴\s*)?카드|롯데\s*제휴|제휴\s*카드|롯데/.test(text)) {
    generalCardType = '롯데 제휴카드';
    selectedCardId = 'lotte';
    selectedCardTierId = /150\s*만\s*실적/.test(text)
      ? 'lotte-150'
      : /70\s*만\s*실적/.test(text)
      ? 'lotte-70'
      : 'lotte-30';
  }

  // 6) 고객 정보 (연락처, 배송일, 상태, 고객명, 메모) 추출
  let phone = '';
  const phoneMatch = workingText.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/);
  if (phoneMatch) {
    phone = formatPhoneNumber(phoneMatch[0]);
    workingText = workingText.replace(phoneMatch[0], ' ');
  }

  let deliveryDate = '';
  if (/(?:오늘\s*배송|당일\s*배송)/.test(text)) {
    deliveryDate = getOffsetDateStr(0);
  } else if (/내일\s*배송/.test(text)) {
    deliveryDate = getOffsetDateStr(1);
  } else if (/모레\s*배송/.test(text)) {
    deliveryDate = getOffsetDateStr(2);
  } else if (/(?:다음\s*주|차주)\s*금요일/.test(text)) {
    deliveryDate = getFridayDateStr(true);
  } else if (/금요일\s*배송|이번\s*주\s*금요일/.test(text)) {
    deliveryDate = getFridayDateStr(false);
  } else {
    const isoDateMatch = text.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
    const mdDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*배송)?/);
    if (isoDateMatch) {
      deliveryDate = `${isoDateMatch[1]}-${String(isoDateMatch[2]).padStart(2, '0')}-${String(
        isoDateMatch[3]
      ).padStart(2, '0')}`;
    } else if (mdDateMatch) {
      const m = parseInt(mdDateMatch[1], 10);
      const d = parseInt(mdDateMatch[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const y = new Date().getFullYear();
        deliveryDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  let status: AiCustomerStatus = '상담진행중';
  if (/(?:결제\s*완료|계약\s*완료|완납)/.test(text)) {
    status = '결제완료';
  } else if (/(?:배송\s*대기|출고\s*대기)/.test(text)) {
    status = '배송대기';
  } else if (/(?:상담\s*종료|보류|취소)/.test(text)) {
    status = '상담종료';
  }

  // 고객명 추출
  let customerName = '';
  const explicitCustomerMatch =
    text.match(/(?:고객명|이름)\s*[:：]?\s*([가-힣]{2,4})/) ||
    text.match(/([가-힣]{2,4})\s*고객(?:님)?/);
  if (explicitCustomerMatch && !RESERVED_NON_NAME_WORDS.has(explicitCustomerMatch[1])) {
    customerName = explicitCustomerMatch[1];
  } else if (phoneMatch) {
    // 전화번호 바로 앞의 한글 2~4글자 이름 탐색
    const beforePhone = text.slice(0, text.indexOf(phoneMatch[0])).trim();
    const nameBeforePhone = beforePhone.match(/([가-힣]{2,4})\s*$/);
    if (nameBeforePhone && !RESERVED_NON_NAME_WORDS.has(nameBeforePhone[1])) {
      customerName = nameBeforePhone[1];
    }
  }
  if (!customerName) {
    // '홍길동님' 또는 문장 맨 앞 2~3글자 이름 + 저장 키워드 조합 탐색
    const nimMatch = text.match(/([가-힣]{2,4})님/);
    if (nimMatch && !RESERVED_NON_NAME_WORDS.has(nimMatch[1])) {
      customerName = nimMatch[1];
    } else if (/(?:저장|등록|고객관리)/.test(text)) {
      const leadingHangul = text.match(/^([가-힣]{2,4})\s+/);
      if (leadingHangul && !RESERVED_NON_NAME_WORDS.has(leadingHangul[1])) {
        customerName = leadingHangul[1];
      }
    }
  }

  const hasSaveKeyword = /(?:저장|등록|고객\s*관리|CRM)/i.test(text);
  const shouldSaveCrm = hasSaveKeyword || Boolean(customerName && phone);

  // 메모 추출 (사은품/약속/메모 관련 구문 또는 원본 명령어 요약)
  let memo = '';
  const memoMatch = text.match(/(?:메모|사은품|비고|특이사항)\s*[:：]?\s*([^\n,]+)/);
  if (memoMatch) {
    memo = memoMatch[0]
      .replace(/(?:고객\s*)?(?:저장|등록)(?:해\s*줘|해줘|하기)?/g, '')
      .trim();
  }

  // 7) 품목 및 금액 추출 (일반품목 vs 구독품목)
  const generalItems: ParsedAiCommand['generalItems'] = [];
  const subscriptionItems: ParsedAiCommand['subscriptionItems'] = [];

  const isGlobalSubOnly =
    /(?:^|\s)구독(?:\s*견적)?/.test(text) && !/일반\s*견적|혼합\s*견적/.test(text);

  // 가전 키워드 + (모델명 선택) + (월 여부) + 금액 패턴 매칭
  const itemTokenRegex =
    /(?:(구독)\s*)?(김치\s*냉장고|김냉|시스템\s*에어컨|시스카|세탁\s*건조기|워시\s*타워|워시\s*콤보|원바디|로봇\s*청소기|로청|식기\s*세척기|식세기|공기\s*청정기|공청기|의류\s*관리기|스타일러|에어드레서|얼음\s*정수기|정수기|안마\s*의자|냉장고|양문형|세탁기|드럼\s*세탁기|통돌이|건조기|TV|티비|올레드|OLED|QLED|에어컨|투인원|2in1|청소기|코드제로|인덕션|전기\s*레인지|전자\s*레인지|오븐|큐커|비데|매트리스|침대|와인\s*셀러|노트북|그램|맥북|컴퓨터|PC|아이폰|갤럭시)(?:\s+([A-Za-z0-9][A-Za-z0-9-_]{2,}))?\s*(?:(월)\s*)?([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?(?:\s*(\d+)\s*(?:개|대))?/gi;

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemTokenRegex.exec(workingText)) !== null) {
    const subPrefix = Boolean(itemMatch[1]);
    const rawCat = itemMatch[2];
    const modelCode = (itemMatch[3] || '').trim();
    const monthlyPrefix = Boolean(itemMatch[4]);
    const numStr = itemMatch[5];
    const unitStr = itemMatch[6] || '';
    const qty = Math.max(1, parseInt(itemMatch[7] || '1', 10));

    let normalizedCategory = rawCat.replace(/\s+/g, '');
    for (const kw of APPLIANCE_KEYWORDS) {
      if (kw.pattern.test(rawCat)) {
        normalizedCategory = kw.category;
        break;
      }
    }

    const numericRaw = parseFloat(numStr.replace(/,/g, ''));
    const effectiveUnit =
      unitStr ||
      (!monthlyPrefix && numericRaw > 0 && numericRaw < 1000 ? '만' : '');
    const amount = parseKoreanAmount(numStr, effectiveUnit);

    if (amount <= 0) continue;

    const isSubItem =
      monthlyPrefix ||
      subPrefix ||
      amount < 200000 ||
      (isGlobalSubOnly && amount < 300000);

    if (isSubItem) {
      subscriptionItems.push({
        category: normalizedCategory,
        modelName: modelCode,
        monthlyFee: amount,
        period: subscriptionPeriod,
      });
    } else {
      generalItems.push({
        category: normalizedCategory,
        modelName: modelCode,
        quantity: qty,
        unitPrice: amount,
      });
    }
  }

  // 만약 일반/구독 모드가 아직 결정되지 않았으면 결정
  let quoteMode: QuoteMode = 'general';
  const hasHiPlus =
    hiPlusCounts.hi72 + hiPlusCounts.hi90 + hiPlusCounts.hi108 > 0;
  if (generalItems.length > 0 && (subscriptionItems.length > 0 || hasHiPlus)) {
    quoteMode = 'hybrid';
  } else if (
    subscriptionItems.length > 0 ||
    (generalItems.length === 0 && (hasHiPlus || /구독|월\s*\d/.test(text)))
  ) {
    quoteMode = 'subscription';
  } else {
    quoteMode = 'general';
  }

  if (/혼합\s*견적/.test(text)) {
    quoteMode = 'hybrid';
  }

  return {
    quoteMode,
    generalItems,
    generalCardType,
    instantDiscount,
    earnedPoints,
    pointUsed,
    extraCashback,
    generalHiPreedCounts,
    subscriptionItems,
    subscriptionPeriod,
    selectedCardId,
    selectedCardTierId,
    hiPlusCounts,
    customer: {
      shouldSaveCrm,
      name: customerName,
      phone,
      status,
      deliveryDate,
      memo,
    },
  };
}

/**
 * 2차 Gemini AI 정밀 파서 (API 키가 있을 때 GEMINI_MODELS 순차 폴백 호출, 실패 시 1차 파서 결과로 안전 복원)
 */
export async function parseCommandWithHybridAi(
  rawText: string
): Promise<{ parsed: ParsedAiCommand; engineLabel: string }> {
  const localResult = parseKoreanCommandLocal(rawText);
  const apiKey = getEffectiveGeminiApiKey();

  if (!apiKey) {
    return {
      parsed: localResult,
      engineLabel: '⚡ 초고속 한국어 규칙 엔진 (즉시 분석 완료)',
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const todayStr = getOffsetDateStr(0);
  const tomorrowStr = getOffsetDateStr(1);
  const fridayStr = getFridayDateStr(false);

  const systemPrompt = `당신은 롯데하이마트 경기광주점 가전 견적 및 고객관리(CRM) AI 비서입니다.
사용자의 한 줄 자연어 명령을 분석하여 아래 JSON 구조로만 정확히 응답하세요.
오늘 날짜: ${todayStr}, 내일 날짜: ${tomorrowStr}, 이번주 금요일: ${fridayStr}

[추출 규칙]
1. quoteMode: 'general' | 'subscription' | 'hybrid'
   - 일반 일시불 품목만 있으면 'general'
   - 월 구독료('월 32900원', '월 4.69만' 등) 품목만 있으면 'subscription'
   - 일반 품목과 구독 품목이 함께 있으면 'hybrid'
2. generalItems: [{ category, modelName, quantity, unitPrice }]
   - "TV 380만" -> unitPrice: 3800000, quantity: 1
   - 만원 단위는 반드시 * 10000 원 단위로 변환
3. generalCardType: '롯데 제휴카드' | '삼성 제휴카드' | '신한 제휴카드' | '우리 제휴카드' | '일반 카드' | '미정'
   - 카드 언급이 없으면 기본 '롯데 제휴카드'
4. instantDiscount(즉시할인), earnedPoints(적립포인트/엘포인트), pointUsed(포인트사용), extraCashback(추가캐시백): 원 단위 숫자
5. generalHiPreedCounts: { hf75, hf150, hf225, hf300 } (예: "하이프리드 300 1개" -> hf300: 1)
6. subscriptionItems: [{ category, modelName, monthlyFee, period }] (예: "정수기 월 32900원" -> monthlyFee: 32900, "구독 냉장고 월 4.69만" -> monthlyFee: 46900)
7. subscriptionPeriod: 36 | 60 (기본 60, 36개월 언급 시 36)
8. selectedCardId: 'lotte' | 'samsung' | 'shinhan' | 'woori' | 'none'
9. selectedCardTierId: 롯데 기본 'lotte-30', 삼성 'samsung-30', 신한 'shinhan-50', 우리 'woori-30'
10. hiPlusCounts: { hi72, hi90, hi108 } (예: "플러스 108 1개" -> hi108: 1)
11. customer: { shouldSaveCrm: boolean, name: string, phone: string, status: '상담진행중' | '결제완료' | '배송대기' | '상담종료', deliveryDate: string (YYYY-MM-DD), memo: string }
    - '저장', '등록' 키워드가 있거나 고객명+연락처가 함께 있으면 shouldSaveCrm = true`;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n[사용자 명령어]\n${rawText}` }],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const rawJson = (response.text || '').trim();
      if (!rawJson) continue;

      const parsedJson = JSON.parse(rawJson);

      const mergedGeneralItems =
        Array.isArray(parsedJson.generalItems) && parsedJson.generalItems.length > 0
          ? parsedJson.generalItems.map((it: any) => ({
              category: String(it.category || '가전'),
              modelName: String(it.modelName || ''),
              quantity: Math.max(1, Number(it.quantity) || 1),
              unitPrice: Math.max(0, Number(it.unitPrice) || 0),
            }))
          : localResult.generalItems;

      const mergedSubItems =
        Array.isArray(parsedJson.subscriptionItems) &&
        parsedJson.subscriptionItems.length > 0
          ? parsedJson.subscriptionItems.map((it: any) => ({
              category: String(it.category || '구독가전'),
              modelName: String(it.modelName || ''),
              monthlyFee: Math.max(0, Number(it.monthlyFee) || 0),
              period: (Number(it.period) === 36 ? 36 : 60) as 36 | 60,
            }))
          : localResult.subscriptionItems;

      const mergedResult: ParsedAiCommand = {
        quoteMode:
          parsedJson.quoteMode === 'general' ||
          parsedJson.quoteMode === 'subscription' ||
          parsedJson.quoteMode === 'hybrid'
            ? parsedJson.quoteMode
            : localResult.quoteMode,
        generalItems: mergedGeneralItems,
        generalCardType: parsedJson.generalCardType || localResult.generalCardType,
        instantDiscount:
          Number(parsedJson.instantDiscount) > 0
            ? Number(parsedJson.instantDiscount)
            : localResult.instantDiscount,
        earnedPoints:
          Number(parsedJson.earnedPoints) > 0
            ? Number(parsedJson.earnedPoints)
            : localResult.earnedPoints,
        pointUsed:
          Number(parsedJson.pointUsed) > 0
            ? Number(parsedJson.pointUsed)
            : localResult.pointUsed,
        extraCashback:
          Number(parsedJson.extraCashback) > 0
            ? Number(parsedJson.extraCashback)
            : localResult.extraCashback,
        generalHiPreedCounts: {
          hf75:
            Number(parsedJson.generalHiPreedCounts?.hf75) ||
            localResult.generalHiPreedCounts.hf75,
          hf150:
            Number(parsedJson.generalHiPreedCounts?.hf150) ||
            localResult.generalHiPreedCounts.hf150,
          hf225:
            Number(parsedJson.generalHiPreedCounts?.hf225) ||
            localResult.generalHiPreedCounts.hf225,
          hf300:
            Number(parsedJson.generalHiPreedCounts?.hf300) ||
            localResult.generalHiPreedCounts.hf300,
        },
        subscriptionItems: mergedSubItems,
        subscriptionPeriod:
          Number(parsedJson.subscriptionPeriod) === 36
            ? 36
            : localResult.subscriptionPeriod,
        selectedCardId: parsedJson.selectedCardId || localResult.selectedCardId,
        selectedCardTierId:
          parsedJson.selectedCardTierId || localResult.selectedCardTierId,
        hiPlusCounts: {
          hi72:
            Number(parsedJson.hiPlusCounts?.hi72) || localResult.hiPlusCounts.hi72,
          hi90:
            Number(parsedJson.hiPlusCounts?.hi90) || localResult.hiPlusCounts.hi90,
          hi108:
            Number(parsedJson.hiPlusCounts?.hi108) || localResult.hiPlusCounts.hi108,
        },
        customer: {
          shouldSaveCrm: Boolean(
            parsedJson.customer?.shouldSaveCrm ?? localResult.customer.shouldSaveCrm
          ),
          name: String(
            parsedJson.customer?.name || localResult.customer.name || ''
          ).trim(),
          phone: formatPhoneNumber(
            String(parsedJson.customer?.phone || localResult.customer.phone || '')
          ),
          status:
            parsedJson.customer?.status === '결제완료' ||
            parsedJson.customer?.status === '배송대기' ||
            parsedJson.customer?.status === '상담종료' ||
            parsedJson.customer?.status === '상담진행중'
              ? parsedJson.customer.status
              : localResult.customer.status,
          deliveryDate:
            String(
              parsedJson.customer?.deliveryDate ||
                localResult.customer.deliveryDate ||
                ''
            ).trim(),
          memo: String(
            parsedJson.customer?.memo || localResult.customer.memo || ''
          ).trim(),
        },
      };

      return {
        parsed: mergedResult,
        engineLabel: `✨ Gemini AI 정밀 분석 완료 (${modelName})`,
      };
    } catch {
      // 다음 폴백 모델로 재시도
    }
  }

  return {
    parsed: localResult,
    engineLabel: '⚡ 초고속 한국어 규칙 엔진 (AI 폴백 완료)',
  };
}

/**
 * ParsedAiCommand -> ProposalState 변환
 */
export function buildProposalStateFromAiCommand(cmd: ParsedAiCommand): ProposalState {
  const normalizedCardType: GeneralCardType =
    cmd.generalCardType === '일반 카드'
      ? '일반카드'
      : cmd.generalCardType === '롯데 제휴카드' ||
        cmd.generalCardType === '삼성 제휴카드' ||
        cmd.generalCardType === '신한 제휴카드' ||
        cmd.generalCardType === '우리 제휴카드' ||
        cmd.generalCardType === '미정'
      ? cmd.generalCardType
      : '롯데 제휴카드';

  const mappedGeneralItems =
    cmd.generalItems.length > 0
      ? cmd.generalItems.map((it, idx) => ({
          id: `ai-gen-${Date.now()}-${idx}`,
          category: it.category || `가전 ${idx + 1}`,
          name: it.category || `가전 ${idx + 1}`,
          modelName: it.modelName || '',
          code: it.modelName || '',
          quantity: Math.max(1, Number(it.quantity) || 1),
          qty: Math.max(1, Number(it.quantity) || 1),
          unitPrice: Math.max(0, Number(it.unitPrice) || 0),
          price:
            Math.max(0, Number(it.unitPrice) || 0) *
            Math.max(1, Number(it.quantity) || 1),
        }))
      : [
          {
            id: `ai-gen-empty-${Date.now()}`,
            category: '',
            modelName: '',
            quantity: 1,
            unitPrice: 0,
          },
        ];

  const mappedSubItems =
    cmd.subscriptionItems.length > 0
      ? cmd.subscriptionItems.map((it, idx) => ({
          id: `ai-sub-${Date.now()}-${idx}`,
          category: it.category || `구독가전 ${idx + 1}`,
          modelName: it.modelName || '',
          modelCode: it.modelName || '',
          monthlyFee: Math.max(0, Number(it.monthlyFee) || 0),
          period: (it.period === 36 ? 36 : 60) as SubscriptionPeriod,
          careService: SUB_CARE_OPTIONS[0],
          warrantyType: 'AS연장보험 + 가전수리올케어',
        }))
      : [
          {
            id: `ai-sub-empty-${Date.now()}`,
            category: '',
            modelName: '',
            monthlyFee: 0,
            period: cmd.subscriptionPeriod,
            careService: SUB_CARE_OPTIONS[0],
          },
        ];

  const plan1: GeneralPlanData = {
    generalItems: mappedGeneralItems,
    generalCardType: normalizedCardType,
    instantDiscount: Math.max(0, Number(cmd.instantDiscount) || 0),
    earnedPoints: Math.max(0, Number(cmd.earnedPoints) || 0),
    pointUsed: Math.max(0, Number(cmd.pointUsed) || 0),
    autoTierCashback: true,
    manualTierCashback: 0,
    extraCashback: Math.max(0, Number(cmd.extraCashback) || 0),
    extraBenefits: [],
    generalHiPreedCounts: {
      hf75: cmd.generalHiPreedCounts.hf75 || 0,
      hf150: cmd.generalHiPreedCounts.hf150 || 0,
      hf225: cmd.generalHiPreedCounts.hf225 || 0,
      hf300: cmd.generalHiPreedCounts.hf300 || 0,
    },
    items: mappedSubItems,
    subscriptionPeriod: cmd.subscriptionPeriod,
    careService: SUB_CARE_OPTIONS[0],
    warrantyType: 'AS연장보험 + 가전수리올케어',
    warrantyYears: 5,
    allCare: true,
    selectedCardId: cmd.selectedCardId || 'none',
    selectedCardTierId: cmd.selectedCardTierId || '',
    hiPlusCounts: {
      hi72: cmd.hiPlusCounts.hi72 || 0,
      hi90: cmd.hiPlusCounts.hi90 || 0,
      hi108: cmd.hiPlusCounts.hi108 || 0,
    },
  };

  const emptyPlan2: GeneralPlanData = {
    generalItems: [
      {
        id: `ai-gen-p2-${Date.now()}`,
        category: '',
        modelName: '',
        quantity: 1,
        unitPrice: 0,
      },
    ],
    generalCardType: '미정',
    instantDiscount: 0,
    earnedPoints: 0,
    pointUsed: 0,
    autoTierCashback: true,
    manualTierCashback: 0,
    extraCashback: 0,
    extraBenefits: [],
    generalHiPreedCounts: { hf75: 0, hf150: 0, hf225: 0, hf300: 0 },
    items: [
      {
        id: `ai-sub-p2-${Date.now()}`,
        category: '',
        modelName: '',
        monthlyFee: 0,
        period: 60,
        careService: SUB_CARE_OPTIONS[0],
      },
    ],
    subscriptionPeriod: 60,
    careService: SUB_CARE_OPTIONS[0],
    warrantyType: 'AS연장보험 + 가전수리올케어',
    warrantyYears: 5,
    allCare: true,
    selectedCardId: 'none',
    selectedCardTierId: '',
    hiPlusCounts: { hi72: 0, hi90: 0, hi108: 0 },
  };

  return {
    quoteMode: cmd.quoteMode,
    activeGeneralPlan: 1,
    generalPlan1: extractGeneralPlanData(plan1),
    generalPlan2: extractGeneralPlanData(emptyPlan2),
    ...plan1,
  };
}

function mapAiStatusToCrmStatus(status: AiCustomerStatus): CustomerStatus {
  if (status === '결제완료' || status === '배송대기') return '계약완료';
  if (status === '상담종료') return '미구매/고민중';
  return '상담진행중';
}

export const AiCommandModal: React.FC<AiCommandModalProps> = ({
  isOpen,
  onClose,
  onApplyToQuote,
  onCustomerSaved,
}) => {
  const [commandText, setCommandText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [engineBadge, setEngineBadge] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedAiCommand | null>(null);

  // 모달 내 고객 정보 수정용 상태
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerDeliveryDate, setCustomerDeliveryDate] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<AiCustomerStatus>('상담진행중');
  const [customerMemo, setCustomerMemo] = useState<string>('');

  const [autoSavedBanner, setAutoSavedBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // 실시간 미리보기용 파생 명령 (분석 전이라도 입력창 텍스트로 즉시 프리뷰 계산)
  const effectiveParsedCommand = useMemo<ParsedAiCommand | null>(() => {
    if (parsedResult) {
      return {
        ...parsedResult,
        customer: {
          ...parsedResult.customer,
          name: customerName,
          phone: customerPhone,
          deliveryDate: customerDeliveryDate,
          status: customerStatus,
          memo: customerMemo,
        },
      };
    }
    if (!commandText.trim()) return null;
    return parseKoreanCommandLocal(commandText);
  }, [
    parsedResult,
    commandText,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
  ]);

  const generatedState = useMemo<ProposalState | null>(() => {
    if (!effectiveParsedCommand) return null;
    return buildProposalStateFromAiCommand(effectiveParsedCommand);
  }, [effectiveParsedCommand]);

  const quotePayload = useMemo(() => {
    if (!generatedState) return null;
    return extractQuotePayloadFromProposalState(generatedState);
  }, [generatedState]);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
    }
  }, [isOpen]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // 음성 인식 토글 (Web Speech API)
  const handleToggleSpeech = useCallback(() => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechNotice(
        '현재 브라우저는 음성 인식을 지원하지 않습니다. 크롬/엣지/사파리에서 이용해 주세요.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.continuous = false;

      const baseText = commandText.trim();

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice('🎙️ 말씀을 듣고 있습니다... 편하게 말씀해 주세요.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const combined = baseText ? `${baseText} ${transcript}` : transcript;
        setCommandText(combined);
        setParsedResult(null);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechNotice('음성 인식이 중단되었습니다. 다시 시도하거나 텍스트로 입력해 주세요.');
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechNotice(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechNotice('마이크 권한을 확인해 주세요.');
    }
  }, [isListening, commandText]);

  // AI 분석 및 자동 CRM 저장 처리
  const handleRunAiCommand = useCallback(
    async (overrideText?: string) => {
      const targetText = (overrideText ?? commandText).trim();
      if (!targetText) {
        showToast('명령어를 입력하거나 예시 칩을 선택해 주세요!');
        return;
      }

      setIsAnalyzing(true);
      setAutoSavedBanner(null);

      try {
        // 1단계: 즉시 로컬 규칙 파서 반영
        const localParsed = parseKoreanCommandLocal(targetText);
        setParsedResult(localParsed);
        setCustomerName(localParsed.customer.name);
        setCustomerPhone(localParsed.customer.phone);
        setCustomerDeliveryDate(localParsed.customer.deliveryDate);
        setCustomerStatus(localParsed.customer.status);
        setCustomerMemo(localParsed.customer.memo);
        setEngineBadge('⚡ 1차 한국어 규칙 파서 즉시 계산 완료');

        // 2단계: 하이브리드 AI 정밀 파서 호출
        const { parsed: finalParsed, engineLabel } =
          await parseCommandWithHybridAi(targetText);
        setParsedResult(finalParsed);
        setCustomerName(finalParsed.customer.name);
        setCustomerPhone(finalParsed.customer.phone);
        setCustomerDeliveryDate(finalParsed.customer.deliveryDate);
        setCustomerStatus(finalParsed.customer.status);
        setCustomerMemo(finalParsed.customer.memo);
        setEngineBadge(engineLabel);

        // 만약 사용자가 명령어에 "저장해줘" 등을 포함했고 고객명이 추출되었다면 즉시 CRM 자동 저장 실행
        if (
          finalParsed.customer.shouldSaveCrm &&
          finalParsed.customer.name.trim().length > 0
        ) {
          const nextState = buildProposalStateFromAiCommand(finalParsed);
          const payload = extractQuotePayloadFromProposalState(nextState);
          const statusNote =
            finalParsed.customer.status === '결제완료' ||
            finalParsed.customer.status === '배송대기'
              ? `[${finalParsed.customer.status}] `
              : '';
          const mergedMemo =
            `${statusNote}${finalParsed.customer.memo || ''}`.trim() ||
            `[AI 비서 자동등록] ${targetText}`;

          const savedRes = await saveCustomerQuote({
            name: finalParsed.customer.name.trim(),
            phone: finalParsed.customer.phone.trim(),
            items: payload.itemsSummary,
            paidAmount: payload.paidAmount,
            netAmount: payload.netAmount,
            expectedBenefit: payload.expectedBenefit,
            deliveryDate: finalParsed.customer.deliveryDate,
            status: mapAiStatusToCrmStatus(finalParsed.customer.status),
            memo: mergedMemo,
            quoteTitle: payload.defaultQuoteTitle,
            proposalState: nextState,
            quoteMode: nextState.quoteMode,
            plan2Summary: payload.plan2Summary,
          });

          onCustomerSaved(savedRes.savedCustomer, nextState);
          setAutoSavedBanner(
            `✅ 명령어 인식과 동시에 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님이 자동 저장되었습니다!`
          );
          showToast(
            `👑 [${savedRes.savedCustomer.name}] 고객님이 CRM에 자동 저장되었습니다!`
          );
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [commandText, onCustomerSaved, showToast]
  );

  // 하단 버튼 3: 수동/즉시 CRM 저장 + 견적 반영
  const handleManualSaveToCrm = useCallback(async () => {
    if (!generatedState || !quotePayload) {
      showToast('먼저 견적 명령어를 입력해 주세요!');
      return;
    }

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showToast('⚠️ 저장할 고객명을 입력해 주세요!');
      customerNameInputRef.current?.focus();
      return;
    }

    const statusPrefix =
      customerStatus === '결제완료' || customerStatus === '배송대기'
        ? `[${customerStatus}] `
        : '';
    const finalMemo =
      `${statusPrefix}${customerMemo}`.trim() ||
      `[AI 비서 등록] ${commandText.trim()}`;

    const savedRes = await saveCustomerQuote({
      name: trimmedName,
      phone: formatPhoneNumber(customerPhone),
      items: quotePayload.itemsSummary,
      paidAmount: quotePayload.paidAmount,
      netAmount: quotePayload.netAmount,
      expectedBenefit: quotePayload.expectedBenefit,
      deliveryDate: customerDeliveryDate,
      status: mapAiStatusToCrmStatus(customerStatus),
      memo: finalMemo,
      quoteTitle: quotePayload.defaultQuoteTitle,
      proposalState: generatedState,
      quoteMode: generatedState.quoteMode,
      plan2Summary: quotePayload.plan2Summary,
    });

    onCustomerSaved(savedRes.savedCustomer, generatedState);
    setAutoSavedBanner(
      `✅ 통합 고객관리(CRM)에 [${savedRes.savedCustomer.name}] 고객님의 견적이 저장 및 반영되었습니다!`
    );
    showToast(
      `👑 [${savedRes.savedCustomer.name}] 고객관리(CRM) 저장 및 견적 반영 완료!`
    );
  }, [
    generatedState,
    quotePayload,
    customerName,
    customerPhone,
    customerDeliveryDate,
    customerStatus,
    customerMemo,
    commandText,
    onCustomerSaved,
    showToast,
  ]);

  if (!isOpen) return null;

  const modeBadgeInfo =
    effectiveParsedCommand?.quoteMode === 'subscription'
      ? {
          label: '2. 구독 견적 모드',
          cls: 'bg-rose-600 text-white border-rose-500',
        }
      : effectiveParsedCommand?.quoteMode === 'hybrid'
      ? {
          label: '3. 혼합 견적 (일반+구독)',
          cls: 'bg-indigo-600 text-white border-indigo-500',
        }
      : {
          label: '1. 일반 견적 모드',
          cls: 'bg-blue-600 text-white border-blue-500',
        };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[94dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shrink-0 border border-white/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  🤖 AI 비서 (한 줄 견적 계산 · 고객관리 자동 등록)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  음성 · 자연어 지원
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium truncate">
                품목·금액·할인·프리드·고객명을 말하거나 적으면 매장 공식 수식으로 자동 계산합니다
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 토스트 알림 */}
          {toastMessage && (
            <div className="p-3 rounded-2xl bg-slate-900 text-amber-300 text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-md animate-fade-in">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {/* 자동 CRM 저장 완료 배지 */}
          {autoSavedBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{autoSavedBanner}</span>
            </div>
          )}

          {/* 빠른 예시 칩 3개 */}
          <div className="space-y-1.5">
            <div className="text-xs font-black text-slate-700 flex items-center justify-between">
              <span>💡 빠른 예시 칩 (터치하면 즉시 입력 및 자동 계산됩니다)</span>
              {engineBadge && (
                <span className="text-[11px] font-extrabold text-indigo-600">
                  {engineBadge}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setCommandText(ex.command);
                    handleRunAiCommand(ex.command);
                  }}
                  className="p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 text-left transition group cursor-pointer flex flex-col justify-between gap-1"
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 group-hover:text-indigo-900">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {ex.badge}
                  </span>
                  <span className="text-[11px] text-slate-600 font-bold line-clamp-2 leading-snug">
                    "{ex.label}"
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 자연어 입력창 + 음성 인식 + 실행 버튼 */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={commandText}
                onChange={(e) => {
                  setCommandText(e.target.value);
                  setParsedResult(null);
                  setAutoSavedBanner(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleRunAiCommand();
                  }
                }}
                rows={3}
                placeholder="예: 홍길동 010-1234-5678 TV 380만 냉장고 320만 롯데카드 즉시할인 40만 하이프리드 300 1개 금요일 배송 결제완료 저장해줘"
                className="w-full rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-hidden p-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 bg-white resize-none shadow-2xs"
              />
            </div>

            {speechNotice && (
              <div className="text-xs font-extrabold text-rose-600 px-1">
                {speechNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>🛑 음성 인식 중지</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-rose-600" />
                    <span>🎤 음성으로 말하기</span>
                  </>
                )}
              </button>

              {commandText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setCommandText('');
                    setParsedResult(null);
                    setAutoSavedBanner(null);
                    setEngineBadge('');
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  초기화
                </button>
              )}

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleRunAiCommand()}
                className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 정밀 계산중...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>⚡ AI 자동 계산 및 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 실시간 매장 공식 수식 검증 및 미리보기 카드 */}
          {effectiveParsedCommand && quotePayload && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-slate-50/80 p-3.5 sm:p-4 space-y-3.5">
              {/* 상단: 감지된 견적 모드 및 요약 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border ${modeBadgeInfo.cls}`}
                  >
                    {modeBadgeInfo.label}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    {quotePayload.itemsSummary}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-slate-500">
                  카드: {effectiveParsedCommand.generalCardType}
                </span>
              </div>

              {/* 일반구매 계산 결과 요약 (일반 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'general' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primaryGenSummary.sum > 0 && (
                  <div className="rounded-2xl bg-white border border-blue-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        일반구매 매장 공식 수식 계산 결과
                      </span>
                      {quotePayload.primaryGenSummary.tierCashback > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black">
                          금액대 자동 캐시백{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.tierCashback
                          )}
                          원 적용
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          총 행사가 합계
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          {formatCurrency(quotePayload.primaryGenSummary.sum)}원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          즉시할인 + 하이프리드
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primaryGenSummary
                              .totalStep1InstantDiscount +
                              quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="text-[11px] font-extrabold text-blue-800">
                          실결제가 (결제부담금)
                        </div>
                        <div className="text-xs sm:text-sm font-black text-blue-700">
                          {formatCurrency(
                            quotePayload.primaryGenSummary.payPrice
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          최종 체감 혜택가
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          {formatCurrency(quotePayload.primaryGenSummary.rawNet)}원
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-600 flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                      <span>
                        • 즉시할인:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.instantDiscount
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.hiFreedSupport > 0 && (
                        <span className="text-indigo-700 font-black">
                          • 하이프리드({quotePayload.primaryGenSummary.comboLabel}): -
                          {formatCurrency(
                            quotePayload.primaryGenSummary.hiFreedSupport
                          )}
                          원
                        </span>
                      )}
                      <span>
                        • 금액대 캐시백:{' '}
                        {formatCurrency(
                          quotePayload.primaryGenSummary.tierCashback
                        )}
                        원
                      </span>
                      {quotePayload.primaryGenSummary.extraCashback > 0 && (
                        <span>
                          • 추가 캐시백:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.extraCashback
                          )}
                          원
                        </span>
                      )}
                      {quotePayload.primaryGenSummary.earnedPoints > 0 && (
                        <span>
                          • L.POINT:{' '}
                          {formatCurrency(
                            quotePayload.primaryGenSummary.earnedPoints
                          )}
                          P
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* 구독구매 계산 결과 요약 (구독 또는 혼합일 때) */}
              {(effectiveParsedCommand.quoteMode === 'subscription' ||
                effectiveParsedCommand.quoteMode === 'hybrid') &&
                quotePayload.primarySubSummary.totalBaseMonthly > 0 && (
                  <div className="rounded-2xl bg-white border border-rose-200 p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-rose-600" />
                        구독구매 ({quotePayload.primarySubSummary.periodLabel}) 계산
                        결과
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black">
                        총 약정원금{' '}
                        {formatCurrency(
                          quotePayload.primarySubSummary.totalPrincipal
                        )}
                        원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          월 기본 구독료
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.totalBaseMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          제휴카드 월 할인
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.cardDiscount
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500">
                          구독플러스 월 지원
                        </div>
                        <div className="text-xs sm:text-sm font-black text-indigo-700">
                          -
                          {formatCurrency(
                            quotePayload.primarySubSummary.hiPlusMonthly
                          )}
                          원
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-[11px] font-extrabold text-rose-800">
                          월 최종 체감 구독료
                        </div>
                        <div className="text-sm sm:text-base font-black text-rose-600">
                          월{' '}
                          {formatCurrency(
                            quotePayload.primarySubSummary.finalMonthlyFee
                          )}
                          원
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* 통합 고객관리(CRM) 즉시 연동 입력 폼 */}
              <div className="rounded-2xl bg-amber-50/70 border border-amber-300 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    👑 통합 고객관리(CRM) 저장 정보 (비어 있으면 바로 입력 가능)
                  </span>
                  {effectiveParsedCommand.customer.shouldSaveCrm && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      CRM 저장 감지됨
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      고객명 (필수)
                    </label>
                    <input
                      ref={customerNameInputRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      연락처
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) =>
                          setCustomerPhone(formatPhoneNumber(e.target.value))
                        }
                        placeholder="010-0000-0000"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      배송 예정일
                    </label>
                    <input
                      type="date"
                      value={customerDeliveryDate}
                      onChange={(e) => setCustomerDeliveryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 mb-0.5">
                      상담/결제 상태
                    </label>
                    <select
                      value={customerStatus}
                      onChange={(e) =>
                        setCustomerStatus(e.target.value as AiCustomerStatus)
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-600"
                    >
                      <option value="상담진행중">상담진행중</option>
                      <option value="결제완료">결제완료</option>
                      <option value="배송대기">배송대기</option>
                      <option value="상담종료">상담종료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={customerMemo}
                    onChange={(e) => setCustomerMemo(e.target.value)}
                    placeholder="상담 메모 / 약속 사은품 내역 (선택)"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-800 focus:outline-hidden focus:border-amber-600"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 실행 버튼 3개 */}
        <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const targetState =
                generatedState ||
                buildProposalStateFromAiCommand(
                  parseKoreanCommandLocal(commandText)
                );
              onApplyToQuote(targetState, 'input');
              onClose();
            }}
            className="w-full py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>📊 견적서 입력창으로 열기</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetState =
                generatedState ||
                buildProposalStateFromAiCommand(
                  parseKoreanCommandLocal(commandText)
                );
              onApplyToQuote(targetState, 'proposal');
              onClose();
            }}
            className="w-full py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>📄 완성된 제안서 바로 보기</span>
          </button>

          <button
            type="button"
            onClick={handleManualSaveToCrm}
            className="w-full py-3 px-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>👑 고객관리(CRM) 즉시 저장 + 견적 반영</span>
          </button>
        </div>
      </div>
    </div>
  );
};
