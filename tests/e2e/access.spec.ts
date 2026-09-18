/**
 * Keyboard, names and roles, layout at phone width, and reduced motion.
 * These run on both projects, so the phone project exercises the tabbed layout
 * and the desktop project the three-column one.
 */
import { expect, test } from '@playwright/test';
import { decide, isNarrow, openOption, setFact, showSection } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

test('the whole flow works from the keyboard alone', async ({ page }) => {
  await showSection(page, 'record');
  const row = page.getByTestId('option-palette-openHarbor');
  await row.focus();
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');

  const detail = await row.getAttribute('aria-controls');
  const reason = page.locator(`#${(detail ?? '').replace(/:/g, '\\:')}-reason`);
  await reason.focus();
  await page.keyboard.type('Typed with no mouse at all.');
  await expect(reason).toHaveValue('Typed with no mouse at all.');

  await page.getByTestId('accept-palette-openHarbor').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status-palette-openHarbor')).toHaveText('Accepted');

  await page.getByTestId('undo').focus();
  await expect(page.getByTestId('undo')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status-palette-openHarbor')).toHaveText('Open');
});

test('every control has a name, and the focused one is visibly outlined', async ({ page }) => {
  await showSection(page, 'record');
  const controls = page.locator('button:visible, input:visible, select:visible, textarea:visible, a:visible');
  const count = await controls.count();
  expect(count).toBeGreaterThan(10);

  const unnamed: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const control = controls.nth(i);
    const [text, aria, label, title, id] = await Promise.all([
      control.innerText().catch(() => ''),
      control.getAttribute('aria-label'),
      control.getAttribute('aria-labelledby'),
      control.getAttribute('title'),
      control.getAttribute('id'),
    ]);
    const labelled = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
    // A wrapping label names its control too, so it counts.
    const wrapped = await control.evaluate((node) => Boolean(node.closest('label')?.textContent?.trim()));
    if (!text.trim() && !aria && !label && !title && !labelled && !wrapped) {
      unnamed.push(await control.evaluate((node) => node.outerHTML.slice(0, 120)));
    }
  }
  expect(unnamed, 'controls with no accessible name').toEqual([]);

  // Focus has to arrive by keyboard: :focus-visible deliberately stays quiet
  // for a touch or pointer press, so a programmatic focus proves nothing.
  // Walking forward from the first control also confirms the ring follows
  // through the panels rather than sitting on one element.
  await page.getByTestId('saving-toggle').focus();
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const node = document.activeElement;
      if (!node || node === document.body) return null;
      const style = getComputedStyle(node);
      return {
        tag: node.tagName,
        width: style.outlineWidth,
        style: style.outlineStyle,
        colour: style.outlineColor,
      };
    });
    expect(ring, `nothing was focused after ${step + 1} tab presses`).not.toBeNull();
    if (!ring) break;
    expect(ring.style, `${ring.tag} shows no outline when focused by keyboard`).not.toBe('none');
    expect(Number.parseFloat(ring.width), `${ring.tag} outline is too thin`).toBeGreaterThanOrEqual(2);
    expect(ring.colour, `${ring.tag} outline is transparent`).not.toBe('rgba(0, 0, 0, 0)');
  }
});

test('no essential control is clipped and the page never scrolls sideways', async ({ page }) => {
  // Reach a state with the most furniture on screen: accepted, needing review.
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored.');
  await setFact(page, 'who', 'Adults returning to drawing after a long gap away from it');
  await showSection(page, 'record');
  await openOption(page, 'palette', 'quarterdeck');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'the page should not scroll sideways').toBeLessThanOrEqual(0);

  const viewport = page.viewportSize();
  const width = viewport?.width ?? 0;
  for (const testId of ['undo', 'open-sheet', 'saving-toggle', 'accept-palette-quarterdeck']) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} has no box`).not.toBeNull();
    if (!box) continue;
    expect(box.x, `${testId} starts off-screen`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${testId} runs past the viewport`).toBeLessThanOrEqual(width + 1);
  }

  // The option name is never squeezed into a column of single characters.
  const nameBox = await page.locator('[data-testid="option-palette-quarterdeck"] .option-name').boundingBox();
  expect(nameBox).not.toBeNull();
  if (nameBox) {
    expect(nameBox.width, 'the direction name is being squeezed').toBeGreaterThan(60);
    expect(nameBox.height, 'the direction name has wrapped onto several lines').toBeLessThan(30);
  }
});

test('touch targets in the record are big enough to hit', async ({ page }) => {
  await openOption(page, 'voice', 'ledger');
  for (const testId of ['option-voice-ledger', 'accept-voice-ledger', 'reject-voice-ledger']) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, testId).not.toBeNull();
    if (box) expect(box.height, `${testId} is only ${box.height}px tall`).toBeGreaterThanOrEqual(40);
  }
});

test('the phone layout uses tabs and keeps all three panels reachable', async ({ page }) => {
  test.skip(!(await isNarrow(page)), 'only applies below 1000px');

  const tabs = page.getByRole('tablist', { name: 'Sections' });
  await expect(tabs).toBeVisible();
  await expect(page.getByTestId('section-tab-stage')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Preview', level: 2 })).toBeVisible();

  await page.getByTestId('section-tab-brief').click();
  await expect(page.getByRole('heading', { name: 'Business brief', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preview', level: 2 })).toHaveCount(0);

  await page.getByTestId('section-tab-record').click();
  await expect(page.getByRole('heading', { name: 'Decision record', level: 2 })).toBeVisible();

  // The standings strip keeps the record's state visible from any tab.
  await decide(page, 'voice', 'openHarbor', 'accept', 'Right for a first email.');
  await page.getByTestId('section-tab-stage').click();
  await expect(page.getByTestId('standing-voice')).toContainText('Open Harbor');
});

test('the desktop layout shows all three panels at once', async ({ page }) => {
  test.skip(await isNarrow(page), 'only applies at 1000px and above');
  await expect(page.getByRole('heading', { name: 'Business brief', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preview', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Decision record', level: 2 })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Sections' })).toHaveCount(0);
});

test('reduced motion removes the transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await showSection(page, 'record');
  const duration = await page
    .getByTestId('open-sheet')
    .evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThan(0.01);
});

test('the export sheet is a real dialog that closes on Escape', async ({ page }) => {
  await page.getByTestId('open-sheet').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Export or reopen', level: 2 })).toBeVisible();
  await expect(page.getByText(/if saving in this browser is on, the stored copy is replaced/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the skip link reaches the preview', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to the preview' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page).toHaveURL(/#stage$/);
});
