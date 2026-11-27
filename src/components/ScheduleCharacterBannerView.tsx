import React, { useEffect, useMemo, useState } from 'react';
import {
  DayScheduleCode,
  extractDynamicStaffRoster,
  getOrCreateMonthSchedule,
  GWANGJU_STAFF_ROSTER,
  isOffDayCode,
  loadAllSchedules,
  loadSavedUserName,
  saveUserName,
  SCHEDULE_UPDATED_EVENT,
  SchedulesMap,
} from './ScheduleModal';
import { CustomerItem, SettlementTabId } from '../crm/types/crm';
import {
  CRM_CUSTOMERS_UPDATED_EVENT,
  getCachedCustomers,
} from '../crm/services/gasApi';
import {
  ALLCARE_COUNT_UPDATED_EVENT,
  computeMonthlySettlementReport,
  fetchRemoteModelIncentiveSheets,
  getCurrentYearMonth,
  getMonthlyAllCareCount,
  hydrateModelIncentiveSheetsFromIdb,
  hydrateMonthlyAllCareCountsFromIdb,
  loadAllModelIncentiveSheets,
  loadAllMonthlyAllCareCounts,
  MODEL_INCENTIVE_UPDATED_EVENT,
} from '../crm/utils/settlementEngine';
import { formatShortManwon } from '../crm/utils/date';
import { SpringNumberFlow } from './SpringNumberFlow';


