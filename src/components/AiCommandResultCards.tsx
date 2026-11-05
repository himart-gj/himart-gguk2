import React from 'react';
import { Calendar, Check, ClipboardList, Copy, CreditCard, ExternalLink, FileText, MessageSquare, Phone, ShieldCheck, Users, Wrench } from 'lucide-react';
import { formatCurrency } from '../crm/utils/date';
import { saveUserName } from './ScheduleModal';
import { tryExecuteScheduleCommand } from './aiCommandScheduleEngine';

export const AiCommandResultCards: React.FC<Record<string, any>> = ({
  activeModifyCard,
  activeQueryCard,
  asCenterResults,
  careResults,
  commandText,
  copiedCodeKey,
  crmSearchResult,
  handleCopyText,
  handleRunAiCommand,
  installmentResult,
  insuranceResult,
  onClose,
  onLoadCrmCustomerQuote,
  onOpenAsCenterModal,
  onOpenCareTable,
  onOpenCrmScreen,
  onOpenInstallmentModal,
  onOpenInsuranceView,
  onOpenScheduleModal,
  scheduleModifyResult,
  setMyStaffNameInput,
  setScheduleModifyResult,
  setScheduleQueryResult,
  showToast,
}) => {
  return (
    <>
          {/* =====================================================================
              [결과 섹션 1] 📅 휴무표 말로 즉시 수정 / 근무·휴무자 조회 카드
             ===================================================================== */}
          {activeModifyCard && (
            <div
              className={`rounded-2xl border-2 p-4 space-y-3 shadow-xs ${
                activeModifyCard.unmatchedStaffName
                  ? 'border-amber-400 bg-amber-50/95'
                  : 'border-emerald-400 bg-emerald-50/90'
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white text-[11px] font-black ${
                      activeModifyCard.unmatchedStaffName
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {activeModifyCard.unmatchedStaffName
                      ? '휴무표 대상 직원 선택 필요'
                      : '휴무표 말로 즉시 수정'}
                  </span>
                  <h3
                    className={`text-sm sm:text-base font-black ${
                      activeModifyCard.unmatchedStaffName
                        ? 'text-amber-950'
                        : 'text-emerald-950'
                    }`}
                  >
                    {activeModifyCard.message}
                  </h3>
                </div>

                {!scheduleModifyResult &&
                  !activeModifyCard.unmatchedStaffName && (
                    <button
                      type="button"
                      onClick={() => handleRunAiCommand()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-xs"
                    >
                      ✅ 지금 바로 휴무표에 반영하기
                    </button>
                  )}
              </div>

              {/* 미등록 이름이거나 내 이름 미설정 시 실제 직원 선택 버튼 목록 표시 */}
              {activeModifyCard.unmatchedStaffName &&
                activeModifyCard.availableStaffList &&
                activeModifyCard.availableStaffList.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white border border-amber-300 space-y-2.5">
                    <div className="text-xs font-black text-slate-800 flex items-center justify-between flex-wrap gap-1">
                      <span>
                        👇 변경할 직원을 터치하면 [{activeModifyCard.monthNum}월{' '}
                        {activeModifyCard.fromDayNum
                          ? `${activeModifyCard.fromDayNum}일 ➔ ${activeModifyCard.toDayNum}일`
                          : `${activeModifyCard.dayNum}일`}{' '}
                        · {activeModifyCard.statusLabel}] 일정이 즉시 반영됩니다:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeModifyCard.availableStaffList.map((staff) => (
                        <button
                          key={staff.name}
                          type="button"
                          onClick={() => {
                            if (activeModifyCard.needsUserNameSetup) {
                              saveUserName(staff.name);
                              setMyStaffNameInput(staff.name);
                            }
                            const execRes = tryExecuteScheduleCommand(
                              commandText,
                              false,
                              staff.name
                            );
                            setScheduleModifyResult(execRes.modifyResult);
                            setScheduleQueryResult(execRes.queryResult);
                            if (execRes.modifyResult) {
                              showToast(execRes.modifyResult.message);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-400 text-slate-900 border border-amber-300 text-xs font-black transition cursor-pointer shadow-2xs"
                        >
                          {staff.name}{' '}
                          <span className="text-[10px] font-bold text-slate-600">
                            ({staff.role})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !scheduleModifyResult &&
                      !activeModifyCard.unmatchedStaffName
                    ) {
                      tryExecuteScheduleCommand(commandText, false);
                    }
                    onClose();
                    onOpenScheduleModal?.();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Calendar className="w-4 h-4" />
                  <span>📅 휴무표 열어서 확인하기</span>
                </button>
              </div>
            </div>
          )}

          {activeQueryCard && (
            <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/80 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {activeQueryCard.dateLabel} 근무 · 휴무 브리핑
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScheduleModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>📅 휴무표 열기</span>
                </button>
              </div>

              {activeQueryCard.targetStaffName &&
                activeQueryCard.targetStaffOffDays && (
                  <div className="p-3 rounded-xl bg-white border border-sky-200 space-y-1.5">
                    <div className="text-xs font-black text-sky-950">
                      👤 [{activeQueryCard.targetStaffName}]님 {activeQueryCard.monthNum}월 전체 휴무/특근 일정
                    </div>
                    {activeQueryCard.targetStaffOffDays.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeQueryCard.targetStaffOffDays.map((d) => (
                          <span
                            key={d.day}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black"
                          >
                            {activeQueryCard.monthNum}/{d.day}일 ({d.label})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-500">
                        해당 월에 등록된 휴무 일정이 없습니다.
                      </p>
                    )}
                  </div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-1.5">
                  <div className="text-xs font-black text-rose-700">
                    🌴 쉬는 직원 (휴무/연차/휴가: {activeQueryCard.offStaff.length}명)
                  </div>
                  {activeQueryCard.offStaff.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeQueryCard.offStaff.map((st) => (
                        <span
                          key={st.name}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-black"
                        >
                          {st.name}{' '}
                          <span className="text-[10px] text-rose-600">
                            ({st.badge})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">
                      등록된 휴무자가 없습니다 (전원 근무 또는 휴무표 미업로드).
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1.5">
                  <div className="text-xs font-black text-emerald-800">
                    💼 근무 직원 ({activeQueryCard.workingStaff.length}명)
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {activeQueryCard.workingStaff.map((st) => (
                      <span
                        key={st.name}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold"
                      >
                        {st.name}
                        {st.note ? `(${st.note})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 2] 📋 안심케어 · 가전이사 조견표 검색 결과 카드
             ===================================================================== */}
          {careResults.length > 0 && (
            <div className="rounded-2xl border-2 border-teal-300 bg-teal-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-700 text-white text-xs font-black flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" />
                    안심케어 · 가전이사 조견표 검색 ({careResults.length}건)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCareTable?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>📋 안심케어 조견표 화면 열기</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-teal-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-teal-900 text-white font-black">
                      <th className="py-2 px-3">분류 / 상품명</th>
                      <th className="py-2 px-3">상품코드 (모델코드)</th>
                      <th className="py-2 px-3 text-right">단가 / 행사가</th>
                      <th className="py-2 px-3 text-center">코드 복사</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {careResults.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/50">
                        <td className="py-2 px-3">
                          <div className="font-black text-slate-900">
                            [{item.category}] {item.name}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            {item.section} {item.note ? `· ${item.note}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-teal-800">
                          {item.code}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                          {item.price}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                `care-${item.id}`,
                                item.code,
                                `📋 상품코드 [${item.code}] 복사 완료!`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-950 font-black text-[11px] cursor-pointer"
                          >
                            {copiedCodeKey === `care-${item.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>📋 상품코드 복사</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 3] 💳 카드 무이자 할부 조견표 검색 결과 카드
             ===================================================================== */}
          {installmentResult && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-black flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  💳 {installmentResult.querySummary}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInstallmentModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>💳 무이자 할부표 열기</span>
                </button>
              </div>

              {installmentResult.matchedSummaries.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {installmentResult.matchedSummaries.map((qs) => (
                    <div
                      key={qs.brandKey}
                      className="p-3 rounded-xl bg-white border border-amber-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {qs.brandTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-black">
                          핵심 요약
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-700 space-y-0.5">
                        <div>
                          • <strong className="text-blue-700">무이자:</strong>{' '}
                          {qs.freeInstallment}
                        </div>
                        {qs.partialInstallment &&
                          qs.partialInstallment !== '없음' && (
                            <div>
                              •{' '}
                              <strong className="text-amber-700">
                                부분무이자(다이나믹):
                              </strong>{' '}
                              {qs.partialInstallment}
                            </div>
                          )}
                        {qs.subInstallment && qs.subInstallment !== '없음' && (
                          <div>
                            •{' '}
                            <strong className="text-emerald-700">
                              구독전용 무이자:
                            </strong>{' '}
                            {qs.subInstallment}
                          </div>
                        )}
                        {Array.isArray(qs.specialNotes) &&
                          qs.specialNotes.length > 0 && (
                            <div className="text-[11px] text-slate-500 pt-0.5">
                              ※ {qs.specialNotes.join(' / ')}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {installmentResult.matchedColumns.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {installmentResult.matchedColumns.map(({ col, highlightRows }) => (
                    <div
                      key={col.id}
                      className="p-2.5 rounded-xl bg-white/90 border border-slate-200 space-y-1"
                    >
                      <div className="text-xs font-black text-indigo-950">
                        [{col.brand}] {col.subName}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {highlightRows.map((hr) => (
                          <span
                            key={hr.label}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${
                              hr.status === 'free'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : hr.status === 'partial'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : hr.status === 'sub-free'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {hr.label.replace('(비고)', '')}: {hr.text}
                            {hr.subText ? ` (${hr.subText})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 4] 🛠️ 가전 AS센터 · 플럭스(PLUX) · TCL 번호 검색 카드
             ===================================================================== */}
          {asCenterResults.length > 0 && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  🛠️ 가전 A/S 센터 · 플럭스(PLUX) · TCL 검색 ({asCenterResults.length}건)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAsCenterModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>🛠️ AS센터 창 열기</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {asCenterResults.map((asItem) => {
                  const primaryPhone = asItem.phones[0]?.number || '';
                  return (
                    <div
                      key={asItem.id}
                      className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black">
                          {asItem.categoryBadge}
                        </span>
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          {asItem.title}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {asItem.phones.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900 text-xs font-black"
                            >
                              {p.label ? `${p.label}: ` : ''}
                              <span className="text-emerald-700">{p.number}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 leading-snug">
                          {asItem.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <a
                          href={`tel:${primaryPhone}`}
                          className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>📞 바로 전화걸기</span>
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              `as-${asItem.id}`,
                              asItem.copyMessage,
                              `💬 [${asItem.title}] 고객 안내문이 복사되었습니다!`
                            )
                          }
                          className="py-1.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          {copiedCodeKey === `as-${asItem.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-800" />
                              <span>복사됨</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>💬 고객 안내문 복사</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 5] 👑 기존 통합 고객관리(CRM) 고객 검색 카드
             ===================================================================== */}
          {crmSearchResult && (
            <div className="rounded-2xl border-2 border-purple-300 bg-purple-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-purple-700 text-white text-xs font-black flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {crmSearchResult.querySummary}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCrmScreen?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>👑 통합 고객관리 열기</span>
                </button>
              </div>

              {crmSearchResult.customers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {crmSearchResult.customers.map((cust) => (
                    <div
                      key={cust.id}
                      className="p-3 rounded-xl bg-white border border-purple-200 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {cust.name} 고객님
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[11px] font-black">
                            {cust.status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                          📞 {cust.phone || '연락처 미등록'}{' '}
                          {cust.deliveryDate ? `· 🚚 배송: ${cust.deliveryDate}` : ''}
                        </div>
                        <div className="text-xs font-extrabold text-slate-800 truncate">
                          📦 {cust.items || '품목 미상'}
                        </div>
                        <div className="text-xs font-black text-blue-700">
                          실결제가: {formatCurrency(Number(cust.paidAmount) || 0)}원 / 체감가:{' '}
                          {formatCurrency(Number(cust.netAmount) || 0)}원
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadCrmCustomerQuote?.(cust);
                            onClose();
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>📊 이 고객 견적서 불러오기</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs font-bold text-slate-500">
                  일치하는 저장 고객이 없습니다. [👑 통합 고객관리 열기]에서 전체 명단을 확인해 주세요.
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              [결과 섹션 6] 🛡️ 보험 청구 안내 요약 카드
             ===================================================================== */}
          {insuranceResult && (
            <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/80 p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-blue-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  {insuranceResult.title}
                </span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${insuranceResult.phone}`}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>📞 {insuranceResult.phone}</span>
                  </a>
                  {onOpenInsuranceView && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenInsuranceView();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
                    >
                      🛡️ 보험 청구안내 화면 열기
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-blue-200 text-xs font-bold text-slate-700 space-y-1">
                {insuranceResult.summaryLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

    </>
  );
};
