import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, CheckCheck, RefreshCw } from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { syncSheetStatus } from '../services/gasApi';
import { formatLocalDateTime } from '../utils/date';

interface SMSModalProps {
  customer: CustomerItem | null;
  onClose: () => void;
  onMarkSent: (id: string, sentText?: string) => void;
}

export const SMSModal: React.FC<SMSModalProps> = ({
  customer,
  onClose,
  onMarkSent,
}) => {
  if (!customer) return null;

  const [selectedTemplate, setSelectedTemplate] = useState<'delivery' | 'renewal' | 'welcome' | 'custom'>('welcome');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const getInitialMessage = (type: string) => {
    switch (type) {
      case 'delivery':
        return `[롯데하이마트 경기광주점 배송안내]
안녕하세요 ${customer.name} 고객님!
주문하신 상품 배송 일정을 안내드립니다.

- 구매품목: ${customer.items || customer.category || '가전 상품'}
- 배송예정일: ${customer.deliveryDate || '배송일 조율중'}
- 비고: ${customer.note || '전문 기사님 해피콜 후 방문'}

배송 당일 기사님이 사전 연락 후 방문 설치해드릴 예정입니다.
궁금하신 점은 언제든 편하게 회신 부탁드립니다.
감사합니다!
- 롯데하이마트 경기광주점 드림`;

      case 'renewal':
        return `[롯데하이마트 경기광주점 리뉴얼 특가 안내]
안녕하세요 ${customer.name} 고객님!
롯데하이마트 경기광주점입니다.

상담 받으셨던 품목(${customer.items || customer.category || '가전 패키지'}) 관련하여, 10/2 경기광주점 리뉴얼 그랜드 오픈 행사 조건으로 추가 혜택과 특별 사은품이 확정되었습니다.

- 상담 내용: ${customer.note || '추가 프로모션 적용 가능'}
- 혜택 문의: 031-768-0000

방문 전 미리 연락 주시면 최우선 상담석을 예약해 드리겠습니다.
감사합니다!`;

      case 'welcome':
        return `[롯데하이마트 경기광주점 접수안내]
안녕하세요 ${customer.name} 고객님!
롯데하이마트 경기광주점 온라인 사전예약 상담 접수가 정상적으로 완료되었습니다.

- 문의품목: ${customer.category || customer.items || '가전 상담'}
- 접수일시: ${customer.date || '금일'}

담당 전문 상담사가 신속히 확인 후 최적의 견적과 혜택을 준비하여 유선 안내 드리겠습니다.
감사합니다!`;

      default:
        return `[롯데하이마트 경기광주점]
안녕하세요 ${customer.name} 고객님!
`;
    }
  };

  const [customText, setCustomText] = useState(getInitialMessage('welcome'));

  const handleSelectTemplate = (type: 'delivery' | 'renewal' | 'welcome' | 'custom') => {
    setSelectedTemplate(type);
    setCustomText(getInitialMessage(type));
  };

  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doSyncAndMark = async () => {
    setIsSyncing(true);
    const nowStr = formatLocalDateTime(new Date());
    const statusText = `발송 완료 (${nowStr})`;
    
    // Sync to Google Sheet Apps Script
    await syncSheetStatus(customer, statusText, `[문자발송] ${selectedTemplate}: ${customText.slice(0, 60)}`);
    onMarkSent(customer.id, customText);
    setIsSyncing(false);
  };

  const handleSendSMS = async () => {
    await doSyncAndMark();
    const encoded = encodeURIComponent(customText);
    window.location.href = `sms:${cleanPhone}?body=${encoded}`;
    onClose();
  };

  const handleMarkSentOnly = async () => {
    await doSyncAndMark();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">고객 문자(SMS) 발송</h3>
              <p className="text-[11px] text-slate-300">
                수신: <span className="text-white font-bold">{customer.name} 고객님</span> ({customer.phone})
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

        {/* Template Buttons */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => handleSelectTemplate('delivery')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              selectedTemplate === 'delivery'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            🚚 배송일정 안내
          </button>
          <button
            type="button"
            onClick={() => handleSelectTemplate('renewal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              selectedTemplate === 'renewal'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            🎉 리뉴얼 특가안내
          </button>
          <button
            type="button"
            onClick={() => handleSelectTemplate('welcome')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              selectedTemplate === 'welcome'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            📋 신규접수 환영
          </button>
          <button
            type="button"
            onClick={() => handleSelectTemplate('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              selectedTemplate === 'custom'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            ✏️ 직접 작성
          </button>
        </div>

        {/* Body Textarea */}
        <div className="p-4 flex-1 flex flex-col">
          <label className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>문자 본문 내용</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {customText.length}자 (단문/장문)
            </span>
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full flex-1 min-h-[180px] p-3 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
            placeholder="고객님께 전달할 문자 내용을 입력하세요."
          />
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사완료!' : '텍스트 복사'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-bold transition"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleMarkSentOnly}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
              title="문자는 이미 다른 폰/외부에서 보냈고, 앱과 구글 시트에 발송완료로만 동기화할 때 클릭"
            >
              {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />}
              <span>시트 발송완료 처리</span>
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSendSMS}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-900/20 transition active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>문자 앱으로 열기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
