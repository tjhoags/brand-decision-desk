import { describe, expect, it } from 'vitest';
import { contrastRatio, measurePalette, relativeLuminance } from '../../src/domain/contrast';
import { DECOR_ROLE_PAIRS, PALETTES } from '../../src/domain/presets';
import { DIRECTION_IDS } from '../../src/domain/types';

describe('contrast maths', () => {
  it('matches the known anchors', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('rejects anything that is not a six-digit hex colour', () => {
    expect(() => relativeLuminance('rebeccapurple')).toThrow();
    expect(() => relativeLuminance('#FFF')).toThrow();
  });
});

describe('every palette keeps its text roles readable', () => {
  for (const option of DIRECTION_IDS) {
    it(`${option} passes all declared text role pairs`, () => {
      const failures = measurePalette(PALETTES[option]).filter((m) => !m.passes);
      expect(failures.map((f) => `${f.note}: ${f.ratio.toFixed(2)} < ${f.min}`)).toEqual([]);
    });

    it(`${option} keeps decorative fills visible against their ground`, () => {
      for (const pair of DECOR_ROLE_PAIRS) {
        const fill = PALETTES[option][pair.fill] as string;
        const bg = PALETTES[option][pair.bg] as string;
        expect(contrastRatio(fill, bg)).toBeGreaterThanOrEqual(pair.min);
      }
    });
  }

  it('is measuring every text role the previews rely on', () => {
    // A role added to the palette without a declared pairing would ship
    // unchecked, so the count is pinned deliberately.
    expect(measurePalette(PALETTES.quarterdeck)).toHaveLength(8);
  });
});
