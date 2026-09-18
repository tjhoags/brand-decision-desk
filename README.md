# Brand Decision Desk

A browser-only worksheet for turning a visual reaction into an explicit design decision.

[Open the desk](https://tjhoags.github.io/brand-decision-desk/) · [v1.1.0 release](https://github.com/tjhoags/brand-decision-desk/releases/tag/v1.1.0)

You are shown three authored brand directions on two pieces of work a small business actually has to
look at - a homepage and a customer email. You can look at a direction whole, or mix its palette,
typography and voice with another's. When something catches your eye you can put it under a controlled
comparison: hold the business, the surface and two of the three axes still, change exactly one thing,
and see the two renderings side by side. When you have a view, you record it: accept one option per
component, reject others, leave the rest open, and say why - and, separately, save what you preferred
in a comparison, in your own words, with a scope you choose. What comes out is a JSON worksheet you can
reopen here and a Markdown brief a designer or a website builder can read.

Everything runs in the page after the application loads from this site. No account, backend, upload,
model API, external fonts or third-party scripts. Saving in the browser is off until you turn it on.

## Why it is shaped this way

Most brand tools show you options. The hard part is not the options; it is remembering what you decided,
which brief you decided it against, and whether that brief has since changed. So the desk keeps three
things deliberately separate:

- **What you are looking at.** The stage. Changing it records nothing. When the stage and your accepted
  choices differ, the desk says which component and how.
- **What you have decided.** The record. One accepted option per component, with a reason, and the brief
  as it read at the moment you accepted.
- **What you noticed.** Preferences saved from a comparison: what you preferred, why, how far you meant
  it to go, and the conditions it was seen under. Notes, not rules.
- **What the brief says now.** The business facts, and the draft wording for each direction.

Because an acceptance stores the brief it was approved against, a later change to the brief marks that
acceptance as needing review - it never edits or deletes your choice, and the reason you wrote stays put.
Put the brief back the way it was and the warning clears on its own, because the warning is a comparison
rather than a flag someone has to remember to unset.

This is a decision worksheet, not a brand generator, and not a new category. Brand kits, moodboards,
applied previews and design handoffs all exist. What is here is a small, honest, local version of the
step between "I like that one" and "here is what we chose, and why".

## The three directions

Each is written into this build as a set of tokens and wording - there is nothing generated and nothing
fetched. All three use system font stacks, so the exact faces depend on the device reading them.

| | Palette | Typography | Voice |
| --- | --- | --- | --- |
| **Quarterdeck** | Deep slate on warm paper, brass accent | Georgia headings with system sans text, centred and crisp | Full sentences, unhurried, a printed-prospectus register |
| **Open Harbor** | Warm paper, dark teal, coral used only as decoration | Rounded system sans where the device has one, generous leading | Spoken and warm, second person, short welcoming sentences |
| **Ledger** | Near white, ink, ochre | System sans with monospace labels on a ruled editorial grid | Clipped and itemised, facts before feeling |

The three are independent axes. Palette carries colour, typography carries the letterforms *and* the
geometry (corners, rules, alignment, how the fact band is laid out), voice carries the words. Any of the
27 combinations previews correctly, because a palette exposes named roles - hero background, hero text,
band label, call to action - and the previews only ever use roles.

### About contrast

The desk reports the weakest measured text pair for the palette on screen, and names what was measured.
A unit test asserts that all eight text-on-background role pairs in every palette meet 4.5:1, and that
decorative fills clear 3:1 against their ground. That is a specific, checkable claim about those pairs.
It is not a claim that the whole interface passes every accessibility requirement.

## The worked example

The desk opens on **Halyard Studio**, a fictional drawing workshop invented for this worksheet. Nothing
about it is real. Four facts are editable - business name, what it is, who it is for, what is offered -
and every field still holding its sample value is marked `Sample` in the app and called out in the
exported brief, so untouched fiction is never presented as something you asserted.

Preset wording is built from those facts, so replacing them with a real business replaces the preview
copy with it. No preset states a price, a duration, a group size, an address, a contact, an outcome, or
what happens after someone gets in touch. Where wording of that kind would normally sit there is a
square-bracket blank - `[LOCATION]`, `[FIRST NAME]`, `[ADD WHAT HAPPENS NEXT HERE]` - which is a space
for you to fill, not a claim.

Draft copy is separate from the facts and separate per direction, so switching voice never destroys what
you wrote. Each field you rewrite remembers the facts it was written against; if you later change a fact
that your wording still names, the desk tells you which field and what changed. Reset a field, or the
whole direction, back to the preset at any time.

The previews are illustrations. The call to action is text with a note saying it is not a working button.
Nothing is published and nothing is sent.

## Compare one thing

A reaction to a rendering is not yet a preference. It becomes one when you can say what you preferred,
against what, under what conditions, and how far it goes. That is what this journey is for.

Open it from the preview. Pick the one axis to vary - **palette**, **typography treatment** or
**voice** - and the desk builds both sides from the same held triple, so the business facts, the surface
and the other two axes are identical by construction rather than by care. A line above the two previews
names exactly what is held and exactly what is varying.

The axes are described as what they really are:

- **Palette** changes only the colours. The words and the shapes stay.
- **Typography treatment** changes the typeface *and* the geometry together - headings, labels, corner
  radius, rule weight, alignment, the layout of the fact band. It is not a font test, and the desk says
  so rather than letting you believe you isolated a typeface.
- **Voice** changes only the words, as they actually read now, including anything you have rewritten by
  hand.

**Choosing a side** puts that option on the stage and does nothing else. It accepts no category, creates
no rule, hides no option and never touches your copy. You can also just keep exploring: change the axis,
the alternative or the surface, and close without recording anything.

**Saving a preference** is a separate, explicit step that will not proceed without two things you supply:
your own words, and a scope. The desk will not write the statement for you or infer it from a click. The
two scopes are *this example on this surface* and *this project's customer-facing work*. Neither is a
global rule, and there is no option that would make one.

What is saved: the axis, which direction was preferred and which it was compared with, your statement,
your scope, and the evidence - the business facts at the time, the held triple, the surface, and the
wording that was on screen for both sides of that surface. The evidence is never rewritten. If a fact or
the compared wording changes afterwards, the preference is flagged for review in the record and in the
export, with what moved named, and what you wrote left exactly as you wrote it.

Every preference carries the same caveat, in the app and in both exports: one comparison shows which of
two rendered examples someone preferred on one surface with everything else held still. It does not
isolate which attribute caused the reaction. Nothing acts on a saved preference - not the desk, not the
exports, and nothing outside this page.

A worksheet keeps up to 20 preferences. At the limit the desk refuses a new one and says so rather than
dropping an earlier note.

## Undo

Undo restores content exactly: facts, draft wording, every decision with its reason, the approval
context that drives the review warnings, and saved preferences with their evidence. Saving a preference
is one step; removing one is another, and Undo brings it back whole. It keeps **the last 50 steps**, and steps older than that are
dropped from the oldest end - never your current work. Once anything has been dropped the desk says so,
in the app and in the exported file, and it keeps saying so after the file is reopened.

Keystrokes in one field within about a second collapse into a single step, so undo moves in edits rather
than characters. Looking at a different direction, switching between homepage and email, or opening a row
in the record are display changes and are not undoable.

Ctrl+Z (Cmd+Z on a Mac) undoes, except while a text field has focus, where the browser's own text undo is
left alone.

## Files

**Download JSON worksheet** writes the file this desk reopens: schema and preset versions, the facts, all
draft wording, all nine decisions with reasons and approval contexts, every saved preference with its
scope and evidence, what is on the stage, and the retained undo history. **Download Markdown brief**
writes the readable handoff, including a preferences section with the statement, the scope, what was held
still, the wording both sides showed, and whether the conditions still hold.

Neither export is an instruction. Nothing in either file tells another tool to do anything, and nothing
is synchronised anywhere.

**Reopen a worksheet file** replaces everything on the desk. It says so plainly once, next to the control;
there is no repeated approval gate. Download your current work first if you want to keep it - and if
saving in this browser is on, the stored copy is replaced too, so it is not a way back.

### Schema versions

Worksheets are written in **schema 2**, which added saved preferences. This build still opens a **schema 1**
file written by version 1.0 and reads it forward: every decision, reason, approval context, draft override
and undo step comes across unchanged, and the worksheet starts with no preferences because that version had
none. Every historical step is migrated the same way, so Undo keeps working across the boundary. The desk
says in the import report when it has done this.

The migration only goes forward. **A version 1.0 app cannot open a file written by this build**, and the
export panel says so where the download is offered. A schema 1 file that carries a `preferences` key is
refused as malformed, because version 1.0 could not have written one.

A file is validated in full before anything is replaced. The importer rejects a schema version this build
cannot read, an unknown preset version, an unknown component or direction id, an invalid status, a
duplicated or missing decision, more than one accepted option in a component, a voice approval with no
draft signature, an oversized string, a history longer than 50 steps, an unexpected field, and anything
that is not readable JSON. A preference is rejected for an unknown scope, an empty statement, a direction
compared with itself, missing evidence, held picks that contradict the direction it says was chosen, copy
evidence from a surface the comparison did not use, a duplicate id, or more than 20 of them. Every nested
history step is validated the same way. A rejected file changes nothing: not the worksheet, not the copy
stored in the browser. The desk names what was wrong.

A file carries ids and text, never code, colours, fonts or URLs. Palette and type values come from the
presets in this build, looked up by id, so an import cannot introduce a style of its own.

If a file read finishes after you have changed the worksheet, or after you have opened a newer file, it is
discarded rather than applied, and the desk says which. Sizes: 4 MB is the largest file the desk will read,
checked before it is decoded; an export that would exceed 3 MB leaves out its oldest undo steps, never your
current work, and reports how many.

### Markdown safety

The brief quotes everything you typed as data. Short values go in inline code with a delimiter longer than
any backtick run inside them; longer values go in fenced blocks with a fence longer than any run inside
them. A reason beginning `## Approved for launch` therefore reads as text someone typed, not as a section
the document is asserting. Headings, tables and section order come only from the generator, and colour
values come only from this build's presets.

## Saving in this browser

Off by default; nothing is stored until you turn it on. An existing stored session is read and validated
before the first write and is never cleared on startup - if it cannot be read, the desk says so and leaves
it exactly where it is.

A write is reported as saved only after it has been read back and compared. A refused write (a full or
blocked store) is reported as not saved, your work stays open, and you can download it or retry. Turning
saving off removes the stored copy and confirms the removal; if the removal fails, the desk says the copy
is still there rather than claiming it is gone.

## Layout

At 1340px and above: brief, stage and record side by side, with the stage given the widest column and made
sticky on tall screens so the preview stays put while you work down the record. Between 1000px and 1340px
the brief moves across the top. Below 1000px the three become tabs, so a phone gets one panel at a time;
the standings strip in the header keeps all three components' state visible from any tab.

Controls are at least 40px tall, keyboard focus is a 2px outline, and transitions are removed under
`prefers-reduced-motion`.

## Running it

Node 24 and a lockfile.

```
npm ci
npm run dev        # http://localhost:5173/brand-decision-desk/
npm run check      # unit tests, typecheck, production build, privacy scan
npm run test:e2e   # Chromium, desktop and phone, against the production build
```

`npm run privacy` fails on any network call, remote asset, font host, analytics global, model API host or
private material in the source or in the built output. Two URL strings are allowed as text and each is
listed with its reason when the check passes: the W3C namespace identifiers, which browsers never fetch,
and a documentation link inside a React error message.

`npm run test:e2e` builds and serves the production bundle at `/brand-decision-desk/`, the same base path
Pages uses, then drives it in real Chromium at 1440x900 and on an emulated Pixel 7. It reparses the files
the browser actually wrote, injects storage failures and slow file reads from the test side rather than
through any hook in the app, and asserts the page requests nothing but its own files.

There are 185 unit tests and 150 browser tests (three of which are layout-specific and skip on the project
they do not apply to).

[What shipped - technical, plain language, and product explanation](docs/SHIPPING-v1.1.md)

## Repository

```
src/domain/      presets, pure state, comparison, validation, portable file, Markdown, storage, contrast
src/components/  top bar, brief, stage, previews, comparison sheet, decision record, export sheet
src/App.tsx      storage, downloads, race-guarded reopening, layout
scripts/         privacy check
tests/unit/      state transitions, comparison, migration, validation, serialisation, Markdown, storage, contrast
tests/e2e/       the journey, comparison, files, storage and races, limits, access
tests/e2e/fixtures/version-1-worksheet.json   a real schema 1 file, opened by the migration test
tests/acceptance/behavior.json   the acceptance cases these tests answer to
docs/            the reviewed design reference and its prototype screenshot
```

The prototype screenshot in `docs/` is visual guidance only. Where it differs from
`IMPLEMENTATION_BRIEF.md` and `docs/DESIGN_REFERENCE.md`, those documents win - they correct several
things the prototype did, including its inability to preview mixed components and its invented
operational promises.

## What this is not

It does not verify anything you type. It does not publish a site or send an email. It does not claim a
capability no other tool has, or that anyone wants to buy it. It does not generate brands - the three
directions are written into this build by hand, and there are three of them.

It does not learn. A saved preference changes nothing about how the desk behaves, is never applied to a
later comparison, and is not a model of your taste. A comparison is not an experiment that isolates an
attribute, and the desk says so next to every preference rather than letting the side-by-side imply it.

## Licence

MIT. See `LICENSE`.
