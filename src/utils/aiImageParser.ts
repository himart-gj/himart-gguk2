import { GoogleGenAI, Type } from '@google/genai';
import {
  AffiliateCardId,
  buildProposalStateFromHisisSlip,
  GeneralCardType,
  getValidDisplayModelName,
  HisisSlipGeneralItemInput,
  HisisSlipSubscriptionItemInput,
  normalizeSubscriptionPeriod,
  ProposalState,
  SubscriptionPeriod,
} from '../types/proposal';

export const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
export const LEGACY_GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey';

export function getStoredGeminiApiKey(): string {
  try {
    const key =
      localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_GEMINI_API_KEY_STORAGE_KEY) ||
      '';
    return key.trim();
  } catch {
    return '';
  }
}

export function setStoredGeminiApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    localStorage.setItem(LEGACY_GEMINI_API_KEY_STORAGE_KEY, trimmed);
  } catch {
    // Ignore storage errors
  }
}

export function getEffectiveGeminiApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) return explicitKey.trim();
  const stored = getStoredGeminiApiKey();
  if (stored) return stored;
  const viteKey =
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_GEMINI_API_KEY
      ? String((import.meta as any).env.VITE_GEMINI_API_KEY).trim()
      : '';
  if (viteKey) return viteKey;
  const envKey =
    typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY
      ? String(process.env.GEMINI_API_KEY)
      : '';
  return envKey.trim();
}

// 유료(Paid Tier) API 최적화 최신 모델 체인 (Gemini 3.8 Flash · Gemini 4 Argon · Gemini 3.6 Flash · Gemini 3.5 Flash-Lite)
export const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
] as const;

export const GEMINI_FAST_TEXT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-4-argon',
] as const;

export function buildGeminiFastConfig(
  modelName: string,
  baseConfig: Record<string, any> = {}
): Record<string, any> {
  const isGen3Or4 =
    modelName.startsWith('gemini-3') || modelName.startsWith('gemini-4');
  if (isGen3Or4) {
    const { temperature: _omitTemp, ...rest } = baseConfig;
    return {
      ...rest,
      thinkingConfig: { thinkingLevel: 'LOW' },
    };
  }
  return {
    temperature: 0.1,
    ...baseConfig,
  };
}

/**
 * HTML5 Canvas를 사용해 가로 최대 1920px, JPEG 품질 0.85로 자동 압축/리사이징하는 헬퍼 함수
 */
export async function compressImageFile(
  input: File | string,
  maxWidth = 1920,
  quality = 0.85
): Promise<{
  base64: string;
  base64Data: string;
  dataUrl: string;
  mimeType: string;
}> {
  const sourceDataUrl =
    typeof input === 'string'
      ? input
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(input);
        });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        if (targetW > maxWidth) {
          const ratio = maxWidth / targetW;
          targetW = maxWidth;
          targetH = Math.max(1, Math.round(targetH * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          const fallbackBase64 = sourceDataUrl.includes(',')
            ? sourceDataUrl.split(',')[1]
            : sourceDataUrl;
          resolve({
            base64: fallbackBase64,
            base64Data: fallbackBase64,
            dataUrl: sourceDataUrl,
            mimeType: 'image/jpeg',
          });
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = compressedDataUrl.split(',')[1] || compressedDataUrl;

        resolve({
          base64,
          base64Data: base64,
          dataUrl: compressedDataUrl,
          mimeType: 'image/jpeg',
        });
      } catch {
        const fallbackBase64 = sourceDataUrl.includes(',')
          ? sourceDataUrl.split(',')[1]
          : sourceDataUrl;
        resolve({
          base64: fallbackBase64,
          base64Data: fallbackBase64,
          dataUrl: sourceDataUrl,
          mimeType: 'image/jpeg',
        });
      }
    };

    img.onerror = () => {
      const fallbackBase64 = sourceDataUrl.includes(',')
        ? sourceDataUrl.split(',')[1]
        : sourceDataUrl;
      resolve({
        base64: fallbackBase64,
        base64Data: fallbackBase64,
        dataUrl: sourceDataUrl,
        mimeType: 'image/jpeg',
      });
    };

    img.src = sourceDataUrl;
  });
}

export function normalizeModelCode(rawCode?: string): string {
  if (!rawCode) return '';
  let code = rawCode.trim();
  const urlMatch = code.match(
    /(?:productId|modelCode|model|prdId|goodsNo)=([A-Za-z0-9._-]+)/i
  );
  if (urlMatch && urlMatch[1]) {
    code = urlMatch[1];
  }
  code = code.replace(/\.(AKOR\d*|AKR\d*|KOR\d*)$/i, '');
  return code.trim();
}

export function sanitizeFiveYearWarrantyText(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1');
}

export function inferCategoryFromModelCode(
  code: string,
  rawCategory?: string
): string {
  const upper = (code || '').trim().toUpperCase();
  const cleanedCat = (rawCategory || '').trim();

  // 김치냉장고 전용 모델코드(DDLP, DDL, EDL, WDL, RK, RQ, Z3~Z5 등)는 AI가 '냉장고'로 오분류해도 무조건 '김치냉장고'로 우선 확정
  if (
    upper.startsWith('DDLP') ||
    upper.startsWith('DDL') ||
    upper.startsWith('EDL') ||
    upper.startsWith('WDL') ||
    upper.startsWith('GDL') ||
    upper.startsWith('LDL') ||
    upper.startsWith('CDL') ||
    upper.startsWith('RK') ||
    upper.startsWith('RQ') ||
    upper.startsWith('Z3') ||
    upper.startsWith('Z4') ||
    upper.startsWith('Z5')
  ) {
    return '김치냉장고';
  }

  if (
    cleanedCat &&
    cleanedCat !== '가전품목' &&
    cleanedCat !== '가전' &&
    cleanedCat !== '구독 가전' &&
    cleanedCat !== '구독 상품' &&
    cleanedCat !== '일반가전' &&
    cleanedCat !== '구독가전' &&
    cleanedCat !== '-'
  ) {
    return cleanedCat;
  }
  if (!upper) return cleanedCat || '가전품목';

  if (
    upper.startsWith('FG') ||
    upper.startsWith('W2') ||
    upper.startsWith('WT')
  ) {
    return '워시타워/세탁건조기';
  }
  if (
    upper.startsWith('WF') ||
    upper.startsWith('FX') ||
    upper.startsWith('TR')
  ) {
    return '세탁기';
  }
  if (
    upper.startsWith('DV') ||
    upper.startsWith('RD') ||
    upper.startsWith('RH')
  ) {
    return '건조기';
  }
  if (
    upper.startsWith('RM') ||
    upper.startsWith('RF') ||
    upper.startsWith('RS') ||
    upper.startsWith('M8') ||
    upper.startsWith('S8') ||
    upper.startsWith('J8')
  ) {
    return '냉장고';
  }
  if (
    upper.startsWith('KU') ||
    upper.startsWith('KQ') ||
    upper.startsWith('UN') ||
    upper.startsWith('OLED') ||
    upper.startsWith('QNED')
  ) {
    return 'TV';
  }
  if (
    upper.startsWith('FQ') ||
    upper.startsWith('AF') ||
    upper.startsWith('SQ')
  ) {
    return '에어컨';
  }
  if (upper.startsWith('DW') || upper.startsWith('DB')) {
    return '식기세척기';
  }
  if (upper.startsWith('DF') || upper.startsWith('SC')) {
    return '의류관리기';
  }
  if (
    upper.startsWith('VS') ||
    upper.startsWith('AX') ||
    upper.startsWith('A9')
  ) {
    return '청소기';
  }
  if (upper.startsWith('CRP') || upper.startsWith('CRT')) {
    return '전기밥솥';
  }
  if (
    upper.startsWith('CP-') ||
    upper.startsWith('CHP-') ||
    upper.startsWith('CHPI-') ||
    upper.startsWith('WD5') ||
    upper.startsWith('WU')
  ) {
    return '정수기';
  }
  if (upper.startsWith('BFR') || upper.startsWith('CMC')) {
    return '안마의자';
  }
  return cleanedCat || '가전품목';
}

export function mapGeneralCardName(
  rawCardName?: string,
  hasCashback?: boolean
): GeneralCardType {
  const text = (rawCardName || '').trim();
  if (text.includes('롯데')) return '롯데 제휴카드';
  if (text.includes('삼성')) return '삼성 제휴카드';
  if (text.includes('신한')) return '신한 제휴카드';
  if (text.includes('우리')) return '우리 제휴카드';
  if (text.includes('일반')) return '일반카드';
  if (hasCashback) return '롯데 제휴카드';
  return '롯데 제휴카드';
}

