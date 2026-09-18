/**
 * The portable worksheet file.
 *
 * Lists are used where a map would hide a duplicate: JSON object keys collapse
 * silently, so decisions and draft fields are arrays and the importer can tell
 * a duplicated entry from a missing one.
 */
import {
  COPY_FIELDS,
  DIRECTION_IDS,
  type Content,
  type CopyField,
  type DirectionId,
  type Facts,
  type Session,
  type ViewState,
} from './types';
import { EXPORT_MAX_BYTES, HISTORY_LIMIT } from './limits';
import { PRESET_VERSION, SCHEMA_VERSION } from './presets';

export const FILE_KIND = 'brand-decision-desk';

export interface PortableDraftField {
  field: CopyField;
  text: string;
  basedOn: Facts;
}

export interface PortableDraft {
  voice: DirectionId;
  fields: PortableDraftField[];
}

export interface PortableDecision {
  category: string;
  option: string;
  status: string;
  reason: string;
  context: { facts: Facts; draftSignature: string | null; at: string } | null;
}

export interface PortablePreference {
  id: string;
  axis: string;
  chosen: string;
  against: string;
  scope: string;
  statement: string;
  recordedAt: string;
  evidence: {
    facts: Facts;
    held: Record<string, string>;
    surface: string;
    chosenCopy: Record<string, string>;
    againstCopy: Record<string, string>;
  };
}

export interface PortableContent {
  facts: Facts;
  drafts: PortableDraft[];
  decisions: PortableDecision[];
  /** Added in schema 2. A migrated version 1 file arrives with this empty. */
  preferences: PortablePreference[];
}

export interface PortableFile {
  kind: typeof FILE_KIND;
  schemaVersion: number;
  presetVersion: number;
  exportedAt: string;
  note: string;
  /** The undo-step bound of the build that wrote the file. */
  historyStepLimit: number;
  /**
   * True when steps older than the ones in `history` are gone, for any reason:
   * the step bound was reached, this write dropped some to fit, or the file
   * this session was opened from already said so. It survives a round trip so
   * the desk never quietly regains a complete history it does not have.
   */
  historyTrimmed: boolean;
  /** How many steps this particular write left out to stay reopenable. */
  historyStepsDroppedForSize: number;
  content: PortableContent;
  view: ViewState;
  history: PortableContent[];
}

export const FILE_NOTE =
  'Worksheet file from the Brand Decision Desk. It records choices, reasons, draft wording and preferences saved ' +
  'from side-by-side comparisons. It is not a published site, a sent email, a finished brand, or an instruction to ' +
  'any other tool: nothing here is applied anywhere automatically. ' +
  `Undo history is bounded at ${HISTORY_LIMIT} steps, so a file may hold fewer steps than the work behind it.`;

export function toPortableContent(content: Content): PortableContent {
  return {
    facts: { ...content.facts },
    drafts: DIRECTION_IDS.map((voice) => ({
      voice,
      fields: COPY_FIELDS.flatMap((field) => {
        const override = content.drafts[voice].fields[field];
        return override ? [{ field, text: override.text, basedOn: { ...override.basedOn } }] : [];
      }),
    })),
    decisions: content.decisions.map((d) => ({
      category: d.category,
      option: d.option,
      status: d.status,
      reason: d.reason,
      context: d.context
        ? { facts: { ...d.context.facts }, draftSignature: d.context.draftSignature, at: d.context.at }
        : null,
    })),
    preferences: content.preferences.map((preference) => ({
      id: preference.id,
      axis: preference.axis,
      chosen: preference.chosen,
      against: preference.against,
      scope: preference.scope,
      statement: preference.statement,
      recordedAt: preference.recordedAt,
      evidence: {
        facts: { ...preference.evidence.facts },
        held: { ...preference.evidence.held },
        surface: preference.evidence.surface,
        chosenCopy: { ...preference.evidence.chosenCopy } as Record<string, string>,
        againstCopy: { ...preference.evidence.againstCopy } as Record<string, string>,
      },
    })),
  };
}

export interface BuiltFile {
  json: string;
  bytes: number;
  /** Undo steps left out so the file stays inside the reopenable size limit. */
  historyStepsDropped: number;
  historyStepsKept: number;
  /** Whether any earlier step is missing, from this write or from before it. */
  historyTrimmed: boolean;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Serialises a session. Current work is never trimmed; if the file would be too
 * large to reopen, the oldest undo steps are dropped instead and the caller is
 * told exactly how many, so the desk can say so rather than fail quietly.
 */
export function buildFile(session: Session, exportedAt: string): BuiltFile {
  const content = toPortableContent(session.content);
  const view: ViewState = {
    preview: { ...session.view.preview },
    previewMode: session.view.previewMode,
  };
  let history = session.history.past.map(toPortableContent);
  let dropped = 0;

  for (;;) {
    // Once anything has been dropped - here, by the step bound, or by the file
    // this session came from - the flag stays set for every later export.
    const trimmed = session.history.trimmed || dropped > 0;
    const file: PortableFile = {
      kind: FILE_KIND,
      schemaVersion: SCHEMA_VERSION,
      presetVersion: PRESET_VERSION,
      exportedAt,
      note: FILE_NOTE,
      historyStepLimit: HISTORY_LIMIT,
      historyTrimmed: trimmed,
      historyStepsDroppedForSize: dropped,
      content,
      view,
      history,
    };
    const json = `${JSON.stringify(file, null, 2)}\n`;
    const bytes = byteLength(json);
    if (bytes <= EXPORT_MAX_BYTES || history.length === 0) {
      return {
        json,
        bytes,
        historyStepsDropped: dropped,
        historyStepsKept: history.length,
        historyTrimmed: trimmed,
      };
    }
    history = history.slice(1);
    dropped += 1;
  }
}

export function fileStem(facts: Facts, exportedAt: string): string {
  const slug =
    facts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'brand';
  const day = exportedAt.slice(0, 10);
  return `${slug}-decisions-${day}`;
}
