import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { repo } from '@/data/repository';
import { Session } from '@/data/workout';

/** Finished sessions + the in-progress one, reloaded whenever the screen gains focus. */
export function useWorkoutData() {
  const [history, setHistory] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [h, a] = await Promise.all([repo.getHistory(), repo.getActive()]);
    setHistory(h);
    setActive(a);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { history, active, setActive, loaded, reload };
}