export function mapSubscriptionAffiliateCard(rawCardName?: string): {
  cardId: AffiliateCardId;
  tierId: string;
} {
  const text = (rawCardName || '').trim();
  if (text.includes('우리')) {
    return { cardId: 'woori', tierId: 'woori-30' };
  }
  if (text.includes('롯데')) {
    return { cardId: 'lotte', tierId: 'lotte-30' };
  }
  if (text.includes('삼성')) {
    return { cardId: 'samsung', tierId: 'samsung-30' };
  }
  if (text.includes('신한')) {
    return { cardId: 'shinhan', tierId: 'shinhan-50' };
  }
  return { cardId: 'none', tierId: '' };
}

export interface ParsedGeneralQuoteResult {
  items: {
    category: string;
    name: string;
    code: string;
    modelName: string;
    qty: number;
    quantity: number;
    price: number;
    unitPrice: number;
    discount1: number;
    discount2: number;
    cashback: number;
  }[];
  totalSalePrice: number;
  instantDiscount: number;
  lpointTotal: number;
  tierCashback: number;
  extraCashback: number;
  cardName: string;
  finalBenefitPrice: number;
}

export interface ParsedSubscriptionQuoteResult {
  items: {
    category: string;
    modelName: string;
    modelCode: string;
    monthlyFee: number;
    contractAmount: number;
    period: 36 | 60;
    careService: string;
    careType: string;
    warrantyType: string;
    cardName: string;
    extraCashback: number;
  }[];
  warrantyType: string;
  cardName: string;
  contractAmount: number;
  urlModelCode: string;
  warrantyYears: 3 | 5;
  hasThreeYearKeyword: boolean;
  allCare: boolean;
  detectedTextSummary: string;
}

/**
 * 일반전산 화면 AI 판독 (서버 우선 호출 -> 실패 시 브라우저 직접 @google/genai 호출 Fallback)
 */
export async function parseGeneralImageWithFallback(
  file: File
): Promise<ParsedGeneralQuoteResult> {
  const compressed = await compressImageFile(file, 1920, 0.85);
  const storedKey = getStoredGeminiApiKey();

  // 1차 시도: 백엔드 /api/ai/parse-general-image 호출
  try {
    const response = await fetch('/api/ai/parse-general-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        apiKey: storedKey || undefined,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json && Array.isArray(json.items) && json.items.length > 0) {
        return json as ParsedGeneralQuoteResult;
      }
    }
  } catch (serverErr) {
    console.warn('서버 일반전산 판독 실패, 프론트엔드 직접 호출로 전환합니다:', serverErr);
  }

  // 2차 시도(Fallback): 프론트엔드에서 직접 @google/genai SDK 호출
  const apiKey = getEffectiveGeminiApiKey(storedKey);
  if (!apiKey) {
    throw new Error(
      'AI 키가 설정되어 있지 않습니다. 우측 상단 [🔑 AI 키 설정] 버튼을 눌러 Gemini API 키를 입력해 주세요.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptText = `당신은 롯데하이마트 세일즈툴(일반 상담내역 화면) 이미지를 분석하는 전문 AI입니다.
좌측 '선택상품 & 서비스' 표와 우측 '상세 견적 내역' 요약 박스에서 데이터를 정확히 추출하여 JSON으로 반환하세요.

[1. 좌측 '선택상품 & 서비스' 표 추출 규칙]
- '유형'이 '일반'인 실제 본품 행만 품목(items)으로 추출하세요.
- ⚠️ 절대 제외 규칙 (매우 중요):
  1) 브랜드 열이 '↳'로 표시된 행은 부가서비스이므로 절대 품목에 포함하지 마세요!
  2) 상품명에 '하이워런티_결합', '(C)HIWARRANTY', 'HIWARRANTY', '하이워런티', '연장보증', '보증연장'이 포함된 행은 반드시 제외하세요!
  3) 금액이 '0원'(0)인 행은 사은품/보증연장 부가서비스이므로 반드시 제외하세요!
- 각 본품 행에서 추출할 필드:
  - category: 품목 분류명 (예: "냉장고", "김치냉장고", "TV", "세탁건조기", "에어컨", "세탁기", "건조기", "식기세척기" 등 간결한 품목명)
  - name: 표에 적힌 상품명 원문
  - code: 상품코드 / 모델명 (예: "RM70F64M2X", "RK70F49D1A", "KU75MH80AFXKR" 등)
  - qty: 수량 (정수, 기본 1)
  - price: 금액 / 행사가 (원 단위 정수, 콤마 제외. 예: 3520000, 1923000, 2800000)

[2. 우측 '상세 견적 내역' 박스 혜택 추출 규칙]
- totalSalePrice: 총 판매가 / 행사가 합계 (원 단위 정수, 예: 8243000)
- instantDiscount: '즉시할인 합계' (또는 모델별 즉시할인 + 다품목 즉시할인의 합계, 원 단위 양수 정수. 예: 400,000원이면 400000)
- lpointTotal: 'L.Point 합계' (예: 다품목 L.Point 150,000원이면 150000)
- tierCashback: 제휴카드/멤버스 '금액대 캐시백' (예: 롯데제휴_멤버스 350,000원이면 350000)
- extraCashback: 그 외 추가 캐시백 (없으면 0)
- cardName: 우측 내역에 적힌 카드/결제수단 명칭 (예: "롯데제휴_멤버스")
- finalBenefitPrice: 우측 하단 빨간색 글씨 '최종 혜택가' 금액 (원 단위 정수, 예: 7343000)`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            name: { type: Type.STRING },
            code: { type: Type.STRING },
            qty: { type: Type.INTEGER },
            price: { type: Type.INTEGER },
          },
          required: ['category', 'name', 'code', 'qty', 'price'],
        },
      },
      totalSalePrice: { type: Type.INTEGER },
      instantDiscount: { type: Type.INTEGER },
      lpointTotal: { type: Type.INTEGER },
      tierCashback: { type: Type.INTEGER },
      extraCashback: { type: Type.INTEGER },
      cardName: { type: Type.STRING },
      finalBenefitPrice: { type: Type.INTEGER },
    },
    required: [
      'items',
      'instantDiscount',
      'lpointTotal',
      'tierCashback',
      'finalBenefitPrice',
    ],
  };

  let responseText = '';
  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: compressed.mimeType,
                data: compressed.base64,
              },
            },
            { text: promptText },
          ],
        },
        config: buildGeminiFastConfig(modelName, {
          responseMimeType: 'application/json',
          responseSchema,
        }),
      });
      if (response.text) {
        responseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error('일반전산 이미지 AI 판독에 실패했습니다.');
  }

  const parsed = JSON.parse(responseText);
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const filteredItems = rawItems.filter((it: any) => {
    const nameStr = `${it.name || ''} ${it.category || ''} ${it.code || ''}`.toUpperCase();
    const priceNum = Number(it.price) || 0;
    if (priceNum <= 0) return false;
    if (
      nameStr.includes('↳') ||
      nameStr.includes('하이워런티') ||
      nameStr.includes('HIWARRANTY') ||
      nameStr.includes('보증연장') ||
      nameStr.includes('연장보증')
    ) {
      return false;
    }
    return true;
  });

  const instantDiscount = Math.abs(Number(parsed.instantDiscount) || 0);
  const lpointTotal = Math.abs(Number(parsed.lpointTotal) || 0);
  const tierCashback = Math.abs(Number(parsed.tierCashback) || 0);
  const extraCashback = Math.abs(Number(parsed.extraCashback) || 0);
  const finalBenefitPrice = Math.abs(Number(parsed.finalBenefitPrice) || 0);

  const normalizedItems = filteredItems.map((it: any, idx: number) => {
    const qty = Math.max(1, Number(it.qty) || 1);
    const rawPrice = Math.max(0, Number(it.price) || 0);
    const code = normalizeModelCode(it.code || '');
    const category = inferCategoryFromModelCode(code, it.category || it.name);
    return {
      category: category || it.name || `품목 ${idx + 1}`,
      name: it.name || category || `품목 ${idx + 1}`,
      code,
      modelName: code,
      qty,
      quantity: qty,
      price: rawPrice,
      unitPrice: qty > 1 ? Math.round(rawPrice / qty) : rawPrice,
      discount1: idx === 0 ? instantDiscount : 0,
      discount2: idx === 0 ? lpointTotal : 0,
      cashback: idx === 0 ? tierCashback : 0,
    };
  });

  return {
    items: normalizedItems,
    totalSalePrice: Number(parsed.totalSalePrice) || 0,
    instantDiscount,
    lpointTotal,
    tierCashback,
    extraCashback,
    cardName: parsed.cardName || '',
    finalBenefitPrice,
  };
}

/**
 * 구독전산 (맞춤 구독 견적 계산기) 화면 AI 판독 (서버 우선 호출 -> 실패 시 브라우저 직접 @google/genai 호출 Fallback)
 */
export async function parseSubscriptionImageWithFallback(
  file: File
): Promise<ParsedSubscriptionQuoteResult> {
  const compressed = await compressImageFile(file, 1920, 0.85);
  const storedKey = getStoredGeminiApiKey();

  // 1차 시도: 백엔드 /api/ai/parse-image 호출
  try {
    const response = await fetch('/api/ai/parse-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        apiKey: storedKey || undefined,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const data = json.data || json;
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        data.warrantyYears = 5;
        data.hasThreeYearKeyword = false;
        data.warrantyType = sanitizeFiveYearWarrantyText(data.warrantyType);
        data.items = data.items.map((it: any) => ({
          ...it,
          careService: sanitizeFiveYearWarrantyText(it.careService),
          careType: sanitizeFiveYearWarrantyText(
            it.careType || it.careService
          ),
          warrantyType: sanitizeFiveYearWarrantyText(it.warrantyType),
        }));
        return data as ParsedSubscriptionQuoteResult;
      }
    }
  } catch (serverErr) {
    console.warn('서버 구독전산 판독 실패, 프론트엔드 직접 호출로 전환합니다:', serverErr);
  }

  // 2차 시도(Fallback): 프론트엔드에서 직접 @google/genai SDK 호출
  const apiKey = getEffectiveGeminiApiKey(storedKey);
  if (!apiKey) {
    throw new Error(
      'AI 키가 설정되어 있지 않습니다. 우측 상단 [🔑 AI 키 설정] 버튼을 눌러 Gemini API 키를 입력해 주세요.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptText = `당신은 롯데하이마트 세일즈툴의 '구독 견적 (맞춤 구독 견적 계산기)' 및 가전 구독 전산 화면을 분석하는 전문 AI입니다.
