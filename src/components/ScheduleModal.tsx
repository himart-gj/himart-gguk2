import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from '@google/genai';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Table2,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  compressImageFile,
  getEffectiveGeminiApiKey,
} from '../utils/aiImageParser';
import {
  GitHubSyncConfig,
  loadGitHubSyncConfig,
} from '../utils/careTableParser';

export const USER_NAME_STORAGE_KEY = 'himart_gj_user_name';
export const SCHEDULES_STORAGE_KEY = 'himart_gj_schedules_v4';
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

// 성명 패턴 스캔 시 제외할 직책/근태/요약 키워드
const NON_NAME_KEYWORDS = new Set([
  '합계',
  '총계',
  '소계',
  '총인원',
  '총근무인원',
  '근무인원',
  '결원',
  '사용연차',
  '성명',
  '이름',
  '사원명',
  '직원명',
  '성함',
  '근무자',
  '구분',
  '담당',
  '직책',
  '부서',
  '코너',
  '직급',
  '파트',
  '비고',
  '대형',
  '생활',
  '주방',
  '쿠쿠',
  '모바일',
  '애플',
  '통신',
  '점장',
  '부점장',
  '지점장',
  '판매사',
  '선임',
  '수석',
  '책임',
  '사원',
  '대리',
  '과장',
  '차장',
  '부장',
  '연차',
  '반차',
  '교육',
  '회의',
  '휴무',
  '휴가',
  '정상',
  '출근',
  '근무',
  '오전',
  '오후',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
  '일요일',
  '일자',
  '날짜',
  '요일',
  '페이지',
  '오전반차',
  '오후반차',
  '정규휴무',
  '정기휴무',
  '특별휴가',
  '연차휴가',
  '정상근무',
  '출장',
  '하계',
  '동계',
  '리프',
  '출휴',
  '출산휴가',
]);

export type DayScheduleCode =
  | '' // 정상 출근
  | 'O' // 정기 휴무
  | '연차' // 연차
  | 'V' // 휴가(Summer/Refresh)
  | '반차' // 반차
  | '교육' // 교육
  | '출휴' // 출산/육아/특별 휴무(출휴)
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
  isRegistered?: boolean;
  /** 엑셀/이미지 헤더에서 추출한 일자별 요일 맵 (예: { "1": "목", "2": "금", ... }) */
  weekdayByDay?: Record<string, string>;
}

export type SchedulesMap = Record<string, MonthlyScheduleData>;

export function isOffDayCode(code?: string): boolean {
  const c = (code || '').trim().toUpperCase();
  return (
    c === 'O' ||
    c === '연차' ||
    c === 'V' ||
    c === '출휴' ||
    c === '휴무' ||
    c === '휴가'
  );
}

// 경기광주점 기본 직원 명단 (이름 칩 선택 및 OCR 글자 보정용, 하드코딩 날짜 없음)
export const GWANGJU_STAFF_ROSTER: { name: string; role: string }[] = [
  { name: '강석원', role: '점장' },
  { name: '김재훈', role: '부점장' },
  { name: '국지현', role: 'SCM' },
  { name: '심우영', role: '선임/대형' },
  { name: '정충영', role: '대형' },
  { name: '한세희', role: '대형' },
  { name: '김태형', role: '대형' },
  { name: '한준애', role: '대형' },
  { name: '손정민', role: '생활' },
  { name: '박기복', role: '주방' },
  { name: '최문기', role: '쿠쿠' },
  { name: '윤현주', role: '쿠쿠' },
  { name: '한나라', role: '생활' },
  { name: '권지혜', role: 'KBB' },
  { name: '서형래', role: '애플' },
  { name: '김지우', role: '모바일' },
  { name: '김도인', role: 'SKT' },
  { name: '정태일', role: 'LGU' },
  { name: '주형남', role: 'KT' },
];

export const NAME_TYPO_MAP: Record<string, string> = {
  한춘애: '한준애',
  한춘매: '한준애',
  한준매: '한준애',
  손경민: '손정민',
};

export function normalizeStaffName(rawName: string): string {
  const clean = String(rawName || '')
    .replace(/\s+/g, '')
    .replace(/^\d+[.)]?\s*/, '')
    .trim();
  if (!clean) return '';
  if (NAME_TYPO_MAP[clean]) return NAME_TYPO_MAP[clean];
  if (clean.includes('한춘애') || clean.includes('한춘매') || clean.includes('한준매')) {
    return '한준애';
  }
  return clean;
}

export function loadSavedUserName(): string {
  try {
    const raw = localStorage.getItem(USER_NAME_STORAGE_KEY)?.trim() || '';
    if (raw && OBSOLETE_FAKE_NAMES.has(raw)) {
      localStorage.removeItem(USER_NAME_STORAGE_KEY);
      return '';
    }
    const normalized = normalizeStaffName(raw);
    if (raw && normalized !== raw) {
      localStorage.setItem(USER_NAME_STORAGE_KEY, normalized);
      return normalized;
    }
    return normalized;
  } catch {
    return '';
  }
}

