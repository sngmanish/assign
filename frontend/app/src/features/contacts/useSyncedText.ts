import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * A text field whose value lives in the URL. Typing updates the box at once and the URL after a
 * pause; if the URL changes by itself (Back, Clear filters) the box follows.
 */
export function useSyncedText(
  urlValue: string,
  apply: (value: string) => void,
  delayMs = 300,
): [string, (text: string) => void] {
  const [text, setText] = useState(urlValue);
  const applied = useRef(urlValue); // the last value this field itself wrote to the URL
  const urlRef = useRef(urlValue);
  urlRef.current = urlValue;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // typed text -> URL, after the pause (stable, so the debounce keeps one timer)
  const write = useCallback((typed: string) => {
    const next = typed.trim();
    if (next !== urlRef.current && next !== applied.current) {
      applied.current = next;
      applyRef.current(next);
    }
  }, []);
  const { debouncedCallback, reset } = useDebounce(write, delayMs);

  // a write still waiting when the page goes away must not change the next page's URL
  useEffect(() => reset, [reset]);

  // URL changed by someone else -> box (and drop a pending write of the old text)
  useEffect(() => {
    if (urlValue !== applied.current) {
      reset();
      applied.current = urlValue;
      setText(urlValue);
    }
  }, [urlValue, reset]);

  const change = useCallback(
    (next: string) => {
      setText(next);
      debouncedCallback(next);
    },
    [debouncedCallback],
  );

  return [text, change];
}
