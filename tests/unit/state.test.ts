import { beforeEach, describe, expect, it } from 'vitest';
import {
  acceptedOption,
  apply,
  canUndo,
  createInitialSession,
  findDecision,
  hasAnyOverride,
  presetCopy,
  resolveCopy,
  reviewFor,
  staleMentions,
  type Action,
} from '../../src/domain/state';
import { COALESCE_MS, FACT_LIMITS, HISTORY_LIMIT } from '../../src/domain/limits';
import type { Session } from '../../src/domain/types';

const T0 = Date.parse('2026-03-01T10:00:00.000Z');

function run(session: Session, actions: Array<[Action, number?]>): Session {
  let current = session;
  let clock = T0;
  for (const [action, at] of actions) {
    clock = at ?? clock + COALESCE_MS + 1;
    current = apply(current, action, clock);
  }
  return current;
}

describe('a fresh session', () => {
  let session: Session;
  beforeEach(() => {
    session = createInitialSession();
  });

  it('opens on the fictional example with nothing decided', () => {
    expect(session.content.facts.name).toBe('Halyard Studio');
    expect(session.content.decisions).toHaveLength(9);
    expect(session.content.decisions.every((d) => d.status === 'open')).toBe(true);
    expect(session.content.decisions.every((d) => d.context === null)).toBe(true);
    expect(canUndo(session)).toBe(false);
  });

  it('starts with preset wording and no written overrides', () => {
    expect(hasAnyOverride(session.content, 'quarterdeck')).toBe(false);
    expect(resolveCopy(session.content, 'quarterdeck')).toEqual(
      presetCopy('quarterdeck', session.content.facts),
    );
  });

  it('fills preset tokens from the live facts', () => {
    const renamed = run(session, [[{ type: 'setFact', field: 'name', value: 'Northwind Studio' }]]);
    expect(resolveCopy(renamed.content, 'quarterdeck').emailSubject).toContain('Northwind Studio');
    expect(resolveCopy(renamed.content, 'quarterdeck').emailSubject).not.toContain('Halyard');
  });

  it('shows a bracketed blank rather than a gap when a fact is emptied', () => {
    const blank = run(session, [[{ type: 'setFact', field: 'name', value: '' }]]);
    expect(resolveCopy(blank.content, 'quarterdeck').emailSubject).toContain('[BUSINESS NAME]');
  });
});

describe('accepting, rejecting and leaving open', () => {
  it('keeps at most one accepted option per component and returns the former one to open', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Feels like the printed work.' }],
      [{ type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' }],
      [{ type: 'setStatus', category: 'palette', option: 'ledger', status: 'accepted' }],
    ]);

    expect(acceptedOption(session.content, 'palette')).toBe('ledger');
    const former = findDecision(session.content, 'palette', 'quarterdeck');
    expect(former.status).toBe('open');
    expect(former.reason).toBe('Feels like the printed work.');
    expect(former.context).not.toBeNull();
  });

  it('keeps a rejection specific to one row', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setStatus', category: 'palette', option: 'ledger', status: 'rejected' }],
    ]);
    expect(findDecision(session.content, 'typography', 'ledger').status).toBe('open');
    expect(findDecision(session.content, 'voice', 'ledger').status).toBe('open');
    expect(findDecision(session.content, 'palette', 'openHarbor').status).toBe('open');
  });

  it('keeps the reason when an option is reopened', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setReason', category: 'voice', option: 'ledger', value: 'Too clipped for a first email.' }],
      [{ type: 'setStatus', category: 'voice', option: 'ledger', status: 'rejected' }],
      [{ type: 'setStatus', category: 'voice', option: 'ledger', status: 'open' }],
    ]);
    expect(findDecision(session.content, 'voice', 'ledger').reason).toBe('Too clipped for a first email.');
  });

  it('records the approval context at the moment of acceptance', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' }, T0],
    ]);
    const decision = findDecision(session.content, 'palette', 'quarterdeck');
    expect(decision.context?.facts.name).toBe('Halyard Studio');
    expect(decision.context?.at).toBe(new Date(T0).toISOString());
    expect(decision.context?.draftSignature).toBeNull();
  });
});

