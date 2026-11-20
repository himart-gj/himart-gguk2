import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Download,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { triggerDailyMorningNotification } from '../services/notificationService';
import {
  getCurrentYearMonth,
  loadAllModelIncentiveSheets,
  loadAllMonthlyAllCareCounts,
  MONTHLY_ALLCARE_STORAGE_KEY,
  parseModelIncentiveExcelWithMeta,
  saveAllModelIncentiveSheets,
  saveAllMonthlyAllCareCounts,
  upsertMonthlyIncentiveSheet,
} from '../utils/settlementEngine';
import { FlagshipModalShell } from '../../components/ui/FlagshipModalShell';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  trashedCustomers: CustomerItem[];
  onImportCustomers: (imported: CustomerItem[]) => void;
  onRestoreCustomer: (id: string) => void;
  onPermanentDeleteCustomer: (id: string) => void;
  onEmptyTrash: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  customers,
  trashedCustomers,
  onImportCustomers,
  onRestoreCustomer,
  onPermanentDeleteCustomer,
  onEmptyTrash,
}) => {
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 전체 기기 데이터 JSON 파일 다운로드 백업 (고객 데이터 + 월별 제품 모델 수당 단가표 통합)
  const handleExportBackup = () => {
    const allCustomers = [...customers, ...trashedCustomers];
    const modelIncentiveSheets = loadAllModelIncentiveSheets();
    const monthlyAllCareCounts = loadAllMonthlyAllCareCounts();
    const backupPayload = {
      version: 'gookji-crm-backup-v5',
      exportedAt: new Date().toISOString(),
      customers: allCustomers,
      modelIncentiveSheets,
      monthlyAllCareCounts,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `국지점_고객관리_및_수당단가표_전체백업_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice(
      '✅ 현재 기기의 모든 고객 데이터 및 월별 모델 수당 단가표가 파일로 저장되었습니다.'
    );
  };

  // JSON 백업 파일 또는 모델 수당 단가표 엑셀(.xlsx/.csv) 불러오기
  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (/\.(xlsx|xls|csv|tsv|gsheet)$/i.test(file.name)) {
      try {
        const meta = await parseModelIncentiveExcelWithMeta(file);
        const ym = meta.detectedYearMonth || getCurrentYearMonth();
        const sheet = upsertMonthlyIncentiveSheet(ym, meta.rules, file.name, meta.rules.length >= 200);
        setBackupNotice(
          `✅ [${ym}] 모델 수당 단가표 엑셀에서 ${meta.rules.length}개 모델을 반영했습니다! (현재 총 ${sheet.rules.length}개 등록)`
        );
      } catch (err: any) {
        setBackupNotice(`⚠️ 엑셀 수당 단가표 분석 실패: ${err?.message || '파일을 확인해 주세요.'}`);
      } finally {
        e.target.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const list: CustomerItem[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.customers)
          ? parsed.customers
          : [];

        if (list.length > 0) {
          onImportCustomers(list);
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.modelIncentiveSheets &&
          typeof parsed.modelIncentiveSheets === 'object'
        ) {
          const mergedSheets = {
            ...loadAllModelIncentiveSheets(),
            ...parsed.modelIncentiveSheets,
          };
          saveAllModelIncentiveSheets(mergedSheets);
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.monthlyAllCareCounts &&
          typeof parsed.monthlyAllCareCounts === 'object'
        ) {
          saveAllMonthlyAllCareCounts({
            ...loadAllMonthlyAllCareCounts(),
            ...parsed.monthlyAllCareCounts,
          });
        }
        setBackupNotice(
          `✅ 백업 파일에서 고객 ${list.length}명 데이터 및 수당 설정을 성공적으로 복원했습니다!`
        );
      } catch {
        setBackupNotice('⚠️ 올바른 백업 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestNotification = async () => {
    const ok = await triggerDailyMorningNotification(customers, true);
    setBackupNotice(
      ok
        ? '📲 휴대폰/브라우저 상단바로 브리핑 알림을 발송했습니다!'
        : '⚠️ 브라우저 알림 권한을 먼저 허용해 주세요.'
    );
  };

  const handleResetAllData = () => {
    localStorage.removeItem('gookji_crm_customers_cache_v3');
    localStorage.removeItem('himart_crm_model_incentives_v1');
    localStorage.removeItem(MONTHLY_ALLCARE_STORAGE_KEY);
    window.location.reload();
  };

  return (
    <FlagshipModalShell
      isOpen={true}
      onClose={onClose}
      title="데이터 백업 · 알림 · 휴지통 관리"
      icon={<Settings className="w-4 h-4 text-[#1B64DA] dark:text-blue-400" />}
      maxWidthClass="max-w-xl"
      bodyClassName="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1"
    >
      {/* 1. 기기 내 자동저장 & 백업/복원 */}
      <SurfaceCard tone="benefit" className="space-y-3">
        <div>
          <h4 className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
            💾 기기 내 영구 저장 & 파일 백업 / 복원
          </h4>
          <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 mt-0.5 leading-relaxed">
            등록하신 모든 고객·다중 견적(최대 5개) 및 월별 제품 모델 수당 단가표는 현재 기기에 자동 저장됩니다. 기기 변경 시 백업 파일로 언제든 옮길 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-[#1B64DA] hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            전체 데이터 백업 저장
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#1B64DA] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-500/30 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            백업 파일 불러오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xlsx,.xls,.csv,.tsv,.gsheet"
            onChange={handleImportBackupFile}
            className="hidden"
          />
        </div>

        {backupNotice && (
          <div className="text-xs font-bold text-[#1B64DA] dark:text-blue-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-[#BFDBFE] dark:border-blue-500/30">
            {backupNotice}
          </div>
        )}
      </SurfaceCard>

      {/* 2. 휴대폰 알림 테스트 */}
      <SurfaceCard tone="sub" className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-extrabold text-[#191F28] dark:text-slate-100">
            🔔 휴대폰 출근 브리핑 푸시 알림
          </h4>
          <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 mt-0.5">
            당일/내일 배송, 오늘 재연락 예정 및 물류 미확정 건을 휴대폰 상단바 알림으로 띄웁니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTestNotification}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold bg-[#191F28] hover:bg-slate-800 dark:bg-[#60A5FA] dark:hover:bg-blue-300 text-white dark:text-[#0B1120] flex items-center gap-1 cursor-pointer"
        >
          <Bell className="w-3.5 h-3.5" />
          알림 테스트
        </button>
      </SurfaceCard>

      {/* 3. 휴지통 (최근 30일 이내 삭제된 고객 복원) */}
      <SurfaceCard tone="sub" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-[#191F28] dark:text-slate-100 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-[#4E5968] dark:text-slate-400" />
              🗑️ 휴지통 (삭제 후 30일간 자동 보관 · <span className="font-mono tabular-nums">{trashedCustomers.length}</span>명)
            </h4>
            <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 mt-0.5">
              실수로 삭제한 고객을 다시 복원하거나 영구 삭제할 수 있습니다. (30일 경과 시 자동 영구 삭제)
            </p>
          </div>
          {trashedCustomers.length > 0 && (
            <button
              type="button"
              onClick={onEmptyTrash}
              className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11.5px] font-extrabold bg-[#E60012] hover:bg-[#C8000F] text-white transition cursor-pointer"
            >
              휴지통 비우기
            </button>
          )}
        </div>

        {trashedCustomers.length === 0 ? (
          <div className="text-center py-4 text-xs font-semibold text-[#8B95A1] dark:text-slate-400 bg-white dark:bg-[#131C2E] rounded-xl border border-[#E5E8EB] dark:border-slate-800">
            휴지통이 비어 있습니다.
          </div>
        ) : (
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {trashedCustomers.map((tc) => {
              const daysLeft = tc.deletedAt
                ? Math.max(
                    1,
                    30 -
                      Math.floor(
                        (Date.now() - tc.deletedAt) / (1000 * 60 * 60 * 24)
                      )
                  )
                : 30;
              return (
                <div
                  key={tc.id}
                  className="flex items-center justify-between gap-2 bg-white dark:bg-[#131C2E] px-3 py-2 rounded-xl border border-[#E5E8EB] dark:border-slate-800 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-[#191F28] dark:text-slate-100 truncate">
                        {tc.name}
                      </span>
                      <span className="text-[11.5px] font-mono tabular-nums text-[#8B95A1] dark:text-slate-400">
                        {tc.phone}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11.5px] font-bold font-mono tabular-nums">
                        {daysLeft}일 후 소멸
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#4E5968] dark:text-slate-400 truncate mt-0.5">
                      {tc.items || '품목 미입력'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestoreCustomer(tc.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-[11.5px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      복원
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDeleteCustomer(tc.id)}
                      className="px-2 py-1 rounded-lg bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 text-[#4E5968] dark:text-slate-300 hover:text-[#E60012] dark:hover:text-rose-300 text-[11.5px] font-bold cursor-pointer"
                    >
                      영구삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* 4. 전체 초기화 */}
      <SurfaceCard tone="brand" className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-extrabold text-[#E60012] dark:text-[#FF3B47] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            기기 데이터 전체 초기화
          </h4>
          <p className="text-[11.5px] text-[#4E5968] dark:text-slate-300 mt-0.5">
            현재 기기에 저장된 고객 목록 및 수당 단가표를 모두 비우고 처음 상태로 되돌립니다.
          </p>
        </div>
        {!confirmResetAll ? (
          <button
            type="button"
            onClick={() => setConfirmResetAll(true)}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-900 hover:bg-[#FFF1F2] dark:hover:bg-rose-500/20 text-[#E60012] dark:text-[#FF3B47] border border-[#FECDD3] dark:border-rose-500/30 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 비우기
          </button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleResetAllData}
              className="px-2.5 py-1.5 rounded-xl bg-[#E60012] hover:bg-[#C8000F] text-white text-xs font-extrabold cursor-pointer"
            >
              초기화 확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetAll(false)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-[#F2F4F6] dark:hover:bg-slate-700 text-[#4E5968] dark:text-slate-300 border border-[#D1D6DB] dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              취소
            </button>
          </div>
        )}
      </SurfaceCard>
    </FlagshipModalShell>
  );
};