업로드된 화면 사진에서 다음 6가지 핵심 항목을 빈틈없이 정확하게 추출하여 JSON으로 반환하세요.
롯데하이마트 가전 구독의 무상 A/S 기간은 구독 개월수(36개월/60개월)와 상관없이 무조건 5년(5년 무상 A/S)입니다. 화면에서 36개월 버튼이 선택되어 있더라도 절대 '3년 무상 A/S'로 해석하거나 작성하지 마세요.

[핵심 추출 규칙 (맞춤 구독 견적 계산기 & 구독 전산 화면)]
1. 구독 기간 (period):
   - 화면에서 파란색 테두리(또는 강조색)로 활성화된 개월 수 버튼(예: '36개월' 또는 '60개월')을 읽어 숫자 36 또는 60으로 설정하세요.
2. 케어 서비스 (careService / careType):
   - 활성화된 케어 버튼 텍스트(예: '안심케어_1', '방문케어', '셀프케어' 등)와 그 아래 설명 박스 텍스트(예: '완전 분해 클리닝... 서비스 횟수: 1회, 30개월')를 함께 읽어 하나의 읽기 좋은 문자열로 조합하세요. (예: "안심케어_1 (완전 분해 클리닝 / 1회, 30개월)")
   - 롯데하이마트 가전 구독의 무상 A/S 기간은 구독 개월수(36개월/60개월)와 상관없이 무조건 5년(5년 무상 A/S)입니다. 화면에서 36개월 버튼이 선택되어 있더라도 절대 '3년 무상 A/S'로 해석하거나 작성하지 마세요.
3. 보장서비스 (warrantyType):
   - 우측 상단 '보장서비스' 박스에 적힌 텍스트(예: "AS연장보험 + 가전수리올케어")를 원문 그대로 추출하세요.
4. 결제카드 (cardName):
   - '결제카드' 드롭다운에 선택되어 있는 카드명(예: "우리제휴카드(독자)", "롯데제휴카드", "삼성제휴카드", "신한제휴카드" 등)을 그대로 추출하세요.
5. 금액 정보 (contractAmount & monthlyFee):
   - 하단 검은색 요약 박스의 좌측 '계약 금액 / 결제 금액'(예: 2,111,510원 -> 2111510)을 contractAmount로 추출하세요.
   - 하단 검은색 요약 박스 우측의 노란색 글씨 '월 납부요금'(예: "약 58,653원" -> 58653)을 monthlyFee(기본 월 구독료)로 정확히 추출하세요.
6. 모델코드 추출 팁 (modelCode / modelName):
   - 화면 본문에 상품명이나 모델명이 직접 적혀 있다면 그대로 추출하세요.
   - 만약 '맞춤 구독 견적 계산기' 팝업/탭 화면처럼 본문에 상품명이 안 보일 경우, 화면 최상단 브라우저 주소창(URL 파라미터, 예: productId=FG24GN... 또는 =FG24GN.AKOR2)을 주의 깊게 읽어서 거기에 적힌 모델코드(예: "FG24GN")를 찾아내어 modelName / urlModelCode에 반드시 채워 넣으세요!
   - 모델코드(예: FG24GN -> 워시타워/세탁건조기, RM70... -> 냉장고, RK70... -> 김치냉장고, KU75... -> TV 등)를 바탕으로 category(품목명)도 함께 기입하세요.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            modelName: { type: Type.STRING },
            monthlyFee: { type: Type.INTEGER },
            contractAmount: { type: Type.INTEGER },
            period: { type: Type.INTEGER },
            careService: { type: Type.STRING },
            warrantyType: { type: Type.STRING },
            cardName: { type: Type.STRING },
            extraCashback: { type: Type.INTEGER },
          },
          required: ['category', 'modelName', 'monthlyFee', 'period', 'careService'],
        },
      },
      urlModelCode: { type: Type.STRING },
      warrantyType: { type: Type.STRING },
      cardName: { type: Type.STRING },
      contractAmount: { type: Type.INTEGER },
      hasThreeYearKeyword: { type: Type.BOOLEAN },
      warrantyYears: { type: Type.INTEGER },
      allCare: { type: Type.BOOLEAN },
      detectedTextSummary: { type: Type.STRING },
    },
    required: [
      'items',
      'hasThreeYearKeyword',
      'warrantyYears',
      'allCare',
      'detectedTextSummary',
    ],
  };

  let responseText = '';
  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: compressed.mimeType,
                data: compressed.base64,
              },
            },
            { text: promptText },
          ],
        },
        config: buildGeminiFastConfig(modelName, {
          responseMimeType: 'application/json',
          responseSchema,
        }),
      });
      if (response.text) {
        responseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error('구독전산 이미지 AI 판독에 실패했습니다.');
  }

  const parsed = JSON.parse(responseText);
  const combinedCareText = [
    parsed.detectedTextSummary || '',
    parsed.warrantyType || '',
    ...(Array.isArray(parsed.items)
      ? parsed.items.map(
          (it: { careService?: string; warrantyType?: string }) =>
            `${it.careService || ''} ${it.warrantyType || ''}`
        )
      : []),
  ].join(' ');

  const warrantyYears = 5;
  const hasAllCare =
    Boolean(parsed.allCare) ||
    combinedCareText.includes('올케어') ||
    combinedCareText.includes('가전수리올케어');

  const topUrlModelCode = normalizeModelCode(parsed.urlModelCode || '');
  const topWarrantyType = sanitizeFiveYearWarrantyText(
    parsed.warrantyType || ''
  );
  const topCardName = parsed.cardName || '';
  const topContractAmount = Math.max(0, Number(parsed.contractAmount) || 0);

  const normalizedItems =
    Array.isArray(parsed.items) && parsed.items.length > 0
      ? parsed.items.map((item: any) => {
          const rawCode =
            item.modelName && item.modelName !== '-'
              ? item.modelName
              : topUrlModelCode;
          const cleanCode = normalizeModelCode(rawCode);
          const resolvedCategory = inferCategoryFromModelCode(
            cleanCode,
            item.category
          );
          const resolvedWarrantyType = sanitizeFiveYearWarrantyText(
            item.warrantyType || topWarrantyType || ''
          );
          const resolvedCardName = item.cardName || topCardName || '';
          const resolvedContractAmount =
            Math.max(0, Number(item.contractAmount) || 0) || topContractAmount;
          const cleanCareService = sanitizeFiveYearWarrantyText(
            item.careService || '안심케어5 (5년 무상A/S)'
          );

          const parsedMonthlyFee = Math.max(0, Number(item.monthlyFee) || 0);
          const safeModelName = getValidDisplayModelName(
            cleanCode || item.modelName || '',
            parsedMonthlyFee
          );

          return {
            category: resolvedCategory,
            modelName: safeModelName,
            modelCode: safeModelName,
            monthlyFee: parsedMonthlyFee,
            contractAmount: resolvedContractAmount,
            period: (Number(item.period) === 36 ? 36 : 60) as 36 | 60,
            careService: cleanCareService,
            careType: cleanCareService,
            warrantyType: resolvedWarrantyType,
            cardName: resolvedCardName,
            extraCashback: Math.max(0, Number(item.extraCashback) || 0),
          };
        })
      : [];

  return {
    items: normalizedItems,
    warrantyType: topWarrantyType || normalizedItems[0]?.warrantyType || '',
    cardName: topCardName || normalizedItems[0]?.cardName || '',
    contractAmount: topContractAmount || normalizedItems[0]?.contractAmount || 0,
    urlModelCode: topUrlModelCode,
    warrantyYears,
    hasThreeYearKeyword: false,
    allCare: hasAllCare,
    detectedTextSummary: sanitizeFiveYearWarrantyText(
      parsed.detectedTextSummary || ''
    ),
  };
}

