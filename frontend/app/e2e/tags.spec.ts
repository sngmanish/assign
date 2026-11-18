import { expect, test } from '@playwright/test';
import { nthContact, unique } from './helpers';

test.describe('tags', () => {
  test('bulk: tag the selected contacts and report the result', async ({ page }) => {
    const tag = unique('bulk');
    // a search narrow enough to be stable while other tests edit companies and emails
    await page.goto('/contacts?q=Hiroshi&sort=name');
    const rows = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    await expect(rows.nth(2)).toBeAttached();

    // the native input is visually hidden: click its drawn box (the label), as a user does
    for (const i of [0, 1, 2]) {
      const id = await rows.nth(i).getAttribute('id');
      await page.locator(`label[for="${id}"]`).click();
      await expect(rows.nth(i)).toBeChecked();
    }

    await page.getByRole('button', { name: 'Add tag' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add a tag to 3 contacts')).toBeVisible();
    await dialog.getByRole('button', { name: 'Choose a tag' }).click();
    await page.getByRole('searchbox').last().fill(tag);
    await page.getByRole('button', { name: `Create "${tag}"` }).click();

    await expect(page.getByText(`Tag ${tag}: added to 3 contacts`)).toBeVisible();
    // the selection is cleared after a successful assign
    await expect(rows.nth(0)).not.toBeChecked();
  });

  test('add and remove a tag on one contact', async ({ page, request }) => {
    const contact = await nthContact(request, 40);
    const tag = unique('single');
    await page.goto(`/contacts/${contact.id}`);

    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.getByRole('searchbox').last().fill(tag);
    await page.getByRole('button', { name: `Create "${tag}"` }).click();
    await expect(page.getByText(`added tag ${tag}`)).toBeVisible();

    await page.getByRole('button', { name: `Remove ${tag}` }).click();
    await expect(page.getByText(`removed tag ${tag}`)).toBeVisible();
  });
});
