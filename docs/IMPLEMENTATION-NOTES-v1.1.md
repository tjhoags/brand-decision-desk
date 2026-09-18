# v1.1 implementation notes

Concise notes on what changed and why, for review. The user-facing shipping document is separate.

## What was missing in 1.0

1.0 could turn a look into a decision, but not a reaction into a scoped preference. Accepting a palette
recorded *that this option is the one*, against a brief. It could not record *what I preferred, against
what, under what conditions, and how far I mean it* - which is the thing a designer actually needs, and
the thing that is dangerous to infer from a click.

1.1 adds one journey: hold everything still, change exactly one thing, look at both, and - if you want -
say what you preferred in your own words with a scope you pick.

## Design decisions

**The one-axis rule is structural, not procedural.** `buildSides` in `src/domain/compare.ts` is the only
place the two sides are constructed, and it builds both from the same held triple with one key replaced.
The interface cannot vary a second thing by mistake because it never assembles a side itself. Unit tests
assert the invariant for every axis, every alternative and both surfaces (18 generated cases); browser
tests assert it against the computed CSS custom properties and rendered text of what actually painted.

**Typography is named for what it does.** The 1.0 presets vary the typeface *and* the geometry - radius,
rule weight, alignment, band layout. Calling that a font comparison would misdescribe the experiment, so
the axis is "Typography treatment" everywhere it appears, and `AXIS_WHAT_CHANGES.typography` says the
typeface and shapes move together and that one comparison cannot tell you which part you reacted to.

**Choosing and saving are separate.** Choosing a side is a preview action: it puts that option on the
stage and nothing else - no acceptance, no rule, no hidden option, no rewritten copy. Saving is a second,
explicit step that refuses to proceed without a non-empty statement the user typed and a scope they
picked. The reducer enforces the same rule (`savePreference` returns the state unchanged for a blank
statement), so the guarantee does not depend on the form.

**Scope is bounded by construction.** There are exactly two scopes - this example on this surface, and
this project's customer-facing work - and no third that would be global. Nothing reads a preference back:
no code path applies one to a later comparison, a decision, or an export as an instruction.

**Staleness is derived, matching 1.0's approach to approval context.** `preferenceReview` compares the
stored evidence with live content. It checks the facts, and the wording for the surface and voices the
comparison actually rendered - so editing the email body does not flag a homepage comparison, and editing
a voice nobody compared flags nothing. Putting the brief back clears the flag on its own. The evidence is
never rewritten.

**Evidence is the surface that was compared, not everything.** `captureSurfaceCopy` keeps only the fields
the compared surface renders. That is both more honest (it is what was on screen) and much smaller, which
matters because preferences live in `Content` and therefore in every undo snapshot.

## Schema

`SCHEMA_VERSION` is now **2**; `PRESET_VERSION` stays 1 - no presets were added or changed.

- Schema 1 files are read forward. `readContent` takes the file's version and allows `preferences` only
  at 2 or above, migrating a version 1 payload to `preferences: []`. Every history step goes through the
  same function, so historical steps migrate too and Undo works across the boundary.
- A schema 1 file carrying a `preferences` key is refused: version 1.0 could not have written one, so its
  presence means the file is not what it says it is.
- A schema version above 2 is refused rather than guessed at.
- The app says when it migrated, in the import report and in the startup notice for a migrated autosave,
  and the export panel states that a 1.0 app cannot open a schema 2 file.
- `tests/e2e/fixtures/version-1-worksheet.json` is a real schema 1 worksheet with seven history steps. A
  unit test asserts it is genuinely schema 1 with no preferences anywhere and that it migrates intact; a
  browser test opens it through the real file input.

## Interface

`CompareSheet` is a modal `<dialog>`, like the export sheet. Its body renders only while open, so a
closed dialog does not reconcile two previews.

Two issues found by looking at the running app rather than by tests:

- **The sheet's `h3` rule was overriding the preview headline.** `.sheet-body h3` (0,0,1,1) outranked
  `.pv-headline` (0,0,1,0), so a preview rendered inside any dialog dropped its headline to 13px. The
  preview's own rules are now scoped under `.pv`. A browser test asserts both comparison headlines render
  at 20px or more.
- **Choosing side B recorded the comparison backwards.** Choosing puts that option on the stage, which
  makes it side A on the next render; the `chosen` marker stayed on 'b' and `save()` then read the wrong
  side. The chosen option now always becomes side A and the marker moves with it. A browser test reads
  the two side names before choosing and asserts the saved summary names them in the right order - this
  would have written false evidence into an export.

A two-up comparison of whole pages is taller than a laptop window, so each side's name and its choose
button sit in a header that stays in view while the preview scrolls past. Both previews are compacted
identically, so the comparison stays fair.

## Limits

- `PREFERENCE_LIMIT` is 20 per worksheet; `PREFERENCE_STATEMENT_LIMIT` is 600 characters. At the limit the
  desk refuses and says so rather than dropping an earlier note.
- Preferences are content, so they are in the bounded 50-step undo history. A worksheet holding many
  preferences with long email evidence can push an export past the 3 MB ceiling, at which point the
  existing behaviour applies unchanged: the oldest undo steps are dropped, never current work, and the
  file and the app both disclose it.

## Unchanged

Bounded history, size ceilings, validate-before-replace, the race guard on slow reads, safe quoting of
user text in Markdown, opt-in storage with readback confirmation, contrast role checks, and the
browser-only, offline, no-analytics, no-model posture. `npm run privacy` still passes over source and
built output.


## Independent release review

The coordinating review added collision-safe preference ids, a fresh-choice requirement each time the
comparison opens, strict non-empty identity/date fields, identical wording on both sides of a visual
comparison, and a required preference list in schema 2. A second real v1 browser download is checked
field-for-field, including its five retained history steps. The comparison dialog now reserves space
for its Close control inside a short laptop viewport. Package metadata is version 1.1.0.
