import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Download,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CustomerItem } from '../types/crm';
import { triggerDailyMorningNotification } from '../services/notificationService';

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

  // 전체 기기 데이터 JSON 파일 다운로드 백업
  const handleExportBackup = () => {
    const allCustomers = [...customers, ...trashedCustomers];
    const backupPayload = {
      version: 'gookji-crm-backup-v3',
      exportedAt: new Date().toISOString(),
      customers: allCustomers,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `국지점_고객관리_전체백업_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice('✅ 현재 기기의 모든 고객 데이터가 파일로 저장되었습니다.');
  };

  // JSON 백업 파일 불러오기
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setBackupNotice(
          `✅ 백업 파일에서 고객 ${list.length}명 데이터를 성공적으로 복원했습니다!`
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
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black">
              데이터 백업 · 알림 · 휴지통 관리
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. 기기 내 자동저장 & 백업/복원 */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div>
              <h4 className="text-xs font-black text-blue-950">
                💾 기기 내 영구 저장 & 파일 백업 / 복원
              </h4>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                등록하신 모든 고객 및 다중 견적(최대 5개)은 현재 휴대폰/PC에 즉시 자동 저장됩니다. 기기 변경 시 아래 백업 파일로 언제든 옮길 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                전체 데이터 백업 저장
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                백업 파일 불러오기
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </div>

            {backupNotice && (
              <div className="text-xs font-bold text-blue-900 bg-white px-3 py-2 rounded-xl border border-blue-200">
                {backupNotice}
              </div>
            )}
          </div>

          {/* 2. 휴대폰 알림 테스트 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-slate-800">
                🔔 휴대폰 출근 브리핑 푸시 알림
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                당일/내일 배송, 오늘 재연락 예정 및 물류 미확정 건을 휴대폰 상단바 알림으로 띄웁니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestNotification}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              알림 테스트
            </button>
          </div>

          {/* 3. 휴지통 (최근 30일 이내 삭제된 고객 복원) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                  🗑️ 휴지통 (삭제 후 30일간 자동 보관 · {trashedCustomers.length}명)
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  실수로 삭제한 고객을 다시 복원하거나 영구 삭제할 수 있습니다. (30일 경과 시 자동 영구 삭제)
                </p>
              </div>
              {trashedCustomers.length > 0 && (
                <button
                  type="button"
                  onClick={onEmptyTrash}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                >
                  휴지통 비우기
                </button>
              )}
            </div>

            {trashedCustomers.length === 0 ? (
              <div className="text-center py-4 text-xs font-semibold text-slate-400 bg-white/80 rounded-xl border border-amber-100">
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
                      className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-amber-200/80 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-800 truncate">
                            {tc.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {tc.phone}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {daysLeft}일 후 소멸
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {tc.items || '품목 미입력'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRestoreCustomer(tc.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          복원
                        </button>
                        <button
                          type="button"
                          onClick={() => onPermanentDeleteCustomer(tc.id)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 text-[11px] font-bold cursor-pointer"
                        >
                          영구삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. 전체 초기화 */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-rose-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                기기 데이터 전체 초기화
              </h4>
              <p className="text-[11px] text-rose-700 mt-0.5">
                현재 기기에 저장된 고객 목록을 모두 비우고 처음 상태로 되돌립니다.
              </p>
            </div>
            {!confirmResetAll ? (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-100 text-rose-600 border border-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                전체 비우기
              </button>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleResetAllData}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  초기화 확인
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
