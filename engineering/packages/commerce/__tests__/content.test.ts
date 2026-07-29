import { describe, it, expect } from 'vitest';
import {
  LANDING_CONTENT,
  allLandingStrings,
  findUnsupportedClaims,
} from '../src/content/cta.js';
import { SOVEREIGNTY_POSTURE } from '../src/boundary/sovereignty.js';
import { buildReferenceChallenges } from '../src/boundary/challenges.js';
import { buildConversionJourney } from '../src/conversion/journey.js';
import { roverGraph } from './helpers.js';

describe('Gate 9 — landing content', () => {
  it('carries the specified primary and supporting messages', () => {
    expect(LANDING_CONTENT.primaryMessage).toBe('Build it virtually. Order it when it works.');
    expect(LANDING_CONTENT.supportingMessage).toMatch(/before purchasing hardware/);
    expect(LANDING_CONTENT.primaryCta).toBe('Start Building Virtually');
    expect(LANDING_CONTENT.secondaryCta).toBe('Explore Ready-to-Build Kits');
  });

  it('introduces the challenge section without revealing how builds are made', () => {
    expect(LANDING_CONTENT.challengeSectionBlurb)
      .toMatch(/says what the build can do, never how it was made/);
  });

  it('describes sovereignty in terms of what the code actually does', () => {
    const points = LANDING_CONTENT.sovereigntyPoints.join(' ');
    expect(points).toMatch(/one-way code/);
    expect(points).toMatch(/cannot show you a design we were never sent/);
  });
});

describe('Gate 9 — claim guard', () => {
  it('catches certification and standing claims', () => {
    for (const text of [
      'A certified classroom kit',
      'This design is validated',
      'Production-ready hardware',
      'Child-safe by design',
    ]) {
      expect(findUnsupportedClaims(text).length, text).toBeGreaterThan(0);
    }
  });

  it('catches invented social proof', () => {
    expect(findUnsupportedClaims('Trusted by 10,000 engineers').length).toBeGreaterThan(0);
    expect(findUnsupportedClaims('Read our customers testimonial').length).toBeGreaterThan(0);
  });

  it('catches unsupportable absolutes about security', () => {
    // The architecture is strong, but no software can promise these.
    for (const text of [
      'Your data is immune to scraping',
      'Absolutely secure by design',
      'An unhackable cartridge',
      '100% private',
    ]) {
      expect(findUnsupportedClaims(text).length, text).toBeGreaterThan(0);
    }
  });

  it('explains why each finding is a problem', () => {
    for (const finding of findUnsupportedClaims('A certified, guaranteed, immune product')) {
      expect(finding.why.length).toBeGreaterThan(0);
    }
  });

  it('lets a term be denied rather than claimed', () => {
    // Disclaimers are the point. A guard that fired on these would push
    // authors to delete the honest wording.
    for (const text of [
      'Nothing in this configuration is certified.',
      'No design here has been validated.',
      'This kit is not production-ready.',
      'We make no guarantee about range.',
      'Your data is not immune to anything you upload elsewhere.',
    ]) {
      expect(findUnsupportedClaims(text), text).toEqual([]);
    }
  });

  it('still catches a claim that follows a denial in a separate sentence', () => {
    // A negation in one sentence must not excuse a claim in the next.
    const text = 'Nothing is sourced yet. This kit is certified.';
    expect(findUnsupportedClaims(text).map(f => f.match)).toContain('certified');
  });

  it('leaves defensible wording alone', () => {
    for (const text of [
      'Your design stays on your machine.',
      'Build it virtually. Order it when it works.',
      'The code says what the build can do, never how it was made.',
      'No component has been sourced.',
    ]) {
      expect(findUnsupportedClaims(text), text).toEqual([]);
    }
  });

  it('reports findings in a stable order', () => {
    const findings = findUnsupportedClaims('immune certified guaranteed');
    expect(findings.map(f => f.match)).toEqual([...findings.map(f => f.match)].sort());
  });
});

describe('Gate 9 — every emitted string is clean', () => {
  it('passes the guard over all landing copy', () => {
    for (const text of allLandingStrings()) {
      expect(findUnsupportedClaims(text), text).toEqual([]);
    }
  });

  it('passes the guard over the sovereignty posture', () => {
    const strings = [
      ...SOVEREIGNTY_POSTURE.crossesToPlatform,
      ...SOVEREIGNTY_POSTURE.crossesToOtherVisitors,
      ...SOVEREIGNTY_POSTURE.neverCrosses,
      ...SOVEREIGNTY_POSTURE.notes,
    ];
    for (const text of strings) {
      expect(findUnsupportedClaims(text), text).toEqual([]);
    }
  });

  it('passes the guard over every challenge card', () => {
    for (const card of buildReferenceChallenges()) {
      expect(findUnsupportedClaims(card.prompt), card.prompt).toEqual([]);
      expect(findUnsupportedClaims(card.goalProductName)).toEqual([]);
    }
  });

  it('passes the guard over the offer disclosures and blocked reasons', () => {
    const offer = buildConversionJourney(roverGraph()).offer;
    for (const text of offer.disclosures) {
      expect(findUnsupportedClaims(text), text).toEqual([]);
    }
    for (const blocked of offer.blockedActions) {
      expect(findUnsupportedClaims(blocked.reason), blocked.reason).toEqual([]);
    }
  });

  it('passes the guard over every next-step reason', () => {
    for (const step of buildConversionJourney(roverGraph(), 'creator').nextSteps) {
      expect(findUnsupportedClaims(step.reason), step.reason).toEqual([]);
    }
  });
});
