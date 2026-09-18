/**
 * Compare one thing.
 *
 * Two renderings of the same business, on the same surface, differing in
 * exactly one axis. The sides come from `buildSides`, so the interface cannot
 * accidentally vary a second thing, and the header states what is being held.
 *
 * Choosing a side is a preview action: it puts that option on the stage and
 * nothing else. It does not accept a category, does not touch any decision,
 * does not hide an option and never rewrites anyone's copy. Saving a preference
 * is a separate, explicit step that will not proceed without their own words
 * and a scope they picked.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AXIS_LABEL,
  AXIS_WHAT_CHANGES,
  COMPARISON_CAVEAT,
  SCOPE_DETAIL,
  SCOPE_LABEL,
  SURFACE_LABEL,
  alternativesFor,
  buildSides,
  type ComparisonSide,
} from '../domain/compare';
import { DIRECTION_NAME } from '../domain/presets';
import { resolveCopy } from '../domain/state';
import { PREFERENCE_LIMIT, PREFERENCE_STATEMENT_LIMIT } from '../domain/limits';
import {
  CATEGORY_IDS,
  PREFERENCE_SCOPES,
  PREVIEW_MODES,
  type CategoryId,
  type Content,
  type DirectionId,
  type PreferenceScope,
  type PreviewMode,
  type ViewState,
} from '../domain/types';
import { EmailPreview, HomepagePreview } from './previews';

export interface SavePreferenceRequest {
  axis: CategoryId;
  chosen: DirectionId;
  against: DirectionId;
  scope: PreferenceScope;
  statement: string;
  surface: PreviewMode;
  held: Record<CategoryId, DirectionId>;
}

interface CompareSheetProps {
  open: boolean;
  content: Content;
  view: ViewState;
  onClose: () => void;
  /** Puts one option on the stage. A preview change, never a decision. */
  onPutOnStage: (axis: CategoryId, option: DirectionId) => void;
  onSetSurface: (surface: PreviewMode) => void;
  onSave: (request: SavePreferenceRequest) => void;
  savedCount: number;
}

function SidePanel({
  side,
  content,
  surface,
  label,
  isChosen,
  onChoose,
  onStage,
}: {
  side: ComparisonSide;
  content: Content;
  surface: PreviewMode;
  label: string;
  isChosen: boolean;
  onChoose: () => void;
  onStage: boolean;
}): ReactElement {
  const copy = resolveCopy(content, side.voice);
  return (
    <div className={isChosen ? 'compare-side is-chosen' : 'compare-side'} data-testid={`compare-side-${label}`}>
      <div className="compare-side-head">
        <span className="label">{label}</span>
        <span className="compare-side-name">{DIRECTION_NAME[side.option]}</span>
        {onStage ? <span className="pill is-stage">On the stage</span> : null}
        <button
          type="button"
          className="btn btn-choose"
          aria-pressed={isChosen}
          data-testid={`compare-choose-${label}`}
          onClick={onChoose}
        >
          {isChosen ? `Preferring ${DIRECTION_NAME[side.option]}` : 'I prefer this one'}
        </button>
      </div>
      <div className="compare-canvas" data-testid={`compare-canvas-${label}`} data-option={side.option}>
        {surface === 'homepage' ? (
          <HomepagePreview
            palette={side.picks.palette}
            typography={side.picks.typography}
            facts={content.facts}
            copy={copy}
          />
        ) : (
          <EmailPreview
            palette={side.picks.palette}
            typography={side.picks.typography}
            facts={content.facts}
            copy={copy}
          />
        )}
      </div>
    </div>
  );
}

