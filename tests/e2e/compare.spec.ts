/**
 * The "Compare one thing" journey in a real browser: the one-axis invariant as
 * it actually renders, choosing without deciding, the explicit save, and what
 * the exports carry.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { decide, downloadBrief, downloadWorksheet, isNarrow, reopen, setFact, showSection } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

async function openCompare(page: Page): Promise<void> {
  await showSection(page, 'stage');
  await page.getByTestId('open-compare').click();
  await expect(page.getByRole('heading', { name: 'Compare one thing', level: 2 })).toBeVisible();
}

/** The palette, type and voice each rendered side is actually built from. */
async function sidePicks(page: Page, label: 'A' | 'B') {
  return page.locator(`[data-testid="compare-canvas-${label}"] .pv`).evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      pageBg: style.getPropertyValue('--pv-page-bg').trim(),
      heroBg: style.getPropertyValue('--pv-hero-bg').trim(),
      headingFamily: style.getPropertyValue('--pv-heading-family').trim(),
      radius: style.getPropertyValue('--pv-radius').trim(),
      text: node.textContent ?? '',
    };
  });
}

async function chooseAndSave(
  page: Page,
  side: 'A' | 'B',
  statement: string,
  scope: 'thisExample' | 'customerFacing',
): Promise<void> {
  await page.getByTestId(`compare-choose-${side}`).click();
  await page.getByTestId('compare-statement').fill(statement);
  await page.getByTestId(`compare-scope-${scope}`).check();
  await page.getByTestId('compare-save').click();
  await expect(page.getByTestId('compare-saved')).toBeVisible();
}

/* ------------------------------------------------------ the one-axis rule */

test('palette: only the colours differ between the two sides', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-axis-palette').click();

  const a = await sidePicks(page, 'A');
  const b = await sidePicks(page, 'B');

  expect(a.heroBg).not.toBe(b.heroBg);
  expect(a.pageBg).not.toBe(b.pageBg);
  expect(a.headingFamily).toBe(b.headingFamily);
  expect(a.radius).toBe(b.radius);
  expect(a.text).toBe(b.text);
  await expect(page.getByTestId('compare-held')).toContainText('Only the colours change');
});

test('typography: type and shape move together, and the desk says so', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-axis-typography').click();

  const a = await sidePicks(page, 'A');
  const b = await sidePicks(page, 'B');

  expect(a.headingFamily).not.toBe(b.headingFamily);
  expect(a.radius).not.toBe(b.radius);
  expect(a.heroBg).toBe(b.heroBg);
  expect(a.pageBg).toBe(b.pageBg);
  expect(a.text).toBe(b.text);

  // Honest naming: this is a treatment, not a font-only experiment.
  await expect(page.getByTestId('compare-axis-typography')).toHaveText('Typography treatment');
  await expect(page.getByTestId('compare-held')).toContainText('typeface and the shapes change together');
  await expect(page.getByTestId('compare-held')).toContainText('not a font test');
});

test('voice: only the words differ, and they are the words on screen', async ({ page }) => {
  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('Wording I wrote myself');
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();

  const a = await sidePicks(page, 'A');
  const b = await sidePicks(page, 'B');

  expect(a.heroBg).toBe(b.heroBg);
  expect(a.headingFamily).toBe(b.headingFamily);
  expect(a.radius).toBe(b.radius);
  expect(a.text).not.toBe(b.text);
  // Side A is the Quarterdeck voice, whose headline was rewritten by hand.
  expect(a.text).toContain('Wording I wrote myself');
  expect(b.text).not.toContain('Wording I wrote myself');
  await expect(page.getByTestId('compare-held')).toContainText('including any wording you have rewritten by hand');
});

test('the surface is held the same on both sides, and can be switched together', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-surface-email').click();
  await expect(page.getByTestId('compare-held')).toContainText('the customer email');

  for (const label of ['A', 'B'] as const) {
    await expect(page.locator(`[data-testid="compare-canvas-${label}"] .pv-email-card`)).toBeVisible();
  }
  await page.getByTestId('compare-surface-homepage').click();
  for (const label of ['A', 'B'] as const) {
    await expect(page.locator(`[data-testid="compare-canvas-${label}"] .pv-hero`)).toBeVisible();
  }
});

