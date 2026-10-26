import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient(clientApiKey?: string) {
  const apiKey =
    (typeof clientApiKey === 'string' && clientApiKey.trim()) ||
    process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되어 있지 않습니다. 상단 [🔑 AI 키 설정] 버튼에서 API 키를 입력해 주세요.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function inferCategoryFromModelCode(code: string, rawCategory?: string): string {
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

  if (upper.startsWith('FG') || upper.startsWith('W2') || upper.startsWith('WT')) {
    return '워시타워/세탁건조기';
  }
  if (upper.startsWith('WF') || upper.startsWith('FX') || upper.startsWith('TR')) {
    return '세탁기';
  }
  if (upper.startsWith('DV') || upper.startsWith('RD') || upper.startsWith('RH')) {
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
    upper.startsWith('QNED') ||
    upper.startsWith('75') ||
    upper.startsWith('85') ||
    upper.startsWith('65')
  ) {
    return 'TV';
  }
  if (upper.startsWith('FQ') || upper.startsWith('AF') || upper.startsWith('SQ')) {
    return '에어컨';
  }
  if (upper.startsWith('DW') || upper.startsWith('DB')) {
    return '식기세척기';
  }
  if (upper.startsWith('DF') || upper.startsWith('SC')) {
    return '의류관리기';
  }
  if (upper.startsWith('VS') || upper.startsWith('AX') || upper.startsWith('A9')) {
    return '청소기';
  }
  if (upper.startsWith('CRP') || upper.startsWith('CRT')) {
    return '전기밥솥';
  }
  return cleanedCat || '가전품목';
}

function normalizeModelCode(rawCode?: string): string {
  if (!rawCode) return '';
  let code = rawCode.trim();
  // URL 파라미터 형태(예: productId=FG24GN.AKOR2)가 그대로 들어온 경우 파싱
  const urlMatch = code.match(/(?:productId|modelCode|model|prdId|goodsNo)=([A-Za-z0-9._-]+)/i);
  if (urlMatch && urlMatch[1]) {
    code = urlMatch[1];
  }
  // .AKOR2, .AKOR 등 제조사 접미사가 있으면 제거하여 깔끔한 모델코드로 정규화
  code = code.replace(/\.(AKOR\d*|AKR\d*|KOR\d*)$/i, '');
  return code.trim();
}

function sanitizeFiveYearWarrantyText(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/3년\s*(무상|A\/?S)/gi, '5년 $1');
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. 일반구매(general) 및 혼합견적(hybrid)용 '일반전산 사진 자동입력' 엔드포인트
  app.post('/api/ai/parse-general-image', async (req, res) => {
    try {
      const { imageBase64, image, mimeType, apiKey: clientApiKey } = req.body;
      const rawImage = imageBase64 || image;

      if (!rawImage || typeof rawImage !== 'string') {
        res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
        return;
      }

      const cleanBase64 = rawImage.includes(',')
        ? rawImage.split(',')[1]
        : rawImage;
      const resolvedMimeType =
        mimeType ||
        (rawImage.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : rawImage.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/png');

      const ai = getGenAIClient(clientApiKey);

      const promptText = `당신은 롯데하이마트 세일즈툴(일반 상담내역 화면) 이미지를 분석하는 전문 AI입니다.
좌측 '선택상품 & 서비스' 표와 우측 '상세 견적 내역' 요약 박스에서 데이터를 정확히 추출하여 JSON으로 반환하세요.

[1. 좌측 '선택상품 & 서비스' 표 추출 규칙]
- '유형'이 '일반'인 실제 본품 행만 품목(items)으로 추출하세요.
- ⚠️ 절대 제외 규칙 (매우 중요):
  1) 브랜드 열이 '↳'로 표시된 행은 부가서비스이므로 절대 품목에 포함하지 마세요!
  2) 상품명에 '하이워런티_결합', '(C)HIWARRANTY', 'HIWARRANTY', '하이워런티', '연장보증', '보증연장'이 포함된 행은 반드시 제외하세요!
  3) 금액이 '0원'(0)인 행은 사은품/보증연장 부가서비스이므로 반드시 제외하세요!
- 각 본품 행에서 추출할 필드:
  - category: 품목 분류명 (예: "냉장고", "김치냉장고", "TV", "세탁건조기", "에어컨", "세탁기", "건조기", "식기세척기" 등 간결한 품목명. 상품명과 모델코드로 판단)
  - name: 표에 적힌 상품명 원문 (예: "비스포크 냉장고 4도어", "김치플러스 스탠드형", "QLED 4K TV" 등)
  - code: 상품코드 / 모델명 (예: "RM70F64M2X", "RK70F49D1A", "KU75MH80AFXKR" 등 영문+숫자 코드 정확히 추출)
  - qty: 수량 (정수, 기본 1)
  - price: 금액 / 행사가 (원 단위 정수, 콤마 제외. 예: 3520000, 1923000, 2800000)

[2. 우측 '상세 견적 내역' 박스 혜택 추출 규칙]
- totalSalePrice: 총 판매가 / 행사가 합계 (원 단위 정수, 예: 8243000)
- instantDiscount: '즉시할인 합계' (또는 모델별 즉시할인 + 다품목 즉시할인의 합계, 원 단위 양수 정수. 예: -400,000원이면 400000)
- lpointTotal: 'L.Point 합계' (예: 다품목 L.Point 등 L.Point 적립/할인 합계, 원 단위 양수 정수. 예: 150,000원이면 150000)
- tierCashback: 제휴카드/멤버스 '금액대 캐시백' (예: 롯데제휴_멤버스 350,000원이면 350000)
- extraCashback: 그 외 추가 캐시백이 별도로 있다면 원 단위 정수 (없으면 0)
- cardName: 우측 내역에 적힌 카드/결제수단 명칭 (예: "롯데제휴_멤버스", "삼성제휴", "신한제휴", "우리제휴" 등, 없으면 "")
- finalBenefitPrice: 우측 하단 빨간색 글씨 '최종 혜택가' 금액 (원 단위 정수, 예: 7343000)`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: '유형이 일반이고 금액이 0원이 아닌 실제 본품 목록 (하이워런티/↳ 행 제외)',
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: '간결한 품목명 (예: 냉장고, 김치냉장고, TV)' },
                name: { type: Type.STRING, description: '상품명 원문' },
                code: { type: Type.STRING, description: '상품코드 (예: RM70F64M2X)' },
                qty: { type: Type.INTEGER, description: '수량 (정수)' },
                price: { type: Type.INTEGER, description: '행사가 금액 (원 단위 정수)' },
              },
              required: ['category', 'name', 'code', 'qty', 'price'],
            },
          },
          totalSalePrice: { type: Type.INTEGER, description: '총 판매가 합계' },
          instantDiscount: { type: Type.INTEGER, description: '즉시할인 합계 (양수 정수)' },
          lpointTotal: { type: Type.INTEGER, description: 'L.Point 합계 (양수 정수)' },
          tierCashback: { type: Type.INTEGER, description: '제휴카드/멤버스 금액대 캐시백 (양수 정수)' },
          extraCashback: { type: Type.INTEGER, description: '기타 추가 캐시백 (양수 정수, 없으면 0)' },
          cardName: { type: Type.STRING, description: '인식된 제휴카드/결제수단명' },
          finalBenefitPrice: { type: Type.INTEGER, description: '우측 하단 빨간색 최종 혜택가 금액' },
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
      let responseText: string | undefined;
      let lastError: unknown;

      for (const modelName of GEMINI_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: resolvedMimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.1,
            },
          });
          responseText = response.text;
          if (responseText) break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!responseText) {
        throw lastError || new Error('AI 응답을 생성하지 못했습니다.');
      }

      const parsed = JSON.parse(responseText);

      // 하이워런티 / ↳ / 0원 부가서비스 행 2차 안전 필터링
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

      res.json({
        success: true,
        items: normalizedItems,
        totalSalePrice: Number(parsed.totalSalePrice) || 0,
        instantDiscount,
        lpointTotal,
        tierCashback,
        extraCashback,
        cardName: parsed.cardName || '',
        finalBenefitPrice,
      });
    } catch (error: unknown) {
      console.error('AI general image parse error:', error);
      const message =
        error instanceof Error
          ? error.message
          : '일반전산 이미지 AI 분석 중 오류가 발생했습니다.';
      res.status(500).json({ success: false, error: message });
    }
  });

  // 2. 구독구매(subscription) 및 혼합견적(hybrid)용 '구독전산 / 맞춤 구독 견적 계산기' 사진 판독 엔드포인트
  app.post('/api/ai/parse-image', async (req, res) => {
    try {
      const { imageBase64, image, mimeType, apiKey: clientApiKey } = req.body;
      const rawImage = imageBase64 || image;

      if (!rawImage || typeof rawImage !== 'string') {
        res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
        return;
      }

      const cleanBase64 = rawImage.includes(',')
        ? rawImage.split(',')[1]
        : rawImage;
      const resolvedMimeType =
        mimeType ||
        (rawImage.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : rawImage.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/png');

      const ai = getGenAIClient(clientApiKey);

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
   - 만약 '맞춤 구독 견적 계산기' 팝업/탭 화면처럼 본문에 상품명이 안 보일 경우, 화면 최상단 브라우저 주소창(URL 파라미터, 예: productId=FG24GN... 또는 =FG24GN.AKOR2)을 주의 깊게 읽어서 거기에 적힌 모델코드(예: "FG24GN")를 찾아내어 modelName / modelCode에 반드시 채워 넣으세요!
   - 모델코드(예: FG24GN -> 워시타워/세탁건조기, RM70... -> 냉장고, RK70... -> 김치냉장고, KU75... -> TV 등)를 바탕으로 category(품목명)도 함께 기입하세요.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: '전산 화면에서 인식된 구독 가전 품목 리스트',
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: '품목명 (예: 워시타워/세탁건조기, 냉장고, 세탁기, 에어컨, TV 등)',
                },
                modelName: {
                  type: Type.STRING,
                  description: '모델코드 (본문 또는 최상단 브라우저 URL의 productId= 값에서 추출, 예: FG24GN)',
                },
                monthlyFee: {
                  type: Type.INTEGER,
                  description: '하단 노란색 글씨 월 납부요금 / 기본 월 구독료 (원 단위 정수, 예: 58653)',
                },
                contractAmount: {
                  type: Type.INTEGER,
                  description: '하단 계약 금액 / 결제 금액 (원 단위 정수, 예: 2111510)',
                },
                period: {
                  type: Type.INTEGER,
                  description: '활성화된 구독 기간 개월수 버튼 값 (36 또는 60)',
                },
                careService: {
                  type: Type.STRING,
                  description: '활성화된 케어 버튼명 + 하단 케어 상세 설명 (예: 안심케어_1 (완전 분해 클리닝 / 1회, 30개월))',
                },
                warrantyType: {
                  type: Type.STRING,
                  description: '우측 상단 보장서비스 박스 텍스트 (예: AS연장보험 + 가전수리올케어)',
                },
                cardName: {
                  type: Type.STRING,
                  description: '결제카드 드롭다운 선택값 (예: 우리제휴카드(독자))',
                },
                extraCashback: {
                  type: Type.INTEGER,
                  description: '추가 캐시백 금액 (원 단위 정수, 없으면 0)',
                },
              },
              required: [
                'category',
                'modelName',
                'monthlyFee',
                'period',
                'careService',
              ],
            },
          },
          urlModelCode: {
            type: Type.STRING,
            description: '브라우저 주소창 URL 파라미터(productId= 등)에서 발견된 모델코드 (없으면 빈 문자열)',
          },
          warrantyType: {
            type: Type.STRING,
            description: '보장서비스 텍스트 (예: AS연장보험 + 가전수리올케어)',
          },
          cardName: {
            type: Type.STRING,
            description: '결제카드 드롭다운에 선택된 카드명 (예: 우리제휴카드(독자))',
          },
          contractAmount: {
            type: Type.INTEGER,
            description: '하단 검은색 요약 박스의 계약 금액 / 결제 금액 (원 단위 정수)',
          },
          hasThreeYearKeyword: {
            type: Type.BOOLEAN,
            description: "업로드된 자료에 '3년', '안심케어3', '정기케어3' 문구가 존재하는지 여부",
          },
          warrantyYears: {
            type: Type.INTEGER,
            description: '무상 A/S 기간 (3 또는 5)',
          },
          allCare: {
            type: Type.BOOLEAN,
            description: '올케어(가전수리올케어 / 사용중 가전 수리비 보증) 포함 여부',
          },
          detectedTextSummary: {
            type: Type.STRING,
            description: '인식된 주요 전산 텍스트 요약',
          },
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
      let responseText: string | undefined;
      let lastError: unknown;

      for (const modelName of GEMINI_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: resolvedMimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.1,
            },
          });
          responseText = response.text;
          if (responseText) break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!responseText) {
        throw lastError || new Error('AI 응답을 생성하지 못했습니다.');
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
                Math.max(0, Number(item.contractAmount) || 0) ||
                topContractAmount;
              const cleanCareService = sanitizeFiveYearWarrantyText(
                item.careService || '안심케어5 (5년 무상A/S)'
              );

              return {
                category: resolvedCategory,
                modelName: cleanCode || item.modelName || '',
                modelCode: cleanCode || item.modelName || '',
                monthlyFee: Math.max(0, Number(item.monthlyFee) || 0),
                contractAmount: resolvedContractAmount,
                period: Number(item.period) === 36 ? 36 : 60,
                careService: cleanCareService,
                careType: cleanCareService,
                warrantyType: resolvedWarrantyType,
                cardName: resolvedCardName,
                extraCashback: Math.max(0, Number(item.extraCashback) || 0),
              };
            })
          : [];

      res.json({
        success: true,
        items: normalizedItems,
        warrantyType: topWarrantyType || normalizedItems[0]?.warrantyType || '',
        cardName: topCardName || normalizedItems[0]?.cardName || '',
        contractAmount:
          topContractAmount || normalizedItems[0]?.contractAmount || 0,
        urlModelCode: topUrlModelCode,
        warrantyYears,
        hasThreeYearKeyword: false,
        allCare: hasAllCare,
        detectedTextSummary: sanitizeFiveYearWarrantyText(
          parsed.detectedTextSummary || ''
        ),
      });
    } catch (error: unknown) {
      console.error('AI image parse error:', error);
      const message =
        error instanceof Error
          ? error.message
          : '전산 이미지 AI 분석 중 오류가 발생했습니다.';
      res.status(500).json({ success: false, error: message });
    }
  });

  // 3. 모델코드로 품목명/상품명 조회 엔드포인트 (/api/ai/lookup-model)
  app.post('/api/ai/lookup-model', async (req, res) => {
    try {
      const { modelCode, apiKey: clientApiKey } = req.body;
      const cleanCode = normalizeModelCode(modelCode || '');
      if (!cleanCode) {
        res.status(400).json({ success: false, error: '모델코드가 전달되지 않았습니다.' });
        return;
      }

      const fallbackCategory = inferCategoryFromModelCode(cleanCode);

      try {
        const ai = getGenAIClient(clientApiKey);
        const GEMINI_MODELS = [
          'gemini-3.8-flash',
          'gemini-3.1-pro-preview',
          'gemini-3.7-flash',
          'gemini-3.5-flash',
          'gemini-flash-latest',
        ];
        for (const modelName of GEMINI_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: `가전제품 모델코드 "${cleanCode}"의 품목분류(category, 예: 워시타워/세탁건조기, 냉장고, 김치냉장고, TV, 에어컨, 세탁기, 건조기, 식기세척기 등)와 브랜드(brand), 대표 상품명(productName)을 JSON으로 답하세요.`,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    productName: { type: Type.STRING },
                  },
                  required: ['category', 'brand', 'productName'],
                },
                temperature: 0.1,
              },
            });

            if (response.text) {
              const data = JSON.parse(response.text);
              res.json({
                success: true,
                modelCode: cleanCode,
                category: inferCategoryFromModelCode(cleanCode, data.category),
                brand: data.brand || '',
                productName: data.productName || cleanCode,
              });
              return;
            }
          } catch {
            // try next model
          }
        }
      } catch {
        // AI 호출 실패 시 규칙 기반 추론 결과 반환
      }

      res.json({
        success: true,
        modelCode: cleanCode,
        category: fallbackCategory,
        brand: '',
        productName: cleanCode,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || '모델 조회 중 오류가 발생했습니다.',
      });
    }
  });

  // 4. 구독 POP 자동 출력기 전용 엔드포인트
  app.post('/api/ai/parse-pop-image', async (req, res) => {
    try {
      const { image, imageBase64, mimeType = 'image/jpeg', apiKey: clientApiKey } = req.body;
      const rawImage = image || imageBase64;
      if (!rawImage) {
        res.status(400).json({ success: false, error: '이미지 데이터가 전달되지 않았습니다.' });
        return;
      }

      const ai = getGenAIClient(clientApiKey);

      const cleanBase64 = rawImage.includes('base64,')
        ? rawImage.split('base64,')[1]
        : rawImage.includes(',')
        ? rawImage.split(',')[1]
        : rawImage;

      const prompt = `당신은 가전제품 구독/렌탈 견적서 및 하이마트 세일즈툴(맞춤 구독 견적 계산기) 화면 이미지 분석 전문가입니다.
사용자가 업로드한 화면 캡처 또는 사진에서 다음 구독 POP 제작에 필요한 핵심 정보들을 정확하게 추출하세요.
롯데하이마트 가전 구독의 무상 A/S 기간은 구독 개월수(36개월/60개월)와 상관없이 무조건 5년(5년 무상 A/S)입니다. 화면에서 36개월 버튼이 선택되어 있더라도 절대 '3년 무상 A/S'로 해석하거나 작성하지 마세요.

[필드 추출 가이드]
1. category (품목): 가전제품 품목명 (예: 워시타워/세탁건조기, 전기밥솥, 냉장고, 김치냉장고, 세탁기, 건조기, 에어컨, 정수기, TV, 청소기, 공기청정기 등).
2. modelName (제품 모델명): 정확한 모델명/모델코드 (예: FG24GN, CRP-PHFFTR0620FGW, WF24B9600KP 등). 만약 본문에 모델명이 안 보이면 화면 최상단 브라우저 주소창 URL 파라미터(예: productId=FG24GN.AKOR2)에서 모델코드를 반드시 추출할 것!
3. productName (상품 전체 이름): 상품명 풀네임.
4. monthlyFee (월 구독료): 정기 월 구독료/하단 노란색 글씨 '월 납부요금' (숫자 정수, 예: 약 58,653원이면 58653).
5. period (구독기간): 파란색 테두리로 활성화된 구독 개월 수 정수 숫자 (예: 36, 48, 60 등).
6. downPayment (계약금/선납금): 초기 납부금/계약금 (숫자, 없거나 0원이면 0).
7. careServiceText (케어서비스): 활성화된 케어 버튼명 및 설명 (예: 안심케어_1, 셀프케어 등). 무상 A/S 보증기간은 무조건 '5년 무상 A/S'로 표기하고 절대 '3년 무상 A/S'로 작성하지 말 것.
8. careServiceCycle (방문/배송주기): 케어 주기 (예: 30개월, 12/24개월, 3개월 등).
9. careServiceCount (제공횟수): 케어 제공 횟수 (예: 1회, 2회 등).
10. careServiceDetail (보증/서비스상세): 우측 상단 보장서비스 박스(예: AS연장보험 + 가전수리올케어) 및 하단 클리닝 상세 설명. (무상 A/S 기간은 무조건 5년 무상 A/S)
11. isAllCare (올케어 여부): 이미지에 '올케어', '가전수리올케어', 'allcare', '사용중 가전 보증', '2년 수리비 보증' 등이 포함되어 있으면 true, 아니면 false.`;

      let responseText = '';
      const GEMINI_MODELS = [
        'gemini-3.8-flash',
        'gemini-3.1-pro-preview',
        'gemini-3.7-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
      ];
      const modelsToTry = GEMINI_MODELS;
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: cleanBase64,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: '품목명 (예: 전기밥솥, 냉장고, 워시타워)' },
                  modelName: { type: Type.STRING, description: '제품 모델명 코드 (본문 또는 URL productId 값)' },
                  productName: { type: Type.STRING, description: '상품 풀네임' },
                  monthlyFee: { type: Type.INTEGER, description: '월 납부요금 / 월 구독료 (숫자)' },
                  period: { type: Type.INTEGER, description: '구독 개월수 (숫자)' },
                  downPayment: { type: Type.INTEGER, description: '계약금/초기비용 (숫자, 없으면 0)' },
                  careServiceText: { type: Type.STRING, description: '케어서비스 명칭' },
                  careServiceCycle: { type: Type.STRING, description: '케어 주기' },
                  careServiceCount: { type: Type.STRING, description: '케어 횟수' },
                  careServiceDetail: { type: Type.STRING, description: '보장서비스 및 케어 상세' },
                  isAllCare: { type: Type.BOOLEAN, description: '올케어 여부' },
                },
                required: ['category', 'modelName', 'monthlyFee', 'period'],
              },
            },
          });

          if (response && response.text) {
            responseText = response.text.trim();
            break;
          }
        } catch (err: any) {
          console.warn(`[AI Parse] Model ${model} failed, trying next...`, err.message);
          lastError = err;
        }
      }

      if (!responseText) {
        throw lastError || new Error('AI 분석 응답을 받지 못했습니다.');
      }

      const parsedData = JSON.parse(responseText);
      const cleanModel = normalizeModelCode(parsedData.modelName || '');
      parsedData.modelName = cleanModel || parsedData.modelName || '';
      parsedData.category = inferCategoryFromModelCode(cleanModel, parsedData.category);
      parsedData.careServiceText = sanitizeFiveYearWarrantyText(
        parsedData.careServiceText || ''
      );
      parsedData.careServiceDetail = sanitizeFiveYearWarrantyText(
        parsedData.careServiceDetail || ''
      );

      res.json({
        success: true,
        data: parsedData,
      });
    } catch (error: any) {
      console.error('[AI POP Image Parse Error]', error);
      res.status(500).json({
        success: false,
        error: error.message || '이미지 분석 중 오류가 발생했습니다.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