export function CompareSheet({
  open,
  content,
  view,
  onClose,
  onPutOnStage,
  onSetSurface,
  onSave,
  savedCount,
}: CompareSheetProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [axis, setAxis] = useState<CategoryId>('palette');
  const [alternative, setAlternative] = useState<DirectionId | null>(null);
  const [chosen, setChosen] = useState<'a' | 'b' | null>(null);
  const [statement, setStatement] = useState('');
  const [scope, setScope] = useState<PreferenceScope | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // A prior choice cannot authorize saving a newly opened comparison.
      setChosen(null);
      setSaved(null);
      setProblem(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const options = alternativesFor(view.preview, axis);
  const fallback = options[0];
  if (!fallback) throw new Error('every axis has at least one alternative');
  const otherOption = alternative && options.includes(alternative) ? alternative : fallback;

  const comparison = buildSides(view.preview, axis, otherOption, view.previewMode);
  const full = savedCount >= PREFERENCE_LIMIT;

  /** Any change to what is being compared retires the unsaved answer. */
  function resetAnswer(): void {
    setChosen(null);
    setProblem(null);
    setSaved(null);
  }

  /**
   * Choosing puts that option on the stage, which makes it side A on the next
   * render. The marker therefore has to move with it: leaving it on 'b' after
   * the two sides swap would save the comparison the wrong way round.
   */
  function choose(side: 'a' | 'b'): void {
    const picked = side === 'a' ? comparison.a.option : comparison.b.option;
    const other = side === 'a' ? comparison.b.option : comparison.a.option;
    setProblem(null);
    setSaved(null);
    // Putting it on the stage is the whole effect of choosing.
    onPutOnStage(axis, picked);
    setAlternative(other);
    setChosen('a');
  }

  function save(): void {
    if (chosen === null) {
      setProblem('Choose which of the two you preferred first.');
      return;
    }
    if (statement.trim().length === 0) {
      setProblem('Say what you preferred and why, in your own words. The desk will not write this for you.');
      return;
    }
    if (scope === null) {
      setProblem('Choose how far this preference goes.');
      return;
    }
    if (full) {
      setProblem(
        `This worksheet already holds ${PREFERENCE_LIMIT} saved preferences, the most it keeps. Remove one in the ` +
          'decision record to save another.',
      );
      return;
    }
    const chosenSide = chosen === 'a' ? comparison.a : comparison.b;
    const againstSide = chosen === 'a' ? comparison.b : comparison.a;
    onSave({
      axis,
      chosen: chosenSide.option,
      against: againstSide.option,
      scope,
      statement: statement.trim(),
      surface: comparison.surface,
      held: chosenSide.picks,
    });
    setSaved(
      `Saved: you preferred ${DIRECTION_NAME[chosenSide.option]} over ${DIRECTION_NAME[againstSide.option]} for ` +
        `${AXIS_LABEL[axis].toLowerCase()}, scoped to ${SCOPE_LABEL[scope].toLowerCase()}. It is in the decision ` +
        'record, and Undo will take it back.',
    );
    setStatement('');
    setScope(null);
    setProblem(null);
  }

  return (
    <dialog
      className="sheet sheet-wide"
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="compare-heading"
    >
      {open ? (
        <>
      <div className="sheet-head">
        <div>
          <h2 id="compare-heading">Compare one thing</h2>
          <p className="note">
            Two renderings of the same business on the same surface, differing in exactly one thing. Looking and
            choosing here record nothing on their own.
          </p>
        </div>
      </div>

      <div className="sheet-body">
        <div className="compare-controls">
          <div className="compare-control">
            <span className="label" id="compare-axis-label">
              Change exactly one thing
            </span>
            <div className="tabs" role="group" aria-labelledby="compare-axis-label">
              {CATEGORY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={axis === id}
                  aria-selected={axis === id}
                  data-testid={`compare-axis-${id}`}
                  onClick={() => {
                    setAxis(id);
                    setAlternative(null);
                    resetAnswer();
                  }}
                >
                  {AXIS_LABEL[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="compare-control">
            <span className="label" id="compare-surface-label">
              Surface, held the same on both sides
            </span>
            <div className="tabs" role="group" aria-labelledby="compare-surface-label">
              {PREVIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view.previewMode === mode}
                  aria-selected={view.previewMode === mode}
                  data-testid={`compare-surface-${mode}`}
                  onClick={() => {
                    onSetSurface(mode);
                    resetAnswer();
                  }}
                >
                  {SURFACE_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>

          <p className="compare-control">
            <label className="label" htmlFor="compare-alternative">
              Compare against
            </label>
            <select
              id="compare-alternative"
              value={otherOption}
              onChange={(event) => {
                setAlternative(event.target.value as DirectionId);
                resetAnswer();
              }}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {DIRECTION_NAME[option]}
                </option>
              ))}
            </select>
          </p>
        </div>

        <p className="compare-held" data-testid="compare-held">
          <b>Held still:</b> {content.facts.name || '[BUSINESS NAME]'}, the{' '}
          {SURFACE_LABEL[comparison.surface].toLowerCase()}, and{' '}
          {comparison.heldAxes
            .map((category) => `${AXIS_LABEL[category].toLowerCase()} ${DIRECTION_NAME[comparison.held[category]]}`)
            .join(' and ')}
          . <b>Varying:</b> {AXIS_LABEL[axis].toLowerCase()}. {AXIS_WHAT_CHANGES[axis]}
        </p>

        <div className="compare-grid">
          <SidePanel
            side={comparison.a}
            content={content}
            surface={comparison.surface}
            label="A"
            isChosen={chosen === 'a'}
            onChoose={() => choose('a')}
            onStage={view.preview[axis] === comparison.a.option}
          />
          <SidePanel
            side={comparison.b}
            content={content}
            surface={comparison.surface}
            label="B"
            isChosen={chosen === 'b'}
            onChoose={() => choose('b')}
            onStage={view.preview[axis] === comparison.b.option}
          />
        </div>

        <section className="compare-save">
          <h3>Save this as a preference</h3>
          <p className="note">
            Optional. You can keep exploring instead, and nothing is recorded. Saving needs your own words and a
            scope, because a preference is a statement you are making, not one the desk infers from a click.
          </p>

          <div className="field">
            <div className="field-head">
              <label className="label" htmlFor="compare-statement">
                What did you prefer, and why? (required)
              </label>
              <span className="note">
                {statement.length}/{PREFERENCE_STATEMENT_LIMIT}
              </span>
            </div>
            <textarea
              id="compare-statement"
              rows={3}
              maxLength={PREFERENCE_STATEMENT_LIMIT}
              value={statement}
              data-testid="compare-statement"
              placeholder="In your own words - what worked better about the one you chose?"
              onChange={(event) => {
                setStatement(event.target.value);
                setProblem(null);
              }}
            />
          </div>

          <fieldset className="compare-scope">
            <legend className="label">How far does this go? (required)</legend>
            {PREFERENCE_SCOPES.map((option) => (
              <label key={option} className="scope-option">
                <input
                  type="radio"
                  name="compare-scope"
                  value={option}
                  checked={scope === option}
                  data-testid={`compare-scope-${option}`}
                  onChange={() => {
                    setScope(option);
                    setProblem(null);
                  }}
                />
                <span>
                  <b>{SCOPE_LABEL[option]}</b>
                  <span className="note"> {SCOPE_DETAIL[option]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="download-row">
            <button
              type="button"
              className="btn btn-strong"
              data-testid="compare-save"
              onClick={save}
            >
              Save this preference
            </button>
            <button type="button" className="btn" data-testid="compare-keep-exploring" onClick={onClose}>
              Keep exploring
            </button>
          </div>

          {problem ? (
            <div className="callout is-warn" style={{ marginTop: 10 }} role="alert" data-testid="compare-problem">
              <span className="callout-mark" aria-hidden="true">
                !
              </span>
              <span>{problem}</span>
            </div>
          ) : null}

          {saved ? (
            <div className="callout" style={{ marginTop: 10 }} role="status" data-testid="compare-saved">
              <span className="callout-mark" aria-hidden="true">
                i
              </span>
              <span>{saved}</span>
            </div>
          ) : null}

          <p className="note" style={{ marginTop: 10 }}>
            {savedCount === 0
              ? `No preferences saved yet. This worksheet keeps up to ${PREFERENCE_LIMIT}.`
              : `${savedCount} of ${PREFERENCE_LIMIT} saved preferences used.`}
          </p>
        </section>

        <p className="compare-caveat" data-testid="compare-caveat">
          {COMPARISON_CAVEAT}
        </p>
      </div>

      <div className="sheet-foot">
        <button type="button" className="btn" onClick={onClose} data-testid="compare-close">
          Close
        </button>
      </div>
        </>
      ) : null}
    </dialog>
  );
}
