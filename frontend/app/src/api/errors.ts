import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { Contact } from './types';

/** One field-level problem from a 400 or 422: `path` is the field name ("email", "contactIds.2"). */
export interface FieldError {
  path: string;
  message: string;
}

/**
 * Every failure the UI has to tell apart, as one typed union. The backend always answers with
 * `{ error: { code, message, details } }`; `toApiError` turns that (or a network failure) into this.
 */
export type ApiError =
  /** 409 VERSION_CONFLICT: someone else saved first. `latest` is the current contact. */
  | { kind: 'version-conflict'; message: string; latest: Contact }
  /** 409 EMAIL_TAKEN */
  | { kind: 'email-taken'; message: string }
  /** 422 VALIDATION_ERROR: show `fieldErrors` under the fields. */
  | { kind: 'validation'; message: string; fieldErrors: FieldError[] }
  /** 404 NOT_FOUND */
  | { kind: 'not-found'; message: string }
  /** 400 BAD_REQUEST (a bad query, id or cursor: a bug or a stale link, not user input) */
  | { kind: 'bad-request'; message: string; fieldErrors: FieldError[]; code: string }
  /** 429 RATE_LIMITED */
  | { kind: 'rate-limited'; message: string; retryAfterSeconds: number | null }
  /** 503 TEMPORARILY_UNAVAILABLE or QUERY_TIMEOUT: worth retrying later */
  | { kind: 'unavailable'; message: string; code: string; requestId: string | null }
  /** The request never got an answer (offline, CORS, server down) */
  | { kind: 'network'; message: string }
  /** 5xx or anything unexpected. `requestId` matches a line in the server log. */
  | { kind: 'server'; message: string; status: number | null; requestId: string | null };

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function fieldErrors(details: unknown): FieldError[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter((d): d is Record<string, unknown> => isObject(d))
    .map((d) => ({ path: String(d.path ?? ''), message: String(d.message ?? '') }));
}

function requestId(details: unknown): string | null {
  return isObject(details) && typeof details.requestId === 'string' ? details.requestId : null;
}

export function toApiError(err: FetchBaseQueryError, retryAfter?: string | null): ApiError {
  if (err.status === 'FETCH_ERROR' || err.status === 'TIMEOUT_ERROR') {
    return {
      kind: 'network',
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }
  if (err.status === 'PARSING_ERROR' || err.status === 'CUSTOM_ERROR') {
    return {
      kind: 'server',
      message: 'The server sent an unexpected response.',
      status: null,
      requestId: null,
    };
  }

  const status = err.status;
  const body: ErrorBody = isObject(err.data) ? (err.data as ErrorBody) : {};
  const code = body.error?.code ?? '';
  const message = body.error?.message ?? 'Something went wrong.';
  const details = body.error?.details;

  if (status === 409 && code === 'VERSION_CONFLICT') {
    // the dialog reads the latest contact's fields: anything that doesn't look like one is a server error
    const latest = isObject(details) && isObject(details.latest) ? details.latest : null;
    if (latest && typeof latest.version === 'number' && Array.isArray(latest.tags)) {
      return { kind: 'version-conflict', message, latest: latest as unknown as Contact };
    }
    return { kind: 'server', message, status, requestId: requestId(details) };
  }
  if (status === 409 && code === 'EMAIL_TAKEN') return { kind: 'email-taken', message };
  if (status === 422) return { kind: 'validation', message, fieldErrors: fieldErrors(details) };
  if (status === 404) return { kind: 'not-found', message };
  if (status === 400)
    return { kind: 'bad-request', message, fieldErrors: fieldErrors(details), code };
  if (status === 429) {
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    return {
      kind: 'rate-limited',
      message,
      retryAfterSeconds: Number.isFinite(seconds) ? seconds : null,
    };
  }
  if (status === 503) return { kind: 'unavailable', message, code, requestId: requestId(details) };
  return { kind: 'server', message, status, requestId: requestId(details) };
}

export const isApiError = (e: unknown): e is ApiError =>
  isObject(e) && typeof e.kind === 'string' && typeof e.message === 'string';
