/**
 * Landing-page copy, held as configuration so it stays under version control
 * and under test.
 *
 * The primary and supporting messages are transcribed from the product
 * specification. The sovereignty lines describe what the architecture actually
 * does — each one corresponds to something enforced in `boundary/sovereignty.ts`
 * — and deliberately stop short of claiming anything about what happens to the
 * user's files outside this software.
 */
export interface LandingContent {
  primaryMessage: string;
  supportingMessage: string;
  primaryCta: string;
  secondaryCta: string;
  challengeSectionTitle: string;
  challengeSectionBlurb: string;
  sovereigntyPoints: string[];
}

export const LANDING_CONTENT: LandingContent = {
  primaryMessage: 'Build it virtually. Order it when it works.',
  supportingMessage:
    'Connect controllers, batteries, sensors, motors, and interfaces. Explore what '
    + 'products your configuration can become before purchasing hardware.',
  primaryCta: 'Start Building Virtually',
  secondaryCta: 'Explore Ready-to-Build Kits',
  challengeSectionTitle: 'Open Builds',
  challengeSectionBlurb:
    'Every build has a short code. Share yours and someone else can try to reach the '
    + 'same result their own way. The code says what the build can do, never how it '
    + 'was made.',
  sovereigntyPoints: [
    'Your design stays on your machine. This site is where you learn about the tool '
    + 'and buy it, not where your work lives.',
    'Sharing a build sends a one-way code. It cannot be turned back into your design.',
    'Two builds match when they reach the same capabilities, so a code can be checked '
    + 'without either design being sent anywhere.',
    'We cannot show you a design we were never sent.',
  ],
};

/**
 * Language the project constraints forbid.
 *
 * Two groups: claims about certification or standing that no evidence supports,
 * and absolutes that overstate what any software can promise. Both are treated
 * the same way — as something that must not ship in copy.
 */
const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\bcertified\b/i, why: 'no certification has been obtained' },
  { pattern: /\bchild[- ]safe\b/i, why: 'no safety assessment has been made' },
  { pattern: /\bclassroom[- ]safe\b/i, why: 'no safety assessment has been made' },
  { pattern: /\bproduction[- ]ready\b/i, why: 'nothing has been validated for production' },
  { pattern: /\bvalidated\b/i, why: 'no design here has been validated against hardware' },
  { pattern: /\bguarantee(d|s)?\b/i, why: 'no guarantee is backed by evidence' },
  { pattern: /\bproven\b/i, why: 'nothing has been proven' },
  { pattern: /\btrusted by\b/i, why: 'there are no users to cite' },
  { pattern: /\btestimonial/i, why: 'there are no testimonials' },
  { pattern: /\bcustomers\b/i, why: 'there are no customers to cite' },
  { pattern: /\bimmune\b/i, why: 'immunity is an absolute no software can support' },
  { pattern: /\babsolute(ly)? (secure|private|safe)\b/i, why: 'an unsupportable absolute' },
  { pattern: /\bunhackable\b/i, why: 'an unsupportable absolute' },
  { pattern: /\bimpossible to (hack|breach|access)\b/i, why: 'an unsupportable absolute' },
  { pattern: /\b100% (secure|private|safe)\b/i, why: 'an unsupportable absolute' },
];

export interface ClaimFinding {
  match: string;
  why: string;
}

/** Words that turn a forbidden term into a denial of it. */
const NEGATORS = /\b(no|not|nothing|never|none|without|cannot|can't|isn't|aren't|nor)\b/i;

/**
 * Whether the term is being denied rather than asserted.
 *
 * "Nothing here is certified" must pass. A guard that fired on denials would
 * push authors to delete the very disclaimers the project depends on, which
 * would make the copy less honest rather than more.
 */
function isDenied(text: string, matchIndex: number): boolean {
  // Look back to the start of the current sentence only, so a negation in one
  // sentence cannot excuse a claim in the next.
  const sentenceStart = Math.max(
    text.lastIndexOf('.', matchIndex - 1),
    text.lastIndexOf('!', matchIndex - 1),
    text.lastIndexOf('?', matchIndex - 1),
  );
  const clause = text.slice(sentenceStart + 1, matchIndex);
  return NEGATORS.test(clause);
}

/**
 * Scan copy for claims the project cannot support.
 *
 * Run over every string this package can emit, so a later copy edit that
 * smuggles in a claim fails the suite instead of reaching a landing page.
 */
export function findUnsupportedClaims(text: string): ClaimFinding[] {
  const findings: ClaimFinding[] = [];

  for (const { pattern, why } of FORBIDDEN_PATTERNS) {
    // Fresh regex per scan so lastIndex never leaks between calls.
    const scanner = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    let match = scanner.exec(text);

    while (match !== null) {
      if (!isDenied(text, match.index)) {
        findings.push({ match: match[0], why });
        break;
      }
      match = scanner.exec(text);
    }
  }

  return findings.sort((a, b) => (a.match < b.match ? -1 : a.match > b.match ? 1 : 0));
}

/** Every string this module can put in front of a reader. */
export function allLandingStrings(): string[] {
  return [
    LANDING_CONTENT.primaryMessage,
    LANDING_CONTENT.supportingMessage,
    LANDING_CONTENT.primaryCta,
    LANDING_CONTENT.secondaryCta,
    LANDING_CONTENT.challengeSectionTitle,
    LANDING_CONTENT.challengeSectionBlurb,
    ...LANDING_CONTENT.sovereigntyPoints,
  ];
}
