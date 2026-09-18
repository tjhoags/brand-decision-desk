/**
 * Opt-in browser storage.
 *
 * Every call reports what actually happened. A write is only reported as saved
 * after it has been read back and compared; a removal that throws is reported
 * as a removal that did not happen. Nothing here runs unless the user turns
 * saving on, and an existing stored copy is read and checked before the first
 * write rather than cleared on startup.
 */
import { STORAGE_KEY } from './limits';

export type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ReadOutcome =
  | { status: 'unavailable'; reason: string }
  | { status: 'empty' }
  | { status: 'found'; text: string }
  | { status: 'error'; reason: string };

export type WriteOutcome = { ok: true } | { ok: false; reason: string };

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError' || /quota/i.test(error.message)) {
      return 'this browser refused the write because its storage for this page is full';
    }
    if (error.name === 'SecurityError') {
      return 'this browser blocks storage for this page (private mode or a site setting)';
    }
    return error.message || error.name;
  }
  return 'the browser gave no reason';
}

/** Resolves the store at call time so a blocked or replaced store is noticed. */
export function getStore(): { ok: true; store: StoreLike } | { ok: false; reason: string } {
  try {
    const store = globalThis.localStorage as StoreLike | undefined;
    if (!store) return { ok: false, reason: 'this browser offers no storage for this page' };
    return { ok: true, store };
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }
}

export function readStored(store?: StoreLike): ReadOutcome {
  let target = store;
  if (!target) {
    const resolved = getStore();
    if (!resolved.ok) return { status: 'unavailable', reason: resolved.reason };
    target = resolved.store;
  }
  try {
    const text = target.getItem(STORAGE_KEY);
    if (text === null) return { status: 'empty' };
    return { status: 'found', text };
  } catch (error) {
    return { status: 'error', reason: describe(error) };
  }
}

/** Writes, then reads back and compares. Only an exact match reports success. */
export function writeStored(text: string, store?: StoreLike): WriteOutcome {
  let target = store;
  if (!target) {
    const resolved = getStore();
    if (!resolved.ok) return { ok: false, reason: resolved.reason };
    target = resolved.store;
  }
  try {
    target.setItem(STORAGE_KEY, text);
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }
  let readBack: string | null;
  try {
    readBack = target.getItem(STORAGE_KEY);
  } catch (error) {
    return { ok: false, reason: `the write was not confirmed: ${describe(error)}` };
  }
  if (readBack !== text) {
    return { ok: false, reason: 'the copy read back from this browser did not match what was written' };
  }
  return { ok: true };
}

/** Removes the stored copy, then confirms it is gone. */
export function clearStored(store?: StoreLike): WriteOutcome {
  let target = store;
  if (!target) {
    const resolved = getStore();
    if (!resolved.ok) return { ok: false, reason: resolved.reason };
    target = resolved.store;
  }
  try {
    target.removeItem(STORAGE_KEY);
  } catch (error) {
    return { ok: false, reason: describe(error) };
  }
  try {
    if (target.getItem(STORAGE_KEY) !== null) {
      return { ok: false, reason: 'the stored copy was still there after the browser reported it removed' };
    }
  } catch (error) {
    return { ok: false, reason: `the removal was not confirmed: ${describe(error)}` };
  }
  return { ok: true };
}
