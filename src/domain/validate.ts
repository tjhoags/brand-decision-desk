/**
 * Untrusted input becomes a candidate here, and only a fully valid candidate is
 * ever handed back to the app. Nothing in this module touches live state, so a
 * rejected file cannot disturb the worksheet or the stored copy.
 *
 * A file carries ids and text, never code, URLs or styles: palette and type
 * values are looked up from the presets in this build by id, so an import can
 * never introduce a colour, a font or a stylesheet of its own.
 */
import {
  CATEGORY_IDS,
  COPY_FIELDS,
  DECISION_STATUSES,
  DIRECTION_IDS,
  FACT_FIELDS,
  PREVIEW_MODES,
  type CategoryId,
  type Content,
  type CopyField,
  type Decision,
  type DecisionStatus,
  type DirectionId,
  type Drafts,
  type Facts,
  type PreviewMode,
  type ViewState,
} from './types';
import { COPY_LIMITS, FACT_LIMITS, HISTORY_LIMIT, IMPORT_MAX_BYTES, REASON_LIMIT } from './limits';
import { PRESET_VERSION, SCHEMA_VERSION } from './presets';
import { FILE_KIND } from './portable';

export interface Candidate {
  content: Content;
  view: ViewState;
  history: Content[];
  historyTrimmedForSize: boolean;
  exportedAt: string | null;
}

export type ValidationResult =
  | { ok: true; value: Candidate }
  | { ok: false; summary: string; problems: string[] };

const MAX_REPORTED = 8;
const AT_MAX = 40;
const SIGNATURE_MAX = 40_000;

class Problems {
  readonly list: string[] = [];

  add(path: string, message: string): false {
    if (this.list.length < MAX_REPORTED) this.list.push(`${path}: ${message}`);
    else if (this.list.length === MAX_REPORTED) this.list.push('(further problems not listed)');
    return false;
  }

  get any(): boolean {
    return this.list.length > 0;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, p: Problems): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) p.add(`${path}.${key}`, 'unexpected field');
  }
}

function readString(value: unknown, path: string, max: number, p: Problems): string | null {
  if (typeof value !== 'string') return p.add(path, 'must be text') === false ? null : null;
  if (value.length > max) return p.add(path, `is longer than the ${max} character limit`) === false ? null : null;
  return value;
}

function readFacts(value: unknown, path: string, p: Problems): Facts | null {
  if (!isPlainObject(value)) {
    p.add(path, 'must be an object of business facts');
    return null;
  }
  checkKeys(value, FACT_FIELDS, path, p);
  const out = {} as Facts;
  let ok = true;
  for (const field of FACT_FIELDS) {
    const text = readString(value[field], `${path}.${field}`, FACT_LIMITS[field], p);
    if (text === null) {
      ok = false;
    } else if (/[\r\n]/.test(text)) {
      ok = p.add(`${path}.${field}`, 'must be a single line');
    } else {
      out[field] = text;
    }
  }
  return ok ? out : null;
}

function readDrafts(value: unknown, path: string, p: Problems): Drafts | null {
  if (!Array.isArray(value)) {
    p.add(path, 'must be a list with one entry per direction');
    return null;
  }
  const out: Drafts = {
    quarterdeck: { fields: {} },
    openHarbor: { fields: {} },
    ledger: { fields: {} },
  };
  const seen = new Set<string>();
  let ok = true;

  value.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      ok = p.add(at, 'must be an object');
      return;
    }
    checkKeys(entry, ['voice', 'fields'], at, p);
    const voice = entry['voice'];
    if (typeof voice !== 'string' || !(DIRECTION_IDS as readonly string[]).includes(voice)) {
      ok = p.add(`${at}.voice`, `is not a direction in this build (expected one of ${DIRECTION_IDS.join(', ')})`);
      return;
    }
    if (seen.has(voice)) {
      ok = p.add(`${at}.voice`, `appears more than once (${voice})`);
      return;
    }
    seen.add(voice);

    const fields = entry['fields'];
    if (!Array.isArray(fields)) {
      ok = p.add(`${at}.fields`, 'must be a list');
      return;
    }
    const seenFields = new Set<string>();
    fields.forEach((raw, fieldIndex) => {
      const fieldAt = `${at}.fields[${fieldIndex}]`;
      if (!isPlainObject(raw)) {
        ok = p.add(fieldAt, 'must be an object');
        return;
      }
      checkKeys(raw, ['field', 'text', 'basedOn'], fieldAt, p);
      const field = raw['field'];
      if (typeof field !== 'string' || !(COPY_FIELDS as readonly string[]).includes(field)) {
        ok = p.add(`${fieldAt}.field`, 'is not a copy field in this build');
        return;
      }
      if (seenFields.has(field)) {
        ok = p.add(`${fieldAt}.field`, `appears more than once for ${voice} (${field})`);
        return;
      }
      seenFields.add(field);
      const copyField = field as CopyField;
      const text = readString(raw['text'], `${fieldAt}.text`, COPY_LIMITS[copyField], p);
      const basedOn = readFacts(raw['basedOn'], `${fieldAt}.basedOn`, p);
      if (text === null || basedOn === null) {
        ok = false;
        return;
      }
      out[voice as DirectionId].fields[copyField] = { text, basedOn };
    });
  });

  for (const voice of DIRECTION_IDS) {
    if (!seen.has(voice)) ok = p.add(path, `has no entry for ${voice}`);
  }
  return ok ? out : null;
}

