(function (global) {
  function ecosystemDiagram() {
    return `
      <section class="ecosystem-diagram py-14">
        <h2 class="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Zayvora Ecosystem</h2>
        <p class="mt-3 text-slate-600 dark:text-slate-300">Logichub → Planning · Zayvora → Reasoning · Daxini → Execution Workspace</p>
        <div class="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8">
          <div class="grid md:grid-cols-3 gap-4 text-sm">
            <div class="p-4 rounded-xl border border-cyan-300/60 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20">
              <p class="font-semibold text-slate-900 dark:text-white">Logichub</p>
              <p class="text-slate-600 dark:text-slate-300">Planning</p>
            </div>
            <div class="p-4 rounded-xl border border-violet-300/60 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20">
              <p class="font-semibold text-slate-900 dark:text-white">Zayvora</p>
              <p class="text-slate-600 dark:text-slate-300">Reasoning</p>
            </div>
            <div class="p-4 rounded-xl border border-emerald-300/60 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20">
              <p class="font-semibold text-slate-900 dark:text-white">Daxini</p>
              <p class="text-slate-600 dark:text-slate-300">Execution Workspace</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.ecosystemDiagram = ecosystemDiagram;
})(window);
