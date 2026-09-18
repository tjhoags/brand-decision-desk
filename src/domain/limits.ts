/**
 * Explicit field limits. The UI enforces them on input, the reducer clamps and
 * the importer rejects anything past them, so the current worksheet can never
 * grow beyond a size that a JSON export can carry and an import can take back.
 */
import type { CopyField, FactField } from './types';

export const FACT_LIMITS: Record<FactField, number> = {
  name: 120,
  what: 240,
  who: 240,
  offer: 240,
};

export const COPY_LIMITS: Record<CopyField, number> = {
  headline: 160,
  supportingLine: 400,
  ctaWording: 80,
  emailSubject: 160,
  emailBody: 2400,
};

export const REASON_LIMIT = 600;

/** A saved preference statement. Their words, so the same room as a reason. */
export const PREFERENCE_STATEMENT_LIMIT = 600;

/**
 * Saved preferences kept per worksheet. Each one carries the wording that was
 * on screen as evidence, so they are not free; the desk refuses a new one at
 * the limit and says so rather than dropping an older one.
 */
export const PREFERENCE_LIMIT = 20;

/** Undo steps kept in memory and carried in an export. Disclosed in the UI. */
export const HISTORY_LIMIT = 50;

/** Keystrokes in one field inside this window collapse into one undo step. */
export const COALESCE_MS = 900;

/** Largest file the importer will read at all. */
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Ceiling for a written export. Current work is never dropped to fit; if the
 * file would exceed this, the oldest undo steps are left out and the export
 * says so. Kept below IMPORT_MAX_BYTES so every export we offer can be
 * reopened by this same build.
 */
export const EXPORT_MAX_BYTES = 3 * 1024 * 1024;

export const STORAGE_KEY = 'brand-decision-desk/session/v1';
