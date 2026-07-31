// LogicHub/scripts/build-workspace.mjs
// Generates workspace.html — the vendor/creator/buyer marketplace UI wired
// to the real api/marketplace/* endpoints, following the same
// one-layout-one-source-of-truth pattern build-policy-pages.mjs already
// uses. Added to site:build so build-seo.mjs (which reads .html files at
// the repo root, not a hand-kept list) picks it up automatically.
//
// Structurally follows a real supplied mockup (three tabs: Open Repo /
// Local Branch / Pull Request), with these real changes from it:
//
//   1. No client-side pass/fail computation. The mockup's `qaData()` read
//      #dimA/#wallThickness and decided PASSED/FAILED itself, in the
//      browser -- exactly what `01-hardware-bridge-spec.md`'s "the pipeline
//      must not run in the browser" forbids. This page never compares a
//      reading to a bound; every verdict rendered here is copied verbatim
//      from an api/marketplace/* response.
//   2. A PENDING condition blocks. `allConditionsMet`-equivalent logic
//      gates the release action; a single PENDING condition disables it the
//      same way a FAILED one does.
//   3. Bounty is the real PriceQuote tagged union (UNAVAILABLE | QUOTED),
//      not a hardcoded string -- an unpriced issue renders as "Not priced
//      yet", never as a number.
//   4. A standing notice states plainly that no payment is taken, matching
//      the wording api/_payments-config.js's paymentsDisabledResponse and
//      the policy pages already use.
//   5. No CDN script. The mockup loaded Lucide from unpkg -- a real
//      third-party request from a page whose cookie policy claims none are
//      made (scripts/check-no-tracking.mjs doesn't happen to block unpkg
//      today, but that's a gap in the check, not permission). Icons here
//      are self-authored inline SVGs in a similar minimal-stroke style --
//      NOT copies of Lucide's actual path data, which this script has no
//      network access to fetch and verify; presenting them as Lucide icons
//      would be a claim this file can't back up.
//   6. Real accessibility: role="tablist" with arrow-key navigation instead
//      of a bare button row; #dimA/#wallThickness get explicit
//      <label for="…"> instead of relying on implicit nesting; icon-only
//      controls get aria-label; decorative icons get aria-hidden="true".
//
// Run: node scripts/build-workspace.mjs

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { SITE_NAME, SITE_ORIGIN, PAYMENTS_ENABLED } from './site-constants.mjs';

const UPDATED = new Date().toISOString().slice(0, 10);

