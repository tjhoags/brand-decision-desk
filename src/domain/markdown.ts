/**
 * The Markdown handoff.
 *
 * Every piece of user text is written as data: short values as inline code with
 * a delimiter longer than any backtick run inside them, longer values as fenced
 * blocks with a fence longer than any run inside them. A reason that begins
 * "## Approved by legal" therefore reads as the text someone typed, not as a
 * section this document is asserting. Headings, tables and section order come
 * only from this file.
 *
 * Colour and type values are read from the presets in this build by id. No
 * value from a file is ever interpolated into a CSS-looking line.
 */
import {
  CATEGORY_IDS,
  COPY_FIELDS,
  DIRECTION_IDS,
  FACT_FIELDS,
  type CategoryId,
  type Content,
  type CopyField,
  type DirectionId,
  type FactField,
} from './types';
import {
  CATEGORY_LABEL,
  DIRECTION_NAME,
  PALETTES,
  PRESET_VERSION,
  SCHEMA_VERSION,
  TYPE_CHARACTER,
  TYPOGRAPHY,
  VOICE_CHARACTER,
} from './presets';
import { acceptedDecision, findDecision, resolveCopy, reviewFor, staleMentions } from './state';

const FACT_LABEL: Record<FactField, string> = {
  name: 'Business name',
  what: 'What it is',
  who: 'Who it is for',
  offer: 'What is offered',
};

const COPY_LABEL: Record<CopyField, string> = {
  headline: 'Homepage headline',
  supportingLine: 'Homepage supporting line',
  ctaWording: 'Call-to-action wording',
  emailSubject: 'Email subject',
  emailBody: 'Email body',
};

