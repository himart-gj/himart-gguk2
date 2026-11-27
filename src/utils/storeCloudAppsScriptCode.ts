import {
  extractGoogleSheetId,
  loadSavedInstaSpreadsheetId,
  loadSavedSpreadsheetId,
} from './storeCloudSync';

export function getStoreCloudAppsScriptCode(
  defaultSpreadsheetId?: string,
  defaultInstaSpreadsheetId?: string
): string {
  const bakedSheetId = extractGoogleSheetId(
    defaultSpreadsheetId ?? loadSavedSpreadsheetId()
  );
  const bakedInstaSheetId = extractGoogleSheetId(
    defaultInstaSpreadsheetId ?? loadSavedInstaSpreadsheetId()
  );
  return `// ============================================================================
// [하이마트 스마트 상담앱 — 비공개 구글 시트 1-STOP 클라우드 · 초대 · 휴무공유 · 다중기기CRM 통합 브릿지]
// - 4대 매장 공유 자료 + 초대직원 AI공유/휴무표공유 ON/OFF + 개인별 코드 다중기기 CRM 동기화 + 인스타 DB 통합 지원
// ============================================================================
const DEFAULT_SPREADSHEET_ID = '${bakedSheetId}';
const DEFAULT_INSTA_SPREADSHEET_ID = '${bakedInstaSheetId}';

const TAB_MAP = {
  schedule: '_매장공유_휴무표',
  incentive: '_매장공유_수당단가표',
  care: '_매장공유_안심케어',
  installment: '_매장공유_무이자할부'
};
const FRIEND_ACCESS_TAB = '_친구기기_접근관리';
const USER_CRM_CLOUD_TAB = '_개인별_CRM클라우드';
const GUIDE_TAB = '00_연동가이드_및_AppsScript코드';
const BACKUP_SHEET_NAME = '_앱DB관리백업';
const CHUNK_SIZE = 40000;

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowKstLabel() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function formatCellDate(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val).trim();
}

function normalizePinValue(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  return String(raw).replace(/\\.0+$/, '').trim();
}

function normalizeInviteDigits(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && isFinite(raw)) {
    const intStr = String(Math.trunc(Math.abs(raw)));
    return intStr.length < 8 ? ('00000000' + intStr).slice(-8) : intStr;
  }
  const digits = String(raw).replace(/\\D+/g, '').trim();
  return digits;
}

function extractSheetId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]{20,})/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s) && s.indexOf('http') === -1 && s.indexOf('/') === -1) {
    return s;
  }
  return '';
}

function resolveSpreadsheetContext(reqSheetId, allowPersist) {
  const props = PropertiesService.getScriptProperties();
  const incomingId = extractSheetId(reqSheetId);
  if (incomingId) {
    try {
      const opened = SpreadsheetApp.openById(incomingId);
      if (opened) {
        if (allowPersist === true) {
          props.setProperty('TARGET_SPREADSHEET_ID', incomingId);
        }
        return { ss: opened, mode: 'standalone_id' };
      }
    } catch (err) {
      return {
        ss: null,
        mode: 'error',
        error: '입력하신 구글 시트 주소(ID)에 접근할 수 없습니다: ' + String(err)
      };
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      return { ss: active, mode: 'container' };
    }
  } catch (e) {}

  const savedId = extractSheetId(props.getProperty('TARGET_SPREADSHEET_ID')) || extractSheetId(DEFAULT_SPREADSHEET_ID);
  if (savedId) {
    try {
      const openedSaved = SpreadsheetApp.openById(savedId);
      if (openedSaved) {
        if (allowPersist === true) {
          props.setProperty('TARGET_SPREADSHEET_ID', savedId);
        }
        return { ss: openedSaved, mode: 'standalone_id' };
      }
    } catch (err) {
      return {
        ss: null,
        mode: 'error',
        error: '저장된 구글 시트 ID(' + savedId + ')를 열 수 없습니다: ' + String(err)
      };
    }
  }

  return {
    ss: null,
    mode: 'missing',
    error: '연동할 비공개 구글 시트 주소를 입력해 주세요.'
  };
}

function resolveInstaSpreadsheet(reqInstaSheetId, allowPersist) {
  const props = PropertiesService.getScriptProperties();
  const incomingId = extractSheetId(reqInstaSheetId);
  if (incomingId) {
    try {
      const opened = SpreadsheetApp.openById(incomingId);
      if (opened) {
        if (allowPersist === true) {
          props.setProperty('INSTA_SPREADSHEET_ID', incomingId);
        }
        return opened;
      }
    } catch (e) {}
  }
  const savedInstaId = extractSheetId(props.getProperty('INSTA_SPREADSHEET_ID')) || extractSheetId(DEFAULT_INSTA_SPREADSHEET_ID);
  if (savedInstaId) {
    try {
      const openedSaved = SpreadsheetApp.openById(savedInstaId);
      if (openedSaved) return openedSaved;
    } catch (e) {}
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return null;
}

function writeInstaBackup(instaSs, backupState) {
  let sh = instaSs.getSheetByName(BACKUP_SHEET_NAME);
  if (!sh) {
    sh = instaSs.insertSheet(BACKUP_SHEET_NAME);
    sh.hideSheet();
  }
  sh.clearContents();
  const raw = JSON.stringify(backupState);
  const rows = [];
  for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
    rows.push(['CHUNK', Math.floor(i / CHUNK_SIZE) + 1, raw.slice(i, i + CHUNK_SIZE)]);
  }
  if (rows.length > 0) {
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
  }
}

function readInstaBackup(instaSs) {
  const bSh = instaSs.getSheetByName(BACKUP_SHEET_NAME);
  if (!bSh || bSh.getLastRow() < 1) return null;
  try {
    const vals = bSh.getRange(1, 1, bSh.getLastRow(), Math.min(3, bSh.getLastColumn())).getValues();
    if (vals[0][0] === 'CHUNK') {
      const joined = vals.map(function(r) { return String(r[2] || ''); }).join('');
      return joined ? JSON.parse(joined) : null;
    }
    if (vals[0][0]) {
      return JSON.parse(String(vals[0][0]));
    }
  } catch (err) {}
  return null;
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, 5).setValues([['데이터종류', '청크번호', '전체청크수', '최종업데이트', 'JSON데이터조각']]);
  }
  return sheet;
}

function ensureUserCrmSheet(ss) {
  let sheet = ss.getSheetByName(USER_CRM_CLOUD_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(USER_CRM_CLOUD_TAB);
    sheet.hideSheet();
    sheet.getRange(1, 1, 1, 5).setValues([['사용자키', '청크번호', '전체청크수', '최종업데이트', 'JSON데이터조각']]);
  }
  return sheet;
}

function readUserCrmFromSheet(ss, userKey) {
  const sheet = ensureUserCrmSheet(ss);
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const mine = rows.filter(function(r) { return String(r[0]) === userKey && r[4] !== ''; });
  if (!mine.length) return null;
  mine.sort(function(a, b) { return Number(a[1]) - Number(b[1]); });
  const joined = mine.map(function(r) { return String(r[4]); }).join('');
  try { return JSON.parse(joined); } catch (e) { return null; }
}

function writeUserCrmToSheet(ss, userKey, serializedJson) {
  const sheet = ensureUserCrmSheet(ss);
  const kept = [];
  if (sheet.getLastRow() >= 2) {
    const existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (String(existing[i][0]) !== userKey && existing[i][0] !== '') {
        kept.push(existing[i]);
      }
    }
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  }
  const chunks = [];
  for (let i = 0; i < serializedJson.length; i += CHUNK_SIZE) {
    chunks.push(serializedJson.slice(i, i + CHUNK_SIZE));
  }
  if (!chunks.length) chunks.push('{}');
  const nowIso = new Date().toISOString();
  for (let idx = 0; idx < chunks.length; idx++) {
    kept.push([userKey, idx + 1, chunks.length, nowIso, chunks[idx]]);
  }
  if (kept.length > 0) {
    sheet.getRange(2, 1, kept.length, 5).setValues(kept);
  }
  SpreadsheetApp.flush();
}

function ensureFriendAccessSheet(ss) {
  let sheet = ss.getSheetByName(FRIEND_ACCESS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(FRIEND_ACCESS_TAB);
    sheet.getRange(1, 1, 1, 10).setValues([[
      '코드ID',
      '8자리초대코드',
      '별칭',
      '상태(ACTIVE/BOUND/REVOKED)',
      '최대기기수',
      '귀속기기토큰',
      '기기정보(UA)',
      '발급일시',
      '최초귀속일시',
      '최근접속일시'
    ]]);
  }
  return sheet;
}

function readSavedAdminPin(ss) {
  const props = PropertiesService.getScriptProperties();
  let savedPin = '';
  if (ss) {
    const guide = ss.getSheetByName(GUIDE_TAB);
    if (guide) {
      savedPin = normalizePinValue(guide.getRange('B3').getValue());
      if (savedPin.indexOf('비워둠') !== -1) savedPin = '';
    }
  }
  if (!savedPin) {
    savedPin = normalizePinValue(props.getProperty('ADMIN_PIN'));
  }
  return savedPin;
}

function verifyOrInitPin(ss, inputPin) {
  const cleanInput = normalizePinValue(inputPin);
  if (!cleanInput) return { ok: false, error: '업로드 비밀번호(PIN)를 입력해 주세요.' };
  const props = PropertiesService.getScriptProperties();
  const sheetPin = ss && ss.getSheetByName(GUIDE_TAB)
    ? normalizePinValue(ss.getSheetByName(GUIDE_TAB).getRange('B3').getValue())
    : '';
  const validSheetPin = sheetPin && sheetPin.indexOf('비워둠') === -1 ? sheetPin : '';
  const propsPin = normalizePinValue(props.getProperty('ADMIN_PIN'));

  if (!validSheetPin && !propsPin) {
    props.setProperty('ADMIN_PIN', cleanInput);
    if (ss) {
      const guide = ss.getSheetByName(GUIDE_TAB);
      if (guide) guide.getRange('B3').setValue(cleanInput);
    }
    return { ok: true, initialized: true };
  }
  if ((validSheetPin && cleanInput === validSheetPin) || (!validSheetPin && propsPin && cleanInput === propsPin)) {
    if (propsPin !== cleanInput) {
      props.setProperty('ADMIN_PIN', cleanInput);
    }
    return { ok: true, initialized: false };
  }
  return { ok: false, error: '관리자 업로드 비밀번호(PIN)가 일치하지 않습니다.' };
}

function maskApiKey(rawKey) {
  const k = String(rawKey || '').trim();
  if (!k) return '';
  if (k.length <= 10) return '****';
  return k.slice(0, 6) + '••••' + k.slice(-4);
}

function readSharedGeminiConfig() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('SHARED_GEMINI_API_KEY') || '').trim();
  const globalRaw = String(props.getProperty('SHARED_GEMINI_ENABLED') || '').trim();
  const globalEnabled = globalRaw === 'true';
  let friendAiMap = {};
  try {
    const rawMap = props.getProperty('SHARED_GEMINI_FRIEND_MAP');
    if (rawMap) {
      const parsed = JSON.parse(rawMap);
      if (parsed && typeof parsed === 'object') {
        friendAiMap = parsed;
      }
    }
  } catch (e) {
    friendAiMap = {};
  }
  return {
    apiKey: apiKey,
    hasSharedKey: Boolean(apiKey),
    maskedSharedKey: maskApiKey(apiKey),
    globalEnabled: globalEnabled,
    friendAiMap: friendAiMap
  };
}

function readCareScheduleMap(ss) {
  try {
    const care = readKindDataset(ss, 'care');
    if (care && care.data && care.data.__friendScheduleMap && typeof care.data.__friendScheduleMap === 'object') {
      return care.data.__friendScheduleMap;
    }
  } catch (e) {}
  return {};
}

function toPublicSharedAiMeta(cfg) {
  return {
    hasSharedKey: cfg.hasSharedKey,
    maskedSharedKey: cfg.maskedSharedKey,
    globalEnabled: cfg.globalEnabled,
    friendAiMap: cfg.friendAiMap
  };
}

function resolveFriendSharedKeyPayload(codeId, status) {
  const cfg = readSharedGeminiConfig();
  const friendAllowed = cfg.friendAiMap[codeId] !== false;
  const active = status === 'BOUND' && cfg.hasSharedKey && cfg.globalEnabled && friendAllowed;
  return {
    aiEnabled: active,
    sharedApiKey: active ? cfg.apiKey : ''
  };
}

function parseTokenList(raw) {
  return String(raw || '')
    .split(',')
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 0; });
}

function maskDeviceToken(token) {
  const list = parseTokenList(token);
  if (!list.length) return '';
  return list
    .map(function(t) {
      if (t.length <= 12) return t;
      return t.slice(0, 6) + '...' + t.slice(-4);
    })
    .join(' / ');
}

function readAllFriendInviteRows(ss) {
  const sheet = ensureFriendAccessSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheet, records: [] };
  const colCount = Math.max(9, Math.min(10, sheet.getLastColumn() || 10));
  const values = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  const records = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const codeId = String(r[0] || '').trim();
    const inviteCode = normalizeInviteDigits(r[1]);
    if (!codeId && !inviteCode) continue;
    const isLegacyNineCol = colCount === 9 && (!r[9] && String(r[8] || '').indexOf('Mozilla') !== -1);
    records.push({
      rowNumber: i + 2,
      codeId: codeId,
      inviteCode: inviteCode,
      label: String(r[2] || '친구1').trim(),
      status: String(r[3] || 'ACTIVE').trim().toUpperCase(),
      maxDevices: Math.max(1, Number(r[4]) || 1),
      boundDeviceToken: String(r[5] || '').trim(),
      boundUserAgent: isLegacyNineCol ? String(r[8] || '').trim() : String(r[6] || '').trim(),
      createdAt: isLegacyNineCol ? formatCellDate(r[6]) : formatCellDate(r[7]),
      boundAt: isLegacyNineCol ? formatCellDate(r[6]) : formatCellDate(r[8]),
      lastSeenAt: isLegacyNineCol ? formatCellDate(r[7]) : formatCellDate(r[9])
    });
  }
  return { sheet: sheet, records: records };
}

function toClientFriendItem(rec, friendAiMap, scheduleMap) {
  const tokens = parseTokenList(rec.boundDeviceToken);
  const mapObj = friendAiMap || {};
  const schedObj = scheduleMap || {};
  return {
    codeId: rec.codeId,
    inviteCode: rec.inviteCode,
    label: rec.label,
    status: rec.status,
    maxDevices: rec.maxDevices,
    boundDeviceCount: tokens.length,
    boundDevicePreview: maskDeviceToken(rec.boundDeviceToken),
    boundUserAgent: rec.boundUserAgent,
    aiAllowed: mapObj[rec.codeId] !== false,
    scheduleAllowed: schedObj[rec.codeId] === true,
    createdAt: rec.createdAt,
    boundAt: rec.boundAt,
    lastSeenAt: rec.lastSeenAt
  };
}

function readKindDataset(ss, kind) {
  const tabName = TAB_MAP[kind];
  if (!tabName) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const validRows = rows.filter(function(r) { return String(r[0]) === kind && r[4] !== ''; });
  if (!validRows.length) return { updatedAt: '', chunks: 0, bytes: 0, data: null };
  validRows.sort(function(a, b) { return Number(a[1]) - Number(b[1]); });
  const updatedAt = formatCellDate(validRows[0][3]);
  const joined = validRows.map(function(r) { return String(r[4]); }).join('');
  try {
    return {
      updatedAt: updatedAt,
      chunks: validRows.length,
      bytes: joined.length,
      data: JSON.parse(joined)
    };
  } catch (err) {
    return {
      updatedAt: updatedAt,
      chunks: validRows.length,
      bytes: joined.length,
      data: null,
      parseError: String(err)
    };
  }
}

function countDatasetItems(kind, data) {
  if (!data || typeof data !== 'object') return 0;
  if (kind === 'care' && Array.isArray(data.items)) return data.items.length;
  if (kind === 'installment' && Array.isArray(data.columns)) return data.columns.length;
  return Object.keys(data).length;
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : 'ping';
  if (action === 'syncLeads') {
    return jsonResponse({ ok: false, error: '보안 정책상 고객 DB는 관리자 PIN이 포함된 POST 요청으로만 조회할 수 있습니다.' });
  }
  const sidParam = (e && e.parameter && e.parameter.sid) ? String(e.parameter.sid).trim() : '';
  const ctx = resolveSpreadsheetContext(sidParam, false);
  if (!ctx.ss) {
    return jsonResponse({ ok: false, needsSpreadsheetId: true, error: ctx.error });
  }
  const ss = ctx.ss;
  const role = (e && e.parameter && e.parameter.role) ? String(e.parameter.role).trim() : '';
  const dt = (e && e.parameter && e.parameter.dt) ? String(e.parameter.dt).trim() : '';

  if (action === 'getDataset') {
    const kind = String((e.parameter && e.parameter.kind) || '').trim();
    if (!TAB_MAP[kind]) return jsonResponse({ ok: false, error: '지원하지 않는 kind입니다: ' + kind });

    if (role === 'friend') {
      const friendStore = readAllFriendInviteRows(ss);
      const matched = friendStore.records.find(function(rec) {
        const tokens = parseTokenList(rec.boundDeviceToken);
        return dt && tokens.indexOf(dt) !== -1;
      });
      if (!matched || matched.status !== 'BOUND') {
        return jsonResponse({ ok: false, revoked: true, valid: false, error: '접근 권한이 차단되었거나 만료된 기기입니다.' });
      }
      if (kind === 'schedule') {
        const schedMap = readCareScheduleMap(ss);
        if (schedMap[matched.codeId] !== true) {
          return jsonResponse({ ok: false, forbidden: true, error: '휴무표 공유가 비활성화된 계정입니다.', data: {} });
        }
      }
    }

    const result = readKindDataset(ss, kind);
    return jsonResponse({ ok: true, kind: kind, updatedAt: result.updatedAt, data: result.data });
  }
  if (action === 'getAll') {
    if (role === 'friend') {
      return jsonResponse({ ok: false, forbidden: true, error: '허용되지 않는 요청입니다.' });
    }
    const datasets = {};
    Object.keys(TAB_MAP).forEach(function(k) {
      datasets[k] = readKindDataset(ss, k);
    });
    return jsonResponse({ ok: true, datasets: datasets });
  }
  return jsonResponse({
    ok: true,
    status: 'connected',
    store: '롯데하이마트',
    bindingMode: ctx.mode
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = String(body.action || 'saveDataset');
    const reqSid = body.spreadsheetId ? String(body.spreadsheetId).trim() : '';

    const ctx = resolveSpreadsheetContext(reqSid, false);

    if (action === 'syncLeads' || action === 'saveBackupState') {
      const instaSs = resolveInstaSpreadsheet(body.instaSpreadsheetId || '', false);
      const pinCheckTarget = ctx.ss || instaSs;
      const pinCheck = verifyOrInitPin(pinCheckTarget, body.pin);
      if (!pinCheck.ok) {
        Utilities.sleep(300);
        return jsonResponse({ ok: false, error: pinCheck.error });
      }
      if (body.instaSpreadsheetId) {
        resolveInstaSpreadsheet(body.instaSpreadsheetId, true);
      }
      const finalInstaSs = instaSs || ctx.ss;
      if (!finalInstaSs) {
        return jsonResponse({ ok: false, error: '연결된 인스타 고객 DB 구글 시트를 찾을 수 없습니다.' });
      }
      if (action === 'saveBackupState') {
        if (body.backupState) {
          writeInstaBackup(finalInstaSs, body.backupState);
        }
        return jsonResponse({ ok: true });
      }
      const sheets = finalInstaSs.getSheets();
      const outSheets = [];
      for (let i = 0; i < sheets.length; i++) {
        const sh = sheets[i];
        const name = sh.getName();
        if (name === BACKUP_SHEET_NAME || name === FRIEND_ACCESS_TAB || name === GUIDE_TAB || name.indexOf('_') === 0) continue;
        if (sh.getLastRow() < 2 || sh.getLastColumn() < 2) continue;
        outSheets.push({ name: name, rows: sh.getDisplayValues() });
      }
      const backupState = readInstaBackup(finalInstaSs);
      return jsonResponse({ ok: true, sheets: outSheets, backupState: backupState });
    }

    if (!ctx.ss) {
      return jsonResponse({ ok: false, needsSpreadsheetId: true, error: ctx.error });
    }
    const ss = ctx.ss;

    if (action === 'pullUserCrm' || action === 'pushUserCrm') {
      const role = String(body.role || 'staff').trim();
      let userKey = '';
      if (role === 'friend') {
        const dt = String(body.deviceToken || '').trim();
        const codeId = String(body.codeId || '').trim();
        const invCode = normalizeInviteDigits(body.inviteCode || '');
        const fStore = readAllFriendInviteRows(ss);
        const matched = fStore.records.find(function(r) {
          if (r.status === 'REVOKED') return false;
          if (invCode && r.inviteCode === invCode) return true;
          if (codeId && r.codeId === codeId && parseTokenList(r.boundDeviceToken).indexOf(dt) !== -1) return true;
          return false;
        });
        if (!matched) return jsonResponse({ ok: false, error: '인증되지 않은 초대 코드 기기입니다.' });
        userKey = 'FRIEND_' + matched.codeId;
      } else {
        const pCheck = verifyOrInitPin(ss, body.pin);
        if (!pCheck.ok) return jsonResponse({ ok: false, error: pCheck.error });
        userKey = 'STAFF_OWNER';
      }
      if (action === 'pullUserCrm') {
        return jsonResponse({ ok: true, data: readUserCrmFromSheet(ss, userKey) });
      }
      const serializedCrm = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.data || {});
      writeUserCrmToSheet(ss, userKey, serializedCrm);
      return jsonResponse({ ok: true, updatedAt: new Date().toISOString() });
    }

    if (action === 'diagnoseCloudSync') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const friendStore = readAllFriendInviteRows(ss);
      const boundCount = friendStore.records.filter(function(r) { return r.status === 'BOUND'; }).length;
      const sharedCfg = readSharedGeminiConfig();
      const datasets = {};
      Object.keys(TAB_MAP).forEach(function(k) {
        const res = readKindDataset(ss, k);
        const exists = res.data !== null && res.data !== undefined;
        datasets[k] = {
          exists: exists,
          updatedAt: res.updatedAt || '',
          chunks: res.chunks || 0,
          bytes: res.bytes || 0,
          validJson: !res.parseError,
          itemCount: exists ? countDatasetItems(k, res.data) : 0
        };
      });
      return jsonResponse({
        ok: true,
        bindingMode: ctx.mode,
        spreadsheetId: ss.getId(),
        spreadsheetTitle: ss.getName(),
        inviteCount: friendStore.records.length,
        boundInviteCount: boundCount,
        sharedAi: toPublicSharedAiMeta(sharedCfg),
        datasets: datasets
      });
    }

    if (action === 'saveSharedGeminiConfig') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const props = PropertiesService.getScriptProperties();
      const current = readSharedGeminiConfig();

      if (body.clearKey === true) {
        props.deleteProperty('SHARED_GEMINI_API_KEY');
        props.setProperty('SHARED_GEMINI_ENABLED', 'false');
      } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
        props.setProperty('SHARED_GEMINI_API_KEY', body.apiKey.trim());
      }

      if (typeof body.globalEnabled === 'boolean' && body.clearKey !== true) {
        props.setProperty('SHARED_GEMINI_ENABLED', body.globalEnabled ? 'true' : 'false');
      }

      if (body.friendCodeId && typeof body.friendAiAllowed === 'boolean') {
        const nextMap = current.friendAiMap || {};
        nextMap[String(body.friendCodeId).trim()] = body.friendAiAllowed;
        props.setProperty('SHARED_GEMINI_FRIEND_MAP', JSON.stringify(nextMap));
      }

      const updatedCfg = readSharedGeminiConfig();
      const schedMap = readCareScheduleMap(ss);
      const store = readAllFriendInviteRows(ss);
      return jsonResponse({
        ok: true,
        sharedAi: toPublicSharedAiMeta(updatedCfg),
        items: store.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, updatedCfg.friendAiMap, schedMap);
        })
      });
    }

    if (action === 'getFriendSharedGeminiKey') {
      const deviceToken = String(body.deviceToken || '').trim();
      const codeId = String(body.codeId || '').trim();
      if (!deviceToken) {
        return jsonResponse({ ok: true, aiEnabled: false, sharedApiKey: '', revoked: true });
      }
      const store = readAllFriendInviteRows(ss);
      const matched = store.records.find(function(r) {
        if (codeId && r.codeId === codeId) return true;
        return parseTokenList(r.boundDeviceToken).indexOf(deviceToken) !== -1;
      });
      if (!matched || matched.status !== 'BOUND' || parseTokenList(matched.boundDeviceToken).indexOf(deviceToken) === -1) {
        return jsonResponse({ ok: true, aiEnabled: false, sharedApiKey: '', revoked: true });
      }
      const resolved = resolveFriendSharedKeyPayload(matched.codeId, matched.status);
      return jsonResponse({
        ok: true,
        aiEnabled: resolved.aiEnabled,
        sharedApiKey: resolved.sharedApiKey,
        revoked: false
      });
    }

    if (action === 'authenticateDevice') {
      const credential = String(body.credential || '').replace(/[\\s-]+/g, '').trim();
      const deviceToken = String(body.deviceToken || '').trim();
      const userAgent = String(body.userAgent || '').slice(0, 180);
      if (!credential) {
        return jsonResponse({ ok: false, error: '보안 코드 또는 8자리 초대코드를 입력해 주세요.' });
      }
      const savedPin = readSavedAdminPin(ss);
      if (savedPin && credential === savedPin) {
        return jsonResponse({ ok: true, role: 'staff' });
      }

      const store = readAllFriendInviteRows(ss);
      const found = store.records.find(function(r) {
        return r.inviteCode === credential;
      });
      if (!found) {
        return jsonResponse({ ok: false, error: '보안 코드가 일치하지 않습니다. 전달받은 8자리 코드를 확인해 주세요.' });
      }
      if (found.status === 'REVOKED') {
        return jsonResponse({ ok: false, revoked: true, error: '관리자에 의해 접근이 차단된 초대 코드입니다.' });
      }
      if (!deviceToken || deviceToken.length < 16) {
        return jsonResponse({ ok: false, error: '기기 고유 식별 토큰을 확인할 수 없습니다.' });
      }

      const nowStr = nowKstLabel();
      const boundTokens = parseTokenList(found.boundDeviceToken);
      const schedMap = readCareScheduleMap(ss);

      if (boundTokens.indexOf(deviceToken) !== -1) {
        store.sheet.getRange(found.rowNumber, 4).setValue('BOUND');
        store.sheet.getRange(found.rowNumber, 10).setValue("'" + nowStr);
        SpreadsheetApp.flush();
        const aiPayload = resolveFriendSharedKeyPayload(found.codeId, 'BOUND');
        return jsonResponse({
          ok: true,
          role: 'friend',
          codeId: found.codeId,
          label: found.label,
          verifiedAt: new Date().toISOString(),
          aiEnabled: aiPayload.aiEnabled,
          sharedApiKey: aiPayload.sharedApiKey,
          scheduleAllowed: schedMap[found.codeId] === true
        });
      }

      if (boundTokens.length < found.maxDevices) {
        const nextTokens = boundTokens.concat([deviceToken]).join(',');
        const nextUa = [found.boundUserAgent, userAgent]
          .filter(function(s) { return Boolean(String(s || '').trim()); })
          .join(' | ')
          .slice(0, 380);
        store.sheet.getRange(found.rowNumber, 4, 1, 7).setValues([[
          'BOUND',
          found.maxDevices,
          nextTokens,
          nextUa,
          "'" + (found.createdAt || nowStr),
          "'" + (found.boundAt || nowStr),
          "'" + nowStr
        ]]);
        SpreadsheetApp.flush();
        const aiPayload = resolveFriendSharedKeyPayload(found.codeId, 'BOUND');
        return jsonResponse({
          ok: true,
          role: 'friend',
          codeId: found.codeId,
          label: found.label,
          verifiedAt: new Date().toISOString(),
          aiEnabled: aiPayload.aiEnabled,
          sharedApiKey: aiPayload.sharedApiKey,
          scheduleAllowed: schedMap[found.codeId] === true
        });
      }

      return jsonResponse({
        ok: false,
        codeAlreadyUsed: true,
        error: '허용된 기기 대수(' + found.maxDevices + '대)가 모두 등록된 코드입니다. 추가 기기 등록이 필요하면 관리자에게 허용 기기수 변경을 요청해 주세요.'
      });
    }

    if (action === 'verifyFriendSession') {
      const deviceToken = String(body.deviceToken || '').trim();
      const codeId = String(body.codeId || '').trim();
      if (!deviceToken) {
        return jsonResponse({ ok: true, valid: false, revoked: true });
      }
      const store = readAllFriendInviteRows(ss);
      const matched = store.records.find(function(r) {
        if (codeId && r.codeId === codeId) return true;
        return parseTokenList(r.boundDeviceToken).indexOf(deviceToken) !== -1;
      });
      if (!matched || matched.status !== 'BOUND' || parseTokenList(matched.boundDeviceToken).indexOf(deviceToken) === -1) {
        return jsonResponse({ ok: true, valid: false, revoked: true });
      }
      const nowStr = nowKstLabel();
      if (!matched.lastSeenAt || matched.lastSeenAt.slice(0, 15) !== nowStr.slice(0, 15)) {
        store.sheet.getRange(matched.rowNumber, 10).setValue("'" + nowStr);
        SpreadsheetApp.flush();
      }
      const aiPayload = resolveFriendSharedKeyPayload(matched.codeId, matched.status);
      const schedMap = readCareScheduleMap(ss);
      return jsonResponse({
        ok: true,
        valid: true,
        revoked: false,
        codeId: matched.codeId,
        label: matched.label,
        aiEnabled: aiPayload.aiEnabled,
        sharedApiKey: aiPayload.sharedApiKey,
        scheduleAllowed: schedMap[matched.codeId] === true
      });
    }

    if (action === 'listFriendInvites') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const sharedCfg = readSharedGeminiConfig();
      const schedMap = readCareScheduleMap(ss);
      const store = readAllFriendInviteRows(ss);
      const items = store.records.slice().reverse().map(function(r) {
        return toClientFriendItem(r, sharedCfg.friendAiMap, schedMap);
      });
      return jsonResponse({
        ok: true,
        items: items,
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action === 'issueFriendInvite') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const label = String(body.label || '').trim() || '친구1';
      const maxDevices = Math.max(1, Math.min(5, Math.floor(Number(body.maxDevices) || 3)));
      const savedPin = readSavedAdminPin(ss);
      const sharedCfg = readSharedGeminiConfig();
      const schedMap = readCareScheduleMap(ss);
      const store = readAllFriendInviteRows(ss);
      const existingCodes = {};
      store.records.forEach(function(r) { existingCodes[r.inviteCode] = true; });
      let inviteCode = '';
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = String(Math.floor(10000000 + Math.random() * 90000000));
        if (!existingCodes[candidate] && candidate !== savedPin) {
          inviteCode = candidate;
          break;
        }
      }
      if (!inviteCode) {
        return jsonResponse({ ok: false, error: '초대코드 생성에 실패했습니다. 다시 시도해 주세요.' });
      }
      const codeId = 'INV-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      const nowStr = nowKstLabel();
      store.sheet.appendRow([codeId, "'" + inviteCode, label, 'ACTIVE', maxDevices, '', '', "'" + nowStr, '', '']);
      SpreadsheetApp.flush();
      const updated = readAllFriendInviteRows(ss);
      const createdRec = updated.records.find(function(r) { return r.codeId === codeId; });
      return jsonResponse({
        ok: true,
        item: createdRec ? toClientFriendItem(createdRec, sharedCfg.friendAiMap, schedMap) : {
          codeId: codeId,
          inviteCode: inviteCode,
          label: label,
          status: 'ACTIVE',
          maxDevices: maxDevices,
          boundDeviceCount: 0,
          aiAllowed: true,
          scheduleAllowed: false,
          createdAt: nowStr,
          boundAt: '',
          lastSeenAt: ''
        },
        items: updated.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, sharedCfg.friendAiMap, schedMap);
        }),
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action === 'updateFriendInviteStatus') {
      const pinCheck = verifyOrInitPin(ss, body.pin);
      if (!pinCheck.ok) return jsonResponse({ ok: false, error: pinCheck.error });
      if (reqSid) resolveSpreadsheetContext(reqSid, true);
      const codeId = String(body.codeId || '').trim();
      const mode = String(body.mode || '').trim();
      const store = readAllFriendInviteRows(ss);
      const target = store.records.find(function(r) { return r.codeId === codeId; });
      if (!target) {
        return jsonResponse({ ok: false, error: '대상 초대코드를 찾을 수 없습니다.' });
      }
      if (mode === 'delete') {
        store.sheet.deleteRow(target.rowNumber);
      } else if (mode === 'revoke') {
        store.sheet.getRange(target.rowNumber, 4).setValue('REVOKED');
      } else if (mode === 'reset_device') {
        store.sheet.getRange(target.rowNumber, 4).setValue('ACTIVE');
        store.sheet.getRange(target.rowNumber, 6, 1, 2).setValues([['', '']]);
        store.sheet.getRange(target.rowNumber, 9, 1, 2).setValues([['', '']]);
      } else if (mode === 'activate') {
        const nextStatus = parseTokenList(target.boundDeviceToken).length > 0 ? 'BOUND' : 'ACTIVE';
        store.sheet.getRange(target.rowNumber, 4).setValue(nextStatus);
      } else if (mode === 'set_max_devices') {
        const nextMax = Math.max(1, Math.min(5, Math.floor(Number(body.maxDevices) || 3)));
        store.sheet.getRange(target.rowNumber, 5).setValue(nextMax);
      } else {
        return jsonResponse({ ok: false, error: '지원하지 않는 상태 변경 모드입니다: ' + mode });
      }
      SpreadsheetApp.flush();
      const sharedCfg = readSharedGeminiConfig();
      const schedMap = readCareScheduleMap(ss);
      const updated = readAllFriendInviteRows(ss);
      return jsonResponse({
        ok: true,
        items: updated.records.slice().reverse().map(function(r) {
          return toClientFriendItem(r, sharedCfg.friendAiMap, schedMap);
        }),
        sharedAi: toPublicSharedAiMeta(sharedCfg)
      });
    }

    if (action !== 'saveDataset') {
      return jsonResponse({ ok: false, error: '지원하지 않는 action입니다: ' + action });
    }
    const kind = String(body.kind || '').trim();
    if (!TAB_MAP[kind]) {
      return jsonResponse({ ok: false, error: '지원하지 않는 데이터 종류입니다: ' + kind });
    }
    const pinCheck = verifyOrInitPin(ss, body.pin);
    if (!pinCheck.ok) {
      return jsonResponse({ ok: false, error: pinCheck.error });
    }
    if (reqSid) resolveSpreadsheetContext(reqSid, true);
    const serialized = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.data || {});
    const chunks = [];
    for (let i = 0; i < serialized.length; i += CHUNK_SIZE) {
      chunks.push(serialized.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('{}');
    const nowIso = new Date().toISOString();
    const sheet = ensureSheet(ss, TAB_MAP[kind]);
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
    }
    const rows = chunks.map(function(chunk, idx) {
      return [kind, idx + 1, chunks.length, nowIso, chunk];
    });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    SpreadsheetApp.flush();
    return jsonResponse({
      ok: true,
      kind: kind,
      chunks: chunks.length,
      bytes: serialized.length,
      updatedAt: nowIso,
      pinInitialized: pinCheck.initialized
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}`;
}
