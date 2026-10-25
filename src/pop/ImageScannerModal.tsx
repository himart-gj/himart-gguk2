import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Sparkles, Check, AlertCircle, RefreshCw, X, Image as ImageIcon, Clipboard, CheckCircle2, Shield } from 'lucide-react';
import { ProductData } from './types';

interface ImageScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: ProductData) => void;
  initialImage?: string | null;
  apiKey?: string;
  model?: string;
}

interface ExtractedData {
  category: string;
  modelName: string;
  productName?: string;
  monthlyFee: number;
  period: number;
  downPayment?: number;
  careServiceText?: string;
  careServiceCycle?: string;
  careServiceCount?: string;
  careServiceDetail?: string;
  isAllCare?: boolean;
}

export default function ImageScannerModal({
  isOpen,
  onClose,
  onAddProduct,
  initialImage = null,
  apiKey = '',
  model = '',
}: ImageScannerModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isSuccessAdded, setIsSuccessAdded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 초기 이미지가 전달된 경우 자동 분석 시작
  useEffect(() => {
    if (isOpen && initialImage) {
      setImagePreview(initialImage);
      const mime = initialImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      setImageMime(mime);
      analyzeImage(initialImage, mime);
    } else if (!isOpen) {
      // 모달 닫힐 때 초기화
      setImagePreview(null);
      setExtractedData(null);
      setError(null);
      setIsAnalyzing(false);
      setIsSuccessAdded(false);
    }
  }, [isOpen, initialImage]);

  // 클립보드 붙여넣기(Ctrl+V) 지원
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.');
      return;
    }

    setError(null);
    setExtractedData(null);
    setIsSuccessAdded(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageMime(file.type || 'image/jpeg');
      analyzeImage(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64Data: string, mimeType: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/parse-pop-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType,
          apiKey: apiKey || undefined,
          model: model || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '견적서 사진을 분석하지 못했습니다.');
      }

      setExtractedData(json.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '사진 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAdd = () => {
    if (!extractedData) return;

    if (!extractedData.modelName) {
      setError('제품 모델명을 입력해주세요.');
      return;
    }

    if (!extractedData.monthlyFee || extractedData.monthlyFee <= 0) {
      setError('올바른 월 구독료를 입력해주세요.');
      return;
    }

    const newProduct: ProductData = {
      id: crypto.randomUUID(),
      category: extractedData.category || '가전',
      modelName: extractedData.modelName.trim(),
      monthlyFee: Math.floor(extractedData.monthlyFee),
      period: extractedData.period || 36,
      downPayment: extractedData.downPayment || 0,
      careServiceText: extractedData.careServiceText || '',
      careServiceCycle: extractedData.careServiceCycle || '',
      careServiceCount: extractedData.careServiceCount || '',
      careServiceDetail: extractedData.careServiceDetail || '',
      imageUrl: '',
      changeStatus: 'new',
      isAllCare: !!extractedData.isAllCare,
    };

    onAddProduct(newProduct);
    setIsSuccessAdded(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setImagePreview(null);
    setExtractedData(null);
    setError(null);
    setIsAnalyzing(false);
    setIsSuccessAdded(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 no-print backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                견적서 / POS 사진 AI 자동 인식
                <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black">
                  Gemini Vision
                </span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                견적서 화면이나 사진을 올리면 모델명, 구독료, 기간을 AI가 자동으로 추출합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 text-xs font-bold"
              >
                닫기
              </button>
            </div>
          )}

          {isSuccessAdded && (
            <div className="mb-4 p-4 bg-green-50 border border-green-300 text-green-800 rounded-xl text-sm flex items-center gap-3 animate-bounce">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-bold text-base">POP 목록에 성공적으로 등록되었습니다!</p>
                <p className="text-xs text-green-700">새 카드가 POP 화면에 바로 반영되었습니다.</p>
              </div>
            </div>
          )}

          {/* 1. 이미지 선택 전 (업로드 / 촬영 / 캡처 붙여넣기 대기 화면) */}
          {!imagePreview && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center cursor-pointer min-h-[220px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                  <Camera className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-800 text-base mb-1">
                  견적서 사진이나 화면 캡처를 업로드하세요
                </h4>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-4">
                  스마트폰으로 찍은 견적서 화면 사진, POS 견적서 캡처 등 어떤 사진이든 AI가 인식합니다.
                  <br />
                  <span className="text-indigo-600 font-bold bg-indigo-100/60 px-2 py-0.5 rounded mt-1 inline-block">
                    💡 캡처 후 이 창에서 <strong>Ctrl + V</strong> (붙여넣기)도 가능합니다!
                  </span>
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    사진 파일 선택
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 bg-white text-indigo-700 border border-indigo-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 shadow-sm transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    카메라로 직접 촬영
                  </button>
                </div>
              </div>

              {/* 안내 가이드 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <span>📱</span> 스마트폰 촬영
                  </div>
                  <p className="text-slate-500 leading-tight">
                    상담 중인 고객 견적 화면을 폰 카메라로 찍어 바로 올릴 수 있습니다.
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <span>✂️</span> 화면 캡처 후 붙여넣기
                  </div>
                  <p className="text-slate-500 leading-tight">
                    윈도우 <strong>Win+Shift+S</strong>로 캡처한 후 <strong>Ctrl+V</strong>를 누르면 바로 인식됩니다.
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <span>🛡️</span> 올케어 자동 감지
                  </div>
                  <p className="text-slate-500 leading-tight">
                    화면에 '올케어' 또는 '수리비 보증' 단어가 있으면 올케어 POP로 자동 분류됩니다.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          )}

          {/* 2. 이미지 업로드 후: 분석 중 또는 결과 확인 화면 */}
          {imagePreview && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* 좌측: 원본 사진 미리보기 */}
              <div className="md:col-span-5 flex flex-col">
                <div className="font-bold text-xs text-slate-600 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    업로드된 사진
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    다른 사진 올리기
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900/5 relative flex items-center justify-center min-h-[220px] max-h-[360px] shadow-inner">
                  <img
                    src={imagePreview}
                    alt="업로드된 견적서"
                    className="max-h-[350px] w-auto object-contain"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white">
                      <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
                      <span className="font-bold text-sm text-amber-300">
                        AI가 견적서 사진을 분석 중입니다...
                      </span>
                      <span className="text-[11px] text-indigo-200 mt-1 max-w-[200px]">
                        모델명, 월 구독료, 기간, 케어서비스를 판독하고 있습니다
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 추출된 필드 및 편집 폼 */}
              <div className="md:col-span-7 flex flex-col">
                <div className="font-bold text-xs text-slate-600 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  AI 자동 인식 결과 확인 & 수정
                </div>

                {isAnalyzing ? (
                  <div className="flex-1 border border-dashed border-indigo-200 rounded-xl p-6 bg-indigo-50/20 flex flex-col items-center justify-center text-center">
                    <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse mb-2" />
                    <p className="font-bold text-sm text-indigo-900">
                      사진 속 텍스트와 가격 정보를 읽어오는 중...
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      잠시만 기다려주시면 POP 카드용 정보가 자동으로 채워집니다.
                    </p>
                  </div>
                ) : extractedData ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 flex-1">
                    {/* 상단 뱃지 요약 */}
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-500">인식된 상품:</span>
                        <span className="font-black text-slate-800">
                          {extractedData.productName || extractedData.modelName}
                        </span>
                      </div>
                      {extractedData.isAllCare && (
                        <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                          <Shield className="w-3 h-3" /> 올케어 감지됨
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {/* 1. 품목 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          🏷️ 품목명 (카테고리)
                        </label>
                        <input
                          type="text"
                          value={extractedData.category}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, category: e.target.value })
                          }
                          placeholder="예: 전기밥솥, 냉장고"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 2. 제품 모델명 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          🔢 제품 모델명 (필수)
                        </label>
                        <input
                          type="text"
                          value={extractedData.modelName}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, modelName: e.target.value })
                          }
                          placeholder="예: CRP-PHFFTR0620FGW"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-black text-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 3. 월 구독료 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          💰 월 구독료 (원, 필수)
                        </label>
                        <input
                          type="number"
                          value={extractedData.monthlyFee || ''}
                          onChange={(e) =>
                            setExtractedData({
                              ...extractedData,
                              monthlyFee: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="예: 18094"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-black text-red-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 4. 구독기간 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          ⏳ 구독기간 (개월)
                        </label>
                        <input
                          type="number"
                          value={extractedData.period || ''}
                          onChange={(e) =>
                            setExtractedData({
                              ...extractedData,
                              period: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="예: 36"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 5. 케어서비스 명 */}
                      <div className="col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">
                          ✨ 케어서비스 명칭
                        </label>
                        <input
                          type="text"
                          value={extractedData.careServiceText || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, careServiceText: e.target.value })
                          }
                          placeholder="예: 안심케어_1, 셀프케어"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 6. 케어 주기 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          🔄 방문/배송 주기
                        </label>
                        <input
                          type="text"
                          value={extractedData.careServiceCycle || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, careServiceCycle: e.target.value })
                          }
                          placeholder="예: 12/24개월, 3개월"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 7. 제공 횟수 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          🔢 제공 횟수
                        </label>
                        <input
                          type="text"
                          value={extractedData.careServiceCount || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, careServiceCount: e.target.value })
                          }
                          placeholder="예: 2회, 12회"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 8. 보증/서비스 상세 */}
                      <div className="col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">
                          🛠️ 보증 / 서비스 상세 (무상 A/S 연수 등)
                        </label>
                        <input
                          type="text"
                          value={extractedData.careServiceDetail || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, careServiceDetail: e.target.value })
                          }
                          placeholder="예: 5년 무상 A/S, AS연장보험, 고무패킹 정기배송"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 6. 올케어 스위치 */}
                      <div className="col-span-2 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🛡️</span>
                          <div>
                            <span className="font-extrabold text-indigo-950 text-xs block">
                              올케어 혜택 적용
                            </span>
                            <span className="text-[10px] text-slate-500">
                              사용중인 가전 2년 수리비 보증 서비스를 적용합니다
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExtractedData({
                              ...extractedData,
                              isAllCare: !extractedData.isAllCare,
                            })
                          }
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                            extractedData.isAllCare
                              ? 'bg-indigo-700 text-yellow-300 shadow-sm'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {extractedData.isAllCare ? '적용됨 (ON)' : '미적용 (OFF)'}
                        </button>
                      </div>
                    </div>

                    {/* 등록 버튼 */}
                    <div className="pt-2 mt-auto flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmAdd}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        이 정보로 POP 카드 추가하기
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clipboard className="w-3.5 h-3.5 text-slate-400" />
            화면 어디서든 <strong>Ctrl + V</strong> 로 캡처 이미지를 즉시 인식할 수 있습니다.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
