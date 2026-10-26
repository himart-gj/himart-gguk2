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

  // 상황별 연속 관절(Jointed) 모션 그래픽 졸라맨 SVG 스테이지 렌더링
  const renderStickmanSvg = () => {
    const stageCls =
      'w-20 h-16 sm:w-24 sm:h-20 rounded-2xl bg-black/25 border border-white/15 shadow-inner relative overflow-hidden shrink-0 flex items-center justify-center';

    switch (mood) {
      case 'holiday-today':
        // ③ 휴무 당일: 선글라스(🕶️) 끼고 한 손에 칵테일(🍹)을 든 채 신나게 춤추는 졸라맨
        return (
          <div className={stageCls}>
            <span
              className="absolute top-1 left-1.5 text-[11px] sm:text-xs pointer-events-none"
              style={{ animation: 'floatMusicNote 1.6s ease-in-out infinite' }}
            >
              🎵
            </span>
            <span
              className="absolute top-1 right-1.5 text-[11px] sm:text-xs pointer-events-none"
              style={{
                animation: 'floatMusicNote 1.8s ease-in-out infinite 0.5s',
              }}
            >
              🎶
            </span>
            <span
              className="absolute bottom-1 left-1 text-[10px] pointer-events-none"
              style={{
                animation: 'floatMusicNote 1.4s ease-in-out infinite 0.2s',
              }}
            >
              ✨
            </span>
            <span
              className="absolute bottom-1 right-1 text-xs pointer-events-none"
              style={{ animation: 'danceBodyGroove 0.7s ease-in-out infinite' }}
            >
              🍹
            </span>

            <svg viewBox="0 0 80 70" className="w-full h-full overflow-visible">
              {/* 무대 바닥 리듬 링 */}
              <ellipse
                cx="40"
                cy="62"
                rx="18"
                ry="3.5"
                fill="rgba(52, 211, 153, 0.35)"
              />

              {/* 춤추는 상체 그룹 */}
              <g
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center bottom',
                  animation: 'danceBodyGroove 0.65s ease-in-out infinite',
                }}
              >
                {/* 머리 */}
                <circle
                  cx="40"
                  cy="18"
                  r="8.5"
                  fill="#fef08a"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                {/* 선글라스 */}
                <rect
                  x="33"
                  y="15"
                  width="6"
                  height="4"
                  rx="1"
                  fill="#0f172a"
                />
                <rect
                  x="41"
                  y="15"
                  width="6"
                  height="4"
                  rx="1"
                  fill="#0f172a"
                />
                <line
                  x1="31"
                  y1="16.5"
                  x2="49"
                  y2="16.5"
                  stroke="#0f172a"
                  strokeWidth="1.6"
                />
                {/* 행복한 웃음 */}
                <path
                  d="M36 21.5 Q40 25 44 21.5"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* 몸통 */}
                <line
                  x1="40"
                  y1="26.5"
                  x2="40"
                  y2="45"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />

                {/* 왼팔 (어깨 관절 기준 댄스 스윙) */}
                <g
                  style={{
                    transformOrigin: '40px 30px',
                    animation: 'danceArmLeft 0.55s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="40,30 27,23 22,15"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* 오른팔 (칵테일 들고 흔드는 팔) */}
                <g
                  style={{
                    transformOrigin: '40px 30px',
                    animation: 'danceArmRight 0.55s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="40,30 53,24 58,16"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>

              {/* 왼다리 (골반 관절 기준 스텝) */}
              <g
                style={{
                  transformOrigin: '40px 45px',
                  animation: 'danceLegLeft 0.65s ease-in-out infinite',
                }}
              >
                <polyline
                  points="40,45 31,53 27,61"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              {/* 오른다리 (골반 관절 기준 스텝) */}
              <g
                style={{
                  transformOrigin: '40px 45px',
                  animation: 'danceLegRight 0.65s ease-in-out infinite',
                }}
              >
                <polyline
                  points="40,45 49,53 53,61"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        );

      case 'holiday-eve':
        // ② 휴무 전날 (D-1): 바닥 그림자가 줄었다 커지며 공중으로 폴짝폴짝 점프하고 팔다리를 파닥이는 졸라맨
        return (
          <div className={stageCls}>
            <span
              className="absolute top-1 left-1.5 text-xs pointer-events-none"
              style={{ animation: 'floatMusicNote 1.2s ease-in-out infinite' }}
            >
              🎉
            </span>
            <span
              className="absolute top-1 right-1.5 text-xs pointer-events-none"
              style={{
                animation: 'floatMusicNote 1.2s ease-in-out infinite 0.4s',
              }}
            >
              🙌
            </span>

            <svg viewBox="0 0 80 70" className="w-full h-full overflow-visible">
              {/* 점프 높이에 연동되어 수축/확장되는 바닥 그림자 */}
              <ellipse
                cx="40"
                cy="63"
                rx="16"
                ry="3.5"
                fill="rgba(251, 191, 36, 0.45)"
                style={{
                  transformOrigin: '40px 63px',
                  animation: 'eveShadowPulse 0.6s ease-in-out infinite',
                }}
              />

              {/* 슈퍼 점프 전신 그룹 */}
              <g
                style={{
                  transformOrigin: '40px 40px',
                  animation: 'eveSuperJump 0.6s ease-in-out infinite',
                }}
              >
                {/* 머리 */}
                <circle
                  cx="40"
                  cy="18"
                  r="8.5"
                  fill="#fde047"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                {/* 반짝이는 눈 & 함박웃음 */}
                <path
                  d="M35 16 L37 14 L38.5 16 M41.5 16 L43 14 L45 16"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M35.5 20.5 Q40 25 44.5 20.5"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* 몸통 */}
                <line
                  x1="40"
                  y1="26.5"
                  x2="40"
                  y2="44"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />

                {/* 만세하며 빠르게 흔드는 두 팔 */}
                <g
                  style={{
                    transformOrigin: '40px 29px',
                    animation: 'danceArmLeft 0.35s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="40"
                    y1="29"
                    x2="22"
                    y2="13"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>
                <g
                  style={{
                    transformOrigin: '40px 29px',
                    animation: 'danceArmRight 0.35s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="40"
                    y1="29"
                    x2="58"
                    y2="13"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>

                {/* 공중에서 신나게 파닥거리는 두 다리 */}
                <g
                  style={{
                    transformOrigin: '40px 44px',
                    animation: 'danceLegLeft 0.35s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="40,44 28,51 23,58"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <g
                  style={{
                    transformOrigin: '40px 44px',
                    animation: 'danceLegRight 0.35s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="40,44 52,51 57,58"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            </svg>
          </div>
        );

      case 'post-holiday':
        // ④ 휴무 다음날: 영혼(👻)이 머리 위에서 빠져나갔다 빨려들어가고 다리를 후들거리며 터덜터덜 걷는 졸라맨
        return (
          <div className={stageCls}>
            <span
              className="absolute top-1 right-1.5 text-xs sm:text-sm pointer-events-none"
              style={{ animation: 'soulEscapeLoop 2.2s ease-in-out infinite' }}
            >
              👻
            </span>
            <span
              className="absolute top-1.5 left-1.5 text-[11px] pointer-events-none"
              style={{ animation: 'sweatDropFall 1.3s ease-in infinite' }}
            >
              💦
            </span>

            <svg viewBox="0 0 80 70" className="w-full h-full overflow-visible">
              {/* 뒤로 흐르는 바닥 트랙 */}
              <line
                x1="8"
                y1="62"
                x2="72"
                y2="62"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                style={{ animation: 'treadmillMove 1.1s linear infinite' }}
              />

              {/* 후들거리는 좀비 전신 */}
              <g
                style={{
                  transformOrigin: '40px 45px',
                  animation: 'zombieTremble 0.9s ease-in-out infinite',
                }}
              >
                {/* 푹 숙인 머리 */}
                <circle
                  cx="46"
                  cy="22"
                  r="8"
                  fill="#cbd5e1"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                {/* 쾡한 눈 */}
                <line
                  x1="43"
                  y1="22"
                  x2="49"
                  y2="22"
                  stroke="#0f172a"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* 구부정한 등 */}
                <path
                  d="M42 28 Q35 36 33 46"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />

                {/* 축 늘어져 흔들리는 두 팔 */}
                <g
                  style={{
                    transformOrigin: '39px 32px',
                    animation: 'walkArmSwingA 1.1s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="39"
                    y1="32"
                    x2="46"
                    y2="48"
                    stroke="#94a3b8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </g>
                <g
                  style={{
                    transformOrigin: '37px 34px',
                    animation: 'walkArmSwingB 1.1s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="37"
                    y1="34"
                    x2="42"
                    y2="50"
                    stroke="#94a3b8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </g>

                {/* 터덜터덜 질질 끄는 두 다리 */}
                <g
                  style={{
                    transformOrigin: '33px 46px',
                    animation: 'walkLegStepA 1.1s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="33"
                    y1="46"
                    x2="23"
                    y2="60"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
                <g
                  style={{
                    transformOrigin: '33px 46px',
                    animation: 'walkLegStepB 1.1s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="33"
                    y1="46"
                    x2="43"
                    y2="60"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
              </g>
            </svg>
          </div>
        );

      case 'unset':
        // 이름 미설정 시 손을 흔들며 반갑게 인사하는 졸라맨
        return (
          <div className={stageCls}>
            <span
              className="absolute top-1 right-1.5 text-xs font-black text-amber-300 pointer-events-none"
              style={{ animation: 'eveSuperJump 0.8s ease-in-out infinite' }}
            >
              ❓
            </span>
            <svg viewBox="0 0 80 70" className="w-full h-full overflow-visible">
              <ellipse
                cx="40"
                cy="62"
                rx="15"
                ry="3"
                fill="rgba(56, 189, 248, 0.3)"
              />
              <g
                style={{
                  transformOrigin: '40px 45px',
                  animation: 'walkTorsoHeavy 0.9s ease-in-out infinite',
                }}
              >
                <circle
                  cx="40"
                  cy="19"
                  r="8"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <line
                  x1="40"
                  y1="27"
                  x2="40"
                  y2="45"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="32"
                  x2="27"
                  y2="41"
                  stroke="#ffffff"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                {/* 손 흔드는 오른팔 */}
                <g
                  style={{
                    transformOrigin: '40px 32px',
                    animation: 'danceArmRight 0.5s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="40,32 53,24 57,15"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <line
                  x1="40"
                  y1="45"
                  x2="30"
                  y2="60"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="45"
                  x2="50"
                  y2="60"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>
        );

      case 'normal-work':
      default:
        // ① 일반 출근일 (휴무 D-2 이상): 필승 머리띠를 매고 땀(💦)과 거친 숨결(💨)을 뿜으며 러닝머신 위를 영차영차 행군하는 졸라맨
        return (
          <div className={stageCls}>
            {/* 뚝뚝 떨어지는 땀방울 */}
            <span
              className="absolute top-1 left-1.5 text-[11px] pointer-events-none"
              style={{ animation: 'sweatDropFall 0.9s ease-in infinite' }}
            >
              💦
            </span>
            {/* 뿜어져 나오는 거친 숨결 */}
            <span
              className="absolute top-2 right-1 text-[11px] pointer-events-none"
              style={{ animation: 'puffSteam 0.9s ease-out infinite' }}
            >
              💨
            </span>

            <svg viewBox="0 0 80 70" className="w-full h-full overflow-visible">
              {/* 발밑에서 끊임없이 뒤로 흘러가는 러닝머신 트랙 점선 */}
              <line
                x1="6"
                y1="62"
                x2="74"
                y2="62"
                stroke="#38bdf8"
                strokeWidth="2.8"
                strokeDasharray="7 5"
                strokeLinecap="round"
                style={{ animation: 'treadmillMove 0.45s linear infinite' }}
              />

              {/* 영차영차 상하 반동하며 앞으로 기울어진 상체 + 팔다리 관절 */}
              <g
                style={{
                  transformOrigin: '38px 44px',
                  animation: 'walkTorsoHeavy 0.45s ease-in-out infinite',
                }}
              >
                {/* 뒤 팔 (교차 스윙 B) */}
                <g
                  style={{
                    transformOrigin: '39px 30px',
                    animation: 'walkArmSwingB 0.45s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="39,30 27,36 22,32"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* 뒤 다리 (교차 스텝 B) */}
                <g
                  style={{
                    transformOrigin: '35px 44px',
                    animation: 'walkLegStepB 0.45s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="35,44 26,52 21,60"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* 앞으로 숙인 몸통 */}
                <line
                  x1="41"
                  y1="25"
                  x2="35"
                  y2="44"
                  stroke="#ffffff"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />

                {/* 머리 */}
                <circle
                  cx="43"
                  cy="17"
                  r="8"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                {/* 붉은 필승 머리띠 & 휘날리는 끈 */}
                <line
                  x1="35"
                  y1="14"
                  x2="51"
                  y2="14"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M35 14 Q28 11 24 15"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {/* 결의에 찬 눈 */}
                <line
                  x1="44"
                  y1="17.5"
                  x2="49"
                  y2="16.5"
                  stroke="#0f172a"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* 앞 다리 (교차 스텝 A) */}
                <g
                  style={{
                    transformOrigin: '35px 44px',
                    animation: 'walkLegStepA 0.45s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="35,44 45,52 49,60"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* 앞 팔 (교차 스윙 A) */}
                <g
                  style={{
                    transformOrigin: '39px 30px',
                    animation: 'walkArmSwingA 0.45s ease-in-out infinite',
                  }}
                >
                  <polyline
                    points="39,30 49,36 54,31"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
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
      {/* 졸라맨 연속 관절 모션 전용 CSS Keyframes */}
      <style>{`
        @keyframes danceBodyGroove {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-4px) rotate(6deg); }
        }
        @keyframes danceArmLeft {
          0%, 100% { transform: rotate(-28deg); }
          50% { transform: rotate(32deg); }
        }
        @keyframes danceArmRight {
          0%, 100% { transform: rotate(28deg); }
          50% { transform: rotate(-32deg); }
        }
        @keyframes danceLegLeft {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(22deg); }
        }
        @keyframes danceLegRight {
          0%, 100% { transform: rotate(22deg); }
          50% { transform: rotate(-18deg); }
        }
        @keyframes floatMusicNote {
          0%, 100% { transform: translateY(0px) scale(0.95); opacity: 0.75; }
          50% { transform: translateY(-5px) scale(1.15); opacity: 1; }
        }
        @keyframes eveSuperJump {
          0%, 100% { transform: translateY(2px) scaleY(0.94); }
          50% { transform: translateY(-11px) scaleY(1.04); }
        }
        @keyframes eveShadowPulse {
          0%, 100% { transform: scaleX(1.1); opacity: 0.55; }
          50% { transform: scaleX(0.55); opacity: 0.2; }
        }
        @keyframes walkArmSwingA {
          0%, 100% { transform: rotate(-34deg); }
          50% { transform: rotate(34deg); }
        }
        @keyframes walkArmSwingB {
          0%, 100% { transform: rotate(34deg); }
          50% { transform: rotate(-34deg); }
        }
        @keyframes walkLegStepA {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
        @keyframes walkLegStepB {
          0%, 100% { transform: rotate(30deg); }
          50% { transform: rotate(-30deg); }
        }
        @keyframes walkTorsoHeavy {
          0%, 100% { transform: translateY(0px) rotate(3deg); }
          50% { transform: translateY(-3px) rotate(7deg); }
        }
        @keyframes treadmillMove {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 24; }
        }
        @keyframes sweatDropFall {
          0% { transform: translate(0px, -2px) scale(0.8); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translate(-4px, 10px) scale(1.05); opacity: 0; }
        }
        @keyframes puffSteam {
          0% { transform: translate(0px, 0px) scale(0.7); opacity: 0.9; }
          100% { transform: translate(7px, -6px) scale(1.25); opacity: 0; }
        }
        @keyframes soulEscapeLoop {
          0%, 100% { transform: translate(0px, 4px) scale(0.85); opacity: 0.55; }
          50% { transform: translate(4px, -7px) scale(1.15); opacity: 1; }
        }
        @keyframes zombieTremble {
          0%, 100% { transform: translateX(0px) translateY(0px) rotate(2deg); }
          25% { transform: translateX(-1.5px) translateY(1px) rotate(4deg); }
          75% { transform: translateX(1.5px) translateY(2px) rotate(1deg); }
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 좌측: 졸라맨 애니메이션 캐릭터 스테이지 + 말풍선 */}
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
