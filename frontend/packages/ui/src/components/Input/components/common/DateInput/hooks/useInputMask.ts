import { useEffect, RefObject } from 'react';

/** Mask the input as a dd/mm/yyyy date (Inputmask is loaded on first use). */
export default function useInputMask(ref: RefObject<HTMLInputElement>, placeholder: string): void {
  useEffect(() => {
    let isMounted = true;

    const loadInputMask = async () => {
      // @ts-expect-error inputmask has no type declarations
      const { default: Inputmask } = (await import('inputmask')) as {
        default: (opts: Record<string, unknown>) => { mask: (el: HTMLInputElement) => void };
      };
      if (isMounted && ref.current) {
        Inputmask({ mask: '99/99/9999', alias: 'date', placeholder, insertMode: false }).mask(
          ref.current,
        );
      }
    };

    loadInputMask();
    return () => {
      isMounted = false;
    };
  }, [placeholder, ref]);
}
