import React, { useEffect, useMemo, useState } from 'react';
import { DayScheduleCode, extractDynamicStaffRoster, getOrCreateMonthSchedule, GWANGJU_STAFF_ROSTER, isOffDayCode, loadAllSchedules, loadSavedUserName, SCHEDULE_UPDATED_EVENT, SchedulesMap } from './ScheduleModal';
import { CustomerItem, SettlementTabId } from '../crm/types/crm';
import { CRM_CUSTOMERS_UPDATED_EVENT, getCachedCustomers } from '../crm/services/gasApi';
import { ALLCARE_COUNT_UPDATED_EVENT, computeMonthlySettlementReport, getCurrentYearMonth, getMonthlyAllCareCount, hydrateModelIncentiveSheetsFromIdb, hydrateMonthlyAllCareCountsFromIdb, loadAllModelIncentiveSheets, loadAllMonthlyAllCareCounts, MODEL_INCENTIVE_UPDATED_EVENT } from '../crm/utils/settlementEngine';
import { ScheduleCharacterBannerView } from './ScheduleCharacterBannerView';
interface ScheduleCharacterBannerProps {
 onOpenScheduleModal: () => void;
 isDark?: boolean;
 overrideNow?: Date;
 customers?: CustomerItem[];
 settlementCustomers?: CustomerItem[];
 onOpenIncentiveTab?: (tab: SettlementTabId) => void;
 hideScheduleSection?: boolean;
}
type HolidayContext = 'unset' | 'no-schedule' | 'holiday-today' | 'holiday-eve' | 'post-holiday' | 'normal-work';
type FaceExpressionId = 'cool-sunglasses' | 'star-party' | 'moon-peace' | 'coffee-sleepy' | 'focus-spark' | 'lunch-zzz' | 'sweat-hustle' | 'closing-blush' | 'eve-wink';
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;
const SHIFT_START_MIN = 10 * 60;
const SHIFT_END_MIN = 20 * 60;
const SHIFT_TOTAL_MIN = SHIFT_END_MIN - SHIFT_START_MIN;
function getEmployeeCodeForDate(schedules: SchedulesMap, userName: string, date: Date): DayScheduleCode {
 if (!userName) return '';
 const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
 const monthSchedule = getOrCreateMonthSchedule(schedules, ym);
 const emp = monthSchedule.employees.find((e) => e.name === userName) || monthSchedule.employees.find((e) => e.name.includes(userName));
 return emp ? emp.days[String(date.getDate())] || '' : '';
}
function formatRemainHm(mins: number): string {
 const safe = Math.max(0, Math.round(mins));
 const h = Math.floor(safe / 60);
 const m = safe % 60;
 return h <= 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
export const ScheduleCharacterBanner: React.FC<ScheduleCharacterBannerProps> = ({ onOpenScheduleModal, isDark: isDarkProp, overrideNow, customers: customersProp, settlementCustomers: settlementCustomersProp, onOpenIncentiveTab, hideScheduleSection = false }) => {
 const [userName, setUserName] = useState<string>(() => hideScheduleSection ? '' : loadSavedUserName());
 const [schedules, setSchedules] = useState<SchedulesMap>(() => hideScheduleSection ? {} : loadAllSchedules());
 const [now, setNow] = useState<Date>(() => overrideNow || new Date());
 const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
 const [domDark, setDomDark] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') === 'dark' : false);
 const [localCustomers, setLocalCustomers] = useState<CustomerItem[]>(() => getCachedCustomers());
 const [incentiveSheets, setIncentiveSheets] = useState(() => loadAllModelIncentiveSheets());
 const [allCareCountsMap, setAllCareCountsMap] = useState(() => loadAllMonthlyAllCareCounts());
 const isDark = isDarkProp ?? domDark;
 useEffect(() => {
  if (overrideNow) { setNow(overrideNow); return; }
  const timer = window.setInterval(() => setNow(new Date()), 15000);
  return () => window.clearInterval(timer);
 }, [overrideNow]);
 useEffect(() => {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  const obs = new MutationObserver(() => setDomDark(document.documentElement.getAttribute('data-theme') === 'dark'));
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
 }, []);
 useEffect(() => {
  hydrateModelIncentiveSheetsFromIdb().then((loaded) => { if (Object.keys(loaded).length > 0) setIncentiveSheets(loaded); });
  hydrateMonthlyAllCareCountsFromIdb().then((loadedAllCare) => { if (Object.keys(loadedAllCare).length > 0) setAllCareCountsMap(loadedAllCare); });
  const refreshSchedule = () => { setUserName(loadSavedUserName()); setSchedules(loadAllSchedules()); };
  const refreshIncentives = () => { setLocalCustomers(getCachedCustomers()); setIncentiveSheets(loadAllModelIncentiveSheets()); setAllCareCountsMap(loadAllMonthlyAllCareCounts()); };
  const refreshStorage = () => { refreshSchedule(); refreshIncentives(); };
  window.addEventListener(SCHEDULE_UPDATED_EVENT, refreshSchedule);
  window.addEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshIncentives);
  window.addEventListener(MODEL_INCENTIVE_UPDATED_EVENT, refreshIncentives);
  window.addEventListener(ALLCARE_COUNT_UPDATED_EVENT, refreshIncentives);
  window.addEventListener('storage', refreshStorage);
  return () => {
   window.removeEventListener(SCHEDULE_UPDATED_EVENT, refreshSchedule);
   window.removeEventListener(CRM_CUSTOMERS_UPDATED_EVENT, refreshIncentives);
   window.removeEventListener(MODEL_INCENTIVE_UPDATED_EVENT, refreshIncentives);
   window.removeEventListener(ALLCARE_COUNT_UPDATED_EVENT, refreshIncentives);
   window.removeEventListener('storage', refreshStorage);
  };
 }, []);
 const effectiveCustomers = customersProp ?? localCustomers;
 const currentYm = useMemo(() => getCurrentYearMonth(now), [now]);
 const currentMonthNum = now.getMonth() + 1;
 useEffect(() => {
  if (!hideScheduleSection) { setUserName(loadSavedUserName()); setSchedules(loadAllSchedules()); }
  else setIsPickerOpen(false);
 }, [hideScheduleSection]);
 const effectiveSettlementCustomers = settlementCustomersProp ?? effectiveCustomers;
 const monthlyIncentiveSummary = useMemo(() => {
  const activeList = (effectiveSettlementCustomers || []).filter((c) => !c.deletedAt);
  return computeMonthlySettlementReport(activeList, currentYm, incentiveSheets[currentYm] || null, 'contract');
 }, [effectiveSettlementCustomers, incentiveSheets, currentYm]);
 const currentMonthAllCareCount = useMemo(() => getMonthlyAllCareCount(currentYm, allCareCountsMap), [currentYm, allCareCountsMap]);
 const dynamicRoster = useMemo(() => {
  const extracted = extractDynamicStaffRoster(schedules);
  return extracted.length > 0 ? extracted : GWANGJU_STAFF_ROSTER;
 }, [schedules]);
 const userRole = useMemo(() => {
  if (!userName) return '';
  return dynamicRoster.find((r) => r.name === userName)?.role || '';
 }, [userName, dynamicRoster]);
 const trackDays = useMemo(() => {
  const list: { offset: number; date: Date; dayNum: number; weekday: string; code: DayScheduleCode; isOff: boolean; isToday: boolean; isRegistered: boolean }[] = [];
  for (let offset = -2; offset <= 4; offset++) {
   const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
   const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
   const code = getEmployeeCodeForDate(schedules, userName, d);
   list.push({ offset, date: d, dayNum: d.getDate(), weekday: WEEKDAY_KO[d.getDay()], code, isOff: isOffDayCode(code), isToday: offset === 0, isRegistered: Boolean(schedules[ym] && schedules[ym].isRegistered !== false) });
  }
  return list;
 }, [schedules, now, userName]);
 const nextOffInfo = useMemo(() => {
  if (!userName) return { days: null as number | null, dateLabel: '' };
  for (let i = 1; i <= 35; i++) {
   const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
   if (isOffDayCode(getEmployeeCodeForDate(schedules, userName, target))) {
    return { days: i, dateLabel: `${String(target.getMonth() + 1).padStart(2, '0')}.${String(target.getDate()).padStart(2, '0')}(${WEEKDAY_KO[target.getDay()]})` };
   }
  }
  return { days: null, dateLabel: '' };
 }, [schedules, now, userName]);
 const todayCode = useMemo(() => getEmployeeCodeForDate(schedules, userName, now), [schedules, userName, now]);
 const holidayCtx: HolidayContext = useMemo(() => {
  if (!userName) return 'unset';
  if (!Boolean(schedules[currentYm] && schedules[currentYm].isRegistered !== false) && nextOffInfo.days === null) return 'no-schedule';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isOffDayCode(todayCode)) return 'holiday-today';
  if (isOffDayCode(getEmployeeCodeForDate(schedules, userName, tomorrow))) return 'holiday-eve';
  if (isOffDayCode(getEmployeeCodeForDate(schedules, userName, yesterday))) return 'post-holiday';
  return 'normal-work';
 }, [currentYm, nextOffInfo.days, schedules, now, todayCode, userName]);
 const leftSummary = useMemo(() => {
  const dNum = nextOffInfo.days;
  if (holidayCtx === 'unset') return { ringLabel: 'MY ID', ringValue: '선택', ringPct: 25, ringColor: isDark ? '#60A5FA' : '#1B64DA', headline: '내 이름을 한 번만 선택해 주세요', subline: '이름 선택 즉시 내 휴무일과 출퇴근 기분이 작동합니다' };
  if (holidayCtx === 'no-schedule') return { ringLabel: 'UPLOAD', ringValue: '미등록', ringPct: 18, ringColor: '#F59E0B', headline: '이번 달 휴무표 등록이 필요합니다', subline: '터치하여 엑셀 또는 사진으로 1회 업로드해 주세요 ›' };
  if (holidayCtx === 'holiday-today') return { ringLabel: 'TODAY', ringValue: 'OFF', ringPct: 100, ringColor: '#059669', headline: `오늘은 ${userName} 님의 꿀휴무일입니다!`, subline: nextOffInfo.dateLabel ? `다음 휴무 예정: ${nextOffInfo.dateLabel} · 전체 휴무표 보기 ›` : '재충전 가득한 하루 보내세요 · 전체 휴무표 보기 ›' };
  if (holidayCtx === 'holiday-eve') return { ringLabel: 'NEXT OFF', ringValue: 'D-1', ringPct: 88, ringColor: '#E60012', headline: `내일(${nextOffInfo.dateLabel}) 드디어 휴무입니다!`, subline: '오늘 하루만 지나면 꿀휴무 · 전체 월간표 보기 ›' };
  const pct = dNum ? Math.max(16, Math.min(82, Math.round(((7 - Math.min(6, dNum)) / 7) * 100))) : 35;
  return {
   ringLabel: 'NEXT OFF', ringValue: dNum ? `D-${dNum}` : '근무', ringPct: pct, ringColor: isDark ? '#60A5FA' : '#1B64DA',
   headline: nextOffInfo.dateLabel ? `다음 휴무는 ${nextOffInfo.dateLabel}입니다` : `${userName} 님 이번 달 근무 스케줄`,
   subline: todayCode === '반차' ? '오늘 반차 일정 · 터치하여 전체 월간표 보기 ›' : (todayCode === '교육' || todayCode === '회의' ? `오늘 ${todayCode} 일정 · 터치하여 전체 월간표 보기 ›` : '오늘 정상근무 (10:00–20:00) · 전체 월간표 보기 ›'),
  };
 }, [holidayCtx, isDark, nextOffInfo, todayCode, userName]);
 const liveMood = useMemo(() => {
  const curMin = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (holidayCtx === 'holiday-today') return { face: 'cool-sunglasses' as FaceExpressionId, pillText: `휴무일 힐링 모드 · ${timeStr}`, pillTone: 'emerald', moodTitle: curMin < 720 ? '출근 알람 걱정 없는 달콤한 휴무 오전!' : curMin < 1140 ? '매장 생각은 잠시 OFF! 행복한 재충전 시간' : '남은 휴무 밤도 여유롭게 힐링!', progressPct: 100, progressLabel: '휴무 충전 게이지 100%' };
  if (curMin >= SHIFT_END_MIN || curMin < 8 * 60 + 30) {
   if (holidayCtx === 'holiday-eve' && curMin >= SHIFT_END_MIN) return { face: 'star-party' as FaceExpressionId, pillText: `칼퇴 완료 × 내일 휴무! · ${timeStr}`, pillTone: 'amber', moodTitle: '8시 마감 끝 + 내일 휴무!! 최고의 전야제 시작!', progressPct: 100, progressLabel: '오늘 근무 100% 완주 · 내일 OFF' };
   return { face: 'moon-peace' as FaceExpressionId, pillText: `20:00 퇴근 완료 · ${timeStr}`, pillTone: 'sky', moodTitle: '오늘도 8시 마감까지 고생 많으셨어요! 꿀휴식 시간', progressPct: 100, progressLabel: '10:00–20:00 오늘 근무 100% 완료' };
  }
  if (curMin < SHIFT_START_MIN) {
   const minsLeft = SHIFT_START_MIN - curMin;
   if (holidayCtx === 'post-holiday') return { face: 'coffee-sleepy' as FaceExpressionId, pillText: `10시 오픈 ${minsLeft}분 전 · ${timeStr}`, pillTone: 'bronze', moodTitle: '어제 휴무 후유증은 진한 모닝커피로 수혈 중…', progressPct: 0, progressLabel: `10:00 출근 대기 (${minsLeft}분 전)` };
   if (holidayCtx === 'holiday-eve') return { face: 'eve-wink' as FaceExpressionId, pillText: `오픈 ${minsLeft}분 전 · 내일 휴무!`, pillTone: 'amber', moodTitle: '오늘 하루만 버티면 내일 쉰다! 가벼운 출근길', progressPct: 0, progressLabel: '10:00 출근 대기 (내일 꿀휴무)' };
   return { face: 'focus-spark' as FaceExpressionId, pillText: `10시 오픈 ${minsLeft}분 전 · ${timeStr}`, pillTone: 'bronze', moodTitle: '슬슬 매장 오픈 시동! 오늘도 기분 좋게 출발해요', progressPct: 0, progressLabel: `10:00 오픈까지 ${minsLeft}분 전` };
  }
  const elapsed = curMin - SHIFT_START_MIN;
  const remain = SHIFT_END_MIN - curMin;
  const pct = Math.max(2, Math.min(99, Math.round((elapsed / SHIFT_TOTAL_MIN) * 100)));
  const remLabel = formatRemainHm(remain);
  if (curMin >= 19 * 60 + 30) return { face: 'star-party' as FaceExpressionId, pillText: `8시 칼퇴 ${remain}분 전!! · ${pct}%`, pillTone: 'amber', moodTitle: holidayCtx === 'holiday-eve' ? `퇴근 ${remain}분 전 + 내일 휴무!!` : `마감 카운트다운 돌입! 8시 퇴근까지 단 ${remain}분!`, progressPct: pct, progressLabel: `10:00 ➔ 20:00 (${pct}% · ${remain}분 남음)` };
  if (curMin >= 17 * 60 + 30) return { face: 'closing-blush' as FaceExpressionId, pillText: `퇴근 ${remLabel} 전 · ${pct}%`, pillTone: 'emerald', moodTitle: holidayCtx === 'holiday-eve' ? `퇴근 ${remLabel} 뒤면 휴무 전야제!` : `고지가 눈앞에! 8시 퇴근까지 ${remLabel} 남았어요`, progressPct: pct, progressLabel: `10:00 ➔ 20:00 (${pct}% 돌파)` };
  if (curMin >= 14 * 60 + 30) {
   if (holidayCtx === 'holiday-eve') return { face: 'eve-wink' as FaceExpressionId, pillText: `내일 휴무 버프 · ${pct}%`, pillTone: 'amber', moodTitle: `내일 쉰다는 생각에 오후도 거뜬! (퇴근 -${remLabel})`, progressPct: pct, progressLabel: `10:00 ➔ 20:00 (${pct}% 진행)` };
   return { face: 'sweat-hustle' as FaceExpressionId, pillText: `오후 피크 열일 중 · ${pct}%`, pillTone: 'bronze', moodTitle: `오후 타임 순항 중! 8시 퇴근까지 ${remLabel} 남음`, progressPct: pct, progressLabel: `10:00 ➔ 20:00 (${pct}% 진행)` };
  }
  if (curMin >= 12 * 60) return { face: 'lunch-zzz' as FaceExpressionId, pillText: curMin >= 800 ? `식곤증 주의보 · ${pct}%` : `점심 충전 타임 · ${pct}%`, pillTone: 'bronze', moodTitle: curMin >= 800 ? '시원한 커피 한 잔으로 오후 리프레시!' : '든든하게 밥심 채우고 오후 맞이', progressPct: pct, progressLabel: `10:00 ➔ 20:00 (${pct}% · 퇴근 -${remLabel})` };
  if (holidayCtx === 'post-holiday') return { face: 'coffee-sleepy' as FaceExpressionId, pillText: `휴무 복귀 오전 · ${pct}%`, pillTone: 'bronze', moodTitle: '커피 수혈하며 재부팅 중!', progressPct: pct, progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})` };
  if (holidayCtx === 'holiday-eve') return { face: 'eve-wink' as FaceExpressionId, pillText: `휴무 D-1 오픈 · ${pct}%`, pillTone: 'amber', moodTitle: '10시 오픈 완료! 오늘만 끝내면 내일 꿀휴무!', progressPct: pct, progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})` };
  return { face: 'focus-spark' as FaceExpressionId, pillText: `10시 오픈 스타트 · ${pct}%`, pillTone: 'bronze', moodTitle: '상쾌한 오전 오픈! 오늘 하루도 대박 실적 응원해요', progressPct: pct, progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})` };
 }, [holidayCtx, now]);
 const renderAnimatedMoodFace = (expr: FaceExpressionId) => (
  <div className="scb-face-orb" aria-hidden="true">
   <svg viewBox="0 0 64 64" width="54" height="54">
    <defs>
     <radialGradient id="scbFaceSkin" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#FFF3B0"/><stop offset="55%" stopColor="#FCD34D"/><stop offset="100%" stopColor="#F59E0B"/></radialGradient>
    </defs>
    <g className={expr === 'star-party' || expr === 'closing-blush' ? 'scb-anim-excited' : 'scb-anim-breathe'}>
     <circle cx="32" cy="33" r="24" fill="url(#scbFaceSkin)"/>
     <ellipse cx="23" cy="20" rx="8" ry="4.5" transform="rotate(-24 23 20)" fill="#FFFFFF" opacity="0.45"/>
     {expr === 'cool-sunglasses' ? (<><rect x="13" y="24" width="17" height="11" rx="4" fill="#0F172A"/><rect x="34" y="24" width="17" height="11" rx="4" fill="#0F172A"/><rect x="29" y="26" width="6" height="3" fill="#0F172A"/><path d="M23 42 Q32 50 41 42" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" fill="none"/></>) : (<><circle cx="22" cy="29" r="3.6" fill="#451A03"/><circle cx="23.2" cy="27.6" r="1.4" fill="#FFFFFF"/><circle cx="42" cy="29" r="3.6" fill="#451A03"/><circle cx="43.2" cy="27.6" r="1.4" fill="#FFFFFF"/><circle cx="18" cy="37" r="4" fill="#FB7185" opacity="0.42"/><circle cx="46" cy="37" r="4" fill="#FB7185" opacity="0.42"/><path d="M24 41 Q32 48 40 41" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none"/></>)}
    </g>
   </svg>
  </div>
 );
 const pillColorStyle = useMemo(() => {
  if (liveMood.pillTone === 'emerald') return isDark ? { background: 'rgba(16,185,129,0.18)', color: '#34D399' } : { background: '#ECFDF5', color: '#047857' };
  if (liveMood.pillTone === 'amber') return isDark ? { background: 'rgba(245,158,11,0.2)', color: '#FBBF24' } : { background: '#FEF3C7', color: '#B45309' };
  if (liveMood.pillTone === 'sky') return isDark ? { background: 'rgba(96,165,250,0.18)', color: '#60A5FA' } : { background: '#EFF6FF', color: '#1B64DA' };
  return isDark ? { background: 'rgba(255,255,255,0.08)', color: '#E2E8F0' } : { background: '#F2F4F6', color: '#191F28' };
 }, [isDark, liveMood.pillTone]);
 const BANNER_EXPANDED_STORAGE_KEY = 'himart_home_banner_expanded_v1';
 const [isExpanded, setIsExpandedState] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true;
  try {
   const saved = localStorage.getItem(BANNER_EXPANDED_STORAGE_KEY);
   if (saved === '0') return false;
   if (saved === '1') return true;
  } catch {}
  return true;
 });
 const setIsExpanded = (updater: boolean | ((prev: boolean) => boolean)) => {
  setIsExpandedState((prev) => {
   const next = typeof updater === 'function' ? updater(prev) : updater;
   try { localStorage.setItem(BANNER_EXPANDED_STORAGE_KEY, next ? '1' : '0'); } catch {}
   return next;
  });
 };
 const [hideAmounts, setHideAmounts] = useState<boolean>(() => typeof window !== 'undefined' && localStorage.getItem('himart_hide_home_incentive_amounts') === '1');
 const toggleHideAmounts = (e: React.MouseEvent) => {
  e.stopPropagation();
  setHideAmounts((prev) => {
   const next = !prev;
   try { localStorage.setItem('himart_hide_home_incentive_amounts', next ? '1' : '0'); } catch {}
   return next;
  });
 };
 return <ScheduleCharacterBannerView ctx={{ currentMonthAllCareCount, currentMonthNum, dynamicRoster, hideAmounts, hideScheduleSection, isDark, isExpanded, isPickerOpen, leftSummary, liveMood, monthlyIncentiveSummary, onOpenIncentiveTab, onOpenScheduleModal, pillColorStyle, renderAnimatedMoodFace, setIsExpanded, setIsPickerOpen, setUserName, toggleHideAmounts, trackDays, userName, userRole }}/>;
};
