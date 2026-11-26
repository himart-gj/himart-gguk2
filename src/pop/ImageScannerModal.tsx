import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Sparkles, Check, AlertCircle, RefreshCw, Image as ImageIcon, Clipboard, CheckCircle2, Shield } from 'lucide-react';
import { ProductData } from './types';
import { FlagshipModalShell } from '../components/ui/FlagshipModalShell';
import { FormattedMoneyInput } from '../components/FormattedMoneyInput';

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

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.');
      return;
    }

    setError(null);
    setExtractedData(null);
    setIsSuccessAdded(false);

    try {
      const { compressImageFile } = await import('../utils/aiImageParser');
      const compressed = await compressImageFile(file, 1920, 0.85);
      setImagePreview(compressed.dataUrl);
      setImageMime(compressed.mimeType);
      analyzeImage(compressed.dataUrl, compressed.mimeType);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        setImageMime(file.type || 'image/jpeg');
        analyzeImage(result, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Data: string, _mimeType: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const {
        compressImageFile,
        ensureEffectiveGeminiApiKey,
        GEMINI_MODELS,
        generateContentWithTier1Retry,
        getStoredGeminiApiKey,
        inferCategoryFromModelCode,
        normalizeModelCode,
        shouldTryLocalBackendApi,
      } = await import('../utils/aiImageParser');
      const compressed = await compressImageFile(base64Data, 1920, 0.85);
      const effectiveKey = apiKey || getStoredGeminiApiKey();

      if (shouldTryLocalBackendApi()) {
        try {
          const res = await fetch('/api/ai/parse-pop-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: compressed.dataUrl,
              mimeType: compressed.mimeType,
              apiKey: effectiveKey || undefined,
              model: model || undefined,
            }),
          });

          const json = await res.json();
          if (res.ok && json.success && json.data) {
            const sanitized = {
              ...json.data,
              careServiceText: (json.data.careServiceText || '').replace(
                /3년\s*(무상|A\/?S)/gi,
                '5년 $1'
              ),
              careServiceDetail: (json.data.careServiceDetail || '').replace(
                /3년\s*(무상|A\/?S)/gi,
                '5년 $1'
              ),
            };
            setExtractedData(sanitized);
            return;
          }
        } catch (serverErr) {
          console.warn('서버 POP 이미지 분석 실패, 프론트엔드 직접 호출로 전환:', serverErr);
        }
      }

      // 프론트엔드 직접 호출 Fallback (초대 친구 공유 API 키 자동 지원)
      const { GoogleGenAI, Type } = await import('@google/genai');
      const finalKey = await ensureEffectiveGeminiApiKey(effectiveKey);
      if (!finalKey) {
        throw new Error('Gemini API 키가 설정되지 않았습니다. 상단 설정에서 API 키를 입력하거나 관리자에게 AI 키 공유를 요청해 주세요.');
      }

      const ai = new GoogleGenAI({ apiKey: finalKey });
      const prompt = `당신은 가전제품 구독/렌탈 견적서 및 하이마트 세일즈툴(맞춤 구독 견적 계산기) 화면 이미지 분석 전문가입니다.
사용자가 업로드한 화면 캡처 또는 사진에서 다음 구독 POP 제작에 필요한 핵심 정보들을 정확하게 추출하세요.
롯데하이마트 가전 구독의 무상 A/S 기간은 구독 개월수(36개월/60개월)와 상관없이 무조건 5년(5년 무상 A/S)입니다. 화면에서 36개월 버튼이 선택되어 있더라도 절대 '3년 무상 A/S'로 해석하거나 작성하지 마세요.
- 본문에 모델명이 안 보이면 화면 최상단 브라우저 주소창 URL 파라미터(예: productId=FG24GN.AKOR2)에서 모델코드를 반드시 추출할 것!
- 하단 노란색 글씨 '월 납부요금'(예: 약 58,653원 -> 58653)을 monthlyFee로 추출할 것!`;

      const rawPreferred = (model || '').trim();
      const safePreferred =
        rawPreferred === 'gemini-4-argon' || rawPreferred === 'gemini-4-carbon'
          ? 'gemini-4-hydrogen'
          : rawPreferred;
      const modelChain = Array.from(
        new Set([
          ...(safePreferred ? [safePreferred] : []),
          ...GEMINI_MODELS,
        ])
      );

      const { text: responseText } = await generateContentWithTier1Retry(
        ai,
        modelChain,
        {
          parts: [
            { inlineData: { mimeType: compressed.mimeType, data: compressed.base64 } },
            { text: prompt },
          ],
        },
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              modelName: { type: Type.STRING },
              productName: { type: Type.STRING },
              monthlyFee: { type: Type.INTEGER },
              period: { type: Type.INTEGER },
              downPayment: { type: Type.INTEGER },
              careServiceText: { type: Type.STRING },
              careServiceCycle: { type: Type.STRING },
              careServiceCount: { type: Type.STRING },
              careServiceDetail: { type: Type.STRING },
              isAllCare: { type: Type.BOOLEAN },
            },
            required: ['category', 'modelName', 'monthlyFee', 'period'],
          },
        }
      );
      const parsedData = JSON.parse(responseText);
      const cleanModel = normalizeModelCode(parsedData.modelName || '');
      parsedData.modelName = cleanModel || parsedData.modelName || '';
      parsedData.category = inferCategoryFromModelCode(cleanModel, parsedData.category);
      parsedData.careServiceText = (parsedData.careServiceText || '').replace(
        /3년\s*(무상|A\/?S)/gi,
        '5년 $1'
      );
      parsedData.careServiceDetail = (parsedData.careServiceDetail || '').replace(
        /3년\s*(무상|A\/?S)/gi,
        '5년 $1'
      );
      setExtractedData(parsedData);
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
      careServiceText: (extractedData.careServiceText || '').replace(
        /3년\s*(무상|A\/?S)/gi,
        '5년 $1'
      ),
      careServiceCycle: extractedData.careServiceCycle || '',
      careServiceCount: extractedData.careServiceCount || '',
      careServiceDetail: (extractedData.careServiceDetail || '').replace(
        /3년\s*(무상|A\/?S)/gi,
        '5년 $1'
      ),
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

  void imageMime;

  return (
    <FlagshipModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="견적서 / POS 사진 AI 자동 인식"
      subtitle="견적서 화면이나 사진을 올리면 모델명, 구독료, 기간을 AI가 자동으로 추출합니다."
      badge="Gemini Vision"
      icon={<Sparkles className="w-5 h-5 text-[#1B64DA] dark:text-blue-400" />}
      maxWidthClass="max-w-3xl"
      zIndexClass="z-50 no-print"
      closeOnBackdrop={false}
      footer={
        <div className="flex items-center justify-between gap-2 text-xs text-[#4E5968] dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clipboard className="w-3.5 h-3.5 text-[#8B95A1] dark:text-slate-500 shrink-0" />
            <span>
              화면 어디서든 <strong>Ctrl + V</strong> 로 캡처 이미지를 즉시 인식할 수 있습니다.
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#D1D6DB] dark:border-slate-700 text-[#191F28] dark:text-slate-200 font-bold transition-colors cursor-pointer shrink-0"
          >
            닫기
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-[#FFF1F2] dark:bg-rose-500/12 border border-[#FECDD3] dark:border-rose-500/30 text-[#E60012] dark:text-rose-300 rounded-xl text-xs sm:text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#E60012] dark:text-rose-400" />
          <div className="flex-1 font-bold">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#E60012] dark:text-rose-300 hover:underline text-xs font-extrabold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {isSuccessAdded && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-300 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-[#059669] dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-extrabold text-base text-[#191F28] dark:text-slate-50">
              POP 목록에 성공적으로 등록되었습니다!
            </p>
            <p className="text-xs font-bold text-[#059669] dark:text-emerald-300">
              새 카드가 POP 화면에 바로 반영되었습니다.
            </p>
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
            className="border-2 border-dashed border-[#BFDBFE] dark:border-blue-500/40 hover:border-[#1B64DA] bg-[#EFF6FF]/40 dark:bg-blue-500/10 hover:bg-[#EFF6FF]/80 dark:hover:bg-blue-500/15 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center cursor-pointer min-h-[220px]"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 bg-[#EFF6FF] dark:bg-blue-500/20 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 rounded-2xl flex items-center justify-center mb-3">
              <Camera className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-[#191F28] dark:text-slate-100 text-base mb-1">
              견적서 사진이나 화면 캡처를 업로드하세요
            </h4>
            <p className="text-xs text-[#4E5968] dark:text-slate-400 max-w-md leading-relaxed mb-4">
              스마트폰으로 찍은 견적서 화면 사진, POS 견적서 캡처 등 어떤 사진이든 AI가 인식합니다.
              <br />
              <span className="text-[#1B64DA] dark:text-blue-300 font-bold bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 px-2.5 py-0.5 rounded-md mt-1.5 inline-block">
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
                className="flex items-center gap-1.5 bg-[#1B64DA] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
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
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/40 px-4 py-2.5 rounded-xl text-xs font-extrabold hover:bg-[#EFF6FF] dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                카메라로 직접 촬영
              </button>
            </div>
          </div>

          {/* 안내 가이드 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-3.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
              <div className="font-extrabold text-[#191F28] dark:text-slate-100 mb-1 flex items-center gap-1">
                <span>📱</span> 스마트폰 촬영
              </div>
              <p className="text-[#4E5968] dark:text-slate-400 leading-relaxed">
                상담 중인 고객 견적 화면을 폰 카메라로 찍어 바로 올릴 수 있습니다.
              </p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-3.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
              <div className="font-extrabold text-[#191F28] dark:text-slate-100 mb-1 flex items-center gap-1">
                <span>✂️</span> 화면 캡처 후 붙여넣기
              </div>
              <p className="text-[#4E5968] dark:text-slate-400 leading-relaxed">
                윈도우 <strong>Win+Shift+S</strong>로 캡처한 후 <strong>Ctrl+V</strong>를 누르면 바로 인식됩니다.
              </p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-slate-900/70 p-3.5 rounded-xl border border-[#E5E8EB] dark:border-slate-800">
              <div className="font-extrabold text-[#191F28] dark:text-slate-100 mb-1 flex items-center gap-1">
                <span>🛡️</span> 올케어 자동 감지
              </div>
              <p className="text-[#4E5968] dark:text-slate-400 leading-relaxed">
                화면에 &lsquo;올케어&rsquo; 또는 &lsquo;수리비 보증&rsquo; 단어가 있으면 올케어 POP로 자동 분류됩니다.
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
            <div className="font-bold text-xs text-[#4E5968] dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
                업로드된 사진
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[#1B64DA] dark:text-blue-400 hover:underline text-[11.5px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                다른 사진 올리기
              </button>
            </div>
            <div className="border border-[#E5E8EB] dark:border-slate-800 rounded-xl overflow-hidden bg-[#F8FAFC] dark:bg-slate-900/70 relative flex items-center justify-center min-h-[220px] max-h-[360px]">
              <img
                src={imagePreview}
                alt="업로드된 견적서"
                className="max-h-[350px] w-auto object-contain"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white">
                  <div className="w-10 h-10 border-3 border-[#60A5FA] border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="font-extrabold text-sm text-white">
                    AI가 견적서 사진을 분석 중입니다...
                  </span>
                  <span className="text-[11.5px] text-slate-300 mt-1 max-w-[210px]">
                    모델명, 월 구독료, 기간, 케어서비스를 판독하고 있습니다
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 추출된 필드 및 편집 폼 */}
          <div className="md:col-span-7 flex flex-col">
            <div className="font-bold text-xs text-[#4E5968] dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
              AI 자동 인식 결과 확인 & 수정
            </div>

            {isAnalyzing ? (
              <div className="flex-1 border border-dashed border-[#BFDBFE] dark:border-blue-500/40 rounded-xl p-6 bg-[#EFF6FF]/40 dark:bg-blue-500/10 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-8 h-8 text-[#1B64DA] dark:text-blue-400 animate-pulse mb-2" />
                <p className="font-extrabold text-sm text-[#191F28] dark:text-slate-100">
                  사진 속 텍스트와 가격 정보를 읽어오는 중...
                </p>
                <p className="text-xs text-[#4E5968] dark:text-slate-400 mt-1">
                  잠시만 기다려주시면 POP 카드용 정보가 자동으로 채워집니다.
                </p>
              </div>
            ) : extractedData ? (
              <div className="bg-[#F8FAFC] dark:bg-slate-900/70 border border-[#E5E8EB] dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 flex-1">
                {/* 상단 뱃지 요약 */}
                <div className="flex items-center justify-between bg-white dark:bg-[#131C2E] px-3 py-2 rounded-xl border border-[#E5E8EB] dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-[#4E5968] dark:text-slate-400 shrink-0">
                      인식된 상품:
                    </span>
                    <span className="font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                      {extractedData.productName || extractedData.modelName}
                    </span>
                  </div>
                  {extractedData.isAllCare && (
                    <span className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#059669] dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-md text-[11.5px] flex items-center gap-1 shrink-0">
                      <Shield className="w-3 h-3" /> 올케어 감지됨
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* 1. 품목 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      🏷️ 품목명 (카테고리)
                    </label>
                    <input
                      type="text"
                      value={extractedData.category}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, category: e.target.value })
                      }
                      placeholder="예: 전기밥솥, 냉장고"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-bold text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 2. 제품 모델명 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      🔢 제품 모델명 (필수)
                    </label>
                    <input
                      type="text"
                      value={extractedData.modelName}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, modelName: e.target.value })
                      }
                      placeholder="예: CRP-PHFFTR0620FGW"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-extrabold font-mono text-[#1B64DA] dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 3. 월 구독료 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      💰 월 구독료 (원, 필수)
                    </label>
                    <FormattedMoneyInput
                      value={extractedData.monthlyFee}
                      stepAmount={1000}
                      onValueChange={(numericValue) =>
                        setExtractedData({
                          ...extractedData,
                          monthlyFee: numericValue,
                        })
                      }
                      placeholder="예: 18,094"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 sm:text-sm font-extrabold text-[#E60012] dark:text-[#FF3B47] focus:outline-none focus:ring-2 focus:ring-[#E60012]"
                    />
                  </div>

                  {/* 4. 구독기간 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
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
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-extrabold font-mono tabular-nums text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 5. 케어서비스 명 */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      ✨ 케어서비스 명칭
                    </label>
                    <input
                      type="text"
                      value={extractedData.careServiceText || ''}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, careServiceText: e.target.value })
                      }
                      placeholder="예: 안심케어_1, 셀프케어"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 6. 케어 주기 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      🔄 방문/배송 주기
                    </label>
                    <input
                      type="text"
                      value={extractedData.careServiceCycle || ''}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, careServiceCycle: e.target.value })
                      }
                      placeholder="예: 12/24개월, 3개월"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 7. 제공 횟수 */}
                  <div>
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      🔢 제공 횟수
                    </label>
                    <input
                      type="text"
                      value={extractedData.careServiceCount || ''}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, careServiceCount: e.target.value })
                      }
                      placeholder="예: 2회, 12회"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 8. 보증/서비스 상세 */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#4E5968] dark:text-slate-300 mb-1">
                      🛠️ 보증 / 서비스 상세 (무상 A/S 연수 등)
                    </label>
                    <input
                      type="text"
                      value={extractedData.careServiceDetail || ''}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, careServiceDetail: e.target.value })
                      }
                      placeholder="예: 5년 무상 A/S, AS연장보험, 고무패킹 정기배송"
                      className="w-full bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 rounded-lg px-2.5 py-2 text-base sm:text-xs font-medium text-[#191F28] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
                    />
                  </div>

                  {/* 9. 올케어 스위치 */}
                  <div className="sm:col-span-2 bg-[#EFF6FF] dark:bg-blue-500/12 p-3 rounded-xl border border-[#BFDBFE] dark:border-blue-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">🛡️</span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-[#191F28] dark:text-slate-100 text-xs block">
                          올케어 혜택 적용
                        </span>
                        <span className="text-[11.5px] text-[#4E5968] dark:text-slate-400">
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
                      className={`px-3 py-1.5 rounded-lg text-[11.5px] font-extrabold transition-all cursor-pointer shrink-0 ${
                        extractedData.isAllCare
                          ? 'bg-[#059669] text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6]'
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
                    className="flex-1 bg-[#E60012] hover:bg-[#C8000F] text-white py-3 px-4 rounded-xl font-extrabold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
    </FlagshipModalShell>
  );
}
