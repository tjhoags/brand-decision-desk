/**
 * The business brief: the facts both previews are built from, and the draft
 * wording for whichever voice is currently on the stage.
 *
 * Facts and draft copy are kept apart on purpose. A fact is a statement about
 * the business; draft copy is wording someone is trying out. Changing a fact
 * asks every accepted choice for a fresh look; changing the accepted voice's
 * wording asks that one. Preset wording is rebuilt from the facts, so only
 * hand-written wording can fall out of step - and when it does, it is named.
 */
import type { ReactElement } from 'react';
import { DIRECTION_NAME } from '../domain/presets';
import {
  isOverridden,
  hasAnyOverride,
  presetCopy,
  resolveCopy,
  sampleFactFields,
  staleMentions,
  type Action,
} from '../domain/state';
import { COPY_LIMITS, FACT_LIMITS } from '../domain/limits';
import {
  COPY_FIELDS,
  FACT_FIELDS,
  type Content,
  type CopyField,
  type FactField,
  type ViewState,
} from '../domain/types';

const FACT_LABEL: Record<FactField, string> = {
  name: 'Business name',
  what: 'What it is',
  who: 'Who it is for',
  offer: 'What is offered',
};

const COPY_LABEL: Record<CopyField, string> = {
  headline: 'Headline',
  supportingLine: 'Supporting line',
  ctaWording: 'Call-to-action wording',
  emailSubject: 'Email subject',
  emailBody: 'Email body',
};

interface BriefProps {
  content: Content;
  view: ViewState;
  dispatch: (action: Action) => void;
}

export function BriefPanel({ content, view, dispatch }: BriefProps): ReactElement {
  const voice = view.preview.voice;
  const copy = resolveCopy(content, voice);
  const preset = presetCopy(voice, content.facts);
  const sample = sampleFactFields(content);
  const stale = staleMentions(content, voice);

  function copyField(field: CopyField, rows: number): ReactElement {
    const written = isOverridden(content, voice, field);
    const limit = COPY_LIMITS[field];
    const id = `draft-${voice}-${field}`;
    return (
      <div className="field" key={field}>
        <div className="field-head">
          <label className="label" htmlFor={id}>
            {COPY_LABEL[field]}
          </label>
          {written ? <span className="tag is-written">Written by hand</span> : null}
        </div>
        {rows === 1 ? (
          <input
            id={id}
            type="text"
            maxLength={limit}
            value={copy[field]}
            onChange={(event) => dispatch({ type: 'setDraft', voice, field, value: event.target.value })}
          />
        ) : (
          <textarea
            id={id}
            rows={rows}
            maxLength={limit}
            value={copy[field]}
            onChange={(event) => dispatch({ type: 'setDraft', voice, field, value: event.target.value })}
          />
        )}
        <div className="field-foot">
          <span>
            {written ? (
              <button
                type="button"
                className="btn-quiet"
                onClick={() => dispatch({ type: 'resetDraftField', voice, field })}
              >
                Reset to the preset wording
              </button>
            ) : (
              'Preset wording, rebuilt from the facts above'
            )}
          </span>
          <span>
            {copy[field].length}/{limit}
          </span>
        </div>
      </div>
    );
  }

  return (
    <section className="panel brief" id="brief" aria-labelledby="brief-heading">
      <header>
        <h2 id="brief-heading">Business brief</h2>
        <p>
          The facts both previews are built from. Editing one asks every accepted choice to be looked at again; it
          never changes or deletes a choice.
        </p>
      </header>

      <div className="brief-split">
        <div>
          <div className="callout">
            <span className="callout-mark" aria-hidden="true">
              i
            </span>
            <span>
              <b>Fictional example.</b> Halyard Studio is made up for this worksheet. Replace these four facts with
              a real business and everything on the stage follows. Anything in square brackets, such as{' '}
              <b>[LOCATION]</b>, is a blank for you to fill, not a claim.
            </span>
          </div>

          {FACT_FIELDS.map((field) => (
            <div className="field" key={field}>
              <div className="field-head">
                <label className="label" htmlFor={`fact-${field}`}>
                  {FACT_LABEL[field]}
                </label>
                {sample.includes(field) ? (
                  <span className="tag is-sample" title="Still the fictional sample value">
                    Sample
                  </span>
                ) : null}
              </div>
              <input
                id={`fact-${field}`}
                type="text"
                maxLength={FACT_LIMITS[field]}
                value={content.facts[field]}
                onChange={(event) => dispatch({ type: 'setFact', field, value: event.target.value })}
              />
            </div>
          ))}
        </div>

        <hr className="hr" />

        <div>
          <h3 className="label" style={{ fontSize: 12 }}>
            Draft copy &ndash; {DIRECTION_NAME[voice]}
          </h3>
          <p className="note" style={{ marginTop: 4 }}>
            Draft wording for the voice on the stage, not a verified statement about the business. Each direction
            keeps its own. Switch the voice on the stage to write for another one; nothing you write here is lost
            when you do.
          </p>

          {stale.length > 0 ? (
            <div className="callout is-warn" style={{ marginTop: 10 }} role="status">
              <span className="callout-mark" aria-hidden="true">
                !
              </span>
              <span>
                <b>Wording left behind by a fact change.</b>
                {stale.map((mention) => (
                  <span key={mention.field}>
                    {' '}
                    Your {mention.inFields.map((f) => COPY_LABEL[f].toLowerCase()).join(' and ')} still says &ldquo;
                    {mention.was}&rdquo;, but the brief now says &ldquo;{mention.now}&rdquo;.
                  </span>
                ))}
              </span>
            </div>
          ) : null}

          <details className="group" open={view.previewMode === 'homepage'} key={`home-${view.previewMode}`}>
            <summary>Homepage wording</summary>
            <div className="group-body">
              {copyField('headline', 2)}
              {copyField('supportingLine', 3)}
              {copyField('ctaWording', 1)}
            </div>
          </details>

          <details className="group" open={view.previewMode === 'email'} key={`email-${view.previewMode}`}>
            <summary>Email wording</summary>
            <div className="group-body">
              {copyField('emailSubject', 1)}
              {copyField('emailBody', 9)}
            </div>
          </details>

          <p style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-quiet"
              disabled={!hasAnyOverride(content, voice)}
              onClick={() => dispatch({ type: 'resetDraftAll', voice })}
            >
              {hasAnyOverride(content, voice)
                ? `Reset all ${DIRECTION_NAME[voice]} wording to the presets`
                : `${DIRECTION_NAME[voice]} is all preset wording`}
            </button>
          </p>
          <p className="note">
            Preset example, unchanged:{' '}
            {COPY_FIELDS.filter((field) => !isOverridden(content, voice, field)).length} of {COPY_FIELDS.length}{' '}
            fields. The preset headline for {DIRECTION_NAME[voice]} reads &ldquo;{preset.headline}&rdquo;.
          </p>
        </div>
      </div>
    </section>
  );
}
