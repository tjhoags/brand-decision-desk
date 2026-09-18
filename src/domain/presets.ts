/**
 * The three authored directions.
 *
 * These are curated presets written for this worksheet - no model generates
 * them, nothing is fetched, and every value is a literal in this file. Palette,
 * typography and voice are three independent axes so any nine combinations can
 * be previewed together without a colour ever landing on an unsafe background:
 * each palette publishes the same named roles, and the previews only ever use
 * roles, never raw swatches.
 */
import type { CategoryId, CopyText, DirectionId } from './types';

/** Bumped whenever preset ids, roles or the meaning of a token changes. */
export const PRESET_VERSION = 1;

/**
 * File schema. Version 2 added saved comparison preferences. A version 1 file
 * still opens here and is migrated, but a version 2 file cannot be opened by a
 * version 1 build - the desk says so where it offers the download.
 */
export const SCHEMA_VERSION = 2;
export const READABLE_SCHEMA_VERSIONS = [1, 2] as const;

export interface PaletteTokens {
  pageBg: string;
  ink: string;
  mutedInk: string;
  line: string;
  heroBg: string;
  heroInk: string;
  heroMutedInk: string;
  heroEyebrowInk: string;
  /** Decorative rule/fill on the hero. Never carries text. */
  heroRule: string;
  bandBg: string;
  bandInk: string;
  bandLabelInk: string;
  ctaBg: string;
  ctaInk: string;
  /** Decorative only. Never sits behind text. */
  decorFill: string;
  swatches: readonly [string, string, string, string, string];
}

export interface TypeTokens {
  headingFamily: string;
  bodyFamily: string;
  labelFamily: string;
  headingWeight: number;
  headingTracking: string;
  headingLeading: string;
  /** Multiplier applied to the preview's base heading size. */
  headingScale: number;
  bodyLeading: string;
  labelTransform: 'uppercase' | 'none';
  labelTracking: string;
  labelWeight: number;
  radius: string;
  ruleWeight: string;
  specimen: string;
  /** Hero alignment; part of how a direction composes, not just how it reads. */
  heroAlign: 'center' | 'left';
  /** How the fact band is laid out under the hero. */
  bandLayout: 'columns' | 'cards' | 'rows';
}

export interface DirectionMeta {
  id: DirectionId;
  name: string;
  character: string;
}

/**
 * System stacks only. No web fonts are loaded, so the exact face depends on the
 * reading device; each stack names its intended shape first and falls back.
 */
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const ROUNDED = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI Variable Display", ' + SANS;
const SERIF = 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const DIRECTIONS: readonly DirectionMeta[] = [
  { id: 'quarterdeck', name: 'Quarterdeck', character: 'Formal, anchored, printed' },
  { id: 'openHarbor', name: 'Open Harbor', character: 'Warm, spoken, welcoming' },
  { id: 'ledger', name: 'Ledger', character: 'Terse, editorial, itemised' },
] as const;

export const DIRECTION_NAME: Record<DirectionId, string> = {
  quarterdeck: 'Quarterdeck',
  openHarbor: 'Open Harbor',
  ledger: 'Ledger',
};

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  palette: 'Palette',
  typography: 'Typography',
  voice: 'Voice',
};

export const CATEGORY_BLURB: Record<CategoryId, string> = {
  palette: 'The colours the page and the email are built from.',
  typography: 'The headline and text faces, and how sharp or soft the shapes are.',
  voice: 'How the writing sounds to someone reading it for the first time.',
};

