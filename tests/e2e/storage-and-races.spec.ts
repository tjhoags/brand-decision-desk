/**
 * Storage that tells the truth, and a slow read that cannot overwrite newer
 * work. The failures are injected from the test, not through any hook in the
 * shipped app, so what is exercised here is the real code path.
 */
import { expect, test, type Page } from '@playwright/test';
import { decide, downloadWorksheet, setFact, showSection } from './helpers';

const KEY = 'brand-decision-desk/session/v1';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

test('save: opt-in, confirmed by readback, and restored on reload', async ({ page }) => {
  await expect(page.getByTestId('save-state')).toContainText('nothing is stored');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), KEY)).toBeNull();

  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText(/saved at \d{2}:\d{2}/);

  await decide(page, 'palette', 'openHarbor', 'accept', 'Warmer than I expected to like.');
  await setFact(page, 'name', 'Halyard Studio North');
  await expect(page.getByTestId('save-state')).toContainText(/saved at/);

  await page.reload();
  await expect(page.getByTestId('save-state')).toContainText('restored from this browser');
  await expect(page.getByTestId('saving-toggle')).toBeChecked();
  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Halyard Studio North');
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-openHarbor')).toHaveText('Accepted');
});

test('save: turning it off removes the stored copy and says so', async ({ page }) => {
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('saved at');
  await page.getByTestId('saving-toggle').uncheck();
  await expect(page.getByTestId('save-state')).toContainText('the stored copy was removed');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), KEY)).toBeNull();
});

test('save: a refused write is reported as not saved and the work stays open', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key.startsWith('brand-decision-desk/')) {
        const error = new Error('mock quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return original.call(this, key, value);
    };
  });
  await page.reload();

  await decide(page, 'palette', 'ledger', 'accept', 'Do not lose this.');
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('Not saved');
  await expect(page.getByTestId('save-state')).toContainText(/storage for this page is full/);

  // The in-memory work is untouched and can still be exported.
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');
  const file = await downloadWorksheet(page);
  expect(file.text).toContain('Do not lose this.');
});

test('save: a write that does not read back is never reported as saved', async ({ page }) => {
  await page.addInitScript(() => {
    // Accepts the write, then loses it: the worst kind of storage.
    Storage.prototype.setItem = function setItem() {
      return undefined;
    };
  });
  await page.reload();
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('Not saved');
  await expect(page.getByTestId('save-state')).toContainText(/did not match/);
});

test('save: a removal that fails never claims the copy is gone', async ({ page }) => {
  await page.getByTestId('saving-toggle').check();
  await expect(page.getByTestId('save-state')).toContainText('saved at');

  await page.evaluate(() => {
    Storage.prototype.removeItem = function removeItem() {
      throw new Error('mock removal refused');
    };
  });

  await page.getByTestId('saving-toggle').uncheck();
  await expect(page.getByTestId('save-state')).toContainText('Off, but not removed');
  await expect(page.getByTestId('save-state')).toContainText('mock removal refused');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), KEY)).not.toBeNull();
});

test('save: unreadable storage on startup is reported and never deleted', async ({ page }) => {
  await page.evaluate((key) => window.localStorage.setItem(key, '{ this is not a worksheet'), KEY);
  await page.reload();

  await expect(page.getByTestId('storage-notice')).toContainText('could not be read');
  await expect(page.getByTestId('storage-notice')).toContainText('left exactly where it is, not deleted');
  await expect(page.getByTestId('saving-toggle')).not.toBeChecked();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), KEY)).toBe('{ this is not a worksheet');

  // The desk still works, on the fresh example.
  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Halyard Studio');
});

test('save: storage blocked outright is reported without breaking the desk', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function getItem() {
      const error = new Error('mock blocked');
      error.name = 'SecurityError';
      throw error;
    };
  });
  await page.reload();

  await expect(page.getByTestId('storage-notice')).toContainText('refused to read its own storage');
  await expect(page.getByTestId('saving-toggle')).toBeDisabled();
  await expect(page.getByTestId('save-state')).toContainText('Not available');

  await decide(page, 'voice', 'ledger', 'accept', 'Still works without storage.');
  await expect(page.getByTestId('status-voice-ledger')).toHaveText('Accepted');
});

