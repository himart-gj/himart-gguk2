import React, { useEffect, useRef, useState } from 'react';
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
  Trash2,
  Upload,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { SMS_TEMPLATES } from '../data/mockData';
import {
  buildNativeSmsHref,
  clearConsultantBusinessCardDataUri,
  compressBusinessCardFileToDataUri,
  CONSULTANT_CARD_UPDATED_EVENT,
  copyConsultantCardToClipboard,
  hydrateConsultantBusinessCardFromIdb,
  loadConsultantBusinessCardDataUri,
  loadConsultantCardAutoInclude,
  saveConsultantBusinessCardDataUri,
  saveConsultantCardAutoInclude,
  shareConsultantBusinessCardWithText,
} from '../../utils/consultantBusinessCard';
import { loadConsultantProfile } from '../../utils/shareQuoteCodec';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';

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
  const [cardDataUri, setCardDataUri] = useState<string>(() =>
    loadConsultantBusinessCardDataUri()
  );
  const [includeCard, setIncludeCard] = useState<boolean>(() =>
    loadConsultantCardAutoInclude()
  );
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  const cardInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!customer) return;
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

    setCardDataUri(loadConsultantBusinessCardDataUri());
    setIncludeCard(loadConsultantCardAutoInclude());
    void hydrateConsultantBusinessCardFromIdb().then((restored) => {
      if (restored) {
        setCardDataUri(restored);
        setIncludeCard(loadConsultantCardAutoInclude());
      }
    });

    const syncCard = () => {
      setCardDataUri(loadConsultantBusinessCardDataUri());
      setIncludeCard(loadConsultantCardAutoInclude());
    };
    window.addEventListener(CONSULTANT_CARD_UPDATED_EVENT, syncCard);
    return () => {
      window.removeEventListener(CONSULTANT_CARD_UPDATED_EVENT, syncCard);
    };
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

  const handleUploadCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressBusinessCardFileToDataUri(file);
      saveConsultantBusinessCardDataUri(compressed);
      setCardDataUri(compressed);
      setIncludeCard(true);
      setCardNotice('✅ 본인 명함 사진이 저장되었습니다! 제안서 공유창에서도 함께 사용됩니다.');
    } catch {
      setCardNotice('⚠️ 명함 이미지를 불러오지 못했습니다.');
    }
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

  const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');
  const smsHref = buildNativeSmsHref(customer.phone, messageText);
  const hasActiveCard = Boolean(cardDataUri && includeCard);

  const handleOpenSmsApp = async () => {
    onMarkSent(customer.id);
    if (hasActiveCard) {
      const imgOk = await copyConsultantCardToClipboard(cardDataUri);
      if (imgOk) {
        setCardNotice(
          '🪪 명함 이미지가 클립보드에 복사되었습니다! 열린 문자창(PC Ctrl+V / 모바일 클립보드)에서 붙여넣기 해주세요.'
        );
        await new Promise((r) => setTimeout(r, 280));
      }
    }
    window.location.href = smsHref;
  };

  const handleDirectShareWithBusinessCard = () => {
    if (!cardDataUri) return;
    const prof = loadConsultantProfile();
    shareConsultantBusinessCardWithText({
      dataUri: cardDataUri,
      bodyText: messageText,
      customerPhone: customer.phone,
      storeName: prof.storeName,
      consultantName: prof.name,
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
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title="원클릭 맞춤 문자 / 알림톡 발송"
      subtitle={
        <>
          수신자:{' '}
          <strong className="text-[#191F28] dark:text-slate-100">
            {customer.name}
          </strong>{' '}
          고객님 (
          <span className="font-mono tabular-nums">
            {customer.phone || '번호 미입력'}
          </span>
          )
        </>
      }
      icon={<MessageSquare className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
      headerRight={
        cleanPhone ? (
          <a
            href={`sms:${cleanPhone}`}
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/15 hover:bg-blue-100/80 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-extrabold inline-flex items-center gap-1 transition"
            title="자동 문구 없이 이 번호와의 문자 대화내역만 바로 확인"
          >
            <MailOpen className="w-3.5 h-3.5" />
            <span>문자내역만 보기</span>
          </a>
        ) : undefined
      }
      maxWidthClass="max-w-lg"
      bodyClassName="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1"
      footer={
        <div className="space-y-2">
          {hasActiveCard && (
            <button
              type="button"
              onClick={handleDirectShareWithBusinessCard}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold bg-[#191F28] hover:bg-slate-800 dark:bg-[#60A5FA] dark:hover:bg-blue-300 text-white dark:text-[#0B1120] shadow-xs transition cursor-pointer"
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
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : 'bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#191F28] dark:text-slate-100 border-[#D1D6DB] dark:border-slate-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>클립보드 복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#4E5968] dark:text-slate-300" />
                  <span>문구만 복사</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleOpenSmsApp()}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#E60012] hover:bg-[#C8000F] text-white shadow-xs transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {hasActiveCard
                  ? '번호자동 문자앱 (명함복사)'
                  : '휴대폰·PC 문자앱 열기'}
              </span>
              <Send className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      }
    >
      <input
        ref={cardInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadCard}
        className="hidden"
      />

      {cardNotice && (
        <div className="p-3 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[#1B64DA] dark:text-blue-300 text-xs font-extrabold leading-relaxed">
          {cardNotice}
        </div>
      )}

      {/* 기기별 내 명함 사진 등록 · 자동 동봉 바 */}
      <div className="p-3 rounded-2xl bg-[#EFF6FF] dark:bg-blue-500/12 border border-[#BFDBFE] dark:border-blue-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {cardDataUri && (
            <img
              src={cardDataUri}
              alt="내 명함"
              className="w-16 max-h-12 object-contain rounded-lg border border-[#BFDBFE] dark:border-blue-500/30 bg-white shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400 shrink-0" />
              <span className="truncate">내 명함 사진 함께 보내기</span>
            </div>
            <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 font-semibold leading-snug mt-0.5">
              {cardDataUri
                ? '[명함파일+문자 자동첨부] 터치 시 사진+문구가 함께 첨부됩니다.'
                : '본인 명함을 1회 등록해 두면 문자 발송 시 계속 함께 보낼 수 있습니다.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => cardInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[11.5px] font-extrabold text-[#191F28] dark:text-slate-100 inline-flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>{cardDataUri ? '교체' : '명함 등록'}</span>
          </button>
          {cardDataUri && (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = !includeCard;
                  setIncludeCard(next);
                  saveConsultantCardAutoInclude(next);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition ${
                  includeCard
                    ? 'bg-[#1B64DA] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border border-[#D1D6DB] dark:border-slate-700'
                }`}
              >
                {includeCard ? '동봉 ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearConsultantBusinessCardDataUri();
                  setCardDataUri('');
                  setIncludeCard(false);
                }}
                className="p-1.5 rounded-lg text-[#8B95A1] hover:text-[#E60012] cursor-pointer"
                title="명함 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4가지 상황별 템플릿 탭 */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#4E5968] dark:text-slate-300 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
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
                    ? 'bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] border-[#191F28] dark:border-[#60A5FA] shadow-xs'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/70 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 text-[#4E5968] dark:text-slate-300 border-[#E5E8EB] dark:border-slate-700'
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
          <span className="text-xs font-bold text-[#4E5968] dark:text-slate-400">
            발송할 메시지 내용 (자유롭게 수정 가능)
          </span>
          <span className="text-[11.5px] font-semibold font-mono tabular-nums text-[#8B95A1] dark:text-slate-400">
            {messageText.length}자
          </span>
        </div>

        <textarea
          rows={9}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          className="w-full p-3.5 rounded-2xl border border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/70 text-base sm:text-sm text-[#191F28] dark:text-slate-100 leading-relaxed font-medium focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B64DA]"
        />
      </div>
    </FlagshipModalShell>
  );
};
