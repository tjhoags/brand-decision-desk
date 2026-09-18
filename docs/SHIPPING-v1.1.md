# Brand Decision Desk v1.1.0 - what shipped

September 18, 2026

[Use the desk](https://tjhoags.github.io/brand-decision-desk/) | [Source](https://github.com/tjhoags/brand-decision-desk) | [Release](https://github.com/tjhoags/brand-decision-desk/releases/tag/v1.1.0)

## 1. Technical

This release adds controlled comparisons and explicitly scoped preferences to the existing browser-only worksheet.

### Behavior

- **Compare one thing:** palette, typography treatment or voice. Both examples share the business facts, surface and other two axes. The typography presets vary type and geometry together, so the interface calls this a treatment rather than a font-only test.
- **Choose, then save deliberately:** choosing an example changes the preview only. Saving a preference requires the user's own explanation and a selected scope: this example on this surface, or this project's customer-facing work. Category accept/reject decisions are unaffected.
- **Preserve evidence:** each preference stores the chosen and alternative directions, held axes, business facts, surface, rendered wording, statement, scope and recording time. It never becomes a global instruction or automatically filters future choices.
- **Review changed context:** relevant fact or copy changes flag an existing preference for review. The original evidence stays intact. Removing a preference is undoable.
- **Portable output:** the Markdown brief explains each preference and its source context; the JSON worksheet retains the complete structured record and bounded undo history.

### Compatibility and limits

JSON schema 2 reads schema 1 files and existing browser saves forward, preserving decisions, reasons, approval context, draft overrides and retained history. A version 1.0 app cannot reopen schema 2 output. Keep an original version 1 file if an older app still needs it.

Each worksheet supports 20 preferences, 600 characters per explanation and 50 undo steps. Exports target 3 MiB and imports accept up to 4 MiB. Oldest history steps may be omitted to fit an export; the interface and file disclose this, and current content is retained.

No backend, login, model API, analytics, remote font, upload or background schedule was added. Data stays in the open browser unless the user enables browser saving or downloads a file. The repository contains fictional examples only. GitHub serves the application assets; it does not receive worksheet content through an application endpoint.

### Verification

- 185 unit tests, type checking, production build and source/bundle privacy scan pass.
- 147 Chromium browser tests pass; three tests are skipped only on the viewport to which they do not apply. The suite covers desktop and an emulated Pixel 7.
- Two genuine schema 1 fixtures are preserved. The independently captured fixture is compared field-for-field, including all five retained undo steps.
- Browser checks cover one-axis invariants, both comparison choices, explicit save/no-save, scoped export/reopen, storage failures, stale context, invalid imports, keyboard operation and phone layout.
- Release review fixed same-timestamp preference identity collisions, old choice state surviving a reopened comparison, inconsistent imported comparison evidence, and a Close control clipped on a short laptop viewport.
- Manual browser acceptance confirmed that choosing the second example saves it in the correct order, leaves category approvals open, and flags changed audience context while preserving the original explanation.

Chromium coverage is not a claim of testing every browser or assistive technology. The product uses three authored directions. It does not generate designs, infer personality, publish a user's website or validate a market opportunity. Reduced revision time and willingness to pay remain unmeasured.

## 2. Natural language

The desk already let you react to examples. This update helps you turn a reaction into something another person can use.

Open **Compare one thing**. Look at the same business with two different palettes, typography treatments or voices. The other choices stay steady, so you can make a useful comparison. Pick the example you prefer, write the reason in your own words, and say whether that preference belongs to this example or to the project's customer-facing work. You can also leave without recording anything.

The reason travels with the example. If you prefer a lighter palette because it feels more welcoming to beginners, that explanation stays attached to the business, audience and wording you were looking at. Change the audience later and the desk asks you to review the preference. It does not quietly pretend the old decision was made for the new situation.

Download the brief to share the reasoning with a designer or assistant. Download the worksheet to reopen the work, including its preferences and retained undo steps. Existing version-one worksheets still open in the upgraded desk.

## 3. Product explanation - writing-style draft

“Make it more premium” sounds like direction until somebody has to build from it.

Premium how? Quieter color? Less sales copy? More space? Three people can hear the same sentence, agree with it, and walk away planning three different websites. The revision bill shows up later.

Brand Decision Desk gives that conversation something concrete to work with. Put the same business in two examples, change one thing, and explain which you prefer. Then keep the example, the reason and the scope together. “This works better for this page” should not become “I never want to see that style again.”

There is a difference between remembering a decision and understanding the conditions under which it made sense. If the audience changes, the old preference may still be useful. It just deserves another look. Silently carrying it forward as permanent law is how a helpful system starts working against the person using it.

The point is to preserve the judgment without pretending the software has read your mind. A better brief is useful because someone can act on it - and because you can come back tomorrow, see why you made the decision, and change it without starting the conversation over.

That is the proposition. Whether it reduces real revision time still needs to be measured with people using it.
