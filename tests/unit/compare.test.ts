/**
 * The controlled comparison and the preferences it produces.
 *
 * The one-axis invariant is asserted for every axis and every alternative,
 * because it is the only thing that makes a saved preference mean anything.
 */
import { describe, expect, it } from 'vitest';
import {
  AXIS_LABEL,
  AXIS_WHAT_CHANGES,
  COMPARISON_CAVEAT,
  SCOPE_LABEL,
  alternativesFor,
  buildPreference,
  buildSides,
  captureSurfaceCopy,
  comparisonSummary,
  heldSummary,
  preferenceReview,
  preferencesNeedingReview,
  surfaceFields,
  type DraftPreference,
} from '../../src/domain/compare';
import { apply, createInitialSession, findDecision, resolveCopy, type Action } from '../../src/domain/state';
import { PREFERENCE_LIMIT } from '../../src/domain/limits';
import {
  CATEGORY_IDS,
  DIRECTION_IDS,
  PREVIEW_MODES,
  type CategoryId,
  type DirectionId,
  type Session,
} from '../../src/domain/types';

const T0 = Date.parse('2026-09-18T10:00:00.000Z');
const AT = '2026-09-18T10:05:00.000Z';

function run(session: Session, actions: Action[]): Session {
  return actions.reduce((acc, action, i) => apply(acc, action, T0 + (i + 1) * 5_000), session);
}

function draft(overrides: Partial<DraftPreference> = {}): DraftPreference {
  const held: Record<CategoryId, DirectionId> = {
    palette: 'quarterdeck',
    typography: 'quarterdeck',
    voice: 'quarterdeck',
  };
  return {
    axis: 'palette',
    chosen: 'quarterdeck',
    against: 'openHarbor',
    scope: 'thisExample',
    statement: 'The darker ground made the work look considered.',
    surface: 'homepage',
    held,
    ...overrides,
  };
}

/* ------------------------------------------------------- the one-axis rule */

describe('a comparison changes exactly one thing', () => {
  const held: Record<CategoryId, DirectionId> = {
    palette: 'quarterdeck',
    typography: 'openHarbor',
    voice: 'ledger',
  };

  for (const axis of CATEGORY_IDS) {
    for (const alternative of DIRECTION_IDS) {
      if (alternative === held[axis]) continue;
      for (const surface of PREVIEW_MODES) {
        it(`${axis} vs ${alternative} on the ${surface} holds the other two axes`, () => {
          const comparison = buildSides(held, axis, alternative, surface);

          expect(comparison.a.picks[axis]).toBe(held[axis]);
          expect(comparison.b.picks[axis]).toBe(alternative);
          expect(comparison.a.option).not.toBe(comparison.b.option);

          for (const other of CATEGORY_IDS) {
            if (other === axis) continue;
            expect(comparison.a.picks[other], `side A moved ${other}`).toBe(held[other]);
            expect(comparison.b.picks[other], `side B moved ${other}`).toBe(held[other]);
          }
          expect(comparison.heldAxes).toEqual(CATEGORY_IDS.filter((c) => c !== axis));
          expect(comparison.surface).toBe(surface);
        });
      }
    }
  }

  it('renders both sides with the voice each side should carry', () => {
    const voiceComparison = buildSides(held, 'voice', 'quarterdeck', 'homepage');
    expect(voiceComparison.a.voice).toBe('ledger');
    expect(voiceComparison.b.voice).toBe('quarterdeck');

    // For a non-voice axis both sides must read the same words, or the
    // comparison would be varying two things at once.
    const paletteComparison = buildSides(held, 'palette', 'ledger', 'homepage');
    expect(paletteComparison.a.voice).toBe(paletteComparison.b.voice);
    expect(paletteComparison.a.voice).toBe(held.voice);
  });

  it('offers the two directions that are not already on the stage', () => {
    expect(alternativesFor(held, 'palette')).toEqual(['openHarbor', 'ledger']);
    expect(alternativesFor(held, 'typography')).toEqual(['quarterdeck', 'ledger']);
    expect(alternativesFor(held, 'voice')).toEqual(['quarterdeck', 'openHarbor']);
  });

  it('names the typography axis as a treatment, not a font test', () => {
    expect(AXIS_LABEL.typography).toBe('Typography treatment');
    expect(AXIS_WHAT_CHANGES.typography).toMatch(/typeface and the shapes change together/);
    expect(AXIS_WHAT_CHANGES.typography).toMatch(/not a font test/);
    expect(AXIS_WHAT_CHANGES.palette).toMatch(/Only the colours change/);
    expect(AXIS_WHAT_CHANGES.voice).toMatch(/Only the words change/);
  });

  it('never claims a comparison isolates an attribute', () => {
    expect(COMPARISON_CAVEAT).toMatch(/does not isolate which attribute caused the reaction/);
  });
});

/* -------------------------------------------------------- the evidence kept */

