import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

/** The API the e2e run starts (see playwright.config.ts). */
export const API_URL = 'http://localhost:3100';

export interface ApiContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version: number;
}

/**
 * The `n`th seeded contact by name. Tests run in parallel against one database, so each test
 * that changes a contact takes its own `n` (and never changes names, which keeps the order).
 */
export async function nthContact(request: APIRequestContext, n: number): Promise<ApiContact> {
  const res = await request.get(`${API_URL}/contacts`, {
    params: { sort: 'name', order: 'asc', limit: 100 },
  });
  expect(res.ok()).toBe(true);
  const { items } = (await res.json()) as { items: ApiContact[] };
  const contact = items[n];
  if (!contact) throw new Error(`No contact at position ${n}`);
  return contact;
}

/** The first contact (from position `from` on) that has an email. */
export async function contactWithEmail(
  request: APIRequestContext,
  from: number,
): Promise<ApiContact> {
  for (let n = from; n < 100; n++) {
    const c = await nthContact(request, n);
    if (c.email) return c;
  }
  throw new Error('No seeded contact with an email');
}

/** Make every page in `context` act as `user` (the tab's sessionStorage choice). */
export async function actAs(context: BrowserContext, user: 'Janardhan' | 'Heer' | 'Sheena') {
  await context.addInitScript((u) => sessionStorage.setItem('crm.actingAs', u), user);
}

/** Open a contact and switch its details to edit mode. */
export async function openForEdit(page: Page, id: string) {
  await page.goto(`/contacts/${id}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
}

/** A name no other test (or earlier run) uses. */
export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
