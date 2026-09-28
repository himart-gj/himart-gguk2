/**
 * 일관되고 안전한 날짜/시간 포맷팅 유틸리티
 * 기기/브라우저 로케일에 구애받지 않고 항상 YYYY-MM-DD 포맷을 보장합니다.
 */

export function formatLocalDate(d: Date | string | number = new Date()): string {
  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(d: Date | string | number = new Date()): string {
  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
