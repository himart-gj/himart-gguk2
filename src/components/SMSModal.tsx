import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, CheckCheck } from 'lucide-react';
import { CustomerItem } from '../types/crm';

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
  const [selectedTemplate, setSelectedTemplate] = useState<'welcome' | 'custom'>('welcome');
  const [copied, setCopied] = useState(false);

  const getInitialMessage = (type: 'welcome' | 'custom') => {
    if (!customer) return '';
    if (type === 'welcome') {
      return `안녕하세요. ${customer.name || '고객'}님 경기광주하이마트 국지현입니다. 희망하시는 상담내용을 문자로 남겨주시거나 전화주시면 감사하겠습니다.`;
    }
    return `안녕하세요. ${customer.name || '고객'}님 경기광주하이마트 국지현입니다. `;
  };

  const [customText, setCustomText] = useState(() => getInitialMessage('welcome'));

  const handleSelectTemplate = (type: 'welcome' | 'custom') => {
    setSelectedTemplate(type);
    setCustomText(getInitialMessage(type));
  };

  if (!customer) return null;

  const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSMS = () => {
    onMarkSent(customer.id, customText);
    const encoded = encodeURIComponent(customText);
    window.location.href = `sms:${cleanPhone}?body=${encoded}`;
    onClose();
  };

  const handleMarkSentOnly = () => {
    onMarkSent(customer.id, customText);
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Simple Template Buttons */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSelectTemplate('welcome')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedTemplate === 'welcome'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>📋 예약안내</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTemplate('custom')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedTemplate === 'custom'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>✏️ 직접입력</span>
          </button>
        </div>

        {/* Body Textarea */}
        <div className="p-4 flex-1 flex flex-col">
          <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>문자 본문 내용</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {customText.length}자
            </span>
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full flex-1 min-h-[160px] p-3.5 text-sm leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
            placeholder="고객님께 전달할 문자 내용을 입력하세요."
          />
        </div>

        {/* Footer actions - Large thumb-friendly buttons */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="py-3 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{copied ? '복사완료!' : '📋 텍스트 복사'}</span>
            </button>

            <button
              type="button"
              onClick={handleMarkSentOnly}
              className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>✅ 발송완료 체크</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSendSMS}
            className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-rose-900/20 transition active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>💬 문자 앱으로 열기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
