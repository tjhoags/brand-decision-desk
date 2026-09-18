/**
 * Schema 1 files, written by version 1.0, must still open here with everything
 * intact - including every retained undo step - and a schema 2 file must carry
 * preferences, scope and provenance through a full round trip.
 *
 * The version 1 fixtures below are built by stripping the current writer back
 * to the shape 1.0 actually emitted, so they stay honest if the writer changes.
 */
import { describe, expect, it } from 'vitest';
import { apply, createInitialSession, findDecision, resolveCopy, type Action } from '../../src/domain/state';
import { buildFile } from '../../src/domain/portable';
import { validateFileText } from '../../src/domain/validate';
import { buildPreference, preferenceReview, type DraftPreference } from '../../src/domain/compare';
import { SCHEMA_VERSION } from '../../src/domain/presets';
import { PREFERENCE_LIMIT } from '../../src/domain/limits';
import type { CategoryId, DirectionId, Session } from '../../src/domain/types';
import versionOneFixture from '../e2e/fixtures/version-1-worksheet.json';

const T0 = Date.parse('2026-09-18T10:00:00.000Z');
const STAMP = '2026-09-18T10:30:00.000Z';

function run(session: Session, actions: Action[]): Session {
  return actions.reduce((acc, action, i) => apply(acc, action, T0 + (i + 1) * 5_000), session);
}

const HELD: Record<CategoryId, DirectionId> = {
  palette: 'quarterdeck',
  typography: 'quarterdeck',
  voice: 'quarterdeck',
};

function draft(overrides: Partial<DraftPreference> = {}): DraftPreference {
  return {
    axis: 'palette',
    chosen: 'quarterdeck',
    against: 'openHarbor',
    scope: 'customerFacing',
    statement: 'The slate ground reads as considered rather than loud.',
    surface: 'homepage',
    held: HELD,
    ...overrides,
  };
}

/** A worked session with decisions, reasons, drafts and undo history. */
function worked(): Session {
  return run(createInitialSession(), [
    { type: 'setFact', field: 'who', value: 'Adults returning to drawing' },
    { type: 'setDraft', voice: 'openHarbor', field: 'headline', value: 'Come and draw on a Tuesday' },
    { type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Anchored and serious.' },
    { type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' },
    { type: 'setReason', category: 'typography', option: 'ledger', value: 'Too severe for a beginner.' },
    { type: 'setStatus', category: 'typography', option: 'ledger', status: 'rejected' },
    { type: 'setStatus', category: 'voice', option: 'openHarbor', status: 'accepted' },
  ]);
}

/**
 * The exact shape version 1.0 wrote: schema 1, and no `preferences` key on the
 * content or on any history step.
 */
function asVersionOneFile(session: Session): string {
  const file = JSON.parse(buildFile(session, STAMP).json) as Record<string, unknown>;
  file['schemaVersion'] = 1;
  const strip = (payload: Record<string, unknown>): Record<string, unknown> => {
    const copy = { ...payload };
    delete copy['preferences'];
    return copy;
  };
  file['content'] = strip(file['content'] as Record<string, unknown>);
  file['history'] = (file['history'] as Array<Record<string, unknown>>).map(strip);
  return JSON.stringify(file, null, 2);
}

describe('opening a version 1 worksheet', () => {
  it('is accepted, reports the schema it came from, and starts with no preferences', () => {
    const file = asVersionOneFile(worked());
    expect(file).not.toContain('"preferences"');

    const result = validateFileText(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.content.preferences).toEqual([]);
  });

  it('brings every decision, reason and approval context across unchanged', () => {
    const session = worked();
    const result = validateFileText(asVersionOneFile(session));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.content.decisions).toEqual(session.content.decisions);
    expect(findDecision(result.value.content, 'palette', 'quarterdeck').reason).toBe('Anchored and serious.');
    expect(findDecision(result.value.content, 'palette', 'quarterdeck').context?.facts.who).toBe(
      'Adults returning to drawing',
    );
    expect(findDecision(result.value.content, 'typography', 'ledger').status).toBe('rejected');
    expect(result.value.content.facts).toEqual(session.content.facts);
    expect(resolveCopy(result.value.content, 'openHarbor').headline).toBe('Come and draw on a Tuesday');
    expect(result.value.view).toEqual(session.view);
  });

  it('migrates every historical step, not just the current one', () => {
    const session = worked();
    const result = validateFileText(asVersionOneFile(session));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.history).toHaveLength(session.history.past.length);
    expect(result.value.history.length).toBeGreaterThan(3);
    for (const [index, step] of result.value.history.entries()) {
      expect(step.preferences, `history step ${index} was not migrated`).toEqual([]);
      expect(step.facts).toEqual(session.history.past[index]?.facts);
      expect(step.decisions).toEqual(session.history.past[index]?.decisions);
    }
  });

  it('keeps undo working after the migration', () => {
    const session = worked();
    const result = validateFileText(asVersionOneFile(session));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reopened = apply(
      createInitialSession(),
      { type: 'replaceContent', content: result.value.content, history: result.value.history, view: result.value.view },
      T0,
    );
    const undone = apply(reopened, { type: 'undo' }, T0 + 1_000);
    expect(undone.content).toEqual(session.history.past.at(-1));
    expect(undone.content.preferences).toEqual([]);
  });

  it('refuses a version 1 file that carries preferences it could not have written', () => {
    const file = JSON.parse(asVersionOneFile(worked())) as { content: Record<string, unknown> };
    file.content['preferences'] = [];
    const result = validateFileText(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/content\.preferences.*unexpected field/);
  });

  it('refuses a version 1 history step that carries preferences', () => {
    const file = JSON.parse(asVersionOneFile(worked())) as { history: Array<Record<string, unknown>> };
    file.history[0]!['preferences'] = [];
    expect(validateFileText(JSON.stringify(file)).ok).toBe(false);
  });
});

