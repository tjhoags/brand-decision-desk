/**
 * Export and reopen.
 *
 * Both downloads are real files written from the live session. Reopening is one
 * explicit control with one plain sentence about what it replaces - not a
 * repeated approval gate - and a file that fails validation changes nothing at
 * all, including the copy stored in this browser.
 */
import { useEffect, useRef, type ReactElement } from 'react';
import { HISTORY_LIMIT, IMPORT_MAX_BYTES } from '../domain/limits';
import { SCHEMA_VERSION } from '../domain/presets';

export interface ExportNote {
  kind: 'ok' | 'error';
  message: string;
}

export interface ImportReport {
  kind: 'idle' | 'reading' | 'error' | 'done';
  message?: string;
  problems?: string[];
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  onDownloadJson: () => void;
  onDownloadMarkdown: () => void;
  onPickFile: (file: File) => void;
  exportNote: ExportNote | null;
  importReport: ImportReport;
  historyTrimmed: boolean;
  historySteps: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { formatBytes };

export function ExportSheet({
  open,
  onClose,
  onDownloadJson,
  onDownloadMarkdown,
  onPickFile,
  exportNote,
  importReport,
  historyTrimmed,
  historySteps,
}: SheetProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog className="sheet" ref={dialogRef} onCancel={onClose} onClose={onClose} aria-labelledby="sheet-heading">
      <div className="sheet-head">
        <div>
          <h2 id="sheet-heading">Export or reopen</h2>
          <p className="note">
            Files are written and read in this browser. Nothing is uploaded, and no copy of your work leaves this
            page.
          </p>
        </div>
      </div>

      <div className="sheet-body">
        <section>
          <h3>Download</h3>
          <p className="note">
            The JSON worksheet is the file to reopen here: facts, draft wording, every decision with its reason and
            approval context, any preferences saved from a comparison with their scope and evidence, what is on the
            stage, and up to {HISTORY_LIMIT} undo steps. The Markdown brief is for a person to read.
          </p>
          <p className="note" style={{ marginTop: 6 }}>
            Worksheets are written in schema {SCHEMA_VERSION}. This build still opens a schema 1 file from version
            1.0 and reads it forward, but <b>a version 1.0 app cannot open a file written here</b>.
          </p>
          <div className="download-row">
            <button type="button" className="btn btn-strong" onClick={onDownloadJson} data-testid="download-json">
              Download JSON worksheet
            </button>
            <button type="button" className="btn" onClick={onDownloadMarkdown} data-testid="download-markdown">
              Download Markdown brief
            </button>
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            {historySteps === 0
              ? 'No undo steps to carry yet.'
              : `${historySteps} undo ${historySteps === 1 ? 'step' : 'steps'} will travel with the worksheet.`}
            {historyTrimmed
              ? ` Undo keeps the last ${HISTORY_LIMIT} steps, and steps older than the ones held now are gone; the file says so.`
              : ''}
          </p>
          {exportNote ? (
            <p
              className={exportNote.kind === 'error' ? 'callout is-warn' : 'note'}
              style={{ marginTop: 8 }}
              role="status"
              data-testid="export-note"
            >
              {exportNote.message}
            </p>
          ) : null}
        </section>

        <section>
          <h3>Reopen a worksheet file</h3>
          <p className="note">
            Opening a file <b>replaces everything on this desk</b>: the facts, all draft wording, every decision and
            reason, and the undo history. Download your current work first if you want to keep it - and note that
            if saving in this browser is on, the stored copy is replaced by the opened file too, so it is not a way
            back. A file that cannot be read changes nothing at all.
          </p>
          <label className="label" htmlFor="reopen-input" style={{ marginTop: 12 }}>
            Worksheet file (.json, up to {formatBytes(IMPORT_MAX_BYTES)})
          </label>
          <input
            className="file-input"
            id="reopen-input"
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            data-testid="reopen-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Clear the control so choosing the same file twice still fires.
              event.target.value = '';
              if (file) onPickFile(file);
            }}
          />
          {importReport.kind !== 'idle' && importReport.message ? (
            <div
              className={importReport.kind === 'error' ? 'callout is-warn' : 'callout'}
              style={{ marginTop: 10 }}
              role="status"
              data-testid="import-report"
            >
              <span className="callout-mark" aria-hidden="true">
                {importReport.kind === 'error' ? '!' : 'i'}
              </span>
              <span>
                {importReport.message}
                {importReport.problems && importReport.problems.length > 0 ? (
                  <ul className="problems">
                    {importReport.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                ) : null}
              </span>
            </div>
          ) : null}
        </section>
      </div>

      <div className="sheet-foot">
        <button type="button" className="btn" onClick={onClose} data-testid="close-sheet">
          Close
        </button>
      </div>
    </dialog>
  );
}
