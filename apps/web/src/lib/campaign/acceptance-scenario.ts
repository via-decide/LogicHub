import type { CampaignFixture, Evidence, TestRecord } from './contracts';

const LEGACY_TRACTOR_PASS = ['SLOPE-01', 'PTO-01', 'CONT-01'];

export function makeAcceptanceBaseline(fixture: CampaignFixture): CampaignFixture {
  const scenario = fixture.acceptanceScenario ?? {
    title: 'SUPPORTED → revision change → REVIEW_REQUIRED / CONDITIONAL',
    detail: 'Legacy tractor acceptance fixture.',
    passTestIds: LEGACY_TRACTOR_PASS,
    revisionSensitiveTestIds: ['CONT-01'],
  };
  const passSet = new Set(scenario.passTestIds);
  const sensitiveSet = new Set(scenario.revisionSensitiveTestIds ?? []);
  const change = fixture.changes[0];
  const evidence = fixture.evidence.map((item) => ({ ...item, boundRevisionIds: [...item.boundRevisionIds], validityKeys: [...item.validityKeys] }));
  const tests: TestRecord[] = fixture.tests.map((test) => {
    if (!passSet.has(test.id)) return { ...test, requiredEvidenceIds: [...test.requiredEvidenceIds] };
    const id = `EV-ACCEPT-${test.id}`;
    const existing = evidence.find((item) => item.id === id);
    if (!existing) {
      const sensitive = sensitiveSet.has(test.id) && change;
      const item: Evidence = {
        id,
        type: 'TEST_REPORT',
        source: 'Acceptance scenario fixture',
        sha256: `ac${id.replace(/[^A-Z0-9]/gi, '').toLowerCase().padEnd(62, '0').slice(0, 62)}`,
        timestamp: fixture.campaign.lastEvidenceUpdate,
        testId: test.id,
        revisionId: sensitive ? change.fromRevisionId : fixture.currentRevisionId,
        boundRevisionIds: sensitive ? [change.fromRevisionId, test.configurationRevisionId] : [fixture.currentRevisionId, test.configurationRevisionId],
        validityKeys: sensitive ? [...change.changedAttributes] : ['acceptance-fixture'],
        state: 'REVIEWED',
        reviewState: 'REVIEWED',
        artifactPath: `fixture://acceptance/${id}`,
        provenance: { owner: 'FIXTURE', sourceId: id, fixture: true },
      };
      evidence.push(item);
    }
    return { ...test, status: 'PASS', result: 'PASS', requiredEvidenceIds: [id], observation: 'SIMULATED ACCEPTANCE OBSERVATION: configured criterion passed.', interpretation: 'SIMULATED ACCEPTANCE INTERPRETATION: fixture closes the declared test gap only.', review: 'FIXTURE ACCEPTANCE RECORD — not laboratory approval.' };
  });
  return {
    ...fixture,
    campaign: { ...fixture.campaign }, claim: { ...fixture.claim }, tests, evidence,
    failures: fixture.failures.map((failure) => ({ ...failure, status: 'CLOSED' })),
  };
}
