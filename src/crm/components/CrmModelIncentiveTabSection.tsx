import React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '../utils/date';
import { isGenericNonModelLabel } from '../utils/settlementEngine';
import { FormattedMoneyInput } from '../../components/FormattedMoneyInput';

function formatShortManwon(val: number): string {
  const n = Math.round(Number(val) || 0);
  if (n === 0) return "0원";
  if (Math.abs(n) >= 10000) {
    const man = n / 10000;
    return Number.isInteger(man) ? `${man.toLocaleString()}만` : `${man.toFixed(1)}만`;
  }
  return `${n.toLocaleString()}원`;
}

export const CrmModelIncentiveTabSection: React.FC<Record<string, any>> = ({
  activeTab,
  bulkPasteText,
  currentSheet,
  filteredRules,
  handleAddSingleRule,
  handleBulkTextApply,
  handleDeleteRule,
  handleManualPullOrPush,
  handleQuickAssignSave,
  handleRuleAmountBlur,
  handleUpdateRuleAmount,
  incentiveBasis,
  isDark,
  isSyncingCloud,
  manualCategory,
  manualIncentive,
  manualModelCode,
  mutedCls,
  onSelectCustomer,
  quickAssignAmount,
  quickAssignTarget,
  report,
  ruleSearch,
  setBulkPasteText,
  setIncentiveBasis,
  setManualCategory,
  setManualIncentive,
  setManualModelCode,
  setQuickAssignAmount,
  setQuickAssignTarget,
  setRuleSearch,
  setShowManualDrawer,
  setShowRulesDrawer,
  setUploadError,
  setUploadSuccess,
  shellCls,
  showManualDrawer,
  showRulesDrawer,
  subSurfaceCls,
  uploadError,
  uploadSuccess,
}) => {
  return (
    <>
          {/* 탭 3: 제품 모델별 수당 (직원 본인 폰 전용 개인 추가 + 공식 단가표 조회·수신 전용) */}
          {activeTab === 'models' && (
            <div className="space-y-2">
              {/* 심플 툴바: [+ 직접입력], [단가표(N)], [🔄 최신 단가표 동기화] + 우측 [계약월 | 배송월] */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowManualDrawer((v: boolean) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-black inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                    title="내 폰(로컬)에만 개인 모델 수당을 추가합니다"
                  >
                    <Plus className="w-3 h-3" />
                    <span>직접입력</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRulesDrawer((v: boolean) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                  >
                    <span>단가표({currentSheet?.rules.length || 0})</span>
                    {showRulesDrawer ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={handleManualPullOrPush}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer ${subSurfaceCls}`}
                    title="비공개 구글 시트에서 최신 공식 단가표 받아오기 (내 기기 추가 항목은 자동 보존)"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin text-[#1B64DA] dark:text-blue-400' : ''}`}
                    />
                    <span>최신 단가표 동기화</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">
                    매칭 {report.matchedModelUnitCount}대 · +{formatCurrency(report.modelIncentiveTotal)}원
                  </span>
                  <div
                    className={`inline-flex items-center p-0.5 rounded-lg border text-[11.5px] font-black ${subSurfaceCls}`}
                  >
                    <button
                      type="button"
                      onClick={() => setIncentiveBasis('contract')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        incentiveBasis === 'contract'
                          ? isDark
                            ? 'bg-[#60A5FA] text-[#0B1120]'
                            : 'bg-[#191F28] text-white'
                          : mutedCls
                      }`}
                    >
                      계약월
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncentiveBasis('delivery')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        incentiveBasis === 'delivery'
                          ? isDark
                            ? 'bg-[#60A5FA] text-[#0B1120]'
                            : 'bg-[#191F28] text-white'
                          : mutedCls
                      }`}
                    >
                      배송월
                    </button>
                  </div>
                </div>
              </div>

              {uploadSuccess && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-[#059669] dark:text-emerald-300 text-[11.5px] font-extrabold flex items-center justify-between gap-2">
                  <span>{uploadSuccess}</span>
                  <button
                    type="button"
                    onClick={() => setUploadSuccess(null)}
                    className="opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    닫기
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="px-3 py-2 rounded-xl bg-[#FFF1F2] dark:bg-rose-500/15 border border-[#FECDD3] dark:border-rose-500/35 text-[#E60012] dark:text-rose-300 text-[11.5px] font-bold flex items-center justify-between gap-2">
                  <span>⚠️ {uploadError}</span>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    닫기
                  </button>
                </div>
              )}

              {showManualDrawer && (
                <div className={`p-2.5 rounded-xl border space-y-2 ${subSurfaceCls}`}>
                  <div className={`text-[11px] font-bold ${mutedCls}`}>
                    💡 여기서 추가한 모델은 <strong>내 기기(로컬) 전용</strong>으로만 저장되며, 공식 단가표 새로고침 시에도 사라지지 않습니다.
                  </div>
                  <form
                    onSubmit={handleAddSingleRule}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-1.5"
                  >
                    <input
                      type="text"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder="품목(냉장고)"
                      className={`sm:col-span-3 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-bold ${shellCls}`}
                    />
                    <input
                      type="text"
                      value={manualModelCode}
                      onChange={(e) => setManualModelCode(e.target.value)}
                      placeholder="모델코드(RM70F64M2X)"
                      className={`sm:col-span-5 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <input
                      type="text"
                      value={manualIncentive}
                      onChange={(e) => setManualIncentive(e.target.value)}
                      placeholder="수당(5만)"
                      className={`sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] text-white text-xs font-black cursor-pointer"
                    >
                      + 추가
                    </button>
                  </form>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder="한 줄/여러 줄 붙여넣기 (예: RM70F64M2X 5만, OLED65C4 10만)"
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-base sm:text-xs font-mono ${shellCls}`}
                    />
                    <button
                      type="button"
                      onClick={handleBulkTextApply}
                      className="px-2.5 py-1.5 rounded-lg bg-[#191F28] dark:bg-[#60A5FA] text-white dark:text-[#0B1120] text-[11.5px] font-black shrink-0 cursor-pointer"
                    >
                      내 폰 반영
                    </button>
                  </div>
                </div>
              )}

              {showRulesDrawer && (
                <div className={`p-2.5 rounded-xl border space-y-2 ${subSurfaceCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-[#8B95A1] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ruleSearch}
                        onChange={(e) => setRuleSearch(e.target.value)}
                        placeholder="브랜드·모델코드·품목·모델명 검색 (예: 쿠첸, 테팔, 제스파, CP-AQS100)"
                        className={`w-full pl-7 pr-2.5 py-1 rounded-lg border text-base sm:text-xs ${shellCls}`}
                      />
                    </div>
                  </div>

                  {filteredRules.length === 0 ? (
                    <div className={`py-2 text-center text-[11.5px] font-bold ${mutedCls}`}>
                      등록된 모델 단가가 없습니다.
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 schedule-matrix-scroll">
                      {filteredRules.map((r: any) => (
                        <div
                          key={r.id}
                          className={`px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 text-xs ${shellCls}`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.2 rounded bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 text-[11.5px] font-black shrink-0">
                              {r.category}
                            </span>
                            <span className="font-mono font-black truncate">
                              {r.modelCode}
                            </span>
                            {r.isPersonalLocal && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-extrabold shrink-0">
                                내 기기 추가
                              </span>
                            )}
                            {r.productName && (
                              <span className={`text-[11.5px] truncate hidden sm:inline ${mutedCls}`}>
                                {r.productName}
                              </span>
                            )}
                            {r.incentiveAmount === 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11.5px] font-extrabold shrink-0">
                                0원·안내
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <FormattedMoneyInput
                              value={r.incentiveAmount}
                              placeholder="0"
                              onValueChange={(num) =>
                                handleUpdateRuleAmount(r.id, num)
                              }
                              onBlur={handleRuleAmountBlur}
                              className={`w-24 px-1.5 py-0.5 rounded border text-right font-bold sm:text-xs ${subSurfaceCls}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(r.id)}
                              className="p-1 text-[#E60012] dark:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                              title="내 기기 목록에서 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {quickAssignTarget && (
                <div
                  className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs ${
                    isDark
                      ? 'bg-blue-500/15 border-blue-400/35 text-slate-100'
                      : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#191F28]'
                  }`}
                >
                  <span className="font-black">
                    ⚡ [{quickAssignTarget.category}]{' '}
                    <span className="font-mono text-[#1B64DA] dark:text-blue-300">
                      {quickAssignTarget.modelCode}
                    </span>{' '}
                    수당 지정
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={quickAssignAmount}
                      onChange={(e) => setQuickAssignAmount(e.target.value)}
                      placeholder="예: 5만"
                      className={`w-28 px-2 py-1 rounded-lg border text-base sm:text-xs font-mono font-bold ${shellCls}`}
                    />
                    <button
                      type="button"
                      onClick={handleQuickAssignSave}
                      className="px-2.5 py-1 rounded-lg bg-[#1B64DA] hover:bg-[#1552B5] text-white text-[11.5px] font-black inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> 반영
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAssignTarget(null)}
                      className="px-2 py-1 text-[11.5px] font-bold opacity-70 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {report.confirmedRowsForIncentive.length === 0 ? (
                <div
                  className={`rounded-xl border py-3 px-3 text-center text-[11.5px] font-bold ${subSurfaceCls} ${mutedCls}`}
                >
                  구매 확정([계약완료]·[발송완료]) 고객이 등록되면 구매 모델에서 자동 계산됩니다. (미구매 제외)
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 schedule-matrix-scroll">
                  {report.confirmedRowsForIncentive.map((row) => (
                    <div
                      key={row.customer.id}
                      onClick={() => onSelectCustomer(row.customer)}
                      className={`px-3 py-2 rounded-xl border space-y-1.5 cursor-pointer ${
                        row.customerModelIncentive > 0
                          ? isDark
                            ? 'bg-[#131C2E] border-blue-400/40'
                            : 'bg-white border-[#BFDBFE]'
                          : subSurfaceCls
                      }`}
                    >
                      <div className="ledger-row text-xs">
                        <span className="font-black truncate">
                          {row.customer.name} 고객님
                        </span>
                        <span
                          className={`font-black font-mono tabular-nums shrink-0 ${
                            row.customerModelIncentive > 0
                              ? 'text-[#1B64DA] dark:text-blue-400'
                              : mutedCls
                          }`}
                        >
                          +{formatCurrency(row.customerModelIncentive)}원
                        </span>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.modelMatches.length === 0 ? (
                          <span className={`text-[11.5px] ${mutedCls}`}>
                            세부 모델 미입력
                          </span>
                        ) : (
                          row.modelMatches.map((mm, mIdx) => {
                            const matched = Boolean(mm.matchedRule);
                            return matched ? (
                              <span
                                key={`${mm.modelEntry.id}-${mIdx}`}
                                className="px-2 py-0.5 rounded-lg text-[11.5px] font-mono tabular-nums font-bold bg-emerald-500/15 text-[#059669] dark:text-emerald-300"
                              >
                                {mm.modelEntry.modelName}
                                {mm.modelEntry.quantity > 1 ? `×${mm.modelEntry.quantity}` : ''}{' '}
                                +{formatShortManwon(mm.subtotalIncentive)}
                              </span>
                            ) : isGenericNonModelLabel(mm.modelEntry.modelName) ? (
                              <span
                                key={`${mm.modelEntry.id}-${mIdx}`}
                                className={`px-2 py-0.5 rounded-lg text-[11.5px] font-bold border ${subSurfaceCls} ${mutedCls}`}
                                title="세부 모델코드가 입력되면 수당 단가표와 자동 대조됩니다"
                              >
                                {mm.modelEntry.modelName} (모델미기재)
                              </span>
                            ) : (
                              <button
                                key={`${mm.modelEntry.id}-${mIdx}`}
                                type="button"
                                onClick={() => {
                                  setQuickAssignTarget({
                                    modelCode: mm.modelEntry.modelName,
                                    category: mm.modelEntry.category,
                                  });
                                  setQuickAssignAmount('');
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[11.5px] font-mono font-bold border cursor-pointer ${subSurfaceCls}`}
                                title="공식 단가표 미등록 모델 (클릭 시 내 기기에만 수당 단가 추가)"
                              >
                                {mm.modelEntry.modelName} +단가지정
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

    </>
  );
};
