import { describe, expect, it } from 'vitest';
import { clearStored, readStored, writeStored, type StoreLike } from '../../src/domain/storage';
import { STORAGE_KEY } from '../../src/domain/limits';

function memoryStore(overrides: Partial<StoreLike> = {}): StoreLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    ...overrides,
  };
}

describe('opt-in storage reports what actually happened', () => {
  it('reads an empty store as empty rather than as an error', () => {
    expect(readStored(memoryStore())).toEqual({ status: 'empty' });
  });

  it('confirms a write by reading it back', () => {
    const store = memoryStore();
    expect(writeStored('{"a":1}', store)).toEqual({ ok: true });
    expect(readStored(store)).toEqual({ status: 'found', text: '{"a":1}' });
  });

  it('reports a refused write, and does not claim a save', () => {
    const store = memoryStore({
      setItem: () => {
        const error = new Error('exceeded the quota');
        error.name = 'QuotaExceededError';
        throw error;
      },
    });
    const result = writeStored('{"a":1}', store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/storage for this page is full/);
  });

  it('reports a write that does not read back as not saved', () => {
    const store = memoryStore({ setItem: () => undefined });
    const result = writeStored('{"a":1}', store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/did not match/);
  });

  it('reports a blocked store when reading', () => {
    const store = memoryStore({
      getItem: () => {
        const error = new Error('blocked');
        error.name = 'SecurityError';
        throw error;
      },
    });
    const outcome = readStored(store);
    expect(outcome.status).toBe('error');
    if (outcome.status === 'error') expect(outcome.reason).toMatch(/blocks storage/);
  });

  it('never claims a removal that threw', () => {
    const store = memoryStore({
      removeItem: () => {
        throw new Error('removal refused');
      },
    });
    const result = clearStored(store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/removal refused/);
  });

  it('never claims a removal that left the copy in place', () => {
    const map = new Map<string, string>([[STORAGE_KEY, 'still here']]);
    const store: StoreLike = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
      removeItem: () => undefined,
    };
    const result = clearStored(store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/still there/);
  });

  it('confirms a removal that worked', () => {
    const store = memoryStore();
    writeStored('{"a":1}', store);
    expect(clearStored(store)).toEqual({ ok: true });
    expect(readStored(store)).toEqual({ status: 'empty' });
  });
});
