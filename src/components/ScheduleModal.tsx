import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
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
export const SCHEDULES_STORAGE_KEY = 'himart_gj_schedules_v2';
export const SCHEDULE_UPDATED_EVENT = 'himart_gj_schedule_updated';

const OBSOLETE_FAKE_NAMES = new Set([
  '이현구',
  '박정우',
  '정아름',
  '최윤호',
  '한정우',
  '권태영',
  '조시형',
  '오현실',
  '문지선',
  '박경진',
  '백희진',
  '김란희',
  '이재성',
  '이승환',
  '심지혜',
  '지상현',
  '유현승',
  '조민혁',
  '노재성',
]);

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

export const DEFAULT_2026_10_EMPLOYEES: EmployeeMonthlySchedule[] = [
  {
    name: '강석원',
    role: '점장',
    days: {
      1: 'O',
      6: 'O',
      8: 'O',
      9: 'O',
      14: '연차',
      15: 'O',
      20: 'O',
      21: 'O',
      23: 'O',
      28: 'O',
    },
  },
  {
    name: '김재훈',
    role: '부점장',
    days: {
      2: '연차',
      7: 'O',
      10: 'O',
      12: 'O',
      16: 'O',
      19: 'O',
      22: 'O',
      23: '연차',
      25: 'O',
      26: 'O',
      27: '회의',
      29: 'O',
      31: 'O',
    },
  },
  {
    name: '국지현',
    role: 'SCM',
    days: {
      1: 'O',
      5: 'O',
      6: 'O',
      11: 'O',
      13: 'O',
      14: 'O',
      17: '연차',
      21: 'O',
      26: 'O',
      28: 'O',
    },
  },
  {
    name: '심우영',
    role: '선임/대형',
    days: {
      1: 'O',
      7: 'O',
      8: 'O',
      13: 'O',
      16: 'O',
      19: 'V',
      20: 'V',
      21: 'V',
      22: 'O',
      23: 'O',
      27: 'O',
      30: 'O',
    },
  },
  {
    name: '정충영',
    role: '대형',
    days: {
      2: 'O',
      5: 'O',
      7: 'O',
      8: 'O',
      12: 'O',
      15: 'O',
      19: 'O',
      22: 'O',
      26: 'O',
      27: 'O',
      29: '연차',
    },
  },
  {
    name: '한세희',
    role: '대형',
    days: {
      1: 'O',
      5: 'O',
      8: 'O',
      12: 'O',
      14: 'O',
      17: 'O',
      18: '연차',
      20: 'O',
      24: 'O',
      27: 'O',
      30: 'O',
    },
  },
  {
    name: '김태형',
    role: '대형',
    days: {
      1: 'O',
      6: 'O',
      9: 'O',
      13: 'O',
      15: 'O',
      19: 'O',
      22: 'O',
      26: 'O',
      28: 'O',
      29: 'O',
    },
  },
  {
    name: '한춘애',
    role: '대형',
    days: {
      1: 'O',
      5: 'O',
      7: 'O',
      9: 'O',
      12: 'O',
      16: 'O',
      20: 'O',
      21: '연차',
      23: '연차',
      27: 'O',
      28: 'O',
      29: 'O',
    },
  },
  {
    name: '손경민',
    role: '생활',
    days: {
      2: '연차',
      6: 'O',
      9: 'O',
      13: 'O',
      16: 'O',
      19: 'O',
      21: 'O',
      24: 'O',
      26: 'O',
      29: 'V',
      30: 'V',
      31: 'V',
    },
  },
  {
    name: '박기복',
    role: '주방',
    days: {
      1: '연차',
      4: '연차',
      5: 'V',
      6: 'V',
      7: 'V',
      8: '연차',
      10: 'O',
      13: 'O',
      15: 'O',
      17: 'O',
      20: 'O',
      23: 'O',
      25: 'O',
      27: 'O',
      31: 'O',
    },
  },
  {
    name: '최문기',
    role: '쿠쿠',
    days: {
      2: '연차',
      7: 'O',
      8: 'O',
      11: 'O',
      12: 'O',
      15: 'O',
      16: 'O',
      19: 'O',
      22: '교육',
      23: 'O',
      26: 'O',
      29: 'O',
    },
  },
  {
    name: '윤현주',
    role: '쿠쿠',
    days: {
      3: 'O',
      6: 'O',
      9: 'O',
      13: 'O',
      14: 'O',
      18: 'O',
      20: '반차',
      21: 'O',
      22: '교육',
      26: 'O',
      30: 'O',
    },
  },
  {
    name: '한나라',
    role: '생활',
    days: {
      1: 'O',
      4: 'O',
      5: 'O',
      9: 'O',
      13: 'O',
      14: 'O',
      17: 'O',
      21: 'O',
      24: 'O',
      25: 'O',
      28: 'O',
      31: 'O',
    },
  },
  {
    name: '권지혜',
    role: 'KBB',
    days: {
      2: 'O',
      6: 'O',
      7: 'O',
      10: 'O',
      12: 'O',
      16: 'O',
      18: 'O',
      19: 'O',
      20: '교육',
      22: 'O',
      23: 'O',
      26: 'O',
      27: 'V',
      28: 'V',
      29: '연차',
      30: '연차',
      31: '연차',
    },
  },
  {
    name: '서형래',
    role: '애플',
    days: {
      2: 'O',
      5: 'O',
      6: 'O',
      7: 'HP',
      9: 'O',
      12: 'O',
      15: 'O',
      16: 'O',
      17: '반차',
      20: 'O',
      23: 'O',
      26: 'O',
      27: 'O',
      30: 'O',
      31: '연차',
    },
  },
  {
    name: '김지우',
    role: '모바일',
    days: {
      1: 'O',
      6: 'O',
      7: 'O',
      8: 'O',
      11: '연차',
      13: 'O',
      14: 'O',
      18: '연차',
      19: '연차',
      20: 'O',
      21: 'O',
      24: 'O',
      28: 'O',
      29: 'O',
    },
  },
  {
    name: '김도인',
    role: 'SKT',
    days: {
      5: 'O',
      8: 'O',
      12: 'O',
      15: 'O',
      19: 'O',
      20: 'O',
      23: 'O',
      27: 'O',
      30: 'O',
    },
  },
  {
    name: '정태일',
    role: 'LGU',
    days: {
      1: 'O',
      6: 'O',
      7: 'O',
      13: 'O',
      14: 'O',
      21: 'O',
      22: 'O',
      25: 'O',
      28: 'O',
      29: 'O',
    },
  },
  {
    name: '주형남',
    role: 'KT',
    days: {
      2: 'O',
      9: 'O',
      12: 'O',
      15: 'O',
      16: 'O',
      23: 'O',
      26: 'O',
      27: 'O',
      30: '연차',
    },
  },
];

