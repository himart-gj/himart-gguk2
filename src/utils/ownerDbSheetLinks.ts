export interface OwnerReservationDbSheetSpec {
  id: string;
  title: string;
  sub: string;
  badge: string;
  url: string;
}

const XOR_MASK = 0x5a;

const ENCODED_DB_PARENT_FOLDER: readonly number[] = [
  50, 46, 46, 42, 41, 96, 117, 117, 62, 40, 51, 44, 63, 116, 61, 53, 53, 61, 54,
  63, 116, 57, 53, 55, 117, 62, 40, 51, 44, 63, 117, 60, 53, 54, 62, 63, 40, 41,
  117, 107, 12, 49, 48, 30, 28, 99, 98, 105, 57, 15, 55, 23, 34, 57, 18, 29,
  110, 53, 30, 14, 30, 34, 8, 9, 98, 15, 48, 29, 9, 25, 107, 20,
];

const ENCODED_SHEET_INSTA: readonly number[] = [
  50, 46, 46, 42, 41, 96, 117, 117, 62, 53, 57, 41, 116, 61, 53, 53, 61, 54, 63,
  116, 57, 53, 55, 117, 41, 42, 40, 63, 59, 62, 41, 50, 63, 63, 46, 41, 117, 62,
  117, 107, 12, 51, 0, 41, 10, 105, 15, 3, 34, 45, 9, 14, 27, 15, 16, 61, 47,
  99, 40, 50, 31, 59, 56, 57, 56, 22, 16, 111, 110, 32, 31, 19, 106, 109, 63,
  35, 53, 13, 2, 14, 56, 24, 49, 117, 63, 62, 51, 46, 101, 47, 41, 42, 103, 62,
  40, 51, 44, 63, 41, 62, 49,
];

const ENCODED_SHEET_SUBSCRIPTION: readonly number[] = [
  50, 46, 46, 42, 41, 96, 117, 117, 62, 53, 57, 41, 116, 61, 53, 53, 61, 54, 63,
  116, 57, 53, 55, 117, 41, 42, 40, 63, 59, 62, 41, 50, 63, 63, 46, 41, 117, 62,
  117, 107, 61, 50, 41, 98, 110, 41, 48, 53, 107, 109, 10, 21, 22, 17, 119, 109,
  98, 21, 35, 35, 5, 11, 18, 99, 50, 16, 60, 63, 3, 18, 2, 29, 21, 41, 60, 31,
  107, 34, 108, 12, 22, 111, 45, 117, 63, 62, 51, 46, 101, 47, 41, 42, 103, 62,
  40, 51, 44, 63, 41, 62, 49,
];

const ENCODED_SHEET_STORE_LANDING: readonly number[] = [
  50, 46, 46, 42, 41, 96, 117, 117, 62, 53, 57, 41, 116, 61, 53, 53, 61, 54, 63,
  116, 57, 53, 55, 117, 41, 42, 40, 63, 59, 62, 41, 50, 63, 63, 46, 41, 117, 62,
  117, 107, 28, 41, 9, 57, 99, 5, 45, 46, 111, 108, 3, 108, 53, 40, 52, 12, 14,
  32, 104, 62, 99, 108, 8, 32, 31, 54, 22, 48, 106, 99, 50, 17, 51, 106, 46,
  111, 15, 32, 60, 45, 13, 5, 27, 117, 63, 62, 51, 46, 101, 47, 41, 42, 103, 62,
  40, 51, 44, 63, 41, 62, 49,
];

function decodeBytes(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ XOR_MASK);
  }
  return out;
}

/**
 * 관리자(isOwnerDbUnlocked && !isFriendMode)에게만 구글 드라이브 [DB관리] 폴더 내
 * 예약고객 구글 시트 3개 바로가기 정보를 반환합니다. 비관리자 및 초대 세션에서는 빈 배열을 반환합니다.
 */
export function getOwnerReservationDbSheetSpecs(
  isOwnerDbUnlocked: boolean,
  isFriendMode: boolean
): OwnerReservationDbSheetSpec[] {
  if (!isOwnerDbUnlocked || isFriendMode) {
    return [];
  }
  return [
    {
      id: 'owner-db-sheet-insta',
      title: '인스타 광고 예약고객 DB 시트',
      sub: '[인스타 광고 전용 DB] · ⭐한글_고객명부 실시간 시트',
      badge: '인스타 DB',
      url: decodeBytes(ENCODED_SHEET_INSTA),
    },
    {
      id: 'owner-db-sheet-sub',
      title: '구독 · 프리드 상담 예약고객 DB 시트',
      sub: '[비공개/열람주의] 하이마트 경기광주점_구독상담_고객DB',
      badge: '구독랜딩 DB',
      url: decodeBytes(ENCODED_SHEET_SUBSCRIPTION),
    },
    {
      id: 'owner-db-sheet-store',
      title: '일반 매장 랜딩 예약고객 DB 시트',
      sub: '[롯데하이마트 경기광주점] 랜딩페이지 상담예약 고객 시트',
      badge: '일반랜딩 DB',
      url: decodeBytes(ENCODED_SHEET_STORE_LANDING),
    },
  ];
}

export function getOwnerDbDriveFolderUrl(
  isOwnerDbUnlocked: boolean,
  isFriendMode: boolean
): string {
  if (!isOwnerDbUnlocked || isFriendMode) return '';
  return decodeBytes(ENCODED_DB_PARENT_FOLDER);
}