export const PALETTES: Record<DirectionId, PaletteTokens> = {
  quarterdeck: {
    pageBg: '#F2EDE4',
    ink: '#1E2A32',
    mutedInk: '#4A5A63',
    line: '#DAD1C2',
    heroBg: '#1E2A32',
    heroInk: '#F4EFE6',
    heroMutedInk: '#C9D2D6',
    heroEyebrowInk: '#D2A94E',
    heroRule: '#A8823C',
    bandBg: '#DCD2BE',
    bandInk: '#1E2A32',
    bandLabelInk: '#5F4F2A',
    ctaBg: '#1E2A32',
    ctaInk: '#F4EFE6',
    decorFill: '#A8823C',
    swatches: ['#1E2A32', '#F2EDE4', '#A8823C', '#5C6E78', '#2E3E48'],
  },
  openHarbor: {
    pageBg: '#FBF6EE',
    ink: '#14453F',
    mutedInk: '#3F625C',
    line: '#E2DACB',
    heroBg: '#FBF6EE',
    heroInk: '#14453F',
    heroMutedInk: '#3F625C',
    heroEyebrowInk: '#A63E22',
    heroRule: '#E06A4E',
    bandBg: '#E8F0EC',
    bandInk: '#14453F',
    bandLabelInk: '#3F625C',
    ctaBg: '#14453F',
    ctaInk: '#FBF6EE',
    decorFill: '#E06A4E',
    swatches: ['#FBF6EE', '#14453F', '#E06A4E', '#2C6E63', '#E8DFCE'],
  },
  ledger: {
    pageBg: '#FCFCFB',
    ink: '#16161A',
    mutedInk: '#56565E',
    line: '#DFDED8',
    heroBg: '#FCFCFB',
    heroInk: '#16161A',
    heroMutedInk: '#46464E',
    heroEyebrowInk: '#8A6318',
    heroRule: '#16161A',
    bandBg: '#F1F0EB',
    bandInk: '#16161A',
    bandLabelInk: '#7A5A16',
    ctaBg: '#16161A',
    ctaInk: '#FCFCFB',
    decorFill: '#B7862B',
    swatches: ['#FCFCFB', '#16161A', '#B7862B', '#56565E', '#E4E2DA'],
  },
};

/**
 * Text-on-background role pairs that must stay readable in every mix. Tested in
 * `tests/unit/contrast.test.ts`. Decorative roles (`heroRule`, `decorFill`,
 * `line`) are deliberately absent: they never carry text.
 */
export const TEXT_ROLE_PAIRS: ReadonlyArray<{
  ink: keyof PaletteTokens;
  bg: keyof PaletteTokens;
  min: number;
  note: string;
}> = [
  { ink: 'ink', bg: 'pageBg', min: 4.5, note: 'body text on the preview page' },
  { ink: 'mutedInk', bg: 'pageBg', min: 4.5, note: 'secondary text on the preview page' },
  { ink: 'heroInk', bg: 'heroBg', min: 4.5, note: 'headline and lead text in the hero' },
  { ink: 'heroMutedInk', bg: 'heroBg', min: 4.5, note: 'supporting text in the hero' },
  { ink: 'heroEyebrowInk', bg: 'heroBg', min: 4.5, note: 'the small label above the headline' },
  { ink: 'bandInk', bg: 'bandBg', min: 4.5, note: 'fact text in the detail band' },
  { ink: 'bandLabelInk', bg: 'bandBg', min: 4.5, note: 'field labels in the detail band' },
  { ink: 'ctaInk', bg: 'ctaBg', min: 4.5, note: 'the call-to-action wording' },
];

/** Decorative fills only need to separate from their ground, not carry text. */
export const DECOR_ROLE_PAIRS: ReadonlyArray<{
  fill: keyof PaletteTokens;
  bg: keyof PaletteTokens;
  min: number;
}> = [
  { fill: 'heroRule', bg: 'heroBg', min: 3 },
  { fill: 'decorFill', bg: 'pageBg', min: 3 },
];

export const TYPOGRAPHY: Record<DirectionId, TypeTokens> = {
  quarterdeck: {
    headingFamily: SERIF,
    bodyFamily: SANS,
    labelFamily: SANS,
    headingWeight: 700,
    headingTracking: '-0.015em',
    headingLeading: '1.04',
    headingScale: 1,
    bodyLeading: '1.55',
    labelTransform: 'uppercase',
    labelTracking: '0.16em',
    labelWeight: 700,
    radius: '2px',
    ruleWeight: '1px',
    specimen: 'Aa Bb',
    heroAlign: 'center',
    bandLayout: 'columns',
  },
  openHarbor: {
    headingFamily: ROUNDED,
    bodyFamily: ROUNDED,
    labelFamily: ROUNDED,
    headingWeight: 700,
    headingTracking: '-0.01em',
    headingLeading: '1.14',
    headingScale: 0.92,
    bodyLeading: '1.72',
    labelTransform: 'none',
    labelTracking: '0.01em',
    labelWeight: 700,
    radius: '18px',
    ruleWeight: '2px',
    specimen: 'Aa Bb',
    heroAlign: 'left',
    bandLayout: 'cards',
  },
  ledger: {
    headingFamily: SANS,
    bodyFamily: SANS,
    labelFamily: MONO,
    headingWeight: 600,
    headingTracking: '-0.028em',
    headingLeading: '1.02',
    headingScale: 0.88,
    bodyLeading: '1.5',
    labelTransform: 'uppercase',
    labelTracking: '0.1em',
    labelWeight: 500,
    radius: '0px',
    ruleWeight: '3px',
    specimen: 'Aa Bb',
    heroAlign: 'left',
    bandLayout: 'rows',
  },
};

