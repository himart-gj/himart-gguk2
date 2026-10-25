import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Printer, CreditCard, Settings, Trash2, X, Filter, Download, FileText, Camera, Sparkles, ArrowLeft } from 'lucide-react';
import { ProductData, CARD_BENEFITS } from './types';
import { parseExcel } from './excel';
import PopCard from './PopCard';
import ImageScannerModal from './ImageScannerModal';
import domToImage from 'dom-to-image-more';
import jsPDF from 'jspdf';

export interface PopPrinterAppProps {
  onBackToHome: () => void;
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

export function PopPrinterApp({ onBackToHome }: PopPrinterAppProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>(CARD_BENEFITS[0].id);
  
  // Modals
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImageScannerOpen, setIsImageScannerOpen] = useState(false);
  const [scannerInitialImage, setScannerInitialImage] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  
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
  const [aiModel, setAiModel] = useState('gemini-flash-latest');

  // Load API key and model from local storage on mount (1~4번 메뉴 공통 키 'gemini_api_key' 공유)
  React.useEffect(() => {
    const storedKey =
      localStorage.getItem('gemini_api_key') ||
      localStorage.getItem('geminiApiKey') ||
      '';
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem('geminiAiModel');
    if (storedModel) setAiModel(storedModel);
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
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
      setProducts([]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    
    setIsDownloading(true);
    try {
      // PDF 저장을 위해 임시로 print-area 활성화
      const originalCssText = printArea.style.cssText;
      printArea.classList.remove('hidden', 'print:block');
      printArea.style.cssText = 'display: block; position: absolute; left: 0; top: 0; z-index: -1;';

      // 레이아웃이 완전히 잡힐 때까지 약간 대기
      await new Promise(resolve => setTimeout(resolve, 500));

      const pages = printArea.querySelectorAll('.print-page');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const pageDataUrl = await domToImage.toJpeg(page, {
          quality: 0.95,
          bgcolor: '#ffffff',
          style: {
            transform: 'none',
            margin: '0',
            width: '100%',
            height: '100%'
          }
        });
        
        if (i > 0) pdf.addPage();
        pdf.addImage(pageDataUrl, 'JPEG', 0, 0, 297, 210);
      }

      pdf.save('구독POP_출력물.pdf');
      
      // 원래 상태로 복구
      printArea.style.cssText = originalCssText;
      printArea.classList.add('hidden', 'print:block');
    } catch (err) {
      console.error(err);
      alert('PDF 저장 중 오류가 발생했습니다: ' + (err as Error).message);
      // 에러 발생 시에도 복구
      printArea.style.display = '';
      printArea.classList.add('hidden', 'print:block');
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedCard = CARD_BENEFITS.find(c => c.id === selectedCardId) || CARD_BENEFITS[0];

  // 필터링된 상품 목록
  const displayedProducts = products.filter(p => {
    if (printMode === 'changed') return p.changeStatus === 'changed';
    if (printMode === 'new') return p.changeStatus === 'new';
    if (printMode === 'allcare') return !!p.isAllCare;
    if (printMode === 'standard') return !p.isAllCare;
    return true; // 'all'
  });

  // 인쇄 페이지용 묶음 (2개씩)
  const productPairs = [];
  for (let i = 0; i < displayedProducts.length; i += 2) {
    productPairs.push(displayedProducts.slice(i, i + 2));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <style>{`@media print { @page { size: A4 landscape !important; margin: 0 !important; } }`}</style>
      {/* Header (Hidden on Print) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                처음 메뉴로
              </button>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600 w-6 h-6" />
                <h1 className="text-xl font-bold tracking-tight text-slate-800">구독 POP 자동 출력기</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setScannerInitialImage(null);
                  setIsImageScannerOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-black shadow-sm transition-all cursor-pointer"
                title="스마트폰 견적 화면 사진이나 캡처 이미지를 AI가 자동으로 읽어 POP 카드로 만듭니다 (Ctrl+V 붙여넣기 지원)"
              >
                <Camera className="w-4 h-4 text-amber-300" />
                <span>사진/캡처 견적서 AI 등록</span>
              </button>
              <button
                onClick={() => setIsDataModalOpen(true)}
                className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                자료 관리 (엑셀)
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Bottom Row */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {/* Card Selector */}
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shrink-0">
                <CreditCard className="w-4 h-4 text-slate-500 ml-1" />
                <select 
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer pr-8 py-0.5"
                >
                  {CARD_BENEFITS.map(card => (
                    <option key={card.id} value={card.id}>
                      {card.name} ({card.discount.toLocaleString()}원)
                    </option>
                  ))}
                </select>
              </div>

              {/* Print Filter Selector */}
              {products.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shrink-0">
                  <Filter className="w-4 h-4 text-slate-500 ml-1" />
                  <select 
                    value={printMode}
                    onChange={(e) => setPrintMode(e.target.value as any)}
                    className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer pr-8 py-0.5"
                  >
                    <option value="all">전체 인쇄 ({products.length})</option>
                    {products.some(p => p.isAllCare) && (
                      <option value="allcare">🛡️ 올케어 모델만 ({products.filter(p => p.isAllCare).length})</option>
                    )}
                    {products.some(p => !p.isAllCare) && products.some(p => p.isAllCare) && (
                      <option value="standard">일반 모델만 ({products.filter(p => !p.isAllCare).length})</option>
                    )}
                    <option value="changed">가격 변동 모델만 ({products.filter(p => p.changeStatus === 'changed').length})</option>
                    <option value="new">새로 추가된 모델만 ({products.filter(p => p.changeStatus === 'new').length})</option>
                  </select>
                </div>
              )}

              {/* All-Care Quick Mode Switch */}
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const anyAllCare = products.some(p => p.isAllCare);
                    handleSetAllCare(!anyAllCare);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shrink-0 shadow-sm cursor-pointer ${
                    products.some(p => p.isAllCare)
                      ? 'bg-indigo-900 text-yellow-300 border-indigo-700 hover:bg-indigo-950'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="클릭하여 전체 카드의 올케어(사용중인가전 2년 수리비 보증)를 켜거나 끕니다"
                >
                  <span className="text-sm">🛡️</span>
                  <span>올케어 {products.some(p => p.isAllCare) ? '적용중 (ON)' : '미적용 (OFF)'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isInstallable && !isInstalled && (
                <button
                  onClick={install}
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold border border-blue-700 hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  앱 설치하기
                </button>
              )}

              {isIOS && !isInstalled && (
                <button
                  onClick={() => setShowIOSGuide(true)}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  홈 화면 추가
                </button>
              )}

              {/* Print Button */}
              <button 
                onClick={handlePrint}
                disabled={displayedProducts.length === 0}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                일반 인쇄 ({displayedProducts.length})
              </button>

              {/* PDF Button */}
              <button 
                onClick={handleDownloadPDF}
                disabled={displayedProducts.length === 0 || isDownloading}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                {isDownloading ? 'PDF 생성 중...' : 'PDF 저장'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Upload Notification Toast Banner */}
      {uploadSuccessMessage && (
        <div className="bg-indigo-700 text-white text-center py-2.5 px-4 text-sm font-bold shadow-md no-print flex items-center justify-center gap-2 border-b border-indigo-800">
          <span>🛡️</span>
          <span>{uploadSuccessMessage}</span>
          <button 
            onClick={() => setUploadSuccessMessage(null)} 
            className="ml-3 text-indigo-200 hover:text-white text-xs bg-indigo-800 px-2 py-0.5 rounded cursor-pointer"
          >
            닫기 ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none flex flex-col">
        
        {/* Blank Template State */}
        {products.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center no-print pb-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">현재 등록된 POP 자료가 없습니다.</h2>
              <p className="text-slate-500">엑셀 파일을 올리거나, 견적서/POS 사진을 찍어 AI로 바로 등록해보세요.</p>
              
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setScannerInitialImage(null);
                    setIsImageScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white px-6 py-3.5 rounded-xl font-black shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer text-sm"
                >
                  <Camera className="w-5 h-5 text-amber-300" />
                  견적서 사진 / 캡처 AI로 자동인식
                </button>
                <button
                  type="button"
                  onClick={() => setIsDataModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-white text-slate-700 border-2 border-slate-300 px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >
                  <Upload className="w-5 h-5 text-blue-600" />
                  엑셀 파일 일괄 등록
                </button>
              </div>
            </div>
            
            <div className="opacity-40 pointer-events-none transform scale-75 origin-top filter grayscale blur-[1px]">
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
                  changeStatus: 'unchanged'
                }} 
                cardBenefit={selectedCard} 
              />
            </div>
          </div>
        )}

        {/* POP Grid */}
        {products.length > 0 && (
          <div className="w-full">
            {/* 1. 웹 화면용 뷰 (인쇄 시 숨김) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:hidden">
              {displayedProducts.map((product) => (
                <PopCard 
                  key={product.id} 
                  product={product} 
                  cardBenefit={selectedCard}
                  onToggleAllCare={handleToggleAllCare}
                />
              ))}
            </div>

            {/* 2. 인쇄/PDF용 뷰 (화면 시 숨김) - 완벽한 A4 재단선 지원 */}
            <div id="print-area" className="hidden print:block w-full">
              {productPairs.map((pair, idx) => (
                <div 
                  key={idx} 
                  className="print-page w-[297mm] h-[210mm] mx-auto flex relative overflow-hidden bg-white"
                  style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                >
                  {/* 중앙 재단선 (Cutting Line) */}
                  <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-slate-400 z-50"></div>
                  
                  {/* 카드 렌더링 (최대 2개) */}
                  {pair.map((product) => (
                    <div key={product.id} className="w-[148.5mm] h-[210mm] flex items-center justify-center box-border shrink-0">
                      <div className="w-full h-full flex items-center justify-center print:p-[6mm]">
                        <div className="w-full h-full relative">
                          <PopCard product={product} cardBenefit={selectedCard} onToggleAllCare={handleToggleAllCare} />
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
      </main>

      {/* Data Management Modal */}
      {isDataModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 no-print backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                자료 관리 및 업로드
              </h3>
              <button onClick={() => setIsDataModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-slate-700">현재 로드된 모델 수</span>
                  <span className="text-xl font-black text-blue-600">{products.length} 개</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-500 border-t border-slate-200 pt-2 mt-2">
                  <span>새로 추가됨: {products.filter(p => p.changeStatus === 'new').length}</span>
                  <span>가격 변동: {products.filter(p => p.changeStatus === 'changed').length}</span>
                  <span className="text-indigo-700 font-bold">올케어 적용: {products.filter(p => p.isAllCare).length}개</span>
                </div>
                {products.length > 0 && (
                  <div className="flex gap-2 pt-2 border-t border-slate-200 text-xs mt-2">
                    <button
                      type="button"
                      onClick={() => handleSetAllCare(true)}
                      className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 transition-colors"
                    >
                      🛡️ 전체 올케어로 변경
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllCare(false)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors"
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
                  className="w-full flex items-center justify-between p-4 text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="font-black text-sm flex items-center gap-1.5">
                        견적서 / POS 사진 AI 자동 인식
                        <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded font-black">
                          카메라/캡처
                        </span>
                      </div>
                      <div className="text-xs text-indigo-100 mt-0.5 font-normal">
                        스마트폰 사진이나 화면 캡처(Ctrl+V)로 POP 카드 즉시 생성
                      </div>
                    </div>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                </button>

                {/* 2. 엑셀 파일 업로드 */}
                <label className="relative flex items-center justify-center w-full px-6 py-4 text-sm font-bold text-blue-700 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-6 h-6 mb-1" />
                    <span>{loading ? '처리 중...' : '엑셀 자료 추가 업로드 (.xlsx, .xls, .csv)'}</span>
                    <span className="text-xs font-normal text-blue-500 text-center">
                      파일명/시트명/제목에 '올케어'가 적혀 있으면<br/>
                      <strong>[사용중인가전 2년수리비보증서비스추가]</strong>가 자동 적용됩니다.
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

                <button
                  onClick={handleClearData}
                  disabled={products.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  기존 자료 모두 삭제
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 no-print backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" />
                설정 및 공유하기
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              
              <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-2 text-sm">💌 친구에게 배포용 소스코드 전달하기</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600 leading-relaxed">
                  본인의 깃허브 배포 주소를 노출하지 않고, 친구가 직접 배포하게 하려면 <strong>앱의 전체 소스코드(파일 묶음)</strong>를 전달해야 합니다.<br/><br/>
                  <strong>[소스코드 다운로드 방법]</strong><br/>
                  화면 우측 상단(앱 바깥쪽 영역)의 <strong>Export(내보내기)</strong> 메뉴에서 <strong>Download ZIP</strong>을 선택하세요.<br/><br/>
                  저장된 ZIP 파일을 친구에게 보내면, 친구가 직접 자신의 GitHub Pages 등을 통해 배포할 수 있습니다.
                </div>
              </div>

              {/* AI Setup */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-1.5 text-sm">
                  ✨ AI 마케팅 문구 자동생성 (Gemini)
                </h4>
                
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">API Key 입력</label>
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AI Studio API Key를 입력하세요"
                      className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">AI 모델 선택</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="gemini-flash-latest">gemini-flash-latest (권장)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    </select>
                  </div>
                  
                  <div className="text-xs text-blue-600 flex justify-between items-center mt-2">
                    <span>키가 없으신가요?</span>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold underline hover:text-blue-800"
                    >
                      API 키 발급받기
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200"
                >
                  닫기
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                  설정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Install Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">🍎 홈 화면에 추가하기</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed mb-4">
              iPhone / iPad에서는 아래 방법으로 앱을 설치할 수 있습니다.<br/><br/>
              1. Safari 하단 툴바에서 <strong>공유(Share)</strong> 버튼을 누르세요.<br/>
              2. 스크롤을 내려서 <strong>[홈 화면에 추가]</strong>를 선택하세요.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-lg bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700"
            >
              확인
            </button>
          </div>
        </div>
      )}

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
