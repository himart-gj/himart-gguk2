import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Printer,
  Settings,
  Trash2,
  Filter,
  Download,
  FileText,
  Camera,
  Sparkles,
  ArrowLeft,
  CheckSquare,
} from 'lucide-react';
import {
  ProductData,
  CARD_BENEFITS,
  PopPaperSize,
  UnderPreedScope,
} from './types';
import { parseExcel } from './excel';
import PopCard from './PopCard';
import ImageScannerModal from './ImageScannerModal';
import { FlagshipModalShell } from '../components/ui/FlagshipModalShell';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

export interface PopPrinterAppProps {
  onBackToHome: () => void;
  backLabel?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: !!deferredPrompt, isInstalled, isIOS, install };
}

const POP_PRODUCTS_STORAGE_KEY = 'himart_pop_products_v1';
let inMemoryPopProductsCache: ProductData[] | null = null;

function loadSavedPopProducts(): ProductData[] {
  if (inMemoryPopProductsCache) return inMemoryPopProductsCache;
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(POP_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryPopProductsCache = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function PopPrinterApp({ onBackToHome, backLabel }: PopPrinterAppProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [products, setProducts] = useState<ProductData[]>(() => loadSavedPopProducts());

  useEffect(() => {
    inMemoryPopProductsCache = products;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(POP_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      } catch {
        // quota fallback
      }
    }
  }, [products]);

  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>(CARD_BENEFITS[0].id);
  const [popMode, setPopMode] = useState<'standard' | 'preed'>('standard');
  const [paperSize, setPaperSize] = useState<PopPaperSize>('a4-4up');
  const [underPreedScope, setUnderPreedScope] = useState<UnderPreedScope>('optimal');
  const [selectedA3Ids, setSelectedA3Ids] = useState<string[]>([]);
  const [onlySelectedInA3, setOnlySelectedInA3] = useState<boolean>(false);
  const [singleA3Job, setSingleA3Job] = useState<{
    product: ProductData;
    action: 'print' | 'pdf';
  } | null>(null);

  // Modals
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImageScannerOpen, setIsImageScannerOpen] = useState(false);
  const [scannerInitialImage, setScannerInitialImage] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      isImageScannerOpen ||
      isDataModalOpen ||
      isSettingsModalOpen ||
      showIOSGuide
    ) {
      try {
        window.history.pushState({ appGuard: true, tag: 'pop-modal' }, '');
      } catch {
        // ignore
      }
    }
    (window as any).__subViewBackHandler = (): boolean => {
      if (isImageScannerOpen) {
        setIsImageScannerOpen(false);
        return true;
      }
      if (isDataModalOpen) {
        setIsDataModalOpen(false);
        return true;
      }
      if (isSettingsModalOpen) {
        setIsSettingsModalOpen(false);
        return true;
      }
      if (showIOSGuide) {
        setShowIOSGuide(false);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__subViewBackHandler;
    };
  }, [isImageScannerOpen, isDataModalOpen, isSettingsModalOpen, showIOSGuide]);

  const [printMode, setPrintMode] = useState<'all' | 'changed' | 'new' | 'allcare' | 'standard'>('all');

  const handleToggleAllCare = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isAllCare: !p.isAllCare } : p))
    );
  };

  const handleSetAllCare = (enable: boolean) => {
    setProducts((prev) => prev.map((p) => ({ ...p, isAllCare: enable })));
  };

  const handleAddProductFromScanner = (newProduct: ProductData) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.modelName === newProduct.modelName);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...newProduct, changeStatus: 'changed' };
        return updated;
      }
      return [newProduct, ...prev];
    });
    setUploadSuccessMessage(
      `📸 [${newProduct.category || '가전'}] ${newProduct.modelName} 모델이 POP 목록에 추가되었습니다.`
    );
    setTimeout(() => setUploadSuccessMessage(null), 5000);
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setScannerInitialImage(event.target?.result as string);
              setIsImageScannerOpen(true);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.8-flash');

  React.useEffect(() => {
    const storedKey =
      localStorage.getItem('gemini_api_key') ||
      localStorage.getItem('geminiApiKey') ||
      '';
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem('geminiAiModel');
    const validModels = [
      'gemini-3.8-flash',
      'gemini-4-hydrogen',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
    ];
    if (storedModel && validModels.includes(storedModel)) {
      setAiModel(storedModel);
    } else {
      setAiModel('gemini-3.8-flash');
      localStorage.setItem('geminiAiModel', 'gemini-3.8-flash');
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    localStorage.setItem('geminiApiKey', apiKey.trim());
    localStorage.setItem('geminiAiModel', aiModel);
    setIsSettingsModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const parsedProducts = await parseExcel(file);
      if (parsedProducts.length === 0) {
        setError('데이터를 찾을 수 없거나 구독료가 0원인 항목만 있습니다.');
      } else {
        const finalProducts = parsedProducts;
        const hasAnyAllCare = finalProducts.some((p) => p.isAllCare);

        if (products.length === 0) {
          setProducts(finalProducts.map((p) => ({ ...p, changeStatus: 'new' })));
        } else {
          const newProductsList = [...products];
          finalProducts.forEach((parsed) => {
            const existingIndex = newProductsList.findIndex(
              (p) => p.modelName === parsed.modelName
            );
            if (existingIndex >= 0) {
              const existing = newProductsList[existingIndex];
              newProductsList[existingIndex] = {
                ...existing,
                ...parsed,
                id: existing.id,
                isAllCare: parsed.isAllCare ?? existing.isAllCare,
                changeStatus:
                  existing.monthlyFee !== parsed.monthlyFee ? 'changed' : 'unchanged',
              };
            } else {
              newProductsList.push({ ...parsed, changeStatus: 'new' });
            }
          });
          setProducts(newProductsList);
        }

        setIsDataModalOpen(false);
        if (hasAnyAllCare) {
          setUploadSuccessMessage(
            '🛡️ [올케어] 자료가 감지되어 2년 수리비 보증 혜택이 자동 적용되었습니다.'
          );
        } else {
          setUploadSuccessMessage(`${finalProducts.length}개 모델이 로드되었습니다.`);
        }
        setTimeout(() => setUploadSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClearData = () => {
    setProducts([]);
    setSelectedA3Ids([]);
    setOnlySelectedInA3(false);
    setConfirmClearAll(false);
  };

  const handleToggleA3Select = (id: string) => {
    setSelectedA3Ids((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      setOnlySelectedInA3(next.length > 0);
      return next;
    });
  };

  const exportPrintAreaToPDF = async (targetPaper: PopPaperSize, customFileName?: string) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    setIsDownloading(true);
    const originalCssText = printArea.style.cssText;
    try {
      printArea.classList.remove('hidden', 'print:block');
      printArea.style.cssText =
        'display: block; position: fixed; left: -20000px; top: 0; width: 1200px; min-width: 1200px; background: #ffffff; z-index: -1; pointer-events: none;';

      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready;
        } catch {
          // ignore
        }
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      await new Promise((resolve) => setTimeout(resolve, 220));

      const isA3 = targetPaper === 'a3-portrait';
      const is4Up = targetPaper === 'a4-4up';
      const selector = isA3
        ? '.print-page-a3-pdf'
        : is4Up
        ? '.print-page-a4-4up'
        : '.print-page-a4';
      const pages = printArea.querySelectorAll(selector);
      if (pages.length === 0) return;

      const pdf = new jsPDF({
        orientation: isA3 ? 'portrait' : 'landscape',
        unit: 'mm',
        format: isA3 ? 'a3' : 'a4',
      });

      const pageWidthMm = 297;
      const pageHeightMm = isA3 ? 420 : 210;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const captureW = page.offsetWidth;
        const captureH = page.offsetHeight;
        const pageDataUrl = await toJpeg(page, {
          quality: 0.97,
          backgroundColor: '#ffffff',
          width: captureW,
          height: captureH,
          pixelRatio: isA3 ? 3.4 : is4Up ? 2.8 : 2.4,
          style: {
            transform: 'none',
            margin: '0',
          },
        });

        if (i > 0) pdf.addPage();
        pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
      }

      const defaultName = isA3
        ? '구독POP_A3세로_단독포스터.pdf'
        : is4Up
        ? '구독POP_하단미니_A4_4분할.pdf'
        : '구독POP_기본쇼카드_A4_2분할.pdf';
      pdf.save(customFileName || defaultName);
    } catch (err) {
      console.error(err);
      setError('PDF 저장 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      printArea.style.cssText = originalCssText;
      printArea.classList.add('hidden', 'print:block');
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    await exportPrintAreaToPDF(paperSize);
  };

  const handleQuickPrintA3 = (product: ProductData) => {
    setSingleA3Job({ product, action: 'print' });
  };

  const handleQuickDownloadA3Pdf = (product: ProductData) => {
    if (isDownloading) return;
    setSingleA3Job({ product, action: 'pdf' });
  };

  useEffect(() => {
    if (!singleA3Job) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (singleA3Job.action === 'print') {
        const cleanup = () => {
          window.removeEventListener('afterprint', cleanup);
          setSingleA3Job(null);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
        window.setTimeout(cleanup, 600);
      } else {
        const safeModel = (singleA3Job.product.modelName || '단독모델').replace(
          /[\/:*?"<>|]/g,
          '_'
        );
        await exportPrintAreaToPDF('a3-portrait', `구독POP_A3세로_${safeModel}.pdf`);
        if (!cancelled) setSingleA3Job(null);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [singleA3Job]);

  const selectedCard =
    CARD_BENEFITS.find((c) => c.id === selectedCardId) || CARD_BENEFITS[0];

  const displayedProducts = products.filter((p) => {
    if (printMode === 'changed') return p.changeStatus === 'changed';
    if (printMode === 'new') return p.changeStatus === 'new';
    if (printMode === 'allcare') return !!p.isAllCare;
    if (printMode === 'standard') return !p.isAllCare;
    return true;
  });

  const selectedDisplayedProducts = displayedProducts.filter((p) =>
    selectedA3Ids.includes(p.id)
  );

  const effectivePaperSize: PopPaperSize = singleA3Job ? 'a3-portrait' : paperSize;
  const activePrintProducts: ProductData[] = singleA3Job
    ? [singleA3Job.product]
    : effectivePaperSize === 'a3-portrait' &&
      onlySelectedInA3 &&
      selectedDisplayedProducts.length > 0
    ? selectedDisplayedProducts
    : displayedProducts;

  // A4 가로 4분할 인쇄용 묶음 (4개씩: 148.5mm × 105mm)
  const productQuads: ProductData[][] = [];
  for (let i = 0; i < activePrintProducts.length; i += 4) {
    productQuads.push(activePrintProducts.slice(i, i + 4));
  }

  // A4 가로 2분할 인쇄용 묶음 (2개씩: 148.5mm × 210mm)
  const productPairs: ProductData[][] = [];
  for (let i = 0; i < activePrintProducts.length; i += 2) {
    productPairs.push(activePrintProducts.slice(i, i + 2));
  }

  const anyAllCare = products.some((p) => p.isAllCare);

  return (
    <div className="min-h-screen bg-[#F2F4F6] dark:bg-[#0B1120] print:bg-white text-[#191F28] dark:text-slate-100 print:text-slate-900 font-sans flex flex-col">
      <style>{
        effectivePaperSize === 'a3-portrait'
          ? `@media print {
              @page { size: A3 portrait !important; margin: 0 !important; }
              .print-page-a3-pdf { display: none !important; }
              .print-page.print-page-a3 {
                display: flex !important;
                width: 297mm !important;
                height: 418mm !important;
                transform: none !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }`
          : `@media print { @page { size: A4 landscape !important; margin: 0 !important; } }`
      }</style>

      {/* ==================== 간소화된 통합 상단 컨트롤 헤더 (중복 좌측 사이드바 완전 제거) ==================== */}
      <header
        style={{ top: 'var(--app-header-h, 54px)' }}
        className="bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-slate-800 sticky z-20 shadow-2xs no-print"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 space-y-2">
          {/* 1열: 뒤로가기 + 타이틀 + 핵심 액션 버튼 4개 (사진등록 / 자료관리 / 인쇄 / PDF) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 font-bold text-xs border border-[#E5E8EB] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel || '홈'}</span>
              </button>
              <h1 className="text-[15px] sm:text-[16.5px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 whitespace-nowrap">
                구독 POP 출력
              </h1>
              {products.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold tabular-nums">
                  {displayedProducts.length}건
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              <button
                type="button"
                onClick={() => {
                  setScannerInitialImage(null);
                  setIsImageScannerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#1B64DA] hover:bg-blue-700 text-white h-8 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
                title="사진 촬영 또는 화면 캡처(Ctrl+V)로 모델 자동 등록"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>사진 등록</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 h-8 px-3 rounded-xl text-xs font-bold border border-[#E5E8EB] dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
                <span>엑셀 · 자료</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={activePrintProducts.length === 0}
                className="inline-flex items-center gap-1 bg-[#191F28] dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white h-8 px-3 rounded-xl text-xs font-extrabold tabular-nums transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>인쇄</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={activePrintProducts.length === 0 || isDownloading}
                className="inline-flex items-center gap-1 bg-[#E60012] hover:bg-[#C8000F] text-white h-8 px-3 rounded-xl text-xs font-extrabold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{isDownloading ? '생성중...' : 'PDF'}</span>
              </button>

              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={install}
                  className="hidden sm:inline-flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-800 text-[#191F28] dark:text-slate-200 h-8 px-2.5 rounded-xl text-xs font-bold border border-[#E5E8EB] dark:border-slate-700 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>설치</span>
                </button>
              )}

              {isIOS && !isInstalled && (
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(true)}
                  className="hidden sm:inline-flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-800 text-[#191F28] dark:text-slate-200 h-8 px-2.5 rounded-xl text-xs font-bold border border-[#E5E8EB] dark:border-slate-700 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                aria-label="설정 열기"
                className="w-8 h-8 flex items-center justify-center text-[#4E5968] dark:text-slate-300 bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 rounded-xl transition cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2열: 상황 맞춤 슬림 옵션 바 (POP 형태 3종 + 선택한 형태에 필요한 스위치만 노출) */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#E5E8EB] dark:border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1) POP 형태·용지 규격 (3종) */}
              <div className="inline-flex items-center bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaperSize('a4-4up')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    paperSize === 'a4-4up'
                      ? 'bg-[#E60012] text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white'
                  }`}
                  title="전자가격표(ESL) 바로 아래 부착하는 프리드 체감가 미니 POP (A4 1장당 4모델 출력)"
                >
                  하단 미니 (4분할)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a4-2up')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    paperSize === 'a4-2up'
                      ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white'
                  }`}
                  title="기존 A5 세로 상세형 쇼카드 (A4 1장당 2모델 출력)"
                >
                  기본 쇼카드 (2분할)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a3-portrait')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    paperSize === 'a3-portrait'
                      ? 'bg-[#059669] text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#059669] dark:hover:text-emerald-400'
                  }`}
                  title="A3 세로 1장에 크게 뽑는 단독 연출 포스터"
                >
                  A3 포스터
                </button>
              </div>

              {/* 2) 선택된 형태별 핵심 세부 옵션만 깔끔하게 분기 */}
              {paperSize === 'a4-4up' ? (
                <div className="inline-flex items-center bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUnderPreedScope('optimal')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                      underPreedScope === 'optimal'
                        ? 'bg-[#191F28] text-white dark:bg-amber-400 dark:text-slate-950 shadow-2xs'
                        : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28]'
                    }`}
                    title="앞자리가 확 낮아지는 최적 구좌수로 체감가를 자동 계산합니다"
                  >
                    최적 체감가
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnderPreedScope('single')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                      underPreedScope === 'single'
                        ? 'bg-[#191F28] text-white dark:bg-amber-400 dark:text-slate-950 shadow-2xs'
                        : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28]'
                    }`}
                    title="1구좌 기준 보수적인 지원금만 반영합니다"
                  >
                    1구좌 기준
                  </button>
                </div>
              ) : (
                <>
                  <div className="inline-flex items-center bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPopMode('standard')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        popMode === 'standard'
                          ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                          : 'text-[#4E5968] dark:text-slate-300'
                      }`}
                    >
                      카드 단독
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopMode('preed')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        popMode === 'preed'
                          ? 'bg-[#E60012] text-white'
                          : 'text-[#4E5968] dark:text-slate-300'
                      }`}
                    >
                      프리드 비교
                    </button>
                  </div>

                  {products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetAllCare(!anyAllCare)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition cursor-pointer whitespace-nowrap ${
                        anyAllCare
                          ? 'bg-[#059669] text-white border-[#059669]'
                          : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700'
                      }`}
                    >
                      🛡️ 올케어 {anyAllCare ? 'ON' : 'OFF'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 3) 우측: 제휴카드 선택 + 필터 */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              <div className="inline-flex items-center bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                {CARD_BENEFITS.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCardId(card.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#1B64DA] text-white shadow-2xs'
                          : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28]'
                      }`}
                    >
                      {card.name.replace('카드', '')} -1.8만
                    </button>
                  );
                })}
              </div>

              {products.length > 0 && (
                <div className="inline-flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 px-2 py-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
                  <Filter className="w-3.5 h-3.5 text-[#8B95A1] shrink-0" />
                  <select
                    value={printMode}
                    onChange={(e) => setPrintMode(e.target.value as any)}
                    className="bg-transparent dark:bg-slate-900 border-none text-xs font-bold text-[#191F28] dark:text-slate-100 focus:ring-0 cursor-pointer py-0.5 pr-4 whitespace-nowrap"
                  >
                    <option value="all">전체 ({products.length})</option>
                    {products.some((p) => p.isAllCare) && (
                      <option value="allcare">
                        올케어만 ({products.filter((p) => p.isAllCare).length})
                      </option>
                    )}
                    {products.some((p) => !p.isAllCare) &&
                      products.some((p) => p.isAllCare) && (
                        <option value="standard">
                          일반만 ({products.filter((p) => !p.isAllCare).length})
                        </option>
                      )}
                    <option value="changed">
                      변동 ({products.filter((p) => p.changeStatus === 'changed').length})
                    </option>
                    <option value="new">
                      신규 ({products.filter((p) => p.changeStatus === 'new').length})
                    </option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 업로드 알림 토스트 */}
      {uploadSuccessMessage && (
        <div className="bg-[#191F28] dark:bg-slate-800 text-white text-center py-2 px-4 text-xs sm:text-sm font-bold no-print flex items-center justify-center gap-2 border-b border-slate-700">
          <span>{uploadSuccessMessage}</span>
          <button
            type="button"
            onClick={() => setUploadSuccessMessage(null)}
            className="ml-2 text-slate-300 hover:text-white text-xs bg-white/10 px-2 py-0.5 rounded cursor-pointer"
          >
            닫기 ✕
          </button>
        </div>
      )}

      {/* ==================== 메인 미리보기 캔버스 ==================== */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 print:p-0 print:max-w-none">
        {/* 빈 상태 화면: 선택된 모드(하단 미니 등)의 실물 예시를 바로 보여줌 */}
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center no-print py-8 sm:py-12">
            <div className="text-center mb-6 max-w-md">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#191F28] dark:text-slate-50 mb-1.5">
                등록된 구독 POP 상품이 없습니다
              </h2>
              <p className="text-xs sm:text-sm text-[#4E5968] dark:text-slate-400">
                견적 사진을 찍거나 엑셀 파일을 올리면 아래 디자인으로 즉시 생성됩니다.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setScannerInitialImage(null);
                    setIsImageScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-2 bg-[#1B64DA] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-extrabold shadow-xs transition cursor-pointer text-xs sm:text-sm"
                >
                  <Camera className="w-4 h-4" />
                  견적 사진 · 캡처 등록
                </button>
                <button
                  type="button"
                  onClick={() => setIsDataModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 px-5 py-2.5 rounded-xl font-extrabold hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition cursor-pointer text-xs sm:text-sm"
                >
                  <Upload className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                  엑셀 일괄 업로드
                </button>
              </div>
            </div>

            <div className="w-full max-w-[580px] flex flex-col items-center gap-2">
              <span className="text-[11px] font-extrabold text-[#8B95A1] dark:text-slate-400">
                미리보기 예시 ({paperSize === 'a4-4up' ? '전자가격표 하단 부착형 · A4 4분할' : '기본 쇼카드'})
              </span>
              <div className="opacity-85 pointer-events-none w-full flex justify-center">
                <PopCard
                  product={{
                    id: 'sample-preview',
                    category: '에어드레서',
                    modelName: 'DF90H24R4D',
                    period: 60,
                    monthlyFee: 48064,
                    careServiceText: '방문 케어 서비스',
                    careServiceCycle: '12개월',
                    careServiceCount: '5회',
                    imageUrl: '',
                    changeStatus: 'unchanged',
                  }}
                  cardBenefit={selectedCard}
                  popMode={popMode}
                  paperSize={paperSize}
                  underPreedScope={underPreedScope}
                />
              </div>
            </div>
          </div>
        )}

        {/* 등록 상품 목록 */}
        {products.length > 0 && (
          <div className="w-full">
            {/* A3 모드일 때만 심플한 선택 안내 바 노출 */}
            {paperSize === 'a3-portrait' && (
              <div className="no-print print:hidden mb-4 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/12 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#191F28] dark:text-slate-100">
                  원하는 모델만 체크해 모아 뽑거나 각 카드 위 <strong>[단독 인쇄 / 단독 PDF]</strong>를 누르세요.
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOnlySelectedInA3(false)}
                    className={`px-2.5 py-1 rounded-lg font-extrabold border cursor-pointer ${
                      !onlySelectedInA3 || selectedDisplayedProducts.length === 0
                        ? 'bg-[#191F28] text-white border-[#191F28]'
                        : 'bg-white text-[#4E5968] border-[#D1D6DB]'
                    }`}
                  >
                    전체 ({displayedProducts.length}장)
                  </button>
                  <button
                    type="button"
                    disabled={selectedDisplayedProducts.length === 0}
                    onClick={() => setOnlySelectedInA3(true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-extrabold border cursor-pointer disabled:opacity-40 ${
                      onlySelectedInA3 && selectedDisplayedProducts.length > 0
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : 'bg-white text-[#059669] border-emerald-300'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    선택만 ({selectedDisplayedProducts.length}장)
                  </button>
                  {selectedA3Ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedA3Ids([]);
                        setOnlySelectedInA3(false);
                      }}
                      className="px-2 py-1 rounded-lg bg-white text-[#4E5968] border border-[#D1D6DB] font-bold cursor-pointer"
                    >
                      해제
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 1. 웹 화면용 프리뷰 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:hidden">
              {displayedProducts.map((product) => (
                <PopCard
                  key={product.id}
                  product={product}
                  cardBenefit={selectedCard}
                  popMode={popMode}
                  paperSize={paperSize}
                  underPreedScope={underPreedScope}
                  isA3Selected={selectedA3Ids.includes(product.id)}
                  onToggleAllCare={handleToggleAllCare}
                  onToggleA3Select={handleToggleA3Select}
                  onQuickPrintA3={handleQuickPrintA3}
                  onQuickDownloadA3Pdf={handleQuickDownloadA3Pdf}
                />
              ))}
            </div>

            {/* 2. 인쇄 / PDF 전용 영역 (#print-area): A4 4분할 · A4 2분할 · A3 단독 모두 지원 */}
            <div id="print-area" className="hidden print:block w-full">
              {effectivePaperSize === 'a3-portrait'
                ? activePrintProducts.map((product, idx) => (
                    <React.Fragment key={`a3-wrap-${product.id}-${idx}`}>
                      <div className="print-page-a3-pdf w-[156mm] h-[220.62mm] mx-auto flex items-center justify-center relative overflow-hidden bg-white print:hidden">
                        <PopCard
                          product={product}
                          cardBenefit={selectedCard}
                          popMode={popMode}
                          paperSize="a3-portrait"
                          isPrintSheet={true}
                          isA3BrowserPrintScale={false}
                        />
                      </div>

                      <div
                        className="print-page print-page-a3 hidden print:flex w-[297mm] h-[418mm] mx-auto items-center justify-center relative overflow-hidden bg-white"
                        style={
                          idx < activePrintProducts.length - 1
                            ? { pageBreakAfter: 'always', breakAfter: 'page' }
                            : { pageBreakAfter: 'auto', breakAfter: 'auto' }
                        }
                      >
                        <PopCard
                          product={product}
                          cardBenefit={selectedCard}
                          popMode={popMode}
                          paperSize="a3-portrait"
                          isPrintSheet={true}
                          isA3BrowserPrintScale={true}
                        />
                      </div>
                    </React.Fragment>
                  ))
                : effectivePaperSize === 'a4-4up'
                ? productQuads.map((quad, idx) => (
                    <div
                      key={`a4-4up-${idx}`}
                      className="print-page print-page-a4-4up w-[297mm] h-[210mm] mx-auto grid grid-cols-2 grid-rows-2 relative overflow-hidden bg-white"
                      style={
                        idx < productQuads.length - 1
                          ? { pageBreakAfter: 'always', breakAfter: 'page' }
                          : { pageBreakAfter: 'auto', breakAfter: 'auto' }
                      }
                    >
                      {/* 십자(+) 중앙 재단 점선 */}
                      <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-slate-400/75 z-50 pointer-events-none"></div>
                      <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-slate-400/75 z-50 pointer-events-none"></div>

                      {quad.map((product) => (
                        <div
                          key={product.id}
                          className="w-[148.5mm] h-[105mm] p-[6mm] flex items-center justify-center relative overflow-hidden box-border bg-white"
                        >
                          <PopCard
                            product={product}
                            cardBenefit={selectedCard}
                            popMode={popMode}
                            paperSize="a4-4up"
                            underPreedScope={underPreedScope}
                            isPrintSheet={true}
                          />
                        </div>
                      ))}
                    </div>
                  ))
                : productPairs.map((pair, idx) => (
                    <div
                      key={`a4-2up-${idx}`}
                      className="print-page print-page-a4 w-[297mm] h-[210mm] mx-auto flex relative overflow-hidden bg-white"
                      style={
                        idx < productPairs.length - 1
                          ? { pageBreakAfter: 'always', breakAfter: 'page' }
                          : { pageBreakAfter: 'auto', breakAfter: 'auto' }
                      }
                    >
                      <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-slate-400 z-50"></div>

                      {pair.map((product) => (
                        <div
                          key={product.id}
                          className="w-[148.5mm] h-[210mm] flex items-center justify-center box-border shrink-0"
                        >
                          <div className="w-full h-full relative">
                            <PopCard
                              product={product}
                              cardBenefit={selectedCard}
                              popMode={popMode}
                              paperSize="a4-2up"
                              isPrintSheet={true}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
            </div>

            {displayedProducts.length === 0 && (
              <div className="text-center text-slate-500 mt-16 no-print w-full text-sm font-bold">
                선택한 필터에 해당하는 모델이 없습니다.
              </div>
            )}
          </div>
        )}
      </main>

      {/* 자료 관리 모달 */}
      <FlagshipModalShell
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        title="자료 관리 및 업로드"
        subtitle="엑셀 시트 일괄 등록 또는 AI 견적서 사진 인식으로 POP 목록을 관리합니다."
        icon={<FileSpreadsheet className="w-5 h-5 text-[#1B64DA] dark:text-blue-400" />}
        maxWidthClass="max-w-lg"
        zIndexClass="z-50 no-print"
      >
        <div className="mb-5 bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs sm:text-sm text-[#4E5968] dark:text-slate-300">
              현재 로드된 모델 수
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">
              {products.length} 개
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-[#4E5968] dark:text-slate-400 border-t border-[#E5E8EB] dark:border-slate-800 pt-2 mt-2 tabular-nums">
            <span>새로 추가됨: {products.filter((p) => p.changeStatus === 'new').length}</span>
            <span>가격 변동: {products.filter((p) => p.changeStatus === 'changed').length}</span>
            <span className="text-[#059669] dark:text-emerald-400 font-extrabold">
              올케어 적용: {products.filter((p) => p.isAllCare).length}개
            </span>
          </div>
          {products.length > 0 && (
            <div className="flex gap-2 pt-2.5 border-t border-[#E5E8EB] dark:border-slate-800 text-xs mt-2.5">
              <button
                type="button"
                onClick={() => handleSetAllCare(true)}
                className="flex-1 py-2 px-2 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-[#059669] dark:text-emerald-300 font-extrabold rounded-xl border border-emerald-200 dark:border-emerald-500/30 transition-colors cursor-pointer"
              >
                🛡️ 전체 올케어로 변경
              </button>
              <button
                type="button"
                onClick={() => handleSetAllCare(false)}
                className="flex-1 py-2 px-2 bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 font-bold rounded-xl border border-[#D1D6DB] dark:border-slate-700 transition-colors cursor-pointer"
              >
                전체 일반으로 변경
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setIsDataModalOpen(false);
              setScannerInitialImage(null);
              setIsImageScannerOpen(true);
            }}
            className="w-full flex items-center justify-between p-4 text-white bg-[#1B64DA] hover:bg-blue-700 rounded-2xl shadow-xs transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-sm flex items-center gap-1.5 flex-wrap">
                  <span>견적서 / POS 사진 AI 자동 인식</span>
                </div>
                <div className="text-xs text-blue-100 mt-0.5 font-medium">
                  스마트폰 사진이나 화면 캡처(Ctrl+V)로 POP 카드 즉시 생성
                </div>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-blue-200 shrink-0" />
          </button>

          <label className="relative flex items-center justify-center w-full px-6 py-4 text-sm font-bold text-[#1B64DA] dark:text-blue-300 bg-[#EFF6FF]/60 dark:bg-blue-500/10 border-2 border-[#BFDBFE] dark:border-blue-500/35 border-dashed rounded-2xl cursor-pointer hover:bg-[#EFF6FF] dark:hover:bg-blue-500/15 transition-colors">
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 mb-1" />
              <span className="font-extrabold">
                {loading ? '처리 중...' : '엑셀 자료 추가 업로드 (.xlsx, .xls, .csv)'}
              </span>
              <span className="text-xs font-medium text-[#4E5968] dark:text-slate-400 text-center">
                파일명/시트명에 &lsquo;올케어&rsquo;가 포함되면 2년 수리비 보증이 자동 적용됩니다.
              </span>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>

          {confirmClearAll ? (
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearData}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-extrabold text-white bg-[#E60012] rounded-xl hover:bg-[#C8000F] transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                네, 전체 삭제합니다
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="px-4 py-3 text-sm font-bold text-[#4E5968] dark:text-slate-300 bg-[#F2F4F6] dark:bg-slate-800 rounded-xl hover:bg-[#E5E8EB] dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              disabled={products.length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-extrabold text-[#E60012] dark:text-rose-300 bg-[#FFF1F2] dark:bg-rose-500/12 border border-[#FECDD3] dark:border-rose-500/30 rounded-xl hover:bg-rose-100/70 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              기존 자료 모두 삭제
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-[#FFF1F2] dark:bg-rose-500/12 text-[#E60012] dark:text-rose-300 rounded-xl text-xs sm:text-sm font-bold border border-[#FECDD3] dark:border-rose-500/30">
            {error}
          </div>
        )}
      </FlagshipModalShell>

      {/* 설정 모달 */}
      <FlagshipModalShell
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="AI 인식 설정"
        subtitle="견적 사진 인식용 Gemini API 키 및 모델 설정"
        icon={<Settings className="w-5 h-5 text-[#4E5968] dark:text-slate-300" />}
        maxWidthClass="max-w-md"
        zIndexClass="z-50 no-print"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
              className="flex-1 py-2.5 bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#4E5968] dark:text-slate-200 font-bold text-sm rounded-xl hover:bg-[#F2F4F6] dark:hover:bg-slate-700 transition cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex-1 py-2.5 bg-[#1B64DA] text-white font-extrabold text-sm rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              설정 저장
            </button>
          </div>
        }
      >
        <div className="bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 rounded-xl p-4">
          <h4 className="font-extrabold text-[#1B64DA] dark:text-blue-300 mb-2 flex items-center gap-1.5 text-sm">
            ✨ Gemini 사진 자동인식 설정
          </h4>

          <div className="space-y-3 mt-3">
            <div>
              <label className="block text-xs font-bold text-[#191F28] dark:text-slate-200 mb-1">
                API Key 입력
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AI Studio API Key를 입력하세요"
                className="w-full px-3 py-2 bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-xl text-base sm:text-sm text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191F28] dark:text-slate-200 mb-1">
                AI 모델 선택
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-xl text-base sm:text-sm text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
              >
                <option value="gemini-3.8-flash">
                  gemini-3.8-flash (초고속·고정밀 권장)
                </option>
                <option value="gemini-4-hydrogen">
                  gemini-4-hydrogen (Gemini 4 경량 프론티어)
                </option>
                <option value="gemini-3.5-flash-lite">
                  gemini-3.5-flash-lite (초경량 최고속)
                </option>
                <option value="gemini-3.6-flash">
                  gemini-3.6-flash (안정형 Flash)
                </option>
              </select>
            </div>

            <div className="text-xs text-[#4E5968] dark:text-slate-300 flex justify-between items-center mt-2">
              <span>키가 없으신가요?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-[#1B64DA] dark:text-blue-300 underline hover:opacity-80"
              >
                API 키 발급받기
              </a>
            </div>
          </div>
        </div>
      </FlagshipModalShell>

      {/* iOS 홈 화면 추가 안내 모달 */}
      <FlagshipModalShell
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
        title="🍎 홈 화면에 추가하기"
        maxWidthClass="max-w-sm"
        zIndexClass="z-50 no-print"
        footer={
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="w-full rounded-xl bg-[#191F28] dark:bg-[#60A5FA] py-2.5 text-sm font-extrabold text-white dark:text-[#0B1120] hover:opacity-90 transition cursor-pointer"
          >
            확인
          </button>
        }
      >
        <p className="text-sm text-[#4E5968] dark:text-slate-300 leading-relaxed">
          Safari 하단 <strong>공유(Share)</strong> 버튼을 누른 뒤{' '}
          <strong>[홈 화면에 추가]</strong>를 선택하세요.
        </p>
      </FlagshipModalShell>

      <ImageScannerModal
        isOpen={isImageScannerOpen}
        onClose={() => {
          setIsImageScannerOpen(false);
          setScannerInitialImage(null);
        }}
        onAddProduct={handleAddProductFromScanner}
        initialImage={scannerInitialImage}
        apiKey={apiKey}
        model={aiModel}
      />
    </div>
  );
}

export default PopPrinterApp;
