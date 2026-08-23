import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRevisionChange, evaluateCampaign } from '../apps/web/src/lib/campaign/decision-engine.mjs';

function omniBase() {
  return {
    decisionScope: 'OMNI_DUTY', currentRevisionId: 'OMNI-R1',
    dependencies: [{ id: 'ROLLERS', name: 'Rollers' }, { id: 'TRACTION', name: 'Traction' }],
    componentRevisions: [{ id: 'OMNI-R1' }, { id: 'OMNI-R2' }, { id: 'ROLLER-R1' }, { id: 'ROLLER-R2' }],
    requirements: [
      { id: 'REQ-LATERAL', dependencyId: 'ROLLERS', critical: true, conditionalAllowed: true, claimScope: 'OMNI_DUTY', testIds: ['T-LATERAL'] },
      { id: 'REQ-TRACTION', dependencyId: 'TRACTION', critical: true, conditionalAllowed: false, claimScope: 'OMNI_DUTY', testIds: ['T-TRACTION'] },
      { id: 'REQ-ENDURANCE', dependencyId: 'ROLLERS', critical: true, conditionalAllowed: true, claimScope: 'OMNI_DUTY', testIds: ['T-ENDURANCE'] },
    ],
    tests: [
      { id: 'T-LATERAL', dependencyIds: ['ROLLERS'], status: 'FAIL', requiredEvidenceIds: ['EV-LATERAL'] },
      { id: 'T-TRACTION', dependencyIds: ['TRACTION'], status: 'PASS', requiredEvidenceIds: ['EV-TRACTION'] },
      { id: 'T-ENDURANCE', dependencyIds: ['ROLLERS'], status: 'READY', requiredEvidenceIds: [] },
    ],
    evidence: [
      { id: 'EV-LATERAL', state: 'REVIEWED', boundRevisionIds: ['OMNI-R1', 'ROLLER-R1'], validityKeys: ['roller-profile'] },
      { id: 'EV-TRACTION', state: 'REVIEWED', boundRevisionIds: ['OMNI-R1', 'ROLLER-R1'], validityKeys: ['roller-profile'] },
    ],
    measurements: [{ id: 'M-1', testId: 'T-TRACTION', metric: 'force', value: 18.6, unit: 'N' }], failures: [],
  };
}

test('omni-wheel duty stays conditional when a conditional criterion fails and endurance is incomplete', () => {
  const result = evaluateCampaign(omniBase());
  assert.equal(result.decision, 'CONDITIONALLY_SUPPORTED');
  assert.equal(result.counts.failedConditional, 1);
  assert.equal(result.counts.incompleteCritical, 1);
});

test('omni-wheel acceptance reaches SUPPORT only after every critical requirement passes', () => {
  const data = omniBase(); data.tests[0].status = 'PASS'; data.tests[2].status = 'PASS'; data.tests[2].requiredEvidenceIds = ['EV-ENDURANCE'];
  data.evidence.push({ id: 'EV-ENDURANCE', state: 'REVIEWED', boundRevisionIds: ['OMNI-R1'], validityKeys: ['test-configuration'] });
  assert.equal(evaluateCampaign(data).decision, 'SUPPORTED');
});

test('roller profile revision invalidates evidence whose validity depends on the changed attribute', () => {
  const data = omniBase(); data.tests[0].status = 'PASS';
  const changed = applyRevisionChange(data, { id: 'EC-ROLLER', fromRevisionId: 'ROLLER-R1', toRevisionId: 'ROLLER-R2', machineRevisionId: 'OMNI-R2', changedAttributes: ['roller-profile'], reason: 'roller profile changed' });
  assert.deepEqual(changed.revisionImpact.affectedEvidenceIds.sort(), ['EV-LATERAL', 'EV-TRACTION']);
  assert.ok(changed.revisionImpact.affectedTestIds.includes('T-TRACTION'));
});

test('reference omni-wheel data remains unavailable until independently measured or verified', () => {
  const comparator = { metric: 'lateral rolling resistance', candidateValue: 3.8, unit: 'N', state: 'FIXTURE' };
  assert.equal(comparator.referenceValue, undefined);
});
