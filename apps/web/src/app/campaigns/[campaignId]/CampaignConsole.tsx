'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { CampaignFixture, Evidence, Failure, Measurement, TestRecord } from '@/lib/campaign/contracts';
import { makeAcceptanceBaseline } from '@/lib/campaign/tractor-fixture';
import { aggregateDependencies, applyRevisionChange, evaluateCampaign } from '@/lib/campaign/decision-engine.mjs';
import { DependencyGraph, MeasurementSeries, StatusBadge } from './CampaignVisuals';

type AggDependency = CampaignFixture['dependencies'][number] & {
  status: string; testCount: number; completedTestCount: number; evidenceCount: number; coveragePct: number;
};

const panel = 'rounded-xl border border-white/10 bg-zinc-950 p-4 md:p-5';
const label = 'text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500';
const mono = 'font-mono text-xs';
const input = 'rounded border border-white/10 bg-black px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-blue-400';

function FixtureMark() {
  return <span className="inline-flex rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-bold tracking-wide text-cyan-300">SIMULATED FIXTURE DATA</span>;
}

function KeyValue({ name, value, state }: { name: string; value: ReactNode; state?: string }) {
  return <div className="border-b border-white/5 py-2 last:border-0"><div className={label}>{name}</div><div className="mt-1 flex items-center gap-2 text-sm text-zinc-200">{value}{state && <StatusBadge state={state} compact />}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-white/10 p-4 text-sm text-zinc-500">{text}</div>;
}

function metric(measurements: Measurement[], metricName: string) {
  return measurements.find((item) => item.metric === metricName);
}

