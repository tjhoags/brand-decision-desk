import { expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/** The desk stacks into tabs below this width; tests must open the right one. */
export const NARROW_MAX = 999;

export async function isNarrow(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(max-width: 999px)').matches);
}

/** Brings a panel into view, switching tabs first on a narrow viewport. */
export async function showSection(page: Page, name: 'brief' | 'stage' | 'record'): Promise<void> {
  if (await isNarrow(page)) {
    await page.getByTestId(`section-tab-${name}`).click();
    await expect(page.getByTestId(`section-tab-${name}`)).toHaveAttribute('aria-selected', 'true');
  }
}

export async function openOption(page: Page, category: string, option: string): Promise<void> {
  await showSection(page, 'record');
  const row = page.getByTestId(`option-${category}-${option}`);
  if ((await row.getAttribute('aria-expanded')) !== 'true') await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
}

export async function decide(
  page: Page,
  category: string,
  option: string,
  verdict: 'accept' | 'reject',
  reason?: string,
): Promise<void> {
  await openOption(page, category, option);
  if (reason !== undefined) {
    await page.locator(`#${cssId(await reasonId(page, category, option))}`).fill(reason);
  }
  await page.getByTestId(`${verdict}-${category}-${option}`).click();
  await expect(page.getByTestId(`status-${category}-${option}`)).toHaveText(
    verdict === 'accept' ? 'Accepted' : 'Rejected',
  );
}

async function reasonId(page: Page, category: string, option: string): Promise<string> {
  const detail = await page.getByTestId(`option-${category}-${option}`).getAttribute('aria-controls');
  if (!detail) throw new Error(`no detail panel for ${category}/${option}`);
  return `${detail}-reason`;
}

/** React's useId produces colons, which need escaping in a CSS selector. */
function cssId(id: string): string {
  return id.replace(/:/g, '\\:');
}

export async function fillReason(page: Page, category: string, option: string, text: string): Promise<void> {
  await openOption(page, category, option);
  await page.locator(`#${cssId(await reasonId(page, category, option))}`).fill(text);
}

export async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error('the browser did not produce a file on disk');
  return readFile(path, 'utf8');
}

/** Downloads the JSON worksheet and returns the bytes the browser wrote. */
export async function downloadWorksheet(page: Page): Promise<{ name: string; text: string }> {
  await page.getByTestId('open-sheet').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-json').click(),
  ]);
  const text = await readDownload(download);
  await page.getByTestId('close-sheet').click();
  return { name: download.suggestedFilename(), text };
}

export async function downloadBrief(page: Page): Promise<{ name: string; text: string }> {
  await page.getByTestId('open-sheet').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-markdown').click(),
  ]);
  const text = await readDownload(download);
  await page.getByTestId('close-sheet').click();
  return { name: download.suggestedFilename(), text };
}

export async function reopen(page: Page, name: string, contents: string): Promise<void> {
  await page.getByTestId('open-sheet').click();
  await page.getByTestId('reopen-input').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  });
}

export async function setFact(page: Page, field: string, value: string): Promise<void> {
  await showSection(page, 'brief');
  await page.locator(`#fact-${field}`).fill(value);
  await expect(page.locator(`#fact-${field}`)).toHaveValue(value);
}
