import { GoogleGenAI, Type } from '@google/genai';
import { AffiliateCardId, GeneralCardType } from '../types/proposal';

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
  const envKey =
    typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY
      ? String(process.env.GEMINI_API_KEY)
      : '';
  return envKey.trim();
}

export const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
] as const;

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
  const cleanedCat = (rawCategory || '').trim();
  if (
    cleanedCat &&
    cleanedCat !== '가전품목' &&
    cleanedCat !== '가전' &&
    cleanedCat !== '구독 가전' &&
    cleanedCat !== '구독 상품' &&
    cleanedCat !== '-'
  ) {
    return cleanedCat;
  }
  const upper = (code || '').trim().toUpperCase();
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
    upper.startsWith('RK') ||
    upper.startsWith('RQ') ||
    upper.startsWith('Z3') ||
    upper.startsWith('Z4') ||
    upper.startsWith('Z5')
  ) {
    return '김치냉장고';
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

  const GEMINI_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
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
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1,
        },
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

  const GEMINI_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
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
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1,
        },
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

          return {
            category: resolvedCategory,
            modelName: cleanCode || item.modelName || '',
            modelCode: cleanCode || item.modelName || '',
            monthlyFee: Math.max(0, Number(item.monthlyFee) || 0),
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
