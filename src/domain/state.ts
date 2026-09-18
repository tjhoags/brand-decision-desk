/**
 * Pure state transitions.
 *
 * `apply` is the only way content changes. It is a plain function of
 * (session, action, now) so every rule here - the no-op on an identical save,
 * the single accepted option per category, the retained reason, the bounded
 * undo history - is unit-testable without a browser.
 */
import {
  CATEGORY_IDS,
  COPY_FIELDS,
  DIRECTION_IDS,
  FACT_FIELDS,
  type CategoryId,
  type Content,
  type CopyField,
  type CopyText,
  type Decision,
  type DecisionStatus,
  type DirectionId,
  type Drafts,
  type FactField,
  type Facts,
  type PreviewMode,
  type ReviewState,
  type Session,
  type StaleMention,
  type ViewState,
} from './types';
import { COALESCE_MS, COPY_LIMITS, FACT_LIMITS, HISTORY_LIMIT, REASON_LIMIT } from './limits';
import { DEFAULT_PREVIEW, EXAMPLE_FACTS, VOICE_COPY } from './presets';

/* -------------------------------------------------------------- construction */

export function emptyDrafts(): Drafts {
  return {
    quarterdeck: { fields: {} },
    openHarbor: { fields: {} },
    ledger: { fields: {} },
  };
}

export function emptyDecisions(): Decision[] {
  const out: Decision[] = [];
  for (const category of CATEGORY_IDS) {
    for (const option of DIRECTION_IDS) {
      out.push({ category, option, status: 'open', reason: '', context: null });
    }
  }
  return out;
}

export function createInitialContent(): Content {
  return {
    facts: { ...EXAMPLE_FACTS },
    drafts: emptyDrafts(),
    decisions: emptyDecisions(),
  };
}

export function createInitialSession(): Session {
  return {
    content: createInitialContent(),
    view: { preview: { ...DEFAULT_PREVIEW }, previewMode: 'homepage' },
    history: { past: [], lastKey: null, lastAt: 0, trimmed: false },
  };
}

/* ------------------------------------------------------------------ readers */

export function findDecision(content: Content, category: CategoryId, option: DirectionId): Decision {
  const found = content.decisions.find((d) => d.category === category && d.option === option);
  if (!found) {
    // emptyDecisions() guarantees all nine and the importer rejects any file
    // that is missing one, so this is a programming error, not bad input.
    throw new Error(`missing decision for ${category}/${option}`);
  }
  return found;
}

export function acceptedOption(content: Content, category: CategoryId): DirectionId | null {
  const found = content.decisions.find((d) => d.category === category && d.status === 'accepted');
  return found ? found.option : null;
}

export function acceptedDecision(content: Content, category: CategoryId): Decision | null {
  return content.decisions.find((d) => d.category === category && d.status === 'accepted') ?? null;
}

const FACT_PLACEHOLDER: Record<FactField, string> = {
  name: '[BUSINESS NAME]',
  what: '[WHAT IT IS]',
  who: '[WHO IT IS FOR]',
  offer: '[WHAT IS OFFERED]',
};

const TOKEN: Record<string, FactField> = {
  '{name}': 'name',
  '{what}': 'what',
  '{who}': 'who',
  '{offer}': 'offer',
};

/**
 * Lowers the first letter for a token used mid-sentence, leaving anything that
 * announces itself as a name or an acronym alone ("CFOs", "UK-based", and the
 * bracketed blanks, which are written in capitals).
 */
function lowerFirst(value: string): string {
  const first = value[0];
  const second = value[1];
  if (!first || first === first.toLowerCase()) return value;
  if (second && /[A-Z]/.test(second)) return value;
  return first.toLowerCase() + value.slice(1);
}

/**
 * Fills `{name}` and `{who:lc}` style tokens in preset wording from the current
 * facts, so preset copy always states the brief as it stands rather than the
 * brief as it was when the preset was written.
 */
export function fillTokens(template: string, facts: Facts): string {
  return template.replace(/\{(name|what|who|offer)(:lc)?\}/g, (_match, key: string, modifier?: string) => {
    const field = TOKEN[`{${key}}`];
    if (!field) return _match;
    const raw = facts[field].trim();
    const value = raw.length > 0 ? raw : FACT_PLACEHOLDER[field];
    return modifier === ':lc' ? lowerFirst(value) : value;
  });
}

/**
 * Fact fields still holding the fictional sample value. The desk marks these so
 * a preview and an export never present untouched sample text as something the
 * user asserted about a real business.
 */
