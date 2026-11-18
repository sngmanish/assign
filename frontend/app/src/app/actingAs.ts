import { useSyncExternalStore } from 'react';

/**
 * Who this tab is "acting as": a demo label sent as `X-Actor` and recorded on activity. Not
 * authentication. Kept in sessionStorage so each tab can play a different user.
 */
export const DEMO_USERS = ['Janardhan', 'Heer', 'Sheena'] as const;
const DEFAULT_USER = 'Janardhan';
const KEY = 'crm.actingAs';

const listeners = new Set<() => void>();
// used only when sessionStorage throws
let memory: string | null = null;

export function getActingAs(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved && (DEMO_USERS as readonly string[]).includes(saved) ? saved : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export function setActingAs(user: string): void {
  try {
    sessionStorage.setItem(KEY, user);
  } catch {
    // storage unavailable (private mode): the choice lasts until reload
    memory = user;
  }
  listeners.forEach((l) => l());
}

const read = () => memory ?? getActingAs();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current tab's acting-as user; re-renders when it changes. */
export const useActingAs = () => useSyncExternalStore(subscribe, read);

/** For the base query: the value to send as `X-Actor`. */
export const currentActor = read;
