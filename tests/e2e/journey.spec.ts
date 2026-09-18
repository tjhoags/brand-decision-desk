/**
 * The user journey, in a real browser, against the production build served at
 * the same base path Pages uses. Case ids refer to tests/acceptance/behavior.json.
 */
import { expect, test } from '@playwright/test';
import { decide, downloadBrief, downloadWorksheet, fillReason, openOption, setFact, showSection } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Brand Decision Desk', level: 1 })).toBeVisible();
});

test('fresh: the example is labelled as fiction and nothing is claimed as decided', async ({ page }) => {
  await showSection(page, 'brief');
  await expect(page.getByText('Fictional example.')).toBeVisible();
  await expect(page.locator('#fact-name')).toHaveValue('Halyard Studio');
  await expect(page.getByText('Sample').first()).toBeVisible();

  await showSection(page, 'record');
  for (const category of ['palette', 'typography', 'voice']) {
    for (const option of ['quarterdeck', 'openHarbor', 'ledger']) {
      await expect(page.getByTestId(`status-${category}-${option}`)).toHaveText('Open');
    }
  }
  await expect(page.getByTestId('standing-palette')).toContainText('not chosen yet');
  await expect(page.getByTestId('save-state')).toContainText('nothing is stored');
  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(page.getByTestId('undo')).toHaveText('Nothing to undo');
});

test('compare: each direction and both previews visibly change, and claim nothing', async ({ page }) => {
  await showSection(page, 'stage');
  const canvas = page.locator('#preview-canvas');

  const seen: string[] = [];
  for (const id of ['quarterdeck', 'openHarbor', 'ledger']) {
    await page.getByTestId(`direction-${id}`).click();
    await expect(canvas).toHaveAttribute('data-preview-palette', /.+/);
    const headline = await canvas.locator('.pv-headline').innerText();
    const cta = await canvas.locator('.pv-cta').innerText();
    const heroBg = await canvas
      .locator('.pv-hero')
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    const headingFont = await canvas
      .locator('.pv-headline')
      .evaluate((node) => getComputedStyle(node).fontFamily);
    seen.push([headline, cta, heroBg, headingFont].join('|'));
  }
  expect(new Set(seen).size, 'the three directions should not render alike').toBe(3);

  await expect(canvas.getByText('It is not a working button in this preview.')).toBeVisible();

  await page.getByRole('tab', { name: 'Customer email' }).click();
  await expect(canvas).toHaveAttribute('data-preview-mode', 'email');
  await expect(canvas.getByText(/Nothing is addressed, queued or sent/)).toBeVisible();
  await expect(page.getByTestId('preview-banner')).toContainText('the email is not sent');

  // Looking at anything recorded nothing.
  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Open');
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('compare: components mix independently on one composition', async ({ page }) => {
  await showSection(page, 'stage');
  await page.selectOption('#mix-palette', 'ledger');
  await page.selectOption('#mix-typography', 'openHarbor');
  await page.selectOption('#mix-voice', 'quarterdeck');

  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toHaveAttribute('data-preview-palette', 'ledger');
  await expect(canvas).toHaveAttribute('data-preview-typography', 'openHarbor');
  await expect(canvas).toHaveAttribute('data-preview-voice', 'quarterdeck');

  // Ledger's near-white page under Open Harbor's rounded geometry, with
  // Quarterdeck's wording: three sources, one composition.
  await expect(canvas.locator('.pv-hero')).toHaveCSS('background-color', 'rgb(252, 252, 251)');
  await expect(canvas.locator('.pv-cta')).toHaveCSS('border-radius', '18px');
  await expect(canvas.locator('.pv-cta')).toHaveText('Make an enquiry');
});

test('decision: accept, reject and unresolved stay distinct through to the export', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored and serious; it reads as printed work.');
  await decide(page, 'typography', 'ledger', 'reject', 'Too severe for someone who has never drawn.');

  await expect(page.getByTestId('standing-palette')).toContainText('Quarterdeck');
  await expect(page.getByTestId('status-voice-quarterdeck')).toHaveText('Open');

  const brief = await downloadBrief(page);
  expect(brief.name).toMatch(/^halyard-studio-decisions-\d{4}-\d{2}-\d{2}\.md$/);
  expect(brief.text).toContain('### Palette: Quarterdeck');
  expect(brief.text).toContain('Anchored and serious; it reads as printed work.');
  expect(brief.text).toContain('### Typography: Ledger - rejected');
  expect(brief.text).toContain('Too severe for someone who has never drawn.');
  expect(brief.text).toContain('**Voice / Quarterdeck** - no decision recorded.');
  expect(brief.text).toContain('not a judgement about the direction anywhere else');
  expect(brief.text).toContain('It does not say the brand is finished.');
});

test('decision: a second acceptance returns the first to open and keeps its reason', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Liked the weight of it.');
  await decide(page, 'palette', 'ledger', 'accept', 'Cleaner for a grid.');

  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Open');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Accepted');

  await openOption(page, 'palette', 'quarterdeck');
  await expect(page.getByText('Liked the weight of it.')).toBeVisible();
  await expect(page.getByText(/This was accepted earlier/)).toBeVisible();
});

