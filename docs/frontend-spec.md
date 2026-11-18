# CRM Contact Workspace — Frontend Spec

This is the frontend spec for the take-home, kept in step with what is built. The PDF brief comes first: build nothing the brief doesn't ask for.

## Rules

- React 18 + TypeScript on Vite, in `frontend/`. Redux Toolkit with RTK Query for server data, and React Router.
- **Components first:** use the component package (`@crm/ui`, shadcn-style tokens) for everything it has. Build only what's missing, by composing its pieces, and keep it small and plain. Remove what nothing uses.
- The API base URL comes from `VITE_API_URL`, the only setting the build needs.
- No login. The app opens on the contact list.
- **Out of scope:** Add Contact, Import, Smart Lists, Tasks, Companies, conversations and messaging, and any sidebar or navigation. The app is only the contact pages, under a slim top bar.
- Commit after each task, the same way as the backend plan.

## Structure

`frontend/` is an npm-workspaces monorepo (details in `frontend/README.md`):

| Workspace       | Package     | Holds                                                                                                                         |
| --------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app`           | `@crm/web`  | Routing, store, RTK Query slice, pages, screen-level wrappers, `app/src/hooks` (`useDebounce`), Playwright tests in `app/e2e` |
| `packages/ui`   | `@crm/ui`   | Every component, one folder each, plus design tokens, styles, icons and small utilities. Plain CSS modules.                   |
| `packages/docs` | `@crm/docs` | Storybook for `@crm/ui`                                                                                                       |

- The app imports components only from `@crm/ui` (by name). If something isn't exported yet, add it to `packages/ui/src/index.ts`; never deep-import.
- Inside `@crm/ui`, files import each other with relative paths. Stories may import by path (`@crm/ui/components/Table`).
- The packages ship TypeScript source; Vite compiles them with the app. There is no per-package build.
- The detail page and the edit form are lazy-loaded chunks, so the contact list (the landing page) loads without the phone-number library.

## Pages

### 1. Contacts list (`/contacts`, the landing page)

- The header shows the title and a count badge: "177 contacts", or "10,000+ contacts" above the cap.
- A toolbar with a search box (name, email, phone; debounced 300 ms; at most 5 words), a Filters button and a sort menu (Newest first, Oldest first, Name A to Z, Name Z to A).
- **Filters panel:** tag (one tag; the API's `tag` takes a single id), company (exact name) and a created-date range (from / to).
- A table with a checkbox column plus Name, Email, Phone, Company, Tags and Created. Empty values show "—".
- Only Name and Created can be sorted. Clicking a header toggles between ascending and descending (never "unsorted").
- Tags show as chips: the first two, then "+N" with the rest in a tooltip.
- The Name cell is a link to the contact; rows have no click handler. Clicking a checkbox only selects the row.
- **Bulk bar:** while rows are selected, "N/20 · Select All · Add tag · Clear". Add tag opens a dialog with the tag picker; the result shows as a toast: "Tag VIP: added to 12 contacts, 3 already had it".
- **Pagination:** page numbers and "Page [3] of 42" while the count is exact. Above 10,000 matches, Prev / Next on the cursor ("1-20 of 10,000+"). A page-size picker (20, 50, 100) in both.
- Search, filters, sort, page size and page live in the URL query string, so Back and refresh keep them. Broken or hand-edited values are ignored, not sent to the API.
- On phones the table becomes one card per row.

### 2. Contact detail (`/contacts/:id`)

- A back link ("← Contacts") that returns to the list with the same URL state.
- **Left panel:** the name with initials and company, tag chips (× to remove, "+ Add tag" to add an existing or new tag) and the five fields: first name, last name, email, phone and company.
- **Right panel:** recent activity, grouped by day ("Today", "Yesterday", "Nov 12, 2026"), newest first: the latest 50, in a fixed-height box with its own scroll bar.
- Each activity reads naturally, with its actor: "Heer changed email from a@x.com to b@x.com", "Janardhan added tag VIP", "Sheena removed tag Lead". The exact time shows on hover.
- On narrow screens the two panels stack.

## Components

All from `@crm/ui` unless marked as an app wrapper.

| Component                                                                                                               | Used where                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `TopBar`                                                                                                                | All pages: app title, theme picker (Light / Dark / System), "Acting as" picker                           |
| `OptionSelect` (on `SelectMenu`)                                                                                        | Acting-as, theme, sort and tag-filter menus                                                              |
| `PageHeader`, `Badge`                                                                                                   | List page title and count                                                                                |
| `Table` + `useTable`                                                                                                    | Contacts table: selection, sort buttons, skeleton rows, empty states, pagination, bulk bar, mobile cards |
| `Pagination`, `CursorPager`                                                                                             | Page numbers under the count cap; Prev / Next above it                                                   |
| `BulkAction`                                                                                                            | The bulk bar (through `Table`'s `bulkActionsMetadata`)                                                   |
| `Disclosure` (`useDisclosure`, `DisclosureBody`)                                                                        | The Filters panel                                                                                        |
| `Input` (text, search, masked date)                                                                                     | Search box, filters, edit form                                                                           |
| `PhoneInput`                                                                                                            | Edit form (country picker with search)                                                                   |
| `Tag`, `TagList`, `TagPicker`                                                                                           | Chips and the add-tag picker with "Create 'xyz'"                                                         |
| `Avatar`                                                                                                                | Table, detail header, activity                                                                           |
| `ContactFieldList`, `ContactForm`                                                                                       | Detail page: read-only fields; the edit form                                                             |
| `Modal`, `ConflictDialog`                                                                                               | Bulk tag dialog; the version-conflict dialog                                                             |
| `SnackbarContainer` + `useSnackbar`                                                                                     | Toasts                                                                                                   |
| `NotFoundState`, `ErrorState` (on `StateMessage`)                                                                       | Not found; a query that failed, with Retry                                                               |
| `Skeleton`, `Loader`, `Tooltip`, `Stack` / `HStack` / `VStack`, `Text`, `Heading`, `Divider`, `Button`                  | Throughout                                                                                               |
| App wrappers: `FiltersPanel`, `ContactsToolbar`, `BulkTagDialog`, `ActivityTimeline`, `ContactDetails`, `ContactEditor` | `app/src/features/contacts/`                                                                             |

`Table` options (from `useTable`): `columns`, `rows`, `isLoading`, `loadingLayout`, `maxHeight`, `searchInputMetadata`, `sorting` / `onSortingChange` (the server sorts; the table only shows the sort), `rowSelection`, `bulkActionsMetadata`, `paginationMetadata` (pagination shows only when given), `noDataConfig`, `noSearchResultsConfig`. Columns with a `size` keep it; the others share the free width.

## Required states (from the brief)

- **Loading:** skeleton rows on the list; the previous rows stay visible (dimmed) while the next page loads. A skeleton on the detail page, and while the edit form's chunk loads.
- **No results:** "No contacts match your search or filters", with a Clear filters button.
- **Filters with no results:** the table's "search-empty" state only appears when the search box has text. With only filters applied, `noDataConfig` shows "No contacts match these filters", with Clear filters.
- **Invalid input:** errors under each field, from client checks and the backend's 422 details. "Email already used by another contact" for a 409 `EMAIL_TAKEN`. In the filters, more than 5 search words or a start date after the end date show a hint; an impossible date (31/02/2026) and a start date after the end date also show an error toast.
- **Backend or update failure:** a toast for failed actions. A full ErrorState with Retry when a page can't load. A broken or stale link (400) offers "Start over". The user's unsaved edits are never dropped.
- **Conflicting update:** on a 409 version conflict, the ConflictDialog (see "Acting as").
- **Contact not found:** a 404 (or a malformed id) on `/contacts/:id` shows a NotFoundState ("This contact doesn't exist or was removed") with a link back to the list. It's separate from the generic ErrorState.
- Any other address shows a not-found page with a link to the contacts.

## Editing and concurrency

- The detail page is read-only until the user clicks Edit. The form then has Save and Cancel.
- Save sends only the changed fields plus the version the form was loaded with.
- A Save with no changes is disabled.
- Tag changes don't bump the contact's version: tags are add and remove operations on a set, so nothing can be overwritten, and a tag change never causes a false conflict for someone editing fields.

## Data layer (RTK Query)

All server data goes through one `contactsApi` built with `createApi` and `fetchBaseQuery`, using `VITE_API_URL` as the base URL. The Redux store holds only this API slice and the row selection; search, filters, sort and page stay in the URL.

| Endpoint                                   | Type              | Provides / invalidates                                                                                  |
| ------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `getContacts` (list params from the URL)   | query             | provides `ContactList`                                                                                  |
| `getContact(id)`                           | query             | provides `Contact:id`                                                                                   |
| `updateContact(id, changes, version)`      | mutation          | invalidates `Contact:id`, `ContactList`, `Activity:id`                                                  |
| `addTag(id, tag)` / `removeTag(id, tagId)` | mutation          | invalidates `Contact:id`, `ContactList`, `Activity:id` (and `TagCatalog` when a tag is created by name) |
| `bulkAssignTag(contactIds, tag)`           | mutation          | invalidates `ContactList`, `TagCatalog`, `Contact`, all `Activity`                                      |
| `getActivity(id)`                          | query (latest 50) | provides `Activity:id`                                                                                  |
| `getTags()`                                | query             | provides `TagCatalog`                                                                                   |

- **Cache tag names:** RTK Query's cache "tags" are unrelated to contact tags, so the types are `Contact`, `ContactList`, `Activity` and `TagCatalog`, with a code comment saying so.
- **Errors:** the wrapped base query turns the backend's error format into one typed union: version conflict, email taken, validation, not found, bad request, rate limited, unavailable, network and server.
- **Conflicts:** `updateContact(...).unwrap()`. A 409 version conflict opens the ConflictDialog with the latest values from the response. A 422 maps to errors under the fields.
- **Tag changes** are optimistic: the cached contact is updated in `onQueryStarted` with `updateQueryData`, and rolled back if the request fails.
- **Search:** the box updates at once; the URL (and so `getContacts`) after a 300 ms pause.
- **List paging:** the previous page's rows stay on screen while the next one loads (`isFetching`).
- Data refetches when the window regains focus or the network comes back (`setupListeners`, `refetchOnFocus`, `refetchOnReconnect`).

## Acting as (demo users)

There's no login. To demo the brief's User A / User B conflict, each browser tab picks a display name, and the backend records it on activity entries. It's a demo label, not authentication.

- **Acting-as picker** in the top bar: Janardhan, Heer or Sheena. The choice is kept in `sessionStorage`, so each tab keeps its own user. Default: Janardhan.
- **Header:** the base query's `prepareHeaders` sets `X-Actor` from that value on every request.
- **Timeline:** each activity shows its actor. A missing actor shows as "Anonymous".
- **ConflictDialog, three-way compare** on a 409 version conflict, in a pure function (`conflict.ts`). Base = the values the form loaded with, mine = the user's edits, theirs = the latest contact from the 409.
  - Fields where theirs differs from base are marked "changed by someone else".
  - "Last changed by \<actor>, \<time>" comes from the newest activity entry.
  - If the fields they changed don't overlap with mine, **Merge both** re-saves only my changed fields on the new version.
  - **Reload latest** (drop my edits) and **Reapply my changes** (load the latest version, keep my edits in the form to review and save again) are always offered.
- **README:** "Try the conflict scenario": open the same contact in two tabs, pick Janardhan and Heer, save in Heer's tab, then save in Janardhan's and see the dialog.

## Decisions

- A two-column detail layout: contact details on the left, activity on the right. No conversations column: the brief has no messaging.
- No navigation or sidebar: only the contact list and the contact detail page, under a slim top bar (with a Light / Dark / System theme picker).
- Activity: the latest 50 only, no "Load more" (the backend's activity endpoint takes only `limit`, no cursor).
- Above 10,000 matches: cursor Prev / Next, since page numbers need an exact count.
- The created-date range filter is included.
- Empty values show "—"; avatars show initials. No Last Activity column.
- Selection covers the current page only. The header checkbox selects the current page. Selection clears when the page, page size, search, filters or sort change, and after a successful bulk assign.
- The tag filter is single-select (the API's `tag` takes one id); the company filter is an exact name.

## Tests

Playwright end-to-end tests in `app/e2e`, against the real API and a throwaway `crm_e2e` database that each run recreates and seeds (`npm run test:e2e`, or `test:e2e:headed` to watch). No unit or component test tooling for now.

- List URL state: search, filters, sort, page size and page survive a refresh; paging above the count cap; empty results; not-found contact.
- Editing: only changed fields plus `version` are sent, with `X-Actor` from the tab's choice; validation from client checks, a 422 and `EMAIL_TAKEN`; a failed save keeps the edits; the phone country search.
- Conflicts: two tabs as Janardhan and Heer with a real 409: Merge both, no Merge both on overlap, Reload latest, Reapply my changes.
- Tags: bulk assign with its result message and cleared selection; add and remove on one contact.
- Date filters: an impossible date and a reversed range show a toast.
- Layout: the activity scroll box, long values wrapping, the one-column phone layout, the bulk dialog's alignment.

## Task order

1. Vite + TypeScript setup, routing, the Redux store with the RTK Query API slice, and environment config. **Done**
2. AppShell and the list page with a basic table. **Done**
3. Search, filters, sort and pagination, all in the URL. **Done**
4. Detail page in read-only view, plus the activity timeline. **Done**
5. Edit mode, validation and the ConflictDialog. **Done**
6. Tag add and remove, then bulk assign. **Done**
7. Loading, empty and error states throughout. **Done**
8. Acting-as picker and the three-way ConflictDialog. **Done**
9. Tests (Playwright, end to end). **Done**
10. Prepare for Vercel: `VITE_API_URL` is the only build setting, `frontend/vercel.json` holds the build and the SPA rewrite, and the README has "Deploying to Vercel (manual, via dashboard)". Manish deploys by hand in the dashboard; Claude Code never uses the Vercel CLI. **Done**
