import React from 'react';
import { 
  ClipboardList, 
  Truck, 
  Package, 
  HelpCircle, 
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { PipelineStatus } from '../types/crm';

interface KPIDashboardProps {
  counts: Record<PipelineStatus, number>;
  activeStatusFilter: PipelineStatus | '전체';
  onSelectStatus: (status: PipelineStatus | '전체') => void;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  counts,
  activeStatusFilter,
  onSelectStatus,
}) => {
  const cards: {
    status: PipelineStatus;
    title: string;
    sub: string;
    icon: React.ReactNode;
    colorClasses: string;
    activeBorder: string;
    countColor: string;
  }[] = [
    {
      status: '신규/미발송',
      title: '신규 / 미발송',
      sub: '문자 미발송 접수',
      icon: <ClipboardList className="w-5 h-5 text-amber-500" />,
      colorClasses: 'from-amber-500/10 to-amber-600/5 hover:border-amber-400/50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/80',
      countColor: 'text-amber-600',
    },
    {
      status: '배송대기',
      title: '배송 대기',
      sub: '결제완료·일정지정',
      icon: <Truck className="w-5 h-5 text-rose-500" />,
      colorClasses: 'from-rose-500/10 to-rose-600/5 hover:border-rose-400/50',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/80',
      countColor: 'text-rose-600',
    },
    {
      status: '물류대기',
      title: '물류 대기',
      sub: '본사/물류 입고대기',
      icon: <Package className="w-5 h-5 text-purple-500" />,
      colorClasses: 'from-purple-500/10 to-purple-600/5 hover:border-purple-400/50',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/80',
      countColor: 'text-purple-600',
    },
    {
      status: '미구매/고민중',
      title: '미구매 / 팔로업',
      sub: '견적 전달 후 고민',
      icon: <HelpCircle className="w-5 h-5 text-sky-500" />,
      colorClasses: 'from-sky-500/10 to-sky-600/5 hover:border-sky-400/50',
      activeBorder: 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-50/80',
      countColor: 'text-sky-600',
    },
    {
      status: '상담진행중',
      title: '상담 진행중',
      sub: '1차상담·행사대기',
      icon: <MessageSquare className="w-5 h-5 text-indigo-500" />,
      colorClasses: 'from-indigo-500/10 to-indigo-600/5 hover:border-indigo-400/50',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/80',
      countColor: 'text-indigo-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      {cards.map((c) => {
        const isSelected = activeStatusFilter === c.status;
        const count = counts[c.status] || 0;

        return (
          <button
            key={c.status}
            type="button"
            onClick={() => onSelectStatus(isSelected ? '전체' : c.status)}
            className={`text-left p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 bg-gradient-to-br bg-white shadow-sm flex flex-col justify-between relative overflow-hidden ${
              isSelected
                ? c.activeBorder
                : `border-slate-200/90 ${c.colorClasses}`
            }`}
          >
            {/* Top row: Icon & Count */}
            <div className="flex items-center justify-between w-full">
              <div className="p-2 rounded-xl bg-white shadow-xs border border-slate-100 flex items-center justify-center">
                {c.icon}
              </div>
              <span className={`text-2xl sm:text-3xl font-black tracking-tight ${c.countColor}`}>
                {count}
              </span>
            </div>

            {/* Bottom row: Title & Sub */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {c.title}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-60 flex-shrink-0" />
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-normal">
                {c.sub}
              </p>
            </div>

            {/* Indicator bar if selected */}
            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-indigo-600" />
            )}
          </button>
        );
      })}
    </div>
  );
};
