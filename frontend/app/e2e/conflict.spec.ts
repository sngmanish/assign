import { expect, test, type Browser, type Page } from '@playwright/test';
import { actAs, nthContact, openForEdit, unique } from './helpers';

/** A separate browser context (its own tab storage) acting as `user`. */
async function tabAs(browser: Browser, user: 'Janardhan' | 'Heer'): Promise<Page> {
  const context = await browser.newContext();
  await actAs(context, user);
  return context.newPage();
}

// The brief's User A / User B scenario: two tabs edit the same contact; the second save is stale.
test.describe('editing conflicts', () => {
  test('different fields: Merge both keeps both changes', async ({ browser, request }) => {
    const contact = await nthContact(request, 30);
    const janardhan = await tabAs(browser, 'Janardhan');
    const heer = await tabAs(browser, 'Heer');
    await openForEdit(janardhan, contact.id);
    await openForEdit(heer, contact.id);

    const heerCompany = unique('HeerCo');
    await heer.getByLabel('Company').fill(heerCompany);
    await heer.getByRole('button', { name: 'Save' }).click();
    await expect(heer.getByText('Contact saved')).toBeVisible();

    const aliceEmail = `${unique('janardhan')}@example.com`;
    await janardhan.getByLabel('Email').fill(aliceEmail);
    await janardhan.getByRole('button', { name: 'Save' }).click();

    const dialog = janardhan.getByRole('dialog');
    await expect(dialog.getByText('This contact was changed by someone else')).toBeVisible();
    await expect(dialog.getByText(heerCompany)).toBeVisible();
    await expect(dialog.getByText(/Last changed by Heer/)).toBeVisible();

    await dialog.getByRole('button', { name: 'Merge both' }).click();
    await expect(janardhan.getByText('Contact saved')).toBeVisible();
    await expect(janardhan.getByText(heerCompany).first()).toBeVisible();
    await expect(janardhan.getByText(aliceEmail).first()).toBeVisible();

    await janardhan.context().close();
    await heer.context().close();
  });

  test('same field: no Merge both; Reload latest drops my edit', async ({ browser, request }) => {
    const contact = await nthContact(request, 31);
    const janardhan = await tabAs(browser, 'Janardhan');
    const heer = await tabAs(browser, 'Heer');
    await openForEdit(janardhan, contact.id);
    await openForEdit(heer, contact.id);

    const heerCompany = unique('HeerCo');
    await heer.getByLabel('Company').fill(heerCompany);
    await heer.getByRole('button', { name: 'Save' }).click();
    await expect(heer.getByText('Contact saved')).toBeVisible();

    await janardhan.getByLabel('Company').fill(unique('JanardhanCo'));
    await janardhan.getByRole('button', { name: 'Save' }).click();

    const dialog = janardhan.getByRole('dialog');
    await expect(dialog.getByText('This contact was changed by someone else')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Merge both' })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Reload latest' }).click();
    await expect(janardhan.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(janardhan.getByText(heerCompany).first()).toBeVisible();

    await janardhan.context().close();
    await heer.context().close();
  });

  test('Reapply my changes loads the latest and keeps my edit for review', async ({
    browser,
    request,
  }) => {
    const contact = await nthContact(request, 32);
    const janardhan = await tabAs(browser, 'Janardhan');
    const heer = await tabAs(browser, 'Heer');
    await openForEdit(janardhan, contact.id);
    await openForEdit(heer, contact.id);

    await heer.getByLabel('Company').fill(unique('HeerCo'));
    await heer.getByRole('button', { name: 'Save' }).click();
    await expect(heer.getByText('Contact saved')).toBeVisible();

    const janardhanCompany = unique('JanardhanCo');
    await janardhan.getByLabel('Company').fill(janardhanCompany);
    await janardhan.getByRole('button', { name: 'Save' }).click();
    await janardhan.getByRole('dialog').getByRole('button', { name: 'Reapply my changes' }).click();

    // still editing, my value in the form, and now saving goes through on the new version
    await expect(janardhan.getByLabel('Company')).toHaveValue(janardhanCompany);
    await janardhan.getByRole('button', { name: 'Save' }).click();
    await expect(janardhan.getByText('Contact saved')).toBeVisible();
    await expect(janardhan.getByText(janardhanCompany).first()).toBeVisible();

    await janardhan.context().close();
    await heer.context().close();
  });
});