test('the business facts are the same on both sides', async ({ page }) => {
  await setFact(page, 'name', 'Northline Books');
  await openCompare(page);
  for (const label of ['A', 'B'] as const) {
    await expect(page.locator(`[data-testid="compare-canvas-${label}"]`)).toContainText('Northline Books');
  }
  await expect(page.getByTestId('compare-held')).toContainText('Northline Books');
});

/* ------------------------------------------------------ choosing and saving */

test('choosing a side changes the stage and nothing else', async ({ page }) => {
  await decide(page, 'palette', 'ledger', 'accept', 'Accepted before any comparison.');
  await decide(page, 'typography', 'openHarbor', 'reject', 'Rejected before any comparison.');
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();

  const picked = await page.locator('[data-testid="compare-side-B"] .compare-side-name').innerText();
  await page.getByTestId('compare-choose-B').click();

  // The chosen one becomes side A and goes on the stage.
  await expect(page.locator('[data-testid="compare-side-A"] .compare-side-name')).toHaveText(picked);
  await expect(page.locator('[data-testid="compare-side-A"]')).toContainText('On the stage');

  await page.getByTestId('compare-close').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');
  await expect(page.getByTestId('status-typography-openHarbor')).toHaveText('Rejected');
  for (const option of ['quarterdeck', 'openHarbor', 'ledger']) {
    await expect(page.getByTestId(`status-voice-${option}`)).toHaveText('Open');
  }
  await expect(page.getByTestId('no-preferences')).toBeVisible();
  await expect(page.getByTestId('standing-voice')).toContainText('not chosen yet');
});

test('leaving without saving records nothing', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-choose-B').click();
  await page.getByTestId('compare-statement').fill('A thought I decided not to keep.');
  await page.getByTestId('compare-keep-exploring').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('no-preferences')).toBeVisible();

  const file = await downloadWorksheet(page);
  expect((JSON.parse(file.text) as { content: { preferences: unknown[] } }).content.preferences).toEqual([]);
});

test('saving will not proceed without their own words and a scope', async ({ page }) => {
  await openCompare(page);

  await page.getByTestId('compare-save').click();
  await expect(page.getByTestId('compare-problem')).toContainText('Choose which of the two you preferred first');

  await page.getByTestId('compare-choose-A').click();
  await page.getByTestId('compare-save').click();
  await expect(page.getByTestId('compare-problem')).toContainText('in your own words');
  await expect(page.getByTestId('compare-problem')).toContainText('will not write this for you');

  await page.getByTestId('compare-statement').fill('The slate ground reads as considered.');
  await page.getByTestId('compare-save').click();
  await expect(page.getByTestId('compare-problem')).toContainText('how far this preference goes');

  // The dialog is modal, so it has to be closed before the page behind it.
  await page.getByTestId('compare-close').click();
  await showSection(page, 'record');
  await expect(page.getByTestId('no-preferences')).toBeVisible();
});

test('a saved preference records the side that was actually chosen', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();
  const picked = await page.locator('[data-testid="compare-side-B"] .compare-side-name').innerText();
  const other = await page.locator('[data-testid="compare-side-A"] .compare-side-name').innerText();

  await chooseAndSave(page, 'B', 'The warmer opening read like a person writing.', 'customerFacing');
  await expect(page.getByTestId('compare-saved')).toContainText(`you preferred ${picked} over ${other}`);
  await page.getByTestId('compare-close').click();

  await showSection(page, 'record');
  await expect(page.locator('.preference-summary')).toHaveText(
    `Voice: ${picked} preferred over ${other} on the homepage`,
  );
});

test('a saved preference appears in the record with its scope and can be removed', async ({ page }) => {
  await openCompare(page);
  await chooseAndSave(page, 'A', 'Anchored, and it suits printed work.', 'thisExample');
  await page.getByTestId('compare-close').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('Anchored, and it suits printed work.');
  await expect(page.getByTestId('preference-list')).toContainText('This example, on this surface');
  await expect(page.getByTestId('preference-list')).toContainText('Held still: Typography treatment');

  const remove = page.locator('[data-testid^="remove-preference-"]');
  await remove.click();
  await expect(page.getByTestId('no-preferences')).toBeVisible();

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('preference-list')).toContainText('Anchored, and it suits printed work.');

  // And undoing again takes the save itself back.
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('no-preferences')).toBeVisible();
});

