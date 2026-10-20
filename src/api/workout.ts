import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { ApiError, BASE_URL, request } from './client';

// Shapes follow the backend design docs (workout-record v0.7, workout-media v0.2).
export type CategoryRef = { id: string; name: string };
export type Category = CategoryRef & { imageUrl: string; exerciseCount: number };
export type ExerciseItem = { id: string; name: string; nameEn: string | null; target: string | null; lastPerformedDate: string | null };
export type ExerciseInput = { categoryId: string; name: string; nameEn: string | null };
export type SetDto = { id: string; setNumber: number; weight: number; repetitions: number; createdAt: string };
export type SessionExercise = {
  sessionExerciseId: string; exerciseId: string; name: string; nameEn: string | null; target: string | null;
  category: CategoryRef; sets: SetDto[]; setCount: number; totalRepetitions: number; volume: number; firstSetAt: string | null;
};
export type Session = {
  id: string; status: 'IN_PROGRESS' | 'COMPLETED'; performedDate: string; startedAt: string; endedAt: string | null;
  exercises: SessionExercise[];
  categories: { id: string; name: string; setCount: number; volume: number; sessionExerciseIds: string[] }[];
  summary: { durationSeconds: number | null; exerciseCount: number; totalSets: number; totalRepetitions: number; totalVolume: number };
};
export type LastRecord = { performedDate: string; sets: { setNumber: number; weight: number; repetitions: number }[] };
export type MediaItem = { id: string; mediaType: 'PHOTO' | 'VIDEO'; contentType: string; previewUrl: string; displayUrl: string; originalUrl: string };
export type MonthDay = { date: string; categories: CategoryRef[] };
export type Month = { month: string | null; latestDate: string | null; days: MonthDay[] };
export type Day = {
  date: string; durationSeconds: number;
  exercises: Omit<SessionExercise, 'sessionExerciseId' | 'firstSetAt'>[];
  categories: { id: string; name: string; setCount: number; volume: number; exerciseIds: string[] }[];
  summary: Omit<Session['summary'], 'durationSeconds'>;
  media: MediaItem[];
};

const sessions = '/api/v1/workout-sessions';
const setsPath = (sid: string, seid: string) => `${sessions}/${sid}/exercises/${seid}/sets`;
/** 204 resolves to undefined, which the callers treat as "none". */
const orNull = <T>(v: T | undefined) => v ?? null;

export const getCategories = () => request<Category[]>('/api/v1/exercise-categories');
export const getExercises = (categoryId: string) => request<ExerciseItem[]>(`/api/v1/exercises?categoryId=${categoryId}`);
// API-EXERCISE-005 ~ 008 (workout-exercise-manage design)
export const createExercise = (body: ExerciseInput) => request('/api/v1/exercises', { method: 'POST', body });
export const updateExercise = (id: string, body: ExerciseInput) => request(`/api/v1/exercises/${id}`, { method: 'PUT', body });
export const deleteExercise = (id: string) => request(`/api/v1/exercises/${id}`, { method: 'DELETE' });
/** Every exercise of the body part, in the new order; 409 EXERCISE_ORDER_OUTDATED if the list changed meanwhile. */
export const reorderExercises = (categoryId: string, exerciseIds: string[]) =>
  request(`/api/v1/exercise-categories/${categoryId}/exercise-order`, { method: 'PUT', body: { exerciseIds } });
export const getLastRecord = async (exerciseId: string) =>
  orNull(await request<LastRecord | undefined>(`/api/v1/exercises/${exerciseId}/last-record`));

export const getInProgress = async () => orNull(await request<Session | undefined>(`${sessions}/in-progress`));
export const startSession = () =>
  request<Session>(sessions, { method: 'POST', headers: { 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone } });
export const cancelSession = (id: string) => request(`${sessions}/${id}`, { method: 'DELETE' });
export const completeSession = (id: string, mediaIds: string[]) =>
  request<Session>(`${sessions}/${id}/complete`, { method: 'POST', body: { mediaIds } });

export const addExercise = (sid: string, exerciseId: string) =>
  request<SessionExercise>(`${sessions}/${sid}/exercises`, { method: 'POST', body: { exerciseId } });
export const removeExercise = (sid: string, seid: string) =>
  request(`${sessions}/${sid}/exercises/${seid}`, { method: 'DELETE' });
export const addSet = (sid: string, seid: string, weight: number, repetitions: number) =>
  request<SetDto>(setsPath(sid, seid), { method: 'POST', body: { weight, repetitions } });
export const updateSet = (sid: string, seid: string, setId: string, weight: number, repetitions: number) =>
  request<SetDto>(`${setsPath(sid, seid)}/${setId}`, { method: 'PUT', body: { weight, repetitions } });
export const deleteSet = (sid: string, seid: string, setId: string) =>
  request(`${setsPath(sid, seid)}/${setId}`, { method: 'DELETE' });
export const clearSets = (sid: string, seid: string) => request(setsPath(sid, seid), { method: 'DELETE' });

/** Uploads one photo/video (temporary until the session is completed). */
export async function uploadMedia(sid: string, file: { uri: string; name: string; type: string }) {
  const form = new FormData();
  if (Platform.OS === 'web') form.append('file', await (await fetch(file.uri)).blob(), file.name);
  else form.append('file', new File(file.uri)); // expo/fetch (the global fetch) rejects RN's { uri, name, type } parts
  return request<{ id: string }>(`${sessions}/${sid}/media`, { method: 'POST', body: form });
}

export const getMonth = (month?: string) => request<Month>(`/api/v1/workout-days${month ? `?month=${month}` : ''}`);
export const getDay = async (date: string) => orNull(await request<Day | undefined>(`/api/v1/workout-days/${date}`));
export const deleteDay = (date: string) => request(`/api/v1/workout-days/${date}`, { method: 'DELETE' });

export const fileUrl = (path: string) => `${BASE_URL}${path}`;

// ---- display helpers ----
export type Breakdown = {
  id: string; name: string; volume: number; setCount: number;
  exercises: { key: string; name: string; volume: number; setCount: number; sets: { weight: number; repetitions: number }[] }[];
}[];

/** Body-part cards for the completion popup / in-progress session (exercises with sets only). */
export const sessionBreakdown = (s: Session): Breakdown =>
  s.categories.map((c) => ({
    ...c,
    exercises: s.exercises.filter((e) => c.sessionExerciseIds.includes(e.sessionExerciseId))
      .map((e) => ({ key: e.sessionExerciseId, ...e })),
  }));

export const dayBreakdown = (d: Day): Breakdown =>
  d.categories.map((c) => ({
    ...c,
    exercises: d.exercises.filter((e) => c.exerciseIds.includes(e.exerciseId)).map((e) => ({ key: e.exerciseId, ...e })),
  }));

export const toMs = (iso: string) => Date.parse(iso);

/** BR-019: picking an exercise without a session starts one first; a 409 means another device already did. */
export async function openExercise(exerciseId: string) {
  let session = await getInProgress();
  if (!session) {
    try {
      session = await startSession();
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'WORKOUT_SESSION_ALREADY_IN_PROGRESS') throw e;
      session = await getInProgress();
    }
  }
  if (!session) throw new ApiError(404, 'WORKOUT_SESSION_NOT_FOUND', '운동을 시작하지 못했어요.');
  const added = await addExercise(session.id, exerciseId);
  return { sessionId: session.id, sessionExerciseId: added.sessionExerciseId };
}