export function sampleFactFields(content: Content): FactField[] {
  return FACT_FIELDS.filter((field) => content.facts[field] === EXAMPLE_FACTS[field]);
}

/** Preset wording for one voice with the current facts filled in. */
export function presetCopy(voice: DirectionId, facts: Facts): CopyText {
  const preset = VOICE_COPY[voice];
  return {
    headline: fillTokens(preset.headline, facts),
    supportingLine: fillTokens(preset.supportingLine, facts),
    ctaWording: fillTokens(preset.ctaWording, facts),
    emailSubject: fillTokens(preset.emailSubject, facts),
    emailBody: fillTokens(preset.emailBody, facts),
  };
}

/**
 * The wording actually shown for a voice: preset copy, with any field the user
 * has written taking over. Draft text is literal - tokens are not re-filled in
 * user text, which is why `staleMentions` exists.
 */
export function resolveCopy(content: Content, voice: DirectionId): CopyText {
  const preset = presetCopy(voice, content.facts);
  const overrides = content.drafts[voice].fields;
  const out = { ...preset };
  for (const field of COPY_FIELDS) {
    const override = overrides[field];
    if (override) out[field] = override.text;
  }
  return out;
}

export function isOverridden(content: Content, voice: DirectionId, field: CopyField): boolean {
  return content.drafts[voice].fields[field] !== undefined;
}

export function hasAnyOverride(content: Content, voice: DirectionId): boolean {
  return COPY_FIELDS.some((field) => isOverridden(content, voice, field));
}

/** Stable serialisation of one voice's written text, used as approval context. */
export function draftSignature(content: Content, voice: DirectionId): string {
  const overrides = content.drafts[voice].fields;
  const parts: string[] = [];
  for (const field of COPY_FIELDS) {
    const override = overrides[field];
    if (override) parts.push(JSON.stringify([field, override.text]));
  }
  return parts.join('|');
}

/**
 * Whether an accepted choice still stands against the brief it was approved
 * from. Derived by comparing the stored approval context with the live content,
 * not by a boolean flag, so returning the brief to its earlier wording clears
 * the warning on its own.
 */
export function reviewFor(content: Content, decision: Decision): ReviewState {
  const context = decision.context;
  if (decision.status !== 'accepted' || !context) {
    return { needsReview: false, changedFacts: [], draftChanged: false };
  }
  const changedFacts = FACT_FIELDS.filter((f) => context.facts[f] !== content.facts[f]);
  // The importer requires a signature on every voice context, so this coalesce
  // is defence in depth: a missing one compares as "no written copy", which
  // asks for a review rather than quietly passing one.
  const draftChanged =
    decision.category === 'voice' &&
    (context.draftSignature ?? '') !== draftSignature(content, decision.option);
  return { needsReview: changedFacts.length > 0 || draftChanged, changedFacts, draftChanged };
}

export function categoriesNeedingReview(content: Content): CategoryId[] {
  return CATEGORY_IDS.filter((category) => {
    const decision = acceptedDecision(content, category);
    return decision ? reviewFor(content, decision).needsReview : false;
  });
}

/**
 * Written copy that still contains a fact value the brief has since changed.
 * Reported per field against the facts captured when that field was edited, so
 * editing one field never hides a stale mention sitting in another.
 */
export function staleMentions(content: Content, voice: DirectionId): StaleMention[] {
  const byField = new Map<FactField, StaleMention>();
  const overrides = content.drafts[voice].fields;
  for (const copyField of COPY_FIELDS) {
    const override = overrides[copyField];
    if (!override) continue;
    for (const factField of FACT_FIELDS) {
      const was = override.basedOn[factField].trim();
      const now = content.facts[factField].trim();
      if (was.length < 3 || was === now) continue;
      if (!override.text.includes(was)) continue;
      const existing = byField.get(factField);
      if (existing) existing.inFields.push(copyField);
      else byField.set(factField, { field: factField, was, now, inFields: [copyField] });
    }
  }
  return [...byField.values()];
}

export function allStaleMentions(content: Content): Array<{ voice: DirectionId; mentions: StaleMention[] }> {
  return DIRECTION_IDS.map((voice) => ({ voice, mentions: staleMentions(content, voice) })).filter(
    (entry) => entry.mentions.length > 0,
  );
}

/* --------------------------------------------------------------- comparison */

function orderedFacts(facts: Facts): Record<string, string> {
  return { name: facts.name, what: facts.what, who: facts.who, offer: facts.offer };
}