export const DEFAULT_2026_10_SCHEDULE: MonthlyScheduleData = {
  yearMonth: '2026-10',
  updatedAt: '2026-10-01 09:00',
  employees: DEFAULT_2026_10_EMPLOYEES,
};

export function loadSavedUserName(): string {
  try {
    const raw = localStorage.getItem(USER_NAME_STORAGE_KEY)?.trim() || '';
    if (raw && OBSOLETE_FAKE_NAMES.has(raw)) {
      localStorage.removeItem(USER_NAME_STORAGE_KEY);
      return '';
    }
    return raw;
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
    // 구버전 가짜 데이터 키 삭제
    localStorage.removeItem('himart_gj_schedules_v1');

    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!raw) {
      const initial: SchedulesMap = { '2026-10': DEFAULT_2026_10_SCHEDULE };
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as SchedulesMap;
    if (!parsed || typeof parsed !== 'object') {
      const initial: SchedulesMap = { '2026-10': DEFAULT_2026_10_SCHEDULE };
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    // 만약 어떤 월에든 가짜 직원 이름(이현구, 권태영 등)이 들어있으면 즉시 폐기 후 실제 19명 데이터로 강제 초기화
    let hasFakeEmployee = false;
    for (const ymKey of Object.keys(parsed)) {
      const emps = parsed[ymKey]?.employees;
      if (
        Array.isArray(emps) &&
        emps.some((e) => OBSOLETE_FAKE_NAMES.has((e?.name || '').trim()))
      ) {
        hasFakeEmployee = true;
        break;
      }
    }

    if (hasFakeEmployee) {
      const resetMap: SchedulesMap = { '2026-10': DEFAULT_2026_10_SCHEDULE };
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(resetMap));
      return resetMap;
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
  // 등록되지 않은 새 월은 실제 직원 19명 명단만 유지하고 일별 휴무는 빈 상태로 생성
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
  const r = role.trim().toUpperCase();
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

// 2026년 10월 공휴일 (개천절 3, 한글날 9)
const HOLIDAYS_BY_MONTH: Record<string, number[]> = {
  '2026-10': [3, 9],
};

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAY_CODE_OPTIONS: {
  value: DayScheduleCode;
  label: string;
  badge: string;
}[] = [
  {
    value: '',
    label: '🟢 정상 출근 (빈칸)',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  {
    value: 'O',
    label: '🔴 O (정기 휴무)',
    badge: 'bg-rose-500 text-white border-rose-600',
  },
  {
    value: '연차',
    label: '🟠 연차 휴무',
    badge: 'bg-amber-500 text-slate-950 border-amber-600',
  },
  {
    value: 'V',
    label: '🟣 V (휴가)',
    badge: 'bg-purple-600 text-white border-purple-700',
  },
  {
    value: '반차',
    label: '🟡 반차',
    badge: 'bg-yellow-200 text-yellow-950 border-yellow-400',
  },
  {
    value: '교육',
    label: '🔵 교육',
    badge: 'bg-sky-500 text-white border-sky-600',
  },
  {
    value: '회의',
    label: '🟣 회의',
    badge: 'bg-indigo-500 text-white border-indigo-600',
  },
  {
    value: 'HP',
    label: '⚡ HP 근무',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
  },
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

        let dayColMap: Record<number, number> = {};
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
            rawName.length > 6 ||
            OBSOLETE_FAKE_NAMES.has(rawName)
          ) {
            continue;
          }
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
        // 이미지(JPG/PNG) — Gemini Vision AI 자동 인식 (4개 모델 순차 폴백)
        const apiKey = getEffectiveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            'Gemini API 키가 설정되지 않아 사진 인식을 사용할 수 없습니다.'
          );
        }

        const compressed = await compressImageFile(file);
        const base64Data = compressed.base64 || compressed.base64Data;
        const mimeType = compressed.mimeType;
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `당신은 롯데하이마트 경기광주점 월간 근무/휴무표 이미지를 정확하게 읽어내는 전문 스케줄 파서입니다.
이미지에서 연월(YYYY-MM)과 각 직원의 성명(name), 담당(role), 그리고 1일부터 31일까지 표시된 기호를 읽어 순수 JSON으로만 응답하세요. 마크다운 코드블록 없이 JSON만 반환하세요.

경기광주점 주요 직원 명단 참고:
강석원(점장), 김재훈(부점장), 국지현(SCM), 심우영(선임/대형), 정충영(대형), 한세희(대형), 김태형(대형), 한춘애(대형), 손경민(생활), 박기복(주방), 최문기(쿠쿠), 윤현주(쿠쿠), 한나라(생활), 권지혜(KBB), 서형래(애플), 김지우(모바일), 김도인(SKT), 정태일(LGU), 주형남(KT)

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
      "name": "강석원",
      "role": "점장",
      "days": {
        "1": "O",
        "6": "O",
        "14": "연차"
      }
    }
  ]
}`;

        const GEMINI_MODELS = [
          'gemini-3-flash-preview',
          'gemini-flash-latest',
          'gemini-2.5-pro',
          'gemini-2.5-flash',
        ];

        let rawText = '';
        let lastError: any = null;

        for (const modelName of GEMINI_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
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
            if (response.text) {
              rawText = response.text.trim();
              break;
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (!rawText) {
          throw (
            lastError ||
            new Error('휴무표 이미지 AI 분석에 실패했습니다.')
          );
        }

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

        if (
          Array.isArray(parsedAi.employees) &&
          parsedAi.employees.length > 0
        ) {
          parsedEmployees = parsedAi.employees
            .filter(
              (emp: any) =>
                !OBSOLETE_FAKE_NAMES.has(String(emp?.name || '').trim())
            )
            .map((emp: any) => {
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
          throw new Error(
            '이미지에서 직원별 휴무 데이터를 인식하지 못했습니다.'
          );
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
        text: '2026년 10월 경기광주점 19명 기본 휴무표 데이터로 복원되었습니다.',
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

  // 전체 휴무표에서 내 이름이 있으면 최상단 첫 번째 행으로 고정/강조 배치
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

  const renderCodeBadge = (
    code: DayScheduleCode,
    compact = false,
    dayNumberForCell?: number
  ) => {
    if (!code) return null;
    const baseCls = compact
      ? 'px-1 py-0.5 rounded text-[10px] font-black leading-none inline-block'
      : 'px-2 py-0.5 rounded-md text-xs font-black inline-block';

    let badgeEl: React.ReactNode;
    switch (code) {
      case 'O':
        badgeEl = (
          <span className={`${baseCls} bg-rose-500 text-white`}>O</span>
        );
        break;
      case '연차':
        badgeEl = (
          <span className={`${baseCls} bg-amber-400 text-slate-950`}>연차</span>
        );
        break;
      case 'V':
        badgeEl = (
          <span className={`${baseCls} bg-purple-600 text-white`}>V</span>
        );
        break;
      case '반차':
        badgeEl = (
          <span
            className={`${baseCls} bg-yellow-200 text-yellow-950 border border-yellow-400`}
          >
            반차
          </span>
        );
        break;
      case '교육':
        badgeEl = (
          <span className={`${baseCls} bg-sky-500 text-white`}>교육</span>
        );
        break;
      case '회의':
        badgeEl = (
          <span className={`${baseCls} bg-indigo-500 text-white`}>회의</span>
        );
        break;
      case 'HP':
        badgeEl = (
          <span
            className={`${baseCls} bg-teal-100 text-teal-900 border border-teal-300`}
          >
            HP
          </span>
        );
        break;
      default:
        badgeEl = <span className={baseCls}>{code}</span>;
    }

    if (dayNumberForCell !== undefined) {
      return (
        <div className="flex flex-col items-center justify-center leading-none gap-0.5">
          <span className="text-[9px] font-extrabold text-slate-500 leading-none">
            {dayNumberForCell}일
          </span>
          {badgeEl}
        </div>
      );
    }

    return badgeEl;
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
                placeholder="내 이름 입력 (예: 강석원)"
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
                또는 아래 경기광주점 직원 이름을 터치하면 즉시 저장됩니다 👇
              </span>
            </div>

            {/* 경기광주점 실제 직원 19명 원터치 선택 칩 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {DEFAULT_2026_10_EMPLOYEES.map((emp) => (
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

          {/* ==================== [뷰 2: 🗓️ 전체 휴무표 (상단 날짜 Sticky 고정 + 셀 내부 날짜 표기)] ==================== */}
          {activeView === 'full' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-xs font-black text-slate-700">
                  💡 아래로 내려도 상단 날짜가 항상 고정됩니다 · 날짜 칸을 터치하면 즉시 상태를 수정할 수 있습니다.
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

              {/* 고정 높이 스크롤 래퍼: 상단 날짜 행(sticky top-0)과 좌측 성명 열(sticky left-0) 동시 고정 */}
              <div className="w-full max-h-[56dvh] overflow-auto relative rounded-2xl border border-slate-300 bg-white shadow-sm">
                <table className="w-full border-collapse min-w-[1200px] text-center">
                  <thead>
                    <tr className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm">
                      <th className="sticky top-0 left-0 z-30 bg-slate-900 w-32 min-w-[128px] px-2 py-2 text-xs font-black border-r border-b border-slate-700">
                        성명 (담당)
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
                              className={`sticky top-0 z-20 px-1 py-1.5 border-r border-b border-slate-700 cursor-pointer transition ${
                                isTodayCol
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-900 hover:bg-slate-800'
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
                                {d}일
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
                            className={`sticky left-0 z-10 px-2 py-2 text-xs font-black border-r border-slate-300 whitespace-nowrap ${
                              isMe
                                ? 'bg-amber-300 text-slate-950 shadow-2xs'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <span>{isMe ? `⭐${emp.name}` : emp.name}</span>
                            <span
                              className={`ml-1 text-[10px] font-bold ${
                                isMe ? 'text-slate-800' : 'text-slate-500'
                              }`}
                            >
                              ({emp.role})
                            </span>
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
                                className={`px-0.5 py-1 border-r border-slate-200 last:border-r-0 cursor-pointer transition align-middle ${
                                  isTodayCol
                                    ? 'bg-amber-100/80 ring-1 ring-inset ring-amber-400'
                                    : isMe
                                    ? 'bg-amber-50/70'
                                    : ''
                                }`}
                              >
                                {renderCodeBadge(
                                  code,
                                  true,
                                  code ? d : undefined
                                )}
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
