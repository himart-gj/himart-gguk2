import React from 'react';
import { PipelineStatus } from '../types/crm';

interface FilterTabsProps {
  activeTab: PipelineStatus | '전체';
  onSelectTab: (tab: PipelineStatus | '전체') => void;
  counts: Record<string, number>;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeTab,
  onSelectTab,
  counts,
}) => {
  const tabs: { key: PipelineStatus | '전체'; label: string; icon: string }[] = [
    { key: '전체', label: '전체보기', icon: '⚡' },
    { key: '신규/미발송', label: '신규/미발송', icon: '📋' },
    { key: '상담진행중', label: '상담진행', icon: '💬' },
    { key: '미구매/고민중', label: '미구매/팔로우업', icon: '🤔' },
    { key: '물류대기', label: '물류입고대기', icon: '📦' },
    { key: '배송대기', label: '배송대기', icon: '🚚' },
    { key: '배송완료', label: '배송완료', icon: '✅' },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
      {tabs.map((t) => {
        const isSelected = activeTab === t.key;
        const count = t.key === '전체' ? counts['전체'] : counts[t.key] || 0;

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelectTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 flex-shrink-0 border ${
              isSelected
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                isSelected
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
