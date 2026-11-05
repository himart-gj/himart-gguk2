import React from 'react';
import { GoogleGenAI } from '@google/genai';
import { AffiliateCardId, extractGeneralPlanData, GeneralCardType, GeneralHiPreedCounts, GeneralPlanData, HiPlusCounts, ProposalState, QuoteMode, SUB_CARE_OPTIONS, SubscriptionPeriod } from '../types/proposal';
import { getCachedCustomers } from '../crm/services/gasApi';
import { CustomerStatus } from '../crm/types/crm';
import { formatPhoneNumber, getFridayDateStr, getOffsetDateStr, getTodayStr, isUrgentCustomer } from '../crm/utils/date';
import { buildGeminiFastConfig, GEMINI_FAST_TEXT_MODELS, getEffectiveGeminiApiKey } from '../utils/aiImageParser';
import { CareTableDataset, CareTableItem } from '../utils/careTableParser';
import { INSTALLMENT_ROW_LABELS, loadLocalInstallmentDataset } from '../utils/installmentParser';
import { MAJOR_AS_CENTERS, PLUX_AS_GROUPS } from './QuickCenterModal';
import { AiCustomerStatus, ParsedAiCommand, InstallmentSearchResult, AsSearchResultItem, CrmSearchResult, InsuranceBriefResult, FALLBACK_CARE_ITEMS, parseKoreanAmount, APPLIANCE_KEYWORDS, RESERVED_NON_NAME_WORDS, InstallmentRowLabel } from './aiCommandScheduleEngine';

// ============================================================================
// 2. 앱 내 4대 데이터베이스 통합 검색기
// ============================================================================

/**
 * (A) 안심케어 · 가전이사 조견표 검색
 */
