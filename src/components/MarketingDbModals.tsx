import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardPaste,
  Coins,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  Lock,
  MailOpen,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  addOrReviveManualLeadInStore,
  buildAllLeadTombstoneKeys,
  buildLeadAutoSummary,
  copyBusinessCardImageToClipboard,
  DEFAULT_INSTA_SHEET_URL,
  getCanonicalPhoneDigits,
  getEffectiveBusinessCardDataUri,
  getOwnerDbPin,
  getReadyMadeAppsScriptCode,
  HandoverStaffOption,
  hydrateMarketingDbStoreFromIdb,
  importLeadsFromFile,
  importLeadsFromRawText,
  loadHandoverStaffOptions,
  loadMarketingDbStore,
  lockOwnerMarketingDb,
  makeLeadFingerprint,
  MARKETING_DB_UPDATED_EVENT,
  MARKETING_LEAD_STATUSES,
  MarketingDbStore,
  MarketingLeadItem,
  MarketingLeadStatus,
  MarketingSmsTemplate,
  normalizeKoreanLeadPhone,
  normalizeLeadDateTime,
  pushMarketingStateToGasBackup,
  renderSmsTemplateForLead,
  saveMarketingDbStore,
  saveMarketingLeadToCrm,
  setOwnerDbPin,
  shareBusinessCardFileWithText,
  syncLeadsFromGoogleSheet,
  syncMarketingDbTrashFromCrmCustomer,
  warmUpBusinessCardCache,
} from '../utils/marketingDbEngine';
import { compressImageFile } from '../utils/aiImageParser';
import { DEFAULT_OWNER_BUSINESS_CARD_DATA_URI } from '../utils/ownerBusinessCardAsset';
import {
  buildPrimaryFieldsFromQuote,
  CRM_CUSTOMERS_UPDATED_EVENT,
  deleteQuoteAndSyncCustomer,
  getCachedCustomers,
  setCachedCustomers,
  syncCustomerToGas,
} from '../crm/services/gasApi';
import { CustomerDetailModal } from '../crm/components/CustomerDetailModal';
import { SMSModal } from '../crm/components/SMSModal';
import { CustomerItem, CustomerStatus, QuoteRecord } from '../crm/types/crm';
import { safeCopyText } from '../utils/mobileQaRuntime';
import { FlagshipModalShell } from './ui/FlagshipModalShell';
import { SurfaceCard } from './ui/SurfaceCard';
import { FormattedMoneyInput } from './FormattedMoneyInput';

export const UNASSIGNED_HANDOVER_STAFF = '담당 미지정';

const MDB_LAST_STATUS_TAB_KEY = 'himart_mdb_last_tab_v1';
const MDB_LAST_HANDOVER_SUB_KEY = 'himart_mdb_last_handover_sub_v1';
const MDB_LAST_SELLER_SUB_KEY = 'himart_mdb_last_seller_sub_v1';
const VALID_MDB_TABS: readonly StatusFilterTab[] = ['신규', '문자전송', '상담진행중', '무응답', '타직원인계', '계약완료', '휴지통'];

export interface MarketingDbManagerViewProps {
  onBackToHome: () => void;
  backLabel?: string;
  onLockAndHideMenu: () => void;
  onOpenCustomerInCrm: (customerId?: string) => void;
  onOpenCustomerInQuoteBuilder: (customer: CustomerItem) => void;
  onOpenQuoteRecordInQuoteBuilder?: (
    customer: CustomerItem,
    quote: QuoteRecord
  ) => void;
  isDark?: boolean;
}

export type StatusFilterTab = MarketingLeadStatus | '휴지통';

export function getStatusBadgeStyle(status: MarketingLeadStatus, _isDark?: boolean): string {
  switch (status) {
    case '신규':
      return 'bg-[#FFF1F2] text-[#E60012] border-[#FECDD3] dark:bg-rose-500/15 dark:text-[#FF3B47] dark:border-rose-500/30';
    case '문자전송':
      return 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE] dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    case '상담진행중':
      return 'bg-[#EFF6FF] text-[#1B64DA] border-[#BFDBFE] dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-400/40';
    case '무응답':
      return 'bg-[#F2F4F6] text-[#4E5968] border-[#D1D6DB] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    case '타직원인계':
      return 'bg-[#F8FAFC] text-[#191F28] border-[#D1D6DB] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
    case '계약완료':
      return 'bg-emerald-50 text-[#059669] border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35';
  }
}

