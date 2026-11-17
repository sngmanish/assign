/**
 * Postgres text cannot hold a NUL (\u0000): the query fails with 22021, which used to
 * surface as a 500. JSON ("\u0000") and URLs (%00) can both carry one, so every free-text
 * input is checked at the boundary with this and answered as a client error instead.
 */
export const noNul = (value: string): boolean => !value.includes('\u0000');

export const NO_NUL_MESSAGE = 'Must not contain NUL characters';