/** Makes one named file take a measurable time to read, from the test side. */
async function slowReads(page: Page, marker: string, delayMs: number): Promise<void> {
  await page.addInitScript(
    ([name, delay]) => {
      const original = Blob.prototype.text;
      Blob.prototype.text = function text(this: Blob) {
        const isTarget = this instanceof File && this.name.includes(name as string);
        const result = original.call(this);
        if (!isTarget) return result;
        return new Promise<string>((resolve, reject) => {
          window.setTimeout(() => result.then(resolve, reject), delay as number);
        });
      };
    },
    [marker, delayMs] as const,
  );
}

test('race: a slow read cannot overwrite an edit made while it was reading', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'From the earlier file.');
  const earlier = await downloadWorksheet(page);

  await slowReads(page, 'slow-', 2_000);
  await page.reload();

  await setFact(page, 'name', 'Newer work that must survive');
  await page.getByTestId('open-sheet').click();
  await page.getByTestId('reopen-input').setInputFiles({
    name: 'slow-worksheet.json',
    mimeType: 'application/json',
    buffer: Buffer.from(earlier.text, 'utf8'),
  });
  await expect(page.getByTestId('import-report')).toContainText('Reading slow-worksheet.json');

  // Make a newer change while the file is still being read.
  await page.getByTestId('close-sheet').click();
  await setFact(page, 'who', 'Changed while the file was still being read');

  await page.getByTestId('open-sheet').click();
  await expect(page.getByTestId('import-report')).toContainText('finished reading after you changed the worksheet');
  await expect(page.getByTestId('import-report')).toContainText('untouched');
  await page.getByTestId('close-sheet').click();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Newer work that must survive');
  await expect(page.locator('#fact-who')).toHaveValue('Changed while the file was still being read');
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Open');
});

test('race: a slow read cannot overwrite a newer file opened after it', async ({ page }) => {
  await setFact(page, 'name', 'First file');
  const first = await downloadWorksheet(page);
  await setFact(page, 'name', 'Second file');
  const second = await downloadWorksheet(page);

  await slowReads(page, 'slow-', 2_500);
  await page.reload();

  await page.getByTestId('open-sheet').click();
  await page.getByTestId('reopen-input').setInputFiles({
    name: 'slow-first.json',
    mimeType: 'application/json',
    buffer: Buffer.from(first.text, 'utf8'),
  });
  await expect(page.getByTestId('import-report')).toContainText('Reading slow-first.json');

  await page.getByTestId('reopen-input').setInputFiles({
    name: 'second.json',
    mimeType: 'application/json',
    buffer: Buffer.from(second.text, 'utf8'),
  });
  await expect(page.getByTestId('import-report')).toContainText('Opened second.json');

  // The slower first read lands later and must be discarded, not applied.
  await expect(page.getByTestId('import-report')).toContainText('after a newer file was opened', { timeout: 6_000 });
  await page.getByTestId('close-sheet').click();
  await showSection(page, 'brief');
  await expect(page.locator('#fact-name')).toHaveValue('Second file');
});

test('network: the page requests nothing but its own files', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('./', { waitUntil: 'load' });
  await decide(page, 'palette', 'ledger', 'accept', 'Checking the wire stays quiet.');
  await setFact(page, 'name', 'Quiet Studio');
  await downloadWorksheet(page);
  await page.waitForTimeout(500);

  const origin = new URL(page.url()).origin;
  const offsite = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:'));
  expect(offsite, `off-site requests: ${offsite.join(', ')}`).toEqual([]);

  const paths = requests
    .filter((url) => url.startsWith(origin))
    .map((url) => new URL(url).pathname)
    .filter((path, index, all) => all.indexOf(path) === index);
  for (const path of paths) {
    expect(path.startsWith('/brand-decision-desk/'), `unexpected path ${path}`).toBe(true);
  }
});
