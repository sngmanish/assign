import { z } from 'zod';

/**
 * The one definition of a valid id. Everything that accepts an id (path params, query
 * filters, request bodies, pagination cursors) uses this, so whether an id is valid never
 * depends on which endpoint or field it arrives in.
 */
export const uuidSchema = z.uuid();

export const isUuid = (value: string): boolean => uuidSchema.safeParse(value).success;
