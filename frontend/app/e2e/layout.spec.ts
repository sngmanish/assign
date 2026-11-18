import { expect, test } from '@playwright/test';
import { nthContact, openForEdit } from './helpers';

const noHorizontalScroll = () => document.documentElement.scrollWidth <= window.innerWidth;

test.describe('layout', () => {
  test('a long history scrolls inside a fixed-height activity box', async ({ page, request }) => {
    const contact = await nthContact(request, 50);
    // 50 entries, more than fit: served from here so no test has to make 50 changes
    await page.route('**/activities?*', (route) =>
      route.fulfill({
        json: {
          items: Array.from({ length: 50 }, (_, i) => ({
            id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
            contactId: contact.id,
            type: 'TAG_ADDED',
            actor: 'Heer',
            details: { tagName: `tag-${i}` },
            createdAt: new Date(Date.now() - i * 60_000).toISOString(),
          })),
        },
      }),
    );
    await page.goto(`/contacts/${contact.id}`);

    const region = page.getByRole('region', { name: 'Activity history' });
    await expect(region.getByText('added tag tag-0')).toBeVisible();
    const box = await region.evaluate((el: HTMLElement) => ({
      scrolls: el.scrollHeight > el.clientHeight,
      height: el.clientHeight,
      scrollbar: el.offsetWidth - el.clientWidth,
    }));
    expect(box.scrolls).toBe(true);
    expect(box.height).toBeLessThanOrEqual(560);
    // the scroll bar's space is always reserved (a fixed 8px; headless browsers may report 0)
    expect([0, 8]).toContain(box.scrollbar);

    // keyboard users can focus the box and scroll it
    await region.focus();
    await page.keyboard.press('End');
    await expect(region.getByText('added tag tag-49')).toBeInViewport();
  });

  test('a long unbroken company wraps instead of widening the page', async ({ page, request }) => {
    const contact = await nthContact(request, 51);
    await openForEdit(page, contact.id);
    await page.getByLabel('Company').fill('X'.repeat(200));
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Contact saved')).toBeVisible();

    expect(await page.evaluate(noHorizontalScroll)).toBe(true);
  });

  test('on a phone the detail page is one column', async ({ page, request }) => {
    const contact = await nthContact(request, 52);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/contacts/${contact.id}`);

    const details = page.getByRole('heading', { name: 'Details' });
    const activity = page.getByRole('heading', { name: 'Recent activity' });
    await expect(details).toBeVisible();
    const [d, a] = [await details.boundingBox(), await activity.boundingBox()];
    // activity sits below the details, not squeezed beside them
    expect(a!.y).toBeGreaterThan(d!.y);
    expect(await page.evaluate(noHorizontalScroll)).toBe(true);
  });

  test('the bulk tag dialog lines its text up with the title', async ({ page }) => {
    await page.goto('/contacts');
    const row = page.getByRole('checkbox', { name: /^Select (?!all)/ }).first();
    const id = await row.getAttribute('id');
    await page.locator(`label[for="${id}"]`).click();
    await page.getByRole('button', { name: 'Add tag' }).click();

    const dialog = page.getByRole('dialog');
    // measure after the open animation (it fades and scales in)
    await expect(dialog.getByRole('heading')).toBeVisible();
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    const title = await dialog.getByRole('heading').boundingBox();
    const text = await dialog.getByText(/^Choose a tag, or type/).boundingBox();
    const button = await dialog.getByRole('button', { name: 'Choose a tag' }).boundingBox();
    expect(Math.abs(title!.x - text!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(text!.x - button!.x)).toBeLessThanOrEqual(1);
    // a clear gap between the text and the button
    expect(button!.y - (text!.y + text!.height)).toBeGreaterThanOrEqual(12);
  });
});