function readDecisions(value: unknown, path: string, p: Problems): Decision[] | null {
  if (!Array.isArray(value)) {
    p.add(path, 'must be a list of decisions');
    return null;
  }
  const expected = CATEGORY_IDS.length * DIRECTION_IDS.length;
  if (value.length !== expected) {
    p.add(path, `must hold exactly ${expected} decisions, one per component and option (found ${value.length})`);
  }

  const byKey = new Map<string, Decision>();
  let ok = true;

  value.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      ok = p.add(at, 'must be an object');
      return;
    }
    checkKeys(entry, ['category', 'option', 'status', 'reason', 'context'], at, p);

    const category = entry['category'];
    const option = entry['option'];
    const status = entry['status'];
    if (typeof category !== 'string' || !(CATEGORY_IDS as readonly string[]).includes(category)) {
      ok = p.add(`${at}.category`, 'is not a component in this build');
      return;
    }
    if (typeof option !== 'string' || !(DIRECTION_IDS as readonly string[]).includes(option)) {
      ok = p.add(`${at}.option`, 'is not a direction in this build');
      return;
    }
    if (typeof status !== 'string' || !(DECISION_STATUSES as readonly string[]).includes(status)) {
      ok = p.add(`${at}.status`, `must be one of ${DECISION_STATUSES.join(', ')}`);
      return;
    }
    const key = `${category}/${option}`;
    if (byKey.has(key)) {
      ok = p.add(at, `is a duplicate decision for ${key}`);
      return;
    }
    const reason = readString(entry['reason'], `${at}.reason`, REASON_LIMIT, p);
    if (reason === null) {
      ok = false;
      return;
    }

    const rawContext = entry['context'];
    let context: Decision['context'] = null;
    if (rawContext !== null && rawContext !== undefined) {
      if (!isPlainObject(rawContext)) {
        ok = p.add(`${at}.context`, 'must be an object or null');
        return;
      }
      checkKeys(rawContext, ['facts', 'draftSignature', 'at'], `${at}.context`, p);
      const facts = readFacts(rawContext['facts'], `${at}.context.facts`, p);
      const when = readString(rawContext['at'], `${at}.context.at`, AT_MAX, p);
      const rawSignature = rawContext['draftSignature'];
      let signature: string | null = null;
      if (rawSignature !== null && rawSignature !== undefined) {
        signature = readString(rawSignature, `${at}.context.draftSignature`, SIGNATURE_MAX, p);
        if (signature === null) ok = false;
      }
      if (category !== 'voice' && signature !== null) {
        ok = p.add(`${at}.context.draftSignature`, 'is only meaningful for a voice decision');
      }
      if (facts === null || when === null) {
        ok = false;
        return;
      }
      if (when.length > 0 && Number.isNaN(Date.parse(when))) {
        ok = p.add(`${at}.context.at`, 'is not a readable date');
        return;
      }
      context = { facts, draftSignature: signature, at: when };
    }

    if (status === 'accepted' && context === null) {
      ok = p.add(at, 'is accepted but records no approval context');
      return;
    }

    byKey.set(key, {
      category: category as CategoryId,
      option: option as DirectionId,
      status: status as DecisionStatus,
      reason,
      context,
    });
  });

  // Stable order, and a check that every pair is present exactly once.
  const decisions: Decision[] = [];
  for (const category of CATEGORY_IDS) {
    let accepted = 0;
    for (const option of DIRECTION_IDS) {
      const decision = byKey.get(`${category}/${option}`);
      if (!decision) {
        ok = p.add(path, `has no decision for ${category}/${option}`);
        continue;
      }
      if (decision.status === 'accepted') accepted += 1;
      decisions.push(decision);
    }
    if (accepted > 1) {
      ok = p.add(path, `marks ${accepted} accepted options for ${category}; only one can be accepted`);
    }
  }
  return ok && !p.any ? decisions : null;
}

