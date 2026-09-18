/**
 * A small store outside React.
 *
 * Reads are synchronous and always current, which is what makes the race rule
 * exact: a file read that finishes after the worksheet has moved on can compare
 * against the live revision at the moment it lands, with no chance of reading a
 * stale render snapshot.
 */
import { apply, createInitialSession, type Action } from './domain/state';
import type { Session } from './domain/types';

export class DeskStore {
  private session: Session = createInitialSession();
  private revision = 0;
  private readonly listeners = new Set<() => void>();

  getSession = (): Session => this.session;

  /** Increments on every change to undoable content; never on a display change. */
  getRevision = (): number => this.revision;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispatch = (action: Action, now: number = Date.now()): void => {
    const next = apply(this.session, action, now);
    if (next === this.session) return;
    if (next.content !== this.session.content) this.revision += 1;
    this.session = next;
    for (const listener of this.listeners) listener();
  };
}