/** Order-stable serialisation used for equality and for storage round-trips. */
export function canonicalContent(content: Content): string {
  const drafts: Record<string, unknown> = {};
  for (const voice of DIRECTION_IDS) {
    const fields: Record<string, unknown> = {};
    for (const field of COPY_FIELDS) {
      const override = content.drafts[voice].fields[field];
      if (override) fields[field] = { text: override.text, basedOn: orderedFacts(override.basedOn) };
    }
    drafts[voice] = { fields };
  }
  const decisions = content.decisions.map((d) => ({
    category: d.category,
    option: d.option,
    status: d.status,
    reason: d.reason,
    context: d.context
      ? { facts: orderedFacts(d.context.facts), draftSignature: d.context.draftSignature, at: d.context.at }
      : null,
  }));
  return JSON.stringify({ facts: orderedFacts(content.facts), drafts, decisions });
}

export function contentEquals(a: Content, b: Content): boolean {
  return canonicalContent(a) === canonicalContent(b);
}

/* ------------------------------------------------------------------ actions */

export type Action =
  | { type: 'setFact'; field: FactField; value: string }
  | { type: 'setDraft'; voice: DirectionId; field: CopyField; value: string }
  | { type: 'resetDraftField'; voice: DirectionId; field: CopyField }
  | { type: 'resetDraftAll'; voice: DirectionId }
  | { type: 'setStatus'; category: CategoryId; option: DirectionId; status: DecisionStatus }
  | { type: 'setReason'; category: CategoryId; option: DirectionId; value: string }
  | { type: 'reconfirm'; category: CategoryId }
  | { type: 'undo' }
  | { type: 'replaceContent'; content: Content; history?: Content[]; trimmed?: boolean; view?: ViewState }
  | { type: 'setPreview'; category: CategoryId; option: DirectionId }
  | { type: 'setPreviewAll'; option: DirectionId }
  | { type: 'previewAccepted' }
  | { type: 'setPreviewMode'; mode: PreviewMode };

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function coalesceKey(action: Action): string | null {
  switch (action.type) {
    case 'setFact':
      return `fact:${action.field}`;
    case 'setDraft':
      return `draft:${action.voice}:${action.field}`;
    case 'setReason':
      return `reason:${action.category}:${action.option}`;
    default:
      return null;
  }
}

function withDecision(
  content: Content,
  category: CategoryId,
  option: DirectionId,
  update: (decision: Decision) => Decision,
): Content {
  return {
    ...content,
    decisions: content.decisions.map((d) =>
      d.category === category && d.option === option ? update(d) : d,
    ),
  };
}

function nextContent(content: Content, action: Action, now: number): Content {
  switch (action.type) {
    case 'setFact': {
      // Facts are single-line by contract: the brief renders them inline and
      // the Markdown export quotes them inline, so a pasted line break is
      // folded to a space rather than breaking either.
      const value = clamp(action.value.replace(/[\r\n]+/g, ' '), FACT_LIMITS[action.field]);
      if (content.facts[action.field] === value) return content;
      return { ...content, facts: { ...content.facts, [action.field]: value } };
    }

    case 'setDraft': {
      const value = clamp(action.value, COPY_LIMITS[action.field]);
      const entry = content.drafts[action.voice];
      const current = entry.fields[action.field];
      if (current && current.text === value) return content;
      return {
        ...content,
        drafts: {
          ...content.drafts,
          [action.voice]: {
            fields: { ...entry.fields, [action.field]: { text: value, basedOn: { ...content.facts } } },
          },
        },
      };
    }

    case 'resetDraftField': {
      const entry = content.drafts[action.voice];
      if (!entry.fields[action.field]) return content;
      const fields = { ...entry.fields };
      delete fields[action.field];
      return { ...content, drafts: { ...content.drafts, [action.voice]: { fields } } };
    }

    case 'resetDraftAll': {
      const entry = content.drafts[action.voice];
      if (Object.keys(entry.fields).length === 0) return content;
      return { ...content, drafts: { ...content.drafts, [action.voice]: { fields: {} } } };
    }

    case 'setStatus': {
      const target = findDecision(content, action.category, action.option);
      if (target.status === action.status) return content;

      if (action.status !== 'accepted') {
        // Rejecting or reopening touches only this row and keeps the reason
        // and any previously recorded approval context.
        return withDecision(content, action.category, action.option, (d) => ({ ...d, status: action.status }));
      }

      // At most one accepted option per category. The option being replaced
      // returns to open and keeps its reason and its recorded context.
      const cleared: Content = {
        ...content,
        decisions: content.decisions.map((d) =>
          d.category === action.category && d.option !== action.option && d.status === 'accepted'
            ? { ...d, status: 'open' as DecisionStatus }
            : d,
        ),
      };
      return withDecision(cleared, action.category, action.option, (d) => ({
        ...d,
        status: 'accepted',
        context: {
          facts: { ...cleared.facts },
          draftSignature: action.category === 'voice' ? draftSignature(cleared, action.option) : null,
          at: new Date(now).toISOString(),
        },
      }));
    }

    case 'setReason': {
      const value = clamp(action.value, REASON_LIMIT);
      const target = findDecision(content, action.category, action.option);
      if (target.reason === value) return content;
      return withDecision(content, action.category, action.option, (d) => ({ ...d, reason: value }));
    }

    case 'reconfirm': {
      const decision = acceptedDecision(content, action.category);
      if (!decision) return content;
      return withDecision(content, action.category, decision.option, (d) => ({
        ...d,
        context: {
          facts: { ...content.facts },
          draftSignature: action.category === 'voice' ? draftSignature(content, decision.option) : null,
          at: new Date(now).toISOString(),
        },
      }));
    }

    default:
      return content;
  }
}

