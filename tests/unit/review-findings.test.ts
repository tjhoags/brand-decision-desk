/**
 * Regression checks for problems found in an independent review of the core.
 * Each block names what was wrong so a future change cannot quietly undo it.
 */
import { describe, expect, it } from 'vitest';
import {
  apply,
  createInitialSession,
  fillTokens,
  findDecision,
  presetCopy,
  resolveCopy,
  reviewFor,
  sampleFactFields,
  type Action,
} from '../../src/domain/state';
import { buildFile } from '../../src/domain/portable';
import { validateFileText } from '../../src/domain/validate';
import { buildMarkdown } from '../../src/domain/markdown';
import { COPY_TOKEN_PATTERN, EXAMPLE_FACTS, VOICE_COPY } from '../../src/domain/presets';
import { HISTORY_LIMIT } from '../../src/domain/limits';
import { COPY_FIELDS, DIRECTION_IDS, FACT_FIELDS, type Facts, type Session } from '../../src/domain/types';

const T0 = Date.parse('2026-03-01T10:00:00.000Z');
const STAMP = '2026-03-01T10:30:00.000Z';

function run(session: Session, actions: Action[]): Session {
  return actions.reduce((acc, action, i) => apply(acc, action, T0 + (i + 1) * 5_000), session);
}

const BAKERY: Facts = {
  name: 'Fenwick Bread',
  what: 'A neighbourhood bakery open from early morning',
  who: 'People walking past on their way to work',
  offer: 'Sourdough loaves and pastries baked on site',
};

/* ------------------------------------------------------------------ finding 3 */

describe('preset wording follows the brief rather than the worked example', () => {
  it('leaves no trace of the sample business once every fact is replaced', () => {
    const session = run(
      createInitialSession(),
      FACT_FIELDS.map((field) => ({ type: 'setFact', field, value: BAKERY[field] }) as Action),
    );

    const sampleWords = ['drawing', 'workshop', 'halyard', 'pencil', 'paper', 'beginner', 'class'];
    for (const voice of DIRECTION_IDS) {
      const copy = resolveCopy(session.content, voice);
      const joined = Object.values(copy).join('\n').toLowerCase();
      for (const word of sampleWords) {
        expect(joined, `${voice} preview copy still says "${word}"`).not.toContain(word);
      }
      expect(joined).toContain('fenwick bread');
    }
  });

  it('states every fact somewhere in each direction’s wording', () => {
    const session = run(
      createInitialSession(),
      FACT_FIELDS.map((field) => ({ type: 'setFact', field, value: BAKERY[field] }) as Action),
    );
    for (const voice of DIRECTION_IDS) {
      const joined = Object.values(resolveCopy(session.content, voice)).join('\n').toLowerCase();
      for (const field of FACT_FIELDS) {
        expect(joined, `${voice} never states ${field}`).toContain(BAKERY[field].toLowerCase());
      }
    }
  });

  it('reads naturally when a fact lands mid-sentence', () => {
    const facts = { ...EXAMPLE_FACTS } as Facts;
    expect(fillTokens('{name} is for {who:lc}.', facts)).toBe(
      'Halyard Studio is for beginners who want a relaxed way to practise.',
    );
    // Acronyms and names keep their capitals.
    expect(fillTokens('made for {who:lc}', { ...facts, who: 'CFOs of small firms' })).toBe(
      'made for CFOs of small firms',
    );
    expect(fillTokens('made for {who:lc}', { ...facts, who: 'UK-based founders' })).toBe(
      'made for UK-based founders',
    );
    // An emptied fact shows its bracketed blank, not a gap.
    expect(fillTokens('for {who:lc}', { ...facts, who: '' })).toBe('for [WHO IT IS FOR]');
  });

  it('writes no preset sentence that is not a fact, a blank or a connective', () => {
    // Every preset string is checked for wording that would state something
    // about the business that the facts do not.
    const forbidden = [
      /\bhour\b/i,
      /\bminute/i,
      /\bweek(ly)?\b/i,
      /\bmaterials? (are |is )?(provided|included)/i,
      /\bprice|\bcost|\b£|\$\d/i,
      /\bguarantee/i,
      /\bwe will (reply|write|call|send|hold|reserve)/i,
      /\ba place (is|will be) (reserved|held)/i,
      /\bnew (group|class|cohort) is forming/i,
      /\bno experience (needed|necessary|required)/i,
      /\bsmall (group|class)/i,
    ];
    for (const voice of DIRECTION_IDS) {
      for (const field of COPY_FIELDS) {
        const text = VOICE_COPY[voice][field];
        for (const pattern of forbidden) {
          expect(pattern.test(text), `${voice}.${field} matches ${pattern}`).toBe(false);
        }
      }
    }
  });

  it('uses only the tokens the fill function understands', () => {
    for (const voice of DIRECTION_IDS) {
      for (const field of COPY_FIELDS) {
        const text = VOICE_COPY[voice][field];
        const braces = text.match(/\{[^}]*\}/g) ?? [];
        const valid = text.match(new RegExp(COPY_TOKEN_PATTERN.source, 'g')) ?? [];
        expect(braces.sort()).toEqual(valid.sort());
        expect(presetCopy(voice, EXAMPLE_FACTS)[field]).not.toMatch(/\{|\}/);
      }
    }
  });

  it('keeps the three voices meaningfully different on the same facts', () => {
    const facts = EXAMPLE_FACTS as Facts;
    for (const field of COPY_FIELDS) {
      const rendered = DIRECTION_IDS.map((voice) => presetCopy(voice, facts)[field]);
      expect(new Set(rendered).size, `every voice writes the same ${field}`).toBe(3);
    }
  });
});

