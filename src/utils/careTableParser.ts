import * as XLSX from 'xlsx';

export type CareFolderKey =
  | 'cleaning'
  | 'warranty'
  | 'reform'
  | 'movein'
  | 'package'
  | 'moving';

export interface CareTableItem {
  id: string;
  sheetType: '안심케어' | '가전이사';
  folderKey: CareFolderKey;
  folderLabel: string;
  section: string;  // 하위 폴더 (예: 가전청소 일회성, 하이워런티 단독형, TV 가전이사 등)
  category: string; // 세부 품목 폴더 (예: 에어컨, 세탁기, TV 50~60인치 등)
  name: string;     // 상세 상품명/유형
  code: string;     // POS 등록 모델코드
  price: string;    // 판매가 표시 문자열
  note: string;     // 비고 / 동시구매가 / 파트너사 연락처
}

export interface CareTableDataset {
  versionTitle: string;
  updatedAt: string;
  fileName: string;
  items: CareTableItem[];
}

export const CARE_FOLDERS: {
  key: CareFolderKey;
  title: string;
  subtitle: string;
  iconEmoji: string;
  badgeClass: string;
}[] = [
  {
    key: 'cleaning',
    title: '1. 가전청소 · 케어십 · 소모품',
    subtitle: '에어컨·세탁기·냉장고·김냉·건조기·식세기 1회성/다회성(케어십) 청소 및 밥솥패킹·내솥·필터 정기배송',
    iconEmoji: '🧹',
    badgeClass: 'bg-sky-600 text-white',
  },
  {
    key: 'warranty',
    title: '2. 보증 · 파손 · 교체 · 수리보험',
    subtitle: '하이워런티 단독형, 34대 가전수리 올케어, 가전/노트북/모바일/중고폰 파손보험, 가전교체서비스',
    iconEmoji: '🛡️',
    badgeClass: 'bg-indigo-600 text-white',
  },
  {
    key: 'reform',
    title: '3. 맞춤 수납장 · 무타공TV · 배관 · 창호',
    subtitle: '케이크린·닥터매직 맞춤수납장, 무타공 벽걸이TV, 보일러·수도 배관청소, 집수리 복원, 방충망·유리난간·열차단필름',
    iconEmoji: '🗄️',
    badgeClass: 'bg-teal-600 text-white',
  },
  {
    key: 'movein',
    title: '4. 입주청소 · 줄눈 · 사전점검 · 포장이사 · 홈케어',
    subtitle: '한샘·크린토피아 입주청소, 퍼펙트홈 사전점검·줄눈시공, 통인 포장이사·매트리스, 층간소음매트, 새집증후군, ADT캡스',
    iconEmoji: '🏠',
    badgeClass: 'bg-emerald-600 text-white',
  },
  {
    key: 'package',
    title: '5. 서비스할인 패키지 (PACK 코드)',
    subtitle: '나에게 딱 맞는 서비스할인 패키지 (34대 올케어 필수 + 입주청소·가전청소·배관·무타공·수납장 할인 패키지)',
    iconEmoji: '🎁',
    badgeClass: 'bg-amber-500 text-white',
  },
  {
    key: 'moving',
    title: '6. 가전이사 · 철거 · 재설치 · 거리코드',
    subtitle: 'TV 인치별·김냉·냉장고·세탁기·건조기·일반가전·에어컨 철거/설치/층간/이전, 에어컨 추가설치비, 거리코드(DISTANCE)',
    iconEmoji: '🚚',
    badgeClass: 'bg-rose-600 text-white',
  },
];

function cleanCell(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatPriceDisplay(rawPrice: any): string {
  const s = cleanCell(rawPrice);
  if (!s) return '-';
  if (/^\d+$/.test(s.replace(/,/g, ''))) {
    return Number(s.replace(/,/g, '')).toLocaleString('ko-KR') + '원';
  }
  return s;
}

function getFolderTitle(key: CareFolderKey): string {
  return CARE_FOLDERS.find((f) => f.key === key)?.title || key;
}

function sheetToA1Rows(ws: XLSX.WorkSheet): any[][] {
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  // 시트가 B1 등 A1이 아닌 셀부터 시작하더라도 무조건 A1(0행, 0열) 기준으로 열 인덱스를 고정
  range.s.r = 0;
  range.s.c = 0;
  return XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: '',
    range: XLSX.utils.encode_range(range),
  });
}

