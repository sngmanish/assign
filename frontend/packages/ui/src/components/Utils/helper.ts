/** True when a string has no letters or digits (e.g. "×"), so it cannot serve as an accessible name. */
export const validateString = (str: string): boolean => !/[a-zA-Z0-9]/.test(str);