describe('a schema 2 worksheet round trip', () => {
  function withPreferences(): Session {
    let session = worked();
    for (const [index, overrides] of [
      draft(),
      draft({
        axis: 'voice',
        chosen: 'openHarbor',
        against: 'ledger',
        scope: 'thisExample',
        surface: 'email',
        statement: 'Warmer opening; the itemised one read like a form.',
        held: { palette: 'quarterdeck', typography: 'quarterdeck', voice: 'openHarbor' },
      }),
    ].entries()) {
      const preference = buildPreference(session.content, overrides, `2026-09-18T11:0${index}:00.000Z`);
      session = apply(session, { type: 'savePreference', preference }, T0 + (index + 20) * 5_000);
    }
    return session;
  }

  it('writes schema 2 and reopens with preferences, scope and provenance intact', () => {
    const session = withPreferences();
    const file = buildFile(session, STAMP);
    const parsed = JSON.parse(file.json) as Record<string, unknown>;
    expect(parsed['schemaVersion']).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect(parsed['presetVersion']).toBe(1);

    const result = validateFileText(file.json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.schemaVersion).toBe(2);
    expect(result.value.content).toEqual(session.content);

    const [first, second] = result.value.content.preferences;
    expect(first?.scope).toBe('customerFacing');
    expect(first?.statement).toBe('The slate ground reads as considered rather than loud.');
    expect(first?.evidence.held).toEqual(HELD);
    expect(first?.evidence.surface).toBe('homepage');
    expect(first?.evidence.chosenCopy.headline).toBeTruthy();
    expect(second?.axis).toBe('voice');
    expect(second?.evidence.surface).toBe('email');
    expect(Object.keys(second?.evidence.chosenCopy ?? {})).toEqual(['emailSubject', 'emailBody']);
  });

  it('carries preferences through the retained undo history', () => {
    const session = withPreferences();
    const result = validateFileText(buildFile(session, STAMP).json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reopened = apply(
      createInitialSession(),
      { type: 'replaceContent', content: result.value.content, history: result.value.history },
      T0,
    );
    expect(reopened.content.preferences).toHaveLength(2);

    const undone = apply(reopened, { type: 'undo' }, T0 + 1_000);
    expect(undone.content.preferences).toHaveLength(1);
    const again = apply(undone, { type: 'undo' }, T0 + 2_000);
    expect(again.content.preferences).toHaveLength(0);
  });

  it('keeps a stale preference stale across a round trip', () => {
    const session = run(withPreferences(), [{ type: 'setFact', field: 'name', value: 'Northline Books' }]);
    expect(preferenceReview(session.content, session.content.preferences[0]!).needsReview).toBe(true);

    const result = validateFileText(buildFile(session, STAMP).json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const review = preferenceReview(result.value.content, result.value.content.preferences[0]!);
    expect(review.needsReview).toBe(true);
    expect(review.changedFacts).toContain('name');
    expect(result.value.content.preferences[0]?.evidence.facts.name).toBe('Halyard Studio');
  });
});

describe('an invalid preference payload cannot reach the worksheet', () => {
  function fileWith(mutate: (preferences: Array<Record<string, unknown>>) => void): string {
    const session = apply(
      worked(),
      { type: 'savePreference', preference: buildPreference(worked().content, draft(), STAMP) },
      T0 + 90_000,
    );
    const file = JSON.parse(buildFile(session, STAMP).json) as {
      content: { preferences: Array<Record<string, unknown>> };
    };
    mutate(file.content.preferences);
    return JSON.stringify(file);
  }

  const cases: Array<[string, (p: Array<Record<string, unknown>>) => void, RegExp]> = [
    ['a scope that is not one of the two', (p) => void (p[0]!['scope'] = 'everywhere'), /scope.*thisExample, customerFacing/],
    ['an empty statement', (p) => void (p[0]!['statement'] = '   '), /statement.*is empty/],
    ['a missing statement', (p) => void delete p[0]!['statement'], /statement.*must be text/],
    ['an unknown axis', (p) => void (p[0]!['axis'] = 'iconography'), /axis.*not a component/],
    ['an unknown direction', (p) => void (p[0]!['chosen'] = 'midnight'), /chosen.*not a direction/],
    ['a comparison with itself', (p) => void (p[0]!['against'] = p[0]!['chosen']), /compares a direction with itself/],
    ['no evidence at all', (p) => void delete p[0]!['evidence'], /evidence.*not evidence/],
    [
      'held picks that contradict the chosen direction',
      (p) => {
        const evidence = p[0]!['evidence'] as { held: Record<string, string> };
        evidence.held['palette'] = 'ledger';
      },
      /held\.palette.*does not match/,
    ],
    [
      'copy evidence from a surface that was not compared',
      (p) => {
        const evidence = p[0]!['evidence'] as { chosenCopy: Record<string, string> };
        evidence.chosenCopy['emailBody'] = 'never rendered in this comparison';
      },
      /chosenCopy\.emailBody.*unexpected field/,
    ],
    [
      'an oversized statement',
      (p) => void (p[0]!['statement'] = 'x'.repeat(601)),
      /statement.*longer than the 600/,
    ],
    ['a duplicate id', (p) => p.push({ ...p[0]! }), /duplicate preference id/],
    ['an unexpected field', (p) => void (p[0]!['applyEverywhere'] = true), /applyEverywhere.*unexpected field/],
  ];

  for (const [name, mutate, matcher] of cases) {
    it(`rejects ${name}`, () => {
      const result = validateFileText(fileWith(mutate));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.problems.join(' | ')).toMatch(matcher);
        expect(result.summary).toMatch(/left exactly as it is|nothing was changed/i);
      }
    });
  }

  it('rejects more preferences than this build keeps', () => {
    const result = validateFileText(
      fileWith((preferences) => {
        const base = preferences[0]!;
        for (let i = 0; i < PREFERENCE_LIMIT + 1; i += 1) {
          preferences.push({ ...base, id: `extra-${i}` });
        }
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(new RegExp(`at most ${PREFERENCE_LIMIT}`));
  });

  it('rejects preferences that are not a list', () => {
    const file = JSON.parse(fileWith(() => undefined)) as { content: Record<string, unknown> };
    file.content['preferences'] = { first: 'not a list' };
    const result = validateFileText(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/preferences.*must be a list/);
  });
});

/**
 * The committed fixture the browser migration test opens. Checking it here
 * keeps it a real version 1 file rather than something that drifted.
 */
describe('the committed version 1 fixture', () => {
  it('is a schema 1 worksheet with no preferences anywhere', () => {
    const file = versionOneFixture as unknown as {
      kind: string;
      schemaVersion: number;
      presetVersion: number;
      content: Record<string, unknown>;
      history: Array<Record<string, unknown>>;
    };
    expect(file.kind).toBe('brand-decision-desk');
    expect(file.schemaVersion).toBe(1);
    expect(file.presetVersion).toBe(1);
    expect(Object.hasOwn(file.content, 'preferences')).toBe(false);
    expect(file.history.length).toBeGreaterThan(3);
    for (const step of file.history) expect(Object.hasOwn(step, 'preferences')).toBe(false);
  });

  it('opens here, migrated, with its decisions and every history step intact', () => {
    const result = validateFileText(JSON.stringify(versionOneFixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.content.preferences).toEqual([]);
    expect(findDecision(result.value.content, 'palette', 'quarterdeck').status).toBe('accepted');
    expect(findDecision(result.value.content, 'palette', 'quarterdeck').reason).toBe('Anchored and serious.');
    expect(findDecision(result.value.content, 'typography', 'ledger').status).toBe('rejected');
    expect(resolveCopy(result.value.content, 'openHarbor').headline).toBe('Come and draw on a Tuesday');
    expect(result.value.view.preview.palette).toBe('ledger');
    for (const step of result.value.history) expect(step.preferences).toEqual([]);
  });
});


it('rejects purported palette evidence whose wording changes between sides', () => {
  let session = createInitialSession();
  session = apply(session, { type: 'savePreference', preference: buildPreference(session.content, draft(), STAMP) }, T0);
  const file = JSON.parse(buildFile(session, STAMP).json);
  file.content.preferences[0].evidence.againstCopy.headline = 'Different words';
  expect(validateFileText(JSON.stringify(file)).ok).toBe(false);
});

it('rejects an empty preference identity or recorded date', () => {
  let session = createInitialSession();
  session = apply(session, { type: 'savePreference', preference: buildPreference(session.content, draft(), STAMP) }, T0);
  for (const field of ['id', 'recordedAt']) {
    const file = JSON.parse(buildFile(session, STAMP).json);
    file.content.preferences[0][field] = '';
    expect(validateFileText(JSON.stringify(file)).ok).toBe(false);
  }
});


it('requires the preference list in schema 2 rather than silently inventing an empty one', () => {
  const file = JSON.parse(buildFile(createInitialSession(), STAMP).json);
  delete file.content.preferences;
  expect(validateFileText(JSON.stringify(file)).ok).toBe(false);
});