export function parseCareExcelBuffer(
  buffer: ArrayBuffer,
  fileName = '안심케어_조견표.xlsx'
): CareTableDataset {
  const wb = XLSX.read(buffer, { type: 'array' });
  const items: CareTableItem[] = [];
  let versionTitle = '■ 안심케어서비스 & 가전이사 조견표 ■';

  // 1) 시트1: 안심케어 리스트
  const sheet1Name = wb.SheetNames.find((n) => n.includes('안심케어')) || wb.SheetNames[0];
  if (sheet1Name && wb.Sheets[sheet1Name]) {
    const rows1 = sheetToA1Rows(wb.Sheets[sheet1Name]);

    for (let r = 0; r < Math.min(rows1.length, 6); r++) {
      const rowText = (rows1[r] || []).map(cleanCell).find((c) => c.includes('조견표'));
      if (rowText) {
        versionTitle = rowText;
        break;
      }
    }

    // --- Block A (Cols 1..6: B~G) ---
    let secA = '';
    let subA1 = '';
    let subA2 = '';
    for (let rIdx = 4; rIdx < rows1.length; rIdx++) {
      const r = rows1[rIdx] || [];
      const c0 = cleanCell(r[1]);
      const c1 = cleanCell(r[2]);
      const c2 = cleanCell(r[3]);
      const c3 = cleanCell(r[4]);
      const code = cleanCell(r[5]);
      const rawPrice = cleanCell(r[6]);

      if (!c0 && !c1 && !c2 && !c3 && !code && !rawPrice) continue;
      if (
        c0 === '가전청소 일회성' ||
        c0 === '가전청소 다회성(케어십)' ||
        c0 === '소모품 정기배송(케어십)' ||
        c0 === '윈도우 CARE 서비스 상품'
      ) {
        secA = c0;
        subA1 = '';
        subA2 = '';
        continue;
      }
      if (
        c0 === '대분류' ||
        c0 === '중분류' ||
        c0 === '파트너사' ||
        c0 === '담당부서' ||
        code === '모델코드' ||
        code === '상품코드' ||
        code === '단품코드'
      ) {
        continue;
      }

      if (secA === '가전청소 일회성') {
        if (c1) {
          subA1 = c1;
          subA2 = '';
        }
        if (c2) subA2 = c2;
        if (code && rawPrice) {
          const name = [subA2, c3].filter(Boolean).join(' · ') || subA1;
          items.push({
            id: `s1-a-${rIdx}-${code}`,
            sheetType: '안심케어',
            folderKey: 'cleaning',
            folderLabel: getFolderTitle('cleaning'),
            section: secA,
            category: subA1 || '가전청소',
            name,
            code,
            price: formatPriceDisplay(rawPrice),
            note: '파트너사: 케이크린 (내)8000-5337 / (외)070-7178-8444',
          });
        }
      } else if (secA) {
        if (c0) {
          subA1 = c0;
          subA2 = '';
        }
        if (c2) subA2 = c2;
        if (code && rawPrice) {
          const name = [subA2, c3].filter(Boolean).join(' · ') || subA1;
          const isWindow = secA.includes('윈도우');
          const fKey: CareFolderKey = isWindow ? 'reform' : 'cleaning';
          const partnerNote = isWindow
            ? '파트너사: 코끼리시스템 1555-0143'
            : secA.includes('소모품')
            ? '담당부서: 수리클리닝팀 (내)8000-5427, 5344'
            : '파트너사: 케이크린 (내)8000-5337 / (외)070-7178-8444';
          items.push({
            id: `s1-a-${rIdx}-${code}`,
            sheetType: '안심케어',
            folderKey: fKey,
            folderLabel: getFolderTitle(fKey),
            section: secA,
            category: subA1 || secA,
            name,
            code,
            price: formatPriceDisplay(rawPrice),
            note: partnerNote,
          });
        }
      }
    }

    // --- Block B (Cols 8..12: I~M) ---
    let secB = '';
    let subB1 = '';
    const partnerMapB: Record<string, string> = {
      '하이워런티 단독형 [하이마트케어 대체]': 'DB손해보험 1588-2355',
      '가전수리 올케어': '어드민랩 02-1588-2355',
      '가전 파손보장보험': '롯데손해보험 02-6320-4933 (자기부담금 20%)',
      '노트북 케어보험': '롯데손해보험 02-6320-4933 (연장100만+파손100만+배터리1회)',
      '모바일케어보험': '신한EZ손해보험 1544-0615 (애플 가입불가)',
      '중고 모바일파손보험': '롯데손해보험 02-6320-4933 (1년 2회 / 아이폰 가입가능)',
      '가전교체서비스': '볼트테크 코리아 1670-8884',
      '집수리 서비스': '케이크린 (내)8000-5337 / (외)070-7178-8444',
      '맞춤 수납장 01': '케이크린 1877-2242',
      '맞춤 수납장 02': '닥터매직 1644-0766 / 1644-0730',
    };

    for (let rIdx = 4; rIdx < rows1.length; rIdx++) {
      const r = rows1[rIdx] || [];
      const c0 = cleanCell(r[8]);
      const c1 = cleanCell(r[9]);
      const code = cleanCell(r[10]);
      const rawPrice = cleanCell(r[11]);
      const note = cleanCell(r[12]);

      if (!c0 && !c1 && !code && !rawPrice && !note) continue;
      if (c0 && !c1 && !code && !rawPrice && !note) {
        if (
          !c0.startsWith('[파트너사]') &&
          !c0.startsWith('●') &&
          !c0.startsWith('가입') &&
          !c0.startsWith('연장보증') &&
          !c0.startsWith('안드로이드')
        ) {
          secB = c0;
          subB1 = '';
        }
        continue;
      }
      if (
        code === '모델코드' ||
        code === '상품코드' ||
        code === '모델명' ||
        rawPrice === '판매가' ||
        rawPrice === '서비스요금' ||
        rawPrice.includes('할인가')
      ) {
        continue;
      }
      if (
        c0 === '파트너사' ||
        c0.startsWith('보험사') ||
        c0 === '보상횟수' ||
        c0 === '자기부담금' ||
        c0 === '보장한도' ||
        c0 === '보장횟수' ||
        c0.includes('보장기간') ||
        c0.includes('교체수수료') ||
        c0.includes('홈페이지')
      ) {
        continue;
      }
      if (c0 && !c0.startsWith('[DB손해보험]') && !c0.startsWith('TV, PC')) {
        subB1 = c0;
      }

      if (code && rawPrice && /\d/.test(rawPrice)) {
        const isReform = secB.includes('수납장') || secB.includes('집수리');
        const fKey: CareFolderKey = isReform ? 'reform' : 'warranty';
        const sectionTitle =
          secB === '맞춤 수납장 01'
            ? '맞춤 수납장 01 (케이크린)'
            : secB === '맞춤 수납장 02'
            ? '맞춤 수납장 02 (닥터매직)'
            : secB;

        let category = subB1 || sectionTitle;
        let itemName = [subB1, c1].filter(Boolean).join(' · ') || code;

        if (secB.includes('하이워런티')) {
          category = '하이워런티 단독형';
          itemName = `제품금액 ${note}`;
        } else if (secB.includes('파손보장')) {
          category = '가전 파손보장보험';
          itemName = `보장한도 ${note}`;
        } else if (secB.includes('가전교체')) {
          category = subB1 || '가전교체서비스';
          itemName = [c1, note].filter(Boolean).join(' · ');
        }

        const partnerInfo = partnerMapB[secB] || '';
        let extraNote = partnerInfo;
        if (note && /^\d+$/.test(note.replace(/,/g, ''))) {
          extraNote =
            `가전 동시구매할인가: ${Number(note.replace(/,/g, '')).toLocaleString('ko-KR')}원` +
            (partnerInfo ? ` | ${partnerInfo}` : '');
        } else if (
          note &&
          !secB.includes('하이워런티') &&
          !secB.includes('파손보장') &&
          !secB.includes('가전교체')
        ) {
          extraNote = [note, partnerInfo].filter(Boolean).join(' | ');
        }

        items.push({
          id: `s1-b-${rIdx}-${code}`,
          sheetType: '안심케어',
          folderKey: fKey,
          folderLabel: getFolderTitle(fKey),
          section: sectionTitle,
          category,
          name: itemName,
          code,
          price: formatPriceDisplay(rawPrice),
          note: extraNote,
        });
      }
    }

    // --- Block C (Cols 14..18: O~S) ---
    let secC = '';
    let subC1 = '';
    for (let rIdx = 4; rIdx < rows1.length; rIdx++) {
      const r = rows1[rIdx] || [];
      const c0 = cleanCell(r[14]);
      const c1 = cleanCell(r[15]);
      const code = cleanCell(r[16]);
      const rawPrice = cleanCell(r[17]);
      const note = cleanCell(r[18]);

      if (!c0 && !c1 && !code && !rawPrice && !note) continue;
      if (c0 && !c1 && !code && !rawPrice && !note) {
        if (!c0.startsWith('●')) {
          secC = c0;
          subC1 = '';
        }
        continue;
      }
      if (!code || code === '모델코드' || code === '상품코드' || code === '~' || !rawPrice || rawPrice === '판매가') {
        continue;
      }
      if (
        c0 === '파트너사' ||
        c0 === '구분' ||
        c0 === '지역' ||
        c0 === '중분류' ||
        c0.includes('3대 혜택') ||
        c0.includes('하단콘센트 색상')
      ) {
        continue;
      }
      if (c0) subC1 = c0;

      if (code && rawPrice && /\d/.test(rawPrice)) {
        const isPack = secC.includes('패키지') || code.startsWith('PACK-');
        const isReform = secC.includes('무타공') || secC.includes('보일러') || secC.includes('수도');
        const fKey: CareFolderKey = isPack ? 'package' : isReform ? 'reform' : 'movein';
        const itemName = [subC1, c1].filter((x) => x && x !== secC).join(' · ') || subC1 || secC;

        items.push({
          id: `s1-c-${rIdx}-${code}`,
          sheetType: '안심케어',
          folderKey: fKey,
          folderLabel: getFolderTitle(fKey),
          section: secC || '홈케어 서비스',
          category: subC1 || secC,
          name: itemName,
          code,
          price: formatPriceDisplay(rawPrice),
          note,
        });
      }
    }
  }

  // 2) 시트2: 가전이사 리스트
  const sheet2Name = wb.SheetNames.find((n) => n.includes('가전이사')) || wb.SheetNames[1];
  if (sheet2Name && wb.Sheets[sheet2Name]) {
    const rows2 = sheetToA1Rows(wb.Sheets[sheet2Name]);

    // --- Sheet 2 Block A (Cols 1..5: TV 가전이사 & 가전이사 거리코드) ---
    let sec2A = 'TV 가전이사';
    let sub2A1 = '';
    let sub2A2 = '';
    for (let rIdx = 5; rIdx < rows2.length; rIdx++) {
      const r = rows2[rIdx] || [];
      const c0 = cleanCell(r[1]);
      const c1 = cleanCell(r[2]);
      const c2 = cleanCell(r[3]);
      const code = cleanCell(r[4]);
      const rawPrice = cleanCell(r[5]);

      if (!c0 && !c1 && !c2 && !code && !rawPrice) continue;
      if (c0 === 'TV 가전이사' || c0 === '가전이사 거리코드') {
        sec2A = c0;
        sub2A1 = '';
        sub2A2 = '';
        continue;
      }
      if (c0 === '구분' || code === '모델코드') continue;
      if (c0 && !c1 && !c2 && !code && !rawPrice) continue;

      if (c0) {
        sub2A1 = c0;
        sub2A2 = '';
      }
      if (c1) sub2A2 = c1;

      if (code && (rawPrice !== '' || code.includes('추가'))) {
        const name = [sub2A2, c2].filter(Boolean).join(' · ') || sub2A1;
        items.push({
          id: `s2-a-${rIdx}-${code}`,
          sheetType: '가전이사',
          folderKey: 'moving',
          folderLabel: getFolderTitle('moving'),
          section: sec2A,
          category: sub2A1 || sec2A,
          name,
          code,
          price: formatPriceDisplay(rawPrice || '0'),
          note: c2 ? `유형: ${c2}` : '',
        });
      }
    }

    // --- Sheet 2 Block B (Cols 7..11: TV 외 일반가전 가전이사) ---
    let sec2B = 'TV 외 일반가전 가전이사';
    let sub2B1 = '';
    let sub2B2 = '';
    for (let rIdx = 5; rIdx < rows2.length; rIdx++) {
      const r = rows2[rIdx] || [];
      const c0 = cleanCell(r[7]);
      const c1 = cleanCell(r[8]);
      const c2 = cleanCell(r[9]);
      const code = cleanCell(r[10]);
      const rawPrice = cleanCell(r[11]);

      if (!c0 && !c1 && !c2 && !code && !rawPrice) continue;
      if (c0 === 'TV 외 일반가전 가전이사') {
        sec2B = c0;
        sub2B1 = '';
        sub2B2 = '';
        continue;
      }
      if (c0 === '구분' || code === '모델코드') continue;

      if (c0) {
        sub2B1 = c0;
        sub2B2 = '';
      }
      if (c1) sub2B2 = c1;

      if (code && rawPrice && /\d/.test(rawPrice)) {
        const name = [sub2B2, c2].filter(Boolean).join(' · ') || sub2B1;
        items.push({
          id: `s2-b-${rIdx}-${code}`,
          sheetType: '가전이사',
          folderKey: 'moving',
          folderLabel: getFolderTitle('moving'),
          section: sec2B,
          category: sub2B1 || sec2B,
          name,
          code,
          price: formatPriceDisplay(rawPrice),
          note: c2 ? `유형: ${c2}` : '',
        });
      }
    }

    // --- Sheet 2 Block C (Cols 13..19: 에어컨 가전이사 & 에어컨 추가설치비) ---
    let sec2C = '에어컨 가전이사';
    let sub2C1 = '';
    let sub2C2 = '';
    let sub2C3 = '';
    for (let rIdx = 5; rIdx < rows2.length; rIdx++) {
      const r = rows2[rIdx] || [];
      const c0 = cleanCell(r[13]);
      const c1 = cleanCell(r[14]);
      const c2 = cleanCell(r[15]);
      const c3 = cleanCell(r[16]);
      const c4 = cleanCell(r[17]);
      const code = cleanCell(r[18]);
      const rawPrice = cleanCell(r[19]);

      if (!c0 && !c1 && !c2 && !c3 && !c4 && !code && !rawPrice) continue;
      if (c0 === '에어컨 가전이사' || c0 === '에어컨 추가설치비') {
        sec2C = c0;
        sub2C1 = '';
        sub2C2 = '';
        sub2C3 = '';
        continue;
      }
      if (c0 === '구분' || code === '모델코드') continue;
      if (c0 && !c1 && !c2 && !c3 && !c4 && !code && !rawPrice) continue;

      if (c0) {
        sub2C1 = c0;
        sub2C2 = '';
        sub2C3 = '';
      }
      if (c1) {
        sub2C2 = c1;
        sub2C3 = '';
      }
      if (c2) sub2C3 = c2;

      if (code && rawPrice) {
        const parts = [sub2C2, sub2C3, c3, c4].filter(Boolean);
        const name = parts.length > 0 ? parts.join(' · ') : sub2C1;
        const category =
          sec2C === '에어컨 가전이사' && sub2C2 ? `에어컨 (${sub2C2})` : sub2C1 || sec2C;
        items.push({
          id: `s2-c-${rIdx}-${code}`,
          sheetType: '가전이사',
          folderKey: 'moving',
          folderLabel: getFolderTitle('moving'),
          section: sec2C,
          category,
          name,
          code,
          price: formatPriceDisplay(rawPrice),
          note: c4 ? `단위/유형: ${c4}` : '',
        });
      }
    }
  }

  return {
    versionTitle,
    updatedAt: new Date().toLocaleString('ko-KR'),
    fileName,
    items,
  };
}

