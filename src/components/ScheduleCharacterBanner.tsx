import React, { useEffect, useMemo, useState } from 'react';
import {
  DayScheduleCode,
  getOrCreateMonthSchedule,
  GWANGJU_STAFF_ROSTER,
  isOffDayCode,
  loadAllSchedules,
  loadSavedUserName,
  saveUserName,
  SCHEDULE_UPDATED_EVENT,
  SchedulesMap,
} from './ScheduleModal';

interface ScheduleCharacterBannerProps {
  onOpenScheduleModal: () => void;
  isDark?: boolean;
  /** Optional clock override for live preview/testing; defaults to real-time system clock */
  overrideNow?: Date;
}

type HolidayContext =
  | 'unset'
  | 'no-schedule'
  | 'holiday-today'
  | 'holiday-eve'
  | 'post-holiday'
  | 'normal-work';

type FaceExpressionId =
  | 'cool-sunglasses' // 휴무 당일 (선글라스 + 콧노래 음표)
  | 'star-party' // 퇴근 완료 + 내일 휴무 전야제 / 마감 30분 전 초흥분
  | 'moon-peace' // 20:00 이후 칼퇴 완료 힐링 미소
  | 'coffee-sleepy' // 출근 전(08:30~10:00) 또는 휴무 다음날 오전 모닝커피 수혈
  | 'focus-spark' // 10:00~12:00 활기찬 오픈 스타트
  | 'lunch-zzz' // 12:00~14:30 점심 충전 & 나른 식곤증
  | 'sweat-hustle' // 14:30~17:30 오후 열일 버티기
  | 'closing-blush' // 17:30~19:30 퇴근 가시권 발그레 설렘
  | 'eve-wink'; // 내일 휴무 D-1 근무 중 신나는 윙크

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;
const SHIFT_START_MIN = 10 * 60; // 10:00 (600분)
const SHIFT_END_MIN = 20 * 60; // 20:00 (1200분)
const SHIFT_TOTAL_MIN = SHIFT_END_MIN - SHIFT_START_MIN; // 600분 (10시간)

function getEmployeeCodeForDate(
  schedules: SchedulesMap,
  userName: string,
  date: Date
): DayScheduleCode {
  if (!userName) return '';
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const monthSchedule = getOrCreateMonthSchedule(schedules, ym);
  const emp =
    monthSchedule.employees.find((e) => e.name === userName) ||
    monthSchedule.employees.find((e) => e.name.includes(userName));
  if (!emp) return '';
  return emp.days[String(date.getDate())] || '';
}

