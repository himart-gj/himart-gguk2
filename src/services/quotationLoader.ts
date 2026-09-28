import { CustomerItem, QuoteRecord } from '../types/crm';
import { extractQuotationWithGemini } from './gemini';
import { formatLocalDate, formatLocalDateTime } from '../utils/date';

/**
 * 텍스트에서 금액과 단위를 추출하여 계산합니다.
 * "500만" -> 5000000 ("만"이 붙은 경우에만 * 10000)
 * "5,000,000원", "5000000" -> 5000000
 */
function extractAmountValue(rawNumStr?: string, unitStr?: string): number {
  if (!rawNumStr) return 0;
  const clean = rawNumStr.replace(/,/g, '').trim();
  const val = parseInt(clean, 10);
  if (isNaN(val)) return 0;
  if (unitStr === '만') {
    return val * 10000;
  }
  return val;
}

export interface ParsedQuotation {
  customerType: '일반' | '이사' | '입주' | '웨딩';
  name: string;
  phone: string;
  manager: string;
  slipNo: string;
  mode: 'lump' | 'sub';
  items: Array<{
    name: string;
    model: string;
    qty: number;
    price: number;
    months?: string;
  }>;
  lumpCard: string;
  lumpDc: number;
  lumpPtTot: number;
  lumpPtUse: number;
  lumpCash: number;
  subCardCorp: string;
  subCardTier: number;
  hiFreed: {
    enabled: boolean;
    val: '75' | '150' | '225' | '300';
    cnt: number;
  };
  customerMemo: string;
  internalMemo: string;
  docUrl?: string;
}

/**
 * Robust Local Rule-based Parser (Used for immediate zero-lag display)
 */