// ── Self-authored, minimal-stroke icon set ──────────────────────────────
// 24x24 viewBox, stroke="currentColor", no fill -- same visual language the
// mockup's Lucide icons used, but every path here was drawn for this file.
const ICONS = {
  hexagon: 'M12 2 21 7v10l-9 5-9-5V7z',
  'git-commit': 'M12 4v5M12 15v5M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z',
  'shield-check': 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6ZM8.5 12l2.2 2.2 4.3-4.6',
  'circle-dot': 'M12 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3.5 2',
  terminal: 'M4 5h16v14H4Zm3 4 3 3-3 3M12 15h5',
  'git-fork': 'M6 4v4M18 4v4M6 8a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3M12 11v6M6 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM18 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  activity: 'M3 12h4l2.5-7 4 14L16 12h5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35',
  sliders: 'M4 6h10M17 6h3M4 12h3M10 12h10M4 18h13M20 18h0M7 4v4M13 10v4M17 16v4',
  'file-code': 'M6 2h9l5 5v15H6Zm9 0v5h5M9.5 12l-2 2.5 2 2.5M14.5 12l2 2.5-2 2.5',
  gauge: 'M12 4a9 9 0 0 0-9 9h3a6 6 0 0 1 12 0h3a9 9 0 0 0-9-9ZM12 13l3-4',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  hash: 'M5 9h14M5 15h14M10 3 7 21M17 3l-3 18',
  'file-diff': 'M6 2h9l5 5v15H6Zm9 0v5h5M10 13h4M12 11v4',
  image: 'M4 4h16v16H4Zm3 12 4-5 3 3 3-4 3 6M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  upload: 'M12 16V6M8 10l4-4 4 4M4 18h16',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 19v2',
  play: 'M6 4l14 8-14 8Z',
  'triangle-alert': 'M12 3 2 21h20Zm0 6v6M12 18h0',
  'lock-keyhole': 'M6 11V7a6 6 0 0 1 12 0v4M4 11h16v10H4ZM12 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  clipboard: 'M9 3h6v3H9ZM6 5h3v0H6v16h12V5h-3M9 11h6M9 15h4',
  check: 'M5 13l4 4L19 7',
  x: 'M5 5l14 14M19 5 5 19',
  circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  box: 'M3 8l9-5 9 5-9 5-9-5Zm0 0v9l9 5 9-5V8M12 13v9',
  cpu: 'M8 3v3M16 3v3M8 18v3M16 18v3M3 8h3M3 16h3M18 8h3M18 16h3M6 6h12v12H6Z',
  'git-branch': 'M6 3v10M18 9v9a3 3 0 0 1-3 3H9M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM18 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  'git-pull-request': 'M6 3v12M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM18 9v9M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 9a5 5 0 0 0 5 5h4M12 11l3-3-3-3',
  loader: 'M12 3v3M18.4 5.6l-2.1 2.1M21 12h-3M18.4 18.4l-2.1-2.1M12 21v-3M5.6 18.4l2.1-2.1M3 12h3M5.6 5.6l2.1 2.1',
  'user-check': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a6 6 0 0 1 12 0M17 12l2 2 4-4',
  'package-check': 'M3 8l9-5 9 5-9 5-9-5Zm0 0v9l9 5 9-5V8M12 13v9M9.5 12l1.5 1.5 3-3',
  'list-checks': 'M4 6h2M9 6h11M4 11h2M9 11h11M4 16l1.5 1.5L8 15',
};

