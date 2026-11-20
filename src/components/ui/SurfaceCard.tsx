import React from 'react';

export type SurfaceCardTone = 'default' | 'sub' | 'benefit' | 'brand' | 'emerald';

export interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceCardTone;
  padded?: boolean;
}

const TONE_CLASSES: Record<SurfaceCardTone, string> = {
  default:
    'bg-white dark:bg-[#131C2E] border-[#E5E8EB] dark:border-slate-800 shadow-[0_2px_10px_rgba(25,31,40,0.03)] dark:shadow-none',
  sub: 'bg-[#F8FAFC] dark:bg-slate-900/70 border-[#E5E8EB] dark:border-slate-800',
  benefit:
    'bg-[#EFF6FF] dark:bg-blue-500/12 border-[#BFDBFE] dark:border-blue-500/30',
  brand:
    'bg-[#FFF1F2] dark:bg-rose-500/12 border-[#FECDD3] dark:border-rose-500/30',
  emerald:
    'bg-emerald-50/70 dark:bg-emerald-500/12 border-emerald-200 dark:border-emerald-500/30',
};

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  tone = 'default',
  padded = true,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-[20px] border ${TONE_CLASSES[tone]} ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
