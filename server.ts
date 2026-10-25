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

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.');
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

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.post('/api/ai/parse-image', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
        return;
      }

      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const resolvedMimeType =
        mimeType ||
        (imageBase64.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : imageBase64.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/png');

      const ai = getGenAIClient();

      const promptText = `당신은 롯데하이마트 가전 구독 전산 화면(상담 화면, 견적서, 태블릿/PC 모니터 촬영본, 캡처 이미지)을 분석하는 전문 AI입니다.
업로드된 전산 화면 이미지에서 가전 구독 상품 정보들을 정확히 추출하여 JSON으로 반환하세요.

[추출 규칙]
1. 품목(items): 화면에 표시된 모든 구독 가전 품목을 배열로 추출하세요.
   - category: 품목명 (예: "냉장고", "김치냉장고", "세탁기", "건조기", "워시타워", "에어컨", "TV", "청소기", "정수기", "식기세척기", "의류관리기" 등)
   - modelName: 모델명 영문/숫자 코드 (예: "RF85C9001AP", "FQ18ETNBN2", "OLED65C4KNA" 등. 보이지 않으면 품목 상세명 기재)
   - monthlyFee: 월 기본 구독료(원 단위 숫자, 할인 전 기본 월 구독료 또는 표시된 월 구독료. 콤마 제외 정수)
   - period: 구독 개월수 (36 또는 60 중 하나. 3년/36개월이면 36, 5년/60개월이면 60, 명시 없으면 60)
   - careService: 케어서비스 주기/횟수/유형 (예: "안심케어5 (무상수리 5년)", "안심케어3", "정기케어3", "방문케어 12개월 주기", "자가관리" 등 화면에 적힌 케어 관련 문구 그대로 추출)
   - extraCashback: 추가 캐시백 또는 사은품/할인 금액이 명시되어 있으면 원 단위 숫자(없으면 0)
2. 무상 A/S 보증기간 판별(warrantyYears):
   - 업로드된 자료나 케어서비스 항목에 '3년', '안심케어3', '정기케어3' 중 하나라도 포함되어 있으면 반드시 warrantyYears를 3으로 설정하세요.
   - 위 키워드('3년', '안심케어3', '정기케어3')가 없으면 warrantyYears를 5(5년 무상 A/S)로 설정하세요.
3. 올케어 여부(allCare):
   - 자료에 '올케어' 또는 '사용중 가전 수리비 보증' 관련 텍스트가 포함되어 있으면 true, 없으면 false로 설정하세요.
4. 선납금은 취급하지 않으므로 추출하지 마세요.`;

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
                  description: '품목명 (예: 냉장고, 세탁기, 에어컨, TV 등)',
                },
                modelName: {
                  type: Type.STRING,
                  description: '모델명 코드',
                },
                monthlyFee: {
                  type: Type.INTEGER,
                  description: '월 구독료 (원 단위 정수)',
                },
                period: {
                  type: Type.INTEGER,
                  description: '구독 기간 개월수 (36 또는 60)',
                },
                careService: {
                  type: Type.STRING,
                  description: '케어서비스 주기/횟수/종류 텍스트',
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
                'extraCashback',
              ],
            },
          },
          hasThreeYearKeyword: {
            type: Type.BOOLEAN,
            description:
              "업로드된 자료에 '3년', '안심케어3', '정기케어3' 문구가 존재하는지 여부",
          },
          warrantyYears: {
            type: Type.INTEGER,
            description: '무상 A/S 기간 (3 또는 5)',
          },
          allCare: {
            type: Type.BOOLEAN,
            description: '올케어(사용중 가전 2년 수리비 보증) 포함 여부',
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

      const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let responseText: string | undefined;
      let lastError: unknown;

      for (const modelName of candidateModels) {
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

      // Deterministic rule verification for '3년', '안심케어3', '정기케어3'
      const combinedCareText = [
        parsed.detectedTextSummary || '',
        ...(Array.isArray(parsed.items)
          ? parsed.items.map((it: { careService?: string }) => it.careService || '')
          : []),
      ].join(' ');

      const has3Yr =
        Boolean(parsed.hasThreeYearKeyword) ||
        combinedCareText.includes('3년') ||
        combinedCareText.includes('안심케어3') ||
        combinedCareText.includes('정기케어3');

      const warrantyYears: 3 | 5 = has3Yr ? 3 : 5;
      const hasAllCare =
        Boolean(parsed.allCare) || combinedCareText.includes('올케어');

      const normalizedItems = Array.isArray(parsed.items) && parsed.items.length > 0
        ? parsed.items.map((item: {
            category?: string;
            modelName?: string;
            monthlyFee?: number;
            period?: number;
            careService?: string;
            extraCashback?: number;
          }) => ({
            category: item.category || '가전품목',
            modelName: item.modelName || '-',
            monthlyFee: Math.max(0, Number(item.monthlyFee) || 0),
            period: Number(item.period) === 36 ? 36 : 60,
            careService: item.careService || (warrantyYears === 3 ? '안심케어3 (3년 무상A/S)' : '안심케어5 (5년 무상A/S)'),
            extraCashback: Math.max(0, Number(item.extraCashback) || 0),
          }))
        : [];

      res.json({
        items: normalizedItems,
        warrantyYears,
        hasThreeYearKeyword: has3Yr,
        allCare: hasAllCare,
        detectedTextSummary: parsed.detectedTextSummary || '',
      });
    } catch (error: unknown) {
      console.error('AI image parse error:', error);
      const message =
        error instanceof Error
          ? error.message
          : '전산 이미지 AI 분석 중 오류가 발생했습니다.';
      res.status(500).json({ error: message });
    }
  });

  // 구독 POP 자동 출력기 전용 엔드포인트
  app.post('/api/ai/parse-pop-image', async (req, res) => {
    try {
      const { image, mimeType = 'image/jpeg', apiKey: clientApiKey } = req.body;
      if (!image) {
        res.status(400).json({ success: false, error: '이미지 데이터가 전달되지 않았습니다.' });
        return;
      }

      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ success: false, error: 'Gemini API 키가 설정되지 않았습니다.' });
        return;
      }

      const cleanBase64 = image.includes('base64,')
        ? image.split('base64,')[1]
        : image;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `당신은 가전제품 구독/렌탈 견적서 및 POS 화면 이미지 분석 전문가입니다.
사용자가 업로드한 화면 캡처 또는 사진에서 다음 구독 POP 제작에 필요한 핵심 정보들을 정확하게 추출하세요.

[필드 추출 가이드]
1. category (품목): 가전제품 품목명 (예: 전기밥솥, 냉장고, 김치냉장고, 세탁기, 건조기, 에어컨, 정수기, TV, 청소기, 공기청정기 등). 상품명에서 품목을 알 수 있다면 정확한 품목명만 간결하게 추출 (예: '쿠쿠전자 트윈프레셔압력 전기밥솥'이면 '전기밥솥').
2. modelName (제품 모델명): 정확한 모델명/모델코드 (예: CRP-PHFFTR0620FGW, WF24B9600KP 등).
3. productName (상품 전체 이름): 상품명 풀네임 (예: 쿠쿠전자 트윈프레셔압력 전기밥솥).
4. monthlyFee (월 구독료): 정기 월 구독료/월 납부요금 (숫자 정수). 제휴카드 할인 전 기본 월 구독료 또는 화면에 '월 납부요금', '월 구독료', '월 렌탈료'로 적힌 대표 금액 (예: 약 18,094원이면 18094).
5. period (구독기간): 구독 개월 수 정수 숫자 (예: 36, 48, 60 등).
6. downPayment (계약금/선납금): 초기 납부금/계약금 (숫자, 없거나 0원이면 0).
7. careServiceText (케어서비스): 케어 패키지 또는 서비스 명칭 (예: 안심케어_1, 셀프케어 등). 이미지에 '3년', '5년', '안심케어3', '정기케어3' 등 무상 A/S 보증기간 관련 문구가 있다면 반드시 원문 그대로 포함할 것.
8. careServiceCycle (방문/배송주기): 케어 주기 (예: 12/24개월, 3개월 등).
9. careServiceCount (제공횟수): 케어 제공 횟수 (예: 2회 등).
10. careServiceDetail (보증/서비스상세): 보장 서비스 및 세부 내용 (예: AS연장보험, 고무패킹 정기배송 등). 이미지에 '3년', '5년', '안심케어3', '정기케어3' 등 무상 A/S 보증기간 관련 문구가 있다면 반드시 원문 그대로 포함할 것.
11. isAllCare (올케어 여부): 이미지에 '올케어', 'allcare', '사용중 가전 보증', '2년 수리비 보증' 등이 포함되어 있으면 true, 아니면 false.`;

      let responseText = '';
      const modelsToTry = [req.body.model, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'].filter(Boolean);
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
                  category: { type: Type.STRING, description: '품목명 (예: 전기밥솥, 냉장고)' },
                  modelName: { type: Type.STRING, description: '제품 모델명 코드' },
                  productName: { type: Type.STRING, description: '상품 풀네임' },
                  monthlyFee: { type: Type.INTEGER, description: '월 구독료 (숫자)' },
                  period: { type: Type.INTEGER, description: '구독 개월수 (숫자)' },
                  downPayment: { type: Type.INTEGER, description: '계약금/초기비용 (숫자, 없으면 0)' },
                  careServiceText: { type: Type.STRING, description: '케어서비스 명칭' },
                  careServiceCycle: { type: Type.STRING, description: '케어 주기' },
                  careServiceCount: { type: Type.STRING, description: '케어 횟수' },
                  careServiceDetail: { type: Type.STRING, description: '보증 및 케어 상세' },
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
