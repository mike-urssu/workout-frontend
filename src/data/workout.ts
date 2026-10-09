const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const dateKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const elapsed = (sec: number) =>
  `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
export const minSec = (sec: number) => `${Math.floor(sec / 60)}분 ${sec % 60}초`;
export const kg = (n: number) => String(Math.round(n * 10) / 10).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const weekday = (d: Date) => WEEKDAYS[d.getDay()];
export const koreanDate = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday(d)}요일`;
export const WEEKDAY_LABELS = WEEKDAYS;

/** "3일 전", "1주일 전" … relative to today (by calendar day). */
export const daysAgoText = (ms: number) => {
  const days = Math.round(
    (new Date(dateKey(Date.now())).getTime() - new Date(dateKey(ms)).getTime()) / 86400000,
  );
  if (days <= 0) return '오늘';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주일 전`;
  return `${Math.floor(days / 30)}개월 전`;
};
