import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { authHeaders } from '@/api/client';
import { fileUrl } from '@/api/workout';

type Source = { uri: string; headers?: Record<string, string> };

/**
 * Source for a protected file (needs the Bearer token). Native image/video components send the headers;
 * on web <img>/<video> cannot, so the file is fetched and shown through an object URL.
 * A local file (picked but not uploaded yet, so not a server path) is used as is.
 */
export function useFileSource(path: string | undefined): Source | null {
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    if (!path?.startsWith('/')) return;
    let revoke: string | undefined;
    let cancelled = false;
    (async () => {
      const headers = await authHeaders();
      if (Platform.OS !== 'web') return !cancelled && setSource({ uri: fileUrl(path), headers });
      try {
        const res = await fetch(fileUrl(path), { headers });
        if (!res.ok) return;
        revoke = URL.createObjectURL(await res.blob());
        if (!cancelled) setSource({ uri: revoke });
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);
  return path && !path.startsWith('/') ? { uri: path } : source;
}
