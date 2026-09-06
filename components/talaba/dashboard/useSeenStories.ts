'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'seen_story_ids';

/**
 * Per-device "already watched" state for the stories bar. Purely cosmetic (it
 * only mutes the ring) — never server state, and safe when localStorage throws
 * (private windows, thumbnail capture).
 */
export function useSeenStories() {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSeen(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  const markSeen = useCallback((ids: string | string[]) => {
    setSeen((prev) => {
      const next = new Set(prev);
      (Array.isArray(ids) ? ids : [ids]).forEach((id) => next.add(id));
      try {
        // Keep the list from growing forever — only the last 200 ids matter.
        localStorage.setItem(KEY, JSON.stringify([...next].slice(-200)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const isSeen = useCallback((id: string) => seen.has(id), [seen]);

  return { isSeen, markSeen };
}
