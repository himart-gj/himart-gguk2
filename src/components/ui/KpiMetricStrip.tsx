import React from 'react';

export interface KpiMetricItem {
  id: string;
  label: string;
  value: React.ReactNode;
  subLabel?: React.ReactNode;
  tone?: 'default' | 'benefit' | 'brand' | 'emerald';
  active?: boolean;
  onClick?: () => void;
}

export interface KpiMetricStripProps {
  items: KpiMetricItem[];
  columnsClass?: string;
  className?: string;
}

export const KpiMetricStrip: React.FC<KpiMetricStripProps> = ({
  items,
  columnsClass = 'grid-cols-2 sm:grid-cols-4',
  className = '',
}) => {
  return (
    <div className={`grid ${columnsClass} gap-2.5 ${className}`}>
      {items.map((item) => {
        const valueColor =
          item.tone === 'brand'
            ? 'text-[#E60012] dark:text-[#FF3B47]'
            : item.tone === 'benefit'
            ? 'text-[#1B64DA] dark:text-blue-400'
            : item.tone === 'emerald'
            ? 'text-[#059669] dark:text-emerald-400'
            : 'text-[#191F28] dark:text-slate-50';

        const activeRing = item.active
          ? 'border-[#1B64DA] dark:border-blue-400 bg-[#EFF6FF]/70 dark:bg-blue-500/15 ring-1 ring-[#1B64DA]/20'
          : 'border-[#E5E8EB] dark:border-slate-800 bg-white dark:bg-[#131C2E]';

        const Wrapper = item.onClick ? 'button' : 'div';

        return (
          <Wrapper
            key={item.id}
            {...(item.onClick ? { type: 'button' as const, onClick: item.onClick } : {})}
            className={`rounded-2xl border p-3 sm:p-3.5 text-left transition-colors shadow-[0_2px_8px_rgba(25,31,40,0.02)] dark:shadow-none ${activeRing} ${
              item.onClick ? 'hover:border-[#D1D6DB] dark:hover:border-slate-600 cursor-pointer' : ''
            }`}
          >
            <div className="text-[11.5px] font-bold text-[#4E5968] dark:text-slate-400 truncate">
              {item.label}
            </div>
            <div className={`mt-1 text-[17px] sm:text-[19px] font-extrabold font-mono tabular-nums tracking-tight ${valueColor}`}>
              {item.value}
            </div>
            {item.subLabel && (
              <div className="mt-0.5 text-[11.5px] font-medium text-[#8B95A1] dark:text-slate-400 truncate">
                {item.subLabel}
              </div>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
};
