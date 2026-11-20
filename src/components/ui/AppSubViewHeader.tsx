import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface AppSubViewHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  maxWidthClass?: string;
  className?: string;
}

export const AppSubViewHeader: React.FC<AppSubViewHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon,
  onBack,
  backLabel = '홈으로',
  rightSlot,
  bottomSlot,
  maxWidthClass = 'max-w-[1440px]',
  className = '',
}) => {
  return (
    <header
      style={{ top: 'var(--app-header-h, 54px)' }}
      className={`no-print sticky z-30 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-b border-[#E5E8EB] dark:border-slate-800 transition-colors ${className}`}
    >
      <div className={`${maxWidthClass} mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 text-[#191F28] dark:text-slate-100 text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden min-[380px]:inline">{backLabel}</span>
            </button>
          )}

          {icon && (
            <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/90 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#191F28] dark:text-slate-100 shrink-0">
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 truncate">
                {title}
              </h1>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 shrink-0">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[#4E5968] dark:text-slate-400 font-medium truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightSlot && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end ml-auto">
            {rightSlot}
          </div>
        )}
      </div>

      {bottomSlot && (
        <div className={`${maxWidthClass} mx-auto px-3.5 sm:px-6 pb-2.5`}>
          {bottomSlot}
        </div>
      )}
    </header>
  );
};
