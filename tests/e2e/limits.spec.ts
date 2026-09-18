/**
 * The declared limits, exercised through the real controls and real files:
 * the undo bound, the file size ceiling, and the promise that anything the
 * desk offers as a download can be opened again by the same build.
 */
import { expect, test } from '@playwright/test';
import { decide, downloadWorksheet, reopen, setFact, showSection } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

/** Builds a file with `steps` history entries from a real exported worksheet. */
function withHistory(good: string, steps: number): string {
  const file = JSON.parse(good) as { content: unknown; history: unknown[] };
  const base = JSON.parse(JSON.stringify(file.content)) as { facts: Record<string, string> };
  file.history = Array.from({ length: steps }, (_, i) => {
    const step = JSON.parse(JSON.stringify(base)) as { facts: Record<string, string> };
    step.facts['what'] = `Earlier wording, step ${i}`;
    return step;
  });
  return JSON.stringify(file);
}

test('limits: undo holds exactly the declared 50 steps and says when older ones are gone', async ({ page }) => {
  const good = (await downloadWorksheet(page)).text;

  await reopen(page, 'fifty-steps.json', withHistory(good, 50));
  await expect(page.getByTestId('import-report')).toContainText('including 50 undo steps');
  await page.getByTestId('close-sheet').click();
  await expect(page.getByTestId('undo')).toHaveText('Undo (50)');

  // One more change: the newest step is kept and the oldest is dropped, which
  // the desk then discloses rather than quietly forgetting.
  await setFact(page, 'name', 'One more change');
  await expect(page.getByTestId('undo')).toHaveText('Undo (50)');

  await page.getByTestId('open-sheet').click();
  await expect(page.getByText(/Undo keeps the last 50 steps, and steps older than the ones held now are gone/)).toBeVisible();
  await page.getByTestId('close-sheet').click();

  // Current work is never what gets dropped.
  const after = await downloadWorksheet(page);
  const parsed = JSON.parse(after.text) as {
    content: { facts: Record<string, string> };
    history: unknown[];
    historyTrimmed: boolean;
    historyStepLimit: number;
  };
  expect(parsed.content.facts['name']).toBe('One more change');
  expect(parsed.history).toHaveLength(50);
  expect(parsed.historyTrimmed).toBe(true);
  expect(parsed.historyStepLimit).toBe(50);

  // And the trim disclosure survives the round trip.
  await reopen(page, 'again.json', after.text);
  await page.getByTestId('close-sheet').click();
  await page.getByTestId('open-sheet').click();
  await expect(page.getByText(/steps older than the ones held now are gone/)).toBeVisible();
});

test('limits: a file with more than 50 steps is refused, not silently truncated', async ({ page }) => {
  await decide(page, 'palette', 'ledger', 'accept', 'Work that must survive the bad file.');
  const good = (await downloadWorksheet(page)).text;

  await reopen(page, 'too-long.json', withHistory(good, 51));
  await expect(page.getByTestId('import-report')).toContainText('at most 50');
  await page.getByTestId('close-sheet').click();
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');
});

test('limits: an oversized file is refused before it is read', async ({ page }) => {
  await setFact(page, 'name', 'Untouched by the huge file');

  const huge = `{"kind":"brand-decision-desk","padding":"${'x'.repeat(4 * 1024 * 1024 + 64)}"}`;
  await reopen(page, 'huge.json', huge);
  await expect(page.getByTestId('import-report')).toContainText('past the 4.0 MB limit');
  await expect(page.getByTestId('import-report')).toContainText('Your work is untouched');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Untouched by the huge file');
});

test('limits: everything the desk offers to download can be opened again', async ({ page }) => {
  // A full worksheet: long text in every field, all nine decisions recorded.
  await showSection(page, 'brief');
  await page.locator('#fact-what').fill('W'.repeat(240));
  await page.locator('#fact-who').fill('H'.repeat(240));
  await page.locator('#fact-offer').fill('O'.repeat(240));
  await page.locator('#draft-quarterdeck-headline').fill('D'.repeat(160));

  for (const [category, option, verdict] of [
    ['palette', 'quarterdeck', 'accept'],
    ['palette', 'openHarbor', 'reject'],
    ['palette', 'ledger', 'reject'],
    ['typography', 'ledger', 'accept'],
    ['typography', 'quarterdeck', 'reject'],
    ['voice', 'openHarbor', 'accept'],
    ['voice', 'ledger', 'reject'],
  ] as const) {
    await decide(page, category, option, verdict, `${'R'.repeat(590)} ${option}`);
  }

  const file = await downloadWorksheet(page);
  expect(file.text.length).toBeGreaterThan(5_000);

  await page.reload();
  await reopen(page, file.name, file.text);
  await expect(page.getByTestId('import-report')).toContainText('Everything on the desk is now from that file');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');
  await expect(page.getByTestId('status-voice-ledger')).toHaveText('Rejected');
  await showSection(page, 'brief');
  await expect(page.locator('#fact-what')).toHaveValue('W'.repeat(240));
});
