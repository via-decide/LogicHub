(function (global) {
  function featureGrid() {
    const domains = ['SaaS', 'CRM', 'ERP', 'Manufacturing', 'Scientific Computing', 'Education', 'Finance', 'Healthcare', 'Government', 'AI Agents', 'Internal Tools', 'Dashboards', 'Browser Extensions', 'PWAs', 'Mobile Apps'];
    const capabilities = [
      ['Reasoning Transparency', 'Expose assumptions, constraints, alternatives, trade-offs, confidence, and rationale for every decision.'],
      ['Planning Mode', 'Generate milestones, backlog, priorities, dependencies, risk analysis, and estimated effort before code.'],
      ['Enterprise Readiness', 'Support RBAC, audit logs, private deployments, on-prem options, integrations, compliance, and secrets.']
    ];
    return `
      <section class="feature-grid py-14">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4"><div><p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Engineering domains</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Not templates. Production contexts.</h2></div><p class="max-w-2xl text-slate-600 dark:text-slate-300">Import GitHub repositories, PDFs, Markdown, APIs, OpenAPI specs, database schemas, images, and existing codebases as reasoning context.</p></div>
        <div class="mt-7 flex flex-wrap gap-2">${domains.map((domain) => `<span class="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">${domain}</span>`).join('')}</div>
        <div class="mt-7 grid md:grid-cols-3 gap-5">${capabilities.map(([title, body]) => `<article class="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-950"><h3 class="text-lg font-semibold text-slate-900 dark:text-white">${title}</h3><p class="mt-3 text-slate-600 dark:text-slate-300">${body}</p></article>`).join('')}</div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.featureGrid = featureGrid;
})(window);
