import { describe, expect, it } from 'vitest';
import { buildFile } from '../../src/domain/portable';
import { validateFile, validateFileText } from '../../src/domain/validate';
import { createInitialSession } from '../../src/domain/state';
import { COPY_LIMITS, IMPORT_MAX_BYTES, REASON_LIMIT } from '../../src/domain/limits';

const STAMP = '2026-03-01T10:30:00.000Z';

function goodFile(): Record<string, unknown> {
  return JSON.parse(buildFile(createInitialSession(), STAMP).json) as Record<string, unknown>;
}

function expectRejected(file: unknown, matcher: RegExp): string[] {
  const text = typeof file === 'string' ? file : JSON.stringify(file);
  const result = validateFileText(text);
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  expect(result.problems.join(' | ')).toMatch(matcher);
  return result.problems;
}

describe('a valid file', () => {
  it('is accepted', () => {
    expect(validateFileText(buildFile(createInitialSession(), STAMP).json).ok).toBe(true);
  });
});

describe('rejecting bad input without touching anything', () => {
  it('rejects text that is not JSON', () => {
    const result = validateFileText('{ not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toMatch(/not readable JSON/i);
  });

  it('rejects an HTML file renamed to .json without executing any of it', () => {
    const result = validateFileText('<script>window.stolen = 1</script>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toMatch(/not readable JSON/i);
    expect((globalThis as Record<string, unknown>)['stolen']).toBeUndefined();
  });

  it('rejects a JSON array or a bare value at the top level', () => {
    expect(validateFileText('[]').ok).toBe(false);
    expect(validateFileText('"hello"').ok).toBe(false);
    expect(validateFileText('null').ok).toBe(false);
  });

  it('rejects another tool’s file', () => {
    const file = goodFile();
    file['kind'] = 'some-other-tool';
    expectRejected(file, /file\.kind/);
  });

  it('rejects an unknown schema version', () => {
    const file = goodFile();
    file['schemaVersion'] = 2;
    expectRejected(file, /schemaVersion.*this build reads 1/);
  });

  it('rejects an unknown preset version', () => {
    const file = goodFile();
    file['presetVersion'] = 7;
    expectRejected(file, /presetVersion.*this build reads 1/);
  });

  it('rejects an unknown preset id', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[0]!['option'] = 'midnight';
    expectRejected(file, /option.*not a direction/);
  });

  it('rejects an unknown component id', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[4]!['category'] = 'iconography';
    expectRejected(file, /category.*not a component/);
  });

  it('rejects a duplicated decision', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[1] = { ...content.decisions[0] } as Record<string, unknown>;
    expectRejected(file, /duplicate decision for palette\/quarterdeck/);
  });

  it('rejects a missing decision', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions.pop();
    expectRejected(file, /exactly 9 decisions/);
  });

  it('rejects two accepted options in one component', () => {
    const file = goodFile();
    const content = file['content'] as {
      facts: Record<string, string>;
      decisions: Array<Record<string, unknown>>;
    };
    const context = { facts: content.facts, draftSignature: null, at: STAMP };
    content.decisions[0] = { ...content.decisions[0], status: 'accepted', context };
    content.decisions[1] = { ...content.decisions[1], status: 'accepted', context };
    expectRejected(file, /marks 2 accepted options for palette/);
  });

  it('rejects an accepted decision with no approval context', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[0]!['status'] = 'accepted';
    expectRejected(file, /accepted but records no approval context/);
  });

  it('rejects an invalid status', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[2]!['status'] = 'maybe';
    expectRejected(file, /status.*open, accepted, rejected/);
  });

  it('rejects a non-string fact', () => {
    const file = goodFile();
    const content = file['content'] as { facts: Record<string, unknown> };
    content.facts['name'] = 42;
    expectRejected(file, /facts\.name.*must be text/);
  });

  it('rejects an oversized string', () => {
    const file = goodFile();
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    content.decisions[0]!['reason'] = 'x'.repeat(REASON_LIMIT + 1);
    expectRejected(file, new RegExp(`reason.*longer than the ${REASON_LIMIT}`));
  });

  it('rejects oversized draft copy', () => {
    const file = goodFile();
    const content = file['content'] as { facts: Record<string, string>; drafts: Array<Record<string, unknown>> };
    content.drafts[0]!['fields'] = [
      { field: 'emailBody', text: 'y'.repeat(COPY_LIMITS.emailBody + 1), basedOn: content.facts },
    ];
    expectRejected(file, /emailBody|text.*longer than/);
  });

  it('rejects an unexpected field rather than ignoring it', () => {
    const file = goodFile();
    (file['content'] as Record<string, unknown>)['onOpen'] = 'alert(1)';
    expectRejected(file, /content\.onOpen.*unexpected field/);
  });

  it('rejects a duplicated draft field for one voice', () => {
    const file = goodFile();
    const content = file['content'] as { facts: Record<string, string>; drafts: Array<Record<string, unknown>> };
    content.drafts[0]!['fields'] = [
      { field: 'headline', text: 'one', basedOn: content.facts },
      { field: 'headline', text: 'two', basedOn: content.facts },
    ];
    expectRejected(file, /more than once for quarterdeck \(headline\)/);
  });

  it('rejects a missing direction in the drafts list', () => {
    const file = goodFile();
    const content = file['content'] as { drafts: unknown[] };
    content.drafts = content.drafts.slice(0, 2);
    expectRejected(file, /has no entry for ledger/);
  });

  it('rejects an unknown preview id', () => {
    const file = goodFile();
    (file['view'] as { preview: Record<string, string> }).preview['palette'] = 'midnight';
    expectRejected(file, /preview\.palette.*not a direction/);
  });

  it('rejects an invalid preview mode', () => {
    const file = goodFile();
    (file['view'] as Record<string, unknown>)['previewMode'] = 'billboard';
    expectRejected(file, /previewMode.*homepage, email/);
  });

  it('rejects a history that is too long', () => {
    const file = goodFile();
    const content = file['content'];
    file['history'] = Array.from({ length: 51 }, () => content);
    expectRejected(file, /history.*at most 50/);
  });

  it('rejects a malformed history step', () => {
    const file = goodFile();
    file['history'] = [{ facts: 'not an object' }];
    expectRejected(file, /history\[0\]/);
  });

  it('rejects a file bigger than the read limit before decoding it', () => {
    const result = validateFile('{}', IMPORT_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.summary).toMatch(/larger than the 4 MB limit/);
      expect(result.summary).toMatch(/nothing was changed/);
    }
  });

  it('always says the current work was left alone', () => {
    const result = validateFileText('{"kind":"nope"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toMatch(/left exactly as it is|nothing was changed/i);
  });

  it('reports a bounded number of problems', () => {
    const noise: Record<string, unknown> = { kind: 'brand-decision-desk', schemaVersion: 1, presetVersion: 1 };
    for (let i = 0; i < 40; i += 1) noise[`junk${i}`] = i;
    const problems = expectRejected(noise, /unexpected field/);
    expect(problems.length).toBeLessThanOrEqual(9);
    expect(problems[problems.length - 1]).toMatch(/further problems not listed/);
  });
});
