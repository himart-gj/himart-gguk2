import { CustomerItem } from '../types/crm';
import { ParsedQuotation } from './quotationLoader';

export const GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Retrieve Gemini API key from localStorage or Vite environment variable.
 */
export function getGeminiApiKey(): string {
  try {
    const local = localStorage.getItem('gemini_api_key');
    if (local && local.trim()) return local.trim();
  } catch (e) {
    // Ignore localStorage access issues
  }
  return ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || '';
}

export function setGeminiApiKey(key: string): void {
  try {
    if (key && key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  } catch (e) {
    console.warn('Failed to save Gemini API key', e);
  }
}

/**
 * Direct client-side call to Gemini 3.8 Flash (100% compatible with static hosting / GitHub Pages)
 */
export async function callGeminiFlash38(
  promptText: string,
  images?: Array<{ mimeType: string; base64: string }>
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API 키가 등록되지 않았습니다. 우측 상단 [설정]에서 API 키를 입력해주세요.');
  }

  const parts: any[] = [{ text: promptText }];
  if (images && images.length > 0) {
    images.forEach((img) => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    });
  }

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.error?.message || `HTTP ${response.status}: API 호출 실패`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini AI 응답이 비어있습니다.');
  }
  return text;
}

/**
 * Intelligent quotation extraction with Gemini 3.8 Flash
 */
export async function extractQuotationWithGemini(
  customer: CustomerItem
): Promise<ParsedQuotation | null> {
  try {
    const prompt = `당신은 롯데하이마트 경기광주점의 1급 가전 견적 전문가이자 AI 영업 비서입니다.
고객 CRM 상담/예약/배송 내역을 분석하여, 하이마트 견적 계산기(Sheet 1~6)의 각 입력 양식에 100% 오차 없이 정확히 채울 수 있는 정밀 구조화 JSON 객체를 만들어주세요.

[고객 CRM 내역]
- 성명: ${customer.name || '고객님'}
- 연락처: ${customer.phone || ''}
- 예약구분: ${customer.category || ''} ${customer.service || ''}
- 접수일자/전표: ${customer.slipNo || customer.date || ''}
- 상담 품목 및 상세: ${customer.items || ''}
- 결제금액: ${customer.paidAmount || ''}
- 체감가: ${customer.netAmount || ''}
- 적용혜택/제휴카드: ${customer.benefit || ''}
- 상담 메모 및 특이사항: ${customer.note || ''}
- 배송희망일: ${customer.deliveryDate || ''}
- 구글문서 링크: ${customer.docUrl || ''}

[하이마트 계산기 입력 양식 규격 (반드시 이 JSON 필드 구조 준수)]
{
  "customerType": "일반" | "이사" | "입주" | "웨딩",
  "mode": "lump" | "sub",
  "name": "고객 성명",
  "phone": "010-XXXX-XXXX",
  "manager": "담당자 성함",
  "slipNo": "전표번호 또는 상담일자",
  "items": [
    {
      "name": "품목명(예: 삼성 비스포크 4도어 냉장고, OLED 77형 TV, 워시타워 등)",
      "model": "영문+숫자 모델코드(알 수 없으면 빈 문자열)",
      "qty": 1,
      "price": 판매가(숫자, 구독이면 월 정상구독료),
      "months": "0" | "36" | "60"
    }
  ],
  "lumpCard": "삼성 제휴" | "우리 제휴" | "롯데 제휴" | "신한 제휴" | "일반 신용/체크" | "미정(상담안함)",
  "lumpDc": 즉시할인액(숫자),
  "lumpPtTot": 적립포인트(숫자),
  "lumpPtUse": 포인트즉시사용액(숫자),
  "lumpCash": 추가캐시백(숫자),
  "subCardCorp": "woori" | "samsung" | "lotte" | "shinhan" | "none",
  "subCardTier": 구독제휴카드할인액(숫자),
  "hiFreed": { "enabled": boolean, "val": "75" | "150" | "225" | "300", "cnt": number },
  "customerMemo": "고객용 안내문",
  "internalMemo": "내부용 참고메모"
}

반드시 백틱(\`\`\`) 없이 순수 JSON만 반환하세요.`;

    // 1. Try direct client-side call if API key exists
    const apiKey = getGeminiApiKey();
    if (apiKey) {
      const responseText = await callGeminiFlash38(prompt);
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson) as ParsedQuotation;
    }

    // 2. Try server-side endpoint if available in local Node dev mode
    try {
      const resp = await fetch('/api/ai-extract-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          return json.data as ParsedQuotation;
        }
      }
    } catch (e) {
      // Static host without backend proxy, ignore
    }

    return null;
  } catch (err) {
    console.warn('Gemini 3.8 Flash quotation extraction failed, falling back to local rule parser:', err);
    return null;
  }
}