test('decision: rejecting one component leaves the direction’s others alone', async ({ page }) => {
  await decide(page, 'palette', 'openHarbor', 'reject', 'The coral fights the work.');
  await expect(page.getByTestId('status-typography-openHarbor')).toHaveText('Open');
  await expect(page.getByTestId('status-voice-openHarbor')).toHaveText('Open');
  await expect(page.getByTestId('status-palette-ledger')).toHaveText('Open');
});

test('context: a changed fact asks for review and keeps the choice and reason', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored and serious.');
  await setFact(page, 'who', 'Adults returning to drawing after a long gap');

  await expect(page.getByTestId('standing-palette')).toContainText('needs review');
  await showSection(page, 'record');
  await expect(page.getByText(/Accepted against an earlier brief/).first()).toBeVisible();
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');

  let brief = await downloadBrief(page);
  expect(brief.text).toContain('Needs review');
  expect(brief.text).toContain('**Who it is for** was');
  expect(brief.text).toContain('Anchored and serious.');
  expect(brief.text).toContain('only the approval is out of date');

  await showSection(page, 'record');
  await page.getByRole('button', { name: 'Still right - reconfirm' }).first().click();
  await expect(page.getByTestId('standing-palette')).not.toContainText('needs review');

  brief = await downloadBrief(page);
  expect(brief.text).toContain('| Palette | Quarterdeck | Current |');
});

test('context: an accepted voice is flagged when its own draft copy changes', async ({ page }) => {
  await decide(page, 'voice', 'quarterdeck', 'accept', 'The register is right.');
  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('A quieter way to start drawing');
  await expect(page.getByTestId('standing-voice')).toContainText('needs review');
  await showSection(page, 'record');
  await expect(page.getByTestId('status-voice-quarterdeck')).toHaveText('Accepted');
});

test('unchanged: saving an identical brief changes nothing', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored.');
  await showSection(page, 'brief');
  const undoLabel = await page.getByTestId('undo').innerText();

  await page.locator('#fact-name').fill('Halyard Studio');
  await page.locator('#fact-name').blur();
  await page.waitForTimeout(150);

  await expect(page.getByTestId('undo')).toHaveText(undoLabel);
  await expect(page.getByTestId('standing-palette')).not.toContainText('needs review');
});

test('undo: choose, reject, edit, undo restores the exact prior state', async ({ page }) => {
  await decide(page, 'palette', 'quarterdeck', 'accept', 'Anchored and serious.');
  await decide(page, 'typography', 'ledger', 'reject', 'Too severe.');
  await showSection(page, 'brief');
  await page.locator('#draft-quarterdeck-headline').fill('Words I wrote myself');
  await setFact(page, 'who', 'Complete beginners only');

  await expect(page.getByTestId('standing-palette')).toContainText('needs review');

  await page.getByTestId('undo').click();

  await showSection(page, 'brief');
  await expect(page.locator('#fact-who')).toHaveValue('Beginners who want a relaxed way to practise');
  await expect(page.locator('#draft-quarterdeck-headline')).toHaveValue('Words I wrote myself');
  await expect(page.getByTestId('standing-palette')).not.toContainText('needs review');

  await showSection(page, 'record');
  await expect(page.getByTestId('status-palette-quarterdeck')).toHaveText('Accepted');
  await expect(page.getByTestId('status-typography-ledger')).toHaveText('Rejected');
  await openOption(page, 'palette', 'quarterdeck');
  await expect(page.getByText('Anchored and serious.')).toBeVisible();
});