export function searchCareTableFromCommand(
  rawText: string,
  dataset: CareTableDataset | null
): CareTableItem[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  const isCareIntent =
    /(?:안심\s*케어|클리닝|청소|분해\s*세척|세척|케어십|가전\s*이사|이전\s*설치|철거|재설치|타공|사다리차|단가|모델\s*코드|상품\s*코드|코드\s*찾아|코드\s*알려)/.test(
      text
    );

  if (!isCareIntent) return [];

  const itemsPool =
    dataset && Array.isArray(dataset.items) && dataset.items.length > 0
      ? dataset.items
      : FALLBACK_CARE_ITEMS;

  // 핵심 키워드 추출
  const keywordCandidates = [
    '벽걸이',
    '스탠드',
    '2in1',
    '투인원',
    '시스템',
    '천정형',
    '창문형',
    '에어컨',
    '통돌이',
    '드럼',
    '세탁기',
    '건조기',
    '워시타워',
    '냉장고',
    '김치냉장고',
    '비데',
    '매트리스',
    '후드',
    '주방후드',
    '공기청정기',
    '가전이사',
    '이전설치',
    '철거',
    '재설치',
    '프리미엄',
  ];

  const matchedKeywords = keywordCandidates.filter((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  // 투인원 정규화
  const normalizedKeywords = matchedKeywords.map((kw) =>
    kw === '투인원' ? '2in1' : kw === '시스템' ? '천정형' : kw
  );

  if (normalizedKeywords.length === 0) {
    return itemsPool.slice(0, 8);
  }

  const scored = itemsPool
    .map((item) => {
      const hay = `${item.sheetType} ${item.section} ${item.category} ${item.name} ${item.code} ${item.note}`.toLowerCase();
      let score = 0;
      for (const kw of normalizedKeywords) {
        if (hay.includes(kw.toLowerCase())) {
          score += 10;
        }
      }
      if (/클리닝|청소|세척/.test(text) && item.folderKey === 'cleaning') {
        score += 5;
      }
      if (/이사|이전|철거|재설치/.test(text) && item.sheetType === '가전이사') {
        score += 8;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((s) => s.item);
}

/**
 * (B) 카드 무이자 할부 조견표 검색
 */
export function searchInstallmentFromCommand(
  rawText: string
): InstallmentSearchResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  const isInstallmentIntent =
    /(?:무이자|할부|부분\s*무이자|몇\s*개월\s*무이자|\d{1,2}\s*개월\s*무이자)/.test(text);

  if (!isInstallmentIntent) return null;

  const dataset = loadLocalInstallmentDataset();

  const cardBrands = [
    '롯데',
    '삼성',
    '신한',
    '우리',
    '현대',
    '국민',
    'KB',
    '농협',
    'NH',
    '하나',
    '비씨',
    'BC',
    '광주',
    '전북',
  ];
  const matchedBrands = cardBrands.filter((b) =>
    text.toUpperCase().includes(b.toUpperCase())
  );

  // 개월 수 추출 (예: 12개월, 24개월, 36개월, 60개월 등)
  let targetMonthLabel: InstallmentRowLabel | undefined;
  const monthMatch = text.match(/(\d{1,2})\s*개월/);
  if (monthMatch) {
    const m = parseInt(monthMatch[1], 10);
    if (m === 48 || m === 60) {
      targetMonthLabel = '48/60개월(비고)';
    } else {
      const foundRow = INSTALLMENT_ROW_LABELS.find((label) =>
        label.startsWith(`${m}개월`)
      );
      if (foundRow) targetMonthLabel = foundRow;
    }
  }

  const matchedSummaries = dataset.quickSummaries.filter((qs) => {
    if (matchedBrands.length > 0) {
      return matchedBrands.some((b) =>
        qs.brandTitle
          .toUpperCase()
          .includes(b === 'KB' ? '국민' : b === 'NH' ? '농협' : b.toUpperCase())
      );
    }
    if (targetMonthLabel) {
      const mStr = targetMonthLabel.replace('(비고)', '');
      return (
        qs.freeInstallment.includes(mStr.replace('개월', '')) ||
        qs.partialInstallment.includes(mStr.replace('개월', '')) ||
        qs.subInstallment.includes(mStr.replace('개월', ''))
      );
    }
    return true;
  });

  const matchedColumns = dataset.columns
    .filter((col) => {
      if (matchedBrands.length > 0) {
        return matchedBrands.some((b) => {
          const normalizedB = b === 'KB' ? '국민' : b === 'NH' ? '농협' : b;
          return (
            col.brand.toUpperCase().includes(normalizedB.toUpperCase()) ||
            col.subName.toUpperCase().includes(normalizedB.toUpperCase())
          );
        });
      }
      if (targetMonthLabel) {
        const cell = col.rows[targetMonthLabel];
        return (
          cell &&
          (cell.kind === 'free' ||
            cell.kind === 'partial' ||
            cell.kind === 'sub-free')
        );
      }
      return true;
    })
    .map((col) => {
      const rowsToInspect: InstallmentRowLabel[] = targetMonthLabel
        ? [targetMonthLabel, '기타 안내']
        : [
            '2개월',
            '3개월',
            '5개월',
            '6개월(비고)',
            '10개월(비고)',
            '12개월(비고)',
            '24개월(비고)',
            '36개월(비고)',
            '48/60개월(비고)',
          ];

      const highlightRows = rowsToInspect
        .map((rLabel) => {
          const cell = col.rows[rLabel];
          if (!cell || cell.kind === 'interest' || cell.kind === 'disabled') {
            if (rLabel === targetMonthLabel) {
              return {
                label: rLabel,
                text: cell?.main || '무이자 불가 (일반 유이자)',
                subText: cell?.sub,
                status: cell?.kind || 'disabled',
              };
            }
            return null;
          }
          return {
            label: rLabel,
            text: cell.main,
            subText: cell.sub,
            status: cell.kind,
          };
        })
        .filter(Boolean) as {
        label: InstallmentRowLabel;
        text: string;
        subText?: string;
        status: string;
      }[];

      return { col, highlightRows };
    });

  return {
    querySummary:
      matchedBrands.length > 0
        ? `${matchedBrands.join('·')}카드 ${targetMonthLabel ? targetMonthLabel.replace('(비고)', '') + ' ' : ''}무이자 할부 조회 결과`
        : targetMonthLabel
        ? `${targetMonthLabel.replace('(비고)', '')} 무이자/부분무이자 가능 카드 조회 결과`
        : '전 카드사 무이자 할부 핵심 요약',
    targetMonthLabel,
    matchedSummaries: matchedSummaries.slice(0, 6),
    matchedColumns: matchedColumns.slice(0, 8),
  };
}

/**
 * (C) 가전 AS센터 · 플럭스(PLUX) · TCL 번호 검색
 */
export function searchAsCenterFromCommand(rawText: string): AsSearchResultItem[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  const isAsIntent =
    /(?:AS|A\/S|에이에스|서비스\s*센터|고객\s*센터|수리\s*센터|리모컨\s*페어링|리모컨\s*설정|플럭스|PLUX|하이메이드|TCL|티씨엘|쿠쿠\s*번호|쿠첸\s*번호|다이슨\s*번호|바디프랜드|세라젬|코지마)/i.test(
      text
    );

  if (!isAsIntent) return [];

  const results: AsSearchResultItem[] = [];
  const lower = text.toLowerCase();

  // 1) TCL 검색
  if (/tcl|티씨엘|리모컨|셋탑|페어링/.test(lower)) {
    results.push({
      id: 'as-tcl',
      categoryBadge: '📺 TCL TV 전담',
      title: 'TCL TV 공식 고객센터 & 전담 매니저',
      phones: [
        { label: 'TCL 고객센터', number: '1660-1870' },
        { label: 'TCL 정진수 매니저', number: '010-2230-2277' },
      ],
      description:
        '패널 3년 / 일반부품 2년 무상보증 · IPTV 통합리모컨 CEC/페어링 설정 지원',
      copyMessage:
        '[롯데하이마트 경기광주점] 📺 TCL TV A/S 및 고객센터 안내\n• TCL 공식 고객센터: 1660-1870 (패널 3년 / 일반부품 2년 무상보증)',
    });
  }

  // 2) 플럭스(PLUX) / 하이메이드 검색
  const isPluxMentioned = /플럭스|plux|하이메이드|pb|plx/i.test(text);
  for (const group of PLUX_AS_GROUPS) {
    const groupMatch =
      isPluxMentioned &&
      group.category
        .split(/[/·()\s]+/)
        .filter((w) => w.length >= 2)
        .some((w) => lower.includes(w.toLowerCase()));

    for (const entry of group.entries) {
      const entryMatch =
        groupMatch ||
        entry.partnerName.toLowerCase().includes(lower) ||
        (isPluxMentioned &&
          entry.modelsDesc
            .split(/[,/\s()]+/)
            .filter((w) => w.length >= 2)
            .some((w) => lower.includes(w.toLowerCase())));

      if (entryMatch) {
        const phoneSummary = entry.phones
          .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
          .join(' / ');
        results.push({
          id: `plux-${group.category}-${entry.partnerName}`,
          categoryBadge: `⚡ PLUX · ${group.category}`,
          title: entry.partnerName,
          phones: entry.phones,
          description: entry.modelsDesc,
          copyMessage: `[롯데하이마트 경기광주점] ⚡ 플럭스(PLUX) A/S 센터 안내\n• 품목/위탁사: ${entry.partnerName}\n• 전화번호: ${phoneSummary}\n• 대상모델: ${entry.modelsDesc}`,
        });
      }
    }
  }

  // 만약 '플럭스 AS'라고만 검색해서 세부 품목이 특정되지 않았으면 플럭스 대표 냉장고/TV/세탁기/당사서비스 노출
  if (isPluxMentioned && results.length === 0) {
    for (const group of PLUX_AS_GROUPS.slice(0, 4)) {
      const firstEntry = group.entries[0];
      if (firstEntry) {
        const phoneSummary = firstEntry.phones
          .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
          .join(' / ');
        results.push({
          id: `plux-default-${group.category}`,
          categoryBadge: `⚡ PLUX · ${group.category}`,
          title: firstEntry.partnerName,
          phones: firstEntry.phones,
          description: firstEntry.modelsDesc,
          copyMessage: `[롯데하이마트 경기광주점] ⚡ 플럭스(PLUX) A/S 안내\n• ${firstEntry.partnerName}: ${phoneSummary}`,
        });
      }
    }
  }

  // 3) 주요 대기업/브랜드 A/S 검색
  for (const major of MAJOR_AS_CENTERS) {
    const tokens = `${major.brand} ${major.keywords}`
      .split(/[\s/()·]+/)
      .filter((w) => w.length >= 2);
    const matched = tokens.some((tok) => lower.includes(tok.toLowerCase()));
    if (matched) {
      const phoneSummary = major.phones
        .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
        .join(' / ');
      results.push({
        id: `major-${major.id}`,
        categoryBadge: '🏢 주요 브랜드 공식 A/S',
        title: major.brand,
        phones: major.phones,
        description: `취급 품목: ${major.keywords}`,
        copyMessage: `[롯데하이마트 경기광주점] 🛠️ ${major.brand} 고객센터 안내\n• 대표번호: ${phoneSummary}`,
      });
    }
  }

  // AS 키워드는 있는데 특정 브랜드가 안 걸렸다면 상위 대표 센터 노출
  if (results.length === 0) {
    return MAJOR_AS_CENTERS.slice(0, 4).map((major) => {
      const phoneSummary = major.phones
        .map((p) => `${p.label ? p.label + ' ' : ''}${p.number}`)
        .join(' / ');
      return {
        id: `major-fallback-${major.id}`,
        categoryBadge: '🏢 주요 브랜드 공식 A/S',
        title: major.brand,
        phones: major.phones,
        description: `취급 품목: ${major.keywords}`,
        copyMessage: `[롯데하이마트 경기광주점] 🛠️ ${major.brand} 고객센터 안내\n• 대표번호: ${phoneSummary}`,
      };
    });
  }

  return results.slice(0, 8);
}

/**
 * (D) 기존 통합 고객관리(CRM) 고객 검색
 */
export function searchCrmCustomersFromCommand(
  rawText: string
): CrmSearchResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  // 신규 고객 저장 명령이 아닌 '조회/검색/찾기' 의도인지 판별
  const isSaveCommand = /(?:저장해|등록해|고객\s*저장|고객\s*등록)/.test(text);
  if (isSaveCommand) return null;

  const isCrmSearchIntent =
    /(?:고객\s*찾아|고객\s*검색|고객\s*조회|고객\s*보여|고객\s*알려|고객\s*누구|오늘\s*배송\s*고객|내일\s*배송\s*고객|긴급\s*고객|결제\s*완료\s*고객|상담\s*중인?\s*고객)/.test(
      text
    );

  if (!isCrmSearchIntent) return null;

  const allCustomers = getCachedCustomers().filter((c) => !c.deletedAt);

  if (/긴급\s*고객/.test(text)) {
    const urgentList = allCustomers.filter((c) => isUrgentCustomer(c));
    return {
      querySummary: `🚨 배송임박 · 미결제 긴급 고객 (${urgentList.length}명)`,
      customers: urgentList,
    };
  }

  if (/오늘\s*배송/.test(text)) {
    const today = getTodayStr();
    const list = allCustomers.filter((c) => c.deliveryDate === today);
    return {
      querySummary: `🚚 오늘(${today}) 배송 예정 고객 (${list.length}명)`,
      customers: list,
    };
  }

  if (/내일\s*배송/.test(text)) {
    const tomorrow = getOffsetDateStr(1);
    const list = allCustomers.filter((c) => c.deliveryDate === tomorrow);
    return {
      querySummary: `🚚 내일(${tomorrow}) 배송 예정 고객 (${list.length}명)`,
      customers: list,
    };
  }

  // 특정 고객 이름 또는 전화번호 뒷자리 검색
  const cleaned = text
    .replace(
      /(?:고객님|고객|찾아줘|찾아|검색해줘|검색|조회해줘|조회|보여줘|보여|알려줘|알려|누구야|누구)/g,
      ' '
    )
    .trim();

  const nameTokens = (cleaned.match(/[가-힣]{2,4}/g) || []).filter(
    (w) => !RESERVED_NON_NAME_WORDS.has(w)
  );
  const numTokens = cleaned.match(/\d{3,4}/g) || [];

  const matched = allCustomers.filter((c) => {
    const nameMatch =
      nameTokens.length > 0 &&
      nameTokens.some((tok) => (c.name || '').includes(tok));
    const phoneMatch =
      numTokens.length > 0 &&
      numTokens.some((num) => (c.phone || '').includes(num));
    if (nameTokens.length === 0 && numTokens.length === 0) return true;
    return nameMatch || phoneMatch;
  });

  const targetLabel =
    nameTokens.length > 0
      ? `'${nameTokens.join(', ')}' 고객 검색 결과 (${matched.length}명)`
      : `통합 고객관리(CRM) 조회 결과 (${matched.length}명)`;

  return {
    querySummary: targetLabel,
    customers: matched.slice(0, 10),
  };
}

/**
 * (E) 보험 청구 안내 검색
 */
export function searchInsuranceFromCommand(
  rawText: string
): InsuranceBriefResult | null {
  const text = (rawText || '').trim();
  if (!text) return null;

  if (!/(?:보험\s*청구|연장\s*보험|파손\s*보험|수리비\s*청구|보험\s*접수|롯데\s*손해\s*보험)/.test(text)) {
    return null;
  }

  return {
    title: '🛡️ 하이마트 연장보증 · 파손보험 청구 핵심 안내',
    phone: '1566-4982',
    summaryLines: [
      '• 전담 접수처: 롯데손해보험 하이마트 전담센터 (1566-4982)',
      '• 필수 준비서류: ① 수리비 영수증 ② 수리내역서(부품명·고장원인 기재) ③ 통장사본',
      '• 접수 절차: 공식 제조사(삼성/LG 등) A/S 기사 방문 수리 및 결제 후 서류 발급 ➔ 전용 URL 또는 콜센터 접수',
    ],
    copyText:
      '[롯데하이마트 경기광주점] 🛡️ 가전 보험 청구 안내\n• 전담 콜센터: 1566-4982 (롯데손해보험)\n• 준비서류: 수리비 영수증, 수리내역서(고장원인/수리부품 명시), 본인 통장사본',
  };
}

// ============================================================================
// 3. 1차 초고속 한국어 견적 규칙 파서 + 2차 Gemini AI 정밀 파서
// ============================================================================

export function parseKoreanCommandLocal(rawText: string): ParsedAiCommand {
  const text = (rawText || '').trim();
  let workingText = text;

  const shouldOpenProposalDirectly =
    /(?:제안서\s*(?:바로\s*)?(?:보여|띄워|열어|이동|직행)|바로\s*제안서)/.test(text);

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
    const rawVal = parseKoreanAmount(
      instMatch[1],
      instMatch[2] || (parseFloat(instMatch[1]) < 1000 ? '만' : '')
    );
    instantDiscount = rawVal;
    workingText = workingText.replace(instMatch[0], ' ');
  }

  let pointUsed = 0;
  const pointUsedRegex =
    /(?:포인트\s*사용|포인트\s*차감|사용\s*포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const puMatch = workingText.match(pointUsedRegex);
  if (puMatch) {
    pointUsed = parseKoreanAmount(
      puMatch[1],
      puMatch[2] || (parseFloat(puMatch[1]) < 1000 ? '만' : '')
    );
    workingText = workingText.replace(puMatch[0], ' ');
  }

  let earnedPoints = 0;
  const earnedRegex =
    /(?:적립\s*포인트|엘\s*포인트|L\.?\s*POINT|포인트\s*적립|포인트)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*(?:원|점|P)?/i;
  const epMatch = workingText.match(earnedRegex);
  if (epMatch) {
    earnedPoints = parseKoreanAmount(
      epMatch[1],
      epMatch[2] || (parseFloat(epMatch[1]) < 1000 ? '만' : '')
    );
    workingText = workingText.replace(epMatch[0], ' ');
  }

  let extraCashback = 0;
  const extraCbRegex =
    /(?:추가\s*캐시백|익월\s*캐시백|배송\s*익월\s*캐시백|특별\s*캐시백)\s*([0-9]+(?:\.[0-9]+)?(?:,[0-9]{3})*)\s*(천만|백만|십만|만|천)?\s*원?/i;
  const ecbMatch = workingText.match(extraCbRegex);
  if (ecbMatch) {
    extraCashback = parseKoreanAmount(
      ecbMatch[1],
      ecbMatch[2] || (parseFloat(ecbMatch[1]) < 1000 ? '만' : '')
    );
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
    const mdDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*배송)/);
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

  let customerName = '';
  const explicitCustomerMatch =
    text.match(/(?:고객명|이름)\s*[:：]?\s*([가-힣]{2,4})/) ||
    text.match(/([가-힣]{2,4})\s*고객(?:님)?/);
  if (explicitCustomerMatch && !RESERVED_NON_NAME_WORDS.has(explicitCustomerMatch[1])) {
    customerName = explicitCustomerMatch[1];
  } else if (phoneMatch) {
    const beforePhone = text.slice(0, text.indexOf(phoneMatch[0])).trim();
    const nameBeforePhone = beforePhone.match(/([가-힣]{2,4})\s*$/);
    if (nameBeforePhone && !RESERVED_NON_NAME_WORDS.has(nameBeforePhone[1])) {
      customerName = nameBeforePhone[1];
    }
  }
  if (!customerName) {
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
    shouldOpenProposalDirectly,
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
 * 2차 Gemini AI 정밀 파서
 */
export async function parseCommandWithHybridAi(
  rawText: string
): Promise<{ parsed: ParsedAiCommand; engineLabel: string; aiReply?: string }> {
  const localResult = parseKoreanCommandLocal(rawText);
  const apiKey = getEffectiveGeminiApiKey();
  const todayStr = getOffsetDateStr(0);
  const tomorrowStr = getOffsetDateStr(1);
  const fridayStr = getFridayDateStr(false);

  const systemPrompt = `당신은 롯데하이마트 경기광주점 통합 총괄 AI 비서입니다.
사용자의 한 줄 자연어 명령을 분석하여 아래 JSON 구조로만 정확히 응답하세요.
오늘 날짜: ${todayStr}, 내일 날짜: ${tomorrowStr}, 이번주 금요일: ${fridayStr}

[추출 규칙]
1. quoteMode: 'general' | 'subscription' | 'hybrid'
2. generalItems: [{ category, modelName, quantity, unitPrice }] (만원 단위는 * 10000 원 단위로 변환)
3. generalCardType: '롯데 제휴카드' | '삼성 제휴카드' | '신한 제휴카드' | '우리 제휴카드' | '일반 카드' | '미정'
4. instantDiscount(즉시할인), earnedPoints(적립포인트/엘포인트), pointUsed(포인트사용), extraCashback(추가캐시백): 원 단위 숫자
5. generalHiPreedCounts: { hf75, hf150, hf225, hf300 }
6. subscriptionItems: [{ category, modelName, monthlyFee, period }]
7. subscriptionPeriod: 36 | 60
8. selectedCardId: 'lotte' | 'samsung' | 'shinhan' | 'woori' | 'none'
9. selectedCardTierId: 롯데 기본 'lotte-30', 삼성 'samsung-30', 신한 'shinhan-50', 우리 'woori-30'
10. hiPlusCounts: { hi72, hi90, hi108 }
11. shouldOpenProposalDirectly: boolean ('제안서 보여줘', '제안서 바로 보여줘', '제안서 띄워줘' 포함 시 true)
12. customer: { shouldSaveCrm: boolean, name: string, phone: string, status: '상담진행중' | '결제완료' | '배송대기' | '상담종료', deliveryDate: string (YYYY-MM-DD), memo: string }
13. aiReply: string (견적 외 일반 상담 질문이나 업무 안내 요청일 때 직원이 바로 참고할 1~3문장 핵심 답변 요약)`;

  const fullPrompt = `${systemPrompt}\n\n[사용자 명령어]\n${rawText}`;
  let resolvedRawJson = '';
  let resolvedModelName = '';

  // 1차: 서버 프록시(/api/ai/parse-command) 시도 (AI 스튜디오 / 로컬 서버 환경에서 브라우저 키 없이도 즉시 작동)
  try {
    const srvRes = await fetch('/api/ai/parse-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText: fullPrompt, apiKey }),
    });
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.rawJson) {
        resolvedRawJson = String(srvData.rawJson).trim();
        resolvedModelName = String(srvData.model || 'server-gemini');
      }
    }
  } catch {
    // 정적 호스팅(GitHub Pages)에서는 아래 클라이언트 SDK로 즉시 진행
  }

  // 2차: 클라이언트 Gemini SDK 직접 호출
  if (!resolvedRawJson && apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    for (const modelName of GEMINI_FAST_TEXT_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }],
            },
          ],
          config: buildGeminiFastConfig(modelName, {
            responseMimeType: 'application/json',
          }),
        });
        const txt = (response.text || '').trim();
        if (txt) {
          resolvedRawJson = txt;
          resolvedModelName = modelName;
          break;
        }
      } catch {
        // 다음 폴백 모델 재시도
      }
    }
  }

  if (resolvedRawJson) {
    try {
      const cleanJson = resolvedRawJson
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsedJson = JSON.parse(cleanJson);

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
        shouldOpenProposalDirectly: Boolean(
          parsedJson.shouldOpenProposalDirectly ||
            localResult.shouldOpenProposalDirectly
        ),
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
        engineLabel: `✨ Gemini AI 정밀 분석 완료 (${resolvedModelName})`,
        aiReply:
          typeof parsedJson.aiReply === 'string'
            ? parsedJson.aiReply.trim()
            : undefined,
      };
    } catch {
      // JSON 파싱 실패 시 로컬 엔진 결과 반환
    }
  }

  return {
    parsed: localResult,
    engineLabel: apiKey
      ? '⚡ 초고속 한국어 통합 엔진 (로컬 분석 완료)'
      : '⚡ 초고속 한국어 통합 엔진 (정밀 AI는 상단 [🔑 AI 키] 등록 시 활성화)',
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
    extraCashback:
      cmd.quoteMode === 'subscription'
        ? 0
        : Math.max(0, Number(cmd.extraCashback) || 0),
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
    subAutoTierCashback: true,
    subManualTierCashback: 0,
    subExtraCashback:
      cmd.quoteMode === 'subscription'
        ? Math.max(0, Number(cmd.extraCashback) || 0)
        : 0,
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

export function mapAiStatusToCrmStatus(status: AiCustomerStatus): CustomerStatus {
  if (status === '결제완료' || status === '배송대기') return '계약완료';
  if (status === '상담종료') return '미구매/고민중';
  return '상담진행중';
}
