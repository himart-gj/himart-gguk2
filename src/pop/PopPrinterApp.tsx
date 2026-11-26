import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Printer, CreditCard, Settings, Trash2, X, Filter, Download, FileText, Camera, Sparkles, ArrowLeft, Maximize2, Columns2, CheckSquare } from 'lucide-react';
import { ProductData, CARD_BENEFITS, PopPaperSize } from './types';
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

// PWA Install Hook
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
        // quota fallback handled by inMemoryPopProductsCache
      }
    }
  }, [products]);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>(CARD_BENEFITS[0].id);
  const [popMode, setPopMode] = useState<'standard' | 'preed'>('standard');
  const [paperSize, setPaperSize] = useState<PopPaperSize>('a4-2up');
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

  // 구독 POP 내부 모달 열림 시 뒤로가기로 해당 모달만 먼저 닫기
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
  
  // Print Mode
  const [printMode, setPrintMode] = useState<'all' | 'changed' | 'new' | 'allcare' | 'standard'>('all');

  const handleToggleAllCare = (id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isAllCare: !p.isAllCare } : p));
  };

  const handleSetAllCare = (enable: boolean) => {
    setProducts(prev => prev.map(p => ({ ...p, isAllCare: enable })));
  };

  const handleAddProductFromScanner = (newProduct: ProductData) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.modelName === newProduct.modelName);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...newProduct, changeStatus: 'changed' };
        return updated;
      }
      return [newProduct, ...prev];
    });
    setUploadSuccessMessage(
      `📸 [${newProduct.category || '가전'}] ${newProduct.modelName} 모델이 견적서 사진에서 인식되어 POP 목록에 추가되었습니다!`
    );
    setTimeout(() => setUploadSuccessMessage(null), 6000);
  };

  // 전역 클립보드 이미지 붙여넣기(Ctrl+V) 리스너
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

  // Load API key and model from local storage on mount (1~4번 메뉴 공통 키 'gemini_api_key' 공유)
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
        // parseExcel이 판별한 각 상품의 p.isAllCare 값을 그대로 따름
        const finalProducts = parsedProducts;
        const hasAnyAllCare = finalProducts.some(p => p.isAllCare);

        // 기존 데이터와 비교 (Diff Logic)
        if (products.length === 0) {
          // 최초 업로드면 모두 'new'
          setProducts(finalProducts.map(p => ({ ...p, changeStatus: 'new' })));
        } else {
          // 기존 데이터 병합 및 비교
          const newProductsList = [...products];
          
          finalProducts.forEach(parsed => {
            const existingIndex = newProductsList.findIndex(p => p.modelName === parsed.modelName);
            if (existingIndex >= 0) {
              const existing = newProductsList[existingIndex];
              newProductsList[existingIndex] = {
                ...existing,
                ...parsed,
                id: existing.id,
                isAllCare: parsed.isAllCare ?? existing.isAllCare,
                changeStatus: existing.monthlyFee !== parsed.monthlyFee ? 'changed' : 'unchanged'
              };
            } else {
              // 새로 추가
              newProductsList.push({ ...parsed, changeStatus: 'new' });
            }
          });
          
          setProducts(newProductsList);
        }

        // 업로드 성공 알림 및 모달 닫기
        setIsDataModalOpen(false);
        if (hasAnyAllCare) {
          setUploadSuccessMessage('🛡️ [올케어] 자료가 감지되어 [사용중인 가전 2년 수리비 보증] 혜택이 자동 적용되었습니다!');
        } else {
          setUploadSuccessMessage(`${finalProducts.length}개 모델이 성공적으로 로드되었습니다.`);
        }
        setTimeout(() => setUploadSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (e.target) e.target.value = ''; // Reset input
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
      // 모바일/갤럭시폴드/태블릿의 좁은 화면 폭에 눌리지 않도록 1200px 고정 오프스크린 스테이지에서 렌더링
      printArea.classList.remove('hidden', 'print:block');
      printArea.style.cssText =
        'display: block; position: fixed; left: -20000px; top: 0; width: 1200px; min-width: 1200px; background: #ffffff; z-index: -1; pointer-events: none;';

      // 웹폰트(Pretendard) 및 레이아웃 완료 대기
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
      const selector = isA3 ? '.print-page-a3-pdf' : '.print-page-a4';
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
        // scale(1) 원본 비율 상태에서 pixelRatio 3.4로 초고해상도 래스터화 -> 폰트 자간 팽창·깨짐 0% 보장
        const pageDataUrl = await toJpeg(page, {
          quality: 0.97,
          backgroundColor: '#ffffff',
          width: captureW,
          height: captureH,
          pixelRatio: isA3 ? 3.4 : 2.4,
          style: {
            transform: 'none',
            margin: '0',
          },
        });

        if (i > 0) pdf.addPage();
        pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
      }

      const defaultName = isA3 ? '구독POP_A3세로_단독연출.pdf' : '구독POP_A4_2분할_출력물.pdf';
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

  // 카드별 [A3 단독인쇄] / [A3 PDF] 원클릭 작업 큐 실행 및 자동 복구
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
        // 데스크톱 브라우저에서 window.print() 반환 직후 안전 복구
        window.setTimeout(cleanup, 600);
      } else {
        const safeModel = (singleA3Job.product.modelName || '단독모델').replace(/[\/:*?"<>|]/g, '_');
        await exportPrintAreaToPDF('a3-portrait', `구독POP_A3세로_${safeModel}.pdf`);
        if (!cancelled) setSingleA3Job(null);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [singleA3Job]);

  const selectedCard = CARD_BENEFITS.find(c => c.id === selectedCardId) || CARD_BENEFITS[0];

  // 필터링된 상품 목록 (웹 화면 표시 기준)
  const displayedProducts = products.filter(p => {
    if (printMode === 'changed') return p.changeStatus === 'changed';
    if (printMode === 'new') return p.changeStatus === 'new';
    if (printMode === 'allcare') return !!p.isAllCare;
    if (printMode === 'standard') return !p.isAllCare;
    return true; // 'all'
  });

  // A3 세로 개별 연출 체크된 모델 목록 (현재 필터 내)
  const selectedDisplayedProducts = displayedProducts.filter((p) =>
    selectedA3Ids.includes(p.id)
  );

  // 실제 인쇄/PDF 영역(#print-area)에 렌더링될 규격 및 대상 모델
  const effectivePaperSize: PopPaperSize = singleA3Job ? 'a3-portrait' : paperSize;
  const activePrintProducts: ProductData[] = singleA3Job
    ? [singleA3Job.product]
    : effectivePaperSize === 'a3-portrait' &&
      onlySelectedInA3 &&
      selectedDisplayedProducts.length > 0
    ? selectedDisplayedProducts
    : displayedProducts;

  // A4 가로 2분할 인쇄용 묶음 (2개씩)
  const productPairs: ProductData[][] = [];
  for (let i = 0; i < activePrintProducts.length; i += 2) {
    productPairs.push(activePrintProducts.slice(i, i + 2));
  }

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
      {/* Header (Hidden on Print) */}
      <header
        style={{ top: 'var(--app-header-h, 54px)' }}
        className="bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-slate-800 sticky z-20 shadow-2xs no-print"
      >
        <div className="max-w-7xl mx-auto px-2.5 sm:px-5 py-2.5 flex flex-col gap-2">
          {/* Top Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap xl:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 font-bold text-xs border border-[#E5E8EB] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {backLabel || '홈으로'}
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="text-[#1B64DA] dark:text-blue-400 w-4 h-4 shrink-0" />
                </div>
                <h1 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 whitespace-nowrap truncate">
                  구독 POP 자동 출력기
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 shrink-0">
                  A4 · A3 쇼카드
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end ml-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScannerInitialImage(null);
                  setIsImageScannerOpen(true);
                }}
                className="flex items-center gap-1 sm:gap-1.5 bg-[#1B64DA] hover:bg-blue-700 text-white h-8 px-2.5 sm:px-3 rounded-xl text-[11.5px] sm:text-xs font-extrabold shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="스마트폰 견적 화면 사진이나 캡처 이미지를 AI가 자동으로 읽어 POP 카드로 만듭니다 (Ctrl+V 붙여넣기 지원)"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>사진/캡처 AI 등록</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 h-8 px-2.5 sm:px-3 rounded-xl text-[11.5px] sm:text-xs font-bold border border-[#BFDBFE] dark:border-blue-500/30 hover:bg-blue-100/70 dark:hover:bg-blue-500/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>자료 관리 (엑셀)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                aria-label="설정 열기"
                className="w-8 h-8 flex items-center justify-center text-[#4E5968] dark:text-slate-300 bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Row (모바일/폴드용 상단 설정 바 - lg 이상에서는 좌측 패널에서도 제어 가능) */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap xl:flex-nowrap border-t border-[#E5E8EB] dark:border-slate-800 pt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Paper Size Switch (A4 가로 2분할 쇼카드 vs A3 세로 단독 연출) */}
              <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaperSize('a4-2up')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] sm:text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    paperSize === 'a4-2up'
                      ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800'
                  }`}
                  title="A4 가로 용지 1장에 2개 모델을 나란히 배치하여 반으로 재단해 쓰는 기본 쇼카드 모드"
                >
                  <Columns2 className="w-3.5 h-3.5 shrink-0" />
                  <span>A4 2분할</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a3-portrait')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] sm:text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    paperSize === 'a3-portrait'
                      ? 'bg-[#059669] text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#059669] dark:hover:text-emerald-400 hover:bg-white/70 dark:hover:bg-slate-800'
                  }`}
                  title="A3 세로(297×420mm) 용지 1장에 1개 모델을 2배 크기로 단독 확대 출력하는 개별 연출 모드"
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>A3 세로 단독</span>
                </button>
              </div>

              {/* POP Mode Switch (일반모드 vs 상조모드) */}
              <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPopMode('standard')}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] sm:text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    popMode === 'standard'
                      ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800'
                  }`}
                >
                  💳 일반모드 (카드단독)
                </button>
                <button
                  type="button"
                  onClick={() => setPopMode('preed')}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] sm:text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    popMode === 'preed'
                      ? 'bg-[#E60012] text-white shadow-2xs'
                      : 'text-[#4E5968] dark:text-slate-300 hover:text-[#E60012] dark:hover:text-rose-400 hover:bg-white/70 dark:hover:bg-slate-800'
                  }`}
                >
                  👑 상조모드 (1안·2안 비교)
                </button>
              </div>

              {/* Card Selector (Compact Inline Buttons) */}
              <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 p-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800 max-w-full overflow-x-auto">
                <CreditCard className="w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-400 ml-1.5 shrink-0" />
                {CARD_BENEFITS.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  const shortCardName = card.name.replace('하이마트 ', '').replace('구독 ', '');
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCardId(card.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] sm:text-xs font-bold tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B64DA] text-white shadow-2xs'
                          : 'text-[#4E5968] dark:text-slate-300 hover:text-[#191F28] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      {shortCardName} ({card.discount.toLocaleString()}원)
                    </button>
                  );
                })}
              </div>

              {/* Print Filter Selector */}
              {products.length > 0 && (
                <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-900 px-2.5 py-0.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-400 shrink-0" />
                  <select
                    value={printMode}
                    onChange={(e) => setPrintMode(e.target.value as any)}
                    className="bg-transparent dark:bg-slate-900 border-none text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:ring-0 cursor-pointer px-1 py-0.5 pr-5 whitespace-nowrap"
                  >
                    <option value="all">전체 인쇄 ({products.length})</option>
                    {products.some((p) => p.isAllCare) && (
                      <option value="allcare">
                        🛡️ 올케어 모델만 ({products.filter((p) => p.isAllCare).length})
                      </option>
                    )}
                    {products.some((p) => !p.isAllCare) &&
                      products.some((p) => p.isAllCare) && (
                        <option value="standard">
                          일반 모델만 ({products.filter((p) => !p.isAllCare).length})
                        </option>
                      )}
                    <option value="changed">
                      가격 변동 모델만 ({products.filter((p) => p.changeStatus === 'changed').length})
                    </option>
                    <option value="new">
                      새로 추가된 모델만 ({products.filter((p) => p.changeStatus === 'new').length})
                    </option>
                  </select>
                </div>
              )}

              {/* All-Care Quick Mode Switch */}
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const anyAllCare = products.some((p) => p.isAllCare);
                    handleSetAllCare(!anyAllCare);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11.5px] sm:text-xs font-extrabold border transition-colors whitespace-nowrap shrink-0 shadow-2xs cursor-pointer ${
                    products.some((p) => p.isAllCare)
                      ? 'bg-[#059669] text-white border-[#059669] hover:bg-emerald-700'
                      : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700 hover:bg-[#F2F4F6] dark:hover:bg-slate-700'
                  }`}
                  title="클릭하여 전체 카드의 올케어(사용중인가전 2년 수리비 보증)를 켜거나 끕니다"
                >
                  <span className="text-xs">🛡️</span>
                  <span>
                    올케어 {products.some((p) => p.isAllCare) ? '적용중(ON)' : '미적용(OFF)'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={install}
                  className="flex items-center gap-1 bg-[#1B64DA] text-white px-2.5 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  앱 설치하기
                </button>
              )}

              {isIOS && !isInstalled && (
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(true)}
                  className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-slate-800 text-[#191F28] dark:text-slate-100 px-2.5 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-bold border border-[#E5E8EB] dark:border-slate-700 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  홈 화면 추가
                </button>
              )}

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={activePrintProducts.length === 0}
                className={`flex items-center gap-1 text-white px-3 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold tabular-nums transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer ${
                  paperSize === 'a3-portrait'
                    ? 'bg-[#059669] hover:bg-emerald-700'
                    : 'bg-[#191F28] dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                {paperSize === 'a3-portrait'
                  ? `A3 세로 인쇄 (${activePrintProducts.length}장)`
                  : `A4 인쇄 (${activePrintProducts.length}건)`}
              </button>

              {/* PDF Button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={activePrintProducts.length === 0 || isDownloading}
                className="flex items-center gap-1 bg-[#E60012] text-white px-3 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-extrabold hover:bg-[#C8000F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {isDownloading
                  ? 'PDF 생성 중...'
                  : paperSize === 'a3-portrait'
                  ? 'A3 PDF 저장'
                  : 'A4 PDF 저장'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Upload Notification Toast Banner */}
      {uploadSuccessMessage && (
        <div className="bg-[#191F28] dark:bg-slate-800 text-white text-center py-2.5 px-4 text-xs sm:text-sm font-bold shadow-md no-print flex items-center justify-center gap-2 border-b border-slate-700">
          <span>🛡️</span>
          <span>{uploadSuccessMessage}</span>
          <button
            type="button"
            onClick={() => setUploadSuccessMessage(null)}
            className="ml-3 text-slate-300 hover:text-white text-[11.5px] bg-white/10 px-2 py-0.5 rounded-md cursor-pointer"
          >
            닫기 ✕
          </button>
        </div>
      )}

      {/* Main Content: 모바일/폴드는 상단 설정 + 하단 POP 미리보기, PC(lg 이상)는 좌측 설정 패널 + 우측 POP 미리보기 2단 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 print:p-0 print:max-w-none flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* PC 대화면(lg 이상) 전용 좌측 고정 설정 패널 */}
        <aside className="hidden lg:flex lg:col-span-3 w-full bg-white dark:bg-[#131C2E] rounded-[20px] border border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_10px_rgba(25,31,40,0.03)] p-4 flex-col gap-4 sticky top-28 no-print">
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold text-[#191F28] dark:text-slate-50">
              POP 빠른 설정 패널
            </h2>
            <p className="text-xs text-[#4E5968] dark:text-slate-400 leading-relaxed">
              A4 2분할 재단용 쇼카드와 A3 세로(297×420mm) 단독 연출 포스터를 즉시 전환·출력합니다.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setScannerInitialImage(null);
                setIsImageScannerOpen(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-blue-700 text-white text-xs font-extrabold shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              사진/캡처 AI 자동 등록
            </button>
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100/70 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 text-xs font-bold tabular-nums flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              엑셀 자료 관리 ({products.length}건)
            </button>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#E5E8EB] dark:border-slate-800">
            <label className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300 block">
              출력 용지 규격 (쇼카드 vs 단독연출)
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => setPaperSize('a4-2up')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-extrabold border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                  paperSize === 'a4-2up'
                    ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA] shadow-2xs'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Columns2 className="w-3.5 h-3.5 shrink-0" />
                    <span>A4 가로 2분할 (기본 쇼카드)</span>
                  </span>
                  {paperSize === 'a4-2up' && (
                    <span className="text-[11.5px] font-bold opacity-90">선택됨</span>
                  )}
                </div>
                <span
                  className={`text-[11.5px] font-medium ${
                    paperSize === 'a4-2up'
                      ? 'text-slate-300 dark:text-slate-900/80'
                      : 'text-[#8B95A1] dark:text-slate-400'
                  }`}
                >
                  297×210mm · 1장당 2모델 중앙 재단선
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaperSize('a3-portrait')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-extrabold border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                  paperSize === 'a3-portrait'
                    ? 'bg-[#059669] text-white border-[#059669] shadow-2xs'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-800 hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                    <span>A3 세로 단독 (개별 연출)</span>
                  </span>
                  {paperSize === 'a3-portrait' && (
                    <span className="text-[11.5px] font-bold text-white">선택됨</span>
                  )}
                </div>
                <span
                  className={`text-[11.5px] font-medium ${
                    paperSize === 'a3-portrait'
                      ? 'text-emerald-100'
                      : 'text-[#8B95A1] dark:text-slate-400'
                  }`}
                >
                  297×420mm · 1장당 1모델 2배 확대 포스터
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#E5E8EB] dark:border-slate-800">
            <label className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300 block">
              POP 출력 레이아웃 모드
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => setPopMode('standard')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-extrabold border text-left flex items-center justify-between transition cursor-pointer ${
                  popMode === 'standard'
                    ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA] shadow-2xs'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                }`}
              >
                <span>💳 일반모드 (카드단독)</span>
                {popMode === 'standard' && (
                  <span className="text-[11.5px] font-bold opacity-90">선택됨</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPopMode('preed')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-extrabold border text-left flex items-center justify-between transition cursor-pointer ${
                  popMode === 'preed'
                    ? 'bg-[#E60012] text-white border-[#E60012] shadow-2xs'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#FFF1F2] dark:hover:bg-rose-500/10'
                }`}
              >
                <span>👑 상조모드 (1안·2안 비교)</span>
                {popMode === 'preed' && (
                  <span className="text-[11.5px] font-bold text-white">선택됨</span>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#E5E8EB] dark:border-slate-800">
            <label className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300 block">
              제휴카드 할인 기준 (36개월)
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {CARD_BENEFITS.map((card) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(card.id)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#1B64DA] text-white border-[#1B64DA] shadow-2xs'
                        : 'bg-[#F8FAFC] dark:bg-slate-900/70 text-[#191F28] dark:text-slate-200 border-[#E5E8EB] dark:border-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{card.name.replace('하이마트 ', '')}</span>
                    <span className="font-extrabold font-mono tabular-nums">
                      -{card.discount.toLocaleString()}원
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E5E8EB] dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrint}
              disabled={activePrintProducts.length === 0}
              className={`w-full py-2.5 px-3 rounded-xl text-white text-xs font-extrabold tabular-nums flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer ${
                paperSize === 'a3-portrait'
                  ? 'bg-[#059669] hover:bg-emerald-700'
                  : 'bg-[#191F28] dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600'
              }`}
            >
              <Printer className="w-4 h-4" />
              {paperSize === 'a3-portrait'
                ? `A3 세로 단독 인쇄 (${activePrintProducts.length}장)`
                : `A4 2분할 인쇄 (${activePrintProducts.length}건)`}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={activePrintProducts.length === 0 || isDownloading}
              className="w-full py-2.5 px-3 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              {isDownloading
                ? 'PDF 생성 중...'
                : paperSize === 'a3-portrait'
                ? '고해상도 A3 세로 PDF 저장'
                : '고해상도 A4 PDF 저장'}
            </button>
          </div>
        </aside>

        {/* 우측 POP 미리보기 영역 */}
        <div className="w-full lg:col-span-9 print:w-full">
          {/* Blank Template State */}
          {products.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center no-print pb-20">
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#191F28] dark:text-slate-50 mb-2">
                  현재 등록된 POP 자료가 없습니다.
                </h2>
                <p className="text-xs sm:text-sm text-[#4E5968] dark:text-slate-400">
                  엑셀 파일을 올리거나, 견적서/POS 사진을 찍어 AI로 바로 등록해보세요.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setScannerInitialImage(null);
                      setIsImageScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-2 bg-[#1B64DA] hover:bg-blue-700 text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-extrabold shadow-xs transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    <Camera className="w-5 h-5" />
                    견적서 사진 / 캡처 AI로 자동인식
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDataModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-white dark:bg-[#131C2E] text-[#191F28] dark:text-slate-100 border border-[#D1D6DB] dark:border-slate-700 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-extrabold shadow-2xs hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm"
                  >
                    <Upload className="w-5 h-5 text-[#1B64DA] dark:text-blue-400" />
                    엑셀 파일 일괄 등록
                  </button>
                </div>
              </div>

              <div className="opacity-40 pointer-events-none transform scale-75 origin-top filter grayscale blur-[1px] max-w-full overflow-hidden flex justify-center">
                {/* Dummy Card Preview */}
                <PopCard
                  product={{
                    id: 'dummy',
                    category: '가전',
                    modelName: '모델명 (자동입력)',
                    period: 36,
                    monthlyFee: 35000,
                    careServiceText: '방문 케어 서비스',
                    careServiceCycle: '3개월',
                    careServiceCount: '12회',
                    imageUrl: '',
                    changeStatus: 'unchanged',
                  }}
                  cardBenefit={selectedCard}
                  popMode={popMode}
                />
              </div>
            </div>
          )}

          {/* POP Grid */}
          {products.length > 0 && (
            <div className="w-full">
              {/* A3 세로 개별 연출 모드 안내 및 선택 모델 필터 바 */}
              {(paperSize === 'a3-portrait' || selectedA3Ids.length > 0) && (
                <div className="no-print print:hidden mb-4 rounded-[20px] border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/12 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#059669] text-white text-[11.5px] font-extrabold">
                        <Maximize2 className="w-3.5 h-3.5" />
                        A3 세로 개별 연출 지원 (297×420mm)
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#191F28] dark:text-slate-100">
                        1페이지당 1모델 단독 2배 확대 · 재단선 없음
                      </span>
                    </div>
                    <p className="text-xs text-[#4E5968] dark:text-slate-300">
                      진열대 단독 연출할 모델을 체크해 원하는 상품만 A3 세로로 모아 뽑거나, 각 카드 상단의{' '}
                      <strong className="text-[#191F28] dark:text-slate-50">[A3 단독인쇄]</strong> ·{' '}
                      <strong className="text-[#E60012] dark:text-rose-400">[A3 PDF]</strong> 버튼으로 1장씩 즉시 출력할 수 있습니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {paperSize !== 'a3-portrait' && selectedDisplayedProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaperSize('a3-portrait');
                          setOnlySelectedInA3(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold tabular-nums cursor-pointer transition whitespace-nowrap"
                      >
                        선택한 {selectedDisplayedProducts.length}건 A3 세로 모드로 보기
                      </button>
                    )}

                    {paperSize === 'a3-portrait' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOnlySelectedInA3(false)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold tabular-nums border transition cursor-pointer whitespace-nowrap ${
                            !onlySelectedInA3 || selectedDisplayedProducts.length === 0
                              ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA]'
                              : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border-[#D1D6DB] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700'
                          }`}
                        >
                          전체 출력 ({displayedProducts.length}장)
                        </button>
                        <button
                          type="button"
                          disabled={selectedDisplayedProducts.length === 0}
                          onClick={() => setOnlySelectedInA3(true)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold tabular-nums border transition cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                            onlySelectedInA3 && selectedDisplayedProducts.length > 0
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-white dark:bg-slate-800 text-[#059669] dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35 hover:bg-emerald-50 dark:hover:bg-emerald-500/15'
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          선택 모델만 출력 ({selectedDisplayedProducts.length}장)
                        </button>
                      </>
                    )}

                    {selectedA3Ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedA3Ids([]);
                          setOnlySelectedInA3(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border border-[#D1D6DB] dark:border-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 1. 웹 화면용 뷰 (인쇄 시 숨김) */}
              <div
                className={`grid gap-6 print:hidden ${
                  paperSize === 'a3-portrait'
                    ? 'grid-cols-1 xl:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2'
                }`}
              >
                {displayedProducts.map((product) => (
                  <PopCard
                    key={product.id}
                    product={product}
                    cardBenefit={selectedCard}
                    popMode={popMode}
                    paperSize={paperSize}
                    isA3Selected={selectedA3Ids.includes(product.id)}
                    onToggleAllCare={handleToggleAllCare}
                    onToggleA3Select={handleToggleA3Select}
                    onQuickPrintA3={handleQuickPrintA3}
                    onQuickDownloadA3Pdf={handleQuickDownloadA3Pdf}
                  />
                ))}
              </div>

              {/* 2. 인쇄/PDF용 뷰 (화면 시 숨김) - A4 가로 2분할 재단선 & A3 세로 1장 단독 확대 모두 완벽 지원 */}
              <div id="print-area" className="hidden print:block w-full">
                {effectivePaperSize === 'a3-portrait'
                  ? activePrintProducts.map((product, idx) => (
                      <React.Fragment key={`a3-wrap-${product.id}-${idx}`}>
                        {/* (A) PDF 전용 무변형(scale 1) 1:√2 시트 -> pixelRatio 3.4로 초고해상도 캡처하여 A3 용지에 100% 무왜곡 매핑 */}
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

                        {/* (B) 브라우저 직접 인쇄(window.print) 전용 A3 시트 (418mm 안전 높이로 빈 2페이지 넘침 차단) */}
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
                  : productPairs.map((pair, idx) => (
                      <div
                        key={`a4-${idx}`}
                        className="print-page print-page-a4 w-[297mm] h-[210mm] mx-auto flex relative overflow-hidden bg-white"
                        style={
                          idx < productPairs.length - 1
                            ? { pageBreakAfter: 'always', breakAfter: 'page' }
                            : { pageBreakAfter: 'auto', breakAfter: 'auto' }
                        }
                      >
                        {/* 중앙 재단선 (Cutting Line) */}
                        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-slate-400 z-50"></div>

                        {/* 카드 렌더링 (최대 2개) */}
                        {pair.map((product) => (
                          <div
                            key={product.id}
                            className="w-[148.5mm] h-[210mm] flex items-center justify-center box-border shrink-0"
                          >
                            <div className="w-full h-full flex items-center justify-center">
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
                          </div>
                        ))}
                      </div>
                    ))}
              </div>

              {displayedProducts.length === 0 && (
                <div className="text-center text-slate-500 mt-20 no-print w-full">
                  해당 필터 조건에 맞는 모델이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Data Management Modal */}
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
          {/* 1. 견적서/POS 사진 AI 인식 버튼 */}
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
                  <span className="bg-white/20 text-white text-[11.5px] px-2 py-0.5 rounded-md font-bold">
                    카메라/캡처
                  </span>
                </div>
                <div className="text-xs text-blue-100 mt-0.5 font-medium">
                  스마트폰 사진이나 화면 캡처(Ctrl+V)로 POP 카드 즉시 생성
                </div>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-blue-200 shrink-0" />
          </button>

          {/* 2. 엑셀 파일 업로드 */}
          <label className="relative flex items-center justify-center w-full px-6 py-4 text-sm font-bold text-[#1B64DA] dark:text-blue-300 bg-[#EFF6FF]/60 dark:bg-blue-500/10 border-2 border-[#BFDBFE] dark:border-blue-500/35 border-dashed rounded-2xl cursor-pointer hover:bg-[#EFF6FF] dark:hover:bg-blue-500/15 transition-colors">
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 mb-1" />
              <span className="font-extrabold">
                {loading ? '처리 중...' : '엑셀 자료 추가 업로드 (.xlsx, .xls, .csv)'}
              </span>
              <span className="text-xs font-medium text-[#4E5968] dark:text-slate-400 text-center">
                파일명/시트명/제목에 &lsquo;올케어&rsquo;가 적혀 있으면
                <br />
                <strong className="text-[#191F28] dark:text-slate-200">
                  [사용중인가전 2년수리비보증서비스추가]
                </strong>
                가 자동 적용됩니다.
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

      {/* Settings Modal */}
      <FlagshipModalShell
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="설정 및 공유하기"
        subtitle="Gemini AI 키 및 모델 설정"
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
        <div className="mb-5">
          <h4 className="font-extrabold text-[#191F28] dark:text-slate-100 mb-2 text-sm">
            💌 친구에게 배포용 소스코드 전달하기
          </h4>
          <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-4 rounded-xl border border-[#E5E8EB] dark:border-slate-800 text-xs sm:text-sm text-[#4E5968] dark:text-slate-300 leading-relaxed">
            본인의 깃허브 배포 주소를 노출하지 않고, 친구가 직접 배포하게 하려면{' '}
            <strong className="text-[#191F28] dark:text-slate-100">
              앱의 전체 소스코드(파일 묶음)
            </strong>
            를 전달해야 합니다.
            <br />
            <br />
            <strong className="text-[#191F28] dark:text-slate-100">[소스코드 다운로드 방법]</strong>
            <br />
            화면 우측 상단(앱 바깥쪽 영역)의 <strong>Export(내보내기)</strong> 메뉴에서{' '}
            <strong>Download ZIP</strong>을 선택하세요.
            <br />
            <br />
            저장된 ZIP 파일을 친구에게 보내면, 친구가 직접 자신의 GitHub Pages 등을 통해 배포할 수 있습니다.
          </div>
        </div>

        {/* AI Setup */}
        <div className="bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 rounded-xl p-4">
          <h4 className="font-extrabold text-[#1B64DA] dark:text-blue-300 mb-2 flex items-center gap-1.5 text-sm">
            ✨ AI 마케팅 문구 자동생성 (Gemini)
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
                  gemini-3.8-flash (초고속·고정밀 1순위 권장)
                </option>
                <option value="gemini-4-hydrogen">
                  gemini-4-hydrogen (Gemini 4 경량 프론티어 · 비용절감)
                </option>
                <option value="gemini-3.5-flash-lite">
                  gemini-3.5-flash-lite (초경량 최고속 · 다중인원 최적)
                </option>
                <option value="gemini-3.6-flash">
                  gemini-3.6-flash (안정형 초고속 Flash)
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

      {/* iOS Install Guide Modal */}
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
          iPhone / iPad에서는 아래 방법으로 앱을 설치할 수 있습니다.
          <br />
          <br />
          1. Safari 하단 툴바에서{' '}
          <strong className="text-[#191F28] dark:text-slate-100">공유(Share)</strong> 버튼을 누르세요.
          <br />
          2. 스크롤을 내려서{' '}
          <strong className="text-[#191F28] dark:text-slate-100">[홈 화면에 추가]</strong>를 선택하세요.
        </p>
      </FlagshipModalShell>

      {/* 견적서/POS 사진 AI 인식 모달 */}
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
