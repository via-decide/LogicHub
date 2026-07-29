(function (global) {
  function heroSection() {
    const stages = ['Requirements', 'Architecture', 'Reasoning', 'Planning', 'Implementation', 'Testing', 'Deployment', 'Operations'];
    return `
      <section class="hero-section rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 shadow-xl p-8 md:p-12 overflow-hidden">
        <div class="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <p class="text-xs tracking-[0.24em] uppercase text-cyan-600 dark:text-cyan-400 font-semibold">Builder Operating System</p>
            <h1 class="mt-3 text-4xl md:text-6xl font-semibold leading-tight text-slate-900 dark:text-white">Software engineered from requirements to operations.</h1>
            <p class="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl">LogicHub turns requirements into production-ready software through structured reasoning, planning, implementation, validation, deployment, and persistent engineering memory.</p>
            <div class="mt-8 flex flex-wrap gap-3">
              <button class="px-5 py-3 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition" onclick="location.href='../index.html'">Open Builder Workspace</button>
              <button class="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium">Inspect Demo Pipeline</button>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-900">
            <div class="flex items-center justify-between mb-4"><p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Deterministic engineering pipeline</p><span class="text-xs text-emerald-500">Live</span></div>
            <div class="grid sm:grid-cols-2 gap-3 text-sm font-mono">
              ${stages.map((stage, index) => `<div class="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"><div class="flex items-center justify-between"><span>${stage}</span><span class="text-cyan-500">${72 + index * 3}%</span></div><div class="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="h-full rounded-full bg-cyan-500 transition-all duration-700 group-hover:bg-emerald-400" style="width:${72 + index * 3}%"></div></div></div>`).join('')}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.heroSection = heroSection;
})(window);
