/**
 * Real downloads, reparsed, and real reopening. Every file here is the one the
 * browser actually wrote, read back from disk, not a value from a helper.
 */
import { expect, test } from '@playwright/test';
import { decide, downloadBrief, downloadWorksheet, openOption, reopen, setFact, showSection } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

async function workedSession(page: import('@playwright/test').Page): Promise<void> {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored and serious.');
  await decide(page, 'typography', 'ledger', 'reject', 'Too severe for a beginner.');
  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('Drawing, at the pace it takes');
  await setFact(page, 'offer', 'In-person drawing classes and a monthly open studio');
}

test('the downloaded worksheet is a real file that this build reopens exactly', async ({ page }) => {
  await workedSession(page);
  const file = await downloadWorksheet(page);
  expect(file.name).toMatch(/^halyard-studio-decisions-\d{4}-\d{2}-\d{2}\.json$/);

  const parsed = JSON.parse(file.text) as Record<string, unknown>;
  expect(parsed['kind']).toBe('brand-decision-desk');
  expect(parsed['schemaVersion']).toBe(2);
  expect(parsed['presetVersion']).toBe(1);
  expect(parsed['historyStepLimit']).toBe(50);
  expect(Array.isArray(parsed['history'])).toBe(true);

  // Change everything, then reopen the file and check it all came back.
  await setFact(page, 'name', 'Something else entirely');
  await decide(page, 'voice', 'openHarbor', 'accept', 'A different session.');

  await reopen(page, file.name, file.text);
  await expect(page.getByTestId('import-report')).toContainText('Everything on the desk is now from that file');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Halyard Studio');
  await expect(page.locator('#fact-offer')).toHaveValue('In-person drawing classes and a monthly open studio');
  await expect(page.locator('#draft-quarterdeck-headline')).toHaveValue('Drawing, at the pace it takes');

  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');
  await expect(page.getByTestId('status-typography-ledger')).toHaveText('Rejected');
  await expect(page.getByTestId('status-voice-openHarbor')).toHaveText('Open');
  await openOption(page, 'palette', 'quarterdeck');
  await expect(page.getByText('Anchored and serious.')).toBeVisible();
});

test('undo works after reopening, from the history the file carried', async ({ page }) => {
  await workedSession(page);
  const file = await downloadWorksheet(page);
  const steps = (JSON.parse(file.text) as { history: unknown[] }).history.length;
  expect(steps).toBeGreaterThan(2);

  await page.reload();
  await expect(page.getByTestId('undo')).toBeDisabled();
  await reopen(page, file.name, file.text);
  await page.getByTestId('close-sheet').click();

  await expect(page.getByTestId('undo')).toBeEnabled();
  await expect(page.getByTestId('undo')).toHaveText(`Undo (${steps})`);
  await page.getByTestId('undo').click();
  await showSection(page, 'brief');
  await expect(page.locator('#fact-offer')).toHaveValue('In-person drawing classes');
});

test('the Markdown brief is a real file that reads as a handoff', async ({ page }) => {
  await workedSession(page);
  const brief = await downloadBrief(page);
  expect(brief.name).toMatch(/\.md$/);
  expect(brief.text.startsWith('# Brand decision brief')).toBe(true);
  expect(brief.text).toContain('## Where the decisions stand');
  expect(brief.text).toContain('## The business facts these choices were made against');
  expect(brief.text).toContain('## Accepted choices');
  expect(brief.text).toContain('## Still open');
  expect(brief.text).toContain('## Reactions to options that were rejected');
  expect(brief.text).toContain('## Draft copy');
  expect(brief.text).toContain('## What this brief does not say');
  expect(brief.text).toContain('#1E2A32');
  expect(brief.text).toContain('unchanged from the fictional sample');
  expect(brief.text).not.toContain('because the worksheet holds none');
});

const CASES: Array<{ name: string; make: (good: string) => string; expect: RegExp }> = [
  { name: 'not JSON at all', make: () => 'this is not json {', expect: /not readable JSON/i },
  { name: 'HTML renamed to .json', make: () => '<html><script>alert(1)</script></html>', expect: /not readable JSON/i },
  {
    name: 'a newer schema version',
    make: (good) => good.replace('"schemaVersion": 2', '"schemaVersion": 3'),
    expect: /schemaVersion/,
  },
  {
    name: 'a newer preset version',
    make: (good) => good.replace('"presetVersion": 1', '"presetVersion": 9'),
    expect: /presetVersion/,
  },
  {
    name: 'an unknown preset id',
    make: (good) => good.replace('"option": "ledger"', '"option": "midnight"'),
    expect: /not a direction/,
  },
  {
    name: 'a duplicated decision',
    make: (good) => {
      const file = JSON.parse(good) as { content: { decisions: unknown[] } };
      file.content.decisions[1] = file.content.decisions[0];
      return JSON.stringify(file);
    },
    expect: /duplicate decision/,
  },
  {
    name: 'a missing decision',
    make: (good) => {
      const file = JSON.parse(good) as { content: { decisions: unknown[] } };
      file.content.decisions.pop();
      return JSON.stringify(file);
    },
    expect: /exactly 9 decisions/,
  },
  {
    name: 'an oversized string',
    make: (good) => {
      const file = JSON.parse(good) as { content: { facts: Record<string, string> } };
      file.content.facts['what'] = 'x'.repeat(5_000);
      return JSON.stringify(file);
    },
    expect: /longer than the 240/,
  },
];

for (const entry of CASES) {
  test(`invalid: ${entry.name} leaves the worksheet exactly as it was`, async ({ page }) => {
    await decide(page, 'palette', 'openHarbor', 'accept', 'Work in progress that must survive.');
    await setFact(page, 'name', 'Work In Progress Studio');
    const good = (await downloadWorksheet(page)).text;

    await reopen(page, 'broken.json', entry.make(good));
    await expect(page.getByTestId('import-report')).toContainText(entry.expect);
    await expect(page.getByTestId('import-report')).toContainText(/untouched|left exactly as it is|nothing was changed/i);
    await page.getByTestId('close-sheet').click();

    await showSection(page, 'brief');
    await expect(page.locator('#fact-name')).toHaveValue('Work In Progress Studio');
    await showSection(page, 'record');
    await expect(page.getByTestId('status-palette-openHarbor')).toHaveText('Accepted');
    await expect(page).toHaveTitle('Brand Decision Desk');
  });
}

test('invalid: a rejected file never reaches the copy saved in this browser', async ({ page }) => {
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('saved at');
  await decide(page, 'voice', 'ledger', 'accept', 'Keep this.');
  await expect(page.getByTestId('save-state')).toContainText('saved at');

  const stored = await page.evaluate(() => window.localStorage.getItem('brand-decision-desk/session/v1'));
  expect(stored).toContain('Keep this.');

  await reopen(page, 'broken.json', '{"kind":"brand-decision-desk"');
  await expect(page.getByTestId('import-report')).toContainText(/not readable JSON/i);
  await page.getByTestId('close-sheet').click();

  const after = await page.evaluate(() => window.localStorage.getItem('brand-decision-desk/session/v1'));
  expect(after).toContain('Keep this.');
});