export default function CampaignConsole({ fixture }: { fixture: CampaignFixture }) {
  const [scenario, setScenario] = useState<'CURRENT' | 'ACCEPTANCE'>('CURRENT');
  const [revisionApplied, setRevisionApplied] = useState(false);
  const [selectedDependencyId, setSelectedDependencyId] = useState<string | null>('BATTERY');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(fixture.timeline.at(-1)?.id ?? null);
  const [testDependencyFilter, setTestDependencyFilter] = useState('ALL');
  const [testStatusFilter, setTestStatusFilter] = useState('ALL');
  const [testOperatorFilter, setTestOperatorFilter] = useState('ALL');
  const [testReviewerFilter, setTestReviewerFilter] = useState('ALL');
  const [testDateFilter, setTestDateFilter] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [evidenceStateFilter, setEvidenceStateFilter] = useState('ALL');
  const [evidenceRevisionFilter, setEvidenceRevisionFilter] = useState('ALL');
  const [failureSeverityFilter, setFailureSeverityFilter] = useState('ALL');

  const baseline = useMemo(() => scenario === 'ACCEPTANCE' ? makeAcceptanceBaseline() : fixture, [scenario, fixture]);
  const active = useMemo(() => {
    if (!revisionApplied) return baseline;
    return applyRevisionChange(baseline, baseline.changes[0]) as CampaignFixture & { revisionImpact?: { affectedEvidenceIds: string[]; affectedTestIds: string[] } };
  }, [baseline, revisionApplied]);
  const evaluation = useMemo(() => evaluateCampaign(active), [active]);
  const dependencyAggregate = useMemo(() => aggregateDependencies(active) as unknown as AggDependency[], [active]);

  const selectedDependency = dependencyAggregate.find((item) => item.id === selectedDependencyId) ?? dependencyAggregate[0];
  const selectedTest = active.tests.find((item) => item.id === selectedTestId) ?? null;
  const selectedEvidence = active.evidence.find((item) => item.id === selectedEvidenceId) ?? null;
  const selectedTimeline = active.timeline.find((item) => item.id === selectedTimelineId) ?? null;

  const filteredTests = active.tests.filter((test) => {
    const query = testSearch.trim().toLowerCase();
    return (testDependencyFilter === 'ALL' || test.dependencyIds.includes(testDependencyFilter))
      && (testStatusFilter === 'ALL' || test.status === testStatusFilter)
      && (testOperatorFilter === 'ALL' || test.operator === testOperatorFilter)
      && (testReviewerFilter === 'ALL' || test.reviewer === testReviewerFilter)
      && (!testDateFilter || test.date?.startsWith(testDateFilter))
      && (!query || `${test.id} ${test.name} ${test.result}`.toLowerCase().includes(query));
  });
  const filteredEvidence = active.evidence.filter((item) =>
    (evidenceStateFilter === 'ALL' || item.state === evidenceStateFilter)
    && (evidenceRevisionFilter === 'ALL' || item.boundRevisionIds.includes(evidenceRevisionFilter)),
  );
  const filteredFailures = active.failures.filter((item) => failureSeverityFilter === 'ALL' || item.severity === failureSeverityFilter);

  const testTotals = active.tests.reduce((acc, test) => {
    if (test.status === 'PASS') acc.pass += 1;
    else if (test.status === 'FAIL') acc.fail += 1;
    else if (test.status === 'STALE' || test.status === 'REVIEW_REQUIRED') acc.stale += 1;
    else acc.incomplete += 1;
    return acc;
  }, { pass: 0, fail: 0, stale: 0, incomplete: 0 });
  const criticalBlockers = active.failures.filter((failure) => failure.severity === 'CRITICAL' && !['CONTAINED', 'FIX_VERIFIED', 'CLOSED'].includes(failure.status)).length;

  const energy = metric(active.measurements, 'energy_rate');
  const force = metric(active.measurements, 'tractive_force');
  const packTemp = metric(active.measurements, 'pack_temp_max');
  const motorTemp = metric(active.measurements, 'motor_temp_max');
  const endSoc = metric(active.measurements, 'end_soc');
  const workRate = metric(active.measurements, 'work_rate');

  function changeScenario(next: 'CURRENT' | 'ACCEPTANCE') {
    setScenario(next);
    setRevisionApplied(false);
    setSelectedTestId(null);
    setSelectedEvidenceId(null);
  }

  return (
    <main className="min-h-screen bg-[#08090b] text-zinc-100">
      <div className="mx-auto max-w-[1500px] p-3 sm:p-5 lg:p-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="text-zinc-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">← LogicHub</Link>
            <span className="text-zinc-700">/</span><span className="font-mono text-zinc-400">campaign evidence console</span>
          </div>
          <FixtureMark />
        </div>

        <header className={`${panel} mb-3`}>
          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <div>
              <div className={label}>Campaign</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{active.campaign.name}</h1>
              <p className="mt-2 max-w-4xl text-sm text-zinc-400">Evidence-driven claim validation. KUP owns the research claim; Aporaksha-Lab owns protocols and raw laboratory records; LogicHub owns engineering configuration and revision state.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 xl:w-[560px]">
              <KeyValue name="Claim ID" value={<span className={mono}>{active.campaign.claimId}</span>} />
              <KeyValue name="Campaign state" value={<StatusBadge state={active.campaign.state} compact />} />
              <KeyValue name="Claim state" value={<StatusBadge state={evaluation.claimState} compact />} />
              <KeyValue name="LogicHub revision" value={<span className={mono}>{active.currentRevisionId}</span>} />
              <KeyValue name="Evidence package" value={<span className={mono}>{active.campaign.evidencePackageId}</span>} />
              <KeyValue name="Test campaign" value={<span className={mono}>{active.campaign.testCampaignId}</span>} />
            </div>
          </div>
          <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">Last evidence update: <span className="font-mono text-zinc-300">{active.campaign.lastEvidenceUpdate}</span> · Fixture records are not production evidence.</div>
        </header>

        <section className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="Campaign summary">
          {[
            ['DEPENDENCIES', dependencyAggregate.length], ['TESTS', active.tests.length], ['PASS', testTotals.pass], ['FAIL', testTotals.fail],
            ['INCOMPLETE', testTotals.incomplete], ['STALE', active.evidence.filter((item) => item.state === 'STALE').length + testTotals.stale],
            ['CRITICAL BLOCKERS', criticalBlockers], ['EVIDENCE ITEMS', active.evidence.length],
          ].map(([name, value]) => <div key={String(name)} className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-3"><div className={label}>{name}</div><div className="mt-1 font-mono text-xl font-bold">{value}</div></div>)}
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
          <article className={panel}>
            <div className="flex items-start justify-between gap-3"><div><div className={label}>Canonical claim</div><h2 className="mt-2 max-w-4xl text-xl font-bold leading-snug">“{active.claim.text}”</h2></div><StatusBadge state={evaluation.claimState} /></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><KeyValue name="Claim type" value={active.claim.type} /><KeyValue name="Subject" value={active.claim.subject} /><KeyValue name="Context" value={active.claim.context} /><KeyValue name="Comparator" value={active.claim.comparator} /></div>
              <div><div className={label}>Measurable success criteria</div><ul className="mt-2 space-y-1.5 text-sm text-zinc-300">{active.claim.successCriteria.map((item) => <li key={item}>• {item}</li>)}</ul><div className={`${label} mt-4`}>Defined activities</div><div className="mt-2 flex flex-wrap gap-1.5">{active.claim.activities.map((item) => <span key={item} className="rounded border border-white/10 bg-black px-2 py-1 text-xs text-zinc-400">{item}</span>)}</div></div>
            </div>
            <div className="mt-5 border-t border-white/5 pt-4"><div className={label}>Dependency graph</div><div className="mt-3"><DependencyGraph dependencies={dependencyAggregate} selectedId={selectedDependency?.id ?? null} onSelect={setSelectedDependencyId} /></div></div>
            {selectedDependency && <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-4" data-testid="dependency-detail"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className={label}>Selected dependency</div><h3 className="mt-1 text-lg font-bold">{selectedDependency.name}</h3></div><StatusBadge state={selectedDependency.status} /></div><div className="mt-3 grid gap-3 md:grid-cols-3"><KeyValue name="Test coverage" value={`${selectedDependency.completedTestCount}/${selectedDependency.testCount} (${selectedDependency.coveragePct}%)`} /><KeyValue name="Evidence count" value={selectedDependency.evidenceCount} /><KeyValue name="Open risks" value={selectedDependency.riskIds.length || 'None registered'} /></div><div className="mt-3"><div className={label}>Required properties</div><div className="mt-2 flex flex-wrap gap-1.5">{selectedDependency.requiredProperties.map((property) => <span key={property} className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{property}</span>)}</div></div></div>}
          </article>

          <aside className={`${panel} border-amber-500/20`} data-testid="decision-panel">
            <div className={label}>Current deterministic decision</div><div className="mt-3"><StatusBadge state={evaluation.decision} /></div>
            <p className="mt-4 text-sm text-zinc-300">Authority: critical requirements + effective test state + evidence validity + blockers + revision impact.</p>
            <div className="mt-5 space-y-2">{evaluation.reasons.map((reason) => <div key={reason} className="rounded border border-white/5 bg-black/40 p-3 text-sm text-zinc-300">{reason}</div>)}</div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs">{Object.entries(evaluation.counts).map(([name, value]) => <div key={name} className="rounded border border-white/5 bg-black/40 p-2"><div className="font-mono text-lg font-bold">{value}</div><div className="mt-1 text-[9px] uppercase tracking-wide text-zinc-500">{name}</div></div>)}</div>
            <div className="mt-5 border-t border-white/5 pt-4"><div className={label}>Why this decision?</div><div className="mt-2 text-xs text-zinc-400">Linked tests: {evaluation.linkedTestIds.join(', ') || 'none'}</div><div className="mt-1 text-xs text-zinc-400">Linked evidence: {evaluation.linkedEvidenceIds.join(', ') || 'none'}</div></div>
            <div className="mt-5 rounded border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200"><strong>AI boundary:</strong> an explanation layer may summarize this result, but cannot change PASS/FAIL, measurements, evidence validity, or the deterministic decision.</div>
          </aside>
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
          <article className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className={label}>Aporaksha-Lab test program</div><h2 className="mt-1 text-lg font-bold">Experiments and protocol-bound tests</h2></div><span className="text-xs text-zinc-500">UI is read-only toward laboratory evidence</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input aria-label="Search tests" className={input} value={testSearch} onChange={(e) => setTestSearch(e.target.value)} placeholder="Search test ID / name" />
              <select aria-label="Filter tests by dependency" className={input} value={testDependencyFilter} onChange={(e) => setTestDependencyFilter(e.target.value)}><option value="ALL">All dependencies</option>{active.dependencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select aria-label="Filter tests by status" className={input} value={testStatusFilter} onChange={(e) => setTestStatusFilter(e.target.value)}><option value="ALL">All states</option>{[...new Set(active.tests.map((item) => item.status))].map((state) => <option key={state}>{state}</option>)}</select>
              <select aria-label="Filter tests by operator" className={input} value={testOperatorFilter} onChange={(e) => setTestOperatorFilter(e.target.value)}><option value="ALL">All operators</option>{[...new Set(active.tests.map((item) => item.operator).filter(Boolean))].map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select>
              <select aria-label="Filter tests by reviewer" className={input} value={testReviewerFilter} onChange={(e) => setTestReviewerFilter(e.target.value)}><option value="ALL">All reviewers</option>{[...new Set(active.tests.map((item) => item.reviewer).filter(Boolean))].map((reviewer) => <option key={reviewer} value={reviewer}>{reviewer}</option>)}</select>
              <input aria-label="Filter tests by date" type="date" className={input} value={testDateFilter} onChange={(e) => setTestDateFilter(e.target.value)} />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">{filteredTests.map((test) => <button key={test.id} type="button" onClick={() => setSelectedTestId(test.id)} className="rounded-lg border border-white/10 bg-black/40 p-3 text-left hover:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400"><div className="flex items-start justify-between gap-2"><div><div className="font-mono text-[10px] text-zinc-500">{test.id} · {test.protocolId}@{test.protocolRevision}</div><div className="mt-1 font-semibold">{test.name}</div></div><StatusBadge state={test.status} compact /></div><div className="mt-2 text-xs text-zinc-500">{test.dependencyIds.join(' · ')} · config {test.configurationRevisionId}</div><div className="mt-2 text-[11px] text-zinc-400">Evidence {test.requiredEvidenceIds.length} · operator {test.operator ?? 'unknown'} · reviewer {test.reviewer ?? 'unknown'}</div></button>)}{filteredTests.length === 0 && <Empty text="No tests match the active filters." />}</div>
          </article>

          <article className={panel}>
            <div className={label}>Live / recent measurements</div><h2 className="mt-1 text-lg font-bold">Measurement console</h2><div className="mt-1"><FixtureMark /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['ENERGY CONSUMPTION', energy ? `${energy.value} ${energy.unit}` : 'MISSING'],
                ['TRACTIVE FORCE', force ? `${force.value} ${force.unit}` : 'MISSING'],
                ['PACK TEMPERATURE', packTemp ? `${packTemp.value} ${packTemp.unit}` : 'MISSING'],
                ['MOTOR TEMPERATURE', motorTemp ? `${motorTemp.value} ${motorTemp.unit}` : 'MISSING'],
                ['END SOC', endSoc ? `${endSoc.value} ${endSoc.unit}` : 'MISSING'],
                ['WORK COMPLETED', workRate ? `${workRate.value} ${workRate.unit}` : 'MISSING'],
                ['OPERATING COST', 'UNAVAILABLE'], ['DERATING', `${active.failures.filter((item) => item.description.toLowerCase().includes('derating')).length} fixture event`], ['MAINTENANCE', 'MISSING'],
              ].map(([name, value]) => <div key={name} className="rounded-lg border border-white/5 bg-black/40 p-3"><div className={label}>{name}</div><div className="mt-1 font-mono text-sm font-bold">{value}</div></div>)}
            </div>
            <div className="mt-4"><div className={label}>Recent raw measurement records</div><div className="mt-2 space-y-1">{active.measurements.slice(0, 8).map((item) => <button key={item.id} onClick={() => setSelectedTestId(item.testId)} className="grid w-full grid-cols-[72px_1fr_auto] items-center gap-2 rounded border border-white/5 bg-black/30 px-2 py-2 text-left text-xs hover:border-white/20"><span className="font-mono text-zinc-500">{item.id}</span><span className="text-zinc-300">{item.metric}</span><span className="font-mono text-zinc-200">{item.value} {item.unit}</span></button>)}</div></div>
          </article>
        </section>

        <section className={`${panel} mb-3`}>
          <div className={label}>Synchronized time-series</div><h2 className="mt-1 text-lg font-bold">Causal investigation view</h2><div className="mt-4"><MeasurementSeries points={active.timeSeries} events={active.testEvents} /></div>
        </section>

        <section className={`${panel} mb-3`}>
          <div className={label}>Defined duty cycle</div><h2 className="mt-1 text-lg font-bold">Where does the electric tractor struggle?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{active.dutyCycle.map((phase) => <div key={phase.id} className={`rounded-lg border p-3 ${phase.faults || phase.derating ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-black/30'}`}><div className="font-mono text-xs font-bold">{phase.name}</div><div className="mt-2 space-y-1 text-[11px] text-zinc-400"><div>{phase.durationMin ?? '—'} min</div><div>{phase.energyKwh ?? '—'} kWh</div><div>SOC −{phase.socLossPct ?? '—'}%</div><div>max {phase.maxTempC ?? '—'}°C</div><div>{phase.work ?? 'work missing'}</div><div>faults {phase.faults} · derating {phase.derating ? 'YES' : 'NO'}</div></div></div>)}</div>
        </section>

        <section className={`${panel} mb-3`}>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className={label}>Failure register</div><h2 className="mt-1 text-lg font-bold">Failures are first-class evidence</h2></div><select aria-label="Filter failures by severity" className={input} value={failureSeverityFilter} onChange={(e) => setFailureSeverityFilter(e.target.value)}><option value="ALL">All severity</option>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="mt-4 grid gap-2">{filteredFailures.map((failure) => <FailureRow key={failure.id} failure={failure} onOpenTest={setSelectedTestId} />)}{filteredFailures.length === 0 && <Empty text="No failures match the active filter." />}</div>
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-[0.82fr_1.18fr]">
          <article className={panel}>
            <div className={label}>LogicHub configuration</div><h2 className="mt-1 text-lg font-bold">Exact engineering object under evidence</h2>
            <div className="mt-4 grid gap-x-6 sm:grid-cols-2">{active.componentRevisions.filter((item) => item.parentMachineRevisionId === (revisionApplied ? 'TRACTOR-R08' : 'TRACTOR-R07') || ['PACK-R04','BMS-FW-R07','MOTOR-R03','INV-R05','VEH-FW-R12','PTO-R02','HYD-R04','CHASSIS-R05','CHG-R03','TESTCFG-R08'].includes(item.id)).map((item) => <KeyValue key={item.id} name={item.component} value={<span className={mono}>{item.id}</span>} />)}</div>
            <div className="mt-4 rounded border border-white/10 bg-black/30 p-3 text-xs text-zinc-500">LogicHub’s existing revision contract binds revisions to git commit SHA, parent revisions, snapshot hashes, toolchain and immutable metadata. This fixture mirrors the traceability shape; it does not claim these fixture IDs are production objects.</div>
          </article>

          <article className={`${panel} border-purple-500/20`} data-testid="revision-diff">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className={label}>Semantic engineering diff</div><h2 className="mt-1 text-lg font-bold">{active.changes[0].fromRevisionId} → {active.changes[0].toRevisionId}</h2></div><button type="button" data-testid="apply-revision-change" onClick={() => setRevisionApplied((value) => !value)} className="rounded border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400">{revisionApplied ? 'Revert to R07 evidence view' : 'Apply R08 change impact'}</button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded border border-white/10 bg-black/30 p-3"><div className={label}>What changed</div><div className="mt-2 text-sm">{active.changes[0].component}: {active.changes[0].whatChanged}</div><div className={`${label} mt-4`}>Why</div><div className="mt-2 text-sm text-zinc-400">{active.changes[0].why}</div><div className={`${label} mt-4`}>Requirements affected</div><div className="mt-2 font-mono text-xs text-zinc-300">{active.changes[0].affectedRequirementIds.join(', ')}</div></div><div className="rounded border border-white/10 bg-black/30 p-3"><div className={label}>Derived evidence impact</div>{revisionApplied ? <div className="mt-2 space-y-2"><div className="text-sm text-purple-200">Evidence stale: {(active as CampaignFixture & { revisionImpact?: { affectedEvidenceIds: string[] } }).revisionImpact?.affectedEvidenceIds.join(', ') || 'none'}</div><div className="text-sm text-amber-200">Tests requiring review: {(active as CampaignFixture & { revisionImpact?: { affectedTestIds: string[] } }).revisionImpact?.affectedTestIds.join(', ') || 'none'}</div><div className="text-xs text-zinc-500">No source measurement or original evidence object was mutated; these are derived effective states.</div></div> : <div className="mt-2 text-sm text-zinc-400">Apply the change to calculate which evidence validity keys intersect changed engineering attributes.</div>}</div></div>
          </article>
        </section>

        <section className={`${panel} mb-3`}>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className={label}>Evidence panel</div><h2 className="mt-1 text-lg font-bold">Content-addressed evidence and validity</h2></div><div className="flex gap-2"><select aria-label="Filter evidence by state" className={input} value={evidenceStateFilter} onChange={(e) => setEvidenceStateFilter(e.target.value)}><option value="ALL">All evidence states</option>{[...new Set(active.evidence.map((item) => item.state))].map((state) => <option key={state}>{state}</option>)}</select><select aria-label="Filter evidence by revision" className={input} value={evidenceRevisionFilter} onChange={(e) => setEvidenceRevisionFilter(e.target.value)}><option value="ALL">All revisions</option>{[...new Set(active.evidence.flatMap((item) => item.boundRevisionIds))].map((revision) => <option key={revision}>{revision}</option>)}</select></div></div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">{filteredEvidence.map((item) => <button key={item.id} type="button" onClick={() => setSelectedEvidenceId(item.id)} className="rounded border border-white/10 bg-black/30 p-3 text-left hover:border-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-400"><div className="flex items-start justify-between gap-2"><div><div className="font-mono text-xs font-bold">{item.id}</div><div className="mt-1 text-[11px] text-zinc-500">{item.type} · {item.testId} · {item.timestamp}</div></div><StatusBadge state={item.state} compact /></div><div className="mt-2 truncate font-mono text-[10px] text-zinc-600">sha256:{item.sha256}</div><div className="mt-1 text-[10px] text-zinc-500">bound: {item.boundRevisionIds.join(', ')}</div></button>)}</div>
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-2">
          <article className={panel}><div className={label}>Evidence coverage</div><h2 className="mt-1 text-lg font-bold">Coverage is not correctness</h2><div className="mt-4 space-y-3">{dependencyAggregate.map((item) => <div key={item.id}><div className="mb-1 flex items-center justify-between gap-2 text-xs"><span>{item.name}</span><span className="flex items-center gap-2"><StatusBadge state={item.status} compact /><span className="font-mono text-zinc-500">{item.coveragePct}%</span></span></div><div className="h-2 overflow-hidden rounded bg-zinc-900" aria-label={`${item.name} ${item.coveragePct}% test coverage`}><div className="h-full bg-zinc-400" style={{ width: `${item.coveragePct}%` }} /></div></div>)}</div></article>
          <article className={panel}><div className={label}>KUP integration</div><h2 className="mt-1 text-lg font-bold">What would make this claim false?</h2><div className="mt-4 space-y-2">{active.claim.whatWouldMakeFalse.map((item) => <div key={item} className="rounded border border-red-500/10 bg-red-500/5 p-3 text-sm text-zinc-300">✕ {item}</div>)}</div><div className="mt-4 border-t border-white/5 pt-3"><KeyValue name="Signal source" value={active.claim.signalSource} /><KeyValue name="Why investigated" value={active.claim.investigationReason} /></div></article>
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-2">
          <article className={panel}><div className={label}>Diesel reference comparator</div><h2 className="mt-1 text-lg font-bold">No unverified web specifications</h2><div className="mt-4 space-y-2">{active.comparator.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded border border-white/5 bg-black/30 p-3 text-xs"><span>{item.metric}</span><span className="font-mono text-zinc-300">EV {item.electricValue ?? '—'} {item.electricValue !== undefined ? item.unit : ''}</span><span className="font-mono text-zinc-500">DIESEL {item.dieselValue ?? 'UNAVAILABLE'}</span></div>)}</div></article>
          <article className={panel}><div className={label}>Operational economics</div><h2 className="mt-1 text-lg font-bold">Assumptions remain visible</h2><div className="mt-4 space-y-2">{active.economicAssumptions.map((item) => <div key={item.id} className="rounded border border-white/5 bg-black/30 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm">{item.name}</span><StatusBadge state={item.state} compact /></div><div className="mt-1 font-mono text-xs text-zinc-400">{item.value ?? 'MISSING'} {item.value !== undefined ? item.unit : ''}</div><div className="mt-1 text-[11px] text-zinc-500">{item.note}</div></div>)}</div><div className="mt-3 text-xs text-zinc-500">₹/hour is intentionally not calculated until required price and comparator inputs are measured, verified externally, or explicitly supplied.</div></article>
        </section>

        <section className={`${panel} mb-3`}>
          <div className={label}>Research timeline</div><h2 className="mt-1 text-lg font-bold">Chronological engineering history</h2><div className="mt-4 grid gap-2 md:grid-cols-5">{active.timeline.map((event) => <button key={event.id} onClick={() => setSelectedTimelineId(event.id)} className={`rounded border p-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 ${selectedTimelineId === event.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-black/30'}`}><div className="font-mono text-[9px] text-zinc-500">{event.timestamp.slice(0, 10)}</div><div className="mt-1 text-xs font-bold">{event.title}</div><div className="mt-2 text-[10px] uppercase tracking-wide text-zinc-600">{event.type}</div></button>)}</div>{selectedTimeline && <div className="mt-3 rounded border border-white/10 bg-black/30 p-3 text-sm text-zinc-300"><strong>{selectedTimeline.title}:</strong> {selectedTimeline.detail}<div className="mt-2 font-mono text-xs text-zinc-500">linked: {selectedTimeline.linkedIds.join(', ')}</div></div>}
        </section>

        <section className={`${panel} mb-3`} data-testid="acceptance-scenario">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className={label}>Deterministic acceptance scenario</div><h2 className="mt-1 text-lg font-bold">SUPPORTED → revision change → REVIEW_REQUIRED / CONDITIONAL</h2><p className="mt-2 max-w-3xl text-sm text-zinc-400">This is an explicit fixture-only mode used to prove the state transition. It closes current fixture gaps, then lets the same R08 cooling change invalidate revision-sensitive thermal evidence.</p></div><div className="flex gap-2"><button type="button" data-testid="current-scenario" onClick={() => changeScenario('CURRENT')} className={`rounded border px-3 py-2 text-xs font-bold ${scenario === 'CURRENT' ? 'border-blue-500/50 bg-blue-500/10 text-blue-200' : 'border-white/10 text-zinc-400'}`}>Current fixture</button><button type="button" data-testid="acceptance-baseline" onClick={() => changeScenario('ACCEPTANCE')} className={`rounded border px-3 py-2 text-xs font-bold ${scenario === 'ACCEPTANCE' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-zinc-400'}`}>Acceptance baseline</button></div></div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><span className={label}>Scenario decision</span><StatusBadge state={evaluation.decision} /><span className={label}>Claim state</span><StatusBadge state={evaluation.claimState} /></div>
        </section>

        <footer className="pb-10 pt-3 text-xs text-zinc-600">SOURCE → CLAIM → DEPENDENCIES → HYPOTHESES / FAILURE MODES → APORAKSHA-LAB TEST PROGRAM → EXPERIMENTS → RAW MEASUREMENTS → EVIDENCE → LOGICHUB REVISION → VALIDATION / INVALIDATION → DECISION</footer>
      </div>

      {selectedTest && <TestDetail test={selectedTest} measurements={active.measurements.filter((item) => item.testId === selectedTest.id)} evidence={active.evidence.filter((item) => item.testId === selectedTest.id)} onClose={() => setSelectedTestId(null)} onOpenEvidence={setSelectedEvidenceId} />}
      {selectedEvidence && <EvidenceDetail item={selectedEvidence} onClose={() => setSelectedEvidenceId(null)} />}
    </main>
  );
}

function FailureRow({ failure, onOpenTest }: { failure: Failure; onOpenTest: (id: string) => void }) {
  return <button onClick={() => onOpenTest(failure.testId)} className="grid gap-2 rounded-lg border border-red-500/15 bg-red-500/5 p-3 text-left text-xs sm:grid-cols-[100px_1fr_130px_160px] focus:outline-none focus:ring-2 focus:ring-red-400"><div><div className={label}>Failure</div><div className="mt-1 font-mono font-bold">{failure.id}</div></div><div><div className="font-semibold text-zinc-200">{failure.description}</div><div className="mt-1 text-zinc-500">{failure.time} · test {failure.testId} · {failure.componentId}</div><div className="mt-1 text-zinc-400">Root cause: {failure.rootCause}</div></div><div><div className={label}>Severity</div><div className="mt-1 font-mono text-red-300">{failure.severity}</div></div><div><div className={label}>State</div><div className="mt-1"><StatusBadge state={failure.status} compact /></div></div></button>;
}

function TestDetail({ test, measurements, evidence, onClose, onOpenEvidence }: { test: TestRecord; measurements: Measurement[]; evidence: Evidence[]; onClose: () => void; onOpenEvidence: (id: string) => void }) {
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="test-detail-title"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl md:rounded-2xl md:p-6"><div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-zinc-950 pb-4"><div><div className={label}>Aporaksha-Lab test detail · read-only</div><h2 id="test-detail-title" className="mt-1 text-xl font-bold">{test.id} — {test.name}</h2><div className="mt-2"><StatusBadge state={test.status} /></div></div><button aria-label="Close test detail" onClick={onClose} className="rounded border border-white/10 px-3 py-2 text-sm">Close</button></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded border border-white/10 bg-black/30 p-4"><KeyValue name="Test purpose" value={test.purpose} /><KeyValue name="Hypothesis" value={test.hypothesis} /><KeyValue name="Protocol revision" value={`${test.protocolId}@${test.protocolRevision}`} /><KeyValue name="Tractor revision" value={test.tractorRevisionId} /><KeyValue name="Battery revision" value={test.batteryRevisionId} /><KeyValue name="Firmware revision" value={test.firmwareRevisionId} /><KeyValue name="Test configuration" value={test.configurationRevisionId} /><KeyValue name="Calibration state" value={test.calibrationState} /><KeyValue name="Environment" value={test.environment.join(' · ')} /></div><div className="rounded border border-white/10 bg-black/30 p-4"><ListBlock title="Variables" items={test.variables} /><ListBlock title="Controls" items={test.controls} /><ListBlock title="Equipment" items={test.equipment} /><ListBlock title="Procedure" items={test.procedure} /><ListBlock title="Stop conditions" items={test.stopConditions} /></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Separated title="OBSERVATION" value={test.observation} /><Separated title="CALCULATION" value={test.calculation} /><Separated title="INTERPRETATION" value={test.interpretation} /><Separated title="CLAIM IMPACT" value={test.claimImpact} /></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><div className={label}>Raw measurements</div><div className="mt-2 space-y-1">{measurements.map((item) => <div key={item.id} className="grid grid-cols-[80px_1fr_auto] gap-2 rounded border border-white/5 bg-black/30 p-2 text-xs"><span className="font-mono text-zinc-500">{item.id}</span><span>{item.metric}</span><span className="font-mono">{item.value} {item.unit}</span></div>)}{measurements.length === 0 && <Empty text="Missing. No measurement record is substituted with zero." />}</div></div><div><div className={label}>Evidence</div><div className="mt-2 space-y-1">{evidence.map((item) => <button key={item.id} onClick={() => onOpenEvidence(item.id)} className="flex w-full items-center justify-between rounded border border-white/5 bg-black/30 p-2 text-left text-xs"><span className="font-mono">{item.id}</span><StatusBadge state={item.state} compact /></button>)}{evidence.length === 0 && <Empty text="Missing evidence remains missing." />}</div></div></div><div className="mt-4 rounded border border-white/10 bg-black/30 p-4"><div className={label}>REVIEW</div><div className="mt-2 text-sm text-zinc-300">{test.review}</div></div></div></div>;
}

function EvidenceDetail({ item, onClose }: { item: Evidence; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="evidence-detail-title"><div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><div className="flex items-start justify-between gap-3"><div><div className={label}>Evidence artifact</div><h2 id="evidence-detail-title" className="mt-1 font-mono text-lg font-bold">{item.id}</h2></div><button onClick={onClose} className="rounded border border-white/10 px-3 py-2 text-sm">Close</button></div><div className="mt-4 grid gap-x-6 sm:grid-cols-2"><KeyValue name="Type" value={item.type} /><KeyValue name="State" value={<StatusBadge state={item.state} compact />} /><KeyValue name="Source" value={item.source} /><KeyValue name="Test" value={item.testId} /><KeyValue name="Timestamp" value={<span className={mono}>{item.timestamp}</span>} /><KeyValue name="Revision" value={<span className={mono}>{item.revisionId}</span>} /><KeyValue name="Bound revisions" value={<span className={mono}>{item.boundRevisionIds.join(', ')}</span>} /><KeyValue name="Validity keys" value={<span className={mono}>{item.validityKeys.join(', ')}</span>} /></div><div className="mt-4 rounded border border-white/10 bg-black/30 p-3"><div className={label}>SHA-256</div><div className="mt-2 break-all font-mono text-xs text-zinc-300">{item.sha256}</div></div><div className="mt-3 rounded border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">Artifact path: {item.artifactPath}. This is a fixture URI, not a fabricated downloadable laboratory file.</div>{item.staleReason && <div className="mt-3 rounded border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-purple-200">Stale reason: {item.staleReason}</div>}</div></div>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="mb-4"><div className={label}>{title}</div><ul className="mt-2 space-y-1 text-xs text-zinc-400">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>;
}

function Separated({ title, value }: { title: string; value: string }) {
  return <div className="rounded border border-white/10 bg-black/30 p-3"><div className={label}>{title}</div><div className="mt-2 text-sm text-zinc-300">{value}</div></div>;
}