describe('review derived from the approval context', () => {
  const accept: Action = { type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' };

  it('flags an accepted choice after a substantive brief change, keeping choice and reason', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Anchored, serious.' }],
      [accept],
      [{ type: 'setFact', field: 'who', value: 'Adults returning to drawing after a long gap' }],
    ]);
    const decision = findDecision(session.content, 'palette', 'quarterdeck');
    const review = reviewFor(session.content, decision);
    expect(review.needsReview).toBe(true);
    expect(review.changedFacts).toEqual(['who']);
    expect(decision.status).toBe('accepted');
    expect(decision.reason).toBe('Anchored, serious.');
  });

  it('treats an identical brief save as a no-op with no review and no undo step', () => {
    const accepted = run(createInitialSession(), [[accept]]);
    const steps = accepted.history.past.length;
    const again = apply(accepted, { type: 'setFact', field: 'name', value: 'Halyard Studio' }, T0 + 9_000);
    expect(again).toBe(accepted);
    expect(again.history.past.length).toBe(steps);
    expect(reviewFor(again.content, findDecision(again.content, 'palette', 'quarterdeck')).needsReview).toBe(false);
  });

  it('clears the warning when the brief is returned to exactly its earlier wording', () => {
    const changed = run(createInitialSession(), [
      [accept],
      [{ type: 'setFact', field: 'name', value: 'Northwind Studio' }],
    ]);
    expect(reviewFor(changed.content, findDecision(changed.content, 'palette', 'quarterdeck')).needsReview).toBe(true);

    const restored = run(changed, [[{ type: 'setFact', field: 'name', value: 'Halyard Studio' }]]);
    expect(reviewFor(restored.content, findDecision(restored.content, 'palette', 'quarterdeck')).needsReview).toBe(
      false,
    );
  });

  it('updates the approval context only on an explicit reconfirm', () => {
    const session = run(createInitialSession(), [
      [accept],
      [{ type: 'setFact', field: 'name', value: 'Northwind Studio' }],
    ]);
    const reconfirmed = run(session, [[{ type: 'reconfirm', category: 'palette' }, T0 + 60_000]]);
    const decision = findDecision(reconfirmed.content, 'palette', 'quarterdeck');
    expect(reviewFor(reconfirmed.content, decision).needsReview).toBe(false);
    expect(decision.context?.facts.name).toBe('Northwind Studio');
    expect(decision.context?.at).toBe(new Date(T0 + 60_000).toISOString());
  });

  it('flags an accepted voice when that voice’s draft copy changes, and not another voice', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setStatus', category: 'voice', option: 'openHarbor', status: 'accepted' }],
      [{ type: 'setDraft', voice: 'ledger', field: 'headline', value: 'Different direction entirely' }],
    ]);
    expect(reviewFor(session.content, findDecision(session.content, 'voice', 'openHarbor')).draftChanged).toBe(false);

    const edited = run(session, [
      [{ type: 'setDraft', voice: 'openHarbor', field: 'headline', value: 'Draw with us on Thursdays' }],
    ]);
    const review = reviewFor(edited.content, findDecision(edited.content, 'voice', 'openHarbor'));
    expect(review.needsReview).toBe(true);
    expect(review.draftChanged).toBe(true);
    expect(findDecision(edited.content, 'voice', 'openHarbor').status).toBe('accepted');
  });
});

describe('draft copy', () => {
  it('overrides one field without touching the others or another direction', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Slow drawing, properly taught' }],
    ]);
    const copy = resolveCopy(session.content, 'quarterdeck');
    expect(copy.headline).toBe('Slow drawing, properly taught');
    expect(copy.supportingLine).toBe(presetCopy('quarterdeck', session.content.facts).supportingLine);
    expect(hasAnyOverride(session.content, 'openHarbor')).toBe(false);
  });

  it('survives switching preview voice and comes back exactly', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Hand written' }],
      [{ type: 'setPreview', category: 'voice', option: 'ledger' }],
      [{ type: 'setPreview', category: 'voice', option: 'quarterdeck' }],
    ]);
    expect(resolveCopy(session.content, 'quarterdeck').headline).toBe('Hand written');
  });

  it('resets one field back to the preset exactly', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setDraft', voice: 'ledger', field: 'ctaWording', value: 'Get in touch' }],
      [{ type: 'resetDraftField', voice: 'ledger', field: 'ctaWording' }],
    ]);
    expect(resolveCopy(session.content, 'ledger').ctaWording).toBe(
      presetCopy('ledger', session.content.facts).ctaWording,
    );
    expect(hasAnyOverride(session.content, 'ledger')).toBe(false);
  });

  it('clamps text at the declared field limit', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setFact', field: 'name', value: 'x'.repeat(FACT_LIMITS.name + 50) }],
    ]);
    expect(session.content.facts.name).toHaveLength(FACT_LIMITS.name);
  });

  it('points at written wording that still names a fact the brief has changed', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Halyard Studio, drawing slowly' }],
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'ctaWording', value: 'Ask about a place' }],
      [{ type: 'setFact', field: 'name', value: 'Northwind Studio' }],
    ]);
    const mentions = staleMentions(session.content, 'quarterdeck');
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ field: 'name', was: 'Halyard Studio', now: 'Northwind Studio' });
    expect(mentions[0]?.inFields).toEqual(['headline']);
  });

  it('does not hide a stale mention when a different field is edited afterwards', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Halyard Studio, drawing slowly' }],
      [{ type: 'setFact', field: 'name', value: 'Northwind Studio' }],
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'emailSubject', value: 'A note from Northwind Studio' }],
    ]);
    expect(staleMentions(session.content, 'quarterdeck')).toHaveLength(1);
  });
});