/* ------------------------------------------------------------------ finding 4 */

describe('the brief is honest about sample facts and about what it holds', () => {
  it('marks fact fields still holding the fictional sample value', () => {
    const fresh = createInitialSession();
    expect(sampleFactFields(fresh.content)).toEqual([...FACT_FIELDS]);

    const text = buildMarkdown(fresh.content, { exportedAt: STAMP, historySteps: 0 });
    expect(text).toContain('unchanged from the fictional sample');
    expect(text).toContain('**Every fact above is still the fictional sample.**');
  });

  it('stops marking a fact once it is replaced', () => {
    const session = run(createInitialSession(), [{ type: 'setFact', field: 'name', value: BAKERY.name }]);
    expect(sampleFactFields(session.content)).toEqual(['what', 'who', 'offer']);
    const text = buildMarkdown(session.content, { exportedAt: STAMP, historySteps: 0 });
    expect(text).not.toContain('**Every fact above is still the fictional sample.**');
    expect(text).toContain('unchanged from the fictional sample');
  });

  it('does not claim the worksheet holds no price, schedule, address or contact', () => {
    const session = run(createInitialSession(), [
      { type: 'setDraft', voice: 'ledger', field: 'emailBody', value: 'Classes are 40 pounds, Tuesdays, 3 Mill Lane.' },
    ]);
    const text = buildMarkdown(session.content, { exportedAt: STAMP, historySteps: 0 });
    expect(text).not.toContain('because the worksheet holds none');
    expect(text).toContain('The worksheet has no field for a price, a schedule, an address or a contact');
    expect(text).toContain('written by hand and is unverified');
    expect(text).toContain('Classes are 40 pounds, Tuesdays, 3 Mill Lane.');
  });
});

/* ------------------------------------------------------------------ finding 2 */