export const TYPE_CHARACTER: Record<DirectionId, string> = {
  quarterdeck: 'Georgia headings with system sans text, centred and crisp',
  openHarbor: 'Rounded system sans where the device has one, left aligned with generous leading',
  ledger: 'System sans with monospace labels on a ruled editorial grid',
};

/**
 * Preset wording.
 *
 * Every sentence is built from the editable business facts, a bracketed blank,
 * or a connective that says nothing about the business. `{name}` drops the fact
 * in as typed; `{what:lc}` drops it in mid-sentence with a lowered first letter
 * unless it looks like a name or an acronym. What separates the three voices is
 * register, sentence shape and order - not vocabulary borrowed from the worked
 * example - so replacing the facts with a different business replaces the
 * preview wording with it, and no sample claim survives in preset text.
 *
 * Nothing here states a price, a duration, a group size, an address, a contact,
 * an outcome, or what happens after someone gets in touch. Where wording of
 * that kind would normally sit, there is a square-bracket blank instead.
 */
export const VOICE_COPY: Record<DirectionId, CopyText> = {
  quarterdeck: {
    headline: '{what}.',
    supportingLine: '{name} is for {who:lc}.',
    ctaWording: 'Make an enquiry',
    emailSubject: 'About {name}',
    emailBody: [
      'Dear [FIRST NAME],',
      '',
      'Thank you for your interest in {name}.',
      '',
      '{what}. It is intended for {who:lc}, and what is offered is {offer:lc}.',
      '',
      '[ADD WHAT HAPPENS NEXT HERE - for example, what you would like the reader to do.]',
      '',
      'With thanks,',
      '[YOUR NAME]',
      '{name}',
    ].join('\n'),
  },
  openHarbor: {
    headline: 'Welcome to {name}.',
    supportingLine: '{what}. Made for {who:lc}.',
    ctaWording: 'Say hello',
    emailSubject: 'Hello from {name}',
    emailBody: [
      'Hi [FIRST NAME],',
      '',
      'Lovely to hear from you.',
      '',
      'Here is what we do: {what:lc}. It is made for {who:lc}, and what is on offer is {offer:lc}.',
      '',
      '[ADD WHAT HAPPENS NEXT HERE - for example, what you would like the reader to do.]',
      '',
      'See you soon,',
      '[YOUR NAME]',
    ].join('\n'),
  },
  ledger: {
    headline: '{name}: {what}',
    supportingLine: 'For {who:lc}. {offer}.',
    ctaWording: 'Enquire',
    emailSubject: '{name} - enquiry',
    emailBody: [
      '[FIRST NAME],',
      '',
      'Thanks for the note. The short version:',
      '',
      'What it is: {what}',
      'Who it is for: {who}',
      'What is offered: {offer}',
      '',
      '[ADD WHAT HAPPENS NEXT HERE - for example, what you would like the reader to do.]',
      '',
      '[YOUR NAME]',
      '{name}',
    ].join('\n'),
  },
};

/** Tokens the preset wording may use, for the validation test to pin. */
export const COPY_TOKEN_PATTERN = /\{(name|what|who|offer)(:lc)?\}/g;

export const VOICE_CHARACTER: Record<DirectionId, string> = {
  quarterdeck: 'Full sentences, unhurried, a printed-prospectus register.',
  openHarbor: 'Spoken and warm, second person, short welcoming sentences.',
  ledger: 'Clipped and itemised, facts before feeling, list-shaped.',
};

/**
 * The fictional worked example the desk opens on. Halyard Studio does not
 * exist; these four strings are the only sample content in the app, and the
 * desk marks any of them that has not been replaced.
 */
export const EXAMPLE_FACTS = {
  name: 'Halyard Studio',
  what: 'Small-group drawing workshops for adults',
  who: 'Beginners who want a relaxed way to practise',
  offer: 'In-person drawing classes',
} as const;

export const DEFAULT_PREVIEW: Record<CategoryId, DirectionId> = {
  palette: 'quarterdeck',
  typography: 'quarterdeck',
  voice: 'quarterdeck',
};

export function isDirectionId(value: unknown): value is DirectionId {
  return typeof value === 'string' && (DIRECTIONS as ReadonlyArray<DirectionMeta>).some((d) => d.id === value);
}
