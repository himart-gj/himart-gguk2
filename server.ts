import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  app.use(express.json({ limit: '10mb' }));

  // AI Quotation Extraction Endpoint
  app.post('/api/ai-extract-quote', async (req, res) => {
    try {
      const { customer } = req.body;
      if (!customer) {
        return res.status(400).json({ error: 'Customer object is required' });
      }

      const ai = new GoogleGenAI(); // automatically uses process.env.GEMINI_API_KEY

      const prompt = `당신은 롯데하이마트 경기광주점의 1급 가전 견적 전문가이자 AI 영업 비서입니다.
고객 CRM 상담/예약/배송 내역을 분석하여, 하이마트 견적 계산기(Sheet 1~6)의 각 입력 양식에 100% 오차 없이 정확히 채울 수 있는 정밀 구조화 JSON 객체를 만들어주세요.

[고객 CRM 내역]
- 성명: ${customer.name || '고객님'}
- 연락처: ${customer.phone || ''}
- 카테고리/서비스: ${customer.category || ''} ${customer.service || ''}
- 접수일자/전표: ${customer.slipNo || customer.date || ''}
- 상담 품목 및 상세: ${customer.items || ''}
- 결제금액: ${customer.paidAmount || ''}
- 체감가: ${customer.netAmount || ''}
- 적용혜택/제휴카드: ${customer.benefit || ''}
- 상담 메모 및 특이사항: ${customer.note || ''}
- 배송희망일: ${customer.deliveryDate || ''}
- 구글문서 링크: ${customer.docUrl || ''}

[하이마트 계산기 입력 양식 규격]
1. customerType: "일반" | "이사" | "입주" | "웨딩" (이사나 혼수/웨딩 키워드가 있으면 해당 분류 선택)
2. mode: "lump" (일반구매 일시불) 또는 "sub" (구독구매 월납).
   - "구독", "36개월", "60개월", "월납" 등이 언급되어 있으면 반드시 "sub", 그 외는 "lump".
3. name: 고객 성명 (예: "혼수고객님(성함미확인)" -> "혼수고객", 실제 성함이 있으면 성함)
4. phone: 010-XXXX-XXXX 형식의 전화번호
5. manager: 메모에서 "담당: [이름]" 형태를 찾아 추출 (예: "국지현", "권용진" 등)
6. slipNo: 전표번호 또는 상담일자 (예: "20260912-0024" 또는 "9/13 방문상담" 등)
7. items: 각 가전제품의 배열.
   - name: 품목명 (예: "에어컨 (스탠드/벽걸이)", "원바디 세탁건조기", "비스포크 4도어 냉장고", "TCL 75형 TV", "워시타워", "무선청소기" 등 가전 종류를 친절하고 명확하게 기재)
   - model: 모델명 (예: "AF70F19D24RRS", "WD90H25AHSN1", "RM70F64M2X", "75C7L", "PLX-RF528BG" 등 영문+숫자 모델코드가 있으면 정확히 분리)
   - qty: 수량 (숫자, 기본 1)
   - price: 금액 (숫자).
     * 일반구매(lump): 각 품목별 판매가. 총 결제금액이 주어진 경우 각 품목의 합계가 총 결제금액과 일치하도록 비중을 맞춰 분배.
     * 구독구매(sub): 카드할인 및 페이백 적용 전 기준, 각 품목의 월 정상 구독료 (숫자)
   - months: 구독일 경우 "36" 또는 "60", 일반구매일 경우 "0"
8. lumpCard: 결제 카드 ("삼성 제휴" | "우리 제휴" | "롯데 제휴" | "신한 제휴" | "일반 신용/체크" | "미정(상담안함)")
9. lumpDc: (-) 즉시 할인액 (숫자, 없으면 0)
10. lumpPtTot: 적립포인트 (숫자, 없으면 0)
11. lumpPtUse: (-) 포인트 즉시사용액 (숫자, 예: "포인트 15만 차감" -> 150000)
12. lumpCash: 추가 캐시백 (숫자, 예: "캐시백 46~61만" -> 610000)
13. subCardCorp: 구독 시 제휴카드 ("woori" | "samsung" | "lotte" | "shinhan" | "none")
14. subCardTier: 구독 카드 실적 할인금액 (숫자, 예: 우리카드 월 18,000원 -> 18000)
15. hiFreed: 상조/하이프리드 결합 { enabled: boolean, val: "75"|"150"|"225"|"300", cnt: number }
    - "프리드 1구좌", "150" 등이 있으면 enabled: true, val: "150", cnt: 1
16. customerMemo: 견적서 하단에 인쇄될 정중하고 명확한 고객 안내문 (배송일, 주요 혜택 조건, 행사 안내 등)
17. internalMemo: 담당 직원을 위한 내부 참고 메모 (담당자, 이전 비교견적 내역, 행사 재연락 일정, 구글문서 링크 등)

반드시 마크다운 백틱 없이 순수 JSON 객체만 응답하세요.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '{}';
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error('AI quotation extraction error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'AI extraction failed',
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Synchronize status/SMS with Google Apps Script
  app.post('/api/sync-sheet-status', async (req, res) => {
    try {
      const { gasUrl, customerId, name, phone, status, note } = req.body;
      const targetUrl = gasUrl || process.env.GOOGLE_GAS_URL || 'https://script.google.com/macros/s/AKfycbws7p1ZOc0LC5rg7s--QpzmHh6Tc8AZn7JgDXQKPDg0RWsmuVm0PREqyIJhorTwBu3t/exec';
      
      const payload = {
        action: 'updateStatus',
        id: customerId,
        name,
        phone,
        status: status || '발송 완료',
        note: note || '',
        timestamp: new Date().toLocaleString('ko-KR')
      };

      // Try sending to Google Apps Script
      fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      }).catch(err => {
        console.warn('Background sync to GAS failed (non-critical):', err.message);
      });

      return res.json({ success: true, message: '상태 동기화 요청이 전송되었습니다.', data: payload });
    } catch (e: any) {
      console.error('GAS sync error:', e);
      return res.status(200).json({ success: false, error: e.message });
    }
  });

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${isDev ? 'development' : 'production'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