// 로컬 영구 저장소 & 깃허브 전 직원 동기화
const STORAGE_KEY_CARE_DATASET = 'himart_care_table_dataset_v1';
const STORAGE_KEY_GH_CONFIG = 'himart_care_gh_sync_config_v1';

export interface GitHubSyncConfig {
  repo: string;   // 예: "username/repo-name"
  branch: string; // 예: "main"
  token: string;  // GitHub Personal Access Token
}

export function loadLocalCareDataset(): CareTableDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CARE_DATASET);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareTableDataset;
    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function saveLocalCareDataset(dataset: CareTableDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY_CARE_DATASET, JSON.stringify(dataset));
  } catch (e) {
    console.error(e);
  }
}

export function loadGitHubSyncConfig(): GitHubSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GH_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        repo: parsed.repo || '',
        branch: parsed.branch || 'main',
        token: parsed.token || '',
      };
    }
  } catch {
    // ignore
  }
  return { repo: '', branch: 'main', token: '' };
}

export function saveGitHubSyncConfig(config: GitHubSyncConfig): void {
  localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(config));
}

export const ADMIN_UNLOCK_STORAGE_KEY = 'himart_gj_admin_unlocked';
export const ADMIN_PIN_CODE = '462846';
export const ADMIN_MODE_CHANGED_EVENT = 'himart_gj_admin_mode_changed';