// ==================== HISIS v3 [판매접수등록] 전표 정밀 파서 & 정규화 엔진 ====================

export const UNKNOWN_HISIS_CUSTOMER_RE =
  /(불명|무기명|미상|미등록|임시고객|현금고객|^임시$|^현금$)/i;

export const HISIS_SET_CARD_RE = /set[\s_-]*card[\s_-]*(\d{2})?/i;

export interface RawHisisSlipRow {
  seq?: string; // '01', '02', ...
  productCode?: string; // 상품코드 (예: 'DDLP22AGSTE1', 'FG24GN', 'SET-CARD36')
  productName?: string; // 상품명 보조 텍스트 (있는 경우)
  category?: string; // 품목 추론 힌트
  quantity?: number; // 수량
  receiptAmount?: number; // 접수금액
  discountAmount?: number; // 에누리
  actualPrice?: number; // 실구매가
  deliveryDate?: string; // 배달일자 (YYYY-MM-DD)
  deliveryTime?: string; // 시간 (예: '오후FT')
  outboundPlace?: string; // 출고지 (예: '자송', '타사물류')
  directDelivery?: string; // 직배 (예: '타사직배')
  cancelDate?: string; // 취소일자 (기재 시 취소 행 제외)
}

export interface RawHisisSlipAiPayload {
  receiptDate?: string; // 상단 [접수] 접수일자 (YYYY-MM-DD)
  receiptSeq?: string; // 상단 [접수] 접수일자 바로 우측 파란 박스 4자리 순번 (예: '0011')
  orderNo?: string; // 직접 전달된 전표번호 후보 (예: '20261125-0011')
  quoteNumberIgnore?: string; // 우측 견적번호 분리 격리용 (예: '20261125-0002-0001')
  saleTypeHeader?: string; // 상단 판매유형 (예: '일반', '구독')
  customerName?: string; // 상단 [고객] 행 성명
  customerMobile?: string; // 상단 [고객] 행 이동통신 (1순위)
  customerPhone?: string; // 상단 [고객] 행 전화번호 (2순위)
  customerRoadAddress?: string; // 상단 [고객] 도로명주소/주소
  recipientName?: string; // 하단 [출하] 인수자 성명
  recipientMobile?: string; // 하단 [출하] 이동통신
  recipientPhone?: string; // 하단 [출하] 전화번호
  shippingRoadAddress?: string; // 하단 [출하] 도로명주소/주소
  customerRequest?: string; // 하단 [출하] 고객요청
  logisticsVendor?: string; // 하단 [출하] 의뢰물류 (예: '직사입물류')
  paymentCreditCard?: number; // 하단 [결제] 1행 2열 '신용카드' 우측 금액
  paymentReceiptTotal?: number; // 하단 [결제] 1행 1열 '접수금액' 우측 금액
  paymentActualTotal?: number; // 하단 [결제] 2행 1열 '실구매가' 우측 금액
  rows?: RawHisisSlipRow[];
}

export interface ParsedHisisSlipResult {
  orderNo: string; // '20261125-0011'
  contractDate: string; // '2026-11-25'
  customerName: string; // 최종 채택 고객명
  customerPhone: string; // 최종 채택 연락처
  rawCustomerName: string; // 상단 [고객] 원문 성명
  recipientName: string; // 하단 [출하] 인수자 성명
  usedRecipientFallback: boolean; // 불명고객 -> 인수자 자동 대체 여부
  needsManualIdentity: boolean; // 상/하단 모두 불명·공란이어서 수동 입력 필요 여부
  quoteMode: 'general' | 'subscription';
  subscriptionPeriod: SubscriptionPeriod;
  generalItems: HisisSlipGeneralItemInput[];
  subscriptionItems: HisisSlipSubscriptionItemInput[];
  itemSummary: string;
  modelCodesSummary: string;
  totalReceiptAmount: number;
  totalDiscountAmount: number;
  actualPurchaseAmount: number; // 일반: 실구매가 합계 / 구독: 구독원금 합계
  monthlyFeeTotal: number; // 구독: 월 구독료 합계 (일반은 0)
  performanceAmount: number; // 실적기준액 (일반: 실구매가 합계, 구독: 구독원금 합계)
  deliveryDate: string; // 배달일자 (자송 공란 시 contractDate 자동 입력)
  deliveryTimeSlot: string;
  outboundPlace: string;
  directDelivery: string;
  outboundLabel: string;
  deliveryStatus: '배송대기' | '배송완료';
  crmStatus: '계약완료' | '배송완료';
  logisticsConfirmed: boolean;
  roadAddress: string;
  customerRequest: string;
  giftItems: string;
  memoSummary: string;
  proposalState: ProposalState;
}

export function isUnknownHisisCustomerName(rawName?: string): boolean {
  const s = String(rawName || '').trim();
  if (!s || s === '-') return true;
  if (/^\d+$/.test(s.replace(/[-\s]/g, ''))) return true;
  return UNKNOWN_HISIS_CUSTOMER_RE.test(s);
}

export function formatHisisPhoneNumber(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `02-${digits.slice(2)}`;
    if (digits.length === 9) {
      return `02-${digits.slice(2, 5)}-${digits.slice(5, 9)}`;
    }
    return `02-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.startsWith('050') && digits.length >= 11) {
    return `${digits.slice(0, 4)}-${digits.slice(4, digits.length - 4)}-${digits.slice(-4)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  const clamped = digits.slice(0, 11);
  return `${clamped.slice(0, 3)}-${clamped.slice(3, 7)}-${clamped.slice(7)}`;
}

export function normalizeHisisIsoDate(
  raw?: string,
  fallbackYear?: string
): string {
  const s = String(raw || '').trim();
  if (!s || s === '-' || s === '0') return '';
  const isoMatch = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const compactMatch = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }
  const shortMatch = s.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (shortMatch) {
    const yyyy = fallbackYear || String(new Date().getFullYear());
    return `${yyyy}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`;
  }
  return '';
}

export function formatHisisOrderNo(
  contractDate: string,
  receiptSeq?: string,
  rawOrderNo?: string
): string {
  const dateDigits = contractDate.replace(/\D/g, '').slice(0, 8);
  const cleanRawOrder = String(rawOrderNo || '').trim();

  // 직접 전달된 YYYYMMDD-NNNN 형태가 있으면 우선 활용 (단, 3단 견적번호 YYYYMMDD-NNNN-NNNN은 제외)
  const twoPartMatch = cleanRawOrder.match(/^(\d{8})[-_\s]?(\d{4})$/);
  if (twoPartMatch && !/^\d{8}[-_\s]\d{4}[-_\s]\d{4}$/.test(cleanRawOrder)) {
    return `${twoPartMatch[1]}-${twoPartMatch[2]}`;
  }

  let seqClean = String(receiptSeq || '').trim();
  // 만약 receiptSeq에 실수로 3단 견적번호(YYYYMMDD-0002-0001)가 들어온 경우 무시
  if (/^\d{8}[-_\s]\d{4}[-_\s]\d{4}$/.test(seqClean)) {
    seqClean = '';
  }
  const fullInSeq = seqClean.match(/^(\d{8})[-_\s]?(\d{1,4})$/);
  if (fullInSeq) {
    return `${fullInSeq[1]}-${fullInSeq[2].padStart(4, '0')}`;
  }
  const seqDigits = seqClean.replace(/\D/g, '');
  if (dateDigits.length === 8 && seqDigits.length >= 1 && seqDigits.length <= 4) {
    return `${dateDigits}-${seqDigits.padStart(4, '0')}`;
  }
  if (dateDigits.length === 8 && seqDigits.length > 4) {
    return `${dateDigits}-${seqDigits.slice(-4)}`;
  }
  return cleanRawOrder && !/^\d{8}-\d{4}-\d{4}$/.test(cleanRawOrder)
    ? cleanRawOrder
    : '';
}

export function extractSetCardPeriod(rawText?: string): SubscriptionPeriod | null {
  const s = String(rawText || '').trim();
  if (!s) return null;
  const m = s.match(HISIS_SET_CARD_RE);
  if (!m) return null;
  if (m[1]) {
    const num = parseInt(m[1], 10);
    return normalizeSubscriptionPeriod(num, 60);
  }
  return 60;
}

