import * as XLSX from 'xlsx';
import { ProductData } from './types';

// 다양한 엑셀 헤더 이름을 유연하게 인식하기 위한 별칭(Alias) 사전
const HEADER_ALIASES = {
  modelName: ['모델명', '모델', '제품명', '상품명', '모델번호', 'model', '품명', '상품코드'],
  monthlyFee: ['월 구독료', '구독료', '월구독료', '렌탈료', '월렌탈료', '요금', '월요금', '가격', '금액', '월납입금'],
  downPayment: ['계약금', '구독계약금', '초기비용', '가입비', '등록비'],
  period: ['구독 개월 수', '구독 개월수', '구독개월', '개월수', '구독기간', '기간', '약정기간', '약정', '렌탈기간', '개월'],
  category: ['품목명', '품목 명', '품목', '품명', '가전품목', '제품품목', '카테고리', '대분류', '중분류', '소분류', '분류', '종류', '제품군', '품목/상품', '가전구분', '품목구분'],
  careServiceText: ['안심케어1', '정기케어1', '구독패키지', '패키지', '서비스명', '케어명', '서비스', '케어', '관리'],
  careServiceCycle: ['안심케어2', '정기케어2', '주기', '방문주기', '관리주기', '케어주기'],
  careServiceCount: ['횟수', '회수', '방문횟수', '제공횟수'], // 횟수를 명확하게 찾기 위해 안심케어3 제외
  careServiceBenefit: ['안심케어3', '정기케어3', '혜택', '가치', '상당', '금액상당'], // "27만원 상당" 같은 텍스트가 있는 곳
  careServiceDetail: ['안심케어4', '정기케어4', '보증기간', '상세', '서비스내용', '내용']
};

/**
 * 맥OS/윈도우/iOS 유니코드 차이(NFD/NFC) 및 공백/특수문자를 무시하고 '올케어' 여부를 정밀 판별
 */
export function isAllCareText(text: any): boolean {
  if (!text) return false;
  try {
    const raw = text.toString();
    // NFC 정규화 및 NFD 분리된 자음/모음도 모두 검사
    const nfc = raw.normalize('NFC').replace(/[\s\-_[\]()（）<>【】·,.]+/g, '').toLowerCase();
    if (nfc.includes('올케어') || nfc.includes('allcare')) {
      return true;
    }
    // 자모 분리 상태(NFD) 직접 정규식 체크: ㅇ(110b) ㅗ(1169) ㄹ(11af) ㅋ(110f) ㅔ(1166) ㅇ(110b) ㅓ(1165)
    if (/[\u110b\u3147][\u1169\u3157][\u11af\u3139][\u110f\u314b][\u1166\u3154][\u110b\u3147][\u1165\u3153]/.test(raw)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function findColumnIndex(headers: string[], aliases: string[], excludeTokens: string[] = []): number {
  const normalizedHeaders = headers.map(h => h?.toString().replace(/\s+/g, '').toLowerCase() || '');
  const normalizedAliases = aliases.map(a => a.replace(/\s+/g, '').toLowerCase());
  
  // 1. 정확히 일치하는 헤더를 가장 먼저 찾음 (우선순위 최고)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (normalizedAliases.includes(normalizedHeaders[i])) {
      return i;
    }
  }

  // 2. 정확히 일치하는 것이 없다면, 포함(부분 일치)되는 헤더를 찾음
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    
    // 오작동 방지: 특정 단어가 포함된 열은 무시 (예: 구독료 찾을 때 '개월수'가 들어간 열은 제외)
    if (excludeTokens.some(ex => header.includes(ex))) {
      continue;
    }
    
    if (normalizedAliases.some(alias => header.includes(alias))) {
      return i;
    }
  }
  return -1;
}

