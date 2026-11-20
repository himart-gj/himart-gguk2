import React, { useMemo, useState } from 'react';
import { CustomerItem, CustomerStatus, FilterTab } from '../types/crm';
import { formatCurrency, formatShortManwon, getDeliveryDDay } from '../utils/date';
import { resolveCustomerPerformanceProfile } from '../utils/settlementEngine';
import {
  ArrowRight,
  Calculator,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gift,
  MailOpen,
  MessageSquare,
  Phone,
  TrendingUp,
  Truck,
} from 'lucide-react';

// ============================================================================
// 1. 컴팩트 1줄 가망 파이프라인 & 단계별 빠른 필터 바
// ============================================================================
export interface CrmAnalyticsStripProps {
  customers: CustomerItem[];
  isDark: boolean;
  onSelectFilter: (tab: FilterTab) => void;
}

export const CrmAnalyticsStrip: React.FC<CrmAnalyticsStripProps> = ({
  customers,
  isDark,
  onSelectFilter,
}) => {
  const metrics = useMemo(() => {
    const closed = customers.filter(
      (c) => c.status === '계약완료' || c.status === '발송완료' || c.status === '배송완료'
    );
    const activeLeads = customers.filter(
      (c) =>
        c.status === '신규/미발송' ||
        c.status === '상담진행중' ||
        c.status === '미구매/고민중'
    );
    const pipelinePerfSum = activeLeads.reduce(
      (s, c) => s + resolveCustomerPerformanceProfile(c).performanceAmount,
      0
    );
    const totalValid = customers.filter((c) => c.status !== '취소/보류').length;
    const convRate =
      totalValid > 0 ? Math.round((closed.length / totalValid) * 100) : 0;

    return {
      activeLeadCount: activeLeads.length,
      pipelinePerfSum,
      convRate,
      byStatus: {
        newLead: customers.filter((c) => c.status === '신규/미발송').length,
        consulting: customers.filter((c) => c.status === '상담진행중').length,
        hesitating: customers.filter((c) => c.status === '미구매/고민중').length,
        contracted: closed.length,
      },
    };
  }, [customers]);

  const cardCls = isDark
    ? 'bg-[#131C2E] border-slate-800 text-slate-100'
    : 'bg-white border-[#E5E8EB] text-[#191F28]';
  const mutedCls = isDark ? 'text-slate-400' : 'text-[#4E5968]';

  return (
    <div
      className={`rounded-[20px] border px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs ${cardCls}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 font-extrabold ${mutedCls}`}>
          <TrendingUp className="w-3.5 h-3.5 text-[#1B64DA] dark:text-blue-400" />
          <span>상담·고민 가망 ({metrics.activeLeadCount}명)</span>
        </span>
        <span className="font-black font-mono tabular-nums text-[#191F28] dark:text-slate-50">
          {formatShortManwon(metrics.pipelinePerfSum)}
        </span>
        <span className={`text-[11.5px] font-bold ${mutedCls}`}>
          · 성약률 <strong className="font-mono tabular-nums text-[#1B64DA] dark:text-blue-400">{metrics.convRate}%</strong>
        </span>
      </div>

      <div className="flex items-center gap-2.5 text-[11.5px] font-black font-mono tabular-nums flex-wrap">
        <button
          type="button"
          onClick={() => onSelectFilter('신규/미발송')}
          className="text-[#E60012] dark:text-rose-400 hover:underline cursor-pointer"
        >
          ● 신규 {metrics.byStatus.newLead}
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter('상담진행중')}
          className="text-[#1B64DA] dark:text-blue-400 hover:underline cursor-pointer"
        >
          ● 상담 {metrics.byStatus.consulting}
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter('미구매/고민중')}
          className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
        >
          ● 고민 {metrics.byStatus.hesitating}
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter('계약완료')}
          className="text-[#059669] dark:text-emerald-400 hover:underline cursor-pointer"
        >
          ● 확정 {metrics.byStatus.contracted}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Twenty / Atomic CRM 스타일 5단계 드래그 앤 드롭 칸반 파이프라인 보드