export function parseCustomerQuotationLocal(customer: CustomerItem): ParsedQuotation {
  const fullText = [
    customer.name || '',
    customer.phone || '',
    customer.slipNo || '',
    customer.category || '',
    customer.items || '',
    customer.benefit || '',
    customer.note || '',
    customer.deliveryDate || '',
  ].join(' | ');

  // 1. Customer Type
  let customerType: '일반' | '이사' | '입주' | '웨딩' = '일반';
  if (fullText.includes('웨딩') || fullText.includes('혼수')) {
    customerType = '웨딩';
  } else if (fullText.includes('이사')) {
    customerType = '이사';
  } else if (fullText.includes('입주')) {
    customerType = '입주';
  }

  // 2. Manager
  let manager = '';
  const managerMatch = fullText.match(/담당:\s*([가-힣\w]+)/);
  if (managerMatch) {
    manager = managerMatch[1];
  }

  // 3. Purchase Mode
  const isSubscription =
    fullText.includes('구독') ||
    fullText.includes('월납') ||
    fullText.includes('36개월') ||
    fullText.includes('60개월');
  const mode: 'lump' | 'sub' = isSubscription ? 'sub' : 'lump';

  // 4. Target Price / Amounts
  let targetPrice = customer.paidAmount || 0;
  if (!targetPrice) {
    const priceMatch = fullText.match(/(?:1차견적|1안|체감|결제|보장)?\s*([\d,]+)\s*(만|원)?/);
    if (priceMatch && priceMatch[1]) {
      targetPrice = extractAmountValue(priceMatch[1], priceMatch[2]);
    }
  }

  // 5. Card
  let lumpCard = '미정(상담안함)';
  let subCardCorp = 'none';
  if (fullText.includes('우리')) {
    lumpCard = '우리 제휴';
    subCardCorp = 'woori';
  } else if (fullText.includes('삼성')) {
    lumpCard = '삼성 제휴';
    subCardCorp = 'samsung';
  } else if (fullText.includes('롯데')) {
    lumpCard = '롯데 제휴';
    subCardCorp = 'lotte';
  } else if (fullText.includes('신한')) {
    lumpCard = '신한 제휴';
    subCardCorp = 'shinhan';
  } else if (fullText.includes('일반결제') || fullText.includes('일반')) {
    lumpCard = '일반 신용/체크';
  }

  // 6. Discounts & Points
  let lumpDc = 0;
  const dcMatch = fullText.match(/할인\s*([\d,]+)\s*(만|원)?/);
  if (dcMatch && dcMatch[1]) {
    lumpDc = extractAmountValue(dcMatch[1], dcMatch[2]);
  }

  let lumpPtUse = 0;
  let lumpPtTot = 0;
  const ptMatch = fullText.match(/포인트\s*([\d,]+)\s*(만|원)?/);
  if (ptMatch && ptMatch[1]) {
    lumpPtUse = extractAmountValue(ptMatch[1], ptMatch[2]);
    lumpPtTot = lumpPtUse;
  }

  let lumpCash = 0;
  const cashMatch = fullText.match(/캐시백\s*([\d,]+)(?:~([\d,]+))?\s*(만|원)?/);
  if (cashMatch) {
    const cashValStr = cashMatch[2] || cashMatch[1];
    lumpCash = extractAmountValue(cashValStr, cashMatch[3]);
  }

  // 7. Hi-Freed
  const hiFreed = {
    enabled: false,
    val: '150' as '75' | '150' | '225' | '300',
    cnt: 0,
  };
  if (fullText.includes('프리드') || fullText.includes('상조')) {
    hiFreed.enabled = true;
    hiFreed.cnt = 1;
    const cntMatch = fullText.match(/(\d+)구좌/);
    if (cntMatch) hiFreed.cnt = parseInt(cntMatch[1], 10);
    if (fullText.includes('300')) hiFreed.val = '300';
    else if (fullText.includes('75')) hiFreed.val = '75';
    else if (fullText.includes('225')) hiFreed.val = '225';
  }

  // 8. Products
  const items: Array<{ name: string; model: string; qty: number; price: number; months?: string }> = [];
  const parenthesizedMatches = Array.from(fullText.matchAll(/([가-힣\w\s]+)\(([^)]+)\)/g));

  if (parenthesizedMatches.length > 0) {
    for (const match of parenthesizedMatches) {
      const groupName = match[1].trim();
      const inside = match[2].trim();
      if (!inside.includes('개월') && !inside.includes('할인') && !inside.includes('배송') && !inside.includes('결제')) {
        const models = inside.split(/[,/]+/).map((s) => s.trim()).filter((s) => s.length >= 3);
        if (models.length > 1) {
          models.forEach((mod) => {
            let itemName = groupName;
            if (mod.startsWith('AF')) itemName = '에어컨 (스탠드/벽걸이)';
            else if (mod.startsWith('WD') || mod.startsWith('WH') || mod.startsWith('MF')) itemName = '세탁건조기 / 워시타워';
            else if (mod.startsWith('RM') || mod.startsWith('RF') || mod.startsWith('PLX')) itemName = '냉장고 / 김치냉장고';
            else if (mod.includes('C7L') || mod.includes('TV')) itemName = '대화면 TV';
            else if (mod.startsWith('A5') || mod.toLowerCase().includes('청소기')) itemName = '무선 청소기';
            items.push({ name: itemName, model: mod, qty: 1, price: 0 });
          });
        } else if (models.length === 1) {
          items.push({ name: groupName, model: models[0], qty: 1, price: 0 });
        }
      }
    }
  }

  if (items.length === 0) {
    const cleanItem = (customer.items || customer.category || '가전 견적 상담').replace(/\([^)]*\)/g, '').trim() || '가전 패키지';
    items.push({
      name: cleanItem,
      model: '-',
      qty: 1,
      price: targetPrice || 0,
    });
  } else if (targetPrice > 0) {
    const avg = Math.round(targetPrice / items.length / 10000) * 10000;
    let sum = 0;
    items.forEach((it, idx) => {
      if (idx === items.length - 1) {
        it.price = Math.max(0, targetPrice - sum);
      } else {
        it.price = avg;
        sum += avg;
      }
    });
  }

  // If subscription, set months
  if (mode === 'sub') {
    items.forEach((it) => {
      it.months = fullText.includes('60개월') ? '60' : '36';
    });
  }

  // 9. Memos
  const customerMemo = [
    customer.note ? `[상담메모] ${customer.note}` : '',
    customer.deliveryDate ? `[배송요청] ${customer.deliveryDate}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const internalMemo = [
    `[CRM 파이프라인] ${customer.status}`,
    customer.docUrl ? `[구글문서 견적서] ${customer.docUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    customerType,
    name: customer.name || '고객님',
    phone: customer.phone || '',
    manager,
    slipNo: customer.slipNo || customer.date || '',
    mode,
    items,
    lumpCard,
    lumpDc,
    lumpPtTot,
    lumpPtUse,
    lumpCash,
    subCardCorp,
    subCardTier: subCardCorp === 'woori' ? 18000 : 0,
    hiFreed,
    customerMemo,
    internalMemo,
    docUrl: customer.docUrl,
  };
}

