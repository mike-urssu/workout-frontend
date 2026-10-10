import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getCategoryTrend, getExerciseTrend, getStatsExercises } from '@/api/stats';
import { getCategories } from '@/api/workout';
import StatsScreen from '@/app/(tabs)/stats';

jest.mock('@/api/stats');
jest.mock('@/api/workout');
// Screens run outside a navigator here: "focus" is the first render.
jest.mock('expo-router', () => ({ useFocusEffect: (fn: () => void) => jest.requireActual('react').useEffect(fn, []) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

// 가슴 and 하체 trained on different days (a split routine).
const CHEST = { id: 'chest', name: '가슴', imageUrl: '', exerciseCount: 1 };
const LEGS = { id: 'legs', name: '하체', imageUrl: '', exerciseCount: 1 };
const DATES: Record<string, string[]> = { chest: ['2026-09-01', '2026-09-03'], legs: ['2026-09-02', '2026-09-04'] };
const EXERCISES: Record<string, { id: string; name: string }[]> = {
  chest: [{ id: 'bench', name: '벤치프레스' }],
  legs: [{ id: 'squat', name: '스쿼트' }],
};

beforeEach(() => {
  jest.mocked(getCategories).mockResolvedValue([CHEST, LEGS]);
  jest.mocked(getCategoryTrend).mockImplementation(async (id) => ({ dates: DATES[id], volumes: [1000, 1000], hasPrevious: false }));
  jest.mocked(getStatsExercises).mockImplementation(async (id) => EXERCISES[id]);
  jest.mocked(getExerciseTrend).mockImplementation(async (ids, dates) => ({
    dates,
    exercises: ids.map((id) => ({ id, name: id, volumes: dates.map(() => 500) })),
  }));
});

/** The first row of body-part chips belongs to the body-part chart, the second to the exercise chart. */
const pickVolumePart = (name: string) => fireEvent.press(screen.getAllByText(name)[0]);
const pickExercisePart = (name: string) => fireEvent.press(screen.getAllByText(name)[1]);

test('picking a body part in the exercise chart puts the days that part was trained on its axis', async () => {
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');

  await pickExercisePart('하체');

  await screen.findByText('스쿼트');
  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['squat'], ['2026-09-02', '2026-09-04']));
  expect(screen.getByText('9/2')).toBeOnTheScreen();
  expect(screen.getByText('9/4')).toBeOnTheScreen();
});

test('changing the body-part chart leaves the exercise chart on its own days', async () => {
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');

  await pickVolumePart('하체');
  await screen.findByText('9/2');
  await fireEvent.press(screen.getByText('벤치프레스')); // deselect
  await fireEvent.press(screen.getByText('벤치프레스')); // select again

  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['bench'], ['2026-09-01', '2026-09-03']));
});

test('the exercise chart pages back through the days its own body part was trained', async () => {
  jest.mocked(getCategoryTrend).mockImplementation(async (id, before) =>
    id === 'legs' && before === '2026-09-04'
      ? { dates: ['2026-08-30', '2026-09-02'], volumes: [1000, 1000], hasPrevious: false }
      : { dates: DATES[id], volumes: [1000, 1000], hasPrevious: id === 'legs' });
  await render(<StatsScreen />);
  await screen.findByText('벤치프레스');
  await pickExercisePart('하체');
  await screen.findByText('스쿼트');

  await fireEvent.press(screen.getAllByLabelText('이전 날짜')[1]);

  await waitFor(() => expect(getExerciseTrend).toHaveBeenLastCalledWith(['squat'], ['2026-08-30', '2026-09-02']));
  expect(screen.getByText('8/30')).toBeOnTheScreen();

  await fireEvent.press(screen.getAllByLabelText('다음 날짜')[1]);

  await screen.findByText('9/4');
  expect(screen.queryByText('8/30')).toBeNull();
});
