import { request } from './client';

// Shapes follow the backend design (workout-stats v0.1). `volumes` line up with `dates`; null = not done that day.
export type CategoryTrend = {
  dates: string[];
  categories: { id: string; name: string; volumes: (number | null)[] }[];
  hasPrevious: boolean;
};
export type StatsExercise = { id: string; name: string };
export type ExerciseTrend = { dates: string[]; exercises: { id: string; name: string; volumes: (number | null)[] }[] };

/** Up to 7 workout days; `before` (exclusive) pages to the older interval. */
export const getCategoryTrend = (before?: string) =>
  request<CategoryTrend>(`/api/v1/stats/category-volumes${before ? `?before=${before}` : ''}`);

/** Exercises of a body part that have at least one recorded set. */
export const getStatsExercises = (categoryId: string) => request<StatsExercise[]>(`/api/v1/stats/exercises?categoryId=${categoryId}`);

/** 1–4 exercises over the given dates (repeated query params). */
export const getExerciseTrend = (exerciseIds: string[], dates: string[]) =>
  request<ExerciseTrend>(
    `/api/v1/stats/exercise-volumes?${[...exerciseIds.map((id) => `exerciseIds=${id}`), ...dates.map((d) => `dates=${d}`)].join('&')}`,
  );
