import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import type {
  ActivityList,
  BulkAssignResult,
  Contact,
  ContactFields,
  ContactList,
  ContactListParams,
  TagList,
  TagRef,
} from './types';

/** How many activity entries the detail page shows (the newest ones). */
export const ACTIVITY_LIMIT = 50;

/**
 * All server data goes through this one API slice.
 *
 * NOTE: the "tags" in `tagTypes` are RTK Query's CACHE tags (they say which cached results a
 * mutation makes stale). They have nothing to do with a contact's tags, which are a CRM concept.
 * Cache tag types: `Contact` (one contact), `ContactList` (any list result), `Activity` (a
 * contact's history) and `TagCatalog` (the list of all tags).
 */
export const contactsApi = createApi({
  reducerPath: 'contactsApi',
  baseQuery,
  // refetch when the window regains focus or the network comes back (setupListeners in the store
  // only wires the events; these switch the behaviour on). An open edit form keeps its own values.
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['Contact', 'ContactList', 'Activity', 'TagCatalog'],
  endpoints: (build) => ({
    getContacts: build.query<ContactList, ContactListParams>({
      query: (params) => ({ url: '/contacts', params: cleanParams(params) }),
      providesTags: ['ContactList'],
    }),

    getContact: build.query<Contact, string>({
      query: (id) => `/contacts/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Contact', id }],
    }),

    getActivity: build.query<ActivityList, string>({
      query: (id) => ({ url: `/contacts/${id}/activities`, params: { limit: ACTIVITY_LIMIT } }),
      providesTags: (_result, _error, id) => [{ type: 'Activity', id }],
    }),

    getTags: build.query<TagList, void>({
      query: () => '/tags',
      providesTags: ['TagCatalog'],
    }),

    /** Sends only the changed fields plus the version the form was loaded with. */
    updateContact: build.mutation<
      Contact,
      { id: string; changes: Partial<ContactFields>; version: number }
    >({
      query: ({ id, changes, version }) => ({
        url: `/contacts/${id}`,
        method: 'PATCH',
        body: { ...changes, version },
      }),
      // show the saved contact (and its new version) at once, without waiting for the refetch
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        // a failed save is handled by the editor
        const result = await queryFulfilled.catch(() => null);
        if (result) dispatch(contactsApi.util.updateQueryData('getContact', id, () => result.data));
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Contact', id },
        'ContactList',
        { type: 'Activity', id },
      ],
    }),

    /** Add an existing tag (`tagId`) or one by `name` (created if new). `name` is also the chip's label. */
    addTag: build.mutation<Contact, { id: string; name: string; tagId?: string }>({
      query: ({ id, name, tagId }) => ({
        url: `/contacts/${id}/tags`,
        method: 'POST',
        body: toTagRef({ name, tagId }),
      }),
      // optimistic: the chip appears at once and goes away again if the request fails
      async onQueryStarted({ id, name, tagId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contactsApi.util.updateQueryData('getContact', id, (draft) => {
            const exists = draft.tags.some((t) =>
              tagId ? t.id === tagId : t.name.toLowerCase() === name.trim().toLowerCase(),
            );
            if (!exists) draft.tags.push({ id: tagId ?? `pending:${name}`, name: name.trim() });
          }),
        );
        try {
          const { data } = await queryFulfilled;
          // swap only this pending chip for the saved tag; other adds or removes still in flight
          // keep their own optimistic state (the refetch then settles everything)
          const key = name.trim().toLowerCase();
          dispatch(
            contactsApi.util.updateQueryData('getContact', id, (draft) => {
              const saved = data.tags.find((t) =>
                tagId ? t.id === tagId : t.name.toLowerCase() === key,
              );
              const i = draft.tags.findIndex((t) => t.id === (tagId ?? `pending:${name}`));
              if (saved && i !== -1) draft.tags[i] = saved;
            }),
          );
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id, tagId }) => [
        { type: 'Contact', id },
        'ContactList',
        { type: 'Activity', id },
        // adding by name may create a new tag
        ...(tagId ? [] : (['TagCatalog'] as const)),
      ],
    }),

    removeTag: build.mutation<Contact, { id: string; tagId: string }>({
      query: ({ id, tagId }) => ({ url: `/contacts/${id}/tags/${tagId}`, method: 'DELETE' }),
      async onQueryStarted({ id, tagId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contactsApi.util.updateQueryData('getContact', id, (draft) => {
            draft.tags = draft.tags.filter((t) => t.id !== tagId);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Contact', id },
        'ContactList',
        { type: 'Activity', id },
      ],
    }),

    bulkAssignTag: build.mutation<
      BulkAssignResult,
      { contactIds: string[]; name: string; tagId?: string }
    >({
      query: ({ contactIds, name, tagId }) => ({
        url: '/tags/bulk-assign',
        method: 'POST',
        body: { contactIds, ...toTagRef({ name, tagId }) },
      }),
      // every tagged contact gets an activity entry, so all cached activity is stale
      invalidatesTags: ['ContactList', 'TagCatalog', 'Activity', 'Contact'],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactQuery,
  useGetActivityQuery,
  useGetTagsQuery,
  useUpdateContactMutation,
  useAddTagMutation,
  useRemoveTagMutation,
  useBulkAssignTagMutation,
} = contactsApi;

/** The API takes exactly one of `tagId` or `name`. */
function toTagRef({ name, tagId }: { name: string; tagId?: string }): TagRef {
  return tagId ? { tagId } : { name: name.trim() };
}

/** Drop empty values so they never reach the URL ("?q=&tag="). */
function cleanParams(params: ContactListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value as string | number;
  }
  return out;
}
