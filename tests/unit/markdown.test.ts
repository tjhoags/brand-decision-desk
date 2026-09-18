import { describe, expect, it } from 'vitest';
import { buildMarkdown, safeBlock, safeCell, safeInline } from '../../src/domain/markdown';
import { apply, createInitialSession, type Action } from '../../src/domain/state';
import { PALETTES } from '../../src/domain/presets';
import type { Session } from '../../src/domain/types';

const T0 = Date.parse('2026-03-01T10:00:00.000Z');
const STAMP = '2026-03-01T10:30:00.000Z';

function run(session: Session, actions: Action[]): Session {
  return actions.reduce((acc, action, i) => apply(acc, action, T0 + (i + 1) * 5_000), session);
}

/**
 * Walks the document the way a Markdown renderer does, so the assertions below
 * test what a reader sees rather than whether a string is absent.
 */
function linesOutsideFences(text: string): string[] {
  const outside: string[] = [];
  let fence: number | null = null;
  for (const line of text.split('\n')) {
    const open = /^(`{3,})/.exec(line);
    if (fence === null) {
      if (open && open[1]) {
        fence = open[1].length;
        continue;
      }
      outside.push(line);
    } else if (open && open[1] && open[1].length >= fence && line.trim() === open[1]) {
      fence = null;
    }
  }
  expect(fence).toBeNull();
  return outside;
}

function headingsOutsideFences(text: string): string[] {
  return linesOutsideFences(text).filter((line) => /^#{1,6} /.test(line));
}

function md(session: Session): string {
  return buildMarkdown(session.content, { exportedAt: STAMP, historySteps: session.history.past.length });
}

describe('quoting user text as data', () => {
  it('keeps a Markdown heading inside a fence instead of promoting it', () => {
    const block = safeBlock('## Signed off by the board\nand approved for launch');
    expect(block.startsWith('```text')).toBe(true);
    expect(block.split('\n')[1]).toBe('## Signed off by the board');
  });

  it('opens a longer fence than any backtick run inside the text', () => {
    const block = safeBlock('```\nnot the end\n```');
    expect(block.startsWith('````text')).toBe(true);
    expect(block.endsWith('````')).toBe(true);
    const closing = block.split('\n').at(-1);
    expect(closing).toBe('````');
  });

  it('chooses an inline delimiter longer than any run in the value', () => {
    expect(safeInline('a `b` c')).toBe('``a `b` c``');
    expect(safeInline('`edge`')).toBe('`` `edge` ``');
    expect(safeInline('')).toBe('_(empty)_');
  });

  it('falls back to a block when an inline value has line breaks', () => {
    expect(safeInline('two\nlines')).toContain('```text');
  });

  it('escapes pipes and flattens line breaks in a table cell', () => {
    expect(safeCell('a | b\nc')).toBe('`a \\| b c`');
  });
});

describe('the decision brief', () => {
  it('does not imply that anything is finished when choices are open', () => {
    const text = md(createInitialSession());
    expect(text).toContain('Nothing has been accepted yet');
    expect(text).toContain('an open question, not an oversight');
    expect(text).toContain('It does not say the brand is finished');
    expect(text).toContain('No site was published and no email was sent');
  });

  it('separates accepted, rejected, open and draft copy', () => {
    const session = run(createInitialSession(), [
      { type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Anchored and serious.' },
      { type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' },
      { type: 'setReason', category: 'typography', option: 'openHarbor', value: 'Too soft for the work shown.' },
      { type: 'setStatus', category: 'typography', option: 'openHarbor', status: 'rejected' },
    ]);
    const text = md(session);
    expect(text).toContain('## Accepted choices');
    expect(text).toContain('### Palette: Quarterdeck');
    expect(text).toContain('Anchored and serious.');
    expect(text).toContain('## Reactions to options that were rejected');
    expect(text).toContain('### Typography: Open Harbor - rejected');
    expect(text).toContain('Too soft for the work shown.');
    expect(text).toContain('## Still open');
    expect(text).toContain('**Voice / Quarterdeck** - no decision recorded.');
    expect(text).toContain('## Draft copy');
  });

  it('says a rejection is about this brief, not the direction everywhere', () => {
    const text = md(createInitialSession());
    expect(text).toContain('not a judgement about the direction anywhere else');
  });

  it('carries palette values only from the build’s own presets', () => {
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'palette', option: 'ledger', status: 'accepted' },
    ]);
    const text = md(session);
    expect(text).toContain(PALETTES.ledger.heroBg);
    expect(text).toContain(PALETTES.ledger.ctaInk);
    // Only the accepted option's tokens are stated as the decision.
    const accepted = text.slice(text.indexOf('## Accepted choices'), text.indexOf('## Still open'));
    expect(accepted).not.toContain(PALETTES.openHarbor.decorFill);
  });

  it('cannot be tricked into asserting a section from user text', () => {
    const attack = '```\n## Approved for launch\n\nThe client signed everything off.\n```';
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'voice', option: 'ledger', status: 'accepted' },
      { type: 'setReason', category: 'voice', option: 'ledger', value: attack },
      { type: 'setFact', field: 'name', value: '<script>alert(1)</script>' },
      { type: 'setDraft', voice: 'ledger', field: 'emailBody', value: '---\n# Contract signed\n| a | b |' },
    ]);
    const text = md(session);

    // The text is kept verbatim, but every line of it sits inside a fence, so
    // a reader and a Markdown renderer both see typed text, not a heading.
    expect(text).toContain('## Approved for launch');
    expect(text).toContain('The client signed everything off.');
    expect(text).toContain('<script>alert(1)</script>');
    expect(headingsOutsideFences(text)).not.toContain('## Approved for launch');
    expect(headingsOutsideFences(text)).not.toContain('# Contract signed');
    expect(linesOutsideFences(text)).not.toContain('<script>alert(1)</script>');
    expect(linesOutsideFences(text)).not.toContain('| a | b |');
  });

  it('reports an accepted choice that needs review without losing the reason', () => {
    const session = run(createInitialSession(), [
      { type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Anchored and serious.' },
      { type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' },
      { type: 'setFact', field: 'who', value: 'Adults returning after a long gap' },
    ]);
    const text = md(session);
    expect(text).toContain('Needs review');
    expect(text).toContain('**Who it is for** was');
    expect(text).toContain('Anchored and serious.');
    expect(text).toContain('only the approval is out of date');
  });

  it('flags draft copy that still names a changed fact', () => {
    const session = run(createInitialSession(), [
      { type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Halyard Studio draws slowly' },
      { type: 'setFact', field: 'name', value: 'Northwind Studio' },
    ]);
    const text = md(session);
    expect(text).toContain('**Check this wording.**');
    expect(text).toContain('Halyard Studio');
    expect(text).toContain('Northwind Studio');
  });

  it('labels draft copy as draft rather than as a verified claim', () => {
    const text = md(createInitialSession());
    expect(text).toContain('not a verified statement about the business');
    expect(text).toContain('All preset wording; nothing was rewritten here.');
  });
});