describe('the evidence a preference carries', () => {
  it('captures only the wording the compared surface actually rendered', () => {
    expect(surfaceFields('homepage')).toEqual(['headline', 'supportingLine', 'ctaWording']);
    expect(surfaceFields('email')).toEqual(['emailSubject', 'emailBody']);

    const session = createInitialSession();
    const copy = resolveCopy(session.content, 'quarterdeck');
    expect(Object.keys(captureSurfaceCopy(copy, 'homepage'))).toEqual([
      'headline',
      'supportingLine',
      'ctaWording',
    ]);
    expect(Object.keys(captureSurfaceCopy(copy, 'email'))).toEqual(['emailSubject', 'emailBody']);
  });

  it('keeps the facts, the held axes, the surface and both sides of the copy', () => {
    const session = createInitialSession();
    const preference = buildPreference(session.content, draft(), AT);

    expect(preference.evidence.facts).toEqual(session.content.facts);
    expect(preference.evidence.held).toEqual({
      palette: 'quarterdeck',
      typography: 'quarterdeck',
      voice: 'quarterdeck',
    });
    expect(preference.evidence.surface).toBe('homepage');
    expect(preference.evidence.chosenCopy.headline).toBe(resolveCopy(session.content, 'quarterdeck').headline);
    expect(preference.evidence.againstCopy).toEqual(preference.evidence.chosenCopy);
  });

  it('compares voice using the copy as it really reads, including hand-written wording', () => {
    const session = run(createInitialSession(), [
      { type: 'setDraft', voice: 'openHarbor', field: 'headline', value: 'Words I wrote myself' },
    ]);
    const preference = buildPreference(
      session.content,
      draft({
        axis: 'voice',
        chosen: 'openHarbor',
        against: 'quarterdeck',
        held: { palette: 'quarterdeck', typography: 'quarterdeck', voice: 'openHarbor' },
      }),
      AT,
    );
    expect(preference.evidence.chosenCopy.headline).toBe('Words I wrote myself');
    expect(preference.evidence.againstCopy.headline).toBe(
      resolveCopy(session.content, 'quarterdeck').headline,
    );
    expect(preference.evidence.chosenCopy.headline).not.toBe(preference.evidence.againstCopy.headline);
  });

  it('summarises what was compared and what was held', () => {
    const preference = buildPreference(createInitialSession().content, draft(), AT);
    expect(comparisonSummary(preference)).toBe(
      'Palette: Quarterdeck preferred over Open Harbor on the homepage',
    );
    expect(heldSummary(preference)).toBe('Typography treatment Quarterdeck, Voice Quarterdeck');
  });
});

/* ------------------------------------------------------- saving and undoing */

