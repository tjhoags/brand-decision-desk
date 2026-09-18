/**
 * The decision record.
 *
 * All nine option rows stay visible, but each one is a single 46px line until
 * you open it, so the panel reads as a state summary rather than nine repeated
 * forms. Exactly one row is open at a time, and that row carries the reason and
 * the three actions.
 *
 * Preview and acceptance are deliberately worded and treated differently:
 * previewing is "show me", accepting is "record this".
 */
import { useId, type ReactElement } from 'react';
import {
  CATEGORY_BLURB,
  CATEGORY_LABEL,
  DIRECTIONS,
  DIRECTION_NAME,
  PALETTES,
  TYPOGRAPHY,
  TYPE_CHARACTER,
  VOICE_CHARACTER,
} from '../domain/presets';
import { acceptedDecision, findDecision, presetCopy, reviewFor, type Action } from '../domain/state';
import {
  COMPARISON_CAVEAT,
  SCOPE_LABEL,
  SURFACE_LABEL,
  comparisonSummary,
  heldSummary,
  preferenceReview,
} from '../domain/compare';
import { REASON_LIMIT } from '../domain/limits';
import {
  CATEGORY_IDS,
  type CategoryId,
  type Content,
  type DecisionStatus,
  type DirectionId,
  type FactField,
  type ViewState,
} from '../domain/types';

const FACT_LABEL: Record<FactField, string> = {
  name: 'business name',
  what: 'what it is',
  who: 'who it is for',
  offer: 'what is offered',
};

const STATUS_WORD: Record<DecisionStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

interface RecordProps {
  content: Content;
  view: ViewState;
  dispatch: (action: Action) => void;
  expanded: string | null;
  onExpand: (key: string | null) => void;
}

function OptionVisual({ category, option, content }: { category: CategoryId; option: DirectionId; content: Content }) {
  if (category === 'palette') {
    return (
      <span className="swatch-band" aria-hidden="true">
        {PALETTES[option].swatches.map((colour) => (
          <span key={colour} style={{ background: colour }} />
        ))}
      </span>
    );
  }
  if (category === 'typography') {
    const t = TYPOGRAPHY[option];
    return (
      <span
        className="specimen"
        aria-hidden="true"
        style={{
          fontFamily: t.headingFamily,
          fontWeight: t.headingWeight,
          letterSpacing: t.headingTracking,
        }}
      >
        {t.specimen}
      </span>
    );
  }
  return (
    <span className="voice-mark" aria-hidden="true">
      {presetCopy(option, content.facts).ctaWording}
    </span>
  );
}

function characterFor(category: CategoryId, option: DirectionId): string {
  if (category === 'typography') return TYPE_CHARACTER[option];
  if (category === 'voice') return VOICE_CHARACTER[option];
  const p = PALETTES[option];
  return `Hero ${p.heroBg}, text ${p.ink}, accent ${p.decorFill}.`;
}