/**
 * Applies one action. Content changes are committed through the bounded undo
 * history; display-only actions, and changes that produce identical content,
 * are not recorded at all.
 */
export function apply(session: Session, action: Action, now: number): Session {
  switch (action.type) {
    case 'setPreview':
      if (session.view.preview[action.category] === action.option) return session;
      return {
        ...session,
        view: { ...session.view, preview: { ...session.view.preview, [action.category]: action.option } },
      };

    case 'setPreviewAll': {
      if (
        session.view.preview.palette === action.option &&
        session.view.preview.typography === action.option &&
        session.view.preview.voice === action.option
      ) {
        return session;
      }
      return {
        ...session,
        view: {
          ...session.view,
          preview: { palette: action.option, typography: action.option, voice: action.option },
        },
      };
    }

    case 'previewAccepted': {
      // Categories with nothing accepted keep whatever is on the stage; no
      // choice is invented to fill an empty slot.
      const preview = { ...session.view.preview };
      let changed = false;
      for (const category of CATEGORY_IDS) {
        const accepted = acceptedOption(session.content, category);
        if (accepted && preview[category] !== accepted) {
          preview[category] = accepted;
          changed = true;
        }
      }
      return changed ? { ...session, view: { ...session.view, preview } } : session;
    }

    case 'setPreviewMode':
      if (session.view.previewMode === action.mode) return session;
      return { ...session, view: { ...session.view, previewMode: action.mode } };

    case 'undo': {
      const past = session.history.past;
      const previous = past[past.length - 1];
      if (!previous) return session;
      return {
        ...session,
        content: previous,
        history: {
          past: past.slice(0, -1),
          lastKey: null,
          lastAt: 0,
          trimmed: session.history.trimmed,
        },
      };
    }

    case 'replaceContent': {
      // Import replaces content wholesale and brings its own retained history.
      const incoming = action.history ?? [];
      return {
        ...session,
        view: action.view ?? session.view,
        content: action.content,
        history: {
          past: incoming.slice(-HISTORY_LIMIT),
          lastKey: null,
          lastAt: 0,
          // A file that was already short of steps stays honest about it.
          trimmed: action.trimmed === true || incoming.length > HISTORY_LIMIT,
        },
      };
    }

    default: {
      const next = nextContent(session.content, action, now);
      if (contentEquals(session.content, next)) return session;
      return commit(session, next, coalesceKey(action), now);
    }
  }
}

function commit(session: Session, content: Content, key: string | null, now: number): Session {
  const { history } = session;
  const canCoalesce =
    key !== null && key === history.lastKey && now - history.lastAt <= COALESCE_MS && history.past.length > 0;

  let past = history.past;
  let trimmed = history.trimmed;
  if (!canCoalesce) {
    past = [...past, session.content];
    if (past.length > HISTORY_LIMIT) {
      past = past.slice(past.length - HISTORY_LIMIT);
      trimmed = true;
    }
  }
  return { ...session, content, history: { past, lastKey: key, lastAt: now, trimmed } };
}

export function canUndo(session: Session): boolean {
  return session.history.past.length > 0;
}
