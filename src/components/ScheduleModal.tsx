import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  RotateCcw,
  Save,
  Settings,
  Table2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  compressImageFile,
  getEffectiveGeminiApiKey,
} from '../utils/aiImageParser';

export const USER_NAME_STORAGE_KEY = 'himart_gj_user_name';
export const SCHEDULES_STORAGE_KEY = 'himart_gj_schedules_v1';
export const SCHEDULE_UPDATED_EVENT = 'himart_gj_schedule_updated';

export type DayScheduleCode =
  | '' // 정상 출근
  | 'O' // 정기 휴무
  | '연차' // 연차
  | 'V' // 휴가(Summer/Refresh)
  | '반차' // 반차
  | '교육' // 교육
  | '회의' // 회의
  | 'HP'; // HP 근무

export interface EmployeeMonthlySchedule {
  name: string;
  role: string;
  /** key: "1" ~ "31", value: DayScheduleCode */
  days: Record<string, DayScheduleCode>;
}

export interface MonthlyScheduleData {
  yearMonth: string; // 'YYYY-MM', e.g., '2026-10'
  updatedAt: string;
  employees: EmployeeMonthlySchedule[];
}

export type SchedulesMap = Record<string, MonthlyScheduleData>;

export function isOffDayCode(code?: string): boolean {
  const c = (code || '').trim().toUpperCase();
  return c === 'O' || c === '연차' || c === 'V' || c === '휴무' || c === '휴가';
}

function buildDaysMap(spec: {
  O?: number[];
  연차?: number[];
  V?: number[];
  반차?: number[];
  교육?: number[];
  회의?: number[];
  HP?: number[];
}): Record<string, DayScheduleCode> {
  const map: Record<string, DayScheduleCode> = {};
  (spec.O || []).forEach((d) => {
    map[String(d)] = 'O';
  });
  (spec.연차 || []).forEach((d) => {
    map[String(d)] = '연차';
  });
  (spec.V || []).forEach((d) => {
    map[String(d)] = 'V';
  });
  (spec.반차 || []).forEach((d) => {
    map[String(d)] = '반차';
  });
  (spec.교육 || []).forEach((d) => {
    map[String(d)] = '교육';
  });
  (spec.회의 || []).forEach((d) => {
    map[String(d)] = '회의';
  });
  (spec.HP || []).forEach((d) => {
    map[String(d)] = 'HP';
  });
  return map;
}

export const DEFAULT_2026_10_EMPLOYEES: EmployeeMonthlySchedule[] = [
  {
    name: '이현구',
    role: '지점장',
    days: buildDaysMap({
      O: [3, 4, 9, 17, 24, 30, 31],
      연차: [10, 11],
      V: [18],
      반차: [2, 23],
      회의: [7, 13, 16],
    }),
  },
  {
    name: '박정우',
    role: '부점장',
    days: buildDaysMap({
      O: [2, 5, 11, 12, 16, 19, 25, 29],
      연차: [26],
      V: [20],
      회의: [6],
    }),
  },
  {
    name: '정아름',
    role: 'SCM',
    days: buildDaysMap({
      O: [3, 4, 9, 10, 11, 17, 18, 25, 31],
      연차: [7, 14, 21, 22, 28],
      V: [24],
      교육: [16],
    }),
  },
  {
    name: '최윤호',
    role: '대형',
    days: buildDaysMap({
      O: [1, 6, 7, 15, 22, 26, 27],
      연차: [21, 28],
      V: [8],
    }),
  },
  {
    name: '한정우',
    role: '대형',
    days: buildDaysMap({
      O: [5, 8, 12, 13, 19, 27, 29],
      연차: [6, 14, 20],
    }),
  },
  {
    name: '권태영',
    role: '대형',
    days: buildDaysMap({
      O: [5, 13, 21, 27, 28],
      연차: [6, 7, 14, 15],
      V: [20],
      교육: [22],
    }),
  },
  {
    name: '조시형',
    role: '생활/빌트인',
    days: buildDaysMap({
      O: [6, 12, 16, 19, 20, 27, 29],
      연차: [1, 13],
      V: [5],
    }),
  },
  {
    name: '오현실',
    role: '생활/주방',
    days: buildDaysMap({
      O: [6, 7, 12, 19, 20, 28],
      연차: [13, 21, 26],
      V: [27],
    }),
  },
  {
    name: '문지선',
    role: '주방/계절',
    days: buildDaysMap({
      O: [1, 7, 8, 13, 14, 21, 26],
      연차: [15, 22],
      V: [6],
      교육: [27],
    }),
  },
  {
    name: '박경진',
    role: '쿠쿠',
    days: buildDaysMap({
      O: [1, 7, 14, 15, 20, 22, 27, 28],
    }),
  },
  {
    name: '백희진',
    role: '쿠쿠',
    days: buildDaysMap({
      O: [2, 6, 8, 13, 16, 19, 21, 29],
    }),
  },
  {
    name: '김란희',
    role: 'KBB',
    days: buildDaysMap({
      O: [6, 7, 13, 14, 15, 20, 22, 27],
      연차: [8, 28],
      HP: [9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25, 26, 30, 31],
    }),
  },
  {
    name: '이재성',
    role: '애플',
    days: buildDaysMap({
      O: [2, 8, 14, 19, 21, 26, 28],
      연차: [7, 15],
      V: [13],
    }),
  },
  {
    name: '이승환',
    role: '모바일',
    days: buildDaysMap({
      O: [6, 12, 15, 22, 26, 27, 29],
      연차: [7, 20],
      V: [13],
    }),
  },
  {
    name: '심지혜',
    role: '모바일',
    days: buildDaysMap({
      O: [5, 6, 13, 14, 19, 20, 27, 28],
      연차: [1, 8],
    }),
  },
  {
    name: '지상현',
    role: '모바일',
    days: buildDaysMap({
      O: [1, 2, 16, 23, 29, 30],
      연차: [7, 8, 15],
      V: [22],
    }),
  },
  {
    name: '유현승',
    role: '모바일',
    days: buildDaysMap({
      O: [5, 6, 12, 13, 19, 20, 26, 27],
    }),
  },
  {
    name: '조민혁',
    role: '통신',
    days: buildDaysMap({
      O: [1, 6, 7, 13, 14, 20, 21, 27, 28],
    }),
  },
  {
    name: '노재성',
    role: '통신',
    days: buildDaysMap({
      O: [6, 7, 13, 14, 20, 21, 27, 28],
    }),
  },
];

