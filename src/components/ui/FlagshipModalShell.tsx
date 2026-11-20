import React, { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface FlagshipModalShellProps {
  isOpen?: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

export const FlagshipModalShell: React.FC<FlagshipModalShellProps> = ({
  isOpen = true,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  headerRight,
  footer,
  maxWidthClass = 'max-w-2xl',
  bodyClassName = 'p-4 sm:p-6 overflow-y-auto flex-1',
  zIndexClass = 'z-50',
  closeOnBackdrop = true,
  children,
}) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const resetBody = () => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
    };
    resetBody();
    const rafId = requestAnimationFrame(resetBody);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] animate-in fade-in duration-150`}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[92dvh] rounded-[20px] bg-white dark:bg-[#131C2E] border border-[#D1D6DB] dark:border-slate-700 border-t-[3px] border-t-[#E60012] shadow-2xl modal-kb-safe flex flex-col overflow-hidden text-[#191F28] dark:text-slate-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-[#131C2E] border-b border-[#E5E8EB] dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#191F28] dark:text-slate-100 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-[#191F28] dark:text-slate-50 truncate">
                  {title}
                </h2>
                {badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-500/15 border border-[#BFDBFE] dark:border-blue-500/30 text-[11.5px] font-bold text-[#1B64DA] dark:text-blue-300 shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <div className="text-xs text-[#4E5968] dark:text-slate-400 font-medium mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label="모달 닫기"
              className="w-9 h-9 rounded-xl bg-[#F2F4F6] dark:bg-slate-800 hover:bg-[#E5E8EB] dark:hover:bg-slate-700 border border-[#E5E8EB] dark:border-slate-700 flex items-center justify-center text-[#4E5968] dark:text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={bodyRef} className={bodyClassName}>
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-6 py-3 bg-[#F8FAFC] dark:bg-[#0B1120]/80 border-t border-[#E5E8EB] dark:border-slate-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
