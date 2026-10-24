import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Sparkles,
  Trash2,
  Clock,
  Smartphone,
  Download,
  Upload,
  HardDrive
} from 'lucide-react';
import { 
  restoreAllDeletedCustomers,
  getDeletedCustomerRecords,
  restoreIndividualCustomer,
  permanentlyDeleteCustomer,
  purgeAllDeletedCustomers,
  exportFullBackupJson,
  importFullBackupJson
} from '../services/gasApi';
import { 
  requestNotificationPermission, 
  sendMobileNotification 
} from '../services/notificationService';
import { DeletedCustomerRecord } from '../types/crm';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'rates'>('backup');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [deletedRecords, setDeletedRecords] = useState<DeletedCustomerRecord[]>(() => getDeletedCustomerRecords());
  const [deletedCount, setDeletedCount] = useState(() => getDeletedCustomerRecords().length);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync deleted records on open
  useEffect(() => {
    const records = getDeletedCustomerRecords();
    setDeletedRecords(records);
    setDeletedCount(records.length);
  }, [isOpen]);

  // HiPreed and Cards rates
  const [hipreedJson, setHipreedJson] = useState(() => {
    return localStorage.getItem('app_hipreed_rates') || JSON.stringify({
      "75": { lump: 750000, payback: 23473, monthly: 33000 },
      "150": { lump: 1500000, payback: 46946, monthly: 66000 },
      "225": { lump: 2250000, payback: 70419, monthly: 99000 },
      "300": { lump: 3000000, payback: 93892, monthly: 132000 }
    }, null, 2);
  });

  const [cardsJson, setCardsJson] = useState(() => {
    return localStorage.getItem('app_sub_cards') || JSON.stringify({
      "lotte": { tiers: [{v:0, t:"실적 없음 (0원)"}, {v:16000, t:"30만 실적 (-16,000원)"}, {v:19000, t:"70만 실적 (-19,000원)"}, {v:21000, t:"150만 실적 (-21,000원)"}] },
      "woori": { tiers: [{v:0, t:"실적 없음 (0원)"}, {v:18000, t:"30만 실적 (-18,000원)"}, {v:20000, t:"70만 실적 (-20,000원)"}, {v:22000, t:"120만 실적 (-22,000원)"}] },
      "samsung": { tiers: [{v:0, t:"실적 없음 (0원)"}, {v:13000, t:"30만 실적 (-13,000원)"}, {v:17000, t:"70만 실적 (-17,000원)"}, {v:22000, t:"150만 실적 (-22,000원)"}] },
      "shinhan": { tiers: [{v:0, t:"실적 없음 (0원)"}, {v:10000, t:"50만 실적 (-10,000원)"}, {v:20000, t:"100만 실적 (-20,000원)"}, {v:30000, t:"200만 실적 (-30,000원)"}] },
      "none": { tiers: [{v:0, t:"카드 혜택 없음 (0원)"}] }
    }, null, 2);
  });

  const showTempNotice = (type: 'success' | 'error', text: string) => {
    setStatusNotice({ type, text });
    setTimeout(() => setStatusNotice(null), 4500);
  };

  const handleDownloadBackup = () => {
    try {
      const jsonStr = exportFullBackupJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `국지CRM_전체백업_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showTempNotice('success', '📥 전체 데이터 백업 파일(.json)이 기기에 다운로드되었습니다.');
    } catch (e: any) {
      showTempNotice('error', `백업 파일 생성 실패: ${e?.message || '오류 발생'}`);
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const result = importFullBackupJson(content);
      if (result.success) {
        const updatedTrash = getDeletedCustomerRecords();
        setDeletedRecords(updatedTrash);
        setDeletedCount(updatedTrash.length);
        showTempNotice('success', `✅ ${result.message}`);
        onSaved();
      } else {
        showTempNotice('error', `❌ ${result.message}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    try {
      JSON.parse(hipreedJson);
      JSON.parse(cardsJson);
      localStorage.setItem('app_hipreed_rates', hipreedJson);
      localStorage.setItem('app_sub_cards', cardsJson);
      setJsonError(null);
    } catch (e) {
      setJsonError('하이프리드 또는 제휴카드 JSON 형식이 올바르지 않습니다.');
      setActiveTab('rates');
      return;
    }

    if (typeof (window as any).updateCardTiers === 'function') {
      (window as any).updateCardTiers();
    }
    if (typeof (window as any).calc === 'function') {
      (window as any).calc();
    }

    onSaved();
    onClose();
  };

  const handleRestoreIndividual = (customerId: string, customerName: string) => {
    restoreIndividualCustomer(customerId);
    const updated = getDeletedCustomerRecords();
    setDeletedRecords(updated);
    setDeletedCount(updated.length);
    showTempNotice('success', `'${customerName}' 고객이 성공적으로 복원되었습니다.`);
    onSaved();
  };

  const handlePermanentDelete = (customerId: string, customerName: string) => {
    permanentlyDeleteCustomer(customerId);
    const updated = getDeletedCustomerRecords();
    setDeletedRecords(updated);
    setDeletedCount(updated.length);
    showTempNotice('success', `'${customerName}' 고객이 휴지통에서 영구 삭제되었습니다.`);
    onSaved();
  };

  const handleRestoreDeleted = () => {
    restoreAllDeletedCustomers();
    setDeletedRecords([]);
    setDeletedCount(0);
    showTempNotice('success', '모든 삭제 고객이 성공적으로 전체 복원되었습니다.');
    onSaved();
  };

  const handlePurgeAll = () => {
    purgeAllDeletedCustomers();
    setDeletedRecords([]);
    setDeletedCount(0);
    showTempNotice('success', '휴지통이 완전히 비워졌습니다.');
    onSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-base font-bold">기기 데이터 백업/복원 &amp; 환경설정</h3>
              <p className="text-[11px] text-slate-300">
                100% 내 기기(LocalStorage) 단독 저장 체제 · 백업 및 AI 요율 관리
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'backup'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>1. 기기 백업/복원 &amp; 휴지통</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'rates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. AI 키 및 견적 요율 설정</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {statusNotice && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 font-bold ${
                statusNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusNotice.text}</span>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              {/* 1. JSON Full Backup & Restore Card */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl space-y-3 shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm flex items-center gap-1.5">
                      <span>💾</span> 기기 전체 데이터 백업 &amp; 복원 (.json)
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      모든 고객 CRM 카드, 상담 메모, 견적 이력, 사은품 및 폴더 데이터를 파일 하나로 안전하게 내려받거나 복원합니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="py-3 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>📥 전체 데이터 백업 파일(.json) 다운로드</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-300" />
                    <span>📤 백업 파일 불러오기(복원)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackupFile}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 2. Mobile Notifications */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🔔</span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      오전 9시 일일 브리핑 &amp; 모바일 알림
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      오늘/내일 배송 고객 및 미지급 사은품 알림을 스마트폰 상단바에 표시합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    if (res.granted) {
                      await sendMobileNotification({
                        title: '🔔 국지CRM 알림 활성화 완료',
                        body: '오늘 배송 일정 및 미지급 사은품 브리핑 알림이 정상 작동합니다.',
                      });
                    }
                    showTempNotice(res.granted ? 'success' : 'error', res.message);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                  <span>알림 테스트</span>
                </button>
              </div>

              {/* 3. Deleted Customers Management (휴지통 & 30일 자동삭제) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                      <span>🗑️ 삭제 고객 휴지통</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold border border-rose-200">
                        {deletedCount}건 보관 중
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        30일 경과 시 자동 영구삭제
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      실수로 삭제한 고객을 개별 복원하거나 즉시 영구 삭제할 수 있습니다.
                    </p>
                  </div>
                  {deletedCount > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleRestoreDeleted}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition cursor-pointer"
                      >
                        전체 복원
                      </button>
                      <button
                        type="button"
                        onClick={handlePurgeAll}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                      >
                        휴지통 비우기
                      </button>
                    </div>
                  )}
                </div>

                {deletedRecords.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border-t border-slate-200/80 pt-2.5">
                    {deletedRecords.map((record) => {
                      const c = record.customer;
                      const deletedDateFormatted = record.deletedAt
                        ? new Date(record.deletedAt).toLocaleDateString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '삭제일 미상';

                      return (
                        <div
                          key={record.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {c.name || '성명 미상'}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {c.phone || '연락처 없음'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                D-{record.daysRemaining}일 후 자동삭제
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 truncate">
                              <span>삭제일: {deletedDateFormatted}</span>
                              {c.items && <span className="truncate">품목: {c.items}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRestoreIndividual(record.id, c.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              <span>복원</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDelete(record.id, c.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>즉시삭제</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 font-medium border-t border-slate-200/80 pt-3">
                    현재 휴지통에 보관된 고객이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rates' && (
            <div className="space-y-4">
              {jsonError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{jsonError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Gemini AI API Key (gemini-3.8-flash 초고속 가전 분석용)</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... 로 시작하는 구글 Gemini API 키"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-[11px] font-bold underline inline-block mt-1"
                >
                  👉 Google AI Studio에서 무료 API 키 발급받기
                </a>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  하이프리드 지원/페이백 요율표 (JSON)
                </label>
                <textarea
                  value={hipreedJson}
                  onChange={(e) => setHipreedJson(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px] h-28 focus:ring-2 focus:ring-indigo-500"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  구독 제휴카드 구간표 (JSON)
                </label>
                <textarea
                  value={cardsJson}
                  onChange={(e) => setCardsJson(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px] h-32 focus:ring-2 focus:ring-indigo-500"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>설정 저장 및 전체 적용</span>
          </button>
        </div>
      </div>
    </div>
  );
};