export function DecisionRecord({ content, view, dispatch, expanded, onExpand }: RecordProps): ReactElement {
  const idBase = useId();

  return (
    <section className="panel record" id="record" aria-labelledby="record-heading">
      <header>
        <h2 id="record-heading">Decision record</h2>
        <p>
          Looking at a direction changes nothing here. A choice is recorded only when you accept it, reject it, or
          leave it open below.
        </p>
      </header>

      <div className="record-summary">
        {CATEGORY_IDS.map((category) => {
          const decision = acceptedDecision(content, category);
          const review = decision ? reviewFor(content, decision) : null;
          return (
            <div className="summary-row" key={category}>
              <span className="label">{CATEGORY_LABEL[category]}</span>
              <span className={decision ? 'summary-value' : 'summary-value is-empty'}>
                {decision ? DIRECTION_NAME[decision.option] : 'Not chosen yet'}
              </span>
              {review?.needsReview ? (
                <span className="summary-review">
                  <span>
                    Accepted against an earlier brief. Changed since:{' '}
                    {[
                      ...review.changedFacts.map((f) => FACT_LABEL[f]),
                      ...(review.draftChanged ? ['the draft copy for this voice'] : []),
                    ].join(', ')}
                    .
                  </span>
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'reconfirm', category })}>
                    Still right - reconfirm
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {CATEGORY_IDS.map((category) => (
        <div className="record-group" key={category}>
          <h3 id={`${idBase}-${category}`}>{CATEGORY_LABEL[category]}</h3>
          <p>{CATEGORY_BLURB[category]}</p>
          <ul className="options" aria-labelledby={`${idBase}-${category}`}>
            {DIRECTIONS.map((direction) => {
              const option = direction.id;
              const decision = findDecision(content, category, option);
              const review = reviewFor(content, decision);
              const key = `${category}:${option}`;
              const isOpen = expanded === key;
              const detailId = `${idBase}-${category}-${option}`;
              const isPreviewing = view.preview[category] === option;

              return (
                <li key={option}>
                  <button
                    type="button"
                    className="option-row"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    data-testid={`option-${category}-${option}`}
                    onClick={() => onExpand(isOpen ? null : key)}
                  >
                    <span className="option-visual">
                      <OptionVisual category={category} option={option} content={content} />
                    </span>
                    <span className="option-main">
                      <span className="option-name">{direction.name}</span>
                      <span className="option-pills">
                        {isPreviewing ? <span className="pill is-stage">On stage</span> : null}
                        {review.needsReview ? <span className="pill is-review">Review</span> : null}
                        <span
                          className={
                            decision.status === 'accepted'
                              ? 'pill is-accepted'
                              : decision.status === 'rejected'
                                ? 'pill is-rejected'
                                : 'pill'
                          }
                          data-testid={`status-${category}-${option}`}
                        >
                          {STATUS_WORD[decision.status]}
                        </span>
                      </span>
                    </span>
                    <span className="chev" aria-hidden="true">
                      {'▶'}
                    </span>
                  </button>

                  <div className="option-detail" id={detailId} hidden={!isOpen}>
                    <p className="note" style={{ marginTop: 8 }}>
                      {characterFor(category, option)}
                    </p>

                    <div className="field">
                      <div className="field-head">
                        <label className="label" htmlFor={`${detailId}-reason`}>
                          Why? (optional)
                        </label>
                        <span className="note">
                          {decision.reason.length}/{REASON_LIMIT}
                        </span>
                      </div>
                      <textarea
                        id={`${detailId}-reason`}
                        rows={3}
                        maxLength={REASON_LIMIT}
                        value={decision.reason}
                        placeholder={`What made you accept or reject ${direction.name} here?`}
                        onChange={(event) =>
                          dispatch({ type: 'setReason', category, option, value: event.target.value })
                        }
                      />
                    </div>

                    <div className="decide">
                      <button
                        type="button"
                        className="btn btn-yes"
                        aria-pressed={decision.status === 'accepted'}
                        data-testid={`accept-${category}-${option}`}
                        onClick={() => dispatch({ type: 'setStatus', category, option, status: 'accepted' })}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-open"
                        aria-pressed={decision.status === 'open'}
                        onClick={() => dispatch({ type: 'setStatus', category, option, status: 'open' })}
                      >
                        Leave open
                      </button>
                      <button
                        type="button"
                        className="btn btn-no"
                        aria-pressed={decision.status === 'rejected'}
                        data-testid={`reject-${category}-${option}`}
                        onClick={() => dispatch({ type: 'setStatus', category, option, status: 'rejected' })}
                      >
                        Reject
                      </button>
                    </div>

                    {decision.status === 'accepted' && decision.context ? (
                      <p className="note" style={{ marginTop: 10 }}>
                        Approved on {decision.context.at.slice(0, 10)} against the brief as it read then.
                      </p>
                    ) : null}

                    {decision.status !== 'accepted' && decision.context ? (
                      <p className="note" style={{ marginTop: 10 }}>
                        This was accepted earlier. The reason above and the brief it was approved against are kept.
                      </p>
                    ) : null}

                    {review.needsReview ? (
                      <div className="callout is-warn" style={{ marginTop: 10 }}>
                        <span className="callout-mark" aria-hidden="true">
                          !
                        </span>
                        <span>
                          {review.changedFacts.length > 0 ? (
                            <>
                              Changed since this was approved:{' '}
                              {review.changedFacts
                                .map(
                                  (field) =>
                                    `${FACT_LABEL[field]} (was "${decision.context?.facts[field] ?? ''}")`,
                                )
                                .join(', ')}
                              .{' '}
                            </>
                          ) : null}
                          {review.draftChanged ? 'The draft copy for this voice has changed since then. ' : null}
                          Your choice and reason are untouched.{' '}
                          <button
                            type="button"
                            className="btn-quiet"
                            onClick={() => dispatch({ type: 'reconfirm', category })}
                          >
                            Reconfirm against the brief as it stands
                          </button>
                        </span>
                      </div>
                    ) : null}

                    <p style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={() => dispatch({ type: 'setPreview', category, option })}
                        disabled={isPreviewing}
                      >
                        {isPreviewing
                          ? `Already on the stage`
                          : `Put this ${CATEGORY_LABEL[category].toLowerCase()} on the stage`}
                      </button>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="record-group" id="preferences">
        <h3>Preferences from comparisons</h3>
        <p>
          Saved after looking at two examples with one thing changed. They are notes, not rules: nothing here is
          applied to any choice above, and nothing leaves this worksheet on its own.
        </p>

        {content.preferences.length === 0 ? (
          <p className="note" data-testid="no-preferences">
            None saved yet. Open <b>Compare one thing</b> on the preview to hold everything still and change one
            thing.
          </p>
        ) : (
          <ul className="preferences" data-testid="preference-list">
            {content.preferences.map((preference) => {
              const review = preferenceReview(content, preference);
              return (
                <li key={preference.id} data-testid={`preference-${preference.id}`}>
                  <div className="preference-head">
                    <span className="preference-summary">{comparisonSummary(preference)}</span>
                    {review.needsReview ? <span className="pill is-review">Review</span> : null}
                  </div>
                  <p className="preference-scope">
                    <span className="tag">{SCOPE_LABEL[preference.scope]}</span>
                  </p>
                  <p className="preference-statement">{preference.statement}</p>
                  <p className="note">
                    Held still: {heldSummary(preference)}, on the{' '}
                    {SURFACE_LABEL[preference.evidence.surface].toLowerCase()}, for{' '}
                    {preference.evidence.facts.name || '[BUSINESS NAME]'}.
                  </p>
                  {review.needsReview ? (
                    <div className="callout is-warn" style={{ marginTop: 8 }}>
                      <span className="callout-mark" aria-hidden="true">
                        !
                      </span>
                      <span>
                        The conditions have moved since this was recorded
                        {review.changedFacts.length > 0
                          ? `: ${review.changedFacts.map((f) => FACT_LABEL[f]).join(', ')}`
                          : ''}
                        {review.copyChanged
                          ? `${review.changedFacts.length > 0 ? ', and' : ':'} the wording that was compared has changed`
                          : ''}
                        . What was written and the evidence behind it are untouched.
                      </span>
                    </div>
                  ) : null}
                  <p style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-quiet"
                      data-testid={`remove-preference-${preference.id}`}
                      onClick={() => dispatch({ type: 'removePreference', id: preference.id })}
                    >
                      Remove this preference
                    </button>
                  </p>
                  <p className="note">Removing it is one undo step; Undo brings it back with its evidence.</p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="note" style={{ marginTop: 8 }}>
          {COMPARISON_CAVEAT}
        </p>
      </div>

      <p className="record-foot">
        Rejecting an option affects only the row it sits in. Rejecting {DIRECTION_NAME.quarterdeck}&rsquo;s palette
        leaves its typography and voice exactly as they were, and says nothing about the direction on another
        brief. Accepting a second option in the same row returns the first to open and keeps its reason.
      </p>
    </section>
  );
}

export { FACT_LABEL as RECORD_FACT_LABEL };
