import { expect, it } from 'vitest';
import old from '../e2e/fixtures/northline-version-1.json';
import { validateFileText } from '../../src/domain/validate';
import { toPortableContent } from '../../src/domain/portable';

it('preserves every original field and all five undo steps in a real v1 browser download', () => {
  const result = validateFileText(JSON.stringify(old));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.problems.join('\n'));
  const clean = (value: ReturnType<typeof toPortableContent>) => {
    const { preferences, ...original } = value;
    expect(preferences).toEqual([]);
    return original;
  };
  expect(clean(toPortableContent(result.value.content))).toEqual(old.content);
  expect(result.value.view).toEqual(old.view);
  expect(result.value.history).toHaveLength(5);
  expect(result.value.history.map(s => clean(toPortableContent(s)))).toEqual(old.history);
});
