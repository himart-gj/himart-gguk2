import React from 'react';

export interface LedgerRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  tag?: React.ReactNode;
  tone?: 'default' | 'benefit' | 'brand' | 'emerald' | 'muted';
  bold?: boolean;
  className?: string;
}

export const LedgerRow: React.FC<LedgerRowProps> = ({
  label,
  value,
  tag,
  tone = 'default',
  bold = false,
  className = '',
}) => {
  const valueToneClass =
    tone === 'brand'
      ? 'text-[#E60012] dark:text-[#FF3B47]'
      : tone === 'benefit'
      ? 'text-[#1B64DA] dark:text-blue-400'
      : tone === 'emerald'
      ? 'text-[#059669] dark:text-emerald-400'
      : tone === 'muted'
      ? 'text-[#8B95A1] dark:text-slate-400'
      : 'text-[#191F28] dark:text-slate-100';

  return (
    <div className={`ledger-row py-1.5 ${className}`}>
      <div className="ledger-row-label flex items-center gap-1.5 text-xs sm:text-[13px] text-[#4E5968] dark:text-slate-300 font-medium">
        {tag}
        <span className={bold ? 'font-bold text-[#191F28] dark:text-slate-100' : ''}>{label}</span>
      </div>
      <div
        className={`ledger-row-value font-mono text-xs sm:text-[13.5px] ${
          bold ? 'font-extrabold' : 'font-bold'
        } ${valueToneClass}`}
      >
        {value}
      </div>
    </div>
  );
};
