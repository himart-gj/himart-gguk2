import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ViewportSafePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  preferredWidth?: number;
  align?: 'start' | 'end';
  mobileFullWidth?: boolean;
  zIndexClass?: string;
  backdropZIndexClass?: string;
  className?: string;
  children: React.ReactNode;
}

interface PopoverMetrics {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

export const ViewportSafePopover: React.FC<ViewportSafePopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
  preferredWidth = 320,
  align = 'end',
  mobileFullWidth = false,
  zIndexClass = 'z-[75]',
  backdropZIndexClass = 'z-[74]',
  className = '',
  children,
}) => {
  const [metrics, setMetrics] = useState<PopoverMetrics | null>(null);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchor = anchorRef.current;

    const width =
      mobileFullWidth && vw < 640
        ? Math.max(200, vw - margin * 2)
        : Math.min(preferredWidth, Math.max(200, vw - margin * 2));

    if (!anchor) {
      setMetrics({
        left: Math.max(margin, Math.round((vw - width) / 2)),
        top: 64,
        width,
        maxHeight: Math.max(200, vh - 80),
      });
      return;
    }

    const rect = anchor.getBoundingClientRect();

    // Respect split-pane boundaries (e.g., Galaxy Z Fold8 Ultra split view) when space allows
    let paneLeft = margin;
    let paneRight = vw - margin;
    let p = anchor.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const st = window.getComputedStyle(p);
      if (
        (st.overflowY === 'auto' || st.overflowX === 'hidden') &&
        p.clientWidth >= 260 &&
        p.clientWidth < vw - 40
      ) {
        const pr = p.getBoundingClientRect();
        paneLeft = Math.max(margin, Math.round(pr.left) + 8);
        paneRight = Math.min(vw - margin, Math.round(pr.right) - 8);
        break;
      }
      p = p.parentElement;
    }

    let desiredLeft = align === 'end' ? rect.right - width : rect.left;

    // If right-aligned popover would cross left of its pane or viewport edge, flip to start-aligned if it fits better
    if (align === 'end' && desiredLeft < paneLeft) {
      if (rect.left + width <= paneRight) {
        desiredLeft = rect.left;
      } else {
        desiredLeft = Math.max(paneLeft, paneRight - width);
      }
    }

    // Final hard clamp to viewport [margin, vw - width - margin] so clipping is mathematically impossible
    const clampedLeft = Math.round(
      Math.max(margin, Math.min(desiredLeft, vw - width - margin))
    );

    const gap = 8;
    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;

    if (spaceBelow < 220 && spaceAbove > spaceBelow + 40) {
      setMetrics({
        left: clampedLeft,
        bottom: Math.max(margin, Math.round(vh - rect.top + gap)),
        width,
        maxHeight: Math.max(180, Math.round(spaceAbove)),
      });
    } else {
      const top = Math.max(margin, Math.round(rect.bottom + gap));
      setMetrics({
        left: clampedLeft,
        top,
        width,
        maxHeight: Math.max(180, Math.round(vh - top - margin)),
      });
    }
  }, [anchorRef, preferredWidth, align, mobileFullWidth]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleRelayout = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('resize', handleRelayout);
    window.addEventListener('scroll', handleRelayout, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleRelayout);
      window.removeEventListener('scroll', handleRelayout, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 ${backdropZIndexClass} no-print`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        data-viewport-popover="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={
          metrics
            ? {
                position: 'fixed',
                left: `${metrics.left}px`,
                ...(metrics.top !== undefined ? { top: `${metrics.top}px` } : {}),
                ...(metrics.bottom !== undefined ? { bottom: `${metrics.bottom}px` } : {}),
                width: `${metrics.width}px`,
                maxHeight: `${metrics.maxHeight}px`,
              }
            : {
                position: 'fixed',
                left: '12px',
                top: '64px',
                width: `${Math.min(preferredWidth, 320)}px`,
              }
        }
        className={`${zIndexClass} overflow-y-auto overscroll-contain no-print ${className}`}
      >
        {children}
      </div>
    </>,
    document.body
  );
};
