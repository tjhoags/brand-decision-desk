/**
 * The top bar: what this is, whether anything is being stored, undo, and the
 * way in and out of a file.
 *
 * The saving control reports what actually happened rather than what was asked
 * for, and the standings strip keeps the state of all three components visible
 * even when the record panel is behind a tab on a phone.
 */
import type { ReactElement } from 'react';
import { CATEGORY_LABEL, DIRECTION_NAME } from '../domain/presets';
import { acceptedDecision, reviewFor } from '../domain/state';
import { CATEGORY_IDS, type Content } from '../domain/types';

export interface SaveState {
  kind: 'off' | 'pending' | 'saved' | 'error' | 'unavailable';
  message: string;
}

interface TopBarProps {
  content: Content;
  savingEnabled: boolean;
  saveState: SaveState;
  onToggleSaving: (next: boolean) => void;
  canUndo: boolean;
  undoSteps: number;
  onUndo: () => void;
  onOpenSheet: () => void;
}

export function TopBar({
  content,
  savingEnabled,
  saveState,
  onToggleSaving,
  canUndo,
  undoSteps,
  onUndo,
  onOpenSheet,
}: TopBarProps): ReactElement {
  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="topbar-title">
          <h1>Brand Decision Desk</h1>
          <p>
            Compare three authored directions on a homepage and a customer email, then record which palette, type
            and voice you chose and why.
          </p>
        </div>

        <div className="topbar-actions">
          <label className={saveState.kind === 'error' ? 'save-toggle is-error' : 'save-toggle'}>
            <input
              type="checkbox"
              checked={savingEnabled}
              disabled={saveState.kind === 'unavailable'}
              data-testid="saving-toggle"
              onChange={(event) => onToggleSaving(event.target.checked)}
            />
            <span>Save in this browser</span>
            <span className="save-state" data-testid="save-state">
              {saveState.message}
            </span>
          </label>

          <button
            type="button"
            className="btn"
            onClick={onUndo}
            disabled={!canUndo}
            data-testid="undo"
            title={
              canUndo
                ? `Undo the last change (${undoSteps} ${undoSteps === 1 ? 'step' : 'steps'} kept)`
                : 'Nothing has changed yet, so there is nothing to undo'
            }
          >
            {canUndo ? `Undo (${undoSteps})` : 'Nothing to undo'}
          </button>

          <button type="button" className="btn btn-strong" onClick={onOpenSheet} data-testid="open-sheet">
            Export or reopen
          </button>
        </div>
      </div>

      <div className="standings">
        <span className="standings-label">Recorded</span>
        {CATEGORY_IDS.map((category) => {
          const decision = acceptedDecision(content, category);
          const review = decision ? reviewFor(content, decision) : null;
          const needsReview = review?.needsReview === true;
          return (
            <span
              key={category}
              className={
                needsReview ? 'standing is-review' : decision ? 'standing is-accepted' : 'standing'
              }
              data-testid={`standing-${category}`}
            >
              {CATEGORY_LABEL[category]}{' '}
              <b>{decision ? DIRECTION_NAME[decision.option] : 'not chosen yet'}</b>
              {needsReview ? ' · needs review' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
