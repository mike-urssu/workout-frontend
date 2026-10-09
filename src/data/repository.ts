// Local-storage backed dummy history (statistics only; everything else uses src/api/workout.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MuscleGroupId, exercisesOf } from './catalog';
import { Session, clock } from './workout';

const KEYS = { history: 'workout.history', seeded: 'workout.seeded' };

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
const write = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

// Dummy September 2026 history so the calendar / stats have something to show.
const SEED_DAYS: [number, MuscleGroupId[]][] = [
  [1, ['chest']], [3, ['back']], [5, ['shoulders', 'legs']], [8, ['chest', 'back']],
  [10, ['legs']], [11, ['chest']], [12, ['shoulders']], [15, ['back', 'legs']],
  [17, ['chest']], [18, ['shoulders']], [19, ['back']], [20, ['chest', 'legs']],
  [22, ['back']], [23, ['shoulders']], [24, ['chest', 'back']], [25, ['legs']],
  [27, ['chest', 'back']],
];

function seedSession(day: number, groups: MuscleGroupId[]): Session {
  const startedAt = new Date(2026, 8, day, 14, 0).getTime();
  const picked = groups.flatMap((g) => exercisesOf(g).filter((_, i) => (i + day) % 2 === 0));
  const exercises = picked.map((ex, exIdx) => ({
    exerciseId: ex.id,
    sets: [0, 1, 2].map((i) => ({
      id: `${day}-${ex.id}-${i}`,
      weight: ex.baseKg + i * 5 + (day % 4) * 2.5,
      reps: 12 - 2 * i,
      time: clock(startedAt + (exIdx * 12 + i * 3) * 60000),
    })),
  }));
  const seconds = day === 27 ? 47 * 60 + 23 : (40 + (day % 15)) * 60;
  return { id: `seed-${day}`, startedAt, endedAt: startedAt + seconds * 1000, exercises, media: [] };
}

let seeding: Promise<void> | null = null;
function ensureSeeded() {
  seeding ??= (async () => {
    if (await AsyncStorage.getItem(KEYS.seeded)) return;
    await write(KEYS.history, SEED_DAYS.map(([d, g]) => seedSession(d, g)));
    await AsyncStorage.setItem(KEYS.seeded, '1');
  })();
  return seeding;
}

// Only the statistics screen still reads this: there is no stats API yet (dummy September 2026 history).
export const repo = {
  async getHistory(): Promise<Session[]> {
    await ensureSeeded();
    return read<Session[]>(KEYS.history, []);
  },
};