export function getStatusActiveBtnStyle(status: MarketingLeadStatus): string {
  switch (status) {
    case '신규':
      return 'bg-[#E60012] text-white border-[#E60012] shadow-2xs';
    case '문자전송':
      return 'bg-[#1B64DA] text-white border-[#1B64DA] shadow-2xs';
    case '상담진행중':
      return 'bg-[#1B64DA] text-white border-[#1B64DA] shadow-2xs';
    case '무응답':
      return 'bg-[#4E5968] text-white border-[#4E5968] dark:bg-slate-600 dark:border-slate-600 shadow-2xs';
    case '타직원인계':
      return 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA] shadow-2xs';
    case '계약완료':
      return 'bg-[#059669] text-white border-[#059669] shadow-2xs';
  }
}


export const MarketingDbModals: React.FC<{ ctx: any }> = ({ ctx }) => {
  const {
    businessCardInputRef,
    cardSurface,
    commitStore,
    copiedScript,
    crmCustomers,
    csvFileInputRef,
    gasUrlInput,
    handleAddManualLead,
    handleBusinessCardImageUpload,
    handleCsvFileUpload,
    handleInlineApplyQuoteAsPrimary,
    handleInlineCrmFieldChange,
    handleInlineCrmMemoChange,
    handleInlineCrmStatusChange,
    handleInlineDeleteCustomer,
    handleInlineDeleteQuoteRecord,
    handlePasteImport,
    inlineSelectedCustomer,
    inlineSmsCustomer,
    inputSurface,
    isAddModalOpen,
    isSettingsOpen,
    isSyncing,
    newLeadBenefit,
    newLeadHandoverStaff,
    newLeadInitialStatus,
    newLeadIsHandover,
    newLeadMemo,
    newLeadName,
    newLeadPhone,
    newLeadPlatform,
    newLeadRevenue,
    newPinInput,
    onOpenCustomerInQuoteBuilder,
    onOpenQuoteRecordInQuoteBuilder,
    pasteRawText,
    setCopiedScript,
    setGasUrlInput,
    setInlineDetailCustomerId,
    setInlineSmsCustomer,
    setIsAddModalOpen,
    setIsSettingsOpen,
    setIsSyncing,
    setNewLeadBenefit,
    setNewLeadHandoverStaff,
    setNewLeadInitialStatus,
    setNewLeadIsHandover,
    setNewLeadMemo,
    setNewLeadName,
    setNewLeadPhone,
    setNewLeadPlatform,
    setNewLeadRevenue,
    setNewPinInput,
    setPasteRawText,
    setSettingsTab,
    setSheetUrlInput,
    setSmsPreviewIncludeCard,
    setSmsPreviewLead,
    setSmsPreviewText,
    setSmsPreviewTplId,
    setStore,
    settingsTab,
    sheetUrlInput,
    showToast,
    smsPreviewIncludeCard,
    smsPreviewLead,
    smsPreviewText,
    smsPreviewTplId,
    staffOptions,
    store,
    subSurface,
    triggerDirectFileShareWithCard,
    triggerNativeSmsSend
  } = ctx;

  return (
    <>
      {/* ==================== 모달 1: 고객별 문자 미리보기 / 문구 선택 발송 ==================== */}
      <FlagshipModalShell
        isOpen={Boolean(smsPreviewLead)}
        onClose={() => setSmsPreviewLead(null)}
        title={smsPreviewLead ? `${smsPreviewLead.customerName} 고객님 문자 발송` : ''}
        icon={<MessageSquare className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
        maxWidthClass="max-w-lg"
        bodyClassName="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1"
        headerRight={
          smsPreviewLead?.phone ? (
            <a
              href={`sms:${smsPreviewLead.phone.replace(/[^0-9+]/g, '')}`}
              onClick={() => setSmsPreviewLead(null)}
              className="px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-black inline-flex items-center gap-1 transition-colors"
              title="자동 문구 없이 문자 대화내역만 보기"
            >
              <MailOpen className="w-3.5 h-3.5" />
              <span>문자내역만 보기</span>
            </a>
          ) : undefined
        }
      >
        {smsPreviewLead && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#4E5968] dark:text-slate-300">
                문자 템플릿 선택
              </label>
              <select
                value={smsPreviewTplId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSmsPreviewTplId(id);
                  const found = store.config.smsTemplates.find(
                    (t: MarketingSmsTemplate) => t.id === id
                  );
                  if (found) {
                    setSmsPreviewText(
                      renderSmsTemplateForLead(found.body, smsPreviewLead)
                    );
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
              >
                {store.config.smsTemplates.map((tpl: MarketingSmsTemplate) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 명함 사진 동봉 선택 (신규고객 자동 ON / 나머지 선택사항) */}
            <SurfaceCard tone="sub" padded={false} className="p-3 space-y-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-black flex items-center gap-1.5 text-[#191F28] dark:text-slate-100">
                  <ImageIcon className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                  <span>
                    명함 사진 함께 보내기{' '}
                    <span className="text-[11.5px] text-[#4E5968] dark:text-slate-400">
                      ({smsPreviewLead.status === '신규' ? '신규고객 자동 ON' : '선택사항'})
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={smsPreviewIncludeCard}
                  onChange={(e) => setSmsPreviewIncludeCard(e.target.checked)}
                  className="w-4 h-4 accent-[#1B64DA] cursor-pointer"
                />
              </label>

              {smsPreviewIncludeCard && (
                <div className="flex items-center gap-3 pt-1">
                  {getEffectiveBusinessCardDataUri(store.config) ? (
                    <img
                      src={getEffectiveBusinessCardDataUri(store.config)}
                      alt="등록된 명함 미리보기"
                      className="w-28 h-auto rounded-lg border border-[#E5E8EB] dark:border-slate-700 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-28 h-16 rounded-lg border border-dashed border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 flex items-center justify-center text-[11px] font-bold text-[#8B95A1] text-center px-2 shrink-0">
                      명함 미등록
                      <br />
                      (설정에서 등록)
                    </div>
                  )}
                  <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 leading-relaxed">
                    • <strong>[문자앱 바로 열기]</strong>: 수신번호·문구가 자동 입력되며 명함 이미지가 클립보드에 자동 복사됩니다.
                    <br />• <strong>[명함파일 직접첨부]</strong>: 명함 사진 파일이 이미 첨부된 상태로 메시지/카톡 공유창이 열립니다(전화번호 자동 복사).
                  </p>
                </div>
              )}
            </SurfaceCard>

            <textarea
              rows={7}
              value={smsPreviewText}
              onChange={(e) => setSmsPreviewText(e.target.value)}
              className={`w-full p-3 rounded-2xl border text-base sm:text-xs font-medium leading-relaxed ${inputSurface}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {smsPreviewIncludeCard ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerNativeSmsSend(target, smsPreviewText, true);
                    }}
                    className="py-3 px-3 rounded-2xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>문자앱 바로열기 (명함복사됨)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerDirectFileShareWithCard(target, smsPreviewText);
                    }}
                    className="py-3 px-3 rounded-2xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>명함파일 직접첨부 (MMS·카톡)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await safeCopyText(smsPreviewText)) {
                        showToast('문자 문구가 복사되었습니다.');
                      }
                    }}
                    className={`py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 hover:bg-[#F2F4F6] dark:hover:bg-slate-800 cursor-pointer transition-colors ${subSurface}`}
                  >
                    <Copy className="w-4 h-4" />
                    <span>문구만 복사</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = smsPreviewLead;
                      setSmsPreviewLead(null);
                      triggerNativeSmsSend(target, smsPreviewText, false);
                    }}
                    className="py-3 rounded-2xl bg-[#1B64DA] hover:bg-[#1554B8] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span>문자만 바로 열기</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </FlagshipModalShell>

      {/* ==================== 모달 2: 고정 문자 편집 · 구글시트 실시간 연동 · 보안코드 설정 ==================== */}
      <FlagshipModalShell
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="DB관리 고정문자 · 구글시트 자동연동 설정"
        icon={<Settings className="w-4 h-4 text-[#191F28] dark:text-slate-200" />}
        maxWidthClass="max-w-xl"
        bodyClassName="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1"
      >
        <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border ${subSurface}`}>
          {[
            { id: 'sms', label: '📩 고정문자 설정' },
            { id: 'sheet', label: '🔄 구글시트 연동' },
            { id: 'security', label: '🔒 비공개 보안' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSettingsTab(t.id as any)}
              className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-colors ${
                settingsTab === t.id
                  ? 'bg-[#191F28] text-white dark:bg-[#60A5FA] dark:text-[#0B1120]'
                  : 'text-[#4E5968] dark:text-slate-400 hover:text-[#191F28] dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {settingsTab === 'sms' && (
          <div className="space-y-3">
            <SurfaceCard tone="sub" padded={false} className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-black flex items-center gap-1.5 text-[#191F28] dark:text-slate-100">
                  <CreditCard className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />
                  <span>신규고객 자동동봉 명함 이미지 &amp; 발송 방식</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={businessCardInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBusinessCardImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => businessCardInputRef.current?.click()}
                    className={`px-2.5 py-1 rounded-lg border text-[11.5px] font-black cursor-pointer ${cardSurface}`}
                  >
                    명함 교체
                  </button>
                  {store.config.businessCardDataUri &&
                    store.config.businessCardDataUri !==
                      DEFAULT_OWNER_BUSINESS_CARD_DATA_URI && (
                      <button
                        type="button"
                        onClick={() => {
                          commitStore((prev: MarketingDbStore) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              businessCardDataUri:
                                DEFAULT_OWNER_BUSINESS_CARD_DATA_URI,
                            },
                          }));
                          showToast(
                            DEFAULT_OWNER_BUSINESS_CARD_DATA_URI
                              ? '기본 명함으로 복원되었습니다.'
                              : '등록된 명함 이미지가 삭제되었습니다.'
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#F2F4F6] dark:bg-slate-800 border border-[#D1D6DB] dark:border-slate-700 text-[11.5px] font-bold text-[#4E5968] dark:text-slate-300 cursor-pointer"
                      >
                        {DEFAULT_OWNER_BUSINESS_CARD_DATA_URI
                          ? '기본명함 복원'
                          : '명함 삭제'}
                      </button>
                    )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {getEffectiveBusinessCardDataUri(store.config) ? (
                  <img
                    src={getEffectiveBusinessCardDataUri(store.config)}
                    alt="등록된 명함"
                    className="w-40 h-auto rounded-xl border border-[#E5E8EB] dark:border-slate-700 bg-white shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-40 h-24 rounded-xl border border-dashed border-[#D1D6DB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 flex items-center justify-center text-xs font-bold text-[#8B95A1] text-center px-3 shrink-0">
                    등록된 명함 없음
                    <br />
                    [명함 교체]로 등록
                  </div>
                )}
                <div className="space-y-1.5 text-[11.5px] w-full">
                  <div className="font-extrabold text-[#4E5968] dark:text-slate-300">
                    카드 하단 [명함+문자 발송] 버튼 기본 동작 선택:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      {
                        id: 'share-sheet' as const,
                        label:
                          '① 명함파일 직접첨부 공유창 (추천 · 명함사진+본문 자동첨부, 번호 자동복사)',
                      },
                      {
                        id: 'sms-clipboard' as const,
                        label:
                          '② 문자앱 바로열기 (수신번호·본문 자동입력 + 명함 키보드 클립보드 복사)',
                      },
                    ].map((opt) => {
                      const active =
                        (store.config.businessCardSendMethod ||
                          'share-sheet') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            commitStore((prev: MarketingDbStore) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                businessCardSendMethod: opt.id,
                              },
                            }))
                          }
                          className={`p-2 rounded-xl border text-left font-black cursor-pointer transition ${
                            active
                              ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                              : `${cardSurface} text-[#4E5968] dark:text-slate-300 hover:bg-[#F2F4F6] dark:hover:bg-slate-800`
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <p className="text-xs text-[#4E5968] dark:text-slate-300 leading-relaxed">
              • 카드 하단 <strong>[정해진 문자발송]</strong> 버튼을 누르면 아래에서 기본으로 지정한 문구가 자동으로 채워져 문자앱이 열립니다. (주고받은 내역만 볼 때는 전화번호 옆 <strong>[문자내역]</strong> 버튼을 누르세요!)
              <br />• 사용 가능한 자동 치환어:{' '}
              <code className="font-mono font-bold text-[#1B64DA] dark:text-blue-400">
                {'{고객명}'} {'{플랫폼}'} {'{희망혜택}'} {'{안내방식}'} {'{요약}'}
              </code>
            </p>

            {store.config.smsTemplates.map((tpl: MarketingSmsTemplate) => {
              const isDefault = store.config.activeTemplateId === tpl.id;
              return (
                <SurfaceCard
                  key={tpl.id}
                  tone="sub"
                  padded={false}
                  className="p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={tpl.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        commitStore((prev: MarketingDbStore) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            smsTemplates: prev.config.smsTemplates.map(
                              (item) =>
                                item.id === tpl.id
                                  ? { ...item, title: val }
                                  : item
                            ),
                          },
                        }));
                      }}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-black ${inputSurface}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        commitStore((prev: MarketingDbStore) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            activeTemplateId: tpl.id,
                          },
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] font-black cursor-pointer shrink-0 transition-colors ${
                        isDefault
                          ? 'bg-[#1B64DA] text-white'
                          : 'bg-[#F2F4F6] dark:bg-slate-800 text-[#4E5968] dark:text-slate-300 border border-[#D1D6DB] dark:border-slate-700'
                      }`}
                    >
                      {isDefault ? '✓ 기본 고정문자' : '기본으로 지정'}
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={tpl.body}
                    onChange={(e) => {
                      const val = e.target.value;
                      commitStore((prev: MarketingDbStore) => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          smsTemplates: prev.config.smsTemplates.map(
                            (item) =>
                              item.id === tpl.id
                                ? { ...item, body: val }
                                : item
                          ),
                        },
                      }));
                    }}
                    className={`w-full p-2.5 rounded-xl border text-base sm:text-xs leading-relaxed ${inputSurface}`}
                  />
                </SurfaceCard>
              );
            })}
          </div>
        )}

        {settingsTab === 'sheet' && (
          <div className="space-y-3.5 text-xs">
            {/* 방법 A: 코드 복사 없이 모바일/PC에서 10초 만에 켜는 초간단 자동연동 */}
            <SurfaceCard tone="emerald" padded={false} className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black text-[#059669] dark:text-emerald-300">
                  ① [초간단 10초 완성 · 코드 불필요] 시트 공유 1회 허용으로 즉시 자동연동
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11.5px] font-black ${
                    store.config.lastSyncStatus === 'connected'
                      ? 'bg-[#059669] text-white'
                      : 'bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30'
                  }`}
                >
                  {store.config.lastSyncStatus === 'connected'
                    ? '✓ 실시간 연동됨'
                    : '시트 공유 허용 대기중'}
                </span>
              </div>
              <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 leading-relaxed">
                앱에 이미 <strong>[인스타 광고 전용 DB]</strong> 시트 고유 주소가 사전 세팅되어 있습니다! 아래 버튼으로 시트를 연 뒤 우측 상단 <strong>[공유 → 일반 액세스: &lsquo;링크가 있는 모든 사용자(뷰어)&rsquo;]</strong>로 1회만 바꿔주시면, 앱을 열 때마다·45초마다 신규 DB가 자동으로 들어옵니다. (DB 메뉴 자체가 비밀번호로 숨겨져 있어 타 직원은 볼 수 없습니다.)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <a
                  href={sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>1단계: 인스타 DB 시트 열기</span>
                </a>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    const updatedCfgStore = {
                      ...store,
                      config: {
                        ...store.config,
                        sheetCsvOrShareUrl:
                          sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL,
                        gasWebAppUrl: gasUrlInput.trim(),
                      },
                    };
                    saveMarketingDbStore(updatedCfgStore);
                    setStore(updatedCfgStore);
                    setIsSyncing(true);
                    const res = await syncLeadsFromGoogleSheet(updatedCfgStore);
                    setStore(res.nextStore);
                    setIsSyncing(false);
                    showToast(res.message);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] disabled:opacity-60 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>2단계: 지금 자동연동 확인</span>
                </button>
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[11.5px] font-extrabold text-[#4E5968] dark:text-slate-300 block">
                  연결된 인스타 DB 구글시트 주소 (변경 시에만 수정 · 웹에 게시 CSV 링크도 호환)
                </label>
                <input
                  type="url"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder={DEFAULT_INSTA_SHEET_URL}
                  className={`w-full px-3 py-2 rounded-xl border font-mono text-base sm:text-xs ${inputSurface}`}
                />
              </div>
            </SurfaceCard>

            {/* 방법 B: 시트를 '나만 보기' 비공개로 유지 + 폰↔PC 상태 양방향 백업 */}
            <SurfaceCard tone="sub" padded={false} className="p-3.5 space-y-2.5">
              <div className="font-black text-[#1B64DA] dark:text-blue-400">
                ② [시트 &lsquo;제한됨&rsquo; 비공개 유지 + 폰↔PC 백업용] Apps Script 웹앱 연결 (선택)
              </div>
              <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 leading-relaxed">
                시트 공유를 &lsquo;제한됨(나만 보기)&rsquo;으로 완전히 잠가두면서 폰↔PC 간 진행상태·매출까지 양방향 백업하고 싶으실 때는 PC에서 시트 상단 <strong>[확장 프로그램 → Apps Script]</strong>에 아래 코드를 붙여넣고 <strong>[배포 → 새 배포 → 웹 앱(모든 사용자)]</strong> URL을 넣어주세요.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (await safeCopyText(getReadyMadeAppsScriptCode())) {
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#1B64DA] hover:bg-[#1554B8] text-white font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedScript ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>전용 Apps Script 코드 복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>전용 Apps Script 자동연동 코드 1클릭 복사</span>
                  </>
                )}
              </button>

              <div className="space-y-1 pt-1">
                <label className="font-extrabold text-[#191F28] dark:text-slate-100 block">
                  배포된 Apps Script 웹 앱 URL 붙여넣기
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className={`flex-1 px-3 py-2 rounded-xl border font-mono text-base sm:text-xs ${inputSurface}`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const nextCfgStore = {
                        ...store,
                        config: {
                          ...store.config,
                          gasWebAppUrl: gasUrlInput.trim(),
                          sheetCsvOrShareUrl:
                            sheetUrlInput.trim() || DEFAULT_INSTA_SHEET_URL,
                        },
                      };
                      saveMarketingDbStore(nextCfgStore);
                      setStore(nextCfgStore);
                      setIsSyncing(true);
                      const res = await syncLeadsFromGoogleSheet(nextCfgStore);
                      setStore(res.nextStore);
                      setIsSyncing(false);
                      showToast(
                        res.ok
                          ? `✅ 연동 성공! ${res.message}`
                          : '주소가 저장되었습니다. (배포 권한: 모든 사용자 설정을 확인해 주세요)'
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-black cursor-pointer shrink-0 transition-colors"
                  >
                    저장·테스트
                  </button>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard tone="sub" padded={false} className="p-3.5 space-y-2">
              <div className="font-black text-[#191F28] dark:text-slate-100">
                ③ 시트 행 복사·붙여넣기 또는 CSV 즉시 반영
              </div>
              <textarea
                rows={4}
                value={pasteRawText}
                onChange={(e) => setPasteRawText(e.target.value)}
                placeholder="구글시트에서 행(헤더 포함)을 드래그해 복사(Ctrl+C)한 뒤 여기에 붙여넣으면 신규 고객만 골라 자동 요약 등록됩니다."
                className={`w-full p-2.5 rounded-xl border text-base sm:text-xs ${inputSurface}`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteImport}
                  className="flex-1 py-2.5 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>붙여넣은 내용 즉시 반영</span>
                </button>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className={`px-3.5 py-2.5 rounded-xl border font-black flex items-center gap-1.5 cursor-pointer hover:bg-[#F2F4F6] dark:hover:bg-slate-800 transition-colors ${cardSurface}`}
                >
                  <Upload className="w-4 h-4" />
                  <span>엑셀·CSV</span>
                </button>
              </div>
            </SurfaceCard>
          </div>
        )}

        {settingsTab === 'security' && (
          <div className="space-y-3 text-xs">
            <SurfaceCard tone="sub" padded={false} className="p-3.5 space-y-2">
              <div className="font-black flex items-center gap-1.5 text-[#191F28] dark:text-slate-100">
                <Lock className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />
                <span>타 직원 완벽 차단 · 나만 보기 작동 방식</span>
              </div>
              <p className="text-[#4E5968] dark:text-slate-300 leading-relaxed">
                • 다른 직원이 이 앱을 다운받아 설치하거나 실행해도 <strong>DB관리 메뉴 버튼 자체가 화면·전체메뉴·검색 어디에도 전혀 나타나지 않습니다.</strong>
                <br />• 오직 관리자 기기에서 상단 <strong>[홈] 버튼을 연속 5번 터치</strong>(또는 검색창에 <code className="font-mono font-bold text-[#1B64DA] dark:text-blue-400">#{getOwnerDbPin()}</code> 입력)하여 비밀번호를 입력했을 때만 활성화됩니다.
              </p>

              <label className="flex items-center justify-between pt-2 border-t border-[#E5E8EB] dark:border-slate-700 cursor-pointer">
                <span className="font-extrabold text-[#191F28] dark:text-slate-100">
                  내가 직접 상담·계약한 건을 자동으로 내 고객관리(CRM) 카드에 생성
                </span>
                <input
                  type="checkbox"
                  checked={store.config.autoSaveCrmOnConvert}
                  onChange={(e) =>
                    commitStore((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        autoSaveCrmOnConvert: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#1B64DA]"
                />
              </label>
            </SurfaceCard>

            <SurfaceCard tone="sub" padded={false} className="p-3.5 space-y-2">
              <label className="font-black block text-[#191F28] dark:text-slate-100">
                전용 잠금 비밀번호 변경 (현재: <span className="font-mono tabular-nums">{getOwnerDbPin()}</span>)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="새 숫자 4~8자리 입력"
                  className={`flex-1 px-3 py-2 rounded-xl border font-mono text-base sm:text-xs ${inputSurface}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (setOwnerDbPin(newPinInput)) {
                      setNewPinInput('');
                      showToast('전용 비공개 비밀번호가 변경되었습니다.');
                    } else {
                      showToast('4자리 이상 입력해 주세요.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] font-black cursor-pointer transition-colors"
                >
                  변경
                </button>
              </div>
            </SurfaceCard>
          </div>
        )}
      </FlagshipModalShell>

      {/* ==================== 모달 3: 수동 DB 고객 빠른 추가 ==================== */}
      <FlagshipModalShell
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="인스타/마케팅 DB 고객 직접 추가"
        icon={<UserPlus className="w-4 h-4 text-[#E60012] dark:text-[#FF3B47]" />}
        maxWidthClass="max-w-md"
        bodyClassName="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1"
        footer={
          <button
            type="button"
            onClick={handleAddManualLead}
            className="w-full py-3 rounded-2xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs sm:text-sm font-black cursor-pointer transition-colors shadow-xs"
          >
            DB 목록에 추가하기
          </button>
        }
      >
        <div className="space-y-2.5 text-xs">
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">담당 구분</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setNewLeadIsHandover(false);
                  if (newLeadInitialStatus === '타직원인계') {
                    setNewLeadInitialStatus('신규');
                  }
                }}
                className={`py-2 rounded-xl border text-xs font-black cursor-pointer transition-colors ${
                  !newLeadIsHandover
                    ? 'bg-[#E60012] text-white border-[#E60012]'
                    : `${subSurface} text-[#4E5968] dark:text-slate-300`
                }`}
              >
                👑 내가 직접 상담·판매
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewLeadIsHandover(true);
                  if (newLeadInitialStatus !== '계약완료') {
                    setNewLeadInitialStatus('타직원인계');
                  }
                }}
                className={`py-2 rounded-xl border text-xs font-black cursor-pointer transition-colors ${
                  newLeadIsHandover
                    ? 'bg-[#191F28] text-white border-[#191F28] dark:bg-[#60A5FA] dark:text-[#0B1120] dark:border-[#60A5FA]'
                    : `${subSurface} text-[#4E5968] dark:text-slate-300`
                }`}
              >
                ↪ 타직원 인계·판매
              </button>
            </div>
          </div>
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">진행 상태 선택</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(newLeadIsHandover
                ? (['타직원인계', '계약완료'] as MarketingLeadStatus[])
                : (['신규', '상담진행중', '계약완료'] as MarketingLeadStatus[])
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setNewLeadInitialStatus(st)}
                  className={`py-1.5 rounded-xl border text-xs font-black cursor-pointer transition-colors ${
                    newLeadInitialStatus === st
                      ? getStatusActiveBtnStyle(st)
                      : `${subSurface} text-[#4E5968] dark:text-slate-300`
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          {newLeadInitialStatus === '계약완료' && (
            <div>
              <label className="font-extrabold block mb-1 text-[#059669] dark:text-emerald-400">
                계약완료 발생매출 (원, 선택)
              </label>
              <div className="relative">
                <FormattedMoneyInput
                  stepAmount={10000}
                  value={newLeadRevenue ? Number(newLeadRevenue.replace(/\D/g, '')) || 0 : ''}
                  onValueChange={(_num, rawDigits) => setNewLeadRevenue(rawDigits)}
                  placeholder="예: 8,500,000"
                  className={`w-full pl-3 pr-7 py-2 rounded-xl border sm:text-xs font-black text-right ${inputSurface}`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-[#8B95A1] dark:text-slate-400 pointer-events-none">
                  원
                </span>
              </div>
            </div>
          )}
          {newLeadIsHandover && (
            <div>
              <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">
                인계 담당 직원 선택
              </label>
              <select
                value={newLeadHandoverStaff}
                onChange={(e) => setNewLeadHandoverStaff(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
              >
                <option value={UNASSIGNED_HANDOVER_STAFF}>
                  ↪ {UNASSIGNED_HANDOVER_STAFF}
                </option>
                {staffOptions.map((st) => (
                  <option key={st.name} value={st.name}>
                    👤 {st.name} ({st.role} ·{' '}
                    {st.isOffToday ? `오늘휴무[${st.todayCode}]` : '오늘근무'})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">유입 플랫폼</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['인스타그램', '페이스북'] as const).map((plat) => (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setNewLeadPlatform(plat)}
                  className={`py-2 rounded-xl border text-xs font-black cursor-pointer transition-colors ${
                    newLeadPlatform === plat
                      ? 'bg-[#1B64DA] text-white border-[#1B64DA]'
                      : `${subSurface} text-[#4E5968] dark:text-slate-300`
                  }`}
                >
                  {plat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">고객명</label>
            <input
              type="text"
              value={newLeadName}
              onChange={(e) => setNewLeadName(e.target.value)}
              placeholder="예: 김민지"
              className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-bold ${inputSurface}`}
            />
          </div>
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">연락처</label>
            <input
              type="tel"
              inputMode="numeric"
              value={newLeadPhone}
              onChange={(e) => setNewLeadPhone(e.target.value)}
              placeholder="010-0000-0000"
              className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-mono font-bold ${inputSurface}`}
            />
          </div>
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">희망 혜택 / 품목</label>
            <input
              type="text"
              value={newLeadBenefit}
              onChange={(e) => setNewLeadBenefit(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
            />
          </div>
          <div>
            <label className="font-extrabold block mb-1 text-[#191F28] dark:text-slate-100">메모 (선택)</label>
            <input
              type="text"
              value={newLeadMemo}
              onChange={(e) => setNewLeadMemo(e.target.value)}
              placeholder="예: DM 문의 병행 고객"
              className={`w-full px-3 py-2 rounded-xl border text-base sm:text-xs font-semibold ${inputSurface}`}
            />
          </div>
        </div>
      </FlagshipModalShell>

      {/* ==================== 모달 4: DB관리 위에서 바로 열리는 고객 요약/상세 카드 (X 닫기 시 DB관리 화면 100% 그대로 유지!) ==================== */}
      <CustomerDetailModal
        customer={inlineSelectedCustomer}
        onClose={() => setInlineDetailCustomerId(null)}
        onStatusChange={handleInlineCrmStatusChange}
        onMemoChange={handleInlineCrmMemoChange}
        onFieldChange={handleInlineCrmFieldChange}
        onDeleteQuoteRecord={handleInlineDeleteQuoteRecord}
        onApplyQuoteAsPrimary={handleInlineApplyQuoteAsPrimary}
        onLoadQuoteRecord={(cust, quote) => {
          setInlineDetailCustomerId(null);
          if (onOpenQuoteRecordInQuoteBuilder) {
            onOpenQuoteRecordInQuoteBuilder(cust, quote);
          } else {
            onOpenCustomerInQuoteBuilder(cust);
          }
        }}
        onDelete={handleInlineDeleteCustomer}
        onOpenSMS={(cust) => setInlineSmsCustomer(cust)}
        onOpenQuote={(cust) => {
          setInlineDetailCustomerId(null);
          onOpenCustomerInQuoteBuilder(cust);
        }}
      />

      <SMSModal
        customer={inlineSmsCustomer}
        onClose={() => setInlineSmsCustomer(null)}
        onMarkSent={(customerId) => {
          const target = crmCustomers.find((c) => c.id === customerId);
          if (target && target.status === '신규/미발송') {
            handleInlineCrmStatusChange(customerId, '발송완료');
          }
        }}
      />
    </>
  );
};
