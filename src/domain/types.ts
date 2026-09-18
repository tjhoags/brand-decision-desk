/**
 * Core types for the Brand Decision Desk.
 *
 * Everything here is plain data: the reducer in `state.ts` turns one `Content`
 * into the next, the serialiser in `portable.ts` turns a `Session` into a file,
 * and the validator in `validate.ts` turns an untrusted file back into a
 * candidate `Session` before anything is replaced.
 */

export const CATEGORY_IDS = ['palette', 'typography', 'voice'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const DIRECTION_IDS = ['quarterdeck', 'openHarbor', 'ledger'] as const;
export type DirectionId = (typeof DIRECTION_IDS)[number];

export const DECISION_STATUSES = ['open', 'accepted', 'rejected'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const FACT_FIELDS = ['name', 'what', 'who', 'offer'] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export const COPY_FIELDS = [
  'headline',
  'supportingLine',
  'ctaWording',
  'emailSubject',
  'emailBody',
] as const;
export type CopyField = (typeof COPY_FIELDS)[number];

export const PREVIEW_MODES = ['homepage', 'email'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

export type Facts = Record<FactField, string>;
export type CopyText = Record<CopyField, string>;

/**
 * Draft copy is stored as sparse per-field overrides of the preset wording, so
 * switching voice never destroys what someone wrote and "reset to the preset"
 * is exact. `basedOn` records the facts at the moment that one field was last
 * edited, which is what lets the desk point at wording that still names a fact
 * the brief has since changed.
 */
export interface DraftOverride {
  text: string;
  basedOn: Facts;
}

export interface DraftEntry {
  fields: Partial<Record<CopyField, DraftOverride>>;
}

export type Drafts = Record<DirectionId, DraftEntry>;

/** The brief context copied into a decision at the moment it is accepted. */
export interface ApprovalContext {
  facts: Facts;
  /** Serialised draft overrides for the accepted voice; null for palette/type. */
  draftSignature: string | null;
  at: string;
}

export interface Decision {
  category: CategoryId;
  option: DirectionId;
  status: DecisionStatus;
  reason: string;
  /**
   * Retained after an accepted choice returns to open so the record can still
   * say what the choice was approved against. Null until first accepted.
   */
  context: ApprovalContext | null;
}

/** Undoable content. Display-only state lives in `ViewState` and is not here. */
export interface Content {
  facts: Facts;
  drafts: Drafts;
  /** Exactly one entry per (category, option) pair, in a stable order. */
  decisions: Decision[];
}

/** Display-only state: what is on the stage right now. Never in undo history. */
export interface ViewState {
  preview: Record<CategoryId, DirectionId>;
  previewMode: PreviewMode;
}

export interface History {
  past: Content[];
  /** Coalescing key of the edit that produced the newest entry, if any. */
  lastKey: string | null;
  lastAt: number;
  /** True once the bounded history has dropped its oldest entries. */
  trimmed: boolean;
}

export interface Session {
  content: Content;
  view: ViewState;
  history: History;
}

export interface ReviewState {
  needsReview: boolean;
  changedFacts: FactField[];
  draftChanged: boolean;
}

/** A fact value still present in draft copy that the brief has since changed. */
export interface StaleMention {
  field: FactField;
  was: string;
  now: string;
  inFields: CopyField[];
}
