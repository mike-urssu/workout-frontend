import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Session, getInProgress } from '@/api/workout';
import { errorMessage, notify } from '@/lib/dialog';

/** The in-progress session (null = none), reloaded whenever the screen gains focus. */
export function useActiveSession() {
  const [active, setActive] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setActive(await getInProgress());
    } catch (e) {
      notify(errorMessage(e));
    }
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { active, setActive, loaded, reload };
}
