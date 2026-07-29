(function (global) {
  function workflowSteps() {
    const agents = ['Requirements Analyst', 'System Architect', 'Backend Engineer', 'Frontend Engineer', 'QA Engineer', 'Security Reviewer', 'Documentation Writer', 'Deployment Engineer'];
    const timeline = ['Requirements parsed', 'Architecture generated', 'Database designed', 'API planned', 'Frontend generated', 'Tests executed', 'Security scan', 'Deployment package created'];
    return `
      <section class="workflow-steps py-14 grid lg:grid-cols-2 gap-6">
        <div><p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Multi-agent pipeline</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Specialists coordinate the build.</h2><div class="mt-7 space-y-3">${agents.map((agent, index) => `<button class="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-950 hover:border-cyan-400"><div class="flex items-center justify-between"><span class="font-semibold text-slate-900 dark:text-white">${agent}</span><span class="text-xs text-cyan-500">stage ${index + 1}</span></div><p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Owns ${agent.toLowerCase()} responsibility, artifacts, validations, and handoff criteria.</p></button>`).join('')}</div></div>
        <div><p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Software factory timeline</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Clickable execution trace.</h2><div class="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 space-y-3">${timeline.map((item, index) => `<button class="w-full flex items-center gap-3 text-left rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3"><span class="h-7 w-7 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 grid place-items-center text-xs">${index + 1}</span><span class="text-sm text-slate-700 dark:text-slate-200">${item}</span></button>`).join('')}</div></div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.workflowSteps = workflowSteps;
})(window);