function longestBacktickRun(text: string): number {
  let longest = 0;
  let current = 0;
  for (const char of text) {
    if (char === '`') {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

/** A fenced block whose fence is always longer than anything inside it. */
export function safeBlock(text: string): string {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
  return `${fence}text\n${text}\n${fence}`;
}

/** An inline code span, falling back to a block when the text has line breaks. */
export function safeInline(text: string): string {
  if (text.length === 0) return '_(empty)_';
  if (/[\r\n]/.test(text)) return `\n\n${safeBlock(text)}\n`;
  const ticks = '`'.repeat(longestBacktickRun(text) + 1);
  const pad = text.startsWith('`') || text.endsWith('`') || text.startsWith(' ') || text.endsWith(' ') ? ' ' : '';
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

/** Escapes a value going into a table cell, where a block is not available. */
export function safeCell(text: string): string {
  const oneLine = text.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (oneLine.length === 0) return '_(empty)_';
  const clipped = oneLine.length > 90 ? `${oneLine.slice(0, 89)}…` : oneLine;
  const ticks = '`'.repeat(longestBacktickRun(clipped) + 1);
  const escaped = clipped.replace(/\|/g, '\\|');
  const pad = escaped.startsWith('`') || escaped.endsWith('`') ? ' ' : '';
  return `${ticks}${pad}${escaped}${pad}${ticks}`;
}

function paletteLines(option: DirectionId): string[] {
  const p = PALETTES[option];
  return [
    `- Page background \`${p.pageBg}\`, text \`${p.ink}\`, secondary text \`${p.mutedInk}\`, hairline \`${p.line}\``,
    `- Hero background \`${p.heroBg}\`, hero text \`${p.heroInk}\`, hero supporting text \`${p.heroMutedInk}\`, hero label \`${p.heroEyebrowInk}\``,
    `- Detail band \`${p.bandBg}\` with text \`${p.bandInk}\` and labels \`${p.bandLabelInk}\``,
    `- Call-to-action \`${p.ctaBg}\` with text \`${p.ctaInk}\``,
    `- Decorative fills, never behind text: rule \`${p.heroRule}\`, accent \`${p.decorFill}\``,
  ];
}

function typeLines(option: DirectionId): string[] {
  const t = TYPOGRAPHY[option];
  return [
    `- ${TYPE_CHARACTER[option]}`,
    `- Headings: \`${t.headingFamily}\` at weight ${t.headingWeight}, tracking \`${t.headingTracking}\`, line height \`${t.headingLeading}\``,
    `- Body: \`${t.bodyFamily}\`, line height \`${t.bodyLeading}\``,
    `- Labels: \`${t.labelFamily}\`, ${t.labelTransform === 'uppercase' ? 'uppercase' : 'sentence case'}, tracking \`${t.labelTracking}\``,
    `- Corner radius \`${t.radius}\`, rule weight \`${t.ruleWeight}\``,
  ];
}

function voiceLines(option: DirectionId): string[] {
  return [`- ${VOICE_CHARACTER[option]}`];
}

function tokenLines(category: CategoryId, option: DirectionId): string[] {
  switch (category) {
    case 'palette':
      return paletteLines(option);
    case 'typography':
      return typeLines(option);
    case 'voice':
      return voiceLines(option);
  }
}

function reviewSentence(changed: FactField[], draftChanged: boolean): string {
  const parts: string[] = [];
  if (changed.length > 0) parts.push(`the brief changed (${changed.map((f) => FACT_LABEL[f].toLowerCase()).join(', ')})`);
  if (draftChanged) parts.push('the draft copy for this voice changed');
  return parts.join(' and ');
}

export interface MarkdownOptions {
  exportedAt: string;
  /** Undo steps carried in the companion JSON, for the closing note. */
  historySteps: number;
}

export function buildMarkdown(content: Content, options: MarkdownOptions): string {
  const out: string[] = [];
  const day = options.exportedAt.slice(0, 10);

  out.push('# Brand decision brief');
  out.push('');
  out.push(
    `Written ${day} from the Brand Decision Desk, a browser-only worksheet. ` +
      'It records what was chosen and why. Nothing here has been published, sent or launched, ' +
      'and the previews it came from are illustrations, not a live site or a real email.',
  );
  out.push('');
  out.push(`Preset set ${PRESET_VERSION}, file schema ${SCHEMA_VERSION}.`);
  out.push('');

  /* ------------------------------------------------------------- at a glance */
  out.push('## Where the decisions stand');
  out.push('');
  out.push('| Component | Accepted | Standing | Options still open | Options rejected |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const category of CATEGORY_IDS) {
    const accepted = acceptedDecision(content, category);
    const review = accepted ? reviewFor(content, accepted) : null;
    const open = DIRECTION_IDS.filter((o) => findDecision(content, category, o).status === 'open');
    const rejected = DIRECTION_IDS.filter((o) => findDecision(content, category, o).status === 'rejected');
    const standing = !accepted
      ? 'Not chosen yet'
      : review && review.needsReview
        ? 'Needs review'
        : 'Current';
    out.push(
      `| ${CATEGORY_LABEL[category]} | ${accepted ? DIRECTION_NAME[accepted.option] : '-'} | ${standing} | ` +
        `${open.length > 0 ? open.map((o) => DIRECTION_NAME[o]).join(', ') : '-'} | ` +
        `${rejected.length > 0 ? rejected.map((o) => DIRECTION_NAME[o]).join(', ') : '-'} |`,
    );
  }
  out.push('');
  out.push(
    'A component with nothing accepted is an open question, not an oversight. ' +
      'A component marked "needs review" was accepted against an earlier brief and has not been reconfirmed since.',
  );
  out.push('');

  /* ------------------------------------------------------------------ facts */
  out.push('## The business facts these choices were made against');
  out.push('');
  out.push('These are the facts as entered in the worksheet. They are the user’s statements, reproduced as typed.');
  out.push('');
  for (const field of FACT_FIELDS) {
    out.push(`- **${FACT_LABEL[field]}:** ${safeInline(content.facts[field])}`);
  }
  out.push('');

  /* -------------------------------------------------------------- accepted */
  out.push('## Accepted choices');
  out.push('');
  const acceptedList = CATEGORY_IDS.map((c) => ({ category: c, decision: acceptedDecision(content, c) })).filter(
    (entry) => entry.decision !== null,
  );
  if (acceptedList.length === 0) {
    out.push('Nothing has been accepted yet. Every component below is still an open question.');
    out.push('');
  } else {
    for (const { category, decision } of acceptedList) {
      if (!decision) continue;
      const review = reviewFor(content, decision);
      out.push(`### ${CATEGORY_LABEL[category]}: ${DIRECTION_NAME[decision.option]}`);
      out.push('');
      if (decision.context) {
        out.push(`Accepted ${decision.context.at.slice(0, 10)}.`);
        out.push('');
      }
      if (review.needsReview) {
        out.push(
          `**Needs review before this is treated as current.** Since it was accepted, ` +
            `${reviewSentence(review.changedFacts, review.draftChanged)}. ` +
            'The choice and the reason below are unchanged; only the approval is out of date.',
        );
        out.push('');
        if (decision.context) {
          out.push('It was approved against these facts:');
          out.push('');
          for (const field of review.changedFacts) {
            out.push(
              `- **${FACT_LABEL[field]}** was ${safeInline(decision.context.facts[field])} ` +
                `and is now ${safeInline(content.facts[field])}`,
            );
          }
          out.push('');
        }
      }
      if (decision.reason.trim().length > 0) {
        out.push('Reason given:');
        out.push('');
        out.push(safeBlock(decision.reason));
        out.push('');
      } else {
        out.push('No reason was written for this choice.');
        out.push('');
      }
      out.push(`What ${DIRECTION_NAME[decision.option]} means for ${CATEGORY_LABEL[category].toLowerCase()}:`);
      out.push('');
      out.push(...tokenLines(category, decision.option));
      out.push('');
    }
  }

  /* ------------------------------------------------------------------ open */
  out.push('## Still open');
  out.push('');
  const openRows: string[] = [];
  const openNotes: string[] = [];
  for (const category of CATEGORY_IDS) {
    for (const option of DIRECTION_IDS) {
      const decision = findDecision(content, category, option);
      if (decision.status !== 'open') continue;
      const hasNote = decision.reason.trim().length > 0;
      openRows.push(
        `- **${CATEGORY_LABEL[category]} / ${DIRECTION_NAME[option]}** - no decision recorded.` +
          (hasNote ? ' A note was kept; it is quoted below.' : ''),
      );
      if (hasNote) {
        openNotes.push(`**${CATEGORY_LABEL[category]} / ${DIRECTION_NAME[option]}**`);
        openNotes.push('');
        openNotes.push(safeBlock(decision.reason));
        openNotes.push('');
      }
    }
  }
  if (openRows.length === 0) {
    out.push('Every option in every component has been either accepted or rejected.');
    out.push('');
  } else {
    out.push(...openRows);
    out.push('');
    if (openNotes.length > 0) {
      out.push('Notes kept on options that are still open:');
      out.push('');
      out.push(...openNotes);
    }
  }

  /* -------------------------------------------------------------- rejected */
  out.push('## Reactions to options that were rejected');
  out.push('');
  out.push(
    '> These are reactions to these options for this brief, recorded on the day. ' +
      'They are not a judgement about the direction anywhere else, and rejecting one component ' +
      'of a direction says nothing about its other components.',
  );
  out.push('');
  const rejectedRows: string[] = [];
  for (const category of CATEGORY_IDS) {
    for (const option of DIRECTION_IDS) {
      const decision = findDecision(content, category, option);
      if (decision.status !== 'rejected') continue;
      rejectedRows.push(`### ${CATEGORY_LABEL[category]}: ${DIRECTION_NAME[option]} - rejected`);
      rejectedRows.push('');
      if (decision.reason.trim().length > 0) {
        rejectedRows.push('Reason given:');
        rejectedRows.push('');
        rejectedRows.push(safeBlock(decision.reason));
      } else {
        rejectedRows.push('No reason was written.');
      }
      rejectedRows.push('');
    }
  }
  if (rejectedRows.length === 0) {
    out.push('Nothing has been rejected.');
    out.push('');
  } else {
    out.push(...rejectedRows);
  }

  /* ----------------------------------------------------------- draft copy */
  out.push('## Draft copy');
  out.push('');
  out.push(
    'Draft wording for the previews, kept separately for each direction. ' +
      'It is draft text written in the worksheet, not a verified statement about the business, ' +
      'and square brackets mark blanks that were deliberately left to fill in.',
  );
  out.push('');
  for (const voice of DIRECTION_IDS) {
    const copy = resolveCopy(content, voice);
    const written = COPY_FIELDS.filter((f) => content.drafts[voice].fields[f] !== undefined);
    const stale = staleMentions(content, voice);
    out.push(`### ${DIRECTION_NAME[voice]} voice`);
    out.push('');
    out.push(
      written.length === 0
        ? 'All preset wording; nothing was rewritten here.'
        : `Rewritten by hand: ${written.map((f) => COPY_LABEL[f].toLowerCase()).join(', ')}. The rest is preset wording.`,
    );
    out.push('');
    if (stale.length > 0) {
      for (const mention of stale) {
        out.push(
          `**Check this wording.** It still contains ${safeInline(mention.was)}, ` +
            `but ${FACT_LABEL[mention.field].toLowerCase()} in the brief is now ${safeInline(mention.now)} ` +
            `(in ${mention.inFields.map((f) => COPY_LABEL[f].toLowerCase()).join(', ')}).`,
        );
      }
      out.push('');
    }
    for (const field of COPY_FIELDS) {
      out.push(`**${COPY_LABEL[field]}**${written.includes(field) ? ' (written by hand)' : ''}`);
      out.push('');
      out.push(safeBlock(copy[field]));
      out.push('');
    }
  }

  /* -------------------------------------------------------- closing honesty */
  out.push('## What this brief does not say');
  out.push('');
  out.push('- It does not say the brand is finished. Open components are still open.');
  out.push(
    '- It does not verify any statement about the business. Facts and draft copy are as typed into the worksheet.',
  );
  out.push('- It does not record a price, a schedule, an address or a contact, because the worksheet holds none.');
  out.push(
    '- The previews it came from are illustrations built from these presets. No site was published and no email was sent.',
  );
  out.push(
    `- The companion JSON file carries the same decisions plus ${options.historySteps} undo ${
      options.historySteps === 1 ? 'step' : 'steps'
    }, and is the file to reopen in the desk.`,
  );
  out.push('');

  return out.join('\n');
}
