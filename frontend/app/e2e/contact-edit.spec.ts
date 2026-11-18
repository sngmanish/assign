import { expect, test } from '@playwright/test';
import { actAs, contactWithEmail, nthContact, openForEdit, unique } from './helpers';

test.describe('editing a contact', () => {
  test('sends only the changed field, with X-Actor, and logs it', async ({ page, request }) => {
    const contact = await nthContact(request, 10);
    const company = unique('Acme');

    // pick Heer with the top-bar picker (the choice is per tab)
    await page.goto(`/contacts/${contact.id}`);
    await page.getByRole('button', { name: /Acting as/ }).click();
    await page.getByRole('option', { name: 'Heer' }).click();

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Company').fill(company);

    const patch = page.waitForRequest(
      (r) => r.method() === 'PATCH' && r.url().includes(`/contacts/${contact.id}`),
    );
    await page.getByRole('button', { name: 'Save' }).click();
    const req = await patch;

    expect(req.headers()['x-actor']).toBe('Heer');
    expect(req.postDataJSON()).toEqual({ company, version: contact.version });

    await expect(page.getByText('Contact saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByText(company).first()).toBeVisible();
    await expect(page.getByText(/Heer.*changed company/).first()).toBeVisible();
  });

  test('Save stays disabled until something changes; Cancel drops edits', async ({
    page,
    request,
  }) => {
    const contact = await nthContact(request, 11);
    await openForEdit(page, contact.id);
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await page.getByLabel('Company').fill(unique('Draft'));
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(contact.company ?? '—').first()).toBeVisible();
  });

  test('client-side checks show errors under the fields', async ({ page, request }) => {
    const contact = await nthContact(request, 12);
    await openForEdit(page, contact.id);

    await page.getByLabel('First name').fill('');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('First name is required').first()).toBeVisible();
    await expect(page.getByText('Enter a valid email address').first()).toBeVisible();
  });

  test('409 EMAIL_TAKEN shows under the email field', async ({ page, request }) => {
    const other = await contactWithEmail(request, 20);
    const contact = await nthContact(request, 13);
    await openForEdit(page, contact.id);

    await page.getByLabel('Email').fill(other.email!);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Email already used by another contact').first()).toBeVisible();
    // the edit is kept
    await expect(page.getByLabel('Email')).toHaveValue(other.email!);
  });

  test("a 422 from the server maps to the field's error", async ({ page, request }) => {
    const contact = await nthContact(request, 14);
    await page.route(`**/contacts/${contact.id}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid contact',
            details: [{ path: 'company', message: 'Company name is not allowed' }],
          },
        }),
      });
    });
    await openForEdit(page, contact.id);

    await page.getByLabel('Company').fill(unique('Blocked'));
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Company name is not allowed').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('a failed save keeps the edits and shows a toast', async ({ page, request }) => {
    const contact = await nthContact(request, 15);
    await actAs(page.context(), 'Sheena');
    await page.route(`**/contacts/${contact.id}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL', message: 'Server exploded' } }),
          })
        : route.fallback(),
    );
    await openForEdit(page, contact.id);

    const company = unique('Kept');
    await page.getByLabel('Company').fill(company);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText(/Could not save/)).toBeVisible();
    await expect(page.getByLabel('Company')).toHaveValue(company);
  });

  test('the phone country picker searches by name and calling code', async ({ page, request }) => {
    const contact = await nthContact(request, 16);
    await openForEdit(page, contact.id);
    await page.getByRole('button', { name: 'Select country' }).click();
    const search = page.getByPlaceholder('Search a country or country code');

    await search.fill('xyzq');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.getByText('No results found')).toBeVisible();

    await search.fill('+91');
    await expect(page.getByRole('option')).toHaveText(['India (+91)']);
    await page.getByRole('option', { name: 'India (+91)' }).click();
    await expect(page.locator('#contact-phone')).toHaveValue(/^\+91/);
  });
});