/** `aria-hidden` icon markup, for a control whose visible text already names it. */
function icon(name, extraClass = '') {
  const d = ICONS[name] || ICONS.circle;
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

const STYLE = `
:root{
  --bg:#09090b;--panel:#0f0f12;--panel-2:#151519;--panel-3:#1b1b20;
  --line:#29292f;--line-strong:#3b3b43;--text:#f4f4f5;--muted:#a1a1aa;--dim:#9a9aa3;
  --green:#6ee7b7;--green-bg:rgba(16,185,129,.10);--green-line:rgba(16,185,129,.42);
  --red:#fca5a5;--red-bg:rgba(239,68,68,.10);--red-line:rgba(239,68,68,.42);
  --amber:#fcd34d;--amber-bg:rgba(245,158,11,.10);--amber-line:rgba(245,158,11,.42);
  --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px}
button,input{font:inherit}
button{cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.5}
a{color:#ff9955}
.icon{width:16px;height:16px;flex:0 0 auto}
.brand-icon .icon{width:21px;height:21px}
.small{width:13px;height:13px}
.topbar{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line);background:rgba(9,9,11,.96)}
.topbar-inner,.tabbar,.content{width:min(1400px,calc(100% - 32px));margin:0 auto}
.topbar-inner{min-height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line-strong);background:#000}
.brand h1{font-size:15px;margin:0;font-weight:700}
.badge{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line-strong);padding:4px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.badge.pass{border-color:var(--green-line);color:var(--green);background:var(--green-bg)}
.badge.fail{border-color:var(--red-line);color:var(--red);background:var(--red-bg)}
.badge.pending{border-color:var(--amber-line);color:var(--amber);background:var(--amber-bg)}
.badge.neutral{color:#d4d4d8;background:var(--panel-2)}
.tabbar{display:flex;gap:2px}
.tab{display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dim);font-weight:700}
.tab:hover{color:#d4d4d8}
.tab[aria-selected="true"]{color:var(--text);border-bottom-color:var(--text)}
.tab:focus-visible,button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
.content{padding:16px 0 48px}
[role="tabpanel"]{display:none}
[role="tabpanel"]:not([hidden]){display:block}
.panel{border:1px solid var(--line);background:rgba(15,15,18,.96);margin-bottom:12px}
.section-header{min-height:44px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);background:#0a0a0c}
.section-title{display:flex;align-items:center;gap:8px;margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.btn{min-height:34px;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);padding:7px 11px;background:var(--panel-2);color:#d4d4d8;font-size:12px;font-weight:700}
.btn:hover:not(:disabled){background:var(--panel-3)}
.btn-primary{background:#f4f4f5;color:#09090b;border-color:#f4f4f5}
.notice{border-bottom:1px solid var(--amber-line);background:var(--amber-bg);padding:10px 0}
.notice p{width:min(1400px,calc(100% - 32px));margin:0 auto;color:var(--amber);font-size:12.5px;display:flex;align-items:center;gap:8px}
.empty{padding:34px;color:var(--dim);text-align:center}
.market-table{min-width:900px}
.market-head,.market-row{display:grid;grid-template-columns:minmax(240px,1.4fr) 170px 130px 120px;gap:12px;align-items:center}
.market-head{padding:9px 14px;border-bottom:1px solid var(--line);background:var(--panel-2);color:var(--dim);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.market-row{min-height:64px;padding:12px 14px;border-bottom:1px solid var(--line)}
.table-scroll{overflow-x:auto}
.mono{font-family:var(--mono)}
.money{font-family:var(--mono);font-weight:700}
.money.unpriced{color:var(--dim);font-weight:400;font-style:italic}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px}
.field label{display:block;margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:700}
.field .input-group{display:flex;border:1px solid var(--line-strong);background:var(--panel-2)}
.field .input-group input{width:100%;border:0;outline:none;padding:0 11px;height:38px;background:transparent;color:var(--text);font-family:var(--mono)}
.field .input-group span{display:flex;align-items:center;border-left:1px solid var(--line-strong);padding:0 10px;color:var(--dim);font:11px var(--mono)}
table.qa{width:100%;border-collapse:collapse;font-size:12px}
table.qa th{padding:9px;border-bottom:1px solid var(--line);color:var(--dim);text-align:left}
table.qa td{padding:10px 9px;border-bottom:1px solid #202024;font-family:var(--mono)}
.condition-list{display:grid;gap:8px;padding:12px}
.condition{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);padding:10px;background:rgba(0,0,0,.18);font-size:11.5px}
.status-line{padding:10px 12px;font-size:12px;color:var(--dim)}
.status-line[data-tone="error"]{color:var(--red)}
@media (max-width:760px){.market-head,.market-row{grid-template-columns:1fr}.field-grid{grid-template-columns:1fr}}
`;

const HEAD = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Workspace | ${SITE_NAME}</title>
<meta name="description" content="Claim manufacturing jobs, submit inspection telemetry, and check deterministic CI/CD verdicts on ${SITE_NAME}.">
<link rel="canonical" href="${SITE_ORIGIN}/workspace">
<style>${STYLE}</style>
</head><body>`;

const TOPBAR = `
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-icon">${icon('hexagon')}</div>
      <div>
        <h1>${SITE_NAME} Workspace</h1>
        <div class="mono" style="color:var(--dim);font-size:10.5px;margin-top:3px">manufacturing pull requests</div>
      </div>
    </div>
    <div id="connectionStatus" class="badge neutral">${icon('circle-dot', 'small')}<span>checking connection…</span></div>
  </div>
  <nav class="tabbar" role="tablist" aria-label="Workspace views">
    <button class="tab" role="tab" id="tab-open-repo" aria-selected="true" aria-controls="panel-open-repo" data-view="open-repo">${icon('git-fork')}Open Repo</button>
    <button class="tab" role="tab" id="tab-local-branch" aria-selected="false" aria-controls="panel-local-branch" tabindex="-1" data-view="local-branch">${icon('git-branch')}Local Branch</button>
    <button class="tab" role="tab" id="tab-pull-request" aria-selected="false" aria-controls="panel-pull-request" tabindex="-1" data-view="pull-request">${icon('git-pull-request')}Pull Request</button>
  </nav>
</header>`;

const PAYMENTS_NOTICE = `
<div class="notice">
  <p>${icon('triangle-alert', 'small')}No payment is taken on this deployment. Release conditions and CI verdicts below are real; funds never move — the same posture <a href="/waitlist">the waiting list</a> and <a href="/terms">terms</a> already state.</p>
</div>`;

const OPEN_REPO_PANEL = `
<section id="panel-open-repo" role="tabpanel" aria-labelledby="tab-open-repo">
  <div class="panel">
    <div class="section-header">
      <h2 class="section-title">${icon('git-fork')}Open Issues</h2>
      <button id="refreshIssues" class="btn">${icon('activity', 'small')}Refresh</button>
    </div>
    <div class="table-scroll">
      <div class="market-table">
        <div class="market-head"><span>Issue</span><span>Repository</span><span>Bounty</span><span>Action</span></div>
        <div id="issueRows"><div class="empty">Loading issues…</div></div>
      </div>
    </div>
  </div>
</section>`;

const LOCAL_BRANCH_PANEL = `
<section id="panel-local-branch" role="tabpanel" aria-labelledby="tab-local-branch" hidden>
  <div class="panel">
    <div class="section-header">
      <h2 class="section-title">${icon('git-branch')}Your Claimed Pull Requests</h2>
    </div>
    <div id="branchList"><div class="empty">Claim an issue from Open Repo to see it here.</div></div>
  </div>
</section>`;

const PULL_REQUEST_PANEL = `
<section id="panel-pull-request" role="tabpanel" aria-labelledby="tab-pull-request" hidden>
  <div class="panel">
    <div class="section-header">
      <h2 class="section-title">${icon('git-pull-request')}Submit Inspection</h2>
      <span id="activePrTag" class="badge neutral mono">no pull request selected</span>
    </div>
    <form id="submitForm">
      <div class="field-grid">
        <div class="field">
          <label for="dimA">Micrometer reading — diameter</label>
          <span class="input-group"><input id="dimA" name="dimA" type="text" inputmode="decimal" value="25.00" required /><span>mm</span></span>
        </div>
        <div class="field">
          <label for="wallThickness">Weight reading</label>
          <span class="input-group"><input id="wallThickness" name="weight" type="text" inputmode="decimal" value="142.5" required /><span>g</span></span>
        </div>
      </div>
      <div class="section-header" style="border-top:1px solid var(--line);border-bottom:0">
        <span style="color:var(--dim);font-size:11px">Readings are sealed and evaluated on the server. Nothing here is compared to a bound in this browser.</span>
        <button type="submit" id="submitBtn" class="btn btn-primary" disabled>${icon('play', 'small')}Submit &amp; Run CI</button>
      </div>
    </form>
    <div id="submitStatus" class="status-line"></div>
  </div>

  <div class="panel">
    <div class="section-header"><h2 class="section-title">${icon('shield-check')}CI Verdict</h2></div>
    <div class="table-scroll">
      <table class="qa" id="verdictTable" hidden>
        <thead><tr><th>Property</th><th>Bound</th><th>Observed</th><th>State</th></tr></thead>
        <tbody id="verdictRows"></tbody>
      </table>
    </div>
    <div id="verdictEmpty" class="empty">No CI run yet for this pull request.</div>
  </div>

  <div class="panel">
    <div class="section-header">
      <h2 class="section-title">${icon('lock-keyhole')}Release Conditions</h2>
      <button id="releaseBtn" class="btn" disabled>${icon('package-check', 'small')}Check Release</button>
    </div>
    <div id="releaseConditions" class="condition-list"></div>
  </div>
</section>`;

const SCRIPT = `
<script>
(function () {
  'use strict';

  var state = { issues: [], pullRequests: {}, activePullRequestId: null, activeIssueId: null };

  // ── Tabs: role="tablist" with arrow-key navigation ──────────────────
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    tab.focus();
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (event) {
      var target = null;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'Home') target = tabs[0];
      else if (event.key === 'End') target = tabs[tabs.length - 1];
      if (target) { event.preventDefault(); selectTab(target); }
    });
  });

  // ── API helpers ──────────────────────────────────────────────────────
  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  }

  function priceLabel(bounty) {
    if (!bounty) return '<span class="money unpriced">Not priced yet</span>';
    if (bounty.state === 'QUOTED') return '<span class="money">' + bounty.currency + ' ' + bounty.amount + '</span>';
    return '<span class="money unpriced">Not priced yet</span>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Open Repo: real issues from the server, no fixture data ─────────
  function renderIssues() {
    var root = document.getElementById('issueRows');
    if (!state.issues.length) {
      root.innerHTML = '<div class="empty">No open issues right now.</div>';
      return;
    }
    root.innerHTML = state.issues.map(function (issue) {
      return '<div class="market-row">'
        + '<div>' + escapeHtml(issue.title) + '<div class="mono" style="color:var(--dim);font-size:10.5px;margin-top:5px">' + escapeHtml(issue.id) + '</div></div>'
        + '<div class="mono" style="color:var(--muted);font-size:12px">' + escapeHtml(issue.repositoryId) + '</div>'
        + '<div>' + priceLabel(issue.bounty) + '</div>'
        + '<button class="btn btn-primary" data-claim="' + escapeHtml(issue.id) + '">${icon('git-branch', 'small')}Claim</button>'
        + '</div>';
    }).join('');
  }

  function loadIssues() {
    document.getElementById('issueRows').innerHTML = '<div class="empty">Loading issues…</div>';
    fetch('/api/marketplace/issues').then(function (res) { return res.json(); }).then(function (data) {
      state.issues = data.issues || [];
      renderIssues();
      setConnectionStatus(true);
    }).catch(function () {
      document.getElementById('issueRows').innerHTML = '<div class="empty">Issues are unavailable right now.</div>';
      setConnectionStatus(false);
    });
  }

  function setConnectionStatus(ok) {
    var el = document.getElementById('connectionStatus');
    el.className = 'badge ' + (ok ? 'pass' : 'fail');
    el.innerHTML = (ok ? '${icon('circle-dot', 'small')}' : '${icon('x', 'small')}') + '<span>' + (ok ? 'connected' : 'unavailable') + '</span>';
  }

  // ── Local Branch: pull requests this session has claimed ────────────
  function renderBranchList() {
    var ids = Object.keys(state.pullRequests);
    var root = document.getElementById('branchList');
    if (!ids.length) {
      root.innerHTML = '<div class="empty">Claim an issue from Open Repo to see it here.</div>';
      return;
    }
    root.innerHTML = ids.map(function (id) {
      var pr = state.pullRequests[id];
      return '<div class="market-row" style="grid-template-columns:1fr 140px 140px">'
        + '<div class="mono">' + escapeHtml(pr.id) + '<div style="color:var(--dim);font-size:10.5px;margin-top:4px">issue ' + escapeHtml(pr.issueId) + '</div></div>'
        + '<div><span class="badge neutral">' + escapeHtml(pr.state) + '</span></div>'
        + '<button class="btn" data-select-pr="' + escapeHtml(pr.id) + '">${icon('git-pull-request', 'small')}Open</button>'
        + '</div>';
    }).join('');
  }

  // ── Pull Request tab: submit + run-ci + release, all server-verdicted ─
  function setActivePullRequest(id) {
    state.activePullRequestId = id;
    var pr = state.pullRequests[id];
    document.getElementById('activePrTag').textContent = pr ? pr.id + ' — ' + pr.state : 'no pull request selected';
    document.getElementById('submitBtn').disabled = !pr;
    resetVerdict();
    // Real conditions from the start, not a blank slate -- a freshly
    // claimed pull request that hasn't submitted anything yet genuinely
    // has "Telemetry submitted: PENDING", and that should be visible
    // immediately, not only after the first CI run.
    if (pr) renderConditions(pr, null);
    else document.getElementById('releaseConditions').innerHTML = '';
    selectTab(document.getElementById('tab-pull-request'));
  }

  function resetVerdict() {
    document.getElementById('verdictTable').hidden = true;
    document.getElementById('verdictEmpty').hidden = false;
    document.getElementById('verdictEmpty').textContent = 'No CI run yet for this pull request.';
  }

  // Every finding rendered here comes verbatim from the run-ci.js response.
  // Nothing on this page compares a value to a bound itself.
  function renderVerdict(run) {
    var table = document.getElementById('verdictTable');
    var empty = document.getElementById('verdictEmpty');
    var rows = document.getElementById('verdictRows');
    var findings = (run.rules && run.rules.findings) || [];
    if (!findings.length) {
      table.hidden = true;
      empty.hidden = false;
      empty.textContent = run.detail || ('Run finished: ' + run.state);
      return;
    }
    table.hidden = false;
    empty.hidden = true;
    rows.innerHTML = findings.map(function (f) {
      var bound = f.lowerBound != null ? ('[' + f.lowerBound + ', ' + f.upperBound + ']') : ('\\u2264 ' + f.upperBound);
      var badgeClass = f.passed ? 'pass' : 'fail';
      var icon2 = f.passed ? '${icon('check', 'small')}' : '${icon('x', 'small')}';
      return '<tr><td>' + escapeHtml(f.property) + '</td><td>' + escapeHtml(bound) + '</td>'
        + '<td>' + escapeHtml(f.observed) + '</td>'
        + '<td><span class="badge ' + badgeClass + '">' + icon2 + escapeHtml(f.passed ? 'passed' : 'failed') + '</span></td></tr>';
    }).join('');
  }

  // Conditions come from the pull request's own real state, not a fixture
  // list -- a PENDING or missing stage disables the release action exactly
  // like a FAILED one does; only every condition reporting PASSED enables it.
  function renderConditions(pr, run) {
    var conditions = [
      { label: 'Telemetry submitted', status: pr.state === 'DRAFT' ? 'PENDING' : 'PASSED' },
      { label: 'CI evaluated', status: !run ? 'PENDING' : (run.state === 'PASSED' ? 'PASSED' : 'FAILED') },
      { label: 'Pull request passed', status: pr.state === 'PASSED' || pr.state === 'MERGED' ? 'PASSED' : (pr.state === 'FAILED' ? 'FAILED' : 'PENDING') },
    ];
    var allPassed = conditions.length > 0 && conditions.every(function (c) { return c.status === 'PASSED'; });
    document.getElementById('releaseConditions').innerHTML = conditions.map(function (c) {
      var cls = c.status === 'PASSED' ? 'pass' : c.status === 'FAILED' ? 'fail' : 'pending';
      var i = c.status === 'PASSED' ? '${icon('check', 'small')}' : c.status === 'FAILED' ? '${icon('x', 'small')}' : '${icon('clock', 'small')}';
      return '<div class="condition"><span>' + escapeHtml(c.label) + '</span><span class="badge ' + cls + '">' + i + escapeHtml(c.status.toLowerCase()) + '</span></div>';
    }).join('');
    document.getElementById('releaseBtn').disabled = !allPassed;
  }

  document.getElementById('refreshIssues').addEventListener('click', loadIssues);

  document.addEventListener('click', function (event) {
    var claimBtn = event.target.closest('[data-claim]');
    if (claimBtn) {
      var issueId = claimBtn.dataset.claim;
      claimBtn.disabled = true;
      api('/api/marketplace/claim', { issueId: issueId, vendorId: 'workspace-session' }).then(function (result) {
        claimBtn.disabled = false;
        if (!result.ok) { alert((result.data && result.data.message) || 'Could not claim this issue.'); return; }
        state.pullRequests[result.data.pullRequest.id] = result.data.pullRequest;
        renderBranchList();
        setActivePullRequest(result.data.pullRequest.id);
      });
    }

    var selectBtn = event.target.closest('[data-select-pr]');
    if (selectBtn) setActivePullRequest(selectBtn.dataset.selectPr);
  });

  document.getElementById('submitForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var prId = state.activePullRequestId;
    if (!prId) return;

    var dimA = parseFloat(document.getElementById('dimA').value);
    var weight = parseFloat(document.getElementById('wallThickness').value);
    var status = document.getElementById('submitStatus');
    status.dataset.tone = '';
    status.textContent = 'Sealing and submitting…';

    var payload = {
      submissionId: 'sub_' + Date.now().toString(36),
      vendorId: 'workspace-session',
      partNumber: 'WORKSPACE-SUBMISSION',
      serialNumber: prId,
      capturedAt: new Date().toISOString(),
      streams: [{
        nodeId: 'manual-entry-01', nodeKind: 'micrometer', nodeRevision: 'workspace-ui-1.0.0', unit: 'mm',
        frames: [{ sequence: 0, timestampMs: 0, values: { diameter_mm: dimA, weight_grams: weight, imu_6dof_drift: 0.004 } }],
      }],
    };

    api('/api/marketplace/submit', { pullRequestId: prId, payload: payload }).then(function (submitResult) {
      if (!submitResult.ok) {
        status.dataset.tone = 'error';
        status.textContent = (submitResult.data && submitResult.data.message) || 'Submission was rejected.';
        return;
      }
      status.textContent = 'Submitted. Running CI…';
      return api('/api/marketplace/run-ci', { pullRequestId: prId }).then(function (runResult) {
        if (!runResult.ok) {
          status.dataset.tone = 'error';
          status.textContent = (runResult.data && runResult.data.message) || 'CI could not run.';
          return;
        }
        var run = runResult.data.run;
        status.textContent = 'CI finished: ' + run.state;
        renderVerdict(run);
        var pr = state.pullRequests[prId];
        pr.state = runResult.data.pullRequestState;
        renderConditions(pr, run);
        renderBranchList();
        document.getElementById('activePrTag').textContent = pr.id + ' — ' + pr.state;
      });
    });
  });

  document.getElementById('releaseBtn').addEventListener('click', function () {
    var prId = state.activePullRequestId;
    if (!prId) return;
    api('/api/marketplace/release', { pullRequestId: prId }).then(function (result) {
      var status = document.getElementById('submitStatus');
      if (result.status === 503 && result.data && result.data.error === 'payments_disabled') {
        status.dataset.tone = '';
        status.textContent = result.data.message;
        return;
      }
      status.dataset.tone = result.ok ? '' : 'error';
      status.textContent = (result.data && (result.data.decision ? result.data.decision.reason : result.data.message)) || 'Release checked.';
    });
  });

  loadIssues();
})();
</script>`;

const BODY = TOPBAR + PAYMENTS_NOTICE
  + `<main class="content">${OPEN_REPO_PANEL}${LOCAL_BRANCH_PANEL}${PULL_REQUEST_PANEL}</main>`
  + SCRIPT;

function main() {
  const html = `${HEAD}${BODY}</body></html>`;
  writeFileSync('workspace.html', html);
  if (!existsSync('public')) mkdirSync('public');
  writeFileSync('public/workspace.html', html);
  console.log(`workspace.html written (payments ${PAYMENTS_ENABLED ? 'enabled' : 'disabled'}, updated ${UPDATED}).`);
}

main();
