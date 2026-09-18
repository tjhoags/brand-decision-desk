/**
 * The desk itself.
 *
 * Session state lives in a store outside React so that an asynchronous file
 * read can compare against the live worksheet at the moment it finishes. That
 * is what makes the rule exact: a slow read never overwrites newer work, and
 * says so instead of failing quietly.
 *
 * Nothing here touches the network. Downloads are object URLs built in the
 * page; saving is opt-in, confirmed by reading the write back, and any failure
 * is reported as a failure.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { DeskStore } from './store';
import { BriefPanel } from './components/BriefPanel';
import { DecisionRecord } from './components/DecisionRecord';
import { Stage } from './components/Stage';
import { TopBar, type SaveState } from './components/TopBar';
import { ExportSheet, formatBytes, type ExportNote, type ImportReport } from './components/ExportSheet';
import { buildFile, byteLength, fileStem } from './domain/portable';
import { buildMarkdown } from './domain/markdown';
import { validateFileText } from './domain/validate';
import { clearStored, readStored, writeStored } from './domain/storage';
import { canUndo, type Action } from './domain/state';
import { HISTORY_LIMIT, IMPORT_MAX_BYTES } from './domain/limits';

type Section = 'brief' | 'stage' | 'record';

const SECTIONS: Section[] = ['brief', 'stage', 'record'];

const SECTION_LABEL: Record<Section, string> = {
  brief: 'Brief',
  stage: 'Preview',
  record: 'Record',
};

const SAVE_DEBOUNCE_MS = 350;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message || error.name : 'the browser gave no reason';
}

function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Below this width the three panels become tabs, so a phone gets one panel at a
 * time instead of one very long column. Watched rather than assumed, so the
 * tablist and the panels always agree about which mode is in force.
 */
function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 999px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

function clockTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function App() {
  const store = useMemo(() => new DeskStore(), []);
  const session = useSyncExternalStore(store.subscribe, store.getSession, store.getSession);
  const narrow = useNarrowLayout();

  const [savingEnabled, setSavingEnabled] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'off', message: 'Off – nothing is stored' });
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exportNote, setExportNote] = useState<ExportNote | null>(null);
  const [importReport, setImportReport] = useState<ImportReport>({ kind: 'idle' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('stage');
  const [announcement, setAnnouncement] = useState('');

  const importToken = useRef(0);
  const startupDone = useRef(false);
  // Restoring a stored session does not need to write it straight back.
  const skipNextSave = useRef(false);

  const dispatch = useCallback(
    (action: Action) => {
      store.dispatch(action);
    },
    [store],
  );

  /* ------------------------------------------------ startup: read, never erase */

  useEffect(() => {
    if (startupDone.current) return;
    startupDone.current = true;

    const outcome = readStored();
    if (outcome.status === 'unavailable') {
      setSaveState({ kind: 'unavailable', message: 'Not available in this browser' });
      setStorageNotice(
        `Saving in this browser is not available: ${outcome.reason}. Everything else works; use Export to keep a copy of your work.`,
      );
      return;
    }
    if (outcome.status === 'error') {
      setSaveState({ kind: 'unavailable', message: 'Not available in this browser' });
      setStorageNotice(
        `This browser refused to read its own storage for this page: ${outcome.reason}. Nothing was written or removed.`,
      );
      return;
    }
    if (outcome.status === 'empty') return;

    const result = validateFileText(outcome.text);
    if (!result.ok) {
      setSaveState({ kind: 'off', message: 'Off – a stored copy exists but could not be read' });
      setStorageNotice(
        `A saved session is in this browser but could not be read (${result.problems[0] ?? 'unknown problem'}). ` +
          'It has been left exactly where it is, not deleted. Turning saving on will replace it.',
      );
      return;
    }

    store.dispatch({
      type: 'replaceContent',
      content: result.value.content,
      history: result.value.history,
      trimmed: result.value.historyTrimmed,
      view: result.value.view,
    });
    skipNextSave.current = true;
    setSavingEnabled(true);
    setSaveState({ kind: 'saved', message: 'On – restored from this browser' });
    setAnnouncement('Your saved worksheet was restored from this browser.');
  }, [store]);

  /* --------------------------------------------- saving: write, then read back */

  const writeNow = useCallback(() => {
    const built = buildFile(store.getSession(), new Date().toISOString());
    const result = writeStored(built.json);
    if (result.ok) {
      setSaveState({ kind: 'saved', message: `On – saved at ${clockTime(new Date())}` });
    } else {
      setSaveState({ kind: 'error', message: `Not saved: ${result.reason}` });
      setAnnouncement(
        `Your work could not be saved in this browser: ${result.reason}. It is still open here; download it to keep it.`,
      );
    }
  }, [store]);

  useEffect(() => {
    if (!savingEnabled) return;
    if (skipNextSave.current) {
      // What is in the browser is exactly what was just restored from it.
      skipNextSave.current = false;
      return;
    }
    // The status says "saving" for as long as the write really is pending, so
    // "saved at" never describes a copy that is already out of date.
    setSaveState((previous) =>
      previous.kind === 'saved' ? { kind: 'pending', message: 'On – saving…' } : previous,
    );
    const timer = window.setTimeout(writeNow, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [savingEnabled, session.content, session.view, writeNow]);

  useEffect(() => {
    if (!savingEnabled) return;
    // Leaving the page should not cost the last few hundred milliseconds of
    // work, so the pending write is flushed on the way out.
    const flush = () => writeNow();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [savingEnabled, writeNow]);

  const toggleSaving = useCallback((next: boolean) => {
    if (next) {
      setSavingEnabled(true);
      setStorageNotice(null);
      setSaveState({ kind: 'pending', message: 'On – writing…' });
      return;
    }
    setSavingEnabled(false);
    const result = clearStored();
    if (result.ok) {
      setSaveState({ kind: 'off', message: 'Off – the stored copy was removed' });
      setAnnouncement('Saving is off and the copy stored in this browser was removed.');
    } else {
      setSaveState({ kind: 'error', message: `Off, but not removed: ${result.reason}` });
      setAnnouncement(
        `Saving is off, but the copy already in this browser could not be removed: ${result.reason}. It is still there.`,
      );
    }
  }, []);

  /* ------------------------------------------------------------------ exports */

  const handleDownloadJson = useCallback(() => {
    try {
      const stamp = new Date().toISOString();
      const built = buildFile(store.getSession(), stamp);
      downloadText(`${fileStem(store.getSession().content.facts, stamp)}.json`, built.json, 'application/json');
      const trimNote =
        built.historyStepsDropped > 0
          ? ` The ${built.historyStepsDropped} oldest undo ${built.historyStepsDropped === 1 ? 'step was' : 'steps were'} left out so the file stays inside the size this desk can reopen; your current work is complete.`
          : '';
      setExportNote({
        kind: 'ok',
        message: `Worksheet downloaded: ${formatBytes(built.bytes)}, ${built.historyStepsKept} undo ${
          built.historyStepsKept === 1 ? 'step' : 'steps'
        }.${trimNote}`,
      });
    } catch (error) {
      setExportNote({ kind: 'error', message: `The worksheet could not be written: ${describeError(error)}` });
    }
  }, [store]);

  const handleDownloadMarkdown = useCallback(() => {
    try {
      const stamp = new Date().toISOString();
      const current = store.getSession();
      const text = buildMarkdown(current.content, {
        exportedAt: stamp,
        historySteps: current.history.past.length,
      });
      downloadText(`${fileStem(current.content.facts, stamp)}.md`, text, 'text/markdown');
      setExportNote({ kind: 'ok', message: `Decision brief downloaded: ${formatBytes(byteLength(text))}.` });
    } catch (error) {
      setExportNote({ kind: 'error', message: `The brief could not be written: ${describeError(error)}` });
    }
  }, [store]);

  /* --------------------------------------------------- reopening, race-guarded */

  const handlePickFile = useCallback(
    async (file: File) => {
      const token = (importToken.current += 1);
      const revisionAtStart = store.getRevision();
      setExportNote(null);
      setImportReport({ kind: 'reading', message: `Reading ${file.name}…` });

      if (file.size > IMPORT_MAX_BYTES) {
        setImportReport({
          kind: 'error',
          message: `${file.name} is ${formatBytes(file.size)}, past the ${formatBytes(
            IMPORT_MAX_BYTES,
          )} limit, so it was not opened. Your work is untouched.`,
        });
        return;
      }

      let text: string;
      try {
        text = await file.text();
      } catch (error) {
        setImportReport({
          kind: 'error',
          message: `${file.name} could not be read: ${describeError(error)}. Your work is untouched.`,
        });
        return;
      }

      if (token !== importToken.current) {
        setImportReport({
          kind: 'error',
          message: `${file.name} finished reading after a newer file was opened, so it was discarded. The newer file stands.`,
        });
        return;
      }

      if (store.getRevision() !== revisionAtStart) {
        setImportReport({
          kind: 'error',
          message: `${file.name} finished reading after you changed the worksheet, so it was not applied. Your newer work is untouched – choose the file again if you do want to replace it.`,
        });
        return;
      }

      const result = validateFileText(text);
      if (!result.ok) {
        setImportReport({ kind: 'error', message: result.summary, problems: result.problems });
        setAnnouncement(result.summary);
        return;
      }

      store.dispatch({
        type: 'replaceContent',
        content: result.value.content,
        history: result.value.history,
        trimmed: result.value.historyTrimmed,
        view: result.value.view,
      });
      setExpanded(null);
      const trimNote = result.value.historyTrimmed
        ? ` Some undo steps older than the ones in the file are not available; the file says so.`
        : '';
      setImportReport({
        kind: 'done',
        message: `Opened ${file.name}. Everything on the desk is now from that file, including ${
          result.value.history.length
        } undo ${result.value.history.length === 1 ? 'step' : 'steps'}.${trimNote}`,
      });
      setAnnouncement(`Opened ${file.name}. The worksheet was replaced by that file.`);
    },
    [store],
  );

  /* ----------------------------------------------------------------- keyboard */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // Leave the browser's own text undo alone while a field has focus.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (!canUndo(store.getSession())) return;
      event.preventDefault();
      store.dispatch({ type: 'undo' });
      setAnnouncement('Undone.');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const undoable = canUndo(session);

  const panels: Record<Section, ReactNode> = {
    brief: <BriefPanel content={session.content} view={session.view} dispatch={dispatch} />,
    stage: <Stage content={session.content} view={session.view} dispatch={dispatch} />,
    record: (
      <DecisionRecord
        content={session.content}
        view={session.view}
        dispatch={dispatch}
        expanded={expanded}
        onExpand={setExpanded}
      />
    ),
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#stage">
        Skip to the preview
      </a>

      <TopBar
        content={session.content}
        savingEnabled={savingEnabled}
        saveState={saveState}
        onToggleSaving={toggleSaving}
        canUndo={undoable}
        undoSteps={session.history.past.length}
        onUndo={() => {
          store.dispatch({ type: 'undo' });
          setAnnouncement('Undone.');
        }}
        onOpenSheet={() => setSheetOpen(true)}
      />

      {storageNotice ? (
        <div className="callout is-warn" style={{ marginBottom: 14 }} role="status" data-testid="storage-notice">
          <span className="callout-mark" aria-hidden="true">
            !
          </span>
          <span>{storageNotice}</span>
        </div>
      ) : null}

      {narrow ? (
        <div className="section-tabs" role="tablist" aria-label="Sections">
          {SECTIONS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={section === name}
              aria-controls={`section-${name}`}
              id={`section-tab-${name}`}
              data-testid={`section-tab-${name}`}
              onClick={() => {
                setSection(name);
                // A phone keeps its scroll position across a tab change, which
                // would land mid-panel; go back to the top of the new one.
                window.scrollTo({
                  top: 0,
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                });
              }}
            >
              {SECTION_LABEL[name]}
            </button>
          ))}
        </div>
      ) : null}

      <main className="workspace">
        {narrow ? (
          <div
            className="section"
            id={`section-${section}`}
            role="tabpanel"
            aria-labelledby={`section-tab-${section}`}
            tabIndex={-1}
          >
            {panels[section]}
          </div>
        ) : (
          SECTIONS.map((name) => (
            <div key={name} className="section" id={`section-${name}`}>
              {panels[name]}
            </div>
          ))
        )}
      </main>

      <footer className="note" style={{ marginTop: 24, maxWidth: '70ch' }}>
        <p>
          Everything here runs in this browser. The page loads its own script and stylesheet from the address you
          opened, and nothing else: no fonts, data or code from anywhere else, no uploads, no analytics, and no
          model generating anything - the three directions are written into this build. Undo keeps the last{' '}
          {HISTORY_LIMIT} steps.
        </p>
      </footer>

      <ExportSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDownloadJson={handleDownloadJson}
        onDownloadMarkdown={handleDownloadMarkdown}
        onPickFile={(file) => void handlePickFile(file)}
        exportNote={exportNote}
        importReport={importReport}
        historyTrimmed={session.history.trimmed}
        historySteps={session.history.past.length}
      />

      <p
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {announcement}
      </p>
    </div>
  );
}
