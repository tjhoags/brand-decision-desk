# Brand Decision Desk

A browser-only worksheet for turning a visual reaction into an explicit design decision.

[Open the desk](https://tjhoags.github.io/brand-decision-desk/) · [v1.0.0 release](https://github.com/tjhoags/brand-decision-desk/releases/tag/v1.0.0)

You are shown three authored brand directions on two pieces of work a small business actually has to
look at - a homepage and a customer email. You can look at a direction whole, or mix its palette,
typography and voice with another's. When you have a view, you record it: accept one option per
component, reject others, leave the rest open, and say why. What comes out is a JSON worksheet you can
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

## Undo

Undo restores content exactly: facts, draft wording, every decision with its reason, and the approval
context that drives the review warnings. It keeps **the last 50 steps**, and steps older than that are
dropped from the oldest end - never your current work. Once anything has been dropped the desk says so,
in the app and in the exported file, and it keeps saying so after the file is reopened.

Keystrokes in one field within about a second collapse into a single step, so undo moves in edits rather
than characters. Looking at a different direction, switching between homepage and email, or opening a row
in the record are display changes and are not undoable.

Ctrl+Z (Cmd+Z on a Mac) undoes, except while a text field has focus, where the browser's own text undo is
left alone.

## Files

**Download JSON worksheet** writes the file this desk reopens: schema and preset versions, the facts, all
draft wording, all nine decisions with reasons and approval contexts, what is on the stage, and the
retained undo history. **Download Markdown brief** writes the readable handoff.

**Reopen a worksheet file** replaces everything on the desk. It says so plainly once, next to the control;
there is no repeated approval gate. Download your current work first if you want to keep it - and if
saving in this browser is on, the stored copy is replaced too, so it is not a way back.

A file is validated in full before anything is replaced. The importer rejects an unknown schema or preset
version, an unknown component or direction id, an invalid status, a duplicated or missing decision, more
than one accepted option in a component, a voice approval with no draft signature, an oversized string, a
history longer than 50 steps, an unexpected field, and anything that is not readable JSON. Every nested
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

There are 113 unit tests and 100 browser tests (two of which are layout-specific and skip on the project
they do not apply to).

## Repository

```
src/domain/      presets, pure state, validation, portable file, Markdown, storage, contrast
src/components/  top bar, brief, stage, previews, decision record, export sheet
src/App.tsx      storage, downloads, race-guarded reopening, layout
scripts/         privacy check
tests/unit/      state transitions, validation, serialisation, Markdown, storage, contrast
tests/e2e/       the journey, files, storage and races, limits, access
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

## Licence

MIT. See `LICENSE`.