export function resolveHisisDeliveryStatus(params: {
  outboundPlace?: string;
  directDelivery?: string;
  logisticsVendor?: string;
  contractDate?: string;
  rawDeliveryDate?: string;
}): {
  deliveryStatus: '배송대기' | '배송완료';
  crmStatus: '계약완료' | '배송완료';
  logisticsConfirmed: boolean;
  deliveryDate: string;
  outboundLabel: string;
} {
  const outPlace = String(params.outboundPlace || '').trim();
  const dirDeliv = String(params.directDelivery || '').trim();
  const vendor = String(params.logisticsVendor || '').trim();
  const fallbackYear = params.contractDate
    ? params.contractDate.slice(0, 4)
    : undefined;
  const normDeliv = normalizeHisisIsoDate(params.rawDeliveryDate, fallbackYear);
  const normContract = normalizeHisisIsoDate(params.contractDate);

  const labelParts = [outPlace, dirDeliv].filter(Boolean);
  const outboundLabel =
    labelParts.length > 0 ? labelParts.join(' / ') : vendor || '';

  const rowCombined = `${outPlace} ${dirDeliv}`;
  if (/자송/.test(rowCombined)) {
    return {
      deliveryStatus: '배송완료',
      crmStatus: '배송완료',
      logisticsConfirmed: true,
      deliveryDate: normDeliv || normContract,
      outboundLabel: outboundLabel || '자송',
    };
  }

  // 타사직배 / 타사물류 / 물류 / 직배 (또는 기타 출고) → 배송대기 ('계약완료')
  return {
    deliveryStatus: '배송대기',
    crmStatus: '계약완료',
    logisticsConfirmed: false,
    deliveryDate: normDeliv,
    outboundLabel:
      outboundLabel || (/타사직배|물류|직배/.test(vendor) ? vendor : '물류/직배'),
  };
}

function isCancelledHisisRow(row: RawHisisSlipRow): boolean {
  const cancel = String(row.cancelDate || '').trim();
  if (!cancel || cancel === '-' || cancel === '0' || cancel === '미취소') {
    return false;
  }
  return /\d{2,4}[-./]?\d{1,2}|취소|반품/.test(cancel);
}

function isWarrantyRowText(text: string): boolean {
  return /hiwarranty|하이워런티|보증연장|연장보증|↳/i.test(text);
}

/**
 * AI가 추출한 원시 HISIS 전표 데이터를 비즈니스 규칙(전표번호 조합, 불명고객->인수자 대체,
 * SET-CARD 구독 원금/개월수 계산, 자송 vs 타사직배/물류 배송상태 자동 분기, ProposalState 빌드)에 맞춰 정규화합니다.
 */
