/**
 * The controlled comparison.
 *
 * The whole point of this journey is that exactly one thing moves. `buildSides`
 * is the only place the two sides are constructed, and it builds both from the
 * same held triple so the invariant is structural rather than something the
 * interface has to remember. The unit tests assert it for every axis.
 *
 * It also states plainly what each axis actually changes. The typography
 * presets in this build alter the typeface *and* the geometry - corners, rules,
 * alignment, the shape of the fact band - so calling a typography comparison a
 * font test would be a lie about the experiment that was run.
 */
import {
  CATEGORY_IDS,
  FACT_FIELDS,
  type CategoryId,
  type Content,
  type CopyField,
  type CopyText,
  type DirectionId,
  type Preference,
  type PreferenceEvidence,
  type PreferenceReview,
  type PreferenceScope,
  type PreviewMode,
  type SurfaceCopy,
} from './types';
import { resolveCopy } from './state';
import { DIRECTION_NAME } from './presets';

/** How the compare journey names each axis, and what it really varies. */
export const AXIS_LABEL: Record<CategoryId, string> = {
  palette: 'Palette',
  typography: 'Typography treatment',
  voice: 'Voice',
};

export const AXIS_WHAT_CHANGES: Record<CategoryId, string> = {
  palette: 'Only the colours change: page, hero, detail band and call to action. The words and the shapes stay.',
  typography:
    'The typeface and the shapes change together: headings, labels, corner radius, rule weight, alignment and the ' +
    'layout of the fact band. This is a treatment, not a font test, and one comparison cannot tell you which part ' +
    'of it you reacted to.',
  voice: 'Only the words change, as they actually read now, including any wording you have rewritten by hand.',
};

export const SCOPE_LABEL: Record<PreferenceScope, string> = {
  thisExample: 'This example, on this surface',
  customerFacing: "This project's customer-facing work",
};

export const SCOPE_DETAIL: Record<PreferenceScope, string> = {
  thisExample:
    'A note about this one page for this one business. It says nothing about the next page or the next business.',
  customerFacing:
    'A working preference for what this project puts in front of customers. Still this project only - the desk ' +
    'never turns it into a rule, applies it anywhere, or sends it somewhere else.',
};

export const SURFACE_LABEL: Record<PreviewMode, string> = {
  homepage: 'Homepage',
  email: 'Customer email',
};

/** The caveat that travels with every saved preference, in the app and in exports. */
export const COMPARISON_CAVEAT =
  'One comparison shows which of two rendered examples someone preferred on one surface, with everything else ' +
  'held still. It does not isolate which attribute caused the reaction, and it is not evidence about any other ' +
  'business, surface or combination.';

/** The copy fields a surface actually renders, and therefore the evidence. */
export function surfaceFields(surface: PreviewMode): CopyField[] {
  return surface === 'homepage'
    ? ['headline', 'supportingLine', 'ctaWording']
    : ['emailSubject', 'emailBody'];
}

export function captureSurfaceCopy(copy: CopyText, surface: PreviewMode): SurfaceCopy {
  const out: SurfaceCopy = {};
  for (const field of surfaceFields(surface)) out[field] = copy[field];
  return out;
}

export interface ComparisonSide {
  option: DirectionId;
  /** The full preview triple this side renders with. */
  picks: Record<CategoryId, DirectionId>;
  /** The voice whose wording this side shows. */
  voice: DirectionId;
}

export interface Comparison {
  axis: CategoryId;
  surface: PreviewMode;
  /** The triple in force before the comparison; both sides start from it. */
  held: Record<CategoryId, DirectionId>;
  /** The axes that did not move, for the "held fixed" line. */
  heldAxes: CategoryId[];
  a: ComparisonSide;
  b: ComparisonSide;
}

function sideFor(
  held: Record<CategoryId, DirectionId>,
  axis: CategoryId,
  option: DirectionId,
): ComparisonSide {
  // Built from the held triple with exactly one key replaced, so no caller can
  // accidentally vary a second thing.
  const picks: Record<CategoryId, DirectionId> = { ...held, [axis]: option };
  return { option, picks, voice: picks.voice };
}

/**
 * The two sides of a comparison. `a` is what is already on the stage for this
 * axis; `b` is the alternative. Everything else comes from `held` unchanged.
 */