describe('a voice approval must carry a draft signature', () => {
  function fileWith(mutate: (decisions: Array<Record<string, unknown>>, facts: Facts) => void): string {
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'voice', option: 'quarterdeck', status: 'accepted' },
    ]);
    const file = JSON.parse(buildFile(session, STAMP).json) as Record<string, unknown>;
    const content = file['content'] as { facts: Facts; decisions: Array<Record<string, unknown>> };
    mutate(content.decisions, content.facts);
    return JSON.stringify(file);
  }

  it('accepts the signature this build writes, including the empty one', () => {
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'voice', option: 'quarterdeck', status: 'accepted' },
    ]);
    const parsed = validateFileText(buildFile(session, STAMP).json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(findDecision(parsed.value.content, 'voice', 'quarterdeck').context?.draftSignature).toBe('');
  });

  it('rejects a voice approval whose signature is null', () => {
    const text = fileWith((decisions) => {
      const voice = decisions.find((d) => d['category'] === 'voice' && d['status'] === 'accepted');
      (voice!['context'] as Record<string, unknown>)['draftSignature'] = null;
    });
    const result = validateFileText(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/draftSignature.*could never be checked again/);
  });

  it('rejects a voice approval whose signature is missing entirely', () => {
    const text = fileWith((decisions) => {
      const voice = decisions.find((d) => d['category'] === 'voice' && d['status'] === 'accepted');
      delete (voice!['context'] as Record<string, unknown>)['draftSignature'];
    });
    expect(validateFileText(text).ok).toBe(false);
  });

  it('rejects a signature missing from a retained context on a reopened voice option', () => {
    // The option was accepted, then replaced, so its context is retained and
    // becomes live again on undo - it has to be just as complete.
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'voice', option: 'quarterdeck', status: 'accepted' },
      { type: 'setStatus', category: 'voice', option: 'ledger', status: 'accepted' },
    ]);
    const file = JSON.parse(buildFile(session, STAMP).json) as Record<string, unknown>;
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    const retained = content.decisions.find((d) => d['category'] === 'voice' && d['option'] === 'quarterdeck');
    expect(retained!['status']).toBe('open');
    expect((retained!['context'] as Record<string, unknown>)['draftSignature']).toBe('');
    (retained!['context'] as Record<string, unknown>)['draftSignature'] = null;
    expect(validateFileText(JSON.stringify(file)).ok).toBe(false);
  });

  it('rejects a file transactionally, leaving nothing partly applied', () => {
    const text = fileWith((decisions) => {
      const voice = decisions.find((d) => d['category'] === 'voice' && d['status'] === 'accepted');
      (voice!['context'] as Record<string, unknown>)['draftSignature'] = null;
    });
    const result = validateFileText(text);
    expect(result.ok).toBe(false);
    // The result carries no candidate at all, so a caller has nothing to apply.
    expect(Object.hasOwn(result, 'value')).toBe(false);
  });

  it('still rejects a signature on a palette or typography approval', () => {
    const session = run(createInitialSession(), [
      { type: 'setStatus', category: 'palette', option: 'ledger', status: 'accepted' },
    ]);
    const file = JSON.parse(buildFile(session, STAMP).json) as Record<string, unknown>;
    const content = file['content'] as { decisions: Array<Record<string, unknown>> };
    const palette = content.decisions.find((d) => d['category'] === 'palette' && d['status'] === 'accepted');
    (palette!['context'] as Record<string, unknown>)['draftSignature'] = 'smuggled';
    const result = validateFileText(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/only meaningful for a voice decision/);
  });

  it('asks for a review rather than passing one if a signature were ever absent', () => {
    const session = run(createInitialSession(), [
      { type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Written by hand' },
      { type: 'setStatus', category: 'voice', option: 'quarterdeck', status: 'accepted' },
    ]);
    const decision = findDecision(session.content, 'voice', 'quarterdeck');
    expect(reviewFor(session.content, decision).needsReview).toBe(false);

    const withoutSignature = { ...decision, context: { ...decision.context!, draftSignature: null } };
    expect(reviewFor(session.content, withoutSignature).draftChanged).toBe(true);
  });
});

/* ------------------------------------------------------------------ finding 5 */

describe('a trimmed undo history stays disclosed across round trips', () => {
  function trimmedSession(): Session {
    let session = createInitialSession();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      session = apply(session, { type: 'setFact', field: 'what', value: `variant ${i}` }, T0 + i * 5_000);
    }
    return session;
  }

  it('records the step bound and the trim in the written file', () => {
    const file = buildFile(trimmedSession(), STAMP);
    const parsed = JSON.parse(file.json) as Record<string, unknown>;
    expect(parsed['historyStepLimit']).toBe(HISTORY_LIMIT);
    expect(parsed['historyTrimmed']).toBe(true);
    expect(parsed['historyStepsDroppedForSize']).toBe(0);
    expect(file.historyTrimmed).toBe(true);
    expect(String(parsed['note'])).toContain(`bounded at ${HISTORY_LIMIT} steps`);
  });

  it('keeps saying so after the file is reopened and written again', () => {
    const first = buildFile(trimmedSession(), STAMP);
    const parsed = validateFileText(first.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.historyTrimmed).toBe(true);

    const reopened = apply(
      createInitialSession(),
      {
        type: 'replaceContent',
        content: parsed.value.content,
        history: parsed.value.history,
        trimmed: parsed.value.historyTrimmed,
      },
      T0,
    );
    expect(reopened.history.trimmed).toBe(true);

    const second = buildFile(reopened, STAMP);
    expect(second.historyTrimmed).toBe(true);
    expect((JSON.parse(second.json) as Record<string, unknown>)['historyTrimmed']).toBe(true);
  });

  it('does not claim a trim that never happened', () => {
    const session = run(createInitialSession(), [{ type: 'setFact', field: 'name', value: BAKERY.name }]);
    const file = buildFile(session, STAMP);
    expect(file.historyTrimmed).toBe(false);
    expect((JSON.parse(file.json) as Record<string, unknown>)['historyTrimmed']).toBe(false);

    const parsed = validateFileText(file.json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.historyTrimmed).toBe(false);
  });

  it('rejects a malformed trim disclosure rather than guessing', () => {
    const file = JSON.parse(buildFile(createInitialSession(), STAMP).json) as Record<string, unknown>;
    file['historyTrimmed'] = 'yes';
    expect(validateFileText(JSON.stringify(file)).ok).toBe(false);

    const other = JSON.parse(buildFile(createInitialSession(), STAMP).json) as Record<string, unknown>;
    other['historyStepsDroppedForSize'] = -1;
    expect(validateFileText(JSON.stringify(other)).ok).toBe(false);
  });
});