export function normalizeHisisSlipPayload(
  raw: RawHisisSlipAiPayload
): ParsedHisisSlipResult {
  const contractDate = normalizeHisisIsoDate(raw.receiptDate);
  const orderNo = formatHisisOrderNo(
    contractDate,
    raw.receiptSeq,
    raw.orderNo
  );

  const rawCustomerName = String(raw.customerName || '').trim();
  const recipientName = String(raw.recipientName || '').trim();

  let customerName = '';
  let customerPhone = '';
  let usedRecipientFallback = false;
  let needsManualIdentity = false;

  if (isUnknownHisisCustomerName(rawCustomerName)) {
    if (!isUnknownHisisCustomerName(recipientName)) {
      customerName = recipientName;
      customerPhone = formatHisisPhoneNumber(
        raw.recipientMobile ||
          raw.recipientPhone ||
          raw.customerMobile ||
          raw.customerPhone
      );
      usedRecipientFallback = true;
    } else {
      customerName = '';
      customerPhone = formatHisisPhoneNumber(
        raw.recipientMobile ||
          raw.recipientPhone ||
          raw.customerMobile ||
          raw.customerPhone
      );
      needsManualIdentity = true;
    }
  } else {
    customerName = rawCustomerName;
    customerPhone = formatHisisPhoneNumber(
      raw.customerMobile ||
        raw.customerPhone ||
        raw.recipientMobile ||
        raw.recipientPhone
    );
  }

  const allRows = Array.isArray(raw.rows) ? raw.rows : [];
  const activeRows = allRows.filter((r) => r && !isCancelledHisisRow(r));

  const setCardPeriodsInSlip: SubscriptionPeriod[] = [];
  for (const r of activeRows) {
    const p = extractSetCardPeriod(`${r.productCode || ''} ${r.productName || ''}`);
    if (p !== null) setCardPeriodsInSlip.push(p);
  }

  const isHeaderSubscription = String(raw.saleTypeHeader || '').includes('구독');
  const quoteMode: 'general' | 'subscription' =
    setCardPeriodsInSlip.length > 0 || isHeaderSubscription
      ? 'subscription'
      : 'general';

  const giftCandidates: string[] = [];
  const generalItems: HisisSlipGeneralItemInput[] = [];
  const subscriptionItems: HisisSlipSubscriptionItemInput[] = [];

  let primaryDeliveryDateRaw = '';
  let primaryDeliveryTime = '';
  let primaryOutboundPlace = '';
  let primaryDirectDelivery = '';

  const captureRowLogistics = (r: RawHisisSlipRow) => {
    if (!primaryDeliveryDateRaw && r.deliveryDate && String(r.deliveryDate).trim()) {
      primaryDeliveryDateRaw = String(r.deliveryDate).trim();
    }
    if (!primaryDeliveryTime && r.deliveryTime && String(r.deliveryTime).trim()) {
      primaryDeliveryTime = String(r.deliveryTime).trim();
    }
    if (!primaryOutboundPlace && !primaryDirectDelivery) {
      const rowOut = String(r.outboundPlace || '').trim();
      const rowDir = String(r.directDelivery || '').trim();
      if (rowOut || rowDir) {
        primaryOutboundPlace = rowOut;
        primaryDirectDelivery = rowDir;
      }
    }
  };

  if (quoteMode === 'subscription') {
    const period: SubscriptionPeriod = setCardPeriodsInSlip[0] || 60;

    const normalizeSeqNum = (seq?: string): number | null => {
      const digits = String(seq || '').trim().replace(/\D/g, '');
      if (!digits) return null;
      const n = parseInt(digits, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const isMainSubRowCandidate = (r: RawHisisSlipRow): boolean => {
      const codeAndName = `${r.productCode || ''} ${r.productName || ''}`.trim();
      if (!codeAndName) return false;
      if (extractSetCardPeriod(codeAndName) !== null) return false;
      if (isWarrantyRowText(codeAndName)) return false;
      return true;
    };

    const row01 =
      activeRows.find(
        (r) => normalizeSeqNum(r.seq) === 1 && isMainSubRowCandidate(r)
      ) ||
      activeRows.find((r) => isMainSubRowCandidate(r)) ||
      null;

    if (row01) {
      captureRowLogistics(row01);
    }

    const creditCardAmt = Math.max(
      0,
      Math.round(Number(raw.paymentCreditCard) || 0)
    );
    const fallbackAmt = Math.max(
      0,
      Math.round(
        Number(raw.paymentActualTotal) ||
          Number(row01?.actualPrice) ||
          Number(row01?.receiptAmount) ||
          0
      )
    );
    const baseCardTotal = creditCardAmt > 0 ? creditCardAmt : fallbackAmt;

    const isSingleMonthUnitCard =
      creditCardAmt > 0 &&
      creditCardAmt <= 250000 &&
      Number(row01?.receiptAmount) >= creditCardAmt * 12;

    const contractAmount = isSingleMonthUnitCard
      ? creditCardAmt * period
      : baseCardTotal;
    const monthlyFee = isSingleMonthUnitCard
      ? creditCardAmt
      : Math.round(baseCardTotal / period);

    const row01Code = row01
      ? normalizeModelCode(row01.productCode || row01.productName || '')
      : '';
    const category = inferCategoryFromModelCode(
      row01Code,
      row01?.category || '구독가전'
    );

    if (row01 || baseCardTotal > 0) {
      subscriptionItems.push({
        category,
        modelName: row01Code,
        contractAmount,
        period,
        monthlyFee,
      });
    }
  } else {
    for (const r of activeRows) {
      const codeAndName = `${r.productCode || ''} ${r.productName || ''}`.trim();
      if (!codeAndName) continue;
      if (isWarrantyRowText(codeAndName)) continue;

      const receiptAmt = Math.max(0, Math.round(Number(r.receiptAmount) || 0));
      const actualAmt = Math.max(0, Math.round(Number(r.actualPrice) || 0));
      const resolvedActual =
        actualAmt > 0
          ? actualAmt
          : receiptAmt > 0 && !(Number(r.discountAmount) > 0)
          ? receiptAmt
          : 0;

      if (resolvedActual <= 0 && receiptAmt <= 0) {
        const giftLabel = normalizeModelCode(r.productCode || r.productName);
        if (giftLabel) giftCandidates.push(giftLabel);
        continue;
      }

      captureRowLogistics(r);

      const cleanCode = normalizeModelCode(r.productCode || r.productName || '');
      const category = inferCategoryFromModelCode(cleanCode, r.category);
      const quantity = Math.max(1, Math.round(Number(r.quantity) || 1));
      const resolvedReceipt = Math.max(resolvedActual, receiptAmt || resolvedActual);
      const discountAmount = Math.max(0, resolvedReceipt - resolvedActual);

      generalItems.push({
        category,
        modelName: cleanCode,
        productName: r.productName || category,
        quantity,
        receiptAmount: resolvedReceipt,
        discountAmount,
        actualPrice: resolvedActual,
      });
    }
  }

  // 본품 행에서 물류 정보를 못 찾은 경우 비부가서비스 행 우선 → 전체 활성 행 순으로 보조 탐색
  for (const r of activeRows) {
    const codeAndName = `${r.productCode || ''} ${r.productName || ''}`.trim();
    if (extractSetCardPeriod(codeAndName) !== null || isWarrantyRowText(codeAndName)) {
      continue;
    }
    captureRowLogistics(r);
  }
  for (const r of activeRows) {
    captureRowLogistics(r);
  }

  const deliveryMeta = resolveHisisDeliveryStatus({
    outboundPlace: primaryOutboundPlace,
    directDelivery: primaryDirectDelivery,
    logisticsVendor: raw.logisticsVendor,
    contractDate,
    rawDeliveryDate: primaryDeliveryDateRaw,
  });

  const proposalState = buildProposalStateFromHisisSlip({
    mode: quoteMode,
    generalItems,
    subscriptionItems,
  });

  const totalReceiptAmount =
    quoteMode === 'subscription'
      ? subscriptionItems.reduce((s, it) => s + it.contractAmount, 0)
      : generalItems.reduce((s, it) => s + it.receiptAmount, 0);

  const actualPurchaseAmount =
    quoteMode === 'subscription'
      ? subscriptionItems.reduce((s, it) => s + it.contractAmount, 0)
      : generalItems.reduce((s, it) => s + it.actualPrice, 0);

  const totalDiscountAmount =
    quoteMode === 'subscription'
      ? 0
      : Math.max(0, totalReceiptAmount - actualPurchaseAmount);

  const monthlyFeeTotal =
    quoteMode === 'subscription'
      ? subscriptionItems.reduce((s, it) => s + (it.monthlyFee || 0), 0)
      : 0;

  const subscriptionPeriod: SubscriptionPeriod =
    quoteMode === 'subscription'
      ? subscriptionItems[0]?.period || setCardPeriodsInSlip[0] || 60
      : 60;

  const modelCodesSummary =
    quoteMode === 'subscription'
      ? subscriptionItems.map((it) => it.modelName).filter(Boolean).join(', ')
      : generalItems
          .map((it) =>
            it.quantity > 1 ? `${it.modelName}×${it.quantity}` : it.modelName
          )
          .filter(Boolean)
          .join(', ');

  const itemSummary =
    quoteMode === 'subscription'
      ? subscriptionItems.length > 0
        ? `[${subscriptionPeriod}개월 구독] ${subscriptionItems
            .map((it) =>
              it.modelName
                ? `${it.category}(${it.modelName}·${it.period}M)`
                : `${it.category}(${it.period}M)`
            )
            .join(', ')}`
        : `[${subscriptionPeriod}개월 구독] 구독 가전`
      : generalItems.length > 0
      ? generalItems
          .map((it) => {
            const baseLabel = it.modelName
              ? `${it.category}(${it.modelName})`
              : it.category;
            return it.quantity > 1 ? `${baseLabel} ×${it.quantity}` : baseLabel;
          })
          .join(', ')
      : '일반가전';

  const roadAddress = String(
    raw.shippingRoadAddress || raw.customerRoadAddress || ''
  ).trim();
  const customerRequest = String(raw.customerRequest || '').trim();

  const memoParts: string[] = [];
  if (roadAddress) memoParts.push(`주소: ${roadAddress}`);
  if (primaryDeliveryTime) memoParts.push(`배달시간: ${primaryDeliveryTime}`);
  if (customerRequest) memoParts.push(`요청: ${customerRequest}`);
  const memoPrefix = orderNo ? `[전표 ${orderNo}] ` : '[전표] ';
  const memoSummary =
    memoParts.length > 0 ? `${memoPrefix}${memoParts.join(' | ')}` : '';

  return {
    orderNo,
    contractDate,
    customerName,
    customerPhone,
    rawCustomerName,
    recipientName,
    usedRecipientFallback,
    needsManualIdentity,
    quoteMode,
    subscriptionPeriod,
    generalItems,
    subscriptionItems,
    itemSummary,
    modelCodesSummary,
    totalReceiptAmount,
    totalDiscountAmount,
    actualPurchaseAmount,
    monthlyFeeTotal,
    performanceAmount: actualPurchaseAmount,
    deliveryDate: deliveryMeta.deliveryDate,
    deliveryTimeSlot: primaryDeliveryTime,
    outboundPlace: primaryOutboundPlace,
    directDelivery: primaryDirectDelivery,
    outboundLabel: deliveryMeta.outboundLabel,
    deliveryStatus: deliveryMeta.deliveryStatus,
    crmStatus: deliveryMeta.crmStatus,
    logisticsConfirmed: deliveryMeta.logisticsConfirmed,
    roadAddress,
    customerRequest,
    giftItems: giftCandidates.join(', '),
    memoSummary,
    proposalState,
  };
}

/**
 * 다중 업로드 검수 카드에서 사용자가 인라인으로 수정한 값(고객명, 연락처, 전표번호, 구매유형/개월수,
 * 상품코드, 실구매가/구독원금·월구독료, 배달일자, 출고상태)을 바탕으로 ParsedHisisSlipResult와 ProposalState를 즉시 재구성합니다.
 */
export function rebuildParsedHisisSlipFromEdits(
  prev: ParsedHisisSlipResult,
  patch: {
    orderNo?: string;
    contractDate?: string;
    customerName?: string;
    customerPhone?: string;
    quoteMode?: 'general' | 'subscription';
    subscriptionPeriod?: SubscriptionPeriod;
    modelCodesSummary?: string;
    actualPurchaseAmount?: number;
    monthlyFeeTotal?: number;
    deliveryDate?: string;
    deliveryStatus?: '배송대기' | '배송완료';
    logisticsConfirmed?: boolean;
  }
): ParsedHisisSlipResult {
  const nextOrderNo =
    patch.orderNo !== undefined ? patch.orderNo.trim() : prev.orderNo;
  const nextContractDate =
    patch.contractDate !== undefined
      ? patch.contractDate.trim()
      : prev.contractDate;
  const nextCustomerName =
    patch.customerName !== undefined
      ? patch.customerName
      : prev.customerName;
  const nextCustomerPhone =
    patch.customerPhone !== undefined
      ? formatHisisPhoneNumber(patch.customerPhone)
      : prev.customerPhone;
  const nextMode = patch.quoteMode ?? prev.quoteMode;
  const nextPeriod = normalizeSubscriptionPeriod(
    patch.subscriptionPeriod ?? prev.subscriptionPeriod,
    60
  );
  const nextModelCodesStr =
    patch.modelCodesSummary !== undefined
      ? patch.modelCodesSummary
      : prev.modelCodesSummary;

  const parsedCodeTokens = nextModelCodesStr
    .split(/[,+]+/)
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const qtyMatch = tok.match(/^(.*?)\s*[×xX*]\s*(\d+)$/);
      const rawCode = qtyMatch ? qtyMatch[1].trim() : tok;
      const qty = qtyMatch ? Math.max(1, parseInt(qtyMatch[2], 10) || 1) : 1;
      const code = normalizeModelCode(rawCode);
      return {
        code,
        category: inferCategoryFromModelCode(code),
        quantity: qty,
      };
    });

  const nextActualAmount =
    patch.actualPurchaseAmount !== undefined
      ? Math.max(0, Math.round(Number(patch.actualPurchaseAmount) || 0))
      : prev.actualPurchaseAmount;

  let nextGeneralItems = prev.generalItems;
  let nextSubItems = prev.subscriptionItems;
  let nextMonthlyTotal = prev.monthlyFeeTotal;
  let nextTotalReceipt = prev.totalReceiptAmount;
  let nextTotalDiscount = prev.totalDiscountAmount;

  if (nextMode === 'subscription') {
    const explicitMonthly =
      patch.monthlyFeeTotal !== undefined
        ? Math.max(0, Math.round(Number(patch.monthlyFeeTotal) || 0))
        : nextPeriod > 0
        ? Math.round(nextActualAmount / nextPeriod)
        : 0;
    const tokens =
      parsedCodeTokens.length > 0
        ? parsedCodeTokens
        : [{ code: '', category: '구독가전', quantity: 1 }];
    const count = tokens.length;
    const perPrincipal =
      count > 1 ? Math.floor(nextActualAmount / count) : nextActualAmount;
    const perMonthly =
      count > 1 ? Math.floor(explicitMonthly / count) : explicitMonthly;

    nextSubItems = tokens.map((t, idx) => {
      const itemPrincipal =
        idx === count - 1
          ? nextActualAmount - perPrincipal * (count - 1)
          : perPrincipal;
      const itemMonthly =
        idx === count - 1
          ? explicitMonthly - perMonthly * (count - 1)
          : perMonthly;
      return {
        category: t.category,
        modelName: t.code,
        contractAmount: itemPrincipal,
        period: nextPeriod,
        monthlyFee: itemMonthly,
      };
    });
    nextGeneralItems = [];
    nextMonthlyTotal = explicitMonthly;
    nextTotalReceipt = nextActualAmount;
    nextTotalDiscount = 0;
  } else {
    const tokens =
      parsedCodeTokens.length > 0
        ? parsedCodeTokens
        : [{ code: '', category: '일반가전', quantity: 1 }];
    const keepOriginalBreakdown =
      patch.actualPurchaseAmount === undefined &&
      patch.modelCodesSummary === undefined &&
      prev.quoteMode === 'general' &&
      prev.generalItems.length > 0;

    if (keepOriginalBreakdown) {
      nextGeneralItems = prev.generalItems;
    } else {
      const count = tokens.length;
      const perActual =
        count > 1 ? Math.floor(nextActualAmount / count) : nextActualAmount;
      nextGeneralItems = tokens.map((t, idx) => {
        const itemActual =
          idx === count - 1
            ? nextActualAmount - perActual * (count - 1)
            : perActual;
        return {
          category: t.category,
          modelName: t.code,
          productName: t.category,
          quantity: t.quantity,
          receiptAmount: itemActual,
          discountAmount: 0,
          actualPrice: itemActual,
        };
      });
      nextTotalReceipt = nextActualAmount;
      nextTotalDiscount = 0;
    }
    nextSubItems = [];
    nextMonthlyTotal = 0;
  }

  const nextDeliveryStatus = patch.deliveryStatus ?? prev.deliveryStatus;
  const nextCrmStatus: '계약완료' | '배송완료' =
    nextDeliveryStatus === '배송완료' ? '배송완료' : '계약완료';
  const nextLogisticsConfirmed =
    nextDeliveryStatus === '배송완료'
      ? true
      : patch.logisticsConfirmed !== undefined
      ? patch.logisticsConfirmed
      : patch.deliveryStatus !== undefined && prev.deliveryStatus === '배송완료'
      ? false
      : Boolean(prev.logisticsConfirmed);

  let nextDeliveryDate =
    patch.deliveryDate !== undefined
      ? patch.deliveryDate.trim()
      : prev.deliveryDate;
  if (
    nextDeliveryStatus === '배송완료' &&
    !nextDeliveryDate &&
    nextContractDate
  ) {
    nextDeliveryDate = nextContractDate;
  }

  const nextOutboundLabel =
    patch.deliveryStatus !== undefined && patch.deliveryStatus !== prev.deliveryStatus
      ? nextDeliveryStatus === '배송완료'
        ? '자송'
        : '타사직배/물류'
      : prev.outboundLabel;

  const proposalState = buildProposalStateFromHisisSlip({
    mode: nextMode,
    generalItems: nextGeneralItems,
    subscriptionItems: nextSubItems,
  });

  const itemSummary =
    nextMode === 'subscription'
      ? `[${nextPeriod}개월 구독] ${nextSubItems
          .map((it) =>
            it.modelName
              ? `${it.category}(${it.modelName}·${it.period}M)`
              : `${it.category}(${it.period}M)`
          )
          .join(', ')}`
      : nextGeneralItems
          .map((it) => {
            const baseLabel = it.modelName
              ? `${it.category}(${it.modelName})`
              : it.category;
            return it.quantity > 1 ? `${baseLabel} ×${it.quantity}` : baseLabel;
          })
          .join(', ');

  const memoParts: string[] = [];
  if (prev.roadAddress) memoParts.push(`주소: ${prev.roadAddress}`);
  if (prev.deliveryTimeSlot) memoParts.push(`배달시간: ${prev.deliveryTimeSlot}`);
  if (prev.customerRequest) memoParts.push(`요청: ${prev.customerRequest}`);
  const memoPrefix = nextOrderNo ? `[전표 ${nextOrderNo}] ` : '[전표] ';
  const memoSummary =
    memoParts.length > 0 ? `${memoPrefix}${memoParts.join(' | ')}` : prev.memoSummary;

  return {
    ...prev,
    orderNo: nextOrderNo,
    contractDate: nextContractDate,
    customerName: nextCustomerName,
    customerPhone: nextCustomerPhone,
    needsManualIdentity: !nextCustomerName.trim(),
    quoteMode: nextMode,
    subscriptionPeriod: nextPeriod,
    generalItems: nextGeneralItems,
    subscriptionItems: nextSubItems,
    itemSummary,
    modelCodesSummary: nextModelCodesStr,
    totalReceiptAmount: nextTotalReceipt,
    totalDiscountAmount: nextTotalDiscount,
    actualPurchaseAmount: nextActualAmount,
    monthlyFeeTotal: nextMonthlyTotal,
    performanceAmount: nextActualAmount,
    deliveryDate: nextDeliveryDate,
    outboundLabel: nextOutboundLabel,
    deliveryStatus: nextDeliveryStatus,
    crmStatus: nextCrmStatus,
    logisticsConfirmed: nextLogisticsConfirmed,
    memoSummary,
    proposalState,
  };
}

