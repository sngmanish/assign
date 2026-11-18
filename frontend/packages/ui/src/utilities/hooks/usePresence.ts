import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted for `exitMs` after `present` turns false so a
 * close animation can play (the equivalent of Radix's <Presence>).
 * Returns true while the element should be in the DOM.
 */
export function usePresence(present: boolean, exitMs = 150): boolean {
  const [mounted, setMounted] = useState(present);

  useEffect(() => {
    if (present) {
      setMounted(true);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [present, exitMs]);

  return present || mounted;
}

export default usePresence;