export const DEFAULT_2026_10_SCHEDULE: MonthlyScheduleData = {
  yearMonth: '2026-10',
  updatedAt: '2026-10-01 09:00',
  employees: DEFAULT_2026_10_EMPLOYEES,
};

export function loadSavedUserName(): string {
  try {
    return localStorage.getItem(USER_NAME_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveUserName(name: string): void {
  try {
    const clean = name.trim();
    if (clean) {
      localStorage.setItem(USER_NAME_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(USER_NAME_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function loadAllSchedules(): SchedulesMap {
  try {
    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!raw) {
      return { '2026-10': DEFAULT_2026_10_SCHEDULE };
    }
    const parsed = JSON.parse(raw) as SchedulesMap;
    if (!parsed || typeof parsed !== 'object') {
      return { '2026-10': DEFAULT_2026_10_SCHEDULE };
    }
    if (!parsed['2026-10']) {
      parsed['2026-10'] = DEFAULT_2026_10_SCHEDULE;
    }
    return parsed;
  } catch {
    return { '2026-10': DEFAULT_2026_10_SCHEDULE };
  }
}

export function saveAllSchedules(map: SchedulesMap): void {
  try {
    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function getOrCreateMonthSchedule(
  schedules: SchedulesMap,
  yearMonth: string
): MonthlyScheduleData {
  if (schedules[yearMonth]) {
    return schedules[yearMonth];
  }
  if (yearMonth === '2026-10') {
    return DEFAULT_2026_10_SCHEDULE;
  }
  // 등록되지 않은 새 월은 직원 19명 명단만 유지하고 일별 휴무는 빈 상태로 생성
  return {
    yearMonth,
    updatedAt: '미등록 (사진/엑셀 업로드 또는 셀 클릭으로 입력 가능)',
    employees: DEFAULT_2026_10_EMPLOYEES.map((emp) => ({
      name: emp.name,
      role: emp.role,
      days: {},
    })),
  };
}

function normalizeScheduleCode(raw: string): DayScheduleCode {
  const s = raw.trim().toUpperCase();
  if (!s || s === '-' || s === '출근' || s === '정상') return '';
  if (s === 'O' || s === '0' || s === 'ㅇ' || s === '휴무' || s === '휴')
    return 'O';
  if (s.includes('연차') || s === '연') return '연차';
  if (s === 'V' || s.includes('휴가') || s.includes('리프')) return 'V';
  if (s.includes('반차') || s === '반') return '반차';
  if (s.includes('교육') || s === '교') return '교육';
  if (s.includes('회의') || s === '회') return '회의';
  if (s.includes('HP')) return 'HP';
  return '';
}

function classifyRoleGroup(role: string): string {
  const r = role.trim();
  if (r.includes('점장') || r.includes('SCM')) return '점장·부점장·SCM';
  if (r.includes('대형')) return '대형';
  if (
    r.includes('생활') ||
    r.includes('주방') ||
    r.includes('쿠쿠') ||
    r.includes('KBB') ||
    r.includes('빌트인') ||
    r.includes('계절')
  ) {
    return '생활·주방·쿠쿠·KBB';
  }
  return '애플·모바일·통신';
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

// 2026년 10월 공휴일 (개천절 3, 추석/대체 5~6, 한글날 9)
const HOLIDAYS_BY_MONTH: Record<string, number[]> = {
  '2026-10': [3, 9],
};

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAY_CODE_OPTIONS: { value: DayScheduleCode; label: string; badge: string }[] = [
  { value: '', label: '🟢 정상 출근 (빈칸)', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { value: 'O', label: '🔴 O (정기 휴무)', badge: 'bg-rose-500 text-white border-rose-600' },
  { value: '연차', label: '🟠 연차 휴무', badge: 'bg-amber-500 text-slate-950 border-amber-600' },
  { value: 'V', label: '🟣 V (휴가)', badge: 'bg-purple-600 text-white border-purple-700' },
  { value: '반차', label: '🟡 반차', badge: 'bg-yellow-200 text-yellow-950 border-yellow-400' },
  { value: '교육', label: '🔵 교육', badge: 'bg-sky-500 text-white border-sky-600' },
  { value: '회의', label: '靛 회의', badge: 'bg-indigo-500 text-white border-indigo-600' },
  { value: 'HP', label: '⚡ HP 근무', badge: 'bg-teal-100 text-teal-900 border-teal-300' },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [schedules, setSchedules] = useState<SchedulesMap>(() =>
    loadAllSchedules()
  );
  const [savedName, setSavedName] = useState<string>(() => loadSavedUserName());
  const [nameInput, setNameInput] = useState<string>(() => loadSavedUserName());
  const [isEditingName, setIsEditingName] = useState<boolean>(
    () => !loadSavedUserName()
  );

  // 메인 탭: 'today' (오늘 근무자) | 'full' (전체 휴무표)
  const [activeView, setActiveView] = useState<'today' | 'full'>('today');

  // 현재 선택된 날짜 & 연월 (기본: 오늘 날짜)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth() + 1; // 1 ~ 12
  const currentDay = selectedDate.getDate();
  const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(
    2,
    '0'
  )}`;

  // 파일 업로드 & AI 파싱 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // 전체 휴무표에서 셀 클릭 시 즉시 변경 팝오버
  const [editingCell, setEditingCell] = useState<{
    empName: string;
    empRole: string;
    day: number;
    currentCode: DayScheduleCode;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadedName = loadSavedUserName();
    setSavedName(loadedName);
    setNameInput(loadedName);
    setIsEditingName(!loadedName);
    setSchedules(loadAllSchedules());
  }, [isOpen]);

  const monthData = useMemo(
    () => getOrCreateMonthSchedule(schedules, currentYearMonth),
    [schedules, currentYearMonth]
  );

  const daysInMonth = useMemo(
    () => new Date(currentYear, currentMonth, 0).getDate(),
    [currentYear, currentMonth]
  );

  const handleSaveUserName = (targetName?: string) => {
    const clean = (targetName ?? nameInput).trim();
    if (!clean) return;
    saveUserName(clean);
    setSavedName(clean);
    setNameInput(clean);
    setIsEditingName(false);
  };

  // 월 이동 [◀] / [▶]
  const handleMoveMonth = (delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      const now = new Date();
      if (
        next.getFullYear() === now.getFullYear() &&
        next.getMonth() === now.getMonth()
      ) {
        return now;
      }
      return next;
    });
    setEditingCell(null);
  };

  // 일자 이동 (◀ 어제 / 오늘 / 내일 ▶)
  const handleMoveDay = (delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const handleJumpToToday = () => {
    setSelectedDate(new Date());
  };

  // 특정 셀 스케줄 코드 변경 저장
  const handleUpdateCellCode = (
    empName: string,
    day: number,
    newCode: DayScheduleCode
  ) => {
    const now = new Date();
    const updatedAt = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    const updatedEmployees = baseMonth.employees.map((emp) => {
      if (emp.name !== empName) return emp;
      const nextDays = { ...emp.days };
      if (!newCode) {
        delete nextDays[String(day)];
      } else {
        nextDays[String(day)] = newCode;
      }
      return {
        ...emp,
        days: nextDays,
      };
    });

    const nextSchedules: SchedulesMap = {
      ...schedules,
      [currentYearMonth]: {
        yearMonth: currentYearMonth,
        updatedAt,
        employees: updatedEmployees,
      },
    };

    setSchedules(nextSchedules);
    saveAllSchedules(nextSchedules);
    setEditingCell(null);
  };

  // 사진(JPG/PNG) 또는 엑셀(.xlsx) 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploading(true);
    setNotice({
      type: 'info',
      text: `⏳ [${file.name}] 휴무표를 분석하여 ${currentYear}년 ${currentMonth}월 스케줄에 저장 중입니다...`,
    });

    try {
      const now = new Date();
      const updatedAt = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
        now.getHours()
      ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let targetYearMonth = currentYearMonth;
      let parsedEmployees: EmployeeMonthlySchedule[] = [];

      // 파일명에서 월 추출 시도 (예: 11월 휴무표)
      const monthMatch = file.name.match(/(\d{1,2})\s*월/);
      if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        if (m >= 1 && m <= 12) {
          const yMatch = file.name.match(/20(\d{2})/);
          const y = yMatch ? 2000 + parseInt(yMatch[1], 10) : currentYear;
          targetYearMonth = `${y}-${String(m).padStart(2, '0')}`;
        }
      }

      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: '',
        });

        // 날짜 헤더 행(1~31이 들어있는 행) 탐색
        let dayColMap: Record<number, number> = {}; // day(1~31) -> colIndex
        let nameColIdx = 0;
        let roleColIdx = 1;

        for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx++) {
          const r = rows[rIdx];
          const foundDays: Record<number, number> = {};
          r.forEach((cellVal, cIdx) => {
            const num = parseInt(String(cellVal).trim(), 10);
            if (num >= 1 && num <= 31 && !foundDays[num]) {
              foundDays[num] = cIdx;
            }
            const strVal = String(cellVal).trim();
            if (strVal.includes('성명') || strVal.includes('이름')) {
              nameColIdx = cIdx;
            }
            if (strVal.includes('담당') || strVal.includes('직책')) {
              roleColIdx = cIdx;
            }
          });
          if (Object.keys(foundDays).length >= 20) {
            dayColMap = foundDays;
            break;
          }
        }

        const baseEmps = getOrCreateMonthSchedule(
          schedules,
          targetYearMonth
        ).employees;
        const empList: EmployeeMonthlySchedule[] = [];

        for (const r of rows) {
          const rawName = String(r[nameColIdx] || '').trim();
          if (
            !rawName ||
            rawName.includes('성명') ||
            rawName.includes('이름') ||
            rawName.includes('구분') ||
            rawName.includes('합계') ||
            rawName.length > 6
          ) {
            continue;
          }
          // 기존 직원 명단 또는 한글 2~4자 이름인지 확인
          const matchedBase = baseEmps.find((e) => e.name === rawName);
          if (matchedBase || /^[가-힣]{2,4}$/.test(rawName)) {
            const days: Record<string, DayScheduleCode> = {};
            Object.entries(dayColMap).forEach(([dayStr, colIdx]) => {
              const code = normalizeScheduleCode(String(r[colIdx] || ''));
              if (code) {
                days[dayStr] = code;
              }
            });
            empList.push({
              name: rawName,
              role:
                String(r[roleColIdx] || '').trim() ||
                matchedBase?.role ||
                '매장',
              days,
            });
          }
        }

        if (empList.length === 0) {
          throw new Error(
            '엑셀 파일에서 직원 성명 및 1~31일 휴무 데이터를 찾지 못했습니다.'
          );
        }
        parsedEmployees = empList;
      } else {
        // 이미지(JPG/PNG) — Gemini Vision AI 자동 인식
        const apiKey = getEffectiveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            'Gemini API 키가 설정되지 않아 사진 인식을 사용할 수 없습니다.'
          );
        }

        const { base64Data, mimeType } = await compressImageFile(file);
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `당신은 롯데하이마트 경기광주점 월간 근무/휴무표 이미지를 정확하게 읽어내는 전문 스케줄 파서입니다.
이미지에서 연월(YYYY-MM)과 각 직원의 성명(name), 담당(role), 그리고 1일부터 31일까지 표시된 기호를 읽어 순수 JSON으로만 응답하세요. 마크다운 코드블록 없이 JSON만 반환하세요.

기호 분류 규칙 (출근일 빈칸은 생략하고 아래 기호가 있는 날짜만 days 객체에 기록):
- "O": O, 휴무, 정기휴무
- "연차": 연차
- "V": V, 휴가
- "반차": 반차
- "교육": 교육
- "회의": 회의
- "HP": HP

반환 JSON 스키마:
{
  "yearMonth": "${targetYearMonth}",
  "employees": [
    {
      "name": "권태영",
      "role": "대형",
      "days": {
        "5": "O",
        "6": "연차",
        "20": "V"
      }
    }
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });

        const rawText = (response.text || '').trim();
        const cleanedJson = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();

        const parsedAi = JSON.parse(cleanedJson);
        if (
          typeof parsedAi.yearMonth === 'string' &&
          /^\d{4}-\d{2}$/.test(parsedAi.yearMonth.trim())
        ) {
          targetYearMonth = parsedAi.yearMonth.trim();
        }

        if (Array.isArray(parsedAi.employees) && parsedAi.employees.length > 0) {
          parsedEmployees = parsedAi.employees.map((emp: any) => {
            const cleanDays: Record<string, DayScheduleCode> = {};
            if (emp.days && typeof emp.days === 'object') {
              Object.entries(emp.days).forEach(([dKey, val]) => {
                const code = normalizeScheduleCode(String(val || ''));
                if (code) {
                  cleanDays[String(parseInt(dKey, 10))] = code;
                }
              });
            }
            return {
              name: String(emp.name || '').trim(),
              role: String(emp.role || '매장').trim(),
              days: cleanDays,
            };
          });
        } else {
          throw new Error('이미지에서 직원별 휴무 데이터를 인식하지 못했습니다.');
        }
      }

      const nextSchedules: SchedulesMap = {
        ...schedules,
        [targetYearMonth]: {
          yearMonth: targetYearMonth,
          updatedAt,
          employees: parsedEmployees,
        },
      };

      setSchedules(nextSchedules);
      saveAllSchedules(nextSchedules);

      // 업로드된 연월로 화면 자동 이동
      const [yStr, mStr] = targetYearMonth.split('-');
      setSelectedDate(new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1));

      setNotice({
        type: 'success',
        text: `✅ [${targetYearMonth}] 휴무표 (${parsedEmployees.length}명)가 내 기기에 영구 저장되었습니다!`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text:
          err?.message ||
          '휴무표 파일 분석 중 오류가 발생했습니다. 선명한 사진이나 엑셀 파일을 업로드해 주세요.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetCurrentMonth = () => {
    if (currentYearMonth === '2026-10') {
      const next: SchedulesMap = {
        ...schedules,
        '2026-10': DEFAULT_2026_10_SCHEDULE,
      };
      setSchedules(next);
      saveAllSchedules(next);
      setNotice({
        type: 'info',
        text: '2026년 10월 기본 휴무표 데이터로 복원되었습니다.',
      });
    }
  };

  // 내 이름에 해당하는 직원 스케줄 정보 및 요약 계산
  const myEmployee = useMemo(() => {
    if (!savedName) return null;
    return (
      monthData.employees.find((e) => e.name === savedName) ||
      monthData.employees.find((e) => e.name.includes(savedName)) ||
      null
    );
  }, [monthData, savedName]);

  const myTodayCode: DayScheduleCode = useMemo(() => {
    if (!myEmployee) return '';
    return myEmployee.days[String(currentDay)] || '';
  }, [myEmployee, currentDay]);

  const myRemainingOffDays = useMemo(() => {
    if (!myEmployee) return [];
    const list: { day: number; code: DayScheduleCode }[] = [];
    for (let d = currentDay; d <= daysInMonth; d++) {
      const c = myEmployee.days[String(d)];
      if (isOffDayCode(c)) {
        list.push({ day: d, code: c });
      }
    }
    return list;
  }, [myEmployee, currentDay, daysInMonth]);

  // 선택된 날짜 기준 🟢 오늘 근무자 vs 🔴 오늘 휴무/연차/교육자 분류
  const { workingByGroup, restingList } = useMemo(() => {
    const groups: Record<
      string,
      { name: string; role: string; code: DayScheduleCode }[]
    > = {
      '점장·부점장·SCM': [],
      대형: [],
      '생활·주방·쿠쿠·KBB': [],
      '애플·모바일·통신': [],
    };
    const resting: { name: string; role: string; code: DayScheduleCode }[] = [];

    monthData.employees.forEach((emp) => {
      const code = emp.days[String(currentDay)] || '';
      if (
        code === 'O' ||
        code === '연차' ||
        code === 'V' ||
        code === '교육' ||
        code === '회의'
      ) {
        resting.push({ name: emp.name, role: emp.role, code });
      } else {
        const gKey = classifyRoleGroup(emp.role);
        if (!groups[gKey]) groups[gKey] = [];
        groups[gKey].push({ name: emp.name, role: emp.role, code });
      }
    });

    return { workingByGroup: groups, restingList: resting };
  }, [monthData, currentDay]);

  // 전체 휴무표에서 내 이름이 있으면 최상단에도 고정/하이라이트하기 위한 정렬 목록
  const sortedEmployeesForTable = useMemo(() => {
    if (!savedName) return monthData.employees;
    const me = monthData.employees.filter((e) => e.name === savedName);
    const others = monthData.employees.filter((e) => e.name !== savedName);
    return [...me, ...others];
  }, [monthData.employees, savedName]);

  if (!isOpen) return null;

  const selectedWeekday = WEEKDAY_KO[selectedDate.getDay()];
  const todayReal = new Date();
  const isSelectedToday =
    selectedDate.getFullYear() === todayReal.getFullYear() &&
    selectedDate.getMonth() === todayReal.getMonth() &&
    selectedDate.getDate() === todayReal.getDate();

  const renderCodeBadge = (code: DayScheduleCode, compact = false) => {
    if (!code) return null;
    const baseCls = compact
      ? 'px-1 py-0.5 rounded text-[10px] font-black leading-none inline-block'
      : 'px-2 py-0.5 rounded-md text-xs font-black inline-block';
    switch (code) {
      case 'O':
        return (
          <span className={`${baseCls} bg-rose-500 text-white`}>O</span>
        );
      case '연차':
        return (
          <span className={`${baseCls} bg-amber-400 text-slate-950`}>연차</span>
        );
      case 'V':
        return (
          <span className={`${baseCls} bg-purple-600 text-white`}>V</span>
        );
      case '반차':
        return (
          <span className={`${baseCls} bg-yellow-200 text-yellow-950 border border-yellow-400`}>
            반차
          </span>
        );
      case '교육':
        return (
          <span className={`${baseCls} bg-sky-500 text-white`}>교육</span>
        );
      case '회의':
        return (
          <span className={`${baseCls} bg-indigo-500 text-white`}>회의</span>
        );
      case 'HP':
        return (
          <span className={`${baseCls} bg-teal-100 text-teal-900 border border-teal-300`}>
            HP
          </span>
        );
      default:
        return <span className={baseCls}>{code}</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1440px] max-h-[94dvh] rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 숨김 파일 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* 1) 모달 상단 헤더 */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black tracking-tight truncate">
                📅 경기광주점 근무 · 휴무표 ({currentYear}년 {currentMonth}월)
              </h2>
              <p className="text-[11px] text-slate-300 font-bold hidden sm:block">
                내 이름 1회 저장 시 내 휴무 카운트다운 연동 · 사진/엑셀 업로드 시 내 기기에 월별 영구 저장
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 저장된 내 이름 표시 & [⚙️ 이름 수정] 버튼 */}
            {savedName && !isEditingName && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-black text-amber-300">
                <span>👤 {savedName}님</span>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="px-2 py-0.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-black transition cursor-pointer"
                >
                  ⚙️ 이름 수정
                </button>
              </div>
            )}

            {/* [📤 휴무표 사진/엑셀 업로드] 버튼 */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>
                {isUploading
                  ? '휴무표 분석 중...'
                  : '📤 휴무표 사진/엑셀 업로드'}
              </span>
            </button>

            {currentYearMonth === '2026-10' && (
              <button
                type="button"
                onClick={handleResetCurrentMonth}
                title="2026년 10월 기본 휴무표 복원"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-black transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
              <span>닫기</span>
            </button>
          </div>
        </div>

        {/* 알림 배너 */}
        {notice && (
          <div
            className={`px-4 py-2 text-xs font-black flex items-center justify-between gap-2 shrink-0 ${
              notice.type === 'success'
                ? 'bg-emerald-600 text-white'
                : notice.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-sky-600 text-white'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-0.5 rounded hover:bg-black/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 상단 내 이름 1회 입력 바 (미설정 또는 [⚙️ 이름 수정] 클릭 시에만 노출, 저장 시 자동 숨김) */}
        {isEditingName && (
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 border-b-2 border-amber-400 space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-amber-300">
                <UserCheck className="w-4 h-4" />
                <span>
                  내 이름 1회 설정 (저장 시 입력창이 자동으로 숨겨지며 메인 홈 졸라맨 카운트다운이 작동합니다)
                </span>
              </div>
              {savedName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  닫기
                </button>
              )}
            </div>

            {/* 직접 입력 + 저장 버튼 */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveUserName();
                }}
                placeholder="내 이름 입력 (예: 권태영)"
                className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs sm:text-sm font-black text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400 w-48 sm:w-60"
              />
              <button
                type="button"
                onClick={() => handleSaveUserName()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>저장</span>
              </button>
              <span className="text-[11px] font-bold text-slate-400">
                또는 아래 직원 이름을 터치하면 즉시 저장됩니다 👇
              </span>
            </div>

            {/* 경기광주점 19명 원터치 선택 칩 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {monthData.employees.map((emp) => (
                <button
                  key={emp.name}
                  type="button"
                  onClick={() => handleSaveUserName(emp.name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black border transition cursor-pointer ${
                    savedName === emp.name
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {emp.name}{' '}
                  <span className="text-[10px] opacity-75">({emp.role})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2) 2개 메인 뷰 버튼 ([👥 오늘 근무자] / [🗓️ 전체 휴무표]) + 월 이동 화살표 ([◀] 2026년 10월 [▶]) */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* 좌측: 2개 메인 뷰 전환 버튼 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('today')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-black border transition cursor-pointer ${
                activeView === 'today'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>👥 오늘 근무자</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('full')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-black border transition cursor-pointer ${
                activeView === 'full'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <Table2 className="w-4 h-4 text-amber-300" />
              <span>🗓️ 전체 휴무표</span>
            </button>
          </div>

          {/* 우측: 월 이동 화살표 [◀] 2026년 10월 [▶] */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <button
              type="button"
              onClick={() => handleMoveMonth(-1)}
              title="이전 달 휴무표"
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-black text-slate-900">
              {currentYear}년 {currentMonth}월
            </span>
            <button
              type="button"
              onClick={() => handleMoveMonth(1)}
              title="다음 달 휴무표"
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 셀 클릭 즉시 편집 바 (전체 휴무표에서 셀 클릭 시) */}
        {editingCell && (
          <div className="bg-amber-50 border-b-2 border-amber-400 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-xs font-black">
                ✏️ {editingCell.empName} ({editingCell.empRole}) · {currentMonth}월{' '}
                {editingCell.day}일 상태 변경:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {DAY_CODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'work'}
                    type="button"
                    onClick={() =>
                      handleUpdateCellCode(
                        editingCell.empName,
                        editingCell.day,
                        opt.value
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border transition cursor-pointer ${
                      editingCell.currentCode === opt.value
                        ? 'ring-2 ring-slate-950 ' + opt.badge
                        : opt.badge + ' opacity-85 hover:opacity-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingCell(null)}
              className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black cursor-pointer"
            >
              닫기
            </button>
          </div>
        )}

        {/* 3) 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-4">
          {/* ==================== [뷰 1: 👥 오늘 근무자] ==================== */}
          {activeView === 'today' && (
            <div className="space-y-4">
              {/* (1) 내 이름이 설정된 경우 최상단 내 스케줄 요약 카드 */}
              {myEmployee && (
                <div className="rounded-2xl bg-slate-900 text-white p-4 border-2 border-amber-400/80 shadow-md flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shrink-0">
                      👤
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-amber-300">
                          {myEmployee.name}님 ({myEmployee.role})
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                            isOffDayCode(myTodayCode)
                              ? 'bg-rose-500 text-white'
                              : myTodayCode
                              ? 'bg-sky-500 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {currentMonth}/{currentDay}({selectedWeekday}) 상태:{' '}
                          {myTodayCode === 'O'
                            ? '🏖️ 정기 휴무(O)'
                            : myTodayCode === '연차'
                            ? '🌴 연차 휴무'
                            : myTodayCode === 'V'
                            ? '✈️ 휴가(V)'
                            : myTodayCode
                            ? `📌 ${myTodayCode}`
                            : '💪 정상 근무'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        이번 달 남은 내 휴무(O·연차·V):{' '}
                        <strong className="text-amber-300">
                          총 {myRemainingOffDays.length}일
                        </strong>{' '}
                        {myRemainingOffDays.length > 0 && (
                          <span className="text-slate-400">
                            (
                            {myRemainingOffDays
                              .map((d) => `${d.day}일(${d.code})`)
                              .join(', ')}
                            )
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* (2) 날짜 네비게이터 (◀ 어제 / 오늘 / 내일 ▶) */}
              <div className="rounded-2xl bg-white border border-slate-200 p-3 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMoveDay(-1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>어제</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      isSelectedToday
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    오늘로 이동
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMoveDay(1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition cursor-pointer"
                  >
                    <span>내일</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-sm sm:text-base font-black text-slate-900">
                  📆 {currentYear}년 {currentMonth}월 {currentDay}일 (
                  <span
                    className={
                      selectedDate.getDay() === 0
                        ? 'text-rose-600'
                        : selectedDate.getDay() === 6
                        ? 'text-blue-600'
                        : 'text-slate-900'
                    }
                  >
                    {selectedWeekday}요일
                  </span>
                  )
                </div>

                <div className="flex items-center gap-2 text-xs font-black">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    🟢 근무 {monthData.employees.length - restingList.length}명
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                    🔴 휴무·연차·교육 {restingList.length}명
                  </span>
                </div>
              </div>

              {/* (3) 🟢 오늘 근무자 명단 & 🔴 오늘 휴무·연차·교육자 명단 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 좌측 7칸: 🟢 오늘 근무자 명단 (파트별 분류) */}
                <div className="lg:col-span-7 rounded-2xl bg-white border-2 border-emerald-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-1.5">
                      <span>🟢 오늘 근무자 명단</span>
                    </h3>
                    <span className="text-xs font-black text-emerald-700">
                      총 {monthData.employees.length - restingList.length}명 근무
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(workingByGroup).map(([groupTitle, list]) => (
                      <div
                        key={groupTitle}
                        className="rounded-xl bg-emerald-50/60 border border-emerald-200/80 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-950">
                            ▪ {groupTitle}
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-700">
                            {list.length}명
                          </span>
                        </div>
                        {list.length === 0 ? (
                          <p className="text-xs font-bold text-slate-400">
                            근무자 없음 (전원 휴무)
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {list.map((emp) => {
                              const isMe = emp.name === savedName;
                              return (
                                <span
                                  key={emp.name}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                                    isMe
                                      ? 'bg-amber-300 text-slate-950 border-amber-500 shadow-2xs'
                                      : 'bg-white text-slate-900 border-emerald-200'
                                  }`}
                                >
                                  <span>{emp.name}</span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    ({emp.role})
                                  </span>
                                  {emp.code && renderCodeBadge(emp.code, true)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 우측 5칸: 🔴 오늘 휴무·연차·교육자 명단 */}
                <div className="lg:col-span-5 rounded-2xl bg-white border-2 border-rose-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm sm:text-base font-black text-rose-950 flex items-center gap-1.5">
                      <span>🔴 오늘 휴무 · 연차 · 교육자 명단</span>
                    </h3>
                    <span className="text-xs font-black text-rose-700">
                      총 {restingList.length}명
                    </span>
                  </div>

                  {restingList.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400">
                      선택하신 날짜에는 휴무·연차·교육자가 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {restingList.map((emp) => {
                        const isMe = emp.name === savedName;
                        return (
                          <div
                            key={emp.name}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              isMe
                                ? 'bg-amber-100 border-amber-400'
                                : 'bg-rose-50/60 border-rose-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                {emp.name}
                              </div>
                              <div className="text-[11px] font-bold text-slate-500 truncate">
                                {emp.role}
                              </div>
                            </div>
                            {renderCodeBadge(emp.code)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== [뷰 2: 🗓️ 전체 휴무표] ==================== */}
          {activeView === 'full' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-xs font-black text-slate-700">
                  💡 표의 날짜 칸을 터치하면 해당 직원의 휴무/연차/교육을 즉시 수정할 수 있습니다.
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black">
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-white">
                    O 정기휴무
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                    연차
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white">
                    V 휴가
                  </span>
                  <span className="px-2 py-0.5 rounded bg-yellow-200 text-yellow-950 border border-yellow-400">
                    반차
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500 text-white">
                    교육
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500 text-white">
                    회의
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
                <table className="w-full border-collapse min-w-[1150px] text-center">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="sticky left-0 z-20 bg-slate-900 w-20 px-2 py-2 text-xs font-black border-r border-b border-slate-700">
                        성명
                      </th>
                      <th className="sticky left-20 z-20 bg-slate-900 w-24 px-2 py-2 text-xs font-black border-r border-b border-slate-700">
                        담당
                      </th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                        (d) => {
                          const dateObj = new Date(
                            currentYear,
                            currentMonth - 1,
                            d
                          );
                          const dow = dateObj.getDay();
                          const isHoliday = (
                            HOLIDAYS_BY_MONTH[currentYearMonth] || []
                          ).includes(d);
                          const isTodayCol =
                            todayReal.getFullYear() === currentYear &&
                            todayReal.getMonth() + 1 === currentMonth &&
                            todayReal.getDate() === d;

                          return (
                            <th
                              key={d}
                              onClick={() =>
                                setSelectedDate(
                                  new Date(currentYear, currentMonth - 1, d)
                                )
                              }
                              className={`px-1 py-1.5 border-r border-b border-slate-700 cursor-pointer transition ${
                                isTodayCol
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'hover:bg-slate-800'
                              }`}
                            >
                              <div
                                className={`text-xs font-black ${
                                  isTodayCol
                                    ? 'text-slate-950'
                                    : dow === 0 || isHoliday
                                    ? 'text-rose-400'
                                    : dow === 6
                                    ? 'text-sky-400'
                                    : 'text-white'
                                }`}
                              >
                                {d}
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  isTodayCol
                                    ? 'text-slate-900'
                                    : dow === 0 || isHoliday
                                    ? 'text-rose-300'
                                    : dow === 6
                                    ? 'text-sky-300'
                                    : 'text-slate-400'
                                }`}
                              >
                                {WEEKDAY_KO[dow]}
                              </div>
                            </th>
                          );
                        }
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployeesForTable.map((emp) => {
                      const isMe = emp.name === savedName;
                      return (
                        <tr
                          key={emp.name}
                          className={`border-b border-slate-200 last:border-b-0 ${
                            isMe
                              ? 'bg-amber-50/95 font-black'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className={`sticky left-0 z-10 px-2 py-2 text-xs font-black border-r border-slate-300 ${
                              isMe
                                ? 'bg-amber-300 text-slate-950'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            {isMe ? `⭐${emp.name}` : emp.name}
                          </td>
                          <td
                            className={`sticky left-20 z-10 px-1.5 py-2 text-[11px] font-bold border-r border-slate-300 truncate ${
                              isMe
                                ? 'bg-amber-200 text-slate-900'
                                : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {emp.role}
                          </td>
                          {Array.from(
                            { length: daysInMonth },
                            (_, i) => i + 1
                          ).map((d) => {
                            const code = emp.days[String(d)] || '';
                            const isTodayCol =
                              todayReal.getFullYear() === currentYear &&
                              todayReal.getMonth() + 1 === currentMonth &&
                              todayReal.getDate() === d;
                            return (
                              <td
                                key={`${emp.name}-${d}`}
                                onClick={() =>
                                  setEditingCell({
                                    empName: emp.name,
                                    empRole: emp.role,
                                    day: d,
                                    currentCode: code,
                                  })
                                }
                                className={`px-0.5 py-1.5 border-r border-slate-200 last:border-r-0 cursor-pointer transition ${
                                  isTodayCol
                                    ? 'bg-amber-100/80 ring-1 ring-inset ring-amber-400'
                                    : isMe
                                    ? 'bg-amber-50/70'
                                    : ''
                                }`}
                              >
                                {renderCodeBadge(code, true)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