export function saveUserName(name: string): void {
  try {
    const clean = normalizeStaffName(name);
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
    // 구버전 하드코딩 캐시 키 정리
    localStorage.removeItem('himart_gj_schedules_v1');
    localStorage.removeItem('himart_gj_schedules_v2');
    localStorage.removeItem('himart_gj_schedules_v3');

    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as SchedulesMap;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    // 만약 어떤 월에든 가짜 직원 이름(이현구, 권태영 등)이 들어있으면 해당 월만 제거
    const cleanedMap: SchedulesMap = {};
    for (const ymKey of Object.keys(parsed)) {
      const monthObj = parsed[ymKey];
      const emps = monthObj?.employees;
      if (!Array.isArray(emps)) continue;
      if (emps.some((e) => OBSOLETE_FAKE_NAMES.has((e?.name || '').trim()))) {
        continue;
      }
      cleanedMap[ymKey] = {
        ...monthObj,
        employees: emps.map((e) => {
          const normalizedDays: Record<string, DayScheduleCode> = {};
          if (e.days && typeof e.days === 'object') {
            for (const [dKey, rawVal] of Object.entries(e.days)) {
              const norm = normalizeScheduleCode(String(rawVal || ''));
              if (norm) {
                normalizedDays[dKey] = norm;
              }
            }
          }
          return {
            ...e,
            name: normalizeStaffName(e.name),
            days: normalizedDays,
          };
        }),
      };
    }

    return cleanedMap;
  } catch {
    return {};
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

/**
 * [원격 동기화 1] 서버/GitHub에 배포된 최신 휴무표(/schedule-data.json) 자동 가져오기 및 병합
 */
export async function fetchRemoteSchedules(): Promise<SchedulesMap | null> {
  try {
    let remoteMap: SchedulesMap | null = null;
    const gh = loadGitHubSyncConfig();
    const branch = gh.branch || 'main';

    if (gh.repo) {
      const ghApiUrl = `https://api.github.com/repos/${gh.repo}/contents/public/schedule-data.json?ref=${branch}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3.raw',
      };
      if (gh.token) {
        headers.Authorization = `Bearer ${gh.token}`;
      }
      const ghRes = await fetch(ghApiUrl, {
        cache: 'no-store',
        headers,
      });
      if (ghRes.ok) {
        remoteMap = (await ghRes.json()) as SchedulesMap;
      }
    }

    if (!remoteMap) {
      const res = await fetch(`./schedule-data.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        remoteMap = (await res.json()) as SchedulesMap;
      }
    }

    if (!remoteMap || typeof remoteMap !== 'object') {
      return null;
    }

    const localMap = loadAllSchedules();
    const merged: SchedulesMap = { ...localMap };
    let hasChanges = false;

    for (const [ym, remoteMonth] of Object.entries(remoteMap)) {
      if (!remoteMonth || !Array.isArray(remoteMonth.employees)) continue;
      const localMonth = localMap[ym];
      if (
        !localMonth ||
        localMonth.isRegistered === false ||
        !localMonth.updatedAt ||
        (remoteMonth.updatedAt && remoteMonth.updatedAt >= localMonth.updatedAt)
      ) {
        merged[ym] = {
          ...remoteMonth,
          employees: remoteMonth.employees.map((emp) => ({
            ...emp,
            name: normalizeStaffName(emp.name),
          })),
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      saveAllSchedules(merged);
    }
    return merged;
  } catch {
    return null;
  }
}

/**
 * [원격 동기화 2] 관리자가 휴무표를 업로드하거나 수정했을 때 GitHub 저장소(public/schedule-data.json)에 자동 배포
 */
export async function publishSchedulesToGitHub(
  schedulesMap: SchedulesMap,
  config?: GitHubSyncConfig
): Promise<boolean> {
  try {
    const gh = config || loadGitHubSyncConfig();
    const repo = gh.repo.trim();
    const token = gh.token.trim();
    const branch = gh.branch.trim() || 'main';
    if (!repo || !token) return false;

    const filePath = 'public/schedule-data.json';
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    let currentSha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const info = await getRes.json();
      currentSha = info.sha;
    }

    const jsonText = JSON.stringify(schedulesMap, null, 2);
    const bytes = new TextEncoder().encode(jsonText);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: 월간 휴무표 데이터 자동 동기화 (${new Date().toISOString().slice(0, 10)})`,
        content: base64Content,
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    });

    return putRes.ok;
  } catch {
    return false;
  }
}

export function getOrCreateMonthSchedule(
  schedules: SchedulesMap,
  yearMonth: string
): MonthlyScheduleData {
  if (schedules[yearMonth]) {
    return {
      ...schedules[yearMonth],
      employees: (schedules[yearMonth].employees || []).map((emp) => ({
        ...emp,
        name: normalizeStaffName(emp.name),
      })),
      isRegistered: schedules[yearMonth].isRegistered ?? true,
    };
  }
  // 미등록된 월인 경우 이전 달의 직원 명단이나 잔상을 상속하지 않고 빈 명단으로 반환
  return {
    yearMonth,
    updatedAt: '미등록 (사진/엑셀 업로드로 등록 가능)',
    isRegistered: false,
    employees: [],
  };
}

/**
 * [2-1] 근태 기호 유연 정규화
 */
export function normalizeScheduleCode(raw: string): DayScheduleCode {
  const rawTrim = String(raw ?? '').trim();
  if (!rawTrim) return '';
  const s = rawTrim.toUpperCase();

  // 정기 휴무 ('O')
  if (
    s === 'O' ||
    s === '○' ||
    s === '●' ||
    s === '◯' ||
    s === '0' ||
    s === 'ㅇ' ||
    s === '휴무' ||
    s === '휴' ||
    s === '정규휴무' ||
    s === '정기휴무' ||
    s === 'OFF' ||
    s.includes('정규휴무') ||
    s.includes('정기휴무')
  ) {
    return 'O';
  }

  // 출휴 ('출휴')
  if (
    s === '출휴' ||
    s === '출산휴가' ||
    s === '출산' ||
    s.includes('출휴') ||
    s.includes('출산휴가')
  ) {
    return '출휴';
  }

  // 연차 ('연차')
  if (s === '연차' || s === '연' || s === '연차휴가' || s.includes('연차')) {
    return '연차';
  }

  // 휴가 ('V')
  if (
    s === 'V' ||
    s === '휴가' ||
    s === '하계' ||
    s === '동계' ||
    s === '리프' ||
    s === '특별휴가' ||
    s.includes('휴가') ||
    s.includes('하계') ||
    s.includes('동계') ||
    s.includes('리프')
  ) {
    return 'V';
  }

  // 반차 ('반차')
  if (
    s === '반차' ||
    s === '반' ||
    s === '오전반차' ||
    s === '오후반차' ||
    s.includes('반차')
  ) {
    return '반차';
  }

  // 교육 ('교육')
  if (
    s === '교육' ||
    s === '교' ||
    s === '출장' ||
    s.includes('교육') ||
    s.includes('출장')
  ) {
    return '교육';
  }

  // 회의 ('회의')
  if (s === '회의' || s === '회' || s.includes('회의')) {
    return '회의';
  }

  // HP ('HP')
  if (s === 'HP' || s.includes('HP')) {
    return 'HP';
  }

  // 정상 출근 ('근무', '정상', '정상근무', '출근', '-', '' 또는 숫자)
  if (
    s === '근무' ||
    s === '정상' ||
    s === '정상근무' ||
    s === '출근' ||
    s === '-' ||
    s === '_' ||
    /^\d+(\.\d+)?$/.test(s)
  ) {
    return '';
  }

  return '';
}

/**
 * 한글 인명(2~4글자) 여부 판별 (요약/직책/근태 어휘 제외)
 */
function isValidKoreanStaffName(raw: string): boolean {
  const clean = String(raw || '')
    .replace(/\s+/g, '')
    .replace(/^\d+[.)]?\s*/, '')
    .trim();
  if (!clean || clean.length < 2 || clean.length > 4) return false;
  if (OBSOLETE_FAKE_NAMES.has(clean) || NON_NAME_KEYWORDS.has(clean)) {
    return false;
  }
  if (
    clean.includes('인원') ||
    clean.includes('합계') ||
    clean.includes('소계') ||
    clean.includes('결원') ||
    clean.includes('연차') ||
    clean.includes('휴무') ||
    clean.includes('휴가') ||
    clean.includes('계획') ||
    clean.includes('성명') ||
    clean.includes('이름') ||
    clean.includes('담당') ||
    clean.includes('직책') ||
    clean.includes('구분') ||
    clean.includes('페이지') ||
    clean.includes('근무')
  ) {
    return false;
  }
  return /^[가-힣]{2,4}$/.test(clean);
}

interface ExtractedDateCellInfo {
  day: number;
  month?: number;
  year?: number;
  weekday?: string;
}

function normalizeWeekdayChar(raw: any): string | undefined {
  const s = String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!s) return undefined;
  if (s === '일' || s === '일요일' || s === 'SUN' || s === '(일)' || s === '（일）') return '일';
  if (s === '월' || s === '월요일' || s === 'MON' || s === '(월)' || s === '（월）') return '월';
  if (s === '화' || s === '화요일' || s === 'TUE' || s === '(화)' || s === '（화）') return '화';
  if (s === '수' || s === '수요일' || s === 'WED' || s === '(수)' || s === '（수）') return '수';
  if (s === '목' || s === '목요일' || s === 'THU' || s === '(목)' || s === '（목）') return '목';
  if (s === '금' || s === '금요일' || s === 'FRI' || s === '(금)' || s === '（금）') return '금';
  if (s === '토' || s === '토요일' || s === 'SAT' || s === '(토)' || s === '（토）') return '토';
  return undefined;
}

/**
 * 셀 값(원본 값 및 표시 텍스트)에서 연/월/일/요일 정보를 정밀 추출
 */
function extractDateCellInfo(
  cellVal: any,
  formattedStr?: string
): ExtractedDateCellInfo | null {
  if (
    (cellVal === null || cellVal === undefined || cellVal === '') &&
    !formattedStr
  ) {
    return null;
  }

  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    const day = cellVal.getDate();
    if (day >= 1 && day <= 31) {
      return {
        year: cellVal.getFullYear(),
        month: cellVal.getMonth() + 1,
        day,
        weekday: WEEKDAY_KO[cellVal.getDay()],
      };
    }
  }

  if (typeof cellVal === 'number') {
    if (Number.isInteger(cellVal) && cellVal >= 1 && cellVal <= 31) {
      return { day: cellVal };
    }
    // 엑셀 시리얼 날짜 (예: 2020년~2035년 -> 약 43831 ~ 49675)
    if (cellVal >= 43000 && cellVal <= 52000) {
      const parsedCode = (XLSX.SSF as any)?.parse_date_code?.(
        Math.round(cellVal)
      );
      if (
        parsedCode &&
        parsedCode.d >= 1 &&
        parsedCode.d <= 31 &&
        parsedCode.m >= 1 &&
        parsedCode.m <= 12
      ) {
        const dt = new Date(parsedCode.y, parsedCode.m - 1, parsedCode.d);
        return {
          year: parsedCode.y,
          month: parsedCode.m,
          day: parsedCode.d,
          weekday: WEEKDAY_KO[dt.getDay()],
        };
      }
      const utcDays = Math.round(cellVal - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      const day = d.getUTCDate();
      if (day >= 1 && day <= 31) {
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day,
          weekday: WEEKDAY_KO[d.getUTCDay()],
        };
      }
    }
  }

  const candidates = [String(cellVal ?? '').trim()];
  if (formattedStr && formattedStr.trim() && formattedStr.trim() !== candidates[0]) {
    candidates.push(formattedStr.trim());
  }

  for (const str of candidates) {
    if (!str) continue;

    // 1) 단순 숫자 "1" ~ "31" 또는 "1일" ~ "31일" 또는 "1(목)" / "1일(목)" / "26\n(월)"
    const mSimple = str.match(
      /^0?([1-9]|[12]\d|3[01])\s*(?:일)?(?:\s*[\r\n]*\s*[(（]?([월화수목금토일])(?:요일)?[)）]?)?$/
    );
    if (mSimple) {
      return {
        day: parseInt(mSimple[1], 10),
        weekday: mSimple[2] || undefined,
      };
    }

    // 2) YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    const mFullDate = str.match(
      /^(20\d{2})\s*[-./년]\s*0?([1-9]|1[0-2])\s*[-./월]\s*0?([1-9]|[12]\d|3[01])\s*일?(?:\s*[(（]?([월화수목금토일])[)）]?)?/
    );
    if (mFullDate) {
      const y = parseInt(mFullDate[1], 10);
      const m = parseInt(mFullDate[2], 10);
      const d = parseInt(mFullDate[3], 10);
      return {
        year: y,
        month: m,
        day: d,
        weekday:
          mFullDate[4] || WEEKDAY_KO[new Date(y, m - 1, d).getDay()],
      };
    }

    // 3) MM/DD, MM-DD, MM.DD, MM월 DD일 (예: 10/26, 11/1, 10월 26일)
    const mMonthDay = str.match(
      /^0?([1-9]|1[0-2])\s*[-./월]\s*0?([1-9]|[12]\d|3[01])\s*(?:일)?(?:\s*[(（]?([월화수목금토일])[)）]?)?$/
    );
    if (mMonthDay) {
      return {
        month: parseInt(mMonthDay[1], 10),
        day: parseInt(mMonthDay[2], 10),
        weekday: mMonthDay[3] || undefined,
      };
    }
  }

  return null;
}

/**
 * 셀 값에서 1~31일 날짜 정수를 추출
 */
function extractDayNumberFromCell(cellVal: any): number | null {
  const info = extractDateCellInfo(cellVal);
  return info ? info.day : null;
}

/**
 * 텍스트에서 연-월('YYYY-MM') 자동 감지
 */
function detectYearMonthFromText(
  text: string,
  fallbackYear: number
): string | null {
  if (!text) return null;
  const s = String(text);

  // 2026년 11월, 2026-11, 2026.10 등
  const ymMatch = s.match(/20(\d{2})\s*[년.\-/_]\s*(0?[1-9]|1[0-2])(?:\s*월|\b)/);
  if (ymMatch) {
    const y = 2000 + parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // "11월 휴무", "11월" 등
  const mOnlyMatch = s.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])\s*월/);
  if (mOnlyMatch) {
    const m = parseInt(mOnlyMatch[1], 10);
    if (m >= 1 && m <= 12) {
      return `${fallbackYear}-${String(m).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * 엑셀 업로드 시: 이전 달의 명단이나 잔상을 상속하지 않고,
 * 오직 이번 달 파일에 실제로 이름과 일정이 기재된 임직원만 동적으로 추출하여 등록.
 * ('한춘애', '한춘매' 등은 무조건 정식 명칭 "한준애"로 표준화)
 */
function finalizeExcelEmployees(
  rawList: { name: string; role: string; days: Record<string, DayScheduleCode> }[]
): EmployeeMonthlySchedule[] {
  const result: EmployeeMonthlySchedule[] = [];
  const seenNames = new Set<string>();

  for (const item of rawList) {
    const finalName = normalizeStaffName(item.name);
    if (!finalName || OBSOLETE_FAKE_NAMES.has(finalName)) continue;
    if (!isValidKoreanStaffName(finalName)) continue;

    const stdMatch = GWANGJU_STAFF_ROSTER.find((s) => s.name === finalName);
    const rawRole = (item.role || '').trim();
    const finalRole =
      rawRole && rawRole !== '매장'
        ? rawRole
        : stdMatch?.role || rawRole || '매장';

    const cleanDays: Record<string, DayScheduleCode> = {};
    for (const [dKey, codeVal] of Object.entries(item.days || {})) {
      const dNum = parseInt(dKey, 10);
      const normCode = normalizeScheduleCode(String(codeVal || ''));
      if (dNum >= 1 && dNum <= 31 && normCode) {
        cleanDays[String(dNum)] = normCode;
      }
    }

    if (seenNames.has(finalName)) {
      const existing = result.find((e) => e.name === finalName);
      if (existing) {
        existing.days = { ...existing.days, ...cleanDays };
        if (existing.role === '매장' && finalRole !== '매장') {
          existing.role = finalRole;
        }
      }
    } else {
      seenNames.add(finalName);
      result.push({
        name: finalName,
        role: finalRole,
        days: cleanDays,
      });
    }
  }

  return result;
}

/**
 * 사진(이미지) AI OCR 업로드 전용:
 * 이전 달의 명단을 강제 상속하거나 덮어쓰지 않고, 이번 달 이미지에 실제로 존재하는 임직원만 추출.
 * ('한춘애', '한춘매' 등은 무조건 정식 명칭 "한준애"로 자동 치환)
 */
function reconcileOcrEmployees(
  rawList: { no?: number; name: string; role: string; days: Record<string, DayScheduleCode> }[]
): EmployeeMonthlySchedule[] {
  return finalizeExcelEmployees(
    rawList.map((r) => ({
      name: normalizeStaffName(r.name),
      role: (r.role || '').trim() || '매장',
      days: r.days || {},
    }))
  );
}

/**
 * 날짜 헤더 행의 각 열(Column)이 정확히 몇 월 며칠(year, month, day, weekday)인지 정의하는 1:1 날짜 인덱스 맵 항목
 */
interface DateColumnIndexEntry {
  colIdx: number;
  spanCols: number[];
  year: number;
  month: number;
  yearMonth: string;
  day: number;
  weekday: string;
  isTargetMonth: boolean;
}

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10) || new Date().getFullYear();
  const m = parseInt(mStr, 10) || 1;
  const dt = new Date(y, m - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * [1] 양식이 바뀌어도 절대 실패하지 않는 '날짜 인덱스 맵 1:1 절대 매칭 엑셀/CSV 파서 + AI 자동 폴백'
 */
async function parseUniversalExcelSchedule(
  wb: XLSX.WorkBook,
  fileName: string,
  fallbackYearMonth: string
): Promise<{
  yearMonth: string;
  employees: EmployeeMonthlySchedule[];
  weekdayByDay?: Record<string, string>;
}> {
  const defaultYear =
    parseInt(fallbackYearMonth.split('-')[0], 10) || new Date().getFullYear();

  const explicitYmFromFileName = detectYearMonthFromText(fileName, defaultYear);
  let detectedYearMonth = explicitYmFromFileName || fallbackYearMonth;
  let hasExplicitMonthHint = Boolean(explicitYmFromFileName);

  const sheetCsvTexts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const ymFromSheetName = detectYearMonthFromText(sheetName, defaultYear);
    if (ymFromSheetName) {
      detectedYearMonth = ymFromSheetName;
      hasExplicitMonthHint = true;
    }

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    const formattedRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (!rows || rows.length === 0) continue;

    // 상단 1~10행 셀 텍스트에서 연/월 자동 감지
    for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx++) {
      const rowText = (rows[rIdx] || []).map((c) => String(c ?? '')).join(' ');
      const ymFromRow = detectYearMonthFromText(rowText, defaultYear);
      if (ymFromRow) {
        detectedYearMonth = ymFromRow;
        hasExplicitMonthHint = true;
        break;
      }
    }

    // 3단계 폴백 대비 CSV 텍스트 보관
    const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (csvText) {
      sheetCsvTexts.push(`[시트: ${sheetName}]\n${csvText}`);
    }

    // =========================================================================
    // [1단계] 날짜 헤더(Header) 기준 1:1 날짜 인덱스 맵 생성 및 엄격 동기화 파싱
    // =========================================================================
    const scanHeaderLimit = Math.min(rows.length, 25);

    // 1-A) 날짜 숫자들이 연속으로 배치된 진짜 '날짜 헤더 행(bestDateRowIdx)' 탐색
    // ('총 근무인원', '결원' 등 숫자 요약 행과 혼동하지 않도록 +1 연속 증가 점수로 교차 검증)
    let bestDateRowIdx = -1;
    let bestRowScore = -1;
    let bestRowTokens: {
      colIdx: number;
      info: ExtractedDateCellInfo;
    }[] = [];

    for (let rIdx = 0; rIdx < scanHeaderLimit; rIdx++) {
      const r = rows[rIdx] || [];
      const fr = formattedRows[rIdx] || [];
      const rowJoined = r
        .slice(0, 6)
        .map((c) => String(c ?? '').replace(/\s+/g, ''))
        .join(' ');
      if (
        rowJoined.includes('근무인원') ||
        rowJoined.includes('결원') ||
        rowJoined.includes('합계') ||
        rowJoined.includes('총계')
      ) {
        continue;
      }

      const tokens: { colIdx: number; info: ExtractedDateCellInfo }[] = [];
      for (let cIdx = 0; cIdx < r.length; cIdx++) {
        const info = extractDateCellInfo(r[cIdx], String(fr[cIdx] ?? ''));
        if (info && info.day >= 1 && info.day <= 31) {
          tokens.push({ colIdx: cIdx, info });
        }
      }

      if (tokens.length < 7) continue;

      let sequentialTransitions = 0;
      for (let i = 1; i < tokens.length; i++) {
        const prev = tokens[i - 1];
        const curr = tokens[i];
        const colGap = curr.colIdx - prev.colIdx;
        if (
          colGap >= 1 &&
          colGap <= 3 &&
          (curr.info.day === prev.info.day + 1 ||
            (prev.info.day >= 28 && curr.info.day === 1))
        ) {
          sequentialTransitions++;
        }
      }

      const score = sequentialTransitions * 10 + tokens.length;
      if (sequentialTransitions >= 5 && score > bestRowScore) {
        bestRowScore = score;
        bestDateRowIdx = rIdx;
        bestRowTokens = tokens;
      }
    }

    if (bestDateRowIdx !== -1 && bestRowTokens.length >= 7) {
      // 1-B) 성명 열(nameColIdx) 및 담당/직책 열(roleColIdx) 먼저 확정
      let keywordNameColIdx = -1;
      let keywordRoleColIdx = -1;

      for (let rIdx = 0; rIdx < scanHeaderLimit; rIdx++) {
        const r = rows[rIdx] || [];
        for (let cIdx = 0; cIdx < Math.min(r.length, 15); cIdx++) {
          const cleanCell = String(r[cIdx] ?? '').replace(/\s+/g, '');
          if (!cleanCell) continue;
          if (
            keywordNameColIdx === -1 &&
            (cleanCell.includes('성명') ||
              cleanCell.includes('이름') ||
              cleanCell.includes('사원명') ||
              cleanCell.includes('직원명') ||
              cleanCell.includes('성함') ||
              cleanCell.includes('근무자'))
          ) {
            keywordNameColIdx = cIdx;
          }
          if (
            keywordRoleColIdx === -1 &&
            (cleanCell.includes('담당') ||
              cleanCell.includes('직책') ||
              cleanCell.includes('부서') ||
              cleanCell.includes('코너') ||
              cleanCell.includes('직급') ||
              cleanCell.includes('파트'))
          ) {
            keywordRoleColIdx = cIdx;
          }
        }
      }

      let patternNameColIdx = -1;
      let maxNameHits = 0;
      const maxColToScan = 10;

      for (let cIdx = 0; cIdx <= maxColToScan; cIdx++) {
        let hits = 0;
        for (let rIdx = bestDateRowIdx + 1; rIdx < rows.length; rIdx++) {
          const cellStr = normalizeStaffName(String(rows[rIdx]?.[cIdx] ?? ''));
          if (isValidKoreanStaffName(cellStr)) {
            hits++;
          }
        }
        if (hits > maxNameHits) {
          maxNameHits = hits;
          patternNameColIdx = cIdx;
        }
      }

      let nameColIdx = keywordNameColIdx;
      if (nameColIdx !== -1) {
        let keywordHits = 0;
        for (let rIdx = bestDateRowIdx + 1; rIdx < rows.length; rIdx++) {
          if (
            isValidKoreanStaffName(
              normalizeStaffName(String(rows[rIdx]?.[nameColIdx] ?? ''))
            )
          ) {
            keywordHits++;
          }
        }
        if (keywordHits < 2 && maxNameHits >= 2) {
          nameColIdx = patternNameColIdx;
        }
      } else if (patternNameColIdx !== -1) {
        nameColIdx = patternNameColIdx;
      } else {
        nameColIdx = 0;
      }

      // 1-C) 성명 열 오른쪽에 위치한 연속된 날짜 열만 필터링 (좌측 NO/연차 열 및 우측 합계 열 완벽 배제)
      const rightTokens = bestRowTokens.filter((t) => t.colIdx > nameColIdx);
      const seqTokens: { colIdx: number; info: ExtractedDateCellInfo }[] = [];

      for (let i = 0; i < rightTokens.length; i++) {
        const curr = rightTokens[i];
        const prev = seqTokens[seqTokens.length - 1];
        if (!prev) {
          // 첫 시작 토큰은 다음 토큰과 연속(+1 또는 월말->1일)인지 확인
          const next = rightTokens[i + 1];
          if (
            next &&
            next.colIdx - curr.colIdx <= 3 &&
            (next.info.day === curr.info.day + 1 ||
              (curr.info.day >= 28 && next.info.day === 1))
          ) {
            seqTokens.push(curr);
          }
        } else {
          const colGap = curr.colIdx - prev.colIdx;
          const isNextDay =
            curr.info.day === prev.info.day + 1 ||
            (prev.info.day >= 28 && curr.info.day === 1);
          if (colGap >= 1 && colGap <= 3 && isNextDay) {
            seqTokens.push(curr);
          } else if (colGap >= 1 && colGap <= 2) {
            // 혹시 1칸 오타가 있더라도 다다음 칸이 정상 연속이면 허용
            const next = rightTokens[i + 1];
            if (
              next &&
              next.info.day === curr.info.day + 1
            ) {
              seqTokens.push(curr);
            }
          }
        }
      }

      const activeDateTokens = seqTokens.length >= 7 ? seqTokens : rightTokens;
      const dateColSet = new Set<number>(activeDateTokens.map((t) => t.colIdx));

      // roleColIdx 확정
      let roleColIdx =
        keywordRoleColIdx !== -1 &&
        keywordRoleColIdx !== nameColIdx &&
        !dateColSet.has(keywordRoleColIdx)
          ? keywordRoleColIdx
          : -1;

      if (roleColIdx === -1) {
        const candidates = [nameColIdx + 1, nameColIdx - 1].filter(
          (c) => c >= 0 && !dateColSet.has(c)
        );
        for (const candCol of candidates) {
          let roleLikeCount = 0;
          for (let rIdx = bestDateRowIdx + 1; rIdx < rows.length; rIdx++) {
            const val = String(rows[rIdx]?.[candCol] ?? '').trim();
            if (
              val &&
              val.length >= 1 &&
              val.length <= 10 &&
              !/^\d+$/.test(val)
            ) {
              roleLikeCount++;
            }
          }
          if (roleLikeCount >= 2) {
            roleColIdx = candCol;
            break;
          }
        }
      }

      // 1-D) 요일 헤더 행(weekdayRowIdx) 탐색 (날짜 행 바로 아래 또는 바로 위 행)
      let weekdayRowIdx = -1;
      let maxWeekdayHits = 0;
      for (const candRowIdx of [
        bestDateRowIdx + 1,
        bestDateRowIdx - 1,
        bestDateRowIdx + 2,
      ]) {
        if (candRowIdx < 0 || candRowIdx >= rows.length) continue;
        const wr = rows[candRowIdx] || [];
        let hits = 0;
        for (const tok of activeDateTokens) {
          if (normalizeWeekdayChar(wr[tok.colIdx])) {
            hits++;
          }
        }
        if (hits >= 5 && hits > maxWeekdayHits) {
          maxWeekdayHits = hits;
          weekdayRowIdx = candRowIdx;
        }
      }

      // 1-E) 엑셀 병합 셀(!merges) 분석:
      //  - 날짜 헤더가 가로 병합된 경우 spanCols 기록
      //  - 직원 데이터 행에서 '출휴', '연차', 'V', '교육', 'O' 등이 여러 날짜 열에 걸쳐 가로 병합된 경우 모든 열에 값 복제
      const merges: XLSX.Range[] = Array.isArray(sheet['!merges'])
        ? (sheet['!merges'] as XLSX.Range[])
        : [];
      const rangeOffset = sheet['!ref']
        ? XLSX.utils.decode_range(sheet['!ref']).s
        : { r: 0, c: 0 };

      const headerSpanMap = new Map<number, number[]>();
      for (const m of merges) {
        const rStart = m.s.r - rangeOffset.r;
        const rEnd = m.e.r - rangeOffset.r;
        const cStart = m.s.c - rangeOffset.c;
        const cEnd = m.e.c - rangeOffset.c;

        if (bestDateRowIdx >= rStart && bestDateRowIdx <= rEnd && cEnd > cStart) {
          const span: number[] = [];
          for (let c = cStart; c <= cEnd; c++) span.push(c);
          headerSpanMap.set(cStart, span);
        }

        // 직원 행의 가로 병합 근태 코드(예: 출휴, 연차, V 등)를 병합 범위 내 모든 열에 동일하게 채움
        if (rStart > bestDateRowIdx && rStart === rEnd && cEnd > cStart) {
          const rowArr = rows[rStart];
          if (rowArr && cStart > nameColIdx) {
            const mergedCode = normalizeScheduleCode(String(rowArr[cStart] ?? ''));
            if (mergedCode) {
              for (let c = cStart + 1; c <= cEnd; c++) {
                if (!rowArr[c]) {
                  rowArr[c] = mergedCode;
                }
              }
            }
          }
        }
      }

      // 1-F) 날짜 열들을 월별 구간(Segments)으로 분할 (예: [26,27,28,29,30,31] -> [1,2,3...30] -> [1,2])
      const segments: { colIdx: number; info: ExtractedDateCellInfo }[][] = [];
      for (const tok of activeDateTokens) {
        if (segments.length === 0) {
          segments.push([tok]);
        } else {
          const curSeg = segments[segments.length - 1];
          const prevTok = curSeg[curSeg.length - 1];
          if (tok.info.day < prevTok.info.day) {
            segments.push([tok]);
          } else {
            curSeg.push(tok);
          }
        }
      }

      // 가장 많은 일수를 가진 구간(1일부터 시작하는 본 월 구간)을 mainSegIdx로 선정
      let mainSegIdx = 0;
      let maxSegLen = 0;
      segments.forEach((seg, idx) => {
        if (seg.length > maxSegLen) {
          maxSegLen = seg.length;
          mainSegIdx = idx;
        }
      });

      const mainSeg = segments[mainSegIdx] || [];

      // mainSeg 내부 셀에 명시적 연/월(엑셀 시리얼 날짜 또는 MM/DD)이 있으면 최우선 반영
      const explicitInMain = mainSeg.find(
        (t) => t.info.month && t.info.month >= 1 && t.info.month <= 12
      );
      if (explicitInMain && explicitInMain.info.month) {
        const y = explicitInMain.info.year || defaultYear;
        detectedYearMonth = `${y}-${String(explicitInMain.info.month).padStart(
          2,
          '0'
        )}`;
        hasExplicitMonthHint = true;
      }

      // 요일 행 및 전월 말일(28/29/30/31)과 달력을 교차 검증하여 연/월 자동 보정
      if (!hasExplicitMonthHint && weekdayRowIdx !== -1 && mainSeg.length >= 7) {
        const wr = rows[weekdayRowIdx] || [];
        const prevSeg = mainSegIdx > 0 ? segments[mainSegIdx - 1] : null;
        const prevSegLastDay =
          prevSeg && prevSeg.length > 0
            ? prevSeg[prevSeg.length - 1].info.day
            : null;

        let bestCandYm = detectedYearMonth;
        let bestMatchRatio = -1;

        for (let delta = -3; delta <= 6; delta++) {
          const candYm = shiftYearMonth(fallbackYearMonth, delta);
          const [cyStr, cmStr] = candYm.split('-');
          const cy = parseInt(cyStr, 10);
          const cm = parseInt(cmStr, 10);

          if (prevSegLastDay && prevSegLastDay >= 28) {
            const actualPrevLastDay = new Date(cy, cm - 1, 0).getDate();
            if (actualPrevLastDay !== prevSegLastDay) continue;
          }

          let matches = 0;
          let checked = 0;
          for (const tok of mainSeg) {
            const excelWd =
              normalizeWeekdayChar(wr[tok.colIdx]) || tok.info.weekday;
            if (!excelWd) continue;
            checked++;
            const calWd = WEEKDAY_KO[new Date(cy, cm - 1, tok.info.day).getDay()];
            if (excelWd === calWd) matches++;
          }

          if (checked >= 5) {
            const ratio = matches / checked;
            if (ratio > bestMatchRatio) {
              bestMatchRatio = ratio;
              bestCandYm = candYm;
            }
          }
        }

        if (bestMatchRatio >= 0.8) {
          detectedYearMonth = bestCandYm;
        }
      }

      // 1-G) 각 열(Column)이 정확히 몇 월 며칠을 의미하는지 1:1 '날짜 인덱스 맵(dateIndexMap)' 생성
      const dateIndexMap: DateColumnIndexEntry[] = [];
      const wr = weekdayRowIdx !== -1 ? rows[weekdayRowIdx] || [] : [];

      segments.forEach((seg, segIdx) => {
        const monthOffset = segIdx - mainSegIdx;
        const segYm = shiftYearMonth(detectedYearMonth, monthOffset);
        const [syStr, smStr] = segYm.split('-');
        const sy = parseInt(syStr, 10);
        const sm = parseInt(smStr, 10);
        const isTargetMonth = monthOffset === 0;

        for (const tok of seg) {
          const excelWd =
            normalizeWeekdayChar(wr[tok.colIdx]) ||
            tok.info.weekday ||
            WEEKDAY_KO[new Date(sy, sm - 1, tok.info.day).getDay()];

          dateIndexMap.push({
            colIdx: tok.colIdx,
            spanCols: headerSpanMap.get(tok.colIdx) || [tok.colIdx],
            year: sy,
            month: sm,
            yearMonth: segYm,
            day: tok.info.day,
            weekday: excelWd,
            isTargetMonth,
          });
        }
      });

      // 본 월(isTargetMonth === true)에 해당하는 날짜 인덱스 맵만 추출하여
      // 이전 달(예: 좌측 26일~31일)이나 다음 달(예: 우측 1일~2일)의 데이터 잔상이 절대 섞이지 않도록 차단!
      const targetMonthColumns = dateIndexMap.filter((d) => d.isTargetMonth);
      const weekdayByDay: Record<string, string> = {};
      for (const entry of targetMonthColumns) {
        weekdayByDay[String(entry.day)] = entry.weekday;
      }

      const matrixEmployees: {
        name: string;
        role: string;
        days: Record<string, DayScheduleCode>;
      }[] = [];

      const startEmployeeRowIdx = Math.max(
        bestDateRowIdx + 1,
        weekdayRowIdx > bestDateRowIdx ? weekdayRowIdx + 1 : bestDateRowIdx + 1
      );

      for (let rIdx = startEmployeeRowIdx; rIdx < rows.length; rIdx++) {
        const r = rows[rIdx] || [];
        const rawName = normalizeStaffName(String(r[nameColIdx] ?? ''));

        if (!isValidKoreanStaffName(rawName)) continue;

        // 행 전체에 합계/근무인원/결원 요약 키워드가 있으면 스킵
        const rowJoined = r
          .slice(0, Math.min(r.length, 6))
          .map((c) => String(c ?? ''))
          .join(' ');
        if (
          rowJoined.includes('근무인원') ||
          rowJoined.includes('결원') ||
          rowJoined.includes('합계') ||
          rowJoined.includes('총계') ||
          rowJoined.includes('소계')
        ) {
          continue;
        }

        // 날짜 인덱스 맵(targetMonthColumns)과 1:1 엄격 동기화하여 셀 좌표 매칭
        const days: Record<string, DayScheduleCode> = {};
        for (const colEntry of targetMonthColumns) {
          if (
            colEntry.colIdx === nameColIdx ||
            colEntry.colIdx === roleColIdx
          ) {
            continue;
          }
          let code: DayScheduleCode = '';
          for (const c of colEntry.spanCols) {
            code = normalizeScheduleCode(String(r[c] ?? ''));
            if (code) break;
          }
          if (code) {
            days[String(colEntry.day)] = code;
          }
        }

        const rawRole =
          roleColIdx >= 0 ? String(r[roleColIdx] ?? '').trim() : '';

        matrixEmployees.push({
          name: rawName,
          role: rawRole || '매장',
          days,
        });
      }

      const finalizedMatrix = finalizeExcelEmployees(matrixEmployees);
      if (finalizedMatrix.length >= 2) {
        return {
          yearMonth: detectedYearMonth,
          employees: finalizedMatrix,
          weekdayByDay,
        };
      }
    }

    // =========================================================================
    // [2단계] 세로형 일자별 표(Long DB: 날짜 | 성명 | 근태상태) & 요약형 표(Summary: 성명 | 일정요약)
    // =========================================================================
    const stage2Map = new Map<
      string,
      { name: string; role: string; days: Record<string, DayScheduleCode> }
    >();

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx] || [];
      if (r.length < 2) continue;

      let rowName = '';
      let rowNameCol = -1;
      for (let cIdx = 0; cIdx < Math.min(r.length, 8); cIdx++) {
        const cand = normalizeStaffName(String(r[cIdx] ?? ''));
        if (isValidKoreanStaffName(cand)) {
          rowName = cand;
          rowNameCol = cIdx;
          break;
        }
      }
      if (!rowName) continue;

      if (!stage2Map.has(rowName)) {
        stage2Map.set(rowName, { name: rowName, role: '매장', days: {} });
      }
      const empEntry = stage2Map.get(rowName)!;

      let singleDayInRow: number | null = null;
      let singleCodeInRow: DayScheduleCode = '';

      for (let cIdx = 0; cIdx < r.length; cIdx++) {
        if (cIdx === rowNameCol) continue;
        const cellVal = r[cIdx];
        const cellStr = String(cellVal ?? '').trim();
        if (!cellStr) continue;

        const summaryRegex =
          /(?:(?:0?[1-9]|1[0-2])\s*[-./월]\s*)?0?([1-9]|[12]\d|3[01])\s*일?\s*[(（:：-]?\s*(O|o|○|휴무|정기휴무|연차|V|v|휴가|반차|오전반차|오후반차|교육|출휴|출산휴가|회의|HP)\s*[)）]?/g;
        let matchSummary: RegExpExecArray | null;
        let matchedAnySummary = false;
        while ((matchSummary = summaryRegex.exec(cellStr)) !== null) {
          matchedAnySummary = true;
          const dNum = parseInt(matchSummary[1], 10);
          const code = normalizeScheduleCode(matchSummary[2]);
          if (dNum >= 1 && dNum <= 31 && code) {
            empEntry.days[String(dNum)] = code;
          }
        }
        if (matchedAnySummary) continue;

        if (/^\d{1,2}(?:\s*,\s*\d{1,2}){2,}$/.test(cellStr)) {
          cellStr.split(',').forEach((part) => {
            const dNum = parseInt(part.trim(), 10);
            if (dNum >= 1 && dNum <= 31 && !empEntry.days[String(dNum)]) {
              empEntry.days[String(dNum)] = 'O';
            }
          });
          continue;
        }

        const maybeDay = extractDayNumberFromCell(cellVal);
        if (maybeDay !== null && singleDayInRow === null) {
          singleDayInRow = maybeDay;
          continue;
        }

        const maybeCode = normalizeScheduleCode(cellStr);
        if (maybeCode) {
          singleCodeInRow = maybeCode;
          continue;
        }

        if (
          empEntry.role === '매장' &&
          cellStr.length >= 2 &&
          cellStr.length <= 8 &&
          !/^\d+$/.test(cellStr)
        ) {
          empEntry.role = cellStr;
        }
      }

      if (singleDayInRow !== null) {
        empEntry.days[String(singleDayInRow)] = singleCodeInRow || 'O';
      }
    }

    const stage2List = finalizeExcelEmployees(Array.from(stage2Map.values()));
    const stage2WithDays = stage2List.filter(
      (e) => Object.keys(e.days).length > 0
    );
    if (stage2WithDays.length >= 3) {
      return {
        yearMonth: detectedYearMonth,
        employees: stage2List,
      };
    }
  }

  // =========================================================================
  // [3단계] 초강력 Gemini AI 엑셀 폴백 (날짜 인덱스 맵 1:1 매칭 규칙 적용)
  // =========================================================================
  const apiKey = getEffectiveGeminiApiKey();
  if (!apiKey || sheetCsvTexts.length === 0) {
    throw new Error(
      '엑셀 파일에서 직원 성명 및 휴무 데이터를 찾지 못했습니다.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const combinedCsv = sheetCsvTexts.join('\n\n').slice(0, 60000);

  const aiPrompt = `다음은 매장 월간 휴무표 엑셀/CSV 데이터입니다. 아래 정밀 매칭 원칙을 철저히 지켜 직원별 월간 스케줄 JSON으로 변환하세요.

[변환 규칙]
1. 날짜 헤더 기준 1:1 절대 매칭:
   - 날짜 숫자들이 위치한 행(예: 이전 달 26~31일, 이번 달 1일~31일 등)을 먼저 파싱하여 각 열(Column)이 정확히 몇 월 며칠인지 파악하세요.
   - 표 좌측에 이전 달 날짜(예: 26, 27, 28, 29, 30, 31)가 먼저 나오고 그 뒤에 이번 달 '1'일이 시작되는 경우, 이전 달 26~31일 열의 데이터를 이번 달 26~31일에 넣거나 날짜가 밀리는(Shift) 일이 절대 없도록 오직 이번 달(1일~말일) 열만 1:1로 매칭하세요.
2. 명단 필터링 및 이름 표준화:
   - 이번 달 파일에 실제로 이름이 존재하는 임직원만 추출하세요 ('총 근무인원', '결원', '합계' 등 요약 행 제외).
   - 이름이 '한춘애' 또는 '한춘매'로 되어 있으면 무조건 정식 명칭인 "한준애"로 표준화하세요.
3. 휴무 코드 정규화:
   - 정기휴무('O', '○', '0', '휴무', '휴', 'OFF') -> 'O'
   - 연차('연차', '연') -> '연차'
   - 휴가('V', '휴가', '리프', '하계', '동계') -> 'V'
   - 반차('반차', '반', '오전반차', '오후반차') -> '반차'
   - 교육('교육', '교', '출장') -> '교육'
   - 출휴('출휴', '출산휴가') -> '출휴'
   - 회의('회의', '회') -> '회의'
   - HP -> 'HP'

[엑셀/CSV 원문]
${combinedCsv}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      year: { type: Type.INTEGER },
      month: { type: Type.INTEGER },
      employees: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            schedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.INTEGER },
                  status: { type: Type.STRING },
                },
                required: ['day', 'status'],
              },
            },
          },
          required: ['name', 'role', 'schedule'],
        },
      },
    },
    required: ['month', 'employees'],
  };

  const GEMINI_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];

  let rawJsonText = '';
  let lastErr: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: aiPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.0,
        },
      });
      if (response.text) {
        rawJsonText = response.text.trim();
        break;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (!rawJsonText) {
    throw (
      lastErr ||
      new Error('엑셀 양식 자동 분석 및 AI 폴백 분석에 실패했습니다.')
    );
  }

  const cleanedJson = rawJsonText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsedAi = JSON.parse(cleanedJson);
  if (
    typeof parsedAi.month === 'number' &&
    parsedAi.month >= 1 &&
    parsedAi.month <= 12
  ) {
    const y =
      typeof parsedAi.year === 'number' && parsedAi.year >= 2024
        ? parsedAi.year
        : defaultYear;
    detectedYearMonth = `${y}-${String(parsedAi.month).padStart(2, '0')}`;
  }

  const aiEmployeesRaw: {
    name: string;
    role: string;
    days: Record<string, DayScheduleCode>;
  }[] = (parsedAi.employees || [])
    .filter((emp: any) =>
      isValidKoreanStaffName(normalizeStaffName(String(emp?.name || '')))
    )
    .map((emp: any) => {
      const days: Record<string, DayScheduleCode> = {};
      if (Array.isArray(emp.schedule)) {
        for (const item of emp.schedule) {
          const dNum = Number(item?.day);
          if (dNum >= 1 && dNum <= 31) {
            const code = normalizeScheduleCode(String(item?.status || ''));
            if (code) {
              days[String(dNum)] = code;
            }
          }
        }
      }
      return {
        name: normalizeStaffName(String(emp.name || '')),
        role: String(emp.role || '매장').trim(),
        days,
      };
    });

  const finalizedAi = finalizeExcelEmployees(aiEmployeesRaw);
  if (finalizedAi.length === 0) {
    throw new Error('엑셀 파일에서 유효한 직원 휴무 데이터를 추출하지 못했습니다.');
  }

  return {
    yearMonth: detectedYearMonth,
    employees: finalizedAi,
  };
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
    value: '출휴',
    label: '🩷 출휴 (출산/특별휴가)',
    badge: 'bg-pink-500 text-white border-pink-600',
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

    // 원격(GitHub/서버) 최신 휴무표 자동 동기화
    fetchRemoteSchedules().then((merged) => {
      if (merged) {
        setSchedules(merged);
      }
    });
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
    const clean = normalizeStaffName((targetName ?? nameInput).trim());
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

  // 특정 년월로 직접 이동 (퀵 배지 클릭 시)
  const handleSelectYearMonth = (ym: string) => {
    const [yStr, mStr] = ym.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (!isNaN(y) && !isNaN(m)) {
      const now = new Date();
      if (y === now.getFullYear() && m === now.getMonth() + 1) {
        setSelectedDate(now);
      } else {
        setSelectedDate(new Date(y, m - 1, 1));
      }
    }
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
        ...baseMonth,
        yearMonth: currentYearMonth,
        updatedAt,
        isRegistered: true,
        employees: updatedEmployees,
      },
    };

    setSchedules(nextSchedules);
    saveAllSchedules(nextSchedules);
    setEditingCell(null);

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(nextSchedules, gh);
    }
  };

  // 특정 직원 행(줄) 삭제 (잘못 생성된 직원 줄 즉시 삭제)
  const handleDeleteEmployeeRow = (empName: string) => {
    const now = new Date();
    const updatedAt = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    const updatedEmployees = baseMonth.employees.filter(
      (emp) => emp.name !== empName
    );

    const nextSchedules: SchedulesMap = {
      ...schedules,
      [currentYearMonth]: {
        ...baseMonth,
        yearMonth: currentYearMonth,
        updatedAt,
        employees: updatedEmployees,
      },
    };

    setSchedules(nextSchedules);
    saveAllSchedules(nextSchedules);
    setEditingCell(null);
    setNotice({
      type: 'success',
      text: `🗑️ 휴무표에서 [${empName}] 직원 줄이 삭제되었습니다.`,
    });

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(nextSchedules, gh);
    }
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
      let parsedWeekdayByDay: Record<string, string> | undefined = undefined;

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
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const parsedResult = await parseUniversalExcelSchedule(
          wb,
          file.name,
          targetYearMonth
        );
        targetYearMonth = parsedResult.yearMonth;
        parsedEmployees = parsedResult.employees;
        parsedWeekdayByDay = parsedResult.weekdayByDay;
      } else {
        // 이미지(JPG/PNG) — 휴무표 전용 고해상도(maxWidth=3000, quality=0.95) 리사이징 및 1~31일 전수 대조 스캔
        const apiKey = getEffectiveGeminiApiKey();
        if (!apiKey) {
          throw new Error(
            'Gemini API 키가 설정되지 않아 사진 인식을 사용할 수 없습니다.'
          );
        }

        const compressed = await compressImageFile(file, 3000, 0.95);
        const base64Data = compressed.base64 || compressed.base64Data;
        const mimeType = compressed.mimeType;
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `당신은 롯데하이마트 경기광주점 월간 휴무 계획표 격자 이미지를 1칸의 오차도 없이 정밀 판독하는 전문 AI입니다.
반드시 아래 규칙을 지켜 1일부터 말일(31일)까지 모든 날짜 칸(빈칸 포함)을 상단 날짜 헤더와 1:1로 대조하여 순서대로 읽으세요.

[1. 상단 타이틀 연월 추출]
- 상단 타이틀(예: '3월 휴무 계획표', '10월 휴무 계획표', '11월 휴무 계획표')에서 해당 연도(year, 기본 ${currentYear})와 월(month, 1~12 정수)을 정확히 추출하세요.

[2. 날짜 헤더(Header) 기준 1:1 절대 매칭 및 칸 밀림(Column Shift) 방지 규칙]
- 좌측 고정열: [사용연차] | [NO] | [성명] | [담당]
- 중앙 날짜열: 먼저 날짜 숫자들이 적힌 헤더 행을 파싱하여 각 세로 열(Column)이 정확히 몇 월 며칠인지 '날짜 인덱스 맵'을 먼저 확정하세요.
- ⚠️ 주의 1 (이전 달/다음 달 날짜 제외): 표 왼쪽에 이전 달 말일 구간(예: 26, 27, 28, 29, 30, 31)이 먼저 나온 뒤 '1'부터 당월 날짜가 시작되거나, 당월 말일 오른쪽 옆에 다음 달 '1, 2' 열이 있는 경우, 반드시 당월(target month)의 1일~말일 세로 열만 1:1로 매칭하고 이전 달/다음 달 열의 데이터 잔상이 당월 날짜로 절대 섞이지 않게 하세요!
- ⚠️ 주의 2: 셀 주변의 굵은 빨간색 테두리 박스와 표 중앙의 '1 페이지' 반투명 워터마크 글씨는 무시하고 그 아래 실제 셀 기호만 읽으세요!
- ⚠️ 주의 3: 상단 '총 근무인원' 행과 '결원(휴무,교육,지원 등)' 요약 행, 그리고 하단 '대형 / 생활' 합계 행은 직원 명단이 아니므로 반드시 제외하세요!

[3. 명단 필터링 및 이름 표준화 (이전 달 명단 상속 금지)]
- 이 이미지 파일에 실제로 이름과 휴무 일정이 기재된 임직원만 동적으로 추출하여 리스트업하세요. 이미지에 없는 이전 달 직원 이름을 임의로 추가하거나 상속하지 마세요.
- 이름 인식 시 '한춘애' 또는 '한춘매'로 보이거나 적힌 이름은 예외 없이 정식 명칭인 "한준애"로 표준화하여 출력하세요.

[4. 기호 정규화 및 1~31일 전수 매핑 규칙]
- 동그라미('O', 'o', '○', '0', 'ㅇ', '휴무', 'OFF') -> 무조건 대문자 'O'로 통일
- 빈칸, 공백, '-', '근무', '정상', '출근' -> '' (정상 출근)
- '연차', 'V'(휴가), '반차', '출휴'(출산/특별휴가), '교육', '회의', 'HP' -> 원문 그대로 유지 (가로로 병합된 연속 휴가/출휴 셀은 해당되는 모든 날짜에 동일 코드를 기입)
- 각 직원을 읽을 때 빈칸을 건너뛰지 말고 먼저 cellTrace 필드에 "1:O, 2:, 3:, 4:, 5:, 6:O, ... 31:" 형태로 당월 1일부터 말일까지 모든 칸을 날짜 헤더와 1:1로 대조하여 기록한 뒤, schedule 배열에도 day(1~31 정수)와 status('', 'O', '연차', 'V', '반차', '출휴', '교육', '회의', 'HP')를 정확히 출력하세요.`;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.INTEGER },
            month: { type: Type.INTEGER },
            yearMonth: { type: Type.STRING },
            employees: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  no: { type: Type.INTEGER },
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  cellTrace: {
                    type: Type.STRING,
                    description:
                      '1일부터 31일까지 빈칸 포함 전수 문자열 (예: "1:O, 2:, 3:, 4:, 5:, 6:O, ...")',
                  },
                  schedule: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        day: { type: Type.INTEGER },
                        status: { type: Type.STRING },
                      },
                      required: ['day', 'status'],
                    },
                  },
                },
                required: ['no', 'name', 'role', 'cellTrace', 'schedule'],
              },
            },
          },
          required: ['month', 'employees'],
        };

        const GEMINI_MODELS = [
          'gemini-3.8-flash',
          'gemini-3.1-pro-preview',
          'gemini-3.7-flash',
          'gemini-3.5-flash',
          'gemini-flash-latest',
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
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              config: {
                responseMimeType: 'application/json',
                responseSchema,
                temperature: 0.0,
              },
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
        } else if (
          typeof parsedAi.month === 'number' &&
          parsedAi.month >= 1 &&
          parsedAi.month <= 12
        ) {
          const y =
            typeof parsedAi.year === 'number' && parsedAi.year >= 2024
              ? parsedAi.year
              : currentYear;
          targetYearMonth = `${y}-${String(parsedAi.month).padStart(2, '0')}`;
        }

        if (
          Array.isArray(parsedAi.employees) &&
          parsedAi.employees.length > 0
        ) {
          const rawExtracted = parsedAi.employees
            .filter((emp: any) => {
              const nm = normalizeStaffName(String(emp?.name || '').trim());
              if (!nm || OBSOLETE_FAKE_NAMES.has(nm)) return false;
              if (
                nm.includes('근무인원') ||
                nm.includes('결원') ||
                nm.includes('합계') ||
                nm.includes('대형') ||
                nm.includes('생활')
              ) {
                return false;
              }
              return true;
            })
            .map((emp: any, idx: number) => {
              const cleanDays: Record<string, DayScheduleCode> = {};

              // 1) cellTrace ("1:O, 2:, 3:, ...") 파싱
              if (typeof emp.cellTrace === 'string' && emp.cellTrace.trim()) {
                const pairs = emp.cellTrace.split(',');
                for (const pair of pairs) {
                  const [dStr, valStr] = pair.split(':');
                  const dNum = parseInt(String(dStr || '').trim(), 10);
                  if (dNum >= 1 && dNum <= 31) {
                    const code = normalizeScheduleCode(String(valStr || ''));
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    }
                  }
                }
              }

              // 2) schedule 배열 ([{ day, status }]) 파싱
              if (Array.isArray(emp.schedule)) {
                for (const cell of emp.schedule) {
                  const dNum = Number(cell?.day);
                  if (dNum >= 1 && dNum <= 31) {
                    const code = normalizeScheduleCode(
                      String(cell?.status || '')
                    );
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    } else if (cell?.status === '') {
                      delete cleanDays[String(dNum)];
                    }
                  }
                }
              }

              // 3) 구형 days 객체 호환
              if (emp.days && typeof emp.days === 'object') {
                Object.entries(emp.days).forEach(([dKey, val]) => {
                  const dNum = parseInt(dKey, 10);
                  if (dNum >= 1 && dNum <= 31) {
                    const code = normalizeScheduleCode(String(val || ''));
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    }
                  }
                });
              }

              return {
                no: Number(emp.no) || idx + 1,
                name: normalizeStaffName(String(emp.name || '').trim()),
                role: String(emp.role || '매장').trim(),
                days: cleanDays,
              };
            });

          parsedEmployees = reconcileOcrEmployees(rawExtracted);
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
          isRegistered: true,
          employees: parsedEmployees,
          ...(parsedWeekdayByDay ? { weekdayByDay: parsedWeekdayByDay } : {}),
        },
      };

      setSchedules(nextSchedules);
      saveAllSchedules(nextSchedules);

      // 업로드된 연월로 화면 자동 이동
      const [yStr, mStr] = targetYearMonth.split('-');
      setSelectedDate(new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1));

      // 관리자의 기기에 GitHub 연동 설정이 되어 있으면 전 직원 자동 배포
      const gh = loadGitHubSyncConfig();
      let syncedRemote = false;
      if (gh.repo && gh.token) {
        syncedRemote = await publishSchedulesToGitHub(nextSchedules, gh);
      }

      setNotice({
        type: 'success',
        text: syncedRemote
          ? `✅ [${targetYearMonth}] 휴무표 (${parsedEmployees.length}명) 저장 + 전 직원 자동 업데이트 완료!`
          : `✅ [${targetYearMonth}] 휴무표 (${parsedEmployees.length}명)가 성공적으로 저장되었습니다!`,
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

  // 휴무표 삭제 및 관리 상태 및 핸들러
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // 모달 내부 하위 상태 뒤로가기 핸들러 등록
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (isDeleteModalOpen) {
        setIsDeleteModalOpen(false);
        return true;
      }
      if (editingCell !== null) {
        setEditingCell(null);
        return true;
      }
      if (isEditingName && Boolean(savedName)) {
        setIsEditingName(false);
        return true;
      }
      if (activeView === 'full') {
        setActiveView('today');
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [isOpen, isDeleteModalOpen, editingCell, isEditingName, savedName, activeView]);

  const handleDeleteMonth = (ym: string) => {
    if (!schedules[ym]) return;
    const next = { ...schedules };
    delete next[ym];
    setSchedules(next);
    saveAllSchedules(next);
    setNotice({
      type: 'info',
      text: `🗑️ [${ym}] 휴무표 데이터가 삭제되었습니다.`,
    });

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(next, gh);
    }
  };

  const handleDeleteAllSchedules = () => {
    const next: SchedulesMap = {};
    setSchedules(next);
    saveAllSchedules(next);
    setNotice({
      type: 'info',
      text: '🗑️ 저장된 모든 월의 휴무표 데이터가 완전히 삭제되었습니다.',
    });
    setIsDeleteModalOpen(false);

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(next, gh);
    }
  };

  // 저장된 월(Month) 목록 (퀵 배지용)
  const savedYearMonths = useMemo(() => {
    return Object.keys(schedules)
      .filter((ym) => schedules[ym]?.employees && schedules[ym]?.employees.length > 0)
      .sort();
  }, [schedules]);

  const isCurrentMonthRegistered = Boolean(
    schedules[currentYearMonth] && schedules[currentYearMonth]?.isRegistered !== false
  );

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
        code === '출휴' ||
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

  const selectedWeekday =
    monthData.weekdayByDay?.[String(currentDay)] ||
    WEEKDAY_KO[selectedDate.getDay()];
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
      case '출휴':
        badgeEl = (
          <span className={`${baseCls} bg-pink-500 text-white`}>출휴</span>
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
                  onClick={() => {
                    window.history.pushState({ appGuard: true }, '');
                    setIsEditingName(true);
                  }}
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

            <button
              type="button"
              onClick={() => {
                window.history.pushState({ appGuard: true }, '');
                setIsDeleteModalOpen(true);
              }}
              title="저장된 휴무표 삭제 및 관리"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 border border-slate-700 hover:border-rose-700/60 text-xs font-black transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">🗑️ 휴무표 삭제</span>
              <span className="sm:hidden">삭제</span>
            </button>

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

            {/* 직원 원터치 선택 칩 (현재 월 직원 명단 반영) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {(monthData.employees.length > 0
                ? monthData.employees
                : GWANGJU_STAFF_ROSTER
              ).map((emp) => (
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
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 py-2.5 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                onClick={() => {
                  if (activeView !== 'full') {
                    window.history.pushState({ appGuard: true }, '');
                  }
                  setActiveView('full');
                }}
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

          {/* 저장된 휴무표 월(Month) 퀵 배지 바 */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-200/80 text-xs">
            <span className="font-bold text-slate-500 shrink-0 flex items-center gap-1">
              📂 저장된 달:
            </span>
            {savedYearMonths.length === 0 ? (
              <span className="text-slate-400 font-semibold text-[11px]">
                (등록된 휴무표 없음 - 우측 상단 업로드 필요)
              </span>
            ) : (
              savedYearMonths.map((ym) => {
                const isSelected = ym === currentYearMonth;
                return (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => handleSelectYearMonth(ym)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {ym.replace('-', '.')}
                    {isSelected && (
                      <span className="ml-1 text-[10px] font-extrabold text-amber-950">✓</span>
                    )}
                  </button>
                );
              })
            )}
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
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => handleDeleteEmployeeRow(editingCell.empName)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <span>🗑️ 이 직원 줄 삭제</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 3) 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-4">
          {/* 미등록 월 안내 배너 */}
          {!isCurrentMonthRegistered && (
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="font-black text-sm text-amber-900">
                    아직 등록된 휴무표가 없습니다. 상단 [📤 휴무표 사진/엑셀 업로드] 버튼으로 등록해 주세요.
                  </div>
                  <div className="text-xs text-amber-800 font-medium">
                    현재 조회 중인 {currentYear}년 {currentMonth}월 휴무표가 등록되지 않았습니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 transition shadow-xs cursor-pointer"
              >
                📤 지금 업로드하기
              </button>
            </div>
          )}

          {/* ==================== [뷰 1: 👥 오늘 근무자] ==================== */}
          {activeView === 'today' && (
            !isCurrentMonthRegistered ? (
              <div className="rounded-3xl bg-white border-2 border-dashed border-amber-400 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl shadow-2xs">
                  📤
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base sm:text-xl font-black text-slate-900">
                    아직 {currentYear}년 {currentMonth}월 휴무표가 등록되지 않았습니다.
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 leading-relaxed">
                    엑셀(.xlsx/.csv) 또는 휴무표 사진을 업로드하시면 오늘 근무자·휴무자 명단과 내 휴무 카운트다운이 자동으로 표시됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-sm sm:text-base font-black shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span>
                    {isUploading
                      ? '휴무표 분석 중...'
                      : '📤 지금 휴무표(엑셀/사진) 업로드하기'}
                  </span>
                </button>
              </div>
            ) : (
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
                            : myTodayCode === '출휴'
                            ? '🩷 출휴(출산/특별휴가)'
                            : myTodayCode
                            ? `📌 ${myTodayCode}`
                            : '💪 정상 근무'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        이번 달 남은 내 휴무(O·연차·V·출휴):{' '}
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
                      selectedWeekday === '일' || selectedDate.getDay() === 0
                        ? 'text-rose-600'
                        : selectedWeekday === '토' || selectedDate.getDay() === 6
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
            )
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
                  <span className="px-2 py-0.5 rounded bg-pink-500 text-white">
                    출휴
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
                          const weekdayChar =
                            monthData.weekdayByDay?.[String(d)] ||
                            WEEKDAY_KO[dow];
                          const isHoliday = (
                            HOLIDAYS_BY_MONTH[currentYearMonth] || []
                          ).includes(d);
                          const isSundayCol =
                            weekdayChar === '일' || dow === 0 || isHoliday;
                          const isSaturdayCol =
                            !isSundayCol && (weekdayChar === '토' || dow === 6);
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
                              className={`sticky top-0 z-20 px-1 py-1.5 border-r border-b cursor-pointer transition ${
                                isTodayCol
                                  ? 'bg-amber-400 text-slate-950 border-amber-500'
                                  : isSundayCol
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-200'
                                  : isSaturdayCol
                                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-200'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                              }`}
                            >
                              <div
                                className={`text-xs font-black ${
                                  isTodayCol
                                    ? 'text-slate-950'
                                    : isSundayCol
                                    ? 'text-rose-700'
                                    : isSaturdayCol
                                    ? 'text-blue-700'
                                    : 'text-white'
                                }`}
                              >
                                {d}일
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  isTodayCol
                                    ? 'text-slate-900'
                                    : isSundayCol
                                    ? 'text-rose-600'
                                    : isSaturdayCol
                                    ? 'text-blue-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {weekdayChar}
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
                            const dateObj = new Date(
                              currentYear,
                              currentMonth - 1,
                              d
                            );
                            const dow = dateObj.getDay();
                            const weekdayChar =
                              monthData.weekdayByDay?.[String(d)] ||
                              WEEKDAY_KO[dow];
                            const isHoliday = (
                              HOLIDAYS_BY_MONTH[currentYearMonth] || []
                            ).includes(d);
                            const isSundayCol =
                              weekdayChar === '일' || dow === 0 || isHoliday;
                            const isSaturdayCol =
                              !isSundayCol &&
                              (weekdayChar === '토' || dow === 6);
                            const isTodayCol =
                              todayReal.getFullYear() === currentYear &&
                              todayReal.getMonth() + 1 === currentMonth &&
                              todayReal.getDate() === d;
                            return (
                              <td
                                key={`${emp.name}-${d}`}
                                onClick={() => {
                                  window.history.pushState({ appGuard: true }, '');
                                  setEditingCell({
                                    empName: emp.name,
                                    empRole: emp.role,
                                    day: d,
                                    currentCode: code,
                                  });
                                }}
                                className={`px-0.5 py-1 border-r border-slate-200 last:border-r-0 cursor-pointer transition align-middle ${
                                  isTodayCol
                                    ? 'bg-amber-100/80 ring-1 ring-inset ring-amber-400'
                                    : isSundayCol
                                    ? isMe
                                      ? 'bg-rose-100/85 hover:bg-rose-200/75'
                                      : 'bg-rose-50/90 hover:bg-rose-100/80'
                                    : isSaturdayCol
                                    ? isMe
                                      ? 'bg-blue-100/85 hover:bg-blue-200/75'
                                      : 'bg-blue-50/90 hover:bg-blue-100/80'
                                    : isMe
                                    ? 'bg-amber-50/70'
                                    : 'bg-white hover:bg-slate-50'
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

      {/* 휴무표 삭제 / 관리 모달 */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-black text-base">🗑️ 저장된 휴무표 관리 및 삭제</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 1. 현재 보고 있는 월 삭제 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-500">
                  현재 조회 중인 월 ({currentYearMonth.replace('-', '.')})
                </div>
                <button
                  type="button"
                  disabled={!schedules[currentYearMonth]}
                  onClick={() => handleDeleteMonth(currentYearMonth)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 disabled:opacity-40 text-xs font-black transition cursor-pointer"
                >
                  현재 보고 있는 {currentYear}년 {currentMonth}월 휴무표 삭제
                </button>
              </div>

              {/* 2. 등록된 월별 개별 삭제 목록 */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>저장된 월별 목록 ({savedYearMonths.length}개)</span>
                  <span className="text-[11px] text-slate-400 font-normal">개별 삭제 가능</span>
                </div>
                {savedYearMonths.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                    저장된 휴무표가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {savedYearMonths.map((ym) => (
                      <div
                        key={ym}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="font-black text-slate-800 flex items-center gap-2">
                          <span>📅 {ym.replace('-', '.')}</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            ({schedules[ym]?.employees?.length || 0}명 등록)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMonth(ym)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 text-xs font-bold transition cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. 전체 초기화 / 삭제 */}
              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleDeleteAllSchedules}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer shadow-xs"
                >
                  ⚠️ 저장된 전체 휴무표 초기화
                </button>
              </div>
            </div>

            <div className="bg-slate-100 px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