describe('undo', () => {
  it('restores content, reasons and review state exactly', () => {
    const before = run(createInitialSession(), [
      [{ type: 'setReason', category: 'palette', option: 'quarterdeck', value: 'Anchored, serious.' }],
      [{ type: 'setStatus', category: 'palette', option: 'quarterdeck', status: 'accepted' }],
      [{ type: 'setStatus', category: 'typography', option: 'ledger', status: 'rejected' }],
      [{ type: 'setDraft', voice: 'quarterdeck', field: 'headline', value: 'Kept text' }],
    ]);
    const after = run(before, [[{ type: 'setFact', field: 'who', value: 'Complete beginners only' }]]);
    expect(reviewFor(after.content, findDecision(after.content, 'palette', 'quarterdeck')).needsReview).toBe(true);

    const undone = apply(after, { type: 'undo' }, T0 + 99_000);
    expect(undone.content).toEqual(before.content);
    expect(reviewFor(undone.content, findDecision(undone.content, 'palette', 'quarterdeck')).needsReview).toBe(false);
    expect(findDecision(undone.content, 'palette', 'quarterdeck').reason).toBe('Anchored, serious.');
    expect(resolveCopy(undone.content, 'quarterdeck').headline).toBe('Kept text');
  });

  it('does nothing when there is nothing to undo', () => {
    const session = createInitialSession();
    expect(apply(session, { type: 'undo' }, T0)).toBe(session);
  });

  it('leaves display-only changes out of the undo history', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setPreview', category: 'palette', option: 'ledger' }],
      [{ type: 'setPreviewMode', mode: 'email' }],
      [{ type: 'setPreviewAll', option: 'openHarbor' }],
    ]);
    expect(canUndo(session)).toBe(false);
    expect(session.view.preview.palette).toBe('openHarbor');
    expect(session.view.previewMode).toBe('email');
  });

  it('collapses fast keystrokes in one field into a single step', () => {
    let session = createInitialSession();
    session = apply(session, { type: 'setFact', field: 'name', value: 'H' }, T0);
    session = apply(session, { type: 'setFact', field: 'name', value: 'Ha' }, T0 + 100);
    session = apply(session, { type: 'setFact', field: 'name', value: 'Har' }, T0 + 200);
    expect(session.history.past).toHaveLength(1);

    const undone = apply(session, { type: 'undo' }, T0 + 300);
    expect(undone.content.facts.name).toBe('Halyard Studio');
  });

  it('starts a new step once the pause between keystrokes is long enough', () => {
    let session = createInitialSession();
    session = apply(session, { type: 'setFact', field: 'name', value: 'Ha' }, T0);
    session = apply(session, { type: 'setFact', field: 'name', value: 'Harbour' }, T0 + COALESCE_MS + 10);
    expect(session.history.past).toHaveLength(2);
  });

  it('keeps the newest steps at the declared limit and says it trimmed', () => {
    let session = createInitialSession();
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      session = apply(session, { type: 'setFact', field: 'what', value: `Workshop variant ${i}` }, T0 + i * 5_000);
    }
    expect(session.history.past).toHaveLength(HISTORY_LIMIT);
    expect(session.history.trimmed).toBe(true);
    expect(session.content.facts.what).toBe(`Workshop variant ${HISTORY_LIMIT + 9}`);

    const undone = apply(session, { type: 'undo' }, T0 + 999_000);
    expect(undone.content.facts.what).toBe(`Workshop variant ${HISTORY_LIMIT + 8}`);
  });
});

describe('previewing', () => {
  it('previewing a direction records nothing', () => {
    const session = run(createInitialSession(), [[{ type: 'setPreviewAll', option: 'ledger' }]]);
    expect(session.content.decisions.every((d) => d.status === 'open')).toBe(true);
  });

  it('mixes components independently', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setPreview', category: 'palette', option: 'ledger' }],
      [{ type: 'setPreview', category: 'voice', option: 'openHarbor' }],
    ]);
    expect(session.view.preview).toEqual({
      palette: 'ledger',
      typography: 'quarterdeck',
      voice: 'openHarbor',
    });
  });

  it('previewing accepted choices fills only the components that have one', () => {
    const session = run(createInitialSession(), [
      [{ type: 'setPreviewAll', option: 'ledger' }],
      [{ type: 'setStatus', category: 'palette', option: 'openHarbor', status: 'accepted' }],
      [{ type: 'previewAccepted' }],
    ]);
    expect(session.view.preview.palette).toBe('openHarbor');
    expect(session.view.preview.typography).toBe('ledger');
    expect(session.view.preview.voice).toBe('ledger');
  });
});
