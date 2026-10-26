import React, { useEffect, useMemo, useState } from 'react';
import {
  DayScheduleCode,
  getOrCreateMonthSchedule,
  isOffDayCode,
  loadAllSchedules,
  loadSavedUserName,
  SCHEDULE_UPDATED_EVENT,
  SchedulesMap,
} from './ScheduleModal';

interface ScheduleCharacterBannerProps {
  onOpenScheduleModal: () => void;
}

type CharacterMood =
  | 'unset' // 이름 미설정
  | 'holiday-today' // ③ 내 휴무 당일
  | 'holiday-eve' // ② 내 휴무 바로 전날
  | 'post-holiday' // ④ 내 휴무 다음날 (어제 쉬고 오늘 출근)
  | 'normal-work'; // ① 일반 출근일 (휴무 2일 이상 전)

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function getEmployeeCodeForDate(
  schedules: SchedulesMap,
  userName: string,
  date: Date
): DayScheduleCode {
  if (!userName) return '';
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const monthSchedule = getOrCreateMonthSchedule(schedules, ym);
  const emp =
    monthSchedule.employees.find((e) => e.name === userName) ||
    monthSchedule.employees.find((e) => e.name.includes(userName));
  if (!emp) return '';
  return emp.days[String(date.getDate())] || '';
}