export function buildSides(
  held: Record<CategoryId, DirectionId>,
  axis: CategoryId,
  alternative: DirectionId,
  surface: PreviewMode,
): Comparison {
  return {
    axis,
    surface,
    held: { ...held },
    heldAxes: CATEGORY_IDS.filter((category) => category !== axis),
    a: sideFor(held, axis, held[axis]),
    b: sideFor(held, axis, alternative),
  };
}

/** The directions available as the alternative: anything but what is on the stage. */
export function alternativesFor(held: Record<CategoryId, DirectionId>, axis: CategoryId): DirectionId[] {
  return (['quarterdeck', 'openHarbor', 'ledger'] as DirectionId[]).filter((id) => id !== held[axis]);
}

/** Ids are stable within a session and readable in an exported file. */
export function preferenceId(axis: CategoryId, chosen: DirectionId, against: DirectionId, at: string): string {
  return `${axis}-${chosen}-vs-${against}-${at.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

export interface DraftPreference {
  axis: CategoryId;
  chosen: DirectionId;
  against: DirectionId;
  scope: PreferenceScope;
  statement: string;
  surface: PreviewMode;
  held: Record<CategoryId, DirectionId>;
}

/**
 * Turns a finished comparison into a preference, capturing the conditions as
 * evidence. The wording is read from the live content, so a voice comparison
 * records the copy as it actually read - preset or hand-written.
 */
export function buildPreference(content: Content, draft: DraftPreference, at: string): Preference {
  const chosenVoice = draft.axis === 'voice' ? draft.chosen : draft.held.voice;
  const againstVoice = draft.axis === 'voice' ? draft.against : draft.held.voice;
  const evidence: PreferenceEvidence = {
    facts: { ...content.facts },
    held: { ...draft.held },
    surface: draft.surface,
    chosenCopy: captureSurfaceCopy(resolveCopy(content, chosenVoice), draft.surface),
    againstCopy: captureSurfaceCopy(resolveCopy(content, againstVoice), draft.surface),
  };
  return {
    id: preferenceId(draft.axis, draft.chosen, draft.against, at),
    axis: draft.axis,
    chosen: draft.chosen,
    against: draft.against,
    scope: draft.scope,
    statement: draft.statement,
    recordedAt: at,
    evidence,
  };
}

function surfaceCopyEquals(a: SurfaceCopy, b: SurfaceCopy): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as CopyField] !== b[key as CopyField]) return false;
  }
  return true;
}

/**
 * Whether the conditions a preference was recorded under still hold. Derived by
 * comparing the stored evidence with the live content, so putting the brief and
 * the wording back clears the flag on its own. The evidence is never rewritten.
 */
export function preferenceReview(content: Content, preference: Preference): PreferenceReview {
  const { evidence } = preference;
  const changedFacts = FACT_FIELDS.filter((field) => evidence.facts[field] !== content.facts[field]);

  const chosenVoice = preference.axis === 'voice' ? preference.chosen : evidence.held.voice;
  const againstVoice = preference.axis === 'voice' ? preference.against : evidence.held.voice;
  const copyChanged =
    !surfaceCopyEquals(captureSurfaceCopy(resolveCopy(content, chosenVoice), evidence.surface), evidence.chosenCopy) ||
    !surfaceCopyEquals(captureSurfaceCopy(resolveCopy(content, againstVoice), evidence.surface), evidence.againstCopy);

  return { needsReview: changedFacts.length > 0 || copyChanged, changedFacts, copyChanged };
}

export function preferencesNeedingReview(content: Content): Preference[] {
  return content.preferences.filter((preference) => preferenceReview(content, preference).needsReview);
}

/** One line describing what was compared, used in the app and in exports. */
export function comparisonSummary(preference: Preference): string {
  return (
    `${AXIS_LABEL[preference.axis]}: ${DIRECTION_NAME[preference.chosen]} preferred over ` +
    `${DIRECTION_NAME[preference.against]} on the ${SURFACE_LABEL[preference.evidence.surface].toLowerCase()}`
  );
}

/** The axes that were held still, named with what they were held at. */
export function heldSummary(preference: Preference): string {
  const others = CATEGORY_IDS.filter((category) => category !== preference.axis);
  return others.map((category) => `${AXIS_LABEL[category]} ${DIRECTION_NAME[preference.evidence.held[category]]}`).join(', ');
}
