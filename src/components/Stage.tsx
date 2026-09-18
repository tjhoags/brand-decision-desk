/**
 * The stage: three coordinated directions, three independent component
 * choices, and the large illustration they produce together.
 *
 * Looking at anything here records nothing. What is on the stage and what has
 * been accepted are two different things, and the banner says so whenever they
 * differ - including when a component has nothing accepted at all.
 */
import type { ReactElement } from 'react';
import {
  CATEGORY_LABEL,
  DIRECTIONS,
  DIRECTION_NAME,
  PALETTES,
  TYPOGRAPHY,
  TYPE_CHARACTER,
  VOICE_CHARACTER,
} from '../domain/presets';
import { acceptedOption, resolveCopy } from '../domain/state';
import { formatRatio, weakestTextPair } from '../domain/contrast';
import { CATEGORY_IDS, type CategoryId, type Content, type DirectionId, type ViewState } from '../domain/types';
import type { Action } from '../domain/state';
import { EmailPreview, HomepagePreview } from './previews';

interface StageProps {
  content: Content;
  view: ViewState;
  dispatch: (action: Action) => void;
}

function Swatches({ option, small }: { option: DirectionId; small?: boolean }): ReactElement {
  return (
    <span className={small ? 'swatches is-small' : 'swatches'} aria-hidden="true">
      {PALETTES[option].swatches.map((colour) => (
        <span key={colour} style={{ background: colour }} />
      ))}
    </span>
  );
}

function directionState(content: Content, option: DirectionId): string[] {
  const notes: string[] = [];
  for (const category of CATEGORY_IDS) {
    const decision = content.decisions.find((d) => d.category === category && d.option === option);
    if (!decision) continue;
    if (decision.status === 'accepted') notes.push(`${CATEGORY_LABEL[category]} accepted`);
    if (decision.status === 'rejected') notes.push(`${CATEGORY_LABEL[category]} rejected`);
  }
  return notes;
}

