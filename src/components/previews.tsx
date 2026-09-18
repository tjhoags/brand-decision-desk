/**
 * The illustrated homepage and customer email.
 *
 * Both are built only from the current facts, the resolved draft copy and two
 * preset token sets. A palette is used through named roles, never by picking a
 * swatch, so any of the nine palette-and-type combinations stays readable. All
 * text is rendered as React text nodes, so typed HTML shows as characters.
 *
 * Nothing in here is interactive. The call to action is a styled span with a
 * note saying so, because a button that did nothing would be a lie.
 */
import type { CSSProperties, ReactElement } from 'react';
import { PALETTES, TYPOGRAPHY } from '../domain/presets';
import type { CopyText, DirectionId, Facts } from '../domain/types';

export interface PreviewProps {
  palette: DirectionId;
  typography: DirectionId;
  facts: Facts;
  copy: CopyText;
}

export function previewVars(palette: DirectionId, typography: DirectionId): CSSProperties {
  const p = PALETTES[palette];
  const t = TYPOGRAPHY[typography];
  return {
    '--pv-page-bg': p.pageBg,
    '--pv-ink': p.ink,
    '--pv-muted': p.mutedInk,
    '--pv-line': p.line,
    '--pv-hero-bg': p.heroBg,
    '--pv-hero-ink': p.heroInk,
    '--pv-hero-muted': p.heroMutedInk,
    '--pv-hero-eyebrow': p.heroEyebrowInk,
    '--pv-hero-rule': p.heroRule,
    '--pv-band-bg': p.bandBg,
    '--pv-band-ink': p.bandInk,
    '--pv-band-label': p.bandLabelInk,
    '--pv-cta-bg': p.ctaBg,
    '--pv-cta-ink': p.ctaInk,
    '--pv-heading-family': t.headingFamily,
    '--pv-body-family': t.bodyFamily,
    '--pv-label-family': t.labelFamily,
    '--pv-heading-weight': String(t.headingWeight),
    '--pv-heading-tracking': t.headingTracking,
    '--pv-heading-leading': t.headingLeading,
    '--pv-heading-scale': String(t.headingScale),
    '--pv-body-leading': t.bodyLeading,
    '--pv-label-transform': t.labelTransform,
    '--pv-label-tracking': t.labelTracking,
    '--pv-label-weight': String(t.labelWeight),
    '--pv-radius': t.radius,
    '--pv-rule-weight': t.ruleWeight,
    '--pv-hero-align': t.heroAlign,
    '--pv-rule-inline': t.heroAlign === 'center' ? 'auto' : '0',
  } as CSSProperties;
}

/** A blank the reader is meant to fill in, never a claim about the business. */
const LOCATION_BLANK = '[LOCATION]';

function factOrBlank(value: string, blank: string): string {
  return value.trim().length > 0 ? value : blank;
}

export function HomepagePreview({ palette, typography, facts, copy }: PreviewProps): ReactElement {
  const band = TYPOGRAPHY[typography].bandLayout;
  return (
    <div className="pv" style={previewVars(palette, typography)}>
      <div className="pv-hero">
        <p className="pv-eyebrow">{factOrBlank(facts.name, '[BUSINESS NAME]')}</p>
        <h3 className="pv-headline">{copy.headline}</h3>
        <div className="pv-rule" aria-hidden="true" />
        <p className="pv-support">{copy.supportingLine}</p>
      </div>

      <div className={`pv-band is-${band}`}>
        <div className="pv-cell">
          <span className="pv-label">Who it is for</span>
          <p>{factOrBlank(facts.who, '[WHO IT IS FOR]')}</p>
        </div>
        <div className="pv-cell">
          <span className="pv-label">What is offered</span>
          <p>{factOrBlank(facts.offer, '[WHAT IS OFFERED]')}</p>
        </div>
        <div className="pv-cell">
          <span className="pv-label">Where</span>
          <p>{LOCATION_BLANK}</p>
        </div>
      </div>

      <div className="pv-foot">
        <span className="pv-cta">{copy.ctaWording}</span>
        <p className="pv-cta-note">Shown as text. It is not a working button in this preview.</p>
      </div>
    </div>
  );
}

export function EmailPreview({ palette, typography, facts, copy }: PreviewProps): ReactElement {
  const paragraphs = copy.emailBody.split(/\n{2,}/);
  return (
    <div className="pv pv-email" style={previewVars(palette, typography)}>
      <div className="pv-email-card">
        <div className="pv-email-head">
          <div className="pv-email-meta">
            <span className="pv-label">From</span>
            <span>{factOrBlank(facts.name, '[BUSINESS NAME]')}</span>
            <span className="pv-label">To</span>
            <span>[FIRST NAME]</span>
          </div>
          <p className="pv-email-subject">{copy.emailSubject}</p>
        </div>
        <div className="pv-email-body">
          {paragraphs.map((paragraph, index) => (
            // Paragraph order is the content, so the index is the identity.
            // eslint-disable-next-line react/no-array-index-key
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <p className="pv-email-foot">
          An illustration of a customer email. Nothing is addressed, queued or sent from this workspace.
        </p>
      </div>
    </div>
  );
}
