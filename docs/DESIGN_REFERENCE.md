# Design reference - reviewed for implementation

One responsive workspace, with quiet warm-white chrome and large expressive homepage/email preview. Reference prototype completed and visually inspected at desktop. Treat this document and IMPLEMENTATION_BRIEF.md as the corrected handoff; do not transplant prototype JavaScript.

## Visual tokens

Chrome: paper #F7F6F3, card #FFFFFF, ink #1B1A17, secondary ink #3A3733, muted #5E5A53, line #E4E0D8, strong line #C9C2B4. Review warning #8A5A17 on #FAF1E0, border #E8D6AF. Card radius 8px, controls 5px, tab 7px, pill999px. System sans UI; system mono labels. Labels 11px bold with moderate tracking, not illegible. Controls at least40px/44px touch; 2px visible focus.

Quarterdeck: paper #F2EDE4, slate #1E2A32, brass #A8823C for decorative fill, darker #7D5F22 for text on light ground. Georgia/Iowan headings with system sans. Strong dark hero, crisp geometry.
Open Harbor: #FBF6EE paper, #14453F dark teal, #E06A4E coral decorative fill only. Rounded system sans, 18px corners, welcoming open composition.
Ledger: #FCFCFB paper, #16161A ink, #B7862B ochre fill, #8A6318 text on light ground. System sans/mono labels, zero-radius editorial grid.

Check actual contrast role combinations; these tokens are not permission to use dark text accent on dark hero backgrounds. Mixed component previews must use safe palette roles consistently.

## Hierarchy

TopBar: name, short job description, opt-in saving/status, undo, export/reopen.
Workspace: BusinessBrief, Stage, DecisionRecord.
Brief: editable business facts with clearly fictional initial sample; separate editable draft copy.
Stage: three direction cards with swatches/name/character; preview-only label; homepage/email toggle; large applied composition; explicit selected palette/type/voice controls for mixed preview.
Record: accepted choice summary; review warning; three slots, three options each; status, reason, explicit reconfirm. Preview selection and acceptance use different wording and treatment.
Export/reopen: actual downloads, validation errors, and truthful local storage controls.

Prototype used326/1fr/388px columns above1240px, brief across top below1240, single column under900. Improve this: preserve more room for the stage and avoid a cramped narrow hero. Consider260/1fr/300px sidepanels on wide displays, and tabs/details for draft editing. Keep min-width:0 and wrap safely. Every control must remain usable at390px.

## Required corrections to prototype

1. Prototype intentionally does not render mixed accepted components. Build MUST show the user's independent palette/type/voice preview choices together and clearly distinguish what is accepted from what is only previewed. A Preview accepted choices action can make the relationship explicit; missing accepted slots remain open, not fabricated.
2. Prototype drafts invented provided materials, hour duration, a new class forming and a reserved place on reply. Omit those. Use only the stated fictional facts, draft tone and explicit placeholders where unavoidable. Prefer neutral helpful copy without operational promises. Business fact changes must not leave unmarked incompatible fixed sample claims.
3. Prototype says draft-copy edits flag nothing. Build should flag an accepted voice choice when relevant draft content changes, preserving its reason and approval context.
4. Prototype export offers textareas instead of actual downloads. Build downloads real JSON/Markdown and reopens real files. Import validates all nested state/history and versions before replacing anything.
5. Prototype boolean review flag and storage claims are not verification. Implement source-context comparison, no-op handling, accurate saved/deletion failure behavior, startup restoration and read-race protection per brief.
6. Use bounded full-state undo including reasons and review context, retained in the portable JSON. Export only validates what the schema can truthfully restore.

No external assets, private source materials or claims of novelty. Curated presets, not AI generation. Preview is not a launched website or sent email.
