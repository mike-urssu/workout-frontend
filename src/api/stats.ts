import { request } from './client';

// Shapes follow the backend design (workout-stats v0.7). `volumes` line up with `dates`.
/** One body part: the last (up to) 12 days it was trained within 3 months of the latest one and that part's volume (kg) on each. */
export type CategoryTrend = { dates: string[]; volumes: number[]; hasPrevious: boolean };
export type StatsExercise = { id: string; name: string };
/** Up to 12 days (within 3 months) any of the exercises was done, and each exercise's volume (kg) on them (null = not done that day). */
export type ExerciseTrend = { dates: string[]; exercises: { id: string; name: string; volumes: (number | null)[] }[]; hasPrevious: boolean };

/** Up to 12 days (within 3 months) the body part was trained; `before` (exclusive) pages to the older interval. */
export const getCategoryTrend = (categoryId: string, before?: string) =>
  request<CategoryTrend>(`/api/v1/stats/category-volumes?categoryId=${categoryId}${before ? `&before=${before}` : ''}`);

/** Exercises of a body part that have at least one recorded set. */
export const getStatsExercises = (categoryId: string) => request<StatsExercise[]>(`/api/v1/stats/exercises?categoryId=${categoryId}`);

/** 1 or more exercises (repeated query params); `before` (exclusive) pages to the older interval like getCategoryTrend. */
export const getExerciseTrend = (exerciseIds: string[], before?: string) =>
  request<ExerciseTrend>(
    `/api/v1/stats/exercise-volumes?${[...exerciseIds.map((id) => `exerciseIds=${id}`), ...(before ? [`before=${before}`] : [])].join('&')}`,
  );