// ============================================================================
const KANBAN_COLUMNS: {
  status: CustomerStatus;
  title: string;
  accentDot: string;
  nextStatus?: CustomerStatus;
}[] = [
  {
    status: '신규/미발송',
    title: '신규 · 문자미발송',
    accentDot: 'bg-[#E60012]',
    nextStatus: '상담진행중',
  },
  {
    status: '상담진행중',
    title: '상담 진행중',
    accentDot: 'bg-[#1B64DA]',
    nextStatus: '미구매/고민중',
  },
  {
    status: '미구매/고민중',
    title: '미구매 · 고민중',
    accentDot: 'bg-amber-500',
    nextStatus: '계약완료',
  },
  {
    status: '계약완료',
    title: '계약 완료 (배송대기)',
    accentDot: 'bg-[#059669]',
    nextStatus: '배송완료',
  },
  {
    status: '배송완료',
    title: '배송 완료 (사은품 미지급건)',
    accentDot: 'bg-emerald-700',
  },
];

export interface CrmKanbanBoardProps {
  customers: CustomerItem[];
  isDark: boolean;
  onSelectCustomer: (customer: CustomerItem) => void;
  onStatusChange: (id: string, nextStatus: CustomerStatus) => void;
  onOpenSMS: (customer: CustomerItem) => void;
  onOpenQuote: (customer: CustomerItem) => void;
}