test('a preference is never a rule: nothing is accepted and no option is hidden', async ({ page }) => {
  await openCompare(page);
  await chooseAndSave(page, 'A', 'Quieter, and the work reads first.', 'customerFacing');
  await page.getByTestId('compare-close').click();

  await showSection(page, 'record');
  for (const category of ['palette', 'typography', 'voice']) {
    for (const option of ['quarterdeck', 'openHarbor', 'ledger']) {
      await expect(page.getByTestId(`status-${category}-${option}`)).toHaveText('Open');
      await expect(page.getByTestId(`option-${category}-${option}`)).toBeVisible();
    }
  }
  const section = page.locator('#preferences');
  await expect(section).toContainText('They are notes, not rules');
  await expect(section).toContainText('nothing leaves this worksheet on its own');
  await expect(section).toContainText('does not isolate which attribute caused the reaction');
});

test('a preference does not overwrite anyone’s copy', async ({ page }) => {
  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('My own headline, kept');
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();
  await chooseAndSave(page, 'B', 'The other voice reads better cold.', 'thisExample');
  await page.getByTestId('compare-close').click();

  await showSection(page, 'stage');
  await page.selectOption('#mix-voice', 'quarterdeck');
  await showSection(page, 'brief');
  await expect(page.locator('#draft-quarterdeck-headline')).toHaveValue('My own headline, kept');
});

/* -------------------------------------------------------------- staleness */

test('changing a fact flags the preference for review without rewriting its evidence', async ({ page }) => {
  await openCompare(page);
  await chooseAndSave(page, 'A', 'The slate ground reads as considered.', 'customerFacing');
  await page.getByTestId('compare-close').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).not.toContainText('Review');

  await setFact(page, 'name', 'Northline Books');
  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('Review');
  await expect(page.getByTestId('preference-list')).toContainText('conditions have moved');
  await expect(page.getByTestId('preference-list')).toContainText('Halyard Studio');
  await expect(page.getByTestId('preference-list')).toContainText('The slate ground reads as considered.');

  const brief = await downloadBrief(page);
  expect(brief.text).toContain('**Needs review before this is read as current.**');
  expect(brief.text).toContain('**Business name at the time:** `Halyard Studio`');
  expect(brief.text).toContain('only the conditions have moved');
});

test('changing the compared wording flags the preference for review', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();
  await chooseAndSave(page, 'A', 'Reads calmly.', 'thisExample');
  await page.getByTestId('compare-close').click();

  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('Completely different wording now');
  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('the wording that was compared has changed');
});

/* ---------------------------------------------------------------- exports */

test('both exports carry the preference, its scope and its provenance', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-surface-email').click();
  await chooseAndSave(page, 'A', 'The formal opening suits a first message.', 'customerFacing');
  await page.getByTestId('compare-close').click();

  const worksheet = await downloadWorksheet(page);
  const parsed = JSON.parse(worksheet.text) as {
    schemaVersion: number;
    content: {
      preferences: Array<{
        axis: string;
        chosen: string;
        against: string;
        scope: string;
        statement: string;
        evidence: {
          surface: string;
          held: Record<string, string>;
          facts: Record<string, string>;
          chosenCopy: Record<string, string>;
          againstCopy: Record<string, string>;
        };
      }>;
    };
  };
  expect(parsed.schemaVersion).toBe(2);
  const [preference] = parsed.content.preferences;
  expect(preference?.axis).toBe('palette');
  expect(preference?.scope).toBe('customerFacing');
  expect(preference?.statement).toBe('The formal opening suits a first message.');
  expect(preference?.evidence.surface).toBe('email');
  expect(preference?.evidence.facts.name).toBe('Halyard Studio');
  expect(preference?.evidence.held[preference.axis]).toBe(preference?.chosen);
  expect(Object.keys(preference?.evidence.chosenCopy ?? {}).sort()).toEqual(['emailBody', 'emailSubject']);

  const brief = await downloadBrief(page);
  expect(brief.text).toContain('## Preferences from side-by-side comparisons');
  expect(brief.text).toContain("**How far it goes:** This project's customer-facing work");
  expect(brief.text).toContain('The formal opening suits a first message.');
  expect(brief.text).toContain('- **Held still:** Typography treatment');
  expect(brief.text).toContain('It does not instruct anything.');
  expect(brief.text).toContain('nothing here is synchronised with any other tool');
});

