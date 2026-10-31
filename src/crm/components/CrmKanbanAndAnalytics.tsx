import React, { useMemo, useState } from 'react';
import { CustomerItem, CustomerStatus, FilterTab } from '../types/crm';
import { formatCurrency, getDeliveryDDay } from '../utils/date';
import { SpringNumberFlow } from '../../components/SpringNumberFlow';
import {
  ArrowRight,
  Calculator,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gift,
  MessageSquare,
  Phone,
  TrendingUp,
  Truck,
} from 'lucide-react';

// ============================================================================
// 1. Tremor 스타일 월간 매출·실적 & 전환 파이프라인 대시보드 바
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
    const now = new Date();
    const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;

    const closed = customers.filter(
      (c) => c.status === '계약완료' || c.status === '발송완료'
    );
    const thisMonthClosed = closed.filter(
      (c) =>
        (c.regDate || '').startsWith(ymPrefix) ||
        (c.deliveryDate || '').startsWith(ymPrefix)
    );

    const activeLeads = customers.filter(
      (c) =>
        c.status === '신규/미발송' ||
        c.status === '상담진행중' ||
        c.status === '미구매/고민중'
    );

    const closedPaidSum = closed.reduce((s, c) => s + (c.paidAmount || 0), 0);
    const closedBenefitSum = closed.reduce(
      (s, c) => s + Math.max(0, (c.paidAmount || 0) - (c.netAmount || 0)),
      0
    );
    const pipelinePaidSum = activeLeads.reduce(
      (s, c) => s + (c.paidAmount || 0),
      0
    );

    const totalValid = customers.filter((c) => c.status !== '취소/보류').length;
    const convRate =
      totalValid > 0 ? Math.round((closed.length / totalValid) * 100) : 0;

    return {
      closedCount: closed.length,
      thisMonthClosedCount: thisMonthClosed.length,
      activeLeadCount: activeLeads.length,
      closedPaidSum,
      closedBenefitSum,
      pipelinePaidSum,
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
    ? 'bg-[#151A25] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';
  const mutedCls = isDark ? 'text-slate-400' : 'text-[#78716C]';

  const totalBar =
    Math.max(
      1,
      metrics.byStatus.newLead +
        metrics.byStatus.consulting +
        metrics.byStatus.hesitating +
        metrics.byStatus.contracted
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* KPI 1: 누적 확정 매출 */}
      <div className={`rounded-3xl border p-4 shadow-2xs space-y-1.5 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-extrabold ${mutedCls}`}>
            계약·발송 확정 매출 ({metrics.closedCount}건)
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500">
            이번 달 {metrics.thisMonthClosedCount}건
          </span>
        </div>
        <div className="text-xl sm:text-2xl font-black text-emerald-500">
          <SpringNumberFlow value={metrics.closedPaidSum} suffix="원" />
        </div>
        <div className={`text-[11px] font-bold ${mutedCls}`}>
          제공한 총 고객 체감 혜택:{' '}
          <strong className={isDark ? 'text-amber-300' : 'text-[#8C5A32]'}>
            -{formatCurrency(metrics.closedBenefitSum)}원
          </strong>
        </div>
      </div>

      {/* KPI 2: 가망 파이프라인 대기 금액 */}
      <div className={`rounded-3xl border p-4 shadow-2xs space-y-1.5 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-extrabold ${mutedCls}`}>
            상담·고민중 가망 파이프라인 ({metrics.activeLeadCount}명)
          </span>
          <button
            type="button"
            onClick={() => onSelectFilter('미구매/고민중')}
            className="text-[11px] font-black text-indigo-500 hover:underline cursor-pointer"
          >
            고민고객 보기 →
          </button>
        </div>
        <div
          className={`text-xl sm:text-2xl font-black ${
            isDark ? 'text-sky-300' : 'text-[#18181B]'
          }`}
        >
          <SpringNumberFlow value={metrics.pipelinePaidSum} suffix="원" />
        </div>
        <div className={`text-[11px] font-bold flex items-center gap-1.5 ${mutedCls}`}>
          <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
          <span>현재 누적 성약 전환율: </span>
          <strong className="font-mono text-sky-500">{metrics.convRate}%</strong>
        </div>
      </div>

      {/* KPI 3: 파이프라인 단계 분포 인터랙티브 바 */}
      <div className={`rounded-3xl border p-4 shadow-2xs flex flex-col justify-between gap-2 ${cardCls}`}>
        <div className="flex items-center justify-between text-xs font-extrabold">
          <span className={mutedCls}>단계별 고객 분포 (클릭 시 필터)</span>
          <span className="font-mono">{customers.length}명</span>
        </div>

        {/* Stacked Distribution Bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-black/5">
          <button
            type="button"
            onClick={() => onSelectFilter('신규/미발송')}
            style={{ width: `${(metrics.byStatus.newLead / totalBar) * 100}%` }}
            className="bg-rose-500 h-full cursor-pointer"
            title={`신규/미발송 ${metrics.byStatus.newLead}명`}
          />
          <button
            type="button"
            onClick={() => onSelectFilter('상담진행중')}
            style={{ width: `${(metrics.byStatus.consulting / totalBar) * 100}%` }}
            className="bg-indigo-500 h-full cursor-pointer"
            title={`상담진행중 ${metrics.byStatus.consulting}명`}
          />
          <button
            type="button"
            onClick={() => onSelectFilter('미구매/고민중')}
            style={{ width: `${(metrics.byStatus.hesitating / totalBar) * 100}%` }}
            className="bg-amber-400 h-full cursor-pointer"
            title={`미구매/고민중 ${metrics.byStatus.hesitating}명`}
          />
          <button
            type="button"
            onClick={() => onSelectFilter('계약완료')}
            style={{ width: `${(metrics.byStatus.contracted / totalBar) * 100}%` }}
            className="bg-emerald-500 h-full cursor-pointer"
            title={`계약/발송완료 ${metrics.byStatus.contracted}명`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-black flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onSelectFilter('신규/미발송')}
            className="text-rose-500 cursor-pointer"
          >
            ● 신규 {metrics.byStatus.newLead}
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter('상담진행중')}
            className="text-indigo-500 cursor-pointer"
          >
            ● 상담 {metrics.byStatus.consulting}
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter('미구매/고민중')}
            className="text-amber-500 cursor-pointer"
          >
            ● 고민 {metrics.byStatus.hesitating}
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter('계약완료')}
            className="text-emerald-500 cursor-pointer"
          >
            ● 계약 {metrics.byStatus.contracted}
          </button>
        </div>
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
    accentDot: 'bg-rose-500',
    nextStatus: '상담진행중',
  },
  {
    status: '상담진행중',
    title: '상담 진행중',
    accentDot: 'bg-indigo-500',
    nextStatus: '미구매/고민중',
  },
  {
    status: '미구매/고민중',
    title: '미구매 · 고민중',
    accentDot: 'bg-amber-400',
    nextStatus: '계약완료',
  },
  {
    status: '계약완료',
    title: '계약 완료 (배송대기)',
    accentDot: 'bg-emerald-500',
    nextStatus: '발송완료',
  },
  {
    status: '발송완료',
    title: '발송 · 인도 완료',
    accentDot: 'bg-sky-500',
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
    ? 'bg-[#121722] border-white/10 text-slate-100'
    : 'bg-[#ECE8DF]/75 border-[#DFD9CE] text-[#18181B]';
  const cardCls = isDark
    ? 'bg-[#1B2230] border-white/10 hover:border-sky-400/50 text-slate-100'
    : 'bg-white border-[#E4DFD5] hover:border-[#8C5A32] text-[#18181B]';

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 schedule-matrix-scroll">
      {KANBAN_COLUMNS.map((col) => {
        const colItems = customers.filter((c) => c.status === col.status);
        const colAmount = colItems.reduce((s, c) => s + (c.paidAmount || 0), 0);
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
            className={`min-w-[272px] w-[272px] sm:min-w-[290px] sm:w-[290px] shrink-0 rounded-3xl border p-3 flex flex-col gap-2.5 transition-colors ${colBg} ${
              isOver ? 'ring-2 ring-sky-400' : ''
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
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black font-mono bg-black/10">
                  {colItems.length}
                </span>
              </div>
              <div className="text-[11px] font-mono font-bold opacity-70">
                합계 {formatCurrency(colAmount)}원
              </div>
            </div>

            {/* 카드 리스트 */}
            <div className="space-y-2 min-h-[180px] max-h-[58dvh] overflow-y-auto pr-0.5">
              {colItems.length === 0 ? (
                <div className="py-10 text-center text-[11px] font-bold opacity-45 border-2 border-dashed border-current/15 rounded-2xl">
                  여기로 카드를 끌어놓으세요
                </div>
              ) : (
                colItems.map((c) => {
                  const dday = getDeliveryDDay(c.deliveryDate);
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
                          <div className="text-[11px] opacity-65 font-mono">
                            {c.phone || '연락처 미입력'}
                          </div>
                        </div>
                        {c.deliveryDate && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0 ${dday.badgeClass}`}
                          >
                            {dday.label}
                          </span>
                        )}
                      </div>

                      <div
                        className={`rounded-xl px-2.5 py-2 text-xs ${
                          isDark ? 'bg-[#121722]' : 'bg-[#FAF8F4]'
                        }`}
                      >
                        <div className="font-bold truncate">
                          {c.items || '상담 품목 미입력'}
                        </div>
                        <div className="flex justify-between mt-1 text-[11px] font-mono">
                          <span className="opacity-70">
                            결제 {formatCurrency(c.paidAmount)}원
                          </span>
                          <span className="font-black text-amber-500">
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
                            <a
                              href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                              className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500"
                              title="전화"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenSMS(c)}
                            className="p-1.5 rounded-lg bg-sky-500/15 text-sky-500 cursor-pointer"
                            title="문자"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenQuote(c)}
                            className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 cursor-pointer"
                            title="견적서"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        </div>

                        {col.nextStatus && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(c.id, col.nextStatus!)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 cursor-pointer ${
                              isDark
                                ? 'bg-white/10 hover:bg-white/20 text-slate-200'
                                : 'bg-[#F4ECE1] hover:bg-[#EAE0D0] text-[#6E4423]'
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
    ? 'bg-[#151A25] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';

  const today = new Date();

  return (
    <div className={`rounded-3xl border overflow-hidden shadow-xs ${cardCls}`}>
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'bg-[#1B2230] border-white/10' : 'bg-[#FAF8F4] border-[#E4DFD5]'
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-black">
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>배송(🚚) · 재연락(🔔) 월간 일정표</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursorDate(new Date(year, month - 2, 1))}
            className="p-1.5 rounded-xl border border-current/15 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm font-black font-mono">
            {year}.{String(month).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setCursorDate(new Date(year, month, 1))}
            className="p-1.5 rounded-xl border border-current/15 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-black">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
            <Truck className="w-3 h-3" /> 배송예정
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
            <Gift className="w-3 h-3" /> 재연락·팔로업
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center py-2 text-xs font-black border-b border-current/10">
        {WEEKDAY_KO.map((w, i) => (
          <div
            key={w}
            className={
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : ''
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
                className="min-h-[82px] sm:min-h-[104px] border-b border-r border-current/5 opacity-30"
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
              className={`min-h-[82px] sm:min-h-[104px] p-1.5 sm:p-2 border-b border-r border-current/10 flex flex-col gap-1 ${
                isToday ? 'ring-2 ring-inset ring-amber-400' : ''
              }`}
            >
              <span className="text-xs font-black font-mono">{day}</span>
              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayEvents.map((ev, eIdx) => (
                  <button
                    key={`${ev.customer.id}-${ev.type}-${eIdx}`}
                    type="button"
                    onClick={() => onSelectCustomer(ev.customer)}
                    className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-black truncate cursor-pointer ${
                      ev.type === 'delivery'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-400 text-slate-950'
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