export const HISIS_SLIP_PROMPT_TEXT = `당신은 롯데하이마트 HISIS v3 '[판매접수등록]' 전산 화면 사진을 정밀 판독하는 전문 OCR·데이터 추출 AI입니다.
모니터 모아레 무늬나 워터마크가 있더라도 글자와 숫자를 한 글자도 틀리지 않고 정확히 읽어 JSON으로 반환하세요.

[1. 상단 '[접수]' 영역 추출 규칙]
- receiptDate: 좌측 '접수일자' 칸의 날짜 (YYYY-MM-DD 형식, 예: "2026-11-25")
- receiptSeq: '접수일자'와 달력 아이콘 바로 오른쪽에 있는 파란색 하이라이트 박스(또는 흰색 입력칸) 안의 4자리 숫자 전표순번 (예: "0011"). 파란 배경에 흰색/노란색 반전 글씨일 수 있으니 주의 깊게 읽으세요!
- quoteNumberIgnore: 화면 우측 상단의 긴 '견적번호'(예: "20261125-0002-0001")는 여기에 분리 기록하고 절대 receiptSeq에 넣지 마세요!
- saleTypeHeader: 상단 중앙 '판매유형' 드롭다운 값 (예: "일반", "구독")

[2. 상단 '[고객]' 영역 및 하단 '[출하]' 영역 분리 추출 규칙]
- customerName: 상단 '[고객]' 행의 '고객번호' 돋보기 오른쪽 성명 칸 텍스트 원문 그대로 추출 (예: 일반 실명 또는 "경기광주불명" 등 불명 표기 그대로)
- customerMobile: 상단 '[고객]' 행 우측의 '이동통신' 번호 (예: "010-0000-0000")
- customerPhone: 상단 '[고객]' 행의 일반 '전화번호' (예: "031-000-0000")
- customerRoadAddress: 상단 '[고객]' 영역의 '도로명주소' (없으면 '주소')
- recipientName: 하단 '[출하]' 영역의 '인수자' 성명 칸 텍스트 원문
- recipientMobile: 하단 '[출하]' 영역의 '이동통신' 번호
- recipientPhone: 하단 '[출하]' 영역의 '전화번호'
- shippingRoadAddress: 하단 '[출하]' 영역의 '도로명주소' (없으면 '주소')
- customerRequest: 하단 '[출하]' 영역의 '고객요청' 텍스트 (예: "빠른배송 희망합니다.")
- logisticsVendor: 하단 '[출하]' 영역의 '의뢰물류' 텍스트 (예: "직사입물류")

[3. 중앙 품목 그리드 테이블 ('01', '02', ...) 추출 규칙]
컬럼 순서: 순번(01, 02...) | 상품코드 | 등급 | 수량 | 접수금액 | 에누리 | 실구매가 | 배달일자 | 시간 | 출고지 | 직배 | 취소일자 | 실판 | 전시
- 표에 적힌 모든 행(01, 02, ... 본품 행뿐만 아니라 'SET-CARD36', 'SET-CARD60', 'SET-CARD-60' 등 SET-CARD 행 포함!)을 빠짐없이 순서대로 rows 배열에 추출하세요.
- 각 행 필드:
  - seq: 순번 (예: "01", "02")
  - productCode: '상품코드' 열의 영문/숫자/기호 코드 정확히 그대로 (예: "DDLP22AGSTE1", "FG24GN", "SET-CARD36", "SET-CARD60")
  - category: 상품코드로 알 수 있는 간결한 품목명 (예: DDLP/DDL/RK/RQ -> "김치냉장고", RM/RF -> "냉장고", FG/W2 -> "워시타워/세탁건조기", SET-CARD는 "")
  - quantity: '수량' 열 정수 (예: 1)
  - receiptAmount: '접수금액' 열 원 단위 정수 (콤마 제외, 예: 1190000)
  - discountAmount: '에누리' 열 원 단위 정수 (없거나 0이면 0)
  - actualPrice: '실구매가' 열 원 단위 정수 (콤마 제외, 예: 1190000)
  - deliveryDate: '배달일자' 열 날짜 (YYYY-MM-DD, 예: "2026-11-26", 비어 있으면 "")
  - deliveryTime: '시간' 열 텍스트 (예: "오후FT", 비어 있으면 "")
  - outboundPlace: '출고지' 열 텍스트 정확히 (예: "자송", "타사물류", "중앙물류", "지역물류")
  - directDelivery: '직배' 열 텍스트 정확히 (예: "타사직배", 비어 있으면 "")
  - cancelDate: '취소일자' 열에 날짜가 적혀 있으면 그 텍스트, 비어 있으면 ""

[4. 하단 '[결제]' 영역 금액 추출 규칙 (매우 중요 — 구독 월요금 산출 기준)]
- 품목 그리드 아래쪽 좌측 세로 헤더 '결제' 영역에서 다음 3개 금액을 숫자로 정확히 읽으세요 (원 단위 정수, 콤마 제외):
  - paymentReceiptTotal: 하단 '결제' 블록 1행 1열 '접수금액' 우측 금액 (예: 1,190,000 -> 1190000)
  - paymentActualTotal: 하단 '결제' 블록 2행 1열 '실구매가' 우측 금액 (예: 1,190,000 -> 1190000)
  - paymentCreditCard: 하단 '결제' 블록 1행 2열(바로 오른쪽 열) '신용카드' 칸 우측 금액 (예: 1,190,000 -> 1190000). 구독 전표의 실제 월 구독료 산출 기준이므로 한 자리도 틀리지 말고 정확히 읽으세요!
- 보조 규칙 (가접수/외상 전표): 만약 가접수/외상 상태라 '결제' 영역의 '신용카드'가 0으로 표시되어 있고 최하단 '외상' 영역의 '카드접수'(또는 '카드수금')에 금액이 찍혀 있다면 그 금액을 paymentCreditCard로 추출하세요.`;

