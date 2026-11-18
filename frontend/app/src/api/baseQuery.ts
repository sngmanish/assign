import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs } from '@reduxjs/toolkit/query';
import { API_URL } from '../config/env';
import { currentActor } from '../app/actingAs';
import { toApiError, type ApiError } from './errors';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  // demo "acting as" name, recorded by the backend on activity entries
  prepareHeaders: (headers) => {
    headers.set('X-Actor', currentActor());
    return headers;
  },
});

/**
 * fetchBaseQuery, but a failure comes back as an `ApiError` (see errors.ts) instead of the raw
 * `{ status, data }`, so components can switch on `error.kind`.
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) {
    return { error: toApiError(result.error, result.meta?.response?.headers.get('retry-after')) };
  }
  return { data: result.data, meta: result.meta };
};
