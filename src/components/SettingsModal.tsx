import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Code,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Trash2,
  Clock,
  UserCheck,
  Bell,
  Smartphone
} from 'lucide-react';
import { 
  getGasApiUrl, 
  setGasApiUrl, 
  clearGasApiUrl, 
  GOOGLE_APPS_SCRIPT_SAMPLE_CODE,
  restoreAllDeletedCustomers,
  getDeletedCustomerCount,
  getDeletedCustomerRecords,
  restoreIndividualCustomer,
  permanentlyDeleteCustomer,
  purgeAllDeletedCustomers
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
  const [activeTab, setActiveTab] = useState<'sheet' | 'rates'>('sheet');
  const [url, setUrl] = useState(getGasApiUrl());
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [deletedRecords, setDeletedRecords] = useState<DeletedCustomerRecord[]>(() => getDeletedCustomerRecords());
  const [deletedCount, setDeletedCount] = useState(() => getDeletedCustomerRecords().length);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

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

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setTestResult({
        success: false,
        message: 'Google Apps Script 배포 URL을 먼저 입력해주세요.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(url.trim(), { method: 'GET' });
      if (!res.ok) {
        throw new Error(`서버 응답 오류 (상태코드 ${res.status})`);
      }
      const data = await res.json();
      const tab1Count = Array.isArray(data.tab1) ? data.tab1.length : 0;
      const tab2Count = Array.isArray(data.tab2) ? data.tab2.length : 0;

      if (data.tab1 || data.tab2) {
        setTestResult({
          success: true,
          message: `✅ 구글 시트 연동 성공! tab1(온라인예약) ${tab1Count}건, tab2(매장배송) ${tab2Count}건을 정상 수신했습니다.`,
        });
      } else if (Array.isArray(data)) {
        setTestResult({
          success: true,
          message: `✅ 구글 시트 연동 성공! 총 ${data.length}건의 데이터를 확인했습니다.`,
        });
      } else {
        setTestResult({
          success: true,
          message: '⚠️ 응답을 받았으나 tab1/tab2 데이터 구조를 확인해주세요.',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `연결 테스트 실패: ${e.message || 'CORS 또는 배포 권한(액세스 권한: 모든 사용자)을 확인해주세요.'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // 1. Save Google Apps Script URL
    setGasApiUrl(url);

    // 2. Save Gemini API Key
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    // 3. Save HiPreed & Cards
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

    // Trigger sync in vanilla calculator if available
    if (typeof (window as any).updateCardTiers === 'function') {
      (window as any).updateCardTiers();
    }
    if (typeof (window as any).calc === 'function') {
      (window as any).calc();
    }

    onSaved();
    onClose();
  };

  const handleResetToSample = () => {
    clearGasApiUrl();
    setUrl('');
    setTestResult(null);
    setIsConfirmingReset(false);
    onSaved();
  };

  const handleRestoreIndividual = (customerId: string, customerName: string) => {
    restoreIndividualCustomer(customerId);
    const updated = getDeletedCustomerRecords();
    setDeletedRecords(updated);
    setDeletedCount(updated.length);
    setRestoreMessage(`'${customerName}' 고객이 성공적으로 복원되었습니다.`);
    onSaved();
    setTimeout(() => setRestoreMessage(null), 4000);
  };

  const handlePermanentDelete = (customerId: string, customerName: string) => {
    if (window.confirm(`'${customerName}' 고객을 휴지통에서 즉시 영구 삭제하시겠습니까?\n(영구 삭제 시 복원할 수 없습니다)`)) {
      permanentlyDeleteCustomer(customerId);
      const updated = getDeletedCustomerRecords();
      setDeletedRecords(updated);
      setDeletedCount(updated.length);
      setRestoreMessage(`'${customerName}' 고객이 휴지통에서 즉시 영구 삭제되었습니다.`);
      onSaved();
      setTimeout(() => setRestoreMessage(null), 4000);
    }
  };

  const handleRestoreDeleted = () => {
    if (window.confirm('휴지통에 보관된 모든 고객을 CRM 목록으로 복원하시겠습니까?')) {
      restoreAllDeletedCustomers();
      setDeletedRecords([]);
      setDeletedCount(0);
      setRestoreMessage('모든 삭제 고객이 성공적으로 전체 복원되었습니다.');
      onSaved();
      setTimeout(() => setRestoreMessage(null), 4000);
    }
  };

  const handlePurgeAll = () => {
    if (window.confirm('휴지통을 완전히 비우시겠습니까?\n보관 중인 모든 고객이 영구 삭제되며 복원할 수 없습니다.')) {
      purgeAllDeletedCustomers();
      setDeletedRecords([]);
      setDeletedCount(0);
      setRestoreMessage('휴지통이 완전히 비워졌습니다.');
      onSaved();
      setTimeout(() => setRestoreMessage(null), 4000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SAMPLE_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-base font-bold">환경설정 & 구글 시트 연동</h3>
              <p className="text-[11px] text-slate-300">
                경기광주점 Google Sheets Web App 실시간 연동 및 요율 설정
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('sheet')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'sheet'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>1. 구글 시트 실시간 연동 (CRM/배송)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
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
          {activeTab === 'sheet' && (
            <div className="space-y-4">
              {/* Notice answering user's question */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">시트 데이터 연동 안내:</span>
                  <p className="mt-0.5 text-[11px] text-amber-800">
                    현재 시트 URL이 비어있으면 초기 탑재된 <strong>[실제 매장 샘플(Mock) 데이터]</strong>가 표시됩니다.
                    아래에 구글 스프레드시트의 <strong>Apps Script 웹 앱 URL</strong>을 입력하고 저장하시면 실제 매장 데이터로 즉시 교체 및 동기화됩니다.
                  </p>
                </div>
              </div>

              {/* URL Input */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Google Apps Script Web App 배포 URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold whitespace-nowrap transition active:scale-95 disabled:opacity-50"
                  >
                    {testing ? '테스트 중...' : '연결 테스트'}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                  <span>※ 배포 시 액세스 권한: <strong>모든 사용자(Anyone)</strong> 설정 필수</span>
                  {url && (
                    isConfirmingReset ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-rose-600 font-bold text-[10px]">정말 초기화?</span>
                        <button
                          type="button"
                          onClick={handleResetToSample}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                        >
                          초기화
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingReset(false)}
                          className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingReset(true)}
                        className="text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        URL 삭제 (샘플 모드로 복귀)
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Auto Sync & Mobile Notifications Management */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔔</span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                        실시간 자동 동기화 &amp; 모바일 알림
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        오전 9시 · 오후 1시 · 오후 6시 정시 자동 동기화 및 3분 주기 실시간 감지
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
                          body: '스마트폰 화면이 꺼져있거나 다른 앱 사용 중에도 신규 고객 접수 및 배송 알림이 도착합니다.',
                        });
                      }
                      alert(res.message);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                    <span>알림 켜기 / 테스트</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] font-bold text-slate-600 pt-1">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>3분 주기 실시간 감지</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <span className="text-xs">⏰</span>
                    <span>09:00 / 13:00 / 18:00 정시</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <span className="text-xs">⚡</span>
                    <span>화면 복귀 시 즉시 동기화</span>
                  </div>
                </div>
              </div>

              {/* Deleted Customers Management (휴지통 & 30일 자동삭제 & 개별복원/즉시삭제) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                      <span>🗑️ CRM 삭제 고객 관리 (휴지통)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold border border-rose-200">
                        {deletedCount}건 보관 중
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        30일 경과 시 자동 영구삭제
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      원하는 고객만 <strong>[개별 복원]</strong>하거나 <strong>[즉시 삭제]</strong>할 수 있으며, 30일이 지난 고객은 자동으로 비워집니다.
                    </p>
                  </div>
                  {deletedCount > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleRestoreDeleted}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition cursor-pointer"
                        title="보관된 모든 고객을 CRM 목록으로 복원"
                      >
                        전체 복원
                      </button>
                      <button
                        type="button"
                        onClick={handlePurgeAll}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                        title="휴지통 완전히 비우기 (영구 삭제)"
                      >
                        휴지통 비우기
                      </button>
                    </div>
                  )}
                </div>

                {restoreMessage && (
                  <p className="text-[11px] text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 animate-in fade-in duration-200">
                    {restoreMessage}
                  </p>
                )}

                {/* 개별 삭제 고객 리스트 */}
                {deletedRecords.length > 0 ? (
                  <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-2 pr-1 border-t border-slate-200/80 pt-2.5">
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
                          className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {c.name || '성명 미상'}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {c.phone || '연락처 없음'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                {c.status}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold border ${
                                  record.daysRemaining <= 5
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                D-{record.daysRemaining}일 후 자동삭제
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 truncate">
                              <span>삭제일: {deletedDateFormatted}</span>
                              {c.slipNo && <span>전표: {c.slipNo}</span>}
                              {c.items && <span className="truncate">품목: {c.items}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRestoreIndividual(record.id, c.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition active:scale-95 cursor-pointer flex items-center gap-1"
                              title="해당 고객을 CRM 목록으로 복원"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              <span>복원</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDelete(record.id, c.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition active:scale-95 cursor-pointer flex items-center gap-1"
                              title="휴지통에서 즉시 영구 삭제 (복원 불가)"
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

              {/* Test result toast */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{testResult.message}</span>
                </div>
              )}

              {/* Script Guide Accordion */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-slate-700 font-bold text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-slate-500" />
                    <span>구글 시트 연동 스크립트 코드 확인 및 복사</span>
                  </span>
                  {showCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showCode && (
                  <div className="p-3 bg-slate-900 text-slate-200 text-[11px] space-y-2 font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                      <span className="text-slate-400">Google Apps Script (Code.gs)</span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1 text-[10px]"
                      >
                        {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{codeCopied ? '복사 완료!' : '코드 복사'}</span>
                      </button>
                    </div>
                    <pre className="max-h-48 overflow-y-auto whitespace-pre p-2 bg-slate-950 rounded text-slate-300 text-[10px]">
                      {GOOGLE_APPS_SCRIPT_SAMPLE_CODE}
                    </pre>
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
                  <span>Gemini AI API Key (최신 gemini-3.8-flash 초고속 가전 분석용)</span>
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
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>설정 저장 및 전체 적용</span>
          </button>
        </div>
      </div>
    </div>
  );
};