/**
 * Call Gemini 3.8 Flash for high-accuracy customer quotation extraction.
 * Works seamlessly in client-side static deployments (GitHub Pages) and dev servers.
 */
export async function fetchAIExtractedQuotation(customer: CustomerItem): Promise<ParsedQuotation | null> {
  return await extractQuotationWithGemini(customer);
}

/**
 * Injects structured quotation data into the Quotation Calculator DOM and recalculates.
 */
export function applyQuotationDataToDOM(data: ParsedQuotation): void {
  // 1. Switch Mode Tab (일반구매 or 구독구매)
  if (typeof (window as any).switchInputTab === 'function') {
    (window as any).switchInputTab(data.mode);
  }

  // 2. Customer Type Radio (일반, 이사, 입주, 웨딩)
  const typeRadio = document.querySelector(
    `input[name="i-type"][value="${data.customerType || '일반'}"]`
  ) as HTMLInputElement | null;
  if (typeRadio) {
    typeRadio.checked = true;
  }

  // 3. Customer Info Inputs
  const nameInput = document.getElementById('i-name') as HTMLInputElement | null;
  const phoneInput = document.getElementById('i-c-phone') as HTMLInputElement | null;
  const managerInput = document.getElementById('i-manager') as HTMLInputElement | null;
  const noInput = document.getElementById('i-no') as HTMLInputElement | null;

  if (nameInput) nameInput.value = data.name || '';
  if (phoneInput) phoneInput.value = data.phone || '';
  if (managerInput) managerInput.value = data.manager || '';
  if (noInput) noInput.value = data.slipNo || '';

  // 4. Items & Pricing
  if (data.mode === 'lump') {
    const lumpInputs = document.getElementById('lump-inputs');
    if (lumpInputs) {
      lumpInputs.innerHTML = '';
      if (typeof (window as any).addLumpRow === 'function') {
        if (data.items && data.items.length > 0) {
          data.items.forEach((item) => {
            (window as any).addLumpRow(
              item.name || '품목',
              item.model || '-',
              item.price > 0 ? item.price : '',
              item.qty || 1
            );
          });
        } else {
          (window as any).addLumpRow();
        }
      }
    }

    // Card selection
    const lCardSelect = document.getElementById('l-card') as HTMLSelectElement | null;
    if (lCardSelect) {
      let matched = false;
      for (let i = 0; i < lCardSelect.options.length; i++) {
        if (
          lCardSelect.options[i].text.includes(data.lumpCard) ||
          lCardSelect.options[i].value.includes(data.lumpCard)
        ) {
          lCardSelect.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) {
        lCardSelect.selectedIndex = 0;
      }
    }

    // Discounts & Points & Cashback
    const lDc = document.getElementById('l-dc') as HTMLInputElement | null;
    const lPtTot = document.getElementById('l-pt-tot') as HTMLInputElement | null;
    const lPtUse = document.getElementById('l-pt-use') as HTMLInputElement | null;
    const lCash = document.getElementById('l-cash') as HTMLInputElement | null;

    if (lDc) lDc.value = data.lumpDc ? String(data.lumpDc) : '';
    if (lPtTot) lPtTot.value = data.lumpPtTot ? String(data.lumpPtTot) : '';
    if (lPtUse) lPtUse.value = data.lumpPtUse ? String(data.lumpPtUse) : '';
    if (lCash) lCash.value = data.lumpCash ? String(data.lumpCash) : '';

    // Hi-Freed (상조 결합)
    const lumpHpContainer = document.getElementById('lump-hp-container');
    if (lumpHpContainer) {
      lumpHpContainer.innerHTML = '';
      if (data.hiFreed && data.hiFreed.enabled && data.hiFreed.cnt > 0) {
        if (typeof (window as any).addHpRow === 'function') {
          (window as any).addHpRow('lump');
          const row = lumpHpContainer.lastElementChild as HTMLElement | null;
          if (row) {
            const valSelect = row.querySelector('.hp-val') as HTMLSelectElement | null;
            const cntSelect = row.querySelector('.hp-cnt') as HTMLSelectElement | null;
            if (valSelect) valSelect.value = data.hiFreed.val || '150';
            if (cntSelect) cntSelect.value = String(data.hiFreed.cnt || 1);
          }
        }
      }
    }
  } else {
    // Subscription Mode (구독구매)
    const subInputs = document.getElementById('sub-inputs');
    if (subInputs) {
      subInputs.innerHTML = '';
      if (typeof (window as any).addSubRow === 'function') {
        if (data.items && data.items.length > 0) {
          data.items.forEach((item) => {
            (window as any).addSubRow(
              item.name || '구독 품목',
              item.model || '-',
              item.price > 0 ? item.price : '',
              item.months || '36'
            );
          });
        } else {
          (window as any).addSubRow();
        }
      }
    }

    const sCardCorp = document.getElementById('s-card-corp') as HTMLSelectElement | null;
    if (sCardCorp) {
      sCardCorp.value = data.subCardCorp || 'none';
      if (typeof (window as any).updateCardTiers === 'function') {
        (window as any).updateCardTiers();
      }

      // Tier discount
      const sCardTier = document.getElementById('s-card-tier') as HTMLSelectElement | null;
      if (sCardTier && data.subCardTier) {
        for (let i = 0; i < sCardTier.options.length; i++) {
          if (parseInt(sCardTier.options[i].value, 10) === data.subCardTier) {
            sCardTier.selectedIndex = i;
            break;
          }
        }
      }
    }

    // Subscription Hi-Freed
    const subHpContainer = document.getElementById('sub-hp-container');
    if (subHpContainer) {
      subHpContainer.innerHTML = '';
      if (data.hiFreed && data.hiFreed.enabled && data.hiFreed.cnt > 0) {
        if (typeof (window as any).addHpRow === 'function') {
          (window as any).addHpRow('sub');
          const row = subHpContainer.lastElementChild as HTMLElement | null;
          if (row) {
            const valSelect = row.querySelector('.hp-val') as HTMLSelectElement | null;
            const cntSelect = row.querySelector('.hp-cnt') as HTMLSelectElement | null;
            if (valSelect) valSelect.value = data.hiFreed.val || '150';
            if (cntSelect) cntSelect.value = String(data.hiFreed.cnt || 1);
          }
        }
      }
    }
  }

  // 5. Memos
  const memoCustomer = document.getElementById('i-memo-customer') as HTMLTextAreaElement | null;
  const memoMy = document.getElementById('i-memo') as HTMLTextAreaElement | null;

  if (memoCustomer) memoCustomer.value = data.customerMemo || '';
  if (memoMy) memoMy.value = data.internalMemo || '';

  // 6. Recalculate
  if (typeof (window as any).calc === 'function') {
    (window as any).calc();
  }
}

/**
 * Intelligent Two-Stage Quote Loader:
 * Stage 1: Immediate local population (0ms delay)
 * Stage 2: AI-powered precision analysis in background, auto-updating form fields and notifying user.
 */
export async function loadCustomerIntoCalculatorWithAI(
  customer: CustomerItem,
  onNotify?: (message: string, isAiSuccess?: boolean) => void
): Promise<{ success: boolean; message: string }> {
  // Step 1: Immediate local rule load
  const localData = parseCustomerQuotationLocal(customer);
  applyQuotationDataToDOM(localData);

  // Set active customer ID on window for auto-saving
  (window as any).currentActiveCustomerId = customer.id;
  (window as any).currentActiveCustomerName = customer.name;
  if (customer.quotes && customer.quotes.length > 0) {
    (window as any).currentActiveQuoteId = customer.quotes[0].id;
    (window as any).currentEditingQuoteId = customer.quotes[0].id;
  } else {
    (window as any).currentActiveQuoteId = null;
    (window as any).currentEditingQuoteId = null;
  }

  // Update banner in DOM
  const banner = document.getElementById('crm-loaded-banner');
  const title = document.getElementById('crm-loaded-title');
  const desc = document.getElementById('crm-loaded-desc');
  const docLink = document.getElementById('crm-loaded-doc-link') as HTMLAnchorElement | null;
  const autoSaveBadge = document.getElementById('crm-loaded-autosave-badge');

  if (banner && title && desc) {
    banner.classList.remove('hidden');
    title.innerText = `👤 [${customer.name}] 고객님 견적 작업 중`;
    desc.innerText = `${customer.items || customer.category || '가전 견적'} | 상태: ${customer.status}`;
    if (autoSaveBadge) {
      autoSaveBadge.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">💾 수동 저장 모드</span>`;
    }
    if (docLink) {
      if (customer.docUrl) {
        docLink.href = customer.docUrl;
        docLink.classList.remove('hidden');
      } else {
        docLink.classList.add('hidden');
      }
    }
  }

  if (onNotify) {
    onNotify(`[${customer.name}] 고객 견적이 계산기에 입력되었습니다. (수정 후 [견적저장] 클릭 시 보관)`, false);
  }

  return {
    success: true,
    message: `[${customer.name}] 고객님의 견적이 계산기에 입력되었습니다.`,
  };
}

/**
 * Extracts currently entered data from Calculator DOM into a structured QuoteRecord
 */
export function extractQuoteRecordFromDOM(customTitle?: string): QuoteRecord | null {
  const isSub = document.getElementById('input-tab-sub')?.classList.contains('bg-blue-600') || false;
  const mode: 'lump' | 'sub' = isSub ? 'sub' : 'lump';

  // Use the canonical vanilla gatherQuotationData if available
  const rawData = typeof (window as any).gatherQuotationData === 'function'
    ? (window as any).gatherQuotationData()
    : null;

  let items: Array<{ name: string; model: string; qty: number; price: number; months?: string }> = [];
  let itemSummary = '';
  let paidAmount = 0;
  let netAmount = 0;

  if (rawData) {
    if (mode === 'lump') {
      items = (rawData.lumpItems || []).map((it: any) => ({
        name: it.name || '품목',
        model: it.model || '-',
        qty: it.qty || 1,
        price: it.price || 0,
      }));
      paidAmount = typeof (window as any).currentPayPriceLump === 'number'
        ? (window as any).currentPayPriceLump
        : (rawData.payPrice || 0);
      netAmount = typeof (window as any).currentNetPriceLump === 'number'
        ? (window as any).currentNetPriceLump
        : (rawData.netPrice || 0);
    } else {
      items = (rawData.subItems || []).map((it: any) => ({
        name: it.name || '구독품목',
        model: it.model || '-',
        qty: 1,
        price: it.price || 0,
        months: it.months || '60',
      }));
      paidAmount = typeof (window as any).currentContractSub === 'number'
        ? (window as any).currentContractSub
        : (rawData.subSum || 0);
      netAmount = typeof (window as any).currentNetPriceSub === 'number'
        ? (window as any).currentNetPriceSub
        : (rawData.netPrice || 0);
    }
    itemSummary = rawData.itemSummary || '';
  } else {
    // Fallback: direct DOM extraction
    if (mode === 'lump') {
      const names = document.querySelectorAll('.l-name');
      const models = document.querySelectorAll('.l-model');
      const qtys = document.querySelectorAll('.l-qty');
      const prices = document.querySelectorAll('.l-price');

      names.forEach((el, i) => {
        const n = (el as HTMLInputElement).value?.trim() || '';
        const m = (models[i] as HTMLInputElement)?.value?.trim() || '';
        const q = parseInt((qtys[i] as HTMLInputElement)?.value || '1', 10) || 1;
        const p = parseInt((prices[i] as HTMLInputElement)?.value || '0', 10) || 0;
        if (n || p > 0) {
          items.push({ name: n || '품목', model: m || '-', qty: q, price: p });
          if (!itemSummary && n) itemSummary = n;
        }
      });
      if (items.length > 1) itemSummary += ` 외 ${items.length - 1}건`;
      paidAmount = (window as any).currentPayPriceLump || 0;
      netAmount = (window as any).currentNetPriceLump || 0;
    } else {
      const names = document.querySelectorAll('.s-name');
      const models = document.querySelectorAll('.s-model');
      const prices = document.querySelectorAll('.s-price');
      const months = document.querySelectorAll('.s-months');

      names.forEach((el, i) => {
        const n = (el as HTMLInputElement).value?.trim() || '';
        const m = (models[i] as HTMLInputElement)?.value?.trim() || '';
        const p = parseInt((prices[i] as HTMLInputElement)?.value || '0', 10) || 0;
        const mo = (months[i] as HTMLSelectElement)?.value || '60';
        if (n || p > 0) {
          items.push({ name: n || '구독품목', model: m || '-', qty: 1, price: p, months: mo });
          if (!itemSummary && n) itemSummary = `${n} (구독)`;
        }
      });
      if (items.length > 1) itemSummary += ` 외 ${items.length - 1}건`;
      paidAmount = (window as any).currentContractSub || 0;
      netAmount = (window as any).currentNetPriceSub || 0;
    }
  }

  const memoCustEl = document.getElementById('i-memo-customer') as HTMLTextAreaElement | null;
  const memoMyEl = document.getElementById('i-memo') as HTMLTextAreaElement | null;
  const lumpCard = rawData?.lumpCard || (document.getElementById('l-card') as HTMLSelectElement | null)?.value || '';
  const lumpDc = rawData?.lumpDc || parseInt((document.getElementById('l-dc') as HTMLInputElement | null)?.value || '0', 10) || 0;
  const lumpCash = rawData?.lumpCash || parseInt((document.getElementById('l-cash') as HTMLInputElement | null)?.value || '0', 10) || 0;
  const subCardCorp = rawData?.subCardCorp || (document.getElementById('s-card-corp') as HTMLSelectElement | null)?.value || '';
  const subCardTier = rawData?.subCardTier || parseInt((document.getElementById('s-card-tier') as HTMLSelectElement | null)?.value || '0', 10) || 0;

  const title = customTitle || `${formatLocalDate(new Date()).substring(2)} ${itemSummary || '가전 견적'} (${mode === 'lump' ? '일시불' : '구독'})`;

  return {
    id: 'Q_' + Date.now(),
    title,
    createdAt: formatLocalDateTime(new Date()),
    mode,
    paidAmount,
    netAmount,
    itemSummary: itemSummary || '가전 견적',
    items,
    lumpCard,
    lumpDc,
    lumpCash,
    subCardCorp,
    subCardTier,
    customerMemo: rawData?.memoCust || memoCustEl?.value || '',
    internalMemo: rawData?.memoMy || memoMyEl?.value || '',
    rawCalculatorData: rawData || {
      type: mode === 'lump' ? '일반' : '구독',
      name: (document.getElementById('i-name') as HTMLInputElement | null)?.value || '',
      phone: (document.getElementById('i-c-phone') as HTMLInputElement | null)?.value || '',
      manager: (document.getElementById('i-manager') as HTMLInputElement | null)?.value || '',
      lumpItems: mode === 'lump' ? items : [],
      subItems: mode === 'sub' ? items : [],
    },
  };
}

/**
 * Saves current calculator DOM state into the active customer's quote history
 */
export function saveCurrentCalculatorAsQuote(customTitle?: string, isOverwrite?: boolean): QuoteRecord | null {
  const quote = extractQuoteRecordFromDOM(customTitle);
  if (!quote) return null;

  const activeQuoteId = (window as any).currentActiveQuoteId || (window as any).currentEditingQuoteId;
  if (isOverwrite && activeQuoteId) {
    quote.id = activeQuoteId;
  }

  const activeCustomerId = (window as any).currentActiveCustomerId;
  const currentName = (document.getElementById('i-name') as HTMLInputElement | null)?.value?.trim() || (window as any).currentActiveCustomerName || '';
  const currentPhone = (document.getElementById('i-c-phone') as HTMLInputElement | null)?.value?.trim() || '';

  // Find target customer ID
  let targetId = activeCustomerId;
  if (!targetId && (currentName || currentPhone)) {
    try {
      const cached = JSON.parse(localStorage.getItem('himart_crm_customers_cache') || '[]');
      const cleanP = (currentPhone || '').replace(/\D/g, '');
      const last8 = cleanP.length >= 8 ? cleanP.slice(-8) : '';
      const found = cached.find((c: any) => {
        const cPhone = (c.phone || '').replace(/\D/g, '');
        const cLast8 = cPhone.length >= 8 ? cPhone.slice(-8) : '';
        return (last8 && cLast8 && last8 === cLast8) ||
               (currentName && c.name && c.name.trim() === currentName);
      });
      if (found) targetId = found.id;
    } catch (e) {
      console.error(e);
    }
  }

  if (!targetId) {
    targetId = 'crm-' + Date.now();
  }

  // Import and call saveCustomerQuote immediately
  import('./gasApi').then(({ saveCustomerQuote }) => {
    const finalName = currentName || '일반 고객';
    saveCustomerQuote(
      targetId,
      quote,
      { name: finalName, phone: currentPhone },
      isOverwrite ? (activeQuoteId || 'true') : undefined
    );
    
    // Set as active customer ID and quote ID
    (window as any).currentActiveCustomerId = targetId;
    (window as any).currentActiveQuoteId = quote.id;
    (window as any).currentEditingQuoteId = quote.id;
    (window as any).currentActiveCustomerName = finalName;

    // Dispatch event for React components to update
    window.dispatchEvent(new CustomEvent('crm-customer-updated', { detail: { customerId: targetId } }));

    // Update banner in calculator DOM
    const banner = document.getElementById('crm-loaded-banner');
    const title = document.getElementById('crm-loaded-title');
    const desc = document.getElementById('crm-loaded-desc');
    const autoSaveBadge = document.getElementById('crm-loaded-autosave-badge');

    if (banner) banner.classList.remove('hidden');
    if (title) title.innerText = `👤 [${finalName}] ${isOverwrite ? '견적 덮어쓰기(수정) 완료' : '견적 저장됨'}`;
    if (desc) desc.innerText = `체감가: ${quote.netAmount.toLocaleString()}원 | ${quote.itemSummary}`;
    if (autoSaveBadge) {
      autoSaveBadge.innerHTML = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">✓ ${isOverwrite ? 'CRM 견적 덮어쓰기 완료' : 'CRM 견적 저장 완료'} (${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})</span>`;
    }
  });

  return quote;
}

// Global bridge for vanilla JS in index.html
if (typeof window !== 'undefined') {
  (window as any).saveCurrentCalculatorAsQuote = saveCurrentCalculatorAsQuote;
  (window as any).extractQuoteRecordFromDOM = extractQuoteRecordFromDOM;

  // Auto-save disabled per user instruction (manual save only)
  (window as any).triggerAutoSaveFromCalculator = () => {
    // No-op: Only saves when user explicitly clicks [저장]
  };
}

/**
 * Restores a saved QuoteRecord back into the calculator DOM
 */
export function loadQuoteRecordIntoCalculator(quote: QuoteRecord, customer: CustomerItem): void {
  // Set active customer and active quote ID for precise overwriting
  (window as any).currentActiveCustomerId = customer.id;
  (window as any).currentActiveCustomerName = customer.name;
  (window as any).currentActiveQuoteId = quote.id;
  (window as any).currentEditingQuoteId = quote.id;
  (window as any).currentEditingFolderId = customer.id;

  // 100% loss-free restore using canonical applyQuotationData if available
  if (quote.rawCalculatorData && typeof (window as any).applyQuotationData === 'function') {
    (window as any).applyQuotationData(quote.rawCalculatorData);
  } else {
    // Fallback: convert QuoteRecord to ParsedQuotation
    const parsed: ParsedQuotation = {
      customerType: '일반',
      name: customer.name,
      phone: customer.phone,
      manager: quote.rawCalculatorData?.manager || '담당자',
      slipNo: customer.slipNo || '',
      mode: quote.mode,
      items: quote.items.map((i) => ({
        name: i.name,
        model: i.model,
        qty: i.qty,
        price: i.price,
        months: i.months,
      })),
      lumpCard: quote.lumpCard || '미정(상담안함)',
      lumpDc: quote.lumpDc || 0,
      lumpPtTot: 0,
      lumpPtUse: 0,
      lumpCash: quote.lumpCash || 0,
      subCardCorp: quote.subCardCorp || 'none',
      subCardTier: quote.subCardTier || 0,
      hiFreed: { enabled: false, val: '150', cnt: 1 },
      customerMemo: quote.customerMemo || '',
      internalMemo: quote.internalMemo || '',
    };

    applyQuotationDataToDOM(parsed);
  }

  // Update banner in DOM
  const banner = document.getElementById('crm-loaded-banner');
  const title = document.getElementById('crm-loaded-title');
  const desc = document.getElementById('crm-loaded-desc');
  const autoSaveBadge = document.getElementById('crm-loaded-autosave-badge');

  if (banner && title && desc) {
    banner.classList.remove('hidden');
    title.innerText = `👤 [${customer.name}] ${quote.title} 불러옴`;
    desc.innerText = `실결제: ${quote.paidAmount > 0 ? quote.paidAmount.toLocaleString() + '원' : '-'} | 체감가: ${quote.netAmount < 0 ? '0원' : quote.netAmount.toLocaleString() + '원'} | ${quote.itemSummary}`;
    if (autoSaveBadge) {
      autoSaveBadge.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">✓ [${quote.title}] 복원 완료</span>`;
    }
  }
}
