import React, { useLayoutEffect, useRef } from 'react';

export interface FormattedMoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | '' | undefined | null;
  onValueChange: (numericValue: number, rawDigits: string) => void;
  stepAmount?: number;
}

export const FormattedMoneyInput: React.FC<FormattedMoneyInputProps> = ({
  value,
  onValueChange,
  stepAmount = 10000,
  className = '',
  onKeyDown,
  onWheel,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingDigitsBeforeCaretRef = useRef<number | null>(null);

  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const displayValue =
    value === '' || value === undefined || value === null || numeric === 0
      ? ''
      : numeric.toLocaleString('ko-KR');

  useLayoutEffect(() => {
    const targetDigits = pendingDigitsBeforeCaretRef.current;
    if (targetDigits === null) return;
    pendingDigitsBeforeCaretRef.current = null;

    const el = inputRef.current;
    if (!el || typeof document === 'undefined' || document.activeElement !== el) return;

    if (displayValue === '' || targetDigits <= 0) {
      el.setSelectionRange(0, 0);
      return;
    }

    let seenDigits = 0;
    let nextPos = displayValue.length;
    for (let i = 0; i < displayValue.length; i++) {
      if (displayValue[i] >= '0' && displayValue[i] <= '9') {
        seenDigits += 1;
        if (seenDigits === targetDigits) {
          nextPos = i + 1;
          break;
        }
      }
    }
    el.setSelectionRange(nextPos, nextPos);
  }, [displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const selectionStart = e.target.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, selectionStart).replace(/[^0-9]/g, '').length;
    pendingDigitsBeforeCaretRef.current = digitsBeforeCaret;

    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      onValueChange(0, '');
      return;
    }
    const parsed = Math.max(0, Number(digitsOnly) || 0);
    onValueChange(parsed, digitsOnly);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      pendingDigitsBeforeCaretRef.current = null;
      const next = Math.max(0, numeric + stepAmount);
      onValueChange(next, String(next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      pendingDigitsBeforeCaretRef.current = null;
      const next = Math.max(0, numeric - stepAmount);
      onValueChange(next, next === 0 ? '' : String(next));
    }
    onKeyDown?.(e);
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
    onWheel?.(e);
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      className={`font-mono tabular-nums text-base max-sm:!text-base ${className}`}
    />
  );
};
