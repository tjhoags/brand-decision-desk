/**
 * WCAG 2.1 relative luminance and contrast ratio, for the palette roles only.
 *
 * This measures the specific text-on-background pairs the previews actually
 * use. It is not a claim that the whole interface passes every accessibility
 * requirement, and the desk says so where it reports a number.
 */
import { PALETTES, TEXT_ROLE_PAIRS, type PaletteTokens } from './presets';
import type { DirectionId } from './types';

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export interface RoleMeasurement {
  note: string;
  ratio: number;
  min: number;
  passes: boolean;
}

export function measurePalette(palette: PaletteTokens): RoleMeasurement[] {
  return TEXT_ROLE_PAIRS.map((pair) => {
    const ink = palette[pair.ink];
    const bg = palette[pair.bg];
    if (typeof ink !== 'string' || typeof bg !== 'string') {
      throw new Error(`role pair ${String(pair.ink)}/${String(pair.bg)} is not a colour`);
    }
    const ratio = contrastRatio(ink, bg);
    return { note: pair.note, ratio, min: pair.min, passes: ratio >= pair.min };
  });
}

/** The weakest measured text pair in a palette, which is the honest headline. */
export function weakestTextPair(option: DirectionId): RoleMeasurement {
  const measurements = measurePalette(PALETTES[option]);
  return measurements.reduce((worst, current) => (current.ratio < worst.ratio ? current : worst));
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}