export const HISIS_SLIP_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    receiptDate: { type: Type.STRING },
    receiptSeq: { type: Type.STRING },
    quoteNumberIgnore: { type: Type.STRING },
    saleTypeHeader: { type: Type.STRING },
    customerName: { type: Type.STRING },
    customerMobile: { type: Type.STRING },
    customerPhone: { type: Type.STRING },
    customerRoadAddress: { type: Type.STRING },
    recipientName: { type: Type.STRING },
    recipientMobile: { type: Type.STRING },
    recipientPhone: { type: Type.STRING },
    shippingRoadAddress: { type: Type.STRING },
    customerRequest: { type: Type.STRING },
    logisticsVendor: { type: Type.STRING },
    paymentCreditCard: { type: Type.INTEGER },
    paymentReceiptTotal: { type: Type.INTEGER },
    paymentActualTotal: { type: Type.INTEGER },
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          seq: { type: Type.STRING },
          productCode: { type: Type.STRING },
          category: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
          receiptAmount: { type: Type.INTEGER },
          discountAmount: { type: Type.INTEGER },
          actualPrice: { type: Type.INTEGER },
          deliveryDate: { type: Type.STRING },
          deliveryTime: { type: Type.STRING },
          outboundPlace: { type: Type.STRING },
          directDelivery: { type: Type.STRING },
          cancelDate: { type: Type.STRING },
        },
        required: ['productCode', 'quantity', 'receiptAmount', 'actualPrice'],
      },
    },
  },
  required: ['receiptDate', 'receiptSeq', 'rows'],
};

/**
 * HISIS v3 [판매접수등록] 전산 화면 사진 AI 판독
 * (서버 우선 호출 -> GitHub Pages 등 정적 환경에서는 브라우저 직접 @google/genai 호출 Fallback)
 */
export async function parseHisisSlipImageWithFallback(
  file: File,
  explicitApiKey?: string
): Promise<ParsedHisisSlipResult> {
  const compressed = await compressImageFile(file, 1920, 0.88);
  const storedKey = explicitApiKey?.trim() || getStoredGeminiApiKey();

  // 1차 시도: 백엔드 /api/ai/parse-hisis-slip 호출
  try {
    const response = await fetch('/api/ai/parse-hisis-slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        apiKey: storedKey || undefined,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const rawPayload = (json && (json.raw || json.data || json)) as RawHisisSlipAiPayload;
      if (rawPayload && Array.isArray(rawPayload.rows)) {
        return normalizeHisisSlipPayload(rawPayload);
      }
    }
  } catch (serverErr) {
    console.warn(
      '서버 HISIS 전표 판독 실패, 프론트엔드 직접 호출로 전환합니다:',
      serverErr
    );
  }

  // 2차 시도(Fallback): 프론트엔드에서 직접 @google/genai SDK 호출 (GitHub Pages 완벽 지원)
  const apiKey = getEffectiveGeminiApiKey(storedKey);
  if (!apiKey) {
    throw new Error(
      'Gemini API 키가 설정되어 있지 않습니다. 모달 상단 키 입력칸 또는 [🔑 AI 키 설정]에서 API 키를 입력해 주세요.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  let responseText = '';
  let lastError: unknown = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: compressed.mimeType,
                data: compressed.base64,
              },
            },
            { text: HISIS_SLIP_PROMPT_TEXT },
          ],
        },
        config: buildGeminiFastConfig(modelName, {
          responseMimeType: 'application/json',
          responseSchema: HISIS_SLIP_RESPONSE_SCHEMA,
        }),
      });
      if (response.text) {
        responseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!responseText) {
    throw (
      lastError ||
      new Error('HISIS 전표 이미지 AI 판독 응답을 가져오지 못했습니다.')
    );
  }

  const parsedRaw = JSON.parse(responseText) as RawHisisSlipAiPayload;
  return normalizeHisisSlipPayload(parsedRaw);
}

export interface HisisBatchQueueProgress {
  index: number;
  completedCount: number;
  totalCount: number;
  result?: ParsedHisisSlipResult;
  error?: string;
}

/**
 * 여러 장의 HISIS 전표 사진을 동시 최대 concurrency(기본 3장) 병렬 워커 큐로 고속 판독합니다.
 */
export async function parseHisisSlipBatchWithConcurrency(
  files: File[],
  options: {
    concurrency?: number;
    apiKey?: string;
    onItemStart?: (index: number) => void;
    onItemFinish?: (progress: HisisBatchQueueProgress) => void;
  } = {}
): Promise<
  {
    index: number;
    result?: ParsedHisisSlipResult;
    error?: string;
  }[]
> {
  const totalCount = files.length;
  if (totalCount === 0) return [];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 5));

  const outputs: {
    index: number;
    result?: ParsedHisisSlipResult;
    error?: string;
  }[] = new Array(totalCount);

  let cursor = 0;
  let completedCount = 0;

  const worker = async () => {
    while (true) {
      const currentIdx = cursor;
      cursor += 1;
      if (currentIdx >= totalCount) break;

      options.onItemStart?.(currentIdx);
      try {
        const result = await parseHisisSlipImageWithFallback(
          files[currentIdx],
          options.apiKey
        );
        completedCount += 1;
        outputs[currentIdx] = { index: currentIdx, result };
        options.onItemFinish?.({
          index: currentIdx,
          completedCount,
          totalCount,
          result,
        });
      } catch (err: any) {
        completedCount += 1;
        const errMsg =
          err instanceof Error
            ? err.message
            : '전표 판독 중 오류가 발생했습니다.';
        outputs[currentIdx] = { index: currentIdx, error: errMsg };
        options.onItemFinish?.({
          index: currentIdx,
          completedCount,
          totalCount,
          error: errMsg,
        });
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, totalCount) },
    () => worker()
  );
  await Promise.all(workers);
  return outputs;
}
