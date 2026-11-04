import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Image as ImageIcon,
  MailOpen,
  MessageSquare,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { SMS_TEMPLATES } from '../data/mockData';
import {
  copyBusinessCardImageToClipboard,
  getEffectiveBusinessCardDataUri,
  isOwnerMarketingDbUnlocked,
  loadMarketingDbStore,
  shareBusinessCardFileWithText,
  warmUpBusinessCardCache,
} from '../../utils/marketingDbEngine';

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
  const [includeOwnerCard, setIncludeOwnerCard] = useState<boolean>(true);
  const [cardNotice, setCardNotice] = useState<string | null>(null);

  const isOwnerDevice =
    typeof window !== 'undefined' && isOwnerMarketingDbUnlocked();
  const ownerCardDataUri = isOwnerDevice
    ? getEffectiveBusinessCardDataUri(loadMarketingDbStore().config)
    : '';

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
      setCardNotice(null);
      if (isOwnerMarketingDbUnlocked()) {
        warmUpBusinessCardCache();
      }
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

  const handleOpenSmsApp = async () => {
    onMarkSent(customer.id);
    if (isOwnerDevice && includeOwnerCard && ownerCardDataUri) {
      const imgOk = await copyBusinessCardImageToClipboard(ownerCardDataUri);
      if (imgOk) {
        setCardNotice(
          '🪪 명함 이미지가 키보드 클립보드에 복사되었습니다! 문자 입력칸에서 붙여넣기 해주세요.'
        );
        await new Promise((r) => setTimeout(r, 320));
      }
    }
    window.location.href = smsHref;
  };

  const handleDirectShareWithBusinessCard = () => {
    if (!ownerCardDataUri) return;
    // 클릭 제스처(User Activation) 보존을 위해 await 없이 즉시 호출!
    shareBusinessCardFileWithText({
      dataUri: ownerCardDataUri,
      bodyText: messageText,
      customerPhone: customer.phone,
    }).then((res) => {
      if (res === 'shared') {
        onMarkSent(customer.id);
        setCardNotice(
          `✅ 명함 사진+문구 공유창 전달 완료! (고객 번호 ${customer.phone} 자동 복사됨)`
        );
      } else if (res === 'unsupported') {
        void handleOpenSmsApp();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] modal-kb-safe">
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

          <div className="flex items-center gap-1.5">
            {cleanPhone && (
              <a
                href={`sms:${cleanPhone}`}
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black inline-flex items-center gap-1 transition"
                title="자동 문구 없이 이 번호와의 문자 대화내역만 바로 확인"
              >
                <MailOpen className="w-3.5 h-3.5" />
                <span>문자내역만 보기</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-5 overflow-y-auto space-y-4">
          {cardNotice && (
            <div className="p-3 rounded-2xl bg-indigo-950 text-amber-200 text-xs font-extrabold leading-relaxed">
              {cardNotice}
            </div>
          )}

          {/* 국지현 전용: 명함 사진 동봉 선택 바 (타 직원 기기 노출 0%) */}
          {isOwnerDevice && ownerCardDataUri && (
            <div className="p-3 rounded-2xl bg-indigo-50/90 border border-indigo-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={ownerCardDataUri}
                  alt="내 명함"
                  className="w-16 h-auto rounded-lg border border-indigo-200 bg-white shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-black text-indigo-950 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">내 명함 사진 함께 보내기</span>
                  </div>
                  <p className="text-[11px] text-indigo-800/85 font-semibold leading-snug mt-0.5">
                    [명함파일 직접첨부]를 누르면 사진+문구가 한번에 첨부되며 고객 번호는 자동 복사됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncludeOwnerCard((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 cursor-pointer transition ${
                  includeOwnerCard
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-300'
                }`}
              >
                {includeOwnerCard ? '동봉 ON' : 'OFF'}
              </button>
            </div>
          )}

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
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50/70 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-2">
          {isOwnerDevice && includeOwnerCard && ownerCardDataUri && (
            <button
              type="button"
              onClick={handleDirectShareWithBusinessCard}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>🪪 명함파일+문자 자동첨부 발송 (MMS·카톡 추천)</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>클립보드 복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>문구만 복사</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenSmsApp}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {isOwnerDevice && includeOwnerCard
                  ? '번호자동 문자앱 (명함복사)'
                  : '휴대폰 문자앱 바로 열기'}
              </span>
              <Send className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
