import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from '@google/genai';
import { toPng } from 'html-to-image';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Loader2,
  Moon,
  Paintbrush,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Sparkles,
  Sun,
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
  '생주',
  '미화',
  '출휴',
  '사가',
]);

export type DayScheduleCode =
  | '' // 정상 출근
  | 'O' // 정기 휴무
  | '연차' // 연차
  | 'V' // 휴가(Summer/Refresh)
  | '반차' // 반차
  | '교육' // 교육
  | '회의' // 회의
  | 'HP' // HP 근무
  | '출휴' // 출산휴가
  | '사가'; // 사규/경조휴가

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
}

export type SchedulesMap = Record<string, MonthlyScheduleData>;

export function isOffDayCode(code?: string): boolean {
  const c = (code || '').trim().toUpperCase();
  return (
    c === 'O' ||
    c === '연차' ||
    c === 'V' ||
    c === '출휴' ||
    c === '사가' ||
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
  { name: '한춘애', role: '대형' },
  { name: '손정민', role: '생활' },
  { name: '박기복', role: '주방' },
  { name: '임용주', role: '생주' },
  { name: '최문기', role: '쿠쿠' },
  { name: '윤현주', role: '쿠쿠' },
  { name: '한나라', role: '생활' },
  { name: '권지혜', role: 'KBB' },
  { name: '서형래', role: '애플' },
  { name: '김지우', role: '모바일' },
  { name: '이세빈', role: '모바일' },
  { name: '김도인', role: 'SKT' },
  { name: '정태일', role: 'LGU' },
  { name: '주형남', role: 'KT' },
  { name: '김흥영', role: '미화' },
];

const NAME_TYPO_MAP: Record<string, string> = {
  한춘매: '한춘애',
  손경민: '손정민',
};

export function loadSavedUserName(): string {
  try {
    const raw = localStorage.getItem(USER_NAME_STORAGE_KEY)?.trim() || '';
    if (raw && OBSOLETE_FAKE_NAMES.has(raw)) {
      localStorage.removeItem(USER_NAME_STORAGE_KEY);
      return '';
    }
    if (raw && NAME_TYPO_MAP[raw]) {
      const corrected = NAME_TYPO_MAP[raw];
      localStorage.setItem(USER_NAME_STORAGE_KEY, corrected);
      return corrected;
    }
    return raw;
  } catch {
    return '';
  }
}

export function saveUserName(name: string): void {
  try {
    const raw = name.trim();
    const clean = NAME_TYPO_MAP[raw] || raw;
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

function parseUpdatedAtMs(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val ?? '').trim();
  if (!s) return 0;
  if (/^\d{10,15}$/.test(s)) return Number(s);
  const iso = s.replace(/\./g, '-').replace(/\s+/g, ' ').trim().replace(' ', 'T');
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
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
      const [ymY, ymM] = ymKey.split('-').map(Number);
      const maxDaysForYm =
        ymY && ymM ? new Date(ymY, ymM, 0).getDate() : 31;
      cleanedMap[ymKey] = {
        ...monthObj,
        updatedAt:
          typeof monthObj.updatedAt === 'number'
            ? new Date(monthObj.updatedAt)
                .toISOString()
                .slice(0, 16)
                .replace('T', ' ')
            : String(monthObj.updatedAt || ''),
        employees: emps.map((e) => {
          const normalizedDays: Record<string, DayScheduleCode> = {};
          if (e.days && typeof e.days === 'object') {
            for (const [dKey, rawVal] of Object.entries(e.days)) {
              const dNum = parseInt(dKey, 10);
              if (!dNum || dNum < 1 || dNum > maxDaysForYm) continue;
              const norm = normalizeScheduleCode(String(rawVal || ''));
              if (norm) {
                normalizedDays[String(dNum)] = norm;
              }
            }
          }
          return {
            ...e,
            name: NAME_TYPO_MAP[e.name] || e.name,
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

export function syncSchedulesToDevServer(map: SchedulesMap): void {
  try {
    fetch('/api/schedule/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedules: map }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * [원격 동기화 1] 서버/GitHub에 배포된 최신 휴무표(/schedule-data.json) 자동 가져오기 및 병합
 */
export async function fetchRemoteSchedules(): Promise<SchedulesMap | null> {
  try {
    let ghMap: SchedulesMap | null = null;
    let staticMap: SchedulesMap | null = null;
    const gh = loadGitHubSyncConfig();
    const branch = gh.branch || 'main';

    if (gh.repo) {
      try {
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
          ghMap = (await ghRes.json()) as SchedulesMap;
        }
      } catch {
        // ignore github fetch error and fallback to static schedule-data.json
      }
    }

    try {
      const res = await fetch(`./schedule-data.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        staticMap = (await res.json()) as SchedulesMap;
      }
    } catch {
      // ignore
    }

    // GitHub 데이터와 로컬 정적 파일(./schedule-data.json)을 모두 확인하여 월별로 더 최신(updatedAt)인 데이터를 채택
    const remoteMap: SchedulesMap = {};
    if (ghMap && typeof ghMap === 'object') {
      Object.assign(remoteMap, ghMap);
    }
    if (staticMap && typeof staticMap === 'object') {
      for (const [ym, stMonth] of Object.entries(staticMap)) {
        if (!stMonth || !Array.isArray(stMonth.employees)) continue;
        const existing = remoteMap[ym];
        if (
          !existing ||
          !existing.updatedAt ||
          (stMonth.updatedAt &&
            parseUpdatedAtMs(stMonth.updatedAt) >=
              parseUpdatedAtMs(existing.updatedAt))
        ) {
          remoteMap[ym] = stMonth;
        }
      }
    }

    if (Object.keys(remoteMap).length === 0) {
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
        (remoteMonth.updatedAt &&
          parseUpdatedAtMs(remoteMonth.updatedAt) >=
            parseUpdatedAtMs(localMonth.updatedAt))
      ) {
        merged[ym] = remoteMonth;
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
      isRegistered: schedules[yearMonth].isRegistered ?? true,
    };
  }
  // 등록되지 않은 월이거나 삭제된 월인 경우 가장 최근 등록된 월의 직원 명단(또는 기본 명단)으로 빈 휴무표 반환
  const sortedKeys = Object.keys(schedules)
    .filter((k) => schedules[k]?.employees?.length > 0)
    .sort();
  const baseRoster =
    sortedKeys.length > 0
      ? schedules[sortedKeys[sortedKeys.length - 1]].employees
      : GWANGJU_STAFF_ROSTER;

  return {
    yearMonth,
    updatedAt: '미등록 (사진/엑셀 업로드로 등록 가능)',
    isRegistered: false,
    employees: baseRoster.map((emp) => ({
      name: emp.name,
      role: emp.role,
      days: {},
    })),
  };
}

/**
 * [2-1] 근태 기호 유연 정규화
 */
export function normalizeScheduleCode(raw: string): DayScheduleCode {
  const rawTrim = String(raw ?? '').trim();
  if (!rawTrim) return '';
  const s = rawTrim.toUpperCase();

  // 출산휴가 ('출휴')
  if (s === '출휴' || s.includes('출휴') || s.includes('출산')) {
    return '출휴';
  }

  // 사규/경조휴가 ('사가')
  if (
    s === '사가' ||
    s.includes('사가') ||
    s.includes('사규') ||
    s.includes('경조')
  ) {
    return '사가';
  }

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

/**
 * 셀 값에서 1~31일 날짜 정수를 추출
 */
function extractDayNumberFromCell(cellVal: any): number | null {
  if (cellVal === null || cellVal === undefined || cellVal === '') return null;

  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    return cellVal.getDate();
  }

  if (typeof cellVal === 'number') {
    if (Number.isInteger(cellVal) && cellVal >= 1 && cellVal <= 31) {
      return cellVal;
    }
    // 엑셀 시리얼 날짜 (예: 2020년~2035년 -> 약 43831 ~ 49675)
    if (cellVal >= 43000 && cellVal <= 52000) {
      const utcDays = Math.floor(cellVal - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      const day = d.getUTCDate();
      if (day >= 1 && day <= 31) return day;
    }
    return null;
  }

  const str = String(cellVal).trim();
  if (!str) return null;

  // 1) 단순 숫자 "1" ~ "31" 또는 "1일" ~ "31일" 또는 "1(목)" / "1일(목)"
  const mSimple = str.match(
    /^0?([1-9]|[12]\d|3[01])\s*(?:일)?(?:\s*[(（][월화수목금토일][)）])?$/
  );
  if (mSimple) {
    return parseInt(mSimple[1], 10);
  }

  // 2) YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const mFullDate = str.match(
    /^20\d{2}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*0?([1-9]|[12]\d|3[01])\s*일?/
  );
  if (mFullDate) {
    return parseInt(mFullDate[1], 10);
  }

  // 3) MM/DD, MM-DD, MM.DD (예: 10/1, 10-01, 11.1)
  const mMonthDay = str.match(
    /^(?:0?[1-9]|1[0-2])\s*[-./월]\s*0?([1-9]|[12]\d|3[01])\s*(?:일)?(?:\s*[(（][월화수목금토일][)）])?$/
  );
  if (mMonthDay) {
    return parseInt(mMonthDay[1], 10);
  }

  return null;
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

  // 2026년 11월, 2026년_11월, 2026-11, 2026.10 등
  const ymMatch = s.match(/20(\d{2})[\s년.\-/_]+(0?[1-9]|1[0-2])(?:\s*월|[^0-9]|$)/);
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
 * 엑셀 업로드 시: 하드코딩 명단을 강제하지 않고 엑셀에 적힌 직원 명단과 근태(days)를 100% 신뢰하여 반영
 * (단, 알려진 오타 '한춘매'->'한춘애', '손경민'->'손정민' 교정 및 직책 누락 시 기존 직책 보완)
 */
function finalizeExcelEmployees(
  rawList: { name: string; role: string; days: Record<string, DayScheduleCode> }[]
): EmployeeMonthlySchedule[] {
  const result: EmployeeMonthlySchedule[] = [];
  const seenNames = new Set<string>();

  for (const item of rawList) {
    const cleanRawName = item.name.replace(/\s+/g, '').trim();
    if (!cleanRawName || OBSOLETE_FAKE_NAMES.has(cleanRawName)) continue;
    const finalName = NAME_TYPO_MAP[cleanRawName] || cleanRawName;

    const stdMatch = GWANGJU_STAFF_ROSTER.find((s) => s.name === finalName);
    const rawRole = (item.role || '').trim();
    const finalRole =
      rawRole && rawRole !== '매장'
        ? rawRole
        : stdMatch?.role || rawRole || '매장';

    if (seenNames.has(finalName)) {
      const existing = result.find((e) => e.name === finalName);
      if (existing) {
        existing.days = { ...existing.days, ...item.days };
        if (existing.role === '매장' && finalRole !== '매장') {
          existing.role = finalRole;
        }
      }
    } else {
      seenNames.add(finalName);
      result.push({
        name: finalName,
        role: finalRole,
        days: { ...item.days },
      });
    }
  }

  return result;
}

/**
 * 사진(이미지) AI OCR 업로드 전용:
 * 글자 깨짐(예: 한춘매->한춘애, 손경민->손정민 등 1글자 OCR 오인식)만 보정하되,
 * 새로운 직원 이름이 있으면 누락시키지 않고 그대로 포함하며 날짜별 근태(days)는 100% 그대로 보존합니다.
 */
function reconcileOcrEmployees(
  rawList: { no?: number; name: string; role: string; days: Record<string, DayScheduleCode> }[]
): EmployeeMonthlySchedule[] {
  return rawList.map((r) => {
    const rawName = r.name.replace(/\s+/g, '').trim();
    const typoCorrected = NAME_TYPO_MAP[rawName] || rawName;

    // 1) 정확히 일치하는 기존 직원 확인
    const exactMatch = GWANGJU_STAFF_ROSTER.find(
      (s) => s.name === typoCorrected
    );
    if (exactMatch) {
      return {
        name: exactMatch.name,
        role: r.role && r.role !== '매장' ? r.role : exactMatch.role,
        days: r.days || {},
      };
    }

    // 2) 담당(role)이 같고 이름 3글자 중 2글자가 일치하는 OCR 깨짐(예: 박기복 -> 박기록)만 보정
    const fuzzyOcrMatch = GWANGJU_STAFF_ROSTER.find((s) => {
      if (s.name.length !== 3 || typoCorrected.length !== 3) return false;
      let matchChars = 0;
      for (let i = 0; i < 3; i++) {
        if (s.name[i] === typoCorrected[i]) matchChars++;
      }
      const sameRole =
        r.role &&
        (s.role.includes(r.role) || r.role.includes(s.role));
      return matchChars >= 2 && sameRole;
    });

    if (fuzzyOcrMatch) {
      return {
        name: fuzzyOcrMatch.name,
        role: fuzzyOcrMatch.role,
        days: r.days || {},
      };
    }

    // 3) 신규 직원 또는 타 지점 직원은 이름/담당/근태 모두 100% 그대로 유지
    return {
      name: typoCorrected,
      role: r.role || '매장',
      days: r.days || {},
    };
  });
}

/**
 * [1] 양식이 바뀌어도 절대 실패하지 않는 '3중 만능 엑셀/CSV 파서 + AI 자동 폴백'
 * 1단계(자율 격자 위치 탐색) ➔ 2단계(세로형 Long DB & 요약형 표 호환) ➔ 3단계(Gemini AI 만능 폴백)
 */
async function parseUniversalExcelSchedule(
  wb: XLSX.WorkBook,
  fileName: string,
  fallbackYearMonth: string
): Promise<{
  yearMonth: string;
  employees: EmployeeMonthlySchedule[];
  prevYearMonth?: string;
  prevMonthPatch?: Record<string, Record<string, DayScheduleCode>>;
}> {
  const defaultYear =
    parseInt(fallbackYearMonth.split('-')[0], 10) || new Date().getFullYear();

  let detectedYearMonth =
    detectYearMonthFromText(fileName, defaultYear) || fallbackYearMonth;

  const sheetCsvTexts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const ymFromSheetName = detectYearMonthFromText(sheetName, defaultYear);
    if (ymFromSheetName) {
      detectedYearMonth = ymFromSheetName;
    }

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });
    if (!rows || rows.length === 0) continue;

    // 상단 1~10행 셀 텍스트에서 연/월 자동 감지
    for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx++) {
      const rowText = (rows[rIdx] || []).map((c) => String(c ?? '')).join(' ');
      const ymFromRow = detectYearMonthFromText(rowText, defaultYear);
      if (ymFromRow) {
        detectedYearMonth = ymFromRow;
        break;
      }
    }

    // 3단계 폴백 대비 CSV 텍스트 보관
    const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (csvText) {
      sheetCsvTexts.push(`[시트: ${sheetName}]\n${csvText}`);
    }

    const [targetY, targetM] = detectedYearMonth.split('-').map(Number);
    const maxDaysInTargetMonth =
      targetY && targetM ? new Date(targetY, targetM, 0).getDate() : 31;
    const prevDateObj = new Date(
      targetY || defaultYear,
      (targetM || 1) - 2,
      1
    );
    const prevYearMonth = `${prevDateObj.getFullYear()}-${String(
      prevDateObj.getMonth() + 1
    ).padStart(2, '0')}`;

    // =========================================================================
    // [1단계] 가로형 격자 표(Matrix) 자율 위치 탐색 (헤더 위치·병합 무관)
    // =========================================================================
    let bestDateRowIdx = -1;
    let bestDayColMap: Record<number, number> = {};
    let bestPrevMonthDayColMap: Record<number, number> = {};
    let maxDayCount = 0;

    // 상단 1~20행 전체를 스캔하여 날짜(1~31일)가 가장 많이 포함된 행 탐색 (절대 중간 break 금지)
    const scanHeaderLimit = Math.min(rows.length, 20);
    for (let rIdx = 0; rIdx < scanHeaderLimit; rIdx++) {
      const r = rows[rIdx] || [];
      const dayEntries: { cIdx: number; dayNum: number }[] = [];
      for (let cIdx = 0; cIdx < r.length; cIdx++) {
        const dayNum = extractDayNumberFromCell(r[cIdx]);
        if (dayNum !== null && dayNum >= 1 && dayNum <= 31) {
          dayEntries.push({ cIdx, dayNum });
        }
      }
      if (dayEntries.length < 7) continue;

      const firstOneIdx = dayEntries.findIndex((e) => e.dayNum === 1);
      const foundDays: Record<number, number> = {};
      const prevMonthDays: Record<number, number> = {};

      if (firstOneIdx !== -1) {
        // 첫 번째 1일 이전에 위치한 20~31일 열들은 전월 말일(prevMonthDayColMap)로 분리
        for (let i = 0; i < firstOneIdx; i++) {
          const { cIdx, dayNum } = dayEntries[i];
          if (dayNum >= 20 && dayNum <= 31 && prevMonthDays[dayNum] === undefined) {
            prevMonthDays[dayNum] = cIdx;
          }
        }
        // 첫 번째 1일부터 오른쪽으로 진행하면서 날짜가 증가하는 구간만 당월에 등록
        let prevDayNum = 0;
        for (let i = firstOneIdx; i < dayEntries.length; i++) {
          const { cIdx, dayNum } = dayEntries[i];
          if (dayNum < prevDayNum) {
            break;
          }
          if (dayNum <= maxDaysInTargetMonth && foundDays[dayNum] === undefined) {
            foundDays[dayNum] = cIdx;
          }
          prevDayNum = dayNum;
        }
      } else {
        for (const { cIdx, dayNum } of dayEntries) {
          if (dayNum <= maxDaysInTargetMonth && foundDays[dayNum] === undefined) {
            foundDays[dayNum] = cIdx;
          }
        }
      }

      const count = Object.keys(foundDays).length;
      if (count > maxDayCount) {
        maxDayCount = count;
        bestDateRowIdx = rIdx;
        bestDayColMap = foundDays;
        bestPrevMonthDayColMap = prevMonthDays;
      }
    }

    if (maxDayCount >= 7) {
      const dateColSet = new Set<number>([
        ...Object.values(bestDayColMap),
        ...Object.values(bestPrevMonthDayColMap),
      ]);

      // 성명 열(nameColIdx) 및 담당/직책 열(roleColIdx) 자율 탐색
      // 방법 A: 상단 1~20행에서 키워드 탐색 (날짜 행과 다른 줄이어도 독립 탐색)
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

      // 방법 B: 데이터 패턴 자율 스캔 (좌측 0~10번 열 중 2~4글자 한글 이름이 가장 많이 등장하는 열 계산)
      let patternNameColIdx = -1;
      let maxNameHits = 0;
      const maxColToScan = 10;

      for (let cIdx = 0; cIdx <= maxColToScan; cIdx++) {
        let hits = 0;
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          if (rIdx === bestDateRowIdx) continue;
          const cellStr = String(rows[rIdx]?.[cIdx] ?? '').trim();
          if (isValidKoreanStaffName(cellStr)) {
            hits++;
          }
        }
        if (hits > maxNameHits) {
          maxNameHits = hits;
          patternNameColIdx = cIdx;
        }
      }

      // 키워드 열에 실제 한글 이름이 2명 이상 있는지 검증, 없으면 패턴 스캔 열 채택
      let nameColIdx = keywordNameColIdx;
      if (nameColIdx !== -1) {
        let keywordHits = 0;
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          if (rIdx === bestDateRowIdx) continue;
          if (isValidKoreanStaffName(String(rows[rIdx]?.[nameColIdx] ?? ''))) {
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

      // roleColIdx 결정: 키워드로 못 찾았으면 nameColIdx + 1 또는 nameColIdx - 1 중 직책 텍스트가 있는 열 자동 탐색
      let roleColIdx =
        keywordRoleColIdx !== -1 && keywordRoleColIdx !== nameColIdx
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

      const matrixEmployees: {
        name: string;
        role: string;
        days: Record<string, DayScheduleCode>;
      }[] = [];
      const prevMonthPatch: Record<string, Record<string, DayScheduleCode>> = {};

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        if (rIdx <= bestDateRowIdx) continue;
        const r = rows[rIdx] || [];

        const fullRowText = r.map((c) => String(c ?? '')).join(' ');
        if (
          fullRowText.includes('연중 휴가계획') ||
          fullRowText.includes('연중휴가') ||
          fullRowText.includes('지원현황')
        ) {
          break;
        }

        const rawName = String(r[nameColIdx] ?? '')
          .replace(/\s+/g, '')
          .replace(/^\d+[.)]?\s*/, '')
          .trim();

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
          rowJoined.includes('총계')
        ) {
          continue;
        }

        const days: Record<string, DayScheduleCode> = {};
        Object.entries(bestDayColMap).forEach(([dayStr, colIdx]) => {
          if (colIdx === nameColIdx || colIdx === roleColIdx) return;
          const code = normalizeScheduleCode(String(r[colIdx] ?? ''));
          if (code) {
            days[dayStr] = code;
          }
        });

        const finalEmpName = NAME_TYPO_MAP[rawName] || rawName;
        if (Object.keys(bestPrevMonthDayColMap).length > 0) {
          const prevDaysForEmp: Record<string, DayScheduleCode> = {};
          Object.entries(bestPrevMonthDayColMap).forEach(([dayStr, colIdx]) => {
            if (colIdx === nameColIdx || colIdx === roleColIdx) return;
            const code = normalizeScheduleCode(String(r[colIdx] ?? ''));
            prevDaysForEmp[dayStr] = code;
          });
          prevMonthPatch[finalEmpName] = prevDaysForEmp;
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
      if (finalizedMatrix.length >= 3) {
        return {
          yearMonth: detectedYearMonth,
          employees: finalizedMatrix,
          ...(Object.keys(prevMonthPatch).length > 0
            ? { prevYearMonth, prevMonthPatch }
            : {}),
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

      // 행 안에서 한글 이름 셀 찾기
      let rowName = '';
      let rowNameCol = -1;
      for (let cIdx = 0; cIdx < Math.min(r.length, 8); cIdx++) {
        const cand = String(r[cIdx] ?? '').replace(/\s+/g, '').trim();
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

      // 같은 행의 다른 셀들 분석:
      // 케이스 A: 요약형 문자열 (예: "10/1(O), 10/14(연차)" 또는 "1일(휴무), 6일(O)" 또는 "1, 6, 8, 9")
      // 케이스 B: 세로형 단일 일자 + 근태상태 (예: 날짜 셀 = "10/14" 또는 14, 상태 셀 = "연차" 또는 "O")
      let singleDayInRow: number | null = null;
      let singleCodeInRow: DayScheduleCode = '';

      for (let cIdx = 0; cIdx < r.length; cIdx++) {
        if (cIdx === rowNameCol) continue;
        const cellVal = r[cIdx];
        const cellStr = String(cellVal ?? '').trim();
        if (!cellStr) continue;

        // 요약형 패턴 1: "(10/)?14일?\s*[:(（]?\s*(O|연차|V|반차|교육|회의|HP|출휴|사가|휴무|휴가)"
        const summaryRegex =
          /(?:(?:0?[1-9]|1[0-2])\s*[-./월]\s*)?0?([1-9]|[12]\d|3[01])\s*일?\s*[(（:：-]?\s*(O|o|○|휴무|정기휴무|연차|V|v|휴가|반차|오전반차|오후반차|교육|회의|HP|출휴|출산|사가|사규|경조)\s*[)）]?/g;
        let matchSummary: RegExpExecArray | null;
        let matchedAnySummary = false;
        while ((matchSummary = summaryRegex.exec(cellStr)) !== null) {
          matchedAnySummary = true;
          const dNum = parseInt(matchSummary[1], 10);
          const code = normalizeScheduleCode(matchSummary[2]);
          if (dNum >= 1 && dNum <= maxDaysInTargetMonth && code) {
            empEntry.days[String(dNum)] = code;
          }
        }
        if (matchedAnySummary) continue;

        // 요약형 패턴 2: 쉼표로 구분된 휴무 일자 나열 (예: "1, 6, 8, 9, 15, 20")
        if (/^\d{1,2}(?:\s*,\s*\d{1,2}){2,}$/.test(cellStr)) {
          cellStr.split(',').forEach((part) => {
            const dNum = parseInt(part.trim(), 10);
            if (dNum >= 1 && dNum <= maxDaysInTargetMonth && !empEntry.days[String(dNum)]) {
              empEntry.days[String(dNum)] = 'O';
            }
          });
          continue;
        }

        // 세로형 단일 날짜인지 확인
        const maybeDay = extractDayNumberFromCell(cellVal);
        if (maybeDay !== null && singleDayInRow === null) {
          singleDayInRow = maybeDay;
          continue;
        }

        // 세로형 근태 코드인지 확인
        const maybeCode = normalizeScheduleCode(cellStr);
        if (maybeCode) {
          singleCodeInRow = maybeCode;
          continue;
        }

        // 직책/담당 텍스트 보완
        if (
          empEntry.role === '매장' &&
          cellStr.length >= 2 &&
          cellStr.length <= 8 &&
          !/^\d+$/.test(cellStr)
        ) {
          empEntry.role = cellStr;
        }
      }

      if (singleDayInRow !== null && singleDayInRow <= maxDaysInTargetMonth) {
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
  // [3단계] 초강력 Gemini AI 엑셀 폴백 (어떤 기상천외한 엑셀 양식도 100% 해결)
  // =========================================================================
  const apiKey = getEffectiveGeminiApiKey();
  if (!apiKey || sheetCsvTexts.length === 0) {
    throw new Error(
      '엑셀 파일에서 직원 성명 및 휴무 데이터를 찾지 못했습니다.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const combinedCsv = sheetCsvTexts.join('\n\n').slice(0, 60000);

  const aiPrompt = `다음은 매장 월간 휴무표 엑셀/CSV 데이터입니다. 양식이 비정형이어도 표의 맥락을 파악하여 직원별 월간 스케줄 JSON으로 정확히 변환하세요.

[변환 규칙]
1. 파일명("${fileName}") 및 데이터 상단에서 연도(year, 기본 ${defaultYear})와 월(month, 1~12 정수)을 추출하세요.
2. 실제 직원(2~4글자 성명)과 담당/직책(role, 없으면 "매장")을 모두 추출하세요. ('총 근무인원', '결원', '합계' 등 요약 행은 제외)
3. 각 직원의 1일~31일 중 휴무/연차/휴가/반차/교육/회의/HP 일자를 찾아 schedule 배열에 { day: 1~31 정수, status: 기호 }로 반환하세요.
   - 정기휴무('O', '○', '0', '휴무', '휴', 'OFF') -> 'O'
   - 연차('연차', '연') -> '연차'
   - 휴가('V', '휴가', '리프', '하계', '동계') -> 'V'
   - 반차('반차', '반', '오전반차', '오후반차') -> '반차'
   - 교육('교육', '교', '출장') -> '교육'
   - 회의('회의', '회') -> '회의'
   - HP -> 'HP'
   - 정상 출근일은 생략하거나 status를 ''로 설정하세요.

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

  const [aiY, aiM] = detectedYearMonth.split('-').map(Number);
  const maxDaysAi = aiY && aiM ? new Date(aiY, aiM, 0).getDate() : 31;

  const aiEmployeesRaw: {
    name: string;
    role: string;
    days: Record<string, DayScheduleCode>;
  }[] = (parsedAi.employees || [])
    .filter((emp: any) => isValidKoreanStaffName(String(emp?.name || '')))
    .map((emp: any) => {
      const days: Record<string, DayScheduleCode> = {};
      if (Array.isArray(emp.schedule)) {
        for (const item of emp.schedule) {
          const dNum = Number(item?.day);
          if (dNum >= 1 && dNum <= maxDaysAi) {
            const code = normalizeScheduleCode(String(item?.status || ''));
            if (code) {
              days[String(dNum)] = code;
            }
          }
        }
      }
      return {
        name: String(emp.name || '').trim(),
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
  if (
    r.includes('점장') ||
    r.includes('SCM') ||
    r.includes('미화') ||
    r.includes('지원') ||
    r.includes('시설')
  ) {
    return '점장·부점장·SCM';
  }
  if (r.includes('대형')) return '대형';
  if (
    r.includes('생주') ||
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

const CORNER_GROUP_ORDER = [
  '점장·부점장·SCM',
  '대형',
  '생활·주방·쿠쿠·KBB',
  '애플·모바일·통신',
] as const;

// 2025~2028 대한민국 법정·대체공휴일 매핑 (상단 헤더 및 하단 세로 전체 열 배경 강조용)
const HOLIDAY_NAMES_BY_MONTH: Record<string, Record<number, string>> = {
  '2025-01': { 1: '신정', 27: '임시공휴일', 28: '설연휴', 29: '설날', 30: '설연휴' },
  '2025-03': { 1: '삼일절', 3: '대체공휴일' },
  '2025-05': { 1: '노동절', 5: '어린이날', 6: '대체공휴일' },
  '2025-06': { 3: '대통령선거', 6: '현충일' },
  '2025-08': { 15: '광복절' },
  '2025-10': { 3: '개천절', 5: '추석연휴', 6: '추석', 7: '추석연휴', 8: '대체공휴일', 9: '한글날' },
  '2025-12': { 25: '성탄절' },
  '2026-01': { 1: '신정' },
  '2026-02': { 16: '설연휴', 17: '설날', 18: '설연휴' },
  '2026-03': { 1: '삼일절', 2: '대체공휴일' },
  '2026-05': { 1: '노동절', 5: '어린이날', 24: '부처님오신날', 25: '대체공휴일' },
  '2026-06': { 3: '지방선거', 6: '현충일' },
  '2026-07': { 17: '제헌절' },
  '2026-08': { 15: '광복절', 17: '대체공휴일' },
  '2026-09': { 24: '추석연휴', 25: '추석', 26: '추석연휴' },
  '2026-10': { 3: '개천절', 5: '대체공휴일', 9: '한글날' },
  '2026-12': { 25: '성탄절' },
  '2027-01': { 1: '신정' },
  '2027-02': { 6: '설연휴', 7: '설날', 8: '설연휴', 9: '대체공휴일' },
  '2027-03': { 1: '삼일절' },
  '2027-05': { 1: '노동절', 3: '대체공휴일', 5: '어린이날', 13: '부처님오신날' },
  '2027-06': { 6: '현충일' },
  '2027-07': { 17: '제헌절', 19: '대체공휴일' },
  '2027-08': { 15: '광복절', 16: '대체공휴일' },
  '2027-09': { 14: '추석연휴', 15: '추석', 16: '추석연휴' },
  '2027-10': { 3: '개천절', 4: '대체공휴일', 9: '한글날', 11: '대체공휴일' },
  '2027-12': { 25: '성탄절', 27: '대체공휴일' },
  '2028-01': { 1: '신정', 26: '설연휴', 27: '설날', 28: '설연휴' },
  '2028-03': { 1: '삼일절' },
  '2028-05': { 1: '노동절', 2: '부처님오신날', 5: '어린이날' },
  '2028-06': { 6: '현충일' },
  '2028-07': { 17: '제헌절' },
  '2028-08': { 15: '광복절' },
  '2028-10': { 2: '추석연휴', 3: '추석·개천절', 4: '추석연휴', 5: '대체공휴일', 9: '한글날' },
  '2028-12': { 25: '성탄절' },
};

type DaySpecialKind = 'holiday' | 'sunday' | 'saturday' | 'weekday';

function getDaySpecialKind(
  yearMonth: string,
  day: number,
  dow: number
): DaySpecialKind {
  if (HOLIDAY_NAMES_BY_MONTH[yearMonth]?.[day]) return 'holiday';
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

function getShortHolidayBadge(holidayName?: string): string {
  if (!holidayName) return '';
  if (holidayName.includes('대체')) return '대체';
  if (holidayName.includes('임시')) return '임시';
  if (holidayName.includes('부처님')) return '석탄';
  if (holidayName.includes('어린이')) return '어린';
  if (holidayName.includes('선거')) return '선거';
  return holidayName.slice(0, 2);
}

function getMatrixStickyHeaderBg(kind: DaySpecialKind, isDark: boolean): string {
  if (kind === 'holiday') {
    return isDark ? 'bg-[#3D1524]' : 'bg-[#4A1423]';
  }
  if (kind === 'sunday') {
    return isDark ? 'bg-[#311320]' : 'bg-[#38121D]';
  }
  if (kind === 'saturday') {
    return isDark ? 'bg-[#12263F]' : 'bg-[#112A45]';
  }
  return isDark ? 'bg-[#161D2B]' : 'bg-[#18181B]';
}

function getMatrixBodyCellBg(
  kind: DaySpecialKind,
  isDark: boolean,
  isMe = false
): string {
  if (kind === 'holiday') {
    if (isDark) {
      return isMe
        ? 'bg-rose-500/25 hover:bg-rose-500/32'
        : 'bg-rose-500/[0.18] hover:bg-rose-500/[0.26]';
    }
    return isMe
      ? 'bg-rose-200/75 hover:bg-rose-200/95'
      : 'bg-rose-100/90 hover:bg-rose-200/75';
  }
  if (kind === 'sunday') {
    if (isDark) {
      return isMe
        ? 'bg-rose-500/20 hover:bg-rose-500/28'
        : 'bg-rose-500/[0.12] hover:bg-rose-500/[0.20]';
    }
    return isMe
      ? 'bg-rose-100/70 hover:bg-rose-200/70'
      : 'bg-rose-50/95 hover:bg-rose-100/80';
  }
  if (kind === 'saturday') {
    if (isDark) {
      return isMe
        ? 'bg-sky-500/20 hover:bg-sky-500/28'
        : 'bg-sky-500/[0.12] hover:bg-sky-500/[0.20]';
    }
    return isMe
      ? 'bg-sky-100/70 hover:bg-sky-200/70'
      : 'bg-sky-50/95 hover:bg-sky-100/80';
  }
  return '';
}

function getCornerDividerCellBg(kind: DaySpecialKind, isDark: boolean): string {
  if (kind === 'holiday') {
    return isDark ? 'bg-rose-500/22' : 'bg-rose-200/70';
  }
  if (kind === 'sunday') {
    return isDark ? 'bg-rose-500/15' : 'bg-rose-200/50';
  }
  if (kind === 'saturday') {
    return isDark ? 'bg-sky-500/15' : 'bg-sky-200/50';
  }
  return '';
}

// 한글 초성 검색 지원 유틸 (예: 'ㄱㅅㅇ' -> '강석원', 'ㄷㅎ' -> '대형')
const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function extractChoseong(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 0xac00;
    if (code >= 0 && code < 11172) {
      out += CHOSEONG_LIST[Math.floor(code / 588)];
    } else {
      out += str[i];
    }
  }
  return out;
}

function matchesKoreanQuery(target: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const cleanTarget = target.toLowerCase();
  if (cleanTarget.includes(q)) return true;
  const choseongTarget = extractChoseong(cleanTarget);
  return choseongTarget.includes(q);
}

function formatUpdatedAtNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

export interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

type ScheduleViewMode = 'today' | 'calendar' | 'week' | 'full';

const DAY_CODE_OPTIONS: {
  value: DayScheduleCode;
  shortLabel: string;
  label: string;
  desc: string;
  chipCls: string;
  activeRing: string;
}[] = [
  {
    value: '',
    shortLabel: '출근',
    label: '정상 출근',
    desc: '빈칸 (매장 정상 근무)',
    chipCls: 'bg-emerald-500 text-slate-950 border-emerald-600',
    activeRing: 'ring-emerald-500',
  },
  {
    value: 'O',
    shortLabel: 'O',
    label: 'O (정기휴무)',
    desc: '주간·월간 정기 휴무일',
    chipCls: 'bg-rose-500 text-white border-rose-600',
    activeRing: 'ring-rose-500',
  },
  {
    value: '연차',
    shortLabel: '연차',
    label: '연차 휴무',
    desc: '개인 연차 사용일',
    chipCls: 'bg-amber-400 text-slate-950 border-amber-500',
    activeRing: 'ring-amber-500',
  },
  {
    value: 'V',
    shortLabel: 'V',
    label: 'V (휴가)',
    desc: '리프레시·하계·동계 휴가',
    chipCls: 'bg-purple-600 text-white border-purple-700',
    activeRing: 'ring-purple-500',
  },
  {
    value: '반차',
    shortLabel: '반차',
    label: '반차',
    desc: '오전/오후 반일 연차',
    chipCls: 'bg-yellow-200 text-yellow-950 border-yellow-400',
    activeRing: 'ring-yellow-500',
  },
  {
    value: '교육',
    shortLabel: '교육',
    label: '교육·출장',
    desc: '본사/외부 교육 및 출장',
    chipCls: 'bg-sky-500 text-white border-sky-600',
    activeRing: 'ring-sky-500',
  },
  {
    value: '회의',
    shortLabel: '회의',
    label: '회의',
    desc: '지점/영업부 외부 회의',
    chipCls: 'bg-indigo-500 text-white border-indigo-600',
    activeRing: 'ring-indigo-500',
  },
  {
    value: 'HP',
    shortLabel: 'HP',
    label: 'HP 근무',
    desc: 'HP 지정 근무일',
    chipCls: 'bg-teal-100 text-teal-900 border-teal-300',
    activeRing: 'ring-teal-500',
  },
  {
    value: '출휴',
    shortLabel: '출휴',
    label: '출산휴가',
    desc: '출산전후·배우자 출산휴가',
    chipCls: 'bg-pink-500 text-white border-pink-600',
    activeRing: 'ring-pink-500',
  },
  {
    value: '사가',
    shortLabel: '사가',
    label: '사규·경조휴가',
    desc: '사규/경조 특별휴가',
    chipCls: 'bg-violet-500 text-white border-violet-600',
    activeRing: 'ring-violet-500',
  },
];

interface UndoSnapshot {
  label: string;
  schedules: SchedulesMap;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  isDark: isDarkProp,
  onToggleTheme,
}) => {
  // DOM 테마 자동 감지 폴백
  const [domDark, setDomDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'dark'
      : false
  );

  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const sync = () => {
      setDomDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const isDark = isDarkProp ?? domDark;

  const handleInternalToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }
    if (typeof document !== 'undefined') {
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('himart_ui_theme', next);
      } catch {
        // ignore
      }
      setDomDark(next === 'dark');
    }
  };

  const [schedules, setSchedules] = useState<SchedulesMap>(() => loadAllSchedules());
  const [savedName, setSavedName] = useState<string>(() => loadSavedUserName());
  const [nameInput, setNameInput] = useState<string>(() => loadSavedUserName());
  const [isEditingName, setIsEditingName] = useState<boolean>(() => !loadSavedUserName());

  // 4대 뷰 모드: 'today' | 'calendar' | 'week' | 'full'
  const [activeView, setActiveView] = useState<ScheduleViewMode>('today');

  // 현재 선택된 기준 날짜
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // 내 월간 달력 뷰에서 조회 중인 대상 직원 (기본: 내 이름 또는 첫 번째 직원)
  const [calendarTargetName, setCalendarTargetName] = useState<string>('');

  // 전체/주간 표 검색 & 코너 필터 & 접힌 그룹
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCornerFilter, setSelectedCornerFilter] = useState<string>('ALL');
  const [collapsedCorners, setCollapsedCorners] = useState<Record<string, boolean>>({});
  const [showHeatmapRow, setShowHeatmapRow] = useState<boolean>(true);

  // 빠른 페인트(도장) 연속 입력 모드
  const [isPaintMode, setIsPaintMode] = useState<boolean>(false);
  const [paintCode, setPaintCode] = useState<DayScheduleCode>('O');

  // 동료 비교 & 맞교대(스왑) 시뮬레이터 상태
  const [isSwapPanelOpen, setIsSwapPanelOpen] = useState<boolean>(false);
  const [compareNames, setCompareNames] = useState<string[]>([]);
  const [swapDayA, setSwapDayA] = useState<number | null>(null);
  const [swapDayB, setSwapDayB] = useState<number | null>(null);

  // 내보내기 드롭다운 & 월 빠른 선택 드롭다운 & 직원 추가 모달
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<string>('대형');

  // Undo 스택 (최대 20단계) & Sonner 스타일 하단 토스트
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  // 파일 업로드 & 알림 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportCaptureRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    canUndo?: boolean;
  } | null>(null);

  // 셀 클릭 시 반응형 바텀시트(모바일) / 컨텍스트 모달(PC)
  const [editingCell, setEditingCell] = useState<{
    empName: string;
    empRole: string;
    day: number;
    currentCode: DayScheduleCode;
  } | null>(null);
  const [isEditingRoleInSheet, setIsEditingRoleInSheet] = useState<boolean>(false);
  const [roleDraftInSheet, setRoleDraftInSheet] = useState<string>('');

  // 휴무표 삭제/관리 모달
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth() + 1;
  const currentDay = selectedDate.getDate();
  const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  useEffect(() => {
    if (!isOpen) return;
    const loadedName = loadSavedUserName();
    setSavedName(loadedName);
    setNameInput(loadedName);
    setIsEditingName(!loadedName);
    if (loadedName) {
      setCalendarTargetName(loadedName);
    }
    setSchedules(loadAllSchedules());

    fetchRemoteSchedules().then((merged) => {
      if (merged) {
        setSchedules(merged);
      }
    });
  }, [isOpen]);

  // 토스트 자동 닫힘 타이머 (에러 제외 4.5초)
  useEffect(() => {
    if (!notice || notice.type === 'error') return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const monthData = useMemo(
    () => getOrCreateMonthSchedule(schedules, currentYearMonth),
    [schedules, currentYearMonth]
  );

  // calendarTargetName 자동 보정
  useEffect(() => {
    if (savedName && monthData.employees.some((e) => e.name === savedName)) {
      if (!calendarTargetName) setCalendarTargetName(savedName);
      return;
    }
    if (
      monthData.employees.length > 0 &&
      (!calendarTargetName || !monthData.employees.some((e) => e.name === calendarTargetName))
    ) {
      setCalendarTargetName(monthData.employees[0].name);
    }
  }, [savedName, monthData.employees, calendarTargetName]);

  const daysInMonth = useMemo(
    () => new Date(currentYear, currentMonth, 0).getDate(),
    [currentYear, currentMonth]
  );

  const pushUndoAndCommit = (
    nextSchedules: SchedulesMap,
    toastText: string,
    undoLabel: string
  ) => {
    setUndoStack((prev) => [
      ...prev.slice(-19),
      { label: undoLabel, schedules },
    ]);
    setSchedules(nextSchedules);
    saveAllSchedules(nextSchedules);
    syncSchedulesToDevServer(nextSchedules);
    setNotice({
      type: 'success',
      text: toastText,
      canUndo: true,
    });

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(nextSchedules, gh);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setSchedules(last.schedules);
    saveAllSchedules(last.schedules);
    syncSchedulesToDevServer(last.schedules);
    setNotice({
      type: 'info',
      text: `↩ 실행 취소됨: ${last.label}`,
      canUndo: false,
    });

    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub(last.schedules, gh);
    }
  };

  const handleSaveUserName = (targetName?: string) => {
    const clean = (targetName ?? nameInput).trim();
    if (!clean) return;
    saveUserName(clean);
    setSavedName(clean);
    setNameInput(clean);
    setCalendarTargetName(clean);
    setIsEditingName(false);
    setNotice({
      type: 'success',
      text: `👤 내 이름이 [${clean}]님으로 설정되었습니다.`,
    });
  };

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
    setIsMonthPickerOpen(false);
  };

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
    setIsMonthPickerOpen(false);
  };

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

  // 셀 스케줄 코드 변경 저장 (Undo 지원)
  const handleUpdateCellCode = (
    empName: string,
    day: number,
    newCode: DayScheduleCode,
    keepSheetOpen = false
  ) => {
    const updatedAt = formatUpdatedAtNow();
    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    const prevEmp = baseMonth.employees.find((e) => e.name === empName);
    const prevCode = prevEmp?.days[String(day)] || '';
    if (prevCode === newCode) {
      if (!keepSheetOpen) setEditingCell(null);
      return;
    }

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
        isRegistered: true,
        employees: updatedEmployees,
      },
    };

    const codeText = newCode || '정상출근';
    pushUndoAndCommit(
      nextSchedules,
      `✏️ ${empName}님 ${currentMonth}/${day} → [${codeText}] 변경됨`,
      `${empName} ${currentMonth}/${day} 변경`
    );

    if (!keepSheetOpen) {
      setEditingCell(null);
    }
  };

  // 직원 담당(코너) 변경
  const handleUpdateEmployeeRole = (empName: string, nextRole: string) => {
    const cleanRole = nextRole.trim() || '매장';
    const updatedAt = formatUpdatedAtNow();
    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    const updatedEmployees = baseMonth.employees.map((emp) =>
      emp.name === empName ? { ...emp, role: cleanRole } : emp
    );

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

    pushUndoAndCommit(
      nextSchedules,
      `🏷️ ${empName}님의 담당이 [${cleanRole}](으)로 수정되었습니다.`,
      `${empName} 담당 변경`
    );
    setIsEditingRoleInSheet(false);
    setEditingCell((prev) => (prev ? { ...prev, empRole: cleanRole } : null));
  };

  // 신규 직원 행 추가
  const handleAddStaffMember = () => {
    const cleanName = newStaffName.trim();
    const cleanRole = newStaffRole.trim() || '대형';
    if (!cleanName) return;

    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    if (baseMonth.employees.some((e) => e.name === cleanName)) {
      setNotice({
        type: 'error',
        text: `이미 [${cleanName}] 직원이 명단에 존재합니다.`,
      });
      return;
    }

    const updatedAt = formatUpdatedAtNow();
    const nextSchedules: SchedulesMap = {
      ...schedules,
      [currentYearMonth]: {
        ...baseMonth,
        yearMonth: currentYearMonth,
        updatedAt,
        isRegistered: true,
        employees: [
          ...baseMonth.employees,
          { name: cleanName, role: cleanRole, days: {} },
        ],
      },
    };

    pushUndoAndCommit(
      nextSchedules,
      `➕ [${cleanName} (${cleanRole})] 직원이 ${currentMonth}월 명단에 추가되었습니다.`,
      `${cleanName} 직원 추가`
    );
    setNewStaffName('');
    setIsAddStaffOpen(false);
  };

  // 직원 행 삭제
  const handleDeleteEmployeeRow = (empName: string) => {
    const updatedAt = formatUpdatedAtNow();
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

    pushUndoAndCommit(
      nextSchedules,
      `🗑️ 휴무표에서 [${empName}] 직원 줄이 삭제되었습니다.`,
      `${empName} 직원 줄 삭제`
    );
    setEditingCell(null);
  };

  // 1:1 휴무 맞교대(스왑) 실행
  const handleExecuteMutualSwap = () => {
    if (compareNames.length < 2 || !swapDayA || !swapDayB) return;
    const [nameA, nameB] = compareNames;
    const baseMonth = getOrCreateMonthSchedule(schedules, currentYearMonth);
    const empA = baseMonth.employees.find((e) => e.name === nameA);
    const empB = baseMonth.employees.find((e) => e.name === nameB);
    if (!empA || !empB) return;

    const codeA_on_dayA = empA.days[String(swapDayA)] || '';
    const codeA_on_dayB = empA.days[String(swapDayB)] || '';
    const codeB_on_dayA = empB.days[String(swapDayA)] || '';
    const codeB_on_dayB = empB.days[String(swapDayB)] || '';

    const updatedEmployees = baseMonth.employees.map((emp) => {
      if (emp.name === nameA) {
        const nextDays = { ...emp.days };
        if (codeB_on_dayA) nextDays[String(swapDayA)] = codeB_on_dayA;
        else delete nextDays[String(swapDayA)];
        if (codeB_on_dayB) nextDays[String(swapDayB)] = codeB_on_dayB;
        else delete nextDays[String(swapDayB)];
        return { ...emp, days: nextDays };
      }
      if (emp.name === nameB) {
        const nextDays = { ...emp.days };
        if (codeA_on_dayA) nextDays[String(swapDayA)] = codeA_on_dayA;
        else delete nextDays[String(swapDayA)];
        if (codeA_on_dayB) nextDays[String(swapDayB)] = codeA_on_dayB;
        else delete nextDays[String(swapDayB)];
        return { ...emp, days: nextDays };
      }
      return emp;
    });

    const nextSchedules: SchedulesMap = {
      ...schedules,
      [currentYearMonth]: {
        ...baseMonth,
        yearMonth: currentYearMonth,
        updatedAt: formatUpdatedAtNow(),
        isRegistered: true,
        employees: updatedEmployees,
      },
    };

    pushUndoAndCommit(
      nextSchedules,
      `⇄ [${nameA}] ${swapDayA}일 ↔ [${nameB}] ${swapDayB}일 맞교대가 반영되었습니다!`,
      `${nameA}·${nameB} 휴무 맞교대`
    );
    setSwapDayA(null);
    setSwapDayB(null);
  };

  // 사진(JPG/PNG) 또는 엑셀(.xlsx) 업로드 처리 (기존 3중 파서 + Gemini OCR 100% 보존)
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
      const updatedAt = formatUpdatedAtNow();
      let targetYearMonth = currentYearMonth;
      let parsedEmployees: EmployeeMonthlySchedule[] = [];

      const detectedFromFileName = detectYearMonthFromText(
        file.name,
        currentYear
      );
      if (detectedFromFileName) {
        targetYearMonth = detectedFromFileName;
      }

      let excelPrevYearMonth: string | undefined;
      let excelPrevMonthPatch:
        | Record<string, Record<string, DayScheduleCode>>
        | undefined;

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
        excelPrevYearMonth = parsedResult.prevYearMonth;
        excelPrevMonthPatch = parsedResult.prevMonthPatch;
      } else {
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
- 상단 타이틀(예: '10월 휴무 계획표', '11월 휴무 계획표')에서 해당 연도(year, 기본 ${currentYear})와 월(month, 1~12 정수)을 정확히 추출하세요.

[2. 표의 열(Column) 구조 및 칸 밀림(Column Shift) 절대 방지 규칙]
- 좌측 고정열: [사용연차] | [NO] | [성명] | [담당]
- 중앙 날짜열: [1일]부터 [31일](또는 해당 월 말일)까지의 세로 열 (상단 날짜 숫자 1~31 및 요일 세로줄 기준).
- ⚠️ 주의 0: 표 왼쪽 앞부분에 첫 번째 '1'일보다 먼저 나오는 25~31일 열들은 전달 말일 열이므로 절대 이번 달 25~31일로 읽지 말고 건너뛰며, 반드시 첫 번째 '1'일 열부터 이번 달 말일 열까지만 읽으세요!
- ⚠️ 주의 1: 말일 오른쪽 옆에 있는 '1' 열은 다음 달 1일 열이므로 현재 월(1~31일) 날짜와 절대 혼동하거나 앞당겨 읽지 마세요!
- ⚠️ 주의 2: 셀 주변의 굵은 빨간색 테두리 박스와 표 중앙의 '1 페이지' 반투명 워터마크 글씨는 무시하고 그 아래 실제 셀 기호만 읽으세요!
- ⚠️ 주의 3: 상단 '총 근무인원' 행과 '결원(휴무,교육,지원 등)' 요약 행, 그리고 하단 '대형 / 생활' 합계 행은 직원 명단이 아니므로 반드시 제외하고, 실제 직원 행만 추출하세요!

[3. 경기광주점 기본 직원 명단 및 담당 (참고용 — 새 직원이 있으면 누락 없이 그대로 포함)]
1: 강석원(점장), 2: 김재훈(부점장), 3: 국지현(SCM), 4: 심우영(선임/대형), 5: 정충영(대형), 6: 한세희(대형), 7: 김태형(대형), 8: 한춘애(대형), 9: 손정민(생활), 10: 박기복(주방), 11: 임용주(생주), 12: 최문기(쿠쿠), 13: 윤현주(쿠쿠), 14: 한나라(생활), 15: 권지혜(KBB), 16: 서형래(애플), 17: 김지우(모바일), 18: 이세빈(모바일), 19: 김도인(SKT), 20: 정태일(LGU), 21: 주형남(KT), 22: 김흥영(미화)

[4. 기호 정규화 및 1~31일 전수 매핑 규칙]
- 동그라미('O', 'o', '○', '0', 'ㅇ', '휴무', 'OFF') -> 무조건 대문자 'O'로 통일
- 빈칸, 공백, '-', '근무', '정상', '출근' -> '' (정상 출근)
- '연차', 'V'(휴가), '반차', '교육', '회의', 'HP', '출휴', '사가' -> 원문 그대로 유지
- 각 직원을 읽을 때 빈칸을 건너뛰지 말고 먼저 cellTrace 필드에 "1:O, 2:, 3:, 4:, 5:, 6:O, ... 31:" 형태로 1일부터 31일까지 모든 칸을 순서대로 기록한 뒤, schedule 배열에도 1일부터 31일까지 day(1~31 정수)와 status('', 'O', '연차', 'V', '반차', '교육', '회의', 'HP', '출휴', '사가')를 정확히 출력하세요.`;

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
          throw lastError || new Error('휴무표 이미지 AI 분석에 실패했습니다.');
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
          const [imgY, imgM] = targetYearMonth.split('-').map(Number);
          const maxDaysImg =
            imgY && imgM ? new Date(imgY, imgM, 0).getDate() : 31;

          const rawExtracted = parsedAi.employees
            .filter((emp: any) => {
              const nm = String(emp?.name || '').trim();
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

              if (typeof emp.cellTrace === 'string' && emp.cellTrace.trim()) {
                const pairs = emp.cellTrace.split(',');
                for (const pair of pairs) {
                  const [dStr, valStr] = pair.split(':');
                  const dNum = parseInt(String(dStr || '').trim(), 10);
                  if (dNum >= 1 && dNum <= maxDaysImg) {
                    const code = normalizeScheduleCode(String(valStr || ''));
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    }
                  }
                }
              }

              if (Array.isArray(emp.schedule)) {
                for (const cell of emp.schedule) {
                  const dNum = Number(cell?.day);
                  if (dNum >= 1 && dNum <= maxDaysImg) {
                    const code = normalizeScheduleCode(
                      String(cell?.status || '')
                    );
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    }
                  }
                }
              }

              if (emp.days && typeof emp.days === 'object') {
                Object.entries(emp.days).forEach(([dKey, val]) => {
                  const dNum = parseInt(dKey, 10);
                  if (dNum >= 1 && dNum <= maxDaysImg) {
                    const code = normalizeScheduleCode(String(val || ''));
                    if (code) {
                      cleanDays[String(dNum)] = code;
                    }
                  }
                });
              }

              return {
                no: Number(emp.no) || idx + 1,
                name: String(emp.name || '').trim(),
                role: String(emp.role || '매장').trim(),
                days: cleanDays,
              };
            });

          parsedEmployees = reconcileOcrEmployees(rawExtracted);
        } else {
          throw new Error('이미지에서 직원별 휴무 데이터를 인식하지 못했습니다.');
        }
      }

      const nextSchedules: SchedulesMap = {
        ...schedules,
        [targetYearMonth]: {
          yearMonth: targetYearMonth,
          updatedAt,
          isRegistered: true,
          employees: parsedEmployees,
        },
      };

      if (
        excelPrevYearMonth &&
        excelPrevMonthPatch &&
        Object.keys(excelPrevMonthPatch).length > 0
      ) {
        if (
          nextSchedules[excelPrevYearMonth]?.employees &&
          nextSchedules[excelPrevYearMonth].employees.length > 0
        ) {
          const prevMonthData = nextSchedules[excelPrevYearMonth];
          nextSchedules[excelPrevYearMonth] = {
            ...prevMonthData,
            updatedAt,
            isRegistered: true,
            employees: prevMonthData.employees.map((emp) => {
              const patchForEmp = excelPrevMonthPatch?.[emp.name];
              if (!patchForEmp) return emp;
              const nextDays = { ...emp.days };
              for (const [dKey, codeVal] of Object.entries(patchForEmp)) {
                if (codeVal) {
                  nextDays[dKey] = codeVal;
                } else {
                  delete nextDays[dKey];
                }
              }
              return {
                ...emp,
                days: nextDays,
              };
            }),
          };
        } else {
          nextSchedules[excelPrevYearMonth] = {
            yearMonth: excelPrevYearMonth,
            updatedAt,
            isRegistered: true,
            employees: parsedEmployees.map((emp) => {
              const patchForEmp = excelPrevMonthPatch?.[emp.name] || {};
              const cleanPrevDays: Record<string, DayScheduleCode> = {};
              for (const [dKey, codeVal] of Object.entries(patchForEmp)) {
                if (codeVal) {
                  cleanPrevDays[dKey] = codeVal;
                }
              }
              return {
                name: emp.name,
                role: emp.role,
                days: cleanPrevDays,
              };
            }),
          };
        }
      }

      setUndoStack((prev) => [
        ...prev.slice(-19),
        { label: `${targetYearMonth} 업로드 이전`, schedules },
      ]);
      setSchedules(nextSchedules);
      saveAllSchedules(nextSchedules);
      syncSchedulesToDevServer(nextSchedules);

      const [yStr, mStr] = targetYearMonth.split('-');
      setSelectedDate(new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1));

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
        canUndo: true,
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

  // 모바일 하드웨어 뒤로가기 보호 핸들러
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__modalInternalBackHandler = (): boolean => {
      if (isDeleteModalOpen) {
        setIsDeleteModalOpen(false);
        return true;
      }
      if (isAddStaffOpen) {
        setIsAddStaffOpen(false);
        return true;
      }
      if (isExportMenuOpen) {
        setIsExportMenuOpen(false);
        return true;
      }
      if (isMonthPickerOpen) {
        setIsMonthPickerOpen(false);
        return true;
      }
      if (editingCell !== null) {
        setEditingCell(null);
        setIsEditingRoleInSheet(false);
        return true;
      }
      if (isSwapPanelOpen) {
        setIsSwapPanelOpen(false);
        return true;
      }
      if (isPaintMode) {
        setIsPaintMode(false);
        return true;
      }
      if (isEditingName && Boolean(savedName)) {
        setIsEditingName(false);
        return true;
      }
      if (activeView !== 'today') {
        setActiveView('today');
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__modalInternalBackHandler;
    };
  }, [
    isOpen,
    isDeleteModalOpen,
    isAddStaffOpen,
    isExportMenuOpen,
    isMonthPickerOpen,
    editingCell,
    isSwapPanelOpen,
    isPaintMode,
    isEditingName,
    savedName,
    activeView,
  ]);

  const handleDeleteMonth = (ym: string) => {
    if (!schedules[ym]) return;
    const next = { ...schedules };
    delete next[ym];
    pushUndoAndCommit(
      next,
      `🗑️ [${ym}] 휴무표 데이터가 삭제되었습니다.`,
      `${ym} 월간 데이터 삭제`
    );
  };

  const handleDeleteAllSchedules = () => {
    setUndoStack((prev) => [
      ...prev.slice(-19),
      { label: '전체 휴무표 초기화', schedules },
    ]);
    try {
      localStorage.removeItem(SCHEDULES_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSchedules({});
    saveAllSchedules({});
    syncSchedulesToDevServer({});
    setIsDeleteModalOpen(false);
    const gh = loadGitHubSyncConfig();
    if (gh.repo && gh.token) {
      publishSchedulesToGitHub({}, gh);
    }
    setNotice({
      type: 'success',
      text: '🗑️ 저장된 모든 월의 휴무표 데이터가 초기화되었습니다.',
      canUndo: true,
    });
  };

  const savedYearMonths = useMemo(() => {
    return Object.keys(schedules)
      .filter(
        (ym) => schedules[ym]?.employees && schedules[ym]?.employees.length > 0
      )
      .sort();
  }, [schedules]);

  const isCurrentMonthRegistered = Boolean(
    schedules[currentYearMonth] &&
      schedules[currentYearMonth]?.isRegistered !== false
  );

  // 일자별 전체 통계 및 코너 공백(0명 근무 코너) 전수 계산
  const dailySummaryMap = useMemo(() => {
    const map: Record<
      number,
      {
        workingCount: number;
        restingCount: number;
        vacantCorners: string[];
        cornerCounts: Record<string, number>;
      }
    > = {};

    const presentCorners = new Set<string>();
    monthData.employees.forEach((emp) => {
      presentCorners.add(classifyRoleGroup(emp.role));
    });

    for (let d = 1; d <= daysInMonth; d++) {
      const cornerCounts: Record<string, number> = {
        '점장·부점장·SCM': 0,
        대형: 0,
        '생활·주방·쿠쿠·KBB': 0,
        '애플·모바일·통신': 0,
      };
      let workingCount = 0;
      let restingCount = 0;

      monthData.employees.forEach((emp) => {
        const code = emp.days[String(d)] || '';
        const isAway =
          code === 'O' ||
          code === '연차' ||
          code === 'V' ||
          code === '출휴' ||
          code === '사가' ||
          code === '교육' ||
          code === '회의';
        if (isAway) {
          restingCount++;
        } else {
          workingCount++;
          const g = classifyRoleGroup(emp.role);
          cornerCounts[g] = (cornerCounts[g] || 0) + 1;
        }
      });

      const vacantCorners: string[] = [];
      if (isCurrentMonthRegistered && monthData.employees.length > 0) {
        CORNER_GROUP_ORDER.forEach((g) => {
          if (presentCorners.has(g) && (cornerCounts[g] || 0) === 0) {
            vacantCorners.push(g);
          }
        });
      }

      map[d] = {
        workingCount,
        restingCount,
        vacantCorners,
        cornerCounts,
      };
    }

    return map;
  }, [monthData.employees, daysInMonth, isCurrentMonthRegistered]);

  // 직원별 월간 통계 계산 (정기휴무 O, 연차/V, 반차, 출근일)
  const employeeStatsMap = useMemo(() => {
    const stats: Record<
      string,
      { offO: number; annualV: number; half: number; eduMeet: number; workDays: number }
    > = {};

    monthData.employees.forEach((emp) => {
      let offO = 0;
      let annualV = 0;
      let half = 0;
      let eduMeet = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const c = emp.days[String(d)] || '';
        if (c === 'O') offO++;
        else if (c === '연차' || c === 'V' || c === '출휴' || c === '사가') annualV++;
        else if (c === '반차') half++;
        else if (c === '교육' || c === '회의') eduMeet++;
      }
      const workDays = Math.max(0, daysInMonth - offO - annualV - eduMeet);
      stats[emp.name] = { offO, annualV, half, eduMeet, workDays };
    });

    return stats;
  }, [monthData.employees, daysInMonth]);

  // 내 직원 정보 & 남은 휴무일 & 다음 휴무 D-Day
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

  // 선택된 날짜 기준 주간(월~일 7일) 날짜 배열 계산
  const currentWeekDates = useMemo(() => {
    const base = new Date(currentYear, currentMonth - 1, currentDay);
    const dow = base.getDay(); // 0(일) ~ 6(토)
    // 월요일 시작으로 정렬 (일요일이면 -6, 그 외 1 - dow)
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon);

    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mSched = getOrCreateMonthSchedule(schedules, ym);
      const isReg = Boolean(schedules[ym] && schedules[ym]?.isRegistered !== false);
      const dayNum = d.getDate();

      let working = 0;
      let vacant = false;
      const presentGroups = new Set<string>();
      const gCounts: Record<string, number> = {};

      mSched.employees.forEach((emp) => {
        const g = classifyRoleGroup(emp.role);
        presentGroups.add(g);
        const c = emp.days[String(dayNum)] || '';
        const away =
          c === 'O' ||
          c === '연차' ||
          c === 'V' ||
          c === '출휴' ||
          c === '사가' ||
          c === '교육' ||
          c === '회의';
        if (!away) {
          working++;
          gCounts[g] = (gCounts[g] || 0) + 1;
        }
      });

      if (isReg && mSched.employees.length > 0) {
        presentGroups.forEach((g) => {
          if ((gCounts[g] || 0) === 0) vacant = true;
        });
      }

      const myEmpInDate = savedName
        ? mSched.employees.find((e) => e.name === savedName)
        : null;
      const myCodeInDate = myEmpInDate?.days[String(dayNum)] || '';

      return {
        date: d,
        yearMonth: ym,
        day: dayNum,
        dow: d.getDay(),
        isSameMonth: d.getMonth() + 1 === currentMonth,
        isRegistered: isReg,
        workingCount: working,
        hasVacancy: vacant,
        myCode: myCodeInDate,
      };
    });
  }, [currentYear, currentMonth, currentDay, schedules, savedName]);

  // 오늘 근무자 vs 휴무자 분류
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
        code === '사가' ||
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

  // 검색어 + 코너 필터 + 비교선택 반영된 직원 목록 (코너별 그룹 유지 & 내 이름 상단 강조)
  const filteredEmployeesByCorner = useMemo(() => {
    const filtered = monthData.employees.filter((emp) => {
      if (selectedCornerFilter === 'COMPARE') {
        return compareNames.includes(emp.name);
      }
      if (
        selectedCornerFilter !== 'ALL' &&
        classifyRoleGroup(emp.role) !== selectedCornerFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        return (
          matchesKoreanQuery(emp.name, searchQuery) ||
          matchesKoreanQuery(emp.role, searchQuery)
        );
      }
      return true;
    });

    const grouped: {
      corner: string;
      employees: EmployeeMonthlySchedule[];
    }[] = CORNER_GROUP_ORDER.map((corner) => ({
      corner,
      employees: filtered
        .filter((e) => classifyRoleGroup(e.role) === corner)
        .sort((a, b) => {
          if (a.name === savedName) return -1;
          if (b.name === savedName) return 1;
          return 0;
        }),
    })).filter((g) => g.employees.length > 0);

    return grouped;
  }, [monthData.employees, selectedCornerFilter, searchQuery, compareNames, savedName]);

  // 내 월간 달력 뷰용 데이터 (선택된 직원 1명의 7열 달력 셀 & 연속 휴무 계산)
  const personalCalendarData = useMemo(() => {
    const targetEmp =
      monthData.employees.find((e) => e.name === calendarTargetName) ||
      myEmployee ||
      monthData.employees[0] ||
      null;

    const firstDow = new Date(currentYear, currentMonth - 1, 1).getDay();
    const cells: (null | {
      day: number;
      dow: number;
      code: DayScheduleCode;
      holidayName?: string;
      isStreakStart?: boolean;
      isStreakEnd?: boolean;
      inStreak?: boolean;
    })[] = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push(null);
    }

    // 연속 휴무(2일 이상 O/연차/V) 구간 탐색
    const streaks: { start: number; end: number; length: number }[] = [];
    if (targetEmp) {
      let s = -1;
      for (let d = 1; d <= daysInMonth + 1; d++) {
        const off = d <= daysInMonth && isOffDayCode(targetEmp.days[String(d)]);
        if (off && s === -1) {
          s = d;
        } else if (!off && s !== -1) {
          const len = d - s;
          if (len >= 2) {
            streaks.push({ start: s, end: d - 1, length: len });
          }
          s = -1;
        }
      }
    }

    const monthHolidays = HOLIDAY_NAMES_BY_MONTH[currentYearMonth] || {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(currentYear, currentMonth - 1, d).getDay();
      const code = targetEmp?.days[String(d)] || '';
      const matchedStreak = streaks.find((st) => d >= st.start && d <= st.end);
      cells.push({
        day: d,
        dow,
        code,
        holidayName: monthHolidays[d],
        inStreak: Boolean(matchedStreak),
        isStreakStart: matchedStreak?.start === d,
        isStreakEnd: matchedStreak?.end === d,
      });
    }

    return {
      targetEmp,
      cells,
      streaks,
      stats: targetEmp ? employeeStatsMap[targetEmp.name] : null,
    };
  }, [
    monthData.employees,
    calendarTargetName,
    myEmployee,
    currentYear,
    currentMonth,
    currentYearMonth,
    daysInMonth,
    employeeStatsMap,
  ]);

  // 동료 2명 휴무 겹침 & 맞교대 가능일 분석
  const swapComparisonAnalysis = useMemo(() => {
    if (compareNames.length < 2) return null;
    const [nameA, nameB] = compareNames;
    const empA = monthData.employees.find((e) => e.name === nameA);
    const empB = monthData.employees.find((e) => e.name === nameB);
    if (!empA || !empB) return null;

    const overlapOffDays: number[] = [];
    const onlyAOffDays: number[] = [];
    const onlyBOffDays: number[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const offA = isOffDayCode(empA.days[String(d)]);
      const offB = isOffDayCode(empB.days[String(d)]);
      if (offA && offB) overlapOffDays.push(d);
      else if (offA && !offB) onlyAOffDays.push(d);
      else if (!offA && offB) onlyBOffDays.push(d);
    }

    return {
      empA,
      empB,
      overlapOffDays,
      onlyAOffDays,
      onlyBOffDays,
    };
  }, [compareNames, monthData.employees, daysInMonth]);

  const toggleCompareEmployee = (name: string) => {
    setCompareNames((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name);
      }
      if (prev.length >= 2) {
        return [prev[1], name];
      }
      return [...prev, name];
    });
    setSwapDayA(null);
    setSwapDayB(null);
  };

  // [내보내기 1] 카카오톡 오픈 단톡방 브리핑 텍스트 원터치 복사
  const handleCopyKakaoBriefing = async () => {
    const weekday = WEEKDAY_KO[selectedDate.getDay()];
    const totalWork = monthData.employees.length - restingList.length;
    const lines: string[] = [
      `📅 [롯데하이마트 경기광주점] ${currentMonth}월 ${currentDay}일(${weekday}) 근무 브리핑`,
      `━━━━━━━━━━━━━━`,
      `🟢 근무 인원: 총 ${totalWork}명`,
    ];

    CORNER_GROUP_ORDER.forEach((corner) => {
      const list = workingByGroup[corner] || [];
      const names =
        list.length > 0
          ? list
              .map((e) =>
                e.code ? `${e.name}(${e.code})` : e.name
              )
              .join(', ')
          : '⚠️ 전원 휴무(공백)';
      lines.push(`• ${corner}: ${names}`);
    });

    lines.push(`━━━━━━━━━━━━━━`);
    if (restingList.length === 0) {
      lines.push(`🔴 휴무·연차·교육: 없음 (전원 근무)`);
    } else {
      const restText = restingList
        .map((e) => `${e.name}(${e.code})`)
        .join(', ');
      lines.push(`🔴 휴무·연차·교육(${restingList.length}명): ${restText}`);
    }

    const vacancy = dailySummaryMap[currentDay]?.vacantCorners || [];
    if (vacancy.length > 0) {
      lines.push(`⚠️ 코너 공백 주의: ${vacancy.join(', ')}`);
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setIsExportMenuOpen(false);
      setNotice({
        type: 'success',
        text: `💬 ${currentMonth}/${currentDay}(${weekday}) 단톡방 근무 브리핑이 클립보드에 복사되었습니다!`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: '클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.',
      });
    }
  };

  // [내보내기 2] 현재 월 휴무표 엑셀(.xlsx) 다운로드
  const handleExportExcel = () => {
    const headerRow = [
      'NO',
      '성명',
      '담당',
      '정기휴무(O)',
      '연차·휴가',
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const dow = WEEKDAY_KO[new Date(currentYear, currentMonth - 1, d).getDay()];
        return `${d}(${dow})`;
      }),
    ];

    const bodyRows = monthData.employees.map((emp, idx) => {
      const st = employeeStatsMap[emp.name] || { offO: 0, annualV: 0 };
      return [
        idx + 1,
        emp.name,
        emp.role,
        st.offO,
        st.annualV,
        ...Array.from(
          { length: daysInMonth },
          (_, i) => emp.days[String(i + 1)] || ''
        ),
      ];
    });

    const summaryWorkRow = [
      '',
      '총 근무인원',
      '합계',
      '',
      '',
      ...Array.from(
        { length: daysInMonth },
        (_, i) => dailySummaryMap[i + 1]?.workingCount ?? 0
      ),
    ];

    const summaryRestRow = [
      '',
      '결원(휴무·연차·교육)',
      '합계',
      '',
      '',
      ...Array.from(
        { length: daysInMonth },
        (_, i) => dailySummaryMap[i + 1]?.restingCount ?? 0
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      [`롯데하이마트 경기광주점 ${currentYear}년 ${currentMonth}월 근무·휴무 계획표`],
      [],
      headerRow,
      ...bodyRows,
      [],
      summaryWorkRow,
      summaryRestRow,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${currentMonth}월_휴무표`);
    XLSX.writeFile(
      wb,
      `롯데하이마트_경기광주점_${currentYearMonth}_휴무표.xlsx`
    );
    setIsExportMenuOpen(false);
    setNotice({
      type: 'success',
      text: `📊 [${currentYearMonth}] 휴무표 엑셀(.xlsx) 파일이 다운로드되었습니다.`,
    });
  };

  // [내보내기 3] 현재 화면 고화질 이미지(.png) 다운로드
  const handleExportPng = async () => {
    if (!exportCaptureRef.current) return;
    setIsExportingImage(true);
    setIsExportMenuOpen(false);
    try {
      const dataUrl = await toPng(exportCaptureRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: isDark ? '#0B0E14' : '#F4F2ED',
      });
      const link = document.createElement('a');
      link.download = `경기광주점_휴무표_${currentYearMonth}_${activeView}.png`;
      link.href = dataUrl;
      link.click();
      setNotice({
        type: 'success',
        text: `🖼️ 현재 휴무표 화면이 고화질 이미지(.png)로 저장되었습니다.`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: '이미지 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsExportingImage(false);
    }
  };

  // [내보내기 4] 개인 휴무일 스마트폰 기본 캘린더(.ics) 일괄 등록 파일 생성
  const handleDownloadIcs = (targetEmpName?: string) => {
    const targetName = targetEmpName || calendarTargetName || savedName;
    const emp = monthData.employees.find((e) => e.name === targetName);
    if (!emp) {
      setNotice({
        type: 'error',
        text: '캘린더로 내보낼 직원을 먼저 선택해 주세요.',
      });
      return;
    }

    const events: string[] = [];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    for (let d = 1; d <= daysInMonth; d++) {
      const code = emp.days[String(d)];
      if (!code) continue;
      const startDate = new Date(currentYear, currentMonth - 1, d);
      const endDate = new Date(currentYear, currentMonth - 1, d + 1);
      const fmt = (dt: Date) =>
        `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(
          dt.getDate()
        ).padStart(2, '0')}`;

      const titleMap: Record<string, string> = {
        O: `🏖️ 정기휴무 (${emp.name})`,
        연차: `🌴 연차휴무 (${emp.name})`,
        V: `✈️ 휴가 (${emp.name})`,
        반차: `🌤️ 반차 (${emp.name})`,
        교육: `📘 교육/출장 (${emp.name})`,
        회의: `📋 외부회의 (${emp.name})`,
        HP: `⚡ HP근무 (${emp.name})`,
        출휴: `👶 출산휴가 (${emp.name})`,
        사가: `🏡 사규/경조휴가 (${emp.name})`,
      };

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:himart-gj-${currentYearMonth}-${d}-${encodeURIComponent(emp.name)}@himart.local`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${fmt(startDate)}`,
          `DTEND;VALUE=DATE:${fmt(endDate)}`,
          `SUMMARY:${titleMap[code] || `[${code}] ${emp.name}`}`,
          `DESCRIPTION:롯데하이마트 경기광주점 ${currentYear}년 ${currentMonth}월 근태 일정 (${emp.name} / ${emp.role})`,
          'END:VEVENT',
        ].join('\r\n')
      );
    }

    if (events.length === 0) {
      setNotice({
        type: 'info',
        text: `${emp.name}님의 ${currentMonth}월 등록된 휴무/일정이 없습니다.`,
      });
      return;
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lotte Hi-Mart Gwangju//Schedule Pro//KO',
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.name}_${currentYearMonth}_휴무일정.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
    setNotice({
      type: 'success',
      text: `📱 [${emp.name}]님의 ${currentMonth}월 일정(${events.length}건) 캘린더(.ics) 파일이 저장되었습니다!`,
    });
  };

  if (!isOpen) return null;

  const selectedWeekday = WEEKDAY_KO[selectedDate.getDay()];
  const todayReal = new Date();
  const isSelectedToday =
    selectedDate.getFullYear() === todayReal.getFullYear() &&
    selectedDate.getMonth() === todayReal.getMonth() &&
    selectedDate.getDate() === todayReal.getDate();

  const todayVacancies = dailySummaryMap[currentDay]?.vacantCorners || [];

  // 기호 배지 렌더러 (고대비 + 컴팩트 대응)
  const renderCodeBadge = (
    code: DayScheduleCode,
    size: 'xs' | 'sm' | 'md' = 'sm',
    dayNumberForCell?: number
  ) => {
    if (!code) return null;
    const sizeCls =
      size === 'xs'
        ? 'px-1 py-0.5 rounded text-[10px] font-black leading-none inline-flex items-center justify-center'
        : size === 'sm'
        ? 'px-1.5 py-0.5 rounded-md text-[11px] font-black leading-tight inline-flex items-center justify-center'
        : 'px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center justify-center';

    let colorCls = '';
    switch (code) {
      case 'O':
        colorCls = 'bg-rose-500 text-white shadow-2xs';
        break;
      case '연차':
        colorCls = 'bg-amber-400 text-slate-950 shadow-2xs';
        break;
      case 'V':
        colorCls = 'bg-purple-600 text-white shadow-2xs';
        break;
      case '반차':
        colorCls = 'bg-yellow-200 text-yellow-950 border border-yellow-400';
        break;
      case '교육':
        colorCls = 'bg-sky-500 text-white';
        break;
      case '회의':
        colorCls = 'bg-indigo-500 text-white';
        break;
      case 'HP':
        colorCls = 'bg-teal-100 text-teal-950 border border-teal-300';
        break;
      case '출휴':
        colorCls = 'bg-pink-500 text-white shadow-2xs';
        break;
      case '사가':
        colorCls = 'bg-violet-500 text-white shadow-2xs';
        break;
      default:
        colorCls = 'bg-slate-200 text-slate-800';
    }

    const badgeEl = <span className={`${sizeCls} ${colorCls}`}>{code}</span>;

    if (dayNumberForCell !== undefined) {
      return (
        <div className="flex flex-col items-center justify-center leading-none gap-0.5">
          <span
            className={`text-[9px] font-extrabold leading-none font-mono ${
              isDark ? 'text-slate-400' : 'text-stone-500'
            }`}
          >
            {dayNumberForCell}
          </span>
          {badgeEl}
        </div>
      );
    }

    return badgeEl;
  };

  // 셀 클릭 시 공통 처리 (페인트 모드면 즉시 도장 찍기, 아니면 시트 오픈)
  const handleCellInteraction = (
    emp: EmployeeMonthlySchedule,
    dayNum: number
  ) => {
    if (isPaintMode) {
      const current = emp.days[String(dayNum)] || '';
      // 같은 코드가 이미 찍혀 있으면 지우개처럼 토글 해제 가능
      const nextToApply = current === paintCode ? '' : paintCode;
      handleUpdateCellCode(emp.name, dayNum, nextToApply, true);
      return;
    }

    window.history.pushState({ appGuard: true }, '');
    const currentCode = emp.days[String(dayNum)] || '';
    setIsEditingRoleInSheet(false);
    setRoleDraftInSheet(emp.role);
    setEditingCell({
      empName: emp.name,
      empRole: emp.role,
      day: dayNum,
      currentCode,
    });
  };

  // 편집 시트 내 같은 코너 동료 근무 현황 계산
  const editingCellPeerInfo = useMemo(() => {
    if (!editingCell) return null;
    const targetGroup = classifyRoleGroup(editingCell.empRole);
    const workingPeers = monthData.employees.filter((e) => {
      if (e.name === editingCell.empName) return false;
      if (classifyRoleGroup(e.role) !== targetGroup) return false;
      const c = e.days[String(editingCell.day)] || '';
      return !(
        c === 'O' ||
        c === '연차' ||
        c === 'V' ||
        c === '출휴' ||
        c === '사가' ||
        c === '교육' ||
        c === '회의'
      );
    });
    return {
      cornerGroup: targetGroup,
      workingPeers,
    };
  }, [editingCell, monthData.employees]);

  // 테마별 공통 서피스 클래스
  const shellBg = isDark
    ? 'bg-[#0B0E14] text-slate-100 border-white/10'
    : 'bg-[#F4F2ED] text-[#18181B] border-[#D6D0C4]';
  const headerBg = isDark
    ? 'bg-[#121722]/95 border-white/10 text-slate-100'
    : 'bg-[#FAF8F4]/95 border-[#E4DFD5] text-[#18181B]';
  const cardBg = isDark
    ? 'bg-[#151A25] border-white/10 text-slate-100'
    : 'bg-white border-[#E4DFD5] text-[#18181B]';
  const subtleBg = isDark
    ? 'bg-[#1B2230] border-white/10 text-slate-200'
    : 'bg-[#FAF8F4] border-[#E4DFD5] text-[#18181B]';
  const mutedText = isDark ? 'text-slate-400' : 'text-[#78716C]';

  const VIEW_TABS: {
    id: ScheduleViewMode;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'today',
      label: '일일 브리핑',
      shortLabel: '일일',
      icon: <Users className="w-3.5 h-3.5" />,
    },
    {
      id: 'calendar',
      label: '내 월간 달력',
      shortLabel: '내 달력',
      icon: <CalendarDays className="w-3.5 h-3.5" />,
    },
    {
      id: 'week',
      label: '주간(7일) 표',
      shortLabel: '주간표',
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      id: 'full',
      label: '전체 매트릭스',
      shortLabel: '전체표',
      icon: <Table2 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div
      className="schedule-pro-modal fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-3 no-print"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[1460px] h-[96dvh] sm:h-auto sm:max-h-[94dvh] rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col overflow-hidden schedule-modal-enter ${shellBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 숨김 파일 업로드 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* ==================== 1) 슬림 2단 커맨드 헤더 ==================== */}
        <div className={`px-3.5 sm:px-6 pt-3 pb-2.5 border-b shrink-0 ${headerBg}`}>
          {/* Row 1: 타이틀 + 월 선택기 + 내 이름 칩 + 액션 도구 모음 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 좌측: 브랜드 아이콘 + 타이틀 + 월 네비게이터 */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  isDark
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                    : 'bg-[#8C5A32] text-white'
                }`}
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 mr-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                    경기광주점 근무·휴무 스튜디오
                  </h2>
                  {isCurrentMonthRegistered && (
                    <span
                      className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isDark
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {monthData.employees.length}명 등록됨
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-medium hidden lg:block ${mutedText}`}>
                  주간 브리핑 · 개인 달력(.ics) · 빠른 페인트 편집 · 맞교대 시뮬레이터
                </p>
              </div>

              {/* 컴팩트 월 선택기 ([◀] 2026.11 ▼ [▶]) */}
              <div className="relative">
                <div
                  className={`inline-flex items-center rounded-xl border p-0.5 ${
                    isDark
                      ? 'bg-[#1B2230] border-white/10'
                      : 'bg-white border-[#D6D0C4] shadow-2xs'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleMoveMonth(-1)}
                    title="이전 달"
                    className={`p-1.5 rounded-lg cursor-pointer schedule-tactile ${
                      isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-[#F4F2ED] text-stone-700'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen((v) => !v)}
                    className="px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-black font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {currentYear}.{String(currentMonth).padStart(2, '0')}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-65" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveMonth(1)}
                    title="다음 달"
                    className={`p-1.5 rounded-lg cursor-pointer schedule-tactile ${
                      isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-[#F4F2ED] text-stone-700'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 저장된 달 빠른 선택 팝오버 */}
                {isMonthPickerOpen && (
                  <div
                    className={`absolute left-0 mt-1.5 w-60 rounded-2xl border p-3 shadow-xl z-50 ${cardBg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black">📂 저장된 휴무표 월 선택</span>
                      <button
                        type="button"
                        onClick={() => setIsMonthPickerOpen(false)}
                        className={`p-0.5 rounded cursor-pointer ${mutedText}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {savedYearMonths.length === 0 ? (
                      <p className={`text-xs py-2 ${mutedText}`}>
                        아직 업로드된 휴무표가 없습니다.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {savedYearMonths.map((ym) => {
                          const active = ym === currentYearMonth;
                          return (
                            <button
                              key={ym}
                              type="button"
                              onClick={() => handleSelectYearMonth(ym)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-black font-mono border flex items-center justify-between cursor-pointer schedule-tactile ${
                                active
                                  ? isDark
                                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                                    : 'bg-[#8C5A32] text-white border-[#8C5A32]'
                                  : isDark
                                  ? 'bg-[#1B2230] border-white/10 hover:bg-white/10'
                                  : 'bg-[#FAF8F4] border-[#E4DFD5] hover:bg-[#EAE5DC]'
                              }`}
                            >
                              <span>{ym.replace('-', '.')}</span>
                              {active && <Check className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleJumpToToday();
                        setIsMonthPickerOpen(false);
                      }}
                      className={`mt-2 w-full py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                        isDark
                          ? 'bg-white/5 hover:bg-white/10 border-white/10 text-sky-300'
                          : 'bg-[#F4ECE1] hover:bg-[#EAE0D0] border-[#D6C7B2] text-[#8C5A32]'
                      }`}
                    >
                      오늘 날짜로 즉시 이동
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 내 이름 칩 + 테마 토글 + 업로드 + 내보내기 + 삭제 + 닫기 */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {/* 내 이름 프로필 칩 */}
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({ appGuard: true }, '');
                  setIsEditingName((v) => !v);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                  savedName
                    ? isDark
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                      : 'bg-[#F4ECE1] text-[#6E4423] border-[#D8C3A8]'
                    : 'bg-amber-400 text-slate-950 border-amber-500'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{savedName ? `${savedName}님` : '내 이름 설정'}</span>
              </button>

              {/* Undo 되돌리기 버튼 (히스토리 있을 때 노출) */}
              {undoStack.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndo}
                  title={`되돌리기 (${undoStack[undoStack.length - 1].label})`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#242E42] text-sky-300 border-sky-400/30'
                      : 'bg-white hover:bg-[#F4F2ED] text-[#18181B] border-[#D6D0C4]'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">되돌리기</span>
                </button>
              )}

              {/* 사진/엑셀 업로드 */}
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-2xs cursor-pointer schedule-tactile disabled:opacity-60 ${
                  isDark
                    ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                    : 'bg-[#18181B] hover:bg-stone-800 text-white'
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? '분석 중...' : '업로드'}</span>
              </button>

              {/* 내보내기 / 공유 드롭다운 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                    isDark
                      ? 'bg-[#1B2230] hover:bg-[#242E42] text-slate-200 border-white/10'
                      : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#D6D0C4]'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">공유·내보내기</span>
                </button>

                {isExportMenuOpen && (
                  <div
                    className={`absolute right-0 mt-1.5 w-64 rounded-2xl border p-2 shadow-2xl z-50 space-y-1 ${cardBg}`}
                  >
                    <button
                      type="button"
                      onClick={handleCopyKakaoBriefing}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center gap-2.5 cursor-pointer ${
                        isDark ? 'hover:bg-white/10' : 'hover:bg-[#F4F2ED]'
                      }`}
                    >
                      <Copy className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div>카톡 일일 근무브리핑 복사</div>
                        <div className={`text-[10px] font-medium ${mutedText}`}>
                          {currentMonth}/{currentDay} 코너별 근무·휴무 명단
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadIcs()}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center gap-2.5 cursor-pointer ${
                        isDark ? 'hover:bg-white/10' : 'hover:bg-[#F4F2ED]'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <div>스마트폰 캘린더(.ics) 등록</div>
                        <div className={`text-[10px] font-medium ${mutedText}`}>
                          아이폰·갤럭시 기본 달력에 휴무 추가
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center gap-2.5 cursor-pointer ${
                        isDark ? 'hover:bg-white/10' : 'hover:bg-[#F4F2ED]'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-teal-500 shrink-0" />
                      <div>
                        <div>엑셀(.xlsx) 파일 다운로드</div>
                        <div className={`text-[10px] font-medium ${mutedText}`}>
                          연차합계·일자별 근무인원 포함
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingImage}
                      onClick={handleExportPng}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center gap-2.5 cursor-pointer disabled:opacity-50 ${
                        isDark ? 'hover:bg-white/10' : 'hover:bg-[#F4F2ED]'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-sky-500 shrink-0" />
                      <div>
                        <div>현재 화면 이미지(.png) 저장</div>
                        <div className={`text-[10px] font-medium ${mutedText}`}>
                          단톡방 공유용 고해상도 캡처
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 라이트/다크 테마 전환 */}
              <button
                type="button"
                onClick={handleInternalToggleTheme}
                title={isDark ? '라이트 모드로 보기' : '다크 모드로 보기'}
                className={`p-2 rounded-xl border cursor-pointer schedule-tactile ${
                  isDark
                    ? 'bg-[#1B2230] hover:bg-[#242E42] text-amber-300 border-white/10'
                    : 'bg-white hover:bg-[#EAE5DC] text-stone-700 border-[#D6D0C4]'
                }`}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {/* 관리/삭제 모달 열기 */}
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({ appGuard: true }, '');
                  setIsDeleteModalOpen(true);
                }}
                title="저장된 휴무표 관리 및 초기화"
                className={`p-2 rounded-xl border cursor-pointer schedule-tactile ${
                  isDark
                    ? 'bg-[#1B2230] hover:bg-rose-950/60 text-rose-400 border-white/10'
                    : 'bg-white hover:bg-rose-50 text-rose-600 border-[#D6D0C4]'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* 닫기 */}
              <button
                type="button"
                onClick={onClose}
                aria-label="휴무표 닫기"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                  isDark
                    ? 'bg-white/10 hover:bg-rose-600 text-white border-white/10'
                    : 'bg-stone-200/80 hover:bg-rose-600 hover:text-white text-stone-800 border-stone-300'
                }`}
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">닫기</span>
              </button>
            </div>
          </div>

          {/* Row 2: 4대 뷰 슬라이딩 세그먼트 탭 + 우측 보조 실행 버튼 */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div
              className={`grid grid-cols-4 sm:inline-flex p-1 rounded-2xl border w-full sm:w-auto ${
                isDark
                  ? 'bg-[#0B0E14] border-white/10'
                  : 'bg-[#EAE5DC]/75 border-[#D6D0C4]'
              }`}
            >
              {VIEW_TABS.map((tab) => {
                const active = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id !== 'today' && activeView === 'today') {
                        window.history.pushState({ appGuard: true }, '');
                      }
                      setActiveView(tab.id);
                    }}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer schedule-tab-btn ${
                      active
                        ? isDark
                          ? 'bg-[#1E2738] text-sky-300 shadow-sm border border-sky-400/30'
                          : 'bg-white text-[#18181B] shadow-xs border border-[#D6D0C4]'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-[#68625D] hover:text-[#18181B]'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* 우측 퀵 유틸리티 (주간표 / 전체표 활성 시 빠른 페인트 & 맞교대 비교 & 직원 추가) */}
            <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
              {(activeView === 'full' || activeView === 'week') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaintMode((v) => !v);
                      setEditingCell(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                      isPaintMode
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs'
                        : isDark
                        ? 'bg-[#1B2230] text-slate-200 border-white/10 hover:bg-white/10'
                        : 'bg-white text-[#18181B] border-[#D6D0C4] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>{isPaintMode ? '페인트 입력 켜짐' : '빠른 페인트 편집'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSwapPanelOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                      isSwapPanelOpen || compareNames.length > 0
                        ? isDark
                          ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40'
                          : 'bg-indigo-600 text-white border-indigo-700'
                        : isDark
                        ? 'bg-[#1B2230] text-slate-200 border-white/10 hover:bg-white/10'
                        : 'bg-white text-[#18181B] border-[#D6D0C4] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>
                      맞교대·비교{compareNames.length > 0 ? `(${compareNames.length})` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddStaffOpen(true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-[#1B2230] text-emerald-300 border-white/10 hover:bg-white/10'
                        : 'bg-white text-emerald-800 border-[#D6D0C4] hover:bg-emerald-50'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>직원 추가</span>
                  </button>
                </>
              )}

              {activeView === 'today' && isCurrentMonthRegistered && (
                <button
                  type="button"
                  onClick={handleCopyKakaoBriefing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                    isDark
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/30 hover:bg-amber-400/25'
                      : 'bg-[#F4ECE1] text-[#6E4423] border-[#D8C3A8] hover:bg-[#EAE0D0]'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>단톡방 근무브리핑 복사</span>
                </button>
              )}

              {activeView === 'calendar' && isCurrentMonthRegistered && (
                <button
                  type="button"
                  onClick={() => handleDownloadIcs(personalCalendarData.targetEmp?.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30'
                      : 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>내 폰 캘린더(.ics)에 휴무 넣기</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==================== 내 이름 원터치 설정 드로어 바 ==================== */}
        {isEditingName && (
          <div
            className={`px-4 sm:px-6 py-3 border-b space-y-2.5 shrink-0 ${
              isDark
                ? 'bg-[#161D2B] border-amber-400/40 text-slate-100'
                : 'bg-[#FAF5EC] border-[#D8C3A8] text-[#18181B]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>
                  내 이름 1회 선택 (메인 홈 휴무 카운트다운·내 달력·표 상단 고정에 자동 연동됩니다)
                </span>
              </div>
              {savedName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className={`text-xs font-bold cursor-pointer ${mutedText}`}
                >
                  닫기
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveUserName();
                }}
                placeholder="직원 이름 입력 (예: 강석원)"
                className={`px-3.5 py-1.5 rounded-xl border text-base sm:text-xs font-black w-48 sm:w-56 focus:outline-none ${
                  isDark
                    ? 'bg-[#0B0E14] border-white/15 text-white placeholder:text-slate-500'
                    : 'bg-white border-[#D6D0C4] text-[#18181B] placeholder:text-stone-400'
                }`}
              />
              <button
                type="button"
                onClick={() => handleSaveUserName()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer schedule-tactile"
              >
                <Save className="w-3.5 h-3.5" />
                <span>저장</span>
              </button>
              <span className={`text-[11px] font-bold ${mutedText}`}>
                아래 명단 칩을 누르면 즉시 반영됩니다:
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(monthData.employees.length > 0
                ? monthData.employees
                : GWANGJU_STAFF_ROSTER
              ).map((emp) => {
                const selected = savedName === emp.name;
                return (
                  <button
                    key={emp.name}
                    type="button"
                    onClick={() => handleSaveUserName(emp.name)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                      selected
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                        : isDark
                        ? 'bg-[#0B0E14] hover:bg-white/10 text-slate-200 border-white/10'
                        : 'bg-white hover:bg-[#EAE5DC] text-[#18181B] border-[#DFD9CE]'
                    }`}
                  >
                    {emp.name}{' '}
                    <span className="text-[10px] opacity-70">({emp.role})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== 빠른 페인트(연속 입력) 툴바 ==================== */}
        {isPaintMode && (activeView === 'full' || activeView === 'week') && (
          <div
            className={`px-4 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isDark
                ? 'bg-amber-500/15 border-amber-400/35 text-amber-100'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
                <Paintbrush className="w-3.5 h-3.5" />
                도장 선택 후 표의 날짜 칸을 터치하세요:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {DAY_CODE_OPTIONS.map((opt) => {
                  const active = paintCode === opt.value;
                  return (
                    <button
                      key={opt.value || 'work'}
                      type="button"
                      onClick={() => setPaintCode(opt.value)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                        opt.chipCls
                      } ${
                        active
                          ? (isDark ? 'ring-2 ring-offset-1 ring-white scale-105' : 'ring-2 ring-offset-1 ring-slate-900 scale-105')
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPaintMode(false)}
              className="px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-black cursor-pointer"
            >
              페인트 종료
            </button>
          </div>
        )}

        {/* ==================== 동료 휴무 비교 & 맞교대 시뮬레이터 패널 ==================== */}
        {isSwapPanelOpen && (activeView === 'full' || activeView === 'week') && (
          <div
            className={`px-4 sm:px-6 py-3 border-b space-y-2.5 shrink-0 ${
              isDark
                ? 'bg-[#161D2E] border-indigo-400/30 text-slate-100'
                : 'bg-indigo-50/75 border-indigo-200 text-slate-900'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  동료 휴무 비교 & 1:1 맞교대 시뮬레이터
                </span>
                <span className={`text-xs font-bold ${mutedText}`}>
                  비교할 직원 2명을 선택하면 겹치는 휴무일과 맞교대 가능한 날짜를 자동 추출합니다.
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {compareNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompareNames([]);
                      setSwapDayA(null);
                      setSwapDayB(null);
                      if (selectedCornerFilter === 'COMPARE') {
                        setSelectedCornerFilter('ALL');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-500 cursor-pointer"
                  >
                    선택 초기화
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSwapPanelOpen(false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${mutedText}`}
                >
                  접기
                </button>
              </div>
            </div>

            {/* 직원 2명 빠른 토글 칩 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {monthData.employees.map((emp) => {
                const pickedIdx = compareNames.indexOf(emp.name);
                const picked = pickedIdx !== -1;
                return (
                  <button
                    key={emp.name}
                    type="button"
                    onClick={() => toggleCompareEmployee(emp.name)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                      picked
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : isDark
                        ? 'bg-[#0B0E14] text-slate-300 border-white/10 hover:bg-white/10'
                        : 'bg-white text-slate-800 border-indigo-200 hover:bg-indigo-100/50'
                    }`}
                  >
                    {picked && <span className="mr-1 font-mono">{pickedIdx + 1}</span>}
                    {emp.name}
                    <span className="text-[10px] opacity-70 ml-0.5">({emp.role})</span>
                  </button>
                );
              })}
            </div>

            {/* 2명 선택 완료 시 비교 결과 & 원터치 맞교대 컨트롤 */}
            {swapComparisonAnalysis && (
              <div
                className={`rounded-2xl border p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${cardBg}`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap font-black">
                    <span className="text-indigo-500">
                      ① {swapComparisonAnalysis.empA.name} ({swapComparisonAnalysis.empA.role})
                    </span>
                    <span>↔</span>
                    <span className="text-emerald-500">
                      ② {swapComparisonAnalysis.empB.name} ({swapComparisonAnalysis.empB.role})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCornerFilter((prev) =>
                          prev === 'COMPARE' ? 'ALL' : 'COMPARE'
                        )
                      }
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-black border cursor-pointer ${
                        selectedCornerFilter === 'COMPARE'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : isDark
                          ? 'bg-white/5 border-white/15 text-slate-200'
                          : 'bg-stone-100 border-stone-300 text-stone-800'
                      }`}
                    >
                      {selectedCornerFilter === 'COMPARE'
                        ? '전체 명단 다시 보기'
                        : '표에서 이 2명만 모아보기'}
                    </button>
                  </div>
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 font-bold ${mutedText}`}>
                    <span>
                      🔴 함께 쉬는 날({swapComparisonAnalysis.overlapOffDays.length}일):{' '}
                      <strong className={isDark ? 'text-rose-300' : 'text-rose-600'}>
                        {swapComparisonAnalysis.overlapOffDays.length > 0
                          ? swapComparisonAnalysis.overlapOffDays.map((d) => `${d}일`).join(', ')
                          : '없음'}
                      </strong>
                    </span>
                    <span>
                      🔵 {swapComparisonAnalysis.empA.name} 단독 휴무:{' '}
                      {swapComparisonAnalysis.onlyAOffDays.map((d) => `${d}일`).join(', ') || '없음'}
                    </span>
                    <span>
                      🟢 {swapComparisonAnalysis.empB.name} 단독 휴무:{' '}
                      {swapComparisonAnalysis.onlyBOffDays.map((d) => `${d}일`).join(', ') || '없음'}
                    </span>
                  </div>
                </div>

                {/* 날짜 맞교대 선택 셀렉터 */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <select
                    value={swapDayA ?? ''}
                    onChange={(e) =>
                      setSwapDayA(e.target.value ? Number(e.target.value) : null)
                    }
                    className={`px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-black ${subtleBg}`}
                  >
                    <option value="">
                      {swapComparisonAnalysis.empA.name} 휴무일 선택
                    </option>
                    {swapComparisonAnalysis.onlyAOffDays.map((d) => (
                      <option key={d} value={d}>
                        {currentMonth}/{d}일 ({swapComparisonAnalysis.empA.days[String(d)]})
                      </option>
                    ))}
                  </select>

                  <span className="text-xs font-black">⇄</span>

                  <select
                    value={swapDayB ?? ''}
                    onChange={(e) =>
                      setSwapDayB(e.target.value ? Number(e.target.value) : null)
                    }
                    className={`px-2.5 py-1.5 rounded-xl border text-base sm:text-xs font-black ${subtleBg}`}
                  >
                    <option value="">
                      {swapComparisonAnalysis.empB.name} 휴무일 선택
                    </option>
                    {swapComparisonAnalysis.onlyBOffDays.map((d) => (
                      <option key={d} value={d}>
                        {currentMonth}/{d}일 ({swapComparisonAnalysis.empB.days[String(d)]})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!swapDayA || !swapDayB}
                    onClick={handleExecuteMutualSwap}
                    className="px-3.5 py-2 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black cursor-pointer schedule-tactile"
                  >
                    ⇄ 맞교대 즉시 적용
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 3) 메인 본문 스크롤 스테이지 ==================== */}
        <div
          ref={exportCaptureRef}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4"
        >
          {/* 미등록 월 안내 배너 (일일 브리핑 외 뷰 상단) */}
          {!isCurrentMonthRegistered && activeView !== 'today' && (
            <div
              className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isDark
                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <div className="font-black text-xs sm:text-sm">
                    {currentYear}년 {currentMonth}월 휴무표가 아직 업로드되지 않았습니다.
                  </div>
                  <div className="text-[11px] opacity-80 font-medium">
                    상단 [업로드] 버튼으로 엑셀이나 사진을 올리거나, 아래 빈 칸을 직접 터치해 새 스케줄을 작성할 수 있습니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer schedule-tactile"
              >
                지금 업로드하기
              </button>
            </div>
          )}

          {/* ===================================================================== */}
          {/* [VIEW 1] 👥 일일 브리핑 (7일 미니 날짜 스트립 + 코너 공백 감지 + 카드) */}
          {/* ===================================================================== */}
          {activeView === 'today' &&
            (!isCurrentMonthRegistered ? (
              <div
                className={`rounded-3xl border-2 border-dashed p-8 sm:p-14 text-center flex flex-col items-center justify-center gap-4 ${
                  isDark
                    ? 'bg-[#151A25] border-sky-400/30'
                    : 'bg-white border-[#D6C7B2]'
                }`}
              >
                <div
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-xs ${
                    isDark
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-[#F4ECE1] text-[#8C5A32]'
                  }`}
                >
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base sm:text-xl font-black">
                    {currentYear}년 {currentMonth}월 휴무표가 아직 비어 있습니다
                  </h3>
                  <p className={`text-xs sm:text-sm font-medium leading-relaxed ${mutedText}`}>
                    매장 휴무표 엑셀(.xlsx/.csv) 또는 촬영 사진을 올려주시면 AI가 19명 전 직원의 월간 일정을 자동 분석해 전 기기에 동기화합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black shadow-md cursor-pointer schedule-tactile ${
                      isDark
                        ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                        : 'bg-[#18181B] hover:bg-stone-800 text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>엑셀 · 사진 업로드하기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('full')}
                    className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-black border cursor-pointer schedule-tactile ${subtleBg}`}
                  >
                    <Table2 className="w-4 h-4" />
                    <span>빈 표에서 직접 입력하기</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* (1) 7일 인터랙티브 주간 날짜 스트립 (월~일 원터치 조회) */}
                <div className={`rounded-2xl border p-3 sm:p-4 shadow-2xs space-y-3 ${cardBg}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveDay(-7)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${subtleBg}`}
                      >
                        ◀ 지난주
                      </button>
                      <button
                        type="button"
                        onClick={handleJumpToToday}
                        className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer schedule-tactile ${
                          isSelectedToday
                            ? isDark
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-[#8C5A32] text-white'
                            : `${subtleBg} border`
                        }`}
                      >
                        오늘 ({todayReal.getMonth() + 1}/{todayReal.getDate()})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDay(7)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${subtleBg}`}
                      >
                        다음주 ▶
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-black">
                      <span className={`px-2.5 py-1 rounded-full border font-mono ${isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
                        근무 {monthData.employees.length - restingList.length}명
                      </span>
                      <span className={`px-2.5 py-1 rounded-full border font-mono ${isDark ? "bg-rose-500/15 text-rose-300 border-rose-400/30" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                        휴무·연차·교육 {restingList.length}명
                      </span>
                    </div>
                  </div>

                  {/* 월~일 7개 날짜 카드 그리드 */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {currentWeekDates.map((item) => {
                      const isSelected =
                        item.date.getFullYear() === currentYear &&
                        item.date.getMonth() + 1 === currentMonth &&
                        item.date.getDate() === currentDay;
                      const isTodayItem =
                        item.date.getFullYear() === todayReal.getFullYear() &&
                        item.date.getMonth() === todayReal.getMonth() &&
                        item.date.getDate() === todayReal.getDate();
                      const holidayName =
                        HOLIDAY_NAMES_BY_MONTH[item.yearMonth]?.[item.day];
                      const isRedDay = item.dow === 0 || Boolean(holidayName);
                      const specialKind = getDaySpecialKind(
                        item.yearMonth,
                        item.day,
                        item.dow
                      );

                      return (
                        <button
                          key={item.date.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(new Date(item.date))}
                          className={`relative rounded-2xl p-2 sm:p-2.5 border text-center flex flex-col items-center justify-between gap-1 cursor-pointer schedule-tactile ${
                            isSelected
                              ? isDark
                                ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-md'
                                : 'bg-[#18181B] text-white border-[#18181B] shadow-md'
                              : specialKind === 'holiday'
                              ? isDark
                                ? 'bg-rose-500/20 hover:bg-rose-500/28 border-rose-400/35'
                                : 'bg-rose-100/90 hover:bg-rose-200/80 border-rose-300'
                              : specialKind === 'sunday'
                              ? isDark
                                ? 'bg-rose-500/14 hover:bg-rose-500/22 border-rose-400/25'
                                : 'bg-rose-50/95 hover:bg-rose-100/85 border-rose-200'
                              : specialKind === 'saturday'
                              ? isDark
                                ? 'bg-sky-500/14 hover:bg-sky-500/22 border-sky-400/25'
                                : 'bg-sky-50/95 hover:bg-sky-100/85 border-sky-200'
                              : isDark
                              ? 'bg-[#1B2230]/80 hover:bg-[#232C3E] border-white/10'
                              : 'bg-[#FAF8F4] hover:bg-[#EAE5DC] border-[#E4DFD5]'
                          } ${!item.isSameMonth ? 'opacity-60' : ''}`}
                        >
                          <span
                            className={`text-[10px] sm:text-xs font-extrabold ${
                              isSelected
                                ? 'opacity-90'
                                : isRedDay
                                ? 'text-rose-500'
                                : item.dow === 6
                                ? 'text-sky-500'
                                : mutedText
                            }`}
                          >
                            {WEEKDAY_KO[item.dow]}
                            {isTodayItem && '·오늘'}
                          </span>

                          <span className="text-sm sm:text-lg font-black font-mono leading-none">
                            {item.day}
                          </span>

                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {item.isRegistered ? (
                              <span
                                className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded-full ${
                                  isSelected
                                    ? isDark
                                      ? 'bg-slate-950/15 text-slate-950'
                                      : 'bg-white/20 text-white'
                                    : isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {item.workingCount}명
                              </span>
                            ) : (
                              <span className="text-[10px] opacity-50">-</span>
                            )}
                            {item.hasVacancy && (
                              <span
                                title="코너 공백 주의"
                                className="w-2 h-2 rounded-full bg-rose-500 inline-block"
                              />
                            )}
                            {isOffDayCode(item.myCode) && (
                              <span
                                title={`내 휴무 (${item.myCode})`}
                                className="w-2 h-2 rounded-full bg-amber-400 inline-block"
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* (2) 코너 공백 자동 감지 경고 배너 */}
                {todayVacancies.length > 0 && (
                  <div
                    className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
                      isDark
                        ? 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>
                        코너 공백 알림: {currentMonth}월 {currentDay}일({selectedWeekday})에{' '}
                        <u className="underline-offset-4">
                          [{todayVacancies.join(', ')}]
                        </u>{' '}
                        근무자가 0명입니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('full');
                        setIsSwapPanelOpen(true);
                      }}
                      className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer schedule-tactile"
                    >
                      맞교대 시뮬레이터 열기
                    </button>
                  </div>
                )}

                {/* (3) 내 스케줄 브리핑 스트립 (내 이름 설정 시) */}
                {myEmployee && (
                  <div
                    className={`rounded-2xl border p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 ${
                      isDark
                        ? 'bg-gradient-to-r from-[#172033] to-[#151A25] border-amber-400/35'
                        : 'bg-gradient-to-r from-[#FAF4EA] to-white border-[#DFC9AC]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isDark
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-[#8C5A32] text-white'
                        }`}
                      >
                        {myEmployee.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black">
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
                            {currentMonth}/{currentDay}({selectedWeekday}):{' '}
                            {myTodayCode === 'O'
                              ? '정기 휴무(O)'
                              : myTodayCode === '연차'
                              ? '연차 휴무'
                              : myTodayCode === 'V'
                              ? '휴가(V)'
                              : myTodayCode === '출휴'
                              ? '출산 휴가(출휴)'
                              : myTodayCode === '사가'
                              ? '사규 휴가(사가)'
                              : myTodayCode
                              ? myTodayCode
                              : '정상 근무'}
                          </span>
                        </div>
                        <div className={`text-xs font-bold mt-1 flex items-center gap-1.5 flex-wrap ${mutedText}`}>
                          <span>
                            남은 이번 달 휴무{' '}
                            <strong className={isDark ? 'text-amber-300' : 'text-[#8C5A32]'}>
                              {myRemainingOffDays.length}일
                            </strong>
                          </span>
                          {myRemainingOffDays.slice(0, 6).map((d) => (
                            <button
                              key={d.day}
                              type="button"
                              onClick={() =>
                                setSelectedDate(
                                  new Date(currentYear, currentMonth - 1, d.day)
                                )
                              }
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-black font-mono border cursor-pointer ${
                                d.day === currentDay
                                  ? 'bg-amber-400 text-slate-950 border-amber-500'
                                  : subtleBg
                              }`}
                            >
                              {d.day}일({d.code})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCalendarTargetName(myEmployee.name);
                        setActiveView('calendar');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${subtleBg}`}
                    >
                      내 월간 달력 보기 →
                    </button>
                  </div>
                )}

                {/* (4) 좌측 7칸 오늘 근무자(코너별) + 우측 5칸 오늘 휴무·연차·교육자 */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className={`lg:col-span-7 rounded-2xl border p-4 space-y-3 ${cardBg}`}>
                    <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? "border-white/10" : "border-[#E4DFD5]"}`}>
                      <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        <span>
                          {currentMonth}월 {currentDay}일({selectedWeekday}) 근무자 명단
                        </span>
                      </h3>
                      <span className={`text-xs font-bold ${mutedText}`}>
                        이름 터치 시 상태 즉시 변경
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CORNER_GROUP_ORDER.map((groupTitle) => {
                        const list = workingByGroup[groupTitle] || [];
                        const isEmptyCorner = list.length === 0;
                        return (
                          <div
                            key={groupTitle}
                            className={`rounded-2xl border p-3 space-y-2 ${
                              isEmptyCorner
                                ? isDark
                                  ? 'bg-rose-950/30 border-rose-500/40'
                                  : 'bg-rose-50/70 border-rose-300'
                                : subtleBg
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black">{groupTitle}</span>
                              <span
                                className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-full ${
                                  isEmptyCorner
                                    ? 'bg-rose-500 text-white'
                                    : isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isEmptyCorner ? '0명 공백' : `${list.length}명`}
                              </span>
                            </div>

                            {isEmptyCorner ? (
                              <p className="text-xs font-bold text-rose-500">
                                해당 코너 근무자가 없습니다.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((emp) => {
                                  const isMe = emp.name === savedName;
                                  const fullEmp = monthData.employees.find(
                                    (e) => e.name === emp.name
                                  );
                                  return (
                                    <button
                                      key={emp.name}
                                      type="button"
                                      onClick={() =>
                                        fullEmp &&
                                        handleCellInteraction(fullEmp, currentDay)
                                      }
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                                        isMe
                                          ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                                          : isDark
                                          ? 'bg-[#121722] hover:bg-white/10 text-slate-100 border-white/10'
                                          : 'bg-white hover:bg-[#F4ECE1] text-[#18181B] border-[#E4DFD5]'
                                      }`}
                                    >
                                      <span>{emp.name}</span>
                                      <span className="text-[10px] opacity-65">
                                        ({emp.role})
                                      </span>
                                      {emp.code && renderCodeBadge(emp.code, 'xs')}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 우측 5칸: 휴무·연차·교육자 명단 */}
                  <div className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 ${cardBg}`}>
                    <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? "border-white/10" : "border-[#E4DFD5]"}`}>
                      <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                        <span>휴무 · 연차 · 교육 명단</span>
                      </h3>
                      <span className="text-xs font-black font-mono text-rose-500">
                        총 {restingList.length}명
                      </span>
                    </div>

                    {restingList.length === 0 ? (
                      <div className={`py-10 text-center text-xs font-bold ${mutedText}`}>
                        선택하신 날짜에는 휴무·연차·교육자가 없습니다 (전원 출근).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {restingList.map((emp) => {
                          const isMe = emp.name === savedName;
                          const fullEmp = monthData.employees.find(
                            (e) => e.name === emp.name
                          );
                          return (
                            <button
                              key={emp.name}
                              type="button"
                              onClick={() =>
                                fullEmp && handleCellInteraction(fullEmp, currentDay)
                              }
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer schedule-tactile ${
                                isMe
                                  ? 'bg-amber-400/20 border-amber-400'
                                  : subtleBg
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-black truncate">
                                  {emp.name}
                                </div>
                                <div className={`text-[11px] font-bold truncate ${mutedText}`}>
                                  {emp.role}
                                </div>
                              </div>
                              {renderCodeBadge(emp.code, 'md')}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

          {/* ===================================================================== */}
          {/* [VIEW 2] 📅 내 월간 달력 (가로 스크롤 제로 7열 개인/동료 달력 + 연휴 감지) */}
          {/* ===================================================================== */}
          {activeView === 'calendar' && (
            <div className="space-y-4">
              {/* 상단 조회 대상 직원 원터치 선택 바 */}
              <div className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${cardBg}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-500" />
                    <span>직원별 월간 달력 조회</span>
                    <span className={`text-[11px] font-medium ${mutedText}`}>
                      (날짜 칸을 누르면 해당일 근무 상태를 바로 수정합니다)
                    </span>
                  </div>
                  {personalCalendarData.streaks.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black text-amber-500">
                        ✨ 연속 휴무:
                      </span>
                      {personalCalendarData.streaks.map((st) => (
                        <span
                          key={st.start}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono ${
                            isDark
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-amber-100 text-amber-950 border border-amber-300'
                          }`}
                        >
                          {currentMonth}/{st.start}~{st.end}일 ({st.length}일 연속)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {monthData.employees.map((emp) => {
                    const active =
                      personalCalendarData.targetEmp?.name === emp.name;
                    const isMe = emp.name === savedName;
                    return (
                      <button
                        key={emp.name}
                        type="button"
                        onClick={() => setCalendarTargetName(emp.name)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                          active
                            ? isDark
                              ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-xs'
                              : 'bg-[#18181B] text-white border-[#18181B] shadow-xs'
                            : isDark
                            ? 'bg-[#1B2230] text-slate-300 border-white/10 hover:bg-white/10'
                            : 'bg-[#FAF8F4] text-[#18181B] border-[#E4DFD5] hover:bg-[#EAE5DC]'
                        }`}
                      >
                        {isMe ? `⭐ ${emp.name}` : emp.name}
                        <span className="text-[10px] opacity-70 ml-1">
                          ({emp.role})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 월간 4대 요약 지표 미니 카드 */}
                {personalCalendarData.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className={`rounded-xl border p-2.5 ${subtleBg}`}>
                      <div className={`text-[11px] font-bold ${mutedText}`}>
                        정상 출근 예정
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-emerald-500">
                        {personalCalendarData.stats.workDays}일
                      </div>
                    </div>
                    <div className={`rounded-xl border p-2.5 ${subtleBg}`}>
                      <div className={`text-[11px] font-bold ${mutedText}`}>
                        정기 휴무 (O)
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-rose-500">
                        {personalCalendarData.stats.offO}일
                      </div>
                    </div>
                    <div className={`rounded-xl border p-2.5 ${subtleBg}`}>
                      <div className={`text-[11px] font-bold ${mutedText}`}>
                        연차 · 휴가 (V)
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-amber-500">
                        {personalCalendarData.stats.annualV}일
                        {personalCalendarData.stats.half > 0 &&
                          ` (+반차 ${personalCalendarData.stats.half})`}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-2.5 ${subtleBg}`}>
                      <div className={`text-[11px] font-bold ${mutedText}`}>
                        교육 · 외부회의
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-sky-500">
                        {personalCalendarData.stats.eduMeet}일
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 7열 월간 달력 그리드 (바형 스마트폰 390px 완벽 대응) */}
              <div className={`rounded-2xl border overflow-hidden shadow-xs ${cardBg}`}>
                <div
                  className={`grid grid-cols-7 border-b text-center py-2 text-xs font-black ${
                    isDark
                      ? 'bg-[#1B2230] border-white/10'
                      : 'bg-[#FAF8F4] border-[#E4DFD5]'
                  }`}
                >
                  {WEEKDAY_KO.map((w, idx) => (
                    <div
                      key={w}
                      className={`py-0.5 rounded-md ${
                        idx === 0
                          ? isDark
                            ? 'text-rose-400 bg-rose-500/15'
                            : 'text-rose-600 bg-rose-100/80'
                          : idx === 6
                          ? isDark
                            ? 'text-sky-400 bg-sky-500/15'
                            : 'text-sky-600 bg-sky-100/80'
                          : ''
                      }`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {personalCalendarData.cells.map((cell, idx) => {
                    if (!cell) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className={`min-h-[68px] sm:min-h-[86px] border-b border-r border-current/5 ${
                            isDark ? 'bg-[#0E121B]/50' : 'bg-stone-100/40'
                          }`}
                        />
                      );
                    }

                    const isTodayCell =
                      todayReal.getFullYear() === currentYear &&
                      todayReal.getMonth() + 1 === currentMonth &&
                      todayReal.getDate() === cell.day;
                    const isRed = cell.dow === 0 || Boolean(cell.holidayName);
                    const off = isOffDayCode(cell.code);
                    const dayWorkCount = dailySummaryMap[cell.day]?.workingCount ?? 0;
                    const cellKind = getDaySpecialKind(
                      currentYearMonth,
                      cell.day,
                      cell.dow
                    );

                    return (
                      <button
                        key={cell.day}
                        type="button"
                        onClick={() => {
                          if (personalCalendarData.targetEmp) {
                            handleCellInteraction(
                              personalCalendarData.targetEmp,
                              cell.day
                            );
                          }
                        }}
                        className={`min-h-[68px] sm:min-h-[88px] p-1.5 sm:p-2.5 border-b border-r border-current/10 flex flex-col justify-between text-left cursor-pointer transition-colors ${
                          cellKind === 'holiday'
                            ? isDark
                              ? 'bg-rose-500/[0.20] hover:bg-rose-500/[0.28]'
                              : 'bg-rose-100/90 hover:bg-rose-200/80'
                            : cellKind === 'sunday'
                            ? isDark
                              ? 'bg-rose-500/[0.13] hover:bg-rose-500/[0.20]'
                              : 'bg-rose-50/95 hover:bg-rose-100/80'
                            : cellKind === 'saturday'
                            ? isDark
                              ? 'bg-sky-500/[0.13] hover:bg-sky-500/[0.20]'
                              : 'bg-sky-50/95 hover:bg-sky-100/80'
                            : off
                            ? isDark
                              ? 'bg-amber-400/[0.08] hover:bg-amber-400/[0.15]'
                              : 'bg-amber-50/70 hover:bg-amber-100/70'
                            : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-[#FAF8F4]'
                        } ${
                          isTodayCell
                            ? 'ring-2 ring-inset ring-amber-400'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 w-full">
                          <span
                            className={`text-xs sm:text-sm font-black font-mono leading-none ${
                              isRed
                                ? 'text-rose-500'
                                : cell.dow === 6
                                ? 'text-sky-500'
                                : ''
                            }`}
                          >
                            {cell.day}
                          </span>
                          {cell.inStreak && (
                            <span className={`text-[9px] font-black px-1 rounded hidden sm:inline ${isDark ? "bg-amber-400/25 text-amber-300" : "bg-amber-100 text-amber-900"}`}>
                              연휴
                            </span>
                          )}
                        </div>

                        {cell.holidayName && (
                          <div className="text-[9px] sm:text-[10px] font-bold text-rose-500 truncate w-full">
                            {cell.holidayName}
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-1 w-full">
                          {cell.code ? (
                            renderCodeBadge(cell.code, 'sm')
                          ) : (
                            <span
                              className={`text-[10px] font-semibold ${mutedText}`}
                            >
                              출근
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-mono hidden sm:inline ${mutedText}`}
                          >
                            매장 {dayWorkCount}명
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* [VIEW 3 & VIEW 4 공통 필터 바] 검색(초성 지원) + 코너 필터 칩 */}
          {/* ===================================================================== */}
          {(activeView === 'week' || activeView === 'full') && (
            <div className={`rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2.5 ${cardBg}`}>
              {/* 초성/이름/담당 검색창 */}
              <div className="relative flex-1 min-w-[190px] max-w-xs">
                <Search
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${mutedText}`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름·담당·초성 검색 (예: ㄱㅅㅇ, 대형)"
                  className={`w-full pl-9 pr-8 py-1.5 rounded-xl border text-base sm:text-xs font-bold focus:outline-none ${subtleBg}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer ${mutedText}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 코너 필터 칩 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: `전체 (${monthData.employees.length})` },
                  ...CORNER_GROUP_ORDER.map((c) => ({ id: c, label: c })),
                ].map((chip) => {
                  const active = selectedCornerFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSelectedCornerFilter(chip.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${
                        active
                          ? isDark
                            ? 'bg-sky-400 text-slate-950 border-sky-300'
                            : 'bg-[#18181B] text-white border-[#18181B]'
                          : subtleBg
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}

                {activeView === 'full' && (
                  <button
                    type="button"
                    onClick={() => setShowHeatmapRow((v) => !v)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer ${
                      showHeatmapRow
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : subtleBg
                    }`}
                  >
                    {showHeatmapRow ? '✓ 근무인원 합계행' : '근무인원 합계행'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* [VIEW 3] 📆 주간(7일) 포커스 표 (가로 스크롤 부담 제로 주간 타임라인) */}
          {/* ===================================================================== */}
          {activeView === 'week' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMoveDay(-7)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${cardBg}`}
                  >
                    ◀ 이전 7일
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${subtleBg}`}
                  >
                    이번 주
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDay(7)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer schedule-tactile ${cardBg}`}
                  >
                    다음 7일 ▶
                  </button>
                </div>
                <span className="text-xs sm:text-sm font-black font-mono">
                  {currentWeekDates[0].date.getMonth() + 1}/
                  {currentWeekDates[0].day}(월) ~{' '}
                  {currentWeekDates[6].date.getMonth() + 1}/
                  {currentWeekDates[6].day}(일)
                </span>
              </div>

              <div className={`w-full overflow-x-auto rounded-2xl border shadow-xs ${cardBg}`}>
                <table className="w-full border-collapse min-w-[620px] text-center">
                  <thead>
                    <tr
                      className={
                        isDark
                          ? 'bg-[#1B2230] text-slate-100 border-b border-white/10'
                          : 'bg-[#18181B] text-white border-b border-stone-700'
                      }
                    >
                      <th className="sticky left-0 z-20 bg-inherit w-36 min-w-[140px] px-3 py-2.5 text-left text-xs font-black border-r border-white/10">
                        성명 · 코너 (월합계)
                      </th>
                      {currentWeekDates.map((wd) => {
                        const isTodayCol =
                          wd.date.getFullYear() === todayReal.getFullYear() &&
                          wd.date.getMonth() === todayReal.getMonth() &&
                          wd.date.getDate() === wd.day;
                        const holiday =
                          HOLIDAY_NAMES_BY_MONTH[wd.yearMonth]?.[wd.day];
                        const isRed = wd.dow === 0 || Boolean(holiday);
                        const wdKind = getDaySpecialKind(
                          wd.yearMonth,
                          wd.day,
                          wd.dow
                        );
                        return (
                          <th
                            key={wd.date.toISOString()}
                            onClick={() => setSelectedDate(new Date(wd.date))}
                            className={`px-2 py-2 border-r last:border-r-0 border-white/10 cursor-pointer ${
                              isTodayCol
                                ? 'bg-amber-400 text-slate-950'
                                : getMatrixStickyHeaderBg(wdKind, isDark)
                            }`}
                          >
                            <div
                              className={`text-xs font-black font-mono ${
                                isTodayCol
                                  ? 'text-slate-950'
                                  : isRed
                                  ? 'text-rose-300'
                                  : wd.dow === 6
                                  ? 'text-sky-300'
                                  : ''
                              }`}
                            >
                              {wd.date.getMonth() + 1}/{wd.day} ({WEEKDAY_KO[wd.dow]})
                              {holiday ? ` · ${getShortHolidayBadge(holiday)}` : ''}
                            </div>
                            <div
                              className={`text-[10px] font-bold font-mono mt-0.5 ${
                                isTodayCol ? 'text-slate-900' : 'opacity-80'
                              }`}
                            >
                              근무 {wd.workingCount}명
                              {wd.hasVacancy && ' ⚠️'}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEmployeesByCorner.map((group) => (
                      <React.Fragment key={group.corner}>
                        <tr
                          className={
                            isDark
                              ? 'bg-[#111622] text-sky-300 border-b border-white/10'
                              : 'bg-[#F4ECE1]/85 text-[#6E4423] border-b border-[#E4DFD5]'
                          }
                        >
                          <td
                            className={`sticky left-0 z-10 px-3 py-1.5 text-left text-[11px] font-black border-r ${
                              isDark
                                ? 'bg-[#111622] border-white/10'
                                : 'bg-[#F4ECE1] border-[#E4DFD5]'
                            }`}
                          >
                            ▪ {group.corner} ({group.employees.length}명)
                          </td>
                          {currentWeekDates.map((wd) => {
                            const wdKind = getDaySpecialKind(
                              wd.yearMonth,
                              wd.day,
                              wd.dow
                            );
                            return (
                              <td
                                key={`wk-div-${group.corner}-${wd.date.toISOString()}`}
                                className={`border-r last:border-r-0 ${
                                  isDark ? 'border-white/5' : 'border-[#E4DFD5]'
                                } ${getCornerDividerCellBg(wdKind, isDark)}`}
                              />
                            );
                          })}
                        </tr>
                        {group.employees.map((emp) => {
                          const isMe = emp.name === savedName;
                          const st = employeeStatsMap[emp.name];
                          return (
                            <tr
                              key={emp.name}
                              className={`border-b last:border-b-0 ${
                                isDark ? 'border-white/5' : 'border-[#E4DFD5]'
                              } ${
                                isMe
                                  ? isDark
                                    ? 'bg-amber-400/10'
                                    : 'bg-amber-50/80'
                                  : ''
                              }`}
                            >
                              <td
                                className={`sticky left-0 z-10 px-3 py-2 text-left border-r whitespace-nowrap ${
                                  isMe
                                    ? 'bg-amber-300 text-slate-950 border-amber-400 font-black'
                                    : isDark
                                    ? 'bg-[#151A25] border-white/10'
                                    : 'bg-white border-[#E4DFD5]'
                                }`}
                              >
                                <div className="text-xs font-black flex items-center justify-between gap-1">
                                  <span>
                                    {isMe ? `⭐ ${emp.name}` : emp.name}{' '}
                                    <span className="text-[10px] opacity-65">
                                      ({emp.role})
                                    </span>
                                  </span>
                                  {st && (
                                    <span className="text-[10px] font-mono opacity-75">
                                      휴{st.offO}·연{st.annualV}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {currentWeekDates.map((wd) => {
                                const mSched =
                                  wd.yearMonth === currentYearMonth
                                    ? monthData
                                    : getOrCreateMonthSchedule(
                                        schedules,
                                        wd.yearMonth
                                      );
                                const targetEmpInDay = mSched.employees.find(
                                  (e) => e.name === emp.name
                                );
                                const code =
                                  targetEmpInDay?.days[String(wd.day)] || '';
                                const canEdit = wd.yearMonth === currentYearMonth;
                                const wdKind = getDaySpecialKind(
                                  wd.yearMonth,
                                  wd.day,
                                  wd.dow
                                );
                                const isTodayCol =
                                  wd.date.getFullYear() === todayReal.getFullYear() &&
                                  wd.date.getMonth() === todayReal.getMonth() &&
                                  wd.date.getDate() === wd.day;
                                const colBgCls = getMatrixBodyCellBg(
                                  wdKind,
                                  isDark,
                                  isMe
                                );

                                return (
                                  <td
                                    key={wd.date.toISOString()}
                                    onClick={() => {
                                      if (!canEdit) {
                                        setSelectedDate(new Date(wd.date));
                                        return;
                                      }
                                      handleCellInteraction(emp, wd.day);
                                    }}
                                    className={`px-1.5 py-2 border-r last:border-r-0 cursor-pointer ${
                                      isDark ? 'border-white/5' : 'border-[#E5DFD3]'
                                    } ${
                                      isTodayCol
                                        ? isDark
                                          ? 'bg-amber-400/15 ring-1 ring-inset ring-amber-400/60'
                                          : 'bg-amber-100/75 ring-1 ring-inset ring-amber-400'
                                        : colBgCls ||
                                          (isDark
                                            ? 'hover:bg-white/5'
                                            : 'hover:bg-[#FAF8F4]')
                                    } ${!canEdit ? 'opacity-50' : ''}`}
                                  >
                                    {code ? (
                                      renderCodeBadge(code, 'sm')
                                    ) : (
                                      <span
                                        className={`text-[11px] font-semibold ${mutedText}`}
                                      >
                                        ·
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* [VIEW 4] 🗓️ 전체 매트릭스 (코너 접기/펼치기 + 합계 고정열 + 근무인원 히트맵) */}
          {/* ===================================================================== */}
          {activeView === 'full' && (
            <div className="space-y-2.5">
              {/* 상단 기호 범례 & 안내 */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className={`text-xs font-bold ${mutedText}`}>
                  💡 좌측 이름과 상단 날짜가 고정됩니다 · 이름 옆 체크박스로 동료 휴무를 비교하거나 칸을 터치해 수정하세요.
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
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-950 border border-teal-300">
                    HP
                  </span>
                  <span className="px-2 py-0.5 rounded bg-pink-500 text-white">
                    출휴
                  </span>
                  <span className="px-2 py-0.5 rounded bg-violet-500 text-white">
                    사가
                  </span>
                </div>
              </div>

              {/* 매트릭스 스크롤 컨테이너 */}
              <div
                className={`w-full max-h-[60dvh] overflow-auto relative rounded-2xl border shadow-sm schedule-matrix-scroll ${cardBg}`}
              >
                <table className="w-full border-collapse min-w-[1220px] text-center">
                  <thead>
                    {/* Row 1: 날짜 헤더 */}
                    <tr
                      className={`sticky top-0 z-20 ${
                        isDark
                          ? 'bg-[#161D2B] text-slate-100'
                          : 'bg-[#18181B] text-white'
                      }`}
                    >
                      <th
                        className={`sticky top-0 left-0 z-30 w-44 min-w-[176px] px-2.5 py-2 text-left text-xs font-black border-r border-b border-white/15 ${
                          isDark ? 'bg-[#161D2B]' : 'bg-[#18181B]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>성명 (담당)</span>
                          <span className="text-[10px] font-mono opacity-75">
                            휴무·연차
                          </span>
                        </div>
                      </th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                        (d) => {
                          const dow = new Date(
                            currentYear,
                            currentMonth - 1,
                            d
                          ).getDay();
                          const holidayName =
                            HOLIDAY_NAMES_BY_MONTH[currentYearMonth]?.[d];
                          const isRed = dow === 0 || Boolean(holidayName);
                          const isTodayCol =
                            todayReal.getFullYear() === currentYear &&
                            todayReal.getMonth() + 1 === currentMonth &&
                            todayReal.getDate() === d;
                          const hasVacancy =
                            (dailySummaryMap[d]?.vacantCorners.length || 0) > 0;
                          const isOverlapDay =
                            swapComparisonAnalysis?.overlapOffDays.includes(d);

                          return (
                            <th
                              key={d}
                              onClick={() =>
                                setSelectedDate(
                                  new Date(currentYear, currentMonth - 1, d)
                                )
                              }
                              title={
                                holidayName
                                  ? `${d}일 (${holidayName})`
                                  : hasVacancy
                                  ? `코너 공백: ${dailySummaryMap[d]?.vacantCorners.join(', ')}`
                                  : `${d}일 일일 브리핑 기준일로 선택`
                              }
                              className={`sticky top-0 z-20 px-1 py-1.5 border-r border-b border-white/15 cursor-pointer ${
                                isTodayCol
                                  ? 'bg-amber-400 text-slate-950'
                                  : isOverlapDay
                                  ? 'bg-indigo-600 text-white'
                                  : getMatrixStickyHeaderBg(
                                      getDaySpecialKind(currentYearMonth, d, dow),
                                      isDark
                                    )
                              }`}
                            >
                              <div
                                className={`text-xs font-black font-mono leading-tight ${
                                  isTodayCol
                                    ? 'text-slate-950'
                                    : isRed
                                    ? 'text-rose-300'
                                    : dow === 6
                                    ? 'text-sky-300'
                                    : ''
                                }`}
                              >
                                {d}
                              </div>
                              <div
                                className={`text-[10px] font-bold leading-tight ${
                                  isTodayCol
                                    ? 'text-slate-900'
                                    : isRed
                                    ? 'text-rose-200'
                                    : dow === 6
                                    ? 'text-sky-200'
                                    : 'text-slate-400'
                                }`}
                              >
                                {WEEKDAY_KO[dow]}
                              </div>
                              {holidayName && (
                                <div
                                  className={`text-[8px] font-extrabold leading-none mt-0.5 px-0.5 rounded ${
                                    isTodayCol
                                      ? 'bg-slate-950/15 text-slate-950'
                                      : 'bg-rose-500/35 text-rose-100'
                                  }`}
                                >
                                  {getShortHolidayBadge(holidayName)}
                                </div>
                              )}
                              {hasVacancy && (
                                <div className="text-[9px] leading-none mt-0.5 text-rose-400 font-black">
                                  ⚠️
                                </div>
                              )}
                            </th>
                          );
                        }
                      )}
                    </tr>

                    {/* Row 2: 일자별 총 근무 인원 히트맵 요약 행 */}
                    {showHeatmapRow && isCurrentMonthRegistered && (
                      <tr
                        className={
                          isDark
                            ? 'bg-[#111622] border-b border-white/10 text-[10px]'
                            : 'bg-[#FAF5EC] border-b border-[#E4DFD5] text-[10px]'
                        }
                      >
                        <th
                          className={`sticky left-0 z-20 px-2.5 py-1 text-left font-black border-r ${
                            isDark
                              ? 'bg-[#111622] border-white/10 text-emerald-300'
                              : 'bg-[#FAF5EC] border-[#E4DFD5] text-[#6E4423]'
                          }`}
                        >
                          일자별 총 근무 인원
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                          (d) => {
                            const summary = dailySummaryMap[d];
                            const work = summary?.workingCount ?? 0;
                            const vacant =
                              (summary?.vacantCorners.length || 0) > 0;
                            const lowStaff = work <= Math.floor(monthData.employees.length * 0.55);
                            const sumDow = new Date(
                              currentYear,
                              currentMonth - 1,
                              d
                            ).getDay();
                            const sumKind = getDaySpecialKind(
                              currentYearMonth,
                              d,
                              sumDow
                            );
                            const sumWeekendBg =
                              sumKind === 'holiday'
                                ? isDark
                                  ? 'bg-rose-500/22 text-rose-200'
                                  : 'bg-rose-200/80 text-rose-900'
                                : sumKind === 'sunday'
                                ? isDark
                                  ? 'bg-rose-500/15 text-emerald-300'
                                  : 'bg-rose-100/80 text-emerald-800'
                                : sumKind === 'saturday'
                                ? isDark
                                  ? 'bg-sky-500/15 text-emerald-300'
                                  : 'bg-sky-100/80 text-emerald-800'
                                : isDark
                                ? 'text-emerald-400'
                                : 'text-emerald-700';

                            return (
                              <td
                                key={`sum-${d}`}
                                className={`py-1 font-mono font-black border-r last:border-r-0 ${
                                  isDark ? 'border-white/5' : 'border-[#E4DFD5]'
                                } ${
                                  vacant
                                    ? 'bg-rose-500/30 text-rose-500'
                                    : lowStaff
                                    ? isDark
                                      ? 'bg-amber-400/20 text-amber-300'
                                      : 'bg-amber-100 text-amber-900'
                                    : sumWeekendBg
                                }`}
                              >
                                {work}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {filteredEmployeesByCorner.length === 0 ? (
                      <tr>
                        <td
                          colSpan={daysInMonth + 1}
                          className={`py-12 text-center text-xs font-bold ${mutedText}`}
                        >
                          검색 조건에 일치하는 직원이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployeesByCorner.map((group) => {
                        const isCollapsed = Boolean(collapsedCorners[group.corner]);
                        return (
                          <React.Fragment key={group.corner}>
                            {/* 코너 그룹 접기/펼치기 헤더 행 */}
                            <tr
                              onClick={() =>
                                setCollapsedCorners((prev) => ({
                                  ...prev,
                                  [group.corner]: !prev[group.corner],
                                }))
                              }
                              className={`cursor-pointer border-b ${
                                isDark
                                  ? 'bg-[#1B2230]/90 hover:bg-[#222B3D] border-white/10 text-sky-300'
                                  : 'bg-[#F4ECE1]/90 hover:bg-[#EAE0D0] border-[#DFD6C7] text-[#6E4423]'
                              }`}
                            >
                              <td
                                className={`sticky left-0 z-10 px-2.5 py-1.5 text-left text-[11px] font-black border-r ${
                                  isDark
                                    ? 'bg-[#1B2230] border-white/10'
                                    : 'bg-[#F4ECE1] border-[#DFD6C7]'
                                }`}
                              >
                                <span>{isCollapsed ? '▶' : '▼'} </span>
                                <span>{group.corner}</span>
                                <span className="ml-1 font-mono opacity-80">
                                  ({group.employees.length})
                                </span>
                              </td>
                              {Array.from(
                                { length: daysInMonth },
                                (_, i) => i + 1
                              ).map((d) => {
                                const cDow = new Date(
                                  currentYear,
                                  currentMonth - 1,
                                  d
                                ).getDay();
                                const cKind = getDaySpecialKind(
                                  currentYearMonth,
                                  d,
                                  cDow
                                );
                                return (
                                  <td
                                    key={`corner-div-${group.corner}-${d}`}
                                    className={`border-r last:border-r-0 ${
                                      isDark
                                        ? 'border-white/5'
                                        : 'border-[#DFD6C7]/70'
                                    } ${getCornerDividerCellBg(cKind, isDark)}`}
                                  />
                                );
                              })}
                            </tr>

                            {!isCollapsed &&
                              group.employees.map((emp) => {
                                const isMe = emp.name === savedName;
                                const isCompared = compareNames.includes(emp.name);
                                const st = employeeStatsMap[emp.name] || {
                                  offO: 0,
                                  annualV: 0,
                                };

                                return (
                                  <tr
                                    key={emp.name}
                                    className={`border-b last:border-b-0 ${
                                      isDark
                                        ? 'border-white/5 hover:bg-white/[0.03]'
                                        : 'border-[#EDE9E0] hover:bg-[#FAF8F4]'
                                    } ${
                                      isMe
                                        ? isDark
                                          ? 'bg-amber-400/10'
                                          : 'bg-amber-50/75'
                                        : isCompared
                                        ? isDark
                                          ? 'bg-indigo-500/15'
                                          : 'bg-indigo-50/70'
                                        : ''
                                    }`}
                                  >
                                    {/* 좌측 고정 성명 + 비교 체크 + 월간 휴무/연차 배지 */}
                                    <td
                                      className={`sticky left-0 z-10 px-2 py-1.5 text-xs font-black border-r whitespace-nowrap ${
                                        isMe
                                          ? 'bg-amber-300 text-slate-950 border-amber-400'
                                          : isCompared
                                          ? 'bg-indigo-600 text-white border-indigo-700'
                                          : isDark
                                          ? 'bg-[#151A25] text-slate-100 border-white/10'
                                          : 'bg-white text-[#18181B] border-[#E4DFD5]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isCompared}
                                            onChange={() => {
                                              toggleCompareEmployee(emp.name);
                                              if (!isSwapPanelOpen) {
                                                setIsSwapPanelOpen(true);
                                              }
                                            }}
                                            title="동료 휴무 비교/맞교대 선택"
                                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                                          />
                                          <span className="truncate">
                                            {isMe ? `⭐${emp.name}` : emp.name}
                                          </span>
                                          <span className="text-[10px] font-bold opacity-70">
                                            ({emp.role})
                                          </span>
                                        </div>
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${isDark ? "bg-white/10" : "bg-black/8"}`}>
                                          {st.offO}/{st.annualV}
                                        </span>
                                      </div>
                                    </td>

                                    {/* 1일 ~ 말일 셀 */}
                                    {Array.from(
                                      { length: daysInMonth },
                                      (_, i) => i + 1
                                    ).map((d) => {
                                      const code = emp.days[String(d)] || '';
                                      const dDow = new Date(
                                        currentYear,
                                        currentMonth - 1,
                                        d
                                      ).getDay();
                                      const dKind = getDaySpecialKind(
                                        currentYearMonth,
                                        d,
                                        dDow
                                      );
                                      const colBgCls = getMatrixBodyCellBg(
                                        dKind,
                                        isDark,
                                        isMe
                                      );
                                      const isTodayCol =
                                        todayReal.getFullYear() === currentYear &&
                                        todayReal.getMonth() + 1 === currentMonth &&
                                        todayReal.getDate() === d;
                                      const isOverlapCell =
                                        isCompared &&
                                        Boolean(
                                          swapComparisonAnalysis?.overlapOffDays.includes(
                                            d
                                          )
                                        );

                                      return (
                                        <td
                                          key={`${emp.name}-${d}`}
                                          onClick={() =>
                                            handleCellInteraction(emp, d)
                                          }
                                          className={`px-0.5 py-1 border-r last:border-r-0 cursor-pointer align-middle ${
                                            isDark
                                              ? 'border-white/5'
                                              : 'border-[#E5DFD3]'
                                          } ${
                                            isTodayCol
                                              ? isDark
                                                ? 'bg-amber-400/15 ring-1 ring-inset ring-amber-400/60'
                                                : 'bg-amber-100/75 ring-1 ring-inset ring-amber-400'
                                              : isOverlapCell
                                              ? 'bg-rose-500/20 ring-1 ring-inset ring-rose-400'
                                              : colBgCls
                                          }`}
                                        >
                                          {renderCodeBadge(
                                            code,
                                            'xs',
                                            code ? d : undefined
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ==================== Sonner 스타일 플로팅 토스트 (Undo 지원) ==================== */}
        {notice && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-70 w-[92vw] max-w-md pointer-events-auto schedule-sheet-enter">
            <div
              className={`rounded-2xl px-4 py-3 shadow-2xl border flex items-center justify-between gap-3 text-xs font-black ${
                notice.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : isDark
                  ? 'bg-[#1E2738] text-slate-100 border-sky-400/35'
                  : 'bg-[#18181B] text-white border-stone-700'
              }`}
            >
              <span className="leading-snug">{notice.text}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {notice.canUndo && undoStack.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black cursor-pointer"
                  >
                    ↩ 되돌리기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== Vaul 스타일 반응형 바텀시트(모바일) / 센터 시트(PC) 셀 편집기 ==================== */}
      {editingCell && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setEditingCell(null);
            setIsEditingRoleInSheet(false);
          }}
        >
          <div
            className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 shadow-2xl space-y-4 schedule-sheet-enter ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모바일 드래그 핸들 바 */}
            <div className="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto sm:hidden" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black">
                    {editingCell.empName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${subtleBg}`}
                  >
                    {editingCell.empRole}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingRoleInSheet((v) => !v)}
                    className={`text-[11px] font-bold inline-flex items-center gap-0.5 cursor-pointer ${mutedText}`}
                  >
                    <Edit3 className="w-3 h-3" /> 담당변경
                  </button>
                </div>
                <p className={`text-xs font-bold mt-1 ${mutedText}`}>
                  {currentYear}년 {currentMonth}월 {editingCell.day}일 (
                  {
                    WEEKDAY_KO[
                      new Date(
                        currentYear,
                        currentMonth - 1,
                        editingCell.day
                      ).getDay()
                    ]
                  }
                  요일) 근태 상태 선택
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingCell(null);
                  setIsEditingRoleInSheet(false);
                }}
                className={`p-1.5 rounded-xl border cursor-pointer ${subtleBg}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 담당(코너) 인라인 수정창 */}
            {isEditingRoleInSheet && (
              <div className={`p-3 rounded-2xl border flex items-center gap-2 ${subtleBg}`}>
                <input
                  type="text"
                  value={roleDraftInSheet}
                  onChange={(e) => setRoleDraftInSheet(e.target.value)}
                  placeholder="담당 입력 (예: 대형, 생활, 쿠쿠, 모바일)"
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-base sm:text-xs font-black ${cardBg}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateEmployeeRole(
                      editingCell.empName,
                      roleDraftInSheet
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  저장
                </button>
              </div>
            )}

            {/* 같은 코너 동료 근무 현황 실시간 가이드 */}
            {editingCellPeerInfo && (
              <div
                className={`rounded-2xl border p-3 text-xs space-y-1 ${
                  editingCellPeerInfo.workingPeers.length === 0
                    ? isDark
                      ? 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                    : subtleBg
                }`}
              >
                <div className="font-black flex items-center justify-between">
                  <span>
                    같은 [{editingCellPeerInfo.cornerGroup}] 코너 근무 동료
                  </span>
                  <span className="font-mono">
                    {editingCellPeerInfo.workingPeers.length}명 근무
                  </span>
                </div>
                <div className={mutedText}>
                  {editingCellPeerInfo.workingPeers.length > 0
                    ? editingCellPeerInfo.workingPeers
                        .map((p) => `${p.name}(${p.role})`)
                        .join(', ')
                    : '⚠️ 이 직원이 쉬면 해당 코너 근무자가 0명이 됩니다!'}
                </div>
              </div>
            )}

            {/* 2x4 근태 상태 선택 그리드 */}
            <div className="grid grid-cols-2 gap-2">
              {DAY_CODE_OPTIONS.map((opt) => {
                const selected = editingCell.currentCode === opt.value;
                return (
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
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-0.5 cursor-pointer schedule-tactile ${
                      selected
                        ? `ring-2 ${opt.activeRing} ${
                            isDark ? 'bg-white/10 border-white/30' : 'bg-[#FAF5EC] border-[#8C5A32]'
                          }`
                        : subtleBg
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-black border ${opt.chipCls}`}
                      >
                        {opt.shortLabel}
                      </span>
                      {selected && <Check className="w-4 h-4 text-amber-500" />}
                    </div>
                    <span className="text-xs font-black mt-1">{opt.label}</span>
                    <span className={`text-[10px] font-medium ${mutedText}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 하단 부가 액션 (동료 비교 담기 / 직원 줄 삭제) */}
            <div className={`pt-2 border-t flex items-center justify-between gap-2 ${isDark ? "border-white/10" : "border-[#E4DFD5]"}`}>
              <button
                type="button"
                onClick={() => {
                  toggleCompareEmployee(editingCell.empName);
                  setIsSwapPanelOpen(true);
                  setEditingCell(null);
                  if (activeView === 'today' || activeView === 'calendar') {
                    setActiveView('full');
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${subtleBg}`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500" />
                <span>맞교대 비교 대상에 담기</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteEmployeeRow(editingCell.empName)}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-500 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>직원 줄 삭제</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 신규 직원 추가 모달 ==================== */}
      {isAddStaffOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddStaffOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl space-y-4 schedule-sheet-enter ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>{currentMonth}월 신규 직원 행 추가</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className={`p-1 rounded-lg cursor-pointer ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black mb-1">성명</label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="예: 홍길동"
                  className={`w-full px-3.5 py-2 rounded-xl border text-base sm:text-xs font-black ${subtleBg}`}
                />
              </div>
              <div>
                <label className="block text-xs font-black mb-1">담당 코너/직책</label>
                <input
                  type="text"
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="예: 대형, 생활, 주방, 쿠쿠, 모바일, 점장"
                  className={`w-full px-3.5 py-2 rounded-xl border text-base sm:text-xs font-black ${subtleBg}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer ${subtleBg}`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddStaffMember}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
              >
                명단에 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 저장된 휴무표 삭제 / 관리 모달 ==================== */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden schedule-sheet-enter ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${headerBg}`}
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-base">저장된 휴무표 관리 및 삭제</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className={`p-1 rounded-lg cursor-pointer ${mutedText}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className={`p-4 rounded-2xl border space-y-2.5 ${subtleBg}`}>
                <div className={`text-xs font-bold ${mutedText}`}>
                  현재 조회 중인 월 ({currentYearMonth.replace('-', '.')})
                </div>
                <button
                  type="button"
                  disabled={!schedules[currentYearMonth]}
                  onClick={() => handleDeleteMonth(currentYearMonth)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 disabled:opacity-40 text-xs font-black cursor-pointer transition-colors"
                >
                  현재 보고 있는 {currentYear}년 {currentMonth}월 휴무표 삭제
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-black flex items-center justify-between">
                  <span>저장된 월별 목록 ({savedYearMonths.length}개)</span>
                  <span className={`text-[11px] font-normal ${mutedText}`}>
                    개별 삭제 가능
                  </span>
                </div>
                {savedYearMonths.length === 0 ? (
                  <div className={`text-xs text-center py-4 rounded-xl ${subtleBg} ${mutedText}`}>
                    저장된 휴무표가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {savedYearMonths.map((ym) => (
                      <div
                        key={ym}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${subtleBg}`}
                      >
                        <div className="font-black flex items-center gap-2 font-mono">
                          <span>📅 {ym.replace('-', '.')}</span>
                          <span className={`text-[11px] font-sans font-medium ${mutedText}`}>
                            ({schedules[ym]?.employees?.length || 0}명 등록)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMonth(ym)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-500 text-xs font-bold cursor-pointer transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`pt-3 border-t ${isDark ? "border-white/10" : "border-[#E4DFD5]"}`}>
                <button
                  type="button"
                  onClick={handleDeleteAllSchedules}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow-xs"
                >
                  저장된 전체 휴무표 초기화
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
