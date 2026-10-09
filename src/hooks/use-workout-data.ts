import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { repo } from '@/data/repository';
import { Session } from '@/data/workout';

/** Dummy finished sessions for the statistics screen (no stats API yet). */
export function useWorkoutData() {
  const [history, setHistory] = useState<Session[]>([]);

  useFocusEffect(
    useCallback(() => {
      repo.getHistory().then(setHistory);
    }, []),
  );

  return { history };
}