export const ScheduleCharacterBanner: React.FC<ScheduleCharacterBannerProps> = ({
  onOpenScheduleModal,
}) => {
  const [userName, setUserName] = useState<string>(() => loadSavedUserName());
  const [schedules, setSchedules] = useState<SchedulesMap>(() =>
    loadAllSchedules()
  );

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

  const today = useMemo(() => new Date(), []);

  // 오늘을 중심으로 한 7일 징검다리 미니 달력 트랙 (-2일 ~ +4일)
  const trackDays = useMemo(() => {
    const list: {
      offset: number;
      date: Date;
      dayNum: number;
      weekday: string;
      code: DayScheduleCode;
      isOff: boolean;
      isToday: boolean;
    }[] = [];

    for (let offset = -2; offset <= 4; offset++) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + offset
      );
      const code = getEmployeeCodeForDate(schedules, userName, d);
      list.push({
        offset,
        date: d,
        dayNum: d.getDate(),
        weekday: WEEKDAY_KO[d.getDay()],
        code,
        isOff: isOffDayCode(code),
        isToday: offset === 0,
      });
    }
    return list;
  }, [schedules, today, userName]);

  // 다음 휴무일까지 남은 일수(D-Day) 계산 (최대 35일 탐색)
  const daysUntilNextOff = useMemo(() => {
    if (!userName) return null;
    for (let i = 1; i <= 35; i++) {
      const target = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i
      );
      const code = getEmployeeCodeForDate(schedules, userName, target);
      if (isOffDayCode(code)) {
        return i;
      }
    }
    return null;
  }, [schedules, today, userName]);

  // 4가지 상황별 졸라맨 모션 판별
  const mood: CharacterMood = useMemo(() => {
    if (!userName) return 'unset';
    const yesterday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 1
    );
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const todayCode = getEmployeeCodeForDate(schedules, userName, today);
    const tomorrowCode = getEmployeeCodeForDate(schedules, userName, tomorrow);
    const yesterdayCode = getEmployeeCodeForDate(
      schedules,
      userName,
      yesterday
    );

    if (isOffDayCode(todayCode)) {
      return 'holiday-today'; // ③ 내 휴무 당일
    }
    if (isOffDayCode(tomorrowCode)) {
      return 'holiday-eve'; // ② 내 휴무 바로 전날
    }
    if (isOffDayCode(yesterdayCode)) {
      return 'post-holiday'; // ④ 내 휴무 다음날
    }
    return 'normal-work'; // ① 일반 출근일
  }, [schedules, today, userName]);

  // 말풍선 텍스트 및 테마 색상
  const bannerMeta = useMemo(() => {
    const dStr = daysUntilNextOff ?? '?';
    switch (mood) {
      case 'unset':
        return {
          bgClass:
            'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-indigo-400/70',
          badgeText: '📅 내 휴무 카운트다운',
          badgeClass: 'bg-amber-400 text-slate-950',
          speechText:
            '👆 여기를 눌러 [📅 휴무표] 상단에 내 이름을 한 번만 입력하면, 내 휴무 카운트다운 애니메이션이 작동합니다!',
          subText: '경기광주점 19명 전 직원 스케줄 자동 연동',
        };
      case 'holiday-today':
        return {
          bgClass:
            'bg-gradient-to-r from-emerald-950 via-teal-900 to-cyan-950 border-emerald-400',
          badgeText: '🏖️ TODAY HAPPY OFF',
          badgeClass: 'bg-emerald-400 text-slate-950',
          speechText: `🏖️ 해피 휴무!! 오늘은 ${userName}님의 소중한 쉬는 날입니다 ✨`,
          subText: '충전 가득하시고 행복한 하루 보내세요! 🎵',
        };
      case 'holiday-eve':
        return {
          bgClass:
            'bg-gradient-to-r from-indigo-950 via-purple-900 to-rose-950 border-amber-400',
          badgeText: '🎉 휴무 D-1 (내일 휴무!)',
          badgeClass: 'bg-amber-400 text-slate-950',
          speechText: `와아아!! ${userName}님 오늘만 지나면 내일 드디어 휴무다!! 🙌🎉`,
          subText: '설레는 마음으로 오늘 하루도 화이팅!! ✨',
        };
      case 'post-holiday':
        return {
          bgClass:
            'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 border-slate-600',
          badgeText: `👻 휴무 다음날 · 다음 휴무 D-${dStr}`,
          badgeClass: 'bg-slate-700 text-slate-200 border border-slate-500',
          speechText: `출근...... 😭💦 (다음 휴무 D-${dStr}일)`,
          subText: `${userName}님 어제 푹 쉬셨나요? 천천히 시동 걸어봐요 ☕`,
        };
      case 'normal-work':
      default:
        return {
          bgClass:
            'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-sky-400/70',
          badgeText: `💪 꿀휴무 D-${dStr}`,
          badgeClass: 'bg-sky-400 text-slate-950',
          speechText: `${userName}님 영차영차... 꿀휴무까지 D-${dStr}일! 오늘도 버텨요 💪`,
          subText: '터치하면 오늘 근무자 및 전체 휴무표를 확인합니다',
        };
    }
  }, [daysUntilNextOff, mood, userName]);

  // 상황별 커스텀 졸라맨 SVG 렌더링
  const renderStickmanSvg = () => {
    switch (mood) {
      case 'holiday-today':
        // ③ 선글라스(🕶️) 끼고 해먹/비치베드에 누워 콧노래(🎵) 부르는 졸라맨
        return (
          <div className="relative w-16 h-14 sm:w-20 sm:h-16 flex items-center justify-center shrink-0">
            <span className="absolute -top-1 right-0 text-xs sm:text-sm animate-bounce">
              🎵
            </span>
            <span className="absolute top-0 left-0 text-xs animate-pulse">
              🏖️
            </span>
            <svg
              viewBox="0 0 80 60"
              className="w-full h-full overflow-visible"
            >
              {/* 비치베드/해먹 곡선 */}
              <path
                d="M8 46 Q40 56 72 40"
                fill="none"
                stroke="#34d399"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 졸라맨 누운 몸통 */}
              <circle
                cx="24"
                cy="30"
                r="8"
                fill="#fef08a"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              {/* 선글라스 */}
              <rect x="20" y="27" width="5" height="3.5" rx="1" fill="#0f172a" />
              <rect x="26" y="27" width="5" height="3.5" rx="1" fill="#0f172a" />
              <line
                x1="18"
                y1="28.5"
                x2="32"
                y2="28.5"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* 미소 */}
              <path
                d="M22 33 Q25 36 28 33"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* 누운 몸 & 다리 꼬기 */}
              <line
                x1="30"
                y1="35"
                x2="48"
                y2="43"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="48"
                y1="43"
                x2="60"
                y2="34"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="48"
                y1="43"
                x2="64"
                y2="42"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 머리 뒤로 깍지 낀 팔 */}
              <path
                d="M34 37 L20 38 L18 32"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );

      case 'holiday-eve':
        // ② 두 팔을 번쩍 들고 폴짝폴짝 점프하며 폭죽/별(🎉🙌✨)이 터지는 졸라맨
        return (
          <div className="relative w-16 h-14 sm:w-20 sm:h-16 flex items-center justify-center shrink-0">
            <span className="absolute -top-1 left-0 text-xs sm:text-sm animate-ping">
              ✨
            </span>
            <span className="absolute -top-1 right-0 text-xs sm:text-sm animate-bounce">
              🎉
            </span>
            <svg
              viewBox="0 0 70 64"
              className="w-full h-full animate-bounce overflow-visible"
            >
              {/* 머리 */}
              <circle
                cx="35"
                cy="16"
                r="8"
                fill="#fde047"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              {/* 신난 눈 & 웃는 입 */}
              <path
                d="M31 14 L33 12 L34 14 M36 14 L38 12 L39 14"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <path
                d="M31 18 Q35 22 39 18"
                fill="none"
                stroke="#e11d48"
                strokeWidth="2"
              />
              {/* 몸통 */}
              <line
                x1="35"
                y1="24"
                x2="35"
                y2="42"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 만세하는 두 팔 */}
              <line
                x1="35"
                y1="29"
                x2="19"
                y2="15"
                stroke="#fde047"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="29"
                x2="51"
                y2="15"
                stroke="#fde047"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 폴짝 뛰는 두 다리 */}
              <line
                x1="35"
                y1="42"
                x2="22"
                y2="54"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="42"
                x2="48"
                y2="54"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );

      case 'post-holiday':
        // ④ 어깨가 축 처진 채 머리 위로 영혼(👻)이 빠져나오며 다리를 질질 끌고 출근하는 졸라맨
        return (
          <div className="relative w-16 h-14 sm:w-20 sm:h-16 flex items-center justify-center shrink-0">
            <span className="absolute -top-1.5 right-1 text-xs sm:text-sm animate-bounce">
              👻
            </span>
            <span className="absolute top-1 left-0 text-xs animate-pulse">
              😭
            </span>
            <svg
              viewBox="0 0 70 64"
              className="w-full h-full overflow-visible"
            >
              {/* 푹 숙인 머리 */}
              <circle
                cx="42"
                cy="22"
                r="7.5"
                fill="#cbd5e1"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              {/* 쾡한 눈 */}
              <line
                x1="40"
                y1="22"
                x2="45"
                y2="22"
                stroke="#0f172a"
                strokeWidth="2"
              />
              {/* 구부정한 몸통 */}
              <path
                d="M38 28 Q32 36 30 45"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 축 처진 두 팔 */}
              <line
                x1="36"
                y1="32"
                x2="44"
                y2="46"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="34"
                x2="39"
                y2="48"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* 질질 끄는 다리 */}
              <line
                x1="30"
                y1="45"
                x2="18"
                y2="58"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="30"
                y1="45"
                x2="38"
                y2="58"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );

      case 'unset':
        // 이름 미설정 시 물음표 띄운 졸라맨
        return (
          <div className="relative w-16 h-14 sm:w-20 sm:h-16 flex items-center justify-center shrink-0">
            <span className="absolute -top-1 right-1 text-xs sm:text-sm font-black text-amber-300 animate-bounce">
              ❓
            </span>
            <svg
              viewBox="0 0 70 64"
              className="w-full h-full overflow-visible"
            >
              <circle
                cx="35"
                cy="18"
                r="8"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <line
                x1="35"
                y1="26"
                x2="35"
                y2="44"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="31"
                x2="23"
                y2="39"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="31"
                x2="48"
                y2="22"
                stroke="#fde047"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="44"
                x2="26"
                y2="58"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="44"
                x2="44"
                y2="58"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );

      case 'normal-work':
      default:
        // ① 땀(💦)을 흘리며 영차영차 걸어가는 졸라맨
        return (
          <div className="relative w-16 h-14 sm:w-20 sm:h-16 flex items-center justify-center shrink-0">
            <span className="absolute top-0 right-0 text-xs sm:text-sm animate-pulse">
              💦
            </span>
            <svg
              viewBox="0 0 70 64"
              className="w-full h-full overflow-visible"
            >
              {/* 머리 */}
              <circle
                cx="37"
                cy="17"
                r="7.5"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              {/* 결의에 찬 눈/머리띠 */}
              <line
                x1="30"
                y1="14"
                x2="44"
                y2="14"
                stroke="#f43f5e"
                strokeWidth="2.5"
              />
              {/* 앞으로 기울여 걷는 몸통 */}
              <line
                x1="36"
                y1="25"
                x2="32"
                y2="43"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* 힘차게 흔드는 두 팔 */}
              <line
                x1="35"
                y1="30"
                x2="47"
                y2="37"
                stroke="#fde047"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="30"
                x2="22"
                y2="36"
                stroke="#fde047"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* 걸어가는 다리 */}
              <line
                x1="32"
                y1="43"
                x2="21"
                y2="57"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="32"
                y1="43"
                x2="45"
                y2="57"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onOpenScheduleModal}
      className={`w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-left text-white border-2 shadow-md hover:shadow-xl transition-all cursor-pointer group ${bannerMeta.bgClass}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 좌측: 졸라맨 애니메이션 캐릭터 + 말풍선 */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {renderStickmanSvg()}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black ${bannerMeta.badgeClass}`}
              >
                {bannerMeta.badgeText}
              </span>
              <span className="text-[11px] font-bold text-slate-300 group-hover:text-amber-300 transition">
                {bannerMeta.subText} ➔
              </span>
            </div>

            {/* 말풍선 박스 */}
            <div className="px-3 py-1.5 rounded-2xl bg-white/10 border border-white/20 text-xs sm:text-sm font-black text-white leading-snug break-keep">
              {bannerMeta.speechText}
            </div>
          </div>
        </div>

        {/* 우측(모바일은 하단): 7일 미니 징검다리 달력 트랙 (휴무일 🏖️ 파라솔 표시) */}
        {userName && (
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 bg-slate-950/50 p-1.5 sm:p-2 rounded-2xl border border-white/10 shrink-0">
            {trackDays.map((item) => (
              <div
                key={item.offset}
                className={`w-9 sm:w-11 py-1 rounded-xl flex flex-col items-center justify-center text-center transition ${
                  item.isToday
                    ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-white shadow-xs'
                    : item.isOff
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50 font-black'
                    : 'bg-slate-800/80 text-slate-300 font-bold'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] leading-none opacity-85">
                  {item.isToday ? '오늘' : `${item.dayNum}(${item.weekday})`}
                </span>
                <span className="text-xs sm:text-sm mt-0.5 leading-none">
                  {item.isOff ? '🏖️' : item.isToday ? '🏃' : '·'}
                </span>
                <span className="text-[9px] font-black mt-0.5 leading-none">
                  {item.code || '출근'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
};