export function Stage({ content, view, dispatch }: StageProps): ReactElement {
  const { palette, typography, voice } = view.preview;
  const copy = resolveCopy(content, voice);
  const coordinated = palette === typography && typography === voice ? palette : null;

  const differences = CATEGORY_IDS.map((category) => {
    const accepted = acceptedOption(content, category);
    const showing = view.preview[category];
    if (accepted === showing) return null;
    return { category, showing, accepted };
  }).filter((entry): entry is { category: CategoryId; showing: DirectionId; accepted: DirectionId | null } => entry !== null);

  const anyAccepted = CATEGORY_IDS.some((category) => acceptedOption(content, category) !== null);
  const weakest = weakestTextPair(palette);

  return (
    <section className="panel stage" id="stage" aria-labelledby="stage-heading">
      <header>
        <h2 id="stage-heading">Preview</h2>
        <p>
          Three directions, made up for this worksheet. Look at them, mix the parts, and record what you think in
          the decision record. Looking at something here changes nothing.
        </p>
      </header>

      <div className="directions" role="group" aria-label="Preview a whole direction">
        {DIRECTIONS.map((direction) => {
          const notes = directionState(content, direction.id);
          const isShowing = coordinated === direction.id;
          return (
            <button
              key={direction.id}
              type="button"
              className="direction"
              aria-pressed={isShowing}
              onClick={() => dispatch({ type: 'setPreviewAll', option: direction.id })}
            >
              <Swatches option={direction.id} />
              <span className="direction-text">
                <span className="direction-name">{direction.name}</span>
                <span className="direction-character"> {direction.character}</span>
              </span>
              <span className="direction-state">
                {isShowing ? <span className="tag">Showing all three parts</span> : null}
                {notes.map((note) => (
                  <span key={note} className="tag">
                    {note}
                  </span>
                ))}
                {!isShowing && notes.length === 0 ? <span>Nothing recorded from here</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mixer">
        {CATEGORY_IDS.map((category) => (
          <p className="mix-field" key={category}>
            <label className="label" htmlFor={`mix-${category}`}>
              {CATEGORY_LABEL[category]}
            </label>
            <select
              id={`mix-${category}`}
              value={view.preview[category]}
              onChange={(event) =>
                dispatch({ type: 'setPreview', category, option: event.target.value as DirectionId })
              }
            >
              {DIRECTIONS.map((direction) => (
                <option key={direction.id} value={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </p>
        ))}
        <span className="mixer-actions">
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: 'previewAccepted' })}
            disabled={!anyAccepted}
            title={
              anyAccepted
                ? 'Show the choices you have accepted'
                : 'Nothing has been accepted yet, so there is nothing to show'
            }
          >
            Preview accepted choices
          </button>
        </span>
      </div>

      <div className={`preview-banner${differences.length > 0 ? ' is-differs' : ''}`} role="status">
        <span className="callout-mark" aria-hidden="true">
          {differences.length > 0 ? '!' : '○'}
        </span>
        <span>
          {differences.length === 0 ? (
            <>
              Showing {coordinated ? DIRECTION_NAME[coordinated] : 'a mix'} - the same as what you have accepted.
              This website is not launched and this email is not sent.
            </>
          ) : (
            <>
              <b>This is a preview, not your decision.</b>
              <ul>
                {differences.map((difference) => (
                  <li key={difference.category}>
                    {CATEGORY_LABEL[difference.category]}: showing {DIRECTION_NAME[difference.showing]},{' '}
                    {difference.accepted
                      ? `accepted ${DIRECTION_NAME[difference.accepted]}`
                      : 'nothing accepted yet'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </span>
      </div>

      <div className="stage-toolbar">
        <div className="tabs" role="tablist" aria-label="What to preview">
          <button
            type="button"
            role="tab"
            id="tab-homepage"
            aria-selected={view.previewMode === 'homepage'}
            aria-controls="preview-canvas"
            onClick={() => dispatch({ type: 'setPreviewMode', mode: 'homepage' })}
          >
            Homepage
          </button>
          <button
            type="button"
            role="tab"
            id="tab-email"
            aria-selected={view.previewMode === 'email'}
            aria-controls="preview-canvas"
            onClick={() => dispatch({ type: 'setPreviewMode', mode: 'email' })}
          >
            Customer email
          </button>
        </div>
        <p className="note">
          {DIRECTION_NAME[palette]} colour, {DIRECTION_NAME[typography]} type, {DIRECTION_NAME[voice]} words
        </p>
      </div>

      <div
        className="canvas"
        id="preview-canvas"
        role="tabpanel"
        aria-labelledby={view.previewMode === 'homepage' ? 'tab-homepage' : 'tab-email'}
        data-preview-mode={view.previewMode}
        data-preview-palette={palette}
        data-preview-typography={typography}
        data-preview-voice={voice}
      >
        {view.previewMode === 'homepage' ? (
          <HomepagePreview palette={palette} typography={typography} facts={content.facts} copy={copy} />
        ) : (
          <EmailPreview palette={palette} typography={typography} facts={content.facts} copy={copy} />
        )}
      </div>

      <p className="stage-caption">
        An illustration drawn from the business facts and the draft copy. It is not a live page or a real message,
        and nothing on it is a statement the business has verified.
      </p>
      <p className="note" style={{ marginTop: 8 }}>
        <b>{DIRECTION_NAME[typography]} type.</b> {TYPE_CHARACTER[typography]}, {TYPOGRAPHY[typography].radius}{' '}
        corners. <b>{DIRECTION_NAME[voice]} voice.</b> {VOICE_CHARACTER[voice]}
      </p>
      <p className="contrast-line">
        {DIRECTION_NAME[palette]}: weakest measured text pair {formatRatio(weakest.ratio)} ({weakest.note}). Checked
        across the eight text-on-background roles these previews use - not a claim that everything is accessible.
      </p>
    </section>
  );
}