test('undo: previewing is not an undoable change', async ({ page }) => {
  await showSection(page, 'stage');
  await page.selectOption('#mix-palette', 'ledger');
  await page.getByRole('tab', { name: 'Customer email' }).click();
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('escaping: typed HTML and Markdown stay inert on screen and as data in the export', async ({ page }) => {
  const attack = '<img src=x onerror="document.title=\'pwned\'">';
  await setFact(page, 'name', attack);
  await expect(page).toHaveTitle('Brand Decision Desk');
  await showSection(page, 'stage');
  await expect(page.locator('#preview-canvas .pv-eyebrow')).toHaveText(attack);
  expect(await page.locator('#preview-canvas').locator('img').count()).toBe(0);

  await decide(page, 'voice', 'ledger', 'accept', '```\n## Approved for launch\n\nThe client signed it off.\n```');

  const brief = await downloadBrief(page);
  expect(brief.text).toContain('The client signed it off.');
  // The heading the text tried to assert never becomes a heading of its own.
  const lines = brief.text.split('\n');
  let fence: number | null = null;
  const bareHeadings: string[] = [];
  for (const line of lines) {
    const open = /^(`{3,})/.exec(line);
    if (fence === null) {
      if (open?.[1]) {
        fence = open[1].length;
        continue;
      }
      if (/^#{1,6} /.test(line)) bareHeadings.push(line);
    } else if (open?.[1] && open[1].length >= fence && line.trim() === open[1]) {
      fence = null;
    }
  }
  expect(bareHeadings).not.toContain('## Approved for launch');
  expect(bareHeadings.some((h) => h.startsWith('# Brand decision brief'))).toBe(true);
});

test('limits: a field stops at its declared limit and the export stays reopenable', async ({ page }) => {
  await showSection(page, 'brief');
  await page.locator('#fact-name').fill('x'.repeat(200));
  await expect(page.locator('#fact-name')).toHaveValue('x'.repeat(120));

  await fillReason(page, 'palette', 'ledger', 'y'.repeat(900));
  const detail = await page.getByTestId('option-palette-ledger').getAttribute('aria-controls');
  const reason = page.locator(`#${(detail ?? '').replace(/:/g, '\\:')}-reason`);
  await expect(reason).toHaveValue('y'.repeat(600));

  const file = await downloadWorksheet(page);
  const parsed = JSON.parse(file.text) as { content: { facts: Record<string, string> } };
  expect(parsed.content.facts['name']).toHaveLength(120);
});

test('the disabled controls say why they are unavailable', async ({ page }) => {
  await showSection(page, 'stage');
  const previewAccepted = page.getByRole('button', { name: 'Preview accepted choices' });
  await expect(previewAccepted).toBeDisabled();
  await expect(previewAccepted).toHaveAttribute('title', /Nothing has been accepted yet/);

  await decide(page, 'palette', 'ledger', 'accept');
  await showSection(page, 'stage');
  await expect(previewAccepted).toBeEnabled();
  await page.selectOption('#mix-palette', 'quarterdeck');
  await expect(page.getByTestId('preview-banner')).toContainText('This is not what you accepted.');
  await previewAccepted.click();
  await expect(page.locator('#preview-canvas')).toHaveAttribute('data-preview-palette', 'ledger');
  // Nothing is accepted for the other two, so they are not invented.
  await expect(page.getByTestId('preview-banner')).toContainText('still open');
});

test('the email header reads as a header in every palette', async ({ page }) => {
  await showSection(page, 'stage');
  await page.getByRole('tab', { name: 'Customer email' }).click();

  for (const direction of ['quarterdeck', 'openHarbor', 'ledger']) {
    await page.selectOption('#mix-palette', direction);
    const head = page.locator('.pv-email-head');
    const measured = await head.evaluate((node) => {
      const style = getComputedStyle(node);
      const body = document.querySelector('.pv-email-body');
      return {
        background: style.backgroundColor,
        borderWidth: Number.parseFloat(style.borderBottomWidth),
        borderColour: style.borderBottomColor,
        bodyBackground: body ? getComputedStyle(body).backgroundColor : '',
      };
    });
    const separated =
      measured.background !== measured.bodyBackground ||
      (measured.borderWidth >= 1 && measured.borderColour !== 'rgba(0, 0, 0, 0)');
    expect(separated, `${direction} email header blends into the body`).toBe(true);
  }

  // And the whole message fits the frame rather than being cut off.
  const fits = await page.locator('#preview-canvas').evaluate((node) => node.scrollHeight <= node.clientHeight + 2);
  expect(fits, 'the email preview is clipped').toBe(true);
});
