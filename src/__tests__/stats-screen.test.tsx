import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getCategoryTrend, getExerciseTrend, getStatsExercises } from '@/api/stats';
import { getCategories } from '@/api/workout';
import StatsScreen from '@/app/(tabs)/stats';

jest.mock('@/api/stats');
jest.mock('@/api/workout');
// Screens run outside a navigator here: "focus" is the first render.
jest.mock('expo-router', () => ({ useFocusEffect: (fn: () => void) => jest.requireActual('react').useEffect(fn, []) }));
// The charts drag with gesture-handler + Reanimated, which have no native side under jest.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

// 가슴 and 하체 trained on different days (a split routine); 벤치프레스 is not done on every 가슴 day.
const CHEST = { id: 'chest', name: '가슴', imageUrl: '', exerciseCount: 2 };
const LEGS = { id: 'legs', name: '하체', imageUrl: '', exerciseCount: 1 };
const DATES: Record<string, string[]> = { chest: ['2026-09-01', '2026-09-03'], legs: ['2026-09-02', '2026-09-04'] };
const EXERCISES: Record<string, { id: string; name: string }[]> = {
  chest: [{ id: 'bench', name: '벤치프레스' }, { id: 'fly', name: '펙덱 플라이' }],
  legs: [{ id: 'squat', name: '스쿼트' }],
};
const EXERCISE_DATES: Record<string, string[]> = { bench: ['2026-09-01'], fly: ['2026-09-03'], squat: DATES.legs };

beforeEach(() => {
  jest.mocked(getCategories).mockResolvedValue([CHEST, LEGS]);
  jest.mocked(getCategoryTrend).mockImplementation(async (id) => ({ dates: DATES[id], volumes: [1000, 1000], hasPrevious: false }));
  jest.mocked(getStatsExercises).mockImplementation(async (id) => EXERCISES[id]);
  // The server picks the days any of the exercises was done.
  jest.mocked(getExerciseTrend).mockImplementation(async (ids) => {
    const dates = [...new Set(ids.flatMap((id) => EXERCISE_DATES[id]))].sort();
    return { dates, exercises: ids.map((id) => ({ id, name: id, volumes: dates.map(() => 500) })), hasPrevious: false };
  });
});

/** The first row of body-part chips belongs to the body-part chart, the second to the exercise chart. */
const pickVolumePart = (name: string) => fireEvent.press(screen.getAllByText(name)[0]);
const pickExercisePart = (name: string) => fireEvent.press(screen.getAllByText(name)[1]);
/** Day labels on the exercise chart (the body-part chart is above it with its own). */
/** Paging, as a screen reader does it on a chart's swipe area (index 0 = body-part chart, 1 = exercise chart). */
const page = (chart: number, actionName: 'decrement' | 'increment') =>
  fireEvent(screen.getAllByRole('adjustable')[chart], 'accessibilityAction', { nativeEvent: { actionName } });
const exerciseLabels = () => screen.getAllByText(/^\d+\/\d+$/).slice(DATES.chest.length).map((t) => t.props.children);

test('picking a body part in the exercise chart shows the days its exercises were done', async () => {
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');

  await pickExercisePart('하체');

  await screen.findByText('스쿼트');
  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['squat'], undefined));
  expect(screen.getByText('9/2')).toBeOnTheScreen();
  expect(screen.getByText('9/4')).toBeOnTheScreen();
});

test('deselecting an exercise narrows the axis to the days the remaining ones were done', async () => {
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');
  await waitFor(() => expect(exerciseLabels()).toEqual(['9/1', '9/3']));

  await fireEvent.press(screen.getByText('펙덱 플라이'));

  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['bench'], undefined));
  await waitFor(() => expect(exerciseLabels()).toEqual(['9/1']));
});

test('changing the body-part chart leaves the exercise chart alone', async () => {
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');
  const calls = jest.mocked(getExerciseTrend).mock.calls.length;

  await pickVolumePart('하체');
  await screen.findByText('9/2');

  expect(getExerciseTrend).toHaveBeenCalledTimes(calls);
});

test('dragging the exercise chart moves one shown day at a time through the older days loaded behind it', async () => {
  jest.mocked(getExerciseTrend).mockImplementation(async (ids, before) =>
    before === '2026-09-02'
      ? { dates: ['2026-08-30'], exercises: ids.map((id) => ({ id, name: id, volumes: [500] })), hasPrevious: false }
      : { dates: DATES.legs, exercises: ids.map((id) => ({ id, name: id, volumes: [500, 500] })), hasPrevious: true });
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');
  await pickExercisePart('하체');
  await screen.findByText('스쿼트');

  // the days before the oldest shown one are loaded up front, so the chart can slide them in
  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['squat'], '2026-09-02'));
  const chart = () => screen.getAllByRole('adjustable')[1];
  expect(chart()).toHaveAccessibilityValue({ text: '9/2–9/4' });

  await page(1, 'decrement');

  await waitFor(() => expect(chart()).toHaveAccessibilityValue({ text: '8/30–9/2' }));

  await page(1, 'increment');

  await waitFor(() => expect(chart()).toHaveAccessibilityValue({ text: '9/2–9/4' }));
});