function readContent(value: unknown, path: string, p: Problems): Content | null {
  if (!isPlainObject(value)) {
    p.add(path, 'must be an object');
    return null;
  }
  checkKeys(value, ['facts', 'drafts', 'decisions'], path, p);
  const facts = readFacts(value['facts'], `${path}.facts`, p);
  const drafts = readDrafts(value['drafts'], `${path}.drafts`, p);
  const decisions = readDecisions(value['decisions'], `${path}.decisions`, p);
  if (!facts || !drafts || !decisions) return null;
  return { facts, drafts, decisions };
}

function readView(value: unknown, path: string, p: Problems): ViewState | null {
  if (!isPlainObject(value)) {
    p.add(path, 'must be an object');
    return null;
  }
  checkKeys(value, ['preview', 'previewMode'], path, p);
  const rawPreview = value['preview'];
  if (!isPlainObject(rawPreview)) {
    p.add(`${path}.preview`, 'must be an object');
    return null;
  }
  checkKeys(rawPreview, CATEGORY_IDS, `${path}.preview`, p);
  const preview = {} as ViewState['preview'];
  let ok = true;
  for (const category of CATEGORY_IDS) {
    const option = rawPreview[category];
    if (typeof option !== 'string' || !(DIRECTION_IDS as readonly string[]).includes(option)) {
      ok = p.add(`${path}.preview.${category}`, 'is not a direction in this build');
      continue;
    }
    preview[category] = option as DirectionId;
  }
  const mode = value['previewMode'];
  if (typeof mode !== 'string' || !(PREVIEW_MODES as readonly string[]).includes(mode)) {
    ok = p.add(`${path}.previewMode`, `must be one of ${PREVIEW_MODES.join(', ')}`);
  }
  return ok ? { preview, previewMode: mode as PreviewMode } : null;
}

function readVersion(value: unknown, path: string, expected: number, p: Problems): boolean {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return p.add(path, 'must be a whole number');
  }
  if (value !== expected) {
    return p.add(
      path,
      `is ${value}; this build reads ${expected}. A file from a different version has to be opened by that version.`,
    );
  }
  return true;
}

/** Validates already-decoded text. Callers check the byte size first. */
export function validateFileText(text: string): ValidationResult {
  const p = new Problems();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown parse error';
    return {
      ok: false,
      summary: 'That file is not readable JSON, so nothing was changed.',
      problems: [`file: ${detail}`],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      summary: 'That file is not a Brand Decision Desk worksheet, so nothing was changed.',
      problems: ['file: the top level must be a JSON object'],
    };
  }

  checkKeys(
    parsed,
    ['kind', 'schemaVersion', 'presetVersion', 'exportedAt', 'note', 'historyTrimmedForSize', 'content', 'view', 'history'],
    'file',
    p,
  );

  if (parsed['kind'] !== FILE_KIND) {
    p.add('file.kind', `must be "${FILE_KIND}"`);
  }
  readVersion(parsed['schemaVersion'], 'file.schemaVersion', SCHEMA_VERSION, p);
  readVersion(parsed['presetVersion'], 'file.presetVersion', PRESET_VERSION, p);

  const content = readContent(parsed['content'], 'file.content', p);
  const view = readView(parsed['view'], 'file.view', p);

  const rawHistory = parsed['history'];
  let history: Content[] = [];
  if (!Array.isArray(rawHistory)) {
    p.add('file.history', 'must be a list of earlier steps');
  } else if (rawHistory.length > HISTORY_LIMIT) {
    p.add('file.history', `holds ${rawHistory.length} steps; this build keeps at most ${HISTORY_LIMIT}`);
  } else {
    const steps: Content[] = [];
    rawHistory.forEach((entry, index) => {
      const step = readContent(entry, `file.history[${index}]`, p);
      if (step) steps.push(step);
    });
    history = steps;
  }

  const trimmedFlag = parsed['historyTrimmedForSize'];
  if (trimmedFlag !== undefined && typeof trimmedFlag !== 'boolean') {
    p.add('file.historyTrimmedForSize', 'must be true or false');
  }
  const exportedAt = typeof parsed['exportedAt'] === 'string' ? parsed['exportedAt'] : null;

  if (p.any || !content || !view) {
    return {
      ok: false,
      summary: 'That worksheet file could not be read, so your current work was left exactly as it is.',
      problems: p.list.length > 0 ? p.list : ['file: the worksheet content is incomplete'],
    };
  }

  return {
    ok: true,
    value: {
      content,
      view,
      history,
      historyTrimmedForSize: trimmedFlag === true,
      exportedAt,
    },
  };
}

/** Full check for a picked file, starting with a size ceiling before decoding. */
export function validateFile(text: string, byteSize: number): ValidationResult {
  if (byteSize > IMPORT_MAX_BYTES) {
    const mb = (IMPORT_MAX_BYTES / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      summary: `That file is larger than the ${mb} MB limit, so it was not opened and nothing was changed.`,
      problems: [`file: ${byteSize} bytes`],
    };
  }
  return validateFileText(text);
}