export function parseExcel(file: File): Promise<ProductData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // 엑셀에서 헤더(제목) 줄 찾기: 모델명과 관련된 단어가 있는 줄을 유연하게 찾음
        let headerRowIndex = -1;
        let colIndices: Record<string, number> = {};

        for (let i = 0; i < Math.min(rows.length, 20); i++) { // 상위 20줄 이내에서 제목 줄 탐색
          const row = rows[i] || [];
          const headers = row.map(h => h ? h.toString() : '');
          
          const modelIdx = findColumnIndex(headers, HEADER_ALIASES.modelName);
          const feeIdx = findColumnIndex(headers, HEADER_ALIASES.monthlyFee, ['개월']); // '개월'이라는 글자가 들어간 열은 구독료로 인식하지 않음

          // 최소한 모델명과 가격 정보가 있는 줄을 헤더로 간주
          if (modelIdx !== -1 && feeIdx !== -1) {
            headerRowIndex = i;
            colIndices = {
              modelName: modelIdx,
              monthlyFee: feeIdx,
              downPayment: findColumnIndex(headers, HEADER_ALIASES.downPayment),
              period: findColumnIndex(headers, HEADER_ALIASES.period),
              category: findColumnIndex(headers, HEADER_ALIASES.category),
              careServiceText: findColumnIndex(headers, HEADER_ALIASES.careServiceText),
              careServiceCycle: findColumnIndex(headers, HEADER_ALIASES.careServiceCycle),
              careServiceCount: findColumnIndex(headers, HEADER_ALIASES.careServiceCount),
              careServiceBenefit: findColumnIndex(headers, HEADER_ALIASES.careServiceBenefit),
              careServiceDetail: findColumnIndex(headers, HEADER_ALIASES.careServiceDetail),
            };
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('엑셀 파일에서 "제품명(모델명)"과 "가격(구독료)" 항목을 찾을 수 없습니다.');
        }

        // 올케어 여부 감지 (파일명, 시트명, 헤더 행 이전 상단 제목줄만 검사)
        const fileNameHasAllCare = isAllCareText(file.name);
        const sheetNameHasAllCare = (workbook.SheetNames || []).some(s => isAllCareText(s));
        let titleRowHasAllCare = false;
        for (let i = 0; i < headerRowIndex; i++) {
          const row = rows[i] || [];
          if (row.some((cell: any) => isAllCareText(cell))) {
            titleRowHasAllCare = true;
            break;
          }
        }
        const fileHasAllCare = fileNameHasAllCare || sheetNameHasAllCare || titleRowHasAllCare;

        const products: ProductData[] = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const modelName = row[colIndices.modelName]?.toString().trim();
          if (!modelName) continue;

          // 숫자, 소수점 처리 (예: 31413.055 -> 31413)
          const rawFee = row[colIndices.monthlyFee]?.toString() || '0';
          const monthlyFee = Math.floor(parseFloat(rawFee.replace(/,/g, '').replace(/[^0-9.-]/g, ''))) || 0;
          
          if (monthlyFee <= 0) continue; // 구독료가 0원이면 제외

          const rawPeriod = colIndices.period !== -1 ? (row[colIndices.period]?.toString() || '') : '';
          const period = parseInt(rawPeriod.replace(/[^0-9]/g, '')) || 0;

          const rawDown = colIndices.downPayment !== -1 ? (row[colIndices.downPayment]?.toString() || '0') : '0';
          const downPayment = Math.floor(parseFloat(rawDown.replace(/,/g, '').replace(/[^0-9.-]/g, ''))) || 0;
          
          const rawRowText = row.map((cell: any) => cell ? cell.toString() : '').join(' ');
          const rowHasAllCare = isAllCareText(rawRowText) ||
                                isAllCareText(modelName) ||
                                (colIndices.category !== -1 && isAllCareText(row[colIndices.category])) ||
                                (colIndices.careServiceText !== -1 && isAllCareText(row[colIndices.careServiceText])) ||
                                (colIndices.careServiceDetail !== -1 && isAllCareText(row[colIndices.careServiceDetail]));
          const isAllCare = fileHasAllCare || rowHasAllCare;

          products.push({
            id: crypto.randomUUID(),
            category: colIndices.category !== -1 ? (row[colIndices.category]?.toString() || '') : '',
            modelName,
            period,
            monthlyFee,
            downPayment,
            careServiceText: colIndices.careServiceText !== -1 ? (row[colIndices.careServiceText]?.toString() || '') : '',
            careServiceCycle: colIndices.careServiceCycle !== -1 ? (row[colIndices.careServiceCycle]?.toString() || '') : '',
            careServiceCount: colIndices.careServiceCount !== -1 ? (row[colIndices.careServiceCount]?.toString() || '') : '',
            careServiceBenefit: colIndices.careServiceBenefit !== -1 ? (row[colIndices.careServiceBenefit]?.toString() || '') : '',
            careServiceDetail: colIndices.careServiceDetail !== -1 ? (row[colIndices.careServiceDetail]?.toString() || '') : '',
            imageUrl: '',
            changeStatus: 'new',
            rawRowText,
            isAllCare
          });
        }

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}