export const CrmKanbanBoard: React.FC<CrmKanbanBoardProps> = ({
  customers,
  isDark,
  onSelectCustomer,
  onStatusChange,
  onOpenSMS,
  onOpenQuote,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CustomerStatus | null>(
    null
  );

  const colBg = isDark
    ? 'bg-[#0B1120] border-slate-800 text-slate-100'
    : 'bg-[#F2F4F6] border-[#E5E8EB] text-[#191F28]';
  const cardCls = isDark
    ? 'bg-[#131C2E] border-slate-800 hover:border-blue-400/60 text-slate-100'
    : 'bg-white border-[#E5E8EB] hover:border-[#1B64DA] text-[#191F28]';

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 schedule-matrix-scroll">
      {KANBAN_COLUMNS.map((col) => {
        const colItems = customers.filter((c) => c.status === col.status);
        const colAmount = colItems.reduce(
          (s, c) => s + resolveCustomerPerformanceProfile(c).performanceAmount,
          0
        );
        const isOver = dragOverStatus === col.status;

        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(col.status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => {
              e.preventDefault();
              const droppedId =
                e.dataTransfer.getData('text/plain') || draggingId;
              setDragOverStatus(null);
              setDraggingId(null);
              if (droppedId) {
                onStatusChange(droppedId, col.status);
              }
            }}
            className={`min-w-[252px] w-[78vw] max-w-[290px] sm:min-w-[290px] sm:w-[290px] snap-start shrink-0 rounded-[20px] border p-3 flex flex-col gap-2.5 transition-colors ${colBg} ${
              isOver ? 'ring-2 ring-[#1B64DA] dark:ring-blue-400' : ''
            }`}
          >
            {/* 컬럼 헤더 */}
            <div className="px-1 pt-0.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${col.accentDot}`}
                  />
                  <span>{col.title}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11.5px] font-black font-mono tabular-nums border ${
                    isDark
                      ? 'bg-[#131C2E] border-slate-700 text-slate-200'
                      : 'bg-white border-[#D1D6DB] text-[#191F28]'
                  }`}
                >
                  {colItems.length}
                </span>
              </div>
              <div
                className={`text-[11.5px] font-mono tabular-nums font-bold ${
                  isDark ? 'text-slate-400' : 'text-[#4E5968]'
                }`}
              >
                실적합계 {formatCurrency(colAmount)}원
              </div>
            </div>

            {/* 카드 리스트 */}
            <div className="space-y-2 min-h-[180px] max-h-[58dvh] overflow-y-auto pr-0.5">
              {colItems.length === 0 ? (
                <div
                  className={`py-10 text-center text-[11.5px] font-bold border-2 border-dashed rounded-2xl ${
                    isDark
                      ? 'border-slate-800 text-slate-500'
                      : 'border-[#D1D6DB] text-[#8B95A1]'
                  }`}
                >
                  여기로 카드를 끌어놓으세요
                </div>
              ) : (
                colItems.map((c) => {
                  const dday = getDeliveryDDay(c.deliveryDate, c.status);
                  const perf = resolveCustomerPerformanceProfile(c);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(c.id);
                        e.dataTransfer.setData('text/plain', c.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                      onClick={() => onSelectCustomer(c)}
                      className={`rounded-2xl border p-3 shadow-2xs space-y-2 cursor-grab active:cursor-grabbing schedule-tactile ${cardCls} ${
                        draggingId === c.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="text-sm font-black truncate">
                            {c.name}
                          </div>
                          <div
                            className={`text-[11.5px] font-mono tabular-nums ${
                              isDark ? 'text-slate-400' : 'text-[#8B95A1]'
                            }`}
                          >
                            {c.phone || '연락처 미입력'}
                          </div>
                        </div>
                        {c.deliveryDate && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11.5px] font-black border shrink-0 ${dday.badgeClass}`}
                          >
                            {dday.label}
                          </span>
                        )}
                      </div>

                      <div
                        className={`rounded-xl px-2.5 py-2 text-xs border ${
                          isDark
                            ? 'bg-slate-900/70 border-slate-800'
                            : 'bg-[#F8FAFC] border-[#E5E8EB]'
                        }`}
                      >
                        <div className="font-bold truncate">
                          {c.items || '상담 품목 미입력'}
                        </div>
                        <div className="ledger-row mt-1 text-[11.5px] font-mono tabular-nums">
                          <span className={isDark ? 'text-slate-400' : 'text-[#4E5968]'}>
                            {perf.saleType === 'subscription' ? '원금 ' : '합계 '}
                            {formatCurrency(perf.performanceAmount)}원
                          </span>
                          <span className="font-black text-[#E60012] dark:text-rose-400">
                            체감 {formatCurrency(c.netAmount)}원
                          </span>
                        </div>
                      </div>

                      {/* 하단 퀵 액션 + 모바일 다음 단계 원터치 이동 */}
                      <div
                        className="flex items-center justify-between pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          {c.phone && (
                            <>
                              <a
                                href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                                className="p-1.5 rounded-lg bg-emerald-500/15 text-[#059669] dark:text-emerald-400"
                                title="전화"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                              <a
                                href={`sms:${c.phone.replace(/[^0-9+]/g, '')}`}
                                className={`p-1.5 rounded-lg ${
                                  isDark
                                    ? 'bg-slate-800 text-slate-300'
                                    : 'bg-[#F2F4F6] text-[#4E5968]'
                                }`}
                                title="문자 대화내역 열기 (문구 자동입력 없음)"
                              >
                                <MailOpen className="w-3 h-3" />
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenSMS(c)}
                            className="p-1.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300 cursor-pointer"
                            title="문자"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenQuote(c)}
                            className="p-1.5 rounded-lg bg-[#FFF1F2] dark:bg-rose-500/15 text-[#E60012] dark:text-rose-300 cursor-pointer"
                            title="견적서"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        </div>

                        {col.nextStatus && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(c.id, col.nextStatus!)}
                            className={`px-2 py-1 rounded-lg text-[11.5px] font-black inline-flex items-center gap-1 border cursor-pointer ${
                              isDark
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                                : 'bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#D1D6DB] hover:border-[#BFDBFE] text-[#191F28] hover:text-[#1B64DA]'
                            }`}
                          >
                            <span>다음 단계</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 3. 배송 예정일(🚚) & 재연락 팔로업(🔔) 월간 캘린더 뷰
// ============================================================================
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface CrmDeliveryCalendarProps {
  customers: CustomerItem[];
  isDark: boolean;
  onSelectCustomer: (customer: CustomerItem) => void;
}

export const CrmDeliveryCalendar: React.FC<CrmDeliveryCalendarProps> = ({
  customers,
  isDark,
  onSelectCustomer,
}) => {
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const ymPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const eventsByDay = useMemo(() => {
    const map: Record<
      number,
      { type: 'delivery' | 'followup'; customer: CustomerItem }[]
    > = {};
    customers.forEach((c) => {
      if (c.status === '취소/보류') return;
      if (c.deliveryDate && c.deliveryDate.startsWith(ymPrefix)) {
        const d = parseInt(c.deliveryDate.slice(8, 10), 10);
        if (d >= 1 && d <= 31) {
          if (!map[d]) map[d] = [];
          map[d].push({ type: 'delivery', customer: c });
        }
      }
      if (c.followUpDate && c.followUpDate.startsWith(ymPrefix)) {
        const d = parseInt(c.followUpDate.slice(8, 10), 10);
        if (d >= 1 && d <= 31) {
          if (!map[d]) map[d] = [];
          map[d].push({ type: 'followup', customer: c });
        }
      }
    });
    return map;
  }, [customers, ymPrefix]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cardCls = isDark
    ? 'bg-[#131C2E] border-slate-800 text-slate-100'
    : 'bg-white border-[#E5E8EB] text-[#191F28]';

  const today = new Date();

  return (
    <div className={`rounded-[20px] border overflow-hidden shadow-xs ${cardCls}`}>
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark
            ? 'bg-slate-900/70 border-slate-800'
            : 'bg-[#F8FAFC] border-[#E5E8EB]'
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-black">
          <Calendar className="w-4 h-4 text-[#E60012] dark:text-rose-400" />
          <span>배송(🚚) · 재연락(🔔) 월간 일정표</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursorDate(new Date(year, month - 2, 1))}
            className={`p-1.5 rounded-xl border cursor-pointer ${
              isDark
                ? 'bg-[#131C2E] border-slate-700 hover:bg-slate-800'
                : 'bg-white border-[#D1D6DB] hover:bg-[#F2F4F6]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm font-black font-mono tabular-nums">
            {year}.{String(month).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setCursorDate(new Date(year, month, 1))}
            className={`p-1.5 rounded-xl border cursor-pointer ${
              isDark
                ? 'bg-[#131C2E] border-slate-700 hover:bg-slate-800'
                : 'bg-white border-[#D1D6DB] hover:bg-[#F2F4F6]'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] font-black">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#059669] dark:text-emerald-300">
            <Truck className="w-3 h-3" /> 배송예정
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-500/15 text-[#1B64DA] dark:text-blue-300">
            <Gift className="w-3 h-3" /> 재연락·팔로업
          </span>
        </div>
      </div>

      <div
        className={`grid grid-cols-7 text-center py-2 text-xs font-black border-b ${
          isDark ? 'border-slate-800' : 'border-[#E5E8EB]'
        }`}
      >
        {WEEKDAY_KO.map((w, i) => (
          <div
            key={w}
            className={
              i === 0
                ? 'text-[#E60012] dark:text-rose-400'
                : i === 6
                ? 'text-[#1B64DA] dark:text-blue-400'
                : ''
            }
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className={`min-h-[82px] sm:min-h-[104px] border-b border-r ${
                  isDark
                    ? 'border-slate-800/60 bg-[#0B1120]/40'
                    : 'border-[#E5E8EB] bg-[#F8FAFC]/60'
                }`}
              />
            );
          }

          const dayEvents = eventsByDay[day] || [];
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day;

          return (
            <div
              key={day}
              className={`min-h-[82px] sm:min-h-[104px] p-1.5 sm:p-2 border-b border-r flex flex-col gap-1 ${
                isDark ? 'border-slate-800' : 'border-[#E5E8EB]'
              } ${isToday ? 'ring-2 ring-inset ring-[#E60012]' : ''}`}
            >
              <span
                className={`text-xs font-black font-mono tabular-nums ${
                  isToday ? 'text-[#E60012] dark:text-rose-400' : ''
                }`}
              >
                {day}
              </span>
              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayEvents.map((ev, eIdx) => (
                  <button
                    key={`${ev.customer.id}-${ev.type}-${eIdx}`}
                    type="button"
                    onClick={() => onSelectCustomer(ev.customer)}
                    className={`w-full text-left px-1.5 py-0.5 rounded-md text-[11.5px] font-black truncate cursor-pointer ${
                      ev.type === 'delivery'
                        ? 'bg-[#059669] text-white'
                        : 'bg-[#1B64DA] text-white'
                    }`}
                  >
                    {ev.type === 'delivery' ? '🚚' : '🔔'} {ev.customer.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