export function isAdminDevice(): boolean {
  try {
    const flag = localStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY);
    if (flag === 'true') {
      return true;
    }
    if (flag === 'false') {
      return false;
    }
    if (loadGitHubSyncConfig().token.trim().length > 0) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function setAdminDeviceUnlocked(unlocked: boolean): void {
  try {
    localStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, unlocked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(ADMIN_MODE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export async function fetchRemoteCareDataset(): Promise<CareTableDataset | null> {
  try {
    const res = await fetch(`./care-table-data.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json') || ct.includes('text')) {
        const data = (await res.json()) as CareTableDataset;
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          saveLocalCareDataset(data);
          return data;
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const resXlsx = await fetch(`./care-table.xlsx?t=${Date.now()}`, { cache: 'no-store' });
    if (resXlsx.ok) {
      const ct = resXlsx.headers.get('content-type') || '';
      if (!ct.includes('text/html')) {
        const buf = await resXlsx.arrayBuffer();
        if (buf.byteLength > 1000) {
          const parsed = parseCareExcelBuffer(buf, 'care-table.xlsx');
          if (parsed.items.length > 0) {
            saveLocalCareDataset(parsed);
            return parsed;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function publishCareDatasetToGitHub(
  dataset: CareTableDataset,
  config: GitHubSyncConfig
): Promise<{ ok: boolean; message: string }> {
  const repo = config.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const branch = config.branch.trim() || 'main';
  const token = config.token.trim();

  if (!repo || !token) {
    return {
      ok: false,
      message: '깃허브 저장소 이름(아이디/저장소명)과 토큰을 먼저 입력해 주세요.',
    };
  }

  const targetPath = 'public/care-table-data.json';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${targetPath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    let existingSha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getRes.ok) {
      const existingData = await getRes.json();
      existingSha = existingData.sha;
    }

    const jsonStr = JSON.stringify(dataset, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update monthly care table: ${dataset.versionTitle} (${dataset.fileName})`,
        content: base64Content,
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      return {
        ok: false,
        message: `깃허브 업로드 실패 (${putRes.status}): ${errJson.message || '권한 또는 브랜치명을 확인해 주세요.'}`,
      };
    }

    return {
      ok: true,
      message: '깃허브 서버에 최신 조견표가 반영되었습니다! 다른 직원들이 앱을 켜면 새 달의 조견표가 자동으로 뜹니다.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `네트워크 오류: ${err?.message || '알 수 없는 오류'}`,
    };
  }
}
