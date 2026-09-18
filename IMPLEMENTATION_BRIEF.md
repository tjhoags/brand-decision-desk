# Brand Decision Desk - implementation contract

Build a useful polished local worksheet that turns visual reactions into explicit design choices and a portable decision brief. Curated presets, not AI generation. Existing tools already support brand kits, visual boards, rationale, applied previews and exports. Do not claim unique capability, customer demand or revenue.

## User journey

Open a clearly fictional Halyard Studio example: small-group drawing workshops for adults; audience beginners who want a relaxed way to practice; offering in-person drawing classes. Business name, description, audience and offering are editable facts. Preview copy is separately editable draft text, never a verified business claim. No prices, testimonials, outcomes, guarantees, real addresses or contacts. User can replace facts and text without stale fictional claims surviving invisibly in exports.

Compare three original directions: Quarterdeck (deep slate, warm paper, brass, Georgia headings/system sans, crisp), Open Harbor (warm paper, dark teal, coral detail, rounded system sans, soft), Ledger (near-white, ink, ochre, editorial grid, system sans/mono labels). Composition, type and voice differ meaningfully. System fonts and original CSS shapes only. No logo generation.

Provide a quiet workspace around a large stage. Homepage and customer-email previews are explicitly illustrative, never sent or launched. In-preview CTA text is presentation, not a misleading active app control. The actual workspace controls work. Desktop can use side panels; phone must stack or tab without clipping. Show a quick useful example immediately, not a wizard.

## State semantics

There are three component categories: palette, typography, voice. Each offers the three authored directions. Users can preview a coordinated direction, or mix component choices explicitly. Preview selection does not accept any option. Each category/option has open, accepted or rejected status plus optional reason. At most one option per category is accepted. Accepting another returns former accepted to open while retaining its reason. Rejecting one option never makes a universal rule or auto-rejects others. Render preview picks separately from accepted choices and show when they differ.

Accepted choices record the brief context at acceptance. A changed business fact marks previously accepted choices as needing review, with changed fields visible and choice/reason intact. Explicit reconfirm updates the approval context. Saving identical facts is a no-op. Returning to exactly the earlier facts may clear a derived review warning; document this behavior. Draft text changes should at least mark an accepted voice choice for review. Make draft-versus-preset behavior explicit: switching voice must not silently destroy user-written text. Prefer separate draft overrides that can be deliberately reset, with undo.

Use simple typed pure state transitions and bounded snapshot history rather than elaborate event infrastructure. Undo restores the exact prior content/choices/reasons/context and works after JSON reopening for exported retained history. Define and disclose a practical history limit such as 50 steps; do not silently drop current work to fit. Keep display-only tab changes out of content undo. Validated state sizes/limits must guarantee any offered JSON export can be reimported.

## Portability and storage

JSON export includes schema/preset versions, business facts, editable copy, preview picks, decisions/reasons, approval context and retained undo history. Reject unknown schema/preset versions, invalid enums/types, duplicate or missing decision keys, incoherent multiple acceptances, huge text/history and malformed structure. Use explicit field limits and a bounded file size. Parse/validate into a candidate before replace; invalid or unreadable input leaves current work and saved copy intact. Reopen control is explicit about replacing current work, without a repeated workflow approval gate. A slow older import cannot overwrite a newer import or newer edit.

Markdown is a readable handoff: facts; currently accepted choices/tokens and reasons; approvals needing review; rejected options as contextual reactions; unresolved choices; separate draft homepage/email copy. Preserve user text as data via safe quoted/fenced sections so malicious headings/backticks cannot produce false authoritative sections. Include CSS palette/type values only from validated presets, no untrusted CSS interpolation. Do not imply all choices are finalized.

Default state is in memory. Browser saving is explicit opt-in. Read/validate any existing stored session before first write; do not erase it on startup. Report saved only after successful write/readback. Error keeps in-memory work and offers export/retry. Disabling saving/deleting stored copy must handle failed removal truthfully. Invalid storage is not silently deleted. No external calls or uploads; initial same-origin JS/CSS assets allowed. JSON imports cannot execute code or provide URLs/styles outside controlled preset IDs.

## Quality and release

Readable contrast for real mixed combinations, clear focus, names/roles, keyboard controls, mobile at 390px and desktop. Avoid misleading all-accessible claims from one contrast ratio. No fake buttons. Accessible errors/status, empty/no-op states and explicit review-needed badges. Respect reduced motion.

Node 24, npm lockfile; npm run check for unit/type/build/privacy; npm run test:e2e for Chromium desktop/mobile. Real browser downloads reparsed; storage failures, malformed import, undo/reopen, stale async reads, review context, escaping and all three directions exercised. No real personal data. MIT license, meaningful README, CI, and Pages workflow at base /brand-decision-desk/. CI may run on push; leave Pages activation/public visibility/release to owner. No PR, check-in, schedule or subscription. Stop after completed branch push and concise evidence report.
