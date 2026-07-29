(function (global) {
  function ecosystemDiagram() {
    const nodes = ['Frontend', 'API', 'Database', 'Authentication', 'Storage', 'External APIs', 'Deployment'];
    const metrics = ['Test Coverage 94%', 'Type Safety 98%', 'Complexity Low', 'Accessibility AA', 'Performance 91', 'Security Findings 0', 'Bundle Size 184KB', 'Documentation 87%'];
    return `
      <section class="ecosystem-diagram py-14">
        <div class="grid lg:grid-cols-[1fr_0.9fr] gap-6">
          <div><p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Architecture visualization</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Inspect dependencies before code lands.</h2><div class="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6"><div class="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">${nodes.map((node, index) => `<button class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-left"><span class="text-xs text-cyan-500">node ${index + 1}</span><p class="font-semibold text-slate-900 dark:text-white">${node}</p><p class="text-sm text-slate-600 dark:text-slate-300">Inspect contracts, risks, owners, and runtime dependencies.</p></button>`).join('')}</div></div></div>
          <div><p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Quality dashboard</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Metrics update with every change.</h2><div class="mt-7 grid grid-cols-2 gap-3">${metrics.map((metric) => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 text-sm font-semibold text-slate-800 dark:text-slate-100">${metric}</div>`).join('')}</div></div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.ecosystemDiagram = ecosystemDiagram;
})(window);
