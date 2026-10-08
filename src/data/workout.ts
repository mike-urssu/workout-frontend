import { exerciseById } from './catalog';

export type SetEntry = {
  id: string;
  weight: number | null;
  reps: number | null;
  /** HH:mm the set was recorded */
  time: string;
  /** loaded from a previous record but not yet confirmed by the user */
  prefilled?: boolean;
};
export type SessionExercise = { exerciseId: string; sets: SetEntry[] };
export type Media = { uri: string; type: 'image' | 'video' };
export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number;
  exercises: SessionExercise[];
  media: Media[];
};

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const isDone = (s: SetEntry) => s.reps !== null && !s.prefilled;
export const doneSets = (e: SessionExercise) => e.sets.filter(isDone);
export const exerciseVolume = (e: SessionExercise) =>
  doneSets(e).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
export const totalVolume = (exercises: SessionExercise[]) =>
  exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
export const totalSets = (exercises: SessionExercise[]) =>
  exercises.reduce((sum, e) => sum + doneSets(e).length, 0);
export const groupOf = (e: SessionExercise) => exerciseById(e.exerciseId).group;

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

export const durationSec = (s: Session) =>
  s.endedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : 0;

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

/** Most recent finished session that contains the exercise, with its sets. */
export const lastRecord = (history: Session[], exerciseId: string) => {
  let best: { session: Session; sets: SetEntry[] } | null = null;
  for (const s of history) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    const sets = ex ? doneSets(ex) : [];
    if (sets.length && (!best || s.startedAt > best.session.startedAt)) best = { session: s, sets };
  }
  return best;
};
