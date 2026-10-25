import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { SMS_TEMPLATES } from '../data/mockData';

interface SMSModalProps {
  customer: CustomerItem | null;
  onClose: () => void;
  onMarkSent: (customerId: string) => void;
}

export const SMSModal: React.FC<SMSModalProps> = ({
  customer,
  onClose,
  onMarkSent,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    SMS_TEMPLATES[0].id
  );
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (customer) {
      let defaultId = SMS_TEMPLATES[0].id;
      if (customer.status === '미구매/고민중') {
        defaultId = 'promo_closing';
      } else if (customer.status === '계약완료') {
        defaultId = 'delivery_notice';
      }
      setSelectedTemplateId(defaultId);
      const tpl =
        SMS_TEMPLATES.find((t) => t.id === defaultId) || SMS_TEMPLATES[0];
      setMessageText(tpl.generate(customer));
      setCopied(false);
    }
  }, [customer]);

  if (!customer) return null;

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = SMS_TEMPLATES.find((t) => t.id === tplId);
    if (tpl) {
      setMessageText(tpl.generate(customer));
    }
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = messageText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const smsSeparator = isIOS ? '&' : '?';
  const smsHref = `sms:${cleanPhone}${smsSeparator}body=${encodeURIComponent(
    messageText
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                원클릭 맞춤 문자 / 알림톡 발송
              </h3>
              <p className="text-xs text-slate-300">
                수신자: <strong className="text-white">{customer.name}</strong>{' '}
                고객님 ({customer.phone || '번호 미입력'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* 4가지 상황별 템플릿 탭 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-600 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>상황별 자동 문구 템플릿 선택</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SMS_TEMPLATES.map((tpl) => {
                const active = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold border text-left transition cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="text-base">{tpl.icon}</span>
                    <span className="truncate">{tpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 문구 편집창 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">
                발송할 메시지 내용 (자유롭게 수정 가능)
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {messageText.length}자
              </span>
            </div>

            <textarea
              rows={11}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50/70 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>클립보드 복사 완료! (카톡 붙여넣기)</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>문구 복사 (카톡/PC 발송용)</span>
              </>
            )}
          </button>

          <a
            href={smsHref}
            onClick={() => {
              onMarkSent(customer.id);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition text-center"
          >
            <Smartphone className="w-4 h-4" />
            <span>휴대폰 문자앱 바로 열기</span>
            <Send className="w-3.5 h-3.5 ml-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