test('a worksheet with preferences reopens exactly, and undo still works', async ({ page }) => {
  await decide(page, 'palette', 'ledger', 'accept', 'A decision that must survive.');
  await openCompare(page);
  await page.getByTestId('compare-axis-voice').click();
  await chooseAndSave(page, 'A', 'Kept through the round trip.', 'thisExample');
  await page.getByTestId('compare-close').click();

  const file = await downloadWorksheet(page);

  await page.reload();
  await showSection(page, 'record');
  await expect(page.getByTestId('no-preferences')).toBeVisible();

  await reopen(page, file.name, file.text);
  await expect(page.getByTestId('import-report')).toContainText('Everything on the desk is now from that file');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('Kept through the round trip.');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('no-preferences')).toBeVisible();
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');
});

test('a preference survives saving in this browser and a reload', async ({ page }) => {
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('saved at');

  await openCompare(page);
  await chooseAndSave(page, 'A', 'Survives a reload.', 'customerFacing');
  await page.getByTestId('compare-close').click();
  await expect(page.getByTestId('save-state')).toContainText('saved at');

  await page.reload();
  await expect(page.getByTestId('save-state')).toContainText('restored from this browser');
  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('Survives a reload.');
});

/* -------------------------------------------------------- reach and access */

test('the comparison is usable from the keyboard', async ({ page }) => {
  await openCompare(page);

  const axisButton = page.getByTestId('compare-axis-voice');
  await axisButton.focus();
  await page.keyboard.press('Enter');
  await expect(axisButton).toHaveAttribute('aria-pressed', 'true');

  const choose = page.getByTestId('compare-choose-B');
  await choose.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('compare-choose-A')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('compare-statement').focus();
  await page.keyboard.type('Typed with no mouse.');
  await page.getByTestId('compare-scope-thisExample').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('compare-scope-thisExample')).toBeChecked();
  await page.getByTestId('compare-save').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('compare-saved')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('both comparison previews are readable and nothing is clipped', async ({ page }) => {
  await openCompare(page);

  for (const label of ['A', 'B'] as const) {
    const headline = page.locator(`[data-testid="compare-canvas-${label}"] .pv-headline`);
    await expect(headline).toBeVisible();
    const size = await headline.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    expect(size, `side ${label} headline is too small to judge`).toBeGreaterThanOrEqual(20);

    // The whole preview fits its frame rather than being cut off.
    const fits = await page
      .locator(`[data-testid="compare-canvas-${label}"]`)
      .evaluate((node) => node.scrollHeight <= node.clientHeight + 2);
    expect(fits, `side ${label} is clipped`).toBe(true);
  }

  // The choose control stays reachable while its own preview scrolls past it.
  // Scrolling a fixed amount keeps the test inside side A's card on both the
  // two-column desktop layout and the stacked phone one.
  await page.evaluate(() => {
    const body = document.querySelector('dialog.sheet-wide .sheet-body');
    if (body) body.scrollTop = 220;
  });
  await expect(page.getByTestId('compare-choose-A')).toBeInViewport();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the phone stacks the two sides and keeps every control reachable', async ({ page }) => {
  test.skip(!(await isNarrow(page)), 'only applies below 1000px');
  await openCompare(page);

  const a = await page.locator('[data-testid="compare-side-A"]').boundingBox();
  const b = await page.locator('[data-testid="compare-side-B"]').boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (a && b) {
    // Stacked, not squeezed into two columns.
    expect(b.y).toBeGreaterThan(a.y + a.height - 5);
    expect(a.width).toBeGreaterThan(250);
  }

  await chooseAndSave(page, 'A', 'Works on a phone too.', 'thisExample');
  await page.getByTestId('compare-close').click();
  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('Works on a phone too.');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/* -------------------------------------------------------------- migration */

test('a real version 1.0 worksheet opens here with everything intact', async ({ page }) => {
  const fixture = await readFile(
    fileURLToPath(new URL('./fixtures/version-1-worksheet.json', import.meta.url)),
    'utf8',
  );
  expect(JSON.parse(fixture).schemaVersion).toBe(1);
  expect(fixture).not.toContain('"preferences"');

  // Do some work first, so the test also proves the file replaces it wholesale.
  await decide(page, 'voice', 'ledger', 'accept', 'Work from before the import.');

  await reopen(page, 'version-1-worksheet.json', fixture);
  const report = page.getByTestId('import-report');
  await expect(report).toContainText('Everything on the desk is now from that file');
  await expect(report).toContainText('written by an earlier version (schema 1)');
  await expect(report).toContainText('read forward');
  await expect(report).toContainText('no saved comparison preferences because that version had none');
  await expect(report).toContainText('an older build cannot reopen');
  await page.getByTestId('close-sheet').click();

  // Decisions, reasons, drafts and the stage all came across.
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');
  await expect(page.getByTestId('status-typography-ledger')).toHaveText('Rejected');
  await expect(page.getByTestId('status-voice-openHarbor')).toHaveText('Accepted');
  await expect(page.getByTestId('status-voice-ledger')).toHaveText('Open');
  await expect(page.getByTestId('no-preferences')).toBeVisible();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-who')).toHaveValue('Adults returning to drawing after a long gap');

  // Its undo history came across too, step by step.
  const steps = (JSON.parse(fixture) as { history: unknown[] }).history.length;
  await expect(page.getByTestId('undo')).toHaveText(`Undo (${steps})`);
  await page.getByTestId('undo').click();
  await showSection(page, 'record');
  await expect(page.getByTestId('status-voice-openHarbor')).toHaveText('Open');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');

  // And the migrated worksheet can take a preference and be written back out.
  await showSection(page, 'stage');
  await page.getByTestId('open-compare').click();
  await chooseAndSave(page, 'A', 'Added after opening an old file.', 'thisExample');
  await page.getByTestId('compare-close').click();

  const written = await downloadWorksheet(page);
  const parsed = JSON.parse(written.text) as {
    schemaVersion: number;
    content: { preferences: Array<{ statement: string }>; decisions: Array<{ reason: string }> };
  };
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.content.preferences[0]?.statement).toBe('Added after opening an old file.');
  expect(written.text).toContain('Anchored and serious.');
});

test('a version 1 file carrying preferences it could not have written is refused', async ({ page }) => {
  const fixture = JSON.parse(
    await readFile(fileURLToPath(new URL('./fixtures/version-1-worksheet.json', import.meta.url)), 'utf8'),
  ) as { content: Record<string, unknown> };
  fixture.content['preferences'] = [];

  await setFact(page, 'name', 'Work that must survive');
  await reopen(page, 'tampered-v1.json', JSON.stringify(fixture));
  await expect(page.getByTestId('import-report')).toContainText('unexpected field');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Work that must survive');
});

test('an invalid preference in a file cannot destroy current work', async ({ page }) => {
  await openCompare(page);
  await chooseAndSave(page, 'A', 'The preference that must survive a bad import.', 'customerFacing');
  await page.getByTestId('compare-close').click();

  const good = await downloadWorksheet(page);
  const broken = JSON.parse(good.text) as {
    content: { preferences: Array<Record<string, unknown>> };
  };
  broken.content.preferences[0]!['scope'] = 'everywhere, always';

  await reopen(page, 'broken-preference.json', JSON.stringify(broken));
  await expect(page.getByTestId('import-report')).toContainText('scope');
  await expect(page.getByTestId('import-report')).toContainText(/left exactly as it is|nothing was changed/i);
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('preference-list')).toContainText('The preference that must survive a bad import.');
});


test('reopening requires a fresh choice after the stage or business changed', async ({ page }) => {
  await openCompare(page);
  await page.getByTestId('compare-choose-B').click();
  await page.getByTestId('compare-statement').fill('The contrast suits this page.');
  await page.getByTestId('compare-scope-thisExample').check();
  await page.getByTestId('compare-close').click();
  await setFact(page, 'name', 'A different fictional business');
  await openCompare(page);
  await page.getByTestId('compare-save').click();
  await expect(page.getByTestId('compare-problem')).toContainText('Choose which');
  await expect(page.getByTestId('compare-saved')).toHaveCount(0);
});


test('comparison keeps the close control inside a short laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openCompare(page);
  const close = await page.getByTestId('compare-close').boundingBox();
  expect(close).not.toBeNull();
  expect(close!.y).toBeGreaterThanOrEqual(0);
  expect(close!.y + close!.height).toBeLessThanOrEqual(720);
  await page.getByTestId('compare-close').click();
  await expect(page.getByRole('dialog', { name: 'Compare one thing' })).toBeHidden();
});