function formatRemainHm(mins: number): string {
  const safe = Math.max(0, Math.round(mins));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h <= 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export const ScheduleCharacterBanner: React.FC<ScheduleCharacterBannerProps> = ({
  onOpenScheduleModal,
  isDark: isDarkProp,
  overrideNow,
}) => {
  const [userName, setUserName] = useState<string>(() => loadSavedUserName());
  const [schedules, setSchedules] = useState<SchedulesMap>(() => loadAllSchedules());
  const [now, setNow] = useState<Date>(() => overrideNow || new Date());
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [domDark, setDomDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'dark'
      : false
  );

  const isDark = isDarkProp ?? domDark;

  // 실시간 시계 동기화 (15초 주기 자동 갱신 - 출근 10:00 ~ 퇴근 20:00 기분 실시간 반영)
  useEffect(() => {
    if (overrideNow) {
      setNow(overrideNow);
      return;
    }
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [overrideNow]);

  // 테마 변경 감지 폴백
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setDomDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // 휴무표 업데이트 이벤트 동기화
  useEffect(() => {
    const refresh = () => {
      setUserName(loadSavedUserName());
      setSchedules(loadAllSchedules());
    };
    window.addEventListener(SCHEDULE_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SCHEDULE_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // 직원 직무(파트) 조회
  const userRole = useMemo(() => {
    if (!userName) return '';
    const found = GWANGJU_STAFF_ROSTER.find((r) => r.name === userName);
    return found ? found.role : '';
  }, [userName]);

  // 오늘 중심 7일 캡슐 트랙 (-2일 ~ +4일)
  const trackDays = useMemo(() => {
    const list: {
      offset: number;
      date: Date;
      dayNum: number;
      weekday: string;
      code: DayScheduleCode;
      isOff: boolean;
      isToday: boolean;
      isRegistered: boolean;
    }[] = [];

    for (let offset = -2; offset <= 4; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const isRegistered = Boolean(schedules[ym] && schedules[ym].isRegistered !== false);
      const code = getEmployeeCodeForDate(schedules, userName, d);
      list.push({
        offset,
        date: d,
        dayNum: d.getDate(),
        weekday: WEEKDAY_KO[d.getDay()],
        code,
        isOff: isOffDayCode(code),
        isToday: offset === 0,
        isRegistered,
      });
    }
    return list;
  }, [schedules, now, userName]);

  // 다음 휴무일 및 남은 일수(D-Day) 탐색 (최대 35일)
  const nextOffInfo = useMemo(() => {
    if (!userName) return { days: null as number | null, dateLabel: '' };
    for (let i = 1; i <= 35; i++) {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const code = getEmployeeCodeForDate(schedules, userName, target);
      if (isOffDayCode(code)) {
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        const w = WEEKDAY_KO[target.getDay()];
        return { days: i, dateLabel: `${m}.${d}(${w})` };
      }
    }
    return { days: null, dateLabel: '' };
  }, [schedules, now, userName]);

  const todayCode = useMemo(
    () => getEmployeeCodeForDate(schedules, userName, now),
    [schedules, userName, now]
  );

  // 휴무 컨텍스트 판별
  const holidayCtx: HolidayContext = useMemo(() => {
    if (!userName) return 'unset';
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonthRegistered = Boolean(
      schedules[currentYm] && schedules[currentYm].isRegistered !== false
    );
    if (!isCurrentMonthRegistered && nextOffInfo.days === null) {
      return 'no-schedule';
    }

    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    if (isOffDayCode(todayCode)) return 'holiday-today';
    if (isOffDayCode(getEmployeeCodeForDate(schedules, userName, tomorrow))) return 'holiday-eve';
    if (isOffDayCode(getEmployeeCodeForDate(schedules, userName, yesterday))) return 'post-holiday';
    return 'normal-work';
  }, [nextOffInfo.days, schedules, now, todayCode, userName]);

  // 좌측 Apple Dynamic Bento D-Day 링 데이터
  const leftSummary = useMemo(() => {
    const dNum = nextOffInfo.days;
    if (holidayCtx === 'unset') {
      return {
        ringLabel: 'MY ID',
        ringValue: '선택',
        ringPct: 25,
        ringColor: isDark ? '#38BDF8' : '#8C5A32',
        headline: '내 이름을 한 번만 선택해 주세요',
        subline: '이름 선택 즉시 내 휴무일과 출퇴근 기분이 작동합니다',
      };
    }
    if (holidayCtx === 'no-schedule') {
      return {
        ringLabel: 'UPLOAD',
        ringValue: '미등록',
        ringPct: 18,
        ringColor: '#F59E0B',
        headline: '이번 달 휴무표 등록이 필요합니다',
        subline: '터치하여 엑셀 또는 사진으로 1회 업로드해 주세요 ›',
      };
    }
    if (holidayCtx === 'holiday-today') {
      return {
        ringLabel: 'TODAY',
        ringValue: 'OFF',
        ringPct: 100,
        ringColor: '#10B981',
        headline: `오늘은 ${userName} 님의 꿀휴무일입니다!`,
        subline: nextOffInfo.dateLabel
          ? `다음 휴무 예정: ${nextOffInfo.dateLabel} · 전체 휴무표 보기 ›`
          : '재충전 가득한 하루 보내세요 · 전체 휴무표 보기 ›',
      };
    }
    if (holidayCtx === 'holiday-eve') {
      return {
        ringLabel: 'NEXT OFF',
        ringValue: 'D-1',
        ringPct: 88,
        ringColor: '#F59E0B',
        headline: `내일(${nextOffInfo.dateLabel}) 드디어 휴무입니다!`,
        subline: '오늘 하루만 지나면 꿀휴무 · 전체 월간표 보기 ›',
      };
    }
    const pct = dNum ? Math.max(16, Math.min(82, Math.round(((7 - Math.min(6, dNum)) / 7) * 100))) : 35;
    return {
      ringLabel: 'NEXT OFF',
      ringValue: dNum ? `D-${dNum}` : '근무',
      ringPct: pct,
      ringColor: isDark ? '#38BDF8' : '#8C5A32',
      headline: nextOffInfo.dateLabel
        ? `다음 휴무는 ${nextOffInfo.dateLabel}입니다`
        : `${userName} 님 이번 달 근무 스케줄`,
      subline:
        todayCode === '반차'
          ? '오늘 반차 일정 · 터치하여 전체 월간표 보기 ›'
          : todayCode === '교육' || todayCode === '회의'
          ? `오늘 ${todayCode} 일정 · 터치하여 전체 월간표 보기 ›`
          : '오늘 정상근무 (10:00–20:00) · 전체 월간표 보기 ›',
    };
  }, [holidayCtx, isDark, nextOffInfo, todayCode, userName]);

  // 우측 실시간(10:00 출근 ~ 20:00 퇴근 × 휴무 D-Day) 표정 이모티콘 & 기분 상태 엔진
  const liveMood = useMemo(() => {
    const curMin = now.getHours() * 60 + now.getMinutes();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    // 1) 오늘 내 휴무 당일 (종일 해피 오프 모드!)
    if (holidayCtx === 'holiday-today') {
      const msg =
        curMin < 720
          ? '출근 알람 걱정 없는 달콤한 휴무 오전!'
          : curMin < 1140
          ? '매장 생각은 잠시 OFF! 행복한 재충전 시간'
          : '푹 쉬셨나요? 남은 휴무 밤도 여유롭게 힐링!';
      return {
        face: 'cool-sunglasses' as FaceExpressionId,
        pillText: `휴무일 힐링 모드 · ${timeStr}`,
        pillTone: 'emerald',
        moodTitle: msg,
        progressPct: 100,
        progressLabel: '휴무 충전 게이지 100%',
      };
    }

    // 2) 퇴근 시간 이후 (20:00 ~ 자정 또는 00:00 ~ 08:29)
    if (curMin >= SHIFT_END_MIN || curMin < 8 * 60 + 30) {
      if (holidayCtx === 'holiday-eve' && curMin >= SHIFT_END_MIN) {
        return {
          face: 'star-party' as FaceExpressionId,
          pillText: `칼퇴 완료 × 내일 휴무! · ${timeStr}`,
          pillTone: 'amber',
          moodTitle: '8시 마감 끝 + 내일 휴무!! 최고의 전야제 시작!',
          progressPct: 100,
          progressLabel: '오늘 근무 100% 완주 · 내일 OFF',
        };
      }
      return {
        face: 'moon-peace' as FaceExpressionId,
        pillText: `20:00 퇴근 완료 · ${timeStr}`,
        pillTone: 'sky',
        moodTitle: '오늘도 8시 마감까지 고생 많으셨어요! 꿀휴식 시간',
        progressPct: 100,
        progressLabel: '10:00–20:00 오늘 근무 100% 완료',
      };
    }

    // 3) 출근 준비 구간 (08:30 ~ 09:59)
    if (curMin < SHIFT_START_MIN) {
      const minsLeft = SHIFT_START_MIN - curMin;
      if (holidayCtx === 'post-holiday') {
        return {
          face: 'coffee-sleepy' as FaceExpressionId,
          pillText: `10시 오픈 ${minsLeft}분 전 · ${timeStr}`,
          pillTone: 'bronze',
          moodTitle: '어제 휴무 후유증은 진한 모닝커피로 수혈 중…',
          progressPct: 0,
          progressLabel: `10:00 출근 대기 (${minsLeft}분 전)`,
        };
      }
      if (holidayCtx === 'holiday-eve') {
        return {
          face: 'eve-wink' as FaceExpressionId,
          pillText: `오픈 ${minsLeft}분 전 · 내일 휴무!`,
          pillTone: 'amber',
          moodTitle: '오늘 하루만 버티면 내일 쉰다! 가벼운 출근길',
          progressPct: 0,
          progressLabel: `10:00 출근 대기 (내일 꿀휴무)`,
        };
      }
      return {
        face: 'focus-spark' as FaceExpressionId,
        pillText: `10시 오픈 ${minsLeft}분 전 · ${timeStr}`,
        pillTone: 'bronze',
        moodTitle: '슬슬 매장 오픈 시동! 오늘도 기분 좋게 출발해요',
        progressPct: 0,
        progressLabel: `10:00 오픈까지 ${minsLeft}분 전`,
      };
    }

    // === 근무 시간 중 (10:00 ~ 19:59) 실시간 진행률 & 퇴근 잔여시간 계산 ===
    const elapsed = curMin - SHIFT_START_MIN;
    const remain = SHIFT_END_MIN - curMin;
    const pct = Math.max(2, Math.min(99, Math.round((elapsed / SHIFT_TOTAL_MIN) * 100)));
    const remLabel = formatRemainHm(remain);

    // 4) 마감 직전 30분 카운트다운! (19:30 ~ 19:59)
    if (curMin >= 19 * 60 + 30) {
      return {
        face: 'star-party' as FaceExpressionId,
        pillText: `8시 칼퇴 ${remain}분 전!! · ${pct}%`,
        pillTone: 'amber',
        moodTitle:
          holidayCtx === 'holiday-eve'
            ? `퇴근 ${remain}분 전 + 내일 휴무!! 심장 바운스 최고조!`
            : `마감 카운트다운 돌입! 8시 퇴근까지 단 ${remain}분!`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (${pct}% · ${remain}분 남음)`,
      };
    }

    // 5) 저녁 퇴근 가시권 설렘 구간 (17:30 ~ 19:29)
    if (curMin >= 17 * 60 + 30) {
      return {
        face: 'closing-blush' as FaceExpressionId,
        pillText: `퇴근 ${remLabel} 전 · ${pct}%`,
        pillTone: 'emerald',
        moodTitle:
          holidayCtx === 'holiday-eve'
            ? `퇴근 ${remLabel} 뒤면 휴무 전야제! 입꼬리 자동 상승!`
            : `고지가 눈앞에! 8시 퇴근까지 ${remLabel} 남았어요`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (${pct}% 돌파)`,
      };
    }

    // 6) 오후 피크 열일 구간 (14:30 ~ 17:29)
    if (curMin >= 14 * 60 + 30) {
      if (holidayCtx === 'holiday-eve') {
        return {
          face: 'eve-wink' as FaceExpressionId,
          pillText: `내일 휴무 버프 · ${pct}%`,
          pillTone: 'amber',
          moodTitle: `내일 쉰다는 생각에 오후도 거뜬! (퇴근 -${remLabel})`,
          progressPct: pct,
          progressLabel: `10:00 ➔ 20:00 (${pct}% 진행)`,
        };
      }
      return {
        face: 'sweat-hustle' as FaceExpressionId,
        pillText: `오후 피크 열일 중 · ${pct}%`,
        pillTone: 'bronze',
        moodTitle:
          nextOffInfo.days && nextOffInfo.days >= 4
            ? `영차영차 절반 넘었다! 퇴근까지 ${remLabel} 버텨요`
            : `오후 타임 순항 중! 8시 퇴근까지 ${remLabel} 남음`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (${pct}% 진행)`,
      };
    }

    // 7) 점심 & 나른한 식곤증 구간 (12:00 ~ 14:29)
    if (curMin >= 12 * 60) {
      const isPostLunch = curMin >= 13 * 60 + 20;
      return {
        face: 'lunch-zzz' as FaceExpressionId,
        pillText: isPostLunch ? `식곤증 주의보 · ${pct}%` : `점심 충전 타임 · ${pct}%`,
        pillTone: 'bronze',
        moodTitle: isPostLunch
          ? `스르륵 눈꺼풀이 무거운 시간… 시원한 커피 한 잔!`
          : `금강산도 식후경! 든든하게 밥심 채우고 오후 맞이`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (${pct}% · 퇴근 -${remLabel})`,
      };
    }

    // 8) 오전 오픈 & 시동 구간 (10:00 ~ 11:59)
    if (holidayCtx === 'post-holiday') {
      return {
        face: 'coffee-sleepy' as FaceExpressionId,
        pillText: `휴무 복귀 오전 · ${pct}%`,
        pillTone: 'bronze',
        moodTitle: `어제 쉰 여운이 아른아른… 커피 수혈하며 재부팅 중!`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})`,
      };
    }
    if (holidayCtx === 'holiday-eve') {
      return {
        face: 'eve-wink' as FaceExpressionId,
        pillText: `휴무 D-1 오픈 · ${pct}%`,
        pillTone: 'amber',
        moodTitle: `10시 오픈 완료! 오늘만 끝내면 내일 꿀휴무!`,
        progressPct: pct,
        progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})`,
      };
    }
    return {
      face: 'focus-spark' as FaceExpressionId,
      pillText: `10시 오픈 스타트 · ${pct}%`,
      pillTone: 'bronze',
      moodTitle: `상쾌한 오전 오픈! 오늘 하루도 대박 실적 응원해요`,
      progressPct: pct,
      progressLabel: `10:00 ➔ 20:00 (퇴근까지 ${remLabel})`,
    };
  }, [holidayCtx, nextOffInfo.days, now]);

  // 상황별 살아 움직이는 커스텀 3D-Shaded 벡터 표정 캐릭터 렌더링
  const renderAnimatedMoodFace = (expr: FaceExpressionId) => {
    return (
      <div className="scb-face-orb" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="54" height="54">
          <defs>
            <radialGradient id="scbFaceSkin" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFF3B0" />
              <stop offset="55%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </radialGradient>
            <radialGradient id="scbCoolSkin" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="60%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>
          </defs>

          {/* Base Glossy 3D Sphere Face */}
          <g className={expr === 'star-party' || expr === 'closing-blush' ? 'scb-anim-excited' : 'scb-anim-breathe'}>
            <circle
              cx="32"
              cy="33"
              r="24"
              fill={expr === 'cool-sunglasses' ? 'url(#scbCoolSkin)' : 'url(#scbFaceSkin)'}
            />
            {/* Top-left Specular Highlight */}
            <ellipse cx="23" cy="20" rx="8" ry="4.5" transform="rotate(-24 23 20)" fill="#FFFFFF" opacity="0.45" />

            {/* 1. 휴무 당일: 선글라스 + 방긋 미소 + 음표 */}
            {expr === 'cool-sunglasses' && (
              <>
                <circle cx="19" cy="38" r="4" fill="#FB7185" opacity="0.45" />
                <circle cx="45" cy="38" r="4" fill="#FB7185" opacity="0.45" />
                <g className="scb-anim-groove">
                  <rect x="13" y="24" width="17" height="11" rx="4" fill="#0F172A" />
                  <rect x="34" y="24" width="17" height="11" rx="4" fill="#0F172A" />
                  <rect x="29" y="26" width="6" height="3" fill="#0F172A" />
                  <line x1="16" y1="27" x2="21" y2="32" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                  <line x1="37" y1="27" x2="42" y2="32" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                </g>
                <path d="M23 42 Q32 50 41 42" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                <text x="50" y="16" fontSize="13" fontWeight="900" fill="#10B981" className="scb-anim-note">♪</text>
              </>
            )}

            {/* 2. 마감 카운트다운 / 퇴근×휴무 전야제: 별 눈동자 + 환호 입 */}
            {expr === 'star-party' && (
              <>
                <circle cx="18" cy="38" r="4.5" fill="#F43F5E" opacity="0.5" />
                <circle cx="46" cy="38" r="4.5" fill="#F43F5E" opacity="0.5" />
                <path
                  d="M22 22 L23.8 26.2 L28.2 26.6 L24.8 29.5 L25.8 33.8 L22 31.4 L18.2 33.8 L19.2 29.5 L15.8 26.6 L20.2 26.2 Z"
                  fill="#B45309"
                  className="scb-anim-twinkle"
                />
                <path
                  d="M42 22 L43.8 26.2 L48.2 26.6 L44.8 29.5 L45.8 33.8 L42 31.4 L38.2 33.8 L39.2 29.5 L35.8 26.6 L40.2 26.2 Z"
                  fill="#B45309"
                  className="scb-anim-twinkle"
                />
                <path d="M23 40 H41 A9 9 0 0 1 23 40 Z" fill="#991B1B" />
                <ellipse cx="32" cy="45" rx="5" ry="2.8" fill="#FB7185" />
              </>
            )}

            {/* 3. 20:00 퇴근 완료: 평온한 힐링 눈웃음 + 초승달 */}
            {expr === 'moon-peace' && (
              <>
                <circle cx="19" cy="37" r="4" fill="#FB7185" opacity="0.4" />
                <circle cx="45" cy="37" r="4" fill="#FB7185" opacity="0.4" />
                <path d="M18 30 Q22 25 26 30" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M38 30 Q42 25 46 30" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M25 41 Q32 47 39 41" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path
                  d="M52 10 A7 7 0 1 0 58 18 A5.5 5.5 0 1 1 52 10 Z"
                  fill="#38BDF8"
                  className="scb-anim-note"
                />
              </>
            )}

            {/* 4. 출근 전 / 휴무 다음날 오전: 반쯤 감긴 눈 + 김 나는 커피컵 */}
            {expr === 'coffee-sleepy' && (
              <>
                <line x1="17" y1="28" x2="27" y2="28" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
                <circle cx="22" cy="30.5" r="2.3" fill="#78350F" />
                <line x1="37" y1="28" x2="47" y2="28" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
                <circle cx="42" cy="30.5" r="2.3" fill="#78350F" />
                <path d="M28 42 Q32 40 36 42" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                {/* Mini Coffee Mug */}
                <g transform="translate(42, 38)">
                  <rect x="0" y="4" width="14" height="13" rx="3" fill="#FFFFFF" stroke="#8C5A32" strokeWidth="2" />
                  <rect x="2" y="6" width="10" height="4" fill="#78350F" />
                  <path d="M14 7 H16 A2.5 2.5 0 0 1 16 13 H14" stroke="#8C5A32" strokeWidth="2" fill="none" />
                  <path d="M5 1 Q6 -3 5 -6" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" fill="none" className="scb-anim-steam" />
                  <path d="M10 1 Q11 -3 10 -6" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" fill="none" className="scb-anim-steam" />
                </g>
              </>
            )}

            {/* 5. 10시 오픈 스타트: 초롱초롱 깜빡이는 눈 + 반짝이 */}
            {expr === 'focus-spark' && (
              <>
                <g className="scb-anim-blink">
                  <ellipse cx="22" cy="29" rx="3.3" ry="4.2" fill="#451A03" />
                  <circle cx="23.2" cy="27.5" r="1.3" fill="#FFFFFF" />
                  <ellipse cx="42" cy="29" rx="3.3" ry="4.2" fill="#451A03" />
                  <circle cx="43.2" cy="27.5" r="1.3" fill="#FFFFFF" />
                </g>
                <circle cx="18" cy="37" r="3.6" fill="#FB7185" opacity="0.38" />
                <circle cx="46" cy="37" r="3.6" fill="#FB7185" opacity="0.38" />
                <path d="M25 40 Q32 46 39 40" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M52 12 L54 17 L59 19 L54 21 L52 26 L50 21 L45 19 L50 17 Z" fill="#F59E0B" className="scb-anim-twinkle" />
              </>
            )}

            {/* 6. 점심/식곤증 구간: 나른한 눈 + Zzz 방울 */}
            {expr === 'lunch-zzz' && (
              <>
                <path d="M18 31 Q22 34 26 31" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                <path d="M38 31 Q42 34 46 31" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                <circle cx="32" cy="42" r="3.5" fill="#991B1B" opacity="0.75" />
                <text x="46" y="18" fontSize="11" fontWeight="900" fill="#6366F1" className="scb-anim-steam">Zzz</text>
              </>
            )}

            {/* 7. 오후 열일 구간: 집중 눈썹 + 땀방울 송골 */}
            {expr === 'sweat-hustle' && (
              <>
                <line x1="17" y1="23" x2="26" y2="25" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="47" y1="23" x2="38" y2="25" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="22" cy="30" r="3.2" fill="#451A03" />
                <circle cx="42" cy="30" r="3.2" fill="#451A03" />
                <path d="M25 42 Q32 45 39 41" stroke="#78350F" strokeWidth="3" strokeLinecap="round" fill="none" />
                {/* Animated Blue Sweat Droplet */}
                <path
                  d="M50 17 C50 17 55 24 55 27 A5 5 0 1 1 45 27 C45 24 50 17 50 17 Z"
                  fill="#38BDF8"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  className="scb-anim-sweat"
                />
              </>
            )}

            {/* 8. 17:30~19:30 퇴근 가시권 설렘: 큰 반짝 눈 + 홍조 + 활짝 미소 */}
            {expr === 'closing-blush' && (
              <>
                <circle cx="17" cy="38" r="5" fill="#F43F5E" opacity="0.52" />
                <circle cx="47" cy="38" r="5" fill="#F43F5E" opacity="0.52" />
                <circle cx="22" cy="29" r="4.3" fill="#451A03" />
                <circle cx="23.5" cy="27.3" r="1.8" fill="#FFFFFF" />
                <circle cx="42" cy="29" r="4.3" fill="#451A03" />
                <circle cx="43.5" cy="27.3" r="1.8" fill="#FFFFFF" />
                <path d="M23 40 Q32 49 41 40" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" fill="none" />
              </>
            )}

            {/* 9. 휴무 전날(D-1) 근무 중 신나는 윙크 */}
            {expr === 'eve-wink' && (
              <>
                <circle cx="18" cy="38" r="4.5" fill="#FB7185" opacity="0.48" />
                <circle cx="46" cy="38" r="4.5" fill="#FB7185" opacity="0.48" />
                <circle cx="22" cy="29" r="3.6" fill="#451A03" />
                <circle cx="23.2" cy="27.6" r="1.4" fill="#FFFFFF" />
                <path d="M37 29 L45 26 M37 29 L45 32" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M23 40 Q32 48 41 40" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" fill="none" />
              </>
            )}
          </g>
        </svg>
      </div>
    );
  };

  const pillColorStyle = useMemo(() => {
    if (liveMood.pillTone === 'emerald') {
      return isDark
        ? { background: 'rgba(16,185,129,0.18)', color: '#34D399' }
        : { background: '#ECFDF5', color: '#047857' };
    }
    if (liveMood.pillTone === 'amber') {
      return isDark
        ? { background: 'rgba(245,158,11,0.2)', color: '#FBBF24' }
        : { background: '#FEF3C7', color: '#B45309' };
    }
    if (liveMood.pillTone === 'sky') {
      return isDark
        ? { background: 'rgba(56,189,248,0.18)', color: '#38BDF8' }
        : { background: '#E0F2FE', color: '#0369A1' };
    }
    return isDark
      ? { background: 'rgba(56,189,248,0.14)', color: '#7DD3FC' }
      : { background: '#F4ECE1', color: '#8C5A32' };
  }, [isDark, liveMood.pillTone]);

  return (
    <div
      className={`scb-root ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={onOpenScheduleModal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenScheduleModal();
        }
      }}
    >
      <style>{`
        .scb-root {
          width: 100%;
          border-radius: 24px;
          padding: 15px 16px;
          border: 1.5px solid #E4DFD5;
          background: #FFFFFF;
          color: #18181B;
          box-shadow: 0 2px 6px rgba(24,24,27,0.03), 0 10px 24px -6px rgba(24,24,27,0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          position: relative;
          transition: transform 160ms cubic-bezier(0.23,1,0.32,1), border-color 180ms ease, background-color 180ms ease;
        }
        .scb-root.is-dark {
          background: #141923;
          border-color: rgba(255,255,255,0.10);
          color: #F8FAFC;
          box-shadow: 0 14px 32px -8px rgba(0,0,0,0.45);
        }
        .scb-root:active {
          transform: scale(0.992);
        }
        @media (min-width: 640px) {
          .scb-root {
            padding: 18px 20px;
            gap: 14px;
          }
        }

        .scb-top-split {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: center;
        }
        @media (min-width: 640px) {
          .scb-top-split {
            grid-template-columns: 1.05fr 0.95fr;
            gap: 16px;
          }
        }

        /* Left D-Day Ring + User Meta */
        .scb-left-pane {
          display: flex;
          align-items: center;
          gap: 13px;
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
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.05;
        }
        .scb-root.is-dark .scb-ring-inner {
          background: #141923;
        }
        .scb-ring-lbl {
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.03em;
          opacity: 0.65;
        }
        .scb-ring-val {
          font-size: 14.5px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.04em;
        }

        .scb-user-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid rgba(140,90,50,0.22);
          background: #F4ECE1;
          color: #8C5A32;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 4px;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-user-pill {
          background: rgba(56,189,248,0.14);
          border-color: rgba(56,189,248,0.3);
          color: #38BDF8;
        }
        .scb-headline {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -0.025em;
          line-height: 1.3;
          word-break: keep-all;
        }
        .scb-subline {
          margin: 2px 0 0;
          font-size: 11.5px;
          font-weight: 600;
          color: #78716C;
        }
        .scb-root.is-dark .scb-subline {
          color: #94A3B8;
        }

        /* Right Live Real-Time Mood Character Pod */
        .scb-mood-pod {
          border-radius: 16px;
          padding: 10px 12px;
          background: #FAF8F5;
          border: 1px solid #EAE5DC;
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }
        .scb-root.is-dark .scb-mood-pod {
          background: #1B2230;
          border-color: rgba(255,255,255,0.08);
        }
        .scb-face-orb {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          background: #FFFFFF;
          border: 1px solid rgba(24,24,27,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(24,24,27,0.06);
        }
        .scb-root.is-dark .scb-face-orb {
          background: #111622;
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        }

        .scb-mood-body {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .scb-mood-pill {
          align-self: flex-start;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .scb-mood-title {
          font-size: 12.5px;
          font-weight: 800;
          line-height: 1.32;
          letter-spacing: -0.02em;
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
          background: rgba(120,113,108,0.18);
          overflow: hidden;
        }
        .scb-shift-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #8C5A32 0%, #10B981 100%);
          transform-origin: left center;
          transition: transform 300ms cubic-bezier(0.23,1,0.32,1);
        }
        .scb-root.is-dark .scb-shift-fill {
          background: linear-gradient(90deg, #38BDF8 0%, #34D399 100%);
        }
        .scb-shift-caption {
          font-size: 10px;
          font-weight: 700;
          color: #78716C;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .scb-root.is-dark .scb-shift-caption {
          color: #94A3B8;
        }

        /* Inline Quick Staff Picker Tray */
        .scb-picker-tray {
          padding: 10px 12px;
          border-radius: 15px;
          background: #FAF8F5;
          border: 1px dashed #D4CDC0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .scb-root.is-dark .scb-picker-tray {
          background: #1B2230;
          border-color: rgba(255,255,255,0.15);
        }
        .scb-staff-btn {
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid #E4DFD5;
          background: #FFFFFF;
          color: #18181B;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
        }
        .scb-root.is-dark .scb-staff-btn {
          background: #141923;
          border-color: rgba(255,255,255,0.1);
          color: #E2E8F0;
        }
        .scb-staff-btn.is-me {
          background: #18181B;
          color: #FFFFFF;
          border-color: #18181B;
        }
        .scb-root.is-dark .scb-staff-btn.is-me {
          background: #38BDF8;
          color: #0B0E14;
          border-color: #38BDF8;
        }

        /* Bottom 7-Day Apple Calendar Capsule Strip */
        .scb-week-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 5px;
          padding: 7px;
          border-radius: 16px;
          background: #FAF8F5;
          border: 1px solid #EAE5DC;
        }
        .scb-root.is-dark .scb-week-grid {
          background: #10141D;
          border-color: rgba(255,255,255,0.07);
        }
        .scb-day-cell {
          padding: 6px 2px;
          border-radius: 11px;
          background: #FFFFFF;
          border: 1px solid #EFECE6;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-align: center;
        }
        .scb-root.is-dark .scb-day-cell {
          background: #18202F;
          border-color: rgba(255,255,255,0.06);
          color: #CBD5E1;
        }
        .scb-day-cell.is-today {
          background: #18181B;
          border-color: #18181B;
          color: #FFFFFF;
        }
        .scb-root.is-dark .scb-day-cell.is-today {
          background: #38BDF8;
          border-color: #38BDF8;
          color: #0B0E14;
        }
        .scb-day-cell.is-off {
          background: #ECFDF5;
          border-color: #6EE7B7;
          color: #065F46;
        }
        .scb-root.is-dark .scb-day-cell.is-off {
          background: rgba(16,185,129,0.16);
          border-color: rgba(52,211,153,0.45);
          color: #6EE7B7;
        }
        .scb-day-top {
          font-size: 9.5px;
          font-weight: 700;
          opacity: 0.82;
          font-variant-numeric: tabular-nums;
        }
        .scb-day-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D6D3D1;
        }
        .scb-day-cell.is-today .scb-day-dot { background: #38BDF8; }
        .scb-root.is-dark .scb-day-cell.is-today .scb-day-dot { background: #0B0E14; }
        .scb-day-cell.is-off .scb-day-dot { background: #10B981; }
        .scb-day-code {
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
        }

        /* GPU Face Animations */
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

      {/* 상단 좌/우 분할: [좌] 버전 1 D-Day 링 & 이름변경  |  [우] 실시간 출퇴근·휴무 표정 이모티콘 포드 */}
      <div className="scb-top-split">
        <div className="scb-left-pane">
          <div
            className="scb-ring-outer"
            style={{
              background: `conic-gradient(${leftSummary.ringColor} 0% ${leftSummary.ringPct}%, ${
                isDark ? 'rgba(255,255,255,0.09)' : '#EDE9E0'
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
            <p className="scb-subline">{leftSummary.subline}</p>
          </div>
        </div>

        {/* 우측: 실시간 출퇴근(10:00~20:00) × 휴무 D-Day 기분 표정 이모티콘 포드 */}
        <div className="scb-mood-pod">
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

      {/* 원터치 직원 이름 빠른 변경 트레이 (열렸을 때만 표시) */}
      {isPickerOpen && (
        <div
          className="scb-picker-tray"
          onClick={(e) => e.stopPropagation()}
          role="region"
          aria-label="직원 이름 빠른 선택"
        >
          {GWANGJU_STAFF_ROSTER.map((staff) => {
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
                {staff.name} <span style={{ opacity: 0.7, fontWeight: 600 }}>{staff.role}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 하단: 버전 1 정갈한 7일 주간 캡슐 트랙 */}
      <div className="scb-week-grid">
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
    </div>
  );
};
