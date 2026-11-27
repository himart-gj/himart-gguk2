import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function himartScheduleFriendAccessPlugin(): Plugin {
  return {
    name: 'himart-schedule-friend-access',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/components/ScheduleModal.tsx')) {
        return null;
      }
      let next = code.replace(
        "import { isFriendRestrictedMode } from '../utils/friendAccessGuard';",
        "import { canAccessStoreSchedule, isFriendRestrictedMode } from '../utils/friendAccessGuard';"
      );
      next = next.replace(
        'export function loadAllSchedules(): SchedulesMap {\n  if (isFriendRestrictedMode()) return {};',
        'export function loadAllSchedules(): SchedulesMap {\n  if (!canAccessStoreSchedule()) return {};'
      );
      next = next.replace(
        'export function saveAllSchedules(map: SchedulesMap): void {\n  if (isFriendRestrictedMode()) return;',
        'export function saveAllSchedules(map: SchedulesMap): void {\n  if (!canAccessStoreSchedule()) return;'
      );
      next = next.replace(
        'export async function fetchRemoteSchedules(): Promise<SchedulesMap | null> {\n  if (isFriendRestrictedMode()) return null;',
        'export async function fetchRemoteSchedules(): Promise<SchedulesMap | null> {\n  if (!canAccessStoreSchedule()) return null;'
      );
      next = next.replace(
        '  const pushUndoAndCommit = (\n    nextSchedules: SchedulesMap,\n    toastText: string,\n    undoLabel: string\n  ) => {',
        "  const pushUndoAndCommit = (\n    nextSchedules: SchedulesMap,\n    toastText: string,\n    undoLabel: string\n  ) => {\n    if (isFriendRestrictedMode()) {\n      setNotice({ type: 'info', text: '🔒 공유받은 휴무표는 열람 전용입니다.' });\n      return;\n    }"
      );
      next = next.replace(
        '  const handleCellInteraction = (\n    emp: EmployeeMonthlySchedule,\n    dayNum: number\n  ) => {',
        '  const handleCellInteraction = (\n    emp: EmployeeMonthlySchedule,\n    dayNum: number\n  ) => {\n    if (isFriendRestrictedMode()) return;'
      );
      next = next.replace(
        "{(activeView === 'full' || activeView === 'week') && (",
        "{(activeView === 'full' || activeView === 'week') && !isFriendRestrictedMode() && ("
      );
      return { code: next, map: null };
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    build: {
      sourcemap: false,
    },
    plugins: [himartScheduleFriendAccessPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
