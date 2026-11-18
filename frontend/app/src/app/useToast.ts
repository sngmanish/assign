import { useMemo } from 'react';
import { useSnackbar } from '@crm/ui';

/** Short-lived messages for the result of an action ("Saved", "Couldn't add tag: …"). */
export function useToast() {
  const show = useSnackbar(); // stable, so this object is built once
  return useMemo(
    () => ({
      success: (message: string) => show({ type: 'success', message }),
      error: (message: string) => show({ type: 'error', message, duration: 6000 }),
    }),
    [show],
  );
}