export const ScheduleCharacterBannerView: React.FC<{ ctx: Record<string, any> }> = ({ ctx }) => {
  const {
    currentMonthAllCareCount,
    currentMonthGiftCardReport,
    currentMonthNum,
    dynamicRoster,
    hideAmounts,
    hideScheduleSection,
    isDark,
    isExpanded,
    isPickerOpen,
    leftSummary,
    liveMood,
    monthlyIncentiveSummary,
    onOpenGiftCardModal,
    onOpenIncentiveTab,
    onOpenScheduleModal,
    pillColorStyle,
    renderAnimatedMoodFace,
    setIsExpanded,
    setIsPickerOpen,
    setUserName,
    toggleHideAmounts,
    trackDays,
    userName,
    userRole,
  } = ctx;
  return (
    <div
      className={`scb-root ${isDark ? 'is-dark' : 'is-light'}`}
      role="region"
      aria-label={hideScheduleSection ? '이달의 실시간 실적 · 수당 브리핑' : '근무 스케줄 및 실적 라운지'}
    >
      <style>{`
        .scb-root {
          width: 100%;
          border-radius: 20px;
          border: 1px solid var(--border-subtle, #E5E8EB);
          background: var(--bg-surface, #FFFFFF);
          color: var(--text-main, #191F28);
          box-shadow: 0 2px 12px rgba(25, 31, 40, 0.04);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: border-color 160ms ease, background-color 160ms ease;
        }
        .scb-root.is-dark {
          background: #131C2E;
          border-color: rgba(255,255,255,0.09);
          color: #F8FAFC;
          box-shadow: none;
        }
        .scb-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 16px;
          background: #F8FAFC;
          border-bottom: 1px solid #E5E8EB;
        }
        .scb-root.is-dark .scb-header-bar {
          background: rgba(255,255,255,0.03);
          border-bottom-color: rgba(255,255,255,0.08);
        }
        .scb-header-bar.is-collapsed {
          border-bottom: none;
          background: transparent;
          padding: 12px 16px;
          cursor: pointer;
        }
        .scb-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .scb-brand-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #E60012;
          flex-shrink: 0;
        }
        .scb-header-eyebrow {
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #191F28;
          white-space: nowrap;
        }
        .scb-root.is-dark .scb-header-eyebrow {
          color: #F8FAFC;
        }
        .scb-header-sub {
          font-size: 11.5px;
          font-weight: 600;
          color: #4E5968;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scb-root.is-dark .scb-header-sub {
          color: #94A3B8;
        }
        .scb-compact-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        @media (max-width: 480px) {
          .scb-header-bar {
            flex-wrap: wrap;
            padding: 10px 12px;
            gap: 8px;
          }
          .scb-header-left {
            flex: 1 1 100%;
          }
          .scb-compact-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
        .scb-ghost-btn {
          padding: 5px 10px;
          border-radius: 9px;
          border: 1px solid #E5E8EB;
          background: #FFFFFF;
          color: #191F28;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background-color 140ms ease, border-color 140ms ease;
        }
        .scb-ghost-btn:hover {
          background: #F2F4F6;
          border-color: #D1D6DB;
        }
        .scb-ghost-btn.is-primary {
          background: #EFF6FF;
          border-color: #BFDBFE;
          color: #1B64DA;
        }
        .scb-root.is-dark .scb-ghost-btn {
          background: #1E293B;
          border-color: rgba(255,255,255,0.12);
          color: #E2E8F0;
        }
        .scb-root.is-dark .scb-ghost-btn.is-primary {
          background: rgba(96,165,250,0.15);
          border-color: rgba(96,165,250,0.35);
          color: #93C5FD;
        }
        .scb-expand-body {
          padding: 14px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        .scb-top-split {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: center;
        }
        @media (min-width: 640px) {
          .scb-top-split {
            grid-template-columns: 1.06fr 0.94fr;
            gap: 14px;
          }
        }

        .scb-left-pane {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .scb-ring-outer {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .scb-ring-inner {
          width: 47px;
          height: 47px;
          border-radius: 50%;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.05;
        }
        .scb-root.is-dark .scb-ring-inner {
          background: #131C2E;
        }
        .scb-ring-lbl {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: -0.04em;
          opacity: 0.72;
        }
        .scb-ring-val {
          font-size: 13px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.04em;
        }

        .scb-user-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3.5px 10px;
          border-radius: 999px;
          border: 1px solid #BFDBFE;
          background: #EFF6FF;
          color: #1B64DA;
          font-size: 11.5px;
          font-weight: 800;
          margin-bottom: 4px;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-user-pill {
          background: rgba(96,165,250,0.16);
          border-color: rgba(96,165,250,0.35);
          color: #93C5FD;
        }
        .scb-headline {
          margin: 0;
          font-size: 14.5px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.3;
          word-break: keep-all;
        }
        .scb-subline {
          margin: 2px 0 0;
          font-size: 11.5px;
          font-weight: 500;
          color: #4E5968;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-subline {
          color: #94A3B8;
        }

        .scb-mood-pod {
          border-radius: 14px;
          padding: 9px 12px;
          background: #F8FAFC;
          border: 1px solid #E5E8EB;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-mood-pod {
          background: #1E293B;
          border-color: rgba(255,255,255,0.08);
        }
        .scb-face-orb {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #FFFFFF;
          border: 1px solid #E5E8EB;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .scb-root.is-dark .scb-face-orb {
          background: #0B1120;
          border-color: rgba(255,255,255,0.08);
        }

        .scb-mood-body {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .scb-mood-pill {
          align-self: flex-start;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .scb-mood-title {
          font-size: 12px;
          font-weight: 700;
          line-height: 1.32;
          letter-spacing: -0.015em;
          word-break: keep-all;
        }
        .scb-shift-bar-row {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 1px;
        }
        .scb-shift-track {
          flex: 1;
          height: 5px;
          border-radius: 999px;
          background: #E5E8EB;
          overflow: hidden;
        }
        .scb-root.is-dark .scb-shift-track {
          background: rgba(255,255,255,0.12);
        }
        .scb-shift-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #1B64DA 0%, #3B82F6 100%);
          transform-origin: left center;
          transition: transform 300ms cubic-bezier(0.23,1,0.32,1);
        }
        .scb-shift-caption {
          font-size: 11.5px;
          font-weight: 700;
          color: #4E5968;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .scb-root.is-dark .scb-shift-caption {
          color: #94A3B8;
        }

        .scb-incentive-strip {
          border-radius: 14px;
          padding: 9px 12px;
          background: #F8FAFC;
          border: 1px solid #E5E8EB;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-incentive-strip {
          background: #1E293B;
          border-color: rgba(255,255,255,0.1);
        }
        .scb-inc-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .scb-inc-badge {
          padding: 3.5px 9px;
          border-radius: 999px;
          background: #191F28;
          color: #FFFFFF;
          font-size: 11.5px;
          font-weight: 800;
          white-space: nowrap;
        }
        .scb-root.is-dark .scb-inc-badge {
          background: rgba(255,255,255,0.14);
          color: #F8FAFC;
        }
        .scb-inc-total {
          font-size: 15px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: #1B64DA;
          letter-spacing: -0.02em;
        }
        .scb-root.is-dark .scb-inc-total {
          color: #60A5FA;
        }
        .scb-inc-pills {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
        }
        .scb-inc-chip {
          padding: 4px 8.5px;
          border-radius: 9px;
          background: #FFFFFF;
          border: 1px solid #E5E8EB;
          font-size: 11.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: #191F28;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-inc-chip {
          background: #131C2E;
          border-color: rgba(255,255,255,0.1);
          color: #E2E8F0;
        }
        .scb-inc-chip.is-sub {
          border-color: #FECDD3;
          background: #FFF1F2;
          color: #E60012;
        }
        .scb-root.is-dark .scb-inc-chip.is-sub {
          background: rgba(255, 59, 71, 0.14);
          border-color: rgba(255, 59, 71, 0.35);
          color: #FDA4AF;
        }
        .scb-inc-chip.is-allcare {
          border-color: #BFDBFE;
          background: #EFF6FF;
          color: #1B64DA;
        }
        .scb-root.is-dark .scb-inc-chip.is-allcare {
          background: rgba(96, 165, 250, 0.14);
          border-color: rgba(96, 165, 250, 0.35);
          color: #93C5FD;
        }

        .scb-picker-tray {
          padding: 10px 12px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px dashed #CBD5E1;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .scb-root.is-dark .scb-picker-tray {
          background: #1E293B;
          border-color: rgba(255,255,255,0.15);
        }
        .scb-staff-btn {
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid #E5E8EB;
          background: #FFFFFF;
          color: #191F28;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-staff-btn {
          background: #131C2E;
          border-color: rgba(255,255,255,0.1);
          color: #E2E8F0;
        }
        .scb-staff-btn.is-me {
          background: #191F28;
          color: #FFFFFF;
          border-color: #191F28;
        }
        .scb-root.is-dark .scb-staff-btn.is-me {
          background: #60A5FA;
          color: #0B1120;
          border-color: #60A5FA;
        }

        .scb-week-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 4px;
          padding: 5px;
          border-radius: 13px;
          background: #F8FAFC;
          border: 1px solid #E5E8EB;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-week-grid {
          background: #0B1120;
          border-color: rgba(255,255,255,0.08);
        }
        .scb-day-cell {
          padding: 5px 1px;
          border-radius: 9px;
          background: #FFFFFF;
          border: 1px solid #E5E8EB;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-align: center;
          min-width: 0;
          overflow: hidden;
        }
        .scb-root.is-dark .scb-day-cell {
          background: #131C2E;
          border-color: rgba(255,255,255,0.06);
          color: #CBD5E1;
        }
        .scb-day-cell.is-today {
          background: #1B64DA;
          border-color: #1B64DA;
          color: #FFFFFF;
        }
        .scb-root.is-dark .scb-day-cell.is-today {
          background: #2563EB;
          border-color: #3B82F6;
          color: #FFFFFF;
        }
        .scb-day-cell.is-off {
          background: #FFF1F2;
          border-color: #FECDD3;
          color: #E60012;
        }
        .scb-root.is-dark .scb-day-cell.is-off {
          background: rgba(255,59,71,0.14);
          border-color: rgba(255,59,71,0.35);
          color: #FDA4AF;
        }
        .scb-day-top {
          font-size: 11.5px;
          font-weight: 700;
          opacity: 0.88;
          letter-spacing: -0.06em;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .scb-day-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #CBD5E1;
        }
        .scb-day-cell.is-today .scb-day-dot { background: #FFFFFF; }
        .scb-day-cell.is-off .scb-day-dot { background: #E60012; }
        .scb-day-code {
          font-size: 11.5px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.05em;
          white-space: nowrap;
        }

        @keyframes scbBreathe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes scbExcited {
          0%, 100% { transform: translateY(1px) scale(0.98); }
          50% { transform: translateY(-3.5px) scale(1.03); }
        }
        @keyframes scbGroove {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes scbBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.12); }
        }
        @keyframes scbFloatNote {
          0%, 100% { transform: translateY(0px); opacity: 0.75; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes scbSteam {
          0% { transform: translateY(2px); opacity: 0.35; }
          50% { opacity: 1; }
          100% { transform: translateY(-4px); opacity: 0.2; }
        }
        @keyframes scbSweat {
          0%, 100% { transform: translateY(0px); opacity: 0.9; }
          50% { transform: translateY(3px); opacity: 1; }
        }
        @keyframes scbTwinkle {
          0%, 100% { transform: scale(0.92); opacity: 0.85; }
          50% { transform: scale(1.12); opacity: 1; }
        }

        .scb-anim-breathe { transform-origin: 32px 33px; animation: scbBreathe 2.8s ease-in-out infinite; }
        .scb-anim-excited { transform-origin: 32px 33px; animation: scbExcited 0.95s ease-in-out infinite; }
        .scb-anim-groove { transform-origin: 32px 29px; animation: scbGroove 1.4s ease-in-out infinite; }
        .scb-anim-blink { transform-origin: 32px 29px; animation: scbBlink 3.6s ease-in-out infinite; }
        .scb-anim-note { animation: scbFloatNote 1.8s ease-in-out infinite; }
        .scb-anim-steam { animation: scbSteam 2s ease-in-out infinite; }
        .scb-anim-sweat { animation: scbSweat 1.5s ease-in-out infinite; }
        .scb-anim-twinkle { transform-origin: center; animation: scbTwinkle 1.2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .scb-anim-breathe, .scb-anim-excited, .scb-anim-groove,
          .scb-anim-blink, .scb-anim-note, .scb-anim-steam,
          .scb-anim-sweat, .scb-anim-twinkle {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className={`scb-header-bar ${!isExpanded ? 'is-collapsed' : ''}`}
        onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      >
        <div className="scb-header-left">
          <span className="scb-brand-dot" aria-hidden="true" />
          <span className="scb-header-eyebrow">
            {hideScheduleSection
              ? '이달의 실시간 실적 · 수당 브리핑'
              : '오늘의 근무 · 실적 브리핑'}
          </span>
          {hideScheduleSection ? (
            !isExpanded && (
              <span className="scb-header-sub">
                {hideAmounts
                  ? `· ${currentMonthNum}월 실적 요약 접힘`
                  : `· ${currentMonthNum}월 수당 +${monthlyIncentiveSummary.grandTotalIncentive.toLocaleString()}원 · 구독 ${monthlyIncentiveSummary.grossSubscriptionCount}건`}
              </span>
            )
          ) : (
            <span className="scb-header-sub">
              {!isExpanded
                ? `· ${userName ? `${userName} (${leftSummary.ringValue})` : '담당자 미지정'} · ${leftSummary.headline}`
                : `· ${currentMonthNum}월 경기광주점 실시간 스케줄`}
            </span>
          )}
        </div>

        <div className="scb-compact-actions">
          {isExpanded && (
            <button
              type="button"
              className="scb-ghost-btn"
              onClick={toggleHideAmounts}
              title="고객 동석 상담 시 수당 금액 숨김/표시"
            >
              {hideAmounts ? '수당 표시' : '수당 가림'}
            </button>
          )}
          {!hideScheduleSection && (
            <button
              type="button"
              className="scb-ghost-btn is-primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduleModal();
              }}
            >
              전체 휴무표
            </button>
          )}
          <button
            type="button"
            className="scb-ghost-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
          >
            {isExpanded ? '접기 ▴' : '펼치기 ▾'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="scb-expand-body">
          {!hideScheduleSection && (
            <div className="scb-top-split">
              <div className="scb-left-pane">
                <div
                  className="scb-ring-outer"
                  style={{
                    background: `conic-gradient(${leftSummary.ringColor} 0% ${leftSummary.ringPct}%, ${
                      isDark ? 'rgba(255,255,255,0.09)' : '#E5E8EB'
                    } ${leftSummary.ringPct}% 100%)`,
                  }}
                >
                  <div className="scb-ring-inner">
                    <span className="scb-ring-lbl">{leftSummary.ringLabel}</span>
                    <span className="scb-ring-val" style={{ color: leftSummary.ringColor }}>
                      {leftSummary.ringValue}
                    </span>
                  </div>
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    className="scb-user-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPickerOpen((prev) => !prev);
                    }}
                    title="내 이름 빠른 선택·변경"
                  >
                    <span>
                      {userName ? `${userName}${userRole ? ` (${userRole})` : ''}` : '내 이름 선택하기'}
                    </span>
                    <span>{isPickerOpen ? '▴' : '▾'}</span>
                  </button>
                  <h2 className="scb-headline">{leftSummary.headline}</h2>
                  <p className="scb-subline" onClick={onOpenScheduleModal}>
                    {leftSummary.subline}
                  </p>
                </div>
              </div>

              <div className="scb-mood-pod" onClick={onOpenScheduleModal}>
                {renderAnimatedMoodFace(liveMood.face)}
                <div className="scb-mood-body">
                  <span className="scb-mood-pill" style={pillColorStyle}>
                    {liveMood.pillText}
                  </span>
                  <div className="scb-mood-title">{liveMood.moodTitle}</div>
                  <div className="scb-shift-bar-row">
                    <div className="scb-shift-track" aria-hidden="true">
                      <div
                        className="scb-shift-fill"
                        style={{ transform: `scaleX(${Math.max(0.04, liveMood.progressPct / 100)})` }}
                      />
                    </div>
                    <span className="scb-shift-caption">{liveMood.progressLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hideScheduleSection && isPickerOpen && (
            <div
              className="scb-picker-tray"
              onClick={(e) => e.stopPropagation()}
              role="region"
              aria-label="직원 이름 빠른 선택"
            >
              {dynamicRoster.map((staff) => {
                const active = staff.name === userName;
                return (
                  <button
                    key={staff.name}
                    type="button"
                    className={`scb-staff-btn ${active ? 'is-me' : ''}`}
                    onClick={() => {
                      saveUserName(staff.name);
                      setUserName(staff.name);
                      setIsPickerOpen(false);
                    }}
                  >
                    {staff.name} <span style={{ opacity: 0.7, fontWeight: 500 }}>{staff.role}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="scb-incentive-strip"
            onClick={(e) => {
              e.stopPropagation();
              onOpenIncentiveTab?.('freed');
            }}
            role="region"
            aria-label={`${currentMonthNum}월 수당 적립 요약`}
          >
            <div className="scb-inc-left">
              <span className="scb-inc-badge">{currentMonthNum}월 수당적립</span>
              <span className="scb-inc-total">
                {hideAmounts ? (
                  '••••••원'
                ) : (
                  <>
                    +<SpringNumberFlow value={monthlyIncentiveSummary.grandTotalIncentive} suffix="원" />
                  </>
                )}
              </span>
            </div>

            <div className="scb-inc-pills">
              <button
                type="button"
                className="scb-inc-chip"
                style={
                  isDark
                    ? {
                        background: 'rgba(245,158,11,0.18)',
                        borderColor: 'rgba(251,191,36,0.45)',
                        color: '#FDE68A',
                      }
                    : {
                        background: '#FFFBEB',
                        borderColor: '#FCD34D',
                        color: '#92400E',
                      }
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGiftCardModal?.();
                }}
                title="클릭하여 구독·올케어 상품권 시상 내역 보기"
              >
                🎁 상품권시상
                {!hideAmounts &&
                  ` +${formatShortManwon(
                    currentMonthGiftCardReport?.totalGiftCardAmount || 0
                  )}`}
              </button>

              <button
                type="button"
                className="scb-inc-chip is-sub"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIncentiveTab?.('sales');
                }}
              >
                구독 {monthlyIncentiveSummary.grossSubscriptionCount}건
              </button>

              <button
                type="button"
                className="scb-inc-chip is-allcare"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIncentiveTab?.('sales');
                }}
              >
                올케어 {currentMonthAllCareCount}건
              </button>

              <button
                type="button"
                className="scb-inc-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIncentiveTab?.('freed');
                }}
              >
                프리드 {monthlyIncentiveSummary.freedSummary.totalCount}건
                {!hideAmounts && ` (+${formatShortManwon(monthlyIncentiveSummary.freedSummary.totalIncentive)})`}
              </button>

              <button
                type="button"
                className="scb-inc-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIncentiveTab?.('models');
                }}
              >
                모델수당 {monthlyIncentiveSummary.matchedModelUnitCount}대
                {!hideAmounts && ` (+${formatShortManwon(monthlyIncentiveSummary.modelIncentiveTotal)})`}
              </button>

              <button
                type="button"
                className="scb-inc-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIncentiveTab?.('sales');
                }}
              >
                {hideAmounts
                  ? '총판·실판 상세 ›'
                  : `총판 ${formatShortManwon(monthlyIncentiveSummary.grossSalesTotal)} · 실판 ${formatShortManwon(monthlyIncentiveSummary.netDeliverySalesTotal)} ›`}
              </button>
            </div>
          </div>

          {!hideScheduleSection && (
            <div className="scb-week-grid" onClick={onOpenScheduleModal}>
              {trackDays.map((item) => {
                const stateText = !item.isRegistered
                  ? '미등록'
                  : item.code === 'O'
                  ? '휴무'
                  : item.code || '출근';
                return (
                  <div
                    key={item.offset}
                    className={`scb-day-cell ${item.isToday ? 'is-today' : item.isOff ? 'is-off' : ''}`}
                  >
                    <span className="scb-day-top">
                      {item.isToday ? '오늘' : `${item.dayNum}(${item.weekday})`}
                    </span>
                    <span className="scb-day-dot" aria-hidden="true" />
                    <span className="scb-day-code">{stateText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