describe('saving a preference', () => {
  function saved(session: Session, overrides: Partial<DraftPreference> = {}): Session {
    const preference = buildPreference(session.content, draft(overrides), AT);
    return apply(session, { type: 'savePreference', preference }, T0 + 60_000);
  }

  it('records it without touching any decision', () => {
    const before = run(createInitialSession(), [
      { type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Considered on its own terms.' },
      { type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' },
      { type: 'setStatus', category: 'palette', option: 'ledger', status: 'rejected' },
    ]);
    const after = saved(before);

    expect(after.content.preferences).toHaveLength(1);
    expect(after.content.decisions).toEqual(before.content.decisions);
    expect(findDecision(after.content, 'palette', 'openHarbor').status).toBe('open');
    expect(findDecision(after.content, 'palette', 'quarterdeck').reason).toBe('Considered on its own terms.');
  });

  it('does not accept a category just because a side was preferred', () => {
    const after = saved(createInitialSession(), { chosen: 'openHarbor', against: 'quarterdeck' });
    expect(after.content.decisions.every((d) => d.status === 'open')).toBe(true);
  });

  it('refuses to save without the user’s own words', () => {
    const session = createInitialSession();
    const blank = buildPreference(session.content, draft({ statement: '   ' }), AT);
    const after = apply(session, { type: 'savePreference', preference: blank }, T0 + 60_000);
    expect(after).toBe(session);
    expect(after.content.preferences).toHaveLength(0);
  });

  it('is one undo step, and undo restores the worksheet exactly', () => {
    const before = createInitialSession();
    const after = saved(before);
    expect(after.history.past).toHaveLength(1);

    const undone = apply(after, { type: 'undo' }, T0 + 90_000);
    expect(undone.content).toEqual(before.content);
    expect(undone.content.preferences).toHaveLength(0);
  });

  it('removes one explicitly, and undo brings it back with its evidence', () => {
    const withOne = saved(createInitialSession());
    const id = withOne.content.preferences[0]?.id;
    expect(id).toBeTruthy();

    const removed = apply(withOne, { type: 'removePreference', id: id! }, T0 + 70_000);
    expect(removed.content.preferences).toHaveLength(0);

    const restored = apply(removed, { type: 'undo' }, T0 + 80_000);
    expect(restored.content.preferences).toEqual(withOne.content.preferences);
  });

  it('removing an id that is not there is a no-op', () => {
    const withOne = saved(createInitialSession());
    expect(apply(withOne, { type: 'removePreference', id: 'nothing-like-this' }, T0 + 70_000)).toBe(withOne);
  });

  it('refuses a duplicate id rather than saving the same thing twice', () => {
    const session = createInitialSession();
    const preference = buildPreference(session.content, draft(), AT);
    const once = apply(session, { type: 'savePreference', preference }, T0 + 60_000);
    const twice = apply(once, { type: 'savePreference', preference }, T0 + 70_000);
    expect(twice).toBe(once);
    expect(twice.content.preferences).toHaveLength(1);
  });

  it('stops at the declared limit instead of dropping an earlier one', () => {
    let session: Session = createInitialSession();
    for (let i = 0; i < PREFERENCE_LIMIT + 3; i += 1) {
      const preference = {
        ...buildPreference(session.content, draft({ statement: `Note ${i}` }), AT),
        id: `preference-${i}`,
      };
      session = apply(session, { type: 'savePreference', preference }, T0 + (i + 1) * 5_000);
    }
    expect(session.content.preferences).toHaveLength(PREFERENCE_LIMIT);
    expect(session.content.preferences[0]?.statement).toBe('Note 0');
    expect(session.content.preferences.at(-1)?.statement).toBe(`Note ${PREFERENCE_LIMIT - 1}`);
  });

  it('names both scopes in plain language, and neither is universal', () => {
    expect(SCOPE_LABEL.thisExample).toBe('This example, on this surface');
    expect(SCOPE_LABEL.customerFacing).toBe("This project's customer-facing work");
  });
});

/* --------------------------------------------------------------- staleness */

describe('a preference is flagged when its conditions move', () => {
  function withPreference(session: Session, overrides: Partial<DraftPreference> = {}): Session {
    const preference = buildPreference(session.content, draft(overrides), AT);
    return apply(session, { type: 'savePreference', preference }, T0 + 60_000);
  }

  it('flags a changed business fact without rewriting the evidence', () => {
    const session = withPreference(createInitialSession());
    const preference = session.content.preferences[0]!;
    expect(preferenceReview(session.content, preference).needsReview).toBe(false);

    const changed = run(session, [{ type: 'setFact', field: 'who', value: 'Adults coming back to it' }]);
    const stored = changed.content.preferences[0]!;
    const review = preferenceReview(changed.content, stored);

    expect(review.needsReview).toBe(true);
    expect(review.changedFacts).toContain('who');
    expect(stored.evidence.facts.who).toBe('Beginners who want a relaxed way to practise');
    expect(stored.statement).toBe('The darker ground made the work look considered.');
    expect(preferencesNeedingReview(changed.content)).toHaveLength(1);
  });

  it('flags changed wording on the surface that was compared', () => {
    const session = withPreference(createInitialSession());
    const edited = run(session, [
      { type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'A different headline entirely' },
    ]);
    const review = preferenceReview(edited.content, edited.content.preferences[0]!);
    expect(review.copyChanged).toBe(true);
    expect(review.needsReview).toBe(true);
  });

  it('ignores wording on a surface the comparison did not use', () => {
    const session = withPreference(createInitialSession(), { surface: 'homepage' });
    const edited = run(session, [
      { type: 'setDraft', voice: 'quarterdeck', field: 'emailBody', value: 'Only the email changed.' },
    ]);
    expect(preferenceReview(edited.content, edited.content.preferences[0]!).needsReview).toBe(false);
  });

  it('ignores wording for a voice the comparison never rendered', () => {
    const session = withPreference(createInitialSession());
    const edited = run(session, [
      { type: 'setDraft', voice: 'ledger', field: 'headline', value: 'A voice nobody compared' },
    ]);
    expect(preferenceReview(edited.content, edited.content.preferences[0]!).needsReview).toBe(false);
  });

  it('clears the flag when the brief is put back exactly', () => {
    const session = withPreference(createInitialSession());
    const changed = run(session, [{ type: 'setFact', field: 'who', value: 'Someone else' }]);
    expect(preferenceReview(changed.content, changed.content.preferences[0]!).needsReview).toBe(true);

    const restored = run(changed, [
      { type: 'setFact', field: 'who', value: 'Beginners who want a relaxed way to practise' },
    ]);
    expect(preferenceReview(restored.content, restored.content.preferences[0]!).needsReview).toBe(false);
  });
});


describe('independent release review', () => {
  it('retains two different notes saved for the same comparison at the same timestamp', () => {
    let session = createInitialSession();
    const first = buildPreference(session.content, draft(), AT);
    session = apply(session, { type: 'savePreference', preference: first }, T0);
    const second = buildPreference(session.content, draft({ statement: 'The contrast also makes the call to action clear.' }), AT);
    expect(second.id).not.toBe(first.id);
    session = apply(session, { type: 'savePreference', preference: second }, T0 + 1);
    expect(session.content.preferences).toHaveLength(2);
    expect(session.content.preferences[1]?.statement).toBe(second.statement);
  });
});
