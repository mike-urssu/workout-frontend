import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { Session, getInProgress } from '@/api/workout';
import { errorMessage, notify } from '@/lib/dialog';

// One copy for every screen, so the home tab already shows what the record screen saved when it comes back into view.
let current: Session | null = null;
let version = 0; // a refresh that started before a newer write must not overwrite it
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const write = (s: Session | null) => {
  current = s;
  listeners.forEach((l) => l());
};

export function setActiveSession(s: Session | null) {
  version++;
  write(s);
}

/** Fetches the in-progress session into the shared copy. */
export async function refreshActiveSession() {
  const v = ++version;
  const s = await getInProgress();
  if (v === version) write(s);
}

/** The in-progress session (null = none), reloaded whenever the screen gains focus. */
export function useActiveSession() {
  const active = useSyncExternalStore(subscribe, () => current);

  const reload = useCallback(async () => {
    try {
      await refreshActiveSession();
    } catch (e) {
      notify(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { active, setActive: setActiveSession, reload };
}
