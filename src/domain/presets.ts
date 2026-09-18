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
export const SCHEMA_VERSION = 1;

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
  },
};

export const TYPE_CHARACTER: Record<DirectionId, string> = {
  quarterdeck: 'Georgia headings, system sans text, crisp corners',
  openHarbor: 'Rounded system sans where the device has one, soft corners, generous leading',
  ledger: 'System sans with monospace labels, sharp editorial grid',
};

/**
 * Preset wording. `{name}`, `{what}`, `{who}` and `{offer}` are filled from the
 * business facts at render time, so preset copy can never keep repeating a fact
 * the user has changed. Square-bracket placeholders are blanks for the user to
 * fill - they are not claims about the business, and no preset states a price,
 * a duration, an address, an outcome or a promise of what happens next.
 */
export const VOICE_COPY: Record<DirectionId, CopyText> = {
  quarterdeck: {
    headline: 'Drawing, taught slowly.',
    supportingLine: '{what}. Paper, pencil, and room to work at your own pace.',
    ctaWording: 'Ask about a place',
    emailSubject: 'About the drawing workshops at {name}',
    emailBody: [
      'Dear [FIRST NAME],',
      '',
      'Thank you for asking about {name}. The workshops are kept small by design, so there is room to work and time to ask questions.',
      '',
      '[ADD THE NEXT STEP HERE - for example the dates you are planning, or how someone should reply.]',
      '',
      'With thanks,',
      '[YOUR NAME]',
      '{name}',
    ].join('\n'),
  },
  openHarbor: {
    headline: 'Come and draw with us.',
    supportingLine: '{what}, in a room where nobody minds where you are starting from.',
    ctaWording: 'Say hello',
    emailSubject: 'Hello from {name}',
    emailBody: [
      'Hi [FIRST NAME],',
      '',
      'Lovely to hear from you. {name} is for {who}, so you are very welcome whether or not you have drawn before.',
      '',
      '[ADD THE NEXT STEP HERE - for example when you are next running a session, or what someone should do now.]',
      '',
      'See you soon,',
      '[YOUR NAME]',
    ].join('\n'),
  },
  ledger: {
    headline: 'Drawing workshops. Small groups.',
    supportingLine: '{what}. No experience assumed.',
    ctaWording: 'Enquire',
    emailSubject: '{name} - workshop enquiry',
    emailBody: [
      '[FIRST NAME],',
      '',
      'Thanks for the note. The short version:',
      '',
      'What it is: {what}',
      'Who it is for: {who}',
      'What is offered: {offer}',
      '',
      '[ADD THE NEXT STEP HERE - dates, location, or how to reply.]',
      '',
      '[YOUR NAME]',
      '{name}',
    ].join('\n'),
  },
};

export const VOICE_CHARACTER: Record<DirectionId, string> = {
  quarterdeck: 'Full sentences, unhurried, a printed-prospectus register.',
  openHarbor: 'Spoken and warm, second person, short welcoming sentences.',
  ledger: 'Clipped and itemised, facts before feeling, list-shaped.',
};

/** The fictional worked example the desk opens on. */
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
