import { expect, test } from '@playwright/test';

test.describe('contacts list', () => {
  test('opens on the list with the seeded contacts', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
    // 20 rows on the first page, each with its own "Select …" checkbox
    await expect(page.getByRole('checkbox', { name: /^Select (?!all)/ })).toHaveCount(20);
  });

  test('search goes into the URL (debounced) and survives a reload', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('searchbox', { name: 'Search contacts' }).fill('Olivia');
    await expect(page).toHaveURL(/[?&]q=Olivia/);
    await expect(page.getByRole('link', { name: /Olivia/ }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('searchbox', { name: 'Search contacts' })).toHaveValue('Olivia');
    await expect(page.getByRole('link', { name: /Olivia/ }).first()).toBeVisible();
  });

  test('sort, page size and page from the URL survive a reload', async ({ page }) => {
    // page numbers need an exact count, so stay under the 10,000 cap with a search
    await page.goto('/contacts?q=Olivia&sort=name&limit=50&page=2');
    const rows = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    await expect(rows.first()).toBeAttached();
    const firstName = await rows.first().getAttribute('aria-label');

    await page.reload();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page).toHaveURL(/limit=50/);
    await expect(page).toHaveURL(/page=2/);
    await expect(rows.first()).toHaveAttribute('aria-label', firstName!);
  });

  test('above 10,000 matches: page numbers are refused, Prev/Next pages instead', async ({
    page,
  }) => {
    await page.goto('/contacts?page=3');
    await expect(
      page.getByText('Page numbers are not available for results this long.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to the first page' }).click();
    await expect(page).not.toHaveURL(/page=/);

    const rows = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    const first = await rows.first().getAttribute('aria-label');
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(rows.first()).not.toHaveAttribute('aria-label', first!);
  });

  test('a search with no matches offers to clear it', async ({ page }) => {
    await page.goto('/contacts?q=zzzqqqxxy');
    await expect(page.getByText('No contacts match your search or filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByRole('checkbox', { name: /^Select (?!all)/ })).toHaveCount(20);
  });

  test('an unknown contact shows "not found" with a way back', async ({ page }) => {
    await page.goto('/contacts/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Contact not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to contacts' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
  });

  test('an impossible date in the filters is flagged with a toast', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('button', { name: /Filters/ }).click();
    const from = page.locator('#filter-created-from');
    await from.click();
    await from.pressSequentially('31022026');
    await expect(page.getByText('31/02/2026 is not a valid date')).toBeVisible();
    await expect(page).not.toHaveURL(/createdFrom/);
  });

  test('a start date after the end date is flagged with a toast', async ({ page }) => {
    await page.goto('/contacts?createdFrom=2026-03-01&createdTo=2026-01-01');
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'The start date must be on or before the end date' }),
    ).toBeVisible();
  });
});
